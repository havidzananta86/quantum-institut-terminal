# Prompt untuk menjalankan deploy ke Hostinger

Salin seluruh teks di dalam blok di bawah ini ke asisten AI (atau teknisi) yang akan mengerjakan deploy.
Jangan menambahkan password atau kunci ke dalam teks ini.

```
PERAN
Kamu membantu men-deploy versi baru aplikasi "Quantum Institut Market Terminal" (PHP + HTML statis + MySQL)
ke Hostinger shared hosting. Bekerjalah hati-hati: ini situs produksi yang sedang dipakai pengguna.

KONTEKS
- Repo: https://github.com/havidzananta86/quantum-institut-terminal  (remote "origin")
- Folder lokal: D:\xamp\htdocs\webapp
- Versi baru ada di cabang  feat/oanda-tv-bridge  (commit terakhir c852475 atau yang lebih baru di cabang yang sama).
- Produksi saat ini = origin/master di commit 0596c5c (belum pernah di-deploy dari cabang baru; situs live masih
  memuat dashboard-app.js?v=2.0.8 dan qim-mockup.css masih 404).
  Perbedaan terhadap produksi: 229 file (+42.650 / -11.565 baris), 20 migrasi database baru (003-021, 023),
  dan 7 file lama dihapus: terminal.html, api/otp.php, api/subscribe.php, api/get-signals.php,
  api/session-log.php, assets/js/chart-init.js, assets/css/terminal.css.
- Hostinger menarik repo otomatis dari cabang "master"; PUSH KE master = LANGSUNG TAYANG, tanpa staging.
- Jangan memakai FTP/unggah manual untuk kode (bisa bentrok dengan penarikan Git).
- File rahasia TIDAK ada di git dan jangan ditimpa: config/api_keys.php, config/database.php, isi cache/, uploads/avatars/.
- Bridge data (mt5-bridge, tv-bridge) jalan di Windows VPS, BUKAN di Hostinger. Folder itu ikut di repo tetapi
  diblokir dari web lewat .htaccess. Tidak ada yang perlu dijalankan dari folder tersebut di Hostinger.

ATURAN KERAS
1. Jangan pernah meminta atau menuliskan password, token, atau isi api_keys.php di chat/log. Minta pengguna
   mengetik/menempelkan sendiri di halaman login atau editor File Manager.
2. Jangan menyelesaikan CAPTCHA/verifikasi bot. Pengguna yang login sendiri.
3. Jangan force-push (--force) dan jangan menghapus cabang. Jika push ke master ditolak (bukan fast-forward), BERHENTI dan laporkan.
4. Jangan push ke master sebelum SEMUA langkah Persiapan selesai DAN pengguna menulis persis: "ya, push ke master".
5. Setiap langkah yang mengubah akun/database/server: jelaskan dulu apa yang akan dilakukan, tunggu konfirmasi, lalu lakukan.
6. Jika ada galat yang tidak jelas, berhenti dan laporkan teks galat apa adanya (tanpa rahasia). Jangan menebak-nebak.

PERSIAPAN (semua harus selesai sebelum push)
A. Di komputer:
   1. cd D:\xamp\htdocs\webapp ; git status  -> tidak boleh ada berkas dilacak yang belum di-commit (cache/calendar.json
      dan cache/news.json boleh diabaikan: berubah otomatis).
   2. git log --oneline -1 -> harus c852475 atau turunannya di cabang yang sama (jika ada commit lebih baru, catat id-nya).
   3. npm run test  -> semua PASS.
B. Di hPanel Hostinger (pengguna login sendiri):
   1. BACKUP database: Databases -> phpMyAdmin -> pilih database -> Export (Quick, SQL). Simpan file.
   2. BACKUP file: File Manager -> folder situs -> Compress -> unduh zip.
   3. MIGRASI database: phpMyAdmin -> klik nama database di kolom kiri -> tab Import -> pilih
      D:\xamp\htdocs\webapp\deploy\migrasi-produksi.sql -> Import.
      Berkas ini aman diulang (tanpa DROP/DELETE/TRUNCATE). Hasil harus sukses tanpa baris merah; jumlah tabel naik
      dari sekitar 8 menjadi sekitar 36 (termasuk tabel "migrations"). Jika ada merah: BERHENTI.
   4. KONFIGURASI: File Manager -> config/api_keys.php -> TAMBAHKAN (jangan hapus isi lama) blok bridge dari
      C:\Program Files\qim\hostinger-config.txt di VPS, yang ditempel sendiri oleh pengguna. Boleh dilewati bila
      VPS belum siap; situs tetap jalan dengan sumber data cadangan.
   5. GIT: Websites -> Manage -> Advanced -> Git. Pastikan repositori benar, cabang = master, penarikan otomatis aktif,
      direktori tujuan = public_html (atau kosong). Catat commit yang sedang tayang (harus 0596c5c).

DEPLOY (hanya setelah pengguna menulis "ya, push ke master")
   git fetch origin
   git log --oneline origin/master -1        # harus masih 0596c5c; jika berbeda, BERHENTI dan laporkan
   git push origin feat/oanda-tv-bridge:master
   Tunggu 1-2 menit. Jika tidak menarik otomatis, tekan tombol Deploy di halaman Git hPanel.

VERIFIKASI (laporkan hasil tiap butir)
   1. https://quantum-institut.com/api/health.php -> php, db, cache_writable = true
      (status "degraded" karena kunci telegram/google kosong itu sudah ada sejak sebelumnya, bukan masalah).
   2. https://quantum-institut.com/assets/css/qim-mockup.css -> bukan 404.
   3. https://quantum-institut.com/dashboard.html (Ctrl+F5) -> halaman terbuka; login; chart XAUUSD tampil.
   4. https://quantum-institut.com/api/get-chart-data.php?symbol=XAUUSD&interval=60 -> "status":"success".
   5. https://quantum-institut.com/mt5-bridge/main.py , /tv-bridge/server.js , /deploy/setup-vps.ps1 -> semuanya 403.
   6. Console browser (F12) di dashboard: tidak ada galat merah yang berulang.

ROLLBACK (jika verifikasi gagal)
   1. Kode: buat commit pemulihan dengan  git revert -m 1 <commit>  atau  git revert <rentang>  lalu push ke master;
      atau di hPanel -> Git deploy ulang commit 0596c5c. Tanpa force-push.
   2. Database: phpMyAdmin -> Import file backup dari B.1.
   3. File: File Manager -> ekstrak zip dari B.2.

SETELAH TAYANG (laporkan sebagai tugas terpisah, jangan dikerjakan otomatis)
   - Sertifikat HTTPS feed.quantum-institut.com di VPS belum terbit (cek C:\caddy\caddy.log).
   - Pengguna perlu mengganti password FTP yang pernah tertulis di chat.

LAPORAN AKHIR
Tulis ringkas: langkah yang selesai, hasil tiap butir verifikasi, dan hal yang masih terbuka.
```
