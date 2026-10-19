
// Apply theme choice: close dropdown first, then change theme after DOM settles
window.applyThemeChoice = function(theme) {
    var dd = document.getElementById('themeDropdown');
    if (dd) dd.classList.add('hidden');
    setTimeout(function() {
        if (typeof setQITheme === 'function') setQITheme(theme);
    }, 10);
};
// Theme change: re-init chart after theme applies
window.addEventListener('qi-theme-change', function(e) {
    setTimeout(function() {
        if (typeof initLwChart === 'function') initLwChart();
        if (typeof loadTvTaWidget === 'function' && typeof _outlookSym !== 'undefined') loadTvTaWidget(_outlookSym);
    }, 50);
});
// Close dropdown on outside click
document.addEventListener('click', function(e) {
    var wrap = document.getElementById('themeMenuWrap');
    var dd = document.getElementById('themeDropdown');
    if (wrap && dd && !wrap.contains(e.target)) dd.classList.add('hidden');
});

// ─── AI Auto-Trade Panel ────────────────────────────────────────────────────
const AI_SYMBOLS_ALL = ['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','BNBUSDT','XRPUSDT'];
let aiSelectedSyms = ['BTCUSDT','XAUUSD','EURUSD'];
let aiEnabled = false;
let aiPollTimer = null;
let aiSignalData = {};

function initAiPanel() {
    renderAiSymbolBtns();
    loadAiStatus();
}

function renderAiSymbolBtns() {
    const wrap = document.getElementById('aiSymbolBtns');
    if (!wrap) return;
    wrap.innerHTML = AI_SYMBOLS_ALL.map(sym => {
        const active = aiSelectedSyms.includes(sym);
        return `<button data-qi-aksi="toggleAiSym" data-qi-arg="${QIAksi.arg(sym)}" data-sym="${sym}"
            class="ai-sym-btn text-[10px] font-mono px-2 py-1 rounded border transition-all ${active
                ? 'border-qi-purple/60 bg-qi-purple/15 text-purple-300'
                : 'border-qi-border text-slate-500 hover:border-slate-500'}">${sym}</button>`;
    }).join('');
}

function toggleAiSym(sym) {
    const idx = aiSelectedSyms.indexOf(sym);
    if (idx >= 0) aiSelectedSyms.splice(idx, 1);
    else aiSelectedSyms.push(sym);
    renderAiSymbolBtns();
}

async function loadAiStatus() {
    const tok = localStorage.getItem('qi_session');
    if (!tok) return;
    try {
        const res  = await fetch('api/ai-auto-trade.php', { headers: { 'Authorization': 'Bearer ' + tok } });
        const json = await res.json();
        if (json.status !== 'success') return;

        const sett = json.settings || {};
        aiEnabled = !!sett.enabled;
        if (sett.symbols) {
            try { aiSelectedSyms = JSON.parse(sett.symbols); } catch(e) {}
        }
        if (sett.lots) {
            const sel = document.getElementById('aiLotsSelect');
            if (sel) sel.value = parseFloat(sett.lots).toFixed(2);
        }
        renderAiSymbolBtns();
        updateAiStatusUI();
        renderAiOpenPositions(json.open_positions || []);
        renderAiTradeLog(json.log || []);
        updateAiStats(json.log || []);
    } catch(e) { /* ignore */ }
}

function updateAiStatusUI() {
    const dot    = document.getElementById('aiStatusDot');
    const badge  = document.getElementById('aiStatusBadge');
    const btn    = document.getElementById('aiToggleBtn');
    if (!dot) return;
    if (aiEnabled) {
        dot.className   = 'w-2 h-2 rounded-full bg-green-400 animate-pulse';
        badge.className = 'text-[10px] px-2 py-0.5 rounded border border-green-500/40 text-green-400';
        badge.textContent = 'ACTIVE';
        btn.textContent   = 'Nonaktifkan';
        btn.className     = 'px-3 py-1 rounded-lg text-xs font-bold border transition-all border-red-500/40 text-red-400 hover:bg-red-500/10';
        startAiPoll();
    } else {
        dot.className   = 'w-2 h-2 rounded-full bg-slate-600';
        badge.className = 'text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-500';
        badge.textContent = 'INACTIVE';
        btn.textContent   = 'Aktifkan';
        btn.className     = 'px-3 py-1 rounded-lg text-xs font-bold border transition-all border-qi-purple/40 text-qi-purple hover:bg-qi-purple/10';
        stopAiPoll();
    }
}

