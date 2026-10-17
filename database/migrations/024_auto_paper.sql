-- 024_auto_paper.sql
-- IKUTI AUTO ANALISA (akun simulasi otomatis): api/_auto_paper.php, api/auto-paper.php.
--
-- Tabel-tabel ini juga dibuat otomatis oleh kode (CREATE TABLE IF NOT EXISTS) saat pertama dipakai,
-- jadi mengimpor berkas ini bersifat OPSIONAL; disimpan di sini sebagai catatan skema.
-- Posisi yang dibuka fitur ini memakai paper_positions.source = 'auto' (kolom sudah ada).
--
-- SIFAT MIGRASI: idempoten, tidak mengubah tabel lain, tidak menghapus data.

CREATE TABLE IF NOT EXISTS `auto_paper_settings` (
    `user_id`    INT UNSIGNED NOT NULL PRIMARY KEY,
    `enabled`    TINYINT(1)   NOT NULL DEFAULT 0,
    `risk_pct`   DECIMAL(4,2) NOT NULL DEFAULT 1.00,      -- % saldo simulasi yang dirisikokan per sinyal
    `enabled_at` INT UNSIGNED NOT NULL DEFAULT 0,         -- epoch: sinyal sebelum ini tidak diikuti
    `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auto_paper_links` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`     INT UNSIGNED NOT NULL,
    `signal_id`   VARCHAR(64)  NOT NULL,
    `position_id` INT UNSIGNED NOT NULL,                  -- 0 = sinyal dilewati (tidak dibuka), dicatat agar tidak dinilai ulang
    `risk_usd`    DECIMAL(14,2) NOT NULL DEFAULT 0,
    `created_at`  INT UNSIGNED NOT NULL,
    UNIQUE KEY `uq_user_signal` (`user_id`, `signal_id`),
    KEY `idx_position` (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
