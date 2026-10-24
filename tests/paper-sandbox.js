/**
 * Sandbox bersama untuk uji Paper Trading + Quick Trade di dashboard.
 *
 * Blok ASLI assets/js/dashboard-app.js ("// ─── Paper Trading" … "// ─── Track Record") dijalankan
 * di vm bersama qim-aksi.js (dispatcher klik sungguhan) dan qim-paper-math.js (model P/L sungguhan),
 * dengan DOM tiruan kecil — cukup untuk getElementById, innerHTML → querySelector('[data-x="…"]'),
 * classList, hidden, disabled, <select> (options/selectedIndex) — dan server tiruan:
 *   · api/paper-trading.php — kontrak {aksi: buka|tutup|ubah}; harga isi = ask/bid FEED KANONIK; SL/TP
 *     diselesaikan server di awal setiap GET/POST (seperti qi_paper_settle), sebab 'sl'/'tp';
 *   · api/competition.php?harga= — kutipan kanonik, hanya simbol QI_KOMP_SIMBOL (selain itu 400 / absen);
 *   · api/live-price.php — feed tampilan;
 *   · api/live-trade.php — akun MT5 (GET) dan order real (POST). liveAction / loadLiveExecution /
 *     liveHeaders yang dijalankan adalah sumber ASLI dashboard-app.js, bukan tiruan.
 *
 * Bukan berkas uji (tidak berakhiran .test.js); dipakai oleh:
 *   tests/quick-trade.test.js · tests/order-manual-real.test.js · tests/paper-dashboard.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const baca = (p) => fs.readFileSync(path.join(root, p), 'utf8');
// Jalur order dipisah dari dashboard-app.js saat dashboard panel lama dihapus.
const SRC = baca('assets/js/qim-quick-trade.js');
const AKSI = baca('assets/js/qim-aksi.js');
const MATH = baca('assets/js/qim-paper-math.js');
const { qimPaperPnl } = require(path.join(root, 'assets/js/qim-paper-math.js'));

function potong(awal, akhir) {
  const a = SRC.indexOf(awal);
  const b = SRC.indexOf(akhir, a);
  if (a < 0 || b < 0) throw new Error('penanda tidak ditemukan di qim-quick-trade.js: ' + awal + ' … ' + akhir);
  return SRC.slice(a, b);
}

/** Sumber satu deklarasi fungsi (function / async function; boleh menjorok di dalam IIFE) dari `sumber`. */
function ambilFungsi(nama, sumber = SRC) {
  const m = new RegExp('(^|\\n)([ \\t]*)(async\\s+)?function ' + nama + '\\(').exec(sumber);
  if (!m) throw new Error('fungsi tidak ditemukan: ' + nama);
  const a = m.index + m[1].length + m[2].length;
  let i = sumber.indexOf('{', sumber.indexOf(')', a)), d = 0;
  for (; i < sumber.length; i++) {
    if (sumber[i] === '{') d++;
    else if (sumber[i] === '}') { d--; if (d === 0) break; }
  }
  return sumber.slice(a, i + 1);
}

const BLOK_PAPER = potong('// ─── Paper Trading', '// ─── Akhir jalur order');

// ── DOM tiruan ───────────────────────────────────────────────────────────────
const dekode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function simpul(tag, attrs, teks) {
  const n = {
    tagName: tag.toUpperCase(), attrs, textContent: dekode(teks.trim()), title: attrs.title || '',
    className: attrs.class || '', disabled: 'disabled' in attrs, innerHTML: '', nodeType: 1, parentElement: null,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    hasAttribute(k) { return k in this.attrs; },
  };
  return n;
}

/** Elemen ber-tag pembuka di dalam html, lengkap dengan atribut & teks langsung sesudahnya. */
function urai(html) {
  const hasil = [];
  const re = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*"[^"]*")?)*)\s*\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = {};
    const reA = /([^\s=>/]+)(?:\s*=\s*"([^"]*)")?/g;
    let a;
    while ((a = reA.exec(m[2]))) attrs[a[1]] = a[2] === undefined ? '' : dekode(a[2]);
    const teks = (html.slice(re.lastIndex).match(/^([^<]*)/) || ['', ''])[1];
    hasil.push(simpul(m[1], attrs, teks));
  }
  return hasil;
}

