<?php
/**
 * Penjelasan setup dalam bahasa sederhana — tombol "Jelaskan" di kartu Setup Analisa.
 *
 * POST JSON: { symbol, tf, harga, atr, setup: { metode, arah, status, entry, sl, tp, rr, alasan[], tpLabel },
 *              berita?: "CAD CPI 23j lagi" }
 *
 * - Angka penting (jarak SL/TP, R:R, contoh lot untuk risiko 1% dari $10.000) DIHITUNG DI SERVER dengan
 *   model P/L paper trading (qi_paper_pip_mult) dan diberikan ke AI sebagai fakta — AI hanya menjelaskan,
 *   tidak menghitung, supaya tidak ada angka karangan.
 * - AI: Groq (GROQ_API_KEY, sama dengan AI Assistant). Jawaban disimpan 24 jam per setup (hemat kuota).
 * - Tanpa API key / AI gagal: tetap mengembalikan penjelasan OTOMATIS berbasis aturan (tanpa AI), ditandai.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_paper_math.php';
qi_rate_limit(12, 60);
qi_require_level('pro');   // sama dengan Setup Analisa & AI Assistant

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Gunakan POST.']);
    exit();
}
$in = qi_get_json_body();
$s = is_array($in['setup'] ?? null) ? $in['setup'] : [];
$symbol = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($in['symbol'] ?? '')));
$tf = preg_replace('/[^0-9A-Za-z]/', '', (string)($in['tf'] ?? ''));
$angka = static fn($v) => is_numeric($v) ? (float)$v : null;
$entry = $angka($s['entry'] ?? null); $sl = $angka($s['sl'] ?? null); $tp = $angka($s['tp'] ?? null);
$harga = $angka($in['harga'] ?? null); $atr = $angka($in['atr'] ?? null);
$arah = strtoupper((string)($s['arah'] ?? ''));
$metode = strtoupper(preg_replace('/[^A-Za-z]/', '', (string)($s['metode'] ?? '')));
$status = strtoupper(preg_replace('/[^A-Za-z]/', '', (string)($s['status'] ?? '')));
$alasan = array_slice(array_map(fn($a) => mb_substr(trim(strip_tags((string)$a)), 0, 160), (array)($s['alasan'] ?? [])), 0, 6);
$berita = mb_substr(trim(strip_tags((string)($in['berita'] ?? ''))), 0, 120);

if ($symbol === '' || strlen($symbol) > 12 || !in_array($arah, ['BUY', 'SELL'], true) || !$entry || !$sl || !$tp
    || !in_array($metode, ['SMC', 'ICT', 'FIBO', 'SND'], true)
    || ($arah === 'BUY' && !($tp > $entry && $entry > $sl)) || ($arah === 'SELL' && !($tp < $entry && $entry < $sl))) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Data setup tidak lengkap atau tidak konsisten.']);
    exit();
}

// ── Fakta yang dihitung server ──────────────────────────────────────────────
$NAMA = ['SMC' => 'Smart Money Concepts (SMC)', 'ICT' => 'ICT (Inner Circle Trader)', 'FIBO' => 'Fibonacci', 'SND' => 'Supply & Demand'];
$TFN = ['1' => 'M1', '5' => 'M5', '15' => 'M15', '30' => 'M30', '60' => 'H1', '240' => 'H4', 'D' => 'D1', 'W' => 'W1'];
$risiko = abs($entry - $sl);
$hadiah = abs($tp - $entry);
$rr = $risiko > 0 ? round($hadiah / $risiko, 2) : 0;
$mult = qi_paper_pip_mult($symbol, $entry);
$rugiPerLot = $risiko * $mult;                       // USD bila SL kena, per 1 lot
$modal = 10000.0; $risikoUsd = $modal * 0.01;
$lot = $rugiPerLot > 0 ? floor($risikoUsd / $rugiPerLot * 100) / 100 : 0;
$jarakAtr = ($atr && $atr > 0) ? round($risiko / $atr, 2) : null;
$jarakHarga = ($harga && $atr && $atr > 0) ? round(abs($harga - $entry) / $atr, 2) : null;
$desimal = $entry >= 1000 ? 2 : ($entry >= 50 ? 3 : 5);
$f = static fn($v) => number_format((float)$v, $desimal, '.', ',');
$fakta = [
    'simbol' => $symbol, 'timeframe' => $TFN[$tf] ?? $tf, 'metode' => $NAMA[$metode], 'arah' => $arah,
    'status' => $status === 'AKTIF' ? 'AKTIF (entry sudah tersentuh, posisi berjalan)' : 'MENUNGGU (order limit, harga belum kembali ke entry)',
    'entry' => $f($entry), 'sl' => $f($sl), 'tp' => $f($tp), 'rr' => '1:' . $rr,
    'jarak_sl_atr' => $jarakAtr, 'jarak_harga_ke_entry_atr' => $jarakHarga,
    'contoh_lot_risiko_1persen_modal_10000' => $lot > 0 ? $lot : null,
    'rugi_bila_sl_usd' => $lot > 0 ? round($lot * $rugiPerLot, 2) : null,
    'untung_bila_tp_usd' => $lot > 0 ? round($lot * $hadiah * $mult, 2) : null,
    'alasan_deteksi' => $alasan, 'berita_dekat' => $berita ?: null,
];

// ── Penjelasan otomatis (tanpa AI) — selalu tersedia ────────────────────────
$langkah = $arah === 'BUY' ? 'membeli' : 'menjual';
$otomatis = "**Apa ini?** Setup {$NAMA[$metode]} arah **{$arah}** di {$symbol} " . ($TFN[$tf] ?? $tf) . ". Rencananya {$langkah} di **{$f($entry)}** "
    . ($status === 'AKTIF' ? '(harga sudah menyentuh entry).' : 'dengan order limit — menunggu harga kembali ke level itu.') . "\n\n"
    . "**Kenapa muncul?**\n" . ($alasan ? implode("\n", array_map(fn($a) => '- ' . $a, $alasan)) : '- Struktur harga memenuhi aturan metode ini.') . "\n\n"
    . "**Batal bila** harga menyentuh SL **{$f($sl)}**" . ($jarakAtr !== null ? " (±{$jarakAtr}× ATR dari entry)" : '') . ". Target TP **{$f($tp)}**, R:R **1:{$rr}** — untung bila kena TP ±{$rr}× kerugian bila kena SL.\n\n"
    . ($lot > 0 ? "**Contoh ukuran posisi:** modal \$10.000, risiko 1% (\$100) → ±**{$lot} lot**; rugi ±\$" . number_format($lot * $rugiPerLot, 2) . " bila SL, untung ±\$" . number_format($lot * $hadiah * $mult, 2) . " bila TP.\n\n" : '')
    . ($berita ? "**Perhatian:** ada berita besar dekat ({$berita}) — volatilitas bisa melompati SL.\n\n" : '')
    . "_Ini bukan saran investasi. Uji dulu di akun simulasi; hasil masa lalu tidak menjamin hasil berikutnya._";

// ── Cache 24 jam per setup ──────────────────────────────────────────────────
$dirCache = __DIR__ . '/../cache/ai_jelaskan';
if (!is_dir($dirCache)) @mkdir($dirCache, 0755, true);
$kunci = md5(json_encode([$symbol, $tf, $metode, $arah, $entry, $sl, $tp, $status, $berita ? 1 : 0]));
$berkas = $dirCache . '/' . $kunci . '.json';
if (is_file($berkas) && time() - filemtime($berkas) < 86400) {
    $c = json_decode((string)file_get_contents($berkas), true);
    if (is_array($c) && !empty($c['penjelasan'])) { echo json_encode($c + ['cache' => true]); exit(); }
}

$groqKey = '';
$apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($apiKeysFile)) { include_once $apiKeysFile; $groqKey = defined('GROQ_API_KEY') ? (string)GROQ_API_KEY : ''; }
$model = defined('GROQ_CHAT_MODEL') ? GROQ_CHAT_MODEL : 'qwen/qwen3.8-27b';

$hasil = ['status' => 'success', 'sumber' => 'otomatis', 'penjelasan' => $otomatis, 'fakta' => $fakta];
if ($groqKey !== '') {
    $sistem = 'Kamu mentor trading untuk PEMULA di Indonesia. Jelaskan setup berikut dalam Bahasa Indonesia sederhana, '
        . 'maksimal 220 kata, format Markdown dengan judul tebal singkat: **Apa ini?**, **Kenapa muncul?**, **Kapan batal?**, '
        . '**Ukuran posisi**, **Yang perlu diwaspadai**. ATURAN KERAS: pakai HANYA angka dari FAKTA (jangan menghitung atau '
        . 'mengarang angka baru, jangan menebak arah pasar ke depan, jangan menjanjikan untung). Jelaskan istilah teknis '
        . '(order block, FVG, liquidity sweep, golden zone, zona demand/supply, ATR, R:R) dengan kalimat awam bila muncul. '
        . 'Akhiri dengan satu kalimat: ini bukan saran investasi.';
    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $groqKey],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model, 'max_tokens' => 650, 'temperature' => 0.3,
            'messages' => [
                ['role' => 'system', 'content' => $sistem],
                ['role' => 'user', 'content' => "FAKTA (JSON):\n" . json_encode($fakta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)],
            ],
        ]),
    ]);
    $raw = curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $d = $raw ? json_decode($raw, true) : null;
    $teks = trim((string)($d['choices'][0]['message']['content'] ?? ''));
    $teks = trim(preg_replace('/<think>.*?<\/think>/s', '', $teks));   // model penalaran: buang jejak berpikir
    if ($http === 200 && $teks !== '') {
        $hasil = ['status' => 'success', 'sumber' => 'ai', 'model' => $d['model'] ?? $model, 'penjelasan' => $teks, 'fakta' => $fakta];
        @file_put_contents($berkas, json_encode($hasil), LOCK_EX);
    } else {
        $hasil['catatan'] = $http === 429 ? 'Kuota AI sedang habis — ditampilkan penjelasan otomatis.' : 'AI tidak menjawab — ditampilkan penjelasan otomatis.';
        if ($http === 401) error_log('[ai-jelaskan] GROQ_API_KEY ditolak (401).');
    }
} else {
    $hasil['catatan'] = 'Penjelasan AI belum diaktifkan (API key AI belum diisi admin) — ditampilkan penjelasan otomatis berbasis aturan.';
}
echo json_encode($hasil);
