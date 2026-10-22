<?php
// When included by signals.php, headers and rate limiting are handled by the caller.
if (!defined('QI_INCLUDED_BY_SIGNALS')) {
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/_middleware.php';
    qi_rate_limit(120, 60); // chart sering di-refresh, beri limit lebih longgar
}
$_apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($_apiKeysFile)) require_once $_apiKeysFile;
if (!defined('TWELVE_DATA_KEY')) define('TWELVE_DATA_KEY', '');

$symbol   = isset($_GET['symbol'])   ? strtoupper(qi_sanitize_string($_GET['symbol'], 10)) : 'BTCUSDT';
$interval = isset($_GET['interval']) ? qi_sanitize_string($_GET['interval'], 5)            : '60';

$intervalMapBinance = [
    '1' => '1m', '5' => '5m', '15' => '15m', '30' => '30m', '60' => '1h', '240' => '4h', 'D' => '1d',
    // Mingguan & bulanan: didukung Binance (terbukti: 1w = 478 bar, 1M = 111 bar untuk BTCUSDT).
    'W' => '1w', 'MN' => '1M'
];
$binanceInterval = $intervalMapBinance[$interval] ?? '1h';

// =============================================================
// CACHING: simpan candle per symbol+interval, TTL singkat
// Repeated load jadi ~instan (baca file lokal, tanpa fetch eksternal)
// =============================================================
$cacheTtlMap = ['1' => 15, '5' => 20, '15' => 30, '30' => 45, '60' => 60, '240' => 120, 'D' => 300, 'W' => 900, 'MN' => 3600];
$cacheTtl = $cacheTtlMap[$interval] ?? 30;

$cacheDir = __DIR__ . '/../cache/chart';
if (!is_dir($cacheDir)) { @mkdir($cacheDir, 0755, true); }
// Pengguna yang berhak feed bridge MT5 memakai cache TERPISAH (suffix _mt5) supaya candle broker
// tidak sampai ke pengguna lain lewat cache bersama.
$useMt5 = qi_chart_use_mt5($symbol);
$cacheFile = qi_chart_cache_file($symbol, $interval, $useMt5);
$cacheScope = $useMt5 ? 'private' : 'public';
if (!defined('QI_INCLUDED_BY_SIGNALS')) header('Vary: Authorization');

// Sajikan dari cache kalau masih segar.
// Saat di-include signals.php, pakai `return` (bukan exit) supaya kontrol
// kembali ke pemanggil — exit() akan mematikan seluruh request signals.php.
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    if (!defined('QI_INCLUDED_BY_SIGNALS')) {
        header('X-QI-Cache: HIT');
        header('Cache-Control: ' . $cacheScope . ', max-age=' . $cacheTtl);
    }
    echo file_get_contents($cacheFile);
    if (defined('QI_INCLUDED_BY_SIGNALS')) return;
    exit();
}

// Single-flight: saat cache kedaluwarsa hanya SATU request yang mengambil data upstream
// (terukur ~9 dtk). Request lain langsung menerima cache terakhir (≤10 menit) alih-alih
// ikut antre — tanpa ini polling chart menumpuk sampai 30 dtk dan melambatkan semua API.
// Selalu LOCK_NB: flock blocking di PHP/Apache Windows terbukti membuat penunggu macet >60 dtk.
$qiChartLock = @fopen($cacheFile . '.lock', 'c');
if ($qiChartLock && !flock($qiChartLock, LOCK_EX | LOCK_NB)) {
    fclose($qiChartLock);
    $qiChartLock = null;
    $qiChartDeadline = microtime(true) + 15;
    while ((!is_file($cacheFile) || (time() - filemtime($cacheFile)) >= 600) && microtime(true) < $qiChartDeadline) {
        usleep(250000);
        clearstatcache(true, $cacheFile);
    }
    if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < 600) {
        if (!defined('QI_INCLUDED_BY_SIGNALS')) header('X-QI-Cache: STALE');
        echo file_get_contents($cacheFile);
        if (defined('QI_INCLUDED_BY_SIGNALS')) return;
        exit();
    }
}
if ($qiChartLock) {
    clearstatcache(true, $cacheFile);
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
        flock($qiChartLock, LOCK_UN);
        fclose($qiChartLock);
        $qiChartLock = null;
        if (!defined('QI_INCLUDED_BY_SIGNALS')) header('X-QI-Cache: HIT');
        echo file_get_contents($cacheFile);
        if (defined('QI_INCLUDED_BY_SIGNALS')) return;
        exit();
    }
}

