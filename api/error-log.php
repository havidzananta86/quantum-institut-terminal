<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"error":"POST only"}'; exit; }

$raw = file_get_contents('php://input');
if (strlen($raw) > 8192) { http_response_code(413); echo '{"error":"too large"}'; exit; }

$data = json_decode($raw, true);
if (!$data || empty($data['message'])) { http_response_code(400); echo '{"error":"invalid"}'; exit; }

$logDir = __DIR__ . '/../cache/errorlogs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);

$entry = [
    'ts'    => gmdate('c'),
    'msg'   => mb_substr($data['message'] ?? '', 0, 500),
    'src'   => mb_substr($data['source'] ?? '', 0, 200),
    'line'  => (int)($data['line'] ?? 0),
    'col'   => (int)($data['col'] ?? 0),
    'stack' => mb_substr($data['stack'] ?? '', 0, 1000),
    'url'   => mb_substr($data['url'] ?? '', 0, 200),
    'ua'    => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
    'ip'    => $_SERVER['REMOTE_ADDR'] ?? '',
];

$file = $logDir . '/errors-' . date('Y-m-d') . '.jsonl';
@file_put_contents($file, json_encode($entry) . "\n", FILE_APPEND | LOCK_EX);

echo '{"ok":true}';
