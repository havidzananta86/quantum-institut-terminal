/**
 * Animasi "Berhasil masuk" (login.html → dashboard.html).
 *
 * Dulu: toast di pojok, timer tetap 800 ms, tombol membeku pada "Memeriksa…", lalu layar
 * pembuka dashboard dengan kemajuan palsu. Sekarang satu alur bersambung yang tiap tahapnya
 * dipicu kejadian nyata. Di sini dikunci:
 *   - tahap & bilah hanya berubah lewat QimMasuk.tandai, dipanggil dari kejadian nyata;
 *   - tanpa setInterval, dan timer tidak pernah mengubah teks/keadaan tahap;
 *   - jeda tambahan ≤ 450 ms, dan 0 saat prefers-reduced-motion;
 *   - saveSession gagal → tidak pindah halaman;
 *   - Google memakai (dan menghapus) qi_redirect_after_login;
 *   - saveSession membersihkan penyimpanan lain (putaran login karena token basi);
 *   - qi_serah_masuk basi (> 30 detik) diabaikan;
 *   - teks Bahasa Indonesia, tanpa "Login berhasil" / "SECURE" / "256-bit".
 *
 * Run:  node tests/animasi-masuk.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const AUTH = baca('assets/js/auth.js');
const DUA = baca('assets/js/qim-2fa-login.js');
const ANIM = baca('assets/js/qim-masuk-animasi.js');
const LOGIN = baca('assets/js/halaman-login.js');
const KEPALA = baca('assets/js/halaman-login-kepala.js');
// Gerbang sesi pindah ke assets/js/qim-terminal-gate.js saat dashboard panel lama dihapus.
const AWAL = baca('assets/js/qim-terminal-gate.js');
const PEMUAT = baca('assets/js/halaman-dashboard-pemuat.js');
const HTML = baca('login.html');
const DASH = baca('dashboard.html');
const CSS = baca('assets/css/qim-masuk.css');
const INDEX = baca('index.html');
const IDXJS = baca('assets/js/halaman-index.js');
const REG = baca('assets/js/halaman-register.js');

let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};
const flush = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

// ── Penyimpanan tiruan ──────────────────────────────────────────────────────
function penyimpanan(awal = {}, { tolak = false, abaikan = false } = {}) {
  const m = new Map(Object.entries(awal));
  return {
    _m: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (tolak) throw new Error('QuotaExceededError'); if (!abaikan) m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// ── DOM tiruan secukupnya ───────────────────────────────────────────────────
function buatDom() {
  const el = {};
  const dokPendengar = {};
  let fokus = null;
  const buat = (id) => {
    const e = {
      id, hidden: false, textContent: '', value: '', checked: false, type: '', _html: '',
      attr: {}, gaya: {}, pendengar: {}, dataset: {},
      anak: { textContent: '' },
      get innerHTML() { return this._html; },
      set innerHTML(v) { this._html = String(v); },
      setAttribute(k, v) { this.attr[k] = String(v); },
      getAttribute(k) { return k in this.attr ? this.attr[k] : null; },
      removeAttribute(k) { delete this.attr[k]; },
      hasAttribute(k) { return k in this.attr; },
      querySelector(sel) { return sel === '.qm-teks' ? this.anak : null; },
      style: { setProperty(k, v) { e.gaya[k] = v; } },
      addEventListener(n, f) { (this.pendengar[n] = this.pendengar[n] || []).push(f); },
      klik() { (this.pendengar.click || []).forEach((f) => f({ preventDefault() {}, target: this })); },
      focus() { fokus = id; },
      select() {},
      getBoundingClientRect() { return { left: 100, top: 200, width: 300, height: 44 }; },
      classList: { _s: new Set(), add(k) { this._s.add(k); }, remove(k) { this._s.delete(k); }, contains(k) { return this._s.has(k); } },
      remove() {},
    };
    return e;
  };
  const ambil = (id) => (el[id] = el[id] || buat(id));
  // Keadaan awal = markup login.html
  ['qmLayar', 'qmSiapa', 'qmAksi', 'qmPemberitahuan', 'googleAuthSection', 'googleStatus', 'googleGsiButton', 'galatLicense', 'galatEmail', 'formEmail', 'qmSesiAktif']
    .forEach((id) => { ambil(id).hidden = true; });
  ['qmL1', 'qmL2', 'qmL3', 'qmL4'].forEach((id) => ambil(id).setAttribute('data-keadaan', 'tunggu'));
  ambil('rememberMeLicense').checked = true;
  ambil('rememberMeEmail').checked = true;
  ambil('btnSubmitLicense').innerHTML = '<svg></svg><span>Masuk</span>';
  ambil('btnSubmitEmail').innerHTML = '<svg></svg><span>Masuk</span>';
  ambil('passwordInput').type = 'password';
  const akar = buat('html');
  const document = {
    documentElement: akar,
    head: { appendChild() {} },
    body: { appendChild() {}, contains() { return false; } },
    getElementById: ambil,
    querySelector: (sel) => (sel === '.pb-kepala' || sel === '.pb-kaki' ? ambil(sel) : null),
    querySelectorAll: () => [],
    createElement: () => buat('baru'),
    addEventListener: (n, f) => { (dokPendengar[n] = dokPendengar[n] || []).push(f); },
    removeEventListener() {},
    dispatchEvent: (ev) => { (dokPendengar[ev.type] || []).forEach((f) => f(ev)); return true; },
    get activeElement() { return fokus ? ambil(fokus) : null; },
  };
  return { el: ambil, document, dokPendengar, fokus: () => fokus, akar };
}

// ── Satu halaman login.html di sandbox ──────────────────────────────────────
function halamanLogin(o = {}) {
  const dom = buatDom();
  const jendelaPendengar = {};
  const timer = [], interval = [], toast = [], ganti = [], panggilan = [];
  let waktu = 5000000;
  const ls = o.ls || penyimpanan(o.lsAwal || {}, o.lsOpsi || {});
  const ss = o.ss || penyimpanan(o.ssAwal || {}, o.ssOpsi || {});
  const tahan = {};
  const jawab = (http, body) => ({ ok: http >= 200 && http < 300, status: http, json: () => Promise.resolve(body) });
  const fetch = (url, init = {}) => {
    const badan = init.body ? JSON.parse(init.body) : {};
    panggilan.push({ url, badan, init });
    if (url === 'api/auth-config.php') {
      if (o.konfigGagal) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(jawab(200, { status: 'success', data: o.konfig || { google_enabled: false, google_client_id: '' } }));
    }
    if (url === 'api/auth.php' && badan.type === 'verify_token') {
      const v = o.verify || { http: 200, body: { status: 'success', data: { role: 'pro' } } };
      return Promise.resolve(jawab(v.http, v.body));
    }
    if (url === 'api/auth.php') {
      const m = o.masuk || { http: 200, body: { status: 'success', data: { token: 'TOKEN-BARU', user_id: 7, email: 'budi@contoh.id', role: 'pro', full_name: 'Budi Santoso' } } };
      if (o.tahanMasuk) return new Promise((r) => { tahan.lepas = () => r(jawab(m.http, m.body)); });
      return Promise.resolve(jawab(m.http, m.body));
    }
    if (url.indexOf('api/keamanan.php?aksi=status_login') === 0) {
      if (o.status2fa === 'putus') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(jawab(200, o.status2fa || { status: 'success', perlu_2fa: false, sesi_sah: true }));
    }
    if (url === 'api/logout.php') return Promise.resolve(jawab(200, { status: 'success' }));
    return Promise.reject(new Error('rute tidak dikenal: ' + url));
  };
  const ctx = {
    document: dom.document,
    localStorage: ls,
    sessionStorage: ss,
    location: { href: 'http://127.0.0.1:8091/login.html', origin: 'http://127.0.0.1:8091', pathname: '/login.html', search: '', hash: '', replace: (u) => ganti.push(u) },
    fetch,
    URL,
    JSON, Math, String, Promise, Object, Array, WeakMap, Number,
    AbortSignal: o.tanpaTimeout ? {} : { timeout: (ms) => ({ batas: ms }) },
    AbortController: function () { this.signal = { cadangan: true }; this.abort = () => {}; },
    CustomEvent: function (type, opsi) { this.type = type; this.detail = opsi && opsi.detail; },
    Date: { now: () => waktu },
    setTimeout: (f, ms) => { timer.push({ f, ms: ms || 0, pada: waktu + (ms || 0) }); return timer.length; },
    clearTimeout() {},
    setInterval: (f, ms) => { interval.push(ms); return 0; },
    matchMedia: (q) => ({ matches: !!o.gerakMinim && /reduce/.test(q) }),
    showQuantumToast: (pesan, jenis) => toast.push({ pesan, jenis }),
    addEventListener: (n, f) => { (jendelaPendengar[n] = jendelaPendengar[n] || []).push(f); },
    console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(KEPALA, ctx);
  vm.runInContext(AUTH, ctx);
  vm.runInContext(DUA, ctx);
  vm.runInContext(ANIM, ctx);
  // Catat setiap panggilan tandai() untuk membuktikan tahap hanya berubah lewat sana.
  const tandaiLog = [];
  const asli = ctx.QimMasuk.tandai;
  ctx.QimMasuk.tandai = function (id, k, t) { tandaiLog.push([id, k, t]); return asli.apply(this, arguments); };
  if (o.duaLangkah) ctx.QimDuaLangkah = o.duaLangkah;
  vm.runInContext(LOGIN, ctx);
  const maju = (ms) => {
    waktu += ms;
    for (let i = 0; i < 50; i++) {
      const due = timer.filter((t) => !t.sudah && t.pada <= waktu);
      if (!due.length) break;
      due.forEach((t) => { t.sudah = true; t.f(); });
    }
  };
  const kirim = (jenis) => vm.runInContext(`handleLoginSubmit({ preventDefault() {} }, '${jenis}')`, ctx);
  const tahap = () => ['qmL1', 'qmL2', 'qmL3', 'qmL4'].map((id) => [id, dom.el(id).getAttribute('data-keadaan'), dom.el(id).anak.textContent, dom.el(id).hidden]);
  const picuJendela = (n, ev) => (jendelaPendengar[n] || []).forEach((f) => f(ev));
  return { ctx, dom, el: dom.el, ls, ss, timer, interval, toast, ganti, panggilan, maju, kirim, tahap, tandaiLog, tahan, picuJendela, waktu: () => waktu };
}

(async () => {
  console.log('Masuk dengan kunci lisensi: urutan kejadian nyata');
  {
    const h = halamanLogin({ ssAwal: { qi_redirect_after_login: 'dashboard.html?panel=panel-signal#atas' } });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    const janji = h.kirim('license');
    await flush();
    const panggilanMasuk = h.panggilan.filter((p) => p.url === 'api/auth.php' && p.badan.type === 'license');
    cek('kredensial dikirim ke api/auth.php dengan batas waktu', panggilanMasuk.length === 1 && !!panggilanMasuk[0].init.signal);
    cek('status_login diperiksa SETELAH server menerima kredensial', h.panggilan.findIndex((p) => /status_login/.test(p.url)) > h.panggilan.indexOf(panggilanMasuk[0]));
    cek('layar "Berhasil masuk" tampil', h.el('qmLayar').hidden === false && h.el('qmJudul').textContent === 'Berhasil masuk');
    cek('"Masuk sebagai <nama> · PRO" (nama di-escape)', /Masuk sebagai <b>Budi Santoso<\/b> · <span class="qm-peran" data-peran="pro">PRO<\/span>/.test(h.el('qmSiapa').innerHTML), h.el('qmSiapa').innerHTML);
    const t = h.tahap();
    cek('L1 "Kunci lisensi valid" selesai', t[0][1] === 'selesai' && t[0][2] === 'Kunci lisensi valid', t[0]);
    cek('L2 "Verifikasi dua langkah: tidak aktif" selesai', t[1][1] === 'selesai' && t[1][2] === 'Verifikasi dua langkah: tidak aktif', t[1]);
    cek('L3 "Sesi disimpan di perangkat ini" selesai', t[2][1] === 'selesai' && t[2][2] === 'Sesi disimpan di perangkat ini', t[2]);
    cek('L4 "Membuka terminal…" masih berjalan', t[3][1] === 'jalan' && t[3][2] === 'Membuka terminal…', t[3]);
    cek('bilah = 3/4 (tahap selesai / jumlah tahap)', h.el('qmLayar').gaya['--qm-kemajuan'] === '0.75', h.el('qmLayar').gaya['--qm-kemajuan']);
    cek('tombol berubah "Berhasil" (aria-disabled, tidak diredupkan disabled)', h.el('btnSubmitLicense').getAttribute('data-keadaan') === 'sukses' && /Berhasil/.test(h.el('btnSubmitLicense').innerHTML) && h.el('btnSubmitLicense').getAttribute('aria-disabled') === 'true' && h.el('btnSubmitLicense').disabled !== true);
    cek('fokus pindah ke judul layar', h.dom.fokus() === 'qmJudul', h.dom.fokus());
    cek('latar dibuat inert', h.el('utama').hasAttribute('inert') && h.el('.pb-kepala').hasAttribute('inert'));
    cek('belum pindah halaman sebelum jeda tampil minimum', h.ganti.length === 0);
    const tertunda = h.timer.filter((x) => !x.sudah);
    cek('hanya SATU timer: jeda tampil ≤ 450 ms', tertunda.length === 1 && tertunda[0].ms <= 450, tertunda.map((x) => x.ms));
    const sebelum = JSON.stringify(h.tahap());
    const jumlahTandai = h.tandaiLog.length;
    h.maju(450);
    await janji;
    cek('timer tidak mengubah tahap mana pun', JSON.stringify(h.tahap()) === sebelum && h.tandaiLog.length === jumlahTandai);
    cek('location.replace (bukan href) ke tautan dalam yang diminta, ?panel= & #hash utuh', h.ganti.length === 1 && h.ganti[0] === '/dashboard.html?panel=panel-signal#atas', h.ganti);
    cek('qi_redirect_after_login dihapus setelah dipakai', h.ss.getItem('qi_redirect_after_login') === null);
    const serah = JSON.parse(h.ss.getItem('qi_serah_masuk') || '{}');
    cek('qi_serah_masuk {v:1, t, nama, peran, sumber, l2, l3} untuk layar pembuka dashboard', serah.v === 1 && serah.t === h.waktu() && serah.nama === 'Budi Santoso' && serah.peran === 'PRO' && serah.sumber === 'license' && serah.l2 === 'tidak-aktif' && serah.l3 === 'perangkat', serah);
    cek('sesi tersimpan di localStorage (Ingat perangkat ini)', h.ls.getItem('qi_token') === 'TOKEN-BARU' && h.ls.getItem('qi_user_name') === 'Budi Santoso');
    cek('tanpa setInterval', h.interval.length === 0);
    cek('tanpa toast "Berhasil masuk" (diganti layar)', !h.toast.some((x) => x.jenis === 'success'));
    const semuaTahap = new Set(h.tandaiLog.map((x) => x[0]));
    cek('setiap tahap yang berubah tercatat di QimMasuk.tandai', ['qmL1', 'qmL2', 'qmL3', 'qmL4'].every((id) => semuaTahap.has(id)));
  }

  console.log('\nGerak-minimal (prefers-reduced-motion)');
  {
    const h = halamanLogin({ gerakMinim: true });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    await h.kirim('license');
    cek('jeda tambahan 0: langsung pindah tanpa timer', h.ganti.length === 1 && h.timer.filter((x) => !x.sudah).length === 0, { ganti: h.ganti, timer: h.timer.map((x) => x.ms) });
    cek('tanpa animasi tumbuh (data-buka tidak dipasang)', !h.el('qmLayar').hasAttribute('data-buka'));
  }

  console.log('\nPutaran login karena token basi (saveSession membersihkan penyimpanan lain)');
  {
    const h = halamanLogin({ lsAwal: { qi_token: 'BASI-DARI-DULU', qi_user: '{"role":"free"}' }, verify: { http: 401, body: { status: 'error', code: 'AUTH_REQUIRED' } } });
    await flush();
    cek('token basi → kartu "masih masuk" diperiksa ke server; 401 → sesi dihapus', h.ls.getItem('qi_token') === null && !h.dom.akar.hasAttribute('data-qm-sesi'));
    cek('…dan formulir kembali dengan alasannya', h.el('qmPemberitahuan').hidden === false && /sudah berakhir/.test(h.el('qmPemberitahuan').textContent));
    cek('…dan fokus pindah dari kartu yang disembunyikan ke isian formulir (bukan <body>)', h.dom.fokus() === 'licenseKey', h.dom.fokus());
  }
  {
    // Gangguan server (503 / 401 tanpa kode penolakan) BUKAN bukti sesi tidak berlaku.
    for (const v of [{ http: 503, body: { status: 'error', code: 'DB_UNAVAILABLE' } }, { http: 401, body: { status: 'error', message: 'x' } }]) {
      const h = halamanLogin({ lsAwal: { qi_token: 'MASIH-SAH', qi_user: '{"role":"pro"}' }, verify: v });
      await flush();
      cek(`kartu "masih masuk": HTTP ${v.http}${v.body.code ? ' ' + v.body.code : ' tanpa kode'} → token TIDAK dihapus, kartu tetap`,
        h.ls.getItem('qi_token') === 'MASIH-SAH' && h.dom.akar.getAttribute('data-qm-sesi') === 'ada' && /belum dapat memastikan/.test(h.el('qmSesiStatus').textContent), h.el('qmSesiStatus').textContent);
    }
  }
  {
    const h = halamanLogin();
    const QA = h.ctx.QuantumAuth;
    h.ls.setItem('qi_token', 'BASI');
    h.ls.setItem('qi_user', '{"role":"vip"}');
    const ok = QA.saveSession('BARU', { role: 'free', email: 'a@b.c' }, false);
    cek('remember=false: localStorage lama dihapus, token baru terbaca', ok === true && h.ls.getItem('qi_token') === null && h.ls.getItem('qi_user') === null && QA.getToken() === 'BARU');
    h.ss.setItem('qi_token', 'TAB-LAMA');
    const ok2 = QA.saveSession('BARU-2', { role: 'pro' }, true);
    cek('remember=true: sessionStorage lama dihapus', ok2 === true && h.ss.getItem('qi_token') === null && QA.getToken() === 'BARU-2');
    QA.hapusSesi();
    cek('hapusSesi() mengosongkan kedua penyimpanan', QA.getToken() === null && h.ss.getItem('qi_user') === null && h.ls.getItem('qi_user_name') === null);
  }
  {
    const h = halamanLogin({ lsOpsi: { abaikan: true } });
    cek('penyimpanan yang diam-diam tidak menyimpan → saveSession false (dibaca ulang)', h.ctx.QuantumAuth.saveSession('X', {}, true) === false);
  }
  {
    // qi_token tertulis, lalu qi_user kena kuota → token tidak boleh tertinggal (sesinya dibuang di server).
    const ls = penyimpanan();
    const setAsli = ls.setItem;
    ls.setItem = (k, v) => { if (k === 'qi_user') throw new Error('QuotaExceededError'); setAsli(k, v); };
    const h = halamanLogin({ ls });
    const ok = h.ctx.QuantumAuth.saveSession('SEPARUH', { role: 'pro' }, true);
    cek('saveSession gagal di tengah jalan → false DAN token yang sempat tertulis dihapus lagi', ok === false && ls.getItem('qi_token') === null && h.ctx.QuantumAuth.getToken() === null);
  }

  console.log('\nsaveSession gagal → tidak pindah halaman');
  {
    const h = halamanLogin({ lsOpsi: { tolak: true }, ssOpsi: { tolak: true } });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    await h.kirim('license');
    await flush();
    cek('tidak ada location.replace', h.ganti.length === 0);
    cek('tidak ada timer jeda (tidak ada perpindahan yang ditunggu)', h.timer.filter((x) => !x.sudah).length === 0);
    cek('layar dalam keadaan galat dengan pesan jelas', h.el('qmLayar').getAttribute('data-keadaan') === 'gagal' && /Browser menolak menyimpan sesi/.test(h.el('qmStatus').textContent), h.el('qmStatus').textContent);
    cek('L3 gagal, L4 disembunyikan', h.el('qmL3').getAttribute('data-keadaan') === 'gagal' && h.el('qmL4').hidden === true);
    cek('tombol "Kembali" tampil dan difokus', h.el('qmAksi').hidden === false && h.dom.fokus() === 'qmKembali');
    cek('sesi server yatim dibuang (api/logout.php)', h.panggilan.some((p) => p.url === 'api/logout.php'));
    cek('tombol masuk dipulihkan', !h.el('btnSubmitLicense').hasAttribute('data-keadaan') && h.el('btnSubmitLicense').innerHTML === '<svg></svg><span>Masuk</span>');
    h.el('qmKembali').klik();
    cek('"Kembali" menutup layar dan melepas inert', h.el('qmLayar').hidden === true && !h.el('utama').hasAttribute('inert'));
    cek('…dan fokus kembali ke tombol yang tadi ditekan (bukan "Kembali" yang ikut tersembunyi)', h.dom.fokus() === 'btnSubmitLicense', h.dom.fokus());
  }

  console.log('\nVerifikasi dua langkah');
  {
    const h = halamanLogin({ duaLangkah: { selesaikan: () => Promise.resolve({ ok: false, perlu2fa: true }) } });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    await h.kirim('license');
    cek('dibatalkan → tidak pindah, layar tidak dibuka', h.ganti.length === 0 && h.el('qmLayar').hidden === true);
    cek('galat sebaris "Masuk dibatalkan…" (bukan "Login dibatalkan")', h.el('galatLicense').hidden === false && /^Masuk dibatalkan/.test(h.el('galatLicense').textContent));
    cek('sesi tidak disimpan', h.ls.getItem('qi_token') === null);
  }
  {
    const h = halamanLogin({ status2fa: 'putus' });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    const janji = h.kirim('license');
    await flush();
    cek('status_login dicoba tepat 2 kali (batas 4 detik + satu ulang)', h.panggilan.filter((p) => /status_login/.test(p.url)).length === 2);
    cek('…lalu ditulis apa adanya: "tidak dapat diperiksa" (lewat)', h.el('qmL2').getAttribute('data-keadaan') === 'lewat' && /tidak dapat diperiksa/.test(h.el('qmL2').anak.textContent));
    h.maju(450);
    await janji;
    cek('tahap lewat tetap dihitung tuntas di bilah dan masuk tetap berlanjut', h.ganti.length === 1);
  }
  {
    const h = halamanLogin({ status2fa: { status: 'success', perlu_2fa: true, smtp: true, email: 'b***@contoh.id' }, duaLangkah: { selesaikan: () => Promise.resolve({ ok: true, perlu2fa: true }) } });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    const janji = h.kirim('license');
    await flush();
    cek('kode diterima → "Verifikasi dua langkah: kode diterima"', h.el('qmL2').anak.textContent === 'Verifikasi dua langkah: kode diterima');
    h.maju(450); await janji;
  }

  console.log('\nGoogle: progres terlihat dan tujuan bersama');
  {
    const h = halamanLogin({ tahanMasuk: true, ssAwal: { qi_redirect_after_login: 'kompetisi.html', qi_serah_masuk: '{"v":1,"t":0}' } });
    const janji = vm.runInContext("handleGoogleCredential({ credential: 'kredensial-google' })", h.ctx);
    await flush();
    cek('selama POST: "Memeriksa akun Google…" (role=status)', h.el('googleStatus').hidden === false && /Memeriksa akun Google…/.test(h.el('googleStatus').innerHTML));
    h.tahan.lepas();
    await flush();
    cek('L1 "Akun Google terverifikasi"', h.el('qmL1').anak.textContent === 'Akun Google terverifikasi');
    cek('L4 menyebut tujuan: "Membuka Arena Kompetisi…"', h.el('qmL4').anak.textContent === 'Membuka Arena Kompetisi…', h.el('qmL4').anak.textContent);
    cek('qi_redirect_after_login dipakai & dihapus (tidak lagi selalu dashboard.html)', h.ss.getItem('qi_redirect_after_login') === null);
    h.maju(450); await janji;
    cek('location.replace ke kompetisi.html', h.ganti.length === 1 && /kompetisi\.html$/.test(h.ganti[0]), h.ganti);
    cek('qi_serah_masuk TIDAK ditulis untuk tujuan selain dashboard.html (kunci lama juga dihapus)', h.ss.getItem('qi_serah_masuk') === null, h.ss.getItem('qi_serah_masuk'));
  }
  {
    const h = halamanLogin({ ssAwal: { qi_redirect_after_login: 'https://penipu.example/curi' } });
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    const janji = h.kirim('license');
    await flush(); h.maju(450); await janji;
    cek('tujuan di origin lain ditolak → dashboard.html', h.ganti[0] === 'dashboard.html', h.ganti);
  }
  {
    const h = halamanLogin({ konfig: { google_enabled: false } });
    await flush();
    cek('Google belum aktif → bagian Google tetap tersembunyi', h.el('googleAuthSection').hidden === true);
    const h2 = halamanLogin({ konfigGagal: true });
    await flush();
    cek('konfigurasi tak terjangkau → tetap tersembunyi (tidak mengaku "belum diaktifkan admin")', h2.el('googleAuthSection').hidden === true);
    const h3 = halamanLogin({ konfig: { google_enabled: true, google_client_id: 'abc.apps.googleusercontent.com' } });
    await flush();
    cek('Google aktif → bagian Google ditampilkan', h3.el('googleAuthSection').hidden === false);
  }

  console.log('\nGalat sebaris Bahasa Indonesia (novalidate)');
  {
    const h = halamanLogin();
    await h.kirim('license');
    cek('kunci kosong → galat sebaris, tanpa memanggil server', h.el('galatLicense').hidden === false && /Masukkan kunci lisensi/.test(h.el('galatLicense').textContent) && !h.panggilan.some((p) => p.badan.type === 'license'));
    cek('fokus ke isian yang salah + aria-invalid', h.dom.fokus() === 'licenseKey' && h.el('licenseKey').getAttribute('aria-invalid') === 'true' && h.el('licenseKey').getAttribute('aria-describedby') === 'galatLicense');
    h.el('emailInput').value = 'bukan-email';
    await h.kirim('email');
    cek('email tidak valid → "Format email belum benar…"', /Format email belum benar/.test(h.el('galatEmail').textContent) && h.dom.fokus() === 'emailInput');
  }
  {
    const h = halamanLogin({ masuk: { http: 401, body: { status: 'error', message: 'Email atau kata sandi tidak valid.' } } });
    h.el('emailInput').value = 'budi@contoh.id';
    h.el('passwordInput').value = 'salah';
    await h.kirim('email');
    cek('401 → pesan server sebaris, fokus ke sandi, tombol pulih, tidak pindah', /tidak valid/.test(h.el('galatEmail').textContent) && h.dom.fokus() === 'passwordInput' && !h.el('btnSubmitEmail').hasAttribute('aria-disabled') && h.ganti.length === 0);
    cek('kotak "Ingat perangkat ini" juga untuk email', /id="rememberMeEmail"/.test(HTML));
  }

  console.log('\nSudah masuk: kartu, bukan formulir');
  {
    const h = halamanLogin({ lsAwal: { qi_token: 'MASIH-SAH', qi_user: JSON.stringify({ full_name: 'Sari <b>', role: 'vip' }) } });
    cek('skrip kepala menandai <html data-qm-sesi="ada"> sebelum tergambar', h.dom.akar.getAttribute('data-qm-sesi') === 'ada');
    cek('"Anda masih masuk sebagai <nama> · VIP" (nama di-escape)', /Anda masih masuk sebagai <b>Sari &lt;b&gt;<\/b> · <span class="qm-peran" data-peran="vip">VIP<\/span>/.test(h.el('qmSesiSiapa').innerHTML), h.el('qmSesiSiapa').innerHTML);
    cek('"Lanjut ke terminal" difokus', h.dom.fokus() === 'btnLanjutSesi' && h.el('btnLanjutLabel').textContent === 'Lanjut ke terminal');
    await flush();
    cek('server membenarkan sesi → kartu tetap', h.dom.akar.getAttribute('data-qm-sesi') === 'ada' && h.el('qmSesiStatus').textContent === 'Sesi masih berlaku.');
    const janji = vm.runInContext('lanjutSesi()', h.ctx);
    await flush();
    cek('Lanjut → layar yang sama; L2/L3 disembunyikan', h.el('qmLayar').hidden === false && h.el('qmL2').hidden && h.el('qmL3').hidden);
    cek('L1 "Sesi lama masih berlaku (diverifikasi server)"', h.el('qmL1').getAttribute('data-keadaan') === 'selesai' && h.el('qmL1').anak.textContent === 'Sesi lama masih berlaku (diverifikasi server)');
    cek('bilah = 1/2 (dua tahap tampil)', h.el('qmLayar').gaya['--qm-kemajuan'] === '0.5', h.el('qmLayar').gaya['--qm-kemajuan']);
    h.maju(450); await janji;
    cek('location.replace ke dashboard.html', h.ganti[0] === 'dashboard.html');
    cek('tidak membuat sesi server baru (tidak POST kredensial)', !h.panggilan.some((p) => p.url === 'api/auth.php' && p.badan.type !== 'verify_token'));
  }

  console.log('\nAlasan datang ke halaman masuk');
  {
    const h = halamanLogin({ ssAwal: { qi_alasan_masuk: 'sesi_berakhir' } });
    cek('"Sesi Anda sudah berakhir. Silakan masuk lagi."', h.el('qmPemberitahuan').hidden === false && h.el('qmPemberitahuan').textContent === 'Sesi Anda sudah berakhir. Silakan masuk lagi.');
    cek('alasan hanya tampil sekali (kunci dihapus)', h.ss.getItem('qi_alasan_masuk') === null);
    const k = halamanLogin({ ssAwal: { qi_alasan_masuk: 'keluar' } });
    cek('"Anda sudah keluar."', k.el('qmPemberitahuan').textContent === 'Anda sudah keluar.');
    const l = halamanLogin({ ls: penyimpanan({ qi_token: 'X' }) });
    await flush();
    l.ctx.location.href = 'http://127.0.0.1:8091/login.html';
    await l.ctx.QuantumAuth.logout();
    cek('logout() menandai alasan "keluar" dan mengosongkan sesi', l.ss.getItem('qi_alasan_masuk') === 'keluar' && l.ctx.QuantumAuth.getToken() === null);
  }

  console.log('\nBack-forward cache');
  {
    const h = halamanLogin();
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    const janji = h.kirim('license');
    await flush(); h.maju(450); await janji;
    h.picuJendela('pageshow', { persisted: true });
    cek('pageshow (persisted) → layar & tombol direset', h.el('qmLayar').hidden === true && !h.el('btnSubmitLicense').hasAttribute('data-keadaan'));
  }

  console.log('\nAbortSignal.timeout tidak tersedia (Safari/iOS < 16)');
  {
    const h = halamanLogin({ tanpaTimeout: true });
    const s = h.ctx.QuantumAuth.batasWaktu(10000);
    cek('QuantumAuth.batasWaktu memakai AbortController + setTimeout', s && s.cadangan === true && h.timer.some((x) => x.ms === 10000));
    cek('tidak ada lagi AbortSignal.timeout(angka) langsung di login/auth/register/2FA',
      ![LOGIN, AUTH, REG, DUA].some((s2) => /AbortSignal\.timeout\(\d/.test(s2)));
  }

  console.log('\nPesan koneksi login saat halaman dibuka sebagai file');
  {
    const h = halamanLogin();
    h.ctx.location.protocol = 'file:';
    h.el('licenseKey').value = 'QI-PRO-ABCDEF';
    await h.kirim('license');
    cek('file:// menjelaskan bahwa login harus dibuka lewat localhost', /localhost\/webapp\/login\.html/.test(h.el('galatLicense').textContent), h.el('galatLicense').textContent);
  }

  console.log('\nLayar pembuka dashboard: qi_serah_masuk basi diabaikan');
  {
    const jalan = (umur) => {
      const kelas = new Set(); const sesi = new Map([['qi_serah_masuk', JSON.stringify({ v: 1, t: 1000000 - umur, nama: 'Budi', peran: 'PRO' })]]);
      const elemen = {};
      const ambil = (id) => (elemen[id] = elemen[id] || { id, hidden: true, textContent: '', attr: {}, setAttribute(k, v) { this.attr[k] = v; }, getAttribute(k) { return this.attr[k] || null; }, querySelector: () => null, style: { setProperty() {} }, classList: { add: (k) => id === 'qiLoadScreen' && kelas.add(k), contains: (k) => kelas.has(k) }, parentNode: {}, remove() {} });
      const c = { document: { getElementById: ambil, readyState: 'loading', addEventListener() {} }, window: { addEventListener() {} }, localStorage: { getItem: () => 'tok' }, sessionStorage: { getItem: (k) => sesi.get(k) || null, removeItem: (k) => sesi.delete(k) }, setTimeout: () => 0, Date: { now: () => 1000000 }, JSON, String, Math, console };
      vm.createContext(c); vm.runInContext(PEMUAT, c);
      return { lanjut: kelas.has('is-lanjutan'), terhapus: !sesi.has('qi_serah_masuk') };
    };
    cek('umur 5 detik → bersambung', jalan(5000).lanjut === true);
    cek('umur 31 detik → diabaikan (dan dihapus)', jalan(31000).lanjut === false && jalan(31000).terhapus);
  }

  console.log('\nDashboard: keluar ke login HANYA pada HTTP 401');
  {
    const jalanAwal = async ({ token = 'TOK', http = 200, badan = { status: 'success', data: { role: 'pro' } }, cari = '?panel=panel-signal', hash = '#x' } = {}) => {
      const ss = penyimpanan(), ls = penyimpanan(token ? { qi_token: token, qi_user: '{"role":"pro"}' } : {});
      const ganti = [], kabar = [];
      const ctx = {
        document: { getElementById: () => null, addEventListener() {} },
        localStorage: ls, sessionStorage: ss,
        location: { pathname: '/webapp/dashboard.html', search: cari, hash, replace: (u) => ganti.push(u) },
        fetch: () => Promise.resolve({ ok: http < 300, status: http, json: () => Promise.resolve(badan) }),
        Headers, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
        addEventListener() {}, dispatchEvent: (ev) => { kabar.push(ev); return true; },
        JSON, String, console, setTimeout: (f) => { f(); return 0; },   // gerbang mengalihkan lewat window.setTimeout(…, 250): di uji dijalankan seketika
      };
      ctx.window = ctx;
      vm.createContext(ctx);
      vm.runInContext(AUTH, ctx);
      vm.runInContext(AWAL, ctx);
      await flush();
      return { ganti, kabar, ss, ls };
    };
    const a = await jalanAwal({ http: 503, badan: { status: 'error', message: 'DB' } });
    cek('503 (gangguan server) → tetap di dashboard', a.ganti.length === 0 && a.ls.getItem('qi_token') === 'TOK');
    cek('qi-sesi {sah:false, http:503} dikirim ke layar pembuka', a.kabar.some((e) => e.type === 'qi-sesi' && e.detail.sah === false && e.detail.http === 503));
    const b = await jalanAwal({ http: 401, badan: { status: 'error', code: 'AUTH_REQUIRED' } });
    cek('401 → sesi dihapus dari kedua penyimpanan sebelum ke login', b.ganti[0] === 'login.html' && b.ls.getItem('qi_token') === null);
    cek('401 → alasan "sesi_berakhir" + tautan dalam (?panel=…#…) diingat', b.ss.getItem('qi_alasan_masuk') === 'sesi_berakhir' && b.ss.getItem('qi_redirect_after_login') === 'dashboard.html?panel=panel-signal#x', b.ss._m);
    const c = await jalanAwal({ token: null });
    cek('tanpa token → login dengan alasan "perlu_masuk" & tautan dalam', c.ganti[0] === 'login.html' && c.ss.getItem('qi_alasan_masuk') === 'perlu_masuk' && c.ss.getItem('qi_redirect_after_login') === 'dashboard.html?panel=panel-signal#x');
    const d = await jalanAwal();
    cek('200 → qi-sesi {sah:true}', d.ganti.length === 0 && d.kabar.some((e) => e.type === 'qi-sesi' && e.detail.sah === true));
    const e = await jalanAwal({ http: 401, badan: { status: 'error', message: 'x' } });
    cek('401 TANPA kode AUTH_REQUIRED/2FA_REQUIRED → sesi tidak dihapus, tetap di dashboard', e.ganti.length === 0 && e.ls.getItem('qi_token') === 'TOK');
    const f = await jalanAwal({ http: 401, badan: { status: 'error', code: '2FA_REQUIRED' } });
    cek('401 2FA_REQUIRED → ke login dengan alasan "dua_langkah" (bukan "sesi_berakhir")', f.ganti[0] === 'login.html' && f.ss.getItem('qi_alasan_masuk') === 'dua_langkah');
  }

  console.log('\nKontrak statis');
  const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  cek('tanpa setInterval di alur masuk', ![ANIM, LOGIN, DUA].some((s) => /setInterval\s*\(/.test(tanpaKomentar(s))));
  cek('halaman-login.js tanpa setTimeout (jeda 800 ms tetap sudah dihapus)', !/setTimeout\s*\(/.test(tanpaKomentar(LOGIN)));
  cek('qim-masuk-animasi.js: satu-satunya setTimeout adalah jeda tampil di serahkan()', (tanpaKomentar(ANIM).match(/setTimeout\s*\(/g) || []).length === 1 && /var MIN_TAMPIL = 450;/.test(ANIM));
  cek('bilah hanya ditulis oleh perbaruiKemajuan(), yang hanya dipanggil tandai()', (tanpaKomentar(ANIM).match(/--qm-kemajuan/g) || []).length === 1 && (tanpaKomentar(ANIM).match(/perbaruiKemajuan\(\)/g) || []).length === 2 && !/--qm-kemajuan|data-keadaan', '(?:selesai|jalan)/.test(tanpaKomentar(LOGIN)));
  cek('login.html: formulir novalidate', (HTML.match(/<form [^>]*novalidate/g) || []).length === 2);
  cek('login.html: layar #qmLayar dengan L1–L4, judul tabindex=-1, status aria-live', ['qmL1', 'qmL2', 'qmL3', 'qmL4'].every((id) => HTML.includes(`id="${id}"`)) && /id="qmJudul" class="qm-judul" tabindex="-1"/.test(HTML) && /id="qmStatus"[^>]*role="status" aria-live="polite"/.test(HTML));
  cek('login.html: #qmPemberitahuan role=alert & kartu #qmSesiAktif (tersembunyi)', /id="qmPemberitahuan"[^>]*role="alert" hidden/.test(HTML) && /id="qmSesiAktif"[^>]*hidden/.test(HTML));
  cek('login.html: bagian Google tersembunyi sampai diaktifkan', /id="googleAuthSection" class="pb-tumpuk" hidden/.test(HTML) && /id="googleStatus"[^>]*role="status"/.test(HTML));
  cek('login.html: qim-masuk.css setelah publik.css; skrip kepala sinkron di <head>', /publik\.css\?v=[^"]+">\s*<link rel="stylesheet" href="assets\/css\/qim-masuk\.css/.test(HTML) && /<script src="assets\/js\/halaman-login-kepala\.js\?v=[^"]+"><\/script>[\s\S]*<\/head>/.test(HTML));
  cek('login.html: qim-masuk-animasi.js dimuat sebelum halaman-login.js, versi dinaikkan', /qim-masuk-animasi\.js\?v=[^"]+"><\/script>\s*<script src="assets\/js\/halaman-login\.js\?v=(?!1\.1\.0")/.test(HTML) && !/auth\.js\?v=1\.4\.3/.test(HTML));
  cek('dialog 2FA memakai kelas .qm-dialog (tanpa style inline)', /className = 'qm-dialog'/.test(DUA) && !/style\.cssText|style="/.test(DUA) && /\.qm-dialog \{/.test(CSS));
  cek('qim-masuk.css: gerak-minimal mematikan animasi; View Transition hanya tanpa gerak-minimal', /@media \(prefers-reduced-motion: reduce\)/.test(CSS) && /@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{ navigation: auto; \}/.test(CSS));
  cek('logo & judul punya view-transition-name yang sama di kedua halaman', /\.qm-logo \{[^}]*view-transition-name: qm-logo/.test(CSS) && /\.qm-judul \{[^}]*view-transition-name: qm-judul/.test(CSS) && /class="qm-logo"/.test(HTML) && /class="qm-logo"/.test(DASH));
  cek('api/auth.php mengirim full_name untuk email & Google', (baca('api/auth.php').match(/'full_name'\s*=>/g) || []).length >= 3);
  cek('beranda: tombol Masuk sadar sesi & tautan dashboard langsung ke login', (INDEX.match(/data-qi-nav-masuk/g) || []).length === 2 && /function perbaruiNavSesi/.test(IDXJS) && /a\[href\^="dashboard\.html"\]/.test(IDXJS) && /qi_redirect_after_login/.test(IDXJS));

  cek('qim-masuk.css: --qm-bg bernilai tetap (qim-dashboard.css menimpa --qi-bg → login hitam, dashboard biru tua)',
    /--qm-bg:\s*#[0-9a-fA-F]{3,8};/.test(CSS) && !/--qm-bg:\s*var\(--qi-bg/.test(CSS));

  console.log('\nTeks: Bahasa Indonesia, tanpa teater keamanan');
  const teks = [HTML, LOGIN, ANIM, DUA, CSS, (DASH.match(/<div id="qiLoadScreen"[\s\S]*?<!-- bundel:pemuat/) || [''])[0]].join('\n');
  cek('tanpa "Login berhasil" / "Berhasil login"', !/login berhasil|berhasil login/i.test(teks));
  cek('tanpa "SECURE" / "256-bit" / "SECURE CONNECTION"', !/SECURE|256-?BIT/i.test(teks));
  cek('pesan halaman masuk memakai "Masuk", bukan "Login …gagal/dibatalkan"', !/Login (dibatalkan|gagal|Google gagal)/i.test(LOGIN + DUA));

  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — animasi masuk: kejadian nyata, ≤ 450 ms, gagal simpan = tidak pindah, Bahasa Indonesia');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
