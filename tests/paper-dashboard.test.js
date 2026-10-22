/**
 * Paper trading di dashboard — temuan audit 2026-10-22 (assets/js/dashboard-app.js,
 * qim-dashboard.js, dashboard-pro.js, pro-trading-tools.js):
 *
 *   · harga live DIGABUNG (tidak diganti tiap 15 detik) dan simbol posisi terbuka ikut diminta;
 *   · state paper dimuat saat halaman dibuka (PRO+) dan tiap 20 detik selama terlihat;
 *   · P/L mengambang dinilai di harga PENUTUPAN (bid untuk BUY, ask untuk SELL), harga basi → "—";
 *   · kartu Simulation Balance memakai state yang sama (tanpa GET kedua, pengali dengan harga);
 *   · klik ganda tidak membuka dua posisi (tombol nonaktif + client_order_id + kirim ulang aman);
 *   · penolakan server ditampilkan apa adanya (kode margin / pasar_tutup / requote / 410);
 *   · daftar posisi dibangun ulang hanya bila id berubah; tombol Tutup punya status "Menutup…";
 *   · penutupan oleh SERVER (closeReason sl/tp/stopout/period_end) diumumkan;
 *   · "⚡ Trade Paper" & "Eksekusi Setup AI" = order pasar di harga sisi saat ini, asal 'sinyal'.
 *
 * Kode ASLI dijalankan di sandbox vm (tests/paper-sandbox.js) dengan server tiruan.
 * Run:  node tests/paper-dashboard.test.js
 */
'use strict';
const vm = require('vm');
const { sandbox, ambilFungsi, potong, SRC, baca } = require('./paper-sandbox.js');

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};
const buka = (s) => s.server.post.filter((b) => b.aksi === 'buka');
const POS = (id, extra) => Object.assign({ id, symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4100, sl: null, tp: null, src: 'manual' }, extra);

/** Sandbox yang state-nya sudah dimuat dari server tiruan (seperti sesudah 'load'). */
async function dimuat(posisi = [], opsi = {}) {
  const s = sandbox(opsi);
  s.server.posisi = posisi.map((p) => Object.assign({}, p));
  if (opsi.riwayat) s.server.riwayat = opsi.riwayat;
  s.picu('load');
  await s.tunggu();
  return s;
}

