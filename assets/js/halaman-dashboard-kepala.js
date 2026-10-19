// Font dashboard tidak memblokir tampilan pertama: <link rel="preload" as="style" data-qi-gaya-tunda> mengunduhnya
// paralel, lalu di sini dipasang sebagai stylesheet. Dulu lewat onload="this.rel='stylesheet'" yang dilarang CSP
// tanpa 'unsafe-inline'. Stylesheet yang disisipkan skrip tidak memblokir render, dan memakai hasil preload
// (atau menumpang unduhannya yang masih berjalan) sehingga tidak diunduh dua kali.
(function () {
    document.querySelectorAll('link[data-qi-gaya-tunda]').forEach(function (l) {
        var g = document.createElement('link');
        g.rel = 'stylesheet';
        g.href = l.href;
        l.after(g);
    });
})();
