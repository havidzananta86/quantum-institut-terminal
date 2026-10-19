/**
 * Perlindungan kata sandi demo publik: login ditolak di produksi (auth.php + login.php),
 * daftar/ganti kata sandi menolaknya, cron mengaudit akun & mencabut sesi, origin Vercel lama
 * tidak lagi diizinkan CORS, dan seed.sql ditandai "lokal saja".
 *
 * Run:  node tests/password-publik.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus) => { console.log(`  ${lulus ? '✓' : '✗'} ${nama}`); if (!lulus) gagal++; };

console.log('Sambungan (statis)');
for (const f of ['api/auth.php', 'api/login.php']) {
  const s = baca(f);
  const iVerify = s.indexOf("password_verify($password, $user['password_hash'])");
  const iTolak = s.indexOf('qi_password_publik_tolak_login(');
  const iSesi = s.indexOf('createSession(', iVerify);
  cek(`${f}: kata sandi publik ditolak SEBELUM sesi dibuat`, iVerify > 0 && iTolak > iVerify && iTolak < iSesi);
}
cek('register.php menolak kata sandi publik', /qi_password_publik\(\$password\)/.test(baca('api/register.php')));
cek('change-password.php menolak kata sandi publik baru', /qi_password_publik\(\$newPw\)/.test(baca('api/change-password.php')));
cek('cron: audit harian + pencabutan sesi', /qi_password_publik_audit\(/.test(baca('api/maintenance-cron.php')));
cek('CORS: origin Vercel lama dihapus', !/quantum-institut-terminal\.vercel\.app/.test(baca('api/_middleware.php')));
cek('seed.sql ditandai hanya untuk lokal', /HANYA UNTUK PENGEMBANGAN LOKAL/.test(baca('database/seed.sql')));
cek('skrip pemulihan hanya CLI', /PHP_SAPI !== 'cli'/.test(baca('database/ganti-password.php')));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
const run = spawnSync(PHP, [path.join(__dirname, 'password-publik.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
