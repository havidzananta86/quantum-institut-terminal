// Skrip halaman beranda (index.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
// Urutan blok sama dengan urutan aslinya di halaman.
(function(){
    var grid = document.getElementById('tradeIdeasGrid');
    if (!grid) return;
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function sym(s) { s = String(s || ''); if (/USDT$/.test(s)) return s.replace(/USDT$/, '/USDT'); return s.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2'); }
    function lalu(iso) {
        var t = Date.parse(iso); if (isNaN(t)) return '';
        var d = Math.max(0, (Date.now() - t) / 1000);
        if (d < 3600) return Math.max(1, Math.round(d / 60)) + ' menit lalu';
        if (d < 86400) return Math.round(d / 3600) + ' jam lalu';
        return Math.round(d / 86400) + ' hari lalu';
    }
    function angka(v) { var n = Number(v); if (!isFinite(n)) return '—'; return n >= 1000 ? n.toLocaleString('en-US', {maximumFractionDigits: 2}) : String(n); }
    function status(st) {
        st = String(st || '');
        if (st.indexOf('HIT TP') === 0) return { t: 'TP KENA', c: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
        if (st.indexOf('HIT SL') === 0) return { t: 'SL KENA', c: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
        if (st.indexOf('EXPIRED') === 0) return { t: 'KEDALUWARSA', c: 'text-slate-300 bg-slate-500/15 border-slate-500/30' };
        if (st === 'AKTIF') return { t: 'AKTIF', c: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' };
        return { t: esc(st || '—'), c: 'text-slate-300 bg-slate-500/15 border-slate-500/30' };
    }
    function kosong(pesan) { grid.innerHTML = '<div class="glass-card rounded-2xl border border-slate-700/40 p-6 text-center text-slate-500 text-xs font-mono sm:col-span-2 lg:col-span-3">' + esc(pesan) + '</div>'; }
    fetch('api/signal-history.php', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var h = (d && d.status === 'success' && Array.isArray(d.history)) ? d.history.slice() : [];
            h.sort(function(a, b) { return Date.parse(b.timestamp) - Date.parse(a.timestamp); });
            h = h.slice(0, 6);
            if (!h.length) return kosong('Belum ada sinyal tercatat.');
            grid.innerHTML = '';
            h.forEach(function(x) {
                var beli = String(x.side).toUpperCase() === 'BUY';
                var st = status(x.status);
                var warna = beli ? 'emerald' : 'rose';
                var el = document.createElement('div');
                el.className = 'glass-card rounded-2xl overflow-hidden border border-' + warna + '-500/20 hover:border-' + warna + '-500/50 transition-all cursor-pointer';
                el.onclick = function() { window.location.href = 'transparansi.html'; };
                el.innerHTML = '<div class="h-1.5 w-full bg-gradient-to-r from-' + warna + '-500 to-' + (beli ? 'cyan' : 'orange') + '-500"></div>'
                    + '<div class="p-5">'
                    + '<div class="flex items-center justify-between mb-3">'
                    + '<span class="px-2 py-0.5 text-[10px] font-mono font-bold bg-' + warna + '-500/15 text-' + warna + '-400 border border-' + warna + '-500/30 rounded">' + (beli ? '▲ BUY' : '▼ SELL') + '</span>'
                    + '<span class="text-[10px] font-mono text-slate-400">' + esc(x.timeframe || '') + ' · ' + esc(lalu(x.timestamp)) + '</span></div>'
                    + '<div class="font-heading font-bold text-white text-base mb-2">' + esc(sym(x.symbol)) + '</div>'
                    + '<div class="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-400 mb-3">'
                    + '<div>Entry<br><b class="text-white">' + esc(angka(x.entry)) + '</b></div>'
                    + '<div>SL<br><b class="text-rose-300">' + esc(angka(x.sl)) + '</b></div>'
                    + '<div>TP<br><b class="text-emerald-300">' + esc(angka(x.tp)) + '</b></div></div>'
                    + '<div class="flex items-center justify-between text-[10px] font-mono border-t border-slate-800/60 pt-3">'
                    + '<span class="text-slate-500 truncate pr-2">' + esc(x.engine_name || 'Quantum') + '</span>'
                    + '<span class="px-2 py-0.5 rounded border ' + st.c + '">' + st.t + '</span></div>'
                    + '</div>';
                grid.appendChild(el);
            });
        }).catch(function() { kosong('Sinyal belum bisa dimuat saat ini. Kami tidak menampilkan contoh pengganti.'); });
})();

(function(){
    var COLORS = ['amber','emerald','cyan','purple','blue','rose'];
    function el(id) { return document.getElementById(id); }
    function set(id, t) { var e = el(id); if (e) e.textContent = t; }
    function formatSym(s) {
        if (!s) return s;
        s = String(s);
        if (/USDT$/.test(s)) return s.replace(/USDT$/, '/USDT');
        return s.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
    }
    function gagal() {
        set('idxSampelCatatan', 'Statistik sinyal belum bisa dimuat saat ini. Kami tidak menampilkan angka perkiraan.');
        set('idxStatWrN', 'belum bisa dimuat');
        var c = el('idxWinrateByPair'); if (c) c.innerHTML = '<div class="text-[11px] text-slate-500">Data belum tersedia.</div>';
    }
    function renderBars(pairs) {
        var c = el('idxWinrateByPair');
        if (!c) return;
        if (!pairs.length) { c.innerHTML = '<div class="text-[11px] text-slate-500">Belum ada sinyal selesai.</div>'; return; }
        c.innerHTML = '';
        pairs.forEach(function(p, i) {
            var warna = p.sampel_kecil ? 'slate' : COLORS[i % COLORS.length];
            var row = document.createElement('div');
            row.className = 'flex items-center gap-3';
            var lebar = Math.max(2, Math.min(100, Math.round(p.win_rate)));
            row.innerHTML = '<span class="w-24 text-[11px] font-mono text-slate-400 shrink-0">' + formatSym(p.simbol) + ' <span class="text-slate-600">(n=' + p.dinilai + ')</span></span>'
                + '<div class="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden"><div class="h-full bg-gradient-to-r from-' + warna + '-400 to-' + warna + '-500 rounded-full" style="width:' + lebar + '%"></div></div>'
                + '<span class="w-10 text-right text-[11px] font-mono text-' + warna + '-400">' + Math.round(p.win_rate) + '%</span>';
            c.appendChild(row);
        });
    }
    fetch('api/transparansi.php', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d || d.status !== 'success') return gagal();
            var st = (d.sinyal_resmi && d.sinyal_resmi.statistik) || {};
            var n = st.dinilai || 0;
            set('idxWinrate', st.win_rate == null ? '—' : st.win_rate + '%');
            set('idxTotalWins', n ? String(st.menang) : '—');
            set('idxAvgRR', st.rr_rata ? '1:' + st.rr_rata : '—');
            set('idxStatSinyal', d.sinyal_resmi.total_tercatat ? Number(d.sinyal_resmi.total_tercatat).toLocaleString('id-ID') : '—');
            set('idxStatWr', st.win_rate == null ? '—' : st.win_rate + '%');
            set('idxStatWrN', n ? ('dari ' + n + ' sinyal selesai · interval 95%: ' + st.ci_bawah + '–' + st.ci_atas + '%' + (st.cukup_sampel ? '' : ' · sampel kecil')) : 'belum ada sinyal selesai');
            var pairs = (st.per_simbol || []).filter(function(p) { return p.dinilai > 0 && p.win_rate != null; })
                .sort(function(a, b) { return b.dinilai - a.dinilai; }).slice(0, 6);
            renderBars(pairs);
            var layak = pairs.filter(function(p) { return p.dinilai >= 10; }).sort(function(a, b) { return b.win_rate - a.win_rate; })[0];
            set('idxBestPair', layak ? formatSym(layak.simbol) : '—');
            set('idxBestPairWr', layak ? layak.win_rate.toFixed(1) + '% (n=' + layak.dinilai + ')' : 'min. 10 sinyal selesai');
            set('idxSampelCatatan', (st.catatan || '') + ' Hasil dalam R, spread/komisi belum dikurangkan. Hasil masa lalu tidak menjamin hasil di masa depan.');
        }).catch(gagal);
})();

// ── WIB LIVE CLOCK (UTC+7) ────────────────────────────────────────────────
(function tickWIB() {
    const el = document.getElementById('wibClock');
    if (!el) return;
    function update() {
        // Zona waktu eksplisit: rumus lama (+7 jam − getTimezoneOffset) menambah 14 jam bila browser sudah WIB.
        el.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false });
    }
    update();
    setInterval(update, 1000);
})();

