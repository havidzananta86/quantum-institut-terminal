<?php
/**
 * Quantum Institut — Maintenance Cron
 *
 * Housekeeping for the file-based caches. Nothing here expires on its own:
 * cache/logs grows one file per day forever, and the rate-limit sweep in
 * _middleware.php only runs on ~1% of requests, so it stalls on a quiet site.
 *
 * Run from cron every 15 minutes: besides cache cleanup it also evaluates
 * active signals (TP/SL) and runs the structure-based shadow scan.
 *   php /home/.../public_html/webapp/api/maintenance-cron.php
 *
 * Or over HTTP with the shared secret:
 *   GET /api/maintenance-cron.php?key=CRON_SECRET_KEY
 *
 * Add &dry=1 (or --dry on the CLI) to report what would be removed
 * without deleting anything.
 */

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    define('QI_DEV', false);
    require_once __DIR__ . '/_middleware.php';

    $cronKey  = '';
    $keysFile = __DIR__ . '/../config/api_keys.php';
    if (file_exists($keysFile)) { include_once $keysFile; }
    if (defined('CRON_SECRET_KEY')) $cronKey = CRON_SECRET_KEY;

    $providedKey = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
    if (!$cronKey || !hash_equals($cronKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Akses ditolak']);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
    $dryRun = !empty($_GET['dry']);
} else {
    require_once __DIR__ . '/_middleware.php';
    $dryRun = in_array('--dry', $argv ?? [], true);
}

// Retention per directory, in seconds. Key = directory under cache/,
// pattern = filenames eligible for deletion (anything else is left alone).
$RULES = [
    'logs'      => ['pattern' => '/^app-\d{4}-\d{2}-\d{2}\.jsonl$/',    'max_age' => 14 * 86400],
    // Written by api/error-log.php, one file per day, from browser errors.
    // Kept longer than app logs: it is the only record of client-side
    // failures, and a bug reported days later still needs its trace.
    'errorlogs' => ['pattern' => '/^errors-\d{4}-\d{2}-\d{2}\.jsonl$/', 'max_age' => 30 * 86400],
    'ratelimit' => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 3600],
    'otp'       => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 3600],
    // .json.lock: berkas kunci single-flight get-chart-data.php — dulu tidak pernah dibersihkan.
    'chart'          => ['pattern' => '/^[0-9a-f]{32}\.json(\.lock)?$/',     'max_age' => 86400],
    // Ditulis api/live-price.php (TTL 1 dtk; sapuan sendiri hanya 1 dari 20 permintaan).
    'live-price'     => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 3600],
    // Ditulis api/get-history.php untuk backtest (data historis panjang).
    'history'        => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 7 * 86400],
    'td'             => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 86400],
    'crypto-futures' => ['pattern' => '/^.*\.json$/',                        'max_age' => 3600],
    'ai_signals'     => ['pattern' => '/^.*\.json$/',                        'max_age' => 86400],
    // Ditulis api/ai-jelaskan.php (penjelasan setup, disimpan 24 jam).
    'ai_jelaskan'    => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 2 * 86400],
    'frankfurter'    => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 86400],
    // Ditulis api/csp-report.php: satu berkas per hari. Sebelumnya TIDAK pernah
    // dibersihkan, jadi tumbuh tanpa batas — dan laporan CSP bisa sangat banyak.
    'csp-reports'    => ['pattern' => '/^csp-\d{4}-\d{2}-\d{2}\.jsonl$/',    'max_age' => 30 * 86400],
    // Ditulis api/tv-scan.php (nama berkas md5).
    'tv-scan'        => ['pattern' => '/^[0-9a-f]{32}\.json$/',              'max_age' => 86400],
    // Tick harga terakhir dari EA MT5 (api/mt-bridge.php?action=tick). Satu berkas per
    // akun, ditimpa tiap detik — jadi umurnya pendek dan aman dibersihkan lebih cepat.
    'ticks'          => ['pattern' => '/^\d+\.json$/',                       'max_age' => 3600],
];

