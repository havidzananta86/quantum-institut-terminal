// Setup analisa (assets/js/qim-setups.js): Entry/SL/TP harus berasal dari struktur metode
// (OB, FVG, impuls Fibonacci, zona base), R:R ≥ 1:2, dan setup batal saat strukturnya rusak.
const Q = require('../assets/js/qim-setups.js');

let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }
const dekat = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const W = 0.2;   // panjang wick candle buatan
/** Candle dari daftar close: open = close sebelumnya, wick ±W. Item array = [o,h,l,c] eksplisit. */
function buat(langkah, mulai = 100) {
    const c = [];
    let prev = mulai, t = 1_700_000_000;
    for (const x of langkah) {
        let o, h, l, cl;
        if (Array.isArray(x)) [o, h, l, cl] = x;
        else { o = prev; cl = x; h = Math.max(o, cl) + W; l = Math.min(o, cl) - W; }
        c.push({ time: t, open: o, high: h, low: l, close: cl });
        prev = cl; t += 3600;
    }
    return c;
}
const datar = n => Array(n).fill(100);   // high sama semua → tidak ada swing palsu
const atrTerakhir = c => { const a = Q._internal.atr(c); return a[a.length - 1]; };
const opsi = { presisi: 6 };

// ── SMC: downtrend → CHoCH bullish dengan FVG → pullback belum menyentuh OB ─────────────
const jalurSMC = [
    ...datar(50),
    101, 101.5, 102, 102.5, 103,                       // swing high 103
    102.5, 102, 101.5, 101, 100.5, 100, 99.5, 99, 98.5, 98,
    98.5, 99, 99.5, 100, 100.5, 101,                   // lower high 101 (swing internal)
    100.5, 100, 99.5, 99, 98.5, 98, 97.5, 97, 96.5, 96, // candle 96.5→96 = OB bearish terakhir
    97.5, 99.5, 101.5, 103, 104, 105, 106,             // impuls + FVG, close 101.5 > 101.2 = CHoCH
    105.5, 105, 104.5, 104, 103.5, 103.4,              // pullback (candle terakhir = berjalan)
];
let c = buat(jalurSMC);
let r = Q.deteksi('SMC', c, opsi);
let s = r.setups[0];
console.log('SMC');
cek('menemukan setup BUY MENUNGGU', s && s.arah === 'BUY' && s.status === 'MENUNGGU');
cek('struktur = CHoCH (tren sebelumnya turun)', s && s.struktur === 'CHoCH');
cek('entry = high candle bearish terakhir sebelum impuls (96.7)', s && dekat(s.entry, 96.7));
cek('SL = low OB 95.8 − 0,1×ATR', s && dekat(s.sl, 95.8 - 0.1 * atrTerakhir(c.slice(0, -1)), 1e-6));
cek('TP = high setelah CHoCH 106.2', s && dekat(s.tp, 106.2));
cek('R:R dihitung dari level dan ≥ 1:2', s && s.rr >= 2 && dekat(s.rr, Math.round((s.tp - s.entry) / (s.entry - s.sl) * 100) / 100, 0.011));

// Pullback menembus OB → BUY tidak boleh muncul lagi.
c = buat([...jalurSMC.slice(0, -6), 104, 102, 100, 98, 96, 95.3, 95.6]);
r = Q.deteksi('SMC', c, opsi);
cek('OB tertembus → tidak ada setup BUY', !r.setups.some(x => x.arah === 'BUY'));

// Candle berjalan menyentuh SL → setup langsung dibuang.
c = buat([...jalurSMC.slice(0, -1), [103.4, 103.6, 95.0, 103.0]]);
r = Q.deteksi('SMC', c, opsi);
cek('candle berjalan menembus SL → setup dibuang', !r.setups.some(x => x.arah === 'BUY') && /SL/.test(r.catatan || ''));

// ── FIBONACCI: impuls 95.8 → 106.2 (higher high di atas 101.2) ─────────────────────────
c = buat(jalurSMC);
r = Q.deteksi('FIBO', c, opsi);
s = r.setups.find(x => x.arah === 'BUY');
console.log('Fibonacci');
const R = 106.2 - 95.8;
cek('menemukan setup BUY MENUNGGU', s && s.status === 'MENUNGGU');
cek('entry = level 0.618 dari impuls', s && dekat(s.entry, 106.2 - 0.618 * R, 1e-6));
cek('TP = extension 1.272', s && dekat(s.tp, 106.2 + 0.272 * R, 1e-6));
cek('SL di bawah awal impuls 95.8', s && s.sl < 95.8 && dekat(s.sl, 95.8 - 0.1 * atrTerakhir(c.slice(0, -1)), 1e-6));
cek('impuls turun lama yang sudah kena SL tidak muncul', !r.setups.some(x => x.arah === 'SELL'));

