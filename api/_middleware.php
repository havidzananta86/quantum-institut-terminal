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

// Dev mode. JANGAN disimpulkan dari input klien: pada Apache dengan
// UseCanonicalName Off (default), SERVER_NAME diambil dari header Host
// kiriman klien, sehingga "localhost" bisa dipalsukan dari internet.
// Fail closed — dianggap produksi kecuali terbukti berjalan lokal.
if (!defined('QI_DEV')) {
    $qiIsDev = false;
    if (PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server') {
        $qiIsDev = true;                                              // CLI/cron atau `php -S`
    } elseif (in_array($_SERVER['SERVER_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
        $qiIsDev = true;                                              // soket server memang loopback
    }
    define('QI_DEV', $qiIsDev);
    unset($qiIsDev);
}

// =============================================
// 1. CORS YANG KETAT — Hanya izinkan origin terpercaya
// =============================================
$allowedOrigins = [
    'https://quantum-institut.com',
    'https://www.quantum-institut.com',
    'https://quantum-institut-terminal.vercel.app',
    'https://quantum-institut.com',
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

header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-QI-Token');
header('Access-Control-Max-Age: 86400');

// Handle preflight OPTIONS. REQUEST_METHOD is absent under CLI (cron),
// where there is no preflight to answer.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
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
    $bucket = $maxRequests . '_' . $windowSeconds . '_' . basename($_SERVER['SCRIPT_NAME'] ?? '');
    $ipHash = md5($ip . '|' . $bucket);

    $rateLimitDir = __DIR__ . '/../cache/ratelimit';
    if (!is_dir($rateLimitDir)) {
        @mkdir($rateLimitDir, 0755, true);
    }

    // Cleanup stale files ~1% of requests (probabilistic, low overhead)
    if (mt_rand(1, 100) === 1) {
        qi_ratelimit_cleanup($rateLimitDir, $windowSeconds);
    }

    $rateLimitFile = $rateLimitDir . '/' . $ipHash . '.json';
    $data = ['count' => 0, 'window_start' => time()];

    // flock() untuk mencegah race condition pada concurrent requests
    $fp = @fopen($rateLimitFile, 'c+');
    if (!$fp) {
        return; // Gagal buka file, lewati rate limit daripada blokir request
    }
    flock($fp, LOCK_EX);

    $raw = stream_get_contents($fp);
    if ($raw) {
        $saved = json_decode($raw, true);
        if ($saved && isset($saved['window_start']) && isset($saved['count'])) {
            if (time() - $saved['window_start'] < $windowSeconds) {
                $data = $saved;
            }
        }
    }

    $data['count']++;

    // Tulis ulang dari awal file
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $remaining = max(0, $maxRequests - $data['count']);
    $resetTime = $data['window_start'] + $windowSeconds;

    header('X-RateLimit-Limit: ' . $maxRequests);
    header('X-RateLimit-Remaining: ' . $remaining);
    header('X-RateLimit-Reset: ' . $resetTime);

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

function qi_ratelimit_cleanup($dir, $maxAge = 3600) {
    $files = @glob($dir . '/*.json');
    if (!$files) return;
    $now = time();
    $cleaned = 0;
    foreach ($files as $f) {
        if ($now - filemtime($f) > $maxAge && $cleaned < 200) {
            @unlink($f);
            $cleaned++;
        }
    }
}

if (!function_exists('mb_substr')) {
    function mb_substr(string $string, int $start, ?int $length = null, ?string $encoding = null): string {
        return $length === null ? substr($string, $start) : substr($string, $start, $length);
    }
}
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $string, ?string $encoding = null): int {
        return strlen($string);
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
            // Login yang belum lolos 2FA: token belum berlaku (api/_keamanan.php, api/keamanan.php).
            if (!function_exists('qi_2fa_tertunda') && is_file(__DIR__ . '/_keamanan.php')) require_once __DIR__ . '/_keamanan.php';
            if (function_exists('qi_2fa_tertunda') && qi_2fa_tertunda($pdo, hash('sha256', $token))) { $GLOBALS['qi_2fa_tertunda'] = true; return null; }
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
    if (!$user && !empty($GLOBALS['qi_2fa_tertunda'])) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Masukkan kode verifikasi dua langkah untuk menyelesaikan login.', 'code' => '2FA_REQUIRED']);
        exit();
    }
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
 * Segarkan cache kalender bila sudah basi.
 *
 * Kenapa perlu: cache/calendar.json hanya diperbarui saat panel Kalender/News
 * dibuka pengguna. Ditemukan di produksi cache berumur 459 menit sehingga filter
 * berita TIDAK PERNAH aktif — fitur ada tetapi tidak bekerja. Fungsi ini memanggil
 * api/calendar.php (satu permintaan loopback ~0,5 detik) hanya bila cache lebih tua
 * dari $umurMaks, dan dibatasi sekali per 5 menit agar tidak menjadi badai permintaan.
 *
 * @return bool true bila cache segar saat fungsi selesai.
 */
function qi_berita_segarkan_kalender(int $umurMaks = 1200): bool
{
    $f = __DIR__ . '/../cache/calendar.json';
    if (is_file($f) && (time() - (int)@filemtime($f)) < $umurMaks) return true;

    // CLI/cron tidak punya HTTP_HOST → tidak bisa loopback; laporkan apa adanya.
    if (PHP_SAPI === 'cli' || empty($_SERVER['HTTP_HOST'])) return is_file($f);

    // Catatan: berkas ini adalah PENANDA WAKTU pembatas (bukan kunci), karena itu
    // namanya .txt — bukan .lock. Berkas .lock pada proyek ini berarti klaim eksklusif
    // yang harus dihapus setelah selesai; menamai penanda waktu dengan .lock membuat
    // pembaca berikutnya salah paham dan tampak seperti kunci yang bocor.
    $penanda = __DIR__ . '/../cache/calendar_refresh.txt';
    if (is_file($penanda) && (time() - (int)@filemtime($penanda)) < 300) return is_file($f);
    @file_put_contents($penanda, (string)time(), LOCK_EX);

    $protokol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    $folder   = dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/x.php'));
    $url      = rtrim($protokol . $_SERVER['HTTP_HOST'] . $folder, '/') . '/calendar.php';

    $ch = @curl_init($url);
    if ($ch === false) return is_file($f);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    @curl_exec($ch);
    curl_close($ch);
    clearstatcache(true, $f);
    return is_file($f) && (time() - (int)@filemtime($f)) < $umurMaks;
}

/**
 * Normalisasi simbol EA MT5 menjadi kunci simbol aplikasi.
 * Broker sering memakai akhiran (XAUUSD.a, EURUSD.pro) atau nama lain (GOLD).
 */
function qi_normalisasi_simbol_broker(string $simbol): string
{
    $s = strtoupper(trim($simbol));
    if ($s === '') return '';
    // Buang akhiran broker setelah titik / pagar (mis. XAUUSD.a → XAUUSD).
    $s = preg_replace('/[.#].*$/', '', $s);
    $s = preg_replace('/[^A-Z0-9]/', '', (string)$s);
    $alias = ['GOLD' => 'XAUUSD', 'SILVER' => 'XAGUSD', 'XAU' => 'XAUUSD'];
    return $alias[$s] ?? (string)$s;
}

/**
 * Baca TICK BROKER dari EA MT5 (ditulis api/mt-bridge.php tiap ~1 detik).
 *
 * ⚠️ Mengapa ini ada: sebelumnya tick broker diterima & disimpan, tetapi TIDAK ADA
 * satu pun berkas yang membacanya — sehingga harga dari EA tidak pernah dipakai
 * chart/sinyal. Fungsi ini menutup rantai tersebut.
 *
 * 🔒 KEAMANAN MULTI-PENGGUNA (penting): tick broker adalah data pribadi pemilik akun.
 * Karena itu fungsi ini WAJIB diberi $idPengguna dan hanya membaca berkas tick milik
 * akun-akun pengguna tersebut:
 *   · $idPengguna null/0  → SELALU null (tanpa token = tanpa harga broker).
 *   · Berkas tick pengguna lain TIDAK PERNAH dibaca, jadi harga broker seseorang
 *     tidak mungkin bocor ke pengguna lain.
 *
 * Fail-safe: hanya dipakai bila tick SEGAR (bawaan ≤ 20 detik). Bila EA mati, berkas
 * tidak ada, DB tidak siap, atau datanya rusak → kembalikan null supaya pemanggil
 * memakai sumber harga biasanya. Tidak pernah mengarang harga.
 *
 * @return array{price:float,bid:float,ask:float,spread:float,umur:int,sumber:string}|null
 */
function qi_broker_tick(string $simbol, int $umurMaks = 20, ?int $idPengguna = null): ?array
{
    if ($idPengguna === null || $idPengguna <= 0) return null;

    $kunci = qi_normalisasi_simbol_broker($simbol);
    if ($kunci === '') return null;

    $dir = __DIR__ . '/../cache/ticks';
    if (!is_dir($dir)) return null;

    // Hanya akun milik pengguna pemanggil.
    $pdo = qi_db(false);
    if (!$pdo) return null;
    try {
        $stmt = $pdo->prepare('SELECT id FROM trading_accounts WHERE user_id = :u');
        $stmt->execute([':u' => $idPengguna]);
        $idAkun = array_map('intval', array_column($stmt->fetchAll(), 'id'));
    } catch (Throwable $e) {
        return null;
    }
    if (!$idAkun) return null;

    foreach ($idAkun as $akun) {
        $f = $dir . '/' . $akun . '.json';
        if (!is_file($f)) continue;
        if ((time() - (int)@filemtime($f)) > $umurMaks) continue;
        $j = json_decode((string)@file_get_contents($f), true);
        if (!is_array($j) || empty($j['ticks']) || !is_array($j['ticks'])) continue;
        foreach ($j['ticks'] as $simbolBroker => $t) {
            if (!is_array($t)) continue;
            if (qi_normalisasi_simbol_broker((string)$simbolBroker) !== $kunci) continue;
            $bid = (float)($t['bid'] ?? 0);
            $ask = (float)($t['ask'] ?? 0);
            if ($bid <= 0 || $ask <= 0 || $ask < $bid) continue;
            $spread = (float)($t['spread'] ?? ($ask - $bid));
            return [
                'price'  => round(($bid + $ask) / 2, 6),
                'bid'    => round($bid, 6),
                'ask'    => round($ask, 6),
                'spread' => round($spread, 6),
                'umur'   => max(0, time() - (int)($j['updated'] ?? @filemtime($f))),
                'sumber' => 'mt5_broker',
            ];
        }
    }
    return null;
}

/**
 * Apakah event kalender ini LAYAK dipercaya?
 *
 * Dibuat setelah ditemukan bahwa api/calendar.php pernah membuat event CONTOH
 * ("Core CPI" 20 menit dari sekarang) berlabel source='ForexFactory'. Event palsu
 * seperti itu berbahaya di dua tempat: filter berita bisa menahan sinyal nyata,
 * dan pemantau sinyal berita bisa menerbitkan sinyal dari berita yang tidak ada.
 *
 * Penyaring ini dipakai KEDUA konsumen tersebut sebagai pertahanan berlapis.
 */
function qi_kalender_event_sah(array $e): bool
{
    $id = strtolower(trim((string)($e['id'] ?? '')));
    if ($id === '') return false;
    foreach (['evt_', 'uji_', 'contoh', 'sample', 'demo'] as $awalan) {
        if (strpos($id, $awalan) === 0) return false;
    }
    $sumber = strtolower(trim((string)($e['source'] ?? '')));
    foreach (['contoh', 'sample', 'demo', 'dummy', 'uji', 'test', 'placeholder'] as $tanda) {
        if ($sumber !== '' && strpos($sumber, $tanda) !== false) return false;
    }
    $judul = strtolower(trim((string)($e['title'] ?? '')));
    foreach (['uji ', 'contoh ', 'sample ', 'dummy ', 'test '] as $awalan) {
        if ($judul !== '' && strpos($judul, $awalan) === 0) return false;
    }
    return true;
}

/**
 * FILTER BERITA BERDAMPAK TINGGI (blackout ±N menit).
 *
 * Dipakai sebelum MENCATAT sinyal: saat ada event "high impact" (NFP, CPI, FOMC,
 * suku bunga) dalam rentang ±30 menit, sinyal ditahan. Alasannya praktis: pada
 * jendela itu spread melebar dan SL/TP mudah tersentuh oleh lonjakan sesaat,
 * sehingga hasil sinyal menjadi tidak mencerminkan kualitas mesin.
 *
 * Sumber data = cache/calendar.json yang SUDAH dipakai dashboard. Bila cache hilang
 * atau lebih tua dari 1 jam, filter DIMATIKAN dan alasannya dilaporkan apa adanya —
 * lebih baik jujur "filter tidak aktif" daripada memblokir sinyal karena data basi.
 *
 * @param bool $bolehSegarkan bila true, cache basi disegarkan lebih dulu
 *                           (dipakai jalur yang mencatat sinyal, bukan sekadar tampilan).
 * @return array{aktif:bool,event:?array,menit:?int,umur_cache:?int,catatan:string}
 */
function qi_berita_blackout(int $menit = 30, bool $bolehSegarkan = false): array
{
    $hasil = ['aktif' => false, 'event' => null, 'menit' => null, 'umur_cache' => null, 'catatan' => ''];
    $f = __DIR__ . '/../cache/calendar.json';

    if ($bolehSegarkan && function_exists('qi_berita_segarkan_kalender')) {
        qi_berita_segarkan_kalender();
    }

    if (!is_file($f)) {
        $hasil['catatan'] = 'Cache kalender belum ada — filter berita tidak aktif.';
        return $hasil;
    }
    clearstatcache(true, $f);
    $umur = time() - (int)@filemtime($f);
    $hasil['umur_cache'] = $umur;
    if ($umur > 3600) {
        $hasil['catatan'] = 'Cache kalender basi (' . (int)round($umur / 60) . ' menit) — filter berita tidak dipakai.';
        return $hasil;
    }
    $j = json_decode((string)@file_get_contents($f), true);
    $daftar = is_array($j) ? ($j['data'] ?? $j['events'] ?? []) : [];
    if (!is_array($daftar)) $daftar = [];

    $kini = time();
    $batas = max(1, $menit) * 60;
    $terdekat = null;
    $selisihTerdekat = PHP_INT_MAX;     // nilai absolut
    $selisihSigned   = 0;               // positif = belum terjadi, negatif = baru lewat
    foreach ($daftar as $e) {
        if (!is_array($e)) continue;
        if (strtolower((string)($e['impact'] ?? '')) !== 'high') continue;
        // Pertahanan berlapis: event contoh/uji TIDAK boleh menahan sinyal nyata.
        if (function_exists('qi_kalender_event_sah') && !qi_kalender_event_sah($e)) continue;
        $t = strtotime((string)($e['date'] ?? ''));
        if ($t === false) continue;
        $selisih = $t - $kini;
        $abs = abs($selisih);
        if ($abs <= $batas && $abs < $selisihTerdekat) {
            $terdekat = $e;
            $selisihTerdekat = $abs;
            $selisihSigned = $selisih;
        }
    }
    if ($terdekat) {
        $hasil['aktif'] = true;
        $hasil['menit'] = (int)round($selisihTerdekat / 60);
        $hasil['event'] = [
            'judul'     => (string)($terdekat['title'] ?? '-'),
            'mata_uang' => (string)($terdekat['currency'] ?? ($terdekat['country'] ?? '-')),
            'waktu'     => (string)($terdekat['date'] ?? '-'),
            'menit'     => $hasil['menit'],
            'arah'      => ($selisihSigned >= 0 ? 'akan datang' : 'baru lewat'),
        ];
        $hasil['catatan'] = 'Sinyal ditahan ±' . $menit . ' menit di sekitar berita berdampak tinggi ('
            . $hasil['event']['judul'] . ' · ' . $hasil['event']['mata_uang'] . ' · '
            . $hasil['event']['arah'] . ' ' . $hasil['menit'] . ' menit).';
    } else {
        $hasil['catatan'] = 'Tidak ada berita berdampak tinggi dalam ±' . $menit . ' menit.';
    }
    return $hasil;
}

/**
 * Tingkat akses peran: free(0) < pro(1) < vip(2) < admin(3).
 * Dipakai oleh qi_require_level() agar aturan paket konsisten dengan peta panel
 * di dashboard (QI_PANEL_MIN) — satu bahasa untuk seluruh aplikasi.
 */
function qi_tingkat_peran(?string $role): int {
    switch (strtolower(trim((string)$role))) {
        case 'admin':                          return 3;
        case 'vip': case 'vip_plus': case 'elite': return 2;
        case 'pro': case 'premium':            return 1;
        default:                               return 0;
    }
}

/**
 * Wajibkan TINGKAT akses minimum ('pro' atau 'vip').
 *
 * ⚠️ Sebelumnya qi_require_pro() MENOLAK pengguna VIP (hanya menerima 'pro' dan
 * 'admin'). Fungsi ini memperbaikinya: VIP otomatis punya semua hak PRO.
 *
 * Balasan selalu JSON yang rapi (401/403) supaya antarmuka bisa menampilkan pesan
 * yang benar — bukan galat mentah.
 */
function qi_require_level(string $minimal = 'pro') {
    $user = qi_require_auth();
    $minimal = (strtolower($minimal) === 'vip') ? 'vip' : 'pro';
    $butuh = ($minimal === 'vip') ? 2 : 1;
    if (qi_tingkat_peran($user['role'] ?? null) < $butuh) {
        http_response_code(403);
        echo json_encode([
            'status'  => 'error',
            'message' => ($minimal === 'vip')
                ? 'Fitur ini memerlukan paket Quantum VIP aktif.'
                : 'Fitur ini memerlukan lisensi Quantum+ PRO aktif.',
            'code'    => ($minimal === 'vip') ? 'VIP_REQUIRED' : 'PRO_REQUIRED',
            'tingkat' => $minimal,
        ]);
        exit();
    }
    return $user;
}

/**
 * Wajibkan role PRO — tolak request jika user bukan PRO.
 * (Dipertahankan untuk kompatibilitas; kini VIP juga diterima.)
 */
function qi_require_pro() {
    return qi_require_level('pro');
}

/**
 * Wajibkan role ADMIN — tolak request jika user bukan admin
 */
function qi_require_admin() {
    $user = qi_require_auth();
    if ($user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'Halaman ini khusus administrator.',
            'code' => 'ADMIN_REQUIRED'
        ]);
        exit();
    }
    return $user;
}

