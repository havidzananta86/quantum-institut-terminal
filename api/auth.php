<?php
/**
 * Quantum Institut Market Terminal - Auth API Endpoint
 * Handles License Key Validation & User Login
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$type = isset($input['type']) ? $input['type'] : 'license';

if ($type === 'license') {
    $licenseKey = isset($input['license_key']) ? trim($input['license_key']) : '';
    
    if (empty($licenseKey)) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Kunci Lisensi tidak boleh kosong.'
        ]);
        exit();
    }

    // Dummy validation logic for demo
    if (strpos(strtoupper($licenseKey), 'QI-') === 0 || $licenseKey === 'QI-2026-99PRO-DEMO') {
        echo json_encode([
            'status' => 'success',
            'message' => 'Kunci Lisensi Terverifikasi.',
            'data' => [
                'user_id' => 101,
                'license_key' => strtoupper($licenseKey),
                'plan' => 'Quantum+ PRO (6 Bulan)',
                'expires_at' => '2026-12-31 23:59:59',
                'active_slots' => 12,
                'token' => bin2hex(random_bytes(32))
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Kunci Lisensi tidak valid atau telah kadaluarsa.'
        ]);
    }

} else if ($type === 'email') {
    $email = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? trim($input['password']) : '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Email dan kata sandi harus diisi.'
        ]);
        exit();
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Login Berhasil.',
        'data' => [
            'user_id' => 202,
            'email' => $email,
            'plan' => 'Quantum+ PRO',
            'token' => bin2hex(random_bytes(32))
        ]
    ]);
} else {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Tipe autentikasi tidak dikenal.'
    ]);
}
