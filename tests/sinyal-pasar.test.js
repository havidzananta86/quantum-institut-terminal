/**
 * Pasar untuk penerbit sinyal (api/_sinyal_pasar.php) + sambungannya ke semua penerbit.
 *
 * Audit sinyal 2026-10-22:
 *   · RSI dulu 30 close terakhir & 100 pada data datar → kini Wilder atas seluruh riwayat, SATU
 *     implementasi PHP, dan angkanya harus SAMA dengan calcRSI JavaScript (uji paritas di bawah);
 *   · generator dulu menimpa signal_history.json tanpa kunci → kini qi_signal_catat();
 *   · entry AI/TV tidak diperiksa terhadap harga pasar → qi_sp_jangkar_entry();
 *   · tidak ada penjaga pasar tutup → qi_sp_cek_pasar() di generator, AI, berita, webhook, ai-cron.
 *
 * Run:  node tests/sinyal-pasar.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

console.log('Sambungan (statis)');
const gen = baca('api/signal-generator.php');
cek('pembangkit mencatat lewat penulis bersama qi_signal_catat (jeda global 0, cooldown per simbol)', /qi_signal_catat\(\$rek, \$COOLDOWN_JAM, 0\)/.test(gen));
cek('pembangkit tidak lagi menulis berkas riwayat sendiri', !/file_put_contents\(\$historyFile/.test(gen) && !/array_unshift\(\$history/.test(gen));
cek('pembangkit: auto-paper memakai isi berkas TERBARU', /qi_ap_sinkron\(qi_db\(\), \$historyKini\)/.test(gen));
cek('pembangkit: penjaga pasar tutup sebelum analisa', /qi_sp_cek_pasar\(\$simbol/.test(gen) && gen.indexOf('qi_sp_cek_pasar(') < gen.indexOf("ai_analyze($simbol"));
const rec = baca('api/_signal_record.php');
cek('jalur pintas praterbit/pascaterbit sudah dihapus', !/function qi_signal_praterbit\(/.test(rec) && !/function qi_signal_pascaterbit\(/.test(rec));
const ai = baca('api/ai-signal.php');
cek('ai-signal: entry diperiksa ke harga pasar + penjaga pasar tutup', /qi_sp_jangkar_entry\(/.test(ai) && /qi_sp_cek_pasar\(/.test(ai) && /'harga_acuan'/.test(ai) && /'jarak_entry_atr'/.test(ai));
cek('ai-signal: rekor AI menyimpan ATR nyata (dulu 0)', /'atr'\s*=>\s*round\(\$atrAcuan, 5\)/.test(ai) && !/'atr'\s*=>\s*0,/.test(ai));
const tv = baca('api/tv-webhook.php');
cek('tv-webhook: entry diperiksa ke harga pasar server + penjaga pasar tutup', /qi_sp_jangkar_entry\(\$action/.test(tv) && /qi_sp_cek_pasar\(\$simbol/.test(tv) && !/'atr'\s*=>\s*0,/.test(tv));
const news = baca('api/signal-news.php');
cek('signal-news: mtf_aligned searah sinyal (bukan sekadar ≠ NEUTRAL)', /qi_sp_mtf_selaras\(\$overall, \$arah\)/.test(news) && !/'mtf_aligned'\s*=>\s*\(\$overall !== 'NEUTRAL'\)/.test(news));
cek('signal-news: penjaga pasar tutup + pembatalan ditulis di bawah kunci', /qi_sp_cek_pasar\(\$simbol/.test(news) && /qi_json_ubah\(\$historyFile/.test(news) && !/file_put_contents\(\$historyFile/.test(news));
const cron = baca('api/ai-cron.php');
cek('ai-cron: posisi AI dibuka di harga pasar hidup, bukan entry_price AI', !/\$ep = \$ep > 0 \? \$ep/.test(cron) && /\$ep = \$direction === 'BUY' \? \(float\)\$kini\['ask'\] : \(float\)\$kini\['bid'\]/.test(cron) && /empty\(\$kini\['hidup'\]\)/.test(cron));
for (const [f, re] of [['api/signals.php', /calc_rsi\(array_slice/], ['api/ai-signal.php', /ai_rsi\(array_slice/], ['api/ai-cron.php', /cron_rsi\(array_slice/]]) {
  const s = baca(f);
  cek(`${f}: RSI atas seluruh riwayat lewat qi_sp_rsi (tanpa potongan 30 close)`, !re.test(s) && /qi_sp_rsi\(/.test(s));
}

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}

let seri = null;
for (const zona of ['UTC', 'Asia/Jakarta']) {
  console.log(`\n[PHP date.timezone=${zona}]`);
  const run = spawnSync(PHP, ['-d', `date.timezone=${zona}`, path.join(__dirname, 'sinyal-pasar.test.php')], { encoding: 'utf8' });
  const keluaran = (run.stdout || '').split('\n');
  process.stdout.write(keluaran.filter((b) => !b.startsWith('RSI_JSON ')).join('\n') + '\n');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) gagal++;
  const baris = keluaran.find((b) => b.startsWith('RSI_JSON '));
  if (baris) seri = JSON.parse(baris.slice(9));
}

console.log('\nParitas RSI PHP ⇄ JavaScript');
/** Rumus bersama (sama persis dengan qi_sp_rsi): seed SMA 14 perubahan pertama, Wilder sampai akhir. */
function rsiRujukan(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let naik = 0, turun = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) naik += d; else turun -= d; }
  naik /= period; turun /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    naik = (naik * (period - 1) + Math.max(0, d)) / period;
    turun = (turun * (period - 1) + Math.max(0, -d)) / period;
  }
  if (naik === 0 && turun === 0) return 50;
  if (turun === 0) return 100;
  return 100 - 100 / (1 + naik / turun);
}
const tanpaDatar = (cs) => cs.filter((c) => !(Number(c.open) === Number(c.high) && Number(c.high) === Number(c.low) && Number(c.low) === Number(c.close))).map((c) => c.close);
cek('PHP mengeluarkan deret uji', !!seri, seri);
if (seri) {
  for (const [nama, s] of Object.entries(seri)) {
    const js = rsiRujukan(s.closes || tanpaDatar(s.candles));
    cek(`${nama}: PHP ${Number(s.rsi).toFixed(6)} = rumus JS ${js.toFixed(6)}`, Math.abs(js - s.rsi) < 1e-9);
  }
  // calcRSI di dashboard-app.js (rumus bersama qiRsiWilderSeri sisi JS). Dibandingkan langsung
  // dengan angka PHP, baik untuk deret close maupun candle (bar beku dibuang di kedua sisi).
  // Satu perbedaan yang DISENGAJA: data < 15 close → JS null ("belum cukup"), PHP 50 (netral,
  // dipakai pembanding > 55 / < 45 sehingga tidak pernah menjadi suara arah). Keduanya berarti
  // "tidak ada informasi"; penerbit PHP memang menolak < 55 candle sebelum RSI dihitung.
  const src = baca('assets/js/dashboard-app.js');
  const potong = (nama) => {
    const awal = src.indexOf('function ' + nama + '(');
    if (awal < 0) return null;
    let i = src.indexOf('{', awal), dalam = 0;
    for (; i < src.length; i++) { if (src[i] === '{') dalam++; else if (src[i] === '}' && --dalam === 0) break; }
    return src.slice(awal, i + 1);
  };
  const bagian = ['qiBarDatar', 'qiRsiWilderSeri', 'calcRSI'].map(potong);
  if (!bagian[2]) {
    console.log('  ! calcRSI tidak ditemukan di assets/js/dashboard-app.js — paritas JS hanya terhadap rumus rujukan');
  } else {
    const kotak = {};
    vm.runInNewContext(bagian.filter(Boolean).join('\n') + '\nthis.calcRSI = calcRSI;', kotak);
    const datar = kotak.calcRSI(new Array(40).fill(5));
    if (datar !== 50) {
      console.log('  ! calcRSI di dashboard-app.js belum memakai rumus bersama (datar → ' + datar + '); paritas menunggu perbaikan sisi JS');
    } else {
      for (const [nama, s] of Object.entries(seri)) {
        const js = kotak.calcRSI(s.closes || s.candles, 14);
        const setara = js === null ? s.rsi === 50 : Math.abs(js - s.rsi) < 1e-9;
        cek(`${nama}: calcRSI dashboard-app.js ${js === null ? 'null (belum cukup)' : Number(js).toFixed(6)} ⇄ PHP ${Number(s.rsi).toFixed(6)}`, setara);
      }
    }
  }
}

