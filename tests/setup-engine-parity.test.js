// Paritas mesin Setup: versi PHP (api/_setup_engine.php, dipakai server) HARUS memberi hasil yang
// sama dengan versi JS (assets/js/qim-setups.js, dipakai dashboard) pada candle yang sama.
// Kasus: skenario buatan + candle nyata (tests/fixtures) pada banyak titik akhir (jendela bergulir).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Q = require('../assets/js/qim-setups.js');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) { console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the parity test.`); process.exit(0); }

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 600))); if (!kondisi) gagal++; }

// ── kasus ─────────────────────────────────────────────────────────────────
const W = 0.2;
function buat(langkah, mulai = 100) {
    const c = []; let prev = mulai, t = 1_700_000_000;
    for (const x of langkah) {
        let o, h, l, cl;
        if (Array.isArray(x)) [o, h, l, cl] = x; else { o = prev; cl = x; h = Math.max(o, cl) + W; l = Math.min(o, cl) - W; }
        c.push({ time: t, open: o, high: h, low: l, close: cl }); prev = cl; t += 3600;
    }
    return c;
}
const datar = n => Array(n).fill(100);
const sintetis = {
    smc: [...datar(50), 101, 101.5, 102, 102.5, 103, 102.5, 102, 101.5, 101, 100.5, 100, 99.5, 99, 98.5, 98, 98.5, 99, 99.5, 100, 100.5, 101, 100.5, 100, 99.5, 99, 98.5, 98, 97.5, 97, 96.5, 96, 97.5, 99.5, 101.5, 103, 104, 105, 106, 105.5, 105, 104.5, 104, 103.5, 103.4],
    ict: [...datar(50), 99.5, 99, 98.5, 98, 98.5, 99, 99.5, 100, 99.5, 99, 98.5, [98.5, 98.7, 97.4, 98.3], 99.3, 100.6, 101.5, 102, 102.5, 102, 101.5, 101, 100.9],
    snd: [...datar(50), 99.5, 99, [99, 99.3, 98.7, 99.05], [99.05, 99.3, 98.8, 98.95], [98.95, 99.25, 98.75, 99.0], [99.0, 101.6, 98.9, 101.5], 102, 102.5, 103, 102.5, 102, 101.5, 101.4],
};
const kasus = Object.entries(sintetis).map(([nama, j]) => ({ nama: 'sintetis-' + nama, presisi: 6, candles: buat(j) }));
const dirFix = path.join(__dirname, 'fixtures');
for (const f of fs.readdirSync(dirFix).filter(x => x.startsWith('candles-'))) {
    const d = JSON.parse(fs.readFileSync(path.join(dirFix, f), 'utf8'));
    for (let akhir = 120; akhir <= d.candles.length; akhir += 24) {
        kasus.push({ nama: `${d.nama}@${akhir}`, presisi: d.presisi, candles: d.candles.slice(0, akhir) });
    }
}

// ── jalankan kedua sisi ───────────────────────────────────────────────────
const berkas = path.join(os.tmpdir(), 'qim-parity-' + process.pid + '.json');
fs.writeFileSync(berkas, JSON.stringify({ cases: kasus }));
const run = spawnSync(PHP, [path.join(__dirname, 'setup-engine-parity.php'), berkas], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.unlinkSync(berkas);
if (run.status !== 0) { console.error(run.stderr || run.stdout); cek('PHP berjalan tanpa galat', false, run.stderr); process.exit(1); }
const php = JSON.parse(run.stdout);

const dekat = (a, b) => (a === null && b === null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)));
function bandingkan(js, ph) {
    if (js.length !== ph.length) return 'jumlah setup berbeda: JS=' + js.length + ' PHP=' + ph.length;
    for (let i = 0; i < js.length; i++) {
        const a = js[i], b = ph[i];
        for (const k of ['metode', 'arah', 'status', 'tersentuh', 'mulai', 'struktur', 'tpLabel']) {
            const x = a[k] === undefined ? null : a[k], y = b[k] === undefined ? null : b[k];
            if (x !== y) return `${k}: JS=${x} PHP=${y}`;
        }
        for (const k of ['entry', 'sl', 'tp', 'rr']) if (!dekat(a[k], b[k])) return `${k}: JS=${a[k]} PHP=${b[k]}`;
        for (const k of ['atas', 'bawah']) if (!dekat(a.zona[k], b.zona[k])) return `zona.${k}: JS=${a.zona[k]} PHP=${b.zona[k]}`;
        if (a.zona.mulai !== b.zona.mulai || a.zona.label !== b.zona.label) return 'zona mulai/label berbeda';
    }
    return null;
}

let total = 0, beda = [], adaSetup = 0, perMetode = { SMC: 0, ICT: 0, FIBO: 0, SND: 0 };
for (const k of kasus) {
    for (const m of ['SMC', 'ICT', 'FIBO', 'SND']) {
        total++;
        const js = Q.deteksi(m, k.candles, { presisi: k.presisi });
        const ph = php[k.nama][m];
        const err = bandingkan(js.setups, ph.setups);
        if (err) beda.push(`${k.nama} ${m}: ${err}`);
        // alasan "tidak ada setup" juga harus sama (kecuali pembulatan angka di dalam teks)
        const norm = s => String(s || '').replace(/-?\d+(\.\d+)?/g, '#');
        if (!err && js.setups.length === 0 && norm(js.catatan) !== norm(ph.catatan)) beda.push(`${k.nama} ${m}: catatan berbeda: JS="${js.catatan}" PHP="${ph.catatan}"`);
        if (js.setups.length) { adaSetup++; perMetode[m]++; }
    }
}
console.log(`Paritas JS ↔ PHP: ${kasus.length} kasus × 4 metode = ${total} perbandingan; ${adaSetup} berisi setup (${JSON.stringify(perMetode)})`);
cek('semua perbandingan identik (arah, status, entry, SL, TP, R:R, zona)', beda.length === 0, beda.slice(0, 5));
cek('cakupan memadai: tiap metode menghasilkan setup pada minimal satu kasus', Object.values(perMetode).every(n => n > 0), perMetode);

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — mesin Setup PHP identik dengan versi JS');
