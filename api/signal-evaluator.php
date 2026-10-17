<?php
/**
 * Penilai sinyal (signal evaluator) — menyelesaikan status sinyal AKTIF menjadi
 * HIT TP / HIT SL / EXPIRED berdasarkan pergerakan harga yang benar-benar terjadi.
 *
 * Sebelum ini, status sinyal HANYA bisa diisi manual lewat POST admin, sehingga
 * win rate / profit factor / expectancy di halaman rekor sinyal tidak akan pernah
 * terisi (di produksi: 7 sinyal semuanya berstatus AKTIF dengan P/L 0).
 *
 * ── ATURAN PENILAIAN (sengaja KONSERVATIF) ──────────────────────────────────
 *  1. Hanya sinyal berstatus "AKTIF" yang disentuh. Sinyal yang sudah selesai
 *     TIDAK PERNAH ditulis ulang — riwayat bersifat tetap.
 *  2. Sinyal dengan angka tidak masuk akal dilewati, tidak ditebak:
 *     BUY  wajib tp > entry > sl;  SELL wajib tp < entry < sl.
 *  3. Hanya candle dengan waktu LEBIH BESAR dari waktu terbit sinyal yang dinilai,
 *     dan tidak melewati expiry. Jadi pergerakan sebelum sinyal terbit tidak
 *     pernah dihitung sebagai keuntungan.
 *  4. Bila dalam SATU candle kedua level tersentuh, urutannya tidak bisa diketahui
 *     dari data OHLC — maka dianggap SL yang kena lebih dulu (kerugian). Ini
 *     pilihan yang tidak menyanjung diri sendiri.
 *  5. Bila candle terbuka langsung melewati level (gap), level itu dianggap kena
 *     di harga pembukaan.
 *  6. EXPIRED ditandai bila data candle MENCAKUP seluruh jendela waktu sinyal tanpa
 *     TP/SL tersentuh (expiry_basis = "candle"). Kalau datanya tidak cukup, sinyal
 *     dibiarkan AKTIF — tetapi paling lama 24 jam sesudah expiry; setelah itu ditutup
 *     EXPIRED dengan expiry_basis = "tanpa_data" (hasil tidak terverifikasi). Sinyal
 *     yang sudah lewat masa berlaku memang bukan AKTIF lagi, dan EXPIRED tidak pernah
 *     dihitung menang atau kalah (signal-history.php, _signal_stats.php).
 *  7. Candle SIMULASI tidak pernah dipakai (sumber data palsu = rekor palsu).
 *  8. P/L dihitung untuk posisi 1 lot memakai model kontrak yang sama dengan
 *     paper trading (api/_paper_math.php), dan dicatat di field pnl_basis supaya
 *     arti angkanya tidak ambigu. Basis 1 lot dipilih (bukan 0,01 lot) karena untuk
 *     kripto — 1 koin per lot — nilai 0,01 lot terlalu kecil: pembulatan 2 desimal
 *     membuat kerugian tercatat 0,00 dan itu merusak profit factor (gross loss = 0).
 *     Presisi P/L sinyal dijaga 4 desimal.
 *
 * CATATAN ZONA WAKTU: semua waktu sinyal BARU ditulis ISO 8601 UTC ("...Z") dan
 * semua pembacaan lewat qi_sig_epoch()/qi_sig_jendela() di api/_signal_time.php —
 * termasuk rekor LAMA yang ditulis date() tanpa zona. Waktu candle adalah epoch UTC.
 * Jangan memakai strtotime()/date() langsung pada field timestamp/expiry/closed_at.
 * Rekor lama tanpa zona itu AMBIGU (log Apache menunjukkan rekor ditulis dalam WIB,
 * UTC, dan Europe/Berlin), jadi rekor seperti itu dinilai di SETIAP zona kandidat:
 * hasil hanya dicatat bila semua zona sepakat; bila tidak, ditutup EXPIRED dengan
 * expiry_basis = "zona_ambigu" (tidak dihitung menang/kalah).
 *
 * ── CARA PAKAI ──────────────────────────────────────────────────────────────
 *   Cron/CLI:   php api/signal-evaluator.php [--dry] [--warm]
 *   HTTP:       GET api/signal-evaluator.php?key=CRON_SECRET_KEY[&dry=1][&warm=1]
 *   --dry  : laporkan saja, tidak menulis apa pun.
 *   --warm : panggil api/get-chart-data.php lebih dulu untuk mengisi cache candle
 *            pada simbol/timeframe yang dibutuhkan (dipakai dari cron).
 */

