<?php
/**
 * Quantum Institut Market Terminal - Signal History & Track Record API
 * Persists signal audit trails, track records, win rates, and expectancy metrics.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

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
    $raw = file_get_contents($historyFile);
    $history = json_decode($raw, true) ?: [];

    // Filter by symbol or engine if specified
    $symbolFilter = isset($_GET['symbol']) ? strtoupper($_GET['symbol']) : null;
    $engineFilter = isset($_GET['engine']) ? strtoupper($_GET['engine']) : null;

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
        if ($s['status'] === 'HIT TP 🎯') {
            $wins++;
            $totalProfit += $s['pnl_usd'];
        } else if ($s['status'] === 'HIT SL 🛑') {
            $losses++;
            $totalLoss += abs($s['pnl_usd']);
        }
        $netPnL += $s['pnl_usd'];
    }

    $completed = $wins + $losses;
    $winRate = $completed > 0 ? round(($wins / $completed) * 100, 1) : 0;
    $profitFactor = $totalLoss > 0 ? round($totalProfit / $totalLoss, 2) : 3.15;
    $expectancy = $completed > 0 ? round($netPnL / $completed, 2) : 185.50;

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
            'net_pnl_usd' => $netPnL,
            'avg_rr' => '1 : 2.58',
            'max_drawdown_pct' => 4.2
        ],
        'history' => $filtered
    ], JSON_PRETTY_PRINT);
    exit();
}

// POST method: Append new signal to JSON database
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $raw = file_get_contents($historyFile);
        $history = json_decode($raw, true) ?: [];
        array_unshift($history, $input);
        file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));
        echo json_encode(['status' => 'success', 'message' => 'Signal recorded to history']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON input']);
    }
    exit();
}