/**
 * Helper: buat session token dan simpan ke database (dipakai auth.php & login.php)
 */
/**
 * Jumlah sesi aktif maksimum per akun: QI_SESI_MAKS di config/api_keys.php (1–10).
 * Bawaan 1 = satu perangkat (anti berbagi akun): login baru mengakhiri sesi lain.
 * api/keamanan.php mengikuti aturan yang sama setelah kode 2FA benar.
 */
function qi_sesi_maks(): int
{
    if (!defined('QI_SESI_MAKS')) {
        $kunci = __DIR__ . '/../config/api_keys.php';
        if (is_file($kunci)) require_once $kunci;
    }
    return defined('QI_SESI_MAKS') ? max(1, min(10, (int)QI_SESI_MAKS)) : 1;
}

/**
 * Sisakan paling banyak $sisa sesi TERBARU milik pengguna; sesi $kecualiHash tidak disentuh.
 * $abaikanTertunda: sesi yang masih menunggu kode 2FA tidak dihitung dan tidak dihapus —
 * login yang belum terverifikasi tidak boleh mendorong keluar sesi pemilik akun.
 */
function qi_sesi_pangkas(PDO $pdo, int $uid, int $sisa, ?string $kecualiHash = null, bool $abaikanTertunda = false): void
{
    $syarat = 'user_id = ?';
    $param = [$uid];
    if ($kecualiHash !== null) { $syarat .= ' AND token <> ?'; $param[] = $kecualiHash; }
    if ($abaikanTertunda) $syarat .= ' AND token NOT IN (SELECT token_hash FROM session_2fa)';
    $sisa = max(0, $sisa);
    $pdo->prepare("DELETE FROM user_sessions WHERE $syarat
                   AND id NOT IN (SELECT id FROM (SELECT id FROM user_sessions WHERE $syarat ORDER BY created_at DESC, id DESC LIMIT $sisa) AS terbaru)")
        ->execute(array_merge($param, $param));
}

function createSession($pdo, $userId) {
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token); // Simpan hash, bukan token asli
    // Kedaluwarsa dihitung MySQL (DATE_ADD(NOW(), …)) karena dibandingkan dengan NOW() MySQL;
    // date() PHP memakai zona php.ini yang bisa berbeda. Nilai balikan: ISO dengan offset.
    $expiresAt = date('c', time() + 30 * 86400);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = qi_sanitize_string($_SERVER['HTTP_USER_AGENT'] ?? '', 500);

    // Hapus session lama yang sudah expired untuk user ini
    $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :uid AND expires_at < NOW()');
    $stmt->execute([':uid' => $userId]);

    // CONCURRENT LOGIN BLOCKER (Anti-Sharing Akun):
    // Login baru menyisakan paling banyak QI_SESI_MAKS - 1 sesi lama (bawaan: 0 → satu
    // perangkat), supaya lisensi VIP tidak bisa dipakai patungan/berbagi akun.
    // 2FA (api/_keamanan.php): bila aktif, sesi lama baru dipangkas SETELAH kode benar —
    // orang yang hanya tahu kata sandi tidak bisa mengeluarkan pemilik akun.
    if (!function_exists('qi_2fa_aktif') && is_file(__DIR__ . '/_keamanan.php')) require_once __DIR__ . '/_keamanan.php';
    $qiPakai2fa = function_exists('qi_2fa_aktif') && qi_2fa_aktif($pdo, (int)$userId);
    if (!$qiPakai2fa) {
        qi_sesi_pangkas($pdo, (int)$userId, qi_sesi_maks() - 1);
    }

    // Simpan sesi tunggal yang baru
    $stmt = $pdo->prepare('INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at, created_at) 
                           VALUES (:uid, :token, :ip, :ua, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())');
    $stmt->execute([
        ':uid' => $userId,
        ':token' => $tokenHash,
        ':ip' => $ip,
        ':ua' => $ua,
    ]);

    // Log login + tandai sesi TERTUNDA & kirim kode bila 2FA aktif.
    if (function_exists('qi_keamanan_setelah_login')) qi_keamanan_setelah_login($pdo, (int)$userId, $tokenHash, $qiPakai2fa);

    return ['token' => $token, 'expires_at' => $expiresAt];
}

// =============================================
// 4. STRUCTURED LOGGING + REQUEST ID (#121)
// =============================================
if (!defined('QI_REQUEST_ID')) {
    define('QI_REQUEST_ID', bin2hex(random_bytes(8)));
}

function qi_log(string $level, string $message, array $context = []): void {
    $logDir = __DIR__ . '/../cache/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $entry = json_encode([
        'time'       => gmdate('Y-m-d\TH:i:s\Z'),
        'request_id' => QI_REQUEST_ID,
        'level'      => $level,
        'endpoint'   => basename($_SERVER['SCRIPT_NAME'] ?? ''),
        'method'     => $_SERVER['REQUEST_METHOD'] ?? '',
        'ip'         => $_SERVER['REMOTE_ADDR'] ?? '',
        'message'    => $message,
        'context'    => $context ?: null,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    @file_put_contents(
        $logDir . '/app-' . date('Y-m-d') . '.jsonl',
        $entry . "\n",
        FILE_APPEND | LOCK_EX
    );
}

// Under CLI there is no response to attach headers to, and emitting one
// raises "headers already sent" noise in cron output.
if (PHP_SAPI !== 'cli') {
    header('X-Request-ID: ' . QI_REQUEST_ID);
}

// =============================================
// 6. HTTP & MARKET DATA HELPERS
// =============================================
if (!function_exists('qi_http_get')) {
    function qi_http_get(string $url, int $timeout = 5) {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => $timeout,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (QuantumTerminal)',
                CURLOPT_ENCODING       => '',
                CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
            ]);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            // Kode status terakhir disimpan agar pemanggil bisa membedakan 429 (kuota
            // habis, mis. Twelve Data) dari kegagalan jaringan biasa. Dipakai pemutus
            // sirkuit di api/get-chart-data.php.
            $GLOBALS['qi_last_http_code'] = (int)$code;
            return ($res && $code >= 200 && $code < 300) ? $res : false;
        }
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => $timeout, 'header' => "User-Agent: Mozilla/5.0\r\n"]]);
        $GLOBALS['qi_last_http_code'] = 0;
        return @file_get_contents($url, false, $ctx);
    }
}

