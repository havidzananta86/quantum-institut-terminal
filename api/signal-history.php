<?php
/**
 * Quantum Institut Market Terminal - Signal History & Track Record API
 * Persists signal audit trails, track records, win rates, and expectancy metrics.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
// Statistik satuan R (win rate + interval keyakinan Wilson, expectancy, profit factor).
// Teruji di tests/signal-stats.test.php — dipakai agar kualitas sistem terukur jujur,
// karena membandingkan P&L dolar antar simbol (BTC vs SOL) menyesatkan.
require_once __DIR__ . '/_signal_stats.php';
require_once __DIR__ . '/_signal_time.php';   // waktu sinyal: tulis UTC, baca rekor lama dengan benar
qi_rate_limit(60, 60);

$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$historyFile = $cacheDir . '/signal_history.json';

// Riwayat sinyal TIDAK lagi diisi data contoh.
// Sebelumnya blok ini menanam 4 sinyal palsu yang semuanya berstatus "HIT TP"
// (harga emas 2.648 dan P/L contoh USD 975 / USD 1.400), sehingga halaman track
// record menampilkan rekor menang sempurna yang tidak pernah terjadi. Riwayat kini
// hanya berisi sinyal yang benar-benar diverifikasi lewat POST admin.

// GET method: Return signal history and aggregated performance metrics
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Penilaian sinyal yang sudah selesai, dijalankan oportunistik di sini agar rekor
    // tidak menggantung selamanya bila cron belum dijadwalkan. Hemat dan aman:
    //  - hanya memakai candle yang SUDAH ada di cache (tanpa panggilan ke luar),
    //  - paling sering sekali per 5 menit,
    //  - dibungkus try/catch supaya kegagalan apa pun tidak merusak respons ini.
    try {
        $tandaEval = __DIR__ . '/../cache/signal_eval_last.txt';
        $terakhirEval = is_file($tandaEval) ? (int)@file_get_contents($tandaEval) : 0;
        if (time() - $terakhirEval > 300) {
            @file_put_contents($tandaEval, (string)time(), LOCK_EX);
            if (!defined('QI_SIGNAL_EVAL_LIB')) define('QI_SIGNAL_EVAL_LIB', true);
            require_once __DIR__ . '/signal-evaluator.php';
            if (function_exists('qi_signal_evaluator_run')) {
                @qi_signal_evaluator_run(false, false, 20);
            }
        }
    } catch (Throwable $e) {
        // sengaja diabaikan: rekor sinyal tetap boleh tampil walau penilaian gagal
    }

    $raw = @file_get_contents($historyFile);
    $history = json_decode($raw, true) ?: [];

    // Filter by symbol or engine if specified
    $symbolFilter = isset($_GET['symbol']) ? strtoupper(qi_sanitize_string($_GET['symbol'], 10)) : null;
    $engineFilter = isset($_GET['engine']) ? strtoupper(qi_sanitize_string($_GET['engine'], 20)) : null;

    $filtered = array_filter($history, function($s) use ($symbolFilter, $engineFilter) {
        if ($symbolFilter && $s['symbol'] !== $symbolFilter) return false;
        if ($engineFilter && $s['engine'] !== $engineFilter) return false;
        return true;
    });
    $filtered = array_values($filtered);

    // Calculate performance metrics
    $totalSignals = count($filtered);
    $wins = 0;
    $losses = 0;
    $totalProfit = 0;
    $totalLoss = 0;
    $netPnL = 0;

    foreach ($filtered as $s) {
        if (strpos($s['status'], 'HIT TP') !== false) {
            $wins++;
            $totalProfit += (float)$s['pnl_usd'];
        } else if (strpos($s['status'], 'HIT SL') !== false) {
            $losses++;
            $totalLoss += abs((float)$s['pnl_usd']);
        }
        $netPnL += (float)$s['pnl_usd'];
    }

    // Metrik yang tidak bisa dihitung TIDAK diisi angka karangan. Sebelumnya di sini
    // ada nilai contoh (profit factor 3.15, expectancy 185.50, R:R 1:2.50) sehingga
    // halaman terlihat sehat walau belum ada satu pun trade yang selesai.
    $completed = $wins + $losses;
    $winRate = $completed > 0 ? round(($wins / $completed) * 100, 1) : null;
    $profitFactor = $totalLoss > 0 ? round($totalProfit / $totalLoss, 4) : null;
    $expectancy = $completed > 0 ? round($netPnL / $completed, 4) : null;

    // Calculate avg R:R from signal data
    $rrSum = 0;
    $rrCount = 0;
    foreach ($filtered as $s) {
        if (!empty($s['rr'])) {
            $parts = explode(':', str_replace(' ', '', $s['rr']));
            if (count($parts) === 2 && is_numeric(trim($parts[1]))) {
                $rrSum += (float)trim($parts[1]);
                $rrCount++;
            }
        }
    }
    $avgRR = $rrCount > 0 ? '1 : ' . number_format($rrSum / $rrCount, 2) : null;

    // ── SINKRONISASI KALENDER → fundamental_events (Bagian 4 & 12) ───────────
    // Oportunistik seperti penilai sinyal: paling sering sekali per 30 menit, hanya
    // membaca cache kalender yang sudah ada (tanpa permintaan ke luar), dan dibungkus
    // try/catch supaya kegagalan apa pun tidak merusak respons ini.
    $fundamental = null;
    try {
        $tandaFun = __DIR__ . '/../cache/fundamental_sync.txt';
        if (time() - (is_file($tandaFun) ? (int)@file_get_contents($tandaFun) : 0) > 1800) {
            @file_put_contents($tandaFun, (string)time(), LOCK_EX);
            require_once __DIR__ . '/_fundamental.php';
            if (function_exists('qi_fun_sinkron')) {
                $hasilFun = qi_fun_sinkron();
                $fundamental = ['dibaca' => $hasilFun['dibaca'], 'ditulis' => $hasilFun['ditulis'], 'catatan' => $hasilFun['catatan']];
            }
        }
    } catch (Throwable $e) {
        @error_log('[fundamental] hook sinkron dilewati: ' . $e->getMessage());
    }

    // ── DRAWDOWN ─────────────────────────────────────────────────────────────
    // Cara lama salah: pembaginya "puncak laba" dan ada pengocokan `if ($peak > 0)`,
    // sehingga kerugian di AWAL tidak terhitung (Max DD selalu 0%) dan satuannya dolar
    // per 1 lot yang tidak sebanding antar simbol. Kini memakai fungsi teruji
    // qi_signal_drawdown() yang menghitung kurva R sejak transaksi pertama.
    $ddSeluruh = function_exists('qi_signal_drawdown') ? qi_signal_drawdown($history) : null;
    $ddTersaring = function_exists('qi_signal_drawdown') ? qi_signal_drawdown($filtered) : null;   // kompatibilitas lama

    echo json_encode([
        'status' => 'success',
        // Jam server. server_time (date(), tanpa zona) dipertahankan untuk klien lama;
        // klien sebaiknya memakai server_epoch + timestamp_epoch/expiry_epoch/closed_at_epoch
        // per rekor — rekor baru ditulis UTC, rekor lama bisa ditulis dalam zona lain.
        'server_time' => date('Y-m-d H:i:s'),
        'server_epoch' => time(),
        'metrics' => [
            'total_signals' => $totalSignals,
            'completed_trades' => $completed,
            'wins' => $wins,
            'losses' => $losses,
            'win_rate' => $winRate,
            'profit_factor' => $profitFactor,
            'expectancy' => $expectancy,
            'net_pnl_usd' => round($netPnL, 4),
            'avg_rr' => $avgRR,
            // Dipertahankan untuk kompatibilitas; nilainya kini dari kurva R (bukan pnl/puncak laba)
            // dan bisa null bila persentase memang belum sah (mis. rugi sejak awal) — bukan 0%.
            'max_drawdown_pct' => $ddTersaring['pct'] ?? null,
            'max_drawdown_r'   => $ddTersaring['r'] ?? null,
        ],
        // DRAWDOWN seluruh rekor (bukan hasil saringan) — ukuran mutu sistem yang sesungguhnya.
        'drawdown' => $ddSeluruh ? array_merge($ddSeluruh, ['cakupan' => 'seluruh rekor (' . count($history) . ' catatan)']) : null,
        // Statistik satuan R dihitung dari SELURUH rekor (bukan hasil saringan simbol/engine),
        // supaya menggambarkan kualitas sistem secara keseluruhan. Cakupannya disebut apa adanya.
        'statistik_r' => array_merge(
            function_exists('qi_signal_statistik') ? qi_signal_statistik($history) : [],
            ['cakupan' => 'seluruh rekor (' . count($history) . ' catatan)']
        ),
        // Status filter berita (dipakai panel untuk memberi tahu bila sinyal sedang ditahan).
        // $bolehSegarkan = true agar cache kalender tidak basi saat pengguna melihat status
        // ini (dibatasi 5 menit sekali di dalam fungsinya, jadi tidak membebani halaman).
        'blackout_berita' => function_exists('qi_berita_blackout') ? qi_berita_blackout(30, true) : null,
        // Statistik DIPISAH PER MESIN — inilah yang menjawab "berapa win rate sinyal AI?"
        // secara jujur: setiap mesin dihitung sendiri, dan mesin yang belum punya sinyal
        // tertutup mengembalikan win_rate null (bukan 0%) dengan penjelasan.
        'statistik_per_engine' => function_exists('qi_signal_statistik_per_engine')
            ? qi_signal_statistik_per_engine($history) : [],
        // Statistik dipisah per GRADE A/B/C — kekuatan konfluensi saat sinyal dibuat.
        // Tujuannya menjawab: "apakah grade A benar-benar lebih baik dari B/C?" dengan
        // data nyata, bukan asumsi. Baris A/B/C selalu ada; yang belum tertutup → null.
        'statistik_per_grade' => function_exists('qi_signal_statistik_per_grade')
            ? qi_signal_statistik_per_grade($history) : [],
        // Pemisahan per sesi / hari / simbol / versi aturan & penilaian (seluruh rekor).
        // Kelompok kecil tetap tampil dengan cukup_sampel = false — bukan untuk disimpulkan.
        'statistik_dimensi' => function_exists('qi_signal_statistik_dimensi')
            ? qi_signal_statistik_dimensi($history) : null,
        // Seberapa dalam drawdown BISA terjadi bila urutan transaksi yang sama diacak ulang.
        'monte_carlo' => function_exists('qi_signal_monte_carlo') ? qi_signal_monte_carlo($history) : null,
        // Kalibrasi ambang keyakinan: expectancy per tingkat keyakinan + verdict jujur
        // tentang kecukupan sampel (tidak menyarankan ambang bila sampel masih kecil).
        'kalibrasi' => function_exists('qi_signal_kalibrasi') ? qi_signal_kalibrasi($history) : null,
        // ── BELAJAR DARI SL (Tahap 2) ────────────────────────────────────────────
        // Ringkasan sebab SL + perbandingan lebar SL antara transaksi menang dan kalah.
        // Semua dihitung dari data nyata oleh api/_sl_learn.php (43 uji). Bila tabel
        // analisa belum dimigrasi, 'tersedia' = false dan panel menampilkan keterangan
        // jujur — bukan angka kosong yang terlihat seperti nol.
        'fundamental' => $fundamental,
        'fundamental_ringkas' => (function () { try { require_once __DIR__ . '/_fundamental.php'; return function_exists('qi_fun_ringkas') ? qi_fun_ringkas() : null; } catch (Throwable $e) { return null; } })(),
        'fundamental_terdekat' => (function () { try { require_once __DIR__ . '/_fundamental.php'; return function_exists('qi_fun_terdekat') ? qi_fun_terdekat(24) : null; } catch (Throwable $e) { return null; } })(),
        'sl_analisa' => (function () use ($history) {
            try {
                require_once __DIR__ . '/_sl_learn.php';
                if (!function_exists('qi_sl_ringkas')) return ['tersedia' => false, 'catatan' => 'modul analisa SL tidak tersedia'];
                $ringkas = qi_sl_ringkas($history);
                $usul = qi_sl_usulan($ringkas);
                return [
                    'tersedia'  => true,
                    'jumlah_sl' => (int)$ringkas['jumlah_sl'],
                    'per_sebab' => $ringkas['per_sebab'],
                    'per_sesi'  => $ringkas['per_sesi'],
                    'per_simbol' => $ringkas['per_simbol'],
                    'rata_jarak_atr_menang' => $ringkas['rata_jarak_atr_menang'],
                    'rata_jarak_atr_kalah'  => $ringkas['rata_jarak_atr_kalah'],
                    'selisih_jarak_atr'     => $ringkas['selisih_jarak_atr'],
                    'usul'      => $usul,
                    'rincian'   => array_slice($ringkas['rincian'], 0, 20),
                    'catatan_ukur' => 'Kedalaman wick (sapuan likuiditas) belum terukur karena penilai menetapkan harga keluar tepat di SL. Sebab "sapuan_likuiditas" karena itu belum pernah muncul — bukan berarti tidak terjadi.',
                ];
            } catch (Throwable $e) {
                @error_log('[signal-history] analisa SL dilewati: ' . $e->getMessage());
                return ['tersedia' => false, 'catatan' => 'analisa SL gagal dihitung'];
            }
        })(),
        // Riwayat sinyal + NILAI R per rekor, supaya tabel dapat menampilkan hasil tiap
        // sinyal (bukan hanya rencananya). 'r_sumber' menyebut asalnya secara jujur:
        // exit_price = dari harga keluar nyata · rr_rencana = dari rencana (kalah dibatasi 1R)
        // · belum_selesai / tidak_ada_data = belum bisa dihitung.
        //
        // Ditambahkan juga chart_image_url dari JURNAL (Tahap 1D): bila pengguna pernah
        // mengunggah snapshot untuk sinyal itu, tautannya ikut dikirim agar panel bisa
        // menampilkan thumbnail. Bila jurnal tidak tersedia, nilainya null dan panel
        // menampilkan "belum ada snapshot" — tidak ada yang dikarang.
        'history' => (function () use ($filtered) {
            $tautan = [];
            try {
                require_once __DIR__ . '/_journal.php';
                if (qi_journal_tersedia(true, false) && $filtered) {
                    $id = [];
                    foreach ($filtered as $r) { if (isset($r['id'])) $id[] = (string)$r['id']; }
                    if ($id) {
                        $tanda = implode(',', array_fill(0, count($id), '?'));
                        $st = getDBConnection()->prepare(
                            'SELECT `id`, `chart_image_url` FROM `ai_signal_journal` WHERE `id` IN (' . $tanda . ') AND `chart_image_url` IS NOT NULL'
                        );
                        $st->execute($id);
                        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $baris) {
                            $tautan[(string)$baris['id']] = (string)$baris['chart_image_url'];
                        }
                    }
                }
            } catch (Throwable $e) {
                @error_log('[signal-history] tautan gambar dilewati: ' . $e->getMessage());
            }
            return array_map(function ($s) use ($tautan) {
                $hasil = function_exists('qi_signal_r_satu') ? qi_signal_r_satu($s) : ['r' => null, 'sumber' => 'tidak_ada_data'];
                $s['r'] = $hasil['r'];
                $s['r_sumber'] = $hasil['sumber'];
                $s['chart_image_url'] = $tautan[(string)($s['id'] ?? '')] ?? null;
                // Epoch UTC tanpa ambigu (api/_signal_time.php) untuk tampilan di klien.
                $s['timestamp_epoch'] = qi_sig_epoch($s['timestamp'] ?? null, 'timestamp');
                $s['expiry_epoch']    = qi_sig_epoch($s['expiry'] ?? null, 'expiry');
                $s['closed_at_epoch'] = qi_sig_epoch($s['closed_at'] ?? null, 'closed_at');
                if (empty($s['grade']) && function_exists('qi_signal_grade')) $s['grade'] = qi_signal_grade($s);
                return $s;
            }, $filtered);
        })()
    ], JSON_PRETTY_PRINT);
    exit();
}

// POST method: Append to the public track record. Only an administrator may
// publish a result; client-side users must never be able to manufacture it.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    qi_require_admin();

    $input = qi_get_json_body();
    if (!$input || empty($input['symbol']) || empty($input['engine'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Parameter sinyal tidak lengkap atau format tidak valid.']);
        exit();
    }

    // 2. Strict Whitelist Sanitization (mencegah Stored XSS)
    $cleanRecord = [
        'id'               => 'SIG-' . date('Ymd') . '-' . substr(bin2hex(random_bytes(4)), 0, 6),
        'timestamp'        => qi_sig_waktu_utc(),   // ISO 8601 UTC (api/_signal_time.php)
        'expiry'           => qi_sig_waktu_utc(qi_sig_epoch(qi_sanitize_string((string)($input['expiry'] ?? ''), 30), 'expiry') ?? (time() + 14400)),
        'symbol'           => strtoupper(qi_sanitize_string($input['symbol'], 10)),
        'engine'           => strtoupper(qi_sanitize_string($input['engine'], 20)),
        'engine_name'      => qi_sanitize_string($input['engine_name'] ?? ('Quantum ' . $input['engine']), 50),
        'timeframe'        => qi_sanitize_string($input['timeframe'] ?? 'H1', 10),
        'side'             => in_array(strtoupper($input['side'] ?? ''), ['BUY', 'SELL']) ? strtoupper($input['side']) : 'BUY',
        'entry'            => (float)($input['entry'] ?? 0),
        'sl'               => (float)($input['sl'] ?? 0),
        'tp'               => (float)($input['tp'] ?? 0),
        'rr'               => qi_sanitize_string($input['rr'] ?? '1 : 2.5', 20),
        'atr'              => (float)($input['atr'] ?? 0),
        'invalidation'     => qi_sanitize_string($input['invalidation'] ?? 'Breakout level kunci', 150),
        'status'           => in_array($input['status'] ?? '', ['AKTIF', 'HIT TP 🎯', 'HIT SL 🛑', 'EXPIRED']) ? $input['status'] : 'AKTIF',
        'pnl'              => (float)($input['pnl'] ?? 0),
        'pnl_usd'          => (float)($input['pnl_usd'] ?? 0),
        'mtf_aligned'      => !empty($input['mtf_aligned']),
        // Tanpa angka bawaan: dulu skor kosong menjadi 85 dan sampel menjadi 100 — angka
        // karangan yang tampil di dashboard DAN memberi poin grade tertinggi
        // (qi_signal_grade: skor ≥ 85 → 3 poin). Tidak dikirim = tidak diketahui = null.
        'confluence_score' => is_numeric($input['confluence_score'] ?? null) ? max(0, min(100, (int)$input['confluence_score'])) : null,
        'sample_size'      => is_numeric($input['sample_size'] ?? null) ? max(0, (int)$input['sample_size']) : null,
    ];
    // R:R dihitung dari level bila pengirim tidak menyebutkannya (bukan teks bawaan "1 : 2.5").
    if (!isset($input['rr']) || trim((string)$input['rr']) === '') {
        $risikoPost = abs($cleanRecord['entry'] - $cleanRecord['sl']);
        $cleanRecord['rr'] = ($risikoPost > 0 && $cleanRecord['tp'] > 0)
            ? '1 : ' . number_format(abs($cleanRecord['tp'] - $cleanRecord['entry']) / $risikoPost, 2, '.', '')
            : '';
    }

    // Baca → tambah → tulis di bawah kunci yang sama dengan pencatat sinyal & evaluator
    // (api/_json_kunci.php). Dulu tanpa kunci: POST yang bersamaan dengan evaluator
    // bisa saling menghapus rekor.
    require_once __DIR__ . '/_json_kunci.php';
    $tulis = qi_json_ubah($historyFile, function (array $history) use ($cleanRecord): array {
        array_unshift($history, $cleanRecord);
        // Batasi riwayat maksimum 500 catatan untuk mencegah pembengkakan memori
        return count($history) > 500 ? array_slice($history, 0, 500) : $history;
    }, ['tunggu' => 10.0, 'cadangan' => __DIR__ . '/../cache/signal_history.backup.json']);
    if (!$tulis['ok']) {
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => $tulis['alasan'] === 'sedang_menulis'
            ? 'Riwayat sinyal sedang ditulis proses lain. Coba lagi beberapa detik lagi.'
            : 'Gagal menulis riwayat sinyal (periksa izin folder cache/).']);
        exit();
    }

    // ── SINYAL → ANTREAN EKSEKUSI OTOMATIS ──────────────────────────────────
    // Hanya sinyal yang benar-benar BARU & AKTIF yang boleh dieksekusi:
    //  - status harus 'AKTIF' (sinyal historis HIT TP/HIT SL/EXPIRED tidak pernah
    //    dieksekusi — kalau tidak, mencatat riwayat lama akan memicu order nyata),
    //  - bisa dimatikan per kiriman dengan auto_execute=false (sinyal informasi saja),
    //  - masa berlaku perintah dibatasi 15 menit (bawaan pustaka) supaya sinyal lama
    //    tidak dieksekusi pada harga yang sudah tidak relevan. Batas ini SENGAJA lebih
    //    pendek daripada expiry sinyal (4 jam) demi keselamatan dana pelanggan.
    $antreEksekusi = null;
    $mauEksekusi = array_key_exists('auto_execute', $input) ? !empty($input['auto_execute']) : true;
    if ($cleanRecord['status'] === 'AKTIF' && $mauEksekusi) {
        try {
            require_once __DIR__ . '/_execution.php';
            $antreEksekusi = qi_exec_antre_sinyal(qi_db(), [
                'id'     => $cleanRecord['id'],
                'symbol' => $cleanRecord['symbol'],
                'side'   => $cleanRecord['side'],
                'entry'  => $cleanRecord['entry'],
                'sl'     => $cleanRecord['sl'],
                'tp'     => $cleanRecord['tp'],
            ]);
        } catch (Throwable $e) {
            // Kegagalan antrean TIDAK boleh menggagalkan pencatatan sinyal.
            $antreEksekusi = ['error' => 'Antrean eksekusi dilewati (lihat log).'];
            if (function_exists('qi_log')) qi_log('error', 'Antre sinyal otomatis gagal', ['exception' => get_class($e)]);
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Sinyal berhasil diverifikasi dan disimpan ke riwayat terenkripsi.',
        'antre_eksekusi' => $antreEksekusi,
    ]);
    exit();
}
