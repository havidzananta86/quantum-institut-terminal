<?php
/**
 * RENCANA LIVE — Intraday (H1) & Swing (H4/D1) dari data TradingView.
 *
 * Sumber angka (SEMUANYA TradingView — sesuai permintaan "jangan ada data yang meleset"):
 *   · harga acuan  : `close` TradingView (live)
 *   · jarak SL/TP  : `ATR|60` (intraday) / `ATR|240` (swing) — ATR per-timeframe TradingView
 *   · level rujukan: `High.1M`, `Low.1M`, `price_52_week_high`, `price_52_week_low`,
 *                    `Pivot.M.Classic.Middle` (level TradingView sendiri)
 *   · arah         : `Recommend.All|<tf>` + EMA/RSI/MACD TradingView
 *   · ticker       : OANDA untuk emas & forex, BINANCE untuk kripto
 *
 * SIFAT PENTING:
 *   · Rencana ini TIDAK masuk rekor sinyal (statistik tetap bersih; permintaan pengguna).
 *   · Tidak ada angka yang dihitung dari penyedia lain. Bila TradingView tidak memberi
 *     nilai, instrumen itu DILEWATI dengan alasan jujur — bukan diisi angka karangan.
 *   · Mode scalping sengaja belum aktif (menunggu EA MT5 supaya spread nyata terukur).
 *
 * GET ?mode=intraday|swing   (default intraday)
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_rencana.php';

qi_rate_limit(120, 60);

$mode = strtolower(trim((string)($_GET['mode'] ?? 'intraday')));
if (!in_array($mode, ['intraday', 'swing', 'scalping'], true)) $mode = 'intraday';

// ── CACHE 60 DETIK (panel memanggil sekali per menit) ────────────────────────
$cacheDir = __DIR__ . '/../cache/rencana';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = $cacheDir . '/' . $mode . '.json';
$ttl = 60;
if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
    header('X-QI-Cache: HIT');
    echo file_get_contents($cacheFile);
    exit;
}

$instrumen = qi_rl_instrumen($mode);
$tickers = [];
$petaTicker = [];
foreach ($instrumen as $s) {
    $t = qi_rl_ticker($s);
    if ($t !== null) { $tickers[] = $t; $petaTicker[$t] = $s; }
}

if (!$tickers) {
    echo json_encode(['status' => 'error', 'message' => 'Tidak ada instrumen untuk mode ini.'], JSON_PRETTY_PRINT);
    exit;
}

// ── SATU PERMINTAAN KE TRADINGVIEW SCANNER ──────────────────────────────────
// CATATAN NAMA KOLOM (terbukti dari pengukuran 2026-10-13):
//   `Recommend.All`   (TANPA akhiran) = HARIAN.  `Recommend.All|1D` = NULL (tidak sah).
//   `ATR`             (TANPA akhiran) = ATR harian.  `ATR|1D` = NULL.
//   Akhiran yang SAH: |15 |60 |240 |1W. Untuk itu harian memakai kolom tanpa akhiran,
//   dan labelnya ditulis apa adanya sebagai "1D (harian TradingView)" agar tidak menyesatkan.
$kolom = [
    'close', 'change', 'open', 'high', 'low', 'VWAP',
    'ATR|5', 'ATR|15', 'ATR|60', 'ATR|240', 'ATR',
    'Recommend.All|5', 'Recommend.All|15', 'Recommend.All|60', 'Recommend.All|240', 'Recommend.All', 'Recommend.All|1W',
    'EMA20', 'EMA50', 'EMA200', 'RSI', 'RSI|60', 'MACD.macd', 'MACD.signal',
    'High.1M', 'Low.1M', 'High.3M', 'Low.3M', 'High.6M', 'Low.6M',
    'price_52_week_high', 'price_52_week_low', 'Pivot.M.Classic.Middle',
];
$body = json_encode([
    'symbols' => ['tickers' => $tickers, 'query' => ['types' => []]],
    'columns' => $kolom,
], JSON_UNESCAPED_SLASHES);

[$raw, $kode] = qi_tv_scan($body, 12);   // library TradingView-API (bridge) → scanner

$j = json_decode((string)$raw, true);
if ($kode !== 200 || !is_array($j) || !isset($j['data'])) {
    http_response_code(502);
    echo json_encode([
        'status'  => 'error',
        'message' => 'TradingView tidak memberi data saat ini. Rencana tidak dibuat (tidak ada angka pengganti).',
        'kode'    => $kode,
    ], JSON_PRETTY_PRINT);
    exit;
}

$tfAturan = ($mode === 'swing') ? '240' : '60';
$tfLabel  = ($mode === 'swing') ? 'H4' : 'H1';

$plans = [];
foreach ($j['data'] as $baris) {
    $ticker = (string)($baris['s'] ?? '');
    $simbol = $petaTicker[$ticker] ?? $ticker;
    $d = $baris['d'] ?? [];
    if (count($d) !== count($kolom)) continue;
    $c = @array_combine($kolom, $d);
    if (!is_array($c)) continue;

    $harga = is_numeric($c['close'] ?? null) ? (float)$c['close'] : 0.0;
    $atr   = is_numeric($c['ATR|' . $tfAturan] ?? null) ? (float)$c['ATR|' . $tfAturan] : 0.0;
    if ($harga <= 0 || $atr <= 0) {
        $plans[] = ['simbol' => $simbol, 'ticker' => $ticker, 'status' => 'tunggu',
                    'alasan' => 'TradingView tidak memberi harga/ATR ' . $tfLabel . ' untuk instrumen ini.'];
        continue;
    }

    $tf = [
        '15'  => is_numeric($c['Recommend.All|15'] ?? null) ? (float)$c['Recommend.All|15'] : null,
        '60'  => is_numeric($c['Recommend.All|60'] ?? null) ? (float)$c['Recommend.All|60'] : null,
        '240' => is_numeric($c['Recommend.All|240'] ?? null) ? (float)$c['Recommend.All|240'] : null,
        '1D'  => is_numeric($c['Recommend.All'] ?? null) ? (float)$c['Recommend.All'] : null,
        '1W'  => is_numeric($c['Recommend.All|1W'] ?? null) ? (float)$c['Recommend.All|1W'] : null,
    ];
    $ind = [
        'ema20' => $c['EMA20'] ?? null, 'ema50' => $c['EMA50'] ?? null, 'ema200' => $c['EMA200'] ?? null,
        'rsi'   => $c['RSI'] ?? null, 'macd' => $c['MACD.macd'] ?? null, 'macd_signal' => $c['MACD.signal'] ?? null,
    ];

    $bias = qi_rl_bias($tf, $ind, $mode);
    if ($bias['arah'] === 'NETRAL') {
        $plans[] = [
            'simbol' => $simbol, 'ticker' => $ticker, 'status' => 'tunggu',
            'harga' => $harga, 'atr' => round($atr, 6), 'tf' => $tfLabel,
            'putusan_tf' => [
                '15' => qi_rl_putusan($tf['15']), '60' => qi_rl_putusan($tf['60']),
                '240' => qi_rl_putusan($tf['240']), '1D' => qi_rl_putusan($tf['1D']),
                '1W' => qi_rl_putusan($tf['1W']),
            ],
            'alasan' => $bias['alasan'], 'sebab' => $bias['syarat'],
        ];
        continue;
    }

    // Level TradingView sebagai DINDING TP + acuan struktur SL (label Indonesia, jujur).
    // Semua nilai datang apa adanya dari TradingView; tidak ada yang dihitung sendiri.
    $levelTv = [
        'High hari ini'  => $c['high'] ?? null,
        'Low hari ini'   => $c['low'] ?? null,
        'High 1 bulan'   => $c['High.1M'] ?? null,
        'Low 1 bulan'    => $c['Low.1M'] ?? null,
        'High 3 bulan'   => $c['High.3M'] ?? null,
        'Low 3 bulan'    => $c['Low.3M'] ?? null,
        'High 6 bulan'   => $c['High.6M'] ?? null,
        'Low 6 bulan'    => $c['Low.6M'] ?? null,
        'High 52 minggu' => $c['price_52_week_high'] ?? null,
        'Low 52 minggu'  => $c['price_52_week_low'] ?? null,
        'Pivot bulanan'  => $c['Pivot.M.Classic.Middle'] ?? null,
        // VWAP SENGAJA TIDAK dijadikan dinding TP: VWAP adalah harga rata-rata yang
        // dilewati harga terus-menerus, sehingga memakainya sebagai pembatas TP membuat
        // TP1 terpotong terlalu dekat (terbukti: RR1 jatuh ke 0,12–0,36). VWAP disajikan
        // sebagai informasi posisi harga saja (di atas/bawah VWAP).
    ];

    // ACUAN STRUKTUR untuk SL per mode. qi_rl_struktur_sl() yang memilih acuan terdekat
    // yang sah menurut arah (low untuk BUY, high untuk SELL) dan membatasinya agar layak.
    $acuanSl = ($mode === 'swing')
        ? [
            ['nama' => 'Low 1 bulan',   'nilai' => $c['Low.1M'] ?? null],
            ['nama' => 'High 1 bulan',  'nilai' => $c['High.1M'] ?? null],
            ['nama' => 'Low 3 bulan',   'nilai' => $c['Low.3M'] ?? null],
            ['nama' => 'High 3 bulan',  'nilai' => $c['High.3M'] ?? null],
            ['nama' => 'Low 6 bulan',   'nilai' => $c['Low.6M'] ?? null],
            ['nama' => 'High 6 bulan',  'nilai' => $c['High.6M'] ?? null],
          ]
        : [
            ['nama' => 'Low hari ini',  'nilai' => $c['low'] ?? null],
            ['nama' => 'High hari ini', 'nilai' => $c['high'] ?? null],
            ['nama' => 'Low 1 bulan',   'nilai' => $c['Low.1M'] ?? null],
            ['nama' => 'High 1 bulan',  'nilai' => $c['High.1M'] ?? null],
          ];
    $slStruktur = qi_rl_struktur_sl($harga, $atr, $bias['arah'], $mode, $acuanSl);
    // Konfirmasi MINGGUAN (khusus swing): pertentangan mingguan tidak menggugurkan rencana,
    // tetapi WAJIB disebut karena risikonya nyata.
    $peringatanMingguan = [];
    if ($mode === 'swing' && $tf['1W'] !== null) {
        $arahMingguan = qi_rl_arah_label(qi_rl_putusan($tf['1W']));
        if ($arahMingguan !== 'NETRAL' && $arahMingguan !== $bias['arah']) {
            $peringatanMingguan[] = 'Peringatan: putusan MINGGUAN TradingView (' . qi_rl_putusan($tf['1W'])
                . ') berlawanan dengan arah ' . $bias['arah'] . ' — pertimbangkan memperkecil ukuran posisi.';
        }
    }

    $L = qi_rl_level($harga, $atr, $bias['arah'], $mode, $levelTv,
                     $slStruktur['dipakai'] ? $slStruktur['jarak'] : null,
                     $slStruktur['acuan']);
    if (empty($L['ok'])) {
        $plans[] = [
            'simbol' => $simbol, 'ticker' => $ticker, 'status' => 'tunggu', 'arah' => $bias['arah'],
            'harga' => $harga, 'atr' => round($atr, 6), 'tf' => $tfLabel,
            'alasan' => $bias['alasan'], 'sebab' => $L['alasan'] ?? 'Level tidak dapat dihitung.',
            'struktur_sl' => ['dipakai' => $slStruktur['dipakai'], 'catatan' => $slStruktur['catatan']],
        ];
        continue;
    }

    $plans[] = [
        'simbol'    => $simbol,
        'ticker'    => $ticker,
        'status'    => 'siap',
        'arah'      => $bias['arah'],
        'tf'        => $tfLabel,
        'harga'     => round($harga, 6),
        'atr'       => round($atr, 6),
        'entry'     => $L['entry'],
        'sl'        => $L['sl'],
        'tp1'       => $L['tp1'],
        'tp2'       => $L['tp2'],
        'jarak_sl'  => $L['jarak_sl'],
        'rr1'       => $L['rr1'],
        'rr2'       => $L['rr2'],
        'sl_mult'   => $L['sl_mult'],
        'sl_acuan'  => $L['sl_acuan'] ?? null,
        'struktur_sl' => [
            'dipakai' => $slStruktur['dipakai'], 'acuan' => $slStruktur['acuan'],
            'jarak' => $slStruktur['jarak'], 'sl_dasar' => $slStruktur['sl_dasar'],
            'batas' => $slStruktur['batas'], 'catatan' => $slStruktur['catatan'],
        ],
        'tp1_pembatas' => $L['tp1_pembatas'],
        'tp2_pembatas' => $L['tp2_pembatas'],
        'peringatan'   => array_merge($L['peringatan'], $peringatanMingguan),
        'skor'      => $bias['skor'],
        'vwap'      => (isset($c['VWAP']) && is_numeric($c['VWAP']))
            ? ['nilai' => round((float)$c['VWAP'], 6),
               'posisi' => ((float)$c['VWAP'] > 0 && $harga >= (float)$c['VWAP']) ? 'di atas VWAP' : 'di bawah VWAP',
               'catatan' => 'Informasi saja — VWAP bukan penghalang TP.']
            : null,
        'alasan'    => $bias['alasan'],
        'putusan_tf' => [
            '15' => qi_rl_putusan($tf['15']), '60' => qi_rl_putusan($tf['60']),
            '240' => qi_rl_putusan($tf['240']), '1D' => qi_rl_putusan($tf['1D']),
            '1W' => qi_rl_putusan($tf['1W']),
        ],
        'level_tv'  => $levelTv,
    ];
}

// Siap dulu, lalu tunggu — supaya yang bisa ditradingkan tampil paling atas.
usort($plans, function (array $a, array $b): int {
    $as = ($a['status'] === 'siap') ? 0 : 1;
    $bs = ($b['status'] === 'siap') ? 0 : 1;
    if ($as !== $bs) return $as <=> $bs;
    return strcmp((string)($a['simbol'] ?? ''), (string)($b['simbol'] ?? ''));
});

$jawaban = [
    'status'      => 'success',
    'mode'        => $mode,
    'mode_label'  => ($mode === 'swing') ? 'Swing (H4 + bias harian)' : (($mode === 'scalping') ? 'Scalping (menunggu EA)' : 'Intraday (H1)'),
    'dibuat'      => date('c'),
    'berlaku_jam' => qi_rl_expiry_jam($mode),
    'berlaku_sampai' => date('c', time() + qi_rl_expiry_jam($mode) * 3600),
    'sumber'      => [
        'harga'  => 'TradingView Scanner (`close`)',
        'atr'    => 'TradingView Scanner (`ATR|' . $tfAturan . '` = ATR ' . $tfLabel . ')',
        'level'  => 'TradingView Scanner (High/Low 1 bulan · 52 minggu · pivot bulanan)',
        'arah'   => 'TradingView Scanner (`Recommend.All` per timeframe + EMA/RSI/MACD)',
        'ticker' => 'OANDA untuk emas & forex · BINANCE untuk kripto',
    ],
    'kesiapan_scalping' => [
        'catatan' => 'Mode scalping belum diaktifkan (menunggu EA MT5 agar spread & kecepatan eksekusi nyata terukur). Data TradingView-nya sudah tersedia: ATR M5 dan putusan M5 per instrumen.',
    ],
    'dicatat'     => false,
    'catatan'     => 'Rencana ini TIDAK masuk rekor sinyal (agar statistik tetap bersih). '
                   . 'Semua level berasal dari angka TradingView; bila TradingView tidak memberi nilai, '
                   . 'instrumen itu dilewati dengan alasan jujur — tidak ada angka pengganti.',
    'jumlah_siap' => count(array_filter($plans, fn($p) => ($p['status'] ?? '') === 'siap')),
    'plans'       => $plans,
];

$teks = json_encode($jawaban, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheFile, $teks, LOCK_EX);
header('X-QI-Cache: MISS');
echo $teks;
