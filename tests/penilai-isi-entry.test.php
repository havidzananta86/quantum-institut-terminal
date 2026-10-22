<?php
/**
 * Penilai sinyal v4 (audit sinyal 2026-10-22):
 *   · aturan 12 — entry WAJIB bisa terisi: reproduksi audit BUY 2650 / TP 2680 / SL 2630 saat
 *     pasar 2700 dulu tercatat "HIT TP" +2,5R di harga gap pembukaan;
 *   · qi_sig_nilai_rekor menyimpan MAE/MFE, hit_price, ukuran wick, closed_back, gap (dulu dibuang);
 *   · api/_sl_learn.php: gap → 'gap_melewati_sl', penutupan tak diketahui → 'perlu_data_harga'
 *     (dulu "sapuan_likuiditas").
 * Memakai simbol rekaan ZZG3AUJI di cache/chart dan menghapusnya lagi. Tanpa jaringan/DB.
 * Dijalankan oleh tests/penilai-isi-entry.test.js.
 */
declare(strict_types=1);
define('QI_SIGNAL_EVAL_LIB', true);
require __DIR__ . '/../api/_middleware.php';
require __DIR__ . '/../api/signal-evaluator.php';
require __DIR__ . '/../api/_signal_stats.php';
require __DIR__ . '/../api/_sl_learn.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$dekat = fn($a, $b, float $eps = 1e-6): bool => is_numeric($a) && abs((float)$a - (float)$b) < $eps;
$t0 = (new DateTimeImmutable('2026-10-20 08:02:00', new DateTimeZone('UTC')))->getTimestamp();   // Selasa
$iso = fn(int $t): string => gmdate('Y-m-d\TH:i:s\Z', $t);
$m5 = intdiv($t0, 300) * 300;   // candle 5 menit tempat sinyal terbit (08:00)
$c = fn(int $i, float $o, float $h, float $l, float $cl): array => ['time' => $m5 + 300 * $i, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $cl];
$datar = fn(int $dari, int $sampai, float $p): array => array_map(fn($i) => ['time' => $m5 + 300 * $i, 'open' => $p, 'high' => $p + 1, 'low' => $p - 1, 'close' => $p], range($dari, $sampai));
$beli = ['id' => 'SIG-AUDIT', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 2650.0, 'tp' => 2680.0, 'sl' => 2630.0,
         'timestamp' => $iso($t0), 'expiry' => $iso($t0 + 4 * 3600)];
$selamaJendela = $t0 + 3600;
$sesudahExpiry = $t0 + 5 * 3600;

echo "Reproduksi audit: entry 2650 saat pasar 2700\n";
$pasar2700 = $datar(0, 60, 2700.0);   // candle saat terbit + sesudahnya, semuanya di 2700
$h = qi_sig_nilai_satu($beli, $pasar2700, 300, $selamaJendela);
cek('TIDAK lagi "HIT TP di 2700 (+2,5R)" — belum ada keputusan selama jendela', $h === null, $h);
$h = qi_sig_nilai_satu($beli, $pasar2700, 300, $sesudahExpiry);
cek('sesudah expiry: EXPIRED "entry_tak_terisi" (bukan menang/kalah)', ($h['status'] ?? '') === 'EXPIRED' && ($h['expiry_basis'] ?? '') === 'entry_tak_terisi' && ($h['isi_entry'] ?? '') === 'sentuh', $h);
cek('P/L nol, tanpa harga keluar', $dekat($h['pnl'] ?? null, 0.0) && array_key_exists('exit_price', $h) && $h['exit_price'] === null, $h);
$pasar2600 = $datar(0, 60, 2600.0);
$h = qi_sig_nilai_satu($beli, $pasar2600, 300, $selamaJendela);
cek('cermin: pasar 2600 (di bawah SL) → bukan "HIT SL instan"', $h === null, $h);