function cocok(daftar, sel) {
  const m = /^\[([\w-]+)(?:="((?:[^"\\]|\\.)*)")?\]$/.exec(sel);
  if (!m) throw new Error('selektor tidak didukung DOM tiruan: ' + sel);
  const nilai = m[2] === undefined ? undefined : m[2].replace(/\\(.)/g, '$1');
  return daftar.filter((n) => n.attrs && (m[1] in n.attrs) && (nilai === undefined || n.attrs[m[1]] === nilai));
}

function buatElemen(id) {
  const e = {
    id, value: '', textContent: '', className: '', title: '', hidden: false, disabled: false, checked: false,
    placeholder: '', style: {}, attrs: {}, terlihat: true, nodeType: 1, parentElement: null,
    _kelas: new Set(), _anak: [], _html: '', tulisHtml: 0, options: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v); this.tulisHtml++; this._anak = urai(this._html);
      // <select>: seperti peramban, nilai yang tidak ada di opsi baru → opsi pertama terpilih.
      this.options = this._anak.filter((n) => n.tagName === 'OPTION');
      if (this.options.length && !this.options.some((o) => o.attrs.value === this.value)) this.value = this.options[0].attrs.value ?? this.options[0].textContent;
    },
    get selectedIndex() { return this.options.findIndex((o) => o.attrs.value === this.value); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    hasAttribute(k) { return k in this.attrs; },
    toggleAttribute(k, on) { if (on) this.attrs[k] = ''; else delete this.attrs[k]; },
    getClientRects() { return e.terlihat ? [{}] : []; },
    querySelector(sel) { return cocok(this._anak, sel)[0] || null; },
    querySelectorAll(sel) { return cocok(this._anak, sel); },
  };
  e.classList = {
    toggle(k, on) { const v = on === undefined ? !e._kelas.has(k) : !!on; if (v) e._kelas.add(k); else e._kelas.delete(k); return v; },
    contains: (k) => e._kelas.has(k), add: (k) => e._kelas.add(k), remove: (k) => e._kelas.delete(k),
  };
  return e;
}

// ── Server tiruan ────────────────────────────────────────────────────────────
const SIMBOL = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'XRPUSDT', 'DOGEUSDT',
  'AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD', 'XAGUSD', 'USOIL', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225'];
