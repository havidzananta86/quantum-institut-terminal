<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — PEMBANGKIT SINYAL OTOMATIS (engine sendiri, jujur, terkendali)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Tujuan: rekor sinyal hanya bisa dinilai bila ada cukup data. Selama ini sinyal
 *  masuk HANYA lewat POST admin, sehingga sampel tetap kecil dan kalibrasi ambang
 *  mustahil. Berkas ini menghasilkan sinyal secara otomatis dari ENGINE APLIKASI
 *  SENDIRI, dengan aturan yang ketat dan dapat diaudit:
 *
 *   1. ENGINE (bukan karangan): ai_analyze() — EMA20/EMA50, RSI14, MACD histogram
 *      pada M15, H1, H4, D1 (fungsi yang sama dipakai AI Radar).
 *   2. SYARAT MASUK: minimal 3 timeframe sepakat (BULLISH atau BEARISH).
 *   3. ANTI COUNTER-TREND: arah sinyal tidak boleh melawan bias D1 (EMA20 vs EMA50).
 *   4. LEVEL ATAU TIDAK SAMA SEKALI: SL = 1,2 × ATR14, TP = 2,5 × jarak SL
 *      (R:R tetap 1 : 2,5 seperti sinyal lain di aplikasi).
 *   5. FILTER BERITA: ditahan bila ada event High impact ±30 menit.
 *   6. KENDALI BEBAN: kunci ATOMIK (satu proses), jeda 15 menit, cooldown 4 jam
 *      per simbol, maksimal 3 simbol per jalan (yang sinyalnya paling lama kosong).
 *   7. TIDAK MEMAKAI DATA SIMULASI: bila candle dari sumber ditandai 'simulated',
 *      sinyal TIDAK dibuat (candle acak tidak boleh jadi keputusan).
 *
 *  Label pada rekor dibuat jujur: engine AUTO_SIGNAL + kolom 'basis' menjelaskan
 *  bahwa levelnya dari ATR dan arahnya dari EMA/RSI/MACD — bukan klaim AI.
 *
 *  Pemakaian:
 *    · Dashboard (self-healing):  GET api/signal-generator.php?auto=1  + token login
 *    · Cron cPanel (opsional):    php api/signal-generator.php   atau ?key=CRON_SECRET
 * ═══════════════════════════════════════════════════════════════════════════
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
// Penjaga bersama SEBELUM sinyal terbit (jeda, gerbang mesin, konteks berita) dan
// pekerjaan setelah terbit (jurnal database + jejak mesin). Tanpa ini, generator
// menulis rekor langsung sehingga MELEWATI semua penjaga — cacat yang ditemukan
// 2026-10-13 (dua sinyal terbit tanpa dinilai gerbang dan tanpa jejak).
require_once __DIR__ . '/_signal_record.php';

$keysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($keysFile)) require_once $keysFile;

function gen_jawab(int $kode, array $data): void {
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$isCli = (PHP_SAPI === 'cli');
$auto  = false;

if (!$isCli) {
    $cronKey  = defined('CRON_SECRET_KEY') ? CRON_SECRET_KEY : '';
    $provided = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
    $viaCron  = ($cronKey && $provided && hash_equals($cronKey, (string)$provided));

    if (!$viaCron) {
        if (empty($_GET['auto'])) {
            gen_jawab(403, ['status' => 'error', 'message' => 'Akses ditolak. Gunakan ?auto=1 (perlu login) atau kunci cron.']);
        }
        $auto = true;
        if (!qi_validate_token()) {
            gen_jawab(401, ['status' => 'error', 'message' => 'Perlu login untuk menjalankan pembangkit otomatis.', 'code' => 'AUTH_REQUIRED']);
        }
        // ── Jeda 15 menit (murah: hanya membaca satu berkas) ──
        $penanda = __DIR__ . '/../cache/signal_gen_auto.txt';
        if (file_exists($penanda) && (time() - (int)@filemtime($penanda)) < 900) {
            gen_jawab(200, [
                'status' => 'ok', 'mode' => 'auto', 'dijalankan' => false, 'dilewati' => true,
                'alasan' => 'dijeda 15 menit (terakhir ' . (time() - (int)@filemtime($penanda)) . ' detik lalu)',
            ]);
        }
        // ── Klaim ATOMIK: hanya satu proses yang boleh menghasilkan sinyal ──
        $kunciFile = __DIR__ . '/../cache/signal_gen.lock';
        $fp = @fopen($kunciFile, 'x');
        if ($fp === false && file_exists($kunciFile) && (time() - (int)@filemtime($kunciFile)) > 600) {
            @unlink($kunciFile);
            $fp = @fopen($kunciFile, 'x');
        }
        if ($fp === false) {
            gen_jawab(200, ['status' => 'ok', 'mode' => 'auto', 'dijalankan' => false, 'dilewati' => true, 'alasan' => 'pembangkit lain sedang berjalan']);
        }
        fclose($fp);
        register_shutdown_function(function () use ($kunciFile) { @unlink($kunciFile); });
    }
}

$penandaAuto = __DIR__ . '/../cache/signal_gen_auto.txt';
$historyFile = __DIR__ . '/../cache/signal_history.json';

// ── FILTER BERITA: tahan sinyal di sekitar event High impact ────────────────
// $bolehSegarkan = true: inilah jalur yang MENCATAT sinyal, jadi cache kalender
// yang basi disegarkan lebih dulu (dibatasi 5 menit sekali di dalam fungsinya).
// Tanpa ini filter hanya aktif bila kebetulan ada pengguna membuka panel Kalender —
// ditemukan di produksi: cache 459 menit sehingga filter tidak pernah bekerja.
$blackout = qi_berita_blackout(30, true);
if ($blackout['aktif']) {
    if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);
    gen_jawab(200, [
        'status' => 'ok', 'dijalankan' => false, 'dilewati' => true, 'sebab' => 'blackout_berita',
        'berita' => $blackout['event'], 'catatan' => $blackout['catatan'],
    ]);
}

