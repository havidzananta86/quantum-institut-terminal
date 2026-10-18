/**
 * Penanda berita di chart: garis vertikal pada waktu rilis berita HIGH-impact (NFP, CPI, FOMC, …)
 * untuk mata uang yang memengaruhi simbol chart, plus chip hitung mundur ke berita berikutnya.
 *  - Data: api/calendar.php (ForexFactory, minggu berjalan). Diambil ulang tiap 5 menit.
 *  - Garis: series primitive (lightweight-charts v5) — posisi waktu dihitung lewat indeks logis,
 *    jadi berita yang BELUM terjadi pun tergambar di area kanan setelah candle terakhir.
 *  - Bisa disembunyikan lewat tombol "Berita" di bilah chart (diingat per perangkat).
 * Tidak mengubah data chart, indikator, atau sinyal apa pun.
 */
(function () {
    'use strict';
    const KUNCI_TAMPIL = 'qim_berita_chart';
    const MENIT = 60, JAM = 3600;
    let acara = [];            // [{ t, judul, cur, forecast, previous, actual }]
    let terakhirAmbil = 0;
    let terpasang = null;      // { series, primitive }
    let chip = null;

    const tampil = () => { try { return localStorage.getItem(KUNCI_TAMPIL) !== '0'; } catch (e) { return true; } };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /** Mata uang yang menggerakkan simbol (berita mata uang lain tidak ditandai). */
    function mataUangSimbol(sym) {
        const s = String(sym || '').toUpperCase();
        const indeks = { US30: ['USD'], NAS100: ['USD'], SPX500: ['USD'], USOIL: ['USD'], GER40: ['EUR'], UK100: ['GBP'], JP225: ['JPY', 'USD'] };
        if (indeks[s]) return indeks[s];
        if (/USDT$/.test(s)) return ['USD'];
        if (/^X(AU|AG)USD$/.test(s)) return ['USD'];
        if (/^[A-Z]{6}$/.test(s)) return [s.slice(0, 3), s.slice(3)];
        return ['USD'];
    }

    async function muat(paksa) {
        if (!paksa && acara.length && Date.now() - terakhirAmbil < 5 * 60 * 1000) return;
        terakhirAmbil = Date.now();
        try {
            const r = await fetch('api/calendar.php');
            const j = await r.json();
            acara = (Array.isArray(j.data) ? j.data : [])
                .filter(e => String(e.impact).toLowerCase() === 'high')
                .map(e => ({ t: Math.floor(Date.parse(e.date) / 1000), judul: String(e.title || ''), cur: String(e.currency || '').toUpperCase(),
                             forecast: e.forecast, previous: e.previous, actual: e.actual }))
                .filter(e => Number.isFinite(e.t) && e.cur)
                .sort((a, b) => a.t - b.t);
        } catch (e) { /* kalender gagal: chip disembunyikan, chart tidak terpengaruh */ }
    }

    function relevan() {
        const k = typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : null;
        const cur = mataUangSimbol(k && k.symbol);
        return acara.filter(e => cur.includes(e.cur));
    }

    // Berita pada menit yang sama digabung: "CAD · CPI m/m +2".
    function kelompokkan(daftar) {
        const per = new Map();
        for (const e of daftar) {
            const kunci = e.t + '|' + e.cur;
            if (!per.has(kunci)) per.set(kunci, { t: e.t, cur: e.cur, judul: [] });
            per.get(kunci).judul.push(e.judul);
        }
        return [...per.values()];
    }

    // ── Primitive: garis vertikal putus-putus + label kecil di atas ──────────────
    class Renderer {
        constructor(garis) { this.garis = garis; }
        draw(target) {
            const garis = this.garis;
            if (!garis || !garis.length) return;
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
                const ATAS = 44;   // di bawah legenda OHLC (kiri atas chart)
                ctx.save();
                ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                let labelKananTerakhir = -Infinity;
                for (const g of garis) {
                    const x = Math.round(g.x) + 0.5;
                    if (x < 0 || x > mediaSize.width) continue;
                    ctx.strokeStyle = g.lewat ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.75)';
                    ctx.beginPath(); ctx.moveTo(x, ATAS + 15); ctx.lineTo(x, mediaSize.height); ctx.stroke();
                    // Label hanya bila tidak menimpa label sebelumnya.
                    const teks = g.label;
                    const lebar = ctx.measureText(teks).width + 8;
                    if (x - lebar / 2 > labelKananTerakhir + 4) {
                        ctx.setLineDash([]);
                        ctx.fillStyle = g.lewat ? 'rgba(127, 29, 29, 0.75)' : 'rgba(185, 28, 28, 0.92)';
                        ctx.fillRect(x - lebar / 2, ATAS, lebar, 15);
                        ctx.fillStyle = '#fff';
                        ctx.fillText(teks, x - lebar / 2 + 4, ATAS + 11);
                        ctx.setLineDash([4, 4]);
                        labelKananTerakhir = x + lebar / 2;
                    }
                }
                ctx.restore();
            });
        }
    }
    class View {
        constructor(src) { this.src = src; this.garis = []; }
        update() {
            const { chart, series } = this.src;
            this.garis = [];
            if (!chart || !series || !tampil()) return;
            let data = [];
            try { data = series.data(); } catch (e) { data = []; }
            if (data.length < 3) return;
            const ts = chart.timeScale();
            const waktu = data.map(c => Number(c.time));
            const n = waktu.length;
            // Durasi batang: median selisih (celah akhir pekan tidak merusak perkiraan).
            const selisih = [];
            for (let i = Math.max(1, n - 60); i < n; i++) selisih.push(waktu[i] - waktu[i - 1]);
            selisih.sort((a, b) => a - b);
            const dur = selisih[Math.floor(selisih.length / 2)] || 3600;
            const logis = t => {
                if (t >= waktu[n - 1]) return (n - 1) + (t - waktu[n - 1]) / dur;
                if (t < waktu[0]) return null;
                let lo = 0, hi = n - 1;
                while (lo < hi) { const m = (lo + hi + 1) >> 1; if (waktu[m] <= t) lo = m; else hi = m - 1; }
                const sesudah = lo + 1 < n ? waktu[lo + 1] : waktu[lo] + dur;
                return lo + Math.min(1, (t - waktu[lo]) / Math.max(1, sesudah - waktu[lo]));
            };
            const kini = Date.now() / 1000;
            for (const k of kelompokkan(relevan())) {
                const l = logis(k.t);
                if (l === null) continue;
                const x = ts.logicalToCoordinate(l);
                if (x === null || !Number.isFinite(x)) continue;
                const nama = k.judul[0].length > 16 ? k.judul[0].slice(0, 15) + '…' : k.judul[0];
                this.garis.push({ x, lewat: k.t < kini, label: k.cur + ' ' + nama + (k.judul.length > 1 ? ' +' + (k.judul.length - 1) : '') });
            }
        }
        renderer() { return new Renderer(this.garis); }
        zOrder() { return 'top'; }
    }
    class Primitive {
        constructor() { this.chart = null; this.series = null; this._req = null; this._views = [new View(this)]; }
        attached({ chart, series, requestUpdate }) { this.chart = chart; this.series = series; this._req = requestUpdate; }
        detached() { this.chart = null; this.series = null; this._req = null; }
        updateAllViews() { this._views.forEach(v => v.update()); }
        paneViews() { return this._views; }
        segarkan() { if (this._req) this._req(); }
    }

    function pasang() {
        const k = typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : null;
        if (!k || !k.series || typeof k.series.attachPrimitive !== 'function') return;
        if (terpasang && terpasang.series === k.series) { terpasang.primitive.segarkan(); return; }
        lepas();
        const primitive = new Primitive();
        try { k.series.attachPrimitive(primitive); terpasang = { series: k.series, primitive }; } catch (e) { terpasang = null; }
    }
    function lepas() {
        if (!terpasang) return;
        try { terpasang.series.detachPrimitive(terpasang.primitive); } catch (e) {}
        terpasang = null;
    }

    // ── Chip hitung mundur ───────────────────────────────────────────────────────
    function teksDurasi(detik) {
        const d = Math.max(0, Math.round(detik));
        if (d >= 2 * 24 * JAM) return Math.floor(d / (24 * JAM)) + ' hari';
        if (d >= JAM) return Math.floor(d / JAM) + 'j ' + Math.floor((d % JAM) / MENIT) + 'm';
        if (d >= MENIT) return Math.floor(d / MENIT) + 'm ' + (d % MENIT) + 'd';
        return d + ' dtk';
    }
    function pastikanChip() {
        // Di dalam wadah chart utama (bukan induknya) supaya tetap menempel pada chart utama saat multi-chart aktif.
        const wadah = document.getElementById('tv_chart_container');
        if (!wadah) return null;
        if (chip && chip.isConnected) return chip;
        chip = document.createElement('div');
        chip.className = 'qim-berita-chip';
        chip.setAttribute('role', 'status');
        chip.setAttribute('aria-live', 'polite');
        wadah.appendChild(chip);
        return chip;
    }
    function perbaruiChip() {
        const c = pastikanChip();
        if (!c) return;
        const kini = Date.now() / 1000;
        const daftar = kelompokkan(relevan());
        // Berita yang baru rilis (≤15 menit) masih ditampilkan: volatilitas biasanya belum reda.
        const baruRilis = daftar.filter(k => k.t <= kini && kini - k.t <= 15 * MENIT).pop();
        const berikut = daftar.find(k => k.t > kini && k.t - kini <= 7 * 24 * JAM);
        const k = baruRilis || berikut;
        if (!k || !tampil()) { c.hidden = true; return; }
        const sisa = k.t - kini;
        const bahaya = baruRilis || sisa <= 30 * MENIT;
        c.hidden = false;
        c.classList.toggle('bahaya', !!bahaya);
        const judul = k.judul.length > 1 ? k.judul[0] + ' +' + (k.judul.length - 1) : k.judul[0];
        c.innerHTML = (bahaya ? '⚠ ' : '📅 ') + '<b>' + esc(k.cur) + '</b> ' + esc(judul) + ' · '
            + (baruRilis ? 'baru rilis ' + teksDurasi(kini - k.t) + ' lalu' : teksDurasi(sisa) + ' lagi')
            + (bahaya ? '<span> — hindari entry baru</span>' : '');
        const rinci = acara.filter(e => e.t === k.t && e.cur === k.cur)
            .map(e => e.judul + ' (perkiraan ' + (e.forecast || '-') + ', sebelumnya ' + (e.previous || '-') + (e.actual && e.actual !== '-' ? ', aktual ' + e.actual : '') + ')');
        c.title = new Date(k.t * 1000).toLocaleString('id-ID', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + ' — ' + rinci.join('; ');
    }

    function segarkan() { pasang(); perbaruiChip(); }

    async function mulai() {
        await muat(true);
        segarkan();
    }
    window.addEventListener('qi-chart-data', () => { muat(false).then(segarkan); });
    document.addEventListener('qim:panel-change', segarkan);
    setInterval(() => { muat(false).then(perbaruiChip); }, 30 * 1000);   // hitung mundur & data kalender
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mulai, 1500));
    else setTimeout(mulai, 1500);

    window.QIMBerita = {
        tampil,
        atur(nyala) {
            try { localStorage.setItem(KUNCI_TAMPIL, nyala ? '1' : '0'); } catch (e) {}
            if (terpasang) terpasang.primitive.segarkan();
            perbaruiChip();
            return nyala;
        },
        alih() { return this.atur(!tampil()); },
        mataUangSimbol,
        _uji: { kelompokkan, teksDurasi }
    };
})();
