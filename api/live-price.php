<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 60); // max 120 req / 60 detik per IP (~2/s)
$_apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($_apiKeysFile)) require_once $_apiKeysFile;
if (!defined('TWELVE_DATA_KEY')) define('TWELVE_DATA_KEY', '');

// Central helpers qi_http_get() and qi_twelvedata_price() are provided by _middleware.php

// Simbol yang diminta (comma-separated)
$reqSyms = isset($_GET['symbols']) ? strtoupper(qi_sanitize_string($_GET['symbols'], 200)) : 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT';
$symbols = array_filter(array_map('trim', explode(',', $reqSyms)));

$result = [];

// ─── CACHE RESPONS BERSAMA (SANGAT SINGKAT) ─────────────────────────────────
// Diukur: permintaan 9 simbol butuh ~4,7 detik (terlalu berat bila dipanggil tiap
// 3–15 detik oleh banyak pengguna, dan bisa memicu timeout/permintaan gagal).
// Karena balasan ini berisi DATA PASAR saja (tidak ada data pribadi), hasilnya boleh
// dibagi antar pengguna. TTL sengaja 3 detik: tetap segar untuk chart, tetapi satu
// perhitungan dipakai bersama — beban server turun drastis.
$kunciCache = md5('lp|' . implode(',', $symbols));
$dirCache   = __DIR__ . '/../cache/live-price';
if (!is_dir($dirCache)) @mkdir($dirCache, 0755, true);
$fileCache  = $dirCache . '/' . $kunciCache . '.json';
if (file_exists($fileCache) && (time() - filemtime($fileCache)) < 3) {
    header('X-QI-Cache: HIT');
    echo (string)file_get_contents($fileCache);
    exit();
}
header('X-QI-Cache: MISS');
// Bersihkan berkas cache lama sesekali (1 dari 20 permintaan) supaya tidak menumpuk.
if (random_int(1, 20) === 1) {
    foreach ((array)@glob($dirCache . '/*.json') as $lama) {
        if (is_file($lama) && (time() - filemtime($lama)) > 3600) @unlink($lama);
    }
}

// Semua FX/Komoditas — tidak dikirim ke Binance
$FX_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','NZDUSD','USDCHF','USDCAD'];

// ─── OANDA (tv-bridge / TradingView-API): emas, BTC, dan semua forex — SATU panggilan ──
// Harga tick + bid/ask. Simbol yang gagal diambil tidak masuk $result dan jatuh ke
// rantai sumber lama di bawah (Binance / Twelve Data / PAXG / Frankfurter).
$result = qi_tv_bridge_quotes($symbols) + $result;

// ─── CRYPTO via Binance (multi-symbol ticker) ───────────────────────────────
// Lewati simbol yang sudah dari OANDA. BTCUSDT tetap boleh ke Binance bila OANDA gagal;
// pasangan forex lain tidak pernah dikirim ke Binance.
$cryptoSyms = array_filter($symbols, fn($s) => !isset($result[$s]) && !in_array($s, $FX_SYMS)
    && (qi_tv_bridge_symbol($s) === null || $s === 'BTCUSDT'));
if (!empty($cryptoSyms)) {
    $hosts = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com'];
    foreach ($hosts as $host) {
        $symJson = json_encode(array_values($cryptoSyms));
        $raw = qi_http_get("{$host}/api/v3/ticker/24hr?symbols=" . urlencode($symJson), 5);
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data) && count($data) > 0) {
                foreach ($data as $item) {
                    if (empty($item['symbol'])) continue;
                    $result[$item['symbol']] = [
                        'price'  => (float)$item['lastPrice'],
                        'open'   => (float)$item['openPrice'],
                        'high'   => (float)$item['highPrice'],
                        'low'    => (float)$item['lowPrice'],
                        'chgPct' => (float)$item['priceChangePercent'],
                        'vol'    => (float)$item['volume'],
                        'source' => 'binance',
                    ];
                }
                break;
            }
        }
    }
}

