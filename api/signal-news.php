<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — ENDPOINT SINYAL BERITA (NEWS SETUP)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Menerbitkan sinyal ~5 MENIT SEBELUM rilis data High impact, untuk XAUUSD dan
 * simbol yang benar-benar terdampak mata uang event tersebut.
 *
 * Alur:
 *   1. Segarkan cache kalender bila basi (memakai pustaka yang sudah ada).
 *   2. Cari event High impact yang rilis 3–7 menit lagi (target 5 menit).
 *   3. Untuk tiap simbol terdampak: ambil analisa teknikal multi-timeframe NYATA
 *      (ai_analyze) + ATR14 dari candle H1 nyata.
 *   4. Minta verdict AI dengan KONTEKS FUNDAMENTAL LENGKAP (judul, mata uang,
 *      dampak, perkiraan, sebelumnya, aktual).
 *   5. Susun level dari ATR (SL 2×ATR — lebih lebar karena berita melebarkan
 *      spread; TP 1,5× SL → R:R 1:1,5) lalu catat lewat pagar bersama.
 *
 * ⚠️ Filter berita SENGAJA DILEWATI di sini — memang itu tujuan fitur ini.
 * Mesin lain (AUTO_SIGNAL, AI, TRADINGVIEW) TETAP dilindungi filter ±30 menit.
 * Sinyal ini berlabel engine=NEWS sehingga statistiknya tidak tercampur, dan
 * selalu disertai peringatan risiko: spread melebar, slippage, whipsaw.
 *
 * Pemakaian:
 *   · Dashboard (penyembuh sendiri): GET api/signal-news.php?auto=1 (+ token)
 *   · Cron cPanel (opsional):         php api/signal-news.php   atau ?key=CRON_SECRET
 * ═══════════════════════════════════════════════════════════════════════════
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_news_signal.php';
require_once __DIR__ . '/_signal_record.php';

$keysFile = __DIR__ . '/../config/api_keys.php';
if (file_exists($keysFile)) require_once $keysFile;

function news_jawab(int $kode, array $data): void {
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
            news_jawab(403, ['status' => 'error', 'message' => 'Akses ditolak. Gunakan ?auto=1 (perlu login) atau kunci cron.']);
        }
        $auto = true;
        if (!qi_validate_token()) {
            news_jawab(401, ['status' => 'error', 'message' => 'Perlu login untuk menjalankan pemantau berita.', 'code' => 'AUTH_REQUIRED']);
        }
        // Jeda 60 detik: cukup rapat untuk menangkap jendela 5 menit, cukup longgar
        // agar banyak pengguna tidak memicu berkali-kali.
        $penanda = __DIR__ . '/../cache/signal_news_auto.txt';
        if (file_exists($penanda) && (time() - (int)@filemtime($penanda)) < 60) {
            news_jawab(200, [
                'status' => 'ok', 'dijalankan' => false, 'dilewati' => true,
                'alasan' => 'dijeda 60 detik (terakhir ' . (time() - (int)@filemtime($penanda)) . ' detik lalu)',
            ]);
        }
        // Klaim ATOMIK: satu proses saja (banyak pengguna, satu sinyal).
        $kunciFile = __DIR__ . '/../cache/signal_news.lock';
        $fp = @fopen($kunciFile, 'x');
        if ($fp === false && file_exists($kunciFile) && (time() - (int)@filemtime($kunciFile)) > 120) {
            @unlink($kunciFile);
            $fp = @fopen($kunciFile, 'x');
        }
        if ($fp === false) {
            news_jawab(200, ['status' => 'ok', 'dijalankan' => false, 'dilewati' => true, 'alasan' => 'pemantau lain sedang berjalan']);
        }
        fclose($fp);
        register_shutdown_function(function () use ($kunciFile) { @unlink($kunciFile); });
    }
}

$penandaAuto = __DIR__ . '/../cache/signal_news_auto.txt';
$historyFile = __DIR__ . '/../cache/signal_history.json';

