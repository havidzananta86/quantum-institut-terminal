<?php
declare(strict_types=1);
/**
 * QUANTUM AI SIGNAL GATEWAY — data panel (Tahap 4).
 *
 * GET api/gateway.php?simbol=&status=&auth=&batas=
 *
 * MENGAPA ADA:
 *   Spesifikasi (Bagian 8) meminta panel yang menampilkan log sinyal/webhook masuk
 *   beserta filternya, status koneksi, dan statistik. Sejak Tahap 1C, SETIAP permintaan
 *   webhook sudah dicatat di tabel ai_webhook_logs — endpoint ini menyajikannya.
 *
 * KEJUJURAN YANG DIJAGA:
 *   · Bila tabel log belum dimigrasi, 'tersedia' = false + keterangan — bukan daftar
 *     kosong yang terlihat seperti "tidak ada trafik".
 *   · Kunci rahasia webhook TIDAK dikirim dari sini (tidak diperlukan untuk menampilkan
 *     log). Panel mengambil URL + kunci dari api/tv-webhook.php?info=1 (khusus PRO).
 *   · Status jeda darurat ikut dikirim apa adanya (aktif/tidak + sebabnya).
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_jeda.php';
// Status gerbang konfluensi mesin (syarat minimal 3 mesin searah) — dikendalikan admin.
if (is_file(__DIR__ . '/_gerbang.php')) require_once __DIR__ . '/_gerbang.php';
qi_rate_limit(60, 60);

// Panel operasional: minimal PRO (sejalan dengan endpoint info webhook).
qi_require_level('pro');

function gw_jawab(int $kode, array $data): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$jeda = qi_jeda_status();

// ── Log webhook (fail-safe bila tabel belum ada) ───────────────────────────────
$tersedia = false;
$log = [];
$ringkas = ['total' => 0, 'hari_ini' => 0, 'per_status' => [], 'per_auth' => [], 'terakhir' => null];
$catatan = null;

try {
    if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
    $pdo = getDBConnection();
    $pdo->query('SELECT 1 FROM `ai_webhook_logs` LIMIT 1');
    $tersedia = true;

    // Filter dibangun dengan placeholder (bukan penggabungan teks) supaya aman.
    $syarat = [];
    $nilai  = [];
    $simbol = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['simbol'] ?? '')));
    if ($simbol !== '') { $syarat[] = '`symbol` = ?'; $nilai[] = $simbol; }
    $status = strtoupper(trim((string)($_GET['status'] ?? '')));
    if ($status !== '' && preg_match('/^[A-Z_]{3,20}$/', $status)) { $syarat[] = '`status` = ?'; $nilai[] = $status; }
    $auth = strtolower(trim((string)($_GET['auth'] ?? '')));
    if (in_array($auth, ['hmac', 'query_key', 'none'], true)) { $syarat[] = '`auth_method` = ?'; $nilai[] = $auth; }
    $batas = (int)($_GET['batas'] ?? 50);
    $batas = max(1, min(200, $batas));
    $where = $syarat ? (' WHERE ' . implode(' AND ', $syarat)) : '';

    $st = $pdo->prepare('SELECT `id`,`received_at`,`source`,`ip`,`symbol`,`timeframe`,`action`,`status`,`http_code`,`auth_method`,`signature_ok`,`signal_id`,`message`'
        . ' FROM `ai_webhook_logs`' . $where . ' ORDER BY `id` DESC LIMIT ' . $batas);
    $st->execute($nilai);
    $log = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Ringkasan seluruh trafik (bukan hanya yang tampil) supaya angkanya tidak menipu.
    $ringkas['total'] = (int)$pdo->query('SELECT COUNT(*) FROM `ai_webhook_logs`')->fetchColumn();
    $ringkas['hari_ini'] = (int)$pdo->query('SELECT COUNT(*) FROM `ai_webhook_logs` WHERE `received_at` >= CURDATE()')->fetchColumn();
    foreach ($pdo->query('SELECT `status`, COUNT(*) c FROM `ai_webhook_logs` GROUP BY `status`')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $ringkas['per_status'][(string)$r['status']] = (int)$r['c'];
    }
    foreach ($pdo->query('SELECT `auth_method`, COUNT(*) c FROM `ai_webhook_logs` GROUP BY `auth_method`')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $kunci = ($r['auth_method'] === null || $r['auth_method'] === '') ? 'tidak diketahui' : (string)$r['auth_method'];
        $ringkas['per_auth'][$kunci] = (int)$r['c'];
    }
    $akhir = $pdo->query('SELECT `received_at` FROM `ai_webhook_logs` ORDER BY `id` DESC LIMIT 1')->fetchColumn();
    $ringkas['terakhir'] = $akhir ? (string)$akhir : null;
} catch (Throwable $e) {
    $tersedia = false;
    $catatan = 'Tabel log webhook belum tersedia: ' . $e->getMessage();
}

gw_jawab(200, [
    'status'    => 'ok',
    'tersedia'  => $tersedia,
    'catatan'   => $catatan,
    'jeda'      => ['aktif' => $jeda['jeda'], 'sebab' => $jeda['sebab'], 'sejak' => $jeda['sejak']],
    'gerbang'   => function_exists('qi_gerbang_status')
        ? (function () { $g = qi_gerbang_status(); return ['aktif' => $g['aktif'], 'sebab' => $g['sebab'], 'sejak' => $g['sejak']]; })()
        : ['aktif' => null, 'sebab' => 'modul gerbang tidak tersedia', 'sejak' => null],
    'ringkasan' => $ringkas,
    'log'       => $log,
    'filter'    => ['simbol' => $simbol ?? '', 'status' => $status ?? '', 'auth' => $auth ?? '', 'batas' => $batas ?? 50],
    'catatan_ukur' => 'Log ini mencatat SETIAP permintaan webhook (termasuk yang ditolak), sehingga alert yang gagal dapat ditelusuri sebabnya. Status RECEIVED berarti permintaan terautentikasi diterima; PROCESSED berarti sudah diproses AI (bisa menghasilkan sinyal atau tidak).',
]);
