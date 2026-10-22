/**
 * RSI(14) — SATU RUMUS DI SELURUH KLIEN (audit sinyal 2026-10-22).
 *
 * Sebelum perbaikan ada empat "RSI 14" berbeda untuk simbol & TF yang sama:
 *  - analyzeCandles (dashboard-app.js): Wilder atas 30 close terakhir saja, dan
 *    `avgLoss === 0 ? 100` juga saat semua perubahan nol;
 *  - panel RSI chart (_calcRSI): Wilder riwayat penuh, tetapi datar → 100;
 *  - Mesin 9 (engine-nine.js): rata-rata sederhana 14 perubahan terakhir (Cutler);
 *  - halaman depan (halaman-index.js): rumus ketiga dari 20 kline.
 * Reproduksi audit: 60 close turun lalu 30 close datar → versi 30-bar = 100 (dihitung suara
 * BULL), Wilder riwayat penuh = 0.
 *
 * Uji ini MENJALANKAN kode aslinya (potongan berkas di sandbox vm) dan membuktikan dengan
 * angka bahwa keempatnya kini memberi hasil yang sama: riwayat penuh, seed SMA 14 perubahan
 * pertama, bar ber-rentang nol dibuang, datar → 50, avgLoss 0 → 100.
 *
 * Run:  node tests/rsi-satu-rumus.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!lulus) gagal++;
};
const potong = (src, dari, sampai) => {
  const a = src.indexOf(dari), b = src.indexOf(sampai, a + 1);
  if (a < 0 || b < 0) throw new Error('potongan tidak ditemukan: ' + dari + ' … ' + sampai);
  return src.slice(a, b);
};

// ── Muat keempat implementasi dari berkas aslinya ───────────────────────────
const app = baca('assets/js/dashboard-app.js');
const idx = baca('assets/js/halaman-index.js');

const ctxE = { window: {}, console, Date, Math, Number, Array, JSON, isNaN, isFinite, parseFloat };
vm.createContext(ctxE);
vm.runInContext(baca('assets/js/engine-nine.js'), ctxE);
const E = ctxE.window.QuantumEngineNine;

const ctxA = { console, Math, Number, Array, isFinite };
vm.createContext(ctxA);
vm.runInContext(
  potong(app, 'function calcEMA(', '// ─── lightweight-charts Chart')
  + '\n' + potong(app, '/** Seri panel RSI chart', 'function _calcBollingerBands(')
  + '\nglobalThis.A = { calcRSI, qiRsiWilderSeri, _calcRSI, analyzeCandles, qiBarDatar };', ctxA);
const A = ctxA.A;

const ctxI = { console, Math, Number, Array, isFinite };
vm.createContext(ctxI);
vm.runInContext(potong(idx, 'function _calcRSI14(', 'async function fetchLiveSignal(') + '\nglobalThis.I = _calcRSI14;', ctxI);
const I = ctxI.I;

// Radar pasar (runRadarScan) DIJALANKAN UTUH dengan fetch tiruan (lihat bagian "Radar" di bawah).
// Dulu radar punya salinan Wilder sendiri atas deret close yang TIDAK membuang bar ber-rentang
// nol, jadi forex/emas yang datar di akhir pekan menampilkan "RSI 14" lain (telaah ulang G3b).
const ctxR = { console, Math, Number, Array, isFinite, parseFloat, Promise, Date, String, Object };
vm.createContext(ctxR);
vm.runInContext(
  potong(app, 'function calcEMA(', '// ─── lightweight-charts Chart')
  + '\n' + potong(app, 'async function runRadarScan(', '// ─── Paper Trading')
  + '\nglobalThis.radar = runRadarScan;', ctxR);
/** Jalankan radar untuk SATU simbol dengan candle tertentu; kembalikan isi sel baris tabelnya. */
async function kolomRadar(candles) {
  const el = { radarScanBody: { innerHTML: '', children: [], querySelector: () => null }, radarStatus: { textContent: '' } };
  Object.assign(ctxR, {
    RADAR_SYMS: ['EURUSD'], SYMBOL_LABELS: { EURUSD: 'EUR/USD' }, _lastPrices: {}, fmt: (s, v) => String(v),
    document: { getElementById: (id) => el[id] || null },
    fetch: async () => ({ json: async () => ({ status: 'success', candles }) }),
  });
  await ctxR.radar();
  const html = el.radarScanBody.innerHTML;
  const sel = html.split('<td').slice(1).map((t) => t.slice(t.indexOf('>') + 1).replace(/<\/td>[\s\S]*$/, '').trim());
  return { rsi: sel[4], sinyal: sel[7], html };
}

