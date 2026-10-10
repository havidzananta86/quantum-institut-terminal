<?php
/**
 * COT Analysis — CFTC Commitment of Traders (public data)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$cacheFile = __DIR__ . '/../cache/cot_data.json';
$cacheTTL  = 10800;

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTTL) {
    echo file_get_contents($cacheFile); exit;
}

$contracts = [
    '099741' => ['label'=>'EUR','name'=>'Euro FX',          'pair'=>'EUR/USD'],
    '096742' => ['label'=>'GBP','name'=>'British Pound',     'pair'=>'GBP/USD'],
    '097741' => ['label'=>'JPY','name'=>'Japanese Yen',      'pair'=>'USD/JPY','invert'=>true],
    '232741' => ['label'=>'AUD','name'=>'Australian Dollar', 'pair'=>'AUD/USD'],
    '090741' => ['label'=>'CAD','name'=>'Canadian Dollar',   'pair'=>'USD/CAD','invert'=>true],
    '092741' => ['label'=>'CHF','name'=>'Swiss Franc',       'pair'=>'USD/CHF','invert'=>true],
    '112741' => ['label'=>'NZD','name'=>'New Zealand Dollar','pair'=>'NZD/USD'],
    '098662' => ['label'=>'USD','name'=>'US Dollar Index',   'pair'=>'DXY'],
    '088691' => ['label'=>'XAU','name'=>'Gold (Comex)',      'pair'=>'XAU/USD'],
];

$codes = implode(',', array_map(fn($c)=>"'$c'", array_keys($contracts)));
$url   = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json'
       . '?$where=' . urlencode("cftc_contract_market_code in ($codes)")
       . '&$order=report_date_as_yyyy_mm_dd+DESC&$limit=80'
       . '&$select=cftc_contract_market_code,report_date_as_yyyy_mm_dd,open_interest_all,'
       . 'noncomm_positions_long_all,noncomm_positions_short_all,'
       . 'change_in_noncomm_long_all,change_in_noncomm_short_all';

$ctx = stream_context_create(['http'=>['timeout'=>10,'user_agent'=>'Mozilla/5.0']]);
$raw = @file_get_contents($url, false, $ctx);

if (!$raw) {
    if (file_exists($cacheFile)) { echo file_get_contents($cacheFile); exit; }
    echo json_encode(['status'=>'error','message'=>'CFTC tidak tersedia']); exit;
}

$rows = json_decode($raw, true);
$byCode = [];
foreach ((array)$rows as $r) {
    $code = $r['cftc_contract_market_code'] ?? '';
    if (!isset($contracts[$code])) continue;
    $byCode[$code][] = $r;
}

$currencies = [];
foreach ($contracts as $code => $meta) {
    $data   = $byCode[$code] ?? [];
    $curr   = $data[0] ?? null;
    $prev   = $data[1] ?? null;
    if (!$curr) continue;

    $oi     = (int)($curr['open_interest_all'] ?? 0);
    $longs  = (int)($curr['noncomm_positions_long_all'] ?? 0);
    $shorts = (int)($curr['noncomm_positions_short_all'] ?? 0);
    $dL     = (int)($curr['change_in_noncomm_long_all']  ?? 0);
    $dS     = (int)($curr['change_in_noncomm_short_all'] ?? 0);
    $net    = $longs - $shorts;
    $prevL  = $prev ? (int)($prev['noncomm_positions_long_all'] ?? 0) : $longs;
    $prevS  = $prev ? (int)($prev['noncomm_positions_short_all'] ?? 0) : $shorts;
    $prevNet= $prevL - $prevS;
    $netPct = $oi > 0 ? round($net / $oi * 100, 1) : 0;
    $wf     = $oi > 0 ? round(($dL - $dS) / $oi * 100, 2) : 0;

    $bias = 'NEUTRAL';
    if ($netPct > 5 || ($netPct > 0 && $wf > 0.3)) $bias = 'BULLISH';
    if ($netPct < -5 || ($netPct < 0 && $wf < -0.3)) $bias = 'BEARISH';

    $currencies[$meta['label']] = [
        'label'      => $meta['label'],
        'name'       => $meta['name'],
        'pair'       => $meta['pair'],
        'invert'     => $meta['invert'] ?? false,
        'reportDate' => substr($curr['report_date_as_yyyy_mm_dd'] ?? '', 0, 10),
        'oi'         => $oi,
        'longs'      => $longs,
        'shorts'     => $shorts,
        'net'        => $net,
        'netChange'  => $net - $prevNet,
        'dLong'      => $dL,
        'dShort'     => $dS,
        'pctLong'    => $oi>0 ? round($longs/$oi*100,1) : 0,
        'pctShort'   => $oi>0 ? round($shorts/$oi*100,1) : 0,
        'netPct'     => $netPct,
        'weekFlow'   => $wf,
        'bias'       => $bias,
    ];
}

$pairs = [];
$pd = [
    'EUR/USD'=>['EUR','USD'],'GBP/USD'=>['GBP','USD'],'USD/JPY'=>['USD','JPY'],
    'AUD/USD'=>['AUD','USD'],'USD/CHF'=>['USD','CHF'],'USD/CAD'=>['USD','CAD'],
    'NZD/USD'=>['NZD','USD'],'EUR/GBP'=>['EUR','GBP'],'EUR/JPY'=>['EUR','JPY'],
    'GBP/JPY'=>['GBP','JPY'],'AUD/NZD'=>['AUD','NZD'],'GBP/AUD'=>['GBP','AUD'],
];
foreach ($pd as $p => [$b,$q]) {
    $bd = $currencies[$b] ?? null; $qd = $currencies[$q] ?? null;
    if (!$bd || !$qd) continue;
    $bScore = $bd['netPct'] + $bd['weekFlow'] * 4;
    $qScore = $qd['netPct'] + $qd['weekFlow'] * 4;
    $score  = round($bScore - $qScore, 1);
    $wShift = round($bd['weekFlow'] - $qd['weekFlow'], 2);
    $pairs[$p] = [
        'pair'       => $p,
        'base'       => $b,
        'quote'      => $q,
        'score'      => $score,
        'weekShift'  => $wShift,
        'bias'       => $score > 10 ? 'BULLISH' : ($score < -10 ? 'BEARISH' : 'NEUTRAL'),
        'conviction' => abs($score) > 25 ? 'strong conviction' : (abs($score) > 10 ? 'moderate conviction' : 'mixed/weak'),
    ];
}

$out = json_encode(['status'=>'success','timestamp'=>date('Y-m-d H:i:s'),
    'source'=>'CFTC · Commitment of Traders (Legacy)','currencies'=>$currencies,'pairs'=>$pairs]);
file_put_contents($cacheFile, $out);
echo $out;