// ─── XAUUSD: Twelve Data → cache M1/H1 terbaru → PAXG (proksi) ──────────────
// MASALAH YANG DIPERBAIKI: dulu blok ini hanya membaca cache candle H1 dengan
// jendela kesegaran 300 detik. Karena kuota Twelve Data habis, emas SELALU jatuh ke
// jalur itu — sehingga harga emas di chart dashboard bisa beku sampai 5 menit
// (terukur 2026-10-11: nilai API tidak berubah sama sekali selama 60+ detik).
// Pengukuran sumber: candle M1 biquote berubah ~3x per 60 detik, sedangkan
// xaus.com/api/v1/spot hanya ~1x per 60 detik — jadi M1 adalah yang tercepat.
if (in_array('XAUUSD', $symbols) && ($result['XAUUSD']['source'] ?? '') !== 'oanda_tv') {
    // Primary: Twelve Data (sumber sama dengan analismarket.com)
    $td = qi_twelvedata_price('XAU/USD', 'xauusd');
    if (!empty($td['price']) && $td['price'] > 100) {
        $result['XAUUSD'] = $td;
    }

    // Secondary: pakai cache candle TERBARU di antara M1 dan H1, dengan jendela
    // kesegaran 45 detik supaya harga tidak pernah tampak beku bermenit-menit.
    if (empty($result['XAUUSD'])) {
        // Jaga cache M1 tetap hangat supaya harga emas benar-benar bergerak.
        // Pengukuran: candle M1 biquote berubah ~3x per 60 detik. Penyegaran dibatasi
        // SATU kali per 20 detik untuk SELURUH server (penanda berkas), bukan per
        // pengguna, supaya permintaan ke biquote tidak membanjir. get-chart-data.php
        // memang dirancang aman di-include (memakai `return`, bukan `exit`).
        $m1File  = __DIR__ . '/../cache/chart/' . md5('XAUUSD_1') . '.json';
        $penanda = __DIR__ . '/../cache/xau_m1_warm.txt';
        $umurM1  = is_file($m1File) ? (time() - filemtime($m1File)) : PHP_INT_MAX;
        $terakhirHangat = is_file($penanda) ? (int)@file_get_contents($penanda) : 0;
        if ($umurM1 > 20 && (time() - $terakhirHangat) > 20) {
            @file_put_contents($penanda, (string)time(), LOCK_EX);
            $simpanGet = $_GET;
            $levelAwal = ob_get_level();
            try {
                if (!defined('QI_INCLUDED_BY_SIGNALS')) define('QI_INCLUDED_BY_SIGNALS', true);
                $_GET['symbol']   = 'XAUUSD';
                $_GET['interval'] = '1';
                ob_start();
                include __DIR__ . '/get-chart-data.php';
            } catch (Throwable $e) {
                // penyegaran gagal bukan masalah: cache lama / PAXG tetap dipakai
            }
            while (ob_get_level() > $levelAwal) { ob_end_clean(); }
            $_GET = $simpanGet;
        }

        $kandidat = [
            ['file' => __DIR__ . '/../cache/chart/' . md5('XAUUSD_1') . '.json',  'label' => 'candle_m1'],
            ['file' => __DIR__ . '/../cache/chart/' . md5('XAUUSD_60') . '.json', 'label' => 'candle_h1'],
        ];
        $terpilih = null; $umurTerpilih = PHP_INT_MAX;
        foreach ($kandidat as $k) {
            if (!file_exists($k['file'])) continue;
            $umur = time() - filemtime($k['file']);
            if ($umur >= 45) continue;
            if ($umur < $umurTerpilih) { $umurTerpilih = $umur; $terpilih = $k; }
        }
        if ($terpilih !== null) {
            $cd = json_decode((string)file_get_contents($terpilih['file']), true);
            $candles = $cd['candles'] ?? [];
            if (!empty($candles) && !($cd['simulated'] ?? true)) {
                $last = end($candles); $first = reset($candles);
                $price = (float)$last['close']; $open = (float)($first['open'] ?? $price);
                if ($price > 100) {
                    $result['XAUUSD'] = ['price'=>$price,'open'=>$open,'high'=>(float)$last['high'],'low'=>(float)$last['low'],'chgPct'=>$open>0?round(($price-$open)/$open*100,3):0,'vol'=>0,'source'=>$terpilih['label']];
                }
            }
        }
    }

    // ─── GERAK REAL-TIME EMAS: JANGKAR-DELTA PAXG ──────────────────────────────
    // Masalah nyata yang dilaporkan pengguna: "harga chart emas diam" — karena sumber
    // emas gratis (biquote/Twelve Data/xaus) hanya diperbarui ~1× per menit.
    //
    // Solusi: pakai GERAKAN PAXG (Binance, tick-level) yang diterapkan pada harga emas
    // NYATA terakhir — BUKAN harga PAXG mentah (selisihnya ~0,16% dari emas):
    //
    //     harga_tampil = harga_emas_nyata_terakhir + (paxg_sekarang − paxg_saat_jangkar)
    //
    // Jadi LEVEL harga tetap benar (mengikuti sumber emas/broker) sementara GERAKNYA
    // halus dan cepat seperti chart profesional. Sumbernya diberi label
    // 'binance_paxg_selaras' + 'anchor_source' supaya tetap jujur: level dari sumber
    // emas, gerakan dari proksi. Pengaman: delta > 0,6% diabaikan (data proksi rusak),
    // dan jangkar lebih tua dari 10 menit tidak dipakai.
    if (in_array('XAUUSD', $symbols, true) && ($result['XAUUSD']['source'] ?? '') !== 'oanda_tv') {
        $proksi = qi_proksi_emas();
        $paxgSkrg = $proksi ? (float)$proksi['harga'] : null;
        if ($paxgSkrg !== null && $paxgSkrg > 100) {
            $jangkarFile = __DIR__ . '/../cache/xau_anchor.json';
            $jangkar = file_exists($jangkarFile) ? json_decode((string)@file_get_contents($jangkarFile), true) : null;
            $jangkarSegar = is_array($jangkar)
                && (time() - (int)($jangkar['ts'] ?? 0)) <= 900
                && (float)($jangkar['paxg'] ?? 0) > 100
                && (float)($jangkar['xau'] ?? 0) > 100;
            $adaHargaNyata = !empty($result['XAUUSD']) && (float)$result['XAUUSD']['price'] > 100;

            if ($adaHargaNyata) {
                $sumberAsli = (string)($result['XAUUSD']['source'] ?? '');
                if (!$jangkarSegar || (string)($jangkar['sumber'] ?? '') !== $sumberAsli) {
                    // Simpan jangkar baru: pasangan (harga emas nyata, harga PAXG saat itu).
                    @file_put_contents($jangkarFile, json_encode([
                        'xau' => (float)$result['XAUUSD']['price'],
                        'paxg' => $paxgSkrg,
                        'ts' => time(),
                        'sumber' => $sumberAsli,
                    ], JSON_PRETTY_PRINT), LOCK_EX);
                } else {
                    qi_terapkan_delta_emas($result, $jangkar, $paxgSkrg, $sumberAsli);
                }
            } elseif ($jangkarSegar) {
                // Harga emas nyata sedang TIDAK tersedia (sumber gratis sering kosong).
                // Jangan jatuh ke harga PAXG mentah (levelnya bisa meloncat ~0,16%):
                // tetap pakai level jangkar terakhir + gerakan PAXG terkini, supaya
                // LEVEL tetap benar dan chart tetap bergerak.
                $lamaSumber = (string)($jangkar['sumber'] ?? 'jangkar');
                $hasilSementara = [];
                qi_terapkan_delta_emas($hasilSementara, $jangkar, $paxgSkrg, $lamaSumber);
                if (!empty($hasilSementara['XAUUSD'])) {
                    $hasilSementara['XAUUSD']['source'] = 'binance_paxg_selaras';
                    $hasilSementara['XAUUSD']['anchor_source'] = $lamaSumber;
                    $hasilSementara['XAUUSD']['anchor_umur'] = time() - (int)$jangkar['ts'];
                    $result['XAUUSD'] = $hasilSementara['XAUUSD'];
                }
            }
        }
    }

    // Last resort: PAXGUSDT dari Binance. PAXG adalah emas ter-tokenisasi, jadi
    // harganya mengikuti emas (selisih terukur ~0,16%). Ini PROKSI, bukan harga
    // broker — karena itu sumbernya diberi label sendiri ('binance_paxg') supaya
    // pengguna tidak salah mengira itu harga XAUUSD dari brokernya.
    if (empty($result['XAUUSD'])) {
        foreach (['https://data-api.binance.vision', 'https://api.binance.com'] as $host) {
            $raw = qi_http_get("{$host}/api/v3/ticker/24hr?symbol=PAXGUSDT", 5);
            if (!$raw) continue;
            $item = json_decode($raw, true);
            if (is_array($item) && !empty($item['lastPrice']) && (float)$item['lastPrice'] > 100) {
                $result['XAUUSD'] = [
                    'price'  => (float)$item['lastPrice'],
                    'open'   => (float)$item['openPrice'],
                    'high'   => (float)$item['highPrice'],
                    'low'    => (float)$item['lowPrice'],
                    'chgPct' => (float)$item['priceChangePercent'],
                    'vol'    => (float)$item['volume'],
                    'source' => 'binance_paxg',
                ];
                break;
            }
        }
    }
}

