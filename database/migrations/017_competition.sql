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
