<?php
/**
 * Quantum AI Signal Engine
 * GET ?symbol=BTCUSDT  → AI analysis + trade decision
 * Auth required. Cached 15 min per symbol.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(15, 60);

$user = qi_require_auth();

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

// ── Signal calculation (EMA / RSI / MACD) ─────────────────────────────────
function ai_load_candles(string $sym, string $interval): array {
    $cacheDir  = __DIR__ . '/../cache/chart';
    $cacheFile = $cacheDir . '/' . md5($sym . '_' . $interval) . '.json';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 300) {
        $d = json_decode(file_get_contents($cacheFile), true);
        return $d['candles'] ?? [];
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
    return $d['candles'] ?? [];
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
    $candles = ai_load_candles($sym, $iv);
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
        'model'       => 'llama-3.3-70b-versatile',
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

echo json_encode($response);