// ── ENGINE (dipakai ulang dari ai-signal.php) ───────────────────────────────
define('QI_AI_SIGNAL_LIB', 1);
require_once __DIR__ . '/ai-signal.php';
if (!function_exists('ai_analyze') || !function_exists('ai_load_candles')) {
    gen_jawab(200, ['status' => 'error', 'message' => 'Engine analisa tidak tersedia.']);
}

/** ATR-14 sederhana dari candle (True Range rata-rata). */
function gen_atr(array $candles, int $periode = 14): float {
    $n = count($candles);
    if ($n < $periode + 2) return 0.0;
    $tr = [];
    for ($i = $n - $periode; $i < $n; $i++) {
        $h = (float)($candles[$i]['high'] ?? 0);
        $l = (float)($candles[$i]['low'] ?? 0);
        $pc = (float)($candles[$i - 1]['close'] ?? 0);
        $tr[] = max($h - $l, abs($h - $pc), abs($l - $pc));
    }
    return $tr ? array_sum($tr) / count($tr) : 0.0;
}

$DIDUKUNG = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
$COOLDOWN_JAM = 4;
$MAKS_PER_JALAN = 3;

// Riwayat yang ada (untuk cooldown & rotasi).
$history = is_file($historyFile) ? json_decode((string)@file_get_contents($historyFile), true) : [];
if (!is_array($history)) $history = [];

// Waktu sinyal terakhir per simbol (hanya dari pembangkit ini, agar adil).
$terakhir = [];
foreach ($history as $r) {
    $s = strtoupper((string)($r['symbol'] ?? ''));
    if ($s === '' || ($r['sumber'] ?? '') !== 'auto_generator') continue;
    $t = qi_sig_epoch($r['timestamp'] ?? null);
    if ($t !== null && (!isset($terakhir[$s]) || $t > $terakhir[$s])) $terakhir[$s] = $t;
}

// Rotasi: prioritaskan simbol yang paling lama tidak menghasilkan sinyal.
$kandidat = $DIDUKUNG;
usort($kandidat, function ($a, $b) use ($terakhir) {
    return ($terakhir[$a] ?? 0) <=> ($terakhir[$b] ?? 0);
});

$hasil = [];
$dibuat = 0;
    $ditolak = 0;                 // ditolak penjaga (jeda / gerbang mesin) — dilaporkan apa adanya
    $gerbangTercatat = [];        // id sinyal → hasil penilaian gerbang (untuk jejak mesin)
$diperiksa = 0;
$kini = time();

