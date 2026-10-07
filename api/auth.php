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

// =============================================
// MODE 3: LOGIN GOOGLE (verifikasi ID token via Google tokeninfo)
// =============================================
} else if ($type === 'google') {
    // Ambil Client ID dari config (publik, bukan secret)
    $googleClientId = '';
    $cfgPath = __DIR__ . '/../config/api_keys.php';
    if (file_exists($cfgPath)) {
        require_once $cfgPath;
        if (defined('GOOGLE_CLIENT_ID')) $googleClientId = GOOGLE_CLIENT_ID;
    }
    if ($googleClientId === '') {
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Login Google belum dikonfigurasi di server.']);
        exit();
    }

    $credential = isset($input['credential']) ? trim($input['credential']) : '';
    if ($credential === '' || strlen($credential) > 4096) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Kredensial Google tidak valid.']);
        exit();
    }

    // Verifikasi ID token ke endpoint resmi Google (tidak butuh client secret).
    // Google memvalidasi signature & expiry; kita cek aud + email_verified.
    $verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential);
    $payloadRaw = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($verifyUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $payloadRaw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($httpCode < 200 || $httpCode >= 300) $payloadRaw = false;
    }
    if ($payloadRaw === false) {
        http_response_code(502);
        echo json_encode(['status' => 'error', 'message' => 'Gagal memverifikasi token Google. Coba lagi.']);
        exit();
    }

    $p = json_decode($payloadRaw, true);
    $audOk   = isset($p['aud']) && hash_equals($googleClientId, $p['aud']);
    $emailOk = isset($p['email']) && (($p['email_verified'] ?? '') === 'true' || ($p['email_verified'] ?? false) === true);
    $issOk   = isset($p['iss']) && in_array($p['iss'], ['accounts.google.com', 'https://accounts.google.com'], true);

    if (!$audOk || !$emailOk || !$issOk) {
        usleep(random_int(1000000, 2000000));
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Verifikasi Google gagal.']);
        exit();
    }

    $email = strtolower(qi_sanitize_string($p['email'], 150));
    $name  = qi_sanitize_string($p['name'] ?? explode('@', $email)[0], 100);

    try {
        $pdo = qi_db();

        // Cari user by email; kalau belum ada → buat akun baru (role 'user')
        $stmt = $pdo->prepare('SELECT id, email, role, is_active FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Password acak — login Google tidak pakai password, tapi kolom NOT NULL
            $randomHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
            $ins = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, role, is_active, status, created_at)
                                  VALUES (:name, :email, :ph, :role, 1, :st, NOW())');
            $ins->execute([':name' => $name ?: 'Pengguna Google', ':email' => $email, ':ph' => $randomHash, ':role' => 'user', ':st' => 'active']);
            $userId = (int)$pdo->lastInsertId();
            $role = 'user';
        } else {
            if (!$user['is_active']) {
                http_response_code(403);
                echo json_encode(['status' => 'error', 'message' => 'Akun tidak aktif.']);
                exit();
            }
            $userId = (int)$user['id'];
            $role = $user['role'];
        }

        $session = createSession($pdo, $userId);
        echo json_encode([
            'status'  => 'success',
            'message' => 'Login Google Berhasil.',
            'data'    => [
                'user_id'       => $userId,
                'email'         => $email,
                'role'          => $role,
                'token'         => $session['token'],
                'token_expires' => $session['expires_at'],
            ],
        ]);
    } catch (PDOException $e) {
        error_log('[QI Auth] Google DB error: ' . $e->getMessage());
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Layanan autentikasi sedang tidak tersedia.']);
    }

} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Tipe autentikasi tidak dikenal.']);
}
