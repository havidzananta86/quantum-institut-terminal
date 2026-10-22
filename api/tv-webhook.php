<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — WEBHOOK TRADINGVIEW → AI SIGNAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Menerima ALERT dari TradingView (fitur resmi "Webhook URL" pada Alert),
 *  menganalisanya dengan AI, lalu — bila keputusannya layak — mencatatnya
 *  sebagai sinyal AKTIF di rekor publik (cache/signal_history.json).
 *  Penilai sinyal (signal-evaluator.php) akan menutup & menilai sinyal itu
 *  secara otomatis begitu TP/SL tersentuh.
 *
 *  Mengapa lewat webhook? TradingView TIDAK menyediakan API publik untuk
 *  membaca chart pengguna, dan menyalin datanya melanggar ToS mereka. Webhook
 *  adalah cara RESMI: TradingView sendiri yang mengirim data alert-nya
 *  (simbol, harga, timeframe, dan nilai indikator yang Anda tulis di pesan
 *  alert) ke endpoint ini. Jadi AI benar-benar menganalisa ANGKA DARI
 *  TRADINGVIEW, bukan chart internal webapp.
 *
 *  CARA PAKAI (dijelaskan juga di panel AI Radar):
 *    1. TradingView → Alert → centang "Webhook URL"
 *    2. Tempel URL: https://<domain>/api/tv-webhook.php?k=<KUNCI>
 *    3. Isi kotak pesan alert dengan template JSON (ada di panel)
 *    4. Simpan. Setiap alert terpicu → AI menganalisa → sinyal tercatat.
 *
 *  KEAMANAN:
 *    · Kunci rahasia di URL (TradingView tidak bisa mengirim header kustom).
 *      Kunci dibuat otomatis & disimpan di cache/tv_webhook_secret.txt —
 *      folder cache sudah diblokir dari akses web (403).
 *    · Hanya POST, dibatasi ukurannya, dan dibatasi lajunya (rate limit).
 *    · TIDAK ADA data yang dikarang: bila data candle tidak tersedia atau AI
 *      menolak, sinyal TIDAK dicatat dan alasannya dikembalikan apa adanya.
 * ═══════════════════════════════════════════════════════════════════════════
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

// ── Batas laju: TradingView bisa mengirim banyak alert → beri ruang cukup,
//    tetapi tetap dibatasi agar tidak bisa dibanjiri.
qi_rate_limit(90, 60);

// ── JEJAK AUDIT WEBHOOK (Tahap 1 — fondasi audit) ───────────────────────────
// MENGAPA: sebelumnya tidak ada jejak sama sekali. Bila TradingView mengirim alert
// dan sinyal tidak muncul, tidak ada cara mengetahui sebabnya (kunci salah? payload
// tidak valid? kena rate limit? pagar konfluensi menolak?). Sekarang setiap permintaan
// dicatat: ip, cara autentikasi, hasil tanda tangan, simbol/tf/action, status, kode
// HTTP, dan pesan hasilnya. Pencatatan TIDAK PERNAH menggagalkan respons webhook.
$GLOBALS['tv_log_ctx'] = [
    'source'       => 'tradingview',
    'ip'           => (string)($_SERVER['REMOTE_ADDR'] ?? ''),
    'auth_method'  => 'none',
    'signature_ok' => null,
];

function tv_context(array $tambahan): void
{
    $GLOBALS['tv_log_ctx'] = array_merge((array)($GLOBALS['tv_log_ctx'] ?? []), $tambahan);
}

function tv_log_tulis(array $tambahan = []): void
{
    try {
        if (!function_exists('qi_journal_catat_webhook')) {
            require_once __DIR__ . '/_journal.php';
        }
        if (function_exists('qi_journal_catat_webhook')) {
            qi_journal_catat_webhook(array_merge((array)($GLOBALS['tv_log_ctx'] ?? []), $tambahan));
        }
    } catch (Throwable $e) {
        @error_log('[TV-WEBHOOK] log gagal: ' . $e->getMessage());
    }
}

