// Gerbang mode Arena Kompetisi (kompetisi.html) — dipisah dari markup supaya lolos CSP tanpa
// 'unsafe-inline'. Dimuat SINKRON di awal <body> supaya mode sudah diputuskan sebelum isi dirender.
//
// Dulu (audit kompetisi 2026-10-22): pengunjung tanpa login dialihkan ke login dan pengguna FREE
// terkunci di dinding upgrade — padahal pemilik ingin orang lain BISA memantau para trader — dan
// skrip arena tetap memoll endpoint pribadi di balik dinding itu. Sekarang:
//   · tanpa token / FREE → window.QI_KOMP_MODE = 'penonton': papan, aktivitas, laci trader, ajakan;
//     tanpa tiket dan tanpa memanggil endpoint pribadi (paper-trading, ?harga);
//   · PRO / VIP / admin  → 'trader'. Peran di localStorage bisa basi, jadi diperiksa ulang ke server;
//     bila server menolak, mode turun ke 'penonton' lewat event 'qi-komp-mode'.
// Ini HANYA tampilan. Hak sesungguhnya ditegakkan server: api/paper-trading.php → qi_require_level('pro'),
// api/competition.php?harga → qi_require_level('pro'); papan mingguan memang publik.
(function () {
    var token = null, userData = null;
    try {
        token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken) ? QuantumAuth.getToken()
              : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        var raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        userData = raw ? JSON.parse(raw) : null;
    } catch (e) {}

    // Sama dengan qi_tingkat_peran() di api/_middleware.php (tingkat ≥ 1). Dulu hanya pro/vip/admin:
    // anggota 'premium' / 'vip_plus' / 'elite' yang DIIZINKAN server malah dijadikan penonton.
    var BERHAK = ['pro', 'premium', 'vip', 'vip_plus', 'elite', 'admin'];
    var isPro = !!(userData && BERHAK.indexOf(String(userData.role || '').toLowerCase()) !== -1);

    function setMode(mode, alasan) {
        window.QI_KOMP_MODE = mode;
        window.QI_KOMP_ALASAN = alasan || '';
        var b = document.body;
        if (b) b.classList.toggle('komp-penonton', mode !== 'trader');
        var label = document.getElementById('kompMode');
        if (label) {
            label.textContent = mode === 'trader' ? 'Trader' : 'Penonton';
            label.className = 'komp-mode' + (mode === 'trader' ? ' trader' : '');
        }
        var teks = document.getElementById('kompCtaTeks');
        var utama = document.getElementById('kompCtaUtama');
        if (teks && utama) {
            if (alasan === 'free') {
                teks.textContent = 'Akun Anda paket FREE — Anda bisa memantau papan & aktivitas. Upgrade ke PRO/VIP untuk ikut bertanding.';
                utama.textContent = 'Upgrade PRO untuk ikut';
                utama.setAttribute('href', 'pricing.html');
            } else {
                teks.textContent = alasan === 'sesi'
                    ? 'Sesi Anda berakhir. Masuk lagi untuk melanjutkan trading di arena.'
                    : 'Anda menonton sebagai tamu. Masuk dengan akun PRO/VIP untuk ikut bertanding.';
                utama.textContent = 'Login untuk ikut';
                utama.setAttribute('href', 'login.html');
            }
        }
        try { document.dispatchEvent(new CustomEvent('qi-komp-mode', { detail: { mode: mode, alasan: alasan || '' } })); } catch (e) {}
    }
    window.qiKompSetMode = setMode;
    // Skrip ini berjalan sebelum label mode & ajakan ada di DOM: terapkan ulang teksnya setelah markup siap.
    document.addEventListener('DOMContentLoaded', function () { setMode(window.QI_KOMP_MODE, window.QI_KOMP_ALASAN); });

    if (!token) { setMode('penonton', 'tamu'); return; }
    if (!isPro) { setMode('penonton', 'free'); }
    else setMode('trader');

    // Peran di localStorage bisa basi (paket berubah / sesi lama). Diperiksa ulang ke server.
    fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ type: 'verify_token' })
    }).then(function (r) { return r.json(); }).then(function (d) {
        var role = String((d.data && d.data.role) || '').toLowerCase();
        if (d.status !== 'success') { if (window.QI_KOMP_MODE === 'trader') setMode('penonton', 'sesi'); return; }
        var berhak = BERHAK.indexOf(role) !== -1;
        // Peran tersimpan basi (paket turun/naik): perbarui lewat QuantumAuth supaya muat berikutnya
        // langsung di mode yang benar. Dulu setiap muat halaman dengan peran 'pro' basi memanggil
        // paper-trading & ?harga lebih dulu, kena 403, baru turun ke penonton.
        if (role && userData && String(userData.role || '').toLowerCase() !== role
            && typeof QuantumAuth !== 'undefined' && typeof QuantumAuth.saveSession === 'function') {
            var ingat = false;
            try { ingat = localStorage.getItem('qi_token') === token; } catch (e) {}
            try { QuantumAuth.saveSession(token, Object.assign({}, userData, { role: role }), ingat); } catch (e) {}
        }
        if (berhak && window.QI_KOMP_MODE !== 'trader') setMode('trader');
        else if (!berhak && window.QI_KOMP_MODE === 'trader') setMode('penonton', 'free');
    }).catch(function () { /* jaringan gagal → mode tetap; server tetap menolak bila tidak berhak */ });
})();

// Tautan login: kembali ke arena setelah masuk (pengganti onclick="…"). Skrip ini dimuat di AWAL
// <body>, jadi #kompCtaUtama belum ada saat baris ini berjalan — dulu getElementById() selalu null
// dan pendengarnya tidak pernah terpasang. Kini dipasang setelah markup siap.
document.addEventListener('DOMContentLoaded', function () {
    var a = document.getElementById('kompCtaUtama');
    if (a) a.addEventListener('click', function () {
        // Hanya untuk tautan login; tombol yang sama menjadi "Upgrade PRO" untuk akun FREE.
        if (a.getAttribute('href') !== 'login.html') return;
        try { sessionStorage.setItem('qi_redirect_after_login', 'kompetisi.html'); } catch (e) {}
    });
});
