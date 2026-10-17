<?php
/**
 * MESIN RENCANA LIVE (Intraday · Swing) — SELURUH ANGKA DARI TRADINGVIEW.
 *
 * Prinsip yang dipegang (permintaan pengguna: "jangan ada data yang meleset"):
 *   1. HARGA ACUAN  : `close` dari TradingView Scanner (live) — bukan harga penyedia lain.
 *   2. JARAK SL/TP  : ATR **per-timeframe milik TradingView** (`ATR|60`, `ATR|240`).
 *      Contoh terbukti: XAUUSD ATR H1 = 10,99 vs ATR harian = 79,86 — memakai yang harian
 *      untuk intraday akan membuat SL ~7× terlalu lebar, jadi TF-nya WAJIB eksplisit.
 *   3. LEVEL RUJUKAN: level TradingView sendiri (High/Low 1 bulan, 52-minggu, pivot bulanan)
 *      dipakai sebagai pembatas TP2 supaya target tidak melewati tembok yang nyata.
 *   4. ARAH         : putusan per-timeframe TradingView (`Recommend.All|<tf>`) + EMA/RSI/MACD
 *      dengan ambang yang SAMA seperti Signal Matrix (≥0,5 kuat · ≥0,1 lemah).
 *   5. STRUKTUR     : hanya dipakai bila candle pembanding TERBUKTI sepakat dengan harga
 *      TradingView (uji kesepakatan). Bila tidak sepakat → struktur DIBUANG dan SL memakai
 *      ATR TradingView saja, dengan label jujur (tidak ada angka karangan).
 *   6. TIDAK DICATAT: rencana ini tidak menulis ke rekor sinyal (statistik tetap bersih).
 *
 * Semua fungsi di berkas ini MURNI (tanpa jaringan) supaya bisa diuji dengan hitungan tangan.
 */

/** Ambang putusan TradingView — disamakan dengan api/tv-scan.php agar konsisten. */
function qi_rl_putusan(?float $nilai): string
{
    if ($nilai === null || !is_finite($nilai)) return 'TIDAK_ADA';
    if ($nilai >= 0.5)  return 'STRONG_BUY';
    if ($nilai >= 0.1)  return 'BUY';
    if ($nilai <= -0.5) return 'STRONG_SELL';
    if ($nilai <= -0.1) return 'SELL';
    return 'NEUTRAL';
}

/** Apakah label putusan berarti naik / turun (STRONG_* termasuk). */
function qi_rl_arah_label(string $label): string
{
    if (strpos($label, 'BUY') !== false)  return 'BUY';
    if (strpos($label, 'SELL') !== false) return 'SELL';
    return 'NETRAL';
}

/**
 * Susun BIAS untuk sebuah mode dari data TradingView.
 *
 * @param array $tf   mis. ['60' => 0.18, '240' => -0.09, '1D' => -0.39] (Recommend.All|<tf>)
 * @param array $ind  ['ema20'=>…, 'ema50'=>…, 'ema200'=>…, 'rsi'=>…, 'macd'=>…, 'macd_signal'=>…]
 * @param string $mode 'intraday' | 'swing' | 'scalping'
 * @return array{arah:string,skor:int,alasan:array<string>,syarat:string}
 */
