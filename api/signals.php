<?php
/**
 * Quantum Institut Market Terminal - Live Signals API
 * Returns Real-time Engine Readouts & Candlestick Data
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$symbol = isset($_GET['symbol']) ? strtoupper($_GET['symbol']) : 'BTCUSDT';
$timeframe = isset($_GET['timeframe']) ? strtoupper($_GET['timeframe']) : 'H1';
$engine = isset($_GET['engine']) ? strtoupper($_GET['engine']) : 'SNR';

// Mock live response data per symbol
$marketData = [
    'BTCUSDT' => [
        'price' => 68450.20,
        'change_24h' => 3.42,
        'high' => 68750.00,
        'low' => 67950.00,
        'volume' => '42.8B',
        'engines' => [
            'SNR' => [
                'status' => 'SETUP',
                'title' => 'Quantum SNR Setup',
                'description' => 'Harga berhasil bertahan di atas Key Support Level 67,900.00 setelah 3x retest.',
                'entry_range' => '68,420.50 - 68,550.00',
                'stop_loss' => '67,910.00 (-0.75%)',
                'take_profit' => '70,200.00 (+2.55%)',
                'risk_reward' => '1:3.4',
                'execution_cost_pct' => 5,
                'checklist' => [
                    ['name' => 'Retest Support Valid (>2x)', 'passed' => true],
                    ['name' => 'Rejection Candle Body', 'passed' => true],
                    ['name' => 'Ratio Risk:Reward >= 1:2.5', 'passed' => true],
                    ['name' => 'Penutupan Candle H1', 'passed' => false]
                ]
            ],
            'SMC' => [
                'status' => 'SETUP',
                'title' => 'Quantum SMC Order Block Sweep',
                'description' => 'Penyapuan likuiditas ritel (BSL) selesai. Harga memasuki zona Bullish Order Block.',
                'entry_range' => '68,300.00 - 68,400.00',
                'stop_loss' => '67,850.00 (-0.80%)',
                'take_profit' => '70,500.00 (+3.05%)',
                'risk_reward' => '1:3.8',
                'execution_cost_pct' => 5,
                'checklist' => [
                    ['name' => 'Liquidity Sweep Cleared', 'passed' => true],
                    ['name' => 'Bullish Order Block Valid', 'passed' => true],
                    ['name' => 'Change of Character (CHoCH)', 'passed' => true],
                    ['name' => 'Fair Value Gap Fill', 'passed' => true]
                ]
            ]
        ]
    ],
    'XAUUSD' => [
        'price' => 2654.20,
        'change_24h' => 0.85,
        'high' => 2660.00,
        'low' => 2642.50,
        'volume' => '18.4B',
        'engines' => [
            'SNR' => [
                'status' => 'PANTAU',
                'title' => 'Quantum MomentumNY (XAUUSD)',
                'description' => 'Menantikan pemicu pergeseran volume pada sesi pembukaan New York 19:30 WIB.',
                'entry_range' => '2,652.10 - 2,654.50',
                'stop_loss' => '2,646.00 (-0.30%)',
                'take_profit' => '2,675.00 (+0.80%)',
                'risk_reward' => '1:2.7',
                'execution_cost_pct' => 5,
                'checklist' => [
                    ['name' => 'New York Session Active', 'passed' => true],
                    ['name' => 'Gold Impulse Break', 'passed' => false],
                    ['name' => 'Risk:Reward >= 1:2.5', 'passed' => true]
                ]
            ]
        ]
    ]
];

$res = isset($marketData[$symbol]) ? $marketData[$symbol] : $marketData['BTCUSDT'];

echo json_encode([
    'status' => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'timezone' => 'Asia/Jakarta (WIB)',
    'symbol' => $symbol,
    'timeframe' => $timeframe,
    'market' => $res
], JSON_PRETTY_PRINT);
