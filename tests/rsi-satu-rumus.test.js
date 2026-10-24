/**
 * RSI(14) — SATU RUMUS DI SELURUH KLIEN (audit sinyal 2026-10-22).
 *
 * Sebelum perbaikan ada empat "RSI 14" berbeda untuk simbol & TF yang sama. Reproduksi audit:
 * 60 close turun lalu 30 close datar → versi 30-bar = 100 (dihitung suara BULL), Wilder riwayat penuh = 0.
 *
 * Dashboard panel lama (dashboard-app.js: analyzeCandles / _calcRSI / radar) sudah dibuang; yang tayang kini:
 *   · Mesin 9            assets/js/engine-nine.js          rsiWilder / rsiWilderSeri
 *   · shell chart-first  assets/js/qim-terminal-shell.js   rsi()  (Signal Center) — sempat memakai rumus lama
 *                                                          (datar → 100, bar akhir pekan tidak dibuang), kini disamakan
 *   · halaman depan      assets/js/halaman-index.js        _calcRSI14
 *   · server             api/_sinyal_pasar.php             qi_sp_rsi / qi_sp_rsi_candles
 *
 * Uji ini MENJALANKAN kode aslinya (potongan berkas di sandbox vm) dan membuktikan dengan angka bahwa semuanya
 * memberi hasil yang sama: riwayat penuh, seed SMA 14 perubahan pertama, bar ber-rentang nol dibuang,
 * datar → 50, avgLoss 0 → 100.
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

// ── Muat implementasi dari berkas aslinya ───────────────────────────────────
const idx = baca('assets/js/halaman-index.js');
const shell = baca('assets/js/qim-terminal-shell.js');

const ctxE = { window: {}, console, Date, Math, Number, Array, JSON, isNaN, isFinite, parseFloat };
vm.createContext(ctxE);
vm.runInContext(baca('assets/js/engine-nine.js'), ctxE);
const E = ctxE.window.QuantumEngineNine;

const ctxI = { console, Math, Number, Array, isFinite };
vm.createContext(ctxI);
vm.runInContext(potong(idx, 'function _calcRSI14(', 'async function fetchLiveSignal(') + '\nglobalThis.I = _calcRSI14;', ctxI);
const I = ctxI.I;

const ctxS = { console, Math, Number, Array, isFinite };
vm.createContext(ctxS);
vm.runInContext(potong(shell, 'function rsi(data, period) {', 'function atr(candles, period) {') + '\nglobalThis.S = (d) => rsi(d, 14);', ctxS);
const S = ctxS.S;

cek('engine-nine mengekspor rsiWilder & rsiWilderSeri', !!E && typeof E.rsiWilder === 'function' && typeof E.rsiWilderSeri === 'function');
cek('halaman-index punya _calcRSI14', typeof I === 'function');
cek('shell chart-first punya rsi()', typeof S === 'function');
if (!E || !I || !S) { console.error('\nFAIL'); process.exit(1); }

/** Semua jalur klien untuk satu masukan: [engine, halaman depan, shell]. */
const semua = (data) => [E.rsiWilder(data, 14), I(data), S(data)];
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
  cek('Mesin 9: 19 nilai RSI = acuan', JSON.stringify(seriE) === JSON.stringify(acuan), seriE);
  cek('RSI pertama di bar ke-15 (indeks 14), bukan sebelumnya', E.rsiWilderSeri(sc, 14)[0].i === 14);
  cek('halaman depan: nilai terakhir 37,79', +I(sc).toFixed(2) === 37.79, I(sc));
  cek('shell chart-first: nilai terakhir 37,79', +S(sc).toFixed(2) === 37.79, S(sc));
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
  cek('semua jalur kini = 0 (Wilder riwayat penuh)', v.every((x) => x === 0), v);
  // Bentuk K3: 30 bar akhir pekan ber-rentang nol → dibuang, tersisa 60 bar turun.
  const k3 = lilin(closes, { datar: (i) => i >= 60 });
  const v3 = semua(k3);
  cek('candle dengan 30 bar datar: semua jalur = 0, bukan 100', v3.every((x) => x === 0), v3);
}

