// Brief pasar harian: logika server (PHP, di dua zona waktu) + kontrak statis (endpoint, kartu dashboard, cron).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300))); if (!kondisi) gagal++; }

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
if (spawnSync(PHP, ['-v'], { encoding: 'utf8' }).error) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}")`);
} else {
  const run = spawnSync(PHP, [path.join(__dirname, 'brief-harian.test.php')], { encoding: 'utf8' });
  process.stdout.write(run.stdout || ''); process.stderr.write(run.stderr || '');
  if (run.status !== 0) gagal++;
}

console.log('Kontrak');
const ep = read('api/brief-harian.php'), lib = read('api/_brief_harian.php'), cron = read('api/maintenance-cron.php');
cek('endpoint butuh login, hanya GET, ber-rate-limit', /qi_require_auth\(\)/.test(ep) && /!== 'GET'/.test(ep) && /qi_rate_limit\(/.test(ep));
cek('satu panggilan AI per hari: hasil AI disimpan per tanggal WIB', /brief_harian/.test(lib) && /\$c\['sumber'\] === 'ai'/.test(lib));
cek('API key tidak pernah dikirim ke klien (hanya dibaca dari config di server)', !/GROQ_API_KEY/.test(ep));
cek('cron menyiapkan brief pagi hari WIB (sebelum pengguna membuka dashboard)', /qi_brief_ambil\(/.test(cron));
const dash = read('dashboard.html');
cek('chart-first dashboard memisahkan brief harian dari shell chart', !/qim-brief-harian\.js\?v=/.test(dash) && !/id="briefHarian"/.test(dash) && /qim-terminal-shell\.js\?v=/.test(dash));
// assets/js/qim-brief-harian.js ikut terhapus bersama dashboard panel lama, jadi dua
// pemeriksaan sisi klien (render Markdown aman, label sumber AI vs otomatis) tidak punya
// subjek lagi. Pembuatan brief beserta penafiannya tetap diuji di brief-harian.test.php.

console.log(gagal ? `\n${gagal} GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
