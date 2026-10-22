<?php
/**
 * Penilai sinyal (signal evaluator) — menyelesaikan status sinyal AKTIF menjadi
 * HIT TP / HIT SL / EXPIRED berdasarkan pergerakan harga yang benar-benar terjadi.
 *
 * Sebelum ini, status sinyal HANYA bisa diisi manual lewat POST admin, sehingga
 * win rate / profit factor / expectancy di halaman rekor sinyal tidak akan pernah
 * terisi (di produksi: 7 sinyal semuanya berstatus AKTIF dengan P/L 0).
 *
 * ── VERSI ATURAN PENILAIAN ──────────────────────────────────────────────────
 *  1 = tanpa spread · 2 = spread + harga keluar saat gap (2026-10-19)
 *  3 = + slippage entry/SL + resolusi M1 untuk candle ambigu
 *  4 = + ENTRY WAJIB BISA TERISI (aturan 12, 2026-10-22): rekor yang entry-nya tidak ada
 *      di pasar saat terbit tidak lagi dianggap terisi di 'entry' — ia menunggu harga
 *      menyentuh entry, dan tidak terisi sampai expiry → EXPIRED "entry_tak_terisi".
 *
 *  Versi hanya dinaikkan bila PUTUSANNYA berubah (menang/kalah atau harga keluar).
 *  Penambahan MAE/MFE pada 2026-10-21 TIDAK menaikkan versi: keduanya catatan
 *  tambahan tentang perjalanan posisi, bukan perubahan cara menilai — menaikkannya
 *  akan membuat statistik seolah-olah berasal dari aturan yang berbeda. Aturan 12
 *  MENAIKKAN versi karena memang mengubah putusan (TP "instan" di harga gap hilang).
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
 *     di harga pembukaan — dan harga KELUAR juga harga pembukaan itu (gap melewati SL
 *     berarti rugi lebih dari 1R; dulu tercatat tepat di SL).
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
 *  9. SPREAD (api/_biaya_spread.php): BUY ditutup di BID, SELL di ASK, entry pasar
 *     membayar sisi pembuka. Spread tipikal per simbol dicatat di rekor (spread_biaya,
 *     spread_basis, harga_basis), pnl = BERSIH setelah spread, pnl_kotor = tanpa spread,
 *     entry_efektif = entry setelah spread (dipakai perhitungan R).
 * 12. ENTRY WAJIB BISA TERISI (v4). Dulu setiap rekor dianggap order pasar yang terisi di
 *     'entry' — termasuk entry AI 2650 saat pasar 2700, yang lalu dicatat "HIT TP" di harga
 *     gap pembukaan (+2,5R) untuk transaksi yang mustahil terisi. Sekarang (qi_sig_mode_isi):
 *       · 'pasar'       — entry berada dalam rentang candle tempat sinyal terbit (± spread +
 *                         0,25×ATR, maks. 0,25R): dinilai seperti dulu, posisi terisi saat terbit.
 *                         Candle saat terbit hilang (feed bolong) tetapi harga_acuan ≈ entry dan
 *                         pasar buka → juga 'pasar';
 *       · 'sentuh'      — entry TIDAK ada di pasar saat terbit (atau pasar tutup saat itu):
 *                         posisi baru terisi bila harga sesudahnya mencapai entry — di entry, atau
 *                         di PEMBUKAAN candle yang melompati entry (limit: lebih baik, stop: lebih
 *                         buruk; harga_isi dicatat). Di candle pengisian hanya SL yang dihitung
 *                         (konservatif), TP mulai candle berikutnya, dan MFE candle itu tidak
 *                         dihitung. Tidak tersentuh sampai expiry → EXPIRED expiry_basis
 *                         "entry_tak_terisi" (bukan menang/kalah);
 *       · 'diasumsikan' — data tidak menjangkau waktu terbit dan rekor tanpa harga_acuan:
 *                         tidak dapat diverifikasi, dinilai seperti dulu dan DITANDAI.
 *     Mode & waktu isi diputuskan SEKALI dari data PALING HALUS yang menjangkau waktu terbit;
 *     interval yang lebih kasar (M15/H1) hanya melanjutkan penilaian, tidak memutuskan ulang.
 *     Mode tercatat di rekor (isi_entry, filled_at, harga_isi) supaya dapat diaudit.
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

// Versi aturan penilaian yang berlaku (lihat kepala berkas). Dipakai juga oleh
// api/_signal_stats.php untuk memisahkan statistik per versi.
if (!defined('QI_VERSI_PENILAIAN')) define('QI_VERSI_PENILAIAN', 4);

require_once __DIR__ . '/_paper_math.php';
require_once __DIR__ . '/_signal_time.php';
require_once __DIR__ . '/_biaya_spread.php';
require_once __DIR__ . '/_json_kunci.php';
require_once __DIR__ . '/_urai_m1.php';
require_once __DIR__ . '/_sinyal_pasar.php';   // toleransi entry & jam pasar (sama dengan penerbit sinyal)

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
        // Cache feed broker MT5 diutamakan (sinyal otomatis dibuat dari harga broker), kecuali
        // jauh lebih basi daripada cache umum (OANDA/sumber lama) — misalnya bridge VPS mati.
        $umum = $dir . '/' . md5(strtoupper($symbol) . '_' . $iv) . '.json';
        $mt5  = $dir . '/' . md5(strtoupper($symbol) . '_' . $iv . '_mt5') . '.json';
        // Dibandingkan menurut WAKTU CANDLE TERAKHIR, bukan waktu berkas: berkas MT5 bisa baru ditulis
        // padahal isinya beku (broker tutup kripto di akhir pekan) — dulu itu mengalahkan Binance.
        $kandidat = [];
        foreach (['mt5' => $mt5, 'umum' => $umum] as $jenis => $file) {
            if (!is_file($file)) continue;
            $data = json_decode((string)@file_get_contents($file), true);
            if (!is_array($data) || !empty($data['simulated'])) continue; // data palsu: jangan dipakai
            $candles = $data['candles'] ?? null;
            if (!is_array($candles) || count($candles) < 3) continue;
            $akhir = end($candles);
            $kandidat[$jenis] = ['interval' => $iv, 'candles' => $candles, 'source' => (string)($data['source'] ?? ''),
                                 'akhir' => (int)($akhir['time'] ?? 0)];
        }
        if (!$kandidat) continue;
        $pilih = $kandidat['mt5'] ?? $kandidat['umum'];
        if (isset($kandidat['mt5'], $kandidat['umum'])
            && $kandidat['mt5']['akhir'] < $kandidat['umum']['akhir'] - qi_sig_durasi_interval($iv)) {
            $pilih = $kandidat['umum'];   // MT5 tertinggal > 1 batang (bridge mati / broker tutup)
        }
        unset($pilih['akhir']);
        return $pilih;
    }
    return null;
}
endif;

if (!function_exists('qi_sig_hangatkan_mt5')) :
/**
 * Isi cache candle MT5 (berkas yang sama dengan get-chart-data.php untuk feed broker)
 * langsung dari bridge VPS. Mengembalikan false bila bridge/simbol tidak tersedia.
 */
