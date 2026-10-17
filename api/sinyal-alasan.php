<?php
/**
 * GET ?symbol=XAUUSD  → alasan sinyal TERBARU simbol itu ("Kenapa sinyal ini?")
 * GET ?id=SIG-...     → alasan satu sinyal tertentu
 *
 * Isi hanya dari bidang yang tersimpan di cache/signal_history.json (lihat api/_sinyal_alasan.php).
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_sinyal_alasan.php';
if (is_file(__DIR__ . '/_signal_time.php')) require_once __DIR__ . '/_signal_time.php';
qi_rate_limit(60, 60);
qi_require_auth();

$simbol = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['symbol'] ?? '')));
$id = preg_replace('/[^A-Za-z0-9_\-]/', '', (string)($_GET['id'] ?? ''));
if ($simbol === '' && $id === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Isi parameter symbol atau id.']);
    exit;
}

$berkas = __DIR__ . '/../cache/signal_history.json';
$riwayat = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
if (!is_array($riwayat)) $riwayat = [];

$pilih = null;
$tPilih = 0;
foreach ($riwayat as $r) {
    if (!is_array($r)) continue;
    if ($id !== '') { if ((string)($r['id'] ?? '') === $id) { $pilih = $r; break; } continue; }
    if (strtoupper((string)($r['symbol'] ?? '')) !== $simbol) continue;
    // Rekor lama (tanpa zona) dan baru (UTC "Z") dibaca dengan aturan yang sama: qi_sig_epoch().
    $t = function_exists('qi_sig_epoch') ? qi_sig_epoch($r['timestamp'] ?? null) : (strtotime((string)($r['timestamp'] ?? '')) ?: null);
    if ($t !== null && $t > $tPilih) { $tPilih = $t; $pilih = $r; }
}

if ($pilih === null) {
    echo json_encode(['status' => 'success', 'sinyal' => null]);
    exit;
}

echo json_encode([
    'status' => 'success',
    'sinyal' => [
        'id'     => (string)($pilih['id'] ?? ''),
        'symbol' => strtoupper((string)($pilih['symbol'] ?? '')),
        'arah'   => strtoupper((string)($pilih['side'] ?? '')),
        'mesin'  => (string)($pilih['engine_name'] ?? $pilih['engine'] ?? ''),
        'status' => (string)($pilih['status'] ?? ''),
        'waktu'  => (string)($pilih['timestamp'] ?? ''),
        'alasan' => qi_sinyal_alasan($pilih),
    ],
], JSON_UNESCAPED_UNICODE);
