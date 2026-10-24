<?php
/**
 * Quantum AI Cron Job
 * Dijalankan oleh cPanel Cron Jobs setiap 15 menit:
 *   php /home/.../public_html/webapp/api/ai-cron.php
 *
 * Atau via HTTP (dilindungi secret key):
 *   GET /webapp/api/ai-cron.php?key=YOUR_CRON_SECRET
 *
 * Alur:
 * 1. Ambil semua user yang punya AI Auto-Trade aktif
 * 2. Per user, per simbol → panggil AI signal
 * 3. Jika ENTRY + belum ada posisi terbuka → buka paper trade
 * 4. Cek posisi AI terbuka → tutup jika TP/SL tercapai
 */

// Hanya bisa dijalankan dari CLI atau dengan secret key
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    // HTTP mode — verifikasi secret key
    define('QI_DEV', true); // cron tidak perlu CORS
    require_once __DIR__ . '/_middleware.php';

    $cronKey    = '';
    $keysFile   = __DIR__ . '/../config/api_keys.php';
    if (file_exists($keysFile)) { include_once $keysFile; }
    if (defined('CRON_SECRET_KEY')) $cronKey = CRON_SECRET_KEY;

    $providedKey = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
    if (!$cronKey || !hash_equals($cronKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Akses ditolak']);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
} else {
    define('QI_DEV', false);
    require_once __DIR__ . '/_middleware.php';
}

// Model P/L yang sama dengan sisi klien (lihat api/_paper_math.php).
require_once __DIR__ . '/_paper_math.php';
// RSI Wilder bersama + penjaga pasar tutup (api/_sinyal_pasar.php).
require_once __DIR__ . '/_sinyal_pasar.php';
// Rumus sinyal tunggal (EMA/RSI/MACD) dipakai bersama cron, ai-signal, dan klien.
require_once __DIR__ . '/_signal_engine.php';

$pdo = qi_db();

$SYMBOLS = ['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','BNBUSDT','XRPUSDT'];
$log = [];

function cron_log(string $msg): void {
    global $log;
    $line = '[' . date('H:i:s') . '] ' . $msg;
    $log[] = $line;
    if (php_sapi_name() === 'cli') echo $line . PHP_EOL;
    error_log('[AI-CRON] ' . $msg);
}

// ── Pastikan tabel ada ─────────────────────────────────────────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS ai_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        symbols JSON,
        lots DECIMAL(6,2) NOT NULL DEFAULT 0.10,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS ai_trade_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        action VARCHAR(20) NOT NULL,
        confidence TINYINT UNSIGNED,
        entry_price DECIMAL(20,6),
        tp DECIMAL(20,6),
        sl DECIMAL(20,6),
        risk_reward DECIMAL(6,2),
        reason VARCHAR(200),
        executed TINYINT(1) NOT NULL DEFAULT 0,
        position_id INT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("ALTER TABLE paper_positions ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'");
} catch (PDOException $e) { /* ignore: column/table already exists */ }

// ── Signal functions (dari signals.php) ───────────────────────────────────
function cron_ema(array $c, int $p): ?float {
    if (count($c) < $p) return null;
    $k = 2/($p+1); $e = array_sum(array_slice($c,0,$p))/$p;
    for ($i=$p;$i<count($c);$i++) $e=$c[$i]*$k+$e*(1-$k);
    return $e;
}
/** RSI Wilder atas SELURUH riwayat — implementasi bersama qi_sp_rsi() (dulu salinan sendiri: 100 pada data datar). */
function cron_rsi(array $c, int $p=14): float {
    return qi_sp_rsi($c, $p);
}
function cron_macd(array $c): float {
    if(count($c)<35) return 0;
    $s=[];
    for($i=26;$i<=count($c);$i++){$sl=array_slice($c,0,$i);$e=cron_ema($sl,12);$f=cron_ema($sl,26);if($e&&$f)$s[]=$e-$f;}
    $sig=cron_ema($s,9);$last=end($s);
    return $last-($sig??0);
}
/**
 * Berkas cache candle yang dipakai, urut prioritas: cache feed broker MT5 (akhiran _mt5, ditulis
 * get-chart-data.php) lalu cache umum (OANDA/sumber lama). MT5 dilewati bila jauh lebih basi
 * (> 5 menit) daripada cache umum, misalnya bridge VPS sedang mati.
 */