/**
 * Kirim jawaban DAN catat jejaknya. $statusLog dipakai untuk menandai hasil akhir
 * (RECEIVED / PROCESSED / REJECTED / DUPLICATE / ERROR) supaya panel Gateway bisa
 * memisahkan permintaan yang berhasil, ditolak, dan sah tetapi belum menghasilkan sinyal.
 */
function tv_jawab(int $kode, array $data, string $statusLog = ''): void
{
    // Mode info (panel setup) BUKAN pengiriman webhook, jadi tidak dicatat ke log audit.
    if (empty($GLOBALS['tv_log_mati'])) {
        $pesan = (string)($data['alasan'] ?? $data['message'] ?? $data['status'] ?? '');
        tv_log_tulis([
            'http_code' => $kode,
            'status'    => $statusLog !== '' ? $statusLog : 'RESPONS',
            'message'   => mb_substr($pesan, 0, 250),
        ]);
    }
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── Kunci rahasia: dibuat otomatis sekali, lalu dipakai terus.
//    WAJIB dimuat SEBELUM mode info, karena mode info menampilkan URL berisi kunci.
$secretFile = __DIR__ . '/../cache/tv_webhook_secret.txt';
$secret = is_file($secretFile) ? trim((string)@file_get_contents($secretFile)) : '';
if ($secret === '') {
    $secret = bin2hex(random_bytes(16));
    @file_put_contents($secretFile, $secret, LOCK_EX);
}

// ── MODE INFO (GET ?info=1) — untuk panel setup di dashboard ───────────────
// Hanya pengguna PRO/VIP/admin yang sudah login boleh melihat URL + kuncinya.
// TradingView sendiri memakai POST; GET di sini murni untuk menampilkan panduan.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && !empty($_GET['info'])) {
    qi_require_level('pro');
    // Tandai: mode info tidak dicatat ke log audit webhook (lihat tv_jawab).
    $GLOBALS['tv_log_mati'] = true;
    $protokol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = (string)($_SERVER['HTTP_HOST'] ?? 'quantum-institut.com');
    $dasar = $protokol . '://' . $host . dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/tv-webhook.php'));
    $url = rtrim($dasar, '/') . '/tv-webhook.php?k=' . $secret;
    tv_jawab(200, [
        'status'   => 'ok',
        'url'      => $url,
        'kunci'    => $secret,
        'didukung' => ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','XRPUSDT'],
        'template' => '{"symbol":"{{ticker}}","timeframe":"{{interval}}","price":"{{close}}","message":"{{strategy.order.comment}}"}',
        'catatan'  => 'Tempel URL di atas pada kolom Webhook URL di TradingView, dan tempel template JSON ke kotak pesan alert.',
    ]);
}

// ── Hanya POST ────────────────────────────────────────────────────────────
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    tv_jawab(405, ['status' => 'error', 'message' => 'Gunakan POST (TradingView mengirim webhook sebagai POST).'], 'REJECTED');
}

// ── Badan permintaan dibaca LEBIH DULU (dibatasi 16 KB — alert TradingView jauh lebih
//    kecil) karena tanda tangan HMAC dihitung dari badan MENTAH ini. Membaca
//    php://input tidak menghabiskan isinya, jadi penguraian di bawah tetap aman.
$mentah = (string)file_get_contents('php://input', false, null, 0, 16384);

