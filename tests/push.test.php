<?php
/**
 * Web Push (api/_push.php): enkripsi RFC 8291 diuji dengan MENDEKRIPSI dari sisi peramban,
 * dan tanda tangan VAPID (ES256) diverifikasi dengan kunci publiknya. Tanpa jaringan.
 * Dijalankan oleh tests/push.test.js.
 */
define('QI_TEST', true);
require __DIR__ . '/../api/_push.php';

$gagal = 0;
function cek(string $n, bool $ok): void { global $gagal; echo '  ' . ($ok ? '✓' : '✗') . " $n\n"; if (!$ok) $gagal++; }

$cfg = qi_push_ssl_cfg();
// "Peramban": pasangan kunci langganan + rahasia auth.
$ua = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC] + $cfg);
$uaTitik = qi_push_titik($ua);
$auth = random_bytes(16);
$pesan = json_encode(['title' => 'Sinyal BUY XAUUSD', 'body' => 'Entry 4165.38 · SL 4155 · TP 4190', 'tag' => 'SIG-1']);

$badan = qi_push_enkripsi($pesan, qi_push_b64u($uaTitik), qi_push_b64u($auth));
cek('enkripsi menghasilkan badan', is_string($badan) && strlen($badan) > 86);

// Dekripsi seperti peramban (RFC 8291 §3.4 / RFC 8188).
$garam = substr($badan, 0, 16);
$rs = unpack('N', substr($badan, 16, 4))[1];
$idlen = ord($badan[20]);
$asTitik = substr($badan, 21, $idlen);
$sandi = substr($badan, 21 + $idlen);
cek('header: rs 4096, keyid 65 byte', $rs === 4096 && $idlen === 65 && $asTitik[0] === "\x04");
$ecdh = openssl_pkey_derive(qi_push_pem_dari_titik($asTitik), $ua, 32);
$ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaTitik . $asTitik, $auth);
$cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $garam);
$nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $garam);
$polos = openssl_decrypt(substr($sandi, 0, -16), 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, substr($sandi, -16));
cek('peramban dapat mendekripsi', $polos !== false && substr($polos, -1) === "\x02");
cek('isi pesan utuh', $polos !== false && substr($polos, 0, -1) === $pesan);

// VAPID JWT: verifikasi ES256 dengan kunci publik VAPID.
$kunci = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC] + $cfg);
openssl_pkey_export($kunci, $pem, null, $cfg);
$vapid = ['public' => qi_push_b64u(qi_push_titik($kunci)), 'private_pem' => $pem];
$jwt = qi_push_jwt('https://fcm.googleapis.com', $vapid);
[$h, $c, $t] = explode('.', (string)$jwt) + [null, null, null];
$klaim = json_decode((string)qi_push_b64u_dec((string)$c), true);
cek('JWT berisi aud & exp', ($klaim['aud'] ?? '') === 'https://fcm.googleapis.com' && ($klaim['exp'] ?? 0) > time());
$rs64 = qi_push_b64u_dec((string)$t);
$intDer = static function (string $x): string { $x = ltrim($x, "\0"); if ($x === '' || ord($x[0]) & 0x80) $x = "\0" . $x; return "\x02" . chr(strlen($x)) . $x; };
$der = $intDer(substr($rs64, 0, 32)) . $intDer(substr($rs64, 32));
$der = "\x30" . chr(strlen($der)) . $der;
cek('tanda tangan ES256 sah', openssl_verify($h . '.' . $c, $der, qi_push_pem_dari_titik(qi_push_b64u_dec($vapid['public'])), OPENSSL_ALGO_SHA256) === 1);

// Endpoint: hanya layanan push resmi via HTTPS.
cek('endpoint FCM diterima', qi_push_endpoint_sah('https://fcm.googleapis.com/fcm/send/abc'));
cek('endpoint WNS diterima', qi_push_endpoint_sah('https://wns2-par02p.notify.windows.com/w/?token=x'));
cek('endpoint http ditolak', !qi_push_endpoint_sah('http://fcm.googleapis.com/fcm/send/abc'));
cek('host lain ditolak (SSRF)', !qi_push_endpoint_sah('https://169.254.169.254/latest') && !qi_push_endpoint_sah('https://evil.com/notify.windows.com'));

echo $gagal ? "\n$gagal uji push GAGAL\n" : "\nSemua uji push lulus\n";
exit($gagal ? 1 : 0);
