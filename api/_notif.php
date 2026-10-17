<?php
/**
 * PUSTAKA NOTIFIKASI SINYAL PER PENGGUNA (Fase 2) — Telegram, Discord, Slack, email.
 *
 * Satu sinyal yang tercatat disebar ke SEMUA kanal yang diaktifkan tiap pengguna
 * (tabel user_notification_settings, migrasi 016). Notifikasi desktop tidak dikirim dari
 * server — peramban menariknya sendiri (assets/js/qim-notifications.js).
 *
 * Kejujuran & keamanan yang dipegang:
 *   · TIDAK PERNAH menggagalkan pencatatan sinyal: tidak melempar, semua galat menjadi catatan.
 *   · Sinyal yang sama tidak dikirim dua kali ke kanal yang sama: setiap kiriman diklaim
 *     dulu lewat kunci unik (signal_id, user_id, channel) di notification_deliveries.
 *   · URL webhook disimpan TERENKRIPSI (AES-256-GCM) dan hanya boleh menuju host resmi
 *     Discord/Slack lewat HTTPS (mencegah SSRF: server tidak bisa disuruh memanggil alamat lain).
 *     Redirect tidak diikuti dan sertifikat TLS selalu diverifikasi.
 *   · Pesan selalu menyebut bahwa sinyal BUKAN jaminan menang.
 */

// Waktu sinyal tanpa ambigu (WIB + UTC) — api/_signal_time.php (perbaikan zona waktu sinyal).
if (is_file(__DIR__ . '/_signal_time.php')) require_once __DIR__ . '/_signal_time.php';

if (!function_exists('mb_substr')) {
    function mb_substr(string $string, int $start, ?int $length = null, ?string $encoding = null): string {
        return $length === null ? substr($string, $start) : substr($string, $start, $length);
    }
}
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $string, ?string $encoding = null): int {
        return strlen($string);
    }
}

if (!function_exists('qi_notif_validasi_webhook')):

define('QI_NOTIF_KANAL', ['telegram', 'discord', 'slack', 'email']);

// ─────────────────────────────────────────────────────────────────────────────
// VALIDASI URL WEBHOOK (fungsi murni)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validasi URL webhook Discord/Slack. Hanya HTTPS ke host resmi dengan bentuk path yang benar.
 * @return array{ok:bool,pesan:string,url:string,petunjuk:string}
 */
function qi_notif_validasi_webhook(string $jenis, string $url): array
{
    $gagal = static fn(string $p) => ['ok' => false, 'pesan' => $p, 'url' => '', 'petunjuk' => ''];
    $url = trim($url);
    if ($url === '') return $gagal('URL webhook kosong.');
    if (strlen($url) > 512) return $gagal('URL webhook terlalu panjang.');
    if (preg_match('/[\x00-\x20\x7F]/', $url)) return $gagal('URL webhook mengandung spasi atau karakter kontrol.');

    $b = parse_url($url);
    if (!is_array($b) || empty($b['host'])) return $gagal('URL webhook tidak dapat dibaca.');
    if (strtolower((string)($b['scheme'] ?? '')) !== 'https') return $gagal('URL webhook wajib diawali https://.');
    if (isset($b['user']) || isset($b['pass'])) return $gagal('URL webhook tidak boleh memuat nama pengguna/kata sandi.');
    if (isset($b['port']) && (int)$b['port'] !== 443) return $gagal('URL webhook tidak boleh memakai port khusus.');
    if (isset($b['fragment'])) return $gagal('URL webhook tidak boleh memuat bagian #.');

    $host  = strtolower((string)$b['host']);
    $path  = (string)($b['path'] ?? '');
    $query = (string)($b['query'] ?? '');

    if ($jenis === 'discord') {
        if (!in_array($host, ['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com'], true)) {
            return $gagal('URL Discord harus menuju discord.com (Pengaturan Kanal → Integrasi → Webhook → Salin URL).');
        }
        if (!preg_match('#^/api(?:/v\d{1,2})?/webhooks/(\d{5,25})/([A-Za-z0-9_\-]{30,100})/?$#', $path, $m)) {
            return $gagal('Bentuk URL webhook Discord tidak wajar. Contoh: https://discord.com/api/webhooks/123…/AbC…');
        }
        if ($query !== '' && !preg_match('/^thread_id=\d{5,25}$/', $query)) {
            return $gagal('URL Discord hanya boleh memuat parameter thread_id.');
        }
        $bersih = 'https://' . $host . rtrim($path, '/') . ($query !== '' ? '?' . $query : '');
        return ['ok' => true, 'pesan' => 'ok', 'url' => $bersih, 'petunjuk' => $host . '/…/' . substr($m[2], -4)];
    }

    if ($jenis === 'slack') {
        if ($host !== 'hooks.slack.com') {
            return $gagal('URL Slack harus menuju hooks.slack.com (Incoming Webhooks → Add New Webhook → Copy).');
        }
        if (!preg_match('#^/services/(T[A-Z0-9]{4,20})/(B[A-Z0-9]{4,20})/([A-Za-z0-9]{16,64})/?$#', $path, $m)) {
            return $gagal('Bentuk URL incoming webhook Slack tidak wajar. Contoh: https://hooks.slack.com/services/T…/B…/xxxx');
        }
        if ($query !== '') return $gagal('URL Slack tidak boleh memuat parameter tambahan.');
        return ['ok' => true, 'pesan' => 'ok', 'url' => 'https://hooks.slack.com' . rtrim($path, '/'), 'petunjuk' => 'hooks.slack.com/…/' . substr($m[3], -4)];
    }

    return $gagal('Jenis webhook tidak dikenal.');
}