require_once __DIR__ . '/_paper_math.php';
require_once __DIR__ . '/_signal_time.php';

if (!function_exists('qi_sig_interval_kandidat')) :
/**
 * Kandidat interval candle untuk menilai sebuah sinyal, dari yang paling halus.
 * Sinyal di produksi memakai timeframe "MTF" (multi-timeframe) sehingga tidak bisa
 * dipetakan langsung; candle halus dipakai lebih dulu karena semakin halus semakin
 * akurat dalam mendeteksi level yang tersentuh.
 */
function qi_sig_interval_kandidat(string $timeframe): array {
    $peta = [
        'M1' => ['1'], 'M5' => ['5'], 'M15' => ['15'], 'M30' => ['30'],
        'H1' => ['60'], 'H4' => ['240'], 'D1' => ['D'], 'W1' => ['W'], 'MN1' => ['MN'],
        '1' => ['1'], '5' => ['5'], '15' => ['15'], '30' => ['30'], '60' => ['60'], '240' => ['240'], 'D' => ['D'],
    ];
    $tf = strtoupper(trim($timeframe));
    if (isset($peta[$tf])) return $peta[$tf];
    return ['5', '15', '60']; // MTF / tidak dikenal
}
endif;

if (!function_exists('qi_sig_durasi_interval')) :
/** Durasi satu candle (detik) untuk kode interval internal. */
function qi_sig_durasi_interval(string $interval): int {
    $peta = ['1' => 60, '5' => 300, '15' => 900, '30' => 1800, '60' => 3600, '240' => 14400, 'D' => 86400, 'W' => 604800, 'MN' => 2592000];
    return $peta[$interval] ?? 3600;
}
endif;

if (!function_exists('qi_sig_ambil_candle')) :
/**
 * Ambil candle dari cache chart (kunci sama dengan api/get-chart-data.php).
 * Mengembalikan ['interval' => ..., 'candles' => [...]] atau null bila tidak ada.
 * Cache yang berisi candle SIMULASI ditolak.
 */
function qi_sig_ambil_candle(string $symbol, array $intervals): ?array {
    $dir = __DIR__ . '/../cache/chart';
    foreach ($intervals as $iv) {
        $file = $dir . '/' . md5(strtoupper($symbol) . '_' . $iv) . '.json';
        if (!is_file($file)) continue;
        $data = json_decode((string)@file_get_contents($file), true);
        if (!is_array($data) || !empty($data['simulated'])) continue; // data palsu: jangan dipakai
        $candles = $data['candles'] ?? null;
        if (!is_array($candles) || count($candles) < 3) continue;
        return ['interval' => $iv, 'candles' => $candles];
    }
    return null;
}
endif;

if (!function_exists('qi_sig_nilai_satu')) :
/**
 * Tentukan hasil satu sinyal berdasarkan candle.
 * Mengembalikan array hasil, atau null bila belum bisa diputuskan (biarkan AKTIF).
 * @param int      $durasi durasi satu candle (detik) — untuk memeriksa cakupan data
 * @param int|null $kini   waktu sekarang (epoch); null = time()
 */
