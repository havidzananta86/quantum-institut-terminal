<?php
/**
 * PORT Pine Script → PHP: "XAU SMC+SnD BUY SELL COMBO" (Pine v5).
 *
 * Terjemahan 1:1 dari assets/js/qim-pine-smcsnd.js (yang sudah dicocokkan dengan angka TradingView).
 * Dipakai server untuk memindai sinyal VALID tanpa menunggu ada yang membuka chart. Kesamaan hasil
 * dengan versi JS dijaga oleh tests/pine-php.test.js (fixture 5.000 bar H4 OANDA, banyak titik potong).
 *
 * Semantik Pine yang dipertahankan: ta.ema (seed = nilai pertama), ta.atr (RMA, seed SMA), pivot
 * dikonfirmasi `len` bar kemudian, array unshift/pop berukuran tetap, zona tembus → garis BOS,
 * urutan per bar: pivot → zona → BOS, lalu bar terakhir: supply/demand terdekat → sweep → level → status.
 *
 * Candle: array lama→baru, tiap elemen ['time','open','high','low','close'].
 */

if (!function_exists('qi_pine_hitung')) :

function qi_pine_bawaan(): array
{
    return [
        'swing_length' => 10, 'history_keep' => 20, 'box_width' => 2.5,
        'ema13Len' => 13, 'ema21Len' => 21, 'ema100Len' => 100, 'ema200Len' => 200, 'atrLen' => 14,
        'buyEntryBufferATR' => 0.10, 'buySLBufferATR' => 1.20, 'sellEntryBufferATR' => 0.10, 'sellSLBufferATR' => 1.20,
        'useSweepLogic' => true, 'sweepLookback' => 3,
        'showZones' => true,
        'pivotKiriKetat' => true, 'pivotKananKetat' => false,
    ];
}

function qi_pine_ema(array $src, int $len): array
{
    $n = count($src); $out = array_fill(0, $n, 0.0); $a = 2 / ($len + 1);
    for ($i = 0; $i < $n; $i++) $out[$i] = $i === 0 ? $src[0] : $a * $src[$i] + (1 - $a) * $out[$i - 1];
    return $out;
}

/** @return array<int,float|null> */
function qi_pine_atr(array $c, int $len): array
{
    $n = count($c); $tr = []; $out = array_fill(0, $n, null);
    for ($i = 0; $i < $n; $i++) {
        $tr[$i] = $i === 0 ? $c[$i]['high'] - $c[$i]['low']
            : max($c[$i]['high'] - $c[$i]['low'], abs($c[$i]['high'] - $c[$i - 1]['close']), abs($c[$i]['low'] - $c[$i - 1]['close']));
    }
    $jumlah = 0.0;
    for ($i = 0; $i < $n; $i++) {
        if ($i < $len - 1) { $jumlah += $tr[$i]; continue; }
        if ($i === $len - 1) { $jumlah += $tr[$i]; $out[$i] = $jumlah / $len; continue; }
        $out[$i] = ($tr[$i] + ($len - 1) * $out[$i - 1]) / $len;
    }
    return $out;
}

/** Pada indeks i (bar konfirmasi) berisi harga pivot bar i−len, atau null. */
function qi_pine_pivot(array $c, int $len, bool $tinggi, array $o): array
{
    $n = count($c); $out = array_fill(0, $n, null);
    $kunci = $tinggi ? 'high' : 'low';
    for ($i = 2 * $len; $i < $n; $i++) {
        $p = $i - $len; $v = $c[$p][$kunci]; $ok = true;
        for ($j = 1; $j <= $len && $ok; $j++) {
            $kiri = $c[$p - $j][$kunci]; $kanan = $c[$p + $j][$kunci];
            if ($tinggi) {
                if ($o['pivotKiriKetat'] ? !($v > $kiri) : !($v >= $kiri)) $ok = false;
                elseif ($o['pivotKananKetat'] ? !($v > $kanan) : !($v >= $kanan)) $ok = false;
            } else {
                if ($o['pivotKiriKetat'] ? !($v < $kiri) : !($v <= $kiri)) $ok = false;
                elseif ($o['pivotKananKetat'] ? !($v < $kanan) : !($v <= $kanan)) $ok = false;
            }
        }
        if ($ok) $out[$i] = $v;
    }
    return $out;
}

