/**
 * Quantum Institut Market Terminal — Pro Features v2.1
 * Risk Calculator, Price Alerts, Command Palette, Floating Ticker,
 * Pip Calculator, Pivot Points, Market Screener, Trade Journal,
 * Volatility Dashboard, Session Clocks, DXY Tracker
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
    if (_priceAlerts.length === 0) {
        // Keadaan kosong yang BERGUNA (bukan sekadar "belum ada"): beri arah tindakan.
        el.innerHTML = '<div class="text-center py-6">'
            + '<div class="text-3xl mb-2">🔔</div>'
            + '<div class="text-slate-400 text-xs font-semibold mb-1">Belum ada price alert aktif</div>'
            + '<div class="text-slate-600 text-[10px] leading-relaxed mb-3">Alert muncul di sini dan dikirim sebagai notifikasi saat harga menyentuh target Anda.</div>'
            + '<button type="button" data-qi-aksi="fokus" data-qi-arg="' + QIAksi.arg('#alertPrice') + '" '
            + 'class="px-3 py-1.5 rounded-lg bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-[10px] font-bold hover:bg-qi-cyan/30">＋ Buat alert pertama</button>'
            + '</div>';
        return;
    }
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
            '<button data-qi-aksi="removeAlert" data-qi-arg="' + QIAksi.arg(Number(a.id)) + '" class="text-slate-600 hover:text-qi-red text-xs">&#10005;</button>' +
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
        html += '<button data-qi-aksi="jalankanPerintahPalet" data-qi-arg="' + QIAksi.arg(item.id) + '" ' +
            'class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-qi-surface transition-colors' + (idx === 0 ? ' bg-qi-surface' : '') + '">' +
            '<span class="text-base">' + item.icon + '</span>' +
            '<span class="text-xs text-white">' + item.label + '</span>' +
            '<span class="ml-auto text-[9px] text-slate-600 uppercase">' + item.type + '</span></button>';
    });
    list.innerHTML = html;
}
QIAksi.daftar({
    // Item palet perintah (data-qi-aksi): jalankan aksi item ber-id itu lalu tutup palet.
    jalankanPerintahPalet: function(el, e, id) {
        _cmdItems.forEach(function(i) { if (i.id === id) i.action(); });
        closeCommandPalette();
    }
});

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
   #8  VOLATILITY DASHBOARD — ATR NYATA dari TradingView Scanner
   ═══════════════════════════════════════════════════════════
   ⚠️ Perbaikan integritas: versi sebelumnya memakai tabel ATR/spread HARDCODED
   (XAUUSD ATR 28,5 · spread 0,20, dst.) beserta kolom "best session" yang juga
   tebakan. Sekarang:
     · ATR & ATR%   → dari indikator NYATA pemindai (api/tv-scan.php)
     · SPREAD       → nyata untuk kripto (order book Binance); "—" untuk FX/logam
     · kolom terakhir → SESI YANG SEDANG AKTIF (dihitung dari jam, bukan tebakan)
   Baris tanpa data ditampilkan "—" dan tidak dikarang. */
function _sesiAktifSekarang() {
    var jamUtc = new Date().getUTCHours();
    var aktif = [];
    if (jamUtc >= 0 && jamUtc < 9)  aktif.push('Tokyo');
    if (jamUtc >= 7 && jamUtc < 16) aktif.push('London');
    if (jamUtc >= 12 && jamUtc < 21) aktif.push('New York');
    if (jamUtc >= 21 || jamUtc < 6) aktif.push('Sydney');
    return aktif.length ? aktif.join('-') : '—';
}
/** Isi kartu "Rata-rata Volatilitas Pasar" dari ATR% yang benar-benar terbaca. */
function qiSetVolRata(daftarPct) {
    var nilaiEl = document.getElementById('volRataNilai');
    var ketEl = document.getElementById('volRataKet');
    if (!nilaiEl) return;
    if (!daftarPct || !daftarPct.length) {
        nilaiEl.textContent = '\u2014';
        if (ketEl) ketEl.textContent = 'ATR belum terbaca dari sumber';
        return;
    }
    var jml = 0;
    for (var i = 0; i < daftarPct.length; i++) jml += daftarPct[i];
    nilaiEl.textContent = (jml / daftarPct.length).toFixed(2) + '%';
    if (ketEl) ketEl.textContent = 'ATR / harga, rata-rata ' + daftarPct.length + ' instrumen (TradingView)';
}

