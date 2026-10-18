<?php
/**
 * Pembantu tests/pine-php.test.js: jalankan port PHP pada fixture H4 untuk beberapa titik potong
 * dan cetak ringkasannya sebagai JSON (dibandingkan dengan versi JS).
 * Pemakaian: php pine-php.run.php fixture.json 600,1000,2000
 */
declare(strict_types=1);
require __DIR__ . '/../api/_pine_smcsnd.php';

$fx = json_decode((string)file_get_contents($argv[1]), true);
$semua = array_map(static fn($r) => ['time' => $r[0], 'open' => $r[1], 'high' => $r[2], 'low' => $r[3], 'close' => $r[4]], $fx['candles']);
$keluar = [];
foreach (array_map('intval', explode(',', $argv[2])) as $n) {
    $h = qi_pine_hitung(array_slice($semua, 0, $n));
    $ring = static fn(array $z): array => array_map(static fn($b) => [round($b['top'], 6), round($b['bottom'], 6)], $z);
    $keluar[(string)$n] = [
        'ok' => $h['ok'],
        'ema13' => $h['ema13'] ?? null, 'ema21' => $h['ema21'] ?? null, 'ema100' => $h['ema100'] ?? null, 'ema200' => $h['ema200'] ?? null, 'atr' => $h['atr'] ?? null,
        'supply' => isset($h['zona']) ? $ring($h['zona']['supply']) : null,
        'demand' => isset($h['zona']) ? $ring($h['zona']['demand']) : null,
        'bos' => $h['bos'] ?? null,
        'buy' => isset($h['buy']) ? array_intersect_key($h['buy'], array_flip(['entry', 'sl', 'tp1', 'tp2', 'tp3', 'status'])) : null,
        'sell' => isset($h['sell']) ? array_intersect_key($h['sell'], array_flip(['entry', 'sl', 'tp1', 'tp2', 'tp3', 'status'])) : null,
    ];
}
echo json_encode($keluar);
