<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/../config/api_keys.php';
qi_rate_limit(10, 60);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status'=>'error','message'=>'Method not allowed']);
    exit;
}

$input   = qi_get_json_body();
$chatId  = isset($input['chat_id'])  ? qi_sanitize_string((string)$input['chat_id'], 50)  : '';
$message = isset($input['message'])  ? trim((string)$input['message'])                    : '';

if (!$chatId || !$message) {
    http_response_code(400);
    echo json_encode(['status'=>'error','message'=>'chat_id dan message wajib diisi']);
    exit;
}
$message = mb_substr($message, 0, 500);

if (!defined('TELEGRAM_BOT_TOKEN') || !TELEGRAM_BOT_TOKEN) {
    http_response_code(503);
    echo json_encode(['status'=>'error','message'=>'Bot Telegram belum dikonfigurasi. Hubungi admin.']);
    exit;
}

$url     = 'https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/sendMessage';
$payload = json_encode(['chat_id' => $chatId, 'text' => $message, 'parse_mode' => 'HTML']);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 6,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_SSL_VERIFYPEER => false,
]);
$raw  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($raw) {
    $d = json_decode($raw, true);
    if (!empty($d['ok'])) {
        echo json_encode(['status'=>'success']);
        exit;
    }
    http_response_code(502);
    echo json_encode(['status'=>'error','message'=>'Telegram: ' . ($d['description'] ?? 'Unknown error')]);
    exit;
}

http_response_code(502);
echo json_encode(['status'=>'error','message'=>'Tidak dapat terhubung ke Telegram API']);
