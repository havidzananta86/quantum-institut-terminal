<?php
/**
 * Quantum AI Signal Engine
 * GET ?symbol=BTCUSDT  → AI analysis + trade decision
 * Auth required. Cached 15 min per symbol.
 */
// ── PELINDUNG LIBRARY ─────────────────────────────────────────────────────
// Berkas ini bisa DIPAKAI ULANG oleh endpoint lain (mis. webhook TradingView)
// dengan mendefinisikan QI_AI_SIGNAL_LIB lebih dulu. Saat itu terjadi, hanya
// fungsi analisa di bawah yang dimuat — titik masuk HTTP (auth/rate-limit/cache)
// dan pemanggilan Groq TIDAK dijalankan. Perilaku sebagai endpoint HTTP tetap
// sama persis seperti sebelumnya.
if (!defined('QI_AI_SIGNAL_LIB')) {
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(15, 60);

$user = qi_require_level('pro');  // AI Radar — PRO

$symbol = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 12)) : 'BTCUSDT';

$ALLOWED = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','XRPUSDT'];
if (!in_array($symbol, $ALLOWED, true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Simbol tidak didukung']);
    exit;
}

// ── Cache check (15 min per symbol) ───────────────────────────────────────
$cacheDir  = __DIR__ . '/../cache/ai_signals';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = $cacheDir . '/' . $symbol . '.json';

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 900) {
    $cached = json_decode(file_get_contents($cacheFile), true);
    if ($cached && isset($cached['status'])) {
        $cached['from_cache'] = true;
        echo json_encode($cached);
        exit;
    }
}
} // ── akhir titik masuk ─────────────────────────────────────────────────────

// ── Signal calculation (EMA / RSI / MACD) ─────────────────────────────────
/**
 * Ambil candle untuk analisa.
 * Mengembalikan ['candles' => array, 'simulated' => bool]. Penanda simulated WAJIB
 * diteruskan ke pemanggil: get-chart-data.php menghasilkan candle ACAK bila sumber
 * harga gagal, dan candle acak tidak boleh dipakai untuk mengambil keputusan.
 */
function ai_load_candles(string $sym, string $interval): array {
    $cacheDir  = __DIR__ . '/../cache/chart';
    $cacheFile = $cacheDir . '/' . md5($sym . '_' . $interval) . '.json';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 300) {
        $d = json_decode(file_get_contents($cacheFile), true);
        // Cache hanya menyimpan data nyata (candle simulasi tidak pernah di-cache).
        return ['candles' => $d['candles'] ?? [], 'simulated' => false];
    }
    if (!defined('QI_INCLUDED_BY_SIGNALS')) define('QI_INCLUDED_BY_SIGNALS', true);
    ob_start();
    $origGet = $_GET;
    $_GET['symbol']   = $sym;
    $_GET['interval'] = $interval;
    include __DIR__ . '/get-chart-data.php';
    $raw = ob_get_clean();
    $_GET = $origGet;
    $d = json_decode($raw, true);
    if (!is_array($d)) return ['candles' => [], 'simulated' => false];
    return ['candles' => $d['candles'] ?? [], 'simulated' => !empty($d['simulated'])];
}

function ai_ema(array $closes, int $period): ?float {
    if (count($closes) < $period) return null;
    $k = 2 / ($period + 1);
    $ema = array_sum(array_slice($closes, 0, $period)) / $period;
    for ($i = $period; $i < count($closes); $i++) $ema = $closes[$i] * $k + $ema * (1 - $k);
    return $ema;
}

function ai_rsi(array $closes, int $period = 14): float {
    $n = count($closes);
    if ($n < $period + 1) return 50.0;
    $g = 0; $l = 0;
    for ($i = 1; $i <= $period; $i++) {
        $d = $closes[$i] - $closes[$i - 1];
        if ($d > 0) $g += $d; else $l -= $d;
    }
    $g /= $period; $l /= $period;
    for ($i = $period + 1; $i < $n; $i++) {
        $d = $closes[$i] - $closes[$i - 1];
        $g = ($g * ($period - 1) + max(0, $d)) / $period;
        $l = ($l * ($period - 1) + max(0, -$d)) / $period;
    }
    return $l == 0 ? 100 : 100 - 100 / (1 + $g / $l);
}

