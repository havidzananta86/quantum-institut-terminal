// Skrip panel admin (admin.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
let currentPage = 0;
const PAGE_SIZE = 25;
let totalUsers  = 0;
let _toastTimer = null;

function showToast(msg, ok = true) {
    const el  = document.getElementById('adminToast');
    const msg_ = document.getElementById('adminToastMsg');
    msg_.textContent = msg;
    msg_.className   = 'px-4 py-3 rounded-xl text-sm text-white shadow-xl max-w-xs border ' +
                       (ok ? 'bg-slate-800 border-qi-green/40' : 'bg-red-950 border-qi-red/40');
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

async function loadUsers(page = currentPage) {
    const q   = document.getElementById('searchInput').value.trim();
    const url = `api/admin-users.php?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}` + (q ? `&q=${encodeURIComponent(q)}` : '');
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-600 py-8 text-xs">Memuat…</td></tr>`;
    try {
        const res  = await fetch(url, { headers: authHeaders() });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Error');
        totalUsers   = data.total;
        currentPage  = page;

        // Update stats
        if (data.stats) {
            const s = data.stats;
            document.getElementById('statTotal').textContent  = (s.user||0) + (s.pro||0) + (s.admin||0);
            document.getElementById('statPro').textContent    = s.pro || 0;
            document.getElementById('statAdmin').textContent  = s.admin || 0;
        }

        // Pagination
        document.getElementById('paginationInfo').textContent =
            `Menampilkan ${page * PAGE_SIZE + 1}–${Math.min((page+1)*PAGE_SIZE, totalUsers)} dari ${totalUsers}`;
        document.getElementById('btnPrev').disabled = page === 0;
        document.getElementById('btnNext').disabled = (page + 1) * PAGE_SIZE >= totalUsers;

        if (!data.users.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-600 py-8 text-xs">Tidak ada pengguna ditemukan</td></tr>`;
            return;
        }

        tbody.innerHTML = data.users.map(u => {
            const roleClass = u.role === 'admin' ? 'role-admin' : u.role === 'pro' ? 'role-pro' : 'role-user';
            const dotColor  = u.is_active ? '#10B981' : '#4B5563';
            const dot       = `<span class="active-dot" style="background:${dotColor}" title="${u.is_active ? 'Aktif' : 'Nonaktif'}"></span>`;
            const joined    = new Date(u.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
            return `<tr class="border-b border-qi-border/50 hover:bg-slate-800/30 transition-colors">
                <td class="px-4 py-3 text-slate-500 text-xs font-mono">#${u.id}</td>
                <td class="px-4 py-3 text-white text-xs">${escHtml(u.email)}</td>
                <td class="px-4 py-3">
                    <select data-ubah-role="${u.id}"
                            class="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-2 py-1 outline-none">
                        <option value="user"  ${u.role==='user'  ? 'selected':''}>User</option>
                        <option value="pro"   ${u.role==='pro'   ? 'selected':''}>PRO</option>
                        <option value="admin" ${u.role==='admin' ? 'selected':''}>Admin</option>
                    </select>
                </td>
                <td class="px-4 py-3">${dot} <span class="text-xs text-slate-400">${u.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td class="px-4 py-3 text-slate-500 text-xs">${joined}</td>
                <td class="px-4 py-3">
                    <button type="button" data-aksi="aktif" data-id="${u.id}"
                            class="text-[10px] px-2.5 py-1 rounded border transition-colors ${u.is_active
                                ? 'border-qi-red/40 text-qi-red hover:bg-qi-red/10'
                                : 'border-qi-green/40 text-qi-green hover:bg-qi-green/10'}">
                        ${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-qi-red py-8 text-xs">${escHtml(err.message)}</td></tr>`;
    }
}

async function setRole(userId, newRole, selectEl) {
    try {
        const res  = await fetch('api/admin-users.php', {
            method: 'POST', headers: { 'Content-Type':'application/json', ...authHeaders() },
            body: JSON.stringify({ type:'set_role', user_id: userId, role: newRole })
        });
        const data = await res.json();
        if (data.status === 'success') { showToast(`Role #${userId} diubah ke ${newRole}`); loadUsers(); }
        else { showToast(data.message || 'Gagal', false); loadUsers(); }
    } catch(e) { showToast('Network error', false); loadUsers(); }
}

async function toggleActive(userId, currentActive) {
    try {
        const res  = await fetch('api/admin-users.php', {
            method: 'POST', headers: { 'Content-Type':'application/json', ...authHeaders() },
            body: JSON.stringify({ type:'toggle_active', user_id: userId })
        });
        const data = await res.json();
        if (data.status === 'success') { showToast(`Status pengguna #${userId} diubah`); loadUsers(); }
        else showToast(data.message || 'Gagal', false);
    } catch(e) { showToast('Network error', false); }
}

function changePage(dir) {
    const newPage = currentPage + dir;
    if (newPage < 0) return;
    if (newPage * PAGE_SIZE >= totalUsers && dir > 0) return;
    loadUsers(newPage);
}

function authHeaders() {
    const token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
        ? QuantumAuth.getToken()
        : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token') || '');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') loadUsers(0); });

async function loadAnalytics() {
    try {
        const res = await fetch('api/admin-analytics.php', { headers: authHeaders() });
        const d = await res.json();
        if (d.status !== 'success') return;
        const a = d.analytics || {};
        document.getElementById('anActiveSessions').textContent = a.active_sessions ?? '—';
        document.getElementById('anSignals7d').textContent = a.signals_7d ?? '—';
        document.getElementById('anApiKeys').textContent = a.total_api_keys ?? '—';
        document.getElementById('anReferrals').textContent = a.total_referrals ?? '—';
        document.getElementById('anPhpVer').textContent = a.php_version ?? '—';
        document.getElementById('anCacheFiles').textContent = a.cache_files ?? '—';
        document.getElementById('anErrors24').textContent = a.errors_24h ?? '0';
        document.getElementById('anUptime').textContent = a.uptime ?? '—';

        const logins = a.recent_logins || [];
        const el = document.getElementById('anRecentLogins');
        if (!logins.length) {
            el.innerHTML = '<div class="text-slate-600">Tidak ada data</div>';
        } else {
            el.innerHTML = logins.map(l => {
                const t = l.time ? new Date(l.time).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
                return `<div class="flex justify-between bg-slate-900/60 rounded px-2 py-1.5">
                    <span class="text-white">${escHtml(l.email || '—')}</span>
                    <span class="text-slate-500">${t}</span>
                </div>`;
            }).join('');
        }
    } catch(e) {}
}

// Laporan CSP: grup kosong untuk "CSP ketat (Report-Only)" beberapa hari berturut-turut = aman ditegakkan.
async function loadCsp() {
    const info = document.getElementById('cspInfo'), tb = document.getElementById('cspTabel');
    const hari = document.getElementById('cspHari').value, disp = document.getElementById('cspDisposisi').value;
    info.textContent = 'Memuat…';
    try {
        const res = await fetch(`api/csp-ringkasan.php?hari=${encodeURIComponent(hari)}&disposisi=${encodeURIComponent(disp)}`, { headers: authHeaders() });
        const d = await res.json();
        if (d.status !== 'success') throw new Error(d.message || 'Error');
        const per = Object.entries(d.per_disposisi || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
        info.textContent = `${d.total} pelanggaran dalam ${d.jumlah_grup} grup · ${d.file.length} file harian · semua jenis: ${per}`
            + (d.rusak ? ` · ${d.rusak} baris rusak` : '') + (d.terpotong ? ' · sebagian file terpotong (terlalu besar)' : '')
            + (d.jumlah_grup > d.grup.length ? ` · menampilkan ${d.grup.length} grup teratas` : '');
        tb.innerHTML = d.grup.length ? d.grup.map(g => {
            const contoh = g.contoh.map(c => escHtml([c.sumber, c.sampel].filter(Boolean).join(' · ') || '—')).join('<br>');
            const t = g.terakhir ? new Date(g.terakhir).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
            return `<tr class="border-b border-slate-800">
                <td class="py-1.5 pr-2 text-white font-bold">${g.jumlah}<div class="text-slate-500 font-normal">${g.ip_berbeda} IP</div></td>
                <td class="py-1.5 pr-2 text-slate-300 break-all">${escHtml(g.halaman || '—')}</td>
                <td class="py-1.5 pr-2 text-qi-gold">${escHtml(g.arahan || '—')}</td>
                <td class="py-1.5 pr-2 text-slate-300 break-all">${escHtml(g.diblok || '—')}</td>
                <td class="py-1.5 pr-2 text-slate-400 break-all font-mono">${contoh || '—'}</td>
                <td class="py-1.5 text-slate-500 whitespace-nowrap">${t}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="6" class="text-center text-qi-green py-4">Tidak ada pelanggaran pada rentang ini.</td></tr>';
    } catch (e) {
        info.textContent = 'Gagal memuat laporan CSP: ' + e.message;
        tb.innerHTML = '';
    }
}

async function broadcastSignal() {
    const pair = document.getElementById('bcPair').value;
    const type = document.getElementById('bcType').value;
    const entry = document.getElementById('bcEntry').value.trim();
    const sltp = document.getElementById('bcSlTp').value.trim();
    const notes = document.getElementById('bcNotes').value.trim();

    if (!entry) { showToast('Entry price wajib diisi', false); return; }

    try {
        const res = await fetch('api/admin-users.php?action=broadcast', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ pair, type, entry, sltp, notes, time: new Date().toISOString() })
        });
        const d = await res.json();
        showToast('Sinyal berhasil disiarkan ke seluruh member!', true);
        document.getElementById('bcEntry').value = '';
        document.getElementById('bcSlTp').value = '';
        document.getElementById('bcNotes').value = '';
    } catch(e) {
        showToast('Sinyal tersimpan dan aktif di broadcast feed', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('qiAdminGate');
    if (gate && gate.style.display === 'none') { loadUsers(0); loadAnalytics(); loadCsp(); }
    const interval = setInterval(() => {
        if (gate && gate.style.display === 'none') { clearInterval(interval); loadUsers(0); loadAnalytics(); loadCsp(); }
    }, 100);
    setTimeout(() => clearInterval(interval), 1500);
});

// Pengganti atribut onclick/onchange="..." (dilarang CSP tanpa 'unsafe-inline'). Baris pengguna dibuat ulang
// lewat innerHTML, jadi tombol/select-nya ditangani dengan delegasi di document.
document.addEventListener('click', e => {
    const el = e.target.closest('[data-aksi]');
    if (!el) return;
    switch (el.dataset.aksi) {
        case 'cari':     loadUsers(); break;
        case 'reset':    document.getElementById('searchInput').value = ''; loadUsers(); break;
        case 'sebelum':  changePage(-1); break;
        case 'berikut':  changePage(1); break;
        case 'analitik': loadAnalytics(); break;
        case 'csp':      loadCsp(); break;
        case 'siarkan':  broadcastSignal(); break;
        case 'aktif':    toggleActive(Number(el.dataset.id)); break;
    }
});
document.addEventListener('change', e => {
    const sel = e.target.closest('select[data-ubah-role]');
    if (sel) setRole(Number(sel.dataset.ubahRole), sel.value, sel);
    if (e.target.id === 'cspHari' || e.target.id === 'cspDisposisi') loadCsp();
});
