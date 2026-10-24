// Contract test for the current dashboard shell.
// The dashboard is intentionally a chart-first terminal now; the old panel
// grid (mainScroll/PANEL_META) was removed, so this test guards the new shell.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/qim-terminal-shell.css'), 'utf8');

let failed = 0;
function check(label, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
}

check('dashboard memiliki iframe Quantum Terminal', /id="quantumTerminalFrame"/.test(html) && /quantum-terminal\/embed\//.test(html));
check('dashboard tidak memuat panel grid lama', !/id="mainScroll"|id="panel-overview"|id="panel-community"/.test(html));
check('Signal Center tersedia sebagai drawer', /id="qtAssistDrawer"/.test(html) && /id="qtAssistLauncher"/.test(html) && /qt-assist-drawer/.test(css));
check('pemilihan pair dan timeframe tersedia', /id="qtSymbol"/.test(html) && /id="qtTimeframe"/.test(html) && /id="qtApplyChart"/.test(html));
check('indikator EMA, RSI, MACD, dan MTF tersedia', ['qt-ind-ema', 'qt-ind-rsi', 'qt-ind-macd', 'qt-ind-mtf'].every(id => html.includes(`id="${id}"`)));
check('signal memiliki entry, SL, TP, dan alasan', ['qtSignalEntry', 'qtSignalSL', 'qtSignalTP', 'qtSignalReason'].every(id => html.includes(`id="${id}"`)));
check('loading pair menunggu feed, chart, analisa, ready', /id="qtPairLoading"/.test(html) && ['feed', 'chart', 'analysis', 'ready'].every(step => html.includes(`data-qt-load-step="${step}"`)));
check('chart tools dan fullscreen tersedia', ['qtChartCrosshair', 'qtChartZoomIn', 'qtChartZoomOut', 'qtChartReset', 'qtChartFullscreen'].every(id => html.includes(`id="${id}"`)));
check('shell mengirim overlay signal ke chart', /qt-signal-overlay/.test(shell));
check('shell memuat signal engine terbaru', /signalEngineVersion = 'qt-signal-v2\.3'/.test(shell));

if (failed) {
  console.error(`\nFAIL — ${failed} dashboard shell check gagal`);
  process.exit(1);
}
console.log('\nPASS — chart-first dashboard shell is valid');
