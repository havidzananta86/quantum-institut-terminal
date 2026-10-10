<?php
/**
 * TradingView Technical Analysis Scanner API
 * Uses TradingView's public Scanner API (same endpoint as tradingview-scraper Python library)
 * Returns real TA recommendations, RSI, MACD, EMA, and multi-timeframe signals.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$TV_SYMBOLS = [
    'XAUUSD'  => 'TVC:GOLD',
    'EURUSD'  => 'FX_IDC:EURUSD',
    'GBPUSD'  => 'FX_IDC:GBPUSD',
    'USDJPY'  => 'FX_IDC:USDJPY',
    'AUDUSD'  => 'FX_IDC:AUDUSD',
    'USDCHF'  => 'FX_IDC:USDCHF',
    'USDCAD'  => 'FX_IDC:USDCAD',
    'NZDUSD'  => 'FX_IDC:NZDUSD',
    'GBPJPY'  => 'FX_IDC:GBPJPY',
    'EURJPY'  => 'FX_IDC:EURJPY',
    'EURGBP'  => 'FX_IDC:EURGBP',
    'AUDNZD'  => 'FX_IDC:AUDNZD',
    'CHFJPY'  => 'FX_IDC:CHFJPY',
    'CADJPY'  => 'FX_IDC:CADJPY',
    'BTCUSDT' => 'BINANCE:BTCUSDT',
    'ETHUSDT' => 'BINANCE:ETHUSDT',
    'SOLUSDT' => 'BINANCE:SOLUSDT',
    'BNBUSDT' => 'BINANCE:BNBUSDT',
    'XRPUSDT' => 'BINANCE:XRPUSDT',
    'DOGEUSDT'=> 'BINANCE:DOGEUSDT',
    // Commodities
    'XAGUSD'  => 'TVC:SILVER',
    'WTIUSD'  => 'NYMEX:CL1!',
    'NGAS'    => 'NYMEX:NG1!',
    'COPPER'  => 'COMEX:HG1!',
    'PLATINUM'=> 'TVC:PLATINUM',
];

$requestSymbols = isset($_GET['symbols'])
    ? array_map('trim', explode(',', strtoupper($_GET['symbols'])))
    : array_keys($TV_SYMBOLS);

$tickers = [];
$tickerToKey = [];
foreach ($requestSymbols as $sym) {
    if (isset($TV_SYMBOLS[$sym])) {
        $tv = $TV_SYMBOLS[$sym];
        $tickers[] = $tv;
        $tickerToKey[$tv] = $sym;
    }
}

if (empty($tickers)) {
    echo json_encode(['status' => 'error', 'message' => 'No valid symbols']);
    exit;
}

$timeframes = ['15', '60', '240', '1D'];
$columns = ['close', 'change', 'volume'];
// Unsuffixed = default daily (works for Binance crypto where |1D returns null)
$columns[] = 'Recommend.All';
$columns[] = 'Recommend.MA';
$columns[] = 'Recommend.Other';
foreach ($timeframes as $tf) {
    $columns[] = "Recommend.All|$tf";
    $columns[] = "Recommend.MA|$tf";
    $columns[] = "Recommend.Other|$tf";
}
$columns = array_merge($columns, [
    'RSI', 'RSI[1]', 'Stoch.K', 'Stoch.D', 'CCI20', 'ADX', 'AO',
    'Mom', 'MACD.macd', 'MACD.signal', 'BBPower',
    'EMA10', 'EMA20', 'EMA50', 'EMA100', 'EMA200',
    'SMA20', 'SMA50', 'SMA200',
    'ATR', 'Pivot.M.Classic.Middle',
]);

$cacheDir = __DIR__ . '/../cache/tv-scan';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheKey  = md5(implode(',', $tickers));
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';
$cacheTtl  = 30;

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    header('X-QI-Cache: HIT');
    echo file_get_contents($cacheFile);
    exit;
}

$body = json_encode([
    'symbols' => ['tickers' => $tickers, 'query' => ['types' => []]],
    'columns' => $columns,
]);

$ch = curl_init('https://scanner.tradingview.com/global/scan');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ],
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
]);
$raw      = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$raw || $httpCode !== 200) {
    echo json_encode(['status' => 'error', 'message' => 'TradingView scanner unavailable', 'http' => $httpCode]);
    exit;
}

$tvData = json_decode($raw, true);
if (!isset($tvData['data']) || !is_array($tvData['data'])) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid TradingView response']);
    exit;
}

function tv_signal(float $rec): string {
    if ($rec >=  0.5) return 'STRONG_BUY';
    if ($rec >=  0.1) return 'BUY';
    if ($rec <= -0.5) return 'STRONG_SELL';
    if ($rec <= -0.1) return 'SELL';
    return 'NEUTRAL';
}

$result = [];
foreach ($tvData['data'] as $item) {
    $tvTicker = $item['s'] ?? '';
    $ourSym   = $tickerToKey[$tvTicker] ?? $tvTicker;
    $d        = $item['d'] ?? [];

    $vals = [];
    foreach ($columns as $i => $col) {
        $vals[$col] = $d[$i] ?? null;
    }

    $tfSignals = [];
    foreach ($timeframes as $tf) {
        $rec    = $vals["Recommend.All|$tf"];
        $recMA  = $vals["Recommend.MA|$tf"];
        $recOsc = $vals["Recommend.Other|$tf"];
        // Fallback: for crypto, |1D can be null but unsuffixed Recommend.All has the daily value
        if ($tf === '1D' && $rec === null && $vals['Recommend.All'] !== null) {
            $rec    = $vals['Recommend.All'];
            $recMA  = $vals['Recommend.MA'];
            $recOsc = $vals['Recommend.Other'];
        }
        $tfSignals[$tf] = [
            'signal'     => $rec !== null ? tv_signal((float)$rec) : 'NO_DATA',
            'value'      => $rec    !== null ? round((float)$rec, 4)    : null,
            'ma'         => $recMA  !== null ? round((float)$recMA, 4)  : null,
            'oscillator' => $recOsc !== null ? round((float)$recOsc, 4) : null,
        ];
    }

    $r = fn($k) => $vals[$k] !== null ? round((float)$vals[$k], 6) : null;

    $result[$ourSym] = [
        'symbol'     => $ourSym,
        'price'      => $vals['close'],
        'change'     => $vals['change'] !== null ? round((float)$vals['change'], 4) : null,
        'volume'     => $vals['volume'],
        'timeframes' => $tfSignals,
        'indicators' => [
            'rsi'         => $r('RSI'),
            'rsi_prev'    => $r('RSI[1]'),
            'stoch_k'     => $r('Stoch.K'),
            'stoch_d'     => $r('Stoch.D'),
            'cci'         => $r('CCI20'),
            'adx'         => $r('ADX'),
            'ao'          => $r('AO'),
            'mom'         => $r('Mom'),
            'macd'        => $r('MACD.macd'),
            'macd_signal' => $r('MACD.signal'),
            'bb_power'    => $r('BBPower'),
            'ema10'       => $r('EMA10'),
            'ema20'       => $r('EMA20'),
            'ema50'       => $r('EMA50'),
            'ema100'      => $r('EMA100'),
            'ema200'      => $r('EMA200'),
            'sma20'       => $r('SMA20'),
            'sma50'       => $r('SMA50'),
            'sma200'      => $r('SMA200'),
            'atr'         => $r('ATR'),
            'pivot'       => $r('Pivot.M.Classic.Middle'),
        ],
    ];
}

$output = json_encode([
    'status'    => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'source'    => 'TradingView Scanner API',
    'count'     => count($result),
    'data'      => $result,
]);

@file_put_contents($cacheFile, $output, LOCK_EX);
header('X-QI-Cache: MISS');
echo $output;