(async () => {
  // ── 1. Harga live digabung ─────────────────────────────────────────────────
  console.log('Harga live: digabung, simbol posisi ikut diminta');
  {
    const BLOK = potong('let _lastPrices  = {};', 'function fmt(sym, price)');
    const minta = [];
    let jawabHarga = {};
    const ctx = {
      SYMBOLS: ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'],
      console, renderTicker() {}, renderMarketTape() {}, renderStatCards() {}, updateWatchlistPrices() {}, ptSiarkanState() { ctx.disiarkan = (ctx.disiarkan || 0) + 1; },
      document: { getElementById: (id) => (id === 'ptSymbol' ? { value: 'XAGUSD' } : null) },
      fetch: async (url) => {
        const daftar = decodeURIComponent(url.split('symbols=')[1]).split(',');
        minta.push(daftar);
        const prices = {};
        for (const s of daftar) if (jawabHarga[s]) prices[s] = jawabHarga[s];
        return { ok: true, json: async () => ({ status: 'success', prices }) };
      },
    };
    ctx.window = { qiChartKonteks: () => ({ symbol: 'GBPJPY' }) };
    vm.createContext(ctx);
    vm.runInContext(BLOK + '\nvar _ptPositions = [{ symbol: "US30" }, { symbol: "NAS100" }, { symbol: "XAUUSD" }];', ctx);
    const g = (k) => vm.runInContext(k, ctx);
    const sekarang = Date.now();
    g(`_lastPrices.NAS100 = { price: 18000 }; _qiHargaWaktu.NAS100 = ${sekarang - 10000};`);
    g(`_lastPrices.GER40 = { price: 19000 }; _qiHargaWaktu.GER40 = ${sekarang - 400000};`);
    g(`_lastPrices.XAUUSD = { price: 4100, bid: 4099.8, ask: 4100.2 };`);
    jawabHarga = { EURUSD: { price: 1.08 }, XAUUSD: { price: 4123.74, source: 'binance_paxg' }, US30: { price: 42000 } };
    await ctx.fetchMarketData();
    const semua = minta.flat();
    cek('simbol posisi terbuka ikut diminta (US30, NAS100)', semua.includes('US30') && semua.includes('NAS100'), semua);
    cek('simbol formulir Paper Trading ikut diminta (XAGUSD)', semua.includes('XAGUSD'));
    cek('simbol chart tetap diminta (GBPJPY)', semua.includes('GBPJPY'));
    cek('tidak ada simbol yang diminta dua kali', new Set(semua).size === semua.length);
    cek('tiap permintaan ≤ 200 karakter (live-price.php memotong di 200)', minta.every((d) => d.join(',').length <= 200), minta.map((d) => d.join(',').length));
    cek('harga baru masuk', g('_lastPrices.US30.price') === 42000);
    cek('harga yang tidak ikut dijawab tetapi masih baru DIPERTAHANKAN (dulu dihapus tiap 15 detik)', g('_lastPrices.NAS100 && _lastPrices.NAS100.price') === 18000);
    cek('harga lama > 5 menit yang tidak lagi diminta dibuang', g('_lastPrices.GER40') === undefined);
    cek('objek simbol yang dijawab DIGANTI utuh: bid/ask lama tidak menempel pada harga baru', g('_lastPrices.XAUUSD.bid') === undefined && g('_lastPrices.XAUUSD.price') === 4123.74);
    cek('waktu ambil per simbol dicatat', Math.abs(g('_qiHargaWaktu.US30') - Date.now()) < 2000);
    cek('perubahan harga disiarkan ke kartu Simulation', ctx.disiarkan === 1);

    // Daftar panjang dipecah.
    minta.length = 0;
    vm.runInContext('_ptPositions = ' + JSON.stringify(['XAGUSD', 'USOIL', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225', 'AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC', 'DDDDDDDDDD', 'EEEEEEEEEE'].map((symbol) => ({ symbol }))), ctx);
    await ctx.fetchMarketData();
    cek('daftar > 200 karakter dipecah jadi beberapa permintaan, tidak ada yang terpotong', minta.length >= 2 && minta.every((d) => d.join(',').length <= 200) && minta.flat().includes('EEEEEEEEEE'), minta.map((d) => d.length));
    cek('kontrak lama tetap: simbol chart ditambahkan ke SYMBOLS', /if \(kini && !SYMBOLS\.includes\(kini\)\) daftar = SYMBOLS\.concat\(kini\);/.test(SRC));
  }

  // ── 2. Muat saat halaman dibuka & berkala ─────────────────────────────────
  console.log('\nState paper dimuat saat halaman dibuka (PRO+) dan berkala');
  {
    const s = sandbox();
    s.server.saldo = 10234.5;
    s.server.posisi = [POS('POS-5')];
    s.jalankan('qtSegarkan()');
    cek('sebelum dimuat: saldo "—" (bukan $10.000 bawaan)', s.el('qtSaldo').textContent === '—', s.el('qtSaldo').textContent);
    s.picu('load');
    await s.tunggu();
    cek('halaman dibuka → satu GET api/paper-trading.php', s.server.get === 1, s.server.get);
    cek('saldo server tampil di Quick Trade', s.el('qtSaldo').textContent === '$10,234.50', s.el('qtSaldo').textContent);
    cek('posisi yang masih terbuka tampil beserta tombol Tutup', /data-tutup-id="POS-5"/.test(s.el('qtPosisi').innerHTML));

    s.detak();
    await s.tunggu();
    cek('detak 5 detik berikutnya (< 20 detik) tidak memuat ulang', s.server.get === 1, s.server.get);
    s.jalankan('_ptDicobaPada = Date.now() - 21000');
    s.detak();
    await s.tunggu();
    cek('setelah 20 detik → dimuat ulang', s.server.get === 2, s.server.get);

    s.jalankan('_ptDicobaPada = 0');
    s.ctx.document.visibilityState = 'hidden';
    s.detak();
    await s.tunggu();
    cek('tab tidak terlihat → tidak memuat', s.server.get === 2);
    s.ctx.document.visibilityState = 'visible';
    s.el('qimRightPanel').terlihat = false;
    s.detak();
    await s.tunggu();
    cek('rail kanan tidak tampil → tidak memuat', s.server.get === 2);
    s.el('qimRightPanel').terlihat = true;
    s.detak();
    await s.tunggu();
    cek('terlihat lagi → dimuat', s.server.get === 3);

    const f = sandbox({ tingkat: 0 });
    f.picu('load');
    f.jalankan('_ptDicobaPada = 0');
    f.detak();
    await f.tunggu();
    cek('paket FREE → tidak pernah GET (server menjawab 403)', f.server.get === 0);

    const g = sandbox();
    g.server.getGagal = true;
    g.picu('load');
    await g.tunggu();
    cek('GET gagal → saldo tetap "—" dan kegagalannya dikatakan', g.el('qtSaldo').textContent === '—' && g.jejak.toast.some((t) => /gagal dimuat/.test(t.pesan)), g.jejak.toast);
    cek('GET gagal → daftar menyebut belum bisa dimuat (bukan "Belum ada posisi")', /belum bisa dimuat/.test(g.el('qtPosisi').innerHTML), g.el('qtPosisi').innerHTML);
  }

  // ── 3. P/L di harga penutupan; harga basi → "—" ───────────────────────────
  console.log('\nP/L mengambang di harga penutupan; harga basi / kurs harian → "—"');
  {
    const s = await dimuat([POS('POS-1'), POS('POS-2', { side: 'SELL', entryPrice: 4150 })]);
    s.jalankan('ptRender()');
    const pnl = (id) => s.el('ptPositionsBody').querySelector(`[data-pt-pnl="${id}"]`);
    const kini = (id) => s.el('ptPositionsBody').querySelector(`[data-pt-kini="${id}"]`);
    cek('tabel panel: BUY dinilai di bid 4123.69 → +$236.90', /^\+\$236\.90/.test(pnl('POS-1').innerHTML), pnl('POS-1').innerHTML);
    cek('tabel panel: SELL dinilai di ask 4123.79 → +$262.10', /^\+\$262\.10/.test(pnl('POS-2').innerHTML), pnl('POS-2').innerHTML);
    cek('kolom harga kini = harga penutupan sisi posisi', kini('POS-1').textContent === '4123.69' && kini('POS-2').textContent === '4123.79', [kini('POS-1').textContent, kini('POS-2').textContent]);
    cek('total mengambang panel = jumlah keduanya', s.el('ptFloating').textContent === '+$499.00', s.el('ptFloating').textContent);

    s.harga('XAUUSD', { price: '4123.74', bid: '4123.69', ask: '4123.79' }, 90);   // 90 detik tanpa pembaruan
    s.jalankan('ptRender()');
    cek('harga basi (> 60 dtk) → P/L "—", bukan +$0.00', pnl('POS-1').innerHTML === '—' && /tidak diperbarui 90 detik/.test(pnl('POS-1').title), [pnl('POS-1').innerHTML, pnl('POS-1').title]);
    cek('harga basi → total "—"', s.el('ptFloating').textContent === '—');
    s.jalankan('qtSaldo(); qtRenderPosisi()');
    cek('Quick Trade: mengambang "—" saat harga basi', s.el('qtFloat').textContent === '—', s.el('qtFloat').textContent);
    cek('Quick Trade: P/L baris "—"', s.el('qtPosisi').querySelector('[data-qt-pnl="POS-1"]').textContent === '—');

    s.harga('XAUUSD', { price: '4123.74', source: 'frankfurter' });
    s.jalankan('ptRender()');
    cek('kurs referensi harian (Frankfurter) → "—" dengan alasannya', pnl('POS-1').innerHTML === '—' && /kurs referensi harian/.test(pnl('POS-1').title));

    const c = await dimuat([POS('POS-1'), POS('POS-3', { symbol: 'US30', entryPrice: 42000, lots: 1 })]);
    c.jalankan('ptRender(); qtSaldo()');
    cek('sebagian posisi tanpa harga → total "(sebagian)" dari posisi berharga saja', c.el('ptFloating').textContent === '+$236.90 (sebagian)' && c.el('qtFloat').textContent === '+$236.90 (sebagian)', [c.el('ptFloating').textContent, c.el('qtFloat').textContent]);
    cek('alasan "(sebagian)" dijelaskan', /1 posisi belum punya harga live/.test(c.el('qtFloat').title));
  }

  // ── 4. Kartu Simulation Balance: state bersama ────────────────────────────
  console.log('\nKartu Simulation Balance memakai state yang sama');
  {
    const QD = baca('assets/js/qim-dashboard.js');
    cek('qim-dashboard.js tidak lagi GET api/paper-trading.php sendiri', !/fetch\(\s*['"`]api\/paper-trading\.php/.test(QD));
    cek('qim-dashboard.js tidak lagi memanggil ptPnlMult tanpa harga', !/ptPnlMult\(String\(item\.symbol\)\.toUpperCase\(\)\)/.test(QD));
    cek("kartu mendengarkan 'qi-paper-state'", /window\.addEventListener\('qi-paper-state'/.test(QD));

    const s = await dimuat([POS('POS-1', { symbol: 'USDCHF', entryPrice: 0.9, lots: 1 })], { riwayat: [{ id: 'POS-0', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4000, closePrice: 4010, realizedPnL: 100, closedAt: '2026-10-21T10:00:00Z', closeReason: 'manual' }] });
    s.server.saldo = 10100;
    s.harga('USDCHF', { price: '0.9101', bid: '0.9100', ask: '0.9102' });
    await s.ctx.ptLoadFromServer();
    for (const nama of ['signedUsd', 'setSimulation', 'refreshSimulation']) s.jalankan(ambilFungsi(nama, QD));
    const getAwal = s.server.get;
    s.jalankan('refreshSimulation()');
    // USDCHF BUY 1 lot 0.9000 → bid 0.9100: 0.01 × 1 × 100000/0.91 = 1098.90 (dulu pengali 1000 → $10).
    cek('Open P&L USDCHF memakai pengali dengan harga (100000/harga) di bid', s.el('qimSimOpen').textContent === '+$1,098.90', s.el('qimSimOpen').textContent);
    cek('ekuitas = saldo server + mengambang', s.el('qimSimEquity').textContent === '$11,198.90', s.el('qimSimEquity').textContent);
    cek('saldo awal = saldo − realisasi', s.el('qimSimInitial').textContent === '$10,000.00', s.el('qimSimInitial').textContent);
    cek('kartu tidak melakukan GET kedua', s.server.get === getAwal);
    s.harga('USDCHF', { price: '0.9101', bid: '0.9100', ask: '0.9102' }, 120);
    s.jalankan('refreshSimulation()');
    cek('harga basi → "Harga belum tersedia", catatan menyebut posisi yang tidak dihitung', s.el('qimSimOpen').textContent === 'Harga belum tersedia' && /1 posisi tanpa harga live tidak dihitung/.test(s.el('qimSimNote').textContent), [s.el('qimSimOpen').textContent, s.el('qimSimNote').textContent]);

    const f = sandbox({ tingkat: 0 });
    for (const nama of ['signedUsd', 'setSimulation', 'refreshSimulation']) f.jalankan(ambilFungsi(nama, QD));
    f.jalankan('refreshSimulation()');
    cek('paket FREE → kartu menyebut paket PRO, tanpa angka', /PRO/.test(f.el('qimSimNote').textContent) && f.el('qimSimEquity').textContent === '—');
    const b = sandbox();
    for (const nama of ['signedUsd', 'setSimulation', 'refreshSimulation']) b.jalankan(ambilFungsi(nama, QD));
    b.jalankan('refreshSimulation()');
    cek('belum dimuat → "Memuat…", bukan saldo karangan', /Memuat/.test(b.el('qimSimNote').textContent) && b.el('qimSimEquity').textContent === '—');
  }

  // ── 5. Klik ganda ─────────────────────────────────────────────────────────
  console.log('\nKlik ganda tidak membuka dua posisi');
  {
    const s = await dimuat();
    let lepas;
    s.server.tahan = new Promise((r) => { lepas = r; });
    s.klik(s.tombol('qtOrder', '["BUY"]', { disabled: s.el('qtBuy').disabled }));
    await s.tunggu();
    cek('selama order dikirim: BUY, SELL, dan Buka Posisi nonaktif', s.el('qtBuy').disabled && s.el('qtSell').disabled && s.el('ptOpenBtn').disabled);
    cek('… dan ditandai aria-busy', s.el('qtBuy').getAttribute('aria-busy') === 'true');
    s.klik(s.tombol('qtOrder', '["BUY"]', { disabled: s.el('qtBuy').disabled }));
    s.klik(s.tombol('qtOrder', '["SELL"]', { disabled: s.el('qtSell').disabled }));
    s.ctx.ptOpenDirectPosition('XAUUSD', 'BUY', null, null, null, 0.05, 'sinyal');
    await s.tunggu();
    cek('jalur lain (Trade Paper) ditolak dengan pesan selama order berjalan', s.jejak.toast.some((t) => /masih diproses/.test(t.pesan)));
    s.server.tahan = null;
    lepas();
    await s.tunggu(80);
    cek('hanya SATU order yang sampai ke server', buka(s).length === 1, buka(s).length);
    cek('tombol aktif lagi setelah jawaban server', !s.el('qtBuy').disabled && !s.el('qtSell').disabled && !s.el('ptOpenBtn').disabled);
  }

  // ── 6. Kirim ulang aman (client_order_id) ─────────────────────────────────
  console.log('\nJaringan putus: kirim ulang dengan client_order_id yang sama');
  {
    const s = await dimuat();
    s.server.putusSetelahProses = 1;   // order SUDAH tercatat, jawabannya hilang
    await s.ctx.ptOpenDirectPosition('XAUUSD', 'BUY', 4123.79, null, null, 0.1, 'quick');
    await s.tunggu();
    const b = buka(s);
    cek('dikirim ulang sekali', b.length === 2, b.length);
    cek('kirim ulang memakai client_order_id yang sama', b.length === 2 && b[0].client_order_id === b[1].client_order_id);
    cek('server tidak membuka posisi kedua', s.server.posisi.length === 1 && s.jalankan('_ptPositions.length') === 1);
    cek('pengguna mendapat konfirmasi posisi dibuka', s.jejak.toast.some((t) => t.jenis === 'success' && /dibuka/.test(t.pesan)));

    const t = await dimuat();
    t.server.putusSebelumProses = 2;
    const getAwal = t.server.get;
    await t.ctx.ptOpenDirectPosition('XAUUSD', 'BUY', 4123.79, null, null, 0.1, 'quick');
    await t.tunggu();
    cek('dua kali gagal → status dikatakan belum pasti (bukan "TIDAK dikirim")', t.jejak.toast.some((x) => /status order belum pasti/.test(x.pesan)), t.jejak.toast);
    cek('… dan daftar posisi dimuat ulang untuk memastikan', t.server.get > getAwal);

    const u = await dimuat([], { tanpaUuid: true });
    await u.ctx.ptOpenDirectPosition('XAUUSD', 'SELL', null, null, null, 0.1, 'sinyal');
    const id = (buka(u)[0] || {}).client_order_id || '';
    cek('tanpa crypto.randomUUID: id cadangan tetap ada & ≤ 40 karakter', /^qi-/.test(id) && id.length <= 40, id);
  }

  // ── 7. Penolakan server ───────────────────────────────────────────────────
  console.log('\nPenolakan server ditampilkan apa adanya');
  {
    const s = await dimuat();
    s.server.tolakBerikut = { status: 409, body: { status: 'ditolak', message: 'Pasar XAUUSD sedang tutup. Order dibuka kembali saat pasar buka.', kode: 'pasar_tutup' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    const t = s.toastTerakhir();
    cek("kode 'pasar_tutup' → pesan server, nada info", t && /sedang tutup/.test(t.pesan) && t.jenis === 'info', t);
    cek('alasan tetap tertulis di kartu Quick Trade', /^Order ditolak: Pasar XAUUSD sedang tutup/.test(s.el('qtInfo').textContent) && s.el('qtInfo').classList.contains('is-tolak'), s.el('qtInfo').textContent);
    s.jalankan('QT.pesan.sampai = Date.now() - 1; qtHitung()');
    cek('… lalu kembali ke perkiraan biasa setelah 15 detik', !/Order ditolak/.test(s.el('qtInfo').textContent) && !s.el('qtInfo').classList.contains('is-tolak'));

    s.server.tolakBerikut = { status: 422, body: { status: 'ditolak', message: 'Margin bebas tidak mencukupi untuk 5 lot.', kode: 'margin' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek("kode 'margin' → pesan server + petunjuk mengurangi lot", /Margin bebas tidak mencukupi untuk 5 lot\./.test(s.toastTerakhir().pesan), s.toastTerakhir());

    s.server.tolakBerikut = { status: 422, body: { status: 'ditolak', message: 'Batas rugi harian tercapai.', kode: 'batas_rugi_harian' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('batas rugi harian → nada galat', s.toastTerakhir().jenis === 'error');

    const minta = s.server.hargaDiminta.length;
    s.server.tolakBerikut = { status: 409, body: { status: 'ditolak', message: 'Harga bergerak: layar Anda 4123.79, pasar 4150. Order tidak dieksekusi (requote).', kode: 'requote' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(80);
    cek("kode 'requote' → harga terbaru diambil ulang", s.server.hargaDiminta.length >= minta + 2, s.server.hargaDiminta.length - minta);

    s.server.tolakBerikut = { status: 410, body: { status: 'error', message: 'Versi halaman ini sudah lama — muat ulang halaman (Ctrl+F5).' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu();
    cek('410 → minta muat ulang halaman, nada galat', /muat ulang halaman/.test(s.toastTerakhir().pesan) && s.toastTerakhir().jenis === 'error');
    cek('tidak ada posisi yang tercatat dari order yang ditolak', s.server.posisi.length === 0 && s.jalankan('_ptPositions.length') === 0);
  }

  // ── 8. Daftar posisi: dibangun ulang hanya bila id berubah ────────────────
  console.log('\nDaftar posisi dibangun ulang hanya bila id berubah');
  {
    const s = await dimuat([POS('POS-1')]);
    s.jalankan('ptRender(); qtSegarkan()');
    const tulisQt = s.el('qtPosisi').tulisHtml, tulisPt = s.el('ptPositionsBody').tulisHtml;
    s.harga('XAUUSD', { price: '4133.74', bid: '4133.69', ask: '4133.79' });
    s.jalankan('ptRender(); qtSegarkan(); qtSegarkan()');
    cek('harga berubah → innerHTML Quick Trade TIDAK ditulis ulang', s.el('qtPosisi').tulisHtml === tulisQt, [tulisQt, s.el('qtPosisi').tulisHtml]);
    cek('harga berubah → tabel panel TIDAK ditulis ulang', s.el('ptPositionsBody').tulisHtml === tulisPt);
    cek('… tetapi P/L-nya diperbarui di tempat', s.el('qtPosisi').querySelector('[data-qt-pnl="POS-1"]').textContent === '+$336.90', s.el('qtPosisi').querySelector('[data-qt-pnl="POS-1"]').textContent);
    s.server.posisi.push(POS('POS-2', { side: 'SELL', entryPrice: 4140 }));
    await s.ctx.ptLoadFromServer();
    cek('posisi baru → daftar dibangun ulang', s.el('qtPosisi').tulisHtml === tulisQt + 1 && /data-tutup-id="POS-2"/.test(s.el('qtPosisi').innerHTML));
  }

  // ── 9. Tutup: status "Menutup…" ───────────────────────────────────────────
  console.log('\nTutup: tombol menunggu, hasil diumumkan setelah server menjawab');
  {
    const s = await dimuat([POS('POS-1')]);
    s.jalankan('ptRender()');
    let lepas;
    s.server.tahan = new Promise((r) => { lepas = r; });
    const janji = s.ctx.ptClosePosition('POS-1');
    await s.tunggu();
    const bQt = s.el('qtPosisi').querySelector('[data-tutup-id="POS-1"]');
    const bPt = s.el('ptPositionsBody').querySelector('[data-tutup-id="POS-1"]');
    cek('selama menutup: tombol Quick Trade nonaktif & "Menutup…"', bQt.disabled && bQt.textContent === 'Menutup…');
    cek('selama menutup: tombol tabel panel juga', bPt.disabled && bPt.textContent === 'Menutup…');
    s.ctx.ptClosePosition('POS-1');
    s.server.tahan = null;
    lepas();
    await janji;
    await s.tunggu();
    cek('klik ganda Tutup → satu permintaan', s.server.post.filter((b) => b.aksi === 'tutup').length === 1);
    const t = s.jejak.toast.find((x) => /ditutup @/.test(x.pesan));
    cek('hasil diumumkan dengan harga & P/L server (BUY ditutup di bid)', t && /@ 4123\.69/.test(t.pesan) && /\+\$236\.90/.test(t.pesan), t);
    cek('posisi hilang dari daftar setelah dimuat ulang', !/POS-1/.test(s.el('qtPosisi').innerHTML));

    const g = await dimuat([POS('POS-1')]);
    g.server.tolakBerikut = { status: 409, body: { status: 'ditolak', message: 'Pasar XAUUSD sedang tutup.', kode: 'pasar_tutup' } };
    const hasil = await g.ctx.ptClosePosition('POS-1');
    await g.tunggu();
    const b = g.el('qtPosisi').querySelector('[data-tutup-id="POS-1"]');
    cek('gagal → null, tombol kembali "Tutup" dan aktif', hasil === null && b && !b.disabled && b.textContent === 'Tutup', b && [b.disabled, b.textContent]);
    const a = await dimuat([POS('POS-9', { src: 'auto' })]);
    const r = await a.ctx.ptClosePosition('POS-9');
    cek('posisi AUTO tidak ditutup dari klien', r === null && a.server.post.length === 0);
  }

  // ── 10. Penutupan oleh server ─────────────────────────────────────────────
  console.log('\nPenutupan oleh server (closeReason) diumumkan sekali');
  {
    const lama = { id: 'POS-50', symbol: 'XAUUSD', side: 'BUY', lots: 0.1, entryPrice: 4000, closePrice: 4100, realizedPnL: 1000, closedAt: '2026-10-20T10:00:00Z', closeReason: 'tp' };
    const s = await dimuat([POS('POS-60', { sl: 4050 }), POS('POS-61'), POS('POS-62')], { riwayat: [lama] });
    cek('muat pertama tidak mengumumkan riwayat lama', !s.jejak.toast.some((t) => /ditutup server/.test(t.pesan)), s.jejak.toast);
    const tutup = (id, sebab, harga, pnl) => {
      const i = s.server.posisi.findIndex((p) => p.id === id);
      const p = s.server.posisi.splice(i, 1)[0];
      s.server.riwayat.unshift(Object.assign({}, p, { closePrice: harga, realizedPnL: pnl, closedAt: '2026-10-22T11:00:00Z', closeReason: sebab }));
    };
    tutup('POS-60', 'sl', 4050, -500);
    tutup('POS-61', 'manual', 4110, 100);
    await s.ctx.ptLoadFromServer();
    const t = s.jejak.toast.filter((x) => /ditutup server/.test(x.pesan));
    cek("closeReason 'sl' → \"Stop loss tersentuh … ditutup server @ 4050\"", t.length === 1 && /^Stop loss tersentuh — BUY XAUUSD 0\.10 lot ditutup server @ 4050 · -\$500\.00/.test(t[0].pesan), t);
    cek("closeReason 'manual' tidak diumumkan ulang", !s.jejak.toast.some((x) => /4110/.test(x.pesan)));
    await s.ctx.ptLoadFromServer();
    cek('muat berikutnya tidak mengulang pengumuman', s.jejak.toast.filter((x) => /ditutup server/.test(x.pesan)).length === 1);
    s.jalankan('ptRender()');
    cek('riwayat menandai sebab penutupan server (SL)', /title="Stop loss tersentuh — ditutup server">SL</.test(s.el('ptHistoryBody').innerHTML));
    tutup('POS-62', 'tp', 4200, 1000);
    await s.ctx.ptLoadFromServer();
    cek("closeReason 'tp' → nada sukses", s.toastTerakhir().jenis === 'success' && /^Take profit tersentuh/.test(s.toastTerakhir().pesan));

    const banyak = await dimuat(['A', 'B', 'C', 'D'].map((x) => POS('POS-' + x)));
    for (const x of ['A', 'B', 'C', 'D']) {
      const p = banyak.server.posisi.shift();
      banyak.server.riwayat.unshift(Object.assign({}, p, { closePrice: 4100, realizedPnL: -10, closedAt: '2026-10-22T11:00:00Z', closeReason: 'period_end' }));
    }
    await banyak.ctx.ptLoadFromServer();
    const ringkas = banyak.jejak.toast.filter((x) => /ditutup server/.test(x.pesan));
    cek('> 3 penutupan sekaligus → satu ringkasan, bukan banjir toast', ringkas.length === 1 && /^4 posisi ditutup server/.test(ringkas[0].pesan) && /-\$40\.00/.test(ringkas[0].pesan), ringkas);
  }

  // ── 11. Trade Paper & Eksekusi Setup AI ───────────────────────────────────
  console.log('\n"⚡ Trade Paper" & "Eksekusi Setup AI": order pasar, asal sinyal');
  {
    const PRO = baca('assets/js/dashboard-pro.js');
    const PTT = baca('assets/js/pro-trading-tools.js');
    cek("tombol Trade Paper: entry null (harga sisi saat ini) dan asal 'sinyal'", /data-qi-aksi="ptOpenDirectPosition" data-qi-arg="' \+ QIAksi\.arg\(String\(x\.simbol\), String\(x\.arah\), null, Number\(x\.sl\), Number\(x\.tp\), 0\.05, 'sinyal'\)/.test(PRO));
    cek("Eksekusi Setup AI: entry null dan asal 'sinyal'", /window\.ptOpenDirectPosition\(sym, side, null, sl, tp, lots, 'sinyal'\)/.test(PTT));

    const s = await dimuat();
    s.klik(s.tombol('ptOpenDirectPosition', JSON.stringify(['XAUUSD', 'SELL', null, 4160, 4080, 0.05, 'sinyal'])));
    await s.tunggu(80);
    const b = buka(s)[0] || {};
    cek('klik Trade Paper → harga = bid saat ini (bukan entry setup)', b.side === 'SELL' && b.harga === 4123.69 && b.asal === 'sinyal' && b.lots === 0.05, b);
    cek('SL/TP setup diteruskan', b.sl === 4160 && b.tp === 4080, b);

    const t = await dimuat();
    t.klik(t.tombol('ptOpenDirectPosition', JSON.stringify(['XAUUSD', 'BUY', null, 4130, 4200, 0.05, 'sinyal'])));
    await t.tunggu(80);
    cek('SL setup sudah terlewati harga → tidak dikirim, alasannya disebut', buka(t).length === 0 && t.jejak.toast.some((x) => /stop loss harus di BAWAH/.test(x.pesan)), t.jejak.toast);

    const u = await dimuat();
    await u.ctx.ptOpenDirectPosition('GBPJPY', 'BUY', null, null, null, 0.1, 'sinyal');
    cek('simbol yang tidak didukung server → ditolak dengan daftar simbol', buka(u).length === 0 && u.jejak.toast.some((x) => /GBPJPY belum didukung/.test(x.pesan)));
    await u.ctx.ptOpenDirectPosition('XAUUSD', 'BUY', null, null, null, 0, 'sinyal');
    cek('lot 0 → ditolak dengan pesan', buka(u).length === 0 && u.jejak.toast.some((x) => /Lot harus 0,01/.test(x.pesan)));
  }

  // ── 12. Tombol "↺ Update P&L" ─────────────────────────────────────────────
  console.log('\nTombol "↺ Update P&L" benar-benar memuat ulang');
  {
    const s = await dimuat();
    const getAwal = s.server.get;
    await s.ctx.ptRefreshPnL();
    cek('GET posisi dijalankan', s.server.get === getAwal + 1);
  }

  // ── 13. Feed kanonik (audit trading 2026-10-22) ───────────────────────────
  console.log('\nPosisi paper dinilai di feed yang MENGISI & menyelesaikan order (kanonik)');
  {
    const s = await dimuat([POS('POS-1', { entryPrice: 4133.132, lots: 1 }), POS('POS-2', { symbol: 'USOIL', entryPrice: 70, lots: 1 })]);
    const diminta = s.server.kanonikDiminta.flat();
    cek('halaman dibuka → kutipan kanonik diminta untuk simbol posisi & chart', diminta.includes('XAUUSD') && diminta.includes('USOIL'), s.server.kanonikDiminta);
    cek('USOIL (di luar QI_KOMP_SIMBOL) ditandai tidak dilayani; XAUUSD dilayani', s.jalankan('_ptKanonik.USOIL') === false && s.jalankan('_ptKanonik.XAUUSD') === true);
    // Feed tampilan dan kanonik berbeda (terukur): P/L harus mengikuti kanonik = penanda server.
    s.hargaLive('XAUUSD', { price: '4130.897', source: 'binance_paxg_selaras' });
    s.hargaKanonik('XAUUSD', { price: 4133.127, bid: 4133.122, ask: 4133.132, source: 'binance_paxg_selaras' });
    s.harga('USOIL', { price: '71', bid: '70.99', ask: '71.01' });
    s.jalankan('ptRender()');
    const pnl = (id) => s.el('ptPositionsBody').querySelector(`[data-pt-pnl="${id}"]`);
    const kini = (id) => s.el('ptPositionsBody').querySelector(`[data-pt-kini="${id}"]`);
    cek('BUY XAUUSD dinilai di bid KANONIK 4133.12 (P/L −$1.00), bukan live-price 4130.90 (−$223.50)', /^-\$1\.00/.test(pnl('POS-1').innerHTML) && kini('POS-1').textContent === '4133.12', [pnl('POS-1').innerHTML, kini('POS-1').textContent]);
    cek('USOIL dinilai dari feed tampilan dan DITANDAI demikian', /^\+\$/.test(pnl('POS-2').innerHTML) && /Feed tampilan/.test(pnl('POS-2').title), [pnl('POS-2').innerHTML, pnl('POS-2').title]);
    // Kanonik basi sementara live-price segar: TIDAK diganti angka feed lain.
    s.hargaKanonik('XAUUSD', { price: 4133.127, bid: 4133.122, ask: 4133.132 }, 90);
    s.jalankan('ptRender()');
    cek('kutipan kanonik basi → "—" dengan alasannya, walau live-price segar', pnl('POS-1').innerHTML === '—' && /Harga server \(feed eksekusi\) XAUUSD tidak diperbarui 90 detik/.test(pnl('POS-1').title), [pnl('POS-1').innerHTML, pnl('POS-1').title]);
    cek('window.ptHargaNilai (pengaman SL/TP) mengikuti aturan yang sama', s.ctx.ptHargaNilai('XAUUSD', false) === null);
  }
  {
    // Muat berkala: tiap 10 detik, hanya simbol yang dilayani, tidak untuk FREE.
    const s = await dimuat([POS('POS-1')]);
    const n0 = s.server.kanonikDiminta.length;
    s.detak();
    await s.tunggu();
    cek('detak < 10 detik sejak muat terakhir → tidak meminta lagi', s.server.kanonikDiminta.length === n0);
    s.jalankan('_ptKutipanDicoba = Date.now() - 11000');
    s.detak();
    await s.tunggu();
    cek('≥ 10 detik → diminta lagi', s.server.kanonikDiminta.length === n0 + 1, s.server.kanonikDiminta.length - n0);
    s.ctx.document.visibilityState = 'hidden';
    s.jalankan('_ptKutipanDicoba = 0');
    s.detak();
    await s.tunggu();
    cek('tab tersembunyi → tidak meminta', s.server.kanonikDiminta.length === n0 + 1);
    const f = sandbox({ tingkat: 0 });
    f.picu('load');
    await f.tunggu();
    f.jalankan('_ptKutipanDicoba = 0');
    f.detak();
    await f.tunggu();
    cek('paket FREE → endpoint kanonik (PRO) tidak dipanggil', f.server.kanonikDiminta.length === 0);
  }
  {
    // Penutupan memakai harga kanonik sebagai batas requote.
    const s = await dimuat([POS('POS-1')]);
    s.hargaKanonik('XAUUSD', { price: 4133.127, bid: 4133.122, ask: 4133.132 });
    s.hargaLive('XAUUSD', { price: '4130.897' });
    await s.ctx.ptClosePosition('POS-1');
    const t = s.server.post.find((b) => b.aksi === 'tutup') || {};
    cek('Tutup: batas requote = bid kanonik (harga yang benar-benar dipakai server)', t.harga === 4133.122, t);
  }

  // ── 14. Hasil yang tidak pasti ────────────────────────────────────────────
  console.log('\nJawaban server yang tidak memastikan apa pun bukan "ditolak"');
  {
    // Order SUDAH tersimpan, lalu gateway menjawab 504 berisi HTML.
    const s = await dimuat();
    s.server.galatSetelahProses = { status: 504 };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(80);
    cek('504 → "status order belum pasti", bukan "ditolak"', s.jejak.toast.some((t) => /HTTP 504/.test(t.pesan) && /status order belum pasti/.test(t.pesan)) && !s.jejak.toast.some((t) => /menolak order/.test(t.pesan)), s.jejak.toast);
    cek('kartu Quick Trade tidak menulis "Order ditolak"', !/Order ditolak/.test(s.el('qtInfo').textContent), s.el('qtInfo').textContent);
    cek('daftar dimuat ulang: posisi yang ternyata dibuka tampil', s.jalankan('_ptPositions.length') === 1);
    cek('… dan dikatakan "ternyata sudah dibuka"', s.jejak.toast.some((t) => /Ternyata posisi sudah dibuka server: BUY XAUUSD/.test(t.pesan)), s.jejak.toast);
  }
  {
    // Kiriman pertama diproses tetapi jawabannya hilang; kiriman ULANG kena 429 "masih diproses".
    const s = await dimuat();
    s.server.putusSetelahProses = 1;
    s.server.tolakPostKe[2] = { status: 429, body: { status: 'ditolak', message: 'Order sebelumnya masih diproses. Tunggu sebentar.', kode: 'terlalu_cepat' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(900);
    cek('429 pada kiriman ULANG → "belum pasti", bukan "ditolak"', s.jejak.toast.some((t) => /status order belum pasti/.test(t.pesan)) && !/Order ditolak/.test(s.el('qtInfo').textContent), [s.jejak.toast, s.el('qtInfo').textContent]);
    cek('posisi dari kiriman pertama tampil setelah dimuat ulang', s.jalankan('_ptPositions.length') === 1);
  }
  {
    // 429 pada kiriman PERTAMA = penolakan sungguhan (batas order) → tetap "ditolak".
    const s = await dimuat();
    s.server.tolakBerikut = { status: 429, body: { status: 'ditolak', message: 'Terlalu cepat — beri jeda 1 detik antar order.', kode: 'terlalu_cepat' } };
    s.ctx.qtOrder(null, null, 'BUY');
    await s.tunggu(60);
    cek('429 pada kiriman pertama → pesan server sebagai penolakan', /^Order ditolak: Terlalu cepat/.test(s.el('qtInfo').textContent), s.el('qtInfo').textContent);
  }

  // ── 15. Tutup sukses, muat ulang gagal ────────────────────────────────────
  console.log('\nTutup sukses + muat ulang gagal: state mengikuti jawaban server');
  {
    const s = await dimuat([POS('POS-9', { lots: 1 })]);
    s.server.getGagal = true;   // mis. 429 dari batas 60/menit per IP
    const hasil = await s.ctx.ptClosePosition('POS-9');
    await s.tunggu();
    const r = s.ctx.qiPaperRingkasan();
    cek('penutupan sukses (+$2,369.00) walau GET sesudahnya gagal', hasil && hasil.ditutup && r.gagal === true, r.gagal);
    cek('saldo = jawaban server 12369', r.saldo === 12369, r.saldo);
    cek('posisi yang ditutup TIDAK lagi terdaftar', !r.posisi.some((p) => p.id === 'POS-9'), r.posisi);
    cek('… dan masuk riwayat (dari jawaban server)', r.riwayat[0] && r.riwayat[0].id === 'POS-9' && r.riwayat[0].pnl === 2369, r.riwayat[0]);
    cek('Quick Trade: tidak ada tombol Tutup untuk POS-9', !/POS-9/.test(s.el('qtPosisi').innerHTML), s.el('qtPosisi').innerHTML);
    const QD = baca('assets/js/qim-dashboard.js');
    for (const nama of ['signedUsd', 'setSimulation', 'refreshSimulation']) s.jalankan(ambilFungsi(nama, QD));
    s.jalankan('refreshSimulation()');
    cek('kartu Simulation: ekuitas $12,369.00 (P/L tidak dihitung dua kali)', s.el('qimSimEquity').textContent === '$12,369.00', s.el('qimSimEquity').textContent);
  }
  {
    const s = await dimuat();
    s.server.getGagal = true;
    await s.ctx.ptOpenDirectPosition('XAUUSD', 'BUY', null, null, null, 0.1, 'sinyal');
    cek('buka sukses + GET gagal → posisi dari jawaban server tetap tampil', s.jalankan('_ptPositions.length') === 1);
  }

  // ── 16. Posisi yang sudah ditutup server: satu kabar, bukan dua ───────────
  console.log('\nTutup pada posisi yang SL-nya sudah diselesaikan server: satu toast');
  {
    const s = await dimuat([POS('POS-1', { sl: 4110 })]);
    // Pasar turun ke bawah SL; server menyelesaikan SL di awal POST 'tutup' → 409 "sudah ditutup".
    s.server.harga.XAUUSD = { price: '4105.05', bid: '4105', ask: '4105.1' };
    const awal = s.jejak.toast.length;
    const hasil = await s.ctx.ptClosePosition('POS-1');
    await s.tunggu();
    const baru = s.jejak.toast.slice(awal);
    cek('hasil null (bukan ditutup oleh klik ini)', hasil === null);
    cek('TIDAK ada toast bergaya penolakan "sudah ditutup oleh server"', !baru.some((t) => /sudah ditutup/.test(t.pesan)), baru);
    cek('tepat SATU kabar: "Stop loss tersentuh … ditutup server @ 4105"', baru.filter((t) => /Stop loss tersentuh — BUY XAUUSD 0\.10 lot ditutup server @ 4105/.test(t.pesan)).length === 1 && baru.length === 1, baru);
  }
  {
    // Ditutup manual di tab lain: satu kabar info, tidak bergaya penolakan.
    const s = await dimuat([POS('POS-1')]);
    const p = s.server.posisi.shift();
    s.server.riwayat.unshift(Object.assign({}, p, { closePrice: 4120, realizedPnL: 200, closedAt: '2026-10-22T10:03:00Z', closeReason: 'manual' }));
    const awal = s.jejak.toast.length;
    await s.ctx.ptClosePosition('POS-1');
    await s.tunggu();
    const baru = s.jejak.toast.slice(awal);
    cek('ditutup di tab lain → satu toast info "sudah ditutup sebelumnya @ 4120"', baru.length === 1 && baru[0].jenis === 'info' && /sudah ditutup sebelumnya @ 4120/.test(baru[0].pesan), baru);
  }
  {
    // 409 BER-KODE (harga ditolak) tetap penolakan biasa.
    const s = await dimuat([POS('POS-1')]);
    s.server.tolakBerikut = { status: 409, body: { status: 'ditolak', message: 'Feed harga XAUUSD sedang macet.', kode: 'harga_basi' } };
    await s.ctx.ptClosePosition('POS-1');
    cek('409 ber-kode → pesan penolakan server tampil', s.jejak.toast.some((t) => /sedang macet/.test(t.pesan)));
  }

  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — paper trading dashboard: harga, muat, P/L penutupan, order aman, penolakan, Tutup, sebab server');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
