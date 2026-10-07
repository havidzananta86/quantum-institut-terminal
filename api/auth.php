<?php
/**
 * Quantum Institut Market Terminal — Auth API Endpoint (SECURED)
 * 
 * Menangani:
 * 1. Validasi lisensi terhadap database
 * 2. Login email+password dengan password_verify()
 * 3. Rate limit: maks 5 percobaan per 15 menit per IP (anti brute force)
 * 4. Token session disimpan ke database
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

$input = qi_get_json_body();
$type = (is_array($input) && isset($input['type'])) ? qi_sanitize_string($input['type'], 20) : 'license';

// MODE 0: VERIFIKASI TOKEN (dipanggil auth.js verifyServerSession) — tidak kena limit brute force
if ($type === 'verify_token') {
    $user = qi_validate_token();
    if ($user) {
        echo json_encode(['status' => 'success', 'data' => [
            'email' => $user['email'], 'role' => $user['role'], 'expires_at' => $user['expires_at']
        ]]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Sesi tidak valid atau kadaluarsa.', 'code' => 'AUTH_REQUIRED']);
    }
    exit();
}

// Rate limit ketat untuk auth: 5 request per 15 menit (anti brute force)
qi_rate_limit(5, 900);

if (!$input) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
    exit();
}

// =============================================
// MODE 1: VALIDASI LISENSI
// =============================================
if ($type === 'license') {
    $licenseKey = isset($input['license_key']) ? qi_sanitize_string($input['license_key'], 50) : '';

    if (empty($licenseKey)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Kunci lisensi tidak boleh kosong.']);
        exit();
    }

    try {
        $pdo = qi_db();

        // Cari lisensi di database
        $stmt = $pdo->prepare('SELECT lk.*, u.id as user_id, u.email, u.role 
                               FROM license_keys lk 
                               JOIN users u ON u.id = lk.user_id 
                               WHERE lk.license_key = :key AND lk.is_active = 1 AND lk.expires_at > NOW()');
        $stmt->execute([':key' => strtoupper($licenseKey)]);
        $license = $stmt->fetch();

        if ($license) {
            // Lisensi valid — buat session
            $session = createSession($pdo, $license['user_id']);

            echo json_encode([
                'status' => 'success',
                'message' => 'Kunci Lisensi Terverifikasi.',
                'data' => [
                    'user_id' => (int)$license['user_id'],
                    'email' => $license['email'],
                    'plan' => $license['plan_name'] ?? 'Quantum+ PRO',
                    'expires_at' => $license['expires_at'],
                    'token' => $session['token'],
                    'token_expires' => $session['expires_at']
                ]
            ]);
        } else {
            // Delay 1-2 detik untuk anti brute force timing attack
            usleep(random_int(1000000, 2000000));
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Kunci lisensi tidak valid atau telah kadaluarsa.']);
        }

    } catch (PDOException $e) {
        error_log('[QI Auth] DB error: ' . $e->getMessage());
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Layanan autentikasi sedang tidak tersedia.']);
    }

// =============================================
// MODE 2: LOGIN EMAIL + PASSWORD
// =============================================
} else if ($type === 'email') {
    $email = isset($input['email']) ? qi_sanitize_string($input['email'], 100) : '';
    $password = isset($input['password']) ? $input['password'] : ''; // Jangan sanitize password (bisa rusak hash)

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Email dan kata sandi harus diisi.']);
        exit();
    }

    // Validasi format email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Format email tidak valid.']);
        exit();
    }

    try {
        $pdo = qi_db();

        // Cari user berdasarkan email
        $stmt = $pdo->prepare('SELECT id, email, password_hash, role, is_active FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => strtolower($email)]);
        $user = $stmt->fetch();

        if ($user && $user['is_active'] && password_verify($password, $user['password_hash'])) {
            // Login berhasil — buat session
            $session = createSession($pdo, $user['id']);

            echo json_encode([
                'status' => 'success',
                'message' => 'Login Berhasil.',
                'data' => [
                    'user_id' => (int)$user['id'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'token' => $session['token'],
                    'token_expires' => $session['expires_at']
                ]
            ]);
        } else {
            // Delay untuk anti timing attack (selalu delay, apapun hasilnya)
            usleep(random_int(1000000, 2000000));
            http_response_code(401);
            // Pesan generik — jangan kasih tahu apakah email atau password yang salah
            echo json_encode(['status' => 'error', 'message' => 'Email atau kata sandi tidak valid.']);
        }

    } catch (PDOException $e) {
        error_log('[QI Auth] DB error: ' . $e->getMessage());
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Layanan autentikasi sedang tidak tersedia.']);
    }

} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Tipe autentikasi tidak dikenal.']);
}