/**
 * Ambil URL dengan curl (cepat) atau fallback file_get_contents.
 */
if (!function_exists('qi_http_get')) :
function qi_http_get($url, $timeout = 4) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (QuantumTerminal)',
            CURLOPT_ENCODING       => '',
            CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        // Simpan kode status terakhir supaya pemanggil bisa membedakan 429 (kuota habis)
        // dari kegagalan jaringan biasa — dipakai pemutus sirkuit Twelve Data.
        $GLOBALS['qi_last_http_code'] = (int)$code;
        return ($res && $code >= 200 && $code < 300) ? $res : false;
    }
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => $timeout, 'header' => "User-Agent: Mozilla/5.0\r\n"]]);
    $GLOBALS['qi_last_http_code'] = 0;
    return @file_get_contents($url, false, $ctx);
}
endif;

if (!function_exists('qi_biquote_tf')) :
/**
 * Pemetaan interval internal → parameter biquote.io.
 * Hasil pengujian: biquote HANYA menerima ["1m","5m","15m","30m","1h","4h","1d"].
 * Permintaan mingguan/bulanan ke sana ditolak (HTTP 400) atau diam-diam dijawab data
 * harian — karena itu W/MN meminta data HARIAN, lalu diagregasi sungguhan oleh
 * qi_aggregate_candles() supaya label timeframe tidak berbohong.
 */
function qi_biquote_tf(string $interval): string {
    $map = ['1' => '1m', '5' => '5m', '15' => '15m', '30' => '30m', '60' => '1h', '240' => '4h', 'D' => '1d', 'W' => '1d', 'MN' => '1d'];
    return $map[$interval] ?? '5m';
}
endif;

if (!function_exists('qi_candle_step')) :
/** Perkiraan jarak antar-bar (median dari 30 bar terakhir) untuk mendeteksi granularitas. */
function qi_candle_step(array $candles): int {
    $n = count($candles);
    if ($n < 3) return 0;
    $gaps = [];
    for ($i = max(1, $n - 30); $i < $n; $i++) {
        $gap = (int)($candles[$i]['time'] ?? 0) - (int)($candles[$i - 1]['time'] ?? 0);
        if ($gap > 0) $gaps[] = $gap;
    }
    if (!$gaps) return 0;
    sort($gaps);
    return $gaps[intdiv(count($gaps), 2)];
}
endif;

if (!function_exists('qi_aggregate_candles')) :
/**
 * Gabungkan candle menjadi periode lebih besar (W = mingguan, MN = bulanan).
 * Dipakai bila penyedia tidak punya timeframe itu (biquote hanya harian): lebih jujur
 * menampilkan hasil agregasi data harian nyata daripada candle harian berlabel mingguan.
 *   open = open pertama, high = tertinggi, low = terendah, close = close terakhir,
 *   volume = jumlah, time = awal periode (Senin 00:00 UTC untuk mingguan).
 */
