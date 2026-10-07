<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/../config/api_keys.php';
qi_rate_limit(120, 60); // chart sering di-refresh, beri limit lebih longgar

$symbol   = isset($_GET['symbol'])   ? strtoupper(qi_sanitize_string($_GET['symbol'], 10)) : 'BTCUSDT';
$interval = isset($_GET['interval']) ? qi_sanitize_string($_GET['interval'], 5)            : '60';

$intervalMapBinance = [
    '1' => '1m', '5' => '5m', '15' => '15m', '30' => '30m', '60' => '1h', '240' => '4h', 'D' => '1d'
];
$binanceInterval = $intervalMapBinance[$interval] ?? '1h';

// =============================================================
// CACHING: simpan candle per symbol+interval, TTL singkat
// Repeated load jadi ~instan (baca file lokal, tanpa fetch eksternal)
// =============================================================
$cacheTtlMap = ['1' => 15, '5' => 20, '15' => 30, '30' => 45, '60' => 60, '240' => 120, 'D' => 300];
$cacheTtl = $cacheTtlMap[$interval] ?? 30;

$cacheDir = __DIR__ . '/../cache/chart';
if (!is_dir($cacheDir)) { @mkdir($cacheDir, 0755, true); }
$cacheFile = $cacheDir . '/' . md5($symbol . '_' . $interval) . '.json';

// Sajikan dari cache kalau masih segar
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    header('X-QI-Cache: HIT');
    header('Cache-Control: public, max-age=' . $cacheTtl);
    echo file_get_contents($cacheFile);
    exit();
}

/**
 * Ambil URL dengan curl (cepat) atau fallback file_get_contents.
 */
function qi_http_get($url, $timeout = 4) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (QuantumTerminal)',
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($res && $code >= 200 && $code < 300) ? $res : false;
    }
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => $timeout, 'header' => "User-Agent: Mozilla/5.0\r\n"]]);
    return @file_get_contents($url, false, $ctx);
}

$candles = [];

// 1. CRYPTO via Binance — pakai mirror Vision dulu (paling jarang ke-blok di ID)
if (in_array($symbol, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'])) {
    $binanceHosts = [
        'https://data-api.binance.vision',
        'https://api.binance.com',
        'https://api1.binance.com',
    ];
    foreach ($binanceHosts as $host) {
        $raw = qi_http_get("{$host}/api/v3/klines?symbol={$symbol}&interval={$binanceInterval}&limit=300", 4);
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
                break; // sukses, stop coba host lain
            }
        }
    }
}

// ─── Twelve Data interval map ────────────────────────────────────────────────
$tdIntervalMap = ['1'=>'1min','5'=>'5min','15'=>'15min','30'=>'30min','60'=>'1h','240'=>'4h','D'=>'1day'];
$tdInterval = $tdIntervalMap[$interval] ?? '1h';

// Helper: parse Twelve Data time_series response into candle array
function qi_parse_td_candles(array $values): array {
    $out = [];
    foreach ($values as $v) {
        $t = strtotime($v['datetime'] ?? '');
        if ($t > 0) {
            $out[] = [
                'time'   => $t,
                'open'   => (float)$v['open'],
                'high'   => (float)$v['high'],
                'low'    => (float)$v['low'],
                'close'  => (float)$v['close'],
                'volume' => (float)($v['volume'] ?? 0),
            ];
        }
    }
    // Twelve Data returns newest-first; flip to oldest-first for chart
    return array_reverse($out);
}

