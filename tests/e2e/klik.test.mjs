// Uji e2e menyeluruh di XAMPP lokal — versi tetap dari audit situs 2026-10-18.
//  1. Sapu semua API baca (GET) sebagai admin, pengguna gratis, dan tamu: tidak boleh 5xx (kecuali
//     health yang memang boleh "degraded"), JSON harus sah, tanpa PHP Warning/Notice/Fatal.
//  2. Buka semua halaman publik & halaman login (desktop) — tanpa exception, console.error,
//     permintaan gagal, atau respons >= 400.
//  3. Dashboard (desktop 1440×900 DAN iPhone 390×844): buka SEMUA panel, klik SEMUA simbol watchlist,
//     SEMUA timeframe, layar penuh masuk/keluar — chart harus berisi candle, teks panel tidak boleh
//     memuat undefined/NaN/[object Object]/galat PHP.
//
// Pemakaian:  npm run test:e2e        (E2E_BASE=http://localhost/webapp, E2E_BROWSER=<msedge/chrome>)
// Dilewati (exit 0) bila server lokal / browser / PHP tidak tersedia — kecuali E2E_WAJIB=1.
// Sesi login sementara dibuat lewat tests/e2e/sesi-uji.php dan SELALU dihapus di akhir.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..', '..');
const BASE = (process.env.E2E_BASE || 'http://localhost/webapp').replace(/\/$/, '');
const WAJIB = process.env.E2E_WAJIB === '1';
const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const tidur = ms => new Promise(r => setTimeout(r, ms));
const lewati = alasan => { console.error((WAJIB ? 'FAIL' : 'SKIP') + ' — ' + alasan); process.exit(WAJIB ? 1 : 0); };

function cariBrowser() {
  const calon = [process.env.E2E_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return calon.find(p => fs.existsSync(p));
}

// ── Prasyarat ────────────────────────────────────────────────────────────────
try { const r = await fetch(BASE + '/api/health.php', { signal: AbortSignal.timeout(8000) }); await r.text(); }
catch (e) { lewati(`server lokal tidak terjangkau di ${BASE} (nyalakan XAMPP atau set E2E_BASE).`); }
const BROWSER = cariBrowser();
if (!BROWSER) lewati('Edge/Chrome tidak ditemukan (set E2E_BROWSER).');
const php = args => spawnSync(PHP, [path.join(DIR, 'sesi-uji.php'), ...args], { encoding: 'utf8' });
const tesPhp = php(['hapus']);
if (tesPhp.error || tesPhp.status !== 0) lewati('PHP / database lokal tidak tersedia: ' + ((tesPhp.stderr || '') + (tesPhp.error ? tesPhp.error.message : '')).trim());

const masalah = [];
const catat = (bagian, pesan) => { masalah.push(`[${bagian}] ${pesan}`); console.log(`  ✗ ${bagian}: ${pesan}`); };
const lulus = pesan => console.log('  ✓ ' + pesan);

// Log galat server: PHP Warning/Notice biasanya tidak tampil di respons (display_errors=off),
// jadi baris BARU di log selama uji ikut dihitung sebagai masalah.
const LOG = process.env.E2E_ERRLOG || ['D:/xamp/apache/logs/error.log', '/opt/lampp/logs/error_log', '/var/log/apache2/error.log'].find(p => fs.existsSync(p));
const ukuranLogAwal = LOG ? fs.statSync(LOG).size : 0;

let tokenAdmin = '', tokenUser = '';
try {
  tokenAdmin = php(['buat', 'admin']).stdout.trim();
  tokenUser = php(['buat', 'user']).stdout.trim();
  if (!/^[0-9a-f]{64}$/.test(tokenAdmin)) throw new Error('gagal membuat sesi admin uji');

  await sapuApi();
  await cekHalaman();
  await Promise.all([cekDashboard(1440, 900, 'desktop'), cekDashboard(390, 844, 'iphone')]);
} catch (e) {
  catat('e2e', 'berhenti: ' + (e && e.stack || e));
} finally {
  php(['hapus']);
}
if (LOG) {
  const fd = fs.openSync(LOG, 'r');
  const panjang = Math.max(0, fs.statSync(LOG).size - ukuranLogAwal);
  const buf = Buffer.alloc(Math.min(panjang, 4 * 1024 * 1024));
  fs.readSync(fd, buf, 0, buf.length, ukuranLogAwal);
  fs.closeSync(fd);
  const akar = path.basename(ROOT).toLowerCase();
  const baris = buf.toString('utf8').split(/\r?\n/)
    .filter(l => /php:(warn|error|crit|alert|emerg)|PHP (Warning|Fatal|Parse|Deprecated)/i.test(l) && l.toLowerCase().includes(akar))
    .map(l => l.replace(/^\[[^\]]*\] \[[^\]]*\] \[pid [^\]]*\] (\[client [^\]]*\] )?/, '').replace(/, referer: .*$/, ''));
  [...new Set(baris)].forEach(l => catat('log-server', l.slice(0, 220)));
  if (!baris.length) lulus('log server: tidak ada PHP Warning/Fatal baru');
}