// ── AUTENTIKASI — DUA cara, keduanya sah:
//    1) Tanda tangan HMAC SHA-256 pada header X-QI-Signature (atau X-Signature),
//       dihitung dari BADAN MENTAH dengan kunci rahasia yang sama. Dipakai oleh
//       pengirim otomatis (skrip/robot/EAs Anda).
//       CATATAN JUJUR: TradingView TIDAK bisa menghitung HMAC pada alert-nya,
//       sehingga untuk alert TradingView cara kedua (kunci di URL) yang dipakai.
//    2) Kunci pada URL ?k= (atau header X-TV-Key) — cara praktis untuk TradingView.
//    Bila tanda tangan DIKIRIM tetapi tidak sah, permintaan DITOLAK walaupun kunci URL
//    benar — supaya tanda tangan tidak bisa "diturunkan" menjadi sekadar kunci URL.
$diberikan    = (string)($_GET['k'] ?? ($_SERVER['HTTP_X_TV_KEY'] ?? ''));
$ttdDiberikan = strtolower(trim((string)($_SERVER['HTTP_X_QI_SIGNATURE'] ?? ($_SERVER['HTTP_X_SIGNATURE'] ?? ''))));
$kunciSah     = ($diberikan !== '' && hash_equals($secret, $diberikan));
$ttdSah       = false;
if ($ttdDiberikan !== '') {
    $ttdSah = hash_equals(hash_hmac('sha256', $mentah, $secret), $ttdDiberikan);
    tv_context(['auth_method' => 'hmac', 'signature_ok' => $ttdSah]);
} elseif ($kunciSah) {
    tv_context(['auth_method' => 'query_key']);
}

if ($ttdDiberikan !== '' && !$ttdSah) {
    tv_jawab(403, ['status' => 'error', 'message' => 'Tanda tangan webhook (X-QI-Signature) tidak sah. Periksa kunci rahasia pada pengirim Anda.'], 'REJECTED');
}
if (!$ttdSah && !$kunciSah) {
    tv_jawab(403, ['status' => 'error', 'message' => 'Kunci webhook tidak sah. Salin URL lengkap dari panel AI Radar.'], 'REJECTED');
}

// Permintaan sudah terautentikasi → catat isinya (dipotong 2 KB) sebagai jejak "RECEIVED".
tv_log_tulis([
    'http_code' => 200,
    'status'    => 'RECEIVED',
    'message'   => 'permintaan terautentikasi diterima',
    'payload'   => mb_substr($mentah, 0, 2000),
]);

if ($mentah === '') {
    tv_jawab(400, ['status' => 'error', 'message' => 'Badan permintaan kosong. Isi kotak pesan alert dengan template JSON dari panel.'], 'REJECTED');
}

// ── Urai: TradingView dapat mengirim JSON (bila pesan alert berupa JSON)
//    atau teks bebas. Keduanya harus bisa dibaca.
$data = json_decode($mentah, true);
if (!is_array($data)) {
    $data = [];
    // Teks bebas: ambil simbol, harga, dan timeframe dengan pola yang longgar.
    if (preg_match('/\b([A-Z]{3,10}(?:USDT|USD|JPY|CHF|CAD|AUD|NZD|GBP|EUR)?)\b/', strtoupper($mentah), $m)) { $data['symbol'] = $m[1]; }
    if (preg_match('/(?:price|harga|close)\D{0,6}([0-9]+(?:\.[0-9]+)?)/i', $mentah, $m)) { $data['price'] = $m[1]; }
    if (preg_match('/\b(1|5|15|30|60|240|D|W)\b/', $mentah, $m)) { $data['timeframe'] = $m[1]; }
    $data['message'] = mb_substr(trim($mentah), 0, 900);
}

// Normalisasi simbol: "XAU/USD" → "XAUUSD", "BTCUSDT.P" → "BTCUSDT".
$simbol = strtoupper((string)($data['symbol'] ?? ($data['ticker'] ?? '')));
$simbol = preg_replace('/[^A-Z0-9\/]/', '', $simbol);
$simbol = str_replace('/', '', (string)$simbol);
if (strpos($simbol, '.') !== false) { $simbol = strstr($simbol, '.', true); }
$ALIAS = ['XAUUSD' => 'XAUUSD', 'GOLD' => 'XAUUSD', 'XAU' => 'XAUUSD', 'BTCUSDT' => 'BTCUSDT', 'BTCUSD' => 'BTCUSDT'];
if (isset($ALIAS[$simbol])) { $simbol = $ALIAS[$simbol]; }
// Hapus akhiran "PERP"/"SPOT" yang biasa dipakai TradingView.
$simbol = preg_replace('/(PERP|SPOT)$/', '', $simbol);

