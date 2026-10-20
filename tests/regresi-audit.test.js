/**
 * Regresi dari audit 2026-10-20. Enam bug yang pernah NYATA dan tidak boleh kembali diam-diam:
 *
 *  1. Placeholder PDO yang dipakai ulang dalam satu pernyataan (live-trade.php, ai-auto-trade.php).
 *     Dengan PDO::ATTR_EMULATE_PREPARES = false, prepare natif MENOLAK nama yang sama dua kali →
 *     PDOException → HTTP 500. Kelas bug ini sudah muncul tiga kali di repo ini, jadi dijaga
 *     secara MENYELURUH: seluruh berkas PHP dipindai, bukan hanya dua berkas yang diperbaiki.
 *  2. register.php memberi role 'pro' lalu gagal membuat lisensi trial (kolom `created_at` tidak
 *     ada di tabel license_keys) → setiap pendaftar memegang PRO gratis SELAMANYA.
 *  3. signal-evaluator.php menghitung pnl_usd tanpa harga keluar → ~50% meleset untuk pair
 *     berbasis USD (USDJPY/USDCHF/USDCAD).
 *  4. qi_news_angka() membuang tanda minus pada "-175K" → arah sinyal NEWS bisa terbalik.
 *  5. changelog.html menyebut angka bundel yang tidak pernah benar.
 *
 * Run:  node tests/regresi-audit.test.js
 * PHP binary: $PHP_BIN, else `php` dari PATH (dilewati bila tidak ada, seperti uji PHP lain).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!lulus) gagal++;
};

// ── 1. Tidak ada placeholder PDO yang dipakai ulang, di SELURUH berkas PHP ────────────
console.log('Placeholder PDO (seluruh repo)');
const berkasPhp = [];
(function sapu(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!/^(node_modules|\.git|cache|uploads|assets)$/.test(e.name)) sapu(path.join(dir, e.name));
    } else if (e.name.endsWith('.php')) {
      berkasPhp.push(path.join(dir, e.name));
    }
  }
})(root);

const tersangka = [];
for (const f of berkasPhp) {
  const isi = fs.readFileSync(f, 'utf8');
  const re = /prepare\s*\(\s*(['"])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(isi))) {
    const sql = m[2];
    const hitung = {};
    for (const p of sql.match(/:[A-Za-z_][A-Za-z0-9_]*/g) || []) hitung[p] = (hitung[p] || 0) + 1;
    const ganda = Object.keys(hitung).filter((k) => hitung[k] > 1);
    if (ganda.length) {
      tersangka.push(`${path.relative(root, f).split(path.sep).join('/')}:${isi.slice(0, m.index).split('\n').length} (${ganda.join(', ')})`);
    }
  }
}
cek(`${berkasPhp.length} berkas PHP dipindai: tidak ada nama placeholder yang dipakai dua kali`, tersangka.length === 0, tersangka);

const liveTrade = baca('api/live-trade.php');
cek('live-trade.php set_enabled: memakai :enabled_cek yang terpisah', /:enabled_cek/.test(liveTrade) && /':enabled_cek'\s*=>/.test(liveTrade));
const autoTrade = baca('api/ai-auto-trade.php');
cek('ai-auto-trade.php enable: ON DUPLICATE KEY UPDATE memakai VALUES()', /ON DUPLICATE KEY UPDATE enabled = 1, symbols = VALUES\(symbols\), lots = VALUES\(lots\)/.test(autoTrade));

// ── 2. Pendaftar baru TIDAK pernah mendapat PRO gratis ───────────────────────────────
console.log('\nAkun baru = paket Gratis');
const reg = baca('api/register.php');
cek("register.php menyisipkan role 'user', bukan 'pro'", /':role'\s*=>\s*'user'/.test(reg) && !/':role'\s*=>\s*'pro'/.test(reg));
cek('register.php tidak lagi menulis ke tabel license_keys', !/INSERT INTO license_keys/i.test(reg));
cek('register.php tidak lagi menaikkan role lewat UPDATE', !/UPDATE users SET role/.test(reg));
cek('register.php tidak menjanjikan trial pada balasannya', !/[Tt]rial/.test(reg.split('echo json_encode')[1] || ''));

