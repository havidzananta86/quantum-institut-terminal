/**
 * SINYAL DI SISI KLIEN — regresi audit sinyal 2026-10-22 (bagian klien).
 *
 * Setiap pemeriksaan MENJALANKAN kode aslinya di sandbox vm dengan data yang bentuknya
 * ditentukan, lalu membuktikan perbaikannya dengan angka:
 *  1. Panah Mesin 9 hanya untuk putusan BUY/SELL ('BELUM CUKUP BUKTI' dulu jadi panah SELL).
 *  2. Konsensus Mesin 9 menghitung bukti INDEPENDEN: EMA200 & GOLDEN_CROSS hanya memilih pada
 *     PERISTIWA-nya (pullback ≤1% / persilangan ≤5 bar), keadaan tren di bawah AMBANG_SETUP;
 *     MOMENTUM_NY dari bar yang SUDAH close, |Δclose| ≥ 0,3×ATR, jam sesi dari waktu nyata;
 *     TRENM5/MOMENTUM_NY/MACD_MOM (membaca close terbaru yang sama) = paling banyak SATU bukti;
 *     umur persilangan EMA yang tak diketahui (200–204 bar) tidak disimpulkan.
 *  3. Awan Ichimoku Mesin 9 digeser 26 bar.
 *  4. Ringkasan Signal Matrix memakai dominasi (2 BUY/2 SELL → NEUTRAL; 3 BUY+1 SELL → BUY).
 *  5. Sinkron bar baru chart MEMPERTAHANKAN penanda `simulated`, tidak menukar candle nyata
 *     dengan candle acak, dan mengganti chart simulasi SEGERA saat data nyata kembali (tanpa
 *     menunggu batang baru); Setup Analisa, Mesin 9 dan indikator Pine menolak candle simulasi.
 *  6. Halaman depan: urut & umur sinyal dari timestamp_epoch; blok "Live Trade Ideas" yang
 *     menanyai kolom yang tidak ada sudah dihapus; kartu readout tidak lagi mengarang status,
 *     tren, zona entry, atau level SL/TP untuk keadaan WAIT.
 *
 * Run:  node tests/sinyal-klien.test.js
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
const tunggu = () => new Promise((r) => setImmediate(r));

const ctxE = { window: {}, console, Date, Math, Number, Array, JSON, isNaN, isFinite, parseFloat };
vm.createContext(ctxE);
vm.runInContext(baca('assets/js/engine-nine.js'), ctxE);
const E = ctxE.window.QuantumEngineNine;
cek('engine-nine mengekspor fungsi uji (hitungKonfluensi, penandaMarker, _uji.mentah)',
  !!E && typeof E.hitungKonfluensi === 'function' && typeof E.penandaMarker === 'function' && !!E._uji);
if (!E) process.exit(1);

// ── Pembuat candle ──────────────────────────────────────────────────────────
const JAM = 3600;
/** fase: [[jumlah, fn(j) → close], …]; bar pertama tiap fase "gap" (open = close sendiri). */
function bangun(fase, { mulai = 1.7e9, iv = JAM, lebar = 0.3 } = {}) {
  const out = []; let t = mulai;
  for (const [n, fn] of fase) {
    for (let j = 0; j < n; j++) {
      const c = fn(j);
      const o = j === 0 ? c : out[out.length - 1].close;
      out.push({ time: t, open: o, high: Math.max(o, c) + lebar, low: Math.min(o, c) - lebar, close: c });
      t += iv;
    }
  }
  return out;
}
const deret = (n, fn, opsi) => bangun([[n, fn]], opsi);
const emaSeri = (v, p) => { const k = 2 / (p + 1); const o = new Array(v.length).fill(null); if (v.length < p) return o; let e = 0; for (let i = 0; i < p; i++) e += v[i]; e /= p; o[p - 1] = e; for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); o[i] = e; } return o; };
const atr14 = (c) => { let s = 0; for (let i = c.length - 14; i < c.length; i++) { const x = c[i], p = c[i - 1]; s += Math.max(x.high - x.low, Math.abs(x.high - p.close), Math.abs(x.low - p.close)); } return s / 14; };

console.log('\n1. Panah Mesin 9 hanya untuk putusan BUY/SELL');
{
  // Contoh audit: suara sah BUY 85 + BUY 78 + SELL 60.
  const v = (arah, skor) => ({ arah, skor, valid: true });
  const k = E.hitungKonfluensi([v('BUY', 85), v('BUY', 78), v('SELL', 60)]);
  cek('contoh audit → putusan BELUM CUKUP BUKTI, skor 34, 3 setup sah', k.putusan === 'BELUM CUKUP BUKTI' && k.skor === 34 && k.setupValid === 3, k);
  cek('…dan TIDAK digambar (dulu: panah SELL merah "BELUM CUKUP BUKTI 34")', E.penandaMarker(k, 30) === null);
  const k2 = E.hitungKonfluensi([v('BUY', 70), v('SELL', 60), v('SELL', 65)]);
  cek('1 BUY + 2 SELL → BELUM CUKUP BUKTI, tanpa panah', k2.putusan === 'BELUM CUKUP BUKTI' && E.penandaMarker(k2, 0) === null, k2);
  const k3 = E.hitungKonfluensi([v('BUY', 70), v('BUY', 70), v('SELL', 70), v('SELL', 70), v('BUY', 70), v('SELL', 70)]);
  cek('3 BUY + 3 SELL → NETRAL, tanpa panah', k3.putusan === 'NETRAL' && E.penandaMarker(k3, 0) === null, k3.putusan);
  const kb = E.hitungKonfluensi([v('BUY', 70), v('BUY', 72), v('BUY', 68)]);
  const pb = E.penandaMarker(kb, 30);
  cek('3 BUY sepakat → panah hijau di bawah bar "BUY 70"', kb.putusan === 'BUY' && !!pb && pb.position === 'belowBar' && pb.shape === 'arrowUp' && pb.text === 'BUY 70', pb);
  const ks = E.hitungKonfluensi([v('SELL', 60), v('SELL', 60), v('SELL', 60)]);
  const ps = E.penandaMarker(ks, 30);
  cek('3 SELL sepakat → panah merah di atas bar "SELL 60"', !!ps && ps.position === 'aboveBar' && ps.shape === 'arrowDown' && ps.text === 'SELL 60', ps);
  cek('skor di bawah minSkor → tanpa panah', E.penandaMarker(kb, 71) === null);
  cek('TIDAK ADA SETUP → tanpa panah', E.penandaMarker(E.hitungKonfluensi([{ arah: 'NETRAL', skor: 0, valid: false }]), 0) === null);

  // Korpus deret nyata: markerSinyal tidak pernah menulis teks selain BUY/SELL.
  let s = 7; const acak = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const korpus = [];
  for (let k = 0; k < 6; k++) { let p = 100; korpus.push(deret(150, () => (p += (acak() - 0.48) * 1.6))); }
  korpus.push(deret(150, (i) => 100 + i * 0.5 + Math.sin(i / 4) * 1.8), deret(150, (i) => 200 - i * 0.5 + Math.sin(i / 4) * 1.8));
  const teks = [];
  for (const c of korpus) for (const m of E.markerSinyal(c, { jumlah: 60, minSkor: 0, jarak: 1 })) teks.push(m);
  cek(`markerSinyal pada ${korpus.length} deret: semua teks BUY/SELL dan warna/posisi konsisten (${teks.length} panah)`,
    teks.every((m) => /^(BUY|SELL) \d+$/.test(m.text) && (m.text[0] === 'B') === (m.position === 'belowBar')), teks.filter((m) => !/^(BUY|SELL) /.test(m.text)).slice(0, 3));
}

