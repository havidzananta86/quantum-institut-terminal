<?php
declare(strict_types=1);
/**
 * JURNAL SINYAL AI — lapisan penyimpanan database (Tahap 1: fondasi audit).
 *
 * MENGAPA ADA:
 *   Rekor sinyal platform hidup di BERKAS cache/signal_history.json. Berkas itu tidak
 *   bisa dicari/difilter cepat, tidak bisa menyimpan gambar chart, tidak mencatat
 *   permintaan webhook, dan berisiko hilang bila rusak. Modul ini menambahkan jurnal
 *   database sebagai pendamping.
 *
 * PRINSIP PALING PENTING — JANGAN PERNAH MERUSAK YANG SUDAH JALAN:
 *   1. DUAL-WRITE: berkas JSON TETAP ditulis seperti sebelumnya. Database ditulis
 *      TAMBAHAN. Bila database mati/tabel belum dimigrasi, aplikasi tetap berjalan.
 *   2. FAIL-SAFE: semua fungsi di sini mengembalikan nilai aman (false/null) dan
 *      MENYIMPAN pesan galat — tidak pernah melempar exception ke pemanggil.
 *   3. PEMBACAAN: sementara ini pembacaan statistik TETAP dari berkas (nol risiko).
 *      Perpindahan pembacaan ke database dilakukan pada tahap berikutnya, setelah
 *      terbukti isinya identik (dibuktikan oleh qi_journal_bandingkan()).
 *   4. IDEMPOTEN: penyimpanan memakai INSERT ... ON DUPLICATE KEY UPDATE, sehingga
 *      menulis ulang rekor yang sama tidak pernah menggandakan data.
 */

require_once __DIR__ . '/_signal_time.php';   // baca waktu rekor (ISO UTC baru / lama tanpa zona)

