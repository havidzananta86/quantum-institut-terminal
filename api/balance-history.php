<?php
/**
 * Riwayat saldo & ekuitas dari snapshot EA read-only (untuk grafik).
 *
 * Data berasal dari tabel trading_account_snapshots yang diisi api/mt-bridge.php
 * setiap ±60 detik. Supaya ringan, titik data dikelompokkan (downsample):
 *   24 jam -> bucket 5 menit (maks 288 titik)
 *    7 hari -> bucket 1 jam  (maks 168 titik)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$user = qi_require_auth();
$uid  = (int)$user['user_id'];

$range = (($_GET['range'] ?? '24h') === '7d') ? '7d' : '24h';
$stepSeconds = $range === '7d' ? 3600 : 300;
$days        = $range === '7d' ? 7 : 1;

$pdo = qi_db();

try {
    if (!$pdo->query("SHOW TABLES LIKE 'trading_account_snapshots'")->fetch()) {
        echo json_encode(['status' => 'success', 'range' => $range, 'step_seconds' => $stepSeconds, 'accounts' => [], 'series' => [], 'notice' => 'MIGRATION_REQUIRED']);
        exit();
    }

    $accStmt = $pdo->prepare("SELECT id, provider, account_label, account_reference, connection_status, last_synced_at
                              FROM trading_accounts
                              WHERE user_id = :uid AND connection_status IN ('active', 'pending')
                              ORDER BY created_at DESC");
    $accStmt->execute([':uid' => $uid]);
    $accounts = $accStmt->fetchAll(PDO::FETCH_ASSOC);

    $requestedId = filter_var($_GET['account_id'] ?? null, FILTER_VALIDATE_INT);
    if ($requestedId) {
        $accounts = array_values(array_filter($accounts, fn($a) => (int)$a['id'] === (int)$requestedId));
    }
    if (!$accounts) {
        echo json_encode(['status' => 'success', 'range' => $range, 'step_seconds' => $stepSeconds, 'accounts' => [], 'series' => []]);
        exit();
    }

    $ids = array_map(fn($a) => (int)$a['id'], $accounts);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    // $stepSeconds dan $days sudah dibatasi ke nilai whitelist di atas, jadi aman
    // disisipkan langsung (LIMIT/INTERVAL tidak bisa menjadi parameter prepared di MySQL).
    $sql = "SELECT FLOOR(UNIX_TIMESTAMP(captured_at) / $stepSeconds) * $stepSeconds AS bucket_ts,
                   AVG(balance)       AS balance,
                   AVG(equity)        AS equity,
                   MAX(open_positions) AS open_positions
            FROM trading_account_snapshots
            WHERE trading_account_id IN ($placeholders)
              AND captured_at >= DATE_SUB(NOW(), INTERVAL $days DAY)
            GROUP BY bucket_ts
            ORDER BY bucket_ts ASC
            LIMIT 600";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($ids);

    $series = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $series[] = [
            'timestamp'      => date('Y-m-d H:i:s', (int)$row['bucket_ts']),
            'balance'        => round((float)$row['balance'], 2),
            'equity'         => round((float)$row['equity'], 2),
            'open_positions' => (int)$row['open_positions'],
        ];
    }

    $first = $series[0] ?? null;
    $last  = $series ? $series[count($series) - 1] : null;
    echo json_encode([
        'status'       => 'success',
        'server_now'   => date('Y-m-d H:i:s'),
        'range'        => $range,
        'step_seconds' => $stepSeconds,
        'accounts'     => $accounts,
        'series'       => $series,
        'summary'      => [
            'points'          => count($series),
            'balance_first'   => $first['balance'] ?? null,
            'balance_last'    => $last['balance'] ?? null,
            'equity_last'     => $last['equity'] ?? null,
            'balance_change'  => ($first && $last) ? round($last['balance'] - $first['balance'], 2) : null,
            'equity_change'   => ($first && $last) ? round($last['equity'] - $first['equity'], 2) : null,
            'last_timestamp'  => $last['timestamp'] ?? null,
        ],
    ]);
} catch (Exception $e) {
    qi_log('error', 'Balance history query failed', ['exception' => get_class($e)]);
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Riwayat saldo tidak dapat dimuat.']);
}
