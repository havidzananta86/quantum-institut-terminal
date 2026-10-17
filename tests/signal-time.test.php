<?php
/**
 * Uji regresi: penutupan sinyal kedaluwarsa + pembacaan zona waktu rekor sinyal.
 * Murni (tanpa jaringan, DB, atau cache/): api/_signal_time.php, penilai di
 * api/signal-evaluator.php, statistik api/_signal_stats.php, pagar api/_signal_record.php,
 * templat api/_notif.php.
 * Dijalankan oleh tests/signal-time.test.js:  php tests/signal-time.test.php
 */
// Zona runtime sengaja dibuat "aneh" (seperti config/app.php): hasil tidak boleh bergantung padanya.
date_default_timezone_set('America/New_York');
define('QI_SIGNAL_EVAL_LIB', true);
define('QI_NOTIFY_KEY', str_repeat('k', 40));   // _notif.php: jangan sentuh cache/notify_secret.json
require __DIR__ . '/../api/_signal_time.php';
require __DIR__ . '/../api/signal-evaluator.php';
require __DIR__ . '/../api/_signal_stats.php';
require __DIR__ . '/../api/_signal_record.php';
require __DIR__ . '/../api/_notif.php';

$gagal = 0;
function cek(string $nama, bool $lulus): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . "\n";
    if (!$lulus) $gagal++;
}
$utc = fn(string $s): int => (new DateTimeImmutable($s, new DateTimeZone('UTC')))->getTimestamp();

echo "Zona waktu\n";
$t = $utc('2026-10-16 07:30:00');
cek('tulis: ISO 8601 UTC berakhiran Z', qi_sig_waktu_utc($t) === '2026-10-16T07:30:00Z');
cek('baca: ISO Z bolak-balik', qi_sig_epoch(qi_sig_waktu_utc($t)) === $t);
cek('baca: offset +07:00', qi_sig_epoch('2026-10-16T14:30:00+07:00') === $t);
cek('baca: offset +0700 dan sufiks UTC', qi_sig_epoch('2026-10-16 14:30:00 +0700') === $t && qi_sig_epoch('2026-10-16 07:30:00 UTC') === $t);
cek('baca: tidak dipengaruhi zona runtime', (function () use ($t) {
    date_default_timezone_set('Asia/Jakarta'); $a = qi_sig_epoch('2026-10-16T07:30:00Z');
    date_default_timezone_set('Europe/Berlin'); $b = qi_sig_epoch('2026-10-16T07:30:00Z');
    date_default_timezone_set('America/New_York');
    return $a === $t && $b === $t;
})());
cek('rekor lama tanpa zona dibaca di zona lama (Berlin, CEST)', qi_sig_epoch('2026-10-16 09:30:00', 'timestamp', 'Europe/Berlin') === $t);
cek('rekor lama tanpa zona dibaca di zona lama (WIB)', qi_sig_epoch('2026-10-16 14:30:00', 'expiry', 'Asia/Jakarta') === $t);
cek('closed_at lama tanpa zona = UTC (penilai memakai gmdate)', qi_sig_epoch('2026-10-16 07:30:00', 'closed_at', 'Asia/Jakarta') === $t);
cek('zona lama bawaan = date.timezone php.ini, bukan zona runtime', qi_sig_zona_lama()->getName() === ((string)ini_get('date.timezone') !== '' ? (new DateTimeZone(ini_get('date.timezone')))->getName() : 'UTC'));
cek('epoch angka diterima', qi_sig_epoch($t) === $t && qi_sig_epoch((string)$t) === $t);
cek('kosong / sampah / kata relatif → null', qi_sig_epoch('') === null && qi_sig_epoch(null) === null
    && qi_sig_epoch('bukan tanggal') === null && qi_sig_epoch('now') === null && qi_sig_epoch('tomorrow') === null);