function qi_sig_nilai_satu(array $sig, array $candles, int $durasi = 0, ?int $kini = null, ?string $zonaLama = null): ?array {
    $side  = strtoupper((string)($sig['side'] ?? ''));
    $entry = (float)($sig['entry'] ?? 0);
    $tp    = (float)($sig['tp'] ?? 0);
    $sl    = (float)($sig['sl'] ?? 0);
    $jendela = qi_sig_jendela($sig, $zonaLama);   // epoch UTC; cadangan expiry = terbit + 4 jam

    if (!in_array($side, ['BUY', 'SELL'], true) || $entry <= 0 || $tp <= 0 || $sl <= 0 || $jendela === null) {
        return null;
    }
    // Validasi arah level: jangan menebak sinyal yang datanya tidak konsisten.
    if ($side === 'BUY'  && !($tp > $entry && $entry > $sl)) return null;
    if ($side === 'SELL' && !($tp < $entry && $entry < $sl)) return null;
    $t0   = $jendela['terbit'];
    $tExp = $jendela['kedaluwarsa'];

    $filtered = [];
    foreach ($candles as $c) {
        $t = (int)($c['time'] ?? 0);
        if ($t <= $t0 || $t > $tExp) continue;   // aturan 3: hanya setelah terbit, sampai expiry
        $filtered[] = ['time' => $t, 'open' => (float)$c['open'], 'high' => (float)$c['high'], 'low' => (float)$c['low'], 'close' => (float)$c['close']];
    }
    usort($filtered, fn($a, $b) => $a['time'] - $b['time']);

    foreach ($filtered as $c) {
        $tpKena = false; $slKena = false; $harga = 0.0;
        if ($side === 'BUY') {
            if ($c['open'] >= $tp) { $tpKena = true; $harga = $c['open']; }      // gap naik melewati TP
            elseif ($c['open'] <= $sl) { $slKena = true; $harga = $c['open']; }  // gap turun melewati SL
            else {
                if ($c['low'] <= $sl) { $slKena = true; $harga = $sl; }          // aturan 4: SL lebih dulu
                elseif ($c['high'] >= $tp) { $tpKena = true; $harga = $tp; }
            }
        } else {
            if ($c['open'] <= $tp) { $tpKena = true; $harga = $c['open']; }
            elseif ($c['open'] >= $sl) { $slKena = true; $harga = $c['open']; }
            else {
                if ($c['high'] >= $sl) { $slKena = true; $harga = $sl; }
                elseif ($c['low'] <= $tp) { $tpKena = true; $harga = $tp; }
            }
        }
        if ($tpKena || $slKena) {
            $menang = $tpKena;
            $keluar = $menang ? $tp : $sl;

            // ── UKUR KEDALAMAN WICK (Tahap 2 lanjutan) ───────────────────────────
            // MENGAPA: saat SL kena tanpa gap, harga keluar diset TEPAT di SL sehingga
            // kedalaman tembusnya hilang (terbukti: sweep_overshoot selalu 0 → deteksi
            // sapuan likuiditas tidak pernah bisa bekerja). Padahal candle pemicunya ada
            // di sini, lengkap dengan high/low/close. Jadi diukur dari candle NYATA:
            //   · wick_depth     = seberapa jauh harga melewati SL (harga)
            //   · wick_depth_atr = kedalaman itu dibagi ATR (satuan volatilitas)
            //   · closed_back    = apakah candle Ditutup kembali di sisi semula SL
            // Sapuan likuiditas yang JUJUR = menusuk cukup dalam (≥0,25×ATR) DAN ditutup
            // kembali; bila harga terus berlanjut, itu tren — bukan sapuan.
            $atrSig = (isset($sig['atr']) && is_numeric($sig['atr'])) ? (float)$sig['atr'] : 0.0;
            $luar = [];
            if (!$menang) {
                $ekstrem = ($side === 'BUY') ? (float)$c['low'] : (float)$c['high'];
                $kedalaman = ($side === 'BUY') ? max(0.0, $sl - $ekstrem) : max(0.0, $ekstrem - $sl);
                $luar = [
                    'wick_extreme'   => round($ekstrem, 6),
                    'wick_depth'     => round($kedalaman, 6),
                    'wick_depth_atr' => ($atrSig > 0) ? round($kedalaman / $atrSig, 4) : null,
                    'candle_high'    => round((float)$c['high'], 6),
                    'candle_low'     => round((float)$c['low'], 6),
                    'candle_close'   => round((float)$c['close'], 6),
                    'closed_back'    => ($side === 'BUY') ? ((float)$c['close'] > $sl) : ((float)$c['close'] < $sl),
                ];
            }

            return array_merge([
                'status'      => $menang ? 'HIT TP 🎯' : 'HIT SL 🛑',
                'hit_price'   => round($harga, 6),
                'exit_price'  => round($keluar, 6),
                'closed_at'   => qi_sig_waktu_utc($c['time']),
                'pnl'         => round(($side === 'BUY' ? $keluar - $entry : $entry - $keluar), 6),
                'pnl_usd'     => round(($side === 'BUY' ? $keluar - $entry : $entry - $keluar) * qi_paper_pip_mult((string)$sig['symbol']), 4),
            ], $luar);
        }
    }

    // Belum tersentuh. EXPIRED hanya bila data benar-benar mencakup seluruh jendela
    // waktu sinyal (aturan 6) — kalau tidak, lebih baik dibiarkan AKTIF:
    //  · awal : data sudah ada paling lambat satu candle sesudah sinyal terbit;
    //  · akhir: candle yang memuat expiry ada, ATAU data sudah berlanjut melewati expiry
    //           (pasar tutup / akhir pekan: memang tidak ada candle lagi di jendela itu).
    // Dulu syarat akhirnya "candle terakhir >= expiry − 1 detik". Expiry hampir tidak
    // pernah jatuh tepat di batas candle (23:40:43 vs candle 5 menit 23:40:00), jadi
    // sinyal yang sudah lewat masa berlaku tetap AKTIF selamanya.
    if (($kini ?? time()) <= $tExp) return null;
    $durasi = $durasi > 0 ? $durasi : 60;
    $awalData = PHP_INT_MAX; $akhirData = 0;
    foreach ($candles as $c) {
        $t = (int)($c['time'] ?? 0);
        if ($t <= 0) continue;
        if ($t < $awalData) $awalData = $t;
        if ($t > $akhirData) $akhirData = $t;
    }
    $awalTercakup  = ($awalData <= $t0 + $durasi);
    $akhirTercakup = ($akhirData > $tExp)
        || ($filtered && $filtered[count($filtered) - 1]['time'] >= $tExp - $durasi);
    if ($awalTercakup && $akhirTercakup) {
        return [
            'status'       => 'EXPIRED',
            'hit_price'    => null,
            'exit_price'   => null,
            'closed_at'    => qi_sig_waktu_utc($tExp),
            'pnl'          => 0.0,
            'pnl_usd'      => 0.0,
            'expiry_basis' => 'candle',
        ];
    }
    return null;
}
endif;