function cron_chart_files(string $sym, string $iv): array {
    $dir  = __DIR__.'/../cache/chart';
    $umum = $dir.'/'.md5(strtoupper($sym).'_'.$iv).'.json';
    $mt5  = $dir.'/'.md5(strtoupper($sym).'_'.$iv.'_mt5').'.json';
    if (is_file($mt5) && (!is_file($umum) || (int)@filemtime($mt5) >= (int)@filemtime($umum) - 300)) return [$mt5, $umum];
    return [$umum];
}
function cron_analyze(string $sym, string $iv): ?array {
    $f = null;
    foreach (cron_chart_files($sym, $iv) as $c) { if (file_exists($c)) { $f = $c; break; } }
    if ($f === null) return null;
    $d = json_decode(file_get_contents($f),true);
    if (!empty($d['simulated'])) return null;
    try {
        // Bar ber-rentang nol (O=H=L=C saat pasar tutup) tetap dibuang sebelum masuk
        // mesin: deret datar itulah yang dulu membuat RSI akhir pekan = 100.
        $all = qt_signal_normalize_candle_series(qi_sp_buang_datar($d["candles"] ?? []));
        if (count($all) < 57) return null;
        $r = qt_signal_analyze(array_slice($all, 0, -1), ['source' => $d['source'] ?? 'Chart feed']);
        return [
            'signal' => $r['signal'], 'side' => $r['side'], 'rsi' => round((float)$r['rsi'], 1),
            'ema_cross' => $r['ema20'] !== null && $r['ema50'] !== null ? ($r['ema20'] > $r['ema50'] ? 'UP' : 'DOWN') : null,
            'macd' => ($r['macd'] ?? 0) > 0 ? 'POS' : (($r['macd'] ?? 0) < 0 ? 'NEG' : 'ZERO'),
            'bull' => (int)$r['bull'], 'bear' => (int)$r['bear'], 'price' => round((float)$r['current'], 5),
            'entry' => $r['entry'], 'sl' => $r['sl'], 'tp' => $r['tp'], 'risk_reward' => $r['rr'],
            'confidence' => (int)$r['confidence'], 'reason' => $r['reason'], 'engine_version' => QT_SIGNAL_ENGINE_VERSION,
        ];
    } catch (Throwable $e) {
        cron_log("  {$sym}/{$iv}: signal feed rejected — " . $e->getMessage());
        return null;
    }
}

// ── Ambil sinyal AI dari cache (ai-signal.php sudah cache ke file) ─────────
function get_ai_signal_cached(string $sym): ?array {
    $f = __DIR__.'/../cache/ai_signals/'.$sym.'.json';
    if (!file_exists($f)) return null;
    if ((time() - filemtime($f)) > 1800) return null; // max 30 min stale
    return json_decode(file_get_contents($f), true);
}

