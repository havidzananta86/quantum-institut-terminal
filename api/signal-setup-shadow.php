<?php
/**
 * SINYAL SETUP BERBASIS STRUKTUR — MODE BAYANGAN (lihat api/_setup_shadow.php untuk aturannya).
 *
 *   · Dashboard (self-healing): GET api/signal-setup-shadow.php?auto=1   + token login
 *   · Cron:                     php api/signal-setup-shadow.php   atau  ?key=CRON_SECRET
 *   · Laporan perbandingan:     GET api/signal-setup-shadow.php?laporan=1  (khusus admin)
 *
 * Rekor bayangan TIDAK masuk riwayat resmi, tidak memicu notifikasi, dan tidak tampil ke pengguna.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_setup_shadow.php';

$keysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($keysFile)) require_once $keysFile;

function shd_jawab(int $kode, array $data): void {
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$isCli = (PHP_SAPI === 'cli');
$auto = false;
$cache = __DIR__ . '/../cache';

if (!$isCli) {
    // ── Laporan: hanya admin ───────────────────────────────────────────────
    if (!empty($_GET['laporan'])) {
        $user = qi_require_auth();
        if (qi_tingkat_peran($user['role'] ?? null) < 3) shd_jawab(403, ['status' => 'error', 'message' => 'Laporan ini khusus admin.']);
        header('Cache-Control: no-store');
        $resmi = qi_ss_baca($cache . '/signal_history.json');
        $laporan = qi_ss_laporan(qi_ss_baca($cache . '/signal_shadow.json'), $resmi);
        $state = qi_ss_baca($cache . '/signal_shadow_state.json');
        $laporan['penolakan_filter'] = $state['penolakan'] ?? new stdClass();
        // Salinan database (dual-write, api/_rekor_db.php): harus identik sebelum pembacaan dipindah.
        require_once __DIR__ . '/_rekor_db.php';
        $laporan['salinan_database'] = qi_rekor_db_bandingkan('shadow', $cache . '/signal_shadow.json');
        // Apakah gerbang (spread, korelasi, berita, mesin) menolong? Kandidat yang ditolak, dinilai kontrafaktual.
        require_once __DIR__ . '/_sinyal_ditolak.php';
        $laporan['sinyal_ditolak'] = qi_ditolak_ringkas(qi_json_baca(qi_ditolak_berkas()));
        shd_jawab(200, $laporan);
    }

    $cronKey  = defined('CRON_SECRET_KEY') ? CRON_SECRET_KEY : '';
    $provided = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
    $viaCron  = ($cronKey && $provided && hash_equals($cronKey, (string)$provided));
    if (!$viaCron) {
        if (empty($_GET['auto'])) shd_jawab(403, ['status' => 'error', 'message' => 'Akses ditolak. Gunakan ?auto=1 (perlu login) atau kunci cron.']);
        $auto = true;
        if (!qi_validate_token()) shd_jawab(401, ['status' => 'error', 'message' => 'Perlu login.', 'code' => 'AUTH_REQUIRED']);
        // Jeda 15 menit + klaim atomik (satu proses), seperti pembangkit lama.
        $penanda = $cache . '/signal_shadow_auto.txt';
        if (file_exists($penanda) && (time() - (int)@filemtime($penanda)) < 900) {
            shd_jawab(200, ['status' => 'ok', 'mode' => 'auto', 'dijalankan' => false, 'dilewati' => true, 'alasan' => 'dijeda 15 menit']);
        }
        $kunciFile = $cache . '/signal_shadow.lock';
        $fp = @fopen($kunciFile, 'x');
        if ($fp === false && file_exists($kunciFile) && (time() - (int)@filemtime($kunciFile)) > 600) { @unlink($kunciFile); $fp = @fopen($kunciFile, 'x'); }
        if ($fp === false) shd_jawab(200, ['status' => 'ok', 'mode' => 'auto', 'dijalankan' => false, 'dilewati' => true, 'alasan' => 'putaran lain sedang berjalan']);
        fclose($fp);
        register_shutdown_function(function () use ($kunciFile) { @unlink($kunciFile); });
    }
}

// Candle: pakai feed broker MT5 untuk proses server (QI_SERVER_MT5), cadangan OANDA/sumber lama.
if (!defined('QI_SERVER_MT5')) define('QI_SERVER_MT5', true);
if (!defined('QI_AI_SIGNAL_LIB')) define('QI_AI_SIGNAL_LIB', 1);
require_once __DIR__ . '/ai-signal.php';
if (!function_exists('ai_load_candles')) shd_jawab(200, ['status' => 'error', 'message' => 'Pemuat candle tidak tersedia.']);

$hasil = qi_ss_jalankan([
    'muat'   => fn(string $simbol, string $iv): array => ai_load_candles($simbol, $iv),
    'urai_m1' => fn(string $simbol): callable => function (int $t0, int $t1) use ($simbol): array {
        $m = ai_load_candles($simbol, '1');
        return array_values(array_filter($m['candles'] ?? [], fn($c) => (int)$c['time'] >= $t0 && (int)$c['time'] < $t1));
    },
    'berita' => qi_berita_blackout(30, true),
]);
if ($auto) @file_put_contents($cache . '/signal_shadow_auto.txt', (string)time(), LOCK_EX);
// Salinan ke database (fail-safe: database mati tidak menggagalkan putaran).
require_once __DIR__ . '/_rekor_db.php';
$hasil['database'] = qi_rekor_db_sinkron('shadow', $cache . '/signal_shadow.json');

$hasil = ['status' => 'ok', 'dijalankan' => true, 'mode' => 'bayangan'] + $hasil;
echo json_encode($hasil, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | ($isCli ? JSON_PRETTY_PRINT : 0)) . ($isCli ? PHP_EOL : '');