if (!function_exists('qi_sig_nilai_lintas_zona')) :
/**
 * qi_sig_nilai_satu() untuk setiap zona kandidat rekor (satu zona saja bila waktunya
 * sudah membawa zona). null bila salah satu zona belum bisa memutuskan. Bila zona-zona
 * tidak sepakat, hasilnya EXPIRED "zona_ambigu" — tidak pernah menebak menang/kalah.
 */
function qi_sig_nilai_lintas_zona(array $sig, array $candles, int $durasi = 0, ?int $kini = null): ?array {
    $perZona = [];
    foreach (qi_sig_zona_kandidat($sig) as $zona) {
        $h = qi_sig_nilai_satu($sig, $candles, $durasi, $kini, $zona);
        if ($h === null) return null;
        $perZona[$zona ?? 'zona_tertulis'] = $h;
    }
    $utama = reset($perZona);
    $status = array_unique(array_column($perZona, 'status'));
    if (count($status) === 1) return $utama;

    $jendela = qi_sig_jendela($sig);
    return [
        'status'       => 'EXPIRED',
        'hit_price'    => null,
        'exit_price'   => null,
        'closed_at'    => qi_sig_waktu_utc($jendela['kedaluwarsa']),
        'pnl'          => 0.0,
        'pnl_usd'      => 0.0,
        'expiry_basis' => 'zona_ambigu',
        'zona_hasil'   => array_map(fn($h) => $h['status'], $perZona),
    ];
}
endif;

