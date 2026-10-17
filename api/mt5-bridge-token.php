<?php
/**
 * Token berumur pendek untuk MT5 WebSocket bridge (mt5-bridge/).
 *
 * GET → { url, token, expires_in, symbols } bagi pengguna yang berhak.
 * Token = JWT HS256 yang ditandatangani QI_MT5_BRIDGE_SECRET (rahasia yang sama
 * dipasang di bridge Python). Bridge memverifikasi tanda tangan, audience, dan
 * kedaluwarsa — tanpa perlu memanggil balik server PHP.
 *
 * Kebijakan akses (QI_MT5_BRIDGE_AUDIENCE):
 *   'owner' (bawaan) — hanya pemilik akun MT5 bridge (trading_accounts dengan
 *                      account_reference = QI_MT5_BRIDGE_ACCOUNT) dan admin.
 *                      Sama dengan aturan qi_broker_tick(): harga broker milik
 *                      seseorang tidak dibagikan ke pengguna lain.
 *   'pro'            — semua pengguna PRO/VIP/admin.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$_apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($_apiKeysFile)) require_once $_apiKeysFile;

$user = qi_require_auth();

$bridgeUrl = defined('QI_MT5_BRIDGE_URL') ? (string)QI_MT5_BRIDGE_URL : '';
$secret    = defined('QI_MT5_BRIDGE_SECRET') ? (string)QI_MT5_BRIDGE_SECRET : '';
if ($bridgeUrl === '' || strlen($secret) < 32) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'code' => 'BRIDGE_DISABLED', 'message' => 'MT5 bridge belum dikonfigurasi.']);
    exit();
}
if (!preg_match('#^wss?://#i', $bridgeUrl) || (!QI_DEV && stripos($bridgeUrl, 'wss://') !== 0)) {
    error_log('[QI MT5 Bridge] QI_MT5_BRIDGE_URL harus wss:// di produksi.');
    http_response_code(503);
    echo json_encode(['status' => 'error', 'code' => 'BRIDGE_MISCONFIGURED', 'message' => 'MT5 bridge belum siap.']);
    exit();
}

$uid      = (int)$user['user_id'];
$level    = qi_tingkat_peran($user['role'] ?? null);
$audience = defined('QI_MT5_BRIDGE_AUDIENCE') && QI_MT5_BRIDGE_AUDIENCE === 'pro' ? 'pro' : 'owner';
$account  = defined('QI_MT5_BRIDGE_ACCOUNT') ? trim((string)QI_MT5_BRIDGE_ACCOUNT) : '';

$allowed = $level >= 3;   // admin
if (!$allowed && $audience === 'pro') {
    $allowed = $level >= 1;
}
if (!$allowed && $audience === 'owner' && $account !== '') {
    try {
        $stmt = qi_db()->prepare(
            "SELECT 1 FROM trading_accounts
             WHERE user_id = :u AND account_reference = :a
               AND LOWER(provider) LIKE 'mt%' AND connection_status IN ('pending','active')
             LIMIT 1"
        );
        $stmt->execute([':u' => $uid, ':a' => $account]);
        $allowed = (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        error_log('[QI MT5 Bridge] cek kepemilikan gagal: ' . $e->getMessage());
        $allowed = false;
    }
}
if (!$allowed) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'code' => 'BRIDGE_FORBIDDEN', 'message' => 'Akun Anda tidak terhubung ke MT5 bridge ini.']);
    exit();
}

function qi_b64url(string $raw): string {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

$ttl = 300;
$now = time();
$header  = ['alg' => 'HS256', 'typ' => 'JWT'];
$payload = [
    'iss'   => 'qim',
    'aud'   => 'qim-mt5-bridge',
    'sub'   => (string)$uid,
    'scope' => 'ticks candles',
    'iat'   => $now,
    'nbf'   => $now - 5,
    'exp'   => $now + $ttl,
    'jti'   => bin2hex(random_bytes(12)),
];
$signingInput = qi_b64url(json_encode($header)) . '.' . qi_b64url(json_encode($payload));
$token = $signingInput . '.' . qi_b64url(hash_hmac('sha256', $signingInput, $secret, true));

$symbols = defined('QI_MT5_BRIDGE_SYMBOLS') ? array_values(array_filter(array_map('trim', explode(',', (string)QI_MT5_BRIDGE_SYMBOLS)))) : [];

echo json_encode(['status' => 'success', 'data' => [
    'url'        => $bridgeUrl,
    'token'      => $token,
    'expires_in' => $ttl,
    'symbols'    => $symbols,
]]);