function qi_sig_hangatkan_mt5(string $symbol, string $iv): bool {
    if (!function_exists('qi_mt5_candles') || !function_exists('qi_mt5_configured') || !function_exists('qi_tv_bridge_symbol')) return false;
    if (qi_tv_bridge_symbol($symbol) === null || !qi_mt5_configured()) return false;
    $candles = qi_mt5_candles($symbol, $iv);
    if (!$candles) return false;
    // Broker tutup akhir pekan untuk kripto: candle beku jangan menimpa cache (Binance dipakai).
    if (function_exists('qi_candle_kripto_basi') && qi_candle_kripto_basi($symbol, $iv, $candles)) return false;
    $dir = __DIR__ . '/../cache/chart';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $payload = json_encode([
        'status' => 'success', 'symbol' => strtoupper($symbol), 'interval' => $iv,
        'count' => count($candles), 'simulated' => false, 'source' => 'mt5',
        'generated_at' => gmdate('c'), 'candles' => $candles,
    ]);
    return @file_put_contents($dir . '/' . md5(strtoupper($symbol) . '_' . $iv . '_mt5') . '.json', $payload, LOCK_EX) !== false;
}
endif;

if (!function_exists('qi_sig_isi_awal')) :
/**
 * Aturan 12 (v4): bagaimana entry sebuah rekor bisa terisi, dan di sisi mana pasar berada.
 *   'pasar'       — entry ada di rentang candle tempat sinyal terbit (± $tol): terisi saat terbit;
 *   'sentuh'      — entry tidak ada di pasar saat terbit, atau ada data SEBELUM terbit tetapi
 *                   tidak ada candle PADA waktu terbit: harus disentuh dulu;
 *   'diasumsikan' — data tidak menjangkau waktu terbit dan rekor tanpa harga_acuan.
 * Rekor baru membawa harga_acuan (harga pasar saat dicatat) sebagai cadangan bila candle
 * saat terbit tidak ada di cache.
 *
 * 'sisi' (mode sentuh): +1 = pasar di ATAS entry, −1 = di BAWAH, 0 = tidak diketahui. Sisi
 * menentukan jenis order yang sebenarnya — BUY di bawah pasar = limit, di atas = stop (SELL
 * kebalikannya) — dan karena itu di harga berapa ia terisi saat harga melompat (qi_sig_cek_isi_candle).
 *
 * Candle PADA waktu terbit tidak ada tetapi ada data sebelumnya (feed bolong): dulu langsung
 * 'sentuh' tanpa melihat harga_acuan, sehingga rekor kripto dengan harga_acuan = entry hanya bisa
 * tercatat bila RUGI — reli dibuang sebagai "entry_tak_terisi", penurunan tercatat HIT SL (audit
 * ulang 2026-10-22). Sekarang harga_acuan ≈ entry DAN pasar memang buka saat terbit → 'pasar'.
 * Pasar tutup saat terbit (akhir pekan, jeda harian emas) tetap 'sentuh': harga_acuan saat itu
 * hanyalah harga beku.
 */
function qi_sig_isi_awal(array $sig, array $candles, int $t0, int $durasi, float $tol, float $offBuka = 0.0): array {
    $entry = (float)($sig['entry'] ?? 0);
    $acuan = (isset($sig['harga_acuan']) && is_numeric($sig['harga_acuan']) && (float)$sig['harga_acuan'] > 0) ? (float)$sig['harga_acuan'] : null;
    $sisiDari = static function (float $harga) use ($entry, $offBuka): int {
        $h = $harga + $offBuka;   // sisi pembuka (BUY dibeli di ASK, SELL dijual di BID)
        return $h > $entry ? 1 : ($h < $entry ? -1 : 0);
    };
    if ($durasi > 0) {
        $sebelum = null; $tSebelum = 0;
        foreach ($candles as $c) {
            $t = (int)($c['time'] ?? 0);
            if ($t <= 0) continue;
            if ($t <= $t0 && $t0 < $t + $durasi) {
                $dalam = ((float)$c['low'] - $tol) <= $entry && $entry <= ((float)$c['high'] + $tol);
                return $dalam ? ['mode' => 'pasar', 'sisi' => 0] : ['mode' => 'sentuh', 'sisi' => $sisiDari((float)$c['close'])];
            }
            if ($t + $durasi <= $t0 && $t > $tSebelum) { $tSebelum = $t; $sebelum = $c; }
        }
        if ($sebelum !== null) {
            if ($acuan !== null && abs($entry - $acuan) <= $tol && qi_sp_pasar_buka((string)($sig['symbol'] ?? ''), $t0)) {
                return ['mode' => 'pasar', 'sisi' => 0];
            }
            return ['mode' => 'sentuh', 'sisi' => $sisiDari($acuan ?? (float)$sebelum['close'])];
        }
    }
    if ($acuan !== null) {
        return abs($entry - $acuan) <= $tol ? ['mode' => 'pasar', 'sisi' => 0] : ['mode' => 'sentuh', 'sisi' => $sisiDari($acuan)];
    }
    return ['mode' => 'diasumsikan', 'sisi' => 0];
}

