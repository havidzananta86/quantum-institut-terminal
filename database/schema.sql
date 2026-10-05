-- ============================================================
-- QUANTUM INSTITUT MARKET TERMINAL DATABASE SCHEMA (MySQL / Postgres)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `quantum_market_terminal` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `quantum_market_terminal`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20) NULL,
    `role` ENUM('user', 'vip', 'admin') DEFAULT 'user',
    `status` ENUM('active', 'suspended', 'expired') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. LICENSE KEYS TABLE
CREATE TABLE IF NOT EXISTS `license_keys` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `license_key` VARCHAR(64) NOT NULL UNIQUE,
    `plan_name` ENUM('1 Bulan', '3 Bulan', '6 Bulan', '12 Bulan') NOT NULL,
    `active_slots` INT DEFAULT 12,
    `is_active` TINYINT(1) DEFAULT 1,
    `activated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. SUBSCRIPTION ORDERS TABLE
CREATE TABLE IF NOT EXISTS `subscription_orders` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_code` VARCHAR(50) NOT NULL UNIQUE,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `plan_name` VARCHAR(50) NOT NULL,
    `amount_idr` DECIMAL(12,2) NOT NULL,
    `payment_method` VARCHAR(50) DEFAULT 'QRIS',
    `payment_status` ENUM('pending', 'paid', 'expired', 'failed') DEFAULT 'pending',
    `paid_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. QUANTUM ENGINES TABLE (9 Engines)
CREATE TABLE IF NOT EXISTS `quantum_engines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `timeframes` VARCHAR(100) NOT NULL,
    `market_types` VARCHAR(100) NOT NULL,
    `is_pro_only` TINYINT(1) DEFAULT 0,
    `description` TEXT NOT NULL
) ENGINE=InnoDB;

-- Seed 9 Quantum Engines
INSERT INTO `quantum_engines` (`code`, `name`, `timeframes`, `market_types`, `is_pro_only`, `description`) VALUES
('SNR', 'Quantum SNR', 'M15, H1, H4', 'ALL PAIRS', 0, 'Level berulang & kekuatan retest Support/Resistance.'),
('SMC', 'Quantum SMC', 'H1, H4', 'CRYPTO/FOREX', 0, 'Struktur pasar, Order Block, dan Liquidity Sweep.'),
('EMA200', 'Quantum EMA200 Pullback', 'H1', 'TREND FOLLOWING', 0, 'Identifikasi tren makro & penolakan EMA200.'),
('ICHI', 'Quantum Ichimoku', 'H4, D1', 'ALL MARKET', 0, 'Analisa kepadatan Kumo Cloud & TK cross.'),
('FIBO', 'Quantum Fibonacci', 'M30, H1', 'GOLDEN ZONE', 0, 'Rasio emas retracement 0.382–0.618.'),
('TRENM5', 'Quantum TrenM5', 'M5', 'SCALPING', 1, 'Koreksi singkat 1–3 candle scalping m5.'),
('MOMENTUM_NY', 'Quantum MomentumNY', 'M15, H1', 'GOLD/NY SESSION', 1, 'Impuls Emas & Forex sesi New York 19:30 WIB.'),
('MACD_MOM', 'Quantum MACD Momentum', 'H1, H4', 'ALL PAIRS', 1, 'Histogram cross nol & konfirmasi volume.'),
('GOLDEN_CROSS', 'Quantum Golden Cross', 'H4, D1', 'ALL PAIRS', 1, 'Persilangan EMA50 x EMA200 jangka panjang.')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 5. SIGNAL LOGS TABLE
CREATE TABLE IF NOT EXISTS `signal_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `engine_code` VARCHAR(50) NOT NULL,
    `symbol` VARCHAR(30) NOT NULL,
    `timeframe` VARCHAR(10) NOT NULL,
    `status` ENUM('SETUP', 'PANTAU', 'TIDAK DICETAK') NOT NULL,
    `entry_price_range` VARCHAR(100) NOT NULL,
    `stop_loss_price` VARCHAR(100) NOT NULL,
    `take_profit_price` VARCHAR(100) NOT NULL,
    `risk_reward_ratio` VARCHAR(20) NOT NULL,
    `execution_cost_pct` DECIMAL(5,2) DEFAULT 5.00,
    `requirements_json` JSON NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`symbol`),
    INDEX (`status`),
    INDEX (`created_at`)
) ENGINE=InnoDB;
