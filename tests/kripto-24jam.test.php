<?php
/**
 * Uji regresi: kripto 24/7 saat OANDA/broker MT5 tutup akhir pekan.
 *  - qi_candle_kripto_basi (api/_middleware.php): kapan candle kripto dianggap beku;
 *  - qi_sig_ambil_candle (api/signal-evaluator.php): penilai memilih candle TERBARU (bukan berkas
 *    terbaru) — dulu cache MT5 yang beku menang atas Binance sehingga sinyal BTC Jumat tak dinilai.
 * Memakai simbol rekaan ZZUJIUSDT di cache/chart dan menghapusnya lagi.
 * Dijalankan oleh tests/kripto-24jam.test.js:  php tests/kripto-24jam.test.php
 */
define('QI_SIGNAL_EVAL_LIB', true);
require __DIR__ . '/../api/_middleware.php';
require __DIR__ . '/../api/signal-evaluator.php';

$gagal = 0;
function cek(string $nama, bool $lulus): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . "\n";
    if (!$lulus) $gagal++;
}
$batang = fn(int $akhir, int $langkah, int $n = 10): array => array_map(
    fn($i) => ['time' => $akhir - ($n - 1 - $i) * $langkah, 'open' => 100, 'high' => 101, 'low' => 99, 'close' => 100],
    range(0, $n - 1));
$kini = 1792280000;   // Sabtu malam UTC

echo "Deteksi candle kripto beku\n";
cek('BTC H1 terakhir 26 jam lalu → beku', qi_candle_kripto_basi('BTCUSDT', '60', $batang($kini - 26 * 3600, 3600), $kini));
cek('BTC H1 terakhir 30 menit lalu → segar', !qi_candle_kripto_basi('BTCUSDT', '60', $batang($kini - 1800, 3600), $kini));
cek('BTC D1 batang hari ini → segar', !qi_candle_kripto_basi('BTCUSDT', 'D', $batang($kini - 20 * 3600, 86400), $kini));
cek('BTC W1 batang minggu ini → segar', !qi_candle_kripto_basi('BTCUSDT', 'W', $batang($kini - 5 * 86400, 604800), $kini));
cek('XAUUSD (bukan kripto) tidak pernah "beku" — pasarnya memang tutup', !qi_candle_kripto_basi('XAUUSD', '60', $batang($kini - 26 * 3600, 3600), $kini));
cek('daftar candle kosong → bukan beku', !qi_candle_kripto_basi('BTCUSDT', '60', [], $kini));

echo "Penilai sinyal memilih candle terbaru\n";
$dir = __DIR__ . '/../cache/chart';
if (!is_dir($dir)) @mkdir($dir, 0755, true);
$sim = 'ZZUJIUSDT';
$fUmum = $dir . '/' . md5($sim . '_5') . '.json';
$fMt5  = $dir . '/' . md5($sim . '_5_mt5') . '.json';
$tulis = function (string $f, array $c, string $src): void {
    file_put_contents($f, json_encode(['status' => 'success', 'simulated' => false, 'source' => $src, 'candles' => $c]));
};
try {
    $sekarang = time();
    $tulis($fUmum, $batang($sekarang - 300, 300), 'binance');
    $tulis($fMt5, $batang($sekarang - 26 * 3600, 300), 'mt5');   // berkas lebih baru, isi beku
    touch($fUmum, $sekarang - 120); touch($fMt5, $sekarang);
    $d = qi_sig_ambil_candle($sim, ['5']);
    cek('MT5 beku (berkas lebih baru) kalah dari Binance yang segar', $d !== null && $d['source'] === 'binance');

    $tulis($fMt5, $batang($sekarang - 300, 300), 'mt5');
    $d = qi_sig_ambil_candle($sim, ['5']);
    cek('MT5 segar tetap diutamakan (sinyal otomatis dibuat dari harga broker)', $d !== null && $d['source'] === 'mt5');

    $tulis($fMt5, $batang($sekarang - 600, 300), 'mt5');   // tertinggal tepat 1 batang: masih wajar
    $d = qi_sig_ambil_candle($sim, ['5']);
    cek('MT5 tertinggal ≤1 batang tetap dipakai', $d !== null && $d['source'] === 'mt5');

    @unlink($fUmum);
    $d = qi_sig_ambil_candle($sim, ['5']);
    cek('hanya ada cache MT5 → dipakai', $d !== null && $d['source'] === 'mt5');
    cek('kunci internal "akhir" tidak bocor ke pemanggil', $d !== null && !array_key_exists('akhir', $d));
} finally {
    @unlink($fUmum); @unlink($fMt5);
}

echo $gagal ? "\nFAIL — $gagal\n" : "\nPASS — kripto 24/7: candle beku dikenali, penilai memakai data terbaru\n";
exit($gagal ? 1 : 0);