console.log(masalah.length ? `\nFAIL — ${masalah.length} masalah e2e:\n` + masalah.map(m => '  - ' + m).join('\n')
                           : '\nPASS — e2e: semua API, halaman, panel, simbol, timeframe (desktop & iPhone)');
process.exit(masalah.length ? 1 : 0);

// ── 1. API ──────────────────────────────────────────────────────────────────
async function sapuApi() {
  console.log('API (GET) sebagai admin, pengguna gratis, tamu');
  // Endpoint yang menjalankan aksi (cron, eksekusi, webhook, pembayaran, logout) tidak disentuh.
  const LEWATI = /^(logout|ai-cron|alert-cron|maintenance-cron|signal-generator|signal-evaluator|tv-webhook|mt-bridge-ea|mt-bridge|payment|csp-report|error-log|telegram-alert|push|mt-execution|live-trade|ai-auto-trade|gateway|tick|engine-server|mt5-bridge-token)\.php$/;
  const semua = fs.readdirSync(path.join(ROOT, 'api')).filter(f => f.endsWith('.php'));
  const berkas = semua.filter(f => !f.startsWith('_') && !LEWATI.test(f));
  // Pustaka internal (_*.php) tidak boleh bisa dibuka dari web.
  for (const f of semua.filter(f => f.startsWith('_'))) {
    const r = await fetch(`${BASE}/api/${f}`).catch(() => null);
    if (!r || r.status !== 403 && r.status !== 404) catat('api', `${f} bisa dibuka dari web (HTTP ${r && r.status})`);
    if (r) await r.text();
  }
  const GALAT_PHP = /(<b>)?(Warning|Notice|Fatal error|Deprecated|Parse error)(<\/b>)?:|Uncaught /;
  let n = 0;
  for (const [nama, token] of [['admin', tokenAdmin], ['user', tokenUser], ['tamu', '']]) {
    for (const f of berkas) {
      let res, teks;
      try {
        res = await fetch(`${BASE}/api/${f}`, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(45000) });
        teks = await res.text();
      } catch (e) { catat('api', `${nama} ${f}: ${e.message}`); continue; }
      n++;
      if (res.status >= 500 && !(f === 'health.php' && res.status === 503)) catat('api', `${nama} ${f}: HTTP ${res.status} ${teks.slice(0, 120)}`);
      try { JSON.parse(teks); } catch (e) { catat('api', `${nama} ${f}: bukan JSON — ${teks.slice(0, 120).replace(/\s+/g, ' ')}`); }
      const g = teks.match(GALAT_PHP);
      if (g) catat('api', `${nama} ${f}: ${teks.slice(g.index, g.index + 140).replace(/\s+/g, ' ')}`);
    }
  }
  const h = await (await fetch(`${BASE}/api/health.php`)).json().catch(() => null);
  if (!h || !['ok', 'degraded'].includes(h.status)) catat('api', 'health.php tidak menjawab status yang dikenal');
  lulus(`${n} panggilan API diperiksa`);
}