console.log('\n2a. EMA200 & GOLDEN_CROSS: keadaan tren tidak memberi suara');
{
  cek('SKOR_KEADAAN < AMBANG_SETUP', E.SKOR_KEADAAN < E.AMBANG_SETUP, [E.SKOR_KEADAAN, E.AMBANG_SETUP]);
  const naik = deret(260, (i) => 100 + i * 0.5 + Math.sin(i / 4) * 1.8);
  const e = E._uji.mentah('EMA200', naik), g = E._uji.mentah('GOLDEN_CROSS', naik);
  // Dulu: EMA200 50 dan GOLDEN_CROSS 52 — keduanya ≥ AMBANG_SETUP 50, dua suara dari satu fakta.
  cek('tren naik lama: EMA200 mentah = BUY skor SKOR_KEADAAN (dulu 50)', e.arah === 'BUY' && e.skor === E.SKOR_KEADAAN && /bukan pullback/.test(e.alasan), e);
  cek('tren naik lama: GOLDEN_CROSS mentah = BUY skor SKOR_KEADAAN (dulu 52)', g.arah === 'BUY' && g.skor === E.SKOR_KEADAAN && /bukan persilangan baru/.test(g.alasan), g);
  const h = E.evaluasi(naik);
  const m = (kode) => h.mesin.find((x) => x.kode === kode);
  cek('setelah gerbang keduanya NETRAL & tidak sah', m('EMA200').valid === false && m('GOLDEN_CROSS').valid === false && m('EMA200').arah === 'NETRAL');
  cek('alasan asli tetap terbaca setelah gerbang', /di bawah ambang setup/.test(m('EMA200').alasan) && /Tren naik/.test(m('EMA200').alasan), m('EMA200').alasan);
}

console.log('\n2b. Peristiwa yang memberi suara: pullback ≤1% & persilangan ≤5 bar');
{
  // Tren naik mapan lalu turun perlahan kembali ke EMA200: cari bar pertama yang berjarak ≤1%.
  const c = bangun([[240, (j) => 100 + j * 0.3 + Math.sin(j / 5) * 0.8], [80, (j) => 172 - j * 0.45 + Math.sin(j / 3) * 0.3]]);
  const cl = c.map((x) => x.close), e50 = emaSeri(cl, 50), e200 = emaSeri(cl, 200);
  let akhir = -1;
  for (let i = 240; i < c.length; i++) {
    const jarak = (cl[i] - e200[i]) / e200[i] * 100;
    const silang = (e50[i - 5] <= e200[i - 5]) !== (e50[i] <= e200[i]);
    if (cl[i] > e200[i] && e50[i] > e200[i] && jarak <= 1 && !silang) { akhir = i; break; }
  }
  cek('deret uji memang punya bar pullback ≤1% di atas EMA200', akhir > 0);
  if (akhir > 0) {
    const sl = c.slice(0, akhir + 1);
    const jarak = (cl[akhir] - e200[akhir]) / e200[akhir] * 100;
    const r = E._uji.mentah('EMA200', sl);
    cek(`pullback ${jarak.toFixed(2)}% → BUY skor round(85 − jarak×20) = ${Math.round(85 - jarak * 20)}`, r.arah === 'BUY' && r.skor === Math.round(85 - Math.abs(jarak) * 20) && /Pullback/.test(r.alasan), r);
    cek('skor peristiwa ≥ AMBANG_SETUP (memang memberi suara)', r.skor >= E.AMBANG_SETUP);
  }

  // Turun panjang lalu berbalik naik: potong 2 bar setelah EMA50 memotong ke atas EMA200.
  const x = bangun([[230, (j) => 200 - j * 0.45 + Math.sin(j / 4) * 0.5], [140, (j) => 96.5 + j * 1.6 + Math.sin(j / 4) * 0.5]]);
  const xc = x.map((q) => q.close), x50 = emaSeri(xc, 50), x200 = emaSeri(xc, 200);
  let silang = -1;
  for (let i = 200; i < x.length; i++) if (x50[i - 1] <= x200[i - 1] && x50[i] > x200[i]) { silang = i; break; }
  cek('deret uji memang punya golden cross', silang > 0);
  if (silang > 0) {
    const sl = x.slice(0, silang + 3);
    const g = E._uji.mentah('GOLDEN_CROSS', sl), e = E._uji.mentah('EMA200', sl);
    cek('golden cross 2 bar lalu → GOLDEN_CROSS BUY 88', g.arah === 'BUY' && g.skor === 88, g);
    cek('…dan EMA200 TIDAK ikut memilih fakta yang sama', e.skor < E.AMBANG_SETUP && /Golden Cross/.test(e.alasan), e);
    const lama = E._uji.mentah('GOLDEN_CROSS', x.slice(0, silang + 12));
    cek('10 bar kemudian persilangan sudah bukan peristiwa → SKOR_KEADAAN', lama.skor === E.SKOR_KEADAAN, lama);
  }

  // 200–204 bar: EMA200 lima bar lalu belum ada, jadi umur persilangan TIDAK diketahui.
  // Dulu: "…belum bisa dipastikan kapan bersilangan … — keadaan tren, bukan persilangan baru".
  const naik202 = deret(202, (i) => 100 + i * 0.5 + Math.sin(i / 4) * 1.8);
  const g202 = E._uji.mentah('GOLDEN_CROSS', naik202), e202 = E._uji.mentah('EMA200', naik202);
  cek('202 bar: GOLDEN_CROSS tidak menyimpulkan "bukan persilangan baru" saat umurnya tak diketahui',
    g202.arah === 'NETRAL' && g202.skor === 0 && /belum bisa dipastikan/.test(g202.alasan) && !/bukan persilangan baru/.test(g202.alasan) && /≥205 bar/.test(g202.alasan), g202);
  cek('202 bar: EMA200 tidak mengaku "tren mapan" (skor di bawah ambang)', e202.skor < E.AMBANG_SETUP && /belum bisa dipastikan/.test(e202.alasan), e202);
  const g205 = E._uji.mentah('GOLDEN_CROSS', deret(205, (i) => 100 + i * 0.5 + Math.sin(i / 4) * 1.8));
  cek('205 bar: umur diketahui → "sudah lebih dari 5 bar", SKOR_KEADAAN', g205.skor === E.SKOR_KEADAAN && /sudah lebih dari 5 bar/.test(g205.alasan), g205);

  // Sifat umum: di bar mana pun, EMA200 dan GOLDEN_CROSS tidak pernah memilih bersamaan.
  const korpus = [x, c, deret(320, (i) => 150 + Math.sin(i / 25) * 30 + Math.sin(i / 4)), deret(320, (i) => 150 - Math.sin(i / 30) * 40 + Math.cos(i / 5))];
  let dinilai = 0, ganda = 0;
  for (const d of korpus) {
    for (let akhir2 = 205; akhir2 <= d.length; akhir2 += 1) {
      const sl = d.slice(0, akhir2);
      const a = E._uji.mentah('EMA200', sl), b = E._uji.mentah('GOLDEN_CROSS', sl);
      dinilai++;
      if (a.skor >= E.AMBANG_SETUP && b.skor >= E.AMBANG_SETUP) ganda++;
    }
  }
  cek(`${dinilai} titik uji: EMA200 & GOLDEN_CROSS tidak pernah sama-sama ≥ ambang`, ganda === 0, ganda);
}