$DIDUKUNG = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','XRPUSDT'];
tv_context(['symbol' => $simbol !== '' ? $simbol : null]);
if (!in_array($simbol, $DIDUKUNG, true)) {
    tv_jawab(200, [
        'status' => 'ditolak',
        'alasan' => 'Simbol "' . $simbol . '" belum didukung mesin ini.',
        'didukung' => $DIDUKUNG,
        'catatan' => 'Sinyal TIDAK dicatat. Sesuaikan simbol pada alert TradingView atau minta simbol ini ditambahkan.',
    ], 'REJECTED');
}

$tfKiriman = strtoupper((string)($data['timeframe'] ?? ($data['interval'] ?? '')));
$pesanUser = trim((string)($data['message'] ?? ($data['catatan'] ?? '')));
$hargaTv   = isset($data['price']) ? (float)$data['price'] : (isset($data['close']) ? (float)$data['close'] : 0.0);
tv_context(['timeframe' => $tfKiriman !== '' ? mb_substr($tfKiriman, 0, 12) : null]);

// ── Ambil analisa teknikal dari engine aplikasi (fungsi dipakai ulang).
//    Catatan: berkas konfigurasi dimuat EKSPLISIT di sini. Saat ai-signal.php
//    dipakai sebagai library, muatan konfigurasinya (yang ada di titik masuk HTTP)
//    tidak dijalankan, sehingga GROQ_* tidak akan terdefinisi tanpa baris ini.
$_apiKeysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($_apiKeysFile)) require_once $_apiKeysFile;
define('QI_AI_SIGNAL_LIB', 1);
require_once __DIR__ . '/ai-signal.php';

$tfs = [];
foreach (['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'] as $iv => $label) {
    // WAJIB cast ke string: PHP mengubah kunci array '15'/'60'/'240' menjadi INTEGER,
    // sedangkan ai_analyze() bertipe string dan berkas ini memakai strict_types —
    // tanpa cast, PHP melempar TypeError (HTTP 500). 'D' tetap string sehingga aman.
    $tfs[$label] = function_exists('ai_analyze') ? ai_analyze($simbol, (string)$iv) : null;
}
// Timeframe dari cache basi (stale) tidak ikut konsensus, harga, maupun prompt AI (ai_tf_dipakai).
$tfs = ai_tf_dipakai($tfs);
$adaData = (bool)array_filter($tfs);
if (!$adaData) {
    tv_jawab(200, [
        'status'  => 'ditahan',
        'alasan'  => 'Candle untuk ' . $simbol . ' belum tersedia, jadi AI tidak dipanggil (tidak ada keputusan yang dikarang).',
        'catatan' => 'Coba kirim ulang beberapa saat lagi.',
    ], 'REJECTED');
}

// ── PENJAGA PASAR TUTUP / DATA BASI (qi_sp_cek_pasar, candle M15) ─────────────
// Diperiksa SEBELUM AI dipanggil: alert forex/emas di akhir pekan tidak boleh menjadi sinyal
// AKTIF dengan entry dari harga beku (audit sinyal 2026-10-22).
$m15Tv = ai_load_candles($simbol, '15');
$pasarTv = qi_sp_cek_pasar($simbol, !empty($m15Tv['simulated']) ? [] : ($m15Tv['candles'] ?? []), 900);
if (!$pasarTv['boleh']) {
    tv_jawab(200, [
        'status'  => 'ditahan',
        'alasan'  => $pasarTv['catatan'],
        'kode'    => (string)$pasarTv['alasan'],
        'catatan' => 'Alert diterima, tetapi sinyal TIDAK dicatat dan AI tidak dipanggil.',
    ], 'REJECTED');
}

