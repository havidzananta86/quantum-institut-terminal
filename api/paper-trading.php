<?php
/**
 * Paper Trading Persistence API
 *
 * GET  → muat snapshot posisi & history milik user (butuh token)
 * POST → simpan snapshot {positions[], history[]}; P/L & waktu ditentukan server (lihat blok POST)
 *
 * Paper trading = uang virtual, jadi tidak ada risiko finansial nyata.
 * Tetap divalidasi tipe & dibatasi ukuran array untuk cegah payload sampah.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$user = qi_require_level('pro');  // Paper Trading — PRO
$uid  = (int)$user['user_id'];
$pdo  = qi_db();

$ALLOWED_SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','XRPUSDT','DOGEUSDT'];
$STARTING_BALANCE = 10000.0;

// ─── GET: muat snapshot ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // UNIX_TIMESTAMP di MySQL: kolom waktu tersimpan di zona waktu sesi MySQL, sedangkan zona PHP
    // (php.ini) bisa berbeda — strtotime() di PHP akan menggeser jamnya.
    $stmt = $pdo->prepare('SELECT *, UNIX_TIMESTAMP(opened_at) AS opened_ts, UNIX_TIMESTAMP(closed_at) AS closed_ts
                           FROM paper_positions WHERE user_id = :uid ORDER BY opened_at ASC, id ASC');
    $stmt->execute([':uid' => $uid]);
    $rows = $stmt->fetchAll();

    $positions = [];
    $history   = [];
    $closedPnl = 0.0;
    $iso = static fn($ts) => $ts ? gmdate('Y-m-d\\TH:i:s\\Z', (int)$ts) : null;

    foreach ($rows as $r) {
        $obj = [
            'id'         => 'POS-' . $r['id'],
            'symbol'     => $r['symbol'],
            'side'       => $r['direction'],
            'lots'       => (float)$r['lots'],
            'entryPrice' => (float)$r['entry_price'],
            'sl'         => $r['stop_loss']   !== null ? (float)$r['stop_loss']   : null,
            'tp'         => $r['take_profit'] !== null ? (float)$r['take_profit'] : null,
            'openedAt'   => $iso($r['opened_ts']),   // ISO-8601 UTC, tanggal + jam lengkap
            'src'        => $r['source'] ?? 'manual',  // 'auto' = dari Ikuti Auto Analisa, 'ai' = AI Auto-Trade
        ];
        if ($r['status'] === 'open') {
            $obj['floatingPnL'] = 0;
            $obj['openTime']    = $r['opened_ts'] ? date('H:i:s', (int)$r['opened_ts']) : '';
            $positions[] = $obj;
        } elseif ($r['status'] === 'closed') {
            $obj['closePrice']  = (float)$r['close_price'];
            $obj['realizedPnL'] = (float)$r['pnl_usd'];
            $obj['closeTime']   = $r['closed_ts'] ? date('H:i:s', (int)$r['closed_ts']) : '';
            $obj['closedAt']    = $iso($r['closed_ts']);   // tanggal lengkap (batas rugi harian, P/L "Hari ini")
            $obj['_ts']         = (int)$r['closed_ts'];
            $obj['_id']         = (int)$r['id'];
            $closedPnl += (float)$r['pnl_usd'];
            $history[] = $obj;
        }
    }

    // History terbaru ditutup di atas (sama seperti unshift di klien). Diurutkan menurut waktu
    // tutup, bukan waktu buka, supaya urutan stabil antar muat → simpan.
    usort($history, static fn($a, $b) => [$b['_ts'], $b['_id']] <=> [$a['_ts'], $a['_id']]);
    foreach ($history as &$h) unset($h['_ts'], $h['_id']);
    unset($h);

    echo json_encode(['status' => 'success', 'data' => [
        'balance'   => round($STARTING_BALANCE + $closedPnl, 2),
        'positions' => $positions,
        'history'   => $history,
    ]]);
    exit();
}

// ─── POST: simpan snapshot — SERVER YANG MENENTUKAN P/L ──────────────
// Aturan integritas (dipakai juga oleh papan peringkat Competition):
//   1. Trade yang sudah DITUTUP tidak dapat diubah atau dihapus lewat endpoint ini.
//   2. Penutupan hanya sah bila ada posisi TERBUKA tersimpan yang cocok; P/L-nya
//      dihitung ulang di server (qi_paper_pnl) — nilai realizedPnL kiriman klien diabaikan.
//   3. Harga buka/tutup baru harus wajar terhadap harga acuan server (cache live-price):
//      selisih ≤ 1% bila harga acuan segar (≤ 2 menit), atau di dalam rentang high/low
//      24 jam (±0,5%) bila ≤ 15 menit. Tanpa harga acuan, dicatat apa adanya.
//   4. Waktu buka & tutup dipertahankan (dulu disetel ulang ke NOW() setiap simpan). Waktu kiriman
//      klien (openedAt/closedAt, ISO-8601) dipakai hanya bila ≤ 15 menit lalu dan tidak di masa depan
//      (mis. simpan yang tertunda); selain itu NOW().
// Jawaban memuat `ditolak` (alasan per baris) dan snapshot terbaru untuk sinkron ulang.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/_paper_math.php';
    $input = qi_get_json_body();
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
        exit();
    }

    $positions = is_array($input['positions'] ?? null) ? $input['positions'] : [];
    $history   = is_array($input['history']   ?? null) ? $input['history']   : [];
    if (count($positions) > 200 || count($history) > 1000) {
        http_response_code(413);
        echo json_encode(['status' => 'error', 'message' => 'Terlalu banyak posisi/history.']);
        exit();
    }

    $normSym = static function ($s) use ($ALLOWED_SYMBOLS) {
        $s = strtoupper(is_string($s) ? trim($s) : '');
        return in_array($s, $ALLOWED_SYMBOLS, true) ? $s : null;
    };
    $num = static fn($v) => is_numeric($v) ? (float)$v : null;
    $kunci = static fn(string $sym, string $dir, float $lots, float $entry) => $sym . '|' . $dir . '|' . number_format($lots, 2, '.', '') . '|' . rtrim(rtrim(number_format($entry, 6, '.', ''), '0'), '.');

    /** Harga acuan dari cache live-price (dibuat oleh api/live-price.php). */
    $acuanCache = [];
    $hargaAcuan = static function (string $sym) use (&$acuanCache): ?array {
        if (array_key_exists($sym, $acuanCache)) return $acuanCache[$sym];
        $berkas = (array)@glob(__DIR__ . '/../cache/live-price/*.json');
        usort($berkas, static fn($a, $b) => @filemtime($b) <=> @filemtime($a));
        $hasil = null;
        foreach (array_slice($berkas, 0, 60) as $f) {
            $umur = time() - (int)@filemtime($f);
            if ($umur > 900) break;
            $j = json_decode((string)@file_get_contents($f), true);
            $p = $j['prices'][$sym] ?? null;
            if (is_array($p) && ($p['price'] ?? 0) > 0) {
                $hasil = ['price' => (float)$p['price'], 'high' => (float)($p['high'] ?? 0), 'low' => (float)($p['low'] ?? 0), 'umur' => $umur];
                break;
            }
        }
        return $acuanCache[$sym] = $hasil;
    };
    $hargaWajar = static function (string $sym, float $harga) use ($hargaAcuan): ?string {
        $a = $hargaAcuan($sym);
        if ($a === null) return null;   // tidak ada acuan → tidak bisa dinilai, diterima
        if ($a['umur'] <= 120 && abs($harga - $a['price']) / $a['price'] <= 0.01) return null;
        if ($a['high'] > 0 && $a['low'] > 0 && $harga >= $a['low'] * 0.995 && $harga <= $a['high'] * 1.005) return null;
        return 'harga ' . $harga . ' terlalu jauh dari harga pasar ' . $a['price'];
    };
    /** Waktu kiriman klien → epoch, atau null (lalu server memakai NOW()). */
    $waktuKlien = static function ($v, int $palingAwal = 0): ?int {
        $t = is_string($v) && $v !== '' ? strtotime($v) : false;
        if ($t === false) return null;
        $kini = time();
        if ($t > $kini + 5 || $t < $kini - 900 || $t < $palingAwal) return null;
        return $t;
    };

    $ditolak = [];
    try {
        $pdo->beginTransaction();
        // Posisi otomatis (source 'ai' / 'auto') dikelola server: tidak boleh diubah, ditutup, atau digandakan
        // lewat simpan snapshot klien (klien memuatnya lewat GET lalu mengirimnya kembali apa adanya).
        $st = $pdo->prepare("SELECT id FROM paper_positions WHERE user_id = :uid AND status = 'open' AND source IN ('ai', 'auto')");
        $st->execute([':uid' => $uid]);
        $dilindungi = array_fill_keys(array_map(static fn($id) => 'POS-' . $id, $st->fetchAll(PDO::FETCH_COLUMN)), true);
        $st = $pdo->prepare("SELECT *, UNIX_TIMESTAMP(opened_at) AS opened_ts FROM paper_positions WHERE user_id = :uid AND status = 'open' AND source NOT IN ('ai', 'auto') FOR UPDATE");
        $st->execute([':uid' => $uid]);
        $terbuka = [];   // id DB → baris
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $r['_kunci'] = $kunci($r['symbol'], $r['direction'], (float)$r['lots'], (float)$r['entry_price']);
            $terbuka[(int)$r['id']] = $r;
        }
        $st = $pdo->prepare("SELECT id, symbol, direction, lots, entry_price, close_price FROM paper_positions WHERE user_id = :uid AND status = 'closed'");
        $st->execute([':uid' => $uid]);
        $sudahTutup = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $sudahTutup['POS-' . $r['id']] = true;
            $sudahTutup[$kunci($r['symbol'], $r['direction'], (float)$r['lots'], (float)$r['entry_price']) . '@' . (float)$r['close_price']] = true;
        }
        $cariTerbuka = static function (array $p, string $k) use (&$terbuka): ?int {
            $id = (string)($p['id'] ?? '');
            if (preg_match('/^POS-(\d+)$/', $id, $m) && isset($terbuka[(int)$m[1]])) return (int)$m[1];
            foreach ($terbuka as $dbId => $r) if ($r['_kunci'] === $k) return $dbId;
            return null;
        };

        // 1) Penutupan baru
        $tutup = $pdo->prepare("UPDATE paper_positions SET status = 'closed', close_price = :close, pnl_usd = :pnl, closed_at = COALESCE(FROM_UNIXTIME(:cts), NOW()) WHERE id = :id AND user_id = :uid AND status = 'open'");
        foreach ($history as $p) {
            $sym = $normSym($p['symbol'] ?? '');
            $entry = $num($p['entryPrice'] ?? null);
            $close = $num($p['closePrice'] ?? null);
            $lots = $num($p['lots'] ?? null);
            $dir = (($p['side'] ?? 'BUY') === 'SELL') ? 'SELL' : 'BUY';
            if ($sym === null || !$entry || !$close || !$lots) continue;
            $k = $kunci($sym, $dir, $lots, $entry);
            if (isset($sudahTutup[(string)($p['id'] ?? '')]) || isset($sudahTutup[$k . '@' . $close])) continue;   // sudah tercatat, tidak diubah
            $dbId = $cariTerbuka($p, $k);
            if ($dbId === null) { $ditolak[] = ['id' => $p['id'] ?? null, 'alasan' => 'tidak ada posisi terbuka tersimpan yang cocok untuk ditutup']; continue; }
            if ($alasan = $hargaWajar($sym, $close)) { $ditolak[] = ['id' => $p['id'] ?? null, 'alasan' => 'penutupan ditolak: ' . $alasan]; continue; }
            $tutup->execute([':close' => $close, ':pnl' => qi_paper_pnl($sym, $dir, (float)$terbuka[$dbId]['entry_price'], $close, (float)$terbuka[$dbId]['lots']),
                             ':cts' => $waktuKlien($p['closedAt'] ?? null, (int)$terbuka[$dbId]['opened_ts']), ':id' => $dbId, ':uid' => $uid]);
            unset($terbuka[$dbId]);
        }

        // 2) Posisi terbuka: yang cocok dipertahankan (SL/TP boleh berubah), yang baru divalidasi
        $ubahSlTp = $pdo->prepare('UPDATE paper_positions SET stop_loss = :sl, take_profit = :tp WHERE id = :id AND user_id = :uid');
        $buka = $pdo->prepare("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, status, opened_at, source)
                               VALUES (:uid, :sym, :dir, :lots, :entry, :sl, :tp, 'open', COALESCE(FROM_UNIXTIME(:ots), NOW()), 'manual')");
        $dipakai = [];
        foreach ($positions as $p) {
            if (isset($dilindungi[(string)($p['id'] ?? '')])) continue;   // posisi otomatis: dilewati, tidak digandakan
            $sym = $normSym($p['symbol'] ?? '');
            $entry = $num($p['entryPrice'] ?? null);
            $lots = $num($p['lots'] ?? null);
            $dir = (($p['side'] ?? 'BUY') === 'SELL') ? 'SELL' : 'BUY';
            if ($sym === null || !$entry || $entry <= 0) { $ditolak[] = ['id' => $p['id'] ?? null, 'alasan' => 'simbol atau harga tidak sah']; continue; }
            if (!$lots || $lots < 0.01 || $lots > 100) { $ditolak[] = ['id' => $p['id'] ?? null, 'alasan' => 'lot harus 0,01–100']; continue; }
            $k = $kunci($sym, $dir, $lots, $entry);
            $dbId = $cariTerbuka($p, $k);
            if ($dbId !== null && !isset($dipakai[$dbId])) {
                $dipakai[$dbId] = true;
                $ubahSlTp->execute([':sl' => $num($p['sl'] ?? null), ':tp' => $num($p['tp'] ?? null), ':id' => $dbId, ':uid' => $uid]);
                continue;
            }
            if ($alasan = $hargaWajar($sym, $entry)) { $ditolak[] = ['id' => $p['id'] ?? null, 'alasan' => 'posisi ditolak: ' . $alasan]; continue; }
            $buka->execute([':uid' => $uid, ':sym' => $sym, ':dir' => $dir, ':lots' => $lots, ':entry' => $entry, ':sl' => $num($p['sl'] ?? null), ':tp' => $num($p['tp'] ?? null),
                            ':ots' => $waktuKlien($p['openedAt'] ?? null)]);
            $dipakai[(int)$pdo->lastInsertId()] = true;
        }

        // 3) Posisi terbuka MANUAL tersimpan yang tidak dikirim lagi → dibatalkan (bukan dihapus, tanpa P/L).
        //    Posisi otomatis (source=ai / auto) tidak pernah disentuh endpoint ini.
        $batal = $pdo->prepare("UPDATE paper_positions SET status = 'cancelled', closed_at = NOW() WHERE id = :id AND user_id = :uid AND status = 'open'");
        foreach ($terbuka as $dbId => $_) if (!isset($dipakai[$dbId])) $batal->execute([':id' => $dbId, ':uid' => $uid]);

        $pdo->commit();
        echo json_encode(['status' => 'success', 'ditolak' => $ditolak]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[QI PaperTrading] save error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan posisi.']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Metode tidak didukung.']);
