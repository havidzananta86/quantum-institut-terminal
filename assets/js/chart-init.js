/**
 * Quantum Institut Market Terminal
 * Chart Engine v4.0 — Normalisasi Universal + Quantum Engine Overlay
 *
 * FITUR BARU v4.0:
 *  ✦ normalizeCandles() — sort, dedup, validasi OHLC, filter gap ATR
 *  ✦ _calcATR()         — Average True Range untuk filter anomali data
 *  ✦ QuantumEngineOverlay — gambar SNR, SMC, EMA200, Ichimoku, Fibonacci,
 *                           TrendM5, MomentumNY, MACD, GoldenCross otomatis di chart
 *  ✦ WebSocket auto-reconnect dengan exponential backoff
 *  ✦ Yahoo polling 30 detik dengan validasi candle sebelum update
 *  ✦ Semua provider lewat pipeline normalisasi yang sama
 */

/* =============================================================
   KONSTANTA KONFIGURASI
   ============================================================= */

const QI_SYMBOL_CONFIG = {
    BTCUSDT: { provider:'binance', binanceSym:'BTCUSDT', label:'BTC/USDT', priceDp:2, type:'crypto' },
    ETHUSDT: { provider:'binance', binanceSym:'ETHUSDT', label:'ETH/USDT', priceDp:2, type:'crypto' },
    SOLUSDT: { provider:'binance', binanceSym:'SOLUSDT', label:'SOL/USDT', priceDp:3, type:'crypto' },
    BNBUSDT: { provider:'binance', binanceSym:'BNBUSDT', label:'BNB/USDT', priceDp:2, type:'crypto' },
    XAUUSD:  { provider:'local',   label:'XAU/USD', priceDp:2, type:'gold' },
    EURUSD:  { provider:'local',   label:'EUR/USD', priceDp:5, type:'forex' },
};

const QI_INTERVAL_MAP = {
    '1':   { binance:'1m',  biquote:'1m',  yahoo:'1m',  yahooRange:'1d'  },
    '5':   { binance:'5m',  biquote:'5m',  yahoo:'5m',  yahooRange:'5d'  },
    '15':  { binance:'15m', biquote:'15m', yahoo:'15m', yahooRange:'5d'  },
    '30':  { binance:'30m', biquote:'30m', yahoo:'30m', yahooRange:'1mo' },
    '60':  { binance:'1h',  biquote:'1h',  yahoo:'60m', yahooRange:'1mo' },
    '240': { binance:'4h',  biquote:'4h',  yahoo:'60m', yahooRange:'3mo' },
    'D':   { binance:'1d',  biquote:'1d',  yahoo:'1d',  yahooRange:'1y'  },
    'M1':  { binance:'1m',  biquote:'1m',  yahoo:'1m',  yahooRange:'1d'  },
    'M5':  { binance:'5m',  biquote:'5m',  yahoo:'5m',  yahooRange:'5d'  },
    'M15': { binance:'15m', biquote:'15m', yahoo:'15m', yahooRange:'5d'  },
    'H1':  { binance:'1h',  biquote:'1h',  yahoo:'60m', yahooRange:'1mo' },
    'H4':  { binance:'4h',  biquote:'4h',  yahoo:'60m', yahooRange:'3mo' },
    'D1':  { binance:'1d',  biquote:'1d',  yahoo:'1d',  yahooRange:'1y'  },
};

const QI_CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];


/* =============================================================
   A1. NORMALISASI DATA UNIVERSAL
   ============================================================= */

/**
 * normalizeCandles(raw, provider)
 *  - Konversi format dari provider ke format standar OHLCV
 *  - Sort ascending by time
 *  - Deduplikasi berdasarkan time key
 *  - Validasi OHLC: high>=low, semua >0, high>=max(open,close), low<=min(open,close)
 *  - Filter candle dengan gap harga > 5x ATR (anomali / bad tick)
 */
function normalizeCandles(raw, provider) {
    let candles = [];

    if (provider === 'binance') {
        candles = raw.map(d => ({
            time:   Math.floor(d[0] / 1000),
            open:   +d[1], high: +d[2], low: +d[3], close: +d[4],
            volume: +d[5],
        }));
    } else if (provider === 'biquote') {
        const bars = Array.isArray(raw?.bars) ? raw.bars : (Array.isArray(raw) ? raw : []);
        candles = bars.map(b => ({
            time:   Math.floor(new Date(b.openTime || b.time).getTime() / 1000),
            open:   +b.open,
            high:   +b.high,
            low:    +b.low,
            close:  +b.close,
            volume: +(b.tickVolume || b.volume || 0),
        })).filter(c => !isNaN(c.time) && c.time > 0);
    } else if (provider === 'yahoo') {
        const { timestamps, ohlcv } = raw;
        for (let i = 0; i < timestamps.length; i++) {
            const o = ohlcv.open[i], h = ohlcv.high[i];
            const l = ohlcv.low[i],  c = ohlcv.close[i];
            if (!o || !h || !l || !c) continue;
            candles.push({
                time:   timestamps[i],
                open:   +o, high: +h, low: +l, close: +c,
                volume: +(ohlcv.volume?.[i] || 0),
            });
        }
    }

    // 1. Sort ascending
    candles.sort((a, b) => a.time - b.time);

    // 2. Deduplikasi — simpan candle terakhir per timestamp
    const deduped = new Map();
    candles.forEach(c => deduped.set(c.time, c));
    candles = [...deduped.values()];

    // 3. Validasi OHLC dasar
    candles = candles.filter(c => {
        if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) return false;
        if (isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close)) return false;
        if (c.high < c.low) return false;
        if (c.high < Math.max(c.open, c.close)) return false;
        if (c.low  > Math.min(c.open, c.close)) return false;
        return true;
    });

    // 4. Filter gap ekstrem > 5x ATR (bad tick / data anomali)
    if (candles.length > 20) {
        const atr = _calcATR(candles, 14);
        candles = candles.filter((c, i) => {
            if (i === 0 || atr[i] === null) return true;
            const gap = Math.abs(c.open - candles[i-1].close);
            return gap <= atr[i] * 5;
        });
    }

    return candles;
}

/** Hitung ATR(14) untuk array candles, return array nilai ATR per candle */
function _calcATR(candles, period = 14) {
    const result = Array(candles.length).fill(null);
    if (candles.length < period + 1) return result;

    const trList = candles.map((c, i) => {
        if (i === 0) return c.high - c.low;
        const prev = candles[i-1].close;
        return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
    });

    let atrSum = trList.slice(0, period).reduce((a, b) => a + b, 0);
    result[period - 1] = atrSum / period;

    for (let i = period; i < candles.length; i++) {
        result[i] = (result[i-1] * (period - 1) + trList[i]) / period;
    }
    return result;
}


/* =============================================================
   A2. INDIKATOR KALKULASI
   ============================================================= */

function _calcEMA(closes, period) {
    const k = 2 / (period + 1);
    const result = Array(closes.length).fill(null);
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1)       { sum += closes[i]; }
        else if (i === period - 1) { sum += closes[i]; result[i] = sum / period; }
        else                       { result[i] = closes[i] * k + result[i-1] * (1 - k); }
    }
    return result;
}

function _calcSMA(closes, period) {
    return closes.map((_, i) => {
        if (i < period - 1) return null;
        return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    });
}

function _calcRSI(closes, period = 14) {
    const result = Array(closes.length).fill(null);
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const d = closes[i] - closes[i-1];
        if (d > 0) gains += d; else losses -= d;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    result[period] = 100 - (100 / (1 + avgGain / (avgLoss || 0.0001)));

    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i-1];
        avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
        result[i] = 100 - (100 / (1 + avgGain / (avgLoss || 0.0001)));
    }
    return result;
}

function _calcMACD(closes, fast=12, slow=26, signal=9) {
    const emaFast   = _calcEMA(closes, fast);
    const emaSlow   = _calcEMA(closes, slow);
    const macdLine  = emaFast.map((v, i) => v !== null && emaSlow[i] !== null ? v - emaSlow[i] : null);
    const validMACD = macdLine.filter(v => v !== null);
    const sigRaw    = _calcEMA(validMACD, signal);

    // re-align signal ke indeks penuh
    const sigLine = Array(closes.length).fill(null);
    let si = 0;
    macdLine.forEach((v, i) => { if (v !== null) { sigLine[i] = sigRaw[si++] ?? null; } });
    const hist = macdLine.map((v, i) => v !== null && sigLine[i] !== null ? v - sigLine[i] : null);
    return { macdLine, sigLine, hist };
}

/**
 * Konversi Candle OHLC standar ke Heikin Ashi
 */
function _toHeikinAshi(candles) {
    if (!candles || candles.length === 0) return [];
    const ha = [];
    let prevOpen = (candles[0].open + candles[0].close) / 2;
    let prevClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        const haOpen = i === 0 ? prevOpen : (prevOpen + prevClose) / 2;
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);

        ha.push({
            time: c.time,
            open: haOpen,
            high: haHigh,
            low: haLow,
            close: haClose,
            volume: c.volume
        });
        prevOpen = haOpen;
        prevClose = haClose;
    }
    return ha;
}



/* =============================================================
   B. QUANTUM ENGINE OVERLAY — Gambar Indikator di Chart
   ============================================================= */

class QuantumEngineOverlay {
    constructor(chart, candleSeries) {
        this.chart        = chart;
        this.candleSeries = candleSeries;
        this._priceLines  = [];   // semua price lines yang dibuat oleh engine
        this._extraSeries = [];   // semua line series tambahan
    }

    /** Bersihkan semua overlay engine sebelum ganti engine */
    clearAll() {
        this._priceLines.forEach(l => {
            try { this.candleSeries.removePriceLine(l); } catch(e) {}
        });
        this._priceLines = [];

        this._extraSeries.forEach(s => {
            try { this.chart.removeSeries(s); } catch(e) {}
        });
        this._extraSeries = [];
    }