// Harga pasar ACUAN = close H1 NYATA terakhir dari server (feed yang sama dengan penilai),
// bukan harga alert TradingView: entry dinilai terhadap candle server, jadi harus diperiksa
// terhadap harga yang sama. Harga alert tetap dikirim ke AI dan disimpan di rekor.
$muatAcuanTv = ai_load_candles($simbol, '60');
// Candle acuan WAJIB segar (qi_sp_muat_layak): dulu cache basi (stale, s.d. 7 hari) diterima
// sebagai harga pasar karena hanya data simulasi yang ditolak. Ditahan SEBELUM AI dipanggil.
$layakAcuanTv = qi_sp_muat_layak($simbol, $muatAcuanTv, 3600);
if (!$layakAcuanTv['boleh']) {
    tv_jawab(200, [
        'status'  => 'ditahan',
        'alasan'  => $layakAcuanTv['catatan'],
        'kode'    => (string)$layakAcuanTv['alasan'],
        'catatan' => 'Alert diterima, tetapi sinyal TIDAK dicatat dan AI tidak dipanggil.',
    ], 'REJECTED');
}
$cndAcuanTv  = $muatAcuanTv['candles'];
$hargaAcuanTv = $cndAcuanTv ? (float)(end($cndAcuanTv)['close'] ?? 0) : 0.0;
$atrAcuanTv   = $cndAcuanTv ? qi_sp_atr($cndAcuanTv, 14) : 0.0;

$bullTfs = count(array_filter($tfs, fn($t) => $t && $t['signal'] === 'BULLISH'));
$bearTfs = count(array_filter($tfs, fn($t) => $t && $t['signal'] === 'BEARISH'));
$overall = $bullTfs >= 3 ? 'BULLISH' : ($bearTfs >= 3 ? 'BEARISH' : 'NEUTRAL');

$harga = 0.0;
foreach (['H1','H4','D1','M15'] as $pf) { if ($tfs[$pf] && $tfs[$pf]['price'] > 0) { $harga = (float)$tfs[$pf]['price']; break; } }
if ($hargaTv > 0) { $harga = $hargaTv; }

// ── Prompt: AI menganalisa DATA TRADINGVIEW + konteks candle kita.
$kunciGroq = defined('GROQ_API_KEY') ? GROQ_API_KEY : '';
if (!$kunciGroq) {
    tv_jawab(200, ['status' => 'error', 'alasan' => 'Kunci Groq belum dikonfigurasi, analisa AI tidak bisa dijalankan.']);
}

$barisTf = [];
foreach ($tfs as $label => $d) {
    if (!$d) { $barisTf[] = "$label: NO_DATA"; continue; }
    $barisTf[] = sprintf('%s: %s | RSI %.1f | EMA %s | MACD %s | harga %s',
        $label, $d['signal'], $d['rsi'], $d['ema_cross'] ?? '-', $d['macd_hist'], $d['price']);
}
$ringkasTf = implode("\n", $barisTf);

$sistem = 'Kamu analis teknikal profesional. Kamu menerima ALERT dari TradingView milik pengguna '
    . '(berisi simbol, harga saat alert, timeframe, dan catatan/indikator yang dia tulis) DITAMBAH '
    . 'ringkasan candle dari server kami. Tugasmu menilai apakah alert TradingView ini layak dijadikan sinyal trade. '
    . 'Jawab HANYA dengan JSON valid tanpa penjelasan tambahan, dengan bentuk: '
    . '{"action":"BUY|SELL|SKIP","confidence":0-100,"entry":angka,"tp":angka,"sl":angka,'
    . '"reason":"alasan singkat bahasa Indonesia (maks 200 huruf)","bias":"BULLISH|BEARISH|NEUTRAL","catatan_data":"..."} '
    . 'Aturan: pakai SKIP bila bukti tidak cukup atau bertentangan. Jangan mengarang angka: entry/tp/sl wajib '
    . 'masuk akal terhadap harga terakhir, dan untuk BUY harus tp>entry>sl, untuk SELL harus tp<entry<sl. '
    . 'Jangan pernah menyebut jaminan keuntungan.';

