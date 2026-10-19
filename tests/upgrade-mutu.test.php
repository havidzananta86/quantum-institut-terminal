<?php
/**
 * Uji batch "upgrade mutu":
 *   · gerbang risiko (api/_gerbang_risiko.php): spread hidup, eksposur korelasi, relevansi berita;
 *   · qi_signal_catat menegakkan korelasi + mencatat versi_aturan (berkas SEMENTARA, bukan rekor asli);
 *   · statistik per dimensi & Monte Carlo (api/_signal_stats.php);
 *   · detak cron (api/_detak_cron.php).
 * Murni: tanpa jaringan/DB. Dijalankan oleh tests/upgrade-mutu.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('Asia/Jakarta');
define('QI_NOTIFY_KEY', str_repeat('k', 40));
require __DIR__ . '/../api/_signal_time.php';
require __DIR__ . '/../api/_signal_stats.php';
require __DIR__ . '/../api/_signal_record.php';
require __DIR__ . '/../api/_detak_cron.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$utc = fn(string $s): int => (new DateTimeImmutable($s, new DateTimeZone('UTC')))->getTimestamp();
$iso = fn(int $t): string => gmdate('Y-m-d\TH:i:s\Z', $t);

echo "Berita per mata uang\n";
cek('EURUSD digerakkan EUR & USD', qi_gr_mata_uang('EURUSD') === ['EUR', 'USD']);
cek('XAUUSD & kripto digerakkan USD', qi_gr_mata_uang('XAUUSD') === ['USD'] && qi_gr_mata_uang('BTCUSDT') === ['USD']);
cek('berita JPY tidak menahan XAUUSD', !qi_gr_berita_relevan('JPY', 'XAUUSD'));
cek('berita USD menahan XAUUSD, EURUSD, BTCUSDT', qi_gr_berita_relevan('USD', 'XAUUSD') && qi_gr_berita_relevan('usd', 'EURUSD') && qi_gr_berita_relevan('USD', 'BTCUSDT'));
cek('berita EUR menahan EURUSD, tidak USDJPY', qi_gr_berita_relevan('EUR', 'EURUSD') && !qi_gr_berita_relevan('EUR', 'USDJPY'));
cek('mata uang berita kosong / simbol tak dikenal → dianggap relevan (konservatif)', qi_gr_berita_relevan('', 'EURUSD') && qi_gr_berita_relevan('EUR', 'US30'));

echo "Gerbang spread hidup\n";
$g = qi_gr_cek_spread('XAUUSD', 0.35, 2000);
cek('XAUUSD spread 0,35 (1,17× tipikal) → lolos', $g['lolos'] && $g['dinilai'] && $g['rasio'] === 1.17, $g);
$g = qi_gr_cek_spread('XAUUSD', 0.90, 2000);
cek('XAUUSD spread 0,90 (3× tipikal) → ditahan', !$g['lolos'] && $g['rasio'] === 3.0, $g);
$g = qi_gr_cek_spread('EURUSD', null, 1.08);
cek('feed tidak tersedia → fail-open, ditandai belum dinilai', $g['lolos'] && !$g['dinilai'], $g);
cek('batas bisa diubah (kali = 4)', qi_gr_cek_spread('XAUUSD', 0.90, 2000, 4.0)['lolos']);

echo "Eksposur korelasi\n";
$h = [
    ['id' => 'A', 'symbol' => 'EURUSD', 'side' => 'BUY', 'status' => 'AKTIF'],
    ['id' => 'B', 'symbol' => 'GBPUSD', 'side' => 'BUY', 'status' => 'AKTIF'],
    ['id' => 'C', 'symbol' => 'USDJPY', 'side' => 'BUY', 'status' => 'AKTIF'],        // USD menguat: kelompok lain
    ['id' => 'D', 'symbol' => 'AUDUSD', 'side' => 'BUY', 'status' => 'HIT TP 🎯'],    // sudah selesai
];
$k = qi_gr_cek_korelasi($h, 'XAUUSD', 'BUY');
cek('XAUUSD BUY saat EURUSD BUY + GBPUSD BUY aktif → ditolak (maks 2)', !$k['lolos'] && $k['kunci'] === 'USD_LEMAH' && $k['id_aktif'] === ['A', 'B'], $k);
cek('XAUUSD SELL (USD menguat, 1 aktif) → lolos', qi_gr_cek_korelasi($h, 'XAUUSD', 'SELL')['lolos']);
cek('kripto tidak terkena kelompok USD', qi_gr_cek_korelasi($h, 'BTCUSDT', 'BUY')['lolos']);

echo "Pencatat sinyal resmi (berkas sementara)\n";
$GLOBALS['qi_gerbang_lewati'] = true;
$GLOBALS['qi_spread_lewati'] = true;
$dir = sys_get_temp_dir() . '/qi_mutu_' . bin2hex(random_bytes(4));
@mkdir($dir);
$f = $dir . '/riwayat.json';
$lama = time() - 10 * 3600;
file_put_contents($f, json_encode([
    ['id' => 'A', 'engine' => 'AI', 'symbol' => 'EURUSD', 'side' => 'BUY', 'status' => 'AKTIF', 'timestamp' => $iso($lama), 'entry' => 1.08, 'sl' => 1.07, 'tp' => 1.10],
    ['id' => 'B', 'engine' => 'TRADINGVIEW', 'symbol' => 'GBPUSD', 'side' => 'BUY', 'status' => 'AKTIF', 'timestamp' => $iso($lama), 'entry' => 1.27, 'sl' => 1.26, 'tp' => 1.30],
]));
$rek = fn(string $arah) => ['id' => 'T-' . $arah, 'engine' => 'AUTO_SIGNAL', 'symbol' => 'XAUUSD', 'side' => $arah,
    'entry' => 2000.0, 'sl' => $arah === 'BUY' ? 1990.0 : 2010.0, 'tp' => $arah === 'BUY' ? 2025.0 : 1975.0,
    'timestamp' => $iso(time()), 'status' => 'AKTIF', 'news_context' => 'uji'];
$r = qi_signal_catat($rek('BUY'), 4, 20, $f);
cek('XAUUSD BUY ditolak: eksposur_korelasi', !$r['dicatat'] && $r['alasan'] === 'eksposur_korelasi', $r);
$r = qi_signal_catat($rek('SELL'), 4, 20, $f);
$isi = json_decode((string)file_get_contents($f), true);
cek('XAUUSD SELL dicatat', $r['dicatat'] === true && ($isi[0]['id'] ?? '') === 'T-SELL', $r);
cek('rekor membawa versi_aturan & kunci_korelasi', ($isi[0]['versi_aturan'] ?? '') === QI_VERSI_ATURAN_SINYAL && ($isi[0]['kunci_korelasi'] ?? '') === 'USD_KUAT', $isi[0] ?? null);
cek('kunci berkas dilepas sesudah mencatat', !is_file($f . '.lock'));
array_map('unlink', glob($dir . '/*') ?: []); @rmdir($dir);

echo "Statistik per dimensi\n";
cek('sesi: 03:00 UTC = Asia, 09:00 = London, 13:00 = London+NY, 18:00 = New York, 22:00 = Sepi',
    str_starts_with(qi_signal_sesi($utc('2026-10-20 03:00')), 'Asia') && str_starts_with(qi_signal_sesi($utc('2026-10-20 09:00')), 'London (')
    && str_starts_with(qi_signal_sesi($utc('2026-10-20 13:00')), 'London+NY') && str_starts_with(qi_signal_sesi($utc('2026-10-20 18:00')), 'New York')
    && str_starts_with(qi_signal_sesi($utc('2026-10-20 22:00')), 'Sepi'));
$rekor = [];
$tBase = $utc('2026-10-20 09:00');
for ($i = 0; $i < 6; $i++) {   // 6 transaksi sesi London: 2 menang (+2,5R), 4 kalah (−1R)
    $menang = $i < 2;
    $rekor[] = ['id' => 'L' . $i, 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 100, 'sl' => 99, 'tp' => 102.5,
                'exit_price' => $menang ? 102.5 : 99, 'status' => $menang ? 'HIT TP 🎯' : 'HIT SL 🛑', 'timestamp' => $iso($tBase + $i * 60), 'versi_penilaian' => 2];
}
$rekor[] = ['id' => 'N1', 'symbol' => 'EURUSD', 'side' => 'SELL', 'entry' => 1.1, 'sl' => 1.11, 'tp' => 1.075, 'exit_price' => 1.075,
            'status' => 'HIT TP 🎯', 'timestamp' => $iso($utc('2026-10-20 18:00'))];
$d = qi_signal_statistik_dimensi($rekor);
$ldn = array_values(array_filter($d['per_sesi'], fn($g) => str_starts_with($g['kelompok'], 'London (')))[0] ?? null;
cek('per_sesi London: 6 tertutup, win rate 33,3%, expectancy +0,17R', $ldn && $ldn['dinilai'] === 6 && $ldn['win_rate'] === 33.3 && abs((float)$ldn['expectancy_r'] - 0.167) < 0.01, $ldn);
cek('kelompok kecil ditandai cukup_sampel = false', $ldn && $ldn['cukup_sampel'] === false);
$versi = array_column($d['per_versi_penilaian'], 'dinilai', 'kelompok');
cek('per_versi_penilaian memisahkan v1 (tanpa spread) dari v2', ($versi['v2 (spread + gap)'] ?? 0) === 6 && ($versi['v1 (tanpa spread)'] ?? 0) === 1, $versi);
cek('per_simbol & per_hari tersedia', count($d['per_simbol']) === 2 && count($d['per_hari']) >= 1);

echo "Monte Carlo\n";
$mc = qi_signal_monte_carlo(array_slice($rekor, 0, 6));
cek('< 10 transaksi → tidak disimulasikan, alasan jujur', $mc['iterasi'] === 0 && str_contains((string)$mc['catatan'], 'Minimal 10'), $mc);
$banyak = [];
for ($i = 0; $i < 40; $i++) $banyak[] = $rekor[$i % 6];
$mc1 = qi_signal_monte_carlo($banyak, 500);
$mc2 = qi_signal_monte_carlo($banyak, 500);
cek('deterministik (benih tetap): dua kali hitung = sama', $mc1 === $mc2);
cek('urutan statistik masuk akal: median ≤ p95 ≤ terburuk', $mc1['dd_median_r'] <= $mc1['dd_p95_r'] && $mc1['dd_p95_r'] <= $mc1['dd_terburuk_r'], $mc1);
cek('peluang rugi 0–100% dan drawdown > 0 untuk R campuran', $mc1['peluang_rugi_pct'] >= 0 && $mc1['peluang_rugi_pct'] <= 100 && $mc1['dd_median_r'] > 0, $mc1);
$semuaMenang = array_fill(0, 12, $rekor[0]);
$mc3 = qi_signal_monte_carlo($semuaMenang, 200);
cek('semua menang → drawdown 0, peluang rugi 0%', $mc3['dd_terburuk_r'] == 0 && $mc3['peluang_rugi_pct'] == 0, $mc3);
cek('mt_rand global tidak tersentuh', (function () { mt_srand(7); $a = mt_rand(); mt_srand(7); qi_signal_monte_carlo(array_fill(0, 12, ['status' => 'HIT TP 🎯', 'entry' => 1, 'sl' => 0.5, 'exit_price' => 2, 'side' => 'BUY']), 50); return mt_rand() === $a; })());

echo "Detak cron\n";
$kini = 1_800_000_000;
cek('belum pernah ada detak → belum_pernah, tidak basi', qi_cron_status(null, $kini) === ['status' => 'belum_pernah', 'umur_s' => null, 'terakhir' => null, 'basi' => false]);
cek('detak 10 menit lalu → ok', qi_cron_status(['t' => $kini - 600], $kini)['status'] === 'ok');
$s = qi_cron_status(['t' => $kini - 3600], $kini);
cek('detak 60 menit lalu → basi', $s['status'] === 'basi' && $s['basi'] && $s['umur_s'] === 3600, $s);
cek('status ok tidak memicu alarm', qi_cron_alarm(['basi' => false]) === null);

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