// ── 1) Kalender: segarkan bila basi, lalu baca apa adanya ───────────────────
if (function_exists('qi_berita_segarkan_kalender')) qi_berita_segarkan_kalender();
$kalFile = __DIR__ . '/../cache/calendar.json';
if (!is_file($kalFile)) {
    if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);
    news_jawab(200, ['status' => 'ok', 'dijalankan' => false, 'sebab' => 'kalender_kosong',
        'catatan' => 'Cache kalender belum tersedia sehingga tidak ada event yang bisa dipantau.']);
}
$kalender = json_decode((string)@file_get_contents($kalFile), true);
if (!is_array($kalender)) {
    news_jawab(200, ['status' => 'ok', 'dijalankan' => false, 'sebab' => 'kalender_tidak_terbaca']);
}

// ── 2) Riwayat Sinyal & Pemeriksaan Pembatalan Dini (Early Invalidation) ──────
$history = is_file($historyFile) ? json_decode((string)@file_get_contents($historyFile), true) : [];
if (!is_array($history)) $history = [];

$batalDini = [];
if (!empty($kalender['data']) && is_array($history)) {
    foreach ($kalender['data'] as $eKal) {
        if (!is_array($eKal) || empty($eKal['actual']) || $eKal['actual'] === '-') continue;
        $devKal = qi_news_analisa_deviasi($eKal);
        if (!$devKal['tersedia'] || $devKal['kekuatan'] === 'BELUM_RILIS') continue;

        foreach ($history as &$sig) {
            if (!is_array($sig) || ($sig['status'] ?? '') !== 'AKTIF' || ($sig['engine'] ?? '') !== 'NEWS') continue;
            if ((string)($sig['news_event_id'] ?? '') === (string)($eKal['id'] ?? '')) {
                $cek = qi_news_cek_invalidation($sig, $devKal);
                if ($cek['perlu_batal']) {
                    $sig['status'] = 'BATAL_NEWS';
                    $sig['invalidation'] = $cek['alasan'];
                    $sig['closed_at'] = function_exists('qi_sig_waktu_utc') ? qi_sig_waktu_utc() : gmdate('Y-m-d\TH:i:s\Z');
                    $batalDini[] = ['id' => $sig['id'], 'simbol' => $sig['symbol'], 'side' => $sig['side'] ?? '', 'alasan' => $cek['alasan']];
                }
            }
        }
        unset($sig);
    }
    if ($batalDini) {
        @file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        if (is_file(__DIR__ . '/_telegram.php')) {
            require_once __DIR__ . '/_telegram.php';
            if (function_exists('qi_telegram_notifikasi_batal')) {
                foreach ($batalDini as $bd) {
                    @qi_telegram_notifikasi_batal(['symbol' => $bd['simbol'], 'id' => $bd['id'], 'side' => $bd['side']], $bd['alasan']);
                }
            }
        }
    }
}

// ── 3) Cari Event: Prioritas 1 Pre-News (3–7 mnt lagi), Prioritas 2 Post-News (1–20 mnt lalu) ──
$isPasca = false;
$event = qi_news_cari_event($kalender, time(), 5, 2);

if ($event === null) {
    // Cari rilis pasca data keluar dengan deviasi nyata
    $event = qi_news_cari_event_pasca($kalender, time(), 20);
    if ($event !== null) {
        $isPasca = true;
    }
}

if ($event === null) {
    if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);
    $high = 0;
    foreach (($kalender['data'] ?? []) as $e) { if (is_array($e) && strtolower((string)($e['impact'] ?? '')) === 'high') $high++; }
    news_jawab(200, [
        'status' => 'ok', 'dijalankan' => true, 'dibuat' => 0, 'sebab' => 'tidak_ada_event_aktif',
        'event_high_di_kalender' => $high,
        'batal_dini' => $batalDini,
        'catatan' => 'Tidak ada rilis High impact dalam jendela 5 menit ke depan atau 20 menit pasca-rilis. '
            . 'Pemantau berjalan lagi pada pemeriksaan berikutnya.',
    ]);
}