$userPrompt = "ALERT TRADINGVIEW:\n"
    . "- simbol: {$simbol}\n"
    . "- timeframe alert: " . ($tfKiriman !== '' ? $tfKiriman : '(tidak disebutkan)') . "\n"
    . "- harga pada alert: " . ($hargaTv > 0 ? $hargaTv : '(tidak disebutkan)') . "\n"
    . "- pesan/indikator pengguna: " . ($pesanUser !== '' ? mb_substr($pesanUser, 0, 700) : '(kosong)') . "\n\n"
    . "RINGKASAN CANDLE SERVER (multi-timeframe):\n{$ringkasTf}\n\n"
    . "Konsensus timeframe: {$overall} (bull {$bullTfs} / bear {$bearTfs})\n"
    . "Harga acuan terakhir: {$harga}\n\n"
    . "Berikan keputusan JSON sesuai aturan.";

$muatan = json_encode([
    'model'       => defined('GROQ_SIGNAL_MODEL') ? GROQ_SIGNAL_MODEL : 'qwen/qwen3.8-27b',
    'temperature' => 0.2,
    'max_tokens'  => 450,
    'messages'    => [
        ['role' => 'system', 'content' => $sistem],
        ['role' => 'user',   'content' => $userPrompt],
    ],
], JSON_UNESCAPED_UNICODE);

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $muatan,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $kunciGroq],
    CURLOPT_TIMEOUT        => 45,
    CURLOPT_CONNECTTIMEOUT => 10,
]);
$hasilAi = curl_exec($ch);
$kodeAi  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($hasilAi === false || $kodeAi !== 200) {
    error_log('[TV-WEBHOOK] Groq error ' . $kodeAi . ': ' . substr((string)$hasilAi, 0, 200));
    tv_jawab(200, ['status' => 'error', 'alasan' => 'Layanan AI tidak dapat dihubungi saat ini. Alert diterima, sinyal tidak dicatat.']);
}

$jAi = json_decode((string)$hasilAi, true);
$teks = trim((string)($jAi['choices'][0]['message']['content'] ?? ''));
if (preg_match('/\{[\s\S]*\}/', $teks, $m)) { $teks = $m[0]; }
$keputusan = json_decode($teks, true);
if (!is_array($keputusan)) {
    tv_jawab(200, ['status' => 'error', 'alasan' => 'Jawaban AI tidak dapat dibaca sebagai JSON.', 'mentah' => mb_substr($teks, 0, 200)]);
}

$action = strtoupper((string)($keputusan['action'] ?? 'SKIP'));
$entry  = (float)($keputusan['entry'] ?? 0);
$tp     = (float)($keputusan['tp'] ?? 0);
$sl     = (float)($keputusan['sl'] ?? 0);
$alasan = mb_substr(trim((string)($keputusan['reason'] ?? '')), 0, 240);
$yakin  = max(0, min(100, (int)($keputusan['confidence'] ?? 0)));
tv_context(['action' => in_array($action, ['BUY', 'SELL'], true) ? $action : null]);

// ── Validasi level: jangan mencatat sinyal dengan level tak masuk akal.
$levelSah = ($entry > 0 && $tp > 0 && $sl > 0)
    && (($action === 'BUY' && $tp > $entry && $entry > $sl) || ($action === 'SELL' && $tp < $entry && $entry < $sl));

if (!in_array($action, ['BUY', 'SELL'], true) || !$levelSah) {
    tv_jawab(200, [
        'status'     => 'dilewati',
        'keputusan'  => ['action' => $action, 'confidence' => $yakin, 'reason' => $alasan],
        'alasan'     => 'AI memutuskan belum layak dijadikan sinyal (atau level tidak konsisten) — TIDAK dicatat.',
        'bias_mtf'   => $overall,
    ], 'PROCESSED');
}

