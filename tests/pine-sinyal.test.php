<?php
/**
 * Uji pemindai sinyal Pine (api/_pine_sinyal.php) pada fixture H4 OANDA: putaran pertama hanya mengingat status,
 * sinyal dibuat HANYA pada transisi ke VALID (sekali), candle berjalan tidak dinilai, notifikasi sekali per sinyal,
 * dan penilaian memakai aturan konservatif (SL didahulukan). Dijalankan oleh tests/pine-php.test.js.
 */
declare(strict_types=1);
date_default_timezone_set('UTC');
require __DIR__ . '/../api/_pine_sinyal.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}

$fx = json_decode((string)file_get_contents(__DIR__ . '/fixtures/xauusd_h4_oanda.json'), true);
$semua = array_map(static fn($r) => ['time' => $r[0], 'open' => $r[1], 'high' => $r[2], 'low' => $r[3], 'close' => $r[4]], $fx['candles']);
$tmp = sys_get_temp_dir() . '/qi-pine-uji-' . bin2hex(random_bytes(4));
mkdir($tmp);
register_shutdown_function(static function () use ($tmp) { foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f); @rmdir($tmp); });

$jendela = 1200;
$muatDari = static function (int $n, bool $barBerjalan = false) use ($semua, $jendela) {
    $potong = array_slice($semua, max(0, $n - $jendela), min($n, $jendela));
    return static fn(string $s, string $iv): array => ['candles' => $potong, 'simulated' => false];
};
$kiniSetelahTutup = static fn(int $n): int => $semua[$n - 1]['time'] + 14400 + 5;   // semua bar sampai n sudah tutup

echo "Pemindai sinyal Pine\n";
$kiriman = [];
$notif = static function (array $rek) use (&$kiriman) { $kiriman[] = $rek['id']; return 'ok'; };

// Cari titik di fixture yang statusnya benar-benar berubah ke VALID.
$mulai = count($semua) - 700;
$h0 = qi_pine_hitung(array_slice($semua, $mulai - $jendela, $jendela));
$r = qi_pine_pindai(['muat' => $muatDari($mulai), 'kini' => $kiniSetelahTutup($mulai), 'dir' => $tmp, 'notif' => $notif]);
cek('putaran pertama: hanya mengingat status, tidak membuat sinyal', $r['dibuat'] === 0 && $r['dipindai'] === 1 && count($kiriman) === 0, $r);
$state = json_decode((string)file_get_contents($tmp . '/pine_state.json'), true);
cek('status awal tersimpan', isset($state['XAUUSD']['BUY'], $state['XAUUSD']['SELL']), $state);

$total = 0; $transisi = 0; $prevValid = ['BUY' => !empty($state['XAUUSD']['BUY']), 'SELL' => !empty($state['XAUUSD']['SELL'])];
for ($n = $mulai + 1; $n <= count($semua); $n++) {
    $h = qi_pine_hitung(array_slice($semua, max(0, $n - $jendela), min($n, $jendela)));
    foreach (['BUY' => 'buy', 'SELL' => 'sell'] as $a => $s) {
        $v = !empty($h[$s]['valid']);
        if ($v && !$prevValid[$a]) $transisi++;
        $prevValid[$a] = $v;
    }
    $r = qi_pine_pindai(['muat' => $muatDari($n), 'kini' => $kiniSetelahTutup($n), 'dir' => $tmp, 'notif' => $notif]);
    $total += $r['dibuat'];
}
$rekor = json_decode((string)file_get_contents($tmp . '/pine_signals.json'), true) ?: [];
cek('uji mencakup transisi ke VALID sungguhan', $transisi > 0, ['transisi' => $transisi]);
cek('jumlah sinyal ≤ jumlah transisi (satu rekor terbuka per simbol+arah)', $total > 0 && $total <= $transisi, ['total' => $total, 'transisi' => $transisi]);
cek('notifikasi terkirim tepat sekali per sinyal baru', count($kiriman) === $total && count(array_unique($kiriman)) === $total, ['kiriman' => count($kiriman), 'total' => $total]);

