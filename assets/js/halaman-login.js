// Skrip halaman masuk (login.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').
// Latar partikel animasi dihapus bersama desain halaman publik baru (assets/css/publik.css).

// Prefill email & buka tab email jika datang dari halaman register
(function prefillFromRegister() {
    try {
        const email = sessionStorage.getItem('qi_prefill_email');
        if (email) {
            sessionStorage.removeItem('qi_prefill_email');
            const emailInput = document.getElementById('emailInput');
            if (emailInput) emailInput.value = email;
            switchAuthTab('email');
        }
    } catch (e) {}
})();

// --- 1. TAB CARA MASUK ---
function switchAuthTab(mode) {
    const lisensi = mode !== 'email';
    document.getElementById('formLicense').hidden = !lisensi;
    document.getElementById('formEmail').hidden = lisensi;
    document.getElementById('tab-license').setAttribute('aria-selected', String(lisensi));
    document.getElementById('tab-email').setAttribute('aria-selected', String(!lisensi));
}

// --- 2. KUNCI DEMO ---
function fillDemoLicense() {
    document.getElementById('licenseKey').value = "QI-2026-99PRO-DEMO";
}

// --- 3. TAMPILKAN / SEMBUNYIKAN SANDI ---
function togglePasswordVisibility() {
    const pwdInput = document.getElementById('passwordInput');
    const tombol = document.getElementById('btnTogglePassword');
    const tampil = pwdInput.type === 'password';
    pwdInput.type = tampil ? 'text' : 'password';
    tombol.setAttribute('aria-pressed', String(tampil));
    tombol.setAttribute('aria-label', tampil ? 'Sembunyikan sandi' : 'Tampilkan sandi');
}

// --- 4. KIRIM FORM MASUK (api/auth.php) ---
async function handleLoginSubmit(event, type) {
    event.preventDefault();
    const btn = type === 'license' ? document.getElementById('btnSubmitLicense') : document.getElementById('btnSubmitEmail');
    const originalContent = btn.innerHTML;

    const body = type === 'license'
        ? { type: 'license', license_key: document.getElementById('licenseKey').value.trim() }
        : { type: 'email', email: document.getElementById('emailInput').value.trim(), password: document.getElementById('passwordInput').value };
    const rememberEl = document.getElementById('rememberMeLicense');
    const remember = type === 'license' && rememberEl ? rememberEl.checked : true;

    btn.disabled = true;
    btn.innerHTML = '<svg class="pb-ikon pb-putar" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg> <span>Memeriksa…</span>';
    const restore = () => { btn.disabled = false; btn.innerHTML = originalContent; };

    let res, data;
    try {
        res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000)
        });
        data = await res.json();
    } catch (e) {
        restore();
        showQuantumToast('Server autentikasi tidak dapat dihubungi. Periksa koneksi lalu coba lagi.', 'error');
        return;
    }

    if (res.ok && data?.status === 'success' && data.data?.token) {
        const { token, ...user } = data.data;
        // Verifikasi dua langkah (bila aktif di akun ini) sebelum sesi dipakai.
        if (window.QimDuaLangkah && !(await window.QimDuaLangkah.selesaikan(token))) { restore(); showQuantumToast('Login dibatalkan — kode verifikasi belum dimasukkan.', 'info'); return; }
        QuantumAuth.saveSession(token, user, remember);
        showQuantumToast('Berhasil masuk. Membuka terminal…', 'success');
        let target = 'dashboard.html';
        try {
            const saved = sessionStorage.getItem('qi_redirect_after_login');
            sessionStorage.removeItem('qi_redirect_after_login');
            // Hanya redirect ke origin sendiri (cegah open redirect)
            if (saved && new URL(saved, location.href).origin === location.origin) target = saved;
        } catch (e) {}
        setTimeout(() => { window.location.href = target; }, 800);
        return;
    }

    restore();
    const msg = res.status === 429
        ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((data?.retry_after || 60) / 60)} menit.`
        : (data?.message || 'Login gagal. Silakan coba lagi.');
    showQuantumToast(msg, 'error');
}

// --- 5. GOOGLE SIGN-IN (Google Identity Services) ---
let _googleClientId = '';

(async function initGoogleAuth() {
    try {
        const res = await fetch('api/auth-config.php', { cache: 'no-store' });
        const json = await res.json();
        if (json?.data?.google_enabled && json.data.google_client_id) {
            _googleClientId = json.data.google_client_id;
            loadGoogleGsi();
        } else {
            // Belum dikonfigurasi → sembunyikan bagian Google beserta pemisahnya
            const bagian = document.getElementById('googleAuthSection');
            if (bagian) bagian.hidden = true;
        }
    } catch (e) { /* endpoint tak terjangkau → tombol tetap fallback */ }
})();

function loadGoogleGsi() {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => {
        if (!window.google?.accounts?.id) return;
        google.accounts.id.initialize({
            client_id: _googleClientId,
            callback: handleGoogleCredential,
        });
        const container = document.getElementById('googleGsiButton');
        const fallback  = document.getElementById('btnGoogleFallback');
        if (container) {
            container.hidden = false;
            google.accounts.id.renderButton(container, {
                theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', width: 280
            });
        }
        if (fallback) fallback.hidden = true;
    };
    document.head.appendChild(s);
}

function handleGoogleClick() {
    if (!_googleClientId) {
        showQuantumToast('Login Google belum diaktifkan oleh admin. Gunakan kunci lisensi atau email.', 'info');
        return;
    }
    if (window.google?.accounts?.id) google.accounts.id.prompt();
}

async function handleGoogleCredential(response) {
    const credential = response?.credential;
    if (!credential) { showQuantumToast('Login Google dibatalkan.', 'info'); return; }
    try {
        const res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'google', credential }),
            signal: AbortSignal.timeout(12000)
        });
        const data = await res.json();
        if (res.ok && data?.status === 'success' && data.data?.token) {
            const { token, ...user } = data.data;
            if (window.QimDuaLangkah && !(await window.QimDuaLangkah.selesaikan(token))) { showQuantumToast('Login dibatalkan — kode verifikasi belum dimasukkan.', 'info'); return; }
            QuantumAuth.saveSession(token, user, true);
            showQuantumToast('Berhasil masuk dengan Google. Membuka terminal…', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
        } else {
            showQuantumToast(data?.message || 'Login Google gagal.', 'error');
        }
    } catch (e) {
        showQuantumToast('Server autentikasi tidak dapat dihubungi.', 'error');
    }
}

// Pengganti atribut onclick/onsubmit="..." (dilarang CSP tanpa 'unsafe-inline').
document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
});
document.getElementById('formLicense').addEventListener('submit', e => handleLoginSubmit(e, 'license'));
document.getElementById('formEmail').addEventListener('submit', e => handleLoginSubmit(e, 'email'));
document.getElementById('btnDemoLicense').addEventListener('click', fillDemoLicense);
document.getElementById('btnTogglePassword').addEventListener('click', togglePasswordVisibility);
document.getElementById('btnGoogleFallback').addEventListener('click', handleGoogleClick);
