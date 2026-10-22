<?php
/**
 * Quantum AI Signal Engine
 * GET ?symbol=BTCUSDT  → AI analysis + trade decision
 * Auth required. Cached 15 min per symbol.
 */
// ── SUMBER CANDLE: SELALU FEED BROKER MT5 ─────────────────────────────────
// Analisa yang diterbitkan sebagai "sinyal resmi" TIDAK BOLEH bergantung pada siapa
// yang kebetulan memuat halaman lebih dulu. Sebelum ini ai_load_candles() memilih berkas
// cache lewat qi_chart_use_mt5($sym), yang bernilai true untuk pengunjung PRO/VIP tetapi
// false untuk proses server dan pengunjung gratis — jadi sinyal yang sama bisa lahir dari
// harga broker MT5 ATAU dari OANDA, tergantung siapa yang mengisi cache duluan. Dua
// pengguna bisa melihat "sinyal resmi" yang berbeda untuk simbol dan waktu yang sama.
//
// QI_SERVER_MT5 menyamakan perlakuan dengan api/signal-generator.php dan
// api/signal-setup-shadow.php: analisa selalu memakai candle broker MT5. Rantai cadangan
// di api/get-chart-data.php tetap berlaku bila bridge mati atau simbolnya tidak didukung,
// dan penilaian TP/SL di api/signal-evaluator.php sudah lebih dulu memakai aturan yang sama
// — jadi sinyal dinilai dengan harga dari feed yang sama dengan yang menerbitkannya.
//
// Ini tidak membocorkan harga broker ke pengguna gratis: berkas ini hanya mengembalikan
// hasil analisa, bukan candle mentahnya.
if (!defined('QI_SERVER_MT5')) define('QI_SERVER_MT5', true);

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

// RSI Wilder bersama, penjaga pasar tutup, dan pemeriksaan entry vs harga pasar
// (satu implementasi untuk semua penerbit sinyal — lihat kepala berkas itu).
require_once __DIR__ . '/_sinyal_pasar.php';

// ── Signal calculation (EMA / RSI / MACD) ─────────────────────────────────
/**
 * Ambil candle untuk analisa.
 * Mengembalikan ['candles' => array, 'simulated' => bool, 'source', 'stale', 'umur_detik'].
 * Penanda simulated WAJIB diteruskan ke pemanggil (candle acak tidak boleh dipakai untuk
 * mengambil keputusan). Sejak 2026-10-22 get-chart-data.php menyajikan cache NYATA yang
 * basi (stale + umur) saat semua sumber gagal — penanda itu ikut diteruskan supaya
 * pemanggil dapat menolak data lama lewat qi_sp_cek_pasar().
 */
function ai_load_candles(string $sym, string $interval): array {
    // Cache yang sama dengan yang akan ditulis get-chart-data.php (MT5 atau umum).
    $cacheFile = qi_chart_cache_file($sym, $interval, qi_chart_use_mt5($sym));
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 300) {
        $d = json_decode(file_get_contents($cacheFile), true);
        // Cache hanya menyimpan data nyata (candle simulasi tidak pernah di-cache).
        return ['candles' => $d['candles'] ?? [], 'simulated' => false, 'source' => (string)($d['source'] ?? ''),
                'stale' => false, 'umur_detik' => time() - (int)filemtime($cacheFile)];
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
    if (!is_array($d)) return ['candles' => [], 'simulated' => false, 'source' => '', 'stale' => false, 'umur_detik' => null];
    return ['candles' => $d['candles'] ?? [], 'simulated' => !empty($d['simulated']), 'source' => (string)($d['source'] ?? ''),
            'stale' => !empty($d['stale']), 'umur_detik' => isset($d['umur_detik']) ? (int)$d['umur_detik'] : null];
}

function ai_ema(array $closes, int $period): ?float {
    if (count($closes) < $period) return null;
    $k = 2 / ($period + 1);
    $ema = array_sum(array_slice($closes, 0, $period)) / $period;
    for ($i = $period; $i < count($closes); $i++) $ema = $closes[$i] * $k + $ema * (1 - $k);
    return $ema;
}

/**
 * RSI Wilder atas SELURUH deret close — implementasi bersama qi_sp_rsi() (api/_sinyal_pasar.php).
 * Dulu salinan sendiri yang dipanggil dengan 30 close terakhir dan bernilai 100 pada data datar.
 */
