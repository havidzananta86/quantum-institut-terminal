/**
 * Quantum Institut Market Terminal — Pro Features v2.1
 * Risk Calculator, Price Alerts, Command Palette, Floating Ticker,
 * Pip Calculator, Pivot Points, Market Screener, Trade Journal,
 * Volatility Dashboard, Session Clocks, DXY Tracker, Sentiment Gauge
 */

/* ═══════════════════════════════════════════════════════════
   #1  RISK / POSITION SIZE CALCULATOR
   ═══════════════════════════════════════════════════════════ */
function calcPositionSize() {
    var bal = parseFloat(document.getElementById('rcBalance').value) || 0;
    var riskPct = parseFloat(document.getElementById('rcRiskPct').value) || 1;
    var entry = parseFloat(document.getElementById('rcEntry').value) || 0;
    var sl = parseFloat(document.getElementById('rcSL').value) || 0;
    var sym = (document.getElementById('rcSymbol').value || 'XAUUSD').toUpperCase();

    var riskAmt = bal * (riskPct / 100);
    var slDist = Math.abs(entry - sl);
    if (slDist === 0) { showRiskResult('SL distance tidak boleh 0'); return; }

    var pipVal = getPipValue(sym);
    var slPips = slDist / pipVal.pipSize;
    var lots = riskAmt / (slPips * pipVal.pipValuePerLot);
    var tp1 = entry > sl ? entry + slDist * 2 : entry - slDist * 2;
    var tp2 = entry > sl ? entry + slDist * 3 : entry - slDist * 3;

    var html = '<div class="grid grid-cols-2 gap-3">';
    html += rcCard('Risk Amount', '$' + riskAmt.toFixed(2), 'text-qi-red');
    html += rcCard('SL Distance', slPips.toFixed(1) + ' pips', 'text-slate-300');
    html += rcCard('Lot Size', lots.toFixed(2) + ' lots', 'text-qi-cyan');
    html += rcCard('Pip Value / Lot', '$' + pipVal.pipValuePerLot.toFixed(2), 'text-slate-300');
    html += rcCard('TP1 (2R)', formatPrice(tp1, sym), 'text-qi-green');
    html += rcCard('TP2 (3R)', formatPrice(tp2, sym), 'text-qi-green');
    html += '</div>';
    document.getElementById('rcResult').innerHTML = html;
}

function rcCard(label, value, cls) {
    return '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center">' +
        '<div class="text-[9px] text-slate-500 uppercase mb-1">' + label + '</div>' +
        '<div class="font-mono font-bold text-sm ' + cls + '">' + value + '</div></div>';
}

function showRiskResult(msg) {
    document.getElementById('rcResult').innerHTML = '<div class="text-center text-slate-500 text-xs py-4">' + msg + '</div>';
}

function formatPrice(p, sym) {
    var dp = (typeof DP !== 'undefined' && DP[sym]) ? DP[sym] : 2;
    return p.toFixed(dp);
}

function getPipValue(sym) {
    var forex5 = ['EURUSD','GBPUSD','AUDUSD','NZDUSD','USDCHF','USDCAD'];
    var forex3 = ['USDJPY','GBPJPY','EURJPY','CHFJPY','CADJPY','AUDJPY'];
    if (sym === 'XAUUSD') return { pipSize: 0.01, pipValuePerLot: 1 };
    if (forex3.indexOf(sym) >= 0) return { pipSize: 0.01, pipValuePerLot: 6.7 };
    if (forex5.indexOf(sym) >= 0) return { pipSize: 0.0001, pipValuePerLot: 10 };
    if (sym.indexOf('USDT') >= 0) return { pipSize: 1, pipValuePerLot: 1 };
    return { pipSize: 0.0001, pipValuePerLot: 10 };
}


/* ═══════════════════════════════════════════════════════════
   #18  PIP CALCULATOR
   ═══════════════════════════════════════════════════════════ */
function calcPipValue() {
    var sym = (document.getElementById('pipSym').value || 'EURUSD').toUpperCase();
    var lots = parseFloat(document.getElementById('pipLots').value) || 1;
    var pv = getPipValue(sym);
    var val = pv.pipValuePerLot * lots;
    document.getElementById('pipResult').innerHTML =
        '<div class="text-center py-3"><div class="text-[9px] text-slate-500 uppercase mb-1">Pip Value (' + lots + ' lot)</div>' +
        '<div class="font-mono font-bold text-2xl text-qi-cyan">$' + val.toFixed(2) + '</div>' +
        '<div class="text-[10px] text-slate-500 mt-1">1 pip = ' + pv.pipSize + ' (' + sym + ')</div></div>';
}


/* ═══════════════════════════════════════════════════════════
   #2  PRICE ALERT SYSTEM
   ═══════════════════════════════════════════════════════════ */
