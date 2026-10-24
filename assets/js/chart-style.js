/**
 * GAYA CHART — sumber tunggal untuk penghalusan tampilan chart (dashboard & terminal).
 *
 * KENAPA SATU BERKAS: dashboard memakai lightweight-charts v5 (API beda) dan terminal
 * v4, tetapi OPSI tampilannya sama. Menaruh aturannya di dua tempat = cepat menyimpang
 * (persis masalah yang sudah pernah terjadi pada tabel pengali P/L). Jadi semua aturan
 * tampilan hidup di sini, dan kedua halaman memanggil fungsi yang sama.
 *
 * PILIHAN YANG DISENGAJA (dan alasannya):
 *  - ANGKA memakai gaya Inggris (pemisah ribuan koma, desimal titik): "83,712.01".
 *    Itu konvensi MT5/broker dan konsisten dengan seluruh UI aplikasi ini. (Kalau
 *    dipaksa id-ID, harga jadi "83.712,01" dan berbeda dari terminal broker.)
 *  - TEKS WAKTU memakai Indonesia + zona WIB (Asia/Jakarta): "07:00", "Sen 12 Jan".
 *    Aplikasi ini WIB-based dan pengguna Indonesia.
 *  - PRECISION mengikuti instrumen: emas 2 desimal, JPY 3, mayor FX 5, kripto sesuai
 *    besaran harga. Ini yang membuat label harga tidak "salah bulat" seperti 4187.1
 *    untuk emas atau 1.09 untuk EURUSD.
 */