$j = qi_sig_jendela(['timestamp' => '2026-10-16T07:30:00Z', 'expiry' => '']);
cek('expiry kosong → terbit + 4 jam', $j['terbit'] === $t && $j['kedaluwarsa'] === $t + 4 * 3600);
$j = qi_sig_jendela(['timestamp' => '2026-10-16T07:30:00Z', 'expiry' => '2026-10-16T07:00:00Z']);
cek('expiry sebelum terbit → terbit + 4 jam', $j['kedaluwarsa'] === $t + 4 * 3600);
cek('jendela null bila waktu terbit tak terbaca', qi_sig_jendela(['timestamp' => 'x']) === null);
cek('tampilan tanpa ambigu: WIB + UTC', qi_sig_waktu_tampil($t) === '2026-10-16 14:30 WIB (07:30 UTC)');
cek('jam sesi dalam WIB', qi_sig_jam_tampil($t) === 14);
cek('zona kandidat: rekor ISO tidak ambigu', qi_sig_zona_kandidat(['timestamp' => '2026-10-16T07:30:00Z', 'expiry' => '2026-10-16T19:30:00Z']) === [null]);
cek('zona kandidat: rekor lama → beberapa zona', count(qi_sig_zona_kandidat(['timestamp' => '2026-10-16 07:30:00', 'expiry' => '2026-10-16 19:30:00'])) >= 2);

echo "Penilai: penutupan kedaluwarsa\n";
// Kasus nyata SIG-AUTO-20261013-51821b: expiry 23:40:43 tidak jatuh di batas candle 5 menit.
$t0 = $utc('2026-10-13 11:41:01');
$tExp = $utc('2026-10-13 23:40:43');
$sig = ['id' => 'UJI-1', 'symbol' => 'BTCUSDT', 'side' => 'BUY', 'entry' => 83598, 'tp' => 85332.68, 'sl' => 82904.13,
        'timestamp' => qi_sig_waktu_utc($t0), 'expiry' => qi_sig_waktu_utc($tExp), 'status' => 'AKTIF'];
