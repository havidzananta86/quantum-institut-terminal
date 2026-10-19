// Skrip halaman masuk (login.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
// --- 1. PARTICLES BACKGROUND ---
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initParticles();
});

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5 + 1;
        this.color = Math.random() > 0.4 ? '#00E5FF' : '#7C4DFF';
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5;
        ctx.fill();
    }
}

let particles = [];
function initParticles() {
    particles = [];
    const count = Math.min(Math.floor(width / 20), 50);
    for (let i = 0; i < count; i++) particles.push(new Particle());
}
initParticles();

// Hormati preferensi reduce-motion & hentikan animasi saat tab tidak terlihat (hemat baterai/CPU)
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let rafId = null;

function animateParticles() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = '#00E5FF';
                ctx.globalAlpha = (1 - dist / 120) * 0.12;
                ctx.stroke();
            }
        }
    }
    rafId = requestAnimationFrame(animateParticles);
}

function startParticles() {
    if (prefersReduced || rafId !== null) return;
    animateParticles();
}
function stopParticles() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
}

if (prefersReduced) {
    // Gambar satu frame statis saja
    particles.forEach(p => p.draw());
} else {
    startParticles();
    document.addEventListener('visibilitychange', () => {
        document.hidden ? stopParticles() : startParticles();
    });
}


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

// --- 2. AUTH TAB SWITCHER ---
function switchAuthTab(mode) {
    const formLicense = document.getElementById('formLicense');
    const formEmail = document.getElementById('formEmail');
    const tabLicense = document.getElementById('tab-license');
    const tabEmail = document.getElementById('tab-email');

    if (mode === 'license') {
        formLicense.classList.remove('hidden');
        formEmail.classList.add('hidden');
        tabLicense.className = "flex-1 py-2.5 rounded-lg font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/40 transition-all flex items-center justify-center gap-2";
        tabEmail.className = "flex-1 py-2.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2";
    } else {
        formEmail.classList.remove('hidden');
        formLicense.classList.add('hidden');
        tabEmail.className = "flex-1 py-2.5 rounded-lg font-bold text-purple-300 bg-purple-500/20 border border-purple-500/40 transition-all flex items-center justify-center gap-2";
        tabLicense.className = "flex-1 py-2.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2";
    }
}

// --- 3. DEMO LISENSI FILLER ---
function fillDemoLicense() {
    document.getElementById('licenseKey').value = "QI-2026-99PRO-DEMO";
}

// --- 4. PASSWORD VISIBILITY TOGGLE ---
function togglePasswordVisibility() {
    const pwdInput = document.getElementById('passwordInput');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
    } else {
        pwdInput.type = 'password';
    }
}

// --- 5. LOGIN FORM SUBMISSION (api/auth.php) ---
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
    btn.innerHTML = `<svg class="w-5 h-5 animate-spin text-slate-950" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Memverifikasi Enkripsi...</span>`;
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
        showQuantumToast('⚡ Otentikasi Berhasil! Mengalihkan ke Quantum Terminal Live Dashboard...', 'success');
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

// --- 6. GOOGLE SIGN-IN (Google Identity Services) ---
let _googleClientId = '';

(async function initGoogleAuth() {
    try {
        const res = await fetch('api/auth-config.php', { cache: 'no-store' });
        const json = await res.json();
        if (json?.data?.google_enabled && json.data.google_client_id) {
            _googleClientId = json.data.google_client_id;
            loadGoogleGsi();
        } else {
            // Belum dikonfigurasi → sembunyikan tombol Google dan divider-nya
            const wrap = document.getElementById('googleBtnWrap');
            const divider = document.getElementById('googleDividerLabel');
            if (wrap) wrap.style.display = 'none';
            if (divider) divider.style.display = 'none';
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
            container.classList.remove('hidden');
            container.classList.add('flex');
            google.accounts.id.renderButton(container, {
                theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', width: 280
            });
        }
        if (fallback) fallback.classList.add('hidden');
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
            showQuantumToast('⚡ Login Google Berhasil! Mengalihkan ke Terminal...', 'success');
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
