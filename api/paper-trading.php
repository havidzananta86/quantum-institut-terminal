<?php
/**
 * Paper Trading Persistence API
 *
 * GET  → muat snapshot posisi & history milik user (butuh token)
 * POST → simpan snapshot (replace-all) {balance, positions[], history[]}
 *
 * Paper trading = uang virtual, jadi tidak ada risiko finansial nyata.
 * Tetap divalidasi tipe & dibatasi ukuran array untuk cegah payload sampah.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

$user = qi_require_auth();          // 401 kalau token invalid
$uid  = (int)$user['user_id'];
$pdo  = qi_db();

$ALLOWED_SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','XRPUSDT','DOGEUSDT'];
$STARTING_BALANCE = 10000.0;

// ─── GET: muat snapshot ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT * FROM paper_positions WHERE user_id = :uid ORDER BY opened_at ASC, id ASC');
    $stmt->execute([':uid' => $uid]);
    $rows = $stmt->fetchAll();

    $positions = [];
    $history   = [];
    $closedPnl = 0.0;

    foreach ($rows as $r) {
        $obj = [
            'id'         => 'POS-' . $r['id'],
            'symbol'     => $r['symbol'],
            'side'       => $r['direction'],
            'lots'       => (float)$r['lots'],
            'entryPrice' => (float)$r['entry_price'],
            'sl'         => $r['stop_loss']   !== null ? (float)$r['stop_loss']   : null,
            'tp'         => $r['take_profit'] !== null ? (float)$r['take_profit'] : null,
        ];
        if ($r['status'] === 'open') {
            $obj['floatingPnL'] = 0;
            $obj['openTime']    = $r['opened_at'] ? date('H:i:s', strtotime($r['opened_at'])) : '';
            $positions[] = $obj;
        } else {
            $obj['closePrice']  = (float)$r['close_price'];
            $obj['realizedPnL'] = (float)$r['pnl_usd'];
            $obj['closeTime']   = $r['closed_at'] ? date('H:i:s', strtotime($r['closed_at'])) : '';
            $closedPnl += (float)$r['pnl_usd'];
            $history[] = $obj;
        }
    }

    // Client menampilkan history terbaru di atas (unshift) → balik urutan
    $history = array_reverse($history);

    echo json_encode(['status' => 'success', 'data' => [
        'balance'   => round($STARTING_BALANCE + $closedPnl, 2),
        'positions' => $positions,
        'history'   => $history,
    ]]);
    exit();
}

// ─── POST: simpan snapshot (replace-all) ─────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = qi_get_json_body();
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
        exit();
    }

    $positions = is_array($input['positions'] ?? null) ? $input['positions'] : [];
    $history   = is_array($input['history']   ?? null) ? $input['history']   : [];

    // Batasi ukuran agar tidak jadi vektor DoS
    if (count($positions) > 200 || count($history) > 1000) {
        http_response_code(413);
        echo json_encode(['status' => 'error', 'message' => 'Terlalu banyak posisi/history.']);
        exit();
    }

    $normSym = function ($s) use ($ALLOWED_SYMBOLS) {
        $s = strtoupper(is_string($s) ? trim($s) : '');
        return in_array($s, $ALLOWED_SYMBOLS, true) ? $s : null;
    };
    $num = function ($v) {
        return (is_numeric($v)) ? (float)$v : null;
    };

    try {
        $pdo->beginTransaction();

        $pdo->prepare('DELETE FROM paper_positions WHERE user_id = :uid')
            ->execute([':uid' => $uid]);

        $ins = $pdo->prepare(
            'INSERT INTO paper_positions
             (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, close_price, pnl_usd, status, opened_at, closed_at)
             VALUES (:uid, :sym, :dir, :lots, :entry, :sl, :tp, :close, :pnl, :status, NOW(), :closed)'
        );

        $insertRow = function ($p, $status) use ($ins, $uid, $normSym, $num) {
            $sym = $normSym($p['symbol'] ?? '');
            $entry = $num($p['entryPrice'] ?? null);
            if ($sym === null || $entry === null || $entry <= 0) return; // skip baris rusak
            $dir = (($p['side'] ?? 'BUY') === 'SELL') ? 'SELL' : 'BUY';
            $lots = $num($p['lots'] ?? 0.1) ?: 0.1;
            $ins->execute([
                ':uid'    => $uid,
                ':sym'    => $sym,
                ':dir'    => $dir,
                ':lots'   => $lots,
                ':entry'  => $entry,
                ':sl'     => $num($p['sl'] ?? null),
                ':tp'     => $num($p['tp'] ?? null),
                ':close'  => $status === 'closed' ? $num($p['closePrice'] ?? null) : null,
                ':pnl'    => $status === 'closed' ? ($num($p['realizedPnL'] ?? 0) ?? 0) : null,
                ':status' => $status,
                ':closed' => $status === 'closed' ? date('Y-m-d H:i:s') : null,
            ]);
        };

        foreach ($positions as $p) $insertRow($p, 'open');
        foreach ($history   as $p) $insertRow($p, 'closed');

        $pdo->commit();
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[QI PaperTrading] save error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan posisi.']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Metode tidak didukung.']);
