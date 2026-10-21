/**
 * Batch "mutu sinyal": resolusi M1 candle ambigu, slippage, kandidat yang ditolak gerbang
 * dinilai kontrafaktual, CI bootstrap expectancy, dan kriteria kesiapan auto-entry.
 *
 * Run:  node tests/mutu-sinyal.test.js
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
const ev = baca('api/signal-evaluator.php');
cek('evaluator: satu penilai bersama untuk resmi & kandidat ditolak', /function qi_sig_nilai_rekor\(/.test(ev) && /qi_sig_nilai_ditolak\(\$dry\)/.test(ev));
// Sejak 2026-10-21 nilainya datang dari konstanta bernama, bukan angka di tengah kode.
cek('evaluator: versi_penilaian 3 (slippage + M1)', /'versi_penilaian'\] = QI_VERSI_PENILAIAN/.test(ev) && /define\('QI_VERSI_PENILAIAN', 3\)/.test(ev));
const rec = baca('api/_signal_record.php');
cek('pencatat: penolakan spread/mesin/korelasi dicatat sebagai kandidat', (rec.match(/qi_ditolak_catat\(/g) || []).length === 3);
cek('pembangkit & AI: blackout berita dicatat sebagai kandidat', /qi_ditolak_catat\(/.test(baca('api/signal-generator.php')) && /qi_ditolak_catat\(/.test(baca('api/ai-signal.php')));
cek('cron & endpoint bayangan memberi pengurai M1', (baca('api/maintenance-cron.php').match(/'urai_m1'/g) || []).length === 2 && /'urai_m1'/.test(baca('api/signal-setup-shadow.php')));
const sh = baca('api/signal-setup-shadow.php');
cek('laporan admin: sinyal_ditolak', /'sinyal_ditolak'\]/.test(sh));
cek('laporan bayangan: kesiapan_auto_entry', /'kesiapan_auto_entry'/.test(baca('api/_setup_shadow.php')));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
const run = spawnSync(PHP, [path.join(__dirname, 'mutu-sinyal.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
