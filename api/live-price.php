<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 60); // max 120 req / 60 detik per IP (~2/s)

if (!function_exists('qi_http_get')) {
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
}

// Simbol yang diminta (comma-separated), default semua
$reqSyms = isset($_GET['symbols']) ? strtoupper(qi_sanitize_string($_GET['symbols'], 200)) : 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT';
$symbols = array_filter(array_map('trim', explode(',', $reqSyms)));

$result = [];

// ─── CRYPTO via Binance (multi-symbol ticker) ───────────────────────────────
$cryptoSyms = array_filter($symbols, fn($s) => !in_array($s, ['XAUUSD', 'EURUSD']));

if (!empty($cryptoSyms)) {
    // Binance /api/v3/ticker/price — ringan, cocok untuk polling cepat
    $hosts = [
        'https://data-api.binance.vision',
        'https://api.binance.com',
        'https://api1.binance.com',
    ];
    foreach ($hosts as $host) {
        // Ambil semua sekaligus dengan batch request
        $symJson = json_encode(array_values($cryptoSyms));
        $url     = "{$host}/api/v3/ticker/24hr?symbols=" . urlencode($symJson);
        $raw     = qi_http_get($url, 5);
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data) && count($data) > 0) {
                foreach ($data as $item) {
                    if (empty($item['symbol'])) continue;
                    $result[$item['symbol']] = [
                        'price'  => (float)$item['lastPrice'],
                        'open'   => (float)$item['openPrice'],
                        'high'   => (float)$item['highPrice'],
                        'low'    => (float)$item['lowPrice'],
                        'chgPct' => (float)$item['priceChangePercent'],
                        'vol'    => (float)$item['volume'],
                        'source' => 'binance',
                    ];
                }
                break;
            }
        }
    }
}

// ─── XAUUSD: Yahoo Finance GC=F → biquote.io → PAXG fallback ────────────────
if (in_array('XAUUSD', $symbols)) {
    $got = false;

    // Primary: Yahoo Finance gold futures (GC=F) — no API key needed
    $raw = qi_http_get('https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d', 4);
    if ($raw) {
        $d = json_decode($raw, true);
        $meta = $d['chart']['result'][0]['meta'] ?? null;
        $price = (float)($meta['regularMarketPrice'] ?? $meta['previousClose'] ?? 0);
        $open  = (float)($meta['chartPreviousClose'] ?? $meta['previousClose'] ?? $price);
        if ($price > 100) {
            $result['XAUUSD'] = [
                'price'  => $price,
                'open'   => $open,
                'high'   => (float)($meta['regularMarketDayHigh'] ?? $price),
                'low'    => (float)($meta['regularMarketDayLow']  ?? $price),
                'chgPct' => $open > 0 ? round(($price - $open) / $open * 100, 3) : 0,
                'vol'    => 0,
                'source' => 'yahoo_gcf',
            ];
            $got = true;
        }
    }

    // Secondary: biquote.io spot gold
    if (!$got) {
        $raw = qi_http_get('https://biquote.io/api/XAUUSD/quote', 3);
        if ($raw) {
            $d = json_decode($raw, true);
            $price = (float)($d['bid'] ?? $d['close'] ?? $d['price'] ?? 0);
            if ($price > 100) {
                $result['XAUUSD'] = [
                    'price'  => $price,
                    'open'   => (float)($d['open'] ?? $price),
                    'high'   => (float)($d['high'] ?? $price),
                    'low'    => (float)($d['low'] ?? $price),
                    'chgPct' => isset($d['open']) && $d['open'] > 0 ? round(($price - $d['open']) / $d['open'] * 100, 3) : 0,
                    'vol'    => 0,
                    'source' => 'biquote',
                ];
                $got = true;
            }
        }
    }

    // Tertiary fallback: PAXGUSDT dari Binance (1:1 gold proxy)
    if (!$got) {
        foreach (['https://data-api.binance.vision', 'https://api.binance.com'] as $host) {
            $raw2 = qi_http_get("{$host}/api/v3/ticker/24hr?symbol=PAXGUSDT", 3);
            if ($raw2) {
                $d = json_decode($raw2, true);
                if (!empty($d['lastPrice'])) {
                    $result['XAUUSD'] = [
                        'price'  => (float)$d['lastPrice'],
                        'open'   => (float)$d['openPrice'],
                        'high'   => (float)$d['highPrice'],
                        'low'    => (float)$d['lowPrice'],
                        'chgPct' => (float)$d['priceChangePercent'],
                        'vol'    => 0,
                        'source' => 'paxg_proxy',
                    ];
                    break;
                }
            }
        }
    }
}

// ─── EURUSD via biquote ──────────────────────────────────────────────────────
if (in_array('EURUSD', $symbols)) {
    $raw = qi_http_get('https://biquote.io/api/EURUSD/quote', 3);
    if ($raw) {
        $d = json_decode($raw, true);
        $price = (float)($d['bid'] ?? $d['close'] ?? $d['price'] ?? 0);
        if ($price > 0.5) {
            $result['EURUSD'] = [
                'price'  => $price,
                'open'   => (float)($d['open'] ?? $price),
                'high'   => (float)($d['high'] ?? $price),
                'low'    => (float)($d['low'] ?? $price),
                'chgPct' => isset($d['open']) && $d['open'] > 0 ? round(($price - $d['open']) / $d['open'] * 100, 3) : 0,
                'vol'    => 0,
                'source' => 'biquote',
            ];
        }
    }
}

echo json_encode([
    'status'    => 'success',
    'ts'        => time(),
    'prices'    => $result,
]);
