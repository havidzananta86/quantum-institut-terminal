// Layar pemuat beranda (index.html). Dipindah dari <script> inline agar lolos CSP tanpa 'unsafe-inline'.
// Dimuat sinkron tepat setelah markup #qiLoader supaya animasinya mulai sebelum halaman selesai dimuat.
(function() {
    const bar = document.getElementById('qiLoaderBar');
    const txt = document.getElementById('qiLoaderText');
    const msgs = ['INITIALIZING','LOADING ENGINES','SCANNING MARKETS','READY'];
    let p = 0, mi = 0;
    const iv = setInterval(() => {
        p = Math.min(p + (mi < 3 ? 18 : 8), 100);
        bar.style.width = p + '%';
        if (p >= 30 && mi === 0) { mi=1; txt.textContent = msgs[1]; }
        if (p >= 60 && mi === 1) { mi=2; txt.textContent = msgs[2]; }
        if (p >= 85 && mi === 2) { mi=3; txt.textContent = msgs[3]; }
        if (p >= 100) clearInterval(iv);
    }, 40);
    window.addEventListener('load', () => {
        bar.style.width = '100%';
        const l = document.getElementById('qiLoader');
        l.style.opacity = '0';
        setTimeout(() => l.style.display = 'none', 300);
    });
})();
