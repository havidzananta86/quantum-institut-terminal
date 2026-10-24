// Chart shell contract: the old floating utility toolbar is intentionally gone.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/qim-terminal-shell.css'), 'utf8');
let failed = 0;
function check(label, ok) { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; }

check('toolbar chart mengambang sudah dihapus', !/class="qt-chart-tools"/.test(html) && !/qt-chart-tools/.test(css));
check('handler lama Menu/Zoom/Reset/Full sudah dihapus', !/qtMenuBtn|qtChartZoom(In|Out)|qtChartReset|qtChartFullscreen/.test(html + shell));
check('pair loading memiliki layer di atas chart', /id="qtPairLoading"/.test(html) && /qt-pair-loading/.test(css));
check('Signal Center dapat ditutup saat chart tetap aktif', /qtAssistClose/.test(html) && /qtAssistScrim/.test(html));
check('overlay signal dikirim ke iframe chart', /contentWindow\.postMessage\(\{ type: 'qt-signal-overlay'/.test(shell));

if (failed) { console.error(`\nFAIL — ${failed} fullscreen/chart utility check gagal`); process.exit(1); }
console.log('\nPASS — floating chart utility toolbar is removed');
