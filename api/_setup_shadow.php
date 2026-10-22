<?php
/**
 * SUMBER SINYAL BARU — BERBASIS STRUKTUR (mode BAYANGAN).
 *
 * Mengapa ada: sinyal otomatis lama (api/signal-generator.php) masuk di harga pasar setelah EMA/RSI/MACD
 * sepakat, dengan SL = 1,2×ATR dan TP = 3×ATR yang tidak peduli struktur. Hasilnya mendekati titik
 * impas acak untuk R:R 1:2,5 (win rate ±24% vs impas 28,6%). Sumber ini memakai mesin Setup
 * (SMC / ICT / Fibonacci / Supply & Demand) yang sama dengan panel "Setup Analisa":
 *   · entry = ORDER LIMIT di zona struktur (bukan harga pasar),
 *   · SL di balik struktur, TP di likuiditas/target struktural, R:R ≥ 1:2,
 *   · ditambah filter: sesi (London/New York untuk emas & forex), bias H4 (struktur, bukan EMA),
 *     jarak ke entry, ukuran risiko, KORELASI (satu eksposur USD / kripto searah per 4 jam).
 *
 * BAYANGAN = dicatat dan dinilai di cache/signal_shadow.json, TIDAK masuk riwayat resmi, tidak ada
 * notifikasi, tidak tampil ke pengguna. Tujuannya membandingkan secara adil dengan sinyal lama
 * (laporan admin: api/signal-setup-shadow.php?laporan=1) sebelum dipromosikan.
 *
 * Penilaian order limit (konservatif):
 *   · terisi bila harga MENYENTUH entry setelah sinyal terbit; tidak terisi dalam 12 jam → TIDAK TERISI;
 *   · harga melewati TP sebelum terisi → BATAL (peluang sudah lewat);
 *   · di candle yang sama dengan pengisian: bila SL tersentuh → HIT SL; TP baru dihitung dari candle berikutnya;
 *   · SL lebih dulu bila SL dan TP tersentuh di candle yang sama; tahan maksimal 48 jam setelah terisi → EXPIRED;
 *   · SPREAD: limit BUY terisi saat ASK menyentuh entry, posisi ditutup di BID (SELL sebaliknya) memakai
 *     spread tipikal yang dicatat di rekor (api/_biaya_spread.php);
 *   · GAP melewati SL/TP → keluar di harga pembukaan candle, bukan tepat di level.
 *
 * Satu putaran memegang kunci "<berkas rekor>.lock" (cron dan endpoint admin bisa jalan bersamaan;
 * tanpa kunci, putaran yang selesai belakangan menghapus rekor buatan putaran lain).
 */
declare(strict_types=1);

require_once __DIR__ . '/_setup_engine.php';
require_once __DIR__ . '/_signal_time.php';
require_once __DIR__ . '/_signal_stats.php';
require_once __DIR__ . '/_biaya_spread.php';
require_once __DIR__ . '/_json_kunci.php';
require_once __DIR__ . '/_urai_m1.php';
require_once __DIR__ . '/_sinyal_pasar.php';   // qi_sp_muat_layak: tolak H1 basi/simulasi seperti penerbit sinyal lain

if (!function_exists('qi_ss_konfig')) :

/** Semua angka aturan di SATU tempat (mudah disetel & diuji). */
function qi_ss_konfig(): array
{
    return [
        'simbol'           => ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
        'tf_setup'         => '60',        // H1
        'tf_bias'          => '240',       // H4
        'tf_nilai'         => '15',        // M15 untuk menilai pengisian & TP/SL
        'ttl_pending_jam'  => 12,
        'maks_tahan_jam'   => 48,
        'cooldown_jam'     => 4,
        'korelasi_jam'     => 4,
        'maks_per_jalan'   => 3,
        'maks_scan'        => 4,           // simbol yang dipindai per jalan (bergilir)
        'maks_terbuka'     => 12,
        'jarak_maks_atr'   => 2.5,         // entry harus ≤ 2,5×ATR dari harga sekarang
        'risiko_min_atr'   => 0.4,
        'risiko_maks_atr'  => 3.0,
        'konfluensi_atr'   => 0.6,         // dua metode "sepakat" bila entry-nya ≤ 0,6×ATR
        'maks_rekor'       => 500,
        'spread'           => true,        // nilai dengan biaya spread tipikal (api/_biaya_spread.php)
    ];
}