(function () {
    'use strict';

    const ZONA = 'Asia/Jakarta';

    // Presisi per instrumen. minMove = langkah harga terkecil yang ditampilkan.
    const PRESISI = {
        XAUUSD: { precision: 2, minMove: 0.01 },
        XAGUSD: { precision: 4, minMove: 0.0001 },
        USOIL: { precision: 3, minMove: 0.001 },
        US30: { precision: 1, minMove: 0.1 }, NAS100: { precision: 1, minMove: 0.1 }, SPX500: { precision: 1, minMove: 0.1 },
        GER40: { precision: 1, minMove: 0.1 }, UK100: { precision: 1, minMove: 0.1 }, JP225: { precision: 1, minMove: 0.1 },
        EURUSD: { precision: 5, minMove: 0.00001 },
        GBPUSD: { precision: 5, minMove: 0.00001 },
        AUDUSD: { precision: 5, minMove: 0.00001 },
        NZDUSD: { precision: 5, minMove: 0.00001 },
        USDCHF: { precision: 5, minMove: 0.00001 },
        USDCAD: { precision: 5, minMove: 0.00001 },
        USDJPY: { precision: 3, minMove: 0.001 },
        GBPJPY: { precision: 3, minMove: 0.001 },
        EURJPY: { precision: 3, minMove: 0.001 },
        AUDJPY: { precision: 3, minMove: 0.001 },
        BTCUSDT: { precision: 2, minMove: 0.01 },
        ETHUSDT: { precision: 2, minMove: 0.01 },
        BNBUSDT: { precision: 2, minMove: 0.01 },
        SOLUSDT: { precision: 2, minMove: 0.01 },
        XRPUSDT: { precision: 4, minMove: 0.0001 },
        DOGEUSDT: { precision: 5, minMove: 0.00001 },
        PAXGUSDT: { precision: 2, minMove: 0.01 },
    };

    /** Bersihkan nama simbol: 'OANDA:XAUUSD' → 'XAUUSD'. */
    function kodeBersih(simbol) {
        return String(simbol || '').toUpperCase().replace(/^[A-Z]+:/, '').replace(/[^A-Z0-9]/g, '');
    }

    /**
     * Presisi tampilan harga.
     * @param {string} simbol
     * @param {number} [hargaAcuan] dipakai untuk menebak bila simbol tak dikenal
     */
    function presisi(simbol, hargaAcuan) {
        const kode = kodeBersih(simbol);
        if (PRESISI[kode]) return Object.assign({}, PRESISI[kode]);
        // Simbol tak dikenal: tebak dari besaran harga — dan katakan sebagai tebakan.
        const h = Number(hargaAcuan);
        if (Number.isFinite(h) && h > 0) {
            if (h >= 1000) return { precision: 2, minMove: 0.01, tebakan: true };
            if (h >= 100) return { precision: 3, minMove: 0.001, tebakan: true };
            if (h >= 1) return { precision: 4, minMove: 0.0001, tebakan: true };
            return { precision: 5, minMove: 0.00001, tebakan: true };
        }
        return { precision: 2, minMove: 0.01, tebakan: true };
    }

    // Formatter dibuat SEKALI (membuat Intl.DateTimeFormat berulang itu mahal dan
    // dipanggil untuk setiap label sumbu waktu).
    const F_JAM = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
    const F_JAM_DETIK = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const F_TGL = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, day: '2-digit', month: 'short' });
    const F_BULAN = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, month: 'short' });
    const F_BULAN_TAHUN = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, month: 'short', year: '2-digit' });
    const F_TAHUN = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, year: 'numeric' });
    const F_TGL_PANJANG = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    function keDetik(waktu) {
        if (typeof waktu === 'number') return waktu;
        if (waktu && typeof waktu === 'object' && Number.isFinite(waktu.year)) {
            // BusinessDay {year, month, day} — month 1..12
            return Math.floor(Date.UTC(waktu.year, (waktu.month || 1) - 1, waktu.day || 1) / 1000);
        }
        return null;
    }

    /**
     * Label sumbu waktu (WIB). Menangani tickMarkType lightweight-charts:
     * 0=Year 1=Month 2=DayOfMonth 3=Time 4=TimeWithSeconds
     * Juga menangani BusinessDay (deret harian) selain timestamp.
     */
    function labelWaktu(waktu, tipeTick) {
        try {
            const detik = keDetik(waktu);
            if (detik === null) return null;
            const d = new Date(detik * 1000);
            if (isNaN(d.getTime())) return null;
            switch (Number(tipeTick)) {
                case 0: return F_TAHUN.format(d);
                case 1: return F_BULAN.format(d);
                case 2: return F_TGL.format(d);
                case 4: return F_JAM_DETIK.format(d);
                case 3: return F_JAM.format(d);
                default: return F_TGL.format(d);
            }
        } catch (e) { return null; }
    }

    /** Label lengkap untuk tooltip/label kursor (mis. "Sen, 12 Jan 2026 07:00"). */
    function labelLengkap(waktu) {
        try {
            const detik = keDetik(waktu);
            if (detik === null) return null;
            const d = new Date(detik * 1000);
            if (isNaN(d.getTime())) return null;
            return F_TGL_PANJANG.format(d) + ' ' + F_JAM.format(d) + ' WIB';
        } catch (e) { return null; }
    }

    // Warna dasar chart. NILAI DIAMBIL DARI TEMA APLIKASI (assets/css/tokens.css)
    // supaya chart tidak pernah "beda warna" dengan sisa UI — dan otomatis ikut
    // berubah bila pengguna mengganti tema. Cadangan di bawah dipakai bila variabel
    // tema belum terbaca (mis. saat halaman baru dimuat).
    function dariTema() {
        try {
            if (typeof document === 'undefined' || !document.documentElement) return null;
            const s = window.getComputedStyle(document.documentElement);
            const v = (nama) => { const x = (s.getPropertyValue(nama) || '').trim(); return x || null; };
            return {
                latar: v('--qi-panel'),
                card: v('--qi-card'),
                grid: v('--qi-border'),
                teks: v('--qi-text-muted'),
                border: v('--qi-border'),
                naik: v('--qi-green'),
                turun: v('--qi-red'),
                cyan: v('--qi-cyan'),
                purple: v('--qi-purple')
            };
        } catch (e) { return null; }
    }

    /** Tambahkan transparansi ke warna hex (#RRGGBB → #RRGGBBAA). Selain hex → apa adanya. */
    function denganAlfa(warna, alfaHex) {
        const s = String(warna || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(s) ? s + alfaHex : s;
    }

    function warnaDasar() {
        const t = dariTema() || {};
        return {
            latar: t.latar || '#0D1629',
            card: t.card || '#162040',
            grid: t.grid || '#1E293B',
            teks: t.teks || '#94A3B8',
            border: t.border || '#1E293B',
            crosshair: denganAlfa(t.cyan || '#00E5FF', '55'),
            labelCrosshair: t.purple || '#7C4DFF',
            // Warna candle = BAWAAN TRADINGVIEW (#26A69A / #EF5350) atas permintaan
            // pengguna. Latar, grid, teks, dan label tetap mengikuti TEMA APLIKASI,
            // jadi chart tetap serasi dengan UI sementara candle terasa familiar.
            naik: '#26A69A',
            turun: '#EF5350',
            watermark: denganAlfa(t.teks || '#94A3B8', '14')
        };
    }

    /**
     * Opsi umum chart (aman untuk v4 & v5).
     * Hanya berisi kunci yang MEMANG ada di kedua versi.
     *
     * @param {string} simbol
     * @param {string} intervalLabel  mis. 'H1'
     * @param {number} [hargaAcuan]
     * @param {object} [opsi]  { warna: true|false }
     *        warna:false → JANGAN sentuh palet warna (layout/grid/priceScale).
     *        Dipakai terminal agar warna khasnya tidak berubah tanpa sengaja;
     *        penghalusan fungsional (zona waktu, presisi, watermark, label kursor)
     *        tetap diterapkan.
     */
    function opsiDasar(simbol, intervalLabel, hargaAcuan, opsi) {
        const w = warnaDasar();
        const p = presisi(simbol, hargaAcuan);
        const pakaiWarna = !(opsi && opsi.warna === false);
        const teksWatermark = (kodeBersih(simbol) || 'CHART') + (intervalLabel ? ' · ' + intervalLabel : '');

        const keluar = {
            crosshair: {
                vertLine: { color: w.crosshair, width: 1, style: 3, labelBackgroundColor: w.labelCrosshair },
                horzLine: { color: w.crosshair, width: 1, style: 3, labelBackgroundColor: w.labelCrosshair },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (waktu, tipe) => labelWaktu(waktu, tipe),
            },
            localization: {
                locale: 'id-ID',
                timeFormatter: (waktu) => labelLengkap(waktu),
            },
            watermark: {
                visible: true,
                fontSize: 44,
                horzAlign: 'center',
                vertAlign: 'center',
                color: w.watermark,
                text: teksWatermark,
            },
            priceFormatSeri: { type: 'price', precision: p.precision, minMove: p.minMove },
            presisi: p
        };

        if (pakaiWarna) {
            keluar.layout = {
                background: { color: w.latar },
                textColor: w.teks,
                fontSize: 11,
            };
            keluar.grid = {
                vertLines: { color: denganAlfa(w.grid, '99') },
                horzLines: { color: denganAlfa(w.grid, '99') },
            };
            // Margin harga: bawah 0,20 supaya candle TIDAK tertutup panel volume
            // (dulu 0,12 sementara volume memakai 20% bawah → bagian bawah candle
            // tertutup, chart terasa sempit). Kini keduanya tidak bertumpuk.
            keluar.rightPriceScale = {
                borderColor: w.border,
                scaleMargins: { top: 0.06, bottom: 0.20 },
            };
            keluar.timeScale.borderColor = w.border;
            keluar.timeScale.rightOffset = 12;
            keluar.timeScale.barSpacing = 8;
            // Warna candle ikut tema aplikasi (keluhan: "warnanya tidak sama dengan
            // yang lain"). Diterapkan ke SERI, bukan ke opsi chart.
            keluar.warnaSeri = {
                upColor: w.naik, downColor: w.turun,
                borderUpColor: w.naik, borderDownColor: w.turun,
                wickUpColor: w.naik, wickDownColor: w.turun,
                // Garis harga terakhir dibuat halus (keluhan: "ticknya mengganggu"):
                // putus-putus tipis, bukan garis merah menyala.
                priceLineColor: denganAlfa(w.teks, 'CC'),
                priceLineWidth: 1,
                priceLineStyle: 2
            };
        }

        return keluar;
    }

    window.QuantumChartStyle = {
        presisi,
        kodeBersih,
        labelWaktu,
        labelLengkap,
        warnaDasar,
        opsiDasar,
        ZONA
    };
})();
