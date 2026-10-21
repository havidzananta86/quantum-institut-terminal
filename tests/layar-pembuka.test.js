/**
 * Layar pembuka dashboard (#qiLoadScreen).
 *
 * Versi sebelumnya memutar tiga pesan berbahasa Inggris setiap 600 ms tanpa hubungan
 * dengan apa pun yang sedang terjadi — kemajuan palsu, persis jenis klaim yang
 * dibersihkan dari bagian lain produk ini. Di sini dikunci bahwa tiap tahap menyala
 * karena peristiwanya benar-benar terjadi, dan layarnya TIDAK PERNAH mengurung pengguna.
 *
 * Run:  node tests/layar-pembuka.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const JS = fs.readFileSync(path.join(root, 'assets/js/halaman-dashboard-pemuat.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

// ── DOM & jam tiruan ────────────────────────────────────────────────────────
function sandbox({ adaSesi = true, readyState = 'loading' } = {}) {
  const el = {};
  const ambil = (id) => (el[id] = el[id] || { id, textContent: '', className: '', parentNode: null, remove() { this.parentNode = null; }, classList: { _s: new Set(), add(k) { this._s.add(k); }, contains(k) { return this._s.has(k); } } });
  ambil('qiLoadScreen').parentNode = {};
  const timer = [];
  const pendengar = { dokumen: {}, jendela: {} };
  let waktu = 1000;
  const ctx = {
    document: {
      getElementById: ambil,
      readyState,
      addEventListener: (n, f) => { (pendengar.dokumen[n] = pendengar.dokumen[n] || []).push(f); },
    },
    window: { addEventListener: (n, f) => { (pendengar.jendela[n] = pendengar.jendela[n] || []).push(f); } },
    localStorage: { getItem: () => (adaSesi ? 'tok' : null) },
    sessionStorage: { getItem: () => null },
    setTimeout: (f, ms) => { timer.push({ f, pada: waktu + (ms || 0) }); return timer.length; },
    Date: { now: () => waktu },
    console,
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
  const picu = (jenis, nama) => (pendengar[jenis][nama] || []).forEach((f) => f());
  return { ctx, el: ambil, maju, picu, timer };
}

console.log('Tahapan mengikuti kejadian nyata');
{
  const s = sandbox();
  cek('tahap sesi langsung berjalan', s.el('qiBootSesi').className.includes('is-jalan'));
  cek('status awal dalam Bahasa Indonesia', /Memverifikasi sesi/.test(s.el('qiLoadStatus').textContent), s.el('qiLoadStatus').textContent);
  s.maju(130);
  cek('sesi selesai → tahap data berjalan', s.el('qiBootSesi').className.includes('is-selesai') && s.el('qiBootData').className.includes('is-jalan'));
  cek('status berubah ke data pasar', /data pasar/i.test(s.el('qiLoadStatus').textContent), s.el('qiLoadStatus').textContent);
  cek('layar BELUM ditutup sebelum DOM siap', !s.el('qiLoadScreen').classList.contains('done'));
}

console.log('\nData pasar nyata menutup layar');
{
  const s = sandbox();
  s.maju(130);
  s.picu('dokumen', 'DOMContentLoaded');
  s.picu('jendela', 'qi-chart-data');          // data candle pertama benar-benar masuk
  s.maju(1000);
  cek('tahap data ditandai selesai', s.el('qiBootData').className.includes('is-selesai'));
  cek('layar ditutup', s.el('qiLoadScreen').classList.contains('done'));
  cek('status akhir "Siap"', s.el('qiLoadStatus').textContent === 'Siap', s.el('qiLoadStatus').textContent);
  s.maju(500);
  cek('elemen dilepas dari halaman', s.el('qiLoadScreen').parentNode === null);
}

console.log('\nTidak pernah mengurung pengguna');
{
  // Tanpa data pasar sama sekali: layar tetap menutup setelah DOM siap.
  const s = sandbox();
  s.maju(130);
  s.picu('dokumen', 'DOMContentLoaded');
  s.maju(2000);
  cek('tanpa data pasar pun layar tetap menutup', s.el('qiLoadScreen').classList.contains('done'));
}
{
  // DOM tidak pernah siap (koneksi sangat lambat) → pengaman 8 detik.
  const s = sandbox();
  s.maju(7000);
  cek('sebelum 8 detik masih menunggu', !s.el('qiLoadScreen').classList.contains('done'));
  s.maju(2000);
  cek('pengaman 8 detik menutup layar', s.el('qiLoadScreen').classList.contains('done'));
}

console.log('\nTanpa sesi tersimpan');
{
  const s = sandbox({ adaSesi: false });
  s.maju(130);
  cek('statusnya berbeda, tidak mengaku menyambung data', /halaman masuk/i.test(s.el('qiLoadStatus').textContent), s.el('qiLoadStatus').textContent);
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
cek('tiga tahap ada di dashboard.html', /id="qiBootSesi"/.test(HTML) && /id="qiBootData"/.test(HTML) && /id="qiBootSiap"/.test(HTML));
cek('teks tahapan Bahasa Indonesia', /Memverifikasi sesi/.test(HTML) && /Menyambungkan data pasar/.test(HTML) && /Menyiapkan terminal/.test(HTML));
cek('tidak ada lagi teks Inggris lama', !/Initializing Command Center/.test(HTML) && !/Connecting to data feeds/.test(JS));
cek('status memakai aria-live agar terbaca pembaca layar', /id="qiLoadStatus"[^>]*aria-live="polite"/.test(HTML));
cek('hormati prefers-reduced-motion', /prefers-reduced-motion: reduce/.test(HTML));
cek('pesan palsu berbasis timer sudah hilang', !/msgs\s*=\s*\[/.test(JS));

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — layar pembuka: tahapan nyata, tidak mengurung, Bahasa Indonesia');
process.exit(gagal ? 1 : 0);
