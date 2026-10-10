<?php
/**
 * Trading Leaderboard API
 * GET → top 10 traders by realized P&L dari paper_positions (public, tidak butuh auth)
 *       Optional: jika token dikirim, kembalikan juga stats & rank user tersebut
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method tidak diizinkan']);
    exit();
}

$pdo = qi_db();

// Tampilkan nama secara parsial untuk privasi: "Ahmad Wahyu" → "Ahmad W."
function qi_mask_name(string $name): string {
    $parts = preg_split('/\s+/', trim($name));
    if (count($parts) === 1) {
        return mb_substr($parts[0], 0, 3) . '***';
    }
    $last = mb_strtoupper(mb_substr(end($parts), 0, 1));
    return $parts[0] . ' ' . $last . '.';
}

// ── Top 10 leaderboard ────────────────────────────────────────────────────
$sql = "
    SELECT
        pp.user_id,
        u.full_name,
        COUNT(pp.id)                                                                      AS total_trades,
        SUM(CASE WHEN pp.pnl_usd > 0 THEN 1 ELSE 0 END)                                 AS wins,
        ROUND(SUM(CASE WHEN pp.pnl_usd > 0 THEN 1 ELSE 0 END) / COUNT(pp.id) * 100, 1) AS win_rate,
        ROUND(SUM(pp.pnl_usd), 2)                                                        AS total_pnl
    FROM paper_positions pp
    JOIN users u ON u.id = pp.user_id
    WHERE pp.status = 'closed'
    GROUP BY pp.user_id
    HAVING COUNT(pp.id) >= 3
    ORDER BY total_pnl DESC
    LIMIT 10
";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$leaderboard = [];
foreach ($rows as $i => $r) {
    $leaderboard[] = [
        'rank'         => $i + 1,
        'name'         => qi_mask_name($r['full_name']),
        'win_rate'     => (float) $r['win_rate'],
        'total_pnl'    => (float) $r['total_pnl'],
        'total_trades' => (int)   $r['total_trades'],
    ];
}

// ── Stats user yang sedang login (opsional) ───────────────────────────────
$my_stats = null;
$me = qi_validate_token();
if ($me) {
    $uid = (int)$me['user_id'];

    $meStmt = $pdo->prepare("
        SELECT
            COUNT(id)                                                                         AS total_trades,
            SUM(CASE WHEN pnl_usd > 0 THEN 1 ELSE 0 END)                                    AS wins,
            ROUND(SUM(CASE WHEN pnl_usd > 0 THEN 1 ELSE 0 END) / COUNT(id) * 100, 1)        AS win_rate,
            ROUND(SUM(pnl_usd), 2)                                                            AS total_pnl
        FROM paper_positions
        WHERE user_id = :uid AND status = 'closed'
    ");
    $meStmt->execute([':uid' => $uid]);
    $meRow = $meStmt->fetch(PDO::FETCH_ASSOC);

    if ($meRow && (int)$meRow['total_trades'] > 0) {
        // Hitung rank di antara semua user (min 3 trades)
        $rankStmt = $pdo->prepare("
            SELECT COUNT(*) + 1 AS my_rank
            FROM (
                SELECT SUM(pnl_usd) AS pnl
                FROM paper_positions
                WHERE status = 'closed'
                GROUP BY user_id
                HAVING COUNT(id) >= 3
            ) sub
            WHERE sub.pnl > :my_pnl
        ");
        $rankStmt->execute([':my_pnl' => (float)$meRow['total_pnl']]);
        $rankRow = $rankStmt->fetch(PDO::FETCH_ASSOC);

        $my_stats = [
            'rank'         => (int)($rankRow['my_rank'] ?? 99),
            'win_rate'     => (float) $meRow['win_rate'],
            'total_pnl'    => (float) $meRow['total_pnl'],
            'total_trades' => (int)   $meRow['total_trades'],
            'eligible'     => (int)$meRow['total_trades'] >= 3,
        ];
    }
}

echo json_encode([
    'status'      => 'success',
    'leaderboard' => $leaderboard,
    'my_stats'    => $my_stats,
    'total_users' => count($leaderboard),
]);