console.log('\n2c. Mesin momentum (TRENM5, MOMENTUM_NY, MACD_MOM) = paling banyak SATU bukti');
{
  const v = (kode, arah, skor) => ({ kode, arah, skor, valid: true });
  cek('KELOMPOK_BUKTI mengelompokkan ketiga mesin momentum', ['TRENM5', 'MOMENTUM_NY', 'MACD_MOM'].every((k) => E.KELOMPOK_BUKTI[k] === 'momentum'), E.KELOMPOK_BUKTI);
  // Contoh telaah ulang (jalan acak H1, bar 381): dulu putusan BUY dari tiga mesin ini saja.
  const k = E.hitungKonfluensi([v('TRENM5', 'BUY', 51), v('MOMENTUM_NY', 'BUY', 58), v('MACD_MOM', 'BUY', 60)]);
  cek('TRENM5 51 + MOMENTUM_NY 58 + MACD_MOM 60 saja → BELUM CUKUP BUKTI (dulu BUY)', k.putusan === 'BELUM CUKUP BUKTI' && k.bullish === 3 && k.buktiBullish === 1, k);
  cek('…tanpa panah, dan keyakinan menyebut sebabnya', E.penandaMarker(k, 0) === null && /momentum/.test(k.keyakinan), k.keyakinan);
  const k2 = E.hitungKonfluensi([v('TRENM5', 'BUY', 60), v('MACD_MOM', 'BUY', 70), v('SNR', 'BUY', 80)]);
  cek('2 momentum + 1 mesin lain = 2 bukti → BELUM CUKUP BUKTI', k2.putusan === 'BELUM CUKUP BUKTI' && k2.buktiBullish === 2, k2);
  const k3 = E.hitungKonfluensi([v('TRENM5', 'BUY', 60), v('MACD_MOM', 'BUY', 70), v('SNR', 'BUY', 80), v('ICHI', 'BUY', 82)]);
  cek('momentum + 2 mesin lain = 3 bukti → BUY', k3.putusan === 'BUY' && k3.buktiBullish === 3 && k3.bullish === 4, k3);
  // Sisi lawan juga dihitung per bukti: 3 bukti BUY vs trio momentum SELL (1 bukti) → dominasi 3 ≥ 2×1.
  const k4 = E.hitungKonfluensi([v('SNR', 'BUY', 85), v('SMC', 'BUY', 78), v('ICHI', 'BUY', 82), v('TRENM5', 'SELL', 55), v('MACD_MOM', 'SELL', 60), v('MOMENTUM_NY', 'SELL', 58)]);
  cek('3 bukti BUY vs trio momentum SELL → BUY (lawan = 1 bukti)', k4.putusan === 'BUY' && k4.buktiBearish === 1 && k4.bearish === 3, k4);
  cek('tanpa `kode` tiap hasil tetap satu bukti (kompatibel)', E.hitungKonfluensi([{ arah: 'BUY', skor: 70, valid: true }, { arah: 'BUY', skor: 70, valid: true }, { arah: 'BUY', skor: 70, valid: true }]).putusan === 'BUY');

  // Korpus: tak satu pun putusan BUY/SELL dari evaluasi() bersandar pada <3 bukti independen.
  let s = 999; const acak = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const iv = JAM, kini = Math.floor(Date.UTC(2026, 9, 22, 15, 30) / 1000), t0 = Math.floor(kini / iv) * iv - 399 * iv;
  const jalan = (drift, vol) => { const out = []; let c = 2000; for (let i = 0; i < 400; i++) { const o = c; c = c * (1 + drift + (acak() - 0.5) * vol); out.push({ time: t0 + i * iv, open: o, high: Math.max(o, c) * (1 + acak() * vol / 3), low: Math.min(o, c) * (1 - acak() * vol / 3), close: c }); } return out; };
  let putusan = 0, lemah = 0, contoh = null;
  for (let k5 = 0; k5 < 60; k5++) {
    const c = jalan((k5 % 5 - 2) * 0.0004, 0.004 + (k5 % 4) * 0.002);
    for (let akhir = 210; akhir <= 400; akhir += 6) {
      const sl = c.slice(0, akhir);
      const h = E.evaluasi(sl, { intervalDetik: iv, sekarangDetik: sl[sl.length - 1].time + 1800 });
      const p = h.konfluensi.putusan;
      if (p !== 'BUY' && p !== 'SELL') continue;
      putusan++;
      const searah = h.mesin.filter((m) => m.valid && m.arah === p);
      const bukti = new Set(searah.map((m) => E.KELOMPOK_BUKTI[m.kode] || m.kode)).size;
      if (bukti < E.MIN_SEPAKAT) { lemah++; contoh = contoh || { akhir, p, suara: searah.map((m) => m.kode + ':' + m.skor) }; }
    }
  }
  cek(`${putusan} putusan BUY/SELL pada 60 jalan acak: semuanya ≥ ${E.MIN_SEPAKAT} bukti independen`, putusan > 0 && lemah === 0, contoh);
}