console.log('\nHarga datar = 50, naik terus = 100, turun terus = 0');
{
  const datar = new Array(40).fill(50);
  cek('datar → 50 di semua jalur (shell dulu 100 → dihitung suara BULL)', semua(datar).every((x) => x === 50), semua(datar));
  cek('candle datar (open=high=low=close) → semua bar dibuang → null, bukan tebakan', semua(lilin(datar, { datar: () => true })).every((x) => x === null), semua(lilin(datar, { datar: () => true })));
  cek('naik terus → 100', semua(Array.from({ length: 40 }, (_, i) => 100 + i)).every((x) => x === 100));
  cek('turun terus → 0', semua(Array.from({ length: 40 }, (_, i) => 140 - i)).every((x) => x === 0));
  cek('kurang dari 15 close → tidak ada nilai (null), bukan tebakan 50', semua([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).every((x) => x === null));
}

console.log('\nBar ber-rentang nol (open=high=low=close) dibuang');
{
  // 40 bar naik nyata, lalu 20 bar "datar" dari feed kosong di harga 150 (bukan harga pasar),
  // lalu 3 bar nyata melanjutkan 140→142. Tanpa membuang bar datar, loncatan ke 150 dan turun
  // lagi ke 140 tercatat sebagai rugi — padahal pasar hanya naik.
  const closes = [...Array.from({ length: 40 }, (_, i) => 100 + i), ...new Array(20).fill(150), 140, 141, 142];
  const c = lilin(closes, { datar: (i) => i >= 40 && i < 60 });
  const v = semua(c);
  cek('candle: semua jalur = 100 (hanya kenaikan nyata)', v.every((x) => x === 100), v);
  const angka = E.rsiWilder(closes, 14);
  cek('deret angka close dipakai apa adanya (tanpa info OHLC) → < 100, sama di semua jalur', angka < 100 && sama(semua(closes)), semua(closes));
}

console.log('\nKesetaraan pada 120 deret acak (seed tetap)');
{
  let s = 20261022;
  const acak = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let beda = 0, contoh = null;
  for (let k = 0; k < 120; k++) {
    const n = 10 + Math.floor(acak() * 390);
    const closes = []; let p = 50 + acak() * 1000;
    for (let i = 0; i < n; i++) { p = Math.max(0.01, p + (acak() - 0.5) * p * 0.02); closes.push(+p.toFixed(4)); }
    const pakaiDatar = k % 3 === 0;
    const c = lilin(closes, { datar: (i) => pakaiDatar && acak() < 0.15 });
    for (const data of [closes, c]) {
      const v = semua(data);
      if (!sama(v)) { beda++; contoh = contoh || { k, n, v }; }
    }
  }
  cek('nilai terakhir identik di semua jalur klien (240 masukan)', beda === 0, contoh);
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
    const turunLaluDatar = [...Array.from({ length: 60 }, (_, i) => 100 - i), ...new Array(30).fill(41)];
    kasus.push({ closes: turunLaluDatar, candles: lilin(turunLaluDatar, { datar: (i) => i >= 60 }) });
    kasus.push({ closes: new Array(40).fill(50), candles: lilin(new Array(40).fill(50)) });
    const kode = "require " + JSON.stringify(berkas.replace(/\\/g, '/')) + ";"
      + "$k=json_decode(stream_get_contents(STDIN),true);$o=[];"
      + "foreach($k as $x){$o[]=['a'=>qi_sp_rsi($x['closes']),'c'=>qi_sp_rsi_candles($x['candles'])];}"
      + "echo json_encode($o);";
    const run = spawnSync(PHP, ['-r', kode], { input: JSON.stringify(kasus), encoding: 'utf8' });
    let php = null;
    try { php = JSON.parse(run.stdout); } catch (e) { cek('skrip PHP mengembalikan JSON', false, (run.stdout || '') + (run.stderr || '')); }
    if (php) {
      for (const [nama, hitung] of [['Mesin 9', (d) => E.rsiWilder(d, 14)], ['shell chart-first', S]]) {
        let beda = 0, dilewati = 0, contoh = null;
        kasus.forEach((x, i) => {
          for (const [js, sv] of [[hitung(x.closes), php[i].a], [hitung(x.candles), php[i].c]]) {
            if (js === null) { dilewati++; continue; }
            if (Math.abs(js - sv) > 1e-9) { beda++; contoh = contoh || { i, js, sv }; }
          }
        });
        cek(`${nama} = PHP qi_sp_rsi / qi_sp_rsi_candles (${kasus.length * 2 - dilewati} masukan, ${dilewati} data-kurang dilewati)`, beda === 0, contoh);
      }
      const audit = php[kasus.length - 2], datar = php[kasus.length - 1];
      cek('server juga: turun lalu datar = 0, datar = 50', audit.a === 0 && audit.c === 0 && datar.a === 50 && datar.c === 50, { audit, datar });
    }
  }
}

console.log('\nPemakai RSI memakai rumus bersama');
{
  const en = baca('assets/js/engine-nine.js');
  cek('TrenM5 (Mesin 9) memakai rsiWilder atas candle', /const rsiVal = rsiWilder\(c, 14\)/.test(en));
  cek('rumus Cutler lama Mesin 9 sudah tidak ada', !/function rsi\(nilai, periode, idx\)/.test(en));
  cek('shell: analyzeTimeframe memberi CANDLE (bukan hanya close) ke rsi() agar bar datar bisa dibuang', /rsiValue = rsi\(candles, 14\)/.test(shell));
  cek('halaman depan mengambil riwayat 200 kline H1, bukan 20', /interval=1h&limit=200/.test(idx) && !/interval=1h&limit=20`/.test(idx));
  cek('halaman depan memberi kline OHLC lengkap ke _calcRSI14', /_calcRSI14\(candles\)/.test(idx));
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — RSI Wilder satu rumus: Mesin 9, shell chart-first, halaman depan, server');
process.exit(gagal ? 1 : 0);