echo "Entry tersentuh kemudian (mode sentuh)\n";
$turunLaluNaik = array_merge($datar(0, 3, 2700.0), [$c(4, 2700, 2701, 2648, 2655), $c(5, 2655, 2681, 2654, 2679)]);
$h = qi_sig_nilai_satu($beli, $turunLaluNaik, 300, $selamaJendela);
cek('terisi saat candle menyentuh 2650, lalu HIT TP di 2680 (bukan di gap)', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2680.0) && ($h['isi_entry'] ?? '') === 'sentuh', $h);
cek('filled_at = waktu candle pengisian', ($h['filled_at'] ?? '') === $iso($m5 + 1200), $h);
cek('P/L dari entry 2650: +30 (1,5R sesuai rencana)', $dekat($h['pnl'] ?? null, 30.0), $h);
$isiDanSl = array_merge($datar(0, 3, 2700.0), [$c(4, 2700, 2701, 2628, 2640)]);
$h = qi_sig_nilai_satu($beli, $isiDanSl, 300, $selamaJendela);
cek('candle pengisian juga menyentuh SL → HIT SL (konservatif)', ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['exit_price'] ?? null, 2630.0), $h);
$isiDanTp = array_merge($datar(0, 1, 2645.0), [$c(2, 2645, 2690, 2644, 2685)]);   // pasar di bawah entry → order "stop"
$beliAtas = ['entry' => 2650.0, 'tp' => 2680.0, 'sl' => 2630.0] + $beli;
$h = qi_sig_nilai_satu($beliAtas + ['atr' => 2.0], $isiDanTp, 300, $selamaJendela);
cek('TP di candle pengisian TIDAK dihitung (urutan tak diketahui)', $h === null, $h);

echo "Mode pasar (perilaku lama untuk entry yang memang harga pasar)\n";
$normal = array_merge([$c(0, 2649, 2652, 2648, 2650)], [$c(1, 2650, 2681, 2649, 2679)]);
$h = qi_sig_nilai_satu($beli, $normal, 300, $selamaJendela);
cek('entry di rentang candle saat terbit → terisi saat terbit, HIT TP', ($h['status'] ?? '') === 'HIT TP 🎯' && ($h['isi_entry'] ?? '') === 'pasar' && !isset($h['filled_at']), $h);
$gapTp = array_merge([$c(0, 2649, 2652, 2648, 2650)], [$c(1, 2690, 2691, 2689, 2690)]);
$h = qi_sig_nilai_satu($beli, $gapTp, 300, $selamaJendela);
cek('posisi yang SUDAH terisi lalu gap melewati TP → keluar di pembukaan 2690 (aturan 5 tetap)', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['exit_price'] ?? null, 2690.0) && !empty($h['gap']), $h);
$toleransi = array_merge([$c(0, 2652.5, 2654, 2652, 2653)], [$c(1, 2653, 2681, 2652, 2679)]);
$h = qi_sig_nilai_satu($beli + ['atr' => 12.0], $toleransi, 300, $selamaJendela);
cek('entry 2650 dalam toleransi 0,25×ATR (3) dari candle saat terbit → mode pasar', ($h['isi_entry'] ?? '') === 'pasar' && ($h['status'] ?? '') === 'HIT TP 🎯', $h);

echo "Pasar tutup saat terbit\n";
$jumat = (new DateTimeImmutable('2026-10-23 20:55:00', new DateTimeZone('UTC')))->getTimestamp();
$sabtu = $jumat + 13 * 3600;                 // sinyal "terbit" Sabtu 09:55 dari close Jumat
$minggu = (new DateTimeImmutable('2026-10-25 22:00:00', new DateTimeZone('UTC')))->getTimestamp();
$akhirPekan = [['time' => $jumat, 'open' => 2650, 'high' => 2651, 'low' => 2649, 'close' => 2650],
               ['time' => $minggu, 'open' => 2700, 'high' => 2702, 'low' => 2698, 'close' => 2701]];
$sigSabtu = ['timestamp' => $iso($sabtu), 'expiry' => $iso($minggu + 3600)] + $beli;
$h = qi_sig_nilai_satu($sigSabtu, $akhirPekan, 300, $minggu + 1800);
cek('ada data sebelum terbit tetapi tidak ada candle PADA waktu terbit → gap Minggu tidak dihitung TP', $h === null, $h);

