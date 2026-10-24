// Chart-first dashboard contract: indicator controls are scoped to Signal
// Center and no legacy hidden indicator grid is required on the page shell.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-shell.js'), 'utf8');
let failed = 0;
function check(label, ok) { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; }

check('indikator EMA/RSI/MACD tersedia di Signal Center', ['qt-ind-ema', 'qt-ind-rsi', 'qt-ind-macd'].every(id => html.includes(`id="${id}"`)));
check('MTF bisa diaktifkan sebagai konfirmasi', /id="qt-ind-mtf"/.test(html) && /mtfEnabled/.test(shell));
check('konfigurasi indikator disimpan per workspace', /indicators: \{ \.\.\.state\.indicators \}/.test(shell));
check('indikator tidak otomatis membuat signal tanpa data', /Pilih minimal satu indikator/.test(shell) && /Membaca candle yang sudah close/.test(html));
check('legacy indicator-button grid tidak kembali ke dashboard shell', !/id="ind(?:EMA20|BB|Ichi|RSI|VOL)"/.test(html));
check('signal overlay dan refresh tersedia', /qt-signal-overlay/.test(shell) && /qtRefreshSignal/.test(html));

if (failed) { console.error(`\nFAIL — ${failed} chart contract check gagal`); process.exit(1); }
console.log('\nPASS — chart signal surface is clean and intentional');