// ── LIVE SIGNAL READOUT — rotating pairs from Binance ───────────────────
const SIGNAL_PAIRS = [
    { sym:'BTCUSDT',  label:'BTC/USDT',  dec:0 },
    { sym:'ETHUSDT',  label:'ETH/USDT',  dec:2 },
    { sym:'SOLUSDT',  label:'SOL/USDT',  dec:2 },
    { sym:'BNBUSDT',  label:'BNB/USDT',  dec:2 },
    { sym:'XRPUSDT',  label:'XRP/USDT',  dec:4 },
    { sym:'DOGEUSDT', label:'DOGE/USDT', dec:5 },
];
let _sigPairIdx = 0;

function _calcRSI14(closes) {
    if (closes.length < 15) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) gains += d; else losses -= d;
    }
    if (losses === 0) return 100;
    const rs = (gains / 14) / (losses / 14);
    return 100 - 100 / (1 + rs);
}

async function fetchLiveSignal() {
    const pair = SIGNAL_PAIRS[_sigPairIdx];
    _sigPairIdx = (_sigPairIdx + 1) % SIGNAL_PAIRS.length;
    try {
        const [tr, kr] = await Promise.all([
            fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${pair.sym}`),
            fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${pair.sym}&interval=1h&limit=20`)
        ]);
        if (!tr.ok || !kr.ok) throw new Error('fetch fail');
        const ticker = await tr.json();
        const klines = await kr.json();

        const price  = parseFloat(ticker.lastPrice);
        const chgPct = parseFloat(ticker.priceChangePercent);
        const closes = klines.map(k => parseFloat(k[4]));
        const rsi    = _calcRSI14(closes);

        let statusTxt, statusClass, modeTxt, slMult, tpMult;
        if (chgPct > 0.8 && rsi < 65) {
            statusTxt = 'BUY SETUP'; statusClass = 'bg-emerald-400/10 text-emerald-400 border-emerald-400/40';
            modeTxt = `Mode: Quantum Momentum LONG — RSI ${rsi.toFixed(0)}, trend bullish H1.`;
            slMult = -0.0075; tpMult = 0.022;
        } else if (chgPct < -0.8 && rsi > 35) {
            statusTxt = 'SELL SETUP'; statusClass = 'bg-rose-400/10 text-rose-400 border-rose-400/40';
            modeTxt = `Mode: Quantum Momentum SHORT — RSI ${rsi.toFixed(0)}, trend bearish H1.`;
            slMult = 0.0075; tpMult = -0.022;
        } else {
            statusTxt = 'WAIT — KONSOLIDASI'; statusClass = 'bg-cyan-400/10 text-cyan-400 border-cyan-400/40';
            modeTxt = `Mode: Quantum SNR Rejection — RSI ${rsi.toFixed(0)}, menunggu breakout konfirmasi.`;
            slMult = -0.006; tpMult = 0.018;
        }

        const fmt = v => v.toLocaleString('en-US', {minimumFractionDigits: pair.dec, maximumFractionDigits: pair.dec});
        const sl  = price * (1 + slMult);
        const tp  = price * (1 + tpMult);
        const rr  = (Math.abs(tpMult) / Math.abs(slMult)).toFixed(1);
        const conditions = Math.round(5 + Math.abs(rsi - 50) / 10);

        document.getElementById('sigPair').innerHTML = `${pair.label} <span class="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">H1</span>`;
        const ss = document.getElementById('sigStatus');
        ss.textContent = statusTxt;
        ss.className = `px-2.5 py-1 text-[11px] font-bold rounded border ${statusClass}`;
        document.getElementById('sigMode').textContent = modeTxt;
        document.getElementById('sigEntry').textContent = `$${fmt(price * 0.999)} – $${fmt(price * 1.001)}`;
        const slSign = slMult > 0 ? '+' : '';
        const tpSign = tpMult > 0 ? '+' : '';
        document.getElementById('sigSL').textContent = `$${fmt(sl)} (${slSign}${(slMult * 100).toFixed(2)}%)`;
        document.getElementById('sigTP').textContent = `$${fmt(tp)} (${tpSign}${(tpMult * 100).toFixed(2)}%)`;
        document.getElementById('sigRR').textContent = `1 : ${rr}`;
        document.getElementById('sigConditions').textContent = `${conditions} dari 8 Syarat`;
    } catch(e) {
        const ss = document.getElementById('sigStatus');
        if (ss) { ss.textContent = 'SETUP TERBENTUK'; ss.className = 'px-2.5 py-1 text-[11px] font-bold rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/40'; }
        if (document.getElementById('sigEntry')) document.getElementById('sigEntry').textContent = 'Cek Terminal →';
    }
}
fetchLiveSignal();
setInterval(fetchLiveSignal, 60000);

