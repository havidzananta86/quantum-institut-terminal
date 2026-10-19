<?php
/**
 * PASSWORD PUBLIK — kata sandi yang tercantum di repositori (database/seed.sql untuk akun
 * demo lokal). Repositori ini publik, jadi kata sandi itu diketahui siapa saja. Bila seed
 * pernah diimpor ke server produksi, akun admin/vip/pro demo bisa dimasuki orang lain.
 *
 * Perlindungan (hanya di produksi; di lokal/CLI seed tetap bisa dipakai untuk pengembangan):
 *   1. Login dengan kata sandi publik DITOLAK (api/auth.php, api/login.php) walau benar,
 *      dicatat sebagai percobaan gagal, dan admin diberi tahu lewat Telegram (≤ 1×/6 jam).
 *   2. Kata sandi publik tidak bisa dipakai saat daftar atau ganti kata sandi.
 *   3. Cron harian (api/maintenance-cron.php) memeriksa akun admin/vip/pro: yang masih
 *      memakai kata sandi publik dilaporkan, dan sesi login aktifnya dicabut.
 *
 * Kata sandinya sendiri TIDAK ditulis di sini — hanya sidik SHA-256-nya.
 * Cara memulihkan akun yang terkunci: database/ganti-password.php (CLI) atau phpMyAdmin.
 */
declare(strict_types=1);

if (!function_exists('qi_password_publik')) :

/** Sidik SHA-256 kata sandi yang diketahui publik (seed demo). Tambahkan bila ada yang lain. */
function qi_password_publik_sidik(): array
{
    return [
        'ed9b79fdb28510c6bdc65d152447b6e6237c017f9c2037d98ea4347b893c3efc',   // database/seed.sql (akun demo)
    ];
}

function qi_password_publik(string $password): bool
{
    return in_array(hash('sha256', $password), qi_password_publik_sidik(), true);
}

/**
 * Apakah perlindungan berlaku (= server produksi)?
 *   · define('QI_PRODUKSI', true|false) di config/api_keys.php selalu menang;
 *   · permintaan web: produksi kecuali QI_DEV (api/_middleware.php, fail closed);
 *   · CLI (cron Hostinger): QI_DEV selalu true untuk CLI, jadi dipakai tebakan — Linux dan
 *     bukan CI = produksi. Pengembangan lokal proyek ini memakai XAMPP Windows.
 */
function qi_password_publik_berlaku(): bool
{
    if (defined('QI_PRODUKSI')) return (bool)QI_PRODUKSI;
    if (PHP_SAPI === 'cli') return PHP_OS_FAMILY === 'Linux' && (string)getenv('CI') === '';
    return !(defined('QI_DEV') && QI_DEV);
}

/** Beri tahu admin lewat Telegram, paling sering sekali per 6 jam per alasan. */
function qi_password_publik_alarm(string $teks, string $kunci = 'login'): void
{
    $penanda = __DIR__ . '/../cache/password_publik_' . preg_replace('/[^a-z0-9_]/', '', $kunci) . '.txt';
    if (is_file($penanda) && (time() - (int)@filemtime($penanda)) < 21600) return;
    @file_put_contents($penanda, (string)time(), LOCK_EX);
    try {
        if (!function_exists('qi_telegram_kirim')) require_once __DIR__ . '/_telegram.php';
        qi_telegram_kirim($teks);
    } catch (Throwable $e) {
        @error_log('[password-publik] alarm gagal: ' . $e->getMessage());
    }
}

/**
 * Dipanggil SETELAH password_verify berhasil. Di produksi, bila kata sandinya publik:
 * catat sebagai gagal, beri tahu admin, jawab 403, dan hentikan permintaan.
 */
function qi_password_publik_tolak_login(PDO $pdo, string $subjek, array $user, string $password): void
{
    if (!qi_password_publik_berlaku() || !qi_password_publik($password)) return;
    if (function_exists('qi_login_catat')) qi_login_catat($pdo, $subjek, false);
    @error_log('[password-publik] login ditolak untuk user_id ' . (int)($user['id'] ?? 0));
    qi_password_publik_alarm("🔐 Quantum Institut: login ke akun " . (string)($user['email'] ?? '?')
        . " (" . (string)($user['role'] ?? '?') . ") DITOLAK karena memakai kata sandi demo yang tercantum di repositori publik.\n"
        . "Ganti kata sandinya sekarang: php database/ganti-password.php <email> atau lewat phpMyAdmin.");
    usleep(random_int(1000000, 2000000));
    http_response_code(403);
    echo json_encode([
        'status'  => 'error',
        'code'    => 'PASSWORD_PUBLIK',
        'message' => 'Kata sandi akun ini adalah kata sandi demo yang diketahui publik dan tidak boleh dipakai di server ini. '
                   . 'Hubungi administrator untuk mengatur ulang kata sandi.',
    ]);
    exit();
}

/**
 * Periksa akun berhak tinggi yang masih memakai kata sandi publik; cabut sesinya bila $cabut.
 * @return array{diperiksa:int, terdampak:array, sesi_dicabut:int}
 */
function qi_password_publik_audit(PDO $pdo, bool $cabut = true, int $batas = 300): array
{
    $hasil = ['diperiksa' => 0, 'terdampak' => [], 'sesi_dicabut' => 0];
    $st = $pdo->prepare("SELECT id, email, role, password_hash FROM users WHERE role IN ('admin','vip','pro') AND password_hash IS NOT NULL AND password_hash <> '' ORDER BY id LIMIT " . max(1, $batas));
    $st->execute();
    $kandidat = [];
    // Hanya hash yang bisa jadi milik kata sandi publik: plaintext-nya tidak disimpan, jadi
    // diuji lewat password_verify terhadap setiap kata sandi publik yang dikenal (lihat seed).
    $daftarUji = qi_password_publik_uji();
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $hasil['diperiksa']++;
        foreach ($daftarUji as $pw) {
            if (password_verify($pw, (string)$u['password_hash'])) { $kandidat[] = $u; break; }
        }
    }
    foreach ($kandidat as $u) {
        $hasil['terdampak'][] = ['id' => (int)$u['id'], 'email' => (string)$u['email'], 'role' => (string)$u['role']];
        if ($cabut) {
            $d = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :u');
            $d->execute([':u' => (int)$u['id']]);
            $hasil['sesi_dicabut'] += $d->rowCount();
        }
    }
    return $hasil;
}

/**
 * Kata sandi publik untuk audit hash — dibaca dari database/seed.sql (sumber yang memang
 * memuatnya), lalu dicocokkan dengan sidik di atas. Bila seed tidak ada di server, audit
 * memakai daftar kosong (tidak pernah mengarang).
 */
function qi_password_publik_uji(): array
{
    $f = __DIR__ . '/../database/seed.sql';
    if (!is_file($f)) return [];
    preg_match_all('/password(?: demo[^:]*)?:\s*([^\s)]+)/i', (string)@file_get_contents($f), $m);
    return array_values(array_unique(array_filter($m[1] ?? [], 'qi_password_publik')));
}

endif;