function renderVolatilityDash() {
    var el = document.getElementById('volBody');
    if (!el) return;
    el.innerHTML = '<tr><td colspan="5" class="px-3 py-3 text-center text-[10px] text-slate-500">Memuat ATR nyata dari pemindai…</td></tr>';

    var sesi = _sesiAktifSekarang();
    var baris = function (sym, atr, atrPct) {
        var volColor = (atrPct === null) ? 'text-slate-500' : (atrPct > 3 ? 'text-qi-red' : (atrPct > 1 ? 'text-qi-gold' : 'text-qi-green'));
        var barW = (atrPct === null) ? 0 : Math.min(atrPct * 12, 100);
        var atrTeks = (atr === null) ? '—' : (atr >= 100 ? atr.toFixed(1) : atr.toFixed(atr < 1 ? 5 : 2));
        var pctTeks = (atrPct === null) ? '—' : atrPct.toFixed(2) + '%';
        return '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50">'
            + '<td class="px-3 py-2 font-mono font-semibold text-white">' + sym + '</td>'
            + '<td class="px-3 py-2 font-mono text-right">' + atrTeks + '</td>'
            + '<td class="px-3 py-2 text-right"><div class="flex items-center justify-end gap-2">'
            + '<div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full rounded-full bg-qi-cyan/70" style="width:' + barW + '%"></div></div>'
            + '<span class="font-mono ' + volColor + '">' + pctTeks + '</span></div></td>'
            + '<td class="px-3 py-2 font-mono text-right text-slate-400" title="spread nyata hanya untuk kripto (order book Binance)">—</td>'
            + '<td class="px-3 py-2 text-slate-400 text-right text-[10px]">' + sesi + '</td></tr>';
    };

    fetch('api/tv-scan.php', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
            var data = (j && j.data) ? j.data : null;
            if (!data) throw new Error('kosong');
            var kunci = Object.keys(data).slice(0, 12);
            var kumpulPct = [];
            el.innerHTML = kunci.map(function (sym) {
                var d = data[sym] || {};
                var ind = d.indicators || {};
                var atr = (typeof ind.atr === 'number' && ind.atr > 0) ? ind.atr : null;
                var atrPct = (atr !== null && typeof d.price === 'number' && d.price > 0) ? (atr / d.price * 100) : null;
                if (atrPct !== null) kumpulPct.push(atrPct);
                return baris(sym, atr, atrPct);
            }).join('');
            // Kartu "Rata-rata Volatilitas Pasar" DIHITUNG dari baris yang baru saja dirender,
            // bukan angka "2.4%" yang dulu ditulis tangan di dashboard.html dan tidak pernah berubah.
            qiSetVolRata(kumpulPct);
            // Spread NYATA hanya untuk kripto (order book Binance). FX/logam dibiarkan "—".
            kunci.forEach(function (sym, idx) {
                if (['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'].indexOf(sym) === -1) return;
                fetch('api/orderbook.php?symbol=' + sym + '&limit=1', { cache: 'no-store' })
                    .then(function (r) { return r.json(); })
                    .then(function (ob) {
                        var bid = (ob && ob.bids && ob.bids[0]) ? parseFloat(ob.bids[0][0]) : null;
                        var ask = (ob && ob.asks && ob.asks[0]) ? parseFloat(ob.asks[0][0]) : null;
                        if (!bid || !ask || ask <= bid) return;
                        var sp = ((ask - bid) / ((ask + bid) / 2)) * 10000;
                        var tr = el.children[idx];
                        var td = tr ? tr.children[3] : null;
                        if (td) { td.textContent = sp.toFixed(2) + ' bps'; td.title = 'BINANCE nyata'; }
                    })
                    .catch(function () {});
            });
        })
        .catch(function () {
            el.innerHTML = '<tr><td colspan="5" class="px-3 py-4 text-center text-[10px] text-slate-500 leading-relaxed">'
                + 'Data volatilitas tidak tersedia (sumber tidak merespons).<br>'
                + '<span class="text-slate-600">Kami tidak menampilkan angka ATR contoh sebagai gantinya.</span></td></tr>';
            qiSetVolRata([]);
        });
}


