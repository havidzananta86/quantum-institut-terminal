// Port Pine "XAU SMC+SnD BUY SELL COMBO" → assets/js/qim-pine-smcsnd.js.
//  1) Semantik Pine pada candle buatan (seed EMA/ATR, konfirmasi pivot, zona, tumpang tindih, history_keep, BOS).
//  2) Pencocokan dengan angka TradingView sungguhan (tangkapan layar XAUUSD 4h OANDA, fixture 5.000 bar).
//  3) Kontrak integrasi (menu, replay, mulai bersih).
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info))); if (!kondisi) gagal++; }
const dekat = (a, b, t) => a !== null && a !== undefined && Math.abs(a - b) <= t;

const P = require('../assets/js/qim-pine-smcsnd.js');
const { ema, atr, pivot } = P._internal;

console.log('Semantik Pine');
const e = ema([1, 2, 3, 4], 3);
cek('ta.ema: seed = nilai pertama, alpha = 2/(len+1) → 1, 1.5, 2.25, 3.125', [1, 1.5, 2.25, 3.125].every((v, i) => dekat(e[i], v, 1e-12)), e);
const datar = n => Array.from({ length: n }, (_, i) => ({ time: 1000 + i * 3600, open: 100, high: 101, low: 99, close: 100 }));
const a = atr(datar(6), 3);
cek('ta.atr: na sebelum len bar; seed = SMA true range; bar pertama TR = high−low', a[0] === null && a[1] === null && dekat(a[2], 2, 1e-12) && dekat(a[5], 2, 1e-12), a);
const gap = datar(4); gap[1] = { time: 0, open: 110, high: 111, low: 109, close: 110 };
cek('ta.tr memakai gap terhadap close sebelumnya (bar 1: max(2, |111−100|, |109−100|) = 11)', dekat(atr(gap, 1)[1], 11, 1e-12), atr(gap, 1));
const tinggi = [1, 2, 5, 3, 5, 1, 1].map((h, i) => ({ time: i, open: 1, high: h, low: 0, close: 1 }));
cek('ta.pivothigh(2,2): nilai muncul di bar KONFIRMASI (i = pivot + 2), bukan di bar pivot', pivot(tinggi, 2, true, P.DEFAULT)[3] === null && pivot(tinggi, 2, true, P.DEFAULT)[4] === 5);
cek('pivot: kanan boleh sama (>=) pada konvensi bawaan; ketat bila diminta', pivot(tinggi, 2, true, { ...P.DEFAULT, pivotKananKetat: true })[4] === null);
cek('pivot: sisi kiri harus lebih rendah (nilai sama di kiri → bukan pivot)', pivot([5, 5, 5, 3, 3].map((h, i) => ({ time: i, open: 1, high: h, low: 0, close: 1 })), 2, true, P.DEFAULT)[4] === null);

console.log('Zona Supply/Demand pada candle buatan (swing_length 3)');
function dengan(lonjakan, n = 130) {
    const c = datar(n);
    lonjakan.forEach(([i, h]) => { c[i] = { ...c[i], high: h }; });
    return c;
}
const o3 = { swing_length: 3, atrLen: 3, history_keep: 20 };
let r = P.hitung(dengan([[20, 110]]), o3);
const A23 = r.atr[23];
cek('satu lonjakan → satu zona supply: top = swing high, bottom = top − ATR×box_width/10', r.zona.supply.length === 1 && dekat(r.zona.supply[0].top, 110, 1e-9) && dekat(r.zona.supply[0].bottom, 110 - A23 * 0.25, 1e-9), r.zona.supply);
cek('zona mulai dari bar pivot (bar 20), dibuat di bar konfirmasi (23)', r.zona.supply[0].left === 20 && r.zona.supply[0].dibuat === 23);
r = P.hitung(dengan([[20, 110], [40, 111]]), o3);
cek('pivot kedua dalam jarak 2×ATR dari zona lama ditolak (tumpang tindih) — zona lama tetap', r.zona.supply.length === 1 && r.zona.supply[0].top === 110, r.zona.supply.map(z => z.top));
r = P.hitung(dengan([[20, 110], [40, 130]]), o3);
cek('pivot yang cukup jauh → zona baru; urutan: terbaru di depan', r.zona.supply.length === 2 && r.zona.supply[0].top === 130 && r.zona.supply[1].top === 110, r.zona.supply.map(z => z.top));
// ATR panjang (30) supaya lonjakan tidak membesarkan ambang tumpang tindih (2×ATR) melebihi jarak antar zona.
const banyak = [[45, 120], [75, 180], [105, 240], [135, 300], [165, 360], [195, 420], [225, 480]];
r = P.hitung(dengan(banyak, 260), { swing_length: 3, atrLen: 30, history_keep: 5 });
cek('history_keep: hanya 5 zona terbaru (yang terlama keluar)', r.zona.supply.length === 5 && r.zona.supply[0].top === 480 && r.zona.supply[4].top === 240, r.zona.supply.map(z => z.top));
r = P.hitung(dengan(banyak, 260), { swing_length: 3, atrLen: 30, history_keep: 20 });
cek('history_keep besar: ketujuh zona bertahan', r.zona.supply.length === 7, r.zona.supply.map(z => z.top));
// BOS: close menembus top supply → zona hilang, diganti garis BOS di tengah zona. Bar sesudah tembus dibuat
// makin tinggi supaya bar tembus bukan pivot baru (jika tidak, ia ikut membentuk zona supply baru).
const tembus = dengan([[20, 110]], 60);
for (let i = 40; i < 60; i++) tembus[i] = { time: tembus[i].time, open: 100, high: 115 + (i - 40), low: 99, close: 112 };
r = P.hitung(tembus, o3);
cek('close ≥ top supply → zona dihapus dan menjadi garis BOS (y = tengah zona, berhenti di bar tembus)',
    r.zona.supply.length === 0 && r.bos.supply.length === 1 && r.bos.supply[0].left === 20 && r.bos.supply[0].right === 40 && dekat(r.bos.supply[0].y, 110 - A23 * 0.125, 1e-9), { z: r.zona.supply.length, b: r.bos.supply });
