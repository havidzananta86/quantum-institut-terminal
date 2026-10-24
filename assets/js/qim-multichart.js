/**
 * MULTI-CHART (desktop ≥ 1024 px): 1, 2 (berdampingan) atau 4 (2×2) chart untuk analisa top-down,
 * mis. XAUUSD D1 + H4 + H1 + M15. Chart utama (dengan alat gambar, Setup, Replay) tetap di sel
 * pertama; sel lain adalah chart ringan yang:
 *  - mengikuti simbol chart utama (bisa dilepas dan dipilih sendiri), timeframe dipilih per sel;
 *  - memakai data & gaya yang sama (api/get-chart-data.php, opsi warna chart utama);
 *  - diperbarui harga live dari _lastPrices dan memuat ulang candle hanya saat batang baru jatuh tempo.
 * Pilihan tata letak diingat per perangkat. Di layar < 1024 px kembali ke 1 chart otomatis.
 */
(function () {
    'use strict';
    const KUNCI = 'qim_multichart';
    const TF = [['15', 'M15'], ['60', 'H1'], ['240', 'H4'], ['D', 'D1']];
    const DUR = { '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, D: 86400, W: 604800 };
    const layarBesar = () => window.matchMedia('(min-width: 1024px)').matches;
    let keadaan = baca();
    let sel = [];            // [{ el, chart, seri, simbol, tf, ikut, candles, sinkronBoleh }]
    let timer = null;

    function baca() {
        try { const j = JSON.parse(localStorage.getItem(KUNCI) || 'null'); if (j && [1, 2, 4].includes(j.jumlah)) return j; } catch (e) {}
        return { jumlah: 1, sel: [] };
    }
    function simpan() {
        keadaan.sel = sel.map(s => ({ simbol: s.simbol, tf: s.tf, ikut: s.ikut }));
        try { localStorage.setItem(KUNCI, JSON.stringify(keadaan)); } catch (e) {}
    }
    const konteks = () => (typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : {}) || {};
    const wadahUtama = () => { const c = document.getElementById('tv_chart_container'); return c && c.parentElement; };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function daftarSimbol() { try { return WL_GROUPS.flatMap(g => g.syms); } catch (e) { return []; } }

    /** Timeframe default sel tambahan: top-down di sekitar TF chart utama, tanpa duplikat. */
    function tfDefault(jumlahTambahan) {
        const utama = konteks().interval || '60';
        const urut = ['D', '240', '60', '15'].filter(t => t !== utama);
        return urut.slice(0, jumlahTambahan);
    }

    function atur(jumlah) {
        jumlah = [1, 2, 4].includes(Number(jumlah)) ? Number(jumlah) : 1;
        if (jumlah > 1 && !layarBesar()) {
            if (typeof window.showToast === 'function') window.showToast('Multi-chart tersedia di layar ≥ 1024 px (desktop/tablet mendatar).', 'info', 3000);
            jumlah = 1;
        }
        keadaan.jumlah = jumlah;
        terapkan();
        simpan();
        return jumlah;
    }

    function hapusSemua() {
        sel.forEach(s => { try { s.chart.remove(); } catch (e) {} try { s.el.remove(); } catch (e) {} });
        sel = [];
        clearInterval(timer); timer = null;
    }

    function terapkan() {
        const wadah = wadahUtama();
        if (!wadah) return;
        const jumlah = layarBesar() ? keadaan.jumlah : 1;
        wadah.classList.toggle('qim-multi', jumlah > 1);
        wadah.classList.toggle('qim-multi-2', jumlah === 2);
        wadah.classList.toggle('qim-multi-4', jumlah === 4);
        const perlu = jumlah - 1;
        if (sel.length === perlu) { sel.forEach(muatSel); return; }
        hapusSemua();
        if (!perlu) return;
        const tfAwal = tfDefault(perlu);
        for (let i = 0; i < perlu; i++) {
            const lama = keadaan.sel[i] || {};
            buatSel(wadah, { simbol: lama.ikut === false ? lama.simbol : null, tf: lama.tf || tfAwal[i], ikut: lama.ikut !== false });
        }
        timer = setInterval(detak, 2500);
        // Chart utama ikut mengecil/membesar (autoSize memakai ResizeObserver; ini cadangan).
        setTimeout(() => { try { const k = konteks(); if (k.chart) k.chart.applyOptions({ autoSize: true }); } catch (e) {} }, 60);
    }

    function opsiChart() {
        const k = konteks();
        let dasar = {};
        try { dasar = k.chart ? k.chart.options() : {}; } catch (e) {}
        return {
            autoSize: true,
            layout: Object.assign({}, dasar.layout, { attributionLogo: false }),
            grid: dasar.grid,
            // Format waktu WIB chart utama ikut disalin; dulu hanya layout & grid sehingga sel tambahan berlabel UTC.
            localization: dasar.localization,
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4,
                tickMarkFormatter: (dasar.timeScale || {}).tickMarkFormatter },
            crosshair: { mode: 1 },
            handleScroll: true, handleScale: true,
        };
    }

    function buatSel(wadah, awal) {
        const M = window._lwModules;
        if (!M || !M.createChart) return;
        const el = document.createElement('div');
        el.className = 'qim-mc-sel';
        el.innerHTML = '<div class="qim-mc-kepala"><select class="qim-mc-simbol" aria-label="Simbol chart ini"></select>'
            + '<div class="qim-mc-tf" role="group" aria-label="Timeframe chart ini">' + TF.map(([v, l]) => '<button type="button" data-tf="' + v + '">' + l + '</button>').join('') + '</div>'
            + '<span class="qim-mc-harga"></span></div><div class="qim-mc-chart"></div>';
        wadah.appendChild(el);
        const chart = M.createChart(el.querySelector('.qim-mc-chart'), opsiChart());
        let gaya = {};
        try { gaya = konteks().series ? konteks().series.options() : {}; } catch (e) {}
        const seri = chart.addSeries(M.CandlestickSeries, {
            upColor: gaya.upColor || '#26a69a', downColor: gaya.downColor || '#ef5350',
            wickUpColor: gaya.wickUpColor || gaya.upColor || '#26a69a', wickDownColor: gaya.wickDownColor || gaya.downColor || '#ef5350',
            borderVisible: false,
        });
        const s = { el, chart, seri, simbol: awal.simbol, tf: awal.tf, ikut: awal.ikut, candles: [], sinkronBoleh: 0, permintaan: 0 };
        sel.push(s);
        const pilih = el.querySelector('.qim-mc-simbol');
        pilih.innerHTML = '<option value="">↻ Ikuti chart utama</option>' + daftarSimbol().map(x => '<option value="' + esc(x.key) + '">' + esc(x.label) + '</option>').join('');
        pilih.value = s.ikut ? '' : (s.simbol || '');
        pilih.addEventListener('change', () => { s.ikut = !pilih.value; s.simbol = pilih.value || null; muatSel(s); simpan(); });
        el.querySelector('.qim-mc-tf').addEventListener('click', e => {
            const b = e.target.closest('[data-tf]'); if (!b) return;
            s.tf = b.dataset.tf; muatSel(s); simpan();
        });
        muatSel(s);
    }

    const simbolSel = s => (s.ikut || !s.simbol) ? (konteks().symbol || 'XAUUSD') : s.simbol;

    async function muatSel(s) {
        const simbol = simbolSel(s), tf = s.tf;
        s.el.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('aktif', b.dataset.tf === tf));
        s.el.dataset.simbol = simbol;
        const no = ++s.permintaan;
        try {
            const r = await fetch('api/get-chart-data.php?symbol=' + encodeURIComponent(simbol) + '&interval=' + encodeURIComponent(tf));
            const j = await r.json();
            if (no !== s.permintaan || !sel.includes(s)) return;   // sudah diganti / dihapus
            const c = (j.candles || []).filter(x => x && x.time && Number.isFinite(x.open));
            s.candles = c; s.simbolData = simbol; s.tfData = tf;
            s.seri.setData(c);
            try {
                const akhir = c[c.length - 1];
                const pres = window.QuantumChartStyle ? window.QuantumChartStyle.presisi(simbol, akhir && akhir.close) : null;
                if (pres) s.seri.applyOptions({ priceFormat: { type: 'price', precision: pres.precision, minMove: pres.minMove } });
            } catch (e) {}
            s.chart.timeScale().fitContent();
            const label = (daftarSimbol().find(x => x.key === simbol) || { label: simbol }).label;
            s.el.querySelector('.qim-mc-harga').textContent = label + ' · ' + (TF.find(t => t[0] === tf) || [tf, tf])[1]
                + (j.simulated ? ' · SIMULASI' : '') + (!c.length ? ' · data tidak tersedia' : '');
            s.sinkronBoleh = 0;
        } catch (e) {
            if (no === s.permintaan) s.el.querySelector('.qim-mc-harga').textContent = simbol + ' · data tidak tersedia';
        }
    }

    // Tick live (harga dari _lastPrices) + muat ulang candle hanya saat batang baru jatuh tempo.
    function detak() {
        if (!sel.length || document.visibilityState !== 'visible') return;
        if (typeof _activePanel !== 'undefined' && _activePanel !== 'panel-charts') return;
        const kini = Date.now() / 1000;
        for (const s of sel) {
            const simbol = simbolSel(s);
            if (simbol !== s.simbolData || s.tf !== s.tfData) { muatSel(s); continue; }
            const akhir = s.candles[s.candles.length - 1];
            if (!akhir) continue;
            let harga = null;
            try { const lp = _lastPrices && _lastPrices[simbol]; harga = lp ? parseFloat(lp.price) : null; } catch (e) {}
            if (Number.isFinite(harga) && harga > 0) {
                const baru = Object.assign({}, akhir, { high: Math.max(akhir.high, harga), low: Math.min(akhir.low, harga), close: harga });
                try { s.seri.update(baru); s.candles[s.candles.length - 1] = baru; } catch (e) {}
            }
            if (kini >= akhir.time + (DUR[s.tf] || 3600) && kini >= s.sinkronBoleh) {
                s.sinkronBoleh = kini + 60;
                muatSel(s);
            }
        }
    }

    // Simbol chart utama berganti → sel yang "mengikuti" ikut berganti.
    document.addEventListener('qim:chart-symbol', () => { sel.forEach(s => { if (s.ikut && simbolSel(s) !== s.simbolData) muatSel(s); }); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', () => terapkan());
    function mulai() {
        if (keadaan.jumlah > 1) {
            const coba = () => (window._lwModules && document.getElementById('tv_chart_container')) ? terapkan() : setTimeout(coba, 500);
            setTimeout(coba, 800);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();

    window.QIMMultiChart = { atur, jumlah: () => (layarBesar() ? keadaan.jumlah : 1), _sel: () => sel };
})();