function qi_aggregate_candles(array $candles, string $period): array {
    if (count($candles) < 2) return $candles;
    $buckets = [];
    foreach ($candles as $c) {
        $t = (int)($c['time'] ?? 0);
        if ($t <= 0) continue;
        // Awal periode dihitung dengan aritmetika UTC murni (gmmktime), BUKAN strtotime
        // relatif: strtotime('monday this week') mengikuti zona waktu server sehingga
        // batas minggu/bulan bergeser bila server bukan UTC. Sudah diuji di lokal (bukan UTC).
        $midnightUtc = gmmktime(0, 0, 0, (int)gmdate('n', $t), (int)gmdate('j', $t), (int)gmdate('Y', $t));
        if ($midnightUtc === false) continue;
        if ($period === 'W') {
            $dow = (int)gmdate('N', $t);                 // 1 = Senin ... 7 = Minggu
            $key = $midnightUtc - ($dow - 1) * 86400;    // mundur ke Senin 00:00 UTC
        } else {
            $key = gmmktime(0, 0, 0, (int)gmdate('n', $t), 1, (int)gmdate('Y', $t)); // awal bulan
        }
        if ($key === false) continue;
        if (!isset($buckets[$key])) {
            $buckets[$key] = [
                'time'   => $key,
                'open'   => (float)$c['open'],
                'high'   => (float)$c['high'],
                'low'    => (float)$c['low'],
                'close'  => (float)$c['close'],
                'volume' => (float)($c['volume'] ?? 0),
            ];
        } else {
            $buckets[$key]['high']    = max($buckets[$key]['high'], (float)$c['high']);
            $buckets[$key]['low']     = min($buckets[$key]['low'], (float)$c['low']);
            $buckets[$key]['close']   = (float)$c['close'];
            $buckets[$key]['volume'] += (float)($c['volume'] ?? 0);
        }
    }
    ksort($buckets);
    return array_values($buckets);
}
endif;

if (!function_exists('qi_td_quota_blocked')) :
/**
 * Pemutus sirkuit Twelve Data.
 *
 * Kuota harian Twelve Data mudah habis — pada pemeriksaan tercatat 24.706 credit
 * terpakai dalam sehari dan API menjawab 429 "run out of API credits". Tanpa pemutus
 * ini, setiap permintaan chart XAUUSD/EURUSD tetap mencoba Twelve Data lebih dulu,
 * membuang ±1,5 detik DAN terus menambah pemakaian credit yang sudah habis.
 *
 * Saat terdeteksi 429, Twelve Data dilewati sampai tengah malam UTC berikutnya
 * (kuota hariannya direset), lalu otomatis dicoba lagi.
 */
function qi_td_quota_blocked(): bool {
    $f = __DIR__ . '/../cache/td_quota.json';
    if (!is_file($f)) return false;
    $d = json_decode((string)@file_get_contents($f), true);
    if (!is_array($d)) return false;
    if ((int)($d['until'] ?? 0) > time()) return true;
    @unlink($f); // sudah kedaluwarsa → coba lagi
    return false;
}
function qi_td_quota_mark(): void {
    $until = strtotime('tomorrow 00:00:00 UTC');
    if ($until === false || $until <= time()) $until = time() + 3600;
    @file_put_contents(
        __DIR__ . '/../cache/td_quota.json',
        json_encode(['until' => $until, 'marked_at' => gmdate('c')]),
        LOCK_EX
    );
}
endif;

$candles = [];
// Sumber data terakhir yang berhasil mengisi candle — ditampilkan di chart (label
// kejujuran data). Nilai: binance | binance_paxg | twelvedata | biquote | simulasi.
$source = '';

// 0. XAUUSD, BTCUSDT & semua forex: OANDA lewat tv-bridge (TradingView-API). Bila bridge
// mati/kosong, rantai sumber lama (Binance / Twelve Data / biquote / PAXG) tetap jadi fallback.
if ($useMt5) {
    // Prioritas tertinggi: candle dari feed broker MT5 (bridge di Windows VPS) untuk pengguna berhak.
    $candles = qi_mt5_candles($symbol, $interval);
    if ($candles) $source = 'mt5';
}
if (empty($candles) && qi_tv_bridge_symbol($symbol) !== null) {
    $candles = qi_tv_bridge_candles($symbol, $interval);
    if ($candles) $source = 'oanda_tv';
}
// Kripto diperdagangkan 24/7, tetapi BTC di OANDA (dan sebagian broker MT5) tutup akhir pekan:
// candle terakhir tertinggal >1 hari sehingga chart BTC membeku Sabtu–Minggu. Bila candle
// terakhir lebih tua dari satu batang + 2 jam, pakai Binance di bawah (24/7).
if ($candles && qi_candle_kripto_basi($symbol, $interval, $candles)) { $candles = []; $source = ''; }

