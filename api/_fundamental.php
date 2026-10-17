<?php
declare(strict_types=1);
/**
 * MODUL FUNDAMENTAL (spesifikasi Bagian 4 & 12).
 *
 * DUA TUGAS:
 *   1. MENYIMPAN riwayat peristiwa kalender ke tabel `fundamental_events`, supaya
 *      pertanyaan "saat sinyal ini terbit, ada peristiwa apa?" dapat dijawab nanti —
 *      cache/calendar.json hanya berisi keadaan SEKARANG dan terus ditimpa.
 *   2. MENYEDIAKAN teks konteks berita (`news_context`) untuk setiap sinyal, diambil
 *      dari filter blackout yang SUDAH dipakai platform (qi_berita_blackout).
 *
 * PRINSIP KEJUJUAN:
 *   · Nilai "-" dari kalender berarti "tidak ada data" → disimpan sebagai NULL,
 *     BUKAN sebagai string "-" yang terlihat seperti data.
 *   · Bila cache kalender tidak ada/basi, konteks ditulis apa adanya
 *     ("filter berita tidak aktif") — bukan "CLEAR" yang menyesatkan.
 *   · Semua fungsi fail-safe: kegagalan hanya dicatat, tidak melempar exception.
 */

if (!function_exists('qi_fun_nilai')) {

    /** Ubah nilai kalender menjadi teks atau NULL ('-' dan '' = tidak ada data). */
    function qi_fun_nilai($v): ?string
    {
        if ($v === null) return null;
        $s = trim((string)$v);
        if ($s === '' || $s === '-' || $s === '—') return null;
        return mb_substr($s, 0, 50);
    }

    /** Apakah tabel fundamental tersedia? */
    function qi_fun_tersedia(): bool
    {
        static $hasil = null;
        if ($hasil !== null) return $hasil;
        $hasil = false;
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            getDBConnection()->query('SELECT 1 FROM `fundamental_events` LIMIT 1');
            $hasil = true;
        } catch (Throwable $e) {
            @error_log('[fundamental] tabel belum tersedia: ' . $e->getMessage());
        }
        return $hasil;
    }

    /**
     * Sinkronkan peristiwa kalender ke tabel (idempoten lewat kunci unik).
     * @return array{tersedia:bool,dibaca:int,ditulis:int,catatan:string}
     */
    function qi_fun_sinkron(int $hariKeBelakang = 7, int $hariKeDepan = 30): array
    {
        $out = ['tersedia' => false, 'dibaca' => 0, 'ditulis' => 0, 'catatan' => ''];
        if (!function_exists('qi_kalender_event_sah')) {
            $mw = __DIR__ . '/_middleware.php';
            if (is_file($mw)) require_once $mw;
        }
        $f = __DIR__ . '/../cache/calendar.json';
        if (!is_file($f)) { $out['catatan'] = 'cache/calendar.json tidak ada'; return $out; }
        $j = json_decode((string)@file_get_contents($f), true);
        $data = is_array($j) ? ($j['data'] ?? []) : [];
        if (!is_array($data) || !$data) { $out['catatan'] = 'isi kalender tidak berbentuk daftar peristiwa'; return $out; }
        $out['dibaca'] = count($data);
        $out['tersedia'] = qi_fun_tersedia();
        if (!$out['tersedia']) { $out['catatan'] = 'tabel fundamental_events belum dimigrasi'; return $out; }

        $bawah = time() - $hariKeBelakang * 86400;
        $atas  = time() + $hariKeDepan * 86400;
        $lewat = 0; $siap = [];
        foreach ($data as $e) {
            if (!is_array($e)) continue;
            if (function_exists('qi_kalender_event_sah') && !qi_kalender_event_sah($e)) { $lewat++; continue; }
            $waktu = strtotime((string)($e['date'] ?? ''));
            if ($waktu === false || $waktu < $bawah || $waktu > $atas) continue;
            $negara = strtoupper(mb_substr(trim((string)($e['currency'] ?? $e['country'] ?? '')), 0, 12));
            $nama   = mb_substr(trim((string)($e['title'] ?? '')), 0, 160);
            if ($negara === '' || $nama === '') continue;
            $siap[] = [
                // Epoch, diubah MySQL lewat FROM_UNIXTIME() ke zona sesinya — sama dengan NOW()
                // yang dipakai pembaca. date() memakai zona php.ini dan menggeser jam (migrasi 022).
                (int)$waktu, $negara, $nama,
                mb_substr(strtolower(trim((string)($e['impact'] ?? ''))), 0, 12) ?: null,
                qi_fun_nilai($e['actual'] ?? null), qi_fun_nilai($e['forecast'] ?? null), qi_fun_nilai($e['previous'] ?? null),
                mb_substr(trim((string)($e['source'] ?? 'kalender')), 0, 40),
                json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
        }
        if (!$siap) { $out['catatan'] = 'tidak ada peristiwa dalam rentang ' . $hariKeBelakang . ' hari lalu s/d ' . $hariKeDepan . ' hari ke depan'; return $out; }

        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            $pdo = getDBConnection();
            $st = $pdo->prepare('INSERT INTO `fundamental_events`
                (`event_time`,`country`,`event_name`,`impact`,`actual`,`forecast`,`previous`,`sumber`,`raw_json`)
                VALUES (FROM_UNIXTIME(?),?,?,?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE `impact`=VALUES(`impact`), `actual`=VALUES(`actual`),
                    `forecast`=VALUES(`forecast`), `previous`=VALUES(`previous`), `sumber`=VALUES(`sumber`), `raw_json`=VALUES(`raw_json`)');
            $pdo->beginTransaction();
            foreach ($siap as $b) { $st->execute($b); $out['ditulis']++; }
            $pdo->commit();
            $out['catatan'] = 'disinkronkan ' . $out['ditulis'] . ' peristiwa'
                . ($lewat > 0 ? (' · ' . $lewat . ' peristiwa ditolak filter kejujuran (id/sumber/judul menyerupai data uji)') : '');
        } catch (Throwable $e) {
            try { if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack(); } catch (Throwable $e2) {}
            @error_log('[fundamental] sinkron gagal: ' . $e->getMessage());
            $out['ditulis'] = 0;
            $out['catatan'] = 'gagal menyimpan: ' . $e->getMessage();
        }
        return $out;
    }

    /**
     * Teks konteks berita untuk sebuah sinyal (dipakai kolom news_context).
     * Diambil dari filter blackout yang sudah ada — jadi tidak ada aturan kedua yang
     * bisa berbeda dengan aturan penahanan sinyal.
     */
    function qi_fun_konteks(int $menit = 30): string
    {
        if (!function_exists('qi_berita_blackout')) {
            $mw = __DIR__ . '/_middleware.php';
            if (is_file($mw)) require_once $mw;
        }
        if (!function_exists('qi_berita_blackout')) return 'tidak dapat diperiksa (modul kalender tidak tersedia)';
        try {
            $b = qi_berita_blackout($menit, true);
        } catch (Throwable $e) {
            return 'tidak dapat diperiksa: ' . mb_substr($e->getMessage(), 0, 80);
        }
        if (!empty($b['aktif']) && !empty($b['event'])) {
            $e = $b['event'];
            return mb_substr('DAMPAK TINGGI ' . strtoupper((string)($e['currency'] ?? $e['country'] ?? ''))
                . ' · ' . (string)($e['title'] ?? '')
                . ' · dalam ' . (string)($b['menit'] ?? '?') . ' menit', 0, 240);
        }
        if (!empty($b['umur_cache']) && (int)$b['umur_cache'] > 3600) {
            return 'filter berita tidak aktif (data kalender basi ' . round((int)$b['umur_cache'] / 60) . ' menit)';
        }
        return 'CLEAR — tidak ada berita berdampak tinggi dalam ' . $menit . ' menit';
    }

    /** Peristiwa berdampak tinggi terdekat dari tabel (untuk tampilan panel). */
    function qi_fun_terdekat(int $jam = 24): ?array
    {
        if (!qi_fun_tersedia()) return null;
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            // event_epoch: saat yang tidak ambigu (event_time sendiri dalam zona sesi MySQL).
            $st = getDBConnection()->prepare("SELECT `event_time`, UNIX_TIMESTAMP(`event_time`) AS `event_epoch`,`country`,`event_name`,`impact`
                FROM `fundamental_events`
                WHERE `event_time` BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)
                  AND `impact` IN ('high','medium')
                ORDER BY `event_time` ASC LIMIT 1");
            $st->execute([max(1, min(168, $jam))]);
            $r = $st->fetch(PDO::FETCH_ASSOC);
            return $r ?: null;
        } catch (Throwable $e) {
            @error_log('[fundamental] terdekat gagal: ' . $e->getMessage());
            return null;
        }
    }

    /** Ringkasan isi tabel (untuk audit). */
    function qi_fun_ringkas(): ?array
    {
        if (!qi_fun_tersedia()) return null;
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            $pdo = getDBConnection();
            $total = (int)$pdo->query('SELECT COUNT(*) FROM `fundamental_events`')->fetchColumn();
            $tinggi = (int)$pdo->query("SELECT COUNT(*) FROM `fundamental_events` WHERE `impact` = 'high'")->fetchColumn();
            $lalu = (int)$pdo->query('SELECT COUNT(*) FROM `fundamental_events` WHERE `event_time` < NOW()')->fetchColumn();
            $depan = (int)$pdo->query('SELECT COUNT(*) FROM `fundamental_events` WHERE `event_time` >= NOW()')->fetchColumn();
            return ['total' => $total, 'dampak_tinggi' => $tinggi, 'sudah_lewat' => $lalu, 'akan_datang' => $depan];
        } catch (Throwable $e) {
            @error_log('[fundamental] ringkas gagal: ' . $e->getMessage());
            return null;
        }
    }
}
