// Kontrak halaman publik (assets/css/publik.css): kepala & kaki halaman SAMA di semua halaman publik, tautan
// pengungkapan risiko di setiap kaki halaman, tanpa urgensi/kelangkaan palsu di halaman harga, tanpa angka
// karangan di halaman masuk & status, dan halaman baru (metodologi, risiko, changelog, bantuan) terdaftar.
// Mengubah menu atau kaki halaman: ubah di SEMUA halaman di daftar HALAMAN (tes ini menunjukkan yang berbeda).
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300))); if (!kondisi) gagal++; }

// Halaman dengan kerangka publik penuh. profile.html memakai kerangka yang sama dengan tombol "Terminal"
// menggantikan "Masuk" (halaman berlogin); economic-calendar.html tetap tata letak aplikasi.
const HALAMAN = ['pricing.html', 'login.html', 'register.html', 'status.html', 'pwa.html', 'privacy.html', 'terms.html',
  '404.html', 'metodologi.html', 'risiko.html', 'changelog.html', 'bantuan.html'];
const BARU = ['metodologi.html', 'risiko.html', 'changelog.html', 'bantuan.html'];

const ambil = (s, re) => { const m = s.match(re); return m ? m[0] : null; };
const kepala = s => (ambil(s, /<header class="pb-kepala">[\s\S]*?<\/header>/) || '').replace(/ aria-current="page"/g, '');
const kaki = s => ambil(s, /<footer class="pb-kaki">[\s\S]*?<\/footer>/) || '';
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B50}\u{23F0}-\u{23FF}]/u;

console.log('Kerangka sama di semua halaman publik');
const isi = Object.fromEntries(HALAMAN.map(h => [h, read(h)]));
const acuanKepala = kepala(isi['pricing.html']), acuanKaki = kaki(isi['pricing.html']);
cek('acuan kepala & kaki ditemukan (pricing.html)', acuanKepala.length > 500 && acuanKaki.length > 500);
for (const h of HALAMAN) {
  const s = isi[h];
  cek(`${h}: <body class="pb"> + publik.css + publik.js`, /<body class="pb[ "]/.test(s) && /assets\/css\/publik\.css/.test(s) && /assets\/js\/publik\.js/.test(s));
  cek(`${h}: kepala halaman identik`, kepala(s) === acuanKepala);
  cek(`${h}: kaki halaman identik`, kaki(s) === acuanKaki);
  cek(`${h}: satu <main id="utama"> dan tautan lewati-ke-konten`, (s.match(/<main id="utama"/g) || []).length === 1 && /class="qi-skip-link" href="#utama"/.test(s));
  cek(`${h}: tanpa emoji (ikon garis SVG)`, !emoji.test(s), (s.match(emoji) || [])[0]);
  cek(`${h}: tanpa atribut style="..." (siap CSP style-src ketat)`, !/\sstyle="/.test(s));
  cek(`${h}: tetap memuat qim-sentuh.css (input 16 px di layar sentuh)`, /assets\/css\/qim-sentuh\.css/.test(s));
}
const nav = (acuanKepala.match(/<nav class="pb-nav"[\s\S]*?<\/nav>/) || [''])[0];
const jumlahNav = (nav.match(/<a /g) || []).length;
cek(`menu utama ≤ 5 tautan (sekarang ${jumlahNav}) + tombol Masuk`, jumlahNav > 0 && jumlahNav <= 5 && /href="login.html">Masuk<\/a>/.test(acuanKepala));
cek('kaki halaman menautkan pengungkapan risiko, metodologi, status, bantuan, legal', ['risiko.html', 'metodologi.html', 'status.html', 'bantuan.html', 'terms.html', 'privacy.html', 'transparansi.html'].every(h => acuanKaki.includes(`href="${h}"`)));
const prof = read('profile.html');
cek('profile.html: kerangka sama, tombol kanan "Terminal" menggantikan "Masuk"', kaki(prof) === acuanKaki
  && kepala(prof) === acuanKepala.replace('href="login.html">Masuk</a>', 'href="dashboard.html">Terminal</a>'));
