<?php
/**
 * Pembangkit sinyal memakai penulis bersama qi_signal_catat (audit sinyal 2026-10-22).
 *
 * Dulu api/signal-generator.php membaca signal_history.json tanpa kunci, bekerja puluhan detik
 * (analisa, Groq, scanner), lalu menimpa SELURUH berkas dengan salinan lamanya: penutupan TP/SL
 * dari penilai kembali AKTIF dan sinyal AI/NEWS/TV yang tercatat di tengah jalan hilang. Uji ini
 * memutar ulang urutan itu persis dengan jalur tulis yang kini dipakai pembangkit:
 *   1. pembangkit membaca riwayat (salinan);
 *   2. penilai menutup SIG-A (qi_json_ubah, di bawah kunci);
 *   3. AI mencatat SIG-C (qi_signal_catat);
 *   4. pembangkit mencatat kandidatnya (qi_signal_catat($rek, 4, 0)).
 * Hasil wajib: SIG-A tetap tertutup, SIG-C tetap ada, sinyal pembangkit tercatat. Gerbang yang
 * dulu terlewati (duplikat AKTIF, korelasi, grade, versi aturan) kini berlaku untuk pembangkit.
 * Berkas sementara saja; gerbang mesin & spread (jaringan) dimatikan seperti uji pencatat lain.
 */
declare(strict_types=1);
date_default_timezone_set('Asia/Jakarta');
define('QI_NOTIFY_KEY', str_repeat('k', 40));
require __DIR__ . '/../api/_signal_record.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$GLOBALS['qi_gerbang_lewati'] = true;
$GLOBALS['qi_spread_lewati'] = true;
$dir = sys_get_temp_dir() . '/qi_pembangkit_' . bin2hex(random_bytes(4));
@mkdir($dir);
$GLOBALS['qi_ditolak_berkas'] = $dir . '/ditolak.json';
$f = $dir . '/riwayat.json';
$iso = fn(int $t): string => gmdate('Y-m-d\TH:i:s\Z', $t);
$lama = time() - 10 * 3600;
$rekAuto = fn(string $id, string $sim, string $arah, float $e, float $sl, float $tp) => [
    'id' => $id, 'timestamp' => $iso(time()), 'expiry' => $iso(time() + 12 * 3600), 'symbol' => $sim, 'engine' => 'AUTO_SIGNAL',
    'timeframe' => 'MTF', 'side' => $arah, 'entry' => $e, 'sl' => $sl, 'tp' => $tp, 'atr' => abs($e - $sl) / 1.2, 'status' => 'AKTIF',
    'mtf_aligned' => true, 'confluence_score' => 70, 'confidence' => 70, 'sumber' => 'auto_generator', 'harga_acuan' => $e,
    'jarak_entry_atr' => 0.0, 'news_context' => 'uji'];

try {
    file_put_contents($f, json_encode([
        ['id' => 'SIG-A', 'engine' => 'AUTO_SIGNAL', 'sumber' => 'auto_generator', 'symbol' => 'BTCUSDT', 'side' => 'BUY', 'status' => 'AKTIF',
         'timestamp' => $iso($lama), 'entry' => 60000.0, 'sl' => 59000.0, 'tp' => 62500.0],
    ]));

    echo "Urutan tumpang-tindih pembangkit ⇄ penilai ⇄ AI\n";
    $salinanPembangkit = qi_json_baca($f);                              // 1. pembangkit membaca
    $u = qi_json_ubah($f, function (array $d): array {                  // 2. penilai menutup SIG-A
        $d[0]['status'] = 'HIT TP 🎯'; $d[0]['exit_price'] = 62500.0; return $d;
    });
    cek('penilai menutup SIG-A di bawah kunci', $u['ok']);
    $c = qi_signal_catat(['id' => 'SIG-C', 'engine' => 'AI', 'symbol' => 'ETHUSDT', 'side' => 'SELL', 'entry' => 3000.0, 'sl' => 3030.0, 'tp' => 2950.0,
                          'timestamp' => $iso(time()), 'status' => 'AKTIF', 'news_context' => 'uji'], 4, 20, $f);
    cek('AI mencatat SIG-C', $c['dicatat'], $c);
    $b = qi_signal_catat($rekAuto('SIG-B', 'XAUUSD', 'BUY', 2000.0, 1990.0, 2025.0), 4, 0, $f);   // 4. pembangkit
    cek('pembangkit mencatat SIG-B lewat penulis bersama', $b['dicatat'], $b);
    $akhir = array_column(qi_json_baca($f), null, 'id');
    cek('SIG-A TETAP tertutup HIT TP (dulu kembali AKTIF karena salinan lama ditulis ulang)', ($akhir['SIG-A']['status'] ?? '') === 'HIT TP 🎯', $akhir['SIG-A'] ?? null);
    cek('SIG-C dari AI TETAP ada (dulu hilang permanen)', isset($akhir['SIG-C']));
    // Cara LAMA (untuk pembanding): menulis ulang salinan baca + rekor baru menghapus kerja penilai & AI.
    $caraLama = array_merge([$rekAuto('SIG-B', 'XAUUSD', 'BUY', 2000.0, 1990.0, 2025.0)], $salinanPembangkit);
    cek('pembanding: cara lama akan mengembalikan SIG-A ke AKTIF dan membuang SIG-C', ($caraLama[1]['status'] ?? '') === 'AKTIF' && !in_array('SIG-C', array_column($caraLama, 'id'), true));
    cek('rekor pembangkit kini membawa versi aturan + grade (dulu tanpa keduanya)', ($akhir['SIG-B']['versi_aturan'] ?? '') === QI_VERSI_ATURAN_SINYAL && !empty($akhir['SIG-B']['grade']), $akhir['SIG-B'] ?? null);
    cek('jejak pemeriksaan entry ikut tersimpan (harga_acuan, jarak_entry_atr)', isset($akhir['SIG-B']['harga_acuan'], $akhir['SIG-B']['jarak_entry_atr']), $akhir['SIG-B'] ?? null);

    echo "Gerbang yang dulu terlewati kini berlaku untuk pembangkit\n";
    $d = qi_signal_catat($rekAuto('SIG-B2', 'XAUUSD', 'BUY', 2001.0, 1991.0, 2026.0), 4, 0, $f);
    cek('XAUUSD BUY kedua saat yang pertama masih AKTIF → ditolak (sudah_ada_sinyal_aktif_sejenis)', !$d['dicatat'] && $d['alasan'] === 'sudah_ada_sinyal_aktif_sejenis', $d);
    $e = qi_signal_catat($rekAuto('SIG-E', 'EURUSD', 'BUY', 1.08, 1.07, 1.105), 4, 0, $f);
    cek('jeda global 0: simbol lain di jalan yang sama tetap boleh (EURUSD BUY)', $e['dicatat'], $e);
    $g = qi_signal_catat($rekAuto('SIG-G', 'GBPUSD', 'BUY', 1.27, 1.26, 1.295), 4, 0, $f);
    cek('XAUUSD BUY + EURUSD BUY + GBPUSD BUY = satu taruhan USD → yang ketiga ditolak (eksposur_korelasi)', !$g['dicatat'] && $g['alasan'] === 'eksposur_korelasi', $g);
} finally {
    array_map('unlink', glob($dir . '/*') ?: []);
    @rmdir($dir);
}

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
