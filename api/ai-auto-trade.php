<?php
/**
 * Quantum AI Auto-Trade API
 *
 * GET  → ambil status AI auto-trade user + AI trade log
 * POST {action:'enable',  symbols:[]}   → aktifkan AI untuk simbol tertentu
 * POST {action:'disable'}               → matikan AI auto-trade
 * POST {action:'execute', symbol:'...', signal:{...}} → eksekusi trade dari signal AI
 * POST {action:'close',   position_id:123}            → tutup posisi AI secara manual
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_paper_math.php';
qi_rate_limit(30, 60);

$user = qi_require_level('vip');  // AI Auto-Trade — VIP (eksekusi)
$uid  = (int)$user['user_id'];
$pdo  = qi_db();

// ── Pastikan tabel yang dibutuhkan sudah ada (dibuat oleh migrasi 007) ────
// Sebelumnya blok ini menjalankan CREATE TABLE / ALTER TABLE pada SETIAP request:
// lambat, berisiko lock, dan mengubah struktur database tanpa migrasi. Sekarang
// hanya diperiksa; bila migrasi belum dijalankan, API menjawab dengan jelas.
try {
    $readySettings = $pdo->query("SHOW TABLES LIKE 'ai_settings'")->fetch();
    $readyLog      = $pdo->query("SHOW TABLES LIKE 'ai_trade_log'")->fetch();
    $readySource   = $pdo->query("SHOW COLUMNS FROM paper_positions LIKE 'source'")->fetch();
    if (!$readySettings || !$readyLog || !$readySource) {
        http_response_code(503);
        echo json_encode([
            'status'  => 'error',
            'code'    => 'MIGRATION_REQUIRED',
            'message' => 'Modul AI Auto-Trade belum diaktifkan. Jalankan migrasi database (007).',
        ]);
        exit;
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode([
        'status'  => 'error',
        'code'    => 'MIGRATION_REQUIRED',
        'message' => 'Modul AI Auto-Trade belum siap. Jalankan migrasi database (007).',
    ]);
    exit;
}

// ── GET: status AI + log ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $settStmt = $pdo->prepare('SELECT * FROM ai_settings WHERE user_id = :uid');
    $settStmt->execute([':uid' => $uid]);
    $sett = $settStmt->fetch(PDO::FETCH_ASSOC);

    $logStmt = $pdo->prepare(
        'SELECT atl.*, pp.status AS pos_status, pp.pnl_usd AS pos_pnl
         FROM ai_trade_log atl
         LEFT JOIN paper_positions pp ON pp.id = atl.position_id
         WHERE atl.user_id = :uid
         ORDER BY atl.created_at DESC LIMIT 30'
    );
    $logStmt->execute([':uid' => $uid]);
    $log = $logStmt->fetchAll(PDO::FETCH_ASSOC);

    // Open AI positions
    $openStmt = $pdo->prepare(
        "SELECT * FROM paper_positions
         WHERE user_id = :uid AND status = 'open' AND source = 'ai'
         ORDER BY opened_at DESC"
    );
    $openStmt->execute([':uid' => $uid]);
    $openPos = $openStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status'   => 'success',
        'settings' => $sett ?: ['enabled' => 0, 'symbols' => null, 'lots' => 0.10],
        'log'      => $log,
        'open_positions' => $openPos,
    ]);
    exit;
}

// ── POST: aksi ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Metode tidak didukung']);
    exit;
}

$body   = qi_get_json_body() ?: [];
$action = qi_sanitize_string($body['action'] ?? '', 20);

// ── enable ────────────────────────────────────────────────────────────────
if ($action === 'enable') {
    $ALLOWED_SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','XRPUSDT'];
    $raw = is_array($body['symbols'] ?? null) ? $body['symbols'] : ['BTCUSDT','XAUUSD','EURUSD'];
    $syms = array_values(array_filter($raw, fn($s) => in_array(strtoupper((string)$s), $ALLOWED_SYMS, true)));
    if (empty($syms)) $syms = ['BTCUSDT'];

    $lots = max(0.01, min(10.0, (float)($body['lots'] ?? 0.10)));

    $stmt = $pdo->prepare(
        'INSERT INTO ai_settings (user_id, enabled, symbols, lots)
         VALUES (:uid, 1, :syms, :lots)
         ON DUPLICATE KEY UPDATE enabled = 1, symbols = :syms, lots = :lots'
    );
    $stmt->execute([':uid' => $uid, ':syms' => json_encode($syms), ':lots' => $lots]);
    echo json_encode(['status' => 'success', 'message' => 'AI Auto-Trade diaktifkan', 'symbols' => $syms]);
    exit;
}

// ── disable ───────────────────────────────────────────────────────────────
if ($action === 'disable') {
    $stmt = $pdo->prepare('INSERT INTO ai_settings (user_id, enabled) VALUES (:uid, 0) ON DUPLICATE KEY UPDATE enabled = 0');
    $stmt->execute([':uid' => $uid]);
    echo json_encode(['status' => 'success', 'message' => 'AI Auto-Trade dinonaktifkan']);
    exit;
}

// ── execute: buka paper trade berdasarkan signal AI ──────────────────────
if ($action === 'execute') {
    $ALLOWED_SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','XRPUSDT'];
    $symbol = strtoupper(qi_sanitize_string($body['symbol'] ?? '', 12));
    if (!in_array($symbol, $ALLOWED_SYMS, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Simbol tidak valid']);
        exit;
    }

    $sig = is_array($body['signal'] ?? null) ? $body['signal'] : [];
    $aiAction  = $sig['action'] ?? 'SKIP';
    $confidence= max(0, min(100, (int)($sig['confidence'] ?? 0)));
    $ep        = (float)($sig['entry_price'] ?? 0);
    $tp        = (float)($sig['tp'] ?? 0);
    $sl        = (float)($sig['sl'] ?? 0);
    $rr        = (float)($sig['risk_reward'] ?? 0);
    $reason    = mb_substr(preg_replace('/[^\w\s.,!?:%()\/&-]/u', '', $sig['reason'] ?? ''), 0, 200);

    if (!in_array($aiAction, ['ENTRY_BUY','ENTRY_SELL'])) {
        echo json_encode(['status' => 'skip', 'message' => 'AI menyarankan SKIP untuk ' . $symbol]);
        exit;
    }

    // Guardrail Berita: Lindungi auto-trade dari eksekusi saat High-Impact news blackout aktif
    if (function_exists('qi_berita_blackout')) {
        $blackout = qi_berita_blackout(30, true);
        if (!empty($blackout['aktif'])) {
            $mataTerdampak = false;
            foreach (($blackout['events'] ?? []) as $ev) {
                $mata = strtoupper((string)($ev['currency'] ?? ($ev['country'] ?? '')));
                if ($mata !== '' && strpos(strtoupper($symbol), $mata) !== false) {
                    $mataTerdampak = true;
                    break;
                }
                if ($mata === 'USD' && (strpos(strtoupper($symbol), 'XAU') !== false || strpos(strtoupper($symbol), 'BTC') !== false)) {
                    $mataTerdampak = true;
                    break;
                }
            }
            if ($mataTerdampak && ($sig['engine'] ?? '') !== 'NEWS') {
                echo json_encode([
                    'status'   => 'skip',
                    'message'  => 'Auto-trade ditahan oleh proteksi High-Impact News Blackout (±30 menit rilis berita) untuk melindungi modal dari pelebaran spread dan slippage liar.',
                    'blackout' => $blackout,
                ]);
                exit;
            }
        }
    }

    // Cek apakah sudah ada posisi terbuka untuk simbol ini
    $chkStmt = $pdo->prepare(
        "SELECT id FROM paper_positions WHERE user_id = :uid AND symbol = :sym AND status = 'open' LIMIT 1"
    );
    $chkStmt->execute([':uid' => $uid, ':sym' => $symbol]);
    if ($chkStmt->fetchColumn()) {
        echo json_encode(['status' => 'skip', 'message' => 'Sudah ada posisi terbuka untuk ' . $symbol]);
        exit;
    }

    // Ambil lots dari settings, default 0.10
    $lotsStmt = $pdo->prepare('SELECT lots FROM ai_settings WHERE user_id = :uid');
    $lotsStmt->execute([':uid' => $uid]);
    $lots = (float)($lotsStmt->fetchColumn() ?: 0.10);

    $direction = $aiAction === 'ENTRY_BUY' ? 'BUY' : 'SELL';

    $pdo->beginTransaction();
    try {
        $ins = $pdo->prepare(
            "INSERT INTO paper_positions
             (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, status, source, opened_at)
             VALUES (:uid, :sym, :dir, :lots, :ep, :sl, :tp, 'open', 'ai', NOW())"
        );
        $ins->execute([
            ':uid'  => $uid,
            ':sym'  => $symbol,
            ':dir'  => $direction,
            ':lots' => $lots,
            ':ep'   => $ep > 0 ? $ep : null,
            ':sl'   => $sl > 0 ? $sl : null,
            ':tp'   => $tp > 0 ? $tp : null,
        ]);
        $posId = (int)$pdo->lastInsertId();

        // Log AI decision
        $log = $pdo->prepare(
            "INSERT INTO ai_trade_log
             (user_id, symbol, action, confidence, entry_price, tp, sl, risk_reward, reason, executed, position_id)
             VALUES (:uid, :sym, :act, :conf, :ep, :tp, :sl, :rr, :reason, 1, :posid)"
        );
        $log->execute([
            ':uid'    => $uid,
            ':sym'    => $symbol,
            ':act'    => $aiAction,
            ':conf'   => $confidence,
            ':ep'     => $ep > 0 ? $ep : null,
            ':tp'     => $tp > 0 ? $tp : null,
            ':sl'     => $sl > 0 ? $sl : null,
            ':rr'     => $rr,
            ':reason' => $reason,
            ':posid'  => $posId,
        ]);

        $pdo->commit();
        echo json_encode([
            'status'      => 'success',
            'message'     => "AI membuka posisi {$direction} {$symbol}",
            'position_id' => $posId,
            'symbol'      => $symbol,
            'direction'   => $direction,
            'lots'        => $lots,
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[AI AutoTrade] execute error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Gagal membuka posisi']);
    }
    exit;
}

// ── close: tutup posisi AI ───────────────────────────────────────────────
if ($action === 'close') {
    $posId      = (int)($body['position_id'] ?? 0);
    $closePrice = (float)($body['close_price'] ?? 0);

    if ($posId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'position_id tidak valid']);
        exit;
    }

    $posStmt = $pdo->prepare(
        "SELECT * FROM paper_positions WHERE id = :id AND user_id = :uid AND status = 'open'"
    );
    $posStmt->execute([':id' => $posId, ':uid' => $uid]);
    $pos = $posStmt->fetch(PDO::FETCH_ASSOC);

    if (!$pos) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Posisi tidak ditemukan atau sudah ditutup']);
        exit;
    }

    $ep  = (float)$pos['entry_price'];
    $cp  = $closePrice > 0 ? $closePrice : $ep;

    // Hitung P/L memakai model yang sama dengan sisi klien (_pipMult), supaya angka
    // yang dilihat pengguna saat floating sama dengan yang tersimpan saat ditutup.
    $lots   = (float)$pos['lots'];
    $pnl    = qi_paper_pnl((string)$pos['symbol'], (string)$pos['direction'], $ep, (float)$cp, $lots);

    $closeStmt = $pdo->prepare(
        "UPDATE paper_positions
         SET status='closed', close_price=:cp, pnl_usd=:pnl, closed_at=NOW()
         WHERE id=:id AND user_id=:uid"
    );
    $closeStmt->execute([':cp' => $cp, ':pnl' => $pnl, ':id' => $posId, ':uid' => $uid]);

    echo json_encode([
        'status'      => 'success',
        'message'     => 'Posisi ditutup',
        'position_id' => $posId,
        'close_price' => $cp,
        'pnl_usd'     => $pnl,
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Action tidak dikenali: ' . $action]);
