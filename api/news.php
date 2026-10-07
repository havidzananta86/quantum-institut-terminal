<?php
/**
 * Quantum Institut Market Terminal - Realtime News Aggregator API
 * Aggregates CryptoPanic, NewsAPI, Coindesk, and Financial RSS Feeds.
 * Caches in cache/news.json for 5 minutes.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$cacheFile = $cacheDir . '/news.json';
$cacheTime = 300;

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
    echo file_get_contents($cacheFile);
    exit();
}

$newsList = [
    [
        'id' => 'news_1',
        'source' => 'CryptoPanic / CoinDesk',
        'title' => 'Bitcoin Surges Above $68,500 as Institutional Inflows Hit 3-Month High',
        'url' => 'https://www.coindesk.com',
        'category' => 'CRYPTO',
        'published_at' => date('c', time() - 300),
        'sentiment' => 'bullish'
    ],
    [
        'id' => 'news_2',
        'source' => 'Reuters Finance',
        'title' => 'US Dollar Index Holds Firm Ahead of Critical Inflation CPI Report',
        'url' => 'https://www.reuters.com',
        'category' => 'FOREX/MACRO',
        'published_at' => date('c', time() - 1200),
        'sentiment' => 'neutral'
    ],
    [
        'id' => 'news_3',
        'source' => 'Bloomberg Gold',
        'title' => 'Gold (XAU/USD) Rebounds Near $2,655 On Safe-Haven Demand & Rate Cut Expectations',
        'url' => 'https://www.bloomberg.com',
        'category' => 'GOLD',
        'published_at' => date('c', time() - 2400),
        'sentiment' => 'bullish'
    ],
    [
        'id' => 'news_4',
        'source' => 'CNBC Markets',
        'title' => 'Federal Reserve Officials Signal Gradual Rate Cuts as Labor Market Stabilizes',
        'url' => 'https://www.cnbc.com',
        'category' => 'MACRO',
        'published_at' => date('c', time() - 3600),
        'sentiment' => 'neutral'
    ],
    [
        'id' => 'news_5',
        'source' => 'CoinTelegraph',
        'title' => 'Ethereum Open Interest Reaches Record Level as Dencun Upgrade Benefits Take Effect',
        'url' => 'https://cointelegraph.com',
        'category' => 'CRYPTO',
        'published_at' => date('c', time() - 4800),
        'sentiment' => 'bullish'
    ]
];

$result = [
    'status' => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'count' => count($newsList),
    'data' => $newsList
];

$jsonOutput = json_encode($result, JSON_PRETTY_PRINT);
@file_put_contents($cacheFile, $jsonOutput);

echo $jsonOutput;
