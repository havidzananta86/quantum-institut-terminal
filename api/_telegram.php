<?php
/**
 * PUSTAKA TELEGRAM — pengirim notifikasi sinyal.
 *
 * Kejujuran yang dipegang:
 *   · Bila bot/chat belum diatur, fungsi mengembalikan status "belum dikonfigurasi"
 *     yang JELAS — bukan pura-pura berhasil, dan bukan error yang membingungkan.
 *   · Pengiriman TIDAK PERNAH menggagalkan pencatatan sinyal. Sinyal tetap tercatat
 *     walau Telegram mati/blokir; kegagalan hanya dicatat sebagai catatan.
 *   · Isi pesan menyebut bahwa sinyal BUKAN jaminan menang — mengirim sinyal tanpa
 *     peringatan risiko akan menyesatkan pengguna.
 *
 * Pengaturan dibaca dari dua tempat, berurutan:
 *   1. cache/telegram.json  (diatur dari UI, tanpa perlu edit berkas konfigurasi)
 *   2. konstanta TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID di config/api_keys.php
 */

/** Baca pengaturan Telegram yang berlaku. Tidak pernah mengarang nilai. */
function qi_telegram_setelan(): array
{
    $token = '';
    $chat  = '';
    $sumber = 'belum_ada';

    $berkas = __DIR__ . '/../cache/telegram.json';
    if (is_file($berkas)) {
        $j = json_decode((string)@file_get_contents($berkas), true);
        if (is_array($j)) {
            $token = trim((string)($j['token'] ?? ''));
            $chat  = trim((string)($j['chat_id'] ?? ''));
            if ($token !== '' || $chat !== '') $sumber = 'berkas_pengaturan';
        }
    }

    if ($token === '' && defined('TELEGRAM_BOT_TOKEN')) {
        $token = trim((string)TELEGRAM_BOT_TOKEN);
        if ($token !== '') $sumber = ($sumber === 'belum_ada') ? 'konfigurasi_server' : $sumber . '+konfigurasi';
    }
    if ($chat === '' && defined('TELEGRAM_CHAT_ID')) {
        $chat = trim((string)TELEGRAM_CHAT_ID);
    }

    return [
        'token'          => $token,
        'chat_id'        => $chat,
        'terkonfigurasi' => ($token !== '' && $chat !== ''),
        'sumber'         => $sumber,
    ];
}

/** Status yang jujur untuk ditampilkan di UI (termasuk APA yang masih kurang). */
function qi_telegram_status(): array
{
    $s = qi_telegram_setelan();
    $kurang = [];
    if ($s['token'] === '')  $kurang[] = 'token bot';
    if ($s['chat_id'] === '') $kurang[] = 'chat id';

    return [
        'terkonfigurasi' => $s['terkonfigurasi'],
        'sumber'         => $s['sumber'],
        'ada_token'      => $s['token'] !== '',
        'ada_chat_id'    => $s['chat_id'] !== '',
        'kurang'         => $kurang,
        'catatan'        => $s['terkonfigurasi']
            ? 'Notifikasi Telegram aktif. Setiap sinyal baru dikirim ke chat id tersebut.'
            : ('Notifikasi Telegram BELUM aktif — yang kurang: ' . (implode(' dan ', $kurang) ?: 'tidak diketahui')
               . '. Sinyal tetap tercatat normal; hanya notifikasinya yang tidak terkirim.'),
    ];
}

/**
 * Susun pesan sinyal (FUNGSI MURNI — bisa diuji tanpa jaringan).
 * Format HTML Telegram: hanya <b>, <i>, <code> yang diizinkan.
 */
function qi_telegram_pesan_sinyal(array $rek): string
{
    $esc = static function ($s): string {
        return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    };
    $angka = static function ($v): string {
        if ($v === null || $v === '' || !is_numeric($v)) return '—';
        $f = (float)$v;
        if (abs($f) >= 1000) return number_format($f, 2, '.', '');
        if (abs($f) >= 100)  return number_format($f, 2, '.', '');
        if (abs($f) >= 1)    return number_format($f, 4, '.', '');
        return number_format($f, 5, '.', '');
    };

    $simbol = strtoupper(trim((string)($rek['symbol'] ?? '?')));
    $arah   = strtoupper(trim((string)($rek['side'] ?? '?')));
    $mesin  = strtoupper(trim((string)($rek['engine'] ?? '')));
    $tf     = strtoupper(trim((string)($rek['timeframe'] ?? '')));
    $grade  = strtoupper(trim((string)($rek['grade'] ?? '')));

    $ikonArah = ($arah === 'BUY') ? '🟢' : (($arah === 'SELL') ? '🔴' : '⚪');
    $baris = [];
    $baris[] = '<b>' . $ikonArah . ' SINYAL BARU — ' . $esc($simbol) . ' ' . $esc($arah) . '</b>';
    if ($grade !== '') $baris[] = 'Mutu (grade): <b>' . $esc($grade) . '</b>';

    $rincian = [];
    if ($mesin !== '') $rincian[] = 'mesin ' . $esc($mesin);
    if ($tf !== '')    $rincian[] = 'timeframe ' . $esc($tf);
    if ($rincian) $baris[] = 'Dari ' . implode(' · ', $rincian);

    $baris[] = 'Entry: <code>' . $esc($angka($rek['entry'] ?? null)) . '</code>';
    $baris[] = 'SL: <code>' . $esc($angka($rek['sl'] ?? null)) . '</code>';
    $baris[] = 'TP: <code>' . $esc($angka($rek['tp'] ?? null)) . '</code>';
    if (isset($rek['rr']) && is_numeric($rek['rr'])) {
        $baris[] = 'R:R 1 : ' . $esc(number_format((float)$rek['rr'], 2, '.', ''));
    }
    if (isset($rek['confluence_score']) && is_numeric($rek['confluence_score'])) {
        $baris[] = 'Skor konfluensi: ' . $esc((string)(int)$rek['confluence_score']);
    }
    if (isset($rek['mtf_aligned'])) {
        $baris[] = 'Selaras multi-timeframe: ' . ($rek['mtf_aligned'] ? 'ya' : 'tidak');
    }

    $baris[] = '';
    $baris[] = '<i>Ini bukan jaminan menang. Selalu kelola risiko dan ukuran posisi Anda.</i>';
    return implode("\n", $baris);
}

