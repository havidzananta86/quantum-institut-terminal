// Bundel JS dashboard (npm run build:js → tools/bundel-js.mjs): halaman memuat bundel yang ADA dan MUTAKHIR.
// Tanpa esbuild: kesegaran dicek lewat sha file sumber di assets/dist/manifest.json, jadi uji ini juga
// menangkap "file di assets/js/ diubah tapi build lupa dijalankan" — perubahan yang tidak akan tampil di situs.
// (CI menambah cek penuh: build ulang dengan esbuild lalu bandingkan, lihat .github/workflows/ci.yml.)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ada = f => fs.existsSync(path.join(root, f));
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : ' — ' + JSON.stringify(info))); if (!kondisi) gagal++; }

const konf = JSON.parse(read('assets/js/bundel.json'));
const html = read('dashboard.html');
const man = ada('assets/dist/manifest.json') ? JSON.parse(read('assets/dist/manifest.json')) : null;

console.log('Konfigurasi');
const semua = [...konf.bundel.flatMap(b => b.file), ...Object.values(konf.lazy).flat()];
cek('semua file di bundel.json ada', semua.every(f => ada('assets/js/' + f)), semua.filter(f => !ada('assets/js/' + f)));
cek('tidak ada file terdaftar dua kali', new Set(semua).size === semua.length);
cek('pemuat lazy (qim-muat-fitur.js) ikut bundel awal', konf.bundel.some(b => b.file.includes('qim-muat-fitur.js')));

console.log('Manifest & kesegaran');
cek('assets/dist/manifest.json ada', !!man);
if (man) {
    const basi = [];
    for (const [nama, b] of [...Object.entries(man.bundel), ...Object.entries(man.lazy).map(([n, b]) => ['lazy-' + n, b])]) {
        for (const [f, h] of Object.entries(b.sumber)) {
            if (!ada('assets/js/' + f) || sha(read('assets/js/' + f).replace(/\r\n/g, '\n')).slice(0, 16) !== h) basi.push(nama + ':' + f);
        }
    }
    cek('bundel mutakhir terhadap assets/js/ (bila gagal: npm run build:js lalu commit)', basi.length === 0, basi);
    const daftar = b => Object.keys(b.sumber).join(',');
    cek('isi & urutan bundel sama dengan bundel.json', konf.bundel.every(b => man.bundel[b.nama] && daftar(man.bundel[b.nama]) === b.file.join(','))
        && Object.entries(konf.lazy).every(([n, f]) => man.lazy[n] && daftar(man.lazy[n]) === f.join(',')));

    const fileDist = [...Object.values(man.bundel), ...Object.values(man.lazy)].map(b => b.file);
    cek('semua file bundel (+ source map) ada', fileDist.every(f => ada(f) && ada(f + '.map')), fileDist.filter(f => !ada(f)));
    cek('hash di nama file = hash isi (aman di-cache immutable)', fileDist.every(f => {
        const isi = read(f).replace(/\/\/# sourceMappingURL=[^\n]*\n$/, '');
        return path.basename(f).split('.')[1] === sha(isi).slice(0, 10);
    }));

    console.log('Halaman');
    // Kecuali modul ES (type="module", halaman-dashboard-lw.js) yang sengaja tidak dibundel.
    cek('tidak ada lagi <script src="assets/js/…"> klasik di dashboard.html (semua lewat bundel)',
        ![...html.matchAll(/<script[^>]*src="assets\/js\/[^>]*>/g)].some(m => !/type="module"/.test(m[0])));
    for (const b of konf.bundel) {
        const m = html.match(new RegExp(`<!-- bundel:${b.nama} ·[^>]*-->\\s*<script src="([^"]+)"( defer)?></script>\\s*<!-- /bundel:${b.nama} -->`));
        cek(`bundel "${b.nama}" dimuat dari ${man.bundel[b.nama].file}${b.muat === 'defer' ? ' dengan defer' : ' (sinkron)'}`,
            !!m && m[1] === man.bundel[b.nama].file && !!m[2] === (b.muat === 'defer'));
    }
    const pos = n => html.indexOf(`<!-- bundel:${n} ·`);
    cek('urutan bundel di halaman = urutan bundel.json', konf.bundel.every((b, i) => i === 0 || pos(konf.bundel[i - 1].nama) < pos(b.nama)));
    const fitur = konf.bundel.find(b => b.file.includes('qim-muat-fitur.js'));
    const peta = (read(man.bundel[fitur.nama].file).match(/window\.QIM_FITUR_LAZY=(\{.*?\});/) || [])[1];
    cek('peta bundel lazy tertanam & menunjuk file yang ada', !!peta && Object.entries(JSON.parse(peta)).every(([n, v]) => v.url === man.lazy[n].file));

    console.log('Service Worker');
    const sw = read('sw.js');
    cek('CACHE_NAME & STATIC_CACHE mengikuti hash build', sw.includes(`const CACHE_NAME = 'quantum-terminal-${man.versi}';`) && sw.includes(`const STATIC_CACHE = 'quantum-static-${man.versi}';`));
    cek('URL registrasi sw.js?v= = hash build di halaman-dashboard.js (ikut bundel) & halaman-index.js',
        ['assets/js/halaman-dashboard.js', 'assets/js/halaman-index.js'].every(f => read(f).includes(`register('sw.js?v=${man.versi}'`))
        && read(man.bundel[konf.bundel.find(b => b.file.includes('halaman-dashboard.js')).nama].file).includes(`sw.js?v=${man.versi}`));
    const hi = sha(read('assets/js/halaman-index.js').replace(/\r\n/g, '\n')).slice(0, 10);
    cek('index.html memuat halaman-index.js?v=<hash isi> (file .js di-cache 30 hari)', read('index.html').includes('src="assets/js/halaman-index.js?v=' + hi + '"'));
    cek('bundel awal ikut di-precache Service Worker', Object.values(man.bundel).every(b => sw.includes(`'${b.file}',`)));

    // CSS di-cache "immutable" 30 hari oleh .htaccess. Bila ?v= tidak ikut berubah saat
    // berkasnya diedit, perubahan gaya TIDAK PERNAH sampai ke pengunjung lama — pernah
    // terjadi 2026-10-21 (kartu Quick Trade tayang tanpa gaya). 'npm run build:js'
    // menstempel ?v= dengan hash isi; di sini dipastikan stempelnya masih cocok.
    console.log('Stempel versi CSS');
    for (const halaman of ['dashboard.html', 'index.html']) {
        const isi = read(halaman);
        const tautan = [...isi.matchAll(/href="(assets\/css\/[A-Za-z0-9._-]+\.css)\?v=([^"]*)"/g)];
        cek(`${halaman}: ada <link> CSS ber-?v=`, tautan.length > 0, tautan.length);
        const basi = tautan.filter(([, rel, v]) => v !== sha(read(rel).replace(/\r\n/g, '\n')).slice(0, 10))
            .map(([, rel, v]) => `${rel}?v=${v}`);
        cek(`${halaman}: ${tautan.length} berkas CSS, semua ?v= = hash isinya`, basi.length === 0, basi);
    }
}

console.log(gagal ? `FAIL — ${gagal} pemeriksaan gagal` : 'PASS — bundel JS');
process.exit(gagal ? 1 : 0);
