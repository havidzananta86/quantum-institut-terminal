/**
 * MESIN 9 — evaluator sinyal untuk 9 mesin kuantum Quantum Institut.
 *
 * KENAPA BERKAS INI ADA
 * 9 mesin sudah ada di aplikasi ini, tetapi hanya dipakai sebagai logika BACKTEST
 * (rumus ringkas di dalam runSimulation) dan hanya SATU mesin bisa tampil di chart
 * pada satu waktu (lewat engineSelector). Pengguna ingin melihat ke-9 mesin bekerja
 * BERSAMAAN di chart, beserta skor gabungannya.
 *
 * Berkas ini mengimplementasikan 9 mesin itu sebagai INDIKATOR SUNGGUHAN
 * (EMA200 betulan, Ichimoku lengkap, Fibonacci, order block/FVG, MACD histogram, dst)
 * yang mengembalikan putusan + skor + level (entry/SL/TP) untuk candle TERAKHIR.
 *
 * ATURAN KEJUJURAN (penting):
 *  - Bila data kurang dari yang dibutuhkan, mesin TIDAK menebak: arah NETRAL dengan
 *    alasan "data kurang". Tidak ada angka karangan.
 *  - Setiap mesin mengembalikan `alasan` singkat supaya pengguna tahu MENGAPA.
 *  - Umur bar terakhir dihitung; bila data basi, hasilnya ditandai `basi: true`
 *    supaya panel bisa memperingatkan alih-alih menyajikan sinyal dari harga lama.
 *
 * Skor = keyakinan 0..100 (0 berarti tidak ada sinyal).
 * Konfluensi = jumlah berbobot putusan BUY (+skor) dan SELL (−skor) dari 9 mesin.
 */
