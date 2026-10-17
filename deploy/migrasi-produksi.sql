-- ============================================================================
-- MIGRASI PRODUKSI Quantum Institut (003-021, 023) - AMAN DIJALANKAN BERULANG
-- Dibuat dari database/migrations. Hanya MENAMBAH tabel/kolom/indeks bila belum ada;
-- tidak ada DROP, DELETE, atau TRUNCATE. Migrasi 022 (koreksi data zona waktu) tidak diperlukan
-- karena tabelnya baru dan kosong.
--
-- CARA PAKAI (phpMyAdmin): pilih DATABASE situsmu di kolom kiri -> tab Import -> pilih berkas ini -> Import.
-- PENTING: backup database dulu (tab Export).
-- ============================================================================

-- ---- 003_account_analytics_and_payment_events.sql ----
-- Account analytics, risk preferences, and idempotent payment webhook events.
CREATE TABLE IF NOT EXISTS trading_accounts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(40) NOT NULL,
    account_label VARCHAR(100) NOT NULL,
    account_reference VARCHAR(100) NOT NULL,
    connection_status ENUM('pending','active','paused','revoked') NOT NULL DEFAULT 'pending',
    last_synced_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_trading_account_reference (provider, account_reference),
    KEY idx_trading_accounts_user_status (user_id, connection_status),
    CONSTRAINT fk_trading_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trading_account_snapshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trading_account_id BIGINT UNSIGNED NOT NULL,
    balance DECIMAL(18,2) NOT NULL,
    equity DECIMAL(18,2) NOT NULL,
    margin_used DECIMAL(18,2) NOT NULL DEFAULT 0,
    open_positions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    captured_at DATETIME NOT NULL,
    KEY idx_account_snapshot_time (trading_account_id, captured_at),
    CONSTRAINT fk_snapshots_account FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_risk_profiles (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    risk_per_trade_pct DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    max_daily_loss_pct DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    max_open_positions TINYINT UNSIGNED NOT NULL DEFAULT 3,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_risk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(40) NOT NULL,
    provider_event_id VARCHAR(100) NOT NULL,
    order_code VARCHAR(50) NOT NULL,
    received_at DATETIME NOT NULL,
    UNIQUE KEY uq_payment_event (provider, provider_event_id),
    KEY idx_payment_events_order (order_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 004_readonly_mt_bridge.sql ----
-- Read-only MT4/MT5 bridge credentials. Broker passwords and trade commands
-- are never stored or handled by this application.
CREATE TABLE IF NOT EXISTS trading_account_bridge_keys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trading_account_id BIGINT UNSIGNED NOT NULL,
    key_hash CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    last_used_at DATETIME NULL,
    last_ip VARCHAR(45) NULL,
    UNIQUE KEY uq_bridge_key_account (trading_account_id),
    UNIQUE KEY uq_bridge_key_hash (key_hash),
    CONSTRAINT fk_bridge_key_account
        FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 005_mt5_execution_controls.sql ----
-- Live MT5 execution is opt-in. The terminal remains the only holder of broker credentials.
CREATE TABLE IF NOT EXISTS trading_execution_profiles (
    trading_account_id BIGINT UNSIGNED PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    emergency_stop TINYINT(1) NOT NULL DEFAULT 1,
    max_lot DECIMAL(8,2) NOT NULL DEFAULT 0.01,
    max_daily_loss_pct DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    max_open_positions TINYINT UNSIGNED NOT NULL DEFAULT 10,
    allowed_symbols JSON NULL,
    magic_number BIGINT UNSIGNED NOT NULL DEFAULT 20261012,
    enabled_at DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_execution_profile_account FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trading_execution_state (
    trading_account_id BIGINT UNSIGNED NOT NULL,
    state_day DATE NOT NULL,
    opening_balance DECIMAL(18,2) NOT NULL,
    latest_equity DECIMAL(18,2) NOT NULL,
    latest_open_positions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (trading_account_id, state_day),
    CONSTRAINT fk_execution_state_account FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trading_execution_orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_token CHAR(36) NOT NULL,
    trading_account_id BIGINT UNSIGNED NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'signal',
    symbol VARCHAR(32) NOT NULL,
    side ENUM('BUY','SELL') NOT NULL,
    volume DECIMAL(8,2) NOT NULL,
    stop_loss DECIMAL(20,8) NOT NULL,
    take_profit DECIMAL(20,8) NOT NULL,
    requested_price DECIMAL(20,8) NULL,
    status ENUM('queued','dispatched','executed','rejected','cancelled','expired') NOT NULL DEFAULT 'queued',
    broker_order_ticket BIGINT UNSIGNED NULL,
    broker_deal_ticket BIGINT UNSIGNED NULL,
    broker_retcode VARCHAR(32) NULL,
    broker_message VARCHAR(255) NULL,
    dispatched_at DATETIME NULL,
    executed_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_execution_order_token (order_token),
    KEY idx_execution_order_next (trading_account_id, status, expires_at),
    CONSTRAINT fk_execution_order_account FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 007_ai_autotrade_tables.sql ----
-- 007: Tabel modul AI Auto-Trade.
-- Sebelumnya tabel/kolom ini dibuat langsung oleh api/ai-auto-trade.php pada SETIAP
-- request (CREATE TABLE + ALTER TABLE di jalur request) — lambat, berisiko lock, dan
-- membuat struktur database berubah diam-diam tanpa migrasi. Kini hanya di sini.

CREATE TABLE IF NOT EXISTS ai_settings (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL UNIQUE,
    enabled    TINYINT(1) NOT NULL DEFAULT 0,
    symbols    JSON,
    lots       DECIMAL(6,2) NOT NULL DEFAULT 0.10,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_trade_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    symbol      VARCHAR(20) NOT NULL,
    action      VARCHAR(20) NOT NULL,
    confidence  TINYINT UNSIGNED,
    entry_price DECIMAL(20,6),
    tp          DECIMAL(20,6),
    sl          DECIMAL(20,6),
    risk_reward DECIMAL(6,2),
    reason      VARCHAR(200),
    executed    TINYINT(1) NOT NULL DEFAULT 0,
    position_id INT DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_sym  (symbol),
    INDEX idx_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Menandai asal posisi paper (manual / ai). Error 1060 bila kolom sudah ada → aman diabaikan.
SET @q = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions') = 1
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions' AND COLUMN_NAME = 'source') = 0,
  'ALTER TABLE paper_positions ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT ''manual''', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- 008_execution_auto_queue.sql ----
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

SET @q = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_orders') = 1
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_orders' AND COLUMN_NAME = 'signal_id') = 0,
  'ALTER TABLE trading_execution_orders ADD COLUMN signal_id VARCHAR(64) NULL AFTER source', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;


SET @q = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_orders') = 1
  AND (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_orders' AND INDEX_NAME = 'uq_execution_signal_account') = 0,
  'ALTER TABLE trading_execution_orders ADD UNIQUE KEY uq_execution_signal_account (signal_id, trading_account_id)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;


SET @q = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_profiles') = 1
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_profiles' AND COLUMN_NAME = 'volume') = 0,
  'ALTER TABLE trading_execution_profiles ADD COLUMN volume DECIMAL(8,2) NOT NULL DEFAULT 0.01 AFTER max_lot', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;


SET @q = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_profiles') = 1
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_execution_profiles' AND COLUMN_NAME = 'symbol_map') = 0,
  'ALTER TABLE trading_execution_profiles ADD COLUMN symbol_map LONGTEXT NULL AFTER allowed_symbols', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- 009_ai_signal_journal.sql ----
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

-- ---- 010_ai_webhook_logs.sql ----
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

-- ---- 011_ai_sl_events.sql ----
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

-- ---- 012_ai_method_versions.sql ----
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

-- ---- 013_quantum_engine_outputs.sql ----
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

-- ---- 014_fundamental_events.sql ----
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

-- ---- 015_ai_method_versions_status.sql ----
-- 015_ai_method_versions_status.sql
-- STATUS & BUKTI UJI untuk versi metode (spesifikasi Bagian 5 — STEP 4 & 5).
--
-- MENGAPA perlu kolom tambahan:
--   Tabel ai_method_versions (migrasi 012) sudah menyimpan angka winrate/profit factor,
--   tetapi TIDAK menyatakan TAHAP sebuah versi: masih usulan, sedang diuji, disetujui,
--   atau ditolak. Tanpa itu, "versi mana yang menunggu keputusan saya?" tidak terjawab.
--
-- KEJUJUAN yang dijaga:
--   · status_usul memisahkan usulan dari keputusan. Versi TIDAK pernah diaktifkan
--     otomatis — aktivasi selalu tindakan manusia (admin) dan dicatat.
--   · backtest_samples / forward_samples disimpan terpisah, karena spesifikasi
--     mensyaratkan backtest ≥ 100 sampel DAN forward test ≥ 30 sampel sebelum terbit.
--   · Sifat migrasi: idempoten. Kolom hanya ditambahkan bila BELUM ada (dicek lewat
--     information_schema), sehingga aman dijalankan berulang.
--
-- Catatan: MySQL/MariaDB tidak mendukung "ADD COLUMN IF NOT EXISTS" pada semua versi,
-- jadi penambahan kolom dilakukan oleh kode pemanggil setelah memeriksa information_schema.
-- Berkas ini sengaja hanya memuat pernyataan SELECT sebagai penanda (lihat migrate.php),
-- dan perubahan struktur dikerjakan oleh api/metode.php → qi_metode_pastikan_skema().

SELECT 'ai_method_versions: status_usul, backtest_samples, forward_samples ditambahkan oleh api/metode.php (idempoten)' AS catatan;

-- ---- 016_user_notification_settings.sql ----
-- 016_user_notification_settings.sql
-- NOTIFIKASI SINYAL PER PENGGUNA (Fase 2): Telegram, Discord, Slack, email, desktop.
--
-- MENGAPA tabel baru:
--   Notifikasi Telegram lama bersifat GLOBAL (satu bot + satu chat milik admin, disimpan
--   di cache/telegram.json). Setiap pengguna kini dapat memilih sendiri kanal yang ia
--   inginkan, sehingga satu sinyal disebar ke semua kanal yang diaktifkan tiap pengguna.
--
-- KEAMANAN yang dijaga:
--   · URL webhook Discord/Slack adalah RAHASIA (siapa pun yang memegangnya bisa memposting
--     ke kanal itu). Disimpan TERENKRIPSI (AES-256-GCM, kolom *_webhook_enc) — bukan teks
--     biasa — dan tidak pernah dikembalikan utuh ke peramban; UI hanya menerima petunjuk
--     singkat (*_webhook_hint, mis. "discord.com/…/abcd").
--   · Email hanya dikirim ke alamat akun (users.email), bukan alamat bebas, supaya fitur ini
--     tidak bisa dipakai untuk mengirim surat ke orang lain.
--
-- notification_deliveries:
--   Jejak pengiriman per sinyal × pengguna × kanal. Kunci unik (signal_id, user_id, channel)
--   menjadi KLAIM ATOMIK: sinyal yang tercatat ulang tidak pernah dikirim dua kali ke kanal
--   yang sama. Hasil (berhasil/gagal + kode HTTP + catatan) disimpan apa adanya.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `user_notification_settings` (
    `user_id`              BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    `telegram_enabled`     TINYINT(1)   NOT NULL DEFAULT 0,
    `telegram_chat_id`     VARCHAR(64)  NULL,
    `discord_enabled`      TINYINT(1)   NOT NULL DEFAULT 0,
    `discord_webhook_enc`  TEXT         NULL,
    `discord_webhook_hint` VARCHAR(64)  NULL,
    `slack_enabled`        TINYINT(1)   NOT NULL DEFAULT 0,
    `slack_webhook_enc`    TEXT         NULL,
    `slack_webhook_hint`   VARCHAR(64)  NULL,
    `email_enabled`        TINYINT(1)   NOT NULL DEFAULT 0,
    `desktop_enabled`      TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_deliveries` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `signal_id`   VARCHAR(80)  NOT NULL,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `channel`     ENUM('telegram', 'discord', 'slack', 'email') NOT NULL,
    `ok`          TINYINT(1)   NULL,            -- NULL = sedang dikirim (klaim), 1 = berhasil, 0 = gagal
    `http_code`   SMALLINT     NULL,
    `note`        VARCHAR(255) NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_notif_kirim` (`signal_id`, `user_id`, `channel`),
    INDEX `idx_notif_user_waktu` (`user_id`, `created_at`),
    CONSTRAINT `fk_notif_kirim_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 017_competition.sql ----
-- 017_competition.sql
-- HALAMAN COMPETITION: pendaftaran turnamen + profil kompetisi pengguna.
--
-- MENGAPA:
--   Peringkat dihitung dari paper trading yang SUDAH ditutup (paper_positions.status='closed'),
--   jadi tidak ada angka karangan. Yang belum ada hanyalah (1) siapa yang mendaftar ke
--   turnamen — syarat berhak atas hadiah — dan (2) nama tampilan + negara untuk papan
--   peringkat (tab "Indonesia" dan bendera). Keduanya diisi sendiri oleh pengguna.
--
-- PRIVASI:
--   Tanpa nama tampilan, papan peringkat memakai nama asli yang DISAMARKAN (seperti
--   leaderboard lama). Negara bersifat opsional dan tidak pernah ditebak dari data lain.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak mengubah tabel lain.

CREATE TABLE IF NOT EXISTS `competition_entries` (
    `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tournament_key` VARCHAR(40)  NOT NULL,           -- mis. 'weekly-championship'
    `period_key`     VARCHAR(20)  NOT NULL,           -- mis. '2026-W42', '2026-10', '2026-10-16'
    `user_id`        BIGINT UNSIGNED NOT NULL,
    `joined_at`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_comp_entry` (`tournament_key`, `period_key`, `user_id`),
    INDEX `idx_comp_user` (`user_id`),
    CONSTRAINT `fk_comp_entry_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_competition_profile` (
    `user_id`       BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    `display_name`  VARCHAR(24)  NULL,
    `country_code`  CHAR(2)      NULL,
    `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_comp_display_name` (`display_name`),
    CONSTRAINT `fk_comp_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 018_push_subscriptions.sql ----
-- 018_push_subscriptions.sql
-- LANGGANAN WEB PUSH — notifikasi sinyal & price alert walau tab dashboard ditutup.
--
-- Satu baris = satu peramban/perangkat yang mengizinkan push (PushSubscription).
--   · endpoint     : URL layanan push resmi (FCM/Mozilla/WNS/Apple) — divalidasi di api/_push.php
--   · p256dh, auth : kunci enkripsi milik peramban (base64url), bukan rahasia server
--   · endpoint_hash: kunci unik (endpoint bisa > 255 karakter)
-- Langganan yang dijawab 404/410 oleh layanan push dihapus otomatis saat pengiriman.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`       BIGINT UNSIGNED NOT NULL,
    `endpoint`      TEXT         NOT NULL,
    `endpoint_hash` CHAR(64)     NOT NULL,
    `p256dh`        VARCHAR(120) NOT NULL,
    `auth`          VARCHAR(40)  NOT NULL,
    `user_agent`    VARCHAR(200) NULL,
    `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `last_ok_at`    DATETIME     NULL,
    `fail_count`    INT          NOT NULL DEFAULT 0,
    UNIQUE KEY `uq_push_endpoint` (`endpoint_hash`),
    INDEX `idx_push_user` (`user_id`),
    CONSTRAINT `fk_push_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 019_user_chart_state.sql ----
-- 019_user_chart_state.sql
-- STATE CHART PER AKUN — gambar chart & template tersinkron antar perangkat/peramban.
--
-- Dulu gambar (trendline, zona, fibo, …) dan template Custom hanya di localStorage, jadi hilang
-- saat ganti perangkat atau membersihkan peramban. Satu baris = satu kunci milik pengguna:
--   · lw:<SIMBOL_TV>   → JSON DrawingManager.exportJSON() untuk simbol itu (mis. lw:BINANCE_BTCUSDT)
--   · tpl:custom1|2    → template Custom (timeframe + indikator + gambar)
-- Konflik diselesaikan "penulis terakhir menang" berdasarkan client_updated_at (ms epoch).
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `user_chart_state` (
    `user_id`           BIGINT UNSIGNED NOT NULL,
    `state_key`         VARCHAR(80)  NOT NULL,
    `state_value`       MEDIUMTEXT   NOT NULL,
    `client_updated_at` BIGINT       NOT NULL DEFAULT 0,
    `updated_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `state_key`),
    CONSTRAINT `fk_chart_state_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 020_account_security.sql ----
-- 020_account_security.sql
-- KEAMANAN AKUN: verifikasi dua langkah (OTP email + kode cadangan) dan log aktivitas.
--
-- user_security   : status 2FA per pengguna. Kode cadangan disimpan sebagai hash (password_hash),
--                   tidak pernah teks biasa; kode penyiapan (setup_*) berlaku 10 menit.
-- session_2fa     : sesi yang BELUM lolos 2FA. Selama barisnya ada, token sesi itu ditolak oleh
--                   qi_validate_token() — login baru benar-benar aktif setelah kode diverifikasi.
-- security_events : jejak login, 2FA, keluar, dan ganti kata sandi (alamat IP & perangkat).
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `user_security` (
    `user_id`          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    `twofa_email`      TINYINT(1)   NOT NULL DEFAULT 0,
    `twofa_enabled_at` DATETIME     NULL,
    `backup_codes`     TEXT         NULL,
    `setup_code_hash`  VARCHAR(255) NULL,
    `setup_expires_at` DATETIME     NULL,
    `setup_attempts`   INT          NOT NULL DEFAULT 0,
    `updated_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_usec_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `session_2fa` (
    `token_hash`  CHAR(64)     NOT NULL PRIMARY KEY,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `code_hash`   VARCHAR(255) NOT NULL,
    `expires_at`  DATETIME     NOT NULL,
    `attempts`    INT          NOT NULL DEFAULT 0,
    `sent_at`     DATETIME     NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_s2fa_user` (`user_id`),
    CONSTRAINT `fk_s2fa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `security_events` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `event`       VARCHAR(40)  NOT NULL,
    `ip`          VARCHAR(45)  NULL,
    `user_agent`  VARCHAR(200) NULL,
    `detail`      VARCHAR(255) NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_secev_user_waktu` (`user_id`, `created_at`),
    CONSTRAINT `fk_secev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 021_competition_eligibility.sql ----
-- 021_competition_eligibility.sql
-- SYARAT HADIAH KOMPETISI: jejak pendaftaran untuk pemeriksaan satu orang satu akun.
--
-- MENGAPA:
--   Pemenang harus memenuhi syarat (api/_kompetisi_syarat.php). Pemeriksaan multi-akun
--   membandingkan IP publik peserta; IP saat mendaftar dicatat di sini (sesi lama dihapus
--   saat login baru, jadi tidak bisa diandalkan sendirian). Data hanya dipakai admin untuk
--   meninjau kandidat pemenang, tidak pernah ditampilkan ke peserta lain.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak mengubah tabel lain.

CREATE TABLE IF NOT EXISTS `competition_join_log` (
    `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tournament_key` VARCHAR(40)  NOT NULL,
    `period_key`     VARCHAR(20)  NOT NULL,
    `user_id`        BIGINT UNSIGNED NOT NULL,
    `ip`             VARCHAR(45)  NULL,
    `user_agent`     VARCHAR(200) NULL,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_cjl_periode` (`tournament_key`, `period_key`),
    INDEX `idx_cjl_user` (`user_id`),
    CONSTRAINT `fk_cjl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- 023_login_attempts.sql ----
-- 023_login_attempts.sql
-- BATAS LOGIN PER AKUN + IP (api/_login_guard.php).
--
-- MENGAPA:
--   Batas lama hanya "5 permintaan / 15 menit per IP", termasuk login yang BERHASIL. Satu
--   kantor/warnet (satu IP NAT) bisa saling mengunci, sementara penyerang yang berganti IP
--   bisa menebak sandi satu akun tanpa batas. Tabel ini mencatat percobaan supaya batas
--   bisa dihitung per akun, per akun+IP, dan per IP — hanya dari percobaan yang GAGAL.
--
-- PRIVASI: subjek disimpan sebagai SHA-256 (email/kunci lisensi tidak disimpan polos).
-- Baris lebih tua dari 1 hari dibersihkan otomatis oleh api/_login_guard.php.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak mengubah tabel lain.

CREATE TABLE IF NOT EXISTS `login_attempts` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `subject_hash` CHAR(64)    NOT NULL,          -- sha256('email:…' | 'license:…' | 'google')
    `ip`           VARCHAR(45) NOT NULL,
    `success`      TINYINT(1)  NOT NULL DEFAULT 0,
    `created_at`   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_la_subjek` (`subject_hash`, `created_at`),
    INDEX `idx_la_ip` (`ip`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- catatan migrasi yang sudah diterapkan (dipakai database/migrate.php bila kelak dijalankan) ----
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL UNIQUE,
  `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO `migrations` (`filename`) VALUES
  ('003_account_analytics_and_payment_events.sql'),
  ('004_readonly_mt_bridge.sql'),
  ('005_mt5_execution_controls.sql'),
  ('007_ai_autotrade_tables.sql'),
  ('008_execution_auto_queue.sql'),
  ('009_ai_signal_journal.sql'),
  ('010_ai_webhook_logs.sql'),
  ('011_ai_sl_events.sql'),
  ('012_ai_method_versions.sql'),
  ('013_quantum_engine_outputs.sql'),
  ('014_fundamental_events.sql'),
  ('015_ai_method_versions_status.sql'),
  ('016_user_notification_settings.sql'),
  ('017_competition.sql'),
  ('018_push_subscriptions.sql'),
  ('019_user_chart_state.sql'),
  ('020_account_security.sql'),
  ('021_competition_eligibility.sql'),
  ('023_login_attempts.sql');