function ai_rsi(array $closes, int $period = 14): float {
    return qi_sp_rsi($closes, $period);
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
    $mentah = $loaded['candles'];
    // Bar ber-rentang nol (O=H=L=C, harga beku saat pasar tutup) dibuang sebelum indikator
    // dihitung — deret datar itulah yang dulu membuat RSI M15 = 100 di akhir pekan.
    $candles = qi_sp_buang_datar($mentah);
    if (count($candles) < 55) return null;
    $closes = array_column($candles, 'close');
    $last   = end($closes);
    $ema20  = ai_ema($closes, 20);
    $ema50  = ai_ema($closes, 50);
    // RSI atas SELURUH riwayat (dulu array_slice(-30): bobot nilai awal ±33%).
    $rsi    = ai_rsi($closes, 14);
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
        'price'     => round((float)(end($mentah)['close'] ?? $last), 5),
        // Data dari cache basi (semua sumber gagal) dilaporkan apa adanya, bukan disamarkan.
        'stale'     => !empty($loaded['stale']),
    ];
}

/**
 * Timeframe yang BOLEH dipakai untuk konsensus/keputusan: yang basi (stale) menjadi null.
 * MENGAPA (audit ulang 2026-10-22): ai_analyze() meneruskan penanda stale, tetapi pembangkit,
 * signal-news, tv-webhook, dan endpoint ini tetap menghitungnya dalam aturan 3-dari-4 — H1
 * berumur 3 hari ikut "memilih" arah, dan harganya dipakai sebagai Price di prompt AI. Data
 * basi dilaporkan (lihat 'timeframes' di jawaban endpoint), tetapi tidak ikut memutuskan.
 */
function ai_tf_dipakai(array $tfs): array {
    foreach ($tfs as $label => $d) {
        if (is_array($d) && !empty($d['stale'])) $tfs[$label] = null;
    }
    return $tfs;
}

