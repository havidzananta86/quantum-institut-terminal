<?php
/**
 * Quantum Institut — Live Signals API
 * Computes EMA20/50 cross + RSI14 + MACD histogram from real candle data
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$symbol    = isset($_GET['symbol'])    ? strtoupper(qi_sanitize_string($_GET['symbol'], 10))   : 'BTCUSDT';
$timeframe = isset($_GET['timeframe']) ? qi_sanitize_string($_GET['timeframe'], 5)             : 'D';
$engine    = isset($_GET['engine'])    ? strtoupper(qi_sanitize_string($_GET['engine'], 20))   : 'MULTI';

// Load candle data from get-chart-data.php (reuse its cache)
function load_candles(string $sym, string $interval): array {
    $cacheDir  = __DIR__ . '/../cache/chart';
    $cacheFile = $cacheDir . '/' . md5($sym . '_' . $interval) . '.json';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 300) {
        $d = json_decode(file_get_contents($cacheFile), true);
        return $d['candles'] ?? [];
    }
    // Call get-chart-data.php directly
    ob_start();
    $_GET['symbol']   = $sym;
    $_GET['interval'] = $interval;
    include __DIR__ . '/get-chart-data.php';
    $raw = ob_get_clean();
    $d = json_decode($raw, true);
    return $d['candles'] ?? [];
}

function calc_ema(array $closes, int $period): ?float {
    if (count($closes) < $period) return null;
    $k   = 2 / ($period + 1);
    $ema = array_sum(array_slice($closes, 0, $period)) / $period;
    for ($i = $period; $i < count($closes); $i++) $ema = $closes[$i] * $k + $ema * (1 - $k);
    return $ema;
}

function calc_rsi(array $closes, int $period = 14): float {
    $n = count($closes);
    if ($n < $period + 1) return 50.0;
    $avgGain = 0; $avgLoss = 0;
    for ($i = 1; $i <= $period; $i++) {
        $d = $closes[$i] - $closes[$i - 1];
        if ($d > 0) $avgGain += $d; else $avgLoss -= $d;
    }
    $avgGain /= $period; $avgLoss /= $period;
    for ($i = $period + 1; $i < $n; $i++) {
        $d = $closes[$i] - $closes[$i - 1];
        $avgGain = ($avgGain * ($period - 1) + max(0, $d)) / $period;
        $avgLoss = ($avgLoss * ($period - 1) + max(0, -$d)) / $period;
    }
    return $avgLoss == 0 ? 100 : 100 - 100 / (1 + $avgGain / $avgLoss);
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
    if (count($candles) < 55) return ['signal'=>'NO_DATA','rsi'=>50,'ema_cross'=>null,'macd'=>0];
    $closes = array_column($candles, 'close');
    $last   = end($closes);
    $ema20  = calc_ema($closes, 20);
    $ema50  = calc_ema($closes, 50);
    $rsi    = calc_rsi(array_slice($closes, -30), 14);
    $macdH  = calc_macd_hist(array_slice($closes, -60));

    $bull = 0; $bear = 0;
    if ($ema20 !== null && $ema50 !== null) {
        if ($ema20 > $ema50) $bull++; else $bear++;
        if ($last  > $ema20) $bull++; else $bear++;
    }
    if ($rsi  > 55) $bull++; elseif ($rsi  < 45) $bear++;
    if ($macdH > 0) $bull++; elseif ($macdH < 0) $bear++;

    $signal = $bull >= 3 ? 'BULLISH' : ($bear >= 3 ? 'BEARISH' : 'NEUTRAL');
    return [
        'signal'    => $signal,
        'rsi'       => round($rsi, 1),
        'ema20'     => $ema20 ? round($ema20, 5) : null,
        'ema50'     => $ema50 ? round($ema50, 5) : null,
        'ema_cross' => ($ema20 && $ema50) ? ($ema20 > $ema50 ? 'BULLISH' : 'BEARISH') : null,
        'macd_hist' => round($macdH, 6),
        'bull_pts'  => $bull,
        'bear_pts'  => $bear,
        'price'     => round((float)$last, 5),
    ];
}

// Compute signals for requested symbol across timeframes
$intervals = ['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'];
$tf_results = [];
foreach ($intervals as $iv => $label) {
    $candles = load_candles($symbol, $iv);
    $tf_results[$label] = analyze($candles);
}

// Overall consensus
$bullCount = array_filter($tf_results, fn($r) => $r['signal'] === 'BULLISH');
$bearCount = array_filter($tf_results, fn($r) => $r['signal'] === 'BEARISH');
$overall = count($bullCount) >= 3 ? 'BULLISH' : (count($bearCount) >= 3 ? 'BEARISH' : 'NEUTRAL');

echo json_encode([
    'status'     => 'success',
    'timestamp'  => date('Y-m-d H:i:s'),
    'timezone'   => 'Asia/Jakarta (WIB)',
    'symbol'     => $symbol,
    'overall'    => $overall,
    'timeframes' => $tf_results,
], JSON_PRETTY_PRINT);