function qi_rl_bias(array $tf, array $ind, string $mode): array
{
    $alasan = [];
    $angka = static function ($v): ?float { return (is_numeric($v)) ? (float)$v : null; };

    if ($mode === 'scalping') {
        return [
            'arah' => 'NETRAL', 'skor' => 0,
            'alasan' => ['Mode scalping belum diaktifkan: menunggu EA MT5 tersambung supaya spread & kecepatan eksekusi nyata dapat diukur.'],
            'syarat' => 'menunggu EA',
        ];
    }

    // Timeframe penentu per mode (WAJIB eksplisit, bukan disamakan).
    $tfPenentu = ($mode === 'swing') ? '240' : '60';
    $labelPenentu = qi_rl_putusan($angka($tf[$tfPenentu] ?? null));
    $arahPenentu = qi_rl_arah_label($labelPenentu);
    $labelBiasTinggi = qi_rl_putusan($angka($tf['1D'] ?? null));
    $arahBiasTinggi = qi_rl_arah_label($labelBiasTinggi);

    $alasan[] = 'TradingView ' . (($mode === 'swing') ? 'H4' : 'H1') . ': ' . $labelPenentu;
    $alasan[] = 'TradingView 1D: ' . $labelBiasTinggi;

    if ($mode === 'swing') {
        $alasan[] = 'TradingView H1: ' . qi_rl_putusan($angka($tf['60'] ?? null));
    }

    // Syarat tegas 1: timeframe penentu tidak boleh NETRAL.
    if ($arahPenentu === 'NETRAL') {
        return ['arah' => 'NETRAL', 'skor' => 0, 'alasan' => $alasan,
                'syarat' => 'Timeframe penentu (' . (($mode === 'swing') ? 'H4' : 'H1') . ') belum memberi arah.'];
    }
    // Syarat tegas 2: ANTI COUNTER-TREND — tidak boleh melawan bias 1D.
    if ($arahBiasTinggi !== 'NETRAL' && $arahBiasTinggi !== $arahPenentu) {
        return ['arah' => 'NETRAL', 'skor' => 0, 'alasan' => $alasan,
                'syarat' => 'Ditolak: ' . (($mode === 'swing') ? 'H4' : 'H1') . ' ' . $arahPenentu
                          . ' berlawanan dengan bias 1D ' . $arahBiasTinggi . ' (aturan anti counter-trend).'];
    }
    // Syarat tegas 3 (khusus swing): H4 dan 1D harus SEPAKAT.
    if ($mode === 'swing' && $arahBiasTinggi === 'NETRAL') {
        return ['arah' => 'NETRAL', 'skor' => 0, 'alasan' => $alasan,
                'syarat' => 'Ditolak: bias 1D belum jelas, sedangkan swing menuntut H4 dan 1D sepakat.'];
    }

    // Skor konfirmasi (0–4) dari indikator TradingView.
    $skor = 0;
    $ema20 = $angka($ind['ema20'] ?? null);
    $ema50 = $angka($ind['ema50'] ?? null);
    $ema200 = $angka($ind['ema200'] ?? null);
    $rsi = $angka($ind['rsi'] ?? null);
    $macd = $angka($ind['macd'] ?? null);
    $macdS = $angka($ind['macd_signal'] ?? null);

    if ($ema20 !== null && $ema50 !== null) {
        $bull = $ema20 > $ema50;
        $cocok = (($arahPenentu === 'BUY') === $bull);
        if ($cocok) $skor++;
        $alasan[] = 'EMA20 ' . ($bull ? '>' : '<') . ' EMA50 (TradingView) → ' . ($cocok ? 'mendukung' : 'bertentangan');
    }
    if ($ema200 !== null && $ema50 !== null) {
        $bull200 = $ema50 > $ema200;
        $cocok200 = (($arahPenentu === 'BUY') === $bull200);
        if ($cocok200) $skor++;
        $alasan[] = 'EMA50 ' . ($bull200 ? '>' : '<') . ' EMA200 (TradingView) → ' . ($cocok200 ? 'mendukung' : 'bertentangan');
    }
    if ($rsi !== null) {
        $cocokRsi = ($arahPenentu === 'BUY') ? ($rsi >= 50) : ($rsi <= 50);
        if ($cocokRsi) $skor++;
        $alasan[] = 'RSI ' . round($rsi, 2) . ' (TradingView) → ' . ($cocokRsi ? 'mendukung' : 'bertentangan');
    }
    if ($macd !== null && $macdS !== null) {
        $cocokMacd = ($arahPenentu === 'BUY') ? ($macd > $macdS) : ($macd < $macdS);
        if ($cocokMacd) $skor++;
        $alasan[] = 'MACD ' . ($macd > $macdS ? '>' : '<') . ' signal (TradingView) → ' . ($cocokMacd ? 'mendukung' : 'bertentangan');
    }

    return [
        'arah' => $arahPenentu,
        'skor' => $skor,
        'alasan' => $alasan,
        'syarat' => 'Sepakat dengan bias 1D.',
    ];
}