// ── Harga terkini ──────────────────────────────────────────────────────────
// Utama: Bid/Ask live dari feed broker MT5 (bridge VPS), sama dengan chart LIVE · MT5.
// Cadangan: close candle terakhir dari cache (MT5 lalu umum); saat itu Bid = Ask.
//
// 'hidup' (audit sinyal 2026-10-22): true HANYA bila harga itu benar-benar harga pasar saat ini —
// tick MT5 dengan pasar buka, atau berkas cache yang ditulis ≤ 5 menit lalu DAN lolos
// qi_sp_cek_pasar (pasar buka, candle terakhir ≤ 2 batang). Tanpa ini cron membuka/menutup
// posisi dari close Jumat di akhir pekan atau dari cache yang berumur berjam-jam.
function get_current_quote(string $sym): array {
    static $memo = [];
    if (isset($memo[$sym])) return $memo[$sym];
    // Interval paling halus dulu (paling segar); yang pertama "hidup" dipakai. Bila tidak ada
    // yang hidup, harga pertama (MT5 atau cache) tetap dikembalikan untuk log, dengan hidup = false.
    $cadangan = null;
    if (qi_tv_bridge_symbol($sym) !== null && qi_mt5_configured()) {
        $q = qi_mt5_quotes([$sym])[strtoupper($sym)] ?? null;
        if ($q && (float)$q['bid'] > 0 && (float)$q['ask'] >= (float)$q['bid']) {
            // Status 'market' broker (tick > 180 detik = closed) sudah mendeteksi jeda harian emas,
            // jadi di sini cukup jendela pekan — jam 22–23 UTC musim panas emas memang buka.
            $hidup = ($q['market'] ?? 'open') !== 'closed' && (qi_sp_kripto($sym) || qi_sp_jendela_pekan(time()));
            $qMt5 = ['bid' => (float)$q['bid'], 'ask' => (float)$q['ask'], 'source' => 'mt5', 'hidup' => $hidup];
            if ($hidup) return $memo[$sym] = $qMt5;
            // Kutipan MT5 TUTUP (tick > 180 detik, mis. broker menutup kripto di akhir pekan): dulu
            // langsung dikembalikan sehingga BTCUSDT dengan cache Binance yang segar dianggap mati —
            // posisi AI tidak dibuka dan TP/SL-nya tidak dikelola sampai broker buka (audit ulang
            // 2026-10-22). Sekarang cache segar di bawah ini tetap dicoba.
            $cadangan = $qMt5;
        }
    }
    foreach (['5','15','60','240','D'] as $iv) {
        foreach (cron_chart_files($sym, $iv) as $f) {
            if (!file_exists($f)) continue;
            $d = json_decode(file_get_contents($f), true);
            $candles = $d['candles'] ?? [];
            if (empty($candles) || !empty($d['simulated'])) continue;
            $p = (float)end($candles)['close'];
            $segar = (time() - (int)@filemtime($f)) <= 300 && qi_sp_cek_pasar($sym, $candles, qi_sp_durasi($iv))['boleh'];
            $q = ['bid' => $p, 'ask' => $p, 'source' => (string)($d['source'] ?? 'cache'), 'hidup' => $segar];
            if ($segar) return $memo[$sym] = $q;
            if ($cadangan === null) $cadangan = $q;
        }
    }
    return $memo[$sym] = $cadangan ?? ['bid' => 0.0, 'ask' => 0.0, 'source' => '', 'hidup' => false];
}
function get_current_price(string $sym): float {
    return get_current_quote($sym)['bid'];
}

// ── Step 1: Buka posisi baru berdasarkan AI signal ────────────────────────
cron_log("=== AI Cron Start: " . date('Y-m-d H:i:s') . " ===");

$usersStmt = $pdo->query(
    "SELECT as2.user_id, as2.symbols, as2.lots
     FROM ai_settings as2
     WHERE as2.enabled = 1"
);
$aiUsers = $usersStmt->fetchAll(PDO::FETCH_ASSOC);
cron_log("AI users aktif: " . count($aiUsers));

$openedCount = 0;
$skippedCount = 0;

