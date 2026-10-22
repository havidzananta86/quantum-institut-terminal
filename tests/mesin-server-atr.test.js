/**
 * Mesin server: satuan ATR sama dengan timeframe nilainya, dan jam sesi dalam WIB eksplisit.
 * Lihat tests/mesin-server-atr.test.php (dijalankan di dua zona php.ini).
 *
 * Run:  node tests/mesin-server-atr.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, ok) => { console.log(`  ${ok ? '✓' : '✗'} ${nama}`); if (!ok) gagal++; };

console.log('Sambungan (statis)');
// Komentar dibuang dulu: komentar boleh menceritakan kode lama, kodenya sendiri tidak boleh memakainya.
const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
const es = tanpaKomentar(baca('api/_engine_server.php'));
cek("mesin harian tidak lagi memakai 'ATR|60'", !/'ATR\|60'\) \?\? qi_eng_angka\(\$c, 'ATR'\)/.test(es) && /qi_eng_atr_harian\(\$c\)/.test(es));
cek('jam sesi tidak lagi date(\'G\') (zona php.ini)', !/date\('G'\)/.test(es) && !/date\('G'\)/.test(tanpaKomentar(baca('api/_gerbang.php'))));
cek('gerbang memakai jam WIB eksplisit', /qi_eng_matriks\(\$c, qi_eng_jam_wib\(\)\)/.test(baca('api/_gerbang.php')));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
for (const zona of ['UTC', 'Europe/Berlin']) {
  console.log(`\n[PHP date.timezone=${zona}]`);
  const run = spawnSync(PHP, ['-d', `date.timezone=${zona}`, path.join(__dirname, 'mesin-server-atr.test.php')], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) gagal++;
}
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
