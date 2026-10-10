<?php
/**
 * #42 OTP / 2FA Verification API
 * POST /api/otp.php?action=send   — generate & store OTP (6 digit)
 * POST /api/otp.php?action=verify — verify OTP code
 *
 * OTP is stored in cache/otp/ as JSON files keyed by email hash.
 * In production, this would send via email (SMTP).
 * For dev/demo, the OTP is returned in response.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(10, 60);

$action = $_GET['action'] ?? '';

$otpDir = __DIR__ . '/../cache/otp';
if (!is_dir($otpDir)) @mkdir($otpDir, 0755, true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method POST diperlukan']);
    exit();
}

$input = qi_get_json_body();
if (!$input || empty($input['email'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Email diperlukan']);
    exit();
}

$email = strtolower(trim(qi_sanitize_string($input['email'], 150)));
$emailHash = md5($email);
$otpFile = $otpDir . '/' . $emailHash . '.json';

if ($action === 'send') {
    $code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    $data = [
        'code' => password_hash($code, PASSWORD_DEFAULT),
        'email' => $email,
        'created_at' => time(),
        'expires_at' => time() + 300, // 5 minutes
        'attempts' => 0,
    ];
    file_put_contents($otpFile, json_encode($data));

    // In production: send via email using PHPMailer or similar
    // For demo, return code directly (DEV mode only)
    $response = ['status' => 'success', 'message' => 'Kode OTP telah dikirim ke email Anda'];
    if (QI_DEV) {
        $response['dev_otp'] = $code;
    }
    echo json_encode($response);
    exit();
}

if ($action === 'verify') {
    if (empty($input['code'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Kode OTP diperlukan']);
        exit();
    }

    if (!file_exists($otpFile)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Tidak ada OTP yang diminta. Kirim ulang.']);
        exit();
    }

    $data = json_decode(file_get_contents($otpFile), true);
    if (!$data) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Data OTP rusak']);
        exit();
    }

    if (time() > ($data['expires_at'] ?? 0)) {
        @unlink($otpFile);
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'OTP sudah expired. Kirim ulang.']);
        exit();
    }

    if (($data['attempts'] ?? 0) >= 5) {
        @unlink($otpFile);
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Terlalu banyak percobaan. Kirim ulang OTP.']);
        exit();
    }

    $data['attempts'] = ($data['attempts'] ?? 0) + 1;
    file_put_contents($otpFile, json_encode($data));

    $code = qi_sanitize_string($input['code'], 6);
    if (!password_verify($code, $data['code'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Kode OTP salah. Sisa percobaan: ' . (5 - $data['attempts'])]);
        exit();
    }

    @unlink($otpFile);
    echo json_encode(['status' => 'success', 'message' => 'OTP terverifikasi', 'verified' => true]);
    exit();
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Action harus send atau verify']);
