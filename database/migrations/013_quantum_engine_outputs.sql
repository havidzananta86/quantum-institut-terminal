-- 013_quantum_engine_outputs.sql
-- JEJAK OUTPUT 9 MESIN PER SINYAL (Tahap 3 lanjutan — spesifikasi Bagian 12).
--
-- MENGAPA tabel ini dibuat:
--   Matriks mesin sudah dihitung server (api/engine-server.php), tetapi hasilnya hanya
--   tampil saat diminta. Tanpa tabel ini, pertanyaan "mesin apa saja yang setuju pada
--   saat sinyal TERBIT?" tidak dapat dijawab setelah keadaan pasar berubah.
--   Dengan tabel ini, setiap sinyal menyimpan bukti mesinnya — dapat diaudit kapan pun.
--
-- KEJUJUAN yang dijaga:
--   · Mesin yang TIDAK dapat dihitung (SMC, Ichimoku) TIDAK ditulis sebagai baris
--     "netral" — melainkan TIDAK ADA barisnya, dan jumlahnya dilaporkan terpisah di
--     kolom basis rekor. Jadi tidak ada mesin yang terlihat "setuju/tidak setuju" palsu.
--   · Kolom `skor` boleh NULL bila mesin tidak menghasilkan skor.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.
-- Komentar kolom tidak memakai titik-koma (agar pemisah pernyataan sederhana aman).

CREATE TABLE IF NOT EXISTS `quantum_engine_outputs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `signal_id`   VARCHAR(64)  NOT NULL COMMENT 'id sinyal di jurnal',
  `engine_code` VARCHAR(50)  NOT NULL COMMENT 'SNR | SMC | EMA200 | ICHI | FIBO | TRENM5 | MOMENTUM_NY | MACD_MOM | GOLDEN_CROSS',
  `arah`        VARCHAR(10)  NOT NULL COMMENT 'BUY | SELL | NETRAL',
  `skor`        DECIMAL(6,2) NULL COMMENT 'skor 0-100 dari mesin (NULL bila tidak ada)',
  `dasar`       VARCHAR(400) NULL COMMENT 'angka nyata yang menjadi dasar putusan mesin',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_sinyal_mesin` (`signal_id`, `engine_code`),
  KEY `idx_mesin` (`engine_code`, `created_at`),
  KEY `idx_sinyal` (`signal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Jejak output 9 mesin Quantum pada saat sinyal terbit (untuk audit)';
