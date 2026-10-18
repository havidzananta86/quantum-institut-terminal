<?php
/**
 * Riwayat candle DALAM untuk backtest — api/get-history.php
 *
 * KENAPA ADA: chart hanya butuh ±1.000 bar agar cepat, tetapi BACKTEST butuh ribuan
 * bar supaya hasilnya bermakna. Sebelumnya batas 1.000 bar itu dipakai untuk keduanya,
 * sehingga validasi strategi berdiri di atas sampel yang terlalu kecil.
 *
 * Sumber: Binance (data publik, gratis, dan boleh dipakai) dengan PAGINASI.
 *   - kripto : hingga 10.000 bar (10 permintaan × 1.000)
 *   - forex/emas: sumber biquote membatasi riwayat, jadi kami katakan terus terang
 *     (limited=true) alih-alih menyajikan data yang tidak ada.
 *
 * Hasil disimpan di cache/history/ supaya backtest berulang tidak menghajar penyedia.
 * Pada cache HIT, hanya 200 bar TERBARU yang diambil ulang — riwayat lama tidak berubah,
 * jadi tidak perlu mengunduh ulang semuanya.
 *
 * Parameter: symbol, interval (1|5|15|30|60|240|D), bars (100..10000, default 3000)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$symbol   = isset($_GET['symbol'])   ? strtoupper(qi_sanitize_string($_GET['symbol'], 20))   : 'BTCUSDT';
$interval = isset($_GET['interval']) ? qi_sanitize_string($_GET['interval'], 5)             : '60';
$bars     = isset($_GET['bars'])     ? (int)$_GET['bars'] : 3000;

$INTERVAL_VALID = ['1' => '1m', '5' => '5m', '15' => '15m', '30' => '30m', '60' => '1h', '240' => '4h', 'D' => '1d'];
if (!isset($INTERVAL_VALID[$interval])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Interval tidak dikenal.', 'code' => 'BAD_INTERVAL']);
    exit();
}
$bars = max(100, min(10000, $bars));

// Daftar kripto yang memang ada di Binance (sumber riwayat dalam).
$KRIPTO = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT'];
$isKripto = in_array($symbol, $KRIPTO, true);

$cacheDir = __DIR__ . '/../cache/history';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = $cacheDir . '/' . md5($symbol . '_' . $interval . '_' . $bars) . '.json';
$ttl = ($interval === 'D' || $interval === '240') ? 21600 : 3600; // 6 jam / 1 jam
$cached = false;
$candles = [];

// ── Jalur non-kripto: jujur soal batas sumber ───────────────────────────────
// Forex, emas, perak, indeks, minyak: riwayat dalam dari OANDA lewat tv-bridge (hingga 5.000 bar —
// H4 ±3 tahun, D1 ±19 tahun). Dipakai backtest Setup Analisa. Bridge lama (batas 1.000 bar) tetap
// berfungsi; jumlah bar yang benar-benar didapat dilaporkan apa adanya.
if (!$isKripto && qi_tv_bridge_symbol($symbol) !== null) {
    $minta = min($bars, 5000);
    if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
        $cd = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($cd['candles'] ?? null) && count($cd['candles']) >= 100) {
            echo json_encode($cd + ['cached' => true]);
            exit();
        }
    }
    $dariBridge = qi_tv_bridge_candles($symbol, $interval, $minta, 45);
    if (count($dariBridge) >= 100) {
        $hasil = [
            'status' => 'success', 'symbol' => $symbol, 'interval' => $interval, 'source' => 'oanda_tv',
            'bars' => count($dariBridge), 'requested' => $bars, 'limited' => count($dariBridge) < $minta, 'cached' => false,
            'first_time' => (int)$dariBridge[0]['time'], 'last_time' => (int)end($dariBridge)['time'],
            'candles' => $dariBridge, 'generated_at' => gmdate('c'),
        ];
        @file_put_contents($cacheFile, json_encode($hasil), LOCK_EX);
        echo json_encode($hasil);
        exit();
    }
}

if (!$isKripto) {
    $chartCache = __DIR__ . '/../cache/chart/' . md5($symbol . '_' . $interval) . '.json';
    $pakai = [];
    if (is_file($chartCache)) {
        $cd = json_decode((string)file_get_contents($chartCache), true);
        if (is_array($cd['candles'] ?? null) && !($cd['simulated'] ?? true)) {
            $pakai = $cd['candles'];
        }
    }
    echo json_encode([
        'status'      => 'success',
        'symbol'      => $symbol,
        'interval'    => $interval,
        'source'      => 'cache_chart',
        'bars'        => count($pakai),
        'requested'   => $bars,
        'limited'     => true,
        'note'        => 'Riwayat dalam hanya tersedia untuk kripto (Binance). Untuk forex/emas, sumber gratis saat ini membatasi jumlah bar — angka ini apa adanya, bukan dipotong diam-diam.',
        'candles'     => $pakai,
        'generated_at' => gmdate('c'),
    ]);
    exit();
}

// ── Baca cache bila masih segar ─────────────────────────────────────────────
if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
    $cd = json_decode((string)file_get_contents($cacheFile), true);
    if (is_array($cd['candles'] ?? null) && count($cd['candles']) >= min(100, $bars / 2)) {
        $candles = $cd['candles'];
        $cached = true;
    }
}

$hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
$bInt  = $INTERVAL_VALID[$interval];

/** Ambil sepotong candle dari Binance (satu permintaan). */
$ambilPotongan = static function (string $host, string $bInt, int $limit, ?int $endTime) use ($symbol): array {
    $url = "{$host}/api/v3/klines?symbol=" . urlencode($symbol) . "&interval={$bInt}&limit={$limit}"
         . ($endTime !== null ? "&endTime={$endTime}" : '');
    $raw = qi_http_get($url, 8);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) return [];
    $keluar = [];
    foreach ($data as $k) {
        if (!is_array($k) || count($k) < 6) continue;
        $keluar[] = [
            'time'   => (int)($k[0] / 1000),
            'open'   => (float)$k[1],
            'high'   => (float)$k[2],
            'low'    => (float)$k[3],
            'close'  => (float)$k[4],
            'volume' => (float)$k[5],
        ];
    }
    return $keluar;
};