foreach ($aiUsers as $u) {
    $uid   = (int)$u['user_id'];
    $syms  = json_decode($u['symbols'] ?? '[]', true) ?: $SYMBOLS;
    $lots  = (float)$u['lots'];

    foreach ($syms as $sym) {
        $sig = get_ai_signal_cached($sym);
        if (!$sig || $sig['status'] !== 'success') {
            cron_log("  [{$uid}] {$sym}: no cached signal, skip");
            $skippedCount++;
            continue;
        }

        $aiAction   = $sig['action'] ?? 'SKIP';
        $confidence = (int)($sig['confidence'] ?? 0);
        $ep         = (float)($sig['entry_price'] ?? 0);
        $tp         = (float)($sig['tp'] ?? 0);
        $sl         = (float)($sig['sl'] ?? 0);
        $rr         = (float)($sig['risk_reward'] ?? 0);
        $reason     = $sig['reason'] ?? '';

        if (!in_array($aiAction, ['ENTRY_BUY','ENTRY_SELL'])) {
            cron_log("  [{$uid}] {$sym}: AI=SKIP (conf={$confidence})");
            $skippedCount++;
            continue;
        }

        // Cek confidence threshold
        if ($confidence < 65) {
            cron_log("  [{$uid}] {$sym}: confidence terlalu rendah ({$confidence})");
            $skippedCount++;
            continue;
        }

        // Cek posisi terbuka
        $chk = $pdo->prepare("SELECT id FROM paper_positions WHERE user_id=:uid AND symbol=:sym AND status='open' LIMIT 1");
        $chk->execute([':uid'=>$uid,':sym'=>$sym]);
        if ($chk->fetchColumn()) {
            cron_log("  [{$uid}] {$sym}: sudah ada posisi terbuka, skip");
            $skippedCount++;
            continue;
        }

        $direction = $aiAction === 'ENTRY_BUY' ? 'BUY' : 'SELL';
        // SELALU dibuka di harga pasar HIDUP: BUY di Ask, SELL di Bid (seperti MT5). Dulu memakai
        // entry_price AI bila ada — harga yang bisa jauh dari pasar, sehingga posisi simulasi
        // "terisi" di harga yang tidak pernah tersedia (audit sinyal 2026-10-22).
        $kini = get_current_quote($sym);
        if (empty($kini['hidup'])) {
            cron_log("  [{$uid}] {$sym}: pasar tutup / harga live tidak tersedia ({$kini['source']}), skip");
            $skippedCount++;
            continue;
        }
        $epAi = $ep;
        $ep = $direction === 'BUY' ? (float)$kini['ask'] : (float)$kini['bid'];
        // SL/TP AI harus tetap di sisi yang benar dari harga pasar; bila harga sudah melewatinya,
        // rencana AI usang — tidak dibuka (bukan dibuka lalu langsung "kena").
        $levelSah = $ep > 0 && $sl > 0 && $tp > 0
            && ($direction === 'BUY' ? ($sl < $ep && $ep < $tp) : ($tp < $ep && $ep < $sl));
        if (!$levelSah) {
            cron_log("  [{$uid}] {$sym}: harga pasar {$ep} sudah di luar SL {$sl} / TP {$tp} rencana AI (entry AI {$epAi}), skip");
            $skippedCount++;
            continue;
        }

        $pdo->beginTransaction();
        try {
            $ins = $pdo->prepare(
                "INSERT INTO paper_positions
                 (user_id,symbol,direction,lots,entry_price,stop_loss,take_profit,status,source,opened_at)
                 VALUES(:uid,:sym,:dir,:lots,:ep,:sl,:tp,'open','ai',NOW())"
            );
            $ins->execute([
                ':uid'=>$uid,':sym'=>$sym,':dir'=>$direction,
                ':lots'=>$lots,':ep'=>$ep>0?$ep:null,
                ':sl'=>$sl>0?$sl:null,':tp'=>$tp>0?$tp:null,
            ]);
            $posId = (int)$pdo->lastInsertId();

            $pdo->prepare(
                "INSERT INTO ai_trade_log
                 (user_id,symbol,action,confidence,entry_price,tp,sl,risk_reward,reason,executed,position_id)
                 VALUES(:uid,:sym,:act,:conf,:ep,:tp,:sl,:rr,:reason,1,:pid)"
            )->execute([
                ':uid'=>$uid,':sym'=>$sym,':act'=>$aiAction,':conf'=>$confidence,
                ':ep'=>$ep>0?$ep:null,':tp'=>$tp>0?$tp:null,':sl'=>$sl>0?$sl:null,
                ':rr'=>$rr,':reason'=>substr($reason,0,200),':pid'=>$posId,
            ]);

            $pdo->commit();
            cron_log("  [{$uid}] {$sym}: OPEN {$direction} pos#{$posId} ep={$ep} tp={$tp} sl={$sl} conf={$confidence}%");
            $openedCount++;
        } catch (Exception $e) {
            $pdo->rollBack();
            cron_log("  [{$uid}] {$sym}: ERROR opening: " . $e->getMessage());
        }
    }
}

