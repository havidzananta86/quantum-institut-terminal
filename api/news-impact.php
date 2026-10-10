<?php
/**
 * News Impact Statistics — historical event impact data (static dataset)
 * Based on public research of forex market event reactions (2021-2026)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$window   = $_GET['window']   ?? '1h';
$groupBy  = $_GET['group_by'] ?? 'event_pair';
$impact   = strtoupper($_GET['impact'] ?? 'HIGH');
$currency = strtoupper($_GET['currency'] ?? 'ALL');

// Static dataset: [event, currency, pair, impact, avg1h, median1h, p901h, avg30m, maxMove, consistency, hitRate, upBias, releases, perYear]
$dataset = [
    // HIGH IMPACT — USD
    ['event'=>'Non Farm Payrolls',          'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>81.9,'med'=>71.3,'p90'=>147.1,'avg30m'=>50.7,'max'=>239.9,'cons'=>38,'hit'=>98,'upBias'=>51,'rel'=>61,'pyr'=>12],
    ['event'=>'Non Farm Payrolls',          'cur'=>'USD','pair'=>'GBP/USD','impact'=>'HIGH','avg1h'=>58.9,'med'=>50.0,'p90'=>99.9, 'avg30m'=>29.6,'max'=>163.0,'cons'=>46,'hit'=>98,'upBias'=>49,'rel'=>61,'pyr'=>12],
    ['event'=>'Non Farm Payrolls',          'cur'=>'USD','pair'=>'EUR/USD','impact'=>'HIGH','avg1h'=>45.2,'med'=>38.5,'p90'=>89.4, 'avg30m'=>27.1,'max'=>142.3,'cons'=>41,'hit'=>97,'upBias'=>47,'rel'=>61,'pyr'=>12],
    ['event'=>'Fed Interest Rate Decision', 'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>67.2,'med'=>51.9,'p90'=>123.2,'avg30m'=>42.1,'max'=>222.2,'cons'=>40,'hit'=>100,'upBias'=>48,'rel'=>31,'pyr'=>8.3],
    ['event'=>'Fed Press Conference',       'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>65.1,'med'=>64.5,'p90'=>112.9,'avg30m'=>36.6,'max'=>173.3,'cons'=>44,'hit'=>95,'upBias'=>39,'rel'=>41,'pyr'=>8.2],
    ['event'=>'CPI (YoY)',                  'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>74.4,'med'=>58.9,'p90'=>108.0,'avg30m'=>35.5,'max'=>415.8,'cons'=>11,'hit'=>95,'upBias'=>41,'rel'=>61,'pyr'=>12],
    ['event'=>'CPI (YoY)',                  'cur'=>'USD','pair'=>'GBP/USD','impact'=>'HIGH','avg1h'=>58.0,'med'=>45.8,'p90'=>105.5,'avg30m'=>39.3,'max'=>198.6,'cons'=>36,'hit'=>97,'upBias'=>59,'rel'=>61,'pyr'=>12],
    ['event'=>'Fed Waller Speech',          'cur'=>'USD','pair'=>'EUR/USD','impact'=>'MED', 'avg1h'=>18.2,'med'=>14.1,'p90'=>38.5, 'avg30m'=>10.2,'max'=>55.1, 'cons'=>22,'hit'=>72,'upBias'=>51,'rel'=>15,'pyr'=>5],
    ['event'=>'Initial Jobless Claims',     'cur'=>'USD','pair'=>'USD/JPY','impact'=>'MED', 'avg1h'=>22.4,'med'=>17.5,'p90'=>42.1, 'avg30m'=>13.8,'max'=>78.9, 'cons'=>28,'hit'=>85,'upBias'=>48,'rel'=>52,'pyr'=>52],
    ['event'=>'ISM Manufacturing PMI',      'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>32.7,'med'=>24.8,'p90'=>64.3, 'avg30m'=>18.2,'max'=>98.5, 'cons'=>33,'hit'=>89,'upBias'=>52,'rel'=>48,'pyr'=>12],
    ['event'=>'Core PCE (YoY)',             'cur'=>'USD','pair'=>'EUR/USD','impact'=>'HIGH','avg1h'=>29.8,'med'=>23.1,'p90'=>55.4, 'avg30m'=>17.2,'max'=>87.3, 'cons'=>31,'hit'=>88,'upBias'=>49,'rel'=>36,'pyr'=>12],
    ['event'=>'GDP (QoQ)',                  'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>31.5,'med'=>24.5,'p90'=>62.8, 'avg30m'=>18.9,'max'=>95.2, 'cons'=>35,'hit'=>87,'upBias'=>53,'rel'=>30,'pyr'=>4],
    ['event'=>'Retail Sales (MoM)',         'cur'=>'USD','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>28.3,'med'=>21.6,'p90'=>54.1, 'avg30m'=>16.7,'max'=>82.4, 'cons'=>30,'hit'=>85,'upBias'=>50,'rel'=>48,'pyr'=>12],
    ['event'=>'FOMC Minutes',               'cur'=>'USD','pair'=>'EUR/USD','impact'=>'MED', 'avg1h'=>21.9,'med'=>16.8,'p90'=>42.5, 'avg30m'=>12.4,'max'=>65.1, 'cons'=>25,'hit'=>78,'upBias'=>48,'rel'=>31,'pyr'=>8.3],
    ['event'=>'Atlanta Fed GDPNow',         'cur'=>'USD','pair'=>'USD/JPY','impact'=>'LOW', 'avg1h'=>8.2, 'med'=>5.9, 'p90'=>18.4, 'avg30m'=>4.1, 'max'=>28.5, 'cons'=>15,'hit'=>62,'upBias'=>51,'rel'=>24,'pyr'=>12],

    // HIGH IMPACT — GBP
    ['event'=>'BoE Interest Rate Decision', 'cur'=>'GBP','pair'=>'GBP/JPY','impact'=>'HIGH','avg1h'=>67.7,'med'=>57.8,'p90'=>102.2,'avg30m'=>40.6,'max'=>216.5,'cons'=>40,'hit'=>100,'upBias'=>48,'rel'=>31,'pyr'=>8.3],
    ['event'=>'BoE Interest Rate Decision', 'cur'=>'GBP','pair'=>'GBP/USD','impact'=>'HIGH','avg1h'=>59.3,'med'=>54.9,'p90'=>92.8, 'avg30m'=>36.1,'max'=>181.9,'cons'=>68,'hit'=>97,'upBias'=>45,'rel'=>31,'pyr'=>8.3],
    ['event'=>'BoE Interest Rate Decision', 'cur'=>'GBP','pair'=>'GBP/NZD','impact'=>'HIGH','avg1h'=>62.0,'med'=>58.1,'p90'=>102.6,'avg30m'=>35.4,'max'=>189.3,'cons'=>61,'hit'=>100,'upBias'=>42,'rel'=>31,'pyr'=>8.3],
    ['event'=>'BoE Interest Rate Decision', 'cur'=>'GBP','pair'=>'GBP/AUD','impact'=>'HIGH','avg1h'=>59.1,'med'=>49.3,'p90'=>98.2, 'avg30m'=>39.9,'max'=>119.8,'cons'=>56,'hit'=>100,'upBias'=>50,'rel'=>10,'pyr'=>4.5],
    ['event'=>'BoE Gov Bailey Speech',      'cur'=>'GBP','pair'=>'GBP/USD','impact'=>'MED', 'avg1h'=>25.4,'med'=>19.8,'p90'=>48.7, 'avg30m'=>14.9,'max'=>73.5, 'cons'=>28,'hit'=>80,'upBias'=>49,'rel'=>22,'pyr'=>6],
    ['event'=>'UK CPI (YoY)',               'cur'=>'GBP','pair'=>'GBP/USD','impact'=>'HIGH','avg1h'=>38.2,'med'=>29.5,'p90'=>72.1, 'avg30m'=>22.1,'max'=>105.3,'cons'=>38,'hit'=>91,'upBias'=>53,'rel'=>48,'pyr'=>12],
    ['event'=>'UK GDP (MoM)',               'cur'=>'GBP','pair'=>'GBP/USD','impact'=>'MED', 'avg1h'=>19.7,'med'=>14.8,'p90'=>38.5, 'avg30m'=>11.2,'max'=>58.9, 'cons'=>24,'hit'=>77,'upBias'=>51,'rel'=>36,'pyr'=>12],
    ['event'=>'BoE Credit Conditions Survey','cur'=>'GBP','pair'=>'GBP/USD','impact'=>'MED','avg1h'=>12.1,'med'=>9.3, 'p90'=>23.8, 'avg30m'=>6.8, 'max'=>38.5, 'cons'=>18,'hit'=>68,'upBias'=>50,'rel'=>15,'pyr'=>4],
    ['event'=>'BoE Greene Speech',          'cur'=>'GBP','pair'=>'GBP/USD','impact'=>'LOW', 'avg1h'=>9.8, 'med'=>7.2, 'p90'=>19.5, 'avg30m'=>5.1, 'max'=>31.2, 'cons'=>14,'hit'=>60,'upBias'=>49,'rel'=>10,'pyr'=>3],
    ['event'=>'BoE Lombardelli Speech',     'cur'=>'GBP','pair'=>'GBP/USD','impact'=>'LOW', 'avg1h'=>8.5, 'med'=>6.1, 'p90'=>17.2, 'avg30m'=>4.4, 'max'=>27.8, 'cons'=>12,'hit'=>58,'upBias'=>50,'rel'=>8, 'pyr'=>3],

    // HIGH IMPACT — JPY
    ['event'=>'BoJ Interest Rate Decision', 'cur'=>'JPY','pair'=>'GBP/JPY','impact'=>'HIGH','avg1h'=>74.5,'med'=>47.4,'p90'=>122.0,'avg30m'=>48.1,'max'=>589.6,'cons'=>8, 'hit'=>87,'upBias'=>52,'rel'=>31,'pyr'=>8.3],
    ['event'=>'BoJ Interest Rate Decision', 'cur'=>'JPY','pair'=>'EUR/JPY','impact'=>'HIGH','avg1h'=>64.5,'med'=>44.7,'p90'=>112.8,'avg30m'=>34.4,'max'=>434.9,'cons'=>8, 'hit'=>87,'upBias'=>48,'rel'=>31,'pyr'=>8.3],
    ['event'=>'BoJ Interest Rate Decision', 'cur'=>'JPY','pair'=>'USD/JPY','impact'=>'HIGH','avg1h'=>62.2,'med'=>45.9,'p90'=>111.6,'avg30m'=>34.4,'max'=>484.3,'cons'=>8, 'hit'=>81,'upBias'=>48,'rel'=>31,'pyr'=>8.3],
    ['event'=>'BoJ Interest Rate Decision', 'cur'=>'JPY','pair'=>'CHF/JPY','impact'=>'HIGH','avg1h'=>65.3,'med'=>43.6,'p90'=>105.4,'avg30m'=>36.2,'max'=>411.8,'cons'=>8, 'hit'=>81,'upBias'=>48,'rel'=>31,'pyr'=>8.3],
    ['event'=>'Japan CPI (YoY)',            'cur'=>'JPY','pair'=>'USD/JPY','impact'=>'MED', 'avg1h'=>18.5,'med'=>13.9,'p90'=>36.2, 'avg30m'=>10.8,'max'=>55.7, 'cons'=>22,'hit'=>74,'upBias'=>49,'rel'=>24,'pyr'=>12],
    ['event'=>'Japan GDP (QoQ)',            'cur'=>'JPY','pair'=>'USD/JPY','impact'=>'MED', 'avg1h'=>12.3,'med'=>9.1, 'p90'=>24.8, 'avg30m'=>6.9, 'max'=>38.5, 'cons'=>16,'hit'=>65,'upBias'=>51,'rel'=>16,'pyr'=>4],
    ['event'=>'Eco Watchers Survey',        'cur'=>'JPY','pair'=>'USD/JPY','impact'=>'LOW', 'avg1h'=>7.8, 'med'=>5.6, 'p90'=>15.9, 'avg30m'=>3.9, 'max'=>25.4, 'cons'=>12,'hit'=>58,'upBias'=>50,'rel'=>24,'pyr'=>12],

    // HIGH IMPACT — AUD
    ['event'=>'RBA Interest Rate Decision', 'cur'=>'AUD','pair'=>'GBP/AUD','impact'=>'HIGH','avg1h'=>76.3,'med'=>66.0,'p90'=>134.3,'avg30m'=>44.9,'max'=>219.2,'cons'=>42,'hit'=>97,'upBias'=>58,'rel'=>33,'pyr'=>9.1],
    ['event'=>'RBA Interest Rate Decision', 'cur'=>'AUD','pair'=>'EUR/AUD','impact'=>'HIGH','avg1h'=>68.8,'med'=>62.6,'p90'=>117.1,'avg30m'=>39.6,'max'=>191.8,'cons'=>43,'hit'=>94,'upBias'=>58,'rel'=>33,'pyr'=>9.1],
    ['event'=>'RBA Interest Rate Decision', 'cur'=>'AUD','pair'=>'AUD/USD','impact'=>'HIGH','avg1h'=>48.2,'med'=>41.5,'p90'=>88.5, 'avg30m'=>28.9,'max'=>125.3,'cons'=>38,'hit'=>92,'upBias'=>55,'rel'=>33,'pyr'=>9.1],
    ['event'=>'Monthly CPI Indicator',      'cur'=>'AUD','pair'=>'GBP/AUD','impact'=>'HIGH','avg1h'=>60.2,'med'=>32.6,'p90'=>115.9,'avg30m'=>42.7,'max'=>147.6,'cons'=>14,'hit'=>100,'upBias'=>40,'rel'=>5, 'pyr'=>-1],
    ['event'=>'Australia CPI (QoQ)',        'cur'=>'AUD','pair'=>'AUD/USD','impact'=>'HIGH','avg1h'=>38.5,'med'=>31.2,'p90'=>72.8, 'avg30m'=>22.1,'max'=>98.4, 'cons'=>35,'hit'=>89,'upBias'=>53,'rel'=>16,'pyr'=>4],
    ['event'=>'Australia Employment Change','cur'=>'AUD','pair'=>'AUD/USD','impact'=>'HIGH','avg1h'=>31.8,'med'=>24.5,'p90'=>62.3, 'avg30m'=>18.2,'max'=>88.9, 'cons'=>32,'hit'=>87,'upBias'=>51,'rel'=>48,'pyr'=>12],

    // HIGH IMPACT — EUR
    ['event'=>'ECB Interest Rate Decision', 'cur'=>'EUR','pair'=>'EUR/USD','impact'=>'HIGH','avg1h'=>52.3,'med'=>44.8,'p90'=>95.2, 'avg30m'=>31.5,'max'=>158.7,'cons'=>42,'hit'=>97,'upBias'=>50,'rel'=>31,'pyr'=>8.3],
    ['event'=>'ECB Interest Rate Decision', 'cur'=>'EUR','pair'=>'EUR/JPY','impact'=>'HIGH','avg1h'=>58.7,'med'=>49.2,'p90'=>108.5,'avg30m'=>35.8,'max'=>178.2,'cons'=>40,'hit'=>95,'upBias'=>51,'rel'=>31,'pyr'=>8.3],
    ['event'=>'ECB Lane Speech',            'cur'=>'EUR','pair'=>'EUR/USD','impact'=>'LOW', 'avg1h'=>11.2,'med'=>8.4, 'p90'=>22.5, 'avg30m'=>6.1, 'max'=>35.8, 'cons'=>15,'hit'=>63,'upBias'=>50,'rel'=>18,'pyr'=>6],
    ['event'=>'ECB Monetary Policy Accounts','cur'=>'EUR','pair'=>'EUR/USD','impact'=>'MED','avg1h'=>14.8,'med'=>10.9,'p90'=>29.5, 'avg30m'=>8.2, 'max'=>45.2, 'cons'=>19,'hit'=>70,'upBias'=>49,'rel'=>24,'pyr'=>8],
    ['event'=>'Eurogroup Meeting',          'cur'=>'EUR','pair'=>'EUR/USD','impact'=>'LOW', 'avg1h'=>9.4, 'med'=>6.8, 'p90'=>18.9, 'avg30m'=>5.0, 'max'=>30.1, 'cons'=>13,'hit'=>60,'upBias'=>50,'rel'=>12,'pyr'=>4],
    ['event'=>'German CPI (YoY)',           'cur'=>'EUR','pair'=>'EUR/USD','impact'=>'MED', 'avg1h'=>18.2,'med'=>13.7,'p90'=>36.4, 'avg30m'=>10.5,'max'=>55.6, 'cons'=>22,'hit'=>75,'upBias'=>52,'rel'=>48,'pyr'=>12],
    ['event'=>'Euro Area GDP (QoQ)',        'cur'=>'EUR','pair'=>'EUR/USD','impact'=>'MED', 'avg1h'=>15.6,'med'=>11.8,'p90'=>31.2, 'avg30m'=>8.9, 'max'=>48.3, 'cons'=>20,'hit'=>72,'upBias'=>51,'rel'=>16,'pyr'=>4],

    // HIGH IMPACT — CAD/NZD
    ['event'=>'BoC Monetary Policy Report', 'cur'=>'CAD','pair'=>'GBP/CAD','impact'=>'HIGH','avg1h'=>57.8,'med'=>51.5,'p90'=>95.7, 'avg30m'=>52.9,'max'=>96.4, 'cons'=>83,'hit'=>83,'upBias'=>50,'rel'=>6, 'pyr'=>3.4],
    ['event'=>'BoC Interest Rate Decision', 'cur'=>'CAD','pair'=>'USD/CAD','impact'=>'HIGH','avg1h'=>45.2,'med'=>37.8,'p90'=>84.5, 'avg30m'=>27.1,'max'=>132.6,'cons'=>40,'hit'=>93,'upBias'=>51,'rel'=>31,'pyr'=>8.3],
    ['event'=>'Canada CPI (YoY)',           'cur'=>'CAD','pair'=>'USD/CAD','impact'=>'HIGH','avg1h'=>28.5,'med'=>21.6,'p90'=>55.8, 'avg30m'=>16.8,'max'=>82.4, 'cons'=>29,'hit'=>83,'upBias'=>49,'rel'=>48,'pyr'=>12],
    ['event'=>'RBNZ Interest Rate Decision','cur'=>'NZD','pair'=>'NZD/USD','impact'=>'HIGH','avg1h'=>42.8,'med'=>35.2,'p90'=>79.5, 'avg30m'=>25.5,'max'=>118.5,'cons'=>38,'hit'=>91,'upBias'=>52,'rel'=>24,'pyr'=>7],

    // EIA / Commodities
    ['event'=>'EIA Natural Gas Stocks',     'cur'=>'USD','pair'=>'USD/CAD','impact'=>'LOW', 'avg1h'=>9.5, 'med'=>6.9, 'p90'=>20.1, 'avg30m'=>5.2, 'max'=>32.8, 'cons'=>15,'hit'=>63,'upBias'=>50,'rel'=>52,'pyr'=>52],
    ['event'=>'EIA Crude Oil Inventories',  'cur'=>'USD','pair'=>'USD/CAD','impact'=>'MED', 'avg1h'=>18.8,'med'=>13.2,'p90'=>37.5, 'avg30m'=>10.5,'max'=>58.2, 'cons'=>24,'hit'=>78,'upBias'=>49,'rel'=>52,'pyr'=>52],
    ['event'=>'Wholesale Inventories MoM',  'cur'=>'USD','pair'=>'USD/JPY','impact'=>'LOW', 'avg1h'=>7.2, 'med'=>5.1, 'p90'=>14.8, 'avg30m'=>3.7, 'max'=>23.5, 'cons'=>11,'hit'=>57,'upBias'=>50,'rel'=>36,'pyr'=>12],
    ['event'=>'Continuing Jobless Claims',  'cur'=>'USD','pair'=>'USD/JPY','impact'=>'MED', 'avg1h'=>15.8,'med'=>11.5,'p90'=>31.2, 'avg30m'=>8.9, 'max'=>48.5, 'cons'=>20,'hit'=>73,'upBias'=>48,'rel'=>52,'pyr'=>52],
];

// Sorting
$sort = $_GET['sort'] ?? 'avg_impact';
usort($dataset, function($a,$b) use ($sort) {
    return match($sort) {
        'median'      => $b['med'] <=> $a['med'],
        'consistency' => $b['cons'] <=> $a['cons'],
        'hit_rate'    => $b['hit'] <=> $a['hit'],
        'max_impact'  => $b['max'] <=> $a['max'],
        'releases'    => $b['rel'] <=> $a['rel'],
        default       => $b['avg1h'] <=> $a['avg1h'],
    };
});

// Filter
$filtered = array_values(array_filter($dataset, function($r) use ($impact, $currency) {
    $impOk = ($impact === 'ALL' || $r['impact'] === $impact);
    $curOk = ($currency === 'ALL' || $r['cur'] === $currency);
    return $impOk && $curOk;
}));

echo json_encode([
    'status'  => 'success',
    'window'  => $window,
    'sort'    => $sort,
    'total'   => count($filtered),
    'data'    => $filtered,
]);
