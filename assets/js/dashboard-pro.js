
// ════════════════════════════════════════════════════════════════════════════
// PANEL MESIN 9 (DASHBOARD) — menghubungkan evaluator dengan chart dashboard.
// Chart tetap milik sendiri (lightweight-charts), bukan widget pihak ketiga,
// sehingga 9 mesin bisa menggambar levelnya langsung di atas chart.
// Sumber data ditampilkan APA ADANYA (termasuk bila sumbernya membatasi riwayat).
// ════════════════════════════════════════════════════════════════════════════
(function () {
    const WARNA = {
        BUY:  { teks: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', garis: '#10B981' },
        SELL: { teks: 'text-rose-400',    bg: 'bg-rose-500/15',    border: 'border-rose-500/40',    garis: '#EF4444' },
        NETRAL: { teks: 'text-slate-400', bg: 'bg-slate-800',      border: 'border-slate-700',      garis: '#64748B' },
        // Dua keadaan jujur yang baru: tidak ada setup sama sekali, atau ada setup
        // tetapi belum cukup mesin sepakat. Keduanya BUKAN sinyal beli/jual.
        'TIDAK ADA SETUP':   { teks: 'text-slate-300', bg: 'bg-slate-800/80', border: 'border-slate-600', garis: '#64748B' },
        'BELUM CUKUP BUKTI': { teks: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/40', garis: '#F59E0B' }
    };
    const el = (id) => document.getElementById(id);

    function intervalDetik() {
        const iv = (typeof _tvInterval !== 'undefined' && _tvInterval) ? String(_tvInterval) : '60';
        const peta = { '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, 'D': 86400, 'W': 604800, 'MN': 2592000 };
        return peta[iv] || 3600;
    }
    function labelTf() {
        const iv = (typeof _tvInterval !== 'undefined' && _tvInterval) ? String(_tvInterval) : '60';
        return ({ '1': '1m', '5': '5m', '15': 'M15', '30': '30m', '60': 'H1', '240': 'H4', 'D': 'D1', 'W': 'W1', 'MN': 'MN1' })[iv] || iv;
    }
    function simbolSekarang() {
        const s = (typeof _tvSymbol !== 'undefined' && _tvSymbol) ? String(_tvSymbol) : 'XAUUSD';
        return s.replace(/^[A-Z]+:/, '').toUpperCase();
    }

    // ── Garis level mesin di chart dashboard ────────────────────────────────
    let _lwMesinLines = [];
    let _lwMesinMarkers = [];
    let _mesinTergambar = null;
    window.bersihkanGarisMesin = function () {
        _lwMesinLines.forEach(pl => { try { if (_lwSeries) _lwSeries.removePriceLine(pl); } catch (e) {} });
        _lwMesinLines = [];
        _lwMesinMarkers = [];
        _mesinTergambar = null;
        // Marker hanya dibersihkan bila memang kita yang memasangnya (jangan menghapus
        // marker indikator lain seperti persilangan Golden Cross).
        if (_markerMesinTerpasang && _lwSeries) {
            pasangMarker(_lwSeries, []);
            _markerMesinTerpasang = false;
        }
        // Hapus juga kotak posisi (entry/TP/SL) dari chart.
        try { if (window.QuantumChartZones) window.QuantumChartZones.hapus(); } catch (e) {}
        const b = el('nineTergambar');
        if (b) b.textContent = '';
    };
    let _markerMesinTerpasang = false;

    // ── Marker sinyal (panah) — memakai evaluator yang sama ─────────────────
    window.tandaiSinyalMesin = function () {
        try {
            if (!_lwSeries || !window.QuantumEngineNine) return;
            const candles = (Array.isArray(_lwLastCandles) && _lwLastCandles.length) ? _lwLastCandles : [];
            if (candles.length < window.QuantumEngineNine.MIN_BAR + 2) {
                if (window.showQuantumToast) window.showQuantumToast('⚠ Data belum cukup untuk menandai sinyal.', 'warning', 3000);
                return;
            }
            const interval = (typeof _tvInterval !== 'undefined' && _tvInterval) ? String(_tvInterval) : '60';
            const peta = { '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, 'D': 86400, 'W': 604800, 'MN': 2592000 };
            const markers = window.QuantumEngineNine.markerSinyal(candles, {
                jumlah: 24, minSkor: 30, jarak: 3, intervalDetik: peta[interval] || 3600
            });
            _lwMesinMarkers = markers;   // dicatat apa pun hasilnya (0 = memang tidak ada)
            if (!markers.length) {
                if (window.showQuantumToast) window.showQuantumToast('Tidak ada sinyal konfluensi yang cukup kuat pada 24 bar terakhir — tidak ada panah dipasang.', 'info', 3500);
                return;
            }
            _lwMesinMarkers = markers;          // disimpan agar bisa diperiksa/dibersihkan
            _markerMesinTerpasang = pasangMarker(_lwSeries, markers);
            if (!_markerMesinTerpasang) {
                if (window.showQuantumToast) window.showQuantumToast('⚠ Panah dihitung, tetapi gagal dipasang ke chart (versi library tidak mendukung).', 'warning', 4000);
                return;
            }
            if (window.showQuantumToast) window.showQuantumToast(`▲▼ ${markers.length} panah sinyal dipasang di chart`, 'success', 2500);
        } catch (e) {
            if (window.showQuantumToast) window.showQuantumToast('Gagal memasang marker sinyal.', 'error', 3000);
        }
    };
    function gambarLevel(nama, arah, level) {
        if (!level || !_lwSeries) return;
        window.bersihkanGarisMesin();
        const w = (WARNA[arah] || WARNA.NETRAL).garis;
        const tambah = (harga, warna, judul, gaya) => {
            try {
                _lwMesinLines.push(_lwSeries.createPriceLine({
                    price: harga, color: warna, lineWidth: 1, lineStyle: gaya || 2,
                    axisLabelVisible: true, title: judul
                }));
            } catch (e) {}
        };
        tambah(level.entry, w, nama + ' entry', 0);
        // Kotak posisi seperti alat "Long/Short Position" TradingView:
        // hijau = entry→TP, merah = entry→SL, plus label harga di sisi kanan.
        // Garis putus-putus SL/TP tidak lagi dipakai supaya tampilan bersih.
        try {
            if (window.QuantumChartZones) {
                window.QuantumChartZones.gambar(
                    document.getElementById('tv_chart_container'), _lwChart, _lwSeries,
                    {
                        entry: level.entry, tp: level.tp, sl: level.sl, arah: arah,
                        label: nama + (level.rr ? ' · R:R ' + level.rr : ''),
                        // Titik awal kotak = candle terakhir (seperti alat posisi TradingView).
                        waktu: (Array.isArray(_lwLastCandles) && _lwLastCandles.length)
                            ? _lwLastCandles[_lwLastCandles.length - 1].time : null
                    }
                );
            }
        } catch (e) {}
        _mesinTergambar = nama;
        const b = el('nineTergambar');
        if (b) b.textContent = 'tergambar: ' + nama + (level.rr ? ' · R:R ' + level.rr : '');
        perbaruiUrl();
    }

    // ── Mode BERSIH & kotak simulasi ────────────────────────────────────────
    // Dua keluhan pengguna yang dijawab di sini:
    //  · "terlalu sempit" → mode bersih memberi candle SELURUH tinggi chart
    //    (panel volume & margin bawah dihilangkan);
    //  · "ticknya mengganggu analisa" → garis harga terakhir disembunyikan, begitu
    //    juga watermark, sehingga chart lega untuk membaca struktur.
    let _modeBersih = false;
    window.toggleBersihChart = function () {
        if (!_lwChart) return;
        _modeBersih = !_modeBersih;
        // Semua dijalankan lewat satu jalur: terapkanGayaChart() — jalur yang sudah
        // terbukti menerapkan watermark, margin, warna candle, dan panel volume.
        try { if (typeof window.terapkanGayaChart === 'function') window.terapkanGayaChart(); } catch (e1) {}
        try {
            const b = document.getElementById('btnBersihChart');
            if (b) { b.classList.toggle('text-qi-cyan', _modeBersih); b.classList.toggle('border-qi-cyan/50', _modeBersih); }
        } catch (e2) {}
        if (window.showQuantumToast) {
            window.showQuantumToast(_modeBersih
                ? '🧹 Mode bersih: volume, watermark, dan garis harga disembunyikan — candle memakai seluruh tinggi.'
                : 'Mode normal: panel volume & watermark ditampilkan kembali.', 'info', 2600);
        }
    };

    window.toggleKotakSimulasi = function () {
        try {
            const k = document.getElementById('kotakSimulasi');
            const t = document.getElementById('simBoxTanda');
            if (!k) return;
            const akanTampil = (k.style.display === 'none');
            k.style.display = akanTampil ? '' : 'none';
            if (t) t.textContent = akanTampil ? '▾' : '▸';
        } catch (e) {}
    };

    // ── Penghalusan tampilan chart ──────────────────────────────────────────
    // Sumber aturannya satu: assets/js/chart-style.js (dipakai dashboard & terminal).
    // Yang diterapkan: zona waktu WIB pada sumbu & label kursor, presisi harga per
    // instrumen (emas 2, JPY 3, mayor FX 5, kripto menyesuaikan), dan watermark
    // "simbol · timeframe" di tengah chart.
    window.terapkanGayaChart = function () {
        try {
            if (!_lwChart || !window.QuantumChartStyle) return false;
            const semua = (typeof WL_GROUPS !== 'undefined') ? WL_GROUPS.flatMap(g => g.syms) : [];
            const entri = semua.find(s => s.tv === (typeof _tvSymbol !== 'undefined' ? _tvSymbol : ''));
            const harga = (Array.isArray(_lwLastCandles) && _lwLastCandles.length)
                ? _lwLastCandles[_lwLastCandles.length - 1].close : undefined;
            const tfLabel = ({ '1': '1m', '5': '5m', '15': 'M15', '30': '30m', '60': 'H1', '240': 'H4', 'D': 'D1', 'W': 'W1', 'MN': 'MN1' })[String(_tvInterval)] || String(_tvInterval);

            const gaya = window.QuantumChartStyle.opsiDasar(entri ? entri.key : _tvSymbol, tfLabel, harga);
            const formatHarga = gaya.priceFormatSeri;
            const warnaSeri = gaya.warnaSeri;   // warna candle dari tema aplikasi
            delete gaya.priceFormatSeri;   // bukan opsi chart — dipakai pada seri
            delete gaya.presisi;
            delete gaya.warnaSeri;

            // MODE BERSIH dikendalikan DI SINI, satu jalur dengan gaya lainnya —
            // inilah jalur yang sudah terbukti bekerja (watermark & margin diterapkan
            // bersama opsi lain, bukan lewat pemanggilan terpisah).
            if (_modeBersih) {
                gaya.watermark = Object.assign({}, gaya.watermark, { visible: false });
                gaya.rightPriceScale = Object.assign({}, gaya.rightPriceScale, { scaleMargins: { top: 0.05, bottom: 0.05 } });
            }

            _lwChart.applyOptions(gaya);
            if (_lwSeries) _lwSeries.applyOptions(Object.assign({ priceFormat: formatHarga }, warnaSeri || {}));
            if (_lwVolume) {
                _lwVolume.applyOptions({ priceFormat: { type: 'volume' }, visible: !_modeBersih });
                // Panel volume 20% bawah, dan margin harga 20% bawah (dari gaya) —
                // keduanya sama supaya candle TIDAK tertutup panel volume.
                try { _lwVolume.priceScale().applyOptions({ scaleMargins: _modeBersih ? { top: 1, bottom: 0 } : { top: 0.80, bottom: 0 } }); } catch (e2) {}
            }
            if (_lwSeries) { try { _lwSeries.applyOptions({ priceLineVisible: !_modeBersih }); } catch (e3) {} }
            return true;
        } catch (e) {
            console.warn('[QI] Gaya chart gagal diterapkan:', e && e.message ? e.message : e);
            return false;
        }
    };

    // ── Tautan bisa dibagikan (?pasar=XAU/USD&tf=m15&mesin=snr) ─────────────
    // Skema ini mengikuti tautan pembanding (analismarket) supaya familier:
    //   pasar = label pasangan (mis. XAU/USD) · tf = timeframe (m15/h1/d1)
    //   mesin = mesin yang sedang digambar di chart (opsional)
    function cariSimbol(nama) {
        const bersih = String(nama || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!bersih) return null;
        const semua = (typeof WL_GROUPS !== 'undefined') ? WL_GROUPS.flatMap(g => g.syms) : [];
        return semua.find(s =>
            String(s.key).toUpperCase() === bersih ||
            String(s.tv).toUpperCase().replace(/[^A-Z0-9]/g, '') === bersih ||
            String(s.label).toUpperCase().replace(/[^A-Z0-9]/g, '') === bersih
        ) || null;
    }
    function tfKeInterval(tf) {
        return ({ m1: '1', m5: '5', m15: '15', m30: '30', h1: '60', h4: '240', d1: 'D', w1: 'W', mn1: 'MN' })[String(tf || '').toLowerCase()] || null;
    }
    function intervalKeTf(iv) {
        return ({ '1': 'm1', '5': 'm5', '15': 'm15', '30': 'm30', '60': 'h1', '240': 'h4', 'D': 'd1', 'W': 'w1', 'MN': 'mn1' })[String(iv)] || null;
    }
    function perbaruiUrl() {
        try {
            if (!window.history || !window.history.replaceState) return;
            const semua = (typeof WL_GROUPS !== 'undefined') ? WL_GROUPS.flatMap(g => g.syms) : [];
            const entri = semua.find(s => s.tv === (typeof _tvSymbol !== 'undefined' ? _tvSymbol : ''));
            const tf = intervalKeTf(typeof _tvInterval !== 'undefined' ? _tvInterval : '');
            if (!entri || !tf) return;
            const p = new URLSearchParams();
            p.set('pasar', String(entri.label).replace(/\s/g, ''));
            p.set('tf', tf);
            if (_mesinTergambar) p.set('mesin', String(_mesinTergambar).toLowerCase());
            const baru = location.pathname + '?' + p.toString();
            if (baru !== location.pathname + location.search) window.history.replaceState(null, '', baru);
        } catch (e) { /* tautan gagal diperbarui bukan masalah besar */ }
    }
    async function terapkanTautan() {
        try {
            const p = new URLSearchParams(location.search);
            const simbol = cariSimbol(p.get('pasar'));
            const tf = tfKeInterval(p.get('tf'));
            if (simbol && typeof window.setChartSymbolFull === 'function') {
                window.setChartSymbolFull(simbol.key, simbol.tv, simbol.label);
                await new Promise(r => setTimeout(r, 600));   // beri waktu chart memuat simbol
            }
            if (tf && typeof window.setChartInterval === 'function') {
                window.setChartInterval(tf);
            }
            // Setelah simbol/timeframe dari tautan diterapkan, hitung ulang mesin DAN
            // terapkan ulang gaya chart. Tanpa ini, watermark masih menulis timeframe
            // lama (mis. "USDJPY · D1" padahal chart sudah H1) — bug nyata yang pernah
            // lolos ke uji.
            if (simbol || tf) {
                await new Promise(r => setTimeout(r, 700));
                if (typeof window.hitungMesinSembilan === 'function') window.hitungMesinSembilan();
                else if (typeof window.terapkanGayaChart === 'function') window.terapkanGayaChart();
            }
            if (simbol || tf) {
                if (window.showQuantumToast) window.showQuantumToast('🔗 Tautan diterapkan: ' + (simbol ? simbol.label : '') + (tf ? ' · ' + p.get('tf').toUpperCase() : ''), 'info', 2500);
            }
        } catch (e) { /* tautan tidak valid diabaikan */ }
    }
    window.terapkanTautanMesin = terapkanTautan;
    window.perbaruiUrlMesin = perbaruiUrl;
    // Aksesori status (read-only) supaya keadaan panel bisa diperiksa dari luar
    // — dipakai alat diagnostik dan memudahkan pengecekan saat ada keluhan.
    window.nineStatus = function () {
        return {
            mesinTergambar: _mesinTergambar,
            markerTerpasang: _markerMesinTerpasang,
            jumlahMarker: _lwMesinMarkers.length,
            contohMarker: _lwMesinMarkers[0] || null,
            garisLevel: _lwMesinLines.length,
            url: location.search
        };
    };

    // ── POLLING CEPAT SIMBOL AKTIF: supaya candle bergerak real-time ────────
    // Masalah nyata yang dilaporkan: "harga chart diam, jauh dari TradingView".
    // Sebabnya dua: (1) sumber emas/FX diperbarui ~1×/menit, (2) chart hanya ikut
    // PENYEGARAN DATA BERKALA (15 detik, satu siklus tertinggal) — bukan aliran tick.
    // Perbaikan ini: setiap 3 detik ambil harga SIMBOL YANG SEDANG TAMPIL saja, lalu
    // suapkan ke qiRealtimeTick() yang memperbarui candle terakhir + OHLC + volume.
    // Ringan (1 permintaan kecil), hemat (berhenti saat tab tidak aktif / chart tidak
    // terlihat), dan tidak menyentuh data riwayat candle.
    let _hargaAktifTerakhir = null;
    let _galatHargaAktif = 0;
    async function pantauHargaAktif() {
        try {
            if (document.hidden) return;
            if (typeof _activePanel !== 'undefined' && _activePanel !== 'panel-charts') return;
            if (typeof _tvSymbol === 'undefined' || !_tvSymbol) return;
            const semua = (typeof WL_GROUPS !== 'undefined') ? WL_GROUPS.flatMap(g => g.syms) : [];
            const entri = semua.find(s => s.tv === _tvSymbol);
            const kode = entri ? entri.key : null;
            if (!kode) return;
            const res = await fetch('api/live-price.php?symbols=' + encodeURIComponent(kode) + '&_=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const d = (data && data.prices) ? data.prices[kode] : null;
            const harga = d ? parseFloat(d.price) : NaN;
            if (!isFinite(harga) || harga <= 0) return;
            _galatHargaAktif = 0;
            if (_hargaAktifTerakhir === harga) return;     // tidak berubah → tidak perlu gambar
            _hargaAktifTerakhir = harga;
            if (typeof window.qiRealtimeTick === 'function') {
                window.qiRealtimeTick(kode, harga, { source: d.source || 'live-price' });
            }
            // Segarkan juga _lastPrices supaya ticker/tape/kartu statistik tetap hidup
            // meski WebSocket Binance diblokir ISP (data dari REST 3 detik).
            try {
                if (typeof _lastPrices !== 'undefined' && _lastPrices && _lastPrices[kode]) {
                    const lama = _lastPrices[kode];
                    _lastPrices[kode] = {
                        price: harga,
                        open: lama.open,
                        high: (lama.high != null) ? Math.max(parseFloat(lama.high), harga) : harga,
                        low: (lama.low != null) ? Math.min(parseFloat(lama.low), harga) : harga,
                        chgPct: (lama.open > 0) ? ((harga - parseFloat(lama.open)) / parseFloat(lama.open) * 100).toFixed(2) : lama.chgPct,
                        vol: lama.vol, source: d.source || 'live-price'
                    };
                    if (typeof renderTicker === 'function') renderTicker(_lastPrices);
                    if (typeof renderMarketTape === 'function') renderMarketTape(_lastPrices);
                    if (typeof updateWatchlistPrices === 'function') updateWatchlistPrices();
                }
            } catch (e) {}
        } catch (e) {
            _galatHargaAktif++;
            // Bila gagal berkali-kali, jangan mengganggu: cukup berhenti mencoba sementara.
            if (_galatHargaAktif > 8) { clearInterval(_timerHargaAktif); _timerHargaAktif = null; }
        }
    }
    let _timerHargaAktif = setInterval(pantauHargaAktif, 3000);
    // Saat tab kembali aktif / panel Charts dibuka, langsung ambil sekali agar tidak
    // menunggu satu interval.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(pantauHargaAktif, 400); });
    document.addEventListener('click', (e) => {
        try { if (e.target.closest('[data-panel="panel-charts"], [data-tf], .tf-btn')) setTimeout(pantauHargaAktif, 500); } catch (err) {}
    });

    // ── PENILAI SINYAL PENYEMBUH SENDIRI (self-healing) ─────────────────────
    // Rekor sinyal hanya terbentuk bila penilai berkala berjalan. Bila cron cPanel
    // belum dipasang, rekor tidak akan pernah bertambah. Karena itu dashboard
    // memicunya sendiri — dengan pengaman berlapis di sisi server:
    //   · WAJIB login (tanpa token → 401, tidak ada beban server),
    //   · dijeda 5 menit (permintaan berikutnya nyaris tanpa biaya),
    //   · klaim ATOMIK (10 permintaan bersamaan = 1 penilaian) — sudah terbukti,
    //   · dibatasi 25 penilaian per jalan.
    // Dipanggil: sekali setelah halaman siap, dan saat panel Track Record / AI Radar
    // dibuka. Sengaja "fire and forget" — kegagalan apa pun tidak boleh mengganggu UI.
    let _sudahMintaNilai = false;
    function mintaPenilaianSinyal() {
        try {
            const token = (window.QuantumAuth && QuantumAuth.getToken) ? QuantumAuth.getToken()
                : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
            if (!token) return;                       // belum login → tidak perlu
            if (document.hidden) return;              // hemat saat tab tidak aktif
            _sudahMintaNilai = true;
            fetch('api/signal-evaluator.php?auto=1&_=' + Date.now(), { cache: 'no-store' })
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d && d.dijalankan) console.debug('[penilai sinyal] dijalankan:', d); })
                .catch(() => {});
        } catch (e) {}
    }
    // 1) Sekali setelah halaman benar-benar siap (jangan berebut dengan render awal).
    window.addEventListener('load', () => setTimeout(mintaPenilaianSinyal, 12000));
    // 2) Saat pengguna membuka panel yang menampilkan rekor sinyal.
    document.addEventListener('click', (e) => {
        try {
            if (e.target.closest('[data-panel="panel-track"], [data-panel="panel-radar"], [data-mob-panel="panel-track"]')) {
                setTimeout(mintaPenilaianSinyal, 400);
            }
        } catch (err) {}
    });
    // 3) Bila tab kembali aktif setelah lama, tidak ada salahnya memeriksa lagi
    //    (server tetap menjeda 5 menit, jadi ini murah).
    document.addEventListener('visibilitychange', () => { if (!document.hidden && _sudahMintaNilai) setTimeout(mintaPenilaianSinyal, 2000); });

    // ── TRADINGVIEW → AI: panel setup (URL webhook, template, uji kirim) ─────
    // URL & kunci hanya diberikan server kepada pengguna PRO/VIP/admin yang login
    // (endpoint memakai qi_require_level('pro')). Kegagalan apa pun di sini tidak
    // boleh mengganggu panel: semuanya dibungkus try/catch dan bersifat opsional.
    let _infoTvDiambil = false;
    async function muatInfoWebhookTv(paksa) {
        try {
            if (_infoTvDiambil && !paksa) return null;
            const res = await fetch('api/tv-webhook.php?info=1&_=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) return null;
            const d = await res.json();
            const url = document.getElementById('tvWebhookUrl');
            const tpl = document.getElementById('tvWebhookTemplate');
            const sim = document.getElementById('tvWebhookSimbol');
            if (url) url.value = d.url || '—';
            if (tpl) tpl.value = d.template || '';
            if (sim) sim.textContent = (d.didukung || []).join(' · ');
            _infoTvDiambil = true;
            return d;
        } catch (e) { return null; }
    }
    function salinTeks(id, pesan) {
        try {
            const el = document.getElementById(id);
            if (!el) return;
            const teks = (el.value !== undefined) ? el.value : (el.textContent || '');
            const kabari = () => { if (typeof showQuantumToast === 'function') showQuantumToast(pesan || 'Tersalin', 'success'); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(teks).then(kabari).catch(() => {
                    try { el.select(); document.execCommand('copy'); kabari(); } catch (e) {}
                });
            } else {
                el.select(); document.execCommand('copy'); kabari();
            }
        } catch (e) {}
    }
    async function ujiKirimWebhookTv() {
        const kotak = document.getElementById('tvWebhookHasil');
        const tampil = (kelas, isi) => {
            if (!kotak) return;
            kotak.className = 'rounded-lg border p-3 text-[10px] font-mono leading-relaxed ' + kelas;
            kotak.innerHTML = isi;
        };
        tampil('border-slate-700 bg-slate-900/70 text-slate-300', '⏳ Mengirim contoh alert XAUUSD ke AI… (biasanya 5–20 detik)');
        try {
            const info = await muatInfoWebhookTv(true);
            if (!info || !info.url) {
                tampil('border-amber-500/40 bg-amber-500/10 text-amber-300',
                    '⚠ URL webhook tidak bisa dimuat. Pastikan paket Anda PRO/VIP dan Anda sudah login, lalu tekan "↺ Muat URL".');
                return;
            }
            const res = await fetch(info.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: 'XAUUSD', timeframe: '60', price: 0, message: 'Uji dari dashboard: RSI divergence + EMA cross up' })
            });
            const d = await res.json();
            if (d.status === 'sinyal_dicatat') {
                tampil('border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                    '✅ SINYAL DICATAT<br>' + (d.sinyal ? (d.sinyal.pair + ' ' + d.sinyal.arah + ' · entry ' + d.sinyal.entry + ' · tp ' + d.sinyal.tp + ' · sl ' + d.sinyal.sl + ' · ' + d.sinyal.rr) : '')
                    + '<br>Keyakinan AI: ' + ((d.ai && d.ai.confidence) || '-') + ' · ' + ((d.ai && d.ai.reason) || '')
                    + '<br><span class="text-emerald-200/70">Cek panel Track Record — sinyal ini sudah masuk rekor.</span>');
            } else if (d.status === 'dilewati') {
                tampil('border-amber-500/40 bg-amber-500/10 text-amber-300',
                    '⏸ AI menilai belum layak (TIDAK dicatat — ini perilaku jujur, bukan galat)<br>'
                    + 'Keputusan: ' + ((d.keputusan && d.keputusan.action) || '-') + ' · keyakinan ' + ((d.keputusan && d.keputusan.confidence) || '-')
                    + '<br>Alasan: ' + ((d.keputusan && d.keputusan.reason) || d.alasan || '-'));
            } else {
                tampil('border-slate-700 bg-slate-900/70 text-slate-300',
                    'Jawaban server: <b>' + (d.status || '-') + '</b><br>' + (d.alasan || d.message || '') + (d.mentah ? ('<br>mentah: ' + d.mentah) : ''));
            }
        } catch (e) {
            tampil('border-rose-500/40 bg-rose-500/10 text-rose-300', '⚠ Gagal menghubungi webhook: ' + e.message);
        }
    }
    // Saat panel AI Radar dibuka → muat info webhook sekali (tanpa memblokir).
    document.addEventListener('click', (e) => {
        try { if (e.target.closest('[data-panel="panel-radar"]')) setTimeout(() => muatInfoWebhookTv(false), 500); } catch (err) {}
    });

    // ── PEMBANGKIT SINYAL OTOMATIS (penyembuh sendiri) ──────────────────────
    // Tanpa cron cPanel, rekor sinyal tidak akan pernah cukup banyak untuk
    // dikalibrasi. Dashboard memicu pembangkit ini dengan pengaman di sisi server:
    // wajib login, jeda 15 menit, klaim ATOMIK, cooldown 4 jam per simbol, maksimal
    // 3 sinyal per jalan, dan DITAHAN bila ada berita berdampak tinggi ±30 menit.
    let _sudahMintaBuat = false;
    function mintaPembangkitSinyal() {
        try {
            const token = (window.QuantumAuth && QuantumAuth.getToken) ? QuantumAuth.getToken()
                : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
            if (!token) return;
            if (document.hidden) return;
            _sudahMintaBuat = true;
            fetch('api/signal-generator.php?auto=1&_=' + Date.now(), { cache: 'no-store' })
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d && d.dibuat) console.debug('[pembangkit sinyal] dibuat:', d.dibuat); })
                .catch(() => {});
            // Sumber sinyal berbasis struktur (mode BAYANGAN): hanya dicatat untuk dibandingkan dengan
            // pembangkit lama, tidak tampil ke pengguna. Dijeda 15 menit & dikunci di sisi server.
            setTimeout(() => {
                fetch('api/signal-setup-shadow.php?auto=1&_=' + Date.now(), { cache: 'no-store' })
                    .then(r => r.ok ? r.json() : null)
                    .then(d => { if (d && d.dibuat) console.debug('[sinyal bayangan] dibuat:', d.dibuat); })
                    .catch(() => {});
            }, 4000);
        } catch (e) {}
    }
    // Dipicu lebih lambat dari penilai (20 detik) agar tidak berebut saat halaman dibuka.
    window.addEventListener('load', () => setTimeout(mintaPembangkitSinyal, 20000));
    document.addEventListener('click', (e) => {
        try {
            if (e.target.closest('[data-panel="panel-track"], [data-mob-panel="panel-track"]')) {
                setTimeout(() => { mintaPenilaianSinyal(); mintaPembangkitSinyal(); }, 400);
            }
        } catch (err) {}
    });

    // ── NEWS SETUP: sinyal ~5 menit sebelum rilis data High impact ───────────
    // Satu panggilan melakukan dua hal: MENJALANKAN pemantau (pemicu penyembuh
    // sendiri; dijeda 60 detik + kunci atomik di server) dan menampilkan hasilnya.
    // Bila ada event 3–7 menit lagi, sinyal diterbitkan untuk simbol yang benar-
    // benar terdampak mata uang event itu (XAUUSD/EURUSD/GBPUSD/USDJPY untuk USD).
    let _newsSedangMemuat = false;
    async function muatNewsSetup() {
        const isi = document.getElementById('newsIsi');
        const st  = document.getElementById('newsStatus');
        if (!isi || _newsSedangMemuat) return;
        _newsSedangMemuat = true;
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        try {
            const r = await fetch('api/signal-news.php?auto=1&_=' + Date.now(), { cache: 'no-store' });
            const d = await r.json();

            let html = '';
            if (d.batal_dini && d.batal_dini.length) {
                html += '<div class="rounded-lg border border-rose-500/50 bg-rose-500/20 p-3 mb-3 text-xs text-rose-200">'
                    + '<div class="font-bold flex items-center gap-1 text-rose-300 mb-1">⚠️ Pembatalan Dini Otomatis (Early Invalidation)</div>'
                    + '<div class="text-[11px] leading-relaxed">'
                    + d.batal_dini.map(b => '• Sinyal <b>' + esc(b.simbol) + '</b> dibatalkan: ' + esc(b.alasan)).join('<br>')
                    + '</div></div>';
            }

            if (d.event) {
                const e = d.event;
                const isPasca = (e.mode === 'POST_RELEASE');
                if (st) st.textContent = isPasca ? ('pasca-rilis ' + e.menit_lagi + ' menit lalu') : ('ada rilis ' + e.menit_lagi + ' menit lagi');
                const dibuat = (d.rincian || []).filter(x => x.hasil === 'sinyal_dibuat');
                const lain   = (d.rincian || []).filter(x => x.hasil !== 'sinyal_dibuat');

                html += '<div class="rounded-lg border ' + (isPasca ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10') + ' p-3 mb-3">'
                    + '<div class="' + (isPasca ? 'text-emerald-300' : 'text-amber-200') + ' font-bold text-xs mb-1">'
                    + (isPasca ? '🚀 MOMENTUM PASCA-RILIS: ' : '⏰ PRE-NEWS: ') + esc(e.judul) + ' — ' + (isPasca ? (e.menit_lagi + ' menit lalu') : (e.menit_lagi + ' menit lagi')) + '</div>'
                    + '<div class="text-[10px] ' + (isPasca ? 'text-emerald-100/90' : 'text-amber-100/90') + '">' + esc(e.mata_uang) + ' · dampak ' + esc(e.dampak)
                    + ' · perkiraan ' + esc(e.perkiraan) + ' · sebelumnya ' + esc(e.sebelumnya) + ' · aktual: <b class="text-white">' + esc(e.aktual || 'belum rilis') + '</b></div>'
                    + (d.fundamental ? ('<div class="text-[10px] ' + (isPasca ? 'text-emerald-100/80' : 'text-amber-100/80') + ' mt-1">' + esc(d.fundamental.teks) + '</div>'
                        + '<div class="text-[9px] ' + (isPasca ? 'text-emerald-200/70' : 'text-amber-200/70') + ' mt-0.5">' + esc(d.fundamental.catatan) + '</div>') : '')
                    + '</div>';

                if (dibuat.length) {
                    html += '<div class="text-qi-green font-bold text-[11px] mb-1">✓ ' + dibuat.length + ' sinyal diterbitkan</div>'
                        + dibuat.map(x => '<div class="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-qi-border/30 font-mono text-[10px]">'
                            + '<div class="flex items-center gap-2">'
                            + '<span class="text-white font-bold w-16">' + esc(x.simbol) + '</span>'
                            + '<span class="' + (x.arah === 'BUY' ? 'text-qi-green' : 'text-qi-red') + ' font-bold w-8">' + esc(x.arah) + '</span>'
                            + '<span class="text-slate-300">entry ' + esc(x.entry) + '</span>'
                            + '<span class="text-qi-green">tp ' + esc(x.tp) + '</span>'
                            + '<span class="text-qi-red">sl ' + esc(x.sl) + '</span>'
                            + '<span class="text-qi-gold">' + esc(x.rr) + '</span>'
                            + '</div>'
                            + '<div class="flex items-center gap-2">'
                            + '<button type="button" class="px-2 py-0.5 rounded bg-qi-blue/20 hover:bg-qi-blue/40 text-qi-blue border border-qi-blue/40 font-sans text-[9px] font-semibold transition cursor-pointer" onclick="if(window.ptOpenDirectPosition)ptOpenDirectPosition(\'' + esc(x.simbol) + '\',\'' + esc(x.arah) + '\',' + x.entry + ',' + x.sl + ',' + x.tp + ',0.05)">⚡ Trade Paper</button>'
                            + '</div>'
                            + '</div>').join('');
                } else {
                    html += '<div class="text-amber-300 text-[11px]">Tidak ada sinyal diterbitkan untuk rilis ini.</div>';
                }
                if (lain.length) {
                    html += '<div class="text-[9px] text-slate-500 mt-1.5">Dilewati: '
                        + lain.map(x => esc(x.simbol) + ' (' + esc(x.hasil) + ')').join(' · ') + '</div>';
                }
                html += '<div class="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-[10px] text-rose-200 leading-relaxed">'
                    + '⚠ <b>Risiko lebih tinggi.</b> Sinyal rilis berita menghadapi fluktuasi spread & volatilitas tajam. '
                    + 'Gunakan ukuran posisi kecil (lot terukur). Statistiknya dihitung terpisah sebagai engine <b>NEWS</b>. Bukan jaminan hasil.</div>';
                isi.innerHTML = html;
            } else {
                if (st) st.textContent = 'tidak ada rilis aktif';
                isi.innerHTML = html + '<div class="text-slate-400">Tidak ada rilis <b class="text-slate-300">High impact</b> aktif dalam jendela 5 menit ke depan atau 20 menit pasca-rilis.</div>'
                    + '<div class="text-[10px] text-slate-500 mt-1">' + esc(d.catatan || '') + '</div>'
                    + '<div class="text-[10px] text-slate-500 mt-2 leading-relaxed">Catatan penting: mesin teknikal (Mesin Otomatis / AI / TradingView) '
                    + 'justru <b class="text-slate-300">ditahan ±30 menit</b> di sekitar rilis High impact. Mesin <b class="text-slate-300">NEWS</b> '
                    + 'sengaja melakukan sebaliknya — menangkap momen rilis — karena itu risikonya lebih tinggi dan statistiknya terpisah.</div>';
            }
        } catch (e) {
            if (isi) isi.innerHTML = '<div class="text-slate-500">Status rilis tidak dapat dimuat saat ini.</div>';
        } finally {
            _newsSedangMemuat = false;
        }
    }
    window.muatNewsSetup = muatNewsSetup;
    window.addEventListener('load', () => setTimeout(() => { try { muatNewsSetup(); } catch (e) {} }, 25000));
    document.addEventListener('click', (e) => {
        try {
            if (e.target.closest('[data-panel="panel-track"], [data-mob-panel="panel-track"]')) {
                setTimeout(() => { try { muatNewsSetup(); } catch (err) {} }, 600);
            }
        } catch (err) {}
    });

    // ── Panel Mesin 9: pembukaan otomatis dipasang di penangan "load" ────────
    // (lihat window.addEventListener('load') di bawah) karena fungsi
    // toggleNinePanel baru didefinisikan setelah blok ini.

    // ── Tinggi panel Mesin 9: dihitung dari RUANG NYATA kolom chart ─────────
    // Batas persen (vh/%) tidak cukup andal: tinggi bar atas berbeda-beda antar
    // perangkat (289px di laptop, 338px di HP) sehingga panel masih bisa meluap dan
    // isi 9 mesin terpotong. Fungsi ini mengukur langsung tinggi kolom chart+panel
    // lalu menyisakan ruang minimum untuk chart — hasilnya pasti muat di perangkat
    // mana pun, termasuk HP.
    function aturTinggiPanelNine() {
        try {
            const panel = el('ninePanel');
            const chart = document.getElementById('tv_chart_container');
            if (!panel || !chart || !chart.parentElement) return;
            // Panel Mesin 9 kini punya HALAMANNYA SENDIRI, bukan lagi di bawah chart.
            // Batas tinggi hanya berlaku bila ia memang berada di kolom chart; kalau
            // tidak, batas inline dibersihkan supaya halaman panel bisa bergulir penuh.
            if (!chart.parentElement.contains(panel)) { panel.style.maxHeight = ''; return; }
            const kolom = chart.parentElement;
            const tinggiKolom = kolom.clientHeight || 0;
            if (tinggiKolom < 200) return;                        // belum terukur
            const chartMin = window.innerWidth < 768 ? 120 : 150;

            // LANGKAH 1 — panel Mesin 9 mengambil PALING BANYAK 45% ruang kolom, dan
            // tidak boleh mendesak chart di bawah tinggi minimumnya. Chart adalah
            // elemen utama di halaman ini (permintaan pengguna: "chartnya nggak full"),
            // jadi sebelumnya panel sempat mengambil SEMUA sisa ruang dan chart tinggal
            // 150px — itu terlalu kecil. Dengan 45%, chart selalu kebagian mayoritas.
            // Pada layar SANGAT kecil (HP kecil/landscape pendek), panel diberi porsi
            // sedikit lebih besar (55%) supaya isi 9 mesin tetap terbaca; di layar lain
            // 45% sudah cukup dan chart tetap mayoritas.
            const bagi = (window.innerHeight <= 700 || window.innerWidth < 400) ? 0.55 : 0.45;
            let maks = Math.min(tinggiKolom * bagi, tinggiKolom - chartMin);
            panel.style.maxHeight = Math.round(Math.max(160, maks)) + 'px';

            // LANGKAH 2 — koreksi terhadap BATAS BAWAH LAYAR, memakai batas bawah KOTAK
            // yang SEBENARNYA (getBoundingClientRect), bukan top+clientHeight. Pada HP
            // keduanya berbeda (clientHeight 506 vs tinggi kotak 557 karena padding),
            // dan selisih itulah yang dulu memotong isi panel ~51px.
            const bawahKolom = kolom.getBoundingClientRect().bottom;
            if (bawahKolom > window.innerHeight) maks -= (bawahKolom - window.innerHeight);
            panel.style.maxHeight = Math.round(Math.max(160, maks)) + 'px';
        } catch (e) {}
    }
    window.aturTinggiPanelNine = aturTinggiPanelNine;
    window.addEventListener('resize', () => { try { aturTinggiPanelNine(); } catch (e) {} });
    if (typeof ResizeObserver === 'function') {
        try {
            const kolomChart = document.getElementById('tv_chart_container');
            if (kolomChart && kolomChart.parentElement) new ResizeObserver(() => aturTinggiPanelNine()).observe(kolomChart.parentElement);
        } catch (e) {}
    }

    // PENTING: satukan kembali fungsi aslinya (jangan sampai badannya menjadi kode
    // yatim — pernah terjadi saat menyunting, dan `return` di luar fungsi akan
    // mematikan SELURUH skrip halaman).
    window.toggleNinePanel = function () {
        const badan = el('nineBody'), chev = el('nineChevron');
        if (!badan) return;
        const tertutup = badan.classList.contains('hidden');
        badan.classList.toggle('hidden', !tertutup);
        if (chev) chev.textContent = tertutup ? '▾' : '▸';
        if (tertutup && !badan.dataset.pernahHitung) window.hitungMesinSembilan();
        // Hitung ulang batas tinggi panel setiap kali dibuka/ditutup supaya isi
        // 9 mesin selalu muat di layar (termasuk HP).
        try { if (typeof window.aturTinggiPanelNine === 'function') window.aturTinggiPanelNine(); } catch (e) {}
        // Tata letak belum final tepat setelah panel dibuka (terutama di HP, tinggi bar
        // atas berubah). Ukur ulang beberapa kali, lalu di HP gulirkan panel ke tampilan
        // supaya isinya PASTI terlihat — bukan hanya "mungkin" terlihat.
        [90, 260, 600, 1100].forEach((tunda) => setTimeout(() => {
            try { if (typeof window.aturTinggiPanelNine === 'function') window.aturTinggiPanelNine(); } catch (e) {}
            try {
                if (tertutup && window.innerWidth < 768) {
                    const p = document.getElementById('ninePanel');
                    if (p) {
                        const r = p.getBoundingClientRect();
                        if (r.bottom > window.innerHeight + 2) p.scrollIntoView({ block: 'end', behavior: 'smooth' });
                    }
                }
            } catch (e) {}
        }, tunda));
        // Ingat pilihan pengguna supaya pembukaan otomatis tidak memaksa lain kali.
        try { localStorage.setItem('qi-nine-terbuka', tertutup ? '1' : '0'); } catch (e) {}
    };

    /** Candle: pakai yang sudah dimuat chart; bila kurang, ambil dari API.
     *
     *  ATURAN INTEGRITAS: 9 mesin TIDAK BOLEH menilai candle acak. Candle simulasi
     *  (dibuat Math.random() saat sumber nyata gagal) DITOLAK di sini, dan alasannya
     *  dikembalikan apa adanya agar panel mengatakannya — bukan menampilkan "sinyal"
     *  dari data karangan. Fungsi ini juga tidak pernah membuat candle sendiri. */
    async function ambilCandle(simbol, interval) {
        const TOLAK = { candles: [], sumber: 'data simulasi ditolak' };
        if (Array.isArray(_lwLastCandles) && _lwLastCandles.length >= window.QuantumEngineNine.MIN_BAR) {
            if (_lwLastCandles.simulated === true) return TOLAK;
            return { candles: _lwLastCandles, sumber: 'chart dashboard' };
        }
        try {
            const r = await fetch(`api/get-history.php?symbol=${simbol}&interval=${interval}&bars=3000`, { signal: AbortSignal.timeout(30000) });
            if (r.ok) {
                const j = await r.json();
                if (j.simulated === true) return TOLAK;
                if (Array.isArray(j.candles) && j.candles.length >= window.QuantumEngineNine.MIN_BAR) {
                    return { candles: j.candles, sumber: `${j.source}${j.limited ? ' (dibatasi sumber)' : ''}` };
                }
            }
        } catch (e) {}
        try {
            const r = await fetch(`api/get-chart-data.php?symbol=${simbol}&interval=${interval}`, { signal: AbortSignal.timeout(30000) });
            const j = await r.json();
            if (j.simulated === true) return TOLAK;
            if (Array.isArray(j.candles)) return { candles: j.candles, sumber: j.source || 'api' };
        } catch (e) {}
        return { candles: [], sumber: '-' };
    }

    /**
     * KARTU ATR & BIAS H4 — setiap angka berasal dari data nyata, dan sumbernya
     * disebutkan apa adanya (tidak ada yang dikarang):
     *   · ATR  : dihitung dari candle yang sedang tampil (periode 14) pada TF aktif.
     *   · Bias : dari candle H4 NYATA (bukan tebakan), memakai EMA50 & EMA200 H4.
     *            Bila bar H4 belum cukup untuk EMA200, itu DIKATAKAN — bukan dipaksa.
     */
    const _cacheH4 = { waktu: 0, simbol: null, candles: null, sumber: '' };
    async function candlesH4(simbol) {
        const sekarang = Date.now();
        // Data H4 tidak berubah cepat: cache 90 detik supaya tidak membebani server.
        if (_cacheH4.candles && _cacheH4.simbol === simbol && (sekarang - _cacheH4.waktu) < 90000) return _cacheH4;
        try {
            const r = await fetch(`api/get-chart-data.php?symbol=${encodeURIComponent(simbol)}&interval=240`, { signal: AbortSignal.timeout(25000) });
            const j = await r.json();
            // Kartu ATR & Bias H4 juga TIDAK boleh memakai candle acak: bila server
            // menandai data sebagai simulasi, kartu ini menampilkan "tidak tersedia".
            if (j.simulated === true) {
                _cacheH4.candles = null; _cacheH4.sumber = 'data simulasi ditolak'; _cacheH4.simbol = simbol; _cacheH4.waktu = sekarang;
            } else if (Array.isArray(j.candles) && j.candles.length >= 30) {
                _cacheH4.candles = j.candles; _cacheH4.sumber = j.source || 'api'; _cacheH4.simbol = simbol; _cacheH4.waktu = sekarang;
            } else {
                _cacheH4.candles = null; _cacheH4.sumber = ''; _cacheH4.simbol = simbol; _cacheH4.waktu = sekarang;
            }
        } catch (e) { _cacheH4.candles = null; _cacheH4.sumber = 'gagal dimuat'; _cacheH4.simbol = simbol; _cacheH4.waktu = sekarang; }
        return _cacheH4;
    }

    function emaSeriKecil(nilai, periode) {
        if (nilai.length < periode) return [];
        const k = 2 / (periode + 1), keluar = [];
        let e = nilai.slice(0, periode).reduce((a, b) => a + b, 0) / periode;
        keluar[periode - 1] = e;
        for (let i = periode; i < nilai.length; i++) { e = nilai[i] * k + e * (1 - k); keluar[i] = e; }
        return keluar;
    }

    async function muatBiasAtr(simbol, candles, sumberCandle) {
        const kotak = el('nineBiasAtr');
        if (!kotak) return;
        try {
            if (!Array.isArray(candles) || candles.length < 20) {
                kotak.innerHTML = '<span class="text-slate-500">ATR &amp; bias belum bisa dihitung — data candle belum cukup.</span>';
                return;
            }
            // ATR periode 14 dari candle TF aktif (Wilder sederhana: rata-rata true range).
            const p = 14;
            let jml = 0, n = 0;
            for (let i = Math.max(1, candles.length - p); i < candles.length; i++) {
                const c = candles[i], prev = candles[i - 1];
                jml += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
                n++;
            }
            const atrVal = n ? jml / n : null;
            const hargaAkhir = candles[candles.length - 1].close;

            // Bias H4 dari data H4 nyata.
            const h4 = await candlesH4(simbol);
            let biasTeks = 'tidak tersedia', biasWarna = 'text-slate-400', dasar = '';
            if (h4.candles && h4.candles.length >= 30) {
                const penutup = h4.candles.map(c => c.close);
                const e50 = emaSeriKecil(penutup, 50);
                const e200 = emaSeriKecil(penutup, 200);
                const e50kini = e50.length ? e50[e50.length - 1] : null;
                const e50lalu = e50.length > 5 ? e50[e50.length - 6] : null;
                const e200kini = e200.length ? e200[e200.length - 1] : null;
                const h4Akhir = penutup[penutup.length - 1];
                if (e50kini !== null && e200kini !== null) {
                    if (h4Akhir > e50kini && e50kini > e200kini) { biasTeks = 'bull'; biasWarna = 'text-emerald-300'; }
                    else if (h4Akhir < e50kini && e50kini < e200kini) { biasTeks = 'bear'; biasWarna = 'text-rose-300'; }
                    else { biasTeks = 'sideways'; biasWarna = 'text-amber-300'; }
                    dasar = `harga ${h4Akhir > e50kini ? 'di atas' : 'di bawah'} EMA50 H4, EMA50 ${e50kini > e200kini ? 'di atas' : 'di bawah'} EMA200 H4`;
                } else if (e50kini !== null) {
                    // Bar H4 belum cukup untuk EMA200 → katakan terus terang.
                    biasTeks = h4Akhir > e50kini ? 'bull (terbatas)' : 'bear (terbatas)';
                    biasWarna = h4Akhir > e50kini ? 'text-emerald-300' : 'text-rose-300';
                    const arah = e50lalu !== null ? (e50kini > e50lalu ? 'menanjak' : 'menurun') : 'datar';
                    dasar = `EMA50 H4 ${arah}${e200kini === null ? ' · EMA200 H4 belum terbentuk (' + h4.candles.length + ' bar H4)' : ''}`;
                }
            } else if (h4.candles === null) {
                dasar = 'candle H4 tidak tersedia (' + (h4.sumber || 'sumber kosong') + ')';
            }

            const namaTf = labelTf();
            const jam = window.QuantumChartStyle ? window.QuantumChartStyle.labelLengkap(candles[candles.length - 1].time) : null;
            kotak.innerHTML = `
                <div class="text-slate-300 font-bold">${simbol} · ${namaTf} · <span class="text-white">${Number(hargaAkhir).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div class="text-slate-500 mt-0.5">${jam ? jam + ' · ' : ''}lilin: ${sumberCandle || '-'}${_mesinTergambar ? ' · mesin: ' + _mesinTergambar : ''}</div>
                <div class="mt-1">ATR <b class="text-white">${atrVal === null ? '-' : atrVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> <span class="text-slate-500">(periode 14, TF ${namaTf}, ${candles.length} bar)</span></div>
                <div>Bias H4 <b class="${biasWarna}">${biasTeks}</b> <span class="text-slate-500">${dasar ? '· ' + dasar : ''}</span></div>
            `;
            // Overlay kecil di sudut chart (seperti chart profesional): ATR & bias
            // sekilas tanpa memakan ruang chart. Isinya sama dengan kartu di atas.
            const overlay = el('chartAtrBias');
            if (overlay) {
                overlay.innerHTML = `<div>${simbol} · ${namaTf} · <b style="color:#fff">${Number(hargaAkhir).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>`
                    + `<div>ATR <b style="color:#fff">${atrVal === null ? '-' : atrVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> · Bias H4 <b class="${biasWarna}">${biasTeks}</b></div>`;
                overlay.classList.remove('hidden');
            }
        } catch (e) {
            kotak.innerHTML = '<span class="text-slate-500">ATR &amp; bias gagal dihitung (dilewati, chart tetap aman).</span>';
        }
    }

    window.hitungMesinSembilan = async function () {
        const daftar = el('nineDaftar'), peringatan = el('ninePeringatan'), konf = el('nineKonfluensi');
        const ringkas = el('nineRingkas'), label = el('nineSimbol');
        if (!daftar || !window.QuantumEngineNine) return;
        const badan = el('nineBody');
        if (badan) badan.dataset.pernahHitung = '1';

        const simbol = simbolSekarang();
        const interval = (typeof _tvInterval !== 'undefined' && _tvInterval) ? String(_tvInterval) : '60';
        if (label) label.textContent = `${simbol} · ${labelTf()}`;
        daftar.innerHTML = '<div class="text-[11px] text-slate-500 font-mono py-2 text-center">⏳ Menghitung 9 mesin…</div>';
        if (peringatan) peringatan.classList.add('hidden');

        const ambil = await ambilCandle(simbol, interval);
        const hasil = window.QuantumEngineNine.evaluasi(ambil.candles, { intervalDetik: intervalDetik() });

        if (ringkas) {
            const k = hasil.konfluensi;
            if (!k) {
                ringkas.textContent = 'data tidak tersedia';
                ringkas.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700';
            } else {
                const w = WARNA[k.putusan] || WARNA.NETRAL;
                ringkas.textContent = `${k.putusan} · skor ${k.skor} · ${k.keyakinan}`;
                ringkas.className = `text-[10px] font-mono px-2 py-0.5 rounded border ${w.bg} ${w.teks} ${w.border}`;
            }
        }

        if (!hasil.cukupData && peringatan) {
            peringatan.classList.remove('hidden');
            // Bila yang tersedia hanya data simulasi, katakan tegas: mesin menolak menilai.
            peringatan.textContent = (ambil.sumber === 'data simulasi ditolak')
                ? '⛔ Sumber data nyata sedang tidak tersedia dan yang ada hanya DATA SIMULASI (candle acak). Mesin TIDAK menilai agar tidak menampilkan sinyal dari data karangan. Coba lagi nanti.'
                : `⚠ ${hasil.alasan} Sumber data: ${ambil.sumber}.`;
        } else if (hasil.basi && peringatan) {
            peringatan.classList.remove('hidden');
            peringatan.textContent = `⚠ Data terakhir berumur ${Math.round((hasil.umurDetik || 0) / 60)} menit — sinyal di bawah berasal dari candle terakhir yang tersedia.`;
        }

        if (konf && hasil.konfluensi) {
            const k = hasil.konfluensi, w = WARNA[k.putusan] || WARNA.NETRAL;
            konf.innerHTML = `
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded border font-bold ${w.bg} ${w.teks} ${w.border}">${k.putusan}</span>
                    <span class="text-slate-300">skor konfluensi <b class="${w.teks}">${k.skor}</b>/100</span>
                    <span class="text-slate-500">·</span>
                    <span class="text-slate-200 font-semibold">${k.setupValid ?? 0}/9 setup SAH</span>
                    <span class="text-slate-500">·</span>
                    <span class="text-emerald-400">${k.bullish} BUY</span>
                    <span class="text-rose-400">${k.bearish} SELL</span>
                    <span class="text-slate-500">${k.netral} netral</span>
                    <span class="text-slate-500">· keyakinan: <b class="text-slate-300">${k.keyakinan}</b></span>
                </div>
                <div class="text-[10px] text-slate-500 mt-1">Sumber data: <b class="text-slate-400">${ambil.sumber}</b> · ${ambil.candles.length} bar · harga terakhir ${hasil.hargaTerakhir ?? '-'} <span id="nineTergambar" class="text-cyan-400"></span></div>
                <div class="text-[10px] text-slate-500 mt-1">Ambang setup: skor ≥ ${k.ambangSetup ?? 55}, SL di belakang swing nyata, R:R ≥ 1,50. Mesin yang tidak lolos <b class="text-slate-400">tidak ikut memutuskan</b>.</div>
            `;
        }

        // ── STRIP CHIP 9 MESIN ──────────────────────────────────────────────
        // Kondisi setiap mesin terbaca sekilas TANPA membuka panel, sehingga chart
        // tetap penuh (permintaan pengguna) namun sinyal tetap kelihatan.
        const chips = el('nineChips');
        if (chips) {
            chips.innerHTML = hasil.mesin.map(m => {
                const w = WARNA[m.arah] || WARNA.NETRAL;
                const judul = (m.nama + ' · ' + (m.valid ? (m.arah + ' skor ' + m.skor) : 'bukan setup') + ' · ' + (m.alasan || '')).replace(/"/g, '&quot;');
                const kelas = m.valid
                    ? (w.bg + ' ' + w.teks + ' ' + w.border)
                    : 'bg-slate-900 border-slate-700 text-slate-500';
                return '<span title="' + judul + '" class="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono shrink-0 ' + kelas + '">'
                    + '<b>' + m.kode + '</b>'
                    + '<span>' + (m.valid ? m.arah : '—') + '</span>'
                    + (m.valid ? '<span class="text-slate-400">' + m.skor + '</span>' : '')
                    + (m.melawanTren ? '<span class="text-amber-300">⚑</span>' : '')
                    + '</span>';
            }).join('');
        }

        daftar.innerHTML = '';
        for (const m of hasil.mesin) {
            const w = WARNA[m.arah] || WARNA.NETRAL;
            const baris = document.createElement('div');
            baris.className = 'rounded-lg border p-2.5 min-w-0 ' + (m.valid ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/60');
            // Blok level: TIGA KOTAK SEJAJAR (entry · SL · TP) memuat harga DAN areanya.
            // Di HP bertumpuk satu kolom, di layar lebar sejajar — supaya angka tidak
            // berdesakan dan mudah dibandingkan sekilas.
            const z = m.level && m.level.zona ? m.level.zona : null;
            const kotakNilai = (judul, nilai, kelasJudul, kelasNilai, zona) => `
                <div class="rounded-md border border-slate-800 bg-slate-900/60 px-1.5 py-1 min-w-0">
                    <div class="text-[9px] font-semibold ${kelasJudul}">${judul}</div>
                    <div class="text-[11px] font-bold ${kelasNilai} truncate" title="${nilai}">${nilai}</div>
                    ${zona ? `<div class="text-[8px] text-slate-500 truncate" title="area ${zona.dari} – ${zona.ke}">${zona.dari}–${zona.ke}</div>` : ''}
                </div>`;
            const barisLevel = m.level ? `
                <div class="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono">
                    ${kotakNilai('ENTRY', m.level.entry, 'text-slate-500', 'text-slate-200')}
                    ${kotakNilai('SL · AREA', m.level.sl, 'text-rose-400/80', 'text-rose-300', z ? z.sl : null)}
                    ${kotakNilai('TP · AREA', m.level.tp, 'text-emerald-400/80', 'text-emerald-300', z ? z.tp : null)}
                </div>
                <div class="mt-1 text-[9px] text-slate-500 font-mono leading-snug truncate" title="R:R ${m.level.rr} · SL dari ${m.level.slSumber || '-'} · TP dari ${m.level.tpSumber || '-'}">
                    R:R <b class="text-slate-400">${m.level.rr}</b> · SL dari ${m.level.slSumber || '-'} · TP dari ${m.level.tpSumber || '-'}
                </div>
            ` : '';
            baris.innerHTML = `
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded border text-[10px] font-bold ${w.bg} ${w.teks} ${w.border}">${m.arah}</span>
                    ${m.valid ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold" title="Setup sah: ada level struktur, SL/TP punya dasar, R:R memenuhi">SETUP SAH</span>' : '<span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[9px] font-bold" title="Belum layak disebut sinyal">BUKAN SETUP</span>'}
                    <span class="text-[11px] font-bold text-slate-200 truncate">${m.nama}</span>
                    ${m.melawanTren ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9px] font-bold" title="Arah mesin ini berlawanan dengan tren EMA200">⚑ TREN</span>' : ''}
                    <span class="ml-auto flex items-center gap-1.5 shrink-0">
                        <span class="text-[10px] font-mono text-slate-400">skor ${m.skor}</span>
                        ${m.valid ? `<button type="button" onclick="gambarLevelMesin(this)" data-mesin="${m.kode}" data-arah="${m.arah}" data-entry="${m.level.entry}" data-tp="${m.level.tp}" data-sl="${m.level.sl}" data-rr="${m.level.rr || ''}" class="nine-gambar px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold hover:bg-cyan-500/25">Gambar</button>` : ''}
                    </span>
                </div>
                <div class="mt-1.5 h-1 rounded bg-slate-800 overflow-hidden"><div class="h-full ${m.arah === 'BUY' ? 'bg-emerald-500' : m.arah === 'SELL' ? 'bg-rose-500' : 'bg-slate-600'}" style="width:${m.skor}%"></div></div>
                <div class="mt-1.5 text-[10px] text-slate-400 leading-snug">${m.alasan || '-'}</div>
                ${barisLevel}
            `;
            daftar.appendChild(baris);
        }

        // SATU mekanisme klik yang paling andal: atribut onclick langsung pada tombol
        // (dipasang di templat tombol) → fungsi global di bawah. Tidak bergantung pada
        // pendengar yang bisa tertinggal saat daftar digambar ulang, dan tidak
        // bergantung closure. Ini pengganti delegasi yang sempat dipakai.
        window.gambarLevelMesin = function (btn) {
            try {
                if (!btn) return;
                // Bila pengguna sedang memakai chart resmi TradingView, kotak level engine
                // tidak bisa ditumpuk di atas iframe mereka. Jadi kita pindahkan tampilan
                // ke chart Quantum lebih dulu — dan katakan apa adanya, bukan diam-diam.
                if (typeof _modeChart !== 'undefined' && _modeChart === 'tradingview') {
                    if (typeof setChartMode === 'function') setChartMode('quantum', true);
                    if (typeof showQuantumToast === 'function') {
                        showQuantumToast('ℹ️ Chart TradingView adalah iframe milik TradingView, sehingga kotak level engine tidak bisa digambar di atasnya. Tampilan dipindah ke chart Quantum agar levelnya terlihat.', 'info', 5000);
                    }
                    setTimeout(() => { try { window.gambarLevelMesin(btn); } catch (e) {} }, 450);
                    return;
                }
                const kode = btn.getAttribute('data-mesin');
                const level = {
                    entry: Number(btn.getAttribute('data-entry')),
                    tp: Number(btn.getAttribute('data-tp')),
                    sl: Number(btn.getAttribute('data-sl')),
                    rr: Number(btn.getAttribute('data-rr')) || null
                };
                const arah = btn.getAttribute('data-arah');
                if (![level.entry, level.tp, level.sl].every(Number.isFinite)) {
                    if (window.showQuantumToast) window.showQuantumToast(`Mesin ${kode} belum memberi level yang bisa digambar.`, 'warning', 3000);
                    return;
                }
                gambarLevel(kode, arah, level);
                if (window.showQuantumToast) window.showQuantumToast(`📈 Kotak posisi ${kode} (${arah}) digambar — entry · TP · SL`, 'info', 2500);
            } catch (e) {
                if (window.showQuantumToast) window.showQuantumToast('Gagal menggambar kotak posisi.', 'error', 3000);
            }
        };

        // Info kecil: kapan terakhir dihitung (transparansi).
        try {
            const info = el('nineHitungInfo');
            if (info) {
                const jam = window.QuantumChartStyle && window.QuantumChartStyle.labelLengkap
                    ? window.QuantumChartStyle.labelLengkap(Math.floor(Date.now() / 1000)) : new Date().toLocaleTimeString('id-ID');
                info.textContent = 'dihitung ' + (jam || '') + ' · ' + ambil.candles.length + ' bar';
            }
        } catch (e) {}

        // Jaga tautan tetap sesuai keadaan yang sedang dilihat (bisa dibagikan),
        // dan segarkan gaya chart (presisi harga & watermark mengikuti simbol/TF).
        perbaruiUrl();
        if (typeof window.terapkanGayaChart === 'function') window.terapkanGayaChart();
        // Kartu ATR & bias H4 (semua angka dari data nyata).
        muatBiasAtr(simbol, ambil.candles, ambil.sumber);
    };

    // Hitung otomatis saat panel Charts dibuka / simbol / timeframe berubah.
    let timerNine = null;
    const jadwalkan = () => { clearTimeout(timerNine); timerNine = setTimeout(() => { try { window.hitungMesinSembilan(); } catch (e) {} }, 1200); };
    document.addEventListener('DOMContentLoaded', () => setTimeout(jadwalkan, 4000));
    window.addEventListener('load', () => {
        setTimeout(jadwalkan, 5000);
        // Terapkan tautan yang dibagikan (?pasar=…&tf=…&mesin=…) setelah chart siap.
        // Hanya dijalankan bila memang ada parameternya — kalau tidak, tidak menyentuh apa pun.
        try {
            const p = new URLSearchParams(location.search);
            if (p.get('pasar') || p.get('tf')) setTimeout(terapkanTautan, 3500);
        } catch (e) {}

        // ── Strip chip mesin SELALU terlihat → tidak perlu membuka panel otomatis.
        // Inilah yang membuat chart tetap penuh (permintaan pengguna) sementara kondisi
        // 9 mesin tetap terbaca di strip bawah. Cukup ukur tinggi panelnya.
        setTimeout(() => {
            try { if (typeof window.aturTinggiPanelNine === 'function') window.aturTinggiPanelNine(); } catch (e) {}
        }, 6500);
    });
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-panel="panel-charts"], [data-tf], .tf-btn, .chart-tf-btn')) jadwalkan();
    });
})();
