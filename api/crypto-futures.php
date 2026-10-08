<?php
// Proxy untuk Binance Futures public API + Frankfurter IDR rates
// Tidak butuh auth — semua endpoint ini public
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=60'); // cache 60 detik

$action = $_GET['action'] ?? 'liquidation';

function curlGet(string $url): array|false {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_USERAGENT      => 'QuantumInstitut/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err || $body === false) return false;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : false;
}

if ($action === 'liquidation') {
    // Fetch 24h ticker + funding rate dari Binance Futures
    $TOP = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','LINKUSDT','AVAXUSDT','ADAUSDT','LTCUSDT'];

    $tickers = curlGet('https://fapi.binance.com/fapi/v1/ticker/24hr');
    $funding = curlGet('https://fapi.binance.com/fapi/v1/premiumIndex');

    if ($tickers === false) {
        http_response_code(502);
        echo json_encode(['error' => 'Gagal mengambil data Binance Futures']);
        exit;
    }

    // Filter ke TOP_SYMS saja
    $filtered = array_values(array_filter($tickers, fn($t) => in_array($t['symbol'], $TOP)));
    usort($filtered, fn($a, $b) => (float)$b['quoteVolume'] <=> (float)$a['quoteVolume']);
    $filtered = array_slice($filtered, 0, 8);

    // Build funding map
    $fundMap = [];
    if ($funding) {
        foreach ($funding as $f) {
            $fundMap[$f['symbol']] = isset($f['lastFundingRate'])
                ? round((float)$f['lastFundingRate'] * 100, 4)
                : null;
        }
    }

    // Compose response
    $rows = [];
    foreach ($filtered as $t) {
        $sym  = $t['symbol'];
        $chg  = round((float)$t['priceChangePercent'], 2);
        $rows[] = [
            'symbol'    => $sym,
            'price'     => $t['lastPrice'],
            'change'    => $chg,
            'volume'    => $t['quoteVolume'],
            'funding'   => $fundMap[$sym] ?? null,
            'liqSide'   => $chg <= -3 ? 'LONG' : ($chg >= 3 ? 'SHORT' : 'NEUTRAL'),
        ];
    }
    echo json_encode(['ok' => true, 'data' => $rows]);

} elseif ($action === 'idr') {
    // Kurs USD/IDR via Frankfurter
    $data = curlGet('https://api.frankfurter.app/latest?from=USD&to=IDR');
    if ($data && isset($data['rates']['IDR'])) {
        echo json_encode(['ok' => true, 'rate' => $data['rates']['IDR']]);
    } else {
        // Fallback: cached file
        $cache = __DIR__ . '/../cache/frankfurter/usd_idr.json';
        if (file_exists($cache)) {
            echo file_get_contents($cache);
        } else {
            http_response_code(502);
            echo json_encode(['error' => 'IDR rate tidak tersedia']);
        }
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'action tidak dikenal']);
}
