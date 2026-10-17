-- 019_user_chart_state.sql
-- STATE CHART PER AKUN — gambar chart & template tersinkron antar perangkat/peramban.
--
-- Dulu gambar (trendline, zona, fibo, …) dan template Custom hanya di localStorage, jadi hilang
-- saat ganti perangkat atau membersihkan peramban. Satu baris = satu kunci milik pengguna:
--   · lw:<SIMBOL_TV>   → JSON DrawingManager.exportJSON() untuk simbol itu (mis. lw:BINANCE_BTCUSDT)
--   · tpl:custom1|2    → template Custom (timeframe + indikator + gambar)
-- Konflik diselesaikan "penulis terakhir menang" berdasarkan client_updated_at (ms epoch).
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak menyentuh tabel lain.

CREATE TABLE IF NOT EXISTS `user_chart_state` (
    `user_id`           BIGINT UNSIGNED NOT NULL,
    `state_key`         VARCHAR(80)  NOT NULL,
    `state_value`       MEDIUMTEXT   NOT NULL,
    `client_updated_at` BIGINT       NOT NULL DEFAULT 0,
    `updated_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `state_key`),
    CONSTRAINT `fk_chart_state_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
