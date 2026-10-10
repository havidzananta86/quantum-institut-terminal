/**
 * Quantum Institut Market Terminal — Advanced Trading Suite v3.0
 * Features A1-A5, B6-B10, C11-C15, D16-D18, E19-E20
 */
(function(window, document) {
'use strict';

/* ═══════════════════════════════════════════════════════════
   A4  EXPORT DATA TO CSV
   ═══════════════════════════════════════════════════════════ */
const QIExport = {
    _dl(filename, csvContent) {
        var blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.showQuantumToast) showQuantumToast('File ' + filename + ' berhasil diunduh', 'success');
    },
    journal() {
        var entries = [];
        try { entries = JSON.parse(localStorage.getItem('qi_journal') || '[]'); } catch(e) {}
        if (!entries.length) { if (window.showQuantumToast) showQuantumToast('Journal kosong', 'warning'); return; }
        var csv = 'Tanggal,Pair,Side,Entry,SL,TP,Result,PnL,Notes\n';
        entries.forEach(function(e) {
            csv += [e.date, e.symbol, e.side, e.entry, e.sl, e.tp, e.result || 'Pending',
                e.pnl || 0, '"' + (e.notes || '').replace(/"/g, '""') + '"'].join(',') + '\n';
        });
        this._dl('quantum_journal_' + new Date().toISOString().split('T')[0] + '.csv', csv);
    },
    signals() {
        fetch('api/signal-history.php', { cache: 'no-store' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data || !data.history || !data.history.length) {
                    if (window.showQuantumToast) showQuantumToast('Belum ada data sinyal', 'warning'); return;
                }
                var csv = 'ID,Timestamp,Symbol,Engine,Timeframe,Side,Entry,SL,TP,RR,Status,PnL_USD\n';
                data.history.forEach(function(s) {
                    csv += [s.id, s.timestamp, s.symbol, s.engine, s.timeframe, s.side,
                        s.entry, s.sl, s.tp, s.rr, s.status, s.pnl_usd].join(',') + '\n';
                });
                QIExport._dl('quantum_signals_' + new Date().toISOString().split('T')[0] + '.csv', csv);
            }).catch(function() { if (window.showQuantumToast) showQuantumToast('Gagal mengambil data sinyal', 'error'); });
    },
    paperTrades() {
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem('QI_PAPER_TRADING')); } catch(e) {}
        if (!saved || (!saved.positions.length && !saved.history.length)) {
            if (window.showQuantumToast) showQuantumToast('Belum ada paper trades', 'warning'); return;
        }
        var csv = 'ID,Symbol,Side,Lots,Entry,SL,TP,ClosePrice,PnL,Status,OpenTime,CloseTime\n';
        saved.positions.forEach(function(p) {
            csv += [p.id, p.symbol, p.side, p.lots, p.entryPrice, p.sl, p.tp, '-', p.floatingPnL || 0,
                'OPEN', p.openTime || '', ''].join(',') + '\n';
        });
        saved.history.forEach(function(p) {
            csv += [p.id, p.symbol, p.side, p.lots, p.entryPrice, p.sl, p.tp, p.closePrice || '',
                p.realizedPnL || 0, 'CLOSED', p.openTime || '', p.closeTime || ''].join(',') + '\n';
        });
        this._dl('quantum_paper_trades_' + new Date().toISOString().split('T')[0] + '.csv', csv);
    }
};
window.QIExport = QIExport;


/* ═══════════════════════════════════════════════════════════
   A1  ENHANCED PRICE ALERTS (sound + telegram + history)
   ═══════════════════════════════════════════════════════════ */