/* ═══════════════════════════════════════════════════════════
   #11  DXY TRACKER — memakai DATA NYATA (TradingView Scanner: TVC:DXY)
   ═══════════════════════════════════════════════════════════
   ⚠️ Perbaikan integritas: versi sebelumnya menampilkan angka DXY ACAK
   (104,25 + Math.random()). Sekarang diambil dari api/tv-scan.php; bila gagal,
   nilainya dikosongkan menjadi "—" dan alasannya ditulis — bukan dikarang. */
var _dxyTerakhir = 0;
function renderDxyTracker() {
    var el = document.getElementById('dxyValue');
    if (!el) return;
    // Cache 60 detik: DXY tidak berubah cepat dan pemindai ini satu permintaan untuk
    // semua instrumen (dipakai bersama Market Screener).
    if (Date.now() - _dxyTerakhir < 60000 && el.dataset.terisi === '1') return;
    var chgEl = document.getElementById('dxyChange');

    fetch('api/tv-scan.php', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
            var d = (j && j.data && j.data.DXY) ? j.data.DXY : null;
            if (!d || typeof d.price !== 'number') throw new Error('DXY tidak tersedia');
            _dxyTerakhir = Date.now();
            el.dataset.terisi = '1';
            el.textContent = d.price.toFixed(2);
            if (chgEl) {
                var chg = (typeof d.change === 'number') ? d.change : null;
                chgEl.textContent = (chg === null) ? 'perubahan tidak tersedia'
                    : ((chg >= 0 ? '+' : '') + chg.toFixed(2) + '%');
                chgEl.className = 'text-xs font-mono ' + (chg === null ? 'text-slate-500' : (chg >= 0 ? 'text-qi-green' : 'text-qi-red'));
                chgEl.title = 'Sumber: TradingView Scanner (TVC:DXY)';
            }
        })
        .catch(function () {
            el.textContent = '—';
            if (chgEl) {
                chgEl.textContent = 'data DXY tidak tersedia';
                chgEl.className = 'text-xs font-mono text-slate-500';
            }
        });
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
    if (_journalEntries.length === 0) {
        // Keadaan kosong yang BERGUNA: sebut dari mana catatan datang + tombol tindakan.
        el.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center">'
            + '<div class="text-slate-400 text-xs font-semibold mb-1">Belum ada catatan trading</div>'
            + '<div class="text-slate-600 text-[10px] leading-relaxed mb-3">Catatan terisi otomatis dari posisi yang Anda tutup di Paper Trading, atau bisa ditambah sendiri.</div>'
            + '<span class="flex items-center justify-center gap-2 flex-wrap">'
            + '<button type="button" data-qi-aksi="switchPanel" data-qi-arg="' + QIAksi.arg('panel-paper') + '" '
            + 'class="px-3 py-1.5 rounded-lg bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-[10px] font-bold hover:bg-qi-cyan/30">Buka Paper Trading</button>'
            + '<button type="button" data-qi-aksi="fokus" data-qi-arg="' + QIAksi.arg('#jnlSymbol') + '" '
            + 'class="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold hover:bg-slate-700">＋ Tambah manual</button>'
            + '</span></td></tr>';
        return;
    }
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
            '<td class="px-2 py-2"><button data-qi-aksi="deleteJournalEntry" data-qi-arg="' + QIAksi.arg(Number(e.id)) + '" class="text-slate-600 hover:text-qi-red text-[10px]">&#10005;</button></td></tr>';
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
   #16  MARKET SCREENER — memakai DATA NYATA (TradingView Scanner)
   ═══════════════════════════════════════════════════════════
   ⚠️ Perbaikan integritas: versi sebelumnya MENGARANG RSI, tren, volume, dan
   posisi EMA200 dengan Math.random() lalu menampilkannya seolah hasil pemindaian
   pasar. Sekarang seluruh angka diambil dari api/tv-scan.php (sumber nyata).
   Bila sebuah angka tidak tersedia, ditampilkan "—" — bukan dikarang. */
