/**
 * QIM SETUP — deteksi setup trading per metode (SMC, ICT, Fibonacci, Supply & Demand).
 *
 * Entry, SL, dan TP SELALU diturunkan dari struktur metodenya sendiri, bukan rumus umum:
 *   SMC        BOS/CHoCH (close menembus swing) + displacement → Order Block terakhir.
 *              Entry tepi OB, SL di balik OB/ujung leg, TP di likuiditas (high/low setelah BOS
 *              atau swing yang belum diambil).
 *   ICT        Liquidity sweep (wick menembus swing lalu close kembali) → Market Structure
 *              Shift (close menembus swing internal) → FVG displacement. Entry di CE (50%) FVG,
 *              SL di balik wick sweep, TP di likuiditas seberang yang belum diambil.
 *   Fibonacci  Impuls terkonfirmasi (swing ke swing yang membuat higher high / lower low).
 *              Entry 0.618, SL di balik awal impuls (100%), TP extension 1.272.
 *   S&D        Base (1–4 candle body ≤ 50%) + leg-out eksplosif (body ≥ 1,2×ATR) yang belum
 *              pernah diuji. Entry garis proximal, SL di balik garis distal, TP di zona
 *              berlawanan / swing yang belum diambil.
 *
 * ATURAN KETEPATAN (berlaku untuk semua metode):
 *  - Swing hanya dihitung bila TERKONFIRMASI (3 candle di kiri dan kanan).
 *  - R:R minimal 1:2 terhadap TP struktural; bila tidak ada TP struktural yang memenuhi,
 *    setup TIDAK ditampilkan (TP tidak pernah dikarang dari kelipatan risiko).
 *  - Setup batal bila SL sudah tersentuh, TP sudah tercapai, atau harga lari ke target
 *    sebelum kembali ke entry. Status MENUNGGU = limit belum tersentuh; AKTIF = entry sudah
 *    tersentuh dan posisi masih berjalan.
 *  - Bila tidak ada setup, `catatan` menjelaskan alasannya dengan jujur.
 *
 * Murni (tanpa DOM): dipakai peramban (window.QIMSetups) dan uji Node (module.exports).
 * Candle: array lama→baru berisi { time, open, high, low, close }.
 */
