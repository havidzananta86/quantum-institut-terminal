<?php
/**
 * PRICE ALERT (server) — milik pengguna yang login.
 *
 * GET              → alert aktif + yang kena 7 hari terakhir. Sekaligus memeriksa alert pengguna ini
 *                    terhadap harga terkini (paling sering sekali per 20 detik per pengguna).
 * POST {symbol, price, direction:'above'|'below'} → buat alert (maks. 50 aktif)
 * POST {aksi:'impor', alerts:[...]}                → impor alert lama dari localStorage (sekali)
 * DELETE ?id=…     → hapus alert milik sendiri
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_alerts.php';
qi_rate_limit(60, 60);
$pengguna = qi_require_auth();
$uid = (int)$pengguna['user_id'];
$pdo = qi_db();
$metode = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

function qi_pa_jawab(array $d, int $kode = 200): void { http_response_code($kode); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

function qi_pa_daftar(PDO $pdo, int $uid): array
{
    // Waktu sebagai epoch dari MySQL: zona MySQL dan php.ini bisa berbeda (strtotime() menggeser jam).
    $st = $pdo->prepare('SELECT id, symbol, target_price, direction, is_triggered, UNIX_TIMESTAMP(triggered_at) AS triggered_ts, UNIX_TIMESTAMP(created_at) AS created_ts FROM price_alerts
                         WHERE user_id = ? AND (is_triggered = 0 OR triggered_at >= NOW() - INTERVAL 7 DAY) ORDER BY is_triggered ASC, created_at DESC LIMIT 200');
    $st->execute([$uid]);
    return array_map(static fn($r) => [
        'id' => (int)$r['id'], 'symbol' => $r['symbol'], 'price' => (float)$r['target_price'], 'direction' => $r['direction'],
        'active' => !(int)$r['is_triggered'], 'triggeredAt' => $r['triggered_ts'] ? gmdate('c', (int)$r['triggered_ts']) : null,
        'createdAt' => gmdate('c', (int)$r['created_ts']),
    ], $st->fetchAll(PDO::FETCH_ASSOC));
}

function qi_pa_buat(PDO $pdo, int $uid, $sym, $harga, $arah): ?string
{
    $sym = strtoupper(trim((string)$sym));
    $harga = is_numeric($harga) ? (float)$harga : 0;
    if (!qi_alert_simbol_sah($sym)) return 'Simbol tidak didukung untuk alert.';
    if ($harga <= 0) return 'Harga target harus lebih dari 0.';
    if (!in_array($arah, ['above', 'below'], true)) return 'Arah harus above atau below.';
    $n = $pdo->prepare('SELECT COUNT(*) FROM price_alerts WHERE user_id = ? AND is_triggered = 0');
    $n->execute([$uid]);
    if ((int)$n->fetchColumn() >= QI_ALERT_MAKS_AKTIF) return 'Maksimal ' . QI_ALERT_MAKS_AKTIF . ' alert aktif.';
    $pdo->prepare('INSERT INTO price_alerts (user_id, symbol, target_price, direction, is_triggered) VALUES (?, ?, ?, ?, 0)')->execute([$uid, $sym, $harga, $arah]);
    return null;
}

if ($metode === 'GET') {
    $kena = [];
    $penanda = __DIR__ . '/../cache/ratelimit/alert_cek_' . $uid . '.txt';
    if (!is_dir(dirname($penanda))) @mkdir(dirname($penanda), 0755, true);
    if (time() - (int)@filemtime($penanda) >= 20) {
        @touch($penanda);
        try { $kena = qi_alert_periksa($pdo, $uid)['kena']; } catch (Throwable $e) { @error_log('[alert] cek gagal: ' . $e->getMessage()); }
    }
    qi_pa_jawab(['status' => 'success', 'alerts' => qi_pa_daftar($pdo, $uid), 'baru_kena' => $kena]);
}

if ($metode === 'POST') {
    $in = qi_get_json_body();
    if (!is_array($in)) qi_pa_jawab(['status' => 'error', 'message' => 'Body JSON tidak valid.'], 400);
    if (($in['aksi'] ?? '') === 'impor') {
        $masuk = 0; $gagal = [];
        foreach (array_slice((array)($in['alerts'] ?? []), 0, QI_ALERT_MAKS_AKTIF) as $a) {
            if (!is_array($a) || empty($a['active'])) continue;
            $err = qi_pa_buat($pdo, $uid, $a['symbol'] ?? '', $a['price'] ?? 0, $a['direction'] ?? '');
            if ($err) $gagal[] = ($a['symbol'] ?? '?') . ': ' . $err; else $masuk++;
        }
        qi_pa_jawab(['status' => 'success', 'diimpor' => $masuk, 'gagal' => $gagal, 'alerts' => qi_pa_daftar($pdo, $uid)]);
    }
    $err = qi_pa_buat($pdo, $uid, $in['symbol'] ?? '', $in['price'] ?? 0, $in['direction'] ?? '');
    if ($err) qi_pa_jawab(['status' => 'error', 'message' => $err], 400);
    qi_pa_jawab(['status' => 'success', 'alerts' => qi_pa_daftar($pdo, $uid)]);
}

if ($metode === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $pdo->prepare('DELETE FROM price_alerts WHERE id = ? AND user_id = ?')->execute([$id, $uid]);
    qi_pa_jawab(['status' => 'success', 'alerts' => qi_pa_daftar($pdo, $uid)]);
}

qi_pa_jawab(['status' => 'error', 'message' => 'Metode tidak diizinkan.'], 405);
