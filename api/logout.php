<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit();

$token = null;
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!$authHeader && function_exists('apache_request_headers')) {
    $hdrs = apache_request_headers();
    foreach ($hdrs as $k => $v) {
        if (strcasecmp($k, 'Authorization') === 0) { $authHeader = $v; break; }
    }
}
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    $token = trim($m[1]);
}
if (!$token && isset($_SERVER['HTTP_X_QI_TOKEN'])) {
    $token = $_SERVER['HTTP_X_QI_TOKEN'];
}

if (!$token) {
    echo json_encode(['status' => 'success', 'message' => 'Logout berhasil.']);
    exit();
}

try {
    $pdo = qi_db(false);
    if ($pdo) {
        $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE token = :token');
        $stmt->execute([':token' => hash('sha256', $token)]);
    }
} catch (Exception $e) {
    // Non-fatal: session tetap expire secara alami
}

echo json_encode(['status' => 'success', 'message' => 'Logout berhasil. Sesi dihapus dari server.']);