// Penjaga umum: setiap kolom license_keys yang ditulis kode PHP HARUS ada di schema.sql.
const skema = baca('database/schema.sql');
const defLisensi = (skema.match(/CREATE TABLE IF NOT EXISTS `license_keys`[\s\S]*?\n\)/) || [''])[0];
const kolomLisensi = new Set((defLisensi.match(/^\s*`([a-z_]+)`\s+[A-Z]/gim) || []).map((s) => s.replace(/[^a-z_]/g, '')));
cek('schema.sql: definisi license_keys terbaca', kolomLisensi.size > 0, [...kolomLisensi]);
const kolomDipakai = new Set();
for (const f of berkasPhp) {
  const isi = fs.readFileSync(f, 'utf8');
  for (const m of isi.match(/INSERT INTO license_keys\s*\(([^)]*)\)/gi) || []) {
    for (const k of m.replace(/INSERT INTO license_keys\s*\(/i, '').replace(')', '').split(',')) {
      const nama = k.trim().replace(/`/g, '');
      if (nama) kolomDipakai.add(nama);
    }
  }
}
const kolomHantu = [...kolomDipakai].filter((k) => !kolomLisensi.has(k));
cek('tidak ada kolom license_keys yang ditulis kode tapi tidak ada di schema.sql', kolomHantu.length === 0, kolomHantu);

// ── 3. pnl_usd memakai harga keluar ──────────────────────────────────────────────────
console.log('\nP/L dolar penilai sinyal');
const evaluator = baca('api/signal-evaluator.php');
cek('signal-evaluator.php mengirim harga ke qi_paper_pip_mult', /qi_paper_pip_mult\(\(string\)\$sig\['symbol'\],\s*\$keluar\)/.test(evaluator));
const tanpaHarga = [];
for (const f of berkasPhp) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  if (rel === 'api/_paper_math.php') continue;          // tempat fungsinya didefinisikan
  const isi = fs.readFileSync(f, 'utf8');
  const tanda = 'qi_paper_pip_mult(';
  for (let i = isi.indexOf(tanda); i !== -1; i = isi.indexOf(tanda, i + 1)) {
    // Ambil argumen sampai kurung penutup yang SEIMBANG — bukan kurung pertama, karena
    // argumen pertama biasanya berisi cast seperti (string)$sig['symbol'].
    let depth = 0, koma = false, arg = '';
    for (let k = i + tanda.length - 1; k < isi.length; k++) {
      const c = isi[k];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') { depth--; if (depth === 0) break; }
      else if (c === ',' && depth === 1) koma = true;
      if (depth >= 1 && k > i + tanda.length - 1) arg += c;
    }
    if (arg.trim() === '') continue;                     // penyebutan di komentar: qi_paper_pip_mult()
    if (!koma) tanpaHarga.push(`${rel}: qi_paper_pip_mult(${arg.trim()})`);
  }
}
cek('tidak ada pemanggil qi_paper_pip_mult yang lupa mengirim harga', tanpaHarga.length === 0, tanpaHarga);

// ── 5. Angka bundel di changelog cocok dengan dashboard.html yang sebenarnya ──────────
console.log('\nAngka publik changelog');
const changelog = baca('changelog.html');
const dashboard = baca('dashboard.html');
const skripSekarang = (dashboard.match(/<script\b[^>]*\bsrc\s*=/gi) || []).length;
const klaim = changelog.match(/\((\d+) permintaan menjadi (\d+)\)/);
cek('changelog menyebut jumlah permintaan skrip', !!klaim, klaim ? klaim[0] : null);
if (klaim) {
  cek(`angka "menjadi ${klaim[2]}" sama dengan jumlah <script src> di dashboard.html (${skripSekarang})`, Number(klaim[2]) === skripSekarang);
  cek('angka lama (49) tidak diubah menjadi lebih kecil dari yang sekarang', Number(klaim[1]) > Number(klaim[2]));
}
cek('klaim lama "43 permintaan menjadi 4" sudah dihapus', !/43 permintaan menjadi 4/.test(changelog));

// ── 6. .htaccess: salinan nyasar tidak boleh bisa diunduh ────────────────────
// Aturan diambil LANGSUNG dari .htaccess lalu dijalankan terhadap jalur nyata, jadi
// mengubah polanya akan tertangkap di sini — termasuk perubahan yang tanpa sengaja
// memblokir situs sendiri.
console.log('\nProteksi .htaccess');
const htaccess = baca('.htaccess');
const aturan = [];
for (const b of htaccess.split('\n')) {
  const m = b.match(/^\s*RewriteRule\s+(\S+)\s+-\s+\[F,L\]/);
  if (!m) continue;
  try { aturan.push(new RegExp(m[1])); } catch (e) { cek(`pola .htaccess tidak sah: ${m[1]}`, false); }
}
cek('aturan pemblokiran terbaca dari .htaccess', aturan.length >= 8, aturan.length);
const diblokir = (p) => aturan.some((re) => re.test(p));

const WAJIB_BLOKIR = [
  'config.5493/api_keys.php', 'config.5493/database.php', 'api.3155/health.php',
  'assets.9489/css/tailwind.css', '.claude.8513/settings.json', '.vercel.1915/output/x',
  'config.bak/api_keys.php', 'config/database.php', 'api/_middleware.php',
  'database/seed.sql', 'tests/publik.test.js', 'mt5-bridge/main.py',
];
const WAJIB_LOLOS = [
  'index.html', 'dashboard.html', 'bantuan.html', 'sw.js', 'manifest.json', 'favicon.ico',
  'api/health.php', 'api/get-chart-data.php', 'api/signals.php',
  'assets/js/main.js', 'assets/css/tailwind.css', 'assets/dist/inti.9464590294.js',
  'assets/mt-bridge/QuantumBridge.ex5', 'uploads/avatars/u1.png', 'robots.txt', 'og-image.png',
];
const bocor = WAJIB_BLOKIR.filter((p) => !diblokir(p));
const terblokirSalah = WAJIB_LOLOS.filter((p) => diblokir(p));
cek(`${WAJIB_BLOKIR.length} jalur sensitif semuanya diblokir`, bocor.length === 0, bocor);
cek(`${WAJIB_LOLOS.length} jalur publik semuanya tetap bisa diakses`, terblokirSalah.length === 0, terblokirSalah);
cek('ada aturan khusus untuk salinan nyasar "nama.ANGKA/"', /RewriteRule\s+\^\[\^\/\]\*\\\.\[0-9\]\+\//.test(htaccess));

// ── Bagian PHP (fungsi murni) ────────────────────────────────────────────────────────
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
console.log('');
const run = spawnSync(PHP, [path.join(__dirname, 'regresi-audit.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — regresi audit 2026-10-20 terkunci');
process.exit(gagal ? 1 : 0);
