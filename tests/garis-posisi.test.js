/**
 * Garis posisi terbuka di chart (entry / SL / TP).
 *
 * Fungsi aslinya diambil dari assets/js/dashboard-app.js lalu dijalankan di sandbox vm
 * dengan seri chart tiruan — jadi yang diuji perilakunya, bukan sekadar ada/tidaknya teks.
 * Pola sandbox ini sama dengan tests/mt5-socket.test.js.
 *
 * Run:  node tests/garis-posisi.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'dashboard-app.js'), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

// ── Ambil blok fungsi garis posisi apa adanya dari berkas sumber ─────────────
const mulai = SRC.indexOf('let _lwPosLines = [];');
const akhir = SRC.indexOf('function ptRender()');
cek('blok garis posisi ditemukan di dashboard-app.js', mulai > 0 && akhir > mulai);
if (mulai < 0 || akhir < mulai) { console.error('\nFAIL'); process.exit(1); }
const BLOK = SRC.slice(mulai, akhir);

function buatSandbox(posisi, tvSymbol) {
  const dibuat = [];
  const seri = {
    createPriceLine(opt) { const pl = { ...opt, _hidup: true }; dibuat.push(pl); return pl; },
    removePriceLine(pl) { pl._hidup = false; },
  };
  const ctx = {
    _lwSeries: seri,
    _ptPositions: posisi,
    _tvSymbol: tvSymbol,
    DP: { XAUUSD: 2, EURUSD: 5 },
    WL_GROUPS: [{ syms: [{ key: 'XAUUSD', tv: 'OANDA:XAUUSD' }, { key: 'EURUSD', tv: 'OANDA:EURUSD' }] }],
    window: { addEventListener() {} },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(BLOK, ctx);
  return { ctx, dibuat, hidup: () => dibuat.filter(p => p._hidup) };
}

const POSISI = [
  { symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4123.79, sl: 4100.5, tp: 4160.25 },
  { symbol: 'EURUSD', side: 'SELL', lots: 0.5, entryPrice: 1.1093, sl: 1.1150, tp: 1.1000 },
];

console.log('Menggambar garis untuk simbol yang sedang tampil');
{
  const s = buatSandbox(POSISI, 'OANDA:XAUUSD');
  s.ctx.qiGambarGarisPosisi();
  const g = s.hidup();
  cek('3 garis untuk 1 posisi (entry + SL + TP)', g.length === 3, g.length);
  cek('posisi simbol lain TIDAK ikut digambar', !g.some(l => String(l.title).includes('1.10')));
  const entry = g.find(l => String(l.title).startsWith('BUY'));
  cek('judul entry memuat arah, lot, dan harga', !!entry && entry.title === 'BUY 0.10 @ 4123.79', entry && entry.title);
  cek('garis entry lebih tebal dari SL/TP', !!entry && entry.lineWidth === 2);
  cek('entry BUY berwarna hijau', !!entry && entry.color === '#00E676');
  const sl = g.find(l => String(l.title).startsWith('SL'));
  const tp = g.find(l => String(l.title).startsWith('TP'));
  cek('SL digambar merah putus-putus', !!sl && sl.color === '#FF5252' && sl.lineStyle === 2);
  cek('TP digambar hijau putus-putus', !!tp && tp.color === '#00E676' && tp.lineStyle === 2);
  cek('harga dibulatkan sesuai desimal simbol (XAUUSD = 2)', !!sl && sl.title === 'SL 4100.50', sl && sl.title);
}

console.log('\nArah SELL');
{
  const s = buatSandbox(POSISI, 'OANDA:EURUSD');
  s.ctx.qiGambarGarisPosisi();
  const entry = s.hidup().find(l => String(l.title).startsWith('SELL'));
  cek('entry SELL berwarna merah', !!entry && entry.color === '#FF5252');
  cek('EURUSD memakai 5 desimal', !!entry && entry.title === 'SELL 0.50 @ 1.10930', entry && entry.title);
}

console.log('\nPosisi tanpa SL/TP');
{
  const s = buatSandbox([{ symbol: 'XAUUSD', side: 'BUY', lots: 0.02, entryPrice: 4000, sl: null, tp: null }], 'OANDA:XAUUSD');
  s.ctx.qiGambarGarisPosisi();
  cek('hanya garis entry yang digambar', s.hidup().length === 1, s.hidup().length);
}

console.log('\nNilai tidak masuk akal diabaikan');
{
  const s = buatSandbox([
    { symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: NaN, sl: 1, tp: 2 },
    { symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4000, sl: 0, tp: -5 },
  ], 'OANDA:XAUUSD');
  s.ctx.qiGambarGarisPosisi();
  const g = s.hidup();
  cek('entry NaN → posisi dilewati seluruhnya', !g.some(l => String(l.title).includes('NaN')));
  cek('SL 0 dan TP negatif tidak digambar', g.length === 1, g.map(l => l.title));
}

console.log('\nMenggambar ulang tidak menumpuk garis');
{
  const s = buatSandbox(POSISI, 'OANDA:XAUUSD');
  s.ctx.qiGambarGarisPosisi();
  s.ctx.qiGambarGarisPosisi();
  s.ctx.qiGambarGarisPosisi();
  cek('tetap 3 garis hidup setelah 3× gambar', s.hidup().length === 3, s.hidup().length);
  cek('garis lama benar-benar dihapus dari seri', s.dibuat.length === 9 && s.dibuat.filter(p => !p._hidup).length === 6);
}

console.log('\nTanpa chart / tanpa posisi');
{
  const s = buatSandbox([], 'OANDA:XAUUSD');
  s.ctx.qiGambarGarisPosisi();
  cek('tidak ada posisi → tidak ada garis', s.hidup().length === 0);
  const t = buatSandbox(POSISI, 'OANDA:XAUUSD');
  t.ctx._lwSeries = null;
  cek('seri chart belum siap → tidak melempar galat', (() => { try { t.ctx.qiGambarGarisPosisi(); return true; } catch (e) { return false; } })());
  const u = buatSandbox(POSISI, 'SIMBOL:TIDAK_DIKENAL');
  u.ctx.qiGambarGarisPosisi();
  cek('simbol chart tidak dikenal → tidak ada garis', u.hidup().length === 0);
}

// ── Kontrak sambungan ke sisa aplikasi ───────────────────────────────────────
console.log('\nSambungan');
cek('ptRender() menggambar ulang garis posisi', /try \{ qiGambarGarisPosisi\(\); \} catch \(e\) \{\}\s*\}/.test(SRC));
cek('ganti simbol/timeframe memicu gambar ulang', /addEventListener\('qi-chart-data', \(\) => \{ try \{ qiGambarGarisPosisi\(\); \}/.test(SRC));
cek('garis posisi terpisah dari garis indikator', /_lwPosLines/.test(SRC) && !/_lwPriceLines\.push\(_lwSeries\.createPriceLine\(\{ price: n,/.test(SRC));

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — garis entry/SL/TP posisi di chart');
process.exit(gagal ? 1 : 0);
