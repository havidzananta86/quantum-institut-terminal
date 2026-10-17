<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — SINYAL BERBASIS BERITA (NEWS SETUP)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Menerbitkan sinyal 5 MENIT SEBELUM rilis data High impact — khusus untuk
 * XAUUSD dan simbol yang benar-benar terdampak mata uang event tersebut.
 *
 * ⚠️ PERBEDAAN PENTING DENGAN MESIN LAIN
 * Mesin otomatis, AI, dan TradingView justru DILINDUNGI filter berita (sinyal
 * ditahan ±30 menit di sekitar rilis). Fitur ini SENGAJA melakukan sebaliknya —
 * ia memang ingin menangkap momen rilis. Karena itu:
 *   · labelnya terpisah: engine = NEWS (statistiknya TIDAK tercampur) ✓
 *   · selalu disertai peringatan risiko: spread melebar, slippage, whipsaw ✗
 *   · TIDAK ADA janji keuntungan. Win rate news setup umumnya lebih rendah dan
 *     variansnya lebih tinggi daripada setup teknikal biasa.
 *
 * SELURUH logika keputusan di berkas ini MURNI (tanpa berkas/jaringan) sehingga
 * bisa diuji tuntas di tests/news-signal.test.php.
 */

if (!function_exists('qi_news_cari_event')) :

/** Ambil angka dari teks kalender ("0.3%", "175K", "-", "1.2M"). */
function qi_news_angka($teks): ?float
{
    $t = trim((string)$teks);
    if ($t === '' || $t === '-' || strtoupper($t) === 'N/A') return null;
    $faktor = 1.0;
    if (preg_match('/([0-9]+(?:\.[0-9]+)?)\s*([KMBT])/i', $t, $m)) {
        $faktor = ['K' => 1e3, 'M' => 1e6, 'B' => 1e9, 'T' => 1e12][strtoupper($m[2])] ?? 1.0;
        return (float)$m[1] * $faktor;
    }
    if (preg_match('/(-?[0-9]+(?:\.[0-9]+)?)/', $t, $m)) return (float)$m[1];
    return null;
}

/**
 * Cari event High impact yang akan rilis ~$menitSebelum menit lagi.
 *
 * @param array $data          daftar event dari cache/calendar.json (biasanya ['data' => [...]])
 * @param int   $kini          waktu sekarang (epoch)
 * @param int   $menitSebelum  target: berapa menit sebelum rilis (bawaan 5)
 * @param int   $toleransi     jendela ±menit (bawaan 2) agar tidak terlewat
 * @return array|null event + ['menit_lagi' => int]
 */
function qi_news_cari_event(array $data, int $kini, int $menitSebelum = 5, int $toleransi = 2): ?array
{
    $daftar = $data['data'] ?? $data['events'] ?? $data;
    if (!is_array($daftar)) return null;

    $batasBawah = ($menitSebelum - $toleransi) * 60;   // mis. 3 menit
    $batasAtas  = ($menitSebelum + $toleransi) * 60;   // mis. 7 menit
    $terpilih = null;
    $selisihTerpilih = PHP_INT_MAX;

    foreach ($daftar as $e) {
        if (!is_array($e)) continue;
        if (strtolower((string)($e['impact'] ?? '')) !== 'high') continue;
        // Pertahanan berlapis: event contoh/uji tidak boleh menerbitkan sinyal berita.
        // (Fungsi ini ada di _middleware.php dan dipakai bersama filter berita.)
        if (function_exists('qi_kalender_event_sah') && !qi_kalender_event_sah($e)) continue;
        $t = strtotime((string)($e['date'] ?? ''));
        if ($t === false) continue;
        $selisih = $t - $kini;                       // positif = belum terjadi
        if ($selisih < $batasBawah || $selisih > $batasAtas) continue;
        // Bila 'actual' sudah terisi, rilis sudah lewat → bukan kandidat.
        $actual = trim((string)($e['actual'] ?? '-'));
        if ($actual !== '' && $actual !== '-') continue;
        if ($selisih < $selisihTerpilih) { $terpilih = $e; $selisihTerpilih = $selisih; }
    }
    if ($terpilih === null) return null;

    $terpilih['menit_lagi'] = (int)round($selisihTerpilih / 60);
    return $terpilih;
}

/**
 * Simbol yang benar-benar terdampak sebuah mata uang event.
 * Pasangan utama yang jelas terkait mata uang tersebut + BTCUSDT untuk event makro USD besar.
 */
