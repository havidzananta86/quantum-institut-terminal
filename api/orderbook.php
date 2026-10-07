<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 10);

if (!function_exists('qi_http_get')) {
    function qi_http_get($url, $timeout = 4) {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (QuantumTerminal)', CURLOPT_SSL_VERIFYPEER => false,
            ]);
            $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            return ($res && $code >= 200 && $code < 300) ? $res : false;
        }
        return @file_get_contents($url, false, stream_context_create(['http'=>['timeout'=>$timeout]]));
    }
}

$symbol = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 12)) : 'BTCUSDT';
$limit  = min((int)($_GET['limit'] ?? 20), 20);

$hosts = [
    'https://data-api.binance.vision',
    'https://api.binance.com',
    'https://api1.binance.com',
];

foreach ($hosts as $host) {
    $raw = qi_http_get("{$host}/api/v3/depth?symbol={$symbol}&limit={$limit}", 3);
    if ($raw) {
        $data = json_decode($raw, true);
        if (!empty($data['bids'])) {
            header('Cache-Control: no-store');
            echo json_encode(['status'=>'success','symbol'=>$symbol,'bids'=>$data['bids'],'asks'=>$data['asks']]);
            exit;
        }
    }
}

echo json_encode(['status'=>'error','symbol'=>$symbol,'bids'=>[],'asks'=>[]]);
