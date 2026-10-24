/**
 * Gerbang sesi untuk dashboard.html + pemeriksaan keberadaan vendor terminal.
 *
 * Dipisah dari dashboard.html supaya halaman tetap bebas kode inline: CSP ketat
 * Report-Only (.htaccess) melaporkan setiap <script> inline, dan tests/csp-inline.test.js
 * menjaganya. Isinya sama persis dengan versi inline sebelumnya.
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

        function goLogin() {
            try { sessionStorage.setItem('qi_redirect_after_login', 'dashboard.html'); } catch (e) {}
            if (error) error.style.display = 'grid';
            if (frame) frame.style.visibility = 'hidden';
            window.setTimeout(function () { window.location.replace('login.html'); }, 250);
        }

        var currentToken = token();
        if (!currentToken) {
            goLogin();
            return;
        }

        if (frame) frame.addEventListener('load', function () {
            if (loading) loading.style.display = 'none';
        }, { once: true });

        fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify({ type: 'verify_token', token: currentToken }),
            cache: 'no-store'
        }).then(function (response) {
            if (!response.ok) throw new Error('session verification failed');
            return response.json();
        }).then(function (data) {
            if (!data || data.status !== 'success') goLogin();
        }).catch(function () {
            // Temporary network issues do not interrupt an existing local session.
        });
    })();

/**
 * Terminal ini adalah iframe ke quantum-terminal/embed/ — berkas vendor TradeCanvas
 * yang TIDAK ikut di repo (lihat .gitignore). Tanpa pemeriksaan ini, folder yang
 * tidak ada hanya memunculkan halaman 404 vendor di dalam frame sementara lapisan
 * "Memuat Quantum Terminal…" hilang, sehingga tampak seperti chart yang rusak
 * tanpa sebab. Katakan terus terang apa yang kurang.
 */
(function () {
    'use strict';
    var frame = document.getElementById('quantumTerminalFrame');
    var loading = document.getElementById('terminalLoading');
    var error = document.getElementById('terminalError');
    if (!frame || !error) return;

    fetch('quantum-terminal/embed/', { method: 'HEAD', cache: 'no-store' })
        .then(function (r) {
            if (r.ok) return;
            if (loading) loading.style.display = 'none';
            frame.style.visibility = 'hidden';
            error.textContent = 'Mesin chart (quantum-terminal/embed/) belum terpasang di server ini. '
                + 'Terminal tidak bisa tampil sampai berkasnya disediakan.';
            error.style.display = 'grid';
        })
        .catch(function () { /* jaringan putus: biarkan iframe mencoba sendiri */ });
})();