$cacheRoot = realpath(__DIR__ . '/../cache');
$now       = time();
$report    = [];
$totalDel  = 0;
$totalBytes = 0;

if ($cacheRoot === false) {
    $out = ['status' => 'error', 'message' => 'cache/ tidak ditemukan'];
    echo $isCli ? json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL : json_encode($out);
    exit(1);
}

foreach ($RULES as $sub => $rule) {
    $dir = realpath($cacheRoot . DIRECTORY_SEPARATOR . $sub);
    // Guard against symlinks or traversal pointing outside cache/.
    if ($dir === false || strpos($dir, $cacheRoot) !== 0 || !is_dir($dir)) {
        $report[$sub] = ['skipped' => 'direktori tidak ada'];
        continue;
    }

    $deleted = 0; $kept = 0; $bytes = 0;
    foreach (scandir($dir) ?: [] as $name) {
        if ($name === '.' || $name === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path)) continue;                       // never touch subdirectories
        if (!preg_match($rule['pattern'], $name)) { $kept++; continue; }

        $age = $now - (int)@filemtime($path);
        if ($age <= $rule['max_age']) { $kept++; continue; }

        $size = (int)@filesize($path);
        if ($dryRun || @unlink($path)) {
            $deleted++; $bytes += $size;
        }
    }

    $report[$sub] = [
        'dihapus'    => $deleted,
        'disimpan'   => $kept,
        'bytes'      => $bytes,
        'max_age_h'  => round($rule['max_age'] / 3600, 1),
    ];
    $totalDel   += $deleted;
    $totalBytes += $bytes;
}

$out = [
    'status'      => 'success',
    'dry_run'     => $dryRun,
    'total_dihapus' => $totalDel,
    'total_kb'    => round($totalBytes / 1024, 1),
    'detail'      => $report,
    'timestamp'   => date('Y-m-d H:i:s'),
];

if (function_exists('qi_log')) {
    qi_log('info', 'maintenance-cron selesai', ['dihapus' => $totalDel, 'dry_run' => $dryRun]);
}

// ── Penilaian sinyal terjadwal ──────────────────────────────────────────────
// Menyelesaikan sinyal AKTIF menjadi HIT TP / HIT SL / EXPIRED memakai candle
// yang sudah ada. Dengan warm=1 cache candle diisi dulu, jadi sinyal terbaru pun
// bisa dinilai walau belum ada yang membuka chart-nya. Dibungkus try/catch supaya
// kegagalan penilaian tidak pernah menggagalkan pembersihan cache.
if (!$dryRun) {
    try {
        if (!defined('QI_SIGNAL_EVAL_LIB')) define('QI_SIGNAL_EVAL_LIB', true);
        require_once __DIR__ . '/signal-evaluator.php';
        if (function_exists('qi_signal_evaluator_run')) {
            $out['penilai_sinyal'] = qi_signal_evaluator_run(false, true, 100);
        }
    } catch (Throwable $e) {
        $out['penilai_sinyal'] = ['error' => 'penilaian sinyal dilewati'];
    }
}

// ── Sinyal bayangan berbasis struktur ───────────────────────────────────────
// Menilai order limit yang terbuka dan memindai beberapa simbol (lihat api/_setup_shadow.php).
// Hanya dicatat di cache/signal_shadow.json untuk dibandingkan dengan sinyal lama — tidak tampil
// ke pengguna. Dilewati bila putaran lain (dashboard) baru jalan <10 menit lalu.
if (!$dryRun) {
    try {
        $penandaBayangan = __DIR__ . '/../cache/signal_shadow_auto.txt';
        if (is_file($penandaBayangan) && (time() - (int)@filemtime($penandaBayangan)) < 600) {
            $out['sinyal_bayangan'] = ['dilewati' => 'baru dijalankan <10 menit lalu'];
        } else {
            if (!defined('QI_SERVER_MT5')) define('QI_SERVER_MT5', true);
            if (!defined('QI_AI_SIGNAL_LIB')) define('QI_AI_SIGNAL_LIB', 1);
            require_once __DIR__ . '/_setup_shadow.php';
            require_once __DIR__ . '/ai-signal.php';
            if (function_exists('ai_load_candles') && function_exists('qi_ss_jalankan')) {
                @file_put_contents($penandaBayangan, (string)time(), LOCK_EX);
                $b = qi_ss_jalankan([
                    'muat'   => fn(string $simbol, string $iv): array => ai_load_candles($simbol, $iv),
                    'berita' => qi_berita_blackout(30, true),
                ]);
                $out['sinyal_bayangan'] = ['dinilai' => $b['dinilai'], 'dibuat' => $b['dibuat'], 'dipindai' => $b['dipindai'], 'total_rekor' => $b['total_rekor'] ?? null];
            }
        }
    } catch (Throwable $e) {
        $out['sinyal_bayangan'] = ['error' => 'sinyal bayangan dilewati'];
    }
}