/** Mode pengisian saja (lihat qi_sig_isi_awal). */
function qi_sig_mode_isi(array $sig, array $candles, int $t0, int $durasi, float $tol): string {
    return qi_sig_isi_awal($sig, $candles, $t0, $durasi, $tol)['mode'];
}

/** Apakah data candle menjangkau waktu terbit (ada candle yang dimulai pada/ sebelum $t0)? */
function qi_sig_menjangkau_terbit(array $candles, int $t0): bool {
    foreach ($candles as $c) {
        $t = (int)($c['time'] ?? 0);
        if ($t > 0 && $t <= $t0) return true;
    }
    return false;
}

/**
 * Apakah order entry terisi di candle ini, dan di harga berapa (harga data, sebelum spread)?
 * Order hanya bisa terisi pada harga yang BENAR-BENAR tersedia di sisi pembuka (BUY di ASK):
 *   · sisi +1 (pasar di atas entry) — terisi saat harga TURUN ke entry. Candle dibuka di/di bawah
 *     entry → terisi di PEMBUKAAN (BUY limit: lebih baik; SELL stop: lebih buruk);
 *   · sisi −1 (pasar di bawah entry) — terisi saat harga NAIK ke entry; dibuka di/di atas entry →
 *     terisi di pembukaan (BUY stop: lebih buruk; SELL limit: lebih baik);
 *   · sisi 0 — hanya bila rentang candle memuat entry.
 * Dulu candle yang MELOMPATI entry tidak mengisinya sama sekali: BUY limit 2650 yang dilompati
 * harga ke 2642 lalu jatuh ke SL tercatat "entry_tak_terisi" (rugi nyata tersembunyi), dan
 * BUY stop yang dilompati ke atas tercatat terisi tepat di entry (lebih baik dari kenyataan).
 * @return array{harga: float, gap: bool}|null
 */
function qi_sig_cek_isi_candle(array $c, float $entry, float $offBuka, int $sisi): ?array {
    $o = (float)$c['open']; $oB = $o + $offBuka; $lB = (float)$c['low'] + $offBuka; $hB = (float)$c['high'] + $offBuka;
    if ($sisi > 0) {
        if ($oB <= $entry) return ['harga' => $o, 'gap' => true];
        return $lB <= $entry ? ['harga' => $entry, 'gap' => false] : null;
    }
    if ($sisi < 0) {
        if ($oB >= $entry) return ['harga' => $o, 'gap' => true];
        return $hB >= $entry ? ['harga' => $entry, 'gap' => false] : null;
    }
    return ($lB <= $entry && $entry <= $hB) ? ['harga' => $entry, 'gap' => false] : null;
}

/**
 * Cari pengisian entry (mode sentuh) di candle sesudah terbit sampai expiry.
 * @return array{t: ?int, harga: ?float, gap: bool, akhir: int} akhir = ujung data (detik)
 */
function qi_sig_cari_isi(array $candles, int $durasi, int $t0, int $tExp, float $entry, float $offBuka, int $sisi): array {
    $urut = [];
    $akhir = 0;
    foreach ($candles as $c) {
        $t = (int)($c['time'] ?? 0);
        if ($t <= 0) continue;
        $akhir = max($akhir, $t + max(1, $durasi));
        if ($t <= $t0 || $t > $tExp) continue;
        $urut[$t] = $c;
    }
    ksort($urut);
    foreach ($urut as $t => $c) {
        $isi = qi_sig_cek_isi_candle($c, $entry, $offBuka, $sisi);
        if ($isi !== null) return ['t' => $t, 'harga' => $isi['harga'], 'gap' => $isi['gap'], 'akhir' => $akhir];
    }
    return ['t' => null, 'harga' => null, 'gap' => false, 'akhir' => $akhir];
}
endif;

if (!function_exists('qi_sig_nilai_satu')) :
/**
 * Tentukan hasil satu sinyal berdasarkan candle.
 * Mengembalikan array hasil, atau null bila belum bisa diputuskan (biarkan AKTIF).
 * @param int      $durasi durasi satu candle (detik) — untuk memeriksa cakupan data
 * @param int|null $kini   waktu sekarang (epoch); null = time()
 * @param array|null $isiDari sumber data untuk MEMUTUSKAN pengisian entry (aturan 12), urut dari
 *                   yang paling halus: list ['candles' => [...], 'durasi' => detik]. Yang dipakai
 *                   adalah yang paling halus dan menjangkau waktu terbit; null = $candles sendiri.
 *                   MENGAPA: penilai mencoba M5 → M15 → H1. Dulu tiap interval memutuskan sendiri;
 *                   M5 berkata "belum terisi" (null), lalu candle H1 yang lebar memuat entry dan
 *                   memutuskan 'pasar' — TP +2,5R tercatat untuk order yang menurut M5 tidak pernah
 *                   bisa terisi (audit ulang 2026-10-22). Keputusan isi kini dibuat SEKALI.
 */
