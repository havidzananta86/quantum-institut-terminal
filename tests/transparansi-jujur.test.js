/**
 * Transparansi: metodologi sesuai penilai yang berlaku + status pemindai Pine apa adanya.
 *
 * Audit sinyal 2026-10-22: halaman publik masih menulis "spread belum dikurangkan" dan "SL selalu
 * lebih dulu", padahal penilai v2/v3 mengurangkan spread + slippage dan mengurai candle ambigu dari
 * M1; pemindai Pine disebut "otomatis" padahal hanya jalan dari cron yang belum pernah berjalan.
 *
 * Run:  node tests/transparansi-jujur.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
let gagal = 0;
const cek = (nama, ok) => { console.log(`  ${ok ? '✓' : '✗'} ${nama}`); if (!ok) gagal++; };

console.log('Metodologi (statis)');
const tr = fs.readFileSync(path.join(root, 'api/transparansi.php'), 'utf8');
cek('tidak lagi menyatakan spread belum dikurangkan', !/Spread dan komisi broker belum dikurangkan/.test(tr));
cek('menyebut spread (v2) dan slippage (v3) dikurangkan', /versi 2 spread dikurangkan/.test(tr) && /versi 3 juga slippage/.test(tr));
cek('candle ambigu: M1 lebih dulu, SL-dulu hanya cadangan', /candle 1 menit \(M1\)/.test(tr) && /bila M1 tidak tersedia atau tetap ambigu, SL dihitung lebih dulu/.test(tr));
cek('aturan isi entry (v4) & pemeriksaan entry saat pencatatan dijelaskan', /versi 4/.test(tr) && /Entry diperiksa terhadap harga pasar/.test(tr));
cek('Pine: tidak lagi "Dicatat otomatis", status pemindai dilaporkan', !/Dicatat otomatis saat status/.test(tr) && /'pemindai' => \$pemindaiPine/.test(tr) && /\$pemindaiPine\['kalimat'\]/.test(tr));

// Teks STATIS di halaman publik harus sejalan dengan metodologi yang dikirim server. Dulu hanya
// string PHP yang diuji, sehingga transparansi.html masih berbunyi "spread dan komisi belum dikurangkan"
// dan index.html "SL dihitung lebih dulu" tanpa menyebut urai M1, bertentangan dengan penilai v2–v4.
{
  const htmlTr = require('fs').readFileSync(require('path').join(__dirname, '..', 'transparansi.html'), 'utf8');
  const htmlIdx = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const ok = (nama, syarat) => { console.log(`  ${syarat ? '✓' : '✗'} ${nama}`); if (!syarat) gagal++; };
  ok('transparansi.html tidak lagi mengklaim spread belum dikurangkan', !/Spread dan komisi belum dikurangkan/.test(htmlTr));
  ok('transparansi.html menyebut spread & slippage dikurangkan dan komisi belum', /spread dikurangkan/.test(htmlTr) && /slippage/.test(htmlTr) && /Komisi akun forex\/emas belum dikurangkan/.test(htmlTr));
  ok('index.html menyebut urai candle 1 menit sebelum SL-lebih-dulu', /candle 1 menit/.test(htmlIdx) && !/SL dihitung lebih dulu\. Spread dan komisi dijelaskan/.test(htmlIdx));
}
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}
console.log('');
const run = spawnSync(PHP, [path.join(__dirname, 'transparansi-jujur.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
