<?php
/**
 * Quantum Institut — Live Signals API
 * Computes EMA20/50 cross + RSI14 + MACD histogram from real candle data
 *
 * KEJUJURAN DATA (audit sinyal 2026-10-22):
 *   · Candle SIMULASI tidak pernah dianalisa: timeframe itu dilaporkan NO_DATA beserta alasannya.
 *     Dulu load_candles() membuang penanda 'simulated' dan 'source', sehingga BULLISH/BEARISH
 *     dari candle acak terbit di endpoint publik ini tanpa tanda apa pun.
 *   · Setiap timeframe membawa 'source' (asal data) dan 'stale' + 'umur_detik' bila datanya
 *     cache lama (semua sumber gagal). Timeframe basi TIDAK ikut konsensus.
 *   · RSI 14 = Wilder atas SELURUH riwayat (qi_sp_rsi, sama dengan mesin lain); bar
 *     ber-rentang nol dibuang lebih dulu. Dulu 30 close terakhir dan 100 pada data datar.
 *   · Hanya simbol yang memang punya sumber data yang diterima.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_sinyal_pasar.php';
qi_rate_limit(60, 60);

$symbol    = isset($_GET['symbol'])    ? strtoupper(qi_sanitize_string($_GET['symbol'], 10))   : 'BTCUSDT';
$timeframe = isset($_GET['timeframe']) ? qi_sanitize_string($_GET['timeframe'], 5)             : 'D';
$engine    = isset($_GET['engine'])    ? strtoupper(qi_sanitize_string($_GET['engine'], 20))   : 'MULTI';

// Simbol yang punya sumber candle di api/get-chart-data.php (kripto Binance, emas, forex, indeks OANDA).
$DIDUKUNG = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'XAUUSD', 'XAGUSD',
             'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'GBPJPY', 'EURJPY',
             'EURGBP', 'AUDNZD', 'CHFJPY', 'CADJPY', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225', 'USOIL'];
if (!in_array($symbol, $DIDUKUNG, true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Simbol tidak didukung.', 'didukung' => $DIDUKUNG]);
    exit;
}

/**
 * Load candle data from get-chart-data.php (reuse its cache).
 * @return array{candles: array, simulated: bool, source: string, stale: bool, umur_detik: ?int}
 */
function load_candles(string $sym, string $interval): array {
    $cacheDir  = __DIR__ . '/../cache/chart';
    $cacheFile = $cacheDir . '/' . md5($sym . '_' . $interval) . '.json';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 300) {
        $d = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($d)) {
            return ['candles' => $d['candles'] ?? [], 'simulated' => !empty($d['simulated']), 'source' => (string)($d['source'] ?? ''),
                    'stale' => false, 'umur_detik' => time() - (int)filemtime($cacheFile)];
        }
    }
    // Call get-chart-data.php directly (define constant so it skips header/rate-limit)
    if (!defined('QI_INCLUDED_BY_SIGNALS')) define('QI_INCLUDED_BY_SIGNALS', true);
    ob_start();
    $_GET['symbol']   = $sym;
    $_GET['interval'] = $interval;
    include __DIR__ . '/get-chart-data.php';
    $raw = ob_get_clean();
    $d = json_decode((string)$raw, true);
    if (!is_array($d)) return ['candles' => [], 'simulated' => false, 'source' => '', 'stale' => false, 'umur_detik' => null];
    return ['candles' => $d['candles'] ?? [], 'simulated' => !empty($d['simulated']), 'source' => (string)($d['source'] ?? ''),
            'stale' => !empty($d['stale']), 'umur_detik' => isset($d['umur_detik']) ? (int)$d['umur_detik'] : null];
}

function calc_ema(array $closes, int $period): ?float {
    if (count($closes) < $period) return null;
    $k   = 2 / ($period + 1);
    $ema = array_sum(array_slice($closes, 0, $period)) / $period;
    for ($i = $period; $i < count($closes); $i++) $ema = $closes[$i] * $k + $ema * (1 - $k);
    return $ema;
}

/** RSI Wilder atas SELURUH deret — implementasi bersama qi_sp_rsi() (api/_sinyal_pasar.php). */
function calc_rsi(array $closes, int $period = 14): float {
    return qi_sp_rsi($closes, $period);
}

function calc_macd_hist(array $closes): float {
    if (count($closes) < 35) return 0;
    $macdSeries = [];
    for ($i = 26; $i <= count($closes); $i++) {
        $sl  = array_slice($closes, 0, $i);
        $e12 = calc_ema($sl, 12); $e26 = calc_ema($sl, 26);
        if ($e12 !== null && $e26 !== null) $macdSeries[] = $e12 - $e26;
    }
    $sig  = calc_ema($macdSeries, 9);
    $last = end($macdSeries);
    return $last - ($sig ?? 0);
}

