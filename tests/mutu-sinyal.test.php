<?php
/**
 * Uji batch "mutu sinyal":
 *   · resolusi M1 untuk candle yang menyentuh TP dan SL sekaligus (resmi + bayangan);
 *   · slippage pada SL (order stop) di penilai bayangan;
 *   · pencatatan & ringkasan kandidat yang ditolak gerbang (berkas SEMENTARA);
 *   · qi_signal_catat mencatat penolakan korelasi ke berkas kandidat;
 *   · CI bootstrap expectancy & kriteria kesiapan auto-entry.
 * Murni: tanpa jaringan/DB. Dijalankan oleh tests/mutu-sinyal.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('Asia/Jakarta');
define('QI_SIGNAL_EVAL_LIB', true);
define('QI_NOTIFY_KEY', str_repeat('k', 40));
require __DIR__ . '/../api/_signal_time.php';
require __DIR__ . '/../api/signal-evaluator.php';
require __DIR__ . '/../api/_signal_stats.php';
require __DIR__ . '/../api/_setup_shadow.php';
require __DIR__ . '/../api/_signal_record.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$dekat = fn($a, $b, float $eps = 1e-6): bool => is_numeric($a) && abs((float)$a - (float)$b) < $eps;
$t0 = (new DateTimeImmutable('2026-10-20 08:00:00', new DateTimeZone('UTC')))->getTimestamp();
$iso = fn(int $t): string => gmdate('Y-m-d\TH:i:s\Z', $t);
$beli = ['id' => 'SIG-M1', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 2000.0, 'sl' => 1990.0, 'tp' => 2025.0,
         'timestamp' => $iso($t0), 'expiry' => $iso($t0 + 4 * 3600)];
$kini = $t0 + 3600;
// Satu candle M15 (dibuka 08:15) yang menyentuh TP (2026) DAN SL (1989).
$ambigu = [['time' => $t0 + 900, 'open' => 2001, 'high' => 2026, 'low' => 1989, 'close' => 2010]];
$m1 = fn(array $urutan) => function (int $a, int $b) use ($urutan): array {
    $out = []; $t = $a;
    foreach ($urutan as [$h, $l]) { $out[] = ['time' => $t, 'open' => 2001, 'high' => $h, 'low' => $l, 'close' => 2001]; $t += 60; }
    return $out;
};

echo "Resolusi M1 (rekor resmi)\n";
$h = qi_sig_nilai_satu($beli, $ambigu, 900, $kini);
cek('tanpa pengurai: SL lebih dulu (konservatif), ditandai sl_dulu', ($h['status'] ?? '') === 'HIT SL 🛑' && ($h['resolusi_ambigu'] ?? '') === 'sl_dulu', $h);
$h = qi_sig_nilai_satu($beli, $ambigu, 900, $kini, null, $m1([[2005, 1999], [2026, 2004], [2010, 1989]]));
cek('M1: TP tersentuh lebih dulu → HIT TP di 2025, ditandai M1', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2025) && ($h['resolusi_ambigu'] ?? '') === 'M1', $h);
$h = qi_sig_nilai_satu($beli, $ambigu, 900, $kini, null, $m1([[2003, 1989], [2026, 2004]]));
cek('M1: SL tersentuh lebih dulu → HIT SL', ($h['status'] ?? '') === 'HIT SL 🛑' && ($h['resolusi_ambigu'] ?? '') === 'M1', $h);
$h = qi_sig_nilai_satu($beli, $ambigu, 900, $kini, null, $m1([[2026, 1989]]));
cek('M1 yang juga menyentuh keduanya → tetap SL', ($h['status'] ?? '') === 'HIT SL 🛑', $h);
$h = qi_sig_nilai_satu($beli, $ambigu, 900, $kini, null, fn() => []);
cek('M1 tidak tersedia → SL lebih dulu', ($h['status'] ?? '') === 'HIT SL 🛑' && ($h['resolusi_ambigu'] ?? '') === 'sl_dulu', $h);
$h = qi_sig_nilai_satu($beli, $ambigu, 900, $kini, null, $m1([[2005, 1999], [2010, 2000]]));
cek('M1 bolong (tidak mencakup sentuhan) → tidak menebak, SL dulu', ($h['status'] ?? '') === 'HIT SL 🛑' && ($h['resolusi_ambigu'] ?? '') === 'sl_dulu', $h);
cek('candle yang sudah M1 tidak diurai lagi', qi_sig_urai_m1('BUY', 2025, 1990, 0.0, $ambigu[0], 60, $m1([[2026, 2004]])) === null);
$h = qi_sig_nilai_satu($beli, [['time' => $t0 + 900, 'open' => 2001, 'high' => 2026, 'low' => 1995, 'close' => 2020]], 900, $kini);
cek('candle tidak ambigu: tanpa penanda resolusi', !isset($h['resolusi_ambigu']), $h);

echo "Penilai bayangan: M1 + slippage SL\n";
$k = ['ttl_pending_jam' => 12, 'maks_tahan_jam' => 48, 'durasi_nilai' => 900];
$lim = ['id' => 'SHD-M1', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 2000.0, 'sl' => 1990.0, 'tp' => 2030.0, 'timestamp' => $iso($t0), 'status' => 'MENUNGGU'];
$isi = ['time' => $t0 + 300, 'open' => 2003, 'high' => 2004, 'low' => 1999, 'close' => 2001];
$amb = ['time' => $t0 + 900, 'open' => 2001, 'high' => 2031, 'low' => 1989, 'close' => 2010];
$h = qi_ss_nilai($lim, [$isi, $amb], $kini, $k);
cek('bayangan, tanpa pengurai: SL dulu', ($h['status'] ?? '') === 'HIT SL 🛑' && ($h['resolusi_ambigu'] ?? '') === 'sl_dulu', $h);
$h = qi_ss_nilai($lim, [$isi, $amb], $kini, $k + ['urai' => $m1([[2031, 2002], [2010, 1989]])]);
cek('bayangan, M1: TP lebih dulu → HIT TP', ($h['status'] ?? '') === 'HIT TP 🎯' && ($h['resolusi_ambigu'] ?? '') === 'M1', $h);
$h = qi_ss_nilai($lim + ['slippage_biaya' => 0.1], [$isi, ['time' => $t0 + 900, 'open' => 2001, 'high' => 2002, 'low' => 1989, 'close' => 1995]], $kini, $k);
cek('bayangan: SL (order stop) terisi 1990 − slippage 0,1 = 1989,9', ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['exit_price'] ?? null, 1989.9), $h);

echo "Kandidat yang ditolak gerbang\n";
$dir = sys_get_temp_dir() . '/qi_tolak_' . bin2hex(random_bytes(4));
@mkdir($dir);
$GLOBALS['qi_ditolak_berkas'] = $dir . '/ditolak.json';
$cal = ['symbol' => 'EURUSD', 'side' => 'BUY', 'engine' => 'AI', 'entry' => 1.08, 'sl' => 1.07, 'tp' => 1.105];
cek('alasan yang dilacak dicatat', qi_ditolak_catat($cal, 'spread_melebar', ['rasio' => 3.1], $t0) === true);
cek('kandidat sejenis dalam 4 jam tidak dicatat dua kali', qi_ditolak_catat($cal, 'spread_melebar', [], $t0 + 3600) === false);
cek('setelah 4 jam boleh dicatat lagi', qi_ditolak_catat($cal, 'spread_melebar', [], $t0 + 5 * 3600) === true);
cek('alasan lain untuk simbol sama tetap dicatat', qi_ditolak_catat($cal, 'eksposur_korelasi', [], $t0) === true);
cek('cooldown/duplikat TIDAK dicatat (bukan gerbang)', qi_ditolak_catat($cal, 'cooldown_simbol', [], $t0) === false);
cek('level tidak sah ditolak', qi_ditolak_catat(['sl' => 1.2] + $cal, 'gerbang_mesin', [], $t0) === false);
$isiBerkas = qi_json_baca($GLOBALS['qi_ditolak_berkas']);
cek('berkas: 3 kandidat AKTIF dengan alasan_tolak', count($isiBerkas) === 3 && $isiBerkas[0]['status'] === 'AKTIF' && isset($isiBerkas[0]['alasan_tolak']), $isiBerkas);

$GLOBALS['qi_gerbang_lewati'] = true;
$GLOBALS['qi_spread_lewati'] = true;
$f = $dir . '/riwayat.json';
$lama = time() - 10 * 3600;
file_put_contents($f, json_encode([
    ['id' => 'A', 'engine' => 'AI', 'symbol' => 'EURUSD', 'side' => 'BUY', 'status' => 'AKTIF', 'timestamp' => $iso($lama), 'entry' => 1.08, 'sl' => 1.07, 'tp' => 1.10],
    ['id' => 'B', 'engine' => 'TRADINGVIEW', 'symbol' => 'GBPUSD', 'side' => 'BUY', 'status' => 'AKTIF', 'timestamp' => $iso($lama), 'entry' => 1.27, 'sl' => 1.26, 'tp' => 1.30],
]));
$r = qi_signal_catat(['id' => 'X1', 'engine' => 'AUTO_SIGNAL', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 2000.0, 'sl' => 1990.0, 'tp' => 2025.0,
                      'timestamp' => $iso(time()), 'status' => 'AKTIF', 'news_context' => 'uji'], 4, 20, $f);
$isiBerkas = qi_json_baca($GLOBALS['qi_ditolak_berkas']);
cek('qi_signal_catat: penolakan korelasi masuk berkas kandidat', $r['alasan'] === 'eksposur_korelasi' && ($isiBerkas[0]['symbol'] ?? '') === 'XAUUSD' && ($isiBerkas[0]['id_asal'] ?? '') === 'X1', $isiBerkas[0] ?? null);

$tutup = function (string $alasan, int $menang, int $kalah) use ($iso, $t0): array {
    $out = [];
    for ($i = 0; $i < $menang + $kalah; $i++) {
        $w = $i < $menang;
        $out[] = ['id' => $alasan . $i, 'alasan_tolak' => $alasan, 'symbol' => 'EURUSD', 'side' => 'BUY', 'entry' => 100, 'sl' => 99, 'tp' => 102.5,
                  'exit_price' => $w ? 102.5 : 99, 'status' => $w ? 'HIT TP 🎯' : 'HIT SL 🛑', 'timestamp' => $iso($t0)];
    }
    return $out;
};
$rk = qi_ditolak_ringkas(array_merge($tutup('spread_melebar', 4, 36), $tutup('blackout_berita', 3, 2)));
$per = array_column($rk['per_alasan'], null, 'kelompok');
cek('ringkasan: 40 kandidat spread, expectancy negatif → "gerbang menolong"', ($per['spread_melebar']['dinilai'] ?? 0) === 40 && str_starts_with((string)($per['spread_melebar']['tafsiran'] ?? ''), 'gerbang menolong'), $per['spread_melebar'] ?? null);
cek('ringkasan: sampel kecil tidak disimpulkan', str_starts_with((string)($per['blackout_berita']['tafsiran'] ?? ''), 'sampel masih kecil'), $per['blackout_berita'] ?? null);
array_map('unlink', glob($dir . '/*') ?: []); @rmdir($dir);
unset($GLOBALS['qi_ditolak_berkas']);

echo "CI expectancy & kesiapan auto-entry\n";
$seri = function (int $menang, int $kalah) use ($iso, $t0): array {
    $out = [];
    for ($i = 0; $i < $menang + $kalah; $i++) {
        $w = ($i % ($menang + $kalah)) < $menang;
        $out[] = ['id' => 'S' . $i, 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 100, 'sl' => 99, 'tp' => 102.5,
                  'exit_price' => $w ? 102.5 : 99, 'status' => $w ? 'HIT TP 🎯' : 'HIT SL 🛑', 'timestamp' => $iso($t0 + $i * 3600)];
    }
    return $out;
};
$ci = qi_signal_ci_expectancy($seri(3, 3));
cek('< 10 transaksi → tanpa interval', $ci['bawah'] === null && $ci['n'] === 6, $ci);
$kuat = $seri(50, 70);   // 41,7% menang pada R:R 2,5 → expectancy +0,46R
$ci = qi_signal_ci_expectancy($kuat);
cek('CI bootstrap: bawah ≤ rata-rata ≤ atas, deterministik', $ci['bawah'] <= $ci['rata_r'] && $ci['rata_r'] <= $ci['atas'] && $ci === qi_signal_ci_expectancy($kuat), $ci);
$ks = qi_signal_kesiapan_auto($kuat, $seri(24, 76));
cek('sampel 120 dengan edge jelas → semua kriteria lulus', $ks['siap'] === true && $ks['lolos'] === '6 / 6', $ks);
$ks = qi_signal_kesiapan_auto($seri(5, 8));
cek('sampel 13 → belum siap, kriteria sampel gagal', $ks['siap'] === false && $ks['kriteria'][0]['lolos'] === false, $ks['lolos']);
$ks = qi_signal_kesiapan_auto($seri(30, 90));   // 25% menang → expectancy −0,125R
cek('sampel 120 tanpa edge → belum siap (expectancy ≤ 0)', $ks['siap'] === false && $ks['kriteria'][1]['lolos'] === false, $ks['lolos']);
cek('catatan selalu mengingatkan akun DEMO dulu bila siap', str_contains(qi_signal_kesiapan_auto($kuat)['catatan'], 'DEMO'));

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
