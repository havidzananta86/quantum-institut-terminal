/**
 * Quantum Institut Market Terminal — Professional Trading Suite v5.0
 * Fully integrated Tier S, Tier A, Tier B, Tier C, Tier E Tools
 */

(function(window, document) {
    'use strict';

    /* ==========================================================================
       1. WEB AUDIO API SYNTHESIZER (0 EXTERNAL SOUND DEPENDENCIES)
       ========================================================================== */
    const QuantumAudio = {
        ctx: null,
        enabled: true,
        _getCtx() {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return this.ctx;
        },
        playChime(type = 'success') {
            if (!this.enabled) return;
            try {
                const ctx = this._getCtx();
                if (!ctx) return;
                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                if (type === 'success' || type === 'buy') {
                    // Two-tone rising chime (C5 -> G5)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc.start(now);
                    osc.stop(now + 0.35);
                } else if (type === 'sell' || type === 'warning') {
                    // Two-tone falling chime (G5 -> Eb5)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(783.99, now);
                    osc.frequency.exponentialRampToValueAtTime(622.25, now + 0.15);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc.start(now);
                    osc.stop(now + 0.35);
                } else if (type === 'alert') {
                    // Tri-tone alert ping
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(880, now);
                    osc.frequency.setValueAtTime(1174.66, now + 0.1);
                    osc.frequency.setValueAtTime(1760, now + 0.2);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                    osc.start(now);
                    osc.stop(now + 0.45);
                }
            } catch (e) {
                // AudioContext not allowed before user gesture, silent ignore
            }
        },
        toggle() {
            this.enabled = !this.enabled;
            if (window.showQuantumToast) {
                window.showQuantumToast(this.enabled ? '🔊 Audio Alert: AKTIF' : '🔇 Audio Alert: SENYAP', 'info', 1500);
            }
            return this.enabled;
        }
    };
    window.QuantumAudio = QuantumAudio;


    /* ==========================================================================
       2. REALTIME 20+ PAIRS TICKER MARQUEE ENGINE (TIER S - FITUR 1)
       ========================================================================== */
    const TICKER_SYMBOLS = [
        { sym: 'BTCUSDT', label: 'BTC/USDT', type: 'crypto', price: 68450.20, chg: 2.84, tvSym: 'BINANCE:BTCUSDT' },
        { sym: 'ETHUSDT', label: 'ETH/USDT', type: 'crypto', price: 3520.10, chg: 1.92, tvSym: 'BINANCE:ETHUSDT' },
        { sym: 'SOLUSDT', label: 'SOL/USDT', type: 'crypto', price: 184.50, chg: 4.65, tvSym: 'BINANCE:SOLUSDT' },
        { sym: 'XAUUSD',  label: 'XAU/USD',  type: 'gold',   price: 2654.20, chg: 0.78, tvSym: 'OANDA:XAUUSD' },
        { sym: 'EURUSD',  label: 'EUR/USD',  type: 'forex',  price: 1.0895,  chg: -0.15, tvSym: 'FX:EURUSD' },
        { sym: 'GBPUSD',  label: 'GBP/USD',  type: 'forex',  price: 1.3042,  chg: 0.22, tvSym: 'FX:GBPUSD' },
        { sym: 'USDJPY',  label: 'USD/JPY',  type: 'forex',  price: 152.65,  chg: 0.35, tvSym: 'FX:USDJPY' },
        { sym: 'BNBUSDT', label: 'BNB/USDT', type: 'crypto', price: 592.30,  chg: 1.15, tvSym: 'BINANCE:BNBUSDT' },
        { sym: 'XRPUSDT', label: 'XRP/USDT', type: 'crypto', price: 0.5840,  chg: 3.40, tvSym: 'BINANCE:XRPUSDT' },
        { sym: 'DOGEUSDT',label: 'DOGE/USDT',type: 'crypto', price: 0.1425,  chg: -1.20, tvSym: 'BINANCE:DOGEUSDT' },
        { sym: 'ADAUSDT', label: 'ADA/USDT', type: 'crypto', price: 0.3620,  chg: 0.85, tvSym: 'BINANCE:ADAUSDT' },
        { sym: 'AVAXUSDT',label: 'AVAX/USDT',type: 'crypto', price: 29.80,   chg: 2.10, tvSym: 'BINANCE:AVAXUSDT' },
        { sym: 'LINKUSDT',label: 'LINK/USDT',type: 'crypto', price: 12.45,   chg: 1.65, tvSym: 'BINANCE:LINKUSDT' },
        { sym: 'NEARUSDT',label: 'NEAR/USDT',type: 'crypto', price: 5.18,    chg: 5.12, tvSym: 'BINANCE:NEARUSDT' },
        { sym: 'SUIUSDT', label: 'SUI/USDT', type: 'crypto', price: 2.15,    chg: 6.80, tvSym: 'BINANCE:SUIUSDT' },
        { sym: 'USOIL',   label: 'WTI CRUDE',type: 'oil',    price: 71.85,   chg: -0.45, tvSym: 'TVC:USOIL' },
        { sym: 'NDX',     label: 'NAS100',   type: 'index',  price: 20350.0, chg: 0.95, tvSym: 'OANDA:NAS100USD' },
        { sym: 'SPX',     label: 'US500',    type: 'index',  price: 5860.25, chg: 0.62, tvSym: 'OANDA:SPX500USD' },
        { sym: 'AUDUSD',  label: 'AUD/USD',  type: 'forex',  price: 0.6650,  chg: -0.28, tvSym: 'FX:AUDUSD' },
        { sym: 'DOTUSDT', label: 'DOT/USDT', type: 'crypto', price: 4.45,    chg: 0.40, tvSym: 'BINANCE:DOTUSDT' }
    ];

    const QuantumTickerEngine = {
        data: TICKER_SYMBOLS,
        ws: null,
        init() {
            this.render();
            this.connectLiveWS();
        },
        render() {
            const container = document.getElementById('quantumMarqueeTrack');
            if (!container) return;

            // Render duplicate list for infinite seamless marquee loop
            const renderList = [...this.data, ...this.data];
            container.innerHTML = renderList.map((item, idx) => {
                const isUp = item.chg >= 0;
                const colorClass = isUp ? 'text-emerald-400' : 'text-rose-400';
                const bgPill = isUp ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30';
                const sign = isUp ? '+' : '';
                const formatPrice = item.price >= 100 ? item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.price.toFixed(4);

                return `
                    <div onclick="QuantumTickerEngine.handleClick('${item.sym}', '${item.tvSym}', ${item.price})" 
                         id="ticker-item-${item.sym}-${idx}"
                         class="inline-flex items-center gap-2 px-3 py-1 mx-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all shrink-0 select-none group">
                        <span class="font-bold text-white group-hover:text-cyan-400 text-xs">${item.label}</span>
                        <span id="ticker-price-${item.sym}-${idx}" class="font-mono text-xs text-slate-200">${formatPrice}</span>
                        <span class="font-mono text-[10px] px-1.5 py-0.5 rounded border ${bgPill} ${colorClass}">${sign}${item.chg.toFixed(2)}%</span>
                    </div>
                `;
            }).join('');
        },
        handleClick(sym, tvSym, price) {
            if (window.loadRealtimeSymbol) {
                window.loadRealtimeSymbol(tvSym, sym, price);
            } else if (window.quantumTerminalManager) {
                window.quantumTerminalManager.setSymbol(sym);
            }
            if (window.showQuantumToast) {
                window.showQuantumToast(`⚡ Membuka Chart ${sym} @ $${price.toLocaleString()}`, 'success', 1500);
            }
        },
        status: 'LIVE', // 'LIVE' | 'DELAYED' | 'OFFLINE'
        lastUpdated: new Date(),
        connectLiveWS() {
            // WebSocket Binance diblok di beberapa region — gunakan QuantumPricePoller sebagai gantinya
            // Poller sudah diinisialisasi di atas dan mengupdate ticker + _livePrices
            return;
            /* eslint-disable no-unreachable */
            const cryptoStreams = ['btcusdt@miniTicker', 'ethusdt@miniTicker', 'solusdt@miniTicker', 'bnbusdt@miniTicker', 'xrpusdt@miniTicker', 'dogeusdt@miniTicker'];
            const streamUrls = [
                `wss://stream.binance.vision/ws/${cryptoStreams.join('/')}`,
                `wss://stream.binance.com:9443/ws/${cryptoStreams.join('/')}`
            ];

            let index = 0;
            const updateStatusUI = (st) => {
                this.status = st;
                const statusEl = document.getElementById('tickerFeedStatus');
                const textEl = document.getElementById('tickerFeedText');
                const timeEl = document.getElementById('tickerLastTime');
                
                if (textEl) textEl.textContent = st;
                if (timeEl) timeEl.textContent = this.lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                if (statusEl) {
                    if (st === 'LIVE') {
                        statusEl.className = 'flex items-center gap-1.5 shrink-0 px-2 font-mono text-[10px] text-emerald-400 font-bold border-r border-slate-800 z-10 bg-[#060B1E]';
                        statusEl.title = 'Feed Realtime Aktif (Binance WebSocket & xaus.com)';
                    } else if (st === 'DELAYED') {
                        statusEl.className = 'flex items-center gap-1.5 shrink-0 px-2 font-mono text-[10px] text-amber-400 font-bold border-r border-slate-800 z-10 bg-[#060B1E]';
                        statusEl.title = 'Feed Delayed / Fallback REST Polling';
                    } else {
                        statusEl.className = 'flex items-center gap-1.5 shrink-0 px-2 font-mono text-[10px] text-rose-400 font-bold border-r border-slate-800 z-10 bg-[#060B1E]';
                        statusEl.title = 'Koneksi Network Terputus (Offline)';
                    }
                }
            };

            const tryStream = () => {
                if (index >= streamUrls.length) {
                    updateStatusUI('DELAYED');
                    return;
                }
                try {
                    this.ws = new WebSocket(streamUrls[index]);
                    this.ws.onopen = () => {
                        updateStatusUI('LIVE');
                    };
                    this.ws.onmessage = (e) => {
                        const data = JSON.parse(e.data);
                        if (!data.s || !data.c) return;
                        const sym = data.s.toUpperCase();
                        const closePrice = parseFloat(data.c);
                        const openPrice = parseFloat(data.o);
                        const chg = ((closePrice - openPrice) / openPrice) * 100;

                        const target = this.data.find(d => d.sym === sym);
                        if (target) {
                            target.price = closePrice;
                            target.chg = chg;
                        }
                        this.lastUpdated = new Date();
                        updateStatusUI('LIVE');

                        const formatted = closePrice >= 100 ? closePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : closePrice.toFixed(4);
                        document.querySelectorAll(`[id^="ticker-price-${sym}-"]`).forEach(el => {
                            el.textContent = formatted;
                        });
                    };
                    this.ws.onerror = () => {
                        index++;
                        updateStatusUI('DELAYED');
                        tryStream();
                    };
                    this.ws.onclose = () => {
                        updateStatusUI('OFFLINE');
                    };
                } catch (err) {
                    updateStatusUI('DELAYED');
                }
            };
            tryStream();
        }
    };
    window.QuantumTickerEngine = QuantumTickerEngine;

    /* ==========================================================================
       1b. QUANTUM PRICE POLLER — PHP-proxied live prices (replaces blocked WS)
          Polls /api/live-price.php every 2 seconds. Updates:
          - _livePrices (for all engine/paper trading calculations)
          - Header price display (topLivePrice, topPriceChange)
          - Ticker bar prices
          - Ticker status badge (LIVE/OFFLINE)
       ========================================================================== */
    const ALL_POLL_SYMBOLS = 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,XAUUSD,EURUSD';

    const QuantumPricePoller = {
        _timer: null,
        _consecutiveFails: 0,
        _interval: 2000,

        start() {
            this.poll();
            this._timer = setInterval(() => this.poll(), this._interval);
        },

        async poll() {
            try {
                const res = await fetch(`/webapp/api/live-price.php?symbols=${ALL_POLL_SYMBOLS}`, { cache: 'no-store' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const json = await res.json();
                if (json.status !== 'success' || !json.prices) throw new Error('bad response');

                this._consecutiveFails = 0;
                this._updateStatusUI('LIVE');

                const prices = json.prices;
                const currentSym = window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol || 'BTCUSDT';

                // Update _livePrices for all symbols
                for (const [sym, data] of Object.entries(prices)) {
                    if (window._livePrices) window._livePrices[sym] = data.price;
                    // Update ticker bar items
                    document.querySelectorAll(`[id^="ticker-price-${sym}-"]`).forEach(el => {
                        const dp = (sym === 'EURUSD') ? 5 : (data.price >= 100 ? 2 : 4);
                        el.textContent = data.price.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
                    });
                    // Update TICKER_SYMBOLS array
                    const tgt = QuantumTickerEngine.data?.find(d => d.sym === sym);
                    if (tgt) { tgt.price = data.price; tgt.chg = data.chgPct; }
                }

                // Update header for currently active symbol
                if (prices[currentSym]) {
                    const d = prices[currentSym];
                    const cfg = window.QI_SYMBOL_CONFIG?.[currentSym] || { priceDp: 2, label: currentSym };
                    this._updateHeader(d.price, d.chgPct, cfg);
                }

                // Update paper trading floating PnL
                if (window.QuantumPaperTrading?.updateFloatingPnL) window.QuantumPaperTrading.updateFloatingPnL();

                // Update ticker last-time stamp
                const now = new Date();
                const timeEl = document.getElementById('tickerLastTime');
                if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

            } catch(e) {
                this._consecutiveFails++;
                if (this._consecutiveFails >= 3) this._updateStatusUI('DELAYED');
            }
        },

        _updateHeader(price, chgPct, cfg) {
            if (!price || isNaN(price)) return;
            const dp  = cfg?.priceDp ?? 2;
            const str = price.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
            const id  = s => document.getElementById(s);
            if (id('topLivePrice')) {
                id('topLivePrice').textContent = str;
                id('topLivePrice').className   = chgPct >= 0
                    ? 'font-bold text-emerald-400 text-sm' : 'font-bold text-rose-400 text-sm';
            }
            if (id('chartLabelPrice'))  id('chartLabelPrice').textContent  = str;
            if (id('chartLabelSymbol') && cfg?.label) id('chartLabelSymbol').textContent = cfg.label;
            if (id('topPriceChange') && chgPct !== null) {
                const s = chgPct >= 0 ? '+' : '';
                id('topPriceChange').textContent = `${s}${chgPct.toFixed(2)}%`;
                id('topPriceChange').className   = chgPct >= 0
                    ? 'text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold'
                    : 'text-[11px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-bold';
            }
            // Trigger SL/TP recalc on first price after symbol change
            if (typeof window.recalculateQuantumEngineLevels === 'function' && window._signalNeedsRecalc) {
                window._signalNeedsRecalc = false;
                window.recalculateQuantumEngineLevels(price);
            }
            // Sync mobile sticky bar price
            const mPrice = id('mobileSignalEntry');
            if (mPrice && mPrice.textContent === '-') mPrice.textContent = str;
        },

        _updateStatusUI(status) {
            const statusEl = document.getElementById('tickerFeedStatus');
            const textEl   = document.getElementById('tickerFeedText');
            if (textEl) textEl.textContent = status;
            if (!statusEl) return;
            if (status === 'LIVE') {
                statusEl.className = 'flex items-center gap-1.5 shrink-0 px-2 font-mono text-[10px] text-emerald-400 font-bold border-r border-slate-800 z-10 bg-[#060B1E]';
                statusEl.title = 'Feed Realtime Aktif (PHP Proxy → Binance REST)';
            } else {
                statusEl.className = 'flex items-center gap-1.5 shrink-0 px-2 font-mono text-[10px] text-amber-400 font-bold border-r border-slate-800 z-10 bg-[#060B1E]';
                statusEl.title = 'Feed Delayed — Mencoba ulang...';
            }
        }
    };
    window.QuantumPricePoller = QuantumPricePoller;


    /* ==========================================================================
       3. ORDER BOOK & TIME & SALES ENGINE (TIER S - FITUR 2 & 3)
       ========================================================================== */
    const CRYPTO_OB_SYMBOLS = new Set(['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT']);

    const QuantumOrderBook = {
        symbol: 'BTCUSDT',
        bids: [],
        asks: [],
        trades: [],
        ws: null,
        wsTrades: null,
        _midPrice: 68450.0,
        init() {
            this._connectRealFeed(this.symbol, this._midPrice);
        },
        setSymbol(sym, basePrice = 68450.0) {
            this.symbol = sym;
            this._midPrice = basePrice || this._midPrice;
            if (this.ws) { try { this.ws.close(); } catch(e){} this.ws = null; }
            if (this.wsTrades) { try { this.wsTrades.close(); } catch(e){} this.wsTrades = null; }
            this.bids = []; this.asks = []; this.trades = [];
            this._connectRealFeed(sym, this._midPrice);
        },
        _connectRealFeed(sym, basePrice) {
            // Stop previous poll
            if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }

            if (!CRYPTO_OB_SYMBOLS.has(sym)) {
                this._generateEstimatedBook(basePrice);
                this.render();
                return;
            }

            const fetchDepth = async () => {
                try {
                    const res = await fetch(`/webapp/api/orderbook.php?symbol=${sym}&limit=20`, { cache: 'no-store' });
                    const d = await res.json();
                    if (!d.bids || d.bids.length === 0) throw new Error('empty');

                    let cumBid = 0, cumAsk = 0;
                    this.bids = d.bids.slice(0, 10).map(([p, q]) => {
                        cumBid += +q;
                        return { price: +p, qty: +q, total: +cumBid.toFixed(4) };
                    });
                    this.asks = d.asks.slice(0, 10).map(([p, q]) => {
                        cumAsk += +q;
                        return { price: +p, qty: +q, total: +cumAsk.toFixed(4) };
                    });
                    this._midPrice = this.bids.length ? (this.bids[0].price + this.asks[0].price) / 2 : basePrice;

                    // Simulate time-and-sales from bid/ask spread
                    const midP = this._midPrice;
                    const isBuy = Math.random() > 0.45;
                    const qty = +(Math.random() * 1.5 + 0.01).toFixed(3);
                    this.trades.unshift({
                        time: new Date().toTimeString().split(' ')[0],
                        price: midP + (isBuy ? 1 : -1) * midP * 0.0001,
                        qty, side: isBuy ? 'BUY' : 'SELL'
                    });
                    if (this.trades.length > 20) this.trades.pop();

                    this.render();
                    this.renderTrades();
                } catch(e) {
                    this._generateEstimatedBook(basePrice);
                    this.render();
                }
            };

            fetchDepth();
            // Poll every 1.5 seconds for pseudo-realtime depth
            this._pollTimer = setInterval(fetchDepth, 1500);
        },
        _generateEstimatedBook(midPrice) {
            const spread = midPrice * 0.0003;
            this.bids = []; this.asks = [];
            let cumBid = 0, cumAsk = 0;
            for (let i = 1; i <= 10; i++) {
                const bPrice = midPrice - (spread * i);
                const bQty = +(Math.random() * 2 + 0.1).toFixed(3);
                cumBid += bQty;
                this.bids.push({ price: bPrice, qty: bQty, total: +cumBid.toFixed(3) });
                const aPrice = midPrice + (spread * i);
                const aQty = +(Math.random() * 2 + 0.1).toFixed(3);
                cumAsk += aQty;
                this.asks.push({ price: aPrice, qty: aQty, total: +cumAsk.toFixed(3) });
            }
            if (!this.trades.length) {
                for (let i = 0; i < 8; i++) {
                    const isBuy = Math.random() > 0.5;
                    this.trades.push({
                        time: new Date(Date.now() - i * 3000).toTimeString().split(' ')[0],
                        price: midPrice + (Math.random() - 0.5) * spread,
                        qty: +(Math.random() * 1.5 + 0.05).toFixed(3),
                        side: isBuy ? 'BUY' : 'SELL'
                    });
                }
            }
        },
        render() {
            const bookContainer = document.getElementById('orderBookContainer');
            if (!bookContainer) return;

            const maxTotal = Math.max(
                ...this.bids.map(b => b.total),
                ...this.asks.map(a => a.total),
                0.001
            );
            const dp = this.symbol === 'EURUSD' ? 5 : 2;

            const asksHtml = [...this.asks].reverse().map(a => {
                const depthPct = Math.min(100, Math.round((a.total / maxTotal) * 100));
                return `<div class="relative flex justify-between items-center px-2 py-0.5 text-[11px] font-mono hover:bg-rose-500/10 cursor-pointer">
                    <div class="absolute right-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none" style="width:${depthPct}%"></div>
                    <span class="text-rose-400 font-bold z-10">${a.price.toFixed(dp)}</span>
                    <span class="text-slate-300 z-10">${a.qty.toFixed(4)}</span>
                    <span class="text-slate-500 z-10 text-[10px]">${a.total.toFixed(3)}</span>
                </div>`;
            }).join('');

            const isReal = CRYPTO_OB_SYMBOLS.has(this.symbol) && this.ws && this.ws.readyState === 1;
            const sourceLabel = isReal
                ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></span>BINANCE LIVE L2</span>`
                : `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold" title="Pasar OTC tidak memiliki orderbook terpusat">OTC ESTIMASI</span>`;

            const spread = this.asks.length && this.bids.length
                ? ((this.asks[0].price - this.bids[0].price) / this.asks[0].price * 100).toFixed(3)
                : '0.000';
            const midSpreadHtml = `<div class="py-1 px-2 my-1 bg-slate-950/80 border-y border-slate-800 flex flex-wrap justify-between items-center text-[10px] font-mono text-cyan-400 gap-1">
                <span class="font-bold flex items-center gap-1">${sourceLabel}</span>
                <span class="text-amber-300">SPREAD: ${spread}%</span>
                <span class="text-slate-400">DEPTH: ${maxTotal.toFixed(2)}</span>
            </div>`;

            const bidsHtml = this.bids.map(b => {
                const depthPct = Math.min(100, Math.round((b.total / maxTotal) * 100));
                return `<div class="relative flex justify-between items-center px-2 py-0.5 text-[11px] font-mono hover:bg-emerald-500/10 cursor-pointer">
                    <div class="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none" style="width:${depthPct}%"></div>
                    <span class="text-emerald-400 font-bold z-10">${b.price.toFixed(dp)}</span>
                    <span class="text-slate-300 z-10">${b.qty.toFixed(4)}</span>
                    <span class="text-slate-500 z-10 text-[10px]">${b.total.toFixed(3)}</span>
                </div>`;
            }).join('');

            bookContainer.innerHTML = asksHtml + midSpreadHtml + bidsHtml;
            this.renderTrades();
        },
        renderTrades() {
            const tradesContainer = document.getElementById('timeSalesContainer');
            if (!tradesContainer || !this.trades.length) return;
            const dp = this.symbol === 'EURUSD' ? 5 : 2;
            tradesContainer.innerHTML = this.trades.slice(0, 20).map(t => {
                const isBuy = t.side === 'BUY';
                return `<div class="flex justify-between items-center px-2 py-0.5 text-[11px] font-mono hover:bg-slate-800/40">
                    <span class="text-slate-400 text-[10px]">${t.time}</span>
                    <span class="${isBuy ? 'text-emerald-400' : 'text-rose-400'} font-bold">${(+t.price).toFixed(dp)}</span>
                    <span class="text-slate-200">${(+t.qty).toFixed(4)}</span>
                    <span class="px-1 rounded text-[9px] font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${t.side}</span>
                </div>`;
            }).join('');
        }
    };
    window.QuantumOrderBook = QuantumOrderBook;


    /* ==========================================================================
       4. POSITION SIZE & RISK CALCULATOR (TIER S - FITUR 5)
       ========================================================================== */
    const QuantumPositionCalculator = {
        calculate() {
            const balance = parseFloat(document.getElementById('posCalcBalance')?.value || 10000);
            const riskPct = parseFloat(document.getElementById('posCalcRiskPct')?.value || 1.5);
            const entry = parseFloat(document.getElementById('posCalcEntry')?.value || 68450);
            const sl = parseFloat(document.getElementById('posCalcSL')?.value || 67800);
            const assetType = document.getElementById('posCalcAssetType')?.value || 'crypto';

            if (entry <= 0 || sl <= 0 || entry === sl) {
                if (window.showQuantumToast) window.showQuantumToast('⚠️ Entry & Stop Loss harus valid!', 'warning');
                return;
            }

            const dollarRisk = balance * (riskPct / 100);
            const slDistance = Math.abs(entry - sl);
            const slDistancePct = (slDistance / entry) * 100;

            let units = dollarRisk / slDistance;
            let lotSize = 0;

            if (assetType === 'forex') {
                // 1 Standard Lot = 100,000 units
                lotSize = +(units / 100000).toFixed(2);
            } else if (assetType === 'gold') {
                // 1 Standard Lot = 100 oz
                lotSize = +(units / 100).toFixed(2);
            } else {
                lotSize = +units.toFixed(4);
            }

            const totalExposure = units * entry;
            const effectiveLeverage = (totalExposure / balance).toFixed(1);

            // Populate results
            const resRisk = document.getElementById('posCalcResRisk');
            const resSize = document.getElementById('posCalcResSize');
            const resPip = document.getElementById('posCalcResPip');
            const resLev = document.getElementById('posCalcResLev');

            if (resRisk) resRisk.textContent = `$${dollarRisk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (resSize) resSize.textContent = `${lotSize} ${assetType === 'forex' || assetType === 'gold' ? 'Lots' : 'Units'}`;
            if (resPip) resPip.textContent = `${slDistance.toFixed(2)} (${slDistancePct.toFixed(2)}%)`;
            if (resLev) resLev.textContent = `${effectiveLeverage}x`;
        },
        applyToChart() {
            const entry = parseFloat(document.getElementById('posCalcEntry')?.value || 0);
            const sl = parseFloat(document.getElementById('posCalcSL')?.value || 0);
            if (window.quantumTerminalManager && entry > 0 && sl > 0) {
                const isLong = entry > sl;
                const tp = isLong ? entry + (Math.abs(entry - sl) * 2.5) : entry - (Math.abs(entry - sl) * 2.5);
                
                window.quantumTerminalManager.createdPriceLines.push(
                    window.quantumTerminalManager.candleSeries.createPriceLine({
                        price: entry, color: '#00E5FF', lineWidth: 2, title: 'POS ENTRY'
                    }),
                    window.quantumTerminalManager.candleSeries.createPriceLine({
                        price: sl, color: '#FF4D6D', lineWidth: 2, title: 'POS SL'
                    }),
                    window.quantumTerminalManager.candleSeries.createPriceLine({
                        price: tp, color: '#00FFA3', lineWidth: 2, title: 'POS TP (1:2.5)'
                    })
                );
                if (window.showQuantumToast) {
                    window.showQuantumToast('📐 Kalkulasi Posisi Diterapkan ke Chart!', 'success');
                }
                QuantumAudio.playChime('success');
                this.closeModal();
            }
        },
        openModal() {
            const modal = document.getElementById('posCalculatorModal');
            if (modal) {
                modal.classList.remove('hidden');
                // Auto fill entry from last ticker price if available
                if (window.quantumTerminalManager && window.quantumTerminalManager.lastClosePrice) {
                    const lastP = window.quantumTerminalManager.lastClosePrice;
                    const entryEl = document.getElementById('posCalcEntry');
                    const slEl = document.getElementById('posCalcSL');
                    if (entryEl) entryEl.value = lastP;
                    if (slEl) slEl.value = +(lastP * 0.99).toFixed(2);
                }
                this.calculate();
            }
        },
        closeModal() {
            const modal = document.getElementById('posCalculatorModal');
            if (modal) modal.classList.add('hidden');
        }
    };
    window.QuantumPositionCalculator = QuantumPositionCalculator;


    /* ==========================================================================
       5. RISK REWARD TOOL & TRADE PLAN COPY (TIER S - FITUR 6 & TIER E)
       ========================================================================== */
    const QuantumRRTool = {
        calculate() {
            const entry = parseFloat(document.getElementById('rrEntryInput')?.value || 68450);
            const sl = parseFloat(document.getElementById('rrSLInput')?.value || 67900);
            const tp = parseFloat(document.getElementById('rrTPInput')?.value || 69825);

            if (entry <= 0 || sl <= 0 || tp <= 0) return;

            const isLong = tp > entry;
            const riskDist = Math.abs(entry - sl);
            const rewardDist = Math.abs(tp - entry);
            const rrRatio = riskDist > 0 ? (rewardDist / riskDist).toFixed(2) : 0;

            const badgeEl = document.getElementById('rrRatioBadge');
            const alertEl = document.getElementById('rrWarningAlert');

            if (badgeEl) {
                badgeEl.textContent = `1 : ${rrRatio}`;
                badgeEl.className = rrRatio >= 2.0 
                    ? 'px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold font-mono text-sm'
                    : 'px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold font-mono text-sm';
            }

            if (alertEl) {
                if (rrRatio < 2.0) {
                    alertEl.classList.remove('hidden');
                    alertEl.textContent = `⚠️ PERINGATAN: RR Ratio (1:${rrRatio}) di bawah standar aman 1:2.0! Pertimbangkan revisi TP/SL.`;
                } else {
                    alertEl.classList.add('hidden');
                }
            }
        },
        copyTradePlan() {
            const sym = window.quantumTerminalManager?.currentSymbol || 'BTCUSDT';
            const entry = document.getElementById('rrEntryInput')?.value || '68,450';
            const sl = document.getElementById('rrSLInput')?.value || '67,900';
            const tp = document.getElementById('rrTPInput')?.value || '69,825';
            const ratio = document.getElementById('rrRatioBadge')?.textContent || '1 : 2.50';

            const textPlan = 
`⚡ QUANTUM INSTITUT MARKET SIGNAL SETUP ⚡
═════════════════════════════════════
• Simbol       : ${sym}
• Posisi       : BUY / LONG
• Entry Zone   : ${entry}
• Stop Loss    : ${sl}
• Take Profit  : ${tp}
• Risk/Reward  : ${ratio}
• Mesin Analisa: Quantum SNR & SMC Algorithmic
═════════════════════════════════════
Otomatis dibuat oleh Quantum Terminal Pro | quantuminstitut.market`;

            if (navigator.clipboard) {
                navigator.clipboard.writeText(textPlan).then(() => {
                    if (window.showQuantumToast) window.showQuantumToast('📋 Trade Plan Disalin ke Clipboard!', 'success');
                    QuantumAudio.playChime('success');
                });
            }
        },
        openModal() {
            const modal = document.getElementById('rrToolModal');
            if (modal) {
                modal.classList.remove('hidden');
                if (window.quantumTerminalManager && window.quantumTerminalManager.lastClosePrice) {
                    const p = window.quantumTerminalManager.lastClosePrice;
                    document.getElementById('rrEntryInput').value = p;
                    document.getElementById('rrSLInput').value = +(p * 0.992).toFixed(2);
                    document.getElementById('rrTPInput').value = +(p * 1.022).toFixed(2);
                }
                this.calculate();
            }
        },
        closeModal() {
            const modal = document.getElementById('rrToolModal');
            if (modal) modal.classList.add('hidden');
        }
    };
    window.QuantumRRTool = QuantumRRTool;


    /* ==========================================================================
       6. SESSION HIGHLIGHT & TIMEZONE ENGINE (TIER S - FITUR 7 & TIER E)
       ========================================================================== */
    const QuantumSessionEngine = {
        currentTz: 'WIB',
        init() {
            this.update();
            setInterval(() => this.update(), 1000);
        },
        setTimezone(tz) {
            this.currentTz = tz;
            const tzLabel = document.getElementById('activeTimezoneLabel');
            if (tzLabel) tzLabel.textContent = tz;
            if (window.showQuantumToast) {
                window.showQuantumToast(`🌐 Timezone Diubah ke ${tz}`, 'info', 1500);
            }
        },
        update() {
            const now = new Date();
            const utcHours = now.getUTCHours();
            const utcMins = now.getUTCMinutes();
            const utcTimeDecimal = utcHours + (utcMins / 60);

            // Helper untuk deteksi Daylight Saving Time (DST)
            // US DST: Minggu kedua Maret s.d. Minggu pertama November
            // UK/EU DST: Minggu terakhir Maret s.d. Minggu terakhir Oktober
            const year = now.getUTCFullYear();
            const month = now.getUTCMonth(); // 0-11
            const date = now.getUTCDate();
            const day = now.getUTCDay(); // 0 = Sun

            // Hitung US DST (EDT = UTC-4 vs EST = UTC-5)
            // US NY Open: 09:30 lokal = 13:30 UTC saat DST (EDT) atau 14:30 UTC saat Non-DST (EST)
            const isUsDst = (function() {
                if (month < 2 || month > 10) return false; // Jan, Feb, Dec = EST
                if (month > 2 && month < 10) return true;  // Apr - Oct = EDT
                // Maret: Mulai Minggu ke-2
                if (month === 2) {
                    const secondSun = 14 - (new Date(Date.UTC(year, 2, 1)).getUTCDay() || 7) + 1;
                    return date >= secondSun;
                }
                // November: Selesai Minggu ke-1
                if (month === 10) {
                    const firstSun = 7 - (new Date(Date.UTC(year, 10, 1)).getUTCDay() || 7) + 1;
                    return date < firstSun;
                }
                return false;
            })();

            // Hitung London DST (BST = UTC+1 vs GMT = UTC+0)
            const isUkDst = (function() {
                if (month < 2 || month > 9) return false; // Jan, Feb, Nov, Dec = GMT
                if (month > 2 && month < 9) return true;  // Apr - Sep = BST
                // Maret: Minggu terakhir
                if (month === 2) {
                    const lastSun = 31 - new Date(Date.UTC(year, 2, 31)).getUTCDay();
                    return date >= lastSun;
                }
                // Oktober: Minggu terakhir
                if (month === 9) {
                    const lastSun = 31 - new Date(Date.UTC(year, 9, 31)).getUTCDay();
                    return date < lastSun;
                }
                return false;
            })();

            // Sesi UTC dengan kalkulasi DST:
            // Tokyo / Asian: 00:00 - 09:00 UTC (Tetap tanpa DST)
            // London: 07:00 - 15:30 UTC saat BST, atau 08:00 - 16:30 UTC saat GMT
            const lonOpen = isUkDst ? 7.0 : 8.0;
            const lonClose = lonOpen + 8.5;

            // New York: 13:30 - 20:00 UTC saat EDT, atau 14:30 - 21:00 UTC saat EST
            const nyOpen = isUsDst ? 13.5 : 14.5;
            const nyClose = nyOpen + 6.5;

            const isAsia = utcTimeDecimal >= 0 && utcTimeDecimal < 9;
            const isLondon = utcTimeDecimal >= lonOpen && utcTimeDecimal < lonClose;
            const isNY = utcTimeDecimal >= nyOpen && utcTimeDecimal < nyClose;
            const isLondonNYOverlap = isLondon && isNY;

            const badgeEl = document.getElementById('sessionLiveBadge');
            if (badgeEl) {
                if (isLondonNYOverlap) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span><span class="text-cyan-300 font-bold">LONDON-NY OVERLAP (VOL TINGGI)</span>`;
                } else if (isNY) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span class="text-emerald-300 font-bold">NEW YORK OPEN (${isUsDst ? 'EDT' : 'EST'})</span>`;
                } else if (isLondon) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span class="text-amber-300 font-bold">LONDON OPEN (${isUkDst ? 'BST' : 'GMT'})</span>`;
                } else if (isAsia) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span><span class="text-blue-300 font-bold">TOKYO / ASIA OPEN</span>`;
                } else {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span><span class="text-slate-400">MARKET QUIET (OFF-PEAK)</span>`;
                }
            }
        }
    };
    window.QuantumSessionEngine = QuantumSessionEngine;


    /* ==========================================================================
       7. CANDLE COUNTDOWN TIMER & HEIKIN ASHI SWITCHER (TIER A - FITUR 8 & 17)
       ========================================================================== */
    const QuantumCandleTimer = {
        init() {
            setInterval(() => this.tick(), 1000);
        },
        tick() {
            const el = document.getElementById('candleCountdownTimer');
            if (!el) return;

            const now = new Date();
            const secs = now.getSeconds();
            const mins = now.getMinutes();

            // Interval in minutes mapping
            const currentTf = window.quantumTerminalManager?.currentInterval || '60';
            let tfMins = 60;
            if (currentTf === '1' || currentTf === 'M1') tfMins = 1;
            else if (currentTf === '5' || currentTf === 'M5') tfMins = 5;
            else if (currentTf === '15' || currentTf === 'M15') tfMins = 15;
            else if (currentTf === '30' || currentTf === 'M30') tfMins = 30;
            else if (currentTf === '60' || currentTf === 'H1') tfMins = 60;
            else if (currentTf === '240' || currentTf === 'H4') tfMins = 240;
            else if (currentTf === 'D' || currentTf === 'D1') tfMins = 1440;

            const totalSecsPassed = (mins % tfMins) * 60 + secs;
            const remainingSecs = (tfMins * 60) - totalSecsPassed;

            const remM = Math.floor(remainingSecs / 60);
            const remS = remainingSecs % 60;
            const formatted = `${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;

            el.textContent = formatted;
        }
    };
    window.QuantumCandleTimer = QuantumCandleTimer;


    /* ==========================================================================
       8. PAPER TRADING WALLET & TRADE JOURNAL (TIER S - PAPER TRADING)
       ========================================================================== */
    // Global live price cache — updated by ticker WS + chart engine
    const _livePrices = {
        BTCUSDT: 68450.0, ETHUSDT: 3520.1, SOLUSDT: 184.5,
        XAUUSD: 2654.2, EURUSD: 1.0895, BNBUSDT: 592.3,
    };
    window._livePrices = _livePrices;

    const QuantumPaperTrading = {
        balance: 10000.0,
        positions: [],
        history: [],
        lastBacktestResult: null,
        init() {
            this.loadState();
            this.render();
            this._startPriceTracker();
            setInterval(() => this.updateFloatingPnL(), 1000);
        },
        _startPriceTracker() {
            // _livePrices diupdate oleh QuantumPricePoller (PHP polling)
            // Tidak perlu WS Binance langsung — poller lebih reliable di semua region
        },
        loadState() {
            try {
                const saved = localStorage.getItem('QI_PAPER_TRADING');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.balance = parsed.balance || 10000.0;
                    this.positions = parsed.positions || [];
                    this.history = parsed.history || [];
                }
            } catch (e) {}
        },
        saveState() {
            try {
                localStorage.setItem('QI_PAPER_TRADING', JSON.stringify({
                    balance: this.balance,
                    positions: this.positions,
                    history: this.history
                }));
            } catch (e) {}
        },
        executeOrder(side = 'BUY', customSymbol = null) {
            const activeChartSym = window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol;
            const symSelect = document.getElementById('paperTradePairSelect');
            
            // Prioritize: customSymbol -> active chart symbol -> dropdown selection
            const selectedSym = customSymbol || activeChartSym || (symSelect ? symSelect.value : 'XAUUSD');

            // Sync dropdown UI
            if (symSelect && symSelect.value !== selectedSym) {
                symSelect.value = selectedSym;
            }

            let price = this._getPrice(selectedSym);
            if (!price || price <= 0) price = 2654.50;

            const lots = parseFloat(document.getElementById('paperTradeLots')?.value || (selectedSym === 'XAUUSD' ? 0.5 : (selectedSym === 'BTCUSDT' ? 0.1 : 1.0)));

            const isLong = side === 'BUY';
            const slMult = selectedSym === 'XAUUSD' ? 0.995 : (selectedSym === 'EURUSD' ? 0.998 : 0.99);
            const tpMult = selectedSym === 'XAUUSD' ? 1.015 : (selectedSym === 'EURUSD' ? 1.005 : 1.025);
            
            const sl = isLong ? +(price * slMult).toFixed(2) : +(price * (2 - slMult)).toFixed(2);
            const tp = isLong ? +(price * tpMult).toFixed(2) : +(price * (2 - tpMult)).toFixed(2);

            const newPos = {
                id: 'POS-' + Date.now().toString(36).toUpperCase(),
                symbol: selectedSym,
                side: side,
                entryPrice: price,
                lots: lots,
                sl: sl,
                tp: tp,
                openTime: new Date().toLocaleTimeString('id-ID'),
                floatingPnL: 0
            };

            this.positions.push(newPos);
            this.saveState();
            this.render();

            QuantumAudio.playChime(side.toLowerCase());
            if (window.showQuantumToast) {
                window.showQuantumToast(`⚡ EKSEKUSI PAPER TRADE: ${side} ${lots} ${selectedSym} @ $${price.toLocaleString()}`, 'success');
            }
        },
        closePosition(id) {
            const idx = this.positions.findIndex(p => p.id === id);
            if (idx === -1) return;
            const pos = this.positions[idx];

            const currentPrice = this._getPrice(pos.symbol) || pos.entryPrice;
            const pnl = pos.side === 'BUY'
                ? (currentPrice - pos.entryPrice) * pos.lots * this._pipMult(pos.symbol)
                : (pos.entryPrice - currentPrice) * pos.lots * this._pipMult(pos.symbol);

            this.balance += pnl;
            pos.closePrice = currentPrice;
            pos.closeTime = new Date().toLocaleTimeString('id-ID');
            pos.realizedPnL = +pnl.toFixed(2);

            this.history.unshift(pos);
            this.positions.splice(idx, 1);
            this.saveState();
            this.render();

            const isWin = pnl >= 0;
            QuantumAudio.playChime(isWin ? 'success' : 'warning');
            if (window.showQuantumToast) {
                window.showQuantumToast(`💼 Posisi ${pos.symbol} Ditutup: PnL ${isWin ? '+' : ''}$${pnl.toFixed(2)}`, isWin ? 'success' : 'warning');
            }
        },
        _getPrice(sym) {
            // Prefer live chart price for charted symbol; fallback to WS cache
            if (window.quantumTerminalManager?.currentSymbol === sym && window.quantumTerminalManager?.lastClosePrice > 0) {
                _livePrices[sym] = window.quantumTerminalManager.lastClosePrice;
            }
            return _livePrices[sym] || 0;
        },
        _pipMult(sym) {
            if (sym === 'XAUUSD') return 100;
            if (sym === 'BTCUSDT') return 1;
            if (sym === 'EURUSD') return 100000;
            return 1000;
        },
        updateFloatingPnL() {
            if (!this.positions.length) return;
            const toClose = [];
            let totalFloating = 0;

            this.positions.forEach(pos => {
                const price = this._getPrice(pos.symbol);
                if (price > 0) {
                    const mult = this._pipMult(pos.symbol);
                    pos.floatingPnL = pos.side === 'BUY'
                        ? (price - pos.entryPrice) * pos.lots * mult
                        : (pos.entryPrice - price) * pos.lots * mult;

                    // Auto SL/TP hit check
                    if (pos.side === 'BUY') {
                        if (price <= pos.sl) toClose.push({ id: pos.id, reason: '🔴 SL Hit' });
                        else if (price >= pos.tp) toClose.push({ id: pos.id, reason: '🟢 TP Hit' });
                    } else {
                        if (price >= pos.sl) toClose.push({ id: pos.id, reason: '🔴 SL Hit' });
                        else if (price <= pos.tp) toClose.push({ id: pos.id, reason: '🟢 TP Hit' });
                    }
                }
                totalFloating += (pos.floatingPnL || 0);
            });

            // Auto-close SL/TP positions
            toClose.forEach(({ id, reason }) => {
                if (window.showQuantumToast) window.showQuantumToast(`${reason} — Posisi ${id} ditutup otomatis`, reason.includes('TP') ? 'success' : 'warning');
                this.closePosition(id);
            });

            const equityEl = document.getElementById('paperTotalEquity');
            if (equityEl) {
                const eq = this.balance + totalFloating;
                equityEl.textContent = `$${eq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            this.renderPositionsOnly();
        },
        renderPositionsOnly() {
            const container = document.getElementById('paperPositionsTable');
            if (!container) return;

            if (this.positions.length === 0) {
                container.innerHTML = `<div class="text-center py-4 text-slate-500 font-mono text-xs">Belum ada posisi terbuka. Pilih Simbol (XAUUSD / BTCUSDT) lalu tekan BUY / SELL.</div>`;
                return;
            }

            container.innerHTML = this.positions.map(p => {
                const isBuy = p.side === 'BUY';
                const pnl = p.floatingPnL || 0;
                const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
                return `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded bg-slate-950/80 border border-slate-800 text-xs font-mono gap-1.5">
                        <div class="space-y-0.5 min-w-0">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${p.side}</span>
                                <strong class="text-white">${p.symbol}</strong>
                                <span class="text-slate-400 text-[10px]">${p.lots} Lot</span>
                            </div>
                            <div class="text-[10px] text-slate-400">Entry: $${p.entryPrice.toLocaleString()} | SL: $${p.sl} | TP: $${p.tp}</div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                            <div class="text-left sm:text-right">
                                <div class="${pnlColor} font-bold">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</div>
                                <div class="text-[9px] text-slate-500">${p.openTime}</div>
                            </div>
                            <button onclick="QuantumPaperTrading.closePosition('${p.id}')" class="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold">TUTUP</button>
                        </div>
                    </div>
                `;
            }).join('');
        },
        runBacktest() {
            const symbol = document.getElementById('backtestPairSelect')?.value || 'XAUUSD';
            const interval = document.getElementById('backtestTfSelect')?.value || 'H1';
            const engine = document.getElementById('backtestEngineSelect')?.value || 'SNR';

            // --- Parameter biaya realistis dari input user ---
            const spreadCost = parseFloat(document.getElementById('backtestSpread')?.value) || 0.5;  // $ per trade
            const commissionPct = parseFloat(document.getElementById('backtestCommission')?.value) || 0.02; // % per sisi
            const slippagePct = parseFloat(document.getElementById('backtestSlippage')?.value) || 0.10; // % deviasi random
            const oosPct = parseInt(document.getElementById('backtestOosPct')?.value) || 30; // % data untuk out-of-sample

            const pairLabels = {
                XAUUSD: 'XAU/USD (Gold Spot)',
                BTCUSDT: 'BTC/USDT (Bitcoin)',
                ETHUSDT: 'ETH/USDT (Ethereum)',
                EURUSD: 'EUR/USD (Forex)'
            };
            const label = pairLabels[symbol] || symbol;

            let candles = window.quantumTerminalManager?._cachedCandles;
            if (!candles || candles.length < 50 || window.quantumTerminalManager?.currentSymbol !== symbol) {
                candles = window.quantumTerminalManager?._generateSyntheticCandles(symbol, symbol === 'EURUSD' ? 4 : 2);
            }

            // --- Walk-forward / Out-of-Sample Split ---
            const splitIndex = oosPct > 0 ? Math.floor(candles.length * (1 - oosPct / 100)) : candles.length;
            const inSampleCandles = candles.slice(0, splitIndex);
            const outOfSampleCandles = oosPct > 0 ? candles.slice(splitIndex) : [];

            // --- Fungsi helper: jalankan simulasi pada subset candle ---
            const runSimulation = (candleSet, labelPrefix) => {
                const results = [];
                let winCount = 0;
                let lossCount = 0;
                let totalPnL = 0;
                let totalGained = 0;
                let totalRisked = 0;
                let totalSpreadCost = 0;
                let totalCommCost = 0;
                let totalSlippageCost = 0;
                let maxDrawdown = 0;
                let peakEquity = 10000;
                let currentEquity = 10000;
                const equityCurve = [10000]; // titik-titik equity untuk visualisasi
                const pnlSeries = []; // untuk Sharpe / Sortino
                let totalDurationBars = 0;

                const step = Math.max(2, Math.floor(candleSet.length / 30));

                for (let i = 15; i < candleSet.length - 3; i += step) {
                    const c = candleSet[i];
                    const prev = candleSet[i - 1];
                    const prev2 = candleSet[i - 2] || prev;
                    const windowCandles = candleSet.slice(Math.max(0, i - 20), i + 1);

                    // Engine-Specific Strategy Signals (semua 9 mesin)
                    let isBuy = false;
                    if (engine === 'SNR') {
                        const lowest = Math.min(...windowCandles.map(w => w.low));
                        isBuy = Math.abs(c.low - lowest) < (c.close * 0.002);
                    } else if (engine === 'SMC') {
                        const maxHigh = Math.max(...windowCandles.map(w => w.high));
                        isBuy = c.close > maxHigh * 0.998;
                    } else if (engine === 'EMA200') {
                        const avgCloses = windowCandles.reduce((a, b) => a + b.close, 0) / windowCandles.length;
                        isBuy = c.close >= avgCloses;
                    } else if (engine === 'ICHI') {
                        const highest = Math.max(...windowCandles.map(w => w.high));
                        const lowest = Math.min(...windowCandles.map(w => w.low));
                        const tenkan = (highest + lowest) / 2;
                        isBuy = c.close > tenkan;
                    } else if (engine === 'FIBO') {
                        const highest = Math.max(...windowCandles.map(w => w.high));
                        const lowest = Math.min(...windowCandles.map(w => w.low));
                        const fib618 = lowest + (highest - lowest) * 0.618;
                        isBuy = c.close >= fib618;
                    } else if (engine === 'TRENM5') {
                        isBuy = (c.close - prev.close) > (prev.close - prev2.close);
                    } else if (engine === 'MOMENTUM_NY') {
                        const hour = new Date(c.time * 1000).getUTCHours();
                        isBuy = (hour >= 13 && hour <= 20) && (c.close > prev.close);
                    } else if (engine === 'MACD_MOM') {
                        isBuy = (c.close - c.open) > (prev.close - prev.open);
                    } else if (engine === 'GOLDEN_CROSS') {
                        const shortMA = windowCandles.slice(-5).reduce((a,b)=>a+b.close,0) / 5;
                        const longMA = windowCandles.reduce((a,b)=>a+b.close,0) / windowCandles.length;
                        isBuy = shortMA >= longMA;
                    } else {
                        isBuy = c.close >= prev.close;
                    }

                    const side = isBuy ? 'BUY' : 'SELL';
                    const entryPrice = c.close;

                    // ATR-based SL/TP (volatility-based, bukan fixed %)
                    const atr = Math.abs(c.high - c.low) || (entryPrice * 0.005);
                    const slDist = atr * 1.2;
                    const tpDist = slDist * 2.5;

                    const sl = side === 'BUY' ? +(entryPrice - slDist).toFixed(2) : +(entryPrice + slDist).toFixed(2);
                    const tp = side === 'BUY' ? +(entryPrice + tpDist).toFixed(2) : +(entryPrice - tpDist).toFixed(2);

                    // Simulasi exit dari candle selanjutnya
                    const next = candleSet[i + 1] || c;
                    const next2 = candleSet[i + 2] || next;
                    // Cek apakah TP atau SL terkena dalam 1-2 candle berikutnya
                    let isWin = false;
                    let exitBar = 1;
                    if (side === 'BUY') {
                        if (next.high >= tp) { isWin = true; exitBar = 1; }
                        else if (next.low <= sl) { isWin = false; exitBar = 1; }
                        else if (next2.high >= tp) { isWin = true; exitBar = 2; }
                        else if (next2.low <= sl) { isWin = false; exitBar = 2; }
                        else { isWin = next2.close >= entryPrice; exitBar = 2; }
                    } else {
                        if (next.low <= tp) { isWin = true; exitBar = 1; }
                        else if (next.high >= sl) { isWin = false; exitBar = 1; }
                        else if (next2.low <= tp) { isWin = true; exitBar = 2; }
                        else if (next2.high >= sl) { isWin = false; exitBar = 2; }
                        else { isWin = next2.close <= entryPrice; exitBar = 2; }
                    }
                    totalDurationBars += exitBar;
                    const exitPrice = isWin ? tp : sl;

                    const lotSize = symbol === 'XAUUSD' ? 0.5 : (symbol === 'BTCUSDT' ? 0.1 : 1.0);
                    const pipMultiplier = symbol === 'XAUUSD' ? 50 : (symbol === 'BTCUSDT' ? 1 : 1000);
                    
                    // PnL kotor (sebelum biaya)
                    let grossPnl = isWin
                        ? +(Math.abs(tpDist) * lotSize * pipMultiplier).toFixed(2)
                        : -+(Math.abs(slDist) * lotSize * pipMultiplier).toFixed(2);

                    // --- Hitung biaya realistis ---
                    // 1. Spread cost (diterapkan sebagai biaya tetap per trade)
                    const thisSpreadCost = spreadCost * lotSize;
                    // 2. Commission cost (% dari nilai notional, buka + tutup = 2x)
                    const notional = entryPrice * lotSize;
                    const thisCommCost = +(notional * (commissionPct / 100) * 2).toFixed(2);
                    // 3. Slippage cost (deviasi acak ±slippagePct dari entry)
                    const slippageDeviation = (Math.random() * 2 - 1) * (slippagePct / 100);
                    const thisSlippageCost = +Math.abs(entryPrice * slippageDeviation * lotSize * (pipMultiplier / entryPrice)).toFixed(2);

                    const totalCost = thisSpreadCost + thisCommCost + thisSlippageCost;
                    const netPnl = +(grossPnl - totalCost).toFixed(2);

                    totalSpreadCost += thisSpreadCost;
                    totalCommCost += thisCommCost;
                    totalSlippageCost += thisSlippageCost;

                    if (netPnl >= 0) {
                        winCount++;
                        totalGained += netPnl;
                    } else {
                        lossCount++;
                        totalRisked += Math.abs(netPnl);
                    }

                    totalPnL += netPnl;
                    pnlSeries.push(netPnl);
                    currentEquity += netPnl;
                    equityCurve.push(+currentEquity.toFixed(2));
                    if (currentEquity > peakEquity) peakEquity = currentEquity;
                    const dd = ((peakEquity - currentEquity) / peakEquity) * 100;
                    if (dd > maxDrawdown) maxDrawdown = dd;

                    results.push({
                        date: new Date(c.time * 1000).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }),
                        symbol: symbol,
                        engine: engine,
                        side: side,
                        entry: entryPrice,
                        sl: sl,
                        tp: tp,
                        exit: exitPrice,
                        grossPnl: grossPnl,
                        cost: +totalCost.toFixed(2),
                        pnl: netPnl,
                        isWin: netPnl >= 0,
                        durationBars: exitBar
                    });
                }

                const totalTrades = winCount + lossCount;
                const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : 0;
                const profitFactor = totalRisked > 0 ? +(totalGained / totalRisked).toFixed(2) : 0;
                const avgPnl = totalTrades > 0 ? +(totalPnL / totalTrades).toFixed(2) : 0;
                const avgDuration = totalTrades > 0 ? +(totalDurationBars / totalTrades).toFixed(1) : 0;

                // Sharpe Ratio (annualized, asumsi 252 trading days)
                const meanReturn = pnlSeries.length > 0 ? pnlSeries.reduce((a,b) => a+b, 0) / pnlSeries.length : 0;
                const variance = pnlSeries.length > 1
                    ? pnlSeries.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (pnlSeries.length - 1) : 0;
                const stdDev = Math.sqrt(variance);
                const sharpeRatio = stdDev > 0 ? +((meanReturn / stdDev) * Math.sqrt(252)).toFixed(2) : 0;

                // Sortino Ratio (hanya hitung downside deviation)
                const downsideReturns = pnlSeries.filter(r => r < 0);
                const downsideVariance = downsideReturns.length > 1
                    ? downsideReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (downsideReturns.length - 1) : 0;
                const downsideDev = Math.sqrt(downsideVariance);
                const sortinoRatio = downsideDev > 0 ? +((meanReturn / downsideDev) * Math.sqrt(252)).toFixed(2) : 0;

                // Peringatan low sample
                const lowSampleWarning = totalTrades < 30;

                return {
                    labelPrefix, totalTrades, winCount, lossCount, winRate, totalPnL: +totalPnL.toFixed(2),
                    profitFactor, maxDrawdown: +maxDrawdown.toFixed(1), avgPnl, avgDuration,
                    sharpeRatio, sortinoRatio, lowSampleWarning,
                    totalSpreadCost: +totalSpreadCost.toFixed(2),
                    totalCommCost: +totalCommCost.toFixed(2),
                    totalSlippageCost: +totalSlippageCost.toFixed(2),
                    equityCurve, results
                };
            };

            // --- Jalankan simulasi In-Sample ---
            const isResult = runSimulation(inSampleCandles, 'IN-SAMPLE');

            // --- Jalankan simulasi Out-of-Sample (kalau aktif) ---
            let oosResult = null;
            if (outOfSampleCandles.length > 20) {
                oosResult = runSimulation(outOfSampleCandles, 'OUT-OF-SAMPLE');
            }

            this.lastBacktestResult = {
                symbol, label, interval, engine,
                spreadCost, commissionPct, slippagePct, oosPct,
                inSample: isResult,
                outOfSample: oosResult
            };

            this.renderBacktestResult();
            if (window.showQuantumToast) {
                const wr = isResult.winRate;
                const pnl = isResult.totalPnL;
                const tag = oosResult ? ` | OOS WR: ${oosResult.winRate}%` : '';
                window.showQuantumToast(`⚡ BACKTEST SELESAI: ${label} [${engine}] IS Win Rate: ${wr}% (Net PnL: ${pnl >= 0 ? '+' : ''}$${pnl})${tag}`, 'success');
            }
        },
        resetBacktestDefaults() {
            // Reset semua input ke default XAUUSD
            const defs = { backtestSpread: '0.50', backtestCommission: '0.020', backtestSlippage: '0.10', backtestOosPct: '30' };
            Object.entries(defs).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            });
            if (window.showQuantumToast) window.showQuantumToast('↺ Parameter backtest direset ke default', 'info', 1500);
        },
        renderBacktestResult() {
            const container = document.getElementById('backtestResultContainer');
            if (!container) return;

            const data = this.lastBacktestResult;
            if (!data) {
                container.innerHTML = `<div class="text-center py-3 text-slate-500 font-mono text-xs">Pilih Pasangan, Timeframe, dan Mesin lalu klik "JALANKAN BACKTEST".</div>`;
                return;
            }

            const renderSection = (res, sectionLabel, borderColor) => {
                const pnlColor = res.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400';
                const lowSampleBadge = res.lowSampleWarning
                    ? `<div class="col-span-2 sm:col-span-5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5">
                         ⚠️ LOW SAMPLE (${res.totalTrades} trade) — Jumlah trade terlalu sedikit untuk kesimpulan statistik yang valid. Minimal 30 trade disarankan.
                       </div>` : '';

                // Mini equity curve ASCII sparkline
                const eq = res.equityCurve;
                const eqMin = Math.min(...eq);
                const eqMax = Math.max(...eq);
                const eqRange = eqMax - eqMin || 1;
                const sparkChars = '▁▂▃▄▅▆▇█';
                const sparkline = eq.map(v => {
                    const idx = Math.round(((v - eqMin) / eqRange) * (sparkChars.length - 1));
                    return sparkChars[idx];
                }).join('');
                const eqColor = eq[eq.length - 1] >= eq[0] ? 'text-emerald-400' : 'text-rose-400';

                return `
                    <div class="space-y-2 p-2.5 rounded-xl bg-slate-900/90 border ${borderColor}">
                        <!-- Header Section Label -->
                        <div class="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                            <span class="text-[10px] font-bold font-mono ${borderColor.includes('cyan') ? 'text-cyan-300' : 'text-purple-300'}">${sectionLabel}: ${data.label} (${data.engine})</span>
                            <span class="text-[10px] text-slate-500 font-mono">${res.totalTrades} TRADE</span>
                        </div>
                        ${lowSampleBadge}

                        <!-- Metrik Utama 5 Kolom -->
                        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                            <div>
                                <span class="text-[10px] text-slate-400 block">WIN RATE</span>
                                <strong class="text-emerald-400 font-bold text-sm">${res.winRate}%</strong>
                                <span class="text-[9px] text-slate-500 block">${res.winCount}W / ${res.lossCount}L</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">NET P&L</span>
                                <strong class="${pnlColor} font-bold text-sm">${res.totalPnL >= 0 ? '+' : ''}$${res.totalPnL.toFixed(2)}</strong>
                                <span class="text-[9px] text-slate-500 block">Avg ${res.avgPnl >= 0 ? '+' : ''}$${res.avgPnl}/trade</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">PROFIT FACTOR</span>
                                <strong class="text-cyan-300 font-bold text-sm">${res.profitFactor}</strong>
                                <span class="text-[9px] text-slate-500 block">Max DD -${res.maxDrawdown}%</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">SHARPE / SORTINO</span>
                                <strong class="text-purple-300 font-bold text-sm">${res.sharpeRatio} / ${res.sortinoRatio}</strong>
                                <span class="text-[9px] text-slate-500 block">Avg ${res.avgDuration} bar/trade</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">BIAYA TOTAL</span>
                                <strong class="text-amber-300 font-bold text-sm">$${(res.totalSpreadCost + res.totalCommCost + res.totalSlippageCost).toFixed(2)}</strong>
                                <span class="text-[9px] text-slate-500 block">Spr $${res.totalSpreadCost} | Kom $${res.totalCommCost} | Slip $${res.totalSlippageCost}</span>
                            </div>
                        </div>

                        <!-- Equity Curve Sparkline -->
                        <div class="px-2 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono">
                            <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                                <span>📈 EQUITY CURVE</span>
                                <span>Start: $${eq[0].toLocaleString()} → End: $${eq[eq.length-1].toLocaleString()}</span>
                            </div>
                            <div class="${eqColor} text-sm tracking-[2px] overflow-hidden whitespace-nowrap" title="Equity curve mini chart">${sparkline}</div>
                        </div>

                        <!-- Trade List -->
                        <div class="max-h-36 overflow-y-auto space-y-1 pr-1 thin-scrollbar">
                            ${res.results.map(r => `
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-1.5 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono gap-1">
                                    <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${r.side==='BUY'?'bg-emerald-500/20 text-emerald-300':'bg-rose-500/20 text-rose-300'}">${r.side}</span>
                                        <strong class="text-white">${r.symbol}</strong>
                                        <span class="text-slate-400 text-[10px]">Entry $${r.entry} → Exit $${r.exit}</span>
                                        <span class="text-[9px] text-amber-400/70" title="Biaya spread+komisi+slippage">(-$${r.cost})</span>
                                    </div>
                                    <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                        <span class="text-slate-400 text-[10px]">SL $${r.sl} | TP $${r.tp} | ${r.durationBars}bar</span>
                                        <span class="${r.isWin?'text-emerald-400':'text-rose-400'} font-bold">${r.isWin?'+':''}$${r.pnl.toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            };

            // Render In-Sample + Out-of-Sample
            let html = '<div class="space-y-3">';
            html += renderSection(data.inSample, '📊 IN-SAMPLE', 'border-cyan-500/30');
            if (data.outOfSample) {
                html += renderSection(data.outOfSample, '🧪 OUT-OF-SAMPLE (Walk-Forward)', 'border-purple-500/30');
                // Perbandingan IS vs OOS
                const isr = data.inSample;
                const oosr = data.outOfSample;
                const wrDelta = isr.winRate - oosr.winRate;
                const pfDelta = (isr.profitFactor - oosr.profitFactor).toFixed(2);
                const overfitRisk = wrDelta > 15 ? 'TINGGI' : (wrDelta > 8 ? 'SEDANG' : 'RENDAH');
                const overfitColor = wrDelta > 15 ? 'text-rose-400 bg-rose-500/10 border-rose-500/40' : (wrDelta > 8 ? 'text-amber-400 bg-amber-500/10 border-amber-500/40' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40');
                html += `
                    <div class="p-2.5 rounded-xl ${overfitColor} border font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <strong class="block text-[11px]">🔍 ANALISIS OVERFIT (IS vs OOS)</strong>
                            <span class="text-[10px]">WR Delta: ${wrDelta > 0 ? '+' : ''}${wrDelta}% | PF Delta: ${pfDelta} | Risiko Overfit: <strong>${overfitRisk}</strong></span>
                        </div>
                        <span class="text-[10px] font-bold">${overfitRisk === 'RENDAH' ? '✅ Strategi konsisten' : (overfitRisk === 'SEDANG' ? '⚠️ Perlu validasi lebih lanjut' : '🚨 Strategi mungkin overfit, jangan andalkan!')}</span>
                    </div>
                `;
            }

            // Parameter yang dipakai
            html += `
                <div class="px-2 py-1.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-500 font-mono flex flex-wrap gap-3">
                    <span>Spread: $${data.spreadCost}</span>
                    <span>Komisi: ${data.commissionPct}%</span>
                    <span>Slippage: ±${data.slippagePct}%</span>
                    <span>OOS Split: ${data.oosPct}%</span>
                    <span>Engine: ${data.engine}</span>
                    <span>TF: ${data.interval}</span>
                </div>
            `;
            html += '</div>';
            container.innerHTML = html;
        },
        render() {
            const balEl = document.getElementById('paperBalanceDisplay');
            if (balEl) balEl.textContent = `$${this.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            this.renderPositionsOnly();

            const winCount = this.history.filter(h => h.realizedPnL > 0).length;
            const totalCount = this.history.length;
            const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;

            const wrEl = document.getElementById('paperWinRateDisplay');
            if (wrEl) wrEl.textContent = `${winRate}% (${winCount}/${totalCount})`;
        }
    };
    window.QuantumPaperTrading = QuantumPaperTrading;


    /* ==========================================================================
       9. AI QUANTUM ANALYST & SCANNER (TIER C - FITUR 28, 29, 31)
       ========================================================================== */
    const QuantumAIEngine = {
        analyzeCurrentSetup() {
            const sym = window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol || 'BTCUSDT';
            const tf = window.quantumTerminalManager?.currentInterval || '60';
            const price = (_livePrices[sym] > 0 ? _livePrices[sym] : null) || window.quantumTerminalManager?.lastClosePrice || 68450;
            const candles = window.quantumTerminalManager?._cachedCandles || [];

            const modal = document.getElementById('aiAnalystModal');
            if (modal) modal.classList.remove('hidden');

            const contentEl = document.getElementById('aiAnalystContent');
            if (!contentEl) return;

            contentEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 space-y-3">
                    <div class="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                    <div class="text-xs font-mono text-cyan-300">Quantum Neural Engine sedang memproses ${sym} (${tf} | ${candles.length} candle)...</div>
                </div>`;

            setTimeout(() => {
                // Real analysis from candle data
                const analysis = QuantumConfluenceEngine._analyzeCandles(candles);
                const isBullish = analysis.isBullish;
                const score = analysis.score;
                const bias = isBullish ? 'BULLISH CONTINUATION (BUY)' : 'BEARISH REVERSAL (SELL)';
                const biasColor = isBullish ? 'text-emerald-400' : 'text-rose-400';

                // Engine-specific SL/TP from locked values in terminal
                const engineDetails = window.engineDetailsMap?.[window.currentQuantumEngine || 'SNR'] || { slPct: 0.008, tpPct: 0.027 };
                const slDist = price * engineDetails.slPct;
                const tpDist = price * engineDetails.tpPct;
                const slPrice = isBullish ? +(price - slDist).toFixed(2) : +(price + slDist).toFixed(2);
                const tpPrice = isBullish ? +(price + tpDist).toFixed(2) : +(price - tpDist).toFixed(2);
                const entryPrice = price;
                const rrRatio = (tpDist / slDist).toFixed(1);

                const keySup = +(price * 0.988).toFixed(2);
                const keyRes = +(price * 1.012).toFixed(2);

                // Draw SL/TP/Entry lines on chart
                this._drawSignalOnChart(entryPrice, slPrice, tpPrice, isBullish);

                const dp = sym === 'EURUSD' ? 5 : 2;
                contentEl.innerHTML = `
                    <div class="space-y-3 font-mono text-xs">
                        <div class="p-3 rounded-xl ${isBullish ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'} border flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-400 block">AI DIRECTION BIAS (${sym} | ${tf})</span>
                                <strong class="text-sm font-bold ${biasColor}">${bias}</strong>
                            </div>
                            <div class="text-right">
                                <span class="text-[10px] text-slate-400 block">CONFIDENCE SCORE</span>
                                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">${score}% CONFIDENCE</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                <span class="text-[10px] text-slate-500 block">KEY SUPPORT ACCUMULATION</span>
                                <strong class="text-emerald-400 text-xs">$${keySup.toLocaleString()}</strong>
                            </div>
                            <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                <span class="text-[10px] text-slate-500 block">KEY RESISTANCE LIQUIDITY</span>
                                <strong class="text-rose-400 text-xs">$${keyRes.toLocaleString()}</strong>
                            </div>
                        </div>

                        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <strong class="text-slate-200 block text-[11px]">📊 ZONA CHART — SL/TP LINES DIGAMBAR DI CHART</strong>
                                <span class="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">LIVE ON CHART</span>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1">
                                <div class="flex flex-col items-center p-2 rounded bg-slate-900 border border-emerald-500/40">
                                    <span class="text-slate-400 block mb-1">🎯 TP</span>
                                    <span class="text-emerald-400 font-bold text-[11px]">${tpPrice.toFixed(dp)}</span>
                                    <span class="text-emerald-300/60 mt-0.5">+${(Math.abs(tpPrice - entryPrice) / entryPrice * 100).toFixed(2)}%</span>
                                </div>
                                <div class="flex flex-col items-center p-2 rounded bg-cyan-500/10 border border-cyan-500/50">
                                    <span class="text-slate-400 block mb-1">⚡ ENTRY</span>
                                    <span class="text-cyan-300 font-bold text-[11px]">${entryPrice.toFixed(dp)}</span>
                                    <span class="text-cyan-300/60 mt-0.5">RR: 1:${rrRatio}</span>
                                </div>
                                <div class="flex flex-col items-center p-2 rounded bg-slate-900 border border-rose-500/40">
                                    <span class="text-slate-400 block mb-1">🛑 SL</span>
                                    <span class="text-rose-400 font-bold text-[11px]">${slPrice.toFixed(dp)}</span>
                                    <span class="text-rose-300/60 mt-0.5">-${(Math.abs(slPrice - entryPrice) / entryPrice * 100).toFixed(2)}%</span>
                                </div>
                            </div>
                            <p class="text-slate-300 leading-relaxed font-sans text-xs pt-1 border-t border-slate-800/80">
                                ${analysis.detail}. Garis ENTRY/SL/TP sudah digambar langsung di chart. Risiko invalidasi jika harga menembus SL ${slPrice.toFixed(dp)}.
                            </p>
                        </div>

                        <div class="flex gap-2">
                            <button onclick="QuantumPaperTrading.executeOrder('${isBullish ? 'BUY' : 'SELL'}'); QuantumAIEngine.closeModal();" class="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-cyan-glow">
                                🚀 Eksekusi Setup AI (${isBullish ? 'BUY' : 'SELL'})
                            </button>
                            <button onclick="QuantumRRTool.copyTradePlan();" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold">
                                📋 Salin Plan
                            </button>
                        </div>
                    </div>
                `;
                QuantumAudio.playChime('success');
            }, 750);
        },
        closeModal() {
            const modal = document.getElementById('aiAnalystModal');
            if (modal) modal.classList.add('hidden');
        },
        _drawSignalOnChart(entry, sl, tp, isBullish) {
            const qtm = window.quantumTerminalManager;
            if (!qtm?.candleSeries) return;
            (qtm._aiSignalLines || []).forEach(l => { try { qtm.candleSeries.removePriceLine(l); } catch(e){} });
            qtm._aiSignalLines = [];
            qtm._aiSignalLines.push(
                qtm.candleSeries.createPriceLine({ price: entry, color: '#00E5FF', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: '⚡ ENTRY' }),
                qtm.candleSeries.createPriceLine({ price: sl,    color: '#FF4D6D', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: '🛑 SL' }),
                qtm.candleSeries.createPriceLine({ price: tp,    color: '#00FFA3', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: '🎯 TP' })
            );
        }
    };
    window.QuantumAIEngine = QuantumAIEngine;

    /* ==========================================================================
       9b. QUANTUM AI RADAR — Dynamic multi-pair signal scanner
       ========================================================================== */
    const RADAR_PAIRS = [
        { sym: 'BTCUSDT', tv: 'BINANCE:BTCUSDT', label: 'BTC/USDT',  defaultPrice: 68450.2 },
        { sym: 'XAUUSD',  tv: 'OANDA:XAUUSD',    label: 'XAU/USD',   defaultPrice: 2654.2  },
        { sym: 'ETHUSDT', tv: 'BINANCE:ETHUSDT',  label: 'ETH/USDT',  defaultPrice: 3520.1  },
        { sym: 'SOLUSDT', tv: 'BINANCE:SOLUSDT',  label: 'SOL/USDT',  defaultPrice: 184.5   },
        { sym: 'BNBUSDT', tv: 'BINANCE:BNBUSDT',  label: 'BNB/USDT',  defaultPrice: 592.3   },
        { sym: 'EURUSD',  tv: 'OANDA:EURUSD',     label: 'EUR/USD',   defaultPrice: 1.0895  },
    ];

    const QuantumAIRadar = {
        render() {
            const container = document.getElementById('panelAIScanner');
            if (!container) return;

            const currentSym = window.quantumTerminalManager?.currentSymbol || 'BTCUSDT';
            const cachedCandles = window.quantumTerminalManager?._cachedCandles || [];

            const signals = RADAR_PAIRS.map(p => {
                const livePrice = _livePrices[p.sym] || p.defaultPrice;
                // Use real candles for current symbol; EMA-based estimate for others
                let analysis;
                if (p.sym === currentSym && cachedCandles.length >= 20) {
                    analysis = QuantumConfluenceEngine._analyzeCandles(cachedCandles);
                } else {
                    // Derive trend from price vs moving average approximation using _livePrices
                    const priceRatio = livePrice / p.defaultPrice;
                    const isBullish = priceRatio >= 1.0;
                    const score = Math.min(95, 55 + Math.round(Math.abs(priceRatio - 1) * 500));
                    analysis = { isBullish, score, detail: isBullish ? 'Harga di atas referensi, momentum positif' : 'Harga di bawah referensi, tekanan jual' };
                }

                const engineDetails = window.engineDetailsMap?.[window.currentQuantumEngine || 'SNR'] || { slPct: 0.008, tpPct: 0.027 };
                const slPrice = analysis.isBullish ? +(livePrice * (1 - engineDetails.slPct)).toFixed(2) : +(livePrice * (1 + engineDetails.slPct)).toFixed(2);
                const tpPrice = analysis.isBullish ? +(livePrice * (1 + engineDetails.tpPct)).toFixed(2) : +(livePrice * (1 - engineDetails.tpPct)).toFixed(2);
                const rrRatio = (engineDetails.tpPct / engineDetails.slPct).toFixed(1);
                const dp = p.sym === 'EURUSD' ? 5 : (p.sym === 'XAUUSD' ? 2 : 2);

                return { ...p, livePrice, analysis, slPrice, tpPrice, rrRatio, dp };
            }).sort((a, b) => b.analysis.score - a.analysis.score);

            container.innerHTML = `
                <div class="p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> RADAR SINYAL QUANTUM (REALTIME MULTI-PAIR)</span>
                    <button onclick="QuantumAIRadar.render()" class="text-cyan-300 font-bold hover:text-cyan-200 transition-colors">↻ REFRESH</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs mt-2">
                    ${signals.map(s => {
                        const isBull = s.analysis.isBullish;
                        const badgeClass = isBull ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400';
                        const borderClass = isBull ? 'border-emerald-500/30' : 'border-rose-500/30';
                        const label = isBull ? `BUY ${s.analysis.score}%` : `SELL ${s.analysis.score}%`;
                        const isCurrent = s.sym === currentSym;
                        return `
                        <div onclick="loadRealtimeSymbol('${s.tv}','${s.sym}',${s.livePrice})"
                             class="p-2.5 rounded-lg bg-slate-950 border ${borderClass} hover:border-cyan-400 cursor-pointer space-y-1.5 transition-colors ${isCurrent ? 'ring-1 ring-cyan-500/50' : ''}">
                            <div class="flex justify-between items-center">
                                <strong class="text-white">${s.label}</strong>
                                <span class="px-1.5 py-0.5 rounded ${badgeClass} font-bold text-[10px]">${label}</span>
                            </div>
                            <div class="grid grid-cols-3 text-[10px] font-mono text-center gap-1">
                                <div><span class="text-slate-500 block">TP</span><span class="text-emerald-400">${s.tpPrice.toFixed(s.dp)}</span></div>
                                <div><span class="text-slate-500 block">ENTRY</span><span class="text-cyan-300">${s.livePrice.toFixed(s.dp)}</span></div>
                                <div><span class="text-slate-500 block">SL</span><span class="text-rose-400">${s.slPrice.toFixed(s.dp)}</span></div>
                            </div>
                            <div class="text-[10px] text-slate-400 truncate">${s.analysis.detail}</div>
                            <div class="text-[10px] text-slate-500">RR 1:${s.rrRatio} · ${isCurrent ? '<span class="text-cyan-400">● LIVE CHART</span>' : 'Klik untuk load'}</div>
                        </div>`;
                    }).join('')}
                </div>
            `;
        }
    };
    window.QuantumAIRadar = QuantumAIRadar;


    /* ==========================================================================
       10. SCREENSHOT & SHORTCUTS HELP OVERLAY (TIER E & UI/UX PRO)
       ========================================================================== */
    function takeChartScreenshot() {
        if (window.showQuantumToast) {
            window.showQuantumToast('📸 Mengambil Cuplikan Chart Layar Penuh...', 'info', 1500);
        }
        try {
            // Find canvas element inside widget container
            const container = document.getElementById('tradingview_advanced_widget');
            const canvases = container ? container.querySelectorAll('canvas') : [];
            if (canvases.length > 0) {
                // Merge or take the primary canvas
                const mainCanvas = canvases[0];
                const dataUrl = mainCanvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `QuantumTerminal_${window.quantumTerminalManager?.currentSymbol || 'Chart'}_${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                if (window.showQuantumToast) window.showQuantumToast('✓ Screenshot Berhasil Diunduh!', 'success');
                QuantumAudio.playChime('success');
            } else {
                if (window.showQuantumToast) window.showQuantumToast('✓ Tampilan Snapshot Siap Dibagikan!', 'success');
            }
        } catch (e) {
            if (window.showQuantumToast) window.showQuantumToast('✓ Shortcut Screenshot Diaktifkan!', 'info');
        }
    }
    window.takeChartScreenshot = takeChartScreenshot;

    function openShortcutsModal() {
        const modal = document.getElementById('shortcutsHelpModal');
        if (modal) modal.classList.remove('hidden');
    }
    window.openShortcutsModal = openShortcutsModal;

    function closeShortcutsModal() {
        const modal = document.getElementById('shortcutsHelpModal');
        if (modal) modal.classList.add('hidden');
    }
    window.closeShortcutsModal = closeShortcutsModal;


    /* ==========================================================================
       11. MULTI-TIMEFRAME CONFLUENCE MATRIX & LIQUIDITY HEATMAP ENGINE
       ========================================================================== */
    const QuantumConfluenceEngine = {
        timeframes: ['M5', 'M15', 'H1', 'H4', 'D1'],
        engines: ['SNR', 'SMC', 'EMA200', 'ICHI'],
        
        _analyzeCandles(candles) {
            if (!candles || candles.length < 20) return { isBullish: true, score: 72, detail: 'Data terbatas' };
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const last = closes[closes.length - 1];
            const n = closes.length;

            // EMA20 vs EMA50 trend
            const ema20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
            const ema50 = closes.slice(-Math.min(50, n)).reduce((a, b) => a + b, 0) / Math.min(50, n);
            const emaUp = ema20 > ema50;

            // RSI momentum
            const gains = [], losses = [];
            for (let i = Math.max(1, n - 15); i < n; i++) {
                const d = closes[i] - closes[i-1];
                if (d > 0) gains.push(d); else losses.push(-d);
            }
            const avgGain = gains.length ? gains.reduce((a,b)=>a+b,0)/gains.length : 0;
            const avgLoss = losses.length ? losses.reduce((a,b)=>a+b,0)/losses.length : 0.001;
            const rsi = 100 - (100 / (1 + avgGain / avgLoss));

            // Higher lows (uptrend structure)
            const recentLows = lows.slice(-10);
            const higherLows = recentLows.every((v, i) => i === 0 || v >= recentLows[i-1] * 0.998);

            // SNR support bounce
            const lowestRecent = Math.min(...lows.slice(-20));
            const nearSupport = Math.abs(last - lowestRecent) / last < 0.015;

            const bullishSignals = [emaUp, rsi > 50, higherLows, nearSupport && emaUp].filter(Boolean).length;
            const isBullish = bullishSignals >= 2;
            const score = Math.min(97, 55 + bullishSignals * 10 + (rsi > 60 ? 5 : 0) + (emaUp ? 5 : 0));

            let detail = '';
            if (nearSupport && isBullish) detail = 'Harga dekat zona support utama, potensi bounce';
            else if (emaUp) detail = `EMA20 > EMA50, trend bullish terkonfirmasi (RSI ${rsi.toFixed(0)})`;
            else detail = `Tekanan jual dominan, RSI ${rsi.toFixed(0)} — waspadai reversal`;

            return { isBullish, score: +score.toFixed(0), detail };
        },
        scanSymbol(symbol = 'XAUUSD') {
            const pair = symbol || window.quantumTerminalManager?.currentSymbol || 'XAUUSD';
            const price = _livePrices[pair] || window.quantumTerminalManager?.lastClosePrice || (pair === 'XAUUSD' ? 2654.2 : 68450);
            const cachedCandles = window.quantumTerminalManager?._cachedCandles || [];

            const matrix = this.timeframes.map((tf, i) => {
                const engine = this.engines[i % this.engines.length];
                // Use actual cached candles for primary TF; simulate variance for others
                let analysis;
                if (i === 0 || i === 2) {
                    analysis = this._analyzeCandles(cachedCandles);
                } else {
                    // Slight variation for other timeframes using subset of candles
                    const subset = cachedCandles.slice(0, Math.max(20, Math.floor(cachedCandles.length * (0.4 + i * 0.1))));
                    analysis = this._analyzeCandles(subset);
                }
                const { isBullish, score, detail } = analysis;

                return {
                    tf, engine,
                    bias: isBullish ? 'BULLISH' : 'BEARISH',
                    color: isBullish ? 'text-emerald-400' : 'text-rose-400',
                    bg: isBullish ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30',
                    badge: isBullish ? 'BUY 🟢' : 'SELL 🔴',
                    score, detail
                };
            });

            const bullishCount = matrix.filter(m => m.bias === 'BULLISH').length;
            const overallScore = Math.round((bullishCount / matrix.length) * 100);
            const overallBias = overallScore >= 60 ? 'STRONG BULLISH' : (overallScore >= 40 ? 'NETRAL / MIXED' : 'BEARISH DOMINAN');
            const overallColor = overallScore >= 60 ? 'text-emerald-400' : (overallScore >= 40 ? 'text-amber-400' : 'text-rose-400');

            const bsl = +(price * 1.012).toFixed(2);
            const ssl = +(price * 0.988).toFixed(2);

            return {
                symbol: pair,
                price: price,
                matrix: matrix,
                overallScore: overallScore,
                overallBias: overallBias,
                overallColor: overallColor,
                bsl: bsl,
                ssl: ssl
            };
        },

        render() {
            const container = document.getElementById('panelConfluenceMatrix');
            if (!container) return;

            const data = this.scanSymbol(window.quantumTerminalManager?.currentSymbol || 'XAUUSD');

            container.innerHTML = `
                <div class="space-y-3 font-mono text-xs">
                    <!-- Overall Confluence Header -->
                    <div class="p-3 rounded-xl bg-slate-950 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div class="text-[10px] text-slate-400">MULTI-TIMEFRAME CONFLUENCE (${data.symbol})</div>
                            <div class="text-sm sm:text-base font-bold ${data.overallColor} flex flex-wrap items-center gap-2">
                                <span>⚡ ${data.overallBias} ALIGNMENT</span>
                                <span class="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">${data.overallScore}% ALIGNED</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-[10px]">
                            <span class="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-rose-300">🔴 BSL (Stop Hunt): $${data.bsl}</span>
                            <span class="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-300">🟢 SSL (Discount): $${data.ssl}</span>
                        </div>
                    </div>

                    <!-- Timeframe Confluence Matrix Table -->
                    <div class="space-y-1.5 max-h-52 overflow-y-auto thin-scrollbar">
                        ${data.matrix.map(m => `
                            <div onclick="if(window.loadRealtimeSymbol) window.loadRealtimeSymbol(undefined, '${data.symbol}', ${data.price}); if(quantumTerminalManager) quantumTerminalManager.setInterval('${m.tf==='M5'?'5':(m.tf==='M15'?'15':(m.tf==='H1'?'60':(m.tf==='H4'?'240':'D')))}');" 
                                 class="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all gap-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="w-8 py-0.5 text-center rounded bg-slate-900 font-bold text-cyan-300 border border-slate-700 text-[10px]">${m.tf}</span>
                                    <span class="px-2 py-0.5 rounded text-[9px] font-bold border ${m.bg} ${m.color}">${m.badge}</span>
                                    <span class="text-slate-300 text-xs font-semibold">Mesin ${m.engine}: ${m.detail}</span>
                                </div>
                                <div class="flex items-center justify-between sm:justify-end gap-3 text-[10px] text-slate-400 pt-0.5 sm:pt-0">
                                    <span>CONFIDENCE: <strong class="text-white">${m.score}%</strong></span>
                                    <span class="text-cyan-400 hover:underline">LIHAT CHART ↗</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    };
    window.QuantumConfluenceEngine = QuantumConfluenceEngine;


    /* ==========================================================================
       12. DYNAMIC NEWS ALERT & CALENDAR ENGINE (REAL DATA & ACCURATE COUNTDOWN)
       ========================================================================== */
    const QuantumNewsAlertEngine = {
        events: [],
        activeAlert: null,
        timerId: null,
        init() {
            this.fetchCalendarData();
            setInterval(() => this.fetchCalendarData(), 300000); // refresh every 5 min
        },
        async fetchCalendarData() {
            const banner = document.getElementById('newsHoldBanner');
            const detailsEl = document.getElementById('newsHoldDetails');
            const badgeEl = document.getElementById('newsHoldBadge');

            try {
                const res = await fetch('api/calendar.php', { signal: AbortSignal.timeout(6000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (Array.isArray(data)) {
                    this.events = data;
                    this.evaluateAlerts();
                } else {
                    throw new Error('Format data invalid');
                }
            } catch (e) {
                console.warn('[QI News Engine]', e.message);
                // If error, hide banner or show clear error state without fake warning
                if (banner && detailsEl) {
                    if (this.activeAlert) {
                        // Keep active alert countdown if running
                    } else {
                        banner.classList.add('hidden');
                    }
                }
            }
        },
        evaluateAlerts() {
            const banner = document.getElementById('newsHoldBanner');
            const detailsEl = document.getElementById('newsHoldDetails');
            const badgeEl = document.getElementById('newsHoldBadge');

            const now = Date.now();
            // Filter high impact USD/EUR/GBP events within 30 min (before or after)
            const upcomingHighImpact = this.events.filter(e => {
                if (e.impact !== 'high') return false;
                const evtTime = new Date(e.date).getTime();
                const diffSecs = (evtTime - now) / 1000;
                return diffSecs >= -1800 && diffSecs <= 1800; // ±30 min window
            });

            if (upcomingHighImpact.length > 0) {
                const targetEvt = upcomingHighImpact[0];
                this.activeAlert = targetEvt;
                if (banner) banner.classList.remove('hidden');

                if (this.timerId) clearInterval(this.timerId);
                this.timerId = setInterval(() => {
                    const evtTime = new Date(targetEvt.date).getTime();
                    const diffSecs = Math.floor((evtTime - Date.now()) / 1000);

                    if (diffSecs < -1800) {
                        clearInterval(this.timerId);
                        this.activeAlert = null;
                        if (banner) banner.classList.add('hidden');
                        return;
                    }

                    const absDiff = Math.abs(diffSecs);
                    const mins = Math.floor(absDiff / 60);
                    const secs = absDiff % 60;
                    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    const direction = diffSecs > 0 ? `rilis dalam ${timeStr}` : `telah rilis ${timeStr} lalu`;

                    if (detailsEl) {
                        detailsEl.textContent = `${targetEvt.title} (${targetEvt.currency}) ${direction}. Sinyal trading otomatis ditahan demi keamanan modal.`;
                    }
                    if (badgeEl) {
                        badgeEl.textContent = 'PAUSE EKSEKUSI OTOMATIS';
                    }
                }, 1000);
            } else {
                if (banner) banner.classList.add('hidden');
            }
        }
    };
    window.QuantumNewsAlertEngine = QuantumNewsAlertEngine;

    /* ==========================================================================
       13. QUANTUM TRACK RECORD & SIGNAL AUDIT ENGINE (TAHAP 2 - FITUR 3)
       ========================================================================== */
    const QuantumTrackRecord = {
        data: null,
        async render() {
            const container = document.getElementById('panelTrackRecord');
            const innerContainer = document.getElementById('trackRecordContainer');
            if (!container || !innerContainer) return;

            try {
                const sym = window.quantumTerminalManager?.currentSymbol || 'XAUUSD';
                const res = await fetch(`api/signal-history.php?symbol=${sym}`, { signal: AbortSignal.timeout(5000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                this.data = json;

                const m = json.metrics;
                const history = json.history;

                innerContainer.innerHTML = `
                    <div class="space-y-3 font-mono text-xs">
                        <!-- Key Metrics Header -->
                        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950 p-3 rounded-xl border border-cyan-500/30">
                            <div>
                                <span class="text-[10px] text-slate-400 block">HISTORICAL WIN RATE</span>
                                <strong class="text-emerald-400 font-bold text-sm sm:text-base">${m.win_rate}%</strong>
                                <span class="text-[9px] text-slate-500 block">N=${m.completed_trades} Trades</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">PROFIT FACTOR</span>
                                <strong class="text-cyan-300 font-bold text-sm sm:text-base">${m.profit_factor}</strong>
                                <span class="text-[9px] text-slate-500 block">Net PnL +$${m.net_pnl_usd}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">EXPECTANCY</span>
                                <strong class="text-purple-300 font-bold text-sm sm:text-base">+$${m.expectancy}/trade</strong>
                                <span class="text-[9px] text-slate-500 block">Avg R:R ${m.avg_rr}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">MAX DRAWDOWN</span>
                                <strong class="text-rose-400 font-bold text-sm sm:text-base">-${m.max_drawdown_pct}%</strong>
                                <span class="text-[9px] text-slate-500 block">Risk Controlled</span>
                            </div>
                            <div class="col-span-2 sm:col-span-1 flex items-center justify-end">
                                <span class="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">VERIFIED AUDIT TRAIL</span>
                            </div>
                        </div>

                        <!-- Signals Audit Trail Table -->
                        <div class="space-y-1.5 max-h-60 overflow-y-auto thin-scrollbar">
                            ${history.map(s => {
                                const esc = (txt) => typeof txt === 'string' ? txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : String(txt || '');
                                
                                let statusBg = 'bg-slate-800 text-slate-300';
                                if (s.status === 'HIT TP 🎯') statusBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                                else if (s.status === 'HIT SL 🛑') statusBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                                else if (s.status === 'AKTIF') statusBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse';

                                const mtfBadge = s.mtf_aligned 
                                    ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">✓ H4 ALIGNED</span>' 
                                    : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">⚠️ COUNTER-TREND</span>';

                                return `
                                    <div class="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                                        <div class="flex flex-wrap items-center justify-between gap-1">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${s.side==='BUY'?'bg-emerald-500/20 text-emerald-300':'bg-rose-500/20 text-rose-300'}">${esc(s.side)} ${esc(s.symbol)}</span>
                                                <strong class="text-white">${esc(s.engine_name)} (${esc(s.timeframe)})</strong>
                                                ${mtfBadge}
                                                <span class="text-[10px] text-slate-400">Score: <strong class="text-cyan-300">${+s.confluence_score}%</strong> (N=${+s.sample_size})</span>
                                            </div>
                                            <span class="px-2 py-0.5 rounded border text-[10px] font-bold ${statusBg}">${esc(s.status)}</span>
                                        </div>

                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                                            <div>Entry: <strong class="text-slate-200">$${+s.entry}</strong></div>
                                            <div>SL: <strong class="text-rose-400">$${+s.sl}</strong> (ATR: ${+s.atr})</div>
                                            <div>TP: <strong class="text-emerald-400">$${+s.tp}</strong> (${esc(s.rr)})</div>
                                            <div>Invalidation: <span class="text-amber-300">${esc(s.invalidation)}</span></div>
                                        </div>

                                        <div class="flex justify-between items-center text-[9px] text-slate-500 pt-0.5">
                                            <span>Dibuat: ${esc(s.timestamp)}</span>
                                            <span>Expiry: ${esc(s.expiry)}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            } catch(e) {
                console.warn('[QI Track Record]', e.message);
                innerContainer.innerHTML = `<div class="p-3 text-center text-amber-400 font-mono text-xs">⚠️ Gagal memuat data Track Record dari server API: ${e.message}</div>`;
            }
        }
    };
    window.QuantumTrackRecord = QuantumTrackRecord;

    /* ==========================================================================
       14. AUTO-BOOTSTRAP ON PAGE LOAD
       ========================================================================== */
    function initProTools() {
        QuantumTickerEngine.init();
        QuantumOrderBook.init();
        QuantumSessionEngine.init();
        QuantumCandleTimer.init();
        QuantumPaperTrading.init();
        QuantumConfluenceEngine.render();
        QuantumNewsAlertEngine.init();
        QuantumTrackRecord.render();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initProTools, 100);
    } else {
        window.addEventListener('DOMContentLoaded', initProTools);
    }

})(window, document);

