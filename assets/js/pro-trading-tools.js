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
                    <div data-qi-aksi="QuantumTickerEngine.handleClick" data-qi-arg="${QIAksi.arg(String(item.sym), String(item.tvSym), Number(item.price))}"
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
            // WebSocket Binance diblok di beberapa region — QuantumPricePoller digunakan sebagai gantinya
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
    // Catatan: daftar ALL_POLL_SYMBOLS DIHAPUS karena sudah tidak dipakai.
    // Poller kini meminta SATU simbol (yang sedang tampil di chart) agar permintaan
    // cepat dan siklus 3 detik tidak terlewat; papan ticker & harga pasar diperbarui
    // oleh fetchMarketData (15 detik) di dashboard-app.js.

    const QuantumPricePoller = {
        _timer: null,
        _consecutiveFails: 0,
        _interval: 3000,
        _polling: false,

        /** Kunci simbol yang sedang tampil di chart (mis. 'XAUUSD' untuk OANDA:XAUUSD). */
        _kunciAktif() {
            try {
                if (typeof _tvSymbol !== 'undefined' && typeof WL_GROUPS !== 'undefined') {
                    const c = WL_GROUPS.flatMap(g => g.syms).find(s => s.tv === _tvSymbol);
                    if (c && c.key) return c.key;
                }
            } catch (e) {}
            return window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol || 'BTCUSDT';
        },

        start() {
            this.poll();
            this._timer = setInterval(() => this.poll(), this._interval);
        },

        async poll() {
            if (this._polling) return;
            this._polling = true;
            try {
                // ── SIMBOL AKTIF SAJA ────────────────────────────────────────────
                // Sebelumnya di sini diminta SELURUH daftar simbol (13 instrumen).
                // Akibatnya satu permintaan butuh lebih dari 3 detik, siklus berikutnya
                // terlewat (_polling guard), dan chart bisa "diam" 10–20 detik.
                // Yang benar-benar membutuhkan kecepatan 3 detik adalah CHART YANG
                // SEDANG DILIHAT; papan ticker & harga pasar sudah diperbarui
                // fetchMarketData setiap 15 detik. Jadi poller fokus ke satu simbol.
                const simbolAktif = this._kunciAktif();
                const res = await fetch(`api/live-price.php?symbols=${encodeURIComponent(simbolAktif)}`, { cache: 'no-store' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const json = await res.json();
                if (json.status !== 'success' || !json.prices) throw new Error('bad response');

                this._consecutiveFails = 0;
                this._updateStatusUI('LIVE');

                const prices = json.prices;
                const currentSym = window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol || 'BTCUSDT';

                // Update _livePrices for all symbols
                for (const [sym, data] of Object.entries(prices)) {
                    if (!data || data.price == null || isNaN(data.price)) continue;
                    if (window._livePrices) window._livePrices[sym] = data.price;
                    // ── PENTING: teruskan tick ini ke mesin chart ──
                    // Sebelumnya poller ini HANYA memperbarui _livePrices/ticker/header dan
                    // TIDAK PERNAH memanggil qiRealtimeTick(). Akibatnya candle terakhir di
                    // chart kripto ikut bergerak (lewat WebSocket Binance) tetapi chart
                    // EMAS & FOREX (XAUUSD/EURUSD/GBPUSD/USDJPY) TIDAK PERNAH bergerak —
                    // karena simbol-simbol itu tidak ada di Binance, sehingga qiRealtimeTick
                    // tidak pernah dipanggil. Inilah sebab chart terlihat "diam".
                    // qiRealtimeTick sudah punya pengaman sendiri: throttle 4×/detik,
                    // tidak menimpa candle saat kursor hover, dan hanya untuk simbol aktif.
                    if (typeof window.qiRealtimeTick === 'function') {
                        try { window.qiRealtimeTick(sym, Number(data.price), { source: data.source, spread: data.spread }); } catch (e) {}
                    }
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

                // Update ticker last-time stamp
                const now = new Date();
                const timeEl = document.getElementById('tickerLastTime');
                if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

            } catch(e) {
                this._consecutiveFails++;
                if (this._consecutiveFails >= 3) this._updateStatusUI('DELAYED');
            } finally {
                this._polling = false;
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


    /* ==========================================================================
       4. POSITION SIZE & RISK CALCULATOR (TIER S - FITUR 5)


    /* ==========================================================================
       5. RISK REWARD TOOL & TRADE PLAN COPY (TIER S - FITUR 6 & TIER E)


    /* ==========================================================================
       6. SESSION HIGHLIGHT & TIMEZONE ENGINE (TIER S - FITUR 7 & TIER E)
       ========================================================================== */
    const QuantumSessionEngine = {
        currentTz: 'WIB',
        _timer: null,
        init() {
            if (this._timer) clearInterval(this._timer);
            this.update();
            this._timer = setInterval(() => this.update(), 1000);
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
        _timer: null,
        init() {
            if (this._timer) clearInterval(this._timer);
            this._timer = setInterval(() => this.tick(), 1000);
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
    // Cache harga live — hanya diisi saat data NYATA datang (poller / chart engine).
    // Sengaja dikosongkan: sebelumnya diisi harga hardcoded (XAUUSD 2654, BTCUSDT 68450)
    // yang lalu tampil seolah harga terkini padahal sudah jauh usang.
    const _livePrices = {};
    window._livePrices = _livePrices;

    // ── MESIN PAPER TRADING KEDUA SUDAH DIHAPUS ───────────────────────────
    // Dulu di sini ada objek paper trading kedua (±740 baris): dompet simulasi dengan saldo,
    // posisi dan riwayatnya sendiri di localStorage 'QI_PAPER_TRADING'. Seluruh elemen DOM-nya
    // (paperTradePairSelect, paperPositionsTable, paperBalanceDisplay, paperWinRateDisplay, …)
    // sudah tidak ada di dashboard.html, jadi ia tidak pernah terlihat — tetapi masih berjalan
    // tiap halaman dimuat, menyimpan state terpisah, dan masih bisa membuka/menutup posisi
    // lewat tombol "Eksekusi Setup AI".
    //
    // Satu-satunya mesin paper trading sekarang ada di assets/js/dashboard-app.js (panel Paper
    // Trading) dan menyimpan ke server lewat api/paper-trading.php. Yang tersisa di bawah
    // hanyalah jembatan untuk tombol "Eksekusi Setup AI".

    /**
     * Membuka posisi dari modal analisa AI ke mesin paper trading YANG SEBENARNYA.
     * SL/TP dihitung dari ATR TradingView (H1) — SL 1,2×ATR, TP 2,5× jarak SL — sama seperti
     * panel Rencana Live. Bila ATR belum ada, posisi TIDAK dibuka supaya levelnya tidak dikarang.
     */
    function eksekusiSetupKeSimulasi(side) {
        const sym = window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol || 'XAUUSD';
        if (window.quantumTerminalManager?.currentSymbol === sym && window.quantumTerminalManager?.lastClosePrice > 0) {
            _livePrices[sym] = window.quantumTerminalManager.lastClosePrice;
        }
        // SL/TP diukur dari harga SISI order yang segar (ask untuk BUY, bid untuk SELL — dashboard-app.js),
        // karena di harga itulah server mengeksekusinya; harga penutupan candle hanya cadangan.
        const hargaSisi = typeof window.ptHargaNilai === 'function' ? window.ptHargaNilai(sym, side === 'BUY') : null;
        const price = hargaSisi || _livePrices[sym] || 0;
        if (!(price > 0)) {
            if (window.showQuantumToast) window.showQuantumToast(`Harga live ${sym} belum tersedia — posisi tidak dibuka.`, 'warning');
            return;
        }
        const atr = Number((window._qiAtrTerakhir && window._qiAtrTerakhir[sym]) || 0);
        if (!(atr > 0)) {
            if (window.showQuantumToast) window.showQuantumToast(`ATR TradingView untuk ${sym} belum tersedia — posisi tidak dibuka supaya SL/TP tidak dikarang. Buka panel Rencana Live lebih dulu.`, 'warning');
            return;
        }
        const isLong = side === 'BUY';
        const slDist = 1.2 * atr;
        const tpDist = 2.5 * slDist;
        const sl = isLong ? +(price - slDist).toFixed(5) : +(price + slDist).toFixed(5);
        const tp = isLong ? +(price + tpDist).toFixed(5) : +(price - tpDist).toFixed(5);
        const lots = sym === 'XAUUSD' ? 0.5 : (sym === 'BTCUSDT' ? 0.1 : 1.0);
        if (typeof window.ptOpenDirectPosition !== 'function') {
            if (window.showQuantumToast) window.showQuantumToast('Panel Paper Trading belum siap.', 'warning');
            return;
        }
        // Order PASAR: entry = null → batas requote = harga sisi saat order dikirim. Harga di sini bisa
        // berasal dari candle (lastClosePrice) yang tidak pernah tampil sebagai harga order; dulu dikirim
        // sebagai "harga layar" dan memicu requote dengan angka yang tidak pernah dilihat pengguna.
        window.ptOpenDirectPosition(sym, side, null, sl, tp, lots, 'sinyal');
    }


    /* ==========================================================================
       9. AI QUANTUM ANALYST & SCANNER (TIER C - FITUR 28, 29, 31)
       ========================================================================== */
    const QuantumAIEngine = {
        analyzeCurrentSetup() {
            const sym = window.quantumTerminalManager?.currentSymbol || window.currentCleanSymbol || 'BTCUSDT';
            const tf = window.quantumTerminalManager?.currentInterval || '60';
            const price = (_livePrices[sym] > 0 ? _livePrices[sym] : null) || window.quantumTerminalManager?.lastClosePrice || 0;
            const candles = window.quantumTerminalManager?._cachedCandles || [];

            const modal = document.getElementById('aiAnalystModal');
            if (modal) modal.classList.remove('hidden');

            const contentEl = document.getElementById('aiAnalystContent');
            if (!contentEl) return;

            if (!price || price <= 0) {
                contentEl.innerHTML = '<div class="p-4 text-[11px] text-amber-300">Data harga live belum tersedia — analisa ditahan agar tidak memakai harga tebakan.</div>';
                return;
            }

            contentEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 space-y-3">
                    <div class="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                    <div class="text-xs font-mono text-cyan-300">Quantum Neural Engine sedang memproses ${sym} (${tf} | ${candles.length} candle)...</div>
                </div>`;

            setTimeout(() => {
                // Real analysis from candle data
                const analysis = QuantumConfluenceEngine._analyzeCandles(candles);
                // Analisa yang DITAHAN (data candle kurang) tidak boleh ditampilkan sebagai
                // sinyal. Dulu cabang itu menghasilkan "BUY 72% confidence" tanpa data.
                if (!analysis || analysis.score === null || analysis.isBullish === null || analysis.isBullish === undefined) {
                    contentEl.innerHTML = `<div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-200 font-mono">
                        ${analysis && analysis.detail ? analysis.detail : 'Analisa belum bisa dihitung.'}
                    </div>`;
                    return;
                }
                const isBullish = analysis.isBullish;
                const score = analysis.score;
                const bias = isBullish ? 'BULLISH CONTINUATION (BUY)' : 'BEARISH REVERSAL (SELL)';
                const biasColor = isBullish ? 'text-emerald-400' : 'text-rose-400';

                // ── LEVEL WAJIB DARI ATR NYATA ─────────────────────────────────────
                // PERBAIKAN (2026-10-13): sebelumnya SL/TP memakai persentase TETAP
                // (slPct 0,8% · tpPct 2,7%) dan "key support/resistance" dari 0,988/1,012 ×
                // harga. `window.engineDetailsMap` bahkan TIDAK PERNAH didefinisikan, sehingga
                // fallback persentase itu SELALU terpakai → level 100% karangan.
                // Sekarang: bila ATR nyata tersedia (TradingView, mis. disimpan di
                // window._qiAtrTerakhir[sym]) level dihitung dari ATR; bila TIDAK tersedia,
                // level TIDAK ditampilkan sama sekali (hanya arah & skor dari candle nyata)
                // dan tombol eksekusi dinonaktifkan agar tidak ada posisi dari level karangan.
                const atrNyata = Number((window._qiAtrTerakhir && window._qiAtrTerakhir[sym]) || analysis.atr || 0);
                const slDist = atrNyata > 0 ? 1.2 * atrNyata : null;
                const tpDist = slDist !== null ? 2.5 * slDist : null;
                const entryPrice = price;
                const slPrice = (slDist !== null) ? +((isBullish ? entryPrice - slDist : entryPrice + slDist)).toFixed(5) : null;
                const tpPrice = (tpDist !== null) ? +((isBullish ? entryPrice + tpDist : entryPrice - tpDist)).toFixed(5) : null;
                const rrRatio = (slDist !== null) ? '2.5' : null;

                // Level kunci memakai S/R NYATA dari candle (bukan 0,988/1,012 × harga).
                const keySup = (analysis.lowest20 > 0) ? +analysis.lowest20.toFixed(5) : null;
                const keyRes = (analysis.highest20 > 0) ? +analysis.highest20.toFixed(5) : null;

                // Draw SL/TP/Entry lines on chart — hanya bila levelnya benar-benar ada.
                if (slPrice !== null && tpPrice !== null) {
                    this._drawSignalOnChart(entryPrice, slPrice, tpPrice, isBullish);
                }

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
                                <span class="text-[10px] text-slate-500 block">KEY SUPPORT (dari candle nyata)</span>
                                <strong class="text-emerald-400 text-xs">${keySup !== null ? '$' + keySup.toLocaleString() : '—'}</strong>
                            </div>
                            <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                <span class="text-[10px] text-slate-500 block">KEY RESISTANCE (dari candle nyata)</span>
                                <strong class="text-rose-400 text-xs">${keyRes !== null ? '$' + keyRes.toLocaleString() : '—'}</strong>
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
                                    <span class="text-emerald-400 font-bold text-[11px]">${tpPrice !== null ? tpPrice.toFixed(dp) : '—'}</span>
                                    <span class="text-emerald-300/60 mt-0.5">${tpPrice !== null ? '+' + (Math.abs(tpPrice - entryPrice) / entryPrice * 100).toFixed(2) + '%' : 'menunggu ATR'}</span>
                                </div>
                                <div class="flex flex-col items-center p-2 rounded bg-cyan-500/10 border border-cyan-500/50">
                                    <span class="text-slate-400 block mb-1">⚡ ENTRY</span>
                                    <span class="text-cyan-300 font-bold text-[11px]">${entryPrice.toFixed(dp)}</span>
                                    <span class="text-cyan-300/60 mt-0.5">RR: ${rrRatio !== null ? '1:' + rrRatio : '—'}</span>
                                </div>
                                <div class="flex flex-col items-center p-2 rounded bg-slate-900 border border-rose-500/40">
                                    <span class="text-slate-400 block mb-1">🛑 SL</span>
                                    <span class="text-rose-400 font-bold text-[11px]">${slPrice !== null ? slPrice.toFixed(dp) : '—'}</span>
                                    <span class="text-rose-300/60 mt-0.5">${slPrice !== null ? '-' + (Math.abs(slPrice - entryPrice) / entryPrice * 100).toFixed(2) + '%' : 'menunggu ATR'}</span>
                                </div>
                            </div>
                            <p class="text-slate-300 leading-relaxed font-sans text-xs pt-1 border-t border-slate-800/80">
                                ${analysis.detail}.${slPrice !== null
                                    ? ' Garis ENTRY/SL/TP sudah digambar langsung di chart. Risiko invalidasi jika harga menembus SL ' + slPrice.toFixed(dp) + '.'
                                    : ' Level SL/TP TIDAK ditampilkan karena ATR nyata (TradingView) belum tersedia — level tidak dikarang. Arah dan skor di atas dihitung dari candle nyata.'}
                            </p>
                        </div>

                        <div class="flex gap-2">
                            ${slPrice !== null
                                ? `<button data-qi-aksi="eksekusiSetupAi" data-qi-arg="${QIAksi.arg(isBullish ? 'BUY' : 'SELL')}" class="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-cyan-glow">
                                🚀 Eksekusi Setup AI (${isBullish ? 'BUY' : 'SELL'})
                            </button>`
                                : `<button disabled title="Level SL/TP belum tersedia (ATR TradingView belum ada), jadi eksekusi diblokir agar tidak ada posisi dari level karangan."
                                class="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-500 font-bold cursor-not-allowed">
                                ⛔ Eksekusi diblokir — SL/TP belum tersedia
                            </button>`}
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
    // Tombol "Eksekusi Setup AI" di modal analisa (data-qi-aksi): buka order lalu tutup modal.
    QIAksi.daftar({
        eksekusiSetupAi(el, e, arah) { eksekusiSetupKeSimulasi(arah); QuantumAIEngine.closeModal(); }
    });

    /* ==========================================================================
       9b. QUANTUM AI RADAR — Dynamic multi-pair signal scanner
       ========================================================================== */
    const RADAR_PAIRS = [
        { sym: 'BTCUSDT', tv: 'BINANCE:BTCUSDT', label: 'BTC/USDT' },
        { sym: 'XAUUSD',  tv: 'OANDA:XAUUSD',    label: 'XAU/USD'  },
        { sym: 'ETHUSDT', tv: 'BINANCE:ETHUSDT',  label: 'ETH/USDT'  },
        { sym: 'SOLUSDT', tv: 'BINANCE:SOLUSDT',  label: 'SOL/USDT'   },
        { sym: 'BNBUSDT', tv: 'BINANCE:BNBUSDT',  label: 'BNB/USDT'   },
        { sym: 'EURUSD',  tv: 'OANDA:EURUSD',     label: 'EUR/USD'  },
    ];


    /* ==========================================================================
       10. SCREENSHOT & SHORTCUTS HELP OVERLAY (TIER E & UI/UX PRO)
       ========================================================================== */
    function takeChartScreenshot() {
        if (window.showQuantumToast) {
            window.showQuantumToast('📸 Mengambil Cuplikan Chart Layar Penuh...', 'info', 1500);
        }
        try {
            // Find canvas element inside widget container
            const container = document.getElementById('tv_advanced_main');
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
    // Dipakai QuantumAIEngine untuk menganalisa candle. Dulu objek ini juga punya
    // scanSymbol() + render() yang menggambar "Confluence Matrix" ke #panelConfluenceMatrix —
    // elemen itu tidak ada di dashboard.html, jadi keduanya dihapus.
    const QuantumConfluenceEngine = {
        
        _analyzeCandles(candles) {
            if (!candles || candles.length < 20) {
                // PERBAIKAN (2026-10-13): sebelumnya cabang ini mengembalikan
                // { isBullish: true, score: 72 } — arah BUY dan "72% confidence" TANPA data.
                // Sekarang analisa DITAHAN dan dikatakan apa adanya; pemanggil WAJIB
                // menanganinya dan tidak boleh menampilkan angka apa pun.
                return { isBullish: null, score: null, dataKurang: true, lowest20: null, highest20: null,
                         detail: 'Data candle belum cukup (butuh minimal 20) — analisa ditahan, bukan dikarang.' };
            }
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const volumes = candles.map(c => c.volume || 1);
            const last = closes[closes.length - 1];
            const n = closes.length;

            // === SIGNAL 1: EMA TREND (exponential, not simple average!) ===
            const calcEMA = (data, period) => {
                if (data.length < period) return data[data.length - 1];
                const mult = 2 / (period + 1);
                let ema = data.slice(0, period).reduce((a, b) => a + b) / period;
                for (let i = period; i < data.length; i++) {
                    ema = data[i] * mult + ema * (1 - mult);
                }
                return ema;
            };
            const ema20 = calcEMA(closes, 20);
            const ema50 = calcEMA(closes, 50);
            const emaUp = last > ema20 && ema20 > ema50;
            const emaDyn = last > ema20 ? 'Price above EMA20' : 'Price below EMA20';

            // === SIGNAL 2: RSI (14) momentum ===
            const rsi = (() => {
                const gains = [], losses = [];
                for (let i = Math.max(1, n - 14); i < n; i++) {
                    const d = closes[i] - closes[i-1];
                    if (d > 0) gains.push(d); else losses.push(-d);
                }
                const ag = gains.length ? gains.reduce((a,b)=>a+b)/gains.length : 0;
                const al = losses.length ? losses.reduce((a,b)=>a+b)/losses.length : 0.001;
                return 100 - (100 / (1 + ag / al));
            })();
            const rsiOversold = rsi < 30;
            const rsiOverbought = rsi > 70;

            // === SIGNAL 3: Higher Lows/Highs (structure) ===
            const higherLows = lows.slice(-8).every((v, i) => i === 0 || v >= lows[lows.length - 8 + i - 1] * 0.9985);
            const higherHighs = highs.slice(-8).every((v, i) => i === 0 || v >= highs[highs.length - 8 + i - 1] * 0.9985);
            const uptrend = higherLows && higherHighs;

            // === SIGNAL 4: Support/Resistance Bounce ===
            const lowestLast20 = Math.min(...lows.slice(-20));
            const highestLast20 = Math.max(...highs.slice(-20));
            const atSupport = (last - lowestLast20) / lowestLast20 < 0.008;
            const atResistance = (highestLast20 - last) / last < 0.008;

            // === SIGNAL 5: Volume Trend ===
            const recentVol = volumes.slice(-5).reduce((a,b)=>a+b) / 5;
            const priorVol = volumes.slice(-20, -5).reduce((a,b)=>a+b) / 15;
            const volumeUp = recentVol > priorVol * 1.2;

            // === SIGNAL 6: Momentum (MACD-like: 12-26 EMA) ===
            const ema12 = calcEMA(closes, 12);
            const ema26 = calcEMA(closes, 26);
            const macd = ema12 - ema26;
            const macdSignal = calcEMA([...closes].map((_, i) => {
                const e12 = calcEMA(closes.slice(0, i+1), 12);
                const e26 = calcEMA(closes.slice(0, i+1), 26);
                return e12 - e26;
            }), 9);
            const macdUptrend = macd > macdSignal;

            // === SCORE CALCULATION ===
            const bullishSignals = [
                emaUp,                    // Price > EMA20 > EMA50
                rsi > 50 && !rsiOverbought, // Momentum above 50 (not overbought)
                uptrend,                   // Higher lows & highs
                atSupport && emaUp,        // Support + EMA bullish
                volumeUp,                  // Volume confirms trend
                macdUptrend,                // MACD bullish
            ].filter(Boolean).length;

            const isBullish = bullishSignals >= 3;
            const score = Math.min(97, Math.max(35, 50 + bullishSignals * 7 +
                (rsi > 60 ? 3 : 0) + (rsiOversold && emaUp ? 5 : 0) - (rsiOverbought ? 3 : 0)));

            const signals = [];
            if (emaUp) signals.push('EMA Bullish');
            if (rsiOversold) signals.push('Oversold');
            if (rsiOverbought) signals.push('Overbought');
            if (atSupport) signals.push('At Support');
            if (atResistance) signals.push('At Resistance');
            if (volumeUp) signals.push('Vol ↑');
            const detail = signals.length > 0 ? signals.join(' • ') : 'Mixed signals';

            // Level kunci = Support/Resistance NYATA dari candle (dulu 0,988/1,012 × harga).
            return { isBullish, score: +score.toFixed(0), detail,
                     lowest20: (isFinite(lowestLast20) && lowestLast20 > 0) ? lowestLast20 : null,
                     highest20: (isFinite(highestLast20) && highestLast20 > 0) ? highestLast20 : null };
        }
    };
    window.QuantumConfluenceEngine = QuantumConfluenceEngine;
    // Baris matriks timeframe (data-qi-aksi): muat simbolnya lalu pindah ke timeframe baris itu.
    QIAksi.daftar({
        bukaTfKonfluensi(el, e, simbol, harga, interval) {
            if (window.loadRealtimeSymbol) window.loadRealtimeSymbol(undefined, simbol, harga);
            if (typeof quantumTerminalManager !== 'undefined' && quantumTerminalManager) quantumTerminalManager.setInterval(interval);
        }
    });


    /* ==========================================================================
       11B. CORRELATION MATRIX — Pearson antar instrumen (return harian nyata)
       Data: api/get-chart-data.php (interval D). Window 20/50/100 bisa dipilih.
       Fungsi matematika murni (logReturns/pearson/buildMatrix) bisa di-unit-test.


    /* ==========================================================================
       12. DYNAMIC NEWS ALERT & CALENDAR ENGINE (REAL DATA & ACCURATE COUNTDOWN)
       ========================================================================== */
    const QuantumNewsAlertEngine = {
        events: [],
        activeAlert: null,
        timerId: null,
        init() {
            this.fetchCalendarData();
            this.timerId = setInterval(() => this.fetchCalendarData(), 300000); // refresh every 5 min
        },
        async fetchCalendarData() {
            const banner = document.getElementById('newsHoldBanner');
            const detailsEl = document.getElementById('newsHoldDetails');
            const badgeEl = document.getElementById('newsHoldBadge');

            try {
                const res = await fetch('api/calendar.php', { signal: AbortSignal.timeout(6000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                const events = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : null);
                if (events) {
                    this.events = events;
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

    /* ==========================================================================
       14. AUTO-BOOTSTRAP ON PAGE LOAD
       ========================================================================== */
    function initProTools() {
        QuantumTickerEngine.init();
        QuantumSessionEngine.init();
        QuantumCandleTimer.init();
        QuantumNewsAlertEngine.init();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initProTools, 100);
    } else {
        window.addEventListener('DOMContentLoaded', initProTools);
    }

})(window, document);