async function toggleAiAutoTrade() {
    const tok = localStorage.getItem('qi_session');
    if (!tok) { showQuantumToast('Login diperlukan', 'error'); return; }
    const lots = parseFloat(document.getElementById('aiLotsSelect')?.value || '0.10');
    const body = aiEnabled
        ? { action: 'disable' }
        : { action: 'enable', symbols: aiSelectedSyms, lots };
    try {
        const res  = await fetch('api/ai-auto-trade.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
            body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.status === 'success' || json.status === 'skip') {
            aiEnabled = !aiEnabled;
            updateAiStatusUI();
            showQuantumToast(json.message, aiEnabled ? 'success' : 'info');
            if (aiEnabled) refreshAiSignals();
        } else {
            showQuantumToast(json.message || 'Gagal mengubah setting AI', 'error');
        }
    } catch(e) {
        showQuantumToast('Koneksi error', 'error');
    }
}

/**
 * Penanda status pencatatan analisa AI ke RIWAYAT SINYAL (dari server, apa adanya).
 *
 * KENAPA: pengguna ingin tahu bahwa "AI menganalisa → hasilnya masuk track record".
 * Endpoint api/ai-signal.php mengembalikan `dicatat` + `catatan_rekor`. Bila AI
 * memutuskan tunggu/sideway, memang TIDAK ada rekor — itu disebut jujur di sini,
 * supaya tidak terlihat seperti rekor yang hilang.
 */
function aiStatusRekor(d) {
    if (!d) return '';
    if (d.dicatat === true) {
        const id = d.id_sinyal ? String(d.id_sinyal) : '';
        return '<div class="text-[9px] text-qi-green mt-1.5">✅ Tercatat di Riwayat Sinyal'
            + (id ? ' (' + id + ')' : '')
            + ' — lihat panel Track Record.</div>';
    }
    const sebab = (d.catatan_rekor || 'AI belum memberi keputusan ENTRY (BUY/SELL), jadi belum ada yang dicatat.');
    return '<div class="text-[9px] text-slate-500 mt-1.5">ℹ️ Belum masuk Riwayat Sinyal: ' + String(sebab).replace(/[<>&]/g, '') + '</div>';
}

