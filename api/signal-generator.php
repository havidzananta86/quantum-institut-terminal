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
 *   4. LEVEL ATAU TIDAK SAMA SEKALI: SL = 1,5 × ATR14, TP = 2 × jarak SL
 *      (R:R tetap 1 : 2, sama dengan Quantum Terminal chart).
 *   5. FILTER BERITA: ditahan bila ada event High impact ±30 menit.
 *   6. KENDALI BEBAN: kunci ATOMIK (satu proses), jeda 15 menit, cooldown 4 jam
 *      per simbol, maksimal 3 simbol per jalan (yang sinyalnya paling lama kosong).
 *   7. TIDAK MEMAKAI DATA SIMULASI: bila candle dari sumber ditandai 'simulated',
 *      sinyal TIDAK dibuat (candle acak tidak boleh jadi keputusan).
 *   8. PASAR TUTUP / DATA BASI: forex & emas dilewati di luar Minggu 22:00 – Jumat 21:00 UTC
 *      atau bila candle M15 terakhir > 30 menit; kripto dilewati bila datanya basi
 *      (qi_sp_cek_pasar, api/_sinyal_pasar.php).
 *   9. SATU JALUR TULIS: rekor dicatat lewat qi_signal_catat() (kunci + semua gerbang),
 *      tidak pernah lagi menimpa berkas riwayat dari salinan lama.
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
// PENULIS REKOR BERSAMA: setiap sinyal dicatat lewat qi_signal_catat() — jalur tulis yang
// SAMA dengan AI, NEWS, dan TradingView. Di bawah kunci berkas ia menjalankan jeda darurat,
// gerbang spread, gerbang mesin (+ jejak per mesin), pagar duplikat AKTIF & cooldown,
// eksposur korelasi, grade, versi aturan, jurnal database, dan notifikasi.
//
// MENGAPA (audit sinyal 2026-10-22): dulu berkas ini membaca signal_history.json TANPA
// kunci, menghabiskan puluhan detik untuk jaringan (4× analisa, Groq, scanner TradingView),
// lalu MENIMPA seluruh berkas dengan salinan lamanya. Dashboard memicu penilai di +12 dtk
// dan pembangkit di +20 dtk, jadi tumpang-tindih itu terjadi di setiap muat halaman:
// penutupan TP/SL dari penilai kembali menjadi AKTIF, dan sinyal AI/NEWS/TV yang tercatat
// di tengah jalan hilang permanen. Gerbang spread/korelasi/duplikat, grade, jurnal, dan
// notifikasi juga terlewati sama sekali.
require_once __DIR__ . '/_signal_record.php';
require_once __DIR__ . '/_json_kunci.php';

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
// Per mata uang (2026-10-19): di sini hanya menyegarkan kalender dan menahan bila ADA berita
// yang relevan untuk SEMUA kandidat (mis. berita USD → semua pasangan USD, emas, kripto).
// Berita yang hanya menggerakkan sebagian simbol ditahan per simbol di dalam putaran.
$blackout = qi_berita_blackout(30, true, 'USD');
if ($blackout['aktif']) {
    if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);
    gen_jawab(200, [
        'status' => 'ok', 'dijalankan' => false, 'dilewati' => true, 'sebab' => 'blackout_berita',
        'berita' => $blackout['event'], 'catatan' => $blackout['catatan'],
    ]);
}

// ── ENGINE (dipakai ulang dari ai-signal.php) ───────────────────────────────
define('QI_AI_SIGNAL_LIB', 1);
// Sinyal otomatis memakai candle feed broker MT5 (VPS) bila tersedia; OANDA/sumber lama cadangan.
if (!defined('QI_SERVER_MT5')) define('QI_SERVER_MT5', true);
require_once __DIR__ . '/ai-signal.php';
if (!function_exists('ai_analyze') || !function_exists('ai_load_candles')) {
    gen_jawab(200, ['status' => 'error', 'message' => 'Engine analisa tidak tersedia.']);
}

/** ATR-14 sederhana dari candle (True Range rata-rata) — rumus bersama qi_sp_atr(). */
function gen_atr(array $candles, int $periode = 14): float {
    return qi_sp_atr($candles, $periode);
}

$DIDUKUNG = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
$COOLDOWN_JAM = 4;
$MAKS_PER_JALAN = 3;

