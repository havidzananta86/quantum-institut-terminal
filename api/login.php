<?php
/**
 * Quantum Institut — Login API (SECURED)
 * Redirect ke auth.php yang sudah diperbaiki. File ini dipertahankan
 * untuk backward compatibility dengan client yang memanggil /api/login.php.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

// Rate limit ketat untuk login: 5 request per 15 menit
qi_rate_limit(5, 900);

$input = qi_get_json_body();
if (!$input) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
    exit();
}

// Jika client kirim license_key, arahkan ke mode lisensi
$license = isset($input['license_key']) ? qi_sanitize_string($input['license_key'], 50) : '';
$email = isset($input['email']) ? qi_sanitize_string($input['email'], 100) : '';
$password = isset($input['password']) ? $input['password'] : '';

if (!empty($license)) {
    try {
        $pdo = qi_db();

        $stmt = $pdo->prepare('SELECT lk.*, u.id as user_id, u.email, u.role 
                               FROM license_keys lk 
                               JOIN users u ON u.id = lk.user_id 
                               WHERE lk.license_key = :key AND lk.is_active = 1 AND lk.expires_at > NOW()');
        $stmt->execute([':key' => strtoupper($license)]);
        $row = $stmt->fetch();

        if ($row) {
            // Token harus disimpan ke user_sessions, kalau tidak qi_validate_token() selalu menolak
            $token = createSession($pdo, $row['user_id'])['token'];
            echo json_encode([
                'status' => 'success',
                'message' => 'Otentikasi Berhasil',
                'token' => $token,
                'user' => [
                    'license' => $row['license_key'],
                    'role' => $row['role'],
                    'email' => $row['email']
                ]
            ]);
        } else {
            usleep(random_int(1000000, 2000000));
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Kunci lisensi tidak valid atau sudah kadaluarsa.']);
        }
    } catch (PDOException $e) {
        error_log('[QI Login] DB error: ' . $e->getMessage());
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Layanan autentikasi tidak tersedia.']);
    }

} else if (!empty($email) && !empty($password)) {
    // Forward ke auth.php mode email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Format email tidak valid.']);
        exit();
    }

    try {
        $pdo = qi_db();

        $stmt = $pdo->prepare('SELECT id, email, password_hash, role, is_active FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => strtolower($email)]);
        $user = $stmt->fetch();

        if ($user && $user['is_active'] && password_verify($password, $user['password_hash'])) {
            $token = createSession($pdo, $user['id'])['token'];
            echo json_encode([
                'status' => 'success',
                'message' => 'Login Berhasil',
                'token' => $token,
                'user' => ['email' => $user['email'], 'role' => $user['role']]
            ]);
        } else {
            usleep(random_int(1000000, 2000000));
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Email atau kata sandi tidak valid.']);
        }
    } catch (PDOException $e) {
        error_log('[QI Login] DB error: ' . $e->getMessage());
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Layanan autentikasi tidak tersedia.']);
    }

} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kunci lisensi atau email+password diperlukan.']);
}