function qi_sig_nilai_satu(array $sig, array $candles, int $durasi = 0, ?int $kini = null, ?string $zonaLama = null, ?callable $urai = null, ?array $isiDari = null): ?array {
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

    // Data yang dimulai SESUDAH sinyal terbit (cache yang sudah bergulir) tidak boleh memutuskan
    // apa pun: TP/SL bisa saja tersentuh di bagian yang hilang. Dulu syarat awal ini hanya dipakai
    // untuk EXPIRED, sehingga cache M5 yang baru dimulai 10 jam sesudah terbit tetap bisa
    // membukukan TP — padahal SL mungkin kena lebih dulu. Interval yang lebih kasar dicoba berikutnya.
    $dE = $durasi > 0 ? $durasi : 60;
    $awalData = PHP_INT_MAX; $akhirData = 0;
    foreach ($candles as $c) {
        $t = (int)($c['time'] ?? 0);
        if ($t <= 0) continue;
        if ($t < $awalData) $awalData = $t;
        if ($t > $akhirData) $akhirData = $t;
    }
    if ($awalData > $t0 + $dE) return null;

    // Aturan 9 (spread): BUY ditutup di BID, SELL di ASK; entry pasar membayar sisi
    // pembuka. Offset 0 bila rekor tidak dipasangi biaya (perilaku lama, dipakai uji).
    $off = qi_spread_offset_rekor($sig);
    $offTutup = ($side === 'BUY') ? $off['bid_off'] : $off['ask_off'];
    $offBuka  = ($side === 'BUY') ? $off['ask_off'] : $off['bid_off'];
    // Aturan 10 (slippage): entry pasar dan SL (order stop) terisi sedikit lebih buruk;
    // TP (order limit) terisi tepat di level. 0 bila rekor tidak dipasangi biaya.
    $slip = max(0.0, (float)($sig['slippage_biaya'] ?? 0));
    // Harga isi yang sebenarnya: 'entry', kecuali candle melompati entry (lihat qi_sig_cek_isi_candle)
    // sehingga order terisi di harga pembukaan. P/L, MAE/MFE, dan entry_efektif dihitung dari harga ini.
    $hargaMasuk = $entry;
    $entryEfektif = $entry + (($side === 'BUY') ? $off['ask_off'] + $slip : $off['bid_off'] - $slip);
    $setelIsi = static function (float $harga) use (&$hargaMasuk, &$entryEfektif, $side, $off, $slip): void {
        $hargaMasuk = $harga;
        $entryEfektif = $harga + (($side === 'BUY') ? $off['ask_off'] + $slip : $off['bid_off'] - $slip);
    };
    $resolusi = null;

    // Aturan 12 (v4): apakah entry BISA terisi? Toleransi = spread + qi_sp_toleransi_entry (0,25×ATR,
    // maks. 0,25R; tanpa ATR 0,2R) — batas yang SAMA dengan pemeriksaan saat pencatatan.
    $risiko = abs($entry - $sl);
    $atrSig = (isset($sig['atr']) && is_numeric($sig['atr'])) ? (float)$sig['atr'] : 0.0;
    $tolIsi = max(0.0, $off['ask_off'] - $off['bid_off']) + qi_sp_toleransi_entry($atrSig, $risiko);
    // Keputusan isi dari data PALING HALUS yang menjangkau waktu terbit (lihat $isiDari di atas).
    $refC = $candles; $refD = $durasi; $refSendiri = true;
    foreach ($isiDari ?? [] as $src) {
        if (!is_array($src['candles'] ?? null) || !qi_sig_menjangkau_terbit($src['candles'], $t0)) continue;
        $refSendiri = ((int)($src['durasi'] ?? 0) === $durasi);
        if (!$refSendiri) { $refC = $src['candles']; $refD = (int)$src['durasi']; }
        break;
    }
    $awalIsi = qi_sig_isi_awal($sig, $refC, $t0, $refD, $tolIsi, $offBuka);
    $modeIsi = $awalIsi['mode'];
    $sisi = $awalIsi['sisi'];
    $terisi = ($modeIsi !== 'sentuh');
    $tIsi = null; $isiGap = false;
    $cariMulai = null;   // mode sentuh, data acuan berhenti sebelum jendela selesai: cari isi di candle ini mulai titik ini
    if (!$terisi) {
        $cari = qi_sig_cari_isi($refC, $refD, $t0, $tExp, $entry, $offBuka, $sisi);
        if ($cari['t'] !== null && !$refSendiri && $durasi > 0 && $refD > $durasi) {
            // Acuan lebih KASAR dari candle yang dinilai (candle ini tidak menjangkau waktu terbit):
            // waktu & harga isi dicari ulang di candle ini, mulai candle acuan tempat entry tersentuh.
            $cariMulai = $cari['t'];
        } elseif ($cari['t'] !== null) {
            $tIsi = $cari['t']; $isiGap = $cari['gap']; $setelIsi((float)$cari['harga']);
        } elseif ($cari['akhir'] < min($tExp, $kini ?? time())) {
            $cariMulai = $cari['akhir'];   // data acuan berhenti lebih dulu: lanjutkan di candle ini
        }
    }
    $catatIsi = static function (array $h) use ($modeIsi, &$tIsi, &$hargaMasuk, $entry): array {
        $h['isi_entry'] = $modeIsi;
        if ($tIsi !== null) $h['filled_at'] = qi_sig_waktu_utc($tIsi);
        if ($hargaMasuk != $entry) $h['harga_isi'] = round($hargaMasuk, 6);   // terisi di pembukaan candle yang melompati entry
        return $h;
    };

    // MAE / MFE — seberapa jauh harga bergerak MELAWAN dan MENDUKUNG posisi sebelum selesai,
    // dalam satuan R (1R = jarak entry ke SL yang direncanakan).
    //
    // MENGAPA PENTING: win rate dan expectancy hanya memberi tahu HASILNYA, bukan SEBABNYA.
    // MAE/MFE menjawab pertanyaan yang menentukan arah perbaikan:
    //   · MAE kecil pada transaksi yang kalah  → arahnya memang salah, bukan SL kesempitan;
    //   · MAE besar lalu akhirnya menang       → SL hampir tersentuh, entry-nya terlalu dini;
    //   · MFE mendekati TP lalu berbalik kalah → TP terlalu jauh, bukan sinyalnya jelek.
    // Dicatat untuk SEMUA transaksi tertutup, termasuk yang kalah. Diukur dari harga isi yang
    // sebenarnya ($hargaMasuk); 1R tetap risiko RENCANA supaya satuannya sama di semua rekor.
    // $hanyaMelawan: candle pengisian — lihat penjelasan di loop di bawah.
    $maeR = 0.0; $mfeR = 0.0;
    $catatMaeMfe = static function (float $high, float $low, bool $hanyaMelawan = false) use ($side, &$hargaMasuk, $risiko, &$maeR, &$mfeR): void {
        if ($risiko <= 0) return;
        $mendukung = ($side === 'BUY') ? $high - $hargaMasuk : $hargaMasuk - $low;   // sejauh mana untung
        $melawan   = ($side === 'BUY') ? $hargaMasuk - $low  : $high - $hargaMasuk;  // sejauh mana rugi
        if ($mendukung > 0 && !$hanyaMelawan) $mfeR = max($mfeR, $mendukung / $risiko);
        if ($melawan   > 0) $maeR = max($maeR, $melawan   / $risiko);
    };

    // Susun hasil HIT TP / HIT SL dari candle pemicu (satu tempat untuk semua jalur keluar).
    // $gap = keluar di harga PEMBUKAAN karena candle dibuka melewati level.
    $putus = function (bool $menang, float $harga, array $c, bool $gap) use ($side, $sl, $entry, &$hargaMasuk, &$entryEfektif, $off, $slip, $atrSig, &$resolusi, &$maeR, &$mfeR, $sig, $catatIsi): array {
        // Aturan 5: keluar di harga yang BENAR-BENAR bisa didapat. Saat gap melewati SL,
        // itu harga pembukaan (lebih buruk dari −1R) — dulu dicatat tepat di SL sehingga
        // kerugian gap tampak lebih kecil dari kenyataannya.
        $keluar = $harga;

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
        // Gap ditandai terpisah: harga MELOMPATI level (pasar tutup/berita), bukan menusuk
        // lalu kembali — api/_sl_learn.php tidak boleh menyebutnya sapuan likuiditas.
        if ($gap) $luar['gap'] = true;

        $selisih = ($side === 'BUY') ? $keluar - $entryEfektif : $entryEfektif - $keluar;
        $biaya = $resolusi !== null ? ['resolusi_ambigu' => $resolusi] : [];
        // entry_efektif juga WAJIB dicatat bila terisi di harga lain dari 'entry' (lompatan harga):
        // statistik R (_signal_stats.php, track-record.php) menghitung dari entry_efektif.
        if ($off['ask_off'] - $off['bid_off'] > 0 || $slip > 0 || $hargaMasuk != $entry) {
            $biaya += [
                'entry_efektif' => round($entryEfektif, 6),
                'pnl_kotor'     => round(($side === 'BUY' ? $keluar - $hargaMasuk : $hargaMasuk - $keluar), 6),
            ];
        }
        return $catatIsi(array_merge([
            'status'      => $menang ? 'HIT TP 🎯' : 'HIT SL 🛑',
            'hit_price'   => round($harga, 6),
            'exit_price'  => round($keluar, 6),
            'closed_at'   => qi_sig_waktu_utc($c['time']),
            'pnl'         => round($selisih, 6),
            // Perjalanan posisi sebelum selesai (lihat $catatMaeMfe di atas).
            'mae_r'       => round($maeR, 3),
            'mfe_r'       => round($mfeR, 3),
            // Harga keluar WAJIB dikirim: untuk pair berbasis USD (USDJPY/USDCHF/USDCAD)
            // qi_paper_pip_mult() mengonversi ke USD dengan 100.000/harga, dan hanya jatuh
            // ke konvensi lama 1000 bila harga tidak diberikan — selisihnya ~50% pada USDJPY.
            // Semua pemanggil lain (_auto_paper.php, ai-jelaskan.php) sudah mengirim harga.
            'pnl_usd'     => round($selisih * qi_paper_pip_mult((string)$sig['symbol'], $keluar), 4),
        ], $biaya, $luar));
    };

    foreach ($filtered as $c) {
        $tpKena = false; $slKena = false; $harga = 0.0; $gap = false;
        $o = $c['open'] + $offTutup; $h = $c['high'] + $offTutup; $l = $c['low'] + $offTutup;
        $slStop = ($side === 'BUY') ? $sl - $slip : $sl + $slip;   // harga isi SL tanpa gap

        // Aturan 12: entry belum terisi → posisi BELUM ADA. Waktu & harga isi sudah dicari di data
        // acuan ($tIsi, qi_sig_cari_isi); bila data acuan berhenti lebih dulu, dicari di candle ini
        // mulai $cariMulai. Candle yang berakhir sebelum pengisian tidak ikut dinilai.
        if (!$terisi) {
            $lilin = true;   // candle pengisian: urutan harga di dalamnya tidak diketahui
            if ($tIsi !== null) {
                if ($c['time'] + $dE <= $tIsi) continue;
                // Terisi di PEMBUKAAN candle ini sendiri (lompatan, data yang sama dengan acuan):
                // seluruh candle terjadi sesudah pengisian → dinilai seperti candle biasa.
                $lilin = !($isiGap && $refSendiri && $c['time'] === $tIsi);
            } elseif ($cariMulai !== null && $c['time'] + $dE > $cariMulai) {
                $isi = qi_sig_cek_isi_candle($c, $entry, $offBuka, $sisi);
                if ($isi === null) continue;
                $tIsi = $c['time']; $isiGap = $isi['gap']; $setelIsi((float)$isi['harga']);
                $lilin = !$isiGap;
            } else {
                continue;
            }
            $terisi = true;
            if ($lilin) {
                // Di candle pengisian urutan tidak diketahui: SL yang tersentuh di candle yang sama
                // dihitung kalah (konservatif); TP baru dihitung mulai candle berikutnya.
                // MAE/MFE (audit ulang 2026-10-22): dulu seluruh candle dihitung, termasuk puncak
                // SEBELUM terisi — BUY 2650 yang turun dari 2701 tercatat MFE 2,55R padahal TP-nya
                // 1,5R. Sekarang MFE candle ini TIDAK dihitung; MAE dihitung bila ekstrem melawan
                // pasti terjadi sesudah isi (order limit: harga datang dari sisi untung, jadi ekstrem
                // di balik entry hanya bisa sesudah isi; sisi tak diketahui: konservatif) ATAU SL
                // kena di candle ini (agar kekalahan konservatif selalu bertanda MAE ≥ 1R).
                $limit = ($sisi === 0) || (($side === 'BUY') ? $sisi > 0 : $sisi < 0);
                $kenaSlIsi = ($side === 'BUY') ? $l <= $sl : $h >= $sl;
                if ($limit || $kenaSlIsi) $catatMaeMfe($h, $l, true);
                if ($kenaSlIsi) return $putus(false, $slStop, $c, false);
                continue;
            }
        }

        // Candle ini ikut dihitung SEBELUM diperiksa apakah TP/SL tersentuh: candle penutup
        // tetap bagian dari perjalanan posisi.
        $catatMaeMfe($h, $l);
        if ($side === 'BUY') {
            if ($o >= $tp) { $tpKena = true; $harga = $o; $gap = true; }      // gap naik melewati TP
            elseif ($o <= $sl) { $slKena = true; $harga = $o; $gap = true; }  // gap turun melewati SL
            else {
                $kenaSl = $l <= $sl; $kenaTp = $h >= $tp;
                if ($kenaSl && $kenaTp) {
                    // Aturan 4 + 11: keduanya tersentuh di satu candle. Urutan dicari dari candle M1
                    // di dalam candle ini; bila M1 tidak tersedia / tetap ambigu → SL lebih dulu.
                    $urut = qi_sig_urai_m1($side, $tp, $sl, $offTutup, $c, $durasi, $urai);
                    $resolusi = $urut === null ? 'sl_dulu' : 'M1';
                    if ($urut === 'TP') { $tpKena = true; $harga = $tp; } else { $slKena = true; $harga = $slStop; }
                }
                elseif ($kenaSl) { $slKena = true; $harga = $slStop; }
                elseif ($kenaTp) { $tpKena = true; $harga = $tp; }
            }
        } else {
            if ($o <= $tp) { $tpKena = true; $harga = $o; $gap = true; }
            elseif ($o >= $sl) { $slKena = true; $harga = $o; $gap = true; }
            else {
                $kenaSl = $h >= $sl; $kenaTp = $l <= $tp;
                if ($kenaSl && $kenaTp) {
                    $urut = qi_sig_urai_m1($side, $tp, $sl, $offTutup, $c, $durasi, $urai);
                    $resolusi = $urut === null ? 'sl_dulu' : 'M1';
                    if ($urut === 'TP') { $tpKena = true; $harga = $tp; } else { $slKena = true; $harga = $slStop; }
                }
                elseif ($kenaSl) { $slKena = true; $harga = $slStop; }
                elseif ($kenaTp) { $tpKena = true; $harga = $tp; }
            }
        }
        if ($tpKena || $slKena) return $putus($tpKena, $harga, $c, $gap);
    }

    // Belum tersentuh. EXPIRED hanya bila data benar-benar mencakup seluruh jendela
    // waktu sinyal (aturan 6) — kalau tidak, lebih baik dibiarkan AKTIF:
    //  · awal : data sudah ada paling lambat satu candle sesudah sinyal terbit;
    //  · akhir: candle yang memuat expiry ada, ATAU data sudah berlanjut melewati expiry
    //           (pasar tutup / akhir pekan: memang tidak ada candle lagi di jendela itu).
    // Dulu syarat akhirnya "candle terakhir >= expiry − 1 detik". Expiry hampir tidak
    // pernah jatuh tepat di batas candle (23:40:43 vs candle 5 menit 23:40:00), jadi
    // sinyal yang sudah lewat masa berlaku tetap AKTIF selamanya.
    // Awal data sudah diperiksa di atas ($awalData ≤ terbit + 1 candle).
    if (($kini ?? time()) <= $tExp) return null;
    // Mode sentuh tanpa isi: data acuan sudah diperiksa sampai ujungnya, dan bila ujung itu sebelum
    // expiry pencarian dilanjutkan di candle ini ($cariMulai) — jadi cakupan candle ini menentukan.
    $akhirTercakup = ($akhirData > $tExp)
        || ($filtered && $filtered[count($filtered) - 1]['time'] >= $tExp - $dE);
    if ($akhirTercakup) {
        return $catatIsi([
            'status'       => 'EXPIRED',
            'hit_price'    => null,
            'exit_price'   => null,
            'closed_at'    => qi_sig_waktu_utc($tExp),
            'pnl'          => 0.0,
            'pnl_usd'      => 0.0,
            // Entry tidak pernah tersentuh: tidak ada posisi sama sekali — dibedakan dari
            // "kedaluwarsa tanpa menyentuh TP/SL" supaya tidak tercampur di laporan.
            'expiry_basis' => ($terisi || $tIsi !== null) ? 'candle' : 'entry_tak_terisi',
        ]);
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
function qi_sig_nilai_lintas_zona(array $sig, array $candles, int $durasi = 0, ?int $kini = null, ?callable $urai = null, ?array $isiDari = null): ?array {
    $perZona = [];
    foreach (qi_sig_zona_kandidat($sig) as $zona) {
        $h = qi_sig_nilai_satu($sig, $candles, $durasi, $kini, $zona, $urai, $isiDari);
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

if (!function_exists('qi_sig_nilai_rekor')) :
/**
 * Nilai SATU rekor AKTIF dengan seluruh aturan (interval kandidat, spread, slippage, gap,
 * resolusi M1, zona waktu, kedaluwarsa tanpa data). Dipakai rekor resmi DAN kandidat yang
 * ditolak gerbang (api/_sinyal_ditolak.php), supaya keduanya dinilai identik.
 * @return array{hasil: ?array, pakai: ?array, ada_data: bool, ubah: array}
 */
function qi_sig_nilai_rekor(array $s, ?int $kini = null): array {
    // Coba tiap interval kandidat (halus → kasar) sampai ada yang bisa memutuskan:
    // cache 5 menit bisa basi atau sudah tidak mencakup awal sinyal, sementara
    // cache 15/60 menit masih mencakup seluruh jendela.
    // Keputusan PENGISIAN entry (aturan 12) tidak ikut dicoba ulang per interval: semua data
    // dimuat lebih dulu dan diteruskan sebagai $isiDari, sehingga pengisian selalu diputuskan dari
    // data paling halus yang menjangkau waktu terbit. Dulu M5 "belum terisi" (null) jatuh ke H1,
    // dan candle H1 yang lebar memutuskan 'pasar' → HIT TP untuk order yang tidak pernah terisi.
    $hasil = null; $pakai = null; $adaData = false; $sBiaya = null;
    $urai = qi_sig_pengurai_m1((string)($s['symbol'] ?? ''));
    $semua = [];
    foreach (qi_sig_interval_kandidat((string)($s['timeframe'] ?? 'MTF')) as $iv) {
        $data = qi_sig_ambil_candle((string)$s['symbol'], [$iv]);
        if ($data !== null) $semua[] = $data;
    }
    $isiDari = array_map(fn($d) => ['candles' => $d['candles'], 'durasi' => qi_sig_durasi_interval($d['interval'])], $semua);
    foreach ($semua as $data) {
        $adaData = true;
        $sBiaya = qi_spread_pasang($s, (string)($data['source'] ?? ''));
        $hasil = qi_sig_nilai_lintas_zona($sBiaya, $data['candles'], qi_sig_durasi_interval($data['interval']), $kini, $urai, $isiDari);
        if ($hasil !== null) { $pakai = $data; break; }
    }
    if ($hasil === null) {
        $hasil = qi_sig_kedaluwarsa_tanpa_data($s, $kini);
        if ($hasil !== null) $pakai = ['interval' => 'tanpa_data'];
    }
    if ($hasil === null) return ['hasil' => null, 'pakai' => null, 'ada_data' => $adaData, 'ubah' => []];

    $ubah = [
        'status'     => $hasil['status'],
        'pnl'        => $hasil['pnl'],
        'pnl_usd'    => $hasil['pnl_usd'],
        'pnl_basis'  => '1 lot',
        'exit_price' => $hasil['exit_price'],
        'closed_at'  => $hasil['closed_at'],
    ];
    // Semua yang DIUKUR penilai ikut disimpan. Dulu daftar ini hanya 5 kolom, sehingga
    // MAE/MFE, hit_price, dan ukuran wick (wick_depth_atr, closed_back) hilang sebelum
    // ditulis: api/_sl_learn.php tidak pernah melihat closed_back dan menyebut gap
    // "sapuan_likuiditas" (audit sinyal 2026-10-22). isset() sengaja tidak dipakai —
    // wick_depth_atr bernilai null bila ATR rekor tidak ada, dan null itu informasi.
    foreach (['expiry_basis', 'zona_hasil', 'entry_efektif', 'pnl_kotor', 'resolusi_ambigu',
              'mae_r', 'mfe_r', 'hit_price', 'wick_extreme', 'wick_depth', 'wick_depth_atr',
              'candle_high', 'candle_low', 'candle_close', 'closed_back', 'gap',
              'isi_entry', 'filled_at', 'harga_isi'] as $f) {
        if (array_key_exists($f, $hasil)) $ubah[$f] = $hasil[$f];
    }
    if ($pakai['interval'] !== 'tanpa_data' && $sBiaya !== null) {
        foreach (['spread_biaya', 'spread_basis', 'harga_basis', 'slippage_biaya'] as $f) {
            if (isset($sBiaya[$f])) $ubah[$f] = $sBiaya[$f];
        }
    }
    // Versi aturan PENILAIAN (QI_VERSI_PENILAIAN, lihat kepala berkas). Rekor yang ditutup
    // dengan versi lama TIDAK ditulis ulang; statistik memisahkannya (per_versi_penilaian)
    // supaya angka dari aturan berbeda tidak tercampur diam-diam.
    $ubah['versi_penilaian'] = QI_VERSI_PENILAIAN;
    $ubah['evaluated_at']   = qi_sig_waktu_utc();
    $ubah['evaluated_from'] = $pakai['interval'] === 'tanpa_data' ? 'tanpa_data' : 'cache/' . $pakai['interval'];
    return ['hasil' => $hasil, 'pakai' => $pakai, 'ada_data' => $adaData, 'ubah' => $ubah];
}

/**
 * Pengambil candle M1 untuk mengurai candle ambigu (aturan 11): cache chart lebih dulu,
 * lalu feed broker MT5 (hanya dipanggil bila memang ada candle ambigu — jarang).
 */
function qi_sig_pengurai_m1(string $simbol): ?callable {
    if ($simbol === '') return null;
    return function (int $t0, int $t1) use ($simbol): array {
        $saring = fn(array $cs) => array_values(array_filter($cs, fn($c) => (int)($c['time'] ?? 0) >= $t0 && (int)($c['time'] ?? 0) < $t1));
        $d = qi_sig_ambil_candle($simbol, ['1']);
        $m1 = $d ? $saring($d['candles']) : [];
        if (!$m1 && function_exists('qi_mt5_candles')) {
            $m1 = $saring(qi_mt5_candles($simbol, '1', 1000));
        }
        return $m1;
    };
}

/**
 * Nilai kandidat yang DITOLAK gerbang (cache/sinyal_ditolak.json) dengan qi_sig_nilai_rekor.
 * Penilaian di luar kunci (mengambil candle), lalu digabung ke isi berkas terbaru di bawah kunci.
 */
function qi_sig_nilai_ditolak(bool $dry = false, int $maks = 60): array {
    if (!function_exists('qi_ditolak_berkas')) require_once __DIR__ . '/_sinyal_ditolak.php';
    $berkas = qi_ditolak_berkas();
    $daftar = qi_json_baca($berkas);
    $ubah = []; $dinilai = 0;
    foreach ($daftar as $r) {
        if (($r['status'] ?? '') !== 'AKTIF' || empty($r['id'])) continue;
        if ($dinilai >= $maks) break;
        $n = qi_sig_nilai_rekor($r);
        if ($n['hasil'] === null) continue;
        $ubah[(string)$r['id']] = $n['ubah'];
        $dinilai++;
    }
    if ($dry || !$ubah) return ['dinilai' => $dinilai, 'tersimpan' => !$ubah ? null : false];
    $t = qi_json_ubah($berkas, function (array $kini) use ($ubah): ?array {
        $kena = 0;
        foreach ($kini as $j => $r) {
            $id = (string)($r['id'] ?? '');
            if (isset($ubah[$id]) && ($r['status'] ?? '') === 'AKTIF') { $kini[$j] = array_merge($r, $ubah[$id]); $kena++; }
        }
        return $kena ? $kini : null;
    }, ['tunggu' => 5.0]);
    return ['dinilai' => $dinilai, 'tersimpan' => $t['ok']];
}
endif;

if (!function_exists('qi_signal_evaluator_run')) :
/**
 * Cari kembali rekor yang dinilai di isi berkas terbaru: menurut id bila ada; bila
 * tidak, indeks yang sama asalkan simbol & waktu terbitnya cocok (rekor lama tanpa id).
 */
function qi_sig_cari_rekor(array $daftar, array $p): ?int {
    if (!empty($p['id'])) {
        foreach ($daftar as $j => $r) {
            if (is_array($r) && (string)($r['id'] ?? '') === (string)$p['id']) return $j;
        }
        return null;
    }
    $j = $p['i'];
    if (isset($daftar[$j]) && ($daftar[$j]['symbol'] ?? null) === $p['symbol'] && ($daftar[$j]['timestamp'] ?? null) === $p['timestamp']) return $j;
    foreach ($daftar as $j => $r) {
        if (is_array($r) && empty($r['id']) && ($r['symbol'] ?? null) === $p['symbol'] && ($r['timestamp'] ?? null) === $p['timestamp']) return $j;
    }
    return null;
}

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
            // Utama: candle broker MT5 langsung dari bridge VPS. Cache umum (OANDA) tetap
            // dihangatkan sebagai cadangan bila bridge mati.
            $okMt5 = qi_sig_hangatkan_mt5($simbol, $iv);
            $url = qi_sig_url_dasar() . '/api/get-chart-data.php?symbol=' . urlencode($simbol) . '&interval=' . urlencode($iv);
            $hasil = @qi_http_get($url, 12);
            $laporan['warm'][] = $simbol . '/' . $iv . '=' . ($okMt5 ? 'mt5' : ($hasil !== false ? 'ok' : 'gagal'));
            $n++;
        }
    }

    $berubah = 0;
    $perubahan = [];
    foreach ($aktif as $i => $s) {
        if ($berubah >= $maxNilai) break;
        $n = qi_sig_nilai_rekor($s);
        $hasil = $n['hasil']; $pakai = $n['pakai'];
        if ($hasil === null) { $laporan[$n['ada_data'] ? 'dilewati' : 'tanpa_data']++; continue; }

        $laporan['dinilai']++;
        $laporan['detail'][] = [
            'id'       => $s['id'] ?? ('#' . $i),
            'symbol'   => $s['symbol'] ?? '?',
            'side'     => $s['side'] ?? '?',
            'interval' => $pakai['interval'],
            'sumber'   => $pakai['source'] ?? null,
            'status'   => $hasil['status'],
            'pnl_usd'  => $hasil['pnl_usd'],
        ];
        if (!$dry) {
            $perubahan[] = ['i' => $i, 'id' => $s['id'] ?? null, 'timestamp' => $s['timestamp'] ?? null,
                            'symbol' => $s['symbol'] ?? null, 'ubah' => $n['ubah']];
        }
        $berubah++;
    }

    if (!$dry && $berubah > 0) {
        // Penilaian di atas memakan waktu (mengambil candle), dan selama itu sinyal BARU
        // bisa tercatat. Karena itu perubahan diterapkan ke isi berkas TERBARU di bawah
        // kunci bersama (api/_json_kunci.php) — dulu seluruh salinan lama ditulis ulang
        // sehingga sinyal yang tercatat di tengah jalan bisa hilang tanpa jejak.
        $tulis = qi_json_ubah($historyFile, function (array $kini) use ($perubahan): ?array {
            $kena = 0;
            foreach ($perubahan as $p) {
                $j = qi_sig_cari_rekor($kini, $p);
                if ($j === null || ($kini[$j]['status'] ?? '') !== 'AKTIF') continue;   // sudah dinilai proses lain
                $kini[$j] = array_merge($kini[$j], $p['ubah']);
                $kena++;
            }
            return $kena > 0 ? $kini : null;
        }, ['tunggu' => 10.0, 'cadangan' => __DIR__ . '/../cache/signal_history.backup.json']);
        $ok = $tulis['ok'] ? true : false;
        if ($tulis['data']) $history = $tulis['data'];
        $laporan['tersimpan'] = $ok;
        if (!$ok) $laporan['catatan'] = $tulis['alasan'] === 'sedang_menulis'
            ? 'riwayat sedang dikunci proses lain — dinilai ulang pada putaran berikutnya'
            : 'GAGAL menulis riwayat (periksa izin cache/)';

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

    // ── KANDIDAT YANG DITOLAK GERBANG (api/_sinyal_ditolak.php) ───────────────────
    // Dinilai dengan aturan yang sama, supaya manfaat setiap gerbang bisa diukur.
    try {
        $laporan['sinyal_ditolak'] = qi_sig_nilai_ditolak($dry);
    } catch (Throwable $e) {
        @error_log('[sinyal-ditolak] penilaian gagal: ' . $e->getMessage());
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

    // ── AUTO ANALISA → AKUN SIMULASI ────────────────────────────────────────────
    // Posisi simulasi pengguna yang mengaktifkan "Ikuti Auto Analisa" ditutup mengikuti hasil sinyal
    // (HIT TP → saldo bertambah, HIT SL → berkurang). Idempoten dan dibungkus try/catch.
    if (!$dry && function_exists('qi_db')) {
        try {
            require_once __DIR__ . '/_auto_paper.php';
            // Harga PADA saat sinyal kedaluwarsa (bukan harga terakhir di cache): close candle
            // terakhir yang sudah tutup sebelum expiry, ditolak bila > 2 batang lebih tua.
            // Dulu end() cache 5/15/60 mana pun tanpa cek umur — tanpa cron/pengunjung, cache
            // itu bisa berumur berhari-hari, jadi P/L EXPIRED diambil dari harga sembarang.
            // Simbol diteruskan supaya jam pasar TUTUP (akhir pekan) tidak dihitung sebagai umur.
            $hargaPada = function (string $simbol, int $pada): ?float {
                foreach (['5', '15', '60'] as $iv) {
                    $d = qi_sig_ambil_candle($simbol, [$iv]);
                    if (!$d || empty($d['candles'])) continue;
                    $px = qi_ap_harga_pada($d['candles'], qi_sig_durasi_interval($iv), $pada, $simbol);
                    if ($px !== null) return $px;
                }
                return null;
            };
            $ap = qi_ap_sinkron(qi_db(), $history, null, $hargaPada);
            $laporan['auto_paper'] = ['dibuka' => $ap['dibuka'], 'ditutup' => $ap['ditutup'], 'dibatalkan' => $ap['dibatalkan']];
        } catch (Throwable $e) {
            @error_log('[auto-paper] hook penilai gagal: ' . $e->getMessage());
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
