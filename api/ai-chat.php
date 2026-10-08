<?php
/**
 * Quantum Institut — AI Trading Assistant
 * Uses Groq API (free tier, llama-3.3-70b-versatile)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(20, 60);

// Load Groq API key from config (add GROQ_API_KEY to config/api_keys.php)
$groqKey = '';
$apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($apiKeysFile)) {
    include $apiKeysFile;
    $groqKey = defined('GROQ_API_KEY') ? GROQ_API_KEY : '';
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
$message = trim($body['message'] ?? '');
$history = array_slice((array)($body['history'] ?? []), -12);

if (!$message) { echo json_encode(['error'=>'Pesan kosong']); exit; }

$systemPrompt = 'Kamu adalah AI Trading Assistant dari Quantum Institut. Kamu ahli dalam: analisa teknikal (RSI, MACD, EMA, Fibonacci, Ichimoku, pola candlestick, support/resistance, SMC, SNR, ICT), analisa fundamental forex dan kripto, psikologi trading, manajemen risiko, dan strategi trading. Jawab dalam Bahasa Indonesia yang profesional dan mudah dipahami. Gunakan format poin atau tabel jika membantu. PENTING: Jangan pernah memberikan rekomendasi spesifik buy/sell suatu instrumen karena trading memiliki risiko — berikan edukasi dan analisa konsep, bukan saran investasi langsung.';

$messages = [['role'=>'system','content'=>$systemPrompt]];
foreach ($history as $h) {
    $role = $h['role'] === 'assistant' ? 'assistant' : 'user';
    $messages[] = ['role'=>$role,'content'=>mb_substr(trim($h['content']??''),0,1500)];
}
$messages[] = ['role'=>'user','content'=>mb_substr($message,0,2000)];

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
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $groqKey,
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'model'       => 'llama-3.3-70b-versatile',
        'messages'    => $messages,
        'max_tokens'  => 700,
        'temperature' => 0.65,
    ]),
]);
$result = curl_exec($ch);
$http   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$result || $http !== 200) {
    echo json_encode(['reply'=>'AI tidak tersedia saat ini, coba beberapa saat lagi.','error'=>true]);
    exit;
}

$data  = json_decode($result, true);
$reply = $data['choices'][0]['message']['content'] ?? 'Tidak ada respons.';
echo json_encode(['reply'=>trim($reply),'model'=>($data['model']??'llama-3.3-70b')]);
