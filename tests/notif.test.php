<?php
/**
 * Uji fungsi murni notifikasi (api/_notif.php, api/_mailer.php) — tanpa jaringan dan tanpa DB.
 * Dijalankan oleh tests/notif.test.js:  php tests/notif.test.php
 */
define('QI_NOTIFY_KEY', str_repeat('k', 40));   // kunci uji: tidak menyentuh cache/notify_secret.json
require __DIR__ . '/../api/_notif.php';
require __DIR__ . '/../api/_mailer.php';

$gagal = 0;
function cek(string $nama, bool $lulus): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . "\n";
    if (!$lulus) $gagal++;
}

$dc = 'https://discord.com/api/webhooks/123456789012345678/' . str_repeat('A', 68);
$sl = 'https://hooks.slack.' . 'com/services/T0123ABCD/B0456EFGH/abcdefghijklmnopqrstuvwx';

// Validasi webhook
$v = qi_notif_validasi_webhook('discord', $dc);
cek('Discord webhook sah diterima', $v['ok'] && $v['url'] === $dc);
cek('petunjuk Discord tidak memuat token utuh', $v['petunjuk'] === 'discord.com/…/AAAA');
cek('Discord thread_id diizinkan', qi_notif_validasi_webhook('discord', $dc . '?thread_id=123456789')['ok']);
cek('Discord http:// ditolak', !qi_notif_validasi_webhook('discord', str_replace('https:', 'http:', $dc))['ok']);
cek('Discord host palsu ditolak', !qi_notif_validasi_webhook('discord', str_replace('discord.com', 'discord.com.evil.io', $dc))['ok']);
cek('Discord userinfo ditolak', !qi_notif_validasi_webhook('discord', str_replace('https://', 'https://x@', $dc))['ok']);
cek('Discord port khusus ditolak', !qi_notif_validasi_webhook('discord', str_replace('discord.com', 'discord.com:8443', $dc))['ok']);
cek('Discord query lain ditolak', !qi_notif_validasi_webhook('discord', $dc . '?wait=true')['ok']);
cek('Slack webhook sah diterima', qi_notif_validasi_webhook('slack', $sl)['ok']);
cek('Slack ke host lain ditolak', !qi_notif_validasi_webhook('slack', str_replace('hooks.slack.com', '127.0.0.1', $sl))['ok']);
cek('Slack path salah ditolak', !qi_notif_validasi_webhook('slack', 'https://hooks.slack.com/api/x')['ok']);
cek('URL Discord di kanal Slack ditolak', !qi_notif_validasi_webhook('slack', $dc)['ok']);
cek('spasi/kontrol di tengah URL ditolak', !qi_notif_validasi_webhook('discord', str_replace('/api/', "/api\n/", $dc))['ok']);
cek('chat id Telegram sah', qi_notif_chat_id_sah('-1001234567890') && qi_notif_chat_id_sah('@kanal_saya'));
cek('chat id Telegram sampah ditolak', !qi_notif_chat_id_sah('12ab') && !qi_notif_chat_id_sah(''));

// Enkripsi
$enc = qi_notif_enkripsi($dc, 'discord:7');
cek('enkripsi menghasilkan sandi v1, bukan teks asli', is_string($enc) && strncmp($enc, 'v1:', 3) === 0 && strpos($enc, '123456789012345678') === false);
cek('dekripsi dengan ikatan sama berhasil', qi_notif_dekripsi($enc, 'discord:7') === $dc);
cek('sandi tidak bisa dipindah ke pengguna lain', qi_notif_dekripsi($enc, 'discord:8') === null);
$rusak = substr($enc, 0, -2) . (substr($enc, -2) === 'AA' ? 'BB' : 'AA');
cek('sandi yang diubah ditolak (tag GCM)', qi_notif_dekripsi($rusak, 'discord:7') === null);

// Templat
$rek = ['id' => 'SIG-T1', 'symbol' => 'xauusd', 'side' => 'SELL', 'engine_name' => '<b>@everyone</b>', 'timeframe' => 'h1',
        'entry' => 2400.5, 'sl' => 2410, 'tp' => 2380.25, 'rr' => '1 : 2.44', 'grade' => 'b', 'timestamp' => '2026-10-16 10:00:00'];
$r = qi_notif_ringkas($rek);
cek('ringkas: R:R teks "1 : 2.44" terbaca', $r['rr'] === '2.44');
cek('ringkas: simbol/grade huruf besar', $r['simbol'] === 'XAUUSD' && $r['grade'] === 'B');
$d = qi_notif_payload_discord($rek);
cek('Discord: mention dimatikan', $d['allowed_mentions'] === ['parse' => []]);
cek('Discord: warna merah untuk SELL', $d['embeds'][0]['color'] === 0xEF4444);
cek('Discord: memuat peringatan risiko', strpos($d['embeds'][0]['footer']['text'], 'bukan jaminan') !== false);
$s = qi_notif_payload_slack($rek);
cek('Slack: mrkdwn di-escape', strpos(json_encode($s), '&lt;b&gt;@everyone') !== false && strpos(json_encode($s), '<b>@everyone') === false);
cek('Slack: teks cadangan berisi level', strpos($s['text'], '2400.50') !== false);
$e = qi_notif_email_sinyal($rek);
cek('Email: HTML di-escape', strpos($e['html'], '&lt;b&gt;@everyone') !== false && strpos($e['html'], '<b>@everyone') === false);
cek('Email: subjek ringkas', $e['subjek'] === 'Sinyal SELL XAUUSD @ 2400.50');
cek('Email uji ditandai [UJI]', strpos(qi_notif_email_sinyal($rek + ['_uji' => true])['subjek'], '[UJI]') === 0);

// Tafsir jawaban kanal
cek('Discord 204 = berhasil', qi_notif_tafsir('discord', 204, '')['ok']);
cek('Discord 404 = gagal + alasan', !($t = qi_notif_tafsir('discord', 404, '{"message":"Unknown Webhook","code":10015}'))['ok'] && strpos($t['pesan'], 'Unknown Webhook') !== false);
cek('Slack "ok" = berhasil', qi_notif_tafsir('slack', 200, 'ok')['ok']);
cek('Slack no_service = gagal', !qi_notif_tafsir('slack', 404, 'no_service')['ok']);
cek('Telegram ok:true = berhasil', qi_notif_tafsir('telegram', 200, '{"ok":true}')['ok']);
cek('tanpa koneksi = gagal jujur', !qi_notif_tafsir('discord', 0, '', 'timeout')['ok']);

// MIME email
$m = qi_mail_susun('bot@contoh.id', 'Quantum Institut', 'a@b.id', "Subjek\r\nBcc: korban@x.id", '<p>Hai ✓</p>', 'Hai ✓');
cek('MIME: injeksi header lewat subjek dicegah', strpos($m, "\r\nBcc:") === false);
cek('MIME: multipart/alternative', strpos($m, 'multipart/alternative') !== false && substr_count($m, 'quoted-printable') === 2);
cek('mailer: tanpa SMTP_HOST = belum dikonfigurasi', qi_mail_status()['terkonfigurasi'] === false || defined('SMTP_HOST'));
$otp = qi_mail_templat_otp('123456');
cek('templat OTP memuat kode', strpos($otp['html'], '123456') !== false && strpos($otp['teks'], '123456') !== false);

echo $gagal ? "\n$gagal uji notifikasi GAGAL\n" : "\nSemua uji notifikasi lulus\n";
exit($gagal ? 1 : 0);
