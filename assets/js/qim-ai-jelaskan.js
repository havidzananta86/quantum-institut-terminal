/**
 * "🤖 Jelaskan" pada setiap setup di kartu Setup Analisa → dialog berisi penjelasan bahasa sederhana
 * (api/ai-jelaskan.php). Bila AI tidak tersedia, server mengirim penjelasan otomatis berbasis aturan
 * dan dialog menandainya dengan jujur. Teks dirender dari Markdown sederhana secara AMAN (di-escape dulu).
 */
(function () {
    'use strict';
    let dialog = null;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /** Markdown minimal: **tebal**, _miring_, judul #, daftar "- " / "1." — tanpa HTML mentah. */
    function md(teks) {
        const baris = esc(teks).split(/\r?\n/);
        let html = '', diDaftar = false;
        const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s.,:;)]|$)/g, '$1<i>$2</i>')
            .replace(/(^|[\s(])_(.+?)_(?=[\s.,:;)]|$)/g, '$1<i>$2</i>');
        for (let b of baris) {
            b = b.trim();
            const butir = b.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
            if (butir) { if (!diDaftar) { html += '<ul>'; diDaftar = true; } html += '<li>' + inline(butir[1]) + '</li>'; continue; }
            if (diDaftar) { html += '</ul>'; diDaftar = false; }
            if (!b) continue;
            const judul = b.match(/^#{1,4}\s+(.*)$/);
            html += judul ? '<h3>' + inline(judul[1]) + '</h3>' : '<p>' + inline(b) + '</p>';
        }
        if (diDaftar) html += '</ul>';
        return html;
    }

    function bangun() {
        dialog = document.createElement('div');
        dialog.className = 'qbt-latar';
        dialog.hidden = true;
        dialog.innerHTML = '<div class="qbt-dialog qai-dialog" role="dialog" aria-modal="true" aria-labelledby="qaiJudul">'
            + '<div class="qbt-kepala"><h2 id="qaiJudul">🤖 Penjelasan setup</h2><button type="button" class="qbt-tutup" aria-label="Tutup">✕</button></div>'
            + '<div class="qai-isi" id="qaiIsi" aria-live="polite"></div></div>';
        document.body.appendChild(dialog);
        dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('.qbt-tutup')) tutup(); });
        dialog.addEventListener('keydown', e => { if (e.key === 'Escape') tutup(); });
    }
    let asal = null;
    function tutup() { if (!dialog) return; dialog.hidden = true; document.body.classList.remove('qbt-terbuka'); if (asal && asal.focus) asal.focus(); }

    async function jelaskan(setup, opsi) {
        if (!dialog) bangun();
        asal = document.activeElement;
        const isi = dialog.querySelector('#qaiIsi');
        const k = (typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : {}) || {};
        const sym = (opsi && opsi.symbol) || k.symbol;
        const tf = (opsi && opsi.tf) || k.interval;
        const judul = (setup.metode || '') + ' · ' + (setup.arah || '') + ' · ' + (sym || '');
        dialog.querySelector('#qaiJudul').textContent = '🤖 ' + judul;
        isi.innerHTML = '<p class="qai-muat">Menyusun penjelasan…</p>';
        dialog.hidden = false;
        document.body.classList.add('qbt-terbuka');
        dialog.querySelector('.qbt-tutup').focus();
        // ATR & harga dari chart (fakta pendukung; server tetap menghitung angka utamanya sendiri).
        let atr = null, harga = null;
        try {
            const c = k.candles || [];
            if (c.length > 15) { let j = 0; for (let i = c.length - 14; i < c.length; i++) j += Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close)); atr = j / 14; }
            harga = c.length ? c[c.length - 1].close : null;
        } catch (e) {}
        const chip = document.querySelector('.qim-berita-chip:not([hidden])');
        try {
            const r = await fetch('api/ai-jelaskan.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: sym, tf, harga, atr, berita: chip ? chip.textContent.replace(/\s+/g, ' ').trim() : '',
                    setup: { metode: setup.metode, arah: setup.arah, status: setup.status, entry: setup.entry, sl: setup.sl, tp: setup.tp, rr: setup.rr, alasan: setup.alasan || [], tpLabel: setup.tpLabel } })
            });
            const j = await r.json();
            if (!r.ok || j.status !== 'success') {
                isi.innerHTML = '<p class="qai-galat">' + esc(r.status === 403 ? 'Penjelasan setup tersedia untuk paket PRO/VIP.' : (j.message || 'Penjelasan gagal dimuat.')) + '</p>';
                return;
            }
            isi.innerHTML = '<div class="qai-sumber ' + (j.sumber === 'ai' ? 'ai' : '') + '">' + (j.sumber === 'ai' ? '🤖 Dijelaskan AI' + (j.cache ? ' (tersimpan)' : '') : '⚙ Penjelasan otomatis (tanpa AI)') + '</div>'
                + (j.catatan ? '<p class="qai-catatan">' + esc(j.catatan) + '</p>' : '')
                + '<div class="qai-teks">' + md(j.penjelasan) + '</div>'
                + '<p class="qai-kaki">Angka (lot, rugi/untung) dihitung sistem dari entry/SL/TP — bukan tebakan AI. Bukan saran investasi.</p>';
        } catch (e) {
            isi.innerHTML = '<p class="qai-galat">Penjelasan gagal dimuat: ' + esc(e.message || e) + '</p>';
        }
    }

    window.QIMAIJelaskan = { jelaskan, _md: md };
})();
