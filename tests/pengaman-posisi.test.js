/**
 * Pengaman posisi di klien (assets/js/qim-trading-tools.js → guardTick): break-even, trailing, dan
 * percepatan penyelesaian SL/TP — KEMUDAHAN untuk posisi MANUAL saja. SL/TP sendiri ditegakkan SERVER
 * (api/paper-trading.php → qi_paper_settle, ditiru oleh server di tests/paper-sandbox.js).
 *
 * Temuan audit yang dikunci di sini:
 *   · posisi AUTO/AI (dikelola server) tidak digeser SL-nya dan tidak diminta ditutup dari klien;
 *   · SL/TP tersentuh → klien MEMINTA server menyelesaikan (GET), tidak mengirim 'tutup' sendiri —
 *     dulu posisi tercatat 'manual' di level yang mungkin tidak pernah disentuh feed server; kabar
 *     "Stop loss tersentuh … ditutup server @ …" datang SEKALI, setelah server menutupnya;
 *   · permintaan itu dibatasi (≤ 1 per 10 detik; posisi yang tetap terbuka ditunggu 30 detik) → tanpa 429;
 *   · SL break-even/trailing yang DITOLAK server: SL di layar dikembalikan ke nilai server, dan pemeriksaan
 *     SL/TP posisi itu TETAP berjalan (dulu satu jeda 60 detik mematikan keduanya);
 *   · batas dinilai di harga PENUTUPAN (BUY di bid, SELL di ask) dari feed yang dipakai server;
 *   · status hanya menghitung posisi yang benar-benar punya harga ("dipantau"), sisanya disebut.
 *
 * qim-trading-tools.js dijalankan di sandbox yang SAMA dengan blok Paper Trading asli
 * (tests/paper-sandbox.js) — ptMintaPenyelesaianServer / ptUbahSlTp / ptHargaNilai sungguhan, server tiruan.
 * Run:  node tests/pengaman-posisi.test.js
 */
'use strict';
const { sandbox, baca } = require('./paper-sandbox.js');

const TOOLS = baca('assets/js/qim-trading-tools.js');
const HTML = baca('dashboard.html');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};
const POS = (id, extra) => Object.assign({ id, symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, sl: null, tp: null, src: 'manual' }, extra);
const XAU = (bid, ask) => ({ price: String(((bid + ask) / 2).toFixed(3)), bid: String(bid), ask: String(ask) });

/** Sandbox paper (state sudah dimuat) + pengaman dengan preferensi tertentu. */
async function siapkan(posisi, prefs = {}, harga) {
  const s = sandbox();
  s.server.posisi = posisi.map((p) => Object.assign({}, p));
  // Harga server diatur SEBELUM halaman dimuat: server menyelesaikan SL/TP di setiap GET, termasuk muat pertama.
  if (harga) s.harga('XAUUSD', harga.d);
  s.picu('load');
  await s.tunggu();
  // Harga klien (umurnya) diatur SEBELUM pengaman dimuat: init() langsung menjalankan guardTick sekali.
  // Muat pertama juga mengambil kutipan kanonik segar — umur diterapkan lagi sesudahnya.
  if (harga) s.harga('XAUUSD', harga.d, harga.umur || 0);
  const simpan = { qim_paper_guard: JSON.stringify(Object.assign({ breakEven: false, beAt: 1, trailing: false, trailBy: 1 }, prefs)) };
  s.ctx.localStorage = { getItem: (k) => (k in simpan ? simpan[k] : null), setItem: (k, v) => { simpan[k] = String(v); } };
  s.jalankan(TOOLS);
  const jaga = s.jejak.interval.find((x) => x.ms === 2000);
  s.detakJaga = async () => { jaga.f(); await s.tunggu(60); };
  s.tutup = () => s.server.post.filter((b) => b.aksi === 'tutup');
  s.ubah = () => s.server.post.filter((b) => b.aksi === 'ubah');
  s.status = () => s.el('qtGuardStatus').textContent;
  return s;
}

