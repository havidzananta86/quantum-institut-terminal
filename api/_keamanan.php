<?php
/**
 * KEAMANAN AKUN — 2FA via OTP email (+ kode cadangan) dan log aktivitas (migrasi 020).
 *
 * Dipanggil dari createSession() dan qi_validate_token() di api/_middleware.php, sehingga SEMUA
 * jalur login (email, Google, lisensi, daftar) ikut 2FA tanpa diubah satu per satu:
 *   · createSession() → qi_keamanan_setelah_login(): catat login; bila 2FA aktif, sesi baru
 *     ditandai TERTUNDA dan kode 6 digit dikirim ke email akun.
 *   · qi_validate_token() → qi_2fa_tertunda(): token sesi tertunda ditolak sampai kode benar
 *     (api/keamanan.php aksi verifikasi_login).
 * Semua fungsi tahan terhadap tabel yang belum dimigrasi (2FA dianggap nonaktif).
 */

if (!function_exists('qi_audit')):

define('QI_2FA_MENIT', 10);
define('QI_2FA_MAKS_COBA', 5);

function qi_keam_ada(PDO $pdo): bool
{
    static $ada = null;
    if ($ada !== null) return $ada;
    try { $pdo->query('SELECT 1 FROM session_2fa LIMIT 1'); return $ada = true; } catch (PDOException $e) { return $ada = false; }
}

function qi_audit(PDO $pdo, int $uid, string $event, string $detail = ''): void
{
    if (!qi_keam_ada($pdo)) return;
    try {
        $pdo->prepare('INSERT INTO security_events (user_id, event, ip, user_agent, detail) VALUES (?, ?, ?, ?, ?)')
            ->execute([$uid, mb_substr($event, 0, 40), mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
                       mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200), mb_substr($detail, 0, 255)]);
    } catch (Throwable $e) { /* log keamanan tidak boleh menggagalkan permintaan */ }
}

function qi_2fa_aktif(PDO $pdo, int $uid): bool
{
    if (!qi_keam_ada($pdo)) return false;
    try { $st = $pdo->prepare('SELECT twofa_email FROM user_security WHERE user_id = ?'); $st->execute([$uid]); return (int)$st->fetchColumn() === 1; }
    catch (Throwable $e) { return false; }
}

/** Satu sesi per akun? Mengikuti QI_SESI_MAKS (qi_sesi_maks() di api/_middleware.php). */
function qi_keam_satu_sesi(): bool { return function_exists('qi_sesi_maks') ? qi_sesi_maks() === 1 : (defined('QI_SATU_SESI') && QI_SATU_SESI); }

function qi_2fa_kode(): string { return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT); }

/** Kirim kode login ke email akun. @return bool terkirim */
function qi_2fa_kirim_kode(PDO $pdo, int $uid, string $kode, string $tujuan = 'masuk'): bool
{
    if (!function_exists('qi_mail_kirim')) require_once __DIR__ . '/_mailer.php';
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([$uid]);
    $email = (string)$st->fetchColumn();
    if ($email === '' || !qi_mail_setelan()['terkonfigurasi']) return false;
    $tpl = qi_mail_templat_otp($kode, QI_2FA_MENIT);
    $tpl['subjek'] = ($tujuan === 'setup' ? 'Aktifkan verifikasi dua langkah: ' : 'Kode masuk Quantum Institut: ') . $kode;
    $h = qi_mail_kirim([$email], $tpl['subjek'], $tpl['html'], $tpl['teks']);
    return (bool)($h['per_penerima'][strtolower($email)]['ok'] ?? false);
}

/** Dipanggil createSession() setelah sesi baru disimpan. */
function qi_keamanan_setelah_login(PDO $pdo, int $uid, string $tokenHash, bool $pakai2fa): void
{
    if (!qi_keam_ada($pdo)) return;
    if (!$pakai2fa) { qi_audit($pdo, $uid, 'login'); return; }
    try {
        $kode = qi_2fa_kode();
        $pdo->prepare('INSERT INTO session_2fa (token_hash, user_id, code_hash, expires_at, sent_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ' . QI_2FA_MENIT . ' MINUTE), NOW())
                       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0, sent_at = NOW()')
            ->execute([$tokenHash, $uid, password_hash($kode, PASSWORD_DEFAULT)]);
        $terkirim = qi_2fa_kirim_kode($pdo, $uid, $kode);
        qi_audit($pdo, $uid, 'login_2fa_tertunda', $terkirim ? 'kode dikirim ke email' : 'email gagal — gunakan kode cadangan');
        if (!$terkirim && defined('QI_DEV') && QI_DEV) qi_log('debug', '2FA kode (khusus dev, SMTP tidak tersedia)', ['user' => $uid, 'kode' => $kode]);
    } catch (Throwable $e) {
        @error_log('[2fa] gagal menyiapkan: ' . $e->getMessage());
    }
}

/** Apakah sesi dengan hash token ini masih menunggu verifikasi 2FA? */
function qi_2fa_tertunda(PDO $pdo, string $tokenHash): bool
{
    if (!qi_keam_ada($pdo)) return false;
    try { $st = $pdo->prepare('SELECT 1 FROM session_2fa WHERE token_hash = ?'); $st->execute([$tokenHash]); return (bool)$st->fetchColumn(); }
    catch (Throwable $e) { return false; }
}

/** 10 kode cadangan sekali pakai. @return array{0:string[],1:string} [teks biasa, JSON hash] */
function qi_2fa_kode_cadangan(): array
{
    $abjad = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $polos = [];
    for ($i = 0; $i < 10; $i++) {
        $k = '';
        for ($j = 0; $j < 8; $j++) $k .= $abjad[random_int(0, strlen($abjad) - 1)];
        $polos[] = substr($k, 0, 4) . '-' . substr($k, 4);
    }
    return [$polos, json_encode(array_map(static fn($k) => password_hash($k, PASSWORD_DEFAULT), $polos))];
}

/** Cocokkan & habiskan satu kode cadangan. */
function qi_2fa_pakai_cadangan(PDO $pdo, int $uid, string $kode): bool
{
    $kode = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $kode));
    if (strlen($kode) !== 8) return false;
    $kode = substr($kode, 0, 4) . '-' . substr($kode, 4);
    $st = $pdo->prepare('SELECT backup_codes FROM user_security WHERE user_id = ? FOR UPDATE');
    $st->execute([$uid]);
    $daftar = json_decode((string)$st->fetchColumn(), true);
    if (!is_array($daftar)) return false;
    foreach ($daftar as $i => $h) {
        if (password_verify($kode, $h)) {
            unset($daftar[$i]);
            $pdo->prepare('UPDATE user_security SET backup_codes = ? WHERE user_id = ?')->execute([json_encode(array_values($daftar)), $uid]);
            return true;
        }
    }
    return false;
}

endif;
