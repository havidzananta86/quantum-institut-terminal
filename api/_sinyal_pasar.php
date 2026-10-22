<?php
declare(strict_types=1);
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PASAR UNTUK PENERBIT SINYAL — satu implementasi bersama
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tiga hal yang dulu dihitung sendiri-sendiri (dan berbeda) oleh tiap penerbit sinyal
 * (api/signal-generator.php, api/ai-signal.php, api/signal-news.php, api/tv-webhook.php,
 * api/signals.php, api/ai-cron.php) dikumpulkan di sini supaya aturannya SATU:
 *
 *   1. RSI 14 (Wilder) atas SELURUH riwayat close.
 *      MENGAPA (audit sinyal 2026-10-22): RSI dulu dihitung dari 30 close terakhir saja dan
 *      bernilai 100 bila kedua rata-rata nol. Diuji ulang: tren turun lalu 30 bar datar
 *      (candle datar akhir pekan) → RSI 100, padahal Wilder atas riwayat penuh = 0. Angka
 *      100 itu lalu dihitung sebagai suara BULLISH. Aturan sekarang — SAMA dengan calcRSI
 *      di JavaScript (dijaga uji paritas tests/sinyal-pasar.test.js):
 *        · bar ber-rentang nol (open = high = low = close) dibuang lebih dulu;
 *        · rata-rata awal = SMA 14 perubahan pertama, lalu dihaluskan Wilder sampai akhir;
 *        · rata-rata naik = 0 DAN rata-rata turun = 0 → 50 (tidak ada informasi arah);
 *        · rata-rata turun = 0 (naik > 0) → 100.
 *
 *   2. PENJAGA PASAR TUTUP.
 *      MENGAPA: pembangkit dipicu setiap dashboard dibuka — termasuk Sabtu/Minggu — sehingga
 *      XAUUSD/forex bisa terbit AKTIF dengan entry = close Jumat dan expiry hari Sabtu.
 *      Non-kripto dilewati bila di luar jendela Minggu 22:00 – Jumat 21:00 UTC, atau bila
 *      candle terakhirnya lebih tua dari 2× interval. Kripto (24/7) tidak pernah "tutup",
 *      tetapi candle yang lebih tua dari 2× interval tetap ditolak sebagai DATA BASI.
 *      Emas/perak juga punya JEDA HARIAN (±1 jam di batas hari server broker): dulu penjaga
 *      baru menolak ±15 menit SESUDAH jeda dimulai (menunggu candle M15 berumur > 2 batang),
 *      sehingga sinyal XAUUSD bisa terbit dari harga pra-jeda saat tidak ada yang bisa
 *      diperdagangkan (audit ulang 2026-10-22). Sekarang 21:00–23:00 UTC ditolak eksplisit
 *      untuk XAU/XAG — jendela LEBAR yang mencakup musim panas (21–22) dan dingin (22–23).
 *
 *   3. ENTRY DIPERIKSA TERHADAP HARGA PASAR saat pencatatan.
 *      MENGAPA: sinyal AI/TradingView dulu memakai entry_price dari AI apa adanya. Penilai
 *      menganggap setiap rekor terisi di 'entry', lalu aturan gap-nya membukukan TP di harga
 *      pembukaan. Direproduksi: BUY 2650 / TP 2680 / SL 2630 saat pasar 2700 → "HIT TP" +2,5R
 *      untuk transaksi yang TIDAK PERNAH bisa terisi di 2650. Sekarang:
 *        · harga pasar sudah melewati TP atau SL rencana → rencana usang, DITOLAK
 *          ('entry_jauh_dari_harga') — BERAPA PUN jaraknya. Dulu pemeriksaan ini hanya jalan
 *          bila entry > 0,25×ATR dari pasar, sehingga rencana AI yang sempit (SL/TP $2–5 pada
 *          XAUUSD dengan ATR H1 $12) lolos walau pasar sudah DI ATAS TP-nya, lalu penilai
 *          membukukan "HIT TP" instan di harga pembukaan (audit ulang 2026-10-22);
 *        · |entry − harga pasar| ≤ toleransi (qi_sp_toleransi_entry: 0,25×ATR, tetapi tidak
 *          lebih dari 0,25R rencana) → entry diterima apa adanya. Batas R mencegah entry yang
 *          "dekat" dalam satuan ATR padahal berjarak lebih dari setengah risikonya;
 *        · lebih jauh → entry DIGESER ke harga pasar dengan jarak SL/TP AI dipertahankan
 *          (R:R tidak berubah), dan asalnya dicatat (entry_ai, jarak_entry_atr);
 *        · harga pasar / ATR tidak tersedia → DITOLAK ('harga_acuan_tidak_tersedia') —
 *          entry yang tidak bisa diverifikasi tidak boleh masuk rekor publik.
 *
 *   4. CANDLE ACUAN (H1) WAJIB SEGAR (qi_sp_muat_layak).
 *      MENGAPA: get-chart-data menyajikan cache NYATA yang basi (stale, s.d. 7 hari) saat semua
 *      sumber gagal. Penerbit dulu hanya menolak data simulasi, dan penjaga pasar hanya melihat
 *      M15 — M15 segar + H1 basi 3 hari lolos, lalu entry = close H1 tiga hari lalu dicatat
 *      sebagai "harga pasar" (harga_acuan, jarak_entry_atr 0). Sekarang H1 basi = tidak tersedia.
 *
 * Semua fungsi MURNI (tanpa berkas/jaringan) supaya bisa diuji tuntas.
 */

