<?php
/**
 * Quantum Terminal — canonical signal engine.
 *
 * This file is deliberately kept independent from HTTP so the evaluator,
 * dashboard API, and future MT5 worker can use exactly the same calculations.
 * Confirmed signals must be called with the last still-forming candle removed.
 */
declare(strict_types=1);

if (!defined('QT_SIGNAL_ENGINE_VERSION')) define('QT_SIGNAL_ENGINE_VERSION', 'qt-signal-v2.3');

function qt_signal_ema(array $values, int $period): ?float
{
    if ($period < 1 || count($values) < $period) return null;
    $values = array_values(array_map('floatval', $values));
    $ema = array_sum(array_slice($values, 0, $period)) / $period;
    $k = 2 / ($period + 1);
    for ($i = $period; $i < count($values); $i++) $ema = $values[$i] * $k + $ema * (1 - $k);
    return is_finite($ema) ? $ema : null;
}

function qt_signal_ema_series(array $values, int $period): array
{
    $out = array_fill(0, count($values), null);
    if ($period < 1 || count($values) < $period) return $out;
    $values = array_values(array_map('floatval', $values));
    $k = 2 / ($period + 1);
    $ema = array_sum(array_slice($values, 0, $period)) / $period;
    $out[$period - 1] = $ema;
    for ($i = $period; $i < count($values); $i++) {
        $ema = $values[$i] * $k + $ema * (1 - $k);
        $out[$i] = $ema;
    }
    return $out;
}

function qt_signal_rsi(array $values, int $period = 14): ?float
{
    if ($period < 1 || count($values) <= $period) return null;
    $values = array_values(array_map('floatval', $values));
    $gain = 0.0; $loss = 0.0;
    for ($i = 1; $i <= $period; $i++) {
        $change = $values[$i] - $values[$i - 1];
        if ($change >= 0) $gain += $change; else $loss -= $change;
    }
    $gain /= $period; $loss /= $period;
    for ($i = $period + 1; $i < count($values); $i++) {
        $change = $values[$i] - $values[$i - 1];
        $gain = ($gain * ($period - 1) + max(0.0, $change)) / $period;
        $loss = ($loss * ($period - 1) + max(0.0, -$change)) / $period;
    }
    if ($loss == 0.0) return 100.0;
    $result = 100 - 100 / (1 + $gain / $loss);
    return is_finite($result) ? $result : null;
}

function qt_signal_macd_histogram(array $values): ?float
{
    if (count($values) < 40) return null;
    $fast = qt_signal_ema_series($values, 12);
    $slow = qt_signal_ema_series($values, 26);
    $line = [];
    for ($i = 0; $i < count($values); $i++) {
        if ($fast[$i] !== null && $slow[$i] !== null) $line[] = $fast[$i] - $slow[$i];
    }
    if (count($line) < 9) return null;
    $signal = qt_signal_ema($line, 9);
    if ($signal === null) return null;
    $result = $line[count($line) - 1] - $signal;
    return is_finite($result) ? $result : null;
}

function qt_signal_atr(array $candles, int $period = 14): ?float
{
    if ($period < 1 || count($candles) <= $period) return null;
    $ranges = [];
    for ($i = 1; $i < count($candles); $i++) {
        $current = $candles[$i]; $previous = $candles[$i - 1];
        $ranges[] = max(
            (float)$current['high'] - (float)$current['low'],
            abs((float)$current['high'] - (float)$previous['close']),
            abs((float)$current['low'] - (float)$previous['close'])
        );
    }
    $recent = array_slice($ranges, -$period);
    if (count($recent) < $period) return null;
    $result = array_sum($recent) / $period;
    return is_finite($result) ? $result : null;
}

function qt_signal_volatility(array $candles, int $period = 14): array
{
    if (count($candles) <= $period + 4) return ['label' => 'Belum cukup', 'ratio' => null, 'atr' => null];
    $ranges = [];
    for ($i = 1; $i < count($candles); $i++) {
        $current = $candles[$i]; $previous = $candles[$i - 1];
        $ranges[] = max(
            (float)$current['high'] - (float)$current['low'],
            abs((float)$current['high'] - (float)$previous['close']),
            abs((float)$current['low'] - (float)$previous['close'])
        );
    }
    $recent = array_slice($ranges, -$period);
    $baseline = array_slice($ranges, 0, -$period);
    $currentAtr = array_sum($recent) / max(1, count($recent));
    $base = $baseline ?: $ranges;
    $baselineAtr = array_sum($base) / max(1, count($base));
    $ratio = $baselineAtr > 0 ? $currentAtr / $baselineAtr : null;
    return [
        'label' => !is_finite((float)$ratio) ? 'Belum cukup' : ($ratio >= 1.35 ? 'Tinggi' : ($ratio <= .75 ? 'Rendah' : 'Normal')),
        'ratio' => is_finite((float)$ratio) ? $ratio : null,
        'atr' => $currentAtr,
    ];
}

