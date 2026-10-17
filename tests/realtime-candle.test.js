// Candle realtime ala MT5: tick membuka candle baru saat periode lewat, tanpa candle kosong saat pasar tutup.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'assets/js/dashboard-app.js'), 'utf8');
const a = src.indexOf('function qiBarUntukTick');
const b = src.indexOf("if (typeof window !== 'undefined') window.qiBarUntukTick");
if (a < 0 || b < 0) { console.error('FAIL — qiBarUntukTick tidak ditemukan'); process.exit(1); }
const qiBarUntukTick = new Function(src.slice(a, b) + '; return qiBarUntukTick;')();

let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }

const last = { time: 1000 * 3600, open: 100, high: 105, low: 99, close: 102, volume: 50 };   // candle H1

let r = qiBarUntukTick(last, 103, last.time + 1800, '60');
cek('di dalam periode: candle yang sama diperbarui', !r.baru && r.bar.time === last.time && r.bar.close === 103 && r.bar.high === 105 && r.bar.open === 100);

r = qiBarUntukTick(last, 106, last.time + 1800, '60');
cek('high ikut naik', r.bar.high === 106);

r = qiBarUntukTick(last, 103, last.time + 3600, '60');
cek('periode lewat + harga berubah: candle BARU, open = harga tick', r.baru && r.bar.time === last.time + 3600 && r.bar.open === 103 && r.bar.close === 103);

r = qiBarUntukTick(last, 103, last.time + 3 * 3600 + 5, '60');
cek('terlewat beberapa jam: waktu mengikuti grid candle terakhir', r.baru && r.bar.time === last.time + 3 * 3600);

r = qiBarUntukTick(last, 102, last.time + 7200, '60');
cek('pasar tutup (harga sama dengan close): TIDAK membuat candle kosong', !r.baru && r.bar.time === last.time);

r = qiBarUntukTick(last, 110, last.time + 99999, 'D');
cek('interval harian: tidak membuat candle (mengikuti sinkronisasi)', !r.baru);

r = qiBarUntukTick(last, 103, last.time + 14400, '240');
cek('H4 memakai grid 4 jam', r.baru && r.bar.time === last.time + 14400);

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — candle realtime membuka bar baru dengan aman');
