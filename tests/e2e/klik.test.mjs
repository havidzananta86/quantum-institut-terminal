// Uji e2e menyeluruh di XAMPP lokal — versi tetap dari audit situs 2026-10-18.
//  1. Sapu semua API baca (GET) sebagai admin, pengguna gratis, dan tamu: tidak boleh 5xx (kecuali
//     health yang memang boleh "degraded"), JSON harus sah, tanpa PHP Warning/Notice/Fatal.
//  2. Buka semua halaman publik & halaman login (desktop) — tanpa exception, console.error,
//     permintaan gagal, atau respons >= 400.
//  3. Dashboard chart-first (desktop 1440×900 DAN iPhone 390×844): tata letak, gerbang sesi/peran, chart terminal
//     menggambar kanvas, kartu Quick Trade, dan Signal Center menghitung sinyal — tanpa undefined/NaN/galat PHP.
//  4. Profil → Broker MT5: pengaturan bridge/eksekusi/Telegram termuat dan tombolnya terhubung ke fungsi.
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
                           : '\nPASS — e2e: semua API, halaman, dashboard chart-first dan Profil → Broker MT5 (desktop & iPhone)');
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
  const publik = ['', 'index.html', 'login.html', 'register.html', 'pricing.html', 'privacy.html', 'terms.html', 'status.html', 'economic-calendar.html', 'pwa.html', 'transparansi.html', '404.html',
    'metodologi.html', 'risiko.html', 'changelog.html', 'bantuan.html', 'kompetisi.html'];
  const login = ['profile.html', 'admin.html', 'kompetisi.html'];
  for (const [daftar, token] of [[publik, ''], [login, tokenAdmin]]) {
    const b = await bukaBrowser(1440, 900, token);
    try {
      for (const hal of daftar) {
        await b.buka(`${BASE}/${hal}`, 5);
        const g = b.galat();
        if (g.length) g.forEach(x => catat('halaman', `/${hal}: ${x}`)); else lulus(`/${hal || '(beranda)'}`);
      }
      // status.html: semua layanan fitur harus "Normal" (data-tingkat="ok"; dulu kalender selalu "Degraded"), dan
      // laporan kesehatan server (#intiList) tidak boleh punya baris merah. Baris abu-abu (belum tercatat) boleh.
      if (!token) {
        await b.buka(`${BASE}/status.html`, 9);
        const st = await b.nilai(`[...document.querySelectorAll('#statusList > .pb-baris-status, #intiList > .pb-baris-status')].map(d => d.parentElement.id + ':' + (d.dataset.tingkat || 'netral') + ' ' + d.innerText.replace(/\\s+/g,' ').trim())`);
        const fitur = (st || []).filter(s => s.startsWith('statusList:'));
        const buruk = (st || []).filter(s => s.startsWith('statusList:') ? !s.startsWith('statusList:ok ') : s.startsWith('intiList:bahaya '));
        if (buruk.length || !fitur.length) catat('status', buruk.join(' | ') || 'baris status tidak ditemukan'); else lulus(`status.html: ${fitur.length} layanan Normal, kesehatan server tanpa baris merah`);
      }
      // Profil → Broker MT5 (dulu panel Akun dashboard lama): bagian termuat, tiap tombol punya fungsinya, status eksekusi
      // terbaca dari server (bukan tertahan di "Memuat…"), dan kartu Telegram tampil untuk admin.
      if (token) {
        await b.buka(`${BASE}/profile.html`, 9);
        const p = await b.nilai(`(async () => {
          const tidur = ms => new Promise(r => setTimeout(r, ms));
          const masalah = [];
          const sec = document.getElementById('brokerSection');
          if (!sec) return ['bagian #brokerSection tidak ada'];
          const aksi = [...new Set([...sec.querySelectorAll('[data-qi-aksi],[data-qi-aksi-submit],[data-qi-aksi-change]')].flatMap(e => [e.getAttribute('data-qi-aksi'), e.getAttribute('data-qi-aksi-submit'), e.getAttribute('data-qi-aksi-change')]).filter(Boolean))];
          const hilang = aksi.filter(n => typeof window[n] !== 'function');
          if (hilang.length) masalah.push('tombol tanpa fungsi: ' + hilang.join(', '));
          if (aksi.length < 8) masalah.push('hanya ' + aksi.length + ' aksi ditemukan di bagian broker');
          if (!window.QIAksi) masalah.push('qim-aksi.js tidak termuat di profile.html');
          for (let i = 0; i < 30 && /^Memuat/.test((document.getElementById('liveExecutionState') || {}).textContent || 'Memuat'); i++) await tidur(300);
          const st = (document.getElementById('liveExecutionState') || {}).textContent || '';
          if (!st || /^Memuat/.test(st)) masalah.push('status eksekusi tertahan di "' + st + '"');
          if (!/^https?:\\/\\//.test((document.getElementById('bridgeEndpointValue') || {}).textContent || '')) masalah.push('endpoint bridge tidak terisi');
          const tg = document.getElementById('tgKartu');
          if (!tg || tg.classList.contains('hidden')) masalah.push('kartu Telegram tidak tampil untuk admin');
          const teks = (sec.innerText || '').replace(/\\s+/g, ' ');
          const k = teks.match(/\\b(undefined|NaN|\\[object Object\\]|Fatal error|Warning:|Uncaught)\\b/);
          if (k) masalah.push('bagian broker memuat teks rusak: "…' + teks.slice(Math.max(0, k.index - 40), k.index + 30) + '…"');
          return masalah;
        })()`);
        const g = b.galat();
        (p || []).forEach(x => catat('profil', x)); g.forEach(x => catat('profil', x));
        if (!(p || []).length && !g.length) lulus('profile.html: Broker MT5 & Eksekusi termuat, semua tombol punya fungsi');
      }
    } finally { await b.tutup(); }
  }
}

