-- 012_ai_method_versions.sql
-- RIWAYAT VERSI METODE (Tahap 2 — versioning sesuai spesifikasi Bagian 5).
--
-- MENGAPA tabel ini dibuat:
--   Spesifikasi mewajibkan setiap perubahan metode disimpan sebagai versi baru dengan
--   changelog, dan HANYA diterbitkan bila winrate/profit factor/drawdown terbukti
--   membaik. Tanpa tabel ini, perubahan metode tidak bisa dibandingkan atau ditelusuri.
--
-- PRINSIP KEJUJUAN:
--   · Kolom winrate/profit_factor/max_drawdown BOLEH NULL. NULL berarti "belum diukur",
--     dan itu ditampilkan apa adanya — BUKAN 0 yang terlihat seperti hasil buruk.
--   · `sample_size` wajib diisi agar pembaca tahu berapa data di balik angka itu.
--   · `is_active` menandai versi yang sedang dipakai. Hanya satu yang seharusnya aktif,
--     dan pengaktifan dilakukan oleh manusia (bukan otomatis oleh AI).
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.
-- Catatan: komentar kolom tidak memakai titik-koma (lihat alasan di migrasi 009-011).

CREATE TABLE IF NOT EXISTS `ai_method_versions` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version`       VARCHAR(20)  NOT NULL COMMENT 'format v1.0.0 → v1.0.1 → v1.1.0 → v2.0.0',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changelog`     TEXT         NOT NULL COMMENT 'apa yang diubah dan MENGAPA (dengan angka bukti)',
  `winrate`       DECIMAL(5,2) NULL COMMENT 'NULL = belum diukur (bukan 0)',
  `profit_factor` DECIMAL(5,2) NULL COMMENT 'NULL = belum diukur',
  `max_drawdown`  DECIMAL(5,2) NULL COMMENT 'penurunan terbesar, satuan R',
  `sample_size`   INT          NOT NULL DEFAULT 0 COMMENT 'jumlah transaksi yang menjadi dasar angka di atas',
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'versi yang sedang dipakai (diaktifkan manusia)',
  `dasar_usul`    VARCHAR(200) NULL COMMENT 'asal usulan: analisa SL | backtest | keputusan manual',
  `disetujui_oleh` VARCHAR(100) NULL COMMENT 'siapa yang menyetujui perubahan ini',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_version` (`version`),
  KEY `idx_aktif` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Riwayat versi metode analisa (versioning wajib, aktivasi oleh manusia)';