// ── OANDA via TradingView bridge (tv-bridge/, @mathieuc/tradingview) ──────────
// Dipetakan ke OANDA: emas, BTC, dan semua forex. Kripto lain (ETH, SOL, …) tetap Binance.
// BTCUSDT diambil dari OANDA:BTCUSD (OANDA tidak punya pasangan USDT).
if (!function_exists('qi_tv_bridge_symbol')) {
    function qi_tv_bridge_symbol(string $symbol): ?string {
        static $map = [
            'XAUUSD' => 'XAUUSD', 'BTCUSDT' => 'BTCUSD',
            'EURUSD' => 'EURUSD', 'GBPUSD' => 'GBPUSD', 'USDJPY' => 'USDJPY', 'AUDUSD' => 'AUDUSD',
            'NZDUSD' => 'NZDUSD', 'USDCHF' => 'USDCHF', 'USDCAD' => 'USDCAD', 'GBPJPY' => 'GBPJPY',
            'EURJPY' => 'EURJPY', 'EURGBP' => 'EURGBP', 'AUDNZD' => 'AUDNZD', 'CHFJPY' => 'CHFJPY',
            'CADJPY' => 'CADJPY',
        ];
        return $map[strtoupper($symbol)] ?? null;
    }
}
// ── MT5 bridge (Windows VPS, paket MetaTrader5): feed broker untuk pengguna yang berhak ──────────
// Konfigurasi di config/api_keys.php: QI_MT5_BRIDGE_URL (wss://…), QI_MT5_BRIDGE_SECRET (≥32 karakter,
// sama dengan BRIDGE_JWT_SECRET di bridge), QI_MT5_BRIDGE_AUDIENCE ('pro' | 'owner'), QI_MT5_BRIDGE_ACCOUNT.
// Opsional: QI_MT5_BRIDGE_API_URL (https://…) bila alamat REST berbeda dari URL WebSocket.
if (!function_exists('qi_mt5_configured')) {
    function qi_mt5_configured(): bool {
        static $dimuat = false;
        if (!$dimuat) {
            $dimuat = true;
            $f = __DIR__ . '/../config/api_keys.php';
            if (!defined('QI_MT5_BRIDGE_URL') && is_file($f)) require_once $f;
        }
        return defined('QI_MT5_BRIDGE_URL') && (string)QI_MT5_BRIDGE_URL !== ''
            && defined('QI_MT5_BRIDGE_SECRET') && strlen((string)QI_MT5_BRIDGE_SECRET) >= 32;
    }
}
if (!function_exists('qi_mt5_allowed')) {
    /**
     * Boleh pemanggil ini memakai feed MT5? Aturan SAMA dengan api/mt5-bridge-token.php:
     *   admin → ya · audience 'pro' → PRO/VIP · audience 'owner' → pemilik akun bridge.
     * Pemanggil dikenali dari header Authorization (non-fatal: tanpa token = tidak berhak).
     */
    function qi_mt5_allowed(): bool {
        static $memo = null;
        if ($memo !== null) return $memo;
        $memo = false;
        if (!qi_mt5_configured()) return false;
        try { $u = qi_validate_token(); } catch (Throwable $e) { $u = null; }
        if (!is_array($u) || empty($u['user_id'])) return false;
        $level = qi_tingkat_peran($u['role'] ?? null);
        if ($level >= 3) return $memo = true;
        $audience = (defined('QI_MT5_BRIDGE_AUDIENCE') && QI_MT5_BRIDGE_AUDIENCE === 'pro') ? 'pro' : 'owner';
        if ($audience === 'pro') return $memo = ($level >= 1);
        $akun = defined('QI_MT5_BRIDGE_ACCOUNT') ? trim((string)QI_MT5_BRIDGE_ACCOUNT) : '';
        if ($akun === '') return false;
        try {
            $stmt = qi_db()->prepare("SELECT 1 FROM trading_accounts WHERE user_id = :u AND account_reference = :a AND LOWER(provider) LIKE 'mt%' AND connection_status IN ('pending','active') LIMIT 1");
            $stmt->execute([':u' => (int)$u['user_id'], ':a' => $akun]);
            return $memo = (bool)$stmt->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    }
}
if (!function_exists('qi_mt5_request')) {
    /**
     * GET ke REST bridge MT5 dengan JWT HS256 berumur 60 detik (scope ticks+candles).
     * Pemutus sirkuit 20 detik bila bridge tidak terjangkau.
     * @return string|false isi JSON, atau false bila gagal / bukan 2xx
     */
    function qi_mt5_request(string $path, int $timeout = 6) {
        if (!qi_mt5_configured()) return false;
        $penanda = __DIR__ . '/../cache/mt5_bridge_down.txt';
        if (is_file($penanda) && (time() - (int)@filemtime($penanda)) < 20) return false;

        $base = defined('QI_MT5_BRIDGE_API_URL') && (string)QI_MT5_BRIDGE_API_URL !== ''
            ? (string)QI_MT5_BRIDGE_API_URL
            : preg_replace('#^ws#i', 'http', (string)QI_MT5_BRIDGE_URL);
        $b64 = static fn(string $raw): string => rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
        $now = time();
        $input = $b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])) . '.' . $b64(json_encode([
            'iss' => 'qim', 'aud' => 'qim-mt5-bridge', 'sub' => 'server', 'scope' => 'ticks candles',
            'iat' => $now, 'nbf' => $now - 5, 'exp' => $now + 60, 'jti' => bin2hex(random_bytes(8)),
        ]));
        $jwt = $input . '.' . $b64(hash_hmac('sha256', $input, (string)QI_MT5_BRIDGE_SECRET, true));

        $ch = curl_init(rtrim($base, '/') . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_HTTPHEADER     => ['Accept: application/json', 'Authorization: Bearer ' . $jwt],
            CURLOPT_SSL_VERIFYPEER => !(defined('QI_DEV') && QI_DEV),
        ]);
        $raw = curl_exec($ch);
        $kode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false || $kode === 0 || $kode === 503 || $kode === 504) {
            @file_put_contents($penanda, (string)time(), LOCK_EX);
            return false;
        }
        if ($kode === 401) @error_log('[mt5-bridge] 401: QI_MT5_BRIDGE_SECRET tidak cocok dengan BRIDGE_JWT_SECRET.');
        @unlink($penanda);
        return ($kode >= 200 && $kode < 300) ? $raw : false;
    }
}
if (!function_exists('qi_mt5_candles')) {
    /** Candle feed broker MT5 (oldest-first) atau [] bila tidak tersedia → pemanggil fallback. */
    function qi_mt5_candles(string $symbol, string $interval, int $limit = 1000): array {
        $raw = qi_mt5_request('/api/candles?symbol=' . rawurlencode(strtoupper($symbol)) . '&tf=' . rawurlencode($interval) . '&count=' . $limit, 8);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        if (!is_array($d) || empty($d['candles']) || !is_array($d['candles'])) return [];
        $out = [];
        foreach ($d['candles'] as $c) {
            if (!isset($c['time'], $c['open'], $c['high'], $c['low'], $c['close'])) continue;
            $out[] = ['time' => (int)$c['time'], 'open' => (float)$c['open'], 'high' => (float)$c['high'],
                      'low' => (float)$c['low'], 'close' => (float)$c['close'], 'volume' => (float)($c['volume'] ?? 0)];
        }
        return count($out) >= 5 ? $out : [];
    }
}
if (!function_exists('qi_mt5_quotes')) {
    /** Harga feed broker MT5 dalam format live-price.php (price = Bid, seperti garis harga MT5). */
    function qi_mt5_quotes(array $symbols): array {
        $symbols = array_values(array_unique(array_map('strtoupper', array_map('strval', $symbols))));
        if (!$symbols) return [];
        $raw = qi_mt5_request('/api/quotes?symbols=' . rawurlencode(implode(',', $symbols)), 6);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        if (!is_array($d) || empty($d['ticks']) || !is_array($d['ticks'])) return [];
        $out = [];
        foreach ($d['ticks'] as $t) {
            $sym = strtoupper((string)($t['s'] ?? ''));
            $bid = (float)($t['bid'] ?? 0); $ask = (float)($t['ask'] ?? 0);
            if ($sym === '' || $bid <= 0 || $ask < $bid) continue;
            $day = is_array($t['day'] ?? null) ? $t['day'] : [];
            $prev = (float)($day['prev_close'] ?? 0);
            $age = (float)($t['age'] ?? 0);
            $out[$sym] = [
                'price'  => $bid, 'bid' => $bid, 'ask' => $ask, 'spread' => round($ask - $bid, 10),
                'open'   => (float)($day['open'] ?? $bid), 'high' => (float)($day['high'] ?? $bid), 'low' => (float)($day['low'] ?? $bid),
                'chgPct' => $prev > 0 ? round(($bid - $prev) / $prev * 100, 3) : 0,
                'vol'    => (float)($day['volume'] ?? 0),
                'source' => 'mt5_bridge',
                'market' => $age > 180 ? 'closed' : 'open',   // tick basi > 3 menit: pasar broker tutup / feed berhenti
                'tick_age' => (int)$age,
            ];
        }
        return $out;
    }
}

