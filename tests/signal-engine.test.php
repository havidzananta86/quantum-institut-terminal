<?php
declare(strict_types=1);

require __DIR__ . '/../api/_signal_engine.php';

$failed = 0;
$check = static function (string $name, bool $ok, mixed $detail = null) use (&$failed): void {
    echo ($ok ? "  ✓ " : "  ✗ ") . $name;
    if (!$ok && $detail !== null) echo ' — ' . json_encode($detail, JSON_UNESCAPED_UNICODE);
    echo PHP_EOL;
    if (!$ok) $failed++;
};

$fixture = json_decode((string)file_get_contents(__DIR__ . '/fixtures/candles-xauusd-h1.json'), true);
$all = qt_signal_normalize_candle_series($fixture['candles'] ?? []);
$closed = array_slice($all, 0, -1);
$confirmed = qt_signal_analyze($closed, ['source' => 'fixture']);
$provisional = qt_signal_analyze($all, ['source' => 'fixture']);

$check('fixture memiliki candle yang cukup', count($closed) >= 55);
$check('signal confirmed memakai candle terakhir yang sudah close', $confirmed['candleTime'] === $closed[count($closed) - 1]['time']);
$check('signal provisional memakai candle berjalan terakhir', $provisional['candleTime'] === $all[count($all) - 1]['time']);
$check('signal side selalu BUY/SELL/WAIT', in_array($confirmed['side'], ['BUY', 'SELL', 'WAIT'], true));
$check('aturan TP/SL 1:2 konsisten', $confirmed['side'] === 'WAIT' || ($confirmed['rr'] === 2 && (($confirmed['side'] === 'BUY' && $confirmed['sl'] < $confirmed['entry'] && $confirmed['tp'] > $confirmed['entry']) || ($confirmed['side'] === 'SELL' && $confirmed['sl'] > $confirmed['entry'] && $confirmed['tp'] < $confirmed['entry']))));
$check('snapshot deterministik', qt_signal_snapshot_id($confirmed, 'XAUUSD', '1h') === qt_signal_snapshot_id($confirmed, 'XAUUSD', '1h'));
$check('snapshot membedakan timeframe', qt_signal_snapshot_id($confirmed, 'XAUUSD', '1h') !== qt_signal_snapshot_id($confirmed, 'XAUUSD', '4h'));

$noIndicators = qt_signal_analyze($closed, ['indicators' => ['ema' => false, 'rsi' => false, 'macd' => false]]);
$check('tanpa indikator signal ditahan', $noIndicators['side'] === 'WAIT' && $noIndicators['confidence'] === 0);

$bad = $closed;
$bad[5]['time'] = $bad[4]['time'];
$rejected = false;
try { qt_signal_normalize_candle_series($bad); } catch (Throwable $e) { $rejected = true; }
$check('urutan candle rusak ditolak', $rejected);

if ($failed) {
    echo "\nFAIL — {$failed} signal-engine check gagal\n";
    exit(1);
}
echo "\nPASS — signal engine regression checks\n";