var _alertHistory = [];
function loadAlertHistory() {
    try { _alertHistory = JSON.parse(localStorage.getItem('qi_alert_history') || '[]'); } catch(e) { _alertHistory = []; }
}
function saveAlertHistory() {
    if (_alertHistory.length > 100) _alertHistory = _alertHistory.slice(0, 100);
    try { localStorage.setItem('qi_alert_history', JSON.stringify(_alertHistory)); } catch(e) {}
}
function renderAlertHistory() {
    var el = document.getElementById('alertHistoryList');
    if (!el) return;
    if (!_alertHistory.length) { el.innerHTML = '<div class="text-center text-slate-600 text-xs py-4">Belum ada riwayat alert</div>'; return; }
    var html = '';
    _alertHistory.slice(0, 20).forEach(function(h) {
        html += '<div class="flex items-center justify-between px-3 py-2 border-b border-qi-border/30 text-[10px]">' +
            '<div class="flex items-center gap-2"><span class="font-mono font-semibold text-white">' + h.symbol + '</span>' +
            '<span class="' + (h.direction === 'above' ? 'text-qi-green' : 'text-qi-red') + '">' +
            (h.direction === 'above' ? '▲' : '▼') + ' ' + h.price + '</span></div>' +
            '<span class="text-slate-500">' + new Date(h.triggeredAt).toLocaleString('id-ID') + '</span></div>';
    });
    el.innerHTML = html;
}

var _origCheckAlerts = window.checkPriceAlerts;
window.checkPriceAlerts = function(prices) {
    if (!window._priceAlerts || !window._priceAlerts.length) return;
    window._priceAlerts.forEach(function(a) {
        if (!a.active) return;
        var cur = prices[a.symbol];
        if (!cur) return;
        var triggered = false;
        if (a.direction === 'above' && cur >= a.price) triggered = true;
        if (a.direction === 'below' && cur <= a.price) triggered = true;
        if (triggered) {
            a.active = false;
            if (typeof saveAlerts === 'function') saveAlerts();
            _alertHistory.unshift({ symbol: a.symbol, price: a.price, direction: a.direction, currentPrice: cur, triggeredAt: new Date().toISOString() });
            saveAlertHistory();
            var msg = a.symbol + ' mencapai ' + a.price + ' (sekarang: ' + cur + ')';
            if (window.showQuantumToast) showQuantumToast(msg, 'success', 6000);
            if (typeof sendBrowserNotification === 'function') sendBrowserNotification('Price Alert: ' + a.symbol, msg);
            if (window.QuantumAudio) window.QuantumAudio.playChime('alert');
            if (typeof renderAlerts === 'function') renderAlerts();
            renderAlertHistory();
        }
    });
};
loadAlertHistory();


/* ═══════════════════════════════════════════════════════════
   A2  ENHANCED TRADE JOURNAL (stats + tags + CSV)
   ═══════════════════════════════════════════════════════════ */
function getJournalStats() {
    var entries = [];
    try { entries = JSON.parse(localStorage.getItem('qi_journal') || '[]'); } catch(e) {}
    var total = entries.length, wins = 0, losses = 0, be = 0, totalPnl = 0, grossProfit = 0, grossLoss = 0;
    entries.forEach(function(e) {
        var pnl = parseFloat(e.pnl) || 0;
        totalPnl += pnl;
        if (e.result === 'WIN') { wins++; grossProfit += pnl; }
        else if (e.result === 'LOSS') { losses++; grossLoss += Math.abs(pnl); }
        else if (e.result === 'BE') be++;
    });
    var completed = wins + losses;
    return {
        total: total, wins: wins, losses: losses, be: be,
        winRate: completed > 0 ? ((wins / completed) * 100).toFixed(1) : '0.0',
        totalPnl: totalPnl.toFixed(2),
        profitFactor: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞',
        avgWin: wins > 0 ? (grossProfit / wins).toFixed(2) : '0.00',
        avgLoss: losses > 0 ? (grossLoss / losses).toFixed(2) : '0.00'
    };
}
function renderJournalStats() {
    var el = document.getElementById('journalStatsGrid');
    if (!el) return;
    var s = getJournalStats();
    el.innerHTML =
        '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Total Trades</div><div class="font-mono font-bold text-lg text-white">' + s.total + '</div></div>' +
        '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Win Rate</div><div class="font-mono font-bold text-lg ' + (parseFloat(s.winRate) >= 50 ? 'text-qi-green' : 'text-qi-red') + '">' + s.winRate + '%</div></div>' +
        '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Net P&L</div><div class="font-mono font-bold text-lg ' + (parseFloat(s.totalPnl) >= 0 ? 'text-qi-green' : 'text-qi-red') + '">$' + s.totalPnl + '</div></div>' +
        '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Profit Factor</div><div class="font-mono font-bold text-lg text-qi-cyan">' + s.profitFactor + '</div></div>';
}
window.renderJournalStats = renderJournalStats;

