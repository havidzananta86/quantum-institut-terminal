<?php
/** Read-only account and paper-trading performance summary for the signed-in user. */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$user = qi_require_auth();
$pdo = qi_db();
$uid = (int)$user['user_id'];

try {
    $tables = $pdo->query("SHOW TABLES LIKE 'trading_accounts'")->fetchAll();
    if (!$tables) {
        http_response_code(503);
        echo json_encode(['status' => 'error', 'code' => 'MIGRATION_REQUIRED', 'message' => 'Modul analitik belum diaktifkan. Jalankan migrasi database terlebih dahulu.']);
        exit();
    }

    // Info bridge dipakai kartu "Akun Trading" untuk membedakan akun yang sudah
    // punya Bridge Key (pending, menunggu snapshot EA) dari akun yang belum terdaftar.
    // Tabel bridge bisa belum ada bila migrasi 004 belum dijalankan.
    $hasBridgeTable = (bool)$pdo->query("SHOW TABLES LIKE 'trading_account_bridge_keys'")->fetch();
    $bridgeJoin = $hasBridgeTable ? ' LEFT JOIN trading_account_bridge_keys k ON k.trading_account_id = a.id' : '';
    $bridgeColumns = $hasBridgeTable
        ? ', k.created_at AS bridge_key_created_at, k.last_used_at AS bridge_last_used_at, k.last_ip AS bridge_last_ip'
        : ', NULL AS bridge_key_created_at, NULL AS bridge_last_used_at, NULL AS bridge_last_ip';
    // Kolom berbagi posisi hanya ada setelah migrasi 006.
    $hasShareColumn = (bool)$pdo->query("SHOW COLUMNS FROM trading_accounts LIKE 'share_positions'")->fetch();
    $shareColumn = $hasShareColumn ? ', a.share_positions' : ', 1 AS share_positions';

    $accounts = $pdo->prepare(
        'SELECT a.id, a.provider, a.account_label, a.account_reference, a.connection_status, a.last_synced_at,
                s.balance, s.equity, s.margin_used, s.open_positions, s.captured_at' . $bridgeColumns . $shareColumn . '
         FROM trading_accounts a' . $bridgeJoin . '
         LEFT JOIN trading_account_snapshots s ON s.id = (
             SELECT s2.id FROM trading_account_snapshots s2
             WHERE s2.trading_account_id = a.id ORDER BY s2.captured_at DESC, s2.id DESC LIMIT 1
         )
         WHERE a.user_id = :uid ORDER BY a.created_at DESC'
    );
    $accounts->execute([':uid' => $uid]);

    $paper = $pdo->prepare(
        "SELECT
            COUNT(*) AS total_trades,
            SUM(status = 'open') AS open_positions,
            SUM(status = 'closed') AS closed_trades,
            SUM(CASE WHEN status = 'closed' AND pnl_usd > 0 THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN status = 'closed' AND pnl_usd < 0 THEN 1 ELSE 0 END) AS losses,
            COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl_usd ELSE 0 END), 0) AS net_pnl_usd,
            COALESCE(SUM(CASE WHEN status = 'closed' AND pnl_usd > 0 THEN pnl_usd ELSE 0 END), 0) AS gross_profit,
            COALESCE(ABS(SUM(CASE WHEN status = 'closed' AND pnl_usd < 0 THEN pnl_usd ELSE 0 END)), 0) AS gross_loss
         FROM paper_positions WHERE user_id = :uid"
    );
    $paper->execute([':uid' => $uid]);
    $metrics = $paper->fetch(PDO::FETCH_ASSOC) ?: [];
    $completed = (int)($metrics['closed_trades'] ?? 0);
    $wins = (int)($metrics['wins'] ?? 0);
    $grossLoss = (float)($metrics['gross_loss'] ?? 0);
    $metrics['win_rate_pct'] = $completed ? round($wins / $completed * 100, 1) : null;
    $metrics['profit_factor'] = $grossLoss > 0 ? round((float)$metrics['gross_profit'] / $grossLoss, 2) : null;
    $metrics['data_scope'] = 'paper_trading';

    $risk = $pdo->prepare('SELECT risk_per_trade_pct, max_daily_loss_pct, max_open_positions, updated_at FROM user_risk_profiles WHERE user_id = :uid');
    $risk->execute([':uid' => $uid]);
    $riskProfile = $risk->fetch(PDO::FETCH_ASSOC) ?: ['risk_per_trade_pct' => 1.00, 'max_daily_loss_pct' => 3.00, 'max_open_positions' => 3, 'updated_at' => null];

    // Jam database dikirim bersama data agar antarmuka bisa menghitung "x menit lalu"
    // dari dua nilai yang sama-sama berasal dari server. Tanpa ini, timestamp MySQL
    // (bisa UTC) akan ditafsirkan sebagai waktu lokal browser dan selisihnya meleset.
    $serverNow = $pdo->query('SELECT NOW() AS server_now')->fetch(PDO::FETCH_ASSOC);

    echo json_encode(['status' => 'success', 'server_now' => $serverNow['server_now'] ?? null, 'accounts' => $accounts->fetchAll(PDO::FETCH_ASSOC), 'paper_performance' => $metrics, 'risk_profile' => $riskProfile]);
} catch (Exception $e) {
    qi_log('error', 'Account analytics query failed', ['exception' => get_class($e)]);
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Analitik akun tidak dapat dimuat.']);
}
