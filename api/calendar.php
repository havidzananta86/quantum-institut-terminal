<?php
/**
 * Quantum Institut Market Terminal - Economic Calendar Aggregator API
 * Aggregates ForexFactory, FMP, TradingEconomics, and Investing.com calendars.
 * Normalizes impact levels, currency filters, and caches results in cache/calendar.json for 5 minutes.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

// Rate limit: 60 req/min
qi_rate_limit(60, 60);

$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$cacheFile = $cacheDir . '/calendar.json';
$cacheTime = 300; // 5 minutes TTL

// Check cached data
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
    echo file_get_contents($cacheFile);
    exit();
}

$events = [];

// 1. Fetch ForexFactory JSON Calendar Feed (Official Free Feed)
try {
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'header' => "User-Agent: QuantumInstitut/4.2\r\n"
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true
        ]
    ]);

    $ffContent = @file_get_contents('https://nfs.faireconomy.media/ff_calendar_thisweek.json', false, $context);
    if ($ffContent !== false) {
        $ffData = json_decode($ffContent, true);
        if (is_array($ffData)) {
            foreach ($ffData as $e) {
                $events[] = [
                    'id' => 'ff_' . md5($e['title'] . $e['date']),
                    'source' => 'ForexFactory',
                    'title' => $e['title'],
                    'country' => strtoupper($e['country']),
                    'currency' => strtoupper($e['country']),
                    'date' => $e['date'],
                    'impact' => strtolower($e['impact']), // 'high', 'medium', 'low', 'holiday'
                    'forecast' => isset($e['forecast']) && $e['forecast'] !== '' ? $e['forecast'] : '-',
                    'previous' => isset($e['previous']) && $e['previous'] !== '' ? $e['previous'] : '-',
                    'actual' => isset($e['actual']) && $e['actual'] !== '' ? $e['actual'] : '-',
                ];
            }
        }
    }
} catch (Exception $ex) {
    // Fallback error handling
}

// 2. FALLBACK YANG JUJUR.
//
// ⚠️ Sebelumnya di sini dibuat 5 event CONTOH ("Core CPI", NFP, ECB, BOE, Unemployment)
// yang diberi label source='ForexFactory' dan tanggal relatif terhadap waktu sekarang —
// termasuk satu event High impact yang seolah rilis 20 MENIT LAGI. Itu berbahaya:
//   · filter berita bisa MENAHAN sinyal nyata karena berita palsu, dan
//   · pemantau sinyal berita bisa MENERBITKAN sinyal dari event palsu.
// Karena itu pembuatan event contoh DIHAPUS TOTAL.
//
// Yang dilakukan sekarang bila sumber gagal:
//   · pakai cache NYATA terakhir (bila ada) dan sebutkan umurnya apa adanya, ATAU
//   · kembalikan daftar KOSONG dengan status 'gagal' + alasan jujur.
// Cache yang baik TIDAK ditimpa oleh hasil gagal, sehingga percobaan berikutnya
// masih bisa menyajikan data nyata.
if (empty($events)) {
    $cacheLama = null;
    if (is_file($cacheFile)) {
        $lama = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($lama) && !empty($lama['data']) && is_array($lama['data'])) {
            $sah = true; $jumlah = 0;
            foreach ($lama['data'] as $e) {
                if (!is_array($e)) continue;
                $jumlah++;
                // Tolak bila ternyata berisi sisa data contoh (id 'evt_').
                if (strpos((string)($e['id'] ?? ''), 'evt_') === 0) { $sah = false; break; }
            }
            if ($sah && $jumlah > 0) $cacheLama = $lama;
        }
    }

    if ($cacheLama !== null) {
        $umurMenit = (int)round((time() - (int)@filemtime($cacheFile)) / 60);
        $cacheLama['status']         = 'basi';
        $cacheLama['sumber_basi']    = true;
        $cacheLama['umur_menit']     = $umurMenit;
        $cacheLama['catatan']        = 'Sumber kalender sedang tidak dapat dihubungi. Yang ditampilkan adalah data NYATA '
            . 'terakhir (umur ' . $umurMenit . ' menit). Tidak ada event contoh yang ditambahkan.';
        echo json_encode($cacheLama, JSON_PRETTY_PRINT);
        exit();
    }

    echo json_encode([
        'status'                => 'gagal',
        'timestamp'             => date('Y-m-d H:i:s'),
        'count'                 => 0,
        'cache_expires_in_sec'  => $cacheTime,
        'data'                  => [],
        'catatan'               => 'Kalender ekonomi tidak dapat diambil dan belum ada data nyata tersimpan. '
            . 'Daftar sengaja dikosongkan — event contoh TIDAK dibuat karena bisa memicu sinyal palsu.',
    ], JSON_PRETTY_PRINT);
    exit();
}

// 3. Sort chronologically by date
usort($events, function($a, $b) {
    return strtotime($a['date']) - strtotime($b['date']);
});

$result = [
    'status' => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'count' => count($events),
    'cache_expires_in_sec' => $cacheTime,
    'data' => $events
];

$jsonOutput = json_encode($result, JSON_PRETTY_PRINT);
@file_put_contents($cacheFile, $jsonOutput);

echo $jsonOutput;
