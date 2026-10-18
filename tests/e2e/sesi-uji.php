<?php
/**
 * Sesi login sementara untuk uji e2e (tests/e2e/klik.test.mjs). HANYA CLI, HANYA database lokal.
 *   php tests/e2e/sesi-uji.php buat <peran>   → cetak token (admin | user)
 *   php tests/e2e/sesi-uji.php hapus          → hapus semua sesi uji
 * Sesi ditandai user_agent 'qim-e2e' dan kedaluwarsa sendiri setelah 1 jam.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../api/_middleware.php';

$cfg = __DIR__ . '/../../config/database.php';
if (!defined('DB_HOST') && is_file($cfg)) require_once $cfg;
$host = strtolower((string)(defined('DB_HOST') ? DB_HOST : ''));
if (!in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Menolak: database bukan lokal.\n");
    exit(2);
}

$pdo = qi_db(false);
if (!$pdo) { fwrite(STDERR, "Database lokal tidak terjangkau.\n"); exit(3); }
$aksi = $argv[1] ?? '';

if ($aksi === 'hapus') {
    $n = $pdo->exec("DELETE FROM user_sessions WHERE user_agent = 'qim-e2e'");
    echo (int)$n, "\n";
    exit(0);
}
if ($aksi === 'buat') {
    $peran = ($argv[2] ?? 'admin') === 'user' ? 'user' : 'admin';
    $st = $pdo->prepare("SELECT id FROM users WHERE role = :r AND is_active = 1 ORDER BY id LIMIT 1");
    $st->execute([':r' => $peran]);
    $uid = (int)$st->fetchColumn();
    if ($uid < 1) { fwrite(STDERR, "Tidak ada pengguna aktif dengan peran $peran.\n"); exit(4); }
    $token = bin2hex(random_bytes(32));
    $pdo->prepare("INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at, created_at)
                   VALUES (:u, :t, '127.0.0.1', 'qim-e2e', DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())")
        ->execute([':u' => $uid, ':t' => hash('sha256', $token)]);
    echo $token, "\n";
    exit(0);
}
fwrite(STDERR, "Pemakaian: php tests/e2e/sesi-uji.php buat <admin|user> | hapus\n");
exit(1);