if (!function_exists('qi_tv_bridge_request')) {
    /**
     * Satu pintu ke tv-bridge (library TradingView-API, Node.js). Alamat & kunci dibaca dari
     * config/api_keys.php: QI_TV_BRIDGE_URL (default http://127.0.0.1:3001) dan QI_TV_BRIDGE_KEY.
     * Di shared hosting (tanpa Node) isi URL bridge yang berjalan di VPS/server lain.
     *
     * Pemutus sirkuit: bila bridge tidak terjangkau, panggilan dilewati 20 detik supaya setiap
     * request API tidak menunggu timeout; pemanggil langsung memakai sumber cadangan.
     * @return array{0: string|false, 1: int} [isi, kode HTTP]; isi = false bila gagal / bukan 2xx
     */
    function qi_tv_bridge_request(string $method, string $path, ?string $body = null, int $timeout = 10): array {
        static $konfigDimuat = false;
        if (!$konfigDimuat) {
            $konfigDimuat = true;
            $f = __DIR__ . '/../config/api_keys.php';
            if (!defined('QI_TV_BRIDGE_URL') && is_file($f)) require_once $f;
        }
        $penanda = __DIR__ . '/../cache/tv_bridge_down.txt';
        if (is_file($penanda) && (time() - (int)@filemtime($penanda)) < 20) return [false, 0];

        $base = rtrim(defined('QI_TV_BRIDGE_URL') ? (string)QI_TV_BRIDGE_URL : 'http://127.0.0.1:3001', '/');
        $header = ['Accept: application/json'];
        if (defined('QI_TV_BRIDGE_KEY') && (string)QI_TV_BRIDGE_KEY !== '') $header[] = 'X-Bridge-Key: ' . QI_TV_BRIDGE_KEY;
        $ch = curl_init($base . $path);
        $opsi = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_SSL_VERIFYPEER => !(defined('QI_DEV') && QI_DEV),
        ];
        if ($method === 'POST') {
            $header[] = 'Content-Type: application/json';
            $opsi[CURLOPT_POST] = true;
            $opsi[CURLOPT_POSTFIELDS] = (string)$body;
        }
        $opsi[CURLOPT_HTTPHEADER] = $header;
        curl_setopt_array($ch, $opsi);
        $raw  = curl_exec($ch);
        $kode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // Tidak terjangkau / timeout / gateway bermasalah → tandai mati sebentar.
        if ($raw === false || $kode === 0 || $kode === 503 || $kode === 504) {
            @file_put_contents($penanda, (string)time(), LOCK_EX);
            return [false, $kode];
        }
        if ($kode === 401) @error_log('[tv-bridge] 401: QI_TV_BRIDGE_KEY tidak cocok dengan BRIDGE_KEY di bridge.');
        @unlink($penanda);
        return [($kode >= 200 && $kode < 300) ? $raw : false, $kode];
    }
}
if (!function_exists('qi_tv_bridge_quotes')) {
    /**
     * Harga tick OANDA untuk banyak simbol sekaligus (satu panggilan ke tv-bridge /quotes).
     * Hasil memakai format live-price.php, dikunci dengan simbol INTERNAL (BTCUSDT, bukan BTCUSD).
     * Simbol yang tidak dipetakan / gagal diambil tidak ada di hasil → pemanggil fallback.
     */
    function qi_tv_bridge_quotes(array $symbols, int $timeout = 8): array {
        $peta = [];                                   // OANDA => simbol internal
        foreach ($symbols as $s) {
            $o = qi_tv_bridge_symbol((string)$s);
            if ($o !== null) $peta[$o] = strtoupper((string)$s);
        }
        if (!$peta) return [];
        [$raw] = qi_tv_bridge_request('GET', '/quotes?exchange=OANDA&symbols=' . implode(',', array_keys($peta)), null, $timeout);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        if (!is_array($d) || empty($d['ok']) || empty($d['quotes']) || !is_array($d['quotes'])) return [];
        $out = [];
        foreach ($d['quotes'] as $oanda => $q) {
            if (!isset($peta[$oanda]) || !is_array($q) || (float)($q['price'] ?? 0) <= 0) continue;
            $price = (float)$q['price'];
            $prev  = (float)($q['prevClose'] ?? 0);
            $row = [
                'price'  => $price,
                'open'   => (float)($q['open'] ?? $price),
                'high'   => (float)($q['high'] ?? $price),
                'low'    => (float)($q['low'] ?? $price),
                'chgPct' => isset($q['chgPct']) ? round((float)$q['chgPct'], 3)
                          : ($prev > 0 ? round(($price - $prev) / $prev * 100, 3) : 0),
                'vol'    => (float)($q['volume'] ?? 0),
                'source' => 'oanda_tv',
            ];
            // Status pasar dari TradingView: out_of_session = pasar tutup (akhir pekan / di luar jam).
            if (!empty($q['session'])) {
                $row['market'] = ($q['session'] === 'out_of_session') ? 'closed' : 'open';
                if (isset($q['age'])) $row['tick_age'] = (int)$q['age'];   // detik sejak tick terakhir
            }
            if (isset($q['bid'], $q['ask']) && (float)$q['bid'] > 0 && (float)$q['ask'] > 0) {
                $row['bid'] = (float)$q['bid']; $row['ask'] = (float)$q['ask'];
            }
            $out[$peta[$oanda]] = $row;
        }
        return $out;
    }
}
if (!function_exists('qi_tv_bridge_candles')) {
    /**
     * Candle OANDA (oldest-first) dari tv-bridge, atau [] bila bridge mati / simbol bukan
     * XAUUSD/BTCUSDT. Pemanggil harus fallback ke sumber lama saat hasilnya kosong.
     * $interval memakai kode internal: 1,5,15,30,60,240,D,W,MN.
     */
    function qi_tv_bridge_candles(string $symbol, string $interval, int $limit = 1000, int $timeout = 12): array {
        $oanda = qi_tv_bridge_symbol($symbol);
        if ($oanda === null) return [];
        $tfMap = ['1' => '1m', '5' => '5m', '15' => '15m', '30' => '30m', '60' => '1h', '240' => '4h', 'D' => '1D', 'W' => '1W', 'MN' => '1M'];
        if (!isset($tfMap[$interval])) return [];
        [$raw] = qi_tv_bridge_request('GET', '/candles?exchange=OANDA&symbol=' . $oanda . '&tf=' . $tfMap[$interval] . '&limit=' . $limit, null, $timeout);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        if (!is_array($d) || empty($d['ok']) || empty($d['candles']) || !is_array($d['candles'])) return [];
        $out = [];
        foreach ($d['candles'] as $c) {
            if (!isset($c['time'], $c['open'], $c['high'], $c['low'], $c['close'])) continue;
            $out[] = [
                'time'   => (int)$c['time'],
                'open'   => (float)$c['open'],
                'high'   => (float)$c['high'],
                'low'    => (float)$c['low'],
                'close'  => (float)$c['close'],
                'volume' => (float)($c['volume'] ?? 0),
            ];
        }
        return count($out) >= 5 ? $out : [];
    }
}