if (!function_exists('qi_sp_rsi')) :

/** Batas jarak entry ke harga pasar (× ATR) yang masih dianggap "harga pasar". */
if (!defined('QI_SP_BATAS_ENTRY_ATR')) define('QI_SP_BATAS_ENTRY_ATR', 0.25);

/** Simbol kripto (diperdagangkan 24/7). */
function qi_sp_kripto(string $simbol): bool
{
    $s = strtoupper(trim($simbol));
    return str_ends_with($s, 'USDT') || in_array($s, ['BTCUSD', 'ETHUSD'], true);
}

/** Durasi satu candle (detik) untuk kode interval internal. */
function qi_sp_durasi(string $interval): int
{
    $peta = ['1' => 60, '5' => 300, '15' => 900, '30' => 1800, '60' => 3600, '240' => 14400,
             'D' => 86400, 'W' => 604800, 'MN' => 2592000];
    return $peta[$interval] ?? 3600;
}

/**
 * Buang bar ber-rentang nol (open = high = low = close). Bar seperti ini muncul saat feed
 * mengisi jam pasar tutup dengan harga beku (K3: candle datar akhir pekan) — bukan transaksi,
 * jadi tidak boleh ikut menggerakkan indikator.
 */
function qi_sp_buang_datar(array $candles): array
{
    $out = [];
    foreach ($candles as $c) {
        if (!is_array($c) || !isset($c['close'])) continue;
        $o = (float)($c['open'] ?? $c['close']); $h = (float)($c['high'] ?? $c['close']);
        $l = (float)($c['low'] ?? $c['close']);  $cl = (float)$c['close'];
        if ($o === $h && $h === $l && $l === $cl) continue;
        $out[] = $c;
    }
    return $out;
}

/**
 * RSI Wilder atas SELURUH deret close (lihat kepala berkas untuk aturannya).
 * Data kurang dari periode + 1 → 50 (netral: belum ada informasi).
 */
