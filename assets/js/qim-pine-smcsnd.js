/**
 * PORT Pine Script → JavaScript: "XAU SMC+SnD BUY SELL COMBO" (Pine v5, overlay).
 * Diterjemahkan baris per baris dari skrip aslinya; semantik Pine yang dipertahankan:
 *  - ta.ema      : seed = nilai pertama (bukan SMA), alpha = 2/(len+1).
 *  - ta.atr      : RMA dari true range; seed = SMA len bar pertama; true range bar pertama = high−low.
 *  - ta.pivothigh/low(len, len): pivot dikonfirmasi len bar SETELAH terjadi (nilai muncul di bar i untuk bar i−len).
 *  - array.unshift + array.pop : array berukuran tetap, elemen terbaru di indeks 0 (array_kotak berisi
 *    hingga `history_keep` zona terbaru; zona yang tembus menjadi "lubang" (na), bukan digeser).
 *  - box.delete + array.set(na) : zona dihapus saat harga close menembus (BOS), diganti garis BOS.
 *  - Urutan per bar: pivot → buat zona → BOS → cari supply/demand terdekat → sweep → level → status.
 *  - Tabel hanya untuk bar TERAKHIR (barstate.islast).
 *
 * Murni (tanpa DOM): dipakai peramban (window.QIMPineSmcSnd) dan uji Node (module.exports).
 * Candle: array lama→baru { time, open, high, low, close }.
 *
 * Batas yang perlu diketahui: hasil bergantung pada JUMLAH riwayat (zona lama yang belum tembus tetap hidup di
 * TradingView); makin banyak bar makin identik. Pada bar yang masih berjalan, hasil bisa berubah sampai close
 * (sama seperti di TradingView).
 */
