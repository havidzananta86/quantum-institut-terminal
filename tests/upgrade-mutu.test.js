/**
 * Batch "upgrade mutu": gerbang spread hidup & eksposur korelasi pada pencatatan sinyal resmi,
 * blackout berita per mata uang, statistik per sesi/hari/simbol/versi, Monte Carlo drawdown,
 * detak cron + alarm di health.php, dan panel dashboard yang menampilkannya.
 *
 * Run:  node tests/upgrade-mutu.test.js
 * PHP binary: $PHP_BIN, else `php` from PATH (skips the PHP part when absent).
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
const mw = baca('api/_middleware.php');
cek('qi_berita_blackout menerima simbol & menyaring per mata uang', /function qi_berita_blackout\(int \$menit = 30, bool \$bolehSegarkan = false, \?string \$simbol = null\)/.test(mw) && /qi_gr_berita_relevan\(/.test(mw));
const gen = baca('api/signal-generator.php');
cek('pembangkit: blackout per simbol di dalam putaran', /qi_berita_blackout\(30, false, \$simbol\)/.test(gen));
cek('AI signal: blackout untuk simbol yang dianalisa', /qi_berita_blackout\(30, true, \$symbol\)/.test(baca('api/ai-signal.php')));
const rec = baca('api/_signal_record.php');
cek('pencatat: gerbang spread + korelasi + versi aturan', /qi_gr_cek_spread\(/.test(rec) && /qi_gr_cek_korelasi\(/.test(rec) && /versi_aturan/.test(rec));
cek('pencatat: korelasi diperiksa DI BAWAH kunci (sesudah cek pagar)', rec.indexOf('qi_gr_cek_korelasi(') > rec.indexOf('$periksa = qi_signal_cek_pagar('));
cek('evaluator menandai versi_penilaian', /'versi_penilaian'] = [2-9]/.test(baca('api/signal-evaluator.php')));
const sh = baca('api/signal-history.php');
cek('API rekor: statistik_dimensi + monte_carlo', /'statistik_dimensi'/.test(sh) && /'monte_carlo'/.test(sh));
const hl = baca('api/health.php');
cek('health: status cron + alarm, tanpa 503 bila cron belum pernah jalan', /qi_cron_status\(/.test(hl) && /if \(\$checks\['cron'\]\['basi'\]\)/.test(hl));
cek('cron menulis detak di akhir putaran', /qi_cron_detak\(/.test(baca('api/maintenance-cron.php')));
const dash = baca('dashboard.html');
cek('dashboard: panel per dimensi + Monte Carlo', /id="trDimPilih"/.test(dash) && /id="trDimBaris"/.test(dash) && /id="trMonteCarlo"/.test(dash));
cek('dashboard-app.js merender statistik_dimensi & monte_carlo', /data\.statistik_dimensi/.test(baca('assets/js/dashboard-app.js')) && /data\.monte_carlo/.test(baca('assets/js/dashboard-app.js')));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the PHP part.`);
  process.exit(gagal ? 1 : 0);
}
const run = spawnSync(PHP, [path.join(__dirname, 'upgrade-mutu.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;
console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
