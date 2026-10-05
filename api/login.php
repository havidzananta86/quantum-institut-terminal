<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$input = json_decode(file_get_contents('php://input'), true);
$license = isset($input['license_key']) ? trim($input['license_key']) : '';

if (!empty($license)) {
    echo json_encode([
        'status' => 'success',
        'message' => 'Otentikasi Berhasil',
        'token' => bin2hex(random_bytes(16)),
        'user' => ['license' => $license, 'role' => 'pro']
    ]);
} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kunci lisensi diperlukan']);
}
