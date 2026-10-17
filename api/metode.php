<?php
declare(strict_types=1);
/**
 * VERSI METODE — usulan, bukti uji, dan aktivasi (spesifikasi Bagian 5).
 *
 * GET  api/metode.php                 → daftar versi + versi aktif + usulan dari analisa SL (PRO)
 * POST api/metode.php                 → tindakan (ADMIN):
 *      {aksi:'usulkan',  changelog:'...'}                      → buat versi baru (metrik NULL = belum diukur)
 *      {aksi:'metrik',   versi:'v1.0.1', winrate:.., profit_factor:.., max_drawdown:..,
 *                        backtest_samples:100, forward_samples:30}  → isi bukti uji
 *      {aksi:'aktifkan', versi:'v1.0.1'}                       → aktifkan (HANYA bila bukti memenuhi syarat)
 *      {aksi:'tolak',    versi:'v1.0.1', sebab:'...'}           → tolak usulan
 *
 * ATURAN YANG DITEGAKKAN SERVER (tidak bisa dilewati dari peramban):
 *   1. Versi hanya boleh DIAKTIFKAN bila: backtest_samples ≥ 100, forward_samples ≥ 30,
 *      dan winrate + profit_factor sudah terisi (bukan NULL).
 *   2. Selain itu, versi baru harus TIDAK LEBIH BURUK dari versi aktif yang punya metrik:
 *      winrate ≥ winrate aktif DAN profit_factor ≥ profit_factor aktif. Bila lebih buruk,
 *      aktivasi DITOLAK dengan alasan berisi angkanya.
 *   3. Aktivasi menonaktifkan versi lain (hanya satu yang aktif) di dalam satu transaksi.
 *
 * Ini menerapkan ATURAN EMAS spesifikasi: "HANYA terbitkan jika winrate & profit factor
 * meningkat" dan "AI dilarang mengubah metode tanpa backtest".
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

const QI_METODE_MIN_BACKTEST = 100;   // spesifikasi Bagian 5 STEP 5
const QI_METODE_MIN_FORWARD   = 30;

/**
 * Pastikan kolom tambahan ada (idempoten). Dipanggil dari kode, bukan dari berkas .sql,
 * karena MariaDB tidak selalu mendukung ADD COLUMN IF NOT EXISTS.
 */
function qi_metode_pastikan_skema(): array
{
    $out = ['kolom_ditambah' => [], 'catatan' => ''];
    try {
        if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
        $pdo = getDBConnection();
        $pdo->query('SELECT 1 FROM `ai_method_versions` LIMIT 1');
        $ada = [];
        foreach ($pdo->query('SELECT COLUMN_NAME FROM information_schema.COLUMNS
                              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'ai_method_versions\'')->fetchAll(PDO::FETCH_COLUMN) as $c) {
            $ada[strtolower((string)$c)] = true;
        }
        $perlu = [
            'status_usul'      => "ALTER TABLE `ai_method_versions` ADD COLUMN `status_usul` VARCHAR(20) NOT NULL DEFAULT 'usul' COMMENT 'usul | uji | disetujui | ditolak'",
            'backtest_samples' => "ALTER TABLE `ai_method_versions` ADD COLUMN `backtest_samples` INT NULL COMMENT 'jumlah sampel backtest sebelum terbit'",
            'forward_samples'  => "ALTER TABLE `ai_method_versions` ADD COLUMN `forward_samples` INT NULL COMMENT 'jumlah sampel forward test (paper) sebelum terbit'",
            'alasan_tolak'     => "ALTER TABLE `ai_method_versions` ADD COLUMN `alasan_tolak` VARCHAR(255) NULL",
            'diaktifkan_pada'  => "ALTER TABLE `ai_method_versions` ADD COLUMN `diaktifkan_pada` DATETIME NULL",
        ];
        foreach ($perlu as $nama => $sql) {
            if (isset($ada[$nama])) continue;
            try { $pdo->exec($sql); $out['kolom_ditambah'][] = $nama; }
            catch (Throwable $e) { @error_log('[metode] tambah kolom ' . $nama . ' gagal: ' . $e->getMessage()); }
        }
    } catch (Throwable $e) {
        $out['catatan'] = 'tabel ai_method_versions belum tersedia: ' . $e->getMessage();
    }
    return $out;
}

