<?php
/**
 * Halaman Transparansi jujur tentang pemindai Pine (audit sinyal 2026-10-22): pemindai hanya
 * berjalan dari cron pemeliharaan; tanpa cron daftar Pine tidak bertambah, padahal halaman dulu
 * menulis "Dicatat otomatis" tanpa umur pemindai. Murni. Dijalankan tests/transparansi-jujur.test.js.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_transparansi.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$kini = 1792500000;

echo "Status pemindai Pine\n";
$s = qi_tr_status_pemindai(null, 'belum_pernah', $kini);
cek('belum pernah berjalan + cron belum terpasang → dikatakan terus terang', $s['status'] === 'belum_pernah' && $s['terakhir'] === null && str_contains($s['kalimat'], 'belum pernah berjalan') && str_contains($s['kalimat'], 'belum terpasang'), $s);
$s = qi_tr_status_pemindai(null, 'ok', $kini);
cek('cron jalan tetapi pemindai belum pernah → tidak menyalahkan cron yang tidak terpasang', $s['status'] === 'belum_pernah' && !str_contains($s['kalimat'], 'belum terpasang'), $s);
$s = qi_tr_status_pemindai($kini - 600, 'ok', $kini);
cek('10 menit lalu → ok, umur dilaporkan', $s['status'] === 'ok' && $s['umur_detik'] === 600 && str_contains($s['kalimat'], '10 menit'), $s);
$s = qi_tr_status_pemindai($kini - 3 * 86400, 'basi', $kini);
cek('3 hari lalu → basi, kalimat memperingatkan daftar tertinggal', $s['status'] === 'basi' && str_contains($s['kalimat'], '3 hari') && str_contains($s['kalimat'], 'tertinggal'), $s);
cek('waktu terakhir dalam ISO UTC', $s['terakhir'] === gmdate('Y-m-d\TH:i:s\Z', $kini - 3 * 86400), $s['terakhir']);
$s = qi_transparansi_pemindai(sys_get_temp_dir() . '/tidak-ada-' . bin2hex(random_bytes(4)) . '.txt', $kini);
cek('berkas penanda tidak ada → belum_pernah (tanpa galat)', $s['status'] === 'belum_pernah', $s);

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
