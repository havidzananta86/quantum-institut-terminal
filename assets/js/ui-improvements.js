// Quantum Institut — UI/UX Professional Improvements
// Covers recommendations: #17 #19 #20 #24 #25 #27 #29 #30 #33 #34 #38 #39 #40 #42 #44 #46 #50
(function(){
'use strict';

// ═══════════════════════════════════════════════════════════
// #38 — Market Session Indicator (real-time in header)
// ═══════════════════════════════════════════════════════════
function getActiveSessions() {
    var now = new Date();
    var utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
    var t = utcH * 60 + utcM;
    var sessions = [];
    if (t >= 2*60 && t < 11*60) sessions.push({name:'Sydney',color:'#F59E0B'});
    if (t >= 0 && t < 9*60) sessions.push({name:'Tokyo',color:'#7C4DFF'});
    if (t >= 7*60 && t < 16*60) sessions.push({name:'London',color:'#00E5FF'});
    if (t >= 12*60 && t < 21*60) sessions.push({name:'New York',color:'#10B981'});
    if ((t >= 21*60 || t < 2*60)) sessions.push({name:'Sydney',color:'#F59E0B'});
    var uniqueNames = [];
    var unique = sessions.filter(function(s){
        if (uniqueNames.indexOf(s.name) >= 0) return false;
        uniqueNames.push(s.name);
        return true;
    });
    return unique;
}

function renderSessionIndicator() {
    var el = document.getElementById('qiSessionBadge');
    if (!el) return;
    var sessions = getActiveSessions();
    if (!sessions.length) {
        el.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span><span class="text-[10px] font-mono text-rose-400">CLOSED</span>';
        return;
    }
    var dots = sessions.map(function(s){
        return '<span class="w-1.5 h-1.5 rounded-full session-dot inline-block" style="background:'+s.color+'"></span>';
    }).join('');
    var names = sessions.map(function(s){ return s.name; }).join(' · ');
    el.innerHTML = dots + '<span class="text-[10px] font-mono text-qi-green font-semibold">' + names + '</span>';
}

// ═══════════════════════════════════════════════════════════
// #39 — Live Price in Browser Tab Title
// ═══════════════════════════════════════════════════════════
var _origTitle = document.title;
function updateTabTitle() {
    if (!window._livePrices && !window._lastPrices) return;
    var prices = window._livePrices || window._lastPrices || {};
    var btc = prices['BTCUSDT'] || prices['BTCUSD'];
    var gold = prices['XAUUSD'];
    var parts = [];
    if (btc) {
        var p = typeof btc === 'object' ? (btc.price || btc.last) : btc;
        if (p) parts.push('BTC $' + Number(p).toLocaleString('en-US',{maximumFractionDigits:0}));
    }
    if (gold) {
        var g = typeof gold === 'object' ? (gold.price || gold.last) : gold;
        if (g) parts.push('XAU $' + Number(g).toLocaleString('en-US',{maximumFractionDigits:1}));
    }
    if (parts.length) {
        document.title = parts.join(' | ') + ' — Quantum Terminal';
    }
}

// ═══════════════════════════════════════════════════════════
// #17 — "Last Updated" Timestamp in Panel Title Bar
// ═══════════════════════════════════════════════════════════
function updateLastUpdatedTime() {
    var el = document.getElementById('statusLastUpdate');
    if (!el) return;
    el.textContent = 'Updated: ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    el.classList.remove('hidden');
    el.classList.add('sm:inline');
}

// ═══════════════════════════════════════════════════════════
// #19 — Empty States with Illustrations + CTA
// ═══════════════════════════════════════════════════════════
var EMPTY_STATES = {
    'panel-journal': {
        icon: '📔',
        title: 'Belum ada catatan trading',
        desc: 'Catat trade pertama Anda untuk membangun track record.',
        cta: 'Buat Entri Pertama',
        action: "document.querySelector('#panel-journal form input')?.focus()"
    },
    'panel-alerts': {
        icon: '🔔',
        title: 'Belum ada price alert',
        desc: 'Pasang alert untuk mendapat notifikasi saat harga mencapai target.',
        cta: 'Buat Alert Pertama',
        action: "document.querySelector('#panel-alerts input')?.focus()"
    },
    'panel-paper': {
        icon: '💼',
        title: 'Belum ada paper trade',
        desc: 'Latih strategi tanpa risiko — buka posisi paper trading pertama.',
        cta: 'Buka Posisi Pertama',
        action: "document.querySelector('#ptSymbol')?.focus()"
    },
    'panel-watchlist': {
        icon: '⭐',
        title: 'Watchlist kosong',
        desc: 'Tambahkan instrumen favorit untuk pantau harga secara real-time.',
        cta: 'Tambah Instrumen',
        action: "document.querySelector('#panel-watchlist select')?.focus()"
    }
};

window._qiEmptyState = function(panelId) {
    var cfg = EMPTY_STATES[panelId];
    if (!cfg) return '';
    return '<div class="flex flex-col items-center justify-center py-10 px-4 text-center">' +
        '<div class="text-4xl mb-3">' + cfg.icon + '</div>' +
        '<div class="text-sm font-semibold text-white mb-1">' + cfg.title + '</div>' +
        '<div class="text-[11px] text-slate-500 mb-4 max-w-xs">' + cfg.desc + '</div>' +
        '<button onclick="' + cfg.action + '" class="px-4 py-2 rounded-lg text-[11px] font-semibold bg-qi-cyan/15 text-qi-cyan border border-qi-cyan/30 hover:bg-qi-cyan/25 transition-all">' + cfg.cta + '</button>' +
    '</div>';
};

// ═══════════════════════════════════════════════════════════
// #20 — Number Formatting Utility (global)
// ═══════════════════════════════════════════════════════════
window.qiFmt = function(num, decimals) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    var d = decimals !== undefined ? decimals : 2;
    return Number(num).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
};

window.qiFmtCurrency = function(num, currency) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    var prefix = currency === 'IDR' ? 'Rp' : '$';
    return prefix + Number(num).toLocaleString(currency==='IDR'?'id-ID':'en-US', {minimumFractionDigits:0, maximumFractionDigits:0});
};