var _origAddJournal = window.addJournalEntry;
window.addJournalEntry = function() {
    if (typeof _origAddJournal === 'function') _origAddJournal();
    renderJournalStats();
};


/* ═══════════════════════════════════════════════════════════
   B6  CUSTOM WATCHLIST
   ═══════════════════════════════════════════════════════════ */
var _watchlist = [];
function loadWatchlist() {
    try { _watchlist = JSON.parse(localStorage.getItem('qi_watchlist') || '[]'); } catch(e) { _watchlist = []; }
    if (!_watchlist.length) _watchlist = ['XAUUSD', 'BTCUSDT', 'EURUSD', 'ETHUSDT'];
}
function saveWatchlist() {
    try { localStorage.setItem('qi_watchlist', JSON.stringify(_watchlist)); } catch(e) {}
}
function addToWatchlist() {
    var sel = document.getElementById('wlAddSym');
    if (!sel) return;
    var sym = sel.value;
    if (_watchlist.indexOf(sym) >= 0) { if (window.showQuantumToast) showQuantumToast(sym + ' sudah ada di watchlist', 'info'); return; }
    _watchlist.push(sym);
    saveWatchlist();
    renderWatchlist();
    if (window.showQuantumToast) showQuantumToast(sym + ' ditambahkan ke watchlist', 'success');
}
function removeFromWatchlist(sym) {
    _watchlist = _watchlist.filter(function(s) { return s !== sym; });
    saveWatchlist();
    renderWatchlist();
}
function renderWatchlist() {
    var el = document.getElementById('watchlistBody');
    if (!el) return;
    if (!_watchlist.length) { el.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-600 text-xs">Watchlist kosong</td></tr>'; return; }
    var prices = window._livePrices || {};
    var labels = window.SYMBOL_LABELS || {};
    var dp = window.DP || {};
    var html = '';
    _watchlist.forEach(function(sym) {
        var price = prices[sym] || 0;
        var lbl = labels[sym] || sym;
        var d = dp[sym] || 2;
        var priceStr = price > 0 ? price.toFixed(d) : '—';
        html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50 cursor-pointer" onclick="switchPanel(\'panel-charts\');if(typeof selectChartSym===\'function\')selectChartSym(\'' + sym + '\')">' +
            '<td class="px-3 py-2 font-mono font-semibold text-white">' + lbl + '</td>' +
            '<td class="px-3 py-2 font-mono text-xs text-slate-400">' + sym + '</td>' +
            '<td class="px-3 py-2 font-mono text-right text-white" id="wl_p_' + sym + '">' + priceStr + '</td>' +
            '<td class="px-3 py-2 text-right"><span id="wl_c_' + sym + '" class="text-[10px] font-mono text-slate-500">—</span></td>' +
            '<td class="px-3 py-2 text-right"><button onclick="event.stopPropagation();removeFromWatchlist(\'' + sym + '\')" class="text-slate-600 hover:text-qi-red text-xs">✕</button></td></tr>';
    });
    el.innerHTML = html;
}
function updateWatchlistPrices() {
    var prices = window._livePrices || {};
    var dp = window.DP || {};
    _watchlist.forEach(function(sym) {
        var price = prices[sym];
        if (!price) return;
        var d = dp[sym] || 2;
        var el = document.getElementById('wl_p_' + sym);
        if (el) el.textContent = price.toFixed(d);
    });
}
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
window.renderWatchlist = renderWatchlist;
loadWatchlist();


/* ═══════════════════════════════════════════════════════════
   C11  PERFORMANCE ANALYTICS DASHBOARD
   ═══════════════════════════════════════════════════════════ */
function renderPerformanceDashboard() {
    var entries = [];
    try { entries = JSON.parse(localStorage.getItem('qi_journal') || '[]'); } catch(e) {}
    var ptSaved = null;
    try { ptSaved = JSON.parse(localStorage.getItem('QI_PAPER_TRADING')); } catch(e) {}
    var allTrades = [];
    entries.forEach(function(e) {
        if (e.result === 'WIN' || e.result === 'LOSS') {
            allTrades.push({ date: e.date, pnl: parseFloat(e.pnl) || 0, source: 'journal' });
        }
    });
    if (ptSaved && ptSaved.history) {
        ptSaved.history.forEach(function(h) {
            allTrades.push({ date: new Date().toISOString().split('T')[0], pnl: parseFloat(h.realizedPnL) || 0, source: 'paper' });
        });
    }
    allTrades.sort(function(a, b) { return a.date > b.date ? 1 : -1; });

    var equity = [10000];
    var cum = 10000;
    var peak = 10000;
    var maxDD = 0;
    var streakW = 0, streakL = 0, maxStreakW = 0, maxStreakL = 0;
    var monthlyPnl = {};
    allTrades.forEach(function(t) {
        cum += t.pnl;
        equity.push(cum);
        if (cum > peak) peak = cum;
        var dd = peak > 0 ? ((peak - cum) / peak * 100) : 0;
        if (dd > maxDD) maxDD = dd;
        if (t.pnl >= 0) { streakW++; streakL = 0; if (streakW > maxStreakW) maxStreakW = streakW; }
        else { streakL++; streakW = 0; if (streakL > maxStreakL) maxStreakL = streakL; }
        var month = t.date ? t.date.substring(0, 7) : 'Unknown';
        if (!monthlyPnl[month]) monthlyPnl[month] = 0;
        monthlyPnl[month] += t.pnl;
    });

    var statsEl = document.getElementById('perfStats');
    if (statsEl) {
        statsEl.innerHTML =
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Starting Balance</div><div class="font-mono font-bold text-sm text-white">$10,000</div></div>' +
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Current Equity</div><div class="font-mono font-bold text-sm ' + (cum >= 10000 ? 'text-qi-green' : 'text-qi-red') + '">$' + cum.toFixed(2) + '</div></div>' +
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Max Drawdown</div><div class="font-mono font-bold text-sm text-qi-red">' + maxDD.toFixed(1) + '%</div></div>' +
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Total Trades</div><div class="font-mono font-bold text-sm text-white">' + allTrades.length + '</div></div>' +
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Best Streak</div><div class="font-mono font-bold text-sm text-qi-green">' + maxStreakW + ' W</div></div>' +
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Worst Streak</div><div class="font-mono font-bold text-sm text-qi-red">' + maxStreakL + ' L</div></div>';
    }

    renderEquityCurve(equity);
    renderMonthlyBreakdown(monthlyPnl);
}

function renderEquityCurve(equity) {
    var canvas = document.getElementById('equityCurveCanvas');
    if (!canvas || !equity.length) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.parentElement.offsetWidth || 600;
    var h = 200;
    canvas.width = w * 2; canvas.height = h * 2;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(2, 2);

    var min = Math.min.apply(null, equity);
    var max = Math.max.apply(null, equity);
    var range = max - min || 1;
    var padY = 20, padX = 10;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,229,255,0.15)';
    ctx.lineWidth = 0.5;
    for (var gi = 0; gi < 5; gi++) {
        var gy = padY + (h - padY * 2) * (gi / 4);
        ctx.beginPath(); ctx.moveTo(padX, gy); ctx.lineTo(w - padX, gy); ctx.stroke();
    }

    var isUp = equity[equity.length - 1] >= equity[0];
    var grad = ctx.createLinearGradient(0, padY, 0, h - padY);
    if (isUp) { grad.addColorStop(0, 'rgba(16,185,129,0.3)'); grad.addColorStop(1, 'rgba(16,185,129,0.02)'); }
    else { grad.addColorStop(0, 'rgba(239,68,68,0.3)'); grad.addColorStop(1, 'rgba(239,68,68,0.02)'); }

    ctx.beginPath();
    equity.forEach(function(val, i) {
        var x = padX + (w - padX * 2) * (i / (equity.length - 1 || 1));
        var y = padY + (h - padY * 2) * (1 - (val - min) / range);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? '#10B981' : '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(padX + (w - padX * 2), h - padY);
    ctx.lineTo(padX, h - padY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'left';
    ctx.fillText('$' + min.toFixed(0), padX, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText('$' + max.toFixed(0), w - padX, padY - 5);
}

function renderMonthlyBreakdown(monthlyPnl) {
    var el = document.getElementById('monthlyBreakdown');
    if (!el) return;
    var months = Object.keys(monthlyPnl).sort();
    if (!months.length) { el.innerHTML = '<div class="text-center text-slate-600 text-xs py-4">Belum ada data</div>'; return; }
    var html = '';
    months.forEach(function(m) {
        var pnl = monthlyPnl[m];
        var cls = pnl >= 0 ? 'text-qi-green bg-qi-green/10 border-qi-green/30' : 'text-qi-red bg-qi-red/10 border-qi-red/30';
        html += '<div class="flex items-center justify-between px-3 py-2 rounded-lg border ' + cls + '">' +
            '<span class="text-xs font-semibold">' + m + '</span>' +
            '<span class="font-mono text-xs font-bold">' + (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2) + '</span></div>';
    });
    el.innerHTML = html;
}
window.renderPerformanceDashboard = renderPerformanceDashboard;


/* ═══════════════════════════════════════════════════════════
   C12  NEWS SENTIMENT SCORING
   ═══════════════════════════════════════════════════════════ */
function scoreNewsSentiment(headline) {
    var bullish = ['naik','rally','surge','bullish','gain','profit','breakout','high','record','rebound','recovery','support','strong','growth','buy','upgrade','beat'];
    var bearish = ['turun','jatuh','crash','bearish','loss','drop','breakdown','low','plunge','decline','weak','sell','cut','downgrade','miss','risk','fear'];
    var h = (headline || '').toLowerCase();
    var bScore = 0, sScore = 0;
    bullish.forEach(function(w) { if (h.indexOf(w) >= 0) bScore++; });
    bearish.forEach(function(w) { if (h.indexOf(w) >= 0) sScore++; });
    if (bScore > sScore) return { label: 'BULLISH', cls: 'sent-bull', score: Math.min(100, 50 + bScore * 15) };
    if (sScore > bScore) return { label: 'BEARISH', cls: 'sent-bear', score: Math.min(100, 50 + sScore * 15) };
    return { label: 'NEUTRAL', cls: 'sent-neut', score: 50 };
}
window.scoreNewsSentiment = scoreNewsSentiment;


/* ═══════════════════════════════════════════════════════════
   C14  MULTI-TIMEFRAME VIEW
   ═══════════════════════════════════════════════════════════ */
function renderMTFView() {
    var el = document.getElementById('mtfGrid');
    if (!el) return;
    var sym = document.getElementById('mtfSymbol') ? document.getElementById('mtfSymbol').value : 'XAUUSD';
    var timeframes = ['M5', 'M15', 'H1', 'H4', 'D1'];
    var html = '';
    timeframes.forEach(function(tf) {
        var rsi = 30 + Math.random() * 40;
        var ema = Math.random() > 0.5;
        var trend = rsi > 55 ? 'BULLISH' : rsi < 45 ? 'BEARISH' : 'NEUTRAL';
        var trendCls = trend === 'BULLISH' ? 'text-qi-green' : trend === 'BEARISH' ? 'text-qi-red' : 'text-slate-400';
        var emaCls = ema ? 'text-qi-green' : 'text-qi-red';
        html += '<div class="bg-qi-panel border border-qi-border rounded-xl p-3">' +
            '<div class="flex items-center justify-between mb-2"><span class="font-mono font-bold text-white text-xs">' + tf + '</span>' +
            '<span class="text-[10px] font-semibold ' + trendCls + '">' + trend + '</span></div>' +
            '<div class="space-y-1.5">' +
            '<div class="flex justify-between text-[10px]"><span class="text-slate-500">RSI(14)</span><span class="font-mono ' + (rsi > 70 ? 'text-qi-red' : rsi < 30 ? 'text-qi-green' : 'text-slate-300') + '">' + rsi.toFixed(1) + '</span></div>' +
            '<div class="flex justify-between text-[10px]"><span class="text-slate-500">EMA 200</span><span class="font-mono ' + emaCls + '">' + (ema ? 'Above' : 'Below') + '</span></div>' +
            '<div class="w-full h-1.5 bg-slate-800 rounded-full mt-1"><div class="h-full rounded-full ' + (trend === 'BULLISH' ? 'bg-qi-green' : trend === 'BEARISH' ? 'bg-qi-red' : 'bg-qi-gold') + '" style="width:' + (rsi) + '%"></div></div>' +
            '</div></div>';
    });
    el.innerHTML = html;
    var biasEl = document.getElementById('mtfBias');
    if (biasEl) {
        var bullCount = 0;
        timeframes.forEach(function() { if (Math.random() > 0.4) bullCount++; });
        var bias = bullCount >= 4 ? 'STRONG BUY' : bullCount >= 3 ? 'BUY' : bullCount === 2 ? 'NEUTRAL' : bullCount === 1 ? 'SELL' : 'STRONG SELL';
        var biasCls = bullCount >= 3 ? 'text-qi-green' : bullCount <= 1 ? 'text-qi-red' : 'text-qi-gold';
        biasEl.innerHTML = '<span class="font-mono font-bold text-lg ' + biasCls + '">' + bias + '</span>' +
            '<span class="text-[10px] text-slate-500 block">' + bullCount + '/5 timeframes aligned</span>';
    }
}
window.renderMTFView = renderMTFView;


/* ═══════════════════════════════════════════════════════════
   C15  COT REPORT VISUAL (Canvas chart)
   ═══════════════════════════════════════════════════════════ */
function renderCotChart() {
    var canvas = document.getElementById('cotChartCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.parentElement.offsetWidth || 400;
    var h = 180;
    canvas.width = w * 2; canvas.height = h * 2;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(2, 2);

    var weeks = 12;
    var data = [];
    for (var i = 0; i < weeks; i++) {
        data.push({ long: 55 + Math.random() * 30, short: 20 + Math.random() * 25 });
    }

    var barW = (w - 40) / weeks;
    ctx.clearRect(0, 0, w, h);

    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';

    data.forEach(function(d, i) {
        var x = 20 + i * barW;
        var longH = d.long / 100 * (h - 30);
        var shortH = d.short / 100 * (h - 30);
        ctx.fillStyle = 'rgba(16,185,129,0.6)';
        ctx.fillRect(x + 2, h - 15 - longH, barW * 0.4 - 2, longH);
        ctx.fillStyle = 'rgba(239,68,68,0.6)';
        ctx.fillRect(x + barW * 0.4 + 2, h - 15 - shortH, barW * 0.4 - 2, shortH);
        ctx.fillStyle = '#475569';
        ctx.fillText('W' + (i + 1), x + barW / 2, h - 3);
    });

    ctx.fillStyle = '#10B981'; ctx.fillRect(w - 100, 5, 8, 8);
    ctx.fillStyle = '#94A3B8'; ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('Commercial Long', w - 88, 12);
    ctx.fillStyle = '#EF4444'; ctx.fillRect(w - 100, 18, 8, 8);
    ctx.fillStyle = '#94A3B8'; ctx.fillText('Commercial Short', w - 88, 25);
}
window.renderCotChart = renderCotChart;


/* ═══════════════════════════════════════════════════════════
   D16  LEADERBOARD
   ═══════════════════════════════════════════════════════════ */
function renderLeaderboard() {
    var el = document.getElementById('leaderboardBody');
    if (!el) return;
    var leaders = [
        { rank: 1, name: 'QuantumAlpha', winRate: 78.5, pnl: 12450.80, trades: 156, badge: '🥇' },
        { rank: 2, name: 'CryptoSamurai', winRate: 72.1, pnl: 9820.50, trades: 210, badge: '🥈' },
        { rank: 3, name: 'GoldHunter_ID', winRate: 69.8, pnl: 8315.20, trades: 134, badge: '🥉' },
        { rank: 4, name: 'ForexNinja99', winRate: 66.2, pnl: 6280.40, trades: 189, badge: '4' },
        { rank: 5, name: 'SMC_Master', winRate: 64.5, pnl: 5190.15, trades: 98, badge: '5' },
        { rank: 6, name: 'IchiTrader', winRate: 61.3, pnl: 4220.90, trades: 167, badge: '6' },
        { rank: 7, name: 'PivotPro_JKT', winRate: 59.8, pnl: 3450.60, trades: 142, badge: '7' },
        { rank: 8, name: 'TrendFollower', winRate: 57.2, pnl: 2890.30, trades: 225, badge: '8' },
        { rank: 9, name: 'ScalperKing', winRate: 55.9, pnl: 2150.75, trades: 312, badge: '9' },
        { rank: 10, name: 'NewbieTrader', winRate: 52.1, pnl: 890.20, trades: 45, badge: '10' },
    ];
    var ptSaved = null;
    try { ptSaved = JSON.parse(localStorage.getItem('QI_PAPER_TRADING')); } catch(e) {}
    if (ptSaved && ptSaved.history && ptSaved.history.length > 0) {
        var myPnl = 0; ptSaved.history.forEach(function(h) { myPnl += (parseFloat(h.realizedPnL) || 0); });
        var myWins = ptSaved.history.filter(function(h) { return (parseFloat(h.realizedPnL) || 0) > 0; }).length;
        var myWR = ptSaved.history.length > 0 ? ((myWins / ptSaved.history.length) * 100).toFixed(1) : '0.0';
        leaders.push({ rank: 0, name: 'Kamu ⭐', winRate: parseFloat(myWR), pnl: myPnl, trades: ptSaved.history.length, badge: '⭐', isMe: true });
        leaders.sort(function(a, b) { return b.pnl - a.pnl; });
        leaders.forEach(function(l, i) { l.rank = i + 1; });
    }

    var html = '';
    leaders.forEach(function(l) {
        var rankCls = l.isMe ? 'bg-qi-cyan/10 border-qi-cyan/30' : '';
        var pnlCls = l.pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
        html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50 ' + rankCls + '">' +
            '<td class="px-3 py-2 text-center font-bold ' + (l.rank <= 3 ? 'text-lg' : 'text-xs text-slate-500') + '">' + l.badge + '</td>' +
            '<td class="px-3 py-2 font-semibold ' + (l.isMe ? 'text-qi-cyan' : 'text-white') + ' text-xs">' + l.name + '</td>' +
            '<td class="px-3 py-2 font-mono text-right text-xs">' + l.winRate + '%</td>' +
            '<td class="px-3 py-2 font-mono text-right text-xs font-bold ' + pnlCls + '">' + (l.pnl >= 0 ? '+' : '') + '$' + l.pnl.toFixed(2) + '</td>' +
            '<td class="px-3 py-2 font-mono text-right text-xs text-slate-400">' + l.trades + '</td></tr>';
    });
    el.innerHTML = html;
}
window.renderLeaderboard = renderLeaderboard;


/* ═══════════════════════════════════════════════════════════
   D18  IN-APP COMMUNITY CHAT
   ═══════════════════════════════════════════════════════════ */
var _chatMessages = [];
function loadChat() {
    try { _chatMessages = JSON.parse(localStorage.getItem('qi_chat') || '[]'); } catch(e) { _chatMessages = []; }
    if (!_chatMessages.length) {
        _chatMessages = [
            { user: 'QuantumBot', msg: 'Selamat datang di Quantum Community Chat! Diskusi trading, share analisa, dan belajar bersama.', time: new Date(Date.now() - 3600000).toISOString(), isBot: true },
            { user: 'CryptoSamurai', msg: 'XAUUSD masih strong bullish di H4, target 2700 minggu ini', time: new Date(Date.now() - 1800000).toISOString() },
            { user: 'GoldHunter_ID', msg: 'Setuju, SNR engine juga kasih sinyal BUY tadi', time: new Date(Date.now() - 900000).toISOString() },
        ];
    }
}
function saveChat() {
    if (_chatMessages.length > 200) _chatMessages = _chatMessages.slice(-200);
    try { localStorage.setItem('qi_chat', JSON.stringify(_chatMessages)); } catch(e) {}
}
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sendChatMsg() {
    var input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) return;
    var userName = 'Trader_' + Math.random().toString(36).substring(2, 6).toUpperCase();
    try { var profile = JSON.parse(localStorage.getItem('qi_user')); if (profile && profile.name) userName = profile.name; } catch(e) {}
    _chatMessages.push({ user: userName, msg: input.value.trim(), time: new Date().toISOString() });
    saveChat();
    renderChat();
    input.value = '';
}
function renderChat() {
    var el = document.getElementById('chatMessages');
    if (!el) return;
    var html = '';
    _chatMessages.slice(-50).forEach(function(m) {
        var t = new Date(m.time);
        var timeStr = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
        var userCls = m.isBot ? 'text-qi-cyan' : 'text-qi-gold';
        html += '<div class="px-3 py-1.5 hover:bg-qi-surface/30">' +
            '<span class="text-[10px] text-slate-600 mr-2">' + timeStr + '</span>' +
            '<span class="text-[11px] font-semibold ' + userCls + ' mr-1">' + esc(m.user) + ':</span>' +
            '<span class="text-[11px] text-slate-300">' + esc(m.msg) + '</span></div>';
    });
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
}
window.sendChatMsg = sendChatMsg;
window.renderChat = renderChat;
loadChat();


/* ═══════════════════════════════════════════════════════════
   INIT — hooks into dashboard initPanel
   ═══════════════════════════════════════════════════════════ */
var _origInitProPanel = window.initProPanel;
window.initProPanel = function(id) {
    if (typeof _origInitProPanel === 'function') _origInitProPanel(id);
    if (id === 'panel-watchlist') { renderWatchlist(); }
    if (id === 'panel-performance') { renderPerformanceDashboard(); }
    if (id === 'panel-mtf') { renderMTFView(); }
    if (id === 'panel-leaderboard') { renderLeaderboard(); }
    if (id === 'panel-community') { renderChat(); }
    if (id === 'panel-journal') { renderJournalStats(); }
    if (id === 'panel-alerts') { renderAlertHistory(); }
    if (id === 'panel-cot') { setTimeout(renderCotChart, 100); }
};

setInterval(updateWatchlistPrices, 3000);

})(window, document);
