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
ALTER TABLE paper_positions ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual';
