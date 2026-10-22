/**
 * Gangguan database TIDAK boleh mengeluarkan pengguna.
 *
 * Klien (auth.js, halaman-dashboard-awal.js, halaman-login.js) menghapus sesi tersimpan hanya
 * pada 401 AUTH_REQUIRED / 2FA_REQUIRED. Dulu qi_validate_token() mengembalikan null untuk dua
 * hal yang sangat berbeda — token ditolak, dan MySQL tidak terjangkau — sehingga verify_token
 * menjawab 401 saat database sedang gangguan, dan semua pengguna yang membuka dashboard ter-logout.
 *
 * Uji ini menyalin api/_middleware.php ke folder sementara bersama config/database.php palsu yang
 * koneksinya selalu gagal, lalu menjalankan qi_validate_token() dan qi_require_auth() di PHP CLI.
 * Run:  node tests/sesi-db-gagal.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

const auth = fs.readFileSync(path.join(root, 'api/auth.php'), 'utf8');
const verify = auth.slice(auth.indexOf("if ($type === 'verify_token')"), auth.indexOf('_login_guard.php'));
cek('verify_token menjawab 503 lewat qi_tolak_bila_db_gagal sebelum 401', verify.indexOf('qi_tolak_bila_db_gagal()') > 0 && verify.indexOf('qi_tolak_bila_db_gagal()') < verify.indexOf('http_response_code(401)'));
cek('verify_token mengirim kode 2FA_REQUIRED untuk login yang belum lolos 2FA', /2FA_REQUIRED/.test(verify));

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
if (spawnSync(PHP, ['-v'], { encoding: 'utf8' }).error) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
} else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qi-dbgagal-'));
  fs.mkdirSync(path.join(dir, 'api'));
  fs.mkdirSync(path.join(dir, 'config'));
  fs.copyFileSync(path.join(root, 'api/_middleware.php'), path.join(dir, 'api/_middleware.php'));
  fs.writeFileSync(path.join(dir, 'config/database.php'),
    "<?php\nfunction getDBConnection(): PDO { throw new PDOException('SQLSTATE[HY000] [2002] Connection refused'); }\n");
  const skrip = path.join(dir, 'uji.php');
  fs.writeFileSync(skrip, `<?php
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . str_repeat('a', 64);
$_SERVER['REQUEST_METHOD'] = 'GET';
require __DIR__ . '/api/_middleware.php';
$u = qi_validate_token();
$hasil = ['user' => $u, 'db_gagal' => !empty($GLOBALS['qi_db_gagal'])];
ob_start();
register_shutdown_function(function () use (&$hasil) {
    $hasil['keluaran'] = json_decode(ob_get_clean(), true);
    $hasil['http'] = http_response_code();
    echo json_encode($hasil);
});
qi_require_auth();
`);
  const run = spawnSync(PHP, [skrip], { encoding: 'utf8', cwd: dir });
  let r = null;
  try { r = JSON.parse(run.stdout.trim().split('\n').pop()); } catch (e) { cek('PHP menghasilkan JSON', false, (run.stdout || '') + (run.stderr || '')); }
  if (r) {
    cek('token tidak dinilai (null) saat DB gagal', r.user === null, r);
    cek('kegagalan DB ditandai, bukan disamakan dengan token ditolak', r.db_gagal === true, r);
    cek('qi_require_auth menjawab DB_UNAVAILABLE, bukan AUTH_REQUIRED', r.keluaran && r.keluaran.code === 'DB_UNAVAILABLE', r.keluaran);
    cek('pesannya menegaskan pengguna tidak dikeluarkan', r.keluaran && /tidak dikeluarkan/.test(r.keluaran.message || ''), r.keluaran);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