function runScreener() {
    var el = document.getElementById('screenerBody');
    if (!el) return;
    el.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500 text-xs">Memindai data pasar nyata…</td></tr>';

    fetch('api/tv-scan.php', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
            var data = (j && j.data) ? j.data : null;
            var kunci = data ? Object.keys(data) : [];
            if (!kunci.length) throw new Error('kosong');

            var html = '';
            kunci.forEach(function (sym) {
                var d = data[sym] || {};
                var ind = d.indicators || {};
                var tf = d.timeframes || {};

                // Tren = hitungan sinyal per-timeframe yang NYATA (bukan acak).
                var beli = 0, jual = 0;
                Object.keys(tf).forEach(function (k) {
                    var s = (tf[k] && tf[k].signal) ? String(tf[k].signal).toUpperCase() : '';
                    if (s.indexOf('BUY') !== -1) beli++;
                    else if (s.indexOf('SELL') !== -1) jual++;
                });
                var trend = beli > jual ? 'BULLISH' : (jual > beli ? 'BEARISH' : 'NEUTRAL');
                var trendCls = trend === 'BULLISH' ? 'sent-bull' : trend === 'BEARISH' ? 'sent-bear' : 'sent-neut';

                var rsiTeks = (typeof ind.rsi === 'number') ? ind.rsi.toFixed(1) : '—';
                var emaTeks = (typeof ind.ema200 === 'number' && typeof d.price === 'number')
                    ? (d.price >= ind.ema200 ? 'Above' : 'Below') : '—';
                var emaCls = emaTeks === 'Above' ? 'text-qi-green' : (emaTeks === 'Below' ? 'text-qi-red' : 'text-slate-500');
                var volTeks = (typeof d.volume === 'number' && d.volume > 0)
                    ? (d.volume >= 1000000 ? 'HIGH' : (d.volume >= 100000 ? 'MED' : 'LOW')) : '—';
                var volCls = volTeks === 'HIGH' ? 'badge-high' : (volTeks === 'MED' ? 'badge-med' : 'badge-low');
                var lbl = (typeof SYMBOL_LABELS !== 'undefined' && SYMBOL_LABELS[sym]) ? SYMBOL_LABELS[sym] : sym;
                var chg = (typeof d.change === 'number') ? d.change : null;

                html += '<tr class="border-b border-qi-border/50 hover:bg-qi-surface/50 cursor-pointer" data-qi-aksi="bukaChartSimbol" data-qi-arg="' + QIAksi.arg(sym) + '">' +
                    '<td class="px-3 py-2 font-mono font-semibold text-white">' + lbl +
                        (chg === null ? '' : '<div class="text-[9px] ' + (chg >= 0 ? 'text-qi-green' : 'text-qi-red') + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</div>') + '</td>' +
                    '<td class="px-3 py-2"><span class="' + trendCls + '">' + trend + '</span>' +
                        '<div class="text-[9px] text-slate-500">' + beli + ' naik / ' + jual + ' turun</div></td>' +
                    '<td class="px-3 py-2 font-mono text-right text-slate-300">' + rsiTeks + '</td>' +
                    '<td class="px-3 py-2 text-right"><span class="' + emaCls + '">' + emaTeks + (emaTeks === '—' ? '' : ' EMA200') + '</span></td>' +
                    '<td class="px-3 py-2 text-center"><span class="' + volCls + '">' + volTeks + '</span></td>' +
                    '<td class="px-3 py-2 text-right text-slate-400 text-[10px]">Klik untuk chart →</td></tr>';
            });
            // Sebutkan sumbernya apa adanya — pembaca berhak tahu dari mana angkanya.
            el.innerHTML = html + '<tr><td colspan="6" class="px-3 py-2 text-[9px] text-slate-600 border-t border-qi-border/40">'
                + 'Sumber: ' + (j.source || 'tidak diketahui') + ' · ' + kunci.length + ' instrumen · angka "—" berarti data tidak tersedia (tidak dikarang).</td></tr>';
        })
        .catch(function () {
            el.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500 text-xs leading-relaxed">'
                + 'Pemindaian tidak tersedia saat ini (sumber data tidak merespons).<br>'
                + '<span class="text-slate-600">Kami tidak menampilkan angka karangan sebagai gantinya.</span></td></tr>';
        });
}


