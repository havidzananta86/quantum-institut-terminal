/**
 * Order manual: pemilih akun Simulasi / Real MT5 di formulir panel Paper Trading.
 *
 * Properti paling penting yang dikunci di sini: order akun REAL tidak pernah menjadi
 * posisi simulasi, dan posisi simulasi tidak pernah dikirim ke broker. Keduanya memakai
 * satu tombol yang sama, jadi percabangannya harus benar-benar terbukti — bukan diperiksa
 * dengan mata.
 *
 * Blok Paper Trading ASLI dijalankan di sandbox vm (tests/paper-sandbox.js) dengan server
 * tiruan api/paper-trading.php.
 *
 * Run:  node tests/order-manual-real.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { sandbox } = require('./paper-sandbox.js');

const root = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const PHP = fs.readFileSync(path.join(root, 'api/live-trade.php'), 'utf8');

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

function sb(nilai = {}, opsi = {}) {
  const s = sandbox(Object.assign({ nilai: Object.assign({ ptLots: '0.10' }, nilai) }, opsi));
  s.jalankan('_ptDimuatPada = Date.now()');
  // Harga tanpa bid/ask: kedua sisi = 4123.79 (tidak mengarang spread).
  s.kosongkanHarga();
  s.harga('XAUUSD', { price: '4123.79', source: 'oanda_tv' });
  return s;
}
const buka = (s) => s.server.post.filter((b) => b.aksi === 'buka');

(async () => {
  console.log('Akun simulasi (bawaan)');
  {
    const s = sb();
    cek("akun bawaan = 'sim'", s.ctx.ptAkunAktif() === 'sim');
    s.ctx.ptOpenPosition();
    cek('posisi TIDAK ditambahkan di klien sebelum server menerimanya', s.jalankan('_ptPositions.length') === 0);
    await s.tunggu();
    cek('order simulasi diteruskan ke server (aksi buka)', buka(s).length === 1, s.server.post);
    cek('TIDAK ada order dikirim ke broker', s.jejak.liveAction.length === 0);
    cek('tidak ada dialog konfirmasi uang sungguhan', s.jejak.konfirmasi.length === 0);
    const a = buka(s)[0] || {};
    cek('muatan: simbol, arah, harga sisi sebagai batas requote, lot', a.symbol === 'XAUUSD' && a.side === 'BUY' && a.harga === 4123.79 && a.lots === 0.1, a);
    cek("asal = 'form'", a.asal === 'form', a.asal);
    cek('posisi tampil SETELAH server menerimanya (dimuat ulang dari server)', s.jalankan('_ptPositions.length') === 1);
  }

  console.log('\nKolom harga eksekusi BACA SAJA');
  {
    const s = sb({ ptSide: 'SELL' });
    s.kosongkanHarga();
    s.harga('XAUUSD', { price: '4123.74', bid: '4123.69', ask: '4123.79', source: 'mt5_broker' });
    await s.ctx.ptUpdateLivePrice();
    cek('SELL → kolom menampilkan bid', s.el('ptEntryPrice').value === '4123.69', s.el('ptEntryPrice').value);
    s.el('ptSide').value = 'BUY';
    await s.ctx.ptUpdateLivePrice();
    cek('BUY → kolom menampilkan ask', s.el('ptEntryPrice').value === '4123.79', s.el('ptEntryPrice').value);
    // Nilai yang "diketik" ke kolom itu tidak lagi dipakai sebagai harga order.
    s.el('ptEntryPrice').value = '4000';
    s.ctx.ptOpenPosition();
    await s.tunggu();
    cek('harga order = ask pasar, bukan angka di kolom', (buka(s)[0] || {}).harga === 4123.79, buka(s)[0]);
    // Form "Buka Posisi Baru" dihapus dari dashboard (dobel dengan Quick Trade). Fungsi di atas tetap diuji karena
    // jalur order paper/real yang sama dipakai Quick Trade; markup form tidak boleh kembali tanpa disadari.
    cek('markup: form order manual dobel sudah tidak ada (Quick Trade satu-satunya jalur)', !/id="ptOpenBtn"/.test(HTML) && !/id="ptEntryPrice"/.test(HTML) && /id="qtKartu"/.test(HTML));
    cek('markup: Quick Trade memakai tombol BUY & SELL sendiri', /id="qtBuy"/.test(HTML) && /id="qtSell"/.test(HTML));
  }

  console.log('\nValidasi formulir sebelum dikirim');
  {
    const s = sb({ ptLots: '0' });
    s.ctx.ptOpenPosition();
    await s.tunggu();
    cek('lot 0 → ditolak DENGAN pesan (dulu berhenti diam-diam)', buka(s).length === 0 && s.jejak.toast.some((t) => /Lot harus 0,01/.test(t.pesan)), s.jejak.toast);
    const t = sb({ ptSide: 'SELL', ptSL: '4100' });
    t.ctx.ptOpenPosition();
    await t.tunggu();
    cek('SELL dengan SL di bawah harga → tidak dikirim, alasannya disebut', buka(t).length === 0 && t.jejak.toast.some((x) => /SELL, stop loss harus di ATAS/.test(x.pesan)), t.jejak.toast);
  }

  console.log('\nAkun real — SL/TP wajib');
  {
    const s = sb({ ptAkun: 'real' });
    s.ctx.ptOpenPosition();
    await s.tunggu();
    cek('order TANPA SL/TP ditolak di klien', s.jejak.liveAction.length === 0);
    cek('pengguna diberi tahu alasannya', s.jejak.toast.some((t) => /SL dan TP/i.test(t.pesan)));
    cek('tidak menjadi posisi simulasi', buka(s).length === 0);
  }

  console.log('\nAkun real — order sah');
  {
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' });
    s.ctx.ptOpenPosition();
    await s.tunggu();
    cek('dialog konfirmasi muncul', s.jejak.konfirmasi.length === 1);
    cek('konfirmasi menyebut UANG SUNGGUHAN', /UANG SUNGGUHAN/.test(s.jejak.konfirmasi[0] || ''));
    cek('konfirmasi memuat arah, lot, SL, dan TP', /BUY XAUUSD 0\.1 lot/.test(s.jejak.konfirmasi[0] || '') && /SL 4100/.test(s.jejak.konfirmasi[0] || '') && /TP 4160/.test(s.jejak.konfirmasi[0] || ''));
    const o = s.jejak.liveAction[0];
    cek('order dikirim ke server', !!o);
    cek("aksi = 'queue_manual' (bukan queue_signal)", o && o.action === 'queue_manual', o && o.action);
    cek('muatan lengkap: simbol, arah, lot, entry, SL, TP', !!o && o.symbol === 'XAUUSD' && o.side === 'BUY' && o.volume === 0.1 && o.entry_price === 4123.79 && o.stop_loss === 4100 && o.take_profit === 4160, o);
    cek('tidak menjadi order simulasi', buka(s).length === 0);
    cek('pesan sukses dari server ditampilkan', s.jejak.toast.some((t) => t.jenis === 'success'));
    cek('tombol kembali aktif setelah selesai', s.el('ptOpenBtn').disabled === false);
  }

  console.log('\nAkun real — konfirmasi dibatalkan');
  {
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, { setuju: false });
    s.ctx.ptOpenPosition();
    await s.tunggu();
    cek('order TIDAK dikirim saat dibatalkan', s.jejak.liveAction.length === 0);
    cek('tidak ada posisi simulasi tersisa', buka(s).length === 0);
  }

  console.log('\nAkun real — server menolak');
  {
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, { gagalkanReal: true });
    s.ctx.ptOpenPosition();
    await s.tunggu();
    cek('penolakan server ditampilkan sebagai galat', s.jejak.toast.some((t) => t.jenis === 'error'));
    cek('tidak diam-diam menjadi posisi simulasi', buka(s).length === 0);
  }

  console.log('\nTampilan tombol mengikuti akun');
  {
    const s = sb({ ptAkun: 'real' });
    s.ctx.ptGantiAkun();
    const btn = s.el('ptOpenBtn'), nota = s.el('ptAkunNota');
    cek('tombol berubah menjadi KIRIM ORDER REAL', btn.textContent === 'KIRIM ORDER REAL');
    cek('tombol berwarna merah', /FF5252|B71C1C/.test(btn.style.background || ''));
    cek('keterangan memperingatkan uang sungguhan', /[Uu]ang sungguhan/.test(nota.textContent));
    const t = sb();
    t.ctx.ptGantiAkun();
    cek('kembali ke simulasi → tombol & warna semula', t.el('ptOpenBtn').textContent === '+ Buka Posisi' && /00E5FF/.test(t.el('ptOpenBtn').style.background || ''));
    cek('keterangan simulasi menegaskan tanpa uang sungguhan', /tanpa uang sungguhan/i.test(t.el('ptAkunNota').textContent));
  }

  // ── Audit trading 2026-10-22: akun tujuan & harga segar untuk order REAL ──────
  // liveAction / loadLiveExecution di sini adalah fungsi ASLI dashboard-app.js (paper-sandbox.js).
  console.log('\nAkun real — akun MT5 tujuan dipastikan sebelum konfirmasi');
  {
    // #liveAccountId kosong (panel Broker → Eksekusi MT5 belum pernah dibuka) — keadaan saat halaman dibuka.
    let getSaatKonfirmasi = null, s;
    s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, { setuju: () => { getSaatKonfirmasi = s.server.liveGet; return true; } });
    cek('awal: select akun MT5 kosong', s.el('liveAccountId').value === '');
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('daftar akun dimuat SEBELUM konfirmasi (GET live-trade.php)', getSaatKonfirmasi === 1, getSaatKonfirmasi);
    cek('konfirmasi MENYEBUT akun tujuan', /Akun: ICMarkets Demo · connected/.test(s.jejak.konfirmasi[0] || ''), s.jejak.konfirmasi[0]);
    const o = s.jejak.liveAction[0] || {};
    cek('order dikirim ke akun yang disebut (account_id 7)', s.jejak.liveAction.length === 1 && o.account_id === 7, o);
    cek('sukses diumumkan dengan pesan server', s.jejak.toast.some((t) => t.jenis === 'success' && /antrean aman/.test(t.pesan)), s.jejak.toast);
  }
  {
    // Tanpa akun MT5 sama sekali: dulu toast HIJAU "Order masuk antrean." padahal tidak ada yang dikirim.
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, { akunReal: [] });
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('tanpa akun MT5 → TIDAK ada order ke live-trade.php', s.jejak.liveAction.length === 0, s.jejak.liveAction);
    cek('… TIDAK ada toast sukses', !s.jejak.toast.some((t) => t.jenis === 'success'), s.jejak.toast);
    cek('… galat yang mengatakan order TIDAK dikirim dan ke mana harus pergi', s.jejak.toast.some((t) => t.jenis === 'error' && /TIDAK dikirim/.test(t.pesan) && /Profil → Broker MT5/.test(t.pesan)), s.jejak.toast);
    cek('… dan tidak ada dialog konfirmasi uang sungguhan', s.jejak.konfirmasi.length === 0);
    cek('tombol aktif lagi', s.el('ptOpenBtn').disabled === false);
  }
  {
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' });
    s.server.akunGagal = true;
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('daftar akun gagal dimuat → tidak dikirim, galat, tanpa toast sukses', s.jejak.liveAction.length === 0 && s.jejak.toast.some((t) => t.jenis === 'error') && !s.jejak.toast.some((t) => t.jenis === 'success'), s.jejak.toast);
  }
  {
    // Akun berganti selama dialog konfirmasi terbuka → order tidak dikirim ke akun yang tidak disebut.
    let s;
    s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, { setuju: () => { s.ctx._akunLive = []; return true; } });
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('akun berubah selama konfirmasi → TIDAK dikirim, tanpa toast sukses', s.jejak.liveAction.length === 0 && !s.jejak.toast.some((t) => t.jenis === 'success') && s.jejak.toast.some((t) => /berubah selama konfirmasi/.test(t.pesan)), s.jejak.toast);
  }
  {
    // liveAction ASLI dengan select kosong: mengembalikan null TANPA mengirim (itulah sebab toast hijau palsu).
    const s = sb();
    const hasil = await s.ctx.liveAction({ action: 'queue_manual' });
    cek('liveAction asli: select kosong → null tanpa permintaan (jalur order wajib menanganinya)', hasil === null && s.jejak.liveAction.length === 0);
  }

  console.log('\nAkun real — harga SEGAR, bukan harga di layar');
  {
    // Harga di layar berumur 10 menit (4000.10); server punya harga sekarang 4123.79.
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' });
    s.hargaLive('XAUUSD', { price: '4000.10', source: 'oanda_tv' }, 600);
    s.server.harga.XAUUSD = { price: '4123.79', source: 'oanda_tv' };
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    const o = s.jejak.liveAction[0] || {};
    cek('harga diambil ulang sebelum order', s.server.hargaDiminta.some((d) => d.includes('XAUUSD')));
    cek('entry_price = harga SEGAR 4123.79 (bukan 4000.10 yang basi)', o.entry_price === 4123.79, o);
    cek('konfirmasi menampilkan harga segar', /Harga pasar sekarang 4123\.79 \(ask\)/.test(s.jejak.konfirmasi[0] || ''), s.jejak.konfirmasi[0]);
  }
  {
    // Server pun tidak punya harga baru: harga layar 600 detik → order real DITOLAK di klien.
    const s = sb({ ptAkun: 'real', ptSL: '3950', ptTP: '4100' });
    s.hargaLive('XAUUSD', { price: '4000.10', source: 'oanda_tv' }, 600);
    delete s.server.harga.XAUUSD;
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('harga basi (600 dtk) dan tidak bisa disegarkan → TIDAK dikirim, tanpa konfirmasi', s.jejak.liveAction.length === 0 && s.jejak.konfirmasi.length === 0, s.jejak.liveAction);
    cek('alasannya disebut (umur harga)', s.jejak.toast.some((t) => t.jenis === 'error' && /TIDAK dikirim/.test(t.pesan) && /600 detik/.test(t.pesan)), s.jejak.toast);
  }
  {
    // Kurs harian ECB (Frankfurter) bukan harga yang bisa ditransaksikan.
    const s = sb({ ptAkun: 'real', ptSymbol: 'EURUSD', ptSL: '1.1200', ptTP: '1.1300' });
    s.harga('EURUSD', { price: '1.12341', source: 'frankfurter' });
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('kurs referensi harian → TIDAK dikirim, alasannya disebut', s.jejak.liveAction.length === 0 && s.jejak.konfirmasi.length === 0 && s.jejak.toast.some((t) => /kurs referensi harian/.test(t.pesan)), s.jejak.toast);
  }
  {
    // SL/TP sah di harga basi (4200) tetapi salah sisi di harga segar (4123.79): diperiksa SEBELUM konfirmasi.
    const s = sb({ ptAkun: 'real', ptSL: '4150', ptTP: '4300' });
    s.hargaLive('XAUUSD', { price: '4200', source: 'oanda_tv' }, 600);
    s.server.harga.XAUUSD = { price: '4123.79', source: 'oanda_tv' };
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('SL/TP diperiksa terhadap harga SEGAR → ditolak sebelum konfirmasi', s.jejak.liveAction.length === 0 && s.jejak.konfirmasi.length === 0 && s.jejak.toast.some((t) => /stop loss harus di BAWAH/.test(t.pesan)), s.jejak.toast);
  }
  {
    const s = sb({ ptAkun: 'real', ptSL: '4100', ptTP: '4160' });
    s.server.harga.XAUUSD = { price: '4123.79', source: 'oanda_tv', market: 'closed' };
    s.ctx.ptOpenPosition();
    await s.tunggu(60);
    cek('pasar tutup → TIDAK dikirim', s.jejak.liveAction.length === 0 && s.jejak.toast.some((t) => /sedang tutup/.test(t.pesan)), s.jejak.toast);
  }

  // ── Kontrak markup & server ────────────────────────────────────────────────
  console.log('\nMarkup & server');
  // Pengaturan broker pindah ke Profil; dashboard hanya menaut ke sana dan tidak lagi punya pemilih akun.
  const PROFIL = fs.readFileSync(path.join(root, 'profile.html'), 'utf8');
  cek('dashboard.html tidak lagi punya pemilih akun MT5 / form order manual', !/id="ptAkun"/.test(HTML) && !/id="liveAccountId"/.test(HTML));
  cek('dashboard.html menaut ke Profil → Broker MT5', /href="profile\.html#brokerSection"/.test(HTML));
  cek('profile.html punya pemilih akun MT5 & guardrail eksekusi', /id="liveAccountId"/.test(PROFIL) && /data-qi-aksi="saveLiveGuardrails"/.test(PROFIL) && /id="brokerSection"/.test(PROFIL));
  cek('profile.html memuat qim-aksi.js dan qim-broker.js', /assets\/js\/qim-aksi\.js/.test(PROFIL) && /assets\/js\/qim-broker\.js/.test(PROFIL));

  cek('live-trade.php menerima queue_manual', /\$action === 'queue_manual'/.test(PHP));
  cek('queue_manual & queue_signal memakai blok guardrail yang sama', /\$action === 'queue_signal' \|\| \$action === 'queue_manual'/.test(PHP));
  cek("kolom source tidak lagi dipaku 'signal'", /:source,:symbol/.test(PHP) && !/VALUES \(:token,:account,'signal'/.test(PHP));
  cek("sumber manual ditandai 'manual'", /\$sumber = \$action === 'queue_manual' \? 'manual' : 'signal'/.test(PHP));
  cek('SL/TP tetap wajib di server (validLevels)', /\$validLevels/.test(PHP) && /INVALID_SIGNAL_ORDER/.test(PHP));
  cek('order real butuh akun aktif & tidak emergency stop', /EXECUTION_NOT_READY/.test(PHP));

  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — order manual: simulasi & real MT5 terpisah tegas');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