/** Kelompok eksposur. Dua sinyal dengan kunci sama = satu taruhan yang sama (berkorelasi). */
function qi_ss_kunci_korelasi(string $simbol, string $arah): string
{
    $simbol = strtoupper($simbol); $arah = strtoupper($arah);
    $usdMelemah = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'XAUUSD'];   // BUY = USD melemah
    $usdMenguat = ['USDJPY', 'USDCHF', 'USDCAD'];                       // BUY = USD menguat
    if (in_array($simbol, $usdMelemah, true)) return $arah === 'BUY' ? 'USD_LEMAH' : 'USD_KUAT';
    if (in_array($simbol, $usdMenguat, true)) return $arah === 'BUY' ? 'USD_KUAT' : 'USD_LEMAH';
    if (in_array($simbol, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'], true)) return 'KRIPTO_' . $arah;
    return 'LAIN_' . $simbol . '_' . $arah;
}

function qi_ss_korelasi_diblokir(array $rekor, string $kunci, int $kini, int $jam): bool
{
    foreach ($rekor as $r) {
        if (($r['kunci_korelasi'] ?? '') !== $kunci) continue;
        $t = qi_sig_epoch($r['timestamp'] ?? null);
        $terbuka = in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true);
        if ($terbuka || ($t !== null && ($kini - $t) < $jam * 3600)) return true;
    }
    return false;
}

