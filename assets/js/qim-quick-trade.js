/**
 * Jalur order Quantum Terminal — paper trading, Quick Trade, dan order ke akun
 * MetaTrader 5 yang sebenarnya.
 *
 * Dipisah dari assets/js/dashboard-app.js saat dashboard panel lama dihapus.
 * Isinya dipindah apa adanya (blok "Paper Trading" beserta fmt(), liveHeaders(),
 * loadLiveExecution(), dan liveAction()), supaya perilaku order TIDAK ikut
 * berubah dalam pembersihan ini — perubahan perilaku jalur order harus punya
 * commit-nya sendiri dan tesnya sendiri.
 *
 * Perilakunya diuji di tests/quick-trade.test.js, tests/order-manual-real.test.js,
 * dan tests/paper-dashboard.test.js lewat sandbox tests/paper-sandbox.js yang
 * menjalankan sumber berkas INI di dalam vm.
 *
 * Bergantung pada: assets/js/qim-aksi.js (delegasi klik tanpa onclick) dan
 * assets/js/qim-paper-math.js (model untung/rugi). Keduanya dimuat lebih dulu
 * di dashboard.html.
 */
'use strict';

// ─── Pembantu bersama ──────────────────────────────────────────────────────

// Tingkat paket pengguna — menentukan Quick Trade boleh order real atau tidak.
const QI_TINGKAT = { free: 0, pro: 1, vip: 2, admin: 3 };
function qiTingkatSaatIni() { return QI_TINGKAT[String(window.QI_PERAN || 'free').toLowerCase()] ?? 0; }

// ─── Market Data ───────────────────────────────────────────────────────────
let _lastPrices  = {};
let _lastSignals = {};
// Waktu (ms) data harga terakhir berhasil diambil — dipakai indikator kesegaran.
let _lastPricesAt = 0;
// Waktu (ms) harga TIAP simbol terakhir datang dari server. Terpisah dari _lastPrices karena modul
// lain (WebSocket Binance di perf-upgrades.js, REST 3 detik di dashboard-pro.js) mengganti objek
// harganya utuh — penanda waktu di dalam objek itu akan ikut hilang. Dipakai ptKutipanLive() (order
// REAL & simbol paper di luar feed kanonik): harga yang tidak diperbarui > 60 detik TIDAK dipakai ("—").
const _qiHargaWaktu = {};

/** Daftar simbol untuk satu permintaan live-price: tetap + chart + posisi paper terbuka + formulir paper. */
function qiSimbolDiminta(dasar) {
    let daftar = dasar.slice();
    const tambah = (s) => { s = String(s || '').toUpperCase(); if (/^[A-Z0-9]{2,12}$/.test(s) && !daftar.includes(s)) daftar.push(s); };
    // _ptPositions dideklarasikan `let` jauh di bawah; panggilan pertama fetchMarketData() terjadi saat
    // berkas ini masih dievaluasi (TDZ) — karena itu dibungkus try.
    try { (_ptPositions || []).forEach(p => p && tambah(p.symbol)); } catch (e) {}
    try { tambah(document.getElementById('ptSymbol')?.value); } catch (e) {}
    return daftar;
}