/** Gabungkan dua daftar candle, buang duplikat waktu, urutkan lama → baru. */
$gabung = static function (array $a, array $b): array {
    $peta = [];
    foreach ($a as $c) $peta[(int)$c['time']] = $c;
    foreach ($b as $c) $peta[(int)$c['time']] = $c;   // yang baru menang
    ksort($peta);
    return array_values($peta);
};

if ($cached) {
    // Hanya segarkan ekornya: riwayat lama tidak berubah.
    foreach ($hosts as $host) {
        $ekor = $ambilPotongan($host, $bInt, 200, null);
        if ($ekor) { $candles = $gabung($candles, $ekor); break; }
    }
} else {
    // Unduh berhalaman sampai jumlah bar terpenuhi.
    $terkumpul = [];
    $endTime = null;
    $alamatTerpakai = null;
    for ($putaran = 0; $putaran < 12 && count($terkumpul) < $bars; $putaran++) {
        $minta = min(1000, $bars - count($terkumpul));
        $potongan = [];
        foreach ($hosts as $host) {
            $potongan = $ambilPotongan($host, $bInt, $minta, $endTime);
            if ($potongan) { $alamatTerpakai = $host; break; }
        }
        if (!$potongan) break;
        $terkumpul = $gabung($potongan, $terkumpul);          // potongan ini lebih lama
        $endTime = ((int)$potongan[0]['time'] * 1000) - 1;    // sebelum bar tertua
        if (count($potongan) < $minta) break;                 // riwayat habis
    }
    $candles = $terkumpul;
}

// Simpan cache (hanya bila benar-benar ada isinya).
if ($candles) {
    $payload = json_encode([
        'symbol'   => $symbol,
        'interval' => $interval,
        'bars'     => count($candles),
        'source'   => 'binance',
        'candles'  => $candles,
    ], JSON_UNESCAPED_SLASHES);
    $tmp = $cacheFile . '.tmp' . getmypid();
    if (@file_put_contents($tmp, $payload, LOCK_EX) !== false) @rename($tmp, $cacheFile);
}

echo json_encode([
    'status'       => 'success',
    'symbol'       => $symbol,
    'interval'     => $interval,
    'source'       => 'binance',
    'bars'         => count($candles),
    'requested'    => $bars,
    'limited'      => count($candles) < $bars,
    'cached'       => $cached,
    'first_time'   => $candles ? (int)$candles[0]['time'] : null,
    'last_time'    => $candles ? (int)$candles[count($candles) - 1]['time'] : null,
    'generated_at' => gmdate('c'),
    'candles'      => $candles,
], JSON_UNESCAPED_SLASHES);