// ── LIVE TRADE IDEAS — fetch real signals from API ─────────────────────
(function() {
    const IDEAS_CFG = [
        { sym: 'BTCUSDT', label: 'BTC/USDT', idx: 0 },
        { sym: 'XAUUSD',  label: 'XAU/USD',  idx: 1 },
        { sym: 'ETHUSDT', label: 'ETH/USDT', idx: 2 },
        { sym: 'EURUSD',  label: 'EUR/USD',  idx: 3 },
        { sym: 'SOLUSDT', label: 'SOL/USDT', idx: 4 },
    ];
    async function refreshIdeas() {
        const grid = document.getElementById('tradeIdeasGrid');
        if (!grid) return;
        const cards = grid.querySelectorAll(':scope > div');
        for (const cfg of IDEAS_CFG) {
            try {
                const res = await fetch(`api/signals.php?symbol=${cfg.sym}&timeframe=H1&engine=MULTI`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
                if (!res.ok) continue;
                const data = await res.json();
                if (!data.signal || !cards[cfg.idx]) continue;
                const sig = data.signal;
                const dir = sig.direction || 'WAIT';
                const titleEl = cards[cfg.idx].querySelector('.font-heading.font-bold.text-base');
                const descEl  = cards[cfg.idx].querySelector('p.text-slate-400');
                const badgeEl = cards[cfg.idx].querySelector('span[class*="font-mono font-bold"]');
                const timeEl  = cards[cfg.idx].querySelector('span[class*="text-slate-400"]:last-of-type');
                if (titleEl) titleEl.textContent = `${cfg.label} — ${sig.label || dir}`;
                if (descEl)  descEl.textContent  = sig.reason || sig.summary || descEl.textContent;
                if (badgeEl) {
                    if (dir === 'BUY' || dir === 'STRONG_BUY') {
                        badgeEl.textContent = '▲ LONG'; badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded';
                    } else if (dir === 'SELL' || dir === 'STRONG_SELL') {
                        badgeEl.textContent = '▼ SHORT'; badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded';
                    } else {
                        badgeEl.textContent = '◆ WAIT'; badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded';
                    }
                }
                if (timeEl && data.timestamp) {
                    const ago = Math.round((Date.now() / 1000 - new Date(data.timestamp).getTime() / 1000) / 60);
                    timeEl.textContent = `H1 · ${ago < 60 ? ago + ' mnt lalu' : Math.round(ago / 60) + ' jam lalu'}`;
                }
            } catch(e) {}
        }
    }
    refreshIdeas();
    setInterval(refreshIdeas, 120000);
})();

// ── STATS COUNT-UP ANIMATION (#3) ───────────────────────────────────────
(function() {
    function animateCount(el, target, suffix, duration) {
        if (!el) return;
        const start = 0;
        const startTime = performance.now();
        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const val = Math.round(start + (target - start) * eased);
            el.textContent = val.toLocaleString('id-ID') + (suffix || '');
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const el2 = document.getElementById('idxTotalWins');
                const val = el2 ? parseInt(el2.textContent.replace(/\D/g,''),10) || 0 : 0;
                if (val > 0) animateCount(el2, val, '', 1800);
                obs.disconnect();
            }
        });
    }, { threshold: 0.3 });
    const el = document.getElementById('idxTotalWins');
    if (el) obs.observe(el);
})();

