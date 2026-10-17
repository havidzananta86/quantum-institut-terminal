<?php
/**
 * Posisi terbuka dari snapshot EA read-only.
 *
 * - "mine"     : posisi semua akun milik pengguna yang sedang login (lengkap).
 * - "community": posisi akun pengguna lain, hanya untuk role pro/vip/admin, hanya
 *                akun yang mengizinkan berbagi (share_positions = 1), nama pemilik
 *                disamarkan dan nomor akun tidak pernah dikirim.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$user = qi_require_auth();
$uid = (int)$user['user_id'];
$canSeeOthers = in_array((string)$user['role'], ['pro', 'vip', 'admin'], true);

/** Samarkan nama: "Havidzananta Pratama" -> "Havidzananta P.". */
function qi_mask_name(string $name): string {
    $name = trim(preg_replace('/\s+/', ' ', $name));
    if ($name === '') return 'Pengguna';
    $parts = explode(' ', $name);
    if (count($parts) === 1) return $parts[0];
    return $parts[0] . ' ' . mb_strtoupper(mb_substr($parts[1], 0, 1)) . '.';
}
function qi_decode_positions($json): array {
    $data = json_decode((string)$json, true);
    return is_array($data) ? $data : [];
}

$pdo = qi_db();

try {
    if (!$pdo->query("SHOW TABLES LIKE 'trading_account_positions'")->fetch()) {
        echo json_encode(['status' => 'success', 'notice' => 'MIGRATION_REQUIRED', 'server_now' => date('Y-m-d H:i:s'), 'can_see_others' => $canSeeOthers, 'mine' => [], 'community' => []]);
        exit();
    }
    $hasShare = (bool)$pdo->query("SHOW COLUMNS FROM trading_accounts LIKE 'share_positions'")->fetch();
    $shareExpr = $hasShare ? 'a.share_positions' : '1 AS share_positions';

    $serverNow = $pdo->query('SELECT NOW() AS server_now')->fetch(PDO::FETCH_ASSOC)['server_now'] ?? null;

    // ── posisi milik sendiri ────────────────────────────────────────────────
    $mineStmt = $pdo->prepare(
        "SELECT a.id AS account_id, a.provider, a.account_label, a.account_reference, a.connection_status,
                p.positions_json, p.open_count, p.captured_at, $shareExpr
         FROM trading_accounts a
         INNER JOIN trading_account_positions p ON p.trading_account_id = a.id
         WHERE a.user_id = :uid AND a.connection_status IN ('active', 'pending')
         ORDER BY a.created_at DESC"
    );
    $mineStmt->execute([':uid' => $uid]);
    $mine = [];
    foreach ($mineStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $mine[] = [
            'account_id' => (int)$row['account_id'],
            'provider' => $row['provider'],
            'account_label' => $row['account_label'],
            'account_reference' => $row['account_reference'],
            'share_positions' => (int)$row['share_positions'],
            'captured_at' => $row['captured_at'],
            'open_count' => (int)$row['open_count'],
            'positions' => qi_decode_positions($row['positions_json']),
        ];
    }

    // ── posisi pengguna lain (pro/vip/admin) ───────────────────────────────
    $community = [];
    if ($canSeeOthers) {
        $shareFilter = $hasShare ? 'AND a.share_positions = 1' : '';
        $otherStmt = $pdo->prepare(
            "SELECT a.id AS account_id, a.provider, a.account_label, u.full_name, u.role,
                    p.positions_json, p.open_count, p.captured_at
             FROM trading_account_positions p
             INNER JOIN trading_accounts a ON a.id = p.trading_account_id
             INNER JOIN users u ON u.id = a.user_id
             WHERE a.user_id <> :uid AND a.connection_status = 'active' AND p.open_count > 0 $shareFilter
             ORDER BY p.captured_at DESC
             LIMIT 40"
        );
        $otherStmt->execute([':uid' => $uid]);
        foreach ($otherStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $community[] = [
                'owner' => qi_mask_name((string)$row['full_name']),
                'owner_role' => $row['role'],
                'provider' => $row['provider'],
                'account_label' => $row['account_label'],
                'captured_at' => $row['captured_at'],
                'open_count' => (int)$row['open_count'],
                'positions' => qi_decode_positions($row['positions_json']),
            ];
        }
    }

    echo json_encode([
        'status' => 'success',
        'server_now' => $serverNow,
        'can_see_others' => $canSeeOthers,
        'share_available' => $hasShare,
        'mine' => $mine,
        'community' => $community,
    ]);
} catch (Exception $e) {
    qi_log('error', 'Positions feed failed', ['exception' => get_class($e)]);
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Daftar posisi tidak dapat dimuat.']);
}
