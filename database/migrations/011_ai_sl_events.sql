-- 011_ai_sl_events.sql
-- CATATAN & ANALISA SETIAP KEJADIAN STOP LOSS (Tahap 2 — belajar dari SL).
--
-- MENGAPA tabel ini dibuat:
--   Spesifikasi (Bagian 5) mewajibkan setiap SL dianalisa sebagai pelajaran, bukan
--   dihapus. Saat ini rekor hanya menyimpan "HIT SL 🛑" tanpa sebab yang terukur,
--   sehingga tidak ada dasar untuk memperbaiki metode.
--
-- PRINSIP KEJUJURAN yang dijaga oleh kolom-kolom di bawah:
--   · Hanya memuat hal yang BENAR-BENAR terukur (jarak SL, ATR, sesi, arah MTF).
--   · Bila bukti tidak cukup, `cause` diisi 'perlu_data_harga' — bukan tebakan.
--   · `proposed_change` berisi USULAN, dan `status_usul` menyatakan apakah usulan itu
--     masih menunggu persetujuan manusia. AI TIDAK mengubah metode sendiri.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.
-- Catatan: komentar kolom tidak memakai titik-koma agar pemisah pernyataan sederhana
-- tidak pernah memotong berkas ini di tengah definisi.

CREATE TABLE IF NOT EXISTS `ai_sl_events` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `signal_id`       VARCHAR(64)  NOT NULL COMMENT 'id sinyal di jurnal (unik, satu analisa per sinyal)',
  `created_at`      DATETIME     NOT NULL COMMENT 'waktu analisa dibuat',
  `closed_at`       DATETIME     NULL COMMENT 'waktu sinyal tertutup (kena SL)',
  `symbol`          VARCHAR(30)  NOT NULL,
  `timeframe`       VARCHAR(12)  NULL,
  `direction`       ENUM('BUY','SELL') NULL,
  `entry_price`     DECIMAL(18,6) NULL,
  `sl_price`        DECIMAL(18,6) NULL,
  `exit_price`      DECIMAL(18,6) NULL,
  `atr`             DECIMAL(18,6) NULL COMMENT 'ATR nyata saat sinyal terbit',
  `sl_distance`     DECIMAL(18,6) NULL COMMENT 'jarak entry ke SL (harga)',
  `sl_distance_atr` DECIMAL(10,4) NULL COMMENT 'jarak SL dibagi ATR — kunci penilaian: <1 berarti SL di dalam noise',
  `sweep_overshoot_atr` DECIMAL(10,4) NULL COMMENT 'seberapa jauh harga melewati SL (dalam ATR) — indikasi sapuan likuiditas',
  `session`         VARCHAR(20)  NULL COMMENT 'sesi saat sinyal terbit: Asia | London | New York | Jelang tutup',
  `jam_sinyal`      TINYINT      NULL COMMENT 'jam (0-23) waktu sinyal terbit, zona waktu server',
  `mtf_aligned`     TINYINT(1)   NULL COMMENT 'apakah arah antar timeframe selaras saat terbit',
  `confluence_score` INT         NULL,
  `confidence`      INT          NULL,
  `regime`          VARCHAR(20)  NULL COMMENT 'penilaian volatilitas: rendah | sedang | tinggi (dari ATR vs harga)',
  `cause`           VARCHAR(40)  NOT NULL COMMENT 'sl_terlalu_ketat | tf_konflik | sapuan_likuiditas | volatilitas_ekstrem | perlu_data_harga | tidak_diketahui',
  `cause_detail`    VARCHAR(400) NULL COMMENT 'penjelasan sebab dalam bahasa manusia (angka nyata)',
  `analysis`        TEXT         NULL COMMENT 'uraian lengkap hasil analisa',
  `proposed_change` VARCHAR(400) NULL COMMENT 'USULAN perbaikan metode (tidak diterapkan otomatis)',
  `status_usul`     VARCHAR(20)  NOT NULL DEFAULT 'menunggu' COMMENT 'menunggu | diterima | ditolak | perlu_uji',
  `sample_note`     VARCHAR(200) NULL COMMENT 'keterangan kecukupan sampel saat usulan dibuat',
  `raw_json`        JSON         NULL COMMENT 'cadangan rekor asli untuk audit',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_signal` (`signal_id`),
  KEY `idx_cause` (`cause`),
  KEY `idx_created` (`created_at`),
  KEY `idx_symbol` (`symbol`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Analisa kejadian SL untuk perbaikan metode (usulan, bukan perubahan otomatis)';