function ai_macd_hist(array $closes): float {
    if (count($closes) < 35) return 0;
    $series = [];
    for ($i = 26; $i <= count($closes); $i++) {
        $sl = array_slice($closes, 0, $i);
        $e12 = ai_ema($sl, 12); $e26 = ai_ema($sl, 26);
        if ($e12 && $e26) $series[] = $e12 - $e26;
    }
    $sig  = ai_ema($series, 9);
    $last = end($series);
    return $last - ($sig ?? 0);
}

function ai_analyze(string $sym, string $iv): ?array {
    $loaded = ai_load_candles($sym, $iv);
    // Data simulasi = candle acak: jangan dianalisa sama sekali.
    if (!empty($loaded['simulated'])) return null;
    $candles = $loaded['candles'];
    if (count($candles) < 55) return null;
    $closes = array_column($candles, 'close');
    $last   = end($closes);
    $ema20  = ai_ema($closes, 20);
    $ema50  = ai_ema($closes, 50);
    $rsi    = ai_rsi(array_slice($closes, -30), 14);
    $macdH  = ai_macd_hist(array_slice($closes, -60));

    $bull = 0; $bear = 0;
    if ($ema20 && $ema50) {
        if ($ema20 > $ema50) $bull++; else $bear++;
        if ($last  > $ema20) $bull++; else $bear++;
    }
    if ($rsi  > 55) $bull++; elseif ($rsi  < 45) $bear++;
    if ($macdH > 0) $bull++; elseif ($macdH < 0) $bear++;

    $signal = $bull >= 3 ? 'BULLISH' : ($bear >= 3 ? 'BEARISH' : 'NEUTRAL');
    return [
        'signal'    => $signal,
        'rsi'       => round($rsi, 1),
        'ema20'     => $ema20 ? round($ema20, 5) : null,
        'ema50'     => $ema50 ? round($ema50, 5) : null,
        'ema_cross' => ($ema20 && $ema50) ? ($ema20 > $ema50 ? 'UP' : 'DOWN') : null,
        'macd_hist' => round($macdH, 6),
        'bull_pts'  => $bull,
        'bear_pts'  => $bear,
        'price'     => round((float)$last, 5),
    ];
}

