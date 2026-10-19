// Skrip halaman Install Aplikasi (pwa.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
function showPlatform(name) {
    ['android','ios','pc'].forEach(p => {
        document.getElementById('tab-' + p)?.classList.toggle('active', p === name);
        const c = document.getElementById('content-' + p);
        if (c) c.classList.toggle('active', p === name);
    });
}

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline').
document.querySelectorAll('[data-platform]').forEach(btn => {
    btn.addEventListener('click', () => showPlatform(btn.dataset.platform));
});