/* ═══════════════════════════════════════════════════════════
   #17  SPREAD MONITOR — spread NYATA untuk kripto, "—" untuk lainnya
   ═══════════════════════════════════════════════════════════
   ⚠️ Perbaikan integritas: versi sebelumnya memakai TABEL SPREAD HARDCODED
   (EURUSD 0.1/0.3 "Tight", dst.) yang tampak seperti pemantauan langsung.
   Sekarang: spread kripto dihitung dari order book BINANCE yang nyata
   (api/orderbook.php). Untuk FX/logam, sumber gratis tidak menyediakan bid/ask,
   jadi ditampilkan "—" beserta alasannya — bukan angka karangan.
   Ambang Tight/Normal/Wide adalah KONVENSI KAMI sendiri (1 bps / 3 bps). */
function renderSpreadMonitor() {
    var el = document.getElementById('spreadBody');
    if (!el) return;
    var kripto = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
    var fx = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD'];
    var baris = function (sym, spreadBps, sumber) {
        var sCls = 'text-slate-500', stCls = 'sent-neut', status = '—';
        if (spreadBps !== null) {
            status = spreadBps < 1 ? 'Tight' : (spreadBps < 3 ? 'Normal' : 'Wide');
            sCls = spreadBps < 1 ? 'text-qi-green' : (spreadBps < 3 ? 'text-qi-gold' : 'text-qi-red');
            stCls = status === 'Tight' ? 'sent-bull' : (status === 'Wide' ? 'sent-bear' : 'sent-neut');
        }
        return '<tr class="border-b border-qi-border/50">'
            + '<td class="px-3 py-2 font-mono font-semibold text-white">' + sym + '</td>'
            + '<td class="px-3 py-2 font-mono text-right ' + sCls + '">' + (spreadBps === null ? '—' : spreadBps.toFixed(2)) + '</td>'
            + '<td class="px-3 py-2 text-right text-slate-500 text-[10px]">' + sumber + '</td>'
            + '<td class="px-3 py-2 text-center"><span class="' + stCls + '">' + status + '</span></td></tr>';
    };
    // CATATAN PERBAIKAN: dulu baris FX/XAU ditulis sebagai `+ fx.map(…)` BERDIRI SENDIRI
    // sesudah kurung tutup blok if/else. JavaScript menyisipkan titik koma otomatis
    // setelah `}`, lalu menilai `+fx.map(…)` sebagai ekspresi unary-plus yang hasilnya
    // dibuang — jadi 6 baris (XAUUSD, EURUSD, GBPUSD, USDJPY, AUDUSD, NZDUSD) tidak
    // pernah muncul, tanpa galat merah di konsol. Tabelnya hanya 11 baris, jadi render
    // progresif tidak diperlukan dan seluruh baris ditulis sekali jalan.
    el.innerHTML = kripto.map(function (s) { return baris(s, null, 'memuat…'); }).join('')
        + fx.map(function (s) { return baris(s, null, 'tidak tersedia'); }).join('');

    // Ambil order book NYATA (Binance) untuk kripto; hitung spread dalam bps.
    kripto.forEach(function (sym, i) {
        fetch('api/orderbook.php?symbol=' + sym + '&limit=1', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var tr = el.children[i];
                if (!tr) return;
                var bid = (d && d.bids && d.bids[0]) ? parseFloat(d.bids[0][0]) : null;
                var ask = (d && d.asks && d.asks[0]) ? parseFloat(d.asks[0][0]) : null;
                var spread = (bid && ask && ask > bid) ? ((ask - bid) / ((ask + bid) / 2)) * 10000 : null;
                tr.outerHTML = baris(sym, spread, d && d.source === 'binance' ? 'BINANCE nyata' : 'tidak nyata');
            })
            .catch(function () {
                var tr = el.children[i];
                if (tr) tr.outerHTML = baris(sym, null, 'gagal dimuat');
            });
    });
    // Catatan sumber di bawah tabel (elemen terpisah agar tidak mengacaukan baris).
    var cat = document.getElementById('spreadCatatan');
    if (cat) {
        cat.textContent = 'Spread kripto dihitung dari order book Binance yang nyata (satuan bps). '
            + 'FX/logam tidak ditampilkan karena sumber gratis tidak menyediakan bid/ask — '
            + 'spread nyata FX hanya ada bila EA MT5 Anda terhubung. Angka karangan tidak dipakai. '
            + 'Ambang Tight <1 bps · Normal <3 bps · Wide ≥3 bps (konvensi kami).';
    }
}


