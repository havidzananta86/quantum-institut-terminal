// Chart harus BERSIH saat awal masuk: tidak ada indikator, panel RSI, atau panel volume
// sebelum pengguna menyalakan tombolnya (kontrak statis terhadap dashboard.html dan dashboard-app.js).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'assets/js/dashboard-app.js'), 'utf8');

let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }

const tombol = [...html.matchAll(/<button id="(ind[A-Za-z0-9]+)"\s+data-on="([a-z]+)"/g)];
const ids = tombol.map(m => m[1]);
for (const id of ['indEMA20', 'indEMA50', 'indEMA200', 'indBB', 'indIchi', 'indSR', 'indFib', 'indGX', 'indSND', 'indVP', 'indRSI', 'indVOL', 'indPSAR', 'indKC', 'indST', 'indLIQ', 'indCDL']) {
    cek(`tombol ${id} ada`, ids.includes(id));
}
cek('semua tombol indikator bawaan MATI (data-on="false")', tombol.length > 0 && tombol.every(m => m[2] === 'false'));
cek('indikator tidak aktif saat awal (_indicatorsEnabled = false)', /let _indicatorsEnabled = false;/.test(js));
cek('Bollinger hanya digambar bila tombolnya menyala', /if \(_getIndSetting\('indBB'\)\) \{\s*const bb = _calcBollingerBands/.test(js));
cek('panel RSI & volume tidak dibuat tanpa tombol menyala', /if \(_indAktif\('indVOL'\)\) qiPanelVolume\(true\);/.test(js) && /if \(_indAktif\('indRSI'\)\) qiPanelRsi\(true\);/.test(js));
cek('buildLwChart tidak lagi membuat RSI/volume tanpa syarat', !/_lwRsi = _lwChart\.addSeries\(LineSeries, \{\s*color: '#b56cff',[\s\S]{0,400}\}, 2\);/.test(js));

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — chart bersih saat awal masuk');
