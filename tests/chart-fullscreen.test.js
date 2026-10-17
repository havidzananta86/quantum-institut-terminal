// Layar penuh chart: popover/toast di atas panel, watchlist dipulihkan saat keluar, tombol Setup ada.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'assets/js/dashboard-app.js'), 'utf8');
const pages = fs.readFileSync(path.join(root, 'assets/js/qim-pages.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/qim-pages.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }

// ── z-index: panel layar penuh 99999 → popover & toast harus lebih tinggi ──
const panelZ = Number((html.match(/#panel-charts\.chart-fullscreen-mode\s*\{[^}]*z-index:\s*(\d+)/) || [])[1]);
const popZ = Number((css.match(/\.qch-pop\s*\{\s*z-index:\s*(\d+)/g) || []).pop().match(/(\d+)/)[1]);
const toastZ = Number((css.match(/#quantumToastContainer\s*\{\s*z-index:\s*(\d+)/) || [])[1]);
cek('panel layar penuh punya z-index', panelZ >= 1000);
cek('popover chart berada di atas panel layar penuh', popZ > panelZ);
cek('toast berada di atas panel layar penuh', toastZ > panelZ);

// ── Menu Indikator memuat tombol baru; tombol Setup hanya tampil saat layar penuh ──
const semua = (pages.match(/const SEMUA_IND = \[([^\]]*)\]/) || [])[1] || '';
cek('menu Indikator memuat Bollinger, RSI, Volume', ['indBB', 'indRSI', 'indVOL'].every(id => semua.includes("'" + id + "'")));
cek('tombol Setup ada di bilah chart', /data-ch="setup"/.test(pages) && /aksi === 'setup'/.test(pages));
cek('tombol Setup tersembunyi di luar layar penuh', /\.qch-setup-btn\s*\{\s*display:\s*none/.test(css) && /chart-fullscreen-mode \.qch-setup-btn\s*\{\s*display:\s*inline-flex/.test(css));
cek('catatan "Bollinger selalu tampil" sudah dihapus', !/selalu tampil sebagai acuan/.test(pages));

// ── Perilaku: watchlist disembunyikan saat masuk, dipulihkan saat keluar ──
const ambil = nama => { const a = js.indexOf('function ' + nama + '('); let d = 0, i = js.indexOf('{', a); const mulai = a; for (; i < js.length; i++) { if (js[i] === '{') d++; else if (js[i] === '}') { d--; if (d === 0) break; } } return js.slice(mulai, i + 1); };
const kode = ['toggleChartWatchlist', 'toggleChartFullscreenMode'].map(ambil).join('\n');
function jalankan(awalWlTerlihat) {
    const kelas = {};
    const el = id => kelas[id] || (kelas[id] = { id, set: new Set(), classList: { toggle(c, f) { const a = f === undefined ? !el(id).set.has(c) : f; a ? el(id).set.add(c) : el(id).set.delete(c); }, add(c) { el(id).set.add(c); }, remove(c) { el(id).set.delete(c); } }, textContent: '', innerHTML: '' });
    const doc = { getElementById: id => el(id), querySelector: sel => el(sel) };
    const f = new Function('document', 'window', 'setTimeout', '_lwChart', '_wlVisible', '_chartFullscreen', '_wlDisembunyikanOtomatis',
        kode + `; return { masukKeluar() { toggleChartFullscreenMode(); }, wl: () => _wlVisible, fs: () => _chartFullscreen };`);
    const w = { qimTutupPopoverChart() { w.popoverDitutup = (w.popoverDitutup || 0) + 1; } };
    const api = f(doc, w, fn => fn, null, awalWlTerlihat, false, false);
    return { api, el, w };
}
let { api, el, w } = jalankan(true);
api.masukKeluar();
cek('masuk layar penuh: watchlist disembunyikan', api.fs() === true && api.wl() === false && el('.qim-watchlist-card').set.has('hidden'));
api.masukKeluar();
cek('keluar layar penuh: watchlist muncul lagi', api.fs() === false && api.wl() === true && !el('.qim-watchlist-card').set.has('hidden'));
cek('popover chart ditutup tiap pergantian mode', w.popoverDitutup === 2);
({ api, el, w } = jalankan(false));
api.masukKeluar(); api.masukKeluar();
cek('watchlist yang memang disembunyikan pengguna tetap tersembunyi', api.wl() === false);

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — layar penuh chart: menu, popover, watchlist, dan Setup berfungsi');
