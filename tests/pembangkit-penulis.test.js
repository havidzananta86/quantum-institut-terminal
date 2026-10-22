/**
 * Pembangkit sinyal memakai penulis bersama qi_signal_catat — tidak ada rekor yang hilang dan
 * semua gerbang berlaku. Lihat tests/pembangkit-penulis.test.php.
 *
 * Run:  node tests/pembangkit-penulis.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
let gagal = 0;
const cek = (nama, ok) => { console.log(`  ${ok ? '✓' : '✗'} ${nama}`); if (!ok) gagal++; };

console.log('Sambungan (statis)');
const gen = fs.readFileSync(path.join(root, 'api/signal-generator.php'), 'utf8');
cek('signal-generator.php memanggil qi_signal_catat( dan tidak menulis berkas riwayat sendiri',
  /qi_signal_catat\(/.test(gen) && !/file_put_contents\(\$historyFile/.test(gen) && !/qi_signal_praterbit\(/.test(gen));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
console.log('');
const run = spawnSync(PHP, [path.join(__dirname, 'pembangkit-penulis.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
