/**
 * Setiap data-qi-aksi harus memanggil fungsinya dengan argumen yang benar.
 *
 * qim-aksi.js punya DUA cara memanggil:
 *   · aksi terdaftar (QIAksi.daftar)  → fn(el, e, ...arg)
 *   · fungsi window biasa             → fn(...arg)          ← TANPA el dan e
 *
 * Fungsi window yang ditulis dengan tanda tangan (el, e, ...) tetapi tidak didaftarkan
 * menerima argumennya bergeser dua posisi. Itulah yang membuat tombol SELL Quick Trade
 * mengirim order BUY (2026-10-22): qtOrder('SELL') → el = 'SELL', arah = undefined.
 * Uji unit lama memanggil qtOrder(null, null, 'SELL') langsung, jadi tetap hijau.
 *
 * Uji ini memindai SEMUA halaman .html dan assets/js/*.js, dan gagal bila:
 *   1. aksi dipakai tetapi tidak ada sebagai aksi terdaftar maupun fungsi bernama, atau
 *   2. aksi berupa fungsi window yang parameternya diawali (el, e) / (el, ...) tanpa didaftarkan.
 *
 * Run:  node tests/aksi-tanda-tangan.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const daftarBerkas = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => path.join(root, f)),
  ...fs.readdirSync(path.join(root, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => path.join(root, 'assets/js', f)),
];

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '\n      ' + info}`);
  if (!ok) gagal++;
};

/** Kunci tingkat atas dari literal objek yang dimulai di s[buka] === '{'.
 *  String dan komentar dilewati di SEMUA kedalaman supaya '}' di dalamnya tidak mengacaukan hitungan. */