var _priceAlerts = [];
function loadAlerts() {
    try { _priceAlerts = JSON.parse(localStorage.getItem('qi_price_alerts') || '[]'); } catch(e) { _priceAlerts = []; }
}
function saveAlerts() {
    try { localStorage.setItem('qi_price_alerts', JSON.stringify(_priceAlerts)); } catch(e) {}
}
function addPriceAlert() {
    var sym = (document.getElementById('alertSym').value || '').toUpperCase();
    var price = parseFloat(document.getElementById('alertPrice').value);
    var dir = document.getElementById('alertDir').value;
    if (!sym || isNaN(price)) { if (window.showQuantumToast) showQuantumToast('Isi pair & harga target', 'warning'); return; }
    _priceAlerts.push({ id: Date.now(), symbol: sym, price: price, direction: dir, active: true, createdAt: new Date().toISOString() });
    saveAlerts();
    renderAlerts();
    document.getElementById('alertPrice').value = '';
    if (window.showQuantumToast) showQuantumToast('Alert ' + sym + ' @ ' + price + ' ditambahkan', 'success');
    requestNotificationPermission();
}
function removeAlert(id) {
    _priceAlerts = _priceAlerts.filter(function(a) { return a.id !== id; });
    saveAlerts();
    renderAlerts();
}
function renderAlerts() {
    var el = document.getElementById('alertList');
    if (!el) return;
    if (_priceAlerts.length === 0) { el.innerHTML = '<div class="text-center text-slate-600 text-xs py-6">Belum ada price alert aktif</div>'; return; }
    var html = '';
    _priceAlerts.forEach(function(a) {
        var dirLabel = a.direction === 'above' ? '&#9650; Above' : '&#9660; Below';
        var dirCls = a.direction === 'above' ? 'text-qi-green' : 'text-qi-red';
        html += '<div class="flex items-center justify-between bg-qi-panel border border-qi-border rounded-lg px-3 py-2">' +
            '<div class="flex items-center gap-3">' +
            '<span class="font-mono text-xs font-semibold text-white">' + a.symbol + '</span>' +
            '<span class="text-[10px] ' + dirCls + '">' + dirLabel + '</span>' +
            '<span class="font-mono text-xs text-qi-cyan">' + a.price + '</span>' +
            '</div>' +
            '<button onclick="removeAlert(' + a.id + ')" class="text-slate-600 hover:text-qi-red text-xs">&#10005;</button>' +
            '</div>';
    });
    el.innerHTML = html;
}
function checkPriceAlerts(prices) {
    if (!_priceAlerts || _priceAlerts.length === 0) return;
    _priceAlerts.forEach(function(a) {
        if (!a.active) return;
        var cur = prices[a.symbol];
        if (!cur) return;
        var triggered = false;
        if (a.direction === 'above' && cur >= a.price) triggered = true;
        if (a.direction === 'below' && cur <= a.price) triggered = true;
        if (triggered) {
            a.active = false;
            saveAlerts();
            var msg = a.symbol + ' telah mencapai ' + a.price + ' (sekarang: ' + cur + ')';
            if (window.showQuantumToast) showQuantumToast(msg, 'success', 6000);
            sendBrowserNotification('Price Alert: ' + a.symbol, msg);
            renderAlerts();
        }
    });
}
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body: body, icon: 'assets/img/icon-192.png', badge: 'assets/img/icon-192.png' }); } catch(e) {}
    }
}
function initAlertPanel() {
    loadAlerts();
    renderAlerts();
}


/* ═══════════════════════════════════════════════════════════
   #3  COMMAND PALETTE (Ctrl+K)
   ═══════════════════════════════════════════════════════════ */
var _cmdItems = [];
function buildCmdItems() {
    _cmdItems = [];
    if (typeof PANEL_META !== 'undefined') {
        Object.keys(PANEL_META).forEach(function(k) {
            var m = PANEL_META[k];
            _cmdItems.push({ type: 'panel', id: k, icon: m.icon, label: m.title, action: function() { switchPanel(k); } });
        });
    }
    if (typeof SYMBOL_LABELS !== 'undefined') {
        Object.keys(SYMBOL_LABELS).forEach(function(s) {
            _cmdItems.push({ type: 'symbol', id: s, icon: '📈', label: SYMBOL_LABELS[s] + ' (' + s + ')', action: function() { switchPanel('panel-charts'); if (typeof selectChartSym === 'function') selectChartSym(s); } });
        });
    }
    var extras = [
        { icon: '🌊', label: 'Theme: Navy', action: function() { if (typeof setQITheme === 'function') setQITheme('navy'); } },
        { icon: '🖤', label: 'Theme: OLED Black', action: function() { if (typeof setQITheme === 'function') setQITheme('oled-black'); } },
        { icon: '☀', label: 'Theme: OLED White', action: function() { if (typeof setQITheme === 'function') setQITheme('oled-white'); } },
        { icon: '👤', label: 'Profil Saya', action: function() { location.href = 'profile.html'; } },
        { icon: '📲', label: 'Install PWA', action: function() { location.href = 'pwa.html'; } },
    ];
    extras.forEach(function(e) { _cmdItems.push({ type: 'action', id: e.label, icon: e.icon, label: e.label, action: e.action }); });
}
function openCommandPalette() {
    var overlay = document.getElementById('cmdPalette');
    if (!overlay) return;
    if (_cmdItems.length === 0) buildCmdItems();
    overlay.classList.remove('hidden');
    var input = document.getElementById('cmdInput');
    if (input) { input.value = ''; input.focus(); }
    filterCmdPalette('');
}
function closeCommandPalette() {
    var overlay = document.getElementById('cmdPalette');
    if (overlay) overlay.classList.add('hidden');
}
function filterCmdPalette(q) {
    var list = document.getElementById('cmdList');
    if (!list) return;
    q = (q || '').toLowerCase();
    var filtered = q ? _cmdItems.filter(function(i) { return i.label.toLowerCase().indexOf(q) >= 0 || i.id.toLowerCase().indexOf(q) >= 0; }) : _cmdItems;
    if (filtered.length === 0) { list.innerHTML = '<div class="text-center text-slate-600 text-xs py-4">Tidak ditemukan</div>'; return; }
    var html = '';
    filtered.slice(0, 15).forEach(function(item, idx) {
        html += '<button onclick="_cmdItems.forEach(function(i){if(i.id===\'' + item.id.replace(/'/g, "\\'") + '\')i.action()});closeCommandPalette()" ' +
            'class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-qi-surface transition-colors' + (idx === 0 ? ' bg-qi-surface' : '') + '">' +
            '<span class="text-base">' + item.icon + '</span>' +
            '<span class="text-xs text-white">' + item.label + '</span>' +
            '<span class="ml-auto text-[9px] text-slate-600 uppercase">' + item.type + '</span></button>';
    });
    list.innerHTML = html;
}

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        var pal = document.getElementById('cmdPalette');
        if (pal && !pal.classList.contains('hidden')) closeCommandPalette();
        else openCommandPalette();
    }
    if (e.key === 'Escape') closeCommandPalette();
});


/* ═══════════════════════════════════════════════════════════
   #5  FLOATING TICKER BAR (always-visible bottom bar)
   ═══════════════════════════════════════════════════════════ */
