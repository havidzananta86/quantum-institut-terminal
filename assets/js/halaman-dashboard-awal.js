// Skrip awal dashboard yang harus jalan SEBELUM halaman tampil (dulu 4 blok <script> inline; dipindah agar
// lolos CSP tanpa 'unsafe-inline'). Dimuat sinkron tepat setelah #qiAccessGate, urutan isi = urutan lama.

// ── Stempel waktu di gerbang akses ──
(function(){
    var el = document.getElementById('gateTimestamp');
    if (el) el.textContent = new Date().toISOString().replace('T',' ').substring(0,19) + ' UTC';
})();

// Pembungkus fetch: sertakan token otomatis untuk semua permintaan ke api/ kita.
// ⚠️ Sebab diperlukannya: sebagian pemanggil (pro-trading-tools.js, advanced-trading.js,
// poller harga, dsb.) memanggil endpoint TANPA header Authorization, sehingga endpoint
// yang mewajibkan login/paket membalas 401 walau pengguna sudah masuk. Alih-alih
// menambal satu per satu (mudah terlewat), semua permintaan ke api/ kita diberi token
// sekali di sini. Permintaan ke domain lain TIDAK disentuh, dan header Authorization
// yang sudah ada tidak ditimpa.
(function () {
    if (window.__qiFetchTerbungkus) return;
    window.__qiFetchTerbungkus = true;
    var asli = window.fetch ? window.fetch.bind(window) : null;
    if (!asli) return;
    window.fetch = function (masukan, opsi) {
        try {
            var url = (typeof masukan === 'string') ? masukan : (masukan && masukan.url) || '';
            var relatif = url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0 && url.indexOf('//') !== 0;
            if (relatif && /(^|\/)api\//.test(url)) {
                var token = null;
                try {
                    token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
                        ? QuantumAuth.getToken()
                        : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
                } catch (e) {}
                if (token) {
                    var salinan = {};
                    for (var k in (opsi || {})) { if (Object.prototype.hasOwnProperty.call(opsi, k)) salinan[k] = opsi[k]; }
                    var h = new Headers(salinan.headers || (typeof masukan === 'object' && masukan.headers) || {});
                    if (!h.has('Authorization')) h.set('Authorization', 'Bearer ' + token);
                    salinan.headers = h;
                    opsi = salinan;
                }
            }
        } catch (e) { /* jangan pernah menggagalkan permintaan karena pembungkus ini */ }
        return asli(masukan, opsi);
    };
})();

// ── Pemeriksaan gerbang — jalan sebelum DOM digambar ──
(function() {
    var token = null, userData = null;
    try {
        token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
            ? QuantumAuth.getToken()
            : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        var raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        userData = raw ? JSON.parse(raw) : null;
    } catch(e) {}

    // ── PERAN PENGGUNA → TINGKAT AKSES ─────────────────────────────────────
    // PERUBAHAN PENTING: dulu pengguna yang bukan PRO DILARANG masuk dashboard
    // (dikunci total). Sekarang pengguna FREE tetap boleh masuk; hanya sebagian
    // area yang terkunci dan sisanya terbuka. Peta area ada di QI_PANEL_MIN
    // (blok "AKSES PAKET" di bawah) — itulah satu-satunya tempat mengubahnya.
    function qiNormalisasiPeran(r) {
        const s = String(r || '').toLowerCase();
        if (s === 'admin') return 'admin';
        if (s === 'vip' || s === 'vip_plus' || s === 'elite') return 'vip';
        if (s === 'pro' || s === 'premium') return 'pro';
        return 'free';
    }
    window.QI_PERAN = qiNormalisasiPeran(userData && userData.role);

    if (!token) {
        // Belum masuk → ke login, lalu kembali ke dashboard.
        try { sessionStorage.setItem('qi_redirect_after_login', 'dashboard.html'); } catch(e) {}
        window.location.replace('login.html');
        return;
    }

    // Token ada → SEMUA paket (termasuk free) boleh masuk dashboard sekarang juga.
    document.getElementById('qiAccessGate').style.display = 'none';
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof showQiOnboarding === 'function') showQiOnboarding();
        if (typeof window.QI_TERAPKAN_AKSES === 'function') window.QI_TERAPKAN_AKSES();
    });

    // Verifikasi peran ke server (diam-diam). Bila token dipalsukan → ke login;
    // bila paket diturunkan → cukup kunci area berbayar (bukan mengunci dashboard).
    fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ type: 'verify_token' })
    }).then(function(r){ return r.json(); }).then(function(d){
        const sah = d && d.status === 'success' && d.data && d.data.role;
        if (!sah) {
            try { sessionStorage.setItem('qi_redirect_after_login', 'dashboard.html'); } catch(e) {}
            window.location.replace('login.html');
            return;
        }
        const peranServer = qiNormalisasiPeran(d.data.role);
        if (peranServer !== window.QI_PERAN) {
            window.QI_PERAN = peranServer;
            if (typeof window.QI_TERAPKAN_AKSES === 'function') window.QI_TERAPKAN_AKSES();
        }
    }).catch(function(){
        // Gangguan jaringan → pertahankan akses optimistis (jangan kunci pengguna
        // yang sah hanya karena jaringan bermasalah).
    });
})();

// ── Sambutan pertama kali (#qiOnboarding; markup-nya di bawah gerbang) ──
// Hanya mendeklarasikan fungsi + pendengar Esc; dipanggil saat DOMContentLoaded oleh blok gerbang di atas.
function showQiOnboarding() {
    try {
        if (localStorage.getItem('qi_dashboard_onboarded') === '1') return;
    } catch(e) {}
    const el = document.getElementById('qiOnboarding');
    if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; window.__qimDialogAktif = 'sambutan'; }
}
function dismissQiOnboarding() {
    const el = document.getElementById('qiOnboarding');
    if (el) el.style.display = 'none';
    document.body.style.overflow = '';
    window.__qimDialogAktif = null;
    // Sambutan cukup SEKALI. Dulu hanya diingat bila kotak kecil "jangan tampilkan lagi" dicentang,
    // sehingga sambutan muncul di setiap kunjungan (paling mengganggu di ponsel).
    try { localStorage.setItem('qi_dashboard_onboarded', '1'); } catch(e) {}
}
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const ob = document.getElementById('qiOnboarding');
        if (ob && ob.style.display !== 'none') dismissQiOnboarding();
    }
});
