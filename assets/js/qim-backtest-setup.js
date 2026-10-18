/**
 * BACKTEST SETUP ANALISA — menguji SMC, ICT, Fibonacci, S&D ke data historis, bar demi bar.
 *
 * Aturan sama dengan sinyal bayangan di server (api/_setup_shadow.php) supaya hasilnya sebanding:
 *  - Setup dideteksi saat sebuah candle CLOSE, hanya dari candle sampai titik itu (tanpa melihat masa
 *    depan), memakai detektor yang sama dengan panel Setup Analisa (QIMSetups.deteksi).
 *  - Hanya setup "MENUNGGU" (limit belum tersentuh) yang dipasang sebagai order limit.
 *  - Filter (opsional, default aktif): entry ≤ 2,5×ATR dari harga, risiko 0,4–3×ATR.
 *  - Order limit kedaluwarsa setelah ±12 jam (min. 2 bar) bila tidak terisi; batal bila harga
 *    menembus TP sebelum entry terisi.
 *  - Posisi ditahan maks. ±48 jam (min. 6 bar), lalu ditutup di harga close (EXPIRED).
 *  - KONSERVATIF: candle yang mengisi entry DAN menyentuh SL = kalah; TP baru dihitung dari candle
 *    berikutnya; bila satu candle menyentuh SL dan TP sekaligus, SL dianggap lebih dulu; gap melewati
 *    SL dihitung di harga open (bisa lebih buruk dari −1R).
 *  - Satu order per metode pada satu waktu (setup yang tumpang tindih tidak ditumpuk).
 *  - Belum memperhitungkan spread/komisi dan filter bias H4 — hasil nyata bisa sedikit lebih buruk.
 *
 * Murni (tanpa DOM). Dipakai Web Worker (qim-backtest-worker.js), peramban, dan uji Node.
 */
