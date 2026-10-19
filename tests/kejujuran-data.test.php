<?php
/**
 * Uji Fase 1 "kejujuran data":
 *   · gap melewati SL/TP → keluar di harga pembukaan (evaluator resmi + penilai bayangan/Pine);
 *   · biaya spread (api/_biaya_spread.php): TP harus dicapai sisi penutup, SL lebih cepat kena,
 *     entry pasar membayar spread, R dihitung dari entry_efektif;
 *   · kunci bersama rekor JSON (api/_json_kunci.php);
 *   · pencarian ulang rekor saat evaluator menulis (rekor baru di tengah jalan tidak hilang);
 *   · baris tabel signal_records (api/_rekor_db.php), tanpa database.
 * Murni: tanpa jaringan/DB. Dijalankan oleh tests/kejujuran-data.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('Asia/Jakarta');   // hasil tidak boleh bergantung pada zona runtime
define('QI_SIGNAL_EVAL_LIB', true);
require __DIR__ . '/../api/_signal_time.php';
require __DIR__ . '/../api/signal-evaluator.php';
require __DIR__ . '/../api/_signal_stats.php';
require __DIR__ . '/../api/_setup_shadow.php';
require __DIR__ . '/../api/_rekor_db.php';

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
$c = fn(int $i, float $o, float $h, float $l, float $cl): array => ['time' => $t0 + 300 * $i, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $cl];

$beli = ['id' => 'SIG-T1', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 2000.0, 'sl' => 1990.0, 'tp' => 2025.0,
         'timestamp' => $iso($t0), 'expiry' => $iso($t0 + 4 * 3600)];
$jual = ['id' => 'SIG-T2', 'symbol' => 'XAUUSD', 'side' => 'SELL', 'entry' => 2000.0, 'sl' => 2010.0, 'tp' => 1975.0,
         'timestamp' => $iso($t0), 'expiry' => $iso($t0 + 4 * 3600)];
$kini = $t0 + 3600;

echo "Gap melewati level (evaluator resmi)\n";
$h = qi_sig_nilai_satu($beli, [$c(1, 2001, 2002, 1999, 2001), $c(2, 1985, 1987, 1984, 1986)], 300, $kini);
cek('BUY: candle dibuka di bawah SL → HIT SL di harga pembukaan 1985', ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['exit_price'] ?? null, 1985), $h);
cek('BUY gap SL: P/L −15 (bukan −10)', $dekat($h['pnl'] ?? null, -15), $h);
cek('R gap SL = −1,5 (lebih buruk dari −1R)', $dekat(qi_signal_r_satu($beli + $h)['r'], -1.5), qi_signal_r_satu($beli + $h));
$h = qi_sig_nilai_satu($jual, [$c(1, 2015, 2016, 2014, 2015)], 300, $kini);
cek('SELL: candle dibuka di atas SL → keluar di 2015', ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['exit_price'] ?? null, 2015), $h);
$h = qi_sig_nilai_satu($beli, [$c(1, 2030, 2031, 2029, 2030)], 300, $kini);
cek('BUY: gap melewati TP → keluar di pembukaan 2030', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2030), $h);
$h = qi_sig_nilai_satu($beli, [$c(1, 2001, 2026, 1995, 2020)], 300, $kini);
cek('tanpa gap: TP tepat di level, tanpa spread → tidak ada field biaya', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2025) && !isset($h['entry_efektif']), $h);

echo "Spread\n";
$t = qi_spread_tipikal('XAUUSD', 2000);
cek('XAUUSD: spread tabel 0,30', $dekat($t['spread'], 0.30) && $t['basis'] === 'tabel_tipikal', $t);
$t = qi_spread_tipikal('BTCUSDT', 60000);
cek('BTCUSDT: 0,10% harga = 60', $dekat($t['spread'], 60) && $t['basis'] === 'kripto_persen', $t);
$t = qi_spread_tipikal('ABCXYZ', 100);
cek('simbol tak dikenal: 0,02% harga, ditandai perkiraan', $dekat($t['spread'], 0.02) && $t['basis'] === 'perkiraan_umum', $t);
cek('feed MT5 = BID, sumber lain = MID', qi_spread_basis_candle('mt5') === 'bid' && qi_spread_basis_candle('oanda') === 'mid' && qi_spread_basis_candle('') === 'mid');

$bMid = qi_spread_pasang($beli, 'oanda');
cek('rekor dipasangi spread_biaya/spread_basis/harga_basis', $dekat($bMid['spread_biaya'], 0.30) && $bMid['spread_basis'] === 'tabel_tipikal' && $bMid['harga_basis'] === 'mid', $bMid);
$tetap = qi_spread_pasang($bMid + ['spread_biaya' => 0.5], 'mt5');
cek('spread yang sudah tercatat dipertahankan; basis mengikuti sumber', $dekat($tetap['spread_biaya'], 0.30) && $tetap['harga_basis'] === 'bid');

$sentuh = [$c(1, 2001, 2025.10, 1995, 2020)];
cek('tanpa spread: high 2025,10 = HIT TP', (qi_sig_nilai_satu($beli, $sentuh, 300, $kini)['status'] ?? '') === 'HIT TP 🎯');
cek('dengan spread (mid): BID tertinggi 2024,95 < TP → belum TP', qi_sig_nilai_satu($bMid, $sentuh, 300, $kini) === null);
$h = qi_sig_nilai_satu($bMid, [$c(1, 2001, 2025.20, 1995, 2020)], 300, $kini);
cek('BID 2025,05 ≥ TP → HIT TP di 2025', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2025), $h);
cek('slippage bawaan = 0,25 × spread = 0,075', $dekat($bMid['slippage_biaya'] ?? null, 0.075), $bMid);
cek('entry_efektif = ASK 2000,15 + slippage 0,075 = 2000,225; pnl bersih 24,775; pnl_kotor 25', $dekat($h['entry_efektif'] ?? null, 2000.225) && $dekat($h['pnl'] ?? null, 24.775) && $dekat($h['pnl_kotor'] ?? null, 25), $h);
$r = qi_signal_r_satu($bMid + $h);
cek('R bersih = (2025 − 2000,225) / 10 = 2,4775', $dekat($r['r'], 2.4775), $r);
$slDekat = [$c(1, 2001, 2002, 1990.10, 1995)];
cek('tanpa spread: low 1990,10 belum menyentuh SL', qi_sig_nilai_satu($beli, $slDekat, 300, $kini) === null);
cek('dengan spread: BID 1989,95 ≤ SL → HIT SL', (qi_sig_nilai_satu($bMid, $slDekat, 300, $kini)['status'] ?? '') === 'HIT SL 🛑');

$jBid = qi_spread_pasang($jual, 'mt5');   // candle BID: ASK = BID + 0,30
$h = qi_sig_nilai_satu($jBid, [$c(1, 1999, 2009.80, 1998, 2000)], 300, $kini);
cek('SELL, candle BID: ASK tertinggi 2010,10 ≥ SL → HIT SL; order stop terisi 2010 + slippage 0,075', ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['exit_price'] ?? null, 2010.075), $h);
cek('SELL masuk di BID − slippage: entry_efektif 1999,925, pnl −10,15', $dekat($h['entry_efektif'] ?? null, 1999.925) && $dekat($h['pnl'] ?? null, -10.15), $h);
$h = qi_sig_nilai_satu($jBid, [$c(1, 1999, 2000, 1975.10, 1980)], 300, $kini);
cek('SELL: BID 1975,10 → ASK 1975,40 > TP → belum TP', $h === null, $h);

echo "Penilai bayangan / Pine (order limit)\n";
$kk = ['ttl_pending_jam' => 12, 'maks_tahan_jam' => 48];
$lim = ['id' => 'SHD-T1', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 2000.0, 'sl' => 1990.0, 'tp' => 2030.0,
        'timestamp' => $iso($t0), 'status' => 'MENUNGGU'];
$h = qi_ss_nilai($lim, [$c(1, 2003, 2004, 1999, 2001), $c(2, 1985, 1986, 1984, 1985)], $kini, $kk);
cek('terisi lalu gap di bawah SL → keluar di 1985', ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['exit_price'] ?? null, 1985) && $dekat($h['pnl'] ?? null, -15), $h);
$h = qi_ss_nilai($lim, [$c(1, 2003, 2004, 1999, 2001), $c(2, 2035, 2036, 2034, 2035)], $kini, $kk);
cek('terisi lalu gap di atas TP → keluar di 2035', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2035), $h);
$nyaris = [$c(1, 2003, 2004, 1999.90, 2001)];
cek('tanpa spread: low 1999,90 mengisi limit 2000', (qi_ss_nilai($lim, $nyaris, $kini, $kk)['status'] ?? '') === 'AKTIF');
cek('dengan spread: ASK terendah 2000,05 → limit belum terisi', (qi_ss_nilai(qi_spread_pasang($lim, 'oanda'), $nyaris, $kini, $kk)['status'] ?? '') === 'MENUNGGU');
cek('konfigurasi bayangan & Pine: spread aktif bawaan', !empty(qi_ss_konfig()['spread']) && !empty(qi_pine_konfig_spread()));

echo "Kunci rekor JSON\n";
$dir = sys_get_temp_dir() . '/qi_kunci_' . bin2hex(random_bytes(4));
@mkdir($dir);
$f = $dir . '/rekor.json';
$tok = qi_kunci_ambil($f, 0.0);
cek('kunci pertama didapat', is_string($tok));
cek('kunci kedua gagal saat masih dipegang', qi_kunci_ambil($f, 0.1) === null);
$u = qi_json_ubah($f, fn(array $d) => array_merge($d, [1]), ['tunggu' => 0.1]);
cek('qi_json_ubah menolak (sedang_menulis) tanpa menulis', !$u['ok'] && $u['alasan'] === 'sedang_menulis' && !is_file($f), $u);
qi_kunci_lepas($f, 'token-orang-lain');
cek('lepas dengan token lain tidak menghapus kunci', is_file($f . '.lock'));
qi_kunci_lepas($f, $tok);
cek('lepas dengan token sendiri menghapus kunci', !is_file($f . '.lock'));
$u = qi_json_ubah($f, fn(array $d) => array_merge($d, ['a']));
cek('ubah → tulis → kunci dilepas', $u['ok'] && qi_json_baca($f) === ['a'] && !is_file($f . '.lock'), $u);
$u = qi_json_ubah($f, fn(array $d) => null);
cek('pengubah null = tanpa perubahan', $u['ok'] && $u['alasan'] === 'tanpa_perubahan');
file_put_contents($f . '.lock', 'mati');
touch($f . '.lock', time() - 60);
$tok = qi_kunci_ambil($f, 0.5, 20);
cek('kunci basi (> 20 dtk) diambil alih', is_string($tok));
qi_kunci_lepas($f, $tok);
try { qi_json_ubah($f, function () { throw new RuntimeException('x'); }); } catch (RuntimeException $e) {}
cek('kunci tetap dilepas walau pengubah melempar exception', !is_file($f . '.lock'));
array_map('unlink', glob($dir . '/*') ?: []); @rmdir($dir);

echo "Evaluator menulis ke isi berkas TERBARU\n";
$lama = [['id' => 'A', 'symbol' => 'XAUUSD', 'timestamp' => 't1', 'status' => 'AKTIF'], ['symbol' => 'EURUSD', 'timestamp' => 't0', 'status' => 'AKTIF']];
$baru = array_merge([['id' => 'BARU', 'symbol' => 'BTCUSDT', 'timestamp' => 't2', 'status' => 'AKTIF']], $lama);
cek('rekor ber-id ditemukan walau indeksnya bergeser', qi_sig_cari_rekor($baru, ['i' => 0, 'id' => 'A', 'symbol' => 'XAUUSD', 'timestamp' => 't1']) === 1);
cek('rekor lama tanpa id dicocokkan lewat simbol + waktu', qi_sig_cari_rekor($baru, ['i' => 1, 'id' => null, 'symbol' => 'EURUSD', 'timestamp' => 't0']) === 2);
cek('rekor yang sudah tidak ada → null (tidak menimpa rekor lain)', qi_sig_cari_rekor($baru, ['i' => 0, 'id' => 'HILANG', 'symbol' => 'XAUUSD', 'timestamp' => 't1']) === null);

echo "Baris tabel signal_records\n";
$rek = ['id' => 'SHD-1', 'symbol' => 'xauusd', 'side' => 'BUY', 'metode' => 'SMC', 'status' => 'HIT TP 🎯', 'entry' => 2000, 'sl' => 1990, 'tp' => 2025,
        'exit_price' => 2025, 'pnl' => 25, 'timestamp' => $iso($t0), 'filled_at' => $iso($t0 + 600), 'closed_at' => $iso($t0 + 7200), 'spread_biaya' => 0.3];
$b = qi_rekor_db_baris('shadow', $rek);
cek('kolom terisi; waktu epoch UTC; R dihitung', $b !== null && $b['symbol'] === 'XAUUSD' && $b['method'] === 'SMC' && $b['created_ts'] === $t0 && $b['closed_ts'] === $t0 + 7200 && $dekat($b['r_multiple'], 2.5), $b);
cek('data JSON utuh tersimpan', $b !== null && json_decode($b['data'], true)['id'] === 'SHD-1');
cek('rekor tanpa id/waktu ditolak', qi_rekor_db_baris('shadow', ['symbol' => 'X']) === null);
$pilih = qi_rekor_db_pilih([
    ['id' => '1', 'status' => 'AKTIF', 'timestamp' => $iso($t0 - 40 * 86400)],
    ['id' => '2', 'status' => 'HIT SL 🛑', 'timestamp' => $iso($t0 - 40 * 86400), 'closed_at' => $iso($t0 - 30 * 86400)],
    ['id' => '3', 'status' => 'HIT SL 🛑', 'timestamp' => $iso($t0 - 3 * 86400), 'closed_at' => $iso($t0 - 2 * 86400)],
], $t0);
cek('sinkron rutin: rekor terbuka + 7 hari terakhir saja', array_column($pilih, 'id') === ['1', '3'], array_column($pilih, 'id'));

function qi_pine_konfig_spread(): bool { require_once __DIR__ . '/../api/_pine_sinyal.php'; return !empty(qi_pine_konfig()['spread']); }

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
