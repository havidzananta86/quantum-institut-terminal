<?php
declare(strict_types=1);
/**
 * MESIN 9 QUANTUM DI SISI SERVER (Tahap 3 — dasar audit konfluensi).
 *
 * MENGAPA ADA:
 *   Sebelumnya matriks 9 mesin dihitung di PERAMBAN saja, sehingga server tidak dapat
 *   membuktikan mesin mana yang setuju. Akibatnya kolom "basis" rekor hanya berisi teks
 *   ringkas. Modul ini menghitung mesin-mesin tersebut di server dari data TradingView
 *   Scanner, sehingga konfluensi dapat DIAUDIT dan dibandingkan.
 *
 * ATURAN KEJUJURAN — INI YANG PALING PENTING:
 *   1. Setiap mesin HANYA dihitung dari field yang TERBUKTI ada di TradingView Scanner
 *      (diukur 2026-10-13). Bila field-nya tidak ada, mesin ditandai tersedia=false
 *      beserta alasannya — TIDAK dihitung dengan cara lain lalu disebut nama yang sama.
 *   2. Mesin yang butuh RIWAYAT CANDLE OHLC (Order Block, FVG, BOS/CHoCH) TIDAK dapat
 *      dihitung dari snapshot scanner. Karena itu SMC ditandai tidak tersedia, bukan
 *      ditebak.
 *   3. Ichimoku TIDAK tersedia di scanner (Ichimoku.CONV/BASE/SPANA/SPANB = NULL, sudah
 *      diukur di ketiga simbol). Mesin ICHI ditandai tidak tersedia.
 *   4. SNR di server memakai nama jujur: skornya adalah "kedekatan harga ke level nyata
 *      TradingView" (1 bulan/3 bulan/52 minggu/pivot bulanan/VWAP) — bukan algoritma
 *      kekuatan retest milik mesin klien. Dasarnya ditulis apa adanya di kolom 'dasar'.
 *
 * AMBANG (dinyatakan terbuka supaya bisa diperdebatkan):
 *   · Putusan dari skor TradingView: ≥ 0,1 BUY · ≤ −0,1 SELL · selain itu NETRAL.
 *   · Golden cross: EMA50 di atas EMA200 (dan sebaliknya).
 *   · Pullback EMA200: harga dalam 1× ATR dari EMA200.
 *   · Fibonacci golden zone: posisi 0,382–0,618 pada rentang Low.1M–High.1M.
 *   · SNR: level dalam 0,5× ATR dianggap dekat.
 *   · Konfluensi: minimal 3 mesin searah (sesuai spesifikasi Bagian 2).
 */

