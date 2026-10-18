<?php
/**
 * Uji hitungan batas rugi harian (api/_batas_rugi.php): bagian murni tanpa DB.
 * Dijalankan oleh tests/profesional.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('America/New_York');
require __DIR__ . '/../api/_batas_rugi.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}

$awal = 1760000000;
echo "Batas rugi harian\n";
$s = qi_batas_rugi_hitung(3.0, 10000.0, 0.0, $awal);
cek('tanpa transaksi hari ini: batas $300, belum terpakai', $s['batas_usd'] === 300.0 && $s['rugi_hari'] === 0.0 && !$s['tercapai'] && !$s['peringatan'], $s);
$s = qi_batas_rugi_hitung(3.0, 9800.0, -200.0, $awal);
cek('rugi $200 dari saldo awal hari $10.000: 66,7% terpakai, belum tercapai', $s['saldo_awal_hari'] === 10000.0 && $s['terpakai_pct'] === 66.7 && !$s['tercapai'] && !$s['peringatan'], $s);
$s = qi_batas_rugi_hitung(3.0, 9750.0, -250.0, $awal);
cek('rugi $250: 83,3% → peringatan, belum terkunci, sisa $50', $s['peringatan'] && !$s['tercapai'] && $s['sisa_usd'] === 50.0, $s);
$s = qi_batas_rugi_hitung(3.0, 9700.0, -300.0, $awal);
cek('rugi tepat $300 = batas → terkunci', $s['tercapai'] && !$s['peringatan'] && $s['sisa_usd'] === 0.0, $s);
$s = qi_batas_rugi_hitung(3.0, 9500.0, -500.0, $awal);
cek('rugi melewati batas → terkunci, pemakaian bisa >100%', $s['tercapai'] && $s['terpakai_pct'] > 100, $s);
$s = qi_batas_rugi_hitung(3.0, 10500.0, 500.0, $awal);
cek('untung hari ini tidak mengunci dan tidak dihitung sebagai rugi', !$s['tercapai'] && $s['rugi_hari'] === 0.0 && $s['saldo_awal_hari'] === 10000.0, $s);
$s = qi_batas_rugi_hitung(1.0, 9900.0, -100.0, $awal);
cek('batas 1% (profil ketat): $100 langsung terkunci', $s['batas_usd'] === 100.0 && $s['tercapai'], $s);
$s = qi_batas_rugi_hitung(3.0, 9700.0, -700.0 + 400.0, $awal);
cek('dasar hitung = saldo AWAL hari (bukan saldo sekarang)', $s['saldo_awal_hari'] === 10000.0 && $s['batas_usd'] === 300.0, $s);
cek('reset tepat 24 jam setelah awal hari', $s['reset_pada'] === $awal + 86400);

echo "Pesan\n";
$p = qi_batas_rugi_pesan(qi_batas_rugi_hitung(3.0, 9700.0, -300.0, $awal));
cek('pesan memuat angka dan jam reset', str_contains($p, '$300.00') && str_contains($p, '3%') && str_contains($p, '00:00 WIB'), $p);

exit($gagal ? 1 : 0);