if (!function_exists('qi_sig_kedaluwarsa_tanpa_data')) :
/**
 * Sinyal yang sudah lewat expiry + tenggang tetapi tidak bisa dinilai dari candle
 * (cache kosong/basi, level tidak konsisten) ditutup EXPIRED dengan
 * expiry_basis = "tanpa_data": bukan menang, bukan kalah, hasil tidak terverifikasi.
 * Mengembalikan null bila belum waktunya atau waktu terbit tidak terbaca.
 */
function qi_sig_kedaluwarsa_tanpa_data(array $sig, ?int $kini = null, int $tenggang = 86400): ?array {
    $jendela = qi_sig_jendela($sig);
    if ($jendela === null) return null;   // waktu terbit tak terbaca: jangan menebak
    if (($kini ?? time()) <= $jendela['kedaluwarsa'] + $tenggang) return null;
    return [
        'status'       => 'EXPIRED',
        'hit_price'    => null,
        'exit_price'   => null,
        'closed_at'    => qi_sig_waktu_utc($jendela['kedaluwarsa']),
        'pnl'          => 0.0,
        'pnl_usd'      => 0.0,
        'expiry_basis' => 'tanpa_data',
    ];
}
endif;

if (!function_exists('qi_sig_url_dasar')) :
/** URL dasar situs untuk mode --warm (memanggil endpoint chart sendiri). */
function qi_sig_url_dasar(): string {
    if (!empty($_SERVER['HTTP_HOST'])) {
        $skema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $skema . '://' . $_SERVER['HTTP_HOST'];
    }
    if (defined('QI_PUBLIC_BASE') && QI_PUBLIC_BASE !== '') return rtrim(QI_PUBLIC_BASE, '/');
    return 'https://quantum-institut.com';
}
endif;

if (!function_exists('qi_signal_evaluator_run')) :
/**
 * Jalankan penilaian.
 * @return array laporan: ['diperiksa','dinilai','dilewati','tanpa_data','detail'=>[],'dry_run'=>bool]
 */
