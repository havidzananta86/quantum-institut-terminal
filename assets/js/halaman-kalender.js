// Skrip kalender ekonomi (economic-calendar.html) — dulu dua <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
// ─── State ─────────────────────────────────────────────────────────────────
let _allEvents   = [];
let _filterImpact   = 'all';
let _filterCurrency = 'ALL';
let _cdInterval  = null;
let _nextHighEvent = null;
let _lastFetch   = null;

const DAYS_ID  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const IMPACT_LABELS = { high:'Tinggi', medium:'Sedang', low:'Rendah', holiday:'Libur' };

// ─── Fetch ──────────────────────────────────────────────────────────────────
async function fetchCalendar(silent = false) {
    if (!silent) {
        const btn = document.getElementById('refreshIcon');
        if (btn) btn.textContent = '⟳';
    }
    try {
        const res  = await fetch('api/calendar.php');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        _allEvents = data.events || data.data || [];
        _lastFetch = Date.now();
        findNextHighEvent();
        renderCalendar();
        updateUpdatedAgo();
    } catch(e) {
        if (!_allEvents.length) {
            document.getElementById('calendarContent').innerHTML =
                `<div class="text-center text-slate-600 py-12 text-sm">Gagal memuat kalender. <button type="button" data-kal-aksi="muat-ulang" class="text-qi-cyan underline">Coba lagi</button></div>`;
        }
    } finally {
        const btn = document.getElementById('refreshIcon');
        if (btn) btn.textContent = '↻';
    }
}

function refreshCalendar() { fetchCalendar(false); }

// ─── Filters ────────────────────────────────────────────────────────────────
function setImpact(val) {
    _filterImpact = val;
    document.querySelectorAll('[id^="chip-"]').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('chip-' + val);
    if (el) el.classList.add('active');
    renderCalendar();
}

function setCurrency(val) {
    _filterCurrency = val;
    renderCalendar();
}

function filteredEvents() {
    return _allEvents.filter(e => {
        const imp = (e.impact || '').toLowerCase();
        if (_filterImpact !== 'all' && imp !== _filterImpact) return false;
        if (_filterCurrency !== 'ALL') {
            const cur = (e.currency || e.country || '').toUpperCase();
            if (cur !== _filterCurrency) return false;
        }
        return true;
    });
}

// ─── Countdown ──────────────────────────────────────────────────────────────
function findNextHighEvent() {
    const now = Date.now();
    const upcoming = _allEvents
        .filter(e => (e.impact||'').toLowerCase() === 'high' && new Date(e.date).getTime() > now)
        .sort((a,b) => new Date(a.date) - new Date(b.date));
    _nextHighEvent = upcoming[0] || null;

    const banner = document.getElementById('countdownBanner');
    if (!_nextHighEvent) {
        if (banner) banner.classList.add('hidden');
        clearInterval(_cdInterval);
        return;
    }
    if (banner) banner.classList.remove('hidden');
    updateCountdown();
    clearInterval(_cdInterval);
    _cdInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    if (!_nextHighEvent) return;
    const ev   = _nextHighEvent;
    const diff = new Date(ev.date).getTime() - Date.now();
    if (diff <= 0) { findNextHighEvent(); return; }

    const h  = Math.floor(diff / 3600000);
    const m  = Math.floor((diff % 3600000) / 60000);
    const s  = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2,'0');

    const el = document.getElementById('cdTimer');
    if (el) el.textContent = h >= 24
        ? `${Math.floor(h/24)}d ${pad(h%24)}:${pad(m)}:${pad(s)}`
        : `${pad(h)}:${pad(m)}:${pad(s)}`;

    const title = document.getElementById('cdEventTitle');
    const cur   = document.getElementById('cdEventCur');
    const time  = document.getElementById('cdEventLocalTime');
    if (title) title.textContent = ev.title || '—';
    if (cur)   cur.textContent   = (CUR_FLAGS[ev.currency] || '') + ' ' + (ev.currency || ev.country || '');
    if (time)  time.textContent  = localTimeStr(ev.date);
}

// ─── Render ─────────────────────────────────────────────────────────────────
function localTimeStr(isoDate) {
    const d = new Date(isoDate);
    if (isNaN(d)) return isoDate || '—';
    return d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', timeZoneName:'short' });
}

function localDateKey(isoDate) {
    const d = new Date(isoDate);
    if (isNaN(d)) return '1970-01-01';
    return d.toLocaleDateString('sv-SE');
}

