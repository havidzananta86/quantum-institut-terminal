/**
 * 9 MESIN KUANTUM — uji perilaku.
 *
 * Kesembilan mesin inilah yang menghasilkan sinyal (SNR, SMC, EMA200, Ichimoku, Fibonacci,
 * TrenM5, MomentumNY, MACD, Golden Cross), tetapi sampai 2026-10-21 tidak satu pun punya
 * tes. Berkas aslinya dijalankan di sandbox vm dengan candle sintetis yang bentuknya
 * ditentukan, jadi yang diuji perilakunya — bukan ada/tidaknya teks.
 *
 * Run:  node tests/mesin-sembilan.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'assets/js/engine-nine.js'), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

// ── Muat modul asli ─────────────────────────────────────────────────────────
const ctx = { window: {}, console, Date, Math, Number, Array, JSON, isNaN, parseFloat };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const E = ctx.window.QuantumEngineNine;
cek('modul mengekspor QuantumEngineNine', !!E);
if (!E) { console.error('\nFAIL'); process.exit(1); }

// ── Pembuat candle ──────────────────────────────────────────────────────────
const SEKARANG = Math.floor(Date.now() / 1000);
/** Deret candle; fn(i) mengembalikan harga close. High/low dibentuk di sekitarnya. */
function deret(n, fn, { jam = 3600, lebar = 0.3 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = fn(i);
    const o = i === 0 ? c : fn(i - 1);
    out.push({
      time: SEKARANG - (n - 1 - i) * jam,
      open: +o.toFixed(5), high: +(Math.max(o, c) + lebar).toFixed(5),
      low: +(Math.min(o, c) - lebar).toFixed(5), close: +c.toFixed(5),
      volume: 1000,
    });
  }
  return out;
}
// Tren dengan tarikan napas (pullback) — garis lurus sempurna TIDAK punya pivot sama
// sekali, sehingga levelStruktur() tidak bisa menemukan struktur apa pun. Data yang
// terlalu rapi justru menguji keadaan yang tidak pernah ada di pasar.
const naik  = (n) => deret(n, (i) => 100 + i * 0.5 + Math.sin(i / 4) * 1.8);
const turun = (n) => deret(n, (i) => 100 + (n - i) * 0.5 + Math.sin(i / 4) * 1.8);
const datar = (n) => deret(n, (i) => 100 + Math.sin(i / 3) * 0.2);
// Turun panjang lalu berbalik naik tajam → EMA50 memotong EMA200 BARU-BARU ini.
// Golden Cross memang hanya menyala pada persilangan baru (≤ 5 bar), bukan sekadar
// EMA50 di atas EMA200 — jadi tren naik yang sudah lama justru harus NETRAL.
const silangNaik = (n) => deret(n, (i) => (i < n - 60 ? 200 - i * 0.45 : 200 - (n - 60) * 0.45 + (i - (n - 60)) * 2.2));
const silangTurun = (n) => deret(n, (i) => (i < n - 60 ? 100 + i * 0.45 : 100 + (n - 60) * 0.45 - (i - (n - 60)) * 2.2));
const PUTUSAN_SAH = ['BUY', 'SELL', 'NETRAL', 'TIDAK ADA SETUP', 'BELUM CUKUP BUKTI'];

console.log('\nKelengkapan mesin');
const KODE = ['SNR', 'SMC', 'EMA200', 'ICHI', 'FIBO', 'TRENM5', 'MOMENTUM_NY', 'MACD_MOM', 'GOLDEN_CROSS'];
cek('tepat 9 mesin terdaftar', E.daftarKode.length === 9, E.daftarKode.length);
for (const k of KODE) cek(`mesin ${k} ada`, E.daftarKode.includes(k));
cek('setiap mesin punya nama manusiawi', E.MESIN.every((m) => typeof m.nama === 'string' && m.nama.length > 5));

console.log('\nData kurang → jujur, bukan menebak');
{
  const h = E.evaluasi(datar(10));
  cek('cukupData = false', h.cukupData === false);
  cek(`alasannya menyebut kebutuhan minimal ${E.MIN_BAR} bar`, new RegExp(String(E.MIN_BAR)).test(h.alasan), h.alasan);
  cek('kesembilan mesin dilaporkan NETRAL', h.mesin.length === 9 && h.mesin.every((m) => m.arah === 'NETRAL'));
  cek('tidak ada skor karangan', h.mesin.every((m) => m.skor === 0));
  cek('konfluensi NETRAL dengan keyakinan "data kurang"', h.konfluensi.putusan === 'NETRAL' && /data kurang/.test(h.konfluensi.keyakinan));
}
{
  const h = E.evaluasi([]);
  cek('tanpa candle sama sekali → tidak melempar galat', h && h.cukupData === false);
  cek('tanpa candle → daftar mesin kosong, bukan nilai palsu', Array.isArray(h.mesin) && h.mesin.length === 0);
}