function qi_news_simbol_terdampak(string $mataUang, ?string $judulEvent = null): array
{
    $m = strtoupper(trim($mataUang));
    $peta = [
        'USD' => ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'USDCHF'],
        'EUR' => ['EURUSD'],
        'GBP' => ['GBPUSD'],
        'JPY' => ['USDJPY'],
        'CAD' => ['USDCAD'],
        'AUD' => ['AUDUSD'],
        'NZD' => ['NZDUSD'],
        'CHF' => ['USDCHF'],
    ];
    $hasil = $peta[$m] ?? [];

    // Jika event USD adalah rilis makro super-high-impact (FOMC, CPI, NFP, GDP), sertakan BTCUSDT
    if ($m === 'USD' && $judulEvent !== null) {
        $j = strtolower($judulEvent);
        if (preg_match('/\b(fed|fomc|interest rate|cpi|inflation|non farm|non-farm|payrolls|gdp)\b/i', $j)) {
            $hasil[] = 'BTCUSDT';
        }
    }
    return array_values(array_unique($hasil));
}

/**
 * Arah data menurut forecast vs previous — DESKRIPTIF, bukan klaim trading.
 * @return array{tersedia:bool,arah:string,teks:string,forecast:?float,previous:?float,catatan:string}
 */
function qi_news_arah_fundamental(array $event): array
{
    $f = qi_news_angka($event['forecast'] ?? '-');
    $p = qi_news_angka($event['previous'] ?? '-');
    $mata = strtoupper((string)($event['currency'] ?? ($event['country'] ?? '')));
    if ($f === null || $p === null || $f === $p) {
        return [
            'tersedia' => false,
            'arah'     => 'tidak_jelas',
            'teks'     => 'Perkiraan vs sebelumnya tidak menunjukkan perubahan yang bisa dibaca.',
            'forecast' => $f,
            'previous' => $p,
            'catatan'  => 'Tanpa pembacaan arah data, keputusan diserahkan ke analisa teknikal.',
        ];
    }
    $naik = ($f > $p);
    $mekanisme = match ($mata) {
        'USD' => $naik
            ? 'Data USD di atas perkiraan umumnya MENDUKUNG USD (menekan emas/XAUUSD dan mata uang lawan).'
            : 'Data USD di bawah perkiraan umumnya MELEMAHKAN USD (mendukung emas/XAUUSD dan kripto).',
        'CAD' => $naik
            ? 'Data CAD di atas perkiraan mendukung CAD (menekan USDCAD).'
            : 'Data CAD di bawah perkiraan melemahkan CAD (mendorong USDCAD).',
        'JPY' => $naik
            ? 'Data JPY di atas perkiraan mendukung JPY (menekan USDJPY).'
            : 'Data JPY di bawah perkiraan melemahkan JPY (mendorong USDJPY).',
        'CHF' => $naik
            ? 'Data CHF di atas perkiraan mendukung CHF (menekan USDCHF).'
            : 'Data CHF di bawah perkiraan melemahkan CHF (mendorong USDCHF).',
        default => $naik
            ? ('Data ' . $mata . ' di atas perkiraan umumnya mendukung ' . $mata . '.')
            : ('Data ' . $mata . ' di bawah perkiraan umumnya melemahkan ' . $mata . '.'),
    };
    return [
        'tersedia' => true,
        'arah'     => $naik ? 'di_atas_perkiraan' : 'di_bawah_perkiraan',
        'teks'     => 'Perkiraan ' . ($event['forecast'] ?? '-') . ' vs sebelumnya ' . ($event['previous'] ?? '-') . '. ' . $mekanisme,
        'forecast' => $f,
        'previous' => $p,
        'catatan'  => 'Ini hubungan ekonomi yang umum, BUKAN jaminan arah harga. Reaksi pasar bisa berlawanan.',
    ];
}

/**
 * Analisa Deviasi (Surprise Factor) bila data Aktual sudah keluar.
 * Membandingkan Actual vs Forecast untuk mendeteksi lonjakan momentum pasca-rilis.
 * @return array{tersedia:bool,deviasi_persen:float,kekuatan:string,arah_mata_uang:string,teks:string,actual:?float,forecast:?float,previous:?float}
 */