/**
 * SL BERBASIS STRUKTUR TRADINGVIEW — memperlebar SL agar berada di luar zona likuiditas.
 *
 * KENAPA: SL yang hanya 1,2×ATR sering berada TEPAT di tempat stop-hunt. TradingView
 * sendiri menyediakan acuan struktur (low/high HARI INI untuk intraday, low/high
 * 1–6 bulan untuk swing), jadi kita bisa menaruh SL **di balik acuan itu** + buffer.
 *
 * KEJUJURAN & PENGAMAN:
 *   · Hanya MEMPERLEBAR SL — tidak pernah mempersempit di bawah ATR (mencegah SL noise).
 *   · Dibatasi (intraday ≤ 2,0× SL dasar · swing ≤ 2,5×) supaya rencana tetap layak
 *     diperdagangkan. Bila acuan struktur terlalu jauh, ATR yang dipakai dan alasannya
 *     DITULIS APA ADANYA (tidak dipaksa).
 *   · Tidak ada angka tambahan di luar data TradingView yang diberikan.
 *
 * @param float  $harga  harga acuan (TradingView close)
 * @param float  $atr    ATR timeframe mode (TradingView)
 * @param string $arah   'BUY' | 'SELL'
 * @param string $mode   'intraday' | 'swing' | 'scalping'
 * @param array  $acuan  daftar acuan struktur: [ ['nama'=>'low hari ini','nilai'=>4150.785], … ]
 * @return array{jarak:?float,acuan:?string,sl_dasar:float,batas:float,dipakai:bool,catatan:string}
 */
function qi_rl_struktur_sl(float $harga, float $atr, string $arah, string $mode, array $acuan): array
{
    $slMult = ($mode === 'swing') ? 1.5 : (($mode === 'scalping') ? 1.0 : 1.2);
    $batasKali = ($mode === 'swing') ? 2.5 : 2.0;      // batas atas agar tetap layak
    $slDasar = $slMult * $atr;
    $batas = $batasKali * $slDasar;

    $keluar = ['jarak' => null, 'acuan' => null, 'sl_dasar' => round($slDasar, 6), 'batas' => round($batas, 6),
               'dipakai' => false, 'catatan' => 'SL memakai ATR TradingView.'];
    if ($harga <= 0 || $atr <= 0 || ($arah !== 'BUY' && $arah !== 'SELL') || !$acuan) return $keluar;

    // Buffer 0,25×ATR supaya SL berada DI BALIK acuan, bukan tepat di acuan.
    $buffer = 0.25 * $atr;
    $kandidat = [];
    foreach ($acuan as $a) {
        if (!is_array($a)) continue;
        $nilai = $a['nilai'] ?? null;
        if (!is_numeric($nilai)) continue;
        $v = (float)$nilai;
        if ($v <= 0) continue;
        // Untuk BUY: acuan harus DI BAWAH harga (low). Untuk SELL: DI ATAS harga (high).
        $sah = ($arah === 'BUY') ? ($v < $harga) : ($v > $harga);
        if (!$sah) continue;
        $jarak = abs($harga - $v) + $buffer;
        $kandidat[] = ['nama' => (string)($a['nama'] ?? 'acuan'), 'jarak' => $jarak];
    }
    if (!$kandidat) return $keluar;

    // Pilih acuan TERDEKAT yang masih lebih lebar dari SL dasar (SL tidak boleh menyempit).
    usort($kandidat, fn($x, $y) => $x['jarak'] <=> $y['jarak']);
    foreach ($kandidat as $k) {
        if ($k['jarak'] <= $slDasar) continue;                  // lebih sempit → tidak dipakai
        if ($k['jarak'] > $batas) {                             // terlalu jauh → jangan dipaksa
            return ['jarak' => null, 'acuan' => null, 'sl_dasar' => round($slDasar, 6), 'batas' => round($batas, 6),
                    'dipakai' => false,
                    'catatan' => 'Acuan struktur TradingView (' . $k['nama'] . ') terlalu jauh ('
                               . round($k['jarak'], 6) . ' > batas ' . round($batas, 6)
                               . ') → SL memakai ATR TradingView.'];
        }
        return ['jarak' => round($k['jarak'], 6), 'acuan' => $k['nama'], 'sl_dasar' => round($slDasar, 6),
                'batas' => round($batas, 6), 'dipakai' => true,
                'catatan' => 'SL diletakkan di balik ' . $k['nama'] . ' + buffer 0,25×ATR TradingView.'];
    }
    return $keluar;
}

