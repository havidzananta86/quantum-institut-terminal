# Koneksi read-only MT4/MT5

Bridge ini hanya mengirim total saldo, ekuitas, margin terpakai, dan jumlah posisi terbuka ke dashboard Quantum Institut. Tidak ada kata sandi broker yang dikirim atau disimpan, dan kode ini tidak memiliki fungsi untuk membuka, mengubah, maupun menutup order.

1. Deploy webapp ke domain HTTPS Anda terlebih dahulu. Jangan gunakan `localhost` dari komputer atau VPS MetaTrader yang berbeda.
2. Di dashboard, buka **Akun & Kinerja** lalu klik **Hubungkan MT4/MT5**. Isi platform, nama akun, dan nomor akun; simpan Bridge Key yang muncul.
3. Unduh EA langsung dari panel tersebut (**EA MT4** / **EA MT5**): input `Endpoint` di dalamnya sudah terisi otomatis sesuai domain webapp Anda, jadi tidak ada `YOUR-DOMAIN` yang perlu diedit. Versi manual `QuantumReadOnlyBridge.mq4`/`.mq5` tetap tersedia bila Anda ingin mengisi sendiri.
4. Compile file tersebut. Pasang Expert Advisor hasil compile ke satu grafik pada terminal yang memakai akun itu, lalu isi `BridgeKey` dengan key dari dashboard.
5. Di MetaTrader, buka **Tools > Options > Expert Advisors**, aktifkan **Allow WebRequest for listed URL**, lalu tambah URL domain Anda, misalnya `https://app.contoh.com`.
6. Aktifkan Algo Trading/AutoTrading agar timer EA dapat berjalan. Ini tidak memberi izin trading apa pun kepada EA; izin tersebut hanya diperlukan MetaTrader untuk menjalankan EA timer.

Jika Anda kehilangan Bridge Key, buat koneksi ulang dari dashboard. Key lama akan otomatis tidak berlaku. Untuk menghentikan sinkronisasi, cabut bridge dari dashboard dan hapus EA dari grafik.

## Eksekusi MT5 akun real

`QuantumLiveExecutionMT5.mq5` adalah EA berbeda untuk eksekusi order. Gunakan hanya setelah guardrail akun MT5 telah tersimpan dan Anda secara sengaja mengaktifkan eksekusi real di dashboard. Ganti `YOUR-DOMAIN`, compile, masukkan Bridge Key yang sama, serta tambahkan domain Anda ke daftar **Allow WebRequest**. Biarkan `AllowRealExecution=false` sampai semua koneksi dan limit terlihat benar.

EA ini menolak instruksi di atas 0,01 lot, instruksi tanpa SL/TP yang valid pada harga saat ini, simbol yang tidak ada, dan volume yang tidak sesuai aturan broker. Tombol darurat di dashboard menghentikan antrean baru; untuk perlindungan tambahan, set `AllowRealExecution=false` atau lepas EA dari chart.
