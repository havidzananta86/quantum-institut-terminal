<?php
/** Personal risk guardrails. These settings do not execute or place trades. */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(20, 60);

$user = qi_require_auth();
$pdo = qi_db();
$uid = (int)$user['user_id'];

try {
    if (!$pdo->query("SHOW TABLES LIKE 'user_risk_profiles'")->fetch()) {
        http_response_code(503);
        echo json_encode(['status' => 'error', 'code' => 'MIGRATION_REQUIRED', 'message' => 'Modul risiko belum diaktifkan. Jalankan migrasi database terlebih dahulu.']);
        exit();
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('SELECT risk_per_trade_pct, max_daily_loss_pct, max_open_positions, updated_at FROM user_risk_profiles WHERE user_id = :uid');
        $stmt->execute([':uid' => $uid]);
        echo json_encode(['status' => 'success', 'risk_profile' => $stmt->fetch(PDO::FETCH_ASSOC) ?: ['risk_per_trade_pct' => 1.00, 'max_daily_loss_pct' => 3.00, 'max_open_positions' => 3]]);
        exit();
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); echo json_encode(['status' => 'error', 'message' => 'Method tidak diizinkan.']); exit();
    }
    $input = qi_get_json_body();
    $risk = filter_var($input['risk_per_trade_pct'] ?? null, FILTER_VALIDATE_FLOAT);
    $daily = filter_var($input['max_daily_loss_pct'] ?? null, FILTER_VALIDATE_FLOAT);
    $open = filter_var($input['max_open_positions'] ?? null, FILTER_VALIDATE_INT);
    if ($risk === false || $daily === false || $open === false || $risk < 0.10 || $risk > 5 || $daily < 0.50 || $daily > 20 || $open < 1 || $open > 20) {
        http_response_code(422); echo json_encode(['status' => 'error', 'message' => 'Batas risiko tidak valid.']); exit();
    }
    $stmt = $pdo->prepare('INSERT INTO user_risk_profiles (user_id, risk_per_trade_pct, max_daily_loss_pct, max_open_positions) VALUES (:uid, :risk, :daily, :open) ON DUPLICATE KEY UPDATE risk_per_trade_pct = VALUES(risk_per_trade_pct), max_daily_loss_pct = VALUES(max_daily_loss_pct), max_open_positions = VALUES(max_open_positions)');
    $stmt->execute([':uid' => $uid, ':risk' => $risk, ':daily' => $daily, ':open' => $open]);
    qi_log('info', 'Risk profile updated', ['user_id' => $uid]);
    echo json_encode(['status' => 'success', 'message' => 'Profil risiko disimpan.']);
} catch (Exception $e) {
    qi_log('error', 'Risk profile request failed', ['exception' => get_class($e)]);
    http_response_code(500); echo json_encode(['status' => 'error', 'message' => 'Profil risiko tidak dapat diproses.']);
}