// 1. CRYPTO via Binance — pakai mirror Vision dulu (paling jarang ke-blok di ID)
if (empty($candles) && in_array($symbol, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'])) {
    $binanceHosts = [
        'https://data-api.binance.vision',
        'https://api.binance.com',
        'https://api1.binance.com',
    ];
    foreach ($binanceHosts as $host) {
        // Kedalaman 1.000 bar (dulu 300). Terbukti didukung data-api.binance.vision:
        // 1.000 bar ≈ 810 ms, ±96 KB asli / ±24 KB setelah kompresi Brotli. Riwayat ini
        // dipakai chart, engine sinyal, backtest, dan analisa AI sekaligus.
        $raw = qi_http_get("{$host}/api/v3/klines?symbol={$symbol}&interval={$binanceInterval}&limit=1000", 10);
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data) && count($data) > 0) {
                foreach ($data as $d) {
                    $candles[] = [
                        'time'   => (int)($d[0] / 1000),
                        'open'   => (float)$d[1],
                        'high'   => (float)$d[2],
                        'low'    => (float)$d[3],
                        'close'  => (float)$d[4],
                        'volume' => (float)$d[5],
                    ];
                }
                $source = 'binance';
                break; // sukses, stop coba host lain
            }
        }
    }
}

// ─── Twelve Data interval map ────────────────────────────────────────────────
$tdIntervalMap = ['1'=>'1min','5'=>'5min','15'=>'15min','30'=>'30min','60'=>'1h','240'=>'4h','D'=>'1day','W'=>'1week','MN'=>'1month'];
$tdInterval = $tdIntervalMap[$interval] ?? '1h';

// Helper: parse Twelve Data time_series response into candle array
// Guarded: signals.php includes this file once per timeframe, so an
// unguarded declaration fatals with "Cannot redeclare" on the 2nd include.
if (!function_exists('qi_parse_td_candles')) :
function qi_parse_td_candles(array $values): array {
    $out = [];
    foreach ($values as $v) {
        $t = strtotime($v['datetime'] ?? '');
        if ($t > 0) {
            $out[] = [
                'time'   => $t,
                'open'   => (float)$v['open'],
                'high'   => (float)$v['high'],
                'low'    => (float)$v['low'],
                'close'  => (float)$v['close'],
                'volume' => (float)($v['volume'] ?? 0),
            ];
        }
    }
    // Twelve Data returns newest-first; flip to oldest-first for chart
    return array_reverse($out);
}
endif;

if (!function_exists('qi_merge_candle_history')) :
/**
 * Gabungkan bar baru dengan riwayat yang sudah tersimpan di cache.
 *
 * Alasan: sebagian penyedia membatasi jumlah bar per permintaan — biquote.io selalu
 * mengirim ±169 bar walau diminta 2.000 — sehingga riwayat forex tidak bisa dalam
 * dalam sekali ambil. Dengan menggabungkan bar yang sudah tersimpan, riwayat tumbuh
 * seiring waktu tanpa permintaan tambahan.
 *
 * Pengaman:
 *  - cache lama hanya dipakai bila berisi data NYATA (simulated=false), supaya candle
 *    acak tidak pernah bercampur ke chart;
 *  - cache lama yang lebih tua dari 7 hari diabaikan agar tidak menyisakan lubang
 *    waktu panjang di grafik;
 *  - duplikat dibuang berdasarkan waktu (bar baru menang), lalu jumlahnya dibatasi;
 *  - riwayat hanya digabung dari SUMBER YANG SAMA. Tanpa syarat ini, bar proksi PAXG
 *    (diperdagangkan 24/7) dari cache lama ikut masuk ke chart biquote/Twelve Data:
 *    XAUUSD mendapat candle hari Sabtu dan deret candle datar puluhan jam, padahal
 *    badge sumbernya menyebut biquote.
 *
 * Aman dideklarasikan berkali-kali karena signals.php meng-include file ini per timeframe.
 */