/**
 * Hitung level Entry / SL / TP1 / TP2 dari ATR TradingView + level TradingView.
 *
 * @param float  $harga  harga acuan (TradingView `close`)
 * @param float  $atr    ATR TradingView pada timeframe mode
 * @param string $arah   'BUY' | 'SELL'
 * @param string $mode   'intraday' | 'swing'
 * @param array  $level  ['High 1 bulan'=>…, 'Low hari ini'=>…, …] (label → nilai)
 * @param ?float $slStrukturJarak jarak SL dari struktur (opsional; hanya bila candle sepakat)
 * @param ?string $slStrukturAcuan nama acuan struktur (untuk keterangan jujur)
 * @return array
 */
function qi_rl_level(float $harga, float $atr, string $arah, string $mode, array $level = [], ?float $slStrukturJarak = null, ?string $slStrukturAcuan = null): array
{
    if ($harga <= 0 || $atr <= 0 || ($arah !== 'BUY' && $arah !== 'SELL')) {
        return ['ok' => false, 'alasan' => 'Harga/ATR/arah tidak sah — rencana tidak dibuat.'];
    }

    $slMult   = ($mode === 'swing') ? 1.5 : 1.2;   // SL = kelipatan ATR TradingView
    $tpMult   = ($mode === 'swing') ? 3.0 : 2.5;   // TP2 = kelipatan jarak SL (batas atas)
    $jarakSl  = $slMult * $atr;

    // Struktur (bila tersedia & lolos uji kesepakatan) hanya boleh MEMPERLEBAR SL,
    // tidak pernah mempersempit di bawah ATR (mencegah SL kena noise).
    $pakaiStruktur = false;
    if ($slStrukturJarak !== null && is_finite($slStrukturJarak) && $slStrukturJarak > $jarakSl) {
        $jarakSl = $slStrukturJarak;
        $pakaiStruktur = true;
    }

    $tanda = ($arah === 'BUY') ? 1 : -1;
    $entry = $harga;
    $sl    = $harga - $tanda * $jarakSl;
    $tp1Ideal = $harga + $tanda * $jarakSl;             // TP1 ideal = 1R
    $tp2Ideal = $harga + $tanda * ($tpMult * $jarakSl);

    // ── LEVEL TRADINGVIEW SEBAGAI TEMBOK NYATA ────────────────────────────────
    // 1. Level SEARAH antara entry dan TP1 ideal → TP1 DIPOTONG ke level itu.
    //    Alasannya praktis: level kuat sebelum TP1 membuat TP1 sering tak tercapai.
    // 2. Level SEARAH setelah TP1 → membatasi TP2.
    // 3. Level BERLAWAN arah antara entry dan SL → diperingatkan (harga bisa tersentuh
    //    lebih dulu), dan bila terlalu dekat (< 0,3×jarak SL) rencana DITOLAK.
    $tp1      = $tp1Ideal;
    $batasTp1 = null;
    $tp2      = $tp2Ideal;
    $pembatas = 'ATR TradingView (' . $tpMult . 'R)';
    $peringatan = [];

    $levelsSah = [];
    foreach ($level as $nama => $nilai) {
        if (!is_numeric($nilai)) continue;
        $v = (float)$nilai;
        if ($v > 0) $levelsSah[$nama] = $v;
    }
    $diAntara = static function (float $v, float $a, float $b): bool {
        $min = min($a, $b); $max = max($a, $b);
        return $v > $min && $v < $max;
    };

    // a) potong TP1 bila ada level searah di antaranya
    foreach ($levelsSah as $nama => $v) {
        $searah = ($arah === 'BUY') ? ($v > $entry) : ($v < $entry);
        if (!$searah) continue;
        if ($diAntara($v, $entry, $tp1Ideal)) {
            if ($batasTp1 === null || abs($v - $entry) < abs($batasTp1['nilai'] - $entry)) {
                $batasTp1 = ['nama' => $nama, 'nilai' => $v];
            }
        }
    }
    if ($batasTp1 !== null) { $tp1 = $batasTp1['nilai']; }

    // b) potong TP2 dengan level searah terdekat yang berada setelah TP1
    $kandidatTp2 = [];
    foreach ($levelsSah as $nama => $v) {
        $searah = ($arah === 'BUY') ? ($v > $tp1) : ($v < $tp1);
        if ($searah) $kandidatTp2[$nama] = $v;
    }
    if ($kandidatTp2) {
        $namaTerdekat = null; $nilaiTerdekat = null;
        foreach ($kandidatTp2 as $nama => $v) {
            if ($nilaiTerdekat === null || abs($v - $tp1) < abs($nilaiTerdekat - $tp1)) { $namaTerdekat = $nama; $nilaiTerdekat = $v; }
        }
        if ($nilaiTerdekat !== null) {
            $lebihDekatDariIdeal = ($arah === 'BUY') ? ($nilaiTerdekat < $tp2Ideal) : ($nilaiTerdekat > $tp2Ideal);
            if ($lebihDekatDariIdeal) { $tp2 = $nilaiTerdekat; $pembatas = 'level TradingView: ' . $namaTerdekat; }
        }
    }

    // c) PERINGATKAN level berlawanan arah yang di dalam rentang SL.
    //    PENTING (koreksi rancangan): ini TIDAK menggugurkan rencana. Alasannya, SL sudah
    //    diletakkan DI LUAR struktur TradingView (lihat qi_rl_struktur_sl), sehingga wajar
    //    bila ada level di antara harga dan SL. Yang tidak layak hanyalah TP1 yang terhalang
    //    terlalu dekat (diperiksa di bawah lewat rr1 < 0,5). Acuan yang SUDAH dipakai sebagai
    //    dasar SL tidak diulang sebagai peringatan agar tidak membingungkan.
    foreach ($levelsSah as $nama => $v) {
        $berlawanan = ($arah === 'BUY') ? ($v < $entry) : ($v > $entry);
        if (!$berlawanan) continue;
        if ($slStrukturAcuan !== null && strcasecmp(trim($slStrukturAcuan), trim($nama)) === 0) continue;
        if ($diAntara($v, $entry, $sl)) {
            $peringatan[] = 'Level TradingView ' . $nama . ' (' . $v . ') berada di antara harga dan SL (jarak '
                . round(abs($v - $entry), 5) . ') — harga bisa menyentuhnya lebih dulu sebelum mencapai TP.';
        }
    }

    $rr1 = abs($tp1 - $entry) / max(abs($entry - $sl), 1e-12);
    $rr2 = abs($tp2 - $entry) / max(abs($entry - $sl), 1e-12);

    // TP1 yang terpotong terlalu dekat (RR < 0,5) tidak layak diperdagangkan.
    if ($rr1 < 0.5) {
        return ['ok' => false,
                'alasan' => 'Ditolak: TP1 terpotong level TradingView ' . ($batasTp1['nama'] ?? '?')
                          . ' sehingga tinggal ' . round($rr1, 2) . 'R — tidak sepadan dengan risiko.'];
    }

    return [
        'ok'             => true,
        'entry'          => round($entry, 6),
        'sl'             => round($sl, 6),
        'tp1'            => round($tp1, 6),
        'tp2'            => round($tp2, 6),
        'jarak_sl'       => round($jarakSl, 6),
        'rr1'            => round($rr1, 2),
        'rr2'            => round($rr2, 2),
        'sl_mult'        => $slMult,
        'sl_pakai_struktur' => $pakaiStruktur,
        'sl_acuan'       => $pakaiStruktur
            ? ($slStrukturAcuan ?: 'struktur TradingView')
            : ('ATR TradingView (' . number_format($slMult, 1, ',', '.') . '× ATR ' . (($mode === 'swing') ? 'H4' : (($mode === 'scalping') ? 'M5' : 'H1')) . ')'),
        'tp2_pembatas'   => $pembatas,
        'tp1_pembatas'   => $batasTp1 ? ('level TradingView: ' . $batasTp1['nama']) : null,
        'peringatan'     => $peringatan,
    ];
}

