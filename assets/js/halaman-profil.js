// Skrip halaman profil (profile.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
let _toastTimer = null;
function showToast(msg, ok = true) {
    const el = document.getElementById('profileToast');
    const m  = document.getElementById('profileToastMsg');
    m.textContent = msg;
    m.className   = 'px-4 py-3 rounded-xl text-sm text-white shadow-xl max-w-xs border ' +
                    (ok ? 'bg-slate-800 border-qi-green/40' : 'bg-red-950 border-qi-red/40');
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function getToken() {
    return (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
        ? QuantumAuth.getToken()
        : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token') || '');
}

function loadProfile() {
    let userData = null;
    try {
        const raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        userData  = raw ? JSON.parse(raw) : null;
    } catch(e) {}

    if (!userData) return;

    const email = userData.email || '';
    document.getElementById('profileEmail').textContent     = email;
    document.getElementById('avatarInitial').textContent    = email.charAt(0).toUpperCase() || '?';

    const role      = userData.role || 'user';
    const badge     = document.getElementById('profileRoleBadge');
    badge.textContent = role.toUpperCase();
    badge.className = 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ' +
        (role === 'admin' ? 'bg-purple-900/50 text-purple-300' :
         role === 'pro'   ? 'bg-amber-900/50 text-amber-300'   :
                            'bg-slate-800 text-slate-400');

    // Server verify to get accurate expiry
    fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ type: 'verify_token' })
    }).then(r => r.json()).then(d => {
        if (d.status === 'success' && d.data) {
            const exp = d.data.expires_at;
            if (exp) {
                document.getElementById('profileTokenExp').textContent =
                    new Date(exp).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
            }
        }
    }).catch(() => {});
}

function loadAlerts() {
    const alerts = JSON.parse(localStorage.getItem('qi_alerts') || '[]');
    const list   = document.getElementById('profileAlertList');
    document.getElementById('alertCountBadge').textContent = alerts.length;

    if (!alerts.length) {
        list.innerHTML = '<div class="text-slate-600 text-center py-4">Belum ada alert aktif</div>';
        return;
    }
    list.innerHTML = alerts.map(a => {
        const sign = a.condition === 'ABOVE' ? '≥' : '≤';
        const d    = new Date(a.created).toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
        return `<div class="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2">
            <div>
                <span class="font-semibold text-white">${a.sym}</span>
                <span class="text-slate-400 ml-2">${sign} ${a.price}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-slate-600">${d}</span>
                <button type="button" data-aksi="deleteAlert" data-arg="${escH(a.id)}" class="text-qi-red hover:text-red-400 transition-colors">✕</button>
            </div>
        </div>`;
    }).join('');
}

function deleteAlert(id) {
    const alerts = JSON.parse(localStorage.getItem('qi_alerts') || '[]').filter(a => a.id !== id);
    localStorage.setItem('qi_alerts', JSON.stringify(alerts));
    loadAlerts();
}

function clearAllAlerts() {
    showConfirm('Hapus Semua Alert', 'Yakin ingin menghapus semua alert aktif?', () => {
        localStorage.removeItem('qi_alerts');
        loadAlerts();
        showToast('Semua alert dihapus');
    });
}

function saveTgChatId() {
    const val = document.getElementById('tgChatId').value.trim();
    localStorage.setItem('qi_telegram_chat_id', val);
    showToast(val ? 'Chat ID Telegram disimpan' : 'Chat ID Telegram dihapus');
}

async function testTelegram() {
    const chatId = document.getElementById('tgChatId').value.trim();
    if (!chatId) { showToast('Masukkan Chat ID terlebih dahulu', false); return; }
    const btn = document.getElementById('btnTestTg');
    const status = document.getElementById('tgStatus');
    btn.textContent = 'Mengirim…'; btn.disabled = true;
    status.className = 'mt-2 text-[11px] text-slate-500'; status.textContent = 'Mengirim pesan test…'; status.classList.remove('hidden');
    try {
        const res  = await fetch('api/telegram-alert.php', {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify({ chat_id: chatId, message: '✅ <b>Quantum Institut</b>\nKoneksi Telegram berhasil! Alert harga akan dikirim ke chat ini.' })
        });
        const data = await res.json();
        if (data.status === 'success') {
            status.className = 'mt-2 text-[11px] text-qi-green'; status.textContent = '✓ Berhasil! Cek Telegram kamu.';
            localStorage.setItem('qi_telegram_chat_id', chatId);
        } else {
            status.className = 'mt-2 text-[11px] text-qi-red'; status.textContent = '✗ ' + (data.message || 'Gagal');
        }
    } catch(e) {
        status.className = 'mt-2 text-[11px] text-qi-red'; status.textContent = '✗ Network error';
    }
    btn.textContent = 'Test'; btn.disabled = false;
}

