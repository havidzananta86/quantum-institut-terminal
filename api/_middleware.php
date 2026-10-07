<?php
/**
 * Quantum Institut — API Rate Limiting & Security Middleware
 * 
 * Include file ini di awal setiap endpoint API untuk:
 * 1. Rate limiting berbasis IP (file-based, tanpa Redis/DB)
 * 2. CORS yang ketat (bukan wildcard *)
 * 3. Sanitasi input dasar
 * 
 * Cara pakai: require_once __DIR__ . '/_middleware.php';
 */

// =============================================
// 1. CORS YANG KETAT — Hanya izinkan origin terpercaya
// =============================================
$allowedOrigins = [
    'https://quantum-institut-terminal.vercel.app',
    'https://quantuminstitut.market',
    'http://localhost',
    'http://localhost:3000',
    'http://127.0.0.1',
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Cek apakah origin termasuk yang diizinkan
$originAllowed = false;
// Exact match — prefix match akan meloloskan 'http://localhost.evil.com'
$originAllowed = in_array($origin, $allowedOrigins, true);

if ($originAllowed && $origin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} else {
    // Untuk request tanpa Origin header (misalnya dari server sendiri)
    // JANGAN set Access-Control-Allow-Origin agar browser blokir cross-origin
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-QI-Token');
header('Access-Control-Max-Age: 86400');

// Handle preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// =============================================
// 2. RATE LIMITING BERBASIS IP (FILE-BASED)
// =============================================
// Konfigurasi: max request per window (dalam detik)
// Default: 60 request per 60 detik per IP
function qi_rate_limit($maxRequests = 60, $windowSeconds = 60) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // Bucket terpisah per konfigurasi limit + endpoint, supaya limit global (60/60)
    // dan limit ketat (mis. 5/900) tidak saling menimpa/reset file yang sama
    $bucket = $maxRequests . '_' . $windowSeconds . '_' . basename($_SERVER['SCRIPT_NAME'] ?? '');
    $ipHash = md5($ip . '|' . $bucket); // Hash IP untuk nama file yang aman

    $rateLimitDir = __DIR__ . '/../cache/ratelimit';
    if (!is_dir($rateLimitDir)) {
        @mkdir($rateLimitDir, 0755, true);
    }

    $rateLimitFile = $rateLimitDir . '/' . $ipHash . '.json';

    $data = ['count' => 0, 'window_start' => time()];

    if (file_exists($rateLimitFile)) {
        $raw = @file_get_contents($rateLimitFile);
        $saved = json_decode($raw, true);
        if ($saved && isset($saved['window_start']) && isset($saved['count'])) {
            // Cek apakah masih dalam window yang sama
            if (time() - $saved['window_start'] < $windowSeconds) {
                $data = $saved;
            }
            // Kalau window sudah lewat, reset otomatis (data tetap default)
        }
    }

    $data['count']++;

    // Simpan state
    @file_put_contents($rateLimitFile, json_encode($data), LOCK_EX);

    // Hitung sisa
    $remaining = max(0, $maxRequests - $data['count']);
    $resetTime = $data['window_start'] + $windowSeconds;

    // Set header rate limit (standar IETF draft)
    header('X-RateLimit-Limit: ' . $maxRequests);
    header('X-RateLimit-Remaining: ' . $remaining);
    header('X-RateLimit-Reset: ' . $resetTime);

    // Blokir jika melebihi batas
    if ($data['count'] > $maxRequests) {
        http_response_code(429);
        header('Retry-After: ' . ($resetTime - time()));
        echo json_encode([
            'status' => 'error',
            'message' => 'Terlalu banyak request. Silakan tunggu ' . ($resetTime - time()) . ' detik.',
            'retry_after' => $resetTime - time()
        ]);
        exit();
    }
}

// =============================================
// 3. HELPER: SANITASI INPUT
// =============================================

/**
 * Sanitasi string — hapus tag HTML dan trim whitespace
 */
function qi_sanitize_string($input, $maxLength = 255) {
    if (!is_string($input)) return '';
    $clean = trim(strip_tags($input));
    return mb_substr($clean, 0, $maxLength);
}

/**
 * Validasi dan sanitasi JSON body dari POST request
 * Mengembalikan array atau null jika invalid
 */
function qi_get_json_body() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return null;
    
    // Batas ukuran body: 64KB (cegah DoS via payload besar)
    if (strlen($raw) > 65536) {
        http_response_code(413);
        echo json_encode(['status' => 'error', 'message' => 'Payload terlalu besar (maks 64KB)']);
        exit();
    }

    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }
    return $data;
}

