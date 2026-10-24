// Fitur 2026-10-18: backtest Setup Analisa, indeks OANDA, penanda berita, multi-chart, penjelasan AI,
// latihan replay. Aturan konservatif backtest diuji dengan candle buatan; sisanya kontrak statis.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info))); if (!kondisi) gagal++; }

const QS = require('../assets/js/qim-setups.js');
const BT = require('../assets/js/qim-backtest-setup.js');
const { proses } = BT._internal;

console.log('Backtest — aturan konservatif (satu order, candle buatan)');
const batas = { ttl: 3, tahan: 6 };
const statBaru = () => ({ setup: 0, disaring: 0, terisi: 0, tidakTerisi: 0, batal: 0, menang: 0, kalah: 0, expired: 0, totalR: 0, untungR: 0, rugiR: 0, puncak: 0, ddMaks: 0, ekuitas: [], rrJumlah: 0, barTahan: 0, trade: [] });
const ord = () => ({ metode: 'SMC', arah: 'BUY', entry: 100, sl: 98, tp: 106, rr: 3, i0: 0, t0: 0, status: 'MENUNGGU' });
const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });
function jalan(candles) { const o = ord(), st = statBaru(); let i = 1; for (const b of candles) { if (proses(o, b, i, st, batas)) break; i++; } return st; }

let st = jalan([bar(1, 101, 101, 97.5, 98.5)]);
cek('entry terisi & SL tersentuh di candle yang sama → kalah (−1R)', st.kalah === 1 && st.trade[0].R === -1, st.trade[0]);
st = jalan([bar(1, 101, 106.5, 99.5, 105)]);
cek('entry & TP di candle pengisian → TP TIDAK dihitung di candle itu', st.menang === 0 && st.terisi === 1, st);
st = jalan([bar(1, 101, 101, 99.8, 100.5), bar(2, 100.5, 106.2, 97.9, 104)]);
cek('candle menyentuh SL dan TP sekaligus → SL lebih dulu', st.kalah === 1 && st.menang === 0, st.trade);
st = jalan([bar(1, 101, 101, 99.8, 100.5), bar(2, 96, 97, 95, 96.5)]);
cek('gap melewati SL → keluar di harga open (lebih buruk dari −1R)', st.kalah === 1 && st.trade[0].R === -2, st.trade[0]);
st = jalan([bar(1, 101, 101, 99.8, 100.5), bar(2, 100.5, 106.1, 100.2, 105.5)]);
cek('TP tercapai di candle berikutnya → menang +3R', st.menang === 1 && st.trade[0].R === 3, st.trade[0]);
st = jalan([bar(1, 103, 106.2, 102, 105)]);
cek('harga menembus TP sebelum entry terisi → order batal', st.batal === 1 && st.terisi === 0, st);
st = jalan([bar(1, 103, 104, 102, 103), bar(2, 103, 104, 102, 103), bar(3, 103, 104, 102, 103), bar(4, 103, 104, 102, 103)]);
cek('limit tidak terisi lewat batas waktu → TIDAK TERISI', st.tidakTerisi === 1, st);
st = jalan([bar(1, 101, 101, 99.9, 100.5)].concat([2, 3, 4, 5, 6, 7, 8].map(t => bar(t, 101, 102, 99, 101))));
cek('posisi melewati masa tahan → EXPIRED di harga close', st.expired === 1 && st.trade[0].hasil === 'EXPIRED' && st.trade[0].R === 0.5, st.trade[0]);

console.log('Backtest — jalannya penuh');
const kurang = BT.jalankan(QS, Array.from({ length: 100 }, (_, i) => bar(i * 3600, 1, 1.1, 0.9, 1)));
cek('data terlalu sedikit → ditolak dengan pesan jujur', kurang.ok === false && /terlalu sedikit/.test(kurang.pesan));
// Seri deterministik bergelombang (tanpa Math.random) supaya detektor menemukan struktur.
const gelombang = Array.from({ length: 900 }, (_, i) => {
    const dasar = 100 + 8 * Math.sin(i / 17) + 3 * Math.sin(i / 5.3) + i * 0.01;
    const o = dasar + Math.sin(i * 1.7) * 0.6, c = dasar + Math.cos(i * 1.3) * 0.6;
    return bar(1700000000 + i * 3600, o, Math.max(o, c) + 0.5 + Math.abs(Math.sin(i)) * 0.4, Math.min(o, c) - 0.5 - Math.abs(Math.cos(i)) * 0.4, c);
});
const hasil = BT.jalankan(QS, gelombang, {});
cek('backtest berjalan dan mengembalikan 4 metode + gabungan', hasil.ok && hasil.metode.length === 4 && hasil.gabungan.metode === 'SEMUA', hasil.ok ? hasil.metode.map(m => m.metode) : hasil);
const jumlahTrade = hasil.metode.reduce((s, m) => s + m.trade, 0);
cek('gabungan = jumlah trade semua metode', hasil.gabungan.trade === jumlahTrade, [hasil.gabungan.trade, jumlahTrade]);
cek('setiap metode: menang + kalah + expired = trade', hasil.metode.every(m => m.menang + m.kalah + m.expired === m.trade));
cek('"terbaik" hanya metode dengan ≥10 trade dan rata-rata R > 0', hasil.terbaik === null || (hasil.terbaik.trade >= 10 && hasil.terbaik.rataR > 0), hasil.terbaik);
const sesudah = BT.jalankan(QS, gelombang.slice(0, 600), {});
const awal = BT.jalankan(QS, gelombang.slice(0, 600).concat(gelombang.slice(600).map(c => ({ ...c, high: c.high * 2, low: c.low / 2 }))), {});
cek('tanpa melihat masa depan: data sesudah bar ke-600 tidak mengubah setup yang dipasang sebelumnya',
    sesudah.metode.every((m, i) => awal.metode[i].dipasang >= m.dipasang));