(function (root) {
    'use strict';

    const MIN_RR = 2;          // R:R minimum terhadap TP struktural
    const PIVOT_K = 3;         // swing = lebih ekstrem dari 3 candle di kiri dan kanan
    const BATAS_UMUR = 150;    // struktur lebih tua dari ini (bar) tidak relevan lagi
    const BUFFER_ATR = 0.1;    // SL diberi jarak 0,1 × ATR di balik level struktur
    const MAKS_AKTIF = 20;     // setup yang entry-nya tersentuh > 20 bar lalu dianggap basi
    const MIN_BAR = 60;

    // ── Utilitas ────────────────────────────────────────────────────────────
    /** ATR Wilder per indeks; sebelum periode penuh memakai rata-rata TR yang ada. */
    function atr(c, p = 14) {
        const out = new Array(c.length).fill(0);
        let jumlah = 0, nilai = 0;
        for (let i = 0; i < c.length; i++) {
            const prev = i > 0 ? c[i - 1].close : c[i].open;
            const tr = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - prev), Math.abs(c[i].low - prev));
            if (i < p) { jumlah += tr; nilai = jumlah / (i + 1); }
            else nilai = (nilai * (p - 1) + tr) / p;
            out[i] = nilai;
        }
        return out;
    }

    /** Swing high/low terkonfirmasi: ekstrem terhadap k candle di kiri (ketat) dan kanan. */
    function pivots(c, k = PIVOT_K) {
        const out = [];
        for (let i = k; i < c.length - k; i++) {
            let h = true, l = true;
            for (let j = 1; j <= k; j++) {
                if (!(c[i].high > c[i - j].high && c[i].high >= c[i + j].high)) h = false;
                if (!(c[i].low < c[i - j].low && c[i].low <= c[i + j].low)) l = false;
            }
            if (h) out.push({ i, tipe: 'H', harga: c[i].high });
            if (l) out.push({ i, tipe: 'L', harga: c[i].low });
        }
        return out;
    }

    /** Urutan swing berselang-seling H/L (swing sejenis berturut-turut → ambil yang paling ekstrem). */
    function selangSeling(piv) {
        const out = [];
        for (const p of piv) {
            const akhir = out[out.length - 1];
            if (akhir && akhir.tipe === p.tipe) {
                if ((p.tipe === 'H' && p.harga >= akhir.harga) || (p.tipe === 'L' && p.harga <= akhir.harga)) out[out.length - 1] = p;
            } else out.push(p);
        }
        return out;
    }

    function rr(arah, entry, sl, tp) {
        const risiko = arah === 'BUY' ? entry - sl : sl - entry;
        const hadiah = arah === 'BUY' ? tp - entry : entry - tp;
        return risiko > 0 ? hadiah / risiko : 0;
    }

    /** TP struktural terdekat searah posisi yang memberi R:R ≥ MIN_RR. */
    function pilihTP(arah, entry, sl, kandidat) {
        const searah = kandidat
            .filter(k => Number.isFinite(k.harga) && (arah === 'BUY' ? k.harga > entry : k.harga < entry))
            .sort((a, b) => arah === 'BUY' ? a.harga - b.harga : b.harga - a.harga);
        for (const k of searah) {
            const nilai = rr(arah, entry, sl, k.harga);
            if (nilai >= MIN_RR) return { tp: k.harga, rr: nilai, label: k.label, idx: k.idx };
        }
        const terbaik = searah.length ? rr(arah, entry, sl, searah[searah.length - 1].harga) : 0;
        return { tp: null, rr: terbaik };
    }

    /** Swing yang belum diambil (tidak pernah dilewati harga sesudahnya) = kolam likuiditas. */
    function likuiditas(c, piv, tipe, sebelum = c.length) {
        return piv.filter(p => {
            if (p.tipe !== tipe || p.i >= sebelum) return false;
            for (let i = p.i + 1; i < c.length; i++) {
                if (tipe === 'H' ? c[i].high > p.harga : c[i].low < p.harga) return false;
            }
            return true;
        });
    }

    /**
     * Status setup sejak `dari`. TP yang terbentuk di `idxTP` baru dihitung "sudah tercapai
     * sebelum entry" untuk candle SESUDAH idxTP. `batasLanjut` (opsional): bila harga
     * melewatinya sebelum entry tersentuh, struktur sudah berlanjut → setup terlewat.
     */
    function nilaiStatus(c, arah, entry, sl, tp, dari, idxTP = -1, batasLanjut = null, maksAktif = MAKS_AKTIF) {
        const buy = arah === 'BUY';
        let tersentuh = -1;
        for (let i = Math.max(0, dari); i < c.length; i++) {
            const b = c[i];
            const kenaTP = buy ? b.high >= tp : b.low <= tp;
            const kenaSL = buy ? b.low <= sl : b.high >= sl;
            const kenaEntry = buy ? b.low <= entry : b.high >= entry;
            // Sebelum entry: target dianggap terlewat hanya bila harga MELEWATINYA (equal high/low
            // yang sekadar menyentuh puncak lama tidak mengubah struktur).
            const lewatTP = buy ? b.high > tp : b.low < tp;
            if (tersentuh < 0) {
                if (batasLanjut !== null && (buy ? b.high > batasLanjut : b.low < batasLanjut) && !kenaEntry) {
                    return { valid: false, sebab: 'struktur sudah berlanjut sebelum harga kembali ke entry' };
                }
                if (lewatTP && i > idxTP && !kenaEntry) return { valid: false, sebab: 'harga sudah mencapai target tanpa kembali ke entry' };
                if (kenaEntry) {
                    if (kenaSL) return { valid: false, sebab: 'SL sudah tersentuh' };
                    if (kenaTP && i > idxTP) return { valid: false, sebab: 'TP sudah tercapai' };
                    tersentuh = i;
                }
            } else {
                if (kenaSL) return { valid: false, sebab: 'SL sudah tersentuh' };
                if (kenaTP) return { valid: false, sebab: 'TP sudah tercapai' };
            }
        }
        if (tersentuh >= 0 && c.length - 1 - tersentuh > maksAktif) {
            return { valid: false, sebab: `entry sudah tersentuh ${c.length - 1 - tersentuh} bar lalu (basi)` };
        }
        return { valid: true, status: tersentuh >= 0 ? 'AKTIF' : 'MENUNGGU', tersentuh };
    }

    function presisiDefault(c) {
        const p = c.length ? Math.abs(c[c.length - 1].close) : 1;
        return p >= 1000 ? 2 : p >= 50 ? 3 : 5;
    }

    function siapkan(c, opsi) {
        const presisi = Number.isInteger(opsi && opsi.presisi) ? opsi.presisi : presisiDefault(c);
        const fmt = v => Number(v).toFixed(presisi);
        const waktu = i => (opsi && typeof opsi.fmtWaktu === 'function') ? opsi.fmtWaktu(c[i].time) : String(c[i].time);
        return { presisi, fmt, waktu, A: atr(c), piv: pivots(c) };
    }

    function bulat(v, presisi) { const f = Math.pow(10, presisi); return Math.round(v * f) / f; }

    function bentuk(metode, arah, entry, sl, pilih, status, zona, alasan, ctx, ekstra = {}) {
        const p = ctx.presisi;
        return Object.assign({
            metode, arah, status: status.status, tersentuh: status.tersentuh,
            entry: bulat(entry, p), sl: bulat(sl, p), tp: bulat(pilih.tp, p),
            rr: Math.round(pilih.rr * 100) / 100, tpLabel: pilih.label,
            zona, alasan,
        }, ekstra);
    }

    function hasilKosong(metode, catatan) { return { metode, setups: [], catatan }; }

    // ── SMC ─────────────────────────────────────────────────────────────────
    /** Peristiwa struktur: close menembus swing terakhir yang terkonfirmasi (BOS/CHoCH). */
    function peristiwaStruktur(c, piv, k = PIVOT_K) {
        const urut = piv.slice().sort((a, b) => a.i - b.i);
        const out = [];
        let pH = null, pL = null, hTembus = true, lTembus = true, tren = 0, pi = 0;
        for (let j = 0; j < c.length; j++) {
            while (pi < urut.length && urut[pi].i + k <= j - 1) {
                const p = urut[pi++];
                if (p.tipe === 'H') { pH = p; hTembus = false; } else { pL = p; lTembus = false; }
            }
            if (pH && !hTembus && c[j].close > pH.harga) {
                hTembus = true;
                out.push({ j, arah: 'BUY', pivot: pH, tipe: tren === -1 ? 'CHoCH' : 'BOS' });
                tren = 1;
            }
            if (pL && !lTembus && c[j].close < pL.harga) {
                lTembus = true;
                out.push({ j, arah: 'SELL', pivot: pL, tipe: tren === 1 ? 'CHoCH' : 'BOS' });
                tren = -1;
            }
        }
        return out;
    }

    function deteksiSMC(c, opsi) {
        if (c.length < MIN_BAR) return hasilKosong('SMC', `Data kurang (butuh minimal ${MIN_BAR} candle).`);
        const ctx = siapkan(c, opsi), { A, piv, fmt } = ctx, n = c.length;
        const ev = peristiwaStruktur(c, piv);
        if (!ev.length) return hasilKosong('SMC', 'Belum ada BOS/CHoCH yang terkonfirmasi.');
        const e = ev[ev.length - 1];            // struktur terbaru menentukan bias
        const buy = e.arah === 'BUY';
        const namaArah = buy ? 'bullish' : 'bearish';
        if (n - 1 - e.j > BATAS_UMUR) return hasilKosong('SMC', `${e.tipe} ${namaArah} terakhir sudah ${n - 1 - e.j} bar lalu — terlalu lama.`);

        // Titik asal impuls: ekstrem berlawanan antara swing yang ditembus dan candle penembus.
        let m = e.pivot.i;
        for (let i = e.pivot.i; i <= e.j; i++) if (buy ? c[i].low < c[m].low : c[i].high > c[m].high) m = i;
        // Order block: candle berlawanan arah TERAKHIR di leg sebelum impuls (m mundur ke swing).
        let ob = -1;
        // Leg turun/naik sebelum impuls ada di antara swing yang ditembus dan titik asal; bila titik
        // asal adalah candle swing itu sendiri, OB dicari sampai 10 candle sebelumnya.
        for (let i = m; i >= Math.max(0, Math.min(e.pivot.i, m - 10)); i--) {
            const lawan = buy ? c[i].close < c[i].open : c[i].close > c[i].open;
            if (lawan) { ob = i; break; }
        }
        if (ob < 0) return hasilKosong('SMC', `${e.tipe} ${namaArah} ${fmt(e.pivot.harga)} tanpa order block yang jelas.`);

        // Displacement: FVG di impuls ATAU candle penembus berbadan ≥ 1×ATR.
        let fvg = null;
        for (let t = ob + 2; t <= Math.min(n - 1, e.j + 1); t++) {
            if (buy ? c[t].low > c[t - 2].high : c[t].high < c[t - 2].low) { fvg = t; break; }
        }
        const badan = Math.abs(c[e.j].close - c[e.j].open);
        if (fvg === null && badan < A[e.j]) {
            return hasilKosong('SMC', `${e.tipe} ${namaArah} tanpa displacement (tidak ada FVG, badan candle penembus < 1×ATR).`);
        }

        // Zona OB diperluas sampai ujung leg (SL tidak boleh di dalam level yang sudah disentuh).
        let atas = c[ob].high, bawah = c[ob].low;
        for (let i = ob; i <= m; i++) { atas = Math.max(atas, c[i].high); bawah = Math.min(bawah, c[i].low); }
        if (buy) atas = c[ob].high; else bawah = c[ob].low;
        const buf = BUFFER_ATR * A[n - 1];
        const entry = buy ? atas : bawah;
        const sl = buy ? bawah - buf : atas + buf;

        // TP: ekstrem setelah BOS + swing yang belum diambil (likuiditas).
        let ix = e.j;
        for (let i = e.j; i < n; i++) if (buy ? c[i].high > c[ix].high : c[i].low < c[ix].low) ix = i;
        const kandidat = [{ harga: buy ? c[ix].high : c[ix].low, label: buy ? `High setelah ${e.tipe}` : `Low setelah ${e.tipe}`, idx: ix }]
            .concat(likuiditas(c, piv, buy ? 'H' : 'L').map(p => ({ harga: p.harga, label: buy ? 'Swing high (likuiditas)' : 'Swing low (likuiditas)', idx: p.i })));
        const pilih = pilihTP(e.arah, entry, sl, kandidat);
        if (pilih.tp === null) return hasilKosong('SMC', `OB ${namaArah} ${fmt(bawah)}–${fmt(atas)} ada, tetapi tidak ada target likuiditas dengan R:R ≥ 1:${MIN_RR} (terbaik 1:${pilih.rr.toFixed(2)}).`);
        const st = nilaiStatus(c, e.arah, entry, sl, pilih.tp, e.j + 1, pilih.idx);
        if (!st.valid) return hasilKosong('SMC', `OB ${namaArah} ${fmt(bawah)}–${fmt(atas)} tidak berlaku: ${st.sebab}.`);

        const alasan = [
            `${e.tipe} ${namaArah}: close ${fmt(c[e.j].close)} menembus swing ${buy ? 'high' : 'low'} ${fmt(e.pivot.harga)} (${ctx.waktu(e.j)}).`,
            `Order block = candle ${buy ? 'bearish' : 'bullish'} terakhir sebelum impuls: ${fmt(bawah)}–${fmt(atas)}.`,
            fvg !== null ? `Displacement terkonfirmasi: impuls meninggalkan FVG.` : `Displacement: badan candle penembus ${(badan / A[e.j]).toFixed(1)}×ATR.`,
            `Entry di tepi ${buy ? 'atas' : 'bawah'} OB, SL di balik OB (+0,1×ATR), TP di ${pilih.label} ${fmt(pilih.tp)}.`,
        ];
        return { metode: 'SMC', catatan: null, setups: [bentuk('SMC', e.arah, entry, sl, pilih, st,
            { atas, bawah, mulai: ob, label: 'OB' }, alasan, ctx, { struktur: e.tipe, mulai: ob })] };
    }

    // ── ICT ─────────────────────────────────────────────────────────────────
    function deteksiICT(c, opsi) {
        if (c.length < MIN_BAR) return hasilKosong('ICT', `Data kurang (butuh minimal ${MIN_BAR} candle).`);
        const ctx = siapkan(c, opsi), { A, piv, fmt } = ctx, n = c.length;
        const hasil = {};
        let catatan = null;
        const urut = piv.slice().sort((a, b) => a.i - b.i);

        for (let s = n - 1; s >= Math.max(PIVOT_K * 2 + 1, n - BATAS_UMUR); s--) {
            for (const arah of ['BUY', 'SELL']) {
                if (hasil[arah]) continue;
                const buy = arah === 'BUY';
                const tipeLik = buy ? 'L' : 'H', tipeInt = buy ? 'H' : 'L';
                // Swing likuiditas terakhir yang belum diambil sebelum candle s.
                let L = null;
                for (let a = urut.length - 1; a >= 0; a--) {
                    const p = urut[a];
                    if (p.tipe !== tipeLik || p.i + PIVOT_K >= s) continue;
                    let utuh = true;
                    for (let i = p.i + 1; i < s; i++) if (buy ? c[i].low < p.harga : c[i].high > p.harga) { utuh = false; break; }
                    if (utuh) { L = p; break; }
                }
                if (!L) continue;
                const sapu = buy ? (c[s].low < L.harga && c[s].close > L.harga) : (c[s].high > L.harga && c[s].close < L.harga);
                if (!sapu) continue;

                // Swing internal (antara likuiditas dan sweep) yang harus ditembus = MSS.
                let H = null;
                for (let a = urut.length - 1; a >= 0; a--) {
                    const p = urut[a];
                    if (p.tipe === tipeInt && p.i < s && p.i > L.i) { H = p; break; }
                }
                if (!H) for (let a = urut.length - 1; a >= 0; a--) { const p = urut[a]; if (p.tipe === tipeInt && p.i < s) { H = p; break; } }
                if (!H) continue;
                let j = -1;
                for (let i = s + 1; i <= Math.min(n - 1, s + 20); i++) {
                    if (buy ? c[i].low < c[s].low : c[i].high > c[s].high) break;     // sweep ditembus → batal
                    if (buy ? c[i].close > H.harga : c[i].close < H.harga) { j = i; break; }
                }
                if (j < 0) { catatan = catatan || `Sweep ${buy ? 'sell-side' : 'buy-side'} di ${fmt(L.harga)} belum diikuti MSS.`; continue; }

                // FVG pada displacement sweep → MSS.
                let t = -1;
                for (let x = s + 2; x <= Math.min(n - 1, j + 1); x++) {
                    if (buy ? c[x].low > c[x - 2].high : c[x].high < c[x - 2].low) { t = x; break; }
                }
                if (t < 0) { catatan = catatan || `MSS ${buy ? 'bullish' : 'bearish'} tanpa FVG displacement.`; continue; }
                const fAtas = buy ? c[t].low : c[t - 2].low, fBawah = buy ? c[t - 2].high : c[t].high;
                const entry = (fAtas + fBawah) / 2;
                const buf = BUFFER_ATR * A[n - 1];
                const sl = buy ? c[s].low - buf : c[s].high + buf;

                let ix = s;
                for (let i = s; i < n; i++) if (buy ? c[i].high > c[ix].high : c[i].low < c[ix].low) ix = i;
                const kandidat = [{ harga: buy ? c[ix].high : c[ix].low, label: buy ? 'High dealing range' : 'Low dealing range', idx: ix }]
                    .concat(likuiditas(c, piv, tipeInt).map(p => ({ harga: p.harga, label: buy ? 'Buy-side liquidity' : 'Sell-side liquidity', idx: p.i })));
                const pilih = pilihTP(arah, entry, sl, kandidat);
                if (pilih.tp === null) { catatan = catatan || `Setup ${buy ? 'bullish' : 'bearish'} ada, tetapi target likuiditas memberi R:R < 1:${MIN_RR}.`; continue; }
                const st = nilaiStatus(c, arah, entry, sl, pilih.tp, t + 1, pilih.idx);
                if (!st.valid) { catatan = catatan || `Setup ${buy ? 'bullish' : 'bearish'} terakhir tidak berlaku: ${st.sebab}.`; continue; }

                hasil[arah] = bentuk('ICT', arah, entry, sl, pilih, st, { atas: fAtas, bawah: fBawah, mulai: t - 1, label: 'FVG' }, [
                    `Liquidity sweep: wick ${fmt(buy ? c[s].low : c[s].high)} menembus swing ${buy ? 'low' : 'high'} ${fmt(L.harga)} lalu close kembali (${ctx.waktu(s)}).`,
                    `Market Structure Shift: close ${fmt(c[j].close)} menembus swing internal ${fmt(H.harga)}.`,
                    `FVG displacement ${fmt(fBawah)}–${fmt(fAtas)}; entry di CE (50%) ${fmt(entry)}.`,
                    `SL di balik wick sweep (+0,1×ATR), TP di ${pilih.label} ${fmt(pilih.tp)}.`,
                ], ctx, { mulai: s });
            }
            if (hasil.BUY && hasil.SELL) break;
        }
        const setups = ['BUY', 'SELL'].map(a => hasil[a]).filter(Boolean).sort((a, b) => b.mulai - a.mulai);
        return { metode: 'ICT', setups, catatan: setups.length ? null : (catatan || 'Belum ada liquidity sweep yang diikuti MSS + FVG.') };
    }

    // ── FIBONACCI ───────────────────────────────────────────────────────────
    function deteksiFibo(c, opsi) {
        if (c.length < MIN_BAR) return hasilKosong('FIBO', `Data kurang (butuh minimal ${MIN_BAR} candle).`);
        const ctx = siapkan(c, opsi), { A, piv, fmt } = ctx, n = c.length;
        const alt = selangSeling(piv.slice().sort((a, b) => a.i - b.i || (a.tipe === 'H' ? -1 : 1)));
        const setups = [];
        const catatan = [];
        for (const arah of ['BUY', 'SELL']) {
            const buy = arah === 'BUY';
            // Impuls terbaru searah: (L→H) untuk BUY, (H→L) untuk SELL.
            let b = -1;
            for (let a = alt.length - 1; a >= 1; a--) {
                if (alt[a].tipe === (buy ? 'H' : 'L') && alt[a - 1].tipe === (buy ? 'L' : 'H')) { b = a; break; }
            }
            if (b < 0) continue;
            const ujung = alt[b], awal = alt[b - 1], sebelum = alt[b - 2];
            const R = Math.abs(ujung.harga - awal.harga);
            const nama = buy ? 'naik' : 'turun';
            if (n - 1 - ujung.i > BATAS_UMUR) continue;
            if (R < 3 * A[ujung.i]) { catatan.push(`Impuls ${nama} terakhir terlalu kecil (< 3×ATR).`); continue; }
            if (!sebelum || (buy ? ujung.harga <= sebelum.harga : ujung.harga >= sebelum.harga)) {
                catatan.push(`Impuls ${nama} terakhir tidak membuat ${buy ? 'higher high' : 'lower low'} — bukan impuls struktur.`);
                continue;
            }
            const lvl = r => buy ? ujung.harga - R * r : ujung.harga + R * r;
            const entry = lvl(0.618);
            const buf = BUFFER_ATR * A[n - 1];
            const sl = buy ? awal.harga - buf : awal.harga + buf;
            const tp = lvl(-0.272);
            const pilih = { tp, rr: rr(arah, entry, sl, tp), label: 'Extension 1.272', idx: ujung.i };
            if (pilih.rr < MIN_RR) { catatan.push(`Impuls ${nama}: R:R ke extension 1.272 hanya 1:${pilih.rr.toFixed(2)}.`); continue; }
            const st = nilaiStatus(c, arah, entry, sl, tp, ujung.i + 1, ujung.i, ujung.harga);
            if (!st.valid) { catatan.push(`Fibonacci impuls ${nama} tidak berlaku: ${st.sebab}.`); continue; }
            setups.push(bentuk('FIBO', arah, entry, sl, pilih, st,
                { atas: Math.max(lvl(0.5), lvl(0.786)), bawah: Math.min(lvl(0.5), lvl(0.786)), mulai: ujung.i, label: 'Golden zone' }, [
                    `Impuls ${nama} terkonfirmasi ${fmt(awal.harga)} → ${fmt(ujung.harga)} (${ctx.waktu(awal.i)} – ${ctx.waktu(ujung.i)}), membuat ${buy ? 'higher high' : 'lower low'} di atas swing ${fmt(sebelum.harga)}.`,
                    `Golden zone 0.5–0.786: ${fmt(Math.min(lvl(0.5), lvl(0.786)))}–${fmt(Math.max(lvl(0.5), lvl(0.786)))}; entry di 0.618 = ${fmt(entry)}.`,
                    `SL di balik awal impuls (100%) ${fmt(awal.harga)} (+0,1×ATR).`,
                    `TP di extension 1.272 = ${fmt(tp)}.`,
                ], ctx, { mulai: awal.i, fibo: { tinggi: buy ? ujung.harga : awal.harga, rendah: buy ? awal.harga : ujung.harga, awal: awal.i, ujung: ujung.i } }));
        }
        setups.sort((a, b) => b.mulai - a.mulai);
        return { metode: 'FIBO', setups, catatan: setups.length ? null : (catatan[0] || 'Belum ada impuls swing yang terkonfirmasi.') };
    }

    // ── SUPPLY & DEMAND ─────────────────────────────────────────────────────
    function zonaSnD(c, A) {
        const zona = [];
        for (let o = 2; o < c.length; o++) {
            const b = c[o];
            const badan = Math.abs(b.close - b.open), rentang = b.high - b.low;
            if (rentang <= 0 || badan < 1.2 * A[o] || badan < 0.6 * rentang) continue;   // leg-out eksplosif
            const naik = b.close > b.open;
            let awal = o;
            for (let i = o - 1; i >= Math.max(1, o - 4); i--) {
                const r = c[i].high - c[i].low;
                if (r > 0 && Math.abs(c[i].close - c[i].open) <= 0.5 * r) awal = i; else break;
            }
            if (awal === o) continue;                                                     // tanpa base
            const base = c.slice(awal, o);
            const proximal = naik ? Math.max(...base.map(x => Math.max(x.open, x.close))) : Math.min(...base.map(x => Math.min(x.open, x.close)));
            const distal = naik ? Math.min(...base.map(x => x.low), b.low) : Math.max(...base.map(x => x.high), b.high);
            const tinggi = Math.abs(proximal - distal);
            if (tinggi <= 0 || tinggi > 2 * A[o]) continue;                                // zona terlalu lebar = kualitas rendah
            if ((naik ? b.close - proximal : proximal - b.close) < tinggi) continue;      // harus benar-benar meninggalkan zona
            const legIn = c[awal - 1];
            const legInNaik = legIn.close > legIn.open;
            zona.push({ tipe: naik ? 'demand' : 'supply', arah: naik ? 'BUY' : 'SELL', o, awal, proximal, distal,
                pola: naik ? (legInNaik ? 'RBR' : 'DBR') : (legInNaik ? 'RBD' : 'DBD') });
        }
        return zona;
    }

    function deteksiSnD(c, opsi) {
        if (c.length < MIN_BAR) return hasilKosong('SND', `Data kurang (butuh minimal ${MIN_BAR} candle).`);
        const ctx = siapkan(c, opsi), { A, piv, fmt } = ctx, n = c.length;
        const semua = zonaSnD(c, A).filter(z => n - 1 - z.o <= 250);
        const segar = z => { for (let i = z.o + 1; i < n; i++) if (z.arah === 'BUY' ? c[i].low <= z.proximal : c[i].high >= z.proximal) return false; return true; };
        const setups = [];
        const catatan = [];
        for (const arah of ['BUY', 'SELL']) {
            const buy = arah === 'BUY';
            const nama = buy ? 'Demand' : 'Supply';
            const kandidat = semua.filter(z => z.arah === arah).sort((a, b) => b.o - a.o);
            if (!kandidat.length) continue;
            let terbaik = null;
            for (const z of kandidat) {
                const buf = BUFFER_ATR * A[n - 1];
                const entry = z.proximal, sl = buy ? z.distal - buf : z.distal + buf;
                let ix = z.o;
                for (let i = z.o; i < n; i++) if (buy ? c[i].high > c[ix].high : c[i].low < c[ix].low) ix = i;
                const lawan = semua.filter(y => y.arah !== arah && segar(y));
                const tpKand = [{ harga: buy ? c[ix].high : c[ix].low, label: buy ? 'High setelah leg-out' : 'Low setelah leg-out', idx: ix }]
                    .concat(lawan.map(y => ({ harga: y.proximal, label: buy ? 'Zona supply berlawanan' : 'Zona demand berlawanan', idx: y.o })))
                    .concat(likuiditas(c, piv, buy ? 'H' : 'L').map(p => ({ harga: p.harga, label: buy ? 'Swing high' : 'Swing low', idx: p.i })));
                const pilih = pilihTP(arah, entry, sl, tpKand);
                if (pilih.tp === null) { catatan.push(`${nama} ${fmt(Math.min(z.proximal, z.distal))}–${fmt(Math.max(z.proximal, z.distal))}: R:R ke target < 1:${MIN_RR}.`); continue; }
                // Hanya uji PERTAMA yang berlaku: sentuhan pertama harus di 3 candle terakhir.
                const st = nilaiStatus(c, arah, entry, sl, pilih.tp, z.o + 1, pilih.idx, null, 3);
                if (!st.valid) { catatan.push(`${nama} ${fmt(Math.min(z.proximal, z.distal))}–${fmt(Math.max(z.proximal, z.distal))} tidak segar lagi: ${st.sebab}.`); continue; }
                terbaik = { z, entry, sl, pilih, st };
                break;
            }
            if (!terbaik) continue;
            const { z, entry, sl, pilih, st } = terbaik;
            setups.push(bentuk('SND', arah, entry, sl, pilih, st,
                { atas: Math.max(z.proximal, z.distal), bawah: Math.min(z.proximal, z.distal), mulai: z.awal, label: nama }, [
                    `Zona ${nama.toLowerCase()} ${z.pola}: base ${z.o - z.awal} candle (${ctx.waktu(z.awal)}), leg-out eksplosif ${(Math.abs(c[z.o].close - c[z.o].open) / A[z.o]).toFixed(1)}×ATR.`,
                    st.status === 'AKTIF' ? 'Uji pertama sedang terjadi (zona masih segar sampai sentuhan ini).' : 'Zona masih segar — belum pernah diuji ulang.',
                    `Entry di garis proximal ${fmt(z.proximal)}, SL di balik garis distal ${fmt(z.distal)} (+0,1×ATR).`,
                    `TP di ${pilih.label} ${fmt(pilih.tp)}.`,
                ], ctx, { mulai: z.awal }));
        }
        setups.sort((a, b) => b.mulai - a.mulai);
        return { metode: 'SND', setups, catatan: setups.length ? null : (catatan[0] || 'Belum ada zona supply/demand segar dengan leg-out eksplosif.') };
    }

    const METODE = {
        SMC: { nama: 'SMC', judul: 'Smart Money Concepts', fungsi: deteksiSMC },
        ICT: { nama: 'ICT', judul: 'ICT (Sweep + MSS + FVG)', fungsi: deteksiICT },
        FIBO: { nama: 'Fibonacci', judul: 'Fibonacci Golden Zone', fungsi: deteksiFibo },
        SND: { nama: 'S&D', judul: 'Supply & Demand', fungsi: deteksiSnD },
    };

    function deteksi(metode, candles, opsi = {}) {
        const m = METODE[String(metode).toUpperCase()];
        if (!m) throw new Error('Metode tidak dikenal: ' + metode);
        const c = (candles || []).filter(x => x && Number.isFinite(x.open) && Number.isFinite(x.high) && Number.isFinite(x.low) && Number.isFinite(x.close));
        const kode = String(metode).toUpperCase();
        if (candles && candles.simulated) return hasilKosong(kode, 'Data chart adalah simulasi — setup tidak dihitung dari data karangan.');
        // Struktur (BOS, sweep, MSS, leg-out) hanya dari candle yang SUDAH close. Candle yang
        // masih berjalan hanya dipakai untuk memeriksa entry/SL/TP yang tersentuh.
        if (opsi.termasukBarBerjalan || c.length < 2) return m.fungsi(c, opsi);
        const res = m.fungsi(c.slice(0, -1), opsi);
        const live = c[c.length - 1];
        const batal = [];
        res.setups = res.setups.filter(st => {
            const buy = st.arah === 'BUY';
            if (buy ? live.low <= st.sl : live.high >= st.sl) { batal.push('SL tersentuh candle berjalan'); return false; }
            const kenaTP = buy ? live.high >= st.tp : live.low <= st.tp;
            if (st.status === 'AKTIF' && kenaTP) { batal.push('TP tercapai candle berjalan'); return false; }
            if (st.status === 'MENUNGGU') {
                const kenaEntry = buy ? live.low <= st.entry : live.high >= st.entry;
                if (kenaEntry && kenaTP) { batal.push('entry dan TP tersentuh di candle berjalan'); return false; }
                if (kenaEntry) { st.status = 'AKTIF'; st.tersentuh = c.length - 1; }
                else if (buy ? live.high > st.tp : live.low < st.tp) { batal.push('harga melewati target tanpa kembali ke entry'); return false; }
            }
            return true;
        });
        if (!res.setups.length && !res.catatan) res.catatan = 'Setup terakhir batal: ' + (batal[0] || 'tidak berlaku') + '.';
        return res;
    }

    const api = { deteksi, METODE, MIN_RR, PIVOT_K, _internal: { atr, pivots, selangSeling, peristiwaStruktur, zonaSnD, nilaiStatus, pilihTP, rr } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.QIMSetups = api;
})(typeof window !== 'undefined' ? window : null);
