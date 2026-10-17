<?php
/**
 * KEAMANAN AKUN — api/_keamanan.php untuk logika 2FA & log.
 *
 * Untuk sesi yang SUDAH lolos 2FA (login biasa):
 *   GET                         → sesi saat ini, riwayat login & aktivitas, status 2FA
 *   POST {aksi:'keluar_semua'}  → akhiri sesi di semua perangkat
 *   POST {aksi:'2fa_mulai'}     → kirim kode penyiapan ke email (butuh SMTP)
 *   POST {aksi:'2fa_aktifkan', kode} → aktifkan + kembalikan 10 kode cadangan (SEKALI tampil)
 *   POST {aksi:'2fa_matikan', password | kode}  (kode = kode cadangan)
 * Untuk sesi yang MENUNGGU 2FA (baru login):
 *   GET  ?aksi=status_login     → {perlu_2fa:true|false, email_tersamar, terkirim}
 *   POST {aksi:'verifikasi_login', kode}  → kode email ATAU kode cadangan
 *   POST {aksi:'kirim_ulang'}             → kirim ulang kode (jeda 60 detik)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_keamanan.php';
require_once __DIR__ . '/_mailer.php';
qi_rate_limit(20, 60);
$pdo = qi_db();

function qi_keam_jawab(array $d, int $kode = 200): void { http_response_code($kode); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function qi_keam_token_hash(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('apache_request_headers')) foreach (apache_request_headers() as $k => $v) if (strcasecmp($k, 'Authorization') === 0) $h = $v;
    if (preg_match('/^Bearer\s+(.+)$/i', $h, $m)) return hash('sha256', trim($m[1]));
    return null;
}
function qi_keam_samarkan(string $email): string
{
    [$a, $d] = array_pad(explode('@', $email, 2), 2, '');
    return mb_substr($a, 0, 2) . str_repeat('•', max(1, mb_strlen($a) - 2)) . '@' . $d;
}

if (!qi_keam_ada($pdo)) qi_keam_jawab(['status' => 'error', 'code' => 'MIGRASI_BELUM', 'message' => 'Jalankan database/migrations/020_account_security.sql.'], 503);
$metode = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$in = $metode === 'POST' ? (qi_get_json_body() ?: []) : [];
$aksi = (string)($_GET['aksi'] ?? $in['aksi'] ?? '');

// ── Jalur sesi yang MENUNGGU 2FA (token belum diterima qi_validate_token) ──────────────
if (in_array($aksi, ['status_login', 'verifikasi_login', 'kirim_ulang'], true)) {
    $th = qi_keam_token_hash();
    if (!$th) qi_keam_jawab(['status' => 'error', 'message' => 'Token diperlukan.'], 401);
    $st = $pdo->prepare('SELECT p.*, UNIX_TIMESTAMP(p.expires_at) AS exp_ts, UNIX_TIMESTAMP(p.sent_at) AS sent_ts, u.email FROM session_2fa p JOIN users u ON u.id = p.user_id JOIN user_sessions s ON s.token = p.token_hash WHERE p.token_hash = ?');
    $st->execute([$th]);
    $p = $st->fetch(PDO::FETCH_ASSOC);

    if ($aksi === 'status_login') {
        if (!$p) {
            $ada = $pdo->prepare('SELECT 1 FROM user_sessions WHERE token = ? AND expires_at > NOW()');
            $ada->execute([$th]);
            qi_keam_jawab(['status' => 'success', 'perlu_2fa' => false, 'sesi_sah' => (bool)$ada->fetchColumn()]);
        }
        qi_keam_jawab(['status' => 'success', 'perlu_2fa' => true, 'email' => qi_keam_samarkan((string)$p['email']),
                       'smtp' => qi_mail_setelan()['terkonfigurasi'], 'berlaku_sampai' => gmdate('c', (int)$p['exp_ts'])]);
    }
    if (!$p) qi_keam_jawab(['status' => 'error', 'message' => 'Tidak ada login yang menunggu verifikasi.'], 400);
    $uid = (int)$p['user_id'];

    if ($aksi === 'kirim_ulang') {
        if ($p['sent_ts'] && time() - (int)$p['sent_ts'] < 60) qi_keam_jawab(['status' => 'error', 'message' => 'Tunggu 60 detik sebelum meminta kode baru.'], 429);
        $kode = qi_2fa_kode();
        $pdo->prepare('UPDATE session_2fa SET code_hash = ?, expires_at = DATE_ADD(NOW(), INTERVAL ' . QI_2FA_MENIT . ' MINUTE), attempts = 0, sent_at = NOW() WHERE token_hash = ?')
            ->execute([password_hash($kode, PASSWORD_DEFAULT), $th]);
        $ok = qi_2fa_kirim_kode($pdo, $uid, $kode);
        qi_keam_jawab($ok ? ['status' => 'success', 'message' => 'Kode baru dikirim ke email.'] : ['status' => 'error', 'message' => 'Email tidak dapat dikirim. Gunakan kode cadangan.'], $ok ? 200 : 502);
    }

    // verifikasi_login
    $kode = trim((string)($in['kode'] ?? ''));
    $hapusSesi = static function () use ($pdo, $th) {
        $pdo->prepare('DELETE FROM user_sessions WHERE token = ?')->execute([$th]);
        $pdo->prepare('DELETE FROM session_2fa WHERE token_hash = ?')->execute([$th]);
    };
    if ((int)$p['attempts'] >= QI_2FA_MAKS_COBA) { $hapusSesi(); qi_audit($pdo, $uid, '2fa_gagal', 'terlalu banyak percobaan — sesi dibatalkan'); qi_keam_jawab(['status' => 'error', 'message' => 'Terlalu banyak percobaan. Silakan login ulang.'], 429); }
    $pdo->prepare('UPDATE session_2fa SET attempts = attempts + 1 WHERE token_hash = ?')->execute([$th]);
    $cocok = false; $lewat = '';
    if (preg_match('/^\d{6}$/', $kode)) {
        if ((int)$p['exp_ts'] < time()) qi_keam_jawab(['status' => 'error', 'message' => 'Kode sudah kedaluwarsa. Minta kode baru.'], 400);
        $cocok = password_verify($kode, $p['code_hash']); $lewat = 'kode email';
    } else {
        $pdo->beginTransaction();
        $cocok = qi_2fa_pakai_cadangan($pdo, $uid, $kode); $lewat = 'kode cadangan';
        $pdo->commit();
    }
    if (!$cocok) {
        qi_audit($pdo, $uid, '2fa_gagal', 'kode salah');
        qi_keam_jawab(['status' => 'error', 'message' => 'Kode salah. Sisa percobaan: ' . max(0, QI_2FA_MAKS_COBA - (int)$p['attempts'] - 1)], 400);
    }
    $pdo->prepare('DELETE FROM session_2fa WHERE token_hash = ?')->execute([$th]);
    // Batas sesi per akun (QI_SESI_MAKS, qi_sesi_maks() di _middleware.php) baru ditegakkan
    // sekarang — bukan saat kata sandi saja benar.
    if (qi_keam_satu_sesi()) {
        $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ? AND token <> ?')->execute([$uid, $th]);
        $pdo->prepare('DELETE FROM session_2fa WHERE user_id = ?')->execute([$uid]);
    } elseif (function_exists('qi_sesi_pangkas')) {
        // Banyak perangkat: sisakan sesi terverifikasi terbaru; login lain yang masih menunggu
        // kode tidak dihitung dan tidak dihapus.
        qi_sesi_pangkas($pdo, $uid, qi_sesi_maks() - 1, $th, true);
    }
    qi_audit($pdo, $uid, 'login', 'lolos 2FA (' . $lewat . ')');
    qi_keam_jawab(['status' => 'success', 'message' => 'Verifikasi berhasil.']);
}

// ── Jalur sesi biasa ─────────────────────────────────────────────────────────────────────
$pengguna = qi_require_auth();
$uid = (int)$pengguna['user_id'];
$th = qi_keam_token_hash();

if ($metode === 'GET') {
    // Waktu sebagai epoch dari MySQL sendiri: zona waktu MySQL dan PHP bisa berbeda, jadi
    // jangan mem-parse DATETIME naif dengan strtotime() di PHP.
    $iso = static fn($ts) => $ts !== null ? gmdate('c', (int)$ts) : null;
    $sesi = $pdo->prepare('SELECT ip_address, user_agent, UNIX_TIMESTAMP(created_at) AS masuk_ts, UNIX_TIMESTAMP(expires_at) AS habis_ts FROM user_sessions WHERE token = ?');
    $sesi->execute([(string)$th]);
    $se = $sesi->fetch(PDO::FETCH_ASSOC) ?: null;
    $sec = $pdo->prepare('SELECT twofa_email, UNIX_TIMESTAMP(twofa_enabled_at) AS sejak_ts, backup_codes FROM user_security WHERE user_id = ?');
    $sec->execute([$uid]);
    $s = $sec->fetch(PDO::FETCH_ASSOC) ?: [];
    $log = $pdo->prepare('SELECT event, ip, user_agent, detail, UNIX_TIMESTAMP(created_at) AS ts FROM security_events WHERE user_id = ? ORDER BY id DESC LIMIT 40');
    $log->execute([$uid]);
    qi_keam_jawab([
        'status' => 'success',
        'sesi'   => $se ? ['ip_address' => $se['ip_address'], 'user_agent' => $se['user_agent'], 'masuk' => $iso($se['masuk_ts']), 'berakhir' => $iso($se['habis_ts'])] : null,
        'satu_sesi' => qi_keam_satu_sesi(),
        'sesi_maks' => function_exists('qi_sesi_maks') ? qi_sesi_maks() : 1,
        'sesi_aktif' => (static function () use ($pdo, $uid) {
            $n = $pdo->prepare('SELECT COUNT(*) FROM user_sessions WHERE user_id = ? AND expires_at > NOW()');
            $n->execute([$uid]);
            return (int)$n->fetchColumn();
        })(),
        // Perangkat lain yang masih login (menggantikan api/session-log.php). Token tidak pernah dikirim.
        'sesi_lain' => (static function () use ($pdo, $uid, $th, $iso) {
            $st = $pdo->prepare('SELECT s.ip_address, s.user_agent, UNIX_TIMESTAMP(s.created_at) AS masuk_ts, (p.token_hash IS NOT NULL) AS tertunda
                                 FROM user_sessions s LEFT JOIN session_2fa p ON p.token_hash = s.token
                                 WHERE s.user_id = ? AND s.token <> ? AND s.expires_at > NOW() ORDER BY s.created_at DESC LIMIT 20');
            $st->execute([$uid, (string)$th]);
            return array_map(static fn($r) => ['ip_address' => $r['ip_address'], 'user_agent' => $r['user_agent'], 'masuk' => $iso($r['masuk_ts']),
                                               'menunggu_2fa' => (bool)$r['tertunda']], $st->fetchAll(PDO::FETCH_ASSOC));
        })(),
        'twofa'  => ['aktif' => !empty($s['twofa_email']), 'sejak' => !empty($s['twofa_email']) ? $iso($s['sejak_ts'] ?? null) : null,
                     'sisa_cadangan' => count((array)json_decode((string)($s['backup_codes'] ?? '[]'), true)), 'smtp' => qi_mail_setelan()['terkonfigurasi']],
        'log'    => array_map(static fn($r) => ['event' => $r['event'], 'ip' => $r['ip'], 'user_agent' => $r['user_agent'], 'detail' => $r['detail'], 'waktu' => $iso($r['ts'])], $log->fetchAll(PDO::FETCH_ASSOC)),
    ]);
}

if ($aksi === 'keluar_semua') {
    $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$uid]);
    qi_audit($pdo, $uid, 'keluar_semua', 'semua sesi diakhiri');
    qi_keam_jawab(['status' => 'success']);
}

if ($aksi === '2fa_mulai') {
    if (!qi_mail_setelan()['terkonfigurasi']) qi_keam_jawab(['status' => 'error', 'code' => 'SMTP_BELUM', 'message' => 'Email server (SMTP) belum diatur — 2FA lewat email belum bisa diaktifkan.'], 503);
    $kode = qi_2fa_kode();
    $pdo->prepare('INSERT INTO user_security (user_id, setup_code_hash, setup_expires_at, setup_attempts) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ' . QI_2FA_MENIT . ' MINUTE), 0)
                   ON DUPLICATE KEY UPDATE setup_code_hash = VALUES(setup_code_hash), setup_expires_at = VALUES(setup_expires_at), setup_attempts = 0')
        ->execute([$uid, password_hash($kode, PASSWORD_DEFAULT)]);
    if (!qi_2fa_kirim_kode($pdo, $uid, $kode, 'setup')) qi_keam_jawab(['status' => 'error', 'message' => 'Email kode tidak dapat dikirim.'], 502);
    qi_keam_jawab(['status' => 'success', 'message' => 'Kode dikirim ke ' . qi_keam_samarkan((string)$pengguna['email']) . '.']);
}

if ($aksi === '2fa_aktifkan') {
    $st = $pdo->prepare('SELECT setup_code_hash, UNIX_TIMESTAMP(setup_expires_at) AS setup_exp_ts, setup_attempts FROM user_security WHERE user_id = ?');
    $st->execute([$uid]);
    $s = $st->fetch(PDO::FETCH_ASSOC);
    if (!$s || !$s['setup_code_hash'] || (int)$s['setup_exp_ts'] < time()) qi_keam_jawab(['status' => 'error', 'message' => 'Minta kode penyiapan dulu (atau kode sudah kedaluwarsa).'], 400);
    if ((int)$s['setup_attempts'] >= QI_2FA_MAKS_COBA) qi_keam_jawab(['status' => 'error', 'message' => 'Terlalu banyak percobaan. Minta kode baru.'], 429);
    $pdo->prepare('UPDATE user_security SET setup_attempts = setup_attempts + 1 WHERE user_id = ?')->execute([$uid]);
    if (!password_verify(trim((string)($in['kode'] ?? '')), $s['setup_code_hash'])) qi_keam_jawab(['status' => 'error', 'message' => 'Kode salah.'], 400);
    [$cadangan, $hash] = qi_2fa_kode_cadangan();
    $pdo->prepare('UPDATE user_security SET twofa_email = 1, twofa_enabled_at = NOW(), backup_codes = ?, setup_code_hash = NULL, setup_expires_at = NULL WHERE user_id = ?')->execute([$hash, $uid]);
    qi_audit($pdo, $uid, '2fa_aktif');
    qi_keam_jawab(['status' => 'success', 'kode_cadangan' => $cadangan, 'message' => 'Verifikasi dua langkah aktif. Simpan kode cadangan — hanya ditampilkan sekali.']);
}

if ($aksi === '2fa_matikan') {
    // Kata sandi ATAU satu kode cadangan (akun Google tidak punya kata sandi yang diketahui pemiliknya).
    $st = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $st->execute([$uid]);
    $sah = ($in['password'] ?? '') !== '' && password_verify((string)$in['password'], (string)$st->fetchColumn());
    if (!$sah && trim((string)($in['kode'] ?? '')) !== '') {
        $pdo->beginTransaction();
        $sah = qi_2fa_pakai_cadangan($pdo, $uid, (string)$in['kode']);
        $pdo->commit();
    }
    if (!$sah) { qi_audit($pdo, $uid, '2fa_matikan_gagal', 'kata sandi / kode cadangan salah'); qi_keam_jawab(['status' => 'error', 'message' => 'Kata sandi atau kode cadangan salah.'], 400); }
    $pdo->prepare('UPDATE user_security SET twofa_email = 0, backup_codes = NULL WHERE user_id = ?')->execute([$uid]);
    qi_audit($pdo, $uid, '2fa_nonaktif');
    qi_keam_jawab(['status' => 'success']);
}

qi_keam_jawab(['status' => 'error', 'message' => 'Aksi tidak dikenal.'], 400);