/**
 * Uji KESEPAKATAN sumber candle dengan harga TradingView.
 * Dipakai HANYA untuk memutuskan boleh-tidaknya memakai struktur. Bila tidak sepakat,
 * struktur dibuang (bukan dipaksa) — inilah penjaga "jangan ada data yang meleset".
 *
 * @return array{sepakat:bool,selisih_relatif:?float,catatan:string}
 */
function qi_rl_cek_sumber(?float $hargaCandle, float $hargaTv, float $toleransiPersen = 0.02): array
{
    if ($hargaTv <= 0) {
        return ['sepakat' => false, 'selisih_relatif' => null, 'catatan' => 'Harga TradingView tidak tersedia.'];
    }
    if ($hargaCandle === null || !is_finite($hargaCandle) || $hargaCandle <= 0) {
        return ['sepakat' => false, 'selisih_relatif' => null,
                'catatan' => 'Candle pembanding tidak tersedia → struktur tidak dipakai (SL memakai ATR TradingView).'];
    }
    $rel = abs($hargaCandle - $hargaTv) / $hargaTv * 100.0;
    $sepakat = $rel <= $toleransiPersen;
    return [
        'sepakat' => $sepakat,
        'selisih_relatif' => round($rel, 4),
        'catatan' => $sepakat
            ? ('Candle pembanding sepakat dengan TradingView (selisih ' . round($rel, 4) . '%).')
            : ('Candle pembanding TIDAK sepakat dengan TradingView (selisih ' . round($rel, 4)
               . '% > toleransi ' . $toleransiPersen . '%) → struktur dibuang, SL memakai ATR TradingView.'),
    ];
}