// ═══════════════════════════════════════════════════════════
// #24 — Keyboard Shortcuts Help Modal
// ═══════════════════════════════════════════════════════════
function createShortcutsModal() {
    if (document.getElementById('qiShortcutsModal')) return;
    var shortcuts = [
        ['?','Tampilkan bantuan keyboard'],
        ['Escape','Tutup modal / panel'],
        ['F','Fullscreen panel aktif'],
        ['1–9','Pindah ke panel (urutan sidebar)'],
        ['Ctrl+K','Buka command palette'],
        ['←→','Navigasi timeframe chart'],
        ['S','Buka sidebar (mobile)'],
        ['N','Panel berita'],
        ['C','Panel chart'],
        ['T','Paper trading'],
        ['R','Refresh panel aktif']
    ];
    var rows = shortcuts.map(function(s){
        return '<div class="flex items-center justify-between py-2 border-b border-qi-border/40">' +
            '<kbd class="px-2 py-0.5 rounded bg-qi-surface border border-qi-border text-[11px] font-mono text-qi-cyan font-semibold">' + s[0] + '</kbd>' +
            '<span class="text-[11px] text-slate-400">' + s[1] + '</span></div>';
    }).join('');

    var modal = document.createElement('div');
    modal.id = 'qiShortcutsModal';
    modal.className = 'fixed inset-0 z-[9000] hidden items-center justify-center p-4';
    modal.style.cssText = 'background:rgba(5,10,26,0.85);backdrop-filter:blur(8px)';
    modal.onclick = function(e){ if(e.target===modal){ modal.classList.add('hidden'); modal.style.display=''; }};
    modal.innerHTML = '<div class="w-full max-w-sm rounded-2xl border border-qi-border bg-qi-panel p-5 shadow-2xl">' +
        '<div class="flex items-center justify-between mb-4"><h3 class="font-heading font-bold text-white text-sm">Keyboard Shortcuts</h3>' +
        '<button onclick="document.getElementById(\'qiShortcutsModal\').classList.add(\'hidden\');document.getElementById(\'qiShortcutsModal\').style.display=\'\'" class="text-slate-500 hover:text-white text-lg">&times;</button></div>' +
        '<div class="space-y-0">' + rows + '</div>' +
        '<div class="mt-4 text-[10px] text-slate-600 text-center font-mono">Tekan ? kapan saja untuk menampilkan ini</div></div>';
    document.body.appendChild(modal);
}

