<?php
/**
 * WAKTU SINYAL — satu cara menulis dan membaca waktu di cache/signal_history.json.
 *
 * MASALAH LAMA: timestamp/expiry ditulis dengan date() TANPA zona, padahal zona bawaan
 * berbeda per titik masuk (php.ini Apache XAMPP: Europe/Berlin; php CLI tanpa php.ini:
 * UTC; Asia/Jakarta bila config/app.php dimuat). closed_at ditulis penilai dengan
 * gmdate() — UTC, juga tanpa zona. Satu string bisa berarti tiga saat yang berbeda, dan
 * dua titik masuk bisa membaca rekor yang sama secara berbeda.
 *
 * ATURAN SEKARANG:
 *  · TULIS: selalu ISO 8601 UTC berakhiran Z, lewat qi_sig_waktu_utc()
 *           → "2026-10-16T07:30:00Z". Dibaca benar oleh strtotime() dan new Date().
 *  · BACA : selalu lewat qi_sig_epoch(). String yang membawa zona (Z, +07:00, UTC)
 *           dibaca apa adanya. String LAMA tanpa zona:
 *             - closed_at        → UTC (penilai selalu memakai gmdate());
 *             - timestamp/expiry → zona QI_SIGNAL_TZ_LAMA bila didefinisikan, kalau tidak
 *               date.timezone dari php.ini (zona yang dipakai date() saat rekor ditulis),
 *               kalau tidak UTC.
 *           Zona bawaan runtime SENGAJA tidak dipakai: config/app.php menggantinya, dan
 *           ini_get('date.timezone') tidak ikut berubah oleh date_default_timezone_set().
 *
 * Teruji di tests/signal-time.test.php.
 */

if (!function_exists('qi_sig_waktu_utc')) :

/** Waktu sinyal untuk DITULIS: ISO 8601 UTC, mis. "2026-10-16T07:30:00Z". */
function qi_sig_waktu_utc(?int $epoch = null): string
{
    return gmdate('Y-m-d\TH:i:s\Z', $epoch ?? time());
}

/** Zona untuk membaca timestamp/expiry LAMA (tanpa zona). */
function qi_sig_zona_lama(?string $nama = null): DateTimeZone
{
    if ($nama === null) {
        $nama = defined('QI_SIGNAL_TZ_LAMA') ? (string)QI_SIGNAL_TZ_LAMA : (string)ini_get('date.timezone');
    }
    try {
        return new DateTimeZone($nama !== '' ? $nama : 'UTC');
    } catch (Throwable $e) {
        return new DateTimeZone('UTC');
    }
}

/** Apakah string waktu membawa zona/offset sendiri (Z, +07:00, +0700, UTC, GMT)? */
function qi_sig_punya_zona(string $s): bool
{
    return (bool)preg_match('/\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}(?::?\d{2})?|UTC|GMT)$/i', trim($s));
}

/**
 * Epoch Unix dari nilai waktu rekor sinyal, atau null bila kosong/tidak sah.
 * @param mixed       $nilai    string waktu (baru: ISO UTC; lama: 'Y-m-d H:i:s') atau epoch
 * @param string      $medan    nama field: 'closed_at' dibaca UTC bila tanpa zona
 * @param string|null $zonaLama paksa zona untuk string lama tanpa zona (untuk uji)
 */
function qi_sig_epoch($nilai, string $medan = 'timestamp', ?string $zonaLama = null): ?int
{
    if (is_int($nilai) || is_float($nilai)) return $nilai > 0 ? (int)$nilai : null;
    if (!is_string($nilai)) return null;
    $s = trim($nilai);
    if ($s === '') return null;
    if (ctype_digit($s)) return (int)$s > 0 ? (int)$s : null;
    // Hanya bentuk tanggal (+ jam) yang diterima — bukan kata relatif seperti "now"/"tomorrow".
    if (!preg_match('/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/', $s)) return null;
    try {
        if (qi_sig_punya_zona($s)) {
            $t = new DateTimeImmutable($s);
        } else {
            $zona = ($medan === 'closed_at') ? new DateTimeZone('UTC') : qi_sig_zona_lama($zonaLama);
            $t = new DateTimeImmutable($s, $zona);
        }
        $e = $t->getTimestamp();
        return $e > 0 ? $e : null;
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Jendela berlaku sinyal: ['terbit' => epoch, 'kedaluwarsa' => epoch], atau null bila
 * waktu terbit tidak terbaca. Expiry kosong/tidak masuk akal → terbit + 4 jam (cadangan
 * yang sama dipakai penilai dan bilah status).
 */
function qi_sig_jendela(array $sig, ?string $zonaLama = null): ?array
{
    $t0 = qi_sig_epoch($sig['timestamp'] ?? null, 'timestamp', $zonaLama);
    if ($t0 === null) return null;
    $tExp = qi_sig_epoch($sig['expiry'] ?? null, 'expiry', $zonaLama);
    if ($tExp === null || $tExp <= $t0) $tExp = $t0 + 4 * 3600;
    return ['terbit' => $t0, 'kedaluwarsa' => $tExp];
}

/**
 * Zona kandidat untuk MENILAI rekor: [null] bila timestamp & expiry sudah membawa zona
 * (tidak ambigu); kalau tidak, zona lama utama lebih dulu, lalu UTC dan zona tampilan
 * (WIB) — tiga zona yang terbukti pernah dipakai date() saat rekor lama ditulis.
 */
function qi_sig_zona_kandidat(array $sig): array
{
    $ts = (string)($sig['timestamp'] ?? '');
    $ex = (string)($sig['expiry'] ?? '');
    if (qi_sig_punya_zona($ts) && ($ex === '' || qi_sig_punya_zona($ex))) return [null];
    $zona = [qi_sig_zona_lama()->getName(), 'UTC', qi_sig_zona_tampil()->getName()];
    return array_values(array_unique($zona));
}

/** Zona tampilan untuk manusia (WIB bawaan; APP_TIMEZONE bila didefinisikan). */
function qi_sig_zona_tampil(): DateTimeZone
{
    try {
        return new DateTimeZone(defined('APP_TIMEZONE') ? (string)APP_TIMEZONE : 'Asia/Jakarta');
    } catch (Throwable $e) {
        return new DateTimeZone('Asia/Jakarta');
    }
}

/** Waktu untuk dibaca manusia tanpa ambigu, mis. "2026-10-16 14:30 WIB (07:30 UTC)". */
function qi_sig_waktu_tampil(?int $epoch): string
{
    if ($epoch === null || $epoch <= 0) return '—';
    $lokal = (new DateTimeImmutable('@' . $epoch))->setTimezone(qi_sig_zona_tampil());
    return $lokal->format('Y-m-d H:i T') . ' (' . gmdate('H:i', $epoch) . ' UTC)';
}

/** Jam (0–23) dalam zona tampilan (WIB) — sesi pasar di _sl_learn.php ditulis dalam WIB. */
function qi_sig_jam_tampil(?int $epoch): ?int
{
    if ($epoch === null || $epoch <= 0) return null;
    return (int)(new DateTimeImmutable('@' . $epoch))->setTimezone(qi_sig_zona_tampil())->format('G');
}

endif;
