-- 016_user_notification_settings.sql
-- NOTIFIKASI SINYAL PER PENGGUNA (Fase 2): Telegram, Discord, Slack, email, desktop.
--
-- MENGAPA tabel baru:
--   Notifikasi Telegram lama bersifat GLOBAL (satu bot + satu chat milik admin, disimpan
--   di cache/telegram.json). Setiap pengguna kini dapat memilih sendiri kanal yang ia
--   inginkan, sehingga satu sinyal disebar ke semua kanal yang diaktifkan tiap pengguna.
--
-- KEAMANAN yang dijaga:
--   · URL webhook Discord/Slack adalah RAHASIA (siapa pun yang memegangnya bisa memposting
--     ke kanal itu). Disimpan TERENKRIPSI (AES-256-GCM, kolom *_webhook_enc) — bukan teks
--     biasa — dan tidak pernah dikembalikan utuh ke peramban; UI hanya menerima petunjuk
--     singkat (*_webhook_hint, mis. "discord.com/…/abcd").
--   · Email hanya dikirim ke alamat akun (users.email), bukan alamat bebas, supaya fitur ini
--     tidak bisa dipakai untuk mengirim surat ke orang lain.
--
-- notification_deliveries:
--   Jejak pengiriman per sinyal × pengguna × kanal. Kunci unik (signal_id, user_id, channel)
--   menjadi KLAIM ATOMIK: sinyal yang tercatat ulang tidak pernah dikirim dua kali ke kanal
--   yang sama. Hasil (berhasil/gagal + kode HTTP + catatan) disimpan apa adanya.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `user_notification_settings` (
    `user_id`              BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    `telegram_enabled`     TINYINT(1)   NOT NULL DEFAULT 0,
    `telegram_chat_id`     VARCHAR(64)  NULL,
    `discord_enabled`      TINYINT(1)   NOT NULL DEFAULT 0,
    `discord_webhook_enc`  TEXT         NULL,
    `discord_webhook_hint` VARCHAR(64)  NULL,
    `slack_enabled`        TINYINT(1)   NOT NULL DEFAULT 0,
    `slack_webhook_enc`    TEXT         NULL,
    `slack_webhook_hint`   VARCHAR(64)  NULL,
    `email_enabled`        TINYINT(1)   NOT NULL DEFAULT 0,
    `desktop_enabled`      TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_deliveries` (
    `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `signal_id`   VARCHAR(80)  NOT NULL,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `channel`     ENUM('telegram', 'discord', 'slack', 'email') NOT NULL,
    `ok`          TINYINT(1)   NULL,            -- NULL = sedang dikirim (klaim), 1 = berhasil, 0 = gagal
    `http_code`   SMALLINT     NULL,
    `note`        VARCHAR(255) NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_notif_kirim` (`signal_id`, `user_id`, `channel`),
    INDEX `idx_notif_user_waktu` (`user_id`, `created_at`),
    CONSTRAINT `fk_notif_kirim_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
