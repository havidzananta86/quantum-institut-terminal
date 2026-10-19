// Kontrak "tampil profesional": tidak ada angka karangan di halaman publik, merek konsisten, halaman
// Transparansi memakai data nyata, dan batas rugi harian ditegakkan server.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300))); if (!kondisi) gagal++; }

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const phpAda = !spawnSync(PHP, ['-v'], { encoding: 'utf8' }).error;

// ── 1. Landing page jujur ────────────────────────────────────────────────────
console.log('Landing page tanpa angka karangan');
// Skrip halaman dipindah ke assets/js/halaman-*.js (CSP tanpa 'unsafe-inline'); kontrak membaca keduanya.
const idx = read('index.html') + read('assets/js/halaman-index.js');
cek('tidak ada klaim "78% Akurasi"', !/78\s*%\s*Akurasi/i.test(idx));
cek('tidak ada janji win rate 60–80% di FAQ', !/60\s*[–-]\s*80\s*%/.test(idx));
cek('tidak ada testimoni karangan (nama/kutipan tetap)', !/testimonial/i.test(idx.replace(/Bukti, bukan janji[\s\S]{0,0}/, '')) || /Bukti, bukan janji/.test(idx));
cek('statistik diisi dari api/transparansi.php', /api\/transparansi\.php/.test(idx) && /idxStatWr/.test(idx) && /idxWinrate/.test(idx));
cek('kartu "Sinyal Terbaru" diisi dari riwayat sinyal asli', /tradeIdeasGrid/.test(idx) && /api\/signal-history\.php/.test(idx));
cek('tautan ke halaman Transparansi (menu + footer)', (idx.match(/href="transparansi\.html"/g) || []).length >= 3);

// ── 2. Merek & pratinjau tautan ──────────────────────────────────────────────
console.log('Merek konsisten');
const halaman = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const salahEja = halaman.filter(f => /Quantum Institute/.test(read(f)));
cek('ejaan "Quantum Institut" (bukan "Institute") di semua halaman', salahEja.length === 0, salahEja);
const tanpaFavicon = halaman.filter(f => !/rel="icon"/.test(read(f)));
cek('semua halaman punya favicon', tanpaFavicon.length === 0, tanpaFavicon);
const publik = ['index', 'login', 'register', 'pricing', 'privacy', 'terms', 'status', 'economic-calendar', 'pwa', 'transparansi'];
const tanpaOg = publik.filter(n => { const s = read(n + '.html'); return !/property="og:title"/.test(s) || !/property="og:image"/.test(s) || !/name="twitter:card"/.test(s); });
cek('halaman publik punya pratinjau tautan (og:title, og:image, twitter:card)', tanpaOg.length === 0, tanpaOg);
cek('og-image.png ada', fs.existsSync(path.join(root, 'og-image.png')));
cek('transparansi.html masuk sitemap', /transparansi\.html/.test(read('sitemap.xml')));

// ── 3. Transparansi ──────────────────────────────────────────────────────────
console.log('Transparansi');
const tr = read('transparansi.html') + read('assets/js/halaman-transparansi.js'), trApi = read('api/transparansi.php');
cek('halaman memanggil api/transparansi.php dan menampilkan selang kepercayaan + peringatan sampel kecil', /api\/transparansi\.php/.test(tr) && /ci_bawah|ci_atas/.test(tr) && /30/.test(tr));
cek('endpoint publik (tanpa login) ber-rate-limit dan ber-cache pendek', /qi_rate_limit/.test(trApi) && /Cache-Control: public, max-age=/.test(trApi) && !/qi_require_auth/.test(trApi));
cek('endpoint memuat metodologi dan peringatan risiko', /metodologi/.test(trApi) && /peringatan/.test(trApi));
cek('expectancy hanya dari R nyata (tanpa angka cadangan 2,5)', !/\?\?\s*2\.5/.test(read('api/_signal_stats.php')));

