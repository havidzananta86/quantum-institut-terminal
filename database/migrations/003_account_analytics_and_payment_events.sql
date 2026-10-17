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