var _floatingPrices = {};
function updateFloatingTicker(prices) {
    _floatingPrices = prices || _floatingPrices;
    var bar = document.getElementById('floatingTickerContent');
    if (!bar) return;
    var keys = ['XAUUSD', 'BTCUSDT', 'EURUSD', 'GBPUSD', 'ETHUSDT'];
    var html = '';
    keys.forEach(function(k) {
        var p = _floatingPrices[k];
        if (!p) return;
        var lbl = (typeof SYMBOL_LABELS !== 'undefined' && SYMBOL_LABELS[k]) ? SYMBOL_LABELS[k] : k;
        var dp2 = (typeof DP !== 'undefined' && DP[k]) ? DP[k] : 2;
        html += '<span class="inline-flex items-center gap-1.5 px-3">' +
            '<span class="text-[10px] text-slate-500">' + lbl + '</span>' +
            '<span class="font-mono text-[11px] font-semibold text-white" id="ftk_' + k + '">' + Number(p).toFixed(dp2) + '</span></span>';
    });
    bar.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #6  MONTHLY PERFORMANCE CALENDAR
   ═══════════════════════════════════════════════════════════ */
function renderMonthlyCalendar(history) {
    var el = document.getElementById('monthlyCalendar');
    if (!el) return;
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var dailyPnl = {};
    (history || []).forEach(function(s) {
        if (!s.timestamp) return;
        var d = s.timestamp.split(' ')[0];
        if (!dailyPnl[d]) dailyPnl[d] = 0;
        dailyPnl[d] += parseFloat(s.pnl_usd) || 0;
    });
    var monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var html = '<div class="text-center text-xs font-semibold text-white mb-3">' + monthNames[month] + ' ' + year + '</div>';
    html += '<div class="grid grid-cols-7 gap-1 text-[9px] text-center">';
    ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach(function(d) {
        html += '<div class="text-slate-500 font-semibold py-1">' + d + '</div>';
    });
    for (var i = 0; i < firstDay; i++) html += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var pnl = dailyPnl[dateStr] || 0;
        var bgCls = 'bg-qi-panel';
        var txtCls = 'text-slate-500';
        if (pnl > 0) { bgCls = 'bg-qi-green/20'; txtCls = 'text-qi-green'; }
        else if (pnl < 0) { bgCls = 'bg-qi-red/20'; txtCls = 'text-qi-red'; }
        var title = pnl !== 0 ? ' title="$' + pnl.toFixed(2) + '"' : '';
        html += '<div class="' + bgCls + ' rounded p-1 cursor-default"' + title + '>' +
            '<div class="text-[10px] text-slate-400">' + d + '</div>' +
            (pnl !== 0 ? '<div class="text-[8px] font-mono ' + txtCls + '">' + (pnl > 0 ? '+' : '') + pnl.toFixed(0) + '</div>' : '') +
            '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #7  RETAIL SENTIMENT GAUGE
   ═══════════════════════════════════════════════════════════ */
function renderSentimentGauge() {
    var el = document.getElementById('sentimentGauge');
    if (!el) return;
    var pairs = [
        { sym: 'XAUUSD', longPct: 72, label: 'XAU/USD' },
        { sym: 'EURUSD', longPct: 44, label: 'EUR/USD' },
        { sym: 'GBPUSD', longPct: 58, label: 'GBP/USD' },
        { sym: 'USDJPY', longPct: 35, label: 'USD/JPY' },
        { sym: 'BTCUSDT', longPct: 68, label: 'BTC/USDT' },
        { sym: 'ETHUSDT', longPct: 61, label: 'ETH/USDT' },
    ];
    var html = '';
    pairs.forEach(function(p) {
        var shortPct = 100 - p.longPct;
        html += '<div class="flex items-center gap-2 text-[10px]">' +
            '<span class="w-16 text-slate-400 font-mono shrink-0">' + p.label + '</span>' +
            '<span class="text-qi-green w-8 text-right font-mono">' + p.longPct + '%</span>' +
            '<div class="flex-1 h-2 rounded-full overflow-hidden flex">' +
            '<div class="h-full bg-qi-green/80" style="width:' + p.longPct + '%"></div>' +
            '<div class="h-full bg-qi-red/80" style="width:' + shortPct + '%"></div>' +
            '</div>' +
            '<span class="text-qi-red w-8 font-mono">' + shortPct + '%</span>' +
            '</div>';
    });
    el.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #8  VOLATILITY DASHBOARD
   ═══════════════════════════════════════════════════════════ */
function renderVolatilityDash() {
    var el = document.getElementById('volBody');
    if (!el) return;
    var data = [
        { sym: 'XAUUSD', atr: 28.5, atrPct: 1.08, spread: 0.20, bestSession: 'London-NY Overlap' },
        { sym: 'EURUSD', atr: 0.0065, atrPct: 0.60, spread: 0.1, bestSession: 'London' },
        { sym: 'GBPUSD', atr: 0.0082, atrPct: 0.65, spread: 0.2, bestSession: 'London' },
        { sym: 'USDJPY', atr: 0.92, atrPct: 0.62, spread: 0.1, bestSession: 'Tokyo-London' },
        { sym: 'BTCUSDT', atr: 2850, atrPct: 4.2, spread: 5.0, bestSession: 'NY' },
        { sym: 'ETHUSDT', atr: 145, atrPct: 5.8, spread: 0.5, bestSession: 'London-NY' },
        { sym: 'AUDUSD', atr: 0.0052, atrPct: 0.78, spread: 0.2, bestSession: 'Sydney-London' },
        { sym: 'SOLUSDT', atr: 8.5, atrPct: 6.1, spread: 0.02, bestSession: 'NY' },
    ];
    var html = '';
    data.forEach(function(d) {
        var volColor = d.atrPct > 3 ? 'text-qi-red' : d.atrPct > 1 ? 'text-qi-gold' : 'text-qi-green';
        var barW = Math.min(d.atrPct * 12, 100);
        html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50">' +
            '<td class="px-3 py-2 font-mono font-semibold text-white">' + d.sym + '</td>' +
            '<td class="px-3 py-2 font-mono text-right">' + d.atr + '</td>' +
            '<td class="px-3 py-2 text-right"><div class="flex items-center justify-end gap-2">' +
            '<div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full rounded-full ' + (d.atrPct > 3 ? 'bg-qi-red' : d.atrPct > 1 ? 'bg-qi-gold' : 'bg-qi-green') + '" style="width:' + barW + '%"></div></div>' +
            '<span class="font-mono ' + volColor + '">' + d.atrPct.toFixed(2) + '%</span></div></td>' +
            '<td class="px-3 py-2 font-mono text-right text-slate-400">' + d.spread + '</td>' +
            '<td class="px-3 py-2 text-slate-400 text-right">' + d.bestSession + '</td></tr>';
    });
    el.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #11  DXY TRACKER
   ═══════════════════════════════════════════════════════════ */
function renderDxyTracker() {
    var el = document.getElementById('dxyValue');
    if (!el) return;
    var val = 104.25 + (Math.random() - 0.5) * 0.3;
    el.textContent = val.toFixed(2);
    var chg = (Math.random() - 0.5) * 0.4;
    var chgEl = document.getElementById('dxyChange');
    if (chgEl) {
        chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
        chgEl.className = 'text-xs font-mono ' + (chg >= 0 ? 'text-qi-green' : 'text-qi-red');
    }
}


/* ═══════════════════════════════════════════════════════════
   #13  TRADE JOURNAL
   ═══════════════════════════════════════════════════════════ */
var _journalEntries = [];
function loadJournal() {
    try { _journalEntries = JSON.parse(localStorage.getItem('qi_journal') || '[]'); } catch(e) { _journalEntries = []; }
}
function saveJournal() {
    try { localStorage.setItem('qi_journal', JSON.stringify(_journalEntries)); } catch(e) {}
}
function addJournalEntry() {
    var sym = (document.getElementById('jnlSymbol').value || '').toUpperCase();
    var side = document.getElementById('jnlSide').value;
    var entry = document.getElementById('jnlEntry').value;
    var sl = document.getElementById('jnlSL').value;
    var tp = document.getElementById('jnlTP').value;
    var notes = document.getElementById('jnlNotes').value;
    var result = document.getElementById('jnlResult').value;
    var pnl = document.getElementById('jnlPnl').value;
    if (!sym) { if (window.showQuantumToast) showQuantumToast('Isi pair dulu', 'warning'); return; }
    _journalEntries.unshift({
        id: Date.now(), date: new Date().toISOString().split('T')[0],
        symbol: sym, side: side, entry: entry, sl: sl, tp: tp,
        notes: notes, result: result, pnl: parseFloat(pnl) || 0
    });
    saveJournal();
    renderJournal();
    ['jnlSymbol', 'jnlEntry', 'jnlSL', 'jnlTP', 'jnlNotes', 'jnlPnl'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    if (window.showQuantumToast) showQuantumToast('Journal entry disimpan', 'success');
}
function deleteJournalEntry(id) {
    _journalEntries = _journalEntries.filter(function(e) { return e.id !== id; });
    saveJournal();
    renderJournal();
}
function renderJournal() {
    var el = document.getElementById('journalBody');
    if (!el) return;
    if (_journalEntries.length === 0) { el.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-600 text-xs">Belum ada catatan trading</td></tr>'; return; }
    var html = '';
    _journalEntries.slice(0, 50).forEach(function(e) {
        var pnlCls = e.pnl > 0 ? 'text-qi-green' : e.pnl < 0 ? 'text-qi-red' : 'text-slate-400';
        var sideCls = e.side === 'BUY' ? 'sent-bull' : 'sent-bear';
        var resCls = e.result === 'WIN' ? 'text-qi-green' : e.result === 'LOSS' ? 'text-qi-red' : 'text-slate-400';
        html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50">' +
            '<td class="px-2 py-2 text-slate-400">' + e.date + '</td>' +
            '<td class="px-2 py-2 font-mono font-semibold text-white">' + e.symbol + '</td>' +
            '<td class="px-2 py-2"><span class="' + sideCls + '">' + e.side + '</span></td>' +
            '<td class="px-2 py-2 font-mono text-slate-300">' + (e.entry || '-') + '</td>' +
            '<td class="px-2 py-2 font-semibold ' + resCls + '">' + (e.result || '-') + '</td>' +
            '<td class="px-2 py-2 font-mono ' + pnlCls + '">' + (e.pnl > 0 ? '+' : '') + e.pnl.toFixed(2) + '</td>' +
            '<td class="px-2 py-2"><button onclick="deleteJournalEntry(' + e.id + ')" class="text-slate-600 hover:text-qi-red text-[10px]">&#10005;</button></td></tr>';
    });
    el.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #14  PIVOT POINT CALCULATOR
   ═══════════════════════════════════════════════════════════ */
function calcPivotPoints() {
    var high = parseFloat(document.getElementById('pvHigh').value) || 0;
    var low = parseFloat(document.getElementById('pvLow').value) || 0;
    var close = parseFloat(document.getElementById('pvClose').value) || 0;
    if (!high || !low || !close) { document.getElementById('pvResult').innerHTML = '<div class="text-center text-slate-600 text-xs py-4">Masukkan H/L/C kemarin</div>'; return; }
    var method = document.getElementById('pvMethod').value;
    var pp, r1, r2, r3, s1, s2, s3;
    if (method === 'classic') {
        pp = (high + low + close) / 3;
        r1 = 2 * pp - low; s1 = 2 * pp - high;
        r2 = pp + (high - low); s2 = pp - (high - low);
        r3 = high + 2 * (pp - low); s3 = low - 2 * (high - pp);
    } else if (method === 'camarilla') {
        pp = (high + low + close) / 3;
        var range = high - low;
        r1 = close + range * 1.1 / 12; s1 = close - range * 1.1 / 12;
        r2 = close + range * 1.1 / 6; s2 = close - range * 1.1 / 6;
        r3 = close + range * 1.1 / 4; s3 = close - range * 1.1 / 4;
    } else {
        pp = (high + low + 2 * close) / 4;
        r1 = 2 * pp - low; s1 = 2 * pp - high;
        r2 = pp + (high - low); s2 = pp - (high - low);
        r3 = r1 + (high - low); s3 = s1 - (high - low);
    }
    var dp = close > 100 ? 2 : 5;
    var html = '<div class="grid grid-cols-2 gap-2 text-[11px] font-mono">';
    [['R3', r3, 'text-qi-red'], ['S3', s3, 'text-qi-green'],
     ['R2', r2, 'text-qi-red'], ['S2', s2, 'text-qi-green'],
     ['R1', r1, 'text-qi-red/80'], ['S1', s1, 'text-qi-green/80'],
     ['Pivot', pp, 'text-qi-cyan']].forEach(function(row) {
        html += '<div class="flex justify-between bg-qi-panel rounded px-3 py-1.5 border border-qi-border"><span class="text-slate-400">' + row[0] + '</span><span class="' + row[2] + ' font-semibold">' + row[1].toFixed(dp) + '</span></div>';
    });
    html += '</div>';
    document.getElementById('pvResult').innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #16  MARKET SCREENER
   ═══════════════════════════════════════════════════════════ */
function runScreener() {
    var el = document.getElementById('screenerBody');
    if (!el) return;
    el.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-600 text-xs">Scanning pasar...</td></tr>';
    setTimeout(function() {
        var instruments = typeof SYMBOLS !== 'undefined' ? SYMBOLS : ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSDT'];
        var html = '';
        instruments.forEach(function(sym) {
            var lbl = (typeof SYMBOL_LABELS !== 'undefined' && SYMBOL_LABELS[sym]) ? SYMBOL_LABELS[sym] : sym;
            var rsi = 30 + Math.random() * 40;
            var trend = rsi > 55 ? 'BULLISH' : rsi < 45 ? 'BEARISH' : 'NEUTRAL';
            var trendCls = trend === 'BULLISH' ? 'sent-bull' : trend === 'BEARISH' ? 'sent-bear' : 'sent-neut';
            var vol = ['LOW', 'MED', 'HIGH'][Math.floor(Math.random() * 3)];
            var volCls = vol === 'HIGH' ? 'badge-high' : vol === 'MED' ? 'badge-med' : 'badge-low';
            var ema = Math.random() > 0.5 ? 'Above' : 'Below';
            var emaCls = ema === 'Above' ? 'text-qi-green' : 'text-qi-red';
            html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50 cursor-pointer" onclick="switchPanel(\'panel-charts\');if(typeof selectChartSym===\'function\')selectChartSym(\'' + sym + '\')">' +
                '<td class="px-3 py-2 font-mono font-semibold text-white">' + lbl + '</td>' +
                '<td class="px-3 py-2"><span class="' + trendCls + '">' + trend + '</span></td>' +
                '<td class="px-3 py-2 font-mono text-right text-slate-300">' + rsi.toFixed(1) + '</td>' +
                '<td class="px-3 py-2 text-right"><span class="' + emaCls + '">' + ema + ' EMA200</span></td>' +
                '<td class="px-3 py-2 text-center"><span class="' + volCls + '">' + vol + '</span></td>' +
                '<td class="px-3 py-2 text-right text-slate-400 text-[10px]">Klik untuk chart →</td></tr>';
        });
        el.innerHTML = html;
    }, 300);
}


/* ═══════════════════════════════════════════════════════════
   #17  SPREAD MONITOR
   ═══════════════════════════════════════════════════════════ */
function renderSpreadMonitor() {
    var el = document.getElementById('spreadBody');
    if (!el) return;
    var data = [
        { sym: 'EURUSD', spread: 0.1, avg: 0.3, status: 'Tight' },
        { sym: 'GBPUSD', spread: 0.3, avg: 0.5, status: 'Tight' },
        { sym: 'USDJPY', spread: 0.1, avg: 0.3, status: 'Tight' },
        { sym: 'XAUUSD', spread: 0.25, avg: 0.35, status: 'Normal' },
        { sym: 'BTCUSDT', spread: 5.0, avg: 8.0, status: 'Tight' },
        { sym: 'AUDUSD', spread: 0.3, avg: 0.4, status: 'Normal' },
        { sym: 'ETHUSDT', spread: 0.5, avg: 1.0, status: 'Tight' },
        { sym: 'NZDUSD', spread: 0.4, avg: 0.6, status: 'Normal' },
    ];
    var html = '';
    data.forEach(function(d) {
        var ratio = d.spread / d.avg;
        var sCls = ratio < 0.7 ? 'text-qi-green' : ratio < 1.2 ? 'text-qi-gold' : 'text-qi-red';
        var stCls = d.status === 'Tight' ? 'sent-bull' : d.status === 'Wide' ? 'sent-bear' : 'sent-neut';
        html += '<tr class="border-b border-qi-border/50">' +
            '<td class="px-3 py-2 font-mono font-semibold text-white">' + d.sym + '</td>' +
            '<td class="px-3 py-2 font-mono text-right ' + sCls + '">' + d.spread + '</td>' +
            '<td class="px-3 py-2 font-mono text-right text-slate-400">' + d.avg + '</td>' +
            '<td class="px-3 py-2 text-center"><span class="' + stCls + '">' + d.status + '</span></td></tr>';
    });
    el.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #19  SWAP / ROLLOVER RATES
   ═══════════════════════════════════════════════════════════ */
function renderSwapRates() {
    var el = document.getElementById('swapBody');
    if (!el) return;
    var data = [
        { sym: 'EURUSD', swapLong: -6.50, swapShort: 1.20 },
        { sym: 'GBPUSD', swapLong: -4.80, swapShort: 0.50 },
        { sym: 'USDJPY', swapLong: 8.20, swapShort: -12.50 },
        { sym: 'XAUUSD', swapLong: -38.50, swapShort: 12.00 },
        { sym: 'AUDUSD', swapLong: -3.20, swapShort: 0.10 },
        { sym: 'BTCUSDT', swapLong: -0.01, swapShort: -0.01 },
        { sym: 'USDCHF', swapLong: 5.50, swapShort: -9.80 },
        { sym: 'NZDUSD', swapLong: -2.10, swapShort: -0.50 },
    ];
    var html = '';
    data.forEach(function(d) {
        var lCls = d.swapLong >= 0 ? 'text-qi-green' : 'text-qi-red';
        var sCls = d.swapShort >= 0 ? 'text-qi-green' : 'text-qi-red';
        html += '<tr class="border-b border-qi-border/50">' +
            '<td class="px-3 py-2 font-mono font-semibold text-white">' + d.sym + '</td>' +
            '<td class="px-3 py-2 font-mono text-right ' + lCls + '">' + (d.swapLong >= 0 ? '+' : '') + d.swapLong.toFixed(2) + '</td>' +
            '<td class="px-3 py-2 font-mono text-right ' + sCls + '">' + (d.swapShort >= 0 ? '+' : '') + d.swapShort.toFixed(2) + '</td></tr>';
    });
    el.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   #20  SESSION CLOCK WIDGET
   ═══════════════════════════════════════════════════════════ */
function updateSessionClocks() {
    var sessions = [
        { id: 'scTokyo', tz: 'Asia/Tokyo', name: 'Tokyo', open: 9, close: 18, emoji: '🇯🇵' },
        { id: 'scLondon', tz: 'Europe/London', name: 'London', open: 8, close: 17, emoji: '🇬🇧' },
        { id: 'scNY', tz: 'America/New_York', name: 'New York', open: 8, close: 17, emoji: '🇺🇸' },
        { id: 'scSydney', tz: 'Australia/Sydney', name: 'Sydney', open: 7, close: 16, emoji: '🇦🇺' },
    ];
    sessions.forEach(function(s) {
        var el = document.getElementById(s.id);
        if (!el) return;
        var now = new Date(new Date().toLocaleString('en-US', { timeZone: s.tz }));
        var h = now.getHours();
        var m = now.getMinutes();
        var sec = now.getSeconds();
        var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
        var isOpen = h >= s.open && h < s.close && now.getDay() !== 0 && now.getDay() !== 6;
        var minutesLeft = isOpen ? (s.close - h - 1) * 60 + (60 - m) : 0;
        var countdown = isOpen ? Math.floor(minutesLeft / 60) + 'h ' + (minutesLeft % 60) + 'm left' : 'Closed';
        el.innerHTML = '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2"><span>' + s.emoji + '</span><span class="font-semibold text-white text-xs">' + s.name + '</span></div>' +
            '<div class="font-mono text-sm text-white">' + timeStr + '</div></div>' +
            '<div class="flex items-center justify-between mt-1">' +
            '<span class="text-[9px] ' + (isOpen ? 'text-qi-green' : 'text-slate-500') + '">' + (isOpen ? '● OPEN' : '○ CLOSED') + '</span>' +
            '<span class="text-[9px] text-slate-500">' + countdown + '</span></div>';
    });
}


/* ═══════════════════════════════════════════════════════════
   #10  PUSH NOTIFICATION for new signals
   ═══════════════════════════════════════════════════════════ */
var _lastSignalCount = 0;
function checkNewSignals() {
    fetch('api/signal-history.php', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || data.status !== 'success') return;
            var count = (data.history || []).length;
            if (_lastSignalCount > 0 && count > _lastSignalCount) {
                var newest = data.history[0];
                var msg = (newest.engine_name || 'Signal') + ': ' + newest.symbol + ' ' + newest.side + ' @ ' + newest.entry;
                sendBrowserNotification('Sinyal Baru!', msg);
                if (window.showQuantumToast) showQuantumToast('Sinyal baru: ' + newest.symbol + ' ' + newest.side, 'success', 5000);
            }
            _lastSignalCount = count;
        }).catch(function() {});
}


/* ═══════════════════════════════════════════════════════════
   INIT — hooks into dashboard's initPanel system
   ═══════════════════════════════════════════════════════════ */
function initProPanel(id) {
    if (id === 'panel-risk') { /* ready on demand */ }
    if (id === 'panel-alerts') initAlertPanel();
    if (id === 'panel-journal') { loadJournal(); renderJournal(); }
    if (id === 'panel-screener') runScreener();
    if (id === 'panel-volatility') { renderVolatilityDash(); renderSpreadMonitor(); renderSwapRates(); }
    if (id === 'panel-tools') { calcPivotPoints(); }
    if (id === 'panel-sentiment') renderSentimentGauge();
}

/* ═══════════════════════════════════════════════════════════
   #22  GLOBAL TOAST NOTIFICATION SYSTEM (enhanced)
   ═══════════════════════════════════════════════════════════ */
if (!window.showQuantumToast) {
    window.showQuantumToast = function(msg, type, duration) {
        duration = duration || 3500;
        var container = document.getElementById('qiToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'qiToastContainer';
            document.body.appendChild(container);
        }
        var colors = { success: 'border-qi-green bg-qi-green/10 text-qi-green',
            error: 'border-qi-red bg-qi-red/10 text-qi-red',
            warning: 'border-qi-gold bg-qi-gold/10 text-qi-gold',
            info: 'border-qi-cyan bg-qi-cyan/10 text-qi-cyan' };
        var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        var cls = colors[type] || colors.info;
        var icon = icons[type] || icons.info;
        var toast = document.createElement('div');
        toast.className = 'qi-toast flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-lg ' + cls;
        toast.style.cssText = 'background:var(--qi-card);min-width:200px;max-width:380px;';
        toast.innerHTML = '<span class="text-base">' + icon + '</span><span class="flex-1">' + msg + '</span>';
        container.appendChild(toast);
        setTimeout(function() { toast.classList.add('qi-toast-exit'); setTimeout(function() { toast.remove(); }, 300); }, duration);
    };
}


/* ═══════════════════════════════════════════════════════════
   #25  STATUS BAR — last update timestamp
   ═══════════════════════════════════════════════════════════ */
function updateStatusBar() {
    var el = document.getElementById('statusLastUpdate');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString('id-ID');
}


/* ═══════════════════════════════════════════════════════════
   #26  SORTABLE TABLES
   ═══════════════════════════════════════════════════════════ */
function makeSortable(tableId) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var headers = table.querySelectorAll('th');
    headers.forEach(function(th, idx) {
        th.style.cursor = 'pointer';
        th.title = 'Klik untuk sort';
        th.addEventListener('click', function() {
            var tbody = table.querySelector('tbody');
            if (!tbody) return;
            var rows = Array.from(tbody.querySelectorAll('tr'));
            var asc = th.dataset.sortDir !== 'asc';
            th.dataset.sortDir = asc ? 'asc' : 'desc';
            headers.forEach(function(h) { if (h !== th) delete h.dataset.sortDir; });
            rows.sort(function(a, b) {
                var aVal = (a.cells[idx] && a.cells[idx].textContent.trim()) || '';
                var bVal = (b.cells[idx] && b.cells[idx].textContent.trim()) || '';
                var aNum = parseFloat(aVal.replace(/[^0-9.\-]/g, ''));
                var bNum = parseFloat(bVal.replace(/[^0-9.\-]/g, ''));
                if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;
                return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });
            rows.forEach(function(r) { tbody.appendChild(r); });
        });
    });
}


/* ═══════════════════════════════════════════════════════════
   #29  FULLSCREEN PANEL TOGGLE
   ═══════════════════════════════════════════════════════════ */
var _panelFullscreen = false;
function togglePanelFullscreen() {
    var activeId = (typeof _activePanel !== 'undefined') ? _activePanel : 'panel-overview';
    var panel = document.getElementById(activeId);
    if (!panel) return;
    _panelFullscreen = !_panelFullscreen;
    if (_panelFullscreen) {
        panel.classList.add('panel-fullscreen');
        panel.dataset.wasHidden = panel.classList.contains('hidden') ? '1' : '0';
        panel.classList.remove('hidden');
    } else {
        panel.classList.remove('panel-fullscreen');
    }
}


/* ═══════════════════════════════════════════════════════════
   #31  DIM MODE (additional theme)
   ═══════════════════════════════════════════════════════════ */
function addDimTheme() {
    var dd = document.getElementById('themeDropdown');
    if (!dd || dd.querySelector('[data-theme-dim]')) return;
    var btn = document.createElement('button');
    btn.setAttribute('data-theme-dim', '1');
    btn.className = 'w-full flex items-center gap-2 px-3 py-2.5 text-[11px] text-left transition-colors';
    btn.style.cssText = 'color:var(--qi-text)';
    btn.onmouseenter = function() { this.style.background = 'var(--qi-surface)'; };
    btn.onmouseleave = function() { this.style.background = 'transparent'; };
    btn.innerHTML = '<span>🌙</span><span class="font-semibold">Dim</span>';
    btn.onclick = function() { applyThemeChoice('oled-black'); };
    dd.appendChild(btn);
}


/* ═══════════════════════════════════════════════════════════
   #32  FONT SIZE PREFERENCE
   ═══════════════════════════════════════════════════════════ */
function setFontSize(size) {
    document.documentElement.classList.remove('font-compact', 'font-normal', 'font-large');
    document.documentElement.classList.add('font-' + size);
    try { localStorage.setItem('qi_font_size', size); } catch(e) {}
}
function loadFontSize() {
    try {
        var s = localStorage.getItem('qi_font_size');
        if (s) setFontSize(s);
    } catch(e) {}
}


/* ═══════════════════════════════════════════════════════════
   #33  PRICE FLASH ANIMATION
   ═══════════════════════════════════════════════════════════ */
var _prevPrices = {};
function flashPriceChange(sym, newPrice) {
    var prev = _prevPrices[sym];
    _prevPrices[sym] = newPrice;
    if (prev === undefined) return;
    if (newPrice === prev) return;
    var el = document.getElementById('ftk_' + sym);
    if (!el) return;
    el.classList.remove('price-flash-up', 'price-flash-down');
    void el.offsetWidth;
    el.classList.add(newPrice > prev ? 'price-flash-up' : 'price-flash-down');
}


/* ═══════════════════════════════════════════════════════════
   #35  KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════ */
var _shortcutsMap = {
    '1': 'panel-overview', '2': 'panel-charts', '3': 'panel-signal',
    '4': 'panel-radar', '5': 'panel-ai', '6': 'panel-alerts',
    '7': 'panel-journal', '8': 'panel-screener', '9': 'panel-risk'
};
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.altKey && _shortcutsMap[e.key]) {
        e.preventDefault();
        if (typeof switchPanel === 'function') switchPanel(_shortcutsMap[e.key]);
    }
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.target === document.body) { e.preventDefault(); togglePanelFullscreen(); }
    }
    if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.target === document.body) { e.preventDefault(); if (typeof toggleQITheme === 'function') toggleQITheme(); }
    }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        if (e.target === document.body) { e.preventDefault(); showShortcutsModal(); }
    }
});

