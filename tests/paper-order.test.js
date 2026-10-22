/**
 * Order paper trading: harga eksekusi ditentukan SERVER, dan posisi tidak pernah hilang diam-diam.
 *
 * Dua celah yang ditutup (2026-10-22):
 *   1. Harga buka/tutup dulu diambil dari klien asal ≤ 1% dari acuan — ±$41 per unit emas,
 *      cukup untuk "memilih" harga sendiri di kompetisi. Kini harga = cache pasar server.
 *   2. Snapshot klien yang tidak memuat sebuah posisi dulu MEMBATALKAN posisi itu (tanpa P/L).
 *      Direproduksi di peramban: GET awal gagal → order berikutnya menghapus posisi BUY terbuka.
 *
 * Bagian PHP dijalankan lewat tests/paper-order.test.php (tanpa database).
 * Run:  node tests/paper-order.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable.`);
} else {
  const run = spawnSync(PHP, [path.join(__dirname, 'paper-order.test.php')], { encoding: 'utf8' });
  let r = null;
  try { r = JSON.parse(run.stdout); } catch (e) { cek('skrip PHP menghasilkan JSON', false, (run.stdout || '') + (run.stderr || '')); }
  if (r) {
    console.log('Harga eksekusi dari server');
    cek('BUY dibuka di ASK pasar', r.buka_buy.harga === 4138.4, r.buka_buy);
    cek('SELL dibuka di BID pasar', r.buka_sell.harga === 4138.0, r.buka_sell);
    cek('tanpa bid/ask: harga tengah (tidak mengarang spread)', r.tanpa_bidask.harga === 84700, r.tanpa_bidask);
    cek('harga klien 0,9% di bawah pasar → DITOLAK (dulu diterima sampai 1%)', typeof r.harga_karangan.tolak === 'string' && /requote/.test(r.harga_karangan.tolak), r.harga_karangan);
    cek('harga klien yang menguntungkan diri sendiri tidak pernah dipakai', r.karangan_dekat.tolak !== undefined || r.karangan_dekat.harga === 4138.0, r.karangan_dekat);
    cek('acuan lebih tua dari 30 detik → ditolak', /terlalu lama/.test(r.acuan_basi.tolak || ''), r.acuan_basi);
    cek('tanpa acuan → ditolak dengan alasan', /belum tersedia/.test(r.tanpa_acuan.tolak || ''), r.tanpa_acuan);
    cek('kurs referensi harian (Frankfurter) → ditolak, bukan dieksekusi', /referensi harian/.test(r.kurs_harian.tolak || ''), r.kurs_harian);
    cek('pasar tutup → ditolak', /sedang tutup/.test(r.pasar_tutup.tolak || ''), r.pasar_tutup);
    cek('tick feed macet → ditolak', /macet/.test(r.tick_macet.tolak || ''), r.tick_macet);
    cek('penolakan membawa kode mesin: requote / pasar_tutup / harga_basi', r.harga_karangan.kode === 'requote' && r.pasar_tutup.kode === 'pasar_tutup'
      && r.acuan_basi.kode === 'harga_basi' && r.tanpa_acuan.kode === 'harga_basi' && r.kurs_harian.kode === 'harga_basi', [r.harga_karangan.kode, r.pasar_tutup.kode, r.acuan_basi.kode]);
    cek('acuan 15 detik → ditolak (batas kini 10 dtk; dulu 30 dtk = arbitrase latensi)', /terlalu lama/.test(r.acuan_15dtk.tolak || ''), r.acuan_15dtk);

    console.log('\nSL / TP');
    cek('BUY: SL di bawah, TP di atas → sah', r.sltp_buy_ok === null, r.sltp_buy_ok);
    cek('BUY: SL di atas harga → ditolak', /BAWAH/.test(r.sltp_buy_sl || ''), r.sltp_buy_sl);
    cek('BUY: TP di bawah harga → ditolak', /ATAS/.test(r.sltp_buy_tp || ''), r.sltp_buy_tp);
    cek('SELL: SL di atas, TP di bawah → sah', r.sltp_sell_ok === null, r.sltp_sell_ok);
    cek('SELL: SL di bawah harga → ditolak', /ATAS/.test(r.sltp_sell_sl || ''), r.sltp_sell_sl);

    console.log('\nCache harga');
    cek('berkas cache terbaru yang dipakai', r.cache_terbaru && r.cache_terbaru.price === 4138.2 && r.cache_terbaru.ask === 4138.4, r.cache_terbaru);
    cek('umur acuan dihitung dari waktu berkas', r.cache_terbaru && r.cache_terbaru.umur <= 5, r.cache_terbaru);
    cek('berkas lebih tua dari 15 menit diabaikan', r.cache_basi === null, r.cache_basi);

    console.log('\nBentuk jawaban');
    cek('objek posisi sama dengan GET (id POS-n, angka bertipe number)', r.obj.id === 'POS-7' && r.obj.lots === 0.1 && r.obj.entryPrice === 4138 && r.obj.sl === null && r.obj.tp === 4100);
    cek('posisi tertutup membawa closePrice, realizedPnL, closedAt ISO', r.obj.closePrice === 4130 && r.obj.realizedPnL === 80 && r.obj.closedAt === '2026-09-21T14:23:20Z' && r.obj.openedAt === '2026-09-21T14:13:20Z', r.obj);
    cek('closeReason & kompPeriode ikut (kontrak API)', r.obj_tp.closeReason === 'tp' && r.obj_tp.kompPeriode === '2026-W43' && r.obj.closeReason === null && r.obj.kompPeriode === undefined, [r.obj_tp, r.obj.closeReason]);
  }
}

console.log('\nKontrak endpoint');
const pt = read('api/paper-trading.php');
cek('aksi buka / tutup / ubah tersedia', /\$aksi === 'buka'/.test(pt) && /\$aksi === 'tutup'/.test(pt) && /\$aksi === 'ubah'/.test(pt));
cek('buka & tutup memakai harga eksekusi server dari feed kanonik', /\$acuan = qi_komp_acuan\(\$sym\);/.test(pt)
  && /\$acuan = qi_komp_acuan\(\$baris\['symbol'\], null, \$baris\);/.test(pt)
  && (pt.match(/qi_paper_harga_eksekusi\([^;]*\$acuan\)/g) || []).length >= 2);
cek('posisi yang tidak ikut snapshot TIDAK dibatalkan lagi', !/SET status = 'cancelled'/.test(pt));
// Jalur snapshot dipensiunkan (2026-10-22): penutupannya mencocokkan simbol/arah/lot kiriman klien.
cek('snapshot lama dijawab 410 (muat ulang), tidak lagi diproses', /http_response_code\(410\)/.test(pt) && !/\$input\['positions'\]/.test(pt));
cek('posisi yang sudah ditutup → 409 dengan siapa yang menutup', /Posisi ini sudah ditutup/.test(pt) && /\$sudahDitutup\(\$baris\), 409/.test(pt));
cek('dua tab menutup posisi yang sama: hanya satu yang menang (rowCount)', /rowCount\(\) !== 1/.test(pt));
cek('posisi otomatis tidak bisa ditutup/diubah pengguna', (pt.match(/in_array\(\$baris\['source'\], \['ai', 'auto'\], true\)/g) || []).length >= 2);
cek('harga entry yang disimpan = harga eksekusi, bukan kiriman klien', /':entry' => \$eks\['harga'\]/.test(pt) && !/':entry' => \$entry/.test(pt));
cek('jumlah posisi terbuka dibatasi', /QI_PAPER_POSISI_MAKS/.test(pt));
cek('GET memberi tahu klien simbol yang didukung', /'symbols'\s*=>\s*\$ALLOWED_SYMBOLS/.test(pt));
// Daftar simbol tinggal di api/_paper_order.php (QI_PAPER_SIMBOL) — dipakai juga competition.php?harga=.
const po = read('api/_paper_order.php');
const daftarSimbol = (po.match(/define\('QI_PAPER_SIMBOL', \[([\s\S]*?)\]\);/) || [])[1] || '';
cek('AUDUSD/NZDUSD/USDCHF/USDCAD bisa ditradingkan (model P/L-nya ada)', ['AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD'].every((s) => daftarSimbol.includes("'" + s + "'"))
  && /\$ALLOWED_SYMBOLS = QI_PAPER_SIMBOL;/.test(pt));
cek('competition.php?harga= melayani semua simbol paper (posisi turnamen di luar tiket arena bisa ditandai & ditutup)',
  /array_merge\(QI_KOMP_SIMBOL, QI_PAPER_SIMBOL\)/.test(read('api/competition.php')));

if (gagal) { console.error(`\nFAIL — ${gagal} pemeriksaan gagal`); process.exit(1); }
console.log('\nPASS — order paper trading: harga server, tanpa pembatalan diam-diam');
