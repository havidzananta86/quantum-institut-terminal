/**
 * Kartu Quick Trade di rail kanan: harga sisi beli/jual, stepper lot & SL/TP,
 * perkiraan untung/rugi, dan pengiriman order ke akun yang benar.
 *
 * Fungsi aslinya diambil dari assets/js/dashboard-app.js dan dijalankan di sandbox vm
 * dengan DOM tiruan — yang diuji perilakunya, bukan ada/tidaknya teks.
 *
 * Run:  node tests/quick-trade.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const JS = fs.readFileSync(path.join(root, 'assets/js/dashboard-app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'assets/css/qim-dashboard.css'), 'utf8');

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

const mulai = JS.indexOf("const QT = { akun: 'sim', arah: 'BUY' };");
const akhir = JS.indexOf('/** Akun tujuan formulir');
cek('blok Quick Trade ditemukan', mulai > 0 && akhir > mulai);
if (mulai < 0 || akhir < mulai) { console.error('\nFAIL'); process.exit(1); }
const BLOK = JS.slice(mulai, akhir);

function sandbox(opsi = {}) {
  const nilai = Object.assign({ qtLot: '0.01', qtSL: '', qtTP: '' }, opsi.input || {});
  const el = {};
  const ambil = (id) => {
    if (!el[id]) el[id] = {
      value: nilai[id] !== undefined ? nilai[id] : '', textContent: '', _kelas: new Set(),
      classList: { toggle(k, on) { on ? el[id]._kelas.add(k) : el[id]._kelas.delete(k); }, contains: (k) => el[id]._kelas.has(k) },
    };
    return el[id];
  };
  const jejak = { toast: [], sim: [], real: [] };
  const ctx = {
    document: { getElementById: ambil },
    window: { addEventListener() {} },
    DP: { XAUUSD: 2, EURUSD: 5 },
    _lastPrices: opsi.harga || { XAUUSD: { price: '4123.74', bid: '4123.69', ask: '4123.79' } },
    qiSimbolChart: () => (opsi.simbol !== undefined ? opsi.simbol : 'XAUUSD'),
    ptPnlMult: (sym) => (sym === 'XAUUSD' ? 100 : 100000),
    ptOpenDirectPosition: (...a) => jejak.sim.push(a),
    // qtSegarkan() kini ikut menggambar saldo & daftar posisi.
    _ptPositions: opsi.posisi || [],
    _ptBalance: opsi.saldo !== undefined ? opsi.saldo : 10000,
    QIAksi: { arg: (v) => JSON.stringify([v]).replace(/"/g, '&quot;') },
    ptKirimOrderReal: (o) => jejak.real.push(o),
    showQuantumToast: (pesan, jenis) => jejak.toast.push({ pesan, jenis }),
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(BLOK, ctx);
  return { ctx, jejak, el: ambil };
}

console.log('Harga sisi beli & jual');
{
  const s = sandbox();
  const h = s.ctx.qtHarga();
  cek('BUY memakai ask', h.beli === 4123.79, h.beli);
  cek('SELL memakai bid', h.jual === 4123.69, h.jual);
  cek('ditandai sebagai bid/ask nyata', h.nyata === true);

  const t = sandbox({ harga: { XAUUSD: { price: '4123.74' } } });
  const th = t.ctx.qtHarga();
  cek('tanpa bid/ask: kedua sisi memakai harga tengah (tidak mengarang spread)', th.beli === 4123.74 && th.jual === 4123.74);
  cek('ditandai BUKAN bid/ask nyata', th.nyata === false);

  const k = sandbox({ harga: {} });
  cek('tanpa data harga → null, bukan nol', k.ctx.qtHarga().beli === null);
}

console.log('\nLangkah per simbol');
{
  const s = sandbox();
  cek('XAUUSD satu pip = 0.1', Math.abs(s.ctx.qtLangkah('XAUUSD') - 0.1) < 1e-9);
  cek('EURUSD satu pip = 0.0001', Math.abs(s.ctx.qtLangkah('EURUSD') - 0.0001) < 1e-12);
}

console.log('\nStepper');
{
  const s = sandbox();
  s.ctx.qtStep(null, null, 'qtLot', 1);
  cek('lot naik 0.01', s.el('qtLot').value === '0.02', s.el('qtLot').value);
  s.ctx.qtStep(null, null, 'qtLot', -1);
  s.ctx.qtStep(null, null, 'qtLot', -1);
  s.ctx.qtStep(null, null, 'qtLot', -1);
  cek('lot tidak pernah negatif', parseFloat(s.el('qtLot').value) >= 0, s.el('qtLot').value);

  const t = sandbox();
  t.ctx.qtStep(null, null, 'qtSL', -1);
  cek('SL kosong → diisi dari harga sekarang, bukan dari nol', t.el('qtSL').value === '4123.79', t.el('qtSL').value);
  t.ctx.qtStep(null, null, 'qtSL', -1);
  cek('tekan lagi → turun satu pip', t.el('qtSL').value === '4123.69', t.el('qtSL').value);

  const u = sandbox({ harga: {} });
  u.ctx.qtStep(null, null, 'qtSL', 1);
  cek('tanpa harga live, stepper tidak mengisi apa pun', u.el('qtSL').value === '');
}

console.log('\nPerkiraan untung / rugi');
{
  // BUY XAUUSD @ 4123.79 · 0.10 lot · mult 100 → 1 dolar gerak = $10
  const s = sandbox({ input: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
  s.ctx.qtHitung();
  const t = s.el('qtInfo').textContent;
  cek('est. untung dihitung dari TP', /Est\. untung \$200\.00/.test(t), t);
  cek('est. rugi dihitung dari SL', /Est\. rugi \$100\.00/.test(t), t);
  cek('R:R ditampilkan', /R:R 1:2\.00/.test(t), t);
  cek('dinyatakan kotor, belum dikurangi biaya', /kotor, belum dikurangi spread & komisi/.test(t), t);
}
{
  const s = sandbox({ input: { qtLot: '0.10', qtSL: '4200', qtTP: '4300' } });
  s.ctx.qtHitung();
  cek('BUY dengan SL di atas harga → diperingatkan, bukan diberi angka', /SL harus di BAWAH/.test(s.el('qtInfo').textContent), s.el('qtInfo').textContent);
}
{
  const s = sandbox({ input: { qtLot: '0.10', qtSL: '4000', qtTP: '4200' } });
  vm.runInContext('QT.arah = "SELL"', s.ctx); s.ctx.qtSegarkan();
  cek('SELL dengan SL di bawah harga → diperingatkan', /SL harus di ATAS/.test(s.el('qtInfo').textContent), s.el('qtInfo').textContent);
}
{
  const s = sandbox({ harga: {} });
  s.ctx.qtHitung();
  cek('tanpa harga live → "Menunggu harga live."', s.el('qtInfo').textContent === 'Menunggu harga live.');
}
{
  const s = sandbox({ input: { qtLot: '0.10' } });
  s.ctx.qtHitung();
  cek('tanpa SL/TP → diminta mengisinya', /Isi SL dan TP/.test(s.el('qtInfo').textContent));
}

console.log('\nTampilan mengikuti akun & arah');
{
  const s = sandbox();
  s.ctx.qtSegarkan();
  cek('simbol chart ditampilkan', s.el('qtSym').textContent === 'XAUUSD');
  cek('harga BUY ditampilkan dengan 2 desimal', s.el('qtBuyHarga').textContent === '4123.79');
  cek('harga SELL ditampilkan', s.el('qtSellHarga').textContent === '4123.69');
  cek('BUY aktif secara bawaan', s.el('qtBuy').classList.contains('is-active') && !s.el('qtSell').classList.contains('is-active'));
  cek('saldo simulasi ditampilkan', /^\$/.test(s.el('qtSaldo').textContent), s.el('qtSaldo').textContent);
  cek('keterangan bawaan menegaskan simulasi', /tanpa uang sungguhan/i.test(s.el('qtNota').textContent));

  s.ctx.qtSetAkun(null, null, 'real');
  cek('mode real ditandai pada keterangan', s.el('qtNota').classList.contains('is-real'));
  cek('mode real: keterangan jadi peringatan', /[Uu]ang sungguhan/.test(s.el('qtNota').textContent) && s.el('qtNota').classList.contains('is-real'));
  cek('tab akun real ditandai aktif', s.el('qtAkunReal').classList.contains('is-active') && !s.el('qtAkunSim').classList.contains('is-active'));

  vm.runInContext('QT.arah = "SELL"', s.ctx); s.ctx.qtSegarkan();
  cek('arah tersimpan di state', vm.runInContext('QT.arah', s.ctx) === 'SELL');
  s.ctx.qtSetAkun(null, null, 'sim');
  cek('kembali ke simulasi: penanda real dilepas', !s.el('qtNota').classList.contains('is-real'));
}

console.log('\nMengirim order');
{
  const s = sandbox({ input: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
  s.ctx.qtKirim();
  cek('akun simulasi → posisi simulasi dibuka', s.jejak.sim.length === 1 && s.jejak.real.length === 0);
  const a = s.jejak.sim[0] || [];
  cek('argumen simulasi benar (simbol, arah, entry, SL, TP, lot)', a[0] === 'XAUUSD' && a[1] === 'BUY' && a[2] === 4123.79 && a[3] === 4113.79 && a[4] === 4143.79 && a[5] === 0.1, a);
  cek('pengguna diberi tahu', s.jejak.toast.some(t => t.jenis === 'success'));
}
{
  const s = sandbox({ input: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
  s.ctx.qtSetAkun(null, null, 'real');
  s.ctx.qtKirim();
  cek('akun real → diteruskan ke jalur order real', s.jejak.real.length === 1 && s.jejak.sim.length === 0);
  const o = s.jejak.real[0];
  cek('muatan real memakai harga ask untuk BUY', o && o.entryPrice === 4123.79 && o.side === 'BUY' && o.lots === 0.1, o);
}
{
  const s = sandbox({ input: { qtLot: '0.10' } });
  vm.runInContext('QT.arah = "SELL"', s.ctx); s.ctx.qtSegarkan();
  s.ctx.qtKirim();
  cek('SELL memakai harga bid', (s.jejak.sim[0] || [])[2] === 4123.69, s.jejak.sim[0]);
}
{
  const s = sandbox({ simbol: '' });
  s.ctx.qtKirim();
  cek('tanpa simbol chart → tidak ada order', s.jejak.sim.length === 0 && s.jejak.real.length === 0);
  cek('alasannya disampaikan', s.jejak.toast.some(t => /simbol/i.test(t.pesan)));
}
{
  const s = sandbox({ harga: {} });
  s.ctx.qtKirim();
  cek('tanpa harga live → tidak ada order', s.jejak.sim.length === 0);
}
{
  const s = sandbox({ input: { qtLot: '0' } });
  s.ctx.qtKirim();
  cek('lot nol ditolak', s.jejak.sim.length === 0 && s.jejak.toast.some(t => /Lot/i.test(t.pesan)));
}

// == Tiga bug yang dilaporkan pemilik produk (2026-10-21) ====================
console.log('\nBUY/SELL = tombol order, satu tekan satu order');
{
  const s = sandbox({ input: { qtLot: '0.10' } });
  s.ctx.qtOrder(null, null, 'SELL');
  cek('menekan SELL langsung mengirim order', s.jejak.sim.length === 1, s.jejak.sim.length);
  cek('arahnya SELL', (s.jejak.sim[0] || [])[1] === 'SELL', s.jejak.sim[0]);
  cek('SELL memakai harga bid', (s.jejak.sim[0] || [])[2] === 4123.69);
  const t = sandbox({ input: { qtLot: '0.10' } });
  t.ctx.qtOrder(null, null, 'BUY');
  cek('menekan BUY langsung mengirim order', t.jejak.sim.length === 1);
  cek('BUY memakai harga ask', (t.jejak.sim[0] || [])[2] === 4123.79);
  cek('tidak ada lagi tombol "Place Order" terpisah', !/id="qtKirim"/.test(HTML));
}

console.log('\nPosisi terbuka tampil beserta tombol Tutup');
{
  const posisi = [
    { id: 'P1', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, sl: null, tp: null },
    { id: 'P2', symbol: 'XAUUSD', side: 'SELL', lots: 0.2, entryPrice: 4130, sl: null, tp: null },
  ];
  const s = sandbox({ posisi });
  s.ctx.qtRenderPosisi();
  const html = s.el('qtPosisi').innerHTML || '';
  cek('kedua posisi dirender', (html.match(/qim-qt-pos"/g) || []).length === 2);
  cek('ada tombol Tutup untuk tiap posisi', (html.match(/qim-qt-tutup/g) || []).length === 2);
  cek('tombol Tutup memanggil ptClosePosition', /data-qi-aksi="ptClosePosition"/.test(html));
  cek('id posisi diteruskan ke tombolnya', /P1/.test(html) && /P2/.test(html));
  cek('jumlah posisi ditampilkan', s.el('qtPosisiJml').textContent === '2', s.el('qtPosisiJml').textContent);

  const kosong = sandbox({ posisi: [] });
  kosong.ctx.qtRenderPosisi();
  cek('tanpa posisi -> pesan jelas', /Belum ada posisi terbuka/.test(kosong.el('qtPosisi').innerHTML || ''));
  cek('jumlah posisi 0', kosong.el('qtPosisiJml').textContent === '0');
}

console.log('\nSaldo simulasi bergerak');
{
  const s = sandbox({ saldo: 10000, posisi: [{ id: 'P1', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100 }] });
  s.ctx.qtSaldo();
  cek('saldo ditampilkan dengan format uang', s.el('qtSaldo').textContent === '$10,000.00', s.el('qtSaldo').textContent);
  cek('P/L mengambang dihitung dari harga berjalan', s.el('qtFloat').textContent === '+$237.40', s.el('qtFloat').textContent);
  cek('mengambang positif ditandai naik', s.el('qtFloat').className === 'naik');

  const r = sandbox({ saldo: 9500, posisi: [{ id: 'P1', symbol: 'XAUUSD', side: 'SELL', lots: 0.1, entryPrice: 4100 }] });
  r.ctx.qtSaldo();
  cek('posisi SELL yang rugi ditandai turun', r.el('qtFloat').className === 'turun', r.el('qtFloat').textContent);
  cek('saldo mengikuti nilai sebenarnya', r.el('qtSaldo').textContent === '$9,500.00');

  const n = sandbox({ saldo: 10000, posisi: [] });
  n.ctx.qtSaldo();
  cek('tanpa posisi -> mengambang nol', n.el('qtFloat').textContent === '+$0.00');
}

cek('menutup posisi dari mana pun menyegarkan Quick Trade', /qtSaldo\(\); qtRenderPosisi\(\);/.test(JS));

// ── Kontrak markup & gaya ────────────────────────────────────────────────────
console.log('\nMarkup & gaya');
for (const id of ['qtSym', 'qtAkunSim', 'qtAkunReal', 'qtBuy', 'qtSell', 'qtBuyHarga', 'qtSellHarga', 'qtLot', 'qtSL', 'qtTP', 'qtInfo', 'qtSaldo', 'qtFloat', 'qtPosisi', 'qtPosisiJml', 'qtNota']) {
  cek(`dashboard.html punya #${id}`, new RegExp(`id="${id}"`).test(HTML));
}
cek('kartu Quick Trade berada di dalam rail kanan', /id="qimRightPanel"[\s\S]{0,400}qim-qt-card/.test(HTML));
cek('kartu Quick Trade adalah kartu PERTAMA di rail kanan', /id="qimRightPanel"[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<section class="qim-card qim-qt-card"/.test(HTML));
cek('semua aksi memakai delegasi CSP-safe (tanpa on*=)', /data-qi-aksi="qtOrder"/.test(HTML) && /data-qi-aksi="qtSetAkun"/.test(HTML) && /data-qi-aksi="qtStep"/.test(HTML));
cek('gaya kartu ada di qim-dashboard.css', /\.qim-qt-card/.test(CSS) && /\.qim-qt-kirim\.is-real/.test(CSS));
cek('Quick Trade disegarkan berkala', /try \{ qtSegarkan\(\); \} catch \(e\) \{\}\s*\}, 5000\);/.test(JS));

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — Quick Trade: harga sisi, stepper, perkiraan, dan tujuan order');
process.exit(gagal ? 1 : 0);
