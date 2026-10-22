// Skrip awal dashboard yang harus jalan SEBELUM halaman tampil (dulu 4 blok <script> inline; dipindah agar
// lolos CSP tanpa 'unsafe-inline'). Dimuat sinkron tepat setelah layar pembuka (#qiLoadScreen), urutan isi = urutan lama.
// Gerbang akses lama (#qiAccessGate, stempel waktu, "SECURE CONNECTION") sudah dihapus dari dashboard.html.

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

    // Halaman ini lengkap dengan ?panel=… / #… — supaya tautan dalam tidak hilang lewat halaman masuk.
    function halamanIni() {
        return (location.pathname.split('/').pop() || 'dashboard.html') + location.search + location.hash;
    }
    function keLogin(alasan) {
        window.__qiKeLogin = true;   // sambutan pertama kali tidak dibuka untuk halaman yang sedang ditinggalkan
        try {
            sessionStorage.setItem('qi_redirect_after_login', halamanIni());
            sessionStorage.setItem('qi_alasan_masuk', alasan);
        } catch(e) {}
        window.location.replace('login.html');
    }
    // Hasil verifikasi untuk layar pembuka (halaman-dashboard-pemuat.js, tahap "Memverifikasi sesi").
    function kabarSesi(detail) {
        try { window.dispatchEvent(new CustomEvent('qi-sesi', { detail: detail })); } catch(e) {}
    }

    if (!token) {
        // Belum masuk → ke login, lalu kembali ke halaman ini (termasuk ?panel=).
        keLogin('perlu_masuk');
        return;
    }

    // Token ada → SEMUA paket (termasuk free) boleh masuk dashboard sekarang juga.
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof window.QI_TERAPKAN_AKSES === 'function') window.QI_TERAPKAN_AKSES();
        // Sambutan pertama kali menunggu layar pembuka selesai (dulu tampil di BAWAH layar itu),
        // dan tidak pernah dibuka bila sesi ditolak dan halaman sedang dialihkan ke login.html.
        function sambut() {
            if (!window.__qiKeLogin && typeof showQiOnboarding === 'function') showQiOnboarding();
        }
        if (!document.getElementById('qiLoadScreen') || window.__qiLayarPembukaSelesai) {
            sambut();
        } else {
            window.addEventListener('qi-layar-pembuka-selesai', sambut, { once: true });
        }
    });

    // Verifikasi peran ke server (diam-diam). HANYA penolakan nyata — HTTP 401 dengan kode
    // AUTH_REQUIRED atau 2FA_REQUIRED (sama dengan QuantumAuth.sesiDitolak) — berarti sesi tidak
    // berlaku → hapus sesi (kedua penyimpanan — salinan basi di localStorage dulu membuat putaran
    // login tanpa akhir), beri alasan, lalu ke login. Gangguan server (5xx), 401 lain, atau jaringan
    // → pertahankan akses optimistis. Bila paket diturunkan → cukup kunci area berbayar.
    fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ type: 'verify_token' })
    }).then(function(r){
        return r.json().catch(function(){ return null; }).then(function(d){ return { http: r.status, d: d }; });
    }).then(function(h){
        var d = h.d;
        var sah = h.http >= 200 && h.http < 300 && d && d.status === 'success' && d.data && d.data.role;
        var kode = (d && d.code) || null;
        var ditolak = h.http === 401 && (kode === 'AUTH_REQUIRED' || kode === '2FA_REQUIRED');
        kabarSesi({ sah: !!sah, http: h.http, ditolak: ditolak, kode: kode });
        if (ditolak) {
            try {
                if (typeof QuantumAuth !== 'undefined' && QuantumAuth.hapusSesi) QuantumAuth.hapusSesi();
                else ['qi_token', 'qi_user', 'qi_user_name'].forEach(function(k){ localStorage.removeItem(k); sessionStorage.removeItem(k); });
            } catch(e) {}
            keLogin(kode === '2FA_REQUIRED' ? 'dua_langkah' : 'sesi_berakhir');
            return;
        }
        if (!sah) return;
        const peranServer = qiNormalisasiPeran(d.data.role);
        if (peranServer !== window.QI_PERAN) {
            window.QI_PERAN = peranServer;
            if (typeof window.QI_TERAPKAN_AKSES === 'function') window.QI_TERAPKAN_AKSES();
        }
    }).catch(function(){
        // Gangguan jaringan → pertahankan akses optimistis (jangan kunci pengguna
        // yang sah hanya karena jaringan bermasalah).
        kabarSesi({ sah: false, http: 0, ditolak: false, kode: null });
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
