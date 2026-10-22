<?php
/**
 * Skema kompetisi langsung (database/migrations/027_kompetisi_live.sql) diterapkan SAAT RUNTIME.
 *
 * Hostinger tidak punya SSH untuk menjalankan migrasi, jadi kode memeriksa INFORMATION_SCHEMA lalu
 * menambahkan kolom/indeks yang belum ada — pola yang sama dengan api/_posisi_akun.php. Setelah
 * berhasil, berkas penanda cache/kompetisi/skema-027.ok membuat pemeriksaan berikutnya gratis.
 *
 * PENTING: ALTER/CREATE TABLE memicu commit implisit di MySQL — panggil SEBELUM beginTransaction().
 */

require_once __DIR__ . '/_kompetisi_inti.php';

if (!function_exists('qi_komp_dir')) {
    /** Folder kerja kompetisi di cache/ (diblokir .htaccess, tidak ikut git). */
    function qi_komp_dir(): string
    {
        $d = __DIR__ . '/../cache/kompetisi';
        if (!is_dir($d)) @mkdir($d, 0755, true);
        return $d;
    }
}

if (!function_exists('qi_komp_skema_siapkan')) {
    /**
     * @param string|null $penanda berkas penanda (uji memakai folder sementara); null = cache/kompetisi
     * @return bool true bila semua kolom, indeks, dan tabel klasemen ada
     */
    function qi_komp_skema_siapkan(PDO $pdo, ?string $penanda = null): bool
    {
        static $siap = [];
        // Penanda v2: kolom harga_sumber/harga_geser (seri harga posisi, audit G1) ditambahkan setelah
        // 027 pertama — penanda baru membuat pemeriksaan INFORMATION_SCHEMA berjalan sekali lagi.
        $penanda = $penanda ?? (qi_komp_dir() . '/skema-027-v2.ok');
        if (isset($siap[$penanda])) return $siap[$penanda];
        if (is_file($penanda)) return $siap[$penanda] = true;
        try {
            $kolom = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions'")->fetchAll(PDO::FETCH_COLUMN);
            $kolom = array_flip(array_map('strtolower', $kolom));
            $tambahKolom = [
                'komp_periode'    => 'ADD COLUMN komp_periode VARCHAR(20) NULL AFTER source',
                'client_order_id' => 'ADD COLUMN client_order_id VARCHAR(40) NULL',
                'asal'            => 'ADD COLUMN asal VARCHAR(12) NULL',
                'close_reason'    => "ADD COLUMN close_reason ENUM('manual','sl','tp','stopout','period_end') NULL",
                'sltp_checked_at' => 'ADD COLUMN sltp_checked_at DATETIME NULL',
                // Seri harga tempat posisi diisi: sumber kutipan kanonik + G (XAUUSD proksi PAXG). Posisi
                // hanya dinilai/ditutup di seri itu (api/_kompetisi_harga.php, qi_komp_kutipan_posisi).
                'harga_sumber'    => 'ADD COLUMN harga_sumber VARCHAR(24) NULL',
                'harga_geser'     => 'ADD COLUMN harga_geser DECIMAL(18,6) NULL',
            ];
            $ubah = [];
            foreach ($tambahKolom as $nama => $sql) if (!isset($kolom[$nama])) $ubah[] = $sql;

            $indeks = $pdo->query("SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
                                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions'")->fetchAll(PDO::FETCH_COLUMN);
            $indeks = array_flip(array_map('strtolower', $indeks));
            $tambahIndeks = [
                'uq_pp_order'   => 'ADD UNIQUE KEY uq_pp_order (user_id, client_order_id)',
                'idx_pp_komp'   => 'ADD INDEX idx_pp_komp (komp_periode, source, status)',
                'idx_pp_closed' => 'ADD INDEX idx_pp_closed (status, source, closed_at)',
            ];
            foreach ($tambahIndeks as $nama => $sql) if (!isset($indeks[$nama])) $ubah[] = $sql;
            $kolomBaru = !isset($kolom['komp_periode']);
            // Satu ALTER untuk semuanya: tabel hanya dibangun ulang sekali.
            if ($ubah) $pdo->exec('ALTER TABLE paper_positions ' . implode(', ', $ubah));

            $pdo->exec("CREATE TABLE IF NOT EXISTS competition_standings (
                period_key VARCHAR(20) NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                equity DECIMAL(14,2) NULL,
                realized DECIMAL(14,2) NULL,
                floating DECIMAL(14,2) NULL,
                open_count INT NOT NULL DEFAULT 0,
                trades INT NOT NULL DEFAULT 0,
                wins INT NOT NULL DEFAULT 0,
                rank_pos INT NULL,
                final TINYINT(1) NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (period_key, user_id),
                INDEX idx_cs_final (period_key, final)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // Sekali saja, saat kolom baru dibuat: posisi manual yang dibuka sejak awal minggu
            // berjalan ikut periode ini (papan lama menghitungnya juga), pemiliknya PRO ke atas ikut
            // terdaftar. Batas periode dikirim sebagai epoch (zona PHP ≠ zona MySQL).
            // Daftar peran = tingkat 1–2 qi_tingkat_peran() (sama dengan pendaftaran otomatis 'buka');
            // dulu hanya 'pro','vip' — premium/vip_plus/elite pindah ke papan tetapi tidak terdaftar.
            if ($kolomBaru) {
                [$mulai, , $kunci] = qi_komp_periode_kini();
                $pdo->prepare("UPDATE paper_positions SET komp_periode = :p
                               WHERE source = 'manual' AND komp_periode IS NULL AND status IN ('open','closed')
                                 AND (asal IS NULL OR asal <> 'sinyal') AND opened_at >= FROM_UNIXTIME(:m)")
                    ->execute([':p' => $kunci, ':m' => $mulai->getTimestamp()]);
                try {
                    $pdo->prepare("INSERT IGNORE INTO competition_entries (tournament_key, period_key, user_id)
                                   SELECT DISTINCT :t, :p, pp.user_id FROM paper_positions pp JOIN users u ON u.id = pp.user_id
                                   WHERE pp.komp_periode = :p2 AND u.role IN ('pro','premium','vip','vip_plus','elite')")
                        ->execute([':t' => QI_KOMP_TURNAMEN, ':p' => $kunci, ':p2' => $kunci]);
                } catch (PDOException $e) { /* competition_entries (migrasi 017) belum ada */ }
            }
            @file_put_contents($penanda, date('c'), LOCK_EX);
            return $siap[$penanda] = true;
        } catch (Throwable $e) {
            error_log('[kompetisi] skema 027 belum bisa diterapkan: ' . $e->getMessage());
            return $siap[$penanda] = false;
        }
    }
}