cek('showZones=false → tidak ada zona sama sekali', P.hitung(dengan([[20, 110]]), { ...o3, showZones: false }).zona.supply.length === 0);

console.log('Pencocokan dengan angka TradingView (XAUUSD 4h OANDA, 5.000 bar)');
const fx = JSON.parse(read('tests/fixtures/xauusd_h4_oanda.json'));
const candles = fx.candles.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const R = P.hitung(candles, {});
const akhirEma = k => R[k][R[k].length - 1];
// Acuan: legenda & tabel di tangkapan layar TradingView pengguna (candle terakhir 4165,42 — sama dengan fixture).
cek('EMA 13/21/100/200 identik dengan TradingView (4160.271 / 4157.896 / 4187.242 / 4234.585)',
    dekat(akhirEma('ema13'), 4160.271, 0.001) && dekat(akhirEma('ema21'), 4157.896, 0.001) && dekat(akhirEma('ema100'), 4187.242, 0.001) && dekat(akhirEma('ema200'), 4234.585, 0.001),
    ['ema13', 'ema21', 'ema100', 'ema200'].map(akhirEma));
const TV_BUY = { entry: 4019.209, tp1: 4082.460, tp2: 4145.712, tp3: 4210.880, sl: 3987.847 };
const TV_SELL = { entry: 4222.266, tp1: 4158.523, tp2: 4094.781, tp3: 4029.106, sl: 4253.628 };
const TOL = 0.03;   // ≈ 0,0007% dari harga; sisa selisih = ATR terakhir (28,53 vs 28,51 di TradingView)
cek('tabel BUY: Entry/TP1/TP2/TP3/SL cocok dengan TradingView (selisih ≤ 0.03)', Object.keys(TV_BUY).every(k => dekat(R.buy[k], TV_BUY[k], TOL)), Object.keys(TV_BUY).map(k => [k, R.buy[k], TV_BUY[k]]));
cek('tabel SELL: Entry/TP1/TP2/TP3/SL cocok dengan TradingView (selisih ≤ 0.03)', Object.keys(TV_SELL).every(k => dekat(R.sell[k], TV_SELL[k], TOL)), Object.keys(TV_SELL).map(k => [k, R.sell[k], TV_SELL[k]]));
cek('status BUY & SELL = "WAIT SWEEP" (seperti di TradingView)', R.buy.status === 'WAIT SWEEP' && R.sell.status === 'WAIT SWEEP' && R.buy.baseValid && R.sell.baseValid, [R.buy.status, R.sell.status]);
const sup = R.zona.supply.slice(0, 3).map(z => [z.bottom, z.top]);
cek('zona SUPPLY terdekat cocok dengan kotak di chart TradingView (4210.9–4219.4 · 4307.3–4315.8 · 4390.9–4399.7)',
    dekat(sup[0][0], 4210.90, 0.05) && dekat(sup[0][1], 4219.415, 0.01) && dekat(sup[1][0], 4307.34, 0.05) && dekat(sup[1][1], 4315.80, 0.05) && dekat(sup[2][0], 4390.85, 0.05) && dekat(sup[2][1], 4399.67, 0.05), sup);
