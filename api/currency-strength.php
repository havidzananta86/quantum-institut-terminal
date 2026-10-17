<?php
/**
 * Currency Strength — 8 mata uang major (USD EUR GBP JPY CHF AUD NZD CAD)
 * Sumber data: OANDA (tv-bridge) → Twelve Data → Frankfurter ECB (free, no key).
 * Cache 30 detik.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 60);
$_apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($_apiKeysFile)) require_once $_apiKeysFile;
if (!defined('TWELVE_DATA_KEY')) define('TWELVE_DATA_KEY', '');

$cacheDir  = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = $cacheDir . '/currency-strength.json';
$cacheTtl  = 30;

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    // Di Windows, file yang sedang ditulis (LOCK_EX) gagal dibaca → hitung ulang saja.
    $cached = @file_get_contents($cacheFile);
    if ($cached !== false && $cached !== '') {
        header('X-QI-Cache: HIT');
        echo $cached;
        exit;
    }
}

// ── HTTP helper (same as live-price.php) ──────────────────────────────────
if (!function_exists('qi_http_get')) {
    function qi_http_get($url, $timeout = 5) {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (QuantumTerminal)',
                CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
            ]);
            $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return ($res && $code >= 200 && $code < 300) ? $res : false;
        }
        $ctx = stream_context_create(['http'=>['method'=>'GET','timeout'=>$timeout,'header'=>"User-Agent: Mozilla/5.0\r\n"]]);
        return @file_get_contents($url, false, $ctx);
    }
}

// ── Twelve Data (cached 15 s) ─────────────────────────────────────────────
if (!function_exists('qi_twelvedata_price')) {
    function qi_twelvedata_price(string $tdSym, string $cacheKey): array {
        $cacheDir  = __DIR__ . '/../cache/td';
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
        $cacheFile = $cacheDir . '/' . md5($cacheKey) . '.json';
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 15) {
            $c = json_decode(file_get_contents($cacheFile), true);
            if (!empty($c['price'])) { $c['source'] = 'twelvedata_cache'; return $c; }
        }
        $url = 'https://api.twelvedata.com/quote?symbol=' . urlencode($tdSym) . '&apikey=' . TWELVE_DATA_KEY;
        $raw = qi_http_get($url, 5);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        if (empty($d['close']) || isset($d['code'])) return [];
        $price = (float)$d['close']; $open = (float)($d['open'] ?? $price);
        $high  = (float)($d['high'] ?? $price); $low = (float)($d['low'] ?? $price);
        $chg   = (float)($d['percent_change'] ?? ($open > 0 ? round(($price-$open)/$open*100,3) : 0));
        $data  = ['price'=>$price,'open'=>$open,'high'=>$high,'low'=>$low,'chgPct'=>$chg,'vol'=>0,'source'=>'twelvedata'];
        @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
        return $data;
    }
}

// ── Frankfurter ECB — free, no key, daily data ────────────────────────────
function qi_frankfurter_rates(string $dateParam): array {
    $cacheDir = __DIR__ . '/../cache/frankfurter';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    $file = $cacheDir . '/' . md5('usd_' . $dateParam) . '.json';
    if (file_exists($file) && (time() - filemtime($file)) < 3600) {
        $c = json_decode(file_get_contents($file), true);
        if (!empty($c['rates'])) return $c;
    }
    $raw = qi_http_get('https://api.frankfurter.app/' . $dateParam . '?from=USD', 6);
    if ($raw) {
        $d = json_decode($raw, true);
        if (!empty($d['rates'])) { @file_put_contents($file, json_encode($d), LOCK_EX); return $d; }
    }
    return [];
}

// ── Pair definitions ──────────────────────────────────────────────────────
// [Twelve-Data-symbol, Biquote-symbol, base, quote, min-sanity]
$pairDefs = [
    'EURUSD' => ['EUR/USD', 'EURUSD', 'EUR', 'USD', 0.5,  true],
    'GBPUSD' => ['GBP/USD', 'GBPUSD', 'GBP', 'USD', 0.5,  true],
    'USDJPY' => ['USD/JPY', 'USDJPY', 'USD', 'JPY', 50,   false],
    'AUDUSD' => ['AUD/USD', 'AUDUSD', 'AUD', 'USD', 0.3,  true],
    'NZDUSD' => ['NZD/USD', 'NZDUSD', 'NZD', 'USD', 0.3,  true],
    'USDCHF' => ['USD/CHF', 'USDCHF', 'USD', 'CHF', 0.5,  false],
    'USDCAD' => ['USD/CAD', 'USDCAD', 'USD', 'CAD', 0.8,  false],
];

$prices   = [];
$noTD     = []; // pairs still missing after Twelve Data
$noBiquote= []; // pairs still missing after Biquote

// 0. OANDA lewat tv-bridge (TradingView-API) — satu panggilan untuk semua pasangan.
$prices = qi_tv_bridge_quotes(array_keys($pairDefs));

// 1. Twelve Data (hanya pasangan yang belum didapat dari OANDA)
foreach ($pairDefs as $sym => [$tdSym,,,,, ]) {
    if (!empty($prices[$sym])) continue;
    $td = qi_twelvedata_price($tdSym, strtolower($sym));
    if (!empty($td['price']) && $td['price'] > $pairDefs[$sym][4]) {
        $prices[$sym] = $td;
    } else {
        $noTD[] = $sym;
    }
}

// 2. Frankfurter ECB batch fallback (free, fast, no key)
$noBiquote = $noTD;
if (!empty($noBiquote)) {
    $today = qi_frankfurter_rates('latest');
    $yesterday = [];
    for ($daysAgo = 1; $daysAgo <= 5; $daysAgo++) {
        $testDate = date('Y-m-d', strtotime("-$daysAgo day"));
        $rates = qi_frankfurter_rates($testDate);
        if (!empty($rates['rates'])) {
            $yesterday = $rates;
            break;
        }
    }

    // Frankfurter map: which currency and inverse direction
    $fkMap = [
        'EURUSD'=>['EUR',true], 'GBPUSD'=>['GBP',true], 'AUDUSD'=>['AUD',true], 'NZDUSD'=>['NZD',true],
        'USDJPY'=>['JPY',false],'USDCHF'=>['CHF',false],'USDCAD'=>['CAD',false],
    ];
    foreach ($noBiquote as $sym) {
        if (!isset($fkMap[$sym]) || empty($today['rates'])) continue;
        [$cur, $inv] = $fkMap[$sym];
        if (!isset($today['rates'][$cur])) continue;
        $rT = (float)$today['rates'][$cur];
        $rY = isset($yesterday['rates'][$cur]) ? (float)$yesterday['rates'][$cur] : $rT;
        $price = $inv ? ($rT > 0 ? round(1/$rT, 5) : 0) : $rT;
        $prev  = $inv ? ($rY > 0 ? round(1/$rY, 5) : $price) : $rY;
        $chg   = $prev > 0 ? round(($price - $prev) / $prev * 100, 4) : 0;
        $prices[$sym] = ['price'=>$price,'open'=>$prev,'high'=>max($price,$prev),'low'=>min($price,$prev),'chgPct'=>$chg,'vol'=>0,'source'=>'frankfurter'];
    }
}

// ── Calculate raw strength scores ────────────────────────────────────────
$rawScore  = ['USD'=>0,'EUR'=>0,'GBP'=>0,'JPY'=>0,'CHF'=>0,'AUD'=>0,'NZD'=>0,'CAD'=>0];
$pairCount = [];

foreach ($pairDefs as $sym => [,, $base, $quote]) {
    if (empty($prices[$sym]['chgPct'])) continue;
    $chg = (float)$prices[$sym]['chgPct'];
    $rawScore[$base]  = ($rawScore[$base]  ?? 0) + $chg;
    $rawScore[$quote] = ($rawScore[$quote] ?? 0) - $chg;
    $pairCount[$base]  = ($pairCount[$base]  ?? 0) + 1;
    $pairCount[$quote] = ($pairCount[$quote] ?? 0) + 1;
}

// Average per currency (so USD—in 6 pairs—isn't artificially amplified)
foreach ($rawScore as $cur => &$v) {
    $cnt = $pairCount[$cur] ?? 0;
    $v   = $cnt > 0 ? $v / $cnt : 0;
}
unset($v);

// Normalize to 0–100
$min = min($rawScore); $max = max($rawScore); $range = $max - $min;
$defaultScores = ['USD'=>74,'GBP'=>68,'EUR'=>58,'CHF'=>52,'CAD'=>48,'AUD'=>44,'NZD'=>40,'JPY'=>32];
$normalized = [];
foreach ($rawScore as $cur => $v) {
    $normalized[$cur] = $range > 0 ? (int)round((($v - $min) / $range) * 100) : ($defaultScores[$cur] ?? 50);
}
arsort($normalized);

// ── Build output ──────────────────────────────────────────────────────────
$out = []; $rank = 1;
foreach ($normalized as $cur => $score) {
    $chgSum = 0; $chgN = 0;
    foreach ($pairDefs as $sym => [,, $base, $quote]) {
        if (($base === $cur || $quote === $cur) && isset($prices[$sym]['chgPct'])) {
            $c = (float)$prices[$sym]['chgPct'];
            $chgSum += ($base === $cur ? $c : -$c); $chgN++;
        }
    }
    $out[] = ['currency'=>$cur,'score'=>$score,'rank'=>$rank++,'chgPct'=>$chgN>0?round($chgSum/$chgN,3):0];
}

$pairData = [];
foreach ($prices as $sym => $p) {
    $pairData[] = ['symbol'=>$sym,'price'=>$p['price'],'chgPct'=>$p['chgPct'],'source'=>$p['source']??'?'];
}

$result = ['status'=>empty($prices)?'degraded':'success','timestamp'=>date('Y-m-d H:i:s'),'currencies'=>$out,'pairs'=>$pairData];
$json   = json_encode($result);
@file_put_contents($cacheFile, $json, LOCK_EX);
header('X-QI-Cache: MISS');
echo $json;