console.log('\n2d. MOMENTUM_NY: bar yang sudah close, ≥0,3×ATR, jam dari waktu nyata');
{
  const t = (j, m = 0) => Date.UTC(2026, 9, 22, j, m) / 1000;
  /** 80 bar H1; delta[i] = perubahan close bar i (default 0), bar terakhir dibuka pukul `akhirJam`. */
  const buat = (delta, akhirT, iv = JAM) => {
    const n = 80; const out = []; let c = 100;
    for (let i = 0; i < n; i++) {
      const o = c; c = +(c + (delta[i - n] || delta[i] || 0)).toFixed(6);
      out.push({ time: akhirT - (n - 1 - i) * iv, open: o, high: Math.max(o, c) + 0.5, low: Math.min(o, c) - 0.5, close: c });
    }
    return out;
  };
  const M = (c, sekarang, iv = JAM) => E._uji.mentah('MOMENTUM_NY', c, { sekarangDetik: sekarang, intervalDetik: iv });

  // (a) bar berjalan melonjak +5, bar close terakhir hanya +0,1 → derau.
  const a = buat({ [-1]: 5, [-2]: 0.1 }, t(14));
  const atrA = atr14(a);
  const ra = M(a, t(14, 30));
  cek(`bar close +0,1 = ${(0.1 / atrA).toFixed(2)}×ATR (< 0,3) → SKOR_KEADAAN, tidak memilih (dulu BUY 58 dari bar berjalan +5)`, ra.skor === E.SKOR_KEADAAN && /derau/.test(ra.alasan), ra);
  // (b) bar close +2 (≥0,3×ATR), bar berjalan −0,5 → arah dari bar close: BUY.
  const b = buat({ [-1]: -0.5, [-2]: 2 }, t(14));
  const rb = M(b, t(14, 30));
  const kali = 2 / atr14(b);
  cek(`bar close +2 = ${kali.toFixed(2)}×ATR → BUY 58 walau bar berjalan turun (dulu SELL)`, rb.arah === 'BUY' && rb.skor === 58 && rb.alasan.includes(kali.toFixed(2) + '×ATR'), rb);
  // (c) H4: bar terakhir dibuka 12:00 UTC, sekarang 13:30 → DALAM sesi (dulu "jam bar 12" = di luar).
  const c4 = buat({ [-2]: 8 }, t(12), 4 * JAM);
  const rc = M(c4, t(13, 30), 4 * JAM);
  cek('H4 dibuka 12:00, sekarang 13:30 UTC → dalam sesi, BUY 58', rc.arah === 'BUY' && rc.skor === 58, rc);
  // (d) D1: bar dibuka 00:00 UTC, sekarang 15:00 → dalam sesi (dulu tidak pernah).
  const d1 = buat({ [-2]: 30 }, t(0), 86400);
  const rd = M(d1, t(15), 86400);
  cek('D1 dibuka 00:00, sekarang 15:00 UTC → dalam sesi (dulu tidak pernah)', rd.arah === 'BUY' && rd.skor === 58, rd);
  // (e) 21:00 UTC → di luar sesi; 20:59 masih di dalam.
  const e = buat({ [-2]: 2 }, t(21));
  cek('21:00 UTC → di luar sesi', M(e, t(21, 0)).arah === 'NETRAL' && /Di luar sesi/.test(M(e, t(21, 0)).alasan));
  const e2 = buat({ [-2]: 2 }, t(20));
  cek('20:59 UTC → masih dalam sesi', M(e2, t(20, 59)).skor === 58);
  // (f) data basi: bar terakhir dibuka 3 jam lalu, jam sekarang dalam sesi → tidak ada momentum berjalan.
  const f = buat({ [-2]: 2 }, t(11));
  const rf = M(f, t(14, 10));
  cek('data basi (bar terakhir 3 periode lalu) → NETRAL, bukan momentum Jumat lalu', rf.arah === 'NETRAL' && /lewat lebih dari satu periode/.test(rf.alasan), rf);
  // (g) bar terakhir sudah close (sekarang ≥ waktu buka + periode) → bar itu yang dibaca.
  const g = buat({ [-1]: -3, [-2]: 2 }, t(13));
  const rg = M(g, t(14, 20));
  cek('bar terakhir sudah close → arah dari bar itu (−3 → SELL)', rg.arah === 'SELL' && rg.skor === 58, rg);
}

console.log('\n3. Awan Ichimoku digeser 26 bar');
{
  cek('GESER_AWAN = 26', E.GESER_AWAN === 26);
  // Dataran tinggi 150 (di luar jendela 52 bar sekarang), dataran rendah 100, lalu naik ke 120.
  const c = bangun([[58, () => 150], [26, () => 100], [26, (j) => 100 + (j + 1) * 0.8]]);
  const n = c.length, harga = c[n - 1].close;
  const don = (end, len) => { let hi = -Infinity, lo = Infinity; for (let i = end - len + 1; i <= end; i++) { hi = Math.max(hi, c[i].high); lo = Math.min(lo, c[i].low); } return (hi + lo) / 2; };
  const tenkan = don(n - 1, 9), kijun = don(n - 1, 26);
  const lamaA = (tenkan + kijun) / 2, lamaB = don(n - 1, 52);
  const lamaBuy = harga > Math.max(lamaA, lamaB) && tenkan > kijun;
  const sa = (don(n - 27, 9) + don(n - 27, 26)) / 2, sb = don(n - 27, 52);
  const r = E._uji.mentah('ICHI', c);
  cek(`Senkou A/B mentah = jendela yang berakhir di bar n−27 (${sa.toFixed(2)} / ${sb.toFixed(2)})`, Math.abs(r.awan.senkouA - sa) < 1e-9 && Math.abs(r.awan.senkouB - sb) < 1e-9, r.awan);
  cek(`awan lama (tanpa geser, ${Math.min(lamaA, lamaB).toFixed(2)}–${Math.max(lamaA, lamaB).toFixed(2)}) memberi BUY 82 — inilah galatnya`, lamaBuy === true);
  cek(`harga ${harga.toFixed(2)} ada DI DALAM awan yang benar → tidak memilih`, r.arah === 'NETRAL' && harga <= Math.max(sa, sb) && harga >= Math.min(sa, sb), r);
  cek('alasan menyebut batas awan yang dipakai', r.alasan.includes(Math.min(sa, sb).toFixed(2)) && r.alasan.includes(Math.max(sa, sb).toFixed(2)), r.alasan);
  const h = E.evaluasi(c.slice(0, 77));
  const ichi = h.mesin.find((m) => m.kode === 'ICHI');
  cek('butuh 78 bar (52 + 26): dengan 77 bar menolak menilai', /Butuh 78 bar, tersedia 77/.test(ichi.alasan), ichi.alasan);
  cek('teks alasan tidak memuat "<" yang terbaca sebagai tag HTML', !/<[A-Za-z]/.test(baca('assets/js/engine-nine.js').split(/\r?\n/).filter((l) => /alasan:/.test(l)).join('\n')));
}