const css = read('assets/css/publik.css');
cek('merek tidak pernah terbungkus (white-space: nowrap) dan tidak glow', /\.pb-merek \{[^}]*white-space: nowrap/.test(css) && !/text-shadow|drop-shadow/.test(css));
cek('publik.css tidak menyentuh dashboard (semua aturan berawalan .pb / kelas khusus)', !/^(body|html|\.glass-card|\.nav-item)\s*\{/m.test(css));

console.log('Halaman harga jujur');
const harga = isi['pricing.html'] + read('assets/js/halaman-pricing.js');
cek('tanpa hitung mundur "early bird" (diulang tiap tengah malam = urgensi palsu)', !/early ?bird|getEndOfDay|ebDays|earlyBirdTimer/i.test(harga));
cek('tanpa harga coret / "normal" karangan', !/line-through|<s>|<del>|Rp75\.000|Rp225\.000|Rp330\.000|Rp660\.000/.test(isi['pricing.html']));
cek('tanpa klaim kelangkaan / popularitas tanpa data', !/paling laris|best ?seller|terbatas|slot cek banyak|hingga 12 slot|VIP Lounge/i.test(isi['pricing.html']));
cek('tanpa garansi uang kembali di halaman publik (changelog boleh mencatat penghapusannya)', HALAMAN.filter(h => h !== 'changelog.html').every(h => !/garansi|money.?back|uang kembali/i.test(isi[h])));
cek('harga paket sama dengan yang dikirim ke api/payment.php', ['1 Bulan" data-harga="55000', '3 Bulan" data-harga="150000', '6 Bulan" data-harga="270000', '12 Bulan" data-harga="500000'].every(x => isi['pricing.html'].includes('data-plan="' + x)));
cek('non-refundable dan tanpa perpanjangan otomatis dinyatakan', /Tidak ada pengembalian dana/.test(isi['pricing.html']) && /Tanpa perpanjangan otomatis/.test(isi['pricing.html']) && /terms\.html#pembayaran/.test(isi['pricing.html']) && /id="pembayaran"/.test(isi['terms.html']));
// Kunci akses panel (QI_PANEL_MIN) ikut dashboard panel lama. Kini yang dikunci per paket adalah paper trading di Quick Trade
// (qim-quick-trade.js, memakai window.QI_PERAN dari qim-terminal-gate.js); halaman harga harus menyatakan hal yang sama.
cek('perbandingan fitur: paper trading PRO di halaman harga = terkunci untuk akun gratis di Quick Trade', (() => {
  const qt = read('assets/js/qim-quick-trade.js');
  return /Paper trading dan Ikuti Auto Analisa<\/th><td class="is-tengah is-tidak">/.test(isi['pricing.html'])
    && /const terkunci = !real && qiTingkatSaatIni\(\) < 1/.test(qt) && /Paper trading tersedia untuk paket PRO/.test(qt)
    && /window\.QI_PERAN = /.test(read('assets/js/qim-terminal-gate.js'));
})());

console.log('Tanpa angka karangan');
cek('login: tanpa status server & harga contoh yang ditulis tetap', !/Server Status|21ms|\$82,761|\$2,641|256-BIT|29 panel/i.test(isi['login.html']) && !/particleCanvas/.test(isi['login.html'] + read('assets/js/halaman-login.js')));
const st = isi['status.html'] + read('assets/js/halaman-status.js');
cek('status: membaca api/health.php (basis data, disk, cache, detak cron) tanpa angka uptime', /api\/health\.php/.test(st) && /checks\.db|c\.db/.test(st) && /cron/.test(st) && /cache_writable/.test(st) && !/uptime\s*[:=]?\s*\d|\d+(?:[.,]\d+)?\s*%\s*uptime|99[.,]9/i.test(st));
cek('status: tidak menampilkan versi PHP', !/php_version/.test(read('assets/js/halaman-status.js')));

console.log('Halaman baru');
for (const h of BARU) {
  const s = isi[h];
  cek(`${h}: masuk sitemap.xml`, read('sitemap.xml').includes(`https://quantum-institut.com/${h}`));
  cek(`${h}: pratinjau tautan (og:title, og:image, twitter:card, canonical)`, /property="og:title"/.test(s) && /property="og:image"/.test(s) && /name="twitter:card"/.test(s) && /rel="canonical"/.test(s));
}
const met = isi['metodologi.html'];
cek('metodologi: spread, slippage, gap, M1, R, Wilson, expectancy, win rate menyesatkan', ['spread', 'slippage', 'Gap', 'M1', 'Satuan R', 'Wilson', 'Expectancy', 'win rate saja menyesatkan'].every(k => met.includes(k)));
cek('metodologi: angka spread & slippage sama dengan api/_biaya_spread.php', (() => {
  const b = read('api/_biaya_spread.php');
  return /'XAUUSD' => 0\.30/.test(b) && met.includes('XAUUSD 0,30') && /'EURUSD' => 0\.00012/.test(b) && met.includes('EURUSD 0,00012')
    && /: 0\.25;/.test(b) && met.includes('0,25 × spread') && /\$persen = defined\('QI_SPREAD_KRIPTO_PERSEN'\) \? \(float\)QI_SPREAD_KRIPTO_PERSEN : 0\.10/.test(b) && met.includes('kripto 0,1%');
})());
cek('metodologi: tempat Mesin Konfluensi disiapkan (penanda kosong, belum dijelaskan)', /<!-- konfluensi:mulai -->\s*<!-- konfluensi:akhir -->/.test(met) && !/Mesin Konfluensi<\/h2>/.test(met));
cek('risiko: bukan nasihat, tanpa jaminan, bukan broker, masa lalu, leverage', ['bukan-nasihat', 'tanpa-jaminan', 'bukan-broker', 'masa-lalu', 'leverage'].every(id => isi['risiko.html'].includes(`id="${id}"`)));
const log = isi['changelog.html'];
const tanggal = [...log.matchAll(/<time id="r\d{8}" datetime="(\d{4}-\d{2}-\d{2})">/g)].map(m => m[1]);
cek('changelog: entri bertanggal, terbaru di atas', tanggal.length >= 3 && tanggal.every((t, i) => i === 0 || t < tanggal[i - 1]), tanggal);
cek('bantuan: topik akun, lisensi, paket, notifikasi, membaca sinyal, kontak Telegram', ['id="akun"', 'id="lisensi"', 'id="paket"', 'id="notifikasi"', 'id="membaca-sinyal"', 'id="kontak"', 'id="lupa-sandi"', 't.me/quantuminstitutterminal'].every(k => isi['bantuan.html'].includes(k)));
cek('tautan ke bantuan dari halaman masuk menuju jawaban yang ada', ['lisensi', 'lupa-sandi'].every(id => isi['login.html'].includes(`bantuan.html#${id}`) && isi['bantuan.html'].includes(`id="${id}"`)));

console.log(gagal ? `\nFAIL — ${gagal} kontrak halaman publik gagal` : '\nPASS — halaman publik: kerangka sama, harga jujur, halaman baru lengkap');
process.exit(gagal ? 1 : 0);
