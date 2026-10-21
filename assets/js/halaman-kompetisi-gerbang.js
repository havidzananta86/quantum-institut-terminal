// Gerbang akses PRO/VIP untuk Arena Kompetisi (kompetisi.html) — dipisah dari markup supaya
// lolos CSP tanpa 'unsafe-inline'. Dimuat sinkron tepat setelah markup gerbang supaya
// pengalihan ke login terjadi sedini mungkin.
//
// Ini HANYA kenyamanan tampilan. Hak yang sesungguhnya ditegakkan server:
// api/paper-trading.php → qi_require_level('pro'), api/competition.php → qi_require_auth().
(function () {
    var token = null, userData = null;
    try {
        token = (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken) ? QuantumAuth.getToken()
              : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        var raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
        userData = raw ? JSON.parse(raw) : null;
    } catch (e) {}

    // VIP dan admin juga berhak (server: qi_require_level('pro') menerima pro, vip, admin).
    var isPro = userData && ['pro', 'vip', 'admin'].indexOf(String(userData.role || '').toLowerCase()) !== -1;
    if (!token) {
        try { sessionStorage.setItem('qi_redirect_after_login', 'kompetisi.html'); } catch (e) {}
        window.location.replace('login.html');
        return;
    }
    if (!isPro) {
        document.getElementById('gateLoading').classList.add('hidden');
        document.getElementById('gateUpgrade').classList.remove('hidden');
        return;
    }
    document.getElementById('qiAccessGate').style.display = 'none';

    // Peran di localStorage bisa basi (paket berubah / sesi lama). Diperiksa ulang ke server.
    fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ type: 'verify_token' })
    }).then(function (r) { return r.json(); }).then(function (d) {
        var role = d.data && d.data.role;
        if (d.status !== 'success' || ['pro', 'vip', 'admin'].indexOf(String(role || '').toLowerCase()) === -1) {
            document.getElementById('qiAccessGate').style.display = 'flex';
            document.getElementById('gateLoading').classList.add('hidden');
            document.getElementById('gateUpgrade').classList.remove('hidden');
        }
    }).catch(function () { /* jaringan gagal → biarkan halaman jalan; server tetap menolak bila tidak berhak */ });
})();

// Pengganti onclick="…" pada tautan login: kembali ke arena setelah masuk.
(function () {
    var a = document.getElementById('gateLoginLink');
    if (a) a.addEventListener('click', function () {
        try { sessionStorage.setItem('qi_redirect_after_login', 'kompetisi.html'); } catch (e) {}
    });
})();