function qi_news_analisa_deviasi(array $event): array
{
    $act  = qi_news_angka($event['actual'] ?? '-');
    $fc   = qi_news_angka($event['forecast'] ?? '-');
    $prev = qi_news_angka($event['previous'] ?? '-');
    $mata = strtoupper((string)($event['currency'] ?? ($event['country'] ?? '')));

    if ($act === null) {
        return [
            'tersedia'        => false,
            'deviasi_persen'  => 0.0,
            'kekuatan'        => 'BELUM_RILIS',
            'arah_mata_uang'  => 'NETRAL',
            'teks'            => 'Data aktual belum rilis.',
            'actual'          => null,
            'forecast'        => $fc,
            'previous'        => $prev,
        ];
    }

    $patokan = ($fc !== null) ? $fc : $prev;
    if ($patokan === null || (float)$patokan === 0.0) {
        return [
            'tersedia'        => true,
            'deviasi_persen'  => 0.0,
            'kekuatan'        => 'MODERAT',
            'arah_mata_uang'  => 'NETRAL',
            'teks'            => 'Aktual: ' . ($event['actual'] ?? '-'),
            'actual'          => $act,
            'forecast'        => $fc,
            'previous'        => $prev,
        ];
    }

    $diff = $act - $patokan;
    $deviasiPct = round(($diff / abs($patokan)) * 100, 2);
    $arah = ($diff > 0) ? 'BULLISH' : (($diff < 0) ? 'BEARISH' : 'NETRAL');

    // Surprise factor magnitude
    $absPct = abs($deviasiPct);
    $kekuatan = ($absPct >= 15.0) ? 'TINGGI' : (($absPct >= 5.0) ? 'SEDANG' : 'RENDAH');

    $teks = sprintf('Aktual %s vs Patokan %s (deviasi %+.2f%%). Sentimen %s: %s [%s].',
        $event['actual'] ?? '-', $fc !== null ? ($event['forecast'] ?? '-') : ($event['previous'] ?? '-'),
        $deviasiPct, $mata, $arah, $kekuatan
    );

    return [
        'tersedia'        => true,
        'deviasi_persen'  => $deviasiPct,
        'kekuatan'        => $kekuatan,
        'arah_mata_uang'  => $arah,
        'teks'            => $teks,
        'actual'          => $act,
        'forecast'        => $fc,
        'previous'        => $prev,
    ];
}

/**
 * Cari event High impact yang rilis 1–$rentangMenit menit LALU (sudah ada data actual).
 * Digunakan untuk menangkap Post-Release Momentum Spike setelah surprise factor terkonfirmasi.
 * @return array|null
 */
function qi_news_cari_event_pasca(array $data, int $kini, int $rentangMenit = 20): ?array
{
    $daftar = $data['data'] ?? $data['events'] ?? $data;
    if (!is_array($daftar)) return null;

    $batasBawah = - ($rentangMenit * 60);   // misal 20 menit lalu
    $batasAtas  = -60;                     // minimal 1 menit lalu (agar candle rilis sempat terbentuk)
    $terpilih = null;
    $selisihTerpilih = -PHP_INT_MAX;

    foreach ($daftar as $e) {
        if (!is_array($e)) continue;
        if (strtolower((string)($e['impact'] ?? '')) !== 'high') continue;
        if (function_exists('qi_kalender_event_sah') && !qi_kalender_event_sah($e)) continue;

        $t = strtotime((string)($e['date'] ?? ''));
        if ($t === false) continue;
        $selisih = $t - $kini;               // negatif = sudah lewat
        if ($selisih < $batasBawah || $selisih > $batasAtas) continue;

        // Actual HARUS sudah terisi untuk pasca-rilis
        $actual = trim((string)($e['actual'] ?? '-'));
        if ($actual === '' || $actual === '-') continue;

        // Pilih rilis terbaru
        if ($selisih > $selisihTerpilih) {
            $terpilih = $e;
            $selisihTerpilih = $selisih;
        }
    }
    if ($terpilih === null) return null;

    $terpilih['menit_lalu'] = (int)round(abs($selisihTerpilih) / 60);
    return $terpilih;
}

/**
 * Periksa apakah sinyal pre-news aktif perlu dibatalkan karena rilis Aktual bertolak belakang drastis.
 * @return array{perlu_batal:bool,alasan:string}
 */
function qi_news_cek_invalidation(array $signal, array $deviasi): array
{
    if (!$deviasi['tersedia'] || $deviasi['kekuatan'] === 'BELUM_RILIS' || $deviasi['arah_mata_uang'] === 'NETRAL') {
        return ['perlu_batal' => false, 'alasan' => ''];
    }

    $simbol = strtoupper((string)($signal['symbol'] ?? ''));
    $side   = strtoupper((string)($signal['side'] ?? ''));
    $arahMata = $deviasi['arah_mata_uang']; // BULLISH atau BEARISH

    // Contoh: Sinyal BUY XAUUSD, tapi data USD keluar sangat BULLISH (deviasi tinggi)
    $konflik = false;
    if (in_array($simbol, ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'BTCUSDT'], true)) {
        if ($side === 'BUY' && $arahMata === 'BULLISH') $konflik = true;
        if ($side === 'SELL' && $arahMata === 'BEARISH') $konflik = true;
    } elseif (in_array($simbol, ['USDJPY', 'USDCAD', 'USDCHF'], true)) {
        if ($side === 'BUY' && $arahMata === 'BEARISH') $konflik = true;
        if ($side === 'SELL' && $arahMata === 'BULLISH') $konflik = true;
    }

    if ($konflik && ($deviasi['kekuatan'] === 'TINGGI' || $deviasi['kekuatan'] === 'SEDANG')) {
        return [
            'perlu_batal' => true,
            'alasan'      => 'Data aktual (' . $deviasi['teks'] . ') bertolak belakang drastis dengan arah ' . $side . ' ' . $simbol . '. Risiko SL tersapu sangat tinggi.',
        ];
    }

    return ['perlu_batal' => false, 'alasan' => ''];
}

