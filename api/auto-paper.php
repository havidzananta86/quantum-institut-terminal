<?php
/**
 * Ikuti Auto Analisa dengan AKUN SIMULASI (paper trading otomatis) — lihat api/_auto_paper.php.
 *
 *   GET   → pengaturan + saldo simulasi + posisi terbuka + total bertambah/berkurang + transaksi terbaru
 *   POST  → {aktif: bool, risiko_pct: 0.25–5}   (PRO ke atas, seperti Paper Trading)
 *
 * Uang virtual saja: tidak ada order sungguhan yang dikirim ke mana pun.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_auto_paper.php';
qi_rate_limit(30, 60);

$user = qi_require_level('pro');
$uid  = (int)$user['user_id'];
$pdo  = qi_db();
qi_ap_tabel($pdo);
$k = qi_ap_konfig();

/** Riwayat sinyal resmi (berkas yang sama dengan Auto Analisa). */
$muatRiwayat = static function (): array {
    $f = __DIR__ . '/../cache/signal_history.json';
    $d = is_file($f) ? json_decode((string)@file_get_contents($f), true) : [];
    return is_array($d) ? $d : [];
};

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = qi_get_json_body();
    if (!is_array($in) || !array_key_exists('aktif', $in)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
        exit;
    }
    $aktif = (bool)$in['aktif'];
    $risiko = isset($in['risiko_pct']) && is_numeric($in['risiko_pct']) ? (float)$in['risiko_pct'] : null;
    if ($risiko !== null && ($risiko < $k['risiko_min'] || $risiko > $k['risiko_maks'])) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Risiko per sinyal harus ' . $k['risiko_min'] . '–' . $k['risiko_maks'] . '% dari saldo simulasi.']);
        exit;
    }
    $st = $pdo->prepare('SELECT enabled, risk_pct FROM auto_paper_settings WHERE user_id = :u');
    $st->execute([':u' => $uid]);
    $lama = $st->fetch(PDO::FETCH_ASSOC);
    $risikoAkhir = $risiko ?? ($lama ? (float)$lama['risk_pct'] : $k['risiko_awal']);
    // enabled_at hanya diperbarui saat BARU dinyalakan: sinyal sebelumnya tidak ikut dibuka (tanpa "backfill").
    $barudinyalakan = $aktif && (!$lama || !(int)$lama['enabled']);
    $pdo->prepare('INSERT INTO auto_paper_settings (user_id, enabled, risk_pct, enabled_at) VALUES (:u, :e, :r, :t)
                   ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), risk_pct = VALUES(risk_pct), enabled_at = IF(:baru = 1, VALUES(enabled_at), enabled_at)')
        ->execute([':u' => $uid, ':e' => $aktif ? 1 : 0, ':r' => $risikoAkhir, ':t' => time(), ':baru' => $barudinyalakan ? 1 : 0]);
}

// Sinkron ringan untuk pengguna ini (pembukaan) + penutupan semua posisi yang sinyalnya sudah selesai.
try { qi_ap_sinkron($pdo, $muatRiwayat(), $uid); } catch (Throwable $e) { error_log('[QI AutoPaper] sinkron: ' . $e->getMessage()); }

echo json_encode(['status' => 'success', 'data' => qi_ap_ringkasan($pdo, $uid)], JSON_UNESCAPED_UNICODE);
