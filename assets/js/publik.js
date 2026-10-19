// Perilaku kecil bersama halaman publik (assets/css/publik.css). Halaman tetap berfungsi tanpa skrip ini:
// menu ponsel memakai <details> asli. Di sini hanya: tutup menu saat klik di luar / tombol Esc / memilih tautan.
(function () {
    'use strict';
    var menu = document.querySelector('.pb-menu');
    if (!menu) return;
    var tutup = function () { if (menu.open) menu.open = false; };
    document.addEventListener('click', function (e) {
        if (!menu.open) return;
        if (!menu.contains(e.target) || e.target.closest('.pb-menu-panel a')) tutup();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.open) { tutup(); var s = menu.querySelector('summary'); if (s) s.focus(); }
    });
})();
