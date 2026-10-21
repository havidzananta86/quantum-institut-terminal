/* ═══════════════════════════════════════════════════════════════════════════
   ARENA KOMPETISI — halaman trading khusus peserta turnamen (kompetisi.html).

   MENGAPA DIPISAH DARI DASHBOARD
   Dashboard utama memuat 30+ panel, termasuk AI Auto-Trade dan "Ikuti Auto Analisa".
   Arena ini sengaja TIDAK memuat satu pun kendali otomatis: hanya chart, tiket order
   manual, posisi terbuka, dan papan peringkat. Satu layar, satu aturan.

   ATURAN YANG DITEGAKKAN SERVER (bukan hanya tampilan di sini)
     · Saldo = saldo simulasi paper trading. api/paper-trading.php menetapkan
       $STARTING_BALANCE = 10000.0 dan menolak akun non-PRO (qi_require_level('pro')).
     · Order baru selalu disimpan dengan source='manual' oleh api/paper-trading.php.
     · Papan peringkat (api/competition.php → qi_comp_agregat) HANYA menghitung
       posisi `status='closed' AND source <> 'auto'`. Posisi dari bot tidak pernah
       masuk peringkat — halaman ini hanya membuatnya terlihat jelas bagi pengguna.
     · Harga entry/exit divalidasi server terhadap harga pasar (±1%), jadi order
       dengan harga karangan ditolak.

   SUMBER DATA
     · Candle   : api/get-chart-data.php — untuk PRO/VIP feed-nya MT5 bridge
                  (qi_chart_use_mt5), ditandai di badge sumber. Candle `simulated`
                  DITOLAK: arena tidak boleh dimainkan di atas angka acak.
     · Harga    : api/live-price.php (polling 15 detik)
     · Peringkat: api/competition.php?papan=weekly
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const SALDO_AWAL = 10000;          // HARUS sama dengan $STARTING_BALANCE di api/paper-trading.php
    const SIMBOL = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAGUSD', 'US30', 'NAS100'];
    const TF = [
        { label: 'M5', nilai: '5' }, { label: 'M15', nilai: '15' }, { label: 'H1', nilai: '60' },
        { label: 'H4', nilai: '240' }, { label: 'D1', nilai: 'D' },
    ];
    const DESIMAL = { XAUUSD: 2, XAGUSD: 3, EURUSD: 5, GBPUSD: 5, USDJPY: 3, BTCUSDT: 2, ETHUSDT: 2, SOLUSDT: 3, US30: 1, NAS100: 1 };

    const st = {
        simbol: 'XAUUSD',
        tf: '60',
        harga: {},            // { SIM: {price, chgPct} }
        posisi: [],           // posisi terbuka milik saya (manual saja)
        riwayat: [],          // posisi tertutup
        saldo: SALDO_AWAL,
        arah: 'BUY',
        chart: null, seri: null, garis: [],
        candleTerakhir: [],
        sumberCandle: '',
        simpanSedangJalan: false,
        memuatCandle: false,
    };

    const dp = (sym) => DESIMAL[sym] ?? 2;
    const fmtHarga = (sym, n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp(sym), maximumFractionDigits: dp(sym) });
    const fmtUsd = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUsdTanda = (n) => (Number(n) >= 0 ? '+' : '-') + '$' + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function toast(pesan, jenis) {
        const el = $('kompToast');
        if (!el) return;
        el.textContent = pesan;
        el.className = 'komp-toast ' + (jenis || 'info');
        el.classList.remove('hidden');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => el.classList.add('hidden'), 4500);
    }

    const authHeaders = (extra) => {
        const h = Object.assign({}, extra || {});
        try {
            const t = (window.QuantumAuth && QuantumAuth.getToken && QuantumAuth.getToken())
                || localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token');
            if (t) h.Authorization = 'Bearer ' + t;
        } catch (e) {}
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

    const realisasi = () => st.riwayat.reduce((j, h) => j + (Number(h.realizedPnL) || 0), 0);
    function mengambang() {
        let jml = 0;
        for (const p of st.posisi) {
            const v = pnlPosisi(p, st.harga[p.symbol]?.price);
            if (v !== null) jml += v;
        }
        return Math.round(jml * 100) / 100;
    }

    // ── Pemuat data ─────────────────────────────────────────────────────────
    async function muatPosisi() {
        try {
            const r = await fetch('api/paper-trading.php', { headers: authHeaders(), cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            const data = d.data || d;
            // Posisi otomatis (src 'ai'/'auto') DITAMPILKAN terpisah, tidak bisa ditutup dari sini,
            // dan memang tidak dihitung papan peringkat.
            const semua = Array.isArray(data.positions) ? data.positions : [];
            st.posisi = semua.filter((p) => (p.src || 'manual') === 'manual');
            st.otomatis = semua.filter((p) => (p.src || 'manual') !== 'manual');
            st.riwayat = Array.isArray(data.history) ? data.history : [];
            st.saldo = Number.isFinite(Number(data.balance)) ? Number(data.balance) : SALDO_AWAL + realisasi();
        } catch (e) {
            toast('Gagal memuat posisi: ' + e.message, 'error');
        }
        renderSaldo();
        renderPosisi();
    }

    /**
     * Kirim snapshot lengkap ke server.
     * api/paper-trading.php memakai pola snapshot: posisi terbuka yang TIDAK ikut dikirim
     * akan dibatalkan. Karena itu posisi otomatis milik server ikut dikirim kembali apa
     * adanya (server sendiri yang melindunginya), dan fungsi ini tidak pernah berjalan dua
     * kali bersamaan.
     */
    async function simpan() {
        if (st.simpanSedangJalan) return { status: 'sibuk' };
        st.simpanSedangJalan = true;
        try {
            const r = await fetch('api/paper-trading.php', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    positions: st.posisi.concat(st.otomatis || []),
                    history: st.riwayat.slice(0, 200),
                }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.message || ('HTTP ' + r.status));
            if (Array.isArray(d.ditolak) && d.ditolak.length) {
                toast('Server menolak ' + d.ditolak.length + ' perubahan: ' + esc(d.ditolak[0].alasan || ''), 'error');
            }
            return d;
        } catch (e) {
            toast('Gagal menyimpan: ' + e.message, 'error');
            return { status: 'error' };
        } finally {
            st.simpanSedangJalan = false;
        }
    }

    async function muatHarga() {
        try {
            const r = await fetch('api/live-price.php?symbols=' + SIMBOL.join(','), { headers: authHeaders(), cache: 'no-store' });
            if (!r.ok) return;
            const d = await r.json();
            const p = d.prices || d.data || {};
            for (const [sym, v] of Object.entries(p)) {
                const harga = parseFloat(v && v.price);
                if (Number.isFinite(harga) && harga > 0) st.harga[sym] = { price: harga, chgPct: parseFloat(v.chgPct ?? 0) };
            }
        } catch (e) { /* diam: harga lama tetap dipakai, cap waktunya terlihat di kartu */ }
        renderHargaKepala();
        renderSaldo();
        renderPosisi();
        renderTiket();
    }

    async function muatPeringkat() {
        const el = $('kompPapan');
        if (!el) return;
        try {
            const r = await fetch('api/competition.php?papan=weekly', { headers: authHeaders(), cache: 'no-store' });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.status !== 'success') {
                el.innerHTML = '<tr><td colspan="5" class="komp-kosong">' + esc(d.message || 'Papan peringkat belum bisa dimuat.') + '</td></tr>';
                return;
            }
            renderTurnamen(d);
            const baris = (d.papan && d.papan.baris) || [];
            if (!baris.length) {
                el.innerHTML = '<tr><td colspan="5" class="komp-kosong">Belum ada peserta yang menutup posisi minggu ini.</td></tr>';
                return;
            }
            const row = (b) => '<tr' + (b.saya ? ' class="saya"' : '') + '>'
                + '<td><span class="komp-rank' + (b.rank <= 3 ? ' r' + b.rank : '') + '">' + b.rank + '</span></td>'
                + '<td class="komp-nama">' + esc(b.nama) + (b.saya ? ' <small>(Anda)</small>' : '') + '</td>'
                + '<td class="num ' + (b.profit_pct >= 0 ? 'naik' : 'turun') + '">' + (b.profit_pct >= 0 ? '+' : '') + b.profit_pct.toFixed(2) + '%</td>'
                + '<td class="num">' + b.trades + '</td>'
                + '<td class="num">' + b.win_rate + '%</td></tr>';
            let html = baris.map(row).join('');
            if (d.papan.saya_di_luar) html += '<tr class="pemisah"><td colspan="5">⋯</td></tr>' + row(d.papan.saya_di_luar);
            el.innerHTML = html;
        } catch (e) {
            el.innerHTML = '<tr><td colspan="5" class="komp-kosong">Tidak dapat menghubungi server kompetisi.</td></tr>';
        }
    }

    function renderTurnamen(d) {
        const t = d.turnamen || {};
        const nama = $('kompTurnamen');
        if (nama) nama.textContent = t.nama || 'Turnamen';
        const per = $('kompPeriode');
        if (per && t.selesai) {
            const sisa = new Date(t.selesai).getTime() - Date.now();
            per.textContent = sisa > 0
                ? 'Berakhir dalam ' + Math.floor(sisa / 864e5) + ' hari ' + Math.floor((sisa % 864e5) / 36e5) + ' jam'
                : 'Periode selesai';
        }
        const daftar = $('kompDaftar');
        if (daftar) {
            daftar.classList.toggle('hidden', !!t.terdaftar);
            daftar.dataset.turnamen = t.kunci || 'weekly-championship';
        }
        const status = $('kompStatusDaftar');
        if (status) status.textContent = t.terdaftar ? '✓ Anda terdaftar' : 'Belum terdaftar — peringkat tetap dihitung, hadiah butuh pendaftaran';
        const saya = d.saya;
        const rank = $('kompRankSaya');
        if (rank) rank.textContent = saya ? '#' + saya.rank + ' dari ' + saya.dari : '—';
    }

    // ── Chart ───────────────────────────────────────────────────────────────
    async function muatCandle() {
        if (st.memuatCandle) return;
        st.memuatCandle = true;
        const badge = $('kompSumber');
        try {
            const r = await fetch('api/get-chart-data.php?symbol=' + encodeURIComponent(st.simbol) + '&interval=' + encodeURIComponent(st.tf),
                { headers: authHeaders(), cache: 'no-store' });
            const d = await r.json();
            // Candle simulasi = 201 batang hasil rand() saat semua sumber nyata gagal.
            // Arena kompetisi TIDAK boleh dimainkan di atas angka acak.
            if (d.simulated === true) {
                st.candleTerakhir = [];
                if (badge) { badge.textContent = 'DATA SIMULASI — TIDAK DIPAKAI'; badge.className = 'komp-sumber bahaya'; }
                gambarKosong('Sumber candle nyata sedang tidak tersedia. Chart sengaja dikosongkan daripada menampilkan angka acak.');
                return;
            }
            const candles = Array.isArray(d.candles) ? d.candles : [];
            if (!candles.length) {
                st.candleTerakhir = [];
                if (badge) { badge.textContent = 'TIDAK ADA DATA'; badge.className = 'komp-sumber bahaya'; }
                gambarKosong('Candle tidak tersedia untuk ' + st.simbol + ' pada timeframe ini.');
                return;
            }
            st.candleTerakhir = candles;
            st.sumberCandle = String(d.source || '');
            if (badge) {
                const mt5 = /^mt5/.test(st.sumberCandle);
                badge.textContent = mt5 ? 'MT5 · BROKER QI' : st.sumberCandle.toUpperCase();
                badge.className = 'komp-sumber ' + (mt5 ? 'mt5' : 'biasa');
                badge.title = mt5
                    ? 'Candle berasal dari bridge MT5 broker — sama dengan yang Anda lihat di terminal MT5.'
                    : 'Candle dari penyedia cadangan (' + st.sumberCandle + '), bukan bridge MT5.';
            }
            gambarChart(candles);
        } catch (e) {
            gambarKosong('Gagal memuat candle: ' + e.message);
        } finally {
            st.memuatCandle = false;
        }
    }

    function gambarKosong(pesan) {
        const w = $('kompChart');
        if (!w) return;
        if (st.chart) { try { st.chart.remove(); } catch (e) {} st.chart = null; st.seri = null; st.garis = []; }
        w.innerHTML = '<div class="komp-chart-kosong">' + esc(pesan) + '</div>';
    }

    function gambarChart(candles) {
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
                upColor: '#10B981', downColor: '#EF4444', borderVisible: false,
                wickUpColor: '#10B981', wickDownColor: '#EF4444',
                priceFormat: { type: 'price', precision: dp(st.simbol), minMove: Math.pow(10, -dp(st.simbol)) },
            });
        }
        st.seri.applyOptions({ priceFormat: { type: 'price', precision: dp(st.simbol), minMove: Math.pow(10, -dp(st.simbol)) } });
        st.seri.setData(candles.map((c) => ({
            time: Number(c.time), open: +c.open, high: +c.high, low: +c.low, close: +c.close,
        })));
        st.chart.timeScale().fitContent();
        gambarGarisPosisi();
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
                try {
                    st.garis.push(st.seri.createPriceLine({
                        price: v, color: c, lineWidth: 1,
                        lineStyle: gaya, axisLabelVisible: true, title: judul,
                    }));
                } catch (e) {}
            };
            tambah(p.entryPrice, warna, p.side + ' ' + p.lots, 0);
            tambah(p.sl, '#EF4444', 'SL', 2);
            tambah(p.tp, '#10B981', 'TP', 2);
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    function renderHargaKepala() {
        const d = st.harga[st.simbol];
        const h = $('kompHarga');
        const c = $('kompUbah');
        if (h) h.textContent = d ? fmtHarga(st.simbol, d.price) : '—';
        if (c) {
            const pct = d ? Number(d.chgPct || 0) : null;
            c.textContent = pct === null ? '' : (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
            c.className = 'komp-ubah ' + (pct === null ? '' : pct >= 0 ? 'naik' : 'turun');
        }
    }

    function renderSaldo() {
        const mg = mengambang();
        const ekuitas = st.saldo + mg;
        const set = (id, teks, kelas) => {
            const el = $(id);
            if (!el) return;
            el.textContent = teks;
            if (kelas !== undefined) el.className = kelas;
        };
        set('kompSaldo', fmtUsd(st.saldo));
        set('kompEkuitas', fmtUsd(ekuitas));
        set('kompMengambang', fmtUsdTanda(mg), 'komp-nilai ' + (mg >= 0 ? 'naik' : 'turun'));
        const r = realisasi();
        set('kompRealisasi', fmtUsdTanda(r), 'komp-nilai ' + (r >= 0 ? 'naik' : 'turun'));
        const pct = ((ekuitas - SALDO_AWAL) / SALDO_AWAL) * 100;
        set('kompReturn', (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', 'komp-nilai ' + (pct >= 0 ? 'naik' : 'turun'));
    }

    function renderPosisi() {
        const body = $('kompPosisi');
        const jml = $('kompPosisiJml');
        if (!body) return;
        if (jml) jml.textContent = String(st.posisi.length);
        if (!st.posisi.length) {
            body.innerHTML = '<tr><td colspan="8" class="komp-kosong">Belum ada posisi terbuka. Gunakan tiket di sebelah kanan.</td></tr>';
        } else {
            body.innerHTML = st.posisi.map((p) => {
                const hk = st.harga[p.symbol]?.price;
                const pnl = pnlPosisi(p, hk);
                return '<tr>'
                    + '<td class="komp-nama">' + esc(p.symbol) + '</td>'
                    + '<td><span class="komp-sisi ' + (p.side === 'BUY' ? 'buy' : 'sell') + '">' + esc(p.side) + '</span></td>'
                    + '<td class="num">' + Number(p.lots).toFixed(2) + '</td>'
                    + '<td class="num">' + fmtHarga(p.symbol, p.entryPrice) + '</td>'
                    + '<td class="num">' + (hk ? fmtHarga(p.symbol, hk) : '—') + '</td>'
                    + '<td class="num">' + (p.sl ? fmtHarga(p.symbol, p.sl) : '—') + ' / ' + (p.tp ? fmtHarga(p.symbol, p.tp) : '—') + '</td>'
                    + '<td class="num ' + (pnl === null ? '' : pnl >= 0 ? 'naik' : 'turun') + '">' + (pnl === null ? '<span title="Harga live belum tersedia — P/L tidak ditebak">—</span>' : fmtUsdTanda(pnl)) + '</td>'
                    + '<td><button type="button" class="komp-tutup" data-tutup="' + esc(p.id) + '">Tutup</button></td>'
                    + '</tr>';
            }).join('');
        }
        // Posisi dari bot: ditampilkan apa adanya supaya pengguna tahu statusnya.
        const bot = $('kompBot');
        if (bot) {
            const n = (st.otomatis || []).length;
            bot.classList.toggle('hidden', n === 0);
            if (n) bot.textContent = n + ' posisi otomatis (AI / Ikuti Auto Analisa) sedang terbuka di akun Anda. '
                + 'Posisi itu dikelola server, tidak bisa ditutup dari arena, dan TIDAK dihitung papan peringkat.';
        }
        gambarGarisPosisi();
    }

    function renderTiket() {
        const d = st.harga[st.simbol];
        const beli = $('kompHargaBeli');
        const jual = $('kompHargaJual');
        if (beli) beli.textContent = d ? fmtHarga(st.simbol, d.price) : '—';
        if (jual) jual.textContent = d ? fmtHarga(st.simbol, d.price) : '—';
        const sym = $('kompTiketSimbol');
        if (sym) sym.textContent = st.simbol;
    }

    function renderPemilih() {
        const s = $('kompSimbol');
        if (s && !s.options.length) {
            s.innerHTML = SIMBOL.map((x) => '<option value="' + x + '">' + x + '</option>').join('');
        }
        if (s) s.value = st.simbol;
        const tf = $('kompTf');
        if (tf && !tf.children.length) {
            tf.innerHTML = TF.map((t) => '<button type="button" class="komp-tf" data-tf="' + t.nilai + '">' + t.label + '</button>').join('');
        }
        if (tf) tf.querySelectorAll('[data-tf]').forEach((b) => b.classList.toggle('aktif', b.dataset.tf === st.tf));
    }

    // ── Aksi ────────────────────────────────────────────────────────────────
    async function order(arah) {
        const d = st.harga[st.simbol];
        const harga = d && Number(d.price);
        if (!Number.isFinite(harga) || harga <= 0) {
            toast('Harga live ' + st.simbol + ' belum tersedia — order tidak dikirim.', 'error');
            return;
        }
        const lot = parseFloat($('kompLot')?.value || '0');
        if (!(lot >= 0.01 && lot <= 100)) { toast('Lot harus antara 0,01 dan 100.', 'error'); return; }
        const sl = parseFloat($('kompSl')?.value) || null;
        const tp = parseFloat($('kompTp')?.value) || null;
        // Arah SL/TP diperiksa di sini supaya kesalahan ketik tidak jadi posisi yang langsung salah.
        if (sl !== null) {
            const salah = arah === 'BUY' ? sl >= harga : sl <= harga;
            if (salah) { toast('Stop loss ' + arah + ' harus ' + (arah === 'BUY' ? 'di bawah' : 'di atas') + ' harga sekarang.', 'error'); return; }
        }
        if (tp !== null) {
            const salah = arah === 'BUY' ? tp <= harga : tp >= harga;
            if (salah) { toast('Take profit ' + arah + ' harus ' + (arah === 'BUY' ? 'di atas' : 'di bawah') + ' harga sekarang.', 'error'); return; }
        }
        st.posisi.push({
            id: 'KOMP-' + Date.now(),
            symbol: st.simbol, side: arah, lots: lot,
            entryPrice: harga, sl, tp,
            openedAt: new Date().toISOString(),
            openTime: new Date().toLocaleTimeString('id-ID'),
        });
        renderPosisi();
        renderSaldo();
        const hasil = await simpan();
        await muatPosisi();                      // id resmi (POS-…) datang dari server
        if (hasil && hasil.status === 'success') {
            toast('Order ' + arah + ' ' + lot + ' lot ' + st.simbol + ' @ ' + fmtHarga(st.simbol, harga) + ' tercatat.', 'sukses');
        }
        muatPeringkat();
    }

    async function tutup(id) {
        const i = st.posisi.findIndex((p) => String(p.id) === String(id));
        if (i < 0) return;
        const p = st.posisi[i];
        const hk = st.harga[p.symbol]?.price;
        if (!Number.isFinite(Number(hk)) || Number(hk) <= 0) {
            toast('Harga live ' + p.symbol + ' belum tersedia — posisi tidak ditutup supaya P/L tidak dikarang.', 'error');
            return;
        }
        const pnl = pnlPosisi(p, hk);
        const kini = new Date();
        st.riwayat.unshift(Object.assign({}, p, {
            closePrice: Number(hk), realizedPnL: pnl, pnl,
            closeTime: kini.toLocaleTimeString('id-ID'), closedAt: kini.toISOString(),
        }));
        st.posisi.splice(i, 1);
        st.saldo += pnl;
        renderPosisi();
        renderSaldo();
        const hasil = await simpan();
        await muatPosisi();
        if (hasil && hasil.status === 'success') {
            toast('Posisi ditutup · ' + fmtUsdTanda(pnl), pnl >= 0 ? 'sukses' : 'info');
        }
        muatPeringkat();
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
        muatPeringkat();
    }

    // ── Pemasangan ──────────────────────────────────────────────────────────
    function pasangPendengar() {
        $('kompSimbol')?.addEventListener('change', (e) => {
            st.simbol = e.target.value;
            renderPemilih(); renderHargaKepala(); renderTiket();
            muatCandle();
        });
        $('kompTf')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tf]');
            if (!b) return;
            st.tf = b.dataset.tf;
            renderPemilih();
            muatCandle();
        });
        $('kompBeli')?.addEventListener('click', () => order('BUY'));
        $('kompJual')?.addEventListener('click', () => order('SELL'));
        $('kompPosisi')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tutup]');
            if (b) tutup(b.dataset.tutup);
        });
        $('kompDaftar')?.addEventListener('click', (e) => daftarTurnamen(e.currentTarget.dataset.turnamen));
        // Langkah SL/TP cepat
        document.querySelectorAll('[data-isi]').forEach((b) => {
            b.addEventListener('click', () => {
                const d = st.harga[st.simbol];
                if (!d) { toast('Harga belum tersedia.', 'error'); return; }
                const jenis = b.dataset.isi;                 // 'sl' | 'tp'
                const pips = Number(b.dataset.pips) || 0;
                const satuan = Math.pow(10, -dp(st.simbol)) * pips;
                const naik = jenis === 'tp';
                const nilai = st.arah === 'BUY'
                    ? (naik ? d.price + satuan : d.price - satuan)
                    : (naik ? d.price - satuan : d.price + satuan);
                const input = $(jenis === 'sl' ? 'kompSl' : 'kompTp');
                if (input) input.value = nilai.toFixed(dp(st.simbol));
            });
        });
        document.querySelectorAll('[data-arah]').forEach((b) => {
            b.addEventListener('click', () => {
                st.arah = b.dataset.arah;
                document.querySelectorAll('[data-arah]').forEach((x) => x.classList.toggle('aktif', x.dataset.arah === st.arah));
            });
        });
    }

    function mulai() {
        renderPemilih();
        pasangPendengar();
        renderSaldo();
        renderTiket();
        muatPosisi();
        muatHarga();
        muatPeringkat();
        if (window._lwModules) muatCandle();
        else window.addEventListener('lc-modules-ready', muatCandle, { once: true });

        setInterval(muatHarga, 15000);
        setInterval(muatPeringkat, 60000);
        // Candle disegarkan lebih jarang: satu permintaan = sampai 1.000 batang.
        setInterval(() => { if (document.visibilityState === 'visible') muatCandle(); }, 60000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
    else mulai();
})();