async function refreshAiSignals() {
    const tok = localStorage.getItem('qi_session');
    if (!tok) return;
    const wrap = document.getElementById('aiSignalCards');
    if (!wrap) return;
    wrap.innerHTML = '<div class="col-span-2 text-[11px] text-slate-600 text-center py-6 animate-pulse">AI sedang menganalisa pasar…</div>';

    const toAnalyze = aiSelectedSyms.length ? aiSelectedSyms : ['BTCUSDT','XAUUSD'];
    const results = await Promise.allSettled(
        toAnalyze.map(sym =>
            fetch('api/ai-signal.php?symbol=' + sym, { headers: { 'Authorization': 'Bearer ' + tok } })
                .then(r => r.json())
        )
    );

    const cards = [];
    results.forEach((r, i) => {
        const sym = toAnalyze[i];
        if (r.status !== 'fulfilled' || r.value.status !== 'success') {
            cards.push(`<div class="bg-qi-surface border border-qi-border rounded-xl p-3"><div class="text-[11px] text-slate-600 font-mono">${sym}</div><div class="text-[10px] text-red-500 mt-1">Gagal memuat sinyal</div></div>`);
            return;
        }
        const d = r.value;
        aiSignalData[sym] = d;
        const actionCls = d.action === 'ENTRY_BUY' ? 'text-qi-green' : d.action === 'ENTRY_SELL' ? 'text-qi-red' : 'text-slate-400';
        const actionLabel = d.action === 'ENTRY_BUY' ? '▲ BUY' : d.action === 'ENTRY_SELL' ? '▼ SELL' : '◆ SKIP';
        const confBar = `<div class="w-full bg-qi-border rounded-full h-1 mt-2"><div class="h-1 rounded-full ${d.action !== 'SKIP' ? 'bg-qi-cyan' : 'bg-slate-600'}" style="width:${d.confidence}%"></div></div>`;
        const execBtn = d.action !== 'SKIP'
            ? `<button data-qi-aksi="executeAiTrade" data-qi-arg="${QIAksi.arg(sym)}" class="mt-2 w-full py-1.5 rounded-lg text-[10px] font-bold border ${d.action==='ENTRY_BUY'?'border-qi-green/40 text-qi-green hover:bg-qi-green/10':'border-qi-red/40 text-qi-red hover:bg-qi-red/10'} transition-colors">Eksekusi Manual</button>`
            : '';
        cards.push(`
            <div class="bg-qi-surface border border-qi-border rounded-xl p-3">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-[11px] text-white font-mono font-bold">${sym}</span>
                    <span class="text-[10px] font-mono text-slate-400">${d.price > 0 ? d.price.toLocaleString() : '—'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-bold ${actionCls}">${actionLabel}</span>
                    <span class="text-[10px] text-slate-500">${d.confidence}% conf</span>
                </div>
                ${confBar}
                ${d.reason ? `<div class="text-[10px] text-slate-500 mt-1.5 leading-snug">${d.reason}</div>` : ''}
                ${d.tp > 0 ? `<div class="text-[10px] text-slate-600 mt-1 font-mono">TP: ${d.tp} · SL: ${d.sl} · RR: ${d.risk_reward}x</div>` : ''}
                ${execBtn}
                ${d.from_cache ? '<div class="text-[9px] text-slate-700 mt-1">dari cache</div>' : ''}
                ${aiStatusRekor(d)}
            </div>`);
    });

    wrap.innerHTML = cards.join('') || '<div class="col-span-2 text-[11px] text-slate-600 text-center py-4">Tidak ada sinyal</div>';
    loadAiStatus();
}

async function executeAiTrade(sym) {
    const tok = localStorage.getItem('qi_session');
    if (!tok) { showQuantumToast('Login diperlukan', 'error'); return; }
    const sig = aiSignalData[sym];
    if (!sig) { showQuantumToast('Sinyal belum tersedia', 'error'); return; }
    try {
        const res  = await fetch('api/ai-auto-trade.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
            body: JSON.stringify({ action: 'execute', symbol: sym, signal: sig }),
        });
        const json = await res.json();
        const t = json.status === 'success' ? 'success' : (json.status === 'skip' ? 'info' : 'error');
        showQuantumToast(json.message, t);
        if (json.status === 'success') loadAiStatus();
    } catch(e) {
        showQuantumToast('Koneksi error', 'error');
    }
}

async function closeAiPosition(posId, closePrice) {
    const tok = localStorage.getItem('qi_session');
    if (!tok) return;
    try {
        const res  = await fetch('api/ai-auto-trade.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
            body: JSON.stringify({ action: 'close', position_id: posId, close_price: closePrice }),
        });
        const json = await res.json();
        showQuantumToast(json.message, json.status === 'success' ? 'success' : 'error');
        if (json.status === 'success') loadAiStatus();
    } catch(e) {}
}

function renderAiOpenPositions(positions) {
    const wrap = document.getElementById('aiOpenPositions');
    const cnt  = document.getElementById('aiOpenCount');
    if (!wrap) return;
    if (cnt) cnt.textContent = positions.length;
    if (!positions.length) {
        wrap.innerHTML = '<div class="text-[11px] text-slate-600 text-center py-4">Belum ada posisi terbuka</div>';
        return;
    }
    wrap.innerHTML = positions.map(p => {
        const dirCls = p.direction === 'BUY' ? 'text-qi-green' : 'text-qi-red';
        return `<div class="px-4 py-3 flex items-center justify-between gap-2">
            <div>
                <div class="text-[11px] text-white font-mono font-bold">${p.symbol} <span class="${dirCls}">${p.direction}</span></div>
                <div class="text-[10px] text-slate-500 font-mono">Entry: ${parseFloat(p.entry_price||0).toLocaleString()} · Lots: ${p.lots}</div>
                ${p.take_profit ? `<div class="text-[10px] text-slate-600 font-mono">TP: ${p.take_profit} · SL: ${p.stop_loss}</div>` : ''}
            </div>
            <button data-qi-aksi="closeAiPosition" data-qi-arg="${QIAksi.arg(Number(p.id), 0)}"
                class="shrink-0 text-[10px] border border-slate-700 text-slate-400 hover:border-red-500/40 hover:text-red-400 rounded px-2 py-1 transition-colors">
                Tutup
            </button>
        </div>`;
    }).join('');
}

