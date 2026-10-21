/**
 * ARENA KOMPETISI (kompetisi.html) — kontrak halaman & aturan turnamen.
 *
 * Yang dijaga di sini:
 *   1. Setiap id yang disentuh assets/js/halaman-kompetisi.js BENAR-BENAR ada di halamannya
 *      (kesalahan paling mudah terjadi dan paling sunyi: fungsi berhenti diam-diam).
 *   2. Aturan "manual saja" dan "saldo simulasi" ditegakkan SERVER, bukan hanya tulisan di layar.
 *   3. Model P/L arena identik dengan model bersama (qim-paper-math.js ↔ api/_paper_math.php).
 *   4. Arena tidak memuat satu pun kendali bot.
 *
 * Run:  node tests/kompetisi-arena.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300)}`);
  if (!lulus) gagal++;
};

const html = baca('kompetisi.html');
const js   = baca('assets/js/halaman-kompetisi.js');
const gate = baca('assets/js/halaman-kompetisi-gerbang.js');
const paper = baca('api/paper-trading.php');
const comp  = baca('api/competition.php');

console.log('\nBerkas halaman');
cek('kompetisi.html ada', html.length > 2000);
cek('skrip arena ada', js.length > 2000);
cek('gerbang akses ada', gate.length > 500);

console.log('\nSetiap id yang dipakai skrip ada di halaman');
{
  // $('xxx') dan getElementById('xxx') di dalam skrip arena.
  const dipakai = new Set();
  for (const m of js.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)) dipakai.add(m[1]);
  for (const m of js.matchAll(/getElementById\('([A-Za-z][\w-]*)'\)/g)) dipakai.add(m[1]);
  // Id yang dibuat skrip itu sendiri (bukan dari markup) tidak diperiksa.
  const dibuatSkrip = new Set();
  const adaDiHtml = (id) => new RegExp('id="' + id + '"').test(html);
  const hilang = [...dipakai].filter((id) => !dibuatSkrip.has(id) && !adaDiHtml(id));
  cek(`${dipakai.size} id dirujuk skrip, semuanya ada di markup`, hilang.length === 0, hilang);
}

console.log('\nSelektor data-* yang dipakai skrip ada di halaman');
{
  const pasangan = [
    ['[data-tf]', 'dibuat skrip'],            // tombol timeframe dirender renderPemilih()
    ['[data-arah]', 'markup'],
    ['[data-isi]', 'markup'],
  ];
  for (const [sel, asal] of pasangan) {
    const atribut = sel.slice(6, -1);
    const ada = asal === 'markup' ? new RegExp('data-' + atribut + '=').test(html)
                                  : new RegExp('data-' + atribut + '=').test(js);
    cek(`${sel} tersedia (${asal})`, ada);
  }
  cek('tombol tutup posisi dirender skrip dan ditangkap delegasi', /data-tutup="/.test(js) && /closest\('\[data-tutup\]'\)/.test(js));
}

console.log('\nAturan ditegakkan SERVER, bukan sekadar tulisan di layar');
{
  // Manual saja: papan peringkat mengecualikan posisi otomatis.
  cek("api/competition.php mengecualikan source 'auto' dari peringkat", /status = 'closed' AND pp\.source <> 'auto'/.test(comp));
  // Order baru dari klien SELALU disimpan sebagai manual.
  cek("api/paper-trading.php menyimpan order baru sebagai source 'manual'", /status, opened_at, source\)[\s\S]{0,200}'open', COALESCE\(FROM_UNIXTIME\(:ots\), NOW\(\)\), 'manual'\)/.test(paper));
  // Posisi otomatis dilindungi: tidak bisa ditutup/diubah lewat snapshot klien.
  cek('posisi otomatis dilindungi dari snapshot klien', /source IN \('ai', 'auto'\)/.test(paper) && /dilindungi/.test(paper));
  // Saldo simulasi, dan hanya PRO ke atas.
  cek('saldo awal simulasi $10.000 di server', /\$STARTING_BALANCE = 10000\.0;/.test(paper));
  cek('paper trading hanya untuk PRO ke atas', /qi_require_level\('pro'\)/.test(paper));
  cek('arena memakai saldo awal yang sama dengan server', /const SALDO_AWAL = 10000;/.test(js));
  cek('kompetisi memakai saldo awal yang sama', /QI_COMP_SALDO_AWAL = 10000\.0/.test(comp));
  // Harga divalidasi server terhadap pasar.
  cek('server menolak harga yang menyimpang dari pasar', /terlalu jauh dari harga pasar/.test(paper));
}

console.log('\nTidak ada kendali bot di arena');
{
  for (const larangan of ['ai-auto-trade', 'auto-paper', 'ikutiAuto', 'autoTrade', 'aiAutoTrade']) {
    cek(`arena tidak memanggil ${larangan}`, !js.includes(larangan) && !html.includes(larangan));
  }
  cek('posisi bot ditampilkan apa adanya, tidak disembunyikan', /kompBot/.test(js) && /TIDAK dihitung papan peringkat/.test(js));
  cek('posisi bot tidak bisa ditutup dari arena (hanya manual yang masuk daftar)',
    /filter\(\(p\) => \(p\.src \|\| 'manual'\) === 'manual'\)/.test(js));
}

console.log('\nKejujuran data');
{
  cek('candle simulasi DITOLAK, chart dikosongkan', /d\.simulated === true/.test(js) && /DATA SIMULASI/.test(js));
  cek('sumber candle ditandai (MT5 vs cadangan)', /MT5 · BROKER QI/.test(js));
  cek('P/L tidak ditebak tanpa harga live', /tanpa harga, P\/L TIDAK ditebak/.test(js) && /return null;/.test(js));
  cek('posisi tidak ditutup tanpa harga live', /posisi tidak ditutup supaya P\/L tidak dikarang/.test(js));
  cek('order ditolak tanpa harga live', /order tidak dikirim/.test(js));
}

console.log('\nModel P/L sama dengan model bersama');
{
  const { qimPaperMult, qimPaperPnl } = require(path.join(root, 'assets/js/qim-paper-math.js'));
  cek('arena memanggil window.qimPaperMult', /window\.qimPaperMult/.test(js));
  cek('halaman memuat qim-paper-math.js', /qim-paper-math\.js/.test(html));
  // Angka acuan: 0,10 lot XAUUSD naik $10 → 0,10 × 100 oz × $10 = $100.
  cek('XAUUSD: 0,10 lot naik $10 = +$100', qimPaperPnl('XAUUSD', 'BUY', 2600, 2610, 0.1) === 100, qimPaperPnl('XAUUSD', 'BUY', 2600, 2610, 0.1));
  // 0,10 lot = 10.000 unit; gerak 0,00100 (10 pip) × 10.000 = $10.
  cek('EURUSD: 0,10 lot naik 10 pip = +$10', qimPaperPnl('EURUSD', 'BUY', 1.08000, 1.08100, 0.1) === 10, qimPaperPnl('EURUSD', 'BUY', 1.08000, 1.08100, 0.1));
  cek('SELL untung saat harga turun', qimPaperPnl('XAUUSD', 'SELL', 2610, 2600, 0.1) === 100);
  cek('kripto 1 koin per lot', qimPaperMult('BTCUSDT') === 1);
}

console.log('\nGerbang akses & tautan');
{
  cek('gerbang menerima pro, vip, admin', /\['pro', 'vip', 'admin'\]/.test(gate));
  cek('tanpa token dialihkan ke login', /window\.location\.replace\('login\.html'\)/.test(gate));
  cek('peran diperiksa ulang ke server (localStorage bisa basi)', /type: 'verify_token'/.test(gate));
  cek('halaman memuat gerbang sebelum isinya', html.indexOf('halaman-kompetisi-gerbang.js') < html.indexOf('halaman-kompetisi.js'));
  const dash = baca('dashboard.html');
  cek('dashboard menautkan arena di sidebar', /href="kompetisi\.html"/.test(dash));
  cek('tautan arena muncul dua kali (sidebar + bar atas)', (dash.match(/href="kompetisi\.html"/g) || []).length >= 2);
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
