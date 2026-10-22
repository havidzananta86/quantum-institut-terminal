<?php
/**
 * api/get-chart-data.php saat SEMUA sumber gagal (audit sinyal 2026-10-22):
 *   · cache NYATA ≤ 7 hari disajikan dengan stale=true + umur_detik — bukan 201 candle rand();
 *   · tanpa cache nyata → status error "tidak_tersedia", candle kosong (tidak ada harga karangan);
 *   · saat di-include (signals.php / ai-signal.php) berkas itu RETURN, bukan exit().
 * Simbol rekaan ZZG3ABASI tidak punya sumber apa pun, jadi jalur "semua sumber gagal" teruji
 * tanpa jaringan. Berkas cache uji dihapus lagi. Dijalankan oleh tests/chart-basi.test.js.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_middleware.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}

/** Muat seperti signals.php memuatnya: include di dalam fungsi, keluaran ditangkap. */
function muat_chart(string $sym, string $iv): array
{
    if (!defined('QI_INCLUDED_BY_SIGNALS')) define('QI_INCLUDED_BY_SIGNALS', true);
    $_GET['symbol'] = $sym;
    $_GET['interval'] = $iv;
    ob_start();
    include __DIR__ . '/../api/get-chart-data.php';
    $raw = (string)ob_get_clean();
    $d = json_decode($raw, true);
    return is_array($d) ? $d : ['_mentah' => substr($raw, 0, 300)];
}

$sim = 'ZZG3ABASI';
$berkas = qi_chart_cache_file($sim, '60', false);
$bersihkan = function () use ($berkas): void { @unlink($berkas); @unlink($berkas . '.lock'); };
$t = intdiv(time(), 3600) * 3600 - 2 * 3600;
$candles = [];
for ($i = 0; $i < 50; $i++) $candles[] = ['time' => $t - (49 - $i) * 3600, 'open' => 10.0 + $i, 'high' => 10.5 + $i, 'low' => 9.5 + $i, 'close' => 10.2 + $i, 'volume' => 1];

try {
    @mkdir(dirname($berkas), 0755, true);
    $bersihkan();

    echo "Cache nyata 2 jam lalu, semua sumber gagal\n";
    file_put_contents($berkas, json_encode(['status' => 'success', 'symbol' => $sim, 'interval' => '60', 'simulated' => false, 'source' => 'uji_nyata', 'candles' => $candles]));
    touch($berkas, time() - 7200);
    clearstatcache();
    $d = muat_chart($sim, '60');
    cek('include KEMBALI ke pemanggil (tidak exit) dan mengirim JSON', isset($d['candles']), $d);
    cek('data nyata terakhir disajikan apa adanya (50 candle, close terakhir 59,2)', count($d['candles'] ?? []) === 50 && abs((float)(end($d['candles'])['close'] ?? 0) - 59.2) < 1e-9, $d['candles'] ?? null);
    cek('ditandai stale=true + umur_detik ±7200', ($d['stale'] ?? null) === true && abs((int)($d['umur_detik'] ?? 0) - 7200) <= 5, ['stale' => $d['stale'] ?? null, 'umur' => $d['umur_detik'] ?? null]);
    cek('bukan simulasi; sumber asli dipertahankan', ($d['simulated'] ?? null) === false && ($d['source'] ?? '') === 'uji_nyata', $d);
    cek('berkas cache TIDAK ditulis ulang (umurnya tetap jujur)', abs((time() - (int)filemtime($berkas)) - 7200) <= 5);

    echo "Cache lebih tua dari 7 hari\n";
    touch($berkas, time() - 8 * 86400);
    clearstatcache();
    $d = muat_chart($sim, '60');
    cek('tidak disajikan; status error "tidak_tersedia"', ($d['status'] ?? '') === 'error' && !empty($d['tidak_tersedia']), $d);
    cek('TIDAK ada candle karangan (dulu 201 candle rand())', ($d['candles'] ?? null) === [], count($d['candles'] ?? []));

    echo "Cache berisi candle simulasi lama\n";
    file_put_contents($berkas, json_encode(['status' => 'success', 'simulated' => true, 'source' => 'simulasi', 'candles' => $candles]));
    touch($berkas, time() - 600);
    clearstatcache();
    $d = muat_chart($sim, '60');
    cek('cache simulasi tidak pernah disajikan', ($d['status'] ?? '') === 'error' && ($d['candles'] ?? null) === [], $d);

    echo "Tanpa cache sama sekali\n";
    $bersihkan();
    clearstatcache();
    $d = muat_chart($sim, '60');
    cek('status error + pesan jujur, candle kosong, simulated=false', ($d['status'] ?? '') === 'error' && ($d['candles'] ?? null) === [] && ($d['simulated'] ?? null) === false && str_contains((string)($d['message'] ?? ''), 'tidak tersedia'), $d);
} finally {
    $bersihkan();
}

echo "Sesudah semua include\n";
cek('skrip uji masih berjalan (get-chart-data tidak memanggil exit saat di-include)', true);

