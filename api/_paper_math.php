<?php
/**
 * Perhitungan P/L paper trading — satu sumber kebenaran untuk sisi server.
 *
 * Nilai kontrak per 1 lot (multiplier) di sini HARUS identik dengan _pipMult() di
 * assets/js/pro-trading-tools.js. Bila keduanya berbeda, P/L mengambang yang dilihat
 * pengguna (dihitung di browser) tidak akan sama dengan P/L yang tersimpan saat posisi
 * ditutup (dihitung di server) — sebelumnya selisihnya sampai ribuan kali untuk forex.
 *
 *   P/L = (harga_keluar - harga_masuk) × lots × multiplier
 *
 * Model yang dipakai (1 lot = satuan kontrak berikut):
 *   XAUUSD  : 100     (100 oz  → $1 gerak harga = $100 per lot)
 *   EURUSD  : 100000  (100.000 unit → 100 pips = $1.000 per lot)
 *   BTCUSDT : 1       (1 BTC)
 *   lainnya : 1000    (default, mengikuti sisi klien)
 *
 * Catatan jujur: ini model yang disederhanakan — pasangan berkuota JPY seharusnya
 * dikonversi ke USD, dan default 1000 untuk semua simbol lain adalah konvensi aplikasi,
 * bukan spesifikasi broker. Tujuannya konsistensi antara tampilan dan data tersimpan.
 */

if (!function_exists('qi_paper_pip_mult')) {
    /**
     * Model P/L (1 lot). Kembaran JS: assets/js/qim-paper-math.js — keduanya diuji
     * sama oleh tests/paper-math.test.js. Pair berkuotasi USD = 100.000 unit; pair
     * berbasis USD (USDJPY/USDCHF/USDCAD) dikonversi ke USD pada $price (100.000/harga).
     * Tanpa $price, pair berbasis USD memakai konvensi lama 1000 (kompatibel ke belakang).
     */
    function qi_paper_pip_mult(string $symbol, ?float $price = null): float {
        $s = strtoupper(trim($symbol));
        if (substr($s, -4) === 'USDT') return 1.0;
        if (in_array($s, ['GBPUSD', 'AUDUSD', 'NZDUSD'], true)) return 100000.0;
        if (in_array($s, ['USDJPY', 'USDCHF', 'USDCAD'], true)) return ($price !== null && $price > 0) ? 100000.0 / $price : 1000.0;
        switch ($s) {
            case 'XAUUSD':  return 100.0;      // 100 oz per lot
            case 'BTCUSDT': return 1.0;        // 1 koin per lot
            case 'ETHUSDT': return 1.0;        // 1 koin per lot
            case 'SOLUSDT': return 1.0;        // 1 koin per lot
            case 'XRPUSDT': return 1.0;        // 1 koin per lot
            case 'BNBUSDT': return 1.0;        // 1 koin per lot
            case 'DOGEUSDT': return 1.0;       // 1 koin per lot
            case 'EURUSD':  return 100000.0;   // 100.000 unit per lot
            default:        return 1000.0;     // konvensi aplikasi, bukan spesifikasi broker
        }
    }
}

if (!function_exists('qi_paper_pnl')) {
    /**
     * @param string $symbol  simbol (mis. XAUUSD)
     * @param string $side    BUY atau SELL
     * @param float  $entry   harga masuk
     * @param float  $exit    harga keluar
     * @param float  $lots    volume dalam lot
     * @return float P/L dalam USD, dibulatkan 2 desimal
     */
    function qi_paper_pnl(string $symbol, string $side, float $entry, float $exit, float $lots): float {
        $diff = strtoupper(trim($side)) === 'BUY' ? ($exit - $entry) : ($entry - $exit);
        return round($diff * $lots * qi_paper_pip_mult($symbol, $exit), 2);
    }
}