/** Emas & forex: hanya saat London atau New York buka (Senin–Jumat). Kripto: 24 jam. */
function qi_ss_sesi_boleh(string $simbol, int $kini): array
{
    if (in_array(strtoupper($simbol), ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'], true)) {
        return ['boleh' => true, 'sesi' => 'KRIPTO_24J'];
    }
    $buka = [];
    foreach (['LDN' => 'Europe/London', 'NYC' => 'America/New_York'] as $kode => $tz) {
        $d = (new DateTimeImmutable('@' . $kini))->setTimezone(new DateTimeZone($tz));
        $hari = (int)$d->format('N'); $jam = (int)$d->format('G');
        if ($hari >= 1 && $hari <= 5 && $jam >= 8 && $jam < 17) $buka[] = $kode;
    }
    return ['boleh' => count($buka) > 0, 'sesi' => $buka ? implode('+', $buka) : 'DI_LUAR_SESI'];
}

/** Bias H4 dari STRUKTUR (BOS/CHoCH terakhir pada candle yang sudah close), bukan EMA. null = belum jelas. */
function qi_ss_bias_h4(array $h4): ?string
{
    if (count($h4) < 40) return null;
    $tutup = array_slice($h4, 0, -1);
    $ev = QiSetupEngine::peristiwaStruktur($tutup, QiSetupEngine::pivots($tutup));
    return $ev ? $ev[count($ev) - 1]['arah'] : null;
}

/**
 * Saring satu setup. @return array{ok: bool, alasan: ?string}
 */
function qi_ss_saring(array $s, float $harga, float $atr, ?string $biasH4, array $k): array
{
    if (($s['status'] ?? '') !== 'MENUNGGU') return ['ok' => false, 'alasan' => 'bukan_limit_menunggu'];
    if ($atr <= 0) return ['ok' => false, 'alasan' => 'atr_tidak_valid'];
    if ($biasH4 !== null && $biasH4 !== $s['arah']) return ['ok' => false, 'alasan' => 'melawan_bias_h4'];
    if (abs($harga - $s['entry']) > $k['jarak_maks_atr'] * $atr) return ['ok' => false, 'alasan' => 'entry_terlalu_jauh'];
    $risiko = abs($s['entry'] - $s['sl']);
    if ($risiko < $k['risiko_min_atr'] * $atr) return ['ok' => false, 'alasan' => 'risiko_terlalu_kecil'];
    if ($risiko > $k['risiko_maks_atr'] * $atr) return ['ok' => false, 'alasan' => 'risiko_terlalu_besar'];
    return ['ok' => true, 'alasan' => null];
}

/** Pilih satu setup terbaik: paling banyak metode yang sepakat (arah sama, entry berdekatan), lalu R:R. */
function qi_ss_pilih_terbaik(array $setups, float $atr, array $k): ?array
{
    if (!$setups) return null;
    $terbaik = null; $skorTerbaik = -1.0;
    foreach ($setups as $s) {
        $sepakat = [$s['metode']];
        foreach ($setups as $o) {
            if ($o['metode'] !== $s['metode'] && $o['arah'] === $s['arah'] && abs($o['entry'] - $s['entry']) <= $k['konfluensi_atr'] * $atr) $sepakat[] = $o['metode'];
        }
        $skor = count($sepakat) * 10 + min((float)$s['rr'], 4.0);
        if ($skor > $skorTerbaik) { $skorTerbaik = $skor; $terbaik = $s + ['metode_sepakat' => array_values(array_unique($sepakat))]; }
    }
    return $terbaik;
}

/**
 * Nilai satu rekor order limit terhadap candle M15 (lama→baru). Mengembalikan rekor yang sudah diperbarui.
 */
function qi_ss_nilai(array $rek, array $candles, int $kini, array $k): array
{
    $status = (string)($rek['status'] ?? '');
    if (!in_array($status, ['MENUNGGU', 'AKTIF'], true)) return $rek;
    $buy = strtoupper((string)($rek['side'] ?? '')) === 'BUY';
    $entry = (float)$rek['entry']; $sl = (float)$rek['sl']; $tp = (float)$rek['tp'];
    $t0 = qi_sig_epoch($rek['timestamp'] ?? null);
    if ($t0 === null || $entry <= 0 || $sl <= 0 || $tp <= 0) return $rek;
    $ttl = $t0 + (int)$k['ttl_pending_jam'] * 3600;
    $tIsi = ($status === 'AKTIF') ? (qi_sig_epoch($rek['filled_at'] ?? null) ?? $t0) : null;
    $maks = (int)$k['maks_tahan_jam'] * 3600;

    // Spread (api/_biaya_spread.php): limit BUY terisi saat ASK menyentuh entry, posisi BUY
    // ditutup di BID; SELL sebaliknya. Offset 0 bila rekor tidak dipasangi biaya.
    $off = qi_spread_offset_rekor($rek);
    $offBuka  = $buy ? $off['ask_off'] : $off['bid_off'];
    $offTutup = $buy ? $off['bid_off'] : $off['ask_off'];
    // SL adalah order stop: terisi lebih buruk sebesar slippage (entry limit & TP tidak).
    $slip = max(0.0, (float)($rek['slippage_biaya'] ?? 0));
    $slIsi = $buy ? $sl - $slip : $sl + $slip;

    usort($candles, fn($a, $b) => ((int)$a['time']) <=> ((int)$b['time']));
    foreach ($candles as $c) {
        $t = (int)$c['time'];
        if ($t <= $t0) continue;
        if ($tIsi !== null && $t <= $tIsi) continue;
        // Harga sisi PENUTUP posisi (BUY: bid, SELL: ask).
        $o = (float)$c['open'] + $offTutup; $h = (float)$c['high'] + $offTutup; $l = (float)$c['low'] + $offTutup;

        if ($status === 'MENUNGGU') {
            if ($t > $ttl) { $rek['status'] = 'TIDAK TERISI'; $rek['closed_at'] = qi_sig_waktu_utc($t); return $rek; }
            $hB = (float)$c['high'] + $offBuka; $lB = (float)$c['low'] + $offBuka;   // sisi PEMBUKA
            $kenaEntry = $buy ? $lB <= $entry : $hB >= $entry;
            if (!$kenaEntry) {
                if ($buy ? $h > $tp : $l < $tp) { $rek['status'] = 'BATAL'; $rek['closed_at'] = qi_sig_waktu_utc($t); $rek['catatan_akhir'] = 'harga melewati TP sebelum entry terisi'; return $rek; }
                continue;
            }
            // Terisi di candle ini.
            $rek['filled_at'] = qi_sig_waktu_utc($t);
            $tIsi = $t;
            $kenaSl = $buy ? $l <= $sl : $h >= $sl;
            if ($kenaSl) return qi_ss_tutup($rek, false, $slIsi, $t);
            $status = 'AKTIF';
            $rek['status'] = 'AKTIF';
            continue;   // TP baru dihitung dari candle berikutnya
        }

        // AKTIF. Gap melewati level → keluar di harga pembukaan (bukan tepat di level).
        if ($t > $tIsi + $maks) { $rek['status'] = 'EXPIRED'; $rek['closed_at'] = qi_sig_waktu_utc($t); return $rek; }
        if ($buy ? $o <= $sl : $o >= $sl) return qi_ss_tutup($rek, false, $o, $t);
        if ($buy ? $o >= $tp : $o <= $tp) return qi_ss_tutup($rek, true, $o, $t);
        $kenaSl = $buy ? $l <= $sl : $h >= $sl;
        $kenaTp = $buy ? $h >= $tp : $l <= $tp;
        if ($kenaSl && $kenaTp) {
            // TP dan SL di candle yang sama: urutan dari M1 bila tersedia, selain itu SL dulu.
            $urut = qi_sig_urai_m1($buy ? 'BUY' : 'SELL', $tp, $sl, $offTutup, $c, (int)($k['durasi_nilai'] ?? 900),
                                   is_callable($k['urai'] ?? null) ? $k['urai'] : null);
            $rek['resolusi_ambigu'] = $urut === null ? 'sl_dulu' : 'M1';
            return $urut === 'TP' ? qi_ss_tutup($rek, true, $tp, $t) : qi_ss_tutup($rek, false, $slIsi, $t);
        }
        if ($kenaSl) return qi_ss_tutup($rek, false, $slIsi, $t);
        if ($kenaTp) return qi_ss_tutup($rek, true, $tp, $t);
    }
    // Tidak ada keputusan dari candle yang ada: terapkan batas waktu bila sudah lewat.
    if ($status === 'MENUNGGU' && $kini > $ttl) { $rek['status'] = 'TIDAK TERISI'; $rek['closed_at'] = qi_sig_waktu_utc($ttl); }
    elseif ($status === 'AKTIF' && $tIsi !== null && $kini > $tIsi + $maks) { $rek['status'] = 'EXPIRED'; $rek['closed_at'] = qi_sig_waktu_utc($tIsi + $maks); }
    return $rek;
}

function qi_ss_tutup(array $rek, bool $menang, float $keluar, int $t): array
{
    $buy = strtoupper((string)$rek['side']) === 'BUY';
    $rek['status'] = $menang ? 'HIT TP 🎯' : 'HIT SL 🛑';
    $rek['exit_price'] = round($keluar, 6);
    $rek['closed_at'] = qi_sig_waktu_utc($t);
    $rek['pnl'] = round($buy ? $keluar - (float)$rek['entry'] : (float)$rek['entry'] - $keluar, 6);
    return $rek;
}

/** Baca/tulis berkas JSON dengan kunci eksklusif; mengembalikan [] bila tidak ada/rusak. */
function qi_ss_baca(string $berkas): array
{
    if (!is_file($berkas)) return [];
    $d = json_decode((string)@file_get_contents($berkas), true);
    return is_array($d) ? $d : [];
}
function qi_ss_tulis(string $berkas, array $data): bool
{
    return @file_put_contents($berkas, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) !== false;
}

/**
 * Satu putaran: nilai rekor terbuka, lalu pindai beberapa simbol dan terbitkan setup bayangan.
 *
 * @param array $o  muat    callable(string $simbol, string $iv): array{candles: array, simulated: bool}
 *                  kini    int epoch (bawaan time())
 *                  dir     folder cache (bawaan ../cache)
 *                  berita  bool|array hasil qi_berita_blackout (null = tidak diperiksa)
 */
function qi_ss_jalankan(array $o): array
{
    $k = array_merge(qi_ss_konfig(), $o['konfig'] ?? []);   // 'konfig' hanya untuk pengujian
    $muat = $o['muat'];
    $kini = $o['kini'] ?? time();
    $dir = rtrim((string)($o['dir'] ?? (__DIR__ . '/../cache')), '/\\');
    $fRekor = $dir . '/signal_shadow.json';
    $fState = $dir . '/signal_shadow_state.json';
    $ringkas = ['dinilai' => 0, 'dibuat' => 0, 'dipindai' => 0, 'rincian' => [], 'diperbarui' => []];
    $token = qi_kunci_ambil($fRekor, 0.0, 600);
    if ($token === null) { $ringkas['catatan'] = 'sedang_berjalan (putaran lain memegang kunci)'; return $ringkas; }
    try {
        return qi_ss_jalankan_terkunci($o, $k, $muat, $kini, $fRekor, $fState, $ringkas);
    } finally {
        qi_kunci_lepas($fRekor, $token);
    }
}

/** Isi putaran qi_ss_jalankan — dipanggil hanya saat kunci rekor sudah dipegang. */
function qi_ss_jalankan_terkunci(array $o, array $k, callable $muat, int $kini, string $fRekor, string $fState, array $ringkas): array
{
    $rekor = qi_ss_baca($fRekor);
    $state = qi_ss_baca($fState) + ['scan' => [], 'penolakan' => []];

    // 1) Nilai rekor yang masih terbuka (M15 per simbol, dimuat sekali).
    $cacheM15 = []; $sumberM15 = [];
    foreach ($rekor as $i => $r) {
        if (!in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true)) continue;
        $sym = (string)$r['symbol'];
        if (!isset($cacheM15[$sym])) { $m = $muat($sym, $k['tf_nilai']); $cacheM15[$sym] = (empty($m['simulated']) ? ($m['candles'] ?? []) : []); $sumberM15[$sym] = (string)($m['source'] ?? ''); }
        if (!$cacheM15[$sym]) continue;
        if (!empty($k['spread'])) $r = qi_spread_pasang($r, $sumberM15[$sym] ?? '');
        $kNilai = $k + ['urai' => is_callable($o['urai_m1'] ?? null) ? ($o['urai_m1'])($sym) : null, 'durasi_nilai' => 900];
        $baru = qi_ss_nilai($r, $cacheM15[$sym], $kini, $kNilai);
        $ringkas['dinilai']++;
        if (($baru['status'] ?? '') !== ($r['status'] ?? '')) $ringkas['diperbarui'][] = $r['id'] . ': ' . $r['status'] . ' → ' . $baru['status'];
        $rekor[$i] = $baru;
    }

    // 2) Penjaga global.
    $berita = $o['berita'] ?? null;
    $terbuka = count(array_filter($rekor, fn($r) => in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true)));
    $tolak = function (string $alasan) use (&$state) { $state['penolakan'][$alasan] = (int)($state['penolakan'][$alasan] ?? 0) + 1; };
    $selesai = function () use (&$rekor, &$state, &$ringkas, $fRekor, $fState, $k) {
        if (count($rekor) > $k['maks_rekor']) $rekor = array_slice($rekor, 0, $k['maks_rekor']);
        qi_ss_tulis($fRekor, $rekor);
        qi_ss_tulis($fState, $state);
        $ringkas['total_rekor'] = count($rekor);
        return $ringkas;
    };
    if (is_array($berita) && !empty($berita['aktif'])) { $tolak('blackout_berita'); $ringkas['catatan'] = 'ditahan: berita High impact'; return $selesai(); }

    // 3) Pindai simbol (bergilir: yang paling lama tidak dipindai dulu).
    $kandidat = $k['simbol'];
    usort($kandidat, fn($a, $b) => ($state['scan'][$a] ?? 0) <=> ($state['scan'][$b] ?? 0));
    foreach ($kandidat as $simbol) {
        if ($ringkas['dipindai'] >= $k['maks_scan'] || $ringkas['dibuat'] >= $k['maks_per_jalan']) break;
        if ($terbuka >= $k['maks_terbuka']) { $tolak('terlalu_banyak_terbuka'); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'terlalu_banyak_terbuka']; break; }
        $state['scan'][$simbol] = $kini;
        $ringkas['dipindai']++;

        // Satu rekor terbuka / cooldown per simbol.
        $adaTerbuka = false; $terakhir = 0;
        foreach ($rekor as $r) {
            if (($r['symbol'] ?? '') !== $simbol) continue;
            if (in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true)) $adaTerbuka = true;
            $t = qi_sig_epoch($r['timestamp'] ?? null);
            if ($t !== null && $t > $terakhir) $terakhir = $t;
        }
        if ($adaTerbuka) { $tolak('sudah_ada_terbuka'); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'sudah_ada_terbuka']; continue; }
        if ($terakhir && ($kini - $terakhir) < $k['cooldown_jam'] * 3600) { $tolak('cooldown'); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'cooldown']; continue; }

        $sesi = qi_ss_sesi_boleh($simbol, $kini);
        if (!$sesi['boleh']) { $tolak('di_luar_sesi'); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'di_luar_sesi']; continue; }

        $h1 = $muat($simbol, $k['tf_setup']);
        if (empty($h1['candles']) || !empty($h1['simulated'])) { $tolak('data_tidak_ada_atau_simulasi'); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'data_tidak_ada_atau_simulasi']; continue; }
        // Cache H1 basi (semua sumber gagal → get-chart-data menyajikan cache lama bertanda stale)
        // atau candle terakhir yang sudah tua = harga pasar sekarang TIDAK diketahui. Dulu jalur ini
        // hanya menolak candle simulasi, sehingga setup bayangan bisa terbit dengan entry dari harga
        // berhari-hari lalu. Pemeriksaan yang sama dipakai generator, AI, News dan webhook TradingView.
        $layak = qi_sp_muat_layak($simbol, $h1, 3600, $kini);
        if (!$layak['boleh']) { $tolak((string)$layak['alasan']); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => (string)$layak['alasan']]; continue; }
        $c = $h1['candles'];
        $A = QiSetupEngine::atr($c);
        $atr = $A ? (float)$A[count($A) - 1] : 0.0;
        $harga = (float)$c[count($c) - 1]['close'];
        $h4 = $muat($simbol, $k['tf_bias']);
        $bias = qi_ss_bias_h4(empty($h4['simulated']) ? ($h4['candles'] ?? []) : []);
        $presisi = $harga >= 1000 ? 2 : ($harga >= 50 ? 3 : 5);

        $lolos = []; $alasanTolak = [];
        foreach (QiSetupEngine::METODE as $m) {
            $hasil = QiSetupEngine::deteksi($m, $c, ['presisi' => $presisi]);
            foreach ($hasil['setups'] as $s) {
                $f = qi_ss_saring($s, $harga, $atr, $bias, $k);
                if ($f['ok']) $lolos[] = $s; else $alasanTolak[] = $m . ':' . $f['alasan'];
            }
        }
        $pilih = qi_ss_pilih_terbaik($lolos, $atr, $k);
        if (!$pilih) {
            foreach ($alasanTolak as $a) $tolak(explode(':', $a)[1]);
            if (!$alasanTolak) $tolak('tidak_ada_setup');
            $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => $alasanTolak ? 'ditolak' : 'tidak_ada_setup', 'alasan' => $alasanTolak];
            continue;
        }
        $kunci = qi_ss_kunci_korelasi($simbol, $pilih['arah']);
        if (qi_ss_korelasi_diblokir($rekor, $kunci, $kini, (int)$k['korelasi_jam'])) {
            $tolak('korelasi'); $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'korelasi', 'kunci' => $kunci]; continue;
        }

        $rek = [
            'id'              => 'SHD-' . gmdate('Ymd', $kini) . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
            'timestamp'       => qi_sig_waktu_utc($kini),
            'expiry'          => qi_sig_waktu_utc($kini + (int)$k['ttl_pending_jam'] * 3600),
            'symbol'          => $simbol,
            'engine'          => 'SETUP_' . $pilih['metode'],
            'engine_name'     => 'Setup Struktur ' . $pilih['metode'] . ' (bayangan)',
            'timeframe'       => 'H1',
            'side'            => $pilih['arah'],
            'entry'           => $pilih['entry'],
            'sl'              => $pilih['sl'],
            'tp'              => $pilih['tp'],
            'rr'              => '1 : ' . number_format((float)$pilih['rr'], 2, '.', ''),
            'atr'             => round($atr, 6),
            'status'          => 'MENUNGGU',
            'sumber'          => 'setup_shadow',
            'shadow'          => true,
            'metode'          => $pilih['metode'],
            'metode_sepakat'  => $pilih['metode_sepakat'],
            'tp_label'        => $pilih['tpLabel'] ?? null,
            'zona'            => $pilih['zona'],
            'alasan'          => $pilih['alasan'],
            'harga_saat_terbit' => $harga,
            'bias_h4'         => $bias,
            'sesi'            => $sesi['sesi'],
            'kunci_korelasi'  => $kunci,
        ];
        array_unshift($rekor, $rek);
        $terbuka++;
        $ringkas['dibuat']++;
        $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'setup_dibuat', 'id' => $rek['id'], 'metode' => $pilih['metode'], 'arah' => $pilih['arah'], 'entry' => $pilih['entry'], 'sl' => $pilih['sl'], 'tp' => $pilih['tp'], 'rr' => $pilih['rr']];
    }
    return $selesai();
}

