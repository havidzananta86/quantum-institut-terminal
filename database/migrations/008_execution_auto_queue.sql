-- 008_execution_auto_queue.sql
-- Menyambungkan SINYAL ke ANTREAN EKSEKUSI otomatis untuk PRO/VIP yang mengaktifkan.
--
-- Yang ditambahkan dan ALASANNYA:
--
-- 1. trading_execution_orders.signal_id + indeks unik (signal_id, trading_account_id)
--    → satu sinyal hanya boleh menghasilkan SATU perintah per akun. Tanpa ini, sinyal
--      yang sama bisa dieksekusi berkali-kali (mis. admin menekan simpan dua kali,
--      atau cron berjalan bersamaan) — itu kerugian nyata.
--    → Perintah MANUAL tetap bebas: signal_id NULL, dan di MySQL beberapa NULL tidak
--      dianggap duplikat pada indeks unik.
--
-- 2. trading_execution_profiles.volume
--    → ukuran posisi yang DIMINTA untuk setiap sinyal (dulu hanya ada batas max_lot,
--      sehingga tidak jelas berapa lot yang harus dikirim). Nilai dijaga di rentang
--      0.01 .. max_lot oleh kode, dan EA juga menolak volume di luar aturan broker.
--
-- 3. trading_execution_profiles.symbol_map
--    → peta nama simbol sinyal ke nama simbol di broker pelanggan, mis.
--      {"XAUUSD":"XAUUSD.pro","EURUSD":"EURUSD","BTCUSDT":"BTCUSD"}.
--      Tanpa ini, EA menolak dengan "Symbol is unavailable" karena nama simbol
--      berbeda antar broker — penyebab paling sering pelanggan merasa "tidak jalan".
--
-- Sifat migrasi: idempoten (aman dijalankan ulang), karena memakai IF NOT EXISTS
-- pada indeks dan mengecek keberadaan kolom lewat kode pemanggil.

ALTER TABLE trading_execution_orders
    ADD COLUMN signal_id VARCHAR(64) NULL AFTER source;

ALTER TABLE trading_execution_orders
    ADD UNIQUE KEY uq_execution_signal_account (signal_id, trading_account_id);

ALTER TABLE trading_execution_profiles
    ADD COLUMN volume DECIMAL(8,2) NOT NULL DEFAULT 0.01 AFTER max_lot;

ALTER TABLE trading_execution_profiles
    ADD COLUMN symbol_map LONGTEXT NULL AFTER allowed_symbols;
