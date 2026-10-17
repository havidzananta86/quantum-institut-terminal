<?php
/**
 * PENGATURAN NOTIFIKASI SINYAL PER PENGGUNA (Fase 2).
 *
 * GET                → pengaturan milik pengguna + kesiapan server + 10 kiriman terakhir
 * GET ?terbaru=1     → 5 sinyal terbaru (ringkas) untuk notifikasi desktop di peramban
 * POST {aksi:'simpan', telegram_enabled, telegram_chat_id, discord_enabled, discord_webhook?,
 *       discord_hapus?, slack_enabled, slack_webhook?, slack_hapus?, email_enabled, desktop_enabled}
 * POST {aksi:'uji'}  → kirim pesan UJI ke semua kanal aktif milik pengguna ini, hasil apa adanya
 *
 * Keamanan:
 *   · Wajib login; setiap pengguna hanya bisa membaca/mengubah barisnya sendiri.
 *   · URL webhook divalidasi di server (HTTPS + host resmi Discord/Slack), disimpan terenkripsi,
 *     dan TIDAK PERNAH dikembalikan utuh — hanya petunjuk singkat (mis. "discord.com/…/abcd").
 *     Kolom webhook yang dikirim kosong berarti "biarkan yang tersimpan"; hapus harus eksplisit.
 *   · Email hanya ke alamat akun (bukan alamat bebas).
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_notif.php';
require_once __DIR__ . '/_mailer.php';

$metode = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$aksiUji = $metode === 'POST' && (($_GET['aksi'] ?? '') === 'uji');
qi_rate_limit($aksiUji ? 6 : 60, 60);
$pengguna = qi_require_auth();
$uid = (int)$pengguna['user_id'];
$pdo = qi_db();

function qi_ns_jawab(array $d, int $kode = 200): void
{
    http_response_code($kode);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function qi_ns_baca(PDO $pdo, int $uid): array
{
    try {
        $st = $pdo->prepare('SELECT * FROM user_notification_settings WHERE user_id = ?');
        $st->execute([$uid]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: [];
    } catch (PDOException $e) {
        if ($e->getCode() === '42S02') {
            qi_ns_jawab(['status' => 'error', 'code' => 'MIGRASI_BELUM',
                'message' => 'Tabel notifikasi belum ada. Admin perlu menjalankan database/migrations/016_user_notification_settings.sql.'], 503);
        }
        throw $e;
    }
}

/** Bentuk jawaban untuk UI — tanpa URL webhook utuh. */
function qi_ns_status(PDO $pdo, int $uid, string $email): array
{
    $b = qi_ns_baca($pdo, $uid);
    $riwayat = [];
    try {
        $st = $pdo->prepare('SELECT signal_id, channel, ok, http_code, note, created_at FROM notification_deliveries
                             WHERE user_id = ? ORDER BY id DESC LIMIT 10');
        $st->execute([$uid]);
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $riwayat[] = ['sinyal' => $r['signal_id'], 'kanal' => $r['channel'],
                'ok' => $r['ok'] === null ? null : (bool)$r['ok'], 'kode' => $r['http_code'] !== null ? (int)$r['http_code'] : null,
                'catatan' => (string)$r['note'], 'waktu' => $r['created_at']];
        }
    } catch (PDOException $e) { /* riwayat opsional */ }

    $tgSiap = qi_notif_token_telegram() !== '';
    $smtp = qi_mail_status();
    return [
        'status' => 'success',
        'setelan' => [
            'telegram' => ['aktif' => !empty($b['telegram_enabled']), 'chat_id' => (string)($b['telegram_chat_id'] ?? '')],
            'discord'  => ['aktif' => !empty($b['discord_enabled']), 'tersimpan' => !empty($b['discord_webhook_enc']), 'petunjuk' => (string)($b['discord_webhook_hint'] ?? '')],
            'slack'    => ['aktif' => !empty($b['slack_enabled']), 'tersimpan' => !empty($b['slack_webhook_enc']), 'petunjuk' => (string)($b['slack_webhook_hint'] ?? '')],
            'email'    => ['aktif' => !empty($b['email_enabled']), 'alamat' => $email],
            'desktop'  => ['aktif' => $b ? !empty($b['desktop_enabled']) : true],
        ],
        'server' => [
            'telegram' => ['siap' => $tgSiap, 'catatan' => $tgSiap ? 'Bot Telegram server aktif.' : 'Bot Telegram server belum diatur admin — kanal Telegram tidak bisa mengirim.'],
            'email'    => ['siap' => $smtp['terkonfigurasi'], 'catatan' => $smtp['catatan']],
        ],
        'riwayat' => $riwayat,
    ];
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($metode === 'GET') {
    if (!empty($_GET['terbaru'])) {
        qi_ns_jawab(['status' => 'success', 'sinyal' => qi_notif_sinyal_terbaru(5)]);
    }
    qi_ns_jawab(qi_ns_status($pdo, $uid, (string)$pengguna['email']));
}

if ($metode !== 'POST') qi_ns_jawab(['status' => 'error', 'message' => 'Metode tidak diizinkan.'], 405);

$input = qi_get_json_body();
if (!is_array($input)) $input = [];
$aksi = strtolower(trim((string)($_GET['aksi'] ?? $input['aksi'] ?? 'simpan')));

// ── UJI ──────────────────────────────────────────────────────────────────────
if ($aksi === 'uji') {
    $b = qi_ns_baca($pdo, $uid);
    if (!$b || !(int)$b['telegram_enabled'] && !(int)$b['discord_enabled'] && !(int)$b['slack_enabled'] && !(int)$b['email_enabled']) {
        qi_ns_jawab(['status' => 'error', 'message' => 'Belum ada kanal server (Telegram/Discord/Slack/Email) yang aktif. Simpan pengaturan dulu.'], 400);
    }
    $contoh = ['symbol' => 'XAUUSD', 'side' => 'BUY', 'engine_name' => 'Quantum Auto Signal', 'timeframe' => 'H1',
               'entry' => 2400.50, 'sl' => 2392.10, 'tp' => 2417.30, 'rr' => 2.0, 'grade' => 'A', 'timestamp' => date('Y-m-d H:i:s')];
    $h = qi_notif_sebar_sinyal($contoh, $uid, true);
    $jawab = qi_ns_status($pdo, $uid, (string)$pengguna['email']);
    $jawab['uji'] = ['per_kanal' => $h['per_kanal'], 'catatan' => $h['catatan']];
    $adaGagal = !$h['per_kanal'] || in_array(false, array_column($h['per_kanal'], 'ok'), true);
    if ($adaGagal) $jawab['status'] = 'partial';
    qi_ns_jawab($jawab);
}

if ($aksi !== 'simpan') qi_ns_jawab(['status' => 'error', 'message' => 'Aksi tidak dikenal.'], 400);

// ── SIMPAN ───────────────────────────────────────────────────────────────────
$lama = qi_ns_baca($pdo, $uid);
$bool = static fn($k, $bawaan) => array_key_exists($k, $input) ? (filter_var($input[$k], FILTER_VALIDATE_BOOLEAN) ? 1 : 0) : (int)$bawaan;

$baru = [
    'telegram_enabled' => $bool('telegram_enabled', $lama['telegram_enabled'] ?? 0),
    'telegram_chat_id' => array_key_exists('telegram_chat_id', $input) ? trim((string)$input['telegram_chat_id']) : (string)($lama['telegram_chat_id'] ?? ''),
    'discord_enabled'  => $bool('discord_enabled', $lama['discord_enabled'] ?? 0),
    'slack_enabled'    => $bool('slack_enabled', $lama['slack_enabled'] ?? 0),
    'email_enabled'    => $bool('email_enabled', $lama['email_enabled'] ?? 0),
    'desktop_enabled'  => $bool('desktop_enabled', $lama['desktop_enabled'] ?? 1),
];

if ($baru['telegram_chat_id'] !== '' && !qi_notif_chat_id_sah($baru['telegram_chat_id'])) {
    qi_ns_jawab(['status' => 'error', 'code' => 'CHAT_TIDAK_WAJAR', 'message' => 'Chat id Telegram tidak wajar. Isi angka (contoh 123456789) atau @nama_kanal.'], 400);
}
if ($baru['telegram_enabled'] && $baru['telegram_chat_id'] === '') {
    qi_ns_jawab(['status' => 'error', 'code' => 'CHAT_KOSONG', 'message' => 'Isi chat id Telegram sebelum mengaktifkan kanal Telegram.'], 400);
}

foreach (['discord', 'slack'] as $kanal) {
    $baru[$kanal . '_webhook_enc']  = $lama[$kanal . '_webhook_enc'] ?? null;
    $baru[$kanal . '_webhook_hint'] = $lama[$kanal . '_webhook_hint'] ?? null;
    if (!empty($input[$kanal . '_hapus'])) {
        $baru[$kanal . '_webhook_enc'] = null;
        $baru[$kanal . '_webhook_hint'] = null;
        $baru[$kanal . '_enabled'] = 0;
    }
    $masuk = trim((string)($input[$kanal . '_webhook'] ?? ''));
    if ($masuk !== '') {
        $v = qi_notif_validasi_webhook($kanal, $masuk);
        if (!$v['ok']) qi_ns_jawab(['status' => 'error', 'code' => 'WEBHOOK_TIDAK_SAH', 'kanal' => $kanal, 'message' => $v['pesan']], 400);
        $enc = qi_notif_enkripsi($v['url'], $kanal . ':' . $uid);
        if ($enc === null) qi_ns_jawab(['status' => 'error', 'code' => 'ENKRIPSI_GAGAL', 'message' => 'Server tidak dapat mengenkripsi URL webhook (OpenSSL/kunci tidak tersedia).'], 500);
        $baru[$kanal . '_webhook_enc'] = $enc;
        $baru[$kanal . '_webhook_hint'] = $v['petunjuk'];
    }
    if ($baru[$kanal . '_enabled'] && empty($baru[$kanal . '_webhook_enc'])) {
        qi_ns_jawab(['status' => 'error', 'code' => 'WEBHOOK_KOSONG', 'kanal' => $kanal,
            'message' => 'Tempel URL webhook ' . ucfirst($kanal) . ' sebelum mengaktifkan kanalnya.'], 400);
    }
}

$kolom = array_keys($baru);
$sql = 'INSERT INTO user_notification_settings (user_id, ' . implode(', ', $kolom) . ') VALUES (?' . str_repeat(', ?', count($kolom)) . ')
        ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(static fn($k) => "$k = VALUES($k)", $kolom));
$pdo->prepare($sql)->execute(array_merge([$uid], array_values($baru)));

$jawab = qi_ns_status($pdo, $uid, (string)$pengguna['email']);
$jawab['disimpan'] = true;
qi_ns_jawab($jawab);
