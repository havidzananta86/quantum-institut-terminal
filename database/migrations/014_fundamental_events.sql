-- 014_fundamental_events.sql
-- PERISTIWA FUNDAMENTAL (spesifikasi Bagian 12).
--
-- MENGAPA tabel ini dibuat:
--   Kalender ekonomi platform saat ini hidup di BERKAS cache/calendar.json. Berkas itu
--   dipakai untuk menahan sinyal saat ada berita besar (api/_middleware.php →
--   qi_berita_blackout), tetapi TIDAK dapat dikaitkan ke sinyal secara historis:
--   "saat sinyal ini terbit, ada peristiwa apa?" tidak dapat dijawab setelah cache
--   diperbarui. Tabel ini menyimpannya sebagai riwayat.
--
-- KEJUJUAN yang dijaga:
--   · actual/forecast/previous boleh NULL — NULL berarti "belum dirilis / tidak ada data",
--     dan ditampilkan apa adanya (bukan 0 atau tebakan).
--   · Kunci unik (waktu + negara + nama) mencegah peristiwa yang sama tergandakan saat
--     kalender disegarkan berulang kali.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.
-- Komentar kolom tidak memakai titik-koma.

CREATE TABLE IF NOT EXISTS `fundamental_events` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_time`  DATETIME     NOT NULL COMMENT 'waktu rilis menurut kalender',
  `country`     VARCHAR(12)  NOT NULL COMMENT 'kode negara/mata uang, mis. USD',
  `event_name`  VARCHAR(160) NOT NULL,
  `impact`      VARCHAR(12)  NULL COMMENT 'high | medium | low (bila dinyatakan sumber)',
  `actual`      VARCHAR(50)  NULL COMMENT 'NULL = belum dirilis atau tidak ada data',
  `forecast`    VARCHAR(50)  NULL,
  `previous`    VARCHAR(50)  NULL,
  `sumber`      VARCHAR(40)  NULL COMMENT 'asal data, mis. kalender internal platform',
  `raw_json`    JSON         NULL COMMENT 'cadangan isi asli untuk audit',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_peristiwa` (`event_time`, `country`, `event_name`),
  KEY `idx_waktu` (`event_time`),
  KEY `idx_impact` (`impact`, `event_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Riwayat peristiwa fundamental (kalender) untuk dikaitkan ke sinyal';
