// Gerbang admin (admin.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
// Dimuat sinkron tepat setelah markup #qiAdminGate. Ini hanya tampilan; otorisasi sebenarnya di server (qi_require_admin).
(function() {
    var token = null, userData = null;
    try {
        token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
            ? QuantumAuth.getToken()
            : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        var raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        userData = raw ? JSON.parse(raw) : null;
    } catch(e) {}
    if (!token) {
        try { sessionStorage.setItem('qi_redirect_after_login', 'admin.html'); } catch(e) {}
        window.location.replace('login.html'); return;
    }
    if (!userData || userData.role !== 'admin') {
        document.getElementById('adminGateLoading').classList.add('hidden');
        document.getElementById('adminGateDenied').classList.remove('hidden');
        return;
    }
    document.getElementById('qiAdminGate').style.display = 'none';
})();
