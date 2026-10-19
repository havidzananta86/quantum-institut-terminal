<?php
/**
 * Quantum Institut — Register API (SECURED)
 *
 * Membuat AKUN pengguna baru (bukan lisensi).
 * Lisensi PRO hanya diberikan setelah pembayaran terverifikasi via webhook.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

// Rate limit ketat: maks 5 registrasi per 15 menit per IP
qi_rate_limit(5, 900);

$input = qi_get_json_body();
if (!$input) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
    exit();
}

$fullName = isset($input['full_name']) ? qi_sanitize_string($input['full_name'], 100) : '';
$email    = isset($input['email']) ? qi_sanitize_string($input['email'], 150) : '';
$password = isset($input['password']) ? $input['password'] : ''; // jangan sanitize password
$phone    = isset($input['phone_number']) ? qi_sanitize_string($input['phone_number'], 20) : null;

// Validasi
if (empty($fullName) || empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Nama lengkap, email, dan kata sandi wajib diisi.']);
    exit();
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Format email tidak valid.']);
    exit();
}
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi minimal 8 karakter.']);
    exit();
}
require_once __DIR__ . '/_password_publik.php';
if (qi_password_publik_berlaku() && qi_password_publik($password)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi ini diketahui publik. Pilih kata sandi lain.']);
    exit();
}

try {
    $pdo = qi_db();

    // Cek email sudah terdaftar?
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => strtolower($email)]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['status' => 'error', 'message' => 'Email sudah terdaftar. Silakan login.']);
        exit();
    }

    // Simpan user baru dengan password hash yang aman
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, phone_number, role, is_active)
                           VALUES (:name, :email, :hash, :phone, :role, 1)');
    $stmt->execute([
        ':name'  => $fullName,
        ':email' => strtolower($email),
        ':hash'  => $hash,
        ':phone' => $phone,
        ':role'  => 'pro'
    ]);
    $newUserId = (int)$pdo->lastInsertId();

    // FREE TRIAL OTOMATIS: Berikan 3-Day PRO Pass langsung saat akun dibuat
    $trialKey = 'QI-TRIAL-' . strtoupper(bin2hex(random_bytes(4)));
    // Kedaluwarsa dihitung MySQL (dibandingkan dengan NOW() MySQL); balikan: ISO dengan offset.
    $trialExpires = date('c', time() + 3 * 86400);
    try {
        $lStmt = $pdo->prepare('INSERT INTO license_keys (user_id, license_key, plan_name, expires_at, is_active, created_at)
                                VALUES (:uid, :key, "Quantum+ PRO (3-Day Trial)", DATE_ADD(NOW(), INTERVAL 3 DAY), 1, NOW())');
        $lStmt->execute([
            ':uid' => $newUserId,
            ':key' => $trialKey,
        ]);
        // Set user role to pro temporarily
        $uStmt = $pdo->prepare('UPDATE users SET role = "pro" WHERE id = :uid');
        $uStmt->execute([':uid' => $newUserId]);
    } catch (Exception $e) {
        error_log('[QI Register] Free trial auto-grant notice: ' . $e->getMessage());
    }

    http_response_code(201);
    echo json_encode([
        'status'  => 'success',
        'message' => 'Akun berhasil dibuat! Anda mendapatkan Free Trial 3 Hari Quantum+ PRO.',
        'data'    => [
            'email'        => strtolower($email),
            'role'         => 'pro',
            'trial_key'    => $trialKey,
            'trial_expires'=> $trialExpires
        ]
    ]);

} catch (PDOException $e) {
    error_log('[QI Register] DB error: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Layanan registrasi sedang tidak tersedia.']);
}