function toggleShortcutsModal() {
    var m = document.getElementById('qiShortcutsModal');
    if (!m) return;
    if (m.classList.contains('hidden')) {
        m.classList.remove('hidden');
        m.style.display = 'flex';
    } else {
        m.classList.add('hidden');
        m.style.display = '';
    }
}
window.toggleShortcutsModal = toggleShortcutsModal;

// ═══════════════════════════════════════════════════════════
// #25 — Sidebar Group Collapse/Expand
// ═══════════════════════════════════════════════════════════
function initSidebarCollapse() {
    var nav = document.getElementById('dashNav');
    if (!nav) return;
    var headers = nav.querySelectorAll('.text-\\[10px\\].font-semibold.text-slate-500.uppercase');
    headers.forEach(function(h) {
        var container = h.closest('div');
        if (!container) return;
        var key = 'qi_sidebar_' + (h.textContent||'').trim().replace(/\s+/g,'_').toLowerCase();
        h.style.cursor = 'pointer';
        h.style.userSelect = 'none';
        var arrow = document.createElement('span');
        arrow.className = 'qi-sb-arrow text-[8px] ml-1 inline-block transition-transform';
        arrow.textContent = '▼';
        h.appendChild(arrow);

        var items = [];
        var sibling = h.nextElementSibling;
        while (sibling && sibling.tagName !== 'DIV') {
            sibling = sibling.nextElementSibling;
        }
        if (!sibling) {
            var parent = h.parentElement;
            if (parent) {
                var children = parent.children;
                for (var i = 0; i < children.length; i++) {
                    if (children[i] !== h && children[i].tagName === 'BUTTON') {
                        items.push(children[i]);
                    }
                }
            }
        }

        var collapsed = false;
        try { collapsed = localStorage.getItem(key) === '1'; } catch(e){}

        function toggleGroup() {
            collapsed = !collapsed;
            items.forEach(function(it){ it.style.display = collapsed ? 'none' : ''; });
            arrow.style.transform = collapsed ? 'rotate(-90deg)' : '';
            try { localStorage.setItem(key, collapsed ? '1' : '0'); } catch(e){}
        }

        if (collapsed) {
            items.forEach(function(it){ it.style.display = 'none'; });
            arrow.style.transform = 'rotate(-90deg)';
        }

        h.addEventListener('click', toggleGroup);
    });
}

// ═══════════════════════════════════════════════════════════
// #27 — Swipe Gesture Between Panels (mobile)
// ═══════════════════════════════════════════════════════════
function initSwipeGestures() {
    if (window.innerWidth > 768) return;
    var mainScroll = document.getElementById('mainScroll');
    if (!mainScroll) return;
    var startX = 0, startY = 0, moved = false;

    var panelOrder = [];
    var navBtns = document.querySelectorAll('#dashNav button[data-panel]');
    navBtns.forEach(function(b){ panelOrder.push(b.getAttribute('data-panel')); });

    mainScroll.addEventListener('touchstart', function(e){
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        moved = false;
    }, {passive:true});

    mainScroll.addEventListener('touchend', function(e){
        if (moved) return;
        var endX = e.changedTouches[0].clientX;
        var endY = e.changedTouches[0].clientY;
        var dx = endX - startX;
        var dy = endY - startY;
        if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx)*0.6) return;

        var active = document.querySelector('.panel-content:not(.hidden)');
        if (!active) return;
        var curId = active.id;
        var idx = panelOrder.indexOf(curId);
        if (idx < 0) return;

        var nextIdx = dx < 0 ? idx+1 : idx-1;
        if (nextIdx < 0 || nextIdx >= panelOrder.length) return;
        if (typeof switchPanel === 'function') switchPanel(panelOrder[nextIdx]);
        if (typeof navigator.vibrate === 'function') navigator.vibrate(15);
    }, {passive:true});

    mainScroll.addEventListener('touchmove', function(e){
        var dx = Math.abs(e.touches[0].clientX - startX);
        var dy = Math.abs(e.touches[0].clientY - startY);
        if (dy > 30) moved = true;
    }, {passive:true});
}