/** Ringkasan perbandingan bayangan vs sinyal lama untuk laporan admin. */
function qi_ss_laporan(array $bayangan, array $resmi): array
{
    $hitung = [];
    foreach ($bayangan as $r) {
        $st0 = (string)($r['status'] ?? '?');
        $s = (strpos($st0, 'HIT TP') === 0) ? 'HIT_TP' : ((strpos($st0, 'HIT SL') === 0) ? 'HIT_SL' : str_replace(' ', '_', $st0));
        $hitung[$s] = ($hitung[$s] ?? 0) + 1;
    }
    $terisi = array_values(array_filter($bayangan, fn($r) => !empty($r['filled_at'])));
    $selesai = array_values(array_filter($bayangan, fn($r) => preg_match('/^HIT (TP|SL)/u', (string)($r['status'] ?? ''))));
    $lama = array_values(array_filter($resmi, fn($r) => ($r['sumber'] ?? '') === 'auto_generator'));

    $perMetode = []; $perSesi = [];
    foreach ($selesai as $r) {
        $perMetode[(string)($r['metode'] ?? '?')][] = $r;
        $perSesi[(string)($r['sesi'] ?? '?')][] = $r;
    }
    $ringkasKel = fn(array $peta) => array_map(function ($nama, $daftar) {
        $st = qi_signal_statistik($daftar);
        return ['nama' => $nama, 'dinilai' => $st['dinilai'], 'menang' => $st['menang'], 'win_rate' => $st['win_rate'], 'total_r' => $st['total_r']];
    }, array_keys($peta), array_values($peta));

    $stB = qi_signal_statistik($selesai);
    $stL = qi_signal_statistik($lama);
    $ambil = fn(array $st) => array_intersect_key($st, array_flip(['dinilai', 'menang', 'kalah', 'win_rate', 'ci_bawah', 'ci_atas', 'expectancy_r', 'total_r', 'profit_factor', 'rr_rata', 'titik_impas_pct']));
    $n = $stB['dinilai'];
    // Tingkat pengisian order limit: dari semua order yang sudah "diputuskan" (terisi, tidak terisi, batal).
    $tidakTerisi = ($hitung['TIDAK_TERISI'] ?? 0) + ($hitung['BATAL'] ?? 0);
    $diputuskan = count($terisi) + $tidakTerisi;
    return [
        'status'        => 'ok',
        'bayangan'      => [
            'rekor' => count($bayangan), 'per_status' => $hitung, 'terisi' => count($terisi),
            'tingkat_isi_pct' => $diputuskan ? round(count($terisi) / $diputuskan * 100, 1) : null,
            'statistik' => $ambil($stB), 'per_metode' => $ringkasKel($perMetode), 'per_sesi' => $ringkasKel($perSesi),
        ],
        'sinyal_lama'   => ['statistik' => $ambil($stL)],
        'siap_dinilai'  => $n >= 100,
        'catatan'       => $n >= 100
            ? 'Sampel bayangan ≥ 100 sinyal tertutup: perbandingan expectancy & interval keyakinan sudah bermakna.'
            : 'Sampel bayangan baru ' . $n . ' sinyal tertutup. Kumpulkan minimal 100 sebelum menyimpulkan atau mempromosikan.',
        'satuan'        => 'R = kelipatan risiko (1R = jarak entry ke SL). Titik impas = 1/(1+R:R rata-rata).',
        // Kriteria lulus/gagal yang bisa diaudit (api/_signal_stats.php) — alat bantu, bukan saklar.
        'kesiapan_auto_entry' => qi_signal_kesiapan_auto($selesai, array_values(array_filter($lama, fn($r) => preg_match('/^HIT (TP|SL)/u', (string)($r['status'] ?? ''))))),
    ];
}

endif;
