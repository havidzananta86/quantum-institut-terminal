/**
 * Kartu Quick Trade di rail kanan: harga sisi beli/jual, stepper lot & SL/TP,
 * perkiraan untung/rugi, tujuan order, mode Real MT5, dan paket FREE.
 *
 * Blok Paper Trading ASLI dari assets/js/dashboard-app.js dijalankan di sandbox vm
 * (tests/paper-sandbox.js) bersama dispatcher qim-aksi.js yang sebenarnya — yang diuji
 * perilakunya, bukan ada/tidaknya teks.
 *
 * Run:  node tests/quick-trade.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { sandbox } = require('./paper-sandbox.js');

const root = path.join(__dirname, '..');
const JS = fs.readFileSync(path.join(root, 'assets/js/dashboard-app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'assets/css/qim-dashboard.css'), 'utf8');

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

/** Sandbox dengan state paper sudah "dimuat" (seperti sesudah GET sukses). */
function sb(opsi = {}) {
  const s = sandbox(opsi);
  if (opsi.posisi) s.jalankan('_ptPositions = ' + JSON.stringify(opsi.posisi));
  if (opsi.dimuat !== false) s.jalankan('_ptDimuatPada = Date.now(); _ptBalance = ' + (opsi.saldo !== undefined ? opsi.saldo : 10000));
  if (opsi.harga) { s.kosongkanHarga(); for (const [k, v] of Object.entries(opsi.harga)) s.harga(k, v); }
  return s;
}
/** Order yang benar-benar dikirim ke server tiruan (aksi buka). */
const buka = (s) => s.server.post.filter((b) => b.aksi === 'buka');

