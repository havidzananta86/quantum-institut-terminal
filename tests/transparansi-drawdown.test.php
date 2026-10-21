<?php
/**
 * Drawdown yang dipublikasikan di halaman Transparansi.
 * Dijalankan tests/transparansi-drawdown.test.js.
 *
 * Deret uji dibuat supaya jawabannya bisa dihitung tangan:
 *   +1R, -1R, -1R, +2R  →  kurva kumulatif 1, 0, -1, 1
 *   puncak 1 · dasar -1 → penurunan puncak-ke-dasar = 2R
 */
require __DIR__ . '/../api/_signal_time.php';
require __DIR__ . '/../api/_signal_stats.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info)) . "\n";
    if (!$lulus) $gagal++;
}

/** BUY entry 100, SL 99 → risiko 1 harga = 1R. exit menentukan hasilnya. */
function rek(float $exit, string $status, int $menitKe): array
{
    return ['status' => $status, 'side' => 'BUY', 'entry' => 100.0, 'sl' => 99.0, 'tp' => 102.0,
            'exit_price' => $exit, 'symbol' => 'XAUUSD', 'pnl_usd' => ($exit - 100.0) * 10,
            'id' => 'T' . $menitKe, 'timestamp' => gmdate('c', 1760000000 + $menitKe * 60)];
}

$deret = [rek(101.0, 'HIT TP', 1), rek(99.0, 'HIT SL', 2), rek(99.0, 'HIT SL', 3), rek(102.0, 'HIT TP', 4)];

echo "Perhitungan drawdown\n";
$dd = qi_signal_drawdown($deret);
cek('keempat transaksi terhitung', $dd['dinilai'] === 4, $dd['dinilai']);
cek('penurunan puncak-ke-dasar = 2R', abs($dd['r'] - 2.0) < 1e-9, $dd['r']);
cek('transaksi terburuk = -1R', abs($dd['r_terburuk'] + 1.0) < 1e-9, $dd['r_terburuk']);
cek('titik puncak & dasar tercatat', $dd['titik_puncak'] !== null && $dd['titik_dasar'] !== null, [$dd['titik_puncak'], $dd['titik_dasar']]);

echo "\nKurva yang tidak pernah untung\n";
$rugi = [rek(99.0, 'HIT SL', 1), rek(99.0, 'HIT SL', 2)];
$dd2 = qi_signal_drawdown($rugi);
cek('penurunan = 2R', abs($dd2['r'] - 2.0) < 1e-9, $dd2['r']);
cek('persentase null, BUKAN 0% yang menyesatkan', $dd2['pct'] === null, $dd2['pct']);

echo "\nTanpa transaksi tertutup\n";
$dd3 = qi_signal_drawdown([['status' => 'AKTIF', 'side' => 'BUY', 'entry' => 100, 'sl' => 99]]);
cek('dinilai = 0', $dd3['dinilai'] === 0);
cek('drawdown 0 dengan catatan jujur', $dd3['r'] === 0.0 && stripos((string)$dd3['catatan'], 'belum ada transaksi') !== false, $dd3['catatan']);
cek('persentase null', $dd3['pct'] === null);

echo "\nUrutan waktu menentukan, bukan urutan masukan\n";
$acak = [$deret[3], $deret[0], $deret[2], $deret[1]];
$dd4 = qi_signal_drawdown($acak);
cek('hasil sama walau masukan diacak', abs($dd4['r'] - $dd['r']) < 1e-9, [$dd4['r'], $dd['r']]);

echo $gagal ? "\n$gagal uji GAGAL\n" : "\nSemua lulus\n";
exit($gagal ? 1 : 0);