async function fetchMarketData() {
    try {
        // Simbol chart yang sedang dibuka ikut diminta: tanpa ini chart GBPJPY/EURJPY/indeks
        // tidak pernah mendapat harga live (hanya 14 simbol tetap yang diperbarui).
        let daftar = SYMBOLS;
        try {
            const kini = typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks().symbol : null;
            if (kini && !SYMBOLS.includes(kini)) daftar = SYMBOLS.concat(kini);
        } catch (e) {}
        // Simbol posisi paper yang masih terbuka + simbol formulir Paper Trading juga diminta.
        // Dulu harga US30/NAS100/XAGUSD/USOIL… hanya diambil untuk ptSymbol yang sedang dipilih dan
        // terhapus 15 detik kemudian: posisinya tampil "+$0.00" dan SL/TP-nya tidak pernah dicek.
        daftar = qiSimbolDiminta(daftar);
        // live-price.php memotong parameter symbols di 200 karakter (qi_sanitize_string) — simbol yang
        // terpotong di tengah akan hilang diam-diam, jadi daftar panjang dipecah jadi beberapa permintaan.
        const potongan = [];
        for (const s of daftar) {
            const akhir = potongan[potongan.length - 1];
            if (akhir && (akhir.join(',') + ',' + s).length <= 200) akhir.push(s); else potongan.push([s]);
        }
        // Header Authorization DISEBUT eksplisit, sama dengan ptSegarkanHarga: live-price memilih tingkat feed
        // (broker MT5 vs umum) dari pemanggilnya. qim-auth-fetch.js memang menambahkannya ke semua panggilan
        // live-price, tetapi bila lapisan itu tidak termuat, dua pemanggil tanpa/dengan token akan membuat
        // _lastPrices berganti feed tiap 15 detik (audit trading 2026-10-22).
        const kepala = (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders() : {};
        const hasil = await Promise.all(potongan.map(async (bag) => {
            const r = await fetch(`api/live-price.php?symbols=${bag.join(',')}`, { headers: kepala });
            if (!r.ok) return null;
            const j = await r.json();
            return j && j.status === 'success' ? (j.prices || {}) : null;
        }));
        if (!hasil[0]) return;
        const baru = Object.assign({}, ...hasil.filter(Boolean));
        // DIGABUNG, bukan diganti: harga yang diambil di antara dua siklus (ptSegarkanHarga sebelum order,
        // ptUpdateLivePrice) tidak lagi dihapus. Tiap simbol yang datang menggantikan objeknya UTUH —
        // bid/ask lama tidak boleh menempel pada harga baru dari sumber lain. Simbol yang tidak lagi
        // diminta dan tidak diperbarui > 5 menit dibuang supaya tidak tampil sebagai harga "live".
        const kiniMs = Date.now();
        for (const [sym, d] of Object.entries(baru)) {
            if (!d || !(parseFloat(d.price) > 0)) continue;
            _lastPrices[sym] = d;
            _qiHargaWaktu[sym] = kiniMs;
        }
        for (const sym of Object.keys(_lastPrices)) {
            if (!(sym in baru) && kiniMs - (_qiHargaWaktu[sym] || 0) > 300000) { delete _lastPrices[sym]; delete _qiHargaWaktu[sym]; }
        }
        _lastPricesAt = kiniMs;
        // Harga berubah → P/L mengambang di kartu Simulation ikut diperbarui.
        try { ptSiarkanState(); } catch (e) {}
        // Harga baru → kartu Quick Trade ikut menyegarkan tombol BUY/SELL. (Penggambar ticker, pita pasar, kartu statistik,
        // watchlist, ticker mengambang, dan price alert milik dashboard panel lama dibuang; sebelumnya pemanggilan
        // renderTicker() yang tak lagi ada melempar galat yang tertelan di sini sehingga tak ada yang diperbarui.)
        try { qtSegarkan(); } catch (e) {}
    } catch(e) {}
}

function fmt(sym, price) {
    const dp = DP[sym] ?? 2;
    return parseFloat(price).toFixed(dp);
}

function liveHeaders() { return window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' }; }
/**
 * Akun MT5 milik pengguna untuk jalur Real MT5. Dashboard tidak lagi punya pemilih akun (pengaturan broker
 * pindah ke profile.html → #brokerSection), jadi daftarnya disimpan di memori dan pilihan terakhir di
 * localStorage 'qi_live_akun' (diisi pemilih di Profil). Bawaan: akun aktif pertama, lalu akun pertama.
 */
let _akunLive = [];
async function loadLiveExecution() {
    try {
        const res = await fetch('api/live-trade.php', { headers: window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders() : {}, cache: 'no-store' });
        const data = await res.json(); if (!res.ok || data.status !== 'success') throw new Error('LOAD_FAILED');
        _akunLive = Array.isArray(data.accounts) ? data.accounts : [];
    } catch (error) { _akunLive = []; }
    return _akunLive;
}

async function liveAction(payload) {
    const terpilih = ptAkunRealTerpilih();
    const accountId = terpilih ? terpilih.id : NaN;
    if (!Number.isInteger(accountId) || accountId < 1) { showQuantumToast('Hubungkan akun MT5 di Profil → Broker MT5 lebih dulu.', 'warning'); return null; }
    const res = await fetch('api/live-trade.php', { method: 'POST', headers: liveHeaders(), body: JSON.stringify({ ...payload, account_id: accountId }) });
    const data = await res.json(); if (!res.ok || data.status !== 'success') throw new Error(data.message || 'LIVE_ACTION_FAILED'); return data;
}

// ─── Paper Trading ─────────────────────────────────────────────────────────
// Multiplier: berapa USD per unit per lot (supaya P&L masuk akal)
// Model P/L tunggal: assets/js/qim-paper-math.js (kembaran api/_paper_math.php). Isi lama di
// bawah hanya cadangan bila berkas itu tidak termuat.
function ptPnlMult(sym, price) {
    if (typeof window.qimPaperMult === 'function') return window.qimPaperMult(sym, price);
    const isCrypto = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT'].includes(sym);
    if (isCrypto) return 1;          // 0.1 lots BTC, harga naik $100 → +$10
    if (sym === 'XAUUSD') return 100; // 1 lot XAU = 100 oz
    if (sym.includes('JPY')) return 1000; // pip JPY lebih kecil
    return 10000; // forex majors: 0.01 lot EURUSD, +10 pip (+0.001) → $10*0.01 = $0.10... scale ke 10k
}
// _ptBalance = 10000 hanya nilai awal untuk modul yang membacanya (qim-risk.js): BUKAN saldo pengguna.
// Selama _ptDimuatPada masih 0 (state belum pernah berhasil dimuat dari server) saldo ditampilkan "—".
let _ptBalance   = 10000;
let _ptPositions = []; // {id, symbol, side, lots, entryPrice, sl, tp, openTime, src, kompPeriode}
let _ptHistory   = [];
let _ptRealized  = 0;
let _ptDimuatPada = 0;

/** Umur maksimum harga untuk menilai posisi (ms). fetchMarketData berjalan tiap 15 detik. */
const PT_UMUR_HARGA_MAKS = 60000;

// ── Dua feed harga, dua kegunaan ─────────────────────────────────────────────────────────────
// · Feed KANONIK (api/_kompetisi_harga.php, dibagikan lewat api/competition.php?harga=) adalah feed yang
//   MENGISI order paper buka/tutup dan menyelesaikan SL/TP di server (api/paper-trading.php →
//   qi_komp_acuan / qi_paper_settle). Posisi paper dan tombol BUY/SELL simulasi dinilai dari feed INI.
//   Dulu semuanya dinilai dari api/live-price.php — terukur lokal 2026-10-22 pada detik yang sama:
//   XAUUSD kanonik ask 4138.82 vs live-price 4136.996. Tombol BUY menampilkan satu angka, order terisi di
//   angka lain, P/L mengambang di layar berselisih ±$200/lot dari penanda server, dan pengaman SL/TP di
//   klien bisa "menyentuh" level yang tidak pernah disentuh feed server.
// · Feed TAMPILAN (api/live-price.php → _lastPrices): ticker, chart, dan order REAL MT5 (harga broker
//   bagi yang berhak). Untuk paper hanya dipakai bagi simbol yang TIDAK dilayani endpoint kanonik
//   (endpoint itu menolak simbol di luar QI_KOMP_SIMBOL) — dan ditandai sebagai feed tampilan.
// Simbol yang dilayani tetapi kutipan kanoniknya basi → "—" (bukan diganti angka dari feed lain).
/** SIM → { q: kutipan kanonik, diterima: ms }. */
const _ptKutipan = {};
/** SIM → true (dilayani feed kanonik) | false (tidak dilayani). Belum ada = belum diketahui (dinilai dari live-price). */
const _ptKanonik = {};
/** Waktu permintaan kutipan kanonik terakhir (ms) dan permintaan berkala yang sedang berjalan. */
let _ptKutipanDicoba = 0;
let _ptKutipanJalan = null;
/** Jarak muat kutipan kanonik berkala (ms). Endpoint mengambil ulang di server bila kutipannya > 3 detik. */
const PT_KUTIPAN_JEDA = 10000;

/** Kutipan feed tampilan (live-price) yang masih segar dan bisa ditransaksikan, atau null. */
function ptKutipanLive(sym) {
    const d = _lastPrices[sym];
    if (!d) return null;
    if (Date.now() - (_qiHargaWaktu[sym] || 0) > PT_UMUR_HARGA_MAKS) return null;
    if (/frankfurter/i.test(String(d.source || ''))) return null;
    return d;
}

/** Kutipan kanonik yang masih segar (umur di server + waktu sejak diterima ≤ 60 detik), atau null. */
function ptKutipanKanonik(sym) {
    const k = _ptKutipan[sym];
    if (!k || !k.q) return null;
    if (Number(k.q.umur || 0) * 1000 + (Date.now() - k.diterima) > PT_UMUR_HARGA_MAKS) return null;
    if (/frankfurter/i.test(String(k.q.source || ''))) return null;
    return k.q;
}

/** Kutipan untuk posisi & order PAPER: feed kanonik bila simbolnya dilayani, selain itu feed tampilan. */
function ptKutipanPaper(sym) {
    return _ptKanonik[sym] ? ptKutipanKanonik(sym) : ptKutipanLive(sym);
}
window.ptKutipanPaper = ptKutipanPaper;

/** true bila harga paper simbol ini datang dari feed tampilan, bukan feed yang mengisi order di server. */
function ptHargaIndikatif(sym) { return !_ptKanonik[sym]; }

/** Sisi kutipan: beli = ask, jual = bid; feed tanpa bid/ask → harga tengah untuk keduanya (spread tidak dikarang). */
function ptSisiKutipan(d, sisiBeli) {
    if (!d) return null;
    const v = parseFloat(sisiBeli ? (d.ask ?? d.price) : (d.bid ?? d.price));
    return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Harga untuk MENILAI posisi paper / memeriksa SL-TP: sisi beli = ask, sisi jual = bid. null bila harganya
 * tidak ada, basi (> 60 detik), atau hanya kurs referensi harian (Frankfurter) — P/L lalu ditampilkan "—",
 * bukan dihitung dari harga karangan. Dulu posisi tanpa harga tampil "+$0.00" (dinilai di harga masuknya).
 */
function ptHargaNilai(sym, sisiBeli) { return ptSisiKutipan(ptKutipanPaper(sym), sisiBeli); }
window.ptHargaNilai = ptHargaNilai;

/** Harga feed tampilan yang segar — untuk order REAL MT5 (broker yang mengeksekusi, bukan feed paper). */
function ptHargaLive(sym, sisiBeli) { return ptSisiKutipan(ptKutipanLive(sym), sisiBeli); }

/** Alasan singkat mengapa simbol ini tidak bisa dinilai (tooltip pada "—"). `live` = alasan feed tampilan. */
function ptAlasanTanpaHarga(sym, live) {
    if (!live && _ptKanonik[sym]) {
        const k = _ptKutipan[sym];
        if (!k || !k.q) return 'Harga server (feed eksekusi) ' + sym + ' belum tersedia';
        if (/frankfurter/i.test(String(k.q.source || ''))) return 'Harga ' + sym + ' saat ini hanya kurs referensi harian, bukan harga live';
        const umurK = Math.round(Number(k.q.umur || 0) + (Date.now() - k.diterima) / 1000);
        return 'Harga server (feed eksekusi) ' + sym + ' tidak diperbarui ' + (umurK > 3600 ? 'lebih dari satu jam' : umurK + ' detik');
    }
    const d = _lastPrices[sym];
    if (!d) return 'Harga live ' + sym + ' belum tersedia';
    if (/frankfurter/i.test(String(d.source || ''))) return 'Harga ' + sym + ' saat ini hanya kurs referensi harian, bukan harga live';
    const umur = Math.round((Date.now() - (_qiHargaWaktu[sym] || 0)) / 1000);
    return 'Harga ' + sym + ' tidak diperbarui ' + (umur > 3600 ? 'lebih dari satu jam' : umur + ' detik');
}

/** Keterangan untuk angka paper yang dinilai dari feed tampilan (simbol di luar cakupan feed kanonik). */
const PT_KET_INDIKATIF = 'Feed tampilan (live-price): simbol ini belum dilayani feed eksekusi server — harga isi/tutup bisa sedikit berbeda';

/** Simbol yang kutipan kanoniknya perlu dimuat: posisi terbuka, simbol chart (Quick Trade), formulir paper. */
function ptSimbolKutipan() {
    const daftar = [];
    const tambah = (s) => { s = String(s || '').toUpperCase(); if (/^[A-Z0-9]{3,12}$/.test(s) && !daftar.includes(s)) daftar.push(s); };
    (_ptPositions || []).forEach((p) => p && tambah(p.symbol));
    try { tambah(qiSimbolChart()); } catch (e) {}
    try { tambah(document.getElementById('ptSymbol')?.value); } catch (e) {}
    return daftar;
}

/**
 * Muat kutipan kanonik untuk `syms` dari api/competition.php?harga= (PRO ke atas, sama dengan paper trading).
 * Simbol yang tidak ada di jawaban (atau HTTP 400 "Simbol tidak dikenal") ditandai TIDAK dilayani; kutipan
 * null untuk simbol yang dilayani berarti server pun belum punya harga — kutipan lama tetap dan menua.
 * @return {Promise<boolean>} true bila setidaknya satu jawaban sah diterima.
 */
async function ptMuatKutipan(syms) {
    if (qiTingkatSaatIni() < 1) return false;
    const daftar = [...new Set((syms || []).map((s) => String(s || '').toUpperCase()).filter((s) => /^[A-Z0-9]{3,12}$/.test(s)))];
    if (!daftar.length) return false;
    _ptKutipanDicoba = Date.now();
    const kepala = (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders() : {};
    // Endpoint hanya melayani 12 simbol pertama per permintaan.
    const potongan = [];
    for (let i = 0; i < daftar.length; i += 12) potongan.push(daftar.slice(i, i + 12));
    const hasil = await Promise.all(potongan.map(async (bag) => {
        try {
            const r = await fetch('api/competition.php?harga=' + encodeURIComponent(bag.join(',')), { headers: kepala, cache: 'no-store' });
            if (r.status === 400) { bag.forEach((s) => { _ptKanonik[s] = false; }); return false; }
            if (!r.ok) return false;   // 401/403/429/5xx: kutipan lama tetap, umurnya bertambah dan terlihat
            const j = await r.json();
            if (!j || j.status !== 'success' || !j.kutipan || typeof j.kutipan !== 'object') return false;
            const kini = Date.now();
            for (const s of bag) {
                if (!Object.prototype.hasOwnProperty.call(j.kutipan, s)) { _ptKanonik[s] = false; continue; }
                _ptKanonik[s] = true;
                const q = j.kutipan[s];
                if (q && parseFloat(q.price) > 0) _ptKutipan[s] = { q, diterima: kini };
            }
            return true;
        } catch (e) { return false; }
    }));
    const ada = hasil.some(Boolean);
    if (ada) ptSiarkanState();
    return ada;
}

/** Muat kutipan kanonik berkala (tiap 10 detik) selama tab terlihat dan ada yang perlu dinilai. */
function ptMuatKutipanBerkala(paksa) {
    if (qiTingkatSaatIni() < 1 || _ptKutipanJalan) return null;
    if (!paksa) {
        if (document.visibilityState !== 'visible') return null;
        if (Date.now() - _ptKutipanDicoba < PT_KUTIPAN_JEDA) return null;
        const rail = document.getElementById('qimRightPanel');
        const railTampil = !(rail && typeof rail.getClientRects === 'function' && !rail.getClientRects().length);
        if (!railTampil && !(_ptPositions || []).length) return null;
    }
    const syms = ptSimbolKutipan().filter((s) => _ptKanonik[s] !== false);
    if (!syms.length) return null;
    const janji = ptMuatKutipan(syms);
    _ptKutipanJalan = janji;
    const lepas = () => { if (_ptKutipanJalan === janji) _ptKutipanJalan = null; };
    janji.then(lepas, lepas);
    return janji;
}

/**
 * P/L mengambang satu posisi di harga PENUTUPANNYA: BUY ditutup di bid, SELL di ask — aturan yang sama
 * dengan server saat Tutup (api/_paper_order.php). Dulu semua tampilan memakai harga tengah, sehingga P/L
 * yang terlihat sebelum menekan Tutup selisih setengah spread dari P/L yang benar-benar dibukukan.
 * Pengali lewat qimPaperPnl (dengan harga) — USDJPY/USDCHF/USDCAD butuh harganya.
 * @return {{harga:number, pnl:number, indikatif:boolean}|null} null bila tidak ada harga yang layak;
 *         indikatif = dinilai dari feed tampilan, bukan feed eksekusi server.
 */
function ptNilaiPosisi(p) {
    if (!p) return null;
    const harga = ptHargaNilai(p.symbol, p.side !== 'BUY');
    const masuk = parseFloat(p.entryPrice);
    const lots = parseFloat(p.lots);
    if (harga === null || !Number.isFinite(masuk) || !Number.isFinite(lots)) return null;
    const pnl = typeof window.qimPaperPnl === 'function'
        ? window.qimPaperPnl(p.symbol, p.side, masuk, harga, lots)
        : (p.side === 'BUY' ? harga - masuk : masuk - harga) * lots * ptPnlMult(p.symbol, harga);
    return { harga, pnl, indikatif: ptHargaIndikatif(p.symbol) };
}

/** P/L mengambang seluruh posisi. Total HANYA dari posisi yang punya harga layak; `lengkap` = semua berharga. */
function ptRingkasMengambang(daftar) {
    let total = 0, dihargai = 0;
    const per = {};
    for (const p of (daftar || [])) {
        const n = ptNilaiPosisi(p);
        if (p) per[p.id] = n;
        if (n) { total += n.pnl; dihargai++; }
    }
    const jumlah = (daftar || []).length;
    return { total, dihargai, jumlah, lengkap: dihargai === jumlah, per };
}

/** "+$12.30" / "-$4.00"; "—" bila tidak ada nilai. */
function ptUang(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);
}

/** Total mengambang: "—" bila tak satu posisi pun berharga, "(sebagian)" bila sebagian saja. */
function ptTeksMengambang(r) {
    if (!r.jumlah) return '+$0.00';
    if (!r.dihargai) return '—';
    return ptUang(r.total) + (r.lengkap ? '' : ' (sebagian)');
}

function ptEsc(t) { return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
/** Nilai aman untuk selektor atribut [data-x="…"]. */
function ptCssId(id) { return String(id).replace(/["\\]/g, '\\$&'); }

/** Waktu ptUpdateLivePrice terakhir mengambil ulang harga simbol (ms) — supaya tidak tiap 5 detik. */
const _ptSegarDicoba = {};

async function ptUpdateLivePrice() {
    const sym = document.getElementById('ptSymbol')?.value;
    const el  = document.getElementById('ptLivePrice');
    if (!sym || !el) return;
    // Simbol baru dipilih / harganya basi → diambil langsung lewat server (paling sering 10 detik sekali per
    // simbol: fungsi ini berjalan tiap 5 detik selama panel terbuka). Siklus fetchMarketData berikutnya ikut
    // memintanya (ptSymbol termasuk qiSimbolDiminta). Cadangan lama — harga penutupan candle dari
    // get-chart-data — dibuang: candle terakhir bisa berumur berjam-jam dan tampil sebagai "Live".
    if (!ptKutipanPaper(sym) && Date.now() - (_ptSegarDicoba[sym] || 0) >= PT_KUTIPAN_JEDA) {
        _ptSegarDicoba[sym] = Date.now();
        await ptSegarkanHarga(sym);
    }
    const side = document.getElementById('ptSide')?.value === 'SELL' ? 'SELL' : 'BUY';
    const segar = ptKutipanPaper(sym);
    const d = segar || _lastPrices[sym];
    el.textContent = d ? fmt(sym, d.price) : '—';
    el.className = segar ? 'text-qi-cyan font-semibold font-mono' : 'text-slate-500 font-semibold font-mono';
    el.title = segar ? (ptHargaIndikatif(sym) ? PT_KET_INDIKATIF : '') : ptAlasanTanpaHarga(sym);
    // Kolom "Harga eksekusi" BACA SAJA: order pasar dieksekusi server di ask (BUY) / bid (SELL). Dulu kolom
    // ini bisa diketik dan terbaca sebagai harga masuk, padahal hanya batas requote — harga yang diketik
    // > 0,5% dari pasar ditolak dengan pesan "layar Anda X" yang membingungkan. Harga basi → kosong.
    const entry = document.getElementById('ptEntryPrice');
    if (entry) {
        const h = ptHargaNilai(sym, side === 'BUY');
        entry.value = h ? fmt(sym, h) : '';
        entry.placeholder = h ? '' : 'Menunggu harga live';
    }
}

// ─── Garis posisi terbuka di chart (entry / SL / TP) ─────────────────────────
// MENGAPA: tabel posisi memberi angka, tetapi trader membaca posisinya DI CHART —
// di mana harga sekarang relatif terhadap entry, SL, dan TP. Tanpa garis ini
// pengguna harus membandingkan angka di kepala sambil melihat candle bergerak.
// Garis dikelola terpisah dari garis indikator (_lwPriceLines) supaya keduanya
// tidak saling menghapus: indikator digambar ulang saat data chart berubah,
// posisi digambar ulang saat POSISI berubah.
let _lwPosLines = [];

function qiHapusGarisPosisi() {
    _lwPosLines.forEach(pl => { if (_lwSeries) { try { _lwSeries.removePriceLine(pl); } catch (e) {} } });
    _lwPosLines = [];
}

/** Simbol aplikasi yang sedang tampil di chart ('XAUUSD'), atau '' bila belum ada. */
function qiSimbolChart() {
    const f = WL_GROUPS.flatMap(g => g.syms).find(s => s.tv === _tvSymbol);
    return f ? f.key : '';
}

function qiGambarGarisPosisi() {
    if (!_lwSeries) return;
    qiHapusGarisPosisi();
    const simbol = qiSimbolChart();
    if (!simbol) return;
    const dp  = DP[simbol] || 4;
    const fmt = (v) => Number(v).toFixed(dp);
    // Hanya posisi untuk simbol yang sedang tampil — garis dari simbol lain akan
    // menyesatkan karena skala harganya berbeda jauh.
    const posisi = (_ptPositions || []).filter(p => p && p.symbol === simbol);
    for (const p of posisi) {
        const beli  = p.side === 'BUY';
        const warna = beli ? '#00E676' : '#FF5252';
        const lot   = Number(p.lots || 0).toFixed(2);
        const entry = Number(p.entryPrice);
        if (!Number.isFinite(entry)) continue;
        const tambah = (harga, color, style, judul, width) => {
            const n = Number(harga);
            if (!Number.isFinite(n) || n <= 0) return;
            try {
                _lwPosLines.push(_lwSeries.createPriceLine({
                    price: n, color, lineWidth: width || 1, lineStyle: style,
                    axisLabelVisible: true, title: judul
                }));
            } catch (e) { /* seri chart sedang diganti — abaikan */ }
        };
        // Entry tebal & utuh; SL/TP putus-putus supaya mudah dibedakan sekilas.
        tambah(entry, warna, 0, `${p.side} ${lot} @ ${fmt(entry)}`, 2);
        tambah(p.sl, '#FF5252', 2, `SL ${fmt(p.sl)}`);
        tambah(p.tp, '#00E676', 2, `TP ${fmt(p.tp)}`);
    }
}

// Chart berganti simbol / timeframe → seri digambar ulang, garis posisi ikut menyesuaikan.
try {
    window.addEventListener('qi-chart-data', () => { try { qiGambarGarisPosisi(); } catch (e) {} });
} catch (e) {}

/** Sebab penutupan dari server (history.closeReason) → label singkat + judul untuk toast & riwayat. */
const PT_SEBAB_TUTUP = {
    manual:     { label: 'Manual', judul: 'Ditutup manual' },
    sl:         { label: 'SL', judul: 'Stop loss tersentuh' },
    tp:         { label: 'TP', judul: 'Take profit tersentuh' },
    stopout:    { label: 'Stop out', judul: 'Stop out — margin tidak mencukupi' },
    period_end: { label: 'Akhir periode', judul: 'Periode kompetisi berakhir' },
};

// Kunci isi tabel: daftar posisi hanya DIBANGUN ULANG bila kuncinya berubah (posisi dibuka/ditutup,
// SL/TP digeser). Selebihnya hanya teks harga & P/L yang diperbarui di tempat. Dulu innerHTML diganti
// tiap 5 detik — klik Tutup yang mousedown/mouseup-nya mengapit penggantian itu hilang begitu saja.
let _ptKunciTabel = null, _ptKunciRiwayat = null, _ptKunciGaris = null;

function ptRender() {
    const r = ptRingkasMengambang(_ptPositions);
    const dimuat = _ptDimuatPada > 0;

    const bEl = document.getElementById('ptBalance');
    const fEl = document.getElementById('ptFloating');
    const rEl = document.getElementById('ptRealized');
    const cEl = document.getElementById('ptOpenCount');
    if (bEl) bEl.textContent = dimuat ? '$' + Number(_ptBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    if (fEl) {
        fEl.textContent = dimuat ? ptTeksMengambang(r) : '—';
        fEl.title = dimuat && !r.lengkap ? `${r.jumlah - r.dihargai} posisi belum punya harga live — tidak ikut dijumlah` : '';
        fEl.className = `font-mono font-bold ${!dimuat || (r.jumlah && !r.dihargai) ? 'text-slate-500' : (r.total >= 0 ? 'text-qi-green' : 'text-qi-red')}`;
    }
    if (rEl) {
        rEl.textContent = dimuat ? ptUang(_ptRealized) : '—';
        rEl.className = `font-mono font-bold ${!dimuat ? 'text-slate-500' : (_ptRealized >= 0 ? 'text-qi-green' : 'text-qi-red')}`;
    }
    if (cEl) cEl.textContent = dimuat ? _ptPositions.length : '—';

    // Positions table
    const posBody = document.getElementById('ptPositionsBody');
    if (posBody) {
        const kunci = (dimuat ? 'd' : (_ptMuatGagal ? 'g' : 'm')) + '#' + _ptPositions.map(p => [p.id, p.src, p.lots, p.sl, p.tp].join('|')).join(';');
        if (kunci !== _ptKunciTabel) {
            _ptKunciTabel = kunci;
            if (!_ptPositions.length) {
                const teks = dimuat ? 'Belum ada posisi terbuka' : (_ptMuatGagal ? 'Posisi belum bisa dimuat dari server' : 'Memuat posisi…');
                posBody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-slate-600">${teks}</td></tr>`;
            } else {
                posBody.innerHTML = _ptPositions.map(p => {
                    const id = ptEsc(p.id);
                    const sideCls = p.side === 'BUY' ? 'text-qi-green' : 'text-qi-red';
                    const menutup = _ptSedangOrder.has(p.id);
                    return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02]">
                    <td class="px-4 py-2.5 font-semibold text-white text-[11px]">${ptEsc(SYMBOL_LABELS[p.symbol]||p.symbol)}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] font-bold ${sideCls}">${ptEsc(p.side)}</td>
                    <td class="px-3 py-2.5 text-center text-[11px]">${ptEsc(p.lots)}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] tabular-nums">${fmt(p.symbol, p.entryPrice)}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] tabular-nums text-qi-cyan" data-pt-kini="${id}">—</td>
                    <td class="px-3 py-2.5 text-center text-[10px] text-slate-500">${ptEsc(p.sl||'—')} / ${ptEsc(p.tp||'—')}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] tabular-nums font-bold" data-pt-pnl="${id}">—</td>
                    <td class="px-3 py-2.5 text-center">
                        ${(p.src && p.src !== 'manual')
                            ? `<span class="text-[9px] font-mono text-qi-cyan" title="Dikelola otomatis: ditutup saat sinyal kena TP/SL">${p.src === 'auto' ? 'AUTO' : 'AI'}</span>`
                            : `<button data-tutup-id="${id}" data-qi-aksi="ptClosePosition" data-qi-arg="${QIAksi.arg(String(p.id))}" class="text-[10px] text-qi-red hover:underline font-mono disabled:opacity-60 disabled:no-underline"${menutup ? ' disabled aria-busy="true"' : ''}>${menutup ? 'Menutup…' : 'Tutup'}</button>`}
                    </td>
                </tr>`;
                }).join('');
            }
        }
        // Harga & P/L diperbarui DI TEMPAT (tanpa membangun ulang baris & tombolnya).
        for (const p of _ptPositions) {
            const n = r.per[p.id];
            const kini = posBody.querySelector(`[data-pt-kini="${ptCssId(p.id)}"]`);
            const pnlEl = posBody.querySelector(`[data-pt-pnl="${ptCssId(p.id)}"]`);
            if (kini) {
                kini.textContent = n ? fmt(p.symbol, n.harga) : '—';
                kini.title = n ? `Harga penutupan (${p.side === 'BUY' ? 'bid' : 'ask'})` + (n.indikatif ? ' · ' + PT_KET_INDIKATIF : '') : ptAlasanTanpaHarga(p.symbol);
            }
            if (pnlEl) {
                const masuk = parseFloat(p.entryPrice);
                const pct = n && masuk > 0 ? ((p.side === 'BUY' ? n.harga - masuk : masuk - n.harga) / masuk * 100) : null;
                pnlEl.innerHTML = n ? `${ptUang(n.pnl)}<br><span class="text-[9px] opacity-60">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>` : '—';
                pnlEl.title = n ? (n.indikatif ? PT_KET_INDIKATIF : '') : ptAlasanTanpaHarga(p.symbol);
                pnlEl.className = 'px-3 py-2.5 text-center text-[11px] tabular-nums font-bold ' + (n ? (n.pnl >= 0 ? 'text-qi-green' : 'text-qi-red') : 'text-slate-500');
            }
        }
    }

    // History table
    const hisBody = document.getElementById('ptHistoryBody');
    if (hisBody) {
        const kunciR = _ptHistory.length + '#' + _ptHistory.slice(0, 30).map(h => h.id + '|' + h.closedAt + '|' + h.closeReason).join(';');
        if (kunciR !== _ptKunciRiwayat) {
            _ptKunciRiwayat = kunciR;
            if (!_ptHistory.length) {
                hisBody.innerHTML = '<tr><td colspan="7" class="px-4 py-4 text-center text-slate-600">Belum ada riwayat</td></tr>';
            } else {
                hisBody.innerHTML = _ptHistory.slice(0, 30).map(h => {
                    const pnlCls = h.pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
                    const sideCls = h.side === 'BUY' ? 'text-qi-green' : 'text-qi-red';
                    // Sebab penutupan dari server (SL/TP/stop out/akhir periode) dituliskan apa adanya.
                    const sebab = PT_SEBAB_TUTUP[h.closeReason];
                    const label = sebab && h.closeReason !== 'manual'
                        ? ` <span class="ml-1 px-1 rounded bg-white/5 text-slate-300" title="${ptEsc(sebab.judul)} — ditutup server">${ptEsc(sebab.label)}</span>` : '';
                    return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02]">
                    <td class="px-4 py-2 font-semibold text-white text-[11px]">${ptEsc(SYMBOL_LABELS[h.symbol]||h.symbol)}</td>
                    <td class="px-3 py-2 text-center text-[11px] ${sideCls}">${ptEsc(h.side)}</td>
                    <td class="px-3 py-2 text-center text-[11px]">${ptEsc(h.lots)}</td>
                    <td class="px-3 py-2 text-center text-[11px] tabular-nums">${fmt(h.symbol, h.entryPrice)}</td>
                    <td class="px-3 py-2 text-center text-[11px] tabular-nums">${fmt(h.symbol, h.closePrice)}</td>
                    <td class="px-3 py-2 text-center text-[11px] font-bold ${pnlCls}">${ptUang(h.pnl)}</td>
                    <td class="px-3 py-2 text-center text-[10px] text-slate-500">${ptEsc(h.closeTime||'')}${label}</td>
                </tr>`;
                }).join('');
            }
        }
    }

    // Posisi berubah (buka, tutup, SL/TP digeser, muat ulang dari server) → garis di chart ikut
    // menyesuaikan. Hanya bila posisinya benar-benar berubah: ptRender kini juga berjalan tiap 5 detik
    // dan tiap muat berkala, dan menghapus-menggambar ulang garis setiap kali itu membuat chart berkedip.
    const kunciG = _ptPositions.map(p => [p.id, p.symbol, p.side, p.lots, p.entryPrice, p.sl, p.tp].join('|')).join(';');
    if (kunciG !== _ptKunciGaris) { _ptKunciGaris = kunciG; try { qiGambarGarisPosisi(); } catch (e) {} }
    // Kartu Quick Trade di rail kanan ikut menyegarkan saldo & daftar posisinya, supaya
    // menutup posisi dari mana pun langsung terlihat di sana tanpa menunggu 5 detik.
    try { qtSaldo(); qtRenderPosisi(); } catch (e) {}
    ptSiarkanState();
}

let _ptSiarJadwal = null;
/** Beri tahu kartu Simulation Balance (qim-dashboard.js) bahwa state atau harga paper berubah. */
function ptSiarkanState() {
    if (_ptSiarJadwal) return;
    _ptSiarJadwal = setTimeout(() => {
        _ptSiarJadwal = null;
        try { window.dispatchEvent(new CustomEvent('qi-paper-state')); } catch (e) {}
    }, 50);
}

/**
 * State paper yang SAMA untuk kartu Simulation Balance. Dulu kartu itu melakukan GET sendiri tiap
 * 30 detik, mengambil harga sendiri, menilai di harga tengah, dan memanggil ptPnlMult TANPA harga
 * (USDCHF ±125× terlalu kecil) — dua saldo berbeda tampil berdampingan di rail yang sama.
 */
window.qiPaperRingkasan = function () {
    const r = ptRingkasMengambang(_ptPositions);
    return {
        dimuat: _ptDimuatPada > 0, dimuatPada: _ptDimuatPada, gagal: _ptMuatGagal,
        saldo: _ptBalance, realisasi: _ptRealized,
        posisi: _ptPositions.slice(), riwayat: _ptHistory.slice(), kompetisi: _ptKompetisi,
        mengambang: r.total, dihargai: r.dihargai, jumlah: r.jumlah, lengkap: r.lengkap,
    };
};

// ─── QUICK TRADE (kartu di rail kanan) ──────────────────────────────────────
// Order untuk simbol yang SEDANG tampil di chart, tanpa berpindah panel.
// Akun (Simulasi / Real MT5) dipilih di baris paling atas. Mode Real menandai SELURUH kartu (border
// merah, lencana REAL di BUY/SELL) dan menyembunyikan saldo & posisi SIMULASI — dulu angka simulasi
// tetap tampil tepat di bawah tombol yang mengirim uang sungguhan, dan satu-satunya pembeda adalah
// teks kecil di bawah kartu.
const QT = { akun: 'sim', pesan: null };
const qtEl = (id) => document.getElementById(id);
/** true selama satu order sedang dikirim: BUY/SELL/Buka Posisi nonaktif (cegah order ganda). */
let _ptBukaJalan = false;

/**
 * Harga sisi beli & jual untuk akun yang dipilih. Simulasi: feed yang MENGISI order paper di server
 * (ptKutipanPaper — kanonik bila simbolnya dilayani). Real MT5: feed tampilan (live-price; harga broker
 * bagi yang berhak). Memakai ask/bid bila ada; kalau tidak, harga tengah untuk KEDUANYA — lebih baik dua
 * angka sama daripada spread karangan. Harga basi (> 60 detik) atau kurs harian → null: dulu harga sampai
 * 5 menit tampil di tombol sebagai kutipan live tanpa penanda apa pun.
 */
function qtHarga() {
    const sym = qiSimbolChart();
    if (!sym) return { sym, beli: null, jual: null, nyata: false, indikatif: false };
    const real = QT.akun === 'real';
    const d = real ? ptKutipanLive(sym) : ptKutipanPaper(sym);
    const beli = ptSisiKutipan(d, true), jual = ptSisiKutipan(d, false);
    const ada = !!d && Number.isFinite(parseFloat(d.ask)) && Number.isFinite(parseFloat(d.bid));
    return { sym, beli, jual, nyata: ada, indikatif: !real && ptHargaIndikatif(sym) };
}

/** Langkah stepper SL/TP. Forex/emas/indeks: satu pip (XAUUSD 0.1 · EURUSD 0.0001). Kripto: relatif
 *  terhadap harga (BTC ±85.000 → 10, ETH → 1, SOL → 0.1) — dulu 0.1 per klik untuk BTC/ETH, sehingga
 *  tombol −/+ SL praktis tidak berguna. */
function qtLangkah(sym, harga) {
    const h = Number(harga);
    if (/USDT$/.test(String(sym || '')) && h > 0) return Math.pow(10, Math.floor(Math.log10(h)) - 3);
    return Math.pow(10, -(DP[sym] || 4)) * 10;
}

function qtSetAkun(el, e, akun) { QT.akun = akun === 'real' ? 'real' : 'sim'; qtSegarkan(); }

/**
 * BUY / SELL = TOMBOL ORDER, bukan pemilih arah.
 *
 * Versi pertama kartu ini memakai keduanya hanya untuk memilih arah, lalu order dikirim
 * lewat tombol "Place Order" terpisah. Itu salah: di MT5 — dan di rancangan yang diminta —
 * BUY dan SELL ADALAH tombol ordernya. Sekarang satu tekan = satu order. Tidak ada lagi
 * "arah aktif": dulu tombol yang tidak terakhir ditekan diredupkan (opacity .52) sehingga
 * SELL tampak mati sejak halaman dibuka.
 */
function qtOrder(el, e, arah) {
    qtKirim(arah === 'SELL' ? 'SELL' : 'BUY');
}

function qtStep(el, e, id, naik) {
    const inp = qtEl(id); if (!inp) return;
    const sym = qiSimbolChart();
    const lot = id === 'qtLot';
    const dp  = lot ? 2 : (DP[sym] || 4);
    const h = qtHarga();
    const tengah = Number.isFinite(h.beli) && Number.isFinite(h.jual) ? (h.beli + h.jual) / 2 : NaN;
    let v = parseFloat(inp.value);
    if (!Number.isFinite(v)) {
        // SL/TP masih kosong → mulai dari harga TENGAH sekarang, bukan dari nol — dan bukan dari sisi
        // tombol yang terakhir ditekan (BUY & SELL kini dua tombol order, tidak ada "arah aktif").
        v = lot ? 0.01 : tengah;
        if (!Number.isFinite(v) || v <= 0) return;
    } else {
        v += (lot ? 0.01 : qtLangkah(sym, Number.isFinite(tengah) ? tengah : v)) * (naik < 0 ? -1 : 1);
    }
    inp.value = Math.max(lot ? 0.01 : 0, v).toFixed(dp);
    qtHitung();
}

/**
 * Alasan bila SL/TP berada di sisi yang salah untuk arah ini pada harga itu, atau null bila sah.
 * Kembaran qi_paper_cek_sltp() di api/_paper_order.php — dicek SEBELUM order dikirim, untuk sisi
 * tombol yang DITEKAN. Dulu hanya diperiksa untuk tombol yang ditekan SEBELUMNYA: SL di bawah harga
 * lalu menekan SELL membuka SELL dengan SL di sisi yang salah, dan pengaman SL/TP menutupnya dua
 * detik kemudian — bagi pengguna terlihat seperti "SELL tidak jalan".
 */
function ptCekSlTp(arah, harga, sl, tp) {
    const beli = arah === 'BUY';
    const ada = (v) => Number(v) > 0;
    if (ada(sl) && (beli ? sl >= harga : sl <= harga)) {
        return beli ? `Untuk BUY, stop loss harus di BAWAH harga (${harga}).` : `Untuk SELL, stop loss harus di ATAS harga (${harga}).`;
    }
    if (ada(tp) && (beli ? tp <= harga : tp >= harga)) {
        return beli ? `Untuk BUY, take profit harus di ATAS harga (${harga}).` : `Untuk SELL, take profit harus di BAWAH harga (${harga}).`;
    }
    return null;
}

/** Perkiraan untung/rugi dari level yang diisi. Angkanya KOTOR — spread dan komisi
 *  tidak dikurangi di sini, dan itu dikatakan apa adanya. Margin sengaja tidak
 *  ditampilkan: leverage akun broker tidak diketahui klien, jadi angkanya akan karangan.
 *  Satu pasang SL/TP melayani dua tombol, jadi LEVELNYA sendiri yang menentukan arah yang cocok. */
function qtHitung() {
    const info = qtEl('qtInfo'); if (!info) return;
    // Alasan penolakan server terakhir tetap terlihat 15 detik di kartu (toast cepat hilang).
    const tolak = QT.pesan && QT.pesan.sampai > Date.now();
    if (info.classList) info.classList.toggle('is-tolak', !!tolak);
    if (tolak) { info.textContent = QT.pesan.teks; return; }
    const h = qtHarga();
    const lots = parseFloat(qtEl('qtLot')?.value);
    if (!h.sym || !Number.isFinite(h.beli) || !Number.isFinite(h.jual) || !Number.isFinite(lots) || lots <= 0) {
        info.textContent = 'Menunggu harga live.';
        return;
    }
    const sl = parseFloat(qtEl('qtSL')?.value);
    const tp = parseFloat(qtEl('qtTP')?.value);
    const adaSL = Number.isFinite(sl) && sl > 0, adaTP = Number.isFinite(tp) && tp > 0;
    if (!adaSL && !adaTP) { info.textContent = 'Isi SL dan TP untuk melihat perkiraan untung/rugi.'; return; }
    const cocokBuy  = !ptCekSlTp('BUY', h.beli, adaSL ? sl : null, adaTP ? tp : null);
    const cocokSell = !ptCekSlTp('SELL', h.jual, adaSL ? sl : null, adaTP ? tp : null);
    if (!cocokBuy && !cocokSell) {
        info.textContent = 'SL/TP ini tidak cocok untuk arah mana pun. BUY: SL di BAWAH harga, TP di ATAS. SELL: SL di ATAS harga, TP di BAWAH.';
        return;
    }
    if (cocokBuy && cocokSell) {
        info.textContent = 'Level SL/TP berada di dalam spread — geser lebih jauh dari harga.';
        return;
    }
    const arah = cocokBuy ? 'BUY' : 'SELL';
    const entry = cocokBuy ? h.beli : h.jual;
    const lawan = arah === 'BUY' ? 'SELL' : 'BUY';
    if (QT.akun === 'real') {
        // Akun REAL: hanya jarak harga dan R:R. Nilai dolar butuh ukuran kontrak & nilai pip BROKER, yang
        // tidak diketahui klien — model kontrak paper (XAUUSD 100 oz, indeks/FX simulasi) di sini akan
        // menjadi angka karangan untuk uang sungguhan (alasan yang sama dengan margin yang tidak ditampilkan).
        const dp = DP[h.sym] || 4;
        const bagianR = [];
        if (adaTP) bagianR.push('Jarak TP ' + Math.abs(tp - entry).toFixed(dp));
        if (adaSL) bagianR.push('jarak SL ' + Math.abs(entry - sl).toFixed(dp));
        if (adaSL && adaTP && Math.abs(entry - sl) > 0) bagianR.push('R:R 1:' + (Math.abs(tp - entry) / Math.abs(entry - sl)).toFixed(2));
        info.textContent = `SL/TP ini untuk ${arah} (${lawan} akan ditolak). ` + bagianR.join(' · ')
            + ' — nilai dolar bergantung ukuran kontrak di broker Anda, tidak diperkirakan di sini.';
        return;
    }
    const mult = ptPnlMult(h.sym, entry);
    const uang = (jarak) => '$' + Math.abs(jarak * lots * mult).toFixed(2);
    const bagian = [];
    if (adaTP) bagian.push('Est. untung ' + uang(tp - entry));
    if (adaSL) bagian.push('Est. rugi ' + uang(entry - sl));
    if (adaSL && adaTP) {
        const risiko = Math.abs(entry - sl);
        if (risiko > 0) bagian.push('R:R 1:' + (Math.abs(tp - entry) / risiko).toFixed(2));
    }
    info.textContent = `SL/TP ini untuk ${arah} (${lawan} akan ditolak). ` + bagian.join(' · ') + ' — kotor, belum dikurangi spread & komisi.';
}

/** BUY/SELL/Buka Posisi nonaktif selama order dikirim (klik ganda dulu membuka DUA posisi) dan, di mode
 *  simulasi, untuk paket FREE — server menolak paper trading non-PRO (403). */
function qtTerapkanTombol() {
    const real = QT.akun === 'real';
    const terkunci = !real && qiTingkatSaatIni() < 1;
    for (const id of ['qtBuy', 'qtSell']) {
        const b = qtEl(id); if (!b) continue;
        b.disabled = _ptBukaJalan || terkunci;
        if (b.setAttribute) b.setAttribute('aria-busy', _ptBukaJalan ? 'true' : 'false');
        b.title = terkunci ? 'Paper trading tersedia untuk paket PRO ke atas'
            : (real ? (id === 'qtBuy' ? 'BUY' : 'SELL') + ' dengan UANG SUNGGUHAN — order dikirim ke terminal MT5' : '');
    }
    const f = qtEl('ptOpenBtn');
    if (f) { f.disabled = _ptBukaJalan; if (f.setAttribute) f.setAttribute('aria-busy', _ptBukaJalan ? 'true' : 'false'); }
}

function ptSetBukaJalan(on) {
    _ptBukaJalan = !!on;
    try { qtTerapkanTombol(); } catch (e) {}
}

function qtSegarkan() {
    const h = qtHarga();
    const real = QT.akun === 'real';
    const fmtH = (v) => Number.isFinite(v) ? v.toFixed(DP[h.sym] || 4) : '—';
    const set = (id, teks) => { const el = qtEl(id); if (el) el.textContent = teks; };
    set('qtSym', h.sym || '—');
    // Harga basi / tidak ada → "—" dengan alasannya, bukan angka lama yang terlihat seperti kutipan live.
    const ket = !h.sym ? '' : (!Number.isFinite(h.beli) ? ptAlasanTanpaHarga(h.sym, real) : (h.indikatif ? PT_KET_INDIKATIF : ''));
    for (const [id, v] of [['qtBuyHarga', h.beli], ['qtSellHarga', h.jual]]) {
        const el = qtEl(id);
        if (!el) continue;
        el.textContent = fmtH(v);
        el.title = ket;
    }

    const pro = qiTingkatSaatIni() >= 1;
    qtEl('qtAkunSim')?.classList.toggle('is-active', !real);
    qtEl('qtAkunReal')?.classList.toggle('is-active', real);
    qtEl('qtKartu')?.classList.toggle('is-real', real);
    const tampil = (id, ya) => { const el = qtEl(id); if (el) el.hidden = !ya; };
    tampil('qtSaldoBaris', !real);
    tampil('qtPosisiBlok', !real);
    tampil('qtRealInfo', real);
    tampil('qtUpgrade', !real && !pro);
    qtTerapkanTombol();

    qtSaldo();
    qtRenderPosisi();
    const nota = qtEl('qtNota');
    if (nota) {
        nota.textContent = real
            ? 'Uang sungguhan — SL dan TP wajib, order dikirim ke terminal MT5.'
            : (pro ? 'Simulasi — tanpa uang sungguhan.' : 'Paper trading (simulasi) tersedia untuk paket PRO ke atas.');
        nota.classList.toggle('is-real', real);
    }
    qtHitung();
}

/**
 * Saldo & P/L mengambang akun simulasi, ditampilkan di kartu Quick Trade.
 * Saldo hanya berubah saat posisi DITUTUP (sama seperti MT5: Balance vs Equity), jadi
 * "mengambang" ditampilkan terpisah supaya angkanya terlihat bergerak saat posisi hidup.
 * Sebelum state server pernah dimuat, keduanya "—": dulu kartu ini menampilkan $10,000.00 bawaan.
 */
function qtSaldo() {
    const bEl = qtEl('qtSaldo'), fEl = qtEl('qtFloat');
    if (!bEl && !fEl) return;
    const dimuat = _ptDimuatPada > 0;
    const r = ptRingkasMengambang(_ptPositions || []);
    if (bEl) bEl.textContent = dimuat ? '$' + Number(_ptBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    if (fEl) {
        fEl.textContent = dimuat ? ptTeksMengambang(r) : '—';
        fEl.title = dimuat && !r.lengkap ? `${r.jumlah - r.dihargai} posisi belum punya harga live — tidak ikut dijumlah` : '';
        fEl.className = dimuat && r.dihargai ? (r.total > 0 ? 'naik' : (r.total < 0 ? 'turun' : '')) : '';
    }
}

let _qtKunciPosisi = null;
/**
 * Daftar posisi terbuka + tombol Tutup, langsung di kartu Quick Trade.
 *
 * Sebelumnya tombol Tutup HANYA ada di panel Trading Workspace, sementara order dibuka
 * dari panel Chart — jadi setelah order pengguna tidak melihat cara menutupnya sama
 * sekali, dan karena saldo baru bergerak saat posisi ditutup, saldo pun tampak membeku.
 * Posisi AUTO/AI tidak diberi tombol Tutup (server yang mengelolanya, sama seperti ptRender).
 * Daftar dibangun ulang hanya bila id posisinya berubah; P/L diperbarui di tempat.
 */
function qtRenderPosisi() {
    const wadah = qtEl('qtPosisi');
    const jml = qtEl('qtPosisiJml');
    if (!wadah) return;
    const daftar = _ptPositions || [];
    const dimuat = _ptDimuatPada > 0;
    const pro = qiTingkatSaatIni() >= 1;
    if (jml) jml.textContent = dimuat ? String(daftar.length) : '—';
    const kunci = (pro ? 'p' : 'f') + (dimuat ? 'd' : (_ptMuatGagal ? 'g' : 'm')) + '#' + daftar.map(p => p.id + '|' + (p.src || 'manual')).join(';');
    if (kunci !== _qtKunciPosisi) {
        _qtKunciPosisi = kunci;
        if (!pro) wadah.innerHTML = '<div class="qim-qt-kosong">Paper trading tersedia untuk paket PRO ke atas.</div>';
        else if (!dimuat) wadah.innerHTML = `<div class="qim-qt-kosong">${_ptMuatGagal ? 'Posisi belum bisa dimuat dari server.' : 'Memuat posisi…'}</div>`;
        else if (!daftar.length) wadah.innerHTML = '<div class="qim-qt-kosong">Belum ada posisi terbuka.</div>';
        else wadah.innerHTML = daftar.map((p) => {
            const id = ptEsc(p.id);
            const otomatis = p.src && p.src !== 'manual';
            const menutup = _ptSedangOrder.has(p.id);
            return `<div class="qim-qt-pos">
            <span class="qim-qt-pos-nama"><i class="${p.side === 'BUY' ? 'buy' : 'sell'}">${ptEsc(p.side)}</i> ${ptEsc(p.symbol)} ${Number(p.lots).toFixed(2)}</span>
            <span class="qim-qt-pos-pnl" data-qt-pnl="${id}">—</span>
            ${otomatis
                ? `<span class="qim-qt-auto" title="Dikelola server: ditutup saat sinyal kena TP/SL">${p.src === 'auto' ? 'AUTO' : 'AI'}</span>`
                : `<button type="button" class="qim-qt-tutup" data-tutup-id="${id}" data-qi-aksi="ptClosePosition" data-qi-arg="${QIAksi.arg(String(p.id))}"${menutup ? ' disabled aria-busy="true"' : ''}>${menutup ? 'Menutup…' : 'Tutup'}</button>`}
        </div>`;
        }).join('');
    }
    if (!dimuat || !pro) return;
    for (const p of daftar) {
        const el = wadah.querySelector(`[data-qt-pnl="${ptCssId(p.id)}"]`);
        if (!el) continue;
        const n = ptNilaiPosisi(p);
        el.textContent = n ? ptUang(n.pnl) : '—';
        el.title = n ? `Dinilai di ${p.side === 'BUY' ? 'bid' : 'ask'} ${fmt(p.symbol, n.harga)}` + (n.indikatif ? ' · ' + PT_KET_INDIKATIF : '') : ptAlasanTanpaHarga(p.symbol);
        el.className = 'qim-qt-pos-pnl' + (n ? (n.pnl > 0 ? ' naik' : (n.pnl < 0 ? ' turun' : '')) : '');
    }
}

function qtKirim(arah) {
    arah = arah === 'SELL' ? 'SELL' : 'BUY';
    const h = qtHarga();
    if (!h.sym) { showQuantumToast('Pilih simbol di chart lebih dulu.', 'warning'); return; }
    const lots = parseFloat(qtEl('qtLot')?.value);
    if (!Number.isFinite(lots) || lots <= 0) { showQuantumToast('Lot harus lebih besar dari nol.', 'warning'); return; }
    const sl = parseFloat(qtEl('qtSL')?.value) || null;
    const tp = parseFloat(qtEl('qtTP')?.value) || null;

    // Akun REAL: ptKirimOrderReal mengambil harga live yang SEGAR, memeriksa SL/TP terhadapnya, dan
    // memastikan akun MT5 tujuan — semuanya sebelum dialog konfirmasi. Harga di tombol bisa sudah basi.
    if (QT.akun === 'real') { ptKirimOrderReal({ symbol: h.sym, side: arah, lots, sl, tp }); return; }
    if (qiTingkatSaatIni() < 1) { showQuantumToast('Paper trading tersedia untuk paket PRO ke atas.', 'info'); return; }
    const entry = arah === 'BUY' ? h.beli : h.jual;
    if (!Number.isFinite(entry) || entry <= 0) {
        // Tombol menampilkan "—" (harga basi / belum ada): order TIDAK dikirim di harga yang tidak terlihat.
        showQuantumToast(`Harga ${h.sym} belum segar — order tidak dikirim. Harga diambil ulang; tekan lagi setelah angkanya tampil.`, 'warning', 6000);
        ptSegarkanHarga(h.sym).then(() => { try { qtSegarkan(); } catch (e) {} });
        return;
    }
    // SL/TP diperiksa untuk sisi tombol yang DITEKAN, sebelum apa pun dikirim.
    const alasan = ptCekSlTp(arah, entry, sl, tp);
    if (alasan) { showQuantumToast(alasan + ' Order tidak dikirim.', 'warning', 6000); return; }
    // Konfirmasi "posisi dibuka" datang dari ptOpenDirectPosition SETELAH server menerimanya —
    // bukan di sini, sebelum tahu apakah order ditolak (pasar tutup, requote, batas rugi).
    ptOpenDirectPosition(h.sym, arah, entry, sl, tp, lots, 'quick');
}

// Harga & simbol chart berubah → kartu ikut menyesuaikan.
try {
    window.addEventListener('qi-chart-data', () => { try { qtSegarkan(); } catch (e) {} });
    window.addEventListener('load', () => {
        try { qtSegarkan(); } catch (e) {}
        // State paper dimuat saat halaman dibuka (PRO+). Dulu hanya saat panel Paper Trading dibuka —
        // padahal Quick Trade ada di panel Chart (panel bawaan), sehingga kartunya menampilkan $10.000
        // bawaan dan 0 posisi, tanpa tombol Tutup untuk posisi yang sebenarnya masih terbuka.
        // Kutipan kanonik dimuat SESUDAH posisinya diketahui (simbol posisi ikut diminta).
        try {
            Promise.resolve(ptMuatBerkala(true)).then(() => { try { ptMuatKutipanBerkala(true); } catch (e) {} },
                () => { try { ptMuatKutipanBerkala(true); } catch (e) {} });
        } catch (e) {}
    });
    document.addEventListener('visibilitychange', () => { try { ptMuatBerkala(false); } catch (e) {} });
} catch (e) {}
setInterval(() => {
    try { ptMuatBerkala(false); } catch (e) {}
    try { ptMuatKutipanBerkala(false); } catch (e) {}
}, 5000);

// Ketiga fungsi ini menerima (el, e, ...arg), jadi WAJIB didaftarkan. QIAksi memanggil
// fungsi window TANPA el & e (qim-aksi.js: f.fn.apply(f.ini, arg)) — tanpa pendaftaran ini
// tombol SELL memanggil qtOrder('SELL'): 'SELL' jatuh ke `el`, `arah` undefined, dan
// order yang terkirim selalu BUY. Pemilih akun dan tombol −/+ lot/SL/TP mati dengan cara
// yang sama. tests/aksi-tanda-tangan.test.js menolak pola ini di seluruh kode.
QIAksi.daftar({ qtSetAkun, qtOrder, qtStep });

/** Akun tujuan formulir "Buka Posisi": 'sim' (bawaan) atau 'real'. */
function ptAkunAktif() {
    return document.getElementById('ptAkun')?.value === 'real' ? 'real' : 'sim';
}

/**
 * Pemilih akun diubah → tombol dan keterangannya ikut berubah.
 * Tombol merah untuk akun real BUKAN hiasan: satu-satunya pembeda antara menekan
 * tombol yang membuka posisi simulasi dan tombol yang mengirim uang sungguhan ke
 * broker adalah isi dropdown yang mungkin sudah tidak dilihat lagi.
 */
function ptGantiAkun() {
    const real = ptAkunAktif() === 'real';
    const btn  = document.getElementById('ptOpenBtn');
    const nota = document.getElementById('ptAkunNota');
    if (btn) {
        btn.textContent = real ? 'KIRIM ORDER REAL' : '+ Buka Posisi';
        btn.style.background = real ? 'linear-gradient(135deg,#FF5252,#B71C1C)' : 'linear-gradient(135deg,#00E5FF,#7C4DFF)';
        btn.style.color = real ? '#fff' : '';
    }
    if (nota) {
        nota.textContent = real
            ? 'Uang sungguhan — SL dan TP wajib, order dikirim ke terminal MT5.'
            : 'Posisi simulasi — tanpa uang sungguhan.';
        nota.className = real ? 'text-[10px] text-qi-red font-semibold' : 'text-[10px] text-slate-500';
    }
}

/**
 * Order manual ke akun MT5 sungguhan. Melewati guardrail server yang sama dengan
 * order dari mesin sinyal (api/live-trade.php aksi queue_manual): akun harus aktif,
 * tidak sedang emergency stop, simbol dipetakan & diizinkan, lot <= max_lot, SL/TP sah.
 * Batas rugi harian dan batas posisi ditegakkan belakangan oleh api/mt-execution.php
 * saat EA meminta instruksi, memakai angka yang sudah mutakhir.
 */
/**
 * Akun MT5 tujuan order real beserta labelnya, atau null. Label ("Nama akun · connected") ikut ke dialog
 * konfirmasi supaya pengguna melihat TUJUAN order. Pilihan terakhir pengguna (Profil → Broker MT5) dipakai
 * bila akunnya masih ada; kalau tidak, akun yang terhubung aktif pertama.
 */
function ptAkunRealTerpilih() {
    const daftar = Array.isArray(_akunLive) ? _akunLive : [];
    if (!daftar.length) return null;
    let simpan = 0;
    try { simpan = Number(localStorage.getItem('qi_live_akun')) || 0; } catch (e) {}
    const akun = daftar.find((a) => Number(a.id) === simpan)
        || daftar.find((a) => a.connection_status === 'active')
        || daftar[0];
    const id = Number(akun && akun.id);
    if (!Number.isInteger(id) || id < 1) return null;
    const label = String((akun.account_label || 'MT5') + ' · ' + (akun.connection_status || '')).replace(/[<>&"]/g, '').trim();
    return { id, label: label || ('akun MT5 #' + id) };
}

async function ptKirimOrderReal(o) {
    const toast = (pesan, jenis, ms) => showQuantumToast(pesan, jenis, ms);
    if (!(o.sl > 0) || !(o.tp > 0)) {
        toast('Akun real wajib memakai SL dan TP.', 'warning');
        return;
    }
    if (_ptBukaJalan) { toast('Order sebelumnya masih diproses — tunggu sebentar.', 'info'); return; }
    ptSetBukaJalan(true);
    try {
        // 1) Akun tujuan dipastikan SEBELUM konfirmasi. daftar akun dimuat dari server bila belum ada; dulu liveAction() mengembalikan null tanpa mengirim apa pun, lalu toast
        //    HIJAU "Order masuk antrean." tetap muncul — dan klik berikutnya diam-diam masuk ke akun pertama.
        let akun = ptAkunRealTerpilih();
        if (!akun && typeof loadLiveExecution === 'function') {
            try { await loadLiveExecution(); } catch (e) {}
            akun = ptAkunRealTerpilih();
        }
        if (!akun) {
            toast('Order real TIDAK dikirim — belum ada akun MT5 terhubung yang bisa dipilih. Hubungkan akun di Profil → Broker MT5.', 'error', 9000);
            return;
        }
        // 2) Harga live yang SEGAR (feed tampilan; harga broker bagi yang berhak). Dulu dipakai harga di tombol
        //    tanpa cek umur — harga 10 menit lalu atau kurs harian ECB pun dikirim sebagai entry, padahal EA
        //    mengeksekusi di pasar sampai lima menit kemudian: SL/TP yang "sah" di harga basi bisa berada di
        //    sisi yang salah dari pasar sebenarnya.
        await ptSegarkanHarga(o.symbol, { kanonik: false });
        const harga = ptHargaLive(o.symbol, o.side === 'BUY');
        if (harga === null) {
            toast(`Order real TIDAK dikirim — ${ptAlasanTanpaHarga(o.symbol, true)}. SL/TP tidak bisa diperiksa terhadap harga yang tidak segar.`, 'error', 9000);
            return;
        }
        if (String((_lastPrices[o.symbol] || {}).market || '') === 'closed') {
            toast(`Order real TIDAK dikirim — pasar ${o.symbol} sedang tutup.`, 'info', 7000);
            return;
        }
        const alasan = ptCekSlTp(o.side, harga, o.sl, o.tp);
        if (alasan) { toast(alasan + ' Order tidak dikirim.', 'warning', 6000); return; }
        const sisi = o.side === 'BUY' ? 'ask' : 'bid';
        const ringkas = `Akun: ${akun.label}\n${o.side} ${o.symbol} ${o.lots} lot\nHarga pasar sekarang ${harga} (${sisi})\nSL ${o.sl} · TP ${o.tp}`;
        if (!window.confirm(`Kirim order ke MT5 dengan UANG SUNGGUHAN?\n\n${ringkas}\n\nOrder berlaku lima menit di antrean.`)) return;
        // Pilihan akun bisa berubah selama dialog terbuka (tab lain / panel Broker): kirim hanya ke akun
        // yang DISEBUT di dialog.
        const kini = ptAkunRealTerpilih();
        if (!kini || kini.id !== akun.id) { toast('Akun MT5 berubah selama konfirmasi — order TIDAK dikirim. Ulangi order.', 'warning', 7000); return; }
        const data = await liveAction({
            action: 'queue_manual', symbol: o.symbol, side: o.side, volume: o.lots,
            entry_price: harga, stop_loss: o.sl, take_profit: o.tp,
        });
        // liveAction() mengembalikan null bila TIDAK mengirim apa pun — itu bukan sukses.
        if (!data) {
            toast('Order real TIDAK dikirim — hubungkan akun MT5 di Profil → Broker MT5.', 'error', 9000);
            return;
        }
        toast(data.message || 'Order masuk antrean.', 'success');
        if (typeof loadLiveExecution === 'function') { try { loadLiveExecution(); } catch (e) {} }
    } catch (e) {
        toast(e?.message || 'Order real ditolak server.', 'error');
    } finally {
        ptSetBukaJalan(false);
    }
}

function ptOpenPosition() {
    const sym   = document.getElementById('ptSymbol')?.value;
    const side  = document.getElementById('ptSide')?.value === 'SELL' ? 'SELL' : 'BUY';
    const lots  = parseFloat(document.getElementById('ptLots')?.value);
    const sl    = parseFloat(document.getElementById('ptSL')?.value) || null;
    const tp    = parseFloat(document.getElementById('ptTP')?.value) || null;

    if (!sym) return;
    // Dulu lot 0 / kosong berhenti diam-diam tanpa pesan apa pun.
    if (!Number.isFinite(lots) || lots < 0.01 || lots > 100) { showQuantumToast('Lot harus 0,01–100.', 'warning'); return; }

    // Akun real tidak pernah menyentuh _ptPositions: posisinya hidup di terminal MT5, dan statusnya dibaca
    // dari panel Eksekusi Real. Harga, SL/TP, dan akun tujuan diperiksa ptKirimOrderReal dengan harga SEGAR.
    if (ptAkunAktif() === 'real') { ptKirimOrderReal({ symbol: sym, side, lots, sl, tp }); return; }

    // Order pasar: harga yang dipakai adalah harga SISI order (ask untuk BUY, bid untuk SELL) — sama
    // dengan yang tampil di kolom "Harga eksekusi". Kolom itu tidak bisa diketik lagi.
    const harga = ptHargaNilai(sym, side === 'BUY');
    if (!harga) {
        showQuantumToast(`Harga ${sym} belum segar — order tidak dikirim. Tunggu kolom "Harga eksekusi" terisi.`, 'warning', 6000);
        try { ptUpdateLivePrice(); } catch (e) {}
        return;
    }
    const alasan = ptCekSlTp(side, harga, sl, tp);
    if (alasan) { showQuantumToast(alasan + ' Order tidak dikirim.', 'warning', 6000); return; }

    // Server mengeksekusi di harga pasarnya sendiri; harga ini hanya batas requote.
    ptOpenDirectPosition(sym, side, harga, sl, tp, lots, 'form');
}

/** Kunci idempotensi order (≤ 40 karakter). Klik ganda atau kirim ulang setelah jaringan putus
 *  memakai kunci yang sama, sehingga server tidak membuka dua posisi untuk satu niat order. */
function ptIdOrder() {
    try {
        const c = window.crypto;
        if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    } catch (e) {}
    return 'qi-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

/**
 * Penolakan server → pesan yang dimengerti pengguna. Pesan server (Bahasa Indonesia) ditampilkan apa
 * adanya; `kode` hanya menentukan nada dan petunjuk tambahan.
 */
function ptTanganiTolak(data, status, muatan) {
    const kode = data && data.kode;
    let pesan = (data && data.message) || ('Server menolak order (HTTP ' + status + ').');
    let jenis = 'warning';
    if (status === 410 || kode === 'batas_rugi_harian') jenis = 'error';
    else if (kode === 'pasar_tutup') jenis = 'info';
    else if (kode === 'margin' && !/lot|tutup/i.test(pesan)) pesan += ' Kurangi lot atau tutup sebagian posisi lebih dulu.';
    if (typeof showQuantumToast === 'function') showQuantumToast(pesan, jenis, 7000);
    // Order dari Quick Trade: alasannya tetap tertulis di kartu setelah toast hilang.
    if (muatan && muatan.asal === 'quick') {
        QT.pesan = { teks: 'Order ditolak: ' + pesan, sampai: Date.now() + 15000 };
        try { qtHitung(); } catch (e) {}
    }
    // Requote: tampilkan harga terbaru supaya pengguna bisa menilai ulang sebelum menekan lagi.
    if (kode === 'requote' && muatan && muatan.symbol) {
        ptSegarkanHarga(muatan.symbol).then(() => { try { qtSegarkan(); ptUpdateLivePrice(); } catch (e) {} });
    }
}

/**
 * Satu permintaan order ke api/paper-trading.php ({aksi: buka | tutup | ubah}).
 *
 * Dulu klien menyimpan SNAPSHOT seluruh daftar posisi, dan server membatalkan posisi yang
 * tidak ikut terkirim. Satu GET yang gagal atau dua tab terbuka (dashboard + arena) cukup
 * untuk menghapus posisi diam-diam — direproduksi 2026-10-22. Sekarang tiap order adalah
 * satu aksi, harganya ditentukan server, dan daftar posisi selalu dimuat ulang dari server.
 */
async function ptAksi(muatan) {
    const kirim = () => fetch('api/paper-trading.php', {
        method: 'POST',
        headers: (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' },
        body: JSON.stringify(muatan),
    });
    let res = null, diulang = false;
    try {
        res = await kirim();
    } catch (e) {
        // Jaringan putus: permintaan bisa saja SUDAH sampai di server. Order baru membawa client_order_id,
        // jadi aman dikirim sekali lagi — server mengembalikan posisi yang sama (duplikat), bukan posisi kedua.
        if (muatan && muatan.client_order_id) {
            await new Promise((r) => setTimeout(r, 800));
            diulang = true;
            try { res = await kirim(); } catch (e2) { res = null; }
        }
    }
    if (!res) {
        await ptStatusBelumPasti(muatan, 'Server paper trading tidak terjangkau');
        return null;
    }
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.status === 'success') {
        // Hasil yang DIKONFIRMASI server langsung diterapkan; muat ulang sesudahnya hanya menyelaraskan.
        ptTerapkanHasil(muatan, data);
        await ptLoadFromServer();
        return data;
    }
    // Jawaban yang tidak memastikan apa pun bukan "ditolak": 5xx / halaman galat gateway Hostinger (bukan
    // JSON) / 2xx tanpa status sukses — INSERT-nya bisa sudah tersimpan sebelum galat; atau 429 "masih
    // diproses" pada kiriman ULANG — kiriman pertama sedang (atau sudah) membuka posisinya. Dulu semuanya
    // dilaporkan "Order ditolak", padahal posisinya bisa sudah ada dan baru terlihat 20 detik kemudian.
    if (res.status >= 500 || res.ok || !data || (res.status === 429 && diulang)) {
        await ptStatusBelumPasti(muatan, 'Jawaban server tidak jelas (HTTP ' + res.status + ')');
        return null;
    }
    // 'tutup' / 'ubah' pada posisi yang SUDAH ditutup (409 tanpa kode — 409 ber-kode adalah penolakan harga):
    // biasanya SL/TP server menang lebih dulu (qi_paper_settle berjalan di awal setiap POST). Itu bukan
    // penolakan: muat ulang, dan penutupannya diumumkan SEKALI — oleh ptUmumkanTutupServer bila sebabnya dari
    // server, atau di sini bila ditutup manual di tab lain. Dulu muncul dua toast untuk satu kejadian, yang
    // pertama bergaya penolakan.
    if ((muatan.aksi === 'tutup' || muatan.aksi === 'ubah') && res.status === 409 && !data.kode) {
        try { await ptLoadFromServer(); } catch (e) {}
        const h = _ptHistory.find((x) => x.id === muatan.id);
        if (h) {
            if (!_ptTutupDiumumkan.has(h.id)) {
                _ptTutupDiumumkan.add(h.id);
                if (typeof showQuantumToast === 'function') showQuantumToast(`Posisi ${h.side} ${h.symbol} sudah ditutup sebelumnya @ ${h.closePrice} · ${ptUang(h.pnl)}`, 'info', 7000);
            }
            return null;
        }
        ptTanganiTolak(data, res.status, muatan);
        return null;
    }
    ptTanganiTolak(data, res.status, muatan);
    if (res.status === 404) await ptLoadFromServer();
    return null;
}

/**
 * Status permintaan tidak bisa dipastikan (jaringan putus, 5xx, 429 pada kiriman ulang): katakan itu, muat
 * ulang daftar posisi, dan — bila ternyata posisinya sudah dibuka / ditutup — katakan juga. Muat ulang kedua
 * beberapa detik kemudian menangkap kiriman pertama yang masih diproses server.
 */
async function ptStatusBelumPasti(muatan, sebab) {
    const aksi = muatan && muatan.aksi;
    const apa = aksi === 'tutup' ? 'status penutupan' : (aksi === 'ubah' ? 'status perubahan SL/TP' : 'status order');
    if (typeof showQuantumToast === 'function') showQuantumToast(`${sebab} — ${apa} belum pasti. Daftar posisi dimuat ulang untuk memastikan.`, 'error', 8000);
    if (muatan && muatan.asal === 'quick') {
        QT.pesan = { teks: 'Status order belum pasti — periksa daftar posisi di bawah.', sampai: Date.now() + 15000 };
        try { qtHitung(); } catch (e) {}
    }
    const sebelum = new Set((_ptPositions || []).map((p) => p.id));
    try { await ptLoadFromServer(); } catch (e) {}
    try {
        if (aksi === 'buka') {
            const baru = _ptPositions.find((p) => !sebelum.has(p.id) && p.symbol === muatan.symbol && p.side === muatan.side
                && Math.abs(Number(p.lots) - Number(muatan.lots)) < 1e-9 && (!p.src || p.src === 'manual'));
            if (baru && typeof showQuantumToast === 'function') showQuantumToast(`Ternyata posisi sudah dibuka server: ${baru.side} ${baru.symbol} ${baru.lots} lot @ ${baru.entryPrice}.`, 'info', 8000);
        } else if (aksi === 'tutup') {
            const h = _ptHistory.find((x) => x.id === muatan.id);
            if (h && !_ptTutupDiumumkan.has(h.id)) {
                _ptTutupDiumumkan.add(h.id);
                if (typeof showQuantumToast === 'function') showQuantumToast(`Ternyata posisi ${h.side} ${h.symbol} sudah ditutup @ ${h.closePrice} · ${ptUang(h.pnl)}`, 'info', 8000);
            }
        }
    } catch (e) {}
    setTimeout(() => { try { ptLoadFromServer(); } catch (e) {} }, 5000);
}

/** Baris posisi dari server → bentuk yang dipakai klien. */
function ptBarisPosisi(p) {
    return {
        id: p.id,
        symbol: p.symbol, side: p.side, lots: p.lots,
        entryPrice: p.entryPrice, sl: p.sl ?? null, tp: p.tp ?? null,
        // openedAt = ISO UTC dari server → jam lokal browser (jam H:i:s server memakai zona PHP)
        openTime: p.openedAt ? new Date(p.openedAt).toLocaleTimeString('id-ID') : (p.openTime || ''), openedAt: p.openedAt || null,
        src: p.src || 'manual',   // 'auto' = Ikuti Auto Analisa, 'ai' = AI Auto-Trade (dikelola server)
        kompPeriode: p.kompPeriode ?? null,
    };
}

/** Baris riwayat dari server → bentuk klien. Server membawa realizedPnL (bukan pnl) — keduanya diisi. */
function ptBarisRiwayat(h) {
    const pnl = Number(h.realizedPnL ?? h.pnl ?? 0) || 0;
    return { ...h, pnl, realizedPnL: pnl, closeTime: h.closedAt ? new Date(h.closedAt).toLocaleTimeString('id-ID') : (h.closeTime || ''), closeReason: h.closeReason ?? null };
}

/**
 * Terapkan jawaban sukses server ke state SEKARANG, sebelum muat ulang. Dulu hanya saldo yang diterapkan:
 * bila GET sesudahnya gagal (mis. 429 — api/paper-trading.php dibatasi 60/menit per IP), saldo sudah
 * memuat P/L posisi yang ditutup tetapi posisinya masih terdaftar dengan tombol Tutup aktif, dan kartu
 * Simulation menghitung P/L-nya DUA kali (saldo + mengambang). Semua yang diterapkan di sini datang dari
 * jawaban server, bukan perkiraan klien.
 */
function ptTerapkanHasil(muatan, data) {
    if (typeof data.balance === 'number') _ptBalance = data.balance;
    const aksi = muatan && muatan.aksi;
    if (aksi === 'buka' && data.posisi && data.posisi.id) {
        if (!_ptPositions.some((p) => p.id === data.posisi.id)) _ptPositions.push(ptBarisPosisi(data.posisi));
    } else if (aksi === 'tutup' && data.ditutup && data.ditutup.id) {
        _ptPositions = _ptPositions.filter((p) => p.id !== data.ditutup.id);
        if (!_ptHistory.some((h) => h.id === data.ditutup.id)) _ptHistory.unshift(ptBarisRiwayat(data.ditutup));
        _ptRealized = _ptHistory.reduce((s, h) => s + h.pnl, 0);
    } else if (aksi === 'ubah' && data.posisi && data.posisi.id) {
        const p = _ptPositions.find((x) => x.id === data.posisi.id);
        if (p) { p.sl = data.posisi.sl ?? null; p.tp = data.posisi.tp ?? null; }
    }
    try { ptRender(); } catch (e) {}
}

/** Segarkan harga feed tampilan (api/live-price.php) untuk satu simbol. */
async function ptSegarkanHargaLive(sym) {
    try {
        const r = await fetch('api/live-price.php?symbols=' + encodeURIComponent(sym), {
            headers: (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders() : {}, cache: 'no-store',
        });
        const j = await r.json();
        const p = j && j.prices && j.prices[sym];
        // Objeknya DIGANTI utuh (bukan digabung ke yang lama): bid/ask lama tidak boleh menempel pada
        // harga baru yang mungkin datang dari sumber lain tanpa bid/ask.
        if (p && parseFloat(p.price) > 0) { _lastPrices[sym] = p; _qiHargaWaktu[sym] = Date.now(); }
        return p || null;
    } catch (e) { return null; }
}

/**
 * Segarkan harga simbol tepat sebelum order / penutupan: feed tampilan (live-price — order REAL dan simbol
 * di luar feed kanonik) dan, untuk paper, kutipan KANONIK — feed yang benar-benar mengisi order di server.
 * (Komentar lama di sini menyebut live-price menulis cache harga eksekusi server; itu tidak berlaku lagi
 * sejak order paper diisi dari qi_komp_acuan, api/_paper_order.php.) opsi.kanonik === false → live saja.
 */
async function ptSegarkanHarga(sym, opsi) {
    const kanonik = !(opsi && opsi.kanonik === false) && _ptKanonik[sym] !== false && qiTingkatSaatIni() >= 1;
    const [p] = await Promise.all([ptSegarkanHargaLive(sym), kanonik ? ptMuatKutipan([sym]) : null]);
    return p;
}

/**
 * Harga sisi order untuk BATAS REQUOTE yang dikirim ke server: harga paper yang dilihat pengguna (BUY di
 * ask, SELL di bid). Bila kutipan kanonik sedang basi, harga live-price yang segar masih layak sebagai batas
 * (toleransi requote server 0,5%, selisih antar-feed jauh di bawahnya) — server tetap yang menentukan harga.
 */
function ptHargaSisi(sym, sisiBeli) {
    return ptHargaNilai(sym, sisiBeli) ?? ptHargaLive(sym, sisiBeli);
}

const _ptSedangOrder = new Set();

/**
 * Buka posisi simulasi lewat server. Dipakai Quick Trade (asal 'quick'), formulir panel Paper Trading
 * ('form'), tombol "⚡ Trade Paper" & "Eksekusi Setup AI" ('sinyal').
 * `entry` = harga yang dilihat pengguna saat menekan tombol (batas requote); null = harga sisi saat ini.
 * @return {Promise<object|null>} jawaban server bila posisi dibuka, null bila tidak.
 */
async function ptOpenDirectPosition(sym, side, entry, sl, tp, lots = 0.1, asal = 'sinyal') {
    sym = (sym || '').toUpperCase();
    side = (side || '').toUpperCase();
    if (!sym || (side !== 'BUY' && side !== 'SELL')) return null;
    const toast = (pesan, jenis, ms) => { if (typeof showQuantumToast === 'function') showQuantumToast(pesan, jenis, ms); };
    if (qiTingkatSaatIni() < 1) { toast('Paper trading tersedia untuk paket PRO ke atas.', 'info'); return null; }
    if (_ptBukaJalan) { toast('Order sebelumnya masih diproses — tunggu sebentar.', 'info'); return null; }
    if (Array.isArray(_ptSimbol) && _ptSimbol.length && !_ptSimbol.includes(sym)) {
        toast(sym + ' belum didukung paper trading. Simbol yang didukung: ' + _ptSimbol.join(', ') + '.', 'warning', 7000);
        return null;
    }
    const jumlah = parseFloat(lots ?? 0.1);
    if (!Number.isFinite(jumlah) || jumlah < 0.01 || jumlah > 100) { toast('Lot harus 0,01–100.', 'warning'); return null; }
    const angka = (v) => (v !== null && v !== undefined && v !== '' && Number(v) > 0) ? Number(v) : null;
    const slN = angka(sl), tpN = angka(tp), entryN = angka(entry);
    ptSetBukaJalan(true);
    try {
        await ptSegarkanHarga(sym);
        const harga = ptHargaSisi(sym, side === 'BUY') || entryN;
        if (!harga) { toast('Tunggu harga live ' + sym + ' termuat.', 'warning'); return null; }
        // SL/TP diperiksa terhadap harga sisi order SAAT INI — termasuk SL/TP setup sinyal yang mungkin
        // sudah terlewati harga sejak setup itu dibuat.
        const alasan = ptCekSlTp(side, harga, slN, tpN);
        if (alasan) { toast(alasan + ' Order tidak dikirim.', 'warning', 6000); return null; }
        const muatan = {
            aksi: 'buka', symbol: sym, side, lots: jumlah, sl: slN, tp: tpN,
            // Batas requote: harga yang DILIHAT pengguna (Quick Trade / formulir), atau harga sisi saat
            // ini bila pemanggil tidak menyebutnya (Trade Paper: entry setup bukan harga di layar).
            harga: entryN || harga,
            client_order_id: ptIdOrder(),
        };
        if (['tiket', 'quick', 'form', 'sinyal'].includes(asal)) muatan.asal = asal;
        const hasil = await ptAksi(muatan);
        if (hasil && hasil.posisi) {
            toast(`✓ Posisi simulasi dibuka: ${side} ${sym} ${jumlah} lot @ ${hasil.posisi.entryPrice}`, 'success');
            if (asal === 'quick') QT.pesan = null;
        }
        return hasil;
    } finally {
        ptSetBukaJalan(false);
    }
}
window.ptOpenDirectPosition = ptOpenDirectPosition;

/** Tombol Tutup posisi `id` (Quick Trade & tabel panel Paper Trading): nonaktif + "Menutup…" selama
 *  permintaannya berjalan. Dulu tetap bisa diklik, dan klik berikutnya diabaikan diam-diam. */
function ptTandaiTombolTutup(id, on) {
    try {
        document.querySelectorAll(`[data-tutup-id="${ptCssId(id)}"]`).forEach((b) => {
            b.disabled = !!on;
            if (b.setAttribute) b.setAttribute('aria-busy', on ? 'true' : 'false');
            b.textContent = on ? 'Menutup…' : 'Tutup';
        });
    } catch (e) {}
}

/** id posisi yang penutupannya sudah diumumkan (oleh tab ini atau dari sebab server) — tidak diulang. */
const _ptTutupDiumumkan = new Set();

/**
 * Tutup posisi manual di harga pasar server (tombol Tutup). SL/TP TIDAK lewat sini: server yang
 * menyelesaikannya di feed eksekusinya (lihat ptMintaPenyelesaianServer).
 * @return {Promise<object|null>} jawaban server bila ditutup, null bila tidak.
 */
async function ptClosePosition(id) {
    const p = _ptPositions.find(x => x.id === id);
    if (!p) return null;
    if (p.src && p.src !== 'manual') {
        if (typeof showQuantumToast === 'function') showQuantumToast('Posisi otomatis dikelola server dan tidak ditutup dari sini.', 'info');
        return null;
    }
    if (_ptSedangOrder.has(id)) return null;   // klik ganda / auto-exit + klik bersamaan
    _ptSedangOrder.add(id);
    ptTandaiTombolTutup(id, true);
    try {
        await ptSegarkanHarga(p.symbol);
        // Menutup BUY = menjual di bid; menutup SELL = membeli di ask. Harga ini hanya batas requote —
        // server yang menentukan harga tutup. Tanpa harga segar dari feed mana pun permintaan tidak dikirim.
        const harga = ptHargaSisi(p.symbol, p.side !== 'BUY');
        if (!harga) {
            if (typeof showQuantumToast === 'function') showQuantumToast(ptAlasanTanpaHarga(p.symbol) + ' — posisi belum ditutup. Coba lagi sebentar.', 'warning');
            return null;
        }
        const hasil = await ptAksi({ aksi: 'tutup', id, harga });
        if (hasil && hasil.ditutup) {
            _ptTutupDiumumkan.add(id);
            const pnl = Number(hasil.ditutup.realizedPnL) || 0;
            if (typeof showQuantumToast === 'function') {
                showQuantumToast(`Posisi ${p.side} ${p.symbol} ditutup @ ${hasil.ditutup.closePrice} · ${ptUang(pnl)}`, pnl >= 0 ? 'success' : 'info');
            }
        }
        return hasil;
    } finally {
        _ptSedangOrder.delete(id);
        ptTandaiTombolTutup(id, false);
    }
}

/** Ubah SL/TP satu posisi (mis. break-even / trailing dari qim-trading-tools.js). */
async function ptUbahSlTp(id, sl, tp) {
    const p = _ptPositions.find(x => x.id === id);
    if (!p || (p.src && p.src !== 'manual')) return null;
    return ptAksi({ aksi: 'ubah', id, sl: sl || null, tp: tp || null });
}
window.ptUbahSlTp = ptUbahSlTp;

/** Tombol "↺ Update P&L": harga & posisi diambil ulang, bukan sekadar menggambar angka lama. */
function ptRefreshPnL() {
    try { fetchMarketData(); } catch (e) {}
    return ptLoadFromServer();
}

/** Simbol yang didukung server (GET → data.symbols); kosong = belum diketahui. */
let _ptSimbol = [];
/** true bila muat terakhir gagal — daftar posisi di layar mungkin tidak lengkap. */
let _ptMuatGagal = false;
/** data.kompetisi dari server (periode berjalan) bila ada. */
let _ptKompetisi = null;
/** Muat yang sedang berjalan (Promise) — muat berkala & muat sesudah order tidak saling tumpuk. */
let _ptMemuat = null;
/** Waktu percobaan muat terakhir (ms), berhasil atau gagal — jarak antar muat berkala. */
let _ptDicobaPada = 0;
/** id posisi terbuka pada muat sukses terakhir; null = belum pernah (muat pertama tidak mengumumkan apa pun). */
let _ptIdTerbukaLama = null;
const PT_SEGAR_MS = 20000;

/**
 * Posisi yang tadinya terbuka dan kini ada di riwayat dengan sebab dari SERVER (SL/TP/stop out/akhir
 * periode) diumumkan sekali. Dulu satu-satunya kabar "SL tersentuh" datang dari pengaman di klien —
 * diucapkan SEBELUM penutupannya berhasil.
 */
function ptUmumkanTutupServer(lama, riwayat) {
    if (!lama || typeof showQuantumToast !== 'function') return;
    const baru = (riwayat || []).filter(h => h && lama.has(h.id) && !_ptTutupDiumumkan.has(h.id)
        && h.closeReason && h.closeReason !== 'manual' && PT_SEBAB_TUTUP[h.closeReason]);
    baru.forEach(h => _ptTutupDiumumkan.add(h.id));
    if (baru.length > 3) {
        const total = baru.reduce((s, h) => s + (Number(h.realizedPnL) || 0), 0);
        showQuantumToast(`${baru.length} posisi ditutup server (SL/TP/akhir periode) · total ${ptUang(total)} — lihat Riwayat.`, 'info', 8000);
        return;
    }
    for (const h of baru) {
        const pnl = Number(h.realizedPnL) || 0;
        showQuantumToast(`${PT_SEBAB_TUTUP[h.closeReason].judul} — ${h.side} ${h.symbol} ${Number(h.lots).toFixed(2)} lot ditutup server @ ${h.closePrice} · ${ptUang(pnl)}`,
            h.closeReason === 'tp' ? 'success' : (pnl >= 0 ? 'info' : 'warning'), 8000);
    }
}

async function ptMuatStateInti() {
    if (qiTingkatSaatIni() < 1) { ptRender(); return false; }   // paket FREE: server menjawab 403
    try {
        const res = await fetch('api/paper-trading.php', { headers: (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders() : {}, cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || data.status !== 'success' || !data.data) throw new Error((data && data.message) || 'status ' + (data && data.status));
        const lama = _ptIdTerbukaLama;
        _ptBalance   = Number(data.data.balance ?? 10000);
        if (Array.isArray(data.data.symbols)) _ptSimbol = data.data.symbols;
        _ptKompetisi = data.data.kompetisi || null;
        _ptPositions = (data.data.positions || []).map(ptBarisPosisi);
        _ptHistory  = (data.data.history || []).map(ptBarisRiwayat);
        _ptRealized = _ptHistory.reduce((s,h) => s + h.pnl, 0);
        ptUmumkanTutupServer(lama, _ptHistory);
        _ptIdTerbukaLama = new Set(_ptPositions.map(p => p.id));
        _ptDimuatPada = Date.now();
        _ptMuatGagal = false;
        return true;
    } catch (e) {
        // Daftar lama DIPERTAHANKAN (tidak dikosongkan) dan kegagalannya dikatakan — layar kosong
        // "Belum ada posisi" saat server tidak terjangkau adalah informasi yang salah.
        if (!_ptMuatGagal && typeof showQuantumToast === 'function') showQuantumToast('Posisi paper trading gagal dimuat — data di layar mungkin tidak terbaru.', 'warning', 6000);
        _ptMuatGagal = true;
        return false;
    } finally {
        try { ptRender(); } catch (e) {}
    }
}

/** Satu muat state paper; muat yang sedang berjalan dipakai bersama, bukan digandakan. */
function ptMuatState() {
    if (_ptMemuat) return _ptMemuat;
    _ptDicobaPada = Date.now();
    const janji = ptMuatStateInti();
    _ptMemuat = janji;
    const lepas = () => { if (_ptMemuat === janji) _ptMemuat = null; };
    janji.then(lepas, lepas);
    return janji;
}

/**
 * Muat berkala (tiap 20 detik) selama tab terlihat dan rail kanan (Quick Trade + Simulation Balance)
 * tampil. Panel Paper Trading punya penyegaran sendiri (QI_PANEL_SEGAR). Lewat ptMuatState — bukan
 * window.ptLoadFromServer yang dibungkus qim-batas-rugi.js — supaya tidak ikut memicu GET batas rugi
 * setiap 20 detik (meteran itu punya jadwal 45 detiknya sendiri).
 */
function ptMuatBerkala(awal) {
    if (qiTingkatSaatIni() < 1) return null;
    if (_ptMemuat) return _ptMemuat;
    if (!awal) {
        if (document.visibilityState !== 'visible') return null;
        if (Date.now() - _ptDicobaPada < PT_SEGAR_MS) return null;
        const rail = document.getElementById('qimRightPanel');
        if (rail && typeof rail.getClientRects === 'function' && !rail.getClientRects().length) return null;
    }
    return ptMuatState();
}

/** Muat ulang state paper dari server (setelah order, saat panel dibuka). Muat berkala yang sedang
 *  berjalan bisa saja dimulai SEBELUM order tercatat — ditunggu dulu, lalu dimuat sekali lagi. */
async function ptLoadFromServer() {
    if (_ptMemuat) { try { await _ptMemuat; } catch (e) {} }
    return ptMuatState();
}

/**
 * Pengaman posisi di klien (qim-trading-tools.js) melihat SL/TP tersentuh → minta SERVER menyelesaikannya.
 * Setiap GET api/paper-trading.php menjalankan qi_paper_settle: SL/TP diperiksa di feed eksekusi server
 * (bar M1 + kutipan kanonik) dan posisi ditutup DI SANA dengan sebab 'sl'/'tp', lalu ptUmumkanTutupServer
 * mengumumkannya sekali. Dulu pengaman mengirim 'tutup' biasa: posisi tercatat ditutup 'manual' di harga
 * pasar, pada level yang bisa saja tidak pernah disentuh feed server. Lewat ptMuatState (bukan
 * window.ptLoadFromServer yang dibungkus qim-batas-rugi.js) — tanpa GET batas rugi tambahan.
 */
async function ptMintaPenyelesaianServer() {
    if (_ptMemuat) { try { await _ptMemuat; } catch (e) {} }
    return ptMuatState();
}
window.ptMintaPenyelesaianServer = ptMintaPenyelesaianServer;

// ─── Akhir jalur order ─────────────────────────────────────────────────────
// Penanda penutup untuk tests/paper-sandbox.js: sandbox hanya menjalankan blok DI ATAS
// baris ini di dalam vm. Efek samping tingkat atas (pengatur waktu) ditaruh di bawahnya
// supaya tidak ikut berjalan saat pengujian.

// Quick Trade disegarkan tiap 5 detik: harga sisi beli/jual, saldo, dan posisi terbuka
// ikut bergerak tanpa pengguna menekan apa pun. Dulu menumpang pengatur waktu bersama di
// dashboard-app.js yang juga menyegarkan panel paper dan radar — keduanya sudah tidak ada.
setInterval(() => {
    try { qtSegarkan(); } catch (e) {}
}, 5000);
