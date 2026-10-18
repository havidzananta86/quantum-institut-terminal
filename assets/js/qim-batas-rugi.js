/* ═══════════════════════════════════════════════════════════════════════════
   QIM BATAS RUGI HARIAN — meteran di panel Paper Trading.

   Server (api/_batas_rugi.php) menolak posisi simulasi BARU setelah rugi terealisasi hari ini
   mencapai batas di Profil Risiko (bawaan 3% saldo awal hari, reset 00:00 WIB). Modul ini hanya
   menampilkan statusnya: batang pemakaian, peringatan di 80%, dan spanduk saat batas tercapai.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    const uang = v => (v < 0 ? '-$' : '$') + Math.abs(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /** Status server → { tingkat: 'aman'|'waspada'|'tercapai', lebar, judul, rincian } (murni, bisa diuji). */
    function ringkas(s) {
        if (!s || typeof s !== 'object') return null;
        const terpakai = Math.max(0, Math.min(100, Number(s.terpakai_pct) || 0));
        const tingkat = s.tercapai ? 'tercapai' : (s.peringatan ? 'waspada' : 'aman');
        const judul = tingkat === 'tercapai' ? 'Batas rugi harian tercapai — posisi baru dikunci sampai besok 00:00 WIB'
            : tingkat === 'waspada' ? 'Hati-hati: ' + Math.round(terpakai) + '% batas rugi harian terpakai'
            : 'Batas rugi harian';
        const pct = Number(s.batas_pct) || 0;
        const rincian = 'Rugi hari ini ' + uang(Number(s.rugi_hari) || 0) + ' dari batas ' + uang(Number(s.batas_usd) || 0)
            + ' (' + pct + '% saldo awal hari) · sisa ' + uang(Number(s.sisa_usd) || 0);
        return { tingkat, lebar: terpakai, judul, rincian };
    }

    const api = { ringkas };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (!root || typeof document === 'undefined') return;
    root.QimBatasRugi = api;

    const CSS = '.qbr{margin:0 0 .25rem;padding:.6rem .9rem;border:1px solid var(--qbr-g,#1e293b);border-radius:.75rem;background:rgba(15,23,42,.6)}'
        + '.qbr[data-t=waspada]{--qbr-g:rgba(245,158,11,.55)}.qbr[data-t=tercapai]{--qbr-g:rgba(239,68,68,.65);background:rgba(127,29,29,.25)}'
        + '.qbr-j{font-size:11px;font-weight:600;color:#e2e8f0}.qbr[data-t=waspada] .qbr-j{color:#fbbf24}.qbr[data-t=tercapai] .qbr-j{color:#fca5a5}'
        + '.qbr-b{height:6px;border-radius:999px;background:#1e293b;margin:.4rem 0;overflow:hidden}'
        + '.qbr-i{height:100%;border-radius:999px;background:#22d3ee;transition:width .4s}.qbr[data-t=waspada] .qbr-i{background:#f59e0b}.qbr[data-t=tercapai] .qbr-i{background:#ef4444}'
        + '.qbr-r{font-size:10px;color:#94a3b8;font-family:ui-monospace,monospace}';

    let kotak = null, terakhirTingkat = null;

    function pasang() {
        if (kotak) return kotak;
        const bar = document.getElementById('ptBalance');
        const kartu = bar && bar.closest('.bg-qi-card');
        if (!kartu || !kartu.parentNode) return null;
        const st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        kotak = document.createElement('div');
        kotak.id = 'batasRugiMeter';
        kotak.className = 'qbr';
        kotak.setAttribute('role', 'status');
        kotak.hidden = true;
        kotak.innerHTML = '<div class="qbr-j"></div><div class="qbr-b"><div class="qbr-i"></div></div><div class="qbr-r"></div>';
        kartu.parentNode.insertBefore(kotak, kartu.nextSibling);
        return kotak;
    }

    function tampil(s) {
        const r = ringkas(s);
        const el = pasang();
        if (!r || !el) return;
        el.hidden = false;
        el.dataset.t = r.tingkat;
        el.querySelector('.qbr-j').textContent = r.judul;
        el.querySelector('.qbr-i').style.width = r.lebar + '%';
        el.querySelector('.qbr-r').textContent = r.rincian;
        // Beri tahu sekali saat tingkatnya naik (bukan tiap penyegaran).
        if (terakhirTingkat !== null && terakhirTingkat !== r.tingkat && r.tingkat !== 'aman' && typeof root.showQuantumToast === 'function') {
            root.showQuantumToast(r.judul, r.tingkat === 'tercapai' ? 'error' : 'warning', 7000);
        }
        terakhirTingkat = r.tingkat;
    }

    async function muat() {
        try {
            const headers = (root.QuantumAuth && root.QuantumAuth.authHeaders) ? root.QuantumAuth.authHeaders() : {};
            const res = await fetch('api/batas-rugi.php', { cache: 'no-store', headers });
            if (!res.ok) return;
            const d = await res.json();
            if (d && d.status === 'success') tampil(d.batas_rugi);
        } catch (e) { /* meteran tersembunyi bila belum login / offline */ }
    }

    function mulai() {
        muat();
        setInterval(() => { if (!document.hidden) muat(); }, 45000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) muat(); });
        // Segarkan setelah posisi disimpan/ditutup (ptLoadFromServer dipanggil setiap selesai simpan).
        if (typeof root.ptLoadFromServer === 'function') {
            const asli = root.ptLoadFromServer;
            root.ptLoadFromServer = async function () { try { return await asli.apply(this, arguments); } finally { muat(); } };
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
})(typeof window !== 'undefined' ? window : null);
