// Skrip halaman Status (status.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').
// Dua bagian: "Inti platform" dari api/health.php (basis data, disk, cache, detak cron, konfigurasi) dan
// "Layanan data & fitur" (memanggil endpoint yang dipakai terminal). Semua teks dibangun lewat textContent.
// Tidak ada riwayat / angka uptime: halaman ini hanya melaporkan hasil pemeriksaan saat ini.

const ENDPOINTS = [
    { name: 'Harga live',         ket: 'Kutipan harga terbaru',              url: 'api/live-price.php?symbols=BTCUSDT',            key: 'status', expect: 'success' },
    { name: 'Data chart',         ket: 'Candle untuk chart',                 url: 'api/get-chart-data.php?symbol=BTCUSDT&interval=60', key: 'status', expect: 'success' },
    { name: 'Mesin sinyal',       ket: 'Perhitungan sinyal teknikal',        url: 'api/signals.php?symbol=BTCUSDT&timeframe=D',    key: 'status', expect: 'success' },
    { name: 'Kekuatan mata uang', ket: 'Perbandingan kekuatan mata uang utama',  url: 'api/currency-strength.php',                     key: 'status', expect: v => v === 'success' || v === 'degraded' },
    { name: 'Kalender ekonomi',   ket: 'Jadwal rilis data ekonomi',          url: 'api/calendar.php',  key: 'status',  expect: 'success' },
    { name: 'Asisten AI',         ket: 'Layanan AI (pemeriksaan ringan, tanpa login)', url: 'api/ai-chat.php?ping=1', key: 'status', expect: 'ok' },
];

const LABEL = { ok: 'Normal', waspada: 'Terganggu', bahaya: 'Tidak merespons', tunggu: 'Memeriksa…' };
const NAMA_KUNCI = { twelvedata: 'Twelve Data (sumber harga cadangan)', file_not_found: 'berkas konfigurasi kunci' };
const NAMA_OPSIONAL = { telegram: 'notifikasi Telegram', google: 'masuk dengan Google', groq: 'Asisten AI' };
const fmtWaktu = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Satu baris status. tingkat: ok | waspada | bahaya | tunggu | '' (netral, abu-abu). */
function baris(nama, ket, tingkat, nilai) {
    const el = document.createElement('div');
    el.className = 'pb-baris-status';
    if (tingkat) el.dataset.tingkat = tingkat;
    const titik = document.createElement('span');
    titik.className = 'pb-titik';
    const teks = document.createElement('div');
    teks.className = 'pb-baris-status-nama';
    const b = document.createElement('b');
    b.textContent = nama;
    teks.appendChild(b);
    if (ket) { const s = document.createElement('span'); s.textContent = ket; teks.appendChild(s); }
    const n = document.createElement('span');
    n.className = 'pb-baris-status-nilai';
    n.textContent = nilai || LABEL[tingkat] || '';
    el.append(titik, teks, n);
    return el;
}

async function checkOne(ep) {
    try {
        const res = await fetch(ep.url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!res.ok) return 'bahaya';
        const data = await res.json();
        const v = data[ep.key];
        return (typeof ep.expect === 'function' ? ep.expect(v) : v === ep.expect) ? 'ok' : 'waspada';
    } catch (e) {
        return 'bahaya';
    }
}

