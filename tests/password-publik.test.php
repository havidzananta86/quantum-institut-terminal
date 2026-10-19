<?php
/**
 * Uji perlindungan kata sandi publik (api/_password_publik.php): pengenalan kata sandi seed,
 * aturan "berlaku di produksi", dan audit akun + pencabutan sesi (SQLite di memori, tanpa
 * database nyata). Kata sandi seed dibaca dari database/seed.sql — tidak ditulis di uji ini.
 * Dijalankan oleh tests/password-publik.test.js.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_password_publik.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}

echo "Pengenalan kata sandi publik\n";
$uji = qi_password_publik_uji();
cek('kata sandi demo dibaca dari seed.sql dan cocok dengan sidiknya', count($uji) === 1 && qi_password_publik($uji[0]));
cek('kata sandi lain tidak dianggap publik', !qi_password_publik('kata-sandi-acak-' . bin2hex(random_bytes(6))));
cek('beda huruf besar/kecil = beda kata sandi', !qi_password_publik(strtoupper($uji[0] ?? 'x')));
cek('sidik saja yang tersimpan di kode, bukan kata sandinya', strpos((string)file_get_contents(__DIR__ . '/../api/_password_publik.php'), (string)($uji[0] ?? '§')) === false);

echo "Kapan berlaku\n";
$harap = PHP_OS_FAMILY === 'Linux' && (string)getenv('CI') === '';
cek('CLI: berlaku hanya di Linux non-CI (cron Hostinger); lokal Windows/CI tidak', qi_password_publik_berlaku() === $harap);

echo "Audit akun & pencabutan sesi\n";
if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    echo "  (dilewati: pdo_sqlite tidak tersedia)\n";
    echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
    exit($gagal === 0 ? 0 : 1);
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, role TEXT, password_hash TEXT)');
$pdo->exec('CREATE TABLE user_sessions (id INTEGER PRIMARY KEY, user_id INTEGER)');
$hPublik = password_hash($uji[0], PASSWORD_DEFAULT);
$hLain = password_hash('rahasia-' . bin2hex(random_bytes(6)), PASSWORD_DEFAULT);
$ins = $pdo->prepare('INSERT INTO users (id, email, role, password_hash) VALUES (?,?,?,?)');
$ins->execute([1, 'admin@contoh.test', 'admin', $hPublik]);
$ins->execute([2, 'pro@contoh.test', 'pro', $hLain]);
$ins->execute([3, 'biasa@contoh.test', 'user', $hPublik]);   // peran biasa: tidak diaudit
$ins->execute([4, 'google@contoh.test', 'vip', '']);          // login Google tanpa kata sandi
foreach ([1, 1, 2, 3] as $uid) $pdo->prepare('INSERT INTO user_sessions (user_id) VALUES (?)')->execute([$uid]);

$a = qi_password_publik_audit($pdo, false);
cek('mode laporan: admin terdeteksi, sesi tidak disentuh', count($a['terdampak']) === 1 && $a['terdampak'][0]['email'] === 'admin@contoh.test' && $a['sesi_dicabut'] === 0 && (int)$pdo->query('SELECT COUNT(*) FROM user_sessions')->fetchColumn() === 4, $a);
cek('hanya admin/vip/pro dengan hash yang diperiksa', $a['diperiksa'] === 2, $a);
$a = qi_password_publik_audit($pdo, true);
$sisa = $pdo->query('SELECT user_id FROM user_sessions ORDER BY user_id')->fetchAll(PDO::FETCH_COLUMN);
cek('mode cabut: 2 sesi admin dicabut, sesi akun lain utuh', $a['sesi_dicabut'] === 2 && array_map('intval', $sisa) === [2, 3], ['audit' => $a, 'sisa' => $sisa]);
cek('tidak pernah mengubah kata sandi atau menonaktifkan akun', $pdo->query('SELECT password_hash FROM users WHERE id = 1')->fetchColumn() === $hPublik);

echo "Penolakan login (bukan produksi → tidak menolak)\n";
if (!qi_password_publik_berlaku()) {
    qi_password_publik_tolak_login($pdo, 'x', ['id' => 1], $uji[0]);
    cek('di lokal fungsi kembali tanpa menghentikan permintaan', true);
}

echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
