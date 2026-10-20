#!/usr/bin/env node
/**
 * BUNDEL JS DASHBOARD — npm run build:js   (cek saja tanpa menulis: npm run build:js -- --cek)
 *
 * Menggabung + minify skrip dashboard.html sesuai assets/js/bundel.json ke assets/dist/<nama>.<hash>.js
 * (hash isi di nama file → aman di-cache "immutable" 30 hari seperti yang dikirim .htaccess), lalu:
 *  - menulis tag <script> di antara penanda <!-- bundel:NAMA --> … <!-- /bundel:NAMA --> di dashboard.html;
 *  - menulis peta bundel lazy ke dalam bundel yang memuat qim-muat-fitur.js (window.QIM_FITUR_LAZY);
 *  - menyamakan versi Service Worker dengan hash build: CACHE_NAME/STATIC_CACHE di sw.js dan
 *    URL registrasi sw.js?v=… di assets/js/halaman-dashboard.js (ikut bundel) & assets/js/halaman-index.js (+ ?v= file itu di index.html) — sw.js di-cache 30 hari oleh hosting,
 *    jadi hanya URL baru yang memaksa peramban mengambil SW baru);
 *  - menulis assets/dist/manifest.json (sha tiap file sumber → uji Node bisa mendeteksi bundel basi tanpa esbuild).
 *
 * Bukan ES module dan tidak dibungkus fungsi: file-file ini skrip klasik yang berbagi global (var/function/let/const
 * di level atas). Supaya penggabungan TERBUKTI tidak mengubah perilaku, build gagal bila:
 *  - ada directive 'use strict' di level atas file (akan hilang di tengah bundel);
 *  - dua file dalam satu bundel mendeklarasikan nama level atas yang sama (deklarasi terakhir menang sejak awal);
 *  - file yang punya deklarasi level atas disebut oleh file SEBELUMNYA di bundel yang sama (hoisting/TDZ akan
 *    mengubah apa yang dilihat file sebelumnya);
 *  - minify mengubah daftar deklarasi level atas.
 * File tanpa deklarasi level atas (hanya IIFE) dibungkus try/catch: galat saat dimuat tetap dilaporkan
 * (dilempar ulang lewat setTimeout → window.onerror / error-tracker.js) dan TIDAK menghentikan file berikutnya,
 * sama seperti saat masing-masing masih <script> sendiri.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUMBER = 'assets/js', DIST = 'assets/dist';
const CEK = process.argv.includes('--cek');
const HALAMAN = 'dashboard.html';
// Tempat navigator.serviceWorker.register('sw.js?v=…'); `dimuat` = halaman yang memuat file .js itu.
const HALAMAN_SW = [{ file: 'assets/js/halaman-dashboard.js' }, { file: 'assets/js/halaman-index.js', dimuat: 'index.html' }];

const p = rel => path.join(ROOT, rel);
const baca = rel => fs.readFileSync(p(rel), 'utf8').replace(/\r\n/g, '\n');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const gagal = pesan => { console.error('build:js GAGAL — ' + pesan); process.exit(1); };

// ── Analisa level atas ──────────────────────────────────────────────────────
function analisa(kode, nama) {
    let ast;
    try { ast = acorn.parse(kode, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); }
    catch (e) { gagal(`${nama}: tidak bisa di-parse sebagai skrip klasik (${e.message})`); }
    const deklarasi = [];
    let ketat = false, hanyaEkspresi = true;
    for (const s of ast.body) {
        if (s.directive) { if (s.directive === 'use strict') ketat = true; continue; }
        if (s.type === 'VariableDeclaration') {
            for (const d of s.declarations) {
                if (d.id.type !== 'Identifier') gagal(`${nama}: destrukturisasi di level atas tidak didukung pemeriksa`);
                deklarasi.push(s.kind + ' ' + d.id.name);
            }
        } else if (s.type === 'FunctionDeclaration') deklarasi.push('function ' + s.id.name);
        else if (s.type === 'ClassDeclaration') deklarasi.push('class ' + s.id.name);
        if (s.type !== 'ExpressionStatement') hanyaEkspresi = false;
    }
    return { deklarasi, ketat, hanyaEkspresi };
}
const namaDari = d => d.split(' ')[1];
const sebutan = n => new RegExp('(^|[^\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])');

// `mini` = hasil minify: komentar sudah hilang dan variabel lokal sudah berganti nama, jadi nama yang
// tersisa hanyalah global/properti — pencarian sebutan tidak tertipu komentar atau variabel lokal senama.
function periksaBundel(nama, file, mini, info) {
    const pemilik = new Map();
    file.forEach((f, k) => {
        if (info[f].ketat) gagal(`${f}: directive 'use strict' di level atas akan hilang saat digabung — bungkus isinya dengan IIFE ber-'use strict'`);
        for (const d of info[f].deklarasi) {
            const n = namaDari(d);
            if (pemilik.has(n)) gagal(`bundel "${nama}": '${n}' dideklarasikan di ${pemilik.get(n)} DAN ${f} — pisahkan ke bundel lain atau ganti nama`);
            pemilik.set(n, f);
            const re = sebutan(n);
            for (const sebelum of file.slice(0, k)) {
                if (re.test(mini[sebelum])) gagal(`bundel "${nama}": ${sebelum} menyebut '${n}' yang dideklarasikan ${f} sesudahnya — dalam satu skrip deklarasi itu ter-hoist; mulai bundel baru di ${f}`);
            }
        }
    });
}

// ── Minify per file (nama level atas TIDAK diganti esbuild untuk skrip non-modul) ───────────
async function minify(f, kode, info) {
    const r = await esbuild.transform(kode, {
        loader: 'js', minify: true, charset: 'utf8', sourcemap: 'external', sourcesContent: false, sourcefile: `../js/${f}`,
    });
    const sesudah = analisa(r.code, f + ' (hasil minify)');
    const a = [...info.deklarasi].sort().join(','), b = [...sesudah.deklarasi].sort().join(',');
    if (a !== b) gagal(`${f}: minify mengubah deklarasi level atas`);
    if (info.hanyaEkspresi && !sesudah.hanyaEkspresi) gagal(`${f}: hasil minify bukan lagi hanya ekspresi`);
    return { kode: r.code.endsWith('\n') ? r.code : r.code + '\n', peta: JSON.parse(r.map) };
}

// ── Rakit satu bundel + source map indeks (Source Map v3 "sections") ────────────────────────
function rakit(nama, bagian) {
    let teks = '', baris = 0;
    const seksi = [];
    const tambah = s => { teks += s; baris += (s.match(/\n/g) || []).length; };
    for (const b of bagian) {
        if (b.bungkus) tambah('try{\n');
        if (b.peta) seksi.push({ offset: { line: baris, column: 0 }, map: b.peta });
        tambah(b.kode);
        if (b.bungkus) tambah('}catch(e){setTimeout(function(){throw e})}\n');
    }
    const file = `${nama}.${sha(teks).slice(0, 10)}.js`;
    teks += `//# sourceMappingURL=${file}.map\n`;
    return { file, kode: teks, peta: JSON.stringify({ version: 3, file, sections: seksi }) + '\n' };
}

async function bangun(nama, file, sumber, info, sisipan) {
    const m = {};
    for (const f of file) m[f] = await minify(f, sumber[f], info[f]);
    periksaBundel(nama, file, Object.fromEntries(file.map(f => [f, m[f].kode])), info);
    const bagian = [];
    for (const f of file) {
        if (sisipan && sisipan[f]) bagian.push({ kode: sisipan[f], peta: null, bungkus: false });
        bagian.push({ ...m[f], bungkus: info[f].deklarasi.length === 0 });
    }
    return rakit(nama, bagian);
}

// ── Utama ───────────────────────────────────────────────────────────────────
const konf = JSON.parse(baca(`${SUMBER}/bundel.json`));
const semua = [...konf.bundel.flatMap(b => b.file), ...Object.values(konf.lazy).flat()];
const ganda = semua.filter((f, i) => semua.indexOf(f) !== i);
if (ganda.length) gagal('file terdaftar lebih dari sekali di bundel.json: ' + ganda.join(', '));
const sumber = {}, info = {};
for (const f of semua) {
    if (!fs.existsSync(p(`${SUMBER}/${f}`))) gagal(`${SUMBER}/${f} tidak ada (bundel.json)`);
    sumber[f] = baca(`${SUMBER}/${f}`);
    info[f] = analisa(sumber[f], f);
}

const keluaran = {};          // path relatif → isi
const manifest = { esbuild: esbuild.version, bundel: {}, lazy: {} };
const sumberSha = file => Object.fromEntries(file.map(f => [f, sha(sumber[f]).slice(0, 16)]));

// Versi build = hash MASUKAN (bukan keluaran): registrasi SW ada di file yang ikut dibundel
// (halaman-dashboard.js), jadi hash keluaran akan melingkar. URL sw.js?v= dinetralkan dulu.
const SW_RE = /serviceWorker\.register\('sw\.js\?v=[^']*'/g;
const netral = s => s.replace(SW_RE, "serviceWorker.register('sw.js?v='");
const versi = sha(JSON.stringify({
    esbuild: esbuild.version, konf, skrip: sha(baca('tools/bundel-js.mjs')),
    sumber: semua.map(f => [f, sha(netral(sumber[f]))]),
})).slice(0, 10);
manifest.versi = versi;

for (const { file: rel, dimuat } of HALAMAN_SW) {
    ubahTeks(rel, teks => {
        if (!new RegExp(SW_RE.source).test(teks)) gagal(`${rel}: registrasi 'sw.js?v=…' tidak ditemukan`);
        return teks.replace(SW_RE, `serviceWorker.register('sw.js?v=${versi}'`);
    });
    const nama = rel.slice(SUMBER.length + 1);
    if (rel.startsWith(SUMBER + '/') && nama in sumber) sumber[nama] = keluaran[rel].replace(/\r\n/g, '\n');   // ikut dibundel
    // File .js yang dimuat langsung (di-cache 30 hari) → query ?v= pemuatnya ikut hash isi file itu.
    if (dimuat) {
        const v = sha(keluaran[rel].replace(/\r\n/g, '\n')).slice(0, 10), re = new RegExp(`(src="${rel.replace(/[.]/g, '\\.')})\\?v=[^"]*"`);
        ubahTeks(dimuat, html => {
            if (!re.test(html)) gagal(`${dimuat}: <script src="${rel}?v=…"> tidak ditemukan`);
            return html.replace(re, `$1?v=${v}"`);
        });
    }
}

// CSS yang dimuat langsung di-cache "immutable" 30 hari oleh .htaccess, persis seperti
// bundel JS. Tanpa stempel isi, mengedit CSS TIDAK PERNAH sampai ke pengunjung lama —
// browser tidak akan memeriksa ulang sampai cache kedaluwarsa, bahkan setelah deploy.
// Terbukti 2026-10-21: kartu Quick Trade tayang tanpa gaya sama sekali karena
// assets/css/qim-dashboard.css berubah sementara ?v= di dashboard.html tetap 1.2.6.
// Sekarang ?v= setiap <link> CSS = hash isi berkasnya, jadi tidak ada lagi yang perlu
// diingat manusia. Cakupannya dua halaman yang memang dikelola build ini.
const HALAMAN_CSS = ['dashboard.html', 'index.html'];
const CSS_RE = /href="(assets\/css\/[A-Za-z0-9._-]+\.css)\?v=[^"]*"/g;
for (const halaman of HALAMAN_CSS) {
    ubahTeks(halaman, html => {
        if (!CSS_RE.test(html)) gagal(`${halaman}: <link href="assets/css/….css?v=…"> tidak ditemukan`);
        CSS_RE.lastIndex = 0;
        return html.replace(CSS_RE, (_, rel) => {
            if (!fs.existsSync(p(rel))) gagal(`${halaman}: ${rel} dirujuk tetapi tidak ada`);
            return `href="${rel}?v=${sha(baca(rel)).slice(0, 10)}"`;
        });
    });
}

const petaLazy = {};
for (const [nama, file] of Object.entries(konf.lazy)) {
    const b = await bangun('lazy-' + nama, file, sumber, info);
    keluaran[`${DIST}/${b.file}`] = b.kode;
    keluaran[`${DIST}/${b.file}.map`] = b.peta;
    petaLazy[nama] = { url: `${DIST}/${b.file}`, sumber: file.map(f => `${SUMBER}/${f}`) };
    manifest.lazy[nama] = { file: `${DIST}/${b.file}`, sumber: sumberSha(file) };
}
const PEMUAT = 'qim-muat-fitur.js';
if (Object.keys(petaLazy).length && !konf.bundel.some(b => b.file.includes(PEMUAT))) gagal(`ada bundel lazy tetapi ${PEMUAT} tidak ada di bundel mana pun`);
const sisipan = { [PEMUAT]: `window.QIM_FITUR_LAZY=${JSON.stringify(petaLazy)};\n` };

const tag = {};
for (const b of konf.bundel) {
    if (!['sinkron', 'defer'].includes(b.muat)) gagal(`bundel "${b.nama}": muat harus "sinkron" atau "defer"`);
    const h = await bangun(b.nama, b.file, sumber, info, sisipan);
    keluaran[`${DIST}/${h.file}`] = h.kode;
    keluaran[`${DIST}/${h.file}.map`] = h.peta;
    manifest.bundel[b.nama] = { file: `${DIST}/${h.file}`, muat: b.muat, sumber: sumberSha(b.file) };
    tag[b.nama] = { src: `${DIST}/${h.file}`, defer: b.muat === 'defer', isi: b.file };
}
keluaran[`${DIST}/manifest.json`] = JSON.stringify(manifest, null, 2) + '\n';

// ── Halaman & Service Worker (akhir baris file dipertahankan: CRLF di Windows, LF di CI) ───
function ubahTeks(rel, fn) {
    const asli = rel in keluaran ? keluaran[rel] : fs.readFileSync(p(rel), 'utf8');
    const eol = asli.includes('\r\n') ? '\r\n' : '\n';
    keluaran[rel] = fn(asli.replace(/\r\n/g, '\n')).replace(/\n/g, eol);
}
ubahTeks(HALAMAN, html => {
    for (const [nama, t] of Object.entries(tag)) {
        const re = new RegExp(`<!-- bundel:${nama}(?= ·| -->)[^>]*-->[\\s\\S]*?<!-- /bundel:${nama} -->`);   // "kepala" ≠ "kepala-awal"
        if (!re.test(html)) gagal(`${HALAMAN}: penanda <!-- bundel:${nama} --> … <!-- /bundel:${nama} --> tidak ditemukan`);
        html = html.replace(re, `<!-- bundel:${nama} · dibuat "npm run build:js" dari assets/js/bundel.json (jangan diedit tangan): ${t.isi.join(', ')} -->\n`
            + `<script src="${t.src}"${t.defer ? ' defer' : ''}></script>\n<!-- /bundel:${nama} -->`);
    }
    return html;
});
ubahTeks('sw.js', sw => {
    if (!/const CACHE_NAME = '[^']*';/.test(sw) || !/const STATIC_CACHE = '[^']*';/.test(sw)) gagal('sw.js: CACHE_NAME / STATIC_CACHE tidak ditemukan');
    if (!/\/\/ bundel:mulai[\s\S]*?\/\/ bundel:akhir/.test(sw)) gagal('sw.js: penanda // bundel:mulai … // bundel:akhir di CORE_ASSETS tidak ditemukan');
    return sw
        .replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'quantum-terminal-${versi}';`)
        .replace(/const STATIC_CACHE = '[^']*';/, `const STATIC_CACHE = 'quantum-static-${versi}';`)
        .replace(/([ \t]*)\/\/ bundel:mulai[^\n]*\n[\s\S]*?\/\/ bundel:akhir/, (_, ind) =>
            `${ind}// bundel:mulai (ditulis npm run build:js)\n` + Object.values(tag).map(t => `${ind}'${t.src}',\n`).join('') + `${ind}// bundel:akhir`);
});

// ── Tulis / cek ─────────────────────────────────────────────────────────────
const lama = fs.existsSync(p(DIST)) ? fs.readdirSync(p(DIST)).map(f => `${DIST}/${f}`) : [];
const basi = lama.filter(f => !(f in keluaran));
const berubah = Object.keys(keluaran).filter(rel => !fs.existsSync(p(rel)) || fs.readFileSync(p(rel), 'utf8') !== keluaran[rel]);
if (CEK) {
    if (berubah.length || basi.length) {
        console.error('build:js BASI — jalankan "npm run build:js" lalu commit hasilnya. Berbeda: ' + [...berubah, ...basi.map(f => f + ' (sisa build lama)')].join(', '));
        process.exit(1);
    }
    console.log(`build:js mutakhir (versi ${versi}).`);
} else {
    fs.mkdirSync(p(DIST), { recursive: true });
    for (const rel of berubah) fs.writeFileSync(p(rel), keluaran[rel]);
    for (const rel of basi) fs.unlinkSync(p(rel));
    const ukuran = Object.entries(keluaran).filter(([rel]) => rel.endsWith('.js'))
        .map(([rel, isi]) => `  ${rel}  ${(Buffer.byteLength(isi) / 1024).toFixed(1)} KB`).join('\n');
    console.log(`build:js selesai (versi ${versi}); ${berubah.length} file ditulis, ${basi.length} sisa build lama dihapus.\n${ukuran}`);
}
