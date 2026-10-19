// Skrip halaman Status (status.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
const ENDPOINTS = [
    { name: 'Platform Health',    url: 'api/health.php',                                key: null,       expect: 'health' },
    { name: 'Live Price',         url: 'api/live-price.php?symbols=BTCUSDT',           key: 'status',  expect: 'success' },
    { name: 'Chart Data',         url: 'api/get-chart-data.php?symbol=BTCUSDT&interval=60', key: 'status', expect: 'success' },
    { name: 'Signals Engine',     url: 'api/signals.php?symbol=BTCUSDT&timeframe=D',    key: 'status',  expect: 'success' },
    { name: 'Currency Strength',  url: 'api/currency-strength.php',                     key: 'status',  expect: v => v === 'success' || v === 'degraded' },
    { name: 'Economic Calendar',  url: 'api/calendar.php',                              key: 'status',  expect: 'success' },
    { name: 'AI Assistant (Groq)',url: 'api/ai-chat.php?ping=1',                        key: 'status',  expect: 'ok' },
];

function renderRow(ep, state) {
    const dotClass = state === 'ok' ? 'ok' : state === 'warn' ? 'warn' : state === 'error' ? 'error' : 'pending';
    const label    = state === 'ok' ? 'Operational' : state === 'warn' ? 'Degraded' : state === 'error' ? 'Down' : 'Checking...';
    const labelClr = state === 'ok' ? 'text-emerald-400' : state === 'warn' ? 'text-amber-400' : state === 'error' ? 'text-rose-400' : 'text-slate-500';
    return `<div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div class="flex items-center gap-3">
            <span class="status-dot ${dotClass}"></span>
            <span class="text-sm text-white font-medium">${ep.name}</span>
        </div>
        <span class="font-mono text-xs ${labelClr}">${label}</span>
    </div>`;
}

async function checkOne(ep) {
    try {
        const opts = { cache: 'no-store', signal: AbortSignal.timeout(8000) };
        const res = await fetch(ep.url, opts);
        if (ep.expect === 'health') {
            // health.php answers 503 while it is merely degraded (e.g. an
            // optional API key missing). res.ok would be false there, so
            // read the body regardless of the status code — otherwise a
            // degraded-but-serving platform would be reported as "Down".
            let data = null;
            try { data = await res.json(); } catch (e) {}
            if (!data || !data.status) return 'error';
            if (data.status === 'ok' || data.status === 'healthy') return 'ok';
            if (data.status === 'degraded') return 'warn';
            return 'error';
        } else if (ep.key && typeof ep.expect === 'string') {
            if (res.ok) { const data = await res.json(); return data[ep.key] === ep.expect ? 'ok' : 'warn'; }
        } else if (ep.key && typeof ep.expect === 'function') {
            if (res.ok) { const data = await res.json(); return ep.expect(data[ep.key]) ? 'ok' : 'warn'; }
        }
    } catch(e) {}
    return 'error';
}

async function checkAll() {
    const list = document.getElementById('statusList');
    list.innerHTML = ENDPOINTS.map(ep => renderRow(ep, 'pending')).join('');

    const results = await Promise.all(ENDPOINTS.map(async (ep, i) => {
        const state = await checkOne(ep);
        const rows = list.querySelectorAll(':scope > div');
        if (rows[i]) rows[i].outerHTML = renderRow(ep, state);
        return state;
    }));

    // Global badge
    const badge = document.getElementById('globalBadge');
    const allOk   = results.every(s => s === 'ok');
    const hasError = results.some(s => s === 'error');
    if (allOk) {
        badge.textContent = 'All Systems Operational';
        badge.className = 'font-mono text-xs px-3 py-1.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
    } else if (hasError) {
        badge.textContent = 'Partial Outage';
        badge.className = 'font-mono text-xs px-3 py-1.5 rounded-full border border-rose-500/40 text-rose-400 bg-rose-500/10';
    } else {
        badge.textContent = 'Degraded Performance';
        badge.className = 'font-mono text-xs px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-400 bg-amber-500/10';
    }

    document.getElementById('lastCheck').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
}

checkAll();
let _nextCheck = 60;
setInterval(() => {
    _nextCheck--;
    const el = document.getElementById('nextCheckCountdown');
    if (el) el.textContent = _nextCheck > 0 ? `refresh ${_nextCheck}s` : 'checking…';
    if (_nextCheck <= 0) { checkAll(); _nextCheck = 60; }
}, 1000);

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline').
document.getElementById('btnCekSekarang').addEventListener('click', () => checkAll());
