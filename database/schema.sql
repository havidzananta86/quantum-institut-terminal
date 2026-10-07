-- ============================================================
-- QUANTUM INSTITUT MARKET TERMINAL — DATABASE SCHEMA v2
-- Updated: 2026-10-07
-- ============================================================

CREATE DATABASE IF NOT EXISTS `quantum_market_terminal`
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `quantum_market_terminal`;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `full_name`     VARCHAR(100) NOT NULL,
    `email`         VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `phone_number`  VARCHAR(20)  NULL,
    -- 'pro' = user berlangganan aktif; 'admin' = super user
    `role`          ENUM('user', 'pro', 'vip', 'admin') DEFAULT 'user',
    `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
    `status`        ENUM('active', 'suspended', 'expired') DEFAULT 'active',
    `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_role`  (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. USER SESSIONS (token auth — dipakai oleh api/auth.php)
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_sessions` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`      BIGINT UNSIGNED NOT NULL,
    -- Disimpan sebagai SHA-256 hash dari token asli
    `token`        VARCHAR(64)  NOT NULL UNIQUE,
    `ip_address`   VARCHAR(45)  NULL,
    `user_agent`   VARCHAR(500) NULL,
    `expires_at`   DATETIME     NOT NULL,
    `created_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_token`      (`token`),
    INDEX `idx_user_exp`   (`user_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. LICENSE KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS `license_keys` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`      BIGINT UNSIGNED NOT NULL,
    `license_key`  VARCHAR(64)  NOT NULL UNIQUE,
    `plan_name`    ENUM('1 Bulan', '3 Bulan', '6 Bulan', '12 Bulan') NOT NULL,
    `active_slots` INT          DEFAULT 12,
    `is_active`    TINYINT(1)   DEFAULT 1,
    `activated_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `expires_at`   DATETIME     NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_key`     (`license_key`),
    INDEX `idx_user_lk` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. SUBSCRIPTION ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS `subscription_orders` (
    `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_code`     VARCHAR(50)  NOT NULL UNIQUE,
    `user_id`        BIGINT UNSIGNED NULL,   -- NULL = guest order sebelum registrasi
    `email`          VARCHAR(150) NULL,       -- email kontak untuk notifikasi
    `plan_name`      VARCHAR(50)  NOT NULL,
    `amount_idr`     DECIMAL(12,2) NOT NULL,
    `payment_method` VARCHAR(50)  DEFAULT 'QRIS',
    `payment_status` ENUM('pending','paid','expired','failed') DEFAULT 'pending',
    `paid_at`        DATETIME     NULL,
    `license_issued` TINYINT(1)   DEFAULT 0, -- 1 setelah lisensi dikirim
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_status` (`payment_status`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. QUANTUM ENGINES (9 mesin)
-- ============================================================
CREATE TABLE IF NOT EXISTS `quantum_engines` (
    `id`           INT  AUTO_INCREMENT PRIMARY KEY,
    `code`         VARCHAR(50)  NOT NULL UNIQUE,
    `name`         VARCHAR(100) NOT NULL,
    `timeframes`   VARCHAR(100) NOT NULL,
    `market_types` VARCHAR(100) NOT NULL,
    `is_pro_only`  TINYINT(1)   DEFAULT 0,
    `description`  TEXT         NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `quantum_engines`
    (`code`, `name`, `timeframes`, `market_types`, `is_pro_only`, `description`)
VALUES
    ('SNR',          'Quantum SNR',              'M15, H1, H4', 'ALL PAIRS',       0, 'Level berulang & kekuatan retest Support/Resistance.'),
    ('SMC',          'Quantum SMC',              'H1, H4',      'CRYPTO/FOREX',    0, 'Struktur pasar, Order Block, dan Liquidity Sweep.'),
    ('EMA200',       'Quantum EMA200 Pullback',  'H1',          'TREND FOLLOWING', 0, 'Identifikasi tren makro & penolakan EMA200.'),
    ('ICHI',         'Quantum Ichimoku',         'H4, D1',      'ALL MARKET',      0, 'Analisa kepadatan Kumo Cloud & TK cross.'),
    ('FIBO',         'Quantum Fibonacci',        'M30, H1',     'GOLDEN ZONE',     0, 'Rasio emas retracement 0.382–0.618.'),
    ('TRENM5',       'Quantum TrenM5',           'M5',          'SCALPING',        1, 'Koreksi singkat 1–3 candle scalping M5.'),
    ('MOMENTUM_NY',  'Quantum MomentumNY',       'M15, H1',     'GOLD/NY SESSION', 1, 'Impuls Emas & Forex sesi New York 19:30 WIB.'),
    ('MACD_MOM',     'Quantum MACD Momentum',    'H1, H4',      'ALL PAIRS',       1, 'Histogram cross nol & konfirmasi volume.'),
    ('GOLDEN_CROSS', 'Quantum Golden Cross',     'H4, D1',      'ALL PAIRS',       1, 'Persilangan EMA50 x EMA200 jangka panjang.')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`);

-- ============================================================
-- 6. SIGNAL LOGS (audit trail semua sinyal yang dihasilkan mesin)
-- ============================================================
CREATE TABLE IF NOT EXISTS `signal_logs` (
    `id`                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `engine_code`        VARCHAR(50)  NOT NULL,
    `symbol`             VARCHAR(30)  NOT NULL,
    `timeframe`          VARCHAR(10)  NOT NULL,
    `direction`          ENUM('BUY','SELL','NEUTRAL') DEFAULT 'NEUTRAL',
    `status`             ENUM('SETUP','PANTAU','TIDAK DICETAK','HIT_TP','HIT_SL','EXPIRED') NOT NULL DEFAULT 'PANTAU',
    `entry_price_range`  VARCHAR(100) NOT NULL,
    `stop_loss_price`    VARCHAR(100) NOT NULL,
    `take_profit_price`  VARCHAR(100) NOT NULL,
    `risk_reward_ratio`  VARCHAR(20)  NOT NULL,
    `execution_cost_pct` DECIMAL(5,2) DEFAULT 5.00,
    `checklist_score`    TINYINT      DEFAULT 0,      -- berapa poin checklist terpenuhi (0-8)
    `requirements_json`  JSON         NOT NULL,
    `closed_at`          DATETIME     NULL,
    `created_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_symbol`   (`symbol`),
    INDEX `idx_status`   (`status`),
    INDEX `idx_engine`   (`engine_code`),
    INDEX `idx_created`  (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. PRICE ALERTS (alert harga pengguna)
-- ============================================================
CREATE TABLE IF NOT EXISTS `price_alerts` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `symbol`      VARCHAR(30)  NOT NULL,
    `target_price` DECIMAL(18,6) NOT NULL,
    `direction`   ENUM('above','below') NOT NULL,
    `is_triggered` TINYINT(1)  DEFAULT 0,
    `triggered_at` DATETIME    NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_alert_symbol` (`symbol`, `is_triggered`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. PAPER TRADING (posisi simulasi per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS `paper_positions` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`      BIGINT UNSIGNED NOT NULL,
    `symbol`       VARCHAR(30)  NOT NULL,
    `direction`    ENUM('BUY','SELL') NOT NULL,
    `lots`         DECIMAL(10,2) DEFAULT 0.10,
    `entry_price`  DECIMAL(18,6) NOT NULL,
    `stop_loss`    DECIMAL(18,6) NULL,
    `take_profit`  DECIMAL(18,6) NULL,
    `close_price`  DECIMAL(18,6) NULL,
    `pnl_usd`      DECIMAL(12,4) NULL,
    `status`       ENUM('open','closed','cancelled') DEFAULT 'open',
    `opened_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `closed_at`    DATETIME     NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_pp_user`   (`user_id`, `status`),
    INDEX `idx_pp_symbol` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
