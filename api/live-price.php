<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/../config/api_keys.php';
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

// ─── Twelve Data: ambil harga live dengan file-cache 15 detik ────────────────
// Free tier: 8 credits/menit. Poller kita jalan tiap 3 detik → cache wajib.
function qi_twelvedata_price(string $tdSymbol, string $cacheKey): array {
    $cacheDir  = __DIR__ . '/../cache/td';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    $cacheFile = $cacheDir . '/' . md5($cacheKey) . '.json';

    // Sajikan cache kalau masih < 15 detik (aman di bawah 8 req/min)
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 15) {
        $c = json_decode(file_get_contents($cacheFile), true);
        if (!empty($c['price'])) {
            $c['source'] = 'twelvedata_cache';
            return $c;
        }
    }

    $url = 'https://api.twelvedata.com/quote?symbol=' . urlencode($tdSymbol)
         . '&apikey=' . TWELVE_DATA_KEY;
    $raw = qi_http_get($url, 5);
    if (!$raw) return [];
    $d = json_decode($raw, true);
    if (empty($d['close']) || isset($d['code'])) return []; // error / rate limited

    $price = (float)$d['close'];
    $open  = (float)($d['open']  ?? $price);
    $high  = (float)($d['high']  ?? $price);
    $low   = (float)($d['low']   ?? $price);
    $chg   = (float)($d['percent_change'] ?? ($open > 0 ? round(($price - $open) / $open * 100, 3) : 0));

    $data = ['price' => $price, 'open' => $open, 'high' => $high, 'low' => $low, 'chgPct' => $chg, 'vol' => 0, 'source' => 'twelvedata'];
    @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
    return $data;
}

// Simbol yang diminta (comma-separated)
$reqSyms = isset($_GET['symbols']) ? strtoupper(qi_sanitize_string($_GET['symbols'], 200)) : 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT';
$symbols = array_filter(array_map('trim', explode(',', $reqSyms)));

$result = [];

// ─── CRYPTO via Binance (multi-symbol ticker) ───────────────────────────────
$cryptoSyms = array_filter($symbols, fn($s) => !in_array($s, ['XAUUSD', 'EURUSD']));
if (!empty($cryptoSyms)) {
    $hosts = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com'];
    foreach ($hosts as $host) {
        $symJson = json_encode(array_values($cryptoSyms));
        $raw = qi_http_get("{$host}/api/v3/ticker/24hr?symbols=" . urlencode($symJson), 5);
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

// ─── XAUUSD: Twelve Data → candle cache → biquote → PAXG ───────────────────
if (in_array('XAUUSD', $symbols)) {
    // Primary: Twelve Data (sumber sama dengan analismarket.com)
    $td = qi_twelvedata_price('XAU/USD', 'xauusd');
    if (!empty($td['price']) && $td['price'] > 100) {
        $result['XAUUSD'] = $td;
    }

    // Secondary: candle cache H1 (sudah dari Twelve Data setelah update ini)
    if (empty($result['XAUUSD'])) {
        $xauCache = __DIR__ . '/../cache/chart/' . md5('XAUUSD_60') . '.json';
        if (file_exists($xauCache) && (time() - filemtime($xauCache)) < 300) {
            $cd = json_decode(file_get_contents($xauCache), true);
            $candles = $cd['candles'] ?? [];
            if (!empty($candles) && !($cd['simulated'] ?? true)) {
                $last = end($candles); $first = reset($candles);
                $price = (float)$last['close']; $open = (float)($first['open'] ?? $price);
                if ($price > 100) {
                    $result['XAUUSD'] = ['price'=>$price,'open'=>$open,'high'=>(float)$last['high'],'low'=>(float)$last['low'],'chgPct'=>$open>0?round(($price-$open)/$open*100,3):0,'vol'=>0,'source'=>'candle_cache'];
                }
            }
        }
    }

    // Tertiary: biquote.io MT5 feed
    if (empty($result['XAUUSD'])) {
        $raw = qi_http_get('https://biquote.io/api/XAUUSD/quote', 3);
        if ($raw) {
            $d = json_decode($raw, true);
            $price = (float)($d['bid'] ?? $d['close'] ?? $d['price'] ?? 0);
            if ($price > 100) {
                $result['XAUUSD'] = ['price'=>$price,'open'=>(float)($d['open']??$price),'high'=>(float)($d['high']??$price),'low'=>(float)($d['low']??$price),'chgPct'=>isset($d['open'])&&$d['open']>0?round(($price-$d['open'])/$d['open']*100,3):0,'vol'=>0,'source'=>'biquote'];
            }
        }
    }

    // Last resort: PAXGUSDT Binance
    if (empty($result['XAUUSD'])) {
        foreach (['https://data-api.binance.vision', 'https://api.binance.com'] as $host) {
            $raw = qi_http_get("{$host}/api/v3/ticker/24hr?symbol=PAXGUSDT", 3);
            if ($raw) {
                $d = json_decode($raw, true);
                if (!empty($d['lastPrice'])) {
                    $result['XAUUSD'] = ['price'=>(float)$d['lastPrice'],'open'=>(float)$d['openPrice'],'high'=>(float)$d['highPrice'],'low'=>(float)$d['lowPrice'],'chgPct'=>(float)$d['priceChangePercent'],'vol'=>0,'source'=>'paxg_proxy'];
                    break;
                }
            }
        }
    }
}

// ─── EURUSD: Twelve Data → biquote fallback ─────────────────────────────────
if (in_array('EURUSD', $symbols)) {
    // Primary: Twelve Data
    $td = qi_twelvedata_price('EUR/USD', 'eurusd');
    if (!empty($td['price']) && $td['price'] > 0.5) {
        $result['EURUSD'] = $td;
    }

    // Fallback: biquote.io
    if (empty($result['EURUSD'])) {
        $raw = qi_http_get('https://biquote.io/api/EURUSD/quote', 3);
        if ($raw) {
            $d = json_decode($raw, true);
            $price = (float)($d['bid'] ?? $d['close'] ?? $d['price'] ?? 0);
            if ($price > 0.5) {
                $result['EURUSD'] = ['price'=>$price,'open'=>(float)($d['open']??$price),'high'=>(float)($d['high']??$price),'low'=>(float)($d['low']??$price),'chgPct'=>isset($d['open'])&&$d['open']>0?round(($price-$d['open'])/$d['open']*100,3):0,'vol'=>0,'source'=>'biquote'];
            }
        }
    }
}

echo json_encode(['status' => 'success', 'ts' => time(), 'prices' => $result]);
