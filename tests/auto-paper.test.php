<?php
/**
 * Uji "Ikuti Auto Analisa" (api/_auto_paper.php): ukuran lot dari risiko, pemilihan sinyal yang dibuka,
 * dan penutupan posisi simulasi mengikuti hasil sinyal (SL → saldo berkurang, TP → bertambah).
 * Fungsi-fungsi ini murni (tanpa DB). Dijalankan oleh tests/auto-paper.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('America/New_York');
require __DIR__ . '/../api/_auto_paper.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$dekat = fn(float $a, float $b, float $eps = 0.011): bool => abs($a - $b) <= $eps;
$k = qi_ap_konfig();
$kini = (new DateTimeImmutable('2026-10-20 14:00:00', new DateTimeZone('UTC')))->getTimestamp();
$iso = fn(int $t): string => gmdate('Y-m-d\TH:i:s\Z', $t);

echo "Ukuran lot dari risiko\n";
$l = qi_ap_lot('XAUUSD', 4084.76, 4106.29, 10000, 1.0);
cek('emas: SL 21,53 poin, risiko 1% ($100) → 0,04 lot, risiko nyata $86,12', $l['lots'] === 0.04 && $dekat($l['risiko_usd'], 86.12), $l);
$l = qi_ap_lot('EURUSD', 1.11397, 1.11580, 10000, 1.0);
cek('EURUSD: SL 18,3 pip → 0,54 lot, risiko ≈ $98,82', $l['lots'] === 0.54 && $dekat($l['risiko_usd'], 98.82, 0.05), $l);
$l = qi_ap_lot('BTCUSDT', 83598.0, 82904.13, 10000, 1.0);
cek('BTC: jarak SL 693,87 → 0,14 lot, risiko ≈ $97,14', $l['lots'] === 0.14 && $dekat($l['risiko_usd'], 97.14, 0.05), $l);
$l = qi_ap_lot('USDJPY', 150.0, 150.5, 10000, 1.0);
cek('USDJPY: dikonversi ke USD (100.000/harga) → 0,30 lot', $l['lots'] === 0.30, $l);
$l = qi_ap_lot('XAUUSD', 4084.76, 4106.29, 100, 1.0);
cek('saldo kecil: lot minimum berisiko > 2× target → tidak dibuka', $l['lots'] === 0.0 && $l['alasan'] === 'lot_minimum_melebihi_risiko', $l);
$l = qi_ap_lot('XAUUSD', 4000.0, 4000.0, 10000, 1.0);
cek('entry = SL → tidak valid', $l['lots'] === 0.0);
$l = qi_ap_lot('EURUSD', 1.1, 1.0999, 10_000_000, 5.0);
cek('lot dibatasi maksimum 100', $l['lots'] === 100.0, $l);
$a = qi_ap_lot('XAUUSD', 4084.76, 4106.29, 10000, 0.5); $b = qi_ap_lot('XAUUSD', 4084.76, 4106.29, 10000, 2.0);
cek('risiko lebih besar → lot lebih besar', $b['lots'] > $a['lots'], [$a['lots'], $b['lots']]);

echo "Sinyal yang dibuka\n";
$sig = fn(string $id, string $sim, string $side, float $entry, float $sl, float $tp, int $t, array $lain = []) => $lain + [
    'id' => $id, 'timestamp' => $iso($t), 'symbol' => $sim, 'side' => $side, 'entry' => $entry, 'sl' => $sl, 'tp' => $tp,
    'status' => 'AKTIF', 'sumber' => 'auto_generator', 'engine' => 'AUTO_SIGNAL'];
$p = ['aktif_sejak' => $kini - 7200, 'risiko' => 1.0];
$riwayat = [
    $sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 600),
    $sig('S-EUR', 'EURUSD', 'SELL', 1.11397, 1.11580, 1.10939, $kini - 500),
    $sig('S-LAMA', 'GBPUSD', 'SELL', 1.32, 1.3217, 1.2975, $kini - 10800),           // sebelum fitur dinyalakan
    $sig('S-USANG', 'USDJPY', 'BUY', 150.0, 149.5, 151.25, $kini - 3700),            // setelah dinyalakan, tapi > 60 menit
    $sig('S-WEBHOOK', 'BTCUSDT', 'BUY', 83000, 82000, 85500, $kini - 100, ['sumber' => 'tradingview']),
    $sig('S-SELESAI', 'ETHUSDT', 'BUY', 2500, 2490, 2525, $kini - 300, ['status' => 'HIT SL 🛑']),
    $sig('S-ADA', 'SOLUSDT', 'BUY', 110.0, 109.0, 112.5, $kini - 200),
    $sig('S-RUSAK', 'BNBUSDT', 'BUY', 700, 710, 720, $kini - 150),                   // SL di atas entry untuk BUY
];
$r = qi_ap_pilih_buka($p, $riwayat, ['S-ADA' => true], [], 10000.0, $kini, $k);
$ids = array_column($r['buka'], 'signal_id');
cek('hanya sinyal Auto Analisa yang baru, segar, dan AKTIF yang dibuka (XAU, EUR)', $ids === ['S-XAU', 'S-EUR'], $ids);
$alasan = array_column($r['lewat'], 'alasan', 'id');
cek('sinyal terlalu lama dilewati ("terlambat")', ($alasan['S-USANG'] ?? '') === 'terlambat', $alasan);
cek('level tidak konsisten dilewati', ($alasan['S-RUSAK'] ?? '') === 'level_tidak_konsisten', $alasan);
cek('sinyal sebelum fitur dinyalakan, sinyal webhook, dan yang sudah selesai tidak disentuh', !isset($alasan['S-LAMA']) && !in_array('S-LAMA', $ids, true) && !in_array('S-WEBHOOK', $ids, true) && !in_array('S-SELESAI', $ids, true));
cek('sinyal yang sudah diikuti tidak dibuka lagi', !in_array('S-ADA', $ids, true));
$xau = $r['buka'][0];
cek('posisi emas: level sama persis dengan sinyal, lot 0,04, risiko ≈ 0,86% saldo', $xau['entry'] === 4084.76 && $xau['sl'] === 4106.29 && $xau['tp'] === 4030.93 && $xau['lots'] === 0.04, $xau);

$r = qi_ap_pilih_buka($p, [$sig('A', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 400), $sig('B', 'XAUUSD', 'BUY', 4000, 3980, 4050, $kini - 300)], [], [], 10000.0, $kini, $k);
cek('satu simbol: hanya satu posisi terbuka sekaligus (yang tertua)', array_column($r['buka'], 'signal_id') === ['A'] && ($r['lewat'][0]['alasan'] ?? '') === 'simbol_sudah_punya_posisi', $r);
$r = qi_ap_pilih_buka($p, [$sig('A', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 400)], [], ['XAUUSD'], 10000.0, $kini, $k);
cek('simbol yang sudah punya posisi auto terbuka dilewati', !$r['buka'], $r);
$banyak = [];
foreach (['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as $i => $sim) {
    $e = in_array($sim, ['XAUUSD'], true) ? 4084.76 : (str_contains($sim, 'USD') && !str_contains($sim, 'T') ? 1.1 : 100.0);
    $banyak[] = $sig("M$i", $sim, 'SELL', $e, $e * 1.005, $e * 0.9875, $kini - 500 + $i);
}
$r = qi_ap_pilih_buka($p, $banyak, [], [], 10000.0, $kini, $k);
cek('maksimal 5 posisi terbuka sekaligus', count($r['buka']) === 5 && ($r['lewat'][0]['alasan'] ?? '') === 'batas_posisi_terbuka', [count($r['buka']), $r['lewat']]);
$r = qi_ap_pilih_buka($p, [$sig('K', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 400)], [], [], 1000.0, $kini, $k);
cek('lot mengikuti saldo: saldo $1.000 → lot minimum berisiko terlalu besar → dilewati', !$r['buka'] && ($r['lewat'][0]['alasan'] ?? '') === 'lot_minimum_melebihi_risiko', $r);

echo "Penutupan mengikuti sinyal: saldo berkurang / bertambah\n";
$pos = fn(string $sid, int $pid, string $sim, string $side, float $entry, float $lots) => ['signal_id' => $sid, 'position_id' => $pid, 'symbol' => $sim, 'side' => $side, 'entry' => $entry, 'lots' => $lots, 'dibuat_ts' => $kini - 3600];
$tertaut = [$pos('S-XAU', 11, 'XAUUSD', 'SELL', 4084.76, 0.04)];
$perId = fn(array $s) => [$s['id'] => $s];
$sl = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600, ['status' => 'HIT SL 🛑', 'closed_at' => $iso($kini - 60)])), null, $kini, $k);
cek('HIT SL: ditutup di harga SL, saldo BERKURANG −$86,12', count($sl) === 1 && $sl[0]['status'] === 'closed' && $sl[0]['exit'] === 4106.29 && $dekat($sl[0]['pnl'], -86.12) && $sl[0]['alasan'] === 'SL', $sl);
$tp = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600, ['status' => 'HIT TP 🎯', 'closed_at' => $iso($kini - 60)])), null, $kini, $k);
cek('HIT TP: ditutup di harga TP, saldo BERTAMBAH +$215,32', $tp[0]['exit'] === 4030.93 && $dekat($tp[0]['pnl'], 215.32) && $tp[0]['alasan'] === 'TP', $tp);
cek('R:R sinyal tercermin: TP = 2,5 × kerugian SL', $dekat(abs($tp[0]['pnl'] / $sl[0]['pnl']), 2.5, 0.01), [$tp[0]['pnl'], $sl[0]['pnl']]);
cek('waktu tutup mengikuti waktu sinyal dinilai', $tp[0]['closed_ts'] === $kini - 60);
$none = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600)), null, $kini, $k);
cek('sinyal masih AKTIF → posisi tetap terbuka', $none === []);
// Harga keluar = exit_price yang DICATAT penilai (audit sinyal 2026-10-22). Dulu selalu tepat di
// level SL, jadi SL yang di-gap tercatat lebih ringan di akun simulasi daripada di rekor sinyal.
$gapSl = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
    ['status' => 'HIT SL 🛑', 'exit_price' => 4115.0, 'gap' => true, 'closed_at' => $iso($kini - 60)])), null, $kini, $k);
cek('HIT SL karena gap: ditutup di exit_price penilai 4115 (bukan SL 4106,29), rugi lebih dari 1R', $gapSl[0]['exit'] === 4115.0 && $dekat($gapSl[0]['pnl'], -(4115.0 - 4084.76) * 0.04 * 100) && $gapSl[0]['pnl'] < $sl[0]['pnl'], $gapSl);
$tpBid = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
    ['status' => 'HIT TP 🎯', 'exit_price' => 4030.93, 'closed_at' => $iso($kini - 60)])), null, $kini, $k);
cek('HIT TP dengan exit_price: dipakai apa adanya', $tpBid[0]['exit'] === 4030.93 && $dekat($tpBid[0]['pnl'], 215.32), $tpBid);
$rusak = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
    ['status' => 'HIT SL 🛑', 'exit_price' => null, 'closed_at' => $iso($kini - 60)])), null, $kini, $k);
cek('rekor lama tanpa exit_price: jatuh ke level SL', $rusak[0]['exit'] === 4106.29, $rusak);

// EXPIRED: hanya basis 'candle' yang punya harga, dan harganya PADA saat kedaluwarsa.
$tExp = $kini - 1800;
$diminta = [];
$hargaPada = function (string $s, int $pada) use (&$diminta, $tExp): ?float { $diminta[] = $pada; return $pada === $tExp ? 4070.0 : null; };
$ex = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
    ['status' => 'EXPIRED', 'expiry_basis' => 'candle', 'closed_at' => $iso($tExp)])), $hargaPada, $kini, $k);
cek('EXPIRED (candle): harga DIMINTA pada waktu kedaluwarsa, bukan harga terakhir', $diminta === [$tExp], $diminta);
cek('EXPIRED (candle): ditutup di harga saat kedaluwarsa, waktu tutup = expiry (P/L sesuai selisih nyata)', $ex[0]['status'] === 'closed' && $ex[0]['exit'] === 4070.0 && $ex[0]['closed_ts'] === $tExp && $dekat($ex[0]['pnl'], (4084.76 - 4070.0) * 0.04 * 100) && $ex[0]['alasan'] === 'EXPIRED', $ex);
$ex2 = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
    ['status' => 'EXPIRED', 'expiry_basis' => 'candle', 'closed_at' => $iso($tExp)])), fn($s, $p) => null, $kini, $k);
cek('EXPIRED (candle) tanpa harga saat itu: dibatalkan tanpa P/L (tidak mengarang angka)', $ex2[0]['status'] === 'cancelled' && $ex2[0]['pnl'] === 0.0 && $ex2[0]['alasan'] === 'EXPIRED_tanpa_harga', $ex2);
foreach (['tanpa_data', 'zona_ambigu', 'entry_tak_terisi'] as $basis) {
    $exB = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
        ['status' => 'EXPIRED', 'expiry_basis' => $basis, 'closed_at' => $iso($tExp)])), fn($s, $p) => 4000.0, $kini, $k);
    cek("EXPIRED '$basis': dibatalkan walau harga tersedia (hasil tidak terverifikasi)", $exB[0]['status'] === 'cancelled' && $exB[0]['pnl'] === 0.0 && $exB[0]['alasan'] === 'EXPIRED_' . $basis, $exB);
}
$exN = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600,
    ['status' => 'EXPIRED', 'expiry_basis' => 'candle', 'closed_at' => $iso($tExp)])), null, $kini, $k);
cek('EXPIRED (candle) tanpa sumber harga (api/auto-paper.php): posisi dibiarkan untuk penilai, tidak dibatalkan', $exN === [], $exN);
$exT = qi_ap_pilih_tutup($tertaut, $perId($sig('S-XAU', 'XAUUSD', 'SELL', 4084.76, 4106.29, 4030.93, $kini - 3600, ['status' => 'EXPIRED'])), fn($s, $p) => 4000.0, $kini, $k);
cek('EXPIRED tanpa expiry_basis (rekor lama/manual): dibatalkan, tidak ditandai ke harga apa pun', $exT[0]['status'] === 'cancelled' && $exT[0]['alasan'] === 'EXPIRED_tidak_terverifikasi', $exT);

echo "Harga pada saat kedaluwarsa (qi_ap_harga_pada)\n";
$c5 = fn(int $t, float $cl) => ['time' => $t, 'open' => $cl, 'high' => $cl + 1, 'low' => $cl - 1, 'close' => $cl];
$pada = 1792500000;   // kelipatan 300 detik
$deret = [$c5($pada - 900, 10.0), $c5($pada - 600, 11.0), $c5($pada - 300, 12.0), $c5($pada, 13.0), $c5($pada + 300, 14.0)];
cek('close candle terakhir yang SUDAH TUTUP sebelum expiry (12, bukan 13/14 sesudahnya)', qi_ap_harga_pada($deret, 300, $pada) === 12.0, qi_ap_harga_pada($deret, 300, $pada));
cek('urutan candle tidak berpengaruh', qi_ap_harga_pada(array_reverse($deret), 300, $pada) === 12.0);
cek('candle terdekat > 2 batang sebelum expiry → null (basi, tidak ditebak)', qi_ap_harga_pada([$c5($pada - 3600, 9.0)], 300, $pada) === null);
cek('tepat 2 batang sebelum expiry masih diterima', qi_ap_harga_pada([$c5($pada - 900, 9.0)], 300, $pada) === 9.0);
cek('tanpa candle sebelum expiry → null', qi_ap_harga_pada([$c5($pada + 300, 14.0)], 300, $pada) === null);

// Audit ulang 2026-10-22: sinyal XAUUSD 12 jam yang terbit Jumat 14:00 UTC kedaluwarsa Sabtu 02:00.
// Candle terakhir Jumat 20:55 (pasar tutup 21:00) dulu dianggap "> 2 batang lebih tua" → harga null →
// posisi auto-paper DIBATALKAN dan P/L nyatanya terhapus setiap pekan. Jam pasar tutup bukan umur data.
$jumat = (new DateTimeImmutable('2026-10-23 14:00:00', new DateTimeZone('UTC')))->getTimestamp();
$expSabtu = $jumat + 12 * 3600;
foreach ([300, 900, 3600] as $d) {
    $deretJumat = [];
    for ($t = $jumat - 50 * $d; $t + $d <= $jumat + 7 * 3600; $t += $d) $deretJumat[] = ['time' => $t, 'open' => 4100.0, 'high' => 4101.0, 'low' => 4089.0, 'close' => 4090.0];
    cek("XAUUSD expiry Sabtu, candle {$d} detik: harga = close Jumat 4090 (dulu null)", qi_ap_harga_pada($deretJumat, $d, $expSabtu, 'XAUUSD') === 4090.0);
    $feedMati = array_values(array_filter($deretJumat, fn($c) => $c['time'] + $d <= $jumat + 4 * 3600));
    cek("feed berhenti 3 jam SEBELUM pasar tutup (candle {$d} detik) → tetap null (basi saat pasar buka)", qi_ap_harga_pada($feedMati, $d, $expSabtu, 'XAUUSD') === null);
}
cek('kripto (24/7): candle Jumat untuk expiry Sabtu tetap basi → null', qi_ap_harga_pada($deretJumat, 3600, $expSabtu, 'BTCUSDT') === null);
$sigJumat = $sig('S-JUM', 'XAUUSD', 'BUY', 4130.0, 4112.0, 4175.0, $jumat, ['status' => 'EXPIRED', 'expiry_basis' => 'candle', 'closed_at' => $iso($expSabtu)]);
$tautJumat = [['signal_id' => 'S-JUM', 'position_id' => 7, 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 4130.0, 'lots' => 0.1, 'dibuat_ts' => $jumat]];
$tutupJumat = qi_ap_pilih_tutup($tautJumat, $perId($sigJumat), fn(string $s, int $p) => qi_ap_harga_pada($deretJumat, 3600, $p, $s), $expSabtu + 86400, $k);
cek('posisi ditutup di close Jumat dengan P/L nyata (dulu "EXPIRED_tanpa_harga", P/L 0)', ($tutupJumat[0]['status'] ?? '') === 'closed' && ($tutupJumat[0]['exit'] ?? null) === 4090.0
    && abs((float)$tutupJumat[0]['pnl'] - qi_paper_pnl('XAUUSD', 'BUY', 4130.0, 4090.0, 0.1)) < 1e-9 && (float)$tutupJumat[0]['pnl'] < 0, $tutupJumat);
$hilangBaru = qi_ap_pilih_tutup($tertaut, [], null, $kini, $k);
cek('sinyal hilang dari riwayat tetapi baru 1 jam → ditunggu', $hilangBaru === []);
$lamaTertaut = [['dibuat_ts' => $kini - 80 * 3600] + $tertaut[0]];
$hilangLama = qi_ap_pilih_tutup($lamaTertaut, [], null, $kini, $k);
cek('sinyal hilang > 72 jam → posisi dibatalkan', $hilangLama[0]['status'] === 'cancelled');

echo "Skenario saldo\n";
$saldo = 10000.0;
$hasil = [];
foreach ([['SELL', 'XAUUSD', 4084.76, 4106.29, 4030.93, 'SL'], ['SELL', 'EURUSD', 1.11397, 1.11580, 1.10939, 'SL'], ['SELL', 'XAUUSD', 4156.36, 4167.82, 4127.71, 'TP']] as [$side, $sim, $e, $slh, $tph, $res]) {
    $lot = qi_ap_lot($sim, $e, $slh, $saldo, 1.0);
    $keluar = $res === 'TP' ? $tph : $slh;
    $pnl = qi_paper_pnl($sim, $side, $e, $keluar, $lot['lots']);
    $saldo = round($saldo + $pnl, 2);
    $hasil[] = [$sim, $res, $lot['lots'], $pnl, $saldo];
}
cek('urutan SL, SL, TP: saldo turun dua kali lalu naik; hasil akhir sesuai jumlah', $hasil[0][3] < 0 && $hasil[1][3] < 0 && $hasil[2][3] > 0 && $dekat($saldo, 10000 + array_sum(array_column($hasil, 3)), 0.02), $hasil);
cek('lot sinyal ke-3 dihitung dari SALDO TERBARU (bukan saldo awal)', $hasil[2][2] === qi_ap_lot('XAUUSD', 4156.36, 4167.82, 10000 + $hasil[0][3] + $hasil[1][3], 1.0)['lots'], $hasil);

if ($gagal) { echo "\nFAIL — $gagal pemeriksaan gagal\n"; exit(1); }
echo "\nPASS — Ikuti Auto Analisa: lot dari risiko, pemilihan sinyal, saldo naik/turun sesuai TP/SL\n";