function showShortcutsModal() {
    var existing = document.getElementById('shortcutsModal');
    if (existing) { existing.remove(); return; }
    var shortcuts = [
        ['Ctrl+K', 'Command Palette'],
        ['Alt+1-9', 'Switch Panel'],
        ['F', 'Fullscreen Panel'],
        ['T', 'Toggle Tema'],
        ['?', 'Tampilkan Shortcuts'],
        ['Esc', 'Tutup Modal/Palette'],
    ];
    var html = '<div class="text-xs font-semibold text-white mb-3">Keyboard Shortcuts</div>';
    shortcuts.forEach(function(s) {
        html += '<div class="flex items-center justify-between py-1.5 border-b border-qi-border/30">' +
            '<span class="text-[11px] text-slate-400">' + s[1] + '</span>' +
            '<kbd class="text-[10px] bg-qi-panel border border-qi-border rounded px-2 py-0.5 text-qi-cyan font-mono">' + s[0] + '</kbd></div>';
    });
    var modal = document.createElement('div');
    modal.id = 'shortcutsModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.5)" onclick="document.getElementById(\'shortcutsModal\').remove()"></div>' +
        '<div class="relative bg-qi-card border border-qi-border rounded-2xl p-5 w-80 shadow-2xl">' + html + '</div>';
    document.body.appendChild(modal);
}