// Riwayat yang ada — HANYA DIBACA untuk rotasi & perkiraan cooldown. Keputusan cooldown,
// duplikat, dan korelasi yang mengikat dibuat ulang oleh qi_signal_catat() di bawah kunci,
// atas isi berkas TERBARU. Berkas ini tidak pernah lagi ditulis dari salinan ini.
$history = qi_json_baca($historyFile);

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
$ditolak = 0;                 // ditolak pagar/gerbang qi_signal_catat — dilaporkan apa adanya
$diperiksa = 0;
$kini = time();

foreach ($kandidat as $simbol) {
    if ($dibuat >= $MAKS_PER_JALAN) break;
    // Cooldown per simbol.
    if (isset($terakhir[$simbol]) && ($kini - $terakhir[$simbol]) < $COOLDOWN_JAM * 3600) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'cooldown', 'sisa_menit' => (int)round(($COOLDOWN_JAM * 3600 - ($kini - $terakhir[$simbol])) / 60)];
        continue;
    }

    // ── PENJAGA PASAR TUTUP (sebelum analisa apa pun) ─────────────────────
    // Dashboard memicu pembangkit setiap kali dibuka, termasuk Sabtu/Minggu. Tanpa penjaga
    // ini XAUUSD/forex terbit AKTIF dengan entry = close Jumat, menghabiskan cooldown, dan
    // membuka posisi auto-paper di harga beku. Candle M15 dipakai karena paling peka umur.
    $m15 = ai_load_candles($simbol, '15');
    $pasar = qi_sp_cek_pasar($simbol, !empty($m15['simulated']) ? [] : ($m15['candles'] ?? []), 900, $kini);
    if (!$pasar['boleh']) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => (string)$pasar['alasan'], 'catatan' => $pasar['catatan']];
        continue;
    }
    $diperiksa++;

    $tfs = [];
    foreach (['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'] as $iv => $label) {
        $tfs[$label] = ai_analyze($simbol, (string)$iv);
    }
    // Timeframe dari cache basi (stale) tidak ikut memilih arah 3-dari-4 (ai_tf_dipakai).
    $tfs = ai_tf_dipakai($tfs);
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

    // Harga & ATR dari candle H1 NYATA dan SEGAR (qi_sp_muat_layak). Dulu hanya data simulasi
    // yang ditolak: H1 basi 3 hari (cache stale dari get-chart-data) lolos selama M15 segar, dan
    // entry = close lama itu dicatat dengan harga_acuan = entry, jarak_entry_atr = 0 — klaim palsu
    // "harga pasar saat ini" — lalu auto-paper ikut membuka posisi di harga itu.
    $muat = ai_load_candles($simbol, '60');
    $layak = qi_sp_muat_layak($simbol, $muat, 3600, $kini);
    if (!$layak['boleh']) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => (string)$layak['alasan'], 'catatan' => $layak['catatan']];
        continue;
    }
    try {
        $allCandles = qt_signal_normalize_candle_series($muat['candles'] ?? []);
        $candles = array_slice($allCandles, 0, -1);
    } catch (Throwable $e) {
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'data_candle_tidak_valid'];
        continue;
    }
    $harga = (float)($candles[count($candles) - 1]['close'] ?? 0);
    $atr   = qt_signal_atr($candles, 14) ?? 0.0;
    if ($harga <= 0 || $atr <= 0) { $hasil[] = ['simbol' => $simbol, 'hasil' => 'atr_tidak_valid']; continue; }

    $jarakSl = 1.5 * $atr;                       // SL = 1,5 × ATR14
    $jarakTp = 2.0 * $jarakSl;                   // R:R 1 : 2
    $entry = round($harga, 5);
    $sl = round(($arah === 'BUY') ? $harga - $jarakSl : $harga + $jarakSl, 5);
    $tp = round(($arah === 'BUY') ? $harga + $jarakTp : $harga - $jarakTp, 5);

    // Validasi arah level (aturan yang sama dengan penilai sinyal).
    $sah = ($arah === 'BUY') ? ($tp > $entry && $entry > $sl) : ($tp < $entry && $entry < $sl);
    if (!$sah) { $hasil[] = ['simbol' => $simbol, 'hasil' => 'level_tidak_konsisten']; continue; }

    // Berita berdampak tinggi untuk mata uang simbol INI (mis. EUR untuk EURUSD). Diperiksa
    // sesudah level ada, supaya kandidat yang ditahan bisa dinilai kontrafaktual (api/_sinyal_ditolak.php).
    $boSimbol = qi_berita_blackout(30, false, $simbol);
    if (!empty($boSimbol['aktif'])) {
        require_once __DIR__ . '/_sinyal_ditolak.php';
        qi_ditolak_catat(['symbol' => $simbol, 'side' => $arah, 'engine' => 'AUTO_SIGNAL', 'entry' => $entry, 'sl' => $sl, 'tp' => $tp,
                          'atr' => round($atr, 5), 'expiry' => qi_sig_waktu_utc($kini + 12 * 3600)], 'blackout_berita',
                         ['berita' => (string)($boSimbol['event']['judul'] ?? ''), 'mata_uang' => (string)($boSimbol['event']['mata_uang'] ?? '')]);
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'blackout_berita', 'berita' => $boSimbol['event']];
        continue;
    }

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
        'rr'            => '1 : 2.00',
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
        'basis'         => 'EMA20/50 + RSI14 + MACD (M15–D1), level dari ATR14 (SL 1,5×ATR, TP 2×SL). '
            . 'Verdict AI: ' . (is_array($verdictAi) ? $verdictAi['action'] . ' (keyakinan ' . $aiYakin . ')' : 'tidak ada penilaian'),
        'setuju_bull'   => $bull,
        'setuju_bear'   => $bear,
        // Entry = close H1 nyata saat ini, jadi jaraknya ke harga pasar 0 (kolom yang sama
        // dengan sinyal AI/TV yang entry-nya diperiksa qi_sp_jangkar_entry).
        'harga_acuan'   => $entry,
        'jarak_entry_atr' => 0.0,
    ];
    // ── CATAT LEWAT PENULIS BERSAMA (di bawah kunci) ──────────────────────
    // Jeda global per mesin = 0: pembangkit memang boleh menerbitkan sampai MAKS_PER_JALAN
    // simbol berbeda dalam satu jalan; cooldown per simbol tetap $COOLDOWN_JAM.
    $catat = qi_signal_catat($rek, $COOLDOWN_JAM, 0);
    if (empty($catat['dicatat'])) {
        $ditolak++;
        $alasanTolak = (string)($catat['alasan'] ?? 'tidak_diketahui');
        $catatanTolak = (string)($catat['detail']['catatan'] ?? ($catat['detail']['sebab'] ?? ''));
        $hasil[] = ['simbol' => $simbol, 'hasil' => 'ditolak_' . $alasanTolak, 'catatan' => mb_substr($catatanTolak, 0, 200)];
        continue;
    }
    $dibuat++;
    $terakhir[$simbol] = $kini;
    $hasil[] = ['simbol' => $simbol, 'hasil' => 'sinyal_dibuat', 'id' => $rek['id'], 'arah' => $arah, 'entry' => $entry, 'tp' => $tp, 'sl' => $sl, 'skor' => $skor];
}

