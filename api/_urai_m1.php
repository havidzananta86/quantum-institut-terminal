<?php
/**
 * Urutan sentuhan TP/SL di dalam satu candle, dari candle M1 (dipakai api/signal-evaluator.php
 * dan penilai bayangan/Pine api/_setup_shadow.php).
 */
declare(strict_types=1);

if (!function_exists('qi_sig_urai_m1')) :
/**
 * Aturan 11: candle yang menyentuh TP DAN SL sekaligus. OHLC tidak memberi tahu mana yang lebih
 * dulu, jadi diambil candle M1 di dalam rentang candle itu ($urai(tMulai, tAkhir) → candle M1).
 * Urutan M1 pertama yang menyentuh salah satu level menentukan; M1 yang juga menyentuh keduanya
 * tetap dianggap SL. null = tidak bisa diurai (tanpa M1 / candle sudah M1) → pemanggil SL dulu.
 * @return 'TP'|'SL'|null
 */
function qi_sig_urai_m1(string $side, float $tp, float $sl, float $offTutup, array $c, int $durasi, ?callable $urai): ?string {
    if ($urai === null || $durasi <= 60) return null;
    try {
        $m1 = $urai((int)$c['time'], (int)$c['time'] + $durasi);
    } catch (Throwable $e) {
        return null;
    }
    if (!is_array($m1) || !$m1) return null;
    usort($m1, fn($a, $b) => ((int)$a['time']) <=> ((int)$b['time']));
    $cakup = 0;
    foreach ($m1 as $m) {
        $t = (int)($m['time'] ?? 0);
        if ($t < (int)$c['time'] || $t >= (int)$c['time'] + $durasi) continue;
        $cakup++;
        $h = (float)$m['high'] + $offTutup; $l = (float)$m['low'] + $offTutup;
        $kenaSl = ($side === 'BUY') ? $l <= $sl : $h >= $sl;
        $kenaTp = ($side === 'BUY') ? $h >= $tp : $l <= $tp;
        if ($kenaSl) return 'SL';          // termasuk M1 yang menyentuh keduanya: tetap konservatif
        if ($kenaTp) return 'TP';
    }
    return null;                           // M1 tidak mencakup sentuhan (data bolong) → jangan menebak
}
endif;
