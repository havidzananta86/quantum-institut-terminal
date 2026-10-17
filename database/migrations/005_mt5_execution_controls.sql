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
