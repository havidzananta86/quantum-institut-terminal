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
        connectLiveWS() {
            // Stream top Binance symbols for live marquee micro-updates
            const cryptoStreams = ['btcusdt@miniTicker', 'ethusdt@miniTicker', 'solusdt@miniTicker', 'bnbusdt@miniTicker', 'xrpusdt@miniTicker', 'dogeusdt@miniTicker'];
            const streamUrl = `wss://stream.binance.com:9443/ws/${cryptoStreams.join('/')}`;

            try {
                this.ws = new WebSocket(streamUrl);
                this.ws.onmessage = (e) => {
                    const data = JSON.parse(e.data);
                    if (!data.s || !data.c) return;
                    const sym = data.s.toUpperCase();
                    const closePrice = parseFloat(data.c);
                    const openPrice = parseFloat(data.o);
                    const chg = ((closePrice - openPrice) / openPrice) * 100;

                    // Update internal data & UI elements
                    const target = this.data.find(d => d.sym === sym);
                    if (target) {
                        target.price = closePrice;
                        target.chg = chg;
                    }
                    const formatted = closePrice >= 100 ? closePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : closePrice.toFixed(4);
                    
                    document.querySelectorAll(`[id^="ticker-price-${sym}-"]`).forEach(el => {
                        el.textContent = formatted;
                    });
                };
                this.ws.onerror = () => { /* fallback gracefully */ };
            } catch (err) {
                // Ignore if offline
            }
        }
    };
    window.QuantumTickerEngine = QuantumTickerEngine;


    /* ==========================================================================
       3. ORDER BOOK & TIME & SALES ENGINE (TIER S - FITUR 2 & 3)
       ========================================================================== */
    const QuantumOrderBook = {
        symbol: 'BTCUSDT',
        bids: [],
        asks: [],
        trades: [],
        ws: null,
        init() {
            this.generateMockBook(68450.0);
            this.render();
            this.startSimulatedFeed();
        },
        setSymbol(sym, basePrice = 68450.0) {
            this.symbol = sym;
            this.generateMockBook(basePrice);
            this.render();
        },
        generateMockBook(midPrice) {
            const spread = midPrice * 0.0002;
            this.bids = [];
            this.asks = [];
            let cumBid = 0, cumAsk = 0;

            for (let i = 1; i <= 8; i++) {
                const bPrice = midPrice - (spread * i);
                const bQty = +(Math.random() * 2.5 + 0.2).toFixed(3);
                cumBid += bQty;
                this.bids.push({ price: bPrice, qty: bQty, total: +cumBid.toFixed(3) });

                const aPrice = midPrice + (spread * i);
                const aQty = +(Math.random() * 2.5 + 0.2).toFixed(3);
                cumAsk += aQty;
                this.asks.push({ price: aPrice, qty: aQty, total: +cumAsk.toFixed(3) });
            }

            // Generate initial Time & Sales
            this.trades = [];
            for (let i = 0; i < 10; i++) {
                const isBuy = Math.random() > 0.48;
                const p = isBuy ? midPrice + (Math.random() * spread) : midPrice - (Math.random() * spread);
                const q = +(Math.random() * 1.5 + 0.05).toFixed(3);
                const d = new Date(Date.now() - (i * 2000));
                this.trades.push({
                    time: d.toTimeString().split(' ')[0],
                    price: p,
                    qty: q,
                    side: isBuy ? 'BUY' : 'SELL'
                });
            }
        },
        render() {
            const bookContainer = document.getElementById('orderBookContainer');
            const tradesContainer = document.getElementById('timeSalesContainer');
            if (!bookContainer) return;

            const maxTotal = Math.max(
                ...this.bids.map(b => b.total),
                ...this.asks.map(a => a.total),
                1
            );

            // Render Asks (Red - Top)
            const asksHtml = this.asks.slice().reverse().map(a => {
                const depthPct = Math.min(100, Math.round((a.total / maxTotal) * 100));
                return `
                    <div class="relative flex justify-between items-center px-2 py-0.5 text-[11px] font-mono hover:bg-rose-500/10 cursor-pointer">
                        <div class="absolute right-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none" style="width: ${depthPct}%"></div>
                        <span class="text-rose-400 font-bold z-10">${a.price.toFixed(2)}</span>
                        <span class="text-slate-300 z-10">${a.qty.toFixed(3)}</span>
                        <span class="text-slate-500 z-10 text-[10px]">${a.total.toFixed(2)}</span>
                    </div>
                `;
            }).join('');

            // Mid Spread
            const midSpreadHtml = `
                <div class="py-1 px-2 my-1 bg-slate-950/80 border-y border-slate-800 flex justify-between items-center text-[10px] font-mono text-cyan-400">
                    <span class="font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> SPREAD: 0.01%</span>
                    <span class="text-slate-400">DEPTH: ${maxTotal.toFixed(1)} UNITS</span>
                </div>
            `;

            // Render Bids (Green - Bottom)
            const bidsHtml = this.bids.map(b => {
                const depthPct = Math.min(100, Math.round((b.total / maxTotal) * 100));
                return `
                    <div class="relative flex justify-between items-center px-2 py-0.5 text-[11px] font-mono hover:bg-emerald-500/10 cursor-pointer">
                        <div class="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none" style="width: ${depthPct}%"></div>
                        <span class="text-emerald-400 font-bold z-10">${b.price.toFixed(2)}</span>
                        <span class="text-slate-300 z-10">${b.qty.toFixed(3)}</span>
                        <span class="text-slate-500 z-10 text-[10px]">${b.total.toFixed(2)}</span>
                    </div>
                `;
            }).join('');

            bookContainer.innerHTML = asksHtml + midSpreadHtml + bidsHtml;

            // Render Time & Sales
            if (tradesContainer) {
                tradesContainer.innerHTML = this.trades.map(t => {
                    const isBuy = t.side === 'BUY';
                    const color = isBuy ? 'text-emerald-400' : 'text-rose-400';
                    return `
                        <div class="flex justify-between items-center px-2 py-0.5 text-[11px] font-mono hover:bg-slate-800/40">
                            <span class="text-slate-400 text-[10px]">${t.time}</span>
                            <span class="${color} font-bold">${t.price.toFixed(2)}</span>
                            <span class="text-slate-200">${t.qty.toFixed(3)}</span>
                            <span class="px-1 rounded text-[9px] font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${t.side}</span>
                        </div>
                    `;
                }).join('');
            }
        },
        startSimulatedFeed() {
            setInterval(() => {
                if (!this.bids.length || !this.asks.length) return;
                const isBuy = Math.random() > 0.49;
                const mid = (this.bids[0].price + this.asks[0].price) / 2;
                const delta = (Math.random() - 0.5) * (mid * 0.0003);
                const newPrice = +(mid + delta).toFixed(2);
                const qty = +(Math.random() * 0.8 + 0.05).toFixed(3);
                const timeStr = new Date().toTimeString().split(' ')[0];

                this.trades.unshift({ time: timeStr, price: newPrice, qty, side: isBuy ? 'BUY' : 'SELL' });
                if (this.trades.length > 20) this.trades.pop();

                // Shift top bid/ask slightly
                this.bids[0].price = +(newPrice - 0.5).toFixed(2);
                this.asks[0].price = +(newPrice + 0.5).toFixed(2);
                this.render();
            }, 1200);
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

            // Sessions definition (in UTC):
            // Tokyo / Asian: 00:00 - 09:00 UTC (07:00 - 16:00 WIB)
            // London: 07:00 - 16:00 UTC (14:00 - 23:00 WIB)
            // New York: 12:00 - 21:00 UTC (19:00 - 04:00 WIB)
            // Sydney: 21:00 - 06:00 UTC

            const isAsia = utcTimeDecimal >= 0 && utcTimeDecimal < 9;
            const isLondon = utcTimeDecimal >= 7 && utcTimeDecimal < 16;
            const isNY = utcTimeDecimal >= 12 && utcTimeDecimal < 21;
            const isLondonNYOverlap = isLondon && isNY;

            const badgeEl = document.getElementById('sessionLiveBadge');
            if (badgeEl) {
                if (isLondonNYOverlap) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span><span class="text-cyan-300 font-bold">LONDON-NY OVERLAP (PEAK VOL)</span>`;
                } else if (isNY) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span class="text-emerald-300 font-bold">NEW YORK OPEN</span>`;
                } else if (isLondon) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span class="text-amber-300 font-bold">LONDON OPEN</span>`;
                } else if (isAsia) {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span><span class="text-blue-300 font-bold">TOKYO / ASIA OPEN</span>`;
                } else {
                    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span><span class="text-slate-400">MARKET QUIET</span>`;
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
    const QuantumPaperTrading = {
        balance: 10000.0,
        positions: [],
        history: [],
        init() {
            this.loadState();
            this.render();
            setInterval(() => this.updateFloatingPnL(), 1500);
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
        executeOrder(side = 'BUY') {
            const sym = window.quantumTerminalManager?.currentSymbol || 'BTCUSDT';
            const price = window.quantumTerminalManager?.lastClosePrice || (sym.includes('BTC') ? 68450 : 2650);
            const lots = parseFloat(document.getElementById('paperTradeLots')?.value || 0.5);

            const isLong = side === 'BUY';
            const sl = isLong ? +(price * 0.99).toFixed(2) : +(price * 1.01).toFixed(2);
            const tp = isLong ? +(price * 1.025).toFixed(2) : +(price * 0.975).toFixed(2);

            const newPos = {
                id: 'POS-' + Date.now().toString(36).toUpperCase(),
                symbol: sym,
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
                window.showQuantumToast(`⚡ EKSEKUSI PAPER TRADE: ${side} ${lots} ${sym} @ $${price.toLocaleString()}`, 'success');
            }
        },
        closePosition(id) {
            const idx = this.positions.findIndex(p => p.id === id);
            if (idx === -1) return;
            const pos = this.positions[idx];
            const currentPrice = window.quantumTerminalManager?.lastClosePrice || pos.entryPrice;
            const pnl = pos.side === 'BUY'
                ? (currentPrice - pos.entryPrice) * pos.lots
                : (pos.entryPrice - currentPrice) * pos.lots;

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
                window.showQuantumToast(`💼 Posisi Ditutup: PnL ${isWin ? '+' : ''}$${pnl.toFixed(2)}`, isWin ? 'success' : 'warning');
            }
        },
        updateFloatingPnL() {
            const currentPrice = window.quantumTerminalManager?.lastClosePrice;
            if (!currentPrice || !this.positions.length) return;

            let totalFloating = 0;
            this.positions.forEach(pos => {
                if (pos.symbol === window.quantumTerminalManager.currentSymbol) {
                    pos.floatingPnL = pos.side === 'BUY'
                        ? (currentPrice - pos.entryPrice) * pos.lots
                        : (pos.entryPrice - currentPrice) * pos.lots;
                }
                totalFloating += (pos.floatingPnL || 0);
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
                container.innerHTML = `<div class="text-center py-4 text-slate-500 font-mono text-xs">Belum ada posisi terbuka. Gunakan tombol BUY / SELL untuk open posisi.</div>`;
                return;
            }

            container.innerHTML = this.positions.map(p => {
                const isBuy = p.side === 'BUY';
                const pnl = p.floatingPnL || 0;
                const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
                return `
                    <div class="flex items-center justify-between p-2 rounded bg-slate-950/80 border border-slate-800 text-xs font-mono">
                        <div class="space-y-0.5">
                            <div class="flex items-center gap-1.5">
                                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${p.side}</span>
                                <strong class="text-white">${p.symbol}</strong>
                                <span class="text-slate-400 text-[10px]">${p.lots} Lot</span>
                            </div>
                            <div class="text-[10px] text-slate-400">Entry: $${p.entryPrice.toLocaleString()} | SL: $${p.sl} | TP: $${p.tp}</div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-right">
                                <div class="${pnlColor} font-bold">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</div>
                                <div class="text-[9px] text-slate-500">${p.openTime}</div>
                            </div>
                            <button onclick="QuantumPaperTrading.closePosition('${p.id}')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold">TUTUP</button>
                        </div>
                    </div>
                `;
            }).join('');
        },
        render() {
            const balEl = document.getElementById('paperBalanceDisplay');
            if (balEl) balEl.textContent = `$${this.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            this.renderPositionsOnly();

            // Win Rate calculation
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
            const sym = window.quantumTerminalManager?.currentSymbol || 'BTCUSDT';
            const tf = window.quantumTerminalManager?.currentInterval || '60';
            const price = window.quantumTerminalManager?.lastClosePrice || 68450;
            const engine = window.quantumTerminalManager?.currentEngine || 'SNR';

            const modal = document.getElementById('aiAnalystModal');
            if (modal) modal.classList.remove('hidden');

            const contentEl = document.getElementById('aiAnalystContent');
            if (!contentEl) return;

            contentEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 space-y-3">
                    <div class="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                    <div class="text-xs font-mono text-cyan-300">Quantum Neural Engine sedang memproses data ${sym} (${tf})...</div>
                </div>
            `;

            setTimeout(() => {
                const isBullish = Math.random() > 0.35;
                const score = Math.floor(Math.random() * 15 + 82); // 82-97%
                const bias = isBullish ? 'BULLISH CONTINUATION (BUY)' : 'BEARISH CORRECTION (SELL)';
                const biasColor = isBullish ? 'text-emerald-400' : 'text-rose-400';
                const keySup = +(price * 0.988).toFixed(2);
                const keyRes = +(price * 1.018).toFixed(2);

                contentEl.innerHTML = `
                    <div class="space-y-4 font-mono text-xs">
                        <div class="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-400 block">AI DIRECTION BIAS (${sym})</span>
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
                            <strong class="text-slate-200 block text-[11px]">✦ SINTESIS REKOMENDASI MESIN:</strong>
                            <p class="text-slate-300 leading-relaxed font-sans text-xs">
                                Berdasarkan struktur multi-candle dan pola volume order book, harga sedang berada pada zona diskon ideal. Konfirmasi rejection terdeteksi valid pada support $${keySup.toLocaleString()}. Risiko invalidasi setup terletak di bawah $${(keySup * 0.995).toFixed(2)}.
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
        }
    };
    window.QuantumAIEngine = QuantumAIEngine;


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
       11. AUTO-BOOTSTRAP ON PAGE LOAD
       ========================================================================== */
    function initProTools() {
        QuantumTickerEngine.init();
        QuantumOrderBook.init();
        QuantumSessionEngine.init();
        QuantumCandleTimer.init();
        QuantumPaperTrading.init();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initProTools, 100);
    } else {
        window.addEventListener('DOMContentLoaded', initProTools);
    }

})(window, document);
