<?php
/**
 * Same-origin Binance REST proxy for the embedded chart vendor.
 *
 * The vendor bundle is third-party and cannot be taught about the application's
 * auth/session headers. Keep this endpoint deliberately narrow: only the public
 * market-data routes used by the widget are allowed, and every request is
 * forwarded to Binance Vision before the public Binance fallbacks.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(180, 60);

$rawPath = (string)($_GET['path'] ?? '');
$rawPath = rawurldecode($rawPath);
$embeddedQuery = [];
if (strpos($rawPath, '?') !== false) {
    $parsed = parse_url($rawPath);
    $rawPath = (string)($parsed['path'] ?? '');
    parse_str((string)($parsed['query'] ?? ''), $embeddedQuery);
}

$routes = [
    '/api/v3/exchangeInfo' => true,
    '/api/v3/ticker/24hr' => true,
    '/api/v3/klines' => true,
    '/api/v3/aggTrades' => true,
    '/api/v3/depth' => true,
];
if (!isset($routes[$rawPath])) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'code' => 'BINANCE_ROUTE_NOT_ALLOWED']);
    exit;
}

$allowedQuery = ['symbol', 'symbols', 'interval', 'limit', 'startTime', 'endTime'];
$query = [];
$inputQuery = array_merge($embeddedQuery, $_GET);
foreach ($allowedQuery as $key) {
    if (!array_key_exists($key, $inputQuery) || is_array($inputQuery[$key])) continue;
    $value = trim((string)$inputQuery[$key]);
    if ($value === '' || strlen($value) > 120) continue;
    $query[$key] = $value;
}

// Bound the expensive/large public endpoints even if a caller supplies a large limit.
if (isset($query['limit'])) {
    $limit = max(1, min(1000, (int)$query['limit']));
    if ($rawPath === '/api/v3/depth') $limit = min(100, $limit);
    $query['limit'] = (string)$limit;
}

$suffix = $rawPath . ($query ? '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
$hosts = [
    'https://data-api.binance.vision',
    'https://api1.binance.com',
    'https://api.binance.com',
];

foreach ($hosts as $host) {
    $body = qi_http_get($host . $suffix, 8);
    if (!is_string($body) || $body === '') continue;
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) continue;
    header('Cache-Control: no-store');
    echo json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(502);
echo json_encode(['status' => 'error', 'code' => 'BINANCE_UPSTREAM_UNAVAILABLE']);