    /** Tambahkan price line dan catat untuk cleanup */
    _addPriceLine(opts) {
        const line = this.candleSeries.createPriceLine(opts);
        this._priceLines.push(line);
        return line;
    }

    /** Tambahkan line series dan catat untuk cleanup */
    _addLineSeries(opts, data) {
        const s = this.chart.addLineSeries({
            ...opts,
            priceLineVisible:    false,
            lastValueVisible:    false,
            pointMarkersVisible: false,
            crosshairMarkerVisible: false,
            crosshairMarkerRadius:  0,
        });
        if (data && data.length > 0) s.setData(data);
        this._extraSeries.push(s);
        return s;
    }

    /* ── ENGINE a: QUANTUM SNR (Support & Resistance Levels) ── */
    drawSNR(candles) {
        if (!candles || candles.length < 20) return;

        const n    = candles.length;
        const last = candles[n - 1].close;
        const atr  = _calcATR(candles, 14);
        const atrNow = atr[n-1] || (last * 0.004);
        const tol    = atrNow * 0.6; // cluster tolerance

        // 1. Kumpulkan semua swing high/low sebagai kandidat level
        const candidates = [];
        for (let i = 3; i < n - 3; i++) {
            const h = candles[i].high, l = candles[i].low;
            const isSwingHigh = h > candles[i-1].high && h > candles[i-2].high && h > candles[i-3].high &&
                                h > candles[i+1].high && h > candles[i+2].high && h > candles[i+3].high;
            const isSwingLow  = l < candles[i-1].low  && l < candles[i-2].low  && l < candles[i-3].low &&
                                l < candles[i+1].low  && l < candles[i+2].low  && l < candles[i+3].low;
            if (isSwingHigh) candidates.push(h);
            if (isSwingLow)  candidates.push(l);
        }

        // 2. Cluster level berdekatan, hitung berapa kali disentuh
        const sorted = [...candidates].sort((a, b) => a - b);
        const clusters = []; // {price, touches}
        for (const p of sorted) {
            const existing = clusters.find(c => Math.abs(c.price - p) <= tol);
            if (existing) {
                existing.price = (existing.price * existing.touches + p) / (existing.touches + 1); // moving avg
                existing.touches++;
            } else {
                clusters.push({ price: p, touches: 1 });
            }
        }

        // 3. Hitung berapa kali setiap candle menyentuh level (close/open dalam range tol)
        for (const cl of clusters) {
            for (const c of candles) {
                const bodyHigh = Math.max(c.open, c.close);
                const bodyLow  = Math.min(c.open, c.close);
                if (Math.abs(bodyHigh - cl.price) <= tol || Math.abs(bodyLow - cl.price) <= tol ||
                    (bodyLow <= cl.price && cl.price <= bodyHigh)) {
                    cl.touches++;
                }
            }
        }

        // 4. Filter: minimal 2 sentuhan, buang yang terlalu dekat current price (< 0.5 ATR)
        const valid = clusters
            .filter(cl => cl.touches >= 2 && Math.abs(cl.price - last) > atrNow * 0.3)
            .sort((a, b) => b.touches - a.touches)
            .slice(0, 14); // max 14 level

        // 5. Gambar level — merah di atas harga, hijau di bawah
        for (const cl of valid) {
            const isRes = cl.price > last;
            const alpha = Math.min(1, 0.4 + cl.touches * 0.08);
            const color = isRes
                ? `rgba(255,77,109,${alpha.toFixed(2)})`
                : `rgba(0,255,163,${alpha.toFixed(2)})`;
            this._addPriceLine({
                price:            cl.price,
                color:            color,
                lineWidth:        cl.touches >= 6 ? 2 : 1,
                lineStyle:        LightweightCharts.LineStyle.Dashed,
                title:            `${isRes ? 'R' : 'S'} ${cl.touches}x`,
                axisLabelVisible: true,
            });
        }
    }

    /* ── ENGINE b: QUANTUM SMC (Order Block + BOS/CHoCH) ── */
    drawSMC(candles) {
        if (!candles || candles.length < 30) return;
        const n    = candles.length;
        const last = candles[n-1];

        // Order Block: candle bearish kuat sebelum bullish breakout (bullish OB)
        // Cari lilin dengan body terbesar dalam 50 candle terakhir
        const window = candles.slice(-50);
        let maxBody = 0, bullishOB = null, bearishOB = null;

        for (let i = 1; i < window.length - 3; i++) {
            const c = window[i];
            const body = Math.abs(c.close - c.open);
            const isBearishCandle = c.close < c.open;
            const nextBullish     = window[i+1].close > window[i+1].open &&
                                    window[i+1].close > c.high;

            if (isBearishCandle && nextBullish && body > maxBody) {
                maxBody = body;
                bullishOB = c;  // Bullish Order Block (entry zona buy)
            }
        }

        maxBody = 0;
        for (let i = 1; i < window.length - 3; i++) {
            const c = window[i];
            const body = Math.abs(c.close - c.open);
            const isBullishCandle = c.close > c.open;
            const nextBearish     = window[i+1].close < window[i+1].open &&
                                    window[i+1].close < c.low;

            if (isBullishCandle && nextBearish && body > maxBody) {
                maxBody = body;
                bearishOB = c;
            }
        }

        // Gambar Order Block zones sebagai price lines
        if (bullishOB) {
            this._addPriceLine({
                price: bullishOB.high, color:'#00E5FF',
                lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dashed,
                title:'OB TOP (Bullish)', axisLabelVisible: false,
            });
            this._addPriceLine({
                price: bullishOB.low, color:'#00E5FF',
                lineWidth:2, lineStyle: LightweightCharts.LineStyle.Solid,
                title:'OB BUY ZONE', axisLabelVisible: true,
            });
        }

        if (bearishOB) {
            this._addPriceLine({
                price: bearishOB.high, color:'#FF4D6D',
                lineWidth:2, lineStyle: LightweightCharts.LineStyle.Solid,
                title:'OB SELL ZONE', axisLabelVisible: true,
            });
            this._addPriceLine({
                price: bearishOB.low, color:'#FF4D6D',
                lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dashed,
                title:'OB BOTTOM (Bearish)', axisLabelVisible: false,
            });
        }

        // BOS: Break of Structure — cari swing high yang ditembus
        const swingHighs = candles.slice(-30).filter((c, i, arr) =>
            i > 1 && i < arr.length-2 &&
            c.high > arr[i-1].high && c.high > arr[i+1].high
        );
        if (swingHighs.length > 0) {
            const bosLevel = swingHighs[swingHighs.length-1].high;
            if (last.close > bosLevel) {
                this._addPriceLine({
                    price: bosLevel, color:'#7C4DFF',
                    lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dotted,
                    title:'BOS', axisLabelVisible: true,
                });
            }
        }
    }

    /* ── ENGINE c: EMA200 PULLBACK ── */
    drawEMA200(candles) {
        if (!candles || candles.length < 50) return;

        const closes = candles.map(c => c.close);
        const period = Math.min(200, Math.floor(candles.length * 0.7));
        const ema200 = _calcEMA(closes, period);
        const ema50  = _calcEMA(closes, Math.min(50, Math.floor(period * 0.25)));

        const ema200Data = candles
            .map((c, i) => ({ time: c.time, value: ema200[i] }))
            .filter(d => d.value !== null);

        const ema50Data = candles
            .map((c, i) => ({ time: c.time, value: ema50[i] }))
            .filter(d => d.value !== null);

        this._addLineSeries(
            { color: '#FFAB00', lineWidth: 2 },
            ema200Data
        );
        this._addLineSeries(
            { color: '#FF6B6B', lineWidth: 1 },
            ema50Data
        );

        // Mark pullback zone (EMA200 ± 0.3%)
        const lastEma = ema200Data[ema200Data.length-1]?.value;
        if (lastEma) {
            this._addPriceLine({
                price: lastEma * 1.003, color:'#FFAB00',
                lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dotted,
                title:'EMA200+0.3%',
            });
            this._addPriceLine({
                price: lastEma * 0.997, color:'#FFAB00',
                lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dotted,
                title:'EMA200-0.3%',
            });
        }
    }

    /* ── ENGINE d: ICHIMOKU CLOUD (Kumo Cloud) ── */
    drawIchimoku(candles) {
        if (!candles || candles.length < 52) return;
        const n = candles.length;

        const donchian = (period, idx) => {
            const sl = candles.slice(Math.max(0, idx - period + 1), idx + 1);
            return (Math.max(...sl.map(c=>c.high)) + Math.min(...sl.map(c=>c.low))) / 2;
        };

        const tenkanData = [], kijunData = [], senkouAData = [], senkouBData = [];

        for (let i = 8; i < n; i++) {
            tenkanData.push({ time: candles[i].time, value: donchian(9, i) });
        }
        for (let i = 25; i < n; i++) {
            kijunData.push({ time: candles[i].time, value: donchian(26, i) });
        }
        for (let i = 25; i < n; i++) {
            const tK = donchian(9, i);
            const kJ = donchian(26, i);
            senkouAData.push({ time: candles[i].time, value: (tK + kJ) / 2 });
        }
        for (let i = 51; i < n; i++) {
            senkouBData.push({ time: candles[i].time, value: donchian(52, i) });
        }

        this._addLineSeries({ color: 'rgba(0,229,255,0.7)',  lineWidth: 1 }, tenkanData);
        this._addLineSeries({ color: 'rgba(255,107,107,0.7)', lineWidth: 1 }, kijunData);
        this._addLineSeries({ color: 'rgba(0,255,163,0.4)',  lineWidth: 1 }, senkouAData);
        this._addLineSeries({ color: 'rgba(255,77,109,0.4)', lineWidth: 1 }, senkouBData);

        // Garis Kumo Cloud saat ini
        const lastSA = senkouAData[senkouAData.length-1]?.value;
        const lastSB = senkouBData[senkouBData.length-1]?.value;
        if (lastSA && lastSB) {
            this._addPriceLine({
                price: lastSA, color:'rgba(0,255,163,0.6)',
                lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dashed, title:'Senkou A',
            });
            this._addPriceLine({
                price: lastSB, color:'rgba(255,77,109,0.6)',
                lineWidth:1, lineStyle: LightweightCharts.LineStyle.Dashed, title:'Senkou B',
            });
        }
    }

