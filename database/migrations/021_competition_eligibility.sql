-- 021_competition_eligibility.sql
-- SYARAT HADIAH KOMPETISI: jejak pendaftaran untuk pemeriksaan satu orang satu akun.
--
-- MENGAPA:
--   Pemenang harus memenuhi syarat (api/_kompetisi_syarat.php). Pemeriksaan multi-akun
--   membandingkan IP publik peserta; IP saat mendaftar dicatat di sini (sesi lama dihapus
--   saat login baru, jadi tidak bisa diandalkan sendirian). Data hanya dipakai admin untuk
--   meninjau kandidat pemenang, tidak pernah ditampilkan ke peserta lain.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak mengubah tabel lain.

CREATE TABLE IF NOT EXISTS `competition_join_log` (
    `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tournament_key` VARCHAR(40)  NOT NULL,
    `period_key`     VARCHAR(20)  NOT NULL,
    `user_id`        BIGINT UNSIGNED NOT NULL,
    `ip`             VARCHAR(45)  NULL,
    `user_agent`     VARCHAR(200) NULL,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_cjl_periode` (`tournament_key`, `period_key`),
    INDEX `idx_cjl_user` (`user_id`),
    CONSTRAINT `fk_cjl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
