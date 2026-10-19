<?php
declare(strict_types=1);
/**
 * Quantum Institut — atur ulang kata sandi satu akun (CLI saja).
 *
 * Dipakai bila akun terkunci karena memakai kata sandi demo publik (api/_password_publik.php),
 * atau admin lupa kata sandinya. Situs tidak punya alur "lupa kata sandi" untuk admin.
 *
 *   php database/ganti-password.php admin@contoh.com
 *   (kata sandi baru diketik lalu Enter; tidak ditampilkan di layar bila terminal mendukung)
 *
 * Semua sesi login akun itu dicabut sesudah kata sandi diganti.
 * Tanpa akses SSH: buat hash dengan  php -r "echo password_hash('KATA_SANDI_BARU', PASSWORD_DEFAULT);"
 * lalu tempel ke kolom users.password_hash lewat phpMyAdmin.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/_password_publik.php';

$email = strtolower(trim((string)($argv[1] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Pakai: php database/ganti-password.php <email>\n");
    exit(2);
}

$sembunyi = DIRECTORY_SEPARATOR === '/' && function_exists('shell_exec') && trim((string)@shell_exec('tty 2>/dev/null')) !== '';
fwrite(STDOUT, "Kata sandi baru untuk $email: ");
if ($sembunyi) @shell_exec('stty -echo');
$baru = rtrim((string)fgets(STDIN), "\r\n");
if ($sembunyi) { @shell_exec('stty echo'); fwrite(STDOUT, "\n"); }

if (strlen($baru) < 12) { fwrite(STDERR, "Ditolak: minimal 12 karakter untuk akun ini.\n"); exit(1); }
if (qi_password_publik($baru)) { fwrite(STDERR, "Ditolak: kata sandi itu diketahui publik.\n"); exit(1); }

try {
    $pdo = getDBConnection();
    $st = $pdo->prepare('SELECT id, role FROM users WHERE email = :e LIMIT 1');
    $st->execute([':e' => $email]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    if (!$u) { fwrite(STDERR, "Akun $email tidak ditemukan.\n"); exit(1); }

    $pdo->prepare('UPDATE users SET password_hash = :h WHERE id = :id')
        ->execute([':h' => password_hash($baru, PASSWORD_DEFAULT), ':id' => (int)$u['id']]);
    $d = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :id');
    $d->execute([':id' => (int)$u['id']]);
    fwrite(STDOUT, "OK: kata sandi $email ({$u['role']}) diganti, " . $d->rowCount() . " sesi dicabut.\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Gagal: ' . $e->getMessage() . "\n");
    exit(1);
}
