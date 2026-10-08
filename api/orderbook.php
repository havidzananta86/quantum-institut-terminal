<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 10);

if (!function_exists('qi_http_get')) {
    function qi_http_get($url, $timeout = 4) {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (QuantumTerminal)', CURLOPT_SSL_VERIFYPEER => false,
            ]);
            $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            return ($res && $code >= 200 && $code < 300) ? $res : false;
        }
        return @file_get_contents($url, false, stream_context_create(['http'=>['timeout'=>$timeout]]));
    }
}

$symbol = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 12)) : 'BTCUSDT';
$limit  = min((int)($_GET['limit'] ?? 20), 20);

// Forex/commodity symbols → generate orderbook from live TradingView price
$fxSymbols = [
    'XAUUSD' => ['tv' => 'TVC:GOLD',       'spread' => 0.50, 'dp' => 2, 'lotBase' => 0.5],
    'EURUSD' => ['tv' => 'FX_IDC:EURUSD',  'spread' => 0.00015, 'dp' => 5, 'lotBase' => 50000],
    'GBPUSD' => ['tv' => 'FX_IDC:GBPUSD',  'spread' => 0.00020, 'dp' => 5, 'lotBase' => 40000],
    'USDJPY' => ['tv' => 'FX_IDC:USDJPY',  'spread' => 0.020, 'dp' => 3, 'lotBase' => 50000],
];

if (isset($fxSymbols[$symbol])) {
    $cfg = $fxSymbols[$symbol];
    $tvTicker = $cfg['tv'];
    $body = json_encode([
        'symbols' => ['tickers' => [$tvTicker], 'query' => ['types' => []]],
        'columns' => ['close', 'high', 'low', 'volume'],
    ]);
    $ch = curl_init('https://scanner.tradingview.com/global/scan');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'User-Agent: Mozilla/5.0'],
        CURLOPT_TIMEOUT => 5, CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $raw = curl_exec($ch); curl_close($ch);
    $tvData = json_decode($raw, true);
    $price = $tvData['data'][0]['d'][0] ?? null;

    if ($price) {
        $spread = $cfg['spread'];
        $dp     = $cfg['dp'];
        $mid    = (float)$price;
        $bids   = [];
        $asks   = [];
        // Seed PRNG with minute-level timestamp for stable-ish output within same minute
        mt_srand((int)(time() / 10) + crc32($symbol));
        for ($i = 0; $i < $limit; $i++) {
            $offset = $spread * (0.5 + $i * 0.3 + mt_rand(0, 100) / 1000);
            $vol    = round($cfg['lotBase'] * (1 + mt_rand(0, 200) / 100) / ($i + 1), 3);
            $bids[] = [number_format($mid - $offset, $dp, '.', ''), (string)$vol];
            $asks[] = [number_format($mid + $offset, $dp, '.', ''), (string)$vol];
        }
        header('Cache-Control: no-store');
        echo json_encode(['status' => 'success', 'symbol' => $symbol, 'source' => 'tradingview', 'bids' => $bids, 'asks' => $asks]);
        exit;
    }
}

// Binance symbols (crypto)
$hosts = [
    'https://data-api.binance.vision',
    'https://api.binance.com',
    'https://api1.binance.com',
];

foreach ($hosts as $host) {
    $raw = qi_http_get("{$host}/api/v3/depth?symbol={$symbol}&limit={$limit}", 3);
    if ($raw) {
        $data = json_decode($raw, true);
        if (!empty($data['bids'])) {
            header('Cache-Control: no-store');
            echo json_encode(['status'=>'success','symbol'=>$symbol,'source'=>'binance','bids'=>$data['bids'],'asks'=>$data['asks']]);
            exit;
        }
    }
}

echo json_encode(['status'=>'error','symbol'=>$symbol,'bids'=>[],'asks'=>[]]);