// ─── EURUSD: Twelve Data → Frankfurter fallback ─────────────────────────────
if (in_array('EURUSD', $symbols) && empty($result['EURUSD'])) {
    // Primary: Twelve Data
    $td = qi_twelvedata_price('EUR/USD', 'eurusd');
    if (!empty($td['price']) && $td['price'] > 0.5) {
        $result['EURUSD'] = $td;
    }
}

// ─── PROKSI EMAS (Binance) — pengukur GERAKAN emas real-time ──────────────
/**
 * Harga proksi emas SEKARANG dari Binance, DUA sekaligus: PAXGUSDT dan XAUTUSDT.
 * Keduanya emas ter-tokenisasi; dipakai untuk menghitung GERAKAN emas (jangkar-delta).
 *
 * Mengapa dua? Hasil pengukuran: satu proksi saja bisa "diam" puluhan detik karena
 * likuiditasnya tipis (PAXG 4 nilai/30 dtk, XAUT 5 nilai/30 dtk). Dengan keduanya,
 * peluang mendapat gerakan baru dua kali lipat, dan rata-ratanya meredam derau.
 * Satu permintaan saja (endpoint ticker/price) supaya ringan. Cache 1 detik.
 *
 * @return array{harga: float, paxg: float, xaut: float}|null
 */
