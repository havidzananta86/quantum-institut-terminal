// Skrip halaman masuk (login.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').
// Latar partikel animasi dihapus bersama desain halaman publik baru (assets/css/publik.css).
//
// Alur "Masuk" — satu jalur untuk kunci lisensi, email & sandi, dan Google (selesaikanMasuk):
//   a. api/auth.php menerima kredensial
//   b. verifikasi dua langkah bila akun memakainya (assets/js/qim-2fa-login.js)
//   c. sesi disimpan lalu DIBACA ULANG (QuantumAuth.saveSession) — gagal → berhenti di sini
//   d. tombol berubah "Berhasil", layar #qmLayar terbuka (assets/js/qim-masuk-animasi.js)
//   e. tahap di layar ditandai dari fakta a–c, tahap terakhir "Membuka terminal…"
//   f. location.replace(tujuan) setelah jeda tampil minimum ≤ 450 ms (0 bila gerak-minimal)
// Tidak ada kemajuan yang digerakkan timer, dan tidak ada lagi jeda tetap 800 ms + toast.

const TEKS_L1 = { license: 'Kunci lisensi valid', email: 'Email & sandi cocok', google: 'Akun Google terverifikasi' };
const TEKS_L2 = {
    'tidak-aktif': 'Verifikasi dua langkah: tidak aktif',
    'diterima': 'Verifikasi dua langkah: kode diterima',
    'tak-terperiksa': 'Verifikasi dua langkah: tidak dapat diperiksa'
};
const TEKS_ALASAN = {
    sesi_berakhir: 'Sesi Anda sudah berakhir. Silakan masuk lagi.',
    dua_langkah: 'Verifikasi dua langkah belum diselesaikan. Silakan masuk lagi.',
    keluar: 'Anda sudah keluar.'
};
const IKON_PUTAR = '<svg class="pb-ikon pb-putar" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>';
const IKON_CENTANG = '<svg class="pb-ikon qm-centang-tombol" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let sedangMasuk = false;          // cegah kirim ganda (tombol memakai aria-disabled, bukan disabled)
let verifikasiSesiLama = null;    // Promise hasil QuantumAuth.verifyServerSession() untuk kartu "Anda masih masuk"
let asalLayar = null;             // tombol yang membuka layar #qmLayar; fokus kembali ke sini setelah "Kembali"
const isiAsliTombol = new WeakMap();

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- TUJUAN SETELAH MASUK ---
// Dipasang oleh gerbang halaman lain (dashboard, kompetisi, admin, …) dan beranda. Hanya origin
// sendiri (cegah open redirect), dan bukan halaman masuk/daftar (cegah putaran).
function bacaTujuan(hapus) {
    let tujuan = 'dashboard.html';
    try {
        const simpan = sessionStorage.getItem('qi_redirect_after_login');
        if (hapus) sessionStorage.removeItem('qi_redirect_after_login');
        if (simpan) {
            const u = new URL(simpan, location.href);
            const berkas = u.pathname.split('/').pop();
            if (u.origin === location.origin && !/^(login|register)\.html$/i.test(berkas)) tujuan = u.pathname + u.search + u.hash;
        }
    } catch (e) {}
    return tujuan;
}
// Membaca DAN menghapus kunci — dipakai ketiga cara masuk, jadi kunci basi tidak pernah tertinggal.
function ambilTujuan() { return bacaTujuan(true); }

function namaTujuan(tujuan) {
    const berkas = String(tujuan).split(/[?#]/)[0].split('/').pop();
    return ({
        'kompetisi.html': 'Arena Kompetisi',
        'admin.html': 'panel admin',
        'profile.html': 'profil',
        'economic-calendar.html': 'kalender ekonomi',
        'index.html': 'beranda'
    })[berkas] || 'terminal';
}
function labelTujuan(tujuan) { return 'Membuka ' + namaTujuan(tujuan) + '…'; }

// --- 1. TAB CARA MASUK ---
function switchAuthTab(mode) {
    const lisensi = mode !== 'email';
    document.getElementById('formLicense').hidden = !lisensi;
    document.getElementById('formEmail').hidden = lisensi;
    document.getElementById('tab-license').setAttribute('aria-selected', String(lisensi));
    document.getElementById('tab-email').setAttribute('aria-selected', String(!lisensi));
    document.documentElement.removeAttribute('data-qm-tab');
}

// Prefill email & buka tab email jika datang dari halaman register
// (tab sudah tampil benar sejak awal lewat data-qm-tab dari halaman-login-kepala.js).
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
    document.documentElement.removeAttribute('data-qm-tab');
})();