echo "Tanpa data di waktu terbit\n";
$sesudahSaja = [$c(1, 2690, 2691, 2689, 2690)];
$h = qi_sig_nilai_satu($beli, $sesudahSaja, 300, $selamaJendela);
cek('rekor lama tanpa harga_acuan → "diasumsikan" (tidak bisa diverifikasi, ditandai)', ($h['isi_entry'] ?? '') === 'diasumsikan', $h);
$h = qi_sig_nilai_satu($beli + ['harga_acuan' => 2700.0, 'atr' => 8.0], $sesudahSaja, 300, $selamaJendela);
cek('rekor baru dengan harga_acuan 2700 (jauh dari entry) → mode sentuh, tidak dikreditkan', $h === null, $h);
$h = qi_sig_nilai_satu($beli + ['harga_acuan' => 2650.5, 'atr' => 8.0], $sesudahSaja, 300, $selamaJendela);
cek('harga_acuan dekat entry → mode pasar', ($h['isi_entry'] ?? '') === 'pasar', $h);

echo "Kolom yang diukur ikut disimpan (qi_sig_nilai_rekor)\n";
$sim = 'ZZG3AUJI';
$berkas = __DIR__ . '/../cache/chart/' . md5($sim . '_5') . '.json';
$rekGap = ['id' => 'SIG-UJI-GAP', 'symbol' => $sim, 'side' => 'BUY', 'entry' => 100.0, 'tp' => 103.0, 'sl' => 99.0, 'atr' => 1.0,
           'timeframe' => 'M5', 'status' => 'AKTIF', 'timestamp' => $iso($t0), 'expiry' => $iso($t0 + 4 * 3600)];
try {
    @mkdir(dirname($berkas), 0755, true);
    file_put_contents($berkas, json_encode(['status' => 'success', 'simulated' => false, 'source' => 'uji', 'candles' => [
        ['time' => $m5, 'open' => 100.0, 'high' => 100.5, 'low' => 99.6, 'close' => 100.1],
        ['time' => $m5 + 300, 'open' => 100.1, 'high' => 101.0, 'low' => 99.8, 'close' => 100.6],
        ['time' => $m5 + 600, 'open' => 98.2, 'high' => 98.4, 'low' => 97.6, 'close' => 97.8],   // gap di bawah SL
    ]]));
    $n = qi_sig_nilai_rekor($rekGap);
    $u = $n['ubah'];
    cek('HIT SL karena gap', ($u['status'] ?? '') === 'HIT SL 🛑', $u);
    $wajib = ['mae_r', 'mfe_r', 'hit_price', 'wick_extreme', 'wick_depth', 'wick_depth_atr', 'candle_high', 'candle_low', 'candle_close', 'closed_back', 'gap', 'isi_entry'];
    $hilang = array_values(array_filter($wajib, fn($k) => !array_key_exists($k, $u)));
    cek('MAE/MFE, hit_price, wick_*, candle_*, closed_back, gap, isi_entry tersimpan (dulu dibuang)', $hilang === [], $hilang);
    cek('versi penilaian 4', ($u['versi_penilaian'] ?? null) === 4, $u['versi_penilaian'] ?? null);
    $rekTutup = array_merge($rekGap, $u);
    $sebab = qi_sl_sebab($rekTutup);
    cek('_sl_learn: gap → "gap_melewati_sl" (bukan sapuan likuiditas)', $sebab['cause'] === 'gap_melewati_sl', $sebab);

    // Sapuan sungguhan: menusuk SL ≥ 0,25×ATR lalu DITUTUP kembali di atas SL.
    file_put_contents($berkas, json_encode(['status' => 'success', 'simulated' => false, 'source' => 'uji', 'candles' => [
        ['time' => $m5, 'open' => 100.0, 'high' => 100.5, 'low' => 99.6, 'close' => 100.1],
        ['time' => $m5 + 300, 'open' => 100.1, 'high' => 100.3, 'low' => 98.2, 'close' => 99.7],
        ['time' => $m5 + 600, 'open' => 99.7, 'high' => 100.2, 'low' => 99.5, 'close' => 100.0],   // penilai butuh ≥ 3 candle
    ]]));
    $u = qi_sig_nilai_rekor(['id' => 'SIG-UJI-SAPU'] + $rekGap)['ubah'];
    $sebab = qi_sl_sebab(array_merge($rekGap, $u));
    cek('_sl_learn: tusukan 0,8×ATR lalu ditutup kembali → "sapuan_likuiditas" (dari wick nyata)', $sebab['cause'] === 'sapuan_likuiditas' && ($u['closed_back'] ?? null) === true && empty($u['gap']), [$sebab, $u]);
} finally {
    @unlink($berkas);
}