// ── ENTRY AI DIPERIKSA TERHADAP HARGA PASAR (qi_sp_jangkar_entry) ─────────────
// Dulu entry/tp/sl AI dicatat apa adanya dan harga alert diabaikan; penilai lalu menganggap
// rekor terisi di entry itu dan membukukan TP "instan" di harga gap (audit 2026-10-22).
// ≤ 0,25×ATR: diterima · lebih jauh: digeser ke harga pasar (jarak SL/TP tetap) · harga sudah
// melewati TP/SL rencana atau harga pasar tidak tersedia: TIDAK dicatat.
$entryAi = $entry;
$cekEntryTv = qi_sp_jangkar_entry($action, $entry, $tp, $sl, $hargaAcuanTv, $atrAcuanTv);
if (!$cekEntryTv['ok']) {
    tv_jawab(200, [
        'status'     => 'dilewati',
        'keputusan'  => ['action' => $action, 'confidence' => $yakin, 'reason' => $alasan],
        'alasan'     => 'Entry tidak dicatat: ' . $cekEntryTv['catatan'],
        'kode'       => (string)$cekEntryTv['alasan'],
        'harga_acuan'=> $hargaAcuanTv > 0 ? round($hargaAcuanTv, 5) : null,
        'bias_mtf'   => $overall,
    ], 'PROCESSED');
}
$entry = $cekEntryTv['entry']; $tp = $cekEntryTv['tp']; $sl = $cekEntryTv['sl'];

// ── Catat sebagai sinyal AKTIF di rekor publik (schema sama seperti yang lain).
// Penulisan memakai helper pagar bersama (api/_signal_record.php) supaya SEMUA
// mesin memakai aturan yang sama: tolak duplikat sinyal aktif sejenis, cooldown
// 4 jam per simbol, jeda 20 menit antar pencatatan mesin yang sama, klaim atomik.
// Ini juga mencegah alert TradingView yang beruntun membanjiri rekor.
require_once __DIR__ . '/_signal_record.php';

$rr = ($action === 'BUY') ? (($tp - $entry) / max($entry - $sl, 1e-9)) : (($entry - $tp) / max($sl - $entry, 1e-9));
$record = [
    'id'              => 'SIG-TV-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
    'timestamp'       => qi_sig_waktu_utc(),                 // ISO 8601 UTC (api/_signal_time.php)
    'expiry'          => qi_sig_waktu_utc(time() + 12 * 3600),
    'symbol'          => $simbol,
    'engine'          => 'TRADINGVIEW',
    'engine_name'     => 'TradingView Alert + AI',
    'timeframe'       => 'MTF',
    'side'            => $action,
    'entry'           => round($entry, 5),
    'sl'              => round($sl, 5),
    'tp'              => round($tp, 5),
    'rr'              => '1 : ' . number_format($rr, 2),
    // ATR14 H1 nyata (dulu 0) + jejak pemeriksaan entry terhadap harga pasar server.
    'atr'             => round($atrAcuanTv, 5),
    'harga_acuan'     => round($hargaAcuanTv, 5),
    'jarak_entry_atr' => $cekEntryTv['jarak_entry_atr'],
    'entry_ai'        => $cekEntryTv['disesuaikan'] ? round($entryAi, 5) : null,
    // Selisih harga alert TradingView terhadap harga server (× ATR) — beda feed/broker terlihat.
    'selisih_harga_tv_atr' => ($hargaTv > 0 && $atrAcuanTv > 0) ? round(abs($hargaTv - $hargaAcuanTv) / $atrAcuanTv, 3) : null,
    'invalidation'    => $alasan !== '' ? $alasan : 'Level TP/SL tersentuh',
    'status'          => 'AKTIF',
    'pnl'             => 0,
    'pnl_usd'         => 0,
    'mtf_aligned'     => ($overall === ($action === 'BUY' ? 'BULLISH' : 'BEARISH')),
    'confluence_score'=> $yakin,
    // 'confidence' disimpan eksplisit agar analisa kalibrasi (expectancy per tingkat
    // keyakinan) bisa memakai kolom yang sama untuk semua mesin.
    'confidence'      => $yakin,
    'sumber'          => 'tradingview_webhook',
    // Bukti konfluensi (kolom yang sama dengan mesin lain) — ditulis APA ADANYA:
    // arah & level berasal dari verdict AI atas alert TradingView, dan skor konfluensi
    // memakai keyakinan AI tersebut. Sebelumnya rekor TradingView TIDAK mengisi kolom
    // ini sehingga buktinya kosong di rekor.
    'basis'           => 'Alert TradingView + verdict AI (keyakinan ' . (int)$yakin . '); level SL/TP dari AI'
        . ($cekEntryTv['disesuaikan'] ? ' (entry digeser ke harga pasar ' . round($hargaAcuanTv, 5) . ', jarak SL/TP AI dipertahankan)' : '')
        . '; bias MTF ' . ($overall !== '' ? $overall : 'tidak tersedia'),
    'tv_alert'        => ['timeframe' => $tfKiriman, 'price' => $hargaTv > 0 ? $hargaTv : null, 'pesan' => mb_substr($pesanUser, 0, 300)],
    'bias_mtf'        => $overall,
];
$catatTv = qi_signal_catat($record, 4, 20);
$tersimpan = (bool)$catatTv['dicatat'];

