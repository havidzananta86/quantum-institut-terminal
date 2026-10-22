<?php
/**
 * Mesin server (api/_engine_server.php) — audit sinyal 2026-10-22:
 *   · nilai HARIAN (EMA200, MACD, level bulanan/52 minggu/VWAP) dinormalkan dengan ATR HARIAN,
 *     bukan 'ATR|60' (H1 ≈ 1/4–1/5 ATR harian): dulu pullback EMA200 hampir selalu NETRAL,
 *     skor MACD jenuh 100, SNR nyaris tak pernah aktif;
 *   · tanpa ATR harian mesin itu "tidak tersedia" — tidak diam-diam memakai ATR H1;
 *   · jam sesi New York dalam WIB eksplisit, tidak bergantung zona php.ini.
 * Murni (tanpa jaringan). Dijalankan oleh tests/mesin-server-atr.test.js.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_engine_server.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}

// Emas: ATR harian 30, ATR H1 7 (≈ 1/4). Harga 2018 di atas EMA200 harian 2000 → jarak 18
// = 0,6× ATR harian (pullback) tetapi 2,6× ATR H1 (dulu: "belum pullback").
$c = ['close' => 2018.0, 'EMA200' => 2000.0, 'EMA20' => 2015.0, 'EMA50' => 2010.0, 'ADX' => 30.0,
      'ATR' => 30.0, 'ATR|60' => 7.0, 'MACD.macd' => 4.0, 'MACD.signal' => 1.0,
      'High.1M' => 2060.0, 'Low.1M' => 1950.0, 'High.3M' => 2100.0, 'Low.3M' => 1900.0,
      'price_52_week_high' => 2200.0, 'price_52_week_low' => 1800.0, 'Pivot.M.Classic.Middle' => 2030.0, 'VWAP' => 2011.0,
      'Recommend.All|60' => 0.3, 'Mom|60' => 2.0, 'AO' => 1.0];

echo "EMA200 pullback\n";
$m = qi_eng_ema200($c);
cek('jarak 18 = 0,6× ATR HARIAN → pullback, arah BUY (dulu NETRAL karena dibagi ATR H1)', $m['tersedia'] && $m['arah'] === 'BUY', $m);
cek('dasar menyebut satuan ATR harian dengan angka yang benar (0,6×)', str_contains($m['dasar'], '0.6× ATR harian'), $m['dasar']);
$tanpaHarian = $c; unset($tanpaHarian['ATR']);
$m = qi_eng_ema200($tanpaHarian);
cek('tanpa ATR harian → tidak tersedia (TIDAK jatuh ke ATR|60)', $m['tersedia'] === false, $m);

echo "MACD momentum\n";
$m = qi_eng_macd($c);
cek('histogram 3 = 0,1× ATR harian → skor 25 (dulu 3/7×250 = jenuh 100)', $m['arah'] === 'BUY' && abs((float)$m['skor'] - 25.0) < 1e-9, $m);
$m = qi_eng_macd($tanpaHarian);
cek('tanpa ATR harian → skor netral 50, dasar mengatakannya', abs((float)$m['skor'] - 50.0) < 1e-9 && str_contains($m['dasar'], 'ATR harian tidak tersedia'), $m);

echo "SNR\n";
$m = qi_eng_snr($c);
cek('VWAP 2011 berjarak 7 = 0,23× ATR harian → dekat level (dulu 1× ATR H1 → "jauh")', $m['tersedia'] && $m['arah'] === 'BUY' && str_contains($m['dasar'], '× ATR harian'), $m);
$m = qi_eng_snr($tanpaHarian);
cek('tanpa ATR harian → tidak tersedia', $m['tersedia'] === false, $m);

echo "Jam sesi New York (WIB eksplisit)\n";
$utc = fn(string $s): int => (new DateTimeImmutable($s, new DateTimeZone('UTC')))->getTimestamp();
cek('13:30 UTC = 20 WIB', qi_eng_jam_wib($utc('2026-10-20 13:30')) === 20);
cek('18:59 UTC = 01 WIB (masih sesi NY)', qi_eng_jam_wib($utc('2026-10-20 18:59')) === 1);
cek('03:00 UTC = 10 WIB', qi_eng_jam_wib($utc('2026-10-20 03:00')) === 10);
cek('hasil tidak bergantung zona php.ini (' . date_default_timezone_get() . ')', qi_eng_jam_wib($utc('2026-10-20 13:30')) === 20);
$m = qi_eng_momentum_ny($c, qi_eng_jam_wib($utc('2026-10-20 14:00')));
cek('MomentumNY pada 14:00 UTC (21 WIB) → "sesi New York AKTIF"', str_contains($m['dasar'], 'sesi New York AKTIF'), $m['dasar']);
$m = qi_eng_momentum_ny($c, qi_eng_jam_wib($utc('2026-10-20 06:00')));
cek('MomentumNY pada 06:00 UTC (13 WIB) → di luar sesi', str_contains($m['dasar'], 'di luar sesi New York'), $m['dasar']);

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
