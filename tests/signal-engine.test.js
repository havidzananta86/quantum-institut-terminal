/** Regression checks for the canonical closed-candle signal contract. */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const php = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(php, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${php}").`);
  process.exit(0);
}

const run = spawnSync(php, [path.join(__dirname, 'signal-engine.test.php')], { cwd: root, encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) process.exit(run.status || 1);

const js = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-shell.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const checks = [
  ['JS memakai engine version canonical', /signalEngineVersion = 'qt-signal-v2\.3'/.test(js)],
  ['JS membuang candle berjalan untuk signal confirmed', /state\.candles = sets\.closed/.test(js)],
];

// DITANGGUHKAN, bukan dihapus: dashboard.html masih versi master (panel), karena
// shell iframe menghapus modul yang dijamin tes lain — Quick Trade, garis entry/SL/TP,
// batas rugi harian (qim-batas-rugi.js), paper trading (autoPaperCard), berita di chart.
// Nyalakan lagi bersama migrasi dashboard, setelah diputuskan fitur mana yang ikut dan
// dari mana TradeCanvas dipasok (npm @tradecanvas/chart, bukan salinan situs vendor).
const dashboardSudahPakaiShell = /qim-terminal-shell\.js\?v=/.test(dashboard);
if (dashboardSudahPakaiShell) {
  checks.push(['dashboard memuat kontrak JS terbaru', /qim-terminal-shell\.js\?v=1\.3\.0/.test(dashboard)]);
} else {
  console.log('  — dashboard masih memakai panel master; cek kontrak dashboard ditangguhkan');
}
let failed = 0;
for (const [label, ok] of checks) { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; }
if (failed) process.exit(1);
console.log('\nPASS — frontend/backend signal contract checks');