/** Validasi chat id Telegram (sama dengan api/telegram-setelan.php). */
function qi_notif_chat_id_sah(string $chat): bool
{
    return (bool)(preg_match('/^-?\d{5,}$/', $chat) || preg_match('/^@[A-Za-z0-9_]{4,}$/', $chat));
}

// ─────────────────────────────────────────────────────────────────────────────
// ENKRIPSI URL WEBHOOK (AES-256-GCM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kunci enkripsi 32 byte. Urutan: konstanta QI_NOTIFY_KEY (config/api_keys.php), lalu berkas
 * cache/notify_secret.json yang dibuat otomatis sekali (folder cache/ diblokir .htaccess dan
 * berkas *.json di cache tidak ikut git). Kehilangan kunci = URL tersimpan harus diisi ulang.
 */
function qi_notif_kunci(): ?string
{
    static $kunci = null;
    if ($kunci !== null) return $kunci;

    $berkasKonfig = __DIR__ . '/../config/api_keys.php';
    if (!defined('QI_NOTIFY_KEY') && is_file($berkasKonfig)) require_once $berkasKonfig;
    if (defined('QI_NOTIFY_KEY') && strlen((string)QI_NOTIFY_KEY) >= 32) {
        return $kunci = hash('sha256', (string)QI_NOTIFY_KEY, true);
    }

    $berkas = __DIR__ . '/../cache/notify_secret.json';
    if (!is_file($berkas)) {
        $baru = json_encode(['key' => base64_encode(random_bytes(32)), 'dibuat' => date('c')]);
        $fp = @fopen($berkas, 'x');            // 'x' = hanya satu proses yang berhasil membuat
        if ($fp) { fwrite($fp, $baru); fclose($fp); @chmod($berkas, 0600); }
    }
    $j = json_decode((string)@file_get_contents($berkas), true);
    $mentah = is_array($j) ? base64_decode((string)($j['key'] ?? ''), true) : false;
    if (!is_string($mentah) || strlen($mentah) !== 32) return null;
    return $kunci = $mentah;
}

/** Enkripsi; $ikatan (mis. "discord:12") diikat sebagai AAD supaya sandi tidak bisa ditukar antar baris. */
function qi_notif_enkripsi(string $teks, string $ikatan): ?string
{
    $k = qi_notif_kunci();
    if ($k === null || !function_exists('openssl_encrypt')) return null;
    $iv = random_bytes(12);
    $tag = '';
    $sandi = openssl_encrypt($teks, 'aes-256-gcm', $k, OPENSSL_RAW_DATA, $iv, $tag, $ikatan, 16);
    return $sandi === false ? null : 'v1:' . base64_encode($iv . $tag . $sandi);
}