function qi_pine_hitung(array $candles, array $opsi = []): array
{
    $o = array_merge(qi_pine_bawaan(), $opsi);
    $c = [];
    foreach ($candles as $x) {
        if (is_array($x) && isset($x['open'], $x['high'], $x['low'], $x['close'])
            && is_finite((float)$x['open']) && is_finite((float)$x['high']) && is_finite((float)$x['low']) && is_finite((float)$x['close'])) {
            $c[] = ['time' => $x['time'] ?? null, 'open' => (float)$x['open'], 'high' => (float)$x['high'], 'low' => (float)$x['low'], 'close' => (float)$x['close']];
        }
    }
    $n = count($c);
    $L = max(2, (int)floor($o['swing_length']));
    $K = max(1, (int)floor($o['history_keep']));
    $hasil = ['n' => $n, 'ok' => false];
    if ($n < 2 * $L + 5) { $hasil['pesan'] = 'Data terlalu sedikit (butuh ≥ ' . (2 * $L + 5) . ' bar).'; return $hasil; }

    $close = array_column($c, 'close');
    $e13 = qi_pine_ema($close, $o['ema13Len']); $e21 = qi_pine_ema($close, $o['ema21Len']);
    $e100 = qi_pine_ema($close, $o['ema100Len']); $e200 = qi_pine_ema($close, $o['ema200Len']);
    $A = qi_pine_atr($c, $o['atrLen']);
    $pH = qi_pine_pivot($c, $L, true, $o); $pL = qi_pine_pivot($c, $L, false, $o);

    $swHv = array_fill(0, 5, 0.0); $swHb = array_fill(0, 5, 0); $swLv = array_fill(0, 5, 0.0); $swLb = array_fill(0, 5, 0);
    $supplyBoxes = array_fill(0, $K, null); $demandBoxes = array_fill(0, $K, null);
    $supplyBos = array_fill(0, 5, null); $demandBos = array_fill(0, 5, null);

    $unshiftPop = static function (array &$arr, $v): void { array_unshift($arr, $v); array_pop($arr); };
    $overlapOk = static function (float $newPoi, array $boxes, float $atrV): bool {
        $thr = $atrV * 2.0;
        foreach ($boxes as $b) {
            if ($b === null) continue;
            $poi = ($b['top'] + $b['bottom']) / 2.0;
            if ($newPoi >= $poi - $thr && $newPoi <= $poi + $thr) return false;
        }
        return true;
    };
    $buatZona = static function (array $vals, array $bns, array &$boxes, int $tipe, float $atrV, int $i) use ($o, $overlapOk): void {
        $buf = $atrV * ($o['box_width'] / 10.0);
        $left = $bns[0];
        if ($tipe === 1) { $top = $vals[0]; $bottom = $top - $buf; } else { $bottom = $vals[0]; $top = $bottom + $buf; }
        $poi = ($top + $bottom) / 2.0;
        if ($overlapOk($poi, $boxes, $atrV)) {
            array_unshift($boxes, ['left' => $left, 'top' => $top, 'bottom' => $bottom, 'tipe' => $tipe === 1 ? 'supply' : 'demand', 'dibuat' => $i]);
            array_pop($boxes);
        }
    };
    $keBos = static function (array &$boxes, array &$bosArr, int $tipe, int $i) use ($close, $unshiftPop): void {
        foreach ($boxes as $k => $b) {
            if ($b === null) continue;
            $tembus = $tipe === 1 ? $close[$i] >= $b['top'] : $close[$i] <= $b['bottom'];
            if (!$tembus) continue;
            array_unshift($bosArr, ['left' => $b['left'], 'right' => $i, 'y' => ($b['top'] + $b['bottom']) / 2.0, 'tipe' => $b['tipe']]);
            array_pop($bosArr);
            $boxes[$k] = null;
        }
    };

    for ($i = 0; $i < $n; $i++) {
        $atrV = $A[$i];
        if ($pH[$i] !== null) {
            $unshiftPop($swHv, $pH[$i]); $unshiftPop($swHb, $i - $L);
            if ($o['showZones'] && $atrV !== null) $buatZona($swHv, $swHb, $supplyBoxes, 1, $atrV, $i);
        }
        if ($pL[$i] !== null) {
            $unshiftPop($swLv, $pL[$i]); $unshiftPop($swLb, $i - $L);
            if ($o['showZones'] && $atrV !== null) $buatZona($swLv, $swLb, $demandBoxes, -1, $atrV, $i);
        }
        $keBos($supplyBoxes, $supplyBos, 1, $i);
        $keBos($demandBoxes, $demandBos, -1, $i);
    }

    // ── Bar terakhir ─────────────────────────────────────────────────────────
    $i = $n - 1; $atrAkhir = $A[$i];
    $supplyTop = $supplyBottom = $demandTop = $demandBottom = null;
    foreach ($supplyBoxes as $b) if ($b !== null && $b['bottom'] > $close[$i]) { $supplyTop = $b['top']; $supplyBottom = $b['bottom']; break; }
    foreach ($demandBoxes as $b) if ($b !== null && $b['bottom'] <= $close[$i]) { $demandTop = $b['top']; $demandBottom = $b['bottom']; break; }
    $buySwept = false; $sellSwept = false;
    if ($demandBottom !== null) for ($k = 0; $k < $o['sweepLookback']; $k++) { $j = $i - $k; if ($j >= 0 && $c[$j]['low'] < $demandBottom && $c[$j]['close'] > $demandBottom) $buySwept = true; }
    if ($supplyTop !== null) for ($k = 0; $k < $o['sweepLookback']; $k++) { $j = $i - $k; if ($j >= 0 && $c[$j]['high'] > $supplyTop && $c[$j]['close'] < $supplyTop) $sellSwept = true; }

    $ada = static fn($v): bool => $v !== null && is_finite((float)$v);
    $buy = ['entry' => null, 'sl' => null, 'tp1' => null, 'tp2' => null, 'tp3' => null];
    $sell = $buy;
    if ($ada($demandTop) && $ada($demandBottom) && $ada($supplyTop) && $ada($supplyBottom) && $ada($atrAkhir)) {
        $buy['entry'] = $demandBottom - $atrAkhir * $o['buyEntryBufferATR'];
        $buy['sl'] = $demandBottom - $atrAkhir * $o['buySLBufferATR'];
        $buy['tp3'] = $supplyBottom;
        $rentang = $buy['tp3'] - $buy['entry'];
        $buy['tp1'] = $buy['entry'] + $rentang * 0.33;
        $buy['tp2'] = $buy['entry'] + $rentang * 0.66;
        $sell['entry'] = $supplyTop + $atrAkhir * $o['sellEntryBufferATR'];
        $sell['sl'] = $supplyTop + $atrAkhir * $o['sellSLBufferATR'];
        $sell['tp3'] = $demandTop;
        $rs = $sell['entry'] - $sell['tp3'];
        $sell['tp1'] = $sell['entry'] - $rs * 0.33;
        $sell['tp2'] = $sell['entry'] - $rs * 0.66;
    }
    $buyBase = $ada($buy['entry']) && $ada($buy['sl']) && $ada($buy['tp1']) && $ada($buy['tp2']) && $ada($buy['tp3'])
        && $buy['sl'] < $buy['entry'] && $buy['entry'] < $buy['tp1'] && $buy['tp1'] < $buy['tp2'] && $buy['tp2'] < $buy['tp3'];
    $sellBase = $ada($sell['entry']) && $ada($sell['sl']) && $ada($sell['tp1']) && $ada($sell['tp2']) && $ada($sell['tp3'])
        && $sell['tp3'] < $sell['tp2'] && $sell['tp2'] < $sell['tp1'] && $sell['tp1'] < $sell['entry'] && $sell['entry'] < $sell['sl'];
    $buyValid = $buyBase && (!$o['useSweepLogic'] || $buySwept);
    $sellValid = $sellBase && (!$o['useSweepLogic'] || $sellSwept);
    $status = static fn(bool $valid, bool $base, string $teks): string => $valid ? $teks : ($base && $o['useSweepLogic'] ? 'WAIT SWEEP' : 'WAIT');

    return array_merge($hasil, [
        'ok' => true,
        'ema13' => $e13[$n - 1], 'ema21' => $e21[$n - 1], 'ema100' => $e100[$n - 1], 'ema200' => $e200[$n - 1], 'atr' => $atrAkhir,
        'zona' => ['supply' => array_values(array_filter($supplyBoxes)), 'demand' => array_values(array_filter($demandBoxes))],
        'bos' => ['supply' => count(array_filter($supplyBos)), 'demand' => count(array_filter($demandBos))],
        'terdekat' => ['supplyTop' => $supplyTop, 'supplyBottom' => $supplyBottom, 'demandTop' => $demandTop, 'demandBottom' => $demandBottom],
        'buy' => $buy + ['baseValid' => $buyBase, 'valid' => $buyValid, 'swept' => $buySwept, 'status' => $status($buyValid, $buyBase, 'VALID BUY')],
        'sell' => $sell + ['baseValid' => $sellBase, 'valid' => $sellValid, 'swept' => $sellSwept, 'status' => $status($sellValid, $sellBase, 'VALID SELL')],
        'tPertama' => $c[0]['time'], 'tTerakhir' => $c[$n - 1]['time'],
    ]);
}

endif;
