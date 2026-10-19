<?php
/**
 * SINYAL YANG DITOLAK GERBANG — dicatat lalu dinilai seolah-olah diambil (kontrafaktual).
 *
 * MENGAPA: gerbang spread hidup, eksposur korelasi, berita per mata uang, dan gerbang mesin
 * menahan sinyal. Tanpa catatan ini kita tidak pernah tahu apakah gerbang itu MENOLONG
 * (sinyal yang ditolak lebih sering kalah) atau MERUGIKAN (justru membuang sinyal bagus).
 *
 *   · Hanya penolakan GERBANG yang dicatat (bukan cooldown / duplikat / jeda darurat).
 *   · Satu kandidat per simbol + arah + mesin + alasan per 4 jam (tidak membanjiri).
 *   · Dinilai dengan penilai YANG SAMA dengan rekor resmi (spread, gap, slippage, M1),
 *     oleh api/signal-evaluator.php. Tidak pernah tampil sebagai sinyal, tidak dinotifikasi.
 *   · Berkas: cache/sinyal_ditolak.json (maks 500), memakai kunci bersama api/_json_kunci.php.
 */
declare(strict_types=1);

require_once __DIR__ . '/_json_kunci.php';
require_once __DIR__ . '/_signal_time.php';

if (!function_exists('qi_ditolak_catat')) :

/** Alasan penolakan yang layak dinilai kontrafaktual. */
function qi_ditolak_alasan_dilacak(): array
{
    return ['spread_melebar', 'eksposur_korelasi', 'gerbang_mesin', 'blackout_berita'];
}

function qi_ditolak_berkas(): string
{
    return (string)($GLOBALS['qi_ditolak_berkas'] ?? (__DIR__ . '/../cache/sinyal_ditolak.json'));
}

/**
 * Catat satu kandidat yang ditolak. Gagal mencatat tidak pernah memengaruhi pemanggil.
 * @return bool true bila dicatat (false: alasan tidak dilacak, duplikat, level tidak sah, gagal tulis)
 */
function qi_ditolak_catat(array $rek, string $alasan, array $detail = [], ?int $kini = null): bool
{
    if (!in_array($alasan, qi_ditolak_alasan_dilacak(), true)) return false;
    $kini = $kini ?? time();
    $simbol = strtoupper((string)($rek['symbol'] ?? ''));
    $arah = strtoupper((string)($rek['side'] ?? ''));
    $entry = (float)($rek['entry'] ?? 0); $sl = (float)($rek['sl'] ?? 0); $tp = (float)($rek['tp'] ?? 0);
    if ($simbol === '' || !in_array($arah, ['BUY', 'SELL'], true) || $entry <= 0 || $sl <= 0 || $tp <= 0) return false;
    if ($arah === 'BUY' ? !($tp > $entry && $entry > $sl) : !($tp < $entry && $entry < $sl)) return false;
    $engine = strtoupper((string)($rek['engine'] ?? '?'));

    $calon = [
        'id'           => 'TLK-' . gmdate('Ymd', $kini) . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
        'timestamp'    => qi_sig_waktu_utc($kini),
        'expiry'       => isset($rek['expiry']) ? (string)$rek['expiry'] : qi_sig_waktu_utc($kini + 12 * 3600),
        'symbol'       => $simbol,
        'side'         => $arah,
        'engine'       => $engine,
        'timeframe'    => (string)($rek['timeframe'] ?? 'MTF'),
        'entry'        => $entry, 'sl' => $sl, 'tp' => $tp,
        'atr'          => isset($rek['atr']) ? (float)$rek['atr'] : null,
        'status'       => 'AKTIF',
        'alasan_tolak' => $alasan,
        'detail_tolak' => array_slice($detail, 0, 8, true),
        'id_asal'      => (string)($rek['id'] ?? ''),
    ];
    try {
        $u = qi_json_ubah(qi_ditolak_berkas(), function (array $d) use ($calon, $kini): ?array {
            foreach ($d as $r) {
                if (($r['symbol'] ?? '') === $calon['symbol'] && ($r['side'] ?? '') === $calon['side']
                    && ($r['engine'] ?? '') === $calon['engine'] && ($r['alasan_tolak'] ?? '') === $calon['alasan_tolak']
                    && ($kini - (int)qi_sig_epoch($r['timestamp'] ?? null)) < 4 * 3600) {
                    return null;   // sudah ada kandidat sejenis dalam 4 jam
                }
            }
            array_unshift($d, $calon);
            return array_slice($d, 0, 500);
        }, ['tunggu' => 2.0]);
        return $u['ok'] && $u['alasan'] === 'ok';
    } catch (Throwable $e) {
        @error_log('[sinyal-ditolak] gagal mencatat: ' . $e->getMessage());
        return false;
    }
}

/**
 * Ringkasan per alasan: apakah sinyal yang ditolak gerbang ternyata lebih buruk?
 * Expectancy NEGATIF pada kandidat yang ditolak = gerbang menolong.
 */
function qi_ditolak_ringkas(array $daftar): array
{
    if (!function_exists('qi_signal_statistik_per')) require_once __DIR__ . '/_signal_stats.php';
    $per = qi_signal_statistik_per($daftar, fn($r) => (string)($r['alasan_tolak'] ?? '?'));
    foreach ($per as &$g) {
        $g['tafsiran'] = !$g['dinilai'] ? 'belum ada yang tertutup'
            : (!$g['cukup_sampel'] ? 'sampel masih kecil — belum bisa disimpulkan'
            : (($g['expectancy_r'] ?? 0) < 0 ? 'gerbang menolong: kandidat yang ditolak rata-rata rugi'
            : 'perlu ditinjau: kandidat yang ditolak rata-rata untung'));
    }
    unset($g);
    return ['total' => count($daftar), 'per_alasan' => $per,
            'catatan' => 'Kandidat yang ditolak gerbang dinilai seolah-olah diambil, dengan penilai yang sama (spread, gap, slippage). Bukan sinyal, tidak dinotifikasi.'];
}

endif;