function qi_merge_candle_history(string $cacheFile, array $fresh, int $maxBars = 1000, ?string $source = null): array {
    if (!is_file($cacheFile) || (time() - (int)@filemtime($cacheFile)) > 7 * 86400) {
        return $fresh;
    }
    $prev = json_decode((string)@file_get_contents($cacheFile), true);
    if (!is_array($prev) || !empty($prev['simulated']) || empty($prev['candles']) || !is_array($prev['candles'])) {
        return $fresh;
    }
    if ($source !== null && (string)($prev['source'] ?? '') !== $source) {
        return $fresh;
    }
    // Hanya gabungkan bila granularitasnya sepadan. Cache lama bisa berisi timeframe
    // berbeda — misalnya cache "W" dari sebelum perbaikan masih berisi candle H1, atau
    // cache "30" berisi data 5 menit. Mencampur dua granularitas akan merusak grafik.
    $stepOld = qi_candle_step($prev['candles']);
    $stepNew = qi_candle_step($fresh);
    if ($stepOld > 0 && $stepNew > 0) {
        $ratio = $stepOld > $stepNew ? $stepOld / $stepNew : $stepNew / $stepOld;
        if ($ratio > 1.6) {
            return $fresh;
        }
    }
    $byTime = [];
    foreach ($prev['candles'] as $c) {
        if (isset($c['time'])) $byTime[(int)$c['time']] = $c;
    }
    foreach ($fresh as $c) {
        if (isset($c['time'])) $byTime[(int)$c['time']] = $c; // data baru menang
    }
    ksort($byTime);
    $merged = array_values($byTime);
    if (count($merged) > $maxBars) {
        $merged = array_slice($merged, -$maxBars);
    }
    return $merged;
}
endif;

// 1b. XAUUSD: Twelve Data → biquote.io MT5 → PAXG fallback
if (empty($candles) && $symbol === 'XAUUSD') {
    // Primary: Twelve Data (sumber sama dengan analismarket.com) — dilewati bila kuota
    // hariannya sudah habis, supaya tidak membuang waktu & credit (lihat pemutus sirkuit).
    if (!qi_td_quota_blocked()) {
        $tdUrl = 'https://api.twelvedata.com/time_series?symbol=XAU%2FUSD'
               . '&interval=' . $tdInterval . '&outputsize=300&apikey=' . TWELVE_DATA_KEY;
        $raw = qi_http_get($tdUrl, 6);
        if ($raw) {
            $d = json_decode($raw, true);
            $values = $d['values'] ?? [];
            if (is_array($values) && count($values) > 5 && !isset($d['code'])) {
                $candles = qi_parse_td_candles($values);
                $source  = 'twelvedata';
            }
        } elseif (($GLOBALS['qi_last_http_code'] ?? 0) === 429) {
            qi_td_quota_mark();
        }
    }

    // Secondary: biquote.io MT5 broker feed
    if (empty($candles)) {
        $biquoteTf = qi_biquote_tf($interval);
        $raw = qi_http_get("https://biquote.io/api/XAUUSD/ohlc?interval={$biquoteTf}&limit=300", 4);
        if ($raw) {
            $data = json_decode($raw, true);
            $bars = $data['bars'] ?? (is_array($data) ? $data : []);
            if (is_array($bars) && count($bars) > 0) {
                foreach ($bars as $b) {
                    $t = strtotime($b['openTime'] ?? $b['time'] ?? '');
                    if ($t > 0) {
                        $candles[] = [
                            'time'   => $t,
                            'open'   => (float)$b['open'],
                            'high'   => (float)$b['high'],
                            'low'    => (float)$b['low'],
                            'close'  => (float)$b['close'],
                            'volume' => (float)($b['tickVolume'] ?? $b['volume'] ?? 0),
                        ];
                    }
                }
                usort($candles, fn($a, $b) => $a['time'] - $b['time']);
                $source = 'biquote';
            }
        }
    }

    // Tertiary: Binance PAXGUSDT (gold proxy, deviasi <0.5%)
    if (empty($candles)) {
        $raw = qi_http_get("https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval={$binanceInterval}&limit=1000", 10);
        $source = 'binance_paxg';
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data) && count($data) > 0) {
                foreach ($data as $d) {
                    $candles[] = [
                        'time'   => (int)($d[0] / 1000),
                        'open'   => (float)$d[1], 'high' => (float)$d[2],
                        'low'    => (float)$d[3], 'close'=> (float)$d[4],
                        'volume' => (float)$d[5],
                    ];
                }
            }
        }
    }
}

