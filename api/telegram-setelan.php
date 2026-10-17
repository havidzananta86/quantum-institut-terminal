<?php
/**
 * PENGATURAN NOTIFIKASI TELEGRAM (khusus admin).
 *
 * GET  → status jujur: apakah aktif, apa yang masih kurang, dari mana dibaca.
 * POST → {aksi:'simpan'|'uji'|'hapus', token?, chat_id?}
 *        'simpan' menyimpan ke cache/telegram.json (tanpa perlu edit berkas konfigurasi)
 *        'uji'    menyimpan lalu mengirim satu pesan uji (jawaban apa adanya)
 *        'hapus'  menghapus pengaturan (kembali ke konstanta server bila ada)
 *
 * Kejujuran & keamanan:
 *   · Token bot bersifat rahasia → endpoint ini WAJIB admin, berkas disimpan 0600,
 *     dan token TIDAK PERNAH dikembalikan utuh (hanya 4 karakter terakhir).
 *   · Bentuk token & chat id divalidasi supaya tidak menyimpan sampah yang membuat
 *     pengiriman gagal tanpa penjelasan.
 *   · Jawaban Telegram diteruskan apa adanya — tidak pernah dilaporkan "berhasil"
 *     kalau Telegram menolak.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_telegram.php';

qi_rate_limit(30, 60);
qi_require_admin();

$berkas = __DIR__ . '/../cache/telegram.json';

/** Status untuk UI: tanpa membocorkan token. */
function qi_tg_jawaban_status(): array
{
    $s = qi_telegram_status();
    $t = qi_telegram_setelan();
    $ekor = $t['token'] !== '' ? substr($t['token'], -4) : '';
    return [
        'status'           => 'success',
        'terkonfigurasi'   => $s['terkonfigurasi'],
        'sumber'           => $s['sumber'],
        'ada_token'        => $s['ada_token'],
        'ada_chat_id'      => $s['ada_chat_id'],
        'token_ekor'       => $ekor,
        'chat_id_tersimpan' => $t['chat_id'],
        'kurang'           => $s['kurang'],
        'catatan'          => $s['catatan'],
    ];
}

$metode = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($metode === 'GET') {
    echo json_encode(qi_tg_jawaban_status(), JSON_PRETTY_PRINT);
    exit;
}

if ($metode !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Metode tidak diizinkan.']);
    exit;
}

$input = function_exists('qi_get_json_body') ? qi_get_json_body() : [];
if (!is_array($input)) $input = [];
$aksi = strtolower(trim((string)($input['aksi'] ?? 'simpan')));

if ($aksi === 'hapus') {
    if (is_file($berkas)) @unlink($berkas);
    echo json_encode(qi_tg_jawaban_status(), JSON_PRETTY_PRINT);
    exit;
}

$lama = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
if (!is_array($lama)) $lama = [];

$token = array_key_exists('token', $input) ? trim((string)$input['token']) : trim((string)($lama['token'] ?? ''));
$chat  = array_key_exists('chat_id', $input) ? trim((string)$input['chat_id']) : trim((string)($lama['chat_id'] ?? ''));

// Bila token dikirim kosong secara sengaja (menghapus), hormati sebagai kosong.
if (array_key_exists('token', $input) && trim((string)$input['token']) === '') $token = '';
if (array_key_exists('chat_id', $input) && trim((string)$input['chat_id']) === '') $chat = '';

// Validasi bentuk — mencegah menyimpan nilai salah yang membuat galat tak jelas.
if ($token !== '' && !preg_match('/^\d{6,}:[A-Za-z0-9_\-]{20,}$/', $token)) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Bentuk token bot tidak wajar. Token dari @BotFather berbentuk angka:huruf (contoh 123456789:AA...).',
        'code'    => 'TOKEN_TIDAK_WAJAR',
    ]);
    exit;
}
if ($chat !== '' && !preg_match('/^-?\d{5,}$/', $chat) && !preg_match('/^@[A-Za-z0-9_]{4,}$/', $chat)) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Chat id tidak wajar. Isi angka (contoh -1001234567890) atau nama kanal (contoh @kanalsaya).',
        'code'    => 'CHAT_TIDAK_WAJAR',
    ]);
    exit;
}

// Simpan atomik + izin ketat (0600) karena memuat rahasia.
$isi = json_encode(['token' => $token, 'chat_id' => $chat, 'diperbarui' => date('c')], JSON_UNESCAPED_SLASHES);
$tmp = $berkas . '.tmp' . getmypid();
$okSimpan = (@file_put_contents($tmp, $isi, LOCK_EX) !== false) && @rename($tmp, $berkas);
if ($okSimpan) @chmod($berkas, 0600);

$jawaban = qi_tg_jawaban_status();
$jawaban['disimpan'] = (bool)$okSimpan;

// Pesan uji: tegas bahwa ini hanya uji, bukan sinyal.
if ($aksi === 'uji') {
    $teks = "<b>✅ UJI NOTIFIKASI QUANTUM</b>\n"
        . "Jika Anda menerima pesan ini, notifikasi Telegram sudah terhubung.\n"
        . "Sinyal baru akan dikirim otomatis dengan rincian entry/SL/TP dan grade.\n\n"
        . "<i>Ini pesan uji — bukan sinyal. Manajemen risiko tetap tanggung jawab Anda.</i>";
    $hasil = qi_telegram_kirim($teks);
    $jawaban['uji'] = ['ok' => $hasil['ok'], 'pesan' => $hasil['pesan'], 'kode' => $hasil['kode']];
    if (!$hasil['ok']) $jawaban['status'] = 'error';
}

echo json_encode($jawaban, JSON_PRETTY_PRINT);