if (!function_exists('qi_tv_scan')) {
    /**
     * Scan data TradingView (format body scanner). Utama: library TradingView-API lewat
     * tv-bridge POST /scan (getScreener). Cadangan: scanner.tradingview.com langsung — dipakai
     * bila bridge mati atau TradingView menolak salah satu kolom.
     * @return array{0: string|false, 1: int, 2: string} [isi JSON, kode HTTP, 'bridge'|'scanner']
     */
    function qi_tv_scan(string $body, int $timeout = 12): array {
        $post = static function (string $url, int $to) use ($body): array {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
                CURLOPT_TIMEOUT => $to, CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_SSL_VERIFYPEER => (defined('QI_DEV') && QI_DEV) ? false : true,
            ]);
            $raw = curl_exec($ch);
            $kode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return [$raw, $kode];
        };
        [$raw, $kode] = qi_tv_bridge_request('POST', '/scan', $body, $timeout);
        if ($raw !== false && $kode === 200) {
            $j = json_decode((string)$raw, true);
            if (is_array($j) && !empty($j['data'])) return [$raw, $kode, 'bridge'];
        }
        [$raw, $kode] = $post('https://scanner.tradingview.com/global/scan', $timeout);
        return [$raw, $kode, 'scanner'];
    }
}

if (!function_exists('qi_tv_bridge_ta')) {
    /**
     * Rating teknikal TradingView (library TradingView-API via tv-bridge /ta) untuk banyak simbol.
     * Hasil: [simbol_internal => ['ticker'=>..., 'timeframes'=>['15'=>['all','ma','osc'], '60', '240', '1D']]]
     * dengan skala -1..1 (sama dengan scanner). Kosong bila bridge mati → pemanggil fallback.
     */
    function qi_tv_bridge_ta(array $symbols, int $timeout = 10): array {
        $symbols = array_values(array_unique(array_map('strtoupper', array_map('strval', $symbols))));
        if (!$symbols) return [];
        [$raw] = qi_tv_bridge_request('GET', '/ta?symbols=' . rawurlencode(implode(',', $symbols)), null, $timeout);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        return (is_array($d) && !empty($d['ok']) && is_array($d['ta'] ?? null)) ? $d['ta'] : [];
    }
}

