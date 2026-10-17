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