function qi_sp_rsi(array $closes, int $periode = 14): float
{
    $c = array_values(array_map('floatval', $closes));
    $n = count($c);
    if ($periode < 1 || $n < $periode + 1) return 50.0;
    $naik = 0.0; $turun = 0.0;
    for ($i = 1; $i <= $periode; $i++) {
        $d = $c[$i] - $c[$i - 1];
        if ($d > 0) $naik += $d; else $turun -= $d;
    }
    $naik /= $periode; $turun /= $periode;
    for ($i = $periode + 1; $i < $n; $i++) {
        $d = $c[$i] - $c[$i - 1];
        $naik  = ($naik  * ($periode - 1) + max(0.0, $d))  / $periode;
        $turun = ($turun * ($periode - 1) + max(0.0, -$d)) / $periode;
    }
    if ($naik == 0.0 && $turun == 0.0) return 50.0;   // datar total: tidak ada arah
    if ($turun == 0.0) return 100.0;
    return 100.0 - 100.0 / (1.0 + $naik / $turun);
}

/** RSI dari candle: bar ber-rentang nol dibuang dulu, lalu Wilder atas seluruh riwayat. */
function qi_sp_rsi_candles(array $candles, int $periode = 14): float
{
    return qi_sp_rsi(array_column(qi_sp_buang_datar($candles), 'close'), $periode);
}