if (!function_exists('qi_twelvedata_price')) {
    function qi_twelvedata_price(string $tdSym, string $cacheKey): array {
        $apiKey = defined('TWELVE_DATA_KEY') ? TWELVE_DATA_KEY : '';
        $cacheDir = __DIR__ . '/../cache/td';
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
        $cacheFile = $cacheDir . '/' . md5($cacheKey) . '.json';
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 15) {
            $c = json_decode(file_get_contents($cacheFile), true);
            if (!empty($c['price'])) { $c['source'] = 'twelvedata_cache'; return $c; }
        }
        if (!$apiKey) return [];
        // ⚠️ PERBAIKAN KINERJA PENTING (terukur): bila kuota Twelve Data habis/diblokir,
        // JANGAN memanggil API-nya lagi. Setiap percobaan gagal memakan ~392 ms,
        // sehingga 8 pasangan FX berurutan = ~3,1 detik sia-sia; endpoint
        // /api/live-price.php sampai 4,7 detik dan memicu timeout di peramban.
        //
        // CATATAN: pemeriksaan dilakukan dengan MEMBACA BERKAS PENANDA LANGSUNG,
        // bukan memanggil qi_td_quota_blocked(). Sebabnya berkas ini (_middleware.php)
        // tidak memuat fungsi tersebut (didefinisikan di live-price.php), sehingga
        // function_exists() selalu false dan penjaga tidak pernah aktif — inilah bug
        // yang membuat harganya lambat. Membaca berkas langsung aman dari bentrok nama
        // fungsi dan berlaku untuk SEMUA pemanggil Twelve Data.
        $qiTdQuotaFile = __DIR__ . '/../cache/td_quota.json';
        if (is_file($qiTdQuotaFile)) {
            $qiTdQ = json_decode((string)@file_get_contents($qiTdQuotaFile), true);
            if (is_array($qiTdQ) && (int)($qiTdQ['until'] ?? 0) > time()) return [];
        }
        $url = 'https://api.twelvedata.com/quote?symbol=' . urlencode($tdSym) . '&apikey=' . $apiKey;
        $raw = qi_http_get($url, 5);
        if (!$raw) return [];
        $d = json_decode($raw, true);
        // Kuota habis / kunci ditolak → tulis penanda supaya tidak diulang terus.
        if (isset($d['code']) && in_array((int)$d['code'], [429, 401, 403], true)) {
            @file_put_contents($qiTdQuotaFile, json_encode([
                'until' => time() + 3600, 'marked_at' => gmdate('c'), 'sebab' => 'kode ' . (int)$d['code'],
            ]), LOCK_EX);
            return [];
        }
        if (empty($d['close']) || isset($d['code'])) return [];
        $price = (float)$d['close'];
        $open  = (float)($d['open'] ?? $price);
        $high  = (float)($d['high'] ?? $price);
        $low   = (float)($d['low'] ?? $price);
        $chg   = (float)($d['percent_change'] ?? ($open > 0 ? round(($price - $open) / $open * 100, 3) : 0));
        $data  = ['price' => $price, 'open' => $open, 'high' => $high, 'low' => $low, 'chgPct' => $chg, 'vol' => 0, 'source' => 'twelvedata'];
        @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
        return $data;
    }
}