function kunciObjek(s, buka) {
  const kunci = [];
  const BUKAN = ['async', 'function', 'return', 'const', 'let', 'var', 'if', 'for', 'while', 'get', 'set'];
  let dalam = 0, token = '', awalBaris = true;
  const lepasToken = (i) => {
    if (!token) return;
    let j = i; while (/\s/.test(s[j])) j++;
    const nx = s[j];
    // '(' metode · ':' properti · ',' atau '}' shorthand — hanya bila token membuka "baris" properti.
    if (dalam === 1 && awalBaris && (nx === '(' || nx === ':' || nx === ',' || nx === '}') && !BUKAN.includes(token)) kunci.push(token);
    if (dalam === 1 && !BUKAN.includes(token)) awalBaris = false;
    token = '';
  };
  for (let i = buka; i < s.length; i++) {
    const c = s[i];
    if (/[\w$]/.test(c)) { token += c; continue; }
    lepasToken(i);
    if (c === '/' && s[i + 1] === '/') { const n = s.indexOf('\n', i); i = n < 0 ? s.length : n - 1; continue; }
    if (c === '/' && s[i + 1] === '*') { const n = s.indexOf('*/', i + 2); i = n < 0 ? s.length : n + 1; continue; }
    if (c === '/') {
      // Literal regex (mis. /"/g) — tanda kutip di dalamnya bukan awal string.
      let k = i - 1; while (k > buka && /\s/.test(s[k])) k--;
      if (/[(,=:[!&|?{};+]/.test(s[k])) {
        let j = i + 1, kelas = false;
        while (j < s.length && s[j] !== '\n' && (s[j] !== '/' || kelas)) { if (s[j] === '\\') j++; else if (s[j] === '[') kelas = true; else if (s[j] === ']') kelas = false; j++; }
        i = j; continue;
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1; while (j < s.length && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      i = j; if (dalam === 1) awalBaris = false; continue;
    }
    if (c === '{' || c === '(' || c === '[') { dalam++; if (dalam === 1) awalBaris = true; continue; }
    if (c === '}' || c === ')' || c === ']') { dalam--; if (dalam === 0) break; continue; }
    if (dalam === 1 && c === ',') awalBaris = true;
  }
  return kunci;
}

const dipakai = new Map();          // nama aksi → Set berkas
const terdaftar = new Set(['hentikan', 'alihKelas', 'tambahKelas', 'klikElemen', 'fokus', 'hapusElemen', 'hapusTerdekat', 'bukaUrl']);
const deklarasi = new Map();        // nama fungsi → { param, berkas }
const metodeObjek = new Set();      // "Objek.metode" yang ada

for (const f of daftarBerkas) {
  const s = fs.readFileSync(f, 'utf8');
  const b = path.basename(f);
  for (const m of s.matchAll(/data-qi-aksi(?:-(?:change|input|submit|keydown))?=["']([A-Za-z_$][\w$.]*)["']/g)) {
    if (!dipakai.has(m[1])) dipakai.set(m[1], new Set());
    dipakai.get(m[1]).add(b);
  }
  for (const m of s.matchAll(/QIAksi\.daftar\(\s*\{/g)) {
    for (const k of kunciObjek(s, s.indexOf('{', m.index))) terdaftar.add(k);
  }
  for (const m of s.matchAll(/(?:^|[\n;{}])\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) {
    if (!deklarasi.has(m[1])) deklarasi.set(m[1], { param: m[2].split(',').map((x) => x.trim().replace(/=.*/, '')).filter(Boolean), berkas: b });
  }
  for (const m of s.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*[\w$]*\s*)?\(([^)]*)\)/g)) {
    if (!deklarasi.has(m[1])) deklarasi.set(m[1], { param: m[2].split(',').map((x) => x.trim().replace(/=.*/, '')).filter(Boolean), berkas: b });
  }
  // const Objek = { metode(...) } / window.Objek = Objek → metode objek untuk aksi bertitik.
  for (const m of s.matchAll(/(?:(?:const|let|var)\s+|window\.)([A-Z][\w$]*)\s*=\s*\{/g)) {
    for (const k of kunciObjek(s, s.indexOf('{', m.index))) metodeObjek.add(m[1] + '.' + k);
  }
}

console.log('Aksi data-qi-aksi: ' + dipakai.size + ' nama dipakai, ' + terdaftar.size + ' terdaftar');

const tidakAda = [];
const bergeser = [];
for (const [nama, tempat] of dipakai) {
  if (terdaftar.has(nama)) continue;
  if (nama.includes('.')) {
    if (!metodeObjek.has(nama)) tidakAda.push(nama + '  ← ' + [...tempat].join(', '));
    continue;
  }
  const d = deklarasi.get(nama);
  if (!d) { tidakAda.push(nama + '  ← ' + [...tempat].join(', ')); continue; }
  const [p0 = '', p1 = ''] = d.param;
  if (p0 === 'el' || (/^(e|_el|elemen|btn|tombol)$/.test(p0) && /^(e|ev|evt|event|_e)$/.test(p1))) {
    bergeser.push(`${nama}(${d.param.join(', ')}) di ${d.berkas}, dipakai di ${[...tempat].join(', ')}`);
  }
}

cek('setiap aksi bisa ditemukan (terdaftar, fungsi bernama, atau metode objek)', tidakAda.length === 0, tidakAda.join('\n      '));
cek('tidak ada fungsi window bertanda tangan (el, e, …) yang lupa didaftarkan', bergeser.length === 0, bergeser.join('\n      '));
cek('aksi Quick Trade terdaftar', ['qtSetAkun', 'qtOrder', 'qtStep'].every((n) => terdaftar.has(n)));
// Ambang ini hanya penjaga agar pemindaian yang rusak tidak lolos sebagai "semua aman".
// Turun dari 50 ke 25 sejak dashboard chart-first: halaman itu kini memakai 9 aksi (jalur
// order) alih-alih ratusan milik panel lama. Yang dijaga tetap sama — setiap aksi yang
// dipakai harus bisa ditemukan (cek di atas), bukan jumlahnya.
cek('pemindai benar-benar menemukan aksi (bukan lolos karena kosong)', dipakai.size > 25 && deklarasi.size > 200, dipakai.size + ' / ' + deklarasi.size);

if (gagal) { console.error(`\nFAIL — ${gagal} pemeriksaan gagal`); process.exit(1); }
console.log('\nPASS — semua data-qi-aksi menerima argumen yang benar');
