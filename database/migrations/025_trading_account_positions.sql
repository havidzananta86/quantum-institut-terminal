-- 025_trading_account_positions.sql
-- Posisi terbuka per akun MT (bridge read-only) + izin berbagi posisi ke pengguna PRO/VIP lain.
-- Dirujuk api/mt-bridge.php, api/positions-feed.php, api/account-connection.php sebagai
-- "migrasi 006" yang tidak pernah ada di repo.
--
-- Juga dibuat otomatis oleh kode (api/_posisi_akun.php) saat pertama dipakai,
-- jadi mengimpor berkas ini bersifat OPSIONAL; disimpan di sini sebagai catatan skema.
--
-- SIFAT MIGRASI: idempoten untuk tabel; kolom share_positions ditambahkan hanya bila belum ada
-- (lewat kode). Tidak menghapus data.

CREATE TABLE IF NOT EXISTS `trading_account_positions` (
    `trading_account_id` BIGINT UNSIGNED NOT NULL PRIMARY KEY,   -- satu baris per akun, ditimpa tiap snapshot
    `positions_json`     MEDIUMTEXT      NOT NULL,
    `open_count`         INT UNSIGNED    NOT NULL DEFAULT 0,
    `captured_at`        DATETIME        NOT NULL,
    KEY `idx_positions_captured` (`captured_at`),
    CONSTRAINT `fk_positions_account`
        FOREIGN KEY (`trading_account_id`) REFERENCES `trading_accounts`(`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bila kolom belum ada (MySQL tidak punya ADD COLUMN IF NOT EXISTS):
-- ALTER TABLE `trading_accounts` ADD COLUMN `share_positions` TINYINT(1) NOT NULL DEFAULT 0;
