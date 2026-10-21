# Deploy versi baru ke Hostinger (langkah demi langkah)

Situs `quantum-institut.com` memakai **Git**: begitu kode masuk ke cabang `master` di GitHub, Hostinger menariknya dan
langsung tayang (lihat README.md). Karena itu persiapan di bawah **harus selesai sebelum** langkah 6 (push).

Yang sudah siap di komputer: kode ter-commit (`b5bfc31`), semua tes lulus, berkas migrasi
`deploy/migrasi-produksi.sql` (diuji dua kali pada database berbentuk produksi), dan aturan `.htaccess` yang menyembunyikan
folder bridge/deploy dari web.

---

## Langkah 1 - Backup database  (kamu)
- [ ] hPanel -> **Databases** -> **phpMyAdmin** -> pilih database situsmu -> tab **Export** -> *Quick* -> format *SQL* -> **Go**.
- [ ] Simpan file `.sql` yang terunduh (jangan dihapus sampai deploy dinyatakan berhasil).

## Langkah 2 - Backup file situs  (kamu)
- [ ] hPanel -> **Files** -> **File Manager** -> pilih folder situs (biasanya `public_html`) -> **Compress** -> unduh zip-nya.

## Langkah 3 - Jalankan migrasi database  (kamu)
- [ ] phpMyAdmin -> **klik nama database di kolom kiri** (supaya yang aktif database yang benar).
- [ ] Tab **Import** -> pilih `D:\xamp\htdocs\webapp\deploy\migrasi-produksi.sql` -> **Import**.
- [ ] Harus muncul tulisan sukses hijau. Kalau ada merah, **berhenti** dan kirim screenshot-nya.
- [ ] Cek: daftar tabel di kolom kiri sekarang ±35 tabel (tadinya ±8).

Berkas ini aman diulang. Tidak ada DROP, DELETE, atau TRUNCATE.

## Langkah 4 - Konfigurasi kunci di server  (kamu)
- [ ] File Manager -> `config/api_keys.php` -> **Edit**.
- [ ] **Jangan hapus isi lama.** Tambahkan di bagian paling bawah blok dari `C:\Program Files\qim\hostinger-config.txt` (di VPS).
- [ ] Jika VPS belum siap (sertifikat HTTPS belum terbit), **lewati langkah ini**. Situs tetap jalan dengan sumber cadangan,
      dan bisa ditambahkan nanti tanpa deploy ulang.

## Langkah 5 - Pastikan Hostinger menarik dari GitHub  (kamu)
- [ ] hPanel -> **Websites** -> **Manage** -> **Advanced** -> **Git**.
- [ ] Pastikan repositori `havidzananta86/quantum-institut-terminal`, cabang **master**, dan status *Auto deployment* aktif.
- [ ] Catat commit yang sedang tayang (seharusnya `0596c5c`).

## Langkah 6 - Push ke master  (saya, setelah kamu bilang "ya, push ke master")
```
git push origin feat/oanda-tv-bridge:master
```
- [ ] Tunggu 1-2 menit sampai Hostinger menarik. Di halaman Git ada tombol **Deploy** bila penarikan tidak otomatis.

## Langkah 6b - Pasang Cron Jobs  (kamu)  ← WAJIB, sering terlewat

Tanpa langkah ini situs tetap tayang, tetapi **penilaian TP/SL, sinyal bayangan, pemindai
Pine, dan brief harian tidak pernah berjalan** — tanpa pesan error apa pun. Diperiksa
2026-10-20: `api/health.php` melaporkan `cron: "belum_pernah"` dan `sinyal_pine.rekor = 0`.

- [ ] hPanel -> **Advanced** -> **Cron Jobs**.
- [ ] Tambahkan tiga tugas berikut (ganti `USER` dengan nama akun hosting-mu):

```
*/15 * * * *  /usr/bin/php /home/USER/public_html/api/maintenance-cron.php
*/15 * * * *  /usr/bin/php /home/USER/public_html/api/ai-cron.php
*/5  * * * *  /usr/bin/php /home/USER/public_html/api/alert-cron.php
```

- [ ] Jadwal `maintenance-cron` **harus 15 menit**, bukan 6 jam: detak dianggap basi
      setelah 45 menit dan halaman status akan terus melaporkan `degraded`.
- [ ] Alternatif tanpa CLI: panggil lewat HTTP dengan `?key=<CRON_SECRET_KEY>`.
- [ ] Verifikasi setelah ~20 menit: `https://quantum-institut.com/api/health.php`
      -> `checks.cron.status` harus `ok` (bukan `belum_pernah` atau `basi`), dan
      `checks.cron_lain.ai.status` serta `checks.cron_lain.alert.status` juga `ok`.

## Langkah 7 - Verifikasi
- [ ] `https://quantum-institut.com/api/health.php` -> `php`, `db`, `cache_writable` bernilai `true`.
- [ ] `https://quantum-institut.com/assets/css/qim-mockup.css` -> tidak lagi 404.
- [ ] Buka `dashboard.html` (tekan **Ctrl + F5**), login, chart XAUUSD tampil.
- [ ] `https://quantum-institut.com/api/get-chart-data.php?symbol=XAUUSD&interval=60` -> `"status":"success"`.
- [ ] Folder internal tertutup: `https://quantum-institut.com/mt5-bridge/main.py` harus **403**.
- [ ] Buka console browser (F12): tidak ada merah besar yang berulang.

## Jika ada yang salah  (rollback)
1. **Kode:** minta saya mendorong commit pemulihan (`git revert`) ke `master`, atau di hPanel -> Git, deploy ulang commit `0596c5c`.
2. **Database:** phpMyAdmin -> Import -> file backup dari Langkah 1.
3. **File:** File Manager -> ekstrak zip dari Langkah 2.

## Setelah situs tayang
- [ ] Selesaikan sertifikat HTTPS `feed.quantum-institut.com` (kirim `Get-Content C:\caddy\caddy.log -Tail 40` dari VPS).
- [ ] Tambahkan blok bridge ke `config/api_keys.php` (Langkah 4) bila tadi dilewati.
- [ ] Uji: login sebagai akun PRO -> label **LIVE - MT5** dan harga sama dengan MT5.
- [ ] Ganti password FTP yang pernah ditulis di chat (hPanel -> Files -> FTP Accounts).