/**
 * Calculate the signal from closed candles using the same thresholds as the
 * dashboard. `$options['indicators']` may contain ema/rsi/macd booleans.
 */
function qt_signal_analyze(array $candles, array $options = []): array
{
    $indicators = is_array($options['indicators'] ?? null) ? $options['indicators'] : [];
    $enabled = [
        'ema' => ($indicators['ema'] ?? true) !== false,
        'rsi' => ($indicators['rsi'] ?? true) !== false,
        'macd' => ($indicators['macd'] ?? true) !== false,
    ];
    $source = (string)($options['source'] ?? 'Chart feed');
    $count = count($candles);
    if ($count < 55) {
        return [
            'side' => 'WAIT', 'signal' => 'NO_DATA', 'current' => null, 'entry' => null, 'sl' => null, 'tp' => null,
            'rr' => null, 'atr' => null, 'rsi' => 50.0, 'ema20' => null, 'ema50' => null, 'macd' => null,
            'bull' => 0, 'bear' => 0, 'required' => 0, 'confidence' => 0,
            'reason' => 'Data historis belum cukup untuk menghitung signal.', 'basis' => [],
            'candleTime' => null, 'source' => $source,
            'quality' => ['agreement' => 0, 'activeCount' => 0, 'mtfRatio' => null, 'score' => 0, 'volatility' => 'Belum cukup', 'volatilityRatio' => null, 'market' => 'Belum cukup'],
        ];
    }
    $closes = array_values(array_map(static fn($c): float => (float)$c['close'], $candles));
    $last = $candles[$count - 1];
    $current = $closes[$count - 1];
    $ema20 = qt_signal_ema($closes, 20);
    $ema50 = qt_signal_ema($closes, 50);
    $rsi = qt_signal_rsi($closes, 14);
    $macd = qt_signal_macd_histogram($closes);
    $atr = qt_signal_atr($candles, 14);
    $votes = []; $basis = [];
    $add = static function (string $name, string $side, string $reason) use (&$votes, &$basis): void {
        $basis[] = ['name' => $name, 'side' => $side ?: 'WAIT', 'reason' => $reason];
        if ($side === 'BUY' || $side === 'SELL') $votes[] = ['name' => $name, 'side' => $side, 'reason' => $reason];
    };

    if ($enabled['ema']) {
        $side = ($ema20 !== null && $ema50 !== null && $current > $ema20 && $ema20 > $ema50) ? 'BUY'
            : (($ema20 !== null && $ema50 !== null && $current < $ema20 && $ema20 < $ema50) ? 'SELL' : 'WAIT');
        $add('EMA 20/50', $side, $side === 'BUY' ? 'Harga di atas EMA20 dan EMA20 di atas EMA50' : ($side === 'SELL' ? 'Harga di bawah EMA20 dan EMA20 di bawah EMA50' : 'Susunan EMA belum searah'));
    }
    if ($enabled['rsi']) {
        $side = $rsi !== null && $rsi > 55 ? 'BUY' : ($rsi !== null && $rsi < 45 ? 'SELL' : 'WAIT');
        $add('RSI 14', $side, $side === 'BUY' ? 'RSI berada di atas zona 55' : ($side === 'SELL' ? 'RSI berada di bawah zona 45' : 'RSI masih berada di area netral'));
    }
    if ($enabled['macd']) {
        $side = $macd !== null && $macd > 0 ? 'BUY' : ($macd !== null && $macd < 0 ? 'SELL' : 'WAIT');
        $add('MACD', $side, $side === 'BUY' ? 'Histogram MACD positif' : ($side === 'SELL' ? 'Histogram MACD negatif' : 'Histogram MACD belum memberi arah'));
    }

    $bull = count(array_filter($votes, static fn($v): bool => $v['side'] === 'BUY'));
    $bear = count(array_filter($votes, static fn($v): bool => $v['side'] === 'SELL'));
    $required = count($votes) <= 1 ? 1 : (int)ceil(count($votes) * .67);
    $side = $bull >= $required && $bull > $bear ? 'BUY' : ($bear >= $required && $bear > $bull ? 'SELL' : 'WAIT');
    $distance = $atr !== null && $atr > 0 ? $atr * 1.5 : null;
    $hasSetup = $side !== 'WAIT' && $distance !== null;
    $entry = $hasSetup ? $current : null;
    $sl = $hasSetup ? $current + ($side === 'SELL' ? $distance : -$distance) : null;
    $tp = $hasSetup ? $current + ($side === 'SELL' ? -$distance * 2 : $distance * 2) : null;
    $activeReasons = array_values(array_map(static fn($item): string => $item['reason'], array_filter($basis, static fn($item): bool => $item['side'] === $side)));
    $reason = $side === 'WAIT' ? (count($votes) ? 'Konfirmasi indikator belum cukup searah. Signal ditahan.' : 'Pilih minimal satu indikator untuk membaca signal.') : implode(' · ', $activeReasons);
    $activeCount = (int)$enabled['ema'] + (int)$enabled['rsi'] + (int)$enabled['macd'];
    $agreement = $activeCount ? max($bull, $bear) / $activeCount : 0;
    $volatility = qt_signal_volatility($candles, 14);
    $marketSide = ($ema20 !== null && $ema50 !== null && $current > $ema20 && $ema20 > $ema50) ? 'BUY'
        : (($ema20 !== null && $ema50 !== null && $current < $ema20 && $ema20 < $ema50) ? 'SELL' : 'WAIT');
    return [
        'side' => $side, 'signal' => $side === 'BUY' ? 'BULLISH' : ($side === 'SELL' ? 'BEARISH' : 'NEUTRAL'),
        'current' => $current, 'entry' => $entry, 'sl' => $sl, 'tp' => $tp, 'rr' => $hasSetup ? 2 : null, 'atr' => $atr,
        'rsi' => $rsi, 'ema20' => $ema20, 'ema50' => $ema50, 'macd' => $macd,
        'bull' => $bull, 'bear' => $bear, 'required' => $required,
        'confidence' => count($votes) ? min(95, (int)round(max($bull, $bear) / count($votes) * 100)) : 0,
        'reason' => $reason, 'basis' => $basis, 'candleTime' => (int)($last['time'] ?? 0), 'source' => $source,
        'quality' => [
            'agreement' => $agreement, 'activeCount' => $activeCount, 'mtfRatio' => null,
            'score' => $side === 'WAIT' ? (int)round($agreement * 60) : (int)round($agreement * 70 + 30),
            'volatility' => $volatility['label'], 'volatilityRatio' => $volatility['ratio'],
            'market' => $marketSide === 'BUY' ? 'Trend naik' : ($marketSide === 'SELL' ? 'Trend turun' : 'Range / transisi'),
        ],
    ];
}

