/**
 * ZONA POSISI DI ATAS CHART — kotak hijau entry→TP, kotak merah entry→SL, plus label
 * harga di sisi kanan. Tampilannya meniru alat "Long/Short Position" TradingView.
 *
 * KENAPA OVERLAY HTML, BUKAN SERI BARU: lightweight-charts (v4 & v5) tidak punya
 * primitif "kotak antar dua harga". Menambah seri palsu akan mengotori data candle
 * dan bisa merusak skala harga. Overlay HTML di atas canvas:
 *   · tidak menyentuh data/skala sama sekali (aman),
 *   · posisinya dihitung dari koordinat ASLI chart (priceToCoordinate), jadi tetap
 *     menempel pada harga yang benar saat di-zoom/di-geser,
 *   · bisa dimatikan total tanpa memengaruhi chart.
 *
 * Semua operasi dibungkus try/catch: kegagalan overlay TIDAK boleh merusak chart.
 */
(function () {
    'use strict';

    const NAMA_KELAS = 'qi-zona-layer';
    let lapisan = null, chartRef = null, seriRef = null, dataZona = null, pengamat = null, bersihkanLangganan = null;
    let _cobaUlang = null;
    let _autoscaleSebelumnya = null;
    let _penyegerak = null;
    let _tandaKoordinat = '';
    let _paksaFokus = false;

    /**
     * PENYEGERAK KOORDINAT — inti perbaikan "area TP/SL/entry tidak pas & berpindah".
     *
     * Sebabnya: lightweight-charts TIDAK menyediakan event untuk perubahan SKALA HARGA
     * (menarik/meng-zoom sumbu harga, atau autoscale yang bergeser). Hanya perubahan
     * rentang WAKTU yang punya event. Akibatnya overlay diam di tempat sementara candle
     * dan sumbu bergerak — kotak tampak "berpindah-pindah dan tidak akurat".
     *
     * Solusinya: penyegerak ringan berbasis animation frame yang membandingkan TANDA
     * koordinat (entry/TP/SL + tinggi area) dan hanya menggambar ulang bila berubah.
     * Biayanya sangat kecil (3 pemanggilan priceToCoordinate, ~16×/detik) dan hanya
     * hidup selama sebuah area posisi tampil.
     */
    function tandaKoordinat() {
        try {
            if (!seriRef || !dataZona || !lapisan) return '';
            const t = lapisan.clientHeight || 0;
            const a = seriRef.priceToCoordinate(dataZona.entry);
            const b = seriRef.priceToCoordinate(dataZona.tp);
            const c = seriRef.priceToCoordinate(dataZona.sl);
            const bulat = (v) => Number.isFinite(v) ? (Math.round(v * 10) / 10) : 'x';
            return bulat(a) + '|' + bulat(b) + '|' + bulat(c) + '|' + t + '|' + (lapisan.clientWidth || 0);
        } catch (e) { return ''; }
    }

    function langkahSegerak(waktu) {
        _penyegerak = window.requestAnimationFrame(langkahSegerak);
        try {
            if (waktu - (langkahSegerak._terakhir || 0) < 60) return;   // ~16×/detik
            langkahSegerak._terakhir = waktu;
            const tanda = tandaKoordinat();
            if (tanda !== _tandaKoordinat) {
                _tandaKoordinat = tanda;
                perbarui();
            }
        } catch (e) {}
    }

    function mulaiPenyegerak() {
        if (_penyegerak || typeof window.requestAnimationFrame !== 'function') return;
        _penyegerak = window.requestAnimationFrame(langkahSegerak);
    }

    function hentikanPenyegerak() {
        if (_penyegerak) { try { window.cancelAnimationFrame(_penyegerak); } catch (e) {} _penyegerak = null; }
        _tandaKoordinat = '';
    }

    /**
     * Pastikan entry, TP, dan SL terlihat — TETAPI HANYA BILA WAJAR.
     *
     * ⚠️ PELAJARAN PENTING (bug nyata yang dilaporkan pengguna): memaksa skala harga
     * memuat TP yang JAUH membuat rentang melebar drastis (mis. 3400–4700 untuk setup
     * 4023–4250). Akibatnya SEMUA candle terkompresi menjadi garis tipis — pengguna
     * melihatnya sebagai "candle pecah-pecah". Jadi sekarang:
     *   · perluasan hanya dilakukan bila tambahannya ≤ 35% dari rentang data;
     *   · bila level terlalu jauh, skala TIDAK disentuh dan label diberi tanda
     *     "di luar layar" (⇡/⇣) — jujur, dan candle tetap terbaca;
     *   · pengguna bisa meminta tampilan penuh lewat tombol "⤢ Fokus posisi"
     *     (fungsi fokus()), jadi bukan dipaksa oleh sistem.
     */
    function pasangSkalaAgarTerlihat(seri, opsi, paksa) {
        try {
            if (!seri || typeof seri.applyOptions !== 'function') return;
            _paksaFokus = !!paksa;
            if (_autoscaleSebelumnya === null && typeof seri.options === 'function') {
                _autoscaleSebelumnya = seri.options().autoscaleInfoProvider || null;
            }
            seri.applyOptions({
                autoscaleInfoProvider: (asli) => {
                    try {
                        const info = (typeof asli === 'function') ? asli() : null;
                        if (!info || !info.priceRange) return info;
                        const dMin = info.priceRange.minValue, dMax = info.priceRange.maxValue;
                        const minP = Math.min(dMin, opsi.sl, opsi.tp, opsi.entry);
                        const maxP = Math.max(dMax, opsi.sl, opsi.tp, opsi.entry);
                        const rentangData = Math.max(dMax - dMin, 1e-9);
                        const tambahan = ((maxP - minP) - rentangData) / rentangData;
                        // Terlalu jauh dan pengguna tidak meminta fokus → jangan ganggu skala.
                        if (!_paksaFokus && tambahan > 0.35) return info;
                        const pad = Math.max((maxP - minP) * 0.08, 1e-9);
                        return { priceRange: { minValue: minP - pad, maxValue: maxP + pad } };
                    } catch (e) { return (typeof asli === 'function') ? asli() : null; }
                }
            });
        } catch (e) {}
    }

    function lepasSkala() {
        try {
            if (seriRef && typeof seriRef.applyOptions === 'function') {
                seriRef.applyOptions({ autoscaleInfoProvider: _autoscaleSebelumnya });
            }
        } catch (e) {}
        _autoscaleSebelumnya = null;
    }

    /** Hentikan percobaan ulang (dipakai saat hapus / selesai menggambar). */
    function hentikanCobaUlang() {
        if (_cobaUlang) { try { clearInterval(_cobaUlang); } catch (e) {} _cobaUlang = null; }
    }

    function warna() {
        try {
            const s = window.getComputedStyle(document.documentElement);
            const v = (n, c) => ((s.getPropertyValue(n) || '').trim() || c);
            return { naik: v('--qi-green', '#10B981'), turun: v('--qi-red', '#EF4444'), teks: v('--qi-text', '#F0F0F0') };
        } catch (e) { return { naik: '#10B981', turun: '#EF4444', teks: '#F0F0F0' }; }
    }

    /** #RRGGBB + alfa → #RRGGBBAA (selain hex dibiarkan apa adanya). */
    function alfa(w, a) { return /^#[0-9a-fA-F]{6}$/.test(String(w)) ? w + a : w; }

    function pastikanLapisan(container) {
        if (!container) return null;
        if (lapisan && lapisan.parentElement === container) return lapisan;
        hapus();
        try {
            if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
        } catch (e) { container.style.position = 'relative'; }
        lapisan = document.createElement('div');
        lapisan.className = NAMA_KELAS;
        lapisan.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden';
        container.appendChild(lapisan);
        return lapisan;
    }

    function kotak(l, yAtas, yBawah, warnaIsi, warnaGaris, xKiri) {
        const d = document.createElement('div');
        const tinggi = Math.max(1, yBawah - yAtas);
        d.style.cssText = 'position:absolute;left:' + Math.max(0, xKiri || 0).toFixed(1) + 'px;right:0;'
            + 'top:' + yAtas.toFixed(1) + 'px;height:' + tinggi.toFixed(1) + 'px;'
            + 'background:' + warnaIsi + ';border-top:1px solid ' + warnaGaris + ';border-bottom:1px solid ' + warnaGaris + ';';
        l.appendChild(d);
        return d;
    }

    function label(l, y, teks, warnaIsi, tinggiBaris) {
        const d = document.createElement('div');
        const atas = Math.max(0, y - 8);
        d.style.cssText = 'position:absolute;right:0;top:' + atas.toFixed(1) + 'px;'
            + 'background:' + warnaIsi + ';color:#0B1220;font:700 10px/16px ui-monospace,SFMono-Regular,Menlo,monospace;'
            + 'padding:0 6px;border-radius:3px;white-space:nowrap;';
        d.textContent = teks;
        l.appendChild(d);
        return d;
    }

    /** Hitung ulang posisi semua kotak (dipanggil saat zoom/geser/resize/data berubah). */
    function perbarui() {
        if (!lapisan || !dataZona || !seriRef) return;
        try {
            const w = warna();
            const tinggiArea = (lapisan.clientHeight || lapisan.offsetHeight || 300);
            const yEntry = seriRef.priceToCoordinate(dataZona.entry);
            const yTp = seriRef.priceToCoordinate(dataZona.tp);
            const ySl = seriRef.priceToCoordinate(dataZona.sl);

            // PENTING (bug nyata): periksa koordinat SEBELUM menghapus isi lapisan.
            // Dulu urutannya menghapus dulu lalu berhenti ketika koordinat belum siap
            // (mis. dipicu ResizeObserver saat chart sedang menggambar) — akibatnya
            // kotak yang sudah tampil IKUT TERHAPUS dan pengguna hanya melihat kedipan.
            // Entry wajib terlihat; kalau tidak, biarkan gambar yang ada apa adanya.
            if (!Number.isFinite(yEntry)) {
                // Chart belum siap (ukuran/rentang belum final — sering terjadi tepat
                // setelah panel dibuka atau daftar dihitung ulang). Dulu di sini fungsi
                // hanya berhenti, sehingga kotak tidak pernah muncul. Sekarang dicoba
                // ulang beberapa kali sampai koordinat tersedia, lalu berhenti sendiri.
                if (!_cobaUlang) {
                    let sisa = 15;
                    _cobaUlang = setInterval(() => {
                        sisa--;
                        try { perbarui(); } catch (e) {}
                        if (sisa <= 0 || (lapisan && lapisan.childElementCount > 0)) hentikanCobaUlang();
                    }, 180);
                }
                return;
            }

            while (lapisan.firstChild) lapisan.removeChild(lapisan.firstChild);

            // TP/SL sering berada DI LUAR area tampil (R:R 2–4 berarti target jauh).
            // Bug nyata: dulu koordinat null membuat SELURUH kotak tidak digambar.
            // Sekarang harga luar dijepit ke tepi (seperti TradingView) dan diberi
            // tanda "di luar layar" — jujur, dan kotaknya tetap terlihat.
            const jepit = (y, harga, arahLuar) => {
                if (Number.isFinite(y)) return { y: Math.max(0, Math.min(tinggiArea, y)), luar: (y < 0 || y > tinggiArea) };
                return { y: arahLuar > 0 ? 0 : tinggiArea, luar: true };
            };
            const tpAman = jepit(yTp, dataZona.tp, dataZona.tp > dataZona.entry ? 1 : -1);
            const slAman = jepit(ySl, dataZona.sl, dataZona.sl < dataZona.entry ? -1 : 1);
            const yEntryAman = Math.max(0, Math.min(tinggiArea, yEntry));

            const naik = dataZona.arah !== 'SELL';
            const zonaTp = naik ? [yEntryAman, tpAman.y] : [tpAman.y, yEntryAman];
            const zonaSl = naik ? [slAman.y, yEntryAman] : [yEntryAman, slAman.y];

            // Rentang mendatar: mulai dari CANDLE TERAKHIR ke kanan (seperti alat posisi
            // TradingView), bukan seluruh lebar chart — supaya jelas sejak kapan setup
            // ini berlaku. Bila waktu candle tidak diketahui, jatuh ke 0 (lebar penuh).
            let xKiri = 0;
            try {
                if (dataZona.waktu && chartRef && chartRef.timeScale) {
                    const x = chartRef.timeScale().timeToCoordinate(dataZona.waktu);
                    if (Number.isFinite(x)) xKiri = Math.max(0, Math.min(x, (lapisan.clientWidth || 0) - 6));
                }
            } catch (e) {}

            kotak(lapisan, Math.min(...zonaTp), Math.max(...zonaTp), alfa(w.naik, '2E'), alfa(w.naik, 'AA'), xKiri);
            kotak(lapisan, Math.min(...zonaSl), Math.max(...zonaSl), alfa(w.turun, '2E'), alfa(w.turun, 'AA'), xKiri);

            label(lapisan, tpAman.y, 'tp ' + format(dataZona.tp) + (tpAman.luar ? ' ⇡' : ''), w.naik);
            label(lapisan, yEntryAman, 'entry ' + format(dataZona.entry), w.teks === '#F0F0F0' ? '#94A3B8' : w.teks);
            label(lapisan, slAman.y, 'sl ' + format(dataZona.sl) + (slAman.luar ? ' ⇣' : ''), w.turun);
            if (dataZona.label) {
                const d = document.createElement('div');
                d.style.cssText = 'position:absolute;left:' + Math.max(0, xKiri).toFixed(1) + 'px;top:4px;color:' + alfa(w.teks, 'CC') + ';font:700 10px/14px ui-monospace,monospace;padding:0 6px;';
                d.textContent = dataZona.label + ((tpAman.luar || slAman.luar) ? ' · sebagian di luar layar' : '');
                lapisan.appendChild(d);
            }
        } catch (e) { /* overlay gagal → chart tetap aman */ }
    }

    function format(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return '-';
        const p = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 10 ? 2 : 4;
        return n.toLocaleString('en-US', { minimumFractionDigits: p, maximumFractionDigits: p });
    }

    /**
     * @param {HTMLElement} container  pembungkus chart (tempat overlay ditempel)
     * @param {Object} chart           instance lightweight-charts
     * @param {Object} seri            seri candle (untuk priceToCoordinate)
     * @param {Object} opsi            { entry, tp, sl, arah, label, waktu }
     */
    function gambar(container, chart, seri, opsi) {
        try {
            if (!container || !chart || !seri || !opsi) return false;
            if (![opsi.entry, opsi.tp, opsi.sl].every(v => Number.isFinite(Number(v)))) return false;

            // ⚠️ URUTAN INI PENTING — AKAR BUG YANG DITEMUKAN:
            // pastikanLapisan() memanggil hapus() ketika harus MEMBUAT lapisan baru,
            // dan hapus() mengosongkan dataZona / seriRef / chartRef. Dulu data diisi
            // SEBELUM pemanggilan itu, sehingga pengambaran PERTAMA setelah pembersihan
            // selalu kosong (kotak tidak muncul), sementara pengambaran KEDUA berhasil —
            // gejala "sonomet" yang sangat membingungkan. Sekarang lapisan disiapkan
            // lebih dulu, baru data diisi.
            if (!pastikanLapisan(container)) return false;

            chartRef = chart; seriRef = seri;
            dataZona = {
                entry: Number(opsi.entry), tp: Number(opsi.tp), sl: Number(opsi.sl),
                arah: (opsi.arah === 'SELL') ? 'SELL' : 'BUY', label: opsi.label || '',
                waktu: opsi.waktu || null      // waktu candle terakhir → titik awal kotak
            };
            // Skala harga disesuaikan agar entry, TP, dan SL semuanya terlihat.
            pasangSkalaAgarTerlihat(seri, dataZona);

            // Ikuti perubahan tampilan: rentang waktu, ukuran, dan data baru.
            if (!bersihkanLangganan) {
                const langganan = [];
                try {
                    if (chart.timeScale().subscribeVisibleLogicalRangeChange) {
                        chart.timeScale().subscribeVisibleLogicalRangeChange(perbarui);
                        langganan.push(() => { try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(perbarui); } catch (e) {} });
                    }
                } catch (e) {}
                try {
                    if (typeof ResizeObserver === 'function') {
                        pengamat = new ResizeObserver(perbarui);
                        pengamat.observe(container);
                        langganan.push(() => { try { pengamat.disconnect(); } catch (e) {} });
                    }
                } catch (e) {}
                bersihkanLangganan = () => { langganan.forEach(f => { try { f(); } catch (e) {} }); pengamat = null; };
            }
            perbarui();
            // Satu kali lagi setelah frame berikutnya: koordinat kadang baru final
            // setelah library selesai menggambar (menghindari kotak "melompat").
            try { requestAnimationFrame(perbarui); } catch (e) {}
            // Nyalakan penyegerak koordinat (menangani geser/zoom SKALA HARGA).
            _tandaKoordinat = tandaKoordinat();
            mulaiPenyegerak();
            return true;
        } catch (e) { return false; }
    }

    /**
     * Minta tampilan penuh: perluas skala harga agar entry, TP, dan SL terlihat semua.
     * Dipakai tombol "⤢ Fokus posisi" di panel Mesin 9 — jadi perluasan skala terjadi
     * karena PERMINTAAN pengguna, bukan dipaksa otomatis (penyebab candle terkompresi).
     */
    function fokus() {
        try {
            if (!seriRef || !dataZona) return false;
            pasangSkalaAgarTerlihat(seriRef, dataZona, true);
            return true;
        } catch (e) { return false; }
    }

    function hapus() {
        hentikanCobaUlang();
        hentikanPenyegerak();
        // Kembalikan skala harga ke keadaan semula SEBELUM seri dilepas, supaya
        // penyetelan otomatis milik chart tidak tertinggal.
        lepasSkala();
        try { if (lapisan && lapisan.parentElement) lapisan.parentElement.removeChild(lapisan); } catch (e) {}
        lapisan = null; dataZona = null;
        try { if (bersihkanLangganan) bersihkanLangganan(); } catch (e) {}
        bersihkanLangganan = null; chartRef = null; seriRef = null;
    }

    window.QuantumChartZones = { gambar, hapus, perbarui, fokus, ada: () => !!dataZona };
})();
