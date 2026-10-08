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
                CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
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

// Semua FX/Komoditas — tidak dikirim ke Binance
$FX_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','NZDUSD','USDCHF','USDCAD'];

// ─── CRYPTO via Binance (multi-symbol ticker) ───────────────────────────────
$cryptoSyms = array_filter($symbols, fn($s) => !in_array($s, $FX_SYMS));
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

// ─── Frankfurter (ECB) — free FX fallback, no API key ────────────────────
// Returns array keyed by symbol (EURUSD, GBPUSD …) with price+chgPct.
// Data is daily (ECB updates ~3 pm CET); cached 1 hour each.
function qi_frankfurter_fx_prices(array $needed): array {
    if (empty($needed)) return [];
    $cacheDir = __DIR__ . '/../cache/frankfurter';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);

    // Fetch USD base rates for today and yesterday (both cached 1 hour)
    $fetchRates = function(string $dateParam) use ($cacheDir): array {
        $key  = md5('frankfurter_usd_' . $dateParam);
        $file = $cacheDir . '/' . $key . '.json';
        if (file_exists($file) && (time() - filemtime($file)) < 3600) {
            $c = json_decode(file_get_contents($file), true);
            if (!empty($c['rates'])) return $c;
        }
        $url = 'https://api.frankfurter.app/' . $dateParam . '?from=USD';
        $raw = qi_http_get($url, 6);
        if ($raw) {
            $d = json_decode($raw, true);
            if (!empty($d['rates'])) {
                @file_put_contents($file, json_encode($d), LOCK_EX);
                return $d;
            }
        }
        return [];
    };
    $today     = $fetchRates('latest');
    $yesterday = $fetchRates(date('Y-m-d', strtotime('-1 day')));
    if (empty($today['rates'])) return [];

    // How to convert "USD→X rate" to the trading pair price and direction
    // direction=inverse: e.g. EUR/USD price = 1 / (USD per EUR)
    // direction=direct : e.g. USD/JPY price = USD per JPY rate
    $pairCfg = [
        'EURUSD' => ['cur'=>'EUR','inv'=>true ],
        'GBPUSD' => ['cur'=>'GBP','inv'=>true ],
        'AUDUSD' => ['cur'=>'AUD','inv'=>true ],
        'NZDUSD' => ['cur'=>'NZD','inv'=>true ],
        'USDJPY' => ['cur'=>'JPY','inv'=>false],
        'USDCHF' => ['cur'=>'CHF','inv'=>false],
        'USDCAD' => ['cur'=>'CAD','inv'=>false],
    ];

    $out = [];
    foreach ($needed as $sym) {
        if (!isset($pairCfg[$sym])) continue;
        $cfg = $pairCfg[$sym];
        $cur = $cfg['cur'];
        if (!isset($today['rates'][$cur])) continue;

        $rToday = (float)$today['rates'][$cur];
        $rYest  = isset($yesterday['rates'][$cur]) ? (float)$yesterday['rates'][$cur] : $rToday;

        $price = $cfg['inv'] ? ($rToday  > 0 ? round(1 / $rToday,  5) : 0)
                             : $rToday;
        $prev  = $cfg['inv'] ? ($rYest   > 0 ? round(1 / $rYest,   5) : $price)
                             : $rYest;

        $chgPct = $prev > 0 ? round(($price - $prev) / $prev * 100, 4) : 0;
        $out[$sym] = [
            'price'  => $price,
            'open'   => $prev,
            'high'   => max($price, $prev),
            'low'    => min($price, $prev),
            'chgPct' => $chgPct,
            'vol'    => 0,
            'source' => 'frankfurter',
        ];
    }
    return $out;
}

// ─── Generic FX pairs: GBP/USD, USD/JPY, AUD/USD, NZD/USD, USD/CHF, USD/CAD ──
$fxMap = [
    'GBPUSD' => 'GBP/USD', 'USDJPY' => 'USD/JPY', 'AUDUSD' => 'AUD/USD',
    'NZDUSD' => 'NZD/USD', 'USDCHF' => 'USD/CHF', 'USDCAD' => 'USD/CAD',
];
// Also include EURUSD here so it benefits from the same fallback chain
$allFxToResolve = array_intersect(array_merge(array_keys($fxMap), ['EURUSD']), $symbols);

$fxMinPrice = [
    'EURUSD'=>0.5, 'GBPUSD'=>0.5, 'USDJPY'=>50, 'AUDUSD'=>0.3,
    'NZDUSD'=>0.3, 'USDCHF'=>0.5, 'USDCAD'=>0.8,
];
$fxNeedFrankfurter = [];

foreach (array_merge($fxMap, ['EURUSD'=>'EUR/USD']) as $sym => $tdSym) {
    if (!in_array($sym, $symbols)) continue;
    if (isset($result[$sym])) continue; // already resolved (e.g. EURUSD via earlier block)
    $minP = $fxMinPrice[$sym] ?? 0;

    // 1. Twelve Data
    $td = qi_twelvedata_price($tdSym, strtolower($sym));
    if (!empty($td['price']) && $td['price'] > $minP) { $result[$sym] = $td; continue; }

    // 2. Biquote.io
    $raw = qi_http_get('https://biquote.io/api/' . $sym . '/quote', 3);
    if ($raw) {
        $d = json_decode($raw, true);
        $price = (float)($d['bid'] ?? $d['close'] ?? $d['price'] ?? 0);
        if ($price > $minP) {
            $op = (float)($d['open'] ?? $price);
            $result[$sym] = ['price'=>$price,'open'=>$op,'high'=>(float)($d['high']??$price),'low'=>(float)($d['low']??$price),'chgPct'=>$op>0?round(($price-$op)/$op*100,4):0,'vol'=>0,'source'=>'biquote'];
            continue;
        }
    }

    // 3. Queue for Frankfurter batch (one request for all remaining)
    $fxNeedFrankfurter[] = $sym;
}

// Frankfurter batch fallback (single HTTP call covers all missing pairs)
if (!empty($fxNeedFrankfurter)) {
    $fkPrices = qi_frankfurter_fx_prices($fxNeedFrankfurter);
    foreach ($fkPrices as $sym => $data) {
        if (!isset($result[$sym])) $result[$sym] = $data;
    }
}

echo json_encode(['status' => 'success', 'ts' => time(), 'prices' => $result]);