console.log('\nKebutuhan bar per mesin dihormati');
{
  // 80 bar: cukup untuk SNR/SMC/MACD, TIDAK cukup untuk EMA200 & Golden Cross (butuh 200).
  const h = E.evaluasi(naik(80));
  const cari = (k) => h.mesin.find((m) => m.kode === k);
  cek('cukupData = true pada 80 bar', h.cukupData === true);
  for (const k of ['EMA200', 'GOLDEN_CROSS']) {
    const m = cari(k);
    cek(`${k} menolak menilai dengan 80 bar`, m && m.arah === 'NETRAL' && m.valid === false, m && m.arah);
    cek(`${k} mengatakan berapa bar yang kurang`, m && /Butuh 200 bar, tersedia 80/.test(m.alasan), m && m.alasan);
  }
  cek('mesin lain tetap bekerja', ['SNR', 'SMC', 'MACD_MOM'].every((k) => { const m = cari(k); return m && typeof m.skor === 'number'; }));
}

console.log('\nArah mengikuti bentuk pasar');
{
  const naikPanjang = E.evaluasi(naik(260));
  const turunPanjang = E.evaluasi(turun(260));
  const arah = (h, k) => (h.mesin.find((m) => m.kode === k) || {}).arah;

  // Golden Cross SENGAJA hanya menyala pada persilangan BARU (≤ 5 bar). Tren naik yang
  // sudah lama berjalan harus NETRAL — menyalakannya terus-menerus akan jadi sinyal palsu.
  cek('tren naik lama: Golden Cross NETRAL (bukan sinyal berulang)', arah(naikPanjang, 'GOLDEN_CROSS') === 'NETRAL', arah(naikPanjang, 'GOLDEN_CROSS'));
  for (const [nama, data] of [['persilangan ke atas', silangNaik(260)], ['persilangan ke bawah', silangTurun(260)]]) {
    const m = E.evaluasi(data).mesin.find((x) => x.kode === 'GOLDEN_CROSS');
    // Persilangan boleh berakhir NETRAL bila strukturnya tidak mendukung (SL terlalu jauh,
    // tidak ada swing target) — tetapi alasannya WAJIB dikatakan, bukan diam.
    cek(`${nama}: alasannya dinyatakan, bukan diam`, !!m && typeof m.alasan === 'string' && m.alasan.length > 10, m && m.alasan);
    cek(`${nama}: kalau ditolak, sebabnya disebut`, !!m && (m.arah !== 'NETRAL' || /ditolak|Butuh|belum|tidak/i.test(m.alasan)), m && m.alasan);
  }
  cek('tren naik: MACD tidak menunjuk SELL', arah(naikPanjang, 'MACD_MOM') !== 'SELL', arah(naikPanjang, 'MACD_MOM'));
  cek('tren turun: MACD tidak menunjuk BUY', arah(turunPanjang, 'MACD_MOM') !== 'BUY', arah(turunPanjang, 'MACD_MOM'));
  cek('tren naik: konfluensi tidak memutuskan SELL', naikPanjang.konfluensi.putusan !== 'SELL', naikPanjang.konfluensi.putusan);
  cek('tren turun: konfluensi tidak memutuskan BUY', turunPanjang.konfluensi.putusan !== 'BUY', turunPanjang.konfluensi.putusan);
}

console.log('\nSetiap mesin menjawab dengan bentuk yang sah');
{
  // Kontrak yang berlaku untuk SEMUA keadaan pasar: tidak ada mesin yang boleh diam tanpa
  // alasan, mengarang skor, atau mengaku valid tanpa level struktur. Inilah yang membuat
  // "tidak ada sinyal" bisa dipercaya — bukan sekadar hasil akhir yang kebetulan cocok.
  for (const data of [naik(260), turun(260), datar(260), silangNaik(260)]) {
    const h = E.evaluasi(data);
    for (const m of h.mesin) {
      if (!['BUY', 'SELL', 'NETRAL'].includes(m.arah)) cek(`${m.kode}: arah sah`, false, m.arah);
      if (!(typeof m.skor === 'number' && m.skor >= 0 && m.skor <= 100)) cek(`${m.kode}: skor 0–100`, false, m.skor);
      if (!(typeof m.alasan === 'string' && m.alasan.length > 5)) cek(`${m.kode}: selalu memberi alasan`, false, m.alasan);
      if (m.valid && !(m.level && m.level.valid)) cek(`${m.kode}: valid hanya bila level sah`, false, m.level);
      if (m.arah === 'NETRAL' && m.valid) cek(`${m.kode}: NETRAL tidak boleh valid`, false);
    }
  }
  cek('4 bentuk pasar × 9 mesin: arah, skor, alasan, dan valid selalu konsisten', true);
}

