<?php
/**
 * Uji api/_sinyal_pasar.php (audit sinyal 2026-10-22):
 *   · RSI Wilder atas SELURUH riwayat: datar → 50, tren turun lalu 30 bar datar → 0 (dulu 100);
 *   · bar ber-rentang nol dibuang;
 *   · penjaga pasar tutup (Minggu 22:00 – Jumat 21:00 UTC, candle > 2 batang);
 *   · pemeriksaan entry terhadap harga pasar (reproduksi audit: BUY 2650 saat pasar 2700);
 *   · arah mtf_aligned sinyal berita.
 * Mencetak "RSI_JSON <json>" untuk uji paritas JavaScript di tests/sinyal-pasar.test.js.
 * Murni: tanpa jaringan/DB.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_sinyal_pasar.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$dekat = fn($a, $b, float $eps = 1e-9): bool => is_numeric($a) && abs((float)$a - (float)$b) < $eps;

echo "RSI Wilder atas seluruh riwayat\n";
$turun = []; for ($i = 0; $i < 60; $i++) $turun[] = 200.0 - $i;          // 60 close turun
$turunDatar = array_merge($turun, array_fill(0, 30, 141.0));             // lalu 30 close datar (akhir pekan)
cek('reproduksi audit: tren turun + 30 close datar → RSI 0 (dulu 100 dari 30 close terakhir)', $dekat(qi_sp_rsi($turunDatar), 0.0), qi_sp_rsi($turunDatar));
cek('hanya 30 close terakhir (semuanya datar) → 50: tren turun sebelumnya hilang — karena itu dihitung atas SELURUH riwayat', $dekat(qi_sp_rsi(array_slice($turunDatar, -30)), 50.0), qi_sp_rsi(array_slice($turunDatar, -30)));
cek('seluruhnya datar → 50 (bukan 100)', $dekat(qi_sp_rsi(array_fill(0, 40, 5.0)), 50.0));
$naik = []; for ($i = 0; $i < 40; $i++) $naik[] = 10.0 + $i;
cek('hanya naik → 100', $dekat(qi_sp_rsi($naik), 100.0));
cek('data < 15 close → 50 (belum ada informasi)', $dekat(qi_sp_rsi([1, 2, 3, 4, 5]), 50.0));
// Hitung tangan: 15 close, 14 perubahan pertama = +1 ×7, −1 ×7 → rata naik = rata turun = 0,5 → RSI 50.
$zigzag = [10.0]; for ($i = 1; $i <= 14; $i++) $zigzag[] = $zigzag[$i - 1] + ($i % 2 ? 1 : -1);
cek('seed SMA 14: naik 7×1 & turun 7×1 → 50', $dekat(qi_sp_rsi($zigzag), 50.0), qi_sp_rsi($zigzag));
// Satu langkah Wilder sesudah seed: +2 → naik = (0,5×13 + 2)/14, turun = 0,5×13/14.
$satu = array_merge($zigzag, [$zigzag[14] + 2]);
$g = (0.5 * 13 + 2) / 14; $l = (0.5 * 13) / 14;
cek('satu langkah Wilder dihitung tangan', $dekat(qi_sp_rsi($satu), 100 - 100 / (1 + $g / $l)), qi_sp_rsi($satu));

echo "Bar ber-rentang nol dibuang\n";
$bar = fn(float $o, float $h, float $l, float $c, int $t = 0) => ['time' => $t, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $c];
$nyata = []; foreach ($turun as $i => $cl) $nyata[] = $bar($cl + 0.5, $cl + 1, $cl - 1, $cl, $i);
$denganBeku = array_merge($nyata, array_map(fn($i) => $bar(141.0, 141.0, 141.0, 141.0, 100 + $i), range(0, 29)));
cek('30 bar beku (O=H=L=C) tidak ikut: RSI sama dengan tanpa bar beku', $dekat(qi_sp_rsi_candles($denganBeku), qi_sp_rsi_candles($nyata)));
cek('bar beku dibuang, bar bergerak dipertahankan', count(qi_sp_buang_datar($denganBeku)) === 60);
cek('bar datar tapi ber-rentang (high ≠ low) TIDAK dibuang', count(qi_sp_buang_datar([$bar(1, 2, 0.5, 1)])) === 1);

echo "Penjaga pasar tutup\n";
$utc = fn(string $s): int => (new DateTimeImmutable($s, new DateTimeZone('UTC')))->getTimestamp();
$candleTerakhir = fn(int $t) => [['time' => $t - 900, 'open' => 1, 'high' => 2, 'low' => 0.5, 'close' => 1], ['time' => $t, 'open' => 1, 'high' => 2, 'low' => 0.5, 'close' => 1]];
$sabtu = $utc('2026-10-24 10:00');   // Sabtu
$h = qi_sp_cek_pasar('XAUUSD', $candleTerakhir($sabtu - 300), 900, $sabtu);
cek('XAUUSD hari Sabtu → pasar_tutup (walau candle tampak segar)', !$h['boleh'] && $h['alasan'] === 'pasar_tutup', $h);
cek('BTCUSDT hari Sabtu dengan candle segar → boleh (24/7)', qi_sp_cek_pasar('BTCUSDT', $candleTerakhir($sabtu - 300), 900, $sabtu)['boleh']);
$h = qi_sp_cek_pasar('BTCUSDT', $candleTerakhir($sabtu - 3 * 3600), 900, $sabtu);
cek('BTCUSDT candle 3 jam lalu (> 2 batang M15) → data_basi', !$h['boleh'] && $h['alasan'] === 'data_basi', $h);
$jumat = $utc('2026-10-23 20:59');
cek('Jumat 20:59 UTC → buka', qi_sp_jendela_pekan($jumat) && qi_sp_cek_pasar('EURUSD', $candleTerakhir($jumat - 60), 900, $jumat)['boleh']);
cek('Jumat 21:00 UTC → tutup', !qi_sp_jendela_pekan($utc('2026-10-23 21:00')));
cek('Minggu 21:59 UTC → tutup', !qi_sp_jendela_pekan($utc('2026-10-25 21:59')));
cek('Minggu 22:00 UTC → buka', qi_sp_jendela_pekan($utc('2026-10-25 22:00')));
cek('Selasa → buka', qi_sp_jendela_pekan($utc('2026-10-20 03:00')));
$selasa = $utc('2026-10-20 10:00');
$h = qi_sp_cek_pasar('GBPUSD', $candleTerakhir($selasa - 2 * 3600), 900, $selasa);
cek('GBPUSD hari kerja tetapi candle terakhir 2 jam lalu (> 2 batang) → pasar_tutup (feed berhenti)', !$h['boleh'] && $h['alasan'] === 'pasar_tutup', $h);
cek('tanpa candle → tanpa_data', qi_sp_cek_pasar('XAUUSD', [], 900, $selasa)['alasan'] === 'tanpa_data');
cek('tidak bergantung zona php.ini', date_default_timezone_get() !== '' && qi_sp_jendela_pekan($utc('2026-10-23 20:59')) === true);

echo "Entry diperiksa terhadap harga pasar\n";
$j = qi_sp_jangkar_entry('BUY', 2650, 2680, 2630, 2700, 8.0);
cek('reproduksi audit: BUY 2650 / TP 2680 / SL 2630 saat pasar 2700 → DITOLAK (harga sudah lewat TP)', !$j['ok'] && $j['alasan'] === 'entry_jauh_dari_harga', $j);
$j = qi_sp_jangkar_entry('BUY', 2650, 2680, 2630, 2600, 8.0);
cek('cermin: pasar 2600 sudah di bawah SL → DITOLAK (bukan rugi instan)', !$j['ok'] && $j['alasan'] === 'entry_jauh_dari_harga', $j);
$j = qi_sp_jangkar_entry('BUY', 2650, 2680, 2630, 2660, 8.0);
cek('entry 1,25×ATR dari pasar (masih di antara SL–TP) → digeser ke 2660', $j['ok'] && $j['disesuaikan'] && $dekat($j['entry'], 2660.0), $j);
cek('jarak SL & TP dipertahankan (SL 2640, TP 2690) → R:R tetap 1,5', $dekat($j['sl'], 2640.0) && $dekat($j['tp'], 2690.0)
    && $dekat(($j['tp'] - $j['entry']) / ($j['entry'] - $j['sl']), 1.5), $j);
cek('jarak entry asal dicatat (1,25×ATR) dan entry asal disimpan', $dekat($j['jarak_entry_atr'], 1.25, 1e-6) && $dekat($j['entry_asal'], 2650.0), $j);
$j = qi_sp_jangkar_entry('BUY', 2650, 2680, 2630, 2651.5, 8.0);
cek('entry dalam 0,25×ATR (selisih 1,5 ≤ 2) → diterima apa adanya', $j['ok'] && !$j['disesuaikan'] && $dekat($j['entry'], 2650.0), $j);
$j = qi_sp_jangkar_entry('SELL', 1.1000, 1.0950, 1.1030, 1.0985, 0.0010);
cek('SELL: 1,5×ATR di bawah entry → digeser, SL/TP ikut bergeser', $j['ok'] && $j['disesuaikan'] && $dekat($j['entry'], 1.0985) && $dekat($j['sl'], 1.1015, 1e-9) && $dekat($j['tp'], 1.0935, 1e-9), $j);
$j = qi_sp_jangkar_entry('SELL', 1.1000, 1.0950, 1.1030, 1.0940, 0.0010);
cek('SELL: pasar sudah di bawah TP → DITOLAK', !$j['ok'] && $j['alasan'] === 'entry_jauh_dari_harga', $j);
$j = qi_sp_jangkar_entry('BUY', 2650, 2680, 2630, 0.0, 8.0);
cek('harga pasar tidak tersedia → DITOLAK (tidak dapat diverifikasi)', !$j['ok'] && $j['alasan'] === 'harga_acuan_tidak_tersedia', $j);
$j = qi_sp_jangkar_entry('BUY', 2650, 2680, 2630, 2650, 0.0);
cek('ATR nol → DITOLAK', !$j['ok'] && $j['alasan'] === 'harga_acuan_tidak_tersedia', $j);
$j = qi_sp_jangkar_entry('BUY', 2650, 2640, 2630, 2650, 8.0);
cek('level tidak konsisten → DITOLAK', !$j['ok'] && $j['alasan'] === 'level_tidak_konsisten', $j);

echo "Audit ulang 2026-10-22: rencana sempit & harga yang sudah melewati level\n";
// XAUUSD, ATR H1 12, rencana AI sempit BUY 2650 / TP 2652,5 / SL 2648,5; pasar 2652,9 SUDAH di atas TP.
// Entry hanya 0,24×ATR dari pasar, jadi dulu diterima apa adanya (pemeriksaan TP/SL ada SESUDAH toleransi)
// dan penilai mencatat "HIT TP" +1,9R di pembukaan candle berikutnya.
$j = qi_sp_jangkar_entry('BUY', 2650.0, 2652.5, 2648.5, 2652.9, 12.0);
cek('pasar sudah melewati TP walau entry dalam 0,25×ATR → DITOLAK', !$j['ok'] && $j['alasan'] === 'entry_jauh_dari_harga', $j);
$j = qi_sp_jangkar_entry('BUY', 2650.0, 2652.5, 2648.5, 2648.0, 12.0);
cek('cermin: pasar sudah di bawah SL walau dekat → DITOLAK (bukan rugi gap instan)', !$j['ok'] && $j['alasan'] === 'entry_jauh_dari_harga', $j);
$j = qi_sp_jangkar_entry('SELL', 2650.0, 2647.5, 2651.5, 2647.2, 12.0);
cek('SELL: pasar sudah di bawah TP walau dekat → DITOLAK', !$j['ok'] && $j['alasan'] === 'entry_jauh_dari_harga', $j);
// Masih di antara SL–TP, 0,08×ATR dari pasar, tetapi 0,67R: dulu dicatat di 2650 (lebih baik dari pasar).
$j = qi_sp_jangkar_entry('BUY', 2650.0, 2652.5, 2648.5, 2651.0, 12.0);
cek('entry 1,0 dari pasar = 0,67R (toleransi maks. 0,25R = 0,375) → DIGESER ke 2651, SL/TP ikut (R:R tetap)',
    $j['ok'] && $j['disesuaikan'] && $dekat($j['entry'], 2651.0) && $dekat($j['sl'], 2649.5) && $dekat($j['tp'], 2653.5), $j);
cek('toleransi: min(0,25×ATR, 0,25R); tanpa ATR 0,2R', $dekat(qi_sp_toleransi_entry(12.0, 1.5), 0.375) && $dekat(qi_sp_toleransi_entry(8.0, 20.0), 2.0) && $dekat(qi_sp_toleransi_entry(0.0, 20.0), 4.0));

echo "Jeda harian emas (21:00–23:00 UTC)\n";
// Candle M15 terakhir dibuka 20:45 (Selasa). Dulu 21:05 dan 21:14 masih "boleh" — sinyal XAUUSD
// terbit dari harga pra-jeda selama ±15 menit setiap hari.
$c2045 = [['time' => $utc('2026-10-20 20:30'), 'open' => 1, 'high' => 2, 'low' => 0.5, 'close' => 1.5],
          ['time' => $utc('2026-10-20 20:45'), 'open' => 1.5, 'high' => 2, 'low' => 1, 'close' => 1.7]];
foreach (['21:05', '21:14'] as $jm) {
    $h = qi_sp_cek_pasar('XAUUSD', $c2045, 900, $utc('2026-10-20 ' . $jm));
    cek("XAUUSD $jm UTC (jeda harian) → pasar_tutup (dulu boleh)", !$h['boleh'] && $h['alasan'] === 'pasar_tutup', $h);
}
cek('XAUUSD 20:59 UTC → boleh', qi_sp_cek_pasar('XAUUSD', $c2045, 900, $utc('2026-10-20 20:59'))['boleh']);
$c2300 = [['time' => $utc('2026-10-20 22:45'), 'open' => 1, 'high' => 2, 'low' => 0.5, 'close' => 1.5], ['time' => $utc('2026-10-20 23:00'), 'open' => 1.5, 'high' => 2, 'low' => 1, 'close' => 1.7]];
cek('XAUUSD 23:05 UTC (sesudah jeda) → boleh', qi_sp_cek_pasar('XAUUSD', $c2300, 900, $utc('2026-10-20 23:05'))['boleh']);
$cEur = [['time' => $utc('2026-10-20 21:00'), 'open' => 1, 'high' => 2, 'low' => 0.5, 'close' => 1.5], ['time' => $utc('2026-10-20 21:15'), 'open' => 1.5, 'high' => 2, 'low' => 1, 'close' => 1.7]];
cek('EURUSD 21:20 UTC (forex tidak punya jeda ini) → boleh', qi_sp_cek_pasar('EURUSD', $cEur, 900, $utc('2026-10-20 21:20'))['boleh']);
cek('qi_sp_pasar_buka: BTC Sabtu buka; XAU 21:30 tutup; XAU Selasa 10:00 buka', qi_sp_pasar_buka('BTCUSDT', $sabtu) && !qi_sp_pasar_buka('XAUUSD', $utc('2026-10-20 21:30')) && qi_sp_pasar_buka('XAUUSD', $selasa));

echo "Detik pasar BUKA (umur harga saat expiry)\n";
cek('XAUUSD Jumat 21:00 → Sabtu 02:00: 0 detik buka (akhir pekan bukan data basi)', qi_sp_detik_buka('XAUUSD', $utc('2026-10-23 21:00'), $utc('2026-10-24 02:00')) === 0);
cek('BTCUSDT rentang yang sama: 5 jam penuh (24/7)', qi_sp_detik_buka('BTCUSDT', $utc('2026-10-23 21:00'), $utc('2026-10-24 02:00')) === 5 * 3600);
cek('EURUSD Jumat 18:00 → 21:00: 3 jam buka', qi_sp_detik_buka('EURUSD', $utc('2026-10-23 18:00'), $utc('2026-10-23 21:00')) === 3 * 3600);
cek('XAUUSD Selasa 20:30 → 23:30: 1 jam buka (jeda 21–23 tidak dihitung)', qi_sp_detik_buka('XAUUSD', $utc('2026-10-20 20:30'), $utc('2026-10-20 23:30')) === 3600);

echo "Arah mtf_aligned (sinyal berita)\n";
cek('BULLISH + BUY → selaras', qi_sp_mtf_selaras('BULLISH', 'BUY'));
cek('BEARISH + SELL → selaras', qi_sp_mtf_selaras('BEARISH', 'SELL'));
cek('BULLISH + SELL → TIDAK selaras (dulu true karena hanya cek ≠ NEUTRAL)', !qi_sp_mtf_selaras('BULLISH', 'SELL'));
cek('NEUTRAL → tidak selaras', !qi_sp_mtf_selaras('NEUTRAL', 'BUY'));

// Deret untuk uji paritas JavaScript (calcRSI harus memberi angka yang sama).
$seri = [
    'turun_lalu_datar' => $turunDatar,
    'datar' => array_fill(0, 40, 5.0),
    'naik' => $naik,
    'zigzag_plus' => $satu,
    'gelombang' => array_map(fn($i) => round(100 + 10 * sin($i / 5) + ($i % 7) * 0.3, 4), range(0, 299)),
    'pendek' => [1, 2, 3],
];
$hasil = [];
foreach ($seri as $k => $s) $hasil[$k] = ['closes' => $s, 'rsi' => qi_sp_rsi($s)];
// Masukan berupa CANDLE (bar beku dibuang di kedua sisi).
$hasil['candle_dengan_bar_beku'] = ['candles' => $denganBeku, 'rsi' => qi_sp_rsi_candles($denganBeku)];
$gel = [];
foreach ($seri['gelombang'] as $i => $cl) {
    // Tiap bar ke-9 adalah bar beku (O=H=L=C) di harga acak-semu — harus dibuang kedua sisi.
    $gel[] = ($i % 9 === 4) ? $bar(90.0 + $i % 5, 90.0 + $i % 5, 90.0 + $i % 5, 90.0 + $i % 5, $i) : $bar($cl - 0.2, $cl + 0.6, $cl - 0.7, $cl, $i);
}
$hasil['candle_gelombang_berselang_beku'] = ['candles' => $gel, 'rsi' => qi_sp_rsi_candles($gel)];
echo 'RSI_JSON ' . json_encode($hasil) . "\n";

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