// ═══════════════════════════════════════════════════════════
// #29 — Pull-to-Refresh on Mobile
// ═══════════════════════════════════════════════════════════
function initPullToRefresh() {
    if (window.innerWidth > 768) return;
    var mainScroll = document.getElementById('mainScroll');
    if (!mainScroll) return;
    var pullY = 0, pulling = false;

    mainScroll.addEventListener('touchstart', function(e){
        if (mainScroll.scrollTop <= 0) {
            pullY = e.touches[0].clientY;
            pulling = true;
        }
    }, {passive:true});

    mainScroll.addEventListener('touchmove', function(e){
        if (!pulling) return;
        var dy = e.touches[0].clientY - pullY;
        if (dy > 80 && mainScroll.scrollTop <= 0) {
            pulling = false;
            if (typeof navigator.vibrate === 'function') navigator.vibrate(30);
            var active = document.querySelector('.panel-content:not(.hidden)');
            if (active && typeof initPanel === 'function') initPanel(active.id);
            if (typeof showQuantumToast === 'function') showQuantumToast('Panel diperbarui','info',1500);
            updateLastUpdatedTime();
        }
    }, {passive:true});

    mainScroll.addEventListener('touchend', function(){ pulling = false; }, {passive:true});
}

// ═══════════════════════════════════════════════════════════
// #30 — Haptic Feedback on Important Actions
// ═══════════════════════════════════════════════════════════
window.qiHaptic = function(ms) {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(ms || 20);
};

// ═══════════════════════════════════════════════════════════
// #33 — News Filter by Asset (add BTC/Gold/Forex filter buttons)
// ═══════════════════════════════════════════════════════════
function initNewsAssetFilter() {
    var catFilters = document.getElementById('newsCatFilters');
    if (!catFilters || catFilters.querySelector('.news-asset-btn')) return;

    var assetBtns = [
        {label:'BTC',keywords:['bitcoin','btc','crypto','ethereum','sol','altcoin']},
        {label:'Gold',keywords:['gold','emas','xau','precious','metal']},
        {label:'Forex',keywords:['forex','eur','gbp','usd','jpy','aud','nzd','cad','chf','currency','dollar','yen','pound']}
    ];

    var sep = document.createElement('span');
    sep.className = 'text-slate-700 text-[10px] mx-1';
    sep.textContent = '|';
    catFilters.appendChild(sep);

    assetBtns.forEach(function(ab){
        var btn = document.createElement('button');
        btn.className = 'news-asset-btn text-[10px] font-semibold px-3 py-1 rounded-full border border-qi-border text-slate-400 hover:border-slate-500';
        btn.textContent = ab.label;
        btn.onclick = function(){
            var isActive = btn.classList.contains('filter-btn-active');
            catFilters.querySelectorAll('.news-asset-btn').forEach(function(b){ b.classList.remove('filter-btn-active'); });
            if (!isActive) {
                btn.classList.add('filter-btn-active');
                filterNewsByAsset(ab.keywords);
            } else {
                if (typeof filterNewsItems === 'function') filterNewsItems();
            }
        };
        catFilters.appendChild(btn);
    });
}

function filterNewsByAsset(keywords) {
    var items = document.querySelectorAll('#dashNewsList .news-item');
    items.forEach(function(item){
        var title = (item.getAttribute('data-title')||'').toLowerCase();
        var match = keywords.some(function(k){ return title.indexOf(k) >= 0; });
        item.style.display = match ? '' : 'none';
    });
}