$menitWaktu = $isPasca ? (int)($event['menit_lalu'] ?? 0) : (int)($event['menit_lagi'] ?? 0);
$snapshot = qi_news_snapshot($event, $menitWaktu);
$snapshot['mode'] = $isPasca ? 'POST_RELEASE' : 'PRE_RELEASE';
$deviasi   = $isPasca ? qi_news_analisa_deviasi($event) : null;
$fund      = $isPasca
    ? ['arah' => $deviasi['arah_mata_uang'], 'teks' => $deviasi['teks'], 'catatan' => 'Momentum pasca-rilis terkonfirmasi data aktual (' . $deviasi['kekuatan'] . ').']
    : qi_news_arah_fundamental($event);

$simbolTer = qi_news_simbol_terdampak((string)($event['currency'] ?? ($event['country'] ?? '')), (string)($event['title'] ?? ''));

if (!$simbolTer) {
    if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);
    news_jawab(200, ['status' => 'ok', 'dijalankan' => true, 'dibuat' => 0, 'sebab' => 'mata_uang_tidak_dicakup',
        'event' => $snapshot,
        'batal_dini' => $batalDini,
        'catatan' => 'Mata uang event ini belum kami petakan ke simbol yang benar-benar terdampak, jadi sinyal TIDAK dibuat.']);
}

// ── 4) Engine analisa (dipakai ulang; menolak data simulasi) ─────────────────
define('QI_AI_SIGNAL_LIB', 1);
require_once __DIR__ . '/ai-signal.php';

// ── 5) Verdict AI dengan konteks fundamental lengkap ─────────────────────────
require_once __DIR__ . '/_ai_verdict.php';

function news_verdict_ai(array $event, array $fund, array $tfs, string $simbol, string $overall, int $bull, int $bear, bool $isPasca = false, ?array $deviasi = null): ?array
{
    if (!function_exists('qi_ai_verdict')) return null;

    $baris = [];
    foreach ($tfs as $label => $d) {
        if (!$d) { $baris[] = "$label: NO_DATA"; continue; }
        $baris[] = sprintf('%s: %s | RSI %.1f | EMA %s | MACD %s | harga %s',
            $label, $d['signal'], $d['rsi'], $d['ema_cross'] ?? '-', $d['macd_hist'], $d['price']);
    }

    $konteks = $isPasca
        ? "Rilis ini BARU SAJA terjadi sekitar {$event['menit_lalu']} menit lalu.\n"
            . "- judul: {$event['title']}\n"
            . "- mata uang: " . ($event['currency'] ?? $event['country'] ?? '-') . "\n"
            . "- dampak: {$event['impact']}\n"
            . "- perkiraan: " . ($event['forecast'] ?? '-') . " · sebelumnya: " . ($event['previous'] ?? '-') . " · aktual: " . ($event['actual'] ?? '-') . "\n"
            . "- deviasi / surprise: " . ($deviasi['teks'] ?? '-') . "\n"
            . "- pembacaan fundamental: {$fund['teks']}\n"
            . "- catatan fundamental: {$fund['catatan']}\n"
            . "- strategi: momentum pasca-rilis. Prioritaskan keselarasan deviasi aktual dan candle konfirmasi.\n"
            . "- konsensus teknikal: {$overall} (bull {$bull} / bear {$bear})"
        : "Rilis ini akan terjadi sekitar {$event['menit_lagi']} menit lagi.\n"
            . "- judul: {$event['title']}\n"
            . "- mata uang: " . ($event['currency'] ?? $event['country'] ?? '-') . "\n"
            . "- dampak: {$event['impact']}\n"
            . "- perkiraan: " . ($event['forecast'] ?? '-') . " · sebelumnya: " . ($event['previous'] ?? '-') . " · aktual: BELUM rilis\n"
            . "- pembacaan fundamental: {$fund['teks']}\n"
            . "- catatan fundamental: {$fund['catatan']}\n"
            . "- khusus berita: trading saat rilis berisiko spread melebar, slippage, dan whipsaw — pakai SKIP bila bukti tidak cukup.\n"
            . "- konsensus teknikal: {$overall} (bull {$bull} / bear {$bear})";

    $judulPrompt = ($isPasca ? 'MOMENTUM PASCA RILIS DATA — ' : 'RILIS DATA EKONOMI HIGH IMPACT — ') . $simbol;
    return qi_ai_verdict($judulPrompt, $konteks, implode("\n", $baris));
}

