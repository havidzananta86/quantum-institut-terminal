/**
 * Detak per cron. Sampai 2026-10-21 hanya api/maintenance-cron.php yang menulis detak,
 * sehingga api/ai-cron.php (sinyal AI + paper trade) dan api/alert-cron.php bisa berhenti
 * berminggu-minggu tanpa satu pun tanda — persis masalah yang detak ini diciptakan untuk
 * mencegah. Di sini dipastikan ketiganya menulis detak dan health.php melaporkannya.
 *
 * Run:  node tests/detak-cron.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

console.log('Setiap cron menulis detaknya sendiri');
const detak = baca('api/_detak_cron.php');
cek('qi_cron_berkas() menerima nama cron', /function qi_cron_berkas\(string \$nama = ''\)/.test(detak));
cek('nama cron dibersihkan sebelum jadi nama berkas', /preg_replace\('\/\[\^a-z0-9_-\]\/'/.test(detak));
cek('nama kosong tetap memakai berkas lama (detak lama tidak hilang)', /cron_heartbeat' \. \(\$bersih !== '' \? '_' \. \$bersih : ''\)/.test(detak));
cek('qi_cron_detak() menerima nama cron', /function qi_cron_detak\(array \$ringkas = \[\], string \$nama = ''\)/.test(detak));
cek('qi_cron_baca() menerima nama cron', /function qi_cron_baca\(string \$nama = ''\)/.test(detak));
cek('daftar cron terdefinisi', /function qi_cron_daftar\(\): array/.test(detak) && /'ai' =>/.test(detak) && /'alert' =>/.test(detak));

for (const [berkas, nama] of [['api/ai-cron.php', 'ai'], ['api/alert-cron.php', 'alert']]) {
  const isi = baca(berkas);
  // Argumen ringkasannya boleh memuat tanda kurung (mis. array_intersect_key(...)),
  // jadi yang dicocokkan hanya nama cron sebagai argumen terakhir.
  cek(`${berkas} menulis detak '${nama}'`, new RegExp(`qi_cron_detak\\([\\s\\S]*?,\\s*'${nama}'\\);`).test(isi));
  cek(`${berkas} memuat _detak_cron.php`, /require_once __DIR__ \. '\/_detak_cron\.php';/.test(isi));
  cek(`${berkas}: kegagalan detak tidak menjatuhkan cron`, /catch \(Throwable \$e\)/.test(isi));
}
cek('maintenance-cron tetap memakai detak tanpa nama', /qi_cron_detak\(\[/.test(baca('api/maintenance-cron.php')));

console.log('\nhealth.php melaporkan tiap cron');
const h = baca('api/health.php');
cek('cron pemeliharaan tetap di checks.cron (dipakai status.html)', /\$checks\['cron'\] = qi_cron_status\(qi_cron_baca\(\), time\(\)\)/.test(h));
cek('cron lain dilaporkan terpisah', /\$checks\['cron_lain'\]/.test(h));
cek('cron lain yang BASI membuat status degraded', /if \(\$s\['basi'\]\) \$status = 'degraded';/.test(h));
cek("'belum_pernah' tidak membuat degraded (cron opsional)", !/belum_pernah'\) \$status = 'degraded'/.test(h));

console.log('\nRetensi cache/charts');
const mc = baca('api/maintenance-cron.php');
cek("aturan 'charts' ada", /'charts'\s*=>\s*\['pattern'/.test(mc));
cek('polanya cocok dengan nama berkas signal-snapshot (id sinyal + ekstensi gambar)', /\^\[A-Za-z0-9\\-\]\+\\\.\(png\|jpe\?g\|webp\)/.test(mc));
cek('dibedakan dari aturan "chart" (cache JSON candle)', /'chart'\s*=>/.test(mc) && /'charts'\s*=>/.test(mc));

console.log('\nDokumentasi jadwal');
const rd = baca('README.md');
cek('README: maintenance-cron 15 menit (bukan 6 jam)', /`api\/maintenance-cron\.php` \| \*\*tiap 15 menit\*\*/.test(rd));
cek('README: alert-cron terdaftar', /`api\/alert-cron\.php`/.test(rd));
cek('README: menjelaskan kenapa 6 jam salah', /45 menit/.test(rd) && /degraded/.test(rd));
const dp = baca('deploy/PANDUAN-DEPLOY-HOSTINGER.md');
cek('panduan Hostinger kini punya langkah cron', /Cron Jobs/.test(dp));
cek('panduan memuat ketiga jadwal', /maintenance-cron\.php/.test(dp) && /ai-cron\.php/.test(dp) && /alert-cron\.php/.test(dp));
cek('panduan menyebut cara verifikasinya', /checks\.cron\.status/.test(dp));

// ── Perilaku sungguhan: tulis & baca detak di direktori sementara ────────────
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
console.log('\nTulis & baca detak (PHP sungguhan)');
const skrip = `
require '${path.join(root, 'api/_detak_cron.php').replace(/\\/g, '/')}';
$hasil = [];
$hasil['berkas_kosong'] = basename(qi_cron_berkas(''));
$hasil['berkas_ai'] = basename(qi_cron_berkas('ai'));
$hasil['berkas_nakal'] = basename(qi_cron_berkas('../../etc/passwd'));
$hasil['status_kosong'] = qi_cron_status(null, 1000)['status'];
$hasil['status_ok'] = qi_cron_status(['t' => 1000], 1100)['status'];
$hasil['status_basi'] = qi_cron_status(['t' => 1000], 1000 + 3000)['status'];
$hasil['umur'] = qi_cron_status(['t' => 1000], 1100)['umur_s'];
$hasil['daftar'] = array_keys(qi_cron_daftar());
echo json_encode($hasil);
`;
const run = spawnSync(PHP, ['-r', skrip], { encoding: 'utf8' });
let r = null;
try { r = JSON.parse((run.stdout || '').trim()); } catch (e) { /* ditangani di bawah */ }
cek('skrip PHP berjalan', !!r, (run.stderr || run.stdout || '').slice(0, 200));
if (r) {
  cek('nama kosong → cron_heartbeat.json (berkas lama)', r.berkas_kosong === 'cron_heartbeat.json', r.berkas_kosong);
  cek("nama 'ai' → cron_heartbeat_ai.json", r.berkas_ai === 'cron_heartbeat_ai.json', r.berkas_ai);
  cek('nama berbahaya dibersihkan (tidak bisa keluar folder cache)', r.berkas_nakal === 'cron_heartbeat_etcpasswd.json', r.berkas_nakal);
  cek("tanpa detak → 'belum_pernah'", r.status_kosong === 'belum_pernah');
  cek("detak baru → 'ok'", r.status_ok === 'ok');
  cek("lewat 45 menit → 'basi'", r.status_basi === 'basi');
  cek('umur detak dihitung benar', r.umur === 100, r.umur);
  cek('daftar cron memuat pemeliharaan, ai, alert', JSON.stringify(r.daftar) === '["","ai","alert"]', r.daftar);
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — detak per cron + retensi snapshot + dokumentasi jadwal');
process.exit(gagal ? 1 : 0);