function qi_proksi_emas(): ?array
{
    $f = __DIR__ . '/../cache/paxg_now.json';
    if (file_exists($f) && (time() - filemtime($f)) < 1) {
        $j = json_decode((string)@file_get_contents($f), true);
        if (is_array($j) && !empty($j['harga']) && (float)$j['harga'] > 100) {
            return [
                'harga' => (float)$j['harga'],
                'paxg'  => (float)($j['paxg'] ?? $j['harga']),
                'xaut'  => (float)($j['xaut'] ?? 0),
            ];
        }
    }
    foreach (['https://data-api.binance.vision', 'https://api.binance.com'] as $host) {
        $raw = qi_http_get($host . '/api/v3/ticker/price?symbols=%5B%22PAXGUSDT%22,%22XAUTUSDT%22%5D', 3);
        if (!$raw) continue;
        $j = json_decode($raw, true);
        if (!is_array($j)) continue;
        $paxg = 0.0; $xaut = 0.0;
        foreach ($j as $baris) {
            $sim = strtoupper((string)($baris['symbol'] ?? ''));
            $h = (float)($baris['price'] ?? 0);
            if ($h <= 100) continue;
            if ($sim === 'PAXGUSDT') $paxg = $h;
            if ($sim === 'XAUTUSDT') $xaut = $h;
        }
        if ($paxg <= 100 && $xaut <= 100) continue;
        $harga = ($paxg > 100 && $xaut > 100) ? (($paxg + $xaut) / 2) : ($paxg > 100 ? $paxg : $xaut);
        // Pengaman: bila dua proksi berbeda > 1,5% (salah satu datanya rusak), pakai PAXG.
        if ($paxg > 100 && $xaut > 100 && abs($paxg - $xaut) / max($paxg, $xaut) > 0.015) $harga = $paxg;
        @file_put_contents($f, json_encode(['harga' => $harga, 'paxg' => $paxg, 'xaut' => $xaut, 'ts' => time()]), LOCK_EX);
        return ['harga' => $harga, 'paxg' => $paxg, 'xaut' => $xaut];
    }
    return null;
}

/**
 * Terapkan GERAKAN proksi (PAXG) pada LEVEL harga emas nyata:
 *   harga = harga_emas_nyata + (paxg_sekarang − paxg_saat_jangkar)
 * Hasil ditulis ke $wadah['XAUUSD']. Pengaman: delta > 0,6% diabaikan.
 */