// ── Browser (DevTools protocol, tanpa paket tambahan) ────────────────────────
async function bukaBrowser(lebar, tinggi, token) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'qim-e2e-'));
  const proc = spawn(BROWSER, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); wsUrl = (l.find(x => x.type === 'page') || {}).webSocketDebuggerUrl; } catch (e) {}
    if (!wsUrl) await tidur(250);
  }
  if (!wsUrl) { proc.kill(); throw new Error('browser tidak merespons'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const tunggu = new Map(); let peristiwa = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && tunggu.has(d.id)) { tunggu.get(d.id)(d); tunggu.delete(d.id); } else if (d.method) peristiwa.push(d); };
  const kirim = (method, params = {}) => new Promise(ok => { const i = ++id; tunggu.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  for (const m of ['Page.enable', 'Network.enable', 'Runtime.enable', 'Log.enable']) await kirim(m);
  const ponsel = lebar < 800;
  await kirim('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 1, mobile: ponsel });
  if (ponsel) {
    await kirim('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await kirim('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  }
  // Dialog pertama kali & banner cookie sudah diuji di tests/mobile.test.js; di sini disingkirkan.
  let awal = "localStorage.setItem('qi_dashboard_onboarded','1');localStorage.setItem('qi_cookie_consent','accepted');localStorage.setItem('qi_changelog_seen','9.9.9');localStorage.setItem('qi_onboarding_v2','1');";
  if (token) awal += `localStorage.setItem('qi_token','${token}');localStorage.setItem('qi_user',JSON.stringify({role:'admin',name:'Uji E2E'}));`;
  await kirim('Page.addScriptToEvaluateOnNewDocument', { source: `try{${awal}}catch(e){}` });

  const nilai = async ekspr => {
    const r = await kirim('Runtime.evaluate', { expression: ekspr, awaitPromise: true, returnByValue: true, timeout: 600000 });
    if (r.result && r.result.exceptionDetails) throw new Error('skrip uji: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result?.result?.value;
  };
  const buka = async (url, detik) => { peristiwa = []; await kirim('Page.navigate', { url }); await tidur(detik * 1000); };
  const galat = () => {
    const minta = {}; peristiwa.filter(e => e.method === 'Network.requestWillBeSent').forEach(e => { minta[e.params.requestId] = e.params.request.url; });
    const out = [];
    for (const e of peristiwa) {
      if (e.method === 'Runtime.exceptionThrown') { const d = e.params.exceptionDetails; out.push('exception: ' + ((d.exception && d.exception.description) || d.text || '').split('\n')[0] + ` @${(d.url || '').split('/').pop()}:${d.lineNumber}`); }
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') out.push('console.error: ' + e.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && e.params.entry.source !== 'network') out.push('log: ' + (e.params.entry.text || '').slice(0, 200));
      if (e.method === 'Network.loadingFailed' && !e.params.canceled && !/ERR_ABORTED/.test(e.params.errorText)) out.push(`gagal: ${e.params.errorText} ${minta[e.params.requestId] || ''}`);
      if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) out.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
    }
    return [...new Set(out)];
  };
  const tutup = async () => { try { await kirim('Browser.close'); } catch (e) {} try { proc.kill(); } catch (e) {} try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {} };
  return { buka, nilai, galat, tutup };
}

// ── 2. Halaman ───────────────────────────────────────────────────────────────
async function cekHalaman() {
  console.log('Halaman (desktop)');
  const publik = ['', 'index.html', 'login.html', 'register.html', 'pricing.html', 'privacy.html', 'terms.html', 'status.html', 'economic-calendar.html', 'pwa.html', '404.html'];
  const login = ['profile.html', 'admin.html'];
  for (const [daftar, token] of [[publik, ''], [login, tokenAdmin]]) {
    const b = await bukaBrowser(1440, 900, token);
    try {
      for (const hal of daftar) {
        await b.buka(`${BASE}/${hal}`, 5);
        const g = b.galat();
        if (g.length) g.forEach(x => catat('halaman', `/${hal}: ${x}`)); else lulus(`/${hal || '(beranda)'}`);
      }
      // status.html: semua layanan harus "Operational" (dulu kalender selalu "Degraded").
      if (!token) {
        await b.buka(`${BASE}/status.html`, 9);
        const st = await b.nilai(`[...document.querySelectorAll('#statusList > div')].map(d => d.innerText.replace(/\\s+/g,' ').trim())`);
        const buruk = (st || []).filter(s => !/Operational$/.test(s));
        if (buruk.length) catat('status', buruk.join(' | ')); else lulus(`status.html: ${st.length} layanan Operational`);
      }
    } finally { await b.tutup(); }
  }
}

// ── 3. Dashboard ─────────────────────────────────────────────────────────────
// Indeks/komoditas hanya punya sumber OANDA (tv-bridge). Bila bridge lokal tidak berjalan, simbol itu
// dilewati (bukan dianggap rusak) dan dilaporkan.
var lewatiIndeks = null;   // var: dipakai alur utama di atas sebelum baris ini dieksekusi
async function indeksTersedia() {
  if (lewatiIndeks != null) return !lewatiIndeks;   // != null: sebelum baris var dieksekusi nilainya undefined
  // interval 30: jarang dipakai halaman, jadi tidak tertipu cache candle lama.
  try { const r = await fetch(`${BASE}/api/get-chart-data.php?symbol=US30&interval=30`); const j = await r.json(); lewatiIndeks = !(j && Array.isArray(j.candles) && j.candles.length); }
  catch (e) { lewatiIndeks = true; }
  if (lewatiIndeks) console.log('  ⚠ tv-bridge lokal tidak berjalan — simbol indeks (US30, NAS100, …) dilewati');
  return !lewatiIndeks;
}

async function cekDashboard(lebar, tinggi, label) {
  const adaIndeks = await indeksTersedia();
  const b = await bukaBrowser(lebar, tinggi, tokenAdmin);
  try {
    await b.buka(`${BASE}/dashboard.html`, 12);
    const h = await b.nilai(`(async () => {
      const tidur = ms => new Promise(r => setTimeout(r, ms));
      const curiga = /\\b(undefined|NaN|\\[object Object\\]|Fatal error|Warning:|Uncaught|TypeError|ReferenceError)\\b/;
      const hasil = { panel: [], simbol: [], tf: [], fs: null };
      const ids = [...new Set([...document.querySelectorAll('[data-panel]')].map(e => e.dataset.panel))];
      for (const id of ids) {
        try { switchPanel(id); } catch (e) { hasil.panel.push(id + ': switchPanel melempar ' + e.message); continue; }
        await tidur(1500);
        const el = document.getElementById(id);
        if (!el) { hasil.panel.push(id + ': elemen tidak ada'); continue; }
        if (getComputedStyle(el).display === 'none') { hasil.panel.push(id + ': tidak tampil'); continue; }
        const teks = (el.innerText || '').replace(/\\s+/g, ' ');
        const m = teks.match(curiga);
        if (m) hasil.panel.push(id + ': "…' + teks.slice(Math.max(0, m.index - 50), m.index + 30) + '…"');
        if (teks.length < 30) hasil.panel.push(id + ': hampir kosong');
      }
      hasil.jumlahPanel = ids.length;
      switchPanel('panel-charts'); await tidur(2000);
      const lewati = ${JSON.stringify(adaIndeks ? [] : ['US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225', 'XAGUSD', 'USOIL'])};
      const baris = [...document.querySelectorAll('#qimWatchlistRows .qim-watch-row')].filter(r => r.getAttribute('aria-disabled') !== 'true'
        && !lewati.includes((r.querySelector('.qim-watch-name b') || {}).textContent));
      for (const r of baris) {
        const sim = (r.querySelector('.qim-watch-name b') || {}).textContent;
        r.click();
        let k = {};
        for (let i = 0; i < 20; i++) { await tidur(400); k = window.qiChartKonteks ? window.qiChartKonteks() : {}; if ((k.symbol || k.sym) === sim && (k.candles || []).length) break; }
        if ((k.symbol || k.sym) !== sim) hasil.simbol.push(sim + ': chart tetap ' + (k.symbol || k.sym));
        else if (!(k.candles || []).length) hasil.simbol.push(sim + ': chart kosong');
      }
      hasil.jumlahSimbol = baris.length;
      const tfs = [...document.querySelectorAll('.qch-tf[data-iv]')];
      for (const t of tfs) {
        t.click();
        let n = 0;
        for (let i = 0; i < 20 && !n; i++) { await tidur(400); n = ((window.qiChartKonteks ? window.qiChartKonteks() : {}).candles || []).length; }
        if (!n) hasil.tf.push(t.dataset.iv + ': chart kosong');
      }
      hasil.jumlahTf = tfs.length;
      const panel = document.getElementById('panel-charts');
      toggleChartFullscreenMode(); await tidur(1200);
      const masuk = panel.classList.contains('chart-fullscreen-mode');
      toggleChartFullscreenMode(); await tidur(1200);
      const keluar = !panel.classList.contains('chart-fullscreen-mode');
      if (!masuk || !keluar) hasil.fs = 'layar penuh: masuk=' + masuk + ' keluar=' + keluar;
      hasil.fitur = [];
      if (!window.QIMBerita || !window.QIMAIJelaskan || !window.QIMBacktestUI || !window.QIMMultiChart) hasil.fitur.push('modul fitur baru tidak termuat');
      // Kembali ke BTC (sumber Binance/OANDA dengan cadangan) sebelum menguji fitur yang mengikuti chart utama.
      const btc = [...document.querySelectorAll('#qimWatchlistRows .qim-watch-row')].find(r => /BTCUSDT/.test(r.innerText));
      if (btc) { btc.click(); await tidur(3000); }
      if (innerWidth >= 1024 && window.QIMMultiChart) {
        QIMMultiChart.atur(2); await tidur(3500);
        const sel = QIMMultiChart._sel();
        if (sel.length !== 1 || !sel[0].candles.length) hasil.fitur.push('multi-chart 2: chart tambahan kosong');
        QIMMultiChart.atur(4); await tidur(3500);
        const sel4 = QIMMultiChart._sel();
        if (sel4.length !== 3 || sel4.some(x => !x.candles.length)) hasil.fitur.push('multi-chart 4: ' + sel4.map(x => x.candles.length).join('/'));
        QIMMultiChart.atur(1); await tidur(500);
        if (QIMMultiChart._sel().length) hasil.fitur.push('multi-chart: kembali ke 1 chart gagal');
      }
      if (window.QIMBacktestUI) {
        document.getElementById('qimBacktestBuka').click(); await tidur(400);
        document.getElementById('qbtSimbol').value = 'BTCUSDT'; document.getElementById('qbtTf').value = '240';
        document.getElementById('qbtJalan').click();
        let tabel = null;
        for (let i = 0; i < 90 && !tabel; i++) { await tidur(500); tabel = document.querySelector('.qbt-tabel'); }
        if (!tabel) hasil.fitur.push('backtest: tabel hasil tidak muncul — ' + document.getElementById('qbtStatus').innerText);
        else if (tabel.querySelectorAll('tbody tr').length !== 5) hasil.fitur.push('backtest: baris tabel ' + tabel.querySelectorAll('tbody tr').length);
        QIMBacktestUI.tutup();
      }
      return hasil;
    })()`);
    console.log(`Dashboard ${label} (${lebar}×${tinggi})`);
    (h.panel || []).forEach(x => catat(`dashboard-${label}`, 'panel ' + x));
    (h.simbol || []).forEach(x => catat(`dashboard-${label}`, 'simbol ' + x));
    (h.tf || []).forEach(x => catat(`dashboard-${label}`, 'timeframe ' + x));
    if (h.fs) catat(`dashboard-${label}`, h.fs);
    (h.fitur || []).forEach(x => catat(`dashboard-${label}`, x));
    if ((h.jumlahPanel || 0) < 30) catat(`dashboard-${label}`, `hanya ${h.jumlahPanel} panel ditemukan`);
    if ((h.jumlahSimbol || 0) < 10) catat(`dashboard-${label}`, `hanya ${h.jumlahSimbol} simbol watchlist ditemukan`);
    b.galat().forEach(x => catat(`dashboard-${label}`, x));
    lulus(`${label}: ${h.jumlahPanel} panel, ${h.jumlahSimbol} simbol, ${h.jumlahTf} timeframe, layar penuh`);
  } finally { await b.tutup(); }
}
