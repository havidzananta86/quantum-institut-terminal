<?php
/**
 * Quantum Institut — Logout API
 * Menghapus token session aktif dari database user_sessions.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$token = null;

// Ambil token dari header Authorization: Bearer
$authHeader = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? '';
if (!$authHeader && function_exists('apache_request_headers')) {
    $hdrs = apache_request_headers();
    foreach ($hdrs as $k => $v) {
        if (strcasecmp($k, 'Authorization') === 0) { $authHeader = $v; break; }
    }
}
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
    $token = trim($matches[1]);
}

// Fallback: header custom X-QI-Token
if (!$token && isset($_SERVER['HTTP_X_QI_TOKEN'])) {
    $token = $_SERVER['HTTP_X_QI_TOKEN'];
}

if ($token) {
    try {
        $pdo = qi_db(false);
        if ($pdo) {
            $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE token = :t');
            $stmt->execute([':t' => hash('sha256', $token)]);
        }
    } catch (Exception $e) {
        error_log('[QI Logout] DB Delete error: ' . $e->getMessage());
    }
}

echo json_encode(['status' => 'success', 'message' => 'Logout berhasil. Sesi telah dihapus dari server.']);
