<?php
/**
 * #43 API Key Management
 * GET    — list user's API keys
 * POST   — generate new API key
 * DELETE — revoke an API key
 *
 * Keys stored in cache/api_keys.json keyed by user_id.
 * PRO users only.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(20, 60);

$user = qi_require_auth();

if (!in_array($user['role'], ['pro', 'vip', 'admin'])) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Fitur ini hanya untuk user PRO/VIP']);
    exit();
}

$keysFile = __DIR__ . '/../cache/api_keys.json';
$allKeys = [];
if (file_exists($keysFile)) {
    $allKeys = json_decode(file_get_contents($keysFile), true) ?: [];
}

$userId = (string) $user['user_id'];
$userKeys = $allKeys[$userId] ?? [];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $safe = array_map(function($k) {
        return [
            'id' => $k['id'],
            'name' => $k['name'],
            'prefix' => $k['prefix'],
            'created_at' => $k['created_at'],
            'last_used' => $k['last_used'] ?? null,
        ];
    }, $userKeys);
    echo json_encode(['status' => 'success', 'keys' => $safe]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (count($userKeys) >= 5) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Maksimal 5 API key per akun']);
        exit();
    }

    $input = qi_get_json_body();
    $name = qi_sanitize_string($input['name'] ?? 'My API Key', 50);

    $rawKey = 'qi_' . bin2hex(random_bytes(24));
    $prefix = substr($rawKey, 0, 10) . '...';

    $newKey = [
        'id' => bin2hex(random_bytes(8)),
        'name' => $name,
        'key_hash' => hash('sha256', $rawKey),
        'prefix' => $prefix,
        'created_at' => date('Y-m-d H:i:s'),
        'last_used' => null,
    ];

    $userKeys[] = $newKey;
    $allKeys[$userId] = $userKeys;
    file_put_contents($keysFile, json_encode($allKeys, JSON_PRETTY_PRINT));

    echo json_encode([
        'status' => 'success',
        'message' => 'API key berhasil dibuat. Simpan key ini — tidak akan ditampilkan lagi.',
        'key' => $rawKey,
        'name' => $name,
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = qi_get_json_body();
    $keyId = qi_sanitize_string($input['id'] ?? '', 20);
    if (!$keyId) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Key ID diperlukan']);
        exit();
    }

    $userKeys = array_filter($userKeys, function($k) use ($keyId) {
        return $k['id'] !== $keyId;
    });
    $allKeys[$userId] = array_values($userKeys);
    file_put_contents($keysFile, json_encode($allKeys, JSON_PRETTY_PRINT));

    echo json_encode(['status' => 'success', 'message' => 'API key berhasil dicabut']);
    exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Method tidak diizinkan']);