// ── ICT: sweep sell-side → MSS → FVG ─────────────────────────────────────────────────
const jalurICT = [
    ...datar(50),
    99.5, 99, 98.5, 98,                    // swing low 97.8 (likuiditas)
    98.5, 99, 99.5, 100,                   // swing internal 100.2
    99.5, 99, 98.5,
    [98.5, 98.7, 97.4, 98.3],              // sweep: wick 97.4 < 97.8, close kembali di atas
    99.3, 100.6,                           // displacement, close 100.6 > 100.2 = MSS, FVG 98.7–99.1
    101.5, 102, 102.5,
    102, 101.5, 101, 100.9,
];
c = buat(jalurICT);
r = Q.deteksi('ICT', c, opsi);
s = r.setups.find(x => x.arah === 'BUY');
console.log('ICT');
cek('menemukan setup BUY MENUNGGU', s && s.status === 'MENUNGGU');
cek('entry = CE (50%) FVG 98.7–99.1 = 98.9', s && dekat(s.entry, 98.9, 1e-6));
cek('SL di balik wick sweep 97.4', s && s.sl < 97.4 && dekat(s.sl, 97.4 - 0.1 * atrTerakhir(c.slice(0, -1)), 1e-6));
cek('TP = buy-side liquidity 102.7, R:R ≥ 1:2', s && dekat(s.tp, 102.7) && s.rr >= 2);

// Tanpa sweep (low tidak menembus 97.8) → tidak ada setup BUY.
const tanpaSweep = jalurICT.slice();
tanpaSweep[61] = [98.5, 98.7, 97.9, 98.3];
r = Q.deteksi('ICT', buat(tanpaSweep), opsi);
cek('tanpa liquidity sweep → tidak ada setup BUY', !r.setups.some(x => x.arah === 'BUY'));

// ── SUPPLY & DEMAND: DBR, base 3 candle, leg-out eksplosif ─────────────────────────────
const jalurSND = [
    ...datar(50),
    99.5, 99,                                                   // drop (leg-in)
    [99, 99.3, 98.7, 99.05], [99.05, 99.3, 98.8, 98.95], [98.95, 99.25, 98.75, 99.0],   // base
    [99.0, 101.6, 98.9, 101.5],                                 // leg-out eksplosif
    102, 102.5, 103,
    102.5, 102, 101.5, 101.4,
];
c = buat(jalurSND);
r = Q.deteksi('SND', c, opsi);
s = r.setups.find(x => x.arah === 'BUY');
console.log('Supply & Demand');
cek('menemukan zona demand DBR segar', s && s.status === 'MENUNGGU' && /DBR/.test(s.alasan[0]));
cek('entry = garis proximal (body tertinggi base) 99.05', s && dekat(s.entry, 99.05));
cek('SL = garis distal 98.7 − 0,1×ATR', s && dekat(s.sl, 98.7 - 0.1 * atrTerakhir(c.slice(0, -1)), 1e-6));
cek('TP struktural dengan R:R ≥ 1:2', s && s.tp > s.entry && s.rr >= 2);

// Zona sudah diuji lebih dari 3 candle lalu → bukan zona segar lagi.
c = buat([...jalurSND.slice(0, -1), 100.5, 99.6, 99.0, 100, 101, 101.5, 102, 102.5, 102.4]);
r = Q.deteksi('SND', c, opsi);
cek('zona yang sudah diuji ulang tidak dipakai lagi', !r.setups.some(x => x.arah === 'BUY'));

// ── Aturan umum ──────────────────────────────────────────────────────────────────────
console.log('Aturan umum');
const p = Q._internal.pilihTP('BUY', 100, 99, [{ harga: 101.5, label: 'x' }]);
cek('TP struktural dengan R:R < 1:2 ditolak (tidak dikarang)', p.tp === null);
const sim = buat(jalurSMC); sim.simulated = true;
cek('data simulasi tidak menghasilkan setup', Q.deteksi('SMC', sim).setups.length === 0);
cek('data kurang dari 60 candle → catatan jujur', /Data kurang/.test(Q.deteksi('FIBO', buat([101, 102, 103])).catatan));

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — setup SMC/ICT/Fibonacci/S&D mengikuti struktur metode');