function handleLogout() {
    showConfirm('Logout', 'Yakin ingin keluar dari akun ini?', () => {
        if (typeof QuantumAuth !== 'undefined' && QuantumAuth.logout) { QuantumAuth.logout(); return; }
        localStorage.removeItem('qi_token'); localStorage.removeItem('qi_user');
        sessionStorage.removeItem('qi_token'); sessionStorage.removeItem('qi_user');
        window.location.href = 'login.html';
    });
}

let _confirmCb = null;
function showConfirm(title, message, onOk) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    _confirmCb = onOk;
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    _confirmCb = null;
}
document.getElementById('confirmOkBtn').addEventListener('click', () => {
    const cb = _confirmCb;
    closeConfirm();
    if (cb) cb();
});

async function handleChangePassword(e) {
    e.preventDefault();
    const cur = document.getElementById('cpCurrent').value;
    const np  = document.getElementById('cpNew').value;
    const nc  = document.getElementById('cpConfirm').value;
    const btn = document.getElementById('btnChangePw');

    if (!cur || !np) { showToast('Isi semua kolom kata sandi', false); return; }
    if (np.length < 8) { showToast('Kata sandi baru minimal 8 karakter', false); return; }
    if (np !== nc) { showToast('Konfirmasi kata sandi tidak cocok', false); return; }

    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan…';

    try {
        const res = await fetch('api/change-password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify({ current_password: cur, new_password: np }),
            signal: AbortSignal.timeout(8000)
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Kata sandi berhasil diubah');
            document.getElementById('changePwForm').reset();
        } else {
            showToast(data.message || 'Gagal mengubah kata sandi', false);
        }
    } catch (err) {
        showToast('Tidak dapat terhubung ke server', false);
    }
    btn.disabled = false; btn.textContent = orig;
}