/** Simbol yang dilayani api/competition.php?harga= (QI_KOMP_SIMBOL di api/_kompetisi_harga.php). */
const KANONIK = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAGUSD', 'US30', 'NAS100'];
const jawab = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function serverTiruan(opsi = {}) {
  const s = {
    saldo: 10000, posisi: [], riwayat: [], nomor: 100,
    // Feed tampilan (live-price) dan feed kanonik (isi order + penyelesaian SL/TP). Kanonik yang tidak
    // diisi sendiri = sama dengan feed tampilan.
    harga: { XAUUSD: { price: '4123.74', bid: '4123.69', ask: '4123.79', source: 'mt5_broker' } },
    kanonik: {},
    settle: true,               // SL/TP diselesaikan server di awal setiap GET/POST (qi_paper_settle)
    tolakBerikut: null,         // {status, body} untuk POST berikutnya
    tolakPostKe: {},            // {n: {status, body}}: POST ke-n (1 = pertama sejak sandbox dibuat) ditolak tanpa diproses
    galatSetelahProses: null,   // {status}: POST berikutnya DIPROSES, lalu dijawab 5xx berisi HTML (bukan JSON)
    putusSetelahProses: 0,      // POST diproses server, lalu jawabannya "hilang" (TypeError)
    putusSebelumProses: 0,      // POST tidak pernah sampai
    tahan: null,                // bila diisi Promise: POST menunggu sampai Promise itu selesai
    getGagal: false,
    kunci: {},                  // client_order_id → posisi
    post: [], get: 0, hargaDiminta: [], kanonikDiminta: [],
    // api/live-trade.php
    akunReal: opsi.akunReal !== undefined ? opsi.akunReal : [{ id: 7, account_label: 'ICMarkets Demo', connection_status: 'connected', enabled: 1 }],
    akunGagal: false, gagalkanReal: !!opsi.gagalkanReal, liveTrade: [], liveGet: 0,
  };
  const kutipan = (sym) => s.kanonik[sym] || s.harga[sym] || null;
  const sisi = (sym, beli) => { const h = kutipan(sym); return h ? Number(beli ? (h.ask ?? h.price) : (h.bid ?? h.price)) : null; };
  /** qi_paper_settle tiruan: SL di harga penutupan saat ini, TP di level TP (api/_kompetisi_settle.php). */
  function selesaikan() {
    if (!s.settle) return;
    for (const p of s.posisi.slice()) {
      const q = kutipan(p.symbol);
      if (!q || q.market === 'closed') continue;
      const px = sisi(p.symbol, p.side !== 'BUY');
      const beli = p.side === 'BUY';
      let harga = null, sebab = null;
      if (p.sl > 0 && (beli ? px <= p.sl : px >= p.sl)) { harga = px; sebab = 'sl'; }
      else if (p.tp > 0 && (beli ? px >= p.tp : px <= p.tp)) { harga = Number(p.tp); sebab = 'tp'; }
      if (!sebab) continue;
      const pnl = qimPaperPnl(p.symbol, p.side, p.entryPrice, harga, p.lots);
      s.posisi.splice(s.posisi.indexOf(p), 1);
      s.saldo = Math.round((s.saldo + pnl) * 100) / 100;
      s.riwayat.unshift(Object.assign({}, p, { closePrice: harga, realizedPnL: pnl, closedAt: '2026-10-22T10:04:00Z', closeReason: sebab }));
    }
  }
  function proses(b) {
    if (s.tolakBerikut) { const t = s.tolakBerikut; s.tolakBerikut = null; return jawab(t.status, t.body); }
    if (b.aksi === 'buka') {
      if (b.client_order_id && s.kunci[b.client_order_id]) return jawab(200, { status: 'success', posisi: s.kunci[b.client_order_id], balance: s.saldo, duplikat: true });
      const harga = sisi(b.symbol, b.side === 'BUY');
      if (!harga) return jawab(409, { status: 'ditolak', message: 'Harga pasar belum tersedia di server.', kode: 'harga_basi' });
      const p = { id: 'POS-' + (++s.nomor), symbol: b.symbol, side: b.side, lots: b.lots, entryPrice: harga, sl: b.sl, tp: b.tp, src: 'manual', openedAt: '2026-10-22T10:00:00Z' };
      s.posisi.push(p);
      if (b.client_order_id) s.kunci[b.client_order_id] = p;
      return jawab(200, { status: 'success', posisi: p, balance: s.saldo });
    }
    if (b.aksi === 'tutup') {
      const i = s.posisi.findIndex((p) => p.id === b.id);
      if (i < 0) {
        const h = s.riwayat.find((x) => x.id === b.id);
        const oleh = { sl: 'stop loss', tp: 'take profit' }[h && h.closeReason];
        return jawab(409, { status: 'ditolak', message: 'Posisi ini sudah ditutup' + (oleh ? ' oleh server (' + oleh + ')' : '') + (h ? ' @ ' + h.closePrice : '') + '.' });
      }
      const p = s.posisi[i];
      const harga = sisi(p.symbol, p.side !== 'BUY');
      const pnl = qimPaperPnl(p.symbol, p.side, p.entryPrice, harga, p.lots);
      s.posisi.splice(i, 1);
      s.saldo = Math.round((s.saldo + pnl) * 100) / 100;
      const h = Object.assign({}, p, { closePrice: harga, realizedPnL: pnl, closedAt: '2026-10-22T10:05:00Z', closeReason: 'manual' });
      s.riwayat.unshift(h);
      return jawab(200, { status: 'success', ditutup: h, balance: s.saldo });
    }
    if (b.aksi === 'ubah') {
      const p = s.posisi.find((x) => x.id === b.id);
      if (!p) return jawab(409, { status: 'ditolak', message: 'Posisi ini sudah ditutup.' });
      // Seperti server: SL/TP baru diperiksa terhadap harga PENUTUPAN kanonik saat ini.
      const px = sisi(p.symbol, p.side !== 'BUY');
      const beli = p.side === 'BUY';
      if (px && b.sl > 0 && (beli ? b.sl >= px : b.sl <= px)) return jawab(422, { status: 'ditolak', message: `Untuk ${p.side}, stop loss harus di ${beli ? 'BAWAH' : 'ATAS'} harga (${px}).`, kode: 'sltp' });
      p.sl = b.sl; p.tp = b.tp;
      return jawab(200, { status: 'success', posisi: p });
    }
    return jawab(410, { status: 'error', message: 'Versi halaman ini sudah lama — muat ulang halaman (Ctrl+F5).' });
  }
  s.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('api/live-price.php')) {
      const daftar = decodeURIComponent((url.split('symbols=')[1] || '').split('&')[0]).split(',').filter(Boolean);
      s.hargaDiminta.push(daftar);
      const prices = {};
      for (const x of daftar) if (s.harga[x]) prices[x] = Object.assign({}, s.harga[x]);
      return jawab(200, { status: 'success', prices });
    }
    if (url.startsWith('api/competition.php?harga=')) {
      const daftar = decodeURIComponent(url.split('harga=')[1] || '').split(',').filter(Boolean);
      s.kanonikDiminta.push(daftar);
      const dilayani = daftar.filter((x) => KANONIK.includes(x)).slice(0, 12);
      if (!dilayani.length) return jawab(400, { status: 'error', message: 'Simbol tidak dikenal.' });
      const isi = {};
      for (const x of dilayani) { const q = kutipan(x); isi[x] = q ? Object.assign({ umur: 0 }, q) : null; }
      return jawab(200, { status: 'success', tingkat: 'std', sekarang: Math.floor(Date.now() / 1000), kutipan: isi, umur_maks_isi: 10 });
    }
    if (url === 'api/live-trade.php') {
      if ((init.method || 'GET') === 'GET') {
        s.liveGet++;
        if (s.akunGagal) return jawab(500, { status: 'error', message: 'galat' });
        return jawab(200, { status: 'success', accounts: s.akunReal.map((a) => Object.assign({}, a)), orders: [] });
      }
      const b = JSON.parse(init.body);
      s.liveTrade.push(b);
      if (!s.akunReal.some((a) => Number(a.id) === Number(b.account_id))) return jawab(404, { status: 'error', message: 'Akun MT5 tidak ditemukan.', code: 'ACCOUNT_NOT_FOUND' });
      if (s.gagalkanReal) return jawab(409, { status: 'error', message: 'EXECUTION_NOT_READY', code: 'EXECUTION_NOT_READY' });
      return jawab(200, { status: 'success', message: 'Order masuk antrean aman selama lima menit.', order_token: 'tok-' + s.liveTrade.length, source: 'manual' });
    }
    if (url === 'api/paper-trading.php' && (init.method || 'GET') === 'GET') {
      s.get++;
      if (s.getGagal) return jawab(500, { status: 'error', message: 'galat' });
      selesaikan();
      return jawab(200, { status: 'success', data: { balance: s.saldo, positions: s.posisi.map((p) => Object.assign({}, p)), history: s.riwayat.map((h) => Object.assign({}, h)), symbols: SIMBOL } });
    }
    if (url === 'api/paper-trading.php' && init.method === 'POST') {
      const b = JSON.parse(init.body);
      s.post.push(b);
      if (s.tahan) await s.tahan;
      if (s.putusSebelumProses > 0) { s.putusSebelumProses--; throw new TypeError('Failed to fetch'); }
      const ke = s.tolakPostKe[s.post.length];
      if (ke) return jawab(ke.status, ke.body);
      selesaikan();
      let r = proses(b);
      // Diproses (INSERT/UPDATE tersimpan), lalu jawabannya rusak: 5xx / halaman HTML gateway.
      if (s.galatSetelahProses) { const g = s.galatSetelahProses; s.galatSetelahProses = null; r = { ok: false, status: g.status, json: async () => { throw new SyntaxError('Unexpected token <'); } }; }
      if (s.putusSetelahProses > 0) { s.putusSetelahProses--; throw new TypeError('Failed to fetch'); }
      return r;
    }
    throw new Error('URL tidak dikenal server tiruan: ' + url);
  };
  return s;
}