function qi_notif_dekripsi(?string $enc, string $ikatan): ?string
{
    if (!is_string($enc) || strncmp($enc, 'v1:', 3) !== 0) return null;
    $k = qi_notif_kunci();
    $b = base64_decode(substr($enc, 3), true);
    if ($k === null || $b === false || strlen($b) < 29) return null;
    $teks = openssl_decrypt(substr($b, 28), 'aes-256-gcm', $k, OPENSSL_RAW_DATA, substr($b, 0, 12), substr($b, 12, 16), $ikatan);
    return $teks === false ? null : $teks;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLAT PESAN (fungsi murni — bisa diuji tanpa jaringan)
// ─────────────────────────────────────────────────────────────────────────────

/** Ringkas satu rekor sinyal menjadi bidang tampilan yang seragam untuk semua kanal. */
function qi_notif_ringkas(array $rek): array
{
    $angka = static function ($v): string {
        if ($v === null || $v === '' || !is_numeric($v)) return '—';
        $f = (float)$v;
        if (abs($f) >= 1000) return number_format($f, 2, '.', '');
        if (abs($f) >= 10)   return number_format($f, 3, '.', '');   // JPY pair, perak
        return number_format($f, 5, '.', '');                       // pair forex mayor
    };
    $rr = $rek['rr'] ?? null;
    if (is_string($rr) && preg_match('/:\s*([0-9]+(?:\.[0-9]+)?)/', $rr, $m)) $rr = $m[1];   // "1 : 2.50"
    $arah = strtoupper(trim((string)($rek['side'] ?? '')));
    $epoch = function_exists('qi_sig_epoch') ? (qi_sig_epoch($rek['timestamp'] ?? null) ?? time())
                                             : (strtotime((string)($rek['timestamp'] ?? '')) ?: time());

    return [
        'id'      => (string)($rek['id'] ?? ''),
        'simbol'  => strtoupper(trim((string)($rek['symbol'] ?? '?'))),
        'arah'    => $arah !== '' ? $arah : '?',
        'beli'    => $arah === 'BUY',
        'mesin'   => trim((string)($rek['engine_name'] ?? $rek['engine'] ?? '')),
        'tf'      => strtoupper(trim((string)($rek['timeframe'] ?? ''))),
        'grade'   => strtoupper(trim((string)($rek['grade'] ?? ''))),
        'entry'   => $angka($rek['entry'] ?? null),
        'sl'      => $angka($rek['sl'] ?? null),
        'tp'      => $angka($rek['tp'] ?? null),
        'rr'      => is_numeric($rr) ? number_format((float)$rr, 2, '.', '') : '',
        'waktu'   => function_exists('qi_sig_waktu_tampil') ? qi_sig_waktu_tampil($epoch)   // mis. "2026-10-16 14:30 WIB (07:30 UTC)"
                                                            : (string)($rek['timestamp'] ?? date('Y-m-d H:i:s')),
        'epoch'   => $epoch,
        'uji'     => !empty($rek['_uji']),
    ];
}

define('QI_NOTIF_PERINGATAN', 'Ini bukan jaminan menang. Selalu kelola risiko dan ukuran posisi Anda.');

/** "Kenapa sinyal ini?" — ringkasan alasan dari rekor (kosong bila rekor tidak menyimpannya). */
function qi_notif_alasan(array $rek, int $maks = 4): array
{
    if (!function_exists('qi_sinyal_alasan_baris') && is_file(__DIR__ . '/_sinyal_alasan.php')) require_once __DIR__ . '/_sinyal_alasan.php';
    return function_exists('qi_sinyal_alasan_baris') ? qi_sinyal_alasan_baris($rek, $maks) : [];
}

function qi_notif_judul(array $r): string
{
    return ($r['uji'] ? '[UJI] ' : '') . ($r['beli'] ? '🟢' : ($r['arah'] === 'SELL' ? '🔴' : '⚪'))
        . ' SINYAL BARU — ' . $r['simbol'] . ' ' . $r['arah'];
}

/** Payload webhook Discord (embed). Mention dimatikan supaya teks sinyal tidak bisa mem-ping @everyone. */
function qi_notif_payload_discord(array $rek): array
{
    $r = qi_notif_ringkas($rek);
    $bidang = [
        ['name' => 'Entry', 'value' => '`' . $r['entry'] . '`', 'inline' => true],
        ['name' => 'Stop Loss', 'value' => '`' . $r['sl'] . '`', 'inline' => true],
        ['name' => 'Take Profit', 'value' => '`' . $r['tp'] . '`', 'inline' => true],
    ];
    if ($r['rr'] !== '')    $bidang[] = ['name' => 'R:R', 'value' => '1 : ' . $r['rr'], 'inline' => true];
    if ($r['grade'] !== '') $bidang[] = ['name' => 'Grade', 'value' => $r['grade'], 'inline' => true];
    if ($r['tf'] !== '')    $bidang[] = ['name' => 'Timeframe', 'value' => $r['tf'], 'inline' => true];
    $alasan = qi_notif_alasan($rek);
    if ($alasan) $bidang[] = ['name' => 'Kenapa sinyal ini?', 'value' => mb_substr('• ' . implode("\n• ", $alasan), 0, 1000), 'inline' => false];

    $embed = [
        'title'  => mb_substr(qi_notif_judul($r), 0, 250),
        'color'  => $r['beli'] ? 0x22C55E : ($r['arah'] === 'SELL' ? 0xEF4444 : 0x94A3B8),
        'fields' => $bidang,
        'footer' => ['text' => QI_NOTIF_PERINGATAN],
    ];
    if ($r['mesin'] !== '') $embed['description'] = 'Dari ' . mb_substr($r['mesin'], 0, 100);
    $embed['timestamp'] = gmdate('c', $r['epoch']);

    return ['username' => 'Quantum Institut', 'embeds' => [$embed], 'allowed_mentions' => ['parse' => []]];
}

/** Escape mrkdwn Slack (& < > wajib di-escape). */
function qi_notif_slack_esc(string $s): string
{
    return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $s);
}

/** Payload incoming webhook Slack (Block Kit + teks cadangan untuk notifikasi ponsel). */
function qi_notif_payload_slack(array $rek): array
{
    $r = qi_notif_ringkas($rek);
    $e = 'qi_notif_slack_esc';
    $bidang = [
        ['type' => 'mrkdwn', 'text' => "*Entry*\n`" . $e($r['entry']) . '`'],
        ['type' => 'mrkdwn', 'text' => "*Stop Loss*\n`" . $e($r['sl']) . '`'],
        ['type' => 'mrkdwn', 'text' => "*Take Profit*\n`" . $e($r['tp']) . '`'],
    ];
    if ($r['rr'] !== '')    $bidang[] = ['type' => 'mrkdwn', 'text' => "*R:R*\n1 : " . $e($r['rr'])];
    if ($r['grade'] !== '') $bidang[] = ['type' => 'mrkdwn', 'text' => "*Grade*\n" . $e($r['grade'])];
    if ($r['tf'] !== '')    $bidang[] = ['type' => 'mrkdwn', 'text' => "*Timeframe*\n" . $e($r['tf'])];

    $konteks = ($r['mesin'] !== '' ? 'Dari ' . $e($r['mesin']) . ' · ' : '') . '_' . $e(QI_NOTIF_PERINGATAN) . '_';
    $blok = [
        ['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => mb_substr(qi_notif_judul($r), 0, 150), 'emoji' => true]],
        ['type' => 'section', 'fields' => $bidang],
    ];
    $alasan = qi_notif_alasan($rek);
    if ($alasan) $blok[] = ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => mb_substr("*Kenapa sinyal ini?*\n• " . implode("\n• ", array_map($e, $alasan)), 0, 2900)]];
    $blok[] = ['type' => 'context', 'elements' => [['type' => 'mrkdwn', 'text' => $konteks]]];
    return [
        'text'   => qi_notif_judul($r) . ' @ ' . $r['entry'] . ' (SL ' . $r['sl'] . ', TP ' . $r['tp'] . ')',
        'blocks' => $blok,
    ];
}