/* ═══════════════════════════════════════════════════════════
   #19  SWAP / ROLLOVER RATES
   ═══════════════════════════════════════════════════════════
   ⚠️ Perbaikan integritas: versi sebelumnya menampilkan TABEL SWAP HARDCODED
   (EURUSD −6,50/1,20, XAUUSD −38,50/12,00, dst.) yang tampak seperti suku bunga
   rollover broker. Angka seperti itu HANYA sah datang dari broker Anda sendiri
   (EA MT5 → api/mt-bridge.php), jadi sekarang tabel dikosongkan dengan penjelasan
   — bukan diisi angka karangan. */
function renderSwapRates() {
    var el = document.getElementById('swapBody');
    if (!el) return;
    el.innerHTML = '<tr><td colspan="3" class="px-3 py-4 text-center text-[10px] text-slate-500 leading-relaxed">'
        + 'Swap / rollover rate <b>hanya</b> bisa diketahui dari broker Anda.<br>'
        + '<span class="text-slate-600">Hubungkan EA MT5 (bridge) dan angkanya akan tampil di sini. '
        + 'Kami tidak menampilkan tabel contoh karena akan menyesatkan.</span></td></tr>';
}


/* ═══════════════════════════════════════════════════════════
   #20  SESSION CLOCK WIDGET
   ═══════════════════════════════════════════════════════════ */
/**
 * Jam + status OPEN/CLOSED tiap sesi untuk panel "Sessions & P&L Calendar".
 *
 * PERBAIKAN ZONA WAKTU: sebelumnya memakai `new Date(new Date().toLocaleString('en-US',
 * { timeZone }))` — membentuk teks lalu MEM-PARSE-nya kembali. Hasil parse teks tanggal
 * non-ISO bergantung implementasi dan bisa meleset satu jam. Sekarang memakai
 * Intl.DateTimeFormat().formatToParts(), cara yang sama dengan jam header (updateClocks).
 */
function qiBagianWaktu(tz) {
    var bagian = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false, weekday: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date());
    var out = {};
    bagian.forEach(function (b) { out[b.type] = b.value; });
    var jam = parseInt(out.hour, 10);
    return {
        jam: jam === 24 ? 0 : jam,            // sebagian runtime memakai "24" untuk tengah malam
        menit: parseInt(out.minute, 10),
        detik: parseInt(out.second, 10),
        akhirPekan: out.weekday === 'Sat' || out.weekday === 'Sun',
    };
}

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
        var w = qiBagianWaktu(s.tz);
        var h = w.jam, m = w.menit, sec = w.detik;
        var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
        var isOpen = h >= s.open && h < s.close && !w.akhirPekan;
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
    // renderDxyTracker() dulu ditulis lengkap tetapi TIDAK pernah dipanggil dari mana pun,
    // sehingga kartu Dollar Index di paling atas panel Volatility selamanya '—' / 'memuat…'.
    if (id === 'panel-volatility') { renderDxyTracker(); renderVolatilityDash(); renderSpreadMonitor(); renderSwapRates(); }
    if (id === 'panel-tools') { calcPivotPoints(); }
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
        // Diumumkan ke pembaca layar (idempoten: dipasang walau container sudah ada).
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        var colors = { success: 'border-qi-green bg-qi-green/10 text-qi-green',
            error: 'border-qi-red bg-qi-red/10 text-qi-red',
            warning: 'border-qi-gold bg-qi-gold/10 text-qi-gold',
            info: 'border-qi-cyan bg-qi-cyan/10 text-qi-cyan' };
        var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        var cls = colors[type] || colors.info;
        var icon = icons[type] || icons.info;
        var toast = document.createElement('div');
        // Galat diumumkan segera; pesan lain memakai aliran sopan dari container.
        if (type === 'error') toast.setAttribute('role', 'alert');
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