// ── Sandbox ──────────────────────────────────────────────────────────────────
/**
 * @param {object} opsi
 *   tingkat  : hasil qiTingkatSaatIni() (bawaan 1 = PRO)
 *   simbol   : simbol chart (bawaan 'XAUUSD'; '' = tidak ada)
 *   nilai    : nilai awal input {id: value}
 *   tanpaUuid: true → crypto.randomUUID tidak ada (uji cadangan)
 *   setuju   : jawaban window.confirm (bawaan true) — atau fungsi (pesan) → boolean
 *   akunReal : akun MT5 yang dijawab api/live-trade.php (bawaan satu akun id 7 'ICMarkets Demo')
 *   gagalkanReal: POST api/live-trade.php ditolak (409 EXECUTION_NOT_READY)
 */
function sandbox(opsi = {}) {
  const server = serverTiruan(opsi);
  const elemen = {};
  // Nilai bawaan sama dengan markup dashboard.html (qtLot 0.01, ptLots 0.1, ptSymbol XAUUSD, ptSide BUY).
  // #liveAccountId KOSONG seperti saat halaman dibuka: select itu baru terisi oleh loadLiveExecution().
  const nilai = Object.assign({ qtLot: '0.01', qtSL: '', qtTP: '', ptLots: '0.1', ptSymbol: 'XAUUSD', ptSide: 'BUY', ptAkun: 'sim', liveAccountId: '' }, opsi.nilai || {});
  const el = (id) => {
    if (!elemen[id]) {
      elemen[id] = buatElemen(id);
      if (nilai[id] !== undefined) elemen[id].value = nilai[id];
    }
    return elemen[id];
  };
  // jejak.liveAction = muatan POST yang BENAR-BENAR sampai di api/live-trade.php tiruan.
  const jejak = { toast: [], interval: [], konfirmasi: [], liveAction: server.liveTrade, peristiwa: [], galat: [] };
  const pendengarWin = {}, pendengarDoc = {};
  let tingkat = opsi.tingkat === undefined ? 1 : opsi.tingkat;
  let uuid = 0;
  const document = {
    visibilityState: 'visible', readyState: 'complete',
    getElementById: el,
    querySelectorAll: (sel) => Object.values(elemen).flatMap((e) => cocok(e._anak, sel)),
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    addEventListener(j, fn) { (pendengarDoc[j] = pendengarDoc[j] || []).push(fn); },
  };
  const WL = [
    { key: 'XAUUSD', tv: 'OANDA:XAUUSD' }, { key: 'EURUSD', tv: 'OANDA:EURUSD' }, { key: 'BTCUSDT', tv: 'BINANCE:BTCUSDT' },
    { key: 'USDCHF', tv: 'OANDA:USDCHF' }, { key: 'US30', tv: 'OANDA:US30USD' },
  ];
  const simbolChart = opsi.simbol === undefined ? 'XAUUSD' : opsi.simbol;
  const ctx = {
    document, console,
    DP: { XAUUSD: 2, EURUSD: 5, USDCHF: 5, USDJPY: 3, BTCUSDT: 2, ETHUSDT: 2, US30: 1, XAGUSD: 4, NAS100: 1 },
    SYMBOL_LABELS: { XAUUSD: 'XAU/USD', EURUSD: 'EUR/USD', USDCHF: 'USD/CHF', BTCUSDT: 'BTC/USDT' },
    WL_GROUPS: [{ syms: WL }],
    _tvSymbol: (WL.find((s) => s.key === simbolChart) || { tv: 'TIDAK:ADA' }).tv,
    _lwSeries: null,
    qiTingkatSaatIni: () => tingkat,
    showQuantumToast: (pesan, jenis) => jejak.toast.push({ pesan: String(pesan), jenis }),
    fetchMarketData: () => {},
    fetch: (url, init) => server.fetch(url, init),
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 5)),
    clearTimeout,
    setInterval: (f, ms) => { jejak.interval.push({ f, ms }); return jejak.interval.length; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
  };
  ctx.window = ctx;
  ctx.crypto = opsi.tanpaUuid ? {} : { randomUUID: () => '0b5c7c1e-0000-4000-8000-' + String(++uuid).padStart(12, '0') };
  ctx.confirm = (pesan) => { jejak.konfirmasi.push(pesan); return typeof opsi.setuju === 'function' ? !!opsi.setuju(pesan) : opsi.setuju !== false; };
  ctx.addEventListener = (j, fn) => { (pendengarWin[j] = pendengarWin[j] || []).push(fn); };
  ctx.dispatchEvent = (ev) => { jejak.peristiwa.push(ev.type); (pendengarWin[ev.type] || []).forEach((fn) => fn(ev)); };
  vm.createContext(ctx);
  vm.runInContext('var _lastPrices = {}; var _qiHargaWaktu = {};', ctx);
  vm.runInContext(ambilFungsi('fmt'), ctx);
  // Jalur order REAL memakai fungsi ASLI (dulu ditiru — tiruan selalu "sukses", sehingga toast hijau
  // "Order masuk antrean." untuk order yang tidak pernah dikirim tidak tertangkap uji).
  // Daftar akun MT5 kini disimpan di memori (_akunLive), bukan di <select id="liveAccountId"> — dashboard
  // tidak lagi punya pemilih itu (pengaturan broker pindah ke Profil). Pilihan tersimpan: localStorage 'qi_live_akun'.
  vm.runInContext('var _akunLive = [];', ctx);
  ctx.localStorage = { getItem: (k) => (opsi.akunTersimpan !== undefined && k === 'qi_live_akun' ? String(opsi.akunTersimpan) : null), setItem() {} };
  for (const nama of ['liveHeaders', 'loadLiveExecution', 'liveAction']) vm.runInContext(ambilFungsi(nama), ctx);
  vm.runInContext(MATH, ctx);
  vm.runInContext(AKSI, ctx);
  vm.runInContext(BLOK_PAPER, ctx);

  const jalankan = (kode) => vm.runInContext(kode, ctx);
  /** Kutipan kanonik di klien (seperti baru diterima dari api/competition.php?harga=), umur dalam detik. */
  const pasangKanonik = (sym, q, umurDetik = 0) => {
    ctx.__q = q === null ? null : Object.assign({ umur: 0 }, q);
    jalankan(`_ptKanonik[${JSON.stringify(sym)}] = true; if (__q) _ptKutipan[${JSON.stringify(sym)}] = { q: __q, diterima: Date.now() - ${Number(umurDetik) * 1000} }; else delete _ptKutipan[${JSON.stringify(sym)}];`);
  };
  /** Harga feed tampilan SAJA (live-price), umur dalam detik. */
  const hargaLive = (sym, d, umurDetik = 0) => {
    server.harga[sym] = d;
    ctx._lastPrices[sym] = Object.assign({}, d);
    ctx._qiHargaWaktu[sym] = Date.now() - umurDetik * 1000;
  };
  /** Harga feed kanonik SAJA (isi order & SL/TP server); simbol di luar QI_KOMP_SIMBOL tidak dilayani. */
  const hargaKanonik = (sym, d, umurDetik = 0) => {
    server.kanonik[sym] = d;
    if (KANONIK.includes(sym)) pasangKanonik(sym, d, umurDetik);
  };
  /** Harga segar dari "server" di KEDUA feed (angka sama) — feed kanonik hanya untuk simbol yang dilayaninya. */
  const harga = (sym, d, umurDetik = 0) => {
    hargaLive(sym, d, umurDetik);
    delete server.kanonik[sym];
    if (KANONIK.includes(sym)) pasangKanonik(sym, d, umurDetik);
  };
  /** Tanpa harga sama sekali di klien (kedua feed) — server tiruan tetap punya harganya. */
  const kosongkanHarga = () => {
    ctx._lastPrices = {};
    jalankan('for (const k of Object.keys(_ptKutipan)) delete _ptKutipan[k]; for (const k of Object.keys(_ptKanonik)) delete _ptKanonik[k];');
  };
  harga('XAUUSD', server.harga.XAUUSD);
  /** Klik lewat dispatcher qim-aksi.js yang SEBENARNYA (elemen nonaktif diabaikan seperti di peramban). */
  const klik = (target) => { for (const fn of pendengarDoc.click || []) fn({ target, cancelBubble: false, stopPropagation() {} }); };
  const tombol = (aksi, arg, extra = {}) => Object.assign({
    nodeType: 1, disabled: false, parentElement: null,
    hasAttribute: (a) => a === 'data-qi-aksi',
    getAttribute: (a) => (a === 'data-qi-aksi' ? aksi : a === 'data-qi-arg' ? arg : null),
  }, extra);
  const tunggu = async (ms = 40) => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, ms / 4)); };
  return {
    ctx, server, jejak, el, jalankan, harga, hargaLive, hargaKanonik, kosongkanHarga, klik, tombol, tunggu,
    setTingkat: (t) => { tingkat = t; },
    picu: (j) => (pendengarWin[j] || []).forEach((fn) => fn({ type: j })),
    picuDoc: (j) => (pendengarDoc[j] || []).forEach((fn) => fn({ type: j })),
    /** Jalankan semua setInterval yang didaftarkan blok paper (mis. muat berkala 5 detik). */
    detak: () => jejak.interval.forEach((x) => x.f()),
    toastTerakhir: () => jejak.toast[jejak.toast.length - 1] || null,
  };
}

module.exports = { sandbox, ambilFungsi, potong, SRC, baca, urai, cocok, jawab, KANONIK };
