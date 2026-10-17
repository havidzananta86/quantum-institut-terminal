<?php
/**
 * Realtime News Aggregator — RSS feeds (tanpa API key).
 * Mengambil beberapa feed finansial/kripto, deteksi kategori & sentimen
 * sederhana berbasis kata kunci, cache 5 menit di cache/news.json.
 * Fallback ke daftar statis hanya bila SEMUA feed gagal.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$cacheDir  = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = $cacheDir . '/news.json';
$cacheTtl  = 300;

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    header('X-QI-Cache: HIT');
    echo file_get_contents($cacheFile);
    exit();
}

if (!function_exists('qi_http_get')) {
    function qi_http_get($url, $timeout = 6) {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => $timeout,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (QuantumTerminal NewsBot)',
                CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
            ]);
            $res  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return ($res && $code >= 200 && $code < 300) ? $res : false;
        }
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => $timeout, 'header' => "User-Agent: Mozilla/5.0\r\n"]]);
        return @file_get_contents($url, false, $ctx);
    }
}

// Feed RSS publik (tanpa kunci). Masing-masing diberi kategori default.
$feeds = [
    ['url' => 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'source' => 'CoinDesk',          'cat' => 'CRYPTO'],
    ['url' => 'https://cointelegraph.com/rss',                   'source' => 'CoinTelegraph',     'cat' => 'CRYPTO'],
    ['url' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=EURUSD=X,GBPUSD=X,GC=F,USDJPY=X&region=US&lang=en-US', 'source' => 'Yahoo Finance', 'cat' => 'FOREX'],
    ['url' => 'https://www.forexlive.com/feed/news',             'source' => 'ForexLive',         'cat' => 'MACRO'],
    ['url' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=CL=F,BZ=F,SI=F&region=US&lang=en-US', 'source' => 'Yahoo Commodities', 'cat' => 'COMMODITY'],
];

/**
 * Gambar mini artikel (media:content / media:thumbnail / enclosure / <img> pertama).
 * Hanya https supaya halaman HTTPS tidak memuat konten campuran; null bila tidak ada.
 */
function qi_news_gambar($e) {
    $kandidat = [];
    $media = $e->children('http://search.yahoo.com/mrss/');
    if ($media) {
        foreach ([$media->content, $media->thumbnail] as $m) {
            if ($m && isset($m->attributes()->url)) $kandidat[] = (string)$m->attributes()->url;
        }
        if (isset($media->group->content) && isset($media->group->content->attributes()->url)) {
            $kandidat[] = (string)$media->group->content->attributes()->url;
        }
    }
    if (isset($e->enclosure) && stripos((string)$e->enclosure['type'], 'image') === 0) $kandidat[] = (string)$e->enclosure['url'];
    $isi = (string)($e->children('http://purl.org/rss/1.0/modules/content/')->encoded ?? '') . (string)($e->description ?? '');
    if (preg_match('/<img[^>]+src=["\']([^"\']+)/i', $isi, $m)) $kandidat[] = html_entity_decode($m[1]);
    foreach ($kandidat as $u) {
        $u = trim($u);
        if (strpos($u, 'https://') === 0 && strlen($u) < 600 && !preg_match('/[\s"<>]/', $u)) return $u;
    }
    return null;
}

function qi_detect_category($text, $default) {
    $t = strtolower($text);
    if (preg_match('/\b(gold|xau|bullion|precious metal|emas|silver)\b/', $t))            return 'GOLD';
    if (preg_match('/\b(bitcoin|btc|ethereum|eth|crypto|blockchain|solana|altcoin|defi)\b/', $t)) return 'CRYPTO';
    if (preg_match('/\b(fed|inflation|cpi|interest rate|gdp|central bank|treasury|fomc)\b/', $t)) return 'MACRO';
    if (preg_match('/\b(crude|oil|wti|brent|petroleum|gas)\b/', $t))                     return 'COMMODITY';
    if (preg_match('/\b(dollar|euro|eur\/usd|forex|currency|yen|pound|gbp|usd|cad|aud)\b/', $t)) return 'FOREX';
    return $default;
}

function qi_detect_sentiment($text) {
    $t = strtolower($text);
    $bull = preg_match_all('/\b(surge|soar|jump|rally|gain|rise|rises|high|boom|bullish|record|breakout|inflow|rebound|climb|advance|positive|boost|profit|uptrend)\b/', $t);
    $bear = preg_match_all('/\b(plunge|crash|fall|falls|drop|decline|slump|bearish|selloff|sell-off|loss|fear|dump|outflow|tumble|sink|warning|negative|recession|downtrend)\b/', $t);
    $total = $bull + $bear;
    $score = ($total > 0) ? round(($bull - $bear) / $total, 2) : 0.0;
    $label = ($score >= 0.2) ? 'bullish' : (($score <= -0.2) ? 'bearish' : 'neutral');
    return ['label' => $label, 'score' => $score, 'bull' => $bull, 'bear' => $bear];
}

