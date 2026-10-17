/**
 * QIM HEADER — tiga penunjuk di header dashboard:
 *   1. Lampu STATUS DATA   : sumber harga yang BENAR-BENAR dipakai chart saat ini (MT5 / OANDA /
 *                            cadangan / simulasi / pasar tutup) + umur tick. Bukan label tetap.
 *   2. SESI PASAR          : Sydney, Tokyo, London, New York (buka/tutup) + hitung mundur.
 *   3. LENCANA PAKET       : FREE (tombol Upgrade) / PRO / VIP / ADMIN.
 *
 * Fungsi inti murni (tanpa DOM) supaya bisa diuji di Node; bagian DOM hanya merender hasilnya.
 * Sumber data: api/live-price.php (event 'qim-prices'), soket MT5 (window.QIMMT5Socket),
 * chart quantum (window.qiChartKonteks()), dan window.QI_PERAN.
 */
(function (root) {
    'use strict';

    // ── 1. STATUS DATA ───────────────────────────────────────────────────────
    const UMUR_LIVE_DETIK = 15;       // tick MT5 ≤ 15 dtk = live
    const UMUR_LAMBAT_DETIK = 180;    // > 3 menit tanpa tick = tidak ada aliran
    const SUMBER_UTAMA = ['mt5', 'mt5_bridge', 'mt5_tick', 'oanda_tv'];
    const LABEL_SUMBER = {
        mt5: 'MT5', mt5_bridge: 'MT5', mt5_tick: 'MT5', oanda_tv: 'OANDA', binance: 'BINANCE', binance_ws: 'BINANCE',
        binance_paxg: 'PAXG (proksi)', twelvedata: 'TWELVEDATA', biquote: 'BIQUOTE', candle_m1: 'BIQUOTE', candle_h1: 'BIQUOTE',
        simulasi: 'SIMULASI',
    };
    const namaSumber = s => LABEL_SUMBER[s] || String(s || '').toUpperCase() || '—';

    function teksUmur(detik) {
        const s = Math.max(0, Math.round(Number(detik) || 0));
        if (s < 90) return s + ' dtk';
        if (s < 5400) return Math.round(s / 60) + ' mnt';
        return s < 172800 ? Math.round(s / 3600) + ' jam' : Math.round(s / 86400) + ' hari';
    }

    /**
     * @param {object} i
     *   simbol        kode simbol chart (mis. 'XAUUSD')
     *   simbolBridge  true bila simbol ini seharusnya dari MT5/OANDA (bukan Binance langsung)
     *   harga         baris api/live-price.php untuk simbol ini: { source, market, tick_age } atau null
     *   sumberCandle  sumber candle chart (api/get-chart-data.php) atau ''
     *   soket         { state: 'live'|..., umurDetik: number|null } — soket MT5 untuk simbol ini
     * @returns {{tingkat:'ok'|'warn'|'bad'|'idle', label:string, judul:string}}
     */
    function hitungStatusData(i) {
        const harga = i.harga || null;
        const sumber = (harga && harga.source) || i.sumberCandle || '';
        if (sumber === 'simulasi' || i.sumberCandle === 'simulasi') {
            return { tingkat: 'bad', label: 'SIMULASI', judul: 'Data simulasi — BUKAN harga pasar. Jangan dipakai untuk keputusan trading.' };
        }
        if (!harga && !i.sumberCandle && !(i.soket && i.soket.state === 'live')) {
            return { tingkat: 'idle', label: 'MEMUAT', judul: 'Menunggu data harga pertama.' };
        }
        const soketLive = !!(i.soket && i.soket.state === 'live' && i.soket.umurDetik !== null && i.soket.umurDetik !== undefined);
        if (soketLive) {
            const umur = i.soket.umurDetik;
            if (umur <= UMUR_LIVE_DETIK) {
                return { tingkat: 'ok', label: 'MT5 · LIVE', judul: 'Harga langsung dari broker MT5 (VPS) untuk ' + i.simbol + ' — tick terakhir ' + teksUmur(umur) + ' lalu.' };
            }
            if (umur <= UMUR_LAMBAT_DETIK) {
                return { tingkat: 'warn', label: 'MT5 · ' + teksUmur(umur), judul: 'Soket MT5 tersambung tetapi tick ' + i.simbol + ' terakhir ' + teksUmur(umur) + ' lalu (pasar sepi atau feed melambat).' };
            }
        }
        if (harga && harga.market === 'closed') {
            return { tingkat: 'idle', label: 'PASAR TUTUP', judul: 'Pasar ' + i.simbol + ' sedang tutup (tick terakhir ' + teksUmur(harga.tick_age) + ' lalu). Harga memang diam, bukan kerusakan data.' };
        }
        if (soketLive) {   // soket tersambung tetapi sunyi > 3 menit dan pasar tidak ditandai tutup
            return { tingkat: 'warn', label: 'MT5 · TANPA TICK', judul: 'Soket MT5 tersambung, tetapi tidak ada tick ' + i.simbol + ' selama ' + teksUmur(i.soket.umurDetik) + '.' };
        }
        const nama = namaSumber(sumber);
        if (SUMBER_UTAMA.indexOf(sumber) !== -1) {
            const mt5 = sumber.indexOf('mt5') === 0;
            return { tingkat: 'ok', label: nama, judul: mt5
                ? 'Harga dari MT5 (VPS) lewat polling berkala.'
                : 'Harga dari OANDA lewat TradingView-API (tick tiap ±1 dtk).' };
        }
        if (i.simbolBridge) {
            return { tingkat: 'warn', label: 'CADANGAN · ' + nama, judul: 'Sumber utama (MT5/OANDA) sedang tidak tersedia untuk ' + i.simbol + '. Memakai sumber cadangan ' + nama + ' — harga bisa berbeda dari MT5.' };
        }
        return { tingkat: 'ok', label: nama, judul: 'Harga ' + i.simbol + ' dari ' + nama + '.' };
    }

    // ── 2. SESI PASAR ────────────────────────────────────────────────────────
    // Jam lokal buka/tutup dan zona waktu sama dengan jam dunia di dashboard (TZ_SESSIONS).
    const SESI = [
        { kode: 'SYD', nama: 'Sydney',   tz: 'Australia/Sydney', buka: 7, tutup: 16 },
        { kode: 'TYO', nama: 'Tokyo',    tz: 'Asia/Tokyo',       buka: 9, tutup: 18 },
        { kode: 'LDN', nama: 'London',   tz: 'Europe/London',    buka: 8, tutup: 17 },
        { kode: 'NYC', nama: 'New York', tz: 'America/New_York', buka: 8, tutup: 17 },
    ];
    const HARI = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    function waktuDiZona(date, tz) {
        const bagian = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(date);
        const ambil = t => (bagian.find(p => p.type === t) || {}).value;
        return { hari: HARI[ambil('weekday')], jam: Number(ambil('hour')) % 24, menit: Number(ambil('minute')) };
    }
    const hariKerja = h => h >= 1 && h <= 5;

    /** Menit sampai sesi berikutnya berganti (tutup bila buka; buka bila tutup). Murni. */
    function menitKeGanti(sesi, w) {
        const sekarang = w.jam * 60 + w.menit;
        const buka = sesi.buka * 60, tutup = sesi.tutup * 60;
        if (hariKerja(w.hari) && sekarang >= buka && sekarang < tutup) return { buka: true, menit: tutup - sekarang };
        // Hari kerja berikutnya yang membuka sesi (hari ini bila belum buka).
        let tambahHari = 0;
        if (!(hariKerja(w.hari) && sekarang < buka)) {
            tambahHari = 1;
            while (!hariKerja((w.hari + tambahHari) % 7)) tambahHari++;
        }
        return { buka: false, menit: tambahHari * 1440 + buka - sekarang };
    }

    function sesiPasar(date) {
        const hasil = SESI.map(s => {
            const w = waktuDiZona(date, s.tz);
            const g = menitKeGanti(s, w);
            return { kode: s.kode, nama: s.nama, buka: g.buka, menit: g.menit };
        });
        const terbuka = hasil.filter(s => s.buka);
        return { sesi: hasil, tumpang: terbuka.length >= 2, tutup: terbuka.length === 0 };
    }

    function teksDurasi(menit) {
        const m = Math.max(0, Math.round(menit));
        if (m < 60) return m + ' mnt';
        const j = Math.floor(m / 60), sisa = m % 60;
        if (j < 48) return j + ' j' + (sisa ? ' ' + sisa + ' mnt' : '');
        return Math.round(j / 24) + ' hari';
    }

    // ── 3. LENCANA PAKET ─────────────────────────────────────────────────────
    function lencanaPaket(peran) {
        const p = String(peran || 'free').toLowerCase();
        if (p === 'admin') return { kode: 'admin', teks: 'ADMIN', href: 'profile.html', judul: 'Akun admin' };
        if (p === 'vip') return { kode: 'vip', teks: 'VIP', href: 'profile.html', judul: 'Paket VIP aktif' };
        if (p === 'pro') return { kode: 'pro', teks: 'PRO', href: 'profile.html', judul: 'Paket PRO aktif: data MT5, Setup Analisa, Paper Trading' };
        return { kode: 'free', teks: 'Upgrade', href: 'pricing.html', judul: 'Paket FREE — buka PRO untuk data MT5 dan Setup Analisa' };
    }

    // ── DOM ──────────────────────────────────────────────────────────────────
    const el = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
    let hargaTerakhir = {};

    function simbolAktif() {
        try {
            const k = typeof root.qiChartKonteks === 'function' ? root.qiChartKonteks() : null;
            return k ? { simbol: k.symbol, tv: k.tv || '', sumberCandle: k.source || '' } : { simbol: '', tv: '', sumberCandle: '' };
        } catch (e) { return { simbol: '', tv: '', sumberCandle: '' }; }
    }

    function masukanStatus() {
        const { simbol, tv, sumberCandle } = simbolAktif();
        let soket = null;
        try {
            const s = root.QIMMT5Socket && root.QIMMT5Socket.state();
            if (s) {
                const t = s.lastTickAt && s.lastTickAt[simbol];
                soket = { state: s.state, umurDetik: t ? Math.max(0, (Date.now() - t) / 1000) : null };
            }
        } catch (e) {}
        // Simbol yang seharusnya dari MT5/OANDA (bukan Binance langsung) memakai awalan OANDA: di watchlist.
        const simbolBridge = tv.indexOf('OANDA:') === 0;
        return { simbol: simbol || '—', simbolBridge, harga: hargaTerakhir[simbol] || null, sumberCandle, soket };
    }

    function renderStatus() {
        const kotak = el('qimDataStatus'); if (!kotak) return;
        const h = hitungStatusData(masukanStatus());
        kotak.dataset.tingkat = h.tingkat;
        kotak.title = h.judul;
        kotak.setAttribute('aria-label', 'Status data: ' + h.label + '. ' + h.judul);
        const t = el('qimDataStatusText'); if (t && t.textContent !== h.label) t.textContent = h.label;
    }

    function renderSesi() {
        const kotak = el('qimSessions'); if (!kotak) return;
        const s = sesiPasar(new Date());
        kotak.classList.toggle('overlap', s.tumpang);
        kotak.classList.toggle('tutup', s.tutup);
        s.sesi.forEach(x => {
            let chip = kotak.querySelector('[data-sesi="' + x.kode + '"]');
            if (!chip) {
                chip = document.createElement('span');
                chip.className = 'qim-sess-chip';
                chip.dataset.sesi = x.kode;
                chip.innerHTML = '<i></i>' + x.kode;
                kotak.appendChild(chip);
            }
            chip.classList.toggle('buka', x.buka);
            chip.title = x.nama + ' · ' + (x.buka ? 'BUKA · tutup dalam ' : 'tutup · buka dalam ') + teksDurasi(x.menit);
        });
        kotak.title = s.tutup ? 'Semua sesi utama tutup (akhir pekan / di luar jam)'
            : (s.tumpang ? 'Sesi tumpang tindih — volatilitas biasanya tinggi' : 'Satu sesi utama sedang buka');
    }

    function renderLencana() {
        const a = el('qimPlanBadge'); if (!a) return;
        const l = lencanaPaket(root.QI_PERAN);
        if (a.dataset.kode === l.kode) return;
        a.dataset.kode = l.kode;
        a.hidden = false;
        a.textContent = l.teks;
        a.href = l.href;
        a.title = l.judul;
        a.className = 'qim-plan-badge ' + l.kode;
    }

    function perbaruiSemua() { renderStatus(); renderLencana(); }

    function pasang() {
        if (!el('qimDataStatus') && !el('qimSessions') && !el('qimPlanBadge')) return;
        perbaruiSemua(); renderSesi();
        setInterval(perbaruiSemua, 2000);
        setInterval(renderSesi, 30000);
        if (root.addEventListener) {
            root.addEventListener('qim-prices', ev => { hargaTerakhir = (ev && ev.detail && ev.detail.prices) || hargaTerakhir; renderStatus(); });
            root.addEventListener('qi-chart-data', renderStatus);
        }
    }

    const api = { hitungStatusData, sesiPasar, menitKeGanti, lencanaPaket, teksDurasi, teksUmur, SESI };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.QIMHeader = api;
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
        }
    }
})(typeof window !== 'undefined' ? window : null);
