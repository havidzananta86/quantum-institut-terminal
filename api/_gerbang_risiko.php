<?php
/**
 * GERBANG RISIKO SEBELUM SINYAL RESMI TERBIT (dipanggil dari qi_signal_catat).
 *
 *   1. SPREAD HIDUP: bila spread broker saat ini (feed MT5 VPS) jauh di atas spread tipikal,
 *      sinyal ditahan. Spread melebar = pasar tipis / menjelang berita / rollover; entry di
 *      saat itu membayar mahal dan SL mudah tersapu. Data tidak tersedia → FAIL-OPEN (tidak
 *      menahan) dan dicatat jujur, sama seperti gerbang mesin.
 *   2. EKSPOSUR KORELASI: EURUSD BUY, GBPUSD BUY dan XAUUSD BUY adalah taruhan yang sama
 *      (USD melemah). Paling banyak QI_KORELASI_MAKS (bawaan 2) sinyal AKTIF per kelompok,
 *      lintas mesin. Kelompok memakai qi_ss_kunci_korelasi() yang sudah dipakai sinyal bayangan.
 *   3. BERITA PER MATA UANG: dipakai qi_berita_blackout(..., $simbol) — berita JPY tidak lagi
 *      menahan sinyal emas; berita USD menahan semua pasangan USD, emas, dan kripto.
 *
 * Fungsi keputusan MURNI (tanpa jaringan) supaya bisa diuji; pengambil spread hidup terpisah.
 */
declare(strict_types=1);

require_once __DIR__ . '/_biaya_spread.php';

if (!function_exists('qi_gr_mata_uang')) :

/** Mata uang yang menggerakkan sebuah simbol. Kripto & logam dihargai dalam USD. */
function qi_gr_mata_uang(string $simbol): array
{
    $s = strtoupper(trim($simbol));
    if (preg_match('/(USDT|USDC|BUSD)$/', $s)) return ['USD'];
    if (preg_match('/^(XAU|XAG|XPT|XPD)(USD)$/', $s)) return ['USD'];
    if (preg_match('/^([A-Z]{3})([A-Z]{3})$/', $s, $m)) return [$m[1], $m[2]];
    return [];   // tidak dikenal → pemanggil memperlakukan semua berita sebagai relevan
}

/** Apakah berita bermata uang $mataUang relevan untuk $simbol? Tidak yakin = relevan (konservatif). */
function qi_gr_berita_relevan(string $mataUang, string $simbol): bool
{
    $mu = strtoupper(trim($mataUang));
    $daftar = qi_gr_mata_uang($simbol);
    if ($daftar === [] || $mu === '' || $mu === '-' || $mu === 'ALL') return true;
    return in_array($mu, $daftar, true);
}

/**
 * Keputusan gerbang spread (murni).
 * @return array{lolos:bool, dinilai:bool, rasio:?float, tipikal:float, sekarang:?float, catatan:string}
 */
function qi_gr_cek_spread(string $simbol, ?float $spreadSekarang, float $harga, ?float $kali = null): array
{
    $kali = $kali ?? (defined('QI_SPREAD_GERBANG_KALI') ? (float)QI_SPREAD_GERBANG_KALI : 2.5);
    $tipikal = qi_spread_tipikal($simbol, $harga)['spread'];
    if ($spreadSekarang === null || $spreadSekarang <= 0 || $tipikal <= 0) {
        return ['lolos' => true, 'dinilai' => false, 'rasio' => null, 'tipikal' => $tipikal, 'sekarang' => $spreadSekarang,
                'catatan' => 'spread broker tidak tersedia — gerbang spread dilewati (fail-open)'];
    }
    $rasio = round($spreadSekarang / $tipikal, 2);
    $lolos = $rasio <= $kali;
    return ['lolos' => $lolos, 'dinilai' => true, 'rasio' => $rasio, 'tipikal' => $tipikal, 'sekarang' => $spreadSekarang,
            'catatan' => $lolos
                ? sprintf('spread %s = %.2f× tipikal', rtrim(rtrim(number_format($spreadSekarang, 6, '.', ''), '0'), '.'), $rasio)
                : sprintf('spread melebar %.2f× tipikal (batas %.1f×)', $rasio, $kali)];
}

/**
 * Keputusan gerbang korelasi (murni): hitung sinyal AKTIF sekelompok di riwayat resmi.
 * @return array{lolos:bool, kunci:string, aktif:int, maks:int, id_aktif:array}
 */
function qi_gr_cek_korelasi(array $history, string $simbol, string $arah, ?int $maks = null): array
{
    if (!function_exists('qi_ss_kunci_korelasi')) require_once __DIR__ . '/_setup_shadow.php';
    $maks = $maks ?? (defined('QI_KORELASI_MAKS') ? (int)QI_KORELASI_MAKS : 2);
    $kunci = qi_ss_kunci_korelasi($simbol, $arah);
    $id = [];
    foreach ($history as $r) {
        if (!is_array($r) || ($r['status'] ?? '') !== 'AKTIF') continue;
        if (qi_ss_kunci_korelasi((string)($r['symbol'] ?? ''), (string)($r['side'] ?? '')) === $kunci) $id[] = (string)($r['id'] ?? '?');
    }
    return ['lolos' => count($id) < $maks, 'kunci' => $kunci, 'aktif' => count($id), 'maks' => $maks, 'id_aktif' => $id];
}

/** Spread broker saat ini dari feed MT5 VPS, atau null (bridge mati / simbol tidak ada / pasar tutup). */
function qi_gr_spread_hidup(string $simbol): ?float
{
    if (!function_exists('qi_mt5_quotes')) return null;
    try {
        $q = qi_mt5_quotes([$simbol]);
        $t = $q[strtoupper($simbol)] ?? null;
        if (!is_array($t) || ($t['market'] ?? '') === 'closed') return null;
        $sp = (float)($t['spread'] ?? 0);
        return $sp > 0 ? $sp : null;
    } catch (Throwable $e) {
        return null;
    }
}

endif;