// 1c. EURUSD: Twelve Data → biquote.io fallback
if (empty($candles) && $symbol === 'EURUSD') {
    // Primary: Twelve Data — dilewati bila kuota hariannya habis (pemutus sirkuit).
    if (!qi_td_quota_blocked()) {
        $tdUrl = 'https://api.twelvedata.com/time_series?symbol=EUR%2FUSD'
               . '&interval=' . $tdInterval . '&outputsize=300&apikey=' . TWELVE_DATA_KEY;
        $raw = qi_http_get($tdUrl, 6);
        if ($raw) {
            $d = json_decode($raw, true);
            $values = $d['values'] ?? [];
            if (is_array($values) && count($values) > 5 && !isset($d['code'])) {
                $candles = qi_parse_td_candles($values);
                $source  = 'twelvedata';
            }
        } elseif (($GLOBALS['qi_last_http_code'] ?? 0) === 429) {
            qi_td_quota_mark();
        }
    }

    // Fallback: biquote.io MT5
    if (empty($candles)) {
        $biquoteTf = qi_biquote_tf($interval);
        $raw = qi_http_get("https://biquote.io/api/EURUSD/ohlc?interval={$biquoteTf}&limit=300", 4);
        if ($raw) {
            $data = json_decode($raw, true);
            $bars = $data['bars'] ?? (is_array($data) ? $data : []);
            if (is_array($bars) && count($bars) > 0) {
                foreach ($bars as $b) {
                    $t = strtotime($b['openTime'] ?? $b['time'] ?? '');
                    if ($t > 0) {
                        $candles[] = [
                            'time'   => $t,
                            'open'   => (float)$b['open'],
                            'high'   => (float)$b['high'],
                            'low'    => (float)$b['low'],
                            'close'  => (float)$b['close'],
                            'volume' => (float)($b['tickVolume'] ?? $b['volume'] ?? 0),
                        ];
                    }
                }
                usort($candles, fn($a, $b) => $a['time'] - $b['time']);
                $source = 'biquote';
            }
        }
    }
}

