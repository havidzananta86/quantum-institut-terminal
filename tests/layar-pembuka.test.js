/**
 * Layar pembuka dashboard (#qiLoadScreen).
 *
 * Versi sebelumnya memutar tiga pesan berbahasa Inggris setiap 600 ms tanpa hubungan
 * dengan apa pun yang sedang terjadi — kemajuan palsu, persis jenis klaim yang
 * dibersihkan dari bagian lain produk ini. Versi berikutnya masih menyisakan tiga hal palsu:
 * bilah berdurasi tetap 2,4 detik, tahap sesi yang "selesai" oleh timer 120 ms, dan tahap
 * data yang ditandai selesai walau data tidak pernah masuk. Di sini dikunci bahwa tiap tahap
 * menyala karena peristiwanya benar-benar terjadi, bilah = tahap selesai / jumlah tahap, dan
 * layarnya TIDAK PERNAH mengurung pengguna.
 *
 * Run:  node tests/layar-pembuka.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const JS = fs.readFileSync(path.join(root, 'assets/js/halaman-dashboard-pemuat.js'), 'utf8');
// Gerbang sesi pindah ke assets/js/qim-terminal-gate.js saat dashboard panel lama dihapus.
const AWAL = fs.readFileSync(path.join(root, 'assets/js/qim-terminal-gate.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'assets/css/qim-masuk.css'), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

// ── DOM & jam tiruan ────────────────────────────────────────────────────────
function sandbox({ adaSesi = true, readyState = 'loading', serah = null, gerakMinim = false } = {}) {
  const el = {};
  const ambil = (id) => (el[id] = el[id] || {
    id, textContent: '', hidden: false, parentNode: null, attr: {}, gaya: {},
    anak: { textContent: '' },
    setAttribute(k, v) { this.attr[k] = String(v); },
    getAttribute(k) { return k in this.attr ? this.attr[k] : null; },
    removeAttribute(k) { delete this.attr[k]; },
    querySelector(sel) { return sel === '.qm-teks' ? this.anak : null; },
    style: { setProperty(k, v) { ambil(id).gaya[k] = v; } },
    remove() { this.parentNode = null; },
    classList: { _s: new Set(), add(k) { this._s.add(k); }, contains(k) { return this._s.has(k); } },
  });
  ambil('qiLoadScreen').parentNode = {};
  ['qiBootSesi', 'qiBootData', 'qiBootSiap'].forEach((id) => ambil(id).setAttribute('data-keadaan', 'tunggu'));
  ambil('qiBootMasuk').hidden = true;
  ambil('qiBootMasuk').setAttribute('data-keadaan', 'selesai');           // = markup dashboard.html
  ambil('qiBootMasuk').anak.textContent = 'Masuk · pemeriksaan selesai';
  ambil('qiLoadSiapa').hidden = true;
  const timer = [];
  const pendengar = { dokumen: {}, jendela: {} };
  const dikirim = [];
  let waktu = 1000000;
  const sesi = new Map(serah ? [['qi_serah_masuk', JSON.stringify(serah(waktu))]] : []);
  const jendela = {
    addEventListener: (n, f) => { (pendengar.jendela[n] = pendengar.jendela[n] || []).push(f); },
    dispatchEvent: (ev) => { dikirim.push(ev.type); (pendengar.jendela[ev.type] || []).forEach((f) => f(ev)); return true; },
    matchMedia: (q) => ({ matches: gerakMinim && /reduce/.test(q) }),
  };
  const ctx = {
    document: {
      getElementById: ambil,
      readyState,
      addEventListener: (n, f) => { (pendengar.dokumen[n] = pendengar.dokumen[n] || []).push(f); },
    },
    window: jendela,
    CustomEvent: function (type, o) { this.type = type; this.detail = o && o.detail; },
    localStorage: { getItem: () => (adaSesi ? 'tok' : null) },
    sessionStorage: { getItem: (k) => (sesi.has(k) ? sesi.get(k) : null), removeItem: (k) => sesi.delete(k) },
    setTimeout: (f, ms) => { timer.push({ f, pada: waktu + (ms || 0) }); return timer.length; },
    setInterval: () => { throw new Error('setInterval dilarang di layar pembuka'); },
    Date: { now: () => waktu },
    JSON, String, Math, console,
  };
  vm.createContext(ctx);
  vm.runInContext(JS, ctx);
  // Timer yang dijadwalkan DARI DALAM timer lain harus ikut jalan (tutup() menjadwalkan
  // penutupan bertunda), jadi diulang sampai tidak ada lagi yang jatuh tempo.
  const maju = (ms) => {
    waktu += ms;
    for (let putaran = 0; putaran < 50; putaran++) {
      const due = timer.filter((t) => !t.sudah && t.pada <= waktu);
      if (!due.length) break;
      due.forEach((t) => { t.sudah = true; t.f(); });
    }
  };
  const picu = (jenis, nama, detail) => (pendengar[jenis][nama] || []).forEach((f) => f({ type: nama, detail }));
  const k = (id) => ambil(id).getAttribute('data-keadaan');
  const bilah = () => Number(ambil('qiLoadScreen').gaya['--qm-kemajuan']);
  return { ctx, el: ambil, k, bilah, maju, picu, timer, sesi, dikirim, jendela };
}

console.log('Tahapan mengikuti kejadian nyata');
{
  const s = sandbox();
  cek('tahap sesi langsung berjalan', s.k('qiBootSesi') === 'jalan');
  cek('status awal dalam Bahasa Indonesia', /Memverifikasi sesi/.test(s.el('qiLoadStatus').textContent), s.el('qiLoadStatus').textContent);
  cek('bilah mulai dari 0 (belum ada tahap selesai)', s.bilah() === 0, s.bilah());
  s.maju(130);
  cek('sesi TIDAK ditandai selesai oleh timer (dulu 120 ms)', s.k('qiBootSesi') === 'jalan', s.k('qiBootSesi'));
  s.picu('jendela', 'qi-sesi', { sah: true, http: 200 });   // jawaban verify_token dari halaman-dashboard-awal.js
  cek('qi-sesi {sah:true} → sesi selesai', s.k('qiBootSesi') === 'selesai');
  cek('teks tahap sesi menyebut verifikasi server', /server/i.test(s.el('qiBootSesi').anak.textContent), s.el('qiBootSesi').anak.textContent);
  cek('status berubah ke data pasar', /data pasar/i.test(s.el('qiLoadStatus').textContent), s.el('qiLoadStatus').textContent);
  cek('bilah = 1/3 setelah satu tahap selesai', Math.abs(s.bilah() - 1 / 3) < 1e-9, s.bilah());
  s.picu('jendela', 'qi-chart-loading');
  cek('qi-chart-loading → tahap data berjalan', s.k('qiBootData') === 'jalan');
  cek('layar BELUM ditutup sebelum DOM siap', !s.el('qiLoadScreen').classList.contains('done'));
}

console.log('\nBatas lunak verifikasi sesi (1,2 detik)');
{
  const s = sandbox();
  s.maju(1100);
  cek('sebelum 1,2 detik masih "jalan"', s.k('qiBootSesi') === 'jalan');
  s.maju(200);
  cek('setelah 1,2 detik: "lewat", bukan "selesai"', s.k('qiBootSesi') === 'lewat', s.k('qiBootSesi'));
  cek('teksnya jujur: "Sesi diverifikasi di latar"', s.el('qiBootSesi').anak.textContent === 'Sesi diverifikasi di latar', s.el('qiBootSesi').anak.textContent);
  cek('batas lunak (timer) TIDAK memajukan bilah — ditandai data-lunak', s.bilah() === 0 && s.el('qiBootSesi').getAttribute('data-lunak') !== null, s.bilah());
  s.picu('jendela', 'qi-sesi', { sah: true, http: 200 });
  cek('jawaban server yang terlambat tetap menandai selesai', s.k('qiBootSesi') === 'selesai');
  cek('…dan baru saat itu bilah maju ke 1/3 (data-lunak dilepas)', Math.abs(s.bilah() - 1 / 3) < 1e-9 && s.el('qiBootSesi').getAttribute('data-lunak') === null, s.bilah());
}
{
  // Batas lunak lalu layar ditutup sebelum jawaban datang: penutupan = kejadian nyata → dihitung.
  const s = sandbox();
  s.maju(1300);
  s.picu('dokumen', 'DOMContentLoaded');
  s.picu('jendela', 'qi-chart-data');
  s.maju(1000);
  cek('layar ditutup saat sesi masih di latar → "lewat" tanpa data-lunak, bilah penuh', s.k('qiBootSesi') === 'lewat' && s.el('qiBootSesi').getAttribute('data-lunak') === null && s.bilah() === 1, s.bilah());
}

console.log('\nVerifikasi yang sudah berakhir gagal tidak disebut "di latar"');
{
  const s = sandbox();
  s.picu('jendela', 'qi-sesi', { sah: false, http: 503, ditolak: false });
  cek('5xx → "Server belum dapat memastikan sesi" (lewat), bukan "diverifikasi di latar"', s.k('qiBootSesi') === 'lewat' && s.el('qiBootSesi').anak.textContent === 'Server belum dapat memastikan sesi', s.el('qiBootSesi').anak.textContent);
  cek('hasil nyata (kejadian) → dihitung di bilah', Math.abs(s.bilah() - 1 / 3) < 1e-9, s.bilah());
}
{
  const s = sandbox();
  s.maju(1300);   // batas lunak dulu, baru kemudian jaringan gagal
  s.picu('jendela', 'qi-sesi', { sah: false, http: 0, ditolak: false });
  cek('galat jaringan setelah batas lunak → teks diganti "Server sesi tidak terjangkau"', s.k('qiBootSesi') === 'lewat' && s.el('qiBootSesi').anak.textContent === 'Server sesi tidak terjangkau', s.el('qiBootSesi').anak.textContent);
}
{
  const s = sandbox();
  s.picu('jendela', 'qi-sesi', { sah: false, http: 401, ditolak: false, kode: null });
  cek('401 tanpa kode penolakan (bukan AUTH_REQUIRED) → bukan "Sesi sudah berakhir"', s.k('qiBootSesi') === 'lewat' && !/berakhir/i.test(s.el('qiLoadStatus').textContent));
}

console.log('\nSesi ditolak server: halaman dialihkan, layar tidak mengaku "Siap"');
{
  const s = sandbox();
  s.picu('jendela', 'qi-sesi', { sah: false, http: 401, ditolak: true, kode: 'AUTH_REQUIRED' });
  cek('ditolak (401 AUTH_REQUIRED) → tahap sesi gagal (halaman dialihkan ke login)', s.k('qiBootSesi') === 'gagal' && /berakhir/i.test(s.el('qiLoadStatus').textContent));
  s.picu('dokumen', 'DOMContentLoaded');   // dokumen lama masih berjalan sampai login.html tampil
  s.picu('jendela', 'qi-chart-data');
  s.maju(3000);
  cek('…tidak menulis "Siap" dan status tetap "membuka halaman masuk"', s.el('qiLoadStatus').textContent === 'Sesi berakhir — membuka halaman masuk…', s.el('qiLoadStatus').textContent);
  cek('…tidak mengirim qi-layar-pembuka-selesai (sambutan tidak dibuka)', !s.dikirim.includes('qi-layar-pembuka-selesai') && !s.ctx.window.__qiLayarPembukaSelesai);
  cek('…layar tetap menutupi halaman yang sedang ditinggalkan', !s.el('qiLoadScreen').classList.contains('done'));
  s.maju(6000);
  cek('pengaman 8 detik tetap menutup layar (tidak pernah mengurung) tanpa "Siap"', s.el('qiLoadScreen').classList.contains('done') && s.el('qiLoadStatus').textContent !== 'Siap' && s.k('qiBootSiap') === 'lewat' && !s.dikirim.includes('qi-layar-pembuka-selesai'));
}
{
  // Penolakan datang SETELAH tutup() dijadwalkan tetapi sebelum jeda tampil habis.
  const s = sandbox();
  s.picu('dokumen', 'DOMContentLoaded');
  s.picu('jendela', 'qi-chart-data');
  s.picu('jendela', 'qi-sesi', { sah: false, http: 401, ditolak: true, kode: 'AUTH_REQUIRED' });
  s.maju(1000);
  cek('ditolak selama jeda tampil → penutupan dibatalkan, tanpa "Siap"', !s.el('qiLoadScreen').classList.contains('done') && s.el('qiLoadStatus').textContent !== 'Siap' && !s.dikirim.includes('qi-layar-pembuka-selesai'));
}
{
  const s = sandbox();
  s.picu('jendela', 'qi-sesi', { sah: false, http: 401, ditolak: true, kode: '2FA_REQUIRED' });
  cek('2FA_REQUIRED → "Verifikasi dua langkah belum selesai", bukan "Sesi sudah berakhir"', s.k('qiBootSesi') === 'gagal' && s.el('qiBootSesi').anak.textContent === 'Verifikasi dua langkah belum selesai');
}

console.log('\nData pasar nyata menutup layar');
{
  const s = sandbox();
  s.picu('jendela', 'qi-sesi', { sah: true, http: 200 });
  s.picu('dokumen', 'DOMContentLoaded');
  cek('DOMContentLoaded → tahap terminal berjalan (belum selesai)', s.k('qiBootSiap') === 'jalan');
  s.picu('jendela', 'qi-chart-data');          // data candle pertama benar-benar masuk
  s.maju(1000);
  cek('tahap data ditandai selesai', s.k('qiBootData') === 'selesai');
  cek('tahap terminal selesai saat layar ditutup', s.k('qiBootSiap') === 'selesai');
  cek('layar ditutup', s.el('qiLoadScreen').classList.contains('done'));
  cek('status akhir "Siap"', s.el('qiLoadStatus').textContent === 'Siap', s.el('qiLoadStatus').textContent);
  cek('bilah penuh hanya karena ketiga tahap selesai', s.bilah() === 1, s.bilah());
  cek('mengirim qi-layar-pembuka-selesai (sambutan menunggu ini)', s.dikirim.includes('qi-layar-pembuka-selesai'));
  s.maju(500);
  cek('elemen dilepas dari halaman', s.el('qiLoadScreen').parentNode === null);
}

console.log('\nTidak pernah mengaku data masuk bila tidak');
{
  // Tanpa data pasar sama sekali: layar tetap menutup setelah DOM siap, data = "menyusul".
  const s = sandbox();
  s.picu('dokumen', 'DOMContentLoaded');
  s.maju(2000);
  cek('tanpa data pasar pun layar tetap menutup', s.el('qiLoadScreen').classList.contains('done'));
  cek('tahap data TIDAK ditandai selesai', s.k('qiBootData') === 'lewat', s.k('qiBootData'));
  cek('teksnya "Data pasar menyusul"', s.el('qiBootData').anak.textContent === 'Data pasar menyusul', s.el('qiBootData').anak.textContent);
  cek('"Siap" hanya karena tahap terminal selesai', s.k('qiBootSiap') === 'selesai' && s.el('qiLoadStatus').textContent === 'Siap');
}
{
  const s = sandbox();
  s.picu('dokumen', 'DOMContentLoaded');
  s.picu('jendela', 'qi-chart-gagal');
  s.maju(700);
  cek('qi-chart-gagal → data "lewat" dan layar tidak menunggu 900 ms lagi', s.k('qiBootData') === 'lewat' && s.el('qiLoadScreen').classList.contains('done'));
}

console.log('\nTidak pernah mengurung pengguna');
{
  // DOM tidak pernah siap (koneksi sangat lambat) → pengaman 8 detik.
  const s = sandbox();
  s.maju(7000);
  cek('sebelum 8 detik masih menunggu', !s.el('qiLoadScreen').classList.contains('done'));
  s.maju(2000);
  cek('pengaman 8 detik menutup layar', s.el('qiLoadScreen').classList.contains('done'));
  cek('…tanpa mengaku terminal "Siap"', s.k('qiBootSiap') === 'lewat' && s.el('qiLoadStatus').textContent !== 'Siap', s.el('qiLoadStatus').textContent);
}

console.log('\nTanpa sesi tersimpan');
{
  const s = sandbox({ adaSesi: false });
  s.maju(130);
  cek('statusnya berbeda, tidak mengaku menyambung data', /halaman masuk/i.test(s.el('qiLoadStatus').textContent), s.el('qiLoadStatus').textContent);
  cek('tahap sesi tidak "selesai"', s.k('qiBootSesi') !== 'selesai');
  s.picu('dokumen', 'DOMContentLoaded');
  s.maju(2000);
  cek('DOM siap sebelum login.html tampil → tetap tanpa "Siap" dan tanpa qi-layar-pembuka-selesai', s.el('qiLoadStatus').textContent !== 'Siap' && !s.dikirim.includes('qi-layar-pembuka-selesai'));
}

console.log('\nLanjutan dari layar "Berhasil masuk" (qi_serah_masuk)');
{
  const s = sandbox({ serah: (t) => ({ v: 1, t: t - 2000, nama: 'Budi', peran: 'PRO', sumber: 'email', l2: 'tidak-aktif', l3: 'perangkat' }) });
  cek('kunci qi_serah_masuk sekali pakai (langsung dihapus)', !s.sesi.has('qi_serah_masuk'));
  cek('mode lanjutan aktif', s.el('qiLoadScreen').classList.contains('is-lanjutan'));
  cek('judul "Berhasil masuk"', s.el('qiLoadJudul').textContent === 'Berhasil masuk', s.el('qiLoadJudul').textContent);
  cek('nama & paket tampil (textContent, bukan innerHTML)', s.el('qiLoadSiapa').textContent === 'Masuk sebagai Budi · PRO' && s.el('qiLoadSiapa').hidden === false, s.el('qiLoadSiapa').textContent);
  cek('baris ringkas tahapan login tampil', s.el('qiBootMasuk').hidden === false);
  cek('…sebagai "Masuk · pemeriksaan selesai" (2FA memang terperiksa)', s.el('qiBootMasuk').getAttribute('data-keadaan') === 'selesai' && s.el('qiBootMasuk').anak.textContent === 'Masuk · pemeriksaan selesai');
  cek('bilah mulai dari 3/4 (skala login)', s.bilah() === 0.75, s.bilah());
  s.picu('jendela', 'qi-sesi', { sah: true, http: 200 });
  s.picu('dokumen', 'DOMContentLoaded');
  s.picu('jendela', 'qi-chart-data');
  s.maju(0);
  cek('tanpa jeda tampil minimum: langsung tertutup', s.el('qiLoadScreen').classList.contains('done'));
  cek('bilah penuh setelah ketiga tahap dashboard', s.bilah() === 1, s.bilah());
}
{
  const s = sandbox({ serah: (t) => ({ v: 1, t: t - 1000, nama: 'Budi', peran: 'PRO', sumber: 'license', l1: 'selesai', l2: 'tak-terperiksa', l3: 'tab' }) });
  cek('2FA tidak dapat diperiksa di login → baris ringkas "lewat", tidak mengaku "pemeriksaan selesai"', s.el('qiBootMasuk').getAttribute('data-keadaan') === 'lewat' && s.el('qiBootMasuk').anak.textContent === 'Masuk · verifikasi dua langkah tidak dapat diperiksa', s.el('qiBootMasuk').anak.textContent);
}
{
  const s = sandbox({ serah: (t) => ({ v: 1, t: t - 1000, nama: 'Budi', peran: 'PRO', sumber: 'sesi', l1: 'lewat', l2: null, l3: null }) });
  cek('sesi lama tidak dipastikan server → "Sesi lama belum dipastikan server" (lewat)', s.el('qiLoadJudul').textContent === 'Selamat datang kembali' && s.el('qiBootMasuk').getAttribute('data-keadaan') === 'lewat' && s.el('qiBootMasuk').anak.textContent === 'Sesi lama belum dipastikan server');
  const s2 = sandbox({ serah: (t) => ({ v: 1, t: t - 1000, nama: 'Budi', peran: 'PRO', sumber: 'sesi', l1: 'selesai', l2: null, l3: null }) });
  cek('sesi lama diverifikasi server → "Sesi lama diverifikasi server" (selesai)', s2.el('qiBootMasuk').getAttribute('data-keadaan') === 'selesai' && s2.el('qiBootMasuk').anak.textContent === 'Sesi lama diverifikasi server');
}
{
  const s = sandbox({ serah: (t) => ({ v: 1, t: t - 31000, nama: 'Basi', peran: 'PRO' }) });
  cek('qi_serah_masuk lebih tua dari 30 detik diabaikan', !s.el('qiLoadScreen').classList.contains('is-lanjutan') && s.el('qiLoadSiapa').hidden === true);
  cek('…dan tetap dihapus', !s.sesi.has('qi_serah_masuk'));
}
{
  const s = sandbox({ serah: () => ({ v: 2, t: 0 }) });
  cek('versi format lain diabaikan', !s.el('qiLoadScreen').classList.contains('is-lanjutan'));
}
{
  const s = sandbox({ gerakMinim: true });
  s.picu('dokumen', 'DOMContentLoaded');
  s.picu('jendela', 'qi-chart-data');
  s.maju(0);
  cek('prefers-reduced-motion: tanpa jeda tampil minimum', s.el('qiLoadScreen').classList.contains('done'));
}

console.log('\nTanpa markup layar pembuka');
{
  const kosong = { document: { getElementById: () => null, addEventListener() {} }, window: { addEventListener() {} }, setTimeout: () => 0, Date: { now: () => 0 }, localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null }, console };
  vm.createContext(kosong);
  let lempar = false;
  try { vm.runInContext(JS, kosong); } catch (e) { lempar = true; }
  cek('tidak melempar galat bila #qiLoadScreen tidak ada', !lempar);
}

console.log('\nKontrak markup');
// Penutup blok dulu penanda <!-- bundel:pemuat -->. Dashboard chart-first memuat
// halaman-dashboard-pemuat.js langsung (tanpa bundel), jadi penutupnya kini salah satu
// dari keduanya — yang diuji tetap isi layar pembukanya, bukan cara skripnya dimuat.
const blok = (HTML.match(/<div id="qiLoadScreen"[\s\S]*?(?=<!-- bundel:pemuat|<script src="assets\/js\/halaman-dashboard-pemuat)/) || [''])[0];
cek('tiga tahap ada di dashboard.html', /id="qiBootSesi"/.test(blok) && /id="qiBootData"/.test(blok) && /id="qiBootSiap"/.test(blok));
cek('teks tahapan Bahasa Indonesia', /Memverifikasi sesi/.test(blok) && /Menyambungkan data pasar/.test(blok) && /Menyiapkan terminal/.test(blok));
cek('tidak ada lagi teks Inggris lama', !/Initializing Command Center/.test(HTML) && !/Connecting to data feeds/.test(JS));
cek('status memakai aria-live agar terbaca pembaca layar', /id="qiLoadStatus"[^>]*aria-live="polite"/.test(blok));
cek('hormati prefers-reduced-motion (qim-masuk.css)', /prefers-reduced-motion: reduce/.test(CSS) && /#qiLoadScreen\.done \{ animation: none !important/.test(CSS));
cek('pesan palsu berbasis timer sudah hilang', !/msgs\s*=\s*\[/.test(JS) && !/setInterval/.test(JS));
cek('bilah tidak lagi animasi berdurasi tetap (qiBarLoad 2,4 s)', !/qiBarLoad/.test(HTML) && /--qm-kemajuan/.test(JS) && /scaleX\(var\(--qm-kemajuan/.test(CSS));
cek('kubus 3D & cincin bercahaya diganti logo merek (sama dengan login.html)', !/qi-cube/.test(HTML) && /class="qm-logo" src="assets\/img\/logo-mark\.svg"/.test(blok));
cek('blok layar pembuka tanpa <style> inline dan tanpa style="…"', !/<style/.test(blok) && !/\sstyle="/.test(blok));
cek('qim-masuk.css dimuat di <head> tepat setelah tokens.css', /tokens\.css\?v=[^"]*">\s*(<!--[^>]*-->\s*)?<link rel="stylesheet" href="assets\/css\/qim-masuk\.css\?v=/.test(HTML));
cek('teks layar pembuka ≥ 12 px (tanpa text-[8px]/[9px]/[10px])', !/text-\[(8|9|10)px\]/.test(blok));
cek('gerbang akses lama (#gateUpgrade, "SECURE CONNECTION") sudah dihapus', !/id="gateUpgrade"/.test(HTML) && !/SECURE CONNECTION/i.test(HTML) && !/Restricted Access/.test(HTML));
// Dialog sambutan ikut terhapus bersama assets/js/pro-features.js (dashboard panel lama),
// jadi pemeriksaan 'sambutan menunggu qi-layar-pembuka-selesai' tidak punya subjek lagi.
cek('awal.js: mengirim qi-sesi dari verifikasi server', /new CustomEvent\('qi-sesi'/.test(AWAL));

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — layar pembuka: tahapan nyata, tidak mengurung, Bahasa Indonesia');
process.exit(gagal ? 1 : 0);
