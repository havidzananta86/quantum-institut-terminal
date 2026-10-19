// Layar pemuat dashboard (#qiLoadScreen). Dipindah dari <script> inline agar lolos CSP tanpa 'unsafe-inline'.
// Dimuat sinkron tepat setelah markup #qiLoadScreen supaya pesannya mulai berganti sebelum halaman selesai dimuat.
(function(){
    var msgs = ['Connecting to data feeds…','Loading market modules…','Preparing interface…'];
    var el = document.getElementById('qiLoadStatus'), idx = 0;
    var iv = setInterval(function(){ if(el && idx < msgs.length) el.textContent = msgs[idx++]; }, 600);
    // Layar pembuka TIDAK lagi menunggu window.load (yang menunggu semua font/skrip/gambar):
    // ditutup begitu HTML & skrip siap — konten yang belum ada diisi kerangka (skeleton).
    var selesai = false;
    function tutup(){
        if (selesai) return; selesai = true;
        clearInterval(iv);
        if(el) el.textContent = 'Ready';
        var ls = document.getElementById('qiLoadScreen');
        if(ls) ls.classList.add('done');
        setTimeout(function(){ if(ls) ls.remove(); }, 450);
    }
    document.addEventListener('DOMContentLoaded', tutup);
    window.addEventListener('load', tutup);
    // Pengaman koneksi sangat lambat. Tidak dibuat lebih pendek: sebelum skrip siap, HTML masih
    // menampilkan panel bawaan (Market Overview) lalu meloncat ke panel tujuan — membingungkan.
    setTimeout(tutup, 8000);
})();
