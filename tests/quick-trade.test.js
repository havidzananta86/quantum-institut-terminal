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
  s.ctx.qtSetArah(null, null, 'SELL');
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
  cek('tombol kirim bawaan bukan mode real', s.el('qtKirim').textContent === 'Place Order · BUY' && !s.el('qtKirim').classList.contains('is-real'));
  cek('keterangan bawaan menegaskan simulasi', /tanpa uang sungguhan/i.test(s.el('qtNota').textContent));

  s.ctx.qtSetAkun(null, null, 'real');
  cek('mode real: tombol berubah dan ditandai is-real', s.el('qtKirim').textContent === 'KIRIM BUY REAL' && s.el('qtKirim').classList.contains('is-real'));
  cek('mode real: keterangan jadi peringatan', /[Uu]ang sungguhan/.test(s.el('qtNota').textContent) && s.el('qtNota').classList.contains('is-real'));
  cek('tab akun real ditandai aktif', s.el('qtAkunReal').classList.contains('is-active') && !s.el('qtAkunSim').classList.contains('is-active'));

  s.ctx.qtSetArah(null, null, 'SELL');
  cek('ganti arah ikut mengubah tombol', s.el('qtKirim').textContent === 'KIRIM SELL REAL');
  s.ctx.qtSetAkun(null, null, 'sim');
  cek('kembali ke simulasi: penanda real dilepas', !s.el('qtKirim').classList.contains('is-real') && !s.el('qtNota').classList.contains('is-real'));
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
  s.ctx.qtSetArah(null, null, 'SELL');
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

// ── Kontrak markup & gaya ────────────────────────────────────────────────────
console.log('\nMarkup & gaya');
for (const id of ['qtSym', 'qtAkunSim', 'qtAkunReal', 'qtBuy', 'qtSell', 'qtBuyHarga', 'qtSellHarga', 'qtLot', 'qtSL', 'qtTP', 'qtInfo', 'qtKirim', 'qtNota']) {
  cek(`dashboard.html punya #${id}`, new RegExp(`id="${id}"`).test(HTML));
}
cek('kartu Quick Trade berada di dalam rail kanan', /id="qimRightPanel"[\s\S]{0,400}qim-qt-card/.test(HTML));
cek('kartu Quick Trade adalah kartu PERTAMA di rail kanan', /id="qimRightPanel"[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<section class="qim-card qim-qt-card"/.test(HTML));
cek('semua aksi memakai delegasi CSP-safe (tanpa on*=)', /data-qi-aksi="qtKirim"/.test(HTML) && /data-qi-aksi="qtSetAkun"/.test(HTML) && /data-qi-aksi="qtStep"/.test(HTML));
cek('gaya kartu ada di qim-dashboard.css', /\.qim-qt-card/.test(CSS) && /\.qim-qt-kirim\.is-real/.test(CSS));
cek('Quick Trade disegarkan berkala', /try \{ qtSegarkan\(\); \} catch \(e\) \{\}\s*\}, 5000\);/.test(JS));

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — Quick Trade: harga sisi, stepper, perkiraan, dan tujuan order');
process.exit(gagal ? 1 : 0);
