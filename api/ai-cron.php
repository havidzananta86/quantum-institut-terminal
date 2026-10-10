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
function cron_rsi(array $c, int $p=14): float {
    $n=count($c); if($n<$p+1) return 50;
    $g=0;$l=0;
    for($i=1;$i<=$p;$i++){$d=$c[$i]-$c[$i-1];if($d>0)$g+=$d;else$l-=$d;}
    $g/=$p;$l/=$p;
    for($i=$p+1;$i<$n;$i++){$d=$c[$i]-$c[$i-1];$g=($g*($p-1)+max(0,$d))/$p;$l=($l*($p-1)+max(0,-$d))/$p;}
    return $l==0?100:100-100/(1+$g/$l);
}
function cron_macd(array $c): float {
    if(count($c)<35) return 0;
    $s=[];
    for($i=26;$i<=count($c);$i++){$sl=array_slice($c,0,$i);$e=cron_ema($sl,12);$f=cron_ema($sl,26);if($e&&$f)$s[]=$e-$f;}
    $sig=cron_ema($s,9);$last=end($s);
    return $last-($sig??0);
}
function cron_analyze(string $sym, string $iv): ?array {
    $dir = __DIR__.'/../cache/chart';
    $f   = $dir.'/'.md5($sym.'_'.$iv).'.json';
    if (!file_exists($f)) return null;
    $d = json_decode(file_get_contents($f),true);
    $candles = $d['candles'] ?? [];
    if (count($candles)<55) return null;
    $cl=array_column($candles,'close');
    $last=end($cl);
    $e20=cron_ema($cl,20);$e50=cron_ema($cl,50);
    $rsi=cron_rsi(array_slice($cl,-30),14);
    $macd=cron_macd(array_slice($cl,-60));
    $bull=0;$bear=0;
    if($e20&&$e50){if($e20>$e50)$bull++;else$bear++;if($last>$e20)$bull++;else$bear++;}
    if($rsi>55)$bull++;elseif($rsi<45)$bear++;
    if($macd>0)$bull++;elseif($macd<0)$bear++;
    return ['signal'=>$bull>=3?'BULLISH':($bear>=3?'BEARISH':'NEUTRAL'),
            'rsi'=>round($rsi,1),'ema_cross'=>($e20&&$e50)?($e20>$e50?'UP':'DOWN'):null,
            'macd'=>$macd>0?'POS':'NEG','bull'=>$bull,'bear'=>$bear,'price'=>round((float)$last,5)];
}

// ── Ambil sinyal AI dari cache (ai-signal.php sudah cache ke file) ─────────
function get_ai_signal_cached(string $sym): ?array {
    $f = __DIR__.'/../cache/ai_signals/'.$sym.'.json';
    if (!file_exists($f)) return null;
    if ((time() - filemtime($f)) > 1800) return null; // max 30 min stale
    return json_decode(file_get_contents($f), true);
}

// ── Harga terkini dari candle cache (tanpa API call tambahan) ────────────
function get_current_price(string $sym): float {
    // Coba H1 dulu, fallback ke D1
    foreach (['60','D','240'] as $iv) {
        $f = __DIR__.'/../cache/chart/'.md5($sym.'_'.$iv).'.json';
        if (file_exists($f)) {
            $d = json_decode(file_get_contents($f), true);
            $candles = $d['candles'] ?? [];
            if (!empty($candles)) return (float)end($candles)['close'];
        }
    }
    return 0;
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
        $ep = $ep > 0 ? $ep : get_current_price($sym);

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
    $cp     = get_current_price($sym);

    if ($cp <= 0 || $tp <= 0 || $sl <= 0) continue; // data tidak cukup

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
    $isCrypto = in_array($sym, ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT']);
    $pipVal   = $isCrypto ? ($lots * 1) : ($lots * 10);
    $pips     = $dir === 'BUY' ? ($closeAt - $ep) : ($ep - $closeAt);
    $pnl      = round($pips * $pipVal, 2);
    $reason   = $hitTP ? 'TP Hit' : 'SL Hit';

    $pdo->prepare(
        "UPDATE paper_positions
         SET status='closed', close_price=:cp, pnl_usd=:pnl, closed_at=NOW()
         WHERE id=:id"
    )->execute([':cp'=>$closeAt,':pnl'=>$pnl,':id'=>(int)$pos['id']]);

    cron_log("  [{$pos['user_id']}] {$sym} pos#{$pos['id']}: {$reason} at {$closeAt}, PnL={$pnl}");
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

if (!$isCli) echo json_encode($summary, JSON_PRETTY_PRINT);