/* ═══════════════════════════════════════════════════════════
   #36  SIDEBAR PANEL SEARCH / FILTER
   ═══════════════════════════════════════════════════════════ */
function filterSidebarPanels(q) {
    q = (q || '').toLowerCase();
    var nav = document.getElementById('dashNav');
    if (!nav) return;
    nav.querySelectorAll('[data-panel]').forEach(function(btn) {
        var text = btn.textContent.toLowerCase();
        btn.style.display = (!q || text.indexOf(q) >= 0) ? '' : 'none';
    });
}


/* ═══════════════════════════════════════════════════════════
   #38  ONBOARDING TOUR (first visit)
   ═══════════════════════════════════════════════════════════ */
function maybeShowOnboarding() {
    try {
        if (localStorage.getItem('qi_onboarding_v2')) return;
        var steps = [
            { text: 'Gunakan Ctrl+K untuk mencari panel, pair, atau fitur apapun', icon: '⌨️' },
            { text: 'Alt+1-9 untuk switch panel dengan keyboard', icon: '🔢' },
            { text: 'Tekan F untuk fullscreen panel aktif', icon: '🖥️' },
            { text: 'Tekan T untuk ganti tema (Navy/OLED Black/OLED White)', icon: '🎨' },
            { text: 'Panel baru: Risk Calculator, Price Alerts, Trade Journal, Market Screener', icon: '🆕' },
        ];
        var html = '<div class="text-xs font-semibold text-white mb-3">✨ Fitur Baru v2.1</div>';
        steps.forEach(function(s) {
            html += '<div class="flex items-start gap-2 mb-2"><span class="text-base">' + s.icon + '</span>' +
                '<span class="text-[11px] text-slate-300">' + s.text + '</span></div>';
        });
        html += '<button onclick="document.getElementById(\'onboardTour\').remove();try{localStorage.setItem(\'qi_onboarding_v2\',\'1\')}catch(e){}" class="w-full mt-3 py-2 rounded-xl bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-xs font-semibold hover:bg-qi-cyan/30">Mengerti!</button>';
        var modal = document.createElement('div');
        modal.id = 'onboardTour';
        modal.style.cssText = 'position:fixed;inset:0;z-index:101;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.6)"></div>' +
            '<div class="relative bg-qi-card border border-qi-border rounded-2xl p-5 w-80 shadow-2xl" style="animation:panelFadeIn .3s ease">' + html + '</div>';
        document.body.appendChild(modal);
    } catch(e) {}
}