console.log('Indeks OANDA');
const mw = read('api/_middleware.php');
cek('peta bridge memuat US30, NAS100, SPX500, GER40 (=DE30EUR), UK100, JP225, XAGUSD, USOIL (=WTICOUSD)',
    ["'US30' => 'US30USD'", "'NAS100' => 'NAS100USD'", "'SPX500' => 'SPX500USD'", "'GER40' => 'DE30EUR'", "'UK100' => 'UK100GBP'", "'JP225' => 'JP225USD'", "'XAGUSD' => 'XAGUSD'", "'USOIL' => 'WTICOUSD'"].every(x => mw.includes(x)));
cek('harga indeks diminta TERPISAH dari forex (stream bridge tetap cepat)', /\$kelompok\[qi_simbol_indeks\(\$s\) \? 1 : 0\]/.test(mw));
cek('chart indeks tanpa data → pesan jujur, bukan candle simulasi', /qi_simbol_indeks\(\$symbol\)\) \{[\s\S]{0,400}tidak_tersedia/.test(read('api/get-chart-data.php')));
const tv = read('tv-bridge/server.js');
cek('tv-bridge: hingga 5.000 bar & indeks ikut di-stream', /Math\.min\(Math\.max\(parseInt\(limit, 10\) \|\| 300, 10\), 5000\)/.test(tv) && /'US30USD', 'NAS100USD'/.test(tv));
cek('riwayat dalam OANDA untuk backtest (get-history.php)', /qi_tv_bridge_candles\(\$symbol, \$interval, \$minta, 45\)/.test(read('api/get-history.php')));
const gh = read('api/get-history.php');
cek('cache riwayat yang bar-nya kurang dari diminta hanya 10 menit (bridge lama membatasi 1.000; jangan tertahan 6 jam)', /\$umurMaks = \$n >= \$minta \? \$ttl : 600;/.test(gh));
cek('label cached benar (bukan "$cd + [...]" yang tidak menimpa kunci lama)', /\$cd\['cached'\] = true;/.test(gh) && !/\$cd \+ \['cached' => true\]/.test(gh));
const qd = read('assets/js/qim-dashboard.js');
cek('watchlist: tab Indeks berisi 7 instrumen + perak di Metals', (qd.match(/group: 'indeks'/g) || []).length === 7 && /symbol: 'XAGUSD'/.test(qd) && !/symbol: 'AAPL'/.test(qd));
cek('chart memuat harga live untuk simbol yang sedang dibuka', /if \(kini && !SYMBOLS\.includes\(kini\)\) daftar = SYMBOLS\.concat\(kini\);/.test(read('assets/js/dashboard-app.js')));
cek('chart dikosongkan bila simbol baru tidak punya data (bukan candle simbol lama)', /_lwSeries\.setData\(\[\]\); _lwLastCandles = \[\];/.test(read('assets/js/dashboard-app.js')));

console.log('Penanda berita, multi-chart, AI, latihan');
const br = read('assets/js/qim-berita-chart.js');
cek('penanda berita: hanya HIGH impact & mata uang simbol, bisa disembunyikan', /=== 'high'/.test(br) && /function mataUangSimbol/.test(br) && /qim_berita_chart/.test(br));
cek('chip berita memperingatkan ≤30 menit sebelum / ≤15 menit sesudah rilis', /30 \* MENIT/.test(br) && /15 \* MENIT/.test(br));
const mc = read('assets/js/qim-multichart.js');
cek('multi-chart: hanya ≥1024 px, 1/2/4 chart, sel mengikuti simbol chart utama', /min-width: 1024px/.test(mc) && /\[1, 2, 4\]/.test(mc) && /qim:chart-symbol/.test(mc));
const ai = read('api/ai-jelaskan.php');
cek('AI: wajib PRO, dibatasi laju, angka lot dihitung server, ada penjelasan tanpa AI', /qi_require_level\('pro'\)/.test(ai) && /qi_rate_limit\(/.test(ai) && /qi_paper_pip_mult\(\$symbol, \$entry\)/.test(ai) && /'sumber' => 'otomatis'/.test(ai));
cek('AI: setup tidak konsisten (TP/SL salah sisi) ditolak', /\(\$arah === 'BUY' && !\(\$tp > \$entry && \$entry > \$sl\)\)/.test(ai));
const md = read('assets/js/qim-ai-jelaskan.js');
cek('AI: teks di-escape sebelum Markdown dirender (aman dari HTML sisipan)', /const baris = esc\(teks\)/.test(md));
const pg = read('assets/js/qim-pages.js');
cek('latihan replay: BUY/SELL, SL lebih dulu, mundur dikunci, nilai A–D', /data-rp="beli"/.test(pg) && /gapSL \|\| \(buy \? b\.low <= P\.sl/.test(pg) && /bar\.querySelector\('\[data-rp="mundur"\]'\)\.disabled/.test(pg) && /'A — sangat baik'/.test(pg));
const html = read('dashboard.html');
cek('dashboard chart-first memuat terminal, Signal Center, dan backtest',
    /quantum-terminal\/embed\//.test(html) && /qtAssistDrawer/.test(html) && /qtPanel-backtest/.test(html));

console.log(gagal ? `\nFAIL — ${gagal} pemeriksaan gagal` : '\nPASS — fitur baru: backtest, indeks, berita, multi-chart, AI, latihan');
process.exit(gagal ? 1 : 0);