cek('engine-nine mengekspor rsiWilder & rsiWilderSeri', !!E && typeof E.rsiWilder === 'function' && typeof E.rsiWilderSeri === 'function');
cek('dashboard-app punya calcRSI, qiRsiWilderSeri, _calcRSI', typeof A.calcRSI === 'function' && typeof A.qiRsiWilderSeri === 'function' && typeof A._calcRSI === 'function');
cek('halaman-index punya _calcRSI14', typeof I === 'function');
if (!E || !A || !I) { console.error('\nFAIL'); process.exit(1); }

/** Keempat jalur untuk satu masukan: [engine, calcRSI, panel (titik terakhir), halaman depan]. */
const semua = (data) => {
  const panel = A._calcRSI(data.map((x) => (typeof x === 'number' ? { time: 0, open: x, high: x + 1, low: x - 1, close: x } : x)), 14);
  return [E.rsiWilder(data, 14), A.calcRSI(data, 14), panel.length ? panel[panel.length - 1].value : null, I(data)];
};
const sama = (xs, tol = 1e-9) => xs.every((v) => (v === null && xs[0] === null) || (v !== null && xs[0] !== null && Math.abs(v - xs[0]) <= tol));
const lilin = (closes, { datar = () => false, lebar = 0.5 } = {}) => closes.map((c, i) => {
  if (datar(i)) return { time: 1e9 + i * 3600, open: c, high: c, low: c, close: c };
  const o = i ? closes[i - 1] : c;
  return { time: 1e9 + i * 3600, open: o, high: Math.max(o, c) + lebar, low: Math.min(o, c) - lebar, close: c };
});

console.log('\nAngka acuan Wilder (data contoh StockCharts/TA-Lib, 33 close)');
{
  const sc = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
    46.00, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13];
  // Nilai TA-Lib (tanpa pembulatan antara). Tabel StockCharts membulatkan rata-rata ke 2 desimal,
  // jadi angkanya beda ±0,07 (70,53 vs 70,46) — yang dikunci di sini adalah rumus tanpa pembulatan.
  const acuan = [70.46, 66.25, 66.48, 69.35, 66.29, 57.92, 62.88, 63.21, 56.01, 62.34, 54.67, 50.39, 40.02, 41.49, 41.90, 45.50, 37.32, 33.09, 37.79];
  const seriE = E.rsiWilderSeri(sc, 14).map((p) => +p.value.toFixed(2));
  const seriA = A.qiRsiWilderSeri(sc, 14).map((p) => +p.value.toFixed(2));
  cek('Mesin 9: 19 nilai RSI = acuan', JSON.stringify(seriE) === JSON.stringify(acuan), seriE);
  cek('dashboard (calc/panel): 19 nilai RSI = acuan', JSON.stringify(seriA) === JSON.stringify(acuan), seriA);
  cek('RSI pertama di bar ke-15 (indeks 14), bukan sebelumnya', E.rsiWilderSeri(sc, 14)[0].i === 14 && A.qiRsiWilderSeri(sc, 14)[0].i === 14);
  cek('halaman depan: nilai terakhir 37,79', +I(sc).toFixed(2) === 37.79, I(sc));
}

console.log('\nReproduksi audit: 60 close turun lalu 30 close datar');
{
  const closes = [...Array.from({ length: 60 }, (_, i) => 100 - i), ...new Array(30).fill(41)];
  // Rumus LAMA analyzeCandles: calcRSI(closes.slice(-30)) dengan `avgLoss === 0 ? 100`.
  const lama = (c) => {
    let g = 0, l = 0;
    for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= 14; l /= 14;
    for (let i = 15; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * 13 + Math.max(0, d)) / 14; l = (l * 13 + Math.max(0, -d)) / 14; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  };
  cek('rumus lama (30 close terakhir) = 100 — inilah galatnya', lama(closes.slice(-30)) === 100);
  const v = semua(closes);
  cek('keempat jalur kini = 0 (Wilder riwayat penuh)', v.every((x) => x === 0), v);
  // Bentuk K3: 30 bar akhir pekan ber-rentang nol → dibuang, tersisa 60 bar turun.
  const k3 = lilin(closes, { datar: (i) => i >= 60 });
  const r = A.analyzeCandles(k3);
  cek('analyzeCandles: RSI 0, bukan 100', !!r && r.rsi === 0, r && r.rsi);
  cek('analyzeCandles: RSI ikut suara BEAR, tidak lagi BULL', !!r && r.bear >= 1 && r.signal !== 'BULLISH', r);
  cek('analyzeCandles menolak candle simulasi', A.analyzeCandles(Object.assign(lilin(closes), { simulated: true })) === null);
}