/** Masa berlaku rencana per mode (jam). */
function qi_rl_expiry_jam(string $mode): int
{
    if ($mode === 'swing') return 96;   // 4 hari (H4/D1)
    if ($mode === 'scalping') return 2; // bila kelak diaktifkan
    return 8;                           // intraday (H1)
}

/** Daftar instrumen per mode (sesuai persetujuan pengguna). */
function qi_rl_instrumen(string $mode): array
{
    if ($mode === 'scalping') return ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSDT'];
    if ($mode === 'swing')    return ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT'];
    return ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT'];   // intraday
}

/** Peta simbol aplikasi → ticker TradingView (OANDA untuk emas/forex, BINANCE untuk kripto). */
function qi_rl_ticker(string $simbol): ?string
{
    $s = strtoupper(trim($simbol));
    $peta = [
        'XAUUSD' => 'OANDA:XAUUSD', 'XAGUSD' => 'OANDA:XAGUSD',
        'EURUSD' => 'OANDA:EURUSD', 'GBPUSD' => 'OANDA:GBPUSD', 'USDJPY' => 'OANDA:USDJPY',
        'AUDUSD' => 'OANDA:AUDUSD', 'USDCHF' => 'OANDA:USDCHF', 'NZDUSD' => 'OANDA:NZDUSD',
        'USDCAD' => 'OANDA:USDCAD', 'EURJPY' => 'OANDA:EURJPY', 'GBPJPY' => 'OANDA:GBPJPY',
        'BTCUSDT' => 'BINANCE:BTCUSDT', 'ETHUSDT' => 'BINANCE:ETHUSDT',
        'SOLUSDT' => 'BINANCE:SOLUSDT', 'BNBUSDT' => 'BINANCE:BNBUSDT', 'XRPUSDT' => 'BINANCE:XRPUSDT',
        'DOGEUSDT' => 'BINANCE:DOGEUSDT', 'DXY' => 'TVC:DXY',
    ];
    return $peta[$s] ?? null;
}