    /* ── ENGINE e: FIBONACCI GOLDEN ZONE (0.382–0.618) ── */
    drawFibonacci(candles) {
        if (!candles || candles.length < 20) return;

        // Cari swing high & low dalam 50 candle terakhir
        const window = candles.slice(-50);
        const swingHigh = Math.max(...window.map(c => c.high));
        const swingLow  = Math.min(...window.map(c => c.low));
        const range     = swingHigh - swingLow;
        if (range <= 0) return;

        const fibLevels = [
            { ratio: 0.000, label: 'FIB 0.0%',   color:'#94A3B8' },
            { ratio: 0.236, label: 'FIB 23.6%',  color:'#94A3B8' },
            { ratio: 0.382, label: 'FIB 38.2% ●', color:'#FFAB00' },
            { ratio: 0.500, label: 'FIB 50.0% ●', color:'#FFAB00' },
            { ratio: 0.618, label: 'FIB 61.8% ●', color:'#FF6B6B' },
            { ratio: 0.786, label: 'FIB 78.6%',  color:'#94A3B8' },
            { ratio: 1.000, label: 'FIB 100%',   color:'#94A3B8' },
        ];

        fibLevels.forEach(({ ratio, label, color }) => {
            const isGolden = [0.382, 0.5, 0.618].includes(ratio);
            this._addPriceLine({
                price: swingHigh - range * ratio,
                color,
                lineWidth: isGolden ? 2 : 1,
                lineStyle: isGolden
                    ? LightweightCharts.LineStyle.Solid
                    : LightweightCharts.LineStyle.Dotted,
                title: label,
                axisLabelVisible: isGolden,
            });
        });
    }

    /* ── ENGINE f: TREN M5 SCALPING ── */
    drawTrenM5(candles) {
        if (!candles || candles.length < 20) return;
        const closes = candles.map(c => c.close);
        const ema8   = _calcEMA(closes, 8);
        const ema21  = _calcEMA(closes, 21);

        this._addLineSeries(
            { color:'#00E5FF', lineWidth:1 },
            candles.map((c,i) => ({ time:c.time, value:ema8[i] })).filter(d=>d.value!==null)
        );
        this._addLineSeries(
            { color:'#7C4DFF', lineWidth:1 },
            candles.map((c,i) => ({ time:c.time, value:ema21[i] })).filter(d=>d.value!==null)
        );
    }

    /* ── ENGINE g: MOMENTUM NY ── */
    drawMomentumNY(candles) {
        if (!candles || candles.length < 14) return;

        const closes = candles.map(c => c.close);
        const atr    = _calcATR(candles, 14);
        const n      = candles.length;
        const last   = candles[n-1];
        const atrNow = atr[n-1] || last.close * 0.005;

        // Momentum zone: harga ± 1x ATR dari close saat ini
        this._addPriceLine({
            price: last.close + atrNow * 1.0,
            color: '#00FFA3', lineWidth:1,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            title: 'MOM +1 ATR',
        });
        this._addPriceLine({
            price: last.close - atrNow * 1.0,
            color: '#FF4D6D', lineWidth:1,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            title: 'MOM -1 ATR',
        });

        // Vwap proxy (SMA20 sebagai pengganti VWAP)
        const sma20 = _calcSMA(closes, 20);
        this._addLineSeries(
            { color:'rgba(255,171,0,0.7)', lineWidth:1 },
            candles.map((c,i) => ({ time:c.time, value:sma20[i] })).filter(d=>d.value!==null)
        );
    }

    /* ── ENGINE h: MACD MOMENTUM ── */
    drawMACD(candles) {
        if (!candles || candles.length < 30) return;
        const closes = candles.map(c => c.close);
        const { macdLine, sigLine } = _calcMACD(closes, 12, 26, 9);

        // Tampilkan MACD sebagai price lines di chart utama (referensi visual)
        const lastMACD = macdLine.filter(v=>v!==null).slice(-1)[0];
        const lastSig  = sigLine.filter(v=>v!==null).slice(-1)[0];
        if (lastMACD === undefined || lastSig === undefined) return;

        const lastClose = candles[candles.length-1].close;
        const macdPct   = (lastMACD / lastClose) * 100;

        this._addPriceLine({
            price: lastClose * (1 + macdPct * 0.5 / 100),
            color: lastMACD > lastSig ? '#00FFA3' : '#FF4D6D',
            lineWidth:2, lineStyle: LightweightCharts.LineStyle.Solid,
            title: lastMACD > lastSig ? 'MACD BULLISH ▲' : 'MACD BEARISH ▼',
            axisLabelVisible: true,
        });
    }

    /* ── ENGINE i: GOLDEN CROSS (EMA50 x EMA200) ── */
    drawGoldenCross(candles) {
        if (!candles || candles.length < 50) return;
        const closes = candles.map(c => c.close);
        const period50  = Math.min(50,  Math.floor(candles.length * 0.5));
        const period200 = Math.min(200, candles.length - 1);
        const ema50  = _calcEMA(closes, period50);
        const ema200 = _calcEMA(closes, period200);

        const ema50Data = candles
            .map((c,i) => ({ time:c.time, value:ema50[i]  })).filter(d=>d.value!==null);
        const ema200Data = candles
            .map((c,i) => ({ time:c.time, value:ema200[i] })).filter(d=>d.value!==null);

        this._addLineSeries({ color:'#FFD700', lineWidth:2 }, ema50Data);
        this._addLineSeries({ color:'#C0C0C0', lineWidth:1 }, ema200Data);

        // Deteksi Golden Cross atau Death Cross
        const n = closes.length;
        if (ema50[n-1] && ema200[n-1] && ema50[n-2] && ema200[n-2]) {
            const crossedUp   = ema50[n-2] <= ema200[n-2] && ema50[n-1] > ema200[n-1];
            const crossedDown = ema50[n-2] >= ema200[n-2] && ema50[n-1] < ema200[n-1];
            if (crossedUp) {
                this._addPriceLine({
                    price: closes[n-1], color:'#FFD700',
                    lineWidth:2, lineStyle: LightweightCharts.LineStyle.Solid,
                    title:'🟡 GOLDEN CROSS', axisLabelVisible: true,
                });
            } else if (crossedDown) {
                this._addPriceLine({
                    price: closes[n-1], color:'#C0C0C0',
                    lineWidth:2, lineStyle: LightweightCharts.LineStyle.Solid,
                    title:'⚫ DEATH CROSS', axisLabelVisible: true,
                });
            }
        }
    }

    /* ── DISPATCH ke engine yang aktif ── */
    drawEngine(engineCode, candles) {
        this.clearAll();
        if (!candles || candles.length < 10) return;

        switch (engineCode) {
            case 'SNR':          this.drawSNR(candles);          break;
            case 'SMC':          this.drawSMC(candles);          break;
            case 'EMA200':       this.drawEMA200(candles);       break;
            case 'ICHI':         this.drawIchimoku(candles);     break;
            case 'FIBO':         this.drawFibonacci(candles);    break;
            case 'TRENM5':       this.drawTrenM5(candles);       break;
            case 'MOMENTUM_NY':  this.drawMomentumNY(candles);   break;
            case 'MACD_MOM':     this.drawMACD(candles);         break;
            case 'GOLDEN_CROSS': this.drawGoldenCross(candles);  break;
            default:             this.drawSNR(candles);
        }
    }
}


/* =============================================================
   KELAS UTAMA — Chart Manager
   ============================================================= */
class QuantumRealtimeTerminalManager {
    constructor(options = {}) {
        this.containerId     = options.containerId  || 'tv_advanced_main';
        this.currentSymbol   = options.symbol       || 'BTCUSDT';
        this.currentInterval = options.interval     || '60';
        this.currentEngine   = options.engine       || 'SNR';

        this.chart        = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.emaSeries    = null;
        this.overlay      = null;   // QuantumEngineOverlay instance

        this.wsKline       = null;
        this.wsTicker      = null;
        this.wsRetryTimer  = null;
        this.wsRetryDelay  = 3000;  // exponential backoff initial
        this._abortCtrl    = null;
        this._yahooPoller  = null;

        this.lastClosePrice = 0;
        this._cachedCandles = [];
        this.createdPriceLines = [];
        this._drawingSeries = [];
        this._drawingMarkers = [];
        this._drawingTool = null;
        this._drawClicks = [];
        this.isCrosshairActive = true;
        this.isMagnetActive = false;
        this.candleType = 'standard';     // 'standard' | 'heikinashi'
        this.currentBarSpacing = 6;
    }