// 1b. XAUUSD: Twelve Data → biquote.io MT5 → PAXG fallback
if (empty($candles) && $symbol === 'XAUUSD') {
    // Primary: Twelve Data (sumber sama dengan analismarket.com)
    $tdUrl = 'https://api.twelvedata.com/time_series?symbol=XAU%2FUSD'
           . '&interval=' . $tdInterval . '&outputsize=300&apikey=' . TWELVE_DATA_KEY;
    $raw = qi_http_get($tdUrl, 6);
    if ($raw) {
        $d = json_decode($raw, true);
        $values = $d['values'] ?? [];
        if (is_array($values) && count($values) > 5 && !isset($d['code'])) {
            $candles = qi_parse_td_candles($values);
        }
    }

    // Secondary: biquote.io MT5 broker feed
    if (empty($candles)) {
        $biquoteTf = $interval === 'D' ? '1d' : ($interval === '240' ? '4h' : ($interval === '60' ? '1h' : ($interval === '15' ? '15m' : '5m')));
        $raw = qi_http_get("https://biquote.io/api/XAUUSD/ohlc?interval={$biquoteTf}&limit=300", 4);
        if ($raw) {
            $data = json_decode($raw, true);
            $bars = $data['bars'] ?? (is_array($data) ? $data : []);
            if (is_array($bars) && count($bars) > 0) {
                foreach ($bars as $b) {
                    $t = strtotime($b['openTime'] ?? $b['time'] ?? '');
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
                usort($candles, fn($a, $b) => $a['time'] - $b['time']);
            }
        }
    }

    // Tertiary: Binance PAXGUSDT (gold proxy, deviasi <0.5%)
    if (empty($candles)) {
        $raw = qi_http_get("https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval={$binanceInterval}&limit=300", 4);
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data) && count($data) > 0) {
                foreach ($data as $d) {
                    $candles[] = [
                        'time'   => (int)($d[0] / 1000),
                        'open'   => (float)$d[1], 'high' => (float)$d[2],
                        'low'    => (float)$d[3], 'close'=> (float)$d[4],
                        'volume' => (float)$d[5],
                    ];
                }
            }
        }
    }
}

// 1c. EURUSD: Twelve Data → biquote.io fallback
if (empty($candles) && $symbol === 'EURUSD') {
    // Primary: Twelve Data
    $tdUrl = 'https://api.twelvedata.com/time_series?symbol=EUR%2FUSD'
           . '&interval=' . $tdInterval . '&outputsize=300&apikey=' . TWELVE_DATA_KEY;
    $raw = qi_http_get($tdUrl, 6);
    if ($raw) {
        $d = json_decode($raw, true);
        $values = $d['values'] ?? [];
        if (is_array($values) && count($values) > 5 && !isset($d['code'])) {
            $candles = qi_parse_td_candles($values);
        }
    }

    // Fallback: biquote.io MT5
    if (empty($candles)) {
        $biquoteTf = $interval === 'D' ? '1d' : ($interval === '240' ? '4h' : ($interval === '60' ? '1h' : ($interval === '15' ? '15m' : '5m')));
        $raw = qi_http_get("https://biquote.io/api/EURUSD/ohlc?interval={$biquoteTf}&limit=300", 4);
        if ($raw) {
            $data = json_decode($raw, true);
            $bars = $data['bars'] ?? (is_array($data) ? $data : []);
            if (is_array($bars) && count($bars) > 0) {
                foreach ($bars as $b) {
                    $t = strtotime($b['openTime'] ?? $b['time'] ?? '');
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
                usort($candles, fn($a, $b) => $a['time'] - $b['time']);
            }
        }
    }
}

// 2. Fail-safe: candle acak (ditandai simulated agar UI tampil badge)
$simulated = empty($candles);
if ($simulated) {
    $basePrices = ['BTCUSDT'=>68450.20,'XAUUSD'=>2654.20,'ETHUSDT'=>3520.10,'EURUSD'=>1.0895,'SOLUSDT'=>184.50,'BNBUSDT'=>590.00];
    $basePrice = $basePrices[$symbol] ?? 100.00;
    $now = time();
    $stepMap = ['5'=>300,'15'=>900,'30'=>1800,'240'=>14400,'D'=>86400];
    $step = $stepMap[$interval] ?? 3600;
    $current = $basePrice;
    for ($i = 200; $i >= 0; $i--) {
        $t = $now - ($i * $step);
        $change = ($current * (rand(-15, 16) / 1000));
        $open = $current; $close = $open + $change;
        $high = max($open, $close) + abs($change * (rand(10, 50) / 100));
        $low  = min($open, $close) - abs($change * (rand(10, 50) / 100));
        $candles[] = ['time'=>$t,'open'=>round($open,4),'high'=>round($high,4),'low'=>round($low,4),'close'=>round($close,4),'volume'=>rand(100,5000)];
        $current = $close;
    }
}

$payload = json_encode([
    'status'    => 'success',
    'symbol'    => $symbol,
    'interval'  => $interval,
    'count'     => count($candles),
    'simulated' => $simulated,
    'candles'   => $candles
]);

// Simpan ke cache hanya jika data nyata (jangan cache candle simulasi)
if (!$simulated) {
    @file_put_contents($cacheFile, $payload, LOCK_EX);
}

header('X-QI-Cache: MISS');
if (!$simulated) header('Cache-Control: public, max-age=' . $cacheTtl);
echo $payload;
