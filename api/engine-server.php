<?php
declare(strict_types=1);
/**
 * MESIN 9 DI SERVER — endpoint (Tahap 3).
 *
 * GET api/engine-server.php?symbol=XAUUSD
 *
 * Mengembalikan matriks 9 mesin yang dihitung SERVER + ringkasan konfluensi, sehingga
 * alasan sebuah sinyal dapat diaudit (mesin mana yang setuju, atas dasar angka apa).
 *
 * KEJUJURAN:
 *   · Mesin yang tidak dapat dihitung (SMC, ICHI) dikembalikan tersedia=false BESERTA
 *     alasannya — bukan angka netral yang terlihat seperti "tidak setuju".
 *   · Nilai mentah TradingView yang dipakai ikut dikirim ('sumber') supaya bisa
 *     dibandingkan langsung dengan TradingView oleh siapa pun.
 *   · Tanda is_pro_only diambil dari tabel quantum_engines (9 mesin resmi platform).
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_engine_server.php';
qi_rate_limit(60, 60);
qi_require_auth();

function es_jawab(int $kode, array $data): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$simbol = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['symbol'] ?? $_GET['simbol'] ?? '')));
if ($simbol === '') es_jawab(400, ['status' => 'error', 'message' => 'Sertakan parameter symbol, mis. ?symbol=XAUUSD.']);

// Peta simbol → ticker TradingView (OANDA untuk emas/forex, BINANCE untuk kripto).
// Peta ticker + daftar kolom + pengambilan data kini BERSAMA dengan modul gerbang
// (api/_engine_server.php): qi_eng_ticker(), qi_eng_kolom(), qi_eng_snapshot().
// Sebelumnya blok ini disalin di dua tempat — duplikasi seperti itu pernah membuat
// perbaikan (kolom Recommend.All harian) hanya masuk ke satu tempat.
$tv = qi_eng_ticker($simbol);
if ($tv === null) es_jawab(400, ['status' => 'error', 'message' => 'Simbol "' . $simbol . '" belum dipetakan ke sumber data.']);

$c = qi_eng_snapshot($simbol, 30);
if ($c === null) {
    es_jawab(502, ['status' => 'error', 'message' => 'Sumber data TradingView tidak dapat dihubungi atau bentuk datanya tidak sesuai — analisa TIDAK dijalankan (tidak ada angka yang dikarang).']);
}

$jam = (int)date('G');
$matriks = qi_eng_matriks($c, $jam);
$konfluensi = qi_eng_konfluensi($matriks);

// Tanda PRO diambil dari tabel mesin resmi platform (bukan dikarang di kode).
$proOnly = [];
try {
    if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
    foreach (getDBConnection()->query('SELECT `code`, `is_pro_only` FROM `quantum_engines`')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $proOnly[(string)$r['code']] = ((int)$r['is_pro_only'] === 1);
    }
} catch (Throwable $e) {
    @error_log('[engine-server] tabel quantum_engines tidak terbaca: ' . $e->getMessage());
}
foreach ($matriks as $kode2 => $m) {
    $matriks[$kode2]['pro_only'] = $proOnly[$kode2] ?? null;
}

// Nilai mentah yang dipakai — supaya bisa dibandingkan langsung dengan TradingView.
$sumber = [];
foreach (['close','EMA50','EMA200','MACD.macd','MACD.signal','ATR|60','VWAP','Low.1M','High.1M','Recommend.All|5','Recommend.All|60','Mom|60','AO'] as $k) {
    $sumber[$k] = $c[$k] ?? null;
}

// Tabel multi-timeframe M1..W1 (Bagian 7). Semua akhiran ini TERBUKTI tersedia di
// TradingView Scanner (diukur 2026-10-13). CATATAN: harian memakai kolom TANPA akhiran,
// karena 'Recommend.All|1D' terbukti NULL.
$tfPeta = ['M1' => 'Recommend.All|1', 'M5' => 'Recommend.All|5', 'M15' => 'Recommend.All|15',
           'M30' => 'Recommend.All|30', 'H1' => 'Recommend.All|60', 'H4' => 'Recommend.All|240',
           'D1' => 'Recommend.All', 'W1' => 'Recommend.All|1W'];
$tabelTf = [];
foreach ($tfPeta as $nama => $kunci) {
    $nilai = qi_eng_angka($c, $kunci);
    $tabelTf[$nama] = [
        'skor'    => $nilai,
        'putusan' => qi_eng_putusan($nilai),
        'arah'    => qi_eng_arah(qi_eng_putusan($nilai)),
    ];
}
$hitungTf = ['BUY' => 0, 'SELL' => 0, 'NETRAL' => 0, 'TIDAK_ADA' => 0];
foreach ($tabelTf as $t) { $hitungTf[$t['putusan'] === 'TIDAK_ADA' ? 'TIDAK_ADA' : $t['arah']]++; }

es_jawab(200, [
    'status'      => 'ok',
    'symbol'      => $simbol,
    'ticker'      => $tv,
    'harga'       => qi_eng_angka($c, 'close'),
    'jam_server'  => $jam,
    'matriks'     => $matriks,
    'konfluensi'  => $konfluensi,
    'multi_tf'    => $tabelTf,
    'multi_tf_hitung' => $hitungTf,
    'sumber'      => $sumber,
    'catatan'     => 'Semua angka dari TradingView Scanner. 7 mesin dapat dihitung di server; SMC dan Ichimoku TIDAK dapat dihitung dari snapshot scanner dan dinyatakan tidak tersedia (bukan dikarang).',
    'dibuat'      => date('c'),
]);