    /* =========================================================
       INIT CHART
       ========================================================= */
    initChart() {
        const container = document.getElementById(this.containerId);
        if (!container) { console.error('[QI] Container tidak ditemukan:', this.containerId); return; }

        // iOS Standalone PWA CDN loader fallback
        if (typeof LightweightCharts === 'undefined') {
            console.warn('[QI iOS PWA] LightweightCharts belum siap. Memulai CDN retry & fallback loader...');
            this._showStatus('⟳ Memuat library TradingView Lightweight Charts...');

            if (!document.getElementById('qi-backup-cdn-jsdelivr')) {
                const s1 = document.createElement('script');
                s1.id = 'qi-backup-cdn-jsdelivr';
                s1.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js';
                document.head.appendChild(s1);
            }
            if (!document.getElementById('qi-backup-cdn-cdnjs')) {
                const s2 = document.createElement('script');
                s2.id = 'qi-backup-cdn-cdnjs';
                s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/4.1.3/lightweight-charts.standalone.production.js';
                document.head.appendChild(s2);
            }

            let attempts = 0;
            const checkTimer = setInterval(() => {
                attempts++;
                if (typeof LightweightCharts !== 'undefined') {
                    clearInterval(checkTimer);
                    console.log('[QI] LightweightCharts siap setelah', attempts * 200, 'ms');
                    this.initChart();
                } else if (attempts >= 40) { // 8 detik timeout
                    clearInterval(checkTimer);
                    this._showError('Gagal memuat library chart. Silakan cek koneksi internet.');
                }
            }, 200);
            return;
        }

        // Background engine mode: container is hidden (left:-9999px) — force fixed size
        const isBackgroundEngine = container.offsetLeft < -100 || container.style.left === '-9999px';
        if (isBackgroundEngine) {
            container.style.position = 'absolute';
            container.style.width  = '800px';
            container.style.height = '500px';
        } else if (container.offsetHeight < 50) {
            container.style.height = '500px';
            container.style.minHeight = '300px';
        }

        if (this.chart) { try { this.chart.remove(); } catch(e) {} this.chart = null; }
        container.innerHTML = '';

        const parentW = isBackgroundEngine ? 800 : (container.clientWidth || container.offsetWidth || (container.parentElement ? container.parentElement.clientWidth : 0) || 800);
        const parentH = isBackgroundEngine ? 500 : (container.offsetHeight || container.clientHeight || 500);

        this.chart = LightweightCharts.createChart(container, {
            width:  parentW > 50 ? parentW : 800,
            height: parentH > 50 ? parentH : 500,
            layout: {
                background: { type:'solid', color:'#050A1A' },
                textColor:  '#94A3B8',
                fontFamily: 'JetBrains Mono, monospace',
            },
            grid: {
                vertLines: { color:'rgba(255,255,255,0.03)' },
                horzLines: { color:'rgba(255,255,255,0.03)' },
            },
            crosshair:       { mode: LightweightCharts.CrosshairMode.Normal },
            rightPriceScale: { borderColor:'rgba(0,229,255,0.2)' },
            timeScale: {
                borderColor:'rgba(0,229,255,0.2)',
                timeVisible: true, secondsVisible: false,
                barSpacing: this.currentBarSpacing, rightOffset: 5,
            },
            handleScroll: true,
            handleScale:  true,
        });

        this.candleSeries = this.chart.addCandlestickSeries({
            upColor:'#00FFA3', downColor:'#FF4D6D',
            borderUpColor:'#00FFA3', borderDownColor:'#FF4D6D',
            wickUpColor:'#00FFA3', wickDownColor:'#FF4D6D',
        });

        // Volume histogram dihapus — mengganggu pandangan candle

        this.emaSeries = this.chart.addLineSeries({
            color:'#7C4DFF', lineWidth:1,
            priceLineVisible: false, lastValueVisible: false,
            pointMarkersVisible: false, crosshairMarkerVisible: false,
            crosshairMarkerRadius: 0,
        });

        this.overlay = new QuantumEngineOverlay(this.chart, this.candleSeries);

        // Multi-stage forceResize for iOS Safari Standalone WebApp flex layout recalculations
        const forceResize = () => {
            if (this.chart && container) {
                const w = container.clientWidth || container.offsetWidth || 800;
                const h = container.offsetHeight || container.clientHeight || 500;
                if (w > 50 && h > 50) {
                    this.chart.applyOptions({ width: w, height: h });
                }
            }
        };
        setTimeout(forceResize, 100);
        setTimeout(forceResize, 300);
        setTimeout(forceResize, 700);
        setTimeout(forceResize, 1200);

        try {
            new ResizeObserver(forceResize).observe(container);
        } catch(e) {
            window.addEventListener('resize', forceResize);
        }

        // iOS Standalone app visibility resume listener
        if (!this._visibilityAttached) {
            this._visibilityAttached = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.chart && this.currentSymbol) {
                    console.log('[QI iOS PWA] App resumed — reloading chart data...');
                    forceResize();
                    this._loadDataAndStream();
                }
            });
        }

        this._initDrawingSystem();
        this._loadDataAndStream();
    }

    /* =========================================================
       ROUTER UTAMA
       ========================================================= */
    async _loadDataAndStream() {
        if (this._abortCtrl) this._abortCtrl.abort();
        this._abortCtrl = new AbortController();
        this._closeWebSockets();
        this._stopYahooPoller();
        this._stopBiquoteSignalR();
        if (this._localPoller) { clearInterval(this._localPoller); this._localPoller = null; }

        const cfg = QI_SYMBOL_CONFIG[this.currentSymbol];
        if (!cfg) { this._showError(`Simbol "${this.currentSymbol}" tidak didukung`); return; }
        this._showStatus(`⟳ Memuat ${cfg.label}...`);

        if (cfg.provider === 'binance') {
            await this._loadBinance(cfg);
        } else if (cfg.provider === 'local') {
            await this._loadLocal(cfg);
        } else if (cfg.provider === 'biquote') {
            await this._loadBiquote(cfg);
        } else if (cfg.provider === 'binancePaxg') {
            await this._loadXauusd(cfg);
        } else if (cfg.provider === 'yahoo') {
            await this._loadYahoo(cfg);
        }
    }

    /* =========================================================
       LOCAL BACKEND API — primary untuk XAUUSD & EURUSD
       Pakai PHP proxy (Twelve Data cache 60s) — zero WS, zero spam
       ========================================================= */
    async _loadLocal(cfg) {
        const sym      = this.currentSymbol;
        const interval = this.currentInterval;
        try {
            const url  = `/webapp/api/get-chart-data.php?symbol=${sym}&interval=${interval}`;
            const res  = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.status === 'success' && Array.isArray(json.candles) && json.candles.length > 5) {
                this._renderCandles(json.candles, cfg);
                this._startLocalPoller(cfg);
                return;
            }
        } catch(e) {
            console.warn(`[QI Local] Fetch gagal untuk ${sym}:`, e.message);
        }
        // Fallback: synthetic
        const candles = this._generateSyntheticCandles(sym, cfg.priceDp);
        this._renderCandles(candles, cfg);
        this._startLocalPoller(cfg);
    }

    /* Poller ringan: update candle terakhir dari window._livePrices setiap 5 detik */
    _startLocalPoller(cfg) {
        if (this._localPoller) { clearInterval(this._localPoller); this._localPoller = null; }
        const sym = this.currentSymbol;
        this._localPoller = setInterval(() => {
            if (this.currentSymbol !== sym) { clearInterval(this._localPoller); return; }
            const price = window._livePrices?.[sym];
            if (!price || price <= 0) return;
            if (!this._cachedCandles || this._cachedCandles.length === 0) return;
            const last = this._cachedCandles[this._cachedCandles.length - 1];
            const updated = {
                time:  last.time,
                open:  last.open,
                high:  Math.max(last.high, price),
                low:   Math.min(last.low, price),
                close: price,
            };
            if (this.candleSeries) this.candleSeries.update(updated);
            this.lastClosePrice = price;
            const first = this._cachedCandles[0];
            const base  = first ? first.open : price;
            const pct   = base > 0 ? ((price - base) / base) * 100 : 0;
            this._updateHeaderUI(price, pct, cfg);
        }, 5000);
    }

    /* =========================================================
       FALLBACK LOCAL BACKEND API (CORS & NETWORK PROOF)
       ========================================================= */
    async _loadLocalBackendFallback(cfg) {
        try {
            console.log(`[QI Fallback] Mencoba memuat ${cfg.label} dari backend lokal (api/get-chart-data.php)...`);
            const url = `api/get-chart-data.php?symbol=${this.currentSymbol}&interval=${this.currentInterval}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (json.status === 'success' && Array.isArray(json.candles) && json.candles.length > 0) {
                if (json.simulated) json.candles.simulated = true;
                this._renderCandles(json.candles, cfg);
                return true;
            }
        } catch(e) {
            console.warn(`[QI Fallback Local API] gagal: ${e.message}`);
        }
        return false;
    }

    _generateSyntheticCandles(sym, dp = 2) {
        const basePrices = {
            BTCUSDT: 68450.00,
            ETHUSDT: 3520.50,
            SOLUSDT: 184.20,
            BNBUSDT: 585.00,
            XAUUSD: 2654.50,
            EURUSD: 1.0895,
        };
        let currentPrice = basePrices[sym] || 100.00;
        const nowSec = Math.floor(Date.now() / 1000);
        const tfSec = 3600;
        const candles = [];

        for (let i = 250; i >= 0; i--) {
            const time = nowSec - (i * tfSec);
            const changePct = (Math.random() - 0.49) * 0.008;
            const open = currentPrice;
            const close = +(open * (1 + changePct)).toFixed(dp);
            const high = +(Math.max(open, close) * (1 + Math.random() * 0.003)).toFixed(dp);
            const low = +(Math.min(open, close) * (1 - Math.random() * 0.003)).toFixed(dp);
            const volume = Math.floor(Math.random() * 500 + 50);

            candles.push({ time, open, high, low, close, volume });
            currentPrice = close;
        }
        candles.simulated = true; // ditandai agar UI menampilkan badge DATA SIMULASI
        return candles;
    }

    /* =========================================================
       PROVIDER 1: BINANCE
       ========================================================= */
    async _loadBinance(cfg) {
        const sym   = cfg.binanceSym;
        const intvl = QI_INTERVAL_MAP[this.currentInterval]?.binance || '1h';

        // ⚡ PRIORITAS 1: Backend lokal (same-origin + cached di server).
        // Ini paling cepat: server sudah fetch & cache candle, browser cuma
        // baca 1 request lokal. Kalau dapat data NYATA, langsung render + WS.
        try {
            const localUrl = `api/get-chart-data.php?symbol=${this.currentSymbol}&interval=${this.currentInterval}`;
            const res = await fetch(localUrl, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success' && Array.isArray(json.candles) && json.candles.length > 0 && !json.simulated) {
                    this._renderCandles(json.candles, cfg);
                    this._connectBinanceWS(sym, intvl); // live updates
                    return;
                }
                // simpan data simulasi lokal sebagai cadangan terakhir
                var localSimulated = (json.simulated && Array.isArray(json.candles)) ? json.candles : null;
            }
        } catch (e) {
            console.warn('[QI Binance] backend lokal tidak tersedia:', e.message);
        }

        // PRIORITAS 2: Direct ke Binance (paralel, timeout pendek 3 dtk).
        // Promise.any mengambil endpoint TERCEPAT yang berhasil.
        const endpoints = [
            `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${intvl}&limit=300`,
            `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${intvl}&limit=300`,
            `https://api1.binance.com/api/v3/klines?symbol=${sym}&interval=${intvl}&limit=300`
        ];
        let rawData = null;
        try {
            rawData = await Promise.any(endpoints.map(async (url) => {
                const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const json = await res.json();
                if (!Array.isArray(json) || json.length === 0) throw new Error('empty');
                return json;
            }));
        } catch (e) { /* semua endpoint gagal */ }

        if (rawData) {
            const candles = normalizeCandles(rawData, 'binance');
            if (candles.length > 0) {
                this._renderCandles(candles, cfg);
                this._connectBinanceWS(sym, intvl);
                return;
            }
        }

        // PRIORITAS 3: data simulasi lokal (sudah di-fetch di atas) atau generate
        const candles = localSimulated || this._generateSyntheticCandles(sym, cfg.priceDp);
        candles.simulated = true;
        console.warn(`[QI Binance] Semua feed gagal — pakai candle simulasi untuk ${sym}`);
        this._renderCandles(candles, cfg);
        this._connectBinanceWS(sym, intvl);
    }

    /* =========================================================
       PROVIDER: XAUUSD (Binance PAXGUSDT Candles + xaus.com Spot Pulse)
       ========================================================= */
    async _loadXauusd(cfg) {
        const sym   = 'PAXGUSDT';
        const intvl = QI_INTERVAL_MAP[this.currentInterval]?.binance || '1h';
        const endpoints = [
            `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${intvl}&limit=300`,
            `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${intvl}&limit=300`,
        ];

        let rawData = null;
        for (const url of endpoints) {
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json) && json.length > 0) { rawData = json; break; }
                }
            } catch(e) {}
        }

        if (!rawData) {
            const candles = this._generateSyntheticCandles('XAUUSD', cfg.priceDp);
            this._renderCandles(candles, cfg);
        } else {
            const candles = normalizeCandles(rawData, 'binance');
            this._renderCandles(candles, cfg);
        }

        // Realtime updates: PAXG Binance WebSocket + xaus.com Spot Pulse every 5 seconds
        this._connectBinanceWS(sym, intvl);
        this._startXausPoller(cfg);
    }

    /* =========================================================
       XAUS.COM SPOT POLLER — fetch /api/v1/spot setiap 5 detik
       ========================================================= */
    _startXausPoller(cfg) {
        if (this._xausPoller) clearInterval(this._xausPoller);

        const fetchXausSpot = async () => {
            try {
                // Direct fetch with fallback through CORS proxy if blocked
                let data = null;
                try {
                    const res = await fetch('https://xaus.com/api/v1/spot', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
                    if (res.ok) data = await res.json();
                } catch(e) {}

                if (!data || !data.spot_usd_oz) {
                    for (const proxy of QI_CORS_PROXIES) {
                        try {
                            const res = await fetch(`${proxy}${encodeURIComponent('https://xaus.com/api/v1/spot')}`, { signal: AbortSignal.timeout(4000) });
                            if (res.ok) {
                                data = await res.json();
                                if (data?.spot_usd_oz) break;
                            }
                        } catch(e) {}
                    }
                }

                if (data && data.spot_usd_oz) {
                    const spotPrice = +data.spot_usd_oz;
                    if (spotPrice > 0 && this.candleSeries && this._cachedCandles && this._cachedCandles.length > 0) {
                        const last = this._cachedCandles[this._cachedCandles.length - 1];
                        const updatedCandle = {
                            time: last.time,
                            open: last.open,
                            high: Math.max(last.high, spotPrice),
                            low:  Math.min(last.low, spotPrice),
                            close: spotPrice,
                        };
                        this.candleSeries.update(updatedCandle);
                        this.lastClosePrice = spotPrice;

                        // Calculate percentage change from first candle or previous close
                        const firstCandle = this._cachedCandles[0];
                        const basePrice = firstCandle ? firstCandle.open : spotPrice;
                        const pct = basePrice > 0 ? ((spotPrice - basePrice) / basePrice) * 100 : 0;
                        this._updateHeaderUI(spotPrice, pct, cfg);

                        // Update status badge if element exists
                        const badge = document.getElementById('xaus-live-badge');
                        if (badge) {
                            badge.textContent = data.data_state?.status === 'fresh' ? 'LIVE' : 'STALE';
                            badge.className = data.data_state?.status === 'fresh' 
                                ? 'text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold' 
                                : 'text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold';
                        }
                    }
                }
            } catch(e) {
                console.warn('[QI xaus.com Spot Pulse]', e.message);
            }
        };

        // Run immediately then poll every 5 seconds
        fetchXausSpot();
        this._xausPoller = setInterval(fetchXausSpot, 5000);
    }

    /* =========================================================
       PROVIDER 2: YAHOO FINANCE
       ========================================================= */
    async _loadYahoo(cfg) {
        const intvlCfg = QI_INTERVAL_MAP[this.currentInterval] || QI_INTERVAL_MAP['60'];
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cfg.yahooSym}?interval=${intvlCfg.yahoo}&range=${intvlCfg.yahooRange}&includePrePost=false`;

        const attempts = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
            yahooUrl,
        ];

        let candles = null;

        for (let i = 0; i < attempts.length; i++) {
            try {
                const res  = await fetch(attempts[i], { signal: AbortSignal.timeout(7000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const result = json?.chart?.result?.[0];
                if (!result?.timestamp || !result?.indicators?.quote?.[0]) throw new Error('struktur invalid');

                const raw = { timestamps: result.timestamp, ohlcv: result.indicators.quote[0] };
                candles = normalizeCandles(raw, 'yahoo');
                if (candles.length > 0) break;
                candles = null;
            } catch(e) {}
        }

        // Fallback: Binance PAXGUSDT for XAUUSD if Yahoo fails
        if (!candles || candles.length === 0) {
            if (this.currentSymbol === 'XAUUSD') {
                try {
                    const bRes = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=${intvlCfg.binance || '1h'}&limit=300`, { signal: AbortSignal.timeout(5000) });
                    if (bRes.ok) {
                        const json = await bRes.json();
                        if (Array.isArray(json) && json.length > 0) {
                            candles = normalizeCandles(json, 'binance');
                        }
                    }
                } catch(e) {}
            }
        }

        // Try local PHP API fallback
        if (!candles || candles.length === 0) {
            const localSuccess = await this._loadLocalBackendFallback(cfg);
            if (localSuccess) {
                this._startYahooPoller(cfg, intvlCfg.yahoo);
                return;
            }
        }

        // Bulletproof Synthetic Candle Fallback
        if (!candles || candles.length === 0) {
            console.warn(`[QI Yahoo] All Yahoo proxies failed — using synthetic candles for ${this.currentSymbol}`);
            candles = this._generateSyntheticCandles(this.currentSymbol, cfg.priceDp);
        }

        this._renderCandles(candles, cfg);
        this._startYahooPoller(cfg, intvlCfg.yahoo);
    }

    /* =========================================================
       PROVIDER 3: BIQUOTE MT5 FEED (XAUUSD, EURUSD, FOREX, INDEX)
       ========================================================= */
    async _loadBiquote(cfg) {
        const intvlCfg = QI_INTERVAL_MAP[this.currentInterval] || QI_INTERVAL_MAP['60'];
        const biquoteInterval = intvlCfg.biquote || '1h';
        const sym = cfg.biquoteSym || this.currentSymbol;

        let candles = null;

        // 1. Ambil data historis OHLC dari REST API Biquote
        try {
            const url = `https://biquote.io/api/${sym}/ohlc?interval=${biquoteInterval}&limit=250`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const json = await res.json();
                if (json && (json.bars || Array.isArray(json))) {
                    candles = normalizeCandles(json, 'biquote');
                }
            }
        } catch (e) {
            console.warn(`[QI Biquote] Fetch OHLC gagal untuk ${sym}:`, e.message);
        }

        // 2. Fallback: Binance PAXGUSDT untuk Emas jika Biquote lambat/gagal
        if ((!candles || candles.length === 0) && this.currentSymbol === 'XAUUSD') {
            try {
                console.log('[QI Fallback] Menggunakan Binance PAXGUSDT sebagai fallback untuk XAUUSD...');
                const bRes = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=${intvlCfg.binance || '1h'}&limit=250`, { signal: AbortSignal.timeout(5000) });
                if (bRes.ok) {
                    const json = await bRes.json();
                    if (Array.isArray(json) && json.length > 0) {
                        candles = normalizeCandles(json, 'binance');
                    }
                }
            } catch (e) {}
        }

        // 3. Fallback: Local Backend PHP Proxy
        if (!candles || candles.length === 0) {
            const localSuccess = await this._loadLocalBackendFallback(cfg);
            if (localSuccess) {
                this._connectBiquoteSignalR(sym, cfg);
                return;
            }
        }

        // 4. Fallback Terakhir: Synthetic fail-safe
        if (!candles || candles.length === 0) {
            console.warn(`[QI Biquote] Seluruh endpoint gagal — beralih ke synthetic candles untuk ${this.currentSymbol}`);
            candles = this._generateSyntheticCandles(this.currentSymbol, cfg.priceDp);
        }

        this._renderCandles(candles, cfg);

        // Koneksikan Realtime SignalR Hub Biquote atau polling pulse
        this._connectBiquoteSignalR(sym, cfg);
    }

    /* =========================================================
       BIQUOTE SIGNALR HUB REALTIME CONNECTION
       Hub URL: https://biquote.io/hubs/tick
       ========================================================= */
    async _connectBiquoteSignalR(sym, cfg) {
        this._stopBiquoteSignalR();

        // Cek ketersediaan SignalR di window (browser)
        if (typeof signalR !== 'undefined' && signalR.HubConnectionBuilder) {
            try {
                this._biquoteHub = new signalR.HubConnectionBuilder()
                    .withUrl('https://biquote.io/hubs/tick')
                    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Exponential backoff max 30s
                    .configureLogging(signalR.LogLevel.None)
                    .build();

                this._biquoteHub.on('ReceiveTick', (tick) => {
                    if (!tick || tick.symbol !== sym) return;
                    
                    const price = tick.mid || tick.bid || tick.ask;
                    if (!price || price <= 0) return;

                    // Update candle aktif di chart
                    if (this.candleSeries && this._cachedCandles && this._cachedCandles.length > 0) {
                        const last = this._cachedCandles[this._cachedCandles.length - 1];
                        const updated = {
                            time:  last.time,
                            open:  last.open,
                            high:  Math.max(last.high, price),
                            low:   Math.min(last.low, price),
                            close: price,
                        };
                        this.candleSeries.update(updated);
                        this.lastClosePrice = price;

                        const basePrice = this._cachedCandles[0]?.open || price;
                        const pct = ((price - basePrice) / basePrice) * 100;
                        this._updateHeaderUI(price, pct, cfg);
                    }
                });

                await this._biquoteHub.start();
                await this._biquoteHub.invoke('Subscribe', sym);
                console.log(`[QI Biquote SignalR] Terhubung & Subscribe ke ${sym}`);
                return;
            } catch (err) {
                console.warn('[QI Biquote SignalR] Koneksi SignalR gagal, beralih ke REST pulse:', err.message);
            }
        }

        // Fallback jika SignalR tidak aktif: Polling REST Biquote setiap 3 detik
        this._startBiquoteRestPoller(sym, cfg);
    }

    _startBiquoteRestPoller(sym, cfg) {
        this._biquotePoller = setInterval(async () => {
            try {
                const res = await fetch(`https://biquote.io/api/${sym}`, { signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                    const tick = await res.json();
                    const price = tick.mid || tick.bid || tick.ask;
                    if (price > 0 && this.candleSeries && this._cachedCandles && this._cachedCandles.length > 0) {
                        const last = this._cachedCandles[this._cachedCandles.length - 1];
                        const updated = {
                            time:  last.time,
                            open:  last.open,
                            high:  Math.max(last.high, price),
                            low:   Math.min(last.low, price),
                            close: price,
                        };
                        this.candleSeries.update(updated);
                        this.lastClosePrice = price;

                        const basePrice = this._cachedCandles[0]?.open || price;
                        const pct = ((price - basePrice) / basePrice) * 100;
                        this._updateHeaderUI(price, pct, cfg);
                    }
                }
            } catch (e) {}
        }, 3000);
    }

    _stopBiquoteSignalR() {
        if (this._biquoteHub) {
            try { this._biquoteHub.stop(); } catch (e) {}
            this._biquoteHub = null;
        }
        if (this._biquotePoller) {
            clearInterval(this._biquotePoller);
            this._biquotePoller = null;
        }
    }


    /* =========================================================
       RENDER CANDLES — satu fungsi untuk semua provider
       ========================================================= */
    _toggleSimulatedBadge(show) {
        const wrap = document.getElementById('chartEngineWrapper');
        if (!wrap) return;
        let badge = document.getElementById('qiSimulatedBadge');
        if (show && !badge) {
            badge = document.createElement('div');
            badge.id = 'qiSimulatedBadge';
            badge.setAttribute('role', 'status');
            badge.title = 'Semua feed data gagal dimuat. Candle ini acak, jangan dipakai untuk keputusan trading.';
            badge.textContent = '⚠ DATA SIMULASI — bukan harga pasar';
            badge.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:20;padding:4px 10px;border-radius:6px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.6);color:#FBBF24;font:600 11px/1.4 monospace;pointer-events:none;';
            wrap.appendChild(badge);
        } else if (!show && badge) {
            badge.remove();
        }
    }

    _renderCandles(candles, cfg) {
        const closes  = candles.map(c => c.close);
        const volumes = candles.map(c => ({
            time:  c.time,
            value: c.volume || 0,
            color: c.close >= c.open ? 'rgba(0,255,163,0.35)' : 'rgba(255,77,109,0.35)',
        }));

        const ema20 = _calcEMA(closes, Math.min(20, Math.floor(candles.length * 0.1)));
        const emaData = candles
            .map((c, i) => ({ time:c.time, value:ema20[i] }))
            .filter(d => d.value !== null);

        const displayCandles = this.candleType === 'heikinashi' ? _toHeikinAshi(candles) : candles;
        if (this.candleSeries) this.candleSeries.setData(displayCandles);
        if (this.volumeSeries) this.volumeSeries.setData(volumes);
        if (this.emaSeries)    this.emaSeries.setData(emaData);
        this.chart.timeScale().fitContent();
        this._clearOverlay();

        const last = candles[candles.length - 1];
        this.lastClosePrice = last.close;
        this._cachedCandles = candles;   // simpan untuk engine redraw
        window._signalNeedsRecalc = true; // trigger sekali saat data pertama dimuat
        this._toggleSimulatedBadge(!!candles.simulated);

        this._updateHeaderUI(last.close, null, cfg);

        // Gambar engine overlay otomatis
        if (this.overlay) this.overlay.drawEngine(this.currentEngine, candles);
    }

    /* =========================================================
       YAHOO POLLING — update setiap 30 detik
       ========================================================= */
    _startYahooPoller(cfg, interval) {
        this._stopYahooPoller();
        this._yahooPoller = setInterval(async () => {
            const quickUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cfg.yahooSym}?interval=${interval}&range=1d&includePrePost=false`;
            const proxied  = `https://api.allorigins.win/raw?url=${encodeURIComponent(quickUrl)}`;
            try {
                const res    = await fetch(proxied, { signal: AbortSignal.timeout(8000) });
                const json   = await res.json();
                const result = json?.chart?.result?.[0];
                if (!result) return;
                const ohlcv  = result.indicators?.quote?.[0];
                const stamps = result.timestamp;
                if (!ohlcv || !stamps || stamps.length === 0) return;
                const idx   = stamps.length - 1;
                const c     = ohlcv.close[idx], o = ohlcv.open[idx];
                const h     = ohlcv.high[idx],  l = ohlcv.low[idx];
                if (!c || isNaN(c)) return;
                const candle = {
                    time: stamps[idx],
                    open: o||c, high: Math.max(h||c, o||c, c),
                    low:  Math.min(l||c, o||c, c), close: c,
                };
                if (candle.high >= candle.low && candle.close > 0) {
                    if (this.candleSeries) this.candleSeries.update(candle);
                    this.lastClosePrice = c;
                    this._updateHeaderUI(c, o>0 ? ((c-o)/o)*100 : null, cfg);
                }
            } catch(e) {}
        }, 30000);
    }

    _stopYahooPoller() {
        if (this._yahooPoller) { clearInterval(this._yahooPoller); this._yahooPoller = null; }
        if (this._xausPoller)  { clearInterval(this._xausPoller);  this._xausPoller = null;  }
    }

    /* =========================================================
       BINANCE WEBSOCKET dengan exponential backoff
       ========================================================= */
    _connectBinanceWS(bSym, bIntvl) {
        const sym = bSym.toLowerCase();

        // Stream from Binance Vision (unblocked globally) with Binance primary fallback
        const klineWsUrls = [
            `wss://stream.binance.vision/ws/${sym}@kline_${bIntvl}`,
            `wss://stream.binance.com:9443/ws/${sym}@kline_${bIntvl}`
        ];

        let kIndex = 0;
        const tryKlineWs = () => {
            if (kIndex >= klineWsUrls.length) return;
            try {
                this.wsKline = new WebSocket(klineWsUrls[kIndex]);
                this.wsKline.onopen = () => { this.wsRetryDelay = 3000; };
                this.wsKline.onmessage = (evt) => {
                    const msg = JSON.parse(evt.data);
                    if (!msg?.k) return;
                    const k = msg.k;
                    const candle = {
                        time: Math.floor(k.t/1000),
                        open: +k.o, high: +k.h, low: +k.l, close: +k.c,
                    };
                    if (candle.high >= candle.low && candle.close > 0) {
                        if (this.candleSeries) this.candleSeries.update(candle);
                        if (this.volumeSeries) this.volumeSeries.update({
                            time: candle.time, value: +k.v,
                            color: candle.close>=candle.open ? 'rgba(0,255,163,0.45)' : 'rgba(255,77,109,0.45)',
                        });
                        this.lastClosePrice = candle.close;
                    }
                };
                this.wsKline.onerror = () => {
                    kIndex++;
                    tryKlineWs();
                };
            } catch(e) {}
        };
        tryKlineWs();

        const tickerWsUrls = [
            `wss://stream.binance.vision/ws/${sym}@miniTicker`,
            `wss://stream.binance.com:9443/ws/${sym}@miniTicker`
        ];
        let tIndex = 0;
        const tryTickerWs = () => {
            if (tIndex >= tickerWsUrls.length) return;
            try {
                this.wsTicker = new WebSocket(tickerWsUrls[tIndex]);
                this.wsTicker.onmessage = (evt) => {
                    const d   = JSON.parse(evt.data);
                    const cfg = QI_SYMBOL_CONFIG[this.currentSymbol];
                    if (!d?.c) return;
                    const price = +d.c, open24 = +d.o;
                    const pct   = open24 > 0 ? ((price-open24)/open24)*100 : 0;
                    this._updateHeaderUI(price, pct, cfg);
                };
                this.wsTicker.onerror = () => {
                    tIndex++;
                    tryTickerWs();
                };
            } catch(e) {}
        };
        tryTickerWs();
    }

    _closeWebSockets() {
        clearTimeout(this.wsRetryTimer);
        const safe = (ws) => { if (!ws) return; ws.onclose=null; try{ws.close();}catch(e){} };
        safe(this.wsKline); safe(this.wsTicker);
        this.wsKline = null; this.wsTicker = null;
    }

    /* =========================================================
       UPDATE HEADER
       ========================================================= */
    _updateHeaderUI(price, changePct, cfg) {
        if (!price || isNaN(price)) return;
        const dp  = cfg?.priceDp ?? 2;
        const str = price.toLocaleString('en-US', { minimumFractionDigits:dp, maximumFractionDigits:dp });

        const el = id => document.getElementById(id);
        if (el('topLivePrice')) {
            el('topLivePrice').textContent = str;
            el('topLivePrice').className   = (!changePct||changePct>=0)
                ? 'font-bold text-emerald-400 text-sm' : 'font-bold text-rose-400 text-sm';
        }
        if (el('chartLabelPrice'))  el('chartLabelPrice').textContent  = str;
        if (el('chartLabelSymbol') && cfg) el('chartLabelSymbol').textContent = cfg.label;
        if (el('topPriceChange') && changePct !== null && changePct !== undefined) {
            const s = changePct>=0?'+':'';
            el('topPriceChange').textContent = `${s}${changePct.toFixed(2)}%`;
            el('topPriceChange').className   = changePct>=0
                ? 'text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold'
                : 'text-[11px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-bold';
        }
        // SL/TP locked — only recalc when engine/symbol changes, not on every tick
        if (typeof recalculateQuantumEngineLevels === 'function' && window._signalNeedsRecalc) {
            window._signalNeedsRecalc = false;
            recalculateQuantumEngineLevels(price);
        }
    }

    /* =========================================================
       OVERLAY HELPER
       ========================================================= */
    _showStatus(msg) { this._setOverlay(msg, '#94A3B8'); }
    _showError(msg)  { console.error('[QI]', msg); this._setOverlay(`⚠ ${msg}`, '#FF4D6D'); }
    _setOverlay(msg, color) {
        const c = document.getElementById(this.containerId);
        if (!c) return;
        let el = c.querySelector('.qi-overlay');
        if (!el) {
            el = document.createElement('div');
            el.className  = 'qi-overlay';
            el.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;font-size:12px;pointer-events:none;z-index:5;padding:16px;text-align:center;';
            c.style.position = 'relative';
            c.appendChild(el);
        }
        el.style.color  = color;
        el.textContent  = msg;
        if (color === '#94A3B8') setTimeout(() => el.remove(), 8000);
    }
    _clearOverlay() {
        document.getElementById(this.containerId)?.querySelector('.qi-overlay')?.remove();
    }

    /* =========================================================
       PUBLIC API — Ganti Simbol
       ========================================================= */
    setSymbol(symbol) {
        this.currentSymbol = symbol;
        Object.keys(QI_SYMBOL_CONFIG).forEach(s => {
            const btn = document.getElementById(`pair-${s}`);
            if (btn) btn.className = 'min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all border border-transparent flex items-center';
        });
        const ab = document.getElementById(`pair-${symbol}`);
        if (ab) ab.className = 'min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-lg active-tab font-bold transition-all border flex items-center';
        this._loadDataAndStream();
    }

    /* =========================================================
       PUBLIC API — Ganti Timeframe
       ========================================================= */
    setInterval(tf) {
        this.currentInterval = tf;
        ['1','5','15','30','60','240','D','M1','M5','M15','M30','H1','H4','D1'].forEach(t => {
            const btn = document.getElementById(`tf-${t}`);
            if (btn) btn.className = 'min-h-[44px] px-2 py-1 rounded text-slate-400 hover:text-white flex items-center';
        });
        const ab = document.getElementById(`tf-${tf}`);
        if (ab) ab.className = 'min-h-[44px] px-2 py-1 rounded active-tab font-bold border flex items-center';
        const tfNames = {'1':'M1','5':'M5','15':'M15','30':'M30','60':'H1','240':'H4','D':'D1'};
        const tfL = document.getElementById('tf-active');
        if (tfL) tfL.textContent = tfNames[tf] || tf;
        this._loadDataAndStream();
    }

    /* =========================================================
       PUBLIC API — Ganti Engine (dipanggil dari switchQuantumEngine)
       ========================================================= */
    setEngine(engineCode) {
        this.currentEngine = engineCode;
        if (this.overlay && this._cachedCandles.length > 0) {
            this.overlay.drawEngine(engineCode, this._cachedCandles);
        }
    }

    /* =========================================================
       INTERACTIVE DRAWING TOOLS
       State machine: _drawingTool = null | 'hline' | 'trendline' |
       'rectangle' | 'fibonacci' | 'text'
       ========================================================= */
    _initDrawingSystem() {
        this._drawingTool = null;
        this._drawClicks = [];
        this._drawingSeries = [];
        this._drawingMarkers = [];
        this._chartClickBound = this._handleChartClick.bind(this);
        if (this.chart) this.chart.subscribeClick(this._chartClickBound);
    }

    _setActiveTool(tool) {
        if (this._drawingTool === tool) {
            this._cancelDrawing();
            return;
        }
        this._drawingTool = tool;
        this._drawClicks = [];
        document.querySelectorAll('#toolbar .tool-btn').forEach(b => b.classList.remove('drawing-active'));
        const btnMap = { hline:'btn-hline', trendline:'btn-trendline', rectangle:'btn-rectangle', fibonacci:'btn-fib', text:'btn-text' };
        const btn = document.getElementById(btnMap[tool]);
        if (btn) btn.classList.add('drawing-active');
        const names = { hline:'Horizontal Line', trendline:'Trendline', rectangle:'Rectangle Zone', fibonacci:'Fibonacci', text:'Text Note' };
        const hints = { hline:'Klik chart untuk menempatkan garis', trendline:'Klik 2 titik pada chart', rectangle:'Klik 2 titik (sudut atas-kiri & bawah-kanan)', fibonacci:'Klik titik HIGH lalu LOW', text:'Klik posisi pada chart' };
        if (window.showQuantumToast) window.showQuantumToast(`✏️ ${names[tool]}: ${hints[tool]}`, 'info', 3000);
    }

    _cancelDrawing() {
        this._drawingTool = null;
        this._drawClicks = [];
        document.querySelectorAll('#toolbar .tool-btn').forEach(b => b.classList.remove('drawing-active'));
    }

    _handleChartClick(param) {
        if (!this._drawingTool) return;
        let clickPrice = null;
        let clickTime = param.time;
        const seriesPrice = param.seriesData?.get(this.candleSeries);
        if (seriesPrice) {
            clickPrice = seriesPrice.close ?? seriesPrice.value ?? null;
        }
        if (clickPrice === null && param.point) {
            clickPrice = this.candleSeries.coordinateToPrice(param.point.y);
        }
        if (clickPrice === null || clickPrice <= 0) clickPrice = this.lastClosePrice;
        if (!clickTime && param.point) {
            clickTime = this.chart.timeScale().coordinateToTime(param.point.x);
        }
        if (!clickTime) clickTime = Math.floor(Date.now() / 1000);

        switch (this._drawingTool) {
            case 'hline':
                this._placeHorizontalLine(clickPrice);
                this._cancelDrawing();
                break;
            case 'trendline':
                this._drawClicks.push({ time: clickTime, price: clickPrice });
                if (this._drawClicks.length === 2) {
                    this._placeTrendline(this._drawClicks[0], this._drawClicks[1]);
                    this._cancelDrawing();
                }
                break;
            case 'rectangle':
                this._drawClicks.push({ time: clickTime, price: clickPrice });
                if (this._drawClicks.length === 2) {
                    this._placeRectangle(this._drawClicks[0].price, this._drawClicks[1].price);
                    this._cancelDrawing();
                }
                break;
            case 'fibonacci':
                this._drawClicks.push({ time: clickTime, price: clickPrice });
                if (this._drawClicks.length === 2) {
                    this._placeFibonacci(this._drawClicks[0].price, this._drawClicks[1].price);
                    this._cancelDrawing();
                }
                break;
            case 'text':
                this._placeTextMarker(clickTime, clickPrice);
                this._cancelDrawing();
                break;
        }
    }

    _placeHorizontalLine(price) {
        const dp = QI_SYMBOL_CONFIG[this.currentSymbol]?.priceDp ?? 2;
        this.createdPriceLines.push(this.candleSeries.createPriceLine({
            price, color:'#00E5FF', lineWidth:2,
            lineStyle:LightweightCharts.LineStyle.Solid,
            title:`H-LINE ${price.toFixed(dp)}`, axisLabelVisible:true,
        }));
    }

    _placeTrendline(p1, p2) {
        const s = this.chart.addLineSeries({
            color:'#00E5FF', lineWidth:2, lineStyle:LightweightCharts.LineStyle.Solid,
            priceLineVisible:false, lastValueVisible:false,
            crosshairMarkerVisible:false, pointMarkersVisible:false,
        });
        s.setData([
            { time: p1.time, value: p1.price },
            { time: p2.time, value: p2.price },
        ]);
        this._drawingSeries.push(s);
    }

    _placeRectangle(price1, price2) {
        const top = Math.max(price1, price2);
        const bot = Math.min(price1, price2);
        const dp = QI_SYMBOL_CONFIG[this.currentSymbol]?.priceDp ?? 2;
        this.createdPriceLines.push(
            this.candleSeries.createPriceLine({ price:top, color:'#7C4DFF', lineWidth:2, lineStyle:LightweightCharts.LineStyle.Dashed, title:`ZONE TOP ${top.toFixed(dp)}`, axisLabelVisible:true }),
            this.candleSeries.createPriceLine({ price:bot, color:'#7C4DFF', lineWidth:2, lineStyle:LightweightCharts.LineStyle.Dashed, title:`ZONE BOT ${bot.toFixed(dp)}`, axisLabelVisible:true }),
        );
    }

    _placeFibonacci(highPrice, lowPrice) {
        const top = Math.max(highPrice, lowPrice);
        const bot = Math.min(highPrice, lowPrice);
        const diff = top - bot;
        const dp = QI_SYMBOL_CONFIG[this.currentSymbol]?.priceDp ?? 2;
        const levels = [
            { ratio:0,     label:'FIB 0%',    color:'#FF4D6D' },
            { ratio:0.236, label:'FIB 23.6%', color:'#FF6B6B' },
            { ratio:0.382, label:'FIB 38.2%', color:'#FFAB00' },
            { ratio:0.5,   label:'FIB 50%',   color:'#FFD600' },
            { ratio:0.618, label:'FIB 61.8%', color:'#00FFA3' },
            { ratio:0.786, label:'FIB 78.6%', color:'#00E5FF' },
            { ratio:1,     label:'FIB 100%',  color:'#7C4DFF' },
        ];
        for (const lv of levels) {
            const p = top - diff * lv.ratio;
            this.createdPriceLines.push(this.candleSeries.createPriceLine({
                price:p, color:lv.color, lineWidth:lv.ratio===0.618?2:1,
                lineStyle:LightweightCharts.LineStyle.Dashed,
                title:`${lv.label} (${p.toFixed(dp)})`, axisLabelVisible:true,
            }));
        }
    }

    _placeTextMarker(time, price) {
        const text = prompt('Tulis catatan:');
        if (!text || !text.trim()) return;
        const markers = this.candleSeries.markers() || [];
        markers.push({
            time, position:'aboveBar', color:'#FFD600',
            shape:'arrowDown', text: text.trim(),
        });
        markers.sort((a,b) => a.time - b.time);
        this.candleSeries.setMarkers(markers);
        this._drawingMarkers = markers;
    }

    toggleCrosshair() {
        if (!this.chart) return;
        this._cancelDrawing();
        this.isCrosshairActive = !this.isCrosshairActive;
        this.chart.applyOptions({
            crosshair: { mode: this.isCrosshairActive
                ? LightweightCharts.CrosshairMode.Normal
                : LightweightCharts.CrosshairMode.Magnet }
        });
        document.getElementById('btn-crosshair')?.classList.toggle('active', this.isCrosshairActive);
    }

    zoomIn()  { if(!this.chart)return; this.currentBarSpacing=Math.min(this.currentBarSpacing+2,40); this.chart.timeScale().applyOptions({barSpacing:this.currentBarSpacing}); }
    zoomOut() { if(!this.chart)return; this.currentBarSpacing=Math.max(this.currentBarSpacing-2,2);  this.chart.timeScale().applyOptions({barSpacing:this.currentBarSpacing}); }

    addTrendline()           { this._setActiveTool('trendline'); }
    addRectangleZone()       { this._setActiveTool('rectangle'); }
    addHorizontalLine()      { this._setActiveTool('hline'); }
    addFibonacciRetracement(){ this._setActiveTool('fibonacci'); }
    addTextMarker()          { this._setActiveTool('text'); }

    toggleCandleType() {
        this.candleType = this.candleType === 'heikinashi' ? 'standard' : 'heikinashi';
        const isHA = this.candleType === 'heikinashi';
        const btn = document.getElementById('btn-candle-type');
        if (btn) {
            btn.textContent = isHA ? 'HA' : 'STD';
            btn.title = isHA ? 'Mode Heikin Ashi Aktif' : 'Mode Standard Candles Aktif';
            btn.classList.toggle('active-tab', isHA);
        }
        if (this._cachedCandles && this._cachedCandles.length > 0) {
            const displayCandles = isHA ? _toHeikinAshi(this._cachedCandles) : this._cachedCandles;
            if (this.candleSeries) this.candleSeries.setData(displayCandles);
        }
        if (window.showQuantumToast) {
            window.showQuantumToast(isHA ? '🕯️ Heikin Ashi Mode: AKTIF' : '🕯️ Standard Candles: AKTIF', 'info', 1500);
        }
    }

    toggleMagnetMode() {
        if (!this.chart) return;
        this.isMagnetActive = !this.isMagnetActive;
        this.chart.applyOptions({
            crosshair: {
                mode: this.isMagnetActive
                    ? LightweightCharts.CrosshairMode.Magnet
                    : LightweightCharts.CrosshairMode.Normal
            }
        });
        const btn = document.getElementById('btn-magnet');
        if (btn) btn.classList.toggle('active', this.isMagnetActive);
        if (window.showQuantumToast) {
            window.showQuantumToast(this.isMagnetActive ? '🧲 Magnet Mode: AKTIF' : '🧲 Magnet Mode: NONAKTIF', 'info', 1500);
        }
    }

    clearAllDrawings() {
        if (!this.candleSeries) return;
        this._cancelDrawing();
        this.createdPriceLines.forEach(l=>{ try{this.candleSeries.removePriceLine(l);}catch(e){} });
        this.createdPriceLines = [];
        this._drawingSeries.forEach(s=>{ try{this.chart.removeSeries(s);}catch(e){} });
        this._drawingSeries = [];
        this._drawingMarkers = [];
        try { this.candleSeries.setMarkers([]); } catch(e) {}
        if (this.overlay) this.overlay.clearAll();
        if (window.showQuantumToast) window.showQuantumToast('🗑️ Semua gambar dihapus', 'info', 1500);
    }

    // Backward compat
    updateHeaderPriceUI(price, pct) {
        this._updateHeaderUI(price, pct, QI_SYMBOL_CONFIG[this.currentSymbol]);
    }
}

