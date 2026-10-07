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

// Rate limit ketat untuk auth: 5 request per 15 menit (anti brute force)
qi_rate_limit(5, 900);

$input = qi_get_json_body();
if (!$input) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
    exit();
}

$type = isset($input['type']) ? qi_sanitize_string($input['type'], 20) : 'license';

/**
 * Helper: buat session token dan simpan ke database
 */
function createSession($pdo, $userId) {
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token); // Simpan hash, bukan token asli
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = qi_sanitize_string($_SERVER['HTTP_USER_AGENT'] ?? '', 500);

    // Hapus session lama yang sudah expired untuk user ini
    $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :uid AND expires_at < NOW()');
    $stmt->execute([':uid' => $userId]);

    // Batasi max 5 sesi aktif per user (keamanan multi-device)
    $stmt = $pdo->prepare('SELECT COUNT(*) as cnt FROM user_sessions WHERE user_id = :uid AND expires_at > NOW()');
    $stmt->execute([':uid' => $userId]);
    $count = $stmt->fetch()['cnt'] ?? 0;
    if ($count >= 5) {
        // Hapus sesi tertua
        $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :uid ORDER BY created_at ASC LIMIT 1');
        $stmt->execute([':uid' => $userId]);
    }

    // Simpan sesi baru
    $stmt = $pdo->prepare('INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at, created_at) 
                           VALUES (:uid, :token, :ip, :ua, :exp, NOW())');
    $stmt->execute([
        ':uid' => $userId,
        ':token' => $tokenHash,
        ':ip' => $ip,
        ':ua' => $ua,
        ':exp' => $expiresAt
    ]);

    return ['token' => $token, 'expires_at' => $expiresAt];
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
        require_once __DIR__ . '/../config/database.php';
        $pdo = getDBConnection();

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
        require_once __DIR__ . '/../config/database.php';
        $pdo = getDBConnection();

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
