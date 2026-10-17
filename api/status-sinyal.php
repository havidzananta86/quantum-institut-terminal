<?php
/**
 * STATUS SINYAL TERAKHIR per simbol — untuk bilah status bawah dashboard.
 *
 * GET ?symbol=BTCUSDT → sinyal terbaru simbol itu (arah, level, status rekor) beserta
 * waktu terbit & kedaluwarsa dalam epoch Unix.
 *
 * MENGAPA epoch dihitung di server: rekor baru ditulis ISO 8601 UTC, tetapi rekor lama
 * ditulis date() tanpa zona. qi_sig_epoch()/qi_sig_jendela() (api/_signal_time.php)
 * membaca keduanya dengan aturan yang SAMA dengan api/signal-evaluator.php, jadi peramban
 * dapat membandingkannya langsung dengan waktu candle (epoch UTC) tanpa menebak zona waktu.
 * Status "entry tersentuh" dihitung di peramban dari candle chart, dan hanya untuk
 * jendela terbit → kedaluwarsa (aturan yang sama dengan penilai).
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_signal_time.php';
qi_rate_limit(60, 60);
qi_require_auth();

$simbol = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['symbol'] ?? '')));
if ($simbol === '' || strlen($simbol) > 12) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Parameter symbol wajib diisi.']);
    exit;
}

$berkas = __DIR__ . '/../cache/signal_history.json';
$riwayat = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
if (!is_array($riwayat)) $riwayat = [];

$terbaru = null;
$tTerbaru = 0;
foreach ($riwayat as $r) {
    if (!is_array($r) || strtoupper((string)($r['symbol'] ?? '')) !== $simbol) continue;
    $t = qi_sig_epoch($r['timestamp'] ?? null);
    if ($t !== null && $t > $tTerbaru) { $tTerbaru = $t; $terbaru = $r; }
}

if ($terbaru === null) {
    echo json_encode(['status' => 'success', 'symbol' => $simbol, 'sinyal' => null, 'sekarang' => time()]);
    exit;
}

$tExp = qi_sig_jendela($terbaru)['kedaluwarsa'];   // cadangan terbit + 4 jam, sama dengan penilai
$tTutup = qi_sig_epoch($terbaru['closed_at'] ?? null, 'closed_at');   // closed_at lama = UTC

echo json_encode([
    'status'   => 'success',
    'symbol'   => $simbol,
    'sekarang' => time(),
    'sinyal'   => [
        'id'          => (string)($terbaru['id'] ?? ''),
        'arah'        => strtoupper((string)($terbaru['side'] ?? '')),
        'entry'       => is_numeric($terbaru['entry'] ?? null) ? (float)$terbaru['entry'] : null,
        'tp'          => is_numeric($terbaru['tp'] ?? null) ? (float)$terbaru['tp'] : null,
        'sl'          => is_numeric($terbaru['sl'] ?? null) ? (float)$terbaru['sl'] : null,
        'status'      => (string)($terbaru['status'] ?? ''),
        'mesin'       => (string)($terbaru['engine_name'] ?? $terbaru['engine'] ?? ''),
        'terbit'      => $tTerbaru,
        'kedaluwarsa' => $tExp,
        'ditutup'     => $tTutup ?: null,
    ],
], JSON_UNESCAPED_UNICODE);
