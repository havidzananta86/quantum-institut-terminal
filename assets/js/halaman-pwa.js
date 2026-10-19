// Skrip halaman Pasang Aplikasi (pwa.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').
function showPlatform(name) {
    ['android', 'ios', 'pc'].forEach(p => {
        const tab = document.getElementById('tab-' + p);
        if (tab) tab.setAttribute('aria-selected', String(p === name));
        const c = document.getElementById('content-' + p);
        if (c) c.hidden = p !== name;
    });
}

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline').
document.querySelectorAll('[data-platform]').forEach(btn => {
    btn.addEventListener('click', () => showPlatform(btn.dataset.platform));
});

// Buka tab yang cocok dengan perangkat pengunjung (perkiraan dari user agent; tetap bisa dipilih manual).
(function () {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) showPlatform('ios');
    else if (!/Android/i.test(ua) && !/Mobi/i.test(ua)) showPlatform('pc');
})();
