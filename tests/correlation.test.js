/**
 * Matriks korelasi — uji matematika DAN sikap saat data tidak ada.
 *
 * Sebelumnya berkas ini menguji QuantumCorrelation di assets/js/pro-trading-tools.js:
 * modul itu merender ke #panelCorrelation, elemen yang TIDAK PERNAH ADA di dashboard.html,
 * jadi seluruhnya kode mati dan sudah dihapus. Panel korelasi yang benar-benar dipakai
 * adalah fetchCorrelation()/pearson() di assets/js/dashboard-app.js — itu yang diuji di sini.
 *
 * Run:  node tests/correlation.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'assets/js/dashboard-app.js'), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};
const dekat = (nama, a, b, eps = 1e-9) => cek(`${nama} (${a} ≈ ${b})`, Math.abs(a - b) <= eps, { a, b });

// ── Jalankan berkas asli di sandbox ────────────────────────────────────────
// dashboard-app.js menyentuh DOM, timer dan fetch saat dimuat; semuanya distub
// sekadar supaya modul selesai dievaluasi dan fungsi tingkat-atasnya bisa dipanggil.
const elemenPalsu = () => ({
  innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){}, querySelector(){ return null; },
  querySelectorAll(){ return []; }, getBoundingClientRect(){ return { width: 0, height: 0, top: 0, left: 0 }; },
  children: [], focus(){}, click(){}, setAttribute(){}, getAttribute(){ return null; }, closest(){ return null; },
});
const ctx = {
  console, Date, Math, Number, Array, JSON, isNaN, parseFloat, parseInt, String, Object, Boolean, Error, Promise, Set, Map, RegExp, Intl,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  fetch: () => Promise.reject(new Error('tidak ada jaringan dalam uji')),
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  navigator: { onLine: true, clipboard: { writeText: () => Promise.resolve() } },
  location: { href: '', search: '', pathname: '/dashboard.html' },
  document: {
    readyState: 'loading', documentElement: elemenPalsu(), body: elemenPalsu(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => elemenPalsu(), addEventListener(){}, removeEventListener(){}, visibilityState: 'visible',
  },
};
ctx.addEventListener = () => {};
ctx.removeEventListener = () => {};
ctx.dispatchEvent = () => true;
ctx.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
ctx.CustomEvent = function CustomEvent(t, o) { return { type: t, detail: o && o.detail }; };
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.QIAksi = { daftar(){}, arg: (...a) => JSON.stringify(a) };
ctx.QuantumAuth = { getToken: () => null, authHeaders: (h) => h || {} };
vm.createContext(ctx);
// Fungsi tingkat-atas `function pearson(...)` tidak otomatis jadi properti context di
// sandbox vm, jadi diambil lewat ekspresi penutup.
const pearson = vm.runInContext(SRC + '\n;pearson;', ctx);

console.log('\npearson()');
cek('fungsi pearson terbaca dari dashboard-app.js', typeof pearson === 'function');
if (typeof pearson !== 'function') { console.error('\nFAIL'); process.exit(1); }

dekat('deret identik → +1', pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1, 1e-12);
dekat('deret berlawanan → −1', pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1, 1e-12);
dekat('skala tidak mengubah korelasi', pearson([1, 2, 3, 4], [10, 20, 30, 40]), 1, 1e-12);
dekat('geseran tidak mengubah korelasi', pearson([1, 2, 3, 4], [101, 102, 103, 104]), 1, 1e-12);
cek('deret konstan → 0 (penyebut nol), bukan NaN', pearson([2, 2, 2, 2], [1, 2, 3, 4]) === 0);
cek('hasil selalu di dalam [−1, +1]', (() => {
  const a = [0.4, -0.2, 0.9, -1.1, 0.3, 0.7, -0.5];
  const b = [-0.1, 0.5, 0.2, 0.8, -0.9, 0.1, 0.6];
  const r = pearson(a, b);
  return r >= -1 && r <= 1;
})());
cek('panjang berbeda → dipotong ke yang terpendek, tidak melempar', (() => {
  try { const r = pearson([1, 2, 3, 4, 5, 6], [1, 2, 3]); return Number.isFinite(r); } catch (e) { return false; }
})());
{
  // Nilai acuan dihitung tangan: r untuk x=[1,2,3,4,5], y=[2,4,5,4,5] adalah 0.7745966692…
  dekat('contoh berangka tetap', pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]), 0.7745966692414834, 1e-12);
}

console.log('\nSikap saat data tidak ada (statis)');
cek('candle `simulated` ditolak sebelum dihitung', /res\.value\.simulated === true\) return \[\]/.test(SRC));
cek('kegagalan total TIDAK digambar sebagai 0,00', /terbaca\.length < 2/.test(SRC) && /Matriks sengaja dikosongkan/.test(SRC));
cek('sel tanpa data bernilai null, bukan 0', /aligned\[i\]\.length === 0 \|\| aligned\[j\]\.length === 0\) return null/.test(SRC));
cek('pasangan tanpa data tidak masuk peringkat "Korelasi Tertinggi"', /if \(matrix\[i\]\[j\] === null\) continue/.test(SRC));

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