/** Templat email sinyal. @return array{subjek:string,html:string,teks:string} */
function qi_notif_email_sinyal(array $rek): array
{
    if (!function_exists('qi_mail_kerangka')) require_once __DIR__ . '/_mailer.php';
    $r = qi_notif_ringkas($rek);
    $e = static fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $warna = $r['beli'] ? '#22C55E' : ($r['arah'] === 'SELL' ? '#EF4444' : '#94A3B8');

    $baris = [['Entry', $r['entry']], ['Stop Loss', $r['sl']], ['Take Profit', $r['tp']]];
    if ($r['rr'] !== '')    $baris[] = ['R:R', '1 : ' . $r['rr']];
    if ($r['grade'] !== '') $baris[] = ['Grade', $r['grade']];
    if ($r['tf'] !== '')    $baris[] = ['Timeframe', $r['tf']];
    if ($r['mesin'] !== '') $baris[] = ['Mesin', $r['mesin']];
    $baris[] = ['Waktu', $r['waktu']];

    $tabel = '';
    foreach ($baris as [$k, $v]) {
        $tabel .= '<tr><td style="padding:6px 0;color:#94A3B8;width:40%;">' . $e($k) . '</td>'
            . '<td style="padding:6px 0;color:#FFFFFF;font-family:Consolas,monospace;">' . $e($v) . '</td></tr>';
    }
    $html = '<p style="margin:0 0 14px;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:' . $warna
        . ';color:#04121F;font-weight:700;font-size:12px;">' . $e($r['arah']) . '</span> <strong style="color:#FFFFFF;font-size:16px;">'
        . $e($r['simbol']) . '</strong></p>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;">' . $tabel . '</table>';
    $alasan = qi_notif_alasan($rek, 6);
    if ($alasan) {
        $html .= '<p style="margin:16px 0 6px;color:#FFFFFF;font-weight:700;font-size:13px;">Kenapa sinyal ini?</p><ul style="margin:0;padding-left:18px;color:#CBD5E1;font-size:12px;line-height:1.6;">'
            . implode('', array_map(static fn($x) => '<li>' . htmlspecialchars($x, ENT_QUOTES, 'UTF-8') . '</li>', $alasan)) . '</ul>';
    }
    $html .= '<p style="margin:16px 0 0;color:#FBBF24;font-size:12px;">' . $e(QI_NOTIF_PERINGATAN) . '</p>';

    $teks = qi_notif_judul($r) . "\n";
    foreach ($baris as [$k, $v]) $teks .= $k . ': ' . $v . "\n";
    if ($alasan) $teks .= "\nKenapa sinyal ini?\n- " . implode("\n- ", $alasan) . "\n";
    $teks .= "\n" . QI_NOTIF_PERINGATAN . "\nUbah pengaturan notifikasi di Dashboard → Akun → Notifikasi Sinyal.";

    return [
        'subjek' => ($r['uji'] ? '[UJI] ' : '') . 'Sinyal ' . $r['arah'] . ' ' . $r['simbol'] . ' @ ' . $r['entry'],
        'html'   => qi_mail_kerangka(qi_notif_judul($r), $html,
            'Anda menerima email ini karena mengaktifkan notifikasi email di Dashboard → Akun → Notifikasi Sinyal. ' . QI_NOTIF_PERINGATAN),
        'teks'   => $teks,
    ];
}

/** Teks Telegram: memakai penyusun yang sama dengan kanal admin bila tersedia. */
function qi_notif_teks_telegram(array $rek): string
{
    if (!function_exists('qi_telegram_pesan_sinyal') && is_file(__DIR__ . '/_telegram.php')) require_once __DIR__ . '/_telegram.php';
    $teks = function_exists('qi_telegram_pesan_sinyal')
        ? qi_telegram_pesan_sinyal($rek)
        : strip_tags(qi_notif_judul(qi_notif_ringkas($rek))) . "\n" . QI_NOTIF_PERINGATAN;
    $alasan = qi_notif_alasan($rek);
    if ($alasan) $teks .= "\n\n<b>Kenapa sinyal ini?</b>\n• " . implode("\n• ", array_map(static fn($x) => htmlspecialchars($x, ENT_QUOTES, 'UTF-8'), $alasan));
    return !empty($rek['_uji']) ? "<b>[UJI]</b> Pesan uji — bukan sinyal sungguhan.\n" . $teks : $teks;
}

