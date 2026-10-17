<?php
/**
 * "KENAPA SINYAL INI?" — alasan terstruktur dari satu rekor sinyal.
 *
 * Hanya MERANGKUM bidang yang sudah tersimpan di rekor (basis, gerbang_mesin, ai_verdict,
 * news_context, confluence_score, mtf_aligned, invalidation). Tidak ada alasan yang dikarang:
 * bidang yang tidak ada di rekor tidak ditampilkan. Dipakai oleh api/sinyal-alasan.php
 * (UI) dan api/_notif.php (Discord/Slack/email/Telegram per pengguna).
 */

if (!function_exists('qi_sinyal_alasan')):

/** @return array{metode:?string,mesin:?array,ai:?array,berita:?string,konfluensi:?int,mtf:?bool,invalidasi:?string} */
function qi_sinyal_alasan(array $rek): array
{
    $basis = trim((string)($rek['basis'] ?? ''));
    // Basis lama menyertakan ringkasan verdict & gerbang di ekornya; bagian itu sudah punya bidang sendiri.
    $metode = $basis !== '' ? trim((string)preg_split('/\s*[.·]\s*(Verdict AI|gerbang mesin)\b/u', $basis)[0]) : '';

    $mesin = null;
    $gm = $rek['gerbang_mesin'] ?? null;
    if (is_array($gm) && isset($gm['jumlah_searah'])) {
        $mesin = [
            'arah'     => (string)($gm['arah'] ?? ''),
            'searah'   => (int)$gm['jumlah_searah'],
            'tersedia' => (int)($gm['tersedia'] ?? 0),
            'setuju'   => array_values(array_map('strval', (array)($gm['mesin_setuju'] ?? []))),
            'hitung'   => is_array($gm['hitung'] ?? null) ? $gm['hitung'] : null,
        ];
    } elseif (isset($rek['setuju_bull']) || isset($rek['setuju_bear'])) {
        $mesin = ['arah' => strtoupper((string)($rek['side'] ?? '')), 'searah' => (int)(strtoupper((string)($rek['side'] ?? '')) === 'SELL' ? ($rek['setuju_bear'] ?? 0) : ($rek['setuju_bull'] ?? 0)),
                  'tersedia' => null, 'setuju' => [], 'hitung' => null];
    }

    $ai = null;
    $v = $rek['ai_verdict'] ?? null;
    if (is_array($v) && !empty($v['action'])) {
        $ai = [
            'aksi'      => strtoupper((string)$v['action']),
            'keyakinan' => isset($v['confidence']) ? (int)$v['confidence'] : (isset($rek['ai_keyakinan']) ? (int)$rek['ai_keyakinan'] : null),
            'alasan'    => (string)($v['reason'] ?? $rek['ai_alasan'] ?? ''),
            'risiko'    => (string)($v['risiko'] ?? ''),
            'setuju'    => isset($rek['ai_setuju']) ? (bool)$rek['ai_setuju'] : (strtoupper((string)$v['action']) === strtoupper((string)($rek['side'] ?? ''))),
        ];
    }

    return [
        'metode'     => $metode !== '' ? $metode : null,
        'mesin'      => $mesin,
        'ai'         => $ai,
        'berita'     => !empty($rek['news_context']) ? (string)$rek['news_context'] : null,
        'konfluensi' => is_numeric($rek['confluence_score'] ?? null) ? (int)$rek['confluence_score'] : null,
        'mtf'        => isset($rek['mtf_aligned']) ? (bool)$rek['mtf_aligned'] : null,
        'invalidasi' => !empty($rek['invalidation']) ? (string)$rek['invalidation'] : null,
    ];
}

/** Ringkasan pendek (untuk notifikasi): maks. $maks baris teks polos. */
function qi_sinyal_alasan_baris(array $rek, int $maks = 4): array
{
    $a = qi_sinyal_alasan($rek);
    $baris = [];
    if ($a['mesin'] && $a['mesin']['searah'] > 0) {
        $baris[] = $a['mesin']['searah'] . ($a['mesin']['tersedia'] ? ' dari ' . $a['mesin']['tersedia'] : '') . ' mesin searah'
            . ($a['mesin']['setuju'] ? ' (' . implode(', ', array_slice($a['mesin']['setuju'], 0, 4)) . ')' : '');
    }
    if ($a['ai']) {
        $baris[] = 'AI: ' . $a['ai']['aksi'] . ($a['ai']['keyakinan'] !== null ? ' ' . $a['ai']['keyakinan'] . '%' : '')
            . ($a['ai']['alasan'] !== '' ? ' — ' . mb_strimwidth($a['ai']['alasan'], 0, 140, '…') : '');
    }
    if ($a['metode']) $baris[] = 'Metode: ' . mb_strimwidth($a['metode'], 0, 120, '…');
    if ($a['konfluensi'] !== null || $a['mtf'] !== null) {
        $baris[] = trim(($a['konfluensi'] !== null ? 'Konfluensi ' . $a['konfluensi'] . '/100' : '') . ($a['mtf'] !== null ? ($a['konfluensi'] !== null ? ' · ' : '') . ($a['mtf'] ? 'multi-timeframe selaras' : 'multi-timeframe belum selaras') : ''));
    }
    if ($a['berita']) $baris[] = 'Berita: ' . mb_strimwidth($a['berita'], 0, 90, '…');
    if ($a['invalidasi']) $baris[] = 'Batal bila: ' . mb_strimwidth($a['invalidasi'], 0, 90, '…');
    return array_slice($baris, 0, $maks);
}

endif;
