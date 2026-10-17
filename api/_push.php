<?php
/**
 * WEB PUSH tanpa Composer — VAPID (RFC 8292, JWT ES256) + enkripsi aes128gcm (RFC 8291).
 *
 * Dipakai supaya notifikasi sinyal & price alert tetap muncul walau tab dashboard ditutup.
 *   · Kunci VAPID: konstanta QI_VAPID_PUBLIC + QI_VAPID_PRIVATE_PEM (config/api_keys.php), atau
 *     dibuat otomatis sekali di cache/vapid.json (0600; cache/*.json tidak ikut git).
 *     Kehilangan kunci = semua langganan harus didaftarkan ulang dari peramban.
 *   · Endpoint push hanya boleh ke layanan push resmi (FCM, Mozilla, Windows/WNS, Apple) lewat
 *     HTTPS — server tidak bisa disuruh memanggil alamat lain (mencegah SSRF).
 *   · Langganan yang dijawab 404/410 (kedaluwarsa) dihapus otomatis.
 */

if (!function_exists('qi_push_b64u')):

define('QI_PUSH_HOST', ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com']);
define('QI_PUSH_HOST_AKHIRAN', ['.notify.windows.com', '.push.apple.com']);

function qi_push_b64u(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }
function qi_push_b64u_dec(string $s): string|false { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }

/** openssl.cnf untuk Windows/XAMPP (di Linux tidak diperlukan). */
function qi_push_ssl_cfg(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $cfg = [];
    $ini = php_ini_loaded_file();
    // CLI: PHP_BINARY = php.exe; Apache mod_php: PHP_BINARY = httpd.exe (apache/bin) → apache/conf.
    foreach ([getenv('OPENSSL_CONF') ?: '', $ini ? dirname($ini) . '/extras/ssl/openssl.cnf' : '', dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf',
              dirname(PHP_BINARY) . '/../conf/openssl.cnf', dirname(PHP_BINARY) . '/../apache/conf/openssl.cnf'] as $c) {
        if ($c !== '' && is_file($c)) { $cfg = ['config' => $c]; break; }
    }
    return $cfg;
}

/** Titik publik mentah (65 byte, 0x04||X||Y) dari kunci EC. */
function qi_push_titik($kunci): string
{
    $d = openssl_pkey_get_details($kunci);
    return "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
}

/** Kunci publik PEM dari titik mentah P-256 (SubjectPublicKeyInfo DER + titik). */
function qi_push_pem_dari_titik(string $titik)
{
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $titik;
    return openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n");
}

/** @return array{public:string,private_pem:string}|null */
function qi_push_vapid(): ?array
{
    static $v = null;
    if ($v !== null) return $v;
    $kunciCfg = __DIR__ . '/../config/api_keys.php';
    if (!defined('QI_VAPID_PUBLIC') && is_file($kunciCfg)) require_once $kunciCfg;
    if (defined('QI_VAPID_PUBLIC') && defined('QI_VAPID_PRIVATE_PEM')) return $v = ['public' => (string)QI_VAPID_PUBLIC, 'private_pem' => (string)QI_VAPID_PRIVATE_PEM];

    $f = __DIR__ . '/../cache/vapid.json';
    if (!is_file($f)) {
        $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC] + qi_push_ssl_cfg());
        if (!$k || !openssl_pkey_export($k, $pem, null, qi_push_ssl_cfg())) return null;
        $isi = json_encode(['public' => qi_push_b64u(qi_push_titik($k)), 'private_pem' => $pem, 'dibuat' => date('c')]);
        $fp = @fopen($f, 'x');
        if ($fp) { fwrite($fp, $isi); fclose($fp); @chmod($f, 0600); }
    }
    $j = json_decode((string)@file_get_contents($f), true);
    return $v = (is_array($j) && !empty($j['public']) && !empty($j['private_pem'])) ? $j : null;
}

function qi_push_endpoint_sah(string $url): bool
{
    $b = parse_url($url);
    if (!is_array($b) || strtolower((string)($b['scheme'] ?? '')) !== 'https' || isset($b['user']) || (isset($b['port']) && (int)$b['port'] !== 443)) return false;
    $host = strtolower((string)($b['host'] ?? ''));
    if (in_array($host, QI_PUSH_HOST, true)) return true;
    foreach (QI_PUSH_HOST_AKHIRAN as $akhiran) if (str_ends_with($host, $akhiran)) return true;
    return false;
}

/** JWT ES256 untuk header Authorization VAPID. */
function qi_push_jwt(string $aud, array $vapid): ?string
{
    $kunci = openssl_pkey_get_private($vapid['private_pem']);
    if (!$kunci) return null;
    $subjek = 'mailto:admin@' . (defined('APP_DOMAIN') ? APP_DOMAIN : 'quantum-institut.com');
    $tanda = qi_push_b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . qi_push_b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $subjek]));
    if (!openssl_sign($tanda, $der, $kunci, OPENSSL_ALGO_SHA256)) return null;
    // DER (SEQUENCE{INTEGER r, INTEGER s}) → r||s mentah 64 byte.
    $p = 2; if (ord($der[1]) & 0x80) $p += ord($der[1]) & 0x7f;
    $ambil = static function () use ($der, &$p) { $p++; $n = ord($der[$p++]); $x = substr($der, $p, $n); $p += $n; return str_pad(ltrim($x, "\0"), 32, "\0", STR_PAD_LEFT); };
    $r = $ambil(); $s = $ambil();
    return $tanda . '.' . qi_push_b64u($r . $s);
}