// ── Sinyal VALID dari indikator Pine "SMC+SnD BUY SELL COMBO" ───────────────
// Port PHP indikator (api/_pine_smcsnd.php) dipindai per bar H4 yang sudah tutup (lihat api/_pine_sinyal.php):
// transisi ke VALID BUY/SELL dicatat di cache/pine_signals.json dan diberitahukan SEKALI ke pengguna yang
// mengaktifkan kanal notifikasi. Catatan terpisah dari riwayat sinyal resmi. Matikan notifikasinya dengan
// define('QI_PINE_NOTIF', false) di config/api_keys.php (pencatatan tetap jalan).
if (!$dryRun) {
    try {
        $penandaPine = __DIR__ . '/../cache/pine_scan_auto.txt';
        if (is_file($penandaPine) && (time() - (int)@filemtime($penandaPine)) < 600) {
            $out['sinyal_pine'] = ['dilewati' => 'baru dijalankan <10 menit lalu'];
        } else {
            if (!defined('QI_SERVER_MT5')) define('QI_SERVER_MT5', true);
            if (!defined('QI_AI_SIGNAL_LIB')) define('QI_AI_SIGNAL_LIB', 1);
            require_once __DIR__ . '/_pine_sinyal.php';
            require_once __DIR__ . '/ai-signal.php';
            if (function_exists('ai_load_candles') && function_exists('qi_pine_pindai')) {
                @file_put_contents($penandaPine, (string)time(), LOCK_EX);
                $notifPine = (!defined('QI_PINE_NOTIF') || QI_PINE_NOTIF)
                    ? static function (array $rek) {
                        if (!function_exists('qi_notif_sebar_sinyal')) require_once __DIR__ . '/_notif.php';
                        $h = qi_notif_sebar_sinyal($rek);
                        return ['ok' => $h['ok'], 'pengguna' => $h['pengguna']];
                    }
                    : null;
                $p = qi_pine_pindai([
                    'muat'  => fn(string $simbol, string $iv): array => ai_load_candles($simbol, $iv),
                    'notif' => $notifPine,
                ]);
                $out['sinyal_pine'] = ['dinilai' => $p['dinilai'], 'dibuat' => $p['dibuat'], 'dipindai' => $p['dipindai'], 'total_rekor' => $p['total_rekor'] ?? null];
            }
        }
    } catch (Throwable $e) {
        $out['sinyal_pine'] = ['error' => 'pemindai sinyal Pine dilewati'];
    }
}

// ── Brief pasar harian ──────────────────────────────────────────────────────
// Disiapkan lebih awal (mulai 06:00 WIB) supaya pengguna pertama tidak menunggu AI dan biaya AI tetap satu
// panggilan per hari. Gagal tidak mengganggu cron; dashboard membuatnya sendiri bila belum ada.
if (!$dryRun) {
    try {
        require_once __DIR__ . '/_brief_harian.php';
        $jamWib = (int)(new DateTimeImmutable('now', new DateTimeZone('Asia/Jakarta')))->format('G');
        if ($jamWib >= 6) {
            $b = qi_brief_ambil(time());
            $out['brief_harian'] = ['tanggal' => $b['tanggal'], 'sumber' => $b['sumber'], 'dari_cache' => $b['cache']];
        } else {
            $out['brief_harian'] = ['dilewati' => 'belum 06:00 WIB'];
        }
    } catch (Throwable $e) {
        $out['brief_harian'] = ['error' => 'brief harian dilewati'];
    }
}

