<?php
/**
 * MAE / MFE — seberapa jauh harga bergerak MELAWAN dan MENDUKUNG posisi sebelum selesai,
 * dalam satuan R. Dijalankan tests/mae-mfe.test.js.
 *
 * Semua kasus memakai BUY entry 100, SL 99, TP 102 → 1R = 1,0 harga, TP = 2R.
 * Jadi setiap angka di bawah bisa dihitung tangan.
 */
define('QI_SIGNAL_EVAL_LIB', true);
require __DIR__ . '/../api/signal-evaluator.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info)) . "\n";
    if (!$lulus) $gagal++;
}

$T0 = 1760000000;
function candle(int $ke, float $o, float $h, float $l, float $c): array
{
    global $T0;
    return ['time' => $T0 + $ke * 3600, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $c];
}

/** Sinyal BUY standar; expiry jauh supaya tidak ikut campur. */
function sinyal(): array
{
    global $T0;
    return ['id' => 'UJI', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 100.0, 'sl' => 99.0, 'tp' => 102.0,
            'status' => 'AKTIF', 'timestamp' => gmdate('c', $T0), 'expiry' => gmdate('c', $T0 + 86400)];
}

$nilai = fn(array $candles) => qi_sig_nilai_satu(sinyal(), $candles, 3600);

echo "Menang, sempat tertekan dulu\n";
// Turun ke 99.4 (MAE 0,6R) lalu naik kena TP 102 (MFE 2R).
$h = $nilai([candle(1, 100.0, 100.2, 99.4, 99.6), candle(2, 99.6, 102.0, 99.5, 101.9)]);
cek('hasilnya menang', $h && strpos((string)$h['status'], 'HIT TP') === 0, $h['status'] ?? null);
cek('MAE 0,6R (penurunan terdalam sebelum menang)', $h && abs($h['mae_r'] - 0.6) < 0.01, $h['mae_r'] ?? null);
cek('MFE 2R (sampai TP)', $h && abs($h['mfe_r'] - 2.0) < 0.01, $h['mfe_r'] ?? null);

echo "\nKalah, hampir kena TP dulu\n";
// Naik ke 101.8 (MFE 1,8R) lalu jatuh kena SL 99 (MAE 1R).
$h = $nilai([candle(1, 100.0, 101.8, 99.9, 101.5), candle(2, 101.5, 101.6, 99.0, 99.1)]);
cek('hasilnya kalah', $h && strpos((string)$h['status'], 'HIT SL') === 0, $h['status'] ?? null);
cek('MFE 1,8R — TP hampir tercapai sebelum berbalik', $h && abs($h['mfe_r'] - 1.8) < 0.01, $h['mfe_r'] ?? null);
cek('MAE 1R (sampai SL)', $h && abs($h['mae_r'] - 1.0) < 0.01, $h['mae_r'] ?? null);

echo "\nKalah tanpa pernah untung sama sekali\n";
// Langsung turun: arah sinyalnya memang salah — MFE 0.
$h = $nilai([candle(1, 100.0, 100.0, 99.0, 99.0)]);
cek('hasilnya kalah', $h && strpos((string)$h['status'], 'HIT SL') === 0, $h['status'] ?? null);
cek('MFE 0 — tidak pernah bergerak mendukung', $h && abs($h['mfe_r']) < 0.01, $h['mfe_r'] ?? null);
cek('MAE 1R', $h && abs($h['mae_r'] - 1.0) < 0.01, $h['mae_r'] ?? null);

echo "\nMenang mulus tanpa tekanan\n";
$h = $nilai([candle(1, 100.0, 102.0, 100.0, 101.9)]);
cek('MAE 0 — tidak pernah melawan', $h && abs($h['mae_r']) < 0.01, $h['mae_r'] ?? null);
cek('MFE 2R', $h && abs($h['mfe_r'] - 2.0) < 0.01, $h['mfe_r'] ?? null);

echo "\nSELL: arah dibalik\n";
$sell = sinyal();
$sell['side'] = 'SELL'; $sell['sl'] = 101.0; $sell['tp'] = 98.0;   // 1R = 1,0 · TP = 2R
// Naik ke 100.5 (MAE 0,5R) lalu turun kena TP 98 (MFE 2R).
$h = qi_sig_nilai_satu($sell, [candle(1, 100.0, 100.5, 99.8, 99.9), candle(2, 99.9, 100.0, 98.0, 98.1)], 3600);
cek('SELL menang', $h && strpos((string)$h['status'], 'HIT TP') === 0, $h['status'] ?? null);
cek('SELL: MAE 0,5R dihitung dari HIGH', $h && abs($h['mae_r'] - 0.5) < 0.01, $h['mae_r'] ?? null);
cek('SELL: MFE 2R dihitung dari LOW', $h && abs($h['mfe_r'] - 2.0) < 0.01, $h['mfe_r'] ?? null);

echo "\nVersi penilaian\n";
cek('QI_VERSI_PENILAIAN terdefinisi', defined('QI_VERSI_PENILAIAN'));
cek('nilainya 3 — MAE/MFE TIDAK menaikkan versi (putusan tidak berubah)', QI_VERSI_PENILAIAN === 3, defined('QI_VERSI_PENILAIAN') ? QI_VERSI_PENILAIAN : null);

echo $gagal ? "\n$gagal uji GAGAL\n" : "\nSemua lulus\n";
exit($gagal ? 1 : 0);