function renderAiTradeLog(log) {
    const wrap = document.getElementById('aiTradeLog');
    if (!wrap) return;
    const trades = log.filter(l => l.executed);
    if (!trades.length) {
        wrap.innerHTML = '<div class="text-[11px] text-slate-600 text-center py-4">Belum ada riwayat</div>';
        return;
    }
    wrap.innerHTML = trades.slice(0, 20).map(l => {
        const actCls = l.action === 'ENTRY_BUY' ? 'text-qi-green' : l.action === 'ENTRY_SELL' ? 'text-qi-red' : 'text-slate-400';
        const pnl    = parseFloat(l.pos_pnl || 0);
        const pnlStr = l.pos_pnl != null ? (pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : '';
        const pnlCls = pnl >= 0 ? 'text-qi-green' : 'text-qi-red';
        return `<div class="px-4 py-2.5 flex items-center gap-3">
            <span class="${actCls} text-[11px] font-mono font-bold w-20 shrink-0">${l.action.replace('ENTRY_','')||'SKIP'}</span>
            <div class="flex-1 min-w-0">
                <div class="text-[11px] text-white font-mono">${l.symbol}</div>
                <div class="text-[10px] text-slate-500 truncate">${l.reason || ''}</div>
            </div>
            ${pnlStr ? `<span class="text-[11px] font-mono font-bold ${pnlCls} shrink-0">${pnlStr}</span>` : ''}
            <span class="text-[9px] text-slate-600 shrink-0">${(l.created_at||'').substring(11,16)}</span>
        </div>`;
    }).join('');
}

function updateAiStats(log) {
    const trades = log.filter(l => l.executed && l.pos_status === 'closed' && l.pos_pnl != null);
    const wins   = trades.filter(l => parseFloat(l.pos_pnl) > 0);
    const totalPnl = trades.reduce((s, l) => s + parseFloat(l.pos_pnl || 0), 0);
    const elT = document.getElementById('aiStatTrades');
    const elW = document.getElementById('aiStatWin');
    const elP = document.getElementById('aiStatPnl');
    if (elT) elT.textContent = log.filter(l => l.executed).length;
    if (elW) {
        elW.textContent = trades.length ? Math.round(wins.length/trades.length*100) + '%' : '—';
        elW.className = 'text-xl font-heading font-bold ' + (wins.length >= trades.length/2 ? 'text-qi-green' : 'text-qi-red');
    }
    if (elP) {
        elP.textContent = trades.length ? (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2) : '—';
        elP.className = 'text-xl font-heading font-bold ' + (totalPnl >= 0 ? 'text-qi-green' : 'text-qi-red');
    }
}

function startAiPoll() {
    if (aiPollTimer) return;
    aiPollTimer = setInterval(function() {
        if (document.getElementById('panel-ai-trade') && !document.getElementById('panel-ai-trade').classList.contains('hidden')) {
            loadAiStatus();
        }
    }, 60000); // refresh tiap 1 menit jika panel aktif
}

function stopAiPoll() {
    if (aiPollTimer) { clearInterval(aiPollTimer); aiPollTimer = null; }
}

// Init saat panel dibuka
document.addEventListener('DOMContentLoaded', function() {
    const origSwitch = window.switchPanel;
    if (typeof origSwitch === 'function') {
        window.switchPanel = function(panelId) {
            origSwitch(panelId);
            if (panelId === 'panel-ai-trade') initAiPanel();
        };
    }
});