// ── Bagian ini hanya berjalan saat dipanggil sebagai endpoint HTTP ────────
if (!defined('QI_AI_SIGNAL_LIB')) {

// ── Collect multi-TF data ─────────────────────────────────────────────────
$tfs = [];
foreach (['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'] as $iv => $label) {
    $tfs[$label] = ai_analyze($symbol, $iv);
}

$price = 0;
foreach (['H1','H4','D1','M15'] as $pf) {
    if ($tfs[$pf] && $tfs[$pf]['price'] > 0) { $price = $tfs[$pf]['price']; break; }
}

$bullTfs = count(array_filter($tfs, fn($t) => $t && $t['signal'] === 'BULLISH'));
$bearTfs = count(array_filter($tfs, fn($t) => $t && $t['signal'] === 'BEARISH'));
$overall = $bullTfs >= 3 ? 'BULLISH' : ($bearTfs >= 3 ? 'BEARISH' : 'NEUTRAL');

// Tidak ada satu pun timeframe dengan data nyata → jangan panggil AI dan jangan
// simpan hasilnya. Tanpa penjaga ini prompt berisi "NO_DATA" dengan harga 0, dan
// model bisa mengarang keputusan yang tampak valid.
if (!array_filter($tfs)) {
    echo json_encode([
        'status'  => 'error',
        'code'    => 'PRICE_UNAVAILABLE',
        'message' => 'Data harga live belum tersedia, analisa AI ditahan agar tidak memakai data kosong atau simulasi. Coba lagi sebentar lagi.',
    ]);
    exit;
}

// ── Build Groq prompt ─────────────────────────────────────────────────────
$tfLines = [];
foreach ($tfs as $label => $d) {
    if (!$d) { $tfLines[] = "{$label}: NO_DATA"; continue; }
    $tfLines[] = sprintf('%s: %s | RSI:%.1f | EMA:%s | MACD:%s | bull:%d bear:%d',
        $label, $d['signal'], $d['rsi'],
        $d['ema_cross'] ?? 'N/A',
        $d['macd_hist'] > 0 ? 'POS' : ($d['macd_hist'] < 0 ? 'NEG' : 'ZERO'),
        $d['bull_pts'], $d['bear_pts']
    );
}

$prompt = "Analyze this multi-timeframe technical data and return a JSON trading decision.

Symbol: {$symbol}
Price: {$price}
Overall Consensus: {$overall} ({$bullTfs}/4 bullish, {$bearTfs}/4 bearish)

Timeframes:
" . implode("\n", $tfLines) . "

Rules:
- ENTRY_BUY: ≥3 timeframes BULLISH, RSI not >70, confident uptrend
- ENTRY_SELL: ≥3 timeframes BEARISH, RSI not <30, confirmed downtrend
- SKIP: conflicting signals, choppy market, borderline conditions
- Set TP at 1.5-2.5x the SL distance (good risk:reward)
- For crypto: SL = ~1-2% from entry; for forex: SL = 20-50 pips
- Confidence 65-90 for ENTRY; 30-60 for SKIP

Respond with ONLY valid JSON (no markdown, no extra text):
{\"action\":\"ENTRY_BUY\",\"confidence\":75,\"entry_price\":0,\"tp\":0,\"sl\":0,\"risk_reward\":2.0,\"reason\":\"alasan singkat max 80 karakter\"}";

// ── Call Groq ─────────────────────────────────────────────────────────────
$groqKey = '';
$apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($apiKeysFile)) {
    include_once $apiKeysFile;
    $groqKey = defined('GROQ_API_KEY') ? GROQ_API_KEY : '';
}

if (!$groqKey) {
    echo json_encode(['status' => 'error', 'message' => 'Groq API key belum dikonfigurasi']);
    exit;
}

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $groqKey,
    ],
    CURLOPT_POSTFIELDS => json_encode([
        // Model aktif. Groq rutin mempensiunkan model, jadi nama model disimpan di
        // konstanta GROQ_SIGNAL_MODEL (config/api_keys.php) agar bisa diganti tanpa
        // menyentuh kode. Default di bawah sudah diverifikasi aktif.
        'model'       => defined('GROQ_SIGNAL_MODEL') ? GROQ_SIGNAL_MODEL : 'qwen/qwen3.8-27b',
        'messages'    => [
            ['role' => 'system', 'content' => 'You are a professional trading analyst. Always respond with valid JSON only. No markdown, no explanation outside the JSON.'],
            ['role' => 'user',   'content' => $prompt],
        ],
        'max_tokens'  => 180,
        'temperature' => 0.15,
    ]),
]);
$result   = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$result || $httpCode !== 200) {
    error_log('[AI Signal] Groq error ' . $httpCode . ': ' . substr((string)$result, 0, 200));
    echo json_encode(['status' => 'error', 'message' => 'Groq API tidak tersedia saat ini']);
    exit;
}

$groqData   = json_decode($result, true);
$rawContent = trim($groqData['choices'][0]['message']['content'] ?? '');

// Parse decision — try raw, then extract JSON block
$decision = json_decode($rawContent, true);
if (!$decision || !isset($decision['action'])) {
    preg_match('/\{[^{}]+\}/s', $rawContent, $m);
    $decision = $m ? json_decode($m[0], true) : null;
}

if (!$decision || !in_array($decision['action'] ?? '', ['ENTRY_BUY','ENTRY_SELL','SKIP'])) {
    error_log('[AI Signal] Bad AI response for ' . $symbol . ': ' . substr($rawContent, 0, 300));
    echo json_encode(['status' => 'error', 'message' => 'AI response tidak valid', 'raw' => substr($rawContent, 0, 200)]);
    exit;
}

