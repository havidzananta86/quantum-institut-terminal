<?php
/**
 * GET — ringkasan laporan CSP untuk admin (kartu "Laporan CSP" di admin.html).
 * ?hari=1..31 (bawaan 7), ?disposisi=report|enforce|semua (bawaan report = CSP ketat Report-Only).
 * Grup kosong untuk 'report' selama beberapa hari = CSP ketat aman ditegakkan.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_csp_ringkasan.php';
qi_rate_limit(30, 60);

qi_require_admin();

$hari = (int)($_GET['hari'] ?? 7);
$disposisi = (string)($_GET['disposisi'] ?? 'report');
echo json_encode(['status' => 'success'] + qi_csp_ringkasan(__DIR__ . '/../cache/csp-reports', $hari, $disposisi),
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