/**
 * Level berbasis ATR. SL dibuat LEBIH LEBAR daripada mesin biasa karena rilis
 * berita melebarkan spread dan menyapu stop yang terlalu rapat.
 * SL = multSl × ATR (bawaan 2,0) · TP = rr × SL (bawaan 1,5 → R:R 1:1,5).
 * @return array{sah:bool,entry:float,sl:float,tp:float,rr:float,alasan:string}
 */
function qi_news_rencana_level(float $harga, float $atr, string $arah, float $multSl = 2.0, float $rr = 1.5): array
{
    $arah = strtoupper(trim($arah));
    if ($harga <= 0 || $atr <= 0 || !in_array($arah, ['BUY', 'SELL'], true)) {
        return ['sah' => false, 'entry' => 0, 'sl' => 0, 'tp' => 0, 'rr' => 0, 'alasan' => 'harga/atr/arah tidak sah'];
    }
    $jarakSl = $multSl * $atr;
    $jarakTp = $rr * $jarakSl;
    $entry = round($harga, 5);
    $sl = round($arah === 'BUY' ? $harga - $jarakSl : $harga + $jarakSl, 5);
    $tp = round($arah === 'BUY' ? $harga + $jarakTp : $harga - $jarakTp, 5);
    $sah = ($entry > 0 && $tp > 0 && $sl > 0)
        && (($arah === 'BUY' && $tp > $entry && $entry > $sl) || ($arah === 'SELL' && $tp < $entry && $entry < $sl));
    return [
        'sah'    => $sah,
        'entry'  => $entry,
        'sl'     => $sl,
        'tp'     => $tp,
        'rr'     => $jarakSl > 0 ? round($jarakTp / $jarakSl, 2) : 0,
        'alasan' => $sah ? 'ok' : 'level tidak konsisten',
    ];
}

/**
 * Apakah sinyal untuk (id event + simbol) SUDAH pernah dicatat?
 * Kunci dedup = satu sinyal per event per simbol, apa pun jumlah pengguna.
 */
function qi_news_sudah_ada(array $history, string $idEvent, string $simbol): bool
{
    if ($idEvent === '') return false;
    foreach ($history as $r) {
        if (!is_array($r)) continue;
        if ((string)($r['news_event_id'] ?? '') !== $idEvent) continue;
        if (strtoupper((string)($r['symbol'] ?? '')) !== strtoupper($simbol)) continue;
        return true;
    }
    return false;
}

/** ATR-14 dari daftar candle nyata. */
function qi_news_atr(array $candles, int $periode = 14): float
{
    $n = count($candles);
    if ($n < $periode + 2) return 0.0;
    $tr = [];
    for ($i = $n - $periode; $i < $n; $i++) {
        $h  = (float)($candles[$i]['high'] ?? 0);
        $l  = (float)($candles[$i]['low'] ?? 0);
        $pc = (float)($candles[$i - 1]['close'] ?? 0);
        $tr[] = max($h - $l, abs($h - $pc), abs($l - $pc));
    }
    return $tr ? array_sum($tr) / count($tr) : 0.0;
}

/** Ringkasan fundamental untuk disimpan bersama sinyal (transparan). */
function qi_news_snapshot(array $event, int $menitLagi): array
{
    return [
        'id'        => (string)($event['id'] ?? ''),
        'judul'     => (string)($event['title'] ?? '-'),
        'mata_uang' => strtoupper((string)($event['currency'] ?? ($event['country'] ?? '-'))),
        'dampak'    => (string)($event['impact'] ?? '-'),
        'waktu'     => (string)($event['date'] ?? '-'),
        'perkiraan' => (string)($event['forecast'] ?? '-'),
        'sebelumnya'=> (string)($event['previous'] ?? '-'),
        'aktual'    => (string)($event['actual'] ?? '-'),
        'menit_lagi'=> $menitLagi,
        'sumber'    => (string)($event['source'] ?? '-'),
    ];
}

endif;