echo "_sl_learn: rekor lama tanpa penutupan candle\n";
$lama = ['id' => 'L1', 'status' => 'HIT SL 🛑', 'side' => 'BUY', 'entry' => 100.0, 'sl' => 98.0, 'atr' => 1.5, 'exit_price' => 97.0,
         'timestamp' => $iso($t0), 'mtf_aligned' => true];
$sebab = qi_sl_sebab($lama);
cek('keluar 0,67×ATR di balik SL tanpa closed_back → "perlu_data_harga" (dulu "sapuan_likuiditas")', $sebab['cause'] === 'perlu_data_harga', $sebab);
$sebab = qi_sl_sebab($lama + ['wick_depth_atr' => 0.5, 'closed_back' => false]);
cek('tembus dan TIDAK ditutup kembali → "tren_berlanjut"', $sebab['cause'] === 'tren_berlanjut', $sebab);

// ═══ Audit ulang 2026-10-22 ══════════════════════════════════════════════════════════════════
echo "Pengisian diputuskan SEKALI dari data paling halus (qi_sig_nilai_rekor, cache M5 + H1)\n";
// Dulu M5 berkata "belum terisi" (null), lalu penilai jatuh ke H1: candle H1 yang memuat waktu
// terbit juga memuat entry → 'pasar' → HIT TP. Diuji lewat jalur produksi dengan berkas cache.
$simF = 'ZZG3AISI';
$fM5 = __DIR__ . '/../cache/chart/' . md5($simF . '_5') . '.json';
$fH1 = __DIR__ . '/../cache/chart/' . md5($simF . '_60') . '.json';
$tulisCache = function (string $f, array $c): void { file_put_contents($f, json_encode(['status' => 'success', 'simulated' => false, 'source' => 'uji', 'candles' => $c])); };
$jam = (new DateTimeImmutable('2026-10-20 08:00:00', new DateTimeZone('UTC')))->getTimestamp();
$tF = $jam + 40 * 60 + 100;                     // terbit 08:41:40
$rekF = ['id' => 'SIG-UJI-ISI', 'symbol' => $simF, 'side' => 'BUY', 'entry' => 2650.0, 'tp' => 2680.0, 'sl' => 2630.0, 'atr' => 10.0,
         'timeframe' => 'MTF', 'status' => 'AKTIF', 'timestamp' => $iso($tF), 'expiry' => $iso($tF + 12 * 3600)];