$candle = function (int $dari, int $sampai, float $low = 83300, float $high = 83900): array {
    $out = [];
    for ($x = $dari - $dari % 300; $x <= $sampai; $x += 300) $out[] = ['time' => $x, 'open' => 83600, 'high' => $high, 'low' => $low, 'close' => 83600];
    return $out;
};
$sesudah = $tExp + 3 * 86400;
$c = $candle($t0 - 3600, $tExp + 3600);
$h = qi_sig_nilai_satu($sig, $c, 300, $sesudah);
cek('lewat expiry tanpa TP/SL → EXPIRED (regresi 51821b)', ($h['status'] ?? '') === 'EXPIRED' && ($h['expiry_basis'] ?? '') === 'candle');
cek('EXPIRED: closed_at = expiry dalam ISO UTC', ($h['closed_at'] ?? '') === '2026-10-13T23:40:43Z');
cek('EXPIRED: P/L nol, tanpa harga keluar', ($h['pnl_usd'] ?? null) === 0.0 && array_key_exists('exit_price', $h) && $h['exit_price'] === null);
cek('data berakhir tepat di candle yang memuat expiry → tetap EXPIRED', (qi_sig_nilai_satu($sig, $candle($t0 - 3600, $tExp), 300, $sesudah)['status'] ?? '') === 'EXPIRED');
cek('belum lewat expiry → tetap AKTIF (null)', qi_sig_nilai_satu($sig, $c, 300, $tExp - 60) === null);
cek('data berhenti jauh sebelum expiry → tetap AKTIF (null)', qi_sig_nilai_satu($sig, $candle($t0 - 3600, $tExp - 7200), 300, $sesudah) === null);
cek('data baru mulai sesudah sinyal terbit → tetap AKTIF (null)', qi_sig_nilai_satu($sig, $candle($t0 + 7200, $tExp + 3600), 300, $sesudah) === null);
$libur = array_merge($candle($t0 - 7200, $t0 - 300), $candle($tExp + 3600, $tExp + 7200));
cek('pasar tutup sepanjang jendela, data berlanjut sesudahnya → EXPIRED', (qi_sig_nilai_satu($sig, $libur, 300, $sesudah)['status'] ?? '') === 'EXPIRED');
$tpKena = $candle($t0 - 3600, $tExp + 3600);
foreach ($tpKena as &$k) if ($k['time'] === $t0 - $t0 % 300 + 3600) $k['high'] = 85400; unset($k);
$h = qi_sig_nilai_satu($sig, $tpKena, 300, $sesudah);
cek('TP tersentuh di jendela → HIT TP, closed_at ISO UTC', ($h['status'] ?? '') === 'HIT TP 🎯' && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', (string)($h['closed_at'] ?? '')) === 1);
cek('tanpa data: dalam tenggang 24 jam → tetap AKTIF', qi_sig_kedaluwarsa_tanpa_data($sig, $tExp + 3600) === null);
$h = qi_sig_kedaluwarsa_tanpa_data($sig, $tExp + 86400 + 60);
cek('tanpa data: lewat tenggang → EXPIRED tanpa_data', ($h['status'] ?? '') === 'EXPIRED' && ($h['expiry_basis'] ?? '') === 'tanpa_data');
// Rekor lama tanpa zona: hasil hanya dicatat bila semua zona kandidat sepakat.
$lama = $sig; $lama['timestamp'] = '2026-10-13 11:41:01'; $lama['expiry'] = '2026-10-13 23:40:43';
$lebar = $candle($t0 - 12 * 3600, $tExp + 12 * 3600);
cek('rekor lama, semua zona sepakat → EXPIRED biasa', (qi_sig_nilai_lintas_zona($lama, $lebar, 300, $sesudah)['expiry_basis'] ?? '') === 'candle');
$sebagian = $lebar;   // SL kena 3 jam sebelum t0 (UTC) — masuk jendela hanya bila rekor dibaca sebagai WIB
foreach ($sebagian as &$k) if ($k['time'] === $t0 - $t0 % 300 - 3 * 3600) $k['low'] = 82000; unset($k);
$h = qi_sig_nilai_lintas_zona($lama, $sebagian, 300, $sesudah);
cek('rekor lama, zona tidak sepakat → EXPIRED zona_ambigu (bukan menang/kalah)', ($h['status'] ?? '') === 'EXPIRED' && ($h['expiry_basis'] ?? '') === 'zona_ambigu' && count($h['zona_hasil'] ?? []) >= 2);

echo "Statistik: EXPIRED bukan menang/kalah\n";
$rekor = [
    ['status' => 'HIT TP 🎯', 'side' => 'BUY', 'entry' => 100, 'sl' => 90, 'tp' => 125, 'exit_price' => 125, 'rr' => '1 : 2.50', 'pnl_usd' => 25, 'timestamp' => '2026-10-12 10:00:00'],
    ['status' => 'HIT SL 🛑', 'side' => 'BUY', 'entry' => 100, 'sl' => 90, 'tp' => 125, 'exit_price' => 90, 'rr' => '1 : 2.50', 'pnl_usd' => -10, 'timestamp' => '2026-10-13T10:00:00Z'],
    ['status' => 'EXPIRED', 'side' => 'BUY', 'entry' => 100, 'sl' => 90, 'tp' => 125, 'exit_price' => null, 'rr' => '1 : 2.50', 'pnl_usd' => 0, 'timestamp' => '2026-10-14T10:00:00Z', 'expiry_basis' => 'candle'],
    ['status' => 'AKTIF', 'side' => 'BUY', 'entry' => 100, 'sl' => 90, 'tp' => 125, 'rr' => '1 : 2.50', 'pnl_usd' => 0, 'timestamp' => '2026-10-15T10:00:00Z'],
];
$st = qi_signal_statistik($rekor);
cek('menang 1, kalah 1, kedaluwarsa 1, aktif 1', $st['menang'] === 1 && $st['kalah'] === 1 && $st['kedaluwarsa'] === 1 && $st['aktif'] === 1);
cek('win rate hanya dari TP/SL (50%)', abs((float)$st['win_rate'] - 50.0) < 0.01 || abs((float)$st['win_rate'] - 0.5) < 0.0001);
cek('R sinyal EXPIRED = null (belum_selesai)', qi_signal_r_satu($rekor[2])['r'] === null);
cek('drawdown hanya dari TP/SL', qi_signal_drawdown($rekor)['dinilai'] === 2);
// Urutan drawdown memakai epoch, bukan string: TP (ISO 08:00Z) terjadi SEBELUM SL (lama, 20:00 di
// zona mana pun yang mungkin), padahal strcmp menaruh "2026-10-13 20:00" sebelum "2026-10-13T08:00".
$tpIso = array_merge($rekor[0], ['id' => 'TP-1', 'timestamp' => '2026-10-13T08:00:00Z']);
$slLama = array_merge($rekor[1], ['id' => 'SL-1', 'timestamp' => '2026-10-13 20:00:00']);
cek('drawdown urut epoch walau format bercampur (puncak = TP)', qi_signal_drawdown([$slLama, $tpIso])['titik_puncak'] === 'TP-1');

echo "Pagar pencatatan & templat\n";
$kini = $utc('2026-10-16 08:00:00');
$riwayat = [['engine' => 'AUTO_SIGNAL', 'symbol' => 'BTCUSDT', 'side' => 'SELL', 'status' => 'EXPIRED', 'timestamp' => '2026-10-16T07:00:00Z']];
$p = qi_signal_cek_pagar($riwayat, 'BTCUSDT', 'BUY', 'AUTO_SIGNAL', $kini, 4, 20);
cek('cooldown dihitung dari timestamp ISO UTC', $p['alasan'] === 'cooldown_simbol' && $p['detail']['sisa_menit'] === 180);
cek('detail "terakhir" ditulis ISO UTC', $p['detail']['terakhir'] === '2026-10-16T07:00:00Z');
$riwayat[0]['status'] = 'AKTIF'; $riwayat[0]['side'] = 'BUY';
cek('sinyal AKTIF sejenis tetap menahan duplikat', qi_signal_cek_pagar($riwayat, 'BTCUSDT', 'BUY', 'AUTO_SIGNAL', $kini, 4, 20)['alasan'] === 'sudah_ada_sinyal_aktif_sejenis');
$riwayat[0]['status'] = 'EXPIRED';
cek('sinyal EXPIRED tidak menahan sinyal baru setelah cooldown', qi_signal_cek_pagar($riwayat, 'BTCUSDT', 'BUY', 'AUTO_SIGNAL', $kini + 5 * 3600, 4, 20)['boleh'] === true);
$r = qi_notif_ringkas(['symbol' => 'XAUUSD', 'side' => 'SELL', 'entry' => 2400, 'sl' => 2410, 'tp' => 2380, 'timestamp' => '2026-10-16T07:30:00Z']);
cek('templat notifikasi: waktu WIB + UTC', $r['waktu'] === '2026-10-16 14:30 WIB (07:30 UTC)');
if (!function_exists('mb_substr')) {
    echo "  - Discord embed dilewati (ekstensi mbstring tidak ada di PHP ini)
";
} else {
$dc = qi_notif_payload_discord(['symbol' => 'XAUUSD', 'side' => 'SELL', 'entry' => 2400, 'sl' => 2410, 'tp' => 2380, 'timestamp' => '2026-10-16T07:30:00Z']);
cek('Discord embed timestamp = saat sinyal (UTC)', ($dc['embeds'][0]['timestamp'] ?? '') === '2026-10-16T07:30:00+00:00');
}

echo $gagal === 0 ? "\nSemua uji lulus.\n" : "\n$gagal uji GAGAL.\n";
exit($gagal === 0 ? 0 : 1);
