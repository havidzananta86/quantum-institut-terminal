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
        // Sumbernya panel Paper Trading (server), bukan localStorage 'QI_PAPER_TRADING' —
        // kunci milik mesin kedua yang sudah dihapus. Setiap daftar dipastikan berupa array
        // lebih dulu: dulu `saved.positions.length` dibaca langsung dan melempar TypeError
        // untuk data lama yang tidak punya kunci itu.
        var baca = function (nama) {
            try {
                var v = (typeof window.qiBacaGlobal === 'function') ? window.qiBacaGlobal(nama) : null;
                return Array.isArray(v) ? v : [];
            } catch (e) { return []; }
        };
        var posisi = baca('_ptPositions');
        var riwayat = baca('_ptHistory');
        if (!posisi.length && !riwayat.length) {
            if (window.showQuantumToast) showQuantumToast('Belum ada paper trades', 'warning'); return;
        }
        var csv = 'ID,Symbol,Side,Lots,Entry,SL,TP,ClosePrice,PnL,Status,OpenTime,CloseTime\n';
        posisi.forEach(function(p) {
            csv += [p.id, p.symbol, p.side, p.lots, p.entryPrice, p.sl, p.tp, '-', p.floatingPnL || 0,
                'OPEN', p.openTime || '', ''].join(',') + '\n';
        });
        riwayat.forEach(function(p) {
            csv += [p.id, p.symbol, p.side, p.lots, p.entryPrice, p.sl, p.tp, p.closePrice || '',
                (p.pnl != null ? p.pnl : p.realizedPnL) || 0, 'CLOSED', p.openTime || '', p.closeTime || ''].join(',') + '\n';
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
    renderPanelWatchlist();
    if (window.showQuantumToast) showQuantumToast(sym + ' ditambahkan ke watchlist', 'success');
}
function removeFromWatchlist(sym) {
    _watchlist = _watchlist.filter(function(s) { return s !== sym; });
    saveWatchlist();
    renderPanelWatchlist();
}
/**
 * Kutipan satu simbol untuk watchlist: harga + perubahan 24 jam.
 *
 * MENGAPA BUKAN window._livePrices SAJA: cache itu hanya terisi untuk simbol yang
 * SEDANG dibuka di chart (ditulis poller chart / stream Binance / tick MT5). Di panel
 * Watchlist — yang justru dibuka saat chart tidak dilihat — hampir semua baris jadi "—".
 * Sumber yang benar adalah _lastPrices milik dashboard-app.js: diisi api/live-price.php
 * untuk SELURUH daftar simbol sekaligus, lengkap dengan chgPct. Dulu kolom "Change"
 * memang tidak pernah diisi apa pun karena datanya tidak pernah dibaca.
 */
function wlKutipan(sym) {
    var d = null;
    try { d = (typeof window.qiBacaGlobal === 'function') ? (window.qiBacaGlobal('_lastPrices') || {})[sym] : null; } catch (e) { d = null; }
    if (d) {
        var hrg = parseFloat(d.price);
        var pct = (d.chgPct === null || d.chgPct === undefined || d.chgPct === '') ? null : parseFloat(d.chgPct);
        return { price: isFinite(hrg) ? hrg : 0, chgPct: (pct !== null && isFinite(pct)) ? pct : null };
    }
    var l = (window._livePrices || {})[sym];
    return { price: (typeof l === 'number' && isFinite(l)) ? l : 0, chgPct: null };
}

function renderPanelWatchlist() {
    var el = document.getElementById('panelWatchlistBody');
    if (!el) return;
    // Wadah bisa berupa <tbody> (panel tabel) atau elemen lain (sidebar). Bila baris
    // <tr>/<td> ditulis ke wadah non-tabel, browser membuang tag tabelnya dan hanya
    // menyisakan teks yang menyatu — itu yang membuat "XAUUSDXAUUSD2654.20✕".
    var isTable = (el.tagName === 'TBODY' || el.tagName === 'TABLE');
    if (!_watchlist.length) {
        el.innerHTML = isTable
            ? '<tr><td colspan="5" class="px-4 py-8 text-center">'
                + '<div class="text-slate-400 text-xs font-semibold mb-1">Watchlist masih kosong</div>'
                + '<div class="text-slate-600 text-[10px] leading-relaxed mb-3">Tambahkan instrumen yang Anda pantau agar harganya '
                + 'muncul di sini dan di sidebar.</div>'
                + '<button type="button" data-qi-aksi="addToWatchlist" '
                + 'class="px-3 py-1.5 rounded-lg bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-[10px] font-bold hover:bg-qi-cyan/30">＋ Tambah instrumen</button>'
                + '</td></tr>'
            : '<div class="px-3 py-4 text-center"><div class="text-slate-400 text-[10px] font-semibold mb-1">Watchlist masih kosong</div>'
                + '<div class="text-slate-600 text-[10px] leading-relaxed">Tambahkan instrumen yang Anda pantau.</div></div>';
        return;
    }
    var labels = window.SYMBOL_LABELS || {};
    var dp = window.DP || {};
    var html = '';
    _watchlist.forEach(function(sym) {
        var q = wlKutipan(sym);
        var lbl = labels[sym] || sym;
        var d = dp[sym] || 2;
        var priceStr = q.price > 0 ? q.price.toFixed(d) : '—';
        var chgStr = (q.chgPct === null) ? '—' : ((q.chgPct >= 0 ? '+' : '') + q.chgPct.toFixed(2) + '%');
        var chgCls = (q.chgPct === null) ? 'text-slate-500' : (q.chgPct >= 0 ? 'text-qi-green' : 'text-qi-red');
        var click = 'data-qi-aksi="bukaChartSimbol" data-qi-arg="' + QIAksi.arg(sym) + '"';
        var remove = '<button data-qi-aksi="hapusDariWatchlist" data-qi-arg="' + QIAksi.arg(sym) + '" class="text-slate-600 hover:text-qi-red text-xs">✕</button>';
        if (isTable) {
            html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50 cursor-pointer" ' + click + '>' +
                '<td class="px-3 py-2 font-mono font-semibold text-white">' + lbl + '</td>' +
                '<td class="px-3 py-2 font-mono text-xs text-slate-400">' + sym + '</td>' +
                '<td class="px-3 py-2 font-mono text-right text-white" id="wl_p_' + sym + '">' + priceStr + '</td>' +
                '<td class="px-3 py-2 text-right"><span id="wl_c_' + sym + '" class="text-[10px] font-mono ' + chgCls + '">' + chgStr + '</span></td>' +
                '<td class="px-3 py-2 text-right">' + remove + '</td></tr>';
        } else {
            html += '<div class="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-qi-border/30 hover:bg-qi-surface/40 cursor-pointer" ' + click + '>' +
                '<div class="min-w-0"><div class="font-mono font-semibold text-white text-[11px]">' + lbl + '</div>' +
                '<div class="font-mono text-[9px] text-slate-500">' + sym + '</div></div>' +
                '<div class="text-right"><div class="font-mono text-[11px] text-white" id="wl_p_' + sym + '">' + priceStr + '</div>' +
                '<div class="font-mono text-[9px] ' + chgCls + '" id="wl_c_' + sym + '">' + chgStr + '</div></div>' +
                '<div class="shrink-0">' + remove + '</div></div>';
        }
    });
    el.innerHTML = html;
}
function updateWatchlistPrices() {
    var dp = window.DP || {};
    _watchlist.forEach(function(sym) {
        var q = wlKutipan(sym);
        var d = dp[sym] || 2;
        var el = document.getElementById('wl_p_' + sym);
        if (el && q.price > 0) el.textContent = q.price.toFixed(d);
        var cEl = document.getElementById('wl_c_' + sym);
        if (cEl) {
            cEl.textContent = (q.chgPct === null) ? '—' : ((q.chgPct >= 0 ? '+' : '') + q.chgPct.toFixed(2) + '%');
            cEl.classList.remove('text-qi-green', 'text-qi-red', 'text-slate-500');
            cEl.classList.add(q.chgPct === null ? 'text-slate-500' : (q.chgPct >= 0 ? 'text-qi-green' : 'text-qi-red'));
        }
    });
}
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
// qim-pages.js (tombol bintang favorit di chart) menulis daftar baru ke localStorage lalu
// memanggil window.loadWatchlist() untuk memuat ulang daftar di memori. Tanpa ekspor ini
// panggilan itu diam-diam dilewati dan panel merender daftar lama.
window.loadWatchlist = loadWatchlist;
// Aksi baris watchlist (data-qi-aksi). Tombol ✕ menghentikan klik supaya baris (buka chart) tidak ikut jalan.
QIAksi.daftar({
    bukaChartSimbol: function(el, e, sym) { switchPanel('panel-charts'); if (typeof selectChartSym === 'function') selectChartSym(sym); },
    hapusDariWatchlist: function(el, e, sym) { e.stopPropagation(); removeFromWatchlist(sym); }
});
window.renderPanelWatchlist = renderPanelWatchlist;
loadWatchlist();


/* ═══════════════════════════════════════════════════════════
   C11  PERFORMANCE ANALYTICS DASHBOARD
   ═══════════════════════════════════════════════════════════ */

/** Riwayat paper trading dari panel Paper Trading (satu-satunya mesin yang nyata). */
function qiPaperRiwayat() {
    try {
        var h = (typeof window.qiBacaGlobal === 'function') ? window.qiBacaGlobal('_ptHistory') : null;
        return Array.isArray(h) ? h : [];
    } catch (e) { return []; }
}

/** Saldo awal = saldo berjalan dikurangi seluruh P/L yang sudah terealisasi. */
function qiSaldoAwalPaper() {
    var BAWAAN = 10000;
    try {
        var saldo = (typeof window.qiBacaGlobal === 'function') ? window.qiBacaGlobal('_ptBalance') : null;
        if (typeof saldo !== 'number' || !isFinite(saldo)) return BAWAAN;
        var realisasi = qiPaperRiwayat().reduce(function (jml, h) {
            var v = parseFloat(h.pnl != null ? h.pnl : h.realizedPnL);
            return jml + (isFinite(v) ? v : 0);
        }, 0);
        var awal = saldo - realisasi;
        return isFinite(awal) && awal > 0 ? awal : BAWAAN;
    } catch (e) { return BAWAAN; }
}

/**
 * Tanggal (YYYY-MM-DD) saat posisi paper DITUTUP.
 * Dulu bagian ini memakai `new Date()` sehingga SETIAP transaksi paper — sejauh apa pun ke
 * belakang — menumpuk di bulan berjalan dan "Monthly P&L Breakdown" selalu salah.
 */
function qiTanggalTutup(h) {
    var kandidat = h.closedAt || h.closeTime || h.openedAt || h.openTime;
    var d = kandidat ? new Date(kandidat) : null;
    if (d && !isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
}
function renderPerformanceDashboard() {
    var entries = [];
    try { entries = JSON.parse(localStorage.getItem('qi_journal') || '[]'); } catch(e) {}
    var allTrades = [];
    entries.forEach(function(e) {
        if (e.result === 'WIN' || e.result === 'LOSS') {
            allTrades.push({ date: e.date, pnl: parseFloat(e.pnl) || 0, source: 'journal' });
        }
    });
    // SUMBER PAPER TRADING: riwayat milik panel Paper Trading (dashboard-app.js), yang
    // tersimpan di server lewat api/paper-trading.php. Dulu bagian ini membaca localStorage
    // 'QI_PAPER_TRADING' — kunci milik mesin paper trading KEDUA yang sudah dihapus dan
    // tidak pernah ditulis panel mana pun, sehingga seluruh transaksi paper nyata diabaikan.
    qiPaperRiwayat().forEach(function(h) {
        allTrades.push({ date: qiTanggalTutup(h), pnl: parseFloat(h.pnl != null ? h.pnl : h.realizedPnL) || 0, source: 'paper' });
    });
    allTrades.sort(function(a, b) { return a.date > b.date ? 1 : -1; });

    // Saldo awal diambil dari mesin paper trading yang sama supaya "Current Equity" di sini
    // tidak bertengkar dengan kartu Evaluasi Performa di panel Akun.
    var saldoAwal = qiSaldoAwalPaper();
    var equity = [saldoAwal];
    var cum = saldoAwal;
    var peak = saldoAwal;
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
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Starting Balance</div><div class="font-mono font-bold text-sm text-white">$' + saldoAwal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div></div>' +
            '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center"><div class="text-[9px] text-slate-500 uppercase mb-1">Current Equity</div><div class="font-mono font-bold text-sm ' + (cum >= saldoAwal ? 'text-qi-green' : 'text-qi-red') + '">$' + cum.toFixed(2) + '</div></div>' +
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
    // ⚠️ PERBAIKAN INTEGRITAS DATA: fungsi ini DULU mengarang angkanya dengan
    // Math.random() — RSI, EMA 200, tren, dan bias semuanya acak, lalu ditampilkan
    // seolah data pasar sungguhan. Aplikasi ini tidak boleh mengarang data, jadi
    // sekarang ia mendelegasikan ke fetchMtfBias() di dashboard.html yang menghitung
    // dari CANDLE SUNGGUHAN (api/get-chart-data.php) dan berkata "data tidak tersedia"
    // bila sumbernya gagal.
    try {
        if (typeof window.fetchMtfBias === 'function') return window.fetchMtfBias();
    } catch (e) {}
    // Cadangan jujur bila fungsi nyata belum tersedia: jangan menampilkan angka palsu.
    var el = document.getElementById('mtfGridPanel') || document.getElementById('mtfGrid');
    if (el) {
        el.innerHTML = '<div class="col-span-full rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-[11px] text-slate-400">'
            + 'Data multi-timeframe sedang dimuat. Bila tidak muncul, sumber candle belum bisa dihubungi — '
            + 'panel ini tidak menampilkan angka perkiraan.</div>';
    }
    var biasEl = document.getElementById('mtfBias');
    if (biasEl) biasEl.innerHTML = '<span class="font-mono font-bold text-lg text-slate-400">MENUNGGU DATA</span>'
        + '<span class="text-[10px] text-slate-500 block">belum ada candle yang terbaca</span>';
}
window.renderMTFView = renderMTFView;


/* ═══════════════════════════════════════════════════════════
   C15  COT REPORT VISUAL (Canvas chart with REAL CFTC data)
   ═══════════════════════════════════════════════════════════ */
var _cotTungguTimer = null;
var _cotTungguSampai = 0;

function renderCotChart() {
    var canvas = document.getElementById('cotChartCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.parentElement.offsetWidth || 400;
    var h = 180;
    canvas.width = w * 2; canvas.height = h * 2;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(2, 2);

    // Retrieve real CFTC data from window._cotData or fallback to Gold/EUR
    var cot = window._cotData;
    var cur = null;
    if (cot && cot.currencies) {
        var activePair = window._cotCurPair || 'EUR/USD';
        var baseKey = activePair.split('/')[0] || 'EUR';
        cur = cot.currencies[baseKey] || cot.currencies['EUR'] || cot.currencies['XAU'];
    }

    var history = (cur && cur.history && cur.history.length) ? cur.history : [];
    if (!history.length) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#64748B';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cot ? 'Riwayat COT belum tersedia untuk instrumen ini.' : 'Memuat data CFTC COT\u2026', w / 2, h / 2);
        // api/cot.php diambil secara asinkron oleh dashboard-app.js. Bila panel dibuka
        // sebelum datanya tiba, dulu kanvas berhenti di teks "Memuat\u2026" selamanya karena
        // tidak ada yang memanggil fungsi ini lagi. Sekarang dicoba ulang sampai 10 detik.
        if (!cot) {
            if (_cotTungguTimer) clearTimeout(_cotTungguTimer);
            if (_cotTungguSampai === 0) _cotTungguSampai = Date.now() + 10000;
            if (Date.now() < _cotTungguSampai) _cotTungguTimer = setTimeout(renderCotChart, 600);
        }
        return;
    }
    _cotTungguSampai = 0;
    if (_cotTungguTimer) { clearTimeout(_cotTungguTimer); _cotTungguTimer = null; }

    var len = history.length;
    var barW = (w - 60) / len;
    ctx.clearRect(0, 0, w, h);

    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';

    var maxOI = 0;
    history.forEach(function(d) { maxOI = Math.max(maxOI, d.longs, d.shorts); });
    if (maxOI <= 0) maxOI = 1;

    history.forEach(function(d, i) {
        var x = 30 + i * barW;
        var longH = (d.longs / maxOI) * (h - 45);
        var shortH = (d.shorts / maxOI) * (h - 45);
        ctx.fillStyle = 'rgba(16,185,129,0.7)';
        ctx.fillRect(x + 2, h - 22 - longH, barW * 0.42 - 2, longH);
        ctx.fillStyle = 'rgba(239,68,68,0.7)';
        ctx.fillRect(x + barW * 0.42 + 2, h - 22 - shortH, barW * 0.42 - 2, shortH);

        ctx.fillStyle = '#64748B';
        var dtLbl = d.date ? d.date.slice(5) : ('W' + (i + 1));
        ctx.fillText(dtLbl, x + barW / 2, h - 6);
    });

    var curTitle = cur ? cur.label + ' (' + cur.name + ')' : 'CFTC Positions';
    ctx.fillStyle = '#38BDF8'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('CFTC Real Data: ' + curTitle, 10, 14);

    ctx.fillStyle = '#10B981'; ctx.fillRect(w - 150, 6, 8, 8);
    ctx.fillStyle = '#94A3B8'; ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('Non-Comm Long', w - 138, 13);
    ctx.fillStyle = '#EF4444'; ctx.fillRect(w - 150, 19, 8, 8);
    ctx.fillStyle = '#94A3B8'; ctx.fillText('Non-Comm Short', w - 138, 26);
}
window.renderCotChart = renderCotChart;


/* ═══════════════════════════════════════════════════════════
   D16  LEADERBOARD
   ═══════════════════════════════════════════════════════════ */
function renderLeaderboard() {
    var el = document.getElementById('leaderboardBody');
    if (!el) return;

    var RANK_BADGE = ['🥇','🥈','🥉'];

    function buildRows(leaders, myStats) {
        if (!leaders.length) {
            // Keadaan kosong yang BERGUNA: bukan sekadar memberi tahu, tetapi
            // menyediakan tombol menuju tempat datanya dibuat (Paper Trading).
            return '<tr><td colspan="5" class="px-3 py-8 text-center">'
                + '<div class="text-slate-400 text-xs font-semibold mb-1">Belum ada data peringkat</div>'
                + '<div class="text-slate-600 text-[10px] leading-relaxed mb-3">Peringkat dihitung dari hasil paper trading '
                + '(minimal 3 trade). Mulai catat trade Anda untuk masuk daftar.</div>'
                + '<button type="button" data-qi-aksi="switchPanel" data-qi-arg="' + QIAksi.arg('panel-paper') + '" '
                + 'class="px-3 py-1.5 rounded-lg bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-[10px] font-bold hover:bg-qi-cyan/30">Mulai Paper Trading</button>'
                + '</td></tr>';
        }
        var html = '';
        leaders.forEach(function(l) {
            var badge  = l.rank <= 3 ? RANK_BADGE[l.rank - 1] : l.rank;
            var pnlCls = l.total_pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
            var pnlStr = (l.total_pnl >= 0 ? '+' : '') + '$' + parseFloat(l.total_pnl).toFixed(2);
            html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50">' +
                '<td class="px-3 py-2 text-center font-bold ' + (l.rank <= 3 ? 'text-lg' : 'text-xs text-slate-500') + '">' + badge + '</td>' +
                '<td class="px-3 py-2 font-semibold text-white text-xs">' + l.name + '</td>' +
                '<td class="px-3 py-2 font-mono text-right text-xs">' + l.win_rate + '%</td>' +
                '<td class="px-3 py-2 font-mono text-right text-xs font-bold ' + pnlCls + '">' + pnlStr + '</td>' +
                '<td class="px-3 py-2 font-mono text-right text-xs text-slate-400">' + l.total_trades + '</td></tr>';
        });
        // Tambahkan baris "Kamu" di bawah jika tidak masuk top 10
        if (myStats) {
            var inTop = leaders.some(function(l) { return l.isMe; });
            if (!inTop) {
                var mePnlCls = myStats.total_pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
                var mePnlStr = (myStats.total_pnl >= 0 ? '+' : '') + '$' + parseFloat(myStats.total_pnl).toFixed(2);
                var eligMsg  = myStats.eligible ? '' : '<span class="text-slate-600 ml-1">(butuh min 3 trade)</span>';
                html += '<tr class="border-t-2 border-qi-cyan/30 bg-qi-cyan/5">' +
                    '<td class="px-3 py-2 text-center text-xs text-slate-500">#' + myStats.rank + '</td>' +
                    '<td class="px-3 py-2 font-semibold text-qi-cyan text-xs">Kamu ⭐' + eligMsg + '</td>' +
                    '<td class="px-3 py-2 font-mono text-right text-xs">' + myStats.win_rate + '%</td>' +
                    '<td class="px-3 py-2 font-mono text-right text-xs font-bold ' + mePnlCls + '">' + mePnlStr + '</td>' +
                    '<td class="px-3 py-2 font-mono text-right text-xs text-slate-400">' + myStats.total_trades + '</td></tr>';
            }
        }
        return html;
    }

    // Loading state
    el.innerHTML = '<tr><td colspan="5" class="px-3 py-6 text-center text-slate-500 text-xs">Memuat leaderboard...</td></tr>';

    var token = null;
    // Kunci 'qi_session' TIDAK PERNAH ditulis siapa pun — auth.js menyimpan token di
    // 'qi_token' (localStorage ATAU sessionStorage, tergantung "ingat saya"). Akibatnya
    // token selalu null dan setiap permintaan dari modul ini dijawab 401.
    try { token = (window.QuantumAuth && QuantumAuth.getToken()) || null; } catch (e) { token = null; }

    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch('api/leaderboard.php', { cache: 'no-store', headers: headers })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.status === 'success') {
                el.innerHTML = buildRows(data.leaderboard, data.my_stats);
            } else {
                el.innerHTML = '<tr><td colspan="5" class="px-3 py-6 text-center text-rose-400 text-xs">Gagal memuat data.</td></tr>';
            }
        })
        .catch(function() {
            el.innerHTML = '<tr><td colspan="5" class="px-3 py-6 text-center text-slate-500 text-xs">Tidak dapat terhubung ke server.</td></tr>';
        });
}
window.renderLeaderboard = renderLeaderboard;


/* ═══════════════════════════════════════════════════════════
   INIT — hooks into dashboard initPanel
   ═══════════════════════════════════════════════════════════ */
var _origInitProPanel = window.initProPanel;
window.initProPanel = function(id) {
    if (typeof _origInitProPanel === 'function') _origInitProPanel(id);
    if (id === 'panel-watchlist') { renderPanelWatchlist(); }
    if (id === 'panel-performance') { renderPerformanceDashboard(); }
    if (id === 'panel-mtf') { renderMTFView(); }
    if (id === 'panel-leaderboard') { renderLeaderboard(); }
    if (id === 'panel-journal') { renderJournalStats(); }
    if (id === 'panel-alerts') { renderAlertHistory(); }
    if (id === 'panel-cot') { _cotTungguSampai = 0; setTimeout(renderCotChart, 100); }
};

setInterval(updateWatchlistPrices, 3000);

})(window, document);