$action = $decision['action'];
$ep     = (float)($decision['entry_price'] ?? $price);
if ($ep <= 0) $ep = $price;

$response = [
    'status'      => 'success',
    'symbol'      => $symbol,
    'timestamp'   => date('Y-m-d H:i:s'),
    'price'       => (float)$price,
    'action'      => $action,
    'confidence'  => max(0, min(100, (int)($decision['confidence'] ?? 50))),
    'entry_price' => round($ep, 5),
    'tp'          => round((float)($decision['tp'] ?? 0), 5),
    'sl'          => round((float)($decision['sl'] ?? 0), 5),
    'risk_reward' => round((float)($decision['risk_reward'] ?? 0), 2),
    'reason'      => mb_substr(preg_replace('/[^\w\s.,!?:%()\/&-]/u', '', $decision['reason'] ?? ''), 0, 100),
    'timeframes'  => $tfs,
    'consensus'   => ['bullish_tfs' => $bullTfs, 'bearish_tfs' => $bearTfs, 'overall' => $overall],
    'from_cache'  => false,
];

// Cache 15 min
file_put_contents($cacheFile, json_encode($response));

// ── CATAT SINYAL AI KE REKOR (hanya bila benar-benar layak) ────────────────
// Berada DI DALAM penjaga QI_AI_SIGNAL_LIB, jadi pemakaian sebagai library
// (pembangkit otomatis & webhook TradingView) TIDAK ikut mencatat — keduanya
// sudah punya label mesinnya sendiri dan pagarnya sendiri.
//
// Pagar lengkap ada di api/_signal_record.php (teruji di tests/signal-record.test.php):
// hanya ENTRY_BUY/ENTRY_SELL, level wajib konsisten, tidak menduplikasi sinyal
// AKTIF sejenis, cooldown 4 jam per simbol, jeda global 20 menit per mesin, dan
// klaim atomik saat menulis. Endpoint ini TIDAK BOLEH gagal karena pencatatan →
// semuanya dibungkus dan kesalahannya hanya dicatat ke log.
require_once __DIR__ . '/_signal_record.php';
try {
    $response['dicatat'] = false;
    $response['catatan_rekor'] = 'Tidak ada sinyal untuk dicatat (keputusan AI: ' . $action . ').';

    if (in_array($action, ['ENTRY_BUY', 'ENTRY_SELL'], true)) {
        $arahRek = ($action === 'ENTRY_BUY') ? 'BUY' : 'SELL';
        $epRek   = (float)$response['entry_price'];
        $tpRek   = (float)$response['tp'];
        $slRek   = (float)$response['sl'];
        $basisLevel = 'level dari AI';

        // Bila AI memberi arah tetapi levelnya tidak konsisten, level diturunkan
        // dari ATR14 candle H1 NYATA — bukan dikarang. Arah tetap dari AI, jarak
        // dari volatilitas nyata, dan asal level ditulis apa adanya di 'basis'.
        if (!qi_signal_level_sah($arahRek, $epRek, $tpRek, $slRek)) {
            $muatRek = ai_load_candles($symbol, '60');
            if (!empty($muatRek['candles']) && empty($muatRek['simulated'])) {
                $cndRek = $muatRek['candles'];
                $nRek = count($cndRek);
                $atrRek = 0.0;
                $pcRek = (float)($cndRek[$nRek - 1]['close'] ?? 0);
                if ($nRek >= 16 && $pcRek > 0) {
                    $trRek = [];
                    for ($i = $nRek - 14; $i < $nRek; $i++) {
                        $hh = (float)($cndRek[$i]['high'] ?? 0);
                        $ll = (float)($cndRek[$i]['low'] ?? 0);
                        $pp = (float)($cndRek[$i - 1]['close'] ?? 0);
                        $trRek[] = max($hh - $ll, abs($hh - $pp), abs($ll - $pp));
                    }
                    $atrRek = $trRek ? array_sum($trRek) / count($trRek) : 0.0;
                }
                if ($atrRek > 0) {
                    $epRek = round($pcRek, 5);
                    $slRek = round($arahRek === 'BUY' ? $pcRek - 1.2 * $atrRek : $pcRek + 1.2 * $atrRek, 5);
                    $tpRek = round($arahRek === 'BUY' ? $pcRek + 3.0 * $atrRek : $pcRek - 3.0 * $atrRek, 5);
                    $basisLevel = 'level dari ATR14 (AI tidak memberi level yang konsisten)';
                }
            }
        }

        if (qi_signal_level_sah($arahRek, $epRek, $tpRek, $slRek)) {
            // Filter berita High impact: tahan pencatatan (bukan menahan analisa).
            $boRek = function_exists('qi_berita_blackout') ? qi_berita_blackout(30, true) : ['aktif' => false];
            if (!empty($boRek['aktif'])) {
                $response['catatan_rekor'] = 'Ditahan filter berita berdampak tinggi (' . ($boRek['event']['judul'] ?? '-') . ').';
            } else {
                $jarakRek = abs($epRek - $slRek);
                $rrRek = $jarakRek > 0 ? abs($tpRek - $epRek) / $jarakRek : 0;
                $rek = [
                    'id'               => 'SIG-AI-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
                    'timestamp'        => qi_sig_waktu_utc(),                 // ISO 8601 UTC (api/_signal_time.php)
                    'expiry'           => qi_sig_waktu_utc(time() + 12 * 3600),
                    'symbol'           => $symbol,
                    'engine'           => 'AI',
                    'engine_name'      => 'Analisa AI (Groq)',
                    'timeframe'        => 'MTF',
                    'side'             => $arahRek,
                    'entry'            => round($epRek, 5),
                    'sl'               => round($slRek, 5),
                    'tp'               => round($tpRek, 5),
                    'rr'               => '1 : ' . number_format($rrRek, 2),
                    'atr'              => 0,
                    'invalidation'     => $response['reason'] !== '' ? $response['reason'] : 'Level TP/SL tersentuh',
                    'status'           => 'AKTIF',
                    'pnl'              => 0,
                    'pnl_usd'          => 0,
                    'mtf_aligned'      => ($overall === ($arahRek === 'BUY' ? 'BULLISH' : 'BEARISH')),
                    'confluence_score' => (int)$response['confidence'],
                    'confidence'       => (int)$response['confidence'],
                    'sumber'           => 'ai_signal',
                    'basis'            => 'Arah dari AI (keyakinan ' . (int)$response['confidence'] . '); ' . $basisLevel,
                    'ai_rr'            => (float)$response['risk_reward'],
                    'konsensus'        => ['bull' => $bullTfs, 'bear' => $bearTfs, 'overall' => $overall],
                ];
                $catat = qi_signal_catat($rek, 4, 20);
                $response['dicatat'] = (bool)$catat['dicatat'];
                $response['catatan_rekor'] = $catat['dicatat']
                    ? ('Masuk rekor publik sebagai ' . $rek['id'] . ' dan akan dinilai otomatis saat TP/SL tersentuh.')
                    : ('Tidak dicatat: ' . $catat['alasan'] . (isset($catat['detail']['sisa_menit']) ? (' (sisa ' . $catat['detail']['sisa_menit'] . ' menit)') : ''));
                if ($catat['dicatat']) $response['id_sinyal'] = $rek['id'];
            }
        } else {
            $response['catatan_rekor'] = 'Tidak dicatat: level tidak dapat dibentuk dari data nyata.';
        }
    }
} catch (Throwable $eRek) {
    error_log('[AI Signal] pencatatan rekor gagal: ' . $eRek->getMessage());
    $response['catatan_rekor'] = 'Pencatatan rekor dilewati karena kesalahan internal (analisa tetap sah).';
}

echo json_encode($response);

} // ── akhir bagian endpoint HTTP ────────────────────────────────────────────