/**
 * Tombol KELUAR yang mengapung.
 *
 * ⚠️ Kenapa ini penting: mode layar penuh memakai `position:fixed; inset:0; z-index:90`
 * sehingga panel MENUTUPI seluruh halaman — termasuk bilah judul yang memuat tombol
 * keluarnya. Akibatnya pengguna terjebak dan hanya bisa keluar lewat pintasan
 * tersembunyi "F". Sekarang selalu ada tombol yang terlihat (z-index di atas panel),
 * ditambah tombol Esc.
 */
function tampilkanTombolKeluarFullscreen(aksi) {
    var btn = document.getElementById('qiKeluarFullscreen');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'qiKeluarFullscreen';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Keluar dari mode layar penuh');
        btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:100000;display:flex;align-items:center;gap:6px;'
            + 'padding:9px 14px;border-radius:12px;background:rgba(2,6,23,.94);border:1px solid rgba(0,229,255,.45);'
            + 'color:#00E5FF;font:700 12px/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.55)';
        document.body.appendChild(btn);
    }
    btn.innerHTML = '✕ Keluar Fullscreen <span style="opacity:.6;font-weight:500">(Esc)</span>';
    btn.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (typeof aksi === 'function') { aksi(); }
        else { togglePanelFullscreen(false); }
    };
    btn.style.display = 'flex';
}
function sembunyikanTombolKeluarFullscreen() {
    var b = document.getElementById('qiKeluarFullscreen');
    if (b) b.style.display = 'none';
}

function togglePanelFullscreen(paksa) {
    var activeId = (typeof _activePanel !== 'undefined') ? _activePanel : 'panel-overview';
    var panel = document.getElementById(activeId);
    if (!panel) return;
    var masuk = (typeof paksa === 'boolean') ? paksa : !_panelFullscreen;
    _panelFullscreen = masuk;
    if (masuk) {
        panel.classList.add('panel-fullscreen');
        panel.classList.remove('hidden');
        tampilkanTombolKeluarFullscreen(function () { togglePanelFullscreen(false); });
    } else {
        panel.classList.remove('panel-fullscreen');
        sembunyikanTombolKeluarFullscreen();
    }
}

// Esc juga mengakhiri mode layar penuh (sebelumnya hanya pintasan F yang bisa).
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && _panelFullscreen) {
        e.preventDefault();
        togglePanelFullscreen(false);
    }
});


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
    modal.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.5)" data-qi-aksi="hapusElemen" data-qi-arg="' + QIAksi.arg('#shortcutsModal') + '"></div>' +
        '<div class="relative bg-qi-card border border-qi-border rounded-2xl p-5 w-80 shadow-2xl">' + html + '</div>';
    document.body.appendChild(modal);
}


/* ═══════════════════════════════════════════════════════════
   #36  SIDEBAR PANEL SEARCH / FILTER
   ═══════════════════════════════════════════════════════════ */