// ── Bagian ini hanya berjalan saat dipanggil sebagai endpoint HTTP ────────
if (!defined('QI_AI_SIGNAL_LIB')) {

// ── Collect multi-TF data ─────────────────────────────────────────────────
$tfs = [];
foreach (['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'] as $iv => $label) {
    $tfs[$label] = ai_analyze($symbol, $iv);
}
// Timeframe basi dilaporkan di 'timeframes' tetapi tidak ikut konsensus, harga, atau prompt.
$tfsPakai = ai_tf_dipakai($tfs);

$price = 0;
foreach (['H1','H4','D1','M15'] as $pf) {
    if ($tfsPakai[$pf] && $tfsPakai[$pf]['price'] > 0) { $price = $tfsPakai[$pf]['price']; break; }
}

$bullTfs = count(array_filter($tfsPakai, fn($t) => $t && $t['signal'] === 'BULLISH'));
$bearTfs = count(array_filter($tfsPakai, fn($t) => $t && $t['signal'] === 'BEARISH'));
$overall = $bullTfs >= 3 ? 'BULLISH' : ($bearTfs >= 3 ? 'BEARISH' : 'NEUTRAL');

// Tidak ada satu pun timeframe dengan data nyata (dan segar) → jangan panggil AI dan jangan
// simpan hasilnya. Tanpa penjaga ini prompt berisi "NO_DATA" dengan harga 0, dan
// model bisa mengarang keputusan yang tampak valid.
if (!array_filter($tfsPakai)) {
    echo json_encode([
        'status'  => 'error',
        'code'    => 'PRICE_UNAVAILABLE',
        'message' => 'Data harga live belum tersedia, analisa AI ditahan agar tidak memakai data kosong atau simulasi. Coba lagi sebentar lagi.',
    ]);
    exit;
}

// ── Build Groq prompt ─────────────────────────────────────────────────────
$tfLines = [];
foreach ($tfsPakai as $label => $d) {
    if (!$d) { $tfLines[] = !empty($tfs[$label]['stale']) ? "{$label}: STALE_DATA (not used)" : "{$label}: NO_DATA"; continue; }
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
$tpAi   = (float)($decision['tp'] ?? 0);
$slAi   = (float)($decision['sl'] ?? 0);

// ── ENTRY AI DIPERIKSA TERHADAP HARGA PASAR (audit sinyal 2026-10-22) ──────
// Dulu entry_price AI dipakai apa adanya. Penilai menganggap rekor terisi di entry itu,
// sehingga BUY 2650 saat pasar 2700 tercatat "HIT TP" di harga pembukaan (+2,5R) untuk
// transaksi yang tidak pernah bisa terisi. Acuan = close H1 NYATA terakhir + ATR14 H1
// (feed yang sama dengan penilai). Aturan lengkap: qi_sp_jangkar_entry().
// Candle acuan WAJIB segar (qi_sp_muat_layak): cache basi dari get-chart-data (stale) dulu lolos
// karena hanya data simulasi yang ditolak — entry AI ≈ close H1 tiga hari lalu lalu "terverifikasi".
$muatAcuan  = ai_load_candles($symbol, '60');
$layakAcuan = qi_sp_muat_layak($symbol, $muatAcuan, 3600);
$cndAcuan   = $layakAcuan['boleh'] ? $muatAcuan['candles'] : [];
$hargaAcuan = $cndAcuan ? (float)(end($cndAcuan)['close'] ?? 0) : 0.0;
$atrAcuan   = $cndAcuan ? qi_sp_atr($cndAcuan, 14) : 0.0;
// Penjaga pasar tutup memakai candle M15 (sudah dimuat ai_analyze) — paling peka umur data.
$muatM15    = ai_load_candles($symbol, '15');
$pasarAi    = qi_sp_cek_pasar($symbol, (!empty($muatM15['simulated']) ? [] : ($muatM15['candles'] ?? [])), 900);

$actionAi = $action;
$cekEntry = null;
$catatanEntry = '';
if (in_array($action, ['ENTRY_BUY', 'ENTRY_SELL'], true)) {
    $arahCek = ($action === 'ENTRY_BUY') ? 'BUY' : 'SELL';
    $cekEntry = qi_sp_jangkar_entry($arahCek, $ep, $tpAi, $slAi, $hargaAcuan, $atrAcuan);
    $catatanEntry = $cekEntry['catatan'];
    // Alasan yang BENAR saat harga acuan tidak dipakai (mis. cache basi) — bukan "harga melewati SL".
    if (!$layakAcuan['boleh']) $catatanEntry = $layakAcuan['catatan'];
    if ($cekEntry['ok'] && $cekEntry['disesuaikan']) {
        $ep = $cekEntry['entry']; $tpAi = $cekEntry['tp']; $slAi = $cekEntry['sl'];
    } elseif (!$cekEntry['ok'] && $cekEntry['alasan'] === 'entry_jauh_dari_harga') {
        // Harga sudah melewati TP/SL rencana AI: rencana itu tidak bisa diambil siapa pun.
        // Ditampilkan sebagai SKIP (keputusan asli AI tetap terlihat di action_ai).
        $action = 'SKIP';
    }
}

$response = [
    'status'      => 'success',
    'symbol'      => $symbol,
    'timestamp'   => date('Y-m-d H:i:s'),
    'price'       => (float)$price,
    'action'      => $action,
    'confidence'  => max(0, min(100, (int)($decision['confidence'] ?? 50))),
    'entry_price' => round($ep, 5),
    'tp'          => round($tpAi, 5),
    'sl'          => round($slAi, 5),
    'risk_reward' => round((float)($decision['risk_reward'] ?? 0), 2),
    'reason'      => mb_substr(preg_replace('/[^\w\s.,!?:%()\/&-]/u', '', $decision['reason'] ?? ''), 0, 100),
    'timeframes'  => $tfs,
    'consensus'   => ['bullish_tfs' => $bullTfs, 'bearish_tfs' => $bearTfs, 'overall' => $overall],
    'from_cache'  => false,
    // Jejak pemeriksaan entry — ditulis apa adanya supaya pengguna tahu asal levelnya.
    'harga_acuan'         => $hargaAcuan > 0 ? round($hargaAcuan, 5) : null,
    'entry_terverifikasi' => $cekEntry !== null ? (bool)$cekEntry['ok'] : null,
    'jarak_entry_atr'     => $cekEntry['jarak_entry_atr'] ?? null,
    'pasar'               => ['boleh' => $pasarAi['boleh'], 'alasan' => $pasarAi['alasan'], 'catatan' => $pasarAi['catatan']],
    'acuan'               => ['boleh' => $layakAcuan['boleh'], 'alasan' => $layakAcuan['alasan']],
];
if ($actionAi !== $action) $response['action_ai'] = $actionAi;
if ($cekEntry !== null && $cekEntry['disesuaikan']) {
    $response['entry_ai'] = round($cekEntry['entry_asal'], 5);
    $response['entry_disesuaikan'] = true;
}
if ($catatanEntry !== '') $response['catatan_entry'] = $catatanEntry;

// Cache 15 min
require_once __DIR__ . '/_json_kunci.php';
qi_tulis_atomik($cacheFile, (string)json_encode($response));   // pembaca tidak pernah melihat berkas setengah jadi

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

    if ($actionAi !== $action) {
        // Rencana AI usang (harga sudah melewati TP/SL-nya) — lihat qi_sp_jangkar_entry().
        $response['catatan_rekor'] = 'Tidak dicatat: ' . $catatanEntry;
    } elseif (in_array($action, ['ENTRY_BUY', 'ENTRY_SELL'], true) && !$pasarAi['boleh']) {
        // Penjaga pasar tutup: forex/emas di akhir pekan (entry = close Jumat) atau data basi.
        $response['catatan_rekor'] = 'Tidak dicatat: ' . $pasarAi['catatan'];
    } elseif (in_array($action, ['ENTRY_BUY', 'ENTRY_SELL'], true)) {
        $arahRek = ($action === 'ENTRY_BUY') ? 'BUY' : 'SELL';
        $epRek   = (float)$response['entry_price'];
        $tpRek   = (float)$response['tp'];
        $slRek   = (float)$response['sl'];
        $basisLevel = !empty($response['entry_disesuaikan'])
            ? 'level dari AI; entry digeser ke harga pasar (AI ' . $response['entry_ai'] . ', ' . $response['jarak_entry_atr'] . '× ATR), jarak SL/TP AI dipertahankan'
            : 'level dari AI';
        $levelAtr = false;

        // Bila AI memberi arah tetapi levelnya tidak konsisten, level diturunkan
        // dari ATR14 candle H1 NYATA — bukan dikarang. Arah tetap dari AI, jarak
        // dari volatilitas nyata, dan asal level ditulis apa adanya di 'basis'.
        if (!qi_signal_level_sah($arahRek, $epRek, $tpRek, $slRek) && $hargaAcuan > 0 && $atrAcuan > 0) {
            $epRek = round($hargaAcuan, 5);
            $slRek = round($arahRek === 'BUY' ? $hargaAcuan - 1.2 * $atrAcuan : $hargaAcuan + 1.2 * $atrAcuan, 5);
            $tpRek = round($arahRek === 'BUY' ? $hargaAcuan + 3.0 * $atrAcuan : $hargaAcuan - 3.0 * $atrAcuan, 5);
            $basisLevel = 'level dari ATR14 (AI tidak memberi level yang konsisten)';
            $levelAtr = true;
        }

        // Entry yang tidak bisa dibandingkan dengan harga pasar tidak boleh masuk rekor publik.
        $entryTerverifikasi = $levelAtr || ($cekEntry !== null && $cekEntry['ok']);
        if (!$entryTerverifikasi) {
            $response['catatan_rekor'] = 'Tidak dicatat: ' . ($catatanEntry !== '' ? $catatanEntry : 'entry tidak dapat diverifikasi terhadap harga pasar.');
        } elseif (qi_signal_level_sah($arahRek, $epRek, $tpRek, $slRek)) {
            // Filter berita High impact: tahan pencatatan (bukan menahan analisa).
            $boRek = function_exists('qi_berita_blackout') ? qi_berita_blackout(30, true, $symbol) : ['aktif' => false];   // hanya berita mata uang simbol ini
            if (!empty($boRek['aktif'])) {
                $response['catatan_rekor'] = 'Ditahan filter berita berdampak tinggi (' . ($boRek['event']['judul'] ?? '-') . ').';
                require_once __DIR__ . '/_sinyal_ditolak.php';
                qi_ditolak_catat(['symbol' => $symbol, 'side' => $arahRek, 'engine' => 'AI', 'entry' => $epRek, 'sl' => $slRek, 'tp' => $tpRek,
                                  'expiry' => qi_sig_waktu_utc(time() + 12 * 3600)], 'blackout_berita',
                                 ['berita' => (string)($boRek['event']['judul'] ?? ''), 'mata_uang' => (string)($boRek['event']['mata_uang'] ?? '')]);
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
                    // ATR14 H1 NYATA (dulu 0) — dipakai toleransi pengisian entry di penilai
                    // dan analisa SL (_sl_learn), yang tanpa ATR selalu "perlu_data_harga".
                    'atr'              => round($atrAcuan, 5),
                    'harga_acuan'      => round($hargaAcuan, 5),
                    'jarak_entry_atr'  => $levelAtr ? 0.0 : ($cekEntry['jarak_entry_atr'] ?? null),
                    'entry_ai'         => (!$levelAtr && !empty($response['entry_disesuaikan'])) ? $response['entry_ai'] : null,
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
