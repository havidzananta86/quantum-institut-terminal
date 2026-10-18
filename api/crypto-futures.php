<?php
// Proxy untuk Binance Futures public API + Frankfurter IDR rates
// Tidak butuh auth — semua endpoint ini public
header('Content-Type: application/json');
require_once __DIR__ . '/_middleware.php';
qi_require_level('pro');   // Crypto Terminal — PRO
qi_rate_limit(30, 60);
header('Cache-Control: public, max-age=60'); // cache 60 detik

if (!defined('QI_DEV')) {
    define('QI_DEV', in_array($_SERVER['SERVER_NAME'] ?? 'localhost', ['localhost', '127.0.0.1'], true));
}

$action = $_GET['action'] ?? 'liquidation';

// --- Cache helper ---
$_cfCacheDir = __DIR__ . '/../cache/crypto-futures';
if (!is_dir($_cfCacheDir)) @mkdir($_cfCacheDir, 0755, true);

function cf_cache_get(string $key, int $ttl = 60): ?string {
    global $_cfCacheDir;
    $f = $_cfCacheDir . '/' . $key . '.json';
    if (file_exists($f) && (time() - filemtime($f)) < $ttl) return file_get_contents($f);
    return null;
}
function cf_cache_set(string $key, string $data): void {
    global $_cfCacheDir;
    @file_put_contents($_cfCacheDir . '/' . $key . '.json', $data, LOCK_EX);
}

function curlGet(string $url): array|false {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (QuantumTerminal)',
        CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    if (!$body) return false;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : false;
}