// ── LIVE TICKER BAR — updates both copies via data-ticker-sym ────────────
(function() {
    const FMT = {
        BTCUSDT: { dec: 0, prefix: '$' }, XAUUSD: { dec: 2, prefix: '$' },
        ETHUSDT: { dec: 2, prefix: '$' }, EURUSD: { dec: 5, prefix: ''  },
        SOLUSDT: { dec: 2, prefix: '$' },
    };
    async function refreshTicker() {
        try {
            const res = await fetch('api/live-price.php?symbols=BTCUSDT,XAUUSD,ETHUSDT,EURUSD,SOLUSDT', { cache: 'no-store' });
            if (!res.ok) return;
            const json = await res.json();
            if (!json.prices) return;
            for (const [sym, data] of Object.entries(json.prices)) {
                if (!data || data.price == null || isNaN(data.price)) continue;
                const cfg = FMT[sym]; if (!cfg) continue;
                const price = data.price.toLocaleString('en-US', { minimumFractionDigits: cfg.dec, maximumFractionDigits: cfg.dec });
                const chg = data.chgPct ?? 0;
                const sign = chg >= 0 ? '+' : '';
                const cls = chg >= 0 ? 'ticker-price text-emerald-400' : 'ticker-price text-rose-400';
                document.querySelectorAll(`[data-ticker-sym="${sym}"] .ticker-price`).forEach(el => {
                    el.textContent = `${cfg.prefix}${price} (${sign}${chg.toFixed(2)}%)`;
                    el.className = cls;
                });
            }
        } catch(e) {}
    }
    refreshTicker();
    setInterval(refreshTicker, 30000);
})();

