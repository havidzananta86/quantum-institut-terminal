/**
 * Panel "Setup Analisa" + gambar posisi (Entry / SL / TP) di chart quantum.
 *
 * Tombol metode (SMC, ICT, Fibonacci, S&D, Semua) menjalankan QIMSetups.deteksi() pada candle
 * chart yang sedang tampil. Setup pertama langsung digambar; klik setup lain di daftar untuk
 * menggambarnya. Gambar dibuang saat simbol/timeframe berganti (event 'qi-chart-data').
 *
 * Gambar memakai series primitive lightweight-charts v5 sehingga ikut bergerak saat chart
 * digeser, di-zoom, atau skala harganya berubah:
 *   - zona struktur (OB / FVG / golden zone / zona S&D) dari candle asalnya ke kanan,
 *   - kotak posisi: area TP (biru) dan area SL (merah) dengan garis TP / ENTRY / SL,
 *   - label harga TP / ENTRY / SL di sumbu kanan.
 * Khusus PRO/VIP/admin (qiTingkatSaatIni() ≥ 1).
 */
(function () {
    'use strict';

    const LEBAR_KOTAK = 24;          // panjang kotak posisi ke kanan (bar)
    const WARNA = {
        tp: 'rgba(41, 98, 255, 0.28)', sl: 'rgba(242, 54, 69, 0.20)',
        garis: 'rgba(226, 232, 240, 0.80)', teks: '#e2e8f0',
        tpAxis: '#2962ff', entryAxis: '#787b86', slAxis: '#c62828',
        zona: { SMC: 'rgba(250, 204, 21, 0.14)', ICT: 'rgba(56, 189, 248, 0.16)', FIBO: 'rgba(168, 85, 247, 0.14)', SND: 'rgba(16, 185, 129, 0.15)' },
        zonaTepi: { SMC: 'rgba(250, 204, 21, 0.55)', ICT: 'rgba(56, 189, 248, 0.6)', FIBO: 'rgba(168, 85, 247, 0.55)', SND: 'rgba(16, 185, 129, 0.6)' },
    };

    // ── Primitive gambar ──────────────────────────────────────────────────────
    class PosisiRenderer {
        constructor(g) { this.g = g; }
        draw(target) {
            const g = this.g;
            if (!g) return;
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
                const kanan = mediaSize.width - 2;
                ctx.save();
                ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
                // Zona struktur
                if (g.zona) {
                    const z = g.zona;
                    ctx.fillStyle = z.isi;
                    ctx.fillRect(z.x1, z.y1, Math.max(1, z.x2 - z.x1), Math.max(1, z.y2 - z.y1));
                    ctx.strokeStyle = z.tepi; ctx.lineWidth = 1;
                    ctx.strokeRect(z.x1 + 0.5, z.y1 + 0.5, Math.max(1, z.x2 - z.x1 - 1), Math.max(1, z.y2 - z.y1 - 1));
                    ctx.fillStyle = z.tepi.replace(/[\d.]+\)$/, '0.95)');
                    ctx.fillText(z.label, z.x1 + 4, z.y1 - 4 > 10 ? z.y1 - 4 : z.y2 + 11);
                }
                // Kotak posisi
                const p = g.posisi;
                if (p) {
                    const x2 = Math.min(p.x2, kanan);
                    if (x2 <= p.x1) { ctx.restore(); return; }
                    const w = x2 - p.x1;
                    ctx.fillStyle = WARNA.tp; ctx.fillRect(p.x1, Math.min(p.yEntry, p.yTp), w, Math.abs(p.yTp - p.yEntry));
                    ctx.fillStyle = WARNA.sl; ctx.fillRect(p.x1, Math.min(p.yEntry, p.ySl), w, Math.abs(p.ySl - p.yEntry));
                    ctx.strokeStyle = WARNA.garis; ctx.lineWidth = 1;
                    for (const [y, teks] of [[p.yTp, 'TP'], [p.yEntry, 'ENTRY'], [p.ySl, 'SL']]) {
                        const yy = Math.round(y) + 0.5;
                        ctx.beginPath(); ctx.moveTo(p.x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
                        ctx.fillStyle = WARNA.teks;
                        const lebar = ctx.measureText(teks).width;
                        ctx.fillText(teks, x2 - lebar - 10, yy - 4);
                    }
                }
                ctx.restore();
            });
        }
    }
    class PosisiView {
        constructor(src) { this.src = src; this.g = null; }
        update() {
            const { chart, series, setup } = this.src;
            this.g = null;
            if (!chart || !series || !setup) return;
            const ts = chart.timeScale();
            let n = 0;
            try { n = series.data().length; } catch (e) { n = 0; }
            const akhir = Math.max(0, n - 1);
            const x = l => ts.logicalToCoordinate(l);
            const y = v => series.priceToCoordinate(v);
            const xKotak1 = x(akhir - 2), xKotak2 = x(akhir + LEBAR_KOTAK);
            const yTp = y(setup.tp), yEntry = y(setup.entry), ySl = y(setup.sl);
            const g = {};
            if ([xKotak1, xKotak2, yTp, yEntry, ySl].every(v => v !== null && Number.isFinite(v))) {
                g.posisi = { x1: xKotak1, x2: xKotak2, yTp, yEntry, ySl };
            }
            const z = setup.zona;
            if (z) {
                const x1 = x(z.mulai), x2 = xKotak1 !== null ? xKotak1 : x(akhir);
                const y1 = y(z.atas), y2 = y(z.bawah);
                if ([x1, x2, y1, y2].every(v => v !== null && Number.isFinite(v)) && x2 > x1) {
                    g.zona = { x1, x2, y1: Math.min(y1, y2), y2: Math.max(y1, y2), label: z.label,
                        isi: WARNA.zona[setup.metode] || WARNA.zona.SMC, tepi: WARNA.zonaTepi[setup.metode] || WARNA.zonaTepi.SMC };
                }
            }
            this.g = g;
        }
        renderer() { return new PosisiRenderer(this.g); }
        zOrder() { return 'bottom'; }
    }
    class PosisiPrimitive {
        constructor(setup) { this.setup = setup; this.chart = null; this.series = null; this._req = null; this._views = [new PosisiView(this)]; }
        attached({ chart, series, requestUpdate }) { this.chart = chart; this.series = series; this._req = requestUpdate; }
        detached() { this.chart = null; this.series = null; this._req = null; }
        updateAllViews() { this._views.forEach(v => v.update()); }
        paneViews() { return this._views; }
    }

    // ── Status gambar ─────────────────────────────────────────────────────────
    let aktif = null;           // { series, primitive, garis: [] }
    let hasilTerakhir = [];     // setup yang sedang ditampilkan di daftar

    function hapusGambar() {
        if (!aktif) return;
        try { aktif.series.detachPrimitive(aktif.primitive); } catch (e) {}
        aktif.garis.forEach(l => { try { aktif.series.removePriceLine(l); } catch (e) {} });
        aktif = null;
        document.querySelectorAll('#qimSetupList .qim-setup-item.terpilih').forEach(el => el.classList.remove('terpilih'));
    }

    function gambar(setup) {
        hapusGambar();
        const k = typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : null;
        if (!k || !k.series || typeof k.series.attachPrimitive !== 'function') return false;
        const primitive = new PosisiPrimitive(setup);
        k.series.attachPrimitive(primitive);
        const garis = [];
        for (const [harga, warna] of [[setup.tp, WARNA.tpAxis, 'TP'], [setup.entry, WARNA.entryAxis, 'ENTRY'], [setup.sl, WARNA.slAxis, 'SL']]) {
            // Label sumbu hanya harga (berwarna); tulisan TP/ENTRY/SL ada di dalam kotak.
            try { garis.push(k.series.createPriceLine({ price: harga, color: warna, lineVisible: false, axisLabelVisible: true, title: '' })); } catch (e) {}
        }
        aktif = { series: k.series, primitive, garis };
        return true;
    }

    // ── Panel ─────────────────────────────────────────────────────────────────
    const el = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const NAMA_TF = { '1': 'M1', '5': 'M5', '15': 'M15', '30': 'M30', '60': 'H1', '240': 'H4', D: 'D1', W: 'W1', MN: 'MN1' };

    function presisiSimbol(sym, harga) {
        const tetap = { XAUUSD: 2, XAGUSD: 3, USDJPY: 3, GBPJPY: 3, EURJPY: 3, BTCUSDT: 2, ETHUSDT: 2 };
        if (Object.prototype.hasOwnProperty.call(tetap, sym)) return tetap[sym];
        return harga >= 1000 ? 2 : harga >= 50 ? 3 : 5;
    }

    function fmtWaktu(t) {
        try {
            return new Date(t * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' WIB';
        } catch (e) { return String(t); }
    }

    function aksesPro() {
        return typeof window.qiTingkatSaatIni === 'function' && window.qiTingkatSaatIni() >= 1;
    }

    function tulisStatus(html) { const s = el('qimSetupStatus'); if (s) s.innerHTML = html; }

    function render(hasilPerMetode, k, presisi) {
        const list = el('qimSetupList');
        if (!list) return;
        const fmt = v => Number(v).toFixed(presisi);
        hasilTerakhir = [];
        const bagian = [];
        for (const r of hasilPerMetode) {
            const nama = window.QIMSetups.METODE[r.metode].nama;
            if (!r.setups.length) {
                bagian.push(`<div class="qim-setup-kosong"><b>${esc(nama)}</b> — ${esc(r.catatan || 'Belum ada setup valid.')}</div>`);
                continue;
            }
            for (const s of r.setups) {
                const idx = hasilTerakhir.push(s) - 1;
                const buy = s.arah === 'BUY';
                bagian.push(`
                    <button type="button" class="qim-setup-item ${buy ? 'buy' : 'sell'}" data-idx="${idx}">
                        <span class="qim-setup-top">
                            <b>${esc(nama)}${s.struktur ? ' · ' + esc(s.struktur) : ''}</b>
                            <span class="qim-setup-arah">${buy ? 'BUY' : 'SELL'}</span>
                            <span class="qim-setup-status ${s.status === 'AKTIF' ? 'aktif' : ''}" title="${s.status === 'AKTIF' ? 'Entry sudah tersentuh, posisi masih berjalan' : 'Limit order: menunggu harga kembali ke entry'}">${s.status === 'AKTIF' ? 'AKTIF' : 'MENUNGGU'}</span>
                        </span>
                        <span class="qim-setup-level">
                            <span>Entry <b>${fmt(s.entry)}</b></span>
                            <span>SL <b class="sl">${fmt(s.sl)}</b></span>
                            <span>TP <b class="tp">${fmt(s.tp)}</b></span>
                            <span>R:R <b>1:${s.rr.toFixed(2)}</b></span>
                        </span>
                        <span class="qim-setup-alasan">${s.alasan.map(a => `<span>• ${esc(a)}</span>`).join('')}</span>
                    </button>`);
            }
        }
        list.innerHTML = bagian.join('');
        list.scrollTop = 0;
        list.querySelectorAll('.qim-setup-item').forEach(btn => btn.addEventListener('click', ev => {
            const s = hasilTerakhir[Number(btn.dataset.idx)];
            if (s && gambar(s)) {
                btn.classList.add('terpilih');
                // Di layar penuh kartu ini dipinjam popover: tutup setelah pengguna memilih agar chart terlihat.
                if (ev.isTrusted && document.querySelector('.qch-pop-setup') && typeof window.qimTutupPopoverChart === 'function') window.qimTutupPopoverChart();
            }
        }));
        const pertama = list.querySelector('.qim-setup-item');
        if (pertama) pertama.click();
        const ditemukan = hasilTerakhir.length;
        tulisStatus(`${esc(k.label || k.symbol)} · ${esc(NAMA_TF[k.interval] || k.interval)} · ${ditemukan ? ditemukan + ' setup valid' : 'tidak ada setup valid'}${k.source ? ' · data ' + esc(k.source) : ''}`);
    }

    function jalankan(metode) {
        document.querySelectorAll('#qimSetupMetode button').forEach(b => b.classList.toggle('active', b.dataset.metode === metode));
        if (!aksesPro()) {
            tulisStatus('Setup Analisa tersedia untuk paket <b>PRO</b> ke atas. <a href="pricing.html" class="qim-link-button">Upgrade →</a>');
            const list = el('qimSetupList'); if (list) list.innerHTML = '';
            return;
        }
        const k = typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : null;
        if (!k || !k.series || !k.candles || !k.candles.length) { tulisStatus('Chart belum siap — tunggu data chart dimuat.'); return; }
        if (!window.QIMSetups) { tulisStatus('Mesin setup gagal dimuat — muat ulang halaman.'); return; }
        const presisi = presisiSimbol(k.symbol, k.candles[k.candles.length - 1].close);
        const daftar = metode === 'SEMUA' ? Object.keys(window.QIMSetups.METODE) : [metode];
        hapusGambar();
        const hasil = daftar.map(m => {
            try { return window.QIMSetups.deteksi(m, k.candles, { presisi, fmtWaktu }); }
            catch (e) { console.error('[QIM Setup]', m, e); return { metode: m, setups: [], catatan: 'Gagal menghitung setup.' }; }
        });
        render(hasil, k, presisi);
    }

    function pasang() {
        const wadah = el('qimSetupMetode');
        if (!wadah || wadah.dataset.siap) return;
        wadah.dataset.siap = '1';
        wadah.querySelectorAll('button[data-metode]').forEach(b => b.addEventListener('click', () => jalankan(b.dataset.metode)));
        const hapus = el('qimSetupHapus');
        if (hapus) hapus.addEventListener('click', () => { hapusGambar(); });
        // Data chart berganti (simbol/timeframe) → setup lama tidak berlaku lagi.
        window.addEventListener('qi-chart-data', () => {
            hapusGambar();
            hasilTerakhir = [];
            const list = el('qimSetupList'); if (list) list.innerHTML = '';
            document.querySelectorAll('#qimSetupMetode button').forEach(b => b.classList.remove('active'));
            tulisStatus('Pilih metode untuk mendeteksi setup pada chart yang tampil.');
        });
    }

    window.QIMSetupPanel = { jalankan, hapusGambar };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
})();
