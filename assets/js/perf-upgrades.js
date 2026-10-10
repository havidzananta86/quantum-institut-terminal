/**
 * Quantum Institut — Performance Upgrades
 * #46 WebSocket real-time prices (Binance)
 * #48 Lazy-load heavy panels
 * #49 Error boundary + auto-retry fetch
 */

// ─── #49 Error Boundary + Auto-Retry Fetch ─────────────────────────────────
(function() {
    var _retryQueue = [];
    var _retrying = false;

    window.qiFetch = function(url, opts, retries) {
        retries = typeof retries === 'number' ? retries : 2;
        opts = opts || {};
        opts.signal = opts.signal || (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined);
        return fetch(url, opts).then(function(res) {
            if (!res.ok && res.status >= 500 && retries > 0) {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        resolve(qiFetch(url, opts, retries - 1));
                    }, 1000 * (3 - retries));
                });
            }
            return res;
        }).catch(function(err) {
            if (retries > 0 && err.name !== 'AbortError') {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        resolve(qiFetch(url, opts, retries - 1));
                    }, 1000 * (3 - retries));
                });
            }
            throw err;
        });
    };

    window.addEventListener('online', function() {
        if (typeof showQuantumToast === 'function') showQuantumToast('Koneksi pulih', 'success');
        if (typeof fetchMarketData === 'function') fetchMarketData();
    });

    window.addEventListener('offline', function() {
        if (typeof showQuantumToast === 'function') showQuantumToast('Tidak ada koneksi internet', 'error');
    });
})();

// ─── #46 Binance WebSocket Real-Time Prices ─────────────────────────────────
(function() {
    var CRYPTO_SYMBOLS = ['btcusdt','ethusdt','solusdt','bnbusdt','xrpusdt','dogeusdt'];
    var ws = null;
    var wsReconnectTimer = null;
    var wsReconnectDelay = 2000;
    var wsMaxDelay = 30000;
    var wsEnabled = true;

    function connectBinanceWS() {
        if (!wsEnabled || ws) return;
        var streams = CRYPTO_SYMBOLS.map(function(s) { return s + '@miniTicker'; }).join('/');
        try {
            ws = new WebSocket('wss://stream.binance.com:9443/ws/' + streams);
        } catch(e) { return; }

        ws.onopen = function() {
            wsReconnectDelay = 2000;
        };

        ws.onmessage = function(event) {
            try {
                var d = JSON.parse(event.data);
                if (!d.s || !d.c) return;
                var sym = d.s.toUpperCase();
                if (typeof _lastPrices === 'undefined' || !_lastPrices) return;

                var prev = _lastPrices[sym];
                var newPrice = parseFloat(d.c);
                var open = parseFloat(d.o || 0);
                var chgPct = open > 0 ? ((newPrice - open) / open * 100) : 0;

                _lastPrices[sym] = {
                    price: newPrice,
                    chgPct: chgPct.toFixed(2),
                    high: d.h || (prev ? prev.high : null),
                    low: d.l || (prev ? prev.low : null),
                    volume: d.v || (prev ? prev.volume : null)
                };

                if (typeof flashPriceChange === 'function' && prev) {
                    var prevPrice = parseFloat(prev.price);
                    if (prevPrice !== newPrice) flashPriceChange(sym, newPrice);
                }
            } catch(e) {}
        };

        ws.onclose = function() {
            ws = null;
            if (!wsEnabled) return;
            wsReconnectTimer = setTimeout(function() {
                wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, wsMaxDelay);
                connectBinanceWS();
            }, wsReconnectDelay);
        };

        ws.onerror = function() {
            if (ws) ws.close();
        };
    }

    function updateUIFromWS() {
        if (typeof _lastPrices === 'undefined' || !_lastPrices) return;
        if (typeof renderTicker === 'function') renderTicker(_lastPrices);
        if (typeof renderMarketTape === 'function') renderMarketTape(_lastPrices);
        if (typeof renderStatCards === 'function') renderStatCards(_lastPrices);
        var el = document.getElementById('tapeUpdated');
        if (el) el.textContent = new Date().toLocaleTimeString('id-ID');
        if (typeof updateWatchlistPrices === 'function') updateWatchlistPrices();
        var flatPrices = {};
        if (_lastPrices) {
            Object.entries(_lastPrices).forEach(function(e) { flatPrices[e[0]] = parseFloat(e[1].price); });
        }
        if (typeof updateFloatingTicker === 'function') updateFloatingTicker(flatPrices);
        if (typeof checkPriceAlerts === 'function') checkPriceAlerts(flatPrices);
    }

    window._qiWS = {
        connect: connectBinanceWS,
        disconnect: function() {
            wsEnabled = false;
            clearTimeout(wsReconnectTimer);
            if (ws) ws.close();
            ws = null;
        },
        isConnected: function() { return ws && ws.readyState === WebSocket.OPEN; }
    };

    if (document.querySelector('#marketTapeBody')) {
        connectBinanceWS();
        setInterval(updateUIFromWS, 2000);
    }
})();

// ─── #48 Lazy-Load Heavy Panels ─────────────────────────────────────────────
(function() {
    if (typeof IntersectionObserver === 'undefined') return;

    var heavyPanels = ['panel-risk','panel-screener','panel-volatility','panel-sentiment','panel-journal','panel-alerts'];

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var id = entry.target.id;
                if (typeof initPanel === 'function') {
                    initPanel(id);
                }
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '200px' });

    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            heavyPanels.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) observer.observe(el);
            });
        }, 1000);
    });
})();