function filterSidebarPanels(q) {
    q = (q || '').toLowerCase().trim();
    var nav = document.getElementById('dashNav');
    if (!nav) return 0;

    var semua = Array.prototype.slice.call(nav.querySelectorAll('[data-panel]'));
    var aktif  = nav.querySelector('[data-panel].active');
    var terlihat = 0;
    var cocokAsli = 0; // kecocokan SEBENARNYA, tanpa menghitung tab aktif yang dipaksa tampil

    semua.forEach(function (btn) {
        var teks = (btn.textContent || '').toLowerCase();
        var cocok = !q || teks.indexOf(q) >= 0;
        if (cocok && q) cocokAsli++;
        // Tab yang sedang aktif SELALU terlihat: kalau ikut tersembunyi, pengguna
        // kehilangan penanda posisinya (dan tablist jadi tanpa tab terpilih).
        if (!cocok && btn === aktif) cocok = true;
        btn.style.display = cocok ? '' : 'none';
        if (cocok) terlihat++;
    });

    // Judul grup yang tidak menyisakan satu pun tombol terlihat ikut disembunyikan,
    // supaya tidak ada judul menggantung tanpa isi. Sebuah tombol dianggap milik
    // judul terdekat di atasnya.
    var judul = Array.prototype.slice.call(nav.querySelectorAll('div.uppercase.tracking-widest'));
    judul.forEach(function (h) {
        var adaIsi = false;
        var n = h.nextElementSibling;
        while (n) {
            if (n.matches && n.matches('div.uppercase.tracking-widest')) break; // judul berikutnya
            if (n.matches && n.matches('[data-panel]') && n.style.display !== 'none') { adaIsi = true; break; }
            if (n.querySelectorAll) {
                var dalam = n.querySelectorAll('[data-panel]');
                for (var i = 0; i < dalam.length; i++) {
                    if (dalam[i].style.display !== 'none') { adaIsi = true; break; }
                }
                if (adaIsi) break;
            }
            n = n.nextElementSibling;
        }
        h.style.display = adaIsi ? '' : 'none';
    });

    // Pembungkus grup yang sudah kosong disembunyikan agar tidak menyisakan jarak.
    Array.prototype.forEach.call(nav.children, function (grup) {
        if (!grup.querySelectorAll) return;
        var isi = grup.querySelectorAll('[data-panel]');
        if (!isi.length) return; // mis. kotak pencarian — jangan disentuh
        var ada = false;
        for (var i = 0; i < isi.length; i++) {
            if (isi[i].style.display !== 'none') { ada = true; break; }
        }
        grup.style.display = ada ? '' : 'none';
    });

    // Beri tahu pengguna pembaca layar berapa panel yang cocok. Dihitung dari
    // kecocokan sebenarnya, bukan jumlah yang tampil — kalau tidak, tab aktif yang
    // dipaksa tampil akan membuat status berkata "1 panel cocok" padahal tidak ada
    // satu pun panel yang cocok (menyesatkan).
    var status = document.getElementById('qiNavFilterStatus');
    if (status) {
        status.textContent = q
            ? (cocokAsli === 0 ? 'Tidak ada panel yang cocok dengan ' + q : cocokAsli + ' panel cocok dengan ' + q)
            : '';
    }
    return cocokAsli;
}


/* ═══════════════════════════════════════════════════════════
   #38  ONBOARDING TOUR (first visit)
   ═══════════════════════════════════════════════════════════ */
function maybeShowOnboarding() {
    try {
        if (localStorage.getItem('qi_onboarding_v2')) return;
        // Tips ini tentang pintasan KEYBOARD: tidak berguna di ponsel/tablet → dilewati (ditandai sudah dilihat).
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) { localStorage.setItem('qi_onboarding_v2', '1'); return; }
        // Satu dialog sekaligus: tunggu pengguna baru menyelesaikan sambutan dulu (muncul lagi di kunjungan berikutnya).
        if (localStorage.getItem('qi_dashboard_onboarded') !== '1' || window.__qimDialogAktif) return;
        window.__qimDialogAktif = 'tips';
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
        html += '<button data-tur-tutup class="w-full mt-3 py-2 rounded-xl bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-xs font-semibold hover:bg-qi-cyan/30">Mengerti!</button>';
        var modal = document.createElement('div');
        modal.id = 'onboardTour';
        modal.style.cssText = 'position:fixed;inset:0;z-index:101;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.6)"></div>' +
            '<div class="relative bg-qi-card border border-qi-border rounded-2xl p-5 w-80 shadow-2xl" style="animation:panelFadeIn .3s ease">' + html + '</div>';
        modal.querySelector('[data-tur-tutup]').addEventListener('click', function() {
            modal.remove();
            window.__qimDialogAktif = null;
            try { localStorage.setItem('qi_onboarding_v2', '1'); } catch(e) {}
        });
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
    // Kartu jam sesi hanya ada di panel-sentiment. Dulu interval ini berjalan tiap detik
    // sepanjang halaman hidup — termasuk saat panelnya tersembunyi — dan tiap tik menulis
    // ulang innerHTML empat kartu. Sekarang hanya berdetak bila kartunya benar-benar terlihat.
    setInterval(function () {
        if (document.hidden) return;
        var kartu = document.getElementById('scTokyo');
        if (!kartu || !kartu.offsetParent) return;   // offsetParent null = induknya display:none
        updateSessionClocks();
    }, 1000);
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
