<?php
/**
 * Quantum Institut — AI Trading Assistant
 * Uses Groq API (free tier). Model aktif: qwen/qwen3.8-27b — dapat diganti lewat
 * konstanta GROQ_CHAT_MODEL / GROQ_VISION_MODEL di config/api_keys.php.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(20, 60);

// Cek hidup untuk status.html: tanpa login, tanpa memanggil Groq (dulu dicek lewat POST
// anonim yang selalu 401 dan memunculkan galat merah di konsol).
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['ping'])) {
    echo json_encode(['status' => 'ok']);
    exit;
}

// Tiap panggilan membakar kuota Groq API, jadi endpoint ini wajib login.
// Rate limit per-IP saja tidak cukup — rotasi IP bisa menguras kuota.
qi_require_level('pro');            // AI Assistant — PRO

// Load Groq API key from config (add GROQ_API_KEY to config/api_keys.php)
$groqKey = '';
$apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($apiKeysFile)) {
    include $apiKeysFile;
    $groqKey = defined('GROQ_API_KEY') ? GROQ_API_KEY : '';
}

// Nama model ditaruh di config supaya penggantian model (Groq rutin mempensiunkan
// model) tidak perlu mengubah kode. GROQ_VISION_MODEL hanya diisi bila akun benar-benar
// punya model vision — model teks akan menolak gambar dengan HTTP 400.
$chatModel   = defined('GROQ_CHAT_MODEL') ? GROQ_CHAT_MODEL : 'qwen/qwen3.8-27b';
$visionModel = defined('GROQ_VISION_MODEL') ? GROQ_VISION_MODEL : '';

$body = qi_get_json_body();
if (!$body) { http_response_code(400); echo json_encode(['error'=>'Invalid JSON']); exit; }
$message  = trim(qi_str($body['message'] ?? null));
$history  = array_slice((array)($body['history'] ?? []), -12);
$context  = $body['context'] ?? [];  // real-time market data from dashboard

$image    = $body['image'] ?? null; // base64 / data:image/png;base64,...

if (!$message && !$image) { echo json_encode(['error'=>'Pesan atau gambar kosong']); exit; }

// Tanpa model vision, gambar tidak dikirim ke model teks: API akan menolaknya dan
// pengguna hanya melihat error umum. Jawab jelas supaya tidak terkesan AI-nya rusak.
if ($image && !$visionModel) {
    echo json_encode([
        'reply'    => 'Analisis gambar chart belum tersedia: model AI yang aktif sekarang hanya membaca teks. Kirim pertanyaannya dalam bentuk teks — sebutkan simbol, harga entry, level kunci, serta SL/TP — dan saya analisa dari data tersebut.',
        'fallback' => true,
        'vision'   => false,
    ]);
    exit;
}

// Build market context block if provided
$ctxBlock = '';
if (!empty($context['prices']) && is_array($context['prices'])) {
    $ctxBlock .= "\n\n=== DATA PASAR LIVE (dari TradingView Scanner) ===\n";
    foreach (array_slice($context['prices'], 0, 25) as $sym => $d) {
        if (!is_string($sym) || !preg_match('/^[A-Za-z0-9\/_.:-]{1,30}$/', $sym)) continue;
        $price = isset($d['price']) ? (float)$d['price'] : 0;
        $chg = isset($d['chgPct']) ? (float)$d['chgPct'] : 0;
        $ctxBlock .= "{$sym}: " . number_format($price, 4) . " (" . ($chg >= 0 ? '+' : '') . number_format($chg, 2) . "%)\n";
    }
}
if (!empty($context['signals']) && is_array($context['signals'])) {
    $ctxBlock .= "\n=== SINYAL MTF (TradingView Scanner) ===\n";
    foreach (array_slice($context['signals'], 0, 25) as $sym => $tfs) {
        if (!is_string($sym) || !preg_match('/^[A-Za-z0-9\/_.:-]{1,30}$/', $sym)) continue;
        if (!is_array($tfs)) continue;
        $line = "{$sym}: ";
        foreach ($tfs as $tf => $s) {
            if (!preg_match('/^[A-Za-z0-9]{1,10}$/', $tf)) continue;
            $line .= "{$tf}:" . preg_replace('/[^A-Za-z0-9_ -]/', '', (string)$s) . " ";
        }
        $ctxBlock .= trim($line) . "\n";
    }
}

$systemPrompt = 'Kamu adalah QUANTUM AI — asisten trading cerdas dari Quantum Institut. '
    . 'Kamu memiliki kemampuan analisa teknikal profesional' . ($visionModel ? ' dan penglihatan chart (Vision)' : '') . '. '
    . 'Keahlianmu meliputi: Smart Money Concepts (SMC), Order Block, Fair Value Gap (FVG), Support/Resistance, '
    . 'analisa pola candlestick, Fibonacci, dan manajemen risiko ketat. '
    . 'Ketika user mengirim gambar screenshot chart, bedah strukturnya: 1) Market Trend/Bias, 2) Level Entry & S/R, 3) Rekomendasi SL dan TP terukur. '
    . 'DISCLAIMER: Edukasi analisa trading, bukan anjuran finansial mutlak.'
    . ($ctxBlock ? $ctxBlock : '');

$messages = [['role'=>'system','content'=>$systemPrompt]];
foreach ($history as $h) {
    $role = $h['role'] === 'assistant' ? 'assistant' : 'user';
    $messages[] = ['role'=>$role,'content'=>mb_substr(trim($h['content']??''),0,2000)];
}

if ($image) {
    // Multimodal format for vision-capable models (e.g. llama-3.2-11b-vision-preview / gpt-4o / gemini)
    $userContent = [
        ['type' => 'text', 'text' => $message ?: 'Tolong analisa screenshot chart trading ini secara mendalam (Bias, Support/Resistance, Setup Entry, SL, TP).'],
        ['type' => 'image_url', 'image_url' => ['url' => $image]]
    ];
    $messages[] = ['role' => 'user', 'content' => $userContent];
} else {
    $messages[] = ['role' => 'user', 'content' => mb_substr($message, 0, 3000)];
}

if (!$groqKey) {
    // Fallback: simple educational responses without API key
    $fallbackReplies = [
        'RSI'        => 'RSI (Relative Strength Index) mengukur momentum harga. RSI > 70 = overbought (potensi reversal turun), RSI < 30 = oversold (potensi reversal naik). **Divergensi RSI** adalah sinyal kuat: harga buat high baru tapi RSI tidak → bearish divergence.',
        'EMA'        => 'EMA (Exponential Moving Average) memberi bobot lebih pada harga terkini. **Golden Cross**: EMA 20 memotong EMA 50 ke atas → bullish. **Death Cross**: sebaliknya → bearish. EMA 200 adalah support/resistance dinamis jangka panjang.',
        'MACD'       => 'MACD = EMA12 - EMA26. Signal Line = EMA9 dari MACD. **Histogram** di atas 0 → bullish momentum. Crossover MACD line ke atas signal line → entry potensial. Perhatikan divergensi MACD dengan harga.',
        'support'    => 'Support adalah area harga yang berulang kali ditolak untuk turun lebih jauh. Resistance adalah kebalikannya. Ketika support dibreakout → bisa jadi resistance (role reversal). Konfirmasi dengan volume dan candle close.',
        'lot'        => 'Lot size = (Modal × Risk%) / (Stop Loss pips × Pip Value). Contoh: Modal $1000, risk 1% = $10 risiko. SL 20 pip, pip value EURUSD = $1/pip → lot = $10/$20 = 0.5 mini lot. Selalu hitung sebelum entry!',
        'fibonacci'  => 'Fibonacci retracement level utama: 23.6%, 38.2%, 50%, 61.8% (golden ratio), 78.6%. Harga sering berhenti dan reversal di level ini. Gunakan dari swing low ke swing high (uptrend) atau sebaliknya.',
    ];
    $reply = 'Maaf, GROQ_API_KEY belum dikonfigurasi di config/api_keys.php. Tambahkan: `define(\'GROQ_API_KEY\', \'gsk_your_key_here\');`. Dapatkan key gratis di console.groq.com.';
    foreach ($fallbackReplies as $keyword => $resp) {
        if (stripos($message, $keyword) !== false) { $reply = $resp; break; }
    }
    echo json_encode(['reply'=>$reply,'fallback'=>true]);
    exit;
}

// Call Groq API
$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_SSL_VERIFYPEER => QI_DEV ? false : true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $groqKey,
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'model'       => ($image && $visionModel) ? $visionModel : $chatModel,
        'messages'    => $messages,
        'max_tokens'  => 700,
        'temperature' => 0.65,
    ]),
]);
$result  = curl_exec($ch);
$curlErr = curl_error($ch);   // SETELAH curl_exec — sebelumnya selalu kosong, jadi gangguan jaringan dilaporkan sebagai "HTTP 0"
$http    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$result || $http !== 200) {
    $errBody = $result ? substr($result, 0, 300) : '';
    error_log('[AI Chat] Groq error http=' . $http . ' curl=' . $curlErr . ' body=' . $errBody);
    if ($http === 429) {
        $reply = 'Batas request AI tercapai, coba lagi dalam beberapa menit.';
    } elseif ($http === 401) {
        $reply = 'GROQ_API_KEY tidak valid. Periksa config/api_keys.php di server.';
    } elseif ($curlErr) {
        $reply = 'Koneksi ke AI gagal. Coba lagi nanti.';
    } else {
        $reply = 'AI tidak tersedia saat ini (HTTP ' . $http . '), coba beberapa saat lagi.';
    }
    echo json_encode(['reply' => $reply, 'error' => true]);
    exit;
}

$data  = json_decode($result, true);
$reply = $data['choices'][0]['message']['content'] ?? 'Tidak ada respons.';
echo json_encode(['reply'=>trim($reply),'model'=>($data['model']??$chatModel)]);
