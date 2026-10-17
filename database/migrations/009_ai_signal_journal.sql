-- 009_ai_signal_journal.sql
-- JURNAL SINYAL AI — fondasi audit (Tahap 1).
--
-- MENGAPA tabel ini dibuat:
--   Seluruh rekor sinyal saat ini hidup di BERKAS cache/signal_history.json (15 rekor).
--   Berkas itu tidak bisa: (a) dicari/difilter cepat, (b) dikaitkan ke tabel lain,
--   (c) menyimpan gambar chart, (d) mencatat setiap permintaan webhook untuk audit,
--   dan (e) berisiko hilang bila berkas rusak. Jurnal di database menutup semua itu.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS) — aman dijalankan berulang.
--   Tidak ada DROP/ALTER terhadap tabel yang sudah ada, jadi tidak ada risiko kehilangan data.
--
-- CATATAN PENTING: berkas JSON TETAP menjadi sumber cadangan. Kode aplikasi menulis ke
--   KEDUANYA (dual-write) dan membaca dari database bila tersedia, lalu jatuh kembali ke
--   berkas bila database bermasalah — supaya panel tidak pernah kosong karena DB.
--
-- Kolom mengikuti bentuk rekor yang SUDAH dipakai UI (31 kolom terverifikasi pada produksi
-- 2026-10-13) supaya tidak ada data yang hilang saat dipindahkan.

CREATE TABLE IF NOT EXISTS `ai_signal_journal` (
  `id`               VARCHAR(64)  NOT NULL COMMENT 'ID sinyal, mis. SIG-AUTO-20261013-ab12cd',
  `created_at`       DATETIME     NOT NULL COMMENT 'waktu sinyal terbit (field timestamp rekor)',
  `expiry_at`        DATETIME     NULL     COMMENT 'batas waktu sinyal masih berlaku',
  `symbol`           VARCHAR(30)  NOT NULL,
  `timeframe`        VARCHAR(12)  NOT NULL,
  `direction`        ENUM('BUY','SELL') NOT NULL,
  `entry_price`      DECIMAL(18,6) NOT NULL,
  `sl_price`         DECIMAL(18,6) NULL,
  `tp1_price`        DECIMAL(18,6) NULL COMMENT 'target pertama (field tp pada rekor)',
  `tp2_price`        DECIMAL(18,6) NULL,
  `tp3_price`        DECIMAL(18,6) NULL,
  `atr`              DECIMAL(18,6) NULL COMMENT 'ATR nyata saat sinyal terbit (sumber level)',
  `risk_reward`      VARCHAR(20)  NULL COMMENT 'teks R:R, mis. 1 : 2.50',
  `engine_code`      VARCHAR(50)  NULL COMMENT 'AUTO_SIGNAL | AI | NEWS | TRADINGVIEW | AUTO_SIGNAL+TV',
  `engine_name`      VARCHAR(100) NULL,
  `methods_used`     JSON         NULL COMMENT 'metode analisa AI, mis. ["SMC","ICT","Fibonacci"]',
  `quantum_engines`  JSON         NULL COMMENT 'kode 9 mesin, mis. ["SNR","SMC","MOMENTUM_NY"]',
  `confluence_score` INT          NULL COMMENT 'skor konfluensi 0-100 (lihat _signal_stats.php)',
  `confidence`       INT          NULL COMMENT 'keyakinan 0-100 bila dinyatakan sumbernya',
  `mtf_aligned`      TINYINT(1)   NULL COMMENT 'apakah arah antar timeframe selaras',
  `setuju_bull`      INT          NULL COMMENT 'jumlah timeframe bullish saat terbit',
  `setuju_bear`      INT          NULL COMMENT 'jumlah timeframe bearish saat terbit',
  `news_context`     VARCHAR(255) NULL COMMENT 'status berita / kalender saat terbit',
  `reason`           TEXT         NULL COMMENT 'alasan sinyal (bahasa manusia)',
  `basis`            VARCHAR(255) NULL COMMENT 'bukti konfluensi yang ditampilkan di panel',
  `chart_image_url`  VARCHAR(255) NULL COMMENT 'tautan gambar chart (snapshot TradingView)',
  `status`           VARCHAR(32)  NOT NULL COMMENT 'AKTIF | HIT TP | HIT SL | EXPIRED',
  `exit_price`       DECIMAL(18,6) NULL,
  `closed_at`        DATETIME     NULL,
  `evaluated_at`     DATETIME     NULL,
  `pnl`              DECIMAL(18,8) NULL,
  `pnl_usd`          DECIMAL(18,4) NULL,
  `pnl_basis`        VARCHAR(20)  NULL COMMENT 'dasar perhitungan P&L, mis. 1 lot',
  `result_r`         DECIMAL(10,4) NULL COMMENT 'hasil dalam satuan R (1R = risiko)',
  `r_source`         VARCHAR(20)  NULL COMMENT 'exit_price | rr_rencana | belum_selesai',
  `tier`             VARCHAR(10)  NULL DEFAULT 'FREE',
  `sumber`           VARCHAR(40)  NULL COMMENT 'asal sinyal, mis. auto_generator',
  `invalidation`     VARCHAR(255) NULL,
  `raw_json`         JSON         NULL COMMENT 'cadangan lengkap rekor asli (untuk audit)',
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_symbol_created` (`symbol`, `created_at`),
  KEY `idx_status`         (`status`),
  KEY `idx_engine`         (`engine_code`),
  KEY `idx_created`        (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Jurnal sinyal AI - sumber kebenaran audit (pendamping cache/signal_history.json)';
