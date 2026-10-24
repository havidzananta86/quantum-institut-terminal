/**
 * Gerbang sesi untuk dashboard.html + pemeriksaan keberadaan vendor terminal.
 *
 * Dipisah dari dashboard.html supaya halaman tetap bebas kode inline: CSP ketat
 * Report-Only (.htaccess) melaporkan setiap <script> inline, dan tests/csp-inline.test.js
 * menjaganya.
 *
 * Perilaku sama dengan gerbang dashboard panel lama (halaman-dashboard-awal.js, sudah dihapus):
 *   · tanpa token → ke login dan kembali ke halaman ini (?panel=…#… utuh);
 *   · HANYA HTTP 401 dengan kode AUTH_REQUIRED / 2FA_REQUIRED yang berarti sesi tidak berlaku:
 *     sesi dihapus dari KEDUA penyimpanan, lalu ke login (alasan 'dua_langkah' untuk 2FA);
 *   · gangguan server (5xx), 401 lain, atau jaringan → akses dipertahankan (jangan mengusir pengguna sah);
 *   · window.QI_PERAN (free | pro | vip | admin) diisi dari qi_user, lalu dikoreksi oleh jawaban server.
 *     Quick Trade membacanya untuk mengunci paper trading bagi akun gratis.
 */
(function () {
    'use strict';
    var frame = document.getElementById('quantumTerminalFrame');
    var loading = document.getElementById('terminalLoading');
    var error = document.getElementById('terminalError');

    function token() {
        try {
            return window.QuantumAuth && window.QuantumAuth.getToken
                ? window.QuantumAuth.getToken()
                : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        } catch (e) { return null; }
    }

    function normalisasiPeran(r) {
        var s = String(r || '').toLowerCase();
        if (s === 'admin') return 'admin';
        if (s === 'vip' || s === 'vip_plus' || s === 'elite') return 'vip';
        if (s === 'pro' || s === 'premium') return 'pro';
        return 'free';
    }

    // Peran awal dari data pengguna yang tersimpan; server mengoreksinya setelah verifikasi.
    try {
        var mentah = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        window.QI_PERAN = normalisasiPeran(mentah ? (JSON.parse(mentah) || {}).role : null);
    } catch (e) { window.QI_PERAN = 'free'; }

    /** Tautan dalam diingat utuh (?panel=…#…) supaya setelah login kembali ke tempat semula. */
    function tujuanSekarang() {
        return (location.pathname.split('/').pop() || 'dashboard.html') + location.search + location.hash;
    }

    /** Sesi ditolak server: token HARUS hilang dari KEDUA penyimpanan, bukan salah satu. */
    function hapusSesi() {
        try {
            if (window.QuantumAuth && window.QuantumAuth.hapusSesi) { window.QuantumAuth.hapusSesi(); return; }
        } catch (e) {}
        ['qi_token', 'qi_user', 'qi_user_name'].forEach(function (k) {
            try { localStorage.removeItem(k); } catch (e) {}
            try { sessionStorage.removeItem(k); } catch (e) {}
        });
    }

    function goLogin(alasan) {
        window.__qiKeLogin = true;
        try {
            sessionStorage.setItem('qi_redirect_after_login', tujuanSekarang());
            sessionStorage.setItem('qi_alasan_masuk', alasan || 'perlu_masuk');
        } catch (e) {}
        if (error) error.style.display = 'grid';
        if (frame) frame.style.visibility = 'hidden';
        window.setTimeout(function () { window.location.replace('login.html'); }, 250);
    }

    function kabarSesi(detail) {
        // Layar pembuka menandai tahap "Memverifikasi sesi" selesai dari kejadian ini
        // (assets/js/halaman-dashboard-pemuat.js); tanpanya tahap pertama tidak pernah beranjak.
        try { window.dispatchEvent(new CustomEvent('qi-sesi', { detail: detail })); } catch (e) {}
    }

    /** Chart terminal (quantum-terminal/embed/) adalah vendor yang dipasang terpisah: bila foldernya tidak ada di server,
     *  katakan terus terang — bukan iframe kosong atau 404 diam. */
    function vendorHilang() {
        if (loading) loading.style.display = 'none';
        if (frame) frame.style.visibility = 'hidden';
        if (error) {
            error.textContent = 'Chart Quantum Terminal belum terpasang di server (folder quantum-terminal/embed/ tidak ditemukan). Hubungi admin.';
            error.style.display = 'grid';
        }
    }
    function periksaVendor() {
        try {
            fetch('quantum-terminal/embed/', { method: 'HEAD', cache: 'no-store' })
                .then(function (r) { if (!r.ok) vendorHilang(); })
                .catch(function () { /* jaringan sesaat: biarkan iframe memuat sendiri */ });
        } catch (e) {}
    }

    var currentToken = token();
    if (!currentToken) {
        goLogin('perlu_masuk');
        return;
    }

    periksaVendor();

    if (frame) frame.addEventListener('load', function () {
        if (loading) loading.style.display = 'none';
    }, { once: true });

    fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
        body: JSON.stringify({ type: 'verify_token', token: currentToken }),
        cache: 'no-store'
    }).then(function (response) {
        var http = response.status;
        return response.json().catch(function () { return null; }).then(function (data) {
            var sah = http >= 200 && http < 300 && !!(data && data.status === 'success');
            var kode = (data && data.code) || null;
            // 401 = server MENOLAK sesi. 503/5xx = server tidak BISA memeriksanya (basis data tumbang) — itu bukan
            // alasan mengeluarkan orang yang sedang bekerja. 401 tanpa kode sesi juga tidak menghapus apa pun.
            var ditolak = http === 401 && (kode === 'AUTH_REQUIRED' || kode === '2FA_REQUIRED');
            kabarSesi({ sah: sah, ditolak: ditolak, http: http, kode: kode });
            if (ditolak) { hapusSesi(); goLogin(kode === '2FA_REQUIRED' ? 'dua_langkah' : 'sesi_berakhir'); return; }
            if (sah && data.data && data.data.role) {
                var dariServer = normalisasiPeran(data.data.role);
                if (dariServer !== window.QI_PERAN) {
                    window.QI_PERAN = dariServer;
                    // Paket berubah (mis. diturunkan): kartu Quick Trade ikut menyesuaikan tombol & kuncinya.
                    try { if (typeof window.qtSegarkan === 'function') window.qtSegarkan(); } catch (e) {}
                }
            }
        });
    }).catch(function () {
        // Gangguan jaringan sesaat tidak memutus sesi lokal yang sudah ada, tetapi layar
        // pembuka tetap harus beranjak — kalau tidak, pengguna terkurung di tahap pertama.
        kabarSesi({ sah: false, ditolak: false, http: 0, kode: null });
    });
})();
