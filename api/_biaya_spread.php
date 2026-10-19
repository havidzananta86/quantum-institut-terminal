<?php
/**
 * BIAYA SPREAD UNTUK PENILAIAN SINYAL
 *
 * MENGAPA: penilai TP/SL dulu memakai harga candle apa adanya, seolah-olah transaksi
 * bisa masuk dan keluar tanpa biaya. Di akun nyata posisi BUY dibuka di ASK dan ditutup
 * di BID (SELL sebaliknya), jadi:
 *   · TP yang hanya "disentuh" candle selisih kurang dari spread sebenarnya TIDAK kena;
 *   · SL lebih cepat kena (sisi penutup bergerak lebih dulu);
 *   · entry pasar membayar spread.
 * Tanpa ini, win rate dan expectancy di rekor selalu sedikit lebih bagus daripada yang
 * bisa didapat pengguna.
 *
 * MODEL (jujur, dicatat di setiap rekor):
 *   · spread = angka TIPIKAL per simbol (bukan spread historis saat itu — data itu tidak
 *     ada). Bisa diganti lewat define('QI_SPREAD_TABEL', ['XAUUSD' => 0.25, ...]) dan
 *     define('QI_SPREAD_KRIPTO_PERSEN', 0.1) di config/api_keys.php. Matikan seluruhnya
 *     (untuk perbandingan) dengan define('QI_SPREAD_AKTIF', false).
 *   · basis harga candle: feed broker MT5 = BID; sumber lain (OANDA, Binance, dll.) = MID.
 *     Dari situ: harga BID = candle + bid_off, ASK = candle + ask_off.
 */
declare(strict_types=1);

if (!function_exists('qi_spread_tipikal')) :

/** Spread tipikal akun retail (satuan harga). Kripto memakai persen harga (spread + komisi). */
function qi_spread_tabel_bawaan(): array
{
    return [
        'XAUUSD' => 0.30,   'XAGUSD' => 0.03,
        'EURUSD' => 0.00012, 'GBPUSD' => 0.00016, 'AUDUSD' => 0.00014, 'NZDUSD' => 0.00018,
        'USDCAD' => 0.00018, 'USDCHF' => 0.00016, 'EURGBP' => 0.00014,
        'USDJPY' => 0.014,  'EURJPY' => 0.020,  'GBPJPY' => 0.030,
    ];
}

/**
 * @return array{spread: float, basis: string}
 *   basis: 'tabel_tipikal' | 'kripto_persen' | 'perkiraan_umum' | 'dimatikan'
 */
function qi_spread_tipikal(string $simbol, float $harga): array
{
    if (defined('QI_SPREAD_AKTIF') && !QI_SPREAD_AKTIF) return ['spread' => 0.0, 'basis' => 'dimatikan'];
    $s = strtoupper(trim($simbol));
    $tabel = qi_spread_tabel_bawaan();
    if (defined('QI_SPREAD_TABEL') && is_array(QI_SPREAD_TABEL)) {
        $tabel = array_merge($tabel, array_change_key_case(QI_SPREAD_TABEL, CASE_UPPER));
    }
    if (isset($tabel[$s]) && is_numeric($tabel[$s])) return ['spread' => (float)$tabel[$s], 'basis' => 'tabel_tipikal'];
    if ($harga <= 0) return ['spread' => 0.0, 'basis' => 'perkiraan_umum'];
    if (preg_match('/(USDT|USDC|BUSD)$/', $s)) {
        $persen = defined('QI_SPREAD_KRIPTO_PERSEN') ? (float)QI_SPREAD_KRIPTO_PERSEN : 0.10;
        return ['spread' => round($harga * $persen / 100, 8), 'basis' => 'kripto_persen'];
    }
    return ['spread' => round($harga * 0.0002, 8), 'basis' => 'perkiraan_umum'];   // 0,02% harga
}

/** Basis harga candle dari label sumbernya. */
function qi_spread_basis_candle(string $sumber): string
{
    return stripos($sumber, 'mt5') !== false ? 'bid' : 'mid';
}

/**
 * Selisih dari harga candle ke harga yang bisa dieksekusi.
 * @return array{bid_off: float, ask_off: float}
 */
function qi_spread_offset(float $spread, string $basisCandle): array
{
    $spread = max(0.0, $spread);
    if ($basisCandle === 'bid') return ['bid_off' => 0.0, 'ask_off' => $spread];
    return ['bid_off' => -$spread / 2, 'ask_off' => $spread / 2];
}

/**
 * Lengkapi rekor dengan biaya spread SEBELUM dinilai. Spread yang sudah tercatat
 * dipertahankan (nilainya tetap, bisa diaudit); basis candle selalu mengikuti sumber
 * candle yang dipakai untuk memutuskan.
 */
function qi_spread_pasang(array $rek, string $sumberCandle): array
{
    if (!isset($rek['spread_biaya']) || !is_numeric($rek['spread_biaya'])) {
        $t = qi_spread_tipikal((string)($rek['symbol'] ?? ''), (float)($rek['entry'] ?? 0));
        $rek['spread_biaya'] = $t['spread'];
        $rek['spread_basis'] = $t['basis'];
    }
    $rek['harga_basis'] = qi_spread_basis_candle($sumberCandle);
    return $rek;
}

/** Offset untuk rekor yang sudah dipasangi qi_spread_pasang (0 bila belum). */
function qi_spread_offset_rekor(array $rek): array
{
    return qi_spread_offset((float)($rek['spread_biaya'] ?? 0), (string)($rek['harga_basis'] ?? 'mid'));
}

endif;
