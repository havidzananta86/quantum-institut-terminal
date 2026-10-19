// Gerbang akses PRO kalender ekonomi (economic-calendar.html) — dulu <script> inline, dipindah agar lolos CSP
// tanpa 'unsafe-inline'. Dimuat sinkron tepat setelah markup gerbang supaya pengalihan ke login terjadi sedini mungkin.
(function() {
    var token = null, userData = null;
    try {
        token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken) ? QuantumAuth.getToken()
              : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        var raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        userData = raw ? JSON.parse(raw) : null;
    } catch(e) {}
    var isPro = userData && (userData.role === 'pro' || userData.role === 'admin');
    if (!token) { try{sessionStorage.setItem('qi_redirect_after_login','economic-calendar.html');}catch(e){} window.location.replace('login.html'); return; }
    if (!isPro) {
        document.getElementById('gateLoading').classList.add('hidden');
        document.getElementById('gateUpgrade').classList.remove('hidden');
        return;
    }
    document.getElementById('qiAccessGate').style.display = 'none';
    fetch('api/auth.php', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({type:'verify_token'})
    }).then(function(r){return r.json();}).then(function(d){
        var role = d.data && d.data.role;
        if (d.status !== 'success' || (role !== 'pro' && role !== 'admin')) {
            document.getElementById('qiAccessGate').style.display = 'flex';
            document.getElementById('gateLoading').classList.add('hidden');
            document.getElementById('gateUpgrade').classList.remove('hidden');
        }
    }).catch(function(){});
})();

// Pengganti onclick="..." di tautan "Login di sini": kembali ke kalender setelah login.
(function() {
    var a = document.getElementById('gateLoginLink');
    if (a) a.addEventListener('click', function() { try { sessionStorage.setItem('qi_redirect_after_login', 'economic-calendar.html'); } catch (e) {} });
})();
