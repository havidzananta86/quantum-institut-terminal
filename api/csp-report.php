<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

$raw = file_get_contents('php://input');
if (strlen($raw) > 8192) {
    http_response_code(413);
    echo json_encode(['error' => 'Payload too large']);
    exit;
}

$data = json_decode($raw, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$report = $data['csp-report'] ?? $data;

$entry = [
    'ts'              => gmdate('c'),
    'blocked_uri'     => mb_substr($report['blocked-uri'] ?? '', 0, 500),
    'violated'        => mb_substr($report['violated-directive'] ?? '', 0, 200),
    'effective'       => mb_substr($report['effective-directive'] ?? '', 0, 200),
    'document_uri'    => mb_substr($report['document-uri'] ?? '', 0, 500),
    'source_file'     => mb_substr($report['source-file'] ?? '', 0, 500),
    'line'            => (int)($report['line-number'] ?? 0),
    'disposition'     => mb_substr($report['disposition'] ?? '', 0, 20),
    'ip'              => $_SERVER['REMOTE_ADDR'] ?? '',
];

$dir = __DIR__ . '/../cache/csp-reports';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$file = $dir . '/csp-' . gmdate('Y-m-d') . '.jsonl';
file_put_contents($file, json_encode($entry, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);

http_response_code(204);