(function() {
    const counters = document.querySelectorAll('[data-count-to]');
    if (!counters.length) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || entry.target._counted) return;
            entry.target._counted = true;
            const el = entry.target;
            const target = parseInt(el.dataset.countTo, 10);
            const suffix = el.dataset.countSuffix || '';
            const fmt = el.dataset.countFormat === 'true';
            const dur = Math.min(1800, 400 + target * 1.2);
            const start = performance.now();
            function step(now) {
                const t = Math.min((now - start) / dur, 1);
                const ease = 1 - Math.pow(1 - t, 3);
                const val = Math.round(ease * target);
                el.textContent = (fmt ? val.toLocaleString('en-US') : val) + suffix;
                if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }, { threshold: 0.3 });
    counters.forEach(c => io.observe(c));
})();

let _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    const btn = document.getElementById('btnInstallAndroid');
    if (btn) {
        btn.classList.add('animate-pulse');
        btn.textContent = 'Install Sekarang';
    }
});
function triggerPWAInstall() {
    if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        _deferredInstallPrompt.userChoice.then(result => {
            if (result.outcome === 'accepted') {
                if (window.showQuantumToast) showQuantumToast('Aplikasi berhasil diinstall!', 'success');
            }
            _deferredInstallPrompt = null;
        });
    } else {
        window.location.href = 'pwa.html';
    }
}
window.addEventListener('appinstalled', () => {
    if (window.showQuantumToast) showQuantumToast('Quantum Terminal terinstall di perangkat Anda!', 'success');
});
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Versi pada URL memaksa browser mengambil service worker terbaru;
        // tanpa itu .js yang di-cache "immutable" bisa menahan versi lama.
        navigator.serviceWorker.register('sw.js?v=f94deeac11').then((reg) => {
            if (reg && reg.update) reg.update();
        }).catch(() => {});
    });
}

document.addEventListener('click', function(e) {
    var wrap = document.getElementById('navCtaWrap');
    var drop = document.getElementById('navCtaDrop');
    if (wrap && drop && !wrap.contains(e.target)) drop.classList.add('hidden');
});

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline').
(function() {
    var cta = document.getElementById('navCtaBtn');
    if (cta) cta.addEventListener('click', function() { document.getElementById('navCtaDrop').classList.toggle('hidden'); });
    var pasang = document.getElementById('btnInstallAndroid');
    if (pasang) pasang.addEventListener('click', triggerPWAInstall);
})();
