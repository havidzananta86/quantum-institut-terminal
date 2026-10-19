-- 026_signal_records.sql
-- REKOR SINYAL BAYANGAN & PINE di database (api/_rekor_db.php).
--
-- Sampai sekarang rekor ini hanya hidup di cache/signal_shadow.json dan cache/pine_signals.json.
-- Data bayangan menjadi dasar keputusan auto-entry (target >= 100 sinyal tertutup), jadi tidak boleh
-- bergantung pada satu berkas cache yang bisa rusak/terhapus. Tahap ini DUAL-WRITE: berkas JSON tetap
-- sumber utama; tabel ini salinan yang bisa dicari dan dicadangkan. Rekor sinyal resmi sudah punya
-- pendamping sendiri (ai_signal_journal, migrasi 009).
--
-- Tabel ini juga dibuat otomatis oleh kode (CREATE TABLE IF NOT EXISTS) saat pertama dipakai,
-- jadi mengimpor berkas ini bersifat OPSIONAL.
--
-- Waktu disimpan sebagai epoch UTC (INT) — zona waktu PHP dan MySQL di server tidak selalu sama.
--
-- SIFAT MIGRASI: idempoten, tidak mengubah tabel lain, tidak menghapus data.

CREATE TABLE IF NOT EXISTS `signal_records` (
    `source`       VARCHAR(16)   NOT NULL,                -- 'shadow' | 'pine'
    `id`           VARCHAR(64)   NOT NULL,
    `symbol`       VARCHAR(30)   NOT NULL,
    `side`         VARCHAR(4)    NOT NULL,
    `method`       VARCHAR(40)   NULL,
    `status`       VARCHAR(24)   NOT NULL,
    `entry`        DECIMAL(20,8) NULL,
    `sl`           DECIMAL(20,8) NULL,
    `tp`           DECIMAL(20,8) NULL,
    `exit_price`   DECIMAL(20,8) NULL,
    `pnl`          DECIMAL(20,8) NULL,
    `r_multiple`   DECIMAL(10,4) NULL,                    -- R bersih (qi_signal_r_satu), null bila belum selesai
    `spread`       DECIMAL(20,8) NULL,
    `created_ts`   INT UNSIGNED  NOT NULL,
    `filled_ts`    INT UNSIGNED  NULL,
    `closed_ts`    INT UNSIGNED  NULL,
    `data`         MEDIUMTEXT    NOT NULL,                -- rekor lengkap (JSON) apa adanya
    `updated_at`   INT UNSIGNED  NOT NULL,
    PRIMARY KEY (`source`, `id`),
    KEY `idx_source_status` (`source`, `status`),
    KEY `idx_source_created` (`source`, `created_ts`),
    KEY `idx_symbol` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
