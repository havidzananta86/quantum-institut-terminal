-- 018_push_subscriptions.sql
-- LANGGANAN WEB PUSH — notifikasi sinyal & price alert walau tab dashboard ditutup.
--
-- Satu baris = satu peramban/perangkat yang mengizinkan push (PushSubscription).
--   · endpoint     : URL layanan push resmi (FCM/Mozilla/WNS/Apple) — divalidasi di api/_push.php
--   · p256dh, auth : kunci enkripsi milik peramban (base64url), bukan rahasia server
--   · endpoint_hash: kunci unik (endpoint bisa > 255 karakter)
-- Langganan yang dijawab 404/410 oleh layanan push dihapus otomatis saat pengiriman.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`       BIGINT UNSIGNED NOT NULL,
    `endpoint`      TEXT         NOT NULL,
    `endpoint_hash` CHAR(64)     NOT NULL,
    `p256dh`        VARCHAR(120) NOT NULL,
    `auth`          VARCHAR(40)  NOT NULL,
    `user_agent`    VARCHAR(200) NULL,
    `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `last_ok_at`    DATETIME     NULL,
    `fail_count`    INT          NOT NULL DEFAULT 0,
    UNIQUE KEY `uq_push_endpoint` (`endpoint_hash`),
    INDEX `idx_push_user` (`user_id`),
    CONSTRAINT `fk_push_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
