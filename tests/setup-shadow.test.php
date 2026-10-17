<?php
/**
 * Uji sumber sinyal bayangan berbasis struktur (api/_setup_shadow.php): kunci korelasi, filter sesi,
 * penyaring setup, penilai ORDER LIMIT (konservatif), orkestrasi satu putaran, dan laporan.
 * Murni: tanpa jaringan/DB; candle dan waktu disuntikkan. Dijalankan oleh tests/setup-shadow.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('America/New_York');   // hasil tidak boleh bergantung pada zona runtime
require __DIR__ . '/../api/_setup_shadow.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$utc = fn(string $s): int => (new DateTimeImmutable($s, new DateTimeZone('UTC')))->getTimestamp();
$iso = fn(int $t): string => gmdate('Y-m-d\TH:i:s\Z', $t);
$k = qi_ss_konfig();

echo "Korelasi\n";
cek('EURUSD BUY = GBPUSD BUY = XAUUSD BUY = USD_LEMAH', qi_ss_kunci_korelasi('EURUSD', 'BUY') === 'USD_LEMAH' && qi_ss_kunci_korelasi('GBPUSD', 'BUY') === 'USD_LEMAH' && qi_ss_kunci_korelasi('XAUUSD', 'BUY') === 'USD_LEMAH');
cek('USDJPY SELL (USD melemah) sekelompok dengan EURUSD BUY', qi_ss_kunci_korelasi('USDJPY', 'SELL') === 'USD_LEMAH');
cek('XAUUSD SELL = EURUSD SELL = USDJPY BUY = USD_KUAT', qi_ss_kunci_korelasi('XAUUSD', 'SELL') === 'USD_KUAT' && qi_ss_kunci_korelasi('EURUSD', 'SELL') === 'USD_KUAT' && qi_ss_kunci_korelasi('USDJPY', 'BUY') === 'USD_KUAT');
cek('kripto searah satu kelompok, berlawanan arah tidak', qi_ss_kunci_korelasi('BTCUSDT', 'BUY') === qi_ss_kunci_korelasi('ETHUSDT', 'BUY') && qi_ss_kunci_korelasi('BTCUSDT', 'BUY') !== qi_ss_kunci_korelasi('BTCUSDT', 'SELL'));
$kini = $utc('2026-10-20 14:00:00');   // Selasa
$rek1 = [['kunci_korelasi' => 'USD_LEMAH', 'timestamp' => $iso($kini - 3600), 'status' => 'TIDAK TERISI']];
cek('rekor 1 jam lalu dengan kunci sama → diblokir', qi_ss_korelasi_diblokir($rek1, 'USD_LEMAH', $kini, 4) === true);
cek('kunci berbeda → tidak diblokir', qi_ss_korelasi_diblokir($rek1, 'USD_KUAT', $kini, 4) === false);
$rek2 = [['kunci_korelasi' => 'USD_LEMAH', 'timestamp' => $iso($kini - 5 * 3600), 'status' => 'HIT TP 🎯']];
cek('rekor 5 jam lalu yang sudah selesai → tidak diblokir', qi_ss_korelasi_diblokir($rek2, 'USD_LEMAH', $kini, 4) === false);
$rek3 = [['kunci_korelasi' => 'USD_LEMAH', 'timestamp' => $iso($kini - 30 * 3600), 'status' => 'AKTIF']];
cek('rekor lama yang masih terbuka → tetap memblokir', qi_ss_korelasi_diblokir($rek3, 'USD_LEMAH', $kini, 4) === true);

echo "Sesi\n";
$s = qi_ss_sesi_boleh('XAUUSD', $utc('2026-10-20 14:00:00'));
cek('Selasa 14:00 UTC: London + New York buka', $s['boleh'] && $s['sesi'] === 'LDN+NYC', $s);
$s = qi_ss_sesi_boleh('EURUSD', $utc('2026-10-20 10:00:00'));
cek('Selasa 10:00 UTC: hanya London', $s['boleh'] && $s['sesi'] === 'LDN', $s);
$s = qi_ss_sesi_boleh('EURUSD', $utc('2026-10-20 22:00:00'));
cek('Selasa 22:00 UTC: di luar sesi', !$s['boleh'] && $s['sesi'] === 'DI_LUAR_SESI', $s);
$s = qi_ss_sesi_boleh('XAUUSD', $utc('2026-10-17 14:00:00'));
cek('Sabtu: emas/forex tidak boleh', !$s['boleh'], $s);
$s = qi_ss_sesi_boleh('BTCUSDT', $utc('2026-10-17 14:00:00'));
cek('Sabtu: kripto tetap boleh (24 jam)', $s['boleh'] && $s['sesi'] === 'KRIPTO_24J', $s);

echo "Penyaring setup\n";
$setup = ['status' => 'MENUNGGU', 'arah' => 'BUY', 'entry' => 100.0, 'sl' => 99.0, 'tp' => 102.5, 'rr' => 2.5, 'metode' => 'SMC'];
cek('setup wajar lolos', qi_ss_saring($setup, 101.0, 1.0, 'BUY', $k)['ok'] === true);
cek('melawan bias H4 ditolak', qi_ss_saring($setup, 101.0, 1.0, 'SELL', $k)['alasan'] === 'melawan_bias_h4');
cek('bias H4 belum jelas (null) tidak menolak', qi_ss_saring($setup, 101.0, 1.0, null, $k)['ok'] === true);
cek('entry > 2,5×ATR dari harga ditolak', qi_ss_saring($setup, 103.0, 1.0, 'BUY', $k)['alasan'] === 'entry_terlalu_jauh');
cek('SL < 0,4×ATR (di dalam noise) ditolak', qi_ss_saring(['sl' => 99.8] + $setup, 100.5, 1.0, 'BUY', $k)['alasan'] === 'risiko_terlalu_kecil');
cek('SL > 3×ATR ditolak', qi_ss_saring(['sl' => 96.0] + $setup, 101.0, 1.0, 'BUY', $k)['alasan'] === 'risiko_terlalu_besar');
cek('setup yang sudah AKTIF bukan limit → ditolak', qi_ss_saring(['status' => 'AKTIF'] + $setup, 100.0, 1.0, 'BUY', $k)['alasan'] === 'bukan_limit_menunggu');
$pil = qi_ss_pilih_terbaik([
    ['metode' => 'SMC', 'arah' => 'BUY', 'entry' => 100.0, 'rr' => 2.1],
    ['metode' => 'ICT', 'arah' => 'BUY', 'entry' => 100.3, 'rr' => 2.0],
    ['metode' => 'FIBO', 'arah' => 'SELL', 'entry' => 105.0, 'rr' => 3.9],
], 1.0, $k);
cek('dua metode sepakat mengalahkan satu metode ber-R:R lebih tinggi', in_array($pil['metode'], ['SMC', 'ICT'], true) && count($pil['metode_sepakat']) === 2, $pil);

echo "Penilai order limit\n";
$T = $utc('2026-10-20 14:00:00');
$mk = fn(string $side) => ['id' => 'T', 'timestamp' => $iso($T), 'symbol' => 'XAUUSD', 'side' => $side, 'status' => 'MENUNGGU',
    'entry' => 100.0, 'sl' => $side === 'BUY' ? 99.0 : 101.0, 'tp' => $side === 'BUY' ? 102.5 : 97.5];
$cd = fn(int $dm, float $o, float $h, float $l, float $c) => ['time' => $T + $dm * 60, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $c];
$ev = fn(array $rek, array $c, ?int $kn = null) => qi_ss_nilai($rek, $c, $kn ?? ($T + 3600), $k);

$r = $ev($mk('BUY'), [$cd(15, 101, 101.5, 100.5, 101), $cd(30, 101, 101.4, 100.4, 101)]);
cek('harga tak menyentuh entry → tetap MENUNGGU', $r['status'] === 'MENUNGGU');
$r = $ev($mk('BUY'), [$cd(15, 101, 101.5, 100.5, 101)], $T + 13 * 3600);
cek('lewat 12 jam tanpa terisi → TIDAK TERISI', $r['status'] === 'TIDAK TERISI');
$r = $ev($mk('BUY'), [$cd(15, 101, 101.2, 99.9, 100.4), $cd(30, 100.4, 101, 100.2, 100.8), $cd(45, 100.8, 102.6, 100.7, 102.4)]);
$st = qi_signal_r_satu($r);
cek('terisi lalu TP → HIT TP dengan R = +2,5', strpos($r['status'], 'HIT TP') === 0 && $st['r'] === 2.5, [$r['status'], $st]);
$r = $ev($mk('BUY'), [$cd(15, 101, 101.2, 99.9, 100.4), $cd(30, 100.4, 100.6, 98.9, 99.2)]);
$st = qi_signal_r_satu($r);
cek('terisi lalu SL → HIT SL dengan R = −1', strpos($r['status'], 'HIT SL') === 0 && $st['r'] === -1.0, [$r['status'], $st]);
$r = $ev($mk('BUY'), [$cd(15, 101, 101.2, 98.8, 99.5)]);
cek('SL tersentuh di candle yang sama dengan pengisian → HIT SL', strpos($r['status'], 'HIT SL') === 0, $r['status']);
$r = $ev($mk('BUY'), [$cd(15, 101, 101.5, 100.5, 101), $cd(30, 101.2, 102.8, 101.1, 102.7)]);
cek('TP dilewati sebelum entry terisi → BATAL', $r['status'] === 'BATAL', $r['status']);
$r = $ev($mk('BUY'), [$cd(15, 100.6, 102.7, 99.9, 102.5)]);
cek('candle pengisian yang juga menyentuh TP: TP tidak dihitung (konservatif) → AKTIF', $r['status'] === 'AKTIF', $r['status']);
$r = $ev($mk('BUY'), [$cd(15, 100.6, 100.8, 99.9, 100.4), $cd(30, 100.4, 102.7, 98.9, 100.0)]);
cek('SL dan TP di candle yang sama → SL lebih dulu', strpos($r['status'], 'HIT SL') === 0, $r['status']);
$r = $ev($mk('BUY'), [['time' => $T, 'open' => 101, 'high' => 101.1, 'low' => 98.0, 'close' => 99], $cd(15, 101, 101.5, 100.5, 101)]);
cek('candle yang mulai pada waktu terbit diabaikan', $r['status'] === 'MENUNGGU', $r['status']);
$r = $ev($mk('SELL'), [$cd(15, 99, 100.1, 98.9, 99.6), $cd(30, 99.6, 99.9, 97.4, 97.8)]);
$st = qi_signal_r_satu($r);
cek('SELL limit terisi lalu TP → R = +2,5', strpos($r['status'], 'HIT TP') === 0 && $st['r'] === 2.5, [$r['status'], $st]);
$aktif = $ev($mk('BUY'), [$cd(15, 100.6, 100.8, 99.9, 100.4)]);
$r = $ev($aktif, [$cd(15 + 49 * 60, 100.4, 100.8, 100.1, 100.5)], $T + 51 * 3600);
cek('terisi > 48 jam tanpa TP/SL → EXPIRED', $r['status'] === 'EXPIRED', $r['status']);

echo "Satu putaran (orkestrasi)\n";
$W = 0.2;
$buat = function (array $langkah, float $mulai = 100.0) use ($W, $T): array {
    $c = []; $prev = $mulai; $t = $T - 700 * 3600;
    foreach ($langkah as $x) {
        if (is_array($x)) { [$o, $h, $l, $cl] = $x; } else { $o = $prev; $cl = (float)$x; $h = max($o, $cl) + $W; $l = min($o, $cl) - $W; }
        $c[] = ['time' => $t, 'open' => (float)$o, 'high' => (float)$h, 'low' => (float)$l, 'close' => (float)$cl]; $prev = $cl; $t += 3600;
    }
    return $c;
};
$datar = fn(int $n) => array_fill(0, $n, 100.0);
$jalurSmc = [...$datar(50), 101, 101.5, 102, 102.5, 103, 102.5, 102, 101.5, 101, 100.5, 100, 99.5, 99, 98.5, 98, 98.5, 99, 99.5, 100, 100.5, 101, 100.5, 100, 99.5, 99, 98.5, 98, 97.5, 97, 96.5, 96, 97.5, 99.5, 101.5, 103, 104, 105, 106, 105.5, 105, 104.5, 104, 103.5, 103.4];
$h1 = $buat($jalurSmc);
$muat = fn(string $sim, string $iv): array => ['candles' => $iv === '60' ? $h1 : [], 'simulated' => false];
$dir = sys_get_temp_dir() . '/qim-shadow-' . getmypid(); @mkdir($dir);
$longgar = ['simbol' => ['XAUUSD', 'EURUSD', 'BTCUSDT', 'ETHUSDT'], 'jarak_maks_atr' => 50.0, 'risiko_maks_atr' => 50.0];
$r = qi_ss_jalankan(['muat' => $muat, 'kini' => $T, 'dir' => $dir, 'konfig' => $longgar]);
$rekor = json_decode((string)file_get_contents($dir . '/signal_shadow.json'), true);
$state = json_decode((string)file_get_contents($dir . '/signal_shadow_state.json'), true);
$sim = array_column($rekor, 'symbol'); sort($sim);
cek('2 setup diterbitkan: satu USD (XAUUSD) dan satu kripto (BTCUSDT)', $r['dibuat'] === 2 && $sim === ['BTCUSDT', 'XAUUSD'], [$r['dibuat'], $sim, $r['rincian']]);
cek('EURUSD (USD searah dengan XAUUSD) ditolak korelasi, ETHUSDT (searah BTC) juga', ($state['penolakan']['korelasi'] ?? 0) === 2, $state['penolakan']);
$a = $rekor[0];
cek('rekor berstatus MENUNGGU, bertanda bayangan, entry limit di struktur', $a['status'] === 'MENUNGGU' && $a['shadow'] === true && $a['sumber'] === 'setup_shadow' && $a['side'] === 'BUY' && abs($a['entry'] - 96.7) < 1e-6, $a);
cek('rekor memuat kunci korelasi, sesi, metode, zona, alasan', !empty($a['kunci_korelasi']) && !empty($a['sesi']) && !empty($a['metode']) && !empty($a['zona']) && count($a['alasan']) >= 3);
$r2 = qi_ss_jalankan(['muat' => $muat, 'kini' => $T + 900, 'dir' => $dir, 'konfig' => $longgar]);
cek('putaran berikutnya tidak menumpuk (sudah ada order terbuka)', $r2['dibuat'] === 0, $r2['rincian']);

$a = null; foreach ($rekor as $x) if ($x['symbol'] === 'XAUUSD') $a = $x;
$tAwal = qi_sig_epoch($a['timestamp']);
$m15 = [
    ['time' => $tAwal + 900, 'open' => 99.0, 'high' => 99.2, 'low' => 96.5, 'close' => 97.0],
    ['time' => $tAwal + 1800, 'open' => 97.0, 'high' => 107.0, 'low' => 96.9, 'close' => 106.5],
];
$muat2 = fn(string $sim, string $iv): array => ['candles' => $iv === '15' ? $m15 : [], 'simulated' => false];
$r3 = qi_ss_jalankan(['muat' => $muat2, 'kini' => $tAwal + 7200, 'dir' => $dir, 'konfig' => $longgar]);
$rekor = json_decode((string)file_get_contents($dir . '/signal_shadow.json'), true);
$xau = null; foreach ($rekor as $x) if ($x['symbol'] === 'XAUUSD') $xau = $x;
cek('putaran berikutnya menilai order: terisi lalu HIT TP', strpos($xau['status'], 'HIT TP') === 0 && !empty($xau['filled_at']), $xau['status']);
cek('perubahan status dilaporkan', count($r3['diperbarui']) >= 1, $r3['diperbarui']);

@unlink($dir . '/signal_shadow.json'); @unlink($dir . '/signal_shadow_state.json');
$r = qi_ss_jalankan(['muat' => $muat, 'kini' => $T, 'dir' => $dir, 'konfig' => $longgar, 'berita' => ['aktif' => true]]);
$rekorB = is_file($dir . '/signal_shadow.json') ? json_decode((string)file_get_contents($dir . '/signal_shadow.json'), true) : [];
cek('berita High impact → tidak ada sinyal', $r['dibuat'] === 0 && count($rekorB) === 0);
@unlink($dir . '/signal_shadow.json'); @unlink($dir . '/signal_shadow_state.json');
$sabtu = $utc('2026-10-17 14:00:00');
$r = qi_ss_jalankan(['muat' => $muat, 'kini' => $sabtu, 'dir' => $dir, 'konfig' => $longgar]);
$rekor = json_decode((string)file_get_contents($dir . '/signal_shadow.json'), true);
cek('Sabtu: emas/forex tidak terbit, kripto tetap terbit (satu, korelasi)', $r['dibuat'] === 1 && ($rekor[0]['symbol'] ?? '') === 'BTCUSDT', [$r['dibuat'], array_column($rekor, 'symbol')]);
$datarMuat = fn(string $sim, string $iv): array => ['candles' => $buat($datar(90)), 'simulated' => false];
@unlink($dir . '/signal_shadow.json'); @unlink($dir . '/signal_shadow_state.json');
$r = qi_ss_jalankan(['muat' => $datarMuat, 'kini' => $T, 'dir' => $dir, 'konfig' => $longgar]);
cek('pasar datar: tidak ada setup → tidak ada sinyal (tidak memaksa)', $r['dibuat'] === 0);
$simMuat = fn(string $sim, string $iv): array => ['candles' => $h1, 'simulated' => true];
@unlink($dir . '/signal_shadow.json'); @unlink($dir . '/signal_shadow_state.json');
$r = qi_ss_jalankan(['muat' => $simMuat, 'kini' => $T, 'dir' => $dir, 'konfig' => $longgar]);
cek('data simulasi ditolak', $r['dibuat'] === 0);

echo "Laporan\n";
$resolved = [];
foreach ([['TP', 'SMC', 'LDN'], ['SL', 'SMC', 'LDN'], ['SL', 'ICT', 'NYC'], ['TP', 'FIBO', 'LDN']] as $i => [$h, $m, $se]) {
    $resolved[] = ['id' => "R$i", 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 100.0, 'sl' => 99.0, 'tp' => 102.0, 'rr' => '1 : 2.00', 'metode' => $m, 'sesi' => $se,
        'status' => $h === 'TP' ? 'HIT TP 🎯' : 'HIT SL 🛑', 'exit_price' => $h === 'TP' ? 102.0 : 99.0, 'filled_at' => '2026-10-20T10:00:00Z'];
}
$resolved[] = ['id' => 'X', 'symbol' => 'EURUSD', 'side' => 'BUY', 'status' => 'TIDAK TERISI'];
$resolved[] = ['id' => 'Y', 'symbol' => 'EURUSD', 'side' => 'BUY', 'status' => 'MENUNGGU'];
$lap = qi_ss_laporan($resolved, []);
cek('laporan: 4 sinyal tertutup, 2 menang, win rate 50%', $lap['bayangan']['statistik']['dinilai'] === 4 && $lap['bayangan']['statistik']['menang'] === 2 && $lap['bayangan']['statistik']['win_rate'] == 50.0, $lap['bayangan']['statistik']);
cek('laporan: expectancy = (2×2 − 2×1)/4 = +0,5R', abs((float)$lap['bayangan']['statistik']['expectancy_r'] - 0.5) < 1e-9, $lap['bayangan']['statistik']['expectancy_r']);
cek('laporan: tingkat pengisian = 4 terisi / 5 diputuskan = 80%', $lap['bayangan']['tingkat_isi_pct'] == 80.0, $lap['bayangan']['tingkat_isi_pct']);
cek('laporan: sampel kecil → belum siap dinilai', $lap['siap_dinilai'] === false && strpos($lap['catatan'], '100') !== false);
$perM = array_column($lap['bayangan']['per_metode'], null, 'nama');
cek('laporan: rincian per metode (SMC 2 sinyal 1 menang)', ($perM['SMC']['dinilai'] ?? 0) === 2 && ($perM['SMC']['menang'] ?? 0) === 1, $perM);

foreach (glob($dir . '/*') ?: [] as $f) @unlink($f);
@rmdir($dir);
if ($gagal) { echo "\nFAIL — $gagal pemeriksaan gagal\n"; exit(1); }
echo "\nPASS — sinyal bayangan berbasis struktur: filter, penilai limit, orkestrasi, laporan\n";