function mt_jawab(int $kode, array $data): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Ambil semua versi (lengkap dengan status & metrik). */
function qi_metode_daftar(): array
{
    try {
        if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
        return getDBConnection()->query('SELECT * FROM `ai_method_versions` ORDER BY `id` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        @error_log('[metode] daftar gagal: ' . $e->getMessage());
        return [];
    }
}

/** Versi yang sedang aktif (yang punya metrik & is_active=1). */
function qi_metode_aktif(): ?array
{
    foreach (qi_metode_daftar() as $v) { if ((int)$v['is_active'] === 1) return $v; }
    return null;
}

/**
 * Apakah versi $kandidat boleh diaktifkan? Mengembalikan [boleh, alasan].
 * Aturan spesifikasi: backtest ≥100, forward ≥30, metrik terisi, dan tidak lebih buruk
 * dari versi aktif yang punya metrik.
 */
function qi_metode_cek_kelayakan(array $kandidat, ?array $aktif): array
{
    $bt = $kandidat['backtest_samples'] ?? null;
    $fw = $kandidat['forward_samples'] ?? null;
    $wr = $kandidat['winrate'] ?? null;
    $pf = $kandidat['profit_factor'] ?? null;
    if ($bt === null || $fw === null || $wr === null || $pf === null) {
        return [false, 'Bukti uji belum lengkap: isi metrik (winrate, profit factor) DAN jumlah sampel backtest + forward lebih dulu.'];
    }
    if ((int)$bt < QI_METODE_MIN_BACKTEST) {
        return [false, 'Backtest baru ' . (int)$bt . ' sampel — spesifikasi menuntut minimal ' . QI_METODE_MIN_BACKTEST . '.'];
    }
    if ((int)$fw < QI_METODE_MIN_FORWARD) {
        return [false, 'Forward test baru ' . (int)$fw . ' sampel — spesifikasi menuntut minimal ' . QI_METODE_MIN_FORWARD . '.'];
    }
    if ($aktif !== null && $aktif['winrate'] !== null && $aktif['profit_factor'] !== null) {
        if ((float)$wr < (float)$aktif['winrate']) {
            return [false, 'Ditolak: winrate kandidat ' . $wr . '% LEBIH RENDAH dari versi aktif ' . $aktif['version'] . ' (' . $aktif['winrate'] . '%). Spesifikasi: hanya terbitkan bila membaik.'];
        }
        if ((float)$pf < (float)$aktif['profit_factor']) {
            return [false, 'Ditolak: profit factor kandidat ' . $pf . ' LEBIH RENDAH dari versi aktif ' . $aktif['version'] . ' (' . $aktif['profit_factor'] . '). Spesifikasi: hanya terbitkan bila membaik.'];
        }
    }
    return [true, 'Memenuhi syarat: backtest ' . (int)$bt . ' ≥ ' . QI_METODE_MIN_BACKTEST
        . ' · forward ' . (int)$fw . ' ≥ ' . QI_METODE_MIN_FORWARD
        . ($aktif !== null && $aktif['winrate'] !== null ? (' · tidak lebih buruk dari ' . $aktif['version']) : ' · belum ada versi aktif ber metrik')];
}

// ── Penjaga pustaka ──────────────────────────────────────────────────────────
// Bila berkas ini di-include (mis. oleh uji otomatis), bagian permintaan HTTP TIDAK
// dijalankan — hanya fungsi & konstanta di atas yang tersedia. Ini pola yang sudah
// dipakai di proyek ini agar uji tidak terhalang autentikasi/rate limit.
if (!defined('QI_METODE_LIB')):

// ── GET: daftar + usulan ─────────────────────────────────────────────────────
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    qi_require_level('pro');
    qi_metode_pastikan_skema();
    $daftar = qi_metode_daftar();
    $aktif = qi_metode_aktif();

    // Usulan dari analisa SL (bila tersedia) — sebagai bahan pembuat versi baru.
    $usul = null;
    try {
        require_once __DIR__ . '/_sl_learn.php';
        $f = __DIR__ . '/../cache/signal_history.json';
        $rekor = is_file($f) ? json_decode((string)file_get_contents($f), true) : [];
        if (is_array($rekor) && function_exists('qi_sl_ringkas')) {
            $usul = qi_sl_usulan(qi_sl_ringkas($rekor));
        }
    } catch (Throwable $e) { @error_log('[metode] usulan SL dilewati: ' . $e->getMessage()); }

    // Kandidat yang menunggu keputusan → sekalian dihitung kelayakannya.
    foreach ($daftar as $i => $v) {
        if ((int)$v['is_active'] === 1) continue;
        [$boleh, $alasan] = qi_metode_cek_kelayakan($v, $aktif);
        $daftar[$i]['layak_aktif'] = $boleh;
        $daftar[$i]['alasan_kelayakan'] = $alasan;
    }

    mt_jawab(200, [
        'status'    => 'ok',
        'versi'     => $daftar,
        'aktif'     => $aktif,
        'usulan_sl' => $usul,
        'syarat'    => ['backtest_min' => QI_METODE_MIN_BACKTEST, 'forward_min' => QI_METODE_MIN_FORWARD,
                        'aturan' => 'Versi hanya dapat diaktifkan bila backtest ≥ 100 sampel, forward ≥ 30 sampel, metrik terisi, dan tidak lebih buruk dari versi aktif.'],
        'catatan'   => 'Versi TIDAK pernah diaktifkan otomatis. AI hanya mengusulkan; keputusan ada pada admin dan dicatat.',
    ]);
}