// ── Step 2: Cek TP/SL untuk posisi AI terbuka ────────────────────────────
cron_log("Checking open AI positions for TP/SL...");

$openStmt = $pdo->query(
    "SELECT * FROM paper_positions WHERE status='open' AND source='ai' ORDER BY opened_at ASC"
);
$openPositions = $openStmt->fetchAll(PDO::FETCH_ASSOC);
cron_log("Open AI positions: " . count($openPositions));

$closedCount = 0;
foreach ($openPositions as $pos) {
    $sym    = $pos['symbol'];
    $ep     = (float)$pos['entry_price'];
    $tp     = (float)($pos['take_profit'] ?? 0);
    $sl     = (float)($pos['stop_loss']   ?? 0);
    $dir    = $pos['direction'];
    $lots   = (float)$pos['lots'];
    // Seperti MT5: posisi BUY ditutup di Bid, posisi SELL ditutup di Ask.
    $kini   = get_current_quote($sym);
    $cp     = $dir === 'BUY' ? $kini['bid'] : $kini['ask'];

    if ($cp <= 0 || $tp <= 0 || $sl <= 0) continue; // data tidak cukup
    // Pasar tutup / harga basi: TP/SL tidak diputuskan dari harga yang bukan harga saat ini.
    if (empty($kini['hidup'])) continue;

    $hitTP = $hitSL = false;
    if ($dir === 'BUY') {
        $hitTP = $cp >= $tp;
        $hitSL = $cp <= $sl;
    } else {
        $hitTP = $cp <= $tp;
        $hitSL = $cp >= $sl;
    }

    if (!$hitTP && !$hitSL) continue;

    $closeAt = $hitTP ? $tp : $sl;
    // P/L memakai model yang sama dengan sisi klien (_pipMult).
    $pnl      = qi_paper_pnl((string)$sym, (string)$dir, (float)$ep, (float)$closeAt, (float)$lots);
    $reason   = $hitTP ? 'TP Hit' : 'SL Hit';

    $pdo->prepare(
        "UPDATE paper_positions
         SET status='closed', close_price=:cp, pnl_usd=:pnl, closed_at=NOW()
         WHERE id=:id"
    )->execute([':cp'=>$closeAt,':pnl'=>$pnl,':id'=>(int)$pos['id']]);

    cron_log("  [{$pos['user_id']}] {$sym} pos#{$pos['id']}: {$reason} at {$closeAt}, PnL={$pnl} (harga {$kini['source']})");
    $closedCount++;
}

$summary = [
    'status'     => 'success',
    'timestamp'  => date('Y-m-d H:i:s'),
    'ai_users'   => count($aiUsers),
    'opened'     => $openedCount,
    'skipped'    => $skippedCount,
    'closed_tp_sl' => $closedCount,
    'log'        => $log,
];

cron_log("=== Done: opened={$openedCount} skipped={$skippedCount} closed={$closedCount} ===");

// DETAK: bukti putaran ini selesai, dibaca api/health.php. Tanpa ini, cron sinyal AI bisa
// berhenti berminggu-minggu tanpa ada yang tahu — tidak ada error, semuanya hanya diam.
try {
    require_once __DIR__ . '/_detak_cron.php';
    qi_cron_detak(['dibuka' => $openedCount, 'dilewati' => $skippedCount, 'ditutup' => $closedCount], 'ai');
} catch (Throwable $e) { error_log('[QI AI Cron] detak gagal: ' . $e->getMessage()); }

if (!$isCli) echo json_encode($summary, JSON_PRETTY_PRINT);
