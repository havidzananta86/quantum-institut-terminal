/**
 * ARENA KOMPETISI — PERILAKU assets/js/halaman-kompetisi.js yang ASLI, dijalankan di sandbox vm
 * dengan DOM tiruan kecil dan server tiruan (fetch). Yang diuji adalah apa yang terjadi saat pengguna
 * menekan tombol, bukan ada/tidaknya teks (audit kompetisi 2026-10-22):
 *   · penonton (tanpa login/FREE) TIDAK memanggil endpoint pribadi; papan & aktivitas tetap tampil;
 *   · tombol BUY menampilkan ask, SELL bid; PASAR TUTUP menonaktifkan tombol;
 *   · tombol nonaktif selama order berjalan; toast sukses HANYA untuk HTTP 200 dengan harga isi server;
 *   · penolakan server tidak pernah berubah jadi toast sukses;
 *   · client_order_id (UUID) dikirim, dan pengiriman ulang setelah jaringan putus memakai id YANG SAMA;
 *   · SL/TP cepat dihitung untuk sisi yang DITEKAN (BUY dari ask, SELL dari bid);
 *   · chart: respons simbol lama dibuang (token urutan), fitContent hanya saat simbol/TF berganti,
 *     candle terakhir bergerak dari harga live (series.update);
 *   · tab tersembunyi → tidak ada polling; 401 → turun ke mode penonton.
 *
 * Run:  node tests/kompetisi-arena-perilaku.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const KODE = fs.readFileSync(path.join(root, 'assets/js/halaman-kompetisi.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'kompetisi.html'), 'utf8');
const { qimPaperMult } = require(path.join(root, 'assets/js/qim-paper-math.js'));
const ID_HTML = new Set([...HTML.matchAll(/\bid="([A-Za-z][\w-]*)"/g)].map((m) => m[1]));

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 400)}`);
  if (!ok) gagal++;
};
const tunggu = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

// ── DOM tiruan ───────────────────────────────────────────────────────────────
class El {
  constructor(id) {
    this.id = id; this.textContent = ''; this._html = ''; this.value = ''; this.disabled = false;
    this.dataset = {}; this.style = {}; this._kelas = new Set(); this._dengar = {}; this._anak = {}; this.attr = {};
    const self = this;
    this.classList = {
      add: (...k) => k.forEach((x) => self._kelas.add(x)),
      remove: (...k) => k.forEach((x) => self._kelas.delete(x)),
      toggle: (k, paksa) => { const on = paksa === undefined ? !self._kelas.has(k) : !!paksa; if (on) self._kelas.add(k); else self._kelas.delete(k); return on; },
      contains: (k) => self._kelas.has(k),
    };
  }
  get className() { return [...this._kelas].join(' '); }
  set className(v) { this._kelas = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  get options() { return (this._html.match(/<option/g) || []); }
  get children() { return (this._html.match(/<button/g) || []); }
  setAttribute(k, v) { this.attr[k] = String(v); }
  getAttribute(k) { return this.attr[k]; }
  addEventListener(t, fn) { (this._dengar[t] = this._dengar[t] || []).push(fn); }
  async picu(t, evt = {}) { for (const fn of this._dengar[t] || []) await fn(Object.assign({ target: this, currentTarget: this, preventDefault() {} }, evt)); }
  querySelector(sel) { return this._anak[sel] || (this._anak[sel] = new El(null)); }
  querySelectorAll() { return []; }
  focus() {}
  closest() { return null; }
}

function buatSandbox(opsi = {}) {
  const el = {};
  const body = new El('body');
  body.className = 'h-full komp-penonton';
  const tiket = new El('tiket');
  const dengarDoc = {};
  const document = {
    readyState: 'complete', visibilityState: 'visible', body, activeElement: null,
    getElementById: (id) => (ID_HTML.has(id) ? (el[id] = el[id] || new El(id)) : null),
    querySelector: (sel) => (sel === '.komp-tiket' ? tiket : null),
    querySelectorAll: () => [],
    addEventListener: (t, fn) => { (dengarDoc[t] = dengarDoc[t] || []).push(fn); },
  };
  const interval = [];
  const server = { log: [], rute: opsi.rute || {} };
  const json = (status, data) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(data) });
  const bawaan = {
    posisi: () => json(200, { status: 'success', data: { balance: 10000, positions: opsi.posisi || [], history: [], symbols: [],
      kompetisi: { periode: '2026-W43', realisasi: 0, mengambang: 0, margin_terpakai: 0, leverage: 100, stopout_pct: 50, tanpa_harga: 0 } } }),
    harga: () => json(200, { status: 'success', umur_maks_isi: 10, kutipan: opsi.kutipan || {
      XAUUSD: { price: 4130.39, bid: 4130.39, ask: 4130.79, spread: 0.4, source: 'binance_paxg', market: null, umur: 0, chgPct: 0.12 } } }),
    papan: () => json(200, { status: 'success', sekarang: new Date().toISOString(),
      turnamen: { nama: 'QIM Weekly Trading Championship', kunci: 'weekly-championship', periode: '2026-W43', mulai: '2026-10-19T00:00:00+07:00',
        selesai: new Date(Date.now() + 2 * 86400e3).toISOString(), total_hadiah: 50000, hadiah_contoh: true, peserta: 3, trader: 2, terdaftar: true, leverage: 100, stopout_pct: 50 },
      papan: { jenis: 'weekly', dibangun: Math.floor(Date.now() / 1000), baris: [
        { kode: 'aaaaaaaaaaaa', nama: 'Ana P.', rank: 1, aktif: true, equity: 10600, return_pct: 6, floating: 100, open_count: 1, trades: 1, win_rate: 100, aktivitas_ts: Math.floor(Date.now() / 1000) - 30, harga_basi: false, saya: false },
        { kode: 'bbbbbbbbbbbb', nama: 'Budi S.', rank: 2, aktif: true, equity: 10200, return_pct: 2, floating: 0, open_count: 0, trades: 1, win_rate: 100, aktivitas_ts: 1, harga_basi: true, tanpa_harga: 1, saya: true },
        { kode: 'cccccccccccc', nama: 'Cic***', rank: 3, aktif: false, equity: 10000, return_pct: 0, floating: 0, open_count: 0, trades: 0, win_rate: 0, aktivitas_ts: null, harga_basi: false, saya: false },
      ], saya_di_luar: null },
      aktivitas: [
        { jenis: 'tutup', kode: 'bbbbbbbbbbbb', nama: 'Budi S.', symbol: 'XAUUSD', side: 'SELL', lots: 0.2, harga: 4120.5, pnl: 200, alasan: 'tp', ts: Math.floor(Date.now() / 1000) - 5 },
        { jenis: 'buka', kode: 'aaaaaaaaaaaa', nama: 'Ana P.', symbol: 'BTCUSDT', side: 'BUY', lots: 0.1, harga: 80000, ts: Math.floor(Date.now() / 1000) - 60 },
      ],
      saya_minggu: opsi.penonton ? null : { rank: 2, dari: 2, aktif: true } }),
    candle: () => json(200, { status: 'success', simulated: false, source: 'binance_paxg',
      candles: [{ time: Math.floor(Date.now() / 3600e3) * 3600 - 3600, open: 4120, high: 4131, low: 4119, close: 4128 },
                { time: Math.floor(Date.now() / 3600e3) * 3600, open: 4128, high: 4130, low: 4125, close: 4129 }] }),
  };
  const fetch = (url, o = {}) => {
    const req = { url: String(url), method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : null, headers: o.headers || {} };
    server.log.push(req);
    const jenis = req.url.startsWith('api/paper-trading.php') ? (req.method === 'POST' ? 'aksi' : 'posisi')
      : req.url.includes('competition.php?harga=') ? 'harga'
      : req.url.includes('competition.php?papan=') ? 'papan'
      : req.url.includes('competition.php?trader=') ? 'trader'
      : req.url.startsWith('api/get-chart-data.php') ? 'candle' : 'lain';
    const r = server.rute[jenis] || bawaan[jenis];
    if (!r) return json(404, {});
    return r(req, json);
  };
  const seri = { data: [], update: [], setData(d) { this.data.push(d); }, applyOptions() {}, createPriceLine() { return {}; }, removePriceLine() {} };
  seri.update = [];
  seri.updateFn = null;
  const chartLog = { pas: 0 };
  const lw = {
    CandlestickSeries: {}, CrosshairMode: { Normal: 0 },
    createChart: () => ({ timeScale: () => ({ fitContent: () => { chartLog.pas++; } }), addSeries: () => ({
      setData: (d) => seri.data.push(d), update: (b) => seri.update.push(b), applyOptions() {}, createPriceLine: () => ({}), removePriceLine() {} }), remove() {} }),
  };
  const simpan = { qi_token: opsi.penonton ? null : 'token-uji' };
  const penyimpanan = { getItem: (k) => simpan[k] ?? null, setItem: (k, v) => { simpan[k] = v; } };
  let uuid = 0;
  const window = {
    QI_KOMP_MODE: opsi.penonton ? 'penonton' : 'trader',
    _lwModules: lw, qimPaperMult,
    addEventListener() {},
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(++uuid).padStart(12, '0'), getRandomValues: (a) => a },
  };
  const ctx = {
    window, document, fetch, console, localStorage: penyimpanan, sessionStorage: penyimpanan,
    CSS: { escape: (s) => String(s) }, crypto: window.crypto, Promise, Date, Math, JSON, Number, String, Array, Object, Set, Map, Uint8Array,
    setInterval: (fn, ms) => { interval.push({ fn, ms }); return interval.length; },
    setTimeout: (fn, ms) => { if (ms <= 1000) Promise.resolve().then(fn); return 0; },
    clearTimeout() {}, CustomEvent: function () {},
  };
  window.document = document;
  vm.createContext(ctx);
  vm.runInContext(KODE, ctx, { filename: 'halaman-kompetisi.js' });
  return { ctx, el: (id) => document.getElementById(id), server, interval, seri, chartLog, document, body };
}
const permintaan = (s, jenis) => s.server.log.filter((r) => jenis(r));

(async () => {
  console.log('Mode penonton (tanpa login)');
  {
    const s = buatSandbox({ penonton: true });
    await tunggu();
    const pribadi = s.server.log.filter((r) => r.url.startsWith('api/paper-trading.php') || r.url.includes('?harga=') || r.url.startsWith('api/get-chart-data.php'));
    cek('tidak ada panggilan ke endpoint pribadi (paper-trading, ?harga, candle)', pribadi.length === 0, pribadi.map((r) => r.url));
    cek('papan publik dimuat tanpa header Authorization', s.server.log.some((r) => r.url.includes('papan=weekly') && !r.headers.Authorization));
    const papan = s.el('kompPapan').innerHTML;
    cek('papan: medali juara 1, nama disamarkan, ⚠ harga basi, "belum trading"', /komp-medali m1/.test(papan) && /Ana P\./.test(papan) && /harga basi/.test(papan) && /belum trading/.test(papan), papan.slice(0, 300));
    cek('baris papan bisa dibuka ke laci trader (data-kode)', /data-kode="aaaaaaaaaaaa"/.test(papan));
    const feed = s.el('kompFeed').innerHTML;
    cek('aktivitas: "membuka BUY 0.10 BTCUSDT @ 80,000.00" dan "menutup … +$200.00 (kena TP)"', /membuka <span class="komp-sisi buy">BUY<\/span> 0\.10 BTCUSDT @ 80,000\.00/.test(feed) && /menutup .*\+\$200\.00.*kena TP/.test(feed), feed.slice(0, 400));
    cek('hero: nama turnamen & total hadiah dengan tanda CONTOH', s.el('kompTurnamen').textContent === 'QIM Weekly Trading Championship' && /\$50,000/.test(s.el('kompHadiah').innerHTML) && /CONTOH/.test(s.el('kompHadiah').innerHTML));
    cek('body tetap ber-kelas komp-penonton (tiket disembunyikan CSS)', s.body.classList.contains('komp-penonton'));
    const jumlah = s.server.log.length;
    s.document.visibilityState = 'hidden';
    for (const i of s.interval) i.fn();
    await tunggu();
    cek('tab tersembunyi → interval tidak memanggil server sama sekali', s.server.log.length === jumlah, s.server.log.length - jumlah);
    await s.el('kompPapan').picu('click', { target: { closest: () => ({ dataset: { kode: 'aaaaaaaaaaaa' } }) } });
    await tunggu();
    cek('klik baris papan → laci trader terbuka & memanggil ?trader=<kode>', !s.el('kompLaci').classList.contains('hidden') && s.server.log.some((r) => r.url.includes('competition.php?trader=aaaaaaaaaaaa')));
  }

  console.log('\nMode trader: harga tiket');
  {
    const s = buatSandbox();
    await tunggu();
    cek('memanggil paper-trading, ?harga, papan, dan candle', ['api/paper-trading.php', '?harga=XAUUSD', 'papan=weekly', 'get-chart-data.php'].every((u) => s.server.log.some((r) => r.url.includes(u))));
    cek('tombol BUY menampilkan ASK', s.el('kompHargaBeli').textContent === '4,130.79', s.el('kompHargaBeli').textContent);
    cek('tombol SELL menampilkan BID', s.el('kompHargaJual').textContent === '4,130.39', s.el('kompHargaJual').textContent);
    cek('spread & sumber feed terlihat', s.el('kompSpread').textContent === '0.40' && /PROKSI PAXG/.test(s.el('kompSumberHarga').textContent), [s.el('kompSpread').textContent, s.el('kompSumberHarga').textContent]);
    cek('bar ponsel menampilkan harga yang sama', s.el('kompMHargaBeli').textContent === '4,130.79' && s.el('kompMHargaJual').textContent === '4,130.39');
    cek('tombol aktif saat pasar buka', s.el('kompBeli').disabled === false && s.el('kompJual').disabled === false);
    cek('peringkat minggu ini dari baris papan pemanggil', s.el('kompRankSaya').textContent === '#2 dari 2', s.el('kompRankSaya').textContent);
    cek('satuan SL/TP XAUUSD = $', /\$/.test(s.el('kompSatuanSl').textContent), s.el('kompSatuanSl').textContent);
  }
  {
    const s = buatSandbox({ kutipan: { XAUUSD: { price: 4130.39, bid: 4130.39, ask: 4130.79, spread: 0.4, source: 'oanda_tv', market: 'closed', umur: 3000 } } });
    await tunggu();
    cek('PASAR TUTUP → kedua tombol nonaktif dan lencana tampil', s.el('kompBeli').disabled && s.el('kompJual').disabled
      && !s.el('kompPasarTutup').classList.contains('hidden') && s.el('kompPasarTutup').querySelector('b').textContent === 'PASAR TUTUP');
    await s.el('kompBeli').picu('click');
    await tunggu();
    cek('klik saat pasar tutup → tidak ada order terkirim', permintaan(s, (r) => r.method === 'POST').length === 0);
  }
  {
    const s = buatSandbox({ kutipan: { XAUUSD: null } });
    await tunggu();
    cek('tanpa kutipan → tombol nonaktif, harga "—" (tidak dikarang)', s.el('kompBeli').disabled && s.el('kompHargaBeli').textContent === '—');
  }

  console.log('\nOrder: sukses hanya dari HTTP 200 + harga isi server');
  {
    let lepas;
    const s = buatSandbox({ rute: { aksi: (req, json) => new Promise((r) => { lepas = () => r(json(200, { status: 'success', balance: 10000,
      posisi: { id: 'POS-9', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4130.85, kompPeriode: '2026-W43' } })); }) } });
    await tunggu();
    s.el('kompLot').value = '0.10';
    s.el('kompSl').value = '5';
    s.el('kompTp').value = '10';
    const klik = s.el('kompBeli').picu('click');
    await tunggu();
    cek('selama order berjalan, BUY & SELL nonaktif', s.el('kompBeli').disabled === true && s.el('kompJual').disabled === true && s.el('kompMBeli').disabled === true);
    await s.el('kompBeli').picu('click');
    await tunggu();
    const kirim = permintaan(s, (r) => r.method === 'POST');
    cek('klik kedua selama berjalan tidak mengirim order kedua', kirim.length === 1, kirim.length);
    const b = kirim[0].body;
    cek('muatan: aksi buka, client_order_id UUID, asal tiket, harga = ask', b.aksi === 'buka' && /^[0-9a-f-]{36}$/.test(b.client_order_id) && b.asal === 'tiket' && b.harga === 4130.79, b);
    cek('SL/TP untuk BUY dihitung dari ASK: SL 4125.79, TP 4140.79', b.sl === 4125.79 && b.tp === 4140.79, [b.sl, b.tp]);
    lepas();
    await klik; await tunggu();
    const t = s.el('kompToast');
    cek('toast sukses memakai harga isi SERVER (4,130.85), bukan harga layar', /tereksekusi @ 4,130\.85/.test(t.textContent) && t.className.includes('sukses'), t.textContent);
    cek('posisi dimuat ulang dari server setelah order', permintaan(s, (r) => r.url === 'api/paper-trading.php' && r.method === 'GET').length >= 2);
    cek('tombol aktif lagi setelah jawaban', s.el('kompBeli').disabled === false);
  }
  {
    const s = buatSandbox({ rute: { aksi: (req, json) => json(409, { status: 'ditolak', kode: 'requote', message: 'Harga bergerak: layar Anda 4130.79, pasar 4150.2. Order tidak dieksekusi (requote).' }) } });
    await tunggu();
    s.el('kompLot').value = '0.10';
    await s.el('kompJual').picu('click');
    await tunggu();
    const t = s.el('kompToast');
    cek('penolakan 409 → toast GALAT berisi pesan server, tanpa "tereksekusi"', t.className.includes('error') && /requote/.test(t.textContent) && !/tereksekusi/.test(t.textContent), t.textContent);
  }
  {
    const s = buatSandbox({ rute: { aksi: (req, json) => json(200, { status: 'ditolak', message: 'aneh' }) } });
    await tunggu();
    s.el('kompLot').value = '0.10';
    await s.el('kompBeli').picu('click');
    await tunggu();
    cek('HTTP 200 tanpa status success → BUKAN sukses', !/tereksekusi/.test(s.el('kompToast').textContent) && s.el('kompToast').className.includes('error'), s.el('kompToast').textContent);
  }
  {
    let ke = 0;
    const s = buatSandbox({ rute: { aksi: (req, json) => (++ke === 1 ? Promise.reject(new Error('putus'))
      : json(200, { status: 'success', duplikat: true, posisi: { id: 'POS-9', symbol: 'XAUUSD', side: 'SELL', lots: 0.1, entryPrice: 4130.3, kompPeriode: '2026-W43' } })) } });
    await tunggu();
    s.el('kompLot').value = '0.10';
    s.el('kompSl').value = '5';
    await s.el('kompJual').picu('click');
    await tunggu(20);
    const kirim = permintaan(s, (r) => r.method === 'POST');
    cek('jaringan putus → dikirim ulang SEKALI dengan client_order_id yang SAMA', kirim.length === 2 && kirim[0].body.client_order_id === kirim[1].body.client_order_id, kirim.map((k) => k.body.client_order_id));
    cek('SL untuk SELL dihitung dari BID: 4130.39 + 5 = 4135.39', kirim[0].body.sl === 4135.39 && kirim[0].body.harga === 4130.39, kirim[0].body);
    cek('jawaban duplikat dikatakan (tidak digandakan)', /sudah tercatat sebelumnya/.test(s.el('kompToast').textContent), s.el('kompToast').textContent);
  }

  console.log('\nPosisi, tutup, dan sesi');
  {
    const pos = [{ id: 'POS-5', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4120, sl: null, tp: null, src: 'manual', kompPeriode: '2026-W43' },
                 { id: 'POS-6', symbol: 'XAUUSD', side: 'SELL', lots: 1, entryPrice: 4000, src: 'ai' }];
    const s = buatSandbox({ posisi: pos, rute: { aksi: (req, json) => json(409, { status: 'ditolak', message: 'Posisi ini sudah ditutup oleh server (stop loss) @ 4110.' }) } });
    await tunggu(); await tunggu();
    const isi = s.el('kompPosisi').innerHTML;
    cek('hanya posisi manual yang bisa ditutup; posisi bot disebut terpisah', /data-tutup="POS-5"/.test(isi) && !/data-tutup="POS-6"/.test(isi) && /TIDAK dihitung papan peringkat/.test(s.el('kompBot').textContent));
    cek('mengambang ditandai di BID untuk BUY: (4130.39 − 4120) × 0,1 × 100 = +$103.90', s.el('kompMengambang').textContent === '+$103.90', s.el('kompMengambang').textContent);
    cek('ekuitas turnamen = 10.000 + terealisasi + mengambang', s.el('kompEkuitas').textContent === '$10,103.90', s.el('kompEkuitas').textContent);
    await s.el('kompPosisi').picu('click', { target: { closest: (sel) => (sel === '[data-tutup]' ? { dataset: { tutup: 'POS-5' } } : null) } });
    await tunggu();
    const kirim = permintaan(s, (r) => r.method === 'POST');
    cek('tutup mengirim {aksi:tutup, id, harga = bid}', kirim.length === 1 && kirim[0].body.aksi === 'tutup' && kirim[0].body.id === 'POS-5' && kirim[0].body.harga === 4130.39, kirim.map((k) => k.body));
    cek('409 "sudah ditutup oleh server" → pesan server, bukan "Posisi ditutup @"', /stop loss/.test(s.el('kompToast').textContent) && !/ditutup @ 4,13/.test(s.el('kompToast').textContent), s.el('kompToast').textContent);
  }
  {
    const s = buatSandbox({ rute: { posisi: (req, json) => json(401, { status: 'error', code: 'AUTH_REQUIRED' }) } });
    await tunggu(); await tunggu();
    cek('401 dari paper-trading → turun ke mode penonton', s.body.classList.contains('komp-penonton'));
  }

  console.log('\nChart');
  {
    const lepas = [];
    const s = buatSandbox({ rute: { candle: (req, json) => new Promise((r) => lepas.push({ url: req.url, beri: (src, c) => r(json(200, { status: 'success', simulated: false, source: src, candles: [{ time: 1000, open: c, high: c, low: c, close: c }, { time: 4600, open: c, high: c, low: c, close: c }] })) })) } });
    await tunggu();
    s.el('kompSimbol').value = 'EURUSD';
    await s.el('kompSimbol').picu('change', { target: { value: 'EURUSD' } });
    await tunggu();
    cek('dua permintaan candle (XAUUSD lalu EURUSD)', lepas.length === 2 && /XAUUSD/.test(lepas[0].url) && /EURUSD/.test(lepas[1].url), lepas.map((l) => l.url));
    lepas[1].beri('binance', 1.1);
    await tunggu();
    lepas[0].beri('binance_paxg', 4130);
    await tunggu();
    cek('respons XAUUSD yang datang belakangan DIBUANG (token urutan)', s.seri.data.length === 1 && s.seri.data[0][0].close === 1.1, s.seri.data.map((d) => d[0].close));
    cek('fitContent sekali saat simbol baru digambar', s.chartLog.pas === 1, s.chartLog.pas);
    // Muat ulang berkala simbol/TF yang sama: zoom pengguna dipertahankan.
    const intervalCandle = s.interval.find((i) => i.ms === 60000);
    intervalCandle.fn();
    await tunggu();
    lepas[2].beri('binance', 1.2);
    await tunggu();
    cek('penyegaran berkala simbol yang sama TIDAK memanggil fitContent lagi', s.seri.data.length === 2 && s.chartLog.pas === 1, [s.seri.data.length, s.chartLog.pas]);
  }
  {
    const s = buatSandbox();
    await tunggu(); await tunggu();
    const sebelum = s.seri.update.length;
    const intervalHarga = s.interval.find((i) => i.ms === 4000);
    intervalHarga.fn();
    await tunggu();
    const akhir = s.seri.update[s.seri.update.length - 1];
    cek('candle terakhir digerakkan harga live dari feed yang sama (series.update)', s.seri.update.length > sebelum && akhir && akhir.close === 4130.39, akhir);
    cek('high candle ikut naik ke harga live', akhir && akhir.high >= 4130.39);
  }

  console.log('\nEditor SL/TP bertahan melewati polling posisi (audit G1)');
  {
    const pos = [{ id: 'POS-5', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4120, sl: 4100, tp: null, src: 'manual', kompPeriode: '2026-W43' }];
    const s = buatSandbox({ posisi: pos, rute: { aksi: (req, json) => json(200, { status: 'success', berubah: true, posisi: Object.assign({}, pos[0], { sl: 4111 }) }) } });
    await tunggu(); await tunggu();
    await s.el('kompPosisi').picu('click', { target: { closest: (sel) => (sel === '[data-ubah]' ? { dataset: { ubah: 'POS-5' } } : null) } });
    cek('editor terbuka berisi SL server (4100)', /data-isi-ubah="sl" value="4100"/.test(s.el('kompPosisi').innerHTML), s.el('kompPosisi').innerHTML.slice(0, 300));
    await s.el('kompPosisi').picu('input', { target: { dataset: { isiUbah: 'sl' }, value: '4111' } });
    const pollPosisi = s.interval.find((i) => i.ms === 10000);
    pollPosisi.fn();
    await tunggu(); await tunggu();
    cek('polling 10 dtk TIDAK menimpa angka yang sedang diketik (4111 tetap)', /data-isi-ubah="sl" value="4111"/.test(s.el('kompPosisi').innerHTML) && /data-simpan="POS-5"/.test(s.el('kompPosisi').innerHTML),
      s.el('kompPosisi').innerHTML.slice(0, 400));
    await s.el('kompPosisi').picu('click', { target: { closest: (sel) => (sel === '[data-simpan]' ? { dataset: { simpan: 'POS-5' } } : null) } });
    await tunggu();
    const kirim = permintaan(s, (r) => r.method === 'POST');
    cek("Simpan mengirim SL YANG DIKETIK (4111), bukan nilai lama", kirim.length === 1 && kirim[0].body.aksi === 'ubah' && kirim[0].body.sl === 4111 && kirim[0].body.tp === null, kirim.map((k) => k.body));
  }
  {
    const pos = [{ id: 'POS-5', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4120, sl: 4100, tp: null, src: 'manual', kompPeriode: '2026-W43' }];
    const s = buatSandbox({ posisi: pos, rute: { aksi: (req, json) => json(200, { status: 'success', berubah: false, posisi: pos[0] }) } });
    await tunggu(); await tunggu();
    await s.el('kompPosisi').picu('click', { target: { closest: (sel) => (sel === '[data-ubah]' ? { dataset: { ubah: 'POS-5' } } : null) } });
    await s.el('kompPosisi').picu('click', { target: { closest: (sel) => (sel === '[data-simpan]' ? { dataset: { simpan: 'POS-5' } } : null) } });
    await tunggu();
    cek('server menjawab berubah:false → toast "tidak berubah", bukan "diperbarui"', /tidak berubah/.test(s.el('kompToast').textContent) && !/diperbarui/.test(s.el('kompToast').textContent), s.el('kompToast').textContent);
  }

  console.log('\nPosisi di luar 10 simbol arena & periode lalu (audit G1)');
  {
    const pos = [{ id: 'POS-7', symbol: 'BNBUSDT', side: 'BUY', lots: 1, entryPrice: 600, src: 'manual', kompPeriode: '2026-W43' },
                 { id: 'POS-8', symbol: 'BTCUSDT', side: 'BUY', lots: 0.1, entryPrice: 80000, src: 'manual', kompPeriode: '2026-W42' }];
    const s = buatSandbox({ posisi: pos, rute: { aksi: (req, json) => json(200, { status: 'success', balance: 10000,
      ditutup: { id: 'POS-7', symbol: 'BNBUSDT', side: 'BUY', closePrice: 601.5, realizedPnL: 1.5 } }) } });
    await tunggu(); await tunggu();
    s.interval.find((i) => i.ms === 4000).fn();
    await tunggu();
    cek('?harga meminta simbol posisi di luar tiket arena (BNBUSDT)', s.server.log.some((r) => /competition\.php\?harga=[^&]*BNBUSDT/.test(r.url)), s.server.log.filter((r) => r.url.includes('harga=')).map((r) => r.url));
    const isi = s.el('kompPosisi').innerHTML;
    cek('posisi periode lalu: label "menunggu penutupan server", tanpa tombol Tutup / SL/TP', /periode lalu — menunggu penutupan server/.test(isi) && !/data-tutup="POS-8"/.test(isi) && !/data-ubah="POS-8"/.test(isi), isi.slice(0, 500));
    await s.el('kompPosisi').picu('click', { target: { closest: (sel) => (sel === '[data-tutup]' ? { dataset: { tutup: 'POS-7' } } : null) } });
    await tunggu();
    const kirim = permintaan(s, (r) => r.method === 'POST');
    cek('tutup BNBUSDT tanpa harga layar tetap DIKIRIM, tanpa "harga" (server yang menentukan)', kirim.length === 1 && kirim[0].body.aksi === 'tutup' && kirim[0].body.id === 'POS-7' && !('harga' in kirim[0].body), kirim.map((k) => k.body));
    cek('toast memakai harga tutup server', /ditutup @ 601\.50/.test(s.el('kompToast').textContent), s.el('kompToast').textContent);
  }

  console.log('\nSeri harga XAUUSD posisi (audit G1)');
  {
    const kutipan = { XAUUSD: { price: 4131.03, bid: 4130.9, ask: 4131.1, spread: 0.2, source: 'binance_paxg', geser: 0, market: null, umur: 0,
      proksi: { price: 4131.03, bid: 4130.9, ask: 4131.1, umur: 0 } } };
    const pos = [{ id: 'POS-1', symbol: 'XAUUSD', side: 'BUY', lots: 1, entryPrice: 4138, src: 'manual', kompPeriode: '2026-W43', hargaSumber: 'binance_paxg_selaras', hargaGeser: 7.736 }];
    const s = buatSandbox({ posisi: pos, kutipan });
    await tunggu(); await tunggu();
    cek('posisi proksi ditandai di PAXG + G miliknya: (4130,9 + 7,736 − 4138) × 1 × 100 = +$63.60 (bukan −$710 di PAXG mentah)', s.el('kompMengambang').textContent === '+$63.60', s.el('kompMengambang').textContent);
  }
  {
    const kutipan = { XAUUSD: { price: 4131.03, bid: 4130.9, ask: 4131.1, spread: 0.2, source: 'binance_paxg', geser: 0, market: null, umur: 0,
      proksi: { price: 4131.03, bid: 4130.9, ask: 4131.1, umur: 0 } } };
    const pos = [{ id: 'POS-2', symbol: 'XAUUSD', side: 'BUY', lots: 1, entryPrice: 4138, src: 'manual', kompPeriode: '2026-W43', hargaSumber: 'oanda_tv' }];
    const s = buatSandbox({ posisi: pos, kutipan });
    await tunggu(); await tunggu();
    cek('posisi emas saat feed proksi → P/L tidak ditebak, kartu mengakui angka server', /tanpa harga live/.test(s.el('kompEkuitasCatat').textContent), s.el('kompEkuitasCatat').textContent);
  }

  if (gagal) { console.error(`\nFAIL — ${gagal} pemeriksaan gagal`); process.exit(1); }
  console.log('\nPASS — arena kompetisi berperilaku sesuai kontrak');
})().catch((e) => { console.error(e); process.exit(1); });
