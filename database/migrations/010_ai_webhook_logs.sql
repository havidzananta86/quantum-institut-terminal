-- 010_ai_webhook_logs.sql
-- LOG PERMINTAAN WEBHOOK TRADINGVIEW — untuk audit (Tahap 1).
--
-- MENGAPA perlu:
--   Spesifikasi (Bagian 8) mewajibkan setiap permintaan webhook dicatat. Sebelumnya
--   TIDAK ADA jejak sama sekali: bila TradingView mengirim alert dan sinyal tidak muncul,
--   tidak ada cara mengetahui apakah request ditolak karena kunci salah, payload tidak
--   valid, terkena rate limit, atau memang tidak lolos pagar konfluensi.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS) — aman dijalankan berulang.
--   Tidak menyentuh tabel lain sama sekali.
--
-- Catatan: komentar kolom sengaja TIDAK memakai titik-koma, supaya pemisah pernyataan
--   sql sederhana (explode ';') tidak pernah memotong berkas ini di tengah definisi.

CREATE TABLE IF NOT EXISTS `ai_webhook_logs` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `received_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source`       VARCHAR(50)  NULL COMMENT 'tradingview atau sumber lain',
  `ip`           VARCHAR(45)  NULL,
  `symbol`       VARCHAR(30)  NULL,
  `timeframe`    VARCHAR(12)  NULL,
  `action`       VARCHAR(20)  NULL,
  `status`       VARCHAR(20)  NOT NULL COMMENT 'RECEIVED | REJECTED | PROCESSED | DUPLICATE | ERROR',
  `http_code`    SMALLINT     NULL,
  `auth_method`  VARCHAR(20)  NULL COMMENT 'query_key | hmac | none',
  `signature_ok` TINYINT(1)   NULL COMMENT 'NULL berarti tidak ada tanda tangan, 1 sah, 0 tidak sah',
  `signal_id`    VARCHAR(64)  NULL COMMENT 'diisi bila webhook menghasilkan sinyal',
  `message`      VARCHAR(255) NULL COMMENT 'penjelasan singkat hasil pemrosesan',
  `payload`      JSON         NULL COMMENT 'isi permintaan (dipotong bila terlalu besar)',
  PRIMARY KEY (`id`),
  KEY `idx_received` (`received_at`),
  KEY `idx_status`   (`status`),
  KEY `idx_symbol`   (`symbol`, `received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Log permintaan webhook TradingView untuk audit';