// ═══════════════════════════════════════════════════════════
// #34 — Calendar High-Impact Event Enhancement
// ═══════════════════════════════════════════════════════════
function enhanceCalendarHighImpact() {
    var rows = document.querySelectorAll('#calTableBody tr');
    rows.forEach(function(r){
        var badge = r.querySelector('.badge-high');
        if (badge) {
            r.style.borderLeft = '3px solid #FF4444';
            r.style.background = 'rgba(255,68,68,0.04)';
        }
    });
}

var _calObserver = null;
function watchCalendarRender() {
    var body = document.getElementById('calTableBody');
    if (!body || _calObserver) return;
    _calObserver = new MutationObserver(function(){ setTimeout(enhanceCalendarHighImpact, 50); });
    _calObserver.observe(body, {childList:true});
}

// ═══════════════════════════════════════════════════════════
// #40 — "Copy to Journal" Button on Signal Cards
// ═══════════════════════════════════════════════════════════
function addCopyToJournalButtons() {
    var cards = document.querySelectorAll('#signalMatrixWrap tr[data-sym]');
    cards.forEach(function(card){
        if (card.querySelector('.copy-journal-btn')) return;
        var lastTd = card.querySelector('td:last-child');
        if (!lastTd) return;
        var btn = document.createElement('button');
        btn.className = 'copy-journal-btn text-[9px] text-qi-cyan hover:underline font-mono ml-1';
        btn.textContent = '📋';
        btn.title = 'Masukkan ke Journal';
        btn.onclick = function(e){
            e.stopPropagation();
            var sym = card.getAttribute('data-sym') || '';
            var dir = card.querySelector('.text-qi-green,.text-emerald-400') ? 'BUY' : 'SELL';
            if (typeof switchPanel === 'function') switchPanel('panel-journal');
            setTimeout(function(){
                var inp = document.querySelector('#panel-journal input[placeholder*="pair"], #panel-journal input[type="text"]');
                if (inp) { inp.value = sym; inp.dispatchEvent(new Event('input')); }
            }, 300);
            qiHaptic(15);
            if (typeof showQuantumToast === 'function') showQuantumToast('Signal ' + sym + ' disiapkan di Journal', 'info', 2000);
        };
        lastTd.appendChild(btn);
    });
}

var _sigObserver = null;
function watchSignalRender() {
    var wrap = document.getElementById('signalMatrixWrap');
    if (!wrap || _sigObserver) return;
    _sigObserver = new MutationObserver(function(){ setTimeout(addCopyToJournalButtons, 100); });
    _sigObserver.observe(wrap, {childList:true, subtree:true});
}

// ═══════════════════════════════════════════════════════════
// #42 — Tooltips on Technical Indicators
// ═══════════════════════════════════════════════════════════
var INDICATOR_TIPS = {
    'RSI': 'Relative Strength Index — momentum oscillator 0-100. >70 overbought, <30 oversold.',
    'MACD': 'Moving Average Convergence Divergence — trend following momentum indicator.',
    'EMA': 'Exponential Moving Average — dynamic support/resistance yang mengikuti harga.',
    'SMA': 'Simple Moving Average — rata-rata harga dalam periode tertentu.',
    'ATR': 'Average True Range — mengukur volatilitas harian instrumen.',
    'Bollinger': 'Bollinger Bands — envelope 2 standar deviasi di sekitar SMA(20).',
    'Ichimoku': 'Ichimoku Kinko Hyo — sistem trend komprehensif dengan cloud, tenkan, kijun.',
    'Fibonacci': 'Fibonacci Retracement — level koreksi berdasarkan rasio golden ratio.',
    'SMC': 'Smart Money Concepts — order blocks, fair value gaps, liquidity sweeps.',
    'SNR': 'Support & Resistance — level harga historis dimana harga cenderung berbalik.',
    'Stochastic': 'Stochastic Oscillator — perbandingan harga penutupan dengan range periode.',
    'ADX': 'Average Directional Index — mengukur kekuatan trend, >25 = trend kuat.',
    'OBV': 'On Balance Volume — akumulasi volume berdasarkan arah harga.',
    'VWAP': 'Volume Weighted Average Price — rata-rata harga berbobot volume.'
};

