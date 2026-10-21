/**
 * REGRESI AUDIT PANEL (2026-10-21).
 *
 * Audit memeriksa 33 panel dashboard dan menemukan 74 galat. Berkas ini mengunci
 * perbaikannya supaya tidak pelan-pelan kembali: tiap pemeriksaan menyebut galat yang
 * dicegahnya, bukan sekadar "ada teks X".
 *
 * Run:  node tests/audit-panel.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!lulus) gagal++;
};

const app   = baca('assets/js/dashboard-app.js');
const adv   = baca('assets/js/advanced-trading.js');
const ptt   = baca('assets/js/pro-trading-tools.js');
const prof  = baca('assets/js/pro-features.js');
const tema  = baca('assets/js/dashboard-tema.js');
const dpro  = baca('assets/js/dashboard-pro.js');
const perf  = baca('assets/js/perf-upgrades.js');
const ui    = baca('assets/js/ui-improvements.js');
const alr   = baca('assets/js/qim-alerts.js');
const html  = baca('dashboard.html');

/** Buang baris komentar supaya pemeriksaan "sudah tidak ada" tidak tertipu catatan sejarah. */
const tanpaKomentar = (teks) => teks.split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n');

console.log('\nKunci sesi (galat 12/13/14/52/53)');
{
  // 'qi_session' dibaca 7 tempat dan TIDAK PERNAH ditulis siapa pun: panel AI Auto-Trade
  // mati total, api/leaderboard.php selalu 401, tautan snapshot chart selalu ditolak.
  const berkas = { 'dashboard-app.js': app, 'advanced-trading.js': adv, 'dashboard-tema.js': tema, 'pro-trading-tools.js': ptt };
  for (const [nama, isi] of Object.entries(berkas)) {
    const baris = isi.split('\n').filter((l) => l.includes("'qi_session'") && !l.trim().startsWith('//'));
    cek(`${nama} tidak membaca kunci 'qi_session'`, baris.length === 0, baris);
  }
  cek('token diambil lewat QuantumAuth.getToken()',
    /QuantumAuth && QuantumAuth\.getToken\(\)/.test(tema)
    && /QuantumAuth && QuantumAuth\.getToken\(\)/.test(adv)
    && /QuantumAuth && QuantumAuth\.getToken\(\)/.test(app));
  cek('auth.js memang menyimpan token di qi_token', /qi_token/.test(baca('assets/js/auth.js')));
}

