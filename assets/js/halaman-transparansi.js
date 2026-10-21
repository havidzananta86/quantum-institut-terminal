// Skrip halaman Transparansi (transparansi.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
(function () {
    'use strict';
    function el(id) { return document.getElementById(id); }
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function set(id, t) { var e = el(id); if (e) e.textContent = t; }
    function persen(v) { return v == null ? '—' : v + '%'; }
    function r(v, d) { if (v == null || !isFinite(v)) return '—'; var n = Number(v).toFixed(d == null ? 2 : d); return (v > 0 ? '+' : '') + n + 'R'; }
    function kelasR(v) { return v == null ? 'tr-abu' : v > 0 ? 'tr-naik' : v < 0 ? 'tr-turun' : 'tr-abu'; }
    function simbol(s) { s = String(s || ''); if (/USDT$/.test(s)) return s.replace(/USDT$/, '/USDT'); return s.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2'); }
    function angka(v) { var n = Number(v); if (!isFinite(n)) return '—'; return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(n); }
    function waktu(iso) {
        var t = Date.parse(iso); if (isNaN(t)) return '—';
        return new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';
    }
    function gagal() {
        set('kWrCi', 'Catatan belum bisa dimuat saat ini. Kami tidak menampilkan angka perkiraan.');
        ['tPair', 'tRiwayat'].forEach(function (id) { var e = el(id); if (e) e.innerHTML = '<tbody><tr><td>Data belum tersedia.</td></tr></tbody>'; });
        set('bProgres', 'data belum tersedia');
    }

    fetch('api/transparansi.php', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        .then(function (res) { return res.json(); })
        .then(function (d) {
            if (!d || d.status !== 'success') return gagal();
            var st = (d.sinyal_resmi && d.sinyal_resmi.statistik) || {};
            var n = st.dinilai || 0;

            // Ringkasan
            set('kWr', persen(st.win_rate));
            set('kWrCi', n ? 'interval keyakinan 95%: ' + st.ci_bawah + '–' + st.ci_atas + '%' : 'belum ada sinyal selesai');
            set('kN', String(n));
            set('kNDetail', n ? st.menang + ' menang · ' + st.kalah + ' kalah' + ((st.aktif || st.kedaluwarsa) ? ' · ' + (st.aktif || 0) + ' aktif · ' + (st.kedaluwarsa || 0) + ' kedaluwarsa' : '') : '');
            var exp = el('kExp'); if (exp) { exp.textContent = r(st.expectancy_r, 2); exp.className = 'font-heading font-bold text-3xl mt-1 tabular-nums ' + (st.expectancy_r == null ? 'text-white' : kelasR(st.expectancy_r)); }
            var tot = el('kTotal'); if (tot) { tot.textContent = r(st.total_r, 1); tot.className = 'font-heading font-bold text-3xl mt-1 tabular-nums ' + (st.total_r == null ? 'text-white' : kelasR(st.total_r)); }
            set('kPf', st.profit_factor != null ? 'profit factor ' + st.profit_factor : '');

            // Penurunan terdalam (drawdown). Ditampilkan sejajar win rate supaya tidak ada
            // yang menilai sistem ini hanya dari angka yang enak dilihat.
            var dd = st.drawdown || {};
            var ddEl = el('kDd');
            if (ddEl) {
                ddEl.textContent = dd.maks_r != null ? '-' + r(Math.abs(dd.maks_r), 1) : '—';
                ddEl.className = 'font-heading font-bold text-3xl mt-1 tabular-nums ' + (dd.maks_r ? 'text-qi-red' : 'text-white');
            }
            set('kDdDetail', dd.dari_transaksi
                ? 'R · dari ' + dd.dari_transaksi + ' transaksi' + (dd.maks_pct != null ? ' · ' + dd.maks_pct + '% dari puncak' : '')
                : (dd.catatan || 'belum ada transaksi tertutup'));
            set('kDdArti', dd.dari_transaksi ? (dd.arti || '') : '');
            set('kImpas', st.titik_impas_pct != null
                ? 'Dengan rasio risk:reward rata-rata 1:' + st.rr_rata + ', titik impas win rate adalah ±' + st.titik_impas_pct + '%. Win rate di bawah angka itu berarti rugi bersih, di atasnya untung — sebelum spread dan komisi.'
                : '');
            var p = el('peringatanSampel');
            if (p && n < 30) { p.classList.remove('hidden'); p.innerHTML = '<b>Sampel masih kecil (' + n + ' sinyal selesai, minimal 30 untuk penilaian awal).</b> Interval keyakinan yang lebar menunjukkan angka di bawah belum bisa dijadikan pegangan — jangan menyimpulkan kualitas sistem dari halaman ini saja.'; }

            // Per pair
            var pairs = (st.per_simbol || []).slice().sort(function (a, b) { return b.dinilai - a.dinilai; });
            el('tPair').innerHTML = pairs.length
                ? '<thead><tr><th>Instrumen</th><th>Sinyal</th><th>Menang</th><th>Win rate</th><th>Total</th><th></th></tr></thead><tbody>' + pairs.map(function (x) {
                    return '<tr><td>' + esc(simbol(x.simbol)) + '</td><td>' + x.dinilai + '</td><td>' + x.menang + '</td><td>' + persen(x.win_rate) + '</td><td class="' + kelasR(x.total_r) + '">' + r(x.total_r, 1) + '</td><td class="tr-abu">' + (x.sampel_kecil ? 'sampel kecil' : '') + '</td></tr>';
                }).join('') + '</tbody>'
                : '<tbody><tr><td>Belum ada sinyal selesai.</td></tr></tbody>';

            // Riwayat
            var h = (d.sinyal_resmi && d.sinyal_resmi.terakhir) || [];
            el('tRiwayat').innerHTML = h.length
                ? '<thead><tr><th>Ditutup</th><th>Instrumen</th><th>Arah</th><th>Entry</th><th>SL</th><th>TP</th><th>Hasil</th><th>R</th></tr></thead><tbody>' + h.map(function (x) {
                    var menang = x.hasil === 'TP';
                    return '<tr><td class="tr-abu">' + esc(waktu(x.tutup || x.waktu)) + '</td><td>' + esc(simbol(x.simbol)) + '</td><td>' + esc(x.arah) + '</td><td>' + esc(angka(x.entry)) + '</td><td>' + esc(angka(x.sl)) + '</td><td>' + esc(angka(x.tp)) + '</td><td class="' + (menang ? 'tr-naik' : 'tr-turun') + '">' + (menang ? 'TP kena' : 'SL kena') + '</td><td class="' + kelasR(x.r) + '">' + r(x.r, 2) + '</td></tr>';
                }).join('') + '</tbody>'
                : '<tbody><tr><td>Belum ada sinyal selesai.</td></tr></tbody>';
            var per = d.sinyal_resmi && d.sinyal_resmi.periode;
            set('kPeriode', per ? 'Catatan dari ' + waktu(per.pertama) + ' sampai ' + waktu(per.terakhir) + ' · ' + (d.sinyal_resmi.total_tercatat || 0) + ' sinyal tercatat seluruhnya.' : '');

            // Bayangan
            var b = d.sinyal_bayangan || {}, bs = b.statistik || {}, bn = bs.dinilai || 0;
            set('bProgres', bn + ' dari 100 sinyal tertutup terkumpul');
            var bt = el('bBatang'); if (bt) bt.style.width = Math.min(100, bn) + '%';
            set('bDetail', (b.catatan || '') + (b.tingkat_isi_pct != null ? ' Tingkat pengisian order limit: ' + b.tingkat_isi_pct + '%.' : ''));
            var m = b.per_metode || [];
            el('tMetode').innerHTML = m.length
                ? '<thead><tr><th>Metode</th><th>Sinyal</th><th>Menang</th><th>Win rate</th><th>Total</th></tr></thead><tbody>' + m.map(function (x) {
                    return '<tr><td>' + esc(x.nama) + '</td><td>' + x.dinilai + '</td><td>' + x.menang + '</td><td>' + persen(x.win_rate) + '</td><td class="' + kelasR(x.total_r) + '">' + r(x.total_r, 1) + '</td></tr>';
                }).join('') + '</tbody>'
                : '<tbody></tbody>';

            // Indikator Pine
            var pn = d.sinyal_pine || {}, ps = pn.statistik || {};
            set('pCatatan', (pn.catatan || '') + ' Tercatat: ' + (pn.rekor || 0) + ' sinyal; selesai: ' + (ps.dinilai || 0) + (ps.dinilai ? ' (win rate ' + persen(ps.win_rate) + ', total ' + r(ps.total_r, 1) + ')' : '') + '.');
            var pt = pn.terakhir || [];
            el('tPine').innerHTML = pt.length
                ? '<thead><tr><th>Waktu</th><th>Arah</th><th>Entry</th><th>SL</th><th>TP3</th><th>Status</th><th>Hasil</th></tr></thead><tbody>' + pt.map(function (x) {
                    return '<tr><td>' + esc(waktu(x.waktu)) + '</td><td>' + esc(x.arah) + '</td><td>' + esc(x.entry) + '</td><td>' + esc(x.sl) + '</td><td>' + esc(x.tp) + '</td><td>' + esc(x.status) + '</td><td class="' + kelasR(x.r) + '">' + (x.r == null ? '—' : r(x.r, 2)) + '</td></tr>';
                }).join('') + '</tbody>'
                : '<tbody><tr><td>Belum ada sinyal VALID tercatat. Pemindai berjalan tiap bar H4 yang tutup.</td></tr></tbody>';

            // Metodologi & peringatan
            var ul = el('listMetodologi'); if (ul) ul.innerHTML = (d.metodologi || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
            set('kPeringatan', d.peringatan || '');
            set('kUpdate', waktu(d.diperbarui));
        })
        .catch(gagal);
})();