function qt_signal_snapshot_id(array $result, string $symbol, string $timeframe): string
{
    $payload = [
        'engine' => QT_SIGNAL_ENGINE_VERSION, 'symbol' => strtoupper($symbol), 'timeframe' => $timeframe,
        'candle_time' => $result['candleTime'] ?? null, 'side' => $result['side'] ?? 'WAIT',
        'current' => $result['current'] ?? null, 'entry' => $result['entry'] ?? null,
        'sl' => $result['sl'] ?? null, 'tp' => $result['tp'] ?? null,
        'reason' => $result['reason'] ?? '', 'basis' => $result['basis'] ?? [], 'quality' => $result['quality'] ?? [],
    ];
    return 'QT-' . strtoupper(substr(hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION)), 0, 8));
}

function qt_signal_normalize_candle_series(array $candles): array
{
    $out = [];
    $previous = null;
    foreach ($candles as $c) {
        if (!is_array($c) || !isset($c['time'], $c['open'], $c['high'], $c['low'], $c['close'])) throw new RuntimeException('Candle tidak lengkap.', 422);
        $row = ['time' => (int)$c['time'], 'open' => (float)$c['open'], 'high' => (float)$c['high'], 'low' => (float)$c['low'], 'close' => (float)$c['close'], 'volume' => (float)($c['volume'] ?? 0)];
        if ($row['time'] <= 0 || !is_finite($row['open']) || !is_finite($row['high']) || !is_finite($row['low']) || !is_finite($row['close']) || $row['high'] < $row['low'] || $row['high'] < max($row['open'], $row['close']) || $row['low'] > min($row['open'], $row['close'])) throw new RuntimeException('Struktur OHLC tidak valid.', 422);
        if ($previous !== null) {
            if ($row['time'] <= $previous['time']) throw new RuntimeException('Urutan waktu candle tidak valid.', 422);
            if ($previous['close'] > 0 && abs($row['close'] - $previous['close']) / $previous['close'] > .60) throw new RuntimeException('Lonjakan harga tidak wajar.', 422);
        }
        $out[] = $row; $previous = $row;
    }
    return $out;
}