function addIndicatorTooltips() {
    var candidates = document.querySelectorAll('#panel-signal td, #panel-outlook td, #panel-radar td, .signal-engine, .engine-name');
    candidates.forEach(function(el){
        if (el.hasAttribute('data-qi-tip')) return;
        var text = (el.textContent||'').trim();
        for (var key in INDICATOR_TIPS) {
            if (text.indexOf(key) >= 0 && !el.querySelector('.qi-tip')) {
                el.setAttribute('data-qi-tip', '1');
                el.style.position = 'relative';
                el.style.cursor = 'help';
                el.title = INDICATOR_TIPS[key];
                break;
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════
// #44 — Better Error Messages
// ═══════════════════════════════════════════════════════════
window.qiErrorMsg = function(source, retryFn) {
    var msgs = {
        'binance': 'Koneksi ke Binance terputus.',
        'news': 'Gagal memuat berita terbaru.',
        'calendar': 'Kalender ekonomi tidak tersedia.',
        'signal': 'Data sinyal sedang dimuat ulang.',
        'ai': 'AI Assistant sedang sibuk.',
        'default': 'Data tidak tersedia saat ini.'
    };
    var msg = msgs[source] || msgs['default'];
    var retryBtn = retryFn ? ' <button onclick="' + retryFn + '" class="text-qi-cyan hover:underline font-semibold ml-1">[Coba Lagi]</button>' : '';
    return '<div class="px-4 py-6 text-center"><div class="text-slate-500 text-xs">' + msg + '</div>' +
        '<div class="text-[10px] text-slate-600 mt-1">Data terakhir mungkin masih ditampilkan.' + retryBtn + '</div></div>';
};

// ═══════════════════════════════════════════════════════════
// #46 — Ripple Effect on Buttons
// ═══════════════════════════════════════════════════════════
function initRippleEffect() {
    document.addEventListener('click', function(e){
        var btn = e.target.closest('button, .nav-item, a.block');
        if (!btn || btn.closest('#qiShortcutsModal, #orderModal, #qiAccessGate')) return;
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var ripple = document.createElement('span');
        ripple.className = 'qi-ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        btn.style.position = btn.style.position || 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(function(){ ripple.remove(); }, 500);
    });
}

// ═══════════════════════════════════════════════════════════
// #50 — "What's New" Changelog Popup
// ═══════════════════════════════════════════════════════════
var CHANGELOG_VERSION = '3.1.0';
var CHANGELOG_ITEMS = [
    {icon:'⭐', title:'Custom Watchlist', desc:'Pantau instrumen favorit dengan harga live real-time.'},
    {icon:'📊', title:'Performance Analytics', desc:'Equity curve, monthly breakdown, dan statistik trading lengkap.'},
    {icon:'🔄', title:'Multi-Timeframe View', desc:'Analisa bias dari M15 sampai Monthly dalam satu layar.'},
    {icon:'🏅', title:'Leaderboard & Community', desc:'Papan peringkat trader dan ruang diskusi komunitas.'},
    {icon:'📋', title:'COT Chart & CSV Export', desc:'Visualisasi data COT dan ekspor journal ke CSV.'},
    {icon:'🎯', title:'News Sentiment Engine', desc:'Skor sentimen otomatis untuk setiap berita pasar.'},
    {icon:'⌨️', title:'Keyboard Shortcuts', desc:'Tekan ? untuk melihat semua shortcut navigasi cepat.'},
    {icon:'🔔', title:'Alert History & Journal Stats', desc:'Riwayat alert lengkap dan statistik jurnal trading.'}
];

function showWhatsNew() {
    var key = 'qi_changelog_seen';
    try { if (localStorage.getItem(key) === CHANGELOG_VERSION) return; } catch(e){ return; }

    setTimeout(function(){
        var modal = document.createElement('div');
        modal.id = 'qiWhatsNew';
        modal.className = 'fixed inset-0 z-[8500] flex items-center justify-center p-4';
        modal.style.cssText = 'background:rgba(5,10,26,0.88);backdrop-filter:blur(8px)';
        modal.onclick = function(e){ if(e.target===modal) dismiss(); };

        var items = CHANGELOG_ITEMS.map(function(it){
            return '<div class="flex items-start gap-3 py-2"><span class="text-lg shrink-0">' + it.icon + '</span>' +
                '<div><div class="text-[12px] font-semibold text-white">' + it.title + '</div>' +
                '<div class="text-[10px] text-slate-500">' + it.desc + '</div></div></div>';
        }).join('');

        modal.innerHTML = '<div class="w-full max-w-md rounded-2xl border border-qi-cyan/25 bg-qi-panel shadow-2xl overflow-hidden">' +
            '<div class="px-6 pt-5 pb-3 border-b border-qi-border">' +
            '<div class="flex items-center gap-2"><span class="text-lg">✨</span><span class="font-heading font-bold text-white text-sm">Yang Baru di v' + CHANGELOG_VERSION + '</span></div>' +
            '<div class="text-[10px] text-slate-500 mt-1">Fitur-fitur terbaru yang sudah tersedia</div></div>' +
            '<div class="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-1">' + items + '</div>' +
            '<div class="px-6 py-4 border-t border-qi-border">' +
            '<button onclick="document.getElementById(\'qiWhatsNew\').remove()" class="w-full py-2.5 rounded-xl text-[12px] font-semibold text-qi-cyan border border-qi-cyan/30 bg-qi-cyan/10 hover:bg-qi-cyan/20 transition-all">Mengerti, Terima Kasih!</button></div></div>';

        document.body.appendChild(modal);

        function dismiss() {
            try { localStorage.setItem(key, CHANGELOG_VERSION); } catch(e){}
            modal.remove();
        }
        modal.querySelector('button').onclick = dismiss;
    }, 2000);
}

// ═══════════════════════════════════════════════════════════
// #22 — Correlation Matrix Legend
// ═══════════════════════════════════════════════════════════
function addCorrelationLegend() {
    var panel = document.getElementById('panel-correlation');
    if (!panel || panel.querySelector('.corr-legend')) return;
    var legend = document.createElement('div');
    legend.className = 'corr-legend flex items-center gap-3 px-4 pt-2 pb-1 text-[10px] font-mono text-slate-500';
    legend.innerHTML = '<span>Korelasi:</span>' +
        '<span class="flex items-center gap-1"><span class="w-3 h-2 rounded-sm" style="background:#EF4444"></span> -1.0 (berlawanan)</span>' +
        '<span class="flex items-center gap-1"><span class="w-3 h-2 rounded-sm" style="background:#64748B"></span> 0 (netral)</span>' +
        '<span class="flex items-center gap-1"><span class="w-3 h-2 rounded-sm" style="background:#10B981"></span> +1.0 (searah)</span>';
    panel.insertBefore(legend, panel.firstChild);
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function(){
    createShortcutsModal();
    initSidebarCollapse();
    initRippleEffect();
    initSwipeGestures();
    initPullToRefresh();

    // #38 session indicator update
    renderSessionIndicator();
    setInterval(renderSessionIndicator, 60000);

    // #39 tab title update
    setInterval(updateTabTitle, 5000);

    // #17 last updated
    setInterval(updateLastUpdatedTime, 60000);

    // #50 What's New
    showWhatsNew();

    // #34 calendar enhance
    watchCalendarRender();

    // #40 signal copy-to-journal
    watchSignalRender();

    // #33 news asset filter (delay to let news panel render)
    setTimeout(initNewsAssetFilter, 1000);

    // #22 correlation legend
    setTimeout(addCorrelationLegend, 500);

    // #42 indicator tooltips (after signals render)
    setTimeout(addIndicatorTooltips, 2000);
    setInterval(addIndicatorTooltips, 10000);

    // Listen for panel switches to update timestamp
    var origSwitch = window.switchPanel;
    if (typeof origSwitch === 'function') {
        window.switchPanel = function(id){
            origSwitch(id);
            updateLastUpdatedTime();
        };
    }

    // ? key to open shortcuts
    document.addEventListener('keydown', function(e){
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            var tag = (document.activeElement||{}).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            e.preventDefault();
            toggleShortcutsModal();
        }
    });
});

})();
