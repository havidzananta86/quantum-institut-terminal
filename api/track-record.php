<?php
/**
 * TRACK RECORD TERPERINCI — per mesin, per pair, per timeframe.
 *
 * GET ?hari=30|90|0 (0 = sepanjang waktu)
 *
 * Ukuran yang JUJUR untuk sinyal lintas instrumen:
 *   · Hasil dihitung dalam R (kelipatan risiko awal = |entry − SL|), bukan dolar, supaya
 *     BTC dan EURUSD bisa dibandingkan. R memakai exit_price bila ada; tanpa itu TP = jarak
 *     TP/risiko, SL = −1.
 *   · Hanya sinyal yang SUDAH selesai (HIT TP / HIT SL) yang dihitung. EXPIRED dan AKTIF
 *     dilaporkan terpisah dan tidak memengaruhi win rate.
 *   · Win rate disertai interval kepercayaan Wilson 95%, dan setiap grup dengan < 30 sinyal
 *     selesai ditandai "sampel kecil" — angka dari sampel kecil mudah menyesatkan.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);
qi_require_auth();
if (is_file(__DIR__ . '/_signal_time.php')) require_once __DIR__ . '/_signal_time.php';

const QI_TR_SAMPEL_MIN = 30;
$hari = (int)($_GET['hari'] ?? 0);
if (!in_array($hari, [0, 7, 30, 90, 365], true)) $hari = 0;

$berkas = __DIR__ . '/../cache/signal_history.json';
$riwayat = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
if (!is_array($riwayat)) $riwayat = [];

$epoch = static function ($v): ?int {
    if ($v === null || $v === '') return null;
    if (function_exists('qi_sig_epoch')) return qi_sig_epoch($v);
    $t = strtotime((string)$v);
    return $t === false ? null : $t;
};

/** Hasil satu sinyal dalam R; null bila belum selesai atau datanya tidak lengkap. */
function qi_tr_r(array $r): ?float
{
    $st = strtoupper((string)($r['status'] ?? ''));
    $menang = strpos($st, 'TP') !== false;
    $kalah = strpos($st, 'SL') !== false;
    if (!$menang && !$kalah) return null;
    $entry = (float)($r['entry'] ?? 0); $sl = (float)($r['sl'] ?? 0); $tp = (float)($r['tp'] ?? 0);
    $risiko = abs($entry - $sl);
    if ($entry <= 0 || $risiko <= 0) return null;
    $beli = strtoupper((string)($r['side'] ?? '')) === 'BUY';
    if (isset($r['exit_price']) && is_numeric($r['exit_price'])) {
        $x = (float)$r['exit_price'];
        return round(($beli ? $x - $entry : $entry - $x) / $risiko, 3);
    }
    return $menang ? round(abs($tp - $entry) / $risiko, 3) : -1.0;
}

/** Interval Wilson 95% untuk proporsi k/n. */
function qi_tr_wilson(int $k, int $n): ?array
{
    if ($n <= 0) return null;
    $z = 1.96; $p = $k / $n;
    $den = 1 + $z * $z / $n;
    $pusat = ($p + $z * $z / (2 * $n)) / $den;
    $lebar = $z * sqrt($p * (1 - $p) / $n + $z * $z / (4 * $n * $n)) / $den;
    return [round(max(0, $pusat - $lebar) * 100, 1), round(min(1, $pusat + $lebar) * 100, 1)];
}

$batas = $hari > 0 ? time() - $hari * 86400 : null;
$baris = [];
foreach ($riwayat as $r) {
    if (!is_array($r)) continue;
    $t = $epoch($r['timestamp'] ?? null);
    if ($batas !== null && ($t === null || $t < $batas)) continue;
    $st = strtoupper((string)($r['status'] ?? ''));
    $baris[] = [
        'mesin'  => (string)($r['engine_name'] ?? $r['engine'] ?? 'Tanpa nama'),
        'pair'   => strtoupper((string)($r['symbol'] ?? '?')),
        'tf'     => strtoupper((string)($r['timeframe'] ?? '?')),
        'r'      => qi_tr_r($r),
        'aktif'  => strpos($st, 'AKTIF') !== false,
        'expired'=> strpos($st, 'EXPIRED') !== false || strpos($st, 'KEDALUWARSA') !== false,
        'tutup'  => $epoch($r['closed_at'] ?? null) ?? $t ?? 0,
    ];
}

function qi_tr_ringkas(array $grup): array
{
    usort($grup, static fn($a, $b) => $a['tutup'] <=> $b['tutup']);
    $selesai = array_values(array_filter($grup, static fn($x) => $x['r'] !== null));
    $n = count($selesai);
    $menang = count(array_filter($selesai, static fn($x) => $x['r'] > 0));
    $rMenang = array_sum(array_map(static fn($x) => max(0, $x['r']), $selesai));
    $rKalah = array_sum(array_map(static fn($x) => min(0, $x['r']), $selesai));
    $kum = 0.0; $puncak = 0.0; $dd = 0.0;
    foreach ($selesai as $x) { $kum += $x['r']; $puncak = max($puncak, $kum); $dd = max($dd, $puncak - $kum); }
    return [
        'total'      => count($grup),
        'selesai'    => $n,
        'menang'     => $menang,
        'kalah'      => $n - $menang,
        'aktif'      => count(array_filter($grup, static fn($x) => $x['aktif'])),
        'expired'    => count(array_filter($grup, static fn($x) => $x['expired'])),
        'win_rate'   => $n ? round($menang / $n * 100, 1) : null,
        'wilson95'   => qi_tr_wilson($menang, $n),
        'expectancy' => $n ? round(($rMenang + $rKalah) / $n, 2) : null,
        'total_r'    => round($rMenang + $rKalah, 2),
        'pf'         => $rKalah < 0 ? round($rMenang / abs($rKalah), 2) : null,
        'max_dd_r'   => round($dd, 2),
        'terbaik'    => $n ? max(array_column($selesai, 'r')) : null,
        'terburuk'   => $n ? min(array_column($selesai, 'r')) : null,
        'jejak'      => implode('', array_map(static fn($x) => $x['r'] > 0 ? 'W' : 'L', array_slice($selesai, -12))),
        'sampel_kecil' => $n < QI_TR_SAMPEL_MIN,
    ];
}

$keluar = ['status' => 'success', 'hari' => $hari, 'sampel_min' => QI_TR_SAMPEL_MIN, 'semua' => qi_tr_ringkas($baris)];
foreach (['mesin', 'pair', 'tf'] as $dim) {
    $grup = [];
    foreach ($baris as $b) $grup[$b[$dim]][] = $b;
    $hasil = [];
    foreach ($grup as $nama => $isi) $hasil[] = ['nama' => (string)$nama] + qi_tr_ringkas($isi);
    usort($hasil, static fn($a, $b) => [$b['selesai'], $b['total']] <=> [$a['selesai'], $a['total']]);
    $keluar[$dim] = $hasil;
}
echo json_encode($keluar, JSON_UNESCAPED_UNICODE);