cek('zona DEMAND 4022.06–4029.11 (pita teal di bawah chart TradingView)', R.zona.demand.length === 1 && dekat(R.zona.demand[0].bottom, 4022.06, 0.001) && dekat(R.zona.demand[0].top, 4029.106, 0.01), R.zona.demand);
const bosY = R.bos.demand.map(b => b.y);
cek('garis BOS tipis di chart TradingView ada (≈4287.7, 4258.2, 4114.7, 4370.2)', [4287.73, 4258.17, 4114.72, 4370.18].every(y => bosY.some(v => dekat(v, y, 0.05))), bosY);

console.log('Opsi & kejujuran');
const tanpaSweep = P.hitung(candles, { useSweepLogic: false });
cek('Require Liquidity Sweep = off → status VALID BUY / VALID SELL (level sama)', tanpaSweep.buy.status === 'VALID BUY' && tanpaSweep.sell.status === 'VALID SELL' && dekat(tanpaSweep.buy.entry, R.buy.entry, 1e-9));
const lebarBeda = P.hitung(candles, { box_width: 5 });
cek('Box Width 5 → zona dua kali lebih tebal', dekat(lebarBeda.zona.demand[0].top - lebarBeda.zona.demand[0].bottom, 2 * (R.zona.demand[0].top - R.zona.demand[0].bottom), 0.05));
const potong = P.hitung(candles.slice(0, 4000), {});
cek('tanpa melihat masa depan: EMA/ATR 4.000 bar pertama identik dengan hitungan penuh', [100, 2000, 3999].every(i => potong.ema200[i] === R.ema200[i] && potong.atr[i] === R.atr[i]));
cek('data terlalu sedikit → ditolak dengan pesan jujur', P.hitung(candles.slice(0, 10), {}).ok === false && /terlalu sedikit/.test(P.hitung(candles.slice(0, 10), {}).pesan));
const t0 = Date.now(); P.hitung(candles, {}); const ms = Date.now() - t0;
cek('5.000 bar dihitung < 200 ms (aman dijalankan tiap tick)', ms < 200, ms + ' ms');

console.log('Integrasi chart');
const ui = read('assets/js/qim-indikator-kustom.js'), pg = read('assets/js/qim-pages.js'), html = read('dashboard.html');
cek('menu Indikator memuat bagian indikator Pine', /QIMIndikatorKustom\.bagianMenu\(\)/.test(pg));
cek('chart selalu mulai bersih: status nyala TIDAK disimpan (hanya parameter)', /let aktif = false/.test(ui) && !/localStorage\.setItem\([^)]*aktif/.test(ui) && /KUNCI_OPSI/.test(ui));
cek('Replay: hitungan dibatasi sampai bar replay (tanpa membocorkan masa depan)', /qim:replay-bar/.test(ui) && /x\.time <= waktuReplay/.test(ui) && /qim:replay-bar/.test(pg));
cek('riwayat dalam dari get-history, dicampur hanya bila sumbernya sama dengan chart', /api\/get-history\.php/.test(ui) && /sumberChart === riwayat\.sumber/.test(ui));
const pine = (JSON.parse(read('assets/js/bundel.json')).lazy || {}).pine || [];   // bundel lazy: dimuat saat popover Indikator dibuka
cek('modul dimuat berurutan: qim-pine-smcsnd.js sebelum qim-indikator-kustom.js', pine.indexOf('qim-pine-smcsnd.js') === 0 && pine.indexOf('qim-indikator-kustom.js') === 1);
cek('menu Indikator memuat modul Pine lebih dulu bila belum ada', /QIMMuatFitur\('pine'\)/.test(pg));
cek('tabel BUY/SELL memakai warna & isi skrip Pine (STATUS, WAIT SWEEP, TP1–TP3, SL)', /VALID BUY|status/.test(ui) && /ENTRY/.test(ui) && /'TP3'/.test(ui) && /rgba\(8, 153, 129/.test(read('assets/css/qim-fitur.css')));

console.log(gagal ? `\nFAIL — ${gagal} pemeriksaan gagal` : '\nPASS — port Pine SMC+SnD: semantik benar & cocok dengan TradingView');
process.exit(gagal ? 1 : 0);