$bar = fn(int $t, float $o, float $h, float $l, float $cl): array => ['time' => $t, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $cl];
try {
    @mkdir(dirname($fM5), 0755, true);
    // Kasus audit: pasar melompat 2652 → 2700 lima menit sebelum terbit dan tidak kembali.
    $kM5 = []; for ($t = $jam - 3600; $t <= $jam + 14 * 3600; $t += 300) { $p = $t < $jam + 35 * 60 ? 2652.0 : 2700.0; $kM5[] = $bar($t, $p, $p + 2, $p - 2, $p); }
    $kH1 = []; for ($t = $jam - 20 * 3600; $t <= $jam + 14 * 3600; $t += 3600) {
        $kH1[] = $t < $jam ? $bar($t, 2652, 2654, 2650, 2652) : ($t === $jam ? $bar($t, 2652, 2702, 2650, 2700) : $bar($t, 2700, 2702, 2698, 2700));
    }
    $tulisCache($fM5, $kM5); $tulisCache($fH1, $kH1);
    $n = qi_sig_nilai_rekor($rekF, $tF + 3600);
    cek('selama jendela: tetap AKTIF (dulu H1 mencatat "HIT TP" di 2699,7 dengan isi "pasar")', $n['hasil'] === null, $n['ubah']);
    $n = qi_sig_nilai_rekor($rekF, $tF + 13 * 3600);
    cek('sesudah expiry: EXPIRED "entry_tak_terisi" dari M5, bukan menang dari H1',
        ($n['ubah']['status'] ?? '') === 'EXPIRED' && ($n['ubah']['expiry_basis'] ?? '') === 'entry_tak_terisi' && ($n['pakai']['interval'] ?? '') === '5', $n['ubah']);

    // Rekor gaya baru: harga_acuan = entry = 2690 (dibaca dari H1 sebelum lompatan), pasar 2700 saat terbit.
    $rekB = ['entry' => 2690.0, 'tp' => 2720.0, 'sl' => 2678.0, 'atr' => 10.0, 'harga_acuan' => 2690.0, 'jarak_entry_atr' => 0.0] + $rekF;
    $kM5 = []; for ($t = $jam - 3600; $t <= $jam + 14 * 3600; $t += 300) { $p = $t < $jam + 38 * 60 ? 2690.0 : min(2725.0, 2700.0 + max(0, $t - $jam - 3600) / 300); $kM5[] = $bar($t, $p, $p + 1, $p - 1, $p); }
    $kH1 = []; for ($t = $jam - 20 * 3600; $t <= $jam + 14 * 3600; $t += 3600) {
        if ($t < $jam) $kH1[] = $bar($t, 2690, 2691, 2689, 2690);
        elseif ($t === $jam) $kH1[] = $bar($t, 2690, 2701, 2689, 2700);
        else { $o = 2700 + ($t - $jam - 3600) / 300; $kH1[] = $bar($t, $o, $o + 12.5, $o - 1, $o + 12); }
    }
    $tulisCache($fM5, $kM5); $tulisCache($fH1, $kH1);
    $n = qi_sig_nilai_rekor($rekB, $tF + 5 * 3600);
    cek('rekor dengan harga_acuan: M5 "belum terisi" tidak lagi dibalik H1 menjadi HIT TP +2,5R', $n['hasil'] === null, $n['ubah']);

    // Cache M5 berhenti lebih dulu (basi 2 jam sesudah terbit): pencarian isi DILANJUTKAN di H1
    // mulai ujung M5 — candle H1 tempat terbit (08:00, high 2702) tidak menjadikannya 'pasar'.
    $kM5 = []; for ($t = $jam - 3600; $t <= $jam + 2 * 3600 - 300; $t += 300) { $p = $t < $jam + 35 * 60 ? 2652.0 : 2700.0; $kM5[] = $bar($t, $p, $p + 2, $p - 2, $p); }
    $kH1 = []; for ($t = $jam - 20 * 3600; $t <= $jam + 7 * 3600; $t += 3600) {
        if ($t < $jam) $kH1[] = $bar($t, 2652, 2654, 2650, 2652);
        elseif ($t === $jam) $kH1[] = $bar($t, 2652, 2702, 2650, 2700);
        elseif ($t === $jam + 4 * 3600) $kH1[] = $bar($t, 2700, 2701, 2648, 2655);   // turun menyentuh 2650 → terisi
        elseif ($t === $jam + 5 * 3600) $kH1[] = $bar($t, 2655, 2681, 2654, 2679);   // TP 2680
        else $kH1[] = $bar($t, 2700, 2702, 2698, 2700);
    }
    $tulisCache($fM5, $kM5); $tulisCache($fH1, $kH1);
    $n = qi_sig_nilai_rekor($rekF, $jam + 7 * 3600);
    $u = $n['ubah'];
    cek('M5 basi: terisi di H1 12:00 (bukan saat terbit), lalu HIT TP di 2680 dari H1', ($u['status'] ?? '') === 'HIT TP 🎯' && ($u['isi_entry'] ?? '') === 'sentuh'
        && ($u['filled_at'] ?? '') === $iso($jam + 4 * 3600) && abs((float)($u['exit_price'] ?? 0) - 2680.0) < 1e-6 && ($n['pakai']['interval'] ?? '') === '60', $u);
    // Rekor ini dipasangi spread perkiraan, jadi MFE sedikit di bawah 1,55R; dari puncak 2702 nilainya 2,6R.
    cek('MFE tidak memakai puncak 2702 SEBELUM terisi (≤ 1,55R dari candle TP, bukan 2,6R)', (float)($u['mfe_r'] ?? 9) <= 1.55 + 1e-9 && (float)($u['mfe_r'] ?? 0) > 1.4, $u);
} finally {
    @unlink($fM5); @unlink($fH1);
}

echo "Data yang dimulai jauh sesudah terbit tidak memutuskan apa pun\n";
$telat = array_map(fn($i) => $c($i, 2655, 2681, 2654, 2679), range(120, 125));   // mulai 10 jam sesudah terbit
cek('cache M5 yang sudah bergulir (mulai +10 jam) → null, interval kasar yang menilai', qi_sig_nilai_satu($beli, $telat, 300, $selamaJendela + 12 * 3600) === null);