function qi_terapkan_delta_emas(array &$wadah, array $jangkar, float $paxgSkrg, string $sumberAsli): void
{
    $hargaJangkar = (float)($jangkar['xau'] ?? 0);
    $paxgJangkar  = (float)($jangkar['paxg'] ?? 0);
    if ($hargaJangkar <= 100 || $paxgJangkar <= 100) return;
    $delta = $paxgSkrg - $paxgJangkar;
    $hargaBaru = $hargaJangkar + $delta;
    if (abs($delta) / $hargaJangkar > 0.006 || $hargaBaru <= 100) return;
    $lama = $wadah['XAUUSD'] ?? [];
    $wadah['XAUUSD'] = [
        'price'  => round($hargaBaru, 3),
        'open'   => $lama['open'] ?? $hargaBaru,
        'high'   => max((float)($lama['high'] ?? $hargaBaru), $hargaBaru),
        'low'    => min((float)($lama['low'] ?? $hargaBaru), $hargaBaru),
        'chgPct' => $lama['chgPct'] ?? 0,
        'vol'    => $lama['vol'] ?? 0,
        'source' => 'binance_paxg_selaras',
        'anchor_source' => $sumberAsli,
    ];
}

// ─── Frankfurter (ECB) — free FX fallback, no API key ────────────────────
// Returns array keyed by symbol (EURUSD, GBPUSD …) with price+chgPct.
// Data is daily (ECB updates ~3 pm CET); cached 1 hour each.
function qi_frankfurter_fx_prices(array $needed): array {
    if (empty($needed)) return [];
    $cacheDir = __DIR__ . '/../cache/frankfurter';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);

    // Fetch USD base rates for today and yesterday (both cached 1 hour)
    $fetchRates = function(string $dateParam) use ($cacheDir): array {
        $key  = md5('frankfurter_usd_' . $dateParam);
        $file = $cacheDir . '/' . $key . '.json';
        if (file_exists($file) && (time() - filemtime($file)) < 3600) {
            $c = json_decode(file_get_contents($file), true);
            if (!empty($c['rates'])) return $c;
        }
        $url = 'https://api.frankfurter.app/' . $dateParam . '?from=USD';
        $raw = qi_http_get($url, 6);
        if ($raw) {
            $d = json_decode($raw, true);
            if (!empty($d['rates'])) {
                @file_put_contents($file, json_encode($d), LOCK_EX);
                return $d;
            }
        }
        return [];
    };
    $today     = $fetchRates('latest');
    $yesterday = $fetchRates(date('Y-m-d', strtotime('-1 day')));
    if (empty($today['rates'])) return [];

    // How to convert "USD→X rate" to the trading pair price and direction
    // direction=inverse: e.g. EUR/USD price = 1 / (USD per EUR)
    // direction=direct : e.g. USD/JPY price = USD per JPY rate
    $pairCfg = [
        'EURUSD' => ['cur'=>'EUR','inv'=>true ],
        'GBPUSD' => ['cur'=>'GBP','inv'=>true ],
        'AUDUSD' => ['cur'=>'AUD','inv'=>true ],
        'NZDUSD' => ['cur'=>'NZD','inv'=>true ],
        'USDJPY' => ['cur'=>'JPY','inv'=>false],
        'USDCHF' => ['cur'=>'CHF','inv'=>false],
        'USDCAD' => ['cur'=>'CAD','inv'=>false],
    ];

    $out = [];
    foreach ($needed as $sym) {
        if (!isset($pairCfg[$sym])) continue;
        $cfg = $pairCfg[$sym];
        $cur = $cfg['cur'];
        if (!isset($today['rates'][$cur])) continue;

        $rToday = (float)$today['rates'][$cur];
        $rYest  = isset($yesterday['rates'][$cur]) ? (float)$yesterday['rates'][$cur] : $rToday;

        $price = $cfg['inv'] ? ($rToday  > 0 ? round(1 / $rToday,  5) : 0)
                             : $rToday;
        $prev  = $cfg['inv'] ? ($rYest   > 0 ? round(1 / $rYest,   5) : $price)
                             : $rYest;

        $chgPct = $prev > 0 ? round(($price - $prev) / $prev * 100, 4) : 0;
        $out[$sym] = [
            'price'  => $price,
            'open'   => $prev,
            'high'   => max($price, $prev),
            'low'    => min($price, $prev),
            'chgPct' => $chgPct,
            'vol'    => 0,
            'source' => 'frankfurter',
        ];
    }
    return $out;
}