if ($action === 'liquidation') {
    // Serve from cache if fresh (60s)
    $cached = cf_cache_get('liquidation', 60);
    if ($cached !== null) {
        header('X-QI-Cache: HIT');
        echo $cached;
        exit;
    }

    // Coba Binance Futures dulu, fallback ke Binance Spot 24h ticker
    $TOP = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','LINKUSDT','AVAXUSDT','ADAUSDT','LTCUSDT'];

    // Coba fapi (Binance Futures) dulu
    $tickers = curlGet('https://fapi.binance.com/fapi/v1/ticker/24hr');
    $source  = 'futures';

    if ($tickers === false) {
        // Fallback: Binance Spot 24h ticker — coba beberapa host (sama dengan live-price.php)
        $symsParam = urlencode(json_encode($TOP));
        $hosts = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com'];
        foreach ($hosts as $host) {
            $tickers = curlGet("{$host}/api/v3/ticker/24hr?symbols={$symsParam}");
            if ($tickers !== false) break;
        }
        $source = 'spot';
    }

    if ($tickers === false) {
        http_response_code(502);
        echo json_encode(['error' => 'Gagal mengambil data Binance']);
        exit;
    }

    // Funding rate (hanya tersedia dari futures, lewati jika spot)
    $fundMap = [];
    if ($source === 'futures') {
        $funding = curlGet('https://fapi.binance.com/fapi/v1/premiumIndex');
        if ($funding) {
            foreach ($funding as $f) {
                $fundMap[$f['symbol']] = isset($f['lastFundingRate'])
                    ? round((float)$f['lastFundingRate'] * 100, 4)
                    : null;
            }
        }
    }

    // Filter ke TOP_SYMS saja
    $filtered = array_values(array_filter($tickers, fn($t) => in_array($t['symbol'], $TOP)));
    usort($filtered, fn($a, $b) => (float)$b['quoteVolume'] <=> (float)$a['quoteVolume']);
    $filtered = array_slice($filtered, 0, 8);

    // Compose response
    $rows = [];
    foreach ($filtered as $t) {
        $sym  = $t['symbol'];
        $chg  = round((float)($t['priceChangePercent'] ?? 0), 2);
        $rows[] = [
            'symbol'  => $sym,
            'price'   => $t['lastPrice'] ?? $t['weightedAvgPrice'] ?? '0',
            'change'  => $chg,
            'volume'  => $t['quoteVolume'] ?? '0',
            'funding' => $fundMap[$sym] ?? null,
            'liqSide' => $chg <= -3 ? 'LONG' : ($chg >= 3 ? 'SHORT' : 'NEUTRAL'),
        ];
    }
    $json = json_encode(['ok' => true, 'data' => $rows, 'source' => $source]);
    cf_cache_set('liquidation', $json);
    echo $json;

} elseif ($action === 'sentiment') {
    // Whale vs Retail Real Sentiment from Binance Futures API
    $sym = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 12)) : 'BTCUSDT';
    $cacheKey = 'sentiment_' . $sym;
    $cached = cf_cache_get($cacheKey, 60);
    if ($cached !== null) {
        header('X-QI-Cache: HIT');
        echo $cached;
        exit;
    }

    // 1. Retail global Long/Short Account ratio
    $globalRatio = curlGet("https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol={$sym}&period=1h&limit=1");
    // 2. Top Trader (Whale) Long/Short Account ratio
    $topRatio = curlGet("https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol={$sym}&period=1h&limit=1");
    // 3. Taker Buy/Sell Volume ratio
    $takerRatio = curlGet("https://fapi.binance.com/futures/data/takerlongshortRatio?symbol={$sym}&period=1h&limit=1");

    $retail = (!empty($globalRatio) && is_array($globalRatio)) ? $globalRatio[0] : null;
    $whale  = (!empty($topRatio) && is_array($topRatio)) ? $topRatio[0] : null;
    $taker  = (!empty($takerRatio) && is_array($takerRatio)) ? $takerRatio[0] : null;

    // KEJUJURAN DATA: dulu, bila Binance Futures tidak terjangkau, angka KARANGAN yang tertanam di kode
    // (Retail 51,2/48,8 · Whale 58,5/41,5 · "SMART MONEY ACCUMULATION") dikirim seolah data nyata.
    // Sekarang: tanpa data nyata → katakan tidak tersedia (HTTP 200 + ok:false, tidak disimpan di cache).
    if (!$retail || !$whale) {
        echo json_encode([
            'ok' => false, 'tidak_tersedia' => true, 'symbol' => $sym,
            'message' => 'Data posisi trader Binance Futures tidak tersedia saat ini (sumber tidak terjangkau dari server).',
        ]);
        exit;
    }
    $retailLong = round((float)$retail['longAccount'] * 100, 1);
    $retailShort = round((float)$retail['shortAccount'] * 100, 1);

    $whaleLong = round((float)$whale['longAccount'] * 100, 1);
    $whaleShort = round((float)$whale['shortAccount'] * 100, 1);

    $divergence = round($whaleLong - $retailLong, 1);
    $verdict = 'NEUTRAL';
    if ($divergence > 5 && $whaleLong > 55) {
        $verdict = 'SMART MONEY ACCUMULATION (Bullish Whale)';
    } elseif ($divergence < -5 && $whaleShort > 55) {
        $verdict = 'DISTRIBUTION / SMART MONEY SHORT (Bearish Whale)';
    }

    $res = json_encode([
        'ok'     => true,
        'symbol' => $sym,
        'retail' => [
            'long'  => $retailLong,
            'short' => $retailShort,
            'ratio' => (float)$retail['longShortRatio']
        ],
        'whale'  => [
            'long'  => $whaleLong,
            'short' => $whaleShort,
            'ratio' => (float)$whale['longShortRatio']
        ],
        'takerBuySellRatio' => $taker ? (float)$taker['buySellRatio'] : null,
        'divergence'        => $divergence,
        'verdict'           => $verdict,
        'timestamp'         => date('Y-m-d H:i:s')
    ]);

    cf_cache_set($cacheKey, $res);
    echo $res;
    exit;

} elseif ($action === 'idr') {
    // Kurs USD/IDR via Frankfurter
    $data = curlGet('https://api.frankfurter.app/latest?from=USD&to=IDR');
    if ($data && isset($data['rates']['IDR'])) {
        echo json_encode(['ok' => true, 'rate' => $data['rates']['IDR']]);
    } else {
        // Fallback: cached file
        $cache = __DIR__ . '/../cache/frankfurter/usd_idr.json';
        if (file_exists($cache)) {
            echo file_get_contents($cache);
        } else {
            http_response_code(502);
            echo json_encode(['error' => 'IDR rate tidak tersedia']);
        }
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'action tidak dikenal']);
}
