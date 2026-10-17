<?php
/**
 * BATAS LOGIN — dihitung dari percobaan GAGAL dalam 15 menit terakhir (migrasi 023).
 *
 *   per akun + IP   : 5  gagal → akun itu dikunci dari IP itu
 *   per akun        : 20 gagal (dari IP mana pun) → akun dikunci sementara
 *   per IP          : 30 gagal (akun mana pun)   → IP dikunci (credential stuffing)
 *
 * Login berhasil tidak menghabiskan jatah, jadi pengguna di satu jaringan (kantor, kos,
 * warnet) tidak saling mengunci. Bila tabel belum dimigrasi, perilaku lama dipakai:
 * qi_rate_limit(5, 900) per IP — tidak pernah lebih longgar dari sebelumnya.
 *
 * Dipakai api/auth.php dan api/login.php.
 */

if (!function_exists('qi_login_cek')):

define('QI_LOGIN_JENDELA', 900);
define('QI_LOGIN_MAKS_AKUN_IP', 5);
define('QI_LOGIN_MAKS_AKUN', 20);
define('QI_LOGIN_MAKS_IP', 30);

/** Kunci subjek: 'email:<email kecil>' | 'license:<KUNCI>' | 'google'. Disimpan sebagai hash. */
function qi_login_subjek(string $jenis, string $nilai = ''): string
{
    $nilai = $jenis === 'license' ? strtoupper(trim($nilai)) : strtolower(trim($nilai));
    return hash('sha256', $jenis . ':' . $nilai);
}

function qi_login_ip(): string
{
    return mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
}

function qi_login_tabel_ada(PDO $pdo): bool
{
    static $ada = null;
    if ($ada !== null) return $ada;
    try { $pdo->query('SELECT 1 FROM login_attempts LIMIT 1'); return $ada = true; }
    catch (Throwable $e) { return $ada = false; }
}

/**
 * Hentikan permintaan dengan 429 bila subjek/IP sedang terkunci. Tanpa tabel → batas lama.
 * @return void (exit bila terkunci)
 */
function qi_login_cek(PDO $pdo, string $subjek): void
{
    if (!qi_login_tabel_ada($pdo)) { qi_rate_limit(5, QI_LOGIN_JENDELA); return; }
    $ip = qi_login_ip();
    $j = (int)QI_LOGIN_JENDELA;
    $st = $pdo->prepare("SELECT
            SUM(subject_hash = :s1 AND ip = :ip1)             AS akun_ip,
            SUM(subject_hash = :s2)                            AS akun,
            SUM(ip = :ip2)                                     AS per_ip,
            MIN(CASE WHEN subject_hash = :s3 AND ip = :ip3 THEN UNIX_TIMESTAMP(created_at) END) AS awal_akun_ip,
            MIN(CASE WHEN subject_hash = :s4 THEN UNIX_TIMESTAMP(created_at) END)               AS awal_akun,
            MIN(CASE WHEN ip = :ip4 THEN UNIX_TIMESTAMP(created_at) END)                        AS awal_ip
        FROM login_attempts
        WHERE success = 0 AND created_at > NOW() - INTERVAL $j SECOND AND (subject_hash = :s5 OR ip = :ip5)");
    $st->execute([':s1' => $subjek, ':ip1' => $ip, ':s2' => $subjek, ':ip2' => $ip, ':s3' => $subjek, ':ip3' => $ip,
                  ':s4' => $subjek, ':ip4' => $ip, ':s5' => $subjek, ':ip5' => $ip]);
    $r = $st->fetch(PDO::FETCH_ASSOC) ?: [];
    $sekarang = (int)$pdo->query('SELECT UNIX_TIMESTAMP()')->fetchColumn();

    $kunci = null;
    if ((int)($r['akun_ip'] ?? 0) >= QI_LOGIN_MAKS_AKUN_IP) $kunci = (int)$r['awal_akun_ip'];
    elseif ((int)($r['akun'] ?? 0) >= QI_LOGIN_MAKS_AKUN)   $kunci = (int)$r['awal_akun'];
    elseif ((int)($r['per_ip'] ?? 0) >= QI_LOGIN_MAKS_IP)   $kunci = (int)$r['awal_ip'];
    if ($kunci === null) return;

    $tunggu = max(1, $kunci + $j - $sekarang);
    http_response_code(429);
    header('Retry-After: ' . $tunggu);
    echo json_encode(['status' => 'error', 'code' => 'LOGIN_LIMIT', 'retry_after' => $tunggu,
        'message' => 'Terlalu banyak percobaan login yang gagal. Coba lagi dalam ' . max(1, (int)ceil($tunggu / 60)) . ' menit.']);
    exit();
}

/** Catat hasil percobaan. Berhasil → kegagalan akun+IP ini dihapus (jatahnya pulih). */
function qi_login_catat(PDO $pdo, string $subjek, bool $berhasil): void
{
    if (!qi_login_tabel_ada($pdo)) return;
    try {
        $ip = qi_login_ip();
        $pdo->prepare('INSERT INTO login_attempts (subject_hash, ip, success) VALUES (?, ?, ?)')->execute([$subjek, $ip, $berhasil ? 1 : 0]);
        if ($berhasil) $pdo->prepare('DELETE FROM login_attempts WHERE subject_hash = ? AND ip = ? AND success = 0')->execute([$subjek, $ip]);
        if (random_int(1, 50) === 1) $pdo->exec('DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL 1 DAY');
    } catch (Throwable $e) { /* pencatatan tidak boleh menggagalkan login */ }
}

endif;