// #44 Account Settings
async function loadAccountSettings() {
    try {
        const res = await fetch('api/account-settings.php', {
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        const d = await res.json();
        if (d.status === 'success' && d.profile) {
            document.getElementById('asFullName').value = d.profile.full_name || '';
            document.getElementById('asPhone').value = d.profile.phone || '';
            if (d.profile.member_since) {
                document.getElementById('profileJoined').textContent =
                    new Date(d.profile.member_since).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
            }
        }
    } catch(e) {}
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSettings');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
        const res = await fetch('api/account-settings.php', {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify({
                full_name: document.getElementById('asFullName').value.trim(),
                phone_number: document.getElementById('asPhone').value.trim()
            })
        });
        const d = await res.json();
        showToast(d.message || (d.status === 'success' ? 'Berhasil disimpan' : 'Gagal'), d.status === 'success');
    } catch(e) { showToast('Gagal terhubung ke server', false); }
    btn.disabled = false; btn.textContent = orig;
}


// #43 API Keys
async function loadApiKeys() {
    const list = document.getElementById('apiKeyList');
    try {
        const res = await fetch('api/api-keys.php', {
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        if (res.status === 403) {
            list.innerHTML = '<div class="text-slate-600 text-center py-4">Fitur ini hanya untuk user PRO/VIP</div>';
            document.getElementById('btnCreateKey').classList.add('hidden');
            return;
        }
        const d = await res.json();
        if (d.status === 'success') {
            if (!d.keys || !d.keys.length) {
                list.innerHTML = '<div class="text-slate-600 text-center py-4">Belum ada API key</div>';
                return;
            }
            list.innerHTML = d.keys.map(k => `<div class="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2">
                <div>
                    <span class="font-semibold text-white">${escH(k.name)}</span>
                    <span class="text-slate-500 ml-2 font-mono">${escH(k.prefix)}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-slate-600">${k.created_at ? new Date(k.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : ''}</span>
                    <button type="button" data-aksi="revokeApiKey" data-arg="${escH(k.id)}" class="text-qi-red hover:text-red-400 transition-colors" title="Cabut">✕</button>
                </div>
            </div>`).join('');
        }
    } catch(e) {
        list.innerHTML = '<div class="text-slate-600 text-center py-4">Gagal memuat API keys</div>';
    }
}

function escH(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML.replace(/"/g, '&quot;'); }

async function createApiKey() {
    let nameInput = document.getElementById('apiKeyNameInput');
    if (!nameInput) {
        const wrap = document.createElement('div');
        wrap.id = 'apiKeyNameWrap';
        wrap.className = 'flex gap-2 mt-3';
        wrap.innerHTML = '<input type="text" id="apiKeyNameInput" placeholder="Nama key (misal: Bot Trading)" class="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none">' +
            '<button type="button" data-aksi="doCreateApiKey" class="px-4 py-2 bg-qi-cyan text-slate-950 font-bold rounded-lg text-sm">Buat</button>' +
            '<button type="button" data-aksi="batalBuatKey" class="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">Batal</button>';
        document.getElementById('apiKeyList').after(wrap);
        wrap.querySelector('input').focus();
        return;
    }
}

async function doCreateApiKey() {
    const nameInput = document.getElementById('apiKeyNameInput');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) { showToast('Masukkan nama key', false); return; }
    const wrap = document.getElementById('apiKeyNameWrap');
    const btn = wrap ? wrap.querySelector('button') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Membuat…'; }
    try {
        const res = await fetch('api/api-keys.php', {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify({ name: name })
        });
        const d = await res.json();
        if (d.status === 'success' && d.key) {
            document.getElementById('newKeyValue').textContent = d.key;
            document.getElementById('newKeyDisplay').classList.remove('hidden');
            if (wrap) wrap.remove();
            loadApiKeys();
            showToast('API key berhasil dibuat');
        } else {
            showToast(d.message || 'Gagal membuat key', false);
            if (btn) { btn.disabled = false; btn.textContent = 'Buat'; }
        }
    } catch(e) {
        showToast('Network error', false);
        if (btn) { btn.disabled = false; btn.textContent = 'Buat'; }
    }
}

function copyNewKey() {
    const key = document.getElementById('newKeyValue').textContent;
    navigator.clipboard.writeText(key).then(() => showToast('API key disalin')).catch(() => {});
}

async function revokeApiKey(id) {
    showConfirm('Cabut API Key', 'Yakin ingin mencabut API key ini? Akses yang menggunakan key ini akan berhenti.', async () => {
        try {
            const res = await fetch('api/api-keys.php', {
                method: 'DELETE',
                headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
                body: JSON.stringify({ id: id })
            });
            const d = await res.json();
            showToast(d.message || 'Key dicabut', d.status === 'success');
            loadApiKeys();
        } catch(e) { showToast('Network error', false); }
    });
}

// #45 Referral
async function loadReferral() {
    try {
        const res = await fetch('api/referral.php', {
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        const d = await res.json();
        if (d.status === 'success' && d.referral) {
            document.getElementById('refCode').textContent = d.referral.code || '—';
            document.getElementById('refCount').textContent = d.referral.total_referrals || 0;
            document.getElementById('refRewards').textContent = d.referral.rewards_earned || 0;
            document.getElementById('refLink').value = d.referral.referral_link || '';
        }
    } catch(e) {}
}

function copyRefCode() {
    const code = document.getElementById('refCode').textContent;
    navigator.clipboard.writeText(code).then(() => showToast('Kode referral disalin')).catch(() => {});
}

function copyRefLink() {
    const link = document.getElementById('refLink').value;
    navigator.clipboard.writeText(link).then(() => showToast('Link referral disalin')).catch(() => {});
}

async function applyReferral() {
    const code = document.getElementById('applyRefCode').value.trim();
    if (!code) { showToast('Masukkan kode referral', false); return; }
    const btn = document.getElementById('btnApplyRef');
    btn.disabled = true; btn.textContent = 'Menerapkan…';
    try {
        const res = await fetch('api/referral.php', {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify({ code: code })
        });
        const d = await res.json();
        showToast(d.message || 'Gagal', d.status === 'success');
        if (d.status === 'success') document.getElementById('applyRefCode').value = '';
    } catch(e) { showToast('Network error', false); }
    btn.disabled = false; btn.textContent = 'Terapkan';
}

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadAlerts();
    loadAccountSettings();
    loadApiKeys();
    loadReferral();
    const saved = localStorage.getItem('qi_telegram_chat_id') || '';
    document.getElementById('tgChatId').value = saved;
});

// Pengganti atribut onclick/onsubmit="..." (dilarang CSP tanpa 'unsafe-inline'). Tombol ber-data-aksi —
// termasuk yang dibuat ulang lewat innerHTML (hapus alert, cabut API key) — memanggil fungsi di daftar ini
// dengan data-arg sebagai argumen.
const AKSI_PROFIL = {
    saveTgChatId, testTelegram, clearAllAlerts, createApiKey, copyNewKey, copyRefCode, copyRefLink,
    applyReferral, handleLogout, closeConfirm, doCreateApiKey, deleteAlert, revokeApiKey,
    batalBuatKey: () => document.getElementById('apiKeyNameWrap')?.remove(),
};
document.addEventListener('click', e => {
    const el = e.target.closest('[data-aksi]');
    if (el && AKSI_PROFIL[el.dataset.aksi]) AKSI_PROFIL[el.dataset.aksi](el.dataset.arg);
});
document.getElementById('changePwForm').addEventListener('submit', handleChangePassword);
document.getElementById('accountSettingsForm').addEventListener('submit', handleSaveSettings);