(function () {
    'use strict';

    // Batas GLOBAL jumlah bar: di bawah ini tidak ada mesin yang bisa bermakna.
    // Di atasnya, tiap mesin diperiksa kebutuhannya sendiri (lihat `butuh`),
    // sehingga forex/emas (≈171 bar dari sumber gratis) tetap bisa memakai
    // SNR/SMC/FIBO/TrenM5/MACD, sementara EMA200/Ichimoku/Golden Cross berkata jujur.
    // Konstanta ini ada di lingkup modul supaya yang diekspor SAMA dengan yang dipakai
    // (sebelumnya ekspor masih 220 sementara perhitungan memakai 60 — tidak konsisten).
    const MIN_BAR = 60;

    /** Ambang skor minimum agar sebuah arah dianggap SETUP (bukan sekadar bias).
     *  Di bawah ini mesin berkata "belum layak disebut sinyal". Nilai 50 memisahkan KEADAAN
     *  dari PERISTIWA pada skor yang dipakai sekarang:
     *   - di bawah (tidak memilih): SKOR_KEADAAN 40 (tren EMA200/EMA50 biasa, MomentumNY yang
     *     geraknya < 0,3×ATR), SNR "paruh rentang 40 bar" 45, TrenM5 dengan percepatan
     *     < ±0,42×ATR (skornya 45 + percepatan/ATR×12);
     *   - di atas (memilih bila level strukturnya sah): MomentumNY 58, order block SMC 60,
     *     retracement FIBO SELL 62, pullback EMA200 65–85, FVG SMC 78, FIBO golden zone 80,
     *     Ichimoku 82, golden/death cross baru 88, retest SNR 48–90.
     *  (Dulu komentar ini membenarkan angka 50 dengan "Golden Cross 52, EMA200 pullback 50" —
     *  keduanya KEADAAN tren yang sejak audit sinyal 2026-10-22 diberi SKOR_KEADAAN.)
     *  Ini SATU tempat untuk menyetelnya. */
    const AMBANG_SETUP = 50;

    /** Skor untuk KEADAAN (bukan peristiwa): sengaja di bawah AMBANG_SETUP sehingga tidak
     *  pernah ikut memberi suara. Audit sinyal 2026-10-22: dalam tren naik apa pun ≥200 bar,
     *  EMA200 (skor 50, "tren naik") dan GOLDEN_CROSS (skor 52, "EMA50 masih di atas EMA200")
     *  SELALU memberi suara BUY — dua suara dari SATU fakta (EMA50 vs EMA200) — lalu satu
     *  tick bar berjalan dari MOMENTUM_NY menggenapkannya menjadi 3 = MIN_SEPAKAT. Keadaan
     *  tren tetap dilaporkan apa adanya (alasannya terbaca), tetapi tidak dihitung bukti. */
    const SKOR_KEADAAN = 40;

    /** Pergeseran awan Ichimoku: Senkou A/B yang menaungi bar sekarang adalah yang dihitung
     *  26 bar sebelumnya (konvensi Hosoda/MT5; TradingView memplot dengan offset
     *  displacement−1 = 25, jadi bisa berbeda satu bar di tepi awan). */
    const GESER_AWAN = 26;

    // ── Indikator dasar ─────────────────────────────────────────────────────
    function sma(nilai, periode, idx) {
        const i = idx === undefined ? nilai.length - 1 : idx;
        if (i + 1 < periode) return null;
        let s = 0;
        for (let k = i - periode + 1; k <= i; k++) s += nilai[k];
        return s / periode;
    }

    function emaSeri(nilai, periode) {
        const keluar = new Array(nilai.length).fill(null);
        if (nilai.length < periode) return keluar;
        const k = 2 / (periode + 1);
        let prev = 0;
        for (let i = 0; i < periode; i++) prev += nilai[i];
        prev /= periode;
        keluar[periode - 1] = prev;
        for (let i = periode; i < nilai.length; i++) {
            prev = nilai[i] * k + prev * (1 - k);
            keluar[i] = prev;
        }
        return keluar;
    }

    /**
     * RSI WILDER — rumus yang SAMA dengan calcRSI/_calcRSI di dashboard-app.js (Signal Matrix &
     * panel RSI chart), _calcRSI14 di halaman-index.js, dan rumus RSI server. Kesamaannya
     * dikunci angka demi angka oleh tests/rsi-satu-rumus.test.js.
     *
     * Dulu mesin ini memakai rata-rata SEDERHANA 14 perubahan terakhir (Cutler), Signal Matrix
     * memakai Wilder atas 30 close terakhir saja, dan halaman depan rumus ketiga — pengguna
     * melihat sampai empat "RSI 14" berbeda untuk simbol dan TF yang sama. Audit sinyal
     * 2026-10-22 mereproduksi: 60 close turun lalu 30 close datar → versi 30-bar = 100
     * (dihitung sebagai suara BULL), Wilder riwayat penuh = 0.
     *
     * Aturannya:
     *  - riwayat PENUH: seed = rata-rata sederhana 14 perubahan PERTAMA, lalu penghalusan
     *    Wilder avg = (avg×(p−1) + nilai)/p sampai bar terakhir;
     *  - bar ber-rentang nol (open = high = low = close: candle "datar" saat pasar tutup/feed
     *    kosong) DIBUANG lebih dulu — itu bukan perdagangan. Hanya berlaku bila masukannya
     *    candle; deret angka close dipakai apa adanya;
     *  - semua perubahan nol (avgGain = avgLoss = 0) → 50, bukan 100;
     *  - avgLoss 0 (dan avgGain > 0) → 100;
     *  - perubahan kurang dari `periode` → tidak ada nilai (null / seri kosong), bukan tebakan.
     *
     * @param {Array<number|{open,high,low,close,time}>} data
     * @returns {Array<{i:number, value:number}>} i = indeks pada `data` asal
     */
    function rsiWilderSeri(data, periode) {
        const p = periode || 14;
        const titik = [];
        for (let i = 0; i < (data || []).length; i++) {
            const x = data[i];
            if (typeof x === 'number') { if (Number.isFinite(x)) titik.push({ i, c: x }); continue; }
            if (!x) continue;
            const c = Number(x.close);
            if (!Number.isFinite(c)) continue;
            if (Number(x.open) === Number(x.high) && Number(x.high) === Number(x.low) && Number(x.low) === c) continue;
            titik.push({ i, c });
        }
        const keluar = [];
        if (titik.length < p + 1) return keluar;
        let naik = 0, turun = 0;
        for (let k = 1; k <= p; k++) {
            const d = titik[k].c - titik[k - 1].c;
            if (d > 0) naik += d; else turun -= d;
        }
        naik /= p; turun /= p;
        const nilai = () => (naik === 0 && turun === 0) ? 50 : (turun === 0 ? 100 : 100 - 100 / (1 + naik / turun));
        keluar.push({ i: titik[p].i, value: nilai() });
        for (let k = p + 1; k < titik.length; k++) {
            const d = titik[k].c - titik[k - 1].c;
            naik = (naik * (p - 1) + (d > 0 ? d : 0)) / p;
            turun = (turun * (p - 1) + (d < 0 ? -d : 0)) / p;
            keluar.push({ i: titik[k].i, value: nilai() });
        }
        return keluar;
    }

    /** Nilai RSI Wilder terakhir, atau null bila data belum cukup. */
    function rsiWilder(data, periode) {
        const s = rsiWilderSeri(data, periode);
        return s.length ? s[s.length - 1].value : null;
    }

    function atr(candles, periode) {
        const p = periode || 14;
        if (candles.length < p + 1) return null;
        let jml = 0;
        for (let i = candles.length - p; i < candles.length; i++) {
            const c = candles[i], prev = candles[i - 1];
            jml += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
        }
        return jml / p;
    }

    function macdHist(nilai) {
        if (nilai.length < 35) return null;
        const e12 = emaSeri(nilai, 12), e26 = emaSeri(nilai, 26);
        const garis = [];
        for (let i = 0; i < nilai.length; i++) {
            if (e12[i] === null || e26[i] === null) { garis.push(null); continue; }
            garis.push(e12[i] - e26[i]);
        }
        const bersih = garis.filter(v => v !== null);
        const sig = emaSeri(bersih, 9);
        const hist = [];
        let j = 0;
        for (let i = 0; i < garis.length; i++) {
            if (garis[i] === null) continue;
            const s = sig[j];
            hist.push(s === null ? null : garis[i] - s);
            j++;
        }
        return hist.length >= 2 ? { hist: hist[hist.length - 1], histSebelum: hist[hist.length - 2] } : null;
    }

    /** Swing high/low dalam N candle terakhir (untuk level struktur). */
    function swing(candles, n) {
        const bagian = candles.slice(-n);
        let hi = -Infinity, lo = Infinity, iHi = 0, iLo = 0;
        bagian.forEach((c, i) => {
            if (c.high > hi) { hi = c.high; iHi = i; }
            if (c.low < lo) { lo = c.low; iLo = i; }
        });
        return { high: hi, low: lo, idxHigh: iHi, idxLow: iLo, n: bagian.length };
    }

    /** Level SL/TP berbasis ATR — DIPERTAHANKAN hanya sebagai cadangan internal.
     *  Sejak perbaikan "otak mesin", semua mesin memakai levelStruktur() di bawah,
     *  karena kelipatan ATR tidak tahu di mana pasar benar-benar berbalik. */
    function levelDariArah(candles, arah, atrVal, rasioSL, rasioTP) {
        const harga = candles[candles.length - 1].close;
        const a = atrVal || (harga * 0.005);
        const sl = arah === 'BUY' ? harga - a * (rasioSL || 1.5) : harga + a * (rasioSL || 1.5);
        const tp = arah === 'BUY' ? harga + a * (rasioTP || 3) : harga - a * (rasioTP || 3);
        return { entry: +harga.toFixed(6), sl: +sl.toFixed(6), tp: +tp.toFixed(6) };
    }

    /**
     * PIVOT (fractal) — titik balik NYATA: high/low yang lebih ekstrem daripada
     * `lebar` bar di kiri dan kanannya. Inilah "struktur pasar" yang dipakai untuk
     * menaruh SL/TP. Titik balik yang belum dikonfirmasi (kurang dari `lebar` bar di
     * kanannya) otomatis belum masuk — jadi tidak ada level yang mengarang.
     */
    function pivot(candles, lebar) {
        const w = Math.max(1, lebar || 3);
        const highs = [], lows = [];
        for (let i = w; i < candles.length - w; i++) {
            let yaHigh = true, yaLow = true;
            for (let j = i - w; j <= i + w; j++) {
                if (j === i) continue;
                // PENTING (bug nyata yang ditemukan lewat pengujian): perbandingan harus
                // TOLERAN terhadap harga yang SAMA. Pada titik balik, dua bar sering
                // berbagi harga ekstrem yang identik (mis. double bottom / double top).
                // Dengan perbandingan ketat (>=), KEDUA bar dibatalkan sehingga tidak ada
                // pivot sama sekali — padahal justru di situlah trader meletakkan SL.
                // Aturan sekarang: pada dataran (plateau) harga sama, yang menang adalah
                // bar PALING KANAN (yang terakhir) — konvensi yang lazim dipakai.
                const hj = candles[j].high, hi = candles[i].high;
                if (hj > hi || (hj === hi && j < i)) yaHigh = false;
                const lj = candles[j].low, li = candles[i].low;
                if (lj < li || (lj === li && j < i)) yaLow = false;
            }
            if (yaHigh) highs.push({ harga: candles[i].high, idx: i });
            if (yaLow) lows.push({ harga: candles[i].low, idx: i });
        }
        return { highs, lows };
    }

    /**
     * SL/TP BERBASIS STRUKTUR + GERBANG KEABSAHAN (ini "otak" yang diminta).
     *
     * Cara berpikirnya seperti trader, bukan rumus:
     *  1. SL diletakkan DI BELAKANG titik balik nyata (pivot) terdekat + penyangga
     *     kecil. Bila tidak ada titik balik di sisi itu → setup DITOLAK (tidak ada
     *     dasar untuk SL).
     *  2. TP diletakkan di titik balik nyata berikutnya. Bila resistance/support
     *     terdekat terlalu dekat sehingga R:R < 1,50 → setup DITOLAK (jangan
     *     memaksakan target). Bila memang TIDAK ADA level di depan (tren kuat),
     *     dipakai proyeksi terukur dan itu DIKATAKAN apa adanya.
     *  3. Gerbang tambahan: SL terlalu rapat (<0,4×ATR → rawan tersapu noise) atau
     *     terlalu jauh (>2,5×ATR → risiko tidak sepadan) → DITOLAK.
     *  4. Hasil memuat ZONA (area), bukan cuma satu harga.
     *
     * Mengembalikan {valid:false, alasan} bila tidak layak — dan mesin yang menerima
     * itu akan berkata "tidak ada setup", bukan memaksa BUY/SELL.
     */
    function levelStruktur(candles, arah, atrVal) {
        const n = candles.length;
        if (n < 20) return { valid: false, alasan: 'Data terlalu sedikit untuk membaca struktur' };
        const entry = candles[n - 1].close;
        const a = atrVal || entry * 0.005;
        const buf = a * 0.35;
        const bagian = candles.slice(-120);

        // Dua skala struktur: minor (3 bar) untuk pegangan, mayor (8 bar) untuk swing
        // yang benar-benar berarti. Swing mayor dipakai lebih dulu — inilah bedanya
        // "menaruh SL di bawah swing low yang nyata" vs "di jarak yang dikarang".
        const pvMinor = pivot(bagian, 3);
        const pvMayor = pivot(bagian, 8);
        const lows = pvMayor.lows.length >= 2 ? pvMayor.lows : pvMinor.lows;
        const highs = pvMayor.highs.length >= 2 ? pvMayor.highs : pvMinor.highs;

        const zona = (pusat, lebar) => ({ dari: +(pusat - lebar).toFixed(6), ke: +(pusat + lebar).toFixed(6) });
        let sl = null, tp = null, slSumber = '', tpSumber = '', alasan = null;

        if (arah === 'BUY' || arah === 'SELL') {
            const beli = arah === 'BUY';
            // ── SL: pilih struktur TERDEKAT yang masih wajar ────────────────────
            // Kandidat datang dari dua skala: minor (3 bar) dan mayor (8 bar).
            // Yang dipilih adalah yang TERAPAT tetapi tidak lebih rapat dari 0,5×ATR
            // (supaya tidak tersapu noise). Inilah cara trader memilih stop: di balik
            // swing nyata terdekat yang cukup berarti — bukan selalu swing terbesar
            // (yang bisa 4×ATR jauhnya sehingga risiko tidak sepadan).
            const dasarSL = (pv) => (beli ? pv.lows : pv.highs).map(p => p.harga).filter(h => beli ? h < entry : h > entry);
            const minorSL = dasarSL(pvMinor), mayorSL = dasarSL(pvMayor);
            const kandidat = [];
            if (minorSL.length) kandidat.push({ harga: minorSL[minorSL.length - 1], sumber: beli ? 'swing low ' : 'swing high ' });
            if (mayorSL.length) kandidat.push({ harga: mayorSL[mayorSL.length - 1], sumber: beli ? 'swing low mayor ' : 'swing high mayor ' });

            if (!kandidat.length) {
                alasan = beli
                    ? 'Tidak ada swing low di bawah harga — tidak ada dasar untuk SL'
                    : 'Tidak ada swing high di atas harga — tidak ada dasar untuk SL';
            } else {
                let dipilih = null;
                for (const k of kandidat) {
                    const jarak = Math.abs(entry - (beli ? k.harga - buf : k.harga + buf));
                    if (jarak >= a * 0.5 && (dipilih === null || jarak < dipilih.jarak)) dipilih = Object.assign({ jarak }, k);
                }
                // Semua kandidat lebih rapat dari 0,5×ATR → pakai yang TERJAUH di antara
                // mereka (masih lebih baik daripada mengarang jarak).
                if (dipilih === null) {
                    dipilih = kandidat.map(k => Object.assign({ jarak: Math.abs(entry - (beli ? k.harga - buf : k.harga + buf)) }, k))
                        .sort((x, y) => y.jarak - x.jarak)[0];
                }
                sl = beli ? dipilih.harga - buf : dipilih.harga + buf;
                slSumber = dipilih.sumber + dipilih.harga.toFixed(2);
                const risiko = Math.abs(entry - sl);

                // ── TP: level nyata berikutnya, ATAU proyeksi 2R ────────────────
                // Bila ada level yang mencapai R:R 1,50 → pakai level itu.
                // Bila TIDAK ada (terlalu dekat semua) → JANGAN menolak setup yang
                // sebenarnya sah; pakai proyeksi 2R dan sebutkan level terdekat yang
                // dilewatinya supaya tidak menyesatkan.
                const sisiTP = (beli ? highs : lows).map(p => p.harga)
                    .filter(h => beli ? h > entry : h < entry)
                    .sort((x, y) => beli ? x - y : y - x);
                let ketemu = null;
                for (const kandidatTp of sisiTP) {
                    if (Math.abs(kandidatTp - entry) >= risiko * 1.5) { ketemu = kandidatTp; break; }
                }
                if (ketemu !== null) {
                    tp = ketemu;
                    tpSumber = (beli ? 'swing high ' : 'swing low ') + ketemu.toFixed(2);
                } else {
                    tp = beli ? entry + risiko * 2 : entry - risiko * 2;
                    tpSumber = sisiTP.length
                        ? `proyeksi 2× jarak SL (level terdekat ${sisiTP[0].toFixed(2)} hanya ${(Math.abs(sisiTP[0] - entry) / (risiko || 1)).toFixed(2)}R)`
                        : 'proyeksi 2× jarak SL (belum ada level di depan)';
                }
            }
        } else {
            alasan = 'Arah tidak dikenal';
        }

        if (!alasan) {
            const jarakSL = Math.abs(entry - sl);
            const jarakTP = Math.abs(tp - entry);
            const rr = jarakSL > 0 ? jarakTP / jarakSL : 0;
            if (jarakSL < a * 0.4) alasan = `SL terlalu rapat (${(jarakSL / a).toFixed(2)}×ATR) — rawan tersapu noise`;
            else if (jarakSL > a * 3.5) alasan = `SL terlalu jauh (${(jarakSL / a).toFixed(2)}×ATR) — risiko tidak sepadan`;
            else if (rr < 1.5) alasan = `R:R hanya ${rr.toFixed(2)} — di bawah ambang 1,50`;
            if (!alasan) {
                return {
                    entry: +entry.toFixed(6),
                    sl: +sl.toFixed(6),
                    tp: +tp.toFixed(6),
                    rr: +rr.toFixed(2),
                    slSumber, tpSumber,
                    zona: { sl: zona(sl, buf * 0.5), tp: zona(tp, buf * 0.5) },
                    valid: true
                };
            }
        }
        return { entry: +entry.toFixed(6), sl: null, tp: null, rr: null, valid: false, alasan };
    }

    const kosong = (alasan) => ({ arah: 'NETRAL', skor: 0, alasan: alasan, level: null });

    // ── Definisi 9 mesin ────────────────────────────────────────────────────
    // `butuh` = jumlah bar minimum agar mesin ini BERMAKNA. Mesin yang datanya belum
    // cukup mengembalikan NETRAL dengan alasan jujur ("butuh N bar") — bukan tebakan.
    // Ini penting untuk forex/emas: sumber gratis aplikasi hanya menyediakan ~171 bar,
    // sehingga EMA200/Ichimoku/Golden Cross memang belum bisa dipakai di sana, sementara
    // mesin lain (SNR/SMC/FIBO/TrenM5/MACD) tetap berjalan.
    const MESIN = [
        {
            kode: 'SNR', nama: 'Quantum SNR (Level & Retest)', butuh: 40,
            evaluasi(c, k) {
                const harga = c[c.length - 1].close;
                const s = swing(c, 40);
                const jarakLow = ((harga - s.low) / harga) * 100;
                const jarakHigh = ((s.high - harga) / harga) * 100;
                // Dekat support → peluang BUY; dekat resistance → peluang SELL.
                if (jarakLow <= 0.35) return { arah: 'BUY', skor: Math.round(90 - jarakLow * 120), alasan: `Harga ${jarakLow.toFixed(2)}% dari support ${s.low.toFixed(2)} (retest)`, level: levelStruktur(c, 'BUY', k.atr) };
                if (jarakHigh <= 0.35) return { arah: 'SELL', skor: Math.round(90 - jarakHigh * 120), alasan: `Harga ${jarakHigh.toFixed(2)}% dari resistance ${s.high.toFixed(2)}`, level: levelStruktur(c, 'SELL', k.atr) };
                if (harga > s.low + (s.high - s.low) * 0.5 && k.ema200 && harga > k.ema200)
                    return { arah: 'BUY', skor: 45, alasan: 'Di paruh atas rentang 40 bar dan di atas EMA200', level: levelStruktur(c, 'BUY', k.atr) };
                if (harga < s.low + (s.high - s.low) * 0.5 && k.ema200 && harga < k.ema200)
                    return { arah: 'SELL', skor: 45, alasan: 'Di paruh bawah rentang 40 bar dan di bawah EMA200', level: levelStruktur(c, 'SELL', k.atr) };
                return kosong('Harga di tengah rentang — belum ada level yang diuji');
            }
        },
        {
            kode: 'SMC', nama: 'Quantum SMC (Order Block & FVG)', butuh: 30,
            evaluasi(c, k) {
                const harga = c[c.length - 1].close;
                const bagian = c.slice(-30);
                // Fair Value Gap: celah antara high[i-2] dan low[i]
                let fvgNaik = null, fvgTurun = null;
                for (let i = 2; i < bagian.length; i++) {
                    if (bagian[i].low > bagian[i - 2].high) fvgNaik = { bawah: bagian[i - 2].high, atas: bagian[i].low };
                    if (bagian[i].high < bagian[i - 2].low) fvgTurun = { atas: bagian[i - 2].low, bawah: bagian[i].high };
                }
                if (fvgNaik && harga >= fvgNaik.bawah && harga <= fvgNaik.atas * 1.002)
                    return { arah: 'BUY', skor: 78, alasan: `Harga mengisi FVG naik ${fvgNaik.bawah.toFixed(2)}–${fvgNaik.atas.toFixed(2)}`, level: levelStruktur(c, 'BUY', k.atr) };
                if (fvgTurun && harga <= fvgTurun.atas && harga >= fvgTurun.bawah * 0.998)
                    return { arah: 'SELL', skor: 78, alasan: `Harga mengisi FVG turun ${fvgTurun.bawah.toFixed(2)}–${fvgTurun.atas.toFixed(2)}`, level: levelStruktur(c, 'SELL', k.atr) };
                // Order block sederhana: candle berlawanan terakhir sebelum impuls
                const prev = c[c.length - 2], prev2 = c[c.length - 3];
                if (prev && prev2 && prev2.close < prev2.open && harga > prev.high)
                    return { arah: 'BUY', skor: 60, alasan: 'Menembus order block bearish terakhir (perubahan struktur)', level: levelStruktur(c, 'BUY', k.atr) };
                if (prev && prev2 && prev2.close > prev2.open && harga < prev.low)
                    return { arah: 'SELL', skor: 60, alasan: 'Menembus order block bullish terakhir (perubahan struktur)', level: levelStruktur(c, 'SELL', k.atr) };
                return kosong('Tidak ada FVG/order block yang aktif di harga sekarang');
            }
        },
        {
            kode: 'EMA200', nama: 'Quantum EMA200 Pullback', butuh: 200,
            // HANYA PERISTIWA pullback (harga kembali ≤1% dari EMA200 dalam tren yang SUDAH mapan)
            // yang memberi suara. Keadaan "tren naik/turun" saja diberi SKOR_KEADAAN (tidak
            // memilih), dan persilangan EMA50/EMA200 yang baru (≤5 bar) diserahkan ke mesin
            // Golden Cross — fakta yang sama tidak boleh dihitung dua kali (audit 2026-10-22).
            evaluasi(c, k) {
                const harga = c[c.length - 1].close;
                if (!k.ema200 || !k.ema50) return kosong('EMA200 belum terbentuk (butuh 200 bar)');
                const jarak = ((harga - k.ema200) / k.ema200) * 100;
                const naik = harga > k.ema200 && k.ema50 > k.ema200;
                const turun = harga < k.ema200 && k.ema50 < k.ema200;
                if ((naik || turun) && k.silangBaru)
                    return { arah: naik ? 'BUY' : 'SELL', skor: SKOR_KEADAAN, alasan: 'EMA50 baru saja memotong EMA200 (≤5 bar) — peristiwa itu dinilai mesin Golden Cross, tidak dihitung dua kali', level: null };
                // "Tren yang SUDAH mapan" tidak bisa dipastikan bila umur persilangan belum diketahui
                // (200–204 bar): persilangannya bisa saja baru 1–2 bar.
                if ((naik || turun) && !k.silangDiketahui)
                    return { arah: naik ? 'BUY' : 'SELL', skor: SKOR_KEADAAN, alasan: 'Umur tren EMA50/EMA200 belum bisa dipastikan (butuh ≥205 bar) — pullback belum dinilai', level: null };
                if (naik && Math.abs(jarak) <= 1.0)
                    return { arah: 'BUY', skor: Math.round(85 - Math.abs(jarak) * 20), alasan: `Pullback ke EMA200 (${jarak.toFixed(2)}%) dalam tren naik`, level: levelStruktur(c, 'BUY', k.atr) };
                if (turun && Math.abs(jarak) <= 1.0)
                    return { arah: 'SELL', skor: Math.round(85 - Math.abs(jarak) * 20), alasan: `Pullback ke EMA200 (${jarak.toFixed(2)}%) dalam tren turun`, level: levelStruktur(c, 'SELL', k.atr) };
                if (naik) return { arah: 'BUY', skor: SKOR_KEADAAN, alasan: `Tren naik (harga & EMA50 di atas EMA200), tetapi harga ${jarak.toFixed(2)}% dari EMA200 — bukan pullback (≤1%)`, level: null };
                if (turun) return { arah: 'SELL', skor: SKOR_KEADAAN, alasan: `Tren turun (harga & EMA50 di bawah EMA200), tetapi harga ${jarak.toFixed(2)}% dari EMA200 — bukan pullback (≤1%)`, level: null };
                return kosong('Tren belum searah — EMA50 dan EMA200 bersilangan');
            }
        },
        {
            // butuh 78 = Senkou B 52 bar + pergeseran awan 26 bar.
            kode: 'ICHI', nama: 'Quantum Ichimoku Cloud', butuh: 52 + GESER_AWAN,
            evaluasi(c, k) {
                const harga = c[c.length - 1].close;
                const tengah = (bagian, n) => { const s = swing(bagian, n); return (s.high + s.low) / 2; };
                // Tenkan & Kijun SEKARANG: konfirmasi momentum di bar ini.
                const tenkan = tengah(c, 9);
                const kijun = tengah(c, 26);
                // AWAN yang menaungi bar sekarang adalah Senkou A/B yang dihitung GESER_AWAN bar
                // lalu (jendela berakhir di indeks n−27). Dulu awan dihitung dari jendela yang
                // berakhir di bar sekarang — yaitu awan yang di chart diplot 26 bar ke DEPAN —
                // sehingga "di atas awan" (skor 82, memberi suara) bisa bertentangan dengan
                // Ichimoku di chart/TradingView pada data yang sama (audit sinyal 2026-10-22).
                const lalu = c.slice(0, c.length - GESER_AWAN);
                const senkouA = (tengah(lalu, 9) + tengah(lalu, 26)) / 2;
                const senkouB = tengah(lalu, 52);
                const atas = Math.max(senkouA, senkouB), bawah = Math.min(senkouA, senkouB);
                const awan = { senkouA, senkouB, bawah, atas, tenkan, kijun };
                // Teks alasan masuk innerHTML panel: "Tenkan<Kijun" dibaca peramban sebagai tag
                // <kijun> dan sisa kalimatnya hilang — jadi ditulis dengan kata.
                if (harga > atas && tenkan > kijun)
                    return { arah: 'BUY', skor: 82, alasan: `Di atas awan (${bawah.toFixed(2)}–${atas.toFixed(2)}) & Tenkan di atas Kijun`, level: levelStruktur(c, 'BUY', k.atr), awan };
                if (harga < bawah && tenkan < kijun)
                    return { arah: 'SELL', skor: 82, alasan: `Di bawah awan (${bawah.toFixed(2)}–${atas.toFixed(2)}) & Tenkan di bawah Kijun`, level: levelStruktur(c, 'SELL', k.atr), awan };
                return Object.assign(kosong(`Harga di dalam/tepi awan (${bawah.toFixed(2)}–${atas.toFixed(2)}) atau Tenkan/Kijun belum searah — kondisi belum jelas`), { awan });
            }
        },
        {
            kode: 'FIBO', nama: 'Quantum Fibonacci Golden Zone', butuh: 60,
            evaluasi(c, k) {
                const harga = c[c.length - 1].close;
                const s = swing(c, 60);
                const rentang = s.high - s.low;
                if (rentang <= 0) return kosong('Rentang harga terlalu kecil');
                const f382 = s.high - rentang * 0.382;
                const f500 = s.high - rentang * 0.5;
                const f618 = s.high - rentang * 0.618;
                const dalamZona = harga <= f500 && harga >= f618;
                if (dalamZona && k.ema200 && harga > k.ema200)
                    return { arah: 'BUY', skor: 80, alasan: `Di golden zone 50–61,8% (${f618.toFixed(2)}–${f500.toFixed(2)}) dalam tren naik`, level: levelStruktur(c, 'BUY', k.atr) };
                if (harga <= f382 && harga >= f500 && k.ema200 && harga < k.ema200)
                    return { arah: 'SELL', skor: 62, alasan: `Retracement 38,2–50% (${f500.toFixed(2)}–${f382.toFixed(2)}) dalam tren turun`, level: levelStruktur(c, 'SELL', k.atr) };
                return kosong('Harga di luar zona Fibonacci yang dipantau');
            }
        },
        {
            kode: 'TRENM5', nama: 'Quantum TrenM5 Scalping', butuh: 15,
            evaluasi(c, k) {
                const n = c.length;
                if (n < 6) return kosong('Butuh minimal 6 bar');
                // RSI Wilder riwayat penuh (bar ber-rentang nol dibuang) — sama dengan panel RSI.
                const rsiVal = rsiWilder(c, 14);
                const mom1 = c[n - 1].close - c[n - 2].close;
                const mom2 = c[n - 2].close - c[n - 3].close;
                const percepatan = mom1 - mom2;
                if (percepatan > 0 && mom1 > 0 && rsiVal !== null && rsiVal < 72)
                    return { arah: 'BUY', skor: Math.min(85, 45 + Math.abs(percepatan) / (k.atr || 1) * 12), alasan: `Momentum menguat (RSI ${rsiVal.toFixed(0)})`, level: levelStruktur(c, 'BUY', k.atr) };
                if (percepatan < 0 && mom1 < 0 && rsiVal !== null && rsiVal > 28)
                    return { arah: 'SELL', skor: Math.min(85, 45 + Math.abs(percepatan) / (k.atr || 1) * 12), alasan: `Momentum melemah (RSI ${rsiVal.toFixed(0)})`, level: levelStruktur(c, 'SELL', k.atr) };
                return kosong('Momentum belum searah atau RSI ekstrem');
            }
        },
        {
            kode: 'MOMENTUM_NY', nama: 'Quantum MomentumNY (Gold)', butuh: 5,
            // Perbaikan audit sinyal 2026-10-22:
            //  - jam sesi dari WAKTU NYATA (k.sekarangDetik), bukan jam BUKA bar terakhir: bar D1
            //    selalu dibuka 00 UTC (mesin tak pernah "dalam sesi") dan bar H4 12:00 UTC
            //    dianggap di luar sesi padahal NY buka 13:00 di dalam bar itu;
            //  - arah dari bar yang SUDAH CLOSE, bukan tick bar yang masih berjalan;
            //  - geraknya wajib ≥ 0,3×ATR; di bawah itu derau → SKOR_KEADAAN (tidak memilih);
            //  - data basi (bar terakhir lewat >1 periode) → tidak ada momentum yang berjalan,
            //    karena waktu nyata "dalam sesi" tidak boleh dipasangkan dengan bar Jumat lalu.
            evaluasi(c, k) {
                const n = c.length;
                const sekarang = k.sekarangDetik;
                const iv = k.intervalDetik;
                const waktu = new Date(sekarang * 1000);
                const jam = waktu.getUTCHours();
                const pukul = String(jam).padStart(2, '0') + ':' + String(waktu.getUTCMinutes()).padStart(2, '0');
                const dalamSesi = jam >= 13 && jam < 21;   // 13:00–20:59 UTC ≈ sesi New York
                if (!dalamSesi) return kosong(`Di luar sesi New York (sekarang ${pukul} UTC; sesi 13:00–21:00 UTC)`);
                const tAkhir = Number(c[n - 1].time);
                if (sekarang >= tAkhir + 2 * iv) return kosong('Bar terakhir sudah lewat lebih dari satu periode — tidak ada momentum sesi yang sedang berjalan');
                // Bar terakhir yang SUDAH close: c[n−1] bila periodenya sudah lewat, selain itu c[n−2].
                const iTutup = sekarang >= tAkhir + iv ? n - 1 : n - 2;
                if (iTutup < 1) return kosong('Butuh minimal dua bar yang sudah close');
                if (!k.atr) return kosong('ATR belum tersedia — besar gerak tidak bisa diukur');
                const delta = c[iTutup].close - c[iTutup - 1].close;
                if (delta === 0) return kosong('Bar close terakhir tidak bergerak');
                const arah = delta > 0 ? 'BUY' : 'SELL';
                const kali = Math.abs(delta) / k.atr;
                if (kali < 0.3) {
                    return { arah, skor: SKOR_KEADAAN, alasan: `Sesi New York aktif, tetapi bar close terakhir hanya bergerak ${kali.toFixed(2)}×ATR (< 0,3×ATR) — derau, bukan momentum`, level: null };
                }
                return {
                    arah, skor: 58,
                    alasan: `Sesi New York aktif (${pukul} UTC) dan bar close terakhir ${arah === 'BUY' ? 'naik' : 'turun'} ${kali.toFixed(2)}×ATR`,
                    level: levelStruktur(c, arah, k.atr)
                };
            }
        },
        {
            kode: 'MACD_MOM', nama: 'Quantum MACD Momentum', butuh: 35,
            evaluasi(c, k) {
                const m = macdHist(c.map(x => x.close));
                if (!m) return kosong('MACD belum terbentuk (butuh ±35 bar)');
                if (m.hist > 0 && m.hist > m.histSebelum)
                    return { arah: 'BUY', skor: Math.min(88, 55 + Math.abs(m.hist) / (k.atr || 1) * 25), alasan: 'Histogram MACD positif dan menguat', level: levelStruktur(c, 'BUY', k.atr) };
                if (m.hist < 0 && m.hist < m.histSebelum)
                    return { arah: 'SELL', skor: Math.min(88, 55 + Math.abs(m.hist) / (k.atr || 1) * 25), alasan: 'Histogram MACD negatif dan melemah', level: levelStruktur(c, 'SELL', k.atr) };
                return kosong('MACD kehilangan momentum (histogram mengecil)');
            }
        },
        {
            kode: 'GOLDEN_CROSS', nama: 'Quantum Golden Cross', butuh: 200,
            // Hanya PERSILANGAN BARU (≤5 bar) yang memberi suara. "EMA50 masih di atas EMA200"
            // adalah keadaan yang sama dengan yang dibaca mesin EMA200 → SKOR_KEADAAN (dulu 52,
            // ikut memilih setiap saat dalam tren — audit sinyal 2026-10-22).
            evaluasi(c, k) {
                const ema50 = k.ema50, ema200 = k.ema200;
                if (!ema50 || !ema200) return kosong('EMA50/EMA200 belum terbentuk');
                if (k.silangBaru === 'NAIK')
                    return { arah: 'BUY', skor: 88, alasan: 'Golden cross baru saja terjadi (EMA50 memotong ke atas EMA200 dalam 5 bar terakhir)', level: levelStruktur(c, 'BUY', k.atr) };
                if (k.silangBaru === 'TURUN')
                    return { arah: 'SELL', skor: 88, alasan: 'Death cross baru saja terjadi (EMA50 memotong ke bawah EMA200 dalam 5 bar terakhir)', level: levelStruktur(c, 'SELL', k.atr) };
                // 200–204 bar: EMA200 lima bar lalu belum terbentuk, jadi UMUR persilangan tidak
                // diketahui — bisa saja baru 1–2 bar. Dulu teksnya tetap menyimpulkan "bukan
                // persilangan baru" tepat setelah mengaku tidak bisa memastikan (telaah ulang G3b).
                if (!k.silangDiketahui)
                    return kosong(`EMA50 ${ema50 > ema200 ? 'di atas' : 'di bawah'} EMA200, tetapi kapan keduanya bersilangan belum bisa dipastikan (butuh ≥205 bar) — tidak dinilai`);
                if (ema50 > ema200) return { arah: 'BUY', skor: SKOR_KEADAAN, alasan: 'EMA50 di atas EMA200 sudah lebih dari 5 bar — keadaan tren, bukan persilangan baru', level: null };
                return { arah: 'SELL', skor: SKOR_KEADAAN, alasan: 'EMA50 di bawah EMA200 sudah lebih dari 5 bar — keadaan tren, bukan persilangan baru', level: null };
            }
        }
    ];

    /**
     * Konteks bersama 9 mesin — dihitung SEKALI per evaluasi.
     *  - silangBaru: 'NAIK' / 'TURUN' bila EMA50 memotong EMA200 dalam 5 bar terakhir (tanda
     *    selisih di bar n−6 berbeda dengan bar n−1), selain itu null. Dibaca DUA mesin (EMA200
     *    dan GOLDEN_CROSS) supaya satu peristiwa hanya dihitung oleh satu mesin.
     *  - sekarangDetik: waktu NYATA penilaian (bawaan Date.now()); markerSinyal mengisinya
     *    dengan akhir bar yang sedang diputar ulang supaya tidak mengintip masa depan.
     */
    function buatKonteks(candles, o) {
        const harga = candles.map(x => x.close);
        const n = harga.length;
        const e50 = emaSeri(harga, 50), e200 = emaSeri(harga, 200);
        const ema50 = e50[n - 1], ema200 = e200[n - 1];
        let silangBaru = null, silangDiketahui = false;
        if (n >= 6 && e50[n - 6] !== null && e200[n - 6] !== null && ema50 !== null && ema200 !== null) {
            silangDiketahui = true;
            if (e50[n - 6] <= e200[n - 6] && ema50 > ema200) silangBaru = 'NAIK';
            else if (e50[n - 6] >= e200[n - 6] && ema50 < ema200) silangBaru = 'TURUN';
        }
        const sekarangDetik = (typeof o.sekarangDetik === 'number' && isFinite(o.sekarangDetik)) ? o.sekarangDetik : Date.now() / 1000;
        return { harga, atr: atr(candles, 14), ema50, ema200, silangBaru, silangDiketahui, sekarangDetik, intervalDetik: o.intervalDetik || 3600 };
    }

    /**
     * Putusan bertingkat dari hasil per mesin — fungsi murni (diekspor untuk uji).
     * HANYA mesin dengan setup SAH yang memberi suara; yang ditolak (skor rendah / tanpa level
     * struktur / R:R kurang) tetap ditampilkan beserta alasannya, tetapi tidak ikut memutuskan.
     *
     *   TIDAK ADA SETUP  : tidak satu pun mesin punya setup sah
     *   BELUM CUKUP BUKTI: ada setup sah, tapi belum MIN_SEPAKAT mesin sepakat
     *   NETRAL           : cukup mesin bersuara tapi arahnya berbelah
     *   BUY / SELL       : dominasi jelas (≥ MIN_SEPAKAT sepakat dan minimal 2× pihak lawan)
     *
     * MIN_SEPAKAT menghitung BUKTI INDEPENDEN, bukan sekadar jumlah mesin: fakta yang sama
     * tidak boleh memberi suara dua kali.
     *  - "Tren EMA50 > EMA200" (dibaca EMA200 dan GOLDEN_CROSS) hanya memberi suara lewat
     *    PERISTIWA-nya — pullback ≤1% ke EMA200 dalam tren mapan, ATAU persilangan baru ≤5 bar,
     *    tidak keduanya sekaligus. Keadaan biasa diberi SKOR_KEADAAN (di bawah AMBANG_SETUP).
     *  - Mesin MOMENTUM (TRENM5, MOMENTUM_NY, MACD_MOM — lihat KELOMPOK_BUKTI) dihitung paling
     *    banyak SATU bukti per arah, karena ketiganya membaca perubahan close terbaru yang sama.
     * Jumlah mesin per arah (bullish/bearish) tetap dilaporkan apa adanya; putusan memakai
     * buktiBullish/buktiBearish. Skor (rata-rata berbobot) tetap dari semua setup sah.
     * Ambang 3 bukti: cukup ketat untuk menolak derau, tetapi tidak membuat panel bisu
     * selamanya. Bisa disetel di satu tempat ini.
     */
    const MIN_SEPAKAT = 3;

    /** Mesin yang membaca FAKTA YANG SAMA → satu kunci bukti. Telaah ulang G3b: saat bar
     *  terakhir masih berjalan, Δclose bar yang sudah close (MOMENTUM_NY) PERSIS sama dengan mom2
     *  TrenM5, dan BUY TrenM5 hanya butuh mom1 > mom2 dan mom1 > 0 — dua close naik berturut-
     *  turut cukup untuk kedua suara; "histogram MACD menguat" membaca close terbaru yang sama;
     *  ketiganya pun memakai levelStruktur dengan masukan identik (sah/tidak sah bersamaan).
     *  Pada 400 jalan acak H1, 1.440 dari 4.105 putusan
     *  BUY/SELL (35%) bersandar pada ≥2 dari tiga mesin ini dengan <2 mesin lain yang searah,
     *  dan ada putusan BUY yang HANYA terdiri dari ketiganya (TrenM5 51 + MomentumNY 58 +
     *  MACD 60). Mesin lain (atau hasil tanpa `kode`) masing-masing satu bukti. */
    const KELOMPOK_BUKTI = { TRENM5: 'momentum', MOMENTUM_NY: 'momentum', MACD_MOM: 'momentum' };

    function hitungKonfluensi(hasil) {
        let jumlah = 0, bullish = 0, bearish = 0, setupValid = 0;
        const buktiBeli = new Set(), buktiJual = new Set();
        hasil.forEach((h, i) => {
            if (!h.valid) return;
            setupValid++;
            const kunci = KELOMPOK_BUKTI[h.kode] || ('mesin:' + (h.kode || i));
            if (h.arah === 'BUY') { jumlah += h.skor; bullish++; buktiBeli.add(kunci); }
            else if (h.arah === 'SELL') { jumlah -= h.skor; bearish++; buktiJual.add(kunci); }
        });
        const buktiBullish = buktiBeli.size, buktiBearish = buktiJual.size;
        const skor = setupValid ? Math.round(Math.min(100, Math.abs(jumlah) / setupValid)) : 0;

        let putusan;
        if (setupValid === 0) putusan = 'TIDAK ADA SETUP';
        else if (Math.max(buktiBullish, buktiBearish) < MIN_SEPAKAT) putusan = 'BELUM CUKUP BUKTI';
        else if (buktiBullish >= MIN_SEPAKAT && buktiBullish >= buktiBearish * 2 && jumlah > 0) putusan = 'BUY';
        else if (buktiBearish >= MIN_SEPAKAT && buktiBearish >= buktiBullish * 2 && jumlah < 0) putusan = 'SELL';
        else putusan = 'NETRAL';

        let keyakinan;
        if (putusan === 'TIDAK ADA SETUP') keyakinan = 'tidak ada setup';
        // Panel menampilkan "N BUY": bila N ≥ MIN_SEPAKAT tetapi buktinya kurang, katakan sebabnya.
        else if (putusan === 'BELUM CUKUP BUKTI') keyakinan = Math.max(bullish, bearish) >= MIN_SEPAKAT ? 'bukti kurang (mesin momentum = 1 bukti)' : 'bukti kurang';
        else if (putusan === 'NETRAL') keyakinan = 'terbelah';
        else if (skor >= 60 && setupValid >= 5) keyakinan = 'kuat';
        else if (skor >= 35) keyakinan = 'sedang';
        else keyakinan = 'lemah';

        return {
            skor, jumlah, bullish, bearish, buktiBullish, buktiBearish,
            netral: hasil.length - bullish - bearish,
            setupValid, ambangSetup: AMBANG_SETUP, minSepakat: MIN_SEPAKAT,
            putusan, keyakinan
        };
    }

    /**
     * Evaluasi ke-9 mesin untuk candle yang diberikan.
     * @param {Array} candles  [{time,open,high,low,close,volume}]
     * @param {Object} opsi    { intervalDetik, sekarangDetik }
     */
    function evaluasi(candles, opsi) {
        const o = opsi || {};
        const intervalDetik = o.intervalDetik || 3600;

        if (!Array.isArray(candles) || candles.length === 0) {
            return { cukupData: false, alasan: 'Tidak ada data candle.', basi: true, umurDetik: null, mesin: [], konfluensi: null };
        }
        // Candle SIMULASI (angka acak dari server saat semua sumber nyata gagal) tidak pernah
        // dinilai. Dulu penolakan hanya ada di pemanggil (dashboard-pro ambilCandle) dan
        // tandaiSinyalMesin tidak memeriksanya sama sekali — panah BUY/SELL dari data karangan.
        if (candles.simulated === true) {
            return {
                cukupData: false, simulasi: true,
                alasan: 'Data candle ditandai SIMULASI (angka acak saat sumber harga nyata gagal) — 9 mesin tidak menilai data karangan.',
                basi: true, umurDetik: null, mesin: [], konfluensi: null
            };
        }

        const ctx = buatKonteks(candles, Object.assign({}, o, { intervalDetik }));
        const umurDetik = Math.max(0, Math.floor(ctx.sekarangDetik) - Number(candles[candles.length - 1].time));
        const basi = umurDetik > intervalDetik * 3;

        // Batas global dipakai dari lingkup modul (lihat konstanta MIN_BAR di atas).
        if (candles.length < MIN_BAR) {
            return {
                cukupData: false,
                alasan: `Data hanya ${candles.length} bar; minimal ${MIN_BAR} bar agar mesin bisa menilai.`,
                basi, umurDetik,
                mesin: MESIN.map(m => ({ kode: m.kode, nama: m.nama, arah: 'NETRAL', skor: 0, alasan: `Butuh minimal ${m.butuh} bar`, level: null, melawanTren: false })),
                konfluensi: { skor: 0, jumlah: 0, bullish: 0, bearish: 0, netral: MESIN.length, putusan: 'NETRAL', keyakinan: 'data kurang' }
            };
        }

        const hasil = MESIN.map(m => {
            // Kebutuhan bar per mesin: bila belum cukup, katakan terus terang.
            if (candles.length < (m.butuh || 0)) {
                return {
                    kode: m.kode, nama: m.nama, arah: 'NETRAL', skor: 0,
                    alasan: `Butuh ${m.butuh} bar, tersedia ${candles.length} — belum bisa dinilai`,
                    level: null, melawanTren: false, valid: false
                };
            }
            let r;
            try {
                r = m.evaluasi(candles, ctx) || kosong('Tidak ada sinyal');
            } catch (e) {
                r = kosong('Mesin gagal menghitung (dilewati)');
            }
            let arah = r.arah;
            let alasan = r.alasan || '';
            let level = r.level || null;

            // ── GERBANG KEABSAHAN ───────────────────────────────────────────
            // Ini yang membuat mesin "berpikir" alih-alih selalu memberi arah:
            //  (1) skor di bawah ambang → bukan setup, cukup dikatakan apa adanya
            //      (alasan asli mesin tetap disebut, mis. "tren naik tetapi bukan pullback");
            //  (2) tidak ada level struktur yang sah (SL/TP tidak punya dasar,
            //      SL terlalu rapat/jauh, atau R:R di bawah 1,50) → setup ditolak.
            // Mesin yang ditolak TIDAK ikut memberi suara di konfluensi.
            if (arah !== 'NETRAL' && (r.skor || 0) < AMBANG_SETUP) {
                arah = 'NETRAL';
                alasan = `Skor ${Math.round(r.skor || 0)} di bawah ambang setup ${AMBANG_SETUP} — belum layak disebut sinyal` + (r.alasan ? `: ${r.alasan}` : '');
                level = null;
            } else if (arah !== 'NETRAL' && !(level && level.valid)) {
                alasan = (level && level.alasan) ? ('Setup ditolak: ' + level.alasan) : 'Setup ditolak: tidak ada level struktur';
                arah = 'NETRAL';
                level = null;
            }

            // Penanda kejujuran: bila sebuah mesin memberi arah BERLAWANAN dengan tren
            // utama (posisi terhadap EMA200), katakan terus terang. SNR/SMC memang
            // mesin berbasis level yang bisa melawan tren — pengguna berhak tahu.
            let melawanTren = false;
            if (ctx.ema200 && arah !== 'NETRAL') {
                if (arah === 'BUY' && candles[candles.length - 1].close < ctx.ema200) melawanTren = true;
                if (arah === 'SELL' && candles[candles.length - 1].close > ctx.ema200) melawanTren = true;
            }
            return {
                kode: m.kode, nama: m.nama,
                arah: arah, skor: Math.max(0, Math.min(100, Math.round(r.skor || 0))),
                alasan, level, melawanTren,
                valid: arah !== 'NETRAL' && !!(level && level.valid)
            };
        });

        return {
            cukupData: true,
            alasan: null,
            basi, umurDetik, intervalDetik,
            hargaTerakhir: candles[candles.length - 1].close,
            mesin: hasil,
            konfluensi: hitungKonfluensi(hasil)
        };
    }

    /**
     * Panah untuk SATU putusan konfluensi, atau null — fungsi murni (diekspor untuk uji).
     * HANYA putusan BUY/SELL yang digambar. Dulu yang dilewati hanya 'NETRAL' dan 'TIDAK ADA
     * SETUP', sehingga 'BELUM CUKUP BUKTI' jatuh ke cabang "bukan BUY" dan digambar sebagai
     * panah SELL merah — mis. suara BUY 85 + BUY 78 + SELL 60 → "BELUM CUKUP BUKTI 34" berpanah
     * turun padahal suaranya condong naik (audit sinyal 2026-10-22).
     */
    function penandaMarker(k, minSkor) {
        if (!k || (k.putusan !== 'BUY' && k.putusan !== 'SELL')) return null;
        if ((k.setupValid || 0) < MIN_SEPAKAT) return null;
        if (!(k.skor >= minSkor)) return null;
        const beli = k.putusan === 'BUY';
        return {
            position: beli ? 'belowBar' : 'aboveBar',
            color: beli ? '#00C853' : '#FF1744',
            shape: beli ? 'arrowUp' : 'arrowDown',
            text: k.putusan + ' ' + k.skor
        };
    }

    /**
     * Marker sinyal untuk digambar di chart (format lightweight-charts).
     *
     * Cara kerja: untuk setiap bar terakhir, mesin dinilai ulang memakai candle
     * SAMPAI bar itu (tanpa mengintip masa depan ✓), lalu dibuat panah bila putusan
     * konfluensi cukup kuat. Aturan supaya tidak berisik:
     *  - hanya putusan BUY/SELL (NETRAL, BELUM CUKUP BUKTI, TIDAK ADA SETUP tidak digambar),
     *  - minimal `minSkor` keyakinan,
     *  - jarak minimal `jarak` bar antar panah.
     * Bila data kurang atau SIMULASI, hasilnya array kosong — tidak ada panah karangan ✓.
     * "Sekarang" untuk bar i = detik terakhir bar i (tidak pernah melewati waktu nyata), jadi
     * MOMENTUM_NY membaca jam sesi dan bar close yang memang sudah diketahui saat itu.
     *
     * Catatan biaya: tiap bar dinilai ulang, jadi `jumlah` dijaga kecil (bawaan 24).
     */
    function markerSinyal(candles, opsi) {
        const o = opsi || {};
        const jumlah = Math.max(1, Math.min(o.jumlah || 24, 120));
        const minSkor = Math.max(0, Math.min(100, o.minSkor === undefined ? 35 : o.minSkor));
        const jarak = Math.max(1, o.jarak || 3);
        if (!Array.isArray(candles) || candles.length < MIN_BAR + 2) return [];
        if (candles.simulated === true) return [];

        const iv = o.intervalDetik || 3600;
        const kini = (typeof o.sekarangDetik === 'number' && isFinite(o.sekarangDetik)) ? o.sekarangDetik : Date.now() / 1000;
        const keluar = [];
        const mulai = Math.max(MIN_BAR, candles.length - jumlah);
        let terakhirDigambar = -Infinity;

        for (let i = mulai; i < candles.length; i++) {
            const sekarangDetik = Math.min(kini, Number(candles[i].time) + iv - 1);
            const r = evaluasi(candles.slice(0, i + 1), { intervalDetik: iv, sekarangDetik });
            if (!r || !r.cukupData || !r.konfluensi) continue;
            const panah = penandaMarker(r.konfluensi, minSkor);
            if (!panah) continue;
            if (i - terakhirDigambar < jarak) continue;
            terakhirDigambar = i;
            keluar.push(Object.assign({ time: candles[i].time }, panah));
        }
        return keluar;
    }

    window.QuantumEngineNine = {
        evaluasi,
        markerSinyal,
        // Diekspor untuk PENGUJIAN dan pemeriksaan: semuanya fungsi murni. Dengan ini
        // uji bisa membuktikan SL/TP benar-benar berbasis struktur (pivot), RSI memakai
        // rumus Wilder yang sama dengan panel RSI, dan putusan/panah dihitung dengan benar —
        // bukan sekadar memeriksa hasil akhir.
        pivot,
        levelStruktur,
        rsiWilder,
        rsiWilderSeri,
        hitungKonfluensi,
        penandaMarker,
        AMBANG_SETUP,
        SKOR_KEADAAN,
        MIN_SEPAKAT,
        KELOMPOK_BUKTI: Object.assign({}, KELOMPOK_BUKTI),
        GESER_AWAN,
        MESIN: MESIN.map(m => ({ kode: m.kode, nama: m.nama })),
        daftarKode: MESIN.map(m => m.kode),
        MIN_BAR: MIN_BAR,      // 60 — sama dengan yang dipakai perhitungan ✓
        /** Keluaran MENTAH satu mesin (sebelum gerbang keabsahan) — hanya untuk uji. */
        _uji: {
            mentah(kode, candles, opsi) {
                const m = MESIN.find(x => x.kode === kode);
                if (!m) return null;
                return m.evaluasi(candles, buatKonteks(candles, opsi || {}));
            }
        }
    };
})();
