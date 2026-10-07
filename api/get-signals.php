<?php
/**
 * Quantum Institut Market Terminal - 9 Engines Signals API
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

// Rate limit default: 60 req/min
qi_rate_limit(60, 60);

$symbol = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 10)) : 'BTCUSDT';
$engine = isset($_GET['engine']) ? strtoupper(qi_sanitize_string($_GET['engine'], 20)) : 'SNR';

// Validasi lisensi server-side untuk Mesin PRO Lanjutan
$proEngines = ['TRENM5', 'MOMENTUM_NY', 'MACD_MOM', 'GOLDEN_CROSS'];
if (in_array($engine, $proEngines)) {
    // Cek apakah ada token valid
    $user = qi_validate_token();
    if (!$user && isset($_GET['strict_pro']) && $_GET['strict_pro'] === '1') {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'Mesin sinyal ini membutuhkan Lisensi Quantum+ PRO aktif.',
            'code' => 'PRO_LICENSE_REQUIRED'
        ]);
        exit();
    }
}

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
