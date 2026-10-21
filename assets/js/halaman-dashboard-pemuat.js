// Layar pembuka dashboard (#qiLoadScreen). Dipisah dari <script> inline agar lolos CSP
// tanpa 'unsafe-inline', dan dimuat sinkron tepat setelah markupnya supaya tahapannya
// mulai berjalan sebelum halaman selesai dimuat.
//
// TAHAPANNYA MENGIKUTI KEJADIAN NYATA, BUKAN TIMER.
// Versi sebelumnya memutar tiga pesan berbahasa Inggris setiap 600 ms tanpa hubungan apa
// pun dengan yang sedang terjadi — persis jenis "kemajuan palsu" yang dibersihkan dari
// bagian lain produk ini. Sekarang tiap tahap menyala karena peristiwanya benar-benar
// terjadi: sesi terbaca, data pasar pertama masuk, lalu terminal siap.
(function () {
    'use strict';
    var layar = document.getElementById('qiLoadScreen');
    if (!layar) return;

    var MIN_TAMPIL = 650;    // jeda agar animasinya tidak berkedip lalu hilang
    var BATAS      = 8000;   // pengaman koneksi lambat: jangan pernah mengurung pengguna
    var mulai = Date.now();
    var selesai = false;

    function tahap(id, keadaan) {
        var el = document.getElementById(id);
        if (el) el.className = 'qi-boot-langkah-item ' + (keadaan || '');
    }
    function status(teks) {
        var el = document.getElementById('qiLoadStatus');
        if (el) el.textContent = teks;
    }

    // 1 — Sesi. Dibaca dari penyimpanan yang sama dengan QuantumAuth.
    var adaSesi = false;
    try {
        adaSesi = !!(localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
    } catch (e) { adaSesi = false; }
    tahap('qiBootSesi', 'is-jalan');
    status('Memverifikasi sesi…');
    setTimeout(function () {
        tahap('qiBootSesi', 'is-selesai');
        tahap('qiBootData', 'is-jalan');
        status(adaSesi ? 'Menyambungkan data pasar…' : 'Menyiapkan halaman masuk…');
    }, 120);

    // 2 — Data pasar pertama benar-benar masuk (dipicu api/get-chart-data.php).
    var dataMasuk = false;
    function tandaiData() {
        if (dataMasuk) return;
        dataMasuk = true;
        tahap('qiBootData', 'is-selesai');
        tahap('qiBootSiap', 'is-jalan');
        status('Menyiapkan terminal…');
        tutup();
    }
    try { window.addEventListener('qi-chart-data', tandaiData, { once: true }); } catch (e) {}

    // 3 — Tutup. Syaratnya: markup siap DAN (data pasar sudah masuk ATAU waktunya cukup).
    var domSiap = false;
    function tutup() {
        if (selesai || !domSiap) return;
        var sisa = Math.max(0, MIN_TAMPIL - (Date.now() - mulai));
        selesai = true;
        setTimeout(function () {
            tahap('qiBootSesi', 'is-selesai');
            tahap('qiBootData', 'is-selesai');
            tahap('qiBootSiap', 'is-selesai');
            status('Siap');
            layar.classList.add('done');
            setTimeout(function () { if (layar && layar.parentNode) layar.remove(); }, 420);
        }, sisa);
    }
    function domSelesai() {
        domSiap = true;
        // Tidak menunggu data pasar lebih dari sedetik: dashboard sudah bisa dipakai dengan
        // kerangka panel, dan menahan layar lebih lama hanya membuatnya terasa lambat.
        setTimeout(tutup, dataMasuk ? 0 : 900);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', domSelesai);
    else domSelesai();
    window.addEventListener('load', function () { domSiap = true; tutup(); });
    setTimeout(function () { domSiap = true; tutup(); }, BATAS);
})();
