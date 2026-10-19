// Skrip halaman daftar (register.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
function toggleRegPassword() {
    const el = document.getElementById('regPassword');
    el.type = el.type === 'password' ? 'text' : 'password';
}

// Password strength meter
document.getElementById('regPassword').addEventListener('input', function () {
    const v = this.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const bar = document.getElementById('pwStrengthBar');
    const txt = document.getElementById('pwStrengthText');
    const levels = [
        { w: '0%',   c: '',               t: '' },
        { w: '25%',  c: 'bg-rose-500',    t: 'Lemah' },
        { w: '50%',  c: 'bg-amber-500',   t: 'Sedang' },
        { w: '75%',  c: 'bg-cyan-500',    t: 'Kuat' },
        { w: '100%', c: 'bg-emerald-500', t: 'Sangat Kuat' }
    ];
    const lv = levels[score];
    bar.style.width = lv.w;
    bar.className = 'h-full transition-all duration-300 ' + lv.c;
    txt.textContent = v ? lv.t : '';
});

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const terms = document.getElementById('regTerms').checked;
    const btn = document.getElementById('btnRegister');
    const pwInput = document.getElementById('regPassword');

    // Validasi klien
    if (!name || !email) { showQuantumToast('Nama dan email wajib diisi.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showQuantumToast('Format email tidak valid.', 'error'); return; }
    if (password.length < 8) {
        pwInput.classList.add('invalid');
        showQuantumToast('Kata sandi minimal 8 karakter.', 'error');
        return;
    }
    pwInput.classList.remove('invalid');
    if (!terms) { showQuantumToast('Centang persetujuan Syarat & Ketentuan dulu.', 'warning'); return; }

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> <span>Mendaftar...</span>';
    const restore = () => { btn.disabled = false; btn.innerHTML = original; };

    let res, data;
    try {
        res = await fetch('api/register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: name, email: email, password: password }),
            signal: AbortSignal.timeout(10000)
        });
        data = await res.json();
    } catch (err) {
        restore();
        showQuantumToast('Server registrasi tidak dapat dihubungi. Coba lagi nanti.', 'error');
        return;
    }

    if ((res.status === 201 || res.ok) && data?.status === 'success') {
        showQuantumToast('✓ Akun berhasil dibuat! Silakan masuk.', 'success');
        try { sessionStorage.setItem('qi_prefill_email', email); } catch (e) {}
        setTimeout(() => { window.location.href = 'login.html'; }, 1200);
        return;
    }

    restore();
    const msg = res.status === 429
        ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((data?.retry_after || 60) / 60)} menit.`
        : (data?.message || 'Pendaftaran gagal. Silakan coba lagi.');
    showQuantumToast(msg, 'error');
}

// Pengganti atribut onclick/onsubmit="..." (dilarang CSP tanpa 'unsafe-inline').
document.getElementById('registerForm').addEventListener('submit', handleRegister);
document.getElementById('btnToggleRegPassword').addEventListener('click', toggleRegPassword);
