/**
 * ARENA KOMPETISI (kompetisi.html) — kontrak halaman & aturan turnamen.
 *
 * Yang dijaga di sini:
 *   1. Setiap id yang disentuh assets/js/halaman-kompetisi.js BENAR-BENAR ada di halamannya
 *      (kesalahan paling mudah terjadi dan paling sunyi: fungsi berhenti diam-diam).
 *   2. Aturan "manual saja" dan "saldo simulasi" ditegakkan SERVER, bukan hanya tulisan di layar.
 *   3. Model P/L arena identik dengan model bersama (qim-paper-math.js ↔ api/_paper_math.php).
 *   4. Arena tidak memuat satu pun kendali bot.
 *   5. Pengunjung tanpa login / FREE menjadi PENONTON (papan publik), bukan dialihkan ke login.
 * Perilaku tombol, toast, polling, dan chart diuji dengan kode asli di tests/kompetisi-arena-perilaku.test.js.
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
  // qiCookieBar dibuat assets/js/cookie-consent.js (arena hanya mengukur tingginya).
  const dibuatSkrip = new Set(['qiCookieBar']);
  cek('qiCookieBar memang dibuat cookie-consent.js', /bar\.id = 'qiCookieBar'/.test(baca('assets/js/cookie-consent.js')));
  const adaDiHtml = (id) => new RegExp('id="' + id + '"').test(html);
  const hilang = [...dipakai].filter((id) => !dibuatSkrip.has(id) && !adaDiHtml(id));
  cek(`${dipakai.size} id dirujuk skrip, semuanya ada di markup`, hilang.length === 0, hilang);
}

console.log('\nSelektor data-* yang dipakai skrip ada di halaman');
{
  // Tombol arah "untuk hitung SL/TP cepat" ([data-arah]) DIHAPUS (audit 2026-10-22): SL/TP cepat kini
  // dihitung untuk sisi yang DITEKAN, jadi tidak ada lagi pilihan arah yang bisa tidak cocok.
  const pasangan = [
    ['[data-tf]', 'dibuat skrip'],            // tombol timeframe dirender renderPemilih()
    ['[data-isi]', 'dibuat skrip'],           // jarak SL/TP cepat per simbol (renderSatuan)
    ['[data-lot]', 'markup'],
  ];
  for (const [sel, asal] of pasangan) {
    const atribut = sel.slice(6, -1);
    const ada = asal === 'markup' ? new RegExp('data-' + atribut + '=').test(html)
                                  : new RegExp('data-' + atribut + '=').test(js);
    cek(`${sel} tersedia (${asal})`, ada);
  }
  cek('tombol tutup posisi dirender skrip dan ditangkap delegasi', /data-tutup="/.test(js) && /closest\('\[data-tutup\]'\)/.test(js));
  cek('tidak ada lagi pemilih arah SL/TP yang terpisah dari tombol BUY/SELL', !/data-arah=/.test(html) && /function hitungSlTp\(arah\)/.test(js));
  cek('baris papan & aktivitas membuka laci trader lewat data-kode', /data-kode="/.test(js) && /closest\('\[data-kode\]'\)/.test(js));
}

console.log('\nAturan ditegakkan SERVER, bukan sekadar tulisan di layar');
{
  // Manual saja: papan peringkat mengecualikan posisi otomatis.
  cek("api/competition.php hanya menghitung source 'manual' (AI 'ai' & 'auto' tidak ikut)", /status = 'closed' AND pp\.source = 'manual'/.test(comp));
  // Order baru dari klien SELALU disimpan sebagai manual (satu-satunya INSERT: aksi 'buka').
  cek("api/paper-trading.php menyimpan order baru sebagai source 'manual' (+ seri harga tempat ia diisi)", /VALUES \(:uid, :sym, :dir, :lots, :entry, :sl, :tp, 'open', NOW\(\), 'manual', :kp, :cid, :asal, :hs, :hg\)/.test(paper)
    && (paper.match(/INSERT INTO paper_positions/g) || []).length === 1);
  // Posisi otomatis dilindungi: tidak bisa ditutup/diubah klien; jalur snapshot lama dipensiunkan (410).
  cek('posisi otomatis tidak bisa ditutup/diubah klien; snapshot lama → 410', (paper.match(/in_array\(\$baris\['source'\], \['ai', 'auto'\], true\)/g) || []).length >= 2 && /http_response_code\(410\)/.test(paper));
  cek('papan mingguan = ekuitas posisi manual periode ini (bukan hanya posisi tertutup)', /pp\.source = 'manual' AND pp\.komp_periode = :p/.test(baca('api/_kompetisi_papan.php')) && /'equity'\s+=> \$equity/.test(baca('api/_kompetisi_papan.php')));
  // Saldo simulasi, dan hanya PRO ke atas.
  cek('saldo awal simulasi $10.000 di server', /\$STARTING_BALANCE = 10000\.0;/.test(paper));
  cek('paper trading hanya untuk PRO ke atas', /qi_require_level\('pro'\)/.test(paper));
  cek('arena memakai saldo awal yang sama dengan server', /const SALDO_AWAL = 10000;/.test(js));
  cek('kompetisi memakai saldo awal yang sama', /QI_COMP_SALDO_AWAL = 10000\.0/.test(comp));
  // Harga divalidasi server terhadap pasar.
  cek('harga eksekusi ditentukan server, bukan kiriman klien (tests/paper-order.test.js)', /qi_paper_harga_eksekusi\(/.test(paper));
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
  // Audit G1: harga TUTUP ditentukan server; tanpa harga layar permintaan dikirim tanpa 'harga' (dulu
  // posisi di luar 10 simbol arena tidak pernah bisa ditutup dari sini).
  cek('tutup tanpa harga layar tetap dikirim TANPA harga (server yang menentukan)', /const muatan = \{ aksi: 'tutup', id: p\.id \};/.test(js) && /if \(Number\.isFinite\(Number\(hk\)\) && Number\(hk\) > 0\) muatan\.harga = hk;/.test(js));
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
  // Daftar peran = qi_tingkat_peran() ≥ 1 di server (premium/vip_plus/elite dulu jadi penonton).
  {
    const m = gate.match(/var BERHAK = \[([^\]]*)\]/);
    const daftar = m ? m[1].split(',').map((s) => s.trim().replace(/'/g, '')) : [];
    const mw = baca('api/_middleware.php');
    const fn = mw.slice(mw.indexOf('function qi_tingkat_peran('), mw.indexOf('function qi_tingkat_peran(') + 400);
    const server = [...fn.matchAll(/case '([a-z_]+)':/g)].map((x) => x[1]);
    cek('gerbang menerima semua peran yang diterima server (pro … admin)', server.length >= 6 && server.every((r) => daftar.includes(r)), { daftar, server });
  }
  cek('tautan login dipasang setelah DOM siap (dulu getElementById → null di awal <body>)',
    /document\.addEventListener\('DOMContentLoaded', function \(\) \{\s*var a = document\.getElementById\('kompCtaUtama'\)/.test(gate));
  // Dulu tanpa token dialihkan ke login; kini PENONTON (pemilik: orang lain bisa memantau para trader).
  cek('tanpa token → mode penonton, TIDAK dialihkan ke login', /if \(!token\) \{ setMode\('penonton', 'tamu'\); return; \}/.test(gate) && !/location\.replace\('login\.html'\)/.test(gate));
  cek('FREE → mode penonton dengan ajakan upgrade', /setMode\('penonton', 'free'\)/.test(gate) && /Upgrade PRO untuk ikut/.test(gate));
  cek('mode diumumkan lewat window.QI_KOMP_MODE + event qi-komp-mode', /window\.QI_KOMP_MODE = mode/.test(gate) && /qi-komp-mode/.test(gate) && /qi-komp-mode/.test(js));
  cek('peran diperiksa ulang ke server (localStorage bisa basi)', /type: 'verify_token'/.test(gate));
  cek('peran basi diperbarui lewat QuantumAuth.saveSession (muat berikutnya tidak memanggil endpoint pribadi lagi)',
    /QuantumAuth\.saveSession\(token, Object\.assign\(\{\}, userData, \{ role: role \}\), ingat\)/.test(gate));
  cek('halaman memulai sebagai penonton sampai gerbang memutuskan', /<body class="h-full komp-penonton">/.test(html));
  cek('halaman memuat gerbang sebelum isinya', html.indexOf('halaman-kompetisi-gerbang.js') < html.indexOf('halaman-kompetisi.js'));
  const dash = baca('dashboard.html');
  cek('dashboard menautkan arena di sidebar', /href="kompetisi\.html"/.test(dash));
  cek('tautan arena muncul dua kali (sidebar + bar atas)', (dash.match(/href="kompetisi\.html"/g) || []).length >= 2);
}

console.log('\nTampilan kompetisi profesional & ponsel');
{
  for (const id of ['kompHitung', 'kompHadiah', 'kompPeserta', 'kompChipRank', 'kompFeed', 'kompLaci', 'kompMobileBar', 'kompMargin', 'kompBid', 'kompAsk', 'kompSpread']) {
    cek(`elemen #${id} ada`, new RegExp('id="' + id + '"').test(html));
  }
  cek('ponsel: tiket langsung setelah chart (grid-template-areas)', /"chart" "tiket" "posisi" "papan" "feed"/.test(html));
  cek('ponsel: bar BUY/SELL menempel di bawah < 640 px', /@media \(max-width:640px\)[\s\S]{0,200}\.komp-mbar \{ display:grid;[\s\S]{0,80}position:fixed/.test(html));
  cek('toast & bar BUY/SELL ponsel naik di atas bilah cookie (--komp-bawah dari tinggi #qiCookieBar)',
    /\.komp-toast \{ position:fixed; left:50%; bottom:calc\(22px \+ var\(--komp-bawah, 0px\)\)/.test(html)
    && /\.komp-mbar \{ display:grid;[^}]*bottom:var\(--komp-bawah, 0px\)/.test(html)
    && /setProperty\('--komp-bawah'/.test(js) && /MutationObserver\(atur\)/.test(js));
  cek('lencana CONTOH tidak ikut aturan label blok kartu hadiah', /\.komp-hero-stat > div > span \{ display:block;/.test(html) && !/\.komp-hero-stat span \{/.test(html));
  cek('tombol BUY = ask, SELL = bid (label tiket)', /ASK · BUY/.test(html) && /BID · SELL/.test(html));
  cek('timeframe M1 & M30 tersedia', /label: 'M1', nilai: '1'/.test(js) && /label: 'M30', nilai: '30'/.test(js));
  cek('versi skrip dinaikkan (cache peramban)', /halaman-kompetisi\.js\?v=2\./.test(html) && /halaman-kompetisi-gerbang\.js\?v=2\./.test(html));
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
