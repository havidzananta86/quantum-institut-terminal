// Skrip halaman daftar (register.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').

// Sinyal batas waktu fetch. AbortSignal.timeout tidak ada di Safari/iOS < 16 (melempar TypeError →
// tampil sebagai "server tidak dapat dihubungi"). Sama dengan QuantumAuth.batasWaktu di auth.js,
// yang tidak dimuat register.html.
function batasWaktu(ms) {
    if (window.QuantumAuth && typeof QuantumAuth.batasWaktu === 'function') return QuantumAuth.batasWaktu(ms);
    try {
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    } catch (e) {}
    try {
        const c = new AbortController();
        setTimeout(() => { try { c.abort(); } catch (e) {} }, ms);
        return c.signal;
    } catch (e) {
        return undefined;
    }
}

function toggleRegPassword() {
    const el = document.getElementById('regPassword');
    const tombol = document.getElementById('btnToggleRegPassword');
    const tampil = el.type === 'password';
    el.type = tampil ? 'text' : 'password';
    tombol.setAttribute('aria-pressed', String(tampil));
    tombol.setAttribute('aria-label', tampil ? 'Sembunyikan sandi' : 'Tampilkan sandi');
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
    const levels = ['', 'Lemah', 'Sedang', 'Kuat', 'Sangat kuat'];
    bar.style.width = (score * 25) + '%';
    bar.dataset.tingkat = String(score);
    txt.textContent = v ? 'Kekuatan sandi: ' + levels[score] : '';
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
    btn.innerHTML = '<svg class="pb-ikon pb-putar" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg> <span>Mendaftar…</span>';
    const restore = () => { btn.disabled = false; btn.innerHTML = original; };

    let res, data;
    try {
        res = await fetch('api/register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: name, email: email, password: password }),
            signal: batasWaktu(10000)
        });
        data = await res.json();
    } catch (err) {
        restore();
        showQuantumToast('Server registrasi tidak dapat dihubungi. Coba lagi nanti.', 'error');
        return;
    }

    if ((res.status === 201 || res.ok) && data?.status === 'success') {
        showQuantumToast('Akun berhasil dibuat. Silakan masuk.', 'success');
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
