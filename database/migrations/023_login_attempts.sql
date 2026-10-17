-- 023_login_attempts.sql
-- BATAS LOGIN PER AKUN + IP (api/_login_guard.php).
--
-- MENGAPA:
--   Batas lama hanya "5 permintaan / 15 menit per IP", termasuk login yang BERHASIL. Satu
--   kantor/warnet (satu IP NAT) bisa saling mengunci, sementara penyerang yang berganti IP
--   bisa menebak sandi satu akun tanpa batas. Tabel ini mencatat percobaan supaya batas
--   bisa dihitung per akun, per akun+IP, dan per IP — hanya dari percobaan yang GAGAL.
--
-- PRIVASI: subjek disimpan sebagai SHA-256 (email/kunci lisensi tidak disimpan polos).
-- Baris lebih tua dari 1 hari dibersihkan otomatis oleh api/_login_guard.php.
--
-- SIFAT MIGRASI: idempoten (CREATE TABLE IF NOT EXISTS), tidak mengubah tabel lain.

CREATE TABLE IF NOT EXISTS `login_attempts` (
    `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `subject_hash` CHAR(64)    NOT NULL,          -- sha256('email:…' | 'license:…' | 'google')
    `ip`           VARCHAR(45) NOT NULL,
    `success`      TINYINT(1)  NOT NULL DEFAULT 0,
    `created_at`   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_la_subjek` (`subject_hash`, `created_at`),
    INDEX `idx_la_ip` (`ip`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
