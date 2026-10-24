// Hemat kuota & baterai di HP (diukur 2026-10-18, dashboard dibiarkan terbuka 1 menit):
// permintaan 123 → ±40/menit, data 818 → ±110 KB/menit, kerja main-thread 5,6 → 1,2 dtk/menit.
// Kontrak statis supaya pemborosan ini tidak kembali diam-diam.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }

const app = read('assets/js/dashboard-app.js');
const lw =read('assets/js/halaman-dashboard-lw.js');   // modul chart (dulu <script type="module"> inline)

console.log('Kuota data');
// Dulu modul QuantumOrderBook polling 40x/menit dan hanya dijaga pemeriksaan
// #orderBookContainer. Wadah itu sudah lama hilang dari dashboard.html, jadi seluruh
// modulnya dihapus — nol permintaan lebih hemat daripada permintaan yang dijaga.
cek('modul order book lama (polling 40 permintaan/menit) sudah tidak ada',
    !/QuantumOrderBook/.test(read('assets/js/pro-trading-tools.js')));
const rt = read('assets/js/realtime.js');
cek('tick broker: 1,5 dtk hanya saat EA streaming, 15 dtk bila tidak', /INTERVAL_BROKER_DIAM = 15000/.test(rt) && /if \(j && j\.streaming\) berikut = INTERVAL_BROKER;/.test(rt) && !/setInterval\(ambilTickBroker/.test(rt));
cek('MTF bias (5 timeframe) hanya saat Overview/MTF tampil, maks sekali per menit', /function mtfBiasBilaTerlihat\(\)/.test(app) && !/^fetchMtfBias\('XAUUSD'\);/m.test(app) && /setInterval\(mtfBiasBilaTerlihat, 60000\)/.test(app));
cek('chart: 1000 candle diunduh ulang hanya saat batang baru seharusnya muncul', /if \(akhirLokal && kini < akhirLokal\.time \+ durBatang\) return;/.test(app) && /_ohlcSync\.boleh = kini \+ Math\.min\(300/.test(app));
cek('Mesin 9 memakai kunci data watchlist (BTC = BTCUSDT, bukan "BTCUSD" yang berbuah data simulasi)',
    /WL_GROUPS\.flatMap\(g => g\.syms\)\.find\(x => x\.tv === s\)/.test(read('assets/js/dashboard-pro.js')));
const dash = read('dashboard.html');
cek('shell chart-first tidak menunggu modul gambar opsional',
    /id="quantumTerminalFrame"/.test(dash) && !/lightweight-charts-drawing@/.test(dash) && !/lc-modules-ready/.test(dash));

console.log('CPU & baterai');
const a11y = read('assets/js/a11y.js');
cek('a11y: pemantau dialog hanya bereaksi pada perubahan yang menyentuh dialog, maks sekali per frame', /var relevan = function \(catatan\)/.test(a11y) && /requestAnimationFrame \|\| setTimeout\)\(function \(\) \{ tertunda = false; periksaDialog\(\); \}\)/.test(a11y));
cek('a11y: sinkronisasi tab ditunda ke frame berikutnya (tidak memaksa layout di tengah pindah panel)', /var dijadwalkan = false;/.test(a11y));
cek('switchPanel tidak membaca offsetWidth (memaksa layout seluruh halaman)', !/void el\.offsetWidth/.test(app) && !/bar\.offsetWidth/.test(app));
cek('jam dunia memakai formatter Intl yang disimpan', /const _fmtZona = \{\};/.test(app) && !/new Date\(new Date\(\)\.toLocaleString\('en-US', \{ timeZone: tz \}\)\)/.test(app));
cek('gestur geser memakai matchMedia, bukan innerWidth', /matchMedia\('\(max-width: 768px\)'\)/.test(read('assets/js/ui-improvements.js')));
cek('kerangka chart yang tersembunyi tidak menjalankan animasi kilau terus-menerus', /\.qim-skel-chart\.hilang i \{ animation: none; \}/.test(read('assets/css/qim-mobile.css')));

console.log(gagal ? `\nFAIL — ${gagal} kontrak hemat dilanggar` : '\nPASS — hemat kuota & baterai di HP');
process.exit(gagal ? 1 : 0);
