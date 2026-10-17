<?php
/** Provision and revoke read-only MetaTrader bridge keys for the signed-in user. */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(10, 300);

$user = qi_require_auth();
$pdo = qi_db();
$uid = (int)$user['user_id'];

function qi_bridge_fail(int $status, string $message, string $code): void {
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message, 'code' => $code]);
    exit();
}

try {
    if (!$pdo->query("SHOW TABLES LIKE 'trading_account_bridge_keys'")->fetch()) {
        qi_bridge_fail(503, 'Modul bridge belum diaktifkan. Jalankan migrasi database.', 'MIGRATION_REQUIRED');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('SELECT a.id, a.provider, a.account_label, a.account_reference, a.connection_status, a.last_synced_at, k.created_at AS bridge_key_created_at FROM trading_accounts a LEFT JOIN trading_account_bridge_keys k ON k.trading_account_id = a.id WHERE a.user_id = :uid ORDER BY a.created_at DESC');
        $stmt->execute([':uid' => $uid]);
        echo json_encode(['status' => 'success', 'accounts' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit();
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') qi_bridge_fail(405, 'Method tidak diizinkan.', 'METHOD_NOT_ALLOWED');

    $input = qi_get_json_body();
    if (!is_array($input)) qi_bridge_fail(400, 'Body JSON tidak valid.', 'INVALID_JSON');
    $action = qi_sanitize_string($input['action'] ?? '', 20);

    if ($action === 'revoke') {
        $accountId = filter_var($input['account_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$accountId || $accountId < 1) qi_bridge_fail(422, 'Akun bridge tidak valid.', 'INVALID_ACCOUNT');
        $stmt = $pdo->prepare("UPDATE trading_accounts SET connection_status = 'revoked' WHERE id = :id AND user_id = :uid");
        $stmt->execute([':id' => $accountId, ':uid' => $uid]);
        if ($stmt->rowCount() !== 1) qi_bridge_fail(404, 'Akun bridge tidak ditemukan.', 'ACCOUNT_NOT_FOUND');
        $revoke = $pdo->prepare('UPDATE trading_account_bridge_keys SET revoked_at = NOW() WHERE trading_account_id = :id');
        $revoke->execute([':id' => $accountId]);
        qi_log('info', 'Read-only bridge revoked', ['user_id' => $uid, 'account_id' => $accountId]);
        echo json_encode(['status' => 'success', 'message' => 'Bridge dinonaktifkan.']);
        exit();
    }

    if ($action === 'share') {
        if (!$pdo->query("SHOW COLUMNS FROM trading_accounts LIKE 'share_positions'")->fetch()) {
            qi_bridge_fail(503, 'Modul berbagi posisi belum diaktifkan. Jalankan migrasi database.', 'MIGRATION_REQUIRED');
        }
        $accountId = filter_var($input['account_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$accountId || $accountId < 1) qi_bridge_fail(422, 'Akun bridge tidak valid.', 'INVALID_ACCOUNT');
        $share = !empty($input['share']) ? 1 : 0;
        $stmt = $pdo->prepare('UPDATE trading_accounts SET share_positions = :share WHERE id = :id AND user_id = :uid');
        $stmt->execute([':share' => $share, ':id' => $accountId, ':uid' => $uid]);
        if ($stmt->rowCount() !== 1) qi_bridge_fail(404, 'Akun bridge tidak ditemukan.', 'ACCOUNT_NOT_FOUND');
        qi_log('info', 'Position sharing changed', ['user_id' => $uid, 'account_id' => $accountId, 'share' => $share]);
        echo json_encode(['status' => 'success', 'message' => $share
            ? 'Posisi akun ini dibagikan ke pengguna PRO/VIP lain.'
            : 'Posisi akun ini tidak lagi dibagikan ke pengguna lain.']);
        exit();
    }

    if ($action !== 'provision') qi_bridge_fail(400, 'Action tidak dikenal.', 'INVALID_ACTION');
    $provider = strtoupper(qi_sanitize_string($input['provider'] ?? '', 10));
    $label = qi_sanitize_string($input['account_label'] ?? '', 100);
    $reference = qi_sanitize_string($input['account_reference'] ?? '', 100);
    if (!in_array($provider, ['MT4', 'MT5'], true) || !$label || !$reference) {
        qi_bridge_fail(422, 'Pilih platform dan isi nama serta nomor referensi akun.', 'INVALID_CONNECTION_DETAILS');
    }

    $bridgeKey = 'QIB_' . bin2hex(random_bytes(32));
    $hash = hash('sha256', $bridgeKey);
    $pdo->beginTransaction();
    $existing = $pdo->prepare('SELECT id FROM trading_accounts WHERE provider = :provider AND account_reference = :reference LIMIT 1 FOR UPDATE');
    $existing->execute([':provider' => $provider, ':reference' => $reference]);
    $row = $existing->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $owner = $pdo->prepare('SELECT id FROM trading_accounts WHERE id = :id AND user_id = :uid');
        $owner->execute([':id' => $row['id'], ':uid' => $uid]);
        if (!$owner->fetch()) { $pdo->rollBack(); qi_bridge_fail(409, 'Nomor akun sudah terhubung ke pengguna lain.', 'ACCOUNT_ALREADY_LINKED'); }
        $stmt = $pdo->prepare("UPDATE trading_accounts SET account_label = :label, connection_status = 'pending', last_synced_at = NULL WHERE id = :id");
        $stmt->execute([':label' => $label, ':id' => $row['id']]);
        $accountId = (int)$row['id'];
    } else {
        $stmt = $pdo->prepare("INSERT INTO trading_accounts (user_id, provider, account_label, account_reference, connection_status) VALUES (:uid, :provider, :label, :reference, 'pending')");
        $stmt->execute([':uid' => $uid, ':provider' => $provider, ':label' => $label, ':reference' => $reference]);
        $accountId = (int)$pdo->lastInsertId();
    }
    $key = $pdo->prepare('INSERT INTO trading_account_bridge_keys (trading_account_id, key_hash, created_at, revoked_at, last_used_at, last_ip) VALUES (:account, :hash, NOW(), NULL, NULL, NULL) ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash), created_at = NOW(), revoked_at = NULL, last_used_at = NULL, last_ip = NULL');
    $key->execute([':account' => $accountId, ':hash' => $hash]);
    $pdo->commit();
    qi_log('info', 'Read-only bridge provisioned', ['user_id' => $uid, 'account_id' => $accountId, 'provider' => $provider]);
    echo json_encode(['status' => 'success', 'message' => 'Bridge Key dibuat. Simpan sekarang; key tidak dapat ditampilkan ulang.', 'data' => ['account_id' => $accountId, 'bridge_key' => $bridgeKey]]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    qi_log('error', 'Account connection request failed', ['exception' => get_class($e)]);
    qi_bridge_fail(500, 'Koneksi akun tidak dapat diproses.', 'CONNECTION_PROCESSING_FAILED');
}