// ── Retensi snapshot akun ───────────────────────────────────────────────────
// EA mengirim snapshot tiap ±60 detik = ±1.440 baris/hari/akun, dan sebelumnya TIDAK
// ADA pembersihan sama sekali (tumbuh tanpa batas: ±526 ribu baris per akun per tahun).
// Grafik saldo/ekuitas hanya membaca maksimal 7 hari, jadi menyimpan 30 hari sudah
// sangat longgar.
$out['retensi_snapshot_hari'] = 30;
try {
    $pdo = qi_db();
    if ($pdo->query("SHOW TABLES LIKE 'trading_account_snapshots'")->fetch()) {
        if ($dryRun) {
            $st = $pdo->query("SELECT COUNT(*) c FROM trading_account_snapshots WHERE captured_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            $out['snapshot_akan_dihapus'] = (int)$st->fetch()['c'];
        } else {
            $n = (int)$pdo->exec("DELETE FROM trading_account_snapshots WHERE captured_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            $out['snapshot_dihapus'] = $n;
            if ($n > 0 && function_exists('qi_log')) {
                qi_log('info', 'Retensi snapshot dijalankan', ['dihapus' => $n, 'hari' => 30]);
            }
        }
    } else {
        $out['snapshot_dihapus'] = 'tabel belum ada';
    }
} catch (Throwable $e) {
    $out['snapshot_dihapus'] = 'dilewati';
}

// ── Penurunan role untuk lisensi yang sudah kedaluwarsa ─────────────────────
// Sebelumnya status pembayaran hanya MENAIKKAN role (api/payment.php) dan tidak ada
// satu pun proses yang menurunkannya — sehingga pembeli 1 bulan mempertahankan akses
// 'pro' selamanya.
//
// Aturan di bawah SENGAJA SEMPIT supaya tidak merusak akun yang diberikan manual:
//    role pro/vip  DAN  PUNYA baris lisensi  DAN  TIDAK punya lisensi aktif.
// Akun tanpa baris lisensi (admin, akun demo, pemberian manual) TIDAK PERNAH disentuh.
// Diperiksa pada data produksi 2026-10-11: 0 kandidat, dan tiga akun pro/vip tanpa
// baris lisensi tetap aman.
try {
    $pdo = $pdo ?? qi_db();
    $kandidat = $pdo->query("SELECT u.id, u.email, u.role FROM users u
        WHERE u.role IN ('pro','vip')
          AND EXISTS (SELECT 1 FROM license_keys lk WHERE lk.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM license_keys lk2
                          WHERE lk2.user_id = u.id AND lk2.is_active = 1 AND lk2.expires_at > NOW())")
        ->fetchAll(PDO::FETCH_ASSOC);
    $out['lisensi_kedaluwarsa'] = count($kandidat);
    if ($dryRun) {
        $out['lisensi_akan_diturunkan'] = array_map(fn($x) => $x['email'], $kandidat);
    } elseif ($kandidat) {
        $ids = array_map(fn($x) => (int)$x['id'], $kandidat);
        $in  = implode(',', $ids);
        $n   = (int)$pdo->exec("UPDATE users SET role = 'user' WHERE id IN ($in) AND role IN ('pro','vip')");
        $out['lisensi_diturunkan'] = $n;
        if (function_exists('qi_log')) {
            qi_log('info', 'Role diturunkan karena lisensi kedaluwarsa', ['jumlah' => $n, 'user_ids' => $ids]);
        }
    }
} catch (Throwable $e) {
    $out['lisensi_diturunkan'] = 'dilewati';
}

echo $isCli ? json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL : json_encode($out);