// ── 3. Dashboard chart-first ─────────────────────────────────────────────────
// Terminal chart (iframe quantum-terminal/embed) + rail Quick Trade + Signal Center. Panel-panel dashboard lama sudah dibuang.
async function cekDashboard(lebar, tinggi, label) {
  const b = await bukaBrowser(lebar, tinggi, tokenAdmin);
  try {
    await b.buka(`${BASE}/dashboard.html`, 14);
    const h = await b.nilai(`(async () => {
      const tidur = ms => new Promise(r => setTimeout(r, ms));
      const curiga = /\\b(undefined|NaN|\\[object Object\\]|Fatal error|Warning:|Uncaught|TypeError|ReferenceError)\\b/;
      const hasil = { masalah: [], ringkas: {} };
      const rc = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), kanan: Math.round(r.right), bawah: Math.round(r.bottom) }; };
      const m = (teks) => hasil.masalah.push(teks);

      // 1. Gerbang sesi: token sah → tetap di dashboard, peran terisi.
      if (!/dashboard\\.html$/.test(location.pathname)) m('dialihkan dari dashboard ke ' + location.pathname);
      if (window.QI_PERAN !== 'admin') m('window.QI_PERAN = ' + window.QI_PERAN + ' (harus admin untuk sesi uji) — Quick Trade membacanya untuk membuka paper trading');

      // 2. Tata letak CHART PENUH: iframe mengisi seluruh jendela (tanpa bar atas, toolbar mengambang, atau kolom permanen).
      // Dulu <body> memakai grid dashboard lama sehingga iframe setinggi 12px.
      const fr = rc('#quantumTerminalFrame'), rail = rc('#qimRightPanel');
      if (document.querySelector('.qt-topbar')) m('bar atas muncul lagi — chart seharusnya memenuhi layar');
      if (!fr || fr.w < innerWidth - 2 || fr.h < innerHeight - 2) m('chart tidak memenuhi layar: ' + JSON.stringify(fr) + ' vs ' + innerWidth + '×' + innerHeight);
      const gayaRail = document.getElementById('qimRightPanel') ? getComputedStyle(document.getElementById('qimRightPanel')) : null;
      if (!rail || !gayaRail) m('panel Order tidak ada');
      else if (gayaRail.visibility !== 'hidden' || document.getElementById('qimRightPanel').classList.contains('is-open')) m('panel Order terbuka bawaan (seharusnya tertutup)');
      if (document.querySelector('.qt-chart-tools') || document.getElementById('qtMenu')) m('toolbar/menu chart lama masih tampil');
      if (document.documentElement.scrollWidth > innerWidth + 1) m('halaman melebar menyamping: scrollWidth ' + document.documentElement.scrollWidth + ' > ' + innerWidth);
      hasil.ringkas.layout = { fr, rail };

      // 2c. Peluncur Order dihapus sesuai keputusan produk; panel tetap tersembunyi.
      if (document.getElementById('qtOrderLauncher')) m('peluncur Order lama masih tampil');
      if (getComputedStyle(document.getElementById('qimRightPanel')).visibility !== 'hidden' || document.getElementById('qimRightPanel').classList.contains('is-open')) m('panel Order terbuka padahal peluncurnya sudah dihapus');

      // 3. Chart terminal termuat: kanvas ada dan tidak tertahan di layar muat / galat.
      let kanvas = 0, isiFrame = '';
      for (let i = 0; i < 60; i++) {
        await tidur(500);
        try {
          const d = document.getElementById('quantumTerminalFrame').contentDocument;
          kanvas = d.querySelectorAll('canvas').length;
          isiFrame = (d.body.innerText || '').replace(/\\s+/g, ' ');
          if (kanvas && !d.querySelector('.tcw-loading-overlay')) break;
        } catch (e) { m('iframe chart tidak bisa dibaca: ' + e.message); break; }
      }
      if (!kanvas) m('chart terminal tidak menggambar kanvas apa pun');
      if (/Connection failed|Failed to fetch/i.test(isiFrame)) m('chart terminal menampilkan galat koneksi: ' + (isiFrame.match(/Connection failed|Failed to fetch/i) || [''])[0]);
      hasil.ringkas.kanvas = kanvas;

      // 4. Quick Trade: simbol terbaca dari chart, tombol BUY/SELL aktif untuk admin, tanpa teks rusak.
      const qt = document.getElementById('qtKartu');
      if (!qt) m('kartu Quick Trade tidak ada');
      else {
        for (let i = 0; i < 40 && /^[—-]?$/.test((document.getElementById('qtSym') || {}).textContent || ''); i++) await tidur(500);
        const sim = (document.getElementById('qtSym') || {}).textContent;
        if (!sim || sim === '—') m('Quick Trade tidak tahu simbol chart (qtSym kosong)');
        for (const id of ['qtBuy', 'qtSell']) { const t = document.getElementById(id); if (!t) m(id + ' tidak ada'); else if (t.disabled) m(id + ' nonaktif untuk admin'); }
        const teksQt = (qt.innerText || '').replace(/\\s+/g, ' ');
        const k = teksQt.match(curiga);
        if (k) m('Quick Trade memuat teks rusak: "…' + teksQt.slice(Math.max(0, k.index - 40), k.index + 30) + '…"');
        hasil.ringkas.qt = { sim, beli: (document.getElementById('qtBuyHarga') || {}).textContent, jual: (document.getElementById('qtSellHarga') || {}).textContent };
      }
      if (!document.querySelector('a[href="profile.html#brokerSection"]') && getComputedStyle(document.getElementById('qtRealInfo') || document.body).display !== 'none') m('tautan ke Profil → Broker MT5 tidak ada');
      if (document.getElementById('ptOpenBtn') || document.getElementById('ptSymbol')) m('form order manual dobel muncul lagi di dashboard');
      if (document.getElementById('bridgeSetup') || document.getElementById('liveAccountId')) m('blok broker/eksekusi seharusnya di Profil, bukan dashboard');

      // 5. Signal Center: buka, tunggu sinyal terhitung, tidak ada teks rusak, sumber data berlabel.
      const peluncur = document.getElementById('qtAssistLauncher');
      if (!peluncur) m('tombol Signal Center tidak ada');
      else {
        peluncur.click();
        let lencana = '';
        for (let i = 0; i < 70; i++) { await tidur(500); lencana = (document.getElementById('qtSignalBadge') || {}).textContent || ''; if (lencana && !/MEMUAT/i.test(lencana)) break; }
        if (!lencana || /MEMUAT/i.test(lencana)) m('Signal Center tertahan di "MEMUAT"');
        const drawer = (document.getElementById('qtAssistDrawer').innerText || '').replace(/\\s+/g, ' ');
        const k = drawer.match(curiga);
        if (k) m('Signal Center memuat teks rusak: "…' + drawer.slice(Math.max(0, k.index - 50), k.index + 30) + '…"');
        const sumber = (document.getElementById('qtSignalSource') || {}).textContent || '';
        if (!sumber || sumber === '—') m('Signal Center tidak menyebut sumber data');
        hasil.ringkas.sinyal = { lencana, sumber, status: (document.getElementById('qtAssistFooterText') || {}).textContent };
        document.getElementById('qtAssistClose').click();
      }

      // 6. Teks seluruh halaman (di luar iframe) bebas dari NaN/undefined/galat PHP.
      const semua = (document.body.innerText || '').replace(/\\s+/g, ' ');
      const k2 = semua.match(curiga);
      if (k2) m('halaman memuat teks rusak: "…' + semua.slice(Math.max(0, k2.index - 50), k2.index + 30) + '…"');
      return hasil;
    })()`);
    console.log(`Dashboard ${label} (${lebar}×${tinggi})`);
    (h.masalah || []).forEach(x => catat(`dashboard-${label}`, x));
    b.galat().forEach(x => catat(`dashboard-${label}`, x));
    const r = h.ringkas || {};
    lulus(`${label}: chart penuh ${r.layout && r.layout.fr ? r.layout.fr.w + '×' + r.layout.fr.h : '?'}, ${r.kanvas || 0} kanvas, Quick Trade ${r.qt ? r.qt.sim : '?'}, sinyal ${r.sinyal ? r.sinyal.lencana + ' · ' + r.sinyal.sumber : '?'}`);
  } finally { await b.tutup(); }
}
