-- 027_kompetisi_live.sql
-- ARENA KOMPETISI LANGSUNG: periode per order, order idempoten, alasan penutupan, SL/TP server,
-- dan klasemen beku per periode.
--
-- MENGAPA (audit kompetisi 2026-10-22):
--   · Papan peringkat dulu hanya menghitung trade yang DITUTUP dalam minggu itu. Posisi rugi bisa
--     dibiarkan terbuka tanpa batas, dan P/L posisi minggu lalu yang ditutup Senin ikut minggu ini.
--     Kini setiap order kompetisi diberi `komp_periode` (kunci periode saat DIBUKA, jam server),
--     dan peringkat = ekuitas = 10.000 + terealisasi + mengambang dari baris periode itu.
--   · Klik ganda / jaringan putus membuat order hilang atau ganda. `client_order_id` + UNIQUE
--     (user_id, client_order_id) membuat pengiriman ulang idempoten: duplikat → baris yang sama.
--   · SL/TP posisi manual tidak pernah ditegakkan server. `close_reason` mencatat siapa yang
--     menutup ('manual' | 'sl' | 'tp' | 'stopout' | 'period_end'), `sltp_checked_at` adalah batas
--     bar M1 yang sudah diperiksa supaya bar yang sama tidak dinilai dua kali.
--   · Klasemen akhir periode dibekukan di `competition_standings` (final = 1).
--   · (audit G1) `harga_sumber` / `harga_geser`: seri harga tempat posisi diisi. XAUUSD punya dua level
--     (emas nyata MT5/OANDA vs PROKSI PAXG + G); posisi hanya dinilai, ditutup, dan diperiksa SL/TP-nya
--     di seri tempat ia dibuka — dulu harga melompat ±$7 saat feed/jangkar berganti dan posisi yang
--     dibuka di satu level ditutup di level lain.
--   · Posisi periode lalu yang tidak pernah punya harga apa pun sebelum batas (tidak ada bar, tidak
--     ada kutipan tercatat) dibatalkan server 72 jam setelah batas: status = 'cancelled',
--     close_reason = 'period_end', tanpa P/L — tidak pernah ditutup di harga tebakan, dan tidak bisa
--     lagi ditutup pemiliknya di harga pilihannya sendiri.
--
-- Semua perubahan ini JUGA diterapkan otomatis oleh kode saat pertama dipakai
-- (api/_kompetisi_skema.php → qi_komp_skema_siapkan(): periksa INFORMATION_SCHEMA, lalu ALTER),
-- karena Hostinger tidak punya akses SSH untuk menjalankan migrasi. Berkas ini catatan skemanya.
--
-- SIFAT MIGRASI: aditif, tidak menghapus data. MySQL tidak punya ADD COLUMN IF NOT EXISTS, jadi
-- bila menjalankan manual, lewati baris yang kolom/indeksnya sudah ada.

ALTER TABLE `paper_positions`
    ADD COLUMN `komp_periode`    VARCHAR(20) NULL AFTER `source`,
    ADD COLUMN `client_order_id` VARCHAR(40) NULL,
    ADD COLUMN `asal`            VARCHAR(12) NULL,               -- 'tiket' | 'quick' | 'form' | 'sinyal'
    ADD COLUMN `close_reason`    ENUM('manual','sl','tp','stopout','period_end') NULL,
    ADD COLUMN `sltp_checked_at` DATETIME    NULL,
    ADD COLUMN `harga_sumber`    VARCHAR(24) NULL,               -- sumber kutipan kanonik saat diisi
    ADD COLUMN `harga_geser`     DECIMAL(18,6) NULL,             -- G (emas − PAXG) untuk posisi proksi XAUUSD
    ADD UNIQUE KEY `uq_pp_order`  (`user_id`, `client_order_id`),
    ADD INDEX      `idx_pp_komp`  (`komp_periode`, `source`, `status`),
    ADD INDEX      `idx_pp_closed` (`status`, `source`, `closed_at`);

-- Posisi manual yang dibuka sejak awal minggu berjalan (sebelum kolom ada) ikut periode berjalan.
-- Kode melakukannya sekali dengan kunci periode WIB yang benar; contoh untuk 2026-W43:
-- UPDATE paper_positions SET komp_periode = '2026-W43'
--  WHERE source = 'manual' AND komp_periode IS NULL AND status IN ('open','closed')
--    AND opened_at >= '2026-10-19 00:00:00';

CREATE TABLE IF NOT EXISTS `competition_standings` (
    `period_key` VARCHAR(20)     NOT NULL,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `equity`     DECIMAL(14,2)   NULL,
    `realized`   DECIMAL(14,2)   NULL,
    `floating`   DECIMAL(14,2)   NULL,
    `open_count` INT             NOT NULL DEFAULT 0,
    `trades`     INT             NOT NULL DEFAULT 0,
    `wins`       INT             NOT NULL DEFAULT 0,
    `rank_pos`   INT             NULL,
    `final`      TINYINT(1)      NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`period_key`, `user_id`),
    INDEX `idx_cs_final` (`period_key`, `final`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
