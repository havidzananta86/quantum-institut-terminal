/**
 * Tampilan BACKTEST SETUP ANALISA (dialog dari kartu Setup Analisa).
 *  - Satu pair: tabel per metode (trade, win rate, rata-rata R, total R, profit factor, drawdown)
 *    + kurva ekuitas (R kumulatif) per metode.
 *  - Semua pair: matriks pair × metode (rata-rata R per trade) dan metode terbaik per pair.
 * Data: api/get-history.php (OANDA hingga 5.000 bar, kripto Binance). Hitungan di Web Worker
 * (qim-backtest-worker.js) memakai aturan yang sama dengan sinyal bayangan di server.
 */
(function () {
    'use strict';
    const VERSI = '1.0.0';
    const PAIR_SEMUA = ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'BTCUSDT', 'ETHUSDT', 'US30', 'NAS100', 'SPX500', 'GER40'];
    const NAMA = { SMC: 'SMC', ICT: 'ICT', FIBO: 'Fibonacci', SND: 'S&D', SEMUA: 'Gabungan' };
    const WARNA = { SMC: '#facc15', ICT: '#38bdf8', FIBO: '#a855f7', SND: '#10b981', SEMUA: '#e2e8f0' };
    const TF = [['60', 'H1'], ['240', 'H4'], ['D', 'D1']];
    let worker = null, idMinta = 0, dialog = null, sibuk = false;

    const $ = (s, r) => (r || document).querySelector(s);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tgl = t => new Date(t * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const angka = (v, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? '—' : (v > 0 && d >= 0 ? '+' : '') + v.toFixed(d);
    const kelasR = v => !Number.isFinite(v) ? '' : v > 0.05 ? 'naik' : v < -0.05 ? 'turun' : 'datar';

    function daftarSimbol() {
        try { return WL_GROUPS.flatMap(g => g.syms).map(s => ({ key: s.key, label: s.label })); }   // global dari dashboard-app.js
        catch (e) { return PAIR_SEMUA.map(k => ({ key: k, label: k })); }
    }

    function pastikanWorker() {
        if (worker) return worker;
        worker = new Worker('assets/js/qim-backtest-worker.js?v=' + VERSI);
        return worker;
    }
    function hitung(candles, opsi, onKemajuan) {
        return new Promise(selesai => {
            const id = ++idMinta, w = pastikanWorker();
            const dengar = e => {
                if (!e.data || e.data.id !== id) return;
                if ('kemajuan' in e.data) { if (onKemajuan) onKemajuan(e.data.kemajuan); return; }
                w.removeEventListener('message', dengar);
                selesai(e.data.hasil);
            };
            w.addEventListener('message', dengar);
            w.postMessage({ id, candles, opsi });
        });
    }
    async function ambilRiwayat(sym, iv) {
        const r = await fetch('api/get-history.php?symbol=' + encodeURIComponent(sym) + '&interval=' + encodeURIComponent(iv) + '&bars=5000');
        const j = await r.json();
        if (!j || j.status !== 'success' || !Array.isArray(j.candles)) throw new Error((j && j.message) || 'riwayat tidak tersedia');
        return j;
    }

    // ── Dialog ───────────────────────────────────────────────────────────────
    function buka() {
        if (!dialog) bangun();
        const kini = (typeof window.qiChartKonteks === 'function' && window.qiChartKonteks().symbol) || 'XAUUSD';
        const pilih = $('#qbtSimbol', dialog);
        if (pilih && [...pilih.options].some(o => o.value === kini)) pilih.value = kini;
        dialog.hidden = false;
        document.body.classList.add('qbt-terbuka');
        setTimeout(() => { const t = $('#qbtJalan', dialog); if (t) t.focus(); }, 30);
    }
    function tutup() {
        if (!dialog) return;
        dialog.hidden = true;
        document.body.classList.remove('qbt-terbuka');
        const asal = document.getElementById('qimBacktestBuka');
        if (asal) asal.focus();
    }
    function bangun() {
        dialog = document.createElement('div');
        dialog.className = 'qbt-latar';
        dialog.hidden = true;
        dialog.innerHTML = '<div class="qbt-dialog" role="dialog" aria-modal="true" aria-labelledby="qbtJudul">'
            + '<div class="qbt-kepala"><h2 id="qbtJudul">📊 Backtest Setup Analisa</h2><button type="button" class="qbt-tutup" aria-label="Tutup">✕</button></div>'
            + '<div class="qbt-kontrol">'
            + '<label>Pair<select id="qbtSimbol">' + daftarSimbol().map(s => '<option value="' + esc(s.key) + '">' + esc(s.label) + '</option>').join('') + '</select></label>'
            + '<label>Timeframe<select id="qbtTf">' + TF.map(([v, l]) => '<option value="' + v + '"' + (v === '240' ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>'
            + '<label class="qbt-cek"><input type="checkbox" id="qbtFilter" checked> Filter seperti sinyal bayangan</label>'
            + '<div class="qbt-tombol"><button type="button" id="qbtJalan" class="utama">Jalankan</button><button type="button" id="qbtSemua">Uji semua pair</button></div>'
            + '</div>'
            + '<div class="qbt-status" id="qbtStatus" role="status" aria-live="polite">Pilih pair & timeframe, lalu tekan <b>Jalankan</b>. Hitungan berjalan di perangkat Anda.</div>'
            + '<div class="qbt-hasil" id="qbtHasil"></div>'
            + '<details class="qbt-aturan"><summary>Aturan backtest (dibaca sebelum menyimpulkan)</summary><ul>'
            + '<li>Setup dideteksi saat candle <b>close</b>, hanya dari data sampai saat itu — tanpa melihat masa depan.</li>'
            + '<li>Hanya setup yang entry-nya <b>belum tersentuh</b> dipasang sebagai order limit (sama seperti sinyal bayangan).</li>'
            + '<li>Order limit kedaluwarsa ±12 jam; batal bila harga mencapai TP sebelum entry terisi. Posisi ditutup paksa setelah ±48 jam (EXPIRED).</li>'
            + '<li><b>Konservatif</b>: bila candle yang sama menyentuh SL dan TP, SL dihitung lebih dulu; gap melewati SL dihitung di harga open.</li>'
            + '<li>Belum memperhitungkan spread/komisi dan filter bias H4 — hasil nyata bisa sedikit lebih buruk.</li>'
            + '<li><b>R</b> = kelipatan risiko. Rata-rata R &gt; 0 berarti metode itu menghasilkan untung per trade dalam periode uji. Sampel &lt; 30 trade belum bisa dijadikan pegangan.</li>'
            + '<li>Hasil masa lalu tidak menjamin hasil masa depan. Ini alat evaluasi, bukan saran investasi.</li>'
            + '</ul></details></div>';
        document.body.appendChild(dialog);
        dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('.qbt-tutup')) tutup(); });
        dialog.addEventListener('keydown', e => { if (e.key === 'Escape') tutup(); });
        $('#qbtJalan', dialog).addEventListener('click', () => jalankanSatu());
        $('#qbtSemua', dialog).addEventListener('click', () => jalankanSemua());
    }

    function setStatus(html) { const s = $('#qbtStatus', dialog); if (s) s.innerHTML = html; }
    function kunciTombol(ya) { sibuk = ya; dialog.querySelectorAll('.qbt-tombol button, .qbt-kontrol select, .qbt-kontrol input').forEach(b => { b.disabled = ya; }); }

    async function jalankanSatu() {
        if (sibuk) return;
        const sym = $('#qbtSimbol', dialog).value, iv = $('#qbtTf', dialog).value, filter = $('#qbtFilter', dialog).checked;
        const hasilEl = $('#qbtHasil', dialog);
        kunciTombol(true);
        hasilEl.innerHTML = '';
        try {
            setStatus('Mengunduh riwayat ' + esc(sym) + '…');
            const j = await ambilRiwayat(sym, iv);
            setStatus('Menguji ' + j.candles.length.toLocaleString('id-ID') + ' bar ' + esc(sym) + '… <span id="qbtPersen">0%</span>');
            const r = await hitung(j.candles, { filter }, p => { const el = document.getElementById('qbtPersen'); if (el) el.textContent = Math.round(p * 100) + '%'; });
            if (!r || !r.ok) { setStatus(esc((r && r.pesan) || 'Backtest gagal.')); return; }
            setStatus('<b>' + esc(sym) + ' ' + esc(labelTf(iv)) + '</b> · ' + tgl(r.dari) + ' – ' + tgl(r.sampai) + ' · ' + r.bar.toLocaleString('id-ID') + ' bar'
                + ' · sumber ' + esc(j.source) + (j.limited ? ' <span class="qbt-catatan">(riwayat dibatasi sumber)</span>' : ''));
            hasilEl.innerHTML = tabelSatu(r) + '<div class="qbt-kurva-wadah"><canvas class="qbt-kurva" width="640" height="200" aria-label="Kurva ekuitas dalam R"></canvas><div class="qbt-legenda">'
                + r.metode.concat([r.gabungan]).map(h => '<span><i style="background:' + WARNA[h.metode] + '"></i>' + esc(NAMA[h.metode]) + '</span>').join('') + '</div></div>';
            gambarKurva($('.qbt-kurva', hasilEl), r);
        } catch (e) {
            setStatus('Backtest gagal: ' + esc(e.message || e));
        } finally { kunciTombol(false); }
    }

    function labelTf(iv) { return (TF.find(t => t[0] === iv) || [iv, iv])[1]; }

    function tabelSatu(r) {
        const baris = r.metode.concat([r.gabungan]).map(h => {
            const terbaik = r.terbaik && r.terbaik.metode === h.metode;
            return '<tr class="' + (h.metode === 'SEMUA' ? 'gabungan' : '') + (terbaik ? ' terbaik' : '') + '">'
                + '<th scope="row">' + (terbaik ? '★ ' : '') + esc(NAMA[h.metode]) + '</th>'
                + '<td>' + h.trade + '<small>' + h.dipasang + ' order</small></td>'
                + '<td>' + (h.winRate === null ? '—' : h.winRate + '%') + '<small>' + h.menang + 'M/' + h.kalah + 'K/' + h.expired + 'E</small></td>'
                + '<td class="' + kelasR(h.rataR) + '"><b>' + angka(h.rataR) + 'R</b></td>'
                + '<td class="' + kelasR(h.totalR) + '">' + angka(h.totalR, 1) + 'R</td>'
                + '<td>' + (h.profitFactor === null ? '∞' : h.profitFactor) + '</td>'
                + '<td>' + (h.ddMaksR ? '−' + h.ddMaksR.toFixed(1) + 'R' : '0') + '</td>'
                + '</tr>';
        }).join('');
        const kesimpulan = r.terbaik
            ? '<p class="qbt-kesimpulan naik">★ Paling baik pada periode ini: <b>' + esc(NAMA[r.terbaik.metode]) + '</b> — rata-rata ' + angka(r.terbaik.rataR) + 'R per trade dari ' + r.terbaik.trade + ' trade'
              + (r.terbaik.trade < 30 ? ' (sampel masih kecil, belum bisa dijadikan pegangan).' : '.') + '</p>'
            : '<p class="qbt-kesimpulan turun">Tidak ada metode yang menguntungkan (rata-rata R &gt; 0 dengan ≥ 10 trade) pada pair & timeframe ini. Jangan dipakai untuk auto-entry di sini.</p>';
        return kesimpulan + '<div class="qbt-tabel-wadah"><table class="qbt-tabel"><thead><tr><th scope="col">Metode</th><th scope="col">Trade</th><th scope="col">Win</th><th scope="col">Rata² R</th><th scope="col">Total R</th><th scope="col" title="Profit factor: total untung ÷ total rugi">PF</th><th scope="col" title="Drawdown maksimum (dalam R)">DD</th></tr></thead><tbody>' + baris + '</tbody></table></div>';
    }

    function gambarKurva(kanvas, r) {
        if (!kanvas || !kanvas.getContext) return;
        const dpr = window.devicePixelRatio || 1, lebar = kanvas.clientWidth || 640, tinggi = kanvas.clientHeight || 200;
        kanvas.width = lebar * dpr; kanvas.height = tinggi * dpr;
        const ctx = kanvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const seri = r.metode.concat([r.gabungan]).filter(h => h.ekuitas.length);
        if (!seri.length) { ctx.fillStyle = '#94a3b8'; ctx.font = '12px Inter, sans-serif'; ctx.fillText('Belum ada trade selesai.', 12, 24); return; }
        const t0 = r.dari, t1 = r.sampai;
        let min = 0, max = 0;
        seri.forEach(h => h.ekuitas.forEach(p => { min = Math.min(min, p.value); max = Math.max(max, p.value); }));
        if (max - min < 1) { max += 0.5; min -= 0.5; }
        const kiri = 34, kanan = 8, atas = 8, bawah = 18;
        const x = t => kiri + (t - t0) / Math.max(1, t1 - t0) * (lebar - kiri - kanan);
        const y = v => atas + (max - v) / (max - min) * (tinggi - atas - bawah);
        ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(kiri, y(0)); ctx.lineTo(lebar - kanan, y(0)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#94a3b8'; ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(max.toFixed(0) + 'R', 2, atas + 8); ctx.fillText(min.toFixed(0) + 'R', 2, tinggi - bawah); ctx.fillText('0', 20, y(0) + 3);
        ctx.fillText(tgl(t0), kiri, tinggi - 4);
        const akhir = tgl(t1); ctx.fillText(akhir, lebar - kanan - ctx.measureText(akhir).width, tinggi - 4);
        seri.forEach(h => {
            ctx.strokeStyle = WARNA[h.metode]; ctx.lineWidth = h.metode === 'SEMUA' ? 2 : 1.3;
            ctx.beginPath(); ctx.moveTo(x(t0), y(0));
            h.ekuitas.forEach(p => ctx.lineTo(x(p.time), y(p.value)));
            ctx.stroke();
        });
    }

    async function jalankanSemua() {
        if (sibuk) return;
        const iv = $('#qbtTf', dialog).value, filter = $('#qbtFilter', dialog).checked;
        const hasilEl = $('#qbtHasil', dialog);
        kunciTombol(true);
        const baris = [];
        try {
            for (let k = 0; k < PAIR_SEMUA.length; k++) {
                const sym = PAIR_SEMUA[k];
                setStatus('Menguji ' + (k + 1) + '/' + PAIR_SEMUA.length + ': <b>' + esc(sym) + '</b> ' + esc(labelTf(iv)) + '…');
                try {
                    const j = await ambilRiwayat(sym, iv);
                    const r = await hitung(j.candles, { filter });
                    baris.push({ sym, r, sumber: j.source, terbatas: j.limited });
                } catch (e) { baris.push({ sym, galat: e.message || String(e) }); }
                hasilEl.innerHTML = tabelMatriks(baris, iv);
            }
            setStatus('Selesai: ' + PAIR_SEMUA.length + ' pair · ' + esc(labelTf(iv)) + '. Angka = rata-rata R per trade (jumlah trade dalam kurung). ★ = metode terbaik di pair itu.');
        } finally { kunciTombol(false); }
    }

    function tabelMatriks(baris, iv) {
        const met = ['SMC', 'ICT', 'FIBO', 'SND'];
        const isi = baris.map(b => {
            if (b.galat || !b.r || !b.r.ok) return '<tr><th scope="row">' + esc(b.sym) + '</th><td colspan="5" class="datar">' + esc(b.galat || (b.r && b.r.pesan) || 'gagal') + '</td></tr>';
            const terbaik = b.r.terbaik && b.r.terbaik.metode;
            return '<tr><th scope="row">' + esc(b.sym) + '<small>' + (b.r.bar ? tgl(b.r.dari).replace(/^\d+ /, '') + '–' + tgl(b.r.sampai).replace(/^\d+ /, '') : '') + '</small></th>'
                + met.map(m => { const h = b.r.metode.find(x => x.metode === m); return '<td class="' + kelasR(h && h.rataR) + (terbaik === m ? ' terbaik' : '') + '">' + (terbaik === m ? '★ ' : '') + (h && h.trade ? angka(h.rataR) + '<small>(' + h.trade + ')</small>' : '—') + '</td>'; }).join('')
                + '<td class="' + kelasR(b.r.gabungan.rataR) + '">' + (b.r.gabungan.trade ? angka(b.r.gabungan.rataR) + '<small>(' + b.r.gabungan.trade + ')</small>' : '—') + '</td></tr>';
        }).join('');
        return '<div class="qbt-tabel-wadah"><table class="qbt-tabel qbt-matriks"><thead><tr><th scope="col">Pair ' + esc(labelTf(iv)) + '</th><th scope="col">SMC</th><th scope="col">ICT</th><th scope="col">Fibo</th><th scope="col">S&amp;D</th><th scope="col">Gabungan</th></tr></thead><tbody>' + isi + '</tbody></table></div>';
    }

    document.addEventListener('click', e => { if (e.target.closest('#qimBacktestBuka')) buka(); });
    window.QIMBacktestUI = { buka, tutup };
})();
