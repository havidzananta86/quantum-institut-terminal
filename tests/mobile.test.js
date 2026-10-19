// Tampilan ponsel (Android/iOS): kontrak statis untuk target sentuh 44 px, teks input 16 px, gestur chart,
// kerangka (skeleton), layar pembuka yang tidak menunggu window.load, satu dialog sekaligus, dan font non-blokir.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }

const html = read('dashboard.html'), css = read('assets/css/qim-mobile.css'), app = read('assets/js/dashboard-app.js');
const idx = s => html.indexOf(s);

console.log('Muat awal');
cek('qim-chart-store.js dimuat SEBELUM dashboard-app.js (semua modul memakai fetch yang sama)', idx('qim-chart-store.js') > 0 && idx('qim-chart-store.js') < idx('assets/js/dashboard-app.js'));
cek('qim-chart-store.js dimuat SETELAH qim-auth-fetch.js (token sudah terpasang saat dikunci)', idx('qim-auth-fetch.js') < idx('qim-chart-store.js'));
// Skrip inline dashboard sudah dipindah ke assets/js/halaman-dashboard-*.js (CSP tanpa 'unsafe-inline').
const kepala = read('assets/js/halaman-dashboard-kepala.js'), pemuat = read('assets/js/halaman-dashboard-pemuat.js'), awal = read('assets/js/halaman-dashboard-awal.js');
cek('font Google tidak memblokir tampilan pertama (preload, dipasang skrip) dengan cadangan noscript',
    /rel="preload" as="style" href="https:\/\/fonts\.googleapis\.com[^"]+" data-qi-gaya-tunda>/.test(html) && /<noscript><link href="https:\/\/fonts\.googleapis\.com/.test(html)
    && /link\[data-qi-gaya-tunda\][\s\S]*g\.rel = 'stylesheet'/.test(kepala) && idx('halaman-dashboard-kepala.js') > idx('data-qi-gaya-tunda'));
cek('layar pembuka ditutup saat DOMContentLoaded (tidak menunggu window.load)', /document\.addEventListener\('DOMContentLoaded', tutup\)/.test(pemuat));
cek('layar pembuka punya batas waktu pengaman', /setTimeout\(tutup, \d+\)/.test(pemuat));

console.log('Dialog pertama kali');
cek('sambutan hanya sekali (diingat saat ditutup, tanpa kotak centang)', /localStorage\.setItem\('qi_dashboard_onboarded', '1'\)/.test(awal) && !/qiOnboardingSkipAlways/.test(html + awal));
const pf = read('assets/js/pro-features.js'), ui = read('assets/js/ui-improvements.js');
cek('tips pintasan keyboard dilewati di layar sentuh', /pointer: coarse\)'\)\.matches\) \{ localStorage\.setItem\('qi_onboarding_v2'/.test(pf));
cek('tips & "apa yang baru" menunggu dialog lain (window.__qimDialogAktif)', /__qimDialogAktif/.test(pf) && /__qimDialogAktif/.test(ui) && /__qimDialogAktif = 'sambutan'/.test(awal));
cek('pengguna baru tidak mendapat "apa yang baru"', /qi_dashboard_onboarded'\) !== '1'\) \{ localStorage\.setItem\(key, CHANGELOG_VERSION\); return; \}/.test(ui));

console.log('Target sentuh & input');
cek('qim-mobile.css dimuat setelah qim-mockup.css', idx('qim-mobile.css') > idx('qim-mockup.css'));
cek('teks input 16 px di layar sentuh (iOS tidak memperbesar halaman), mengalahkan a11y.css 11px !important', /@media \(pointer: coarse\)[\s\S]*select:not\(#qim-x\), textarea:not\(#qim-x\) \{ font-size: 16px !important; \}/.test(css));
const sentuh = read('assets/css/qim-sentuh.css');
cek('halaman lain (login, register, profil, admin, …) juga 16 px di layar sentuh', /select:not\(#qim-x\), textarea:not\(#qim-x\) \{ font-size: 16px !important; \}/.test(sentuh)
    && ['index', 'login', 'register', 'pricing', 'privacy', 'terms', 'status', 'economic-calendar', 'pwa', '404', 'profile', 'admin'].every(h => read(h + '.html').includes('assets/css/qim-sentuh.css')));
cek('tombol alat chart, timeframe, ikon, menu ≥ 44 px', /\.qch-tf, \.qch-btn, \.qch-icon, \.qdraw-tool[\s\S]{0,200}min-height: 44px/.test(css) && /min-width: 44px/.test(css));
cek('tombol kecil mendapat area sentuh tambahan (::after)', /\.qch-star::after \{ content: ""; position: absolute; inset: -11px; \}/.test(css));
cek('tanpa jeda ketuk-ganda (touch-action: manipulation)', /touch-action: manipulation/.test(css));
cek('menu atas yang terjepit disembunyikan di ponsel (< 600 px)', /@media \(max-width: 599px\)[\s\S]*\.qim-top-nav \{ display: none; \}/.test(css));

console.log('Gestur chart');
cek('layar sentuh: geser vertikal tidak menggeser skala harga; geser horizontal & cubit tetap', /vertTouchDrag: !layarSentuh/.test(app) && /horzTouchDrag: true/.test(app) && /pinch: true/.test(app));
cek('tekan-lama di chart tidak memunculkan menu salin iOS', /#tv_chart_container[^{]*\{ -webkit-touch-callout: none;/.test(css));

console.log('Kerangka (skeleton)');
cek('kerangka chart & daftar ada di HTML', /id="qimChartSkel"/.test(html) && (html.match(/class="qim-skel-list"/g) || []).length >= 4);
cek('chart mengirim qi-chart-loading / qi-chart-data / qi-chart-gagal', /kabar\('qi-chart-loading'\)/.test(app) && /kabar\('qi-chart-gagal'\)/.test(app) && /'qi-chart-data'/.test(app));
const mj = read('assets/js/qim-mobile.js');
cek('kerangka chart punya batas waktu & menghormati prefers-reduced-motion', /BATAS_MS/.test(mj) && /prefers-reduced-motion/.test(css));
cek('teks "Memuat…" tetap ada untuk pembaca layar', (html.match(/class="qim-sr">Memuat/g) || []).length >= 5);

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — tampilan ponsel: muat awal, target sentuh, gestur, kerangka');
