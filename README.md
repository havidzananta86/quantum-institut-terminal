# Quantum Institut Market Terminal

Terminal analisa pasar multi-aset (kripto, emas, forex, indeks). PHP + HTML
statis tanpa framework, Tailwind di-build sebelumnya, MySQL untuk akun dan
riwayat sinyal.

Produksi: <https://quantum-institut.com>

---

## Deploy

**Push ke `master` langsung tayang.** Hostinger menarik dari repo secara
otomatis — tidak ada tahap build, staging, atau persetujuan di antaranya.

```bash
git push origin <branch>:master
```

Konsekuensi yang perlu disadari:

- Tidak ada jalan "undo" selain push perbaikan berikutnya.
- CI (`.github/workflows/ci.yml`) berjalan **paralel**, bukan sebagai
  gerbang. Ia bisa melaporkan gagal setelah kode sudah tayang.
- Karena itu: jalankan `npm test` sebelum push, bukan sesudah.

Verifikasi setelah deploy:

```bash
curl -s https://quantum-institut.com/api/health.php
```

### Cache-busting aset

Aset dipanggil dengan query versi, misal `tokens.css?v=1.4.4`. Browser
meng-cache agresif, jadi **setiap kali mengubah file di `assets/`, naikkan
versinya di semua HTML yang memuatnya**:

```bash
grep -rl 'tokens.css?v=1.4.4' *.html | xargs sed -i 's/tokens\.css?v=1\.4\.4/tokens.css?v=1.4.5/g'
```

Melewatkan langkah ini berarti sebagian pengguna menjalankan JS/CSS lama
bersama HTML baru — gejalanya sering muncul sebagai error yang tidak bisa
direproduksi di mesin sendiri.

---

## Pengembangan lokal

Butuh PHP 8.2+ (XAMPP sudah cukup) dan Node 18+.

```bash
php -S localhost:8788 -t .     # server dev
npm install                    # hanya untuk build Tailwind
```

Buka <http://localhost:8788/index.html>.

### CSS

`assets/css/tailwind.css` adalah **artefak hasil build yang ikut di-commit**,
bukan file yang diedit langsung.

```bash
npm run build:css    # build sekali
npm run watch:css    # build saat ada perubahan
```

Tailwind memangkas kelas yang tidak terdeteksi di `content` (lihat
`tailwind.config.js`). Jika memakai kelas utilitas yang sebelumnya tidak
pernah dipakai, ia tidak akan ada di CSS sampai build dijalankan ulang —
kelasnya diam-diam tidak berefek, tanpa error. Pernah terjadi: `py-14`
hilang sehingga padding section menjadi nol di layar kecil.

---

## Konfigurasi

Dua file ini **tidak masuk repo** (ada di `.gitignore`) dan harus dibuat
manual di tiap environment:

| File | Isi |
| --- | --- |
| `config/database.php` | Kredensial MySQL, mengekspor `getDBConnection()` |
| `config/api_keys.php` | `TWELVE_DATA_KEY`, `GROQ_API_KEY`, `CRON_SECRET_KEY`, dll |

Jangan pernah commit keduanya. `api/health.php` melaporkan kunci mana yang
belum terisi.

---

## Testing

```bash
npm test             # lint PHP seluruh file + unit test
npm run test:smoke   # perlu server jalan (lihat di bawah)
```

| Perintah | Cakupan |
| --- | --- |
| `test:php` | `php -l` untuk semua file PHP |
| `test:unit` | Matematika correlation matrix |
| `test:smoke` | Endpoint signals dengan cache dikosongkan |

Di Windows, tunjuk ke binary PHP jika tidak ada di PATH:

```bash
PHP_BIN="D:/xamp/php/php.exe" npm test
```

Smoke test mengosongkan `cache/chart` lebih dulu dengan sengaja.
`signals.php` meng-include `get-chart-data.php` sekali per timeframe, jadi
cache yang hangat menyembunyikan kesalahan di jalur include tersebut —
pernah lolos ke produksi sebagai HTTP 500 berbadan kosong.

```bash
SMOKE_BASE_URL=http://localhost:8788 npm run test:smoke
```

---

## Cron

| Skrip | Anjuran jadwal | Fungsi |
| --- | --- | --- |
| `api/ai-cron.php` | tiap 15 menit | Sinyal AI, buka/tutup paper trade |
| `api/maintenance-cron.php` | tiap 6 jam | Hapus log & cache kedaluwarsa |

Keduanya jalan lewat CLI, atau lewat HTTP dengan `CRON_SECRET_KEY`:

```bash
php /path/ke/webapp/api/maintenance-cron.php
curl "https://quantum-institut.com/api/maintenance-cron.php?key=RAHASIA"
```

Tambahkan `--dry` (CLI) atau `&dry=1` (HTTP) pada maintenance-cron untuk
melihat apa yang akan dihapus tanpa menghapusnya.

Tanpa maintenance-cron, `cache/logs/` bertambah satu berkas tiap hari tanpa
batas, dan pembersihan rate-limit di `_middleware.php` hanya berjalan pada
~1% request sehingga macet saat trafik sepi.

---

## Struktur

```
api/            39 endpoint; _middleware.php = CORS, rate limit, auth
engine/         Mesin sinyal (SNR, SMC, Ichimoku, Fibonacci, dll)
assets/css/     tokens.css = design token + tambalan utilitas Tailwind
assets/js/      auth.js = sesi/token; sisanya fitur per halaman
cache/          Cache & rate limit berbasis file (gitignored)
tests/          Lint PHP, unit, smoke
```

### Catatan keamanan

- Endpoint yang butuh sesi memanggil `qi_require_auth()` /
  `qi_require_pro()` / `qi_require_admin()` dari `_middleware.php`.
- Frontend mengirim token lewat `QuantumAuth.authHeaders()` (`assets/js/auth.js`).
  Endpoint ber-`qi_require_auth()` akan membalas 401 tanpa header ini.
- `QI_DEV` ditentukan dari `PHP_SAPI`/`SERVER_ADDR` dan **fail closed**.
  Jangan pernah menurunkannya dari `SERVER_NAME` atau `Host`: keduanya
  berasal dari klien dan bisa dipalsukan.

---

## Keterbatasan yang diketahui

- Payment gateway masih belum dapat dipakai sampai adapter provider nyata
  diimplementasikan. Endpoint kini fail-closed: tidak menerbitkan QR/invoice
  palsu, dan webhook hanya diproses jika signature HMAC serta migrasi database
  sudah tersedia.
- Rate limit dan cache berbasis file, jadi hanya benar untuk **satu server**.
  Perlu Redis/Memcached sebelum pindah ke multi-server.