if (!function_exists('qi_eng_putusan')) {

    /**
     * Kolom TradingView yang SUDAH TERBUKTI tersedia (diukur 2026-10-13).
     * PENTING: 'Recommend.All' TANPA akhiran = HARIAN. Tanpa kolom itu, D1 selalu
     * TIDAK_ADA (bug yang ditemukan & diperbaiki). 'Recommend.All|1D' terbukti NULL.
     */
    function qi_eng_kolom(): array
    {
        return ['close','change','open','high','low','VWAP','Recommend.All',
            'Recommend.All|1','Recommend.All|5','Recommend.All|15','Recommend.All|30','Recommend.All|60','Recommend.All|240','Recommend.All|1W',
            'Recommend.MA|60','Recommend.Other|60','Recommend.MA','Recommend.Other',
            'EMA20','EMA50','EMA200','SMA200','RSI','RSI|5','RSI|60','RSI|240',
            'Stoch.K','Stoch.D','CCI20','ADX','ADX+DI','ADX-DI',
            'ATR','ATR|5','ATR|60','ATR|240','Volatility.D','MACD.macd','MACD.signal','Mom','Mom|60','AO','BBPower','BB.lower','BB.upper',
            'High.1M','Low.1M','High.3M','Low.3M','High.6M','Low.6M','price_52_week_high','price_52_week_low',
            'Pivot.M.Classic.Middle','Pivot.M.Classic.R1','Pivot.M.Classic.S1'];
    }

    /** Peta simbol platform → ticker TradingView (OANDA emas/forex · BINANCE kripto). */
    function qi_eng_ticker(string $simbol): ?string
    {
        $peta = [
            'XAUUSD' => 'OANDA:XAUUSD', 'XAGUSD' => 'OANDA:XAGUSD',
            'EURUSD' => 'OANDA:EURUSD', 'GBPUSD' => 'OANDA:GBPUSD', 'USDJPY' => 'OANDA:USDJPY',
            'AUDUSD' => 'OANDA:AUDUSD', 'USDCAD' => 'OANDA:USDCAD', 'USDCHF' => 'OANDA:USDCHF',
            'NZDUSD' => 'OANDA:NZDUSD', 'EURJPY' => 'OANDA:EURJPY', 'GBPJPY' => 'OANDA:GBPJPY',
            'BTCUSDT' => 'BINANCE:BTCUSDT', 'ETHUSDT' => 'BINANCE:ETHUSDT', 'SOLUSDT' => 'BINANCE:SOLUSDT',
            'BNBUSDT' => 'BINANCE:BNBUSDT', 'XRPUSDT' => 'BINANCE:XRPUSDT',
        ];
        return $peta[strtoupper(trim($simbol))] ?? null;
    }

    /**
     * Ambil satu baris data TradingView Scanner (dengan cache berkas).
     * Mengembalikan null bila gagal — pemanggil WAJIB memperlakukan null sebagai
     * "data tidak tersedia" dan TIDAK menyimpulkan apa pun darinya.
     */
    function qi_eng_snapshot(string $simbol, int $cacheDetik = 30): ?array
    {
        $ticker = qi_eng_ticker($simbol);
        if ($ticker === null) return null;
        $kolom = qi_eng_kolom();
        $berkasCache = __DIR__ . '/../cache/engine_server_' . strtolower(preg_replace('/[^A-Za-z0-9]/', '', $simbol)) . '.json';
        if (is_file($berkasCache) && (time() - (int)@filemtime($berkasCache) < $cacheDetik)) {
            $isi = json_decode((string)@file_get_contents($berkasCache), true);
            if (is_array($isi) && count($isi) === count($kolom)) return $isi;
        }
        $body = json_encode(['symbols' => ['tickers' => [$ticker], 'query' => ['types' => []]], 'columns' => $kolom]);
        [$raw, $kode] = qi_tv_scan($body, 20);   // library TradingView-API (bridge) → scanner
        if ($raw === false || $kode !== 200) { @error_log('[engine] scanner HTTP ' . $kode); return null; }
        $j = json_decode((string)$raw, true);
        $d = $j['data'][0]['d'] ?? null;
        if (!is_array($d) || count($d) !== count($kolom)) { @error_log('[engine] bentuk data scanner tidak sesuai'); return null; }
        $c = array_combine($kolom, $d);
        $dir = dirname($berkasCache);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        @file_put_contents($berkasCache, json_encode($c, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $c;
    }

    /** Label putusan dari skor TradingView (ambang sama dengan seluruh platform). */
    function qi_eng_putusan($skor): string
    {
        if (!is_numeric($skor)) return 'TIDAK_ADA';
        $s = (float)$skor;
        if ($s >= 0.5)  return 'STRONG_BUY';
        if ($s >= 0.1)  return 'BUY';
        if ($s <= -0.5) return 'STRONG_SELL';
        if ($s <= -0.1) return 'SELL';
        return 'NETRAL';
    }

    /** Arah ringkas: BUY / SELL / NETRAL. */
    function qi_eng_arah(string $putusan): string
    {
        if (strpos($putusan, 'BUY') !== false) return 'BUY';
        if (strpos($putusan, 'SELL') !== false) return 'SELL';
        return 'NETRAL';
    }

    /** Ambil angka dari data scanner, atau null ('' dan null tidak menjadi 0 palsu). */
    function qi_eng_angka(array $c, string $kunci): ?float
    {
        if (!array_key_exists($kunci, $c)) return null;
        $v = $c[$kunci];
        if ($v === null || $v === '' || !is_numeric($v)) return null;
        return (float)$v;
    }

    /** Batasi skor 0-100. */
    function qi_eng_batas(float $nilai): float
    {
        return round(max(0.0, min(100.0, $nilai)), 1);
    }

    /** Kerangka hasil satu mesin. */
    function qi_eng_hasil(string $kode, string $nama, bool $tersedia, string $arah, float $skor, string $dasar): array
    {
        return ['kode' => $kode, 'nama' => $nama, 'tersedia' => $tersedia,
                'arah' => $arah, 'skor' => $tersedia ? $skor : null, 'dasar' => $dasar];
    }

    // ── 1. GOLDEN CROSS ────────────────────────────────────────────────────────
    function qi_eng_golden_cross(array $c): array
    {
        $ema50 = qi_eng_angka($c, 'EMA50'); $ema200 = qi_eng_angka($c, 'EMA200');
        $harga = qi_eng_angka($c, 'close');
        if ($ema50 === null || $ema200 === null || $harga === null || $harga <= 0) {
            return qi_eng_hasil('GOLDEN_CROSS', 'Quantum Golden Cross', false, 'NETRAL', 0, 'EMA50/EMA200 tidak tersedia di data.');
        }
        $selisihPersen = abs($ema50 - $ema200) / $harga * 100.0;
        $arah = ($ema50 > $ema200) ? 'BUY' : (($ema50 < $ema200) ? 'SELL' : 'NETRAL');
        // Skor: jarak persentase dipetakan 0–1% → 0–100 (di atas 1% dianggap penuh).
        $skor = qi_eng_batas($selisihPersen * 100.0);
        $dasar = 'EMA50 ' . round($ema50, 5) . ' vs EMA200 ' . round($ema200, 5) . ' (selisih ' . round($selisihPersen, 3) . '% dari harga)';
        return qi_eng_hasil('GOLDEN_CROSS', 'Quantum Golden Cross', true, $arah, $skor, $dasar);
    }

    // ── 2. EMA200 PULLBACK ─────────────────────────────────────────────────────
    function qi_eng_ema200(array $c): array
    {
        $harga = qi_eng_angka($c, 'close'); $ema200 = qi_eng_angka($c, 'EMA200');
        $ema20 = qi_eng_angka($c, 'EMA20'); $ema50 = qi_eng_angka($c, 'EMA50');
        $atr = qi_eng_angka($c, 'ATR|60') ?? qi_eng_angka($c, 'ATR');
        $adx = qi_eng_angka($c, 'ADX');
        if ($harga === null || $ema200 === null || $atr === null || $atr <= 0) {
            return qi_eng_hasil('EMA200', 'Quantum EMA200 Pullback', false, 'NETRAL', 0, 'Harga/EMA200/ATR tidak lengkap.');
        }
        $tren = ($harga > $ema200) ? 'BUY' : (($harga < $ema200) ? 'SELL' : 'NETRAL');
        $jarakAtr = abs($harga - $ema200) / $atr;
        $pullback = ($jarakAtr <= 1.0);   // harga sedang menghampiri EMA200
        // Arah hanya diberikan bila tren jelas DAN harga sedang pullback ke EMA200,
        // yaitu kondisi entry yang dimaksud mesin ini. Selain itu NETRAL (menunggu).
        $arah = ($tren !== 'NETRAL' && $pullback) ? $tren : 'NETRAL';
        $kekuatan = ($adx !== null) ? min(100.0, $adx * 2.0) : 40.0;   // ADX 50 → 100
        $selaras = (($ema20 !== null && $ema50 !== null) && (($tren === 'BUY' && $ema20 > $ema50) || ($tren === 'SELL' && $ema20 < $ema50)));
        $skor = qi_eng_batas($pullback ? ($kekuatan * ($selaras ? 1.0 : 0.7)) : ($kekuatan * 0.4));
        $dasar = 'Harga ' . round($harga, 5) . ' vs EMA200 ' . round($ema200, 5) . ' (jarak ' . round($jarakAtr, 2) . '× ATR)'
               . ($pullback ? ' · sedang pullback ke EMA200' : ' · belum pullback (menunggu)')
               . ($adx !== null ? (' · ADX ' . round($adx, 1)) : '');
        return qi_eng_hasil('EMA200', 'Quantum EMA200 Pullback', true, $arah, $skor, $dasar);
    }

    // ── 3. MACD MOMENTUM ───────────────────────────────────────────────────────
    function qi_eng_macd(array $c): array
    {
        $macd = qi_eng_angka($c, 'MACD.macd'); $sinyal = qi_eng_angka($c, 'MACD.signal');
        $atr = qi_eng_angka($c, 'ATR|60') ?? qi_eng_angka($c, 'ATR');
        if ($macd === null || $sinyal === null) {
            return qi_eng_hasil('MACD_MOM', 'Quantum MACD Momentum', false, 'NETRAL', 0, 'MACD tidak tersedia.');
        }
        $hist = $macd - $sinyal;
        $arah = ($hist > 0) ? 'BUY' : (($hist < 0) ? 'SELL' : 'NETRAL');
        // Kekuatan dinormalkan terhadap ATR supaya sebanding antar simbol.
        $rasio = ($atr !== null && $atr > 0) ? (abs($hist) / $atr) : null;
        $skor = qi_eng_batas($rasio === null ? 50.0 : ($rasio * 250.0));   // 0,4× ATR → 100
        $dasar = 'MACD ' . round($macd, 5) . ' vs signal ' . round($sinyal, 5) . ' · histogram ' . round($hist, 5)
               . ($rasio !== null ? (' (' . round($rasio, 3) . '× ATR)') : '');
        return qi_eng_hasil('MACD_MOM', 'Quantum MACD Momentum', true, $arah, $skor, $dasar);
    }

    // ── 4. TREN M5 (mesin PRO) ─────────────────────────────────────────────────
    function qi_eng_tren_m5(array $c): array
    {
        $rec = qi_eng_angka($c, 'Recommend.All|5');
        $rsi5 = qi_eng_angka($c, 'RSI|5');
        $atr5 = qi_eng_angka($c, 'ATR|5');
        if ($rec === null) {
            return qi_eng_hasil('TRENM5', 'Quantum TrenM5', false, 'NETRAL', 0, 'Putusan M5 (Recommend.All|5) tidak tersedia.');
        }
        $putusan = qi_eng_putusan($rec);
        $arah = qi_eng_arah($putusan);
        if ($rsi5 !== null && $arah === 'BUY' && $rsi5 >= 75) $arah = 'NETRAL';   // hindari beli di overbought M5
        if ($rsi5 !== null && $arah === 'SELL' && $rsi5 <= 25) $arah = 'NETRAL';  // hindari jual di oversold M5
        $skor = qi_eng_batas(abs($rec) * 100.0);
        $dasar = 'M5: ' . $putusan . ' (skor ' . round($rec, 3) . ')' . ($rsi5 !== null ? (' · RSI M5 ' . round($rsi5, 1)) : '')
               . ($atr5 !== null ? (' · ATR M5 ' . round($atr5, 5)) : '');
        return qi_eng_hasil('TRENM5', 'Quantum TrenM5', true, $arah, $skor, $dasar);
    }

    // ── 5. MOMENTUM NEW YORK (mesin PRO) ───────────────────────────────────────
    function qi_eng_momentum_ny(array $c, ?int $jam = null): array
    {
        $rec = qi_eng_angka($c, 'Recommend.All|60');
        $mom = qi_eng_angka($c, 'Mom|60') ?? qi_eng_angka($c, 'Mom');
        $ao  = qi_eng_angka($c, 'AO');
        if ($rec === null) {
            return qi_eng_hasil('MOMENTUM_NY', 'Quantum MomentumNY', false, 'NETRAL', 0, 'Putusan H1 (Recommend.All|60) tidak tersedia.');
        }
        $putusan = qi_eng_putusan($rec);
        $arah = qi_eng_arah($putusan);
        // Konfirmasi momentum: tanda Mom dan AO harus tidak bertentangan.
        $bertentangan = (($arah === 'BUY' && (($mom !== null && $mom < 0) || ($ao !== null && $ao < 0)))
                      || ($arah === 'SELL' && (($mom !== null && $mom > 0) || ($ao !== null && $ao > 0))));
        if ($bertentangan) $arah = 'NETRAL';
        $skor = qi_eng_batas(abs($rec) * 100.0);
        $jam = $jam ?? (int)date('G');
        $sesiNy = ($jam >= 20 || $jam < 2);   // 20:00–01:59 WIB (pembukaan New York)
        $dasar = 'H1: ' . $putusan . ' (skor ' . round($rec, 3) . ')' . ($mom !== null ? (' · Mom ' . round($mom, 5)) : '')
               . ($ao !== null ? (' · AO ' . round($ao, 5)) : '') . ($bertentangan ? ' · momentum bertentangan → NETRAL' : '')
               . ($sesiNy ? ' · sesi New York AKTIF' : ' · di luar sesi New York (bias tetap dilaporkan)');
        return qi_eng_hasil('MOMENTUM_NY', 'Quantum MomentumNY', true, $arah, $skor, $dasar);
    }

    // ── 6. FIBONACCI (golden zone) ─────────────────────────────────────────────
    function qi_eng_fibo(array $c): array
    {
        $harga = qi_eng_angka($c, 'close');
        $hi = qi_eng_angka($c, 'High.1M'); $lo = qi_eng_angka($c, 'Low.1M');
        if ($harga === null || $hi === null || $lo === null || $hi <= $lo) {
            return qi_eng_hasil('FIBO', 'Quantum Fibonacci', false, 'NETRAL', 0, 'Rentang 1 bulan tidak lengkap.');
        }
        $posisi = ($harga - $lo) / ($hi - $lo);            // 0 = di dasar, 1 = di puncak
        $dalamZona = ($posisi >= 0.382 && $posisi <= 0.618);
        $trendNaik = ($harga > (($hi + $lo) / 2));         // separuh atas rentang → bias naik
        $arah = $dalamZona ? ($trendNaik ? 'BUY' : 'SELL') : 'NETRAL';
        // Skor tertinggi di tengah golden zone (0,5).
        $skor = $dalamZona ? qi_eng_batas(100.0 - (abs($posisi - 0.5) / 0.118) * 30.0) : 30.0;
        $dasar = 'Rentang 1 bulan ' . round($lo, 5) . '–' . round($hi, 5) . ' · posisi harga ' . round($posisi * 100, 1) . '%'
               . ($dalamZona ? ' (di dalam golden zone 38,2–61,8%)' : ' (di luar golden zone → menunggu)');
        return qi_eng_hasil('FIBO', 'Quantum Fibonacci', true, $arah, $skor, $dasar);
    }

    // ── 7. SNR (kedekatan ke level nyata TradingView) ──────────────────────────
    function qi_eng_snr(array $c): array
    {
        $harga = qi_eng_angka($c, 'close');
        $atr = qi_eng_angka($c, 'ATR|60') ?? qi_eng_angka($c, 'ATR');
        if ($harga === null || $atr === null || $atr <= 0) {
            return qi_eng_hasil('SNR', 'Quantum SNR', false, 'NETRAL', 0, 'Harga atau ATR tidak tersedia.');
        }
        $level = [
            'High 1 bulan' => qi_eng_angka($c, 'High.1M'), 'Low 1 bulan' => qi_eng_angka($c, 'Low.1M'),
            'High 3 bulan' => qi_eng_angka($c, 'High.3M'), 'Low 3 bulan' => qi_eng_angka($c, 'Low.3M'),
            'High 52 minggu' => qi_eng_angka($c, 'price_52_week_high'), 'Low 52 minggu' => qi_eng_angka($c, 'price_52_week_low'),
            'Pivot bulanan' => qi_eng_angka($c, 'Pivot.M.Classic.Middle'), 'VWAP' => qi_eng_angka($c, 'VWAP'),
        ];
        $terdekat = null; $namaTerdekat = null; $jarakTerdekat = null;
        foreach ($level as $nama => $nilai) {
            if ($nilai === null || $nilai <= 0) continue;
            $jarak = abs($harga - $nilai) / $atr;
            if ($jarakTerdekat === null || $jarak < $jarakTerdekat) { $jarakTerdekat = $jarak; $namaTerdekat = $nama; $terdekat = $nilai; }
        }
        if ($terdekat === null) {
            return qi_eng_hasil('SNR', 'Quantum SNR', false, 'NETRAL', 0, 'Tidak ada level TradingView yang tersedia untuk dibandingkan.');
        }
        $dekat = ($jarakTerdekat <= 0.5);
        // Harga di ATAS level terdekat → level itu menjadi penopang (bias BUY), dan sebaliknya.
        $arah = $dekat ? (($harga >= $terdekat) ? 'BUY' : 'SELL') : 'NETRAL';
        $skor = qi_eng_batas($dekat ? (100.0 - ($jarakTerdekat / 0.5) * 40.0) : 25.0);
        $dasar = 'Level terdekat: ' . $namaTerdekat . ' ' . round($terdekat, 5) . ' (jarak ' . round($jarakTerdekat, 2) . '× ATR)'
               . ($dekat ? ' → harga menempel level nyata' : ' → harga jauh dari level (menunggu)')
               . ' · CATATAN: ini skor kedekatan level, bukan algoritma kekuatan retest mesin klien.';
        return qi_eng_hasil('SNR', 'Quantum SNR', true, $arah, $skor, $dasar);
    }

    // ── 8 & 9. SMC dan ICHIMOKU: TIDAK TERSEDIA (dinyatakan apa adanya) ────────
    function qi_eng_smc(array $c): array
    {
        return qi_eng_hasil('SMC', 'Quantum SMC', false, 'NETRAL', 0,
            'TIDAK dihitung di server: Order Block/FVG/BOS memerlukan riwayat candle OHLC, sedangkan sumber server saat ini adalah snapshot TradingView Scanner. Tidak dikarang.');
    }
    function qi_eng_ichi(array $c): array
    {
        return qi_eng_hasil('ICHI', 'Quantum Ichimoku', false, 'NETRAL', 0,
            'TIDAK dihitung di server: TradingView Scanner tidak menyediakan field Ichimoku (Ichimoku.CONV/BASE/SPANA/SPANB terbukti NULL pada pengukuran 2026-10-13 di XAUUSD, EURUSD, dan BTCUSDT).');
    }

    /**
     * Simpan jejak output mesin untuk satu sinyal (idempoten lewat UNIQUE signal+machine).
     * Mesin yang tidak tersedia TIDAK ditulis — jadi tidak ada baris netral palsu.
     * Tidak pernah melempar exception.
     */
    function qi_eng_simpan_output(string $idSinyal, array $perMesin): int
    {
        if ($idSinyal === '' || !$perMesin) return 0;
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            $pdo = getDBConnection();
            $pdo->query('SELECT 1 FROM `quantum_engine_outputs` LIMIT 1');   // pastikan tabel ada
            $st = $pdo->prepare('INSERT INTO `quantum_engine_outputs` (`signal_id`,`engine_code`,`arah`,`skor`,`dasar`)
                 VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `arah`=VALUES(`arah`), `skor`=VALUES(`skor`), `dasar`=VALUES(`dasar`)');
            $n = 0;
            foreach ($perMesin as $kode => $m) {
                $st->execute([$idSinyal, mb_substr((string)$kode, 0, 50), mb_substr((string)($m['arah'] ?? 'NETRAL'), 0, 10),
                              is_numeric($m['skor'] ?? null) ? round((float)$m['skor'], 2) : null,
                              mb_substr((string)($m['dasar'] ?? ''), 0, 400)]);
                $n++;
            }
            return $n;
        } catch (Throwable $e) {
            @error_log('[engine] simpan output gagal: ' . $e->getMessage());
            return 0;
        }
    }

    /** Matriks lengkap 9 mesin dari satu baris data scanner. */
    function qi_eng_matriks(array $c, ?int $jam = null): array
    {
        return [
            'SNR'          => qi_eng_snr($c),
            'SMC'          => qi_eng_smc($c),
            'EMA200'       => qi_eng_ema200($c),
            'ICHI'         => qi_eng_ichi($c),
            'FIBO'         => qi_eng_fibo($c),
            'TRENM5'       => qi_eng_tren_m5($c),
            'MOMENTUM_NY'  => qi_eng_momentum_ny($c, $jam),
            'MACD_MOM'     => qi_eng_macd($c),
            'GOLDEN_CROSS' => qi_eng_golden_cross($c),
        ];
    }

    /**
     * Konfluensi: hitung mesin yang SEARAH, hanya dari mesin yang benar-benar tersedia.
     * Sesuai spesifikasi Bagian 2: sinyal baru dianggap layak bila minimal 3 mesin setuju.
     */
    function qi_eng_konfluensi(array $matriks, int $minimum = 3): array
    {
        $hitung = ['BUY' => 0, 'SELL' => 0, 'NETRAL' => 0];
        $tersedia = 0; $daftarBuy = []; $daftarSell = [];
        foreach ($matriks as $kode => $m) {
            if (empty($m['tersedia'])) continue;
            $tersedia++;
            $arah = (string)($m['arah'] ?? 'NETRAL');
            $hitung[$arah] = ($hitung[$arah] ?? 0) + 1;
            if ($arah === 'BUY') $daftarBuy[] = $kode;
            if ($arah === 'SELL') $daftarSell[] = $kode;
        }
        $arahDominan = 'NETRAL';
        if ($hitung['BUY'] > $hitung['SELL']) $arahDominan = 'BUY';
        elseif ($hitung['SELL'] > $hitung['BUY']) $arahDominan = 'SELL';
        $jumlah = ($arahDominan === 'BUY') ? $hitung['BUY'] : (($arahDominan === 'SELL') ? $hitung['SELL'] : 0);
        $layak = ($jumlah >= $minimum);
        // Keyakinan dasar dari jumlah mesin searah terhadap mesin yang TERSEDIA.
        $skor = ($tersedia > 0) ? qi_eng_batas($jumlah / $tersedia * 100.0) : 0.0;
        return [
            'tersedia'     => $tersedia,
            'tidak_tersedia' => count($matriks) - $tersedia,
            'arah'         => $arahDominan,
            'jumlah_searah' => $jumlah,
            'hitung'       => $hitung,
            'mesin_buy'    => $daftarBuy,
            'mesin_sell'   => $daftarSell,
            'layak_min_3'  => $layak,
            'skor'         => $skor,
            'dasar'        => $jumlah . ' dari ' . $tersedia . ' mesin yang tersedia setuju ' . $arahDominan
                             . ($layak ? ' (memenuhi syarat minimal ' . $minimum . ' mesin)' : ' (BELUM memenuhi syarat minimal ' . $minimum . ' mesin)')
                             . ' · ' . (count($matriks) - $tersedia) . ' mesin tidak dapat dihitung di server dan TIDAK diikutkan.',
        ];
    }
}
