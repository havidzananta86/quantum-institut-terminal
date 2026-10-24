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

        /** Tautan dalam diingat utuh (?panel=…#…) supaya setelah login kembali ke tempat semula. */
        function tujuanSekarang() {
            return (location.pathname.split('/').pop() || 'dashboard.html') + location.search + location.hash;
        }

        /** Sesi ditolak server: token HARUS hilang dari KEDUA penyimpanan, bukan salah satu. */
        function hapusSesi() {
            try { localStorage.removeItem('qi_token'); localStorage.removeItem('qi_user'); } catch (e) {}
            try { sessionStorage.removeItem('qi_token'); sessionStorage.removeItem('qi_user'); } catch (e) {}
        }

        function goLogin(alasan) {
            try {
                sessionStorage.setItem('qi_redirect_after_login', tujuanSekarang());
                sessionStorage.setItem('qi_alasan_masuk', alasan || 'perlu_masuk');
            } catch (e) {}
            if (error) error.style.display = 'grid';
            if (frame) frame.style.visibility = 'hidden';
            window.setTimeout(function () { window.location.replace('login.html'); }, 250);
        }

        var currentToken = token();
        if (!currentToken) {
            goLogin('perlu_masuk');
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
            var http = response.status;
            return response.json().catch(function () { return null; }).then(function (data) {
                // 401 = server MENOLAK sesi. 503 = server tidak BISA memeriksanya (basis data
                // sedang tumbang) — itu bukan alasan mengeluarkan orang yang sedang bekerja.
                var sah = http === 200 && !!(data && data.status === 'success');
                var ditolak = http === 401;
                // Layar pembuka menandai tahap "Memverifikasi sesi" selesai dari kejadian ini
                // (assets/js/halaman-dashboard-pemuat.js). Dulu dikirim halaman-dashboard-awal.js,
                // yang terhapus bersama dashboard panel lama — tanpa ini tahap pertama tidak
                // pernah beranjak dari "menunggu".
                try {
                    window.dispatchEvent(new CustomEvent('qi-sesi', { detail: { sah: sah, ditolak: ditolak, http: http } }));
                } catch (e) {}
                if (ditolak) { hapusSesi(); goLogin('sesi_berakhir'); }
            });
        }).catch(function () {
            // Gangguan jaringan sesaat tidak memutus sesi lokal yang sudah ada, tetapi layar
            // pembuka tetap harus beranjak — kalau tidak, pengguna terkurung di tahap pertama.
            try { window.dispatchEvent(new CustomEvent('qi-sesi', { detail: { sah: true, http: 0 } })); } catch (e) {}
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
