<?php
/**
 * Status batas rugi harian akun simulasi pengguna (lihat api/_batas_rugi.php).
 * GET → { status, batas_rugi: {...} }
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);
$user = qi_require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Gunakan GET.']);
    exit();
}
require_once __DIR__ . '/_paper_math.php';
if (is_file(__DIR__ . '/_auto_paper.php')) require_once __DIR__ . '/_auto_paper.php';
require_once __DIR__ . '/_batas_rugi.php';

try {
    $s = qi_batas_rugi_status(qi_db(), (int)$user['user_id']);
    echo json_encode(['status' => 'success', 'batas_rugi' => $s, 'pesan' => $s['tercapai'] ? qi_batas_rugi_pesan($s) : null], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[batas-rugi] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Status batas rugi tidak dapat dihitung.']);
}