// ── 4. Batas rugi harian ─────────────────────────────────────────────────────
console.log('Batas rugi harian');
if (!phpAda) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}")`);
} else {
  for (const zone of ['UTC', 'Asia/Jakarta']) {
    console.log(`[PHP date.timezone=${zone}]`);
    const run = spawnSync(PHP, ['-d', `date.timezone=${zone}`, path.join(__dirname, 'batas-rugi.test.php')], { encoding: 'utf8' });
    process.stdout.write(run.stdout || ''); process.stderr.write(run.stderr || '');
    if (run.status !== 0) gagal++;
  }
}
const pt = read('api/paper-trading.php'), ap = read('api/_auto_paper.php'), br = read('api/_batas_rugi.php');
cek('server menolak posisi manual baru saat batas tercapai', /qi_batas_rugi_status\(\$pdo, \$uid\)/.test(pt) && /\$batasRugi\['tercapai'\]/.test(pt) && /batas_rugi_harian/.test(pt));
cek('gerbang dipasang SEBELUM posisi dimasukkan (penutupan tetap boleh)', pt.indexOf("$batasRugi['tercapai']") < pt.indexOf('$buka->execute(') && pt.indexOf('// 1) Penutupan baru') < pt.indexOf('qi_batas_rugi_status('));
cek('Ikuti Auto Analisa tidak membuka posisi saat batas tercapai', /qi_batas_rugi_status\(\$pdo, \$uid, \$kini\)\['tercapai'\]/.test(ap) && ap.indexOf("['tercapai']") < ap.indexOf('$rencana = qi_ap_pilih_buka('));
cek('hari dihitung WIB dan memakai UNIX_TIMESTAMP (bukan strtotime)', /Asia\/Jakarta/.test(br) && /UNIX_TIMESTAMP\(closed_at\)/.test(br) && !/strtotime/.test(br));
cek('endpoint status butuh login', /qi_require_auth/.test(read('api/batas-rugi.php')));
const B = require('../assets/js/qim-batas-rugi.js');
const r1 = B.ringkas({ terpakai_pct: 100, tercapai: true, peringatan: false, rugi_hari: 300, batas_usd: 300, batas_pct: 3, sisa_usd: 0 });
cek('meteran: tercapai → tingkat "tercapai", batang penuh, pesan reset 00:00 WIB', r1.tingkat === 'tercapai' && r1.lebar === 100 && /00:00 WIB/.test(r1.judul), r1);
const r2 = B.ringkas({ terpakai_pct: 83.3, tercapai: false, peringatan: true, rugi_hari: 250, batas_usd: 300, batas_pct: 3, sisa_usd: 50 });
cek('meteran: 83% → "waspada" dengan rincian rugi/batas/sisa', r2.tingkat === 'waspada' && /83%/.test(r2.judul) && /\$250\.00/.test(r2.rincian) && /\$50\.00/.test(r2.rincian), r2);
cek('meteran: tanpa data → null (tersembunyi)', B.ringkas(null) === null);
cek('dashboard memuat qim-batas-rugi.js', /qim-batas-rugi\.js\?v=/.test(read('dashboard.html')));

// ── 5. Sinyal indikator Pine di server ───────────────────────────────────────
console.log('Sinyal indikator Pine (server)');
const cron = read('api/maintenance-cron.php'), ps = read('api/_pine_sinyal.php');
cek('cron memindai Pine dan memberi notifikasi lewat qi_notif_sebar_sinyal (dapat dimatikan QI_PINE_NOTIF)', /qi_pine_pindai\(/.test(cron) && /qi_notif_sebar_sinyal\(\$rek\)/.test(cron) && /QI_PINE_NOTIF/.test(cron));
cek('hanya candle tutup dinilai & sinyal pada transisi (bukan tiap bar VALID)', /array_pop\(\$c\)/.test(ps) && /status_awal_dicatat/.test(ps));
cek('memakai penilai konservatif yang sama dengan sinyal bayangan', /qi_ss_nilai\(/.test(ps));
cek('transparansi menampilkan sinyal Pine apa adanya (tanpa angka bawaan)', /sinyal_pine/.test(read('api/transparansi.php')) && /tPine/.test(read('transparansi.html')));
cek('catatan Pine tidak digabung ke riwayat sinyal resmi', !/signal_history\.json/.test(ps));

console.log(gagal ? `\n${gagal} GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
