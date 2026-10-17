// Penunjuk header (assets/js/qim-header.js): status data jujur, sesi pasar, lencana paket.
const H = require('../assets/js/qim-header.js');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info))); if (!kondisi) gagal++; }

console.log('Status data');
const dasar = { simbol: 'XAUUSD', simbolBridge: true, harga: null, sumberCandle: '', soket: null };
let r = H.hitungStatusData({ ...dasar, soket: { state: 'live', umurDetik: 3 }, harga: { source: 'mt5_bridge', market: 'open' }, sumberCandle: 'mt5' });
cek('soket MT5 live, tick 3 dtk → hijau "MT5 · LIVE"', r.tingkat === 'ok' && r.label === 'MT5 · LIVE', r);
r = H.hitungStatusData({ ...dasar, soket: { state: 'live', umurDetik: 60 }, harga: { source: 'mt5_bridge', market: 'open' } });
cek('tick MT5 60 dtk → kuning dengan umur', r.tingkat === 'warn' && r.label === 'MT5 · 60 dtk', r);
r = H.hitungStatusData({ ...dasar, soket: { state: 'live', umurDetik: 400 }, harga: { source: 'mt5_bridge', market: 'closed', tick_age: 40000 } });
cek('tanpa tick lama + pasar ditandai tutup → abu "PASAR TUTUP"', r.tingkat === 'idle' && r.label === 'PASAR TUTUP', r);
r = H.hitungStatusData({ ...dasar, soket: { state: 'live', umurDetik: 400 }, harga: { source: 'mt5_bridge', market: 'open' } });
cek('tanpa tick lama padahal pasar buka → kuning (bukan hijau)', r.tingkat === 'warn' && /TANPA TICK/.test(r.label), r);
r = H.hitungStatusData({ ...dasar, harga: { source: 'oanda_tv', market: 'open' }, sumberCandle: 'oanda_tv' });
cek('OANDA normal → hijau "OANDA"', r.tingkat === 'ok' && r.label === 'OANDA', r);
r = H.hitungStatusData({ ...dasar, harga: { source: 'mt5_bridge', market: 'open' }, sumberCandle: 'mt5' });
cek('MT5 lewat polling (soket belum hidup) → hijau "MT5"', r.tingkat === 'ok' && r.label === 'MT5', r);
r = H.hitungStatusData({ ...dasar, harga: { source: 'biquote', market: 'open' }, sumberCandle: 'biquote' });
cek('simbol MT5/OANDA tetapi memakai biquote → kuning "CADANGAN · BIQUOTE"', r.tingkat === 'warn' && r.label === 'CADANGAN · BIQUOTE', r);
r = H.hitungStatusData({ simbol: 'ETHUSDT', simbolBridge: false, harga: { source: 'binance' }, sumberCandle: 'binance', soket: null });
cek('simbol non-bridge dari Binance → hijau (bukan cadangan)', r.tingkat === 'ok' && r.label === 'BINANCE', r);
r = H.hitungStatusData({ ...dasar, harga: { source: 'oanda_tv' }, sumberCandle: 'simulasi' });
cek('candle simulasi → merah "SIMULASI"', r.tingkat === 'bad' && r.label === 'SIMULASI', r);
r = H.hitungStatusData({ ...dasar });
cek('belum ada data → abu "MEMUAT"', r.tingkat === 'idle' && r.label === 'MEMUAT', r);
r = H.hitungStatusData({ ...dasar, harga: { source: 'oanda_tv', market: 'closed', tick_age: 7200 } });
cek('OANDA pasar tutup → abu, umur tick tercantum', r.tingkat === 'idle' && /2 jam/.test(r.judul), r);
r = H.hitungStatusData({ ...dasar, soket: { state: 'off', umurDetik: null }, harga: { source: 'oanda_tv', market: 'open' } });
cek('soket MT5 mati, OANDA hidup → OANDA (tidak berpura-pura MT5)', r.label === 'OANDA', r);

console.log('Sesi pasar');
const s = d => H.sesiPasar(new Date(d));
let x = s('2026-10-19T07:30:00Z');   // Senin
const buka = x.sesi.filter(q => q.buka).map(q => q.kode).sort().join(',');
cek('Senin 07:30 UTC: Tokyo + London buka, Sydney & New York tutup', buka === 'LDN,TYO', buka);
cek('dua sesi buka → tumpang tindih', x.tumpang === true && x.tutup === false);
x = s('2026-10-18T21:00:00Z');       // Minggu malam UTC = Senin 08:00 Sydney
cek('Minggu 21:00 UTC: Sydney sudah buka (pembukaan pekan)', x.sesi.find(q => q.kode === 'SYD').buka === true && x.sesi.filter(q => q.buka).length === 1);
x = s('2026-10-17T12:00:00Z');       // Sabtu
cek('Sabtu: semua sesi tutup', x.tutup === true && x.sesi.every(q => !q.buka));
let g = H.menitKeGanti(H.SESI[2], { hari: 1, jam: 16, menit: 30 });
cek('London buka, 16:30 → tutup dalam 30 menit', g.buka === true && g.menit === 30, g);
g = H.menitKeGanti(H.SESI[2], { hari: 5, jam: 17, menit: 0 });
cek('Jumat 17:00 (tutup) → buka Senin 08:00 = 3780 menit', g.buka === false && g.menit === 3 * 1440 + 480 - 1020, g);
g = H.menitKeGanti(H.SESI[2], { hari: 6, jam: 12, menit: 0 });
cek('Sabtu 12:00 → buka Senin 08:00 = 2640 menit', g.buka === false && g.menit === 2 * 1440 + 480 - 720, g);
g = H.menitKeGanti(H.SESI[2], { hari: 2, jam: 6, menit: 0 });
cek('Selasa 06:00 (belum buka) → buka hari ini dalam 120 menit', g.buka === false && g.menit === 120, g);
cek('durasi: 45 mnt, 3 j 12 mnt, 3 hari', H.teksDurasi(45) === '45 mnt' && H.teksDurasi(192) === '3 j 12 mnt' && H.teksDurasi(4320) === '3 hari');

console.log('Lencana paket');
cek('free → tombol Upgrade ke pricing.html', H.lencanaPaket('free').teks === 'Upgrade' && H.lencanaPaket('free').href === 'pricing.html');
cek('peran tak dikenal / kosong → free', H.lencanaPaket(undefined).kode === 'free' && H.lencanaPaket('xyz').kode === 'free');
cek('pro, vip, admin → lencana bernama', ['pro', 'vip', 'admin'].every(p => H.lencanaPaket(p).teks === p.toUpperCase() && H.lencanaPaket(p).href === 'profile.html'));
cek('huruf besar tetap dikenali', H.lencanaPaket('PRO').kode === 'pro');

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — status data, sesi pasar, dan lencana paket di header');