function qi_signal_evaluator_run(bool $dry = false, bool $warm = false, int $maxNilai = 100): array {
    $historyFile = __DIR__ . '/../cache/signal_history.json';
    $laporan = ['diperiksa' => 0, 'dinilai' => 0, 'dilewati' => 0, 'tanpa_data' => 0, 'detail' => [], 'dry_run' => $dry];

    if (!is_file($historyFile)) { $laporan['catatan'] = 'riwayat sinyal belum ada'; return $laporan; }
    $history = json_decode((string)@file_get_contents($historyFile), true);
    if (!is_array($history)) { $laporan['catatan'] = 'riwayat sinyal tidak bisa dibaca'; return $laporan; }

    $aktif = [];
    foreach ($history as $i => $s) {
        if (($s['status'] ?? '') === 'AKTIF') $aktif[$i] = $s;
    }
    $laporan['diperiksa'] = count($aktif);
    if (!$aktif) return $laporan;

    // Mode warm: isi cache candle untuk simbol/timeframe yang dibutuhkan lebih dulu.
    if ($warm && function_exists('qi_http_get')) {
        $perlu = [];
        foreach ($aktif as $s) {
            foreach (qi_sig_interval_kandidat((string)($s['timeframe'] ?? 'MTF')) as $iv) {
                $perlu[strtoupper((string)$s['symbol']) . '|' . $iv] = true;
            }
        }
        $laporan['warm'] = [];
        $n = 0;
        foreach (array_keys($perlu) as $kunci) {
            if ($n >= 12) break; // batasi jumlah panggilan
            list($simbol, $iv) = explode('|', $kunci);
            $url = qi_sig_url_dasar() . '/api/get-chart-data.php?symbol=' . urlencode($simbol) . '&interval=' . urlencode($iv);
            $hasil = @qi_http_get($url, 12);
            $laporan['warm'][] = $simbol . '/' . $iv . '=' . ($hasil !== false ? 'ok' : 'gagal');
            $n++;
        }
    }

    $berubah = 0;
    foreach ($aktif as $i => $s) {
        if ($berubah >= $maxNilai) break;
        // Coba tiap interval kandidat (halus → kasar) sampai ada yang bisa memutuskan:
        // cache 5 menit bisa basi atau sudah tidak mencakup awal sinyal, sementara
        // cache 15/60 menit masih mencakup seluruh jendela.
        $hasil = null; $pakai = null; $adaData = false;
        foreach (qi_sig_interval_kandidat((string)($s['timeframe'] ?? 'MTF')) as $iv) {
            $data = qi_sig_ambil_candle((string)$s['symbol'], [$iv]);
            if ($data === null) continue;
            $adaData = true;
            $hasil = qi_sig_nilai_lintas_zona($s, $data['candles'], qi_sig_durasi_interval($data['interval']));
            if ($hasil !== null) { $pakai = $data; break; }
        }
        if ($hasil === null) {
            $hasil = qi_sig_kedaluwarsa_tanpa_data($s);
            if ($hasil !== null) $pakai = ['interval' => 'tanpa_data'];
        }
        if ($hasil === null) { $laporan[$adaData ? 'dilewati' : 'tanpa_data']++; continue; }

        $laporan['dinilai']++;
        $laporan['detail'][] = [
            'id'       => $s['id'] ?? ('#' . $i),
            'symbol'   => $s['symbol'] ?? '?',
            'side'     => $s['side'] ?? '?',
            'interval' => $pakai['interval'],
            'status'   => $hasil['status'],
            'pnl_usd'  => $hasil['pnl_usd'],
        ];
        if (!$dry) {
            $history[$i]['status']     = $hasil['status'];
            $history[$i]['pnl']        = $hasil['pnl'];
            $history[$i]['pnl_usd']    = $hasil['pnl_usd'];
            $history[$i]['pnl_basis']  = '1 lot';
            $history[$i]['exit_price'] = $hasil['exit_price'];
            $history[$i]['closed_at']  = $hasil['closed_at'];
            if (isset($hasil['expiry_basis'])) $history[$i]['expiry_basis'] = $hasil['expiry_basis'];
            if (isset($hasil['zona_hasil']))   $history[$i]['zona_hasil']   = $hasil['zona_hasil'];
            $history[$i]['evaluated_at']   = qi_sig_waktu_utc();
            $history[$i]['evaluated_from'] = $pakai['interval'] === 'tanpa_data' ? 'tanpa_data' : 'cache/' . $pakai['interval'];
        }
        $berubah++;
    }

    if (!$dry && $berubah > 0) {
        // Cadangan sebelum menulis: riwayat kinerja tidak boleh hilang tanpa jejak.
        @copy($historyFile, __DIR__ . '/../cache/signal_history.backup.json');
        $ok = @file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT), LOCK_EX);
        $laporan['tersimpan'] = ($ok !== false);
        if ($ok === false) $laporan['catatan'] = 'GAGAL menulis riwayat (periksa izin cache/)';

        // ── SINKRONISASI KE JURNAL DATABASE (dual-write — Tahap 1) ───────────────
        // Status/P&L/R yang baru dinilai ikut disimpan ke jurnal. Dibatasi ke rekor
        // TERBARU saja (50) supaya setiap penilaian tidak menulis ratusan baris;
        // rekor lama sudah tersinkron pada putaran sebelumnya. Kegagalan di sini
        // tidak pernah menggagalkan penilaian (dibungkus try/catch).
        if ($ok !== false) {
            try {
                if (!function_exists('qi_journal_simpan')) {
                    require_once __DIR__ . '/_journal.php';
                }
                if (function_exists('qi_journal_simpan')) {
                    $sinkron = 0;
                    foreach (array_slice($history, 0, 50) as $r) {
                        if (is_array($r) && qi_journal_simpan($r)) $sinkron++;
                    }
                    $laporan['jurnal_tersinkron'] = $sinkron;
                }
            } catch (Throwable $e) {
                @error_log('[jurnal] hook penilai gagal: ' . $e->getMessage());
            }
        }
    }

    // ── BELAJAR DARI SL (Tahap 2, spesifikasi Bagian 5) ──────────────────────────
    // DI LUAR penjaga "$berubah > 0" dengan sengaja: pada sistem yang sudah berjalan,
    // rekor lama jarang berubah, sehingga analisa SL tidak akan pernah jalan bila
    // diletakkan di dalam penjaga itu (terbukti: 0 baris tersimpan). Analisanya
    // idempoten (UNIQUE signal_id + ON DUPLICATE KEY UPDATE), jadi aman diulang, dan
    // dibatasi paling sering sekali per 10 menit agar tidak menulis berulang-ulang.
    // AI TIDAK mengubah metode: hasilnya berupa catatan + USULAN berstatus menunggu.
    if (!$dry) {
        try {
            $tandaSl = __DIR__ . '/../cache/sl_analisa_last.txt';
            $terakhirSl = is_file($tandaSl) ? (int)@file_get_contents($tandaSl) : 0;
            if (time() - $terakhirSl > 600) {
                @file_put_contents($tandaSl, (string)time(), LOCK_EX);
                require_once __DIR__ . '/_sl_learn.php';
                if (function_exists('qi_sl_analisa_semua')) {
                    $hasilSl = qi_sl_analisa_semua(array_slice($history, 0, 100));
                    $laporan['sl_dianalisa'] = (int)($hasilSl['jumlah_sl'] ?? 0);
                    $laporan['sl_tersimpan'] = (int)($hasilSl['tersimpan'] ?? 0);
                    if (!empty($hasilSl['usul']['usul'])) {
                        $laporan['sl_usulan'] = (string)$hasilSl['usul']['usul'];
                        $laporan['sl_usulan_status'] = (string)($hasilSl['usul']['status'] ?? '');
                    } else {
                        $laporan['sl_usulan_catatan'] = (string)($hasilSl['usul']['catatan'] ?? '');
                    }
                }
            }
        } catch (Throwable $e) {
            @error_log('[sl-learn] hook penilai gagal: ' . $e->getMessage());
        }
    }
    return $laporan;
}
endif;