echo "Toleransi isi dibatasi 0,25R (rencana sempit)\n";
// BUY 2650 / TP 2652,5 / SL 2648,5, ATR 12: 0,25×ATR = 3 = 2R. Pasar 2652,9 sudah DI ATAS TP.
$sempit = ['entry' => 2650.0, 'tp' => 2652.5, 'sl' => 2648.5, 'atr' => 12.0, 'harga_acuan' => 2652.9] + $beli;
$h = qi_sig_nilai_satu($sempit, [$c(0, 2652.6, 2653.2, 2652.4, 2652.9), $c(1, 2652.9, 2653.5, 2652.7, 2653.1)], 300, $t0 + 900);
cek('dulu "HIT TP" +1,9R di pembukaan candle berikutnya; kini entry bukan harga pasar → belum terisi', $h === null, $h);
cek('qi_sp_toleransi_entry: min(0,25×ATR, 0,25R)', abs(qi_sp_toleransi_entry(12.0, 1.5) - 0.375) < 1e-9 && abs(qi_sp_toleransi_entry(8.0, 20.0) - 2.0) < 1e-9 && abs(qi_sp_toleransi_entry(0.0, 20.0) - 4.0) < 1e-9);

echo "Candle saat terbit hilang (feed bolong) — harga_acuan dipakai\n";
$tK = 1760000100; $barK = intdiv($tK, 300) * 300;
$kripto = ['side' => 'BUY', 'entry' => 100.0, 'tp' => 103.0, 'sl' => 98.8, 'atr' => 1.0, 'harga_acuan' => 100.0, 'symbol' => 'BTCUSDT',
           'timestamp' => $iso($tK), 'expiry' => $iso($tK + 43200)];
$bolong = [];
for ($i = 6; $i >= 1; $i--) $bolong[] = ['time' => $barK - $i * 300, 'open' => 99.9, 'high' => 100.1, 'low' => 99.8, 'close' => 100.0];
$reli = $bolong; for ($i = 1; $i <= 200; $i++) { $p = 100.3 + $i * 0.02; $reli[] = ['time' => $barK + $i * 300, 'open' => $p, 'high' => $p + 0.05, 'low' => $p - 0.05, 'close' => $p + 0.02]; }
$h = qi_sig_nilai_satu($kripto, $reli, 300, $tK + 50000);
cek('kripto, harga_acuan = entry, pasar buka → "pasar": reli tercatat HIT TP (dulu dibuang sebagai entry_tak_terisi, hanya rugi yang tercatat)', ($h['status'] ?? '') === 'HIT TP 🎯' && ($h['isi_entry'] ?? '') === 'pasar', $h);
$jumatT = (new DateTimeImmutable('2026-10-23 20:55:00', new DateTimeZone('UTC')))->getTimestamp();
$sabtuT = $jumatT + 13 * 3600; $mingguT = (new DateTimeImmutable('2026-10-25 22:00:00', new DateTimeZone('UTC')))->getTimestamp();
$akhirPekan2 = [['time' => $jumatT, 'open' => 2650, 'high' => 2651, 'low' => 2649, 'close' => 2650],
                ['time' => $mingguT, 'open' => 2700, 'high' => 2702, 'low' => 2698, 'close' => 2701]];
$h = qi_sig_nilai_satu(['timestamp' => $iso($sabtuT), 'expiry' => $iso($mingguT + 3600), 'harga_acuan' => 2650.0] + $beli, $akhirPekan2, 300, $mingguT + 1800);
cek('XAUUSD terbit Sabtu dengan harga_acuan = close Jumat → tetap "sentuh" (pasar tutup), gap Minggu tidak dihitung TP', $h === null, $h);

