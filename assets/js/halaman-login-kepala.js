// Skrip kepala login.html — dimuat SINKRON di <head> supaya <html> sudah bertanda sebelum
// halaman tergambar (tanpa kode inline; CSP tanpa 'unsafe-inline'). Aturannya di qim-masuk.css:
//   data-qm-sesi="ada"  → token tersimpan: formulir disembunyikan, kartu "Anda masih masuk" tampil
//                          (halaman-login.js lalu memeriksa token itu ke server; 401 → formulir kembali).
//   data-qm-tab="email" → datang dari halaman daftar: tab email langsung terbuka, tanpa kedip tab lisensi.
(function () {
    var akar = document.documentElement;
    try {
        if (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token')) akar.setAttribute('data-qm-sesi', 'ada');
    } catch (e) {
        try { if (sessionStorage.getItem('qi_token')) akar.setAttribute('data-qm-sesi', 'ada'); } catch (e2) {}
    }
    try {
        if (sessionStorage.getItem('qi_prefill_email')) akar.setAttribute('data-qm-tab', 'email');
    } catch (e) {}
})();