/** Baris "Inti platform" dari jawaban api/health.php (503 saat degraded tetap dibaca isinya). */
function barisInti(data) {
    if (!data || !data.checks) {
        return [{ nama: 'Server', ket: 'Laporan kesehatan tidak bisa diambil dari peramban Anda.', tingkat: 'bahaya' }];
    }
    const c = data.checks;
    const r = [{ nama: 'Server web', ket: 'Menjawab permintaan', tingkat: 'ok' }];
    r.push(c.db
        ? { nama: 'Basis data', ket: 'Akun, paper trading, dan pengaturan', tingkat: 'ok', nilai: 'Terhubung' }
        : { nama: 'Basis data', ket: 'Masuk, paper trading, dan pengaturan akun mungkin gagal.', tingkat: 'bahaya', nilai: 'Tidak terhubung' });
    if (c.disk) {
        const pct = typeof c.disk_pct_used === 'number' ? c.disk_pct_used : null;
        r.push({ nama: 'Ruang penyimpanan server', ket: pct !== null ? pct.toLocaleString('id-ID') + '% terpakai' : '', tingkat: pct !== null && pct > 90 ? 'waspada' : 'ok', nilai: pct !== null && pct > 90 ? 'Hampir penuh' : 'Cukup' });
    } else {
        r.push({ nama: 'Ruang penyimpanan server', ket: 'Kapasitas tidak terbaca.', tingkat: 'waspada', nilai: 'Tidak diketahui' });
    }
    r.push(c.cache_writable
        ? { nama: 'Cache data pasar', ket: 'Penyimpanan sementara harga dan candle', tingkat: 'ok' }
        : { nama: 'Cache data pasar', ket: 'Tidak bisa ditulis — data pasar bisa lambat atau basi.', tingkat: 'bahaya', nilai: 'Bermasalah' });

    const cron = c.cron;
    if (cron && cron.status === 'ok') {
        const menit = Math.max(0, Math.round((cron.umur_s || 0) / 60));
        r.push({ nama: 'Tugas terjadwal', ket: 'Menilai TP/SL sinyal, sinyal bayangan, dan brief harian · detak terakhir ' + (menit < 1 ? 'kurang dari 1 menit' : menit + ' menit') + ' lalu', tingkat: 'ok', nilai: 'Berjalan' });
    } else if (cron && cron.status === 'basi') {
        const t = cron.terakhir ? fmtWaktu.format(new Date(cron.terakhir)) + ' WIB' : 'tidak diketahui';
        r.push({ nama: 'Tugas terjadwal', ket: 'Detak terakhir ' + t + '. Penilaian TP/SL otomatis ikut tertunda sampai berjalan lagi.', tingkat: 'bahaya', nilai: 'Terhenti' });
    } else if (cron) {
        r.push({ nama: 'Tugas terjadwal', ket: 'Server belum mencatat detak tugas terjadwal. Selama belum tercatat, penilaian TP/SL otomatis mungkin belum berjalan.', tingkat: '', nilai: 'Belum tercatat' });
    }

    const kurang = Array.isArray(c.api_keys_missing) ? c.api_keys_missing : [];
    r.push(c.api_keys === false || kurang.length
        ? { nama: 'Konfigurasi sumber data', ket: 'Belum diatur: ' + kurang.map(k => NAMA_KUNCI[k] || k).join(', ') + '.', tingkat: 'waspada', nilai: 'Belum lengkap' }
        : { nama: 'Konfigurasi sumber data', ket: 'Kunci sumber data utama terpasang', tingkat: 'ok', nilai: 'Lengkap' });

    const opsional = Array.isArray(c.api_keys_optional_missing) ? c.api_keys_optional_missing : [];
    r.push(c.api_keys === false
        ? { nama: 'Fitur opsional', ket: 'Konfigurasi kunci tidak terbaca.', tingkat: '', nilai: 'Tidak diketahui' }
        : opsional.length
        ?{ nama: 'Fitur opsional', ket: 'Belum diaktifkan admin: ' + opsional.map(k => NAMA_OPSIONAL[k] || k).join(', ') + '.', tingkat: '', nilai: 'Sebagian nonaktif' }
        : { nama: 'Fitur opsional', ket: 'Notifikasi Telegram, masuk dengan Google, dan Asisten AI', tingkat: 'ok', nilai: 'Aktif' });
    return r;
}

async function cekInti() {
    let data = null;
    try {
        const res = await fetch('api/health.php', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        data = await res.json();
    } catch (e) {}
    return barisInti(data);
}

function ringkas(tingkat) {
    const kotak = document.getElementById('statusRingkas');
    const judul = document.getElementById('ringkasJudul');
    const ket = document.getElementById('ringkasKet');
    const semua = tingkat.filter(Boolean);
    let t = 'ok', j = 'Semua layanan berjalan normal', k = 'Tidak ada gangguan yang terdeteksi pada pemeriksaan ini.';
    if (semua.includes('bahaya')) { t = 'bahaya'; j = 'Ada layanan yang tidak merespons'; k = 'Lihat baris berwarna merah di bawah.'; }
    else if (semua.includes('waspada')) { t = 'waspada'; j = 'Sebagian layanan terganggu'; k = 'Lihat baris berwarna kuning di bawah.'; }
    kotak.dataset.tingkat = t;
    judul.textContent = j;
    ket.textContent = k;
}

let _sedangCek = false;
async function checkAll() {
    if (_sedangCek) return;
    _sedangCek = true;
    const list = document.getElementById('statusList');
    const inti = document.getElementById('intiList');
    document.getElementById('statusRingkas').dataset.tingkat = 'tunggu';
    list.replaceChildren(...ENDPOINTS.map(ep => baris(ep.name, ep.ket, 'tunggu')));
    if (!inti.children.length) inti.replaceChildren(baris('Laporan kesehatan server', '', 'tunggu'));

    const [rInti, rFitur] = await Promise.all([
        cekInti(),
        Promise.all(ENDPOINTS.map(async (ep, i) => {
            const state = await checkOne(ep);
            const lama = list.children[i];
            if (lama) lama.replaceWith(baris(ep.name, ep.ket, state));
            return state;
        })),
    ]);
    inti.replaceChildren(...rInti.map(x => baris(x.nama, x.ket, x.tingkat, x.nilai)));
    ringkas([...rInti.map(x => x.tingkat), ...rFitur]);
    document.getElementById('lastCheck').textContent = fmtWaktu.format(new Date()) + ' WIB';
    _sedangCek = false;
}

checkAll();
let _nextCheck = 60;
setInterval(() => {
    if (document.hidden) return;                 // tab tidak terlihat: tidak perlu memeriksa
    _nextCheck--;
    const el = document.getElementById('nextCheckCountdown');
    if (el) el.textContent = _nextCheck > 0 ? '· berikutnya ' + _nextCheck + ' dtk' : '· memeriksa…';
    if (_nextCheck <= 0) { checkAll(); _nextCheck = 60; }
}, 1000);

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline').
document.getElementById('btnCekSekarang').addEventListener('click', () => { _nextCheck = 60; checkAll(); });