// ── Penerbit sinyal: H1 basi BUKAN harga pasar (audit ulang 2026-10-22) ─────────────────────
// Reproduksi: M15 segar (2700,5) + cache H1 berumur 3 hari (close ±2608). Dulu pembangkit,
// signal-news, ai-signal, dan tv-webhook hanya menolak data SIMULASI pada muatan H1, sehingga
// entry = 2608,4 dicatat sebagai harga_acuan "saat ini" (jarak_entry_atr 0), dan H1 basi ikut
// memilih arah 3-dari-4. Fungsi ASLI dipakai (ai-signal.php sebagai library).
echo "Penerbit sinyal: candle H1 basi tidak dipakai\n";
define('QI_AI_SIGNAL_LIB', 1);
require_once __DIR__ . '/../api/ai-signal.php';
$simP = 'ZZG3APUB';   // ≤ 10 huruf: get-chart-data memotong simbol yang lebih panjang
$f15 = qi_chart_cache_file($simP, '15', qi_chart_use_mt5($simP));
$f60 = qi_chart_cache_file($simP, '60', qi_chart_use_mt5($simP));
$bersihP = function () use ($f15, $f60): void { foreach ([$f15, $f60] as $f) { @unlink($f); @unlink($f . '.lock'); } };
$kini = time();
$m15 = []; $h1 = [];
for ($i = 0; $i < 80; $i++) { $t = intdiv($kini, 900) * 900 - (79 - $i) * 900; $m15[] = ['time' => $t, 'open' => 2700.0, 'high' => 2702.0 + ($i % 3), 'low' => 2698.0, 'close' => 2700.5]; }
$t3 = $kini - 3 * 86400;
for ($i = 0; $i < 80; $i++) { $t = intdiv($t3, 3600) * 3600 - (79 - $i) * 3600; $h1[] = ['time' => $t, 'open' => 2600 + $i * 0.1, 'high' => 2602 + $i * 0.1, 'low' => 2598 + $i * 0.1, 'close' => 2600.5 + $i * 0.1]; }
try {
    @mkdir(dirname($f15), 0755, true);
    file_put_contents($f15, json_encode(['status' => 'success', 'simulated' => false, 'source' => 'uji', 'candles' => $m15]));
    file_put_contents($f60, json_encode(['status' => 'success', 'simulated' => false, 'source' => 'uji', 'candles' => $h1]));
    touch($f60, $t3);
    clearstatcache();
    $muat60 = ai_load_candles($simP, '60');
    cek('prasyarat: muatan H1 = cache basi (stale=true, ±3 hari), bukan simulasi', ($muat60['stale'] ?? null) === true && empty($muat60['simulated']) && count($muat60['candles'] ?? []) === 80, ['stale' => $muat60['stale'] ?? null, 'umur' => $muat60['umur_detik'] ?? null]);
    $layak = qi_sp_muat_layak($simP, $muat60, 3600, $kini);
    cek('qi_sp_muat_layak: H1 basi DITOLAK sebagai harga acuan (data_basi) — dulu lolos', !$layak['boleh'] && $layak['alasan'] === 'data_basi', $layak);
    $muatTua = ['candles' => $h1, 'simulated' => false, 'stale' => false];
    $layak = qi_sp_muat_layak($simP, $muatTua, 3600, $kini);
    cek('candle H1 tiga hari lalu TANPA penanda stale juga ditolak (umur candle > 2 batang)', !$layak['boleh'], $layak);
    cek('candle M15 segar diterima (bukan menolak semuanya)', qi_sp_muat_layak('BTCUSDT', ai_load_candles($simP, '15'), 900, $kini)['boleh']);
    cek('data simulasi tetap ditolak', qi_sp_muat_layak($simP, ['candles' => $m15, 'simulated' => true], 900, $kini)['alasan'] === 'data_simulasi_ditolak');
    cek('tanpa candle → tanpa_data', qi_sp_muat_layak($simP, ['candles' => []], 3600, $kini)['alasan'] === 'tanpa_data');

    $tfs = ['M15' => ai_analyze($simP, '15'), 'H1' => ai_analyze($simP, '60')];
    cek('ai_analyze melaporkan H1 basi apa adanya (stale=true)', is_array($tfs['H1']) && $tfs['H1']['stale'] === true && is_array($tfs['M15']) && $tfs['M15']['stale'] === false, $tfs);
    $pakai = ai_tf_dipakai($tfs);
    cek('ai_tf_dipakai: H1 basi TIDAK ikut konsensus (null), M15 segar tetap', $pakai['H1'] === null && is_array($pakai['M15']), $pakai);
} finally {
    $bersihP();
}

echo "Sambungan ke penerbit\n";
$src = fn(string $f): string => (string)file_get_contents(__DIR__ . '/../api/' . $f);
foreach (['signal-generator.php', 'signal-news.php', 'tv-webhook.php', 'ai-signal.php'] as $f) {
    $s = $src($f);
    cek($f . ': muatan H1 (harga acuan) diperiksa qi_sp_muat_layak',
        str_contains($s, 'qi_sp_muat_layak($simbol, $muat') || str_contains($s, 'qi_sp_muat_layak($symbol, $muat'));
    cek($f . ': timeframe basi tidak ikut konsensus', str_contains($s, 'ai_tf_dipakai($tfs)'));
}

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