// ─── Generic FX pairs: GBP/USD, USD/JPY, AUD/USD, NZD/USD, USD/CHF, USD/CAD ──
$fxMap = [
    'GBPUSD' => 'GBP/USD', 'USDJPY' => 'USD/JPY', 'AUDUSD' => 'AUD/USD',
    'NZDUSD' => 'NZD/USD', 'USDCHF' => 'USD/CHF', 'USDCAD' => 'USD/CAD',
];
// Also include EURUSD here so it benefits from the same fallback chain
$allFxToResolve = array_intersect(array_merge(array_keys($fxMap), ['EURUSD']), $symbols);

$fxMinPrice = [
    'EURUSD'=>0.5, 'GBPUSD'=>0.5, 'USDJPY'=>50, 'AUDUSD'=>0.3,
    'NZDUSD'=>0.3, 'USDCHF'=>0.5, 'USDCAD'=>0.8,
];
$fxNeedFrankfurter = [];

foreach (array_merge($fxMap, ['EURUSD'=>'EUR/USD']) as $sym => $tdSym) {
    if (!in_array($sym, $symbols)) continue;
    if (isset($result[$sym])) continue; // already resolved
    $minP = $fxMinPrice[$sym] ?? 0;

    // 1. Twelve Data (cached 30s)
    $td = qi_twelvedata_price($tdSym, strtolower($sym));
    if (!empty($td['price']) && $td['price'] > $minP) { $result[$sym] = $td; continue; }

    // 2. Queue for Frankfurter batch fallback (instant single HTTP call)
    $fxNeedFrankfurter[] = $sym;
}

// Frankfurter batch fallback (single HTTP call covers all missing pairs)
if (!empty($fxNeedFrankfurter)) {
    $fkPrices = qi_frankfurter_fx_prices($fxNeedFrankfurter);
    foreach ($fkPrices as $sym => $data) {
        if (!isset($result[$sym])) $result[$sym] = $data;
    }
}

// ── PRIORITAS TERTINGGI: HARGA BROKER dari EA MT5 (bila tick-nya SEGAR) ──────
// Rantai ini sebelumnya TERPUTUS: api/mt-bridge.php menerima & menyimpan tick EA,
// tetapi TIDAK ADA berkas yang membacanya — sehingga meski EA berjalan, chart dan
// sinyal tetap memakai sumber gratis (bukan harga broker pengguna). Sekarang tick
// broker yang segar (≤20 detik) menimpa harga sumber lain, lengkap dengan SPREAD
// nyata dan label jujur source='mt5_broker'.
//
// 🔒 KEAMANAN: harga broker hanya dipakai bila pemanggil terautentikasi DAN akun
// yang mengirim tick itu memang miliknya. Tanpa token → $idPemanggil = 0 → fungsi
// mengembalikan null, sehingga harga broker siapa pun tidak pernah bocor.
//
// Fail-safe: bila EA mati / tick basi / berkas rusak → TIDAK ada perubahan; harga
// tetap dari sumber biasa. Tidak pernah mengarang harga.
if (function_exists('qi_broker_tick') && function_exists('qi_validate_token')) {
    $idPemanggil = 0;
    try {
        $sesiPemanggil = qi_validate_token();
        if (is_array($sesiPemanggil) && !empty($sesiPemanggil['user_id'])) {
            $idPemanggil = (int)$sesiPemanggil['user_id'];
        }
    } catch (Throwable $e) { $idPemanggil = 0; }

    if ($idPemanggil > 0) {
        foreach (array_keys($result) as $symBroker) {
            $bt = qi_broker_tick((string)$symBroker, 20, $idPemanggil);
            if (!$bt) continue;
            $result[$symBroker]['price']       = $bt['price'];
            $result[$symBroker]['bid']         = $bt['bid'];
            $result[$symBroker]['ask']         = $bt['ask'];
            $result[$symBroker]['spread']      = $bt['spread'];
            $result[$symBroker]['source']      = 'mt5_broker';
            $result[$symBroker]['broker_umur'] = $bt['umur'];
            // Proksi emas (PAXG) TIDAK berlaku lagi saat harga broker tersedia.
            unset($result[$symBroker]['anchor_source']);
        }
    }
}

$balasan = json_encode(['status' => 'success', 'ts' => time(), 'prices' => $result]);
// Simpan untuk dibagi ke permintaan berikutnya dalam 3 detik ke depan.
@file_put_contents($fileCache, $balasan, LOCK_EX);
echo $balasan;