echo "Harga melompati entry: terisi di PEMBUKAAN (limit lebih baik, stop lebih buruk)\n";
// BUY limit 2650 saat pasar 2660; candle berikutnya dibuka 2642 (berita) lalu jatuh melewati SL 2630.
$limitSig = ['entry' => 2650.0, 'tp' => 2680.0, 'sl' => 2630.0, 'atr' => 8.0] + $beli;
$lompatTurun = [$c(0, 2660, 2661, 2659, 2660), $c(1, 2660, 2661, 2656, 2657), $c(2, 2642, 2646, 2638, 2639)];
for ($i = 3; $i < 60; $i++) $lompatTurun[] = $c($i, 2639 - $i * 0.4, 2640 - $i * 0.4, 2620 - $i * 0.4, 2625 - $i * 0.4);
$h = qi_sig_nilai_satu($limitSig, $lompatTurun, 300, $sesudahExpiry);
cek('BUY limit dilompati ke 2642: terisi di 2642 lalu HIT SL −12 (dulu "entry_tak_terisi" — rugi nyata tersembunyi)',
    ($h['status'] ?? '') === 'HIT SL 🛑' && $dekat($h['pnl'] ?? null, -12.0) && $dekat($h['harga_isi'] ?? null, 2642.0) && ($h['filled_at'] ?? '') === $iso($m5 + 600), $h);
cek('entry_efektif dicatat = harga isi (statistik R menghitung dari sini)', $dekat($h['entry_efektif'] ?? null, 2642.0), $h);
// BUY stop 2650 saat pasar 2645; candle berikutnya dibuka 2655 (melompati entry ke atas).
$stopSig = ['entry' => 2650.0, 'tp' => 2680.0, 'sl' => 2630.0, 'atr' => 2.0] + $beli;
$lompatNaik = [$c(0, 2645, 2646, 2644, 2645), $c(1, 2655, 2660, 2652, 2658), $c(2, 2658, 2681, 2657, 2679)];
$h = qi_sig_nilai_satu($stopSig, $lompatNaik, 300, $selamaJendela);
cek('BUY stop dilompati ke 2655: terisi di 2655 (lebih buruk), HIT TP +25 — bukan +30 dari 2650', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['pnl'] ?? null, 25.0) && $dekat($h['harga_isi'] ?? null, 2655.0), $h);
$h = qi_sig_nilai_satu($stopSig, [$c(0, 2645, 2646, 2644, 2645), $c(1, 2655, 2660, 2649, 2658), $c(2, 2658, 2681, 2657, 2679)], 300, $selamaJendela);
cek('rentang memuat 2650 tetapi dibuka 2655 di atasnya: stop tetap terisi di pembukaan 2655', $dekat($h['harga_isi'] ?? null, 2655.0) && $dekat($h['pnl'] ?? null, 25.0), $h);

echo "MAE/MFE candle pengisian\n";
$turunLaluNaik2 = array_merge($datar(0, 3, 2700.0), [$c(4, 2700, 2701, 2648, 2655), $c(5, 2655, 2681, 2654, 2679)]);
$h = qi_sig_nilai_satu($beli, $turunLaluNaik2, 300, $selamaJendela);
cek('BUY limit: MFE 1,55R dari candle TP — puncak 2701 SEBELUM terisi tidak dihitung (dulu 2,55R > TP 1,5R)', $dekat($h['mfe_r'] ?? null, 1.55) && ($h['status'] ?? '') === 'HIT TP 🎯', $h);
cek('BUY limit: MAE 0,1R dari low 2648 (pasti sesudah terisi)', $dekat($h['mae_r'] ?? null, 0.1), $h);
$jual = ['side' => 'SELL', 'entry' => 2650.0, 'tp' => 2620.0, 'sl' => 2670.0, 'atr' => 4.0] + $beli;
$naikLaluTurun = array_merge($datar(0, 3, 2655.0), [$c(4, 2655, 2668, 2649, 2650), $c(5, 2650, 2651, 2619, 2620)]);
$h = qi_sig_nilai_satu($jual, $naikLaluTurun, 300, $selamaJendela);
cek('SELL stop: high 2668 SEBELUM terisi bukan MAE (dulu 0,9R); MAE 0,05R dari candle sesudahnya', ($h['status'] ?? '') === 'HIT TP 🎯' && $dekat($h['mae_r'] ?? null, 0.05), $h);
$jualSl = array_merge($datar(0, 3, 2655.0), [$c(4, 2655, 2671, 2649, 2665)]);
$h = qi_sig_nilai_satu($jual, $jualSl, 300, $selamaJendela);
cek('SL kena di candle pengisian (konservatif) → MAE ≥ 1R tetap tercatat', ($h['status'] ?? '') === 'HIT SL 🛑' && (float)($h['mae_r'] ?? 0) >= 1.0, $h);

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