// ── ai-cron get_current_quote: kutipan MT5 TUTUP tidak menutup jalan ke cache segar ─────────────
// Audit ulang 2026-10-22: broker menutup kripto di akhir pekan; kutipan MT5 bertanda 'closed'
// dulu langsung dikembalikan (hidup=false) sehingga BTCUSDT dengan cache Binance segar tidak
// dibuka maupun dikelola TP/SL-nya. Fungsi ASLI dipotong dari api/ai-cron.php dan dijalankan
// dengan bridge MT5 tiruan.
console.log('\nai-cron: harga terkini saat broker MT5 tutup');
{
  const src = baca('api/ai-cron.php');
  const awal = src.indexOf('function get_current_quote(');
  let i = src.indexOf('{', awal), dalam = 0;
  for (; i < src.length; i++) { if (src[i] === '{') dalam++; else if (src[i] === '}' && --dalam === 0) break; }
  const fungsi = awal >= 0 ? src.slice(awal, i + 1) : null;
  cek('get_current_quote ditemukan di api/ai-cron.php', !!fungsi);
  if (fungsi) {
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qi-cron-'));
    const berkas = path.join(dir, 'btc_5.json').replace(/\\/g, '/');
    const pasar = path.join(root, 'api', '_sinyal_pasar.php').replace(/\\/g, '/');
    const skrip = path.join(dir, 'uji.php');
    fs.writeFileSync(skrip, `<?php
require '${pasar}';
$GLOBALS['mt5'] = [];
function qi_tv_bridge_symbol($s) { return $s; }
function qi_mt5_configured() { return true; }
function qi_mt5_quotes(array $s) { return $GLOBALS['mt5']; }
function cron_chart_files(string $sym, string $iv): array { return $iv === '5' && $sym === 'BTCUSDT' ? ['${berkas}'] : []; }
${fungsi}
$kini = time(); $c = [];
for ($k = 30; $k >= 0; $k--) { $t = intdiv($kini, 300) * 300 - $k * 300; $c[] = ['time' => $t, 'open' => 67000, 'high' => 67100, 'low' => 66900, 'close' => 67050.5]; }
file_put_contents('${berkas}', json_encode(['source' => 'binance', 'simulated' => false, 'candles' => $c]));
$GLOBALS['mt5'] = ['BTCUSDT' => ['bid' => 66000.0, 'ask' => 66010.0, 'market' => 'closed']];
$a = get_current_quote('BTCUSDT');
echo json_encode(['tutup_cache_segar' => $a]);
`);
    const r = spawnSync(PHP, [skrip], { encoding: 'utf8' });
    let d = null;
    try { d = JSON.parse(r.stdout); } catch (e) { cek('PHP menghasilkan JSON', false, (r.stdout || '') + (r.stderr || '')); }
    if (d) {
      const q = d.tutup_cache_segar;
      cek('MT5 tutup + cache Binance segar → harga Binance dipakai, hidup=true (dulu hidup=false dari kutipan beku)', q.hidup === true && q.source === 'binance' && Math.abs(q.bid - 67050.5) < 1e-9, q);
    }
    // Kasus kedua di proses terpisah ($memo statis): tanpa cache segar → kutipan MT5 tetap dikembalikan untuk log, hidup=false.
    fs.writeFileSync(skrip, fs.readFileSync(skrip, 'utf8').replace("file_put_contents('" + berkas + "'", "@unlink('" + berkas + "'); if (0) file_put_contents('" + berkas + "'"));
    const r2 = spawnSync(PHP, [skrip], { encoding: 'utf8' });
    let d2 = null;
    try { d2 = JSON.parse(r2.stdout); } catch (e) { cek('PHP menghasilkan JSON (kasus 2)', false, (r2.stdout || '') + (r2.stderr || '')); }
    if (d2) {
      const q = d2.tutup_cache_segar;
      cek('MT5 tutup tanpa cache segar → kutipan MT5 dikembalikan dengan hidup=false (tidak mengarang harga)', q.hidup === false && q.source === 'mt5' && q.bid === 66000, q);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