(function (root) {
    'use strict';

    const DEFAULT = {
        swing_length: 10, history_keep: 20, box_width: 2.5,
        ema13Len: 13, ema21Len: 21, ema100Len: 100, ema200Len: 200, atrLen: 14,
        buyEntryBufferATR: 0.10, buySLBufferATR: 1.20, sellEntryBufferATR: 0.10, sellSLBufferATR: 1.20,
        useSweepLogic: true, sweepLookback: 3,
        showZones: true, showBOS: false,
        // Konvensi pembanding pivot (dikunci oleh uji terhadap angka TradingView): kiri ketat (>), kanan longgar (>=).
        pivotKiriKetat: true, pivotKananKetat: false,
    };

    // ── ta.ema ──────────────────────────────────────────────────────────────
    function ema(src, len) {
        const out = new Array(src.length), a = 2 / (len + 1);
        for (let i = 0; i < src.length; i++) out[i] = i === 0 ? src[0] : a * src[i] + (1 - a) * out[i - 1];
        return out;
    }

    // ── ta.tr(true) + ta.rma → ta.atr ───────────────────────────────────────
    function atr(c, len) {
        const n = c.length, tr = new Array(n), out = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
            tr[i] = i === 0 ? c[i].high - c[i].low
                : Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close));
        }
        let jumlah = 0;
        for (let i = 0; i < n; i++) {
            if (i < len - 1) { jumlah += tr[i]; continue; }
            if (i === len - 1) { jumlah += tr[i]; out[i] = jumlah / len; continue; }   // seed = SMA len bar pertama
            out[i] = (tr[i] + (len - 1) * out[i - 1]) / len;                            // alpha = 1/len
        }
        return out;
    }

    // ── ta.pivothigh / ta.pivotlow ──────────────────────────────────────────
    // Mengembalikan array: pada indeks i (bar konfirmasi) berisi harga pivot bar i−len, atau null.
    function pivot(c, len, tinggi, o) {
        const n = c.length, out = new Array(n).fill(null);
        const nilai = tinggi ? (k => c[k].high) : (k => c[k].low);
        for (let i = 2 * len; i < n; i++) {
            const p = i - len, v = nilai(p);
            let ok = true;
            for (let j = 1; j <= len && ok; j++) {
                const kiri = nilai(p - j), kanan = nilai(p + j);
                if (tinggi) {
                    if (o.pivotKiriKetat ? !(v > kiri) : !(v >= kiri)) ok = false;
                    else if (o.pivotKananKetat ? !(v > kanan) : !(v >= kanan)) ok = false;
                } else {
                    if (o.pivotKiriKetat ? !(v < kiri) : !(v <= kiri)) ok = false;
                    else if (o.pivotKananKetat ? !(v < kanan) : !(v <= kanan)) ok = false;
                }
            }
            if (ok) out[i] = v;
        }
        return out;
    }

    // ── Logika utama ────────────────────────────────────────────────────────
    function hitung(candles, opsi) {
        const o = Object.assign({}, DEFAULT, opsi || {});
        const c = (candles || []).filter(x => x && Number.isFinite(x.open) && Number.isFinite(x.high) && Number.isFinite(x.low) && Number.isFinite(x.close));
        const n = c.length;
        const L = Math.max(2, Math.floor(o.swing_length));
        const K = Math.max(1, Math.floor(o.history_keep));
        const hasil = { n, ok: false, opsi: o };
        if (n < 2 * L + 5) { hasil.pesan = 'Data terlalu sedikit (butuh ≥ ' + (2 * L + 5) + ' bar).'; return hasil; }

        const close = c.map(x => x.close);
        const e13 = ema(close, o.ema13Len), e21 = ema(close, o.ema21Len), e100 = ema(close, o.ema100Len), e200 = ema(close, o.ema200Len);
        const A = atr(c, o.atrLen);
        const pH = pivot(c, L, true, o), pL = pivot(c, L, false, o);

        // var arrays
        const swHv = new Array(5).fill(0), swLv = new Array(5).fill(0), swHb = new Array(5).fill(0), swLb = new Array(5).fill(0);
        const supplyBoxes = new Array(K).fill(null), demandBoxes = new Array(K).fill(null);
        const supplyBos = new Array(5).fill(null), demandBos = new Array(5).fill(null);

        const unshiftPop = (arr, v) => { arr.unshift(v); arr.pop(); };

        function overlapOk(newPoi, boxes, atrV) {
            const thr = atrV * 2.0;
            for (let i = 0; i < boxes.length; i++) {
                const b = boxes[i];
                if (b === null) continue;
                const poi = (b.top + b.bottom) / 2.0;
                if (newPoi >= poi - thr && newPoi <= poi + thr) return false;
            }
            return true;
        }

        function buatZona(vals, bns, boxes, tipe, atrV, i) {
            const buf = atrV * (o.box_width / 10.0);
            const left = bns[0];
            let top, bottom;
            if (tipe === 1) { top = vals[0]; bottom = top - buf; } else { bottom = vals[0]; top = bottom + buf; }
            const poi = (top + bottom) / 2.0;
            if (overlapOk(poi, boxes, atrV)) {
                boxes.unshift({ left, top, bottom, tipe: tipe === 1 ? 'supply' : 'demand', dibuat: i });
                boxes.pop();   // yang terlama (sudah di-delete di Pine) keluar
            }
        }

        function keBos(boxes, bosArr, tipe, i) {
            for (let k = 0; k < boxes.length; k++) {
                const b = boxes[k];
                if (b === null) continue;
                const tembus = tipe === 1 ? close[i] >= b.top : close[i] <= b.bottom;
                if (!tembus) continue;
                bosArr.unshift({ left: b.left, right: i, y: (b.top + b.bottom) / 2.0, tipe: b.tipe });
                bosArr.pop();   // size > 5 → buang yang terlama
                boxes[k] = null;
            }
        }

        let akhir = null;
        for (let i = 0; i < n; i++) {
            const atrV = A[i];
            if (pH[i] !== null) {
                unshiftPop(swHv, pH[i]); unshiftPop(swHb, i - L);
                if (o.showZones && atrV !== null) buatZona(swHv, swHb, supplyBoxes, 1, atrV, i);
            }
            if (pL[i] !== null) {
                unshiftPop(swLv, pL[i]); unshiftPop(swLb, i - L);
                if (o.showZones && atrV !== null) buatZona(swLv, swLb, demandBoxes, -1, atrV, i);
            }
            keBos(supplyBoxes, supplyBos, 1, i);
            keBos(demandBoxes, demandBos, -1, i);
            if (i === n - 1) akhir = true;
        }

        // ── Bar terakhir: supply/demand terdekat → sweep → level → status ───────
        const i = n - 1, atrAkhir = A[i];
        let supplyTop = null, supplyBottom = null, demandTop = null, demandBottom = null;
        for (let k = 0; k < supplyBoxes.length; k++) {
            const b = supplyBoxes[k];
            if (b !== null && b.bottom > close[i]) { supplyTop = b.top; supplyBottom = b.bottom; break; }
        }
        for (let k = 0; k < demandBoxes.length; k++) {
            const b = demandBoxes[k];
            if (b !== null && b.bottom <= close[i]) { demandTop = b.top; demandBottom = b.bottom; break; }
        }
        let buySwept = false, sellSwept = false;
        if (demandBottom !== null) for (let k = 0; k < o.sweepLookback; k++) { const j = i - k; if (j >= 0 && c[j].low < demandBottom && c[j].close > demandBottom) buySwept = true; }
        if (supplyTop !== null) for (let k = 0; k < o.sweepLookback; k++) { const j = i - k; if (j >= 0 && c[j].high > supplyTop && c[j].close < supplyTop) sellSwept = true; }

        const ada = v => v !== null && v !== undefined && Number.isFinite(v);
        const buy = { entry: null, sl: null, tp1: null, tp2: null, tp3: null };
        const sell = { entry: null, sl: null, tp1: null, tp2: null, tp3: null };
        const semua4 = ada(demandTop) && ada(demandBottom) && ada(supplyTop) && ada(supplyBottom) && ada(atrAkhir);
        if (semua4) {
            buy.entry = demandBottom - atrAkhir * o.buyEntryBufferATR;
            buy.sl = demandBottom - atrAkhir * o.buySLBufferATR;
            buy.tp3 = supplyBottom;
            const rentang = buy.tp3 - buy.entry;
            buy.tp1 = buy.entry + rentang * 0.33;
            buy.tp2 = buy.entry + rentang * 0.66;
            sell.entry = supplyTop + atrAkhir * o.sellEntryBufferATR;
            sell.sl = supplyTop + atrAkhir * o.sellSLBufferATR;
            sell.tp3 = demandTop;
            const rs = sell.entry - sell.tp3;
            sell.tp1 = sell.entry - rs * 0.33;
            sell.tp2 = sell.entry - rs * 0.66;
        }
        const buyBase = ada(buy.entry) && ada(buy.sl) && ada(buy.tp1) && ada(buy.tp2) && ada(buy.tp3)
            && buy.sl < buy.entry && buy.entry < buy.tp1 && buy.tp1 < buy.tp2 && buy.tp2 < buy.tp3;
        const sellBase = ada(sell.entry) && ada(sell.sl) && ada(sell.tp1) && ada(sell.tp2) && ada(sell.tp3)
            && sell.tp3 < sell.tp2 && sell.tp2 < sell.tp1 && sell.tp1 < sell.entry && sell.entry < sell.sl;
        const buyValid = buyBase && (!o.useSweepLogic || buySwept);
        const sellValid = sellBase && (!o.useSweepLogic || sellSwept);
        const status = (valid, base, teks) => valid ? teks : (base && o.useSweepLogic ? 'WAIT SWEEP' : 'WAIT');

        Object.assign(hasil, {
            ok: true,
            ema13: e13, ema21: e21, ema100: e100, ema200: e200, atr: A,
            zona: { supply: supplyBoxes.filter(Boolean), demand: demandBoxes.filter(Boolean) },
            bos: { supply: supplyBos.filter(Boolean), demand: demandBos.filter(Boolean) },
            terdekat: { supplyTop, supplyBottom, demandTop, demandBottom },
            buy: Object.assign({}, buy, { baseValid: buyBase, valid: buyValid, swept: buySwept, status: status(buyValid, buyBase, 'VALID BUY') }),
            sell: Object.assign({}, sell, { baseValid: sellBase, valid: sellValid, swept: sellSwept, status: status(sellValid, sellBase, 'VALID SELL') }),
            tPertama: c[0].time, tTerakhir: c[n - 1].time,
        });
        return hasil;
    }

    const api = { hitung, DEFAULT, _internal: { ema, atr, pivot } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.QIMPineSmcSnd = api;
})(typeof window !== 'undefined' ? window : null);
