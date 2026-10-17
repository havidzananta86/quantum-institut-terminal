<?php
/**
 * Skema "posisi akun MT" (bridge read-only): tabel trading_account_positions + kolom
 * trading_accounts.share_positions. Dulu hanya dirujuk "migrasi 006" yang tidak pernah ada,
 * sehingga posisi dari EA tidak pernah tersimpan dan feed posisi selalu MIGRATION_REQUIRED.
 * Dibuat otomatis saat pertama dipakai (lihat juga database/migrations/025_trading_account_positions.sql).
 *
 * PENTING: CREATE/ALTER TABLE memicu commit implisit di MySQL — panggil SEBELUM beginTransaction().
 */

function qi_posisi_akun_siapkan(PDO $pdo): bool
{
    static $siap = null;
    if ($siap !== null) return $siap;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS trading_account_positions (
            trading_account_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            positions_json MEDIUMTEXT NOT NULL,
            open_count INT UNSIGNED NOT NULL DEFAULT 0,
            captured_at DATETIME NOT NULL,
            KEY idx_positions_captured (captured_at),
            CONSTRAINT fk_positions_account
                FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        if (!$pdo->query("SHOW COLUMNS FROM trading_accounts LIKE 'share_positions'")->fetch()) {
            $pdo->exec("ALTER TABLE trading_accounts ADD COLUMN share_positions TINYINT(1) NOT NULL DEFAULT 0");
        }
        $siap = true;
    } catch (Throwable $e) {
        error_log('[posisi-akun] skema belum bisa dibuat: ' . $e->getMessage());
        $siap = false;
    }
    return $siap;
}