// ── POST: tindakan admin ─────────────────────────────────────────────────────
qi_require_admin();
qi_metode_pastikan_skema();

$badan = function_exists('qi_get_json_body') ? qi_get_json_body() : json_decode((string)file_get_contents('php://input'), true);
if (!is_array($badan)) mt_jawab(400, ['status' => 'error', 'message' => 'Badan permintaan bukan JSON yang sah.']);
$aksi = strtolower(trim((string)($badan['aksi'] ?? '')));
$versi = trim((string)($badan['versi'] ?? ''));
$pengguna = function_exists('qi_validate_token') ? qi_validate_token() : null;
$namaAdmin = is_array($pengguna) ? (string)($pengguna['email'] ?? $pengguna['full_name'] ?? 'admin') : 'admin';

try {
    if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
    $pdo = getDBConnection();
} catch (Throwable $e) {
    mt_jawab(500, ['status' => 'error', 'message' => 'Database tidak tersedia: ' . $e->getMessage()]);
}

if ($aksi === 'usulkan') {
    $changelog = trim((string)($badan['changelog'] ?? ''));
    if (mb_strlen($changelog) < 10) mt_jawab(400, ['status' => 'error', 'message' => 'Changelog wajib diisi (minimal 10 huruf) — versi tanpa catatan tidak dapat diaudit.']);
    $semua = qi_metode_daftar();
    // Nomor versi otomatis: v1.0.0 bila belum ada, selain itu naikkan angka terakhir.
    if (!$semua) { $baru = 'v1.0.0'; }
    else {
        $akhir = (string)end($semua)['version'];
        if (preg_match('/^v(\d+)\.(\d+)\.(\d+)$/', $akhir, $m)) $baru = 'v' . $m[1] . '.' . $m[2] . '.' . ((int)$m[3] + 1);
        else $baru = 'v1.0.' . count($semua);
    }
    try {
        $pdo->prepare('INSERT INTO `ai_method_versions` (`version`,`changelog`,`sample_size`,`is_active`,`dasar_usul`,`status_usul`)
                       VALUES (?,?,0,0,?,?)')
            ->execute([$baru, mb_substr($changelog, 0, 4000), mb_substr((string)($badan['dasar'] ?? 'analisa SL'), 0, 200), 'usul']);
    } catch (Throwable $e) {
        mt_jawab(409, ['status' => 'error', 'message' => 'Gagal membuat versi: ' . $e->getMessage()]);
    }
    mt_jawab(200, ['status' => 'success', 'versi' => $baru,
        'message' => 'Versi ' . $baru . ' dibuat sebagai USULAN (metrik masih kosong). Isi bukti uji lebih dulu sebelum dapat diaktifkan.']);
}

if ($versi === '') mt_jawab(400, ['status' => 'error', 'message' => 'Sertakan "versi", mis. v1.0.1.']);
$kandidat = null;
foreach (qi_metode_daftar() as $v) { if ((string)$v['version'] === $versi) { $kandidat = $v; break; } }
if ($kandidat === null) mt_jawab(404, ['status' => 'error', 'message' => 'Versi ' . $versi . ' tidak ditemukan.']);

if ($aksi === 'metrik') {
    $wr = isset($badan['winrate']) && is_numeric($badan['winrate']) ? round((float)$badan['winrate'], 2) : null;
    $pf = isset($badan['profit_factor']) && is_numeric($badan['profit_factor']) ? round((float)$badan['profit_factor'], 2) : null;
    $dd = isset($badan['max_drawdown']) && is_numeric($badan['max_drawdown']) ? round((float)$badan['max_drawdown'], 2) : null;
    $bt = isset($badan['backtest_samples']) && is_numeric($badan['backtest_samples']) ? (int)$badan['backtest_samples'] : null;
    $fw = isset($badan['forward_samples']) && is_numeric($badan['forward_samples']) ? (int)$badan['forward_samples'] : null;
    if ($wr === null || $pf === null) mt_jawab(400, ['status' => 'error', 'message' => 'winrate dan profit_factor wajib berupa angka (hasil uji, bukan perkiraan).']);
    if ($bt === null || $fw === null) mt_jawab(400, ['status' => 'error', 'message' => 'backtest_samples dan forward_samples wajib diisi.']);
    try {
        $pdo->prepare('UPDATE `ai_method_versions` SET `winrate`=?, `profit_factor`=?, `max_drawdown`=?, `backtest_samples`=?, `forward_samples`=?, `sample_size`=?, `status_usul`=?  WHERE `version`=?')
            ->execute([$wr, $pf, $dd, $bt, $fw, $bt + $fw, 'uji', $versi]);
    } catch (Throwable $e) {
        mt_jawab(500, ['status' => 'error', 'message' => 'Gagal menyimpan metrik: ' . $e->getMessage()]);
    }
    [$boleh, $alasan] = qi_metode_cek_kelayakan(array_merge($kandidat, [
        'winrate' => $wr, 'profit_factor' => $pf, 'backtest_samples' => $bt, 'forward_samples' => $fw,
    ]), qi_metode_aktif());
    mt_jawab(200, ['status' => 'success', 'layak_aktif' => $boleh,
        'message' => 'Bukti uji tersimpan. ' . $alasan]);
}

if ($aksi === 'aktifkan') {
    [$boleh, $alasan] = qi_metode_cek_kelayakan($kandidat, qi_metode_aktif());
    if (!$boleh) mt_jawab(409, ['status' => 'error', 'message' => $alasan, 'layak_aktif' => false]);
    try {
        $pdo->beginTransaction();
        $pdo->exec('UPDATE `ai_method_versions` SET `is_active`=0');
        $pdo->prepare('UPDATE `ai_method_versions` SET `is_active`=1, `status_usul`=?, `disetujui_oleh`=?, `diaktifkan_pada`=NOW() WHERE `version`=?')
            ->execute(['disetujui', mb_substr($namaAdmin, 0, 100), $versi]);
        $pdo->commit();
    } catch (Throwable $e) {
        try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Throwable $e2) {}
        mt_jawab(500, ['status' => 'error', 'message' => 'Gagal mengaktifkan: ' . $e->getMessage()]);
    }
    mt_jawab(200, ['status' => 'success', 'message' => 'Versi ' . $versi . ' DIAKTIFKAN oleh ' . $namaAdmin . '. ' . $alasan]);
}

if ($aksi === 'tolak') {
    $sebab = trim((string)($badan['sebab'] ?? ''));
    if (mb_strlen($sebab) < 3) mt_jawab(400, ['status' => 'error', 'message' => 'Alasan penolakan wajib diisi (minimal 3 huruf) supaya dapat diaudit.']);
    try {
        $pdo->prepare('UPDATE `ai_method_versions` SET `status_usul`=?, `alasan_tolak`=? WHERE `version`=?')
            ->execute(['ditolak', mb_substr($sebab, 0, 255), $versi]);
    } catch (Throwable $e) {
        mt_jawab(500, ['status' => 'error', 'message' => 'Gagal menolak: ' . $e->getMessage()]);
    }
    mt_jawab(200, ['status' => 'success', 'message' => 'Versi ' . $versi . ' ditolak: ' . $sebab]);
}

mt_jawab(400, ['status' => 'error', 'message' => 'Aksi "' . $aksi . '" tidak dikenal. Gunakan: usulkan | metrik | aktifkan | tolak.']);

endif;   // akhir penjaga QI_METODE_LIB
