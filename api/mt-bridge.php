<?php
/**
 * Read-only MT4/MT5 bridge receiver.
 * It accepts periodic account snapshots only. Trade commands, credentials, and
 * broker API keys are deliberately unsupported.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 60);

if (!in_array(($_GET['action'] ?? ''), ['snapshot', 'tick'], true) || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(410);
    echo json_encode(['status' => 'error', 'message' => 'Bridge ini hanya menerima snapshot read-only melalui POST.', 'code' => 'READ_ONLY_BRIDGE']);
    exit();
}
$action = (string)$_GET['action'];

$bridgeKey = trim($_SERVER['HTTP_X_QI_BRIDGE_KEY'] ?? '');
if (!preg_match('/^QIB_[a-f0-9]{64}$/', $bridgeKey)) {
    // Ditolak sebelum menyentuh database: catat agar kegagalan EA bisa dilacak dari
    // log server (cache/logs). Nilai key sendiri tidak pernah ditulis.
    qi_log('warning', 'Read-only bridge rejected', ['code' => 'BRIDGE_KEY_INVALID', 'key_header' => $bridgeKey === '' ? 'missing' : 'malformed']);
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Bridge Key tidak valid.', 'code' => 'BRIDGE_KEY_INVALID']);
    exit();
}
$payload = qi_get_json_body();
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.', 'code' => 'INVALID_JSON']);
    exit();
}

$number = static function ($value): ?float {
    return is_numeric($value) && is_finite((float)$value) ? (float)$value : null;
};

// ── Jalur TICK: harga + spread realtime dari EA ─────────────────────────────
// Sengaja TERPISAH dari jalur snapshot dan TIDAK menulis ke database per detik:
// EA mengirim semua simbol dalam SATU permintaan tiap detik, dan hasilnya disimpan
// sebagai satu berkas JSON per akun (ditulis atomik) sehingga pembaca tidak pernah
// melihat berkas setengah jadi. Snapshot 60 detik tetap menjadi jalur resmi untuk
// saldo/ekuitas/posisi.
if ($action === 'tick') {
    $rawTicks = $payload['ticks'] ?? null;
    if (!is_array($rawTicks) || !$rawTicks) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Daftar tick tidak valid.', 'code' => 'INVALID_TICKS']);
        exit();
    }
    $ticks = [];
    foreach (array_slice($rawTicks, 0, 60) as $item) {
        if (!is_array($item)) continue;
        $simbol = strtoupper(substr(preg_replace('/[^A-Za-z0-9._#-]/', '', (string)($item['symbol'] ?? '')), 0, 20));
        if ($simbol === '') continue;
        $bid = $number($item['bid'] ?? null);
        $ask = $number($item['ask'] ?? null);
        // Harga harus masuk akal: positif dan ask tidak boleh di bawah bid.
        if ($bid === null || $ask === null || $bid <= 0 || $ask <= 0 || $ask < $bid) continue;
        $spread = $number($item['spread'] ?? null);
        if ($spread === null || $spread < 0) $spread = $ask - $bid;
        $ticks[$simbol] = [
            'bid'    => round($bid, 6),
            'ask'    => round($ask, 6),
            'spread' => round($spread, 6),
        ];
    }
    if (!$ticks) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Tidak ada tick yang bisa diterima.', 'code' => 'INVALID_TICKS']);
        exit();
    }

    try {
        $pdo = qi_db();
        $hash = hash('sha256', $bridgeKey);
        // Pencarian akun RINGAN (tanpa transaksi/FOR UPDATE) karena dipanggil tiap detik.
        $stmt = $pdo->prepare("SELECT a.id FROM trading_account_bridge_keys k INNER JOIN trading_accounts a ON a.id = k.trading_account_id WHERE k.key_hash = :hash AND k.revoked_at IS NULL AND a.connection_status IN ('pending', 'active') LIMIT 1");
        $stmt->execute([':hash' => $hash]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            qi_log('warning', 'Bridge tick rejected', ['code' => 'BRIDGE_NOT_ACTIVE', 'key_hash_prefix' => substr($hash, 0, 12)]);
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Bridge tidak aktif atau telah dicabut.', 'code' => 'BRIDGE_NOT_ACTIVE']);
            exit();
        }
        $accountId = (int)$row['id'];

        $dir = __DIR__ . '/../cache/ticks';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $file = $dir . '/' . $accountId . '.json';

        // sentuh_terakhir: kapan terakhir kita menulis ke DB dari jalur tick. Dipakai
        // agar UPDATE tidak berjalan tiap detik (boros) melainkan cukup sekali per menit.
        $lama = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
        $sentuhTerakhir = is_array($lama) ? (int)($lama['sentuh_terakhir'] ?? 0) : 0;

        $isi = json_encode([
            'updated'         => time(),
            'sentuh_terakhir' => $sentuhTerakhir,
            'ticks'           => $ticks,
        ], JSON_UNESCAPED_SLASHES);

        // Tulis atomik: tulis ke berkas sementara lalu rename (rename bersifat atomik
        // pada berkas system yang sama) supaya pembaca tidak pernah membaca berkas separuh.
        $tmp = $file . '.tmp' . getmypid();
        $tersimpan = (@file_put_contents($tmp, $isi, LOCK_EX) !== false) && @rename($tmp, $file);

        if ($tersimpan && (time() - $sentuhTerakhir) > 60) {
            $pdo->prepare("UPDATE trading_accounts SET connection_status = 'active', last_synced_at = NOW() WHERE id = :id")->execute([':id' => $accountId]);
            $pdo->prepare('UPDATE trading_account_bridge_keys SET last_used_at = NOW(), last_ip = :ip WHERE trading_account_id = :id')
                ->execute([':id' => $accountId, ':ip' => $_SERVER['REMOTE_ADDR'] ?? null]);
            $isi = json_encode(['updated' => time(), 'sentuh_terakhir' => time(), 'ticks' => $ticks], JSON_UNESCAPED_SLASHES);
            $tmp2 = $file . '.tmp' . getmypid();
            if (@file_put_contents($tmp2, $isi, LOCK_EX) !== false) @rename($tmp2, $file);
        }

        echo json_encode([
            'status'      => 'success',
            'accepted'    => count($ticks),
            'stored'      => (bool)$tersimpan,
            'server_time' => gmdate('c'),
        ]);
    } catch (Exception $e) {
        qi_log('error', 'Bridge tick failed', ['exception' => get_class($e)]);
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Tick tidak dapat diproses.', 'code' => 'TICK_PROCESSING_FAILED']);
    }
    exit();
}

$balance = $number($payload['balance'] ?? null);
$equity = $number($payload['equity'] ?? null);
$margin = $number($payload['margin_used'] ?? 0);

// EA versi baru mengirim daftar posisinya, bukan cuma jumlahnya. Bila daftar ada,
// jumlahnya dipakai sebagai open_positions supaya ringkasan dan daftar tidak beda.
$rawPositions = $payload['positions'] ?? null;
$positionList = [];
if (is_array($rawPositions)) {
    foreach (array_slice($rawPositions, 0, 50) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $symbol = strtoupper(substr(preg_replace('/[^A-Za-z0-9._#-]/', '', (string)($item['symbol'] ?? '')), 0, 32));
        $side = strtoupper(trim((string)($item['side'] ?? '')));
        $volume = $number($item['volume'] ?? null);
        if ($symbol === '' || !in_array($side, ['BUY', 'SELL'], true) || $volume === null || $volume <= 0 || $volume > 1000) {
            continue;
        }
        $positionList[] = [
            'ticket' => substr(preg_replace('/[^A-Za-z0-9._-]/', '', (string)($item['ticket'] ?? '')), 0, 32),
            'symbol' => $symbol,
            'side' => $side,
            'volume' => round($volume, 4),
            'price_open' => $number($item['price_open'] ?? null),
            'price_current' => $number($item['price_current'] ?? null),
            'profit' => $number($item['profit'] ?? null),
            'sl' => $number($item['sl'] ?? null),
            'tp' => $number($item['tp'] ?? null),
        ];
    }
}

$positions = filter_var($payload['open_positions'] ?? null, FILTER_VALIDATE_INT);
if (is_array($rawPositions)) {
    $positions = count($positionList);
}
if ($balance === null || $equity === null || $margin === null || $balance < 0 || $equity < 0 || $margin < 0 || $positions === false || $positions < 0 || $positions > 1000) {
    qi_log('warning', 'Read-only bridge rejected', ['code' => 'INVALID_SNAPSHOT', 'balance' => $balance, 'equity' => $equity, 'margin_used' => $margin]);
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Data snapshot tidak valid.', 'code' => 'INVALID_SNAPSHOT']);
    exit();
}

try {
    $pdo = qi_db();
    require_once __DIR__ . '/_posisi_akun.php';
    $adaTabelPosisi = qi_posisi_akun_siapkan($pdo);   // sebelum beginTransaction (DDL = commit implisit)
    $hash = hash('sha256', $bridgeKey);
    $account = $pdo->prepare("SELECT a.id FROM trading_account_bridge_keys k INNER JOIN trading_accounts a ON a.id = k.trading_account_id WHERE k.key_hash = :hash AND k.revoked_at IS NULL AND a.connection_status IN ('pending', 'active') LIMIT 1 FOR UPDATE");
    $pdo->beginTransaction();
    $account->execute([':hash' => $hash]);
    $row = $account->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        $pdo->rollBack();
        // Key terbaca valid tetapi tidak cocok dengan bridge aktif mana pun —
        // biasanya key lama yang sudah di-rotate atau akun sudah dicabut.
        qi_log('warning', 'Read-only bridge rejected', ['code' => 'BRIDGE_NOT_ACTIVE', 'key_hash_prefix' => substr($hash, 0, 12)]);
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Bridge tidak aktif atau telah dicabut.', 'code' => 'BRIDGE_NOT_ACTIVE']);
        exit();
    }
    $accountId = (int)$row['id'];
    $snapshot = $pdo->prepare('INSERT INTO trading_account_snapshots (trading_account_id, balance, equity, margin_used, open_positions, captured_at) VALUES (:account, :balance, :equity, :margin, :positions, NOW())');
    $snapshot->execute([':account' => $accountId, ':balance' => $balance, ':equity' => $equity, ':margin' => $margin, ':positions' => $positions]);
    $update = $pdo->prepare("UPDATE trading_accounts SET connection_status = 'active', last_synced_at = NOW() WHERE id = :id");
    $update->execute([':id' => $accountId]);
    // Daftar posisi disimpan terpisah (satu baris per akun, ditimpa tiap snapshot).
    // Bila tabelnya belum bisa dibuat (hak DB terbatas), snapshot tetap diterima tanpa gagal.
    if (is_array($rawPositions) && $adaTabelPosisi) {
        $store = $pdo->prepare('INSERT INTO trading_account_positions (trading_account_id, positions_json, open_count, captured_at) VALUES (:id, :json, :count, NOW()) ON DUPLICATE KEY UPDATE positions_json = VALUES(positions_json), open_count = VALUES(open_count), captured_at = NOW()');
        $store->execute([':id' => $accountId, ':json' => json_encode($positionList, JSON_UNESCAPED_SLASHES), ':count' => count($positionList)]);
    }
    $usage = $pdo->prepare('UPDATE trading_account_bridge_keys SET last_used_at = NOW(), last_ip = :ip WHERE trading_account_id = :id');
    $usage->execute([':id' => $accountId, ':ip' => $_SERVER['REMOTE_ADDR'] ?? null]);
    $pdo->commit();
    echo json_encode(['status' => 'success', 'message' => 'Snapshot diterima.', 'server_time' => gmdate('c')]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    qi_log('error', 'Read-only bridge snapshot failed', ['exception' => get_class($e)]);
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Snapshot tidak dapat diproses.', 'code' => 'SNAPSHOT_PROCESSING_FAILED']);
}