function localDateLabel(dateKey) {
    const d = new Date(dateKey);
    const today = new Date(); today.setHours(0,0,0,0);
    const dt    = new Date(d); dt.setHours(0,0,0,0);
    const diff  = Math.round((dt - today) / 86400000);
    const dow   = DAYS_ID[d.getDay()];
    const mon   = MONTHS_SHORT[d.getMonth()];
    const label = diff === 0 ? 'Hari Ini' : diff === 1 ? 'Besok' : diff === -1 ? 'Kemarin' : '';
    return `${dow}, ${d.getDate()} ${mon} ${d.getFullYear()}${label ? ' — ' + label : ''}`;
}

function impactPill(impact) {
    const cls = { high:'pill-high', medium:'pill-medium', low:'pill-low', holiday:'pill-holiday' };
    const dot = { high:'bg-qi-red', medium:'bg-qi-gold', low:'bg-qi-green', holiday:'bg-slate-600' };
    const lbl = IMPACT_LABELS[impact] || impact || '—';
    const c   = cls[impact] || 'pill-holiday';
    const d   = dot[impact] || 'bg-slate-600';
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c}">
        <span class="w-1.5 h-1.5 rounded-full ${d}"></span>${lbl}
    </span>`;
}

function valueCell(val) {
    if (!val || val === '-' || val === '') return '<span class="text-slate-700">—</span>';
    return `<span class="text-slate-300">${val}</span>`;
}

function actualCell(actual, forecast) {
    if (!actual || actual === '-' || actual === '') return '<span class="text-slate-700">—</span>';
    const tryNum = (s) => parseFloat((s||'').replace(/[^0-9.\-]/g,''));
    const a = tryNum(actual), f = tryNum(forecast);
    let cls = 'text-slate-300';
    if (!isNaN(a) && !isNaN(f)) {
        cls = a > f ? 'text-qi-green font-semibold' : a < f ? 'text-qi-red font-semibold' : 'text-slate-300';
    }
    return `<span class="${cls}">${actual}</span>`;
}

function renderCalendar() {
    const events = filteredEvents();
    const now    = Date.now();
    const content = document.getElementById('calendarContent');
    const countEl = document.getElementById('eventCount');
    if (countEl) countEl.textContent = `${events.length} event`;

    if (!events.length) {
        content.innerHTML = `<div class="text-center text-slate-600 py-16 text-sm">
            Tidak ada event untuk filter ini.<br>
            <button type="button" data-kal-aksi="reset-filter" class="mt-3 text-qi-cyan text-[11px] underline">Reset filter</button>
        </div>`;
        return;
    }

    // Group by local date
    const grouped = {};
    events.forEach(e => {
        const key = localDateKey(e.date);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    });

    const sortedDates = Object.keys(grouped).sort();
    let html = '';

    sortedDates.forEach(dateKey => {
        const dayEvents = grouped[dateKey];
        const dateLabel = localDateLabel(dateKey);
        const isToday   = dateKey === new Date().toLocaleDateString('sv-SE');

        html += `<div class="rounded-xl overflow-hidden border ${isToday ? 'border-qi-cyan/20' : 'border-qi-border'}">
            <div class="date-header px-4 py-2 flex items-center gap-2 ${isToday ? 'bg-qi-cyan/5 border-b border-qi-cyan/20' : 'bg-qi-panel border-b border-qi-border'}">
                <span class="text-sm font-heading font-bold ${isToday ? 'text-qi-cyan' : 'text-white'}">${dateLabel}</span>
                ${isToday ? '<span class="text-[9px] font-semibold bg-qi-cyan/15 text-qi-cyan border border-qi-cyan/25 rounded px-1.5 py-0.5">HARI INI</span>' : ''}
                <span class="ml-auto text-[10px] text-slate-600">${dayEvents.length} event</span>
            </div>
            <table class="w-full text-xs font-mono">
                <thead>
                    <tr class="text-[10px] text-slate-600 uppercase border-b border-qi-border">
                        <th class="px-3 py-1.5 text-left">Waktu</th>
                        <th class="px-2 py-1.5 text-left hidden sm:table-cell">Mata Uang</th>
                        <th class="px-3 py-1.5 text-left">Event</th>
                        <th class="px-2 py-1.5 text-center">Impact</th>
                        <th class="px-2 py-1.5 text-right hidden md:table-cell">Forecast</th>
                        <th class="px-2 py-1.5 text-right hidden md:table-cell">Previous</th>
                        <th class="px-2 py-1.5 text-right hidden lg:table-cell">Actual</th>
                    </tr>
                </thead>
                <tbody>`;

        dayEvents
            .sort((a,b) => new Date(a.date) - new Date(b.date))
            .forEach(ev => {
                const evTime  = new Date(ev.date).getTime();
                const isPast  = evTime < now;
                const isNext  = _nextHighEvent && ev.id === _nextHighEvent.id;
                const cur     = (ev.currency || ev.country || '—').toUpperCase();
                const rowCls  = `ev-row border-b border-qi-border/50 ${isPast ? 'past' : ''} ${isNext ? 'upcoming bg-qi-red/5' : ''}`;
                const hasActual = ev.actual && ev.actual !== '-';

                html += `<tr class="${rowCls}">
                    <td class="px-3 py-2.5 text-slate-400 whitespace-nowrap">${localTimeStr(ev.date)}</td>
                    <td class="px-2 py-2.5 hidden sm:table-cell">
                        <span class="text-[11px] font-semibold text-slate-300">${cur}</span>
                    </td>
                    <td class="px-3 py-2.5 text-white max-w-[180px] sm:max-w-none">
                        <div class="truncate font-semibold text-[11px]">${ev.title || '—'}</div>
                        <div class="text-[10px] text-slate-600 sm:hidden">${cur}</div>
                    </td>
                    <td class="px-2 py-2.5 text-center">${impactPill((ev.impact||'').toLowerCase())}</td>
                    <td class="px-2 py-2.5 text-right hidden md:table-cell text-slate-400">${valueCell(ev.forecast)}</td>
                    <td class="px-2 py-2.5 text-right hidden md:table-cell text-slate-400">${valueCell(ev.previous)}</td>
                    <td class="px-2 py-2.5 text-right hidden lg:table-cell ${hasActual ? 'font-bold' : ''}">${actualCell(ev.actual, ev.forecast)}</td>
                </tr>`;
            });

        html += `</tbody></table></div>`;
    });

    content.innerHTML = html;
}

// ─── Updated ago ────────────────────────────────────────────────────────────
function updateUpdatedAgo() {
    if (!_lastFetch) return;
    const sec = Math.floor((Date.now() - _lastFetch) / 1000);
    const el  = document.getElementById('updatedAgo');
    if (el) el.textContent = sec < 60 ? `${sec}d lalu` : `${Math.floor(sec/60)}m lalu`;
}

// ─── Sidebar toggle ─────────────────────────────────────────────────────────
function toggleSidebar() {
    const sb  = document.getElementById('sidebar');
    const ovl = document.getElementById('sidebarOverlay');
    const open = sb.classList.toggle('open');
    ovl.classList.toggle('hidden', !open);
}

// ─── User ───────────────────────────────────────────────────────────────────
function loadUserInfo() {
    try {
        const name = localStorage.getItem('qi_user_name') || sessionStorage.getItem('qi_user_name');
        const el   = document.getElementById('sidebarUser');
        if (el) el.textContent = name || 'Guest';
    } catch(e) {}
}

// ─── Init ───────────────────────────────────────────────────────────────────
loadUserInfo();
fetchCalendar();
setInterval(() => fetchCalendar(true), 300000); // refresh every 5 min
setInterval(updateUpdatedAgo, 10000);

(function(){
    var isPro = false;
    try {
        var raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        var u = raw ? JSON.parse(raw) : null;
        isPro = u && ['pro', 'vip', 'admin'].indexOf(String(u.role || '').toLowerCase()) !== -1;
    } catch(e){}

    if (isPro) return;

    var lockStyle = function(el, label) {
        el.href = 'pricing.html';
        el.title = 'Quantum+ PRO Required';
        el.insertAdjacentHTML('beforeend', ' <span class="ml-auto text-[9px] border border-qi-border rounded px-1">PRO</span>');
        el.style.opacity = '0.55';
    };

    var d1 = document.getElementById('ecSidebarDash1');
    var d2 = document.getElementById('ecSidebarDash2');
    var dh = document.getElementById('ecHeaderDash');
    if (d1) lockStyle(d1, 'Market Overview');
    if (d2) lockStyle(d2, 'Currency Strength');
    if (dh) { dh.href = 'pricing.html'; dh.textContent = 'PRO →'; dh.style.opacity = '0.6'; }
})();

// Pengganti atribut onclick/onchange="..." (dilarang CSP tanpa 'unsafe-inline'), termasuk tombol yang
// dibuat ulang lewat innerHTML ("Coba lagi", "Reset filter") — karena itu memakai delegasi di document.
document.addEventListener('click', e => {
    const impact = e.target.closest('[data-impact]');
    if (impact) { setImpact(impact.dataset.impact); return; }
    const el = e.target.closest('[data-kal-aksi]');
    if (!el) return;
    const aksi = el.dataset.kalAksi;
    if (aksi === 'sidebar') toggleSidebar();
    else if (aksi === 'refresh') refreshCalendar();
    else if (aksi === 'muat-ulang') fetchCalendar();
    else if (aksi === 'reset-filter') { setImpact('all'); document.getElementById('currencyFilter').value = 'ALL'; setCurrency('ALL'); }
});
document.getElementById('currencyFilter').addEventListener('change', e => setCurrency(e.target.value));