(function (root) {
    'use strict';
    const METODE = ['SMC', 'ICT', 'FIBO', 'SND'];
    const JENDELA = 300;        // bar yang dilihat detektor (struktur > 150 bar diabaikan detektor)
    const MULAI = 120;          // bar pemanasan sebelum setup pertama boleh dipasang

    function durasiBatang(c) {
        const d = [];
        for (let i = Math.max(1, c.length - 200); i < c.length; i++) d.push(c[i].time - c[i - 1].time);
        d.sort((a, b) => a - b);
        return d[Math.floor(d.length / 2)] || 3600;
    }

    function statKosong(metode) {
        return { metode, setup: 0, disaring: 0, terisi: 0, tidakTerisi: 0, batal: 0, menang: 0, kalah: 0, expired: 0,
                 totalR: 0, untungR: 0, rugiR: 0, puncak: 0, ddMaks: 0, ekuitas: [], rrJumlah: 0, barTahan: 0, trade: [] };
    }

    function catatTrade(st, tr) {
        st.trade.push(tr);
        st.totalR += tr.R;
        if (tr.R >= 0) st.untungR += tr.R; else st.rugiR += -tr.R;
        if (tr.hasil === 'TP') st.menang++; else if (tr.hasil === 'SL') st.kalah++; else st.expired++;
        st.puncak = Math.max(st.puncak, st.totalR);
        st.ddMaks = Math.max(st.ddMaks, st.puncak - st.totalR);
        st.ekuitas.push({ time: tr.tKeluar, value: Math.round(st.totalR * 100) / 100 });
        st.barTahan += tr.barTahan;
    }

    /** Majukan satu order dengan satu candle. Mengembalikan true bila order selesai. */
    function proses(o, b, i, st, batas) {
        const buy = o.arah === 'BUY';
        if (o.status === 'MENUNGGU') {
            if (i - o.i0 > batas.ttl) { st.tidakTerisi++; return true; }
            const kenaEntry = buy ? b.low <= o.entry : b.high >= o.entry;
            if (!kenaEntry) {
                if (buy ? b.high > o.tp : b.low < o.tp) { st.batal++; return true; }
                return false;
            }
            st.terisi++;
            o.iIsi = i; o.tIsi = b.time;
            if (buy ? b.low <= o.sl : b.high >= o.sl) {
                catatTrade(st, selesai(o, b, i, 'SL', o.sl));
                return true;
            }
            o.status = 'AKTIF';
            return false;
        }
        // AKTIF
        const gapSL = buy ? b.open <= o.sl : b.open >= o.sl;
        if (gapSL || (buy ? b.low <= o.sl : b.high >= o.sl)) { catatTrade(st, selesai(o, b, i, 'SL', gapSL ? b.open : o.sl)); return true; }
        if (buy ? b.high >= o.tp : b.low <= o.tp) { catatTrade(st, selesai(o, b, i, 'TP', o.tp)); return true; }
        if (i - o.iIsi >= batas.tahan) { catatTrade(st, selesai(o, b, i, 'EXPIRED', b.close)); return true; }
        return false;
    }

    function selesai(o, b, i, hasil, keluar) {
        const risiko = Math.abs(o.entry - o.sl) || 1e-12;
        const arah = o.arah === 'BUY' ? 1 : -1;
        const R = Math.round(((keluar - o.entry) * arah / risiko) * 100) / 100;
        return { metode: o.metode, arah: o.arah, entry: o.entry, sl: o.sl, tp: o.tp, rr: o.rr,
                 tSetup: o.t0, tMasuk: o.tIsi, tKeluar: b.time, keluar, hasil, R, barTahan: i - o.iIsi };
    }

    /**
     * @param {object} QS   QIMSetups (detektor)
     * @param {Array}  c    candle lama→baru { time, open, high, low, close }
     * @param {object} opsi { metode?: string[], filter?: boolean, presisi?: number, kemajuan?: fn(0..1) }
     */
    function jalankan(QS, c, opsi = {}) {
        const daftar = (opsi.metode && opsi.metode.length ? opsi.metode : METODE).map(m => String(m).toUpperCase());
        const filter = opsi.filter !== false;
        const n = c.length;
        if (n < MULAI + 50) return { ok: false, pesan: 'Data terlalu sedikit untuk backtest (butuh ≥ ' + (MULAI + 50) + ' bar, ada ' + n + ').' };
        const dur = durasiBatang(c);
        const batas = { ttl: Math.max(2, Math.round(12 * 3600 / dur)), tahan: Math.max(6, Math.round(48 * 3600 / dur)) };
        const A = QS._internal.atr(c);
        const stat = {}, order = {}, dilihat = {};
        daftar.forEach(m => { stat[m] = statKosong(m); order[m] = null; dilihat[m] = new Set(); });
        const tiapLaporan = Math.max(1, Math.floor((n - MULAI) / 50));

        for (let i = MULAI; i < n; i++) {
            const b = c[i];
            // 1) Order yang sudah ada dimajukan dengan candle ini.
            for (const m of daftar) {
                if (order[m] && proses(order[m], b, i, stat[m], batas)) order[m] = null;
            }
            if (i === n - 1) break;   // candle terakhir: tidak ada masa depan untuk menilai setup baru
            // 2) Candle i sudah close → cari setup baru dari candle s.d. i.
            const jendela = c.slice(Math.max(0, i - JENDELA + 1), i + 1);
            for (const m of daftar) {
                if (order[m]) continue;
                let res;
                try { res = QS.deteksi(m, jendela, { termasukBarBerjalan: true, presisi: opsi.presisi }); } catch (e) { continue; }
                for (const s of (res && res.setups) || []) {
                    if (s.status !== 'MENUNGGU') continue;
                    const kunci = s.arah + '|' + s.entry + '|' + s.sl + '|' + s.tp;
                    if (dilihat[m].has(kunci)) continue;
                    dilihat[m].add(kunci);
                    stat[m].setup++;
                    const risiko = Math.abs(s.entry - s.sl), atr = A[i];
                    if (filter && (atr <= 0 || Math.abs(b.close - s.entry) > 2.5 * atr || risiko < 0.4 * atr || risiko > 3 * atr)) { stat[m].disaring++; continue; }
                    order[m] = { metode: m, arah: s.arah, entry: s.entry, sl: s.sl, tp: s.tp, rr: s.rr, i0: i, t0: b.time, status: 'MENUNGGU' };
                    stat[m].rrJumlah += s.rr;
                    break;
                }
            }
            if (opsi.kemajuan && (i - MULAI) % tiapLaporan === 0) opsi.kemajuan((i - MULAI) / (n - MULAI));
        }
        // Order yang masih terbuka di akhir data tidak dihitung (hasilnya belum diketahui).
        const ringkas = st => {
            const selesaiN = st.menang + st.kalah + st.expired;
            return {
                metode: st.metode, setup: st.setup, disaring: st.disaring, dipasang: st.setup - st.disaring,
                terisi: st.terisi, tidakTerisi: st.tidakTerisi, batal: st.batal,
                trade: selesaiN, menang: st.menang, kalah: st.kalah, expired: st.expired,
                winRate: selesaiN ? Math.round(st.menang / selesaiN * 1000) / 10 : null,
                totalR: Math.round(st.totalR * 100) / 100,
                rataR: selesaiN ? Math.round(st.totalR / selesaiN * 100) / 100 : null,          // ekspektansi per trade
                profitFactor: st.rugiR > 0 ? Math.round(st.untungR / st.rugiR * 100) / 100 : (st.untungR > 0 ? null : 0),
                ddMaksR: Math.round(st.ddMaks * 100) / 100,
                rataRR: (st.setup - st.disaring) ? Math.round(st.rrJumlah / (st.setup - st.disaring) * 100) / 100 : null,
                rataBarTahan: selesaiN ? Math.round(st.barTahan / selesaiN * 10) / 10 : null,
                ekuitas: st.ekuitas, daftarTrade: st.trade.slice(-200),
            };
        };
        const hasil = daftar.map(m => ringkas(stat[m]));
        // Gabungan semua metode (urut waktu keluar) untuk kurva ekuitas total.
        const semua = statKosong('SEMUA');
        daftar.flatMap(m => stat[m].trade).sort((a, b) => a.tKeluar - b.tKeluar).forEach(t => catatTrade(semua, t));
        ['setup', 'disaring', 'terisi', 'tidakTerisi', 'batal', 'rrJumlah'].forEach(k => { semua[k] = daftar.reduce((s, m) => s + stat[m][k], 0); });
        return {
            ok: true, bar: n, durasiBatang: dur, batas,
            dari: c[MULAI].time, sampai: c[n - 1].time, filter,
            metode: hasil, gabungan: ringkas(semua),
            // "Terbaik" hanya bila benar-benar menguntungkan dengan sampel memadai (≥10 trade, rata-rata R > 0).
            terbaik: hasil.filter(h => h.trade >= 10 && h.rataR > 0).sort((a, b) => b.rataR - a.rataR)[0] || null,
        };
    }

    const api = { jalankan, METODE, _internal: { proses, durasiBatang } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.QIMBacktestSetup = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
