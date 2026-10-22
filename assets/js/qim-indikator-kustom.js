/**
 * INDIKATOR KUSTOM (hasil port Pine Script) di chart webapp — saat ini: "XAU SMC+SnD BUY SELL COMBO".
 *  - Menu: Indikator → bagian "Indikator Pine (port)" → centang untuk menyalakan; ⚙ untuk parameter
 *    (sama dengan input di skrip Pine). Parameter diingat per perangkat; status NYALA tidak (chart selalu mulai bersih).
 *  - Gambar: 4 garis EMA, zona Supply/Demand (kotak memanjang ke kanan), garis BOS, dan tabel BUY/SELL (pojok kanan atas/bawah).
 *  - Data: riwayat dalam (hingga 5.000 bar, api/get-history.php) digabung dengan candle chart yang live, karena zona
 *    lama yang belum tembus tetap hidup di TradingView; makin banyak bar makin identik. Bila sumber riwayat beda dari
 *    sumber chart (mis. feed MT5), dipakai candle chart saja dan itu dinyatakan di tabel.
 *  - Replay: indikator dihitung hanya sampai bar replay (tidak membocorkan masa depan).
 * Perhitungan ada di qim-pine-smcsnd.js (murni, diuji terhadap angka TradingView).
 */
(function () {
    'use strict';
    const KUNCI_OPSI = 'qim_pine_smcsnd_opsi';
    const TTL_RIWAYAT = 10 * 60 * 1000;
    const WARNA = {
        supplyIsi: 'rgba(120,123,134,0.25)', supplyTepi: 'rgba(120,123,134,0.90)',
        demandIsi: 'rgba(8,153,129,0.25)', demandTepi: 'rgba(8,153,129,0.90)',
        bosSupply: 'rgba(76,175,80,1)', bosDemand: 'rgba(242,54,69,1)',
    };
    const EMA = [['ema13', '#AEB4BC', 2], ['ema21', '#D66B75', 2], ['ema100', '#78B995', 2], ['ema200', '#729BD0', 3]];
    const FIELD = [
        ['swing_length', 'Swing High/Low Length', 'int', 2, 50, 1], ['history_keep', 'S&D History', 'int', 5, 50, 1],
        ['box_width', 'Supply/Demand Box Width', 'float', 1, 10, 0.5],
        ['ema13Len', 'EMA 13', 'int', 1, 500, 1], ['ema21Len', 'EMA 21', 'int', 1, 500, 1],
        ['ema100Len', 'EMA 100', 'int', 1, 1000, 1], ['ema200Len', 'EMA 200', 'int', 1, 1000, 1], ['atrLen', 'ATR Length', 'int', 1, 100, 1],
        ['buyEntryBufferATR', 'BUY Entry Below Demand (ATR)', 'float', 0, 1, 0.05], ['buySLBufferATR', 'BUY SL Below Demand (ATR)', 'float', 0.1, 2, 0.05],
        ['sellEntryBufferATR', 'SELL Entry Above Supply (ATR)', 'float', 0, 1, 0.05], ['sellSLBufferATR', 'SELL SL Above Supply (ATR)', 'float', 0.1, 2, 0.05],
        ['useSweepLogic', 'Require Liquidity Sweep', 'bool'], ['sweepLookback', 'Sweep Lookback', 'int', 1, 10, 1],
        ['showZones', 'Show Supply/Demand', 'bool'], ['showBOS', 'Show BOS', 'bool'],
    ];

    let aktif = false, opsi = bacaOpsi(), terpasang = null /* { chart, series, primitive, garis:{} } */;
    let hasil = null, catatan = '', jadwalId = null, tokenMuat = 0, sigTerakhir = '', waktuReplay = null;
    const cacheRiwayat = new Map();   // "SIM|iv" → { t, candles, sumber }
    let tabelEl = null;
    const $ = (s, r) => (r || document).querySelector(s);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const konteks = () => (typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : {}) || {};

    function bacaOpsi() {
        const dasar = Object.assign({}, window.QIMPineSmcSnd ? window.QIMPineSmcSnd.DEFAULT : {});
        try { Object.assign(dasar, JSON.parse(localStorage.getItem(KUNCI_OPSI) || '{}')); } catch (e) {}
        return dasar;
    }
    function simpanOpsi() { try { localStorage.setItem(KUNCI_OPSI, JSON.stringify(opsi)); } catch (e) {} }

    // ── Data: riwayat dalam + candle chart ────────────────────────────────────
    async function ambilRiwayat(sim, iv) {
        if (!sim || !['1', '5', '15', '30', '60', '240', 'D'].includes(String(iv))) return null;
        const kunci = sim + '|' + iv, c = cacheRiwayat.get(kunci);
        if (c && Date.now() - c.t < TTL_RIWAYAT) return c;
        try {
            const r = await fetch('api/get-history.php?symbol=' + encodeURIComponent(sim) + '&interval=' + encodeURIComponent(iv) + '&bars=5000');
            const j = await r.json();
            // Riwayat bertanda simulasi tidak pernah dicampur ke candle chart.
            if (!j || j.status !== 'success' || j.simulated === true || !Array.isArray(j.candles) || j.candles.length < 50) return null;
            const baru = { t: Date.now(), candles: j.candles, sumber: j.source || '' };
            cacheRiwayat.set(kunci, baru);
            return baru;
        } catch (e) { return null; }
    }

    /** Gabungkan riwayat dalam dengan candle chart (candle chart menang: ia yang live). */
    function gabung(chartCandles, riwayat, sumberChart) {
        const cc = (chartCandles || []).filter(x => x && x.time && Number.isFinite(x.open));
        if (!riwayat || !riwayat.candles.length) return { candles: cc, dalam: false };
        // Sumber berbeda (mis. chart dari MT5, riwayat dari OANDA) → harga bisa beda; jangan dicampur.
        const sama = !sumberChart || !riwayat.sumber || sumberChart === riwayat.sumber
            || (/binance/.test(sumberChart) && /binance/.test(riwayat.sumber)) || (/oanda/.test(sumberChart) && /oanda/.test(riwayat.sumber));
        if (!sama || !cc.length) return { candles: cc, dalam: false, sumberBeda: !sama };
        const peta = new Map();
        riwayat.candles.forEach(x => peta.set(x.time, { time: x.time, open: x.open, high: x.high, low: x.low, close: x.close }));
        cc.forEach(x => peta.set(x.time, { time: x.time, open: x.open, high: x.high, low: x.low, close: x.close }));
        const urut = [...peta.values()].sort((a, b) => a.time - b.time);
        return { candles: urut, dalam: urut.length > cc.length };
    }

    // ── Gambar zona (series primitive) ────────────────────────────────────────
    class Renderer {
        constructor(g) { this.g = g; }
        draw(target) {
            const g = this.g;
            if (!g || (!g.zona.length && !g.bos.length)) return;
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
                ctx.save();
                ctx.font = '600 10px Inter, system-ui, sans-serif';
                ctx.textBaseline = 'middle';
                for (const z of g.zona) {
                    const x1 = Math.max(0, z.x1), x2 = mediaSize.width;
                    if (x2 <= x1) continue;
                    const h = Math.max(1, z.y2 - z.y1);
                    ctx.fillStyle = z.tipe === 'supply' ? WARNA.supplyIsi : WARNA.demandIsi;
                    ctx.fillRect(x1, z.y1, x2 - x1, h);
                    ctx.strokeStyle = z.tipe === 'supply' ? WARNA.supplyTepi : WARNA.demandTepi;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x1 + 0.5, z.y1 + 0.5, x2 - x1 - 1, Math.max(0, h - 1));
                    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
                    ctx.fillText(z.tipe === 'supply' ? 'SUPPLY' : 'DEMAND', (x1 + x2) / 2, z.y1 + h / 2);
                }
                for (const b of g.bos) {
                    const x1 = Math.max(0, b.x1), x2 = Math.min(mediaSize.width, b.x2);
                    if (x2 <= x1) continue;
                    const y = Math.round(b.y) + 0.5;
                    ctx.strokeStyle = b.tipe === 'supply' ? WARNA.supplyTepi : WARNA.demandTepi;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
                    if (opsi.showBOS) { ctx.fillStyle = b.tipe === 'supply' ? WARNA.bosSupply : WARNA.bosDemand; ctx.textAlign = 'center'; ctx.fillText('BOS', (x1 + x2) / 2, y - 6); }
                }
                ctx.restore();
            });
        }
    }
    class View {
        constructor(src) { this.src = src; this.g = null; }
        update() {
            const { chart, series } = this.src;
            this.g = null;
            if (!chart || !series || !aktif || !hasil || !hasil.ok) return;
            const ts = chart.timeScale();
            let data = [];
            try { data = series.data(); } catch (e) { data = []; }
            if (!data.length) return;
            const tAwal = Number(data[0].time);
            const xWaktu = t => {
                if (t < tAwal) return -1e6;                      // lebih tua dari chart: mulai dari tepi kiri
                const x = ts.timeToCoordinate(t);
                return x === null || !Number.isFinite(x) ? null : x;
            };
            const W = hasil.waktu, g = { zona: [], bos: [] };
            const y = v => series.priceToCoordinate(v);
            for (const tipe of ['supply', 'demand']) {
                for (const b of hasil.zona[tipe]) {
                    const x1 = xWaktu(W[b.left]), y1 = y(b.top), y2 = y(b.bottom);
                    if (x1 === null || y1 === null || y2 === null) continue;
                    g.zona.push({ tipe, x1, y1: Math.min(y1, y2), y2: Math.max(y1, y2) });
                }
                for (const b of hasil.bos[tipe]) {
                    const x1 = xWaktu(W[b.left]), x2 = xWaktu(W[Math.min(b.right, W.length - 1)]), yy = y(b.y);
                    if (x1 === null || x2 === null || yy === null) continue;
                    g.bos.push({ tipe, x1, x2, y: yy });
                }
            }
            this.g = g;
        }
        renderer() { return new Renderer(this.g); }
        zOrder() { return 'bottom'; }
    }
    class Primitive {
        constructor() { this.chart = null; this.series = null; this._req = null; this._views = [new View(this)]; }
        attached({ chart, series, requestUpdate }) { this.chart = chart; this.series = series; this._req = requestUpdate; }
        detached() { this.chart = null; this.series = null; this._req = null; }
        updateAllViews() { this._views.forEach(v => v.update()); }
        paneViews() { return this._views; }
        segarkan() { if (this._req) this._req(); }
    }

    // ── Pasang / lepas dari chart ─────────────────────────────────────────────
    function pasang() {
        const k = konteks();
        if (!k.chart || !k.series || typeof k.series.attachPrimitive !== 'function' || !window._lwModules || !window._lwModules.LineSeries) return false;
        if (terpasang && terpasang.series === k.series && terpasang.chart === k.chart) return true;
        lepasChart();
        const primitive = new Primitive(), garis = {};
        try {
            k.series.attachPrimitive(primitive);
            EMA.forEach(([id, warna, lebar]) => {
                garis[id] = k.chart.addSeries(window._lwModules.LineSeries, { color: warna, lineWidth: lebar, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, title: '' });
            });
        } catch (e) { return false; }
        terpasang = { chart: k.chart, series: k.series, primitive, garis };
        sigTerakhir = '';
        return true;
    }
    function lepasChart() {
        if (!terpasang) return;
        try { terpasang.series.detachPrimitive(terpasang.primitive); } catch (e) {}
        Object.values(terpasang.garis).forEach(s => { try { terpasang.chart.removeSeries(s); } catch (e) {} });
        terpasang = null;
    }

    // ── Tabel BUY / SELL (DOM, pojok kanan atas / bawah) ──────────────────────
    function desimal(sim, harga) {
        if (sim === 'XAUUSD') return 3;   // OANDA XAUUSD: mintick 0,001 (sama dengan tabel di TradingView)
        try { const p = window.QuantumChartStyle && window.QuantumChartStyle.presisi(sim, harga); if (p && Number.isFinite(p.precision)) return p.precision; } catch (e) {}
        return harga >= 1000 ? 2 : harga >= 50 ? 3 : 5;
    }
    function pastikanTabel() {
        const wadah = document.getElementById('tv_chart_container');
        if (!wadah) return null;
        if (tabelEl && tabelEl.isConnected) return tabelEl;
        tabelEl = document.createElement('div');
        tabelEl.className = 'qim-pk';
        tabelEl.innerHTML = '<table class="qim-pk-t buy" aria-label="Level BUY"></table><table class="qim-pk-t sell" aria-label="Level SELL"></table><div class="qim-pk-info"></div>';
        tabelEl.addEventListener('click', e => { if (e.target.closest('thead, .qim-pk-kepala')) tabelEl.classList.toggle('ringkas'); });
        if (window.matchMedia && window.matchMedia('(max-width: 599px)').matches) tabelEl.classList.add('ringkas');
        wadah.appendChild(tabelEl);
        return tabelEl;
    }
    function isiTabel(sim) {
        const el = pastikanTabel();
        if (!el) return;
        const h = hasil && hasil.ok ? hasil : null;
        const harga = h ? h.buy.entry || h.sell.entry || 1 : 1;
        const d = desimal(sim, harga || 1);
        const f = (v, ok) => (ok && Number.isFinite(v) ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, '') : '-');
        const bangun = (tipe, label, data) => {
            const ok = !!(h && data.baseValid);
            const baris = [['ENTRY', data.entry], ['TP1', data.tp1], ['TP2', data.tp2], ['TP3', data.tp3], ['SL', data.sl]];
            const kls = ['e', 't1', 't2', 't3', 'sl'];
            return '<thead><tr class="qim-pk-kepala"><th>' + label + '</th><th>PRICE</th></tr></thead><tbody>'
                + baris.map(([n, v], i) => '<tr class="r ' + kls[i] + '"><td>' + n + '</td><td>' + f(v, ok) + '</td></tr>').join('')
                + '<tr class="st ' + (h && data.valid ? 'valid' : 'tunggu') + '"><td>STATUS</td><td>' + esc(h ? data.status : 'WAIT') + '</td></tr></tbody>';
        };
        const buy = h ? h.buy : {}, sell = h ? h.sell : {};
        $('.qim-pk-t.buy', el).innerHTML = bangun('buy', 'BUY', buy);
        $('.qim-pk-t.sell', el).innerHTML = bangun('sell', 'SELL', sell);
        $('.qim-pk-info', el).textContent = catatan;
        el.hidden = !aktif;
    }

    // ── Hitung & gambar ───────────────────────────────────────────────────────
    async function segarkan(paksa) {
        if (!aktif) return;
        const k = konteks();
        if (!k.symbol || !k.candles || !k.candles.length) return;
        if (!pasang()) return;
        const ct = k.candles, akhir = ct[ct.length - 1];
        const sig = [k.symbol, k.interval, ct.length, akhir.time, akhir.high, akhir.low, akhir.close, waktuReplay, JSON.stringify(opsi), ct.simulated === true ? 'simulasi' : ''].join('|');
        if (!paksa && sig === sigTerakhir) return;
        sigTerakhir = sig;
        const token = ++tokenMuat;
        const cache = cacheRiwayat.get(k.symbol + '|' + k.interval);
        // Chart simulasi: tidak ada yang dihitung, jadi riwayat tidak perlu dimuat — dan catatan
        // "memakai N bar chart" di cabang gagal-muat tidak boleh menimpa pesan penolakannya.
        const butuhMuat = ct.simulated !== true && (!cache || Date.now() - cache.t >= TTL_RIWAYAT);
        hitungDanGambar(k, cache);
        if (butuhMuat) {
            const baru = await ambilRiwayat(k.symbol, k.interval);
            if (token !== tokenMuat || !aktif) return;
            if (baru) hitungDanGambar(konteks(), baru);
            else { catatan = 'Riwayat dalam tidak tersedia — memakai ' + ((konteks().candles || []).length) + ' bar chart (zona lama bisa kurang).'; isiTabel(k.symbol); }
        }
    }
    function hitungDanGambar(k, riwayat) {
        if (!terpasang || !window.QIMPineSmcSnd) return;
        // Candle chart SIMULASI (angka acak saat sumber nyata gagal) tidak dihitung: dulu zona,
        // BOS dan tabel ENTRY/TP/SL ikut digambar dari data karangan (audit sinyal 2026-10-22).
        if (k.candles && k.candles.simulated === true) {
            hasil = null;
            catatan = 'Data chart SIMULASI (sumber harga nyata gagal) — indikator tidak dihitung dari candle karangan.';
            EMA.forEach(([id]) => { try { terpasang.garis[id].setData([]); } catch (e) {} });
            terpasang.primitive.segarkan();
            isiTabel(k.symbol);
            return;
        }
        const g = gabung(k.candles, riwayat, k.source);
        let c = g.candles;
        if (waktuReplay !== null) c = c.filter(x => x.time <= waktuReplay);
        const t0 = (window.performance || Date).now();
        hasil = window.QIMPineSmcSnd.hitung(c, opsi);
        const ms = Math.round((window.performance || Date).now() - t0);
        catatan = hasil.ok
            ? hasil.n.toLocaleString('id-ID') + ' bar' + (g.dalam ? '' : ' (hanya bar chart — zona lama bisa kurang)') + (g.sumberBeda ? ' · sumber chart ≠ riwayat' : '') + ' · ' + ms + ' ms'
            : (hasil.pesan || '');
        if (hasil.ok) hasil.waktu = c.map(x => x.time);
        // Garis EMA: hanya pada bar yang tampil di chart.
        if (hasil.ok) {
            const tampil = new Set((k.candles || []).map(x => x.time));
            const idx = [];
            for (let i = 0; i < hasil.waktu.length; i++) if (tampil.has(hasil.waktu[i])) idx.push(i);
            EMA.forEach(([id]) => {
                const s = terpasang.garis[id]; if (!s) return;
                try { s.setData(idx.map(i => ({ time: hasil.waktu[i], value: hasil[id][i] }))); } catch (e) {}
            });
        } else EMA.forEach(([id]) => { try { terpasang.garis[id].setData([]); } catch (e) {} });
        terpasang.primitive.segarkan();
        isiTabel(k.symbol);
    }

    function jadwalkan(paksa) {
        clearTimeout(jadwalId);
        jadwalId = setTimeout(() => segarkan(paksa), 120);
    }

    // ── Nyala / mati ──────────────────────────────────────────────────────────
    function nyalakan() {
        aktif = true;
        const el = pastikanTabel(); if (el) el.hidden = false;
        pasang();
        jadwalkan(true);
        perbaruiCentang();
        return true;
    }
    function matikan() {
        aktif = false; hasil = null; sigTerakhir = ''; tokenMuat++;
        lepasChart();
        if (tabelEl) { tabelEl.remove(); tabelEl = null; }
        perbaruiCentang();
        return false;
    }
    const alih = () => (aktif ? matikan() : nyalakan());

    window.addEventListener('qi-chart-data', () => jadwalkan(false));
    document.addEventListener('qim:chart-symbol', () => { if (aktif) jadwalkan(true); });
    window.addEventListener('qim:replay-bar', e => { waktuReplay = e.detail && e.detail.time != null ? Number(e.detail.time) : null; if (aktif) jadwalkan(true); });
    setInterval(() => { if (aktif && document.visibilityState === 'visible') segarkan(false); }, 2000);

    // ── Menu (bagian di popover Indikator) ────────────────────────────────────
    function perbaruiCentang() { document.querySelectorAll('[data-pk="toggle"] input').forEach(i => { i.checked = aktif; }); }
    function bagianMenu() {
        const w = document.createElement('div');
        w.className = 'qim-pk-menu';
        const field = FIELD.map(([id, label, tipe, min, max, step]) => tipe === 'bool'
            ? '<label class="qim-pk-f cek"><input type="checkbox" data-opsi="' + id + '"' + (opsi[id] ? ' checked' : '') + '> ' + esc(label) + '</label>'
            : '<label class="qim-pk-f"><span>' + esc(label) + '</span><input type="number" data-opsi="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + opsi[id] + '" inputmode="decimal"></label>').join('');
        w.innerHTML = '<div class="qch-pop-sep"></div><div class="qch-pop-title">Indikator Pine (port)</div>'
            + '<label class="qch-item" data-pk="toggle" title="Port dari skrip Pine \'XAU SMC+SnD BUY SELL COMBO\' — EMA 13/21/100/200, zona Supply/Demand, BOS, tabel BUY/SELL"><input type="checkbox"' + (aktif ? ' checked' : '') + '> <b>XAU SMC+SnD BUY SELL COMBO</b></label>'
            + '<details class="qim-pk-set"><summary>⚙ Pengaturan indikator</summary><div class="qim-pk-form">' + field
            + '<div class="qim-pk-aksi"><button type="button" data-pk="terapkan">Terapkan</button><button type="button" data-pk="reset">Bawaan</button></div></div></details>'
            + '<p class="qim-note" style="margin:6px 0 0">Dihitung dari data chart ini; bukan saran investasi. Zona lama butuh riwayat panjang (hingga 5.000 bar).</p>';
        w.addEventListener('change', e => { if (e.target.closest('[data-pk="toggle"] input')) (e.target.checked ? nyalakan() : matikan()); });
        w.addEventListener('click', e => {
            const t = e.target.closest('[data-pk]');
            if (!t || t.dataset.pk === 'toggle') return;
            if (t.dataset.pk === 'reset') { opsi = Object.assign({}, window.QIMPineSmcSnd.DEFAULT); simpanOpsi(); w.querySelectorAll('[data-opsi]').forEach(i => { const v = opsi[i.dataset.opsi]; if (i.type === 'checkbox') i.checked = !!v; else i.value = v; }); if (aktif) jadwalkan(true); return; }
            if (t.dataset.pk === 'terapkan') {
                FIELD.forEach(([id, , tipe, min, max]) => {
                    const i = w.querySelector('[data-opsi="' + id + '"]'); if (!i) return;
                    if (tipe === 'bool') { opsi[id] = !!i.checked; return; }
                    let v = Number(i.value); if (!Number.isFinite(v)) v = window.QIMPineSmcSnd.DEFAULT[id];
                    v = Math.min(max, Math.max(min, v)); if (tipe === 'int') v = Math.round(v);
                    opsi[id] = v; i.value = v;
                });
                simpanOpsi();
                if (aktif) jadwalkan(true); else nyalakan();
            }
        });
        return w;
    }

    window.QIMIndikatorKustom = { nyalakan, matikan, alih, aktif: () => aktif, bagianMenu, hasil: () => hasil, opsi: () => opsi, _gabung: gabung };
})();
