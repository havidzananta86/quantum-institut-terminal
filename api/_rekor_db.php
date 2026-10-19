<?php
/**
 * REKOR SINYAL BAYANGAN & PINE → DATABASE (tabel signal_records, migrasi 026).
 *
 * Tahap DUAL-WRITE, mengikuti prinsip jurnal sinyal resmi (api/_journal.php):
 *   1. Berkas JSON (cache/signal_shadow.json, cache/pine_signals.json) TETAP sumber utama.
 *      Database adalah salinan yang bisa dicari, dicadangkan, dan tidak hilang bila cache
 *      dibersihkan. Pembacaan pindah ke database pada tahap berikutnya, setelah
 *      qi_rekor_db_bandingkan() membuktikan isinya identik di produksi.
 *   2. FAIL-SAFE: database mati / tabel belum ada → tidak ada exception ke pemanggil;
 *      galat dicatat di error_log dan dikembalikan di laporan.
 *   3. IDEMPOTEN: INSERT ... ON DUPLICATE KEY UPDATE pada (source, id).
 *   4. Hemat: pertama kali (tabel kosong untuk sumber itu) semua rekor diisi; sesudahnya
 *      hanya rekor yang masih terbuka atau berubah dalam 7 hari terakhir.
 *   5. Waktu = epoch UTC (INT). Zona waktu PHP dan MySQL di server tidak selalu sama.
 */
declare(strict_types=1);

require_once __DIR__ . '/_signal_time.php';
require_once __DIR__ . '/_signal_stats.php';

if (!function_exists('qi_rekor_db_pdo')) :

/** Koneksi PDO atau null (tanpa exit/exception — beda dengan qi_db() yang bisa mengakhiri permintaan). */
function qi_rekor_db_pdo(): ?PDO
{
    try {
        if (!function_exists('getDBConnection')) {
            $cfg = __DIR__ . '/../config/database.php';
            if (!is_file($cfg)) return null;
            require_once $cfg;
        }
        $pdo = getDBConnection();
        return $pdo instanceof PDO ? $pdo : null;
    } catch (Throwable $e) {
        @error_log('[rekor-db] koneksi gagal: ' . $e->getMessage());
        return null;
    }
}

