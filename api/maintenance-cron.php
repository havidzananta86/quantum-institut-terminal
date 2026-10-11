<?php
/**
 * Quantum Institut — Maintenance Cron
 *
 * Housekeeping for the file-based caches. Nothing here expires on its own:
 * cache/logs grows one file per day forever, and the rate-limit sweep in
 * _middleware.php only runs on ~1% of requests, so it stalls on a quiet site.
 *
 * Run from cron (every 6 hours is plenty):
 *   php /home/.../public_html/webapp/api/maintenance-cron.php
 *
 * Or over HTTP with the shared secret:
 *   GET /api/maintenance-cron.php?key=CRON_SECRET_KEY
 *
 * Add &dry=1 (or --dry on the CLI) to report what would be removed
 * without deleting anything.
 */

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    define('QI_DEV', false);
    require_once __DIR__ . '/_middleware.php';

    $cronKey  = '';
    $keysFile = __DIR__ . '/../config/api_keys.php';
    if (file_exists($keysFile)) { include_once $keysFile; }
    if (defined('CRON_SECRET_KEY')) $cronKey = CRON_SECRET_KEY;

    $providedKey = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
    if (!$cronKey || !hash_equals($cronKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Akses ditolak']);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
    $dryRun = !empty($_GET['dry']);
} else {
    require_once __DIR__ . '/_middleware.php';
    $dryRun = in_array('--dry', $argv ?? [], true);
}

// Retention per directory, in seconds. Key = directory under cache/,
// pattern = filenames eligible for deletion (anything else is left alone).
$RULES = [
    'logs'      => ['pattern' => '/^app-\d{4}-\d{2}-\d{2}\.jsonl$/',    'max_age' => 14 * 86400],
    // Written by api/error-log.php, one file per day, from browser errors.
    // Kept longer than app logs: it is the only record of client-side
    // failures, and a bug reported days later still needs its trace.
    'errorlogs' => ['pattern' => '/^errors-\d{4}-\d{2}-\d{2}\.jsonl$/', 'max_age' => 30 * 86400],
    'ratelimit' => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 3600],
    'otp'       => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 3600],
    'chart'     => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 86400],
    'td'        => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 86400],
];

$cacheRoot = realpath(__DIR__ . '/../cache');
$now       = time();
$report    = [];
$totalDel  = 0;
$totalBytes = 0;

if ($cacheRoot === false) {
    $out = ['status' => 'error', 'message' => 'cache/ tidak ditemukan'];
    echo $isCli ? json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL : json_encode($out);
    exit(1);
}

foreach ($RULES as $sub => $rule) {
    $dir = realpath($cacheRoot . DIRECTORY_SEPARATOR . $sub);
    // Guard against symlinks or traversal pointing outside cache/.
    if ($dir === false || strpos($dir, $cacheRoot) !== 0 || !is_dir($dir)) {
        $report[$sub] = ['skipped' => 'direktori tidak ada'];
        continue;
    }

    $deleted = 0; $kept = 0; $bytes = 0;
    foreach (scandir($dir) ?: [] as $name) {
        if ($name === '.' || $name === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path)) continue;                       // never touch subdirectories
        if (!preg_match($rule['pattern'], $name)) { $kept++; continue; }

        $age = $now - (int)@filemtime($path);
        if ($age <= $rule['max_age']) { $kept++; continue; }

        $size = (int)@filesize($path);
        if ($dryRun || @unlink($path)) {
            $deleted++; $bytes += $size;
        }
    }

    $report[$sub] = [
        'dihapus'    => $deleted,
        'disimpan'   => $kept,
        'bytes'      => $bytes,
        'max_age_h'  => round($rule['max_age'] / 3600, 1),
    ];
    $totalDel   += $deleted;
    $totalBytes += $bytes;
}

$out = [
    'status'      => 'success',
    'dry_run'     => $dryRun,
    'total_dihapus' => $totalDel,
    'total_kb'    => round($totalBytes / 1024, 1),
    'detail'      => $report,
    'timestamp'   => date('Y-m-d H:i:s'),
];

if (function_exists('qi_log')) {
    qi_log('info', 'maintenance-cron selesai', ['dihapus' => $totalDel, 'dry_run' => $dryRun]);
}

echo $isCli ? json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL : json_encode($out);