foreach ($kandidat as $simbol) {
    if ($dibuat >= $MAKS_PER_JALAN) break;
    // Cooldown per simbol.
    if (isset($terakhir[$simbol]) && ($kini - $terakhir[$simbol]) < $COOLDOWN_JAM * 3600) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'cooldown', 'sisa_menit' => (int)round(($COOLDOWN_JAM * 3600 - ($kini - $terakhir[$simbol])) / 60)];
        continue;
    }
    $diperiksa++;

    $tfs = [];
    foreach (['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'] as $iv => $label) {
        $tfs[$label] = ai_analyze($simbol, (string)$iv);
    }
    $adaData = array_filter($tfs);
    if (!$adaData) { $hasil[] = ['simbol' => $simbol, 'hasil' => 'tanpa_data']; continue; }

    $bull = 0; $bear = 0;
    foreach ($tfs as $d) {
        if (!$d) continue;
        if ($d['signal'] === 'BULLISH') $bull++;
        if ($d['signal'] === 'BEARISH') $bear++;
    }
    $arah = ($bull >= 3) ? 'BUY' : (($bear >= 3) ? 'SELL' : null);
    if ($arah === null) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'tidak_sepakat', 'bull' => $bull, 'bear' => $bear];
        continue;
    }

    // Anti counter-trend: bias D1 (EMA20 vs EMA50) tidak boleh berlawanan.
    $d1 = $tfs['D1'] ?? null;
    if ($d1 && !empty($d1['ema_cross'])) {
        $biasD1 = ($d1['ema_cross'] === 'UP') ? 'BUY' : 'SELL';
        if ($biasD1 !== $arah) {
            $hasil[] = ['simbol' => $simbol, 'hasil' => 'melawan_bias_d1', 'arah' => $arah, 'bias_d1' => $biasD1];
            continue;
        }
    }

    // Harga & ATR dari candle H1 NYATA (tolak data simulasi).
    $muat = ai_load_candles($simbol, '60');
    if (empty($muat['candles']) || !empty($muat['simulated'])) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'data_simulasi_ditolak'];
        continue;
    }
    $candles = $muat['candles'];
    $harga = (float)($candles[count($candles) - 1]['close'] ?? 0);
    $atr   = gen_atr($candles, 14);
    if ($harga <= 0 || $atr <= 0) { $hasil[] = ['simbol' => $simbol, 'hasil' => 'atr_tidak_valid']; continue; }

    $jarakSl = 1.2 * $atr;                       // SL = 1,2 × ATR14
    $jarakTp = 2.5 * $jarakSl;                   // R:R 1 : 2,5
    $entry = round($harga, 5);
    $sl = round(($arah === 'BUY') ? $harga - $jarakSl : $harga + $jarakSl, 5);
    $tp = round(($arah === 'BUY') ? $harga + $jarakTp : $harga - $jarakTp, 5);

    // Validasi arah level (aturan yang sama dengan penilai sinyal).
    $sah = ($arah === 'BUY') ? ($tp > $entry && $entry > $sl) : ($tp < $entry && $entry < $sl);
    if (!$sah) { $hasil[] = ['simbol' => $simbol, 'hasil' => 'level_tidak_konsisten']; continue; }

    $skor = (int)round(min(100, ($arah === 'BUY' ? $bull : $bear) * 20 + 10));   // 3 TF = 70, 4 TF = 90

    // ── PENILAIAN AI SEBAGAI PENYARING (bukan pengganti) ─────────────────────
    // Verdict AI DISIMPAN DI DALAM catatan ini — TIDAK membuat catatan kedua.
    // Satu setup dicatat SEKALI supaya jumlah sinyal tidak menggelembung. Dengan
    // menyimpan ai_setuju / ai_alasan / ai_keyakinan, akurasi AI sebagai penyaring
    // tetap bisa diukur nanti (bandingkan hasil saat ai_setuju=true vs false) dan
    // nilai keyakinannya mengisi bucket kalibrasi.
    // Bila AI tidak menjawab → dianggap TIDAK ADA penilaian (bukan setuju, bukan tolak).
    require_once __DIR__ . '/_ai_verdict.php';
    $ringkasTf = [];
    foreach ($tfs as $label => $d) {
        if (!$d) continue;
        $ringkasTf[] = sprintf('%s: %s | RSI %.1f | EMA %s | MACD %s', $label, $d['signal'], $d['rsi'], $d['ema_cross'] ?? '-', $d['macd_hist']);
    }
    $verdictAi = function_exists('qi_ai_verdict')
        ? qi_ai_verdict(
            'SETUP MESIN OTOMATIS ' . $simbol,
            "- arah mesin: {$arah}\n- timeframe sepakat: bull {$bull} / bear {$bear}\n- harga acuan: {$entry}\n- ATR14: " . round($atr, 5),
            implode("\n", $ringkasTf)
        )
        : null;
    $aiSetuju = null; $aiAlasan = ''; $aiYakin = null;
    if (is_array($verdictAi)) {
        $aiSetuju = ($verdictAi['action'] === $arah);
        $aiAlasan = $verdictAi['reason'] !== '' ? $verdictAi['reason'] : ($verdictAi['risiko'] ?? '');
        $aiYakin  = (int)$verdictAi['confidence'];
    }

    $rek = [
        'id'            => 'SIG-AUTO-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
        'timestamp'     => qi_sig_waktu_utc($kini),            // ISO 8601 UTC (api/_signal_time.php)
        'expiry'        => qi_sig_waktu_utc($kini + 12 * 3600),
        'symbol'        => $simbol,
        'engine'        => 'AUTO_SIGNAL',
        'engine_name'   => 'Quantum Auto Signal',
        'timeframe'     => 'MTF',
        'side'          => $arah,
        'entry'         => $entry,
        'sl'            => $sl,
        'tp'            => $tp,
        'rr'            => '1 : 2.50',
        'atr'           => round($atr, 5),
        'invalidation'  => 'Level TP/SL tersentuh, atau struktur M15 berbalik',
        'status'        => 'AKTIF',
        'pnl'           => 0,
        'pnl_usd'       => 0,
        'mtf_aligned'   => true,
        'confluence_score' => $skor,
        // Keyakinan untuk kalibrasi: pakai nilai AI bila ada, jika tidak pakai skor mesin.
        'confidence'    => $aiYakin ?? $skor,
        'ai_verdict'    => is_array($verdictAi) ? $verdictAi : null,
        'ai_setuju'     => $aiSetuju,
        'ai_alasan'     => mb_substr((string)$aiAlasan, 0, 240),
        'ai_keyakinan'  => $aiYakin,
        'sumber'        => 'auto_generator',
        'basis'         => 'EMA20/50 + RSI14 + MACD (M15–D1), level dari ATR14 (1,2×SL, 2,5×TP). '
            . 'Verdict AI: ' . (is_array($verdictAi) ? $verdictAi['action'] . ' (keyakinan ' . $aiYakin . ')' : 'tidak ada penilaian'),
        'setuju_bull'   => $bull,
        'setuju_bear'   => $bear,
        'harga_acuan'   => $entry,
    ];
    // ── PENJAGA SEBELUM TERBIT ────────────────────────────────────────────
    // Satu tempat untuk jeda darurat, gerbang konfluensi mesin, dan konteks berita.
    $jaga = qi_signal_praterbit($rek);
    if (empty($jaga['boleh'])) {
        $ditolak++;
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'ditolak_' . $jaga['alasan'], 'catatan' => mb_substr((string)$jaga['catatan'], 0, 200)];
        continue;
    }
    $rek = $jaga['rek'];
    $gerbangTercatat[$rek['id']] = $jaga['gerbang'];
    array_unshift($history, $rek);
    $dibuat++;
    $terakhir[$simbol] = $kini;
    $hasil[] = ['simbol' => $simbol, 'hasil' => 'sinyal_dibuat', 'id' => $rek['id'], 'arah' => $arah, 'entry' => $entry, 'tp' => $tp, 'sl' => $sl, 'skor' => $skor];
}

if ($dibuat > 0) {
    if (count($history) > 500) $history = array_slice($history, 0, 500);
    @copy($historyFile, __DIR__ . '/../cache/signal_history.backup.json');
    @file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT), LOCK_EX);
}
if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);

$ringkas = [
    'status'      => 'ok',
    'dijalankan'  => true,
    'dibuat'      => $dibuat,
    'ditolak'     => $ditolak,   // ditolak jeda/gerbang mesin — angka ini penting untuk audit
    'diperiksa'   => $diperiksa,
    'total_rekor' => count($history),
    'rincian'     => $hasil,
    'basis'       => 'EMA20/50 + RSI14 + MACD multi-timeframe; level SL/TP dari ATR14',
    'catatan'     => $dibuat > 0
        ? 'Sinyal baru masuk rekor dan akan dinilai otomatis saat TP/SL tersentuh.'
        : 'Tidak ada setup yang memenuhi syarat saat ini (minimal 3 timeframe sepakat + searah bias D1). Ini normal — pembangkit tidak memaksa memberi sinyal.',
];
echo $isCli ? json_encode($ringkas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL : json_encode($ringkas, JSON_UNESCAPED_UNICODE);
