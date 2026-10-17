<?php
/**
 * PUSTAKA EMAIL (SMTP) — dipakai oleh kode 2FA (api/_keamanan.php) dan notifikasi sinyal (api/_notif.php).
 *
 * Proyek ini tidak memakai Composer, jadi klien SMTP minimal ditulis sendiri:
 * EHLO → STARTTLS (atau SSL langsung) → AUTH LOGIN → MAIL/RCPT/DATA per penerima → QUIT.
 *
 * Pengaturan (config/api_keys.php atau variabel lingkungan dengan nama sama):
 *   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE ('tls' | 'ssl' | 'none'), SMTP_USER, SMTP_PASS,
 *   SMTP_FROM (default SMTP_USER), SMTP_FROM_NAME (default 'Quantum Institut')
 *
 * Kejujuran & keamanan yang dipegang:
 *   · Bila SMTP belum diatur, fungsi mengembalikan status "belum dikonfigurasi" yang JELAS —
 *     tidak pernah pura-pura terkirim.
 *   · Kata sandi SMTP TIDAK PERNAH dikirim lewat koneksi tanpa enkripsi, kecuali ke server
 *     loopback (127.0.0.1/::1/localhost) yang memang tidak melewati jaringan.
 *   · Sertifikat TLS diverifikasi. Alamat & subjek divalidasi supaya tidak ada injeksi header.
 *   · Tidak pernah melempar exception ke pemanggil.
 */

if (!function_exists('qi_mail_setelan')):

function qi_mail_nilai(string $nama, string $bawaan = ''): string
{
    if (defined($nama)) return trim((string)constant($nama));
    $env = getenv($nama);
    return $env !== false ? trim((string)$env) : $bawaan;
}

/** Baca pengaturan SMTP yang berlaku. */
function qi_mail_setelan(): array
{
    $kunci = __DIR__ . '/../config/api_keys.php';
    if (!defined('SMTP_HOST') && is_file($kunci)) require_once $kunci;

    $host   = qi_mail_nilai('SMTP_HOST');
    $port   = (int)(qi_mail_nilai('SMTP_PORT') ?: 587);
    $secure = strtolower(qi_mail_nilai('SMTP_SECURE'));
    if ($secure === '') $secure = ($port === 465) ? 'ssl' : 'tls';
    if (!in_array($secure, ['tls', 'ssl', 'none'], true)) $secure = 'tls';
    $user = qi_mail_nilai('SMTP_USER');
    $from = qi_mail_nilai('SMTP_FROM') ?: $user;

    return [
        'host'           => $host,
        'port'           => $port > 0 ? $port : 587,
        'secure'         => $secure,
        'user'           => $user,
        'pass'           => qi_mail_nilai('SMTP_PASS'),
        'from'           => $from,
        'from_name'      => qi_mail_nilai('SMTP_FROM_NAME') ?: 'Quantum Institut',
        'terkonfigurasi' => $host !== '' && filter_var($from, FILTER_VALIDATE_EMAIL) !== false,
    ];
}

/** Status untuk UI — tanpa membocorkan kredensial. */
function qi_mail_status(): array
{
    $s = qi_mail_setelan();
    return [
        'terkonfigurasi' => $s['terkonfigurasi'],
        'catatan'        => $s['terkonfigurasi']
            ? 'Email SMTP aktif.'
            : 'Email SMTP belum diatur di server (SMTP_HOST dan SMTP_FROM/SMTP_USER) — email tidak dikirim.',
    ];
}

function qi_mail_host_loopback(string $host): bool
{
    return in_array(strtolower($host), ['127.0.0.1', '::1', '[::1]', 'localhost'], true);
}