$rapi = true; $konsisten = true;
foreach ($rekor as $x) {
    $buy = $x['side'] === 'BUY';
    $ok = $buy ? ($x['sl'] < $x['entry'] && $x['entry'] < $x['tp1'] && $x['tp1'] < $x['tp2'] && $x['tp2'] < $x['tp3']) : ($x['sl'] > $x['entry'] && $x['entry'] > $x['tp1'] && $x['tp1'] > $x['tp2'] && $x['tp2'] > $x['tp3']);
    if (!$ok) $konsisten = false;
    if (!isset($x['id'], $x['timestamp'], $x['symbol'], $x['entry'], $x['sl'], $x['tp'], $x['status']) || $x['tp'] !== $x['tp3'] || strpos($x['rr'], '1 : ') !== 0) $rapi = false;
}
cek('semua rekor berurutan Entry/SL/TP1<TP2<TP3 sesuai arah', $konsisten, $rekor[0] ?? null);
cek('rekor memuat id, waktu, entry, sl, tp(=TP3), rr', $rapi);
$statusSah = ['MENUNGGU', 'AKTIF', 'HIT TP 🎯', 'HIT SL 🛑', 'EXPIRED', 'TIDAK TERISI', 'BATAL'];
cek('semua status termasuk kosakata penilai', count(array_filter($rekor, fn($x) => !in_array($x['status'], $statusSah, true))) === 0);
$selesai = array_filter($rekor, fn($x) => strpos($x['status'], 'HIT') === 0);
cek('rekor selesai punya exit_price & waktu tutup', count(array_filter($selesai, fn($x) => isset($x['exit_price'], $x['closed_at']))) === count($selesai));

echo "Candle berjalan\n";
$tmp2 = $tmp . '/b'; mkdir($tmp2);
$n = count($semua);
$kiniBerjalan = $semua[$n - 1]['time'] + 600;   // bar terakhir baru berjalan 10 menit
$kiriman2 = [];
$r2 = qi_pine_pindai(['muat' => $muatDari($n), 'kini' => $kiniBerjalan, 'dir' => $tmp2, 'notif' => static function ($x) use (&$kiriman2) { $kiriman2[] = $x['id']; }]);
$st2 = json_decode((string)file_get_contents($tmp2 . '/pine_state.json'), true);
cek('bar terakhir yang masih berjalan dibuang (bar yang dinilai = bar sebelumnya)', $st2['XAUUSD']['bar'] === $semua[$n - 2]['time'], $st2);
@unlink($tmp2 . '/pine_state.json'); @unlink($tmp2 . '/pine_signals.json'); @rmdir($tmp2);

echo "Data tidak layak\n";
$tmp3 = $tmp . '/c'; mkdir($tmp3);
$r3 = qi_pine_pindai(['muat' => static fn($s, $iv) => ['candles' => array_slice($semua, 0, 400), 'simulated' => true], 'kini' => time(), 'dir' => $tmp3]);
cek('candle simulasi tidak pernah dipindai', $r3['dipindai'] === 0 && $r3['dibuat'] === 0, $r3);
$r4 = qi_pine_pindai(['muat' => static fn($s, $iv) => ['candles' => array_slice($semua, 0, 100), 'simulated' => false], 'kini' => time(), 'dir' => $tmp3]);
cek('riwayat terlalu pendek tidak dipindai', $r4['dipindai'] === 0, $r4);
@unlink($tmp3 . '/pine_state.json'); @unlink($tmp3 . '/pine_signals.json'); @rmdir($tmp3);

echo "Penilaian konservatif\n";
$rek = ['id' => 'T1', 'symbol' => 'XAUUSD', 'side' => 'BUY', 'entry' => 100.0, 'sl' => 95.0, 'tp' => 115.0, 'timestamp' => qi_sig_waktu_utc(1000000), 'status' => 'MENUNGGU'];
$cfg = ['ttl_pending_jam' => 24, 'maks_tahan_jam' => 96];
$cd = static fn(int $t, float $o, float $h, float $l, float $c) => ['time' => $t, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $c];
$a = qi_ss_nilai($rek, [$cd(1000900, 102, 103, 99, 101), $cd(1001800, 101, 116, 94, 100)], 1100000, $cfg);
cek('terisi lalu SL dan TP tersentuh di candle yang sama → SL didahulukan', strpos($a['status'], 'HIT SL') === 0, $a['status']);
$b = qi_ss_nilai($rek, [$cd(1000900, 102, 103, 99, 101), $cd(1001800, 101, 116, 100, 115)], 1100000, $cfg);
cek('terisi lalu TP tercapai tanpa menyentuh SL → HIT TP', strpos($b['status'], 'HIT TP') === 0, $b['status']);

exit($gagal ? 1 : 0);