console.log('\nHarga datar = 50, naik terus = 100, turun terus = 0');
{
  const datar = new Array(40).fill(50);
  cek('datar → 50 di keempat jalur (dulu panel & calcRSI = 100)', semua(datar).every((x) => x === 50), semua(datar));
  cek('naik terus → 100', semua(Array.from({ length: 40 }, (_, i) => 100 + i)).every((x) => x === 100));
  cek('turun terus → 0', semua(Array.from({ length: 40 }, (_, i) => 140 - i)).every((x) => x === 0));
  cek('kurang dari 15 close → tidak ada nilai (null), bukan tebakan 50', semua([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).every((x) => x === null));
  cek('panel RSI dengan data kurang → seri kosong', A._calcRSI(lilin([1, 2, 3]), 14).length === 0);
}

console.log('\nBar ber-rentang nol (open=high=low=close) dibuang');
{
  // 40 bar naik nyata, lalu 20 bar "datar" dari feed kosong di harga 150 (bukan harga pasar),
  // lalu 3 bar nyata melanjutkan 140→142. Tanpa membuang bar datar, loncatan ke 150 dan turun
  // lagi ke 140 tercatat sebagai rugi — padahal pasar hanya naik.
  const closes = [...Array.from({ length: 40 }, (_, i) => 100 + i), ...new Array(20).fill(150), 140, 141, 142];
  const c = lilin(closes, { datar: (i) => i >= 40 && i < 60 });
  const v = [E.rsiWilder(c, 14), A.calcRSI(c, 14), A._calcRSI(c, 14).slice(-1)[0].value, I(c)];
  cek('candle: keempat jalur = 100 (hanya kenaikan nyata)', v.every((x) => x === 100), v);
  const angka = E.rsiWilder(closes, 14);
  cek('deret angka close dipakai apa adanya (tanpa info OHLC) → < 100', angka < 100 && Math.abs(angka - A.calcRSI(closes, 14)) < 1e-9, angka);
  const titik = A._calcRSI(c, 14);
  cek('panel RSI tidak memberi titik pada bar datar', titik.every((p) => !(p.time >= c[40].time && p.time <= c[59].time)), titik.length);
  cek('panel RSI: waktu titik = waktu candle aslinya', titik.every((p) => c.some((x) => x.time === p.time)));
  cek('qiBarDatar mengenali bar datar saja', A.qiBarDatar(c[45]) === true && A.qiBarDatar(c[10]) === false);
}

console.log('\nKesetaraan pada 120 deret acak (seed tetap)');
{
  let s = 20261022;
  const acak = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let beda = 0, bedaSeri = 0, contoh = null;
  for (let k = 0; k < 120; k++) {
    const n = 10 + Math.floor(acak() * 390);
    const closes = []; let p = 50 + acak() * 1000;
    for (let i = 0; i < n; i++) { p = Math.max(0.01, p + (acak() - 0.5) * p * 0.02); closes.push(+p.toFixed(4)); }
    const pakaiDatar = k % 3 === 0;
    const c = lilin(closes, { datar: (i) => pakaiDatar && acak() < 0.15 });
    for (const data of [closes, c]) {
      const v = [E.rsiWilder(data, 14), A.calcRSI(data, 14), I(data)];
      if (Array.isArray(data) && typeof data[0] === 'object') { const pn = A._calcRSI(data, 14); v.push(pn.length ? pn[pn.length - 1].value : null); }
      if (!sama(v)) { beda++; contoh = contoh || { k, n, v }; }
      const sE = E.rsiWilderSeri(data, 14), sA = A.qiRsiWilderSeri(data, 14);
      if (sE.length !== sA.length || sE.some((x, j) => x.i !== sA[j].i || Math.abs(x.value - sA[j].value) > 1e-9)) bedaSeri++;
    }
  }
  cek('nilai terakhir identik di keempat jalur (240 masukan)', beda === 0, contoh);
  cek('seri Mesin 9 = seri dashboard, titik demi titik', bedaSeri === 0, bedaSeri);
}

console.log('\nParitas dengan RSI server (api/_sinyal_pasar.php)');
{
  // Server memakai rumus yang sama (qi_sp_rsi / qi_sp_rsi_candles). Bedanya hanya saat data
  // kurang: server mengembalikan 50.0 (tipe float), klien null (tidak ada nilai) — deret
  // seperti itu dilewati di sini dan disebut jumlahnya.
  const { spawnSync } = require('child_process');
  const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
  const berkas = path.join(root, 'api/_sinyal_pasar.php');
  const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
  if (probe.status !== 0 || !fs.existsSync(berkas) || !/function qi_sp_rsi_candles\(/.test(fs.readFileSync(berkas, 'utf8'))) {
    console.log(`  - SKIP: ${probe.status !== 0 ? `PHP tidak bisa dijalankan ("${PHP}") — set PHP_BIN` : 'api/_sinyal_pasar.php / qi_sp_rsi_candles belum ada'}`);
  } else {
    let s = 4242;
    const acak = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const kasus = [];
    for (let k = 0; k < 40; k++) {
      const n = 12 + Math.floor(acak() * 300);
      const closes = []; let p = 100 + acak() * 500;
      for (let i = 0; i < n; i++) { p = Math.max(0.01, p + (acak() - 0.5) * p * 0.02); closes.push(+p.toFixed(4)); }
      kasus.push({ closes, candles: lilin(closes, { datar: () => acak() < 0.2 }) });
    }
    kasus.push({ closes: [...Array.from({ length: 60 }, (_, i) => 100 - i), ...new Array(30).fill(41)], candles: lilin([...Array.from({ length: 60 }, (_, i) => 100 - i), ...new Array(30).fill(41)], { datar: (i) => i >= 60 }) });
    kasus.push({ closes: new Array(40).fill(50), candles: lilin(new Array(40).fill(50)) });
    const kode = "require " + JSON.stringify(berkas.replace(/\\/g, '/')) + ";"
      + "$k=json_decode(stream_get_contents(STDIN),true);$o=[];"
      + "foreach($k as $x){$o[]=['a'=>qi_sp_rsi($x['closes']),'c'=>qi_sp_rsi_candles($x['candles'])];}"
      + "echo json_encode($o);";
    const run = spawnSync(PHP, ['-r', kode], { input: JSON.stringify(kasus), encoding: 'utf8' });
    let php = null;
    try { php = JSON.parse(run.stdout); } catch (e) { cek('skrip PHP mengembalikan JSON', false, (run.stdout || '') + (run.stderr || '')); }
    if (php) {
      let beda = 0, dilewati = 0, contoh = null;
      kasus.forEach((x, i) => {
        for (const [js, sv] of [[A.calcRSI(x.closes, 14), php[i].a], [A.calcRSI(x.candles, 14), php[i].c]]) {
          if (js === null) { dilewati++; continue; }
          if (Math.abs(js - sv) > 1e-9) { beda++; contoh = contoh || { i, js, sv }; }
        }
      });
      cek(`JS calcRSI = PHP qi_sp_rsi / qi_sp_rsi_candles (${kasus.length * 2 - dilewati} masukan, ${dilewati} data-kurang dilewati)`, beda === 0, contoh);
      const audit = php[kasus.length - 2], datar = php[kasus.length - 1];
      cek('server juga: turun lalu datar = 0, datar = 50', audit.a === 0 && audit.c === 0 && datar.a === 50 && datar.c === 50, { audit, datar });
    }
  }
}

console.log('\nPemakai RSI memakai rumus bersama');
{
  // Buang komentar (baris penuh dan ekor `// …`) supaya catatan sejarah tidak menipu pemeriksaan.
  const tanpaKomentar = (t) => t.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/.*$/, '')).join('\n');
  const ab = tanpaKomentar(potong(app, 'function analyzeCandles(', '// ─── lightweight-charts Chart'));
  cek('analyzeCandles tidak lagi memotong ke 30 close', !/slice\(-30\)/.test(ab) && /calcRSI\(closes, 14\)/.test(ab));
  const en = baca('assets/js/engine-nine.js');
  cek('TrenM5 (Mesin 9) memakai rsiWilder atas candle', /const rsiVal = rsiWilder\(c, 14\)/.test(en));
  cek('rumus Cutler lama Mesin 9 sudah tidak ada', !/function rsi\(nilai, periode, idx\)/.test(en));
  cek('halaman depan mengambil riwayat 200 kline H1, bukan 20', /interval=1h&limit=200/.test(idx) && !/interval=1h&limit=20`/.test(idx));
  cek('halaman depan memberi kline OHLC lengkap ke _calcRSI14', /_calcRSI14\(candles\)/.test(idx));
}

(async () => {
  console.log('\nRadar pasar (runRadarScan dijalankan utuh): kolom RSI = rumus bersama');
  {
    // Forex H1: 100 bar bergelombang, 48 bar akhir pekan datar (O=H=L=C), lalu 20 bar nyata.
    const c = []; let p = 1.08;
    const tambah = (o, cl, datar) => c.push({ time: 1.7e9 + c.length * 3600, open: o, high: datar ? o : Math.max(o, cl) + 0.0002, low: datar ? o : Math.min(o, cl) - 0.0002, close: cl, volume: 0 });
    for (let i = 0; i < 100; i++) { const o = p; p = +(p + Math.sin(i / 3) * 0.0008).toFixed(5); tambah(o, p, false); }
    for (let i = 0; i < 48; i++) tambah(p, p, true);
    for (let i = 0; i < 20; i++) { const o = p; p = +(p + (i % 3 === 0 ? -0.0004 : 0.0006)).toFixed(5); tambah(o, p, false); }
    // Rumus LAMA radar (salinan Wilder atas deret close, bar datar ikut dihitung).
    const lama = (v) => { let g = 0, l = 0; for (let i = 1; i <= 14; i++) { const d = v[i] - v[i - 1]; if (d > 0) g += d; else l -= d; } g /= 14; l /= 14; for (let i = 15; i < v.length; i++) { const d = v[i] - v[i - 1]; g = (g * 13 + Math.max(0, d)) / 14; l = (l * 13 + Math.max(0, -d)) / 14; } return g + l === 0 ? 50 : 100 - 100 / (1 + g / (l || 1e-9)); };
    const harap = A.calcRSI(c, 14), panel = A._calcRSI(c, 14).slice(-1)[0].value, dulu = lama(c.map((x) => x.close));
    cek(`fixture memang membedakan: rumus lama radar ${dulu.toFixed(2)} ≠ panel RSI ${panel.toFixed(2)}`, Math.round(dulu) !== Math.round(panel) && Math.abs(harap - panel) < 1e-9);
    const r = await kolomRadar(c);
    cek(`kolom RSI radar = ${Math.round(harap)} (panel RSI), bukan ${Math.round(dulu)}`, r.rsi === String(Math.round(harap)), r.rsi);

    // 40 deret acak (sebagian dengan bar datar): kolom radar selalu = calcRSI(candle) dibulatkan.
    let s = 77;
    const acak = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    let beda = 0, contoh = null;
    for (let k = 0; k < 40; k++) {
      const closes = []; let q = 100 + acak() * 900;
      const n = 22 + Math.floor(acak() * 200);
      for (let i = 0; i < n; i++) { q = Math.max(0.01, q + (acak() - 0.5) * q * 0.02); closes.push(+q.toFixed(4)); }
      const lc = lilin(closes, { datar: () => k % 2 === 0 && acak() < 0.25 });
      const v = A.calcRSI(lc, 14);
      const rr = await kolomRadar(lc);
      const harapSel = v === null ? '—' : String(Math.round(v));
      if (rr.rsi !== harapSel) { beda++; contoh = contoh || { k, n, harapSel, radar: rr.rsi }; }
    }
    cek('40 deret acak: kolom RSI radar = calcRSI(candle) dibulatkan', beda === 0, contoh);

    // 30 candle tetapi 20 di antaranya datar: cukup untuk EMA21 radar, tidak cukup untuk RSI.
    const sedikit = lilin(Array.from({ length: 30 }, (_, i) => 100 + i * 0.1), { datar: (i) => i >= 10 });
    cek('prasyarat: calcRSI = null (hanya 10 bar nyata)', A.calcRSI(sedikit, 14) === null);
    const rs = await kolomRadar(sedikit);
    cek('data RSI kurang → sel "—" (dulu tebakan 50), tanpa NaN/null di tabel', rs.rsi === '—' && !/NaN|null|undefined/.test(rs.html), rs.rsi);
    const kode = potong(app, 'async function runRadarScan(', '// ─── Paper Trading');
    cek('RSI radar memakai calcRSI(candles, 14) dan tidak lagi punya salinan Wilder sendiri', /const rsiNilai = calcRSI\(candles, 14\)/.test(kode) && !/const rsiWilder =/.test(kode));
    cek('RSI null tidak ikut skor ±1,5', /rsi !== null && rsi < 35/.test(kode) && /rsi !== null && rsi > 65/.test(kode));
  }
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — RSI Wilder satu rumus: analyzeCandles, panel RSI, Mesin 9, halaman depan, radar');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