// 1d. Forex majors + cross pairs → Twelve Data → biquote.io MT5 fallback.
$forexMajors = ['GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'GBPJPY', 'EURJPY', 'EURGBP', 'AUDNZD', 'CHFJPY', 'CADJPY'];
if (empty($candles) && in_array($symbol, $forexMajors, true)) {
    // Primary: Twelve Data — simbol diformat "XXX/YYY" — dilewati bila kuota harian
    // habis (pemutus sirkuit), supaya tidak membuang waktu & credit.
    if (!qi_td_quota_blocked()) {
        $tdSymbol = substr($symbol, 0, 3) . '/' . substr($symbol, 3, 3);
        $tdUrl = 'https://api.twelvedata.com/time_series?symbol=' . urlencode($tdSymbol)
               . '&interval=' . $tdInterval . '&outputsize=300&apikey=' . TWELVE_DATA_KEY;
        $raw = qi_http_get($tdUrl, 6);
        if ($raw) {
            $d = json_decode($raw, true);
            $values = $d['values'] ?? [];
            if (is_array($values) && count($values) > 5 && !isset($d['code'])) {
                $candles = qi_parse_td_candles($values);
                $source  = 'twelvedata';
            }
        } elseif (($GLOBALS['qi_last_http_code'] ?? 0) === 429) {
            qi_td_quota_mark();
        }
    }

    // Fallback: biquote.io MT5 broker feed
    if (empty($candles)) {
        $biquoteTf = qi_biquote_tf($interval);
        $raw = qi_http_get("https://biquote.io/api/{$symbol}/ohlc?interval={$biquoteTf}&limit=300", 4);
        if ($raw) {
            $data = json_decode($raw, true);
            $bars = $data['bars'] ?? (is_array($data) ? $data : []);
            if (is_array($bars) && count($bars) > 0) {
                foreach ($bars as $b) {
                    $t = strtotime($b['openTime'] ?? $b['time'] ?? '');
                    if ($t > 0) {
                        $candles[] = [
                            'time'   => $t,
                            'open'   => (float)$b['open'],
                            'high'   => (float)$b['high'],
                            'low'    => (float)$b['low'],
                            'close'  => (float)$b['close'],
                            'volume' => (float)($b['tickVolume'] ?? $b['volume'] ?? 0),
                        ];
                    }
                }
                usort($candles, fn($a, $b) => $a['time'] - $b['time']);
                $source = 'biquote';
            }
        }
    }
}

// 2. SEMUA SUMBER GAGAL → cache NYATA terakhir (ditandai basi + umurnya), bukan candle acak.
// MENGAPA (audit sinyal 2026-10-22): dulu permintaan yang memegang kunci langsung membuat 201
// candle rand() dari harga dasar tetap (BTC 68450, XAU 2654,2, EURUSD 1,0895) — walau cache
// candle NYATA dari semenit lalu ada, karena cache hanya disajikan selama masih < TTL. Candle
// acak itu lalu sampai ke Setup Analisa, Mesin 9, dan indikator Pine pada level harga yang salah.
// Cache basi ≤ 7 hari disajikan apa adanya dengan stale=true dan umur_detik supaya setiap
// pemakai bisa memutuskan sendiri (penerbit sinyal menolaknya lewat qi_sp_cek_pasar).
// Berkas cache TIDAK ditulis ulang di sini (umur aslinya tetap terbaca dari mtime).
if (empty($candles) && is_file($cacheFile)) {
    $qiUmurCache = time() - (int)@filemtime($cacheFile);
    $qiCacheLama = $qiUmurCache < 7 * 86400 ? json_decode((string)@file_get_contents($cacheFile), true) : null;
    if (is_array($qiCacheLama) && empty($qiCacheLama['simulated']) && !empty($qiCacheLama['candles']) && is_array($qiCacheLama['candles'])) {
        $qiCacheLama['stale'] = true;
        $qiCacheLama['umur_detik'] = $qiUmurCache;
        $qiCacheLama['catatan'] = 'Semua sumber harga gagal; ini data nyata terakhir yang tersimpan (' . (int)round($qiUmurCache / 60) . ' menit lalu).';
        if (!empty($qiChartLock)) { flock($qiChartLock, LOCK_UN); fclose($qiChartLock); $qiChartLock = null; }
        if (!defined('QI_INCLUDED_BY_SIGNALS')) {
            header('X-QI-Cache: STALE-ERROR');
            header('Cache-Control: no-store');
        }
        echo json_encode($qiCacheLama);
        if (defined('QI_INCLUDED_BY_SIGNALS')) return;
        exit();
    }
}

// Indeks & komoditas hanya punya OANDA (bridge). Bila bridge gagal, katakan terus terang —
// jangan menggambar candle acak dengan label simulasi untuk instrumen yang baru ditambahkan.
// HTTP 200 + status error (bukan 503): chart menampilkan pesan "tidak tersedia" tanpa galat merah di konsol.
if (empty($candles) && qi_simbol_indeks($symbol)) {
    echo json_encode(['status' => 'error', 'tidak_tersedia' => true, 'symbol' => $symbol, 'interval' => $interval, 'candles' => [],
        'message' => 'Data ' . $symbol . ' sementara tidak tersedia (feed OANDA tidak terjangkau).']);
    if (!empty($qiChartLock)) { flock($qiChartLock, LOCK_UN); fclose($qiChartLock); $qiChartLock = null; }
    // Saat di-include (signals.php / ai-signal.php / live-price.php) WAJIB return: exit() di sini
    // dulu mematikan seluruh request pemanggil — jawaban signals.php berubah menjadi JSON galat
    // chart ini dan timeframe lainnya hilang (audit sinyal 2026-10-22).
    if (defined('QI_INCLUDED_BY_SIGNALS')) return;
    exit();
}

// 3. Tidak ada data nyata sama sekali (tidak ada cache ≤ 7 hari) → katakan terus terang.
// Candle simulasi (rand()) DIHAPUS untuk semua simbol: harga karangan tidak boleh tampil
// sebagai chart, apa pun labelnya. Bentuk jawabannya sama dengan indeks di atas.
$simulated = false;
if (empty($candles)) {
    echo json_encode(['status' => 'error', 'tidak_tersedia' => true, 'simulated' => false, 'symbol' => $symbol, 'interval' => $interval, 'candles' => [],
        'message' => 'Data ' . $symbol . ' sementara tidak tersedia: semua sumber harga gagal dan belum ada data tersimpan. Coba lagi sebentar lagi.']);
    if (!empty($qiChartLock)) { flock($qiChartLock, LOCK_UN); fclose($qiChartLock); $qiChartLock = null; }
    if (defined('QI_INCLUDED_BY_SIGNALS')) return;
    exit();
}

// AGREGASI W/MN: bila penyedia tidak punya timeframe mingguan/bulanan (biquote hanya
// harian), gabungkan candle harian menjadi mingguan/bulanan yang sesungguhnya. Deteksi
// memakai jarak antar-bar sehingga tidak bergantung pada tebakan penyedia mana yang dipakai.
// Dijalankan SEBELUM penggabungan riwayat supaya cache tidak pernah bercampur granularitas.
if (!$simulated && ($interval === 'W' || $interval === 'MN')) {
    $target = $interval === 'W' ? 604800 : 2592000;
    $step   = qi_candle_step($candles);
    if ($step > 0 && $step < $target * 0.6) {
        $candles = qi_aggregate_candles($candles, $interval);
    }
}

// RANGKAI RIWAYAT (hanya untuk data nyata): lihat qi_merge_candle_history().
// OANDA sudah memberi 1.000 bar penuh; jangan campur dengan riwayat cache dari sumber
// lain (level harga Binance/Twelve Data/PAXG berbeda dari OANDA).
if (!$simulated && !in_array($source, ['oanda_tv', 'mt5'], true)) {
    $candles = qi_merge_candle_history($cacheFile, $candles, 1000, $source);
}

$payload = json_encode([
    'status'       => 'success',
    'symbol'       => $symbol,
    'interval'     => $interval,
    'count'        => count($candles),
    'simulated'    => $simulated,
    'source'       => $source !== '' ? $source : ($simulated ? 'simulasi' : 'unknown'),
    'generated_at' => gmdate('c'),
    'candles'      => $candles
]);

// Simpan ke cache hanya jika data nyata (jangan cache candle simulasi)
if (!$simulated) {
    @file_put_contents($cacheFile, $payload, LOCK_EX);
}
if (!empty($qiChartLock)) {
    flock($qiChartLock, LOCK_UN);
    fclose($qiChartLock);
    $qiChartLock = null;
}

// Header hanya untuk permintaan langsung; saat di-include, header milik pemanggil.
if (!defined('QI_INCLUDED_BY_SIGNALS')) {
    header('X-QI-Cache: MISS');
    if (!$simulated) header('Cache-Control: ' . $cacheScope . ', max-age=' . $cacheTtl);
}
echo $payload;