if (!$tersimpan) {
    tv_jawab(200, [
        'status'    => 'dilewati',
        'keputusan' => ['action' => $action, 'confidence' => $yakin, 'reason' => $alasan],
        'alasan'    => 'Sinyal TIDAK dicatat oleh pagar rekor: ' . $catatTv['alasan']
            . (isset($catatTv['detail']['sisa_menit']) ? (' (sisa ' . $catatTv['detail']['sisa_menit'] . ' menit)') : ''),
        'bias_mtf'  => $overall,
    ], 'DUPLICATE');
}

// Sinyal benar-benar tersimpan → tautkan id-nya ke log webhook.
tv_context(['signal_id' => (string)$record['id'], 'action' => $action]);

// ── Tautan untuk respons (spesifikasi Bagian 14) ─────────────────────────────
// URL dasar disusun dari permintaan ini sendiri; tautan gambar diambil dari JURNAL
// (bila pengguna sudah pernah mengunggah snapshot untuk sinyal ini). Bila belum ada,
// nilainya null — TIDAK diisi tautan palsu.
$protokolB = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$basisUrl  = $protokolB . '://' . (string)($_SERVER['HTTP_HOST'] ?? 'quantum-institut.com');
$tautanGambar = null;
try {
    require_once __DIR__ . '/_journal.php';
    if (qi_journal_tersedia(true, false)) {
        if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
        $stG = getDBConnection()->prepare('SELECT `chart_image_url` FROM `ai_signal_journal` WHERE `id` = ?');
        $stG->execute([(string)$record['id']]);
        $uG = $stG->fetchColumn();
        if (is_string($uG) && trim($uG) !== '') {
            $tautanGambar = (strpos($uG, 'http') === 0) ? $uG : ($basisUrl . '/' . ltrim($uG, '/'));
        }
    }
} catch (Throwable $e) {
    @error_log('[TV-WEBHOOK] tautan gambar dilewati: ' . $e->getMessage());
}

tv_jawab(200, [
    'status'    => 'sinyal_dicatat',
    // ── Bentuk respons sesuai spesifikasi Bagian 14 ──────────────────────────
    // Ditambahkan TANPA menghapus kolom lama, supaya integrasi yang sudah berjalan
    // (mis. skrip Anda yang membaca 'sinyal') TIDAK rusak.
    'message'     => 'Signal received and processed',
    'signal_id'   => (string)$record['id'],
    'chart_url'   => $tautanGambar,     // null bila belum ada snapshot — tidak dikarang
    'journal_url' => $basisUrl . '/dashboard.html?panel=panel-track',
    'gateway_url' => $basisUrl . '/dashboard.html?panel=panel-gateway',
    'sinyal'    => [
        'id'    => $record['id'],
        'pair'  => $simbol,
        'arah'  => $action,
        'entry' => $record['entry'],
        'tp'    => $record['tp'],
        'sl'    => $record['sl'],
        'rr'    => $record['rr'],
    ],
    'ai'        => ['confidence' => $yakin, 'reason' => $alasan],
    'bias_mtf'  => $overall,
    'catatan'   => 'Sinyal masuk rekor publik dan akan dinilai otomatis saat TP/SL tersentuh.',
]);
