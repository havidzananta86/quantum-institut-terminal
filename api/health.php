<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$checks = ['php' => true, 'db' => false, 'disk' => false];
$status = 'ok';

$checks['php_version'] = PHP_VERSION;

$configPath = __DIR__ . '/../config/database.php';
if (file_exists($configPath)) {
    try {
        require_once $configPath;
        if (function_exists('getDBConnection')) {
            $pdo = getDBConnection();
            $pdo->query('SELECT 1');
            $checks['db'] = true;
        }
    } catch (Exception $e) {
        $checks['db'] = false;
        $checks['db_error'] = 'connection_failed';
        $status = 'degraded';
    }
} else {
    $checks['db_error'] = 'not_configured';
    $status = 'degraded';
}

$free = @disk_free_space(__DIR__);
$total = @disk_total_space(__DIR__);
if ($free !== false && $total !== false && $total > 0) {
    $checks['disk'] = true;
    $checks['disk_free_gb'] = round($free / 1073741824, 2);
    $checks['disk_pct_used'] = round((1 - $free / $total) * 100, 1);
    if ($checks['disk_pct_used'] > 90) $status = 'degraded';
}

$checks['cache_writable'] = is_writable(__DIR__ . '/../cache');

$cfgPath = __DIR__ . '/../config/api_keys.php';
if (file_exists($cfgPath)) {
    require_once $cfgPath;
    $checks['api_keys'] = true;
    $missing = [];
    if (!defined('TWELVE_DATA_KEY') || TWELVE_DATA_KEY === '') $missing[] = 'twelvedata';
    if ($missing) {
        $checks['api_keys_missing'] = $missing;
        $status = 'degraded';
    }
    // Fitur opsional (bot Telegram global, login Google): kosong = fitur mati, bukan situs rusak.
    // Dulu ikut membuat 503 permanen sehingga pemantau uptime selalu melapor "down".
    $opsional = [];
    if (!defined('TELEGRAM_BOT_TOKEN') || TELEGRAM_BOT_TOKEN === '') $opsional[] = 'telegram';
    if (!defined('GOOGLE_CLIENT_ID') || GOOGLE_CLIENT_ID === '') $opsional[] = 'google';
    if (!defined('GROQ_API_KEY') || GROQ_API_KEY === '') $opsional[] = 'groq';   // AI Assistant & penjelasan setup
    if ($opsional) $checks['api_keys_optional_missing'] = $opsional;
} else {
    $checks['api_keys'] = false;
    $checks['api_keys_missing'] = ['file_not_found'];
    $status = 'degraded';
}

// ?bridges=1 : uji koneksi Hostinger -> bridge VPS. Hanya alamat publik, kode HTTP, dan galat curl;
// kunci tidak pernah ditampilkan. Tidak dijalankan pada pemanggilan biasa (monitor uptime).
if (isset($_GET['bridges'])) {
    $bridgeCfg = __DIR__ . '/../config/bridge.php';
    if (!defined('QI_TV_BRIDGE_URL') && !defined('QI_MT5_BRIDGE_URL') && is_file($bridgeCfg)) require_once $bridgeCfg;
    $probe = function (string $url, array $header = []): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER     => $header,
        ]);
        $t0 = microtime(true);
        $raw = curl_exec($ch);
        $out = [
            'http'  => (int)curl_getinfo($ch, CURLINFO_HTTP_CODE),
            'ms'    => (int)round((microtime(true) - $t0) * 1000),
            'error' => $raw === false ? curl_error($ch) : null,
        ];
        curl_close($ch);
        return $out;
    };
    $hostOnly = fn(string $u): string => preg_replace('#^(\w+://[^/]+).*$#', '$1', $u);
    $tvUrl = defined('QI_TV_BRIDGE_URL') ? rtrim((string)QI_TV_BRIDGE_URL, '/') : '';
    $tv = ['configured' => $tvUrl !== '', 'host' => $tvUrl !== '' ? $hostOnly($tvUrl) : null,
           'key_set' => defined('QI_TV_BRIDGE_KEY') && (string)QI_TV_BRIDGE_KEY !== ''];
    if ($tvUrl !== '') {
        $tv['health'] = $probe($tvUrl . '/health');
        $tv['candles_with_key'] = $probe($tvUrl . '/candles?exchange=OANDA&symbol=XAUUSD&tf=1h&limit=5',
            $tv['key_set'] ? ['X-Bridge-Key: ' . QI_TV_BRIDGE_KEY] : []);
    }
    $mt5Url = defined('QI_MT5_BRIDGE_URL') ? preg_replace('#^ws#i', 'http', rtrim((string)QI_MT5_BRIDGE_URL, '/')) : '';
    $mt5 = ['configured' => $mt5Url !== '', 'host' => $mt5Url !== '' ? $hostOnly($mt5Url) : null,
            'secret_set' => defined('QI_MT5_BRIDGE_SECRET') && (string)QI_MT5_BRIDGE_SECRET !== ''];
    if ($mt5Url !== '') $mt5['health'] = $probe($mt5Url . '/health');
    $marker = __DIR__ . '/../cache/tv_bridge_down.txt';
    $checks['bridges'] = [
        'tv' => $tv,
        'mt5' => $mt5,
        'tv_breaker_age_s' => is_file($marker) ? time() - (int)filemtime($marker) : null,
    ];
}

if (!$checks['db'] || !$checks['disk'] || !$checks['cache_writable']) {
    $status = 'degraded';
}

http_response_code($status === 'ok' ? 200 : 503);
echo json_encode([
    'status' => $status,
    'checks' => $checks,
    'timestamp' => gmdate('c'),
    'version' => '1.0.0',
], JSON_PRETTY_PRINT);