function analyze(array $candles): array {
    // Bar ber-rentang nol (harga beku saat pasar tutup) bukan transaksi — dibuang dulu.
    $bersih = qi_sp_buang_datar($candles);
    if (count($bersih) < 55) return ['signal'=>'NO_DATA','rsi'=>50,'ema_cross'=>null,'macd'=>0];
    $closes = array_column($bersih, 'close');
    $last   = end($closes);
    $ema20  = calc_ema($closes, 20);
    $ema50  = calc_ema($closes, 50);
    $rsi    = calc_rsi($closes, 14);   // seluruh riwayat (dulu array_slice -30)
    $macdH  = calc_macd_hist(array_slice($closes, -60));

    $bull = 0; $bear = 0;
    if ($ema20 !== null && $ema50 !== null) {
        if ($ema20 > $ema50) $bull++; else $bear++;
        if ($last  > $ema20) $bull++; else $bear++;
    }
    if ($rsi  > 55) $bull++; elseif ($rsi  < 45) $bear++;
    if ($macdH > 0) $bull++; elseif ($macdH < 0) $bear++;

    $signal = $bull >= 3 ? 'BULLISH' : ($bear >= 3 ? 'BEARISH' : 'NEUTRAL');
    $akhir = end($candles);
    return [
        'signal'    => $signal,
        'rsi'       => round($rsi, 1),
        'ema20'     => $ema20 ? round($ema20, 5) : null,
        'ema50'     => $ema50 ? round($ema50, 5) : null,
        'ema_cross' => ($ema20 && $ema50) ? ($ema20 > $ema50 ? 'BULLISH' : 'BEARISH') : null,
        'macd_hist' => round($macdH, 6),
        'bull_pts'  => $bull,
        'bear_pts'  => $bear,
        'price'     => round((float)($akhir['close'] ?? $last), 5),
    ];
}

/** Hasil satu timeframe dari candle yang dimuat — simulasi ditolak, sumber & umur dilaporkan. */
function signals_tf(array $muat): array {
    $sumber = (string)($muat['source'] ?? '');
    if (!empty($muat['simulated'])) {
        return ['signal' => 'NO_DATA', 'rsi' => null, 'ema_cross' => null, 'macd' => null,
                'alasan' => 'data simulasi ditolak', 'source' => $sumber, 'dipakai_konsensus' => false];
    }
    $hasil = analyze((array)($muat['candles'] ?? []));
    $hasil['source'] = $sumber;
    if ($hasil['signal'] === 'NO_DATA') {
        $hasil['alasan'] = 'candle nyata tidak cukup';
        $hasil['dipakai_konsensus'] = false;
        return $hasil;
    }
    if (!empty($muat['stale'])) {
        // Cache lama dari saat semua sumber gagal: nilainya ditampilkan apa adanya, tetapi
        // tidak dihitung sebagai keadaan pasar SAAT INI.
        $hasil['stale'] = true;
        $hasil['umur_detik'] = $muat['umur_detik'] ?? null;
        $hasil['alasan'] = 'data basi (' . (int)round(((int)($muat['umur_detik'] ?? 0)) / 60) . ' menit) — tidak ikut konsensus';
        $hasil['dipakai_konsensus'] = false;
        return $hasil;
    }
    $hasil['dipakai_konsensus'] = true;
    return $hasil;
}

/** Konsensus hanya dari timeframe yang dipakai (bukan NO_DATA, bukan basi). */
function signals_konsensus(array $tf): string {
    $bull = 0; $bear = 0;
    foreach ($tf as $r) {
        if (empty($r['dipakai_konsensus'])) continue;
        if (($r['signal'] ?? '') === 'BULLISH') $bull++;
        if (($r['signal'] ?? '') === 'BEARISH') $bear++;
    }
    return $bull >= 3 ? 'BULLISH' : ($bear >= 3 ? 'BEARISH' : 'NEUTRAL');
}

// Compute signals for requested symbol across timeframes
$intervals = ['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'];
$tf_results = [];
foreach ($intervals as $iv => $label) {
    $tf_results[$label] = signals_tf(load_candles($symbol, (string)$iv));
}

// Overall consensus (hanya timeframe dengan data nyata & segar)
$overall = signals_konsensus($tf_results);
$dipakai = count(array_filter($tf_results, fn($r) => !empty($r['dipakai_konsensus'])));

echo json_encode([
    'status'     => 'success',
    'timestamp'  => date('Y-m-d H:i:s'),
    'timezone'   => date_default_timezone_get(),   // dulu tertulis WIB padahal server memakai UTC
    'symbol'     => $symbol,
    'overall'    => $overall,
    'tf_dipakai' => $dipakai,
    'catatan'    => $dipakai < count($intervals)
        ? ($dipakai . ' dari ' . count($intervals) . ' timeframe punya data nyata yang segar; sisanya tidak ikut konsensus (lihat alasan per timeframe).')
        : null,
    'timeframes' => $tf_results,
], JSON_PRETTY_PRINT);
