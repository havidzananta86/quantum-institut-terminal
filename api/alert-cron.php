<?php
/**
 * CRON PRICE ALERT — memeriksa alert SEMUA pengguna saat tidak ada dashboard yang terbuka.
 *
 *   CLI : php api/alert-cron.php            (mis. tiap menit: * * * * *)
 *   HTTP: GET api/alert-cron.php?key=CRON_SECRET_KEY
 *
 * Aman dijalankan bersamaan dengan pemeriksaan dari dashboard: alert diklaim secara atomik.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_alerts.php';

if (PHP_SAPI !== 'cli') {
    $kunci = __DIR__ . '/../config/api_keys.php';
    if (is_file($kunci)) require_once $kunci;
    $rahasia = defined('CRON_SECRET_KEY') ? (string)CRON_SECRET_KEY : '';
    if ($rahasia === '' || !hash_equals($rahasia, (string)($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Kunci cron tidak sah.']);
        exit;
    }
}

$pdo = qi_db(false);
if (!$pdo) { echo json_encode(['status' => 'error', 'message' => 'Database tidak tersedia.']); exit(1); }
$hasil = qi_alert_periksa($pdo);

// DETAK: bukti putaran ini selesai, dibaca api/health.php (lihat api/_detak_cron.php).
try {
    require_once __DIR__ . '/_detak_cron.php';
    qi_cron_detak(array_intersect_key($hasil, array_flip(['diperiksa', 'terpicu', 'dikirim'])), 'alert');
} catch (Throwable $e) { error_log('[QI Alert Cron] detak gagal: ' . $e->getMessage()); }

echo json_encode(['status' => 'success', 'waktu' => date('c')] + $hasil, JSON_UNESCAPED_UNICODE) . (PHP_SAPI === 'cli' ? "\n" : '');
