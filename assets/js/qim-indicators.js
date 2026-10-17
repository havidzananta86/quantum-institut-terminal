/**
 * QIM Indicators — Parabolic SAR, Keltner Channel, SuperTrend, Liquidity Zones,
 * dan deteksi pola candlestick, digambar sebagai overlay pada chart utama
 * (_lwChart / _lwSeries dari dashboard-app.js). Chart tidak pernah diganti.
 *
 * Semua angka dihitung dari candle yang sama dengan chart (_lwLastCandles);
 * tidak ada nilai karangan. Pola candle hanya ditandai bila bentuk candle DAN
 * konteks trend sebelumnya memenuhi definisi buku teks.
 */
(function () {
    'use strict';

    const INDICATORS = {
        psar: { id: 'indPSAR' },
        keltner: { id: 'indKC' },
        supertrend: { id: 'indST' },
        liquidity: { id: 'indLIQ' },
        candles: { id: 'indCDL' }
    };
    const COLORS = {
        up: '#26a69a', down: '#ef5350', keltner: '#38bdf8', keltnerMid: '#38bdf888',
        bsl: '#f5b942', ssl: '#22d3ee'
    };

    let ownedSeries = [];
    let ownedPriceLines = [];
    let ownerChart = null;
    let ownerSeries = null;
    let patternMarkers = [];
    let baseMarkers = [];

    // dashboard-app.js memakai `let` di skrip klasik: bisa dibaca lintas skrip lewat
    // nama global, tetapi tidak lewat window.* — jadi diakses dengan nama langsung.
    function chartState() {
        try {
            return {
                chart: typeof _lwChart !== 'undefined' ? _lwChart : null,
                series: typeof _lwSeries !== 'undefined' ? _lwSeries : null,
                candles: typeof _lwLastCandles !== 'undefined' ? _lwLastCandles : [],
                modules: window._lwModules || null
            };
        } catch (e) {
            return { chart: null, series: null, candles: [], modules: null };
        }
    }

    function isOn(key) {
        const el = document.getElementById(INDICATORS[key].id);
        return !!el && el.dataset.on === 'true';
    }

    // ── Perhitungan ────────────────────────────────────────────────────────
    function atrSeries(candles, period) {
        const out = new Array(candles.length).fill(null);
        if (candles.length <= period) return out;
        let sum = 0;
        for (let i = 1; i <= period; i++) sum += trueRange(candles[i], candles[i - 1]);
        let atr = sum / period;
        out[period] = atr;
        for (let i = period + 1; i < candles.length; i++) {
            atr = (atr * (period - 1) + trueRange(candles[i], candles[i - 1])) / period;
            out[i] = atr;
        }
        return out;
    }

    function trueRange(c, prev) {
        return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    }

    function emaSeries(values, period) {
        const out = new Array(values.length).fill(null);
        if (values.length < period) return out;
        const k = 2 / (period + 1);
        let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
        out[period - 1] = ema;
        for (let i = period; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
            out[i] = ema;
        }
        return out;
    }

    function calcParabolicSAR(candles, step = 0.02, maxStep = 0.2) {
        if (candles.length < 3) return [];
        let up = candles[1].close >= candles[0].close;
        let sar = up ? candles[0].low : candles[0].high;
        let ep = up ? candles[1].high : candles[1].low;
        let af = step;
        const out = [];
        for (let i = 1; i < candles.length; i++) {
            const c = candles[i];
            sar = sar + af * (ep - sar);
            // SAR tidak boleh masuk ke range dua candle sebelumnya.
            const p1 = candles[i - 1], p2 = candles[Math.max(0, i - 2)];
            if (up) sar = Math.min(sar, p1.low, p2.low);
            else sar = Math.max(sar, p1.high, p2.high);

            if (up && c.low < sar) {
                up = false; sar = ep; ep = c.low; af = step;
            } else if (!up && c.high > sar) {
                up = true; sar = ep; ep = c.high; af = step;
            } else if (up && c.high > ep) {
                ep = c.high; af = Math.min(af + step, maxStep);
            } else if (!up && c.low < ep) {
                ep = c.low; af = Math.min(af + step, maxStep);
            }
            out.push({ time: c.time, value: sar, color: up ? COLORS.up : COLORS.down });
        }
        return out;
    }

    function calcKeltner(candles, emaPeriod = 20, atrPeriod = 10, mult = 2) {
        const ema = emaSeries(candles.map(c => c.close), emaPeriod);
        const atr = atrSeries(candles, atrPeriod);
        const upper = [], middle = [], lower = [];
        candles.forEach((c, i) => {
            if (ema[i] === null || atr[i] === null) return;
            middle.push({ time: c.time, value: ema[i] });
            upper.push({ time: c.time, value: ema[i] + mult * atr[i] });
            lower.push({ time: c.time, value: ema[i] - mult * atr[i] });
        });
        return { upper, middle, lower };
    }

    function calcSuperTrend(candles, period = 10, mult = 3) {
        const atr = atrSeries(candles, period);
        const up = [], down = [];
        let finalUpper = null, finalLower = null, trendUp = true;
        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            if (atr[i] === null) continue;
            const hl2 = (c.high + c.low) / 2;
            const basicUpper = hl2 + mult * atr[i];
            const basicLower = hl2 - mult * atr[i];
            const prevClose = candles[i - 1].close;
            if (finalUpper === null) {
                finalUpper = basicUpper; finalLower = basicLower; trendUp = c.close >= hl2;
            } else {
                finalUpper = (basicUpper < finalUpper || prevClose > finalUpper) ? basicUpper : finalUpper;
                finalLower = (basicLower > finalLower || prevClose < finalLower) ? basicLower : finalLower;
                if (trendUp && c.close < finalLower) trendUp = false;
                else if (!trendUp && c.close > finalUpper) trendUp = true;
            }
            // Titik kosong (whitespace) memutus garis saat trend berbalik.
            up.push(trendUp ? { time: c.time, value: finalLower } : { time: c.time });
            down.push(trendUp ? { time: c.time } : { time: c.time, value: finalUpper });
        }
        return { up, down };
    }

    /**
     * Liquidity zone = kumpulan equal highs (buy-side) / equal lows (sell-side) yang
     * BELUM disapu harga. Swing dideteksi dengan fractal 2 bar; dua swing dianggap
     * "equal" bila selisihnya ≤ 0,15 × ATR(14).
     */
    function calcLiquidityZones(candles) {
        const n = candles.length;
        if (n < 30) return { bsl: [], ssl: [] };
        const atr = atrSeries(candles, 14);
        const lastAtr = atr[n - 1] || 0;
        if (!(lastAtr > 0)) return { bsl: [], ssl: [] };
        const tol = 0.15 * lastAtr;
        const start = Math.max(2, n - 300);
        const highs = [], lows = [];
        for (let i = start; i < n - 2; i++) {
            const c = candles[i];
            if (c.high > candles[i - 1].high && c.high > candles[i - 2].high && c.high >= candles[i + 1].high && c.high >= candles[i + 2].high) highs.push({ i, price: c.high });
            if (c.low < candles[i - 1].low && c.low < candles[i - 2].low && c.low <= candles[i + 1].low && c.low <= candles[i + 2].low) lows.push({ i, price: c.low });
        }
        const cluster = (swings, isHigh) => {
            const sorted = swings.slice().sort((a, b) => a.price - b.price);
            const groups = [];
            sorted.forEach(s => {
                const g = groups[groups.length - 1];
                if (g && s.price - g.min <= tol) { g.items.push(s); g.max = s.price; }
                else groups.push({ items: [s], min: s.price, max: s.price });
            });
            return groups.filter(g => g.items.length >= 2).map(g => {
                const lastIdx = Math.max(...g.items.map(s => s.i));
                const level = isHigh ? g.max : g.min;
                const swept = candles.slice(lastIdx + 1).some(c => isHigh ? c.high > level : c.low < level);
                return { level, touches: g.items.length, swept };
            }).filter(z => !z.swept);
        };
        const price = candles[n - 1].close;
        const bsl = cluster(highs, true).filter(z => z.level > price).sort((a, b) => a.level - b.level).slice(0, 3);
        const ssl = cluster(lows, false).filter(z => z.level < price).sort((a, b) => b.level - a.level).slice(0, 3);
        return { bsl, ssl };
    }

    function detectCandlePatterns(candles) {
        const n = candles.length;
        const atr = atrSeries(candles, 14);
        const markers = [];
        const start = Math.max(6, n - 200);
        for (let i = start; i < n; i++) {
            const c = candles[i], p = candles[i - 1], pp = candles[i - 2];
            const a = atr[i];
            if (!(a > 0)) continue;
            const body = Math.abs(c.close - c.open);
            const range = c.high - c.low;
            if (!(range > 0)) continue;
            const upper = c.high - Math.max(c.open, c.close);
            const lower = Math.min(c.open, c.close) - c.low;
            const bull = c.close > c.open, bear = c.close < c.open;
            const pBody = Math.abs(p.close - p.open);
            const priorDown = candles[i - 1].close < candles[i - 5].close;
            const priorUp = candles[i - 1].close > candles[i - 5].close;
            let m = null;

            const ppBody = Math.abs(pp.close - pp.open);
            const ppMid = (pp.open + pp.close) / 2;
            if (pp.close < pp.open && ppBody > 0.6 * a && pBody < 0.3 * ppBody && bull && c.close > ppMid && priorDown) {
                m = { up: true, text: 'Morning Star' };
            } else if (pp.close > pp.open && ppBody > 0.6 * a && pBody < 0.3 * ppBody && bear && c.close < ppMid && priorUp) {
                m = { up: false, text: 'Evening Star' };
            } else if (bull && p.close < p.open && c.open <= p.close && c.close >= p.open && body > pBody && priorDown) {
                m = { up: true, text: 'Bull Engulf' };
            } else if (bear && p.close > p.open && c.open >= p.close && c.close <= p.open && body > pBody && priorUp) {
                m = { up: false, text: 'Bear Engulf' };
            } else if (body > 0 && lower >= 2 * body && upper <= 0.25 * range && range >= 0.6 * a && priorDown) {
                m = { up: true, text: 'Hammer' };
            } else if (body > 0 && upper >= 2 * body && lower <= 0.25 * range && range >= 0.6 * a && priorUp) {
                m = { up: false, text: 'Shooting Star' };
            } else if (body <= 0.1 * range && range >= 0.6 * a) {
                m = { up: null, text: 'Doji' };
            }
            if (!m) continue;
            markers.push(m.up === null
                ? { time: c.time, position: 'aboveBar', color: '#a0a5b1', shape: 'circle', text: m.text }
                : { time: c.time, position: m.up ? 'belowBar' : 'aboveBar', color: m.up ? COLORS.up : COLORS.down, shape: m.up ? 'arrowUp' : 'arrowDown', text: m.text });
        }
        return markers.slice(-40);
    }

    // ── Marker: gabung dengan marker modul lain ─────────────────────────────
    // pasangMarker() di dashboard-app.js MENGGANTI semua marker; tanpa penggabungan,
    // marker pola candle akan menghapus marker Golden Cross / mesin (dan sebaliknya).
    function installMarkerMerge() {
        const original = window.pasangMarker;
        if (typeof original !== 'function' || original.__qimMerged) return;
        const merged = function (series, markers) {
            const st = chartState();
            if (series && series === st.series) {
                baseMarkers = Array.isArray(markers) ? markers : [];
                return original(series, combineMarkers());
            }
            return original(series, markers);
        };
        merged.__qimMerged = true;
        merged.__original = original;
        window.pasangMarker = merged;
    }

    function combineMarkers() {
        return baseMarkers.concat(patternMarkers).sort((a, b) => a.time - b.time);
    }

    function applyMarkers() {
        const st = chartState();
        const setter = window.pasangMarker && window.pasangMarker.__original;
        if (st.series && setter) setter(st.series, combineMarkers());
    }

    // ── Render ─────────────────────────────────────────────────────────────
    function clearOwned() {
        const st = chartState();
        if (ownerChart && ownerChart === st.chart) {
            ownedSeries.forEach(s => { try { ownerChart.removeSeries(s); } catch (e) {} });
        }
        if (ownerSeries && ownerSeries === st.series) {
            ownedPriceLines.forEach(pl => { try { ownerSeries.removePriceLine(pl); } catch (e) {} });
        }
        ownedSeries = [];
        ownedPriceLines = [];
        ownerChart = st.chart;
        ownerSeries = st.series;
    }

    function addLine(data, options) {
        const st = chartState();
        const LineSeries = st.modules && st.modules.LineSeries;
        if (!st.chart || !LineSeries || !data.length) return;
        try {
            const s = st.chart.addSeries(LineSeries, Object.assign({
                lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false
            }, options));
            s.setData(data);
            ownedSeries.push(s);
        } catch (e) {
            console.warn('[QIM Indicators] gagal menggambar', options.title, e && e.message);
        }
    }

    function addPriceLine(price, color, title) {
        const st = chartState();
        if (!st.series) return;
        try {
            ownedPriceLines.push(st.series.createPriceLine({ price, color, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title }));
        } catch (e) {}
    }

    function render(candlesArg) {
        const st = chartState();
        clearOwned();
        const candles = Array.isArray(candlesArg) && candlesArg.length ? candlesArg : st.candles;
        if (!st.chart || !st.series || !candles || candles.length < 20) {
            patternMarkers = [];
            applyMarkers();
            return;
        }

        if (isOn('psar')) {
            addLine(calcParabolicSAR(candles), {
                title: 'PSAR', color: COLORS.up, lineWidth: 1, lineVisible: false,
                pointMarkersVisible: true, pointMarkersRadius: 1.5
            });
        }
        if (isOn('keltner')) {
            const kc = calcKeltner(candles);
            addLine(kc.upper, { title: 'KC Upper', color: COLORS.keltner, lineWidth: 1 });
            addLine(kc.middle, { title: 'KC Mid', color: COLORS.keltnerMid, lineWidth: 1, lineStyle: 2 });
            addLine(kc.lower, { title: 'KC Lower', color: COLORS.keltner, lineWidth: 1 });
        }
        if (isOn('supertrend')) {
            const st2 = calcSuperTrend(candles);
            addLine(st2.up, { title: 'SuperTrend ▲', color: COLORS.up, lineWidth: 2 });
            addLine(st2.down, { title: 'SuperTrend ▼', color: COLORS.down, lineWidth: 2 });
        }
        if (isOn('liquidity')) {
            const liq = calcLiquidityZones(candles);
            liq.bsl.forEach(z => addPriceLine(z.level, COLORS.bsl, `BSL ×${z.touches}`));
            liq.ssl.forEach(z => addPriceLine(z.level, COLORS.ssl, `SSL ×${z.touches}`));
        }
        patternMarkers = isOn('candles') ? detectCandlePatterns(candles) : [];
        applyMarkers();
    }

    // ── Kendali tombol ─────────────────────────────────────────────────────
    function toggle(btn) {
        const on = btn.dataset.on !== 'true';
        btn.dataset.on = on ? 'true' : 'false';
        btn.classList.toggle('active', on);
        render();
    }

    function setAll(on) {
        Object.values(INDICATORS).forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) { el.dataset.on = on ? 'true' : 'false'; el.classList.toggle('active', on); }
        });
        render();
    }

    function install() {
        installMarkerMerge();
        const draw = window.drawAutoIndicators;
        if (typeof draw === 'function' && !draw.__qimWrapped) {
            const wrapped = async function (candles) {
                const result = await draw.apply(this, arguments);
                render(candles);
                return result;
            };
            wrapped.__qimWrapped = true;
            window.drawAutoIndicators = wrapped;
        }
        const setAllBase = window.setAllInds;
        if (typeof setAllBase === 'function' && !setAllBase.__qimWrapped) {
            const wrappedAll = function (on) { setAllBase(on); setAll(on); };
            wrappedAll.__qimWrapped = true;
            window.setAllInds = wrappedAll;
        }
    }

    window.QIMIndicators = {
        toggle, render,
        calc: { calcParabolicSAR, calcKeltner, calcSuperTrend, calcLiquidityZones, detectCandlePatterns, atrSeries }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
})();