/** Header "=?UTF-8?B?...?=" untuk teks non-ASCII; baris baru dibuang (cegah injeksi). */
function qi_mail_header_teks(string $s): string
{
    $s = trim(preg_replace('/[\r\n]+/', ' ', $s));
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

/**
 * Susun pesan MIME multipart/alternative (FUNGSI MURNI — bisa diuji tanpa jaringan).
 * Mengembalikan teks pesan dengan CRLF, belum di-dot-stuff.
 */
function qi_mail_susun(string $dari, string $namaDari, string $ke, string $subjek, string $html, string $teks): string
{
    $batas = 'qi-' . bin2hex(random_bytes(12));
    $domain = substr(strrchr($dari, '@') ?: '@localhost', 1);
    $normal = static function (string $s): string {
        return preg_replace("/\r\n|\r|\n/", "\r\n", $s);
    };

    $kepala = [
        'Date: ' . date('r'),
        'From: ' . qi_mail_header_teks($namaDari) . ' <' . $dari . '>',
        'To: <' . $ke . '>',
        'Subject: ' . qi_mail_header_teks($subjek),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $batas . '"',
        'X-Mailer: Quantum Institut',
    ];

    $badan = [
        '--' . $batas,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        quoted_printable_encode($normal($teks)),
        '--' . $batas,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        quoted_printable_encode($normal($html)),
        '--' . $batas . '--',
        '',
    ];

    return implode("\r\n", $kepala) . "\r\n\r\n" . implode("\r\n", $badan);
}

/** Baca satu jawaban SMTP (bisa banyak baris). @return array{0:int,1:string} */
function qi_mail_baca($sok): array
{
    $semua = '';
    while (($baris = fgets($sok, 1024)) !== false) {
        $semua .= $baris;
        if (strlen($baris) < 4 || $baris[3] !== '-') break;
    }
    return [(int)substr($semua, 0, 3), trim($semua)];
}

/** Kirim perintah lalu pastikan kodenya sesuai harapan; lempar RuntimeException bila tidak. */
function qi_mail_perintah($sok, string $perintah, array $harap, string $label = ''): string
{
    if ($perintah !== '') fwrite($sok, $perintah . "\r\n");
    [$kode, $jawab] = qi_mail_baca($sok);
    if (!in_array($kode, $harap, true)) {
        throw new RuntimeException(($label ?: strtok($perintah, ' ')) . ' ditolak: ' . mb_substr($jawab, 0, 160));
    }
    return $jawab;
}

/**
 * Kirim satu email (HTML + teks) ke beberapa penerima, masing-masing sebagai pesan terpisah
 * (alamat penerima lain tidak pernah terlihat), dalam SATU sesi SMTP.
 *
 * @param string[] $penerima
 * @return array{ok:bool,pesan:string,per_penerima:array<string,array{ok:bool,pesan:string}>}
 */
function qi_mail_kirim(array $penerima, string $subjek, string $html, string $teks): array
{
    $s = qi_mail_setelan();
    $hasil = [];
    $sah = [];
    foreach ($penerima as $p) {
        $p = strtolower(trim((string)$p));
        if ($p === '' || filter_var($p, FILTER_VALIDATE_EMAIL) === false || preg_match('/[\r\n<>]/', $p)) {
            $hasil[$p] = ['ok' => false, 'pesan' => 'Alamat email tidak sah.'];
            continue;
        }
        $sah[$p] = true;
    }
    $sah = array_keys($sah);

    if (!$s['terkonfigurasi']) {
        foreach ($sah as $p) $hasil[$p] = ['ok' => false, 'pesan' => 'SMTP belum dikonfigurasi — email tidak dikirim.'];
        return ['ok' => false, 'pesan' => 'SMTP belum dikonfigurasi di server.', 'per_penerima' => $hasil];
    }
    if (!$sah) return ['ok' => false, 'pesan' => 'Tidak ada penerima yang sah.', 'per_penerima' => $hasil];

    if ($s['secure'] === 'none' && $s['user'] !== '' && !qi_mail_host_loopback($s['host'])) {
        foreach ($sah as $p) $hasil[$p] = ['ok' => false, 'pesan' => 'Ditolak: login SMTP tanpa enkripsi.'];
        return ['ok' => false, 'pesan' => 'SMTP_SECURE=none dengan login ke server jaringan ditolak (kata sandi akan terkirim tanpa enkripsi). Pakai tls atau ssl.', 'per_penerima' => $hasil];
    }

    $konteks = stream_context_create(['ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
        'peer_name'        => $s['host'],
        'SNI_enabled'      => true,
    ]]);
    $alamat = ($s['secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $s['host'] . ':' . $s['port'];

    $sok = null;
    try {
        $errno = 0; $errstr = '';
        $sok = @stream_socket_client($alamat, $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $konteks);
        if (!$sok) throw new RuntimeException('Tidak dapat terhubung ke ' . $s['host'] . ':' . $s['port'] . ($errstr ? ' (' . $errstr . ')' : ''));
        stream_set_timeout($sok, 10);

        $namaKu = preg_replace('/[^A-Za-z0-9.\-]/', '', (string)($_SERVER['SERVER_NAME'] ?? '')) ?: 'localhost';
        qi_mail_perintah($sok, '', [220], 'Sapaan server');
        $ehlo = qi_mail_perintah($sok, 'EHLO ' . $namaKu, [250]);

        if ($s['secure'] === 'tls') {
            if (stripos($ehlo, 'STARTTLS') === false) throw new RuntimeException('Server tidak menawarkan STARTTLS.');
            qi_mail_perintah($sok, 'STARTTLS', [220]);
            $tls = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $tls |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $tls |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            if (!@stream_socket_enable_crypto($sok, true, $tls)) throw new RuntimeException('Negosiasi TLS gagal (sertifikat tidak sah?).');
            qi_mail_perintah($sok, 'EHLO ' . $namaKu, [250]);
        }

        if ($s['user'] !== '') {
            qi_mail_perintah($sok, 'AUTH LOGIN', [334]);
            qi_mail_perintah($sok, base64_encode($s['user']), [334], 'Nama pengguna SMTP');
            qi_mail_perintah($sok, base64_encode($s['pass']), [235], 'Kata sandi SMTP');
        }

        foreach ($sah as $p) {
            try {
                qi_mail_perintah($sok, 'MAIL FROM:<' . $s['from'] . '>', [250]);
                qi_mail_perintah($sok, 'RCPT TO:<' . $p . '>', [250, 251]);
                qi_mail_perintah($sok, 'DATA', [354]);
                $pesan = qi_mail_susun($s['from'], $s['from_name'], $p, $subjek, $html, $teks);
                // Dot-stuffing (RFC 5321 §4.5.2): baris yang diawali titik digandakan.
                $pesan = preg_replace('/^\./m', '..', $pesan);
                fwrite($sok, $pesan . "\r\n.\r\n");
                qi_mail_perintah($sok, '', [250], 'Isi pesan');
                $hasil[$p] = ['ok' => true, 'pesan' => 'Terkirim lewat SMTP.'];
            } catch (RuntimeException $e) {
                $hasil[$p] = ['ok' => false, 'pesan' => $e->getMessage()];
                @fwrite($sok, "RSET\r\n");
                @qi_mail_baca($sok);
            }
        }
        @fwrite($sok, "QUIT\r\n");
    } catch (Throwable $e) {
        foreach ($sah as $p) {
            if (!isset($hasil[$p])) $hasil[$p] = ['ok' => false, 'pesan' => $e->getMessage()];
        }
    } finally {
        if (is_resource($sok)) @fclose($sok);
    }

    $berhasil = count(array_filter($hasil, static fn($h) => $h['ok']));
    return [
        'ok'           => $berhasil > 0 && $berhasil === count($sah),
        'pesan'        => $berhasil . ' dari ' . count($sah) . ' email terkirim.',
        'per_penerima' => $hasil,
    ];
}

/** Bungkus isi HTML dengan kerangka email bermerek (inline style — klien email membuang <style>). */
function qi_mail_kerangka(string $judul, string $isiHtml, string $catatanKaki = ''): string
{
    $e = static fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $kaki = $catatanKaki !== '' ? $catatanKaki
        : 'Email otomatis dari Quantum Institut. Bukan nasihat keuangan — trading berisiko.';
    return '<!doctype html><html><body style="margin:0;padding:0;background:#060B18;font-family:Segoe UI,Arial,sans-serif;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#060B18;padding:24px 0;"><tr><td align="center">'
        . '<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#0D1526;border:1px solid #1E2A44;border-radius:12px;">'
        . '<tr><td style="padding:18px 24px;border-bottom:1px solid #1E2A44;color:#22D3EE;font-weight:700;font-size:14px;letter-spacing:.06em;">QUANTUM INSTITUT</td></tr>'
        . '<tr><td style="padding:20px 24px;color:#E2E8F0;font-size:14px;line-height:1.55;">'
        . '<h1 style="margin:0 0 12px;font-size:18px;color:#FFFFFF;">' . $e($judul) . '</h1>'
        . $isiHtml
        . '</td></tr>'
        . '<tr><td style="padding:14px 24px;border-top:1px solid #1E2A44;color:#64748B;font-size:11px;line-height:1.5;">' . $e($kaki) . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/** Templat email OTP. @return array{subjek:string,html:string,teks:string} */
function qi_mail_templat_otp(string $kode, int $menit = 5): array
{
    $e = static fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $html = '<p style="margin:0 0 12px;">Gunakan kode berikut untuk melanjutkan. Kode berlaku ' . (int)$menit . ' menit.</p>'
        . '<p style="margin:0 0 16px;font-family:Consolas,monospace;font-size:28px;letter-spacing:.3em;color:#22D3EE;font-weight:700;">' . $e($kode) . '</p>'
        . '<p style="margin:0;color:#94A3B8;font-size:12px;">Jangan berikan kode ini kepada siapa pun, termasuk yang mengaku dari Quantum Institut. Abaikan email ini bila Anda tidak memintanya.</p>';
    return [
        'subjek' => 'Kode verifikasi Quantum Institut: ' . $kode,
        'html'   => qi_mail_kerangka('Kode verifikasi Anda', $html),
        'teks'   => "Kode verifikasi Quantum Institut: {$kode}\nBerlaku {$menit} menit. Jangan berikan kode ini kepada siapa pun.\nAbaikan email ini bila Anda tidak memintanya.",
    ];
}

endif;