console.log('\nLevel SL/TP benar-benar dari struktur (levelStruktur)');
{
  // Diuji langsung lewat fungsi murni yang memang diekspor untuk audit — jauh lebih tegas
  // daripada menunggu salah satu mesin kebetulan menghasilkan setup.
  const gelombang = deret(200, (i) => 100 + Math.sin(i / 7) * 6 + i * 0.08, { lebar: 0.4 });
  const harga = gelombang[gelombang.length - 1].close;
  for (const arah of ['BUY', 'SELL']) {
    const L = E.levelStruktur(gelombang, arah, 3.5);
    cek(`${arah}: level dihasilkan & sah`, !!L && L.valid === true, L && L.alasan);
    if (!L || !L.valid) continue;
    const sisiBenar = arah === 'BUY' ? (L.sl < L.entry && L.tp > L.entry) : (L.sl > L.entry && L.tp < L.entry);
    cek(`${arah}: SL & TP di sisi yang benar`, sisiBenar, { entry: L.entry, sl: L.sl, tp: L.tp });
    cek(`${arah}: entry = harga sekarang`, Math.abs(L.entry - harga) < 0.05, { entry: L.entry, harga });
    cek(`${arah}: R:R tercatat dan positif`, typeof L.rr === 'number' && L.rr > 0, L.rr);
    cek(`${arah}: SL menyebut sumber strukturnya`, /swing|order block|zona|level/i.test(String(L.slSumber)), L.slSumber);
    cek(`${arah}: TP menyebut sumber atau cara hitungnya`, typeof L.tpSumber === 'string' && L.tpSumber.length > 5, L.tpSumber);
  }
  // SL yang terlalu jauh dari ATR harus DITOLAK, bukan dipakai diam-diam.
  const sempit = E.levelStruktur(gelombang, 'BUY', 0.4);
  cek('SL terlalu jauh terhadap ATR → ditolak dengan alasan', !!sempit && sempit.valid === false && /terlalu jauh/i.test(String(sempit.alasan)), sempit && sempit.alasan);
}

console.log('\nKonfluensi hanya dari setup yang sah');
{
  const h = E.evaluasi(naik(260));
  const sah = h.mesin.filter((m) => m.valid);
  const k = h.konfluensi;
  cek('jumlah suara = jumlah mesin valid', k.bullish + k.bearish === sah.length, { bullish: k.bullish, bearish: k.bearish, sah: sah.length });
  cek('bullish = jumlah mesin valid berarah BUY', k.bullish === sah.filter((m) => m.arah === 'BUY').length);
  cek('bearish = jumlah mesin valid berarah SELL', k.bearish === sah.filter((m) => m.arah === 'SELL').length);
  cek('skor konfluensi dalam 0–100', k.skor >= 0 && k.skor <= 100, k.skor);
  // 'TIDAK ADA SETUP' dan 'BELUM CUKUP BUKTI' adalah putusan yang SAH dan disengaja:
  // sistem lebih sering diam daripada memaksakan arah. Keduanya ikut diakui di sini.
  cek('putusan termasuk daftar yang sah', PUTUSAN_SAH.includes(k.putusan), k.putusan);
  cek('tanpa setup sah → tidak pernah memutuskan BUY/SELL', sah.length > 0 || !['BUY', 'SELL'].includes(k.putusan), { sah: sah.length, putusan: k.putusan });
}

console.log('\nData basi ditandai');
{
  const lama = naik(260).map((c) => ({ ...c, time: c.time - 86400 * 3 }));
  const h = E.evaluasi(lama, { intervalDetik: 3600 });
  cek('candle berumur 3 hari pada TF 1 jam ditandai basi', h.basi === true);
  cek('umur data dilaporkan dalam detik', typeof h.umurDetik === 'number' && h.umurDetik > 86400, h.umurDetik);
  const segar = E.evaluasi(naik(260), { intervalDetik: 3600 });
  cek('candle terbaru tidak ditandai basi', segar.basi === false);
}

console.log('\nSatu mesin gagal tidak menjatuhkan yang lain');
{
  // Candle dengan harga nol/negatif: memaksa pembagian aneh di beberapa mesin.
  const rusak = naik(260).map((c, i) => (i === 259 ? { ...c, close: 0, high: 0, low: 0, open: 0 } : c));
  let h = null, lempar = false;
  try { h = E.evaluasi(rusak); } catch (e) { lempar = true; }
  cek('tidak melempar galat', !lempar);
  cek('tetap mengembalikan 9 mesin', !!h && h.mesin.length === 9, h && h.mesin.length);
  cek('setiap mesin punya arah yang sah', !!h && h.mesin.every((m) => ['BUY', 'SELL', 'NETRAL'].includes(m.arah)));
}

console.log('\nFungsi murni yang diekspor untuk audit');
{
  cek('pivot diekspor', typeof E.pivot === 'function');
  cek('levelStruktur diekspor', typeof E.levelStruktur === 'function');
  cek('AMBANG_SETUP berupa angka', typeof E.AMBANG_SETUP === 'number', E.AMBANG_SETUP);
  cek('MIN_BAR berupa angka', typeof E.MIN_BAR === 'number' && E.MIN_BAR > 0, E.MIN_BAR);
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — 9 mesin: kelengkapan, kebutuhan bar, arah, level struktur, konfluensi');
process.exit(gagal ? 1 : 0);