/**
 * Ambil koneksi database dengan aman.
 * Jika config/database.php belum dibuat, kembalikan JSON 503 yang rapi
 * (bukan fatal error yang membocorkan path server).
 *
 * @param bool $fatal  true = langsung kirim 503 & exit; false = kembalikan null
 * @return PDO|null
 */
function qi_db($fatal = true) {
    $configPath = __DIR__ . '/../config/database.php';
    if (!file_exists($configPath)) {
        error_log('[QI] config/database.php belum dibuat. Salin dari config/database.php.example');
        if ($fatal) {
            http_response_code(503);
            echo json_encode([
                'status'  => 'error',
                'message' => 'Database belum dikonfigurasi. Hubungi administrator.',
                'code'    => 'DB_NOT_CONFIGURED'
            ]);
            exit();
        }
        return null;
    }
    require_once $configPath;
    if (!function_exists('getDBConnection')) {
        if ($fatal) {
            http_response_code(503);
            echo json_encode(['status' => 'error', 'message' => 'Konfigurasi database tidak valid.', 'code' => 'DB_CONFIG_INVALID']);
            exit();
        }
        return null;
    }
    return getDBConnection();
}

/**
 * Validasi token autentikasi dari header Authorization atau X-QI-Token
 * Mengembalikan data user atau null jika token tidak valid
 */
function qi_validate_token() {
    $token = null;

    // Coba ambil dari header Authorization: Bearer xxx.
    // Apache kadang menaruhnya di REDIRECT_HTTP_AUTHORIZATION (via RewriteRule),
    // atau hanya terlihat lewat apache_request_headers() — cek ketiganya.
    $authHeader = $_SERVER['HTTP_AUTHORIZATION']
               ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
               ?? '';
    if (!$authHeader && function_exists('apache_request_headers')) {
        $hdrs = apache_request_headers();
        foreach ($hdrs as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $authHeader = $v; break; }
        }
    }
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    }

    // Fallback: header custom X-QI-Token
    if (!$token && isset($_SERVER['HTTP_X_QI_TOKEN'])) {
        $token = $_SERVER['HTTP_X_QI_TOKEN'];
    }

    if (!$token) return null;

    // Validasi token ke database (non-fatal: kalau DB belum siap, anggap token invalid)
    try {
        $pdo = qi_db(false);
        if (!$pdo) return null;

        $stmt = $pdo->prepare('SELECT u.id, u.email, u.role, s.expires_at
                               FROM user_sessions s 
                               JOIN users u ON u.id = s.user_id 
                               WHERE s.token = :token AND s.expires_at > NOW()');
        $stmt->execute([':token' => hash('sha256', $token)]);
        $user = $stmt->fetch();

        if ($user) {
            return [
                'user_id' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'expires_at' => $user['expires_at']
            ];
        }
    } catch (Exception $e) {
        // Database belum tersedia, fallback ke mode tanpa auth
        // (untuk development / migrasi bertahap)
        error_log('[QI Middleware] Token validation error: ' . $e->getMessage());
    }

    return null;
}

/**
 * Wajibkan autentikasi — tolak request jika tidak ada token valid
 */
function qi_require_auth() {
    $user = qi_validate_token();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
            'code' => 'AUTH_REQUIRED'
        ]);
        exit();
    }
    return $user;
}

/**
 * Wajibkan role PRO — tolak request jika user bukan PRO
 */
function qi_require_pro() {
    $user = qi_require_auth();
    if ($user['role'] !== 'pro' && $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'Fitur ini memerlukan lisensi Quantum+ PRO aktif.',
            'code' => 'PRO_REQUIRED'
        ]);
        exit();
    }
    return $user;
}

/**
 * Helper: buat session token dan simpan ke database (dipakai auth.php & login.php)
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
// 4. TERAPKAN RATE LIMIT OTOMATIS
// =============================================
// Setiap endpoint yang include file ini otomatis dibatasi
qi_rate_limit(60, 60); // 60 request per menit per IP
