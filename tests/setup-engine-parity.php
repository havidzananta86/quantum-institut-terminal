<?php
/**
 * Pembantu tes paritas: membaca kasus dari berkas JSON (argumen 1), menjalankan QiSetupEngine
 * (api/_setup_engine.php) untuk keempat metode, dan mencetak hasilnya sebagai JSON.
 * Dipakai oleh tests/setup-engine-parity.test.js, yang membandingkannya dengan qim-setups.js.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_setup_engine.php';
$in = json_decode((string)file_get_contents($argv[1]), true);
$out = [];
foreach ($in['cases'] as $k) {
    $baris = [];
    foreach (QiSetupEngine::METODE as $m) {
        $r = QiSetupEngine::deteksi($m, $k['candles'], ['presisi' => (int)$k['presisi']]);
        $baris[$m] = ['catatan' => $r['catatan'] ?? null, 'setups' => array_map(fn($s) => [
            'metode' => $s['metode'], 'arah' => $s['arah'], 'status' => $s['status'], 'tersentuh' => $s['tersentuh'],
            'entry' => $s['entry'], 'sl' => $s['sl'], 'tp' => $s['tp'], 'rr' => $s['rr'], 'tpLabel' => $s['tpLabel'],
            'mulai' => $s['mulai'] ?? null, 'struktur' => $s['struktur'] ?? null,
            'zona' => ['atas' => $s['zona']['atas'], 'bawah' => $s['zona']['bawah'], 'mulai' => $s['zona']['mulai'], 'label' => $s['zona']['label']],
        ], $r['setups'])];
    }
    $out[$k['nama']] = $baris;
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