function qi_rekor_db_siapkan(PDO $pdo): void
{
    static $siap = false;
    if ($siap) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS `signal_records` (
        `source` VARCHAR(16) NOT NULL, `id` VARCHAR(64) NOT NULL, `symbol` VARCHAR(30) NOT NULL,
        `side` VARCHAR(4) NOT NULL, `method` VARCHAR(40) NULL, `status` VARCHAR(24) NOT NULL,
        `entry` DECIMAL(20,8) NULL, `sl` DECIMAL(20,8) NULL, `tp` DECIMAL(20,8) NULL,
        `exit_price` DECIMAL(20,8) NULL, `pnl` DECIMAL(20,8) NULL, `r_multiple` DECIMAL(10,4) NULL,
        `spread` DECIMAL(20,8) NULL, `created_ts` INT UNSIGNED NOT NULL, `filled_ts` INT UNSIGNED NULL,
        `closed_ts` INT UNSIGNED NULL, `data` MEDIUMTEXT NOT NULL, `updated_at` INT UNSIGNED NOT NULL,
        PRIMARY KEY (`source`, `id`), KEY `idx_source_status` (`source`, `status`),
        KEY `idx_source_created` (`source`, `created_ts`), KEY `idx_symbol` (`symbol`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $siap = true;
}

/** Baris tabel dari satu rekor (murni — diuji tanpa database). Null bila rekor tidak layak. */
function qi_rekor_db_baris(string $sumber, array $r): ?array
{
    $id = trim((string)($r['id'] ?? ''));
    $dibuat = qi_sig_epoch($r['timestamp'] ?? null);
    if ($id === '' || $dibuat === null) return null;
    $angka = static fn($v): ?float => (is_numeric($v) ? (float)$v : null);
    $epoch = static function ($v): ?int {
        if ($v === null || $v === '') return null;
        $t = qi_sig_epoch($v, 'closed_at');
        return $t === null ? null : $t;
    };
    $isi = json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($isi === false) return null;
    return [
        'source'     => $sumber,
        'id'         => mb_substr($id, 0, 64),
        'symbol'     => mb_substr(strtoupper((string)($r['symbol'] ?? '?')), 0, 30),
        'side'       => strtoupper((string)($r['side'] ?? '')) === 'SELL' ? 'SELL' : 'BUY',
        'method'     => isset($r['metode']) ? mb_substr((string)$r['metode'], 0, 40) : (isset($r['engine']) ? mb_substr((string)$r['engine'], 0, 40) : null),
        'status'     => mb_substr((string)($r['status'] ?? '?'), 0, 24),
        'entry'      => $angka($r['entry'] ?? null),
        'sl'         => $angka($r['sl'] ?? null),
        'tp'         => $angka($r['tp'] ?? null),
        'exit_price' => $angka($r['exit_price'] ?? null),
        'pnl'        => $angka($r['pnl'] ?? null),
        'r_multiple' => qi_signal_r_satu($r)['r'],
        'spread'     => $angka($r['spread_biaya'] ?? null),
        'created_ts' => $dibuat,
        'filled_ts'  => $epoch($r['filled_at'] ?? null),
        'closed_ts'  => $epoch($r['closed_at'] ?? null),
        'data'       => $isi,
    ];
}

/** Rekor yang perlu disinkron: terbuka, atau dibuat/ditutup dalam $hari terakhir. */
function qi_rekor_db_pilih(array $rekor, int $kini, int $hari = 7): array
{
    $batas = $kini - $hari * 86400;
    $keluar = [];
    foreach ($rekor as $r) {
        if (!is_array($r)) continue;
        $terbuka = in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true);
        $t = max((int)qi_sig_epoch($r['timestamp'] ?? null), (int)qi_sig_epoch($r['closed_at'] ?? null, 'closed_at'));
        if ($terbuka || $t >= $batas) $keluar[] = $r;
    }
    return $keluar;
}

/**
 * Salin rekor dari berkas JSON ke tabel.
 * @return array{ok:bool, ditulis:int, mode:string, catatan?:string}
 */
function qi_rekor_db_sinkron(string $sumber, string $berkas, ?PDO $pdo = null, ?int $kini = null): array
{
    $kini = $kini ?? time();
    $pdo = $pdo ?? qi_rekor_db_pdo();
    if ($pdo === null) return ['ok' => false, 'ditulis' => 0, 'mode' => '-', 'catatan' => 'database tidak tersedia'];
    try {
        qi_rekor_db_siapkan($pdo);
        $rekor = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
        if (!is_array($rekor)) return ['ok' => false, 'ditulis' => 0, 'mode' => '-', 'catatan' => 'berkas rekor tidak bisa dibaca'];

        $q = $pdo->prepare('SELECT COUNT(*) FROM `signal_records` WHERE `source` = ?');
        $q->execute([$sumber]);
        $penuh = ((int)$q->fetchColumn()) === 0;
        $daftar = $penuh ? $rekor : qi_rekor_db_pilih($rekor, $kini);

        $ins = $pdo->prepare('INSERT INTO `signal_records`
            (`source`,`id`,`symbol`,`side`,`method`,`status`,`entry`,`sl`,`tp`,`exit_price`,`pnl`,`r_multiple`,`spread`,`created_ts`,`filled_ts`,`closed_ts`,`data`,`updated_at`)
            VALUES (:source,:id,:symbol,:side,:method,:status,:entry,:sl,:tp,:exit_price,:pnl,:r_multiple,:spread,:created_ts,:filled_ts,:closed_ts,:data,:updated_at)
            ON DUPLICATE KEY UPDATE `status`=VALUES(`status`), `exit_price`=VALUES(`exit_price`), `pnl`=VALUES(`pnl`),
                `r_multiple`=VALUES(`r_multiple`), `spread`=VALUES(`spread`), `filled_ts`=VALUES(`filled_ts`),
                `closed_ts`=VALUES(`closed_ts`), `data`=VALUES(`data`), `updated_at`=VALUES(`updated_at`)');
        $n = 0;
        $pdo->beginTransaction();
        foreach ($daftar as $r) {
            $b = is_array($r) ? qi_rekor_db_baris($sumber, $r) : null;
            if ($b === null) continue;
            $b['updated_at'] = $kini;
            $ins->execute($b);
            $n++;
        }
        $pdo->commit();
        return ['ok' => true, 'ditulis' => $n, 'mode' => $penuh ? 'isi_awal' : 'terbaru'];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        @error_log('[rekor-db] sinkron ' . $sumber . ' gagal: ' . $e->getMessage());
        return ['ok' => false, 'ditulis' => 0, 'mode' => '-', 'catatan' => 'sinkron gagal: ' . $e->getMessage()];
    }
}

/**
 * Bandingkan berkas dengan tabel (syarat sebelum pembacaan dipindah ke database).
 * @return array{ok:bool, berkas:int, db:int, hilang_di_db:array, status_beda:array}
 */
function qi_rekor_db_bandingkan(string $sumber, string $berkas, ?PDO $pdo = null): array
{
    $pdo = $pdo ?? qi_rekor_db_pdo();
    $rekor = is_file($berkas) ? (json_decode((string)@file_get_contents($berkas), true) ?: []) : [];
    $hasil = ['ok' => false, 'berkas' => count($rekor), 'db' => 0, 'hilang_di_db' => [], 'status_beda' => []];
    if ($pdo === null) return $hasil + ['catatan' => 'database tidak tersedia'];
    try {
        $q = $pdo->prepare('SELECT `id`, `status` FROM `signal_records` WHERE `source` = ?');
        $q->execute([$sumber]);
        $db = [];
        foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $row) $db[(string)$row['id']] = (string)$row['status'];
        $hasil['db'] = count($db);
        foreach ($rekor as $r) {
            $id = (string)($r['id'] ?? '');
            if ($id === '') continue;
            if (!isset($db[$id])) $hasil['hilang_di_db'][] = $id;
            elseif ($db[$id] !== (string)($r['status'] ?? '')) $hasil['status_beda'][] = $id;
        }
        $hasil['ok'] = !$hasil['hilang_di_db'] && !$hasil['status_beda'];
        return $hasil;
    } catch (Throwable $e) {
        return $hasil + ['catatan' => 'perbandingan gagal: ' . $e->getMessage()];
    }
}

endif;