(async () => {
  console.log('Harga sisi beli & jual');
  {
    const s = sb();
    const h = s.ctx.qtHarga();
    cek('BUY memakai ask', h.beli === 4123.79, h.beli);
    cek('SELL memakai bid', h.jual === 4123.69, h.jual);
    cek('ditandai sebagai bid/ask nyata', h.nyata === true);

    const t = sb({ harga: { XAUUSD: { price: '4123.74' } } });
    const th = t.ctx.qtHarga();
    cek('tanpa bid/ask: kedua sisi memakai harga tengah (tidak mengarang spread)', th.beli === 4123.74 && th.jual === 4123.74);
    cek('ditandai BUKAN bid/ask nyata', th.nyata === false);

    const k = sb({ harga: {} });
    cek('tanpa data harga → null, bukan nol', k.ctx.qtHarga().beli === null);
  }

  console.log('\nLangkah per simbol');
  {
    const s = sb();
    cek('XAUUSD satu pip = 0.1', Math.abs(s.ctx.qtLangkah('XAUUSD') - 0.1) < 1e-9);
    cek('EURUSD satu pip = 0.0001', Math.abs(s.ctx.qtLangkah('EURUSD') - 0.0001) < 1e-12);
    // Dulu 0.1 per klik untuk BTC/ETH — tombol −/+ SL kripto praktis tidak berguna.
    cek('BTCUSDT (±85.000): langkah relatif harga = 10', s.ctx.qtLangkah('BTCUSDT', 84700) === 10, s.ctx.qtLangkah('BTCUSDT', 84700));
    cek('ETHUSDT (±3.000): langkah = 1', s.ctx.qtLangkah('ETHUSDT', 3012.5) === 1);
    cek('DOGEUSDT (±0,15): langkah = 0.0001', Math.abs(s.ctx.qtLangkah('DOGEUSDT', 0.152) - 0.0001) < 1e-12);
  }

  console.log('\nStepper');
  {
    const s = sb();
    s.ctx.qtStep(null, null, 'qtLot', 1);
    cek('lot naik 0.01', s.el('qtLot').value === '0.02', s.el('qtLot').value);
    for (let i = 0; i < 4; i++) s.ctx.qtStep(null, null, 'qtLot', -1);
    cek('lot tidak pernah di bawah 0.01', s.el('qtLot').value === '0.01', s.el('qtLot').value);

    const t = sb();
    t.ctx.qtStep(null, null, 'qtSL', -1);
    // BUY & SELL kini dua tombol order: SL kosong diisi dari harga TENGAH, bukan sisi tombol terakhir.
    cek('SL kosong → diisi dari harga tengah sekarang, bukan dari nol', t.el('qtSL').value === '4123.74', t.el('qtSL').value);
    t.ctx.qtStep(null, null, 'qtSL', -1);
    cek('tekan lagi → turun satu pip', t.el('qtSL').value === '4123.64', t.el('qtSL').value);

    const u = sb({ harga: {} });
    u.ctx.qtStep(null, null, 'qtSL', 1);
    cek('tanpa harga live, stepper tidak mengisi apa pun', u.el('qtSL').value === '');
  }

  console.log('\nPerkiraan untung / rugi — level SL/TP menentukan arahnya');
  {
    // BUY XAUUSD @ ask 4123.79 · 0.10 lot · mult 100 → 1 dolar gerak = $10
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
    s.ctx.qtHitung();
    const t = s.el('qtInfo').textContent;
    cek('level di bawah/atas harga → dikenali sebagai BUY', /untuk BUY/.test(t), t);
    cek('est. untung dihitung dari TP', /Est\. untung \$200\.00/.test(t), t);
    cek('est. rugi dihitung dari SL', /Est\. rugi \$100\.00/.test(t), t);
    cek('R:R ditampilkan', /R:R 1:2\.00/.test(t), t);
    cek('dinyatakan kotor, belum dikurangi biaya', /kotor, belum dikurangi spread & komisi/.test(t), t);
    cek('mengingatkan bahwa tombol lawannya akan ditolak', /SELL akan ditolak/.test(t), t);
  }
  {
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4133.69', qtTP: '4103.69' } });
    s.ctx.qtHitung();
    const t = s.el('qtInfo').textContent;
    cek('SL di atas & TP di bawah → dikenali sebagai SELL (dihitung dari bid)', /untuk SELL/.test(t) && /Est\. untung \$200\.00/.test(t) && /Est\. rugi \$100\.00/.test(t), t);
  }
  {
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4200', qtTP: '4300' } });
    s.ctx.qtHitung();
    cek('SL & TP sama-sama di atas harga → diperingatkan, bukan diberi angka', /tidak cocok untuk arah mana pun/.test(s.el('qtInfo').textContent), s.el('qtInfo').textContent);
  }
  {
    const s = sb({ harga: {} });
    s.ctx.qtHitung();
    cek('tanpa harga live → "Menunggu harga live."', s.el('qtInfo').textContent === 'Menunggu harga live.');
  }
  {
    const s = sb({ nilai: { qtLot: '0.10' } });
    s.ctx.qtHitung();
    cek('tanpa SL/TP → diminta mengisinya', /Isi SL dan TP/.test(s.el('qtInfo').textContent));
  }

  console.log('\nTampilan mengikuti akun — tidak ada lagi tombol yang diredupkan');
  {
    const s = sb();
    s.ctx.qtSegarkan();
    cek('simbol chart ditampilkan', s.el('qtSym').textContent === 'XAUUSD');
    cek('harga BUY ditampilkan dengan 2 desimal', s.el('qtBuyHarga').textContent === '4123.79');
    cek('harga SELL ditampilkan', s.el('qtSellHarga').textContent === '4123.69');
    // 03f153a: SELL tampil 52% (":not(.is-active)") sejak halaman dibuka — dikira tidak bisa ditekan.
    cek('BUY dan SELL tidak diberi status "aktif"/"tidak aktif"', !s.el('qtBuy').classList.contains('is-active') && !s.el('qtSell').classList.contains('is-active'));
    cek('kedua tombol dapat ditekan', !s.el('qtBuy').disabled && !s.el('qtSell').disabled);
    cek('saldo simulasi ditampilkan', /^\$/.test(s.el('qtSaldo').textContent), s.el('qtSaldo').textContent);
    cek('keterangan bawaan menegaskan simulasi', /tanpa uang sungguhan/i.test(s.el('qtNota').textContent));

    s.ctx.qtSetAkun(null, null, 'real');
    cek('mode real ditandai pada keterangan', s.el('qtNota').classList.contains('is-real'));
    cek('mode real: keterangan jadi peringatan', /[Uu]ang sungguhan/.test(s.el('qtNota').textContent));
    cek('tab akun real ditandai aktif', s.el('qtAkunReal').classList.contains('is-active') && !s.el('qtAkunSim').classList.contains('is-active'));
    cek('mode real: SELURUH kartu ditandai (is-real → border merah + lencana REAL)', s.el('qtKartu').classList.contains('is-real'));
    cek('mode real: saldo SIMULASI disembunyikan', s.el('qtSaldoBaris').hidden === true);
    cek('mode real: daftar posisi SIMULASI disembunyikan', s.el('qtPosisiBlok').hidden === true);
    cek('mode real: petunjuk ke panel Eksekusi MT5 tampil', s.el('qtRealInfo').hidden === false);
    cek('mode real: tooltip BUY menyebut uang sungguhan', /UANG SUNGGUHAN/.test(s.el('qtBuy').title), s.el('qtBuy').title);

    s.ctx.qtSetAkun(null, null, 'sim');
    cek('kembali ke simulasi: penanda real dilepas', !s.el('qtNota').classList.contains('is-real') && !s.el('qtKartu').classList.contains('is-real'));
    cek('kembali ke simulasi: saldo & posisi tampil lagi, petunjuk real disembunyikan', !s.el('qtSaldoBaris').hidden && !s.el('qtPosisiBlok').hidden && s.el('qtRealInfo').hidden);
  }

  console.log('\nPaket FREE');
  {
    const s = sb({ tingkat: 0, dimuat: false });
    s.ctx.qtSegarkan();
    cek('BUY & SELL nonaktif di mode simulasi (server menolak non-PRO)', s.el('qtBuy').disabled && s.el('qtSell').disabled);
    cek('keterangan menyebut paket PRO', /PRO/.test(s.el('qtNota').textContent), s.el('qtNota').textContent);
    cek('tautan paket tampil', s.el('qtUpgrade').hidden === false);
    cek('saldo tidak dikarang ($10.000 bawaan tidak ditampilkan)', s.el('qtSaldo').textContent === '—', s.el('qtSaldo').textContent);
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('tidak ada order dikirim', buka(s).length === 0);
    s.ctx.qtSetAkun(null, null, 'real');
    cek('mode Real MT5 tidak dikunci oleh paket paper', !s.el('qtBuy').disabled && s.el('qtUpgrade').hidden === true);
  }

  console.log('\nMengirim order (server tiruan api/paper-trading.php)');
  {
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
    s.ctx.qtOrder(null, null, 'BUY');
    cek('Quick Trade tidak mengklaim sukses sebelum server menjawab', !s.jejak.toast.some((t) => t.jenis === 'success'), s.jejak.toast);
    await s.tunggu();
    const b = buka(s)[0] || {};
    cek('akun simulasi → satu order buka dikirim', buka(s).length === 1, s.server.post);
    cek('muatan: simbol, arah, lot, SL, TP', b.symbol === 'XAUUSD' && b.side === 'BUY' && b.lots === 0.1 && b.sl === 4113.79 && b.tp === 4143.79, b);
    cek('batas requote = ask yang dilihat pengguna', b.harga === 4123.79, b.harga);
    cek("asal = 'quick'", b.asal === 'quick', b.asal);
    cek('client_order_id dikirim (≤ 40 karakter)', typeof b.client_order_id === 'string' && b.client_order_id.length > 0 && b.client_order_id.length <= 40, b.client_order_id);
    cek('sukses diumumkan SETELAH server menerima', s.jejak.toast.some((t) => t.jenis === 'success' && /dibuka/.test(t.pesan)));
    cek('akun real tidak tersentuh', s.jejak.liveAction.length === 0);
  }
  {
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
    s.ctx.qtSetAkun(null, null, 'real');
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('akun real → diteruskan ke jalur order real', s.jejak.liveAction.length === 1 && buka(s).length === 0);
    const o = s.jejak.liveAction[0] || {};
    cek('muatan real memakai harga ask untuk BUY', o.entry_price === 4123.79 && o.side === 'BUY' && o.volume === 0.1, o);
  }
  {
    const s = sb({ nilai: { qtLot: '0.10' } });
    s.ctx.qtOrder(null, null, 'SELL');
    await s.tunggu();
    cek('SELL memakai harga bid sebagai batas requote', (buka(s)[0] || {}).harga === 4123.69, buka(s)[0]);
  }
  {
    const s = sb({ simbol: '' });
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('tanpa simbol chart → tidak ada order', buka(s).length === 0 && s.jejak.liveAction.length === 0);
    cek('alasannya disampaikan', s.jejak.toast.some((t) => /simbol/i.test(t.pesan)));
  }
  {
    const s = sb({ harga: {} });
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('tanpa harga live → tidak ada order', buka(s).length === 0);
  }
  {
    const s = sb({ nilai: { qtLot: '0' } });
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('lot nol ditolak', buka(s).length === 0 && s.jejak.toast.some((t) => /Lot/i.test(t.pesan)));
  }

  console.log('\nSL/TP diperiksa untuk tombol yang DITEKAN');
  {
    // SL di bawah harga (cocok untuk BUY) lalu menekan SELL: dulu terkirim, server/pengaman lalu menutupnya.
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4110' } });
    s.ctx.qtOrder(null, null, 'SELL');
    await s.tunggu();
    cek('SELL dengan SL di bawah harga TIDAK dikirim', buka(s).length === 0, s.server.post);
    cek('alasannya: untuk SELL stop loss harus di ATAS harga', s.jejak.toast.some((t) => /SELL, stop loss harus di ATAS/.test(t.pesan)), s.jejak.toast);
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('level yang sama untuk BUY dikirim', buka(s).length === 1 && buka(s)[0].side === 'BUY');
  }
  {
    const s = sb({ nilai: { qtLot: '0.10', qtTP: '4200' } });
    s.ctx.qtOrder(null, null, 'SELL');
    await s.tunggu();
    cek('SELL dengan TP di atas harga TIDAK dikirim', buka(s).length === 0 && s.jejak.toast.some((t) => /take profit harus di BAWAH/.test(t.pesan)));
  }
  {
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4110', qtTP: '4140' } });
    s.ctx.qtSetAkun(null, null, 'real');
    s.ctx.qtOrder(null, null, 'SELL');
    await s.tunggu();
    cek('akun real juga diperiksa sebelum dialog konfirmasi', s.jejak.konfirmasi.length === 0 && s.jejak.liveAction.length === 0);
  }

  console.log('\nPosisi terbuka tampil beserta tombol Tutup');
  {
    const posisi = [
      { id: 'POS-1', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, sl: null, tp: null, src: 'manual' },
      { id: 'POS-2', symbol: 'XAUUSD', side: 'SELL', lots: 0.2, entryPrice: 4130, sl: null, tp: null, src: 'manual' },
    ];
    const s = sb({ posisi });
    s.ctx.qtRenderPosisi();
    const html = s.el('qtPosisi').innerHTML || '';
    cek('kedua posisi dirender', (html.match(/qim-qt-pos"/g) || []).length === 2);
    cek('ada tombol Tutup untuk tiap posisi', (html.match(/qim-qt-tutup/g) || []).length === 2);
    cek('tombol Tutup memanggil ptClosePosition', /data-qi-aksi="ptClosePosition"/.test(html));
    cek('id posisi diteruskan ke tombolnya', /POS-1/.test(html) && /POS-2/.test(html));
    cek('jumlah posisi ditampilkan', s.el('qtPosisiJml').textContent === '2', s.el('qtPosisiJml').textContent);

    const kosong = sb({ posisi: [] });
    kosong.ctx.qtRenderPosisi();
    cek('tanpa posisi -> pesan jelas', /Belum ada posisi terbuka/.test(kosong.el('qtPosisi').innerHTML || ''));
    cek('jumlah posisi 0', kosong.el('qtPosisiJml').textContent === '0');

    const belum = sb({ dimuat: false });
    belum.ctx.qtRenderPosisi();
    cek('sebelum state server dimuat: "Memuat posisi…", bukan "Belum ada posisi"', /Memuat posisi/.test(belum.el('qtPosisi').innerHTML), belum.el('qtPosisi').innerHTML);
  }
  {
    const s = sb({ posisi: [
      { id: 'POS-7', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, src: 'auto' },
      { id: 'POS-8', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, src: 'ai' },
      { id: 'POS-9', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, src: 'manual' },
    ] });
    s.ctx.qtRenderPosisi();
    const html = s.el('qtPosisi').innerHTML;
    cek('posisi AUTO/AI TIDAK diberi tombol Tutup (dikelola server)', (html.match(/qim-qt-tutup/g) || []).length === 1 && !/data-tutup-id="POS-7"/.test(html) && !/data-tutup-id="POS-8"/.test(html));
    cek('posisi AUTO/AI diberi lencana', />AUTO</.test(html) && />AI</.test(html));
  }

  console.log('\nSaldo & mengambang dinilai di harga PENUTUPAN');
  {
    const s = sb({ saldo: 10000, posisi: [{ id: 'POS-1', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100 }] });
    s.ctx.qtSaldo();
    cek('saldo ditampilkan dengan format uang', s.el('qtSaldo').textContent === '$10,000.00', s.el('qtSaldo').textContent);
    // BUY ditutup di bid 4123.69: (23.69) × 0.1 × 100 = 236.90 (dulu harga tengah → 237.40).
    cek('BUY dinilai di bid', s.el('qtFloat').textContent === '+$236.90', s.el('qtFloat').textContent);
    cek('mengambang positif ditandai naik', s.el('qtFloat').className === 'naik');

    const r = sb({ saldo: 9500, posisi: [{ id: 'POS-1', symbol: 'XAUUSD', side: 'SELL', lots: 0.1, entryPrice: 4100 }] });
    r.ctx.qtSaldo();
    cek('SELL dinilai di ask (4123.79) dan ditandai turun', r.el('qtFloat').textContent === '-$237.90' && r.el('qtFloat').className === 'turun', r.el('qtFloat').textContent);
    cek('saldo mengikuti nilai sebenarnya', r.el('qtSaldo').textContent === '$9,500.00');

    const n = sb({ saldo: 10000, posisi: [] });
    n.ctx.qtSaldo();
    cek('tanpa posisi -> mengambang nol', n.el('qtFloat').textContent === '+$0.00');
  }

  cek('menutup posisi dari mana pun menyegarkan Quick Trade', /qtSaldo\(\); qtRenderPosisi\(\);/.test(JS));

  // == Audit trading 2026-10-22: harga basi, feed eksekusi, mode Real ===========
  console.log('\nHarga basi tidak tampil sebagai kutipan live');
  {
    // Kutipan 5 menit lalu: dulu tetap tampil di tombol BUY/SELL tanpa penanda apa pun.
    const s = sb();
    s.harga('XAUUSD', { price: '4123.74', bid: '4123.69', ask: '4123.79' }, 300);
    s.ctx.qtSegarkan();
    cek('harga 300 detik → BUY & SELL "—"', s.el('qtBuyHarga').textContent === '—' && s.el('qtSellHarga').textContent === '—', [s.el('qtBuyHarga').textContent, s.el('qtSellHarga').textContent]);
    cek('… dengan alasannya di tooltip', /tidak diperbarui 300 detik/.test(s.el('qtBuyHarga').title), s.el('qtBuyHarga').title);
    const minta = s.server.kanonikDiminta.length;
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(60);
    cek('BUY di atas "—" → TIDAK ada order', buka(s).length === 0, s.server.post);
    cek('… pengguna diberi tahu, dan harga diambil ulang', s.jejak.toast.some((t) => /belum segar/.test(t.pesan)) && s.server.kanonikDiminta.length > minta);
    cek('… setelah diambil ulang, tombol menampilkan harga segar lagi', s.el('qtBuyHarga').textContent === '4123.79', s.el('qtBuyHarga').textContent);
  }
  {
    const s = sb();
    s.harga('XAUUSD', { price: '4123.74', source: 'frankfurter' });
    s.ctx.qtSegarkan();
    cek('kurs referensi harian → "—"', s.el('qtBuyHarga').textContent === '—' && /kurs referensi harian/.test(s.el('qtBuyHarga').title));
  }

  console.log('\nQuick Trade Simulasi memakai feed yang MENGISI order (kanonik)');
  {
    // Terukur 2026-10-22: live-price XAUUSD 4130.897 vs kanonik 4133.122/4133.132 pada detik yang sama.
    const s = sb({ nilai: { qtLot: '0.10' } });
    s.hargaLive('XAUUSD', { price: '4130.897', source: 'binance_paxg_selaras' });
    s.hargaKanonik('XAUUSD', { price: 4133.127, bid: 4133.122, ask: 4133.132, source: 'binance_paxg_selaras' });
    s.ctx.qtSegarkan();
    cek('BUY menampilkan ask KANONIK (4133.13), bukan live-price 4130.90', s.el('qtBuyHarga').textContent === '4133.13', s.el('qtBuyHarga').textContent);
    cek('SELL menampilkan bid kanonik', s.el('qtSellHarga').textContent === '4133.12', s.el('qtSellHarga').textContent);
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(60);
    const b = buka(s)[0] || {};
    cek('batas requote = ask kanonik yang terlihat', b.harga === 4133.132, b);
    cek('posisi terisi di harga yang TAMPIL di tombol', s.jalankan('_ptPositions[0] && _ptPositions[0].entryPrice') === 4133.132);
    s.jalankan('qtRenderPosisi()');
    cek('P/L mengambang segera sesudah buka = −spread saja (−$0.10), bukan selisih antar-feed (dulu ±−$223)', s.el('qtPosisi').querySelector(`[data-qt-pnl="${b && s.jalankan('_ptPositions[0].id')}"]`).textContent === '-$0.10', s.el('qtPosisi').innerHTML);
  }
  {
    // Simbol di luar cakupan feed kanonik (USOIL): dinilai dari live-price dan DITANDAI.
    const s = sb({ posisi: [{ id: 'POS-3', symbol: 'USOIL', side: 'BUY', lots: 1, entryPrice: 70, src: 'manual' }] });
    s.harga('USOIL', { price: '71', bid: '70.99', ask: '71.01' });
    s.ctx.qtRenderPosisi();
    const el = s.el('qtPosisi').querySelector('[data-qt-pnl="POS-3"]');
    cek('simbol tanpa feed kanonik tetap dinilai (bukan "—")', el.textContent !== '—', el.textContent);
    cek('… dan ditandai sebagai feed tampilan', /Feed tampilan \(live-price\)/.test(el.title), el.title);
  }

  console.log('\nQuick Trade Real MT5: harga segar & tanpa angka dolar karangan');
  {
    // Harga di tombol 10 menit lalu; server punya harga sekarang.
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4100', qtTP: '4160' } });
    s.hargaLive('XAUUSD', { price: '4000.10', source: 'oanda_tv' }, 600);
    s.server.harga.XAUUSD = { price: '4123.79', source: 'oanda_tv' };
    s.ctx.qtSetAkun(null, null, 'real');
    cek('mode real: harga live basi → tombol "—"', s.el('qtBuyHarga').textContent === '—', s.el('qtBuyHarga').textContent);
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(60);
    const o = s.jejak.liveAction[0] || {};
    cek('order real memakai harga SEGAR 4123.79, bukan 4000.10', o.entry_price === 4123.79, o);
    cek('konfirmasi menyebut akun dan harga segar', /Akun: ICMarkets Demo/.test(s.jejak.konfirmasi[0] || '') && /4123\.79/.test(s.jejak.konfirmasi[0] || ''), s.jejak.konfirmasi[0]);
  }
  {
    const s = sb({ nilai: { qtLot: '0.10', qtSL: '4113.79', qtTP: '4143.79' } });
    s.ctx.qtSetAkun(null, null, 'real');
    s.ctx.qtHitung();
    const t = s.el('qtInfo').textContent;
    cek('mode real: TIDAK ada perkiraan dolar dari model kontrak paper', !/\$/.test(t), t);
    cek('… hanya jarak harga dan R:R', /Jarak TP 20\.00/.test(t) && /jarak SL 10\.00/.test(t) && /R:R 1:2\.00/.test(t), t);
    cek('… dengan alasan (ukuran kontrak broker)', /ukuran kontrak di broker/.test(t), t);
    s.ctx.qtSetAkun(null, null, 'sim');
    cek('kembali ke simulasi → perkiraan dolar simulasi lagi', /Est\. untung \$200\.00/.test(s.el('qtInfo').textContent), s.el('qtInfo').textContent);
  }

  // == Klik SUNGGUHAN lewat dispatcher qim-aksi.js (2026-10-22) =================
  // QIAksi memanggil fungsi window TANPA el & e; qtOrder/qtStep/qtSetAkun wajib didaftarkan.
  console.log('\nKlik tombol lewat dispatcher QIAksi yang sebenarnya');
  {
    const markup = (id) => (HTML.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>')) || [''])[0];
    const argDari = (tag) => ((tag.match(/data-qi-arg='([^']*)'/) || [])[1] || '');
    const aksiDari = (tag) => ((tag.match(/data-qi-aksi="([^"]*)"/) || [])[1] || '');
    const sell = markup('qtSell'), buy = markup('qtBuy');
    cek('markup tombol SELL ditemukan', aksiDari(sell) === 'qtOrder', sell);

    const s = sb({ nilai: { qtLot: '0.10' } });
    s.klik(s.tombol(aksiDari(sell), argDari(sell)));
    await s.tunggu();
    cek('klik SELL mengirim tepat satu order', buka(s).length === 1, buka(s).length);
    cek('klik SELL → arah order SELL (dulu BUY)', (buka(s)[0] || {}).side === 'SELL', buka(s)[0]);
    cek('klik SELL memakai harga bid', (buka(s)[0] || {}).harga === 4123.69);

    const b = sb({ nilai: { qtLot: '0.10' } });
    b.klik(b.tombol(aksiDari(buy), argDari(buy)));
    await b.tunggu();
    cek('klik BUY → arah order BUY dengan harga ask', (buka(b)[0] || {}).side === 'BUY' && (buka(b)[0] || {}).harga === 4123.79, buka(b)[0]);

    const l = sb({ nilai: { qtLot: '0.10' } });
    l.klik(l.tombol('qtStep', '["qtLot",1]'));
    cek('klik + lot benar-benar menaikkan lot', l.el('qtLot').value === '0.11', l.el('qtLot').value);
    l.klik(l.tombol('qtStep', '["qtSL",-1]'));
    cek('klik − SL mengisi SL dari harga tengah', l.el('qtSL').value === '4123.74', l.el('qtSL').value);

    const r = sb({ nilai: { qtLot: '0.10', qtSL: '4140', qtTP: '4100' } });
    r.klik(r.tombol('qtSetAkun', '["real"]'));
    cek('klik tab Real MT5 benar-benar memilih akun real', r.jalankan('QT.akun') === 'real');
    r.klik(r.tombol('qtOrder', '["SELL"]'));
    await r.tunggu();
    cek('order di akun real diteruskan ke jalur real sebagai SELL', r.jejak.liveAction.length === 1 && r.jejak.liveAction[0].side === 'SELL', r.jejak.liveAction);

    const d = sb({ nilai: { qtLot: '0.10' } });
    d.klik(d.tombol('qtOrder', '["BUY"]', { disabled: true }));
    await d.tunggu();
    cek('tombol nonaktif tidak mengirim apa pun (dispatcher)', buka(d).length === 0);
  }

  // ── Kontrak markup & gaya ────────────────────────────────────────────────────
  console.log('\nMarkup & gaya');
  for (const id of ['qtSym', 'qtAkunSim', 'qtAkunReal', 'qtBuy', 'qtSell', 'qtBuyHarga', 'qtSellHarga', 'qtLot', 'qtSL', 'qtTP', 'qtInfo', 'qtSaldo', 'qtFloat', 'qtPosisi', 'qtPosisiJml', 'qtNota',
    'qtKartu', 'qtSaldoBaris', 'qtPosisiBlok', 'qtRealInfo', 'qtUpgrade']) {
    cek(`dashboard.html punya #${id}`, new RegExp(`id="${id}"`).test(HTML));
  }
  cek('kartu Quick Trade berada di dalam rail kanan', /id="qimRightPanel"[\s\S]{0,400}qim-qt-card/.test(HTML));
  cek('kartu Quick Trade adalah kartu PERTAMA di rail kanan', /id="qimRightPanel"[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<section class="qim-card qim-qt-card"/.test(HTML));
  cek('semua aksi memakai delegasi CSP-safe (tanpa on*=)', /data-qi-aksi="qtOrder"/.test(HTML) && /data-qi-aksi="qtSetAkun"/.test(HTML) && /data-qi-aksi="qtStep"/.test(HTML));
  cek('tidak ada lagi tombol "Place Order" terpisah', !/id="qtKirim"/.test(HTML));
  cek('BUY & SELL membawa lencana REAL (tampil hanya di mode real)', (HTML.match(/class="qim-qt-real-badge"/g) || []).length === 2);
  cek('petunjuk real & tautan paket tersembunyi secara bawaan', /id="qtRealInfo"[^>]*hidden/.test(HTML) && /id="qtUpgrade"[^>]*hidden/.test(HTML));
  cek('gaya kartu ada di qim-dashboard.css', /\.qim-qt-card/.test(CSS) && /\.qim-qt-card\.is-real/.test(CSS));
  cek('CSS: SELL tidak lagi diredupkan sebagai "tidak aktif"', !/\.qim-qt-side:not\(\.is-active\)/.test(CSS) && !/\.qim-qt-side\.is-active/.test(CSS));
  cek('CSS: redup hanya saat tombol nonaktif', /\.qim-qt-side:disabled\s*\{[^}]*opacity/.test(CSS));
  cek('CSS: elemen [hidden] di kartu benar-benar tersembunyi (display:flex tidak menimpanya)', /\.qim-qt-card \[hidden\]\s*\{\s*display:none !important/.test(CSS));
  cek('CSS: aturan tombol "Place Order" yang mati sudah dibuang', !/\.qim-qt-kirim/.test(CSS));
  cek('JS: tidak ada lagi toggle is-active pada qtBuy/qtSell', !/qtEl\('qt(Buy|Sell)'\)\?\.classList\.toggle\('is-active'/.test(JS));
  cek('Quick Trade disegarkan berkala', /try \{ qtSegarkan\(\); \} catch \(e\) \{\}\s*\}, 5000\);/.test(JS));

  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — Quick Trade: harga sisi, stepper, perkiraan, tujuan order, mode real, paket FREE');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
