/* ═══════════════════════════════════════════════════════════════════════════
   QIM BRIEF PASAR HARIAN — kartu di Overview (api/brief-harian.php).
   Ringkasan berita besar, berita terbaru, posisi berjalan, dan status indikator Pine. Dibuat server
   sekali sehari (AI menulis ulang fakta; tanpa AI = teks otomatis) dan ditandai jujur di kartu.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /** Markdown minimal (tebal, miring, judul, daftar) — di-escape DULU sehingga tak ada HTML mentah. */
    function md(teks) {
        const baris = esc(teks).split(/\r?\n/);
        let html = '', diDaftar = false;
        const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])_(.+?)_(?=[\s.,:;)]|$)/g, '$1<i>$2</i>');
        for (let b of baris) {
            b = b.trim();
            const butir = b.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
            if (butir) { if (!diDaftar) { html += '<ul>'; diDaftar = true; } html += '<li>' + inline(butir[1]) + '</li>'; continue; }
            if (diDaftar) { html += '</ul>'; diDaftar = false; }
            if (!b) continue;
            const judul = b.match(/^#{1,4}\s+(.*)$/);
            html += judul ? '<h4>' + inline(judul[1]) + '</h4>' : '<p>' + inline(b) + '</p>';
        }
        return diDaftar ? html + '</ul>' : html;
    }

    const labelSumber = d => (d && d.sumber === 'ai') ? '🤖 Ditulis AI dari data kalender, berita & sinyal' : '⚙ Ringkasan otomatis (tanpa AI)';

    const api = { md, labelSumber };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (!root || typeof document === 'undefined') return;
    root.QimBriefHarian = api;

    const CSS = '#briefHarian .qbh-isi{font-size:13px;line-height:1.6;color:#cbd5e1}#briefHarian .qbh-isi p{margin:.35rem 0}'
        + '#briefHarian .qbh-isi ul{margin:.2rem 0 .5rem;padding-left:1.1rem;list-style:disc}#briefHarian .qbh-isi b{color:#f1f5f9}'
        + '#briefHarian .qbh-isi h4{margin:.6rem 0 .2rem;color:#f1f5f9;font-size:13px}'
        + '#briefHarian .qbh-sumber{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:#1e293b;color:#cbd5e1}'
        + '#briefHarian .qbh-sumber.ai{background:#1e1b4b;color:#c7d2fe}#briefHarian .qbh-cat{font-size:11px;color:#fbbf24;margin-top:.4rem}';

    async function muat() {
        const el = document.getElementById('briefHarian');
        if (!el) return;
        const isi = el.querySelector('.qbh-isi'), kepala = el.querySelector('.qbh-sumber'), tgl = el.querySelector('.qbh-tgl');
        try {
            const headers = (root.QuantumAuth && root.QuantumAuth.authHeaders) ? root.QuantumAuth.authHeaders() : {};
            const res = await fetch('api/brief-harian.php', { cache: 'no-store', headers });
            const d = await res.json().catch(() => null);
            if (!res.ok || !d || d.status !== 'success' || !d.teks) throw new Error((d && d.message) || 'brief belum tersedia');
            isi.innerHTML = md(d.teks) + (d.catatan ? '<div class="qbh-cat">' + esc(d.catatan) + '</div>' : '');
            kepala.textContent = labelSumber(d);
            kepala.classList.toggle('ai', d.sumber === 'ai');
            if (tgl) tgl.textContent = d.tanggal || '';
        } catch (e) {
            isi.textContent = 'Brief hari ini belum dapat dimuat. Coba lagi nanti.';
        }
    }

    function mulai() {
        const el = document.getElementById('briefHarian');
        if (!el) return;
        const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
        muat();
        setInterval(() => { if (!document.hidden) muat(); }, 30 * 60 * 1000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
})(typeof window !== 'undefined' ? window : null);
