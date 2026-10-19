// Gerbang login halaman profil (profile.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
// Dimuat sinkron tepat setelah markup #qiProfileGate.
(function() {
    var token = null;
    try {
        token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
            ? QuantumAuth.getToken()
            : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
    } catch(e) {}
    if (!token) {
        try { sessionStorage.setItem('qi_redirect_after_login', 'profile.html'); } catch(e) {}
        window.location.replace('login.html');
    } else {
        document.getElementById('qiProfileGate').style.display = 'none';
    }
})();
