<?php
/**
 * Quantum Institut Market Terminal - 9 Engines Signals API
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$symbol = isset($_GET['symbol']) ? strtoupper($_GET['symbol']) : 'BTCUSDT';
$engine = isset($_GET['engine']) ? strtoupper($_GET['engine']) : 'SNR';

require_once __DIR__ . '/../engine/snr.php';
require_once __DIR__ . '/../engine/smc.php';
require_once __DIR__ . '/../engine/ema200.php';
require_once __DIR__ . '/../engine/ichimoku.php';
require_once __DIR__ . '/../engine/fibonacci.php';
require_once __DIR__ . '/../engine/macd.php';
require_once __DIR__ . '/../engine/trenm5.php';
require_once __DIR__ . '/../engine/momentum_ny.php';
require_once __DIR__ . '/../engine/golden_cross.php';

$price = $symbol === 'BTCUSDT' ? 68450.20 : ($symbol === 'XAUUSD' ? 2654.20 : 3520.10);

$engineData = [];

switch ($engine) {
    case 'SMC':
        $signal = calculateQuantumSMC($symbol, $price);
        break;
    case 'EMA200':
        $signal = calculateQuantumEMA200($symbol, $price);
        break;
    case 'ICHI':
        $signal = calculateQuantumIchimoku($symbol, $price);
        break;
    case 'FIBO':
        $signal = calculateQuantumFibonacci($symbol, $price);
        break;
    case 'TRENM5':
        $signal = calculateQuantumTrenM5($symbol, $price);
        break;
    case 'MOMENTUM_NY':
        $signal = calculateQuantumMomentumNY($symbol, $price);
        break;
    case 'MACD_MOM':
        $signal = calculateQuantumMACD($symbol, $price);
        break;
    case 'GOLDEN_CROSS':
        $signal = calculateQuantumGoldenCross($symbol, $price);
        break;
    case 'SNR':
    default:
        $signal = calculateQuantumSNR($symbol, $price);
        break;
}

echo json_encode([
    'status' => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'symbol' => $symbol,
    'engine' => $engine,
    'price' => $price,
    'signal' => $signal
], JSON_PRETTY_PRINT);