console.log('\n4. Ringkasan Signal Matrix — aturan dominasi');
{
  const app = baca('assets/js/dashboard-app.js');
  const ctx = { console, String };
  vm.createContext(ctx);
  vm.runInContext(potong(app, 'function qiRingkasanMatriks(', 'async function fetchSignalMatrix(') + '\nglobalThis.Q = qiRingkasanMatriks;', ctx);
  const Q = (a) => ctx.Q(a).summary;
  const kasus = [
    [['BUY', 'BUY', 'SELL', 'SELL'], 'NEUTRAL', '2 BUY / 2 SELL (dulu BUY hijau)'],
    [['BUY', 'STRONG_BUY', 'BUY', 'SELL'], 'BUY', '3 BUY + 1 SELL (dulu STRONG BUY)'],
    [['BUY', 'STRONG_BUY', 'BUY', 'NEUTRAL'], 'STRONG BUY', '3 BUY tanpa SELL'],
    [['SELL', 'SELL', 'BUY', 'NEUTRAL'], 'SELL', '2 SELL + 1 BUY'],
    [['SELL', 'STRONG_SELL', 'SELL', 'NO_DATA'], 'STRONG SELL', '3 SELL tanpa BUY'],
    [['SELL', 'SELL', 'SELL', 'BUY'], 'SELL', '3 SELL + 1 BUY (dulu STRONG SELL)'],
    [['BUY', 'SELL', 'NEUTRAL', 'NO_DATA'], 'NEUTRAL', '1 BUY / 1 SELL'],
    [['BUY', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL'], 'NEUTRAL', '1 BUY saja'],
  ];
  for (const [masuk, harap, ket] of kasus) cek(`${ket} → ${harap}`, Q(masuk) === harap, Q(masuk));
  cek('Signal Matrix memakai qiRingkasanMatriks', /qiRingkasanMatriks\(tfKeys\.map\(tf => tfs\[tf\]\?\.signal \|\| 'NEUTRAL'\)\)/.test(app));
  const blok = potong(app, 'async function refreshAutoSignals(', 'const arahTampil');
  cek('Auto Signal mencocokkan summary persis, tidak lagi includes(\'BUY\')',
    /summary === 'BUY' \|\| summary === 'STRONG BUY'/.test(blok) && !/summary\.includes\('BUY'\)/.test(blok));
}

console.log('\n5. Penanda `simulated` bertahan melewati sinkron chart, dan semua pemakai menolaknya');
{
  const app = baca('assets/js/dashboard-app.js');
  const kodeSync = potong(app, 'const _ohlcSync =', "setInterval(() => { if (_activePanel === 'panel-charts') updateOhlcBar(); }, 2500);");
  const sekarang = Math.floor(Date.now() / 1000);
  const nyata = (n, akhirT) => Array.from({ length: n }, (_, i) => { const c = 2650 + Math.sin(i / 5) * 5; return { time: akhirT - (n - 1 - i) * JAM, open: c - 1, high: c + 2, low: c - 2, close: c, volume: 0 }; });
  function siapkan(lokal, jawab) {
    const catat = { setData: 0, event: [], fetch: 0 };
    const ctx = {
      console, Date, Math, JSON, Promise, Number, Array, Object,
      updateOhlcSourceBadge() {}, _ohlcHover: false,
      WL_GROUPS: [{ syms: [{ tv: 'OANDA:XAUUSD', key: 'XAUUSD' }] }], _tvSymbol: 'OANDA:XAUUSD', _tvInterval: '60',
      _lastPrices: {}, DP: {}, _lwRsi: null, _lwCandlesMeta: null,
      _lwSeries: { setData() { catat.setData++; }, update() {} },
      _lwLastCandles: lokal,
      document: { getElementById: () => null },
      perbaruiVolume() {}, _calcRSI: () => [], drawAutoIndicators() {},
      CustomEvent: function (nama, o) { this.type = nama; this.detail = o && o.detail; },
      fetch: async () => { catat.fetch++; return { json: async () => jawab }; },
    };
    ctx.window = { dispatchEvent(e) { catat.event.push(e.type); } };
    vm.createContext(ctx);
    vm.runInContext(kodeSync + '\nglobalThis.sinkron = updateOhlcBar; globalThis.jadwal = _ohlcSync;', ctx);
    return { ctx, catat };
  }
  const acak = (n, akhirT) => ({ status: 'success', simulated: true, source: 'simulasi', candles: nyata(n, akhirT).map((c) => ({ ...c, close: c.close * 1.3 })) });
  const asli = (n, akhirT) => ({ status: 'success', source: 'oanda', candles: nyata(n, akhirT) });

  return (async () => {
    // (a) Chart sudah simulasi, server masih simulasi dan punya bar baru → penanda HARUS bertahan.
    {
      const lokal = Object.assign(nyata(200, sekarang - 2 * JAM), { simulated: true });
      const { ctx, catat } = siapkan(lokal, acak(201, sekarang - JAM));
      await ctx.sinkron(); await tunggu();
      cek('chart simulasi + bar baru simulasi → data diganti DAN penanda simulated tetap ada (dulu hilang)',
        catat.setData === 1 && ctx._lwLastCandles !== lokal && ctx._lwLastCandles.simulated === true, { setData: catat.setData, simulated: ctx._lwLastCandles.simulated });
      // Rantai ke pemakai: setelah satu siklus sinkron, ketiganya menolak.
      const hasil = E.evaluasi(ctx._lwLastCandles);
      cek('…Mesin 9 lalu menolak menilai (cukupData false, simulasi true)', hasil.cukupData === false && hasil.simulasi === true && hasil.konfluensi === null, hasil.alasan);
      cek('…markerSinyal tidak membuat panah', E.markerSinyal(ctx._lwLastCandles, { minSkor: 0 }).length === 0);
      const QS = require(path.join(root, 'assets/js/qim-setups.js'));
      const d = QS.deteksi('SMC', ctx._lwLastCandles);
      cek('…Setup Analisa (QIMSetups.deteksi) tidak menghasilkan setup', d.setups.length === 0 && /simulasi/i.test(d.catatan), d.catatan);
    }
    // (b) Chart NYATA, server tiba-tiba hanya punya candle acak → candle nyata DIPERTAHANKAN.
    {
      const lokal = nyata(200, sekarang - 2 * JAM);
      const { ctx, catat } = siapkan(lokal, acak(201, sekarang - JAM));
      await ctx.sinkron(); await tunggu();
      cek('chart nyata tidak pernah ditukar candle acak', catat.setData === 0 && ctx._lwLastCandles === lokal && ctx._lwLastCandles.simulated !== true, catat);
      cek('…label sumber tidak berubah menjadi "simulasi"', ctx._lwCandlesMeta === null);
    }
    // (c) Chart simulasi, data nyata kembali (jumlah bar berbeda) → diganti seluruhnya, tanpa penanda.
    {
      const lokal = Object.assign(nyata(201, sekarang - 2 * JAM), { simulated: true });
      const { ctx, catat } = siapkan(lokal, asli(150, sekarang - 2 * JAM));
      await ctx.sinkron(); await tunggu();
      cek('data nyata kembali → chart diganti seluruhnya walau jumlah bar lebih sedikit', catat.setData === 1 && ctx._lwLastCandles.length === 150 && ctx._lwLastCandles.simulated !== true, { setData: catat.setData, n: ctx._lwLastCandles.length });
      cek('…dan modul lain diberi tahu (qi-chart-data) supaya gambar lama dibuang', catat.event.includes('qi-chart-data'), catat.event);
    }
    // (e) Telaah ulang G3b: bar simulasi terakhir masih MUDA (10 menit, H1) dan server sudah
    //     menyajikan data nyata → diganti SEKARANG. Dulu gerbang "batang baru" menahannya sampai
    //     periode bar simulasi habis (H1: 1 jam, D1: 24 jam) sehingga semua pemakai tetap menolak.
    {
      const lokal = Object.assign(nyata(200, sekarang - 600), { simulated: true });
      const { ctx, catat } = siapkan(lokal, asli(200, sekarang - 600));
      await ctx.sinkron(); await tunggu();
      cek('chart simulasi dengan bar muda + data nyata kembali → langsung diganti (dulu menunggu batang baru)',
        catat.fetch === 1 && catat.setData === 1 && ctx._lwLastCandles.simulated !== true && catat.event.includes('qi-chart-data'), { fetch: catat.fetch, setData: catat.setData, event: catat.event });
    }
    // (f) Bar simulasi muda dan server MASIH simulasi → tetap ditanya (tiap 60 dtk), tetapi deret
    //     acak tidak ditukar deret acak lain sebelum batang baru memang waktunya.
    {
      const lokal = Object.assign(nyata(200, sekarang - 600), { simulated: true });
      const { ctx, catat } = siapkan(lokal, acak(200, sekarang));
      await ctx.sinkron(); await tunggu();
      const jeda = ctx.jadwal.boleh - Date.now() / 1000;
      cek('masih simulasi: server ditanya, chart tidak diganti, tanya lagi ±60 dtk',
        catat.fetch === 1 && catat.setData === 0 && ctx._lwLastCandles === lokal && jeda > 55 && jeda <= 61, { fetch: catat.fetch, setData: catat.setData, jeda });
    }
    // (g) Kontrol: chart NYATA dengan bar muda → gerbang batang baru tetap berlaku (tidak ada unduhan).
    {
      const lokal = nyata(200, sekarang - 600);
      const { ctx, catat } = siapkan(lokal, asli(200, sekarang - 600));
      await ctx.sinkron(); await tunggu();
      cek('kontrol: chart nyata dengan bar muda → tidak mengunduh ulang (hemat kuota)', catat.fetch === 0 && catat.setData === 0);
    }
    // (d) Kontrol: nyata → nyata dengan bar baru tetap seperti biasa.
    {
      const lokal = nyata(200, sekarang - 2 * JAM);
      const { ctx, catat } = siapkan(lokal, asli(201, sekarang - JAM));
      await ctx.sinkron(); await tunggu();
      cek('kontrol: nyata → nyata dengan bar baru tetap disinkronkan', catat.setData === 1 && ctx._lwLastCandles.length === 201 && ctx._lwLastCandles.simulated !== true);
    }

    // Panel Setup Analisa: candle simulasi → deteksi tidak pernah dipanggil, statusnya jujur.
    {
      const status = { innerHTML: '' }, list = { innerHTML: 'lama', querySelectorAll: () => [], querySelector: () => null };
      const doc = {
        readyState: 'complete', getElementById: (id) => ({ qimSetupStatus: status, qimSetupList: list })[id] || null,
        querySelectorAll: () => [], addEventListener() {},
      };
      const win = { addEventListener() {}, qiTingkatSaatIni: () => 2 };
      const ctx = { window: win, document: doc, console, Math, Number, Object, String, Array, Set, Map, JSON, Date };
      vm.createContext(ctx);
      vm.runInContext(baca('assets/js/qim-setups.js'), ctx);
      vm.runInContext(baca('assets/js/qim-setup-panel.js'), ctx);
      let dipanggil = 0;
      const asliDeteksi = win.QIMSetups.deteksi;
      win.QIMSetups.deteksi = (...a) => { dipanggil++; return asliDeteksi(...a); };
      const seri = { attachPrimitive() {}, detachPrimitive() {}, createPriceLine: () => ({}), removePriceLine() {} };
      win.qiChartKonteks = () => ({ series: seri, candles: Object.assign(nyata(120, sekarang), { simulated: true }), symbol: 'XAUUSD', interval: '60' });
      win.QIMSetupPanel.jalankan('SMC');
      cek('Setup Analisa: candle simulasi → deteksi tidak dipanggil, status menyebut SIMULASI', dipanggil === 0 && /SIMULASI/.test(status.innerHTML) && list.innerHTML === '', { dipanggil, status: status.innerHTML });
      win.qiChartKonteks = () => ({ series: seri, candles: nyata(120, sekarang), symbol: 'XAUUSD', interval: '60' });
      win.QIMSetupPanel.jalankan('SMC');
      cek('kontrol: candle nyata → deteksi dipanggil', dipanggil === 1, dipanggil);
    }

    // Indikator Pine (port): candle simulasi → tidak dihitung; candle nyata → dihitung.
    {
      const buatEl = () => {
        const anak = {};
        return {
          className: '', innerHTML: '', textContent: '', hidden: false, isConnected: true,
          classList: { add() {}, toggle() {} }, addEventListener() {}, appendChild() {}, remove() {},
          querySelector(sel) { return (anak[sel] = anak[sel] || { innerHTML: '', textContent: '' }); }, anak,
        };
      };
      const wadah = buatEl();
      const timer = [];
      const doc = {
        getElementById: (id) => (id === 'tv_chart_container' ? wadah : null), createElement: () => (wadah.tabel = buatEl()),
        querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible',
      };
      const seri = () => ({ setData() {}, attachPrimitive() {}, detachPrimitive() {} });
      const win = {
        addEventListener() {}, matchMedia: () => ({ matches: false }), _lwModules: { LineSeries: {} },
      };
      const ctx = {
        window: win, document: doc, console, Math, Number, Object, String, Array, Set, Map, JSON, Date, Promise,
        localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => 0 },
        setTimeout: (fn) => { timer.push(fn); return timer.length; }, clearTimeout() {}, setInterval() {},
        fetch: async () => ({ json: async () => ({ status: 'error' }) }),
      };
      vm.createContext(ctx);
      vm.runInContext(baca('assets/js/qim-pine-smcsnd.js'), ctx);
      vm.runInContext(baca('assets/js/qim-indikator-kustom.js'), ctx);
      const chart = { addSeries: () => seri() };
      const s = seri();
      let lilin = Object.assign(deret(400, (i) => 2600 + Math.sin(i / 9) * 20 + i * 0.1), { simulated: true });
      win.qiChartKonteks = () => ({ chart, series: s, candles: lilin, symbol: 'XAUUSD', interval: '60', source: 'simulasi' });
      const jalan = async () => { while (timer.length) { const f = timer.shift(); await f(); } for (let i = 0; i < 5; i++) await tunggu(); };
      win.QIMIndikatorKustom.nyalakan();
      await jalan();
      const info = wadah.tabel && wadah.tabel.anak['.qim-pk-info'];
      cek('Pine: candle simulasi → tidak ada hasil hitung', win.QIMIndikatorKustom.hasil() === null);
      cek('…tabel mengatakan SIMULASI (tidak ditimpa catatan "memakai N bar chart")', !!info && /SIMULASI/.test(info.textContent), info && info.textContent);
      lilin = deret(400, (i) => 2600 + Math.sin(i / 9) * 20 + i * 0.1);
      win.QIMIndikatorKustom.matikan(); win.QIMIndikatorKustom.nyalakan();
      await jalan();
      const h = win.QIMIndikatorKustom.hasil();
      cek('kontrol: candle nyata → indikator dihitung', !!h && h.ok === true, h && h.pesan);
    }

    console.log('\n6. Halaman depan');
    const idx = baca('assets/js/halaman-index.js');
    // Pemeriksaan "sudah tidak ada" memakai kode tanpa komentar: catatan sejarah boleh menyebut nama lamanya.
    const idxKode = idx.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/.*$/, '')).join('\n');
    {
      cek('blok "Live Trade Ideas" (api/signals.php, kolom `signal` yang tidak ada) sudah dihapus',
        !/api\/signals\.php/.test(idxKode) && !/refreshIdeas/.test(idxKode));
      cek('catatan metodologi tidak lagi mengaku spread belum dikurangkan (penilai v2/v3 menguranginya)',
        !/spread\/komisi belum dikurangkan/.test(idxKode) && /versi 2 spread dikurangkan/.test(idxKode));
      // Jalankan blok kartu sinyal (IIFE pertama) dengan riwayat buatan.
      const blok = idx.slice(idx.indexOf('(function(){'), idx.lastIndexOf('(function(){', idx.indexOf('var COLORS')));
      const kartu = [];
      const grid = { innerHTML: '', appendChild(el) { kartu.push(el); } };
      const kini = Date.now() / 1000;
      const riwayat = [
        // String lama tanpa zona "lebih tua" daripada B, padahal epoch-nya paling baru.
        { id: 'A', symbol: 'XAUUSD', side: 'BUY', timeframe: 'H1', timestamp: '2020-01-01 01:00:00', timestamp_epoch: Math.round(kini - 600), entry: 1, sl: 0.5, tp: 2, status: 'AKTIF' },
        { id: 'B', symbol: 'EURUSD', side: 'SELL', timeframe: 'H1', timestamp: '2026-10-22T05:00:00Z', timestamp_epoch: Math.round(kini - 2 * 3600), entry: 1, sl: 2, tp: 0.5, status: 'AKTIF' },
        // Format yang tak terbaca (Safari: NaN) — epoch tetap mengurutkannya dengan benar.
        { id: 'C', symbol: 'BTCUSDT', side: 'BUY', timeframe: 'H4', timestamp: 'bukan-tanggal', timestamp_epoch: Math.round(kini - 3 * 86400), entry: 1, sl: 0.5, tp: 2, status: 'AKTIF' },
      ];
      const ctx = {
        console, Math, Number, String, Array, Date, isNaN, isFinite, JSON,
        document: { getElementById: (id) => (id === 'tradeIdeasGrid' ? grid : null), createElement: () => ({ className: '', innerHTML: '' }) },
        window: { location: {} }, AbortSignal: { timeout: () => undefined },
        fetch: async () => ({ json: async () => ({ status: 'success', history: riwayat }) }),
      };
      vm.createContext(ctx);
      vm.runInContext(blok, ctx);
      for (let i = 0; i < 5; i++) await tunggu();
      const urut = kartu.map((k) => (/XAU\/USD/.test(k.innerHTML) ? 'A' : /EUR\/USD/.test(k.innerHTML) ? 'B' : 'C'));
      cek('urutan dari timestamp_epoch: A (10 mnt) → B (2 jam) → C (3 hari)', urut.join('') === 'ABC', urut);
      cek('umur dari epoch: "10 menit lalu", "2 jam lalu", "3 hari lalu"',
        /10 menit lalu/.test(kartu[0] && kartu[0].innerHTML) && /2 jam lalu/.test(kartu[1] && kartu[1].innerHTML) && /3 hari lalu/.test(kartu[2] && kartu[2].innerHTML));
    }
    {
      // Kartu "LIVE SIGNAL READOUT": RSI Wilder bersama, prasyarat yang benar-benar dihitung,
      // dan saat gagal TIDAK mengarang status "SETUP TERBENTUK".
      const mulai = idx.indexOf('const SIGNAL_PAIRS');
      const akhir = idx.lastIndexOf('fetchLiveSignal();', idx.indexOf('setInterval(fetchLiveSignal'));
      const kode = idx.slice(mulai, akhir);
      const el = {};
      const ambil = (id) => (el[id] = el[id] || { textContent: '', innerHTML: '', className: '' });
      let jawab = null;
      const ctx = {
        console, Math, Number, Array, String, isFinite, parseFloat, Promise,
        document: { getElementById: ambil },
        fetch: async (url) => { if (!jawab) throw new Error('jaringan'); return { ok: true, json: async () => (/ticker/.test(url) ? jawab.ticker : jawab.kline) }; },
      };
      vm.createContext(ctx);
      vm.runInContext(kode + '\nglobalThis.muat = fetchLiveSignal;', ctx);
      const kline = Array.from({ length: 200 }, (_, i) => { const c = 100 + Math.sin(i / 3) * 2; return [0, String(c - 0.2), String(c + 0.5), String(c - 0.5), String(c)]; });
      const rsiHarap = E.rsiWilder(kline.map((k) => ({ open: +k[1], high: +k[2], low: +k[3], close: +k[4] })), 14);
      jawab = { ticker: { lastPrice: '100', priceChangePercent: '1.5' }, kline };
      await ctx.muat();
      cek(`BUY SETUP dengan RSI Wilder bersama (${rsiHarap.toFixed(0)})`, el.sigStatus.textContent === 'BUY SETUP' && el.sigMode.textContent.includes('RSI ' + rsiHarap.toFixed(0)), [el.sigStatus.textContent, el.sigMode.textContent]);
      cek('prasyarat = "2 dari 2 syarat" (dulu "N dari 8 Syarat" yang dikarang dari RSI)', el.sigConditions.textContent === '2 dari 2 syarat', el.sigConditions.textContent);
      // Telaah ulang G3b: BUY/SELL tidak lagi mengaku "trend bullish H1" / "Quantum Momentum" (tidak
      // dihitung), entry bukan rentang ±0,1% karangan, SL/TP disebut jarak TETAP.
      cek('BUY: teks hanya menyebut yang dihitung (gerak 24 jam & RSI), tanpa "trend … H1"/"Quantum"',
        /gerak 24 jam \+1\.50%/.test(el.sigMode.textContent) && !/trend|Quantum|SNR/i.test(el.sigMode.textContent) && /jarak tetap/.test(el.sigMode.textContent), el.sigMode.textContent);
      cek('BUY: entry = harga terakhir apa adanya (dulu rentang ±0,1%)', /\(harga terakhir\)$/.test(el.sigEntry.textContent) && !/–/.test(el.sigEntry.textContent), el.sigEntry.textContent);
      cek('BUY: SL/TP/R:R diberi label "tetap"', /tetap\)$/.test(el.sigSL.textContent) && /tetap\)$/.test(el.sigTP.textContent) && /\(jarak tetap\)$/.test(el.sigRR.textContent), [el.sigSL.textContent, el.sigTP.textContent, el.sigRR.textContent]);
      jawab = { ticker: { lastPrice: '100', priceChangePercent: '0.3' }, kline };
      await ctx.muat();
      cek('WAIT: hanya syarat RSI yang terpenuhi → "1 dari 2 syarat"', el.sigStatus.textContent === 'WAIT — KONSOLIDASI' && el.sigConditions.textContent === '1 dari 2 syarat', el.sigConditions.textContent);
      // Dulu WAIT tetap memajang SL −0,60% / TP +1,80% / R:R 1 : 3.0 dan "Quantum SNR Rejection".
      cek('WAIT: TIDAK ada angka entry/SL/TP/R:R (semua "—")', ['sigEntry', 'sigSL', 'sigTP', 'sigRR'].every((id) => el[id].textContent === '—'), ['sigEntry', 'sigSL', 'sigTP', 'sigRR'].map((id) => el[id].textContent));
      cek('WAIT: teks mengatakan tidak ada setup dan level tidak ditampilkan', /Tidak ada setup/.test(el.sigMode.textContent) && /tidak ditampilkan/.test(el.sigMode.textContent) && !/SNR|breakout/.test(el.sigMode.textContent), el.sigMode.textContent);
      // Gerak 24 jam lolos tetapi RSI sudah ekstrem: itu bukan "konsolidasi".
      const klineNaik = Array.from({ length: 200 }, (_, i) => { const c = 100 + i * 0.5; return [0, String(c - 0.5), String(c + 0.2), String(c - 0.6), String(c)]; });
      jawab = { ticker: { lastPrice: '200', priceChangePercent: '2.5' }, kline: klineNaik };
      await ctx.muat();
      cek('gerak +2,5% tetapi RSI ekstrem → "WAIT — RSI EKSTREM" tanpa angka level', el.sigStatus.textContent === 'WAIT — RSI EKSTREM' && ['sigEntry', 'sigSL', 'sigTP', 'sigRR'].every((id) => el[id].textContent === '—'), [el.sigStatus.textContent, el.sigSL.textContent]);
      jawab = null;
      await ctx.muat();
      cek('gagal memuat → "DATA BELUM TERSEDIA", bukan "SETUP TERBENTUK"', el.sigStatus.textContent === 'DATA BELUM TERSEDIA' && !/SETUP TERBENTUK/.test(idxKode), el.sigStatus.textContent);
      cek('…dan angka pair sebelumnya dikosongkan', ['sigEntry', 'sigSL', 'sigTP', 'sigRR', 'sigConditions'].every((id) => el[id].textContent === '—'));
    }
  })().then(() => {
    console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — sinyal klien: panah Mesin 9, bukti independen, Ichimoku, Signal Matrix, penanda simulasi, halaman depan');
    process.exit(gagal ? 1 : 0);
  }).catch((e) => { console.error(e); process.exit(1); });
}
