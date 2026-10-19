<?php
/**
 * KUNCI BERSAMA UNTUK BERKAS REKOR JSON (baca → ubah → tulis)
 *
 * MENGAPA: file_put_contents(..., LOCK_EX) hanya mengunci SAAT MENULIS. Pola
 * "baca berkas, ubah, tulis ulang" tetap balapan: dua proses membaca isi yang sama,
 * lalu tulisan yang belakangan menghapus perubahan yang duluan. Untuk riwayat sinyal
 * itu berarti rekor hilang tanpa jejak — misalnya evaluator (yang mengambil candle
 * beberapa detik) menimpa sinyal baru yang tercatat di tengah jalan.
 *
 * Aturan kunci di sini SAMA dengan yang sudah dipakai _signal_record.php sejak awal
 * ("<berkas>.lock" dibuat dengan fopen 'x'), sehingga semua penulis saling menunggu:
 *   · klaim atomik dengan fopen 'x' (bukan flock: flock blocking di PHP/Apache Windows
 *     terbukti macet > 60 detik, lihat get-chart-data.php);
 *   · kunci basi (proses mati) dibuang setelah $basi detik;
 *   · kunci berisi token acak — pelepasan hanya menghapus kunci MILIKNYA sendiri, jadi
 *     proses lambat yang kuncinya sudah dianggap basi tidak menghapus kunci penulis baru.
 */
declare(strict_types=1);

if (!function_exists('qi_kunci_ambil')) :

/**
 * Klaim kunci "<berkas>.lock". Menunggu paling lama $tunggu detik.
 * @return string|null token pemilik (untuk qi_kunci_lepas), null bila gagal
 */
function qi_kunci_ambil(string $berkas, float $tunggu = 5.0, int $basi = 20): ?string
{
    $lock = $berkas . '.lock';
    $batas = microtime(true) + max(0.0, $tunggu);
    $token = bin2hex(random_bytes(8));
    do {
        $fp = @fopen($lock, 'x');
        if ($fp !== false) {
            @fwrite($fp, $token);
            @fclose($fp);
            return $token;
        }
        clearstatcache(true, $lock);
        if (is_file($lock) && (time() - (int)@filemtime($lock)) > $basi) {
            @unlink($lock);                   // kunci basi: pemiliknya sudah mati
            continue;
        }
        if (microtime(true) >= $batas) return null;
        usleep(50000);
    } while (true);
}

/** Lepas kunci — hanya bila kunci itu masih milik token ini. */
function qi_kunci_lepas(string $berkas, ?string $token): void
{
    if ($token === null) return;
    $lock = $berkas . '.lock';
    clearstatcache(true, $lock);
    if (is_file($lock) && trim((string)@file_get_contents($lock)) === $token) @unlink($lock);
}

/** Baca berkas JSON array; [] bila tidak ada atau rusak. */
function qi_json_baca(string $berkas): array
{
    clearstatcache(true, $berkas);
    if (!is_file($berkas)) return [];
    $d = json_decode((string)@file_get_contents($berkas), true);
    return is_array($d) ? $d : [];
}

/**
 * Tulis JSON (lihat qi_tulis_atomik). Ditulis ke berkas sementara lalu rename (pembaca tidak pernah melihat
 * berkas setengah jadi); bila rename gagal (Windows: berkas sedang dibuka pembaca),
 * jatuh ke tulis langsung dengan LOCK_EX seperti perilaku lama.
 */
function qi_json_tulis(string $berkas, array $data, int $flags = JSON_PRETTY_PRINT): bool
{
    $isi = json_encode($data, $flags);
    return $isi !== false && qi_tulis_atomik($berkas, $isi);
}

/** Tulis teks secara atomik (sementara + rename; cadangan: tulis langsung LOCK_EX). */
function qi_tulis_atomik(string $berkas, string $isi): bool
{
    $tmp = $berkas . '.tmp.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $isi) !== false) {
        if (@rename($tmp, $berkas)) return true;
        @unlink($tmp);
    }
    return @file_put_contents($berkas, $isi, LOCK_EX) !== false;
}

/**
 * Baca → ubah → tulis di bawah satu kunci.
 *
 * $ubah menerima isi berkas (array) dan mengembalikan array baru, atau null bila tidak
 * ada yang perlu ditulis.
 *
 * Opsi: tunggu (detik, bawaan 5), basi (detik, bawaan 20), cadangan (path salinan
 * sebelum menulis), flags (json_encode).
 *
 * @return array{ok:bool, alasan:string, data:array}
 */
function qi_json_ubah(string $berkas, callable $ubah, array $opsi = []): array
{
    $token = qi_kunci_ambil($berkas, (float)($opsi['tunggu'] ?? 5.0), (int)($opsi['basi'] ?? 20));
    if ($token === null) return ['ok' => false, 'alasan' => 'sedang_menulis', 'data' => []];
    try {
        $lama = qi_json_baca($berkas);
        $baru = $ubah($lama);
        if ($baru === null) return ['ok' => true, 'alasan' => 'tanpa_perubahan', 'data' => $lama];
        if (!empty($opsi['cadangan']) && is_file($berkas)) @copy($berkas, (string)$opsi['cadangan']);
        $ok = qi_json_tulis($berkas, $baru, (int)($opsi['flags'] ?? JSON_PRETTY_PRINT));
        return ['ok' => $ok, 'alasan' => $ok ? 'ok' : 'gagal_menulis', 'data' => $baru];
    } finally {
        qi_kunci_lepas($berkas, $token);
    }
}

endif;
