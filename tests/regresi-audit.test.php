<?php
/**
 * Uji fungsi murni untuk perbaikan audit 2026-10-20 — tanpa jaringan dan tanpa DB.
 * Dijalankan oleh tests/regresi-audit.test.js:  php tests/regresi-audit.test.php
 *
 *  1. qi_news_angka()      — tanda minus pada angka bersufiks K/M/B/T wajib ikut terbaca.
 *  2. qi_paper_pip_mult()  — pair berbasis USD dikonversi pada harga, bukan konvensi lama 1000.
 */
require __DIR__ . '/../api/_news_signal.php';
require __DIR__ . '/../api/_paper_math.php';

$gagal = 0;
function cek(string $nama, bool $lulus): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . "\n";
    if (!$lulus) $gagal++;
}

echo "Angka kalender ekonomi (qi_news_angka)\n";
// Inti perbaikan: sebelumnya regex sufiks tidak punya `-?`, jadi "-175K" terbaca +175000
// dan ARAH sinyal NEWS bisa terbalik pada rilis yang memang negatif.
cek('"-175K" = -175000', qi_news_angka('-175K') === -175000.0);
cek('"175K" = 175000', qi_news_angka('175K') === 175000.0);
cek('"-78.2B" = -78200000000', qi_news_angka('-78.2B') === -78200000000.0);
cek('"-1.2M" = -1200000', qi_news_angka('-1.2M') === -1200000.0);
cek('"-2.5T" = -2500000000000', qi_news_angka('-2.5T') === -2500000000000.0);
cek('"-0.3%" tetap -0.3 (tanpa sufiks)', qi_news_angka('-0.3%') === -0.3);
cek('"0.3%" tetap 0.3', qi_news_angka('0.3%') === 0.3);
cek('"-" dianggap kosong', qi_news_angka('-') === null);
cek('"N/A" dianggap kosong', qi_news_angka('N/A') === null);
cek('"" dianggap kosong', qi_news_angka('') === null);

// Arah fundamental harus ikut benar: forecast JAUH lebih buruk dari previous = mata uang melemah.
if (function_exists('qi_news_arah_fundamental')) {
    $negatif = qi_news_angka('-175K');
    $positif = qi_news_angka('175K');
    cek('nilai negatif benar-benar lebih kecil dari yang positif', $negatif !== null && $positif !== null && $negatif < $positif);
}

echo "\nNilai kontrak per lot (qi_paper_pip_mult)\n";
// USDJPY: 1 lot = 100.000 unit USD, dikonversi ke USD pada harga berjalan.
$usdjpy = qi_paper_pip_mult('USDJPY', 150.0);
cek('USDJPY pada 150 = 100000/150', abs($usdjpy - (100000.0 / 150.0)) < 1e-9);
cek('USDJPY pada 150 BUKAN konvensi lama 1000', abs($usdjpy - 1000.0) > 1.0);
cek('USDCHF pada 0.88 = 100000/0.88', abs(qi_paper_pip_mult('USDCHF', 0.88) - (100000.0 / 0.88)) < 1e-9);
cek('USDCAD pada 1.37 = 100000/1.37', abs(qi_paper_pip_mult('USDCAD', 1.37) - (100000.0 / 1.37)) < 1e-9);
cek('EURUSD tetap 100000 (harga tidak dipakai)', qi_paper_pip_mult('EURUSD', 1.08) === 100000.0);
cek('XAUUSD tetap 100', qi_paper_pip_mult('XAUUSD', 2650.0) === 100.0);
cek('BTCUSDT tetap 1', qi_paper_pip_mult('BTCUSDT', 81000.0) === 1.0);

// Selisih nyata yang diperbaiki: P/L dolar USDJPY dulu ~50% terlalu besar.
$selisih = 0.50;                       // 50 pip gerak USDJPY
$benar   = $selisih * $usdjpy;
$lama    = $selisih * 1000.0;
cek('P/L USDJPY lama ~50% lebih besar dari yang benar', $lama > $benar * 1.4 && $lama < $benar * 1.6);

echo $gagal ? "\n$gagal uji GAGAL\n" : "\nSemua lulus\n";
exit($gagal ? 1 : 0);