console.log('\nPanel & kode mati dihapus (galat 9/19/21/23/37/44/59/60)');
{
  for (const nama of ['QuantumPaperTrading', 'QuantumOrderBook', 'QuantumPositionCalculator',
                      'QuantumRRTool', 'QuantumTrackRecord', 'QuantumAIRadar', 'QuantumCorrelation']) {
    const baris = ptt.split('\n').filter((l) => l.includes(nama) && !l.trim().startsWith('//'));
    cek(`${nama} sudah tidak ada di pro-trading-tools.js`, baris.length === 0, baris.slice(0, 2));
  }
  cek('QuantumConfluenceEngine TETAP ada (dipakai QuantumAIEngine._analyzeCandles)',
    /_analyzeCandles\(candles\)/.test(ptt) && /QuantumAIEngine/.test(ptt));
  cek('render() Confluence Matrix (target #panelConfluenceMatrix) dihapus', !tanpaKomentar(ptt).includes('panelConfluenceMatrix'));
  cek('"Eksekusi Setup AI" masuk ke mesin paper trading yang nyata',
    /eksekusiSetupKeSimulasi\(arah\)/.test(ptt) && /window\.ptOpenDirectPosition\(/.test(ptt));
  cek('SL/TP eksekusi setup tetap dari ATR nyata, tidak dikarang',
    /_qiAtrTerakhir/.test(ptt) && /1\.2 \* atr/.test(ptt));
  for (const [nama, isi, pola] of [
    ['panel-sessions (Market Galaxy)', app + html, /panel-sessions|GALAXY_EDGES|initNetworkGalaxy/],
    ['panel bawah Charts (renderChartTab)', app, /renderChartTab|chartTabContent/],
    ['pemuat malas IntersectionObserver', perf, /heavyPanels/],
    ['window._qiEmptyState', ui, /_qiEmptyState/],
  ]) cek(`${nama} sudah tidak ada`, !pola.test(isi.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')));
}

console.log('\nData simulasi tidak dipakai menghitung arah (galat 1/43/50)');
{
  cek('MTF bias menolak candle `simulated: true`', /res\.value\.simulated === true;/.test(app));
  cek('MTF bias mengatakan "data simulasi" apa adanya', /data simulasi — tidak dipakai/.test(app));
  cek('korelasi membuang instrumen simulasi sebelum menghitung', /simulated === true\) return \[\]/.test(app));
  cek('korelasi TIDAK menggambar 0,00 saat semua sumber gagal',
    /terbaca\.length < 2/.test(app) && /Matriks sengaja dikosongkan/.test(app));
  cek('sel korelasi tanpa data bernilai null, bukan 0', /length === 0\) return null/.test(app));
}

console.log('\nAngka yang tidak bisa dipertanggungjawabkan (galat 25/27/29/34/35/45/55/57/61)');
{
  cek('klaim "21.042 releases measured" sudah hilang dari HTML', !/21,042 releases/.test(html));
  cek('jumlah rilis dihitung server', /array_sum\(array_column\(\$filtered, 'rel'\)\)/.test(baca('api/news-impact.php')));
  cek('jendela News Impact dibatasi ke yang datanya ada (30m & 1h)',
    /in_array\(\(\$_GET\['window'\] \?\? '1h'\), \['30m', '1h'\], true\)/.test(baca('api/news-impact.php')));
  cek('tombol 2h/4h News Impact dibuang', !/data-qi-arg='\["2h"\]'/.test(html) && !/data-qi-arg='\["4h"\]'/.test(html));
  cek('order book "perkiraan" diberi lencana', /ob-\$\{sym\}-tanda/.test(app) && /data\.nyata === false/.test(app));
  // Judul yang DILIHAT pengguna (di dalam <span>), bukan komentar yang mencatat nama lamanya.
  cek('kartu futures tidak lagi mengaku data likuidasi',
    !/>[^<]*Liquidation Terbesar 24h[^<]*</.test(html) && />[^<]*Pergerakan Futures 24h[^<]*</.test(html));
  cek('kolom "Liq Dominan" dinamai apa adanya', !/>Liq Dominan</.test(html) && /Tekanan \(perkiraan\)/.test(html));
  cek('"Avg Market Volatility 2.4%" tulis tangan sudah hilang', !/>2\.4%</.test(html));
  cek('rata-rata volatilitas dihitung dari ATR yang terbaca', /function qiSetVolRata\(/.test(prof) && /qiSetVolRata\(kumpulPct\)/.test(prof));
  cek('judul grafik COT jujur (non-commercial, ≤8 minggu)',
    !/Commercial Position — 12 Week/.test(html) && /Non-Commercial/.test(html));
  cek('kolom "Volatilitas" Market Screener dinamai Volume', !/>Volatilitas</.test(html));
  cek('Academy menyebut ambang mesin yang sebenarnya (MIN_SEPAKAT = 3)',
    !/minimal 6 dari 9 mesin/.test(html) && /MIN_SEPAKAT = 3/.test(html));
}

console.log('\nMatematika radar (galat 55)');
{
  cek('RSI dihitung dari close-ke-close (Wilder), bukan badan lilin', /function rsiWilder|const rsiWilder/.test(app));
  cek('EMA memakai seed SMA, bukan harga pertama', /const emaAkhir = \(nilai, periode\)/.test(app));
  cek('instrumen dengan candle kurang dinyatakan belum cukup', /Candle belum cukup \(butuh 22/.test(app));
  // Buktikan angkanya, bukan sekadar ada teksnya.
  const ctx = { console };
  vm.createContext(ctx);
  const potong = app.slice(app.indexOf('const rsiWilder ='), app.indexOf('const rsiNilai ='));
  vm.runInContext(potong + '\nglobalThis.R = rsiWilder;', ctx);
  const naik = Array.from({ length: 40 }, (_, i) => 100 + i);
  const turun = Array.from({ length: 40 }, (_, i) => 140 - i);
  const datar = new Array(40).fill(50);
  cek('RSI naik terus = 100', Math.round(ctx.R(naik, 14)) === 100, ctx.R(naik, 14));
  cek('RSI turun terus = 0', Math.round(ctx.R(turun, 14)) === 0, ctx.R(turun, 14));
  cek('RSI harga datar = 50 (bukan NaN)', ctx.R(datar, 14) === 50, ctx.R(datar, 14));
  const potongE = app.slice(app.indexOf('const emaAkhir ='), app.indexOf('const ema9  ='));
  vm.runInContext(potongE + '\nglobalThis.E = emaAkhir;', ctx);
  cek('EMA21 harga datar tepat 50', ctx.E(datar, 21) === 50, ctx.E(datar, 21));
  cek('EMA menolak data lebih pendek dari periodenya', ctx.E([1, 2, 3], 21) === null);
}

console.log('\nKeamanan & akses (galat 16/33/67/71)');
{
  const n = app.indexOf('function renderNewsItems');
  const blok = app.slice(n, app.indexOf('function filterNewsItems') > n ? app.indexOf('\n}\n', n) + 3 : n + 3000);
  cek('judul/sumber/kategori berita di-escape sebelum masuk HTML',
    /\$\{esc\(n\.title\)\}/.test(blok) && /\$\{esc\(n\.source\)\}/.test(blok) && /\$\{esc\(n\.category\)\}/.test(blok));
  cek('URL berita dibatasi skema http/https', /const urlAman = /.test(blok) && /\^https\?:/.test(blok));
  cek('kartu khusus admin ditandai data-qi-admin', (html.match(/data-qi-admin="1"/g) || []).length >= 3);
  cek('ketiganya ikut class hidden di markup',
    /id="metodeKartu" data-qi-admin="1" class="hidden/.test(html)
    && /id="gwKartuJeda" data-qi-admin="1" class="hidden/.test(html)
    && /id="gwKartuGerbang" data-qi-admin="1" class="hidden/.test(html));
  cek('ada satu fungsi yang menampilkannya hanya untuk admin', /function qiTampilkanKartuAdmin\(admin\)/.test(app));
  cek('gagal membaca sesi = dianggap BUKAN admin', /qiTampilkanKartuAdmin\(false\)/.test(app));
  // #67: induk hidden membuat remove('hidden') pada anaknya percuma.
  const bs = html.indexOf('id="bridgeSetup"');
  const tg = html.indexOf('id="tgKartu"');
  const liv = html.indexOf('id="liveExecutionState"');
  const tutupBs = html.indexOf('</section>', html.lastIndexOf('</section>', tg) );
  cek('kartu Telegram berada SESUDAH #bridgeSetup, bukan di dalamnya', tg > bs && html.slice(bs, tg).includes('</section>'));
  cek('blok eksekusi MT5 real juga di luar #bridgeSetup', liv > tg, { bs, tg, liv, tutupBs });
}

console.log('\nPanel tidak lagi beku / berkedip (galat 6/7/26/42/46/54/56/66/68/73)');
{
  cek('Signal Matrix hanya menampilkan "Memuat" bila tabel kosong', /const kosong = body\.querySelector\('td\[colspan\]'\)/.test(app));
  cek('Auto Signal idem', /grid\.querySelector\('\.col-span-full'\)/.test(app));
  cek('widget TradingView tidak dibangun ulang bila simbol & tema sama', /wrap\.dataset\.qiSidik === sidik/.test(app));
  cek('panel-sentiment punya pengisi sendiri', /function initPanelSentimen\(\)/.test(app) && /'panel-sentiment'\)   initPanelSentimen\(\)/.test(app));
  cek('Spread Monitor & DXY ikut penyegar panel Volatility',
    /'panel-volatility':  \[\(\) => renderVolatilityDash\(\), \(\) => renderSpreadMonitor\(\), \(\) => renderDxyTracker\(\)\]/.test(app));
  cek('renderDxyTracker akhirnya dipanggil', /renderDxyTracker\(\); renderVolatilityDash\(\)/.test(prof));
  cek('tabel Radar ikut disegarkan, tapi dibatasi 2 menit',
    /runRadarScanBerkala\(\)/.test(app) && /Date\.now\(\) - _radarScanTerakhir < 120000/.test(app));
  cek('timer tunggu harga Radar tidak beranak-pinak', /_radarTungguTimer/.test(app) && /clearTimeout\(_radarTungguTimer\)/.test(app));
  cek('panel-performance & panel-gateway masuk daftar penyegar',
    /'panel-performance': \[/.test(app) && /'panel-gateway':     \[/.test(app));
  cek('kartu webhook dimuat lewat qim:panel-change, bukan klik sidebar',
    /qim:panel-change/.test(dpro) && !/data-panel="panel-radar"\)\)/.test(dpro));
}

console.log('\nFungsi yang rusak (galat 2/3/4/5/15/17/18/20/41/47/48/51/62/69/70/74)');
{
  cek('watchlist membaca _lastPrices (seluruh simbol), bukan _livePrices saja', /function wlKutipan\(sym\)/.test(adv) && /qiBacaGlobal\('_lastPrices'\)/.test(adv));
  cek('kolom Change watchlist benar-benar diisi', /cEl\.textContent = \(q\.chgPct === null\)/.test(adv));
  cek('window.loadWatchlist diekspor (tombol bintang favorit)', /window\.loadWatchlist = loadWatchlist;/.test(adv));
  cek('pintasan Charts membawa parameter panel', /dashboard\.html\?panel=panel-charts/.test(html));
  {
    // <thead> tabel Riwayat Sinyal punya 12 <th>, jadi baris status yang ditulis JS harus
    // merentang penuh. Hanya blok fetchTrackRecord yang diperiksa — tabel News Impact di
    // berkas yang sama memang 11 kolom dan colspan-nya benar.
    const tr = app.slice(app.indexOf('async function fetchTrackRecord'));
    const salah = tr.match(/colspan="1[01]"/g) || [];
    cek('colspan tabel Riwayat Sinyal = 12 (thead memang 12 kolom)', salah.length === 0, salah);
  }
  cek('filter Engine punya opsi NEWS & MANUAL', /value="NEWS"/.test(html) && /value="MANUAL"/.test(html));
  cek('keadaan kosong Jurnal tidak lagi menjanjikan pengisian otomatis',
    !/terisi otomatis dari posisi yang Anda tutup/.test(html));
  cek('Performance Analytics memakai riwayat paper yang nyata',
    /function qiPaperRiwayat\(\)/.test(adv) && /qiBacaGlobal\('_ptHistory'\)/.test(adv));
  cek('tanggal transaksi paper dari waktu tutup sesungguhnya', /function qiTanggalTutup\(h\)/.test(adv) && /h\.closedAt \|\| h\.closeTime/.test(adv));
  cek('saldo awal tidak lagi ditulis mati $10.000', /function qiSaldoAwalPaper\(\)/.test(adv) && !/var cum = 10000;/.test(adv));
  cek('QIExport.paperTrades aman untuk data lama',
    /Array\.isArray\(v\) \? v : \[\]/.test(adv) && !tanpaKomentar(adv).includes('saved.positions.length'));
  cek('tombol minggu kalender mengambil data baru', /CAL_MINGGU\[String\(_calWeekOff\)\]/.test(app) && /api\/calendar\.php\?week=/.test(app));
  cek('server kalender mendukung last/this/next', /'last' => 'ff_calendar_lastweek\.json'/.test(baca('api/calendar.php')));
  cek('hanya minggu berjalan yang menulis cache/calendar.json (dipakai pipeline sinyal)',
    /\$week === 'this' \? '\/calendar\.json'/.test(baca('api/calendar.php')));
  cek('penyegar kalender merender ulang, bukan hanya mengisi variabel',
    /async function segarkanKalender\(\)/.test(app) && /'panel-heatmap':     \[\(\) => segarkanKalender\(\)\]/.test(app));
  cek("event 'holiday' tidak lagi dilabeli Low", /impLvl === 'holiday' \?/.test(app));
  cek('grid MTF memuat 5 kartu', /id="mtfGrid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5/.test(html));
  cek('alert dari server ikut tercatat di riwayat', /window\.catatAlertKena/.test(alr) && /function catatAlertKena\(entri\)/.test(adv));
  cek('riwayat alert tidak menulis entri kembar',
    /var kembar = _alertHistory\.some/.test(adv) && /if \(kembar\) return;/.test(adv));
  {
    // Dulu `+ fx.map(…)` berdiri sendiri SESUDAH blok if/else: JavaScript menyisipkan titik
    // koma otomatis setelah `}`, lalu menilai ekspresi unary-plus itu dan membuang hasilnya —
    // 6 baris FX/XAU hilang diam-diam, tanpa galat merah di konsol.
    const blok = prof.slice(prof.indexOf('function renderSpreadMonitor'), prof.indexOf('function renderSwapRates'));
    const gantung  = /\}\s*\n\s*\+ fx\.map/.test(blok);
    const nyambung = /join\(''\)\s*\n\s*\+ fx\.map\(/.test(blok);
    cek('baris FX/XAU Spread Monitor benar-benar disambung ke innerHTML', nyambung && !gantung, { gantung, nyambung });
  }
}

console.log('\nJam sesi (galat 38)');
{
  cek('zona waktu dihitung dengan Intl.formatToParts, bukan parse teks tanggal',
    /function qiBagianWaktu\(tz\)/.test(prof) && !/new Date\(new Date\(\)\.toLocaleString\('en-US', \{ timeZone/.test(prof));
  cek('tidak berdetak tiap detik saat panelnya tersembunyi', /!kartu\.offsetParent/.test(prof));
  cek('salinan jam sesi yang mati (initGlobe/initSessions) sudah dihapus', !/function initSessions\(\)/.test(app));
}

console.log('\nDokumentasi yang bertentangan dengan kodenya (galat 65)');
{
  const lb = baca('api/leaderboard.php');
  cek('komentar leaderboard tidak lagi mengaku publik', !/public, tidak butuh auth/.test(lb));
  cek('komentar menyebut syarat PRO yang sebenarnya', /BUTUH PAKET PRO/.test(lb) && /qi_require_level\('pro'\)/.test(lb));
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
