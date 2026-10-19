// Kontrak CSP: halaman yang SUDAH dibersihkan tidak boleh lagi memuat kode yang butuh 'unsafe-inline' /
// 'unsafe-eval' (script inline, atribut onclick="...", javascript: URL, eval/new Function/setTimeout(string)),
// dan .htaccess tetap memasang CSP ketat mode Report-Only di samping CSP aktif.
// Membersihkan halaman baru: pindahkan kodenya ke assets/js/halaman-<nama>.js, lalu tambahkan ke BERSIH.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300))); if (!kondisi) gagal++; }

const BERSIH = ['index.html', 'login.html', 'register.html', 'pricing.html', 'transparansi.html', 'pwa.html', 'status.html',
  'economic-calendar.html', 'profile.html', 'admin.html', '404.html', 'privacy.html', 'terms.html', 'dashboard.html'];

// <script> tanpa src yang dieksekusi browser (blok data JSON/JSON-LD tidak terkena script-src).
const scriptInline = s => [...s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m => !/\bsrc\s*=/i.test(m[1]) && !/\btype\s*=\s*["']?application\/(ld\+)?json/i.test(m[1]))
  .map(m => m[2].trim().slice(0, 60));
const atributOn = s => [...s.matchAll(/<[a-zA-Z][^>]*?\s(on[a-z]+)\s*=/g)].map(m => m[1]);
const urlJs = s => [...s.matchAll(/\b(href|src|action|formaction)\s*=\s*["']?\s*javascript:/gi)].map(m => m[0]);
// Di .js: potongan HTML ber-handler inline (mis. '<div onclick="...">'), eval, new Function, setTimeout("kode").
// Komentar (blok dan baris-penuh //) diabaikan supaya penjelasan seperti "pengganti onclick=..." tidak terhitung.
const tanpaKomentar = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pelanggaranJs = s => (s = tanpaKomentar(s), [
  ...[...s.matchAll(/\son[a-z]+\s*=\s*\\?["'`]/g)].map(m => 'handler inline: ' + m[0].trim()),
  ...[...s.matchAll(/(^|[^.\w$])eval\s*\(/gm)].map(() => 'eval('),
  // eval tidak langsung: (0, eval)(nama) dan window.eval(...) — sama-sama butuh 'unsafe-eval'.
  ...[...s.matchAll(/,\s*eval\s*\)|\bwindow\.eval\s*\(/g)].map(m => 'eval tidak langsung: ' + m[0]),
  ...[...s.matchAll(/new\s+Function\s*\(/g)].map(() => 'new Function('),
  ...[...s.matchAll(/(^|[^.\w$])set(Timeout|Interval)\s*\(\s*["'`]/gm)].map(m => `set${m[2]}(string)`),
]);
const scriptLokal = s => [...s.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"'?#]+)/gi)].map(m => m[1]).filter(u => !/^(https?:)?\/\//i.test(u));

console.log('Halaman bersih (tanpa kode inline)');
const jsDipakai = new Set();
for (const hal of BERSIH) {
  const s = read(hal);
  cek(`${hal}: tanpa <script> inline`, scriptInline(s).length === 0, scriptInline(s));
  cek(`${hal}: tanpa atribut on*="..."`, atributOn(s).length === 0, atributOn(s));
  cek(`${hal}: tanpa javascript: URL`, urlJs(s).length === 0, urlJs(s));
  const hilang = scriptLokal(s).filter(u => !fs.existsSync(path.join(root, u)));
  cek(`${hal}: semua <script src> lokal ada`, hilang.length === 0, hilang);
  scriptLokal(s).filter(u => !hilang.includes(u)).forEach(u => jsDipakai.add(u));
}

console.log('Skrip yang dimuat halaman bersih');
for (const f of [...jsDipakai].sort()) {
  const p = pelanggaranJs(read(f));
  cek(`${f}: tanpa handler inline / eval / new Function / setTimeout(string)`, p.length === 0, p);
}

// Pengganti onclick="fn(...)" di dashboard: data-qi-aksi="fn" (assets/js/qim-aksi.js). QIAksi mencari nama itu di
// daftar QIAksi.daftar(...) lalu di window — fungsi `let`/`const` level atas TIDAK ada di window, jadi setiap nama
// wajib terbukti: aksi terdaftar, deklarasi `function` level atas, atau `window.nama = ...`.
console.log('Delegasi data-qi-aksi (dashboard)');
{
  const sumber = fs.readdirSync(path.join(root, 'assets/js')).filter(f => f.endsWith('.js')).map(f => read('assets/js/' + f));
  const dipakai = new Set([read('dashboard.html'), ...sumber].flatMap(s => [...s.matchAll(/data-qi-aksi(?:-[a-z]+)?="([A-Za-z_$][\w$.]*)"/g)].map(m => m[1])));
  const ada = new Set();
  for (const s of sumber) {
    for (const m of s.matchAll(/^(?:async\s+)?function\s+([\w$]+)/gm)) ada.add(m[1]);
    for (const m of s.matchAll(/window\.([\w$]+)\s*=/g)) ada.add(m[1]);
  }
  for (const m of read('assets/js/qim-aksi.js').matchAll(/^\s{8}(\w+)\(el, e/gm)) ada.add(m[1]);
  for (const s of sumber) for (const b of s.matchAll(/QIAksi\.daftar\(\{([\s\S]*?)\n\s*\}\);/g))
    for (const m of b[1].matchAll(/^\s*(\w+)(?:\s*:\s*function)?\s*\(/gm)) ada.add(m[1]);
  // loadRealtimeSymbol: dipanggil kartu AI Radar (pro-trading-tools.js) tetapi tidak pernah didefinisikan — sudah
  // begitu sejak sebelum delegasi; QIAksi hanya memberi console.warn alih-alih ReferenceError.
  const DIKENAL_HILANG = new Set(['loadRealtimeSymbol']);
  const hilang = [...dipakai].filter(n => !ada.has(n.split('.')[0]) && !DIKENAL_HILANG.has(n));
  cek(`${dipakai.size} nama data-qi-aksi semuanya bisa dijalankan`, dipakai.size > 100 && hilang.length === 0, hilang);
  // Skrip dashboard dibundel (assets/js/bundel.json, npm run build:js): qim-aksi.js harus ada di bundel
  // yang dimuat di <head>, sebelum bundel lain.
  const bundel = JSON.parse(read('assets/js/bundel.json')).bundel, dash = read('dashboard.html');
  const bAksi = bundel.find(b => b.file.includes('qim-aksi.js'));
  cek('qim-aksi.js dimuat di <head> dashboard (sebelum skrip yang mendaftarkan aksi)',
    !!bAksi && bundel.indexOf(bAksi) === 0 && new RegExp(`<!-- bundel:${bAksi.nama} ·[^>]*-->\\s*<script src="assets/dist/[^"]+"></script>[\\s\\S]*</head>`).test(dash));
}

console.log('Header CSP (.htaccess)');
const ht = read('.htaccess');
const header = nama => { const m = ht.match(new RegExp('^\\s*Header\\s+set\\s+' + nama + '\\s+"([^"]+)"', 'mi')); return m ? m[1] : null; };
const arahan = csp => Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([k, ...v]) => [k, v]));
const aktif = header('Content-Security-Policy'), laporan = header('Content-Security-Policy-Report-Only');
cek('CSP aktif masih terpasang', !!aktif);
cek('CSP Report-Only terpasang', !!laporan);
if (aktif && laporan) {
  const A = arahan(aktif), L = arahan(laporan);
  const scriptSrc = L['script-src'] || [];
  cek("Report-Only: script-src tanpa 'unsafe-inline' dan 'unsafe-eval'", scriptSrc.length > 0 && !scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'unsafe-eval'"), scriptSrc);
  cek('Report-Only: pelanggaran dikirim ke api/csp-report.php', (L['report-uri'] || []).includes('api/csp-report.php'));
  cek("Report-Only: object-src 'none' dan base-uri 'self'", (L['object-src'] || []).join() === "'none'" && (L['base-uri'] || []).join() === "'self'");
  // Domain harus sama dengan CSP aktif; yang beda hanya kata kunci inline/eval/sampel — supaya laporan
  // hanya berisi pelanggaran inline, bukan domain yang lupa disalin.
  const buang = new Set(["'unsafe-inline'", "'unsafe-eval'", "'report-sample'"]);
  const beda = Object.keys(A).filter(k => {
    const a = A[k].filter(x => !(k === 'script-src' && buang.has(x))).join(' ');
    const l = (L[k] || []).filter(x => !buang.has(x) || k !== 'script-src').join(' ');
    return a !== l;
  });
  cek('Report-Only: daftar domain sama dengan CSP aktif', beda.length === 0, beda);
}
cek('api/csp-report.php mencatat disposition dan potongan kode', /'disposition'/.test(read('api/csp-report.php')) && /script-sample/.test(read('api/csp-report.php')));

// Informasi saja: sisa pekerjaan di halaman yang belum dibersihkan.
const sisa = fs.readdirSync(root).filter(f => f.endsWith('.html') && !BERSIH.includes(f))
  .map(f => { const s = read(f); return { f, script: scriptInline(s).length, on: atributOn(s).length }; })
  .filter(x => x.script || x.on);
if (sisa.length) console.log('  ℹ belum dibersihkan: ' + sisa.map(x => `${x.f} (${x.script} script, ${x.on} on*)`).join(', '));

console.log(gagal ? `\nFAIL — ${gagal} kontrak CSP gagal` : '\nPASS — Kontrak CSP terpenuhi');
process.exit(gagal ? 1 : 0);
