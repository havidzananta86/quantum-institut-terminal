<?php
// Proxy untuk Binance Futures public API + Frankfurter IDR rates
// Tidak butuh auth — semua endpoint ini public
header('Content-Type: application/json');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);
header('Cache-Control: public, max-age=60'); // cache 60 detik

$_qi_dev = in_array($_SERVER['SERVER_NAME'] ?? 'localhost', ['localhost', '127.0.0.1'], true);

$action = $_GET['action'] ?? 'liquidation';

function curlGet(string $url): array|false {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (QuantumTerminal)',
        CURLOPT_SSL_VERIFYPEER => $_qi_dev ? false : true,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    if (!$body) return false;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : false;
}

if ($action === 'liquidation') {
    // Coba Binance Futures dulu, fallback ke Binance Spot 24h ticker
    $TOP = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','LINKUSDT','AVAXUSDT','ADAUSDT','LTCUSDT'];

    // Coba fapi (Binance Futures) dulu
    $tickers = curlGet('https://fapi.binance.com/fapi/v1/ticker/24hr');
    $source  = 'futures';

    if ($tickers === false) {
        // Fallback: Binance Spot 24h ticker — coba beberapa host (sama dengan live-price.php)
        $symsParam = urlencode(json_encode($TOP));
        $hosts = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com'];
        foreach ($hosts as $host) {
            $tickers = curlGet("{$host}/api/v3/ticker/24hr?symbols={$symsParam}");
            if ($tickers !== false) break;
        }
        $source = 'spot';
    }

    if ($tickers === false) {
        http_response_code(502);
        echo json_encode(['error' => 'Gagal mengambil data Binance']);
        exit;
    }

    // Funding rate (hanya tersedia dari futures, lewati jika spot)
    $fundMap = [];
    if ($source === 'futures') {
        $funding = curlGet('https://fapi.binance.com/fapi/v1/premiumIndex');
        if ($funding) {
            foreach ($funding as $f) {
                $fundMap[$f['symbol']] = isset($f['lastFundingRate'])
                    ? round((float)$f['lastFundingRate'] * 100, 4)
                    : null;
            }
        }
    }

    // Filter ke TOP_SYMS saja
    $filtered = array_values(array_filter($tickers, fn($t) => in_array($t['symbol'], $TOP)));
    usort($filtered, fn($a, $b) => (float)$b['quoteVolume'] <=> (float)$a['quoteVolume']);
    $filtered = array_slice($filtered, 0, 8);

    // Compose response
    $rows = [];
    foreach ($filtered as $t) {
        $sym  = $t['symbol'];
        $chg  = round((float)($t['priceChangePercent'] ?? 0), 2);
        $rows[] = [
            'symbol'  => $sym,
            'price'   => $t['lastPrice'] ?? $t['weightedAvgPrice'] ?? '0',
            'change'  => $chg,
            'volume'  => $t['quoteVolume'] ?? '0',
            'funding' => $fundMap[$sym] ?? null,
            'liqSide' => $chg <= -3 ? 'LONG' : ($chg >= 3 ? 'SHORT' : 'NEUTRAL'),
        ];
    }
    echo json_encode(['ok' => true, 'data' => $rows, 'source' => $source]);

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
