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

    // Akun baru SELALU lahir di paket Gratis (role 'user').
    //
    // MENGAPA DITULIS TEGAS: sebelumnya baris ini menyisipkan role 'pro' lalu mencoba membuat
    // lisensi "3-Day Trial". Pernyataan lisensi itu menyebut kolom `created_at` yang TIDAK ADA di
    // tabel license_keys (database/schema.sql hanya punya `activated_at`) dan plan_name di luar
    // ENUM('1 Bulan','3 Bulan','6 Bulan','12 Bulan') — jadi INSERT-nya SELALU gagal, ditelan
    // catch di bawahnya, dan pendaftar tertinggal sebagai 'pro' TANPA baris lisensi. Penurunan
    // role di api/maintenance-cron.php sengaja tidak menyentuh akun tanpa lisensi, sehingga setiap
    // pendaftar memegang PRO gratis selamanya. Halaman publik pun tidak pernah menjanjikan trial:
    // register.html menawarkan "akun gratis", dan pricing.html menjual PRO berbayar.
    // Lisensi PRO hanya lahir dari pembayaran terverifikasi (api/payment.php).
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, phone_number, role, is_active)
                           VALUES (:name, :email, :hash, :phone, :role, 1)');
    $stmt->execute([
        ':name'  => $fullName,
        ':email' => strtolower($email),
        ':hash'  => $hash,
        ':phone' => $phone,
        ':role'  => 'user'
    ]);

    http_response_code(201);
    echo json_encode([
        'status'  => 'success',
        'message' => 'Akun gratis berhasil dibuat. Silakan masuk untuk membuka terminal.',
        'data'    => [
            'email' => strtolower($email),
            'role'  => 'user'
        ]
    ]);

} catch (PDOException $e) {
    error_log('[QI Register] DB error: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Layanan registrasi sedang tidak tersedia.']);
}
