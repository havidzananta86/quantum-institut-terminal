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
    if (!defined('TELEGRAM_BOT_TOKEN') || TELEGRAM_BOT_TOKEN === '') $missing[] = 'telegram';
    if (!defined('GOOGLE_CLIENT_ID') || GOOGLE_CLIENT_ID === '') $missing[] = 'google';
    if (!defined('TWELVEDATA_API_KEY') || TWELVEDATA_API_KEY === '') $missing[] = 'twelvedata';
    if ($missing) {
        $checks['api_keys_missing'] = $missing;
        $status = 'degraded';
    }
} else {
    $checks['api_keys'] = false;
    $checks['api_keys_missing'] = ['file_not_found'];
    $status = 'degraded';
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