// ── 6) Susun & catat sinyal per simbol terdampak ─────────────────────────────
$rincian = [];
$dibuat  = 0;

foreach ($simbolTer as $simbol) {
    if (qi_news_sudah_ada($history, (string)$snapshot['id'], $simbol)) {
        $rincian[] = ['simbol' => $simbol, 'hasil' => 'sudah_ada_untuk_event_ini'];
        continue;
    }

    $tfs = [];
    foreach (['15' => 'M15', '60' => 'H1', '240' => 'H4', 'D' => 'D1'] as $iv => $label) {
        $tfs[$label] = function_exists('ai_analyze') ? ai_analyze($simbol, (string)$iv) : null;
    }
    $adaData = array_filter($tfs);
    if (!$adaData) { $rincian[] = ['simbol' => $simbol, 'hasil' => 'tanpa_data_nyata']; continue; }

    $bull = 0; $bear = 0;
    foreach ($tfs as $d) {
        if (!$d) continue;
        if ($d['signal'] === 'BULLISH') $bull++;
        if ($d['signal'] === 'BEARISH') $bear++;
    }
    $overall = $bull >= 3 ? 'BULLISH' : ($bear >= 3 ? 'BEARISH' : 'NEUTRAL');

    $verdict = news_verdict_ai($event, $fund, $tfs, $simbol, $overall, $bull, $bear, $isPasca, $deviasi);
    $arah = null; $asalArah = '';
    if ($verdict && in_array($verdict['action'], ['BUY', 'SELL'], true)) {
        $arah = $verdict['action'];
        $asalArah = 'AI (keyakinan ' . $verdict['confidence'] . ')';
    } elseif ($bull >= 3) {
        $arah = 'BUY'; $asalArah = 'konsensus teknikal ' . $bull . '/4 timeframe';
    } elseif ($bear >= 3) {
        $arah = 'SELL'; $asalArah = 'konsensus teknikal ' . $bear . '/4 timeframe';
    }
    if ($arah === null) {
        $rincian[] = ['simbol' => $simbol, 'hasil' => 'tidak_ada_arah_jelas',
            'bull' => $bull, 'bear' => $bear,
            'ai' => $verdict ? $verdict['action'] : 'tidak_dipanggil'];
        continue;
    }

    // Candle H1 nyata (tolak simulasi) → harga & ATR.
    $muat = function_exists('ai_load_candles') ? ai_load_candles($simbol, '60') : [];
    if (empty($muat['candles']) || !empty($muat['simulated'])) {
        $rincian[] = ['simbol' => $simbol, 'hasil' => 'data_simulasi_ditolak'];
        continue;
    }
    $atr = qi_news_atr($muat['candles'], 14);
    $harga = (float)($muat['candles'][count($muat['candles']) - 1]['close'] ?? 0);
    // Bila pasca-rilis, SL bisa lebih proporsional (1.5x ATR) karena spike pertama sudah lewat
    $multSl = $isPasca ? 1.5 : 2.0;
    $level = qi_news_rencana_level($harga, $atr, $arah, $multSl, 1.5);
    if (!$level['sah']) {
        $rincian[] = ['simbol' => $simbol, 'hasil' => 'level_tidak_sah', 'alasan' => $level['alasan'], 'atr' => $atr];
        continue;
    }

    $rek = [
        'id'               => 'SIG-NEWS-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
        'timestamp'        => qi_sig_waktu_utc(),
        'expiry'           => qi_sig_waktu_utc(time() + 4 * 3600),
        'symbol'           => $simbol,
        'engine'           => 'NEWS',
        'engine_name'      => $isPasca ? 'News Momentum (Post-Release)' : 'News Setup (High Impact)',
        'timeframe'        => 'MTF',
        'side'             => $arah,
        'entry'            => $level['entry'],
        'sl'               => $level['sl'],
        'tp'               => $level['tp'],
        'rr'               => '1 : ' . number_format($level['rr'], 2),
        'atr'              => round($atr, 5),
        'invalidation'     => $isPasca
            ? 'Level SL tersentuh atau candle penutupan menembus SL'
            : 'Level TP/SL tersentuh, atau reaksi pasar berlawanan setelah rilis',
        'status'           => 'AKTIF',
        'pnl'              => 0,
        'pnl_usd'          => 0,
        'mtf_aligned'      => ($overall !== 'NEUTRAL'),
        'confluence_score' => $verdict ? $verdict['confidence'] : (int)round(min(100, max($bull, $bear) * 20 + 10)),
        'confidence'       => $verdict ? $verdict['confidence'] : (int)round(min(100, max($bull, $bear) * 20 + 10)),
        'sumber'           => $isPasca ? 'post_news_momentum' : 'news_watcher',
        'news_event_id'    => (string)$snapshot['id'],
        'news'             => $snapshot,
        'fundamental'      => ['arah_data' => $fund['arah'], 'teks' => $fund['teks'], 'catatan' => $fund['catatan']],
        'basis'            => 'Arah dari ' . $asalArah . '; level dari ATR14 (SL ' . $multSl . '×ATR, TP 1,5×SL). '
            . 'Event: ' . $snapshot['judul'] . ' (' . $snapshot['mata_uang'] . ', dampak ' . $snapshot['dampak'] . ').',
        'risiko'           => $verdict['risiko'] ?? 'Spread berfluktuasi saat rilis berita — batasi ukuran posisi.',
        'peringatan'       => $isPasca
            ? 'Sinyal MOMENTUM PASCA-RILIS memanfaatkan konfirmasi deviasi angka aktual. Tetap gunakan risk management ketat.'
            : 'PERINGATAN: sinyal ini dibuat MENJELANG rilis data. Risiko lebih tinggi daripada setup teknikal biasa '
                . '(spread melebar, slippage, whipsaw). Statistiknya dihitung terpisah sebagai engine NEWS.',
    ];
    $catat = qi_signal_catat($rek, 0, 0);
    if ($catat['dicatat']) {
        $dibuat++;
        $history[] = $rek;
        $rincian[] = ['simbol' => $simbol, 'hasil' => 'sinyal_dibuat', 'id' => $rek['id'], 'arah' => $arah,
            'entry' => $rek['entry'], 'tp' => $rek['tp'], 'sl' => $rek['sl'], 'rr' => $rek['rr'],
            'asal_arah' => $asalArah, 'mode' => $snapshot['mode']];
    } else {
        $rincian[] = ['simbol' => $simbol, 'hasil' => 'ditolak_pagar', 'alasan' => $catat['alasan']];
    }
}

if ($auto) @file_put_contents($penandaAuto, (string)time(), LOCK_EX);

$ringkas = [
    'status'      => 'ok',
    'dijalankan'  => true,
    'dibuat'      => $dibuat,
    'event'       => $snapshot,
    'fundamental' => ['arah' => $fund['arah'], 'teks' => $fund['teks'], 'catatan' => $fund['catatan']],
    'simbol_terdampak' => $simbolTer,
    'rincian'     => $rincian,
    'catatan'     => $dibuat > 0
        ? 'Sinyal berita dicatat sebagai engine NEWS dan dinilai otomatis saat TP/SL tersentuh. Perhatikan peringatan risikonya.'
        : 'Tidak ada sinyal berita yang dibuat pada pemeriksaan ini (lihat rincian alasannya).',
];
echo $isCli ? json_encode($ringkas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL : json_encode($ringkas, JSON_UNESCAPED_UNICODE);
