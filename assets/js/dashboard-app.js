
// ─── Config ────────────────────────────────────────────────────────────────
// FX first (like FX Terminal), then crypto
const SYMBOLS = ['EURUSD','GBPUSD','XAUUSD','USDJPY','AUDUSD','NZDUSD','USDCHF','USDCAD','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT'];
const SYMBOL_LABELS = {
    XAUUSD:'XAU/USD', EURUSD:'EUR/USD', GBPUSD:'GBP/USD',
    USDJPY:'USD/JPY', AUDUSD:'AUD/USD', NZDUSD:'NZD/USD',
    USDCHF:'USD/CHF', USDCAD:'USD/CAD',
    GBPJPY:'GBP/JPY', EURJPY:'EUR/JPY', EURGBP:'EUR/GBP',
    AUDNZD:'AUD/NZD', CHFJPY:'CHF/JPY', CADJPY:'CAD/JPY',
    BTCUSDT:'BTC/USDT', ETHUSDT:'ETH/USDT', SOLUSDT:'SOL/USDT',
    BNBUSDT:'BNB/USDT', XRPUSDT:'XRP/USDT', DOGEUSDT:'DOGE/USDT',
};
const SYMBOL_DESC = {
    XAUUSD:'Spot Gold', EURUSD:'Euro / Dollar', GBPUSD:'Pound / Dollar',
    USDJPY:'Dollar / Yen', AUDUSD:'Aussie / Dollar', NZDUSD:'Kiwi / Dollar',
    USDCHF:'Dollar / Franc', USDCAD:'Dollar / Loonie',
    BTCUSDT:'Bitcoin', ETHUSDT:'Ethereum', SOLUSDT:'Solana',
    BNBUSDT:'BNB Chain', XRPUSDT:'Ripple', DOGEUSDT:'Dogecoin',
};
const DP = {
    XAUUSD:2, EURUSD:5, GBPUSD:5, USDJPY:3, AUDUSD:5, NZDUSD:5, USDCHF:5, USDCAD:5,
    BTCUSDT:2, ETHUSDT:2, SOLUSDT:3, BNBUSDT:2, XRPUSDT:4, DOGEUSDT:5
};

// ─── World Clock ───────────────────────────────────────────────────────────
const TZ_SESSIONS = {
    LDN: { tz:'Europe/London',     name:'London',   session:'London Sesi',   openH:8,  closeH:17 },
    NYC: { tz:'America/New_York',  name:'New York',  session:'New York Sesi', openH:8,  closeH:17 },
    TYO: { tz:'Asia/Tokyo',        name:'Tokyo',     session:'Tokyo Sesi',    openH:9,  closeH:18 },
    SYD: { tz:'Australia/Sydney',  name:'Sydney',    session:'Sydney Sesi',   openH:7,  closeH:16 },
};
const DAYS_ID = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function getZoneTime(tz) {
    return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
}
function zeroPad(n) { return String(n).padStart(2,'0'); }

function updateClocks() {
    const now = new Date();
    for (const [key, cfg] of Object.entries(TZ_SESSIONS)) {
        const t = getZoneTime(cfg.tz);
        const hh = zeroPad(t.getHours()), mm = zeroPad(t.getMinutes()), ss = zeroPad(t.getSeconds());
        const timeStr = `${hh}:${mm}:${ss}`;
        const dateStr = `${DAYS_ID[t.getDay()]} ${t.getDate()} ${MONTHS_ID[t.getMonth()]}`;
        const isOpen  = t.getHours() >= cfg.openH && t.getHours() < cfg.closeH && t.getDay() >= 1 && t.getDay() <= 5;

        // Header clocks
        const hdr = document.getElementById(`clock${key}`);
        if (hdr) hdr.textContent = timeStr;

        // World clock cards
        const card = document.getElementById(`wc${key}`);
        if (card) {
            card.querySelector('.wc-time').textContent = `${hh}:${mm}`;
            card.querySelector('.wc-date').textContent = dateStr;
            const badge = card.querySelector('.wc-session');
            badge.textContent = isOpen ? '● OPEN' : '○ CLOSED';
            badge.className = `wc-session mt-1.5 text-[9px] font-semibold rounded px-1 py-0.5 inline-block ${isOpen ? 'text-qi-green bg-qi-green/10' : 'text-slate-600 bg-slate-800/50'}`;
            card.classList.toggle('border-qi-green/30', isOpen);
        }
    }

    // Header date
    const ldnT = getZoneTime('Europe/London');
    const d = document.getElementById('headerDateStr');
    if (d) d.textContent = `${DAYS_ID[ldnT.getDay()]} ${ldnT.getDate()} ${MONTHS_ID[ldnT.getMonth()]} ${ldnT.getFullYear()}`;

    // Active session for stat card
    updateSessionCard();
}

function updateSessionCard() {
    const sessions = [
        { name:'Sydney',  tz:'Australia/Sydney',   openH:7,  closeH:16, color:'text-sky-400' },
        { name:'Tokyo',   tz:'Asia/Tokyo',          openH:9,  closeH:18, color:'text-red-400' },
        { name:'London',  tz:'Europe/London',       openH:8,  closeH:17, color:'text-blue-400' },
        { name:'New York',tz:'America/New_York',    openH:8,  closeH:17, color:'text-green-400' },
    ];
    const active = sessions.filter(s => {
        const t = getZoneTime(s.tz);
        return t.getHours() >= s.openH && t.getHours() < s.closeH && t.getDay() >= 1 && t.getDay() <= 5;
    });
    const el = document.getElementById('statSession');
    const sub = document.getElementById('statSessionSub');
    if (!active.length) {
        if (el) { el.textContent = 'Pasar Tutup'; el.className = 'text-xl font-heading font-bold text-slate-500'; }
        if (sub) sub.textContent = 'Weekend / di luar jam sesi';
    } else {
        const names = active.map(s => s.name).join(' + ');
        if (el) { el.textContent = names; el.className = `text-xl font-heading font-bold ${active[active.length-1].color}`; }
        if (sub) sub.textContent = active.length > 1 ? 'Overlap — volatilitas tinggi' : 'Sesi aktif';
    }
}

// ─── Market Data ───────────────────────────────────────────────────────────
let _lastPrices  = {};
let _lastSignals = {};
// Waktu (ms) data harga terakhir berhasil diambil — dipakai indikator kesegaran.
let _lastPricesAt = 0;

async function fetchMarketData() {
    try {
        const res = await fetch(`api/live-price.php?symbols=${SYMBOLS.join(',')}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'success') return;
        _lastPrices = data.prices || {};
        _lastPricesAt = Date.now();
        renderTicker(_lastPrices);
        renderMarketTape(_lastPrices);
        renderStatCards(_lastPrices);
        const tapeUpd = document.getElementById('tapeUpdated');
        if (tapeUpd) tapeUpd.textContent = new Date().toLocaleTimeString('id-ID');
        updateWatchlistPrices();
        // Pro features: floating ticker + price alerts
        var flatPrices = {};
        Object.entries(_lastPrices).forEach(function(e) { flatPrices[e[0]] = parseFloat(e[1].price); });
        if (typeof updateFloatingTicker === 'function') updateFloatingTicker(flatPrices);
        if (typeof checkPriceAlerts === 'function') checkPriceAlerts(flatPrices);
    } catch(e) {}
}

function fmt(sym, price) {
    const dp = DP[sym] ?? 2;
    return parseFloat(price).toFixed(dp);
}

function pctColor(pct) {
    if (pct > 0) return 'text-qi-green';
    if (pct < 0) return 'text-qi-red';
    return 'text-slate-400';
}
function pctArrow(pct) { return pct > 0 ? '▲' : pct < 0 ? '▼' : '─'; }

// ─── Ticker ────────────────────────────────────────────────────────────────
function renderTicker(prices) {
    const items = Object.entries(prices).map(([sym, d]) => {
        const pct = parseFloat(d.chgPct ?? 0);
        const cls = pct >= 0 ? 'text-qi-green' : 'text-qi-red';
        const price = fmt(sym, d.price);
        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        return `<span class="inline-flex items-center gap-2 px-4 border-r border-qi-border/40 h-8 text-[11px]">
            <span class="text-slate-400 font-semibold">${SYMBOL_LABELS[sym] || sym}</span>
            <span class="font-mono text-white">${price}</span>
            <span class="font-mono ${cls} font-semibold">${pctStr}</span>
        </span>`;
    }).join('');
    // Duplicate for seamless loop
    const track = document.getElementById('tickerTrack');
    if (track) track.innerHTML = items + items;
}

// ─── Market Tape ───────────────────────────────────────────────────────────
function renderMarketTape(prices) {
    const tbody = document.getElementById('marketTapeBody');
    if (!tbody) return;
    const rows = Object.entries(prices).map(([sym, d]) => {
        const pct = parseFloat(d.chgPct ?? 0);
        const cls = pctColor(pct);
        const arrow = pctArrow(pct);
        const price = fmt(sym, d.price);
        const high  = d.high  ? fmt(sym, d.high)  : '—';
        const low   = d.low   ? fmt(sym, d.low)   : '—';
        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        const label = SYMBOL_LABELS[sym] || sym;
        const desc  = SYMBOL_DESC[sym]  || '';
        return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02] transition-colors cursor-pointer"
                    onclick="window.location.href='dashboard.html?panel=panel-charts'">
            <td class="px-4 py-2.5">
                <div class="font-semibold text-white">${label}</div>
                <div class="text-[10px] text-slate-600">${desc}</div>
            </td>
            <td class="px-3 py-2.5 text-right font-mono text-white tabular-nums">${price}</td>
            <td class="px-3 py-2.5 text-right font-mono text-slate-400 tabular-nums hidden sm:table-cell">${high}</td>
            <td class="px-3 py-2.5 text-right font-mono text-slate-400 tabular-nums hidden sm:table-cell">${low}</td>
            <td class="px-3 py-2.5 text-right font-mono tabular-nums">
                <span class="${cls} font-semibold">${arrow} ${pctStr}</span>
            </td>
            <td class="px-3 py-2.5 text-center hidden md:table-cell">
                <span class="text-[10px] text-slate-600 hover:text-qi-cyan transition-colors">→ Chart</span>
            </td>
        </tr>`;
    }).join('');
    tbody.innerHTML = rows || `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-600">Tidak ada data</td></tr>`;
}

// ─── Stat Cards ────────────────────────────────────────────────────────────
function renderStatCards(prices) {
    const entries = Object.entries(prices);
    // Instruments count
    const instrEl = document.getElementById('statInstruments');
    const instrSub = document.getElementById('statInstrumentsSub');
    if (instrEl) instrEl.textContent = entries.length;
    if (instrSub) instrSub.textContent = `${entries.length} instrumen terpantau`;

    // Top mover
    if (!entries.length) return;
    const topMover = entries.reduce((best, [sym, d]) => {
        const abs = Math.abs(parseFloat(d.chgPct ?? 0));
        return abs > best.abs ? { sym, d, abs } : best;
    }, { sym:'', d:{}, abs:0 });

    const pct = parseFloat(topMover.d.chgPct ?? 0);
    const cls = pct >= 0 ? 'text-qi-green' : 'text-qi-red';
    const moverEl = document.getElementById('statMoverPct');
    const moverSym = document.getElementById('statMoverSymbol');
    if (moverEl) {
        moverEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        moverEl.className = `text-2xl font-heading font-bold ${cls}`;
    }
    if (moverSym) moverSym.textContent = SYMBOL_LABELS[topMover.sym] || topMover.sym;
}

// ─── Strength Stack — dari api/currency-strength.php ──────────────────────
const CUR_COLORS = {
    USD:'#10B981', EUR:'#3B82F6', GBP:'#8B5CF6',
    JPY:'#F59E0B', CHF:'#EC4899', AUD:'#06B6D4',
    NZD:'#84CC16', CAD:'#F97316',
};

async function fetchStrengthStack() {
    const container = document.getElementById('strengthStack');
    try {
        const res  = await fetch('api/currency-strength.php');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const currencies = data.currencies || [];
        if (!currencies.length) throw new Error('empty');

        // Sort: strongest first (score desc)
        currencies.sort((a, b) => b.score - a.score);

        if (container) {
            container.innerHTML = currencies.map((c, i) => {
                const color  = CUR_COLORS[c.currency] || '#94A3B8';
                const chg    = parseFloat(c.chgPct ?? 0);
                const chgStr = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                const chgCls = chg > 0 ? 'text-qi-green' : chg < 0 ? 'text-qi-red' : 'text-slate-500';
                return `
                <div class="flex items-center gap-2">
                    <div class="w-8 text-right text-[10px] font-mono font-bold text-white">${c.currency}</div>
                    <div class="flex-1 bg-qi-panel rounded-full h-2.5 overflow-hidden">
                        <div class="strength-bar h-full rounded-full"
                             style="width:${c.score}%;background:${color}"></div>
                    </div>
                    <div class="w-7 text-[10px] font-mono text-slate-400 tabular-nums">${c.score}</div>
                    <div class="w-12 text-[9px] font-mono ${chgCls} tabular-nums text-right">${chgStr}</div>
                    <div class="text-[9px] text-slate-600 w-4">#${i+1}</div>
                </div>`;
            }).join('');
        }

        const upd = document.getElementById('strengthUpdated');
        if (upd) upd.textContent = new Date().toLocaleTimeString('id-ID');

    } catch(e) {
        // Fallback: derive from _lastPrices if API not ready
        if (container && Object.keys(_lastPrices).length) renderStrengthFallback(_lastPrices);
    }
}

function renderStrengthFallback(prices) {
    const container = document.getElementById('strengthStack');
    if (!container) return;
    const eur = parseFloat(prices.EURUSD?.chgPct ?? 0);
    const xau = parseFloat(prices.XAUUSD?.chgPct ?? 0);
    const normalize = v => Math.round(Math.min(100, Math.max(0, ((v + 5) / 10) * 100)));
    const assets = [
        {label:'USD', score: normalize(-(eur + xau)/2), color: CUR_COLORS.USD},
        {label:'EUR', score: normalize(eur),             color: CUR_COLORS.EUR},
        {label:'GOLD',score: normalize(xau),             color:'#F59E0B'},
    ].sort((a,b) => b.score - a.score);
    container.innerHTML = assets.map((a, i) => `
        <div class="flex items-center gap-2">
            <div class="w-8 text-right text-[10px] font-mono font-bold text-white">${a.label}</div>
            <div class="flex-1 bg-qi-panel rounded-full h-2.5 overflow-hidden">
                <div class="strength-bar h-full rounded-full" style="width:${a.score}%;background:${a.color}"></div>
            </div>
            <div class="w-7 text-[10px] font-mono text-slate-400">${a.score}</div>
            <div class="text-[9px] text-slate-600 w-4">#${i+1}</div>
        </div>`).join('');
}

// ─── Calendar High Impact ──────────────────────────────────────────────────
let _dashNextHighEvent = null;
let _dashCdInterval   = null;

async function fetchCalendarCount() {
    try {
        const res  = await fetch('api/calendar.php');
        if (!res.ok) return;
        const data = await res.json();
        const events = data.events || data.data || [];
        const high = events.filter(e =>
            (e.impact||'').toLowerCase() === 'high' ||
            (e.impact||'').toLowerCase() === 'tinggi' ||
            (e.importance||0) >= 3
        ).length;
        const el  = document.getElementById('statEvents');
        const sub = document.getElementById('statEventsSub');
        if (el)  el.textContent  = high;
        if (sub) sub.textContent = `dari ${events.length} event minggu ini`;

        // Find next upcoming high-impact event
        const now = Date.now();
        const upcoming = events
            .filter(e => (e.impact||'').toLowerCase() === 'high' && new Date(e.date).getTime() > now)
            .sort((a,b) => new Date(a.date) - new Date(b.date));
        _dashNextHighEvent = upcoming[0] || null;

        if (_dashNextHighEvent) {
            document.getElementById('statNextEvent').classList.remove('hidden');
            document.getElementById('statNextEventTitle').textContent = _dashNextHighEvent.title || '';
            clearInterval(_dashCdInterval);
            _dashCdInterval = setInterval(updateDashCountdown, 1000);
            updateDashCountdown();
        }
    } catch(e) {
        const el = document.getElementById('statEvents');
        if (el) el.textContent = '—';
    }
}

function updateDashCountdown() {
    if (!_dashNextHighEvent) return;
    const diff = new Date(_dashNextHighEvent.date).getTime() - Date.now();
    if (diff <= 0) {
        clearInterval(_dashCdInterval);
        const ticker = document.getElementById('qimNewsTicker');
        if (ticker) ticker.classList.add('hidden');
        fetchCalendarCount();
        return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2,'0');
    const cdText = h >= 24
        ? `${Math.floor(h/24)}d ${pad(h%24)}:${pad(m)}:${pad(s)}`
        : `${pad(h)}:${pad(m)}:${pad(s)}`;

    const el = document.getElementById('statNextEventCd');
    if (el) el.textContent = cdText;

    const ticker = document.getElementById('qimNewsTicker');
    const tickerText = document.getElementById('qimNewsTickerText');
    const tickerCd = document.getElementById('qimNewsTickerCountdown');
    if (ticker) {
        ticker.classList.remove('hidden');
        ticker.classList.add('flex');
        const curr = (_dashNextHighEvent.currency || _dashNextHighEvent.country || '').toUpperCase();
        if (tickerText) tickerText.textContent = `${curr ? '[' + curr + '] ' : ''}${_dashNextHighEvent.title || 'High Impact'}`;
        if (tickerCd) tickerCd.textContent = cdText;
        if (diff < 15 * 60 * 1000) {
            ticker.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium border border-rose-500/50 bg-rose-500/20 text-rose-300 transition-all cursor-pointer animate-pulse max-w-[280px] truncate';
        } else {
            ticker.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium border border-amber-500/30 bg-amber-500/10 text-amber-300 transition-all cursor-pointer max-w-[280px] truncate';
        }
    }
}

// ─── User display ─────────────────────────────────────────────────────────
function loadUserInfo() {
    try {
        const token = localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token');
        const name  = localStorage.getItem('qi_user_name') || sessionStorage.getItem('qi_user_name');
        const el    = document.getElementById('sidebarUser');
        if (el) el.textContent = name || (token ? 'Member' : 'Guest');
        const raw  = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        const userData = raw ? JSON.parse(raw) : null;
        const adminLink = document.getElementById('sidebarAdminLink');
        if (adminLink && userData?.role === 'admin') adminLink.classList.remove('hidden');
    } catch(e) {}
}

// ─── Sidebar toggle (mobile) ──────────────────────────────────────────────
function toggleSidebar() {
    const sb  = document.getElementById('sidebar');
    const ovl = document.getElementById('sidebarOverlay');
    const icon = document.getElementById('sbToggleIcon');
    const isDesktop = window.innerWidth >= 1024;
    if (isDesktop) {
        const collapsed = sb.classList.toggle('sidebar-collapsed');
        if (icon) icon.textContent = collapsed ? '›' : '‹';
        try { localStorage.setItem('qi_sb_collapsed', collapsed ? '1' : '0'); } catch(e){}
    } else {
        const open = sb.classList.toggle('open');
        ovl.classList.toggle('hidden', !open);
    }
}
// Restore sidebar collapse state on load
(function(){ try { if (localStorage.getItem('qi_sb_collapsed')==='1' && window.innerWidth>=1024) { document.getElementById('sidebar')?.classList.add('sidebar-collapsed'); const i=document.getElementById('sbToggleIcon'); if(i) i.textContent='›'; } } catch(e){} })();

// ─── Init ─────────────────────────────────────────────────────────────────
updateClocks();
setInterval(updateClocks, 1000);

// ─── Calendar Heatmap ─────────────────────────────────────────────────────
let _calEvents  = [];
let _calSelected = null;

async function fetchCalendarHeatmap() {
    try {
        const res  = await fetch('api/calendar.php');
        if (!res.ok) return;
        const data = await res.json();
        _calEvents = data.events || data.data || [];
    } catch(e) {}
}

// ─── MTF Bias Panel ────────────────────────────────────────────────────────
// Timeframe yang dinilai. Panel MTF menjanjikan "M5, M15, H1, H4, D1", jadi
// daftarnya harus lengkap — sebelumnya hanya H1/H4/D1 sehingga panel terlihat
// kosong separuh dan tidak sesuai keterangannya sendiri.
const MTF_TFS = [
    { label: 'M5',  interval: '5'   },
    { label: 'M15', interval: '15'  },
    { label: 'H1',  interval: '60'  },
    { label: 'H4',  interval: '240' },
    { label: 'D1',  interval: 'D'   },
];
async function fetchMtfBias(sym) {
    // Simbol diambil dari select mana pun yang ada (widget Overview atau panel MTF).
    if (!sym) {
        const s1 = document.getElementById('mtfPairSelect');
        const s2 = document.getElementById('mtfSymbol');
        sym = (s1 && s1.value) || (s2 && s2.value) || 'XAUUSD';
    }
    // Simpan pilihan agar kedua select tetap sinkron.
    try {
        const s1 = document.getElementById('mtfPairSelect'); if (s1) s1.value = sym;
        const s2 = document.getElementById('mtfSymbol');     if (s2) s2.value = sym;
    } catch (e) {}
    // Ada DUA tempat tampil: widget ringkas di Overview (#mtfGrid) dan panel MTF
    // tersendiri (#mtfGridPanel). Sebelumnya keduanya memakai id "mtfGrid" sehingga
    // kartu selalu jatuh ke widget pertama dan panel MTF terlihat kosong.
    const gridRingkas = document.getElementById('mtfGrid');
    const gridPanel   = document.getElementById('mtfGridPanel');
    const grid = gridRingkas || gridPanel;
    if (!grid) return;
    const skeleton = MTF_TFS.map(() => '<div class="skel h-16 rounded-lg"></div>').join('');
    if (gridRingkas) gridRingkas.innerHTML = skeleton;
    if (gridPanel && gridPanel !== gridRingkas) gridPanel.innerHTML = skeleton;

    const results = await Promise.allSettled(
        MTF_TFS.map(tf => fetch(`api/get-chart-data.php?symbol=${sym}&interval=${tf.interval}`).then(r => r.json()))
    );

    let html = '', jumlahBull = 0, jumlahBear = 0, jumlahTerbaca = 0;
    results.forEach((res, i) => {
        const tf = MTF_TFS[i];
        const adaData = res.status === 'fulfilled' && res.value && Array.isArray(res.value.candles) && res.value.candles.length >= 5;
        let bias = null, chgPct = 0, sumber = '';
        if (adaData) {
            const candles = res.value.candles.slice(-10);
            const bullish = candles.filter(c => c.close > c.open).length;
            const last = candles[candles.length - 1];
            const first = candles[0];
            chgPct = first.open > 0 ? ((last.close - first.open) / first.open * 100) : 0;
            if (bullish >= 7) bias = 'BULLISH';
            else if (bullish <= 3) bias = 'BEARISH';
            else bias = 'NEUTRAL';
            sumber = res.value.source || '';
            jumlahTerbaca++;
            if (bias === 'BULLISH') jumlahBull++;
            if (bias === 'BEARISH') jumlahBear++;
        }
        // JUJUR: bila data tidak tersedia, katakan apa adanya — jangan mengarang arah.
        const color = !adaData ? '#64748B' : bias === 'BULLISH' ? '#10B981' : bias === 'BEARISH' ? '#EF4444' : '#94A3B8';
        const icon  = !adaData ? '—' : bias === 'BULLISH' ? '▲' : bias === 'BEARISH' ? '▼' : '◆';
        const label = !adaData ? 'data tidak tersedia' : bias;
        const chgStr = adaData ? ((chgPct >= 0 ? '+' : '') + chgPct.toFixed(2) + '%') : '';
        html += `
            <div class="rounded-lg p-3 text-center" style="background:${color}18;border:1px solid ${color}30" title="${adaData ? ('Sumber: ' + sumber) : 'Candle tidak tersedia dari sumber data'}">
                <div class="text-[10px] font-semibold text-slate-400 mb-1">${tf.label}</div>
                <div class="text-sm font-bold" style="color:${color}">${icon} ${label}</div>
                <div class="text-[10px] mt-1" style="color:${color}99">${chgStr}</div>
            </div>`;
    });
    if (gridRingkas) gridRingkas.innerHTML = html;
    if (gridPanel && gridPanel !== gridRingkas) gridPanel.innerHTML = html;

    // Overall bias hanya dihitung dari timeframe yang datanya benar-benar terbaca.
    const biasEl = document.getElementById('mtfBias');
    if (biasEl) {
        if (jumlahTerbaca === 0) {
            biasEl.innerHTML = '<span class="font-mono font-bold text-lg text-slate-400">DATA TIDAK TERSEDIA</span>'
                + '<span class="text-[10px] text-slate-500 block">sumber candle belum bisa dihubungi</span>';
        } else {
            const arah = jumlahBull > jumlahBear ? 'BUY' : jumlahBear > jumlahBull ? 'SELL' : 'NEUTRAL';
            const cls  = arah === 'BUY' ? 'text-qi-green' : arah === 'SELL' ? 'text-qi-red' : 'text-qi-gold';
            biasEl.innerHTML = '<span class="font-mono font-bold text-lg ' + cls + '">' + arah + '</span>'
                + '<span class="text-[10px] text-slate-500 block">' + Math.max(jumlahBull, jumlahBear) + '/' + jumlahTerbaca
                + ' timeframe sepakat (dari ' + jumlahTerbaca + ' yang terbaca · ' + sym + ')</span>';
        }
    }
    const upd = document.getElementById('mtfUpdated');
    if (upd) upd.textContent = new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
}
window.fetchMtfBias = fetchMtfBias;
document.getElementById('mtfPairSelect')?.addEventListener('change', function() {
    fetchMtfBias(this.value);
});

loadUserInfo();
fetchMarketData();
fetchCalendarCount();
fetchStrengthStack();
fetchCalendarHeatmap();
fetchMtfBias('XAUUSD');
setInterval(fetchMarketData,      15000);
setInterval(fetchStrengthStack,   30000);
setInterval(fetchCalendarHeatmap, 300000);
setInterval(() => fetchMtfBias(document.getElementById('mtfPairSelect')?.value || 'XAUUSD'), 120000);
// Auto-refresh P&L paper trading + live price display (5s)
setInterval(() => {
    if (_activePanel === 'panel-paper') { ptUpdateLivePrice(); ptRender(); }
    if (_activePanel === 'panel-radar') renderRadarQuickScan();
}, 5000);
// Auto-refresh order book — semua pair sekaligus
const OB_SYMS = ['XAUUSD','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
setInterval(() => {
    if (_activePanel === 'panel-orderbook') fetchAllOrderBooks();
}, 3000);

// ─── Panel Switcher ────────────────────────────────────────────────────────
const PANEL_META = {
    'panel-overview':     { icon:'🌐', title:'Market Overview' },
    'panel-account':      { icon:'👤', title:'Akun & Kinerja' },
    'panel-charts':       { icon:'📈', title:'Charts' },
    'panel-signal':       { icon:'📡', title:'Signal Matrix' },
    'panel-outlook':      { icon:'🔬', title:'Technical Outlook' },
    'panel-heatmap':      { icon:'📅', title:'Economic Calendar' },
    'panel-orderbook':    { icon:'📊', title:'Order Book' },
    'panel-news':         { icon:'📰', title:'News Feed' },
    'panel-strength':     { icon:'💪', title:'Currency Strength' },
    'panel-radar':        { icon:'⚡', title:'Quantum AI Radar' },
    'panel-paper':        { icon:'💼', title:'Paper Trading' },
    'panel-mesin9':       { icon:'🤖', title:'Mesin 9 — Sinyal Konfluensi' },
    'panel-ai-trade':     { icon:'🤖', title:'AI Auto-Trade' },
    'panel-ai':           { icon:'🤖', title:'AI Trading Assistant' },
    'panel-track':        { icon:'🏆', title:'Track Record' },
    'panel-correlation':  { icon:'🔮', title:'Correlation Matrix' },
    'panel-cot':          { icon:'📋', title:'COT Analysis' },
    'panel-impact':       { icon:'⚡', title:'News Impact' },
    'panel-autosignal':   { icon:'🎯', title:'Auto Signal' },
    'panel-rencana':      { icon:'🧭', title:'Rencana Live (TV)' },
    'panel-gateway':      { icon:'🛰️', title:'Quantum AI Signal Gateway' },
    'panel-sessions':     { icon:'🕸️', title:'Market Galaxy — Network Map' },
    'panel-crypto':       { icon:'🐋', title:'Crypto Terminal' },
    'panel-risk':         { icon:'🧮', title:'Risk Calculator' },
    'panel-alerts':       { icon:'🔔', title:'Price Alerts' },
    'panel-journal':      { icon:'📔', title:'Trade Journal' },
    'panel-screener':     { icon:'🔍', title:'Market Screener' },
    'panel-volatility':   { icon:'📊', title:'Volatility Dashboard' },
    'panel-sentiment':    { icon:'🌡', title:'Sentiment & Sessions' },
    'panel-watchlist':    { icon:'⭐', title:'Custom Watchlist' },
    'panel-performance':  { icon:'📊', title:'Performance Analytics' },
    'panel-mtf':          { icon:'🔄', title:'Multi-Timeframe' },
    'panel-leaderboard':  { icon:'🏅', title:'Trading Leaderboard' },
    'panel-academy':      { icon:'🎓', title:'Trading Academy & Cheatsheet' },
    'panel-community':    { icon:'💬', title:'Quantum Community Chat' },
};
let _activePanel = 'panel-overview';
let _panelInited = new Set(['panel-overview']);

function switchPanel(id) {
    if (_activePanel === id) {
        const sb = document.getElementById('sidebar');
        const ovl = document.getElementById('sidebarOverlay');
        if (sb?.classList.contains('open')) { sb.classList.remove('open'); ovl?.classList.add('hidden'); }
        if (id === 'panel-community' && typeof renderChat === 'function') renderChat();
        return;
    }
    // Loading bar animation
    const bar = document.getElementById('panelLoadBar');
    if (bar) { bar.className = 'loading'; bar.offsetWidth; }

    // Hide current
    document.querySelectorAll('.panel-content').forEach(p => p.classList.add('hidden'));
    // Show new with fade-in animation
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.classList.remove('panel-fade-in');
        void el.offsetWidth; // force reflow
        el.classList.add('panel-fade-in');
    }
    // Finish loading bar
    if (bar) { setTimeout(() => { bar.className = 'done'; setTimeout(() => { bar.className = ''; }, 400); }, 200); }
    // Update nav active state
    document.querySelectorAll('#dashNav [data-panel]').forEach(btn => {
        const isActive = btn.dataset.panel === id;
        btn.classList.toggle('active', isActive);
        if (!isActive) btn.classList.add('text-slate-400');
        else btn.classList.remove('text-slate-400');
    });
    // Update mobile bottom nav active state
    document.querySelectorAll('#mobileBottomNav [data-mob-panel]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mobPanel === id);
    });
    // Update title bar
    const meta = PANEL_META[id] || { icon:'●', title: id };
    const ti = document.getElementById('panelTitleIcon');
    const tt = document.getElementById('panelTitleText');
    if (ti) ti.textContent = meta.icon;
    if (tt) tt.textContent = meta.title;
    // Close mobile sidebar
    const sb = document.getElementById('sidebar');
    const ovl = document.getElementById('sidebarOverlay');
    if (sb?.classList.contains('open')) { sb.classList.remove('open'); ovl?.classList.add('hidden'); }
    // Scroll to top
    const ms = document.getElementById('mainScroll');
    if (ms) ms.scrollTop = 0;
    _activePanel = id;
    document.body.classList.toggle('charts-active', id === 'panel-charts');
    document.dispatchEvent(new CustomEvent('qim:panel-change', { detail: { panel: id } }));
    if (id === 'panel-charts' && _lwChart) {
        setTimeout(() => {
            _lwChart.applyOptions({ autoSize: true });
            _lwChart.timeScale().fitContent();
        }, 100);
    }
    // Lazy-init panels
    if (!_panelInited.has(id)) {
        _panelInited.add(id);
        initPanel(id);
    } else {
        if (id === 'panel-community' && typeof renderChat === 'function') renderChat();
        // Panel akun: segarkan lalu GAMBAR ULANG grafik, karena kanvas yang tersembunyi
        // berukuran 0 saat pertama digambar.
        if (id === 'panel-account') { loadOpenPositions(); loadBalanceHistory(); }
    }
}

let _accountRefreshTimer = null;

// ═══════════════════════════════════════════════════════════════════════════
// AKSES PAKET (FREE / PRO / VIP) — DASHBOARD
//
// Pengguna FREE boleh masuk dashboard, tetapi hanya sebagian area yang terbuka.
// Area lain tetap TERLIHAT di sidebar dengan tanda 🔒 supaya pengguna tahu ada
// yang bisa dibuka — pola wajar webapp berlangganan (upsell yang jujur).
//
// ✏️ UBAH PAKET CUKUP DI SATU TEMPAT: QI_PANEL_MIN di bawah.
//    0 = free · 1 = pro · 2 = vip · 3 = admin (admin selalu penuh)
//
// CATATAN JUJUR: penguncian ini adalah PENGALAMAN PENGGUNA (UX), bukan pengamanan.
// Pengamanan sebenarnya ada di sisi server/API. Sebagian besar endpoint saat ini
// hanya mewajibkan login (qi_require_auth); endpoint sensitif (eksekusi order,
// API key) sudah memeriksa peran sendiri.
// ═══════════════════════════════════════════════════════════════════════════
const QI_TINGKAT = { free: 0, pro: 1, vip: 2, admin: 3 };
const QI_PANEL_MIN = {
    // ── FREE: terbuka untuk semua pengguna terdaftar ──
    'panel-overview': 0,      // Dashboard
    'panel-charts': 0,        // Charts (chart + Mesin 9 ringkas tetap bisa dilihat)
    'panel-signal': 0,        // Signal Matrix
    'panel-news': 0,          // News Feed
    'panel-cot': 0,           // COT Analysis
    'panel-impact': 0,        // News Impact
    'panel-heatmap': 0,       // Economic Heatmap
    'panel-correlation': 0,   // Correlation Matrix
    'panel-strength': 0,      // Currency Strength
    'panel-sessions': 0,      // Market Galaxy
    'panel-academy': 0,       // Academy & Cheatsheet
    'panel-community': 0,     // Community
    'panel-track': 0,         // Track Record (transparansi → justru membangun kepercayaan)
    'panel-account': 0,       // Akun & Kinerja (halaman akun sendiri, jangan dikunci)
    // ── PRO ──
    'panel-radar': 1,         // Quantum AI Radar (sudah bertanda PRO)
    'panel-mesin9': 1,        // Mesin 9 — Sinyal Konfluensi
    'panel-ai': 1,            // AI Assistant
    'panel-outlook': 1,       // Technical Outlook
    'panel-orderbook': 1,     // Order Book
    'panel-autosignal': 1,    // Auto Signal
    'panel-rencana': 1,       // Rencana Live (TradingView) — PRO
    'panel-gateway': 1,       // Signal Gateway (log webhook + saklar darurat) — PRO
    'panel-crypto': 1,        // Crypto Terminal
    'panel-risk': 1,          // Risk Calculator
    'panel-alerts': 1,        // Price Alerts
    'panel-journal': 1,       // Trade Journal
    'panel-screener': 1,      // Market Screener
    'panel-volatility': 1,    // Volatility & Spread
    'panel-sentiment': 1,     // Sentiment & Clocks
    'panel-watchlist': 1,     // Custom Watchlist
    'panel-mtf': 1,           // Multi-Timeframe
    'panel-leaderboard': 1,   // Leaderboard
    'panel-paper': 1,         // Paper Trading
    'panel-performance': 1,   // Analitik Performa
    // ── VIP ──
    'panel-ai-trade': 2       // AI Auto-Trade (menyentuh eksekusi order nyata)
};
const QI_NAMA_TINGKAT = { 1: 'PRO', 2: 'VIP' };
function qiTingkatSaatIni() { return QI_TINGKAT[String(window.QI_PERAN || 'free').toLowerCase()] ?? 0; }
function qiTingkatPanel(id) { return Object.prototype.hasOwnProperty.call(QI_PANEL_MIN, id) ? QI_PANEL_MIN[id] : 0; }
function qiPanelTerkunci(id) { return qiTingkatSaatIni() < qiTingkatPanel(id); }

// Simpan fungsi asli SEBELUM dibungkus (dipakai ulang oleh modul ini).
const _spAsli = switchPanel;

function qiPasangBadgeKunci() {
    document.querySelectorAll('#dashNav [data-panel], #mobileBottomNav [data-mob-panel]').forEach(btn => {
        const id = btn.dataset.panel || btn.dataset.mobPanel;
        if (!id) return;
        // Buang badge lama "PRO"/"VIP" supaya tidak dobel dengan badge kunci.
        btn.querySelectorAll('span').forEach(s => {
            const t = (s.textContent || '').trim();
            if ((t === 'PRO' || t === 'VIP') && !s.classList.contains('qi-kunci-badge')) s.remove();
        });
        let badge = btn.querySelector('.qi-kunci-badge');
        if (qiPanelTerkunci(id)) {
            const namaTingkat = QI_NAMA_TINGKAT[qiTingkatPanel(id)] || 'PRO';
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'qi-kunci-badge ml-auto text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded px-1 shrink-0';
                btn.appendChild(badge);
            }
            badge.textContent = '🔒 ' + namaTingkat;
            badge.title = 'Terbuka untuk paket ' + namaTingkat;
            btn.classList.add('qi-terkunci');
        } else if (badge) {
            badge.remove();
            btn.classList.remove('qi-terkunci');
        }
    });
}

function qiTampilkanKunci(id) {
    const tingkat = qiTingkatPanel(id);
    const namaTingkat = QI_NAMA_TINGKAT[tingkat] || 'PRO';
    const nama = (PANEL_META[id] || {}).title || id;
    let ov = document.getElementById('qiKunciOverlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'qiKunciOverlay';
        ov.className = 'fixed inset-0 z-[9998] flex items-center justify-center p-4';
        ov.style.background = 'rgba(2,6,23,.74)';
        ov.innerHTML = `
            <div class="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0B1220] p-5 text-center shadow-2xl">
                <div class="text-3xl mb-2">🔒</div>
                <div id="qiKunciJudul" class="font-heading font-bold text-white text-base mb-1"></div>
                <p id="qiKunciPesan" class="text-slate-400 text-xs leading-relaxed mb-4"></p>
                <div class="flex flex-col sm:flex-row gap-2">
                    <a href="pricing.html" class="flex-1 px-4 py-2.5 rounded-xl bg-qi-cyan text-slate-900 font-bold text-sm hover:opacity-90">Lihat Paket PRO / VIP</a>
                    <button type="button" id="qiKunciTutup" class="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-700">Tutup</button>
                </div>
                <p class="text-[10px] text-slate-500 mt-3">Area lain tetap bisa Anda pakai. Daftar area yang terbuka ada di sidebar (tanpa tanda 🔒).</p>
            </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        ov.querySelector('#qiKunciTutup').addEventListener('click', () => ov.remove());
    }
    document.getElementById('qiKunciJudul').textContent = '🔒 ' + nama + ' — khusus ' + namaTingkat;
    document.getElementById('qiKunciPesan').textContent =
        'Paket Anda sekarang: ' + String(window.QI_PERAN || 'free').toUpperCase()
        + '. Area ini terbuka untuk paket ' + namaTingkat + '.';
}

function qiTerapkanAksesDashboard() {
    try {
        qiPasangBadgeKunci();
        // Bila panel yang sedang tampil kini terkunci (mis. paket diturunkan server),
        // pindahkan ke Dashboard supaya tidak ada area berbayar tetap terbuka.
        const aktif = document.querySelector('.panel-content:not(.hidden)');
        if (aktif && aktif.id && qiPanelTerkunci(aktif.id)) _spAsli('panel-overview');
    } catch (e) {}
}
window.QI_TERAPKAN_AKSES = qiTerapkanAksesDashboard;

// Bungkus switchPanel: area terkunci tidak dibuka sama sekali — sekaligus mencegah
// datanya dimuat (permintaan API-nya tidak pernah dikirim).
switchPanel = function (id) {
    if (id && qiPanelTerkunci(id)) { qiTampilkanKunci(id); return false; }
    return _spAsli(id);
};
window.switchPanel = switchPanel;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', qiTerapkanAksesDashboard);
else qiTerapkanAksesDashboard();

// ── TAUTAN DALAM (DEEP LINK) PANEL ──────────────────────────────────────────
// dashboard.html?panel=panel-radar atau dashboard.html#panel-radar
// Dipakai agar tautan lama ke halaman Terminal tetap mendarat di area yang benar.
(function () {
    try {
        const dariQuery = new URLSearchParams(location.search).get('panel');
        const dariHash = (location.hash || '').replace(/^#/, '');
        const id = (dariQuery && dariQuery.indexOf('panel-') === 0) ? dariQuery
                 : (dariHash && dariHash.indexOf('panel-') === 0) ? dariHash : null;
        if (id && document.getElementById(id)) {
            const buka = () => { try { switchPanel(id); } catch (e) {} };
            if (document.readyState === 'complete') setTimeout(buka, 350);
            else window.addEventListener('load', () => setTimeout(buka, 350));
        }
    } catch (e) {}
})();


function bridgeEndpointUrl() {
    try { return new URL('api/mt-bridge.php?action=snapshot', location.href).href; }
    catch (error) { return 'api/mt-bridge.php?action=snapshot'; }
}

function bridgeOrigin() {
    try { return new URL(bridgeEndpointUrl()).origin; }
    catch (error) { return location.origin; }
}

function fillBridgeEndpoint() {
    const endpoint = bridgeEndpointUrl();
    const origin = bridgeOrigin();
    const value = document.getElementById('bridgeEndpointValue');
    const originValue = document.getElementById('bridgeOriginValue');
    const originStep = document.getElementById('bridgeOriginStep');
    if (value) value.textContent = endpoint;
    if (originValue) originValue.textContent = origin;
    if (originStep) originStep.textContent = origin;
}

// Penyalinan yang tahan gagal. Clipboard API modern bisa ditolak (WebView, dokumen
// tidak fokus, halaman http), jadi ada dua lapis cadangan sebelum menyerah ke salin manual.
function copyTextFallback(text) {
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        if (ok) return true;
    } catch (error) { /* lanjut ke pemilihan manual */ }
    return false;
}

function selectBridgeKey() {
    const el = document.getElementById('bridgeKeyValue');
    if (!el) return;
    try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (error) { /* abaikan */ }
}

async function copyTextRobust(text, manualTarget) {
    if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch (error) { /* coba cara lama */ }
    }
    if (copyTextFallback(text)) return true;
    if (typeof manualTarget === 'function') manualTarget();
    return false;
}

async function copyBridgeEndpoint() {
    const ok = await copyTextRobust(bridgeEndpointUrl(), () => {
        const el = document.getElementById('bridgeEndpointValue');
        if (!el) return;
        try { const range = document.createRange(); range.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(range); } catch (error) { /* abaikan */ }
    });
    showQuantumToast(ok ? 'Endpoint disalin. Tempel ke input Endpoint pada EA.'
        : 'Penyalinan otomatis gagal — teksnya sudah diseleksi, tekan Ctrl+C.', ok ? 'success' : 'warning');
}

// Timestamp dari MySQL ("YYYY-MM-DD HH:MM:SS") dibaca sebagai jam server, bukan jam
// browser: dua nilai dari server yang sama selisihnya selalu tepat walau zona waktunya
// berbeda. Zona waktu server dipakai apa adanya, hanya selisih yang dibutuhkan.
function parseServerClock(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value || ''));
    return match ? Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) : null;
}

function ageInMinutes(value, serverNow) {
    const then = parseServerClock(value);
    const reference = parseServerClock(serverNow);
    if (then === null || reference === null) return null;
    return Math.max(0, (reference - then) / 60000);
}

function relativeTime(value, serverNow) {
    const minutes = ageInMinutes(value, serverNow);
    if (minutes === null) return null;
    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${Math.floor(minutes)} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    return `${Math.floor(hours / 24)} hari lalu`;
}

// Bila respons tidak memuat jam server (API versi lama), tampilkan waktu apa adanya
// daripada menebak selisih zona waktu lalu salah menyimpulkan "EA berhenti".
function describeWhen(value, serverNow) {
    if (!value) return null;
    if (parseServerClock(serverNow) !== null) return relativeTime(value, serverNow);
    const local = new Date(String(value).replace(' ', 'T'));
    return Number.isFinite(local.getTime()) ? local.toLocaleString('id-ID') : null;
}

// Tiga keadaan yang benar-benar berbeda: belum ada akun, akun ada tapi EA belum
// pernah mengirim snapshot (pending), dan sudah menerima snapshot (active).
function renderAccountConnection(data) {
    const title = document.getElementById('accountConnectionTitle');
    const badge = document.getElementById('accountConnectionStatus');
    const summary = document.getElementById('accountConnectionSummary');
    const green = 'rounded-full border border-qi-green/30 bg-qi-green/10 px-2 py-1 text-[9px] font-semibold text-qi-green';
    const amber = 'rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[9px] font-semibold text-amber-300';
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const active = accounts.filter(a => a.connection_status === 'active');
    const pending = accounts.filter(a => a.connection_status === 'pending');
    if (active.length) {
        const latest = active[0];
        const age = ageInMinutes(latest.last_synced_at, data.server_now);
        const stale = age !== null && age > 15;
        if (title) title.textContent = latest.account_label || `${latest.provider} account`;
        if (badge) { badge.textContent = stale ? 'EA BERHENTI?' : 'TERHUBUNG'; badge.className = stale ? amber : green; }
        if (summary) {
            summary.textContent = `${active.length} akun aktif (${latest.provider}). Snapshot terakhir ${describeWhen(latest.last_synced_at, data.server_now) || 'belum ada'}.`
                + (stale ? ' EA mengirim snapshot tiap ±60 detik — periksa apakah terminal terbuka dan AutoTrading masih aktif.' : '');
        }
    } else if (pending.length) {
        const first = pending[0];
        const names = pending.map(a => `${a.provider}${a.account_reference ? ' ' + a.account_reference : ''}`).join(' + ');
        if (title) title.textContent = pending.length > 1 ? `${pending.length} akun menunggu EA` : `${first.provider}${first.account_reference ? ` (${first.account_reference})` : ''} — menunggu EA`;
        if (badge) { badge.textContent = 'MENUNGGU SNAPSHOT EA'; badge.className = amber; }
        if (summary) {
            const detail = pending.map(a => `${a.provider}${a.account_reference ? ' ' + a.account_reference : ''} (key dibuat ${describeWhen(a.bridge_key_created_at, data.server_now) || 'baru saja'})`).join(' · ');
            summary.textContent = `${names} terdaftar, tetapi belum ada snapshot yang masuk — ${detail}. `
                + (pending.length > 1 ? 'Pasang EA hanya untuk akun yang benar-benar Anda pakai, lalu cabut akun lainnya pada daftar di bawah supaya tidak membingungkan. ' : '')
                + `Di terminal MetaTrader: pasang EA read-only (QuantumReadOnlyBridge), isi Endpoint ${bridgeEndpointUrl()} beserta BridgeKey, `
                + `izinkan ${bridgeOrigin()} di Tools → Options → Expert Advisors → Allow WebRequest for listed URL, lalu aktifkan AutoTrading.`;
        }
    } else {
        if (title) title.textContent = 'Belum ada akun terhubung';
        if (badge) { badge.textContent = 'BELUM TERHUBUNG'; badge.className = amber; }
        if (summary) summary.textContent = 'Klik "Hubungkan MT4 / MT5" untuk membuat Bridge Key, lalu jalankan EA read-only di terminal MetaTrader Anda.';
    }
    renderAccountSnapshotStats(active[0] || pending[0] || null, data.server_now);
    renderBridgeAccounts(accounts, data.server_now);
}

function formatUsd(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return '$' + number.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Saldo/ekuitas/margin yang dikirim EA read-only. Sebelumnya angka ini diterima API
// tetapi tidak pernah dirender, jadi saldo akun broker tidak terlihat di mana pun.
function renderAccountSnapshotStats(account, serverNow) {
    const box = document.getElementById('accountSnapshotStats');
    if (!box) return;
    if (!account || account.balance === null || account.balance === undefined) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }
    const clean = value => String(value == null ? '' : value).replace(/[<>&"']/g, '');
    const equity = Number(account.equity);
    const balance = Number(account.balance);
    const tiles = [
        ['Saldo', formatUsd(account.balance), 'text-white'],
        ['Ekuitas', formatUsd(account.equity), Number.isFinite(equity) && equity >= balance ? 'text-qi-green' : 'text-qi-red'],
        ['Margin terpakai', formatUsd(account.margin_used), 'text-slate-300'],
        ['Posisi terbuka', account.open_positions == null ? '—' : String(Number(account.open_positions)), 'text-slate-300'],
    ];
    box.innerHTML = tiles.map(([label, value, color]) =>
        '<div class="rounded-lg border border-qi-border bg-black/20 px-2 py-2">'
        + `<div class="text-[9px] font-semibold uppercase tracking-wider text-slate-500">${label}</div>`
        + `<div class="mt-0.5 text-[13px] font-bold ${color}">${value}</div>`
        + '</div>'
    ).join('')
        + '<div class="col-span-2 text-[9px] text-slate-500 sm:col-span-4">'
        + `Dilaporkan EA read-only ${clean(account.provider)}${account.account_reference ? ' · akun ' + clean(account.account_reference) : ''}`
        + ` · snapshot ${describeWhen(account.captured_at || account.last_synced_at, serverNow) || 'belum ada'}</div>`;
    box.classList.remove('hidden');
}

// ── Posisi terbuka (dari snapshot EA read-only) ────────────────────────────
function formatPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return '—';
    const digits = Math.abs(number) >= 100 ? 2 : 5;
    return number.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPnl(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return (number >= 0 ? '+' : '-') + '$' + Math.abs(number).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function positionRow(position) {
    const clean = value => String(value == null ? '' : value).replace(/[<>&"']/g, '');
    const side = String(position.side || '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL';
    const profit = Number(position.profit);
    const pnlColor = Number.isFinite(profit) && profit >= 0 ? 'text-qi-green' : 'text-qi-red';
    return '<div class="flex flex-wrap items-center justify-between gap-2 rounded border border-qi-border bg-qi-bg px-2 py-2">'
        + '<div class="min-w-0 text-[10px] text-slate-300">'
        + `<span class="font-semibold text-white">${clean(position.symbol)}</span>`
        + ` · <span class="${side === 'BUY' ? 'text-qi-green' : 'text-qi-red'} font-semibold">${side}</span>`
        + ` · ${Number(position.volume || 0).toFixed(2)} lot`
        + (position.price_open == null ? '' : ` @ ${formatPrice(position.price_open)} → ${formatPrice(position.price_current)}`)
        + '</div>'
        + '<div class="flex items-center gap-3 text-[10px]">'
        + `<span class="text-slate-500">SL ${formatPrice(position.sl)} · TP ${formatPrice(position.tp)}</span>`
        + `<span class="${pnlColor} font-semibold">${formatPnl(position.profit)}</span>`
        + '</div></div>';
}

async function loadOpenPositions() {
    const hint = document.getElementById('openPositionsHint');
    const own = document.getElementById('ownPositionsList');
    const communityWrap = document.getElementById('communityPositionsWrap');
    const communityList = document.getElementById('communityPositionsList');
    const communityCount = document.getElementById('communityPositionsCount');
    const clean = value => String(value == null ? '' : value).replace(/[<>&"']/g, '');
    try {
        const headers = window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders() : {};
        const response = await fetch('api/positions-feed.php', { headers });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'POSITIONS_UNAVAILABLE');

        const mine = Array.isArray(data.mine) ? data.mine : [];
        const totalPositions = mine.reduce((sum, account) => sum + ((account.positions || []).length), 0);
        if (own) {
            const blocks = [];
            mine.forEach(account => {
                const rows = (account.positions || []).map(positionRow);
                blocks.push(`<div class="text-[9px] font-semibold uppercase tracking-wider text-slate-500">${clean(account.provider)} · ${clean(account.account_label)}${account.account_reference ? ' · ' + clean(account.account_reference) : ''}</div>`);
                blocks.push(rows.length ? rows.join('') : '<div class="rounded border border-qi-border bg-qi-bg px-2 py-2 text-[10px] text-slate-500">Tidak ada posisi terbuka.</div>');
            });
            own.innerHTML = blocks.join('');
        }
        if (hint) {
            hint.textContent = mine.length === 0
                ? 'Belum ada data posisi. Pastikan EA read-only versi terbaru berjalan di terminal.'
                : (totalPositions ? `${totalPositions} posisi terbuka dilaporkan terminal MT5.` : 'Terminal terhubung, tidak ada posisi terbuka saat ini.');
        }

        if (communityWrap) communityWrap.classList.toggle('hidden', !data.can_see_others);
        const community = Array.isArray(data.community) ? data.community : [];
        if (communityCount) communityCount.textContent = community.length ? `${community.length} akun` : '';
        if (communityList && data.can_see_others) {
            communityList.innerHTML = community.length ? community.map(account =>
                '<div class="rounded border border-qi-border bg-qi-bg px-2 py-2">'
                + `<div class="text-[10px] text-slate-400"><span class="font-semibold text-white">${clean(account.owner)}</span>`
                + ` · ${clean(account.provider)} · ${clean(account.account_label)} · ${describeWhen(account.captured_at, data.server_now) || ''}</div>`
                + `<div class="mt-1 space-y-1">${(account.positions || []).map(positionRow).join('')}</div>`
                + '</div>'
            ).join('') : '<div class="text-[10px] text-slate-500">Belum ada pengguna lain yang membuka posisi.</div>';
        }
    } catch (error) {
        if (hint) hint.textContent = 'Daftar posisi belum tersedia untuk akun ini.';
        if (own) own.innerHTML = '';
    }
}

async function setPositionSharing(accountId, share) {
    try {
        const response = await fetch('api/account-connection.php', {
            method: 'POST',
            headers: liveHeaders(),
            body: JSON.stringify({ action: 'share', account_id: Number(accountId), share: share ? 1 : 0 }),
        });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'SHARE_FAILED');
        showQuantumToast(data.message || 'Pengaturan berbagi disimpan.', 'success');
        await loadAccountAnalytics();
        await loadOpenPositions();
    } catch (error) {
        showQuantumToast(error.message || 'Pengaturan berbagi gagal disimpan.', 'error');
    }
}

// ── Riwayat saldo & ekuitas dari snapshot bridge ───────────────────────────
let _balanceRange = '24h';
let _balanceSeries = [];
let _balanceResizeBound = false;

function setBalanceRange(range) {
    _balanceRange = range === '7d' ? '7d' : '24h';
    const active = 'rounded-lg border px-3 py-2 text-[10px] font-semibold border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan';
    const idle = 'rounded-lg border px-3 py-2 text-[10px] font-semibold border-qi-border text-slate-300 hover:text-qi-cyan';
    const b24 = document.getElementById('balanceRange24');
    const b7 = document.getElementById('balanceRange7d');
    if (b24) b24.className = _balanceRange === '24h' ? active : idle;
    if (b7) b7.className = _balanceRange === '7d' ? active : idle;
    loadBalanceHistory();
}

async function loadBalanceHistory() {
    const summary = document.getElementById('balanceHistorySummary');
    const empty = document.getElementById('balanceHistoryEmpty');
    const rangeLabel = document.getElementById('balanceHistoryRange');
    try {
        const headers = window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders() : {};
        const response = await fetch('api/balance-history.php?range=' + _balanceRange, { headers });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'BALANCE_HISTORY_UNAVAILABLE');
        _balanceSeries = Array.isArray(data.series) ? data.series : [];
        const s = data.summary || {};
        if (rangeLabel) rangeLabel.textContent = _balanceSeries.length ? `${s.points} titik · ${data.range === '7d' ? 'per jam' : 'per 5 menit'}` : '';
        if (summary) {
            if (!_balanceSeries.length) {
                summary.textContent = 'Belum ada snapshot tersimpan untuk akun ini.';
            } else {
                const chg = Number(s.balance_change);
                const chgTxt = Number.isFinite(chg)
                    ? `${chg >= 0 ? '+' : '-'}$${Math.abs(chg).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—';
                summary.textContent = `Saldo ${formatUsd(s.balance_last)} · ekuitas ${formatUsd(s.equity_last)} · perubahan ${chgTxt} dalam ${data.range === '7d' ? '7 hari' : '24 jam'} terakhir.`;
            }
        }
        if (empty) empty.classList.toggle('hidden', _balanceSeries.length > 0);
        drawBalanceHistory();
    } catch (error) {
        if (summary) summary.textContent = 'Riwayat saldo belum tersedia untuk akun ini.';
        _balanceSeries = [];
        drawBalanceHistory();
    }
}

// Menggambar sendiri di canvas (tanpa pustaka tambahan) supaya tidak menambah
// dependensi. Semua kegagalan di sini diabaikan: grafik opsional tidak boleh
// mengganggu panel lain.
function drawBalanceHistory() {
    const canvas = document.getElementById('balanceHistoryCanvas');
    if (!canvas) return;
    try {
        const wrap = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(200, wrap ? wrap.clientWidth : 600);
        const h = Math.max(120, wrap ? wrap.clientHeight : 190);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!_balanceSeries.length) return;

        const padL = 10, padR = 10, padT = 12, padB = 14;
        const innerW = w - padL - padR, innerH = h - padT - padB;
        const values = [];
        _balanceSeries.forEach(p => { values.push(Number(p.balance)); values.push(Number(p.equity)); });
        let min = Math.min.apply(null, values), max = Math.max.apply(null, values);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return;
        if (max - min < 1e-9) { max += 1; min -= 1; }
        const spread = (max - min) * 0.08; min -= spread; max += spread;
        const n = _balanceSeries.length;
        const xOf = i => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
        const yOf = v => padT + innerH - ((v - min) / (max - min)) * innerH;

        ctx.strokeStyle = 'rgba(148,163,184,0.18)';
        ctx.fillStyle = 'rgba(148,163,184,0.8)';
        ctx.lineWidth = 1;
        ctx.font = '9px ui-monospace, monospace';
        for (let g = 0; g <= 3; g++) {
            const value = min + ((max - min) * g) / 3;
            const yy = yOf(value);
            ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
            ctx.fillText('$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 }), padL + 2, yy - 2);
        }
        const drawLine = (key, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            let started = false;
            _balanceSeries.forEach((p, i) => {
                const v = Number(p[key]);
                if (!Number.isFinite(v)) return;
                if (!started) { ctx.moveTo(xOf(i), yOf(v)); started = true; } else { ctx.lineTo(xOf(i), yOf(v)); }
            });
            ctx.stroke();
        };
        drawLine('balance', '#22d3ee');
        drawLine('equity', '#a78bfa');
    } catch (error) { /* grafik opsional */ }
}

// Daftar semua akun bridge + tombol cabut. Tanpa ini, akun yang salah platform
// (misalnya MT4 padahal terminalnya MT5) tidak bisa dibersihkan dari dashboard.
let _bridgeAccounts = [];

function bridgeStatusText(status) {
    if (status === 'active') return ['TERHUBUNG', 'text-qi-green'];
    if (status === 'revoked') return ['DICABUT', 'text-slate-500'];
    if (status === 'pending') return ['menunggu snapshot', 'text-amber-300'];
    return [String(status || '-'), 'text-slate-400'];
}

function renderBridgeAccounts(accounts, serverNow) {
    const box = document.getElementById('bridgeAccountList');
    const rows = document.getElementById('bridgeAccountRows');
    if (!box || !rows) return;
    _bridgeAccounts = Array.isArray(accounts) ? accounts : [];
    if (!_bridgeAccounts.length) { box.classList.add('hidden'); rows.innerHTML = ''; return; }
    box.classList.remove('hidden');
    rows.innerHTML = _bridgeAccounts.map(a => {
        const [statusText, statusColor] = bridgeStatusText(a.connection_status);
        const clean = value => String(value == null ? '' : value).replace(/[<>&"']/g, '');
        const parts = [
            `<span class="font-semibold text-white">${clean(a.provider) || 'Akun'}</span>`,
            clean(a.account_reference) || null,
            clean(a.account_label) || null,
            `<span class="${statusColor}">${statusText}</span>`,
            a.bridge_key_created_at ? `key ${describeWhen(a.bridge_key_created_at, serverNow) || 'baru'}` : null,
            a.last_synced_at ? `snapshot ${describeWhen(a.last_synced_at, serverNow) || '-'}` : 'belum ada snapshot',
            a.balance == null ? null : `saldo ${formatUsd(a.balance)}`,
        ].filter(Boolean);
        const shareOn = Number(a.share_positions) === 1;
        const button = a.connection_status === 'revoked' ? ''
            : '<div class="flex items-center gap-1">'
              + `<button type="button" onclick="setPositionSharing(${Number(a.id)}, ${shareOn ? 0 : 1})" title="Izinkan pengguna PRO/VIP lain melihat posisi akun ini" class="rounded border ${shareOn ? 'border-qi-green/40 text-qi-green' : 'border-qi-border text-slate-400'} px-2 py-1 text-[9px] font-semibold hover:bg-white/5">Berbagi: ${shareOn ? 'YA' : 'tidak'}</button>`
              + `<button type="button" onclick="revokeBridgeAccount(${Number(a.id)})" class="rounded border border-qi-red/40 px-2 py-1 text-[9px] font-semibold text-qi-red hover:bg-qi-red/10">Cabut</button>`
              + '</div>';
        return '<div class="flex flex-col gap-1 rounded border border-qi-border bg-qi-bg px-2 py-2 sm:flex-row sm:items-center sm:justify-between">'
            + `<div class="min-w-0 text-[10px] text-slate-300">${parts.join(' · ')}</div>`
            + `<div class="shrink-0">${button}</div>`
            + '</div>';
    }).join('');
}

async function revokeBridgeAccount(accountId) {
    const account = _bridgeAccounts.find(a => Number(a.id) === Number(accountId));
    const label = account ? `${account.provider} ${account.account_reference || ''}`.trim() : 'akun ini';
    if (!window.confirm(`Cabut koneksi ${label}? EA untuk akun ini berhenti mengirim data dan Bridge Key-nya tidak berlaku lagi.`)) return;
    try {
        const response = await fetch('api/account-connection.php', { method: 'POST', headers: liveHeaders(), body: JSON.stringify({ action: 'revoke', account_id: Number(accountId) }) });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'REVOKE_FAILED');
        showQuantumToast(data.message || 'Bridge dicabut.', 'success');
        await loadAccountAnalytics();
    } catch (error) {
        showQuantumToast(error.message || 'Bridge tidak dapat dicabut.', 'error');
    }
}

function renderPaperPerformance(data) {
    const performance = document.getElementById('accountPerformanceSummary');
    if (!performance) return;
    const p = data.paper_performance || {};
    const closed = Number(p.closed_trades || 0);
    const rate = p.win_rate_pct == null ? '—' : `${p.win_rate_pct}%`;
    const net = Number(p.net_pnl_usd || 0);
    performance.textContent = `${closed} trade paper selesai · win rate ${rate} · P/L ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}. Data ini hanya simulasi.`;
}

async function fetchAccountAnalytics() {
    const headers = window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders() : {};
    const response = await fetch('api/account-analytics.php', { headers });
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.code || 'ACCOUNT_ANALYTICS_UNAVAILABLE');
    return data;
}

async function loadAccountAnalytics() {
    const title = document.getElementById('accountConnectionTitle');
    const badge = document.getElementById('accountConnectionStatus');
    const summary = document.getElementById('accountConnectionSummary');
    const performance = document.getElementById('accountPerformanceSummary');
    try {
        const data = await fetchAccountAnalytics();
        renderAccountConnection(data);
        renderPaperPerformance(data);
        applyRiskProfile(data.risk_profile);
    } catch (error) {
        if (title) title.textContent = 'Analitik belum tersedia';
        if (badge) { badge.textContent = 'PERLU SETUP'; badge.className = 'rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-[9px] font-semibold text-slate-300'; }
        if (summary) summary.textContent = 'Jalankan migrasi database dan masuk kembali untuk mengaktifkan analitik akun pribadi.';
        if (performance) performance.textContent = 'Statistik akan tersedia setelah sesi dan database siap.';
        setRiskProfileState('Masuk untuk mengatur guardrail', 'text-slate-500');
    }
}

// Polling ringan: hanya memperbarui kartu akun, tidak menyentuh form guardrail
// yang mungkin sedang diisi, supaya status TERHUBUNG muncul tanpa perlu refresh.
async function refreshAccountConnection() {
    try {
        const data = await fetchAccountAnalytics();
        renderAccountConnection(data);
        renderPaperPerformance(data);
    } catch (error) { /* biarkan kartu menampilkan status terakhir */ }
}

function startAccountRefresh() {
    fillBridgeEndpoint();
    loadOpenPositions();
    loadBalanceHistory();
    if (!_balanceResizeBound) {
        _balanceResizeBound = true;
        window.addEventListener('resize', () => { if (_activePanel === 'panel-account') drawBalanceHistory(); });
    }
    if (_accountRefreshTimer) return;
    _accountRefreshTimer = setInterval(() => {
        if (_activePanel === 'panel-account' && document.visibilityState === 'visible') {
            refreshAccountConnection();
            loadOpenPositions();
            loadBalanceHistory();
        }
    }, 60000);
}

function setRiskProfileState(message, className = 'text-slate-500') {
    const state = document.getElementById('riskProfileState');
    if (!state) return;
    state.textContent = message;
    state.className = `text-[10px] font-semibold ${className}`;
}

function applyRiskProfile(profile) {
    if (!profile) return;
    const risk = document.getElementById('riskPerTradePct');
    const daily = document.getElementById('maxDailyLossPct');
    const open = document.getElementById('maxOpenPositions');
    if (risk) risk.value = Number(profile.risk_per_trade_pct ?? 1).toFixed(2);
    if (daily) daily.value = Number(profile.max_daily_loss_pct ?? 3).toFixed(2);
    if (open) open.value = Math.round(Number(profile.max_open_positions ?? 3));
    setRiskProfileState(profile.updated_at ? `Diperbarui ${new Date(profile.updated_at).toLocaleString('id-ID')}` : 'Belum disimpan', 'text-slate-500');
}

async function saveRiskProfile(event) {
    event.preventDefault();
    const button = document.getElementById('saveRiskProfileBtn');
    const payload = {
        risk_per_trade_pct: Number(document.getElementById('riskPerTradePct')?.value),
        max_daily_loss_pct: Number(document.getElementById('maxDailyLossPct')?.value),
        max_open_positions: Number(document.getElementById('maxOpenPositions')?.value),
    };
    if (!Number.isFinite(payload.risk_per_trade_pct) || !Number.isFinite(payload.max_daily_loss_pct) || !Number.isInteger(payload.max_open_positions)) {
        showQuantumToast('Periksa kembali nilai guardrail risiko.', 'warning');
        return;
    }
    if (button) { button.disabled = true; button.textContent = 'Menyimpan…'; }
    try {
        const headers = window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
        const response = await fetch('api/risk-profile.php', { method: 'POST', headers, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'SAVE_FAILED');
        setRiskProfileState('Guardrail tersimpan', 'text-qi-green');
        showQuantumToast('Guardrail risiko berhasil disimpan.', 'success');
        loadAccountAnalytics();
    } catch (error) {
        setRiskProfileState('Gagal menyimpan', 'text-qi-red');
        showQuantumToast('Guardrail risiko tidak dapat disimpan. Coba lagi.', 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = 'Simpan Guardrail'; }
    }
}

function toggleBridgeSetup() {
    const panel = document.getElementById('bridgeSetup');
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) { fillBridgeEndpoint(); loadLiveExecution(); }
    }
}

function liveHeaders() { return window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' }; }
async function loadLiveExecution() {
    const select = document.getElementById('liveAccountId'), state = document.getElementById('liveExecutionState');
    try {
        const res = await fetch('api/live-trade.php', { headers: window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders() : {} });
        const data = await res.json(); if (!res.ok || data.status !== 'success') throw new Error('LOAD_FAILED');
        const accounts = Array.isArray(data.accounts) ? data.accounts : [];
        if (select) select.innerHTML = accounts.length ? accounts.map(a => `<option value="${Number(a.id)}">${String(a.account_label || 'MT5').replace(/[<>&"]/g, '')} · ${a.connection_status}</option>`).join('') : '<option value="">Belum ada akun MT5</option>';
        const current = accounts[0];
        if (state) state.textContent = current ? (Number(current.enabled) ? 'EKSEKUSI REAL AKTIF — pantau terminal dan log order.' : 'Eksekusi nonaktif. Guardrail tetap berlaku saat diaktifkan.') : 'Hubungkan MT5 read-only terlebih dahulu.';
    } catch (error) { if (state) state.textContent = 'Status eksekusi belum tersedia.'; }
}
async function liveAction(payload) {
    const accountId = Number(document.getElementById('liveAccountId')?.value);
    if (!Number.isInteger(accountId) || accountId < 1) { showQuantumToast('Pilih akun MT5 yang sudah terhubung.', 'warning'); return null; }
    const res = await fetch('api/live-trade.php', { method: 'POST', headers: liveHeaders(), body: JSON.stringify({ ...payload, account_id: accountId }) });
    const data = await res.json(); if (!res.ok || data.status !== 'success') throw new Error(data.message || 'LIVE_ACTION_FAILED'); return data;
}
async function saveLiveGuardrails() {
    const symbols = (document.getElementById('liveSymbols')?.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    // Batas risiko kini bisa diatur pelanggan (sebelumnya dipaku 50% rugi harian dan 10
    // posisi — setting paling longgar). Bawaannya kini lebih ketat: 5% dan 3 posisi.
    // Lot tetap 0,01 karena itu batas keras server.
    const daily = Number(document.getElementById('liveDailyLoss')?.value || 5);
    const maxPos = Number(document.getElementById('liveMaxPositions')?.value || 3);
    // Pemetaan simbol broker: teks "XAUUSD=XAUUSD.pro" per baris → objek.
    const peta = teksKePetaSimbol(document.getElementById('liveSymbolMap')?.value || '');
    try { const data = await liveAction({ action: 'configure', max_lot: 0.01, max_daily_loss_pct: daily, max_open_positions: maxPos, allowed_symbols: symbols, symbol_map: peta }); showQuantumToast(data.message, 'success'); loadLiveExecution(); muatStatusEksekusi(); }
    catch (error) { showQuantumToast(error.message || 'Guardrail eksekusi tidak tersimpan.', 'error'); }
}

/**
 * Teks pemetaan simbol ↔ objek. Format: "SINYAL=Broker" per baris (koma juga boleh).
 * Nilai kosong ("XAUUSD=") berarti simbol itu SENGAJA tidak dieksekusi di akun ini.
 * Fungsi murni supaya bisa diuji tanpa peramban.
 */
function teksKePetaSimbol(teks) {
    const peta = {};
    String(teks || '').split(/[\n,;]+/).forEach(baris => {
        const t = baris.trim();
        if (!t) return;
        const pisah = t.indexOf('=');
        const dari = (pisah === -1 ? t : t.slice(0, pisah)).trim().toUpperCase();
        const ke = pisah === -1 ? '' : t.slice(pisah + 1).trim();
        if (!/^[A-Z0-9._\/-]{3,32}$/.test(dari)) return;
        if (ke !== '' && !/^[A-Za-z0-9._-]{1,32}$/.test(ke)) return;
        peta[dari] = ke;
    });
    return peta;
}
function petaKeTeksSimbol(peta) {
    try {
        const o = peta && typeof peta === 'object' ? peta : {};
        return Object.keys(o).map(k => k + '=' + (o[k] == null ? '' : o[k])).join('\n');
    } catch (e) { return ''; }
}
window.teksKePetaSimbol = teksKePetaSimbol;
window.petaKeTeksSimbol = petaKeTeksSimbol;

/**
 * Tampilkan kesegaran EA + daftar perintah terakhir. Ini yang menjawab pertanyaan
 * "EA saya hidup atau tidak?" tanpa harus bertanya ke dukungan.
 */
async function muatStatusEksekusi() {
    const kotak = document.getElementById('liveExecStatus');
    const daftar = document.getElementById('liveExecOrders');
    const accountId = Number(document.getElementById('liveAccountId')?.value);
    if (!Number.isInteger(accountId) || accountId < 1) {
        if (kotak) kotak.textContent = 'Pilih akun MT5 yang sudah terhubung lebih dulu.';
        return;
    }
    if (kotak) kotak.textContent = 'Memuat status eksekusi…';
    try {
        const res = await fetch('api/live-trade.php', {
            method: 'POST',
            headers: liveHeaders(),
            body: JSON.stringify({ action: 'status', account_id: accountId })
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') throw new Error(data.message || 'STATUS_FAIL');
        const p = data.data?.profil || null;
        const ea = data.data?.ea || null;
        const harian = data.data?.status_harian || null;
        const perintah = Array.isArray(data.data?.perintah) ? data.data.perintah : [];

        // Pemetaan & batas yang tersimpan ditampilkan kembali agar pelanggan tahu
        // keadaan sebenarnya (bukan hanya yang dia ketik).
        if (p) {
            const mapEl = document.getElementById('liveSymbolMap');
            if (mapEl && !mapEl.value.trim() && p.symbol_map) mapEl.value = petaKeTeksSimbol(p.symbol_map);
            const dl = document.getElementById('liveDailyLoss');
            const mp = document.getElementById('liveMaxPositions');
            if (dl && p.max_daily_loss_pct) dl.value = p.max_daily_loss_pct;
            if (mp && p.max_open_positions) mp.value = p.max_open_positions;
        }

        if (kotak) {
            const umur = ea && Number.isFinite(ea.umur_detik) ? ea.umur_detik : null;
            const teksEa = ea
                ? (ea.hidup ? `🟢 EA hidup (terakhir melapor ${umur} dtk lalu)` : `🔴 EA tidak melapor ${umur === null ? '—' : umur + ' dtk'} — periksa terminal/AutoTrading`)
                : '⚪ EA belum pernah melapor — pasang EA & nyalakan AutoTrading';
            const status = p ? (Number(p.enabled) ? 'EKSEKUSI AKTIF' : (Number(p.emergency_stop) ? 'STOP DARURAT' : 'nonaktif')) : 'belum dikonfigurasi';
            const batas = p ? `lot maks ${Number(p.max_lot).toFixed(2)} · rugi harian maks ${Number(p.max_daily_loss_pct).toFixed(1)}% · maks ${p.max_open_positions} posisi` : '';
            const hari = harian ? ` · ekuitas terakhir ${Number(harian.ekuitas_terakhir).toLocaleString('en-US', { minimumFractionDigits: 2 })} · ${harian.posisi_terbuka} posisi terbuka` : '';
            kotak.innerHTML = `<div class="text-[10px] leading-relaxed text-slate-300">${teksEa}</div>`
                + `<div class="mt-1 text-[10px] text-slate-500">Status: <span class="font-semibold ${Number(p?.enabled) ? 'text-emerald-300' : 'text-slate-400'}">${status}</span>${batas ? ' · ' + batas : ''}${hari}</div>`;
        }
        if (daftar) {
            if (!perintah.length) {
                daftar.innerHTML = '<div class="text-[10px] text-slate-500">Belum ada perintah. Perintah muncul saat sinyal AKTIF diterbitkan dan akun ini memenuhi semua syarat.</div>';
            } else {
                const warna = { executed: 'text-emerald-300', rejected: 'text-red-300', queued: 'text-amber-300', dispatched: 'text-cyan-300', cancelled: 'text-slate-400', expired: 'text-slate-500' };
                daftar.innerHTML = `<div class="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Perintah terakhir</div>` + perintah.map(o => {
                    const w = warna[o.status] || 'text-slate-400';
                    const tiket = o.broker_order_ticket ? ` · tiket ${o.broker_order_ticket}` : '';
                    const pesan = o.broker_message ? ` · ${String(o.broker_message).slice(0, 60)}` : '';
                    return `<div class="rounded border border-qi-border/60 bg-black/20 px-2 py-1 text-[10px]"><span class="font-mono text-slate-300">${String(o.symbol)}</span> <span class="${o.side === 'BUY' ? 'text-emerald-300' : 'text-red-300'}">${o.side}</span> <span class="text-slate-500">${Number(o.volume).toFixed(2)} lot</span> · <span class="${w}">${o.status}</span><span class="text-slate-500">${tiket}${pesan}</span><div class="text-[9px] text-slate-600">${String(o.created_at || '')}${o.signal_id ? ' · sinyal ' + String(o.signal_id).slice(-12) : ''}</div></div>`;
                }).join('');
            }
        }
    } catch (error) {
        if (kotak) kotak.textContent = 'Status eksekusi belum dapat dibaca. ' + (error.message || '');
    }
}
window.muatStatusEksekusi = muatStatusEksekusi;

async function setLiveExecution(enabled) {
    try { const data = await liveAction({ action: 'set_enabled', enabled, confirm_text: document.getElementById('liveConfirmText')?.value || '' }); showQuantumToast(data.message, enabled ? 'warning' : 'success'); loadLiveExecution(); }
    catch (error) { showQuantumToast(error.message || 'Status eksekusi tidak diubah.', 'error'); }
}
async function emergencyStopLive() {
    try { const data = await liveAction({ action: 'emergency_stop' }); showQuantumToast(data.message, 'warning'); loadLiveExecution(); }
    catch (error) { showQuantumToast(error.message || 'Tombol darurat gagal diproses.', 'error'); }
}

async function provisionBridge(event) {
    event.preventDefault();
    const button = document.getElementById('bridgeProvisionBtn');
    const payload = {
        action: 'provision',
        provider: document.getElementById('bridgeProvider')?.value,
        account_label: document.getElementById('bridgeAccountLabel')?.value.trim(),
        account_reference: document.getElementById('bridgeAccountReference')?.value.trim(),
    };
    if (!payload.provider || !payload.account_label || !payload.account_reference) {
        showQuantumToast('Lengkapi platform, nama, dan nomor akun.', 'warning');
        return;
    }
    if (button) { button.disabled = true; button.textContent = 'Membuat key…'; }
    try {
        const headers = window.QuantumAuth?.authHeaders ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
        const response = await fetch('api/account-connection.php', { method: 'POST', headers, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok || data.status !== 'success' || !data.data?.bridge_key) throw new Error(data.message || 'PROVISION_FAILED');
        const value = document.getElementById('bridgeKeyValue');
        const result = document.getElementById('bridgeKeyResult');
        if (value) value.textContent = data.data.bridge_key;
        if (result) result.classList.remove('hidden');
        showQuantumToast('Bridge Key dibuat. Salin dan simpan sekarang.', 'success');
        loadAccountAnalytics();
    } catch (error) {
        showQuantumToast('Bridge Key tidak dapat dibuat. Periksa detail akun lalu coba lagi.', 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = 'Buat Bridge Key'; }
    }
}

async function copyBridgeKey() {
    const key = (document.getElementById('bridgeKeyValue')?.textContent || '').trim();
    if (!key) return;
    const ok = await copyTextRobust(key, selectBridgeKey);
    showQuantumToast(ok
        ? 'Bridge Key disalin. Simpan di tempat aman.'
        : 'Penyalinan otomatis gagal — teksnya sudah diseleksi, tekan Ctrl+C (atau tekan lama → Copy).', ok ? 'success' : 'warning');
}

function initPanel(id) {
    if (id === 'panel-account')     { loadAccountAnalytics(); startAccountRefresh(); if (typeof muatTelegramStatus === 'function') muatTelegramStatus(); }
    if (id === 'panel-charts')      initTvChart();
    if (id === 'panel-signal')      fetchSignalMatrix();
    if (id === 'panel-outlook')     fetchOutlook();
    if (id === 'panel-heatmap')     initHeatmapPanel();
    if (id === 'panel-orderbook')   fetchAllOrderBooks();
    if (id === 'panel-news')        fetchDashNews();
    if (id === 'panel-strength')    fetchStrengthFull();
    if (id === 'panel-radar')       { runRadarScan(); renderRadarQuickScan(); }
    if (id === 'panel-paper')       { ptLoadFromServer(); initPtMiniChart(); }
    if (id === 'panel-ai')          { /* AI panel ready on demand */ }
    if (id === 'panel-track')       fetchTrackRecord();
    if (id === 'panel-track')       { if (typeof muatMetode === 'function') muatMetode(); }
    if (id === 'panel-correlation') fetchCorrelation();
    // panel-screener: SEBELUMNYA satu-satunya panel yang isinya hanya muncul bila
    // pengguna menekan "Scan Ulang" — artinya tampak kosong sampai diklik manual.
    // Sekarang diisi otomatis saat panel dibuka (sama seperti panel lain), tanpa
    // menambah polling berkala sehingga tidak ada beban kuota tambahan.
    if (id === 'panel-screener')    { if (typeof runScreener === 'function') runScreener(); }
    if (id === 'panel-cot')         fetchCot();
    if (id === 'panel-impact')      fetchNewsImpact();
    if (id === 'panel-autosignal')  { refreshAutoSignals(); if (typeof _asMuatServer === 'function') _asMuatServer().then(function () { if (typeof _asRenderRecords === 'function') _asRenderRecords(); }); }
    if (id === 'panel-rencana')     { if (typeof setRencanaMode === 'function') setRencanaMode(_rlMode); }
    if (id === 'panel-gateway')     { if (typeof muatGateway === 'function') muatGateway(); }
    if (id === 'panel-sessions')    initNetworkGalaxy();
    if (id === 'panel-crypto')      initCryptoTerminal();
    if (id === 'panel-academy')     initAcademyPanel();
    if (id === 'panel-community')   { if (typeof renderChat === 'function') renderChat(); }
    if (typeof initProPanel === 'function') initProPanel(id);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PENYEGAR OTOMATIS TERPUSAT — semua panel memperbarui diri, tanpa refresh/scan manual
   ═══════════════════════════════════════════════════════════════════════════
   Prinsip yang dipegang:
     · HANYA panel yang SEDANG DILIHAT yang disegarkan — bukan semua panel sekaligus —
       supaya tampilan selalu baru tanpa membanjiri server & kuota sumber data.
     · Fungsi INIT (chart, heatmap, galaxy, terminal kripto, mini chart) SENGAJA tidak
       diikutkan: memanggilnya ulang akan membuat timer/chart GANDA.
     · Berhenti saat tab tidak terlihat (document.hidden) untuk menghemat baterai/kuota.
     · Tidak menumpuk: bila penyegaran sebelumnya belum selesai, siklus berikut dilewati.
   Daftar di bawah memakai REFERENSI FUNGSI langsung (bukan nama teks) supaya tetap
   bekerja walau fungsi berada di dalam lingkup modul, dan setiap panggilan dibungkus
   try/catch agar satu kegagalan tidak menghentikan penyegaran panel lain.
   ═══════════════════════════════════════════════════════════════════════════ */
const QI_SEGAR_MS = 12000;          // agresif: 12 detik (permintaan pengguna)
const QI_PANEL_SEGAR = {
    'panel-overview':    [() => fetchMarketData()],
    'panel-account':     [() => loadOpenPositions(), () => loadBalanceHistory(), () => loadAccountAnalytics()],
    'panel-signal':      [() => fetchSignalMatrix()],
    'panel-outlook':     [() => fetchOutlook()],
    'panel-orderbook':   [() => fetchAllOrderBooks()],
    'panel-news':        [() => fetchDashNews()],
    'panel-strength':    [() => fetchStrengthFull()],
    'panel-radar':       [() => renderRadarQuickScan()],
    'panel-paper':       [() => ptLoadFromServer()],
    'panel-track':       [() => fetchTrackRecord()],
    'panel-correlation': [() => fetchCorrelation()],
    'panel-cot':         [() => fetchCot()],
    'panel-impact':      [() => fetchNewsImpact()],
    'panel-autosignal':  [() => refreshAutoSignals()],
    'panel-screener':    [() => runScreener()],
    'panel-volatility':  [() => renderVolatilityDash()],
    'panel-sentiment':   [() => renderSentimentGauge()],
    'panel-heatmap':     [() => fetchCalendarHeatmap()],
    'panel-community':   [() => { if (typeof renderChat === 'function') renderChat(); }],
    'panel-mtf':         [() => fetchMtfBias((document.getElementById('mtfPairSelect') || {}).value || 'XAUUSD')],
};
let _qiSegarJalan = false;
function qiSegarkanPanelAktif() {
    try {
        if (document.visibilityState !== 'visible') return;
        if (_qiSegarJalan) return;
        const id = (typeof _activePanel !== 'undefined' && _activePanel) ? _activePanel : null;
        if (!id || !QI_PANEL_SEGAR[id]) return;
        _qiSegarJalan = true;
        QI_PANEL_SEGAR[id].forEach(fn => { try { if (typeof fn === 'function') fn(); } catch (e) {} });
    } catch (e) {
        // Penyegaran tidak boleh pernah merusak halaman.
    } finally {
        setTimeout(() => { _qiSegarJalan = false; }, 2500);
    }
}
window.qiSegarkanPanelAktif = qiSegarkanPanelAktif;
setInterval(qiSegarkanPanelAktif, QI_SEGAR_MS);
// Saat pengguna kembali ke tab, segera segarkan panel yang sedang dibuka.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(qiSegarkanPanelAktif, 400);
});

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFIKASI TELEGRAM (khusus admin)
   ═══════════════════════════════════════════════════════════════════════════
   Kartu pengaturan hanya dimunculkan bila server mengizinkan (admin). Untuk
   non-admin endpoint mengembalikan 403 dan kartu tetap tersembunyi — jadi tidak
   ada janji palsu di UI. Status selalu ditampilkan apa adanya dari server.
   ═══════════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   RENCANA LIVE (Intraday · Swing) — seluruh angkanya dari TradingView
   ═══════════════════════════════════════════════════════════════════════════
   · Server (api/rencana-live.php) yang mengambil angka TradingView & menghitung
     level; panel ini hanya menampilkan apa adanya + menyebut pembatasnya.
   · Menyegar sendiri setiap 60 detik HANYA saat panel ini terbuka (server juga
     menyimpan cache 60 detik, jadi permintaan tidak menumpuk).
   · Rencana TIDAK dicatat sebagai sinyal — statistik tetap bersih.
   ═══════════════════════════════════════════════════════════════════════════ */
let _rlMode = 'intraday';
let _rlTimer = null;
let _rlSedangMuat = false;

function rlEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function rlAngka(v) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '—';
    const n = Number(v);
    const abs = Math.abs(n);
    const dp = abs >= 1000 ? 2 : (abs >= 100 ? 2 : (abs >= 1 ? 4 : 5));
    return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function setRencanaMode(mode) {
    if (mode === 'scalping') return;                 // sengaja belum aktif (menunggu EA)
    if (mode !== 'intraday' && mode !== 'swing') return;
    _rlMode = mode;
    const aktif = 'px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-qi-cyan/50 bg-qi-cyan/15 text-qi-cyan';
    const mati  = 'px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-qi-border text-slate-300 hover:text-white';
    const t1 = document.getElementById('rlTab-intraday');
    const t2 = document.getElementById('rlTab-swing');
    if (t1) t1.className = (mode === 'intraday') ? aktif : mati;
    if (t2) t2.className = (mode === 'swing')    ? aktif : mati;
    const judul = document.getElementById('rlJudul');
    if (judul) judul.textContent = (mode === 'swing') ? 'RENCANA SWING (H4 + BIAS HARIAN)' : 'RENCANA INTRADAY (H1)';
    muatRencana(true);
}

async function muatRencana(paksa) {
    const body = document.getElementById('rlBody');
    if (!body) return;
    if (_rlSedangMuat) return;
    _rlSedangMuat = true;
    try {
        if (paksa && !body.querySelector('tr td[colspan]')) { /* biarkan isi lama tampil saat menyegar */ }
        const res = await fetch('api/rencana-live.php?mode=' + encodeURIComponent(_rlMode), { cache: 'no-store' });
        const d = await res.json().catch(() => ({}));
        const upd = document.getElementById('rlDiperbarui');
        const cat = document.getElementById('rlCatatan');
        const ber = document.getElementById('rlBerlaku');

        if (!res.ok || d.status !== 'success') {
            body.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-amber-300">' + rlEsc(d.message || ('HTTP ' + res.status)) + '</td></tr>';
            if (upd) upd.textContent = 'gagal memuat';
            if (cat) cat.textContent = 'Rencana tidak dapat dimuat. Tidak ada angka pengganti yang ditampilkan.';
            return;
        }

        if (upd) upd.textContent = 'diperbarui ' + new Date().toLocaleTimeString('id-ID');
        if (ber) ber.textContent = 'berlaku sampai ' + new Date(d.berlaku_sampai).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        if (cat) {
            cat.innerHTML = '<b class="text-slate-300">Sumber:</b> ' + rlEsc(d.sumber?.harga || '') + ' · ' + rlEsc(d.sumber?.atr || '')
                + ' · ' + rlEsc(d.sumber?.level || '') + '<br><span class="text-slate-500">' + rlEsc(d.catatan || '') + '</span>';
        }

        const rows = d.plans || [];
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-slate-600">Belum ada instrumen untuk mode ini.</td></tr>';
            return;
        }

        body.innerHTML = rows.map(p => {
            if (p.status !== 'siap') {
                const put = p.putusan_tf ? (' · TV 15m ' + rlEsc(p.putusan_tf['15'] || '-') + ' · H1 ' + rlEsc(p.putusan_tf['60'] || '-') + ' · H4 ' + rlEsc(p.putusan_tf['240'] || '-') + ' · 1D ' + rlEsc(p.putusan_tf['1D'] || '-')) : '';
                return '<tr class="border-b border-qi-border/30">'
                    + '<td class="px-4 py-2 text-slate-200">' + rlEsc(p.simbol) + '</td>'
                    + '<td class="px-1.5 py-2 text-center text-amber-300" colspan="7">tunggu — ' + rlEsc(p.sebab || 'belum ada setup') + put + '</td>'
                    + '<td class="px-4 py-2 text-slate-500">' + rlEsc(p.tf ? ('ATR ' + p.tf + ' ' + rlAngka(p.atr)) : '') + '</td>'
                    + '</tr>';
            }
            const arahCls = (p.arah === 'BUY') ? 'text-qi-green' : 'text-qi-red';
            const catatan = [];
            // Alasan SL ditampilkan lebih dulu supaya pengguna tahu SL itu dari ATR atau dari
            // struktur TradingView (dan bila struktur terlalu jauh, alasannya ikut ditulis).
            catatan.push('SL → ' + (p.sl_acuan || 'ATR TradingView'));
            // Ringkas di panel: kalimat penuh tetap tersedia di API (transparansi), tetapi
            // sel tabel cukup menyebut sebabnya agar mudah dibaca.
            if (p.struktur_sl && p.struktur_sl.dipakai === false && p.struktur_sl.catatan) {
                catatan.push(/terlalu jauh/.test(p.struktur_sl.catatan)
                    ? 'Struktur TradingView terlalu jauh → SL pakai ATR'
                    : 'Struktur TradingView tidak dipakai → SL pakai ATR');
            }
            if (p.tp1_pembatas) catatan.push('TP1 → ' + p.tp1_pembatas);
            if (p.tp2_pembatas) catatan.push('TP2 → ' + p.tp2_pembatas);
            if (p.vwap) catatan.push('Harga ' + p.vwap.posisi + ' (' + p.vwap.nilai + ')');
            (p.peringatan || []).forEach(w => catatan.push('⚠ ' + w));
            const sebab = (p.alasan || []).join(' · ');
            return '<tr class="border-b border-qi-border/30 hover:bg-white/[.02]" title="' + rlEsc(sebab) + '">'
                + '<td class="px-4 py-2 text-slate-200">' + rlEsc(p.simbol) + ' <span class="text-slate-600 text-[9px]">' + rlEsc((p.ticker || '').split(':')[0]) + '</span></td>'
                + '<td class="px-1.5 py-2 text-center font-bold ' + arahCls + '">' + rlEsc(p.arah) + '</td>'
                + '<td class="px-1.5 py-2 text-right text-slate-100 tabular-nums">' + rlAngka(p.entry) + '</td>'
                + '<td class="px-1.5 py-2 text-right text-qi-red tabular-nums">' + rlAngka(p.sl) + '</td>'
                + '<td class="px-1.5 py-2 text-right text-qi-green tabular-nums">' + rlAngka(p.tp1) + '</td>'
                + '<td class="px-1.5 py-2 text-right text-qi-green tabular-nums">' + rlAngka(p.tp2) + '</td>'
                + '<td class="px-1.5 py-2 text-right text-slate-300">' + rlEsc(p.rr1) + ' / ' + rlEsc(p.rr2) + '</td>'
                + '<td class="px-1.5 py-2 text-right text-slate-500">' + rlAngka(p.atr) + '</td>'
                + '<td class="px-4 py-2 text-slate-500 leading-snug">' + rlEsc(catatan.join(' · ') || 'ATR TradingView') + '</td>'
                + '</tr>';
        }).join('');
    } catch (e) {
        const body2 = document.getElementById('rlBody');
        if (body2) body2.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-qi-red">Gagal menghubungi server: ' + rlEsc(e && e.message ? e.message : 'tidak diketahui') + '</td></tr>';
    } finally {
        _rlSedangMuat = false;
    }
}

// Penyegar 60 detik: hanya bekerja saat panel Rencana Live sedang terbuka.
if (!_rlTimer) {
    _rlTimer = setInterval(function () {
        try {
            if (typeof _activePanel !== 'undefined' && _activePanel === 'panel-rencana' && document.visibilityState === 'visible') {
                muatRencana(false);
            }
        } catch (e) {}
    }, 60000);
}
window.setRencanaMode = setRencanaMode;
window.muatRencana = muatRencana;

async function muatTelegramStatus() {
    const kartu = document.getElementById('tgKartu');
    if (!kartu) return;
    // Endpoint ini khusus admin: jangan memanggilnya untuk peran lain (hanya menghasilkan
    // galat 403 di konsol). Server tetap memeriksa peran sendiri.
    if (String(window.QI_PERAN || '').toLowerCase() !== 'admin') { kartu.classList.add('hidden'); return; }
    try {
        const res = await fetch('api/telegram-setelan.php', { cache: 'no-store' });
        if (!res.ok) { kartu.classList.add('hidden'); return; }   // bukan admin → sembunyikan
        const d = await res.json();
        kartu.classList.remove('hidden');
        const badge = document.getElementById('tgStatusBadge');
        const cat = document.getElementById('tgCatatan');
        const aktif = !!d.terkonfigurasi;
        if (badge) {
            badge.textContent = aktif ? 'AKTIF' : 'BELUM AKTIF';
            badge.className = 'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono '
                + (aktif ? 'border-qi-green/40 bg-qi-green/10 text-qi-green' : 'border-amber-400/40 bg-amber-400/10 text-amber-300');
        }
        if (cat) {
            const bagian = [d.catatan || ''];
            if (d.ada_token && d.token_ekor) bagian.push('Token tersimpan (berakhir ' + d.token_ekor + ') — demi keamanan tidak ditampilkan utuh.');
            if (d.sumber) bagian.push('Sumber pengaturan: ' + d.sumber + '.');
            cat.textContent = bagian.filter(Boolean).join(' ');
        }
        const inpChat = document.getElementById('tgChat');
        if (inpChat && !inpChat.value && d.chat_id_tersimpan) inpChat.value = d.chat_id_tersimpan;
    } catch (e) {
        if (kartu) kartu.classList.add('hidden');
    }
}

async function tgSimpan(uji) {
    const hasil = document.getElementById('tgHasil');
    const tokenEl = document.getElementById('tgToken');
    const chatEl = document.getElementById('tgChat');
    if (hasil) { hasil.textContent = 'menyimpan…'; hasil.className = 'text-[10px] font-mono text-slate-400'; }
    try {
        const badan = { aksi: uji ? 'uji' : 'simpan', chat_id: chatEl ? chatEl.value.trim() : '' };
        // Token hanya dikirim bila kolomnya diisi — supaya menyimpan chat id tidak
        // menghapus token yang sudah ada.
        if (tokenEl && tokenEl.value.trim() !== '') badan.token = tokenEl.value.trim();
        const res = await fetch('api/telegram-setelan.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(badan)
        });
        const d = await res.json().catch(() => ({}));
        if (tokenEl) tokenEl.value = '';
        if (uji && d.uji) {
            if (hasil) {
                hasil.textContent = d.uji.ok ? ('✓ ' + d.uji.pesan) : ('✗ ' + d.uji.pesan);
                hasil.className = 'text-[10px] font-mono ' + (d.uji.ok ? 'text-qi-green' : 'text-qi-red');
            }
        } else if (res.ok && d.status === 'success') {
            if (hasil) { hasil.textContent = '✓ tersimpan'; hasil.className = 'text-[10px] font-mono text-qi-green'; }
        } else {
            if (hasil) { hasil.textContent = '✗ ' + (d.message || ('HTTP ' + res.status)); hasil.className = 'text-[10px] font-mono text-qi-red'; }
        }
        await muatTelegramStatus();
    } catch (e) {
        if (hasil) { hasil.textContent = '✗ ' + (e && e.message ? e.message : 'gagal menghubungi server'); hasil.className = 'text-[10px] font-mono text-qi-red'; }
    }
}

async function tgHapus() {
    const hasil = document.getElementById('tgHasil');
    if (hasil) { hasil.textContent = 'menghapus…'; hasil.className = 'text-[10px] font-mono text-slate-400'; }
    try {
        const res = await fetch('api/telegram-setelan.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aksi: 'hapus' })
        });
        const d = await res.json().catch(() => ({}));
        if (hasil) {
            hasil.textContent = (res.ok && d.status === 'success') ? '✓ pengaturan dihapus' : ('✗ ' + (d.message || ('HTTP ' + res.status)));
            hasil.className = 'text-[10px] font-mono ' + ((res.ok && d.status === 'success') ? 'text-qi-green' : 'text-qi-red');
        }
        const t = document.getElementById('tgToken'); if (t) t.value = '';
        const c = document.getElementById('tgChat'); if (c) c.value = '';
        await muatTelegramStatus();
    } catch (e) {
        if (hasil) { hasil.textContent = '✗ ' + (e && e.message ? e.message : 'gagal'); hasil.className = 'text-[10px] font-mono text-qi-red'; }
    }
}
window.muatTelegramStatus = muatTelegramStatus;

/* ═══════════════════════════════════════════════════════════════════════════
   VERSI METODE (spesifikasi Bagian 5) — usulan → bukti uji → aktivasi
   ═══════════════════════════════════════════════════════════════════════════
   Semua aturan ditegakkan SERVER (api/metode.php): backtest ≥ 100, forward ≥ 30,
   metrik wajib terisi, dan tidak boleh lebih buruk dari versi aktif. Panel ini hanya
   menampilkan hasil keputusan server apa adanya — tidak menghitung apa pun sendiri.
   ═══════════════════════════════════════════════════════════════════════════ */
async function muatMetode() {
    const body = document.getElementById('metodeBody');
    if (!body) return;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    try {
        const r = await fetch('api/metode.php', { headers: QuantumAuth.authHeaders(), cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!j || j.status !== 'ok') {
            body.innerHTML = '<tr><td colspan="9" class="px-3 py-3 text-center text-amber-300">Tidak dapat memuat versi: ' + esc((j && j.message) || 'sebab tidak diketahui') + '</td></tr>';
            return;
        }
        const versi = j.versi || [];
        const aktif = j.aktif || null;
        const ea = document.getElementById('metodeAktif');
        if (ea) {
            ea.textContent = aktif
                ? ('aktif: ' + aktif.version + ' · winrate ' + (aktif.winrate ?? '—') + '% · PF ' + (aktif.profit_factor ?? '—'))
                : 'belum ada versi aktif ber metrik';
        }
        const ec = document.getElementById('metodeCatatan');
        if (ec) {
            const u = j.usulan_sl || null;
            ec.textContent = 'Syarat server: ' + ((j.syarat && j.syarat.aturan) || '-')
                + (u && u.usul ? (' · Usulan dari analisa SL: ' + u.usul) : (' · Belum ada usulan dari analisa SL (' + ((u && u.catatan) || 'sampel belum cukup') + ')'));
        }
        if (!versi.length) {
            body.innerHTML = '<tr><td colspan="9" class="px-3 py-3 text-center text-slate-600">Belum ada versi tercatat. Tekan "Ajukan versi dari usulan SL" untuk memulai (metrik masih kosong sampai diisi hasil uji).</td></tr>';
            return;
        }
        body.innerHTML = versi.map(v => {
            const aktifIni = Number(v.is_active) === 1;
            const status = String(v.status_usul || 'usul');
            const stCls = aktifIni ? 'text-qi-green font-bold' : (status === 'ditolak' ? 'text-qi-red' : (status === 'uji' ? 'text-qi-cyan' : 'text-slate-400'));
            const alasan = aktifIni ? 'SEDANG DIPAKAI' : String(v.alasan_kelayakan || '—');
            const tombol = aktifIni ? '' :
                ('<button onclick="metodeAktifkan(\'' + esc(v.version) + '\')" class="text-[9px] px-1.5 py-0.5 rounded border border-qi-cyan/40 text-qi-cyan hover:bg-qi-cyan/10"' + (v.layak_aktif ? '' : ' disabled title="' + esc(alasan) + '"') + '>✔ aktifkan</button> '
               + '<button onclick="metodeTolak(\'' + esc(v.version) + '\')" class="text-[9px] px-1.5 py-0.5 rounded border border-qi-border text-slate-400 hover:bg-white/5">✖ tolak</button>');
            return '<tr class="border-b border-qi-border/30 hover:bg-white/[.02]">'
                + '<td class="px-2 py-1.5 text-left text-white">' + esc(v.version) + '</td>'
                + '<td class="px-2 py-1.5 ' + stCls + '">' + esc(aktifIni ? 'AKTIF' : status) + '</td>'
                + '<td class="px-2 py-1.5 text-slate-300">' + esc(v.winrate === null ? '—' : (v.winrate + '%')) + '</td>'
                + '<td class="px-2 py-1.5 text-slate-300">' + esc(v.profit_factor === null ? '—' : v.profit_factor) + '</td>'
                + '<td class="px-2 py-1.5 text-slate-300">' + esc(v.max_drawdown === null ? '—' : v.max_drawdown) + '</td>'
                + '<td class="px-2 py-1.5 text-slate-400">' + esc(v.backtest_samples === null ? '—' : v.backtest_samples) + '</td>'
                + '<td class="px-2 py-1.5 text-slate-400">' + esc(v.forward_samples === null ? '—' : v.forward_samples) + '</td>'
                + '<td class="px-2 py-1.5 text-left ' + (aktifIni ? 'text-qi-green' : 'text-slate-500') + '">' + esc(alasan).slice(0, 120) + '</td>'
                + '<td class="px-2 py-1.5 whitespace-nowrap">' + tombol + '</td>'
                + '</tr>';
        }).join('');
    } catch (e) {
        body.innerHTML = '<tr><td colspan="9" class="px-3 py-3 text-center text-amber-300">Gagal memuat versi: ' + esc(e.message) + '</td></tr>';
    }
}

/** Kirim tindakan ke api/metode.php lalu muat ulang daftar. */
async function metodeKirim(badan) {
    const pesan = document.getElementById('metodePesan');
    try {
        const r = await fetch('api/metode.php', {
            method: 'POST',
            headers: QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(badan),
        });
        const j = await r.json().catch(() => null);
        const t = (j && j.message) ? j.message : 'Tidak ada jawaban dari server.';
        if (pesan) pesan.textContent = t;
        if (window.showQuantumToast) window.showQuantumToast(t, (j && j.status === 'success') ? 'success' : 'error');
        await muatMetode();
        return j;
    } catch (e) {
        if (pesan) pesan.textContent = 'Gagal: ' + e.message;
        return null;
    }
}

async function metodeUsulkan() {
    const catatan = document.getElementById('metodeCatatan');
    const usul = catatan ? catatan.textContent : '';
    const teks = prompt('Changelog versi baru (wajib, minimal 10 huruf). Usulan dari analisa SL akan disertakan:', 'Usulan dari analisa SL: ' + usul.slice(0, 160));
    if (teks === null) return;
    await metodeKirim({ aksi: 'usulkan', changelog: teks, dasar: 'analisa SL' });
}

async function metodeMetrik() {
    const ambil = (id) => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : null; };
    const versi = (document.getElementById('mtVersi')?.value || '').trim();
    if (!versi) { if (window.showQuantumToast) window.showQuantumToast('Isi kolom "Versi" lebih dulu (mis. v1.0.1).', 'warning'); return; }
    await metodeKirim({
        aksi: 'metrik', versi: versi,
        winrate: ambil('mtWinrate'), profit_factor: ambil('mtPf'), max_drawdown: ambil('mtDd'),
        backtest_samples: ambil('mtBt'), forward_samples: ambil('mtFw'),
    });
}

async function metodeAktifkan(versi) {
    if (!confirm('Aktifkan versi ' + versi + '? Server akan menolak bila backtest < 100, forward < 30, atau hasilnya lebih buruk dari versi aktif.')) return;
    await metodeKirim({ aksi: 'aktifkan', versi: versi });
}

async function metodeTolak(versi) {
    const sebab = prompt('Alasan menolak ' + versi + ' (wajib, minimal 3 huruf):');
    if (sebab === null) return;
    await metodeKirim({ aksi: 'tolak', versi: versi, sebab: sebab });
}
window.muatMetode = muatMetode;
window.metodeUsulkan = metodeUsulkan;
window.metodeMetrik = metodeMetrik;
window.metodeAktifkan = metodeAktifkan;
window.metodeTolak = metodeTolak;

/* ═══════════════════════════════════════════════════════════════════════════
   QUANTUM AI SIGNAL GATEWAY (Tahap 4)
   ═══════════════════════════════════════════════════════════════════════════
   Menampilkan: status koneksi webhook, ringkasan trafik, LOG SETIAP permintaan
   webhook (termasuk yang DITOLAK — inilah gunanya audit), filter, tombol uji kirim,
   dan SAKLAR DARURAT (pause) yang ditegakkan server.
   Tidak ada angka yang dihitung di peramban: semuanya dari api/gateway.php.
   ═══════════════════════════════════════════════════════════════════════════ */
async function muatGateway() {
    const isi = (id, teks, kelas) => { const e = document.getElementById(id); if (e) { e.textContent = teks; if (kelas) e.className = kelas; } };
    const status = document.getElementById('gwFilterStatus')?.value || '';
    const auth = document.getElementById('gwFilterAuth')?.value || '';
    const simbol = (document.getElementById('gwFilterSimbol')?.value || '').trim();
    const batas = document.getElementById('gwFilterBatas')?.value || '50';
    const q = new URLSearchParams();
    if (simbol) q.set('simbol', simbol);
    if (status) q.set('status', status);
    if (auth) q.set('auth', auth);
    q.set('batas', batas);

    isi('gwStatusKoneksi', 'memuat…', 'text-[10px] font-mono px-2 py-0.5 rounded border border-qi-border text-slate-400');
    try {
        const r = await fetch('api/gateway.php?' + q.toString(), { headers: QuantumAuth.authHeaders(), cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!j || j.status !== 'ok') {
            isi('gwStatusKoneksi', 'gagal memuat', 'text-[10px] font-mono px-2 py-0.5 rounded border border-qi-red/40 text-qi-red');
            const b = document.getElementById('gwLogBody');
            if (b) b.innerHTML = '<tr><td colspan="8" class="px-4 py-4 text-center text-amber-300">Log tidak dapat dimuat: ' + String((j && j.message) || 'sebab tidak diketahui').replace(/[<>&]/g, '') + '</td></tr>';
            return;
        }

        // Status koneksi: ada trafik dalam 24 jam terakhir → Connected.
        const ring = j.ringkasan || {};
        const terakhir = ring.terakhir ? new Date(String(ring.terakhir).replace(' ', 'T')) : null;
        const segar = terakhir ? ((Date.now() - terakhir.getTime()) < 24 * 3600 * 1000) : false;
        isi('gwStatusKoneksi', segar ? '● Connected' : (ring.total > 0 ? '○ Idle (tidak ada trafik 24 jam)' : '○ Belum ada trafik'),
            'text-[10px] font-mono px-2 py-0.5 rounded border ' + (segar ? 'border-qi-green/40 text-qi-green' : 'border-qi-border text-slate-400'));
        isi('gwTerakhir', ring.terakhir ? ('terakhir: ' + ring.terakhir) : '');
        isi('gwTotal', j.tersedia ? String(ring.total || 0) : '—');
        isi('gwHariIni', j.tersedia ? String(ring.hari_ini || 0) : '—');
        const statusMap = ring.per_status || {};
        isi('gwDitolak', j.tersedia ? String((statusMap.REJECTED || 0) + (statusMap.ERROR || 0)) : '—');
        const authMap = ring.per_auth || {};
        isi('gwAuth', j.tersedia ? ((authMap.hmac || 0) + ' / ' + (authMap.query_key || 0)) : '—');

        // Saklar darurat (status selalu dari server).
        const jd = j.jeda || {};
        isi('gwJedaStatus', jd.aktif ? '⏸ JEDA AKTIF' : '▶ Normal',
            'text-[10px] font-mono px-2 py-0.5 rounded border ' + (jd.aktif ? 'border-qi-red/50 text-qi-red' : 'border-qi-green/40 text-qi-green'));
        if (jd.aktif) isi('gwJedaPesan', 'Sinyal baru dihentikan sejak ' + (jd.sejak || '—') + ' · sebab: ' + (jd.sebab || '—'));
        else if (jd.sebab) isi('gwJedaPesan', 'Terakhir diubah: ' + (jd.sebab || ''));
        const bJeda = document.getElementById('gwTombolJeda');
        const bLanjut = document.getElementById('gwTombolLanjut');
        if (bJeda) bJeda.disabled = !!jd.aktif;
        if (bLanjut) bLanjut.disabled = !jd.aktif;

        // Gerbang konfluensi mesin (syarat minimal 3 mesin searah) — dikendalikan admin.
        const gb = j.gerbang || {};
        if (gb.aktif === null || gb.aktif === undefined) {
            isi('gwGerbangStatus', 'tidak tersedia', 'text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/40 text-amber-300');
        } else {
            isi('gwGerbangStatus', gb.aktif ? '✔ AKTIF (min 3 mesin)' : '✖ NONAKTIF',
                'text-[10px] font-mono px-2 py-0.5 rounded border ' + (gb.aktif ? 'border-qi-cyan/40 text-qi-cyan' : 'border-amber-500/40 text-amber-300'));
            const pG = document.getElementById('gwGerbangPesan');
            if (pG) pG.textContent = gb.sebab ? ('Terakhir diubah: ' + gb.sebab + (gb.sejak ? (' · ' + gb.sejak) : '')) : '';
            const bOn = document.getElementById('gwTombolGerbangOn');
            const bOff = document.getElementById('gwTombolGerbangOff');
            if (bOn) bOn.disabled = !!gb.aktif;
            if (bOff) bOff.disabled = !gb.aktif;
        }

        // Log
        const body = document.getElementById('gwLogBody');
        if (!body) return;
        isi('gwJumlahLog', (j.log || []).length + ' baris ditampilkan');
        isi('gwCatatan', j.catatan ? ('Catatan: ' + j.catatan) : (j.catatan_ukur || ''));
        if (!j.tersedia) {
            body.innerHTML = '<tr><td colspan="8" class="px-4 py-4 text-center text-amber-300">Tabel log belum tersedia — jalankan migrasi 010. (Tidak ditampilkan kosong agar tidak terlihat seperti "tidak ada trafik".)</td></tr>';
            return;
        }
        if (!(j.log || []).length) {
            body.innerHTML = '<tr><td colspan="8" class="px-4 py-4 text-center text-slate-600">Belum ada permintaan webhook' + (simbol || status || auth ? ' yang cocok dengan filter' : '') + '. Coba tombol "Uji kirim webhook".</td></tr>';
            return;
        }
        const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        // Log bisa memuat sampai 200 baris → dirender PROGRESIF supaya panel tetap ringan.
        const barisLog = (l) => {
            const st = String(l.status || '');
            const stCls = st === 'PROCESSED' ? 'text-qi-green' : (st === 'REJECTED' || st === 'ERROR' ? 'text-qi-red' : (st === 'RECEIVED' ? 'text-qi-cyan' : 'text-slate-400'));
            const ttd = (l.signature_ok === null || l.signature_ok === undefined) ? '' : ((Number(l.signature_ok) === 1) ? ' ✓' : ' ✗');
            const auth = String(l.auth_method || '—') + ttd;
            return '<tr class="border-b border-qi-border/30 hover:bg-white/[.02]">'
                + '<td class="px-3 py-2 text-left text-slate-400">' + esc(String(l.received_at || '').slice(5, 16)) + '</td>'
                + '<td class="px-3 py-2 text-slate-400">' + esc(l.source || '—') + '<span class="text-slate-600"> ' + esc(String(l.ip || '').slice(0, 22)) + '</span></td>'
                + '<td class="px-3 py-2 text-white">' + esc(l.symbol || '—') + '</td>'
                + '<td class="px-3 py-2 text-slate-400">' + esc(l.timeframe || '—') + '</td>'
                + '<td class="px-3 py-2 ' + (l.action === 'BUY' ? 'text-qi-green' : (l.action === 'SELL' ? 'text-qi-red' : 'text-slate-500')) + '">' + esc(l.action || '—') + '</td>'
                + '<td class="px-3 py-2 font-bold ' + stCls + '">' + esc(st) + '<span class="text-slate-600 font-normal"> ' + esc(String(l.http_code || '')) + '</span></td>'
                + '<td class="px-3 py-2 text-slate-400">' + esc(auth) + '</td>'
                + '<td class="px-3 py-2 text-left text-slate-500">' + (l.signal_id ? ('<span class="text-qi-cyan">' + esc(l.signal_id) + '</span> ') : '') + esc(String(l.message || '').slice(0, 70)) + '</td>'
                + '</tr>';
        };
        qiRenderProgresif(body, j.log || [], barisLog, {
            awal: 40, tambah: 40,
            kosong: '<tr><td colspan="8" class="px-4 py-4 text-center text-slate-600">Belum ada permintaan webhook.</td></tr>',
        });
    } catch (e) {
        isi('gwStatusKoneksi', 'galat: ' + e.message, 'text-[10px] font-mono px-2 py-0.5 rounded border border-qi-red/40 text-qi-red');
    }
}

/** Ubah saklar darurat. Server menolak bila bukan admin (pesannya ditampilkan apa adanya). */
async function gatewayJeda(aktif) {
    const sebab = (document.getElementById('gwJedaSebab')?.value || '').trim();
    const pesan = document.getElementById('gwJedaPesan');
    if (aktif && sebab.length < 3) {
        if (pesan) pesan.textContent = 'Alasan wajib diisi (minimal 3 huruf) — supaya tindakan ini dapat diaudit.';
        return;
    }
    if (aktif && !confirm('Hentikan penerbitan sinyal BARU untuk SEMUA mesin? Rekor lama tetap utuh dan penilaian TP/SL tetap berjalan.')) return;
    try {
        const r = await fetch('api/signal-jeda.php', {
            method: 'POST',
            headers: QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ jeda: !!aktif, sebab: sebab || (aktif ? '' : 'dilanjutkan dari panel Gateway') }),
        });
        const j = await r.json().catch(() => null);
        if (pesan) pesan.textContent = (j && (j.message || j.message === '' ? j.message : '')) || (j && j.message) || 'Tidak ada jawaban.';
        if (j && j.message) if (window.showQuantumToast) window.showQuantumToast(j.message, j.status === 'success' ? 'success' : 'error');
        const inp = document.getElementById('gwJedaSebab');
        if (j && j.status === 'success' && inp) inp.value = '';
        await muatGateway();
    } catch (e) {
        if (pesan) pesan.textContent = 'Gagal mengubah saklar: ' + e.message;
    }
}

/** Uji kirim webhook: memakai SIMBOL UJI supaya TIDAK menghasilkan sinyal nyata. */
async function gatewayUjiWebhook() {
    const out = document.getElementById('gwUjiHasil');
    if (out) out.textContent = 'mengirim…';
    try {
        const info = await fetch('api/tv-webhook.php?info=1', { headers: QuantumAuth.authHeaders(), cache: 'no-store' }).then(x => x.json()).catch(() => null);
        if (!info || !info.url) {
            if (out) out.textContent = 'URL webhook tidak dapat diambil (perlu sesi PRO). ';
            return;
        }
        const badan = JSON.stringify({ symbol: 'UJIWEBHOOK', timeframe: '60', price: '1.0', message: 'uji koneksi dari panel Gateway' });
        const r = await fetch(info.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: badan });
        const j = await r.json().catch(() => null);
        if (out) out.textContent = 'HTTP ' + r.status + ' · ' + String((j && (j.alasan || j.message || j.status)) || '').slice(0, 120)
            + ' — ini NORMAL: simbol uji memang tidak didukung, sehingga TIDAK ada sinyal palsu yang dibuat, dan buktinya muncul di log di bawah.';
        await muatGateway();
    } catch (e) {
        if (out) out.textContent = 'Uji gagal: ' + e.message;
    }
}

/** Ubah saklar GERBANG konfluensi mesin (syarat minimal 3 mesin searah). */
async function gatewayGerbang(aktif) {
    const sebab = (document.getElementById('gwGerbangSebab')?.value || '').trim();
    const pesan = document.getElementById('gwGerbangPesan');
    if (!aktif && sebab.length < 3) {
        if (pesan) pesan.textContent = 'Alasan wajib diisi (minimal 3 huruf) saat mematikan gerbang — supaya dapat diaudit.';
        return;
    }
    if (!aktif && !confirm('Matikan penyaringan konfluensi mesin? Sinyal baru akan terbit TANPA syarat minimal 3 mesin searah (hasil penilaian tetap dicatat di kolom basis).')) return;
    try {
        const r = await fetch('api/signal-gerbang.php', {
            method: 'POST',
            headers: QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ aktif: !!aktif, sebab: sebab }),
        });
        const j = await r.json().catch(() => null);
        if (pesan) pesan.textContent = (j && j.message) ? j.message : 'Tidak ada jawaban dari server.';
        if (j && j.message && window.showQuantumToast) window.showQuantumToast(j.message, j.status === 'success' ? 'success' : 'error');
        const inp = document.getElementById('gwGerbangSebab');
        if (j && j.status === 'success' && inp) inp.value = '';
        await muatGateway();
    } catch (e) {
        if (pesan) pesan.textContent = 'Gagal mengubah gerbang: ' + e.message;
    }
}

/** Salin URL webhook (berisi kunci) ke papan klip — khusus PRO. */async function gatewaySalinUrl() {
    const out = document.getElementById('gwUjiHasil');
    try {
        const info = await fetch('api/tv-webhook.php?info=1', { headers: QuantumAuth.authHeaders(), cache: 'no-store' }).then(x => x.json()).catch(() => null);
        if (!info || !info.url) { if (out) out.textContent = 'URL webhook tidak dapat diambil (perlu sesi PRO).'; return; }
        const teks = 'URL webhook:\n' + info.url + '\n\nTemplate pesan alert:\n' + (info.template || '');
        if (navigator.clipboard) await navigator.clipboard.writeText(teks);
        if (out) out.textContent = 'URL + template disalin. Tempel di kolom Webhook URL TradingView, dan template JSON di kotak pesan alert. Kunci bersifat rahasia — jangan dibagikan.';
    } catch (e) {
        if (out) out.textContent = 'Gagal menyalin: ' + e.message;
    }
}
window.muatGateway = muatGateway;
window.gatewayJeda = gatewayJeda;
window.gatewayUjiWebhook = gatewayUjiWebhook;
window.gatewayGerbang = gatewayGerbang;
window.gatewaySalinUrl = gatewaySalinUrl;

/**
 * RENDER PROGRESIF untuk daftar panjang (spesifikasi Bagian 9: "virtual scrolling").
 *
 * MENGAPA bukan virtual scrolling sejati: virtual scrolling menuntut tinggi baris yang
 * pasti dan perhitungan posisi gulir — pada tabel yang barisnya bisa berbeda tinggi
 * (pesan panjang, jumlah kolom berubah), cara itu rawan salah tampil. Pendekatan ini
 * memberi manfaat yang sama untuk beban halaman: hanya sebagian baris yang dimasukkan
 * ke DOM, sisanya ditambahkan saat pengguna mendekati bawah daftar.
 *
 * Keamanan: bila IntersectionObserver tidak tersedia (peramban lama), SEMUA baris
 * langsung dirender seperti sebelumnya — tidak ada daftar yang tampil kosong.
 */
function qiRenderProgresif(wadah, baris, buatHtml, opsi) {
    const o = opsi || {};
    const awal = o.awal || 40;
    const tambah = o.tambah || 40;
    if (!wadah) return 0;
    if (!Array.isArray(baris) || baris.length === 0) {
        wadah.innerHTML = o.kosong || '';
        return 0;
    }
    if (typeof IntersectionObserver !== 'function' || baris.length <= awal) {
        wadah.innerHTML = baris.map(buatHtml).join('');
        return baris.length;
    }
    let n = Math.min(awal, baris.length);
    wadah.innerHTML = baris.slice(0, n).map(buatHtml).join('');

    const sentinel = document.createElement('div');
    sentinel.className = 'qi-muat-lagi text-center text-[10px] text-slate-500 py-2';
    const tulisSentinel = () => { sentinel.textContent = 'memuat ' + (baris.length - n) + ' baris lagi saat digulir…'; };
    tulisSentinel();
    wadah.appendChild(sentinel);

    const pengamat = new IntersectionObserver(function (entri) {
        if (!entri.some(e => e.isIntersecting)) return;
        const n2 = Math.min(n + tambah, baris.length);
        sentinel.insertAdjacentHTML('beforebegin', baris.slice(n, n2).map(buatHtml).join(''));
        n = n2;
        if (n >= baris.length) { sentinel.remove(); pengamat.disconnect(); }
        else tulisSentinel();
    }, { rootMargin: '200px' });
    pengamat.observe(sentinel);
    return n;
}
window.qiRenderProgresif = qiRenderProgresif;

/**
 * Ambil snapshot chart dari KANVAS PERAMBAN lalu unggah ke server (Tahap 1D).
 *
 * BATASAN YANG DISEBUT JUJUR: chart TradingView berada di iframe lintas domain, sehingga
 * kanvasnya TIDAK bisa dibaca peramban (aturan keamanan). Yang bisa diambil adalah kanvas
 * chart TERMINAL (satu domain). Bila tidak ada kanvas yang bisa dibaca, pengguna diberi
 * tahu untuk memakai fitur snapshot TradingView — bukan dibuatkan gambar palsu.
 */
/**
 * Gambar OVERLAY keterangan sinyal (Entry/SL/TP + R:R) di atas salinan chart.
 *
 * KENAPA di peramban: server ini TIDAK memiliki ekstensi GD, jadi penggabungan gambar
 * tidak mungkin dilakukan di server. Jadi overlay digambar di kanvas peramban sebelum
 * diunggah — dan gambar asli TIDAK diubah (dipakai salinan).
 *
 * KEJUJURAN: garis level HANYA digambar bila simbol chart yang terbuka SAMA dengan simbol
 * sinyal. Bila berbeda, garis tidak digambar (kalau dipaksa, garisnya akan menyesatkan),
 * dan hanya kotak keterangan yang ditambahkan.
 */
function qiOverlaySinyal(kanvasAsal, rek) {
    const MAKS_LEBAR = 1280;
    const skala = Math.min(1, MAKS_LEBAR / kanvasAsal.width);
    const w = Math.max(320, Math.round(kanvasAsal.width * skala));
    const h = Math.max(200, Math.round(kanvasAsal.height * skala));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.drawImage(kanvasAsal, 0, 0, w, h);

    const num = (v) => (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    const entry = num(rek.entry), sl = num(rek.sl), tp = num(rek.tp);
    const arah = String(rek.side || '').toUpperCase();
    const fmt = (v) => v === null ? '—' : String(v);

    // ── Garis level: hanya bila simbol chart = simbol sinyal ──────────────────
    let garisDigambar = false;
    const simbolChart = String(window.quantumTerminalManager?.currentSymbol || window._lwSymbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const simbolSinyal = String(rek.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cocok = simbolChart !== '' && simbolSinyal !== '' && simbolChart === simbolSinyal;
    if (cocok && entry !== null && sl !== null && tp !== null && entry !== sl) {
        // Skala harga→piksel memakai rentang yang mencakup semua level dengan margin.
        const semua = [entry, sl, tp].filter(v => v !== null);
        const atas = Math.max(...semua), bawah = Math.min(...semua);
        const rentang = Math.max(atas - bawah, Math.abs(entry) * 0.0005);
        const yDari = (v) => {
            const pos = (atas - v) / rentang;                    // 0 di atas
            return Math.round(h * 0.12 + pos * h * 0.76);        // margin 12% atas/bawah
        };
        const gambar = (v, warna, teks) => {
            const y = yDari(v);
            if (y < 0 || y > h) return;
            g.save();
            g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeStyle = warna;
            g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
            g.setLineDash([]);
            g.font = 'bold 13px monospace';
            const tw = g.measureText(teks).width + 12;
            g.fillStyle = warna; g.fillRect(6, y - 18, tw, 17);
            g.fillStyle = '#04121f'; g.fillText(teks, 12, y - 5);
            g.restore();
        };
        gambar(entry, '#00E5FF', 'ENTRY ' + fmt(entry));
        gambar(sl, '#FF4D6D', 'SL ' + fmt(sl));
        gambar(tp, '#22C55E', 'TP ' + fmt(tp));
        garisDigambar = true;
    }

    // ── Kotak keterangan (selalu benar, tidak bergantung simbol chart) ────────
    const baris = [
        'QUANTUM INSTITUT — ' + String(rek.symbol || '') + ' ' + (arah || ''),
        'Entry ' + fmt(entry) + '  SL ' + fmt(sl) + '  TP ' + fmt(tp),
        'R:R ' + String(rek.rr || '—') + '  ·  mesin ' + String(rek.engine || '—'),
        garisDigambar ? 'Garis level dari data rekor server'
                      : 'Garis level TIDAK digambar (simbol chart berbeda dari simbol sinyal)',
        'Edukasi, bukan saran investasi',
    ];
    g.save();
    g.font = '12px monospace';
    const lebar = Math.min(w - 16, Math.max(...baris.map(b => g.measureText(b).width)) + 20);
    const tinggi = baris.length * 17 + 10;
    g.fillStyle = 'rgba(4,18,31,0.88)';
    g.fillRect(8, 8, lebar, tinggi);
    g.strokeStyle = '#00E5FF'; g.lineWidth = 1; g.strokeRect(8.5, 8.5, lebar - 1, tinggi - 1);
    g.fillStyle = '#E2E8F0';
    baris.forEach((b, i) => g.fillText(b, 18, 26 + i * 17));
    g.restore();

    return cv;
}

async function fotoSinyal(idSinyal) {
    try {
        // Cari data sinyal dari daftar yang sudah dimuat server (tanpa permintaan baru).
        const rek = (Array.isArray(_asRiwayat) ? _asRiwayat : []).find(r => String(r.id) === String(idSinyal)) || {};

        const kanvasSemua = document.querySelectorAll('canvas');
        let kanvasAsal = null;
        for (const c of kanvasSemua) {
            if (!c.width || !c.height || c.width < 240 || c.height < 140) continue;   // bukan chart
            try { c.toDataURL('image/png'); kanvasAsal = c; break; }                  // uji izin baca
            catch (e) { /* kanvas lintas domain → coba kanvas berikutnya */ }
        }
        if (!kanvasAsal) {
            if (window.showQuantumToast) window.showQuantumToast('Chart tidak dapat diambil otomatis (kanvas lintas domain / chart belum tampil). Buka panel chart dulu, atau pakai snapshot TradingView lalu simpan manual.', 'warning');
            return;
        }
        const cv = qiOverlaySinyal(kanvasAsal, rek);

        // PNG dulu; bila terlalu besar untuk batas server (1,5 MB), pakai JPEG.
        let dataUrl = cv.toDataURL('image/png');
        let jenis = 'PNG';
        if (dataUrl.length > 1_900_000) { dataUrl = cv.toDataURL('image/jpeg', 0.85); jenis = 'JPEG'; }
        if (window.showQuantumToast) window.showQuantumToast('Mengunggah snapshot (' + jenis + ', ' + Math.round(dataUrl.length / 1024) + ' KB)…', 'info', 1500);

        const r = await fetch('api/signal-snapshot.php', {
            method: 'POST',
            headers: QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ signal_id: idSinyal, image: dataUrl }),
        });
        const j = await r.json().catch(() => null);
        if (j && j.status === 'success') {
            if (window.showQuantumToast) window.showQuantumToast('📸 Snapshot + overlay tersimpan' + (j.tertaut ? ' dan tertaut ke sinyal.' : ' (tautan jurnal belum ada).'), 'success');
            if (typeof muatRiwayatSinyal === 'function') muatRiwayatSinyal();
            else if (typeof loadTrackRecord === 'function') loadTrackRecord();
        } else {
            if (window.showQuantumToast) window.showQuantumToast('Snapshot gagal: ' + ((j && j.message) || 'sebab tidak diketahui'), 'error');
        }
    } catch (e) {
        if (window.showQuantumToast) window.showQuantumToast('Snapshot gagal: ' + e.message, 'error');
    }
}
window.fotoSinyal = fotoSinyal;
// Muat data server untuk panel Auto Signal (level nyata + rekap nyata).
// Tidak ada angka karangan: bila gagal, panel menampilkan '—'.
document.addEventListener('DOMContentLoaded', function () {
    try { if (typeof _asMuatServer === 'function') _asMuatServer(); } catch (e) {}
    try { localStorage.removeItem('qi_signal_records'); } catch (e) {}   // hapus rekor palsu lama
});
window.tgSimpan = tgSimpan;
window.tgHapus = tgHapus;

// ─── Academy Interactive Functions ──────────────────────────────────────────
function setAcademyTab(tab) {
    const tabs = ['smc', 'engines', 'calc', 'checklist'];
    tabs.forEach(t => {
        const btn = document.getElementById('acadTab-' + t);
        const view = document.getElementById('acadView-' + t);
        const active = t === tab;
        if (btn) {
            btn.className = active
                ? 'acad-tab px-3 py-1.5 rounded-lg bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan font-semibold transition-all'
                : 'acad-tab px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all';
        }
        if (view) {
            view.classList.toggle('hidden', !active);
        }
    });
    if (tab === 'calc') runAcadSimulator();
}

function runAcadSimulator() {
    const balance = parseFloat(document.getElementById('acadSimBalance')?.value) || 10000;
    const riskPct = parseFloat(document.getElementById('acadSimRisk')?.value) || 1;
    const slPips  = parseFloat(document.getElementById('acadSimSL')?.value) || 25;
    const tpPips  = parseFloat(document.getElementById('acadSimTP')?.value) || 75;
    const wrPct   = parseFloat(document.getElementById('acadSimWR')?.value) || 50;

    const riskDol   = balance * (riskPct / 100);
    const rrRatio   = slPips > 0 ? (tpPips / slPips) : 0;
    const profitDol = riskDol * rrRatio;
    const evDol     = ((wrPct / 100) * profitDol) - (((100 - wrPct) / 100) * riskDol);
    const projected = evDol * 100;
    const returnPct = balance > 0 ? ((projected / balance) * 100).toFixed(0) : 0;

    const outRisk   = document.getElementById('acadOutRiskDol');
    const outProfit = document.getElementById('acadOutProfitDol');
    const outRR     = document.getElementById('acadOutRR');
    const outEV     = document.getElementById('acadOutEV');
    const out100    = document.getElementById('acadOut100Trades');

    if (outRisk) outRisk.textContent = '$' + riskDol.toFixed(2);
    if (outProfit) outProfit.textContent = '$' + profitDol.toFixed(2);
    if (outRR) outRR.textContent = '1 : ' + rrRatio.toFixed(1);
    if (outEV) {
        outEV.textContent = (evDol >= 0 ? '+$' : '-$') + Math.abs(evDol).toFixed(2);
        outEV.className = 'text-lg font-mono font-bold ' + (evDol >= 0 ? 'text-qi-green' : 'text-rose-400');
    }
    if (out100) {
        out100.textContent = (projected >= 0 ? '+$' : '-$') + Math.abs(projected).toLocaleString('en-US', {maximumFractionDigits:0}) + ' (Pertumbuhan Portofolio ' + (projected >= 0 ? '+' : '') + returnPct + '%)';
        out100.className = projected >= 0 ? 'text-qi-green font-bold' : 'text-rose-400 font-bold';
    }
}

function evalAcadChecklist() {
    let count = 0;
    for (let i = 1; i <= 5; i++) {
        if (document.getElementById('chk' + i)?.checked) count++;
    }
    const st = document.getElementById('acadChecklistStatus');
    if (!st) return;
    if (count === 5) {
        st.className = 'p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-center text-xs font-mono font-bold text-emerald-400 animate-pulse';
        st.textContent = '🚀 CHECKLIST 5/5 LENGKAP — SETUP VALID & SIAP EKSEKUSI!';
    } else if (count >= 3) {
        st.className = 'p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl text-center text-xs font-mono font-bold text-amber-300';
        st.textContent = '⚠️ Checklist ' + count + '/5 — Masih ada syarat penting yang belum terpenuhi!';
    } else {
        st.className = 'p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-center text-xs font-mono font-bold text-rose-400';
        st.textContent = '⛔ Checklist ' + count + '/5 — Jangan Masuk Pasar Dulu!';
    }
}

function resetAcadChecklist() {
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById('chk' + i);
        if (el) el.checked = false;
    }
    evalAcadChecklist();
}

function initAcademyPanel() {
    setAcademyTab('smc');
    runAcadSimulator();
    evalAcadChecklist();
}
window.initAcademyPanel = initAcademyPanel;
window.setAcademyTab = setAcademyTab;
window.runAcadSimulator = runAcadSimulator;
window.evalAcadChecklist = evalAcadChecklist;
window.resetAcadChecklist = resetAcadChecklist;

// ─── COT Analysis ──────────────────────────────────────────────────────────
let _cotData = null;
let _cotPair = 'EUR/USD';
let _cotTab  = 'pair';

function setCotTab(tab) {
    _cotTab = tab;
    document.querySelectorAll('.cot-tab').forEach(b => {
        const active = b.dataset.cot === tab;
        b.className = active
            ? 'cot-tab px-4 py-1.5 rounded-lg text-[11px] font-semibold font-heading border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'cot-tab px-4 py-1.5 rounded-lg text-[11px] font-semibold font-heading border border-qi-border text-slate-400 hover:border-slate-500';
    });
    ['pair','all','gold'].forEach(t => {
        const el = document.getElementById(`cot-tab-${t}`);
        if (el) el.classList.toggle('hidden', t !== tab);
    });
    if (_cotData) renderCot(_cotData);
}

function selectCotPair(pair) {
    _cotPair = pair;
    document.querySelectorAll('.cot-pair-btn').forEach(b => {
        const active = b.textContent.trim() === pair;
        b.className = active
            ? 'cot-pair-btn active px-2.5 py-1 rounded text-[10px] font-mono font-semibold border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'cot-pair-btn px-2.5 py-1 rounded text-[10px] font-mono border border-qi-border text-slate-400 hover:border-slate-600';
    });
    if (_cotData) renderCotPair(_cotData);
}

async function fetchCot() {
    const biasCard = document.getElementById('cotBiasCard');
    const allBody  = document.getElementById('cotAllBody');
    if (biasCard) biasCard.innerHTML = '<div class="py-6 text-center text-slate-600 text-xs">Memuat COT data…</div>';
    try {
        const res  = await fetch('api/cot.php');
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message);
        _cotData = data;
        const srcEl = document.getElementById('cotSource');
        if (srcEl && data.currencies) {
            const dates = Object.values(data.currencies).map(c=>c.reportDate).filter(Boolean);
            const latest = dates.sort().reverse()[0] || '';
            srcEl.textContent = `CFTC · ${latest || 'weekly'}`;
        }
        renderCot(data);
    } catch(e) {
        if (biasCard) biasCard.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">COT data tidak tersedia: ${(e.message||'').replace(/</g,'&lt;')}</div>`;
    }
}

function renderCot(data) {
    if (_cotTab === 'pair') renderCotPair(data);
    if (_cotTab === 'all')  renderCotAll(data);
    if (_cotTab === 'gold') renderCotGold(data);
}

function renderCotPair(data) {
    const biasCard = document.getElementById('cotBiasCard');
    const legsGrid = document.getElementById('cotLegsGrid');
    if (!biasCard || !data?.pairs) return;

    const p    = data.pairs[_cotPair];
    const bcur = data.currencies?.[p?.base]  || null;
    const qcur = data.currencies?.[p?.quote] || null;

    if (!p) {
        biasCard.innerHTML = '<div class="py-6 text-center text-slate-500 text-xs">Data pair tidak tersedia</div>';
        return;
    }

    const biasCls   = p.bias==='BULLISH' ? 'text-qi-green' : p.bias==='BEARISH' ? 'text-qi-red' : 'text-slate-400';
    const biasArrow = p.bias==='BULLISH' ? '→ BULLISH' : p.bias==='BEARISH' ? '→ BEARISH' : '→ NEUTRAL';
    const scoreNorm = Math.max(0, Math.min(100, (p.score + 100) / 2));
    const barLeft   = p.score < 0 ? `${scoreNorm}%` : '50%';
    const barW      = `${Math.abs(p.score / 2)}%`;
    const barColor  = p.bias==='BULLISH' ? '#10B981' : p.bias==='BEARISH' ? '#EF4444' : '#94A3B8';
    const wShiftCls = p.weekShift > 0 ? 'text-qi-green' : p.weekShift < 0 ? 'text-qi-red' : 'text-slate-400';

    biasCard.innerHTML = `
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-heading font-bold text-white text-base">${p.pair}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${p.bias==='BULLISH'?'border-qi-green/40 bg-qi-green/10 text-qi-green':p.bias==='BEARISH'?'border-qi-red/40 bg-qi-red/10 text-qi-red':'border-slate-600 text-slate-400'}">${biasArrow}</span>
                    <span class="text-[10px] text-slate-500">${p.conviction}</span>
                </div>
                <div class="text-[11px] text-slate-400">
                    Week over week, speculators moved toward <strong class="text-white">${p.score < 0 ? p.quote : p.base}</strong> relative to
                    <strong class="text-white">${p.score < 0 ? p.base : p.quote}</strong>
                    ${Math.abs(p.score) > 10 ? ` (${p.conviction})` : ''}.
                </div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-slate-500 mb-0.5">Bias Score</div>
                <div class="font-mono font-bold text-2xl ${biasCls}">${p.score > 0 ? '+' : ''}${p.score}</div>
            </div>
        </div>
        <!-- Score bar -->
        <div class="mb-3">
            <div class="flex justify-between text-[9px] text-slate-600 font-mono mb-1">
                <span>${p.quote} favoured ◄</span>
                <span>balanced</span>
                <span>► ${p.base} favoured</span>
            </div>
            <div class="relative h-2 bg-[#0F1A2E] rounded-full overflow-hidden">
                <div class="absolute top-0 h-full rounded-full" style="left:${barLeft};width:${barW};background:${barColor};"></div>
                <div class="absolute top-0 left-1/2 w-px h-full bg-slate-600"></div>
            </div>
            <div class="flex justify-between text-[9px] font-mono text-slate-600 mt-1">
                <span>-100</span>
                <span class="${wShiftCls} font-semibold">1W: ${p.weekShift>0?'+':''}${p.weekShift} pts toward ${p.weekShift>0?p.base:p.quote}</span>
                <span>+100</span>
            </div>
        </div>
        <!-- Base / Quote bars -->
        <div class="space-y-2 mt-3">
            ${renderCotLegBar(p.base, bcur, false)}
            ${renderCotLegBar(p.quote, qcur, true)}
        </div>`;

    // Leg by leg cards
    if (legsGrid) {
        legsGrid.innerHTML = [
            renderCotLegCard(p.base, bcur),
            renderCotLegCard(p.quote, qcur),
        ].join('');
    }
}

function renderCotLegBar(label, d, isQuote) {
    if (!d) return `<div class="flex items-center gap-2 text-[10px]"><span class="w-10 text-slate-400 font-mono font-bold">${label}</span><span class="text-slate-600">—</span></div>`;
    const pct   = Math.abs(d.netPct);
    const color = d.netPct > 0 ? '#10B981' : '#EF4444';
    const wfCls = d.weekFlow > 0 ? 'text-qi-green' : d.weekFlow < 0 ? 'text-qi-red' : 'text-slate-500';
    return `<div class="flex items-center gap-2">
        <span class="w-10 text-[11px] font-mono font-bold text-slate-300">${label}</span>
        <div class="flex-1 h-1.5 bg-[#0F1A2E] rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width:${Math.min(100,pct*3)}%;background:${color}"></div>
        </div>
        <span class="text-[10px] font-mono ${d.netPct>0?'text-qi-green':'text-qi-red'} w-12 text-right">${d.netPct>0?'+':''}${d.netPct}%</span>
        <span class="text-[10px] font-mono ${wfCls} w-14 text-right">${d.weekFlow>0?'+':''}${d.weekFlow}%/w</span>
    </div>`;
}

function renderCotLegCard(label, d) {
    if (!d) return '';
    const biasCls = d.bias==='BULLISH'?'text-qi-green':d.bias==='BEARISH'?'text-qi-red':'text-slate-400';
    const wfCls   = d.weekFlow>0?'text-qi-green':d.weekFlow<0?'text-qi-red':'text-slate-400';
    const fmtNum  = n => n >= 1000 ? (n/1000).toFixed(1)+'K' : n;
    return `<div class="bg-qi-card border border-qi-border rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
            <div>
                <span class="font-heading font-bold text-white text-sm">${label}</span>
                <span class="ml-2 text-[10px] text-slate-500">— ${d.name}</span>
            </div>
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${d.bias==='BULLISH'?'border-qi-green/40 text-qi-green':d.bias==='BEARISH'?'border-qi-red/40 text-qi-red':'border-slate-600 text-slate-400'}">${d.bias}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="bg-[#0F1A2E] rounded p-2 text-center">
                <div class="text-[9px] text-slate-500 mb-0.5">Long</div>
                <div class="text-[11px] font-mono font-bold text-qi-green">${fmtNum(d.longs)}</div>
                <div class="text-[9px] text-slate-600">${d.pctLong}% OI</div>
            </div>
            <div class="bg-[#0F1A2E] rounded p-2 text-center">
                <div class="text-[9px] text-slate-500 mb-0.5">Short</div>
                <div class="text-[11px] font-mono font-bold text-qi-red">${fmtNum(d.shorts)}</div>
                <div class="text-[9px] text-slate-600">${d.pctShort}% OI</div>
            </div>
            <div class="bg-[#0F1A2E] rounded p-2 text-center">
                <div class="text-[9px] text-slate-500 mb-0.5">Net Pos</div>
                <div class="text-[11px] font-mono font-bold ${d.net>0?'text-qi-green':'text-qi-red'}">${d.net>0?'+':''}${fmtNum(d.net)}</div>
                <div class="text-[9px] ${wfCls}">${d.weekFlow>0?'+':''}${d.weekFlow}%/wk</div>
            </div>
        </div>
        <div class="flex justify-between text-[9px] text-slate-500">
            <span>Wk Δ Long: <span class="${d.dLong>0?'text-qi-green':'text-qi-red'}">${d.dLong>0?'+':''}${fmtNum(d.dLong)}</span></span>
            <span>Wk Δ Short: <span class="${d.dShort>0?'text-qi-green':'text-qi-red'}">${d.dShort>0?'+':''}${fmtNum(d.dShort)}</span></span>
            <span>OI: ${fmtNum(d.oi)}</span>
        </div>
    </div>`;
}

function renderCotAll(data) {
    const body = document.getElementById('cotAllBody');
    if (!body || !data?.currencies) return;
    const rows = Object.values(data.currencies)
        .filter(c => c.label !== 'XAU')
        .sort((a,b) => b.netPct - a.netPct);
    const fmtN = n => n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n);
    body.innerHTML = rows.map(d => {
        const bCls = d.bias==='BULLISH'?'text-qi-green':d.bias==='BEARISH'?'text-qi-red':'text-slate-400';
        const wCls = d.weekFlow>0?'text-qi-green':d.weekFlow<0?'text-qi-red':'text-slate-400';
        const barW = Math.min(100, Math.abs(d.netPct) * 4);
        const barC = d.netPct>0?'#10B981':'#EF4444';
        return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02]">
            <td class="px-4 py-2.5">
                <div class="font-mono font-bold text-white text-[11px]">${d.label}</div>
                <div class="text-[9px] text-slate-500">${d.name}</div>
            </td>
            <td class="px-3 py-2.5 text-center">
                <span class="font-mono font-bold text-[10px] ${bCls}">${d.bias}</span>
            </td>
            <td class="px-3 py-2.5 text-right">
                <div class="font-mono text-[10px] ${d.net>0?'text-qi-green':'text-qi-red'}">${d.net>0?'+':''}${fmtN(d.net)}</div>
                <div class="mt-0.5 h-1 bg-[#0F1A2E] rounded-full overflow-hidden w-16 ml-auto"><div style="width:${barW}%;background:${barC};height:100%;border-radius:9px"></div></div>
            </td>
            <td class="px-3 py-2.5 text-right font-mono text-[10px] ${d.netPct>0?'text-qi-green':'text-qi-red'}">${d.netPct>0?'+':''}${d.netPct}%</td>
            <td class="px-3 py-2.5 text-right font-mono text-[10px] ${wCls}">${d.weekFlow>0?'+':''}${d.weekFlow}%</td>
            <td class="px-3 py-2.5 text-right font-mono text-[10px] text-qi-green">${fmtN(d.longs)}</td>
            <td class="px-3 py-2.5 text-right font-mono text-[10px] text-qi-red">${fmtN(d.shorts)}</td>
        </tr>`;
    }).join('');
}

function renderCotGold(data) {
    const card = document.getElementById('cotGoldCard');
    if (!card || !data?.currencies) return;
    const d = data.currencies['XAU'];
    if (!d) { card.innerHTML = '<div class="py-6 text-center text-slate-500 text-xs">Gold COT tidak tersedia</div>'; return; }
    const biasCls = d.bias==='BULLISH'?'text-qi-green':d.bias==='BEARISH'?'text-qi-red':'text-slate-400';
    const fmtN = n => n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n);
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div>
                <span class="text-xl">🥇</span>
                <span class="ml-2 font-heading font-bold text-white text-base">Gold (Comex)</span>
                <span class="ml-2 text-[10px] text-slate-500">${d.reportDate}</span>
            </div>
            <span class="font-mono font-bold text-lg ${biasCls}">${d.bias}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div class="bg-[#0F1A2E] rounded-lg p-3 text-center">
                <div class="text-[9px] text-slate-500 mb-1">Speculator Long</div>
                <div class="font-mono font-bold text-qi-green text-sm">${fmtN(d.longs)}</div>
                <div class="text-[9px] text-slate-600">${d.pctLong}% of OI</div>
            </div>
            <div class="bg-[#0F1A2E] rounded-lg p-3 text-center">
                <div class="text-[9px] text-slate-500 mb-1">Speculator Short</div>
                <div class="font-mono font-bold text-qi-red text-sm">${fmtN(d.shorts)}</div>
                <div class="text-[9px] text-slate-600">${d.pctShort}% of OI</div>
            </div>
            <div class="bg-[#0F1A2E] rounded-lg p-3 text-center">
                <div class="text-[9px] text-slate-500 mb-1">Net Position</div>
                <div class="font-mono font-bold text-sm ${d.net>0?'text-qi-green':'text-qi-red'}">${d.net>0?'+':''}${fmtN(d.net)}</div>
                <div class="text-[9px] ${d.netPct>0?'text-qi-green':'text-qi-red'}">${d.netPct}% OI</div>
            </div>
            <div class="bg-[#0F1A2E] rounded-lg p-3 text-center">
                <div class="text-[9px] text-slate-500 mb-1">Weekly Flow</div>
                <div class="font-mono font-bold text-sm ${d.weekFlow>0?'text-qi-green':'text-qi-red'}">${d.weekFlow>0?'+':''}${d.weekFlow}%</div>
                <div class="text-[9px] text-slate-600">Open Int: ${fmtN(d.oi)}</div>
            </div>
        </div>
        <div class="text-[11px] text-slate-400 bg-[#0F1A2E] rounded-lg p-3">
            <strong class="${biasCls}">Gold positioning is ${d.bias.toLowerCase()}.</strong>
            Specs are ${d.net > 0 ? 'net long' : 'net short'} ${fmtN(Math.abs(d.net))} contracts (${d.netPct}% of OI).
            Weekly flow: ${d.dLong > 0 ? 'longs added +' + fmtN(d.dLong) : 'longs cut ' + fmtN(d.dLong)},
            shorts ${d.dShort > 0 ? 'added +' + fmtN(d.dShort) : 'cut ' + fmtN(d.dShort)}.
        </div>`;
}

// ─── News Impact ───────────────────────────────────────────────────────────
let _impactWin    = '1h';
let _impactFilter = 'HIGH';

function setImpactWindow(w) {
    _impactWin = w;
    document.querySelectorAll('.impact-win-btn').forEach(b => {
        const active = b.dataset.window === w;
        b.className = active
            ? 'impact-win-btn active px-2.5 py-1 rounded text-[10px] font-mono border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'impact-win-btn px-2.5 py-1 rounded text-[10px] font-mono border border-qi-border text-slate-400';
    });
    fetchNewsImpact();
}

function setImpactFilter(f) {
    _impactFilter = f;
    document.querySelectorAll('.impact-filter-btn').forEach(b => {
        b.style.opacity = b.dataset.imp === f ? '1' : '0.4';
    });
    fetchNewsImpact();
}

async function fetchNewsImpact() {
    const body = document.getElementById('impactTableBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-slate-600">Memuat…</td></tr>';
    const sort = document.getElementById('impactSort')?.value || 'avg_impact';
    const cur  = document.getElementById('impactCur')?.value  || 'ALL';
    try {
        const res  = await fetch(`api/news-impact.php?window=${_impactWin}&sort=${sort}&impact=${_impactFilter}&currency=${cur}`);
        const data = await res.json();
        const rows = data.data || [];
        const rcEl = document.getElementById('impactRowCount');
        if (rcEl) rcEl.textContent = `${rows.length} rows`;
        if (!rows.length) { body.innerHTML = '<tr><td colspan="11" class="px-4 py-6 text-center text-slate-600">Tidak ada data</td></tr>'; return; }
        body.innerHTML = rows.map((r, i) => {
            const impCls  = r.impact==='HIGH'?'badge-high':r.impact==='MED'?'badge-med':'badge-low';
            const avgPips = (_impactWin==='30m' ? r.avg30m : r.avg1h) ?? 0;
            const barW    = Math.min(100, avgPips / 100 * 100);
            const consCls = r.cons >= 50 ? 'text-qi-green' : r.cons >= 30 ? 'text-qi-gold' : 'text-slate-400';
            return `<tr class="border-b border-qi-border/40 hover:bg-white/[.015] transition-colors">
                <td class="px-4 py-2">
                    <div class="flex items-center gap-2">
                        <span class="${impCls}">${r.impact}</span>
                        <span class="font-mono text-[10px] text-slate-300 font-medium">${r.cur}</span>
                        <span class="text-[10px] text-slate-200">${r.event}</span>
                    </div>
                </td>
                <td class="px-3 py-2 text-[10px] font-mono text-qi-cyan">${r.pair}</td>
                <td class="px-3 py-2 text-right">
                    <div class="font-mono font-bold text-[11px] text-white">${avgPips.toFixed(1)}</div>
                    <div class="mt-0.5 h-1 bg-[#0F1A2E] rounded-full overflow-hidden w-16 ml-auto"><div style="width:${barW}%;background:#F59E0B;height:100%;border-radius:9px"></div></div>
                </td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-slate-300">${r.med.toFixed(1)}</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-slate-300">${r.p90.toFixed(1)}</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-slate-400">${r.max.toFixed(1)}</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] ${consCls}">${r.cons}%</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-qi-green">${r.hit}%</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-slate-400">${r.upBias}%</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-slate-300">${r.rel}</td>
                <td class="px-3 py-2 text-right font-mono text-[10px] text-slate-500">${r.pyr > 0 ? r.pyr.toFixed(1) : '—'}</td>
            </tr>`;
        }).join('');
    } catch(e) {
        body.innerHTML = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-500">Error: ${(e.message||'').replace(/</g,'&lt;')}</td></tr>`;
    }
}

// ─── News Feed (redesigned) ─────────────────────────────────────────────────
let _newsItems = [];
let _newsCat   = 'All';

function setNewsCat(cat) {
    _newsCat = cat;
    document.querySelectorAll('.news-cat-btn').forEach(b => {
        const active = b.textContent.trim() === cat;
        b.className = active
            ? 'news-cat-btn active text-[10px] font-semibold px-3 py-1 rounded-full border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'news-cat-btn text-[10px] font-semibold px-3 py-1 rounded-full border border-qi-border text-slate-400 hover:border-slate-500';
    });
    filterNewsItems();
}

function filterNewsItems() {
    const query  = (document.getElementById('newsSearch')?.value || '').toLowerCase();
    const el     = document.getElementById('dashNewsList');
    if (!el) return;
    const catMap = {
        'Forex':         ['forex'],
        'Economy':       ['macro','economy'],
        'Central Banks': ['central-banks','central_banks','centralbanks','fed','boe','ecb','boj','rba'],
        'Commodities':   ['commodities','gold','oil','crypto'],
        'Geopolitical':  ['geopolitical'],
        'Breaking':      ['breaking'],
    };
    const filtered = _newsItems.filter(n => {
        const title = (n.title || '').toLowerCase();
        const cat   = (n.category || '').toLowerCase();
        const src   = (n.source || '').toLowerCase();
        const matchQ = !query || title.includes(query) || src.includes(query);
        let matchC = true;
        if (_newsCat !== 'All') {
            const keys = catMap[_newsCat] || [_newsCat.toLowerCase()];
            matchC = keys.some(k => cat.includes(k) || title.includes(k));
        }
        return matchQ && matchC;
    });
    const cnt = document.getElementById('newsCount');
    if (cnt) cnt.textContent = `${filtered.length} articles`;
    renderNewsItems(filtered);
}

function getSentiment(n) {
    const t = ((n.title||'')+(n.category||'')).toLowerCase();
    if (t.match(/bull|rise|surge|rally|gain|high|above|beat|strong|boost/)) return 'bullish';
    if (t.match(/bear|fall|drop|slide|loss|below|miss|weak|cut|fear/)) return 'bearish';
    return 'neutral';
}

function getCatStyle(cat) {
    cat = (cat||'').toLowerCase();
    if (cat.includes('crypto')) return 'text-qi-gold';
    if (cat.includes('forex') || cat.includes('central')) return 'text-qi-cyan';
    if (cat.includes('commodi') || cat.includes('gold') || cat.includes('oil')) return 'text-yellow-400';
    if (cat.includes('macro') || cat.includes('econom')) return 'text-qi-purple';
    if (cat.includes('breaking')) return 'text-qi-red';
    return 'text-slate-400';
}

function timeAgo(dt) {
    if (!dt) return '';
    const diff = (Date.now() - new Date(dt).getTime()) / 1000;
    if (diff < 60)   return Math.round(diff) + 's ago';
    if (diff < 3600) return Math.round(diff/60) + 'm ago';
    if (diff < 86400) return Math.round(diff/3600) + 'h ago';
    return Math.round(diff/86400) + 'd ago';
}

function renderNewsItems(items) {
    const el = document.getElementById('dashNewsList');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="px-4 py-8 text-center text-slate-600 text-xs">Tidak ada berita</div>'; return; }
    el.innerHTML = items.map(n => {
        const sent = getSentiment(n);
        const sentHtml = `<span class="sent-${sent}">${sent === 'bullish' ? '→ bullish' : sent === 'bearish' ? '→ bearish' : '— neutral'}</span>`;
        const catCls = getCatStyle(n.category);
        const ago = timeAgo(n.published_at || n.date);
        const url = n.url || n.link || '#';
        return `<a href="${url}" target="_blank" rel="noopener"
            class="flex items-start gap-3 px-4 py-3 hover:bg-white/[.025] transition-colors cursor-pointer news-item border-b border-qi-border/30"
            data-title="${(n.title||'').replace(/"/g,'&quot;')}" data-cat="${n.category||''}">
            <div class="flex-1 min-w-0">
                <div class="text-[12px] text-slate-100 leading-snug line-clamp-2 font-medium mb-1">${n.title||'—'}</div>
                <div class="text-[10px] text-slate-500 leading-tight mb-1.5 line-clamp-1">${n.summary||n.description||''}</div>
                <div class="flex items-center gap-2 flex-wrap">
                    ${n.source?`<span class="text-[9px] font-mono text-slate-500">${n.source}</span>`:''}
                    ${n.author?`<span class="text-[9px] text-slate-600">· ${n.author}</span>`:''}
                    ${n.category?`<span class="text-[9px] font-mono font-semibold ${catCls}">${n.category}</span>`:''}
                    ${sentHtml}
                    ${ago?`<span class="text-[9px] text-slate-600 ml-auto">${ago}</span>`:''}
                </div>
            </div>
            <span class="text-slate-600 text-xs mt-0.5 flex-shrink-0">↗</span>
        </a>`;
    }).join('');
}

// ─── Economic Calendar (redesigned) ────────────────────────────────────────
let _calFilters  = { high:true, med:true, low:true };
let _calWeekOff  = 0;

function toggleCalFilter(type) {
    _calFilters[type] = !_calFilters[type];
    const btn = document.getElementById(`calFilter${type.charAt(0).toUpperCase()+type.slice(1)}`);
    if (btn) btn.style.opacity = _calFilters[type] ? '1' : '0.35';
    renderCalTable();
}

function calNavWeek(dir) {
    _calWeekOff += dir;
    const label = document.getElementById('calWeekLabel');
    if (label) label.textContent = _calWeekOff === 0 ? 'This week' : _calWeekOff > 0 ? `+${_calWeekOff} week` : `${_calWeekOff} week`;
    renderCalTable();
}

function renderCalTable() {
    const body = document.getElementById('calTableBody');
    if (!body || !_calEvents.length) return;
    const cur = document.getElementById('calFilterCur')?.value || 'ALL';

    const filtered = _calEvents.filter(e => {
        const imp = (e.impact || '').toLowerCase();
        if (imp === 'high' && !_calFilters.high) return false;
        if (imp === 'medium' && !_calFilters.med) return false;
        if (imp === 'low' && !_calFilters.low) return false;
        if (cur !== 'ALL' && (e.currency||'').toUpperCase() !== cur) return false;
        return true;
    });

    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-600">Tidak ada event</td></tr>';
        return;
    }

    const cntEl = document.getElementById('calEventCount');
    if (cntEl) cntEl.textContent = `${filtered.length} events`;

    let lastDay = '';
    body.innerHTML = filtered.map(e => {
        const impLvl = (e.impact||'').toLowerCase();
        const impHtml = impLvl === 'high' ? '<span class="badge-high">High</span>'
                      : impLvl === 'medium' ? '<span class="badge-med">Med</span>'
                      : '<span class="badge-low">Low</span>';

        const actual   = e.actual   ?? '—';
        const forecast = e.forecast ?? '—';
        const previous = e.previous ?? '—';

        // Color actual vs forecast
        let actualCls = 'text-slate-300';
        if (actual !== '—' && forecast !== '—') {
            const a = parseFloat(String(actual).replace(/[^0-9.\-]/g,''));
            const f = parseFloat(String(forecast).replace(/[^0-9.\-]/g,''));
            if (!isNaN(a) && !isNaN(f)) {
                actualCls = a >= f ? 'text-qi-green font-bold' : 'text-qi-red font-bold';
            }
        } else if (actual !== '—') {
            actualCls = 'text-white';
        }

        const eDate = (e.date || '').split('T')[0];
        let dayHeader = '';
        if (eDate !== lastDay) {
            lastDay = eDate;
            const d = new Date(eDate + 'T00:00:00');
            const dayStr = isNaN(d) ? eDate : d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
            const evCount = filtered.filter(x=>(x.date||'').split('T')[0]===eDate).length;
            dayHeader = `<tr class="bg-[#050A14]/80"><td colspan="7" class="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-heading">
                ${dayStr} <span class="text-slate-600 font-normal">${evCount} events</span>
            </td></tr>`;
        }

        const timeStr = e.date ? new Date(e.date).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '—';
        const cur2    = (e.currency||'').toUpperCase();

        return `${dayHeader}<tr class="border-b border-qi-border/30 hover:bg-white/[.015] transition-colors">
            <td class="px-4 py-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">${timeStr}</td>
            <td class="px-3 py-2.5 text-center font-mono font-bold text-[11px] text-white">${cur2}</td>
            <td class="px-3 py-2.5 text-center">${impHtml}</td>
            <td class="px-4 py-2.5 text-[11px] text-slate-200">${e.title || e.event || '—'}</td>
            <td class="px-3 py-2.5 text-right font-mono text-[11px] ${actualCls}">${actual}</td>
            <td class="px-3 py-2.5 text-right font-mono text-[11px] text-slate-400">${forecast}</td>
            <td class="px-3 py-2.5 text-right font-mono text-[11px] text-slate-500">${previous}</td>
        </tr>`;
    }).join('');
}

// ─── Technical Indicator Engine ─────────────────────────────────────────────
function calcEMA(closes, period) {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
    return ema;
}

function calcRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) avgGain += d; else avgLoss -= d;
    }
    avgGain /= period; avgLoss /= period;
    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
    }
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACDHist(closes) {
    if (closes.length < 35) return 0;
    const macdSeries = [];
    for (let i = 26; i <= closes.length; i++) {
        const sl = closes.slice(0, i);
        const e12 = calcEMA(sl, 12), e26 = calcEMA(sl, 26);
        if (e12 !== null && e26 !== null) macdSeries.push(e12 - e26);
    }
    const signal = calcEMA(macdSeries, 9);
    const last   = macdSeries[macdSeries.length - 1] ?? 0;
    return last - (signal ?? 0);
}

function analyzeCandles(candles) {
    if (!candles || candles.length < 55) return null;
    const closes = candles.map(c => c.close);
    const last   = closes[closes.length - 1];
    const ema20  = calcEMA(closes, 20);
    const ema50  = calcEMA(closes, 50);
    const rsi    = calcRSI(closes.slice(-30), 14);
    const macdH  = calcMACDHist(closes.slice(-60));

    let bull = 0, bear = 0;
    if (ema20 !== null && ema50 !== null) {
        if (ema20 > ema50) bull++; else bear++;
        if (last  > ema20) bull++; else bear++;
    }
    if (rsi  > 55) bull++; else if (rsi  < 45) bear++;
    if (macdH > 0) bull++; else if (macdH < 0) bear++;

    const signal = bull >= 3 ? 'BULLISH' : bear >= 3 ? 'BEARISH' : 'NEUTRAL';
    return { signal, rsi: Math.round(rsi), ema20, ema50, macdH, bull, bear };
}

// ─── lightweight-charts Chart ──────────────────────────────────────────────
let _lwChart     = null;
let _lwSeries    = null;
let _lwVolume    = null;   // seri histogram volume (panel bawah chart)
let _lwRsi       = null;
let _lwDrawings  = null;
let _lwTool      = null;
let _tvSymbol    = 'OANDA:BTCUSD';
let _tvSymLabel  = 'BTC/USDT';
let _tvInterval  = '60';
let _chartTab    = 'positions';
let _wlVisible   = true;

// Watchlist groups & symbols
const WL_GROUPS = [
    { label: 'CRYPTO', syms: [
        { label:'BTC/USDT', key:'BTCUSDT',  tv:'OANDA:BTCUSD' },
        { label:'ETH/USDT', key:'ETHUSDT',  tv:'BINANCE:ETHUSDT' },
        { label:'SOL/USDT', key:'SOLUSDT',  tv:'BINANCE:SOLUSDT' },
        { label:'BNB/USDT', key:'BNBUSDT',  tv:'BINANCE:BNBUSDT' },
        { label:'XRP/USDT', key:'XRPUSDT',  tv:'BINANCE:XRPUSDT' },
    ]},
    { label: 'FOREX & EMAS', syms: [
        { label:'XAU/USD', key:'XAUUSD',  tv:'OANDA:XAUUSD' },
        { label:'EUR/USD', key:'EURUSD',  tv:'OANDA:EURUSD' },
        { label:'GBP/USD', key:'GBPUSD',  tv:'OANDA:GBPUSD' },
        { label:'USD/JPY', key:'USDJPY',  tv:'OANDA:USDJPY' },
        { label:'AUD/USD', key:'AUDUSD',  tv:'OANDA:AUDUSD' },
        { label:'USD/CHF', key:'USDCHF',  tv:'OANDA:USDCHF' },
        { label:'USD/CAD', key:'USDCAD',  tv:'OANDA:USDCAD' },
        { label:'GBP/JPY', key:'GBPJPY',  tv:'OANDA:GBPJPY' },
        { label:'EUR/JPY', key:'EURJPY',  tv:'OANDA:EURJPY' },
    ]},
];

function initTvChart() {
    renderWatchlist();
    updateChartHeader();
    renderChartTab();
    buildLwChart();
}

async function buildLwChart() {
    const container = document.getElementById('tv_chart_container');
    if (!container) return;

    // Tunggu modul ES siap. Dulu tidak ada batas waktu sama sekali: bila CDN gagal,
    // chart menunggu selamanya tanpa pesan apa pun (pengguna hanya melihat area kosong).
    // Sekarang: coba CDN cadangan setelah 3 detik, lalu beri pesan jujur setelah 10 detik.
    if (!window._lwModules) {
        window.addEventListener('lc-modules-ready', () => buildLwChart(), { once: true });
        const st = document.getElementById('lwChartStatus');
        if (st) st.textContent = 'Memuat library…';

        if (!window._lwFallbackTimer) {
            let detik = 0;
            window._lwFallbackTimer = setInterval(() => {
                detik += 0.5;
                if (window._lwModules) {
                    clearInterval(window._lwFallbackTimer);
                    window._lwFallbackTimer = null;
                    buildLwChart();
                    return;
                }
                if (detik === 3 && !window._lwFallbackDicoba) {
                    // CDN cadangan (unpkg diizinkan CSP). Alat gambar tidak ikut: sifatnya
                    // opsional, dan chart harus tetap tampil tanpanya.
                    window._lwFallbackDicoba = true;
                    if (st) st.textContent = 'CDN utama lambat — mencoba CDN cadangan…';
                    const s = document.createElement('script');
                    s.type = 'module';
                    s.textContent = "import { createChart, CandlestickSeries, LineSeries, HistogramSeries, LineStyle, CrosshairMode } from 'https://unpkg.com/lightweight-charts@5/+esm';"
                        + "window._lwModules = window._lwModules || { createChart, CandlestickSeries, LineSeries, HistogramSeries, LineStyle, CrosshairMode, DrawingManager: null };"
                        + "window.dispatchEvent(new CustomEvent('lc-modules-ready'));";
                    document.head.appendChild(s);
                }
                if (detik >= 10) {
                    clearInterval(window._lwFallbackTimer);
                    window._lwFallbackTimer = null;
                    if (st) st.textContent = 'Gagal memuat library chart — periksa koneksi internet lalu muat ulang halaman.';
                    console.error('[QI] Library chart tidak dapat dimuat dari CDN utama maupun cadangan.');
                }
            }, 500);
        }
        return;
    }

    const { createChart, CandlestickSeries, HistogramSeries, DrawingManager } = window._lwModules;

    // Destroy existing instance
    if (_lwDrawings) { try { _lwDrawings.destroy(); } catch(e){} _lwDrawings = null; }
    if (_lwChart) {
        // Clear indicator refs (series are removed with the chart)
        _lwEma20 = _lwEma50 = _lwEma200 = null;
        _lwRsi = _lwVolume = null;
        _lwIchiT = _lwIchiK = _lwIchiChi = _lwIchiSA = _lwIchiSB = null;
        _lwPriceLines = [];
        try { _lwChart.remove(); } catch(e){}
        _lwChart = null; _lwSeries = null;
    }
    container.innerHTML = '';

    const cs = getComputedStyle(document.documentElement);
    const chartBg   = cs.getPropertyValue('--qi-chart-bg').trim() || '#0B1220';
    const chartGrid = cs.getPropertyValue('--qi-chart-grid').trim() || '#0F1A2E';
    const chartText = cs.getPropertyValue('--qi-chart-text').trim() || '#64748B';
    const chartCH   = cs.getPropertyValue('--qi-chart-crosshair').trim() || '#00E5FF55';

    _lwChart = createChart(container, {
        autoSize: true,
        layout: {
            background: { color: chartBg },
            textColor: chartText,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
        },
        grid: {
            vertLines: { color: chartGrid },
            horzLines: { color: chartGrid },
        },
        crosshair: {
            mode: 1,
            vertLine: { color: chartCH, width: 1, style: 2, labelBackgroundColor: chartBg },
            horzLine: { color: chartCH, width: 1, style: 2, labelBackgroundColor: chartBg },
        },
        rightPriceScale: {
            borderColor: chartGrid,
            autoScale: true,
            scaleMargins: {
                top: 0.08,
                bottom: 0.12,
            },
        },
        timeScale: {
            borderColor: chartGrid,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: false,
            rightOffset: 12,
            barSpacing: 8,
        },
    });
    _lwChart.timeScale().subscribeVisibleLogicalRangeChange(_renderQimZoneBoxes);
    if (!_qimZoneResizeBound) {
        _qimZoneResizeBound = true;
        window.addEventListener('resize', _renderQimZoneBoxes);
    }

    _lwSeries = _lwChart.addSeries(CandlestickSeries, {
        upColor:        '#26a69a',
        downColor:      '#ef5350',
        borderUpColor:  '#26a69a',
        borderDownColor:'#ef5350',
        wickUpColor:    '#26a69a',
        wickDownColor:  '#ef5350',
    });

    // ── PANEL VOLUME ────────────────────────────────────────────────────────
    // Ditambahkan agar setara dengan chart pembanding: histogram volume di bagian
    // bawah chart, warna mengikuti arah candle. Bila sumber data tidak punya volume
    // (mis. forex/emas → semua 0), panel volume DISEMBUNYIKAN — lebih baik tidak ada
    // daripada menampilkan panel kosong yang membingungkan.
    try {
        _lwVolume = _lwChart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            lastValueVisible: false,
            priceLineVisible: false,
        }, 1);
        _lwVolume.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.02 } });
    } catch (e) {
        _lwVolume = null;
        console.warn('[QI] Panel volume tidak dapat dibuat — chart tetap berjalan.');
    }
    try {
        const { LineSeries } = window._lwModules;
        _lwRsi = _lwChart.addSeries(LineSeries, {
            color: '#b56cff',
            lineWidth: 1,
            title: 'RSI 14',
            priceScaleId: 'rsi',
            lastValueVisible: true,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        }, 2);
        _lwRsi.priceScale().applyOptions({ autoScale: true, scaleMargins: { top: 0.08, bottom: 0.08 } });
        _lwRsi.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
        [30, 70].forEach(level => _lwRsi.createPriceLine({
            price: level, color: '#6b7280aa', lineWidth: 1, lineStyle: 2,
            axisLabelVisible: false, title: ''
        }));
        const panes = _lwChart.panes();
        if (panes[1] && typeof panes[1].setHeight === 'function') panes[1].setHeight(72);
        if (panes[2] && typeof panes[2].setHeight === 'function') panes[2].setHeight(84);
    } catch (e) {
        _lwRsi = null;
        console.warn('[QI] Panel RSI tidak dapat dibuat — chart tetap berjalan.');
    }

    // Terapkan penghalusan tampilan (zona WIB, presisi per instrumen, watermark).
    // Dijaga: bila modul gaya belum siap, chart tetap tampil tanpa penghalusan.
    if (typeof window.terapkanGayaChart === 'function') window.terapkanGayaChart();

    // Alat gambar bersifat OPSIONAL: bila library-nya tidak ada, chart harus tetap
    // tampil (dulu baris ini dipanggil tanpa penjaga sehingga kegagalannya
    // menghentikan seluruh penyiapan chart dan hasilnya chart kosong).
    let drawKey = null;
    if (typeof DrawingManager === 'function') {
        try {
            _lwDrawings = new DrawingManager(_lwChart, _lwSeries, { magnet: 'weak' });

            // Restore drawings for this symbol from localStorage
            drawKey = 'qi_lw_' + _tvSymbol.replace(/[^a-z0-9]/gi, '_');
            try { const saved = localStorage.getItem(drawKey); if (saved) _lwDrawings.importJSON(saved); } catch(e){}
            _lwDrawings.on('change', () => {
                try { localStorage.setItem(drawKey, _lwDrawings.exportJSON()); } catch(e){}
            });
        } catch (e) {
            console.warn('[QI] Alat gambar tidak dapat diaktifkan — chart tetap berjalan.');
            _lwDrawings = null;
        }
    }

    // ─── Legenda OHLC mengikuti kursor (#1) ──────────────────────────────────
    // Tanpa ini, bar OHLC hanya menampilkan candle terakhir sehingga pengguna tidak
    // bisa membaca nilai candle yang sedang ditunjuk. Saat kursor keluar, nilai live
    // dikembalikan oleh updateOhlcBar().
    try {
        _lwChart.subscribeCrosshairMove(param => {
            const keluar = () => { if (_ohlcHover) { _ohlcHover = false; updateOhlcBar(); } };
            if (!param || !param.time || !param.seriesData || typeof param.seriesData.get !== 'function') { keluar(); return; }
            const cd = param.seriesData.get(_lwSeries);
            if (!cd || cd.open === undefined || cd.close === undefined) { keluar(); return; }
            _ohlcHover = true;
            renderOhlcFromCandle(cd, true);
            updateOhlcSourceBadge();
        });
    } catch (e) {}

    const st = document.getElementById('lwChartStatus');
    if (st) st.textContent = 'Menyiapkan chart…';
    await lwFetchAndSetData();
    if (st) st.textContent = _tvSymLabel + ' · ' + ({'1':'1m','5':'5m','15':'M15','30':'30m','60':'H1','240':'H4','D':'D1','W':'W1','MN':'MN1'}[_tvInterval]||_tvInterval);
}

async function lwFetchAndSetData() {
    if (!_lwSeries) return;
    const allSyms = WL_GROUPS.flatMap(g => g.syms);
    const found   = allSyms.find(s => s.tv === _tvSymbol);
    if (!found) return;
    const st = document.getElementById('lwChartStatus');
    try {
        if (st) st.textContent = 'Memuat data…';
        const res  = await fetch(`api/get-chart-data.php?symbol=${found.key}&interval=${_tvInterval}`);
        const data = await res.json();
        const candles = (data.candles || []).filter(c => c.time && c.open);
        if (!candles.length) { if (st) st.textContent = 'Tidak ada data'; return; }
        // PENTING (integritas data): `.filter()` menghasilkan array BARU sehingga
        // properti `simulated` dari server HILANG. Akibatnya 9 mesin tidak bisa tahu
        // bahwa candle yang dinilai adalah candle ACAK (data simulasi) dan bisa
        // menampilkan "sinyal" dari data karangan. Penanda diteruskan di sini.
        if (data.simulated === true) candles.simulated = true;
        _lwSeries.setData(candles);
        perbaruiVolume(candles);
        if (_lwRsi) _lwRsi.setData(_calcRSI(candles, 14));
        _lwLastCandles = candles;
        _lwCandlesMeta  = { source: data.source || '', generatedAt: data.generated_at || '' };
        // KEJELASAN CHART: sebelumnya `fitContent()` memuat SEMUA bar (sering 300–500),
        // sehingga candle menjadi sangat tipis dan chart terasa "tidak jelas".
        // Sekarang tampilan awal dibatasi ~180 bar terakhir (kepadatan seperti
        // TradingView); tombol "Fit" di bilah chart tetap bisa menampilkan semuanya.
        // Zoom pengguna tidak diganggu: hanya diterapkan saat muat/berganti simbol.
        try {
            const jumlah = candles.length;
            if (jumlah > 220) {
                _lwChart.timeScale().setVisibleLogicalRange({ from: jumlah - 180, to: jumlah + 4 });
            } else {
                _lwChart.timeScale().fitContent();
            }
        } catch (e) {
            try { _lwChart.timeScale().fitContent(); } catch (e2) {}
        }
        if (st) st.textContent = _tvSymLabel + ' · ' + ({'1':'1m','5':'5m','15':'M15','30':'30m','60':'H1','240':'H4','D':'D1','W':'W1','MN':'MN1'}[_tvInterval]||_tvInterval) + ' · ' + candles.length + ' bar';
        drawAutoIndicators(candles);
    } catch(e) {
        // Pesan ramah untuk pengguna; detail teknis cukup di konsol agar tidak
        // membocorkan internal dan tidak membingungkan.
        console.error('[QI Chart] gagal memuat candle:', e);
        if (st) st.textContent = 'Gagal memuat data chart. Coba ganti timeframe atau muat ulang.';
    }
}

// ─── Auto Indicator State ────────────────────────────────────────────────────
let _lwEma20 = null, _lwEma50 = null, _lwEma200 = null;
let _lwBbUpper = null, _lwBbMiddle = null, _lwBbLower = null;
let _lwIchiT = null, _lwIchiK = null, _lwIchiChi = null, _lwIchiSA = null, _lwIchiSB = null;
let _lwPriceLines = [];
let _lwSDLines = [];
let _qimSupplyDemandZones = [];
let _qimZoneOverlay = null;
let _qimZoneResizeBound = false;
let _indicatorsEnabled = true;
let _lwLastCandles = [];

/**
 * Panel volume: histogram di bawah chart, warna mengikuti arah candle.
 * Bila sumber data tidak menyediakan volume (forex/emas → 0), panel DISEMBUNYIKAN
 * supaya tidak ada panel kosong yang membingungkan. Tidak ada angka karangan.
 */
/**
 * Pemasang marker yang bekerja di lightweight-charts **v4 DAN v5**.
 *   v4 → series.setMarkers(markers)
 *   v5 → createSeriesMarkers(series, markers)   (setMarkers dihapus di v5)
 * Mengembalikan true/false supaya pemanggil bisa melaporkan dengan JUJUR —
 * bukan mengira marker terpasang padahal gagal (kejadian nyata sebelum ini).
 */
let _primitiveMarker = null;
function pasangMarker(series, markers) {
    try {
        if (!series) return false;
        const daftar = markers || [];
        if (typeof series.setMarkers === 'function') { series.setMarkers(daftar); return true; }
        const pabrik = window._lwModules && window._lwModules.createSeriesMarkers;
        if (typeof pabrik === 'function') {
            if (_primitiveMarker && typeof _primitiveMarker.setMarkers === 'function') {
                _primitiveMarker.setMarkers(daftar);
            } else {
                _primitiveMarker = pabrik(series, daftar);
            }
            return true;
        }
        console.warn('[QI] Tidak ada cara memasang marker pada versi library ini.');
    } catch (e) {
        console.warn('[QI] Marker gagal dipasang:', e && e.message ? e.message : e);
    }
    return false;
}

function perbaruiVolume(candles) {    try {
        if (!_lwVolume || !Array.isArray(candles) || !candles.length) return;
        const adaVolume = candles.some(c => Number(c.volume) > 0);
        if (!adaVolume) {
            _lwVolume.setData([]);
            _lwVolume.applyOptions({ visible: false });
            return;
        }
        _lwVolume.applyOptions({ visible: true });
        _lwVolume.setData(candles.map(c => ({
            time: c.time,
            value: Number(c.volume) || 0,
            color: (Number(c.close) >= Number(c.open)) ? 'rgba(38,166,154,0.42)' : 'rgba(239,83,80,0.42)'
        })));
    } catch (e) { /* panel volume tidak boleh mengganggu chart */ }
}

// ─── Indicator Calculations ──────────────────────────────────────────────────
function _calcEMA(candles, period) {
    if (candles.length < period) return [];
    const k = 2 / (period + 1);
    let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
    const result = [{ time: candles[period - 1].time, value: ema }];
    for (let i = period; i < candles.length; i++) {
        ema = candles[i].close * k + ema * (1 - k);
        result.push({ time: candles[i].time, value: ema });
    }
    return result;
}

function _calcRSI(candles, period) {
    if (candles.length <= period) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = candles[i].close - candles[i - 1].close;
        gains += Math.max(change, 0);
        losses += Math.max(-change, 0);
    }
    let avgGain = gains / period, avgLoss = losses / period;
    const value = () => avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    const result = [{ time: candles[period].time, value: value() }];
    for (let i = period + 1; i < candles.length; i++) {
        const change = candles[i].close - candles[i - 1].close;
        avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
        result.push({ time: candles[i].time, value: value() });
    }
    return result;
}

function _calcBollingerBands(candles, period, multiplier) {
    const upper = [], middle = [], lower = [];
    for (let i = period - 1; i < candles.length; i++) {
        const window = candles.slice(i - period + 1, i + 1);
        const mean = window.reduce((sum, candle) => sum + candle.close, 0) / period;
        const variance = window.reduce((sum, candle) => sum + Math.pow(candle.close - mean, 2), 0) / period;
        const deviation = Math.sqrt(variance) * multiplier;
        const time = candles[i].time;
        upper.push({ time, value: mean + deviation });
        middle.push({ time, value: mean });
        lower.push({ time, value: mean - deviation });
    }
    return { upper, middle, lower };
}

function _calcIchimoku(candles) {
    const tenkan = [], kijun = [], chikou = [];
    const n = candles.length;
    for (let i = 8; i < n; i++) {
        const sl9 = candles.slice(i - 8, i + 1);
        const hi9 = Math.max(...sl9.map(c => c.high)), lo9 = Math.min(...sl9.map(c => c.low));
        tenkan.push({ time: candles[i].time, value: (hi9 + lo9) / 2 });
    }
    for (let i = 25; i < n; i++) {
        const sl26 = candles.slice(i - 25, i + 1);
        const hi26 = Math.max(...sl26.map(c => c.high)), lo26 = Math.min(...sl26.map(c => c.low));
        kijun.push({ time: candles[i].time, value: (hi26 + lo26) / 2 });
    }
    for (let i = 26; i < n; i++) chikou.push({ time: candles[i - 26].time, value: candles[i].close });
    return { tenkan, kijun, chikou };
}

function _calcSRLevels(candles, lookback) {
    const recent = candles.slice(-lookback);
    const cur = recent[recent.length - 1].close;
    const pivotH = [], pivotL = [];
    for (let i = 3; i < recent.length - 3; i++) {
        if (recent[i].high > recent[i-1].high && recent[i].high > recent[i-2].high &&
            recent[i].high > recent[i+1].high && recent[i].high > recent[i+2].high) pivotH.push(recent[i].high);
        if (recent[i].low < recent[i-1].low && recent[i].low < recent[i-2].low &&
            recent[i].low < recent[i+1].low && recent[i].low < recent[i+2].low) pivotL.push(recent[i].low);
    }
    const cluster = lvls => {
        const out = []; lvls.sort((a,b) => a-b);
        for (const l of lvls) {
            const last = out[out.length - 1];
            if (last && Math.abs(l - last) / last < 0.004) out[out.length-1] = (last+l)/2; else out.push(l);
        }
        return out;
    };
    return {
        support:    cluster(pivotL.filter(l => l < cur)).slice(-4),
        resistance: cluster(pivotH.filter(l => l > cur)).slice(0, 4)
    };
}

function _renderQimZoneBoxes() {
    if (!_lwChart || !_lwSeries || !_qimSupplyDemandZones.length) {
        if (_qimZoneOverlay) _qimZoneOverlay.replaceChildren();
        return;
    }
    const container = document.getElementById('tv_chart_container');
    if (!container) return;
    if (!_qimZoneOverlay || !_qimZoneOverlay.isConnected) {
        _qimZoneOverlay = document.createElement('div');
        _qimZoneOverlay.className = 'qim-chart-zone-overlay';
        _qimZoneOverlay.setAttribute('aria-hidden', 'true');
        container.appendChild(_qimZoneOverlay);
    }
    _qimZoneOverlay.replaceChildren();
    const timeScale = _lwChart.timeScale();
    const displayZones = ['supply', 'demand']
        .map(type => [..._qimSupplyDemandZones].reverse().find(zone => zone.type === type))
        .filter(Boolean);
    displayZones.forEach(zone => {
        const x = timeScale.timeToCoordinate(zone.time);
        const yHigh = _lwSeries.priceToCoordinate(zone.high);
        const yLow = _lwSeries.priceToCoordinate(zone.low);
        if (x === null || yHigh === null || yLow === null) return;
        const left = Math.max(0, x);
        if (left >= container.clientWidth - 60) return;
        const supply = zone.type === 'supply';
        const box = document.createElement('div');
        box.className = `qim-chart-zone ${supply ? 'supply' : 'demand'}`;
        box.style.left = `${left}px`;
        box.style.right = '58px';
        box.style.top = `${Math.min(yHigh, yLow)}px`;
        box.style.height = `${Math.max(3, Math.abs(yLow - yHigh))}px`;
        box.textContent = `${supply ? 'Supply' : 'Demand'} Zone`;
        _qimZoneOverlay.appendChild(box);
    });
}

function _calcFibLevels(candles, lookback) {
    const recent = candles.slice(-lookback);
    let high = -Infinity, low = Infinity;
    recent.forEach(c => { high = Math.max(high, c.high); low = Math.min(low, c.low); });
    return (high > low) ? { high, low } : null;
}

function _calcGoldenCross(candles) {
    const ema20 = _calcEMA(candles, 20), ema50 = _calcEMA(candles, 50);
    if (!ema50.length) return [];
    const diff = ema50.length - ema20.length; // ema20 starts earlier
    const markers = [];
    for (let i = 1; i < ema50.length; i++) {
        const i20 = i - diff;
        if (i20 < 1) continue;
        const p20 = ema20[i20-1]?.value, c20 = ema20[i20]?.value;
        const p50 = ema50[i-1]?.value,  c50 = ema50[i]?.value;
        if (!p20 || !c20 || !p50 || !c50) continue;
        if (p20 <= p50 && c20 > c50) markers.push({ time: ema50[i].time, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: 'GX' });
        else if (p20 >= p50 && c20 < c50) markers.push({ time: ema50[i].time, position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: 'DX' });
    }
    return markers.slice(-15);
}

function _getIndSetting(id) { const el = document.getElementById(id); return el ? el.dataset.on === 'true' : true; }

function toggleIndBtn(btn) {
    const isOn = btn.dataset.on === 'true';
    btn.dataset.on = isOn ? 'false' : 'true';
    btn.classList.toggle('active', !isOn);
    applyIndSettings();
}

async function drawAutoIndicators(candles) {
    if (!_lwChart || !_lwSeries || !candles.length || !window._lwModules) return;
    const { LineSeries } = window._lwModules;
    if (!LineSeries) return;
    clearIndicators();
    if (!_indicatorsEnabled) return;

    const addLine = (data, color, width, title) => {
        if (!data || !data.length) return null;
        try {
            const s = _lwChart.addSeries(LineSeries, { color, lineWidth: width, title,
                lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
            s.setData(data);
            return s;
        } catch(e) { return null; }
    };

    if (_getIndSetting('indEMA20'))  _lwEma20  = addLine(_calcEMA(candles, 20),  '#F59E0B', 1, 'EMA20');
    if (_getIndSetting('indEMA50'))  _lwEma50  = addLine(_calcEMA(candles, 50),  '#3B82F6', 1, 'EMA50');
    if (_getIndSetting('indEMA200')) _lwEma200 = addLine(_calcEMA(candles, 200), '#F97316', 2, 'EMA200');
    const bb = _calcBollingerBands(candles, 20, 2);
    _lwBbUpper = addLine(bb.upper, '#7088a888', 1, 'BB Upper');
    _lwBbMiddle = addLine(bb.middle, '#8795a688', 1, 'BB Basis');
    _lwBbLower = addLine(bb.lower, '#7088a888', 1, 'BB Lower');

    if (_getIndSetting('indIchi')) {
        const ichi = _calcIchimoku(candles);
        _lwIchiT   = addLine(ichi.tenkan, '#EF4444BB', 1, 'Tenkan');
        _lwIchiK   = addLine(ichi.kijun,  '#1D4ED8BB', 1, 'Kijun');
        _lwIchiChi = addLine(ichi.chikou, '#6B728088', 1, 'Chikou');
    }

    if (_getIndSetting('indSR')) {
        const lb = Math.min(candles.length, 120);
        const sr = _calcSRLevels(candles, lb);
        sr.support.forEach(p => {
            try { _lwPriceLines.push(_lwSeries.createPriceLine({ price: p, color: '#00C853BB', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'S' })); } catch(e){}
        });
        sr.resistance.forEach(p => {
            try { _lwPriceLines.push(_lwSeries.createPriceLine({ price: p, color: '#FF1744BB', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'R' })); } catch(e){}
        });
    }

    if (_getIndSetting('indFib')) {
        const fib = _calcFibLevels(candles, Math.min(candles.length, 150));
        if (fib) {
            const range = fib.high - fib.low;
            [[0,'0%'],[0.236,'23.6%'],[0.382,'38.2%'],[0.5,'50%'],[0.618,'61.8%'],[0.786,'78.6%'],[1,'100%']].forEach(([r, t]) => {
                try { _lwPriceLines.push(_lwSeries.createPriceLine({ price: fib.low + range * r, color: '#FFD700AA', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `Fib ${t}` })); } catch(e){}
            });
        }
    }

    if (_getIndSetting('indGX')) {
        const crosses = _calcGoldenCross(candles);
        if (crosses.length) { pasangMarker(_lwSeries, crosses); }
    }

    if (_getIndSetting('indSND')) {
        const zones = _detectSDZones(candles);
        _qimSupplyDemandZones = zones;
        zones.forEach(z => {
            const isSupply = z.type === 'supply';
            const col = isSupply ? '#ef5350cc' : '#26a69acc';
            const label = isSupply ? `Supply ${z.label}` : `Demand ${z.label}`;
            try {
                _lwSDLines.push(_lwSeries.createPriceLine({ price: z.high, color: col, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: label }));
                _lwSDLines.push(_lwSeries.createPriceLine({ price: z.low,  color: col, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' }));
            } catch(e) {}
        });
        _renderQimZoneBoxes();
    }

    if (_getIndSetting('indVP')) {
        const vp = _calcVolumeProfile(candles);
        if (vp && vp.poc) {
            try {
                _lwVPLines.push(_lwSeries.createPriceLine({ price: vp.poc, color: '#A855F7', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: `POC: ${vp.poc.toFixed(2)}` }));
                _lwVPLines.push(_lwSeries.createPriceLine({ price: vp.vah, color: '#38BDF8AA', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `VAH: ${vp.vah.toFixed(2)}` }));
                _lwVPLines.push(_lwSeries.createPriceLine({ price: vp.val, color: '#38BDF8AA', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `VAL: ${vp.val.toFixed(2)}` }));
            } catch(e) {}
        }
    }
}

let _lwVPLines = [];

function _calcVolumeProfile(candles) {
    if (!candles || candles.length < 10) return null;
    const recent = candles.slice(-120);
    let minP = Infinity, maxP = -Infinity;
    recent.forEach(c => { minP = Math.min(minP, c.low); maxP = Math.max(maxP, c.high); });
    if (minP >= maxP) return null;

    const numBins = 28;
    const binSize = (maxP - minP) / numBins;
    const bins = new Array(numBins).fill(0);

    recent.forEach(c => {
        const vol = c.volume || Math.abs(c.close - c.open) * 100 || 1;
        const mid = (c.high + c.low) / 2;
        const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor((mid - minP) / binSize)));
        bins[binIdx] += vol;
    });

    let maxVol = -1, maxIdx = 0, totalVol = 0;
    bins.forEach((v, idx) => {
        totalVol += v;
        if (v > maxVol) { maxVol = v; maxIdx = idx; }
    });

    const poc = minP + (maxIdx + 0.5) * binSize;

    // Value Area: 70% of total volume centered around POC
    let currentVol = bins[maxIdx];
    let upIdx = maxIdx + 1, downIdx = maxIdx - 1;
    while (currentVol < totalVol * 0.7 && (upIdx < numBins || downIdx >= 0)) {
        const upVol = upIdx < numBins ? bins[upIdx] : -1;
        const downVol = downIdx >= 0 ? bins[downIdx] : -1;
        if (upVol >= downVol && upIdx < numBins) {
            currentVol += upVol; upIdx++;
        } else if (downIdx >= 0) {
            currentVol += downVol; downIdx--;
        } else break;
    }
    const val = minP + Math.max(0, downIdx + 1) * binSize;
    const vah = minP + Math.min(numBins, upIdx) * binSize;

    return { poc, vah, val, bins };
}

function _detectSDZones(candles) {
    const zones = [];
    const n = candles.length;
    const lookback = Math.min(n, 200);
    const start = n - lookback;

    for (let i = start + 1; i < n - 2; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        const next = candles[i + 1];

        const currBody  = Math.abs(curr.close - curr.open);
        const currRange = curr.high - curr.low || 1;
        const nextBody  = Math.abs(next.close - next.open);
        const nextRange = next.high - next.low || 1;

        const isBase       = currBody < currRange * 0.35;
        const isImpulsive  = nextBody > currRange * 1.2 && nextRange > currRange * 0.8;
        if (!isBase || !isImpulsive) continue;

        const zoneHigh = Math.max(curr.high, prev.high);
        const zoneLow  = Math.min(curr.low,  prev.low);

        const laterCandles = candles.slice(i + 2);
        const isFreshSupply = !laterCandles.some(c => c.low <= zoneHigh && c.high >= zoneLow);
        const isFreshDemand = !laterCandles.some(c => c.high >= zoneLow && c.low <= zoneHigh);

        const priceScale = zoneHigh > 1000 ? 0 : zoneHigh > 10 ? 2 : 5;
        const midLabel = ((zoneHigh + zoneLow) / 2).toFixed(priceScale);

        if (next.close < next.open && isFreshSupply) {
            zones.push({ type: 'supply', high: zoneHigh, low: zoneLow, label: midLabel, time: curr.time });
        } else if (next.close > next.open && isFreshDemand) {
            zones.push({ type: 'demand', high: zoneHigh, low: zoneLow, label: midLabel, time: curr.time });
        }
    }
    return zones.slice(-8);
}

function clearIndicators() {
    [_lwEma20, _lwEma50, _lwEma200, _lwBbUpper, _lwBbMiddle, _lwBbLower, _lwIchiT, _lwIchiK, _lwIchiChi, _lwIchiSA, _lwIchiSB].forEach(s => {
        if (s && _lwChart) { try { _lwChart.removeSeries(s); } catch(e){} }
    });
    _lwEma20 = _lwEma50 = _lwEma200 = _lwBbUpper = _lwBbMiddle = _lwBbLower = _lwIchiT = _lwIchiK = _lwIchiChi = _lwIchiSA = _lwIchiSB = null;
    _lwPriceLines.forEach(pl => { if (_lwSeries) { try { _lwSeries.removePriceLine(pl); } catch(e){} } });
    _lwPriceLines = [];
    _lwSDLines.forEach(pl => { if (_lwSeries) { try { _lwSeries.removePriceLine(pl); } catch(e){} } });
    _lwSDLines = [];
    _qimSupplyDemandZones = [];
    if (_qimZoneOverlay) _qimZoneOverlay.replaceChildren();
    _lwVPLines.forEach(pl => { if (_lwSeries) { try { _lwSeries.removePriceLine(pl); } catch(e){} } });
    _lwVPLines = [];
    if (_lwSeries) { pasangMarker(_lwSeries, []); }
}

function applyIndSettings() {
    const anyOn = ['indEMA20','indEMA50','indEMA200','indIchi','indSR','indFib','indGX','indSND','indVP'].some(id => _getIndSetting(id));
    _indicatorsEnabled = anyOn;
    const btn = document.getElementById('lwIndBtn');
    if (btn) btn.classList.toggle('text-qi-cyan', anyOn);
    // Use cached candles — no re-fetch needed
    if (_lwLastCandles.length) {
        clearIndicators();
        if (_indicatorsEnabled) drawAutoIndicators(_lwLastCandles);
    } else if (_indicatorsEnabled) {
        lwFetchAndSetData();
    } else {
        clearIndicators();
    }
}

function setAllInds(on) {
    ['indEMA20','indEMA50','indEMA200','indIchi','indSR','indFib','indGX','indSND','indVP'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.dataset.on = on ? 'true' : 'false'; el.classList.toggle('active', on); }
    });
    applyIndSettings();
}

function toggleIndicators() { applyIndSettings(); }

// ─── Chart Screenshot + AI Analysis ─────────────────────────────────────────
async function chartScreenshot() {
    const container = document.getElementById('tv_chart_container');
    if (!container) return;
    // Use native canvas export if available
    let imageData = null;
    if (_lwChart && _lwChart.takeScreenshot) {
        try {
            const canvas = _lwChart.takeScreenshot();
            imageData = canvas.toDataURL('image/png');
        } catch(e) {}
    }
    if (!imageData) { showQuantumToast('Chart screenshot tidak tersedia.', 'warning'); return; }

    // Show preview modal + AI analysis
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[9998] flex items-center justify-center p-4';
    modal.style.background = 'rgba(0,0,0,0.85)';
    modal.innerHTML = `
        <div class="bg-qi-panel border border-qi-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div class="px-5 py-4 border-b border-qi-border flex items-center justify-between">
                <div class="font-heading font-bold text-white text-sm">📷 Screenshot Chart + AI Analisis</div>
                <button onclick="this.closest('.fixed').remove()" class="text-slate-500 hover:text-white text-lg">✕</button>
            </div>
            <div class="p-4">
                <img src="${imageData}" class="w-full rounded-xl border border-qi-border mb-4" alt="Chart Screenshot">
                <div id="ssAiResult" class="bg-qi-card border border-qi-border rounded-xl p-4 text-sm text-slate-300">
                    <div class="flex items-center gap-2 text-qi-cyan font-mono text-xs animate-pulse">⏳ QUANTUM AI sedang menganalisa chart...</div>
                <div class="mt-4 pt-3 border-t border-qi-border/60 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <a href="${imageData}" download="quantum-setup-${_tvSymLabel.replace(/[^A-Za-z0-9]/g,'')}-${Date.now()}.png" class="px-3 py-1.5 rounded-lg bg-qi-cyan/20 border border-qi-cyan/40 text-qi-cyan text-[11px] font-semibold hover:bg-qi-cyan/30 transition-all flex items-center gap-1">
                            💾 Unduh Gambar Setup
                        </a>
                        <button onclick="generateViralShareCard('${imageData}')" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-semibold hover:brightness-110 transition-all flex items-center gap-1 shadow-md">
                            📱 Buat Viral Share Card (Medsos)
                        </button>
                    </div>
                    <button onclick="navigator.clipboard?.writeText(window.location.href);showQuantumToast('Link analisa disalin!','success');" class="text-[10px] text-slate-400 hover:text-white">🔗 Salin Link</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    // Request AI analysis
    const sym = document.getElementById('lwSymSel')?.value || _lwSymbol || 'XAU/USD';
    const tf  = document.querySelector('.tf-btn.active')?.textContent || 'H1';
    const context = {};
    if (Object.keys(_lastPrices).length)  context.prices  = Object.fromEntries(Object.entries(_lastPrices).slice(0,10).map(([k,v])=>[k,{price:v.price}]));
    if (Object.keys(_lastSignals).length) context.signals = _lastSignals;

    try {
        const r = await fetch('api/ai-chat.php', {
            method: 'POST', headers: QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                message: `Analisa chart ${sym} timeframe ${tf}. Berikan: 1) BIAS PASAR saat ini (Bullish/Bearish/Sideway), 2) Level kunci yang terlihat (S/R, EMA, Fib), 3) Setup ENTRY terbaik: arah BUY atau SELL, level entry, Stop Loss di mana, Take Profit di mana, dan alasannya. Jawab dalam bahasa Indonesia, singkat dan actionable.`,
                history: [], context
            })
        });
        const j = await r.json();
        const el = document.getElementById('ssAiResult');
        if (el) { var _t = (j.reply || j.message || 'Analisis tidak tersedia').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); el.innerHTML = `<div class="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-200">${_t}</div>`; }
    } catch(e) {
        const el = document.getElementById('ssAiResult');
        if (el) el.innerHTML = '<div class="text-red-400 text-xs">AI analisis error — coba lagi.</div>';
    }
}

function generateViralShareCard(chartImgData) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 700);
    grad.addColorStop(0, '#040814');
    grad.addColorStop(1, '#0b1329');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 700);

    // Header Branding
    ctx.fillStyle = '#00E5FF';
    ctx.font = 'bold 26px "Space Grotesk", sans-serif';
    ctx.fillText('⚡ QUANTUM INSTITUT MARKET TERMINAL', 40, 50);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px "JetBrains Mono", monospace';
    const pair = _tvSymLabel || 'XAU/USD';
    const tf = ({'1':'1m','5':'5m','15':'M15','30':'30m','60':'H1','240':'H4','D':'D1','W':'W1','MN':'MN1'}[_tvInterval] || _tvInterval);
    const dateStr = new Date().toLocaleString('id-ID');
    ctx.fillText(`SETUP ANALYSIS: ${pair} · ${tf} · ${dateStr}`, 40, 78);

    // Draw Chart Image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        ctx.drawImage(img, 40, 95, 1120, 520);

        // Watermark Border Frame
        ctx.strokeStyle = '#00E5FF33';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 95, 1120, 520);

        // Footer Viral Badge
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 15px "Inter", sans-serif';
        ctx.fillText('🌐 https://quantum-institut.com  |  Join Institutional VIP Signal Hub', 40, 655);

        ctx.fillStyle = '#64748B';
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('9 Quantitative Engines · SMC · POC · Real-Time Market Intelligence', 1160, 655);

        // Trigger Download
        const cardData = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = cardData;
        a.download = `quantum-viral-setup-${pair.replace(/[^A-Za-z0-9]/g,'')}.png`;
        a.click();
        if (window.showQuantumToast) showQuantumToast('Viral Share Card siap di-share ke Medsos!', 'success');
    };
    img.src = chartImgData;
}

function setChartTool(kind) {
    _lwTool = kind || null;
    if (_lwDrawings) _lwDrawings.setTool(kind);
    document.querySelectorAll('.lw-draw-btn').forEach(b => {
        const isActive = (b.dataset.tool || '') === (kind || '');
        b.className = 'lw-draw-btn shrink-0 px-2 py-1 rounded border text-[11px] font-mono' +
            (isActive ? ' active' : ' border-qi-border text-slate-400');
        if (!isActive && b.dataset.tool === 'fib-retracement') b.className = b.className.replace('text-[11px] font-mono', 'text-[10px]');
        if (!isActive && (b.dataset.tool === 'ray' || b.dataset.tool === 'extended-line')) b.className = b.className.replace('text-[11px] font-mono', 'text-[10px] font-mono');
        if (!isActive && b.dataset.tool === 'text') b.className = b.className.replace('font-mono', 'font-mono font-bold');
    });
}

function lwDeleteSelected() {
    if (!_lwDrawings) return;
    _lwDrawings.selection().forEach(id => _lwDrawings.remove(id));
}

function lwClearAll() {
    if (!_lwDrawings) return;
    _lwDrawings.clear();
    try { localStorage.removeItem('qi_lw_' + _tvSymbol.replace(/[^a-z0-9]/gi, '_')); } catch(e){}
}

function setChartSymbolFull(key, tvSym, label) {
    _tvSymbol   = tvSym;
    _tvSymLabel = label;
    updateChartHeader();
    renderWatchlist();
    buildLwChart();
}

function selectChartSym(sym) {
    if (!sym) return;
    const cleanSym = String(sym).trim().toUpperCase();
    const allSyms = WL_GROUPS.flatMap(g => g.syms);
    let found = allSyms.find(s => s.key === cleanSym || s.label.replace(/[^A-Z0-9]/gi, '') === cleanSym);
    if (!found) {
        // Fallback matching
        found = allSyms.find(s => s.key.includes(cleanSym) || cleanSym.includes(s.key));
    }
    if (found) {
        setChartSymbolFull(found.key, found.tv, found.label);
    } else {
        // Construct fallback symbol
        const isCrypto = cleanSym.includes('USDT') || cleanSym.includes('BTC') || cleanSym.includes('ETH');
        const tvPrefix = isCrypto ? 'BINANCE:' : 'OANDA:';
        const formattedLabel = cleanSym.length === 6 ? cleanSym.slice(0,3) + '/' + cleanSym.slice(3) : cleanSym;
        setChartSymbolFull(cleanSym, tvPrefix + cleanSym, formattedLabel);
    }
}
window.selectChartSym = selectChartSym;
window.setChartSymbolFull = setChartSymbolFull;

function updateChartHeader() {
    const symEl   = document.getElementById('chartCurSym');
    const pEl     = document.getElementById('chartCurPrice');
    const chgEl   = document.getElementById('chartCurChg');
    const ordSym  = document.getElementById('chartOrderSym');
    const ordPrc  = document.getElementById('chartOrderPrice');
    if (symEl) symEl.textContent = _tvSymLabel;
    // Update OHLC bar
    const ohlcSym = document.getElementById('ohlcSym');
    const ohlcTf  = document.getElementById('ohlcTf');
    if (ohlcSym) ohlcSym.textContent = _tvSymLabel;
    if (ohlcTf)  ohlcTf.textContent  = {'1':'1m','5':'5m','15':'15m','30':'30m','60':'1h','240':'4h','D':'1D','W':'1W','MN':'1M'}[_tvInterval] || _tvInterval;
    updateOhlcBar();
    // find key for this tv symbol
    const allSyms = WL_GROUPS.flatMap(g => g.syms);
    const found   = allSyms.find(s => s.tv === _tvSymbol);
    if (found && _lastPrices[found.key]) {
        const p = _lastPrices[found.key];
        if (pEl)    pEl.textContent  = parseFloat(p.price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:5});
        if (chgEl)  { const c = parseFloat(p.chgPct||0); chgEl.textContent = (c>=0?'+':'')+c.toFixed(2)+'%'; chgEl.className = 'font-mono text-[11px] '+(c>=0?'text-qi-green':'text-qi-red'); }
        if (ordPrc) ordPrc.textContent = parseFloat(p.price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:5});
    } else {
        if (pEl)    pEl.textContent  = '—';
        if (chgEl)  chgEl.textContent = '';
        if (ordPrc) ordPrc.textContent = '—';
    }
    if (ordSym) ordSym.textContent = _tvSymLabel;
    document.dispatchEvent(new CustomEvent('qim:chart-symbol', {
        detail: { symbol: found ? found.key : _tvSymLabel.replace(/[^A-Z0-9]/gi, '').toUpperCase() }
    }));
}

function renderWatchlist(query) {
    const body = document.getElementById('watchlistBody');
    if (!body) return;
    const q = (query || '').toLowerCase();
    let html = '';
    for (const grp of WL_GROUPS) {
        const rows = grp.syms.filter(s => !q || s.label.toLowerCase().includes(q));
        if (!rows.length) continue;
        html += `<div class="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-qi-border/40 bg-qi-panel/40">${grp.label}</div>`;
        for (const s of rows) {
            const isActive = s.tv === _tvSymbol;
            const p = _lastPrices[s.key];
            const price = p ? parseFloat(p.price) : null;
            const chg   = p ? parseFloat(p.chgPct||0) : null;
            const chgCls = chg === null ? 'text-slate-500' : chg >= 0 ? 'text-qi-green' : 'text-qi-red';
            const chgStr = chg === null ? '—' : (chg>=0?'+':'')+chg.toFixed(2)+'%';
            const priceStr = price === null ? '—' : price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:5});
            html += `<div onclick="setChartSymbolFull('${s.key}','${s.tv}','${s.label}')"
                class="wl-row${isActive?' active-sym':''} flex items-center justify-between px-3 py-2 border-b border-qi-border/20">
                <div>
                    <div class="font-mono font-bold text-[11px] ${isActive?'text-qi-cyan':'text-white'}">${s.label}</div>
                </div>
                <div class="text-right">
                    <div class="font-mono text-[11px] text-white">${priceStr}</div>
                    <div class="font-mono text-[9px] ${chgCls}">${chgStr}</div>
                </div>
            </div>`;
        }
    }
    body.innerHTML = html || '<div class="px-3 py-4 text-center text-slate-600 text-[10px]">Tidak ditemukan</div>';
}

function filterWatchlist() {
    const q = document.getElementById('watchlistSearch')?.value || '';
    renderWatchlist(q);
}

let _bottomPanelVisible = true;
// ── MODE CHART: engine Quantum ⟷ chart RESMI TradingView ─────────────────────
// Permintaan pengguna: "chart harganya ikut TradingView… tapi Mesin 9 tetap jalan".
// Kenyataannya chart TradingView adalah iframe milik mereka, sehingga kotak/garis
// engine TIDAK BISA digambar di atasnya. Maka disediakan dua mode:
//   · quantum     → chart engine (lightweight-charts) + 9 mesin BISA menggambar
//   · tradingview → chart resmi TradingView (widget Advanced Chart, tema gelap)
// Panel Mesin 9 TETAP dihitung pada kedua mode; menekan "Gambar" saat mode
// TradingView otomatis berpindah ke mode quantum dengan pemberitahuan jujur.
let _modeChart = 'quantum';
// Simbol TradingView: aplikasi ini SUDAH menyimpan simbol TradingView di _tvSymbol
// dengan format "BURSA:TIKER" (mis. OANDA:XAUUSD, BINANCE:BTCUSDT) — lihat
// setChartSymbolFull() dan WL_GROUPS[].tv.
// ⚠️ BUG YANG DIPERBAIKI: sebelumnya fungsi ini MEMBUNGKUS ulang simbol sehingga
// menjadi "BINANCE:OANDA:XAUUSD" — simbol tidak sah. TradingView lalu menampilkan
// instrumen lain (harga emas kontrak ~4.650) padahal data Quantum ≈4.200; itulah
// sebabnya kedua chart tampak tidak sinkron. Sekarang simbol dipakai apa adanya.
function tvSimbolDari(tvAtauKode) {
    let s = String(tvAtauKode || '').trim().toUpperCase();
    if (s.indexOf(':') > 0) return s;                    // sudah "BURSA:TIKER" ✓
    if (/USDT$/.test(s)) return 'BINANCE:' + s;
    if (s === 'XAUUSD' || s === 'GOLD') return 'OANDA:XAUUSD';
    if (/^[A-Z]{6}$/.test(s)) return 'OANDA:' + s;
    return 'BINANCE:' + s;
}
// Kebalikannya: dari simbol TradingView → kode internal Quantum (untuk sinkronisasi
// saat pengguna mengganti simbol DI DALAM TradingView).
function kodeQuantumDariTv(tvSym) {
    const tv = String(tvSym || '').trim().toUpperCase();
    try {
        const daftar = (typeof WL_GROUPS !== 'undefined') ? WL_GROUPS.flatMap(g => g.syms) : [];
        const cocok = daftar.find(s => String(s.tv).toUpperCase() === tv);
        if (cocok) return { key: cocok.key, tv: cocok.tv, label: cocok.label };
    } catch (e) {}
    const ticker = tv.replace(/^[A-Z0-9_]+:/, '');
    if (!ticker) return null;
    const label = /^[A-Z]{6}$/.test(ticker) ? (ticker.slice(0, 3) + '/' + ticker.slice(3)) : ticker;
    return { key: ticker, tv: tv, label: label };
}
function tvIntervalDari(iv) {
    const peta = { '1':'1','5':'5','15':'15','30':'30','60':'60','240':'240','D':'D','W':'W','MN':'M' };
    return peta[String(iv)] || '60';
}
function setChartMode(mode, diam) {
    mode = 'quantum'; // chart TradingView dihapus dari dashboard; hanya engine Quantum (data OANDA)
    _modeChart = mode;
    try { localStorage.setItem('qi-chart-mode', mode); } catch (e) {}
    const lwWrap = document.getElementById('tv_chart_container');
    const tvWrap = document.getElementById('tvChartWrap');
    const bQ = document.getElementById('btnChartQuantum');
    const bT = document.getElementById('btnChartTradingView');
    const gayaAktif = 'px-2 py-1 text-[10px] font-bold text-qi-cyan bg-qi-cyan/10';
    const gayaDiam  = 'px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white';
    if (bQ) bQ.className = (mode === 'quantum') ? gayaAktif : gayaDiam;
    if (bT) bT.className = (mode === 'tradingview') ? gayaAktif : gayaDiam;

    if (mode === 'tradingview') {
        if (lwWrap) lwWrap.classList.add('hidden');
        if (tvWrap) tvWrap.classList.remove('hidden');
        muatWidgetTradingView();
        if (!diam && typeof showQuantumToast === 'function') {
            showQuantumToast('📈 Chart TradingView aktif — memakai simbol YANG SAMA seperti Quantum (' + tvSimbolDari(_tvSymbol) + '). Bila Anda mengganti simbol di dalam TradingView, Quantum otomatis mengikutinya.', 'info', 5200);
        }
    } else {
        if (tvWrap) tvWrap.classList.add('hidden');
        if (lwWrap) lwWrap.classList.remove('hidden');
        // Kanvas yang tadinya tersembunyi berukuran 0 → wajib digambar ulang.
        if (typeof _lwChart !== 'undefined' && _lwChart) {
            setTimeout(() => {
                try {
                    _lwChart.applyOptions({ autoSize: true });
                    _lwChart.timeScale().fitContent();
                } catch (e) {}
            }, 120);
        }
    }
}
let _widgetTvDimuat = false;
let _tvWidgetObjek = null;
let _sinkronDariTv = false;   // penjaga agar tidak terjadi perulangan muat ulang
let _skripTvJs = null;

/**
 * Terapkan simbol yang datang DARI TradingView ke Quantum.
 *
 * Penjaga _sinkronDariTv WAJIB dibersihkan apa pun yang terjadi (try/finally).
 * Tanpa itu, satu kesalahan saja saat mengganti simbol akan membuat penjaga
 * tertinggal bernilai true selamanya — dan widget TradingView tidak akan pernah
 * dimuat ulang lagi sepanjang sesi (chart TradingView membeku pada simbol lama).
 */
function terapkanSinkronTv(info) {
    if (!info) return false;
    _sinkronDariTv = true;
    try {
        if (typeof setChartSymbolFull === 'function') setChartSymbolFull(info.key, info.tv, info.label);
        return true;
    } catch (e) {
        return false;
    } finally {
        _sinkronDariTv = false;   // selalu dibersihkan
    }
}

function muatWidgetTradingView() {
    const wrap = document.getElementById('tvChartWrap');
    if (!wrap) return;
    const simbol = tvSimbolDari((typeof _tvSymbol !== 'undefined' && _tvSymbol) ? _tvSymbol : 'OANDA:XAUUSD');
    const interval = tvIntervalDari((typeof _tvInterval !== 'undefined' && _tvInterval) ? _tvInterval : '60');
    wrap.innerHTML = '<div id="tvWidgetKontainer" style="height:100%;width:100%"></div>';

    const buat = () => {
        try {
            if (!window.TradingView || !TradingView.widget) return;
            _tvWidgetObjek = new TradingView.widget({
                container_id: 'tvWidgetKontainer',
                autosize: true,
                symbol: simbol,
                interval: interval,
                timezone: 'Asia/Jakarta',
                theme: 'dark',
                style: '1',
                locale: 'id',
                toolbar_bg: '#0B1220',
                enable_publishing: false,
                allow_symbol_change: true,
                hide_side_toolbar: false,
                hide_top_toolbar: false,
                withdateranges: true,
                details: false,
                save_image: true,
                support_host: 'https://www.tradingview.com'
            });
            _widgetTvDimuat = true;
            // API RESMI TradingView: setelah chart siap, simbol TradingView ⇄ Quantum
            // disamakan. Inilah yang membuat "Quantum mengikuti harga simbol itu".
            _tvWidgetObjek.onChartReady(function () {
                try {
                    const chart = _tvWidgetObjek.activeChart();
                    // (a) Pengguna mengganti simbol DI DALAM TradingView → Quantum ikut.
                    chart.onSymbolChanged().subscribe(null, function () {
                        try {
                            const ext = chart.symbolExt() || {};
                            const tvKini = String(ext.symbol || ext.ticker || '');
                            const info = kodeQuantumDariTv(tvKini);
                            if (!info) return;
                            if (info.key === _tvSymbol || info.tv === _tvSymbol) return;
                            terapkanSinkronTv(info);
                            if (typeof showQuantumToast === 'function') {
                                showQuantumToast('🔄 Quantum mengikuti simbol TradingView: ' + info.key + ' — header, chart, dan Mesin 9 memakai simbol yang sama.', 'info', 4000);
                            }
                        } catch (e) {}
                    });
                    // (b) Samakan sejak awal bila TradingView menormalkan simbolnya.
                    const ext0 = chart.symbolExt() || {};
                    const tv0 = String(ext0.symbol || ext0.ticker || '');
                    const info0 = kodeQuantumDariTv(tv0);
                    if (info0 && info0.tv !== _tvSymbol && info0.key !== _tvSymbol) {
                        terapkanSinkronTv(info0);
                    }
                } catch (e) {}
            });
        } catch (e) { /* widget gagal tidak boleh merusak halaman */ }
    };

    // tv.js diperlukan untuk API onChartReady/onSymbolChanged (skrip embed-widget
    // tidak menyediakannya). Dimuat sekali saja.
    if (window.TradingView && TradingView.widget) { buat(); return; }
    if (_skripTvJs) { _skripTvJs.addEventListener('load', buat); return; }
    _skripTvJs = document.createElement('script');
    _skripTvJs.src = 'https://s3.tradingview.com/tv.js';
    _skripTvJs.async = true;
    _skripTvJs.addEventListener('load', buat);
    document.head.appendChild(_skripTvJs);
}
function segarkanWidgetTvBilaPerlu() {
    // _sinkronDariTv = perubahan simbol berasal DARI TradingView → JANGAN muat ulang
    // widget (kalau tidak, akan terjadi perulangan tanpa henti).
    if (_sinkronDariTv) return;
    if (_modeChart === 'tradingview' && _widgetTvDimuat) muatWidgetTradingView();
}
// Buang pilihan 'tradingview' lama dari localStorage supaya chart tidak tersembunyi.
try { localStorage.removeItem('qi-chart-mode'); } catch (e) {}

let _chartFullscreen = false;

function toggleChartWatchlist() {
    _wlVisible = !_wlVisible;
    const wl  = document.getElementById('chartWatchlist');
    const qimWl = document.querySelector('.qim-watchlist-card');
    const btn = document.getElementById('watchlistToggleBtn');
    if (wl)  wl.classList.toggle('hidden-list', !_wlVisible);
    if (qimWl) qimWl.classList.toggle('hidden', !_wlVisible);
    if (btn) btn.innerHTML = _wlVisible ? '<span>⊞</span> <span>Watchlist</span>' : '<span>⊟</span> <span>Watchlist</span>';
    setTimeout(() => { if (_lwChart) _lwChart.applyOptions({ autoSize: true }); }, 150);
}

function toggleChartBottomPanel() {
    _bottomPanelVisible = !_bottomPanelVisible;
    const pnl = document.getElementById('chartBottomPanel');
    const btn = document.getElementById('btnBottomPanelToggle');
    if (pnl) pnl.classList.toggle('hidden-panel', !_bottomPanelVisible);
    if (btn) {
        btn.classList.toggle('text-qi-cyan', !_bottomPanelVisible);
        btn.classList.toggle('border-qi-cyan/40', !_bottomPanelVisible);
        btn.title = _bottomPanelVisible ? 'Sembunyikan Panel Posisi Bawah' : 'Tampilkan Panel Posisi Bawah';
    }
    setTimeout(() => {
        if (_lwChart) {
            _lwChart.applyOptions({ autoSize: true });
            _lwChart.timeScale().fitContent();
        }
    }, 150);
}

function toggleChartFullscreenMode() {
    _chartFullscreen = !_chartFullscreen;
    const panel = document.getElementById('panel-charts');
    const fsIcon = document.getElementById('fsChartIcon');
    const fsBtn = document.getElementById('btnChartFullscreen');

    if (panel) panel.classList.toggle('chart-fullscreen-mode', _chartFullscreen);
    if (fsIcon) fsIcon.textContent = _chartFullscreen ? '✕' : '⛶';
    if (fsBtn) {
        fsBtn.classList.toggle('text-qi-cyan', _chartFullscreen);
        fsBtn.classList.toggle('border-qi-cyan/50', _chartFullscreen);
        fsBtn.classList.toggle('bg-qi-cyan/10', _chartFullscreen);
    }

    // Auto-hide watchlist when entering fullscreen for maximum trading view width
    if (_chartFullscreen && _wlVisible) {
        toggleChartWatchlist();
    }

    // Tombol keluar mengapung: jaring pengaman agar pengguna TIDAK PERNAH terjebak.
    // (Bilah chart memang masih terlihat di mode ini, tetapi satu tombol besar di
    // sudut layar jauh lebih jelas daripada ikon kecil di antara banyak tombol.)
    try {
        if (_chartFullscreen && typeof tampilkanTombolKeluarFullscreen === 'function') {
            tampilkanTombolKeluarFullscreen(function () { toggleChartFullscreenMode(); });
        } else if (!_chartFullscreen && !(typeof _panelFullscreen !== 'undefined' && _panelFullscreen)
                   && typeof sembunyikanTombolKeluarFullscreen === 'function') {
            sembunyikanTombolKeluarFullscreen();
        }
    } catch (e) {}

    setTimeout(() => {
        if (_lwChart) {
            _lwChart.applyOptions({ autoSize: true });
            _lwChart.timeScale().fitContent();
        }
    }, 180);
}

// Press ESC to exit chart fullscreen mode
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _chartFullscreen) {
        toggleChartFullscreenMode();
    }
});

function setChartInterval(iv) {
    _tvInterval = iv;
    const labels = {'1':'1m','5':'5m','15':'15m','30':'30m','60':'1h','240':'4h','D':'1D','W':'1W','MN':'1M'};
    document.querySelectorAll('.chart-tf-btn').forEach(b => {
        const isActive = labels[iv] === b.textContent.trim();
        b.className = isActive
            ? 'chart-tf-btn active px-2 py-0.5 rounded text-[10px] font-mono border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'chart-tf-btn px-2 py-0.5 rounded text-[10px] font-mono border border-qi-border text-slate-400 hover:border-qi-cyan/40 hover:text-white';
    });
    const tfLabel = document.getElementById('ohlcTf');
    if (tfLabel) tfLabel.textContent = labels[iv] || iv;
    lwFetchAndSetData();
    // Bila pengguna memakai chart TradingView, widgetnya ikut berganti timeframe.
    if (typeof segarkanWidgetTvBilaPerlu === 'function') segarkanWidgetTvBilaPerlu();
}

function setChartTab(tab) {
    _chartTab = tab;
    document.querySelectorAll('.chart-tab-btn').forEach(b => {
        const active = b.dataset.ctab === tab;
        b.className = active
            ? 'chart-tab-btn active text-[10px] font-semibold px-4 py-2 border-r border-qi-border text-qi-cyan border-b-2 border-b-qi-cyan bg-qi-cyan/5'
            : 'chart-tab-btn text-[10px] font-semibold px-4 py-2 border-r border-qi-border text-slate-400 hover:text-white';
    });
    renderChartTab();
}

function renderChartTab() {
    const el = document.getElementById('chartTabContent');
    if (!el) return;
    if (_chartTab === 'positions') {
        // Show open positions from paper trading
        if (!_ptPositions.length) {
            el.innerHTML = '<div class="px-4 py-3 text-center text-slate-600 text-[10px]">Tidak ada posisi terbuka. Klik BUY/SELL untuk membuka trade.</div>';
            return;
        }
        let floatTotal = 0;
        const rows = _ptPositions.map(p => {
            const cur = _lastPrices[p.symbol];
            let pnl = 0;
            if (cur) {
                const curP  = parseFloat(cur.price);
                const entP  = parseFloat(p.entryPrice);
                const diff  = p.side==='BUY' ? curP - entP : entP - curP;
                pnl = diff * p.lots * ptPnlMult(p.symbol, curP);
            }
            floatTotal += pnl;
            const pnlCls = pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
            return `<tr class="border-b border-qi-border/30 text-[10px] font-mono">
                <td class="px-3 py-1.5 text-white font-bold">${SYMBOL_LABELS[p.symbol]||p.symbol}</td>
                <td class="px-2 py-1.5 ${p.side==='BUY'?'text-qi-green':'text-qi-red'} font-bold">${p.side}</td>
                <td class="px-2 py-1.5 text-slate-300">${p.lots}</td>
                <td class="px-2 py-1.5 text-slate-300">${parseFloat(p.entryPrice).toFixed(4)}</td>
                <td class="px-2 py-1.5 ${pnlCls} font-bold">${pnl>=0?'+':''}$${pnl.toFixed(2)}</td>
                <td class="px-2 py-1.5"><button onclick="ptClosePosition('${p.id}')" class="text-qi-red hover:underline text-[9px]">Tutup</button></td>
            </tr>`;
        }).join('');
        const flCls = floatTotal >= 0 ? 'text-qi-green' : 'text-qi-red';
        const flEl  = document.getElementById('chartFloatPnl');
        if (flEl) { flEl.textContent = `P&L: ${floatTotal>=0?'+':''}$${floatTotal.toFixed(2)}`; flEl.className = `text-[11px] font-mono font-bold ${flCls}`; }
        el.innerHTML = `<table class="w-full"><thead><tr class="text-[9px] text-slate-500 uppercase border-b border-qi-border">
            <th class="px-3 py-1 text-left">Simbol</th><th class="px-2 py-1 text-left">Arah</th>
            <th class="px-2 py-1 text-left">Lot</th><th class="px-2 py-1 text-left">Entry</th>
            <th class="px-2 py-1 text-left">P&L</th><th class="px-2 py-1"></th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    } else if (_chartTab === 'history') {
        const hist = (_ptHistory || []).slice(0, 20);
        if (!hist.length) { el.innerHTML = '<div class="px-4 py-3 text-center text-slate-600 text-[10px]">Belum ada riwayat trade.</div>'; return; }
        const rows = hist.map(h => {
            const pnlCls = (h.pnl||0) >= 0 ? 'text-qi-green' : 'text-qi-red';
            return `<tr class="border-b border-qi-border/30 text-[10px] font-mono">
                <td class="px-3 py-1.5 text-white">${SYMBOL_LABELS[h.symbol]||h.symbol}</td>
                <td class="px-2 py-1.5 ${h.side==='BUY'?'text-qi-green':'text-qi-red'}">${h.side}</td>
                <td class="px-2 py-1.5 text-slate-300">${h.lots}</td>
                <td class="px-2 py-1.5 ${pnlCls}">${(h.pnl||0)>=0?'+':''}$${(h.pnl||0).toFixed(2)}</td>
                <td class="px-2 py-1.5 text-slate-500 text-[9px]">${h.closedAt?new Date(h.closedAt).toLocaleString('id-ID'):(h.closeTime||'—')}</td>
            </tr>`;
        }).join('');
        el.innerHTML = `<table class="w-full"><thead><tr class="text-[9px] text-slate-500 uppercase border-b border-qi-border">
            <th class="px-3 py-1 text-left">Simbol</th><th class="px-2 py-1">Arah</th>
            <th class="px-2 py-1">Lot</th><th class="px-2 py-1">P&L</th><th class="px-2 py-1 text-left">Waktu Tutup</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    } else {
        el.innerHTML = '<div class="px-4 py-3 text-center text-slate-500 text-[10px]">Fitur jurnal akan segera hadir.</div>';
    }
}

function chartQuickOrder(side) {
    // Determine key from current TV symbol
    const allSyms = WL_GROUPS.flatMap(g => g.syms);
    const found   = allSyms.find(s => s.tv === _tvSymbol);
    if (!found) { showQuantumToast('Simbol tidak dikenali untuk paper trading.', 'warning'); return; }
    const lots = parseFloat(document.getElementById('chartOrderLots')?.value || '0.1');
    const cur  = _lastPrices[found.key];
    if (!cur) { showQuantumToast('Harga belum tersedia, tunggu sebentar.', 'warning'); return; }
    const price = parseFloat(cur.price);
    const newPos = {
        id: 'pt_' + Date.now(),
        symbol: found.key,
        side,
        lots,
        entryPrice: price,
        openTime: new Date().toISOString(),
        openedAt: new Date().toISOString(),
    };
    _ptPositions.push(newPos);
    ptSaveToServer();
    renderChartTab();
    updateChartHeader();
    // Flash feedback
    const btn = side === 'BUY'
        ? document.querySelector('#chartWatchlist button.bg-qi-green')
        : document.querySelector('#chartWatchlist button.bg-qi-red');
    if (btn) { btn.style.opacity = '0.5'; setTimeout(()=>btn.style.opacity='1', 300); }
}

// Indikator kesegaran data harga: umur data + apakah sebagian berasal dari cache.
// Polling harga berjalan tiap 15 detik, jadi umur > 60 detik berarti data tertunda.
function renderPriceFreshness() {
    const el = document.getElementById('watchlistFreshness');
    if (!el) return;
    const base = 'px-3 py-1 text-[9px] border-b border-qi-border/40 ';
    if (!_lastPricesAt) {
        el.textContent = 'Menunggu data harga…';
        el.className = base + 'text-slate-500';
        return;
    }
    const ageSec = Math.max(0, Math.round((Date.now() - _lastPricesAt) / 1000));
    const sources = [];
    Object.values(_lastPrices || {}).forEach(function (p) {
        const s = p && p.source ? String(p.source) : '';
        if (s && sources.indexOf(s) === -1) sources.push(s);
    });
    const fromCache = sources.some(function (s) { return s.indexOf('cache') !== -1; });
    const stale = ageSec > 60;
    const parts = [ageSec <= 2 ? 'diperbarui baru saja' : 'diperbarui ' + ageSec + 's lalu'];
    if (sources.length) parts.push(sources.slice(0, 2).join('/'));
    if (fromCache) parts.push('sebagian dari cache');
    el.textContent = (stale ? '⚠ ' : '') + parts.join(' · ') + (stale ? ' — data mungkin tertunda' : '');
    el.className = base + ((stale || fromCache) ? 'text-amber-300' : 'text-slate-500');
}

// Update watchlist prices on every market data fetch
function updateWatchlistPrices() {
    if (_activePanel !== 'panel-charts') return;
    renderPriceFreshness();
    renderWatchlist(document.getElementById('watchlistSearch')?.value || '');
    updateChartHeader();
    renderChartTab();
    // Update account balance
    const balEl = document.getElementById('chartAccBalance');
    if (balEl && _ptBalance !== undefined) balEl.textContent = '$' + _ptBalance.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ─── Signal Matrix ─────────────────────────────────────────────────────────
const SIGNAL_SYMS = [
    'XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','USDCHF','USDCAD','NZDUSD',
    'GBPJPY','EURJPY','EURGBP',
    'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT',
];
const SIGNAL_TFS  = [
    { label:'M15', interval:'15' },
    { label:'H1',  interval:'60' },
    { label:'H4',  interval:'240' },
    { label:'D1',  interval:'D' },
];

async function fetchSignalMatrix() {
    const body = document.getElementById('signalMatrixBody');
    if (!body) return;
    body.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-slate-600 text-xs animate-pulse">Memuat data TradingView untuk ${SIGNAL_SYMS.length} instrumen…</td></tr>`;

    const tvSigCls = {
        STRONG_BUY:'text-qi-green font-bold', BUY:'text-qi-green',
        STRONG_SELL:'text-qi-red font-bold', SELL:'text-qi-red',
        NEUTRAL:'text-slate-500', NO_DATA:'text-slate-600'
    };
    const tvSigIcon = {
        STRONG_BUY:'▲▲', BUY:'▲', STRONG_SELL:'▼▼', SELL:'▼',
        NEUTRAL:'◆', NO_DATA:'—'
    };
    const tvSigLabel = {
        STRONG_BUY:'STRONG BUY', BUY:'BUY', STRONG_SELL:'STRONG SELL',
        SELL:'SELL', NEUTRAL:'NEUTRAL', NO_DATA:'—'
    };
    const tfKeys = ['15','60','240','1D'];

    try {
        const res  = await fetch('api/tv-scan.php?symbols=' + SIGNAL_SYMS.join(','));
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'API error');

        const data = json.data || {};
        const srcEl = document.getElementById('signalSource');
        if (srcEl) srcEl.textContent = `Source: TradingView · ${new Date().toLocaleTimeString('id-ID')}`;

        body.innerHTML = SIGNAL_SYMS.map(sym => {
            const d = data[sym];
            if (!d) return `<tr class="border-b border-qi-border/50"><td class="px-4 py-2.5 text-white text-[12px]">${SYMBOL_LABELS[sym]||sym}</td><td colspan="7" class="text-center text-slate-600 text-[11px]">No data</td></tr>`;

            const tfs = d.timeframes || {};
            const ind = d.indicators || {};

            // Summary: count buy/sell across timeframes
            let buyCount = 0, sellCount = 0;
            tfKeys.forEach(tf => {
                const sig = tfs[tf]?.signal || 'NEUTRAL';
                if (sig.includes('BUY')) buyCount++;
                if (sig.includes('SELL')) sellCount++;
            });
            let summary = 'NEUTRAL', sumCls = 'text-slate-500';
            if (buyCount >= 3) { summary = 'STRONG BUY'; sumCls = 'text-qi-green font-bold'; }
            else if (buyCount >= 2) { summary = 'BUY'; sumCls = 'text-qi-green'; }
            else if (sellCount >= 3) { summary = 'STRONG SELL'; sumCls = 'text-qi-red font-bold'; }
            else if (sellCount >= 2) { summary = 'SELL'; sumCls = 'text-qi-red'; }

            // Store for AI context
            _lastSignals[sym] = {
                '15m': tfs['15']?.signal  || 'NO_DATA',
                '1h':  tfs['60']?.signal  || 'NO_DATA',
                '4h':  tfs['240']?.signal || 'NO_DATA',
                '1D':  tfs['1D']?.signal  || 'NO_DATA',
                summary,
                rsi: ind.rsi != null ? ind.rsi.toFixed(1) : null
            };

            const rsi    = ind.rsi != null ? ind.rsi.toFixed(1) : '—';
            const rsiCls = ind.rsi != null ? (ind.rsi > 65 ? 'text-qi-red' : ind.rsi < 35 ? 'text-[#3B82F6]' : 'text-slate-300') : 'text-slate-500';

            const macdUp = ind.macd != null && ind.macd_signal != null ? ind.macd > ind.macd_signal : null;
            const macdCls = macdUp === true ? 'text-qi-green' : macdUp === false ? 'text-qi-red' : 'text-slate-500';
            const macdStr = macdUp === true ? 'MACD↑' : macdUp === false ? 'MACD↓' : '—';

            const emaUp  = ind.ema20 && ind.ema50 ? ind.ema20 > ind.ema50 : null;
            const emaCls = emaUp === true ? 'text-qi-green' : emaUp === false ? 'text-qi-red' : 'text-slate-500';
            const emaStr = emaUp === true ? 'EMA↑' : emaUp === false ? 'EMA↓' : '—';

            const cells = tfKeys.map(tf => {
                const sig  = tfs[tf]?.signal || 'NO_DATA';
                const cls  = tvSigCls[sig]  || 'text-slate-600';
                const icon = tvSigIcon[sig] || '—';
                const lbl  = tvSigLabel[sig]|| sig;
                return `<td class="px-3 py-2.5 text-center font-mono text-[11px] ${cls}">${icon} ${lbl}</td>`;
            }).join('');

            return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02] transition-colors">
                <td class="px-4 py-2.5 font-semibold text-white text-[12px]">${SYMBOL_LABELS[sym]||sym}</td>
                ${cells}
                <td class="px-3 py-2 text-center"><span class="font-mono text-[10px] ${rsiCls}">${rsi}</span></td>
                <td class="px-3 py-2 text-center">
                    <span class="font-mono text-[10px] ${emaCls}">${emaStr}</span>
                    <span class="font-mono text-[10px] ${macdCls} ml-1">${macdStr}</span>
                </td>
                <td class="px-3 py-2.5 text-center font-mono text-[11px] ${sumCls}">${summary}</td>
            </tr>`;
        }).join('');
    } catch(err) {
        body.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-qi-red text-xs">Gagal memuat data TradingView: ${err.message}</td></tr>`;
    }
}

// ─── Technical Outlook ─────────────────────────────────────────────────────
let _outlookSym = 'OANDA:XAUUSD';

function setOutlookSym(tvSym) {
    _outlookSym = tvSym;
    document.querySelectorAll('.outlook-sym').forEach(b => {
        const active = b.dataset.sym === tvSym;
        b.className = active
            ? 'outlook-sym active px-2 py-0.5 rounded text-[10px] font-mono border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'outlook-sym px-2 py-0.5 rounded text-[10px] font-mono border border-qi-border text-slate-400 hover:border-slate-500';
    });
    loadTvTaWidget(tvSym);
}

function loadTvTaWidget(tvSym) {
    const wrap = document.getElementById('tvTaWidgetWrap');
    if (!wrap) return;

    // Clear old widget
    wrap.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%;"><div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%;"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div></div>';

    const isLight = typeof isQIThemeLight === 'function' && isQIThemeLight();
    const config = {
        interval: '1D',
        width: '100%',
        height: 420,
        symbol: tvSym,
        showIntervalTabs: true,
        displayMode: 'regular',
        locale: 'id',
        colorTheme: isLight ? 'light' : 'dark',
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.textContent = JSON.stringify(config);
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    wrap.querySelector('.tradingview-widget-container').appendChild(script);
}

async function fetchOutlook() {
    const grid = document.getElementById('outlookGrid');
    const upd  = document.getElementById('outlookUpdated');
    if (!grid) return;

    loadTvTaWidget(_outlookSym);

    grid.innerHTML = SYMBOLS.map(() => '<div class="skel h-28 rounded-xl"></div>').join('');

    try {
        const res  = await fetch('api/tv-scan.php?symbols=' + SYMBOLS.join(','));
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'API error');

        const data = json.data || {};
        if (upd) upd.textContent = `Updated: ${new Date().toLocaleTimeString('id-ID')} — Source: TradingView Technical Analysis`;

        const sigMap = {
            STRONG_BUY:  { cls:'text-qi-green font-bold', icon:'▲▲', label:'STRONG BUY' },
            BUY:         { cls:'text-qi-green',           icon:'▲',  label:'BUY' },
            NEUTRAL:     { cls:'text-slate-400',          icon:'◆',  label:'NEUTRAL' },
            SELL:        { cls:'text-qi-red',             icon:'▼',  label:'SELL' },
            STRONG_SELL: { cls:'text-qi-red font-bold',   icon:'▼▼', label:'STRONG SELL' },
        };

        grid.innerHTML = SYMBOLS.map(sym => {
            const d = data[sym];
            const label = SYMBOL_LABELS[sym] || sym;
            if (!d) return `<div class="bg-qi-panel border border-qi-border rounded-xl p-3"><span class="text-white text-[11px]">${label}</span><div class="text-slate-600 text-[10px] mt-2">No data</div></div>`;

            const tfs = d.timeframes || {};
            const ind = d.indicators || {};

            // Daily signal as primary
            const dailySig = tfs['1D']?.signal || 'NEUTRAL';
            const s = sigMap[dailySig] || sigMap.NEUTRAL;

            // RSI
            const rsi = ind.rsi != null ? ind.rsi.toFixed(1) : '—';
            const rsiNum = ind.rsi;
            const rsiColor = rsiNum == null ? '#94A3B8' : rsiNum > 65 ? '#EF4444' : rsiNum < 35 ? '#3B82F6' : '#10B981';
            const rsiLabel = rsiNum == null ? 'No data' : rsiNum > 70 ? 'Overbought' : rsiNum > 60 ? 'Bullish zone' : rsiNum < 30 ? 'Oversold' : rsiNum < 40 ? 'Bearish zone' : 'Neutral zone';
            const rsiW = rsiNum != null ? Math.min(100, rsiNum) : 50;

            // EMA / MACD from real indicators
            const emaDir = ind.ema20 && ind.ema50 ? (ind.ema20 > ind.ema50 ? 'bullish' : 'bearish') : null;
            const macdDir = ind.macd != null && ind.macd_signal != null ? (ind.macd > ind.macd_signal ? 'positive' : 'negative') : null;

            // Multi-TF mini badges
            const tfBadges = ['15','60','240','1D'].map(tf => {
                const sig = tfs[tf]?.signal || 'NEUTRAL';
                const c = sig.includes('BUY') ? 'bg-qi-green/15 text-qi-green' : sig.includes('SELL') ? 'bg-qi-red/15 text-qi-red' : 'bg-slate-800/50 text-slate-500';
                const lbl = tf === '15' ? 'M15' : tf === '60' ? 'H1' : tf === '240' ? 'H4' : 'D1';
                const icon = sig.includes('BUY') ? '▲' : sig.includes('SELL') ? '▼' : '—';
                return `<span class="px-1 py-0.5 rounded text-[8px] font-mono ${c}">${lbl}${icon}</span>`;
            }).join('');

            return `<div class="bg-qi-panel border border-qi-border rounded-xl p-3 hover:border-qi-cyan/30 transition-colors">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-white text-[11px]">${label}</span>
                    <span class="text-[10px] font-mono font-bold ${s.cls}">${s.icon} ${s.label}</span>
                </div>
                <div class="mb-2">
                    <div class="flex justify-between text-[9px] text-slate-500 mb-0.5">
                        <span>RSI 14</span><span class="font-mono" style="color:${rsiColor}">${rsi}</span>
                    </div>
                    <div class="h-1.5 bg-[#0F1A2E] rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all" style="width:${rsiW}%;background:${rsiColor}"></div>
                    </div>
                    <div class="text-[9px] mt-0.5" style="color:${rsiColor}">${rsiLabel}</div>
                </div>
                <div class="flex gap-1.5 text-[9px] mb-1.5">
                    <span class="px-1.5 py-0.5 rounded font-mono font-semibold ${emaDir === 'bullish' ? 'bg-qi-green/10 text-qi-green' : emaDir === 'bearish' ? 'bg-qi-red/10 text-qi-red' : 'bg-slate-800 text-slate-500'}">
                        ${emaDir === 'bullish' ? 'EMA20>50 ↑' : emaDir === 'bearish' ? 'EMA20<50 ↓' : 'EMA —'}
                    </span>
                    <span class="px-1.5 py-0.5 rounded font-mono font-semibold ${macdDir === 'positive' ? 'bg-qi-green/10 text-qi-green' : macdDir === 'negative' ? 'bg-qi-red/10 text-qi-red' : 'bg-slate-800 text-slate-500'}">
                        ${macdDir === 'positive' ? 'MACD ↑' : macdDir === 'negative' ? 'MACD ↓' : 'MACD —'}
                    </span>
                </div>
                <div class="flex gap-1">${tfBadges}</div>
            </div>`;
        }).join('');
    } catch(err) {
        grid.innerHTML = `<div class="col-span-full text-center text-qi-red text-xs py-4">Gagal memuat data: ${err.message}</div>`;
    }
}

// ─── Heatmap Panel ─────────────────────────────────────────────────────────
let _calSelected2 = null;
let _calCurrentView = 'table';
function switchCalView(view) {
    _calCurrentView = view;
    ['table','grid','list'].forEach(v => {
        const el = document.getElementById('calView' + v.charAt(0).toUpperCase() + v.slice(1));
        if (el) el.classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.cal-view-btn').forEach(btn => {
        const isActive = btn.dataset.calview === view;
        btn.className = 'cal-view-btn px-2 py-1 text-[10px] font-semibold rounded border ' +
            (isActive ? 'border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan' : 'border-qi-border text-slate-400 hover:border-slate-500');
    });
    if (view === 'grid' && _calEvents.length) renderCalGrid2(_calEvents);
    if (view === 'list' && _calEvents.length) renderCalFullList(_calEvents);
}
function initHeatmapPanel() {
    if (_calEvents.length) { renderCalTable(); renderCalGrid2(_calEvents); renderCalFullList(_calEvents); return; }
    const body = document.getElementById('calTableBody');
    if (body) body.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-600">Memuat kalender…</td></tr>';
    fetchCalendarData();
}

async function fetchCalendarData() {
    try {
        const res  = await fetch('api/calendar.php');
        const data = await res.json();
        _calEvents = (data.events || data.data || [])
            .sort((a, b) => new Date(a.date||0) - new Date(b.date||0));
        const cntEl = document.getElementById('calEventCount');
        if (cntEl) cntEl.textContent = `${_calEvents.length} events`;
        renderCalTable();
        renderCalGrid2(_calEvents);
        renderCalFullList(_calEvents);
    } catch(e) {
        const body = document.getElementById('calTableBody');
        if (body) body.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-500">Gagal memuat kalender</td></tr>';
    }
}

function renderCalGrid2(events) {
    const now = new Date(), year = now.getFullYear(), month = now.getMonth();
    const dayMap = {};
    events.forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!dayMap[key]) dayMap[key] = { high:0, medium:0, low:0, events:[] };
        const imp = (e.impact||'low').toLowerCase();
        dayMap[key][imp === 'high' ? 'high' : imp === 'medium' ? 'medium' : 'low']++;
        dayMap[key].events.push(e);
    });
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const todayKey = `${year}-${String(month+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const grid = document.getElementById('calGrid2');
    if (!grid) return;
    let html = '';
    for (let i = 0; i < startOffset; i++) html += '<div class="aspect-square"></div>';
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const info = dayMap[key];
        let bg = 'bg-qi-panel hover:bg-slate-700/50';
        let dot = '';
        if (info) {
            if (info.high > 0)        { bg = 'bg-qi-red/20 hover:bg-qi-red/30';    dot = '<span class="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-qi-red"></span>'; }
            else if (info.medium > 0) { bg = 'bg-qi-gold/15 hover:bg-qi-gold/25';  dot = '<span class="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-qi-gold"></span>'; }
            else                      { bg = 'bg-qi-green/10 hover:bg-qi-green/20'; dot = '<span class="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-qi-green"></span>'; }
        }
        const todayRing = key === todayKey ? ' ring-1 ring-qi-cyan' : '';
        const selRing   = key === _calSelected2 ? ' ring-1 ring-white/60' : '';
        const total = info ? (info.high + info.medium + info.low) : 0;
        html += `<div onclick="selectCalDay2('${key}')" class="aspect-square relative rounded cursor-pointer flex items-end justify-start p-0.5 ${bg}${todayRing}${selRing} transition-all" title="${total} event">
            ${dot}<span class="text-[9px] font-mono ${key === todayKey ? 'text-qi-cyan font-bold' : 'text-slate-500'}">${day}</span>
            ${total > 0 ? `<span class="absolute bottom-0.5 left-0.5 text-[8px] text-white/50">${total}</span>` : ''}
        </div>`;
    }
    grid.innerHTML = html;
}

function selectCalDay2(key) {
    _calSelected2 = key;
    renderCalGrid2(_calEvents);
    const evts = _calEvents.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return k === key;
    });
    const panel = document.getElementById('calDayEvents2');
    const title = document.getElementById('calDayTitle2');
    const list  = document.getElementById('calDayEventList2');
    if (!panel || !list) return;
    if (!evts.length) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    if (title) title.textContent = `${evts.length} event pada ${key}`;
    const IMPACT_CLS = { high:'text-qi-red', medium:'text-qi-gold', low:'text-qi-green' };
    list.innerHTML = evts.map(e => {
        const imp = (e.impact||'low').toLowerCase();
        const cls = IMPACT_CLS[imp] || 'text-slate-400';
        const t = e.date ? new Date(e.date).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="flex items-start gap-2 py-1 border-b border-qi-border/40 last:border-0">
            <span class="text-[9px] font-mono text-slate-600 w-10 shrink-0 mt-0.5">${t}</span>
            <span class="text-[9px] font-semibold ${cls} w-6 shrink-0 uppercase">${e.currency||''}</span>
            <span class="text-[10px] text-slate-300 leading-tight">${e.title||'—'}</span>
            <span class="ml-auto text-[9px] ${cls} shrink-0">${imp.toUpperCase()}</span>
        </div>`;
    }).join('');
}

function renderCalFullList(events) {
    const el = document.getElementById('calFullList');
    if (!el) return;
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
    const IMPACT_CLS = { high:'text-qi-red', medium:'text-qi-gold', low:'text-qi-green' };
    if (!sorted.length) { el.innerHTML = '<div class="px-4 py-6 text-center text-slate-600 text-xs">Tidak ada data</div>'; return; }
    el.innerHTML = sorted.map(e => {
        const imp = (e.impact||'low').toLowerCase();
        const cls = IMPACT_CLS[imp] || 'text-slate-400';
        const dt = e.date ? new Date(e.date).toLocaleString('id-ID',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[.02] transition-colors">
            <span class="text-[9px] font-mono text-slate-500 w-28 shrink-0">${dt}</span>
            <span class="text-[9px] font-semibold ${cls} w-6 shrink-0 uppercase">${e.currency||''}</span>
            <span class="text-[10px] text-slate-300 leading-tight flex-1 truncate">${e.title||'—'}</span>
            <span class="text-[9px] ${cls} shrink-0 font-semibold">${imp.toUpperCase()}</span>
        </div>`;
    }).join('');
}

// ─── Order Book ────────────────────────────────────────────────────────────
function buildObCard(sym) {
    const label = SYMBOL_LABELS[sym] || sym;
    return `<div class="bg-qi-card border border-qi-border rounded-xl overflow-hidden" id="ob-card-${sym}">
        <div class="px-3 py-2 border-b border-qi-border flex items-center justify-between">
            <span class="font-mono font-bold text-xs text-white">${label}</span>
            <span class="text-[11px] font-mono font-bold text-qi-cyan" id="ob-${sym}-mid">—</span>
        </div>
        <div class="px-3 py-1 text-[9px] font-semibold text-qi-red uppercase tracking-wider">ASKS</div>
        <div id="ob-${sym}-asks" class="divide-y divide-qi-border/20">
            <div class="px-3 py-4 text-center text-slate-600 text-[10px]">Memuat…</div>
        </div>
        <div class="px-3 py-1 text-[9px] font-semibold text-qi-green uppercase tracking-wider border-t border-qi-border/30">BIDS</div>
        <div id="ob-${sym}-bids" class="divide-y divide-qi-border/20"></div>
    </div>`;
}

function initObGrid() {
    const grid = document.getElementById('obGrid');
    if (!grid || grid.children.length) return;
    grid.innerHTML = OB_SYMS.map(buildObCard).join('');
}

async function fetchOrderBook(sym) {
    initObGrid();
    const asksEl = document.getElementById(`ob-${sym}-asks`);
    const bidsEl = document.getElementById(`ob-${sym}-bids`);
    const midEl  = document.getElementById(`ob-${sym}-mid`);
    if (!asksEl || !bidsEl) return;
    try {
        const res  = await fetch(`api/orderbook.php?symbol=${sym}&limit=8`);
        const data = await res.json();
        const asks = (data.asks || []).slice(0, 8).reverse();
        const bids = (data.bids || []).slice(0, 8);
        const maxAskVol = Math.max(...asks.map(r => parseFloat(r[1]||0)), 1);
        const maxBidVol = Math.max(...bids.map(r => parseFloat(r[1]||0)), 1);
        const fmtRow = (r, color, maxVol) => {
            const price = parseFloat(r[0]).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4});
            const vol   = parseFloat(r[1]).toFixed(3);
            const pct   = (parseFloat(r[1]) / maxVol * 100).toFixed(0);
            return `<div class="relative flex items-center justify-between px-3 py-1 text-[10px] font-mono">
                <div class="absolute inset-0 right-auto rounded-sm" style="width:${pct}%;background:${color}15"></div>
                <span class="relative ${color === '#EF4444' ? 'text-qi-red' : 'text-qi-green'}">${price}</span>
                <span class="relative text-slate-500">${vol}</span>
            </div>`;
        };
        const newAsks = asks.map(r => fmtRow(r, '#EF4444', maxAskVol)).join('');
        const newBids = bids.map(r => fmtRow(r, '#10B981', maxBidVol)).join('');
        if (asksEl.innerHTML !== newAsks) asksEl.innerHTML = newAsks || '<div class="px-3 py-2 text-center text-slate-600 text-[10px]">—</div>';
        if (bidsEl.innerHTML !== newBids) bidsEl.innerHTML = newBids || '<div class="px-3 py-2 text-center text-slate-600 text-[10px]">—</div>';
        if (midEl && asks.length && bids.length) {
            const mid = ((parseFloat(asks[0][0]) + parseFloat(bids[0][0])) / 2);
            midEl.textContent = mid.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4});
        }
        const updEl = document.getElementById('obUpdated');
        if (updEl) updEl.textContent = new Date().toLocaleTimeString('id-ID');
    } catch(e) {}
}

async function fetchAllOrderBooks() {
    await Promise.all(OB_SYMS.map(sym => fetchOrderBook(sym)));
}

// ─── Dashboard News ────────────────────────────────────────────────────────
async function fetchDashNews() {
    const el = document.getElementById('dashNewsList');
    if (!el) return;
    el.innerHTML = '<div class="px-4 py-8 text-center text-slate-600 text-xs">Memuat berita…</div>';
    try {
        const res  = await fetch('api/news.php?limit=60');
        const data = await res.json();
        const items = data.items || data.news || data.articles || data.data || [];
        _newsItems = items;
        const updEl = document.getElementById('newsUpdated');
        if (updEl) updEl.textContent = new Date().toLocaleTimeString('id-ID');
        filterNewsItems();
    } catch(e) {
        el.innerHTML = '<div class="px-4 py-6 text-center text-slate-500 text-xs">Gagal memuat berita</div>';
    }
}

// ─── Currency Strength Full ────────────────────────────────────────────────
async function fetchStrengthFull() {
    const stackEl = document.getElementById('strengthStackFull');
    const pairEl  = document.getElementById('strengthPairTable');
    const updEl   = document.getElementById('strengthUpdated2');
    try {
        const res  = await fetch('api/currency-strength.php');
        const data = await res.json();
        const currencies = (data.currencies || []).sort((a, b) => b.score - a.score);
        if (stackEl && currencies.length) {
            stackEl.innerHTML = currencies.map((c, i) => {
                const color = CUR_COLORS[c.currency] || '#94A3B8';
                const chg   = parseFloat(c.chgPct ?? 0);
                const chgStr = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                const chgCls = chg > 0 ? 'text-qi-green' : chg < 0 ? 'text-qi-red' : 'text-slate-500';
                return `<div class="flex items-center gap-2">
                    <div class="w-8 text-right text-[11px] font-mono font-bold text-white">${c.currency}</div>
                    <div class="flex-1 bg-qi-panel rounded-full h-3 overflow-hidden">
                        <div class="strength-bar h-full rounded-full" style="width:${c.score}%;background:${color}"></div>
                    </div>
                    <div class="w-8 text-[11px] font-mono text-slate-400 tabular-nums">${c.score}</div>
                    <div class="w-14 text-[10px] font-mono ${chgCls} tabular-nums text-right">${chgStr}</div>
                    <div class="text-[9px] text-slate-600 w-5 text-center">#${i+1}</div>
                </div>`;
            }).join('');
        }
        if (updEl) updEl.textContent = new Date().toLocaleTimeString('id-ID');
    } catch(e) {}

    // Pair prices from _lastPrices
    if (pairEl && Object.keys(_lastPrices).length) {
        const FX_PAIRS = ['EURUSD','GBPUSD','USDJPY','AUDUSD','NZDUSD','USDCHF','USDCAD'];
        pairEl.innerHTML = FX_PAIRS.map(sym => {
            const d = _lastPrices[sym];
            if (!d) return '';
            const price = fmt(sym, d.price);
            const pct = parseFloat(d.chgPct ?? 0);
            const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
            const cls = pct >= 0 ? 'text-qi-green' : 'text-qi-red';
            return `<div class="flex items-center justify-between py-1.5 border-b border-qi-border/40 last:border-0">
                <span class="text-[11px] font-semibold text-white font-mono">${SYMBOL_LABELS[sym]||sym}</span>
                <span class="text-[11px] font-mono text-white tabular-nums">${price}</span>
                <span class="text-[10px] font-mono ${cls} tabular-nums">${pctStr}</span>
            </div>`;
        }).filter(Boolean).join('');
    }
}

// ─── Strength Tab Switcher ────────────────────────────────────────────────
let _strTab = 'forex';
const _strTabMap = { forex:'Forex', crypto:'Crypto', commodities:'Comm' };
function switchStrengthTab(tab) {
    _strTab = tab;
    Object.entries(_strTabMap).forEach(([key, suffix]) => {
        const panel = document.getElementById('strPanel' + suffix);
        const btn   = document.getElementById('strTab' + suffix);
        if (panel) panel.classList.toggle('hidden', key !== tab);
        if (btn) {
            btn.className = key === tab
                ? 'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-qi-cyan/15 text-qi-cyan border border-qi-cyan/30'
                : 'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-slate-800 text-slate-400 border border-qi-border';
        }
    });
    if (tab === 'crypto')      fetchCryptoStrength();
    if (tab === 'commodities') fetchCommodityStrength();
}

const CRYPTO_COLORS = { BTC:'#F7931A', ETH:'#627EEA', SOL:'#9945FF', BNB:'#F3BA2F', XRP:'#23292F', DOGE:'#C2A633' };
const CRYPTO_SYMS   = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT'];

async function fetchCryptoStrength() {
    const barsEl  = document.getElementById('cryptoStrengthBars');
    const tableEl = document.getElementById('cryptoStrengthTable');
    if (barsEl) barsEl.innerHTML = '<div class="text-[11px] text-slate-600 text-center py-4 animate-pulse">Memuat data crypto dari TradingView…</div>';

    try {
        const res  = await fetch('api/tv-scan.php?symbols=' + CRYPTO_SYMS.join(','));
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);
        const data = json.data || {};

        const items = CRYPTO_SYMS.map(sym => {
            const d = data[sym];
            if (!d) return null;
            const chg = d.change != null ? d.change : 0;
            const rec = d.timeframes?.['1D']?.value ?? 0;
            const score = Math.max(0, Math.min(100, Math.round(50 + rec * 50)));
            const name = sym.replace('USDT','');
            return { name, sym, score, chg, price: d.price, rec, signal: d.timeframes?.['1D']?.signal || 'NEUTRAL' };
        }).filter(Boolean).sort((a,b) => b.score - a.score);

        if (barsEl && items.length) {
            barsEl.innerHTML = items.map((c, i) => {
                const color = CRYPTO_COLORS[c.name] || '#94A3B8';
                const chgStr = (c.chg >= 0 ? '+' : '') + c.chg.toFixed(2) + '%';
                const chgCls = c.chg > 0 ? 'text-qi-green' : c.chg < 0 ? 'text-qi-red' : 'text-slate-500';
                return `<div class="flex items-center gap-2">
                    <div class="w-10 text-right text-[11px] font-mono font-bold text-white">${c.name}</div>
                    <div class="flex-1 bg-qi-panel rounded-full h-3 overflow-hidden">
                        <div class="strength-bar h-full rounded-full" style="width:${c.score}%;background:${color}"></div>
                    </div>
                    <div class="w-8 text-[11px] font-mono text-slate-400 tabular-nums">${c.score}</div>
                    <div class="w-14 text-[10px] font-mono ${chgCls} tabular-nums text-right">${chgStr}</div>
                    <div class="text-[9px] text-slate-600 w-5 text-center">#${i+1}</div>
                </div>`;
            }).join('');
        }

        if (tableEl && items.length) {
            tableEl.innerHTML = items.map(c => {
                const sigCls = c.signal.includes('BUY') ? 'text-qi-green' : c.signal.includes('SELL') ? 'text-qi-red' : 'text-slate-400';
                const priceFmt = c.price >= 1 ? c.price.toLocaleString('en-US',{maximumFractionDigits:2}) : c.price.toFixed(6);
                const chgCls = c.chg >= 0 ? 'text-qi-green' : 'text-qi-red';
                return `<div class="flex items-center justify-between py-1.5 border-b border-qi-border/40 last:border-0">
                    <span class="text-[11px] font-semibold text-white font-mono">${c.name}/USDT</span>
                    <span class="text-[11px] font-mono text-white tabular-nums">$${priceFmt}</span>
                    <span class="text-[10px] font-mono ${chgCls} tabular-nums">${c.chg>=0?'+':''}${c.chg.toFixed(2)}%</span>
                    <span class="text-[10px] font-mono font-bold ${sigCls}">${c.signal.replace('_',' ')}</span>
                </div>`;
            }).join('');
        }

        const updEl = document.getElementById('strengthUpdated2');
        if (updEl) updEl.textContent = new Date().toLocaleTimeString('id-ID') + ' · TradingView';
    } catch(e) {
        if (barsEl) barsEl.innerHTML = `<div class="text-qi-red text-[11px] text-center py-4">${e.message}</div>`;
    }
}

const COMM_SYMS   = ['XAUUSD','XAGUSD','WTIUSD','NGAS','COPPER','PLATINUM'];
const COMM_LABELS = { XAUUSD:'Gold', XAGUSD:'Silver', WTIUSD:'Crude Oil', NGAS:'Natural Gas', COPPER:'Copper', PLATINUM:'Platinum' };
const COMM_COLORS = { XAUUSD:'#FFD700', XAGUSD:'#C0C0C0', WTIUSD:'#4A7C59', NGAS:'#3498DB', COPPER:'#B87333', PLATINUM:'#E5E4E2' };

async function fetchCommodityStrength() {
    const barsEl  = document.getElementById('commStrengthBars');
    const tableEl = document.getElementById('commStrengthTable');
    if (barsEl) barsEl.innerHTML = '<div class="text-[11px] text-slate-600 text-center py-4 animate-pulse">Memuat data komoditas dari TradingView…</div>';

    try {
        const res  = await fetch('api/tv-scan.php?symbols=' + COMM_SYMS.join(','));
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);
        const data = json.data || {};

        const items = COMM_SYMS.map(sym => {
            const d = data[sym];
            if (!d) return null;
            const chg = d.change != null ? d.change : 0;
            const rec = d.timeframes?.['1D']?.value ?? 0;
            const score = Math.max(0, Math.min(100, Math.round(50 + rec * 50)));
            const sig = d.timeframes?.['1D']?.signal || 'NEUTRAL';
            return { sym, name: COMM_LABELS[sym] || sym, score, chg, price: d.price, signal: sig.replace('_',' ') };
        }).filter(Boolean).sort((a,b) => b.score - a.score);

        if (barsEl && items.length) {
            barsEl.innerHTML = items.map((c, i) => {
                const color = COMM_COLORS[c.sym] || '#94A3B8';
                const chgStr = (c.chg >= 0 ? '+' : '') + c.chg.toFixed(2) + '%';
                const chgCls = c.chg > 0 ? 'text-qi-green' : c.chg < 0 ? 'text-qi-red' : 'text-slate-500';
                return `<div class="flex items-center gap-2">
                    <div class="w-14 text-right text-[11px] font-mono font-bold text-white">${c.name}</div>
                    <div class="flex-1 bg-qi-panel rounded-full h-3 overflow-hidden">
                        <div class="strength-bar h-full rounded-full" style="width:${c.score}%;background:${color}"></div>
                    </div>
                    <div class="w-8 text-[11px] font-mono text-slate-400 tabular-nums">${c.score}</div>
                    <div class="w-14 text-[10px] font-mono ${chgCls} tabular-nums text-right">${chgStr}</div>
                    <div class="text-[9px] text-slate-600 w-5 text-center">#${i+1}</div>
                </div>`;
            }).join('');
        }

        if (tableEl && items.length) {
            tableEl.innerHTML = items.map(c => {
                const sigCls = c.signal.includes('BUY') ? 'text-qi-green' : c.signal.includes('SELL') ? 'text-qi-red' : 'text-slate-400';
                const pFmt = c.price != null ? c.price.toLocaleString('en-US',{maximumFractionDigits:2}) : '—';
                const chgCls = c.chg >= 0 ? 'text-qi-green' : 'text-qi-red';
                return `<div class="flex items-center justify-between py-1.5 border-b border-qi-border/40 last:border-0">
                    <span class="text-[11px] font-semibold text-white font-mono">${c.name}</span>
                    <span class="text-[11px] font-mono text-white tabular-nums">$${pFmt}</span>
                    <span class="text-[10px] font-mono ${chgCls} tabular-nums">${c.chg>=0?'+':''}${c.chg.toFixed(2)}%</span>
                    <span class="text-[10px] font-mono font-bold ${sigCls}">${c.signal}</span>
                </div>`;
            }).join('');
        }

        const updEl = document.getElementById('strengthUpdated2');
        if (updEl) updEl.textContent = new Date().toLocaleTimeString('id-ID') + ' · TradingView';
    } catch(e) {
        if (barsEl) barsEl.innerHTML = `<div class="text-qi-red text-[11px] text-center py-4">${e.message}</div>`;
    }
}

// ─── Radar Quick Scan (mover bars) ────────────────────────────────────────
function renderRadarQuickScan() {
    const el  = document.getElementById('radarQuickScan');
    const upd = document.getElementById('radarMoverUpdated');
    if (!el || !Object.keys(_lastPrices).length) {
        if (el) el.innerHTML = '<div class="px-4 py-6 text-center text-slate-600 text-xs">Memuat data harga…</div>';
        setTimeout(renderRadarQuickScan, 2000);
        return;
    }
    const sorted = Object.entries(_lastPrices)
        .map(([sym, d]) => ({ sym, pct: parseFloat(d.chgPct ?? 0), price: d.price }))
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    el.innerHTML = sorted.map(({ sym, pct, price }) => {
        const cls = pct >= 0 ? 'text-qi-green' : 'text-qi-red';
        const bar = pct >= 0 ? 'bg-qi-green' : 'bg-qi-red';
        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        const barW = Math.min(Math.abs(pct) * 15, 100).toFixed(0);
        const label = SYMBOL_LABELS[sym] || sym;
        const priceStr = fmt(sym, price);
        return `<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[.02] transition-colors">
            <span class="text-[11px] font-semibold text-white font-mono w-20 shrink-0">${label}</span>
            <span class="text-[11px] font-mono text-slate-400 tabular-nums w-20 shrink-0">${priceStr}</span>
            <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full ${bar}" style="width:${barW}%"></div>
            </div>
            <span class="text-[11px] font-mono tabular-nums ${cls} w-16 text-right shrink-0">${pctStr}</span>
        </div>`;
    }).join('');
    if (upd) upd.textContent = new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
}

// ─── AI Radar Full Scan ────────────────────────────────────────────────────
const RADAR_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT'];

async function runRadarScan() {
    const body   = document.getElementById('radarScanBody');
    const status = document.getElementById('radarStatus');
    if (!body) return;
    if (status) status.textContent = 'Scanning…';
    body.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-600 text-xs">Menganalisa ${RADAR_SYMS.length} instrumen…</td></tr>`;

    const results = await Promise.allSettled(
        RADAR_SYMS.map(sym =>
            fetch(`api/get-chart-data.php?symbol=${sym}&interval=60`).then(r => r.json())
        )
    );

    let bull=0, bear=0, neut=0;
    const rows = results.map((res, i) => {
        const sym   = RADAR_SYMS[i];
        const label = SYMBOL_LABELS[sym] || sym;
        const price = _lastPrices[sym];
        const priceStr = price ? fmt(sym, price.price) : '—';
        const pct = price ? parseFloat(price.chgPct ?? 0) : 0;
        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        const pctCls = pct >= 0 ? 'text-qi-green' : 'text-qi-red';

        if (res.status !== 'fulfilled' || !res.value.candles?.length) {
            neut++;
            return `<tr class="border-b border-qi-border/50">
                <td class="px-4 py-2.5 font-semibold text-white">${label}</td>
                <td class="px-3 py-2.5 text-center font-mono text-slate-400">${priceStr}</td>
                <td class="px-3 py-2.5 text-center font-mono ${pctCls}">${pctStr}</td>
                <td colspan="5" class="px-3 py-2.5 text-center text-slate-600 text-[10px]">Data tidak tersedia</td>
            </tr>`;
        }
        const candles = res.value.candles;
        const last20  = candles.slice(-20);
        const last14  = candles.slice(-14);

        // RSI estimate from gain/loss ratio
        const gains  = last14.reduce((s,c) => s + (c.close > c.open ? c.close - c.open : 0), 0);
        const losses = last14.reduce((s,c) => s + (c.close < c.open ? c.open - c.close : 0), 0);
        const rs     = losses > 0 ? gains / losses : 100;
        const rsi    = Math.round(100 - 100 / (1 + rs));
        const rsiCls = rsi > 65 ? 'text-qi-red' : rsi < 35 ? 'text-qi-cyan' : 'text-slate-400';

        // EMA9 & EMA21 bias (simplified)
        function ema(arr, period) {
            const k = 2 / (period + 1);
            let e = arr[0].close;
            for (let i = 1; i < arr.length; i++) e = arr[i].close * k + e * (1 - k);
            return e;
        }
        const ema9  = ema(last20, 9);
        const ema21 = ema(last20, 21);
        const lastClose = last20[last20.length - 1].close;
        const emaBias = lastClose > ema9 && ema9 > ema21 ? 'BULLISH' :
                        lastClose < ema9 && ema9 < ema21 ? 'BEARISH' : 'MIXED';
        const emaCls = emaBias === 'BULLISH' ? 'text-qi-green' : emaBias === 'BEARISH' ? 'text-qi-red' : 'text-slate-400';

        // H1 trend (last 10 candles bullish count)
        const bull10 = last20.slice(-10).filter(c => c.close > c.open).length;
        const trend  = bull10 >= 7 ? 'UP ▲' : bull10 <= 3 ? 'DOWN ▼' : 'FLAT ◆';
        const trendCls = bull10 >= 7 ? 'text-qi-green' : bull10 <= 3 ? 'text-qi-red' : 'text-slate-400';

        // Volume compared to average
        const avgVol   = last20.slice(0,-1).reduce((s,c) => s + parseFloat(c.volume||0), 0) / 19;
        const curVol   = parseFloat(last20[last20.length-1].volume || 0);
        const volLabel = curVol > avgVol * 1.5 ? 'TINGGI' : curVol < avgVol * 0.5 ? 'RENDAH' : 'NORMAL';
        const volCls   = curVol > avgVol * 1.5 ? 'text-qi-gold' : 'text-slate-400';

        // Overall signal
        let score = 0;
        if (emaBias === 'BULLISH') score += 2; if (emaBias === 'BEARISH') score -= 2;
        if (bull10 >= 7) score++; if (bull10 <= 3) score--;
        if (rsi < 35) score += 1.5; if (rsi > 65) score -= 1.5;
        const signal = score >= 2 ? 'BULLISH' : score <= -2 ? 'BEARISH' : 'NEUTRAL';
        const sigCls = signal === 'BULLISH' ? 'text-qi-green font-bold' : signal === 'BEARISH' ? 'text-qi-red font-bold' : 'text-slate-500';
        const sigIcon = signal === 'BULLISH' ? '▲' : signal === 'BEARISH' ? '▼' : '◆';
        if (signal === 'BULLISH') bull++; else if (signal === 'BEARISH') bear++; else neut++;

        return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02] transition-colors">
            <td class="px-4 py-2.5 font-semibold text-white text-[11px]">${label}</td>
            <td class="px-3 py-2.5 text-center font-mono text-white tabular-nums text-[11px]">${priceStr}</td>
            <td class="px-3 py-2.5 text-center font-mono tabular-nums text-[11px] ${pctCls}">${pctStr}</td>
            <td class="px-3 py-2.5 text-center font-mono text-[10px] ${trendCls}">${trend}</td>
            <td class="px-3 py-2.5 text-center font-mono text-[10px] ${rsiCls}">${rsi}</td>
            <td class="px-3 py-2.5 text-center font-mono text-[10px] ${emaCls}">${emaBias}</td>
            <td class="px-3 py-2.5 text-center font-mono text-[10px] ${volCls}">${volLabel}</td>
            <td class="px-3 py-2.5 text-center font-mono text-[10px] ${sigCls}">${sigIcon} ${signal}</td>
        </tr>`;
    });

    body.innerHTML = rows.join('');
    const bEl = document.getElementById('radarBullCount');
    const beEl= document.getElementById('radarBearCount');
    const nEl = document.getElementById('radarNeutCount');
    if (bEl) bEl.textContent = bull;
    if (beEl) beEl.textContent = bear;
    if (nEl) nEl.textContent = neut;
    if (status) status.textContent = `Diperbarui ${new Date().toLocaleTimeString('id-ID')}`;
}

// ─── Paper Trading ─────────────────────────────────────────────────────────
// Multiplier: berapa USD per unit per lot (supaya P&L masuk akal)
// Model P/L tunggal: assets/js/qim-paper-math.js (kembaran api/_paper_math.php). Isi lama di
// bawah hanya cadangan bila berkas itu tidak termuat.
function ptPnlMult(sym, price) {
    if (typeof window.qimPaperMult === 'function') return window.qimPaperMult(sym, price);
    const isCrypto = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT'].includes(sym);
    if (isCrypto) return 1;          // 0.1 lots BTC, harga naik $100 → +$10
    if (sym === 'XAUUSD') return 100; // 1 lot XAU = 100 oz
    if (sym.includes('JPY')) return 1000; // pip JPY lebih kecil
    return 10000; // forex majors: 0.01 lot EURUSD, +10 pip (+0.001) → $10*0.01 = $0.10... scale ke 10k
}
let _ptBalance   = 10000;
let _ptPositions = []; // {id, symbol, side, lots, entryPrice, sl, tp, openTime}
let _ptHistory   = [];
let _ptRealized  = 0;

async function ptUpdateLivePrice() {
    const sym = document.getElementById('ptSymbol')?.value;
    const el  = document.getElementById('ptLivePrice');
    if (!sym || !el) return;

    let d = _lastPrices[sym];
    // If price not in cache, fetch directly
    if (!d) {
        try {
            const url = (sym.endsWith('USDT') && sym !== 'BTCUSDT')
                ? `https://api.binance.com/api/v3/ticker/price?symbol=${sym}`
                : `api/get-chart-data.php?symbol=${encodeURIComponent(sym)}&tf=1&limit=2`;
            const r = await fetch(url);
            const j = await r.json();
            const candles = j.candles || (Array.isArray(j) ? j : []);
            const price = j.price ? parseFloat(j.price) : candles.length ? candles.slice(-1)[0]?.close : null;
            if (price) { d = { price }; _lastPrices[sym] = d; }
        } catch(e) {}
    }

    if (d) {
        const priceStr = fmt(sym, d.price);
        el.textContent = priceStr;
        el.className = 'text-qi-cyan font-semibold font-mono';
        const entry = document.getElementById('ptEntryPrice');
        if (entry && !entry._userEdited) {
            entry.value = '';
            entry.placeholder = fmtRaw(sym, d.price);
        }
    } else {
        el.textContent = '—';
    }
}

function fmtRaw(sym, price) {
    const p = parseFloat(price);
    if (isNaN(p)) return '—';
    if (sym === 'USDJPY') return p.toFixed(3);
    if (sym.endsWith('USDT') || sym === 'XAUUSD') return p.toFixed(2);
    return p.toFixed(5);
}

function ptRender() {
    // Balance
    const floatPnl = _ptPositions.reduce((sum, p) => {
        const cur = _lastPrices[p.symbol];
        if (!cur) return sum;
        const curPrice   = parseFloat(cur.price);
        const entryPrice = parseFloat(p.entryPrice);
        const priceDiff  = p.side === 'BUY' ? curPrice - entryPrice : entryPrice - curPrice;
        return sum + priceDiff * p.lots * ptPnlMult(p.symbol, curPrice);
    }, 0);

    const bEl = document.getElementById('ptBalance');
    const fEl = document.getElementById('ptFloating');
    const rEl = document.getElementById('ptRealized');
    const cEl = document.getElementById('ptOpenCount');
    if (bEl) bEl.textContent = '$' + (_ptBalance).toLocaleString('en-US',{minimumFractionDigits:2});
    if (fEl) {
        fEl.textContent = (floatPnl >= 0 ? '+$' : '-$') + Math.abs(floatPnl).toFixed(2);
        fEl.className = `font-mono font-bold ${floatPnl >= 0 ? 'text-qi-green' : 'text-qi-red'}`;
    }
    if (rEl) {
        rEl.textContent = (_ptRealized >= 0 ? '+$' : '-$') + Math.abs(_ptRealized).toFixed(2);
        rEl.className = `font-mono font-bold ${_ptRealized >= 0 ? 'text-qi-green' : 'text-qi-red'}`;
    }
    if (cEl) cEl.textContent = _ptPositions.length;

    // Positions table
    const posBody = document.getElementById('ptPositionsBody');
    if (posBody) {
        if (!_ptPositions.length) {
            posBody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-600">Belum ada posisi terbuka</td></tr>';
        } else {
            posBody.innerHTML = _ptPositions.map(p => {
                const cur      = _lastPrices[p.symbol];
                const curPrice = cur ? parseFloat(cur.price) : parseFloat(p.entryPrice);
                const entryF   = parseFloat(p.entryPrice);
                const diff     = p.side === 'BUY' ? curPrice - entryF : entryF - curPrice;
                const pnlRaw   = diff * p.lots * ptPnlMult(p.symbol, curPrice);
                const pnlPct   = entryF > 0 ? (diff / entryF * 100) : 0;
                const pnlCls   = pnlRaw >= 0 ? 'text-qi-green' : 'text-qi-red';
                const sideCls = p.side === 'BUY' ? 'text-qi-green' : 'text-qi-red';
                return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02]">
                    <td class="px-4 py-2.5 font-semibold text-white text-[11px]">${SYMBOL_LABELS[p.symbol]||p.symbol}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] font-bold ${sideCls}">${p.side}</td>
                    <td class="px-3 py-2.5 text-center text-[11px]">${p.lots}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] tabular-nums">${fmt(p.symbol, p.entryPrice)}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] tabular-nums text-qi-cyan">${fmt(p.symbol, curPrice)}</td>
                    <td class="px-3 py-2.5 text-center text-[10px] text-slate-500">${p.sl||'—'} / ${p.tp||'—'}</td>
                    <td class="px-3 py-2.5 text-center text-[11px] tabular-nums font-bold ${pnlCls}">${pnlRaw>=0?'+$':'-$'}${Math.abs(pnlRaw).toFixed(2)}<br><span class="text-[9px] opacity-60">${pnlPct>=0?'+':''}${pnlPct.toFixed(2)}%</span></td>
                    <td class="px-3 py-2.5 text-center">
                        <button onclick="ptClosePosition('${p.id}')" class="text-[10px] text-qi-red hover:underline font-mono">Tutup</button>
                    </td>
                </tr>`;
            }).join('');
        }
    }

    // History table
    const hisBody = document.getElementById('ptHistoryBody');
    if (hisBody) {
        if (!_ptHistory.length) {
            hisBody.innerHTML = '<tr><td colspan="7" class="px-4 py-4 text-center text-slate-600">Belum ada riwayat</td></tr>';
        } else {
            hisBody.innerHTML = _ptHistory.slice(0, 30).map(h => {
                const pnlCls = h.pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
                const sideCls = h.side === 'BUY' ? 'text-qi-green' : 'text-qi-red';
                return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02]">
                    <td class="px-4 py-2 font-semibold text-white text-[11px]">${SYMBOL_LABELS[h.symbol]||h.symbol}</td>
                    <td class="px-3 py-2 text-center text-[11px] ${sideCls}">${h.side}</td>
                    <td class="px-3 py-2 text-center text-[11px]">${h.lots}</td>
                    <td class="px-3 py-2 text-center text-[11px] tabular-nums">${fmt(h.symbol, h.entryPrice)}</td>
                    <td class="px-3 py-2 text-center text-[11px] tabular-nums">${fmt(h.symbol, h.closePrice)}</td>
                    <td class="px-3 py-2 text-center text-[11px] font-bold ${pnlCls}">${h.pnl>=0?'+$':'-$'}${Math.abs(h.pnl).toFixed(2)}</td>
                    <td class="px-3 py-2 text-center text-[10px] text-slate-500">${h.closeTime||''}</td>
                </tr>`;
            }).join('');
        }
    }
}

function ptOpenPosition() {
    const sym   = document.getElementById('ptSymbol')?.value;
    const side  = document.getElementById('ptSide')?.value;
    const lots  = parseFloat(document.getElementById('ptLots')?.value || 0.1);
    const epRaw = document.getElementById('ptEntryPrice')?.value;
    const sl    = parseFloat(document.getElementById('ptSL')?.value) || null;
    const tp    = parseFloat(document.getElementById('ptTP')?.value) || null;

    if (!sym || !side || lots <= 0) return;
    const cur = _lastPrices[sym];
    const entryPrice = epRaw ? parseFloat(epRaw) : (cur ? parseFloat(cur.price) : null);
    if (!entryPrice) { showQuantumToast('Tunggu harga live termuat.', 'warning'); return; }

    const pos = {
        id: 'PT-' + Date.now(),
        symbol: sym, side, lots, entryPrice, sl, tp,
        openTime: new Date().toLocaleTimeString('id-ID'),
        openedAt: new Date().toISOString(),
    };
    _ptPositions.push(pos);
    ptSaveToServer();
    ptRender();
}

function ptOpenDirectPosition(sym, side, entry, sl, tp, lots = 0.1) {
    sym = (sym || '').toUpperCase();
    side = (side || '').toUpperCase();
    if (!sym || !side) return;
    const cur = _lastPrices[sym];
    const entryPrice = entry ? parseFloat(entry) : (cur ? parseFloat(cur.price) : null);
    if (!entryPrice) {
        if (typeof showQuantumToast === 'function') showQuantumToast('Tunggu harga live ' + sym + ' termuat.', 'warning');
        return;
    }
    const pos = {
        id: 'PT-' + Date.now(),
        symbol: sym, side, lots: parseFloat(lots || 0.1),
        entryPrice,
        sl: sl ? parseFloat(sl) : null,
        tp: tp ? parseFloat(tp) : null,
        openTime: new Date().toLocaleTimeString('id-ID'),
        openedAt: new Date().toISOString(),
    };
    _ptPositions.push(pos);
    ptSaveToServer();
    ptRender();
    if (typeof showQuantumToast === 'function') {
        showQuantumToast(`✓ Posisi Paper Trade dibuka: ${side} ${sym} (${pos.lots} lot)`, 'success');
    }
}
window.ptOpenDirectPosition = ptOpenDirectPosition;

function ptClosePosition(id) {
    const idx = _ptPositions.findIndex(p => p.id === id);
    if (idx < 0) return;
    const p = _ptPositions[idx];
    const cur        = _lastPrices[p.symbol];
    const closePrice = cur ? parseFloat(cur.price) : parseFloat(p.entryPrice);
    const entryF     = parseFloat(p.entryPrice);
    const diff       = p.side === 'BUY' ? closePrice - entryF : entryF - closePrice;
    const pnl        = diff * p.lots * ptPnlMult(p.symbol, closePrice);
    _ptRealized += pnl;
    const now = new Date();
    _ptHistory.unshift({ ...p, closePrice, pnl, realizedPnL: pnl, closeTime: now.toLocaleTimeString('id-ID'), closedAt: now.toISOString() });
    _ptPositions.splice(idx, 1);
    ptSaveToServer();
    ptRender();
}

function ptRefreshPnL() { ptRender(); }

async function ptLoadFromServer() {
    try {
        const res = await fetch('api/paper-trading.php', { headers: (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders() : {}, cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'success') return;
        // openedAt/closedAt = ISO UTC dari server → jam lokal browser (jam H:i:s server memakai zona PHP)
        const jam = (iso, cadangan) => iso ? new Date(iso).toLocaleTimeString('id-ID') : (cadangan || '');
        _ptBalance   = data.data.balance ?? 10000;
        _ptPositions = (data.data.positions || []).map(p => ({
            id: p.id || 'PT-' + Date.now(),
            symbol: p.symbol, side: p.side, lots: p.lots,
            entryPrice: p.entryPrice, sl: p.sl, tp: p.tp,
            openTime: jam(p.openedAt, p.openTime), openedAt: p.openedAt || null,
        }));
        // Baris server membawa realizedPnL (bukan pnl) → samakan dengan baris yang ditutup di klien
        _ptHistory  = (data.data.history || []).map(h => {
            const pnl = Number(h.realizedPnL ?? h.pnl ?? 0) || 0;
            return { ...h, pnl, realizedPnL: pnl, closeTime: jam(h.closedAt, h.closeTime) };
        });
        _ptRealized = _ptHistory.reduce((s,h) => s + h.pnl, 0);
        ptRender();
    } catch(e) { ptRender(); }
}

async function ptSaveToServer() {
    try {
        const payload = {
            balance: _ptBalance,
            positions: _ptPositions.map(p => ({
                id: p.id, symbol: p.symbol, side: p.side, lots: p.lots,
                entryPrice: p.entryPrice, sl: p.sl, tp: p.tp, openTime: p.openTime,
                openedAt: p.openedAt || null,
            })),
            history: _ptHistory.slice(0, 200).map(h => ({
                id: h.id, symbol: h.symbol, side: h.side, lots: h.lots,
                entryPrice: h.entryPrice, closePrice: h.closePrice,
                realizedPnL: h.realizedPnL ?? h.pnl, closeTime: h.closeTime,
                openedAt: h.openedAt || null, closedAt: h.closedAt || null,
            })),
        };
        const res = await fetch('api/paper-trading.php', {
            method: 'POST',
            headers: (window.QuantumAuth && QuantumAuth.authHeaders) ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        // Server yang menentukan P/L & menolak harga/penutupan yang tidak wajar → tampilkan
        // alasannya dan muat ulang supaya tampilan sama dengan yang tersimpan.
        const hasil = await res.json().catch(() => null);
        if (hasil && Array.isArray(hasil.ditolak) && hasil.ditolak.length) {
            if (typeof showQuantumToast === 'function') showQuantumToast('Paper trading: ' + hasil.ditolak[0].alasan, 'warning', 6000);
            await ptLoadFromServer();
        } else if (hasil && hasil.status === 'success') {
            await ptLoadFromServer();
        }
    } catch(e) {}
}

// ─── Track Record ──────────────────────────────────────────────────────────
/**
 * Format P/L sinyal. Nilainya adalah hasil untuk posisi 1 lot, sehingga sinyal
 * kripto bisa bernilai kecil (mis. +0,22). toFixed(0) akan menampilkan "+$0" —
 * itu menyesatkan (seolah tidak untung), jadi jumlah desimalnya menyesuaikan
 * besaran nilainya.
 */
function formatPnlUsd(v) {
    const n = Number(v) || 0;
    const a = Math.abs(n);
    const dp = a < 1 ? 3 : (a < 100 ? 2 : 0);
    return (n >= 0 ? '+$' : '-$') + a.toFixed(dp);
}

async function fetchTrackRecord() {
    const sym = document.getElementById('trFilterSym')?.value || '';
    const eng = document.getElementById('trFilterEng')?.value || '';
    const body = document.getElementById('trackHistoryBody');
    if (body) body.innerHTML = '<tr><td colspan="10" class="px-4 py-4 text-center text-slate-600">Memuat…</td></tr>';

    try {
        let url = 'api/signal-history.php';
        const params = [];
        if (sym) params.push(`symbol=${sym}`);
        if (eng) params.push(`engine=${eng}`);
        if (params.length) url += '?' + params.join('&');

        const res  = await fetch(url);
        const data = await res.json();
        const m    = data.metrics || {};
        const hist = data.history || [];

        // Metrics
        const wrEl = document.getElementById('trWinRate');
        const pfEl = document.getElementById('trPF');
        const npEl = document.getElementById('trNetPnl');
        const totEl= document.getElementById('trTotal');
        const rrEl = document.getElementById('trRR');
        const ddEl = document.getElementById('trDD');
        if (wrEl) { const wr = (m.win_rate === null || m.win_rate === undefined) ? null : Number(m.win_rate); wrEl.textContent = wr === null ? '—' : wr + '%'; wrEl.className = `font-mono font-bold ${wr === null ? 'text-slate-400' : (wr >= 50 ? 'text-qi-green' : 'text-qi-red')}`; }
        if (pfEl) pfEl.textContent = m.profit_factor || '—';
        if (npEl) { const n = m.net_pnl_usd||0; npEl.textContent = formatPnlUsd(n); npEl.className = `font-mono font-bold ${n>=0?'text-qi-green':'text-qi-red'}`; }
        if (totEl) totEl.textContent = m.total_signals || 0;
        if (rrEl) rrEl.textContent = m.avg_rr || '—';
        if (ddEl) {
            // Drawdown dari server: bila persentase memang belum sah (mis. kurva modal belum
            // pernah di atas titik awal) server mengirim null → tampilkan "—" dan nilai R-nya,
            // JANGAN "0%" yang menyesatkan (dulu: `(m.max_drawdown_pct||0) + '%'`).
            const ddPct = (m.max_drawdown_pct === null || m.max_drawdown_pct === undefined) ? null : Number(m.max_drawdown_pct);
            const ddR = (m.max_drawdown_r === null || m.max_drawdown_r === undefined) ? null : Number(m.max_drawdown_r);
            ddEl.textContent = (ddPct !== null) ? (ddPct + '%') : (ddR !== null ? (ddR + 'R') : '—');
            ddEl.className = 'font-mono font-bold ' + ((ddPct !== null && ddPct > 20) || (ddR !== null && ddR >= 3) ? 'text-qi-red' : 'text-slate-200');
            ddEl.title = (ddPct !== null)
                ? 'Penurunan terbesar dari puncak kurva modal (satuan %).'
                : 'Persentase belum bisa dihitung karena kurva modal belum pernah di atas titik awal; ditampilkan dalam satuan R (bukan 0%).';
        }

        // ── BELAJAR DARI SL (Tahap 2) — semua angka dari server, apa adanya ──────
        // Bila analisa belum tersedia (tabel belum dimigrasi), panel MENULISKAN sebabnya
        // dan tidak menampilkan angka kosong yang bisa disalahartikan sebagai nol.
        try {
            const sl = data.sl_analisa || null;
            const kartu = document.getElementById('slKartu');
            if (kartu) {
                if (!sl || sl.tersedia !== true) {
                    const j = document.getElementById('slJumlah');
                    if (j) j.textContent = 'belum tersedia';
                    const c = document.getElementById('slCatatan');
                    if (c) c.textContent = (sl && sl.catatan) ? sl.catatan : 'Analisa SL belum tersedia.';
                } else {
                    const labelSebab = {
                        sl_terlalu_ketat: 'SL terlalu ketat (<1× ATR)',
                        sapuan_likuiditas: 'terindikasi sapuan likuiditas',
                        tf_konflik: 'timeframe tidak selaras',
                        volatilitas_ekstrem: 'volatilitas ekstrem',
                        perlu_data_harga: 'data harga belum lengkap',
                        tidak_diketahui: 'belum dapat ditentukan',
                    };
                    const j = document.getElementById('slJumlah');
                    if (j) j.textContent = (sl.jumlah_sl || 0) + ' SL dianalisa · ' + (sl.rincian ? sl.rincian.length : 0) + ' terbaru';
                    const isi = (peta, ubah) => {
                        const k = Object.keys(peta || {});
                        if (!k.length) return '<div class="text-slate-600">belum ada data</div>';
                        return k.sort((a, b) => peta[b] - peta[a]).map(x =>
                            '<div class="flex justify-between gap-2"><span class="text-slate-400">' + (ubah ? ubah(x) : x) + '</span><span>' + peta[x] + '</span></div>').join('');
                    };
                    const eSebab = document.getElementById('slSebab');
                    if (eSebab) eSebab.innerHTML = isi(sl.per_sebab, x => labelSebab[x] || x);
                    const eSesi = document.getElementById('slSesi');
                    if (eSesi) eSesi.innerHTML = isi(sl.per_sesi);
                    const eLebar = document.getElementById('slLebar');
                    if (eLebar) {
                        const mw = sl.rata_jarak_atr_menang || {}; const kl = sl.rata_jarak_atr_kalah || {};
                        let t = '<div class="flex justify-between gap-2"><span class="text-slate-400">menang</span><span>' + (mw.rata == null ? '—' : (mw.rata + '× (n=' + mw.n + ')')) + '</span></div>'
                              + '<div class="flex justify-between gap-2"><span class="text-slate-400">kalah</span><span>' + (kl.rata == null ? '—' : (kl.rata + '× (n=' + kl.n + ')')) + '</span></div>';
                        if (sl.selisih_jarak_atr != null) {
                            t += '<div class="flex justify-between gap-2"><span class="text-slate-400">selisih</span><span class="' + (sl.selisih_jarak_atr < 0 ? 'text-amber-300' : 'text-slate-300') + '">' + (sl.selisih_jarak_atr > 0 ? '+' : '') + sl.selisih_jarak_atr + '×</span></div>';
                        }
                        eLebar.innerHTML = t;
                    }
                    const eUsul = document.getElementById('slUsul');
                    if (eUsul) {
                        const u = sl.usul || {};
                        if (u.usul) {
                            eUsul.innerHTML = '📌 ' + String(u.usul).replace(/[<>&]/g, '')
                                + '<div class="text-slate-400 mt-1">status: <span class="text-amber-300">' + (u.status || 'menunggu') + '</span> — belum diterapkan. ' + String(u.catatan || '').replace(/[<>&]/g, '') + '</div>';
                        } else {
                            eUsul.innerHTML = '<span class="text-slate-400">Belum ada usulan. ' + String(u.catatan || '').replace(/[<>&]/g, '') + '</span>';
                        }
                    }
                    const c = document.getElementById('slCatatan');
                    if (c) c.textContent = sl.catatan_ukur || '';
                }
            }
        } catch (e) { /* kartu SL opsional: kegagalan di sini tidak boleh merusak panel */ }

        // ── Statistik satuan R + status filter berita (dihitung server, apa adanya) ──
        try {
            const st = data.statistik_r || null;
            const bo = data.blackout_berita || null;
            const set = (id, teks, kelas) => { const e = document.getElementById(id); if (e) { e.textContent = teks; if (kelas) e.className = kelas; } };
            if (st) {
                set('trStatCakupan', st.cakupan || '');
                set('trStatWL', (st.menang ?? 0) + ' / ' + (st.kalah ?? 0));
                const wr = st.win_rate;
                set('trStatWR', (wr === null || wr === undefined) ? '—' : wr + '%',
                    'font-mono font-bold ' + ((wr === null || wr === undefined) ? 'text-slate-400'
                        : (wr >= (st.titik_impas_pct ?? 50) ? 'text-qi-green' : 'text-qi-red')));
                const ci = document.getElementById('trStatWRci');
                if (ci) ci.textContent = (st.ci_bawah === null || st.ci_bawah === undefined)
                    ? '' : ('interval 95%: ' + st.ci_bawah + '–' + st.ci_atas + '%');
                const ex = st.expectancy_r;
                set('trStatExp', (ex === null || ex === undefined) ? '—' : ((ex > 0 ? '+' : '') + ex + 'R'),
                    'font-mono font-bold ' + ((ex === null || ex === undefined) ? 'text-slate-400' : (ex > 0 ? 'text-qi-green' : 'text-qi-red')));
                set('trStatPF', (st.profit_factor === null || st.profit_factor === undefined) ? '—' : String(st.profit_factor));
                set('trStatAvgR', (st.rata_r === null || st.rata_r === undefined) ? '—' : ((st.rata_r > 0 ? '+' : '') + st.rata_r + 'R'));
                set('trStatSampel', String(st.sampel ?? 0),
                    'font-mono font-bold ' + (st.cukup_sampel ? 'text-qi-green' : 'text-amber-300'));
                const isi = (arr) => (arr || []).slice(0, 6).map(d => {
                    const wrc = (d.win_rate ?? 0) >= 50 ? 'text-qi-green' : 'text-qi-red';
                    const rc  = (d.total_r ?? 0) >= 0 ? 'text-qi-green' : 'text-qi-red';
                    return '<div class="flex items-center gap-2 py-0.5">'
                        + '<span class="text-slate-300 flex-1 truncate">' + d.nama + '</span>'
                        + '<span class="text-slate-500">' + d.sinyal + '×</span>'
                        + '<span class="' + wrc + ' w-12 text-right">' + (d.win_rate ?? '—') + '%</span>'
                        + '<span class="' + rc + ' w-16 text-right">' + ((d.total_r ?? 0) > 0 ? '+' : '') + (d.total_r ?? 0) + 'R</span>'
                        + '</div>';
                }).join('') || '<div class="text-slate-600">belum ada</div>';
                const elS = document.getElementById('trStatSimbol'); if (elS) elS.innerHTML = isi(st.per_simbol);
                const elA = document.getElementById('trStatArah');   if (elA) elA.innerHTML = isi(st.per_arah);
                const ket = [];
                if (st.catatan) ket.push(st.catatan);
                if (st.r_dari_rencana) ket.push(st.r_dari_rencana + ' sinyal memakai R rencana (perkiraan) karena harga keluar belum tercatat.');
                if (st.titik_impas_pct) ket.push('Titik impas untuk R:R ' + st.rr_rata + ' = ' + st.titik_impas_pct + '% (di bawah itu sistem merugi).');
                set('trStatCatatan', ket.join(' '));
            }

            // ── PER MESIN: menjawab "berapa win rate sinyal AI?" tanpa mengarang ──
            try {
                const mesin = data.statistik_per_engine || [];
                const tb = document.getElementById('trStatMesin');
                const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                const ang = (v, suf, plus) => (v === null || v === undefined) ? '—'
                    : ((plus && v > 0 ? '+' : '') + v + (suf || ''));
                if (tb) {
                    if (!mesin.length) {
                        tb.innerHTML = '<tr><td colspan="8" class="py-2 text-slate-600">belum ada catatan sinyal</td></tr>';
                    } else {
                        tb.innerHTML = mesin.map(m => {
                            const adaNilai = m.dinilai > 0;
                            const wrCls = !adaNilai ? 'text-amber-300'
                                : ((m.win_rate ?? 0) >= (m.titik_impas_pct ?? 50) ? 'text-qi-green' : 'text-qi-red');
                            const exCls = !adaNilai ? 'text-amber-300' : ((m.expectancy_r ?? 0) > 0 ? 'text-qi-green' : 'text-qi-red');
                            const totCls = (m.total_r ?? 0) > 0 ? 'text-qi-green' : ((m.total_r ?? 0) < 0 ? 'text-qi-red' : 'text-slate-400');
                            return '<tr class="border-b border-qi-border/30" title="' + esc(m.cara) + '">'
                                + '<td class="py-1.5 pr-2 text-slate-200">' + esc(m.label)
                                + (m.engine ? ' <span class="text-slate-600 text-[9px]">' + esc(m.engine) + '</span>' : '') + '</td>'
                                + '<td class="text-right px-1.5 text-slate-300">' + (m.total ?? 0) + '</td>'
                                + '<td class="text-right px-1.5 text-slate-400">' + (m.dinilai ?? 0) + (m.aktif ? ' <span class="text-qi-cyan text-[9px]">(' + m.aktif + ' aktif)</span>' : '') + '</td>'
                                + '<td class="text-right px-1.5 text-slate-400">' + (m.menang ?? 0) + ' / ' + (m.kalah ?? 0) + '</td>'
                                + '<td class="text-right px-1.5 ' + wrCls + '">' + (adaNilai ? ang(m.win_rate, '%') : '—') + '</td>'
                                + '<td class="text-right px-1.5 ' + exCls + '">' + (adaNilai ? ang(m.expectancy_r, 'R', true) : '—') + '</td>'
                                + '<td class="text-right px-1.5 text-qi-cyan">' + ang(m.profit_factor) + '</td>'
                                + '<td class="text-right pl-1.5 ' + totCls + '">' + ang(m.total_r, 'R', true) + '</td>'
                                + '</tr>';
                        }).join('');
                    }
                }
                // Kalimat penjelas: utamakan mesin AI (itulah yang ditanyakan pengguna).
                const cat = document.getElementById('trStatMesinCatatan');
                if (cat) {
                    const ai = mesin.find(m => m.engine === 'AI' || m.engine === 'AI_SIGNAL');
                    const bagian = [];
                    if (ai) {
                        bagian.push(ai.dinilai > 0
                            ? ('Analisa AI: ' + ai.dinilai + ' sinyal tertutup, win rate ' + ai.win_rate + '% (interval 95%: ' + ai.ci_bawah + '–' + ai.ci_atas + '%).')
                            : ('Analisa AI: ' + (ai.total || 0) + ' catatan, ' + (ai.aktif || 0) + ' masih aktif, 0 sinyal tertutup — persentase kemenangannya belum bisa dihitung (bukan 0%).'));
                    } else {
                        // CATATAN DIPERBARUI (2026-10-13): jalur AI (api/ai-signal.php) SEKARANG
                        // menulis rekor bila AI memutuskan ENTRY (BUY/SELL) — level diturunkan dari
                        // ATR14 H1 nyata bila AI tidak memberi level, dan asal level ditulis di kolom
                        // basis. Jadi "belum ada catatan" berarti AI belum pernah memutuskan ENTRY,
                        // bukan berarti jalurnya tidak mencatat.
                        bagian.push('Analisa AI: belum ada catatan di riwayat. Jalur AI (ai-signal.php) menulis rekor HANYA bila AI memutuskan ENTRY (BUY/SELL); bila AI memutuskan tunggu/sideway, memang belum ada yang dicatat — bukan rekor yang hilang.');
                    }
                    bagian.push('Titik impas R:R 2,5 = 28,6%: sistem tetap untung walau win rate di bawah 50%.');
                    cat.innerHTML = '💡 ' + bagian.join(' ');
                }
            } catch (e) {}

            // ── PER GRADE A/B/C: apakah grade A benar-benar lebih baik? (data, bukan asumsi) ──
            try {
                const grade = data.statistik_per_grade || [];
                const tbG = document.getElementById('trStatGrade');
                const escG = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                const angG = (v, suf, plus) => (v === null || v === undefined) ? '—'
                    : ((plus && v > 0 ? '+' : '') + v + (suf || ''));
                const warnaGrade = { 'A': 'text-qi-green', 'B': 'text-qi-cyan', 'C': 'text-slate-300' };
                if (tbG) {
                    if (!grade.length) {
                        tbG.innerHTML = '<tr><td colspan="8" class="py-2 text-slate-600">belum ada catatan sinyal</td></tr>';
                    } else {
                        tbG.innerHTML = grade.map(g => {
                            const adaNilai = (g.dinilai || 0) > 0;
                            const wrCls = !adaNilai ? 'text-amber-300'
                                : ((g.win_rate ?? 0) >= (g.titik_impas_pct ?? 50) ? 'text-qi-green' : 'text-qi-red');
                            const exCls = !adaNilai ? 'text-amber-300' : ((g.expectancy_r ?? 0) > 0 ? 'text-qi-green' : 'text-qi-red');
                            const totCls = (g.total_r ?? 0) > 0 ? 'text-qi-green' : ((g.total_r ?? 0) < 0 ? 'text-qi-red' : 'text-slate-400');
                            return '<tr class="border-b border-qi-border/30" title="' + escG(g.arti) + '">'
                                + '<td class="py-1.5 pr-2 font-bold ' + (warnaGrade[g.grade] || 'text-slate-200') + '">' + escG(g.grade) + '</td>'
                                + '<td class="text-right px-1.5 text-slate-300">' + (g.total ?? 0) + '</td>'
                                + '<td class="text-right px-1.5 text-slate-400">' + (g.dinilai ?? 0) + (g.aktif ? ' <span class="text-qi-cyan text-[9px]">(' + g.aktif + ' aktif)</span>' : '') + '</td>'
                                + '<td class="text-right px-1.5 text-slate-400">' + (g.menang ?? 0) + ' / ' + (g.kalah ?? 0) + '</td>'
                                + '<td class="text-right px-1.5 ' + wrCls + '">' + (adaNilai ? angG(g.win_rate, '%') : '—') + '</td>'
                                + '<td class="text-right px-1.5 ' + exCls + '">' + (adaNilai ? angG(g.expectancy_r, 'R', true) : '—') + '</td>'
                                + '<td class="text-right px-1.5 text-qi-cyan">' + angG(g.profit_factor) + '</td>'
                                + '<td class="text-right pl-1.5 ' + totCls + '">' + angG(g.total_r, 'R', true) + '</td>'
                                + '</tr>';
                        }).join('');
                    }
                }
                const catG = document.getElementById('trStatGradeCatatan');
                if (catG) {
                    const a = grade.find(g => g.grade === 'A');
                    const b = grade.find(g => g.grade === 'B');
                    const bagianG = [];
                    if (a && b) {
                        if ((a.dinilai || 0) > 0 && (b.dinilai || 0) > 0) {
                            const selisih = Math.round(((a.win_rate ?? 0) - (b.win_rate ?? 0)) * 10) / 10;
                            bagianG.push('Grade A win rate ' + a.win_rate + '% vs grade B ' + b.win_rate + '% (selisih ' + (selisih > 0 ? '+' : '') + selisih + ' poin).');
                        } else {
                            bagianG.push('Perbandingan grade A vs B belum bisa dihitung: grade A ' + (a.dinilai || 0) + ' tertutup, grade B ' + (b.dinilai || 0) + ' tertutup. Angka akan muncul sendiri setelah cukup sinyal tertutup (bukan 0%).');
                        }
                    }
                    bagianG.push('Grade hanya merangkum kekuatan konfluensi saat sinyal dibuat — bukan jaminan menang.');
                    catG.innerHTML = '💡 ' + bagianG.join(' ');
                }
            } catch (e) {}

            // ── KALIBRASI: expectancy per tingkat keyakinan, apa adanya ──
            try {
                const kal = data.kalibrasi || null;
                const tbK = document.getElementById('trKalBaris');
                const stK = document.getElementById('trKalStatus');
                if (kal && tbK) {
                    const cukup = !!kal.cukup_sampel;
                    if (stK) {
                        stK.textContent = (kal.total_tertutup || 0) + ' / ' + (kal.min_sampel || 30) + ' sinyal tertutup — '
                            + (cukup ? 'sampel cukup' : 'sampel BELUM cukup');
                        stK.className = 'text-[10px] font-mono ' + (cukup ? 'text-qi-green' : 'text-amber-300');
                    }
                    const titikImpas = 28.6;   // 100 / (1 + 2,5) untuk R:R 1:2,5
                    tbK.innerHTML = (kal.kelompok || []).map(g => {
                        const ada = (g.n || 0) > 0;
                        const wrCls = !ada ? 'text-slate-600' : ((g.win_rate ?? 0) >= titikImpas ? 'text-qi-green' : 'text-qi-red');
                        const exCls = !ada ? 'text-slate-600' : ((g.expectancy_r ?? 0) > 0 ? 'text-qi-green' : 'text-qi-red');
                        const tanda = (cukup && g.cukup_untuk_dinilai && (g.expectancy_r ?? 0) > 0)
                            ? ' <span class="text-qi-green" title="Layak dijadikan ambang">✓</span>' : '';
                        return '<tr class="border-b border-qi-border/30">'
                            + '<td class="py-1.5 pr-2 text-slate-200">' + g.rentang + tanda + '</td>'
                            + '<td class="text-right px-1.5 ' + (ada ? 'text-slate-300' : 'text-slate-600') + '">' + (g.n || 0) + '</td>'
                            + '<td class="text-right px-1.5 text-slate-400">' + (g.menang || 0) + ' / ' + (g.kalah || 0) + '</td>'
                            + '<td class="text-right px-1.5 ' + wrCls + '">' + (ada ? (g.win_rate + '%') : '—') + '</td>'
                            + '<td class="text-right px-1.5 ' + exCls + '">'
                            + ((ada && g.expectancy_r !== null && g.expectancy_r !== undefined) ? ((g.expectancy_r > 0 ? '+' : '') + g.expectancy_r + 'R') : '—') + '</td>'
                            + '<td class="text-right pl-1.5 text-slate-400">'
                            + ((g.total_r === null || g.total_r === undefined) ? '—' : ((g.total_r > 0 ? '+' : '') + g.total_r + 'R')) + '</td>'
                            + '</tr>';
                    }).join('');
                    const catK = document.getElementById('trKalCatatan');
                    if (catK) {
                        const bagianK = [];
                        if (kal.catatan) bagianK.push(kal.catatan);
                        if (kal.saran_ambang !== null && kal.saran_ambang !== undefined) {
                            bagianK.push('<b class="text-qi-green">→ Ambang keyakinan minimum yang disarankan: ' + kal.saran_ambang + '</b> (pengamatan pada data yang ada, bukan jaminan).');
                        }
                        if (kal.tanpa_keyakinan) {
                            bagianK.push(kal.tanpa_keyakinan + ' catatan lama tanpa nilai keyakinan tidak diikutkan — dilaporkan, tidak disembunyikan.');
                        }
                        if (kal.dasar) bagianK.push('<span class="text-slate-600">' + kal.dasar + '</span>');
                        catK.innerHTML = bagianK.join(' ');
                    }
                }
            } catch (e) {}
            const bl = document.getElementById('trBlackout');
            if (bl && bo) {
                if (bo.aktif && bo.event) {
                    bl.className = 'mx-4 mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-200 leading-snug';
                    bl.innerHTML = '⏸ <b>Filter berita aktif</b> — sinyal baru ditahan ±30 menit: <b>' + bo.event.judul + '</b> ('
                        + bo.event.mata_uang + ') ' + bo.event.arah + ' ' + bo.event.menit + ' menit.';
                } else {
                    bl.className = 'mx-4 mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-2.5 text-[11px] text-slate-400 leading-snug';
                    bl.innerHTML = '✓ Filter berita aktif — ' + (bo.catatan || 'tidak ada berita berdampak tinggi saat ini.')
                        + ((bo.umur_cache !== null && bo.umur_cache !== undefined) ? ' <span class="text-slate-600">(data kalender ' + Math.round(bo.umur_cache / 60) + ' menit lalu)</span>' : '');
                }
            }
        } catch (e) {}

        if (!body) return;
        if (!hist.length) { body.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-slate-600">Tidak ada data</td></tr>'; return; }

        const STATUS_CLS = { 'HIT TP 🎯': 'text-qi-green', 'HIT SL 🛑': 'text-qi-red', 'AKTIF': 'text-qi-cyan', 'EXPIRED': 'text-slate-500' };
        if (typeof renderMonthlyCalendar === 'function') renderMonthlyCalendar(hist);
        // Bukti konfluensi ('basis') boleh berupa TEKS (mesin AUTO_SIGNAL/AI/NEWS) atau
        // belum ada pada rekor LAMA (sebelum kolom ini diperkenalkan). Rekor lama TIDAK
        // diisi dengan karangan — hanya diberi keterangan jujur bahwa buktinya tidak
        // tersimpan. Teks dari server tetap di-escape sebelum dimasukkan ke HTML.
        const escBasis = (v) => String(v == null ? '' : v)
            .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const selBasis = (s) => {
            const b = (s && typeof s.basis === 'string') ? s.basis.trim() : '';
            if (b === '') return '<span class="text-slate-600" title="Rekor ini dibuat sebelum kolom bukti konfluensi diperkenalkan, jadi buktinya tidak tersimpan.">tidak tersimpan (rekor lama)</span>';
            const pendek = b.length > 64 ? (b.slice(0, 64) + '…') : b;
            return '<span class="text-slate-400" title="' + escBasis(b) + '">' + escBasis(pendek) + '</span>';
        };
        // ── SNAPSHOT CHART PER SINYAL (Tahap 1D) ─────────────────────────────────
        // Tombol kecil di sel bukti konfluensi (TIDAK menambah kolom, sehingga tabel
        // tetap selaras dengan judulnya). Bila sinyal sudah punya gambar, tampil tautan
        // "lihat"; bila belum, tampil tombol kamera untuk mengambil dari chart terminal.
        const tombolFoto = (s) => {
            const id = String((s && s.id) ? s.id : '');
            if (!/^SIG-[A-Za-z0-9\-]{4,60}$/.test(id)) return '';
            const tok = (function () { try { return localStorage.getItem('qi_session') || ''; } catch (e) { return ''; } })();
            if (s && s.chart_image_url) {
                const url = String(s.chart_image_url) + (tok ? ('&t=' + encodeURIComponent(tok)) : '');
                return ' <a href="' + url + '" target="_blank" rel="noopener" title="Buka snapshot chart sinyal ini" class="text-[9px] text-qi-cyan hover:underline whitespace-nowrap">🖼️ lihat</a>';
            }
            return ' <button onclick="fotoSinyal(\'' + id + '\')" title="Ambil snapshot chart terminal untuk sinyal ini (tersimpan di server)" class="text-[9px] text-qi-cyan hover:underline whitespace-nowrap">📸</button>';
        };
        body.innerHTML = hist.map(s => {
            const stCls = Object.entries(STATUS_CLS).find(([k]) => s.status?.includes(k.split(' ')[0]))?.[1] || 'text-slate-400';
            const sideCls = s.side === 'BUY' ? 'text-qi-green' : 'text-qi-red';
            // timestamp_epoch (server, tanpa ambigu zona) lebih dulu; string lama tanpa zona hanya cadangan.
            const dt = (s.timestamp_epoch || s.timestamp) ? new Date(s.timestamp_epoch ? s.timestamp_epoch * 1000 : s.timestamp).toLocaleString('id-ID',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
            const pnl = parseFloat(s.pnl_usd||0);
            const pnlCls = pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
            // ── HASIL DALAM SATUAN R (dari server) ───────────────────────────────
            // Server mengirim `r` + `r_sumber` untuk setiap rekor: 'exit_price' = dari harga
            // keluar NYATA, 'rr_rencana' = dari rencana (kalah dibatasi 1R), 'belum_selesai'
            // bila sinyal masih AKTIF. Ditampilkan apa adanya, termasuk label sumbernya,
            // supaya tidak ada angka yang tampak pasti padahal masih perkiraan.
            const rNilai = (s.r === null || s.r === undefined) ? null : Number(s.r);
            const rHasil = (rNilai === null) ? '—' : ((rNilai > 0 ? '+' : '') + rNilai + 'R');
            const rHasilCls = (rNilai === null) ? 'text-slate-500' : (rNilai > 0 ? 'text-qi-green' : (rNilai < 0 ? 'text-qi-red' : 'text-slate-300'));
            const rKet = (s.r_sumber === 'rr_rencana') ? '<span class="text-slate-600 font-normal text-[9px]"> rencana</span>'
                       : (s.r_sumber === 'belum_selesai' ? '<span class="text-slate-600 font-normal text-[9px]"> aktif</span>' : '');
            return `<tr class="border-b border-qi-border/50 hover:bg-white/[.02] transition-colors">
                <td class="px-4 py-2 text-[10px] text-slate-500 font-mono">${s.id||'—'}</td>
                <td class="px-3 py-2 text-[10px] text-slate-400">${dt}</td>
                <td class="px-3 py-2 text-[11px] font-semibold text-white">${SYMBOL_LABELS[s.symbol]||s.symbol}</td>
                <td class="px-3 py-2 text-[10px] text-qi-purple">${s.engine_name||s.engine}</td>
                <td class="px-3 py-2 text-[10px] text-slate-400">${s.timeframe||'—'}</td>
                <td class="px-3 py-2 text-[11px] font-bold ${sideCls}">${s.side||'—'}</td>
                <td class="px-3 py-2 text-[11px] tabular-nums">${s.entry||'—'}</td>
                <td class="px-3 py-2 text-[10px] text-qi-gold">${s.rr||'—'}</td>
                <td class="px-3 py-2 text-[10px] font-semibold ${stCls}">${s.status||'—'}</td>
                <td class="px-3 py-2 text-[11px] tabular-nums font-bold ${rHasilCls}">${rHasil}${rKet}</td>
                <td class="px-3 py-2 text-[11px] tabular-nums font-bold ${pnlCls}">${formatPnlUsd(pnl)}</td>
                <td class="px-4 py-2 text-[10px] leading-snug max-w-[280px]">${selBasis(s)}${tombolFoto(s)}</td>
            </tr>`;
        }).join('');
    } catch(e) {
        if (body) body.innerHTML = '<tr><td colspan="11" class="px-4 py-4 text-center text-slate-600">Gagal memuat data</td></tr>';
    }
}

// ─── Correlation Matrix 10×10 ──────────────────────────────────────────────
const CORR_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','NZDUSD','BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT'];
const CORR_LABELS = { XAUUSD:'XAU',EURUSD:'EUR',GBPUSD:'GBP',USDJPY:'JPY',AUDUSD:'AUD',NZDUSD:'NZD',BTCUSDT:'BTC',ETHUSDT:'ETH',SOLUSDT:'SOL',XRPUSDT:'XRP' };

function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    let sumA=0, sumB=0, sumAB=0, sumA2=0, sumB2=0;
    for (let i=0; i<n; i++) { sumA+=a[i]; sumB+=b[i]; sumAB+=a[i]*b[i]; sumA2+=a[i]*a[i]; sumB2+=b[i]*b[i]; }
    const num = n*sumAB - sumA*sumB;
    const den = Math.sqrt((n*sumA2 - sumA*sumA) * (n*sumB2 - sumB*sumB));
    return den === 0 ? 0 : num/den;
}

async function fetchCorrelation() {
    const tf     = document.getElementById('corrTF')?.value || 'D';
    const matEl  = document.getElementById('corrMatrix');
    const topEl  = document.getElementById('corrTopPairs');
    const updEl  = document.getElementById('corrUpdated');
    if (matEl) matEl.innerHTML = '<div class="text-center text-slate-600 text-xs py-8">Mengunduh data '+CORR_SYMS.length+' instrumen…</div>';

    const results = await Promise.allSettled(
        CORR_SYMS.map(sym =>
            fetch(`api/get-chart-data.php?symbol=${sym}&interval=${tf}`).then(r => r.json())
        )
    );

    // Extract close price arrays (align by length)
    const closes = results.map(res => {
        if (res.status !== 'fulfilled' || !res.value.candles?.length) return [];
        return res.value.candles.map(c => parseFloat(c.close));
    });

    // Compute log-returns for better correlation
    const returns = closes.map(arr => {
        const r = [];
        for (let i=1; i<arr.length; i++) r.push(Math.log(arr[i]/arr[i-1]));
        return r;
    });

    // Min length alignment
    const minLen = Math.min(...returns.filter(r=>r.length).map(r=>r.length));
    const aligned = returns.map(r => r.slice(-minLen));

    // Build correlation matrix
    const n = CORR_SYMS.length;
    const matrix = Array.from({length:n}, (_,i) => Array.from({length:n}, (_,j) => {
        if (aligned[i].length === 0 || aligned[j].length === 0) return 0;
        return pearson(aligned[i], aligned[j]);
    }));

    // Render matrix
    if (matEl) {
        const cellSize = 'min-w-[52px] w-14';
        let html = `<table class="text-[10px] font-mono border-collapse w-full">
            <thead><tr><th class="px-2 py-1 text-slate-500 text-left text-[9px]">—</th>
            ${CORR_SYMS.map((s,i) => `<th class="px-1 py-1 text-center text-[9px] text-slate-400 ${cellSize}">${CORR_LABELS[s]}</th>`).join('')}
            </tr></thead><tbody>`;

        for (let i=0; i<n; i++) {
            html += `<tr class="border-b border-qi-border/20">
                <td class="px-2 py-1 font-semibold text-slate-300 text-[9px] whitespace-nowrap">${CORR_LABELS[CORR_SYMS[i]]}</td>`;
            for (let j=0; j<n; j++) {
                const v = matrix[i][j];
                const r = Math.round(v * 100) / 100;
                const isDiag = i === j;
                let bg = 'bg-slate-800/30';
                if (!isDiag) {
                    if (v >= 0.7)  bg = 'bg-qi-green/20 text-qi-green';
                    else if (v >= 0.4)  bg = 'bg-qi-green/8 text-qi-green/70';
                    else if (v <= -0.7) bg = 'bg-qi-red/20 text-qi-red';
                    else if (v <= -0.4) bg = 'bg-qi-red/8 text-qi-red/70';
                    else bg = 'bg-slate-800/20 text-slate-500';
                }
                html += `<td class="px-1 py-1.5 text-center ${cellSize} ${bg} rounded-sm m-0.5 cursor-default" title="${CORR_LABELS[CORR_SYMS[i]]} vs ${CORR_LABELS[CORR_SYMS[j]]}: ${r}">
                    ${isDiag ? '<span class="text-slate-600">1.00</span>' : (r >= 0 ? '' : '') + r.toFixed(2)}
                </td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        matEl.innerHTML = html;
    }

    // Top correlated pairs
    if (topEl) {
        const pairs = [];
        for (let i=0; i<n; i++) for (let j=i+1; j<n; j++) {
            pairs.push({ a: CORR_SYMS[i], b: CORR_SYMS[j], r: matrix[i][j] });
        }
        pairs.sort((a,b) => Math.abs(b.r) - Math.abs(a.r));
        topEl.innerHTML = pairs.slice(0, 8).map(p => {
            const r = Math.round(p.r * 100) / 100;
            const cls = r >= 0.7 ? 'text-qi-green' : r <= -0.7 ? 'text-qi-red' : r >= 0.4 ? 'text-qi-green/60' : r <= -0.4 ? 'text-qi-red/60' : 'text-slate-500';
            const barW = Math.abs(r) * 100;
            const barCls = r >= 0 ? 'bg-qi-green' : 'bg-qi-red';
            return `<div class="flex items-center gap-4 px-4 py-2.5 hover:bg-white/[.02]">
                <span class="text-[11px] font-semibold text-white font-mono w-20">${CORR_LABELS[p.a]} / ${CORR_LABELS[p.b]}</span>
                <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${barCls}" style="width:${barW}%"></div>
                </div>
                <span class="font-mono font-bold ${cls} w-12 text-right">${r >= 0 ? '+':''}${r.toFixed(2)}</span>
            </div>`;
        }).join('');
    }

    if (updEl) updEl.textContent = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}

// ─── OHLC Bar & Realtime Candle Ticker (Kingsantosa Engine Grade) ───────────
// ─── Keadaan legenda OHLC & label sumber data (#1 & #21) ────────────────────
let _ohlcHover = false;    // true saat kursor menunjuk candle historis di chart
let _lwCandlesMeta = null; // { source, generatedAt } dari api/get-chart-data

const OHLC_SOURCE_LABELS = {
    oanda_tv: 'OANDA', binance: 'BINANCE', binance_ws: 'BINANCE · STREAM', mt5_tick: 'MT5 · TICK', binance_paxg: 'BINANCE·PAXG (proksi)',
    twelvedata: 'TWELVEDATA', biquote: 'BIQUOTE', candle_m1: 'BIQUOTE M1', candle_h1: 'BIQUOTE H1',
    simulasi: 'DATA SIMULASI', unknown: 'SUMBER ?'
};

// Menampilkan asal data candle + umurnya. Data simulasi diberi warna peringatan
// supaya tidak pernah terlihat sebagai harga pasar sebenarnya.
function updateOhlcSourceBadge() {
    const el = document.getElementById('ohlcSource');
    if (!el) return;
    const base = 'ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold border ';
    if (!_lwCandlesMeta || !_lwCandlesMeta.source) {
        el.textContent = '—';
        el.className = base + 'bg-slate-800/80 text-slate-500 border-slate-700/60';
        return;
    }
    const simulasi = _lwCandlesMeta.source === 'simulasi';
    let umur = '';
    if (_lwCandlesMeta.generatedAt) {
        const detik = Math.max(0, Math.round((Date.now() - Date.parse(_lwCandlesMeta.generatedAt)) / 1000));
        if (Number.isFinite(detik)) umur = ' · ' + (detik <= 5 ? 'baru' : detik + 's');
    }
    el.textContent = (OHLC_SOURCE_LABELS[_lwCandlesMeta.source] || String(_lwCandlesMeta.source).toUpperCase()) + umur;
    el.className = base + (simulasi
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
        : 'bg-slate-800/80 text-slate-400 border-slate-700/60');
}

// Menuliskan satu candle ke bar OHLC (dipakai untuk kursor maupun data live).
function renderOhlcFromCandle(candle, isHover) {
    const allSyms = WL_GROUPS.flatMap(g => g.syms);
    const found   = allSyms.find(s => s.tv === _tvSymbol);
    const dp      = (found && DP[found.key]) || 4;
    const fmt     = v => parseFloat(v).toFixed(dp);
    const oEl = document.getElementById('ohlcO');
    const hEl = document.getElementById('ohlcH');
    const lEl = document.getElementById('ohlcL');
    const cEl = document.getElementById('ohlcC');
    const bgEl = document.getElementById('ohlcChgBadge');
    const upEl = document.getElementById('ohlcUpdated');
    if (oEl) oEl.textContent = fmt(candle.open);
    if (hEl) hEl.textContent = fmt(candle.high);
    if (lEl) lEl.textContent = fmt(candle.low);
    if (cEl) {
        cEl.textContent = fmt(candle.close);
        cEl.className = candle.close >= candle.open ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
    }
    if (bgEl) {
        const chg = candle.open ? ((candle.close - candle.open) / candle.open * 100) : 0;
        bgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
        bgEl.className = 'ml-2 font-bold ' + (chg >= 0 ? 'text-emerald-400' : 'text-rose-400');
    }
    if (upEl && isHover) upEl.textContent = 'Kursor';
}

// ─── Aliran harga cepat (WebSocket kripto + tick broker MT5) ────────────────
// Dipanggil assets/js/realtime.js pada setiap tick. Hanya memperbarui DATA dan
// candle terakhir pada chart aktif; tidak menyentuh tata letak atau panel lain.
// Kalau kedua aliran mati, polling 15 detik yang sudah ada tetap menjadi sumber harga.
let _rtTerakhirGambar = 0;

window.qiRealtimeTick = function (sym, price, meta) {
    try {
        if (!_lastPrices) return;
        const harga = Number(price);
        if (!isFinite(harga) || harga <= 0) return;
        const sumber = (meta && meta.source) ? meta.source : 'binance_ws';
        const spread = meta && isFinite(Number(meta.spread)) ? Number(meta.spread) : null;

        // 1. Perbarui data harga (semua konsumen ikut memakai ini: watchlist,
        //    ticker, alert, kalkulator). Spread hanya ada pada tick broker.
        const found = WL_GROUPS.flatMap(g => g.syms).find(s => s.key === sym);
        if (found && _lastPrices[found.key]) {
            _lastPrices[found.key].price = harga;
            _lastPrices[found.key].source = sumber;
            if (spread !== null) _lastPrices[found.key].spread = spread;
        }

        // 2. Batasi penggambaran maksimum 4×/detik supaya tidak membebani browser.
        const now = Date.now();
        if (now - _rtTerakhirGambar < 250) return;
        _rtTerakhirGambar = now;

        // 3. Jangan timpa candle historis yang sedang ditunjuk kursor.
        if (_ohlcHover) return;

        // 4. Hanya candle pada chart aktif yang boleh bergerak.
        const aktif = WL_GROUPS.flatMap(g => g.syms).find(s => s.tv === _tvSymbol);
        if (!aktif || aktif.key !== sym) return;
        if (!_lwSeries || !_lwLastCandles || !_lwLastCandles.length) return;

        const last = _lwLastCandles[_lwLastCandles.length - 1];
        const upd = {
            time: last.time,
            open: last.open,
            high: Math.max(last.high, harga),
            low: Math.min(last.low, harga),
            close: harga,
            volume: last.volume || 0
        };
        _lwSeries.update(upd);
        _lwLastCandles[_lwLastCandles.length - 1] = upd;
        // Panel volume ikut bergerak pada candle berjalan (bila sumber punya volume).
        if (_lwVolume) {
            try {
                _lwVolume.update({
                    time: upd.time,
                    value: Number(upd.volume) || 0,
                    color: (Number(upd.close) >= Number(upd.open)) ? 'rgba(0,200,83,0.42)' : 'rgba(255,23,68,0.42)'
                });
            } catch (e) {}
        }
        _lwCandlesMeta = { source: sumber, generatedAt: new Date().toISOString() };
        renderOhlcFromCandle(upd, false);
        updateOhlcSourceBadge();
        renderSpreadBadge(aktif.key);
    } catch (e) { /* satu tick tidak boleh mengganggu apa pun */ }
};

// Spread nyata dari broker (hanya tersedia bila EA MT5 mengirim tick). Kalau belum
// ada, tampil "—" supaya tidak ada angka karangan.
function renderSpreadBadge(key) {
    try {
        const el = document.getElementById('ohlcSpread');
        if (!el) return;
        const d = _lastPrices[key];
        if (!d || !isFinite(Number(d.spread)) || Number(d.spread) <= 0) {
            el.textContent = 'SPREAD —';
            el.className = 'ml-2 px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500 text-[10px] font-semibold';
            return;
        }
        const s = Number(d.spread);
        const titik = s < 0.001 ? 5 : (s < 1 ? 3 : 2);
        el.textContent = 'SPREAD ' + s.toFixed(titik);
        el.title = 'Spread dari broker (dikirim EA MT5)';
        el.className = 'ml-2 px-1.5 py-0.5 rounded bg-slate-800/80 text-qi-cyan text-[10px] font-semibold';
    } catch (e) {}
}

// Label status di bar atas harus JUJUR: 'LIVE' hanya saat aliran benar-benar aktif.
window.qiRealtimeState = function (state, host, info) {
    try {
        const dot = document.getElementById('liveStatusDot');
        const teks = document.getElementById('liveStatusText');
        if (!dot || !teks) return;
        const umurBroker = info && info.brokerAgeMs !== null && info.brokerAgeMs !== undefined ? info.brokerAgeMs : null;

        // Label harus mengikuti SIMBOL YANG SEDANG DILIHAT. Sebelumnya label hanya
        // melihat status transport global, sehingga chart XAUUSD (emas) bisa berlabel
        // "LIVE" padahal WebSocket kripto tidak mencakup emas sama sekali — menyesatkan.
        let simbolAktif = null;
        try {
            const aktif = WL_GROUPS.flatMap(g => g.syms).find(s => s.tv === _tvSymbol);
            simbolAktif = aktif ? aktif.key : null;
        } catch (e) {}
        const daftarKripto = (window.QuantumRealtime && window.QuantumRealtime.symbols) ? window.QuantumRealtime.symbols : [];
        const simbolKripto = simbolAktif ? daftarKripto.indexOf(simbolAktif) !== -1 : false;

        // Cabang harus EKSPLISIT: simbol non-kripto tidak pernah boleh berlabel LIVE
        // hanya karena WebSocket kripto sedang tersambung.
        let efektif;
        if (state === 'broker') efektif = 'broker';
        else if (simbolKripto && state === 'stream') efektif = 'stream';
        else if (simbolKripto && (state === 'mencoba' || state === 'idle')) efektif = 'mencoba';
        else efektif = 'polling';

        if (efektif === 'broker') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-qi-green session-dot';
            teks.className = 'text-[10px] font-semibold text-qi-green tracking-wider';
            teks.textContent = 'LIVE · MT5';
            teks.title = 'Harga & spread langsung dari broker Anda (EA MT5)'
                + (umurBroker !== null ? ' — tick terakhir ' + Math.round(umurBroker / 1000) + ' dtk lalu' : '');
        } else if (efektif === 'stream') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-qi-green session-dot';
            teks.className = 'text-[10px] font-semibold text-qi-green tracking-wider';
            teks.textContent = 'LIVE';
            teks.title = 'Streaming WebSocket untuk ' + (simbolAktif || 'simbol kripto')
                + '. Forex/emas tidak tercakup WebSocket ini — pasang EA MT5 versi tick agar ikut realtime.';
        } else if (efektif === 'mencoba' || efektif === 'idle') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-qi-gold session-dot';
            teks.className = 'text-[10px] font-semibold text-qi-gold tracking-wider';
            teks.textContent = 'MENYAMBUNG';
            teks.title = 'Sedang menguji koneksi streaming';
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-500';
            teks.className = 'text-[10px] font-semibold text-slate-400 tracking-wider';
            teks.textContent = 'POLLING 15s';
            teks.title = (simbolAktif ? 'Harga ' + simbolAktif : 'Harga')
                + ' diperbarui tiap 15 detik, dan sumbernya (biquote M1/H1) sendiri menyegar tiap ±20–45 detik. '
                + 'Untuk emas/forex yang benar-benar realtime, pasang EA MT5 versi tick (menu Account).';
        }
    } catch (e) {}
};

async function updateOhlcBar() {
    updateOhlcSourceBadge();
    if (_ohlcHover) return; // jangan timpa tampilan candle yang sedang ditunjuk kursor
    const allSyms = WL_GROUPS.flatMap(g => g.syms);
    const found   = allSyms.find(s => s.tv === _tvSymbol);
    if (!found) return;

    // 1. Tick update via live market prices (_lastPrices) if present
    const liveObj = _lastPrices[found.key];
    if (liveObj && liveObj.price && _lwSeries && _lwLastCandles && _lwLastCandles.length > 0) {
        const curPrice = parseFloat(liveObj.price);
        const lastCandle = _lwLastCandles[_lwLastCandles.length - 1];
        if (lastCandle && !isNaN(curPrice)) {
            const updatedCandle = {
                time: lastCandle.time,
                open: lastCandle.open,
                high: Math.max(lastCandle.high, curPrice),
                low: Math.min(lastCandle.low, curPrice),
                close: curPrice,
                volume: lastCandle.volume || 0
            };
            try {
                _lwSeries.update(updatedCandle);
                _lwLastCandles[_lwLastCandles.length - 1] = updatedCandle;
            } catch(e) {}

            // Update Header & HUD Immediately
            const dp  = DP[found.key] || 4;
            const fmt = v => parseFloat(v).toFixed(dp);
            const prevCandle = _lwLastCandles.length > 1 ? _lwLastCandles[_lwLastCandles.length - 2] : null;
            const chg = prevCandle ? ((curPrice - prevCandle.close) / prevCandle.close * 100) : (parseFloat(liveObj.chgPct) || 0);

            const oEl  = document.getElementById('ohlcO');
            const hEl  = document.getElementById('ohlcH');
            const lEl  = document.getElementById('ohlcL');
            const cEl  = document.getElementById('ohlcC');
            const bgEl = document.getElementById('ohlcChgBadge');
            const upEl = document.getElementById('ohlcUpdated');
            const curPEl = document.getElementById('chartCurPrice');
            const curCEl = document.getElementById('chartCurChg');

            if (oEl) oEl.textContent = fmt(updatedCandle.open);
            if (hEl) hEl.textContent = fmt(updatedCandle.high);
            if (lEl) lEl.textContent = fmt(updatedCandle.low);
            if (cEl) {
                cEl.textContent = fmt(updatedCandle.close);
                cEl.className = updatedCandle.close >= updatedCandle.open ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
            }
            if (bgEl) {
                bgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                bgEl.className = 'ml-2 font-bold ' + (chg >= 0 ? 'text-emerald-400' : 'text-rose-400');
            }
            if (upEl) upEl.textContent = new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
            if (curPEl) curPEl.textContent = fmt(curPrice);
            if (curCEl) {
                curCEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                curCEl.className = 'font-mono text-[11px] font-bold ' + (chg >= 0 ? 'text-emerald-400' : 'text-rose-400');
            }
        }
    }

    // 2. Periodic sync from get-chart-data API to capture newly closed bars
    try {
        const res  = await fetch(`api/get-chart-data.php?symbol=${found.key}&interval=${_tvInterval}`);
        const data = await res.json();
        const candles = (data.candles || []).filter(c => c.time && c.open);
        if (!candles.length) return;
        // Perbarui label sumber & umur data (#21)
        _lwCandlesMeta = { source: data.source || '', generatedAt: data.generated_at || '' };

        // If series already has data, sync last candle or full set if new bar appeared
        if (_lwLastCandles.length && candles.length >= _lwLastCandles.length) {
            const lastApi = candles[candles.length - 1];
            const lastLocal = _lwLastCandles[_lwLastCandles.length - 1];
            if (lastApi.time !== lastLocal.time) {
                _lwSeries.setData(candles);
                perbaruiVolume(candles);
                if (_lwRsi) _lwRsi.setData(_calcRSI(candles, 14));
                _lwLastCandles = candles;
                if (typeof drawAutoIndicators === 'function') drawAutoIndicators(candles);
            }
        }
    } catch(e) {}
}
setInterval(() => { if (_activePanel === 'panel-charts') updateOhlcBar(); }, 2500);

// ─── Paper Trading Mini Chart (lightweight-charts) ─────────────────────────
let _ptMiniTf = '15';
let _ptMiniChart = null;
let _ptMiniSeries = null;

function setPtMiniTf(tf) {
    _ptMiniTf = tf;
    document.querySelectorAll('.pt-tf-btn').forEach(b => {
        const active = b.dataset.ptf === tf;
        b.className = active
            ? 'pt-tf-btn active text-[9px] font-mono px-1.5 py-0.5 rounded border border-qi-cyan/40 bg-qi-cyan/10 text-qi-cyan'
            : 'pt-tf-btn text-[9px] font-mono px-1.5 py-0.5 rounded border border-qi-border text-slate-400 hover:border-slate-500';
    });
    renderPtMiniChart();
}

function initPtMiniChart() {
    renderPtMiniChart();
    const ptSym = document.getElementById('ptSymbol');
    if (ptSym && !ptSym._miniChartBound) {
        ptSym._miniChartBound = true;
        ptSym.addEventListener('change', () => {
            renderPtMiniChart();
            ptUpdateLivePrice();
        });
    }
}

async function renderPtMiniChart() {
    const symEl  = document.getElementById('ptSymbol');
    const symKey = symEl ? symEl.value : 'XAUUSD';
    const wrap   = document.getElementById('ptMiniChart');
    if (!wrap || !window._lwModules) return;

    const label = SYMBOL_LABELS[symKey] || symKey;
    const lblEl = document.getElementById('ptMiniChartSym');
    if (lblEl) lblEl.textContent = label;

    const tfParam = {'15':'15','60':'60','240':'240','D':'D'}[_ptMiniTf] || '60';

    // Build/rebuild chart
    if (_ptMiniChart) { try { _ptMiniChart.remove(); } catch(e){} _ptMiniChart = null; _ptMiniSeries = null; }
    const { createChart, CandlestickSeries } = window._lwModules;
    _ptMiniChart = createChart(wrap, {
        layout: { background: { color: '#050A14' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: '#0F1A2E' }, horzLines: { color: '#0F1A2E' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#0F1A2E' },
        timeScale: { borderColor: '#0F1A2E', timeVisible: true, secondsVisible: false },
        handleScroll: true, handleScale: true,
        autoSize: true,
    });
    _ptMiniSeries = _ptMiniChart.addSeries(CandlestickSeries, {
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    // Fetch data
    try {
        const url = `api/get-chart-data.php?symbol=${encodeURIComponent(symKey)}&tf=${tfParam}&limit=150`;
        const r   = await fetch(url);
        const raw = await r.json();
        const candles = (raw.candles || raw).filter(c => c.time && c.close != null)
            .map(c => ({ time: +c.time, open: +c.open, high: +c.high, low: +c.low, close: +c.close }));
        if (candles.length) {
            _ptMiniSeries.setData(candles);
            // Plot EMA20 overlay
            const { LineSeries } = window._lwModules;
            const ema20 = _calcEMA(candles, 20);
            if (ema20.length) {
                const s = _ptMiniChart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 1, priceLineVisible: false });
                s.setData(ema20);
            }
            // Draw any open positions as price lines
            _ptPositions.filter(p => p.symbol === symKey).forEach(p => {
                const col = p.side === 'BUY' ? '#26a69a' : '#ef5350';
                _ptMiniSeries.createPriceLine({ price: parseFloat(p.entryPrice), color: col, lineWidth: 1, lineStyle: 2, title: `${p.side} Entry` });
                if (p.sl) _ptMiniSeries.createPriceLine({ price: parseFloat(p.sl), color: '#ef5350', lineWidth: 1, lineStyle: 2, title: 'SL' });
                if (p.tp) _ptMiniSeries.createPriceLine({ price: parseFloat(p.tp), color: '#26a69a', lineWidth: 1, lineStyle: 2, title: 'TP' });
            });
            _ptMiniChart.timeScale().fitContent();
        }
    } catch(e) { console.warn('ptMiniChart fetch error:', e); }
}

// ─── AI Trading Assistant ──────────────────────────────────────────────────
let _aiHistory = [];

function _renderAiMarkdown(text) {
    // Escape HTML first
    let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Fenced code blocks ```lang\n...\n```
    s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
        `<pre class="bg-slate-900 border border-slate-700 rounded-lg p-3 my-2 overflow-x-auto text-[10px] text-cyan-300 font-mono whitespace-pre">${code.trim()}</pre>`);
    // Inline code `code`
    s = s.replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1 rounded text-cyan-300 font-mono text-[10px]">$1</code>');
    // Bold **text**
    s = s.replace(/\*\*(.*?)\*\*/g,'<strong class="text-white font-semibold">$1</strong>');
    // Italic *text*
    s = s.replace(/\*([^*\n]+)\*/g,'<em class="text-slate-200">$1</em>');
    // Headers ## and ###
    s = s.replace(/^### (.+)$/gm,'<div class="font-bold text-cyan-300 mt-2 mb-0.5 text-[11px]">$1</div>');
    s = s.replace(/^## (.+)$/gm,'<div class="font-bold text-white mt-2.5 mb-1 text-xs">$1</div>');
    // Bullet lists: lines starting with - or *
    s = s.replace(/^[*-] (.+)$/gm,'<li class="ml-3 list-disc list-inside text-slate-300">$1</li>');
    s = s.replace(/(<li[\s\S]+?<\/li>)/g,'<ul class="my-1 space-y-0.5">$1</ul>');
    // Numbered lists: 1. item
    s = s.replace(/^\d+\. (.+)$/gm,'<li class="ml-3 list-decimal list-inside text-slate-300">$1</li>');
    // Line breaks
    s = s.replace(/\n/g,'<br>');
    return s;
}

function _copyAiMsg(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = el.innerText || el.textContent;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            if (window.showQuantumToast) showQuantumToast('Balasan disalin', 'success', 1500);
        }).catch(() => {});
    }
}

let _aiActiveImage = null;

function handleAiImageSelect(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        _aiActiveImage = e.target.result;
        const prev = document.getElementById('aiImagePreview');
        const nameEl = document.getElementById('aiImageName');
        if (nameEl) nameEl.textContent = '📷 ' + file.name + ' (' + (file.size/1024).toFixed(0) + ' KB)';
        if (prev) prev.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearAiImage() {
    _aiActiveImage = null;
    const input = document.getElementById('aiImageInput');
    if (input) input.value = '';
    const prev = document.getElementById('aiImagePreview');
    if (prev) prev.classList.add('hidden');
}

async function sendAiMessage(preset) {
    const input = document.getElementById('aiChatInput');
    const text  = preset || (input ? input.value.trim() : '');
    const imgToSend = _aiActiveImage;
    if (!text && !imgToSend) return;
    if (input && !preset) input.value = '';
    clearAiImage();

    // Hide suggestions after first real user message
    const sugg = document.getElementById('aiSuggestions');
    if (sugg && sugg.style.display !== 'none') sugg.style.display = 'none';

    const chatEl = document.getElementById('aiChatHistory');
    if (!chatEl) return;

    // Add user bubble
    const userImgThumb = imgToSend ? `<img src="${imgToSend}" class="max-w-[200px] max-h-[140px] rounded-lg border border-qi-border mb-2 block" alt="Chart">` : '';
    chatEl.insertAdjacentHTML('beforeend', `
        <div class="flex gap-2.5 justify-end">
            <div class="ai-bubble-user bg-qi-navy/40 border border-qi-navy/60 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[11px] text-white leading-relaxed">
                ${userImgThumb}
                <div>${text ? text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : 'Analisa screenshot chart ini:'}</div>
            </div>
            <div class="w-7 h-7 rounded-full bg-qi-navy/80 border border-qi-border flex items-center justify-center text-[10px] font-bold text-qi-cyan flex-shrink-0 mt-0.5">U</div>
        </div>`);
    _aiHistory.push({ role: 'user', content: text || 'Analisa screenshot chart' });
    chatEl.scrollTop = chatEl.scrollHeight;

    // Typing indicator
    const tid = 'ai_t_' + Date.now();
    chatEl.insertAdjacentHTML('beforeend', `
        <div id="${tid}" class="flex gap-2.5">
            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-qi-purple to-qi-cyan flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">AI</div>
            <div class="ai-bubble-ai bg-qi-card border border-qi-border rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        </div>`);
    chatEl.scrollTop = chatEl.scrollHeight;

    try {
        const aiContext = {};
        if (Object.keys(_lastPrices).length) {
            aiContext.prices = Object.fromEntries(
                Object.entries(_lastPrices).slice(0, 25).map(([k, v]) => [k, { price: v.price, chgPct: v.chgPct }])
            );
        }
        if (Object.keys(_lastSignals).length) aiContext.signals = _lastSignals;

        const res  = await fetch('api/ai-chat.php', {
            method: 'POST', headers: QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ message: text, image: imgToSend, history: _aiHistory.slice(-12), context: aiContext })
        });
        const data = await res.json();
        const reply = data.reply || data.error || 'Maaf, terjadi kesalahan.';

        document.getElementById(tid)?.remove();

        // Show model badge
        if (data.model && !data.fallback) {
            const badge = document.getElementById('aiModelBadge');
            if (badge) { badge.textContent = data.model; badge.classList.remove('hidden'); }
        }

        const safe = _renderAiMarkdown(reply);
        const msgId = 'aim_' + Date.now();

        chatEl.insertAdjacentHTML('beforeend', `
            <div class="flex gap-2.5 ai-msg-wrap">
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-qi-purple to-qi-cyan flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">AI</div>
                <div class="relative flex-1 min-w-0">
                    <div id="${msgId}" class="ai-bubble-ai bg-qi-card border border-qi-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[11px] text-slate-300 leading-relaxed">${safe}</div>
                    <button onclick="_copyAiMsg('${msgId}')" title="Salin balasan" class="ai-copy-btn absolute top-1.5 right-1.5 opacity-0 transition-opacity p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800 text-[10px]">⎘</button>
                </div>
            </div>`);
        _aiHistory.push({ role: 'assistant', content: reply });
        chatEl.scrollTop = chatEl.scrollHeight;
    } catch(err) {
        document.getElementById(tid)?.remove();
        chatEl.insertAdjacentHTML('beforeend', `
            <div class="flex gap-2.5">
                <div class="w-7 h-7 rounded-full bg-qi-red/20 flex items-center justify-center text-[10px] text-qi-red flex-shrink-0 mt-0.5">!</div>
                <div class="ai-bubble-ai bg-qi-red/5 border border-qi-red/20 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[11px] text-qi-red">
                    Koneksi ke AI gagal. Pastikan api/ai-chat.php tersedia dan GROQ_API_KEY dikonfigurasi.
                </div>
            </div>`);
        chatEl.scrollTop = chatEl.scrollHeight;
    }
}

function clearAiChat() {
    _aiHistory = [];
    const chatEl = document.getElementById('aiChatHistory');
    if (chatEl) chatEl.innerHTML = `
        <div class="flex gap-2.5">
            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-qi-purple to-qi-cyan flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">AI</div>
            <div class="ai-bubble-ai bg-qi-card border border-qi-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[11px] text-slate-300 leading-relaxed">
                Chat direset. Ada yang ingin Anda tanyakan?
            </div>
        </div>`;
    const sugg = document.getElementById('aiSuggestions');
    if (sugg) sugg.style.display = '';
    const badge = document.getElementById('aiModelBadge');
    if (badge) badge.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
// AUTO SIGNAL PANEL
// ═══════════════════════════════════════════════════════════
const AS_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','USDCHF','USDCAD','NZDUSD','GBPJPY','EURJPY','BTCUSDT','ETHUSDT','SOLUSDT'];

// ⛔ DIHAPUS (2026-10-13): fungsi pencatat sinyal di sisi PERAMBAN.
//    `_asGetRecords`, `_asWeekKey`, `_asSaveRecord`, `_asAutoRecord`, `_asCheckTpSl`
//    menyimpan sinyal dengan level PERSENTASE TETAP dan menghitung sendiri TP/SL serta
//    win rate di localStorage `qi_signal_records`. Angka yang dihasilkan TIDAK SAH.
//    Rekor sinyal sekarang HANYA dari server (mesin AUTO_SIGNAL/AI/NEWS/TradingView)
//    melalui api/signal-history.php, dan penilaian TP/SL dilakukan penilai server
//    (api/signal-evaluator.php) memakai pergerakan harga NYATA.
//    Kunci localStorage lama dibersihkan saat halaman dimuat agar angka palsu tidak tersisa.
/* ═══════════════════════════════════════════════════════════════════════════
   REKAP AUTO SIGNAL — SEKARANG DARI SERVER, BUKAN DARI PERAMBAN
   ═══════════════════════════════════════════════════════════════════════════
   ⚠️ KENAPA DIUBAH (ditemukan 2026-10-13): sebelumnya SL/TP dihitung dari
   PERSENTASE TETAP harga (`mult = 0.002/0.003/0.001`) — bukan ATR, bukan mesin,
   bukan TradingView — lalu hasilnya disimpan di localStorage `qi_signal_records`
   dan rekap "TP Hit / SL Hit / Win Rate" dihitung DARI DATA LOKAL ITU. Artinya
   angka kemenangan yang dilihat pengguna TIDAK SAH.
   Sekarang: level diambil dari REKOR SERVER (mesin AUTO_SIGNAL) atau dari RENCANA
   TRADINGVIEW, dan rekap diambil dari `api/signal-history.php` (termasuk drawdown
   kurva R). Bila belum ada data → ditampilkan "—", bukan angka karangan.
   ═══════════════════════════════════════════════════════════════════════════ */
let _asLevels = {};      // simbol → level dari rekor AKTIF (mesin)
let _asRencana = {};     // simbol → rencana TradingView (bila belum ada rekor)
let _asRiwayat = [];     // riwayat rekor dari server
let _asStats = null;     // statistik per mesin + drawdown dari server

async function _asMuatServer() {
    // 1) Rekor sinyal (level aktif + riwayat + statistik + drawdown)
    try {
        const res = await fetch('api/signal-history.php', { cache: 'no-store' });
        const d = await res.json();
        if (d && d.status === 'success') {
            const hist = d.history || [];
            _asRiwayat = hist;
            _asLevels = {};
            hist.forEach(r => {
                const st = String(r.status || '').toUpperCase();
                if (st.indexOf('AKTIF') === -1) return;              // hanya rekor yang masih aktif
                const sym = String(r.symbol || '');
                if (!sym || _asLevels[sym]) return;                  // riwayat sudah urut terbaru
                _asLevels[sym] = {
                    entry: Number(r.entry), sl: Number(r.sl), tp: Number(r.tp),
                    // ARAH REKOR ikut disimpan: level TIDAK BOLEH ditampilkan tanpa arahnya
                    // sendiri. Kesalahan 2026-10-13: kartu memakai arah MATRIKS LIVE tetapi
                    // level dari REKOR (yang arahnya SELL) sehingga tampil "BUY dengan SL di
                    // atas entry" — berbahaya karena bisa membuat posisi terbalik.
                    side: String(r.side || '').toUpperCase(),
                    rr: r.rr || null, id: r.id || '', engine: r.engine || '',
                    status: String(r.status || ''),
                    sumber: 'Rekor ' + (r.engine || 'mesin'),
                };
            });
            const per = (d.statistik_per_engine || []).find(x => String(x.engine || '').toUpperCase() === 'AUTO_SIGNAL') || null;
            _asStats = { mesin: per, drawdown: d.drawdown || null, perMesin: d.statistik_per_engine || [] };
        }
    } catch (e) { /* panel akan menampilkan "—", bukan angka karangan */ }

    // 2) Rencana TradingView (dipakai bila simbol belum punya rekor aktif)
    try {
        const res2 = await fetch('api/rencana-live.php?mode=intraday', { cache: 'no-store' });
        const d2 = await res2.json();
        if (d2 && d2.status === 'success') {
            _asRencana = {};
            // ATR TradingView (H1) dipublikasikan ke window supaya fitur lain (paper trading,
            // modal AI) memakai ATR NYATA sebagai dasar SL/TP — bukan persentase tetap.
            // Diambil dari SEMUA rencana, termasuk yang berstatus "tunggu", karena nilai
            // ATR-nya tetap nyata dan berguna.
            window._qiAtrTerakhir = window._qiAtrTerakhir || {};
            (d2.plans || []).forEach(p => {
                if (!p) return;
                const atrNilai = Number(p.atr);
                if (p.simbol && atrNilai > 0) window._qiAtrTerakhir[p.simbol] = atrNilai;
                if (p.status === 'siap') _asRencana[p.simbol] = p;
            });
        }
    } catch (e) { /* opsional */ }
}

function _asRenderRecords() {
    const set = (id, teks, cls) => { const e = document.getElementById(id); if (e) { e.textContent = teks; if (cls) e.className = cls; } };
    const m = (_asStats && _asStats.mesin) ? _asStats.mesin : null;
    const dinilai = m ? (m.dinilai || 0) : 0;

    set('asRecTP', m ? String(m.menang || 0) : '—', 'text-sm font-mono font-bold text-qi-green');
    set('asRecSL', m ? String(m.kalah || 0) : '—', 'text-sm font-mono font-bold text-qi-red');
    // Win rate hanya bila ADA transaksi tertutup; selain itu "—" (bukan 0%).
    set('asRecWR', (dinilai > 0 && m && m.win_rate !== null && m.win_rate !== undefined) ? (m.win_rate + '%') : '—',
        'text-sm font-mono font-bold ' + ((dinilai > 0) ? 'text-white' : 'text-amber-300'));

    const week = document.getElementById('asRecordWeek');
    if (week) {
        const dd = _asStats && _asStats.drawdown ? _asStats.drawdown : null;
        const bagian = ['Dari rekor SERVER (bukan data peramban)'];
        if (m) bagian.push('AUTO_SIGNAL: ' + dinilai + ' tertutup' + (m.aktif ? (' · ' + m.aktif + ' aktif') : ''));
        if (dd) bagian.push('Drawdown ' + dd.r + 'R');
        week.textContent = bagian.join(' · ');
    }

    const body = document.getElementById('asRecordBody');
    if (!body) return;
    if (!_asRiwayat.length) {
        body.innerHTML = '<tr><td colspan="6" class="px-4 py-4 text-center text-slate-600">Belum ada rekor sinyal di server.</td></tr>';
        return;
    }
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = (v, sym) => {
        if (v === null || v === undefined || isNaN(Number(v))) return '—';
        const n = Number(v);
        const dp = (String(sym).indexOf('USDT') !== -1 || sym === 'XAUUSD') ? 2 : (String(sym).indexOf('JPY') !== -1 ? 3 : 5);
        return n.toFixed(dp);
    };
    body.innerHTML = _asRiwayat.slice(0, 40).map(r => {
        const st = String(r.status || '');
        const cls = st.indexOf('HIT TP') === 0 ? 'text-qi-green' : (st.indexOf('HIT SL') === 0 ? 'text-qi-red' : (st.indexOf('AKTIF') === 0 ? 'text-qi-cyan' : 'text-slate-500'));
        const rNilai = (r.r === null || r.r === undefined) ? null : Number(r.r);
        const rCls = rNilai === null ? 'text-slate-500' : (rNilai > 0 ? 'text-qi-green' : 'text-qi-red');
        const rTeks = rNilai === null ? '—' : ((rNilai > 0 ? '+' : '') + rNilai + 'R');
        const ket = (r.r_sumber === 'rr_rencana') ? ' (dari rencana)' : (r.r_sumber === 'exit_price' ? '' : '');
        return '<tr class="border-b border-qi-border/30 hover:bg-white/[.02]">'
            + '<td class="px-3 py-2 text-left text-white">' + esc(r.symbol) + ' <span class="text-slate-600 text-[9px]">' + esc(r.engine) + '</span></td>'
            + '<td class="px-3 py-2 ' + (r.side === 'BUY' ? 'text-qi-green' : 'text-qi-red') + '">' + esc(r.side) + '</td>'
            + '<td class="px-3 py-2 text-slate-300">' + fmt(r.entry, r.symbol) + '</td>'
            + '<td class="px-3 py-2 text-slate-400">' + fmt(r.sl, r.symbol) + ' / <span class="text-slate-300">' + fmt(r.tp, r.symbol) + '</span></td>'
            + '<td class="px-3 py-2 font-bold ' + cls + '">' + esc(st) + ' <span class="text-slate-600 font-normal">' + esc(r.timestamp_epoch ? new Date(r.timestamp_epoch * 1000).toLocaleString('id-ID', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : String(r.timestamp || '').slice(5, 16)) + '</span></td>'
            + '<td class="px-3 py-2 ' + rCls + '">' + rTeks + '<span class="text-slate-600">' + ket + '</span></td>'
            + '</tr>';
    }).join('');
}

async function refreshAutoSignals() {
    const grid = document.getElementById('asSignalGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-600 text-sm animate-pulse">⏳ Memuat sinyal semua pair...</div>';

    // Use _lastSignals if available, else fetch
    let signals = _lastSignals;
    if (!Object.keys(signals).length) await fetchSignalMatrix();
    signals = _lastSignals;

    let buyCount = 0, sellCount = 0, waitCount = 0;
    const cards = [];
    // Arah yang benar-benar ditampilkan tiap kartu (dipakai untuk menghitung ringkasan
    // di atas panel, supaya ringkasan selalu cocok dengan isi kartu).
    const arahKartu = [];

    for (const sym of AS_SYMS) {
        const sig = signals[sym];
        const priceData = _lastPrices[sym];
        const price = priceData ? parseFloat(priceData.price) : null;

        // Determine direction from signal matrix
        let dir = 'WAIT', color = 'border-qi-border', badge = 'bg-slate-700 text-slate-300', dirText = 'WAIT';
        if (sig) {
            const summary = sig.summary || '';
            if (summary.includes('STRONG_BUY') || summary.includes('BUY')) { dir = 'BUY'; buyCount++; color = 'border-qi-green/40'; badge = 'bg-qi-green/20 text-qi-green'; dirText = summary.includes('STRONG') ? 'STRONG BUY' : 'BUY'; }
            else if (summary.includes('STRONG_SELL') || summary.includes('SELL')) { dir = 'SELL'; sellCount++; color = 'border-qi-red/40'; badge = 'bg-qi-red/20 text-qi-red'; dirText = summary.includes('STRONG') ? 'STRONG SELL' : 'SELL'; }
            else { waitCount++; }
        } else { waitCount++; }

        // ── LEVEL NYATA + ARAH DARI SUMBER YANG SAMA (perbaikan 2026-10-13) ──────
        // ATURAN KERAS: arah dan level WAJIB berasal dari satu sumber. Sebelumnya arah
        // diambil dari matriks live sedangkan level dari rekor server, sehingga muncul
        // "BUY dengan SL di atas entry" — tampilan yang bisa membuat posisi terbalik.
        // Ditambah penjaga kewajaran: BUY wajib TP>entry>SL, SELL wajib TP<entry<SL.
        // Level yang tidak lulus penjaga TIDAK ditampilkan sama sekali.
        let tp = null, sl = null, entryTampil = null, sumberLevel = null, rrTeks = null;
        let arahLevel = null, catatanLevel = '';
        const lvRekor = _asLevels[sym];
        const lvRencana = _asRencana[sym];
        if (lvRekor && isFinite(lvRekor.entry) && isFinite(lvRekor.sl) && isFinite(lvRekor.tp) && lvRekor.entry > 0) {
            entryTampil = lvRekor.entry; sl = lvRekor.sl; tp = lvRekor.tp;
            arahLevel = (lvRekor.side === 'BUY' || lvRekor.side === 'SELL') ? lvRekor.side : null;
            sumberLevel = 'Sinyal aktif dari rekor server (' + (lvRekor.engine || 'mesin') + (lvRekor.id ? ' #' + String(lvRekor.id).slice(-6) : '') + ')';
            rrTeks = lvRekor.rr;
        } else if (lvRencana && isFinite(Number(lvRencana.entry)) && isFinite(Number(lvRencana.sl)) && isFinite(Number(lvRencana.tp1))) {
            entryTampil = Number(lvRencana.entry); sl = Number(lvRencana.sl); tp = Number(lvRencana.tp1);
            arahLevel = (String(lvRencana.arah || '').toUpperCase() === 'BUY' || String(lvRencana.arah || '').toUpperCase() === 'SELL') ? String(lvRencana.arah).toUpperCase() : null;
            sumberLevel = 'Rencana TradingView (' + (lvRencana.tf || 'H1') + ' · TP1)';
            rrTeks = '1 : ' + lvRencana.rr2;
        }
        // Penjaga kewajaran level terhadap arahnya sendiri.
        if (entryTampil != null && sl != null && tp != null) {
            const wajar = (arahLevel === 'BUY') ? (tp > entryTampil && entryTampil > sl)
                        : (arahLevel === 'SELL' ? (tp < entryTampil && entryTampil < sl) : false);
            if (!wajar) {
                catatanLevel = 'Level dari ' + (sumberLevel || 'sumber') + ' TIDAK konsisten dengan arahnya (arah: ' + (arahLevel || 'tidak diketahui') + ') → level TIDAK ditampilkan supaya tidak menyesatkan.';
                tp = null; sl = null; entryTampil = null; sumberLevel = null; rrTeks = null; arahLevel = null;
            }
        }
        // Arah yang DITAMPILKAN: ikut sumber level bila ada; bila tidak ada level, arah
        // matriks live tetap ditampilkan (tanpa level, supaya tidak ada angka menggantung).
        const arahTampil = (arahLevel !== null) ? arahLevel : dir;
        if (arahLevel !== null && dir !== 'WAIT' && arahLevel !== dir) {
            catatanLevel = 'Matriks live saat ini ' + dir + ', sedangkan sinyal aktif di atas ' + arahLevel + '. Jangan dicampur: level hanya sah untuk arah ' + arahLevel + '.';
        }
        if (arahTampil !== dir) {
            dir = arahTampil;
            dirText = (dir === 'BUY') ? '▲ BUY' : (dir === 'SELL' ? '▼ SELL' : '◆ WAIT');
            color = (dir === 'BUY') ? 'border-qi-green/40' : (dir === 'SELL' ? 'border-qi-red/40' : 'border-qi-border');
            badge = (dir === 'BUY') ? 'bg-qi-green/20 text-qi-green' : (dir === 'SELL' ? 'bg-qi-red/20 text-qi-red' : 'bg-slate-700 text-slate-300');
        }
        // Catat arah yang benar-benar ditampilkan kartu ini (untuk ringkasan di atas panel).
        arahKartu.push(dir);

        const fmtP = (p) => p == null ? '—' : (sym.endsWith('USDT') || sym === 'XAUUSD' ? p.toFixed(2) : sym.includes('JPY') ? p.toFixed(3) : p.toFixed(5));
        const rsiStr = sig?.rsi != null ? `RSI ${sig.rsi}` : '';
        const label = SYMBOL_LABELS[sym] || sym;

        // Tampilan kartu ala QIM (assets/js/qim-pages.js). Data & penjaga level tetap dari
        // fungsi ini; templat lama di bawah dipakai bila modul tampilan tidak termuat.
        if (typeof window.qimKartuSinyal === 'function') {
            cards.push(window.qimKartuSinyal({
                sym, label, dir, dirText,
                kuat: /STRONG/.test((sig && sig.summary) || ''),
                entry: entryTampil != null ? fmtP(entryTampil) : (price ? fmtP(price) : '—'),
                tp: tp != null ? fmtP(tp) : null,
                sl: sl != null ? fmtP(sl) : null,
                sumber: sumberLevel, rr: rrTeks,
                rsi: (sig && sig.rsi != null) ? sig.rsi : null,
                mtf: sig ? { '15m': sig['15m'], '1h': sig['1h'], '4h': sig['4h'], '1D': sig['1D'] } : null,
                catatan: catatanLevel
            }));
            continue;
        }
        cards.push(`<div class="bg-qi-card border ${color} rounded-2xl p-4 space-y-3">
            <div class="flex items-center justify-between">
                <span class="font-heading font-bold text-white text-sm">${label}</span>
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${badge}">${dirText}</span>
            </div>
            <div class="text-[10px] text-slate-500 space-y-1">
                <div class="flex justify-between"><span>Entry</span><span class="text-white font-mono">${entryTampil != null ? fmtP(entryTampil) : (price ? fmtP(price) : '—')}</span></div>
                ${tp != null ? `<div class="flex justify-between"><span class="text-qi-green">TP</span><span class="text-qi-green font-mono">${fmtP(tp)}</span></div>` : ''}
                ${sl != null ? `<div class="flex justify-between"><span class="text-qi-red">SL</span><span class="text-qi-red font-mono">${fmtP(sl)}</span></div>` : ''}
                ${sumberLevel
                    ? `<div class="flex justify-between gap-2"><span>Sumber level</span><span class="text-slate-400 text-right">${sumberLevel}${rrTeks ? ' · ' + rrTeks : ''}</span></div>`
                    : '<div class="flex justify-between gap-2"><span>Sumber level</span><span class="text-amber-300 text-right">belum ada setup (tidak dikarang)</span></div>'}
                ${rsiStr ? `<div class="flex justify-between"><span>RSI</span><span class="font-mono text-slate-300">${rsiStr}</span></div>` : ''}
                ${sig ? `<div class="flex gap-1 mt-1 flex-wrap">
                    ${['15m','1h','4h','1D'].map(tf => { const s = sig[tf]||'—'; const c = s.includes('BUY')?'text-qi-green':s.includes('SELL')?'text-qi-red':'text-slate-500'; return `<span class="text-[9px] ${c} border border-qi-border/40 rounded px-1">${tf}:${s.replace('_',' ')}</span>`; }).join('')}
                </div>` : '<div class="text-slate-600 text-[9px]">Signal data tidak tersedia</div>'}
                ${catatanLevel ? `<div class="text-[9px] text-amber-300 leading-snug mt-1">⚠ ${catatanLevel}</div>` : ''}
            </div>
        </div>`);

        // Pencatatan palsu ke localStorage DIHAPUS (2026-10-13): sebelumnya panel ini
        // mencatat sinyal dari level persentase-tetap ke localStorage dan menghitung
        // sendiri "win rate", sehingga angka kemenangan tidak sah. Rekor kini HANYA
        // berasal dari server (mesin AUTO_SIGNAL/AI/NEWS/TradingView).
    }

    grid.innerHTML = cards.join('');
    // Hitungan di atas dihitung dari ARAH YANG DITAMPILKAN pada kartu (bukan mentah dari
    // matriks), supaya tidak ada lagi ketidaksesuaian antara ringkasan dan isi kartu.
    let nBuy = 0, nSell = 0, nWait = 0;
    arahKartu.forEach(a => { if (a === 'BUY') nBuy++; else if (a === 'SELL') nSell++; else nWait++; });
    const elBuy = document.getElementById('asBuyCount');
    const elSell = document.getElementById('asSellCount');
    const elWait = document.getElementById('asWaitCount');
    if (elBuy) elBuy.textContent = nBuy;
    if (elSell) elSell.textContent = nSell;
    if (elWait) elWait.textContent = nWait;
    _asRenderRecords();
}

// TP/SL auto-check runs every 30s when Auto Signal panel is visible
setInterval(function() {
    if (document.getElementById('panel-autosignal') && !document.getElementById('panel-autosignal').classList.contains('hidden')) {
        _asRenderRecords();
    }
}, 30000);

// ═══════════════════════════════════════════════════════════
// MARKET GALAXY — NETWORK MAP PANEL
// ═══════════════════════════════════════════════════════════
let _galaxyRAF = null;

const GALAXY_NODES = [
    { id:'BTC',  sym:'BTCUSDT',  label:'BTC',  color:'#F7931A', r:22, x:0, y:0, vx:0, vy:0 },
    { id:'ETH',  sym:'ETHUSDT',  label:'ETH',  color:'#627EEA', r:18, x:0, y:0, vx:0, vy:0 },
    { id:'SOL',  sym:'SOLUSDT',  label:'SOL',  color:'#9945FF', r:14, x:0, y:0, vx:0, vy:0 },
    { id:'BNB',  sym:'BNBUSDT',  label:'BNB',  color:'#F3BA2F', r:13, x:0, y:0, vx:0, vy:0 },
    { id:'XRP',  sym:'XRPUSDT',  label:'XRP',  color:'#00AAE4', r:12, x:0, y:0, vx:0, vy:0 },
    { id:'DOGE', sym:'DOGEUSDT', label:'DOGE', color:'#C3A634', r:10, x:0, y:0, vx:0, vy:0 },
    { id:'ADA',  sym:'ADAUSDT',  label:'ADA',  color:'#3CC8C8', r:10, x:0, y:0, vx:0, vy:0 },
    { id:'LINK', sym:'LINKUSDT', label:'LINK', color:'#2A5ADA', r:9,  x:0, y:0, vx:0, vy:0 },
];

const GALAXY_EDGES = [
    { a:'BTC', b:'ETH',  strength:0.9 },
    { a:'BTC', b:'BNB',  strength:0.7 },
    { a:'BTC', b:'SOL',  strength:0.75 },
    { a:'ETH', b:'SOL',  strength:0.8 },
    { a:'ETH', b:'LINK', strength:0.7 },
    { a:'ETH', b:'ADA',  strength:0.65 },
    { a:'BNB', b:'XRP',  strength:0.5 },
    { a:'SOL', b:'ADA',  strength:0.6 },
    { a:'XRP', b:'DOGE', strength:0.45 },
    { a:'LINK', b:'ADA', strength:0.55 },
];

function initNetworkGalaxy() {
    const canvas = document.getElementById('galaxyCanvas');
    if (!canvas || canvas._inited) return;
    canvas._inited = true;

    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('galaxyTooltip');
    const nodes = GALAXY_NODES.map(n => ({ ...n }));

    function resetPositions() {
        const W = canvas.width, H = canvas.height;
        const cx = W / 2, cy = H / 2;
        const rr = Math.min(W, H) * 0.30;
        nodes.forEach((n, i) => {
            const angle = (i / nodes.length) * Math.PI * 2;
            n.x = cx + rr * Math.cos(angle);
            n.y = cy + rr * Math.sin(angle);
            n.vx = 0; n.vy = 0;
        });
    }

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width  = rect.width  || 600;
        canvas.height = rect.height || 380;
        resetPositions();
    }
    resize();
    new ResizeObserver(resize).observe(canvas.parentElement);

    async function fetchGalaxyData() {
        try {
            const syms = nodes.map(n => n.sym);
            const url = `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(syms))}`;
            const res = await fetch(url);
            const arr = await res.json();
            const map = {};
            arr.forEach(t => { map[t.symbol] = t; });
            nodes.forEach(n => {
                const t = map[n.sym];
                if (!t) return;
                n.price = parseFloat(t.lastPrice);
                n.chg   = parseFloat(t.priceChangePercent);
                n.vol   = parseFloat(t.quoteVolume);
                n.ringColor = n.chg >= 0 ? '#00C853' : '#FF1744';
            });
            const lu = document.getElementById('galaxyLastUpdate');
            if (lu) lu.textContent = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
            const el = document.getElementById('galaxyDataTable');
            if (el) {
                const sorted = [...nodes].sort((a, b) => (b.vol || 0) - (a.vol || 0));
                el.innerHTML = sorted.map(n => {
                    const chgColor = (n.chg || 0) >= 0 ? 'text-green-400' : 'text-red-400';
                    const sign = (n.chg || 0) >= 0 ? '+' : '';
                    const price = n.price
                        ? (n.price >= 1000 ? n.price.toLocaleString('en', {maximumFractionDigits:0})
                            : n.price >= 1 ? n.price.toFixed(3) : n.price.toFixed(5))
                        : '—';
                    return `<div class="rounded-xl border border-qi-border bg-qi-card px-3 py-2 flex flex-col gap-0.5">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-bold font-mono" style="color:${n.color}">${n.label}</span>
                            <span class="text-[10px] font-mono ${chgColor}">${sign}${(n.chg||0).toFixed(2)}%</span>
                        </div>
                        <div class="text-[12px] font-mono text-qi-text">${price}</div>
                    </div>`;
                }).join('');
            }
        } catch(e) {}
    }
    fetchGalaxyData();
    setInterval(fetchGalaxyData, 30000);

    let hoveredNode = null;
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        hoveredNode = null;
        for (const n of nodes) {
            const dx = mx - n.x, dy = my - n.y;
            if (Math.sqrt(dx*dx + dy*dy) <= n.r + 5) { hoveredNode = n; break; }
        }
        if (hoveredNode && tooltip) {
            const sign = (hoveredNode.chg || 0) >= 0 ? '+' : '';
            const ps = hoveredNode.price
                ? `$${hoveredNode.price >= 1000 ? hoveredNode.price.toLocaleString('en',{maximumFractionDigits:0}) : hoveredNode.price.toFixed(4)}`
                : 'Loading…';
            tooltip.innerHTML = `<span class="font-bold">${hoveredNode.label}</span><br>${ps}<br><span class="${(hoveredNode.chg||0)>=0?'text-green-400':'text-red-400'}">${sign}${(hoveredNode.chg||0).toFixed(2)}%</span>`;
            tooltip.style.display = 'block';
            tooltip.style.left = (mx + 14) + 'px';
            tooltip.style.top  = (my - 36) + 'px';
        } else if (tooltip) {
            tooltip.style.display = 'none';
        }
        canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', () => {
        hoveredNode = null;
        if (tooltip) tooltip.style.display = 'none';
    });

    const REPULSION = 2400, SPRING_K = 0.012, GRAVITY = 0.016, DAMPING = 0.85;
    function idxOf(id) { return nodes.findIndex(n => n.id === id); }

    function simulate() {
        const W = canvas.width, H = canvas.height;
        const cx = W / 2, cy = H / 2;
        nodes.forEach(n => { n.fx = 0; n.fy = 0; });
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                let dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
                const f = REPULSION / (d * d);
                const fx = f * dx / d, fy = f * dy / d;
                a.fx -= fx; a.fy -= fy;
                b.fx += fx; b.fy += fy;
            }
        }
        GALAXY_EDGES.forEach(e => {
            const ai = idxOf(e.a), bi = idxOf(e.b);
            if (ai < 0 || bi < 0) return;
            const a = nodes[ai], b = nodes[bi];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
            const restLen = 75 + (1 - e.strength) * 55;
            const f = SPRING_K * (d - restLen) * e.strength;
            const fx = f * dx / d, fy = f * dy / d;
            a.fx += fx; a.fy += fy;
            b.fx -= fx; b.fy -= fy;
        });
        nodes.forEach(n => {
            n.fx += (cx - n.x) * GRAVITY;
            n.fy += (cy - n.y) * GRAVITY;
            n.vx = (n.vx + n.fx) * DAMPING;
            n.vy = (n.vy + n.fy) * DAMPING;
            n.x += n.vx; n.y += n.vy;
            const m = n.r + 10;
            n.x = Math.max(m, Math.min(W - m, n.x));
            n.y = Math.max(m, Math.min(H - m, n.y));
        });
    }

    function draw() {
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        GALAXY_EDGES.forEach(e => {
            const ai = idxOf(e.a), bi = idxOf(e.b);
            if (ai < 0 || bi < 0) return;
            const a = nodes[ai], b = nodes[bi];
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(0,229,255,${e.strength * 0.22})`;
            ctx.lineWidth = e.strength * 1.5;
            ctx.stroke();
        });
        nodes.forEach(n => {
            const ringColor = n.ringColor || n.color;
            const isHov = hoveredNode === n;
            const glowR = n.r + (isHov ? 16 : 9);
            const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
            grd.addColorStop(0, n.color + '44'); grd.addColorStop(1, 'transparent');
            ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI*2);
            ctx.fillStyle = grd; ctx.fill();
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 3, 0, Math.PI*2);
            ctx.strokeStyle = ringColor + 'BB'; ctx.lineWidth = isHov ? 2.5 : 1.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
            ctx.fillStyle = n.color + 'CC'; ctx.fill();
            ctx.strokeStyle = n.color; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `bold ${Math.max(8, Math.round(n.r * 0.60))}px 'Space Grotesk',monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff'; ctx.shadowColor = n.color; ctx.shadowBlur = 6;
            ctx.fillText(n.label, n.x, n.y); ctx.shadowBlur = 0;
            if (n.chg !== undefined) {
                const sign = n.chg >= 0 ? '+' : '';
                ctx.font = `${Math.max(7, Math.round(n.r * 0.48))}px monospace`;
                ctx.fillStyle = n.chg >= 0 ? '#00C853' : '#FF1744';
                ctx.fillText(`${sign}${n.chg.toFixed(1)}%`, n.x, n.y + n.r + 9);
            }
        });
    }

    function loop() { simulate(); draw(); _galaxyRAF = requestAnimationFrame(loop); }
    if (_galaxyRAF) cancelAnimationFrame(_galaxyRAF);
    loop();
}

function refreshGalaxy() {
    const canvas = document.getElementById('galaxyCanvas');
    if (canvas) canvas._inited = false;
    if (_galaxyRAF) { cancelAnimationFrame(_galaxyRAF); _galaxyRAF = null; }
    initNetworkGalaxy();
}

// Legacy stubs kept to avoid reference errors if called elsewhere
function initGlobe() {
    const canvas = document.getElementById('globeCanvas');
    if (!canvas || canvas._inited) return;
    canvas._inited = true;

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width  = rect.width  || 320;
        canvas.height = rect.height || 280;
    }
    resize();
    new ResizeObserver(resize).observe(canvas.parentElement);

    // Drag to spin
    canvas.addEventListener('mousedown', e => { _globeDragging = true; _globeDragX = e.clientX; canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('touchstart', e => { _globeDragging = true; _globeDragX = e.touches[0].clientX; }, {passive:true});
    window.addEventListener('mouseup', () => { _globeDragging = false; canvas.style.cursor = 'grab'; });
    window.addEventListener('touchend', () => { _globeDragging = false; });
    window.addEventListener('mousemove', e => { if (_globeDragging) { _globeRot += (e.clientX - _globeDragX) * 0.5; _globeDragX = e.clientX; } });
    window.addEventListener('touchmove', e => { if (_globeDragging) { _globeRot += (e.touches[0].clientX - _globeDragX) * 0.5; _globeDragX = e.touches[0].clientX; } }, {passive:true});

    const CITIES = [
        { name:'Sydney',   lat:-34, lon:151, id:'sydney',  color:'#FBBF24' },
        { name:'Tokyo',    lat:35,  lon:139, id:'tokyo',   color:'#EC4899' },
        { name:'London',   lat:51,  lon:-0,  id:'london',  color:'#818CF8' },
        { name:'NY',       lat:41,  lon:-74, id:'ny',      color:'#34D399' },
    ];

    function project(lat, lon, rot, R, cx, cy) {
        const phi   = (90 - lat) * Math.PI / 180;
        const theta = (lon + rot) * Math.PI / 180;
        const x3 = Math.sin(phi) * Math.cos(theta);
        const y3 = -Math.cos(phi);
        const z3 = Math.sin(phi) * Math.sin(theta);
        return { x: cx + R * x3, y: cy + R * y3, z: z3, visible: z3 >= -0.15 };
    }

    function drawFrame() {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const R  = Math.min(W, H) * 0.40;
        const cx = W / 2, cy = H / 2;

        if (!_globeDragging) _globeRot += 0.18;

        ctx.clearRect(0, 0, W, H);

        // Sphere base
        const sph = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
        sph.addColorStop(0, '#0D2040');
        sph.addColorStop(0.6, '#061220');
        sph.addColorStop(1, '#020810');
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = sph; ctx.fill();

        // Grid lines
        ctx.lineWidth = 0.4;
        for (let lat = -80; lat <= 80; lat += 20) {
            ctx.beginPath(); let first = true;
            for (let lon = -180; lon <= 180; lon += 4) {
                const p = project(lat, lon, _globeRot, R, cx, cy);
                if (!p.visible) { first = true; continue; }
                first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
                first = false;
            }
            ctx.strokeStyle = lat === 0 ? 'rgba(0,229,255,0.18)' : 'rgba(0,229,255,0.06)';
            ctx.stroke();
        }
        for (let lon = -180; lon < 180; lon += 20) {
            ctx.beginPath(); let first = true;
            for (let lat = -90; lat <= 90; lat += 4) {
                const p = project(lat, lon, _globeRot, R, cx, cy);
                if (!p.visible) { first = true; continue; }
                first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
                first = false;
            }
            ctx.strokeStyle = 'rgba(0,229,255,0.06)';
            ctx.stroke();
        }

        // Active sessions
        const activeSess = _getActiveSessions ? _getActiveSessions() : [];

        // Cities (back-to-front)
        const projected = CITIES.map(c => ({ ...c, ...project(c.lat, c.lon, _globeRot, R, cx, cy) }))
                                 .sort((a, b) => a.z - b.z);
        projected.forEach(c => {
            if (!c.visible) return;
            const isActive = activeSess.includes(c.id);
            const alpha    = isActive ? 1 : 0.35;
            const dotR     = isActive ? 7 : 4;

            if (isActive) {
                // Pulse glow
                const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 24);
                grd.addColorStop(0, c.color + '66');
                grd.addColorStop(1, 'transparent');
                ctx.beginPath(); ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
                ctx.fillStyle = grd; ctx.fill();
                // Outer ring
                ctx.beginPath(); ctx.arc(c.x, c.y, dotR + 4, 0, Math.PI * 2);
                ctx.strokeStyle = c.color + '80'; ctx.lineWidth = 1; ctx.stroke();
            }

            ctx.beginPath(); ctx.arc(c.x, c.y, dotR, 0, Math.PI * 2);
            ctx.fillStyle = c.color + (isActive ? 'FF' : '66'); ctx.fill();

            // Label
            ctx.font = `${isActive ? 'bold ' : ''}${isActive ? 10 : 8}px 'Space Grotesk', monospace`;
            ctx.fillStyle = isActive ? c.color : '#475569';
            ctx.fillText(c.name, c.x + dotR + 4, c.y + 4);
        });

        // Edge atmosphere
        const atm = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R);
        atm.addColorStop(0, 'transparent');
        atm.addColorStop(1, 'rgba(0,229,255,0.12)');
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = atm; ctx.fill();

        _globeRAF = requestAnimationFrame(drawFrame);
    }
    if (_globeRAF) cancelAnimationFrame(_globeRAF);
    drawFrame();
}

function _getActiveSessions() {
    const now = new Date();
    const wibH = (now.getUTCHours() + 7) % 24;
    const active = [];
    if (wibH >= 4  && wibH < 13) active.push('sydney');
    if (wibH >= 6  && wibH < 15) active.push('tokyo');
    if (wibH >= 14 && wibH < 23) active.push('london');
    if (wibH >= 19 || wibH < 4)  active.push('ny');
    return active;
}

function initSessions() {
    initGlobe();
    updateSessions();
    setInterval(updateSessions, 60000);
}

function updateSessions() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const minTotal = h * 60 + m;
    const timeStr = now.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const el = document.getElementById('sessCurrentTime');
    if (el) el.textContent = `WIB ${timeStr}`;

    // Sessions in WIB (UTC+7): start, end minutes
    const sessions = {
        sydney:  { start: 4*60,   end: 13*60,  el: 'sessCardSydney',  status: 'sessSydStatus',  color: '#3B82F6' },
        tokyo:   { start: 6*60,   end: 15*60,  el: 'sessCardTokyo',   status: 'sessTokyoStatus', color: '#F59E0B' },
        london:  { start: 14*60,  end: 23*60,  el: 'sessCardLondon',  status: 'sessLondonStatus', color: '#00E5FF' },
        ny:      { start: 19*60,  end: 4*60,   el: 'sessCardNY',      status: 'sessNYStatus',    color: '#A855F7' },
    };

    let activeSessions = [];
    for (const [key, s] of Object.entries(sessions)) {
        let active;
        if (s.end < s.start) active = minTotal >= s.start || minTotal < s.end;
        else active = minTotal >= s.start && minTotal < s.end;

        const card = document.getElementById(s.el);
        const stEl = document.getElementById(s.status);
        if (card) {
            card.className = `rounded-xl border p-3 transition-all ${active ? 'border-current bg-current/5' : 'border-qi-border'}`;
            if (active) { card.style.borderColor = s.color; card.style.backgroundColor = s.color + '10'; } else { card.style.borderColor = ''; card.style.backgroundColor = ''; }
        }
        if (stEl) {
            stEl.textContent = active ? '● OPEN' : '○ CLOSED';
            stEl.className = `mt-2 text-[9px] font-mono font-bold ${active ? 'text-qi-green' : 'text-slate-600'}`;
        }
        if (active) activeSessions.push(key);
    }

    // Render timeline bar
    const timeline = document.getElementById('sessTimeline');
    if (timeline) {
        const pct = (minTotal / (24*60) * 100).toFixed(1);
        timeline.innerHTML = `
            <div class="absolute inset-0 flex">
                <div class="h-full opacity-30" style="width:${(4/24*100).toFixed(1)}%; background:transparent"></div>
                <div class="h-full rounded-sm opacity-60" style="width:${(9/24*100).toFixed(1)}%; background:#3B82F6" title="Sydney"></div>
                <div class="h-full rounded-sm opacity-60" style="width:${(9/24*100).toFixed(1)}%; background:var(--qi-gold)" title="Tokyo"></div>
                <div class="h-full rounded-sm opacity-60" style="width:${(9/24*100).toFixed(1)}%; background:var(--qi-cyan)" title="London"></div>
                <div class="h-full rounded-sm opacity-60" style="width:${(9/24*100).toFixed(1)}%; background:#A855F7" title="New York"></div>
            </div>
            <div class="absolute top-0 bottom-0 w-0.5 bg-white" style="left:${pct}%">
                <div class="absolute -top-5 left-1 text-[8px] text-white font-mono whitespace-nowrap">${timeStr}</div>
            </div>
            <div class="absolute bottom-1 left-0 right-0 flex justify-between px-1 text-[7px] text-slate-600">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
            </div>`;
    }

    // Overlap banner
    const banner = document.getElementById('sessOverlapBanner');
    if (banner) {
        const overlaps = [];
        if (activeSessions.includes('sydney') && activeSessions.includes('tokyo')) overlaps.push('Sydney + Tokyo (06:00–13:00 WIB)');
        if (activeSessions.includes('tokyo') && activeSessions.includes('london')) overlaps.push('Tokyo + London (14:00–15:00 WIB)');
        if (activeSessions.includes('london') && activeSessions.includes('ny')) overlaps.push('London + New York (19:00–23:00 WIB) ⚡ PALING LIKUID!');
        if (overlaps.length) {
            banner.classList.remove('hidden');
            banner.innerHTML = `⚡ OVERLAP AKTIF: ${overlaps.join(' · ')}`;
        } else if (activeSessions.length) {
            banner.classList.remove('hidden');
            banner.textContent = `Sesi aktif: ${activeSessions.join(', ').toUpperCase()}`;
            banner.className = 'mt-4 rounded-xl border border-slate-600/40 bg-slate-800/30 px-4 py-3 text-[11px] text-slate-400 text-center';
        } else {
            banner.classList.add('hidden');
        }
    }
}

// ═══════════════════════════════════════════════════════════
// CRYPTO TERMINAL PANEL
// ═══════════════════════════════════════════════════════════
async function initCryptoTerminal() {
    await Promise.allSettled([fetchFearGreed(), fetchIDRRates(), fetchGlobalMarket(), fetchLiquidations(), fetchWhaleSentiment()]);
    // Auto-run AI outlook when panel first opens
    fetchCryptoAIOutlook();
}

async function fetchFearGreed() {
    try {
        const r = await fetch('https://api.alternative.me/fng/?limit=1');
        const j = await r.json();
        if (!j.data?.length) return;
        const val = parseInt(j.data[0].value);
        const label = j.data[0].value_classification;
        const valEl = document.getElementById('ctFGValue');
        const lblEl = document.getElementById('ctFGLabel');
        const barEl = document.getElementById('ctFGBar');
        const cls = val >= 60 ? 'text-qi-green' : val <= 30 ? 'text-qi-red' : 'text-yellow-400';
        if (valEl) { valEl.textContent = val; valEl.className = `text-4xl font-mono font-bold ${cls}`; }
        if (lblEl) { lblEl.textContent = label; lblEl.className = `text-xs mt-1 font-semibold ${cls}`; }
        if (barEl) barEl.style.width = val + '%';
    } catch(e) {
        const el = document.getElementById('ctFGValue');
        if (el) el.textContent = 'N/A';
    }
}

async function fetchIDRRates() {
    try {
        const rateR = await fetch('api/crypto-futures.php?action=idr');
        const rateJ = await rateR.json();
        const usdIdr = rateJ.rate || 0;
        const idrEl = document.getElementById('ctUSDIDR');
        if (idrEl) idrEl.textContent = usdIdr > 0 ? 'Rp ' + usdIdr.toLocaleString('id-ID', {maximumFractionDigits:0}) : '—';

        const cryptoR = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT","SOLUSDT"]');
        const cryptoJ = await cryptoR.json();
        if (!Array.isArray(cryptoJ)) return;
        const prices = Object.fromEntries(cryptoJ.map(p => [p.symbol, parseFloat(p.price)]));
        if (usdIdr > 0) {
            const btcEl = document.getElementById('ctBTCIDR');
            const ethEl = document.getElementById('ctETHIDR');
            const solEl = document.getElementById('ctSOLIDR');
            if (btcEl) btcEl.textContent = 'Rp ' + (prices.BTCUSDT * usdIdr / 1e6).toFixed(1) + 'M';
            if (ethEl) ethEl.textContent = 'Rp ' + (prices.ETHUSDT * usdIdr / 1e6).toFixed(2) + 'M';
            if (solEl) solEl.textContent = 'Rp ' + (prices.SOLUSDT * usdIdr / 1e3).toFixed(0) + 'K';
        }
    } catch(e) {}
}

async function fetchGlobalMarket() {
    try {
        const r = await fetch('https://api.coingecko.com/api/v3/global');
        const j = await r.json();
        const d = j.data;
        if (!d) return;
        const dom = d.market_cap_percentage?.btc?.toFixed(1);
        const mc  = d.total_market_cap?.usd ? (d.total_market_cap.usd / 1e12).toFixed(2) : null;
        const vol = d.total_volume?.usd ? (d.total_volume.usd / 1e9).toFixed(1) : null;
        const domVal = document.getElementById('ctDomValue');
        const domNote = document.getElementById('ctDomNote');
        const mcEl = document.getElementById('ctGlobalMC');
        const volEl = document.getElementById('ctVolume');
        if (dom && domVal) domVal.textContent = dom + '%';
        if (domNote) domNote.textContent = parseFloat(dom) > 55 ? 'BTC dominan — altcoin lemah' : parseFloat(dom) < 45 ? 'Altcoin season' : 'Market seimbang';
        if (mcEl) mcEl.textContent = mc ? '$' + mc + 'T' : '—';
        if (volEl) volEl.textContent = vol ? '$' + vol + 'B' : '—';
    } catch(e) {}
}

async function fetchLiquidations() {
    const body = document.getElementById('ctLiqBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-600 animate-pulse">Memuat data likuidasi…</td></tr>';
    try {
        // PHP proxy: coba fapi.binance.com, fallback ke spot 24h ticker
        const res = await fetch('api/crypto-futures.php?action=liquidation');
        const j   = await res.json();
        if (!j.ok || !j.data?.length) throw new Error('no data');

        body.innerHTML = j.data.map(t => {
            const chg    = parseFloat(t.change);
            const price  = parseFloat(t.price);
            const vol    = parseFloat(t.volume);
            const fr     = t.funding ?? null;
            const liqSide = t.liqSide === 'LONG' ? 'LONG LIQ 🔴' : t.liqSide === 'SHORT' ? 'SHORT LIQ 🟢' : chg <= -1.5 ? 'LONG SQUEEZE' : chg >= 1.5 ? 'SHORT SQUEEZE' : 'NETRAL';
            const liqColor = chg <= -1.5 ? 'text-red-400' : chg >= 1.5 ? 'text-green-400' : 'text-slate-400';
            const chgColor = chg >= 0 ? 'text-green-400' : 'text-red-400';
            const frColor  = fr !== null ? (fr > 0.01 ? 'text-green-400' : fr < -0.01 ? 'text-red-400' : 'text-slate-500') : 'text-slate-700';
            const sym      = t.symbol.replace('USDT','/USDT');
            const volFmt   = vol >= 1e9 ? '$' + (vol/1e9).toFixed(1) + 'B' : '$' + (vol/1e6).toFixed(0) + 'M';
            const priceFmt = price >= 1000 ? price.toLocaleString('en-US',{maximumFractionDigits:1}) : price.toPrecision(5);
            const frFmt    = fr !== null ? fr.toFixed(4) + '%' : '—';
            return `<tr class="border-b border-qi-border/20 hover:bg-white/2 transition-colors">
                <td class="px-3 py-2 text-left font-bold text-white">${sym}</td>
                <td class="px-3 py-2 text-right text-slate-300 font-mono">${priceFmt}</td>
                <td class="px-3 py-2 text-right font-mono font-bold ${chgColor}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</td>
                <td class="px-3 py-2 text-right text-slate-400 font-mono">${volFmt}</td>
                <td class="px-3 py-2 text-center text-[9px] font-bold ${liqColor}">${liqSide}</td>
                <td class="px-3 py-2 text-right font-mono text-[9px] ${frColor}">${frFmt}</td>
            </tr>`;
        }).join('');
    } catch(e) {
        body.innerHTML = '<tr><td colspan="6" class="px-4 py-4 text-center text-slate-600">Data tidak tersedia — coba refresh</td></tr>';
    }
}

async function fetchWhaleSentiment() {
    const sym = document.getElementById('sentSymSel')?.value || 'BTCUSDT';
    const vEl = document.getElementById('sentVerdict');
    if (vEl) vEl.textContent = 'Memuat live data Binance...';
    try {
        const res = await fetch('api/crypto-futures.php?action=sentiment&symbol=' + sym);
        const j = await res.json();
        if (!j.ok) throw new Error('Failed');

        const retL = document.getElementById('sentRetLong');
        const retS = document.getElementById('sentRetShort');
        const retR = document.getElementById('sentRetRatio');
        if (retL) retL.textContent = j.retail.long + '%';
        if (retS) retS.textContent = j.retail.short + '%';
        if (retR) retR.textContent = 'Ratio: ' + j.retail.ratio.toFixed(2);

        const whL = document.getElementById('sentWhaleLong');
        const whS = document.getElementById('sentWhaleShort');
        const whR = document.getElementById('sentWhaleRatio');
        if (whL) whL.textContent = j.whale.long + '%';
        if (whS) whS.textContent = j.whale.short + '%';
        if (whR) whR.textContent = 'Ratio: ' + j.whale.ratio.toFixed(2);

        if (vEl) {
            vEl.textContent = j.verdict;
            vEl.className = 'text-xs font-mono font-bold my-1 ' + (j.divergence > 5 ? 'text-qi-green' : (j.divergence < -5 ? 'text-qi-red' : 'text-qi-cyan'));
        }
        const tkEl = document.getElementById('sentTaker');
        if (tkEl) tkEl.textContent = 'Taker Buy/Sell: ' + j.takerBuySellRatio.toFixed(2) + ' (Divergence: ' + (j.divergence >= 0 ? '+' : '') + j.divergence + '%)';
    } catch(e) {
        if (vEl) vEl.textContent = 'Gagal memuat sentiment';
    }
}

async function fetchCryptoAIOutlook() {
    const el = document.getElementById('ctAIOutlook');
    if (!el) return;
    el.innerHTML = '<div class="text-qi-cyan text-xs animate-pulse font-mono">⏳ QUANTUM AI sedang menganalisa market crypto...</div>';
    try {
        const prices = Object.fromEntries(
            Object.entries(_lastPrices).filter(([k]) => k.endsWith('USDT')).slice(0,8).map(([k,v])=>[k,{price:v.price,chgPct:v.chgPct}])
        );
        const r = await fetch('api/ai-chat.php', {
            method: 'POST', headers: QuantumAuth.authHeaders({'Content-Type':'application/json'}),
            body: JSON.stringify({
                message: 'Berikan outlook harian untuk pasar crypto hari ini. Analisa Bitcoin, Ethereum, dan altcoin utama. Sertakan: 1) Sentimen pasar (bullish/bearish/sideways), 2) Level support dan resistance BTC penting, 3) Altcoin yang perlu diperhatikan, 4) Risiko utama yang perlu diwaspadai, 5) Rekomendasi trading singkat. Jawab dalam bahasa Indonesia yang jelas dan actionable.',
                history: [], context: { prices }
            })
        });
        const j = await r.json();
        var _t2 = (j.reply||j.message||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); el.innerHTML = `<div class="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-200">${_t2}</div>`;
    } catch(e) { el.innerHTML = '<div class="text-red-400 text-xs">AI error — coba lagi.</div>'; }
}