/** Token bot Telegram server (bot yang sama dengan kanal admin). '' bila belum diatur. */
function qi_notif_token_telegram(): string
{
    if (!function_exists('qi_telegram_setelan') && is_file(__DIR__ . '/_telegram.php')) require_once __DIR__ . '/_telegram.php';
    if (function_exists('qi_telegram_setelan')) return (string)qi_telegram_setelan()['token'];
    $kunci = __DIR__ . '/../config/api_keys.php';
    if (!defined('TELEGRAM_BOT_TOKEN') && is_file($kunci)) require_once $kunci;
    return defined('TELEGRAM_BOT_TOKEN') ? trim((string)TELEGRAM_BOT_TOKEN) : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// PENGIRIMAN HTTP PARALEL
// ─────────────────────────────────────────────────────────────────────────────

/** Tafsirkan jawaban kanal apa adanya (fungsi murni). @return array{ok:bool,pesan:string} */
function qi_notif_tafsir(string $kanal, int $kode, string $badan, string $galat = ''): array
{
    if ($kode === 0) return ['ok' => false, 'pesan' => 'Tidak dapat terhubung' . ($galat !== '' ? ': ' . mb_substr($galat, 0, 120) : '.')];
    $j = json_decode($badan, true);
    if ($kanal === 'telegram') {
        if (is_array($j) && !empty($j['ok'])) return ['ok' => true, 'pesan' => 'Terkirim ke Telegram.'];
        return ['ok' => false, 'pesan' => 'Telegram menolak: ' . mb_substr((string)(is_array($j) ? ($j['description'] ?? '') : ''), 0, 140) . " (HTTP $kode)"];
    }
    if ($kanal === 'discord') {
        if ($kode >= 200 && $kode < 300) return ['ok' => true, 'pesan' => 'Terkirim ke Discord.'];
        $ket = is_array($j) ? (string)($j['message'] ?? '') : '';
        return ['ok' => false, 'pesan' => 'Discord menolak: ' . ($ket !== '' ? mb_substr($ket, 0, 140) : 'tanpa keterangan') . " (HTTP $kode)"];
    }
    if ($kanal === 'slack') {
        if ($kode === 200 && trim($badan) === 'ok') return ['ok' => true, 'pesan' => 'Terkirim ke Slack.'];
        return ['ok' => false, 'pesan' => 'Slack menolak: ' . (trim($badan) !== '' ? mb_substr(trim($badan), 0, 140) : 'tanpa keterangan') . " (HTTP $kode)"];
    }
    return ['ok' => false, 'pesan' => 'Kanal tidak dikenal.'];
}

/**
 * Kirim banyak POST JSON sekaligus (curl_multi). Hanya HTTPS, tanpa redirect, TLS diverifikasi.
 * @param array<string,array{kanal:string,url:string,badan:array}> $tugas
 * @return array<string,array{ok:bool,pesan:string,kode:int}>
 */
function qi_notif_http_paralel(array $tugas): array
{
    $hasil = [];
    if (!$tugas) return $hasil;
    if (!function_exists('curl_multi_init')) {
        foreach ($tugas as $k => $t) $hasil[$k] = ['ok' => false, 'pesan' => 'cURL tidak tersedia di server.', 'kode' => 0];
        return $hasil;
    }
    foreach (array_chunk($tugas, 20, true) as $potong) {
        $mh = curl_multi_init();
        $pegangan = [];
        foreach ($potong as $k => $t) {
            $ch = curl_init($t['url']);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => json_encode($t['badan'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json; charset=utf-8'],
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
                CURLOPT_USERAGENT      => 'QuantumInstitut-Notifier/1.0',
            ]);
            curl_multi_add_handle($mh, $ch);
            $pegangan[$k] = $ch;
        }
        do {
            $status = curl_multi_exec($mh, $aktif);
            if ($aktif) curl_multi_select($mh, 1.0);
        } while ($aktif && $status === CURLM_OK);

        foreach ($pegangan as $k => $ch) {
            $t = $potong[$k];
            $tafsir = qi_notif_tafsir($t['kanal'], (int)curl_getinfo($ch, CURLINFO_HTTP_CODE), (string)curl_multi_getcontent($ch), (string)curl_error($ch));
            $hasil[$k] = $tafsir + ['kode' => (int)curl_getinfo($ch, CURLINFO_HTTP_CODE)];
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);
    }
    return $hasil;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEBARAN SINYAL
// ─────────────────────────────────────────────────────────────────────────────

function qi_notif_pdo(): ?PDO
{
    try {
        if (function_exists('qi_db')) return qi_db(false);
        $cfg = __DIR__ . '/../config/database.php';
        if (!is_file($cfg)) return null;
        require_once $cfg;
        return function_exists('getDBConnection') ? getDBConnection() : null;
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Sebarkan satu sinyal ke semua kanal yang diaktifkan pengguna.
 *
 * @param int|null $hanyaUser  batasi ke satu pengguna (dipakai tombol "Kirim Uji")
 * @param bool     $uji        tandai pesan sebagai UJI dan pakai id unik (tidak memakan klaim sinyal asli)
 * @return array{ok:bool,catatan:string,pengguna:int,ringkas:array,per_kanal:array}
 */
function qi_notif_sebar_sinyal(array $rek, ?int $hanyaUser = null, bool $uji = false): array
{
    $keluar = ['ok' => false, 'catatan' => '', 'pengguna' => 0, 'ringkas' => [], 'per_kanal' => []];
    try {
        $pdo = qi_notif_pdo();
        if (!$pdo) { $keluar['catatan'] = 'Database tidak tersedia — notifikasi per pengguna dilewati.'; return $keluar; }

        if ($uji) {
            $rek['_uji'] = true;
            $rek['id'] = 'UJI-' . date('YmdHis') . '-' . bin2hex(random_bytes(3));
        }
        $idSinyal = mb_substr((string)($rek['id'] ?? ''), 0, 80);
        if ($idSinyal === '') {
            $idSinyal = 'SIG-' . substr(sha1(json_encode([$rek['symbol'] ?? '', $rek['side'] ?? '', $rek['entry'] ?? '', $rek['timestamp'] ?? ''])), 0, 16);
        }

        // Web Push (kanal "Desktop", tab boleh tertutup) — tidak bergantung pada kanal server lain.
        $keluar['push'] = qi_notif_push_sinyal($pdo, $rek, $idSinyal, $hanyaUser, $uji);

        $sql = 'SELECT s.*, u.email FROM user_notification_settings s JOIN users u ON u.id = s.user_id
                WHERE u.is_active = 1 AND (u.status IS NULL OR u.status = \'active\')
                  AND (s.telegram_enabled = 1 OR s.discord_enabled = 1 OR s.slack_enabled = 1 OR s.email_enabled = 1)'
             . ($hanyaUser !== null ? ' AND u.id = ?' : '') . ' ORDER BY u.id LIMIT 500';
        try {
            $st = $pdo->prepare($sql);
            $st->execute($hanyaUser !== null ? [$hanyaUser] : []);
            $baris = $st->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            $keluar['catatan'] = ($e->getCode() === '42S02')
                ? 'Tabel notifikasi belum ada — jalankan database/migrations/016_user_notification_settings.sql.'
                : 'Gagal membaca pengaturan notifikasi: ' . $e->getMessage();
            return $keluar;
        }
        $keluar['pengguna'] = count($baris);
        if (!$baris) { $keluar['ok'] = true; $keluar['catatan'] = 'Tidak ada pengguna dengan kanal aktif.'; return $keluar; }

        $klaim = $pdo->prepare('INSERT IGNORE INTO notification_deliveries (signal_id, user_id, channel) VALUES (?, ?, ?)');
        $catat = $pdo->prepare('UPDATE notification_deliveries SET ok = ?, http_code = ?, note = ? WHERE signal_id = ? AND user_id = ? AND channel = ?');
        $hasilAkhir = [];   // "uid|kanal" => [ok,pesan,kode]
        $selesai = static function (int $uid, string $kanal, array $h) use ($catat, $idSinyal, &$hasilAkhir) {
            $hasilAkhir[$uid . '|' . $kanal] = $h;
            try { $catat->execute([$h['ok'] ? 1 : 0, $h['kode'] ?? null, mb_substr((string)$h['pesan'], 0, 255), $idSinyal, $uid, $kanal]); } catch (Throwable $e) {}
        };

        $tokenTg = qi_notif_token_telegram();
        $chatAdmin = '';
        if (!$uji && function_exists('qi_telegram_setelan')) $chatAdmin = (string)qi_telegram_setelan()['chat_id'];

        $muatan = [];   // dihitung sekali per sinyal, bukan per pengguna
        $tugas = [];
        $surel = [];    // email => uid

        foreach ($baris as $b) {
            $uid = (int)$b['user_id'];
            foreach (QI_NOTIF_KANAL as $kanal) {
                if (empty($b[$kanal . '_enabled'])) continue;
                $klaim->execute([$idSinyal, $uid, $kanal]);
                if ($klaim->rowCount() === 0) continue;          // sudah pernah dikirim untuk sinyal ini

                if ($kanal === 'telegram') {
                    $chat = trim((string)$b['telegram_chat_id']);
                    if ($tokenTg === '') { $selesai($uid, $kanal, ['ok' => false, 'pesan' => 'Bot Telegram server belum diatur admin.', 'kode' => 0]); continue; }
                    if (!qi_notif_chat_id_sah($chat)) { $selesai($uid, $kanal, ['ok' => false, 'pesan' => 'Chat id Telegram belum diisi.', 'kode' => 0]); continue; }
                    if ($chatAdmin !== '' && $chat === $chatAdmin) {
                        $selesai($uid, $kanal, ['ok' => true, 'pesan' => 'Sudah terkirim lewat kanal Telegram admin (chat yang sama).', 'kode' => 200]);
                        continue;
                    }
                    $muatan['telegram'] ??= qi_notif_teks_telegram($rek);
                    $tugas[$uid . '|telegram'] = ['kanal' => 'telegram', 'url' => 'https://api.telegram.org/bot' . rawurlencode($tokenTg) . '/sendMessage',
                        'badan' => ['chat_id' => $chat, 'text' => mb_substr($muatan['telegram'], 0, 4000), 'parse_mode' => 'HTML', 'disable_web_page_preview' => true]];
                } elseif ($kanal === 'discord' || $kanal === 'slack') {
                    $url = qi_notif_dekripsi($b[$kanal . '_webhook_enc'] ?? null, $kanal . ':' . $uid);
                    $v = $url !== null ? qi_notif_validasi_webhook($kanal, $url) : ['ok' => false];
                    if (!$v['ok']) { $selesai($uid, $kanal, ['ok' => false, 'pesan' => 'URL webhook tersimpan tidak dapat dibuka — simpan ulang URL-nya.', 'kode' => 0]); continue; }
                    $muatan[$kanal] ??= ($kanal === 'discord' ? qi_notif_payload_discord($rek) : qi_notif_payload_slack($rek));
                    $tugas[$uid . '|' . $kanal] = ['kanal' => $kanal, 'url' => $v['url'], 'badan' => $muatan[$kanal]];
                } elseif ($kanal === 'email') {
                    $surel[strtolower((string)$b['email'])] = $uid;
                }
            }
        }

        foreach (qi_notif_http_paralel($tugas) as $k => $h) {
            [$uid, $kanal] = explode('|', $k, 2);
            $selesai((int)$uid, $kanal, $h);
        }

        if ($surel) {
            if (!function_exists('qi_mail_kirim')) require_once __DIR__ . '/_mailer.php';
            $tpl = qi_notif_email_sinyal($rek);
            // Batas per sinyal supaya satu permintaan tidak tertahan lama oleh SMTP.
            $kirimSurel = array_slice($surel, 0, 100, true);
            $hm = qi_mail_kirim(array_keys($kirimSurel), $tpl['subjek'], $tpl['html'], $tpl['teks']);
            foreach ($surel as $alamat => $uid) {
                $h = $hm['per_penerima'][$alamat] ?? ['ok' => false, 'pesan' => 'Melebihi batas 100 email per sinyal.'];
                $selesai($uid, 'email', ['ok' => $h['ok'], 'pesan' => $h['pesan'], 'kode' => $h['ok'] ? 250 : 0]);
            }
        }

        $ringkas = [];
        foreach ($hasilAkhir as $k => $h) {
            [, $kanal] = explode('|', $k, 2);
            $ringkas[$kanal] ??= ['dikirim' => 0, 'berhasil' => 0];
            $ringkas[$kanal]['dikirim']++;
            if ($h['ok']) $ringkas[$kanal]['berhasil']++;
        }
        $keluar['ringkas'] = $ringkas;
        if ($hanyaUser !== null) {
            foreach ($hasilAkhir as $k => $h) $keluar['per_kanal'][explode('|', $k, 2)[1]] = $h;
        }
        $keluar['ok'] = true;
        $keluar['catatan'] = count($hasilAkhir) . ' kiriman diproses untuk ' . count($baris) . ' pengguna.';
        return $keluar;
    } catch (Throwable $e) {
        @error_log('[notif] sebaran gagal: ' . $e->getMessage());
        $keluar['catatan'] = 'Sebaran notifikasi gagal: ' . $e->getMessage();
        return $keluar;
    }
}

/**
 * Web Push untuk satu sinyal ke semua perangkat terdaftar (pengguna dengan Desktop aktif).
 * Sinyal nyata diklaim sekali lewat berkas penanda supaya tidak dikirim ulang.
 * @return array{perangkat:int,terkirim:int}|null
 */
function qi_notif_push_sinyal(PDO $pdo, array $rek, string $idSinyal, ?int $hanyaUser, bool $uji): ?array
{
    try {
        if (!function_exists('qi_push_kirim')) { if (!is_file(__DIR__ . '/_push.php')) return null; require_once __DIR__ . '/_push.php'; }
        if (!$uji) {
            $dir = __DIR__ . '/../cache/push_sent';
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
            $fp = @fopen($dir . '/' . sha1($idSinyal), 'x');
            if (!$fp) return ['perangkat' => 0, 'terkirim' => 0];   // sudah pernah dikirim
            fclose($fp);
        }
        $langganan = qi_push_langganan($pdo, $hanyaUser !== null ? [$hanyaUser] : null);
        if (!$langganan) return ['perangkat' => 0, 'terkirim' => 0];
        $r = qi_notif_ringkas($rek);
        $hasil = qi_push_kirim($pdo, $langganan, [
            'title' => strip_tags(qi_notif_judul($r)) . ($r['grade'] !== '' ? ' · Grade ' . $r['grade'] : ''),
            'body'  => 'Entry ' . $r['entry'] . ' · SL ' . $r['sl'] . ' · TP ' . $r['tp'] . ($r['rr'] !== '' ? ' · R:R 1:' . $r['rr'] : '') . "\n" . QI_NOTIF_PERINGATAN,
            'tag'   => $r['id'] !== '' ? $r['id'] : $idSinyal,
            'url'   => 'dashboard.html',
        ]);
        return ['perangkat' => count($langganan), 'terkirim' => count(array_filter($hasil, static fn($h) => $h['ok']))];
    } catch (Throwable $e) {
        @error_log('[push] gagal: ' . $e->getMessage());
        return null;
    }
}

/**
 * Kirim pesan umum (mis. price alert) ke semua kanal aktif SATU pengguna.
 * $kunci menjadi signal_id di notification_deliveries → tidak pernah terkirim dua kali.
 * @param string[] $baris
 * @return array<string,array{ok:bool,pesan:string,kode:int}>
 */
function qi_notif_kirim_pesan(int $uid, string $kunci, string $judul, array $baris): array
{
    $pdo = qi_notif_pdo();
    if (!$pdo) return [];
    $hasil = [];
    // Web Push ke perangkat pengguna (kanal Desktop; berlaku walau kanal server lain mati).
    try {
        if (!function_exists('qi_push_kirim') && is_file(__DIR__ . '/_push.php')) require_once __DIR__ . '/_push.php';
        if (function_exists('qi_push_kirim')) {
            $lg = qi_push_langganan($pdo, [$uid]);
            if ($lg) {
                $hp = qi_push_kirim($pdo, $lg, ['title' => $judul, 'body' => implode("\n", array_slice($baris, 0, 2)), 'tag' => $kunci, 'url' => 'dashboard.html']);
                $hasil['push'] = ['ok' => (bool)array_filter($hp, static fn($h) => $h['ok']), 'pesan' => count($hp) . ' perangkat', 'kode' => 0];
            }
        }
    } catch (Throwable $e) { @error_log('[push] pesan gagal: ' . $e->getMessage()); }
    try {
        $st = $pdo->prepare('SELECT s.*, u.email FROM user_notification_settings s JOIN users u ON u.id = s.user_id WHERE s.user_id = ? AND u.is_active = 1');
        $st->execute([$uid]);
        $b = $st->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) { return $hasil; }
    if (!$b) return $hasil;

    $kunci = mb_substr($kunci, 0, 80);
    $klaim = $pdo->prepare('INSERT IGNORE INTO notification_deliveries (signal_id, user_id, channel) VALUES (?, ?, ?)');
    $catat = $pdo->prepare('UPDATE notification_deliveries SET ok = ?, http_code = ?, note = ? WHERE signal_id = ? AND user_id = ? AND channel = ?');
    $selesai = static function (string $kanal, array $h) use ($catat, $kunci, $uid, &$hasil) {
        $hasil[$kanal] = $h;
        try { $catat->execute([$h['ok'] ? 1 : 0, $h['kode'] ?? null, mb_substr((string)$h['pesan'], 0, 255), $kunci, $uid, $kanal]); } catch (Throwable $e) {}
    };
    $esc = static fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $tugas = [];
    foreach (QI_NOTIF_KANAL as $kanal) {
        if (empty($b[$kanal . '_enabled'])) continue;
        $klaim->execute([$kunci, $uid, $kanal]);
        if ($klaim->rowCount() === 0) continue;
        if ($kanal === 'telegram') {
            $token = qi_notif_token_telegram();
            $chat = trim((string)$b['telegram_chat_id']);
            if ($token === '' || !qi_notif_chat_id_sah($chat)) { $selesai($kanal, ['ok' => false, 'pesan' => 'Telegram belum siap (bot/chat id).', 'kode' => 0]); continue; }
            $tugas['telegram'] = ['kanal' => 'telegram', 'url' => 'https://api.telegram.org/bot' . rawurlencode($token) . '/sendMessage',
                'badan' => ['chat_id' => $chat, 'text' => '<b>' . $esc($judul) . '</b>' . "\n" . implode("\n", array_map($esc, $baris)), 'parse_mode' => 'HTML', 'disable_web_page_preview' => true]];
        } elseif ($kanal === 'discord' || $kanal === 'slack') {
            $url = qi_notif_dekripsi($b[$kanal . '_webhook_enc'] ?? null, $kanal . ':' . $uid);
            $v = $url !== null ? qi_notif_validasi_webhook($kanal, $url) : ['ok' => false];
            if (!$v['ok']) { $selesai($kanal, ['ok' => false, 'pesan' => 'URL webhook tersimpan tidak dapat dibuka.', 'kode' => 0]); continue; }
            $tugas[$kanal] = ['kanal' => $kanal, 'url' => $v['url'], 'badan' => $kanal === 'discord'
                ? ['username' => 'Quantum Institut', 'allowed_mentions' => ['parse' => []], 'embeds' => [['title' => mb_substr($judul, 0, 250), 'description' => mb_substr(implode("\n", $baris), 0, 3000), 'color' => 0x1677FF]]]
                : ['text' => $judul, 'blocks' => [['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => mb_substr($judul, 0, 150), 'emoji' => true]],
                    ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => mb_substr(implode("\n", array_map('qi_notif_slack_esc', $baris)), 0, 2900)]]]]];
        } elseif ($kanal === 'email') {
            if (!function_exists('qi_mail_kirim')) require_once __DIR__ . '/_mailer.php';
            $html = qi_mail_kerangka($judul, '<ul style="margin:0;padding-left:18px;color:#CBD5E1;line-height:1.7;">' . implode('', array_map(static fn($x) => '<li>' . $esc($x) . '</li>', $baris)) . '</ul>');
            $hm = qi_mail_kirim([(string)$b['email']], $judul, $html, $judul . "\n" . implode("\n", $baris));
            $h = $hm['per_penerima'][strtolower((string)$b['email'])] ?? ['ok' => false, 'pesan' => $hm['pesan']];
            $selesai('email', ['ok' => $h['ok'], 'pesan' => $h['pesan'], 'kode' => $h['ok'] ? 250 : 0]);
        }
    }
    foreach (qi_notif_http_paralel($tugas) as $kanal => $h) $selesai($kanal, $h);
    return $hasil;
}

/** Sinyal terbaru (ringkas) untuk notifikasi desktop — dibaca dari rekor berkas, tanpa evaluasi berat. */
function qi_notif_sinyal_terbaru(int $n = 5, ?string $berkas = null): array
{
    $berkas ??= __DIR__ . '/../cache/signal_history.json';
    $h = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
    if (!is_array($h)) return [];
    $keluar = [];
    foreach (array_slice($h, 0, max(1, min(20, $n))) as $rek) {
        if (!is_array($rek) || empty($rek['id'])) continue;
        $r = qi_notif_ringkas($rek);
        $keluar[] = array_intersect_key($r, array_flip(['id', 'simbol', 'arah', 'mesin', 'tf', 'grade', 'entry', 'sl', 'tp', 'rr', 'waktu']));
    }
    return $keluar;
}

endif;