/* =============================================================
   GLOBAL INSTANCE
   ============================================================= */
let quantumTerminalManager = null;

function initQuantumRealtimeSystem() {
    quantumTerminalManager = new QuantumRealtimeTerminalManager({
        containerId: 'tv_advanced_main',
        symbol:      'BTCUSDT',
        interval:    '60',
        engine:      'SNR',
    });
    quantumTerminalManager.initChart();

    // FITUR 1.4 & COMMAND PALETTE SHORTCUTS ENGINE
    window.addEventListener('keydown', (e) => {
        // Handle Ctrl+K global (bisa dipanggil kapanpun)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (typeof openCommandPalette === 'function') openCommandPalette();
            return;
        }

        // Jangan aktifkan shortcut tunggal jika user sedang mengetik di input / textarea
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (['input', 'textarea', 'select'].includes(activeTag)) return;

        if (!quantumTerminalManager) return;

        const key = e.key.toLowerCase();

        if (e.shiftKey) {
            if (key === 'w') {
                e.preventDefault();
                showQuantumToast('★ Watchlist Favorit (Shift+W)', 'info');
                return;
            }
            if (key === 'a') {
                e.preventDefault();
                showQuantumToast('🔔 Buat Alert Harga (Shift+A)', 'info');
                return;
            }
        }

        switch (key) {
            case '/':
                e.preventDefault();
                if (typeof openCommandPalette === 'function') openCommandPalette();
                break;
            case 'c':
                e.preventDefault();
                quantumTerminalManager.toggleCrosshair();
                showQuantumToast('🎯 Crosshair Mode Toggled', 'info', 1500);
                break;
            case '+': case '=':
                e.preventDefault();
                quantumTerminalManager.zoomIn();
                break;
            case '-': case '_':
                e.preventDefault();
                quantumTerminalManager.zoomOut();
                break;
            case 't':
                e.preventDefault();
                quantumTerminalManager.addTrendline();
                break;
            case 'r':
                e.preventDefault();
                quantumTerminalManager.addRectangleZone();
                break;
            case 'h':
                e.preventDefault();
                quantumTerminalManager.addHorizontalLine();
                break;
            case 'f':
                e.preventDefault();
                quantumTerminalManager.addFibonacciRetracement();
                break;
            case '1':
                e.preventDefault();
                quantumTerminalManager.setInterval('5');
                showQuantumToast('TF Diubah ke M5', 'info', 1500);
                break;
            case '2':
                e.preventDefault();
                quantumTerminalManager.setInterval('15');
                showQuantumToast('TF Diubah ke M15', 'info', 1500);
                break;
            case '3':
                e.preventDefault();
                quantumTerminalManager.setInterval('60');
                showQuantumToast('TF Diubah ke H1', 'info', 1500);
                break;
            case '4':
                e.preventDefault();
                quantumTerminalManager.setInterval('240');
                showQuantumToast('TF Diubah ke H4', 'info', 1500);
                break;
            case '5':
                e.preventDefault();
                quantumTerminalManager.setInterval('D');
                showQuantumToast('TF Diubah ke D1', 'info', 1500);
                break;
            case 'escape':
                e.preventDefault();
                if (quantumTerminalManager._drawingTool) {
                    quantumTerminalManager._cancelDrawing();
                    showQuantumToast('Drawing dibatalkan', 'info', 1500);
                } else {
                    if (typeof closeCommandPalette === 'function') closeCommandPalette();
                    quantumTerminalManager.clearAllDrawings();
                    showQuantumToast('🗑 Gambar & Overlay Dibersihkan', 'warning', 2000);
                }
                break;
        }
    });
}