if (!function_exists('qi_journal_koneksi')) {

    /** Pesan galat terakhir (untuk ditampilkan di panel/uji, bukan untuk disembunyikan). */
    function qi_journal_galat_terakhir(): string
    {
        return (string)($GLOBALS['__qi_journal_galat'] ?? '');
    }

    /** Catat galat tanpa melempar exception. */
    function qi_journal_catat_galat(string $pesan): void
    {
        $GLOBALS['__qi_journal_galat'] = $pesan;
        if (function_exists('error_log')) {
            @error_log('[jurnal] ' . $pesan);
        }
    }

    /** Apakah tabel jurnal tersedia? Dicek sekali per permintaan (hasil di-cache). */
    function qi_journal_tersedia(bool $cekJurnal = true, bool $cekLog = false): bool
    {
        static $hasil = [];
        $kunci = ($cekJurnal ? '1' : '0') . ($cekLog ? '1' : '0');
        if (isset($hasil[$kunci])) return $hasil[$kunci];

        $hasil[$kunci] = false;
        try {
            if (!function_exists('getDBConnection')) {
                require_once __DIR__ . '/../config/database.php';
            }
            $pdo = getDBConnection();
            if ($cekJurnal) $pdo->query('SELECT 1 FROM `ai_signal_journal` LIMIT 1');
            if ($cekLog)    $pdo->query('SELECT 1 FROM `ai_webhook_logs` LIMIT 1');
            $hasil[$kunci] = true;
        } catch (Throwable $e) {
            qi_journal_catat_galat('tabel jurnal belum tersedia: ' . $e->getMessage());
        }
        return $hasil[$kunci];
    }

    /**
     * Ubah NILAI WAKTU rekor (string) menjadi format DATETIME MySQL, atau null.
     * Rekor memakai format 'Y-m-d H:i:s' dan 'Y-m-d\TH:i:sP' (ISO). Keduanya diterima;
     * dibaca lewat qi_sig_epoch() (closed_at lama tanpa zona = UTC). Kolom DATETIME
     * tetap ditulis dalam zona runtime seperti sebelumnya.
     */
    function qi_journal_waktu($nilai, string $medan = 'timestamp'): ?string
    {
        $t = qi_sig_epoch($nilai, $medan);
        if ($t === null) return null;
        return date('Y-m-d H:i:s', $t);
    }

    /** Angka atau null (kosong/'' tidak menjadi 0 palsu). */
    function qi_journal_angka($nilai): ?float
    {
        if ($nilai === null || $nilai === '' || is_array($nilai)) return null;
        if (!is_numeric($nilai)) return null;
        return (float)$nilai;
    }

    /** Bulatkan angka ke sejumlah desimal kolom, atau null. */
    function qi_journal_bulat($nilai, int $desimal): ?float
    {
        $a = qi_journal_angka($nilai);
        return ($a === null) ? null : round($a, $desimal);
    }

    /**
     * Susun baris tabel dari SATU rekor sinyal (bentuk yang sudah dipakai UI).
     * Pemetaan ini disengaja eksplisit supaya tidak ada kolom yang salah tempat.
     */
    function qi_journal_baris(array $r): array
    {
        $waktu = qi_journal_waktu($r['timestamp'] ?? null) ?? date('Y-m-d H:i:s');
        $json = static function ($v): ?string {
            if ($v === null || $v === '') return null;
            if (is_array($v)) return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $s = trim((string)$v);
            if ($s === '') return null;
            $sudah = json_decode($s, true);
            return (json_last_error() === JSON_ERROR_NONE && is_array($sudah))
                ? json_encode($sudah, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                : json_encode([$s], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        };
        $teks = static function ($v, int $maks): ?string {
            if ($v === null) return null;
            $s = trim((string)$v);
            if ($s === '') return null;
            return (mb_strlen($s) > $maks) ? mb_substr($s, 0, $maks) : $s;
        };
        return [
            'id'               => $teks($r['id'] ?? null, 64) ?? ('SIG-' . date('Ymd-His')),
            'created_at'       => $waktu,
            'expiry_at'        => qi_journal_waktu($r['expiry'] ?? null),
            'symbol'           => $teks($r['symbol'] ?? null, 30) ?? 'UNKNOWN',
            'timeframe'        => $teks($r['timeframe'] ?? null, 12) ?? 'MTF',
            'direction'        => (strtoupper((string)($r['side'] ?? '')) === 'SELL') ? 'SELL' : 'BUY',
            'entry_price'      => qi_journal_bulat($r['entry'] ?? null, 6) ?? 0.0,
            'sl_price'         => qi_journal_bulat($r['sl'] ?? null, 6),
            'tp1_price'        => qi_journal_bulat($r['tp'] ?? null, 6),
            'tp2_price'        => qi_journal_bulat($r['tp2'] ?? null, 6),
            'tp3_price'        => qi_journal_bulat($r['tp3'] ?? null, 6),
            'atr'              => qi_journal_bulat($r['atr'] ?? null, 6),
            'risk_reward'      => $teks($r['rr'] ?? null, 20),
            'engine_code'      => $teks($r['engine'] ?? null, 50),
            'engine_name'      => $teks($r['engine_name'] ?? null, 100),
            'methods_used'     => $json($r['methods_used'] ?? $r['methods'] ?? null),
            'quantum_engines'  => $json($r['quantum_engines'] ?? $r['engines'] ?? null),
            'confluence_score' => ($v = qi_journal_angka($r['confluence_score'] ?? null)) === null ? null : (int)round($v),
            'confidence'       => ($v = qi_journal_angka($r['confidence'] ?? null)) === null ? null : (int)round($v),
            'mtf_aligned'      => isset($r['mtf_aligned']) ? (int)(bool)$r['mtf_aligned'] : null,
            'setuju_bull'      => ($v = qi_journal_angka($r['setuju_bull'] ?? null)) === null ? null : (int)round($v),
            'setuju_bear'      => ($v = qi_journal_angka($r['setuju_bear'] ?? null)) === null ? null : (int)round($v),
            'news_context'     => $teks($r['news_context'] ?? null, 255),
            'reason'           => $teks($r['reason'] ?? $r['alasan'] ?? null, 4000),
            'basis'            => $teks($r['basis'] ?? null, 255),
            'chart_image_url'  => $teks($r['chart_image_url'] ?? null, 255),
            'status'           => $teks($r['status'] ?? null, 32) ?? 'AKTIF',
            'exit_price'       => qi_journal_bulat($r['exit_price'] ?? null, 6),
            'closed_at'        => qi_journal_waktu($r['closed_at'] ?? null, 'closed_at'),
            'evaluated_at'     => qi_journal_waktu($r['evaluated_at'] ?? null),
            'pnl'              => qi_journal_bulat($r['pnl'] ?? null, 8),
            'pnl_usd'          => qi_journal_bulat($r['pnl_usd'] ?? null, 4),
            'pnl_basis'        => $teks($r['pnl_basis'] ?? null, 20),
            'result_r'         => qi_journal_bulat($r['r'] ?? null, 4),
            'r_source'         => $teks($r['r_sumber'] ?? null, 20),
            'tier'             => $teks($r['tier'] ?? null, 10) ?? 'FREE',
            'sumber'           => $teks($r['sumber'] ?? null, 40),
            'invalidation'     => $teks($r['invalidation'] ?? null, 255),
            'raw_json'         => json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    /**
     * Simpan SATU rekor ke jurnal (idempoten). Mengembalikan true bila tersimpan.
     * TIDAK PERNAH melempar exception — kegagalan hanya dicatat.
     */
    function qi_journal_simpan(array $rekor): bool
    {
        if (!qi_journal_tersedia(true, false)) return false;
        try {
            if (!function_exists('getDBConnection')) {
                require_once __DIR__ . '/../config/database.php';
            }
            $baris = qi_journal_baris($rekor);
            $kolom = array_keys($baris);
            $set = [];
            foreach ($kolom as $k) { $set[] = '`' . $k . '` = VALUES(`' . $k . '`)'; }
            $sql = 'INSERT INTO `ai_signal_journal` (`' . implode('`,`', $kolom) . '`) VALUES ('
                 . implode(',', array_fill(0, count($kolom), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', $set);
            $st = getDBConnection()->prepare($sql);
            $st->execute(array_values($baris));
            return true;
        } catch (Throwable $e) {
            qi_journal_catat_galat('simpan gagal: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Simpan BANYAK rekor sekaligus (dipakai backfill). Mengembalikan jumlah yang tersimpan.
     * Dijalankan dalam transaksi supaya tidak setengah jalan.
     */
    function qi_journal_simpan_banyak(array $daftar): int
    {
        if (!qi_journal_tersedia(true, false)) return 0;
        $berhasil = 0;
        try {
            if (!function_exists('getDBConnection')) {
                require_once __DIR__ . '/../config/database.php';
            }
            $pdo = getDBConnection();
            $pdo->beginTransaction();
            foreach ($daftar as $r) {
                if (!is_array($r)) continue;
                $baris = qi_journal_baris($r);
                $kolom = array_keys($baris);
                $set = [];
                foreach ($kolom as $k) { $set[] = '`' . $k . '` = VALUES(`' . $k . '`)'; }
                $sql = 'INSERT INTO `ai_signal_journal` (`' . implode('`,`', $kolom) . '`) VALUES ('
                     . implode(',', array_fill(0, count($kolom), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', $set);
                $pdo->prepare($sql)->execute(array_values($baris));
                $berhasil++;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            try { if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack(); } catch (Throwable $e2) {}
            qi_journal_catat_galat('simpan banyak gagal: ' . $e->getMessage());
            return 0;
        }
        return $berhasil;
    }

    /**
     * Impor rekor dari berkas cache/signal_history.json ke jurnal (idempoten).
     * Dipakai sekali saat migrasi data dan aman dijalankan berulang.
     */
    function qi_journal_backfill(?string $berkas = null): array
    {
        $berkas = $berkas ?: (__DIR__ . '/../cache/signal_history.json');
        $out = ['berkas' => basename($berkas), 'dibaca' => 0, 'tersimpan' => 0, 'tersedia' => false, 'catatan' => ''];
        if (!is_file($berkas)) { $out['catatan'] = 'berkas rekor tidak ditemukan'; return $out; }
        $j = json_decode((string)@file_get_contents($berkas), true);
        if (!is_array($j)) { $out['catatan'] = 'berkas rekor tidak dapat dibaca'; return $out; }
        $out['dibaca'] = count($j);
        $out['tersedia'] = qi_journal_tersedia(true, false);
        if (!$out['tersedia']) { $out['catatan'] = qi_journal_galat_terakhir(); return $out; }
        $out['tersimpan'] = qi_journal_simpan_banyak($j);
        return $out;
    }

    /** Hitung isi jurnal (dan opsional: jumlah per status). */
    function qi_journal_hitung(): ?array
    {
        if (!qi_journal_tersedia(true, false)) return null;
        try {
            $pdo = getDBConnection();
            $total = (int)$pdo->query('SELECT COUNT(*) FROM `ai_signal_journal`')->fetchColumn();
            $status = [];
            foreach ($pdo->query('SELECT `status`, COUNT(*) c FROM `ai_signal_journal` GROUP BY `status`')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $status[(string)$r['status']] = (int)$r['c'];
            }
            return ['total' => $total, 'per_status' => $status];
        } catch (Throwable $e) {
            qi_journal_catat_galat('hitung gagal: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * BANDINGKAN isi jurnal dengan berkas rekor — alat bukti bahwa pemindahan data benar.
     * Mengembalikan ringkasan: jumlah, selisih id, dan selisih nilai penting.
     */
    function qi_journal_bandingkan(?string $berkas = null): array
    {
        $berkas = $berkas ?: (__DIR__ . '/../cache/signal_history.json');
        $out = ['berkas' => 0, 'jurnal' => 0, 'jurnal_total' => 0, 'hanya_di_berkas' => [], 'hanya_di_jurnal' => [], 'beda_nilai' => [], 'tersedia' => false];
        $j = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : null;
        if (!is_array($j)) { $out['catatan'] = 'berkas rekor tidak dapat dibaca'; return $out; }
        $out['berkas'] = count($j);
        if (!qi_journal_tersedia(true, false)) { $out['catatan'] = qi_journal_galat_terakhir(); return $out; }
        $out['tersedia'] = true;
        try {
            $peta = [];
            foreach ($j as $r) { if (is_array($r) && isset($r['id'])) $peta[(string)$r['id']] = $r; }
            $out['jurnal_total'] = (int)getDBConnection()->query('SELECT COUNT(*) FROM `ai_signal_journal`')->fetchColumn();
            // Hanya baris yang ID-nya ada di berkas yang dibandingkan — supaya angkanya
            // menjawab pertanyaan "apakah rekor dari berkas ini sudah masuk jurnal dengan benar",
            // bukan tercampur rekor lain (mis. sinyal baru yang belum ada di berkas).
            $db = [];
            foreach (getDBConnection()->query('SELECT `id`, `status`, `result_r`, `entry_price`, `sl_price`, `tp1_price` FROM `ai_signal_journal`')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                if (isset($peta[(string)$r['id']])) $db[(string)$r['id']] = $r;
            }
            $out['jurnal'] = count($db);
            foreach ($peta as $id => $r) {
                if (!isset($db[$id])) { $out['hanya_di_berkas'][] = $id; continue; }
                $harap = [
                    'status'      => (string)($r['status'] ?? '') === '' ? 'AKTIF' : (string)$r['status'],
                    'result_r'    => qi_journal_bulat($r['r'] ?? null, 4),
                    'entry_price' => qi_journal_bulat($r['entry'] ?? null, 6),
                    'sl_price'    => qi_journal_bulat($r['sl'] ?? null, 6),
                    'tp1_price'   => qi_journal_bulat($r['tp'] ?? null, 6),
                ];
                foreach ($harap as $k => $v) {
                    $punya = $db[$id][$k];
                    $punya = ($punya === null) ? null : (is_numeric($punya) ? (float)$punya : (string)$punya);
                    if ((string)$punya !== (string)$v) {
                        $out['beda_nilai'][] = ['id' => $id, 'kolom' => $k, 'berkas' => $v, 'jurnal' => $punya];
                    }
                }
            }
            foreach ($db as $id => $r) { if (!isset($peta[$id])) $out['hanya_di_jurnal'][] = $id; }
        } catch (Throwable $e) {
            qi_journal_catat_galat('bandingkan gagal: ' . $e->getMessage());
        }
        return $out;
    }

    /**
     * Catat satu permintaan webhook ke log audit. Tidak pernah melempar exception.
     * Mengembalikan true bila tercatat.
     */
    function qi_journal_catat_webhook(array $data): bool
    {
        if (!qi_journal_tersedia(false, true)) return false;
        try {
            if (!function_exists('getDBConnection')) {
                require_once __DIR__ . '/../config/database.php';
            }
            $teks = static function ($v, int $maks): ?string {
                if ($v === null) return null;
                $s = trim((string)$v);
                if ($s === '') return null;
                return (mb_strlen($s) > $maks) ? mb_substr($s, 0, $maks) : $s;
            };
            $payload = null;
            if (isset($data['payload'])) {
                $payload = is_array($data['payload'])
                    ? json_encode($data['payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : (string)$data['payload'];
                if ($payload !== null && mb_strlen($payload) > 60000) $payload = mb_substr($payload, 0, 60000);
            }
            $st = getDBConnection()->prepare(
                'INSERT INTO `ai_webhook_logs` (`source`,`ip`,`symbol`,`timeframe`,`action`,`status`,`http_code`,`auth_method`,`signature_ok`,`signal_id`,`message`,`payload`)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $st->execute([
                $teks($data['source'] ?? 'tradingview', 50),
                $teks($data['ip'] ?? null, 45),
                $teks($data['symbol'] ?? null, 30),
                $teks($data['timeframe'] ?? null, 12),
                $teks($data['action'] ?? null, 20),
                $teks($data['status'] ?? 'RECEIVED', 20) ?? 'RECEIVED',
                isset($data['http_code']) ? (int)$data['http_code'] : null,
                $teks($data['auth_method'] ?? null, 20),
                isset($data['signature_ok']) ? (int)(bool)$data['signature_ok'] : null,
                $teks($data['signal_id'] ?? null, 64),
                $teks($data['message'] ?? null, 255),
                $payload,
            ]);
            return true;
        } catch (Throwable $e) {
            qi_journal_catat_galat('catat webhook gagal: ' . $e->getMessage());
            return false;
        }
    }

    /** Ambil log webhook terbaru (untuk panel Gateway). */
    function qi_journal_log_webhook(int $batas = 50): array
    {
        if (!qi_journal_tersedia(false, true)) return [];
        try {
            $batas = max(1, min(500, $batas));
            $st = getDBConnection()->query('SELECT * FROM `ai_webhook_logs` ORDER BY `id` DESC LIMIT ' . $batas);
            return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            qi_journal_catat_galat('ambil log webhook gagal: ' . $e->getMessage());
            return [];
        }
    }
}
