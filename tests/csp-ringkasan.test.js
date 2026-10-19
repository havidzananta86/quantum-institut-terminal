/**
 * Ringkasan laporan CSP untuk admin: endpoint khusus admin, kartu di admin.html, dan logika
 * pengelompokan (tests/csp-ringkasan.test.php).
 *
 * Run:  node tests/csp-ringkasan.test.js
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
const ep = baca('api/csp-ringkasan.php');
cek('endpoint khusus admin, sebelum membaca laporan', ep.indexOf('qi_require_admin()') > 0 && ep.indexOf('qi_require_admin()') < ep.indexOf('qi_csp_ringkasan('));
cek('admin.html punya kartu Laporan CSP', /id="cspTabel"/.test(baca('admin.html')));
cek('halaman-admin.js memanggil api/csp-ringkasan.php dengan token', /api\/csp-ringkasan\.php[^\n]*authHeaders\(\)/.test(baca('assets/js/halaman-admin.js')));
cek('folder laporan tidak bisa dibuka langsung (.htaccess)', /RewriteRule \^\([^)]*\bcache\b[^)]*\)\/ - \[F,L\]/.test(baca('.htaccess')));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
const run = spawnSync(PHP, [path.join(__dirname, 'csp-ringkasan.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
