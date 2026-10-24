// Fullscreen and chart utility contract for the current Quantum Terminal shell.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/qim-terminal-shell.css'), 'utf8');
let failed = 0;
function check(label, ok) { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; }

check('tombol fullscreen tersedia', /id="qtChartFullscreen"/.test(html));
check('shortcut fullscreen tersedia', /Ctrl\+Shift\+F/.test(html) && /fullscreen/.test(shell));
check('zoom, reset, dan crosshair tersedia', ['qtChartZoomIn', 'qtChartZoomOut', 'qtChartReset', 'qtChartCrosshair'].every(id => html.includes(`id="${id}"`)));
check('pair loading memiliki layer di atas chart', /id="qtPairLoading"/.test(html) && /qt-pair-loading/.test(css));
check('Signal Center dapat ditutup saat chart tetap aktif', /qtAssistClose/.test(html) && /qtAssistScrim/.test(html));
check('overlay signal dikirim ke iframe chart', /contentWindow\.postMessage\(\{ type: 'qt-signal-overlay'/.test(shell));

if (failed) { console.error(`\nFAIL — ${failed} fullscreen/chart utility check gagal`); process.exit(1); }
console.log('\nPASS — chart utilities and fullscreen controls are wired');