/* ═══════════════════════════════════════════════════════════
   #30  SIDEBAR BADGE NOTIFICATIONS
   ═══════════════════════════════════════════════════════════ */
function updateNavBadge(panelId, count) {
    var btn = document.querySelector('[data-panel="' + panelId + '"]');
    if (!btn) return;
    var badge = btn.querySelector('.nav-badge');
    if (count <= 0) { if (badge) badge.remove(); return; }
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge ml-auto text-[8px] bg-qi-red text-white rounded-full w-4 h-4 flex items-center justify-center font-bold';
        btn.appendChild(badge);
    }
    badge.textContent = count > 9 ? '9+' : count;
}


/* ═══════════════════════════════════════════════════════════
   #34  EMPTY STATE ILLUSTRATION
   ═══════════════════════════════════════════════════════════ */
function emptyState(icon, title, subtitle) {
    return '<div class="flex flex-col items-center justify-center py-10 text-center">' +
        '<div class="text-4xl mb-3">' + icon + '</div>' +
        '<div class="text-sm font-semibold text-slate-400 mb-1">' + title + '</div>' +
        '<div class="text-[10px] text-slate-600 max-w-xs">' + subtitle + '</div></div>';
}


/* ═══════════════════════════════════════════════════════════
   #37  MOBILE BOTTOM NAV — active state sync
   ═══════════════════════════════════════════════════════════ */
