/**
 * Konteks chart untuk Quick Trade (assets/js/qim-quick-trade.js).
 *
 * Modul order dipindah apa adanya dari dashboard panel lama, dan masih membaca "konteks chart" yang dulu diisi
 * dashboard-app.js: daftar simbol (WL_GROUPS), simbol yang tampil (_tvSymbol), jumlah desimal (DP), label
 * (SYMBOL_LABELS), dan qiChartKonteks(). Di dashboard chart-first chart-nya ada di iframe terminal, jadi konteks itu
 * disediakan di sini dan disamakan dengan simbol/timeframe iframe (parameter ?symbol=&timeframe= pada URL-nya, yang
 * sama dibaca qim-terminal-shell.js).
 *
 * Harus dimuat SEBELUM qim-quick-trade.js: berkas itu membaca nama-nama ini saat dievaluasi.
 */
(function () {
    'use strict';

    // Simbol aplikasi ↔ simbol sumber (dipakai Quick Trade untuk mencocokkan chart). Urutan = urutan watchlist terminal.
    const FOREX = [['XAUUSD', 'OANDA:XAUUSD'], ['XAGUSD', 'OANDA:XAGUSD'], ['EURUSD', 'OANDA:EURUSD'], ['GBPUSD', 'OANDA:GBPUSD'], ['USDJPY', 'OANDA:USDJPY'],
        ['AUDUSD', 'OANDA:AUDUSD'], ['NZDUSD', 'OANDA:NZDUSD'], ['USDCHF', 'OANDA:USDCHF'], ['USDCAD', 'OANDA:USDCAD'], ['EURGBP', 'OANDA:EURGBP'],
        ['EURJPY', 'OANDA:EURJPY'], ['GBPJPY', 'OANDA:GBPJPY'], ['AUDJPY', 'OANDA:AUDJPY'], ['USDTRY', 'OANDA:USDTRY']];
    const KRIPTO = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'].map((s) => [s, 'BINANCE:' + s]);
    const LABEL = {
        XAUUSD: 'XAU/USD', XAGUSD: 'XAG/USD', EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD', NZDUSD: 'NZD/USD',
        USDCHF: 'USD/CHF', USDCAD: 'USD/CAD', EURGBP: 'EUR/GBP', EURJPY: 'EUR/JPY', GBPJPY: 'GBP/JPY', AUDJPY: 'AUD/JPY', USDTRY: 'USD/TRY',
        BTCUSDT: 'BTC/USDT', ETHUSDT: 'ETH/USDT', SOLUSDT: 'SOL/USDT', BNBUSDT: 'BNB/USDT', XRPUSDT: 'XRP/USDT', DOGEUSDT: 'DOGE/USDT'
    };
    const DESIMAL = {
        XAUUSD: 2, EURUSD: 5, GBPUSD: 5, USDJPY: 3, AUDUSD: 5, NZDUSD: 5, USDCHF: 5, USDCAD: 5, EURGBP: 5, USDTRY: 4,
        BTCUSDT: 2, ETHUSDT: 2, SOLUSDT: 3, BNBUSDT: 2, XRPUSDT: 4, DOGEUSDT: 5,
        GBPJPY: 3, EURJPY: 3, AUDJPY: 3, XAGUSD: 4
    };

    const grup = [
        { name: 'Forex & Logam', syms: FOREX.map(([key, tv]) => ({ key, tv })) },
        { name: 'Crypto', syms: KRIPTO.map(([key, tv]) => ({ key, tv })) }
    ];
    const peta = {};
    grup.forEach((g) => g.syms.forEach((s) => { peta[s.key] = s.tv; }));

    window.WL_GROUPS = grup;
    window.SYMBOL_LABELS = LABEL;
    window.DP = DESIMAL;
    // Simbol yang SELALU ikut diminta ke live-price.php. Kosong: yang diminta hanya simbol chart, posisi terbuka, dan
    // simbol yang dibutuhkan order — watchlist di dalam iframe mengambil harganya sendiri.
    window.SYMBOLS = [];
    window._lwSeries = null;          // tidak ada seri lightweight-charts di sini (garis posisi tidak digambar di iframe)
    window._tvSymbol = peta.XAUUSD;
    window._qiInterval = '5m';

    function simbolDiUrl() {
        const f = document.getElementById('quantumTerminalFrame');
        if (!f) return null;
        let url;
        try { url = new URL(f.contentWindow.location.href); }
        catch (e) { try { url = new URL(f.getAttribute('src'), location.href); } catch (e2) { return null; } }
        return { symbol: (url.searchParams.get('symbol') || '').toUpperCase(), timeframe: url.searchParams.get('timeframe') || '' };
    }

    let terakhir = '';
    function atur(simbol, timeframe) {
        simbol = String(simbol || '').toUpperCase();
        if (!peta[simbol]) return false;
        const kunci = simbol + '|' + (timeframe || '');
        if (kunci === terakhir) return false;
        terakhir = kunci;
        window._tvSymbol = peta[simbol];
        if (timeframe) window._qiInterval = timeframe;
        // Kartu Quick Trade, garis posisi, dan modul lain menyegarkan diri dari kejadian ini.
        try { window.dispatchEvent(new CustomEvent('qi-chart-data', { detail: { symbol: simbol, interval: window._qiInterval } })); } catch (e) {}
        return true;
    }

    function simbolSekarang() {
        const f = Object.keys(peta).find((k) => peta[k] === window._tvSymbol);
        return f || '';
    }

    /** Dibaca modul lain (Quick Trade, indikator Pine): simbol & timeframe chart yang sedang tampil. */
    window.qiChartKonteks = function () {
        return {
            symbol: simbolSekarang(), sym: simbolSekarang(), interval: window._qiInterval, candles: [],
            chart: window.__quantumTerminalChart || null, series: null, source: ''
        };
    };
    window.QIMKonteks = { atur, simbolSekarang };

    function sinkron() {
        const u = simbolDiUrl();
        if (u && u.symbol) atur(u.symbol, u.timeframe);
    }
    // Iframe memperbarui parameter URL-nya saat pengguna ganti simbol/timeframe di dalam widget; baca berkala + saat dimuat.
    function pasang() {
        const f = document.getElementById('quantumTerminalFrame');
        if (f) f.addEventListener('load', sinkron);
        sinkron();
        setInterval(() => { if (document.visibilityState === 'visible') sinkron(); }, 1500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
})();