(async () => {
  console.log('SL/TP tersentuh → server yang menyelesaikan (bukan "tutup" dari klien)');
  {
    // Dimuat saat bid 4123.73 / ask 4123.75 (belum menyentuh); lalu pasar bergerak: bid 4123.69 ≤ SL BUY 4123.72,
    // ask 4123.79 ≥ SL SELL 4123.76 (SL yang sudah dikunci di bawah entry). Harga TENGAH 4123.74 tidak menyentuh
    // keduanya — BUY dinilai di bid, SELL di ask.
    const s = await siapkan([POS('POS-1', { sl: 4123.72 }), POS('POS-2', { side: 'SELL', entryPrice: 4150, sl: 4123.76 })], {}, { d: XAU(4123.73, 4123.75) });
    cek('awal: belum ada yang ditutup', s.server.posisi.length === 2);
    s.server.harga.XAUUSD = XAU(4123.69, 4123.79);
    s.harga('XAUUSD', XAU(4123.69, 4123.79));
    const getAwal = s.server.get, toastAwal = s.jejak.toast.length;
    await s.detakJaga();
    cek('klien TIDAK mengirim aksi tutup', s.tutup().length === 0, s.server.post);
    cek('server diminta menyelesaikan: SATU GET untuk kedua posisi', s.server.get === getAwal + 1, s.server.get - getAwal);
    const r = s.server.riwayat;
    cek('server menutup keduanya dengan sebab SL di harga penutupan (BUY @ bid 4123.69, SELL @ ask 4123.79)',
      r.length === 2 && r.every((h) => h.closeReason === 'sl') && r.find((h) => h.id === 'POS-1').closePrice === 4123.69 && r.find((h) => h.id === 'POS-2').closePrice === 4123.79, r);
    const t = s.jejak.toast.slice(toastAwal);
    cek('diumumkan SEKALI per posisi, setelah server menutupnya', t.filter((x) => /Stop loss tersentuh — BUY XAUUSD 0\.10 lot ditutup server @ 4123\.69/.test(x.pesan)).length === 1
      && t.filter((x) => /Stop loss tersentuh — SELL XAUUSD 0\.10 lot ditutup server @ 4123\.79/.test(x.pesan)).length === 1 && t.length === 2, t);
    cek('posisi hilang dari daftar klien', s.jalankan('_ptPositions.length') === 0);
  }
  {
    const s = await siapkan([POS('POS-1', { sl: 4123.70 })], {}, { d: XAU(4123.71, 4123.77) });
    const getAwal = s.server.get;
    await s.detakJaga();
    cek('bid di atas SL → tidak ada permintaan sama sekali', s.server.get === getAwal && s.tutup().length === 0);
  }
  {
    const s = await siapkan([POS('POS-1', { tp: 4130 })], {}, { d: XAU(4120, 4120.1) });
    s.server.harga.XAUUSD = XAU(4131, 4131.1);
    s.harga('XAUUSD', XAU(4131, 4131.1));
    await s.detakJaga();
    cek('TP tersentuh → ditutup server di level TP, diumumkan "Take profit tersentuh"', s.server.riwayat[0] && s.server.riwayat[0].closeReason === 'tp' && s.jejak.toast.some((x) => /^Take profit tersentuh — BUY XAUUSD 0\.10 lot ditutup server @ 4130/.test(x.pesan)), [s.server.riwayat, s.jejak.toast]);
  }

  console.log('\nFeed klien menyentuh, feed server tidak → server yang menang, tanpa banjir permintaan');
  {
    // Klien (kutipan lama) melihat bid 4123.69 ≤ SL 4125; feed server sudah kembali ke 4130.
    const s = await siapkan([POS('POS-1', { sl: 4125 })], {}, { d: XAU(4130, 4130.1) });
    s.harga('XAUUSD', XAU(4123.69, 4123.79));
    s.server.harga.XAUUSD = XAU(4130, 4130.1);
    const getAwal = s.server.get;
    await s.detakJaga();
    cek('server diminta sekali', s.server.get === getAwal + 1);
    cek('server TIDAK menutupnya (feed eksekusinya tidak menyentuh SL) — klien tidak menutup sendiri', s.server.posisi.length === 1 && s.tutup().length === 0);
    cek('tidak ada kabar "tersentuh" untuk posisi yang tidak ditutup', !s.jejak.toast.some((x) => /tersentuh/.test(x.pesan)), s.jejak.toast);
    s.harga('XAUUSD', XAU(4123.69, 4123.79));   // klien masih melihat harga di bawah SL
    await s.detakJaga();
    await s.detakJaga();
    await s.detakJaga();
    cek('detak berikutnya (< 30 detik) TIDAK meminta lagi', s.server.get === getAwal + 1, s.server.get - getAwal);
  }

  console.log('\nPasar tutup / harga basi → tidak dinilai, dan status mengatakannya');
  {
    const s = await siapkan([POS('POS-1', { sl: 4125 })], {}, { d: Object.assign(XAU(4123.69, 4123.79), { market: 'closed' }) });
    const getAwal = s.server.get;
    await s.detakJaga();
    cek('pasar tutup → tidak ada permintaan', s.server.get === getAwal && s.tutup().length === 0);
    cek('status menyebut pasar tutup, bukan "dipantau"', /^0 dari 1 posisi manual dipantau · 1 pasar tutup/.test(s.status()), s.status());
    // Kutipan klien 120 detik (di bawah SL); feed server di atas SL.
    const b = await siapkan([POS('POS-1', { sl: 4125 })], {}, { d: XAU(4130, 4130.1) });
    b.harga('XAUUSD', XAU(4123.69, 4123.79), 120);
    b.server.harga.XAUUSD = XAU(4130, 4130.1);
    const getB = b.server.get;
    await b.detakJaga();
    cek('harga basi (120 detik) → tidak ada permintaan', b.server.get === getB && b.tutup().length === 0);
    cek('status: 0 dipantau, 1 tanpa harga live (dulu "1 posisi manual dipantau")', /^0 dari 1 posisi manual dipantau · 1 tanpa harga live · SL\/TP ditegakkan server/.test(b.status()), b.status());
  }

  console.log('\nPosisi AUTO/AI dikelola server');
  {
    const s = await siapkan([
      POS('POS-7', { src: 'auto', sl: 4125, tp: 4110 }),
      POS('POS-8', { src: 'ai', sl: 4090 }),
    ], { breakEven: true, trailing: true });
    await s.detakJaga();
    await s.detakJaga();
    cek('SL tersentuh pada posisi AUTO → klien TIDAK menutupnya', s.tutup().length === 0, s.server.post);
    cek('break-even/trailing TIDAK menggeser SL posisi AI di layar', s.jalankan('_ptPositions.find(p => p.id === "POS-8").sl') === 4090);
    cek('tidak ada aksi ubah untuk posisi otomatis', s.ubah().length === 0);
    cek('tidak ada toast berulang untuk posisi otomatis', !s.jejak.toast.some((x) => /otomatis dikelola server/.test(x.pesan)));
    cek('status hanya menghitung posisi manual', s.status() === 'Tidak ada posisi manual terbuka.', s.status());
  }

  console.log('\nBreak-even: diumumkan setelah server menyimpan SL baru');
  {
    // BUY 4100, SL 4090 (risiko 10). Bid 4123.69 → untung 23.69 ≥ 1R → SL ke harga masuk.
    const s = await siapkan([POS('POS-1', { sl: 4090 })], { breakEven: true });
    const awal = s.jejak.toast.length;
    await s.detakJaga();
    cek('SL digeser ke harga masuk dan disimpan lewat aksi ubah', s.ubah().length === 1 && s.ubah()[0].sl === 4100, s.ubah());
    cek('toast "SL digeser" muncul setelah server menerima', s.jejak.toast.slice(awal).some((x) => /SL digeser ke 4100 \(break-even\)/.test(x.pesan)));
    cek('SL server = 4100', s.server.posisi[0].sl === 4100);
    cek('status menyebut posisi yang dipantau dan yang dilindungi', /^1 dari 1 posisi manual dipantau · SL\/TP ditegakkan server · 1 dengan BE\/trailing$/.test(s.status()), s.status());
  }

  console.log('\nSL baru DITOLAK server: SL dikembalikan, pemeriksaan SL/TP tetap berjalan');
  {
    const g = await siapkan([POS('POS-1', { sl: 4090 })], { breakEven: true });
    g.server.tolakBerikut = { status: 422, body: { status: 'ditolak', message: 'Untuk BUY, stop loss harus di BAWAH harga.', kode: 'sltp' } };
    await g.detakJaga();
    await g.tunggu(60);
    cek('tidak ada toast "SL digeser"', !g.jejak.toast.some((x) => /SL digeser/.test(x.pesan)), g.jejak.toast);
    cek('SL di layar dikembalikan ke nilai SERVER (4090), bukan SL yang ditolak (4100)', g.jalankan('_ptPositions[0].sl') === 4090, g.jalankan('_ptPositions[0].sl'));
    const ubahSebelum = g.ubah().length;
    await g.detakJaga();
    cek('selama jeda simpan: SL tidak digeser/dikirim ulang (tanpa 429)', g.ubah().length === ubahSebelum, g.ubah().length);
    // Harga jatuh ke bawah SL server 4090: dulu posisi ini DILEWATI 60 detik penuh (tanpa auto-exit).
    g.server.harga.XAUUSD = XAU(4089, 4089.1);
    g.harga('XAUUSD', XAU(4089, 4089.1));
    const getAwal = g.server.get;
    await g.detakJaga();
    cek('SL tersentuh selama jeda simpan → server tetap diminta & menutupnya', g.server.get > getAwal && g.server.riwayat.some((h) => h.id === 'POS-1' && h.closeReason === 'sl'), g.server.riwayat);
  }

  console.log('\nMarkup');
  cek('pilihan "SL/TP otomatis" yang menyesatkan sudah dibuang', !/id="qtGuardExit"/.test(HTML));
  cek('panel menyatakan SL/TP ditegakkan server', /SL\/TP: ditegakkan server/.test(HTML) && /ditegakkan server di feed eksekusinya/.test(HTML));
  cek('qim-trading-tools.js tidak lagi menutup posisi lewat ptClosePosition', !/window\.ptClosePosition\(/.test(TOOLS));

  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — pengaman posisi: manual saja, server menyelesaikan SL/TP, jeda terpisah, status jujur');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
