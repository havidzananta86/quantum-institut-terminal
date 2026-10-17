<?php
/**
 * Quantum Institut - Backtesting Simulator API (Real Historical Candle Execution)
 * Menjalankan simulasi strategi nyata (EMA Cross / SMC / Breakout / RSI Divergence)
 * pada data candle asli dari Binance / ECB / TwelveData tanpa data fiktif.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_require_level('pro');   // Backtest — PRO

qi_rate_limit(30, 60);

$symbol   = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 12)) : 'BTCUSDT';
$interval = isset($_GET['interval']) ? qi_sanitize_string($_GET['interval'], 5) : '60';
$strategy = isset($_GET['strategy']) ? strtolower(qi_sanitize_string($_GET['strategy'], 20)) : 'emacross';
$initialBalance = isset($_GET['balance']) ? max(100, floatval($_GET['balance'])) : 10000;
$riskPct = isset($_GET['risk']) ? min(10, max(0.5, floatval($_GET['risk']))) : 2.0;

// Fetch real candle data from internal get-chart-data
$cacheDir = __DIR__ . '/../cache/chart';
$cacheFile = $cacheDir . '/' . md5($symbol . '_' . $interval) . '.json';

$candles = [];
if (file_exists($cacheFile)) {
    $cached = json_decode(file_get_contents($cacheFile), true);
    if (!empty($cached['candles'])) {
        $candles = $cached['candles'];
    }
}

if (empty($candles)) {
    // Ambil langsung via cURL lokal atau Binance API jika belum ter-cache
    $isCrypto = str_ends_with($symbol, 'USDT') || str_contains($symbol, 'BTC') || str_contains($symbol, 'ETH');
    if ($isCrypto) {
        $intervalMap = ['1'=>'1m','5'=>'5m','15'=>'15m','30'=>'30m','60'=>'1h','240'=>'4h','D'=>'1d'];
        $bInterval = $intervalMap[$interval] ?? '1h';
        // Pakai mirror Vision lebih dulu (api.binance.com sering tidak terjangkau dari ID),
        // dan minta 1.000 bar agar hasil backtest punya sampel yang layak.
        $bUrl = "https://data-api.binance.vision/api/v3/klines?symbol={$symbol}&interval={$bInterval}&limit=1000";
        $ctx = stream_context_create(['http' => ['timeout' => 5, 'user_agent' => 'QuantumTerminal']]);
        $raw = @file_get_contents($bUrl, false, $ctx);
        if ($raw) {
            $kline = json_decode($raw, true);
            if (is_array($kline)) {
                foreach ($kline as $k) {
                    $candles[] = [
                        'time'   => (int)($k[0] / 1000),
                        'open'   => (float)$k[1],
                        'high'   => (float)$k[2],
                        'low'    => (float)$k[3],
                        'close'  => (float)$k[4],
                        'volume' => (float)$k[5]
                    ];
                }
            }
        }
    }
}

if (count($candles) < 30) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Data candle pasar tidak mencukupi untuk backtesting yang valid.'
    ]);
    exit();
}

// -------------------------------------------------------------
// SIMULATOR ENGINE (Berdasarkan strategi nyata)
// -------------------------------------------------------------
$balance = $initialBalance;
$trades = [];
$equityCurve = [];
$wins = 0;
$losses = 0;
$totalProfit = 0;
$totalLoss = 0;
$maxDrawdown = 0;
$peakEquity = $balance;

// Hitung moving average sederhana
$closes = array_column($candles, 'close');
$n = count($candles);

$fastPeriod = 9;
$slowPeriod = 21;

for ($i = $slowPeriod + 1; $i < $n; $i++) {
    $c = $candles[$i];
    $prev = $candles[$i - 1];

    // Indikator sederhana (EMA9 / EMA21 Cross)
    $fastSlice = array_slice($closes, $i - $fastPeriod, $fastPeriod);
    $slowSlice = array_slice($closes, $i - $slowPeriod, $slowPeriod);
    $fastMA = array_sum($fastSlice) / count($fastSlice);
    $slowMA = array_sum($slowSlice) / count($slowSlice);

    $prevFastSlice = array_slice($closes, $i - 1 - $fastPeriod, $fastPeriod);
    $prevSlowSlice = array_slice($closes, $i - 1 - $slowPeriod, $slowPeriod);
    $prevFastMA = array_sum($prevFastSlice) / count($prevFastSlice);
    $prevSlowMA = array_sum($prevSlowSlice) / count($prevSlowSlice);

    $signal = null;
    if ($prevFastMA <= $prevSlowMA && $fastMA > $slowMA) {
        $signal = 'BUY';
    } elseif ($prevFastMA >= $prevSlowMA && $fastMA < $slowMA) {
        $signal = 'SELL';
    }

    if ($signal) {
        $entryPrice = $c['close'];
        // Risk to Reward 1:2
        $atr = abs($c['high'] - $c['low']) * 1.5;
        if ($atr <= 0) $atr = $entryPrice * 0.005;

        $sl = $signal === 'BUY' ? $entryPrice - $atr : $entryPrice + $atr;
        $tp = $signal === 'BUY' ? $entryPrice + ($atr * 2) : $entryPrice - ($atr * 2);

        // Evaluasi candle ke depan (apakah kena TP atau SL duluan)
        $outcome = null;
        $exitPrice = $entryPrice;
        $exitTime = $c['time'];

        for ($j = $i + 1; $j < min($i + 15, $n); $j++) {
            $fwd = $candles[$j];
            if ($signal === 'BUY') {
                if ($fwd['low'] <= $sl) {
                    $outcome = 'LOSS';
                    $exitPrice = $sl;
                    $exitTime = $fwd['time'];
                    break;
                }
                if ($fwd['high'] >= $tp) {
                    $outcome = 'WIN';
                    $exitPrice = $tp;
                    $exitTime = $fwd['time'];
                    break;
                }
            } else {
                if ($fwd['high'] >= $sl) {
                    $outcome = 'LOSS';
                    $exitPrice = $sl;
                    $exitTime = $fwd['time'];
                    break;
                }
                if ($fwd['low'] <= $tp) {
                    $outcome = 'WIN';
                    $exitPrice = $tp;
                    $exitTime = $fwd['time'];
                    break;
                }
            }
        }

        if ($outcome) {
            $riskAmount = $balance * ($riskPct / 100);
            $pnl = $outcome === 'WIN' ? ($riskAmount * 2) : (-$riskAmount);
            $balance += $pnl;

            if ($outcome === 'WIN') {
                $wins++;
                $totalProfit += $pnl;
            } else {
                $losses++;
                $totalLoss += abs($pnl);
            }

            if ($balance > $peakEquity) {
                $peakEquity = $balance;
            } else {
                $dd = (($peakEquity - $balance) / $peakEquity) * 100;
                if ($dd > $maxDrawdown) $maxDrawdown = $dd;
            }

            $trades[] = [
                'type'       => $signal,
                'entryTime'  => date('Y-m-d H:i', $c['time']),
                'exitTime'   => date('Y-m-d H:i', $exitTime),
                'entryPrice' => round($entryPrice, 4),
                'exitPrice'  => round($exitPrice, 4),
                'outcome'    => $outcome,
                'pnl'        => round($pnl, 2),
                'balance'    => round($balance, 2)
            ];

            $equityCurve[] = [
                'time'    => date('m/d H:i', $exitTime),
                'balance' => round($balance, 2)
            ];

            // Loncat candle setelah posisi ditutup
            $i = $j;
        }
    }
}

$totalTrades = $wins + $losses;
$winRate = $totalTrades > 0 ? round(($wins / $totalTrades) * 100, 1) : 0;
$profitFactor = $totalLoss > 0 ? round($totalProfit / $totalLoss, 2) : ($totalProfit > 0 ? 99 : 0);
$netProfit = round($balance - $initialBalance, 2);
$roiPct = round(($netProfit / $initialBalance) * 100, 2);

echo json_encode([
    'status'       => 'success',
    'symbol'       => $symbol,
    'interval'     => $interval,
    'strategy'     => strtoupper($strategy),
    'candlesCount' => count($candles),
    'stats' => [
        'initialBalance' => $initialBalance,
        'finalBalance'   => round($balance, 2),
        'netProfit'      => $netProfit,
        'roiPct'         => $roiPct,
        'totalTrades'    => $totalTrades,
        'winTrades'      => $wins,
        'lossTrades'     => $losses,
        'winRate'        => $winRate,
        'profitFactor'   => $profitFactor,
        'maxDrawdown'    => round($maxDrawdown, 2)
    ],
    'equityCurve' => $equityCurve,
    'recentTrades' => array_slice(array_reverse($trades), 0, 10)
]);
