<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim($input['email']) : '';

if (!empty($email)) {
    $license = 'QI-2026-' . strtoupper(substr(md5(uniqid()), 0, 6));
    echo json_encode([
        'status' => 'success',
        'message' => 'Pendaftaran Berhasil',
        'license_key' => $license
    ]);
} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Email harus diisi']);
}