// Isi berkas TERBARU (bukan salinan awal jalan ini) — dipakai auto-paper & laporan.
$historyKini = qi_json_baca($historyFile);
if ($dibuat > 0) {
    // Pengguna yang mengaktifkan "Ikuti Auto Analisa" langsung mendapat posisi simulasi untuk sinyal baru.
    try {
        require_once __DIR__ . '/_auto_paper.php';
        qi_ap_sinkron(qi_db(), $historyKini);
    } catch (Throwable $e) {
        @error_log('[auto-paper] hook pembangkit gagal: ' . $e->getMessage());
    }
}
if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);

$ringkas = [
    'status'      => 'ok',
    'dijalankan'  => true,
    'dibuat'      => $dibuat,
    'ditolak'     => $ditolak,   // ditolak pagar/gerbang penulis bersama — angka ini penting untuk audit
    'diperiksa'   => $diperiksa,
    'total_rekor' => count($historyKini),
    'rincian'     => $hasil,
    'basis'       => 'EMA20/50 + RSI14 + MACD multi-timeframe; level SL/TP dari ATR14',
    'catatan'     => $dibuat > 0
        ? 'Sinyal baru masuk rekor dan akan dinilai otomatis saat TP/SL tersentuh.'
        : 'Tidak ada setup yang memenuhi syarat saat ini (minimal 3 timeframe sepakat + searah bias D1). Ini normal — pembangkit tidak memaksa memberi sinyal.',
];
echo $isCli ? json_encode($ringkas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL : json_encode($ringkas, JSON_UNESCAPED_UNICODE);
