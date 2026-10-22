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
require_once __DIR__ . '/_transparansi.php';   // status pemindai Pine (umur + cron), dilaporkan apa adanya

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
// STATUS PEMINDAI Pine (audit sinyal 2026-10-22): pemindai ini HANYA berjalan dari cron
// pemeliharaan (api/maintenance-cron.php) — tidak ada pemicu dari dashboard. Dulu halaman ini
// menulis "Dicatat otomatis" tanpa umur pemindai, padahal di produksi cron belum pernah jalan
// sehingga daftar Pine tidak pernah bertambah. Sekarang umur pemindaian terakhir dan status cron
// dilaporkan apa adanya, dan kalimat catatannya mengikuti status itu.
$pemindaiPine = qi_transparansi_pemindai(__DIR__ . '/../cache/pine_scan_auto.txt', time());
$sinyalPine = [
    'rekor' => count($pine),
    'statistik' => $ambil($statPine),
    'terakhir' => $pineTerakhir,
    'pemindai' => $pemindaiPine,
    'catatan' => 'Sinyal dari indikator Pine "XAU SMC+SnD BUY SELL COMBO" (XAUUSD, H4). Dicatat oleh pemindai terjadwal (cron pemeliharaan) saat status berubah menjadi VALID; '
        . 'dinilai sampai TP3 atau SL (bila keduanya tersentuh di candle yang sama: urutan dari candle M1, bila tidak tersedia SL didahulukan). '
        . 'Catatan terpisah dari sinyal resmi dan masih masa uji. ' . $pemindaiPine['kalimat'],
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
    // Metodologi ditulis SESUAI aturan penilai yang berlaku (api/signal-evaluator.php, versi
    // penilaian 1–4). Dulu masih berbunyi "spread belum dikurangkan" dan "SL selalu lebih dulu",
    // padahal sejak v2/v3 spread + slippage dikurangkan dan candle ambigu diurai dari M1.
    'metodologi' => [
        'Setiap sinyal dicatat otomatis saat diterbitkan (waktu, arah, entry, SL, TP). Tidak ada sinyal yang dihapus atau diubah supaya terlihat lebih baik.',
        'Entry diperiksa terhadap harga pasar saat sinyal dicatat: entry yang jauh dari harga digeser ke harga pasar (jarak SL/TP tetap), dan rencana yang TP atau SL-nya sudah dilewati harga ditolak. Forex/emas tidak diterbitkan saat pasar tutup (termasuk jeda harian emas), dan tidak ada sinyal yang diterbitkan dari data harga yang basi.',
        'Hasil dinilai otomatis dari candle sesudah sinyal terbit: TP lebih dulu = menang, SL lebih dulu = kalah. Bila satu candle menyentuh SL dan TP sekaligus, urutannya dicari dari candle 1 menit (M1); bila M1 tidak tersedia atau tetap ambigu, SL dihitung lebih dulu (konservatif).',
        'Candle yang dibuka sudah melewati TP/SL (gap) ditutup di harga pembukaannya, bukan tepat di level — kerugian gap bisa lebih dari 1R.',
        'Sejak aturan penilaian versi 4, sinyal yang entry-nya tidak tersedia di pasar saat terbit baru dihitung terisi bila harga mencapai entry (di entry, atau di harga pembukaan bila harga melompatinya); keputusan ini diambil dari candle paling halus yang tersedia. Bila entry tidak tercapai sampai kedaluwarsa, sinyal itu tidak dihitung menang maupun kalah.',
        'Sinyal yang kedaluwarsa tanpa menyentuh TP/SL dilaporkan terpisah dan tidak masuk win rate.',
        'Hasil dihitung dalam R (kelipatan risiko; 1R = jarak entry ke stop loss) agar pair berbeda bisa dibandingkan. Sejak aturan penilaian versi 2 spread dikurangkan (spread tipikal per simbol, atau spread broker saat terbit bila lebih lebar; kripto: spread + komisi dalam persen harga), dan sejak versi 3 juga slippage perkiraan pada entry dan SL. Komisi akun forex/emas belum dikurangkan. Rekor dari versi lama tidak dinilai ulang; statistiknya dipisah per versi.',
        'Win rate selalu disertai interval keyakinan Wilson 95%. Sampel di bawah 30 sinyal selesai ditandai kecil: angkanya belum bisa dijadikan pegangan.',
        'Sinyal bayangan (berbasis struktur SMC/ICT/Fibonacci/S&D) dikumpulkan dulu minimal 100 sinyal tertutup sebelum dipromosikan menjadi sinyal resmi.',
    ],
    'peringatan' => 'Hasil masa lalu tidak menjamin hasil di masa depan. Trading memiliki risiko kerugian, termasuk seluruh modal. Informasi ini bukan saran investasi.',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
