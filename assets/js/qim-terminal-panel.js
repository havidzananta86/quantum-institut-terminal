/**
 * Menu halaman & panel Order di dashboard chart-penuh.
 *
 * Chart memenuhi seluruh layar, jadi dua hal yang dulu memakan ruang tetap dijadikan panel buka-tutup:
 *   · Menu  (#qtMenu)         — tautan ke Beranda, Arena, Kalender, Transparansi, Profil (dulu bar atas)
 *   · Order (#qimRightPanel)  — Quick Trade + pengaman posisi (dulu kolom permanen 332 px di kanan)
 * Keduanya tertutup bawaan. Esc menutup; klik di luar menu menutup menu; Signal Center, Menu, dan Order tidak
 * terbuka bersamaan. Pilihan terakhir panel Order diingat (localStorage 'qi_order_buka'); #order di URL membukanya.
 */
(function () {
    'use strict';
    var rail = document.getElementById('qimRightPanel');
    var orderBtn = document.getElementById('qtOrderLauncher');
    var orderTutup = document.getElementById('qtOrderClose');
    var menuBtn = document.getElementById('qtMenuBtn');
    var menu = document.getElementById('qtMenu');
    var signalTutup = document.getElementById('qtAssistClose');
    var KUNCI = 'qi_order_buka';

    function simpan(buka) { try { localStorage.setItem(KUNCI, buka ? '1' : '0'); } catch (e) {} }
    function dibaca() { try { return localStorage.getItem(KUNCI) === '1'; } catch (e) { return false; } }

    function aturMenu(buka) {
        if (!menu || !menuBtn) return;
        menu.hidden = !buka;
        menuBtn.setAttribute('aria-expanded', buka ? 'true' : 'false');
        if (buka) { var pertama = menu.querySelector('a'); if (pertama) pertama.focus(); }
    }

    function aturOrder(buka, ingat) {
        if (!rail || !orderBtn) return;
        rail.classList.toggle('is-open', buka);
        rail.setAttribute('aria-hidden', buka ? 'false' : 'true');
        orderBtn.classList.toggle('is-open', buka);
        orderBtn.setAttribute('aria-expanded', buka ? 'true' : 'false');
        if (ingat !== false) simpan(buka);
        if (buka) {
            aturMenu(false);
            // Signal Center menutup supaya dua panel tidak saling menimpa di layar sempit.
            var drawer = document.getElementById('qtAssistDrawer');
            if (drawer && drawer.classList.contains('is-open') && signalTutup) signalTutup.click();
            // Kartu Quick Trade menyegarkan harga/posisi begitu panelnya terlihat.
            try { window.dispatchEvent(new CustomEvent('qi-chart-data', { detail: { alasan: 'panel-order' } })); } catch (e) {}
        }
    }

    if (menuBtn && menu) {
        menuBtn.addEventListener('click', function () { aturMenu(menu.hidden); });
        document.addEventListener('click', function (e) {
            if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) aturMenu(false);
        });
    }
    if (orderBtn && rail) {
        orderBtn.addEventListener('click', function () { aturOrder(!rail.classList.contains('is-open')); });
        if (orderTutup) orderTutup.addEventListener('click', function () { aturOrder(false); orderBtn.focus(); });
        var launcherSignal = document.getElementById('qtAssistLauncher');
        // Membuka Signal Center menutup panel Order (tanpa mengubah pilihan tersimpan).
        if (launcherSignal) launcherSignal.addEventListener('click', function () { if (rail.classList.contains('is-open')) aturOrder(false, false); });
        // Awal: tertutup, kecuali pengguna terakhir membukanya di layar lebar, atau URL meminta #order.
        var minta = /(^|[#&])order($|&)/.test(location.hash);
        aturOrder(minta || (dibaca() && window.innerWidth > 1100), false);
    }
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (menu && !menu.hidden) { aturMenu(false); if (menuBtn) menuBtn.focus(); return; }
        if (rail && rail.classList.contains('is-open')) { aturOrder(false); if (orderBtn) orderBtn.focus(); }
    });
    window.QIMPanel = { aturOrder: aturOrder, aturMenu: aturMenu };
})();
