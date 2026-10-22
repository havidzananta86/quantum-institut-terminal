/**
 * Penilai sinyal v4: entry wajib bisa terisi, kolom ukuran tersimpan, sebab SL jujur.
 * Lihat tests/penilai-isi-entry.test.php (dijalankan di dua zona php.ini — hasil tidak boleh
 * bergantung pada zona server).
 *
 * Run:  node tests/penilai-isi-entry.test.js
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
const ev = baca('api/signal-evaluator.php');
cek('aturan 12 terdokumentasi dan versi penilaian 4', /12\. ENTRY WAJIB BISA TERISI/.test(ev) && /define\('QI_VERSI_PENILAIAN', 4\)/.test(ev));
cek('mode isi dicatat di rekor (isi_entry, filled_at)', /'isi_entry'/.test(ev) && /'filled_at'/.test(ev));
cek('auto-paper ditutup dengan harga PADA saat kedaluwarsa (bukan end() cache)', /qi_ap_harga_pada\(/.test(ev) && !/\$c = end\(\$d\['candles'\]\);/.test(ev));
const ap = baca('api/_auto_paper.php');
cek('auto-paper memakai exit_price penilai', /\$s\['exit_price'\]/.test(ap) && /function qi_ap_harga_pada\(/.test(ap));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
for (const zona of ['UTC', 'Europe/Berlin']) {
  console.log(`\n[PHP date.timezone=${zona}]`);
  const run = spawnSync(PHP, ['-d', `date.timezone=${zona}`, path.join(__dirname, 'penilai-isi-entry.test.php')], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) gagal++;
}
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
