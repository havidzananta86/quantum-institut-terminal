<?php
/**
 * Trading Leaderboard API — ALIAS TIPIS papan Weekly Championship.
 *
 * GET → peringkat minggu berjalan dari pembangun papan yang SAMA dengan api/competition.php?papan=weekly
 *       (api/_kompetisi_papan.php): ekuitas langsung, posisi manual periode ini, cache 5 detik.
 *
 * MENGAPA ALIAS (audit kompetisi 2026-10-22): endpoint ini dulu punya papan sendiri — sepanjang waktu,
 * minimal 3 trade, hadiah "Free 1 Bulan Quantum+ PRO" — sementara arena dan halaman Competition memakai
 * papan mingguan dengan hadiah lain. Anggota melihat peringkat dan hadiah BERBEDA untuk kompetisi yang
 * sama. Sekarang hanya ada satu papan.
 *
 * Bentuk jawaban dipertahankan untuk panel Leaderboard dashboard (assets/js/advanced-trading.js):
 *   leaderboard[{rank, name, win_rate, total_pnl, total_trades, badge, prize}], my_stats, total_users
 * dengan arti yang kini mengikuti papan mingguan: total_pnl = ekuitas − $10.000 (terealisasi +
 * mengambang periode ini), prize = null (hadiah resmi ada di halaman Competition), dan kolom tambahan
 * equity, return_pct, periode.
 *
 * BUTUH PAKET PRO (qi_require_level('pro') di bawah), sama seperti panel dashboard yang memakainya.
 * Pengunjung tanpa login memantau papan yang SAMA lewat api/competition.php?papan=weekly (publik,
 * nama disamarkan). my_stats = baris pemanggil di papan mingguan.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_kompetisi_papan.php';
$me = qi_require_level('pro');   // Leaderboard (panel dashboard) — PRO
qi_rate_limit(60, 60);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method tidak diizinkan']);
    exit();
}

$pdo = qi_db();
try {
    $papan = qi_komp_papan($pdo);
} catch (Throwable $e) {
    qi_log('error', 'leaderboard (alias papan mingguan) gagal', ['pesan' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Papan peringkat tidak dapat dimuat.']);
    exit();
}

$uid = (int)$me['user_id'];
$lencana = ['diamond' => '🥇 Juara 1', 'platinum' => '🥈 Juara 2', 'gold' => '🥉 Juara 3', 'silver' => '🏅 10 Besar'];

$keBaris = static fn(array $b) => [
    'rank'         => $b['rank'],
    'name'         => $b['nama'],                       // nama tampilan atau nama asli DISAMARKAN
    'win_rate'     => (float)$b['win_rate'],
    'total_pnl'    => round($b['equity'] - QI_KOMP_SALDO_AWAL, 2),
    'total_trades' => (int)$b['trades'],
    'equity'       => $b['equity'],
    'return_pct'   => $b['return_pct'],
    'open_count'   => $b['open_count'],
    'harga_basi'   => $b['harga_basi'],
    'badge'        => $lencana[$b['lencana'] ?? ''] ?? null,
    'prize'        => null,
    'isMe'         => $uid > 0 && (int)$b['uid'] === $uid,
];

$leaderboard = array_map($keBaris, array_slice(array_values(array_filter($papan['baris'], static fn($b) => $b['aktif'])), 0, 10));

$my_stats = null;
foreach ($papan['baris'] as $b) {
    if ($uid > 0 && (int)$b['uid'] === $uid) {
        $my_stats = [
            'rank'         => $b['rank'],
            'win_rate'     => (float)$b['win_rate'],
            'total_pnl'    => round($b['equity'] - QI_KOMP_SALDO_AWAL, 2),
            'total_trades' => (int)$b['trades'],
            'equity'       => $b['equity'],
            'return_pct'   => $b['return_pct'],
            // Papan mingguan tidak punya syarat minimal trade untuk tampil; syarat HADIAH ada di
            // halaman Competition (api/_kompetisi_syarat.php).
            'eligible'     => (bool)$b['aktif'],
        ];
        break;
    }
}

echo json_encode([
    'status'      => 'success',
    'periode'     => $papan['periode'],
    'sumber'      => 'competition.php?papan=weekly',
    'leaderboard' => $leaderboard,
    'my_stats'    => $my_stats,
    'total_users' => $papan['trader'],
], JSON_UNESCAPED_UNICODE);