/**
 * Kirim pesan ke Telegram. Tidak pernah melempar exception.
 *
 * @return array{ok:bool,kode:int,pesan:string}
 */
function qi_telegram_kirim(string $teks, ?string $chatId = null): array
{
    $s = qi_telegram_setelan();
    $chat = $chatId !== null && trim($chatId) !== '' ? trim($chatId) : $s['chat_id'];

    if ($s['token'] === '') {
        return ['ok' => false, 'kode' => 0, 'pesan' => 'Token bot Telegram belum diatur — notifikasi tidak dikirim (bukan kegagalan sinyal).'];
    }
    if ($chat === '') {
        return ['ok' => false, 'kode' => 0, 'pesan' => 'Chat id Telegram belum diatur — notifikasi tidak dikirim (bukan kegagalan sinyal).'];
    }
    if (trim($teks) === '') {
        return ['ok' => false, 'kode' => 0, 'pesan' => 'Pesan kosong — tidak ada yang dikirim.'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'kode' => 0, 'pesan' => 'cURL tidak tersedia di server ini — notifikasi tidak dikirim.'];
    }

    $url = 'https://api.telegram.org/bot' . rawurlencode($s['token']) . '/sendMessage';
    $payload = json_encode([
        'chat_id'    => $chat,
        'text'       => mb_substr($teks, 0, 4000),
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ], JSON_UNESCAPED_UNICODE);

    try {
        $ch = curl_init($url);
        $dev = defined('QI_DEV') ? (bool)QI_DEV : false;
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => $dev ? false : true,
        ]);
        $raw  = curl_exec($ch);
        $kode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $raw === '') {
            return ['ok' => false, 'kode' => $kode, 'pesan' => 'Tidak dapat menghubungi Telegram API' . ($err ? (': ' . $err) : '') . '.'];
        }
        $d = json_decode((string)$raw, true);
        if (is_array($d) && !empty($d['ok'])) {
            return ['ok' => true, 'kode' => $kode, 'pesan' => 'Terkirim ke Telegram.'];
        }
        $ket = is_array($d) ? (string)($d['description'] ?? 'jawaban tidak dikenali') : 'jawaban tidak dikenali';
        return ['ok' => false, 'kode' => $kode, 'pesan' => 'Telegram menolak: ' . $ket];
    } catch (Throwable $e) {
        return ['ok' => false, 'kode' => 0, 'pesan' => 'Kesalahan tak terduga saat mengirim: ' . $e->getMessage()];
    }
}

/**
 * Kirim notifikasi untuk satu rekor sinyal. Aman dipanggil dari jalur pencatatan:
 * tidak pernah melempar, tidak pernah menulis apa pun bila belum dikonfigurasi.
 *
 * @return array{ok:bool,dikirim:bool,pesan:string}
 */
function qi_telegram_notifikasi_sinyal(array $rek): array
{
    $s = qi_telegram_setelan();
    if (!$s['terkonfigurasi']) {
        $st = qi_telegram_status();
        return ['ok' => false, 'dikirim' => false, 'pesan' => $st['catatan']];
    }
    $hasil = qi_telegram_kirim(qi_telegram_pesan_sinyal($rek));
    return ['ok' => $hasil['ok'], 'dikirim' => true, 'pesan' => $hasil['pesan']];
}

/**
 * Kirim notifikasi pembatalan sinyal (early invalidation) ke Telegram.
 * @return array{ok:bool,dikirim:bool,pesan:string}
 */
function qi_telegram_notifikasi_batal(array $sig, string $alasan): array
{
    $s = qi_telegram_setelan();
    if (!$s['terkonfigurasi']) {
        return ['ok' => false, 'dikirim' => false, 'pesan' => 'Telegram belum dikonfigurasi.'];
    }
    $esc = static fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $simbol = strtoupper(trim((string)($sig['symbol'] ?? '')));
    $side   = strtoupper(trim((string)($sig['side'] ?? '')));
    $id     = (string)($sig['id'] ?? '-');
    $teks = "⚠️ <b>PEMBATALAN SINYAL (EARLY INVALIDATION)</b>\n"
        . "Sinyal: <b>{$esc($simbol)} {$esc($side)}</b> [{$esc($id)}]\n"
        . "Alasan: {$esc($alasan)}\n\n"
        . "<i>Sistem membatalkan sinyal pre-news ini karena reaksi data aktual berlawanan arah. Disarankan batalkan posisi sebelum kena SL penuh.</i>";
    $hasil = qi_telegram_kirim($teks);
    return ['ok' => $hasil['ok'], 'dikirim' => true, 'pesan' => $hasil['pesan']];
}
