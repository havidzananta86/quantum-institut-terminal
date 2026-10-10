<?php
/**
 * #50 Admin Analytics Dashboard API
 * GET — returns system analytics for admin dashboard
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$user = qi_require_admin();

try {
    $pdo = qi_db();
    $analytics = [];

    // Active sessions (not expired)
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()');
    $stmt->execute();
    $analytics['active_sessions'] = (int) $stmt->fetchColumn();

    // Signals in last 7 days
    $signalFile = __DIR__ . '/../cache/signal_history.json';
    $signals7d = 0;
    if (file_exists($signalFile)) {
        $history = json_decode(file_get_contents($signalFile), true) ?: [];
        $weekAgo = strtotime('-7 days');
        foreach ($history as $sig) {
            $t = strtotime($sig['timestamp'] ?? $sig['date'] ?? '');
            if ($t && $t >= $weekAgo) $signals7d++;
        }
    }
    $analytics['signals_7d'] = $signals7d;

    // Total API keys
    $keysFile = __DIR__ . '/../cache/api_keys.json';
    $totalKeys = 0;
    if (file_exists($keysFile)) {
        $allKeys = json_decode(file_get_contents($keysFile), true) ?: [];
        foreach ($allKeys as $uid => $keys) {
            $totalKeys += count($keys);
        }
    }
    $analytics['total_api_keys'] = $totalKeys;

    // Total referrals
    $refFile = __DIR__ . '/../cache/referrals.json';
    $totalRefs = 0;
    if (file_exists($refFile)) {
        $allRefs = json_decode(file_get_contents($refFile), true) ?: [];
        foreach ($allRefs as $uid => $data) {
            $totalRefs += count($data['referrals'] ?? []);
        }
    }
    $analytics['total_referrals'] = $totalRefs;

    // Recent logins (last 10)
    $stmt = $pdo->prepare(
        'SELECT u.email, s.created_at as time
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         ORDER BY s.created_at DESC
         LIMIT 10'
    );
    $stmt->execute();
    $analytics['recent_logins'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // System info
    $analytics['php_version'] = PHP_VERSION;

    $cacheDir = __DIR__ . '/../cache';
    $cacheFiles = 0;
    if (is_dir($cacheDir)) {
        $iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($cacheDir, RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($iter as $file) {
            if ($file->isFile()) $cacheFiles++;
        }
    }
    $analytics['cache_files'] = $cacheFiles;

    // Error log count (last 24h)
    $errorLog = __DIR__ . '/../cache/error_log.json';
    $errors24 = 0;
    if (file_exists($errorLog)) {
        $errors = json_decode(file_get_contents($errorLog), true) ?: [];
        $dayAgo = time() - 86400;
        foreach ($errors as $err) {
            $t = strtotime($err['timestamp'] ?? '');
            if ($t && $t >= $dayAgo) $errors24++;
        }
    }
    $analytics['errors_24h'] = $errors24;

    // Uptime (server uptime via php)
    if (function_exists('sys_getloadavg') && PHP_OS_FAMILY !== 'Windows') {
        $uptime = @file_get_contents('/proc/uptime');
        if ($uptime) {
            $secs = (int) floatval($uptime);
            $days = floor($secs / 86400);
            $hrs = floor(($secs % 86400) / 3600);
            $analytics['uptime'] = $days . 'd ' . $hrs . 'h';
        } else {
            $analytics['uptime'] = '—';
        }
    } else {
        $analytics['uptime'] = 'N/A (Windows)';
    }

    echo json_encode(['status' => 'success', 'analytics' => $analytics]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gagal memuat analytics']);
}