// Deteksi pair/asset yang relevan (untuk filter & marker chart)
function qi_detect_symbols($text) {
    $t = strtolower($text);
    $syms = [];
    if (preg_match('/\b(bitcoin|btc)\b/', $t))                 $syms[] = 'BTCUSDT';
    if (preg_match('/\b(ethereum|eth)\b/', $t))                $syms[] = 'ETHUSDT';
    if (preg_match('/\b(solana|sol)\b/', $t))                  $syms[] = 'SOLUSDT';
    if (preg_match('/\b(gold|xau|bullion|emas)\b/', $t))       $syms[] = 'XAUUSD';
    if (preg_match('/\b(euro|eur\/usd|eurusd)\b/', $t))        $syms[] = 'EURUSD';
    if (preg_match('/\b(pound|gbp|gbp\/usd|gbpusd)\b/', $t))   $syms[] = 'GBPUSD';
    if (preg_match('/\b(yen|jpy|usd\/jpy|usdjpy)\b/', $t))     $syms[] = 'USDJPY';
    if (preg_match('/\b(cad|loonie|usd\/cad|usdcad)\b/', $t))  $syms[] = 'USDCAD';
    if (preg_match('/\b(aussie|aud|aud\/usd|audusd)\b/', $t))  $syms[] = 'AUDUSD';
    if (preg_match('/\b(crude|oil|wti|brent)\b/', $t))         $syms[] = 'USOIL';
    return array_values(array_unique($syms));
}

$perFeedItems = [];   // array per feed (untuk round-robin → jaga variasi sumber)
$seen = [];

foreach ($feeds as $fi => $feed) {
    $raw = qi_http_get($feed['url'], 6);
    if (!$raw) continue;

    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($raw);
    libxml_clear_errors();
    if (!$xml) continue;

    // Dukung format RSS (channel>item) & Atom (entry)
    $entries = [];
    if (isset($xml->channel->item))      $entries = $xml->channel->item;
    elseif (isset($xml->entry))          $entries = $xml->entry;
    if (!$entries || count($entries) === 0) continue;

    $bucket  = [];
    $perFeed = 0;
    foreach ($entries as $e) {
        if ($perFeed >= 8) break;

        $title = trim((string)($e->title ?? ''));
        if ($title === '') continue;

        $link = (string)($e->link ?? '');
        if ($link === '' && isset($e->link['href'])) $link = (string)$e->link['href'];

        $pub = (string)($e->pubDate ?? $e->published ?? $e->updated ?? '');
        $ts  = $pub ? strtotime($pub) : time();
        if (!$ts) $ts = time();

        $desc = trim(strip_tags((string)($e->description ?? $e->summary ?? '')));
        $blob = $title . ' ' . $desc;

        $key = md5($title);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;

        $sent = qi_detect_sentiment($blob);
        $bucket[] = [
            'id'              => 'news_' . substr($key, 0, 10),
            'source'          => $feed['source'],
            'title'           => mb_substr($title, 0, 180),
            'url'             => (strpos($link, 'http') === 0) ? $link : '#',
            'category'        => qi_detect_category($blob, $feed['cat']),
            'published_at'    => date('c', $ts),
            'ts'              => $ts,
            'sentiment'       => $sent['label'],
            'sentiment_score' => $sent['score'],
            'symbols'         => qi_detect_symbols($blob),
            'image'           => qi_news_gambar($e),
        ];
        $perFeed++;
    }
    // Tiap feed diurutkan terbaru dulu
    usort($bucket, fn($a, $b) => $b['ts'] - $a['ts']);
    if ($bucket) $perFeedItems[] = $bucket;
}

// Round-robin: ambil bergantian dari tiap feed → semua sumber/kategori terwakili
$items = [];
$round = 0;
while (count($items) < 18) {
    $added = false;
    foreach ($perFeedItems as $bucket) {
        if (isset($bucket[$round])) {
            $items[] = $bucket[$round];
            $added = true;
            if (count($items) >= 18) break;
        }
    }
    if (!$added) break;
    $round++;
}
foreach ($items as &$it) { unset($it['ts']); }
unset($it);

// Fallback statis bila semua feed gagal
if (empty($items)) {
    $items = [
        ['id'=>'news_fallback_1','source'=>'Quantum Wire','title'=>'Feed berita realtime sedang tidak tersedia — periksa koneksi server.','url'=>'#','category'=>'INFO','published_at'=>date('c'),'sentiment'=>'neutral','symbols'=>[]],
    ];
    $result = ['status'=>'degraded','timestamp'=>date('Y-m-d H:i:s'),'count'=>count($items),'data'=>$items];
    // Jangan cache hasil gagal (biar coba lagi di request berikutnya)
    echo json_encode($result);
    exit();
}

$result = [
    'status'    => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'count'     => count($items),
    'data'      => $items,
];

$json = json_encode($result);
@file_put_contents($cacheFile, $json, LOCK_EX);
header('X-QI-Cache: MISS');
echo $json;
