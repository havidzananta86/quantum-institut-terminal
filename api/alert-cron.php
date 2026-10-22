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

// PENYELESAIAN PAPER TRADING MANUAL (SL/TP, stop-out, akhir periode turnamen) untuk SEMUA pengguna —
// supaya stop loss tetap ditegakkan saat tidak ada satu pun halaman yang terbuka, dan posisi periode
// lalu ditutup tak lama setelah batas periode (api/_kompetisi_settle.php). Kegagalannya tidak boleh
// menjatuhkan pemeriksaan alert di atas.
try {
    require_once __DIR__ . '/_kompetisi_papan.php';   // memuat _kompetisi_settle.php + qi_komp_bekukan()
    $selesai = qi_paper_settle($pdo, null);
    // 'dibatalkan' = posisi periode lalu tanpa harga apa pun sebelum batas (72 jam) — dilaporkan, bukan disembunyikan.
    $hasil['paper_settle'] = ['diperiksa' => $selesai['diperiksa'], 'ditutup' => count($selesai['ditutup']),
                              'menunggu_harga' => count($selesai['menunggu_harga']), 'dibatalkan' => count($selesai['dibatalkan'] ?? [])];
} catch (Throwable $e) {
    error_log('[QI Alert Cron] paper settle gagal: ' . $e->getMessage());
    $hasil['paper_settle'] = ['galat' => true];
}

// DETAK: bukti putaran ini selesai, dibaca api/health.php (lihat api/_detak_cron.php).
try {
    require_once __DIR__ . '/_detak_cron.php';
    qi_cron_detak(array_intersect_key($hasil, array_flip(['diperiksa', 'terpicu', 'dikirim'])), 'alert');
} catch (Throwable $e) { error_log('[QI Alert Cron] detak gagal: ' . $e->getMessage()); }

echo json_encode(['status' => 'success', 'waktu' => date('c')] + $hasil, JSON_UNESCAPED_UNICODE) . (PHP_SAPI === 'cli' ? "\n" : '');
