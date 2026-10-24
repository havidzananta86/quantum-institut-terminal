/* Quantum Terminal shell tools.
 * Signal is calculated from the last closed candle only, so the panel never
 * presents a moving candle as a confirmed setup. TP/SL uses ATR(14) and a
 * fixed 1:2 risk/reward target; it is a transparent analysis aid, not advice.
 */
(function () {
    'use strict';

    const frame = document.getElementById('quantumTerminalFrame');
    const drawer = document.getElementById('qtAssistDrawer');
    if (!frame || !drawer) return;

    const $ = id => document.getElementById(id);
    const historyKey = 'qt_signal_history_v1';
    const workspaceKey = 'qt_workspace_v2:' + getWorkspaceScope();
    const intervalMap = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' };
    const timeframeSeconds = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
    const mtfMap = { '1m': ['5m', '15m'], '5m': ['15m', '1h'], '15m': ['1h', '4h'], '30m': ['4h', '1d'], '1h': ['4h', '1d'], '4h': ['1d'], '1d': [] };
    const signalEngineVersion = 'qt-signal-v2.3';
    const mt5Candidates = {
        XAUUSD: ['XAUUSD', 'GOLD', 'XAUUSDm'], XAGUSD: ['XAGUSD', 'SILVER', 'XAGUSDm'],
        EURUSD: ['EURUSD', 'EURUSDm'], GBPUSD: ['GBPUSD', 'GBPUSDm'], USDJPY: ['USDJPY', 'USDJPYm'],
        AUDUSD: ['AUDUSD', 'AUDUSDm'], NZDUSD: ['NZDUSD', 'NZDUSDm'], USDCHF: ['USDCHF', 'USDCHFm'],
        USDCAD: ['USDCAD', 'USDCADm'], EURGBP: ['EURGBP', 'EURGBPm'], EURJPY: ['EURJPY', 'EURJPYm'],
        GBPJPY: ['GBPJPY', 'GBPJPYm'], AUDJPY: ['AUDJPY', 'AUDJPYm'], USDTRY: ['USDTRY', 'USDTRYm'],
        BTCUSDT: ['BTCUSD', 'BTCUSDT'], ETHUSDT: ['ETHUSD', 'ETHUSDT'], SOLUSDT: ['SOLUSD', 'SOLUSDT'],
        BNBUSDT: ['BNBUSD', 'BNBUSDT'], XRPUSDT: ['XRPUSD', 'XRPUSDT'], DOGEUSDT: ['DOGEUSD', 'DOGEUSDT']
    };
    const chartPalettes = {
        quantum: {
            'series.candlestick.upColor': '#2dd4bf', 'series.candlestick.downColor': '#fb7185',
            'series.candlestick.wickUpColor': '#2dd4bf', 'series.candlestick.wickDownColor': '#fb7185',
            'grid.horizontal.color': '#172331', 'grid.vertical.color': '#14202d'
        },
        classic: {
            'series.candlestick.upColor': '#26a69a', 'series.candlestick.downColor': '#ef5350',
            'series.candlestick.wickUpColor': '#26a69a', 'series.candlestick.wickDownColor': '#ef5350',
            'grid.horizontal.color': '#1b2028', 'grid.vertical.color': '#171c23'
        },
        contrast: {
            'series.candlestick.upColor': '#00d7ff', 'series.candlestick.downColor': '#ff4d6d',
            'series.candlestick.wickUpColor': '#00d7ff', 'series.candlestick.wickDownColor': '#ff4d6d',
            'grid.horizontal.color': '#283344', 'grid.vertical.color': '#222c3b'
        }
    };
    const labels = {
        XAUUSD: 'XAU/USD', XAGUSD: 'XAG/USD', EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY',
        AUDUSD: 'AUD/USD', NZDUSD: 'NZD/USD', USDCHF: 'USD/CHF', USDCAD: 'USD/CAD', EURGBP: 'EUR/GBP',
        EURJPY: 'EUR/JPY', GBPJPY: 'GBP/JPY', AUDJPY: 'AUD/JPY', USDTRY: 'USD/TRY',
        BTCUSDT: 'BTC/USDT', ETHUSDT: 'ETH/USDT', SOLUSDT: 'SOL/USDT', BNBUSDT: 'BNB/USDT',
        XRPUSDT: 'XRP/USDT', DOGEUSDT: 'DOGE/USDT'
    };
    const allowedTabs = ['signal', 'indicators', 'history', 'backtest'];
    const savedWorkspace = readWorkspace();
    const state = {
        symbol: normalizeSymbol(savedWorkspace && savedWorkspace.symbol) || 'XAUUSD',
        timeframe: savedWorkspace && intervalMap[savedWorkspace.timeframe] ? savedWorkspace.timeframe : '5m',
        candles: [], lastResult: null, lastFetch: 0,
        indicators: {
            ema: !savedWorkspace || !savedWorkspace.indicators ? true : savedWorkspace.indicators.ema !== false,
            rsi: !savedWorkspace || !savedWorkspace.indicators ? true : savedWorkspace.indicators.rsi !== false,
            macd: !savedWorkspace || !savedWorkspace.indicators ? true : savedWorkspace.indicators.macd !== false
        },
        history: readHistory(),
        overlay: savedWorkspace && typeof savedWorkspace.overlay === 'boolean' ? savedWorkspace.overlay : readOverlayPreference(),
        mtfEnabled: !savedWorkspace || savedWorkspace.mtfEnabled !== false,
        crosshairMode: savedWorkspace && savedWorkspace.crosshairMode === 'normal' ? 'normal' : 'magnet',
        palette: savedWorkspace && chartPalettes[savedWorkspace.palette] ? savedWorkspace.palette : 'quantum',
        activeTab: savedWorkspace && allowedTabs.includes(savedWorkspace.activeTab) ? savedWorkspace.activeTab : 'signal',
        pairLoading: false,
        pairLoadingToken: 0,
        refreshPromise: null,
        activeSignalKey: null,
        feed: { status: 'idle', source: null, ageSeconds: null }
    };

    function getWorkspaceScope() {
        try {
            const user = window.QuantumAuth && window.QuantumAuth.getUserData ? window.QuantumAuth.getUserData() : null;
            const identity = user && (user.id || user.email || user.username);
            return encodeURIComponent(String(identity || 'local-user').toLowerCase().slice(0, 120));
        } catch (e) { return 'local-user'; }
    }

    function readWorkspace() {
        try {
            const raw = localStorage.getItem('qt_workspace_v2:' + getWorkspaceScope());
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) { return null; }
    }

    function normalizeSymbol(value) {
        const raw = String(value || '').trim().toUpperCase();
        if (!raw) return null;
        const compact = raw.replace(/[^A-Z0-9]/g, '');
        if (Object.prototype.hasOwnProperty.call(labels, compact)) return compact;
        if (compact === 'GOLD') return 'XAUUSD';
        if (compact === 'SILVER') return 'XAGUSD';
        const known = Object.keys(labels).find(symbol => compact.indexOf(symbol) === 0);
        return known || null;
    }

    function saveWorkspace(status) {
        try {
            localStorage.setItem(workspaceKey, JSON.stringify({
                version: 2, symbol: state.symbol, timeframe: state.timeframe,
                indicators: { ...state.indicators }, mtfEnabled: state.mtfEnabled,
                overlay: state.overlay, crosshairMode: state.crosshairMode, palette: state.palette,
                activeTab: state.activeTab, savedAt: Date.now()
            }));
        } catch (e) {}
        renderWorkspaceStatus(status || 'Tersimpan otomatis');
    }

    function renderWorkspaceStatus(status) {
        const element = $('qtWorkspaceStatus');
        if (!element) return;
        element.textContent = status || 'Disimpan otomatis di perangkat ini';
    }

    function readOverlayPreference() {
        try { return localStorage.getItem('qt_signal_overlay') !== 'off'; } catch (e) { return true; }
    }

    function postChartOverlay(result) {
        if (!frame.contentWindow) return;
        const payload = {
            enabled: Boolean(state.overlay && result && result.side !== 'WAIT'),
            symbol: state.symbol,
            timeframe: state.timeframe,
            signal: result && result.side !== 'WAIT' ? {
                id: 'qt-signal-' + state.symbol + '-' + state.timeframe,
                side: result.side,
                time: result.candleTime,
                price: result.current,
                entry: result.entry,
                stopLoss: result.sl,
                takeProfit: result.tp,
                confidence: Number(result.confidence || 0) / 100,
                reason: result.reason,
                source: result.source || 'Quantum Terminal',
                provisional: result.provisional && result.provisional.side !== 'WAIT' ? {
                    side: result.provisional.side,
                    time: result.provisional.candleTime,
                    price: result.provisional.current,
                    reason: result.provisional.reason
                } : null
            } : null
        };
        try { frame.contentWindow.postMessage({ type: 'qt-signal-overlay', payload }, window.location.origin); } catch (e) {}
    }

    function readHistory() {
        try {
            const value = JSON.parse(localStorage.getItem(historyKey) || '[]');
            return Array.isArray(value) ? value.slice(0, 30) : [];
        } catch (e) { return []; }
    }

    function saveHistory() {
        try { localStorage.setItem(historyKey, JSON.stringify(state.history.slice(0, 30))); } catch (e) {}
    }

    function frameContext() {
        try {
            const url = new URL(frame.contentWindow.location.href);
            return {
                symbol: (url.searchParams.get('symbol') || state.symbol).toUpperCase(),
                timeframe: url.searchParams.get('timeframe') || state.timeframe
            };
        } catch (e) {
            const url = new URL(frame.getAttribute('src'), window.location.href);
            return { symbol: (url.searchParams.get('symbol') || state.symbol).toUpperCase(), timeframe: url.searchParams.get('timeframe') || state.timeframe };
        }
    }

    function decimals(symbol, value) {
        if (symbol === 'XAUUSD' || symbol === 'XAGUSD') return 3;
        if (symbol.includes('JPY')) return 4;
        if (Math.abs(value) < 1) return 5;
        if (Math.abs(value) < 10) return 4;
        return 2;
    }

    function price(value, symbol) {
        if (!Number.isFinite(value)) return '—';
        const d = decimals(symbol, value);
        return Number(value).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
    }

    function timeText(value) {
        if (!value) return '—';
        const date = new Date(Number(value) * 1000);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function delay(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    function formatAge(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '—';
        if (seconds < 60) return Math.max(1, Math.round(seconds)) + ' dtk';
        if (seconds < 3600) return Math.round(seconds / 60) + ' mnt';
        if (seconds < 86400) return Math.round(seconds / 3600) + ' jam';
        return Math.round(seconds / 86400) + ' hari';
    }

    function isCryptoSymbol(symbol) {
        return /USDT$/.test(String(symbol || '').toUpperCase());
    }

    function isForexMarketClosed() {
        const now = new Date();
        const day = now.getUTCDay();
        const hour = now.getUTCHours();
        // Approximate institutional FX session: opens Sunday 22:00 UTC and
        // closes Friday 22:00 UTC. DST can shift broker hours; MT5 feed age
        // remains the final authority when the bridge is connected.
        return day === 6 || (day === 5 && hour >= 22) || (day === 0 && hour < 22);
    }

    function freshnessCheck(symbol, timeframe, candles) {
        const latest = candles.reduce((max, candle) => Math.max(max, Number(candle.time) || 0), 0);
        const ageSeconds = latest > 0 ? Math.max(0, Date.now() / 1000 - latest) : Infinity;
        const step = timeframeSeconds[timeframe] || 300;
        const marketClosed = !isCryptoSymbol(symbol) && isForexMarketClosed();
        const allowedAge = marketClosed ? Math.max(step * 8, 3 * 86400) : Math.max(step * 8, 15 * 60);
        return { ok: Number.isFinite(ageSeconds) && ageSeconds <= allowedAge, ageSeconds, latest, marketClosed, allowedAge };
    }

    // Asal candle ditulis apa adanya. Feed broker MT5 milik QI diberi label "BROKER QI", bukan "MT5" polos:
    // pengguna harus tahu ini harga broker KAMI — spread, swap, dan harga pastinya bisa berbeda beberapa poin
    // dari akun mereka sendiri. Data simulasi tidak boleh terlihat seperti harga pasar.
    const SOURCE_LABELS = {
        oanda_tv: 'OANDA', binance: 'BINANCE', binance_ws: 'BINANCE · STREAM', binance_paxg: 'BINANCE·PAXG (proksi)',
        mt5: 'MT5 · BROKER QI', mt5_tick: 'MT5 TICK · BROKER QI',
        twelvedata: 'TWELVEDATA', biquote: 'BIQUOTE', candle_m1: 'BIQUOTE M1', candle_h1: 'BIQUOTE H1',
        simulasi: 'DATA SIMULASI', unknown: 'SUMBER ?'
    };
    const SOURCE_NOTES = {
        mt5: 'Candle dari terminal MetaTrader 5 milik Quantum Institut. Harga broker Anda sendiri bisa berbeda beberapa poin — gunakan ini sebagai acuan struktur, bukan harga eksekusi Anda.',
        mt5_tick: 'Harga tick langsung dari terminal MetaTrader 5 milik Quantum Institut. Harga broker Anda sendiri bisa berbeda beberapa poin.',
        simulasi: 'Data CONTOH, bukan harga pasar sebenarnya. Jangan dipakai untuk mengambil keputusan.',
        binance_paxg: 'Proksi: harga PAXG di Binance dipakai sebagai pendekatan emas, bukan XAUUSD broker.',
        unknown: 'Sumber data candle tidak dikenali.'
    };
    function sourceLabel(source) { return SOURCE_LABELS[source] || source || 'Chart feed'; }
    function sourceNote(source) { return SOURCE_NOTES[source] || 'Sumber data candle'; }

    function renderFeedStatus(status, source, ageSeconds, detail, marketClosed) {
        const footer = $('qtAssistFooterStatus');
        const text = $('qtAssistFooterText');
        if (!footer || !text) return;
        footer.classList.remove('live', 'is-loading', 'is-stale', 'is-error');
        if (status === 'live' && marketClosed) {
            // Data diterima tetapi pasarnya tutup: JANGAN berlabel "Live" hijau untuk harga yang berjam-jam usianya.
            footer.classList.add('is-stale');
            text.textContent = 'Pasar tutup · ' + sourceLabel(source) + (Number.isFinite(ageSeconds) ? ' · data terakhir ' + formatAge(ageSeconds) + ' lalu' : '');
        } else if (status === 'live') {
            footer.classList.add('live');
            text.textContent = 'Live · ' + sourceLabel(source) + (Number.isFinite(ageSeconds) ? ' · ' + formatAge(ageSeconds) + ' lalu' : '');
        } else if (status === 'loading' || status === 'retrying') {
            footer.classList.add('is-loading');
            text.textContent = detail || 'Menghubungkan feed…';
        } else if (status === 'stale') {
            footer.classList.add('is-stale');
            text.textContent = 'Stale · ' + (source || 'feed') + (Number.isFinite(ageSeconds) ? ' · ' + formatAge(ageSeconds) + ' lalu' : '');
        } else if (status === 'error') {
            footer.classList.add('is-error');
            text.textContent = detail || 'Feed tidak tersedia';
        } else {
            text.textContent = detail || 'Menunggu feed';
        }
        state.feed = { status, source: source || null, ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : null, marketClosed: !!marketClosed };
    }

    function renderSymbolMapping() {
        const canonical = normalizeSymbol(state.symbol) || state.symbol;
        const candidates = mt5Candidates[canonical] || [canonical];
        $('qtCanonicalSymbol').textContent = canonical;
        $('qtMt5Symbols').textContent = candidates.slice(0, 3).join(' · ');
    }

    function ema(values, period) {
        if (!Array.isArray(values) || values.length < period) return null;
        const k = 2 / (period + 1);
        let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
        for (let i = period; i < values.length; i++) result = values[i] * k + result * (1 - k);
        return result;
    }

    function emaSeries(values, period) {
        const out = new Array(values.length).fill(null);
        if (values.length < period) return out;
        const k = 2 / (period + 1);
        let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
        out[period - 1] = result;
        for (let i = period; i < values.length; i++) {
            result = values[i] * k + result * (1 - k);
            out[i] = result;
        }
        return out;
    }

    /**
     * RSI Wilder — rumus yang SAMA dengan Mesin 9 (engine-nine.js rsiWilder) dan server (api/_sinyal_pasar.php):
     * riwayat penuh, seed rata-rata sederhana 14 perubahan pertama, bar ber-rentang nol (open=high=low=close — feed
     * kosong di akhir pekan) DIBUANG, deret datar = 50, tanpa kerugian = 100. Menerima deret angka atau candle.
     * Tanpa aturan ini deret datar berbunyi 100 dan dihitung sebagai suara BULL (audit sinyal 2026-10-22).
     */
    function rsi(data, period) {
        if (!Array.isArray(data)) return null;
        const closes = [];
        for (const x of data) {
            if (typeof x === 'number') { if (Number.isFinite(x)) closes.push(x); continue; }
            if (!x) continue;
            const c = Number(x.close);
            if (!Number.isFinite(c)) continue;
            if (Number(x.open) === Number(x.high) && Number(x.high) === Number(x.low) && Number(x.low) === c) continue;
            closes.push(c);
        }
        if (closes.length <= period) return null;
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change; else losses -= change;
        }
        gains /= period; losses /= period;
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            gains = (gains * (period - 1) + (change > 0 ? change : 0)) / period;
            losses = (losses * (period - 1) + (change < 0 ? -change : 0)) / period;
        }
        if (gains === 0 && losses === 0) return 50;
        if (losses === 0) return 100;
        return 100 - 100 / (1 + gains / losses);
    }

    function atr(candles, period) {
        if (!Array.isArray(candles) || candles.length <= period) return null;
        const ranges = [];
        for (let i = 1; i < candles.length; i++) {
            const current = candles[i], previous = candles[i - 1];
            ranges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
        }
        return ranges.slice(-period).reduce((sum, value) => sum + value, 0) / period;
    }

    function volatilityProfile(candles, period) {
        if (!Array.isArray(candles) || candles.length <= period + 4) return { label: 'Belum cukup', ratio: null, atr: null };
        const ranges = [];
        for (let i = 1; i < candles.length; i++) {
            const current = candles[i], previous = candles[i - 1];
            ranges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
        }
        const recent = ranges.slice(-period);
        const baseline = ranges.slice(0, -period);
        const currentAtr = recent.reduce((sum, value) => sum + value, 0) / recent.length;
        const baselineAtr = (baseline.length ? baseline : ranges).reduce((sum, value) => sum + value, 0) / (baseline.length || ranges.length);
        const ratio = baselineAtr > 0 ? currentAtr / baselineAtr : null;
        return {
            label: !Number.isFinite(ratio) ? 'Belum cukup' : ratio >= 1.35 ? 'Tinggi' : ratio <= .75 ? 'Rendah' : 'Normal',
            ratio, atr: currentAtr
        };
    }

    function macdHistogram(values) {
        if (values.length < 40) return null;
        const fast = emaSeries(values, 12), slow = emaSeries(values, 26), line = [];
        for (let i = 0; i < values.length; i++) if (fast[i] !== null && slow[i] !== null) line.push(fast[i] - slow[i]);
        if (line.length < 9) return null;
        const signal = ema(line, 9);
        return signal === null ? null : line[line.length - 1] - signal;
    }

    function analyzeTimeframe(candles) {
        const closes = candles.map(c => Number(c.close));
        const last = candles[candles.length - 1];
        const current = closes[closes.length - 1];
        const ema20 = ema(closes, 20), ema50 = ema(closes, 50), rsiValue = rsi(candles, 14), macd = macdHistogram(closes), atrValue = atr(candles, 14);
        const votes = [], basis = [];
        const addVote = (name, side, reason) => {
            basis.push({ name, side: side || 'WAIT', reason });
            if (side === 'BUY' || side === 'SELL') votes.push({ name, side, reason });
        };

        if (state.indicators.ema) {
            const side = current > ema20 && ema20 > ema50 ? 'BUY' : (current < ema20 && ema20 < ema50 ? 'SELL' : 'WAIT');
            addVote('EMA 20/50', side, side === 'BUY' ? 'Harga di atas EMA20 dan EMA20 di atas EMA50' : side === 'SELL' ? 'Harga di bawah EMA20 dan EMA20 di bawah EMA50' : 'Susunan EMA belum searah');
        }
        if (state.indicators.rsi) {
            const side = rsiValue > 55 ? 'BUY' : (rsiValue < 45 ? 'SELL' : 'WAIT');
            addVote('RSI 14', side, side === 'BUY' ? 'RSI berada di atas zona 55' : side === 'SELL' ? 'RSI berada di bawah zona 45' : 'RSI masih berada di area netral');
        }
        if (state.indicators.macd) {
            const side = macd > 0 ? 'BUY' : (macd < 0 ? 'SELL' : 'WAIT');
            addVote('MACD', side, side === 'BUY' ? 'Histogram MACD positif' : side === 'SELL' ? 'Histogram MACD negatif' : 'Histogram MACD belum memberi arah');
        }

        const bull = votes.filter(v => v.side === 'BUY').length;
        const bear = votes.filter(v => v.side === 'SELL').length;
        const required = votes.length <= 1 ? 1 : Math.ceil(votes.length * .67);
        const side = bull >= required && bull > bear ? 'BUY' : (bear >= required && bear > bull ? 'SELL' : 'WAIT');
        const distance = Number.isFinite(atrValue) && atrValue > 0 ? atrValue * 1.5 : null;
        const hasSetup = side !== 'WAIT' && Number.isFinite(distance);
        const entry = hasSetup ? current : null;
        const sl = hasSetup ? current + (side === 'SELL' ? distance : -distance) : null;
        const tp = hasSetup ? current + (side === 'SELL' ? -distance * 2 : distance * 2) : null;
        const activeReasons = basis.filter(item => item.side === side).map(item => item.reason);
        const reason = side === 'WAIT'
            ? (votes.length ? 'Konfirmasi indikator belum cukup searah. Signal ditahan.' : 'Pilih minimal satu indikator untuk membaca signal.')
            : activeReasons.join(' · ');
        const activeCount = Number(state.indicators.ema) + Number(state.indicators.rsi) + Number(state.indicators.macd);
        const agreement = activeCount ? Math.max(bull, bear) / activeCount : 0;
        const volatility = volatilityProfile(candles, 14);
        const marketSide = current > ema20 && ema20 > ema50 ? 'BUY' : (current < ema20 && ema20 < ema50 ? 'SELL' : 'WAIT');

        return {
            side, current, entry, sl, tp, rr: hasSetup ? 2 : null, atr: atrValue,
            rsi: rsiValue, ema20, ema50, macd, bull, bear, required,
            confidence: votes.length ? Math.min(95, Math.round(Math.max(bull, bear) / votes.length * 100)) : 0,
            reason, basis, candleTime: last.time, source: state.source || 'Chart feed',
            quality: {
                agreement, activeCount, mtfRatio: null, score: side === 'WAIT' ? Math.round(agreement * 60) : Math.round(agreement * 70 + 30),
                volatility: volatility.label, volatilityRatio: volatility.ratio,
                market: marketSide === 'BUY' ? 'Trend naik' : marketSide === 'SELL' ? 'Trend turun' : 'Range / transisi'
            }
        };
    }

    function upperBound(candles, time) {
        let low = 0, high = candles.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (Number(candles[middle].time) <= time) low = middle + 1; else high = middle;
        }
        return low - 1;
    }

    function alignMtfResult(localCandle, higherSets) {
        if (!state.mtfEnabled) return [];
        const localDuration = timeframeSeconds[state.timeframe] || 300;
        const closeBoundary = Number(localCandle.time) + localDuration;
        return higherSets.map(set => {
            const higherDuration = timeframeSeconds[set.timeframe] || 300;
            const index = upperBound(set.closed, closeBoundary - higherDuration);
            return {
                timeframe: set.timeframe,
                result: index >= 55 ? analyzeTimeframe(set.closed.slice(0, index + 1)) : null
            };
        });
    }

    function applyMtfConfirmation(local, contexts) {
        if (!state.mtfEnabled) return { ...local, mtf: { enabled: false, passed: true, contexts: [] }, quality: { ...local.quality, mtfRatio: 1, score: local.side === 'WAIT' ? Math.round(local.quality.agreement * 60) : Math.round(local.quality.agreement * 70 + 30) } };
        if (!contexts.length) return { ...local, mtf: { enabled: true, passed: true, contexts: [], summary: 'Timeframe tertinggi' }, quality: { ...local.quality, mtfRatio: 1 } };

        const status = contexts.map(context => ({
            timeframe: context.timeframe,
            side: context.result ? context.result.side : 'WAIT',
            reason: context.result ? context.result.reason : 'Data historis belum cukup',
            available: Boolean(context.result)
        }));
        const passed = local.side !== 'WAIT' && status.every(item => item.available && item.side === local.side);
        const side = passed ? local.side : 'WAIT';
        const mtfText = status.map(item => item.timeframe.toUpperCase() + ' ' + item.side).join(' · ');
        const reason = local.side === 'WAIT'
            ? local.reason
            : passed
                ? local.reason + ' · MTF terkonfirmasi: ' + mtfText
                : local.side + ' ditahan — konfirmasi MTF belum searah (' + mtfText + ')';
        const basis = local.basis.concat(status.map(item => ({ name: item.timeframe.toUpperCase(), side: item.side, reason: item.reason })));
        const hasSetup = side !== 'WAIT' && Number.isFinite(local.atr) && local.atr > 0;
        const distance = hasSetup ? local.atr * 1.5 : null;
        const mtfRatio = local.side !== 'WAIT' && status.length ? status.filter(item => item.available && item.side === local.side).length / status.length : 0;
        const qualityScore = side === 'WAIT' ? Math.round(local.quality.agreement * 60 + mtfRatio * 20) : Math.round(local.quality.agreement * 70 + mtfRatio * 30);
        return {
            ...local,
            side,
            entry: hasSetup ? local.current : null,
            sl: hasSetup ? local.current + (side === 'SELL' ? distance : -distance) : null,
            tp: hasSetup ? local.current + (side === 'SELL' ? -distance * 2 : distance * 2) : null,
            rr: hasSetup ? 2 : null,
            confidence: passed ? local.confidence : 0,
            reason,
            basis,
            mtf: { enabled: true, passed, contexts: status, summary: mtfText },
            quality: { ...local.quality, mtfRatio, score: qualityScore }
        };
    }

    function renderMtfStatus(result) {
        const container = $('qtMtfStatus');
        container.replaceChildren();
        if (!result.mtf || !result.mtf.enabled) return;
        const label = document.createElement('span'); label.className = 'qt-mtf-label'; label.textContent = 'MTF'; container.appendChild(label);
        if (!result.mtf.contexts.length) {
            const chip = document.createElement('span'); chip.className = 'qt-mtf-chip buy'; chip.textContent = 'timeframe tertinggi'; container.appendChild(chip); return;
        }
        result.mtf.contexts.forEach(item => {
            const chip = document.createElement('span'); chip.className = 'qt-mtf-chip ' + item.side.toLowerCase();
            const strong = document.createElement('strong'); strong.textContent = item.timeframe.toUpperCase();
            chip.append(strong, document.createTextNode(' ' + item.side)); container.appendChild(chip);
        });
        const verdict = document.createElement('span'); verdict.className = 'qt-mtf-chip ' + (result.mtf.passed ? 'buy' : 'wait'); verdict.textContent = result.mtf.passed ? 'CONFIRMED' : 'WAIT'; container.appendChild(verdict);
    }

    function renderQuality(result) {
        const quality = result.quality || {};
        const score = $('qtQualityScore');
        const scoreValue = result.side === 'WAIT' ? null : Math.max(0, Math.min(100, Number(quality.score) || 0));
        score.textContent = scoreValue === null ? 'WAIT' : scoreValue + '/100';
        score.className = scoreValue === null ? 'is-wait' : scoreValue >= 75 ? '' : 'is-low';
        $('qtQualityAgreement').textContent = quality.activeCount ? Math.max(result.bull || 0, result.bear || 0) + '/' + quality.activeCount + ' setuju' : '—';
        const mtfContexts = result.mtf && Array.isArray(result.mtf.contexts) ? result.mtf.contexts : [];
        const mtfMatches = result.side !== 'WAIT' ? mtfContexts.filter(item => item.available && item.side === result.side).length : 0;
        $('qtQualityMtf').textContent = result.mtf && result.mtf.enabled ? (mtfContexts.length ? mtfMatches + '/' + mtfContexts.length + ' searah' : 'tertinggi') : 'nonaktif';
        const volatilityText = quality.volatility || '—';
        $('qtQualityVolatility').textContent = Number.isFinite(quality.volatilityRatio) ? volatilityText + ' · ' + quality.volatilityRatio.toFixed(2) + '×' : volatilityText;
        $('qtQualityMarket').textContent = quality.market || '—';
        $('qtQualityMarket').className = result.side === 'BUY' ? 'buy' : result.side === 'SELL' ? 'sell' : 'wait';
        $('qtQualityNote').textContent = result.side === 'WAIT'
            ? 'Belum ada setup yang lolos seluruh konfirmasi. Skor bukan prediksi hasil.'
            : 'Ringkasan transparan: kesepakatan indikator, MTF, dan ATR. Bukan jaminan hasil atau rekomendasi transaksi.';
    }

    function setLoading(isLoading) {
        const badge = $('qtSignalBadge');
        if (!badge) return;
        if (isLoading) { badge.textContent = 'MEMUAT'; badge.className = 'qt-signal-badge loading'; }
    }

    function setPairLoadingStep(step, message, progress) {
        const overlay = $('qtPairLoading');
        if (!overlay) return;
        const order = ['feed', 'chart', 'analysis', 'ready'];
        const current = Math.max(0, order.indexOf(step));
        overlay.querySelectorAll('[data-qt-load-step]').forEach(item => {
            const index = order.indexOf(item.dataset.qtLoadStep);
            item.classList.toggle('is-done', index < current);
            item.classList.toggle('is-active', index === current);
        });
        const progressBar = $('qtPairLoadingProgress');
        if (progressBar) progressBar.style.width = Math.max(8, Math.min(100, Number(progress) || 0)) + '%';
        if (message) $('qtPairLoadingMessage').textContent = message;
    }

    function showPairLoading(symbol, timeframe) {
        const overlay = $('qtPairLoading');
        if (!overlay) return;
        state.pairLoading = true;
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-hidden', 'false');
        $('qtPairLoadingTitle').textContent = 'Menyiapkan ' + (labels[symbol] || symbol) + ' · ' + String(timeframe || '').toUpperCase();
        setPairLoadingStep('feed', 'Menghubungkan ke feed market…', 16);
        $('qtApplyChart').disabled = true;
        renderFeedStatus('loading', null, null, 'Menyiapkan ' + (labels[symbol] || symbol));
    }

    function hidePairLoading(token, success) {
        if (token !== state.pairLoadingToken) return;
        setPairLoadingStep(success ? 'ready' : 'analysis', success ? 'Semua data siap. Membuka pair…' : 'Feed belum lengkap — analisa ditahan.', success ? 100 : 78);
        window.setTimeout(() => {
            if (token !== state.pairLoadingToken) return;
            const overlay = $('qtPairLoading');
            if (overlay) {
                overlay.classList.remove('is-visible');
                overlay.setAttribute('aria-hidden', 'true');
            }
            state.pairLoading = false;
            $('qtApplyChart').disabled = false;
        }, success ? 260 : 700);
    }

    function waitForFrameLoad(timeout) {
        return new Promise(resolve => {
            let settled = false;
            const finish = value => {
                if (settled) return;
                settled = true;
                frame.removeEventListener('load', onLoad);
                resolve(value);
            };
            const onLoad = () => finish(true);
            frame.addEventListener('load', onLoad, { once: true });
            window.setTimeout(() => finish(false), Number(timeout) || 15000);
        });
    }

    function renderResult(result) {
        reconcileSignalLifecycle(result);
        state.lastResult = result;
        const badge = $('qtSignalBadge');
        const sideClass = result.side === 'BUY' ? 'buy' : result.side === 'SELL' ? 'sell' : '';
        badge.textContent = result.side === 'WAIT' ? 'WAIT' : result.side + ' · CONFIRMED';
        badge.className = 'qt-signal-badge ' + sideClass;
        $('qtSignalSymbol').textContent = (labels[state.symbol] || state.symbol) + ' · ' + state.timeframe.toUpperCase();
        $('qtSignalTime').textContent = 'Candle close terakhir · ' + timeText(result.candleTime);
        $('qtSignalReason').textContent = result.reason;
        const provisional = $('qtSignalProvisional');
        if (result.provisional && result.provisional.side !== 'WAIT') {
            provisional.textContent = 'PROVISIONAL ' + result.provisional.side + ' · candle aktif belum dikunci — ' + result.provisional.reason;
            provisional.className = 'qt-signal-provisional is-visible';
        } else {
            provisional.textContent = '';
            provisional.className = 'qt-signal-provisional';
        }
        $('qtSignalEntry').textContent = result.entry === null ? '—' : price(result.entry, state.symbol);
        $('qtSignalSL').textContent = result.sl === null ? '—' : price(result.sl, state.symbol);
        $('qtSignalTP').textContent = result.tp === null ? '—' : price(result.tp, state.symbol);
        $('qtSignalRR').textContent = result.rr === null ? '—' : '1 : ' + result.rr.toFixed(1);
        $('qtSignalConfidence').textContent = result.confidence ? result.confidence + '%' : '—';
        $('qtSignalSource').textContent = sourceLabel(result.source);
        $('qtSignalSource').title = sourceNote(result.source);
        $('qtSignalVotes').textContent = result.side === 'WAIT' ? 'menunggu konfirmasi' : result.bull + ' bullish · ' + result.bear + ' bearish';
        $('qtSignalLock').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg><span>Signal dikunci dari candle close — tidak memakai candle berjalan</span>';
        const basis = $('qtSignalBasis');
        basis.replaceChildren();
        result.basis.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'qt-basis-chip';
            chip.textContent = item.name + ': ' + item.side;
            basis.appendChild(chip);
        });
        renderMtfStatus(result);
        renderQuality(result);
        renderSymbolMapping();
        const riskNote = Number.isFinite(result.atr) ? 'SL = ATR(14) × 1,5 · TP = 2R · jarak dihitung dari data chart aktif.' : 'ATR belum cukup untuk menghitung level risiko.';
        $('qtSignalDataNote').textContent = riskNote + (result.snapshotId ? ' · Snapshot ' + result.snapshotId : '');
        renderFeedStatus('live', result.source || state.feed.source, state.feed.ageSeconds, null, state.feed.marketClosed);
        postChartOverlay(result);
    }

    function renderError(message) {
        const badge = $('qtSignalBadge');
        badge.textContent = 'NO DATA'; badge.className = 'qt-signal-badge loading';
        $('qtSignalSymbol').textContent = (labels[state.symbol] || state.symbol) + ' · ' + state.timeframe.toUpperCase();
        $('qtSignalTime').textContent = 'Belum ada candle yang bisa dianalisa';
        $('qtSignalReason').textContent = message;
        ['qtSignalEntry', 'qtSignalSL', 'qtSignalTP', 'qtSignalRR', 'qtSignalConfidence'].forEach(id => { $(id).textContent = '—'; });
        $('qtSignalSource').textContent = 'Menunggu feed'; $('qtSignalVotes').textContent = '—'; $('qtSignalBasis').replaceChildren();
        $('qtMtfStatus').replaceChildren();
        $('qtQualityScore').textContent = '—'; $('qtQualityScore').className = 'is-wait';
        $('qtQualityAgreement').textContent = '—'; $('qtQualityMtf').textContent = '—'; $('qtQualityVolatility').textContent = '—'; $('qtQualityMarket').textContent = '—'; $('qtQualityMarket').className = 'wait';
        $('qtQualityNote').textContent = 'Kualitas belum dapat dihitung sampai feed candle nyata tersedia.';
        renderSymbolMapping();
        $('qtSignalProvisional').textContent = ''; $('qtSignalProvisional').className = 'qt-signal-provisional';
        $('qtSignalDataNote').textContent = 'Signal ditahan sampai data harga nyata tersedia.';
        renderFeedStatus('error', state.feed.source, state.feed.ageSeconds, 'Feed belum siap');
        postChartOverlay(null);
    }

    function expireActiveSignal(reason) {
        if (!state.activeSignalKey) return;
        const item = state.history.find(entry => entry.key === state.activeSignalKey);
        if (item && (!item.status || item.status === 'CONFIRMED')) {
            item.status = 'EXPIRED';
            item.expiredAt = Date.now();
            item.expiryReason = reason || 'Candle baru atau konfigurasi berubah';
            saveHistory();
            if (state.activeTab === 'history') renderHistory();
        }
        state.activeSignalKey = null;
    }

    function reconcileSignalLifecycle(result) {
        const fingerprint = state.symbol + '|' + state.timeframe + '|' + result.candleTime + '|' + result.side;
        if (state.activeSignalKey && state.activeSignalKey !== fingerprint) expireActiveSignal(result.candleTime === (state.lastResult && state.lastResult.candleTime) ? 'Konfigurasi indikator berubah' : 'Candle close baru terbentuk');
    }

    function record(result) {
        if (result.side === 'WAIT') return;
        const key = state.symbol + '|' + state.timeframe + '|' + result.candleTime + '|' + result.side;
        const existing = state.history.find(item => item.key === key);
        if (existing) {
            existing.status = 'CONFIRMED';
            existing.expiredAt = null;
            existing.expiryReason = null;
            state.activeSignalKey = key;
            saveHistory();
            return;
        }
        state.history.unshift({
            key, symbol: state.symbol, timeframe: state.timeframe, side: result.side,
            reason: result.reason, price: result.entry, entry: result.entry, stopLoss: result.sl,
            takeProfit: result.tp, rr: result.rr, confidence: result.confidence,
            quality: result.quality, basis: result.basis, mtf: result.mtf,
            snapshotId: result.snapshotId || createSignalSnapshot(result), engineVersion: result.engineVersion || signalEngineVersion,
            feedSnapshot: result.feedSnapshot || null,
            source: result.source || state.source || 'Chart feed', candleTime: result.candleTime,
            time: Date.now(), status: 'CONFIRMED', expiredAt: null, expiryReason: null
        });
        state.activeSignalKey = key;
        state.history = state.history.slice(0, 30); saveHistory(); renderHistory();
    }

    function renderHistory() {
        const list = $('qtHistoryList'); list.replaceChildren();
        if (!state.history.length) { const empty = document.createElement('div'); empty.className = 'qt-empty'; empty.textContent = 'Belum ada signal terkunci. Signal baru akan tercatat setelah indikator searah.'; list.appendChild(empty); return; }
        state.history.forEach(item => {
            const row = document.createElement('article'); row.className = 'qt-history-item';
            const top = document.createElement('div'); top.className = 'qt-history-top';
            const symbol = document.createElement('span'); symbol.className = 'qt-history-symbol'; symbol.textContent = (labels[item.symbol] || item.symbol) + ' · ' + String(item.timeframe || '').toUpperCase();
            const side = document.createElement('span'); side.className = 'qt-history-side ' + item.side.toLowerCase(); side.textContent = item.side;
            top.append(symbol, side);
            const reason = document.createElement('div'); reason.className = 'qt-history-reason'; reason.textContent = item.reason;
            const stamp = document.createElement('div'); stamp.className = 'qt-history-time'; stamp.textContent = new Date(item.time).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · entry ' + price(item.price, item.symbol || '') + ' · ' + (item.source || 'Chart feed');
            const audit = document.createElement('div'); audit.className = 'qt-history-audit'; audit.textContent = (item.status || 'CONFIRMED') + (item.expiryReason ? ' · ' + item.expiryReason : '') + (item.candleTime ? ' · candle ' + timeText(item.candleTime) : '') + (item.snapshotId ? ' · ' + item.snapshotId : '');
            row.append(top, reason, stamp, audit); list.appendChild(row);
        });
    }

    function restoreActiveSignal() {
        const active = state.history.find(item => item.symbol === state.symbol && item.timeframe === state.timeframe && (item.status || 'CONFIRMED') === 'CONFIRMED');
        state.activeSignalKey = active ? active.key : null;
    }

    function normalizeCandle(candle) {
        const item = candle && typeof candle === 'object' ? candle : {};
        return { time: Number(item.time), open: Number(item.open), high: Number(item.high), low: Number(item.low), close: Number(item.close), volume: Number(item.volume || 0) };
    }

    function validateCandleSeries(candles, symbol, timeframe) {
        const expectedStep = timeframeSeconds[timeframe] || 300;
        const issues = [];
        let previousTime = 0;
        let previousClose = null;
        for (let index = 0; index < candles.length; index += 1) {
            const candle = candles[index];
            const values = [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume];
            if (!values.every(Number.isFinite) || candle.time <= 0) {
                issues.push('nilai candle tidak valid pada bar ' + (index + 1));
                break;
            }
            if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) || candle.high < candle.low) {
                issues.push('struktur OHLC rusak pada bar ' + (index + 1));
                break;
            }
            if (previousTime && candle.time <= previousTime) {
                issues.push('urutan waktu candle tidak menaik pada bar ' + (index + 1));
                break;
            }
            if (previousClose !== null && previousClose !== 0) {
                const jump = Math.abs(candle.close - previousClose) / Math.abs(previousClose);
                const range = Math.abs(candle.high - candle.low) / Math.abs(previousClose);
                if (jump > .6 || range > .8) {
                    issues.push('lonjakan harga tidak wajar pada bar ' + (index + 1));
                    break;
                }
            }
            previousTime = candle.time;
            previousClose = candle.close;
        }
        const latest = candles.length ? candles[candles.length - 1].time : 0;
        if (latest > Date.now() / 1000 + expectedStep * 2) issues.push('timestamp candle berada di masa depan');
        if (issues.length) {
            const anomaly = new Error('Feed ' + (labels[symbol] || symbol) + ' ditolak: ' + issues[0] + '.');
            anomaly.code = 'DATA_ANOMALY';
            anomaly.issues = issues;
            throw anomaly;
        }
        return { valid: true, issues: [], expectedStep };
    }

    function stableHash(value) {
        let hash = 2166136261;
        const text = String(value);
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
    }

    function createSignalSnapshot(result) {
        const basis = (result.basis || []).map(item => [item.name, item.side, item.reason].join(':')).join('|');
        const fingerprint = [
            signalEngineVersion, state.symbol, state.timeframe, result.candleTime, result.side,
            result.current, result.entry, result.sl, result.tp, result.reason, basis,
            JSON.stringify(state.indicators), state.mtfEnabled ? 'MTF' : 'NO-MTF', result.source || state.source || 'feed'
        ].join('|');
        return 'QT-' + stableHash(fingerprint);
    }

    async function fetchAnalysisCandles(timeframe) {
        const targetTimeframe = timeframe || state.timeframe;
        const query = new URLSearchParams({ symbol: state.symbol, interval: intervalMap[targetTimeframe] || '5' });
        const response = await fetch('api/get-chart-data.php?' + query.toString(), { cache: 'no-store' });
        if (!response.ok) throw new Error('Feed chart tidak merespons.');
        const data = await response.json();
        if (data.status !== 'success' || data.tidak_tersedia) throw new Error(data.message || 'Data pair sementara tidak tersedia.');
        if (data.simulated) {
            const simulatedError = new Error('Data simulasi terdeteksi — hasil ditahan demi keamanan analisa.');
            simulatedError.code = 'UNTRUSTED_DATA';
            throw simulatedError;
        }
        const all = Array.isArray(data.candles) ? data.candles.map(normalizeCandle) : [];
        if (all.length < 57) throw new Error('Riwayat candle belum cukup untuk analisa historis.');
        const integrity = validateCandleSeries(all, state.symbol, targetTimeframe);
        const freshness = freshnessCheck(state.symbol, targetTimeframe, all);
        if (!freshness.ok) {
            const staleError = new Error('Feed ' + (labels[state.symbol] || state.symbol) + ' terlalu lama (' + formatAge(freshness.ageSeconds) + '). Signal ditahan.');
            staleError.code = 'STALE_DATA';
            staleError.freshness = freshness;
            staleError.source = data.source || data.provider || 'Chart feed';
            throw staleError;
        }
        if (targetTimeframe === state.timeframe) {
            state.source = data.source || data.provider || 'Chart feed';
            state.feed = { status: 'live', source: state.source, ageSeconds: freshness.ageSeconds, marketClosed: freshness.marketClosed };
            renderFeedStatus('live', state.source, freshness.ageSeconds, null, freshness.marketClosed);
        }
        return { all, closed: all.slice(0, -1), freshness, integrity, source: data.source || data.provider || 'Chart feed', generatedAt: data.generated_at || null };
    }

    async function fetchMtfCandles() {
        if (!state.mtfEnabled) return [];
        const timeframes = mtfMap[state.timeframe] || [];
        return Promise.all(timeframes.map(async timeframe => ({ timeframe, ...(await fetchAnalysisCandles(timeframe)) })));
    }

    async function refreshSignal(force) {
        if (state.refreshPromise) return state.refreshPromise;
        if (!force && Date.now() - state.lastFetch < 30000) return true;
        state.lastFetch = Date.now();
        const operation = (async () => {
            setLoading(true);
            renderFeedStatus('loading', state.feed.source, state.feed.ageSeconds, 'Mengambil data market…');
            let lastError = null;
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    const sets = await fetchAnalysisCandles();
                    const mtfSets = await fetchMtfCandles();
                    // Candle terakhir dapat masih berjalan. Selalu buang satu candle terakhir.
                    state.candles = sets.closed;
                    const result = applyMtfConfirmation(analyzeTimeframe(state.candles), mtfSets.map(set => ({ timeframe: set.timeframe, result: analyzeTimeframe(set.closed) })));
                    result.provisional = applyMtfConfirmation(analyzeTimeframe(sets.all), mtfSets.map(set => ({ timeframe: set.timeframe, result: analyzeTimeframe(set.closed) })));
                    result.engineVersion = signalEngineVersion;
                    result.snapshotId = createSignalSnapshot(result);
                    result.feedSnapshot = {
                        source: sets.source || state.source || 'Chart feed',
                        generatedAt: sets.generatedAt,
                        candleCount: sets.closed.length,
                        latestCandle: sets.freshness.latest,
                        ageSeconds: sets.freshness.ageSeconds,
                        integrity: sets.integrity.valid ? 'valid' : 'invalid'
                    };
                    renderResult(result); record(result);
                    return true;
                } catch (error) {
                    lastError = error;
                    if (error && error.code === 'STALE_DATA') {
                        renderFeedStatus('stale', error.source || state.feed.source, error.freshness && error.freshness.ageSeconds);
                        break;
                    }
                    if (error && (error.code === 'DATA_ANOMALY' || error.code === 'UNTRUSTED_DATA')) {
                        renderFeedStatus('error', state.feed.source, state.feed.ageSeconds, 'Feed ditolak · data tidak valid');
                        break;
                    }
                    if (attempt < 2) {
                        renderFeedStatus('retrying', state.feed.source, state.feed.ageSeconds, 'Feed gagal · mencoba lagi ' + (attempt + 2) + '/3…');
                        await delay(700 * (attempt + 1));
                    }
                }
            }
            renderError(lastError && lastError.message ? lastError.message : 'Data belum tersedia.');
            if (lastError && lastError.code === 'STALE_DATA') renderFeedStatus('stale', lastError.source || state.feed.source, lastError.freshness && lastError.freshness.ageSeconds);
            return false;
        })();
        state.refreshPromise = operation.finally(() => { state.refreshPromise = null; });
        return state.refreshPromise;
    }

    function rText(value) {
        if (!Number.isFinite(value)) return '—';
        return (value > 0 ? '+' : '') + value.toFixed(2) + 'R';
    }

    function setBacktestStatus(message, type) {
        const status = $('qtBacktestStatus');
        status.className = 'qt-backtest-status' + (type ? ' is-' + type : '');
        status.querySelector('span').textContent = message;
    }

    function simulateBacktest(candles, maxBars, mtfSets) {
        const trades = [];
        let signalIndex = 55;
        while (signalIndex < candles.length - 1) {
            const local = analyzeTimeframe(candles.slice(0, signalIndex + 1));
            const setup = applyMtfConfirmation(local, alignMtfResult(candles[signalIndex], mtfSets || []));
            const distance = Number.isFinite(setup.atr) && setup.atr > 0 ? setup.atr * 1.5 : null;
            if (setup.side === 'WAIT' || !Number.isFinite(distance)) { signalIndex += 1; continue; }

            const entryBar = candles[signalIndex + 1];
            const entry = Number(entryBar.open);
            if (!Number.isFinite(entry)) { signalIndex += 1; continue; }
            const risk = distance;
            const sl = entry + (setup.side === 'SELL' ? risk : -risk);
            const tp = entry + (setup.side === 'SELL' ? -risk * 2 : risk * 2);
            const lastBarIndex = Math.min(candles.length - 1, signalIndex + maxBars);
            let exitIndex = null, exitPrice = null, status = 'TIME';

            for (let index = signalIndex + 1; index <= lastBarIndex; index += 1) {
                const bar = candles[index];
                const stopHit = setup.side === 'BUY' ? bar.low <= sl : bar.high >= sl;
                const targetHit = setup.side === 'BUY' ? bar.high >= tp : bar.low <= tp;
                // If both levels are touched in the same candle, use the conservative assumption: SL first.
                if (stopHit) { exitIndex = index; exitPrice = sl; status = 'SL'; break; }
                if (targetHit) { exitIndex = index; exitPrice = tp; status = 'TP'; break; }
            }

            if (exitIndex === null) {
                exitIndex = lastBarIndex;
                exitPrice = candles[exitIndex].close;
            }
            const resultR = setup.side === 'BUY' ? (exitPrice - entry) / risk : (entry - exitPrice) / risk;
            trades.push({
                side: setup.side, signalTime: setup.candleTime, entryTime: entryBar.time, exitTime: candles[exitIndex].time,
                entry, exit: exitPrice, sl, tp, r: resultR, status, reason: setup.reason
            });
            signalIndex = Math.max(signalIndex + 1, exitIndex);
        }

        let equity = 0, peak = 0, maxDrawdown = 0, grossProfit = 0, grossLoss = 0;
        trades.forEach(trade => {
            equity += trade.r;
            peak = Math.max(peak, equity);
            maxDrawdown = Math.max(maxDrawdown, peak - equity);
            if (trade.r > 0) grossProfit += trade.r;
            if (trade.r < 0) grossLoss += Math.abs(trade.r);
        });
        const wins = trades.filter(trade => trade.r > 0).length;
        const losses = trades.filter(trade => trade.r < 0).length;
        return {
            trades, total: trades.length, wins, losses, timeouts: trades.filter(trade => trade.status === 'TIME').length,
            winRate: trades.length ? wins / trades.length * 100 : 0, netR: equity,
            avgR: trades.length ? equity / trades.length : 0, maxDrawdown,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
            grossProfit, grossLoss, bars: candles.length
        };
    }

    function setBacktestMetric(id, value, tone) {
        const element = $(id);
        element.textContent = value;
        element.className = tone ? tone : '';
    }

    function renderBacktest(result, maxBars) {
        setBacktestStatus('Selesai · ' + result.bars + ' candle close · ' + (state.source || 'Chart feed') + (state.mtfEnabled ? ' · MTF aktif' : ''), 'ready');
        setBacktestMetric('qtBtTrades', String(result.total));
        setBacktestMetric('qtBtWinRate', result.total ? result.winRate.toFixed(1) + '%' : '—');
        setBacktestMetric('qtBtNetR', result.total ? rText(result.netR) : '—', result.netR > 0 ? 'positive' : result.netR < 0 ? 'negative' : '');
        setBacktestMetric('qtBtProfitFactor', result.total ? (Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : '∞') : '—');
        setBacktestMetric('qtBtDrawdown', result.total ? '-' + result.maxDrawdown.toFixed(2) + 'R' : '—', result.maxDrawdown > 0 ? 'negative' : '');
        setBacktestMetric('qtBtAvgR', result.total ? rText(result.avgR) : '—', result.avgR > 0 ? 'positive' : result.avgR < 0 ? 'negative' : '');
        $('qtBacktestSummary').textContent = result.total
            ? result.wins + ' win · ' + result.losses + ' loss · ' + result.timeouts + ' timeout. ' + (state.mtfEnabled ? 'Signal wajib dikonfirmasi timeframe lebih tinggi. ' : '') + 'Satu posisi aktif maksimal ' + maxBars + ' candle; candle yang menyentuh SL dan TP bersamaan dihitung sebagai SL.'
            : 'Belum ada setup yang memenuhi konfirmasi indikator pada data historis ini.';
        $('qtBacktestTradeCount').textContent = result.total + ' trade';
        const list = $('qtBacktestTrades'); list.replaceChildren();
        if (!result.trades.length) { const empty = document.createElement('div'); empty.className = 'qt-empty'; empty.textContent = 'Belum ada trade yang memenuhi aturan signal.'; list.appendChild(empty); return; }
        result.trades.slice(-8).reverse().forEach(trade => {
            const row = document.createElement('article'); row.className = 'qt-backtest-trade';
            const main = document.createElement('div'); main.className = 'qt-backtest-trade-main';
            const head = document.createElement('div'); head.className = 'qt-backtest-trade-head';
            const side = document.createElement('span'); side.className = trade.side === 'BUY' ? 'buy' : 'sell'; side.textContent = trade.side;
            const entry = document.createElement('span'); entry.textContent = price(trade.entry, state.symbol);
            head.append(side, entry);
            const stamp = document.createElement('div'); stamp.className = 'qt-backtest-trade-time'; stamp.textContent = timeText(trade.entryTime) + ' → ' + timeText(trade.exitTime);
            main.append(head, stamp);
            const resultR = document.createElement('strong'); resultR.className = 'qt-backtest-trade-result ' + (trade.r > 0 ? 'positive' : trade.r < 0 ? 'negative' : 'neutral'); resultR.textContent = rText(trade.r);
            const outcome = document.createElement('span'); outcome.className = 'qt-backtest-trade-status'; outcome.textContent = trade.status;
            row.append(main, resultR, outcome); list.appendChild(row);
        });
    }

    function renderBacktestError(message) {
        setBacktestStatus(message, 'error');
        ['qtBtTrades', 'qtBtWinRate', 'qtBtNetR', 'qtBtProfitFactor', 'qtBtDrawdown', 'qtBtAvgR'].forEach(id => setBacktestMetric(id, '—'));
        $('qtBacktestSummary').textContent = 'Backtest tidak dijalankan sampai data historis tersedia.';
        $('qtBacktestTradeCount').textContent = '0 trade'; $('qtBacktestTrades').replaceChildren();
    }

    async function runBacktest() {
        const button = $('qtRunBacktest');
        const maxBars = Number($('qtBacktestMaxBars').value) || 48;
        button.disabled = true; button.textContent = 'Menghitung…'; setBacktestStatus('Mengambil candle historis dan menghitung setup…', 'running');
        try {
            const sets = await fetchAnalysisCandles();
            const mtfSets = await fetchMtfCandles();
            state.candles = sets.closed;
            const result = simulateBacktest(sets.closed, maxBars, mtfSets);
            renderBacktest(result, maxBars);
        } catch (error) { renderBacktestError(error.message || 'Backtest gagal dijalankan.'); }
        finally { button.disabled = false; button.textContent = 'Jalankan backtest'; }
    }

    function syncSelects() {
        const context = frameContext();
        state.symbol = normalizeSymbol(context.symbol) || state.symbol;
        state.timeframe = intervalMap[context.timeframe] ? context.timeframe : state.timeframe;
        $('qtSymbol').value = state.symbol; $('qtTimeframe').value = state.timeframe;
        $('qt-ind-ema').checked = state.indicators.ema; $('qt-ind-rsi').checked = state.indicators.rsi; $('qt-ind-macd').checked = state.indicators.macd; $('qt-ind-mtf').checked = state.mtfEnabled;
        renderSymbolMapping(); renderChartTools();
    }

    async function applyChartContext() {
        const nextSymbol = normalizeSymbol($('qtSymbol').value) || state.symbol;
        const nextTimeframe = intervalMap[$('qtTimeframe').value] ? $('qtTimeframe').value : state.timeframe;
        const token = ++state.pairLoadingToken;
        expireActiveSignal('Pair atau timeframe berubah');
        state.symbol = nextSymbol;
        state.timeframe = nextTimeframe;
        showPairLoading(state.symbol, state.timeframe);
        const url = new URL(frame.getAttribute('src'), window.location.href);
        url.searchParams.set('symbol', state.symbol); url.searchParams.set('timeframe', state.timeframe);
        const frameReady = waitForFrameLoad(15000);
        frame.src = url.pathname + url.search;
        state.lastFetch = 0; renderSymbolMapping(); saveWorkspace('Workspace tersimpan');
        const loaded = await frameReady;
        if (token !== state.pairLoadingToken) return;
        setPairLoadingStep('chart', loaded ? 'Chart diterima. Menyiapkan candle…' : 'Chart membutuhkan waktu lebih lama…', 47);
        setPairLoadingStep('analysis', 'Menghitung indikator dan validasi setup…', 72);
        const ready = await refreshSignal(true);
        if (token !== state.pairLoadingToken) return;
        hidePairLoading(token, ready);
    }

    function postChartCommand(command, payload) {
        if (!frame.contentWindow) return;
        try { frame.contentWindow.postMessage({ type: 'qt-chart-command', command, payload: payload || {} }, window.location.origin); } catch (e) {}
    }

    function applyPalette(palette, persist) {
        state.palette = chartPalettes[palette] ? palette : 'quantum';
        $('qtChartPalette').value = state.palette;
        postChartCommand('palette', { name: state.palette, overrides: chartPalettes[state.palette] });
        if (persist !== false) saveWorkspace('Preset warna tersimpan');
    }

    function renderChartTools() {
        const crosshair = $('qtChartCrosshair');
        if (!crosshair) return;
        const magnet = state.crosshairMode === 'magnet';
        crosshair.classList.toggle('is-active', magnet);
        crosshair.setAttribute('aria-pressed', String(magnet));
        crosshair.querySelector('span').textContent = magnet ? 'Magnet' : 'Precise';
    }

    function toggleCrosshair() {
        state.crosshairMode = state.crosshairMode === 'magnet' ? 'normal' : 'magnet';
        postChartCommand('crosshair', { mode: state.crosshairMode });
        renderChartTools(); saveWorkspace('Mode crosshair tersimpan');
    }

    function resetChartView() {
        postChartCommand('reset');
    }

    function zoomChart(direction) {
        postChartCommand('zoom', { direction });
    }

    async function toggleChartFullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (frame.requestFullscreen) await frame.requestFullscreen();
        } catch (e) {
            postChartCommand('fullscreen');
        }
    }

    function resetWorkspace() {
        expireActiveSignal('Workspace dikembalikan ke default');
        state.symbol = 'XAUUSD'; state.timeframe = '5m';
        state.indicators = { ema: true, rsi: true, macd: true }; state.mtfEnabled = true;
        state.overlay = true; state.crosshairMode = 'magnet'; state.palette = 'quantum'; state.activeTab = 'signal'; state.lastFetch = 0;
        try { localStorage.removeItem(workspaceKey); localStorage.removeItem('qt_signal_overlay'); } catch (e) {}
        $('qtSymbol').value = state.symbol; $('qtTimeframe').value = state.timeframe;
        $('qt-ind-ema').checked = true; $('qt-ind-rsi').checked = true; $('qt-ind-macd').checked = true; $('qt-ind-mtf').checked = true; $('qtOverlayToggle').checked = true;
        setOverlay(true); setTab('signal'); applyPalette('quantum', false); saveWorkspace('Workspace dikembalikan ke default'); applyChartContext();
    }

    function setOverlay(enabled) {
        state.overlay = Boolean(enabled);
        try { localStorage.setItem('qt_signal_overlay', state.overlay ? 'on' : 'off'); } catch (e) {}
        if (state.overlay && state.lastResult) postChartOverlay(state.lastResult);
        else postChartOverlay(null);
        saveWorkspace('Workspace tersimpan');
    }

    function toggleDrawer(force) {
        const open = typeof force === 'boolean' ? force : !drawer.classList.contains('is-open');
        drawer.classList.toggle('is-open', open); $('qtAssistScrim').classList.toggle('is-open', open); $('qtAssistLauncher').classList.toggle('is-open', open); $('qtAssistLauncher').setAttribute('aria-expanded', String(open)); drawer.setAttribute('aria-hidden', String(!open)); $('qtAssistScrim').setAttribute('aria-hidden', String(!open));
        if (open) { syncSelects(); refreshSignal(false); }
    }

    function setTab(tab) {
        document.querySelectorAll('[data-qt-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.qtTab === tab));
        document.querySelectorAll('.qt-assist-panel').forEach(panel => panel.classList.toggle('is-active', panel.id === 'qtPanel-' + tab));
        state.activeTab = allowedTabs.includes(tab) ? tab : 'signal'; saveWorkspace('Workspace tersimpan');
        if (tab === 'history') renderHistory();
    }

    $('qtAssistLauncher').addEventListener('click', () => toggleDrawer());
    $('qtAssistClose').addEventListener('click', () => toggleDrawer(false));
    $('qtAssistScrim').addEventListener('click', () => toggleDrawer(false));
    $('qtApplyChart').addEventListener('click', applyChartContext);
    $('qtWorkspaceSave').addEventListener('click', () => saveWorkspace('Workspace tersimpan manual'));
    $('qtWorkspaceReset').addEventListener('click', resetWorkspace);
    $('qtRefreshSignal').addEventListener('click', () => refreshSignal(true));
    $('qtRunBacktest').addEventListener('click', runBacktest);
    $('qtChartCrosshair').addEventListener('click', toggleCrosshair);
    $('qtChartZoomOut').addEventListener('click', () => zoomChart('out'));
    $('qtChartZoomIn').addEventListener('click', () => zoomChart('in'));
    $('qtChartReset').addEventListener('click', resetChartView);
    $('qtChartFullscreen').addEventListener('click', toggleChartFullscreen);
    $('qtChartPalette').addEventListener('change', event => applyPalette(event.target.value));
    $('qtOverlayToggle').checked = state.overlay;
    $('qtOverlayToggle').addEventListener('change', event => setOverlay(event.target.checked));
    $('qtClearHistory').addEventListener('click', () => { state.history = []; saveHistory(); renderHistory(); });
    document.querySelectorAll('[data-qt-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.qtTab)));
    ['ema', 'rsi', 'macd'].forEach(key => $("qt-ind-" + key).addEventListener('change', event => { state.indicators[key] = event.target.checked; saveWorkspace('Pengaturan indikator tersimpan'); refreshSignal(true); }));
    $('qt-ind-mtf').addEventListener('change', event => { state.mtfEnabled = event.target.checked; saveWorkspace('Konfirmasi MTF tersimpan'); refreshSignal(true); });
    frame.addEventListener('load', () => { window.setTimeout(() => { syncSelects(); postChartCommand('crosshair', { mode: state.crosshairMode }); applyPalette(state.palette, false); refreshSignal(false); if (state.lastResult) postChartOverlay(state.lastResult); }, 500); });
    window.setInterval(() => { if (drawer.classList.contains('is-open')) refreshSignal(false); }, 15000);
    document.addEventListener('fullscreenchange', () => {
        const button = $('qtChartFullscreen');
        const active = Boolean(document.fullscreenElement);
        button.classList.toggle('is-active', active);
        button.querySelector('span').textContent = active ? 'Exit' : 'Full';
    });
    window.addEventListener('keydown', event => {
        const key = String(event.key || '').toLowerCase();
        if (event.ctrlKey && event.shiftKey && key === 'c') { event.preventDefault(); toggleCrosshair(); return; }
        if (event.ctrlKey && event.shiftKey && key === 'r') { event.preventDefault(); resetChartView(); return; }
        if (event.ctrlKey && event.shiftKey && key === 'f') { event.preventDefault(); toggleChartFullscreen(); return; }
        if (event.key === 'Escape' && drawer.classList.contains('is-open')) toggleDrawer(false);
    });

    if (savedWorkspace) {
        const savedUrl = new URL(frame.getAttribute('src'), window.location.href);
        savedUrl.searchParams.set('symbol', state.symbol); savedUrl.searchParams.set('timeframe', state.timeframe);
        frame.src = savedUrl.pathname + savedUrl.search;
    }
    $('qtOverlayToggle').checked = state.overlay; $('qtChartPalette').value = state.palette;
    $('qt-ind-ema').checked = state.indicators.ema; $('qt-ind-rsi').checked = state.indicators.rsi; $('qt-ind-macd').checked = state.indicators.macd; $('qt-ind-mtf').checked = state.mtfEnabled;
    setTab(state.activeTab); syncSelects(); restoreActiveSignal(); renderChartTools(); renderSymbolMapping(); applyPalette(state.palette, false); renderHistory();
    renderWorkspaceStatus(savedWorkspace ? 'Workspace dipulihkan' : 'Disimpan otomatis di perangkat ini');
    window.setTimeout(() => refreshSignal(true), 900);
})();
