-- 020_account_security.sql
-- KEAMANAN AKUN: verifikasi dua langkah (OTP email + kode cadangan) dan log aktivitas.
--
-- user_security   : status 2FA per pengguna. Kode cadangan disimpan sebagai hash (password_hash),
--                   tidak pernah teks biasa; kode penyiapan (setup_*) berlaku 10 menit.
-- session_2fa     : sesi yang BELUM lolos 2FA. Selama barisnya ada, token sesi itu ditolak oleh
--                   qi_validate_token() — login baru benar-benar aktif setelah kode diverifikasi.
-- security_events : jejak login, 2FA, keluar, dan ganti kata sandi (alamat IP & perangkat).
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `user_security` (
    `user_id`          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    `twofa_email`      TINYINT(1)   NOT NULL DEFAULT 0,
    `twofa_enabled_at` DATETIME     NULL,
    `backup_codes`     TEXT         NULL,
    `setup_code_hash`  VARCHAR(255) NULL,
    `setup_expires_at` DATETIME     NULL,
    `setup_attempts`   INT          NOT NULL DEFAULT 0,
    `updated_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_usec_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `session_2fa` (
    `token_hash`  CHAR(64)     NOT NULL PRIMARY KEY,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `code_hash`   VARCHAR(255) NOT NULL,
    `expires_at`  DATETIME     NOT NULL,
    `attempts`    INT          NOT NULL DEFAULT 0,
    `sent_at`     DATETIME     NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_s2fa_user` (`user_id`),
    CONSTRAINT `fk_s2fa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `security_events` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `event`       VARCHAR(40)  NOT NULL,
    `ip`          VARCHAR(45)  NULL,
    `user_agent`  VARCHAR(200) NULL,
    `detail`      VARCHAR(255) NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_secev_user_waktu` (`user_id`, `created_at`),
    CONSTRAINT `fk_secev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