/** ATR sederhana: rata-rata True Range $periode bar terakhir (sama dengan rumus pembangkit). */
function qi_sp_atr(array $candles, int $periode = 14): float
{
    $candles = array_values($candles);
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

/**
 * Jendela pekan pasar forex/emas (UTC): buka Minggu 22:00 sampai Jumat 21:00.
 * Sengaja jendela yang SEMPIT (aman di musim panas maupun dingin) — lebih baik melewatkan
 * satu jam pembukaan daripada menerbitkan sinyal dari harga beku.
 */
function qi_sp_jendela_pekan(int $kini): bool
{
    $hari = (int)gmdate('N', $kini);            // 1 = Senin … 7 = Minggu
    $menit = (int)gmdate('G', $kini) * 60 + (int)gmdate('i', $kini);
    if ($hari === 6) return false;              // Sabtu
    if ($hari === 7) return $menit >= 22 * 60;  // Minggu mulai 22:00
    if ($hari === 5) return $menit < 21 * 60;   // Jumat sampai 21:00
    return true;
}

/**
 * Jeda harian emas/perak (UTC): 21:00–23:00 setiap hari. Broker menghentikan XAU/XAG ±1 jam di
 * batas hari server (21–22 UTC musim panas AS, 22–23 UTC musim dingin); dua jam dipakai supaya
 * aman di kedua musim — sama dengan prinsip jendela pekan: lebih baik melewatkan satu jam yang
 * buka daripada menerbitkan sinyal dari harga beku.
 */
function qi_sp_jeda_harian(string $simbol, int $kini): bool
{
    $s = strtoupper(trim($simbol));
    if (!(str_starts_with($s, 'XAU') || str_starts_with($s, 'XAG') || $s === 'GOLD' || $s === 'SILVER')) return false;
    $menit = (int)gmdate('G', $kini) * 60 + (int)gmdate('i', $kini);
    return $menit >= 21 * 60 && $menit < 23 * 60;
}

/** Apakah pasar simbol ini buka pada waktu $t (kripto selalu; lainnya jendela pekan tanpa jeda harian). */
function qi_sp_pasar_buka(string $simbol, int $t): bool
{
    if (qi_sp_kripto($simbol)) return true;
    return qi_sp_jendela_pekan($t) && !qi_sp_jeda_harian($simbol, $t);
}

/**
 * Berapa detik pasar simbol ini BUKA di antara $dari dan $sampai (dicacah per menit).
 * Dipakai untuk menilai umur harga: celah tanpa candle selama pasar TUTUP (akhir pekan, jeda
 * harian emas) bukan tanda data basi. Rentang > 14 hari tidak dicacah (pasti basi).
 */
function qi_sp_detik_buka(string $simbol, int $dari, int $sampai): int
{
    if ($sampai <= $dari) return 0;
    if (qi_sp_kripto($simbol) || $sampai - $dari > 14 * 86400) return $sampai - $dari;
    $buka = 0;
    for ($t = $dari; $t < $sampai; $t += 60) {
        if (qi_sp_pasar_buka($simbol, $t)) $buka += min(60, $sampai - $t);
    }
    return $buka;
}

/**
 * Toleransi "entry = harga pasar" (harga, bukan × ATR) — SATU batas untuk pemeriksaan saat
 * pencatatan (qi_sp_jangkar_entry) dan aturan pengisian penilai (api/signal-evaluator.php).
 * 0,25 × ATR, tetapi tidak lebih dari 0,25 × risiko rencana: untuk rencana sempit (SL $1,5
 * dengan ATR $12) 0,25×ATR = $3 = 2R, sehingga entry yang berjarak 2R dari pasar dulu
 * dianggap "harga pasar". Tanpa ATR: 0,2 × risiko (perilaku penilai sebelumnya).
 */
function qi_sp_toleransi_entry(float $atr, float $risiko, float $batasAtr = QI_SP_BATAS_ENTRY_ATR): float
{
    $risiko = abs($risiko);
    if ($atr > 0) return $risiko > 0 ? min($batasAtr * $atr, 0.25 * $risiko) : $batasAtr * $atr;
    return 0.2 * $risiko;
}

/**
 * Penjaga pasar tutup / data basi untuk SATU simbol.
 *
 * @param array $candles candle (lama → baru) dari interval $durasi
 * @return array{boleh: bool, alasan: ?string, umur_detik: ?int, catatan: string}
 *   alasan: 'tanpa_data' | 'pasar_tutup' | 'data_basi' | null
 */
function qi_sp_cek_pasar(string $simbol, array $candles, int $durasi, ?int $kini = null): array
{
    $kini = $kini ?? time();
    $durasi = max(60, $durasi);
    $akhir = $candles ? end($candles) : null;
    $tAkhir = is_array($akhir) ? (int)($akhir['time'] ?? 0) : 0;
    if ($tAkhir <= 0) {
        return ['boleh' => false, 'alasan' => 'tanpa_data', 'umur_detik' => null, 'catatan' => 'Tidak ada candle nyata untuk ' . $simbol . '.'];
    }
    $umur = max(0, $kini - $tAkhir);
    $basi = $umur > 2 * $durasi;
    if (qi_sp_kripto($simbol)) {
        if ($basi) {
            return ['boleh' => false, 'alasan' => 'data_basi', 'umur_detik' => $umur,
                    'catatan' => 'Candle terakhir ' . $simbol . ' berumur ' . (int)round($umur / 60) . ' menit (> 2 batang) — data basi, sinyal tidak dibuat.'];
        }
        return ['boleh' => true, 'alasan' => null, 'umur_detik' => $umur, 'catatan' => 'kripto 24/7, data segar'];
    }
    if (!qi_sp_jendela_pekan($kini)) {
        return ['boleh' => false, 'alasan' => 'pasar_tutup', 'umur_detik' => $umur,
                'catatan' => 'Pasar ' . $simbol . ' tutup (di luar Minggu 22:00 – Jumat 21:00 UTC).'];
    }
    if (qi_sp_jeda_harian($simbol, $kini)) {
        return ['boleh' => false, 'alasan' => 'pasar_tutup', 'umur_detik' => $umur,
                'catatan' => 'Pasar ' . $simbol . ' dalam jeda harian (21:00–23:00 UTC) — tidak ada harga yang bisa diperdagangkan.'];
    }
    if ($basi) {
        return ['boleh' => false, 'alasan' => 'pasar_tutup', 'umur_detik' => $umur,
                'catatan' => 'Candle terakhir ' . $simbol . ' berumur ' . (int)round($umur / 60) . ' menit (> 2 batang) — pasar tutup atau feed berhenti.'];
    }
    return ['boleh' => true, 'alasan' => null, 'umur_detik' => $umur, 'catatan' => 'pasar buka, data segar'];
}

/**
 * Apakah hasil ai_load_candles() (H1 untuk harga & ATR acuan) LAYAK dipakai sebagai harga pasar
 * saat ini? Kosong / simulasi / cache basi (stale dari get-chart-data) / candle terakhir lebih tua
 * dari 2 batang → tidak. Lihat kepala berkas, butir 4.
 *
 * @param array $muat ['candles', 'simulated', 'stale', 'umur_detik'] dari ai_load_candles()
 * @return array{boleh: bool, alasan: ?string, catatan: string}
 *   alasan: 'tanpa_data' | 'data_simulasi_ditolak' | 'data_basi' | 'pasar_tutup' | null
 */
function qi_sp_muat_layak(string $simbol, array $muat, int $durasi = 3600, ?int $kini = null): array
{
    $candles = (isset($muat['candles']) && is_array($muat['candles'])) ? $muat['candles'] : [];
    if (!$candles) {
        return ['boleh' => false, 'alasan' => 'tanpa_data', 'catatan' => 'Candle acuan ' . $simbol . ' tidak tersedia.'];
    }
    if (!empty($muat['simulated'])) {
        return ['boleh' => false, 'alasan' => 'data_simulasi_ditolak', 'catatan' => 'Candle acuan ' . $simbol . ' simulasi — ditolak.'];
    }
    if (!empty($muat['stale'])) {
        $umur = isset($muat['umur_detik']) && is_numeric($muat['umur_detik']) ? (int)$muat['umur_detik'] : null;
        return ['boleh' => false, 'alasan' => 'data_basi',
                'catatan' => 'Candle acuan ' . $simbol . ' berasal dari cache basi' . ($umur !== null ? ' (' . (int)round($umur / 3600) . ' jam)' : '')
                    . ' karena semua sumber harga gagal — harga pasar saat ini tidak diketahui, sinyal tidak dibuat.'];
    }
    $pasar = qi_sp_cek_pasar($simbol, $candles, $durasi, $kini);
    if (!$pasar['boleh']) {
        // Di dalam jendela pasar, candle acuan yang terlalu tua = data basi (bukan "pasar tutup").
        $alasan = ($pasar['alasan'] === 'pasar_tutup' && qi_sp_pasar_buka($simbol, $kini ?? time())) ? 'data_basi' : (string)$pasar['alasan'];
        return ['boleh' => false, 'alasan' => $alasan, 'catatan' => $pasar['catatan']];
    }
    return ['boleh' => true, 'alasan' => null, 'catatan' => 'candle acuan segar'];
}

/**
 * Apakah konsensus multi-timeframe SEARAH dengan sinyal? BULLISH + BUY atau BEARISH + SELL.
 * NEUTRAL, atau konsensus yang berlawanan dengan arah sinyal → false.
 * (signal-news.php dulu menulis $overall !== 'NEUTRAL', sehingga BULLISH + SELL dianggap selaras.)
 */
function qi_sp_mtf_selaras(string $konsensus, string $arah): bool
{
    $arah = strtoupper(trim($arah));
    $konsensus = strtoupper(trim($konsensus));
    return ($arah === 'BUY' && $konsensus === 'BULLISH') || ($arah === 'SELL' && $konsensus === 'BEARISH');
}

/**
 * Periksa entry sebuah rencana terhadap harga pasar (lihat kepala berkas, butir 3).
 *
 * @return array{ok: bool, alasan: ?string, entry: float, tp: float, sl: float, harga_acuan: float,
 *               jarak_entry_atr: ?float, disesuaikan: bool, entry_asal: float, catatan: string}
 */
function qi_sp_jangkar_entry(string $arah, float $entry, float $tp, float $sl, float $acuan, float $atr, float $batasAtr = QI_SP_BATAS_ENTRY_ATR): array
{
    $arah = strtoupper(trim($arah));
    $hasil = ['ok' => false, 'alasan' => null, 'entry' => $entry, 'tp' => $tp, 'sl' => $sl, 'harga_acuan' => $acuan,
              'jarak_entry_atr' => null, 'disesuaikan' => false, 'entry_asal' => $entry, 'catatan' => ''];
    $sah = static fn(float $e, float $t, float $s): bool => $e > 0 && $t > 0 && $s > 0
        && (($arah === 'BUY' && $t > $e && $e > $s) || ($arah === 'SELL' && $t < $e && $e < $s));
    if (!$sah($entry, $tp, $sl)) {
        $hasil['alasan'] = 'level_tidak_konsisten';
        $hasil['catatan'] = 'Level rencana tidak konsisten dengan arah ' . $arah . '.';
        return $hasil;
    }
    if (!($acuan > 0) || !($atr > 0)) {
        $hasil['alasan'] = 'harga_acuan_tidak_tersedia';
        $hasil['catatan'] = 'Harga pasar atau ATR tidak tersedia — entry tidak dapat diverifikasi, jadi tidak dicatat.';
        return $hasil;
    }
    $jarak = abs($entry - $acuan) / $atr;
    $hasil['jarak_entry_atr'] = round($jarak, 3);
    // Harga pasar sudah DI/MELEWATI TP (peluang lewat) atau SL (rencana gugur): tidak ada
    // transaksi jujur yang bisa dibuat dari rencana ini — BERAPA PUN jarak entry-nya. Dulu
    // pemeriksaan ini berada SESUDAH penerimaan toleransi, sehingga BUY 2650 / TP 2652,5 saat
    // pasar 2652,9 (0,24×ATR) diterima dan penilai mencatat "HIT TP" +1,9R di candle berikutnya.
    $lewatTp = ($arah === 'BUY') ? $acuan >= $tp : $acuan <= $tp;
    $lewatSl = ($arah === 'BUY') ? $acuan <= $sl : $acuan >= $sl;
    if ($lewatTp || $lewatSl) {
        $hasil['alasan'] = 'entry_jauh_dari_harga';
        $hasil['catatan'] = 'Harga pasar ' . $acuan . ' sudah melewati ' . ($lewatTp ? 'TP' : 'SL') . ' rencana (entry ' . $entry
            . ', ' . round($jarak, 2) . '× ATR dari pasar) — rencana usang, tidak dicatat.';
        return $hasil;
    }
    $toleransi = qi_sp_toleransi_entry($atr, abs($entry - $sl), $batasAtr);
    if (abs($entry - $acuan) <= $toleransi) {
        $hasil['ok'] = true;
        $hasil['catatan'] = 'Entry ' . $entry . ' berada dalam toleransi ' . round($toleransi, 6) . ' (≤ ' . $batasAtr
            . '× ATR dan ≤ 0,25R) dari harga pasar ' . $acuan . '.';
        return $hasil;
    }
    // Geser ke harga pasar; jarak SL & TP dipertahankan sehingga R:R tetap sama dengan rencana.
    $dSl = abs($entry - $sl); $dTp = abs($tp - $entry);
    $e2 = $acuan;
    $sl2 = ($arah === 'BUY') ? $acuan - $dSl : $acuan + $dSl;
    $tp2 = ($arah === 'BUY') ? $acuan + $dTp : $acuan - $dTp;
    if (!$sah($e2, $tp2, $sl2)) {
        $hasil['alasan'] = 'entry_jauh_dari_harga';
        $hasil['catatan'] = 'Entry tidak dapat digeser ke harga pasar dengan level yang sah.';
        return $hasil;
    }
    $hasil['ok'] = true;
    $hasil['disesuaikan'] = true;
    $hasil['entry'] = $e2; $hasil['sl'] = $sl2; $hasil['tp'] = $tp2;
    $hasil['catatan'] = 'Entry rencana ' . $entry . ' berjarak ' . round($jarak, 2) . '× ATR dari harga pasar ' . $acuan
        . ' (di luar toleransi) — entry digeser ke harga pasar, jarak SL/TP rencana dipertahankan (R:R tetap).';
    return $hasil;
}

endif;
