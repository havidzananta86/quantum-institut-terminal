/* ═══════════════════════════════════════════════════════════════════════════
   ARENA KOMPETISI — halaman turnamen (kompetisi.html).

   MENGAPA DIPISAH DARI DASHBOARD
   Dashboard utama memuat 30+ panel, termasuk kendali otomatis. Arena ini sengaja TIDAK memuat
   satu pun kendali otomatis: hanya chart, tiket order manual, posisi, papan peringkat langsung,
   dan aktivitas para trader. Satu layar, satu aturan.

   DUA MODE (assets/js/halaman-kompetisi-gerbang.js → window.QI_KOMP_MODE)
     · 'trader'   (PRO/VIP/admin): tiket, posisi, ringkasan akun turnamen, chart.
     · 'penonton' (tanpa login / FREE): papan, aktivitas, laci trader, ajakan. Endpoint pribadi
       (api/paper-trading.php, api/competition.php?harga=) TIDAK dipanggil sama sekali.

   ATURAN YANG DITEGAKKAN SERVER (bukan hanya tampilan di sini)
     · Saldo simulasi $10.000 per periode; paper trading hanya PRO ke atas (qi_require_level('pro')).
     · Peringkat = EKUITAS langsung (10.000 + terealisasi + mengambang) dari posisi manual ber-
       komp_periode (api/_kompetisi_papan.php). Posisi bot tidak pernah masuk peringkat.
     · Harga isi order ditentukan server dari SATU feed kanonik (api/_kompetisi_harga.php); angka di
       tombol BUY/SELL datang dari feed yang sama (competition.php?harga=), jadi yang terlihat = yang mengisi.
     · SL/TP, stop-out margin, dan akhir periode diselesaikan server (api/_kompetisi_settle.php).
     · Tiap order = satu aksi {aksi:'buka'|'tutup'|'ubah'} dengan client_order_id (idempoten):
       klik ganda / kirim ulang tidak membuat posisi ganda, dan posisi tidak bisa "hilang".

   PERBAIKAN AUDIT KOMPETISI 2026-10-22 DI SISI INI
     · Toast sukses HANYA bila HTTP 200 + status 'success', memakai harga isi dari server.
     · Tombol order nonaktif selama permintaan berjalan; saldo tidak pernah diubah lokal.
     · Posisi dipoll tiap 10 dtk, papan tiap 5 dtk, harga tiap 4 dtk — berhenti saat tab tersembunyi.
     · Chart: token urutan permintaan (respons simbol lama dibuang), fitContent hanya saat simbol/TF
       berganti, candle terakhir bergerak dari harga live (series.update), M1/M30 tersedia.
     · SL/TP cepat dihitung untuk sisi yang DITEKAN (BUY dari ask, SELL dari bid) dengan satuan jelas.
     · Kartu ringkasan dari akun TURNAMEN (bukan saldo paper semua sumber).
   AUDIT G1
     · Editor SL/TP tidak lagi ditimpa polling posisi; "Simpan" mengirim angka yang diketik.
     · Posisi XAUUSD ditandai di seri harganya sendiri (emas nyata vs PROKSI PAXG + G posisi).
     · Posisi periode lalu: label "menunggu penutupan server", tanpa tombol Tutup/SL/TP.
     · Semua simbol posisi diminta harganya; tutup tanpa harga layar tetap dikirim (server menentukan harga).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const SALDO_AWAL = 10000;          // HARUS sama dengan $STARTING_BALANCE di api/paper-trading.php
    const SIMBOL = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAGUSD', 'US30', 'NAS100'];
    const TF = [
        { label: 'M1', nilai: '1', dtk: 60 }, { label: 'M5', nilai: '5', dtk: 300 }, { label: 'M15', nilai: '15', dtk: 900 },
        { label: 'M30', nilai: '30', dtk: 1800 }, { label: 'H1', nilai: '60', dtk: 3600 }, { label: 'H4', nilai: '240', dtk: 14400 },
        { label: 'D1', nilai: 'D', dtk: 86400 },
    ];
    // Termasuk simbol paper di luar tiket arena: posisi turnamen dari Quick Trade (BNBUSDT, AUDUSD, USOIL…)
    // tetap tampil dengan desimal yang benar.
    const DESIMAL = { XAUUSD: 2, XAGUSD: 3, EURUSD: 5, GBPUSD: 5, USDJPY: 3, BTCUSDT: 2, ETHUSDT: 2, SOLUSDT: 3, US30: 1, NAS100: 1,
        BNBUSDT: 2, XRPUSDT: 4, DOGEUSDT: 5, AUDUSD: 5, NZDUSD: 5, USDCHF: 5, USDCAD: 5, USOIL: 2, SPX500: 1, GER40: 1, UK100: 1, JP225: 0 };
    /** Satuan jarak SL/TP per simbol: label, ukuran 1 satuan dalam harga, dan preset tombol cepat. */
    const SATUAN = {
        XAUUSD: { label: '$', ukuran: 1, preset: [2, 5, 10] },
        XAGUSD: { label: '$', ukuran: 1, preset: [0.1, 0.25, 0.5] },
        EURUSD: { label: 'pip', ukuran: 0.0001, preset: [10, 20, 50] },
        GBPUSD: { label: 'pip', ukuran: 0.0001, preset: [10, 20, 50] },
        USDJPY: { label: 'pip', ukuran: 0.01, preset: [10, 20, 50] },
        BTCUSDT: { label: '$', ukuran: 1, preset: [100, 250, 500] },
        ETHUSDT: { label: '$', ukuran: 1, preset: [10, 25, 50] },
        SOLUSDT: { label: '$', ukuran: 1, preset: [0.5, 1, 2] },
        US30: { label: 'poin', ukuran: 1, preset: [25, 50, 100] },
        NAS100: { label: 'poin', ukuran: 1, preset: [20, 50, 100] },
    };
    const NAMA_SUMBER = { mt5_bridge: 'MT5 broker', oanda_tv: 'OANDA', binance: 'Binance', binance_paxg: 'PROKSI PAXG (Binance)', binance_paxg_selaras: 'PROKSI PAXG + selisih ke emas', twelvedata: 'Twelve Data', twelvedata_cache: 'Twelve Data' };
    /** XAUUSD punya dua seri level harga (server: qi_komp_keluarga_level). */
    const SERI_EMAS = ['mt5_bridge', 'oanda_tv'];
    const SERI_PROKSI = ['binance_paxg', 'binance_paxg_selaras'];
    /** Sumber candle (get-chart-data.php) ↔ sumber kutipan kanonik: candle hanya digerakkan harga dari feed yang sama. */
    const CANDLE_KE_KUTIPAN = { mt5: 'mt5_bridge', oanda_tv: 'oanda_tv', binance: 'binance', binance_paxg: 'binance_paxg' };
    const ALASAN = { sl: 'kena SL', tp: 'kena TP', stopout: 'stop-out', period_end: 'akhir periode', manual: '' };
    const JEDA = { harga: 4000, papan: 5000, posisi: 10000, candle: 60000, laci: 10000 };

    const st = {
        mode: 'penonton',
        simbol: 'XAUUSD',
        tf: '60',
        kutipan: {},          // { SIM: kutipan kanonik | null } dari competition.php?harga=
        kutipanDiambil: 0,    // Date.now() saat kutipan diterima
        umurMaksIsi: 10,
        posisi: [],           // posisi terbuka manual milik saya
        otomatis: [],
        komp: null,           // data.kompetisi dari api/paper-trading.php (akun turnamen)
        turnamen: null,
        sayaMinggu: null,
        selisihJam: 0,        // jam server − jam peramban (ms)
        chart: null, seri: null, garis: [],
        candleTerakhir: [], sumberCandle: '', candleKunci: '', seqCandle: 0,
        sedangOrder: false,
        sibuk: {},
        laciKode: null, laciFokusAsal: null,
        ubahId: null,
        ubahDraf: null,       // { sl, tp } yang sedang diketik — bertahan melewati polling posisi 10 dtk
    };

    const dp = (sym) => DESIMAL[sym] ?? 2;
    const fmtHarga = (sym, n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp(sym), maximumFractionDigits: dp(sym) });
    const fmtUsd = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUsdTanda = (n) => (Number(n) >= 0 ? '+' : '-') + '$' + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPersen = (n) => (Number(n) >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%';
    const kelasArah = (n) => (Number(n) > 0 ? 'naik' : Number(n) < 0 ? 'turun' : '');
    const terlihat = () => document.visibilityState !== 'hidden';
    const trader = () => st.mode === 'trader';

    function waktuLalu(ts) {
        if (!ts) return '—';
        const d = Math.max(0, Math.round((Date.now() + st.selisihJam) / 1000 - Number(ts)));
        if (d < 10) return 'baru saja';
        if (d < 60) return d + ' dtk lalu';
        if (d < 3600) return Math.floor(d / 60) + ' mnt lalu';
        if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
        return Math.floor(d / 86400) + ' hari lalu';
    }

    function toast(pesan, jenis) {
        const el = $('kompToast');
        if (!el) return;
        el.textContent = pesan;               // textContent: tanpa esc() (dulu tampil "&amp;" mentah)
        el.className = 'komp-toast ' + (jenis || 'info');
        el.classList.remove('hidden');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => el.classList.add('hidden'), 5000);
    }

    function token() {
        try {
            return (window.QuantumAuth && QuantumAuth.getToken && QuantumAuth.getToken())
                || localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token') || null;
        } catch (e) { return null; }
    }
    const authHeaders = (extra) => {
        const h = Object.assign({}, extra || {});
        const t = token();
        if (t) h.Authorization = 'Bearer ' + t;
        return h;
    };

    /** Pengali P/L — satu model dengan server (api/_paper_math.php) lewat qim-paper-math.js. */
    const pengali = (sym, harga) => (typeof window.qimPaperMult === 'function' ? window.qimPaperMult(sym, harga) : 1000);

    function pnlPosisi(p, hargaKini) {
        const h = Number(hargaKini);
        if (!Number.isFinite(h) || h <= 0) return null;   // tanpa harga, P/L TIDAK ditebak
        const selisih = p.side === 'BUY' ? h - p.entryPrice : p.entryPrice - h;
        return Math.round(selisih * p.lots * pengali(p.symbol, h) * 100) / 100;
    }

    /** Umur kutipan sekarang (detik) = umur saat diterima + waktu sejak diterima. */
    function umurKutipan(q) {
        if (!q) return Infinity;
        return Number(q.umur || 0) + (Date.now() - st.kutipanDiambil) / 1000;
    }
    /**
     * Kutipan DI SERI POSISI — sama dengan qi_komp_kutipan_posisi() di server (audit G1): posisi XAUUSD
     * yang diisi di emas nyata tidak ditandai di PROKSI PAXG (null = tanpa harga, P/L tidak ditebak), dan
     * posisi proksi ditandai di PAXG mentah + selisih G MILIKNYA sendiri (hargaGeser), bukan G hari ini.
     */
    function kutipanPosisi(p) {
        const q = st.kutipan[p.symbol];
        if (!q || p.symbol !== 'XAUUSD' || !p.hargaSumber) return q || null;
        if (SERI_EMAS.includes(p.hargaSumber)) return SERI_EMAS.includes(q.source) ? q : null;
        if (!SERI_PROKSI.includes(p.hargaSumber)) return q;
        const x = q.proksi;
        if (!x || !(Number(x.price) > 0)) return null;
        const g = Number(p.hargaGeser) || 0;
        const tambah = (v) => (v != null && Number(v) > 0 ? Math.round((Number(v) + g) * 1000) / 1000 : null);
        return { price: tambah(x.price), bid: tambah(x.bid), ask: tambah(x.ask), market: x.market ?? null, umur: x.umur ?? q.umur, source: q.source };
    }
    /** Harga sisi PENUTUP posisi (BUY → bid, SELL → ask) dari feed kanonik; null bila tidak ada / basi. */
    function hargaTutup(p) {
        const q = kutipanPosisi(p);
        if (!q || (q.market !== 'closed' && umurKutipan(q) > 120)) return null;
        const v = p.side === 'BUY' ? (q.bid ?? q.price) : (q.ask ?? q.price);
        return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
    }
    /** Harga sisi buka: BUY di ask, SELL di bid — sama dengan yang dipakai server. */
    function hargaSisi(sym, beli) {
        const q = st.kutipan[sym];
        if (!q) return null;
        const v = beli ? (q.ask ?? q.price) : (q.bid ?? q.price);
        return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
    }

    // ── Mode ────────────────────────────────────────────────────────────────
    function modeTurun(alasan) {
        if (typeof window.qiKompSetMode === 'function') window.qiKompSetMode('penonton', alasan);
        else terapkanMode('penonton');
    }
    function terapkanMode(mode) {
        const baru = mode === 'trader' ? 'trader' : 'penonton';
        if (baru === st.mode && st.modeSiap) return;
        st.mode = baru;
        st.modeSiap = true;
        document.body.classList.toggle('komp-penonton', baru !== 'trader');
        if (baru === 'trader') {
            renderPemilih(); renderSatuan(); renderTiket(); renderRingkas();
            muatPosisi(); muatHarga();
            if (window._lwModules) muatCandle();
            else window.addEventListener('lc-modules-ready', () => muatCandle(), { once: true });
        } else {
            st.posisi = []; st.komp = null; st.kutipan = {};
        }
        muatPapan();
    }

    // ── Pemuat data ─────────────────────────────────────────────────────────
    async function sekali(nama, fn) {
        if (st.sibuk[nama]) return;
        st.sibuk[nama] = true;
        try { await fn(); } finally { st.sibuk[nama] = false; }
    }

    function muatPosisi() {
        if (!trader()) return Promise.resolve();
        return sekali('posisi', async () => {
            try {
                const r = await fetch('api/paper-trading.php', { headers: authHeaders(), cache: 'no-store' });
                if (r.status === 401) { modeTurun('sesi'); return; }
                if (r.status === 403) { modeTurun('free'); return; }
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const d = await r.json();
                const data = d.data || d;
                // Posisi otomatis (src 'ai'/'auto') DITAMPILKAN terpisah, tidak bisa ditutup dari sini,
                // dan memang tidak dihitung papan peringkat.
                const semua = Array.isArray(data.positions) ? data.positions : [];
                st.posisi = semua.filter((p) => (p.src || 'manual') === 'manual');
                st.otomatis = semua.filter((p) => (p.src || 'manual') !== 'manual');
                st.komp = data.kompetisi || null;
                const w = $('kompPosisiWaktu');
                if (w) w.textContent = 'diperbarui ' + new Date().toLocaleTimeString('id-ID');
            } catch (e) {
                // Daftar lama dipertahankan; kegagalannya dikatakan, bukan dikosongkan diam-diam.
                const w = $('kompPosisiWaktu');
                if (w) w.textContent = 'gagal memuat (' + e.message + ') — daftar mungkin tidak terbaru';
            }
            renderPosisi();
            renderRingkas();
            renderTiket();
        });
    }

    function muatHarga() {
        if (!trader()) return Promise.resolve();
        return sekali('harga', async () => {
            // Simbol tiket + SEMUA simbol posisi saya (server melayani seluruh simbol paper — audit G1: posisi
            // turnamen di luar 10 simbol arena dulu tidak pernah punya harga di sini).
            const syms = [...new Set([st.simbol, ...st.posisi.map((p) => p.symbol)])].filter((s) => /^[A-Z0-9]{3,12}$/.test(String(s)));
            try {
                const r = await fetch('api/competition.php?harga=' + encodeURIComponent(syms.join(',')), { headers: authHeaders(), cache: 'no-store' });
                if (r.status === 401) { modeTurun('sesi'); return; }
                if (r.status === 403) { modeTurun('free'); return; }
                if (!r.ok) return;
                const d = await r.json();
                if (d.status !== 'success') return;
                st.kutipan = Object.assign({}, st.kutipan, d.kutipan || {});
                st.kutipanDiambil = Date.now();
                if (Number(d.umur_maks_isi) > 0) st.umurMaksIsi = Number(d.umur_maks_isi);
            } catch (e) { /* diam: kutipan lama tetap tampil, umurnya bertambah dan terlihat */ }
            renderHargaKepala();
            renderTiket();
            perbaruiSelPosisi();
            renderRingkas();
            perbaruiCandleTerakhir();
        });
    }

    function muatPapan() {
        return sekali('papan', async () => {
            const el = $('kompPapan');
            try {
                const r = await fetch('api/competition.php?papan=weekly&ringkas=1&batas=50', { headers: authHeaders(), cache: 'no-store' });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || d.status !== 'success') {
                    if (el && !el.dataset.terisi) el.innerHTML = '<tr><td colspan="9" class="komp-kosong">' + esc(d.message || 'Papan peringkat belum bisa dimuat.') + '</td></tr>';
                    return;
                }
                if (d.sekarang) st.selisihJam = new Date(d.sekarang).getTime() - Date.now();
                st.turnamen = d.turnamen || null;
                st.sayaMinggu = d.saya_minggu || null;
                renderTurnamen(d);
                renderPapan(d);
                renderFeed(d.aktivitas || []);
                renderRingkas();
            } catch (e) {
                if (el && !el.dataset.terisi) el.innerHTML = '<tr><td colspan="9" class="komp-kosong">Tidak dapat menghubungi server kompetisi.</td></tr>';
            }
        });
    }

    // ── Render: turnamen, papan, aktivitas ──────────────────────────────────
    function renderTurnamen(d) {
        const t = d.turnamen || {};
        const nama = $('kompTurnamen');
        if (nama) nama.textContent = t.nama || 'Turnamen';
        const per = $('kompPeriode');
        if (per && t.mulai && t.selesai) {
            const opsi = { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' };
            const a = new Date(t.mulai), b = new Date(new Date(t.selesai).getTime() - 1);
            per.textContent = 'Periode ' + (t.periode || '') + ' · ' + a.toLocaleDateString('id-ID', opsi) + ' – '
                + b.toLocaleDateString('id-ID', Object.assign({ year: 'numeric' }, opsi)) + ' (WIB)';
        }
        const hadiah = $('kompHadiah');
        if (hadiah) {
            hadiah.innerHTML = esc(fmtUsd(t.total_hadiah || 0).replace('.00', ''))
                + (t.hadiah_contoh ? '<span class="komp-contoh" title="Nilai hadiah belum ditetapkan admin — masih contoh">CONTOH</span>' : '');
        }
        const peserta = $('kompPeserta');
        if (peserta) peserta.textContent = (t.peserta ?? 0) + (t.trader != null ? ' · ' + t.trader + ' aktif' : '');
        const lev = $('kompChipLeverage');
        if (lev && t.leverage) lev.textContent = 'Leverage 1:' + t.leverage + ' · stop-out ' + (t.stopout_pct ?? 50) + '%';

        const saya = st.sayaMinggu;
        const teksRank = saya && saya.aktif ? '#' + saya.rank + ' dari ' + (saya.dari || '—') : (saya ? 'Belum trading' : '—');
        const chip = $('kompChipRank');
        if (chip) chip.textContent = trader() ? (saya ? teksRank : 'Belum ada posisi') : '—';
        const rank = $('kompRankSaya');
        if (rank) rank.textContent = saya ? teksRank : '—';
        const status = $('kompStatusDaftar');
        if (status) status.textContent = t.terdaftar ? '✓ Terdaftar ' + (t.periode || '') : 'otomatis terdaftar saat order pertama';
        const daftar = $('kompDaftar');
        if (daftar) {
            daftar.classList.toggle('hidden', !trader() || !!t.terdaftar);
            daftar.dataset.turnamen = t.kunci || 'weekly-championship';
        }
    }

    function renderPapan(d) {
        const el = $('kompPapan');
        if (!el) return;
        el.dataset.terisi = '1';
        const baris = (d.papan && d.papan.baris) || [];
        const waktu = $('kompPapanWaktu');
        if (waktu) waktu.textContent = d.papan && d.papan.dibangun ? 'dihitung ' + waktuLalu(d.papan.dibangun) : '';
        if (!baris.length) {
            el.innerHTML = '<tr><td colspan="9" class="komp-kosong">Belum ada peserta minggu ini. Order manual pertama anggota PRO/VIP otomatis mendaftarkannya.</td></tr>';
            return;
        }
        const row = (b) => {
            const medali = b.aktif && b.rank <= 3 ? ' m' + b.rank : '';
            const label = [
                b.saya ? '<span class="komp-lencana anda">ANDA</span>' : '',
                b.harga_basi ? '<span class="komp-lencana basi" title="Harga salah satu posisinya sedang basi — memakai tanda nyata terakhir'
                    + (b.tanpa_harga ? '; ' + b.tanpa_harga + ' posisi belum pernah punya harga dan tidak dihitung' : '') + '">⚠ harga basi</span>' : '',
                !b.aktif ? '<span class="komp-lencana luar">belum trading</span>' : '',
            ].join('');
            return '<tr data-kode="' + esc(b.kode) + '" tabindex="0" aria-label="Detail ' + esc(b.nama) + '" class="' + (b.saya ? 'saya ' : '') + (b.aktif && b.rank === 1 ? 'top1' : '') + '">'
                + '<td><span class="komp-medali' + medali + '">' + esc(b.rank) + '</span></td>'
                + '<td class="komp-nama">' + esc(b.nama) + (b.negara ? ' <small class="komp-kecil">' + esc(b.negara) + '</small>' : '') + label + '</td>'
                + '<td class="num">' + fmtUsd(b.equity) + '</td>'
                + '<td class="num ' + kelasArah(b.return_pct) + '">' + fmtPersen(b.return_pct) + '</td>'
                + '<td class="num ' + kelasArah(b.floating) + '">' + (b.open_count ? fmtUsdTanda(b.floating) : '—') + '</td>'
                + '<td class="num">' + (b.open_count || 0) + '</td>'
                + '<td class="num">' + (b.trades || 0) + '</td>'
                + '<td class="num">' + (b.trades ? b.win_rate + '%' : '—') + '</td>'
                + '<td class="num komp-kecil">' + waktuLalu(b.aktivitas_ts) + '</td></tr>';
        };
        let html = baris.map(row).join('');
        if (d.papan.saya_di_luar) html += '<tr><td colspan="9" class="komp-kosong" style="padding:2px">⋯</td></tr>' + row(d.papan.saya_di_luar);
        el.innerHTML = html;
    }

    function renderFeed(list) {
        const el = $('kompFeed');
        if (!el) return;
        if (!list.length) { el.innerHTML = '<li><span></span><p>Belum ada aktivitas minggu ini.</p></li>'; return; }
        el.innerHTML = list.map((k) => {
            const sisi = '<span class="komp-sisi ' + (k.side === 'BUY' ? 'buy' : 'sell') + '">' + esc(k.side) + '</span>';
            const siapa = '<button type="button" data-kode="' + esc(k.kode) + '">' + esc(k.nama) + '</button>';
            const lot = Number(k.lots).toFixed(2) + ' ' + esc(k.symbol) + ' @ ' + fmtHarga(k.symbol, k.harga);
            let teks, ikon;
            if (k.jenis === 'tutup') {
                const alasan = ALASAN[k.alasan || ''] || '';
                teks = siapa + ' menutup ' + sisi + ' ' + lot + ' · <b class="' + kelasArah(k.pnl) + '">' + fmtUsdTanda(k.pnl) + '</b>' + (alasan ? ' <small>(' + esc(alasan) + ')</small>' : '');
                ikon = '<span class="ikon tutup" aria-hidden="true">✓</span>';
            } else {
                teks = siapa + ' membuka ' + sisi + ' ' + lot;
                ikon = '<span class="ikon ' + (k.side === 'BUY' ? 'buka-buy' : 'buka-sell') + '" aria-hidden="true">' + (k.side === 'BUY' ? '↗' : '↘') + '</span>';
            }
            return '<li>' + ikon + '<div><p>' + teks + '</p><small>' + waktuLalu(k.ts) + '</small></div></li>';
        }).join('');
    }

    function renderHitung() {
        const el = $('kompHitung');
        const t = st.turnamen;
        if (!el || !t || !t.selesai) return;
        let sisa = Math.max(0, Math.floor((new Date(t.selesai).getTime() - (Date.now() + st.selisihJam)) / 1000));
        const bagian = [Math.floor(sisa / 86400), Math.floor(sisa % 86400 / 3600), Math.floor(sisa % 3600 / 60), sisa % 60];
        const b = el.querySelectorAll('b');
        bagian.forEach((v, i) => { if (b[i]) b[i].textContent = String(v).padStart(2, '0'); });
        if (sisa === 0 && !renderHitung._selesai) { renderHitung._selesai = true; setTimeout(() => { renderHitung._selesai = false; muatPapan(); }, 5000); }
    }

    // ── Render: akun turnamen saya ──────────────────────────────────────────
    function renderRingkas() {
        const set = (id, teks, kelas) => {
            const el = $(id);
            if (!el) return;
            el.textContent = teks;
            if (kelas !== undefined) el.className = 'komp-nilai ' + kelas;
        };
        const k = st.komp;
        st.ekuitasLangsung = null;
        if (!trader() || !k) {
            ['kompEkuitas', 'kompSaldo', 'kompMengambang', 'kompRealisasi', 'kompReturn', 'kompMargin'].forEach((id) => set(id, '—', ''));
            return;
        }
        // Mengambang LANGSUNG dari harga feed kanonik (sisi penutup) untuk posisi turnamen periode ini.
        // Bila ada posisi tanpa harga, angka server (dari GET terakhir) dipakai dan hal itu dikatakan.
        const posKomp = st.posisi.filter((p) => p.kompPeriode && p.kompPeriode === k.periode);
        let mg = 0, lengkap = true;
        for (const p of posKomp) {
            const v = pnlPosisi(p, hargaTutup(p));
            if (v === null) lengkap = false; else mg += v;
        }
        const mengambang = lengkap ? Math.round(mg * 100) / 100 : Number(k.mengambang) || 0;
        const realisasi = Number(k.realisasi) || 0;
        const ekuitas = SALDO_AWAL + realisasi + mengambang;
        const ret = (ekuitas - SALDO_AWAL) / SALDO_AWAL * 100;
        st.ekuitasLangsung = ekuitas;
        set('kompEkuitas', fmtUsd(ekuitas), kelasArah(ekuitas - SALDO_AWAL));
        set('kompSaldo', fmtUsd(SALDO_AWAL + realisasi), '');
        set('kompMengambang', posKomp.length ? fmtUsdTanda(mengambang) : '$0.00', kelasArah(mengambang));
        set('kompRealisasi', fmtUsdTanda(realisasi), kelasArah(realisasi));
        set('kompReturn', fmtPersen(ret), kelasArah(ret));
        const catat = $('kompEkuitasCatat');
        if (catat) catat.textContent = lengkap ? 'periode ' + k.periode : 'sebagian posisi tanpa harga live — angka server';
        const margin = Number(k.margin_terpakai) || 0;
        const level = margin > 0 ? ekuitas / margin * 100 : null;
        set('kompMargin', level === null ? '—' : level.toFixed(level >= 1000 ? 0 : 1) + '%', level === null ? '' : level < 100 ? 'turun' : '');
        const mc = $('kompMarginCatat');
        if (mc) mc.textContent = margin > 0 ? 'margin ' + fmtUsd(margin) + ' · stop-out ' + (k.stopout_pct ?? 50) + '%' : 'stop-out di ' + (k.stopout_pct ?? 50) + '%';
    }

    // ── Render: posisi saya ─────────────────────────────────────────────────
    const sedangTutup = new Set();
    /** Posisi turnamen periode LALU: hanya server yang menutupnya (api/paper-trading.php → 409 periode_selesai). */
    const periodeLalu = (p) => !!(p.kompPeriode && st.komp && st.komp.periode && p.kompPeriode !== st.komp.periode);
    function renderPosisi() {
        const body = $('kompPosisi');
        const jml = $('kompPosisiJml');
        if (!body) return;
        if (jml) jml.textContent = String(st.posisi.length);
        // Editor SL/TP yang sedang terbuka TIDAK dibangun ulang oleh polling (audit G1: dulu tiap 10 dtk
        // innerHTML menimpa angka yang sedang diketik, fokus hilang, lalu "Simpan" mengirim SL/TP LAMA dan
        // tetap menampilkan toast sukses). Daftar posisi sama → cukup sel harga & P/L yang diperbarui.
        if (st.ubahId && !st.posisi.some((p) => p.id === st.ubahId)) { st.ubahId = null; st.ubahDraf = null; }
        if (st.ubahId && typeof body.querySelectorAll === 'function') {
            const diDom = Array.from(body.querySelectorAll('tr[data-id]'), (tr) => tr.dataset.id);
            const editorAda = Array.from(body.querySelectorAll('[data-isi-ubah]')).some((el) => el.closest && el.closest('tr') && el.closest('tr').dataset.id === st.ubahId);
            if (editorAda && diDom.join('|') === st.posisi.map((p) => String(p.id)).join('|')) {
                perbaruiSelPosisi();
                renderBot();
                gambarGarisPosisi();
                return;
            }
        }
        if (!st.posisi.length) {
            body.innerHTML = '<tr><td colspan="8" class="komp-kosong">Belum ada posisi terbuka. Gunakan tiket order.</td></tr>';
        } else {
            body.innerHTML = st.posisi.map((p) => {
                const lalu = periodeLalu(p);
                const luar = !lalu && !p.kompPeriode;
                const draf = st.ubahId === p.id ? (st.ubahDraf || {}) : null;
                const sltp = draf
                    ? '<span class="komp-ubah-sltp"><input type="number" step="any" data-isi-ubah="sl" value="' + esc(draf.sl ?? '') + '" placeholder="SL" aria-label="Stop loss">'
                      + '<input type="number" step="any" data-isi-ubah="tp" value="' + esc(draf.tp ?? '') + '" placeholder="TP" aria-label="Take profit"></span>'
                    : (p.sl ? fmtHarga(p.symbol, p.sl) : '—') + ' / ' + (p.tp ? fmtHarga(p.symbol, p.tp) : '—');
                const aksi = lalu
                    ? '<span class="komp-kecil" title="Hanya server yang menutup posisi periode lalu, di harga nyata terakhir sebelum batas periode">ditutup server</span>'
                    : draf
                    ? '<button type="button" class="komp-aksi-kecil" data-simpan="' + esc(p.id) + '">Simpan</button> <button type="button" class="komp-aksi-kecil" data-batal="1">Batal</button>'
                    : '<button type="button" class="komp-aksi-kecil" data-ubah="' + esc(p.id) + '">SL/TP</button> '
                      + '<button type="button" class="komp-tutup" data-tutup="' + esc(p.id) + '"' + (sedangTutup.has(p.id) ? ' disabled' : '') + '>Tutup</button>';
                const lencana = lalu
                    ? '<span class="komp-lencana luar" title="Periode ' + esc(p.kompPeriode) + ' sudah berakhir — posisi ini ditutup server di harga nyata terakhir sebelum batas periode dan dihitung di klasemen periode itu">periode lalu — menunggu penutupan server</span>'
                    : (luar ? '<span class="komp-lencana luar" title="Dibuka di luar turnamen (salinan sinyal, atau sebelum turnamen berlaku) — tidak dihitung papan">di luar turnamen</span>' : '');
                return '<tr data-id="' + esc(p.id) + '">'
                    + '<td class="komp-nama">' + esc(p.symbol) + lencana + '</td>'
                    + '<td><span class="komp-sisi ' + (p.side === 'BUY' ? 'buy' : 'sell') + '">' + esc(p.side) + '</span></td>'
                    + '<td class="num">' + Number(p.lots).toFixed(2) + '</td>'
                    + '<td class="num">' + fmtHarga(p.symbol, p.entryPrice) + '</td>'
                    + '<td class="num" data-sel="harga">—</td>'
                    + '<td class="num">' + sltp + '</td>'
                    + '<td class="num" data-sel="pnl">—</td>'
                    + '<td style="text-align:right">' + aksi + '</td>'
                    + '</tr>';
            }).join('');
        }
        perbaruiSelPosisi();
        renderBot();
        gambarGarisPosisi();
    }

    /** Posisi dari bot: ditampilkan apa adanya supaya pengguna tahu statusnya. */
    function renderBot() {
        const bot = $('kompBot');
        if (!bot) return;
        const n = (st.otomatis || []).length;
        bot.classList.toggle('hidden', n === 0);
        if (n) bot.textContent = n + ' posisi otomatis (AI / Ikuti Auto Analisa) sedang terbuka di akun Anda. '
            + 'Posisi itu dikelola server, tidak bisa ditutup dari arena, dan TIDAK dihitung papan peringkat.';
    }

    /** Hanya sel harga & P/L yang diperbarui tiap kutipan baru — input SL/TP yang sedang diketik tidak hilang. */
    function perbaruiSelPosisi() {
        const body = $('kompPosisi');
        if (!body) return;
        for (const tr of body.querySelectorAll('tr[data-id]')) {
            const p = st.posisi.find((x) => String(x.id) === tr.dataset.id);
            if (!p) continue;
            const hk = hargaTutup(p);
            const pnl = pnlPosisi(p, hk);
            const sh = tr.querySelector('[data-sel="harga"]');
            const sp = tr.querySelector('[data-sel="pnl"]');
            if (sh) sh.textContent = hk ? fmtHarga(p.symbol, hk) : '—';
            if (sp) {
                sp.className = 'num ' + (pnl === null ? '' : kelasArah(pnl));
                sp.textContent = pnl === null ? '—' : fmtUsdTanda(pnl);
                sp.title = pnl === null
                    ? (st.kutipan[p.symbol] && p.hargaSumber ? 'Seri harga posisi ini (' + (NAMA_SUMBER[p.hargaSumber] || p.hargaSumber) + ') sedang tidak tersedia — P/L tidak ditebak'
                        : 'Harga live belum tersedia — P/L tidak ditebak')
                    : 'Ditandai di harga penutup (' + (p.side === 'BUY' ? 'bid' : 'ask') + ')';
            }
        }
    }

    // ── Render: tiket ───────────────────────────────────────────────────────
    function renderPemilih() {
        const s = $('kompSimbol');
        if (s && !s.options.length) s.innerHTML = SIMBOL.map((x) => '<option value="' + x + '">' + x + '</option>').join('');
        if (s) s.value = st.simbol;
        const tf = $('kompTf');
        if (tf && !tf.children.length) tf.innerHTML = TF.map((t) => '<button type="button" class="komp-tf" data-tf="' + t.nilai + '">' + t.label + '</button>').join('');
        if (tf) tf.querySelectorAll('[data-tf]').forEach((b) => b.classList.toggle('aktif', b.dataset.tf === st.tf));
    }

    function renderSatuan() {
        const s = SATUAN[st.simbol] || { label: 'harga', ukuran: 1, preset: [] };
        const teks = 'jarak · ' + s.label;
        if ($('kompSatuanSl')) $('kompSatuanSl').textContent = teks;
        if ($('kompSatuanTp')) $('kompSatuanTp').textContent = teks;
        const tombol = (jenis, kali) => s.preset.map((v) => '<button type="button" data-isi="' + jenis + '" data-jarak="' + (v * kali) + '">' + (v * kali) + (s.label === '$' ? '$' : '') + '</button>').join('');
        if ($('kompCepatSl')) $('kompCepatSl').innerHTML = tombol('sl', 1);
        if ($('kompCepatTp')) $('kompCepatTp').innerHTML = tombol('tp', 2);
    }

    /** SL/TP absolut untuk sisi yang DITEKAN: BUY dari ask, SELL dari bid (sama dengan dasar server). */
    function hitungSlTp(arah) {
        const s = SATUAN[st.simbol] || { ukuran: 1 };
        const dasar = hargaSisi(st.simbol, arah === 'BUY');
        const jarak = (id) => { const v = parseFloat($(id)?.value); return Number.isFinite(v) && v > 0 ? v * s.ukuran : null; };
        const dSl = jarak('kompSl'), dTp = jarak('kompTp');
        if (!dasar) return { sl: null, tp: null, dasar: null };
        const bulat = (x) => Number(x.toFixed(dp(st.simbol)));
        const beli = arah === 'BUY';
        const sl = dSl === null ? null : bulat(beli ? dasar - dSl : dasar + dSl);
        const tp = dTp === null ? null : bulat(beli ? dasar + dTp : dasar - dTp);
        return { sl, tp, dasar, salah: (sl !== null && sl <= 0) || (tp !== null && tp <= 0) };
    }

    function renderTiket() {
        const sym = st.simbol;
        const q = st.kutipan[sym];
        const isi = (id, teks) => { const el = $(id); if (el) el.textContent = teks; };
        isi('kompTiketSimbol', sym);
        const ask = hargaSisi(sym, true), bid = hargaSisi(sym, false);
        isi('kompBid', bid ? fmtHarga(sym, bid) : '—');
        isi('kompAsk', ask ? fmtHarga(sym, ask) : '—');
        isi('kompSpread', q && q.spread != null ? fmtHarga(sym, q.spread) : '—');
        isi('kompHargaBeli', ask ? fmtHarga(sym, ask) : '—');
        isi('kompHargaJual', bid ? fmtHarga(sym, bid) : '—');
        isi('kompMHargaBeli', ask ? fmtHarga(sym, ask) : '—');
        isi('kompMHargaJual', bid ? fmtHarga(sym, bid) : '—');
        const umur = umurKutipan(q);
        const sumber = q ? (NAMA_SUMBER[q.source] || q.source || '') : '';
        // Proksi selaras: umur selisih G (emas − PAXG) dikatakan — levelnya tidak berganti diam-diam.
        const umurG = q && q.source === 'binance_paxg_selaras' && Number.isFinite(Number(q.geser_umur)) ? Number(q.geser_umur) : null;
        isi('kompSumberHarga', q ? 'Feed: ' + sumber + (umur > st.umurMaksIsi ? ' · ' + Math.round(umur) + ' dtk lalu' : '')
            + (umurG !== null ? ' · selisih diukur ' + waktuLalu(Math.round((Date.now() + st.selisihJam) / 1000) - umurG) : '') : 'Feed: —');

        // PASAR TUTUP / tanpa harga → tombol dinonaktifkan (server juga akan menolak).
        const tutup = !!(q && q.market === 'closed');
        const tanpa = !q;
        const ket = $('kompPasarTutup');
        if (ket) ket.classList.toggle('hidden', !tutup && !tanpa);
        const ketTeks = $('kompPasarTutupTeks');
        if (ketTeks) ketTeks.textContent = tutup ? 'Pasar ' + sym + ' sedang tutup — order dibuka kembali saat pasar buka.'
            : (tanpa ? 'Feed kompetisi belum punya harga live ' + sym + ' — order dinonaktifkan sampai harganya ada.' : '');
        if (ket) { const b = ket.querySelector('b'); if (b) b.textContent = tutup ? 'PASAR TUTUP' : 'TANPA HARGA'; }
        setTombolOrder(!st.sedangOrder && !tutup && !tanpa);

        // Margin yang dibutuhkan (model leverage server: lot × kontrak × harga ÷ 100).
        const lot = parseFloat($('kompLot')?.value || '0');
        const lev = (st.komp && st.komp.leverage) || 100;
        const h = ask || bid;
        const perlu = h && lot > 0 ? lot * pengali(sym, h) * h / lev : null;
        isi('kompMarginPerlu', 'Margin: ' + (perlu === null ? '—' : fmtUsd(perlu)));
        isi('kompLotInfo', perlu === null ? '' : '≈ ' + fmtUsd(perlu) + ' margin');
        const bebas = st.komp && st.ekuitasLangsung != null ? st.ekuitasLangsung - (Number(st.komp.margin_terpakai) || 0) : null;
        isi('kompMarginBebas', 'Bebas: ' + (bebas === null || !Number.isFinite(bebas) ? '—' : fmtUsd(bebas)));

        // Pratinjau SL/TP untuk kedua sisi.
        const b = hitungSlTp('BUY'), s = hitungSlTp('SELL');
        const f = (v) => (v === null ? '—' : fmtHarga(sym, v));
        const pr = $('kompPratinjau');
        if (pr) pr.textContent = (b.sl === null && b.tp === null)
            ? 'Isi jarak SL/TP (' + ((SATUAN[sym] || {}).label || 'harga') + '). BUY dihitung dari ask, SELL dari bid.'
            : 'BUY  SL ' + f(b.sl) + ' · TP ' + f(b.tp) + '\nSELL SL ' + f(s.sl) + ' · TP ' + f(s.tp);
        if (pr) pr.style.whiteSpace = 'pre-line';
    }

    function renderHargaKepala() {
        const q = st.kutipan[st.simbol];
        const h = $('kompHarga');
        const c = $('kompUbah');
        if (h) h.textContent = q ? fmtHarga(st.simbol, q.price) : '—';
        if (c) {
            const pct = q ? Number(q.chgPct || 0) : null;
            c.textContent = pct === null ? '' : fmtPersen(pct);
            c.className = 'komp-ubah ' + (pct === null ? '' : pct >= 0 ? 'naik' : 'turun');
        }
    }

    function setTombolOrder(aktif) {
        for (const id of ['kompBeli', 'kompJual', 'kompMBeli', 'kompMJual']) {
            const b = $(id);
            if (b) { b.disabled = !aktif; b.setAttribute('aria-busy', st.sedangOrder ? 'true' : 'false'); }
        }
    }

    // ── Chart ───────────────────────────────────────────────────────────────
    async function muatCandle() {
        if (!trader()) return;
        // Token urutan: hanya respons TERAKHIR yang boleh digambar. Dulu permintaan baru diabaikan
        // selama yang lama berjalan, lalu candle XAUUSD tergambar di bawah judul EURUSD sampai 60 dtk.
        const req = ++st.seqCandle;
        const sym = st.simbol, tf = st.tf, kunci = sym + '|' + tf;
        const badge = $('kompSumber');
        try {
            const r = await fetch('api/get-chart-data.php?symbol=' + encodeURIComponent(sym) + '&interval=' + encodeURIComponent(tf),
                { headers: authHeaders(), cache: 'no-store' });
            const d = await r.json();
            if (req !== st.seqCandle) return;               // simbol/TF sudah berganti — respons basi dibuang
            // Candle simulasi = 201 batang hasil rand() saat semua sumber nyata gagal.
            // Arena kompetisi TIDAK boleh dimainkan di atas angka acak.
            if (d.simulated === true) {
                st.candleTerakhir = [];
                if (badge) { badge.textContent = 'DATA SIMULASI — TIDAK DIPAKAI'; badge.className = 'komp-sumber bahaya'; }
                gambarKosong('Sumber candle nyata sedang tidak tersedia. Chart sengaja dikosongkan daripada menampilkan angka acak.');
                return;
            }
            const candles = (Array.isArray(d.candles) ? d.candles : [])
                .map((c) => ({ time: Number(c.time), open: +c.open, high: +c.high, low: +c.low, close: +c.close }))
                .filter((c) => c.time > 0 && c.close > 0);
            if (!candles.length) {
                st.candleTerakhir = [];
                if (badge) { badge.textContent = 'TIDAK ADA DATA'; badge.className = 'komp-sumber bahaya'; }
                gambarKosong(d.message || ('Candle tidak tersedia untuk ' + sym + ' pada timeframe ini.'));
                return;
            }
            st.candleTerakhir = candles;
            st.sumberCandle = String(d.source || '');
            if (badge) {
                const mt5 = /^mt5/.test(st.sumberCandle);
                const q = st.kutipan[sym];
                const beda = q && CANDLE_KE_KUTIPAN[st.sumberCandle] !== q.source;
                badge.textContent = (mt5 ? 'MT5 · BROKER QI' : st.sumberCandle.toUpperCase()) + (beda ? ' · ≠ FEED ORDER' : '');
                badge.className = 'komp-sumber ' + (mt5 ? 'mt5' : 'biasa');
                badge.title = (mt5 ? 'Candle berasal dari bridge MT5 broker.' : 'Candle dari penyedia ' + st.sumberCandle + '.')
                    + (beda ? ' Harga order memakai feed kompetisi (' + (NAMA_SUMBER[q.source] || q.source) + '), jadi candle terakhir tidak digerakkan harga live.' : '');
            }
            gambarChart(candles, kunci !== st.candleKunci);
            st.candleKunci = kunci;
        } catch (e) {
            if (req === st.seqCandle) gambarKosong('Gagal memuat candle: ' + e.message);
        }
    }

    function gambarKosong(pesan) {
        const w = $('kompChart');
        if (!w) return;
        if (st.chart) { try { st.chart.remove(); } catch (e) {} st.chart = null; st.seri = null; st.garis = []; }
        st.candleKunci = '';
        w.innerHTML = '<div class="komp-chart-kosong">' + esc(pesan) + '</div>';
    }

    function gambarChart(candles, pasLayar) {
        const w = $('kompChart');
        const M = window._lwModules;
        if (!w || !M) return;
        if (!st.chart) {
            w.innerHTML = '';
            st.chart = M.createChart(w, {
                layout: { background: { color: 'transparent' }, textColor: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' },
                grid: { vertLines: { color: 'rgba(30,41,59,.6)' }, horzLines: { color: 'rgba(30,41,59,.6)' } },
                rightPriceScale: { borderColor: '#1E293B' },
                timeScale: { borderColor: '#1E293B', timeVisible: true, secondsVisible: false },
                crosshair: { mode: M.CrosshairMode ? M.CrosshairMode.Normal : 0 },
                autoSize: true,
            });
            st.seri = st.chart.addSeries(M.CandlestickSeries, {
                upColor: '#10B981', downColor: '#EF4444', borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#EF4444',
            });
            pasLayar = true;
        }
        st.seri.applyOptions({ priceFormat: { type: 'price', precision: dp(st.simbol), minMove: Math.pow(10, -dp(st.simbol)) } });
        st.seri.setData(candles);
        // fitContent HANYA saat simbol/TF berganti — dulu tiap penyegaran 60 dtk membuang zoom pengguna.
        if (pasLayar) st.chart.timeScale().fitContent();
        gambarGarisPosisi();
    }

    /** Gerakkan candle terakhir dari kutipan live (feed yang sama dengan candle saja). */
    function perbaruiCandleTerakhir() {
        if (!st.seri || !st.candleTerakhir.length) return;
        const q = st.kutipan[st.simbol];
        if (!q || q.market === 'closed' || umurKutipan(q) > 30) return;
        if (CANDLE_KE_KUTIPAN[st.sumberCandle] !== q.source) return;
        if (st.candleKunci !== st.simbol + '|' + st.tf) return;
        const harga = Number(q.price);
        if (!(harga > 0)) return;
        const dtk = (TF.find((t) => t.nilai === st.tf) || { dtk: 3600 }).dtk;
        const kini = (Date.now() + st.selisihJam) / 1000;
        const akhir = st.candleTerakhir[st.candleTerakhir.length - 1];
        let bar;
        if (kini < akhir.time + dtk) {
            bar = { time: akhir.time, open: akhir.open, high: Math.max(akhir.high, harga), low: Math.min(akhir.low, harga), close: harga };
            st.candleTerakhir[st.candleTerakhir.length - 1] = bar;
        } else {
            bar = { time: akhir.time + Math.floor((kini - akhir.time) / dtk) * dtk, open: harga, high: harga, low: harga, close: harga };
            st.candleTerakhir.push(bar);
        }
        try { st.seri.update(bar); } catch (e) { /* urutan waktu tidak cocok: tunggu muat ulang penuh */ }
    }

    /** Garis entry/SL/TP untuk posisi pada simbol yang sedang dibuka. */
    function gambarGarisPosisi() {
        if (!st.seri) return;
        for (const g of st.garis) { try { st.seri.removePriceLine(g); } catch (e) {} }
        st.garis = [];
        for (const p of st.posisi) {
            if (p.symbol !== st.simbol) continue;
            const warna = p.side === 'BUY' ? '#10B981' : '#EF4444';
            const tambah = (harga, c, judul, gaya) => {
                const v = Number(harga);
                if (!Number.isFinite(v) || v <= 0) return;
                try { st.garis.push(st.seri.createPriceLine({ price: v, color: c, lineWidth: 1, lineStyle: gaya, axisLabelVisible: true, title: judul })); } catch (e) {}
            };
            tambah(p.entryPrice, warna, p.side + ' ' + p.lots, 0);
            tambah(p.sl, '#EF4444', 'SL', 2);
            tambah(p.tp, '#10B981', 'TP', 2);
        }
    }

    // ── Aksi order ──────────────────────────────────────────────────────────
    /** Kunci idempotensi: kiriman ulang dengan id yang sama tidak pernah menjadi posisi kedua. */
    function buatIdOrder() {
        try { if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch (e) {}
        const a = new Uint8Array(16);
        (window.crypto || window.msCrypto).getRandomValues(a);
        return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Satu aksi ke api/paper-trading.php. SUKSES hanya bila HTTP 200 dan status 'success'.
     * @returns {Promise<{ok:boolean,http:number,data:object,jaringan?:boolean}>}
     */
    async function kirimAksi(muatan) {
        try {
            const r = await fetch('api/paper-trading.php', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(muatan),
            });
            const d = await r.json().catch(() => ({}));
            if (r.status === 200 && d.status === 'success') return { ok: true, http: 200, data: d };
            if (r.status === 401) modeTurun('sesi');
            else if (r.status === 403 && d.code === 'PRO_REQUIRED') modeTurun('free');
            return { ok: false, http: r.status, data: d };
        } catch (e) {
            return { ok: false, http: 0, data: {}, jaringan: true };
        }
    }

    async function order(arah) {
        if (st.sedangOrder || !trader()) return;
        const sym = st.simbol;
        const q = st.kutipan[sym];
        const harga = hargaSisi(sym, arah === 'BUY');
        if (!Number.isFinite(harga) || harga <= 0) {
            toast('Harga live ' + sym + ' belum tersedia — order tidak dikirim.', 'error');
            return;
        }
        if (q && q.market === 'closed') { toast('Pasar ' + sym + ' sedang tutup — order tidak dikirim.', 'error'); return; }
        const lot = Math.round(parseFloat($('kompLot')?.value || '0') * 100) / 100;
        if (!(lot >= 0.01 && lot <= 100)) { toast('Lot harus antara 0,01 dan 100.', 'error'); return; }
        const { sl, tp, salah } = hitungSlTp(arah);
        if (salah) { toast('Jarak SL/TP terlalu besar untuk harga ' + sym + ' — order tidak dikirim.', 'error'); return; }

        st.sedangOrder = true;
        setTombolOrder(false);
        const muatan = { aksi: 'buka', symbol: sym, side: arah, lots: lot, sl, tp, harga, client_order_id: buatIdOrder(), asal: 'tiket' };
        try {
            let hasil = await kirimAksi(muatan);
            // Jaringan putus: kirim ULANG dengan client_order_id yang SAMA — server mengembalikan posisi
            // yang sudah tercatat (duplikat) alih-alih membuka posisi kedua.
            if (hasil.jaringan) { await new Promise((r) => setTimeout(r, 900)); hasil = await kirimAksi(muatan); }
            if (hasil.ok && hasil.data.posisi) {
                const p = hasil.data.posisi;
                toast('Order ' + arah + ' ' + lot.toFixed(2) + ' lot ' + sym + ' tereksekusi @ ' + fmtHarga(sym, p.entryPrice)
                    + (hasil.data.duplikat ? ' (sudah tercatat sebelumnya — tidak digandakan)' : '')
                    + (p.kompPeriode ? '' : ' · di luar turnamen'), 'sukses');
            } else if (hasil.jaringan) {
                toast('Server tidak terjangkau — status order belum pasti. Daftar posisi dimuat ulang.', 'error');
            } else {
                toast(hasil.data.message || ('Server menolak order (HTTP ' + hasil.http + ').'), 'error');
            }
        } finally {
            st.sedangOrder = false;
            await muatPosisi();
            muatPapan();
            renderTiket();
        }
    }

    async function tutup(id) {
        const p = st.posisi.find((x) => String(x.id) === String(id));
        if (!p || sedangTutup.has(p.id)) return;
        sedangTutup.add(p.id);
        renderPosisi();
        try {
            // Menutup BUY = menjual di bid; menutup SELL = membeli di ask. Harga di layar hanya batas requote:
            // SERVER yang menentukan harga tutup, jadi tanpa harga layar (simbol di luar tiket, seri harga
            // sedang lain) permintaan tetap dikirim tanpa 'harga' — server menutup atau menolak dengan alasan.
            const hk = hargaTutup(p);
            const muatan = { aksi: 'tutup', id: p.id };
            if (Number.isFinite(Number(hk)) && Number(hk) > 0) muatan.harga = hk;
            const hasil = await kirimAksi(muatan);
            if (hasil.ok && hasil.data.ditutup) {
                const pnl = Number(hasil.data.ditutup.realizedPnL) || 0;
                toast('Posisi ' + p.side + ' ' + p.symbol + ' ditutup @ ' + fmtHarga(p.symbol, hasil.data.ditutup.closePrice) + ' · ' + fmtUsdTanda(pnl), pnl >= 0 ? 'sukses' : 'info');
            } else {
                toast(hasil.jaringan ? 'Server tidak terjangkau — posisi BELUM tentu ditutup. Daftar dimuat ulang.' : (hasil.data.message || ('Penutupan ditolak (HTTP ' + hasil.http + ').')), 'error');
            }
        } finally {
            sedangTutup.delete(p.id);
            await muatPosisi();
            muatPapan();
        }
    }

    async function simpanSlTp(id) {
        // Nilai dari draf editor (diperbarui tiap ketikan), bukan dari input yang bisa sudah dibangun ulang.
        const draf = st.ubahId === id && st.ubahDraf ? st.ubahDraf : {};
        const baca = (k) => { const v = parseFloat(draf[k]); return Number.isFinite(v) && v > 0 ? v : null; };
        const hasil = await kirimAksi({ aksi: 'ubah', id, sl: baca('sl'), tp: baca('tp') });
        if (hasil.ok && hasil.data.berubah === false) { toast('SL/TP tidak berubah — tidak ada yang dikirim ulang ke server.', 'info'); st.ubahId = null; st.ubahDraf = null; }
        else if (hasil.ok) { toast('SL/TP diperbarui — level lama sudah diperiksa server; level baru berlaku mulai bar M1 berikutnya.', 'sukses'); st.ubahId = null; st.ubahDraf = null; }
        else toast(hasil.jaringan ? 'Server tidak terjangkau — SL/TP belum diubah.' : (hasil.data.message || 'SL/TP ditolak.'), 'error');
        await muatPosisi();
    }

    async function daftarTurnamen(kunci) {
        try {
            const r = await fetch('api/competition.php', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ aksi: 'daftar', turnamen: kunci || 'weekly-championship' }),
            });
            const d = await r.json().catch(() => ({}));
            toast(d.message || (r.ok ? 'Terdaftar.' : 'Gagal mendaftar.'), r.ok ? 'sukses' : 'error');
        } catch (e) {
            toast('Gagal menghubungi server kompetisi.', 'error');
        }
        muatPapan();
    }

    // ── Laci trader ─────────────────────────────────────────────────────────
    function bukaLaci(kode) {
        if (!/^[0-9a-f]{12}$/.test(String(kode))) return;
        st.laciKode = kode;
        st.laciFokusAsal = document.activeElement;
        $('kompLaci')?.classList.remove('hidden');
        $('kompLaciLatar')?.classList.remove('hidden');
        const isi = $('kompLaciIsi');
        if (isi) isi.innerHTML = '<p class="komp-kecil">Memuat…</p>';
        $('kompLaciTutup')?.focus();
        muatLaci();
    }
    function tutupLaci() {
        st.laciKode = null;
        $('kompLaci')?.classList.add('hidden');
        $('kompLaciLatar')?.classList.add('hidden');
        if (st.laciFokusAsal && st.laciFokusAsal.focus) { try { st.laciFokusAsal.focus(); } catch (e) {} }
    }
    function muatLaci() {
        const kode = st.laciKode;
        if (!kode) return Promise.resolve();
        return sekali('laci', async () => {
            const isi = $('kompLaciIsi');
            try {
                const r = await fetch('api/competition.php?trader=' + encodeURIComponent(kode), { headers: authHeaders(), cache: 'no-store' });
                const d = await r.json().catch(() => ({}));
                if (kode !== st.laciKode) return;
                if (!r.ok || d.status !== 'success') { if (isi) isi.innerHTML = '<p class="komp-kecil">' + esc(d.message || 'Detail trader tidak tersedia.') + '</p>'; return; }
                renderLaci(d);
            } catch (e) {
                if (isi && kode === st.laciKode) isi.innerHTML = '<p class="komp-kecil">Tidak dapat menghubungi server.</p>';
            }
        });
    }
    function renderLaci(d) {
        const t = d.trader || {};
        if ($('kompLaciJudul')) $('kompLaciJudul').textContent = t.nama || 'Trader';
        if ($('kompLaciRank')) $('kompLaciRank').textContent = t.aktif ? 'Peringkat #' + t.rank + ' minggu ini' : 'Belum trading minggu ini';
        const stat = (l, v, k) => '<div><span>' + l + '</span><b class="' + (k || '') + '">' + v + '</b></div>';
        const posisi = (d.posisi || []).map((p) => '<tr><td class="komp-nama">' + esc(p.symbol) + '</td>'
            + '<td><span class="komp-sisi ' + (p.side === 'BUY' ? 'buy' : 'sell') + '">' + esc(p.side) + '</span></td>'
            + '<td class="num">' + Number(p.lots).toFixed(2) + '</td><td class="num">' + fmtHarga(p.symbol, p.entry) + '</td>'
            + '<td class="num">' + (p.mark ? fmtHarga(p.symbol, p.mark) : '—') + '</td>'
            + '<td class="num ' + (p.floating === null ? '' : kelasArah(p.floating)) + '">' + (p.floating === null ? '<span title="Harga live tidak tersedia — tidak ditebak">—</span>' : fmtUsdTanda(p.floating)) + '</td></tr>').join('');
        const tutupan = (d.tutup || []).map((p) => '<tr><td class="komp-nama">' + esc(p.symbol) + '</td>'
            + '<td><span class="komp-sisi ' + (p.side === 'BUY' ? 'buy' : 'sell') + '">' + esc(p.side) + '</span></td>'
            + '<td class="num">' + Number(p.lots).toFixed(2) + '</td>'
            + '<td class="num">' + fmtHarga(p.symbol, p.entry) + ' → ' + fmtHarga(p.symbol, p.close) + '</td>'
            + '<td class="num ' + kelasArah(p.pnl) + '">' + fmtUsdTanda(p.pnl) + '</td>'
            + '<td class="komp-kecil">' + esc(ALASAN[p.alasan || ''] || '') + ' ' + waktuLalu(p.tutup_ts) + '</td></tr>').join('');
        const isi = $('kompLaciIsi');
        if (!isi) return;
        isi.innerHTML = '<div class="komp-laci-stat">'
            + stat('Ekuitas', fmtUsd(t.equity)) + stat('Return', fmtPersen(t.return_pct), kelasArah(t.return_pct)) + stat('Mengambang', fmtUsdTanda(t.floating || 0), kelasArah(t.floating))
            + stat('Terealisasi', fmtUsdTanda(t.realized || 0), kelasArah(t.realized)) + stat('Trade', String(t.trades || 0)) + stat('Win rate', t.trades ? t.win_rate + '%' : '—')
            + '</div>'
            + (t.harga_basi ? '<p class="komp-kecil" style="color:#FBBF24;margin:0">⚠ Harga salah satu posisinya sedang basi — ekuitas memakai tanda nyata terakhir, tidak ditebak.</p>' : '')
            + '<div><h3>Posisi terbuka (' + (d.posisi || []).length + ')</h3><div style="overflow-x:auto"><table class="komp-tabel"><thead><tr><th>Instrumen</th><th>Arah</th><th class="num">Lot</th><th class="num">Entry</th><th class="num">Harga</th><th class="num">P/L</th></tr></thead><tbody>'
            + (posisi || '<tr><td colspan="6" class="komp-kosong">Tidak ada posisi terbuka.</td></tr>') + '</tbody></table></div></div>'
            + '<div><h3>Penutupan terakhir</h3><div style="overflow-x:auto"><table class="komp-tabel"><thead><tr><th>Instrumen</th><th>Arah</th><th class="num">Lot</th><th class="num">Entry → Exit</th><th class="num">P/L</th><th></th></tr></thead><tbody>'
            + (tutupan || '<tr><td colspan="6" class="komp-kosong">Belum ada posisi yang ditutup minggu ini.</td></tr>') + '</tbody></table></div></div>'
            + '<p class="komp-kecil" style="margin:0">SL/TP trader lain tidak ditampilkan. Angka dihitung server dari posisi manual periode ini.</p>';
    }

    // ── Pemasangan ──────────────────────────────────────────────────────────
    function pasangPendengar() {
        $('kompSimbol')?.addEventListener('change', (e) => {
            st.simbol = e.target.value;
            renderPemilih(); renderSatuan(); renderHargaKepala(); renderTiket();
            muatHarga();
            muatCandle();
            gambarGarisPosisi();
        });
        $('kompTf')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tf]');
            if (!b) return;
            st.tf = b.dataset.tf;
            renderPemilih();
            muatCandle();
        });
        for (const [id, arah] of [['kompBeli', 'BUY'], ['kompJual', 'SELL'], ['kompMBeli', 'BUY'], ['kompMJual', 'SELL']]) {
            $(id)?.addEventListener('click', () => order(arah));
        }
        $('kompPosisi')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tutup]');
            if (b) { tutup(b.dataset.tutup); return; }
            const u = e.target.closest('[data-ubah]');
            if (u) {
                const p = st.posisi.find((x) => String(x.id) === String(u.dataset.ubah));
                st.ubahId = u.dataset.ubah;
                st.ubahDraf = { sl: p && p.sl != null ? String(p.sl) : '', tp: p && p.tp != null ? String(p.tp) : '' };
                renderPosisi();
                return;
            }
            const s = e.target.closest('[data-simpan]');
            if (s) { simpanSlTp(s.dataset.simpan); return; }
            if (e.target.closest('[data-batal]')) { st.ubahId = null; st.ubahDraf = null; renderPosisi(); }
        });
        // Ketikan di editor SL/TP disimpan sebagai draf — bertahan bila daftar posisi harus dibangun ulang.
        $('kompPosisi')?.addEventListener('input', (e) => {
            const k = e.target && e.target.dataset ? e.target.dataset.isiUbah : null;
            if (st.ubahId && st.ubahDraf && (k === 'sl' || k === 'tp')) st.ubahDraf[k] = String(e.target.value ?? '');
        });
        $('kompDaftar')?.addEventListener('click', (e) => daftarTurnamen(e.currentTarget.dataset.turnamen));
        // Tiket: lot cepat, jarak SL/TP cepat, pratinjau ulang tiap ketikan.
        document.querySelector('.komp-tiket')?.addEventListener('click', (e) => {
            const lot = e.target.closest('[data-lot]');
            if (lot) { $('kompLot').value = Number(lot.dataset.lot).toFixed(2); renderTiket(); return; }
            const isi = e.target.closest('[data-isi]');
            if (isi) {
                const input = $(isi.dataset.isi === 'sl' ? 'kompSl' : 'kompTp');
                if (input) input.value = isi.dataset.jarak;
                renderTiket();
            }
        });
        for (const id of ['kompLot', 'kompSl', 'kompTp']) $(id)?.addEventListener('input', renderTiket);
        // Papan & aktivitas → laci trader (klik atau Enter).
        $('kompPapan')?.addEventListener('click', (e) => { const tr = e.target.closest('[data-kode]'); if (tr) bukaLaci(tr.dataset.kode); });
        $('kompPapan')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const tr = e.target.closest('[data-kode]');
            if (tr) { e.preventDefault(); bukaLaci(tr.dataset.kode); }
        });
        $('kompFeed')?.addEventListener('click', (e) => { const b = e.target.closest('[data-kode]'); if (b) bukaLaci(b.dataset.kode); });
        $('kompLaciTutup')?.addEventListener('click', tutupLaci);
        $('kompLaciLatar')?.addEventListener('click', tutupLaci);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.laciKode) tutupLaci(); });
        document.addEventListener('qi-komp-mode', (e) => terapkanMode(e.detail && e.detail.mode));
        document.addEventListener('visibilitychange', () => { if (terlihat()) segarkanSemua(); });
        window.addEventListener('focus', () => segarkanSemua());
    }

    function segarkanSemua() {
        muatPapan();
        if (trader()) { muatPosisi(); muatHarga(); }
        if (st.laciKode) muatLaci();
    }

    /**
     * Bilah cookie (cookie-consent.js: fixed bottom, z-index 9999) menutupi toast dan bar BUY/SELL ponsel
     * sampai pengunjung memilih — pada kunjungan pertama, konfirmasi order dan tombol order tersembunyi.
     * Tingginya dipasang sebagai --komp-bawah selama bilah itu ada di DOM (0 setelah dihapus).
     */
    function jagaJarakBawah() {
        const atur = () => {
            const akar = document.documentElement;
            if (!akar || !akar.style || typeof akar.style.setProperty !== 'function') return;
            const bar = document.getElementById('qiCookieBar');
            let tinggi = 0;
            if (bar && typeof bar.getBoundingClientRect === 'function') {
                // Bilah masuk/keluar lewat transform (translateY): yang dihitung bagian yang BENAR-BENAR
                // menutupi layar, diukur ulang setiap animasinya selesai.
                if (!bar._kompDijaga) { bar._kompDijaga = true; bar.addEventListener('transitionend', atur); }
                tinggi = Math.max(0, Math.round(window.innerHeight - bar.getBoundingClientRect().top));
            }
            akar.style.setProperty('--komp-bawah', tinggi + 'px');
        };
        atur();
        try { new MutationObserver(atur).observe(document.body, { childList: true }); } catch (e) { /* peramban lama: tanpa penyesuaian */ }
        window.addEventListener('resize', atur);
    }

    function mulai() {
        jagaJarakBawah();
        renderPemilih();
        renderSatuan();
        pasangPendengar();
        terapkanMode(window.QI_KOMP_MODE);

        // Polling hanya saat tab terlihat; endpoint pribadi hanya di mode trader.
        setInterval(() => { if (terlihat()) muatPapan(); }, JEDA.papan);
        setInterval(() => { if (terlihat() && trader()) muatHarga(); }, JEDA.harga);
        setInterval(() => { if (terlihat() && trader()) muatPosisi(); }, JEDA.posisi);
        setInterval(() => { if (terlihat() && trader()) muatCandle(); }, JEDA.candle);
        setInterval(() => { if (terlihat() && st.laciKode) muatLaci(); }, JEDA.laci);
        setInterval(renderHitung, 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
    else mulai();
})();