// ── Titik masuk: hanya berjalan bila berkas ini dipanggil langsung, bukan di-include.
if (!defined('QI_SIGNAL_EVAL_LIB')) {
    $isCli = (PHP_SAPI === 'cli');
    $auto  = false;
    $dijalankan = true;
    $alasan = null;
    $lockFile   = __DIR__ . '/../cache/signal_eval.lock';
    $autoMarker = __DIR__ . '/../cache/signal_eval_auto.txt';

    if (!$isCli) {
        define('QI_DEV', false);
        require_once __DIR__ . '/_middleware.php';
        $cronKey = '';
        $keysFile = __DIR__ . '/../config/api_keys.php';
        if (file_exists($keysFile)) { include_once $keysFile; }
        if (defined('CRON_SECRET_KEY')) $cronKey = CRON_SECRET_KEY;
        $provided = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
        $viaCron = ($cronKey && $provided && hash_equals($cronKey, (string)$provided));

        // ── MODE PENYEMBUH SENDIRI (self-healing) ───────────────────────────────
        // Rekor sinyal hanya terbentuk bila penilai ini berjalan berkala. Bila cron
        // cPanel belum dipasang, rekor tidak akan pernah bertambah. Karena itu berkas
        // ini boleh dipicu oleh dashboard (?auto=1) dengan pengaman berlapis:
        //   1. WAJIB sudah login (token sah) — bukan terbuka untuk umum;
        //   2. DIJEDA minimal 5 menit sejak penilaian otomatis terakhir;
        //   3. KLAIM ATOMIK lewat berkas kunci, sehingga 10 permintaan bersamaan
        //      hanya menghasilkan SATU penilaian (tidak bisa dibanjiri);
        //   4. jumlah penilaian per panggilan dibatasi (ringan);
        //   5. kunci basi (proses mati) diambil alih setelah 10 menit.
        if (!$viaCron) {
            if (empty($_GET['auto'])) {
                http_response_code(403);
                echo json_encode(['status' => 'error', 'message' => 'Akses ditolak']);
                exit;
            }
            $auto = true;
            header('Content-Type: application/json; charset=utf-8');
            $userAuto = qi_validate_token();
            if (!$userAuto) {
                http_response_code(401);
                echo json_encode(['status' => 'error', 'message' => 'Perlu login untuk menjalankan penilai otomatis.', 'code' => 'AUTH_REQUIRED']);
                exit;
            }
            // 2. Jeda 5 menit → permintaan berikutnya murah (tidak menghitung apa pun).
            if (file_exists($autoMarker) && (time() - (int)@filemtime($autoMarker)) < 300) {
                echo json_encode([
                    'status' => 'ok', 'mode' => 'auto', 'dijalankan' => false, 'dilewati' => true,
                    'alasan' => 'dijeda 5 menit (terakhir ' . (time() - (int)@filemtime($autoMarker)) . ' detik lalu)',
                ]);
                exit;
            }
            // 3. Klaim atomik: hanya SATU proses yang berhasil membuat berkas kunci.
            $fp = @fopen($lockFile, 'x');
            if ($fp === false) {
                // Kunci sudah ada. Bila terlalu lama (proses mati), ambil alih dengan aman.
                if (file_exists($lockFile) && (time() - (int)@filemtime($lockFile)) > 600) {
                    @unlink($lockFile);
                    $fp = @fopen($lockFile, 'x');
                }
            }
            if ($fp === false) {
                echo json_encode([
                    'status' => 'ok', 'mode' => 'auto', 'dijalankan' => false, 'dilewati' => true,
                    'alasan' => 'penilaian lain sedang berjalan',
                ]);
                exit;
            }
            fclose($fp);
            register_shutdown_function(function () use ($lockFile) { @unlink($lockFile); });
        }

        header('Content-Type: application/json; charset=utf-8');
        $dry  = !empty($_GET['dry']);
        $warm = !empty($_GET['warm']);
    } else {
        require_once __DIR__ . '/_middleware.php';
        $argvv = $argv ?? [];
        $dry  = in_array('--dry', $argvv, true);
        $warm = in_array('--warm', $argvv, true);
    }

    // Mode otomatis dibuat RINGAN: paling banyak 25 penilaian, tanpa pemanasan cache.
    $laporan = qi_signal_evaluator_run($dry, $auto ? false : $warm, $auto ? 25 : 100);

    if ($auto) {
        // 2b. Catat waktu jalan otomatis (untuk jeda 5 menit berikutnya).
        @file_put_contents($autoMarker, (string)time(), LOCK_EX);
        // Balasan RINGKAS: antarmuka tidak perlu seluruh rincian tiap sinyal.
        $menang = 0; $kalah = 0; $kedaluwarsa = 0;
        foreach (($laporan['detail'] ?? []) as $d) {
            if (($d['status'] ?? '') === 'HIT TP 🎯') $menang++;
            if (($d['status'] ?? '') === 'HIT SL 🛑') $kalah++;
            if (($d['status'] ?? '') === 'EXPIRED') $kedaluwarsa++;
        }
        echo json_encode([
            'status'     => 'ok',
            'mode'       => 'auto',
            'dijalankan' => true,
            'diperiksa'  => $laporan['diperiksa'] ?? 0,
            'dinilai'    => $laporan['dinilai'] ?? 0,
            'dilewati'   => $laporan['dilewati'] ?? 0,
            'tanpa_data' => $laporan['tanpa_data'] ?? 0,
            'menang'     => $menang,
            'kalah'      => $kalah,
            'kedaluwarsa' => $kedaluwarsa,
            'catatan'    => $laporan['catatan'] ?? null,
        ]);
        exit;
    }

    echo $isCli ? json_encode($laporan, JSON_PRETTY_PRINT) . PHP_EOL : json_encode($laporan);
}
