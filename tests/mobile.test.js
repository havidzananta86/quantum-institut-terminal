// Mobile contract for the chart-first Quantum Terminal shell.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('dashboard.html');
const css = read('assets/css/qim-terminal-shell.css');
const shell = read('assets/js/qim-terminal-shell.js');
let failed = 0;
function check(label, ok) { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; }

console.log('Chart-first responsive shell');
check('viewport chart penuh dan tidak menimbulkan scroll body', /html, body \{ width: 100%; height: 100%; margin: 0; overflow: hidden/.test(html));
check('iframe chart selalu memenuhi shell', /\.terminal-frame \{ display: block; width: 100%; height: 100%/.test(html));
check('drawer berubah menjadi panel mobile', /@media \(max-width: 700px\)[\s\S]*\.qt-assist-drawer[\s\S]*width: 100%/.test(css));
check('kontrol pair/timeframe tetap tersedia di mobile', /\.qt-assist-context \{ grid-template-columns: 1fr 82px auto/.test(css));
check('loading pair responsif di layar kecil', /@media \(max-width: 700px\)[\s\S]*\.qt-pair-loading-card/.test(css));
check('animasi bisa dihentikan untuk reduced motion', /@media \(prefers-reduced-motion: reduce\)/.test(css));
check('Signal Center memakai font sistem profesional', /font-family: "Segoe UI", Inter, system-ui/.test(css));
// Gerbang sesi dipindah dari <script> inline ke assets/js/qim-terminal-gate.js supaya
// dashboard bebas kode inline (CSP ketat Report-Only + tests/csp-inline.test.js).
const gate = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-gate.js'), 'utf8');
check('dashboard memuat gerbang sesi sebagai berkas terpisah', /qim-terminal-gate\.js\?v=/.test(html));
check('auth guard mengarahkan sesi invalid ke login', /function goLogin\(\)/.test(gate) && /login\.html/.test(gate));
check('vendor chart yang hilang dikatakan terus terang, bukan 404 diam', /quantum-terminal\/embed\//.test(gate) && /belum terpasang/.test(gate));
check('fullscreen dan alat chart tetap dapat dipakai dari mobile', ['qtChartFullscreen', 'qtChartReset', 'qtChartCrosshair'].every(id => html.includes(`id="${id}"`)));
check('overlay/loading tidak menghilangkan aksesibilitas status', /role="status" aria-live="polite"/.test(html) && /aria-live="polite"/.test(html));

if (failed) { console.error(`\nFAIL — ${failed} mobile shell check gagal`); process.exit(1); }
console.log('\nPASS — mobile chart-first shell is responsive');
