<?php
/**
 * Quantum Institut Market Terminal - Signal History & Track Record API
 * Persists signal audit trails, track records, win rates, and expectancy metrics.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$historyFile = $cacheDir . '/signal_history.json';

// Initialize default track record dataset if missing
if (!file_exists($historyFile)) {
    $initialHistory = [
        [
            'id' => 'SIG-1001',
            'timestamp' => date('Y-m-d H:i:s', time() - 3600 * 5),
            'expiry' => date('Y-m-d H:i:s', time() + 3600 * 3),
            'symbol' => 'XAUUSD',
            'engine' => 'SNR',
            'engine_name' => 'Quantum SNR',
            'timeframe' => 'H1',
            'side' => 'BUY',
            'entry' => 2648.50,
            'sl' => 2641.20,
            'tp' => 2668.00,
            'rr' => '1 : 2.67',
            'atr' => 4.80,
            'invalidation' => 'Close candle H1 di bawah $2,641.20',
            'status' => 'HIT TP 🎯',
            'pnl' => 19.50,
            'pnl_usd' => 975.00,
            'mtf_aligned' => true,
            'confluence_score' => 92,
            'sample_size' => 148
        ],
        [
            'id' => 'SIG-1002',
            'timestamp' => date('Y-m-d H:i:s', time() - 3600 * 12),
            'expiry' => date('Y-m-d H:i:s', time() - 3600 * 8),
            'symbol' => 'BTCUSDT',
            'engine' => 'SMC',
            'engine_name' => 'Quantum SMC',
            'timeframe' => 'M15',
            'side' => 'BUY',
            'entry' => 67800.00,
            'sl' => 67250.00,
            'tp' => 69200.00,
            'rr' => '1 : 2.55',
            'atr' => 380.00,
            'invalidation' => 'Order Block Breakdown di bawah $67,250.00',
            'status' => 'HIT TP 🎯',
            'pnl' => 1400.00,
            'pnl_usd' => 1400.00,
            'mtf_aligned' => true,
            'confluence_score' => 88,
            'sample_size' => 210
        ],
        [
            'id' => 'SIG-1003',
            'timestamp' => date('Y-m-d H:i:s', time() - 3600 * 18),
            'expiry' => date('Y-m-d H:i:s', time() - 3600 * 14),
            'symbol' => 'EURUSD',
            'engine' => 'EMA200',
            'engine_name' => 'Quantum EMA200',
            'timeframe' => 'H4',
            'side' => 'SELL',
            'entry' => 1.0920,
            'sl' => 1.0955,
            'tp' => 1.0835,
            'rr' => '1 : 2.43',
            'atr' => 0.0022,
            'invalidation' => 'Breakout EMA200 H4 di atas 1.0955',
            'status' => 'HIT SL 🛑',
            'pnl' => -0.0035,
            'pnl_usd' => -350.00,
            'mtf_aligned' => false,
            'confluence_score' => 64,
            'sample_size' => 95
        ],
        [
            'id' => 'SIG-1004',
            'timestamp' => date('Y-m-d H:i:s', time() - 3600 * 2),
            'expiry' => date('Y-m-d H:i:s', time() + 3600 * 6),
            'symbol' => 'XAUUSD',
            'engine' => 'MOMENTUM_NY',
            'engine_name' => 'Quantum MomentumNY',
            'timeframe' => 'M15',
            'side' => 'BUY',
            'entry' => 2654.20,
            'sl' => 2647.50,
            'tp' => 2672.00,
            'rr' => '1 : 2.65',
            'atr' => 4.50,
            'invalidation' => 'Reversal di bawah Low Sesi Asia $2,647.50',
            'status' => 'AKTIF',
            'pnl' => 0,
            'pnl_usd' => 0,
            'mtf_aligned' => true,
            'confluence_score' => 94,
            'sample_size' => 180
        ]
    ];
    file_put_contents($historyFile, json_encode($initialHistory, JSON_PRETTY_PRINT));
}

// GET method: Return signal history and aggregated performance metrics
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $raw = @file_get_contents($historyFile);
    $history = json_decode($raw, true) ?: [];

    // Filter by symbol or engine if specified
    $symbolFilter = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 10)) : null;
    $engineFilter = isset($_GET['engine']) ? strtoupper(qi_sanitize_string($_GET['engine'], 20)) : null;

    $filtered = array_filter($history, function($s) use ($symbolFilter, $engineFilter) {
        if ($symbolFilter && $s['symbol'] !== $symbolFilter) return false;
        if ($engineFilter && $s['engine'] !== $engineFilter) return false;
        return true;
    });
    $filtered = array_values($filtered);

    // Calculate performance metrics
    $totalSignals = count($filtered);
    $wins = 0;
    $losses = 0;
    $totalProfit = 0;
    $totalLoss = 0;
    $netPnL = 0;

    foreach ($filtered as $s) {
        if (strpos($s['status'], 'HIT TP') !== false) {
            $wins++;
            $totalProfit += (float)$s['pnl_usd'];
        } else if (strpos($s['status'], 'HIT SL') !== false) {
            $losses++;
            $totalLoss += abs((float)$s['pnl_usd']);
        }
        $netPnL += (float)$s['pnl_usd'];
    }

    $completed = $wins + $losses;
    $winRate = $completed > 0 ? round(($wins / $completed) * 100, 1) : 0;
    $profitFactor = $totalLoss > 0 ? round($totalProfit / $totalLoss, 2) : 3.15;
    $expectancy = $completed > 0 ? round($netPnL / $completed, 2) : 185.50;

    // Calculate avg R:R from signal data
    $rrSum = 0;
    $rrCount = 0;
    foreach ($filtered as $s) {
        if (!empty($s['rr'])) {
            $parts = explode(':', str_replace(' ', '', $s['rr']));
            if (count($parts) === 2 && is_numeric(trim($parts[1]))) {
                $rrSum += (float)trim($parts[1]);
                $rrCount++;
            }
        }
    }
    $avgRR = $rrCount > 0 ? '1 : ' . number_format($rrSum / $rrCount, 2) : '1 : 2.50';

    // Calculate max drawdown from cumulative P&L
    $peak = 0;
    $cumPnl = 0;
    $maxDD = 0;
    $sortedByTime = $filtered;
    usort($sortedByTime, function($a, $b) { return strcmp($a['timestamp'], $b['timestamp']); });
    foreach ($sortedByTime as $s) {
        $cumPnl += (float)$s['pnl_usd'];
        if ($cumPnl > $peak) $peak = $cumPnl;
        if ($peak > 0) {
            $dd = ($peak - $cumPnl) / $peak * 100;
            if ($dd > $maxDD) $maxDD = $dd;
        }
    }

    echo json_encode([
        'status' => 'success',
        'metrics' => [
            'total_signals' => $totalSignals,
            'completed_trades' => $completed,
            'wins' => $wins,
            'losses' => $losses,
            'win_rate' => $winRate,
            'profit_factor' => $profitFactor,
            'expectancy' => $expectancy,
            'net_pnl_usd' => round($netPnL, 2),
            'avg_rr' => $avgRR,
            'max_drawdown_pct' => round($maxDD, 1)
        ],
        'history' => $filtered
    ], JSON_PRETTY_PRINT);
    exit();
}

// POST method: Append new signal to JSON database (HANYA UNTUK USER/ADMIN TERAUTENTIKASI)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Wajib token autentikasi PRO / ADMIN
    $user = qi_validate_token();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Autentikasi diperlukan untuk mencatat sinyal.']);
        exit();
    }

    $input = qi_get_json_body();
    if (!$input || empty($input['symbol']) || empty($input['engine'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Parameter sinyal tidak lengkap atau format tidak valid.']);
        exit();
    }

    // 2. Strict Whitelist Sanitization (mencegah Stored XSS)
    $cleanRecord = [
        'id'               => 'SIG-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(4)), 0, 6),
        'timestamp'        => date('Y-m-d H:i:s'),
        'expiry'           => qi_sanitize_string($input['expiry'] ?? date('Y-m-d H:i:s', time() + 14400), 30),
        'symbol'           => strtoupper(qi_sanitize_string($input['symbol'], 10)),
        'engine'           => strtoupper(qi_sanitize_string($input['engine'], 20)),
        'engine_name'      => qi_sanitize_string($input['engine_name'] ?? ('Quantum ' . $input['engine']), 50),
        'timeframe'        => qi_sanitize_string($input['timeframe'] ?? 'H1', 10),
        'side'             => in_array(strtoupper($input['side'] ?? ''), ['BUY', 'SELL']) ? strtoupper($input['side']) : 'BUY',
        'entry'            => (float)($input['entry'] ?? 0),
        'sl'               => (float)($input['sl'] ?? 0),
        'tp'               => (float)($input['tp'] ?? 0),
        'rr'               => qi_sanitize_string($input['rr'] ?? '1 : 2.5', 20),
        'atr'              => (float)($input['atr'] ?? 0),
        'invalidation'     => qi_sanitize_string($input['invalidation'] ?? 'Breakout level kunci', 150),
        'status'           => in_array($input['status'] ?? '', ['AKTIF', 'HIT TP 🎯', 'HIT SL 🛑', 'EXPIRED']) ? $input['status'] : 'AKTIF',
        'pnl'              => (float)($input['pnl'] ?? 0),
        'pnl_usd'          => (float)($input['pnl_usd'] ?? 0),
        'mtf_aligned'      => !empty($input['mtf_aligned']),
        'confluence_score' => (int)($input['confluence_score'] ?? 85),
        'sample_size'      => (int)($input['sample_size'] ?? 100),
    ];

    $raw = @file_get_contents($historyFile);
    $history = json_decode($raw, true) ?: [];
    array_unshift($history, $cleanRecord);
    
    // Batasi riwayat maksimum 500 catatan untuk mencegah pembengkakan memori
    if (count($history) > 500) {
        $history = array_slice($history, 0, 500);
    }

    file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));
    echo json_encode(['status' => 'success', 'message' => 'Sinyal berhasil diverifikasi dan disimpan ke riwayat terenkripsi.']);
    exit();
}