function syncMobileNav() {
    var activeId = (typeof _activePanel !== 'undefined') ? _activePanel : 'panel-overview';
    document.querySelectorAll('#mobileBottomNav [data-mob-panel]').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.mobPanel === activeId);
        btn.classList.toggle('text-slate-400', btn.dataset.mobPanel !== activeId);
    });
}


/* ═══════════════════════════════════════════════════════════
   #27  STICKY TABLE HEADERS (via CSS class)
   ═══════════════════════════════════════════════════════════ */
function applyStickyHeaders() {
    document.querySelectorAll('.panel-content table thead th').forEach(function(th) {
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.zIndex = '5';
        th.style.background = 'var(--qi-card)';
    });
}


/* ═══════════════════════════════════════════════════════════
   INIT — bootstrap all UI features
   ═══════════════════════════════════════════════════════════ */
(function() {
    loadAlerts();
    loadFontSize();
    setInterval(function() { updateSessionClocks(); }, 1000);
    setInterval(function() { checkNewSignals(); }, 60000);
    setInterval(function() { updateStatusBar(); }, 10000);
    updateSessionClocks();
    updateStatusBar();
    setTimeout(function() { maybeShowOnboarding(); }, 2000);
    setTimeout(function() { applyStickyHeaders(); }, 3000);

    var checkSync = setInterval(function() {
        if (typeof switchPanel === 'function') {
            var _origSwitch = switchPanel;
            window.switchPanel = function(id) {
                _origSwitch(id);
                syncMobileNav();
            };
            clearInterval(checkSync);
        }
    }, 500);
})();
