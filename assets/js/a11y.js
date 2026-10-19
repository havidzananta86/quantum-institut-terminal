/**
 * Fondasi aksesibilitas untuk aplikasi Quantum Institut.
 *
 * Sifatnya PROGRESIF dan TIDAK mengubah tata letak: seluruh pekerjaan di sini
 * hanya menambah atribut ARIA, dukungan keyboard, perangkap fokus untuk dialog,
 * dan tautan "lewati ke konten". Semua dibungkus try/catch supaya kegagalan di
 * sini tidak pernah menghentikan fitur lain di halaman.
 *
 * Yang dikerjakan:
 *   1. Sidebar panel diperlakukan sebagai tablist (role/aria-selected/aria-controls)
 *      + navigasi panah kiri/kanan/atas/bawah antar tab.
 *   2. Elemen <div>/<span> yang bisa diklik (data-qi-aksi, atau onclick di halaman lama) diberi peran button,
 *      bisa difokus & dioperasikan keyboard.
 *   3. Dialog modal (role="dialog" aria-modal="true") mendapat perangkap fokus,
 *      dan fokus dikembalikan ke elemen pemicu setelah dialog tertutup.
 *   4. Tautan "lewati ke konten utama" untuk pengguna keyboard.
 */
(function () {
    'use strict';

    // Idempoten: kalau berkas ini termuat dua kali, jangan pasang dua kali.
    if (window.__qiA11yReady) return;
    window.__qiA11yReady = true;

    var fokusSebelumDialog = null;

    function aman(fn) {
        try { fn(); } catch (e) { if (window.console && console.warn) console.warn('[QI a11y] dilewati:', e); }
    }

    function saatSiap(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    // ── 1. Sidebar panel sebagai tablist ────────────────────────────────────
    function siapkanTabPanel() {
        var tombol = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'));
        if (!tombol.length) return;

        var nav = tombol[0].parentElement;
        if (nav && !nav.getAttribute('role')) {
            nav.setAttribute('role', 'tablist');
            nav.setAttribute('aria-label', 'Navigasi panel');
        }

        tombol.forEach(function (btn) {
            var id = btn.getAttribute('data-panel');
            if (!id) return;
            var panel = document.getElementById(id);
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-controls', id);
            if (panel) {
                if (!btn.id) btn.id = 'qiTab-' + id;
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', btn.id);
                if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
            }
            // Panah untuk berpindah tab (pola ARIA tablist).
            btn.addEventListener('keydown', function (ev) {
                var k = ev.key;
                if (k !== 'ArrowDown' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowLeft') return;
                var maju = (k === 'ArrowDown' || k === 'ArrowRight');
                // Lewati tab yang sedang disembunyikan filter pencarian panel —
                // memfokuskan elemen tak terlihat membingungkan pengguna keyboard.
                var terlihat = tombol.filter(tabTerlihat);
                var daftar = terlihat.length ? terlihat : tombol;
                var idx = daftar.indexOf(btn);
                var berikut = idx < 0
                    ? daftar[0]
                    : daftar[(idx + (maju ? 1 : -1) + daftar.length) % daftar.length];
                if (berikut) {
                    ev.preventDefault();
                    berikut.focus();
                    if (typeof berikut.click === 'function') berikut.click();
                }
            });
        });

        sinkronkanTab();
    }

    // Tab dianggap terlihat bila tidak disembunyikan (mis. oleh filter pencarian panel).
    function tabTerlihat(btn) {
        if (!btn) return false;
        if (btn.hasAttribute && btn.hasAttribute('hidden')) return false;
        if (btn.style && btn.style.display === 'none') return false;
        if (btn.offsetParent === null && btn.getClientRects && btn.getClientRects().length === 0) return false;
        return true;
    }

    // Menandai tab aktif. tabindex mengikuti pola roving (hanya tab aktif di urutan Tab)
    // supaya pengguna keyboard tidak terjebak menekan Tab 32 kali. Bila tab aktif sedang
    // disembunyikan filter, tab terlihat pertama yang mengambil alih urutan Tab.
    function sinkronkanTab() {
        var semua = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'));
        semua.forEach(function (btn) {
            var aktif = btn.classList.contains('active');
            btn.setAttribute('aria-selected', aktif ? 'true' : 'false');
            btn.setAttribute('tabindex', '-1');
        });
        var fokus = null;
        for (var i = 0; i < semua.length && !fokus; i++) if (semua[i].classList.contains('active') && tabTerlihat(semua[i])) fokus = semua[i];
        for (var j = 0; j < semua.length && !fokus; j++) if (tabTerlihat(semua[j])) fokus = semua[j];
        if (fokus) fokus.setAttribute('tabindex', '0');
    }

    // switchPanel dipanggil dari banyak tempat; kita bungkus agar aria ikut tersinkron
    // tanpa menyentuh fungsi aslinya.
    function bungkusSwitchPanel() {
        if (typeof window.switchPanel !== 'function' || window.switchPanel.__qiA11y) return;
        var asli = window.switchPanel;
        var dijadwalkan = false;
        var terbungkus = function () {
            var hasil = asli.apply(this, arguments);
            // Ditunda ke frame berikutnya (digabung): sinkronkanTab membaca tata letak, dan memanggilnya
            // langsung di tengah pergantian panel memaksa hitung ulang layout berkali-kali saat muat.
            if (!dijadwalkan) {
                dijadwalkan = true;
                (window.requestAnimationFrame || setTimeout)(function () {
                    dijadwalkan = false;
                    aman(sinkronkanTab);
                    // Panel yang baru dirender memuat emoji baru — tandai lagi (sekali per pindah panel).
                    aman(tandaiEmojiDekoratif);
                });
            }
            return hasil;
        };
        terbungkus.__qiA11y = true;
        window.switchPanel = terbungkus;
    }

    // ── 2. Elemen div/span ber-data-qi-aksi / ber-onclick → dapat dioperasikan keyboard ────────
    function siapkanKlikKeyboard() {
        var kandidat = document.querySelectorAll('div[data-qi-aksi], span[data-qi-aksi], div[onclick], span[onclick]');
        Array.prototype.forEach.call(kandidat, function (el) {
            if (el.hasAttribute('data-qi-kbd')) return;
            el.setAttribute('data-qi-kbd', '1');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            if (!el.getAttribute('role')) el.setAttribute('role', 'button');
            el.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
                    ev.preventDefault();
                    el.click();
                }
            });
        });
    }

    // ── 3. Dialog modal: perangkap fokus + kembalikan fokus ────────────────
    var SELEKTOR_DIALOG = '[role="dialog"][aria-modal="true"], [role="alertdialog"]';

    /**
     * Dialog dianggap TERBUKA hanya bila benar-benar terlihat. Ini penting sebelum
     * skrip dipakai di banyak halaman: banyak dialog disembunyikan dengan opacity-0 /
     * pointer-events-none (bukan display:none), dan tanpa pemeriksaan ini perangkap
     * fokus akan mengurung pengguna di elemen yang tak terlihat.
     */
    function terlihat(el) {
        if (!el || el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
        var gaya = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (gaya) {
            if (gaya.display === 'none' || gaya.visibility === 'hidden' || gaya.visibility === 'collapse') return false;
            if (gaya.opacity !== undefined && gaya.opacity !== '' && parseFloat(gaya.opacity) === 0) return false;
            if (gaya.pointerEvents === 'none') return false;
        }
        if (typeof el.getBoundingClientRect === 'function') {
            var kotak = el.getBoundingClientRect();
            if (kotak && kotak.width === 0 && kotak.height === 0) return false;
        }
        return true;
    }

    function dialogTerbuka() {
        var daftar = document.querySelectorAll(SELEKTOR_DIALOG);
        for (var i = 0; i < daftar.length; i++) {
            if (terlihat(daftar[i])) return daftar[i];
        }
        return null;
    }

    function bisaDifokus(akar) {
        var selektor = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.prototype.filter.call(akar.querySelectorAll(selektor), function (el) {
            return el.offsetParent !== null || el === document.activeElement;
        });
    }

    function tanganiTombolTab(ev) {
        if (ev.key !== 'Tab') return;
        var dialog = dialogTerbuka();
        if (!dialog) return;
        var fokus = bisaDifokus(dialog);
        if (!fokus.length) {
            ev.preventDefault();
            if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
            dialog.focus();
            return;
        }
        var pertama = fokus[0];
        var terakhir = fokus[fokus.length - 1];
        if (ev.shiftKey && document.activeElement === pertama) {
            ev.preventDefault(); terakhir.focus();
        } else if (!ev.shiftKey && document.activeElement === terakhir) {
            ev.preventDefault(); pertama.focus();
        } else if (!dialog.contains(document.activeElement)) {
            ev.preventDefault(); pertama.focus();
        }
    }

    // Saat dialog muncul, simpan elemen fokus sebelumnya; saat hilang, kembalikan.
    function pantauDialog() {
        if (!window.MutationObserver) return;
        // Halaman ini mengubah class/style ratusan kali per menit (tick harga). Dulu SETIAP perubahan
        // memicu getComputedStyle pada dialog (hitung ulang gaya paksa) — ±0,6 dtk CPU saat muat di HP
        // dan baterai terkuras. Sekarang hanya perubahan yang menyentuh dialog (atau leluhurnya) yang
        // diperiksa, paling sering sekali per frame.
        var tertunda = false;
        var relevan = function (catatan) {
            if (fokusSebelumDialog) return true;   // ada dialog terbuka: tunggu ia tertutup
            var dialogs = document.querySelectorAll(SELEKTOR_DIALOG);
            if (!dialogs.length) return false;
            for (var i = 0; i < catatan.length; i++) {
                var t = catatan[i].target;
                if (!t || t.nodeType !== 1) continue;
                for (var j = 0; j < dialogs.length; j++) {
                    if (t === dialogs[j] || t.contains(dialogs[j])) return true;
                }
            }
            return false;
        };
        var observer = new MutationObserver(function (catatan) {
            if (tertunda || !relevan(catatan)) return;
            tertunda = true;
            (window.requestAnimationFrame || setTimeout)(function () { tertunda = false; periksaDialog(); });
        });
        function periksaDialog() {
            var dialog = dialogTerbuka();
            if (dialog && !dialog.__qiFokus) {
                dialog.__qiFokus = true;
                fokusSebelumDialog = document.activeElement;
                var fokus = bisaDifokus(dialog);
                if (fokus.length) aman(function () { fokus[0].focus(); });
            } else if (!dialog && fokusSebelumDialog) {
                var target = fokusSebelumDialog;
                fokusSebelumDialog = null;
                aman(function () { if (target && target.focus) target.focus(); });
            }
        }
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }

    // ── 4. Tautan "lewati ke konten utama" ─────────────────────────────────
    function siapkanSkipLink() {
        // Jangan menyisipkan bila halaman SUDAH punya tautan lompat: index.html
        // memakai .skip-link dari tokens.css, dan dua tautan lompat membingungkan.
        if (document.querySelector('.skip-link, .qi-skip-link, a[href="#main"], a[href="#content"], a[href="#qiMainContent"]')) return;
        var utama = document.querySelector('main')
            || document.getElementById('panel-overview')
            || document.querySelector('.panel-content');
        if (!utama) return;
        if (!utama.id) utama.id = 'qiMainContent';
        if (!utama.hasAttribute('tabindex')) utama.setAttribute('tabindex', '-1');
        var tautan = document.createElement('a');
        tautan.className = 'qi-skip-link';
        tautan.href = '#' + utama.id;
        tautan.textContent = 'Lewati ke konten utama';
        document.body.insertBefore(tautan, document.body.firstChild);
    }

    // ── 5. Emoji hiasan tidak perlu dibacakan pembaca layar ───────────────
    // Pembaca layar mengumumkan emoji dengan nama aneh ("🎯" -> "direct hit") sehingga
    // ikon menghiasai teks justru mengganggu. Emoji di sini ditandai aria-hidden
    // TANPA mengubah tampilan sama sekali (hanya atribut).
    var POLA_EMOJI = /^(?:[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u20E3]|[\uD83C-\uDBFF][\uDC00-\uDFFF])+$/;

    function tandaiEmojiDekoratif() {
        var spans = document.querySelectorAll('span');
        Array.prototype.forEach.call(spans, function (el) {
            if (el.getAttribute('aria-hidden') === 'true') return;
            if (el.children.length) return;                       // hanya span berisi teks murni
            var teks = (el.textContent || '').trim();
            if (!teks || teks.length > 8 || !POLA_EMOJI.test(teks)) return;
            var induk = el.parentElement;
            if (!induk) return;
            // Bila emoji adalah SATU-SATUNYA isi kontrolnya dan tidak ada label,
            // JANGAN disembunyikan — kontrol itu akan kehilangan namanya.
            var label = induk.getAttribute('aria-label') || induk.getAttribute('title');
            var teksInduk = (induk.textContent || '').trim();
            if (!label && teksInduk.length <= teks.length + 1) return;
            el.setAttribute('aria-hidden', 'true');
        });
    }
    window.qiTandaiEmojiDekoratif = function () { aman(tandaiEmojiDekoratif); };

    saatSiap(function () {
        aman(siapkanTabPanel);
        aman(bungkusSwitchPanel);
        aman(siapkanKlikKeyboard);
        aman(siapkanSkipLink);
        aman(pantauDialog);
        aman(tandaiEmojiDekoratif);
        document.addEventListener('keydown', function (ev) { aman(function () { tanganiTombolTab(ev); }); }, true);
    });
})();
