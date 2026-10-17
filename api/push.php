<?php
/**
 * WEB PUSH — langganan milik pengguna yang login.
 *
 * GET                          → kunci publik VAPID + jumlah perangkat terdaftar
 * POST {aksi:'daftar', subscription:{endpoint, keys:{p256dh, auth}}}
 * POST {aksi:'hapus', endpoint}
 * POST {aksi:'uji'}            → kirim push uji ke semua perangkat pengguna ini (hasil apa adanya)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_push.php';
qi_rate_limit(30, 60);
$pengguna = qi_require_auth();
$uid = (int)$pengguna['user_id'];
$pdo = qi_db();

function qi_push_jawab(array $d, int $kode = 200): void { http_response_code($kode); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

$vapid = qi_push_vapid();
if (!$vapid) qi_push_jawab(['status' => 'error', 'message' => 'Kunci VAPID tidak dapat dibuat (OpenSSL EC tidak tersedia di server).'], 503);

$jumlah = static function () use ($pdo, $uid): int {
    try { $st = $pdo->prepare('SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?'); $st->execute([$uid]); return (int)$st->fetchColumn(); }
    catch (PDOException $e) {
        if ($e->getCode() === '42S02') qi_push_jawab(['status' => 'error', 'code' => 'MIGRASI_BELUM', 'message' => 'Tabel push belum ada. Jalankan database/migrations/018_push_subscriptions.sql.'], 503);
        throw $e;
    }
};

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    qi_push_jawab(['status' => 'success', 'publicKey' => $vapid['public'], 'perangkat' => $jumlah()]);
}

$in = qi_get_json_body();
if (!is_array($in)) qi_push_jawab(['status' => 'error', 'message' => 'Body JSON tidak valid.'], 400);
$aksi = (string)($in['aksi'] ?? '');

if ($aksi === 'daftar') {
    $sub = (array)($in['subscription'] ?? []);
    $endpoint = trim((string)($sub['endpoint'] ?? ''));
    $p256dh = (string)($sub['keys']['p256dh'] ?? '');
    $auth = (string)($sub['keys']['auth'] ?? '');
    if (strlen($endpoint) > 2000 || !qi_push_endpoint_sah($endpoint)) qi_push_jawab(['status' => 'error', 'message' => 'Endpoint push tidak dikenal.'], 400);
    $titik = qi_push_b64u_dec($p256dh); $rahasia = qi_push_b64u_dec($auth);
    if (!is_string($titik) || strlen($titik) !== 65 || !is_string($rahasia) || strlen($rahasia) < 16) qi_push_jawab(['status' => 'error', 'message' => 'Kunci langganan tidak sah.'], 400);
    $jumlah();
    $pdo->prepare('INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), fail_count = 0')
        ->execute([$uid, $endpoint, hash('sha256', $endpoint), $p256dh, $auth, mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
    qi_push_jawab(['status' => 'success', 'perangkat' => $jumlah()]);
}

if ($aksi === 'hapus') {
    $endpoint = trim((string)($in['endpoint'] ?? ''));
    $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?')->execute([$uid, hash('sha256', $endpoint)]);
    qi_push_jawab(['status' => 'success', 'perangkat' => $jumlah()]);
}

if ($aksi === 'uji') {
    $st = $pdo->prepare('SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?');
    $st->execute([$uid]);
    $langganan = $st->fetchAll(PDO::FETCH_ASSOC);
    if (!$langganan) qi_push_jawab(['status' => 'error', 'message' => 'Belum ada perangkat terdaftar untuk push.'], 400);
    $hasil = qi_push_kirim($pdo, $langganan, ['title' => '✅ Uji push Quantum Institut', 'body' => 'Push aktif — sinyal & price alert akan muncul walau dashboard ditutup.', 'tag' => 'qim-uji-' . time(), 'url' => 'dashboard.html']);
    $ok = count(array_filter($hasil, static fn($h) => $h['ok']));
    qi_push_jawab(['status' => $ok ? 'success' : 'error', 'terkirim' => $ok, 'dari' => count($hasil), 'hasil' => array_values($hasil), 'perangkat' => $jumlah(),
                   'message' => $ok ? null : 'Layanan push menolak kiriman (lihat kode di hasil).']);
}

qi_push_jawab(['status' => 'error', 'message' => 'Aksi tidak dikenal.'], 400);
