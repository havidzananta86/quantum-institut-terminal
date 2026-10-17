<?php
/**
 * STATUS BLACKOUT BERITA untuk banner dashboard.
 *
 * `blackout` memakai qi_berita_blackout(30) — ATURAN YANG SAMA dengan yang menahan sinyal di
 * signal-generator.php / ai-signal.php, jadi banner tidak pernah berbeda pendapat dengan mesin.
 * `mendatang` = berita berdampak tinggi dalam 120 menit ke depan (dari cache kalender yang sama,
 * dengan penyaring event contoh qi_kalender_event_sah), untuk peringatan dini.
 * Bila cache kalender basi/tidak ada, `catatan` mengatakannya apa adanya.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);
qi_require_auth();

$blackout = qi_berita_blackout(30, true);

$mendatang = [];
$f = __DIR__ . '/../cache/calendar.json';
$umur = is_file($f) ? time() - (int)@filemtime($f) : null;
if ($umur !== null && $umur <= 3600) {
    $j = json_decode((string)@file_get_contents($f), true);
    $daftar = is_array($j) ? ($j['data'] ?? $j['events'] ?? []) : [];
    foreach ((array)$daftar as $e) {
        if (!is_array($e) || strtolower((string)($e['impact'] ?? '')) !== 'high') continue;
        if (function_exists('qi_kalender_event_sah') && !qi_kalender_event_sah($e)) continue;
        $t = strtotime((string)($e['date'] ?? ''));
        if ($t === false || $t < time() - 30 * 60 || $t > time() + 120 * 60) continue;
        $mendatang[] = [
            'judul'     => (string)($e['title'] ?? '-'),
            'mata_uang' => (string)($e['currency'] ?? ($e['country'] ?? '-')),
            'epoch'     => $t,
            'perkiraan' => isset($e['forecast']) ? (string)$e['forecast'] : null,
            'sebelumnya'=> isset($e['previous']) ? (string)$e['previous'] : null,
        ];
    }
    usort($mendatang, static fn($a, $b) => $a['epoch'] <=> $b['epoch']);
}

echo json_encode([
    'status'     => 'success',
    'sekarang'   => time(),
    'jendela'    => 30,
    'blackout'   => $blackout,
    'mendatang'  => array_slice($mendatang, 0, 5),
    'umur_cache' => $umur,
    'catatan'    => $umur === null ? 'Kalender ekonomi belum tersedia — blackout berita tidak dapat dinilai.'
                  : ($umur > 3600 ? 'Kalender ekonomi basi (' . (int)round($umur / 60) . ' menit) — blackout berita tidak dapat dinilai.' : ''),
], JSON_UNESCAPED_UNICODE);
