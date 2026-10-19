// Skrip Pusat bantuan (bantuan.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').
// 1) Tautan ke #pertanyaan (mis. login.html → bantuan.html#lupa-sandi) membuka jawabannya.
// 2) Pencarian sederhana di peramban: menyaring pertanyaan menurut teks pertanyaan + jawaban.
(function () {
    'use strict';

    function bukaDariHash() {
        var id = decodeURIComponent((location.hash || '').slice(1));
        if (!id) return;
        var el = document.getElementById(id);
        if (el && el.tagName === 'DETAILS') {
            el.open = true;
            el.scrollIntoView({ block: 'start' });
        }
    }
    bukaDariHash();
    window.addEventListener('hashchange', bukaDariHash);

    var input = document.getElementById('cariBantuan');
    var hasil = document.getElementById('cariHasil');
    var kosong = document.getElementById('cariKosong');
    if (!input) return;
    var tanya = Array.prototype.slice.call(document.querySelectorAll('.pb-tanya-grup .pb-tanya'));
    var grup = Array.prototype.slice.call(document.querySelectorAll('.pb-tanya-grup'));
    var normal = function (s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    var teks = tanya.map(function (d) { return normal(d.textContent); });

    input.addEventListener('input', function () {
        var kata = normal(input.value).split(/\s+/).filter(Boolean);
        var cocok = 0;
        tanya.forEach(function (d, i) {
            var ya = kata.every(function (k) { return teks[i].indexOf(k) !== -1; });
            d.hidden = !ya;
            if (kata.length) d.open = ya && cocok < 3;      // buka beberapa hasil teratas
            if (ya) cocok++;
        });
        grup.forEach(function (g) {
            // Bagian Kontak tidak berisi pertanyaan: tetap tampil.
            var isi = g.querySelectorAll('.pb-tanya');
            if (isi.length) g.hidden = !Array.prototype.some.call(isi, function (d) { return !d.hidden; });
        });
        if (!kata.length) {
            tanya.forEach(function (d) { d.open = false; });
            hasil.textContent = '';
        } else {
            hasil.textContent = cocok ? cocok + ' pertanyaan cocok.' : '';
        }
        kosong.hidden = !(kata.length && !cocok);
    });
})();
