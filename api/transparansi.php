<?php
/**
 * TRANSPARANSI — statistik sinyal yang dibuka untuk PUBLIK (tanpa login), apa adanya.
 *
 * Dipakai halaman depan (index.html) dan halaman transparansi.html. Prinsipnya:
 *   · Semua angka dihitung dari catatan sinyal sungguhan (cache/signal_history.json dan
 *     cache/signal_shadow.json) — TIDAK ada angka bawaan/contoh. Bila belum ada sinyal selesai,
 *     nilainya null dan halaman menulis "belum ada data".
 *   · Hasil dalam R (kelipatan risiko), win rate disertai interval Wilson 95%, dan sampel < 30
 *     ditandai kecil. Sinyal yang kalah ikut dihitung dan ditampilkan.
 *   · Hanya data agregat dan daftar sinyal (tanpa data pengguna).
 *
 * GET → { status, diperbarui, sinyal_resmi{statistik, terakhir[], periode}, sinyal_bayangan{...}, metodologi[] }
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);
require_once __DIR__ . '/_signal_stats.php';
if (is_file(__DIR__ . '/_signal_time.php')) require_once __DIR__ . '/_signal_time.php';
require_once __DIR__ . '/_setup_shadow.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Gunakan GET.']);
    exit();
}

$cache = __DIR__ . '/../cache';
$resmi = qi_ss_baca($cache . '/signal_history.json');
$bayangan = qi_ss_baca($cache . '/signal_shadow.json');
$pine = qi_ss_baca($cache . '/pine_signals.json');

$epoch = static function ($v): ?int {
    if ($v === null || $v === '') return null;
    if (function_exists('qi_sig_epoch')) return qi_sig_epoch($v);
    $t = strtotime((string)$v);
    return $t === false ? null : $t;
};
$ambil = static fn(array $st) => array_intersect_key($st, array_flip([
    'menang', 'kalah', 'dinilai', 'aktif', 'kedaluwarsa', 'win_rate', 'ci_bawah', 'ci_atas', 'rata_r', 'rata_menang_r', 'rata_kalah_r',
    'expectancy_r', 'profit_factor', 'rr_rata', 'titik_impas_pct', 'total_r', 'cukup_sampel', 'catatan', 'satuan',
]));

// ── Sinyal resmi ─────────────────────────────────────────────────────────────
$stat = qi_signal_statistik($resmi);
// Kurva modal dalam R, dihitung dari transaksi tertutup berurutan waktu. 'pct' sengaja
// null bila kurva belum pernah di atas titik awal — "0%" di situ menyesatkan.
$dd = qi_signal_drawdown($resmi);
$drawdown = [
    'maks_r'       => $dd['r'],
    'maks_pct'     => $dd['pct'],
    'r_terburuk'   => $dd['r_terburuk'],
    'dari_transaksi' => $dd['dinilai'],
    'satuan'       => 'R (kelipatan risiko; 1R = jarak entry ke stop loss)',
    'arti'         => 'Penurunan terbesar dari puncak ke dasar kurva modal. Semakin besar, semakin dalam kerugian beruntun yang pernah terjadi sebelum pulih.',
    'catatan'      => $dd['catatan'] ?? null,
];
$perSimbol = array_map(fn($x) => [
    'simbol' => $x['nama'], 'dinilai' => $x['sinyal'], 'menang' => $x['menang'], 'win_rate' => $x['win_rate'], 'total_r' => $x['total_r'],
    'sampel_kecil' => $x['sinyal'] < 30,
], $stat['per_simbol']);

$selesai = [];
foreach ($resmi as $r) {
    if (!is_array($r)) continue;
    $st = (string)($r['status'] ?? '');
    if (strpos($st, 'HIT TP') !== 0 && strpos($st, 'HIT SL') !== 0) continue;
    $hasil = qi_signal_r_satu($r);
    $selesai[] = [
        'waktu'  => $r['timestamp'] ?? null,
        'tutup'  => $r['closed_at'] ?? null,
        'simbol' => (string)($r['symbol'] ?? '?'),
        'arah'   => strtoupper((string)($r['side'] ?? '?')),
        'entry'  => isset($r['entry']) ? (float)$r['entry'] : null,
        'sl'     => isset($r['sl']) ? (float)$r['sl'] : null,
        'tp'     => isset($r['tp']) ? (float)$r['tp'] : null,
        'hasil'  => strpos($st, 'HIT TP') === 0 ? 'TP' : 'SL',
        'r'      => $hasil['r'],
        'sumber' => (string)($r['engine_name'] ?? $r['engine'] ?? ''),
        '_t'     => $epoch($r['closed_at'] ?? null) ?? $epoch($r['timestamp'] ?? null) ?? 0,
    ];
}
usort($selesai, fn($a, $b) => $b['_t'] <=> $a['_t']);
$terakhir = array_map(function ($x) { unset($x['_t']); return $x; }, array_slice($selesai, 0, 30));

$semuaWaktu = array_filter(array_map(fn($r) => is_array($r) ? $epoch($r['timestamp'] ?? null) : null, $resmi));
$periode = $semuaWaktu ? ['pertama' => gmdate('c', min($semuaWaktu)), 'terakhir' => gmdate('c', max($semuaWaktu))] : null;

// ── Sinyal bayangan (sumber baru berbasis struktur; dikumpulkan sebelum dipromosikan) ──
$lap = qi_ss_laporan($bayangan, $resmi);
$bay = [
    'rekor' => $lap['bayangan']['rekor'],
    'terisi' => $lap['bayangan']['terisi'],
    'tingkat_isi_pct' => $lap['bayangan']['tingkat_isi_pct'],
    'statistik' => $lap['bayangan']['statistik'],
    'per_metode' => $lap['bayangan']['per_metode'],
    'siap_dinilai' => $lap['siap_dinilai'],
    'catatan' => $lap['catatan'],
];

// ── Sinyal indikator Pine SMC+SnD (catatan terpisah dari sinyal resmi; dinilai dengan aturan konservatif yang sama) ──
$statPine = qi_signal_statistik($pine);
$pineTerakhir = array_map(static fn($r) => [
    'waktu' => $r['timestamp'] ?? null, 'simbol' => (string)($r['symbol'] ?? '?'), 'arah' => strtoupper((string)($r['side'] ?? '?')),
    'entry' => isset($r['entry']) ? (float)$r['entry'] : null, 'sl' => isset($r['sl']) ? (float)$r['sl'] : null, 'tp' => isset($r['tp']) ? (float)$r['tp'] : null,
    'status' => preg_replace('/[^\x20-\x7E]/u', '', (string)($r['status'] ?? '')),
    'r' => qi_signal_r_satu($r)['r'],
], array_slice(array_values(array_filter($pine, 'is_array')), 0, 10));
$sinyalPine = [
    'rekor' => count($pine),
    'statistik' => $ambil($statPine),
    'terakhir' => $pineTerakhir,
    'catatan' => 'Sinyal dari indikator Pine "XAU SMC+SnD BUY SELL COMBO" (XAUUSD, H4). Dicatat otomatis saat status berubah menjadi VALID; dinilai sampai TP3 atau SL (SL didahulukan bila bersamaan). Catatan terpisah dari sinyal resmi dan masih masa uji.',
];

echo json_encode([
    'status' => 'success',
    'diperbarui' => gmdate('c'),
    'sinyal_resmi' => [
        // Drawdown DIPUBLIKASIKAN, bukan hanya win rate. qi_signal_drawdown() sudah lama
        // menghitungnya untuk panel internal, tetapi halaman publik hanya menampilkan win
        // rate dan expectancy — padahal justru penurunan puncak-ke-dasar yang menentukan
        // apakah sebuah sistem bisa diikuti tanpa membuat akun habis di tengah jalan.
        'statistik' => $ambil($stat) + ['per_simbol' => $perSimbol, 'drawdown' => $drawdown],
        'terakhir' => $terakhir,
        'periode' => $periode,
        'total_tercatat' => count($resmi),
    ],
    'sinyal_bayangan' => $bay,
    'sinyal_pine' => $sinyalPine,
    'metodologi' => [
        'Setiap sinyal dicatat otomatis saat diterbitkan (waktu, arah, entry, SL, TP). Tidak ada sinyal yang dihapus atau diubah supaya terlihat lebih baik.',
        'Hasil dinilai otomatis dari candle sesudah sinyal terbit: TP lebih dulu = menang, SL lebih dulu = kalah. Bila satu candle menyentuh SL dan TP sekaligus, SL dihitung lebih dulu (konservatif).',
        'Sinyal yang kedaluwarsa tanpa menyentuh TP/SL dilaporkan terpisah dan tidak masuk win rate.',
        'Hasil dihitung dalam R (kelipatan risiko; 1R = jarak entry ke stop loss) agar pair berbeda bisa dibandingkan. Spread dan komisi broker belum dikurangkan.',
        'Win rate selalu disertai interval keyakinan Wilson 95%. Sampel di bawah 30 sinyal selesai ditandai kecil: angkanya belum bisa dijadikan pegangan.',
        'Sinyal bayangan (berbasis struktur SMC/ICT/Fibonacci/S&D) dikumpulkan dulu minimal 100 sinyal tertutup sebelum dipromosikan menjadi sinyal resmi.',
    ],
    'peringatan' => 'Hasil masa lalu tidak menjamin hasil di masa depan. Trading memiliki risiko kerugian, termasuk seluruh modal. Informasi ini bukan saran investasi.',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