/** Enkripsi pesan untuk satu langganan (RFC 8291, aes128gcm, satu rekaman). */
function qi_push_enkripsi(string $pesan, string $p256dh, string $auth): ?string
{
    $uaTitik = qi_push_b64u_dec($p256dh);
    $rahasiaAuth = qi_push_b64u_dec($auth);
    if (!is_string($uaTitik) || strlen($uaTitik) !== 65 || !is_string($rahasiaAuth) || strlen($rahasiaAuth) < 16) return null;
    $uaKunci = qi_push_pem_dari_titik($uaTitik);
    $kita = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC] + qi_push_ssl_cfg());
    if (!$uaKunci || !$kita) return null;
    $kitaTitik = qi_push_titik($kita);
    $ecdh = openssl_pkey_derive($uaKunci, $kita, 32);
    if ($ecdh === false) return null;

    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaTitik . $kitaTitik, $rahasiaAuth);
    $garam = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $garam);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $garam);
    $tag = '';
    $sandi = openssl_encrypt($pesan . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($sandi === false) return null;
    return $garam . pack('N', 4096) . chr(65) . $kitaTitik . $sandi . $tag;
}

/**
 * Kirim satu payload (array → JSON) ke banyak langganan sekaligus (curl_multi).
 * @param array<int,array{id:int,endpoint:string,p256dh:string,auth:string}> $langganan
 * @return array<int,array{ok:bool,kode:int}>  (kunci = id langganan)
 */
function qi_push_kirim(PDO $pdo, array $langganan, array $data): array
{
    $vapid = qi_push_vapid();
    $hasil = [];
    if (!$vapid || !$langganan || !function_exists('curl_multi_init')) return $hasil;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    $mh = curl_multi_init();
    $pegangan = [];
    foreach ($langganan as $l) {
        if (!qi_push_endpoint_sah($l['endpoint'])) { $hasil[$l['id']] = ['ok' => false, 'kode' => 0]; continue; }
        $badan = qi_push_enkripsi($json, $l['p256dh'], $l['auth']);
        $b = parse_url($l['endpoint']);
        $jwt = qi_push_jwt($b['scheme'] . '://' . $b['host'], $vapid);
        if ($badan === null || $jwt === null) { $hasil[$l['id']] = ['ok' => false, 'kode' => 0]; continue; }
        $ch = curl_init($l['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $badan,
            CURLOPT_HTTPHEADER => ['Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'TTL: 86400', 'Urgency: high',
                                   'Authorization: vapid t=' . $jwt . ', k=' . $vapid['public']],
            CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        ]);
        curl_multi_add_handle($mh, $ch);
        $pegangan[$l['id']] = $ch;
    }
    do { $st = curl_multi_exec($mh, $aktif); if ($aktif) curl_multi_select($mh, 1.0); } while ($aktif && $st === CURLM_OK);
    $hapus = $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?');
    $tandai = $pdo->prepare('UPDATE push_subscriptions SET last_ok_at = IF(? = 1, NOW(), last_ok_at), fail_count = IF(? = 1, 0, fail_count + 1) WHERE id = ?');
    foreach ($pegangan as $id => $ch) {
        $kode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $ok = $kode >= 200 && $kode < 300;
        $hasil[$id] = ['ok' => $ok, 'kode' => $kode];
        try {
            if ($kode === 404 || $kode === 410) $hapus->execute([$id]);   // langganan kedaluwarsa
            else $tandai->execute([$ok ? 1 : 0, $ok ? 1 : 0, $id]);
        } catch (Throwable $e) {}
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return $hasil;
}

/** Langganan milik pengguna yang mengizinkan notifikasi desktop (bawaan: izinkan). */
function qi_push_langganan(PDO $pdo, ?array $userIds = null): array
{
    $sql = 'SELECT p.id, p.user_id, p.endpoint, p.p256dh, p.auth FROM push_subscriptions p
            LEFT JOIN user_notification_settings s ON s.user_id = p.user_id
            JOIN users u ON u.id = p.user_id
            WHERE u.is_active = 1 AND COALESCE(s.desktop_enabled, 1) = 1';
    $param = [];
    if ($userIds !== null) {
        if (!$userIds) return [];
        $sql .= ' AND p.user_id IN (' . implode(',', array_fill(0, count($userIds), '?')) . ')';
        $param = array_values($userIds);
    }
    try { $st = $pdo->prepare($sql . ' LIMIT 5000'); $st->execute($param); return $st->fetchAll(PDO::FETCH_ASSOC); }
    catch (PDOException $e) { return []; }   // tabel belum ada (migrasi 018 belum dijalankan)
}

endif;