// --- 2. KUNCI DEMO ---
function fillDemoLicense() {
    document.getElementById('licenseKey').value = "QI-2026-99PRO-DEMO";
    bersihkanGalat('license');
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

// --- TOMBOL, GALAT SEBARIS, PEMBERITAHUAN ---
function setTombol(btn, keadaan, label) {
    if (!btn) return;
    if (!isiAsliTombol.has(btn)) isiAsliTombol.set(btn, btn.innerHTML);
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('data-keadaan', keadaan);
    btn.innerHTML = (keadaan === 'sukses' ? IKON_CENTANG : IKON_PUTAR) + ' <span>' + esc(label) + '</span>';
}
function pulihkanTombol(btn) {
    if (!btn) return;
    if (isiAsliTombol.has(btn)) { btn.innerHTML = isiAsliTombol.get(btn); isiAsliTombol.delete(btn); }
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('data-keadaan');
}
function pulihkanSemuaTombol() {
    ['btnSubmitLicense', 'btnSubmitEmail', 'btnLanjutSesi', 'btnKeluarSesi'].forEach(id => pulihkanTombol(document.getElementById(id)));
}

function statusGoogle(teks, jenis) {
    const el = document.getElementById('googleStatus');
    if (!el) return;
    if (!teks) { el.hidden = true; el.textContent = ''; el.removeAttribute('data-jenis'); return; }
    el.innerHTML = (jenis === 'sibuk' ? IKON_PUTAR + ' ' : '') + '<span>' + esc(teks) + '</span>';
    el.setAttribute('data-jenis', jenis || 'info');
    el.hidden = false;
}

const ISIAN = { license: ['licenseKey'], email: ['emailInput', 'passwordInput'] };
function bersihkanGalat(jenis) {
    if (jenis === 'google') { statusGoogle(''); return; }
    const el = document.getElementById(jenis === 'email' ? 'galatEmail' : 'galatLicense');
    if (el) { el.hidden = true; el.textContent = ''; }
    (ISIAN[jenis] || []).forEach(id => {
        const inp = document.getElementById(id);
        if (inp) { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
    });
}
// Galat tampil di bawah formulir yang aktif (toast hanya sinyal tambahan; mudah terlewat di ponsel).
function tampilkanGalat(jenis, pesan, input) {
    if (jenis === 'google') { statusGoogle(pesan, 'galat'); return; }
    const el = document.getElementById(jenis === 'email' ? 'galatEmail' : 'galatLicense');
    if (el) { el.textContent = pesan; el.hidden = false; }
    if (input) {
        input.setAttribute('aria-invalid', 'true');
        if (el) input.setAttribute('aria-describedby', el.id);
        try { input.focus(); if (typeof input.select === 'function') input.select(); } catch (e) {}
    }
}

function pemberitahuan(teks) {
    const el = document.getElementById('qmPemberitahuan');
    if (!el) return;
    el.textContent = teks || '';
    el.hidden = !teks;
}

function pesanGagalHubungAuth(error) {
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
        return 'Halaman login dibuka sebagai file. Buka http://localhost/webapp/login.html agar server PHP dapat diakses.';
    }
    if (error && error.name === 'AbortError') {
        return 'Server autentikasi terlalu lama merespons. Periksa koneksi atau status layanan lalu coba lagi.';
    }
    return 'Server autentikasi tidak dapat dihubungi. Periksa koneksi lalu coba lagi.';
}

// Fokus kembali ke formulir setelah layar / kartu sesi disembunyikan (tanpa ini fokus jatuh ke
// <body> dan Tab berikutnya mendarat di kaki halaman): tombol yang tadi ditekan bila masih bisa
// difokus, selain itu isian pertama formulir yang tampil. Elemen tersembunyi menolak focus(),
// jadi hasilnya diperiksa lewat document.activeElement.
function fokusKeFormulir(utama) {
    const lisensi = !document.getElementById('formLicense').hidden;
    const kandidat = [utama, document.getElementById(lisensi ? 'licenseKey' : 'emailInput')];
    for (const el of kandidat) {
        if (!el || typeof el.focus !== 'function') continue;
        try { el.focus({ preventScroll: true }); } catch (e) {}
        if (document.activeElement === el) return;
    }
}

// Validasi sendiri (formulir novalidate): pesan Bahasa Indonesia, bukan gelembung bawaan browser.
function periksaIsian(type) {
    if (type === 'license') {
        const k = document.getElementById('licenseKey');
        if (!k.value.trim()) return { pesan: 'Masukkan kunci lisensi Anda.', input: k };
        return null;
    }
    const e = document.getElementById('emailInput'), p = document.getElementById('passwordInput');
    const v = e.value.trim();
    if (!v) return { pesan: 'Masukkan alamat email Anda.', input: e };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { pesan: 'Format email belum benar. Contoh: nama@email.com', input: e };
    if (!p.value) return { pesan: 'Masukkan kata sandi Anda.', input: p };
    return null;
}

// --- 4. KIRIM FORM MASUK (api/auth.php) ---
async function handleLoginSubmit(event, type) {
    event.preventDefault();
    if (sedangMasuk) return;
    bersihkanGalat(type);
    const salah = periksaIsian(type);
    if (salah) { tampilkanGalat(type, salah.pesan, salah.input); return; }

    const btn = type === 'license' ? document.getElementById('btnSubmitLicense') : document.getElementById('btnSubmitEmail');
    const body = type === 'license'
        ? { type: 'license', license_key: document.getElementById('licenseKey').value.trim() }
        : { type: 'email', email: document.getElementById('emailInput').value.trim(), password: document.getElementById('passwordInput').value };
    const rememberEl = document.getElementById(type === 'license' ? 'rememberMeLicense' : 'rememberMeEmail');
    const remember = rememberEl ? rememberEl.checked : true;

    sedangMasuk = true;
    setTombol(btn, 'sibuk', 'Memeriksa…');
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
        gagalMasuk(type, btn, pesanGagalHubungAuth(), null);
        return;
    }

    let res, data;
    try {
        res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: QuantumAuth.batasWaktu(10000)
        });
        data = await res.json().catch(() => null);
    } catch (e) {
        gagalMasuk(type, btn, pesanGagalHubungAuth(e), null);
        return;
    }

    if (res.ok && data && data.status === 'success' && data.data && data.data.token) {
        const { token, ...user } = data.data;
        await selesaikanMasuk(token, user, { remember, sumber: type, tombol: btn });
        return;
    }

    const pesan = res.status === 429
        ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(((data && data.retry_after) || 60) / 60)} menit.`
        : ((data && data.message) || 'Gagal masuk. Silakan coba lagi.');
    const isian = type === 'license'
        ? document.getElementById('licenseKey')
        : document.getElementById(res.status === 401 ? 'passwordInput' : 'emailInput');
    gagalMasuk(type, btn, pesan, res.status === 429 ? null : isian);
}

function gagalMasuk(type, btn, pesan, input) {
    sedangMasuk = false;
    pulihkanTombol(btn);
    tampilkanGalat(type, pesan, input);
    if (typeof showQuantumToast === 'function') showQuantumToast(pesan, 'error');
}

// Token server tidak dapat disimpan → buang di server juga, supaya tidak tertinggal sesi yatim.
function buangSesiServer(token) {
    try {
        fetch('api/logout.php', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, keepalive: true }).catch(() => {});
    } catch (e) {}
}

// --- 5. SATU JALUR SETELAH SERVER MENERIMA KREDENSIAL ---
async function selesaikanMasuk(token, user, opsi) {
    const { remember = true, sumber = 'license', tombol = null } = opsi || {};
    sedangMasuk = true;
    if (tombol) setTombol(tombol, 'sibuk', 'Memeriksa keamanan akun…');

    // b. Verifikasi dua langkah
    let r = { ok: true, perlu2fa: false };
    if (window.QimDuaLangkah) r = await window.QimDuaLangkah.selesaikan(token);
    if (!r || !r.ok) {
        sedangMasuk = false;
        pulihkanTombol(tombol);
        tampilkanGalat(sumber, 'Masuk dibatalkan — kode verifikasi belum dimasukkan.', null);
        return false;
    }
    const l2 = r.perlu2fa === true ? 'diterima' : (r.perlu2fa === false ? 'tidak-aktif' : 'tak-terperiksa');

    // c. Simpan sesi (membersihkan salinan lama di penyimpanan lain) lalu baca ulang
    const tersimpan = QuantumAuth.saveSession(token, user, remember);
    const tujuan = ambilTujuan();
    const nama = QuantumAuth.namaTampilan(user);
    const peran = QuantumAuth.labelPeran(user && user.role);

    // d. Tombol "Berhasil" + layar (layar tumbuh dari tombol yang ditekan)
    if (tersimpan && tombol) setTombol(tombol, 'sukses', 'Berhasil');
    asalLayar = tombol;
    QimMasuk.mulai({ nama, peran, asal: tombol || document.getElementById('googleBtnWrap') });

    // e. Tahap dari fakta yang sudah terkumpul
    QimMasuk.tandai('qmL1', 'selesai', TEKS_L1[sumber] || TEKS_L1.license);
    QimMasuk.tandai('qmL2', l2 === 'tak-terperiksa' ? 'lewat' : 'selesai', TEKS_L2[l2]);
    if (!tersimpan) {
        QimMasuk.tandai('qmL3', 'gagal', 'Sesi tidak dapat disimpan di browser ini');
        QimMasuk.tandai('qmL4', 'sembunyi');
        QimMasuk.gagal('Browser menolak menyimpan sesi. Izinkan penyimpanan untuk situs ini lalu coba lagi.');
        // Tujuan dikembalikan supaya percobaan berikutnya tetap menuju halaman yang sama.
        try { if (tujuan !== 'dashboard.html') sessionStorage.setItem('qi_redirect_after_login', tujuan); } catch (e) {}
        buangSesiServer(token);
        sedangMasuk = false;
        pulihkanTombol(tombol);
        return false;
    }
    QimMasuk.tandai('qmL3', 'selesai', remember ? 'Sesi disimpan di perangkat ini' : 'Sesi disimpan untuk tab ini saja');
    QimMasuk.tandai('qmL4', 'jalan', labelTujuan(tujuan));

    // f. Serahkan ke halaman tujuan (location.replace: tombol Kembali tidak kembali ke formulir)
    await QimMasuk.serahkan(tujuan, { nama, peran, sumber, l1: 'selesai', l2, l3: remember ? 'perangkat' : 'tab' });
    return true;
}

// --- 6. GOOGLE SIGN-IN (Google Identity Services) ---
let _googleClientId = '';

(async function initGoogleAuth() {
    try {
        const res = await fetch('api/auth-config.php', { cache: 'no-store' });
        const json = await res.json();
        if (json && json.data && json.data.google_enabled && json.data.google_client_id) {
            _googleClientId = json.data.google_client_id;
            const bagian = document.getElementById('googleAuthSection');
            if (bagian) bagian.hidden = false;
            loadGoogleGsi();
        }
        // Belum dikonfigurasi → bagian Google tetap tersembunyi (sudah hidden sejak awal).
    } catch (e) { /* konfigurasi tak terjangkau → tetap tersembunyi; jangan mengaku "belum diaktifkan admin" */ }
})();

function loadGoogleGsi() {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.addEventListener('load', () => {
        if (!window.google || !google.accounts || !google.accounts.id) return;
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
    });
    s.addEventListener('error', () => {
        statusGoogle('Layanan Google tidak dapat dimuat. Gunakan kunci lisensi atau email.', 'galat');
    });
    document.head.appendChild(s);
}

function handleGoogleClick() {
    if (window.google && google.accounts && google.accounts.id) { google.accounts.id.prompt(); return; }
    statusGoogle('Layanan Google belum termuat. Tunggu sebentar atau gunakan kunci lisensi / email.', 'info');
}

async function handleGoogleCredential(response) {
    const credential = response && response.credential;
    if (!credential) { statusGoogle('Masuk dengan Google dibatalkan.', 'info'); return; }
    if (sedangMasuk) return;
    sedangMasuk = true;
    // Iframe Google tidak bisa menampilkan pemutar; tanpa baris ini tidak ada tanda apa pun selama ≤ 12 detik.
    statusGoogle('Memeriksa akun Google…', 'sibuk');
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
        sedangMasuk = false;
        statusGoogle(pesanGagalHubungAuth(), 'galat');
        return;
    }
    let res, data;
    try {
        res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'google', credential }),
            signal: QuantumAuth.batasWaktu(12000)
        });
        data = await res.json().catch(() => null);
    } catch (e) {
        sedangMasuk = false;
        statusGoogle(pesanGagalHubungAuth(e), 'galat');
        return;
    }
    if (res.ok && data && data.status === 'success' && data.data && data.data.token) {
        statusGoogle('');
        const { token, ...user } = data.data;
        await selesaikanMasuk(token, user, { remember: true, sumber: 'google', tombol: null });
        return;
    }
    sedangMasuk = false;
    statusGoogle((data && data.message) || 'Gagal masuk dengan Google. Silakan coba lagi.', 'galat');
}

// --- 7. SUDAH MASUK: kartu "Anda masih masuk" (bukan formulir lagi + sesi server ganda) ---
function isiKartuSesi() {
    const user = QuantumAuth.getUserData() || {};
    const peran = QuantumAuth.labelPeran(user.role);
    const siapa = document.getElementById('qmSesiSiapa');
    if (siapa) {
        siapa.innerHTML = 'Anda masih masuk sebagai <b>' + esc(QuantumAuth.namaTampilan(user)) + '</b> · '
            + '<span class="qm-peran" data-peran="' + esc(peran.toLowerCase()) + '">' + esc(peran) + '</span>';
    }
    const label = document.getElementById('btnLanjutLabel');
    if (label) label.textContent = 'Lanjut ke ' + namaTujuan(bacaTujuan(false));
}

function periksaSesiTersimpan() {
    const akar = document.documentElement;
    if (!QuantumAuth.getToken()) {
        akar.removeAttribute('data-qm-sesi');
        verifikasiSesiLama = null;
        return;
    }
    akar.setAttribute('data-qm-sesi', 'ada');
    isiKartuSesi();
    const st = document.getElementById('qmSesiStatus');
    if (st) st.textContent = 'Memeriksa sesi ke server…';
    const lanjut = document.getElementById('btnLanjutSesi');
    if (lanjut) { try { lanjut.focus({ preventScroll: true }); } catch (e) {} }

    verifikasiSesiLama = QuantumAuth.verifyServerSession().then(h => {
        if (h.ditolak) {
            // Server menolak token (401 AUTH_REQUIRED / 2FA_REQUIRED): buang di KEDUA penyimpanan,
            // kembalikan formulir + alasan. Gangguan server/jaringan TIDAK sampai ke sini.
            const fokusDiKartu = (() => {
                const a = document.activeElement;
                return !a || a === document.body || a.id === 'btnLanjutSesi' || a.id === 'btnKeluarSesi';
            })();
            QuantumAuth.hapusSesi();
            akar.removeAttribute('data-qm-sesi');
            pemberitahuan(h.kode === '2FA_REQUIRED' ? TEKS_ALASAN.dua_langkah : 'Sesi sebelumnya sudah berakhir. Silakan masuk lagi.');
            // Kartu yang memegang fokus baru saja disembunyikan → pindahkan ke formulir.
            if (fokusDiKartu && !sedangMasuk) fokusKeFormulir(null);
        } else if (st) {
            st.textContent = h.sah ? 'Sesi masih berlaku.' : 'Server belum dapat memastikan sesi ini; terminal akan memeriksanya lagi.';
        }
        return h;
    });
}

async function lanjutSesi() {
    if (sedangMasuk) return;
    sedangMasuk = true;
    const btn = document.getElementById('btnLanjutSesi');
    const user = QuantumAuth.getUserData() || {};
    const nama = QuantumAuth.namaTampilan(user), peran = QuantumAuth.labelPeran(user.role);
    const tujuan = bacaTujuan(false);
    asalLayar = btn;
    QimMasuk.mulai({ nama, peran, judul: 'Selamat datang kembali', asal: btn });
    QimMasuk.tandai('qmL2', 'sembunyi');
    QimMasuk.tandai('qmL3', 'sembunyi');
    QimMasuk.tandai('qmL1', 'jalan', 'Memeriksa sesi lama ke server…');
    const h = verifikasiSesiLama ? await verifikasiSesiLama : await QuantumAuth.verifyServerSession();
    if (h.ditolak) {
        // Sesi lama ditolak server: kembali ke formulir dengan alasannya (idempoten dengan periksaSesiTersimpan).
        QuantumAuth.hapusSesi();
        document.documentElement.removeAttribute('data-qm-sesi');
        pemberitahuan(h.kode === '2FA_REQUIRED' ? TEKS_ALASAN.dua_langkah : 'Sesi sebelumnya sudah berakhir. Silakan masuk lagi.');
        asalLayar = null;   // kartu (dan tombol "Lanjut") ikut tersembunyi → fokus ke isian pertama formulir
        QimMasuk.reset();
        return;
    }
    const l1 = h.sah ? 'selesai' : 'lewat';
    if (h.sah) QimMasuk.tandai('qmL1', 'selesai', 'Sesi lama masih berlaku (diverifikasi server)');
    else QimMasuk.tandai('qmL1', 'lewat', 'Sesi lama: server belum dapat memastikan');
    ambilTujuan();
    QimMasuk.tandai('qmL4', 'jalan', labelTujuan(tujuan));
    await QimMasuk.serahkan(tujuan, { nama, peran, sumber: 'sesi', l1, l2: null, l3: null });
}

function keluarGantiAkun() {
    if (sedangMasuk) return;
    sedangMasuk = true;
    setTombol(document.getElementById('btnKeluarSesi'), 'sibuk', 'Keluar…');
    QuantumAuth.logout();   // menghapus sesi, menandai alasan "keluar", lalu memuat ulang halaman ini
}

// --- 8. ALASAN DATANG KE HALAMAN INI (sekali tampil) ---
(function tampilkanAlasan() {
    let alasan = null;
    try {
        alasan = sessionStorage.getItem('qi_alasan_masuk');
        sessionStorage.removeItem('qi_alasan_masuk');
    } catch (e) {}
    if (alasan === 'perlu_masuk') pemberitahuan('Masuk dulu untuk membuka ' + namaTujuan(bacaTujuan(false)) + '.');
    else if (TEKS_ALASAN[alasan]) pemberitahuan(TEKS_ALASAN[alasan]);
})();

periksaSesiTersimpan();

// Kembali lewat back-forward cache: jangan pernah menampilkan layar/tombol yang macet.
window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    QimMasuk.reset();
    pulihkanSemuaTombol();
    sedangMasuk = false;
    periksaSesiTersimpan();
});
// "Kembali" dari layar galat → formulir siap dipakai lagi, dan fokus kembali ke sana
// (tadinya fokus tertinggal di tombol "Kembali" yang ikut tersembunyi).
document.addEventListener('qm-reset', e => {
    sedangMasuk = false;
    pulihkanSemuaTombol();
    if (e && e.detail && e.detail.fokus) fokusKeFormulir(asalLayar);
});

// Pengganti atribut onclick/onsubmit="..." (dilarang CSP tanpa 'unsafe-inline').
document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
});
document.getElementById('formLicense').addEventListener('submit', e => handleLoginSubmit(e, 'license'));
document.getElementById('formEmail').addEventListener('submit', e => handleLoginSubmit(e, 'email'));
document.getElementById('btnDemoLicense').addEventListener('click', fillDemoLicense);
document.getElementById('btnTogglePassword').addEventListener('click', togglePasswordVisibility);
document.getElementById('btnGoogleFallback').addEventListener('click', handleGoogleClick);
document.getElementById('btnLanjutSesi').addEventListener('click', lanjutSesi);
document.getElementById('btnKeluarSesi').addEventListener('click', keluarGantiAkun);
