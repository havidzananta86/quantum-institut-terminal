<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$symbol   = isset($_GET['symbol'])   ? strtoupper(trim($_GET['symbol'])) : 'BTCUSDT';
$interval = isset($_GET['interval']) ? trim($_GET['interval'])           : '60';

$intervalMapBinance = [
    '1' => '1m', '5' => '5m', '15' => '15m', '30' => '30m', '60' => '1h', '240' => '4h', 'D' => '1d'
];
$binanceInterval = $intervalMapBinance[$interval] ?? '1h';

$candles = [];

// 1. Coba ambil data Binance dari server PHP (bebas CORS browser)
if (in_array($symbol, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XAUTUSDT'])) {
    $binanceUrl = "https://api.binance.com/api/v3/klines?symbol={$symbol}&interval={$binanceInterval}&limit=200";
    $opts = [
        'http' => [
            'method' => 'GET',
            'timeout' => 5,
            'header' => "User-Agent: Mozilla/5.0\r\n"
        ]
    ];
    $context = stream_context_create($opts);
    $raw = @file_get_contents($binanceUrl, false, $context);

    if ($raw) {
        $data = json_decode($raw, true);
        if (is_array($data) && count($data) > 0) {
            foreach ($data as $d) {
                $candles[] = [
                    'time'   => (int)($d[0] / 1000),
                    'open'   => (float)$d[1],
                    'high'   => (float)$d[2],
                    'low'    => (float)$d[3],
                    'close'  => (float)$d[4],
                    'volume' => (float)$d[5],
                ];
            }
        }
    }
}

// 1b. Coba ambil data Biquote MT5 untuk XAUUSD / EURUSD
if (empty($candles) && in_array($symbol, ['XAUUSD', 'EURUSD'])) {
    $biquoteTf = $interval === 'D' ? '1d' : ($interval === '240' ? '4h' : ($interval === '60' ? '1h' : ($interval === '15' ? '15m' : '5m')));
    $biquoteUrl = "https://biquote.io/api/{$symbol}/ohlc?interval={$biquoteTf}&limit=200";
    $opts = [
        'http' => [
            'method' => 'GET',
            'timeout' => 5,
            'header' => "User-Agent: Mozilla/5.0\r\n"
        ]
    ];
    $context = stream_context_create($opts);
    $raw = @file_get_contents($biquoteUrl, false, $context);
    if ($raw) {
        $data = json_decode($raw, true);
        $bars = $data['bars'] ?? (is_array($data) ? $data : []);
        if (is_array($bars) && count($bars) > 0) {
            foreach ($bars as $b) {
                $t = strtotime($b['openTime'] ?? $b['time']);
                if ($t > 0) {
                    $candles[] = [
                        'time'   => $t,
                        'open'   => (float)$b['open'],
                        'high'   => (float)$b['high'],
                        'low'    => (float)$b['low'],
                        'close'  => (float)$b['close'],
                        'volume' => (float)($b['tickVolume'] ?? $b['volume'] ?? 0),
                    ];
                }
            }
            // Sort ascending by time
            usort($candles, fn($a, $b) => $a['time'] - $b['time']);
        }
    }
}

// 2. Jika server fetch gagal atau simbol non-crypto (XAUUSD, EURUSD), hasilkan fail-safe realistic candles
$simulated = empty($candles);
if ($simulated) {
    $basePrices = [
        'BTCUSDT' => 68450.20,
        'XAUUSD'  => 2654.20,
        'ETHUSDT' => 3520.10,
        'EURUSD'  => 1.0895,
        'SOLUSDT' => 184.50,
        'BNBUSDT' => 590.00
    ];

    $basePrice = $basePrices[$symbol] ?? 100.00;
    $now = time();
    $step = 3600; // 1h default

    if ($interval === '5')   $step = 300;
    if ($interval === '15')  $step = 900;
    if ($interval === '240') $step = 14400;
    if ($interval === 'D')   $step = 86400;

    $current = $basePrice;

    for ($i = 150; $i >= 0; $i--) {
        $t = $now - ($i * $step);
        $change = ($current * (rand(-15, 16) / 1000));
        $open = $current;
        $close = $open + $change;
        $high = max($open, $close) + abs($change * (rand(10, 50) / 100));
        $low = min($open, $close) - abs($change * (rand(10, 50) / 100));

        $candles[] = [
            'time'   => $t,
            'open'   => round($open, 4),
            'high'   => round($high, 4),
            'low'    => round($low, 4),
            'close'  => round($close, 4),
            'volume' => rand(100, 5000)
        ];

        $current = $close;
    }
}

echo json_encode([
    'status'   => 'success',
    'symbol'   => $symbol,
    'interval' => $interval,
    'count'    => count($candles),
    'simulated' => $simulated, // true = candle acak fail-safe, BUKAN data pasar
    'candles'  => $candles
]);
