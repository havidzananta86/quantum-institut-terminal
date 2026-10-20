/**
 * Order manual: pemilih akun Simulasi / Real MT5.
 *
 * Properti paling penting yang dikunci di sini: order akun REAL tidak pernah menjadi
 * posisi simulasi, dan posisi simulasi tidak pernah dikirim ke broker. Keduanya memakai
 * satu tombol yang sama, jadi percabangannya harus benar-benar terbukti — bukan diperiksa
 * dengan mata.
 *
 * Fungsi aslinya dijalankan di sandbox vm dengan DOM tiruan (pola tests/mt5-socket.test.js).
 *
 * Run:  node tests/order-manual-real.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const JS = fs.readFileSync(path.join(root, 'assets/js/dashboard-app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const PHP = fs.readFileSync(path.join(root, 'api/live-trade.php'), 'utf8');

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

// ── Blok fungsi order dari berkas sumber ─────────────────────────────────────
const mulai = JS.indexOf('/** Akun tujuan formulir');
const akhir = JS.indexOf('function ptOpenDirectPosition');
cek('blok order manual ditemukan', mulai > 0 && akhir > mulai);
if (mulai < 0 || akhir < mulai) { console.error('\nFAIL'); process.exit(1); }
const BLOK = JS.slice(mulai, akhir);

function sandbox(opsi = {}) {
  const nilai = Object.assign({
    ptAkun: 'sim', ptSymbol: 'XAUUSD', ptSide: 'BUY', ptLots: '0.10',
    ptEntryPrice: '', ptSL: '', ptTP: '',
  }, opsi.nilai || {});
  const el = {};
  const ambil = (id) => {
    if (!el[id]) el[id] = { value: nilai[id] !== undefined ? nilai[id] : '', textContent: '', className: '', style: {} };
    return el[id];
  };
  const jejak = { toast: [], liveAction: [], simpan: 0, render: 0, confirm: [] };
  const ctx = {
    document: { getElementById: (id) => (nilai[id] !== undefined || ['ptOpenBtn', 'ptAkunNota'].includes(id)) ? ambil(id) : null },
    window: { confirm: (pesan) => { jejak.confirm.push(pesan); return opsi.setuju !== false; } },
    _lastPrices: { XAUUSD: { price: '4123.79' } },
    _ptPositions: [],
    showQuantumToast: (pesan, jenis) => jejak.toast.push({ pesan, jenis }),
    liveAction: async (p) => { jejak.liveAction.push(p); if (opsi.gagalkan) throw new Error('EXECUTION_NOT_READY'); return { message: 'Order masuk antrean aman selama lima menit.' }; },
    ptSaveToServer: () => { jejak.simpan++; },
    ptRender: () => { jejak.render++; },
    loadLiveExecution: () => {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(BLOK, ctx);
  return { ctx, jejak, el: ambil };
}

const tunggu = () => new Promise((r) => setImmediate(r));

(async () => {
  console.log('Akun simulasi (bawaan)');
  {
    const s = sandbox();
    cek("akun bawaan = 'sim'", s.ctx.ptAkunAktif() === 'sim');
    s.ctx.ptOpenPosition();
    await tunggu();
    cek('posisi simulasi dibuat', s.ctx._ptPositions.length === 1);
    cek('TIDAK ada order dikirim ke broker', s.jejak.liveAction.length === 0);
    cek('tidak ada dialog konfirmasi uang sungguhan', s.jejak.confirm.length === 0);
    cek('posisi disimpan & dirender', s.jejak.simpan === 1 && s.jejak.render === 1);
    const p = s.ctx._ptPositions[0];
    cek('entry diambil dari harga live saat kosong', p && p.entryPrice === 4123.79, p && p.entryPrice);
  }

  console.log('\nAkun real — SL/TP wajib');
  {
    const s = sandbox({ nilai: { ptAkun: 'real' } });
    s.ctx.ptOpenPosition();
    await tunggu();
    cek('order TANPA SL/TP ditolak di klien', s.jejak.liveAction.length === 0);
    cek('pengguna diberi tahu alasannya', s.jejak.toast.some(t => /SL dan TP/i.test(t.pesan)));
    cek('tidak menjadi posisi simulasi', s.ctx._ptPositions.length === 0);
  }

  console.log('\nAkun real — order sah');
  {
    const s = sandbox({ nilai: { ptAkun: 'real', ptSL: '4100', ptTP: '4160' } });
    s.ctx.ptOpenPosition();
    await tunggu();
    cek('dialog konfirmasi muncul', s.jejak.confirm.length === 1);
    cek('konfirmasi menyebut UANG SUNGGUHAN', /UANG SUNGGUHAN/.test(s.jejak.confirm[0] || ''));
    cek('konfirmasi memuat arah, lot, SL, dan TP', /BUY XAUUSD 0\.1 lot/.test(s.jejak.confirm[0] || '') && /SL 4100/.test(s.jejak.confirm[0] || '') && /TP 4160/.test(s.jejak.confirm[0] || ''));
    const o = s.jejak.liveAction[0];
    cek('order dikirim ke server', !!o);
    cek("aksi = 'queue_manual' (bukan queue_signal)", o && o.action === 'queue_manual', o && o.action);
    cek('muatan lengkap: simbol, arah, lot, entry, SL, TP', !!o && o.symbol === 'XAUUSD' && o.side === 'BUY' && o.volume === 0.1 && o.entry_price === 4123.79 && o.stop_loss === 4100 && o.take_profit === 4160, o);
    cek('TIDAK menambah posisi simulasi', s.ctx._ptPositions.length === 0);
    cek('tidak menulis ke penyimpanan simulasi', s.jejak.simpan === 0);
    cek('pesan sukses dari server ditampilkan', s.jejak.toast.some(t => t.jenis === 'success'));
  }

  console.log('\nAkun real — konfirmasi dibatalkan');
  {
    const s = sandbox({ nilai: { ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, setuju: false });
    s.ctx.ptOpenPosition();
    await tunggu();
    cek('order TIDAK dikirim saat dibatalkan', s.jejak.liveAction.length === 0);
    cek('tidak ada posisi simulasi tersisa', s.ctx._ptPositions.length === 0);
  }

  console.log('\nAkun real — server menolak');
  {
    const s = sandbox({ nilai: { ptAkun: 'real', ptSL: '4100', ptTP: '4160' }, gagalkan: true });
    s.ctx.ptOpenPosition();
    await tunggu();
    cek('penolakan server ditampilkan sebagai galat', s.jejak.toast.some(t => t.jenis === 'error'));
    cek('tidak diam-diam menjadi posisi simulasi', s.ctx._ptPositions.length === 0);
  }

  console.log('\nTampilan tombol mengikuti akun');
  {
    const s = sandbox({ nilai: { ptAkun: 'real' } });
    s.ctx.ptGantiAkun();
    const btn = s.el('ptOpenBtn'), nota = s.el('ptAkunNota');
    cek('tombol berubah menjadi KIRIM ORDER REAL', btn.textContent === 'KIRIM ORDER REAL');
    cek('tombol berwarna merah', /FF5252|B71C1C/.test(btn.style.background || ''));
    cek('keterangan memperingatkan uang sungguhan', /[Uu]ang sungguhan/.test(nota.textContent));
    const t = sandbox();
    t.ctx.ptGantiAkun();
    cek('kembali ke simulasi → tombol & warna semula', t.el('ptOpenBtn').textContent === '+ Buka Posisi' && /00E5FF/.test(t.el('ptOpenBtn').style.background || ''));
    cek('keterangan simulasi menegaskan tanpa uang sungguhan', /tanpa uang sungguhan/i.test(t.el('ptAkunNota').textContent));
  }

  // ── Kontrak markup & server ────────────────────────────────────────────────
  console.log('\nMarkup & server');
  cek('dashboard.html punya pemilih akun ptAkun', /id="ptAkun"/.test(HTML));
  cek("pilihan bawaan adalah Simulasi (option pertama)", /<option value="sim">Simulasi<\/option>\s*<option value="real">/.test(HTML));
  cek('tombol order punya id untuk diubah tampilannya', /id="ptOpenBtn"/.test(HTML));
  cek('pemilih akun memakai delegasi aksi CSP-safe', /data-qi-aksi-change="ptGantiAkun"/.test(HTML));

  cek('live-trade.php menerima queue_manual', /\$action === 'queue_manual'/.test(PHP));
  cek('queue_manual & queue_signal memakai blok guardrail yang sama', /\$action === 'queue_signal' \|\| \$action === 'queue_manual'/.test(PHP));
  cek("kolom source tidak lagi dipaku 'signal'", /:source,:symbol/.test(PHP) && !/VALUES \(:token,:account,'signal'/.test(PHP));
  cek("sumber manual ditandai 'manual'", /\$sumber = \$action === 'queue_manual' \? 'manual' : 'signal'/.test(PHP));
  cek('SL/TP tetap wajib di server (validLevels)', /\$validLevels/.test(PHP) && /INVALID_SIGNAL_ORDER/.test(PHP));
  cek('order real butuh akun aktif & tidak emergency stop', /EXECUTION_NOT_READY/.test(PHP));

  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — order manual: simulasi & real MT5 terpisah tegas');
  process.exit(gagal ? 1 : 0);
})();
