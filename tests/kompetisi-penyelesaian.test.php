<?php
/**
 * REGRESI AUDIT G1 (kompetisi) — dijalankan oleh tests/kompetisi-penyelesaian.test.js.
 *
 * Bagian 1 (murni, tanpa database):
 *   · qi_komp_m1 (Binance): jendela bar SELALU sampai sekarang — dulu startTime + limit 1000 memberi 1000
 *     bar SESUDAH $dari, dan cache 20 dtk memakai ulang jendela basi itu (dicoba dengan "Binance" palsu
 *     yang meniru semantik startTime/endTime/limit API aslinya).
 *   · jam pasar emas (proksi PAXG tutup di akhir pekan), seri harga posisi (emas vs proksi + G sendiri),
 *     pembekuan proksi di akhir pekan, SL/TP SELL di seri bid (+ spread).
 * Bagian 2 (MySQL SUNGGUHAN, database sementara qim_uji_g1_<pid>, dihapus di akhir):
 *   · posisi tanpa SL berumur 2 hari TIDAK lagi mematikan SL M1 posisi lain di simbol yang sama;
 *   · akhir periode: kutipan tercatat terakhir dipakai bila tidak ada bar; tanpa harga apa pun → menunggu,
 *     lalu dibatalkan (tanpa P/L) setelah 72 jam; klasemen lalu bisa dibekukan;
 *   · harga akhir periode dicari SEKALI per (simbol, batas) per jalan, dan dibatasi per jalan;
 *   · stop-out tetap berjalan bila satu kaki tanpa harga punya tanda nyata terakhir;
 *   · seri harga: posisi emas tidak ditutup oleh harga proksi; posisi proksi dinilai di G-nya sendiri;
 *   · 'id' + 'segar' (dipakai 'ubah'): level lama dinilai di bar terbaru;
 *   · papan per pasar (Gold Rush) hanya XAUUSD; backfill pendaftaran semua peran PRO ke atas.
 *   Tanpa MySQL bagian 2 DILEWATI dan dikatakan.
 */
declare(strict_types=1);
define('QI_KOMP_SECRET', 'kunci-uji-kompetisi-yang-cukup-panjang');
require __DIR__ . '/../api/_kompetisi_papan.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$dekat = fn($a, $b, float $eps = 0.006): bool => $a !== null && abs((float)$a - (float)$b) <= $eps;
$tmp = sys_get_temp_dir() . '/qim-uji-g1-' . getmypid();
@mkdir($tmp);

/**
 * "Binance" palsu dengan semantik API klines yang asli: startTime → `limit` bar SESUDAHNYA; tanpa startTime →
 * `limit` bar TERAKHIR (≤ endTime bila ada). endTime dari qi_komp_klines_binance = akhir·1000 − 1.
 */
function binance_palsu(callable $bar, int $kini, array &$log): callable
{
    return function (string $sim, ?int $mulai, ?int $akhir, int $batas) use ($bar, $kini, &$log): array {
        $log[] = ['sim' => $sim, 'mulai' => $mulai, 'akhir' => $akhir, 'batas' => $batas];
        $terakhir = $kini - ($kini % 60);
        if ($akhir !== null) $terakhir = min($terakhir, (int)floor(($akhir - 1) / 60) * 60);
        if ($mulai !== null) {
            $awal = (int)ceil($mulai / 60) * 60;
            $ujung = min($terakhir, $awal + ($batas - 1) * 60);
        } else {
            $ujung = $terakhir;
            $awal = $ujung - ($batas - 1) * 60;
        }
        $hasil = [];
        for ($t = $awal; $t <= $ujung; $t += 60) $hasil[] = $bar($t);
        return $hasil;
    };
}

// ═════════════════════════════════════════════════════════════════════════════
echo "Bar M1 Binance mencakup SEKARANG (temuan 1 & 8)\n";
$kiniNyata = time();
$sumbu = $kiniNyata - ($kiniNyata % 60) - 300;                // bar 5 menit lalu: low 79.800
$barBtc = fn(int $t) => ['time' => $t, 'open' => 80000.0, 'high' => 80010.0, 'low' => $t === $sumbu ? 79800.0 : 79990.0, 'close' => 80000.0];
$log = [];
$klines = binance_palsu($barBtc, $kiniNyata, $log);
$dirM1 = "$tmp/m1";
@mkdir($dirM1);
$duaHari = $kiniNyata - 2 * 86400;
$m = qi_komp_m1('BTCUSDT', $duaHari, 'binance', false, $klines, $dirM1);
$bars = $m['bars'];
cek('dari = 2 hari lalu → bar TERAKHIR tetap di menit sekarang (dulu berhenti ~31 jam lalu)', $bars && (int)end($bars)['time'] >= $kiniNyata - 120, $bars ? [reset($bars)['time'], end($bars)['time'], $kiniNyata] : null);
cek('…dan bar PERTAMA mencakup $dari (disusul maju per 1000 bar, maks. 3 halaman)', $bars && (int)$bars[0]['time'] <= $duaHari, $bars ? $bars[0]['time'] - $duaHari : null);
cek('bar sumbu 5 menit lalu ada di jendela', (bool)array_filter($bars, fn($b) => $b['time'] === $sumbu));
$waktu = array_column($bars, 'time');
cek('tanpa bar ganda & urut naik', $waktu === array_values(array_unique($waktu)) && $waktu === (function ($w) { sort($w); return $w; })($waktu));
cek('permintaan pertama TANPA startTime (bar terbaru)', isset($log[0]) && $log[0]['mulai'] === null && $log[0]['akhir'] === null, $log[0] ?? null);

// Cache 20 dtk yang jendelanya TIDAK sampai sekarang tidak boleh dipakai ulang.
$lama = [];
for ($t = $duaHari - ($duaHari % 60); count($lama) < 1000; $t += 60) $lama[] = $barBtc($t);
file_put_contents("$dirM1/m1-BTCUSDT-binance.json", json_encode(['ts' => $kiniNyata, 'bars' => $lama]));
$log = [];
$m = qi_komp_m1('BTCUSDT', $duaHari + 600, 'binance', false, binance_palsu($barBtc, $kiniNyata, $log), $dirM1);
cek('cache segar tetapi basi (jendela 1000 bar lama) → diambil ulang, bukan dipakai', count($log) > 0 && (int)end($m['bars'])['time'] >= $kiniNyata - 120, ['panggilan' => count($log)]);
$log = [];
qi_komp_m1('BTCUSDT', $kiniNyata - 1800, 'binance', false, binance_palsu($barBtc, $kiniNyata, $log), $dirM1);
cek('cache yang mencakup [dari, sekarang] dipakai ulang (tanpa panggilan hulu)', count($log) === 0, $log);
qi_komp_m1('BTCUSDT', $kiniNyata - 1800, 'binance', true, binance_palsu($barBtc, $kiniNyata, $log), $dirM1);
cek("'segar' (dipakai 'ubah') melewati cache", count($log) === 1, $log);
$log = [];
$m = qi_komp_m1('BTCUSDT', $kiniNyata - 1800, 'binance', true, binance_palsu($barBtc, $kiniNyata, $log), $dirM1);
cek('rentang pendek → SATU permintaan kecil (limit secukupnya, bukan 1000)', count($log) === 1 && $log[0]['batas'] <= 40, $log);

echo "Jam pasar emas & batas bar proksi\n";
$ny = fn(string $s) => (new DateTimeImmutable($s, new DateTimeZone('America/New_York')))->getTimestamp();
cek('Jumat 16:59 NY buka, 17:00 tutup', qi_komp_emas_buka($ny('2026-10-23 16:59')) && !qi_komp_emas_buka($ny('2026-10-23 17:00')));
cek('Sabtu tutup; Minggu 17:59 tutup, 18:00 buka', !qi_komp_emas_buka($ny('2026-10-24 12:00')) && !qi_komp_emas_buka($ny('2026-10-25 17:59')) && qi_komp_emas_buka($ny('2026-10-25 18:00')));
cek('jeda harian Rabu 17:30 NY tutup', !qi_komp_emas_buka($ny('2026-10-21 17:30')) && qi_komp_emas_buka($ny('2026-10-21 18:00')));
$batasW43 = qi_komp_batas_periode('2026-W43')[1];           // Senin 00:00 WIB = Minggu siang NY
cek('batas periode (Senin 00:00 WIB) → emas terakhir tutup Jumat 17:00 NY', qi_komp_emas_tutup_sebelum($batasW43) === $ny('2026-10-23 17:00'), [qi_komp_emas_tutup_sebelum($batasW43), $ny('2026-10-23 17:00')]);

echo "Seri harga posisi XAUUSD (temuan 4 & 10)\n";
$proksiQ = ['price' => 4131.03, 'bid' => 4130.9, 'ask' => 4131.1, 'source' => 'binance_paxg', 'geser' => 0.0, 'umur' => 1, 'market' => null,
            'proksi' => ['price' => 4131.03, 'bid' => 4130.9, 'ask' => 4131.1, 'ts' => $kiniNyata, 'umur' => 1, 'market' => null]];
$emasQ = ['price' => 4139.0, 'bid' => 4138.8, 'ask' => 4139.2, 'source' => 'oanda_tv', 'umur' => 1, 'market' => 'open', 'tick_age' => 2,
          'proksi' => ['price' => 4131.03, 'bid' => 4130.9, 'ask' => 4131.1, 'ts' => $kiniNyata, 'umur' => 1, 'market' => null]];
$posEmas = ['symbol' => 'XAUUSD', 'harga_sumber' => 'oanda_tv', 'harga_geser' => null];
$posProksi = ['symbol' => 'XAUUSD', 'harga_sumber' => 'binance_paxg_selaras', 'harga_geser' => 7.736];
cek('posisi EMAS + feed sedang PROKSI → tanpa harga (tidak ditandai/ditutup di level PAXG)', qi_komp_kutipan_posisi($proksiQ, $posEmas) === null);
cek('posisi EMAS + feed emas → kutipan emas apa adanya', qi_komp_kutipan_posisi($emasQ, $posEmas) === $emasQ);
$qp = qi_komp_kutipan_posisi($proksiQ, $posProksi);
cek('posisi PROKSI dinilai di PAXG + G MILIKNYA (7,736), walau feed kini PAXG mentah (G jangkar kedaluwarsa)', $qp && $dekat($qp['bid'], 4138.636) && $dekat($qp['ask'], 4138.836), $qp);
$qp2 = qi_komp_kutipan_posisi($emasQ, $posProksi);
cek('posisi PROKSI tetap punya harga saat feed kembali ke emas nyata (lapisan proksi)', $qp2 && $dekat($qp2['bid'], 4138.636), $qp2);
// Lompatan level feed (jangkar 4138,5 → PAXG mentah 4131,0) TIDAK mengubah P/L posisi proksi sama sekali.
$pnlA = qi_paper_pnl('XAUUSD', 'BUY', 4138.836, (float)qi_komp_harga_tanda('BUY', qi_komp_kutipan_posisi($proksiQ, $posProksi)), 2.0);
$pnlB = qi_paper_pnl('XAUUSD', 'BUY', 4138.836, (float)qi_komp_harga_tanda('BUY', qi_komp_kutipan_posisi(['source' => 'binance_paxg_selaras', 'geser' => 0.0] + $proksiQ, $posProksi)), 2.0);
cek('BUY 2 lot proksi: P/L sama sebelum & sesudah level feed berganti (dulu ±$1.500 tanpa gerak pasar)', $dekat($pnlA, $pnlB) && $dekat($pnlA, -40.0, 0.01), [$pnlA, $pnlB]);
cek('simbol lain & baris lama (tanpa harga_sumber) → kutipan apa adanya', qi_komp_kutipan_posisi($proksiQ, ['symbol' => 'XAUUSD']) === $proksiQ
    && qi_komp_kutipan_posisi(['price' => 1.1, 'source' => 'twelvedata'], ['symbol' => 'EURUSD', 'harga_sumber' => 'oanda_tv']) === ['price' => 1.1, 'source' => 'twelvedata']);

echo "Proksi dibekukan di luar jam emas\n";
$sabtu = $ny('2026-10-24 12:00');
$jumat = $ny('2026-10-23 16:58');
$baruJumat = qi_komp_xau_beku(['price' => 4120.0, 'bid' => 4119.9, 'ask' => 4120.1, 'source' => 'binance_paxg', 'geser' => 0.0, 'ts' => $jumat,
                              'proksi' => ['price' => 4120.0, 'bid' => 4119.9, 'ask' => 4120.1, 'ts' => $jumat]], null, $jumat);
$baruSabtu = qi_komp_xau_beku(['price' => 4150.0, 'bid' => 4149.9, 'ask' => 4150.1, 'source' => 'binance_paxg', 'geser' => 0.0, 'ts' => $sabtu,
                              'proksi' => ['price' => 4150.0, 'bid' => 4149.9, 'ask' => 4150.1, 'ts' => $sabtu]], $baruJumat, $sabtu);
cek('Sabtu: proksi = harga Jumat sebelum emas tutup, pasar "closed" (order ditolak)', $baruSabtu['market'] === 'closed' && $dekat($baruSabtu['bid'], 4119.9)
    && $dekat($baruSabtu['proksi']['bid'], 4119.9) && $baruSabtu['proksi']['market'] === 'closed', $baruSabtu);
cek('qi_paper_harga_eksekusi menolak XAUUSD proksi di akhir pekan (pasar_tutup)', (qi_paper_harga_eksekusi('XAUUSD', 'beli', null, qi_komp_acuan_dari($baruSabtu + ['umur' => 0]))['kode'] ?? '') === 'pasar_tutup');

echo "SL/TP SELL di seri bid (temuan 14)\n";
$T = 1_792_600_000 - (1_792_600_000 % 60);
$barBid = [['time' => $T, 'open' => 4000.0, 'high' => 4000.2, 'low' => 3990.0, 'close' => 3995.0]];
$j0 = qi_paper_sltp_jalan('SELL', 4010.0, 3990.0, $barBid, $T, $T + 600);
$j1 = qi_paper_sltp_jalan('SELL', 4010.0, 3990.0, $barBid, $T, $T + 600, 0.4);
cek('tanpa spread (seri apa adanya): BID menyentuh TP 3990 → kena (perilaku lama)', ($j0['kena']['alasan'] ?? '') === 'tp');
cek('seri bid + spread 0,4: ASK terendah 3990,4 belum menyentuh TP → TIDAK kena', $j1['kena'] === null, $j1);
$j2 = qi_paper_sltp_jalan('SELL', 4000.5, null, $barBid, $T, $T + 600, 0.4);
cek('SELL SL 4000,5: high bid 4000,2 + spread 0,4 = ask 4000,6 → kena di SL', ($j2['kena']['alasan'] ?? '') === 'sl' && $dekat($j2['kena']['harga'], 4000.5), $j2);
cek('bar MT5/OANDA berbasis bid, kline Binance tidak', qi_komp_bar_bid('mt5') && qi_komp_bar_bid('oanda_tv') && !qi_komp_bar_bid('binance') && !qi_komp_bar_bid('binance_paxg'));

echo "Harga akhir periode di-cache (temuan 7)\n";
$log = [];
$klinesBatas = binance_palsu(fn(int $t) => ['time' => $t, 'open' => 100.0, 'high' => 101.0, 'low' => 99.0, 'close' => 100.5], $kiniNyata, $log);
$bt = $kiniNyata - ($kiniNyata % 60) - 3600;
$h1 = qi_komp_harga_sebelum('BTCUSDT', $bt, 'binance', $klinesBatas, $dirM1);
$h2 = qi_komp_harga_sebelum('BTCUSDT', $bt, 'binance', $klinesBatas, $dirM1);
cek('harga sebelum batas = close bar terakhir sebelum batas; panggilan kedua dari berkas (1 panggilan hulu)', $h1 && $dekat($h1['harga'], 100.5) && $h1['ts'] === $bt && $h2 === $h1 && count($log) === 1, [$h1, count($log)]);

// ═════════════════════════════════════════════════════════════════════════════
$host = getenv('QI_TEST_DB_HOST') ?: '127.0.0.1';
try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", getenv('QI_TEST_DB_USER') ?: 'root', getenv('QI_TEST_DB_PASS') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_TIMEOUT => 3]);
} catch (Throwable $e) {
    echo "SKIP (bagian database) — MySQL tidak terjangkau di $host: " . $e->getMessage() . "\n";
    array_map('unlink', glob("$dirM1/*") ?: []); @rmdir($dirM1); @rmdir($tmp);
    echo $gagal ? "FAIL — $gagal gagal\n" : "PASS (tanpa bagian database)\n";
    exit($gagal ? 1 : 0);
}
$db = 'qim_uji_g1_' . getmypid();
$pdo->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try {
    $pdo->exec("USE `$db`");
    $pdo->exec("CREATE TABLE users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL,
                role VARCHAR(20) DEFAULT 'user', is_active TINYINT(1) NOT NULL DEFAULT 1, status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE paper_positions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, symbol VARCHAR(30) NOT NULL,
                direction ENUM('BUY','SELL') NOT NULL, lots DECIMAL(10,2) DEFAULT 0.10, entry_price DECIMAL(18,6) NOT NULL,
                stop_loss DECIMAL(18,6) NULL, take_profit DECIMAL(18,6) NULL, close_price DECIMAL(18,6) NULL, pnl_usd DECIMAL(12,4) NULL,
                status ENUM('open','closed','cancelled') DEFAULT 'open', opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME NULL, source VARCHAR(20) NOT NULL DEFAULT 'manual', KEY idx_pp_user (user_id, status)) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE competition_entries (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, tournament_key VARCHAR(40) NOT NULL, period_key VARCHAR(20) NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq (tournament_key, period_key, user_id)) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE user_competition_profile (user_id BIGINT UNSIGNED PRIMARY KEY, display_name VARCHAR(24) NULL, country_code CHAR(2) NULL) ENGINE=InnoDB");

    $u = [];
    foreach (['pro', 'premium', 'vip', 'vip_plus', 'elite', 'user', 'admin', 'pro'] as $i => $peran) {
        $pdo->prepare('INSERT INTO users (full_name, email, role) VALUES (?, ?, ?)')->execute(["Uji $i $peran", "u$i@uji.test", $peran]);
        $u[$i] = (int)$pdo->lastInsertId();
    }
    // Posisi minggu ini SEBELUM kolom 027 ada (backfill pendaftaran).
    foreach ($u as $id) {
        $pdo->prepare("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, status, opened_at) VALUES (?, 'BTCUSDT', 'BUY', 0.01, 80000, 'closed', FROM_UNIXTIME(?))")
            ->execute([$id, time() - 60]);
    }

    echo "Skema & backfill pendaftaran (temuan 15)\n";
    $penanda = "$tmp/skema.ok";
    cek('skema 027-v2 terpasang: harga_sumber & harga_geser ada', qi_komp_skema_siapkan($pdo, $penanda)
        && !array_diff(['harga_sumber', 'harga_geser'], $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions'")->fetchAll(PDO::FETCH_COLUMN)));
    $terdaftar = array_map('intval', $pdo->query("SELECT user_id FROM competition_entries ORDER BY user_id")->fetchAll(PDO::FETCH_COLUMN));
    cek('backfill mendaftarkan pro, premium, vip, vip_plus, elite — bukan user/admin (sama dengan qi_tingkat_peran 1–2)',
        $terdaftar === [$u[0], $u[1], $u[2], $u[3], $u[4], $u[7]], $terdaftar);
    $pdo->exec('DELETE FROM paper_positions');
    $pdo->exec('DELETE FROM competition_entries');
    $opsiDasar = ['penanda_skema' => $penanda, 'akhir' => static fn() => null, 'tanda' => []];
    $tambah = function (array $k) use ($pdo): int {
        $k += ['user' => 1, 'symbol' => 'BTCUSDT', 'dir' => 'BUY', 'lots' => 0.1, 'entry' => 80000.0, 'sl' => null, 'tp' => null, 'kp' => null,
               'buka' => time() - 3600, 'cek' => null, 'hs' => null, 'hg' => null, 'status' => 'open', 'pnl' => null, 'tutup' => null];
        $pdo->prepare("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, status, pnl_usd, close_price, opened_at, closed_at,
                                                    sltp_checked_at, source, komp_periode, harga_sumber, harga_geser)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), IF(? IS NULL, NULL, FROM_UNIXTIME(?)), IF(? IS NULL, NULL, FROM_UNIXTIME(?)), 'manual', ?, ?, ?)")
            ->execute([$k['user'], $k['symbol'], $k['dir'], $k['lots'], $k['entry'], $k['sl'], $k['tp'], $k['status'], $k['pnl'], $k['pnl'] === null ? null : $k['entry'],
                       $k['buka'], $k['tutup'], $k['tutup'], $k['cek'], $k['cek'], $k['kp'], $k['hs'], $k['hg']]);
        return (int)$pdo->lastInsertId();
    };
    $baris = fn(int $id) => $pdo->query("SELECT status, close_price, close_reason, pnl_usd, UNIX_TIMESTAMP(closed_at) AS t, UNIX_TIMESTAMP(sltp_checked_at) AS cek FROM paper_positions WHERE id = $id")->fetch();

    echo "Posisi tanpa SL berumur 2 hari tidak mematikan SL M1 posisi lain (temuan 1 & 8)\n";
    [, , $Pkini] = qi_komp_periode_kini();
    $kutBtc = static fn(array $syms) => array_intersect_key(['BTCUSDT' => ['price' => 80000.0, 'bid' => 80000.0, 'ask' => 80000.5, 'market' => null, 'umur' => 1, 'source' => 'binance']], array_flip($syms));
    $dariDiminta = [];
    $logM1 = [];
    $dirSettle = "$tmp/m1-settle";
    @mkdir($dirSettle);
    $m1Nyata = function (string $sym, int $dari, ?string $sumber) use (&$dariDiminta, &$logM1, $barBtc, $kiniNyata, $dirSettle) {
        $dariDiminta[] = $dari;
        return qi_komp_m1($sym, $dari, $sumber, true, binance_palsu($barBtc, $kiniNyata, $logM1), $dirSettle);
    };
    $tua = $tambah(['user' => $u[1], 'buka' => time() - 2 * 86400, 'kp' => $Pkini]);                       // tanpa SL, cek NULL
    $korban = $tambah(['user' => $u[0], 'buka' => time() - 1800, 'sl' => 79900.0, 'kp' => $Pkini]);
    $h = qi_paper_settle($pdo, null, ['kutipan' => $kutBtc, 'm1' => $m1Nyata] + $opsiDasar);
    $r = $baris($korban);
    cek('SL 79.900 posisi baru DITUTUP oleh sumbu M1 5 menit lalu (dulu: tetap terbuka)', $r['status'] === 'closed' && $r['close_reason'] === 'sl' && $dekat($r['close_price'], 79900), $r);
    cek('awal jendela bar = posisi BER-SL (30 mnt lalu), bukan posisi tanpa SL (2 hari lalu)', $dariDiminta && min($dariDiminta) >= time() - 1800 - 120, ['dari' => $dariDiminta, 'kini' => time()]);
    cek('posisi tanpa SL tetap terbuka & tidak disentuh', $baris($tua)['status'] === 'open');
    // SL dengan titik periksa 2 hari lalu (mis. cron mati): jendela tetap sampai sekarang.
    $pdo->exec('DELETE FROM paper_positions');
    $basi = $tambah(['user' => $u[0], 'buka' => time() - 3 * 86400, 'cek' => time() - 2 * 86400, 'sl' => 79900.0, 'kp' => $Pkini]);
    qi_paper_settle($pdo, null, ['kutipan' => $kutBtc, 'm1' => $m1Nyata] + $opsiDasar);
    cek('SL dengan titik periksa 2 hari lalu tetap dinilai sampai bar terbaru', $baris($basi)['close_reason'] === 'sl', $baris($basi));

    echo "'ubah': level lama dinilai di bar segar (temuan 3)\n";
    $pdo->exec('DELETE FROM paper_positions');
    $logM1 = [];
    $ubah = $tambah(['user' => $u[0], 'buka' => time() - 1800, 'cek' => time() - 600, 'sl' => 79900.0, 'kp' => $Pkini]);
    $lain = $tambah(['user' => $u[0], 'symbol' => 'BTCUSDT', 'buka' => time() - 1800, 'sl' => 70000.0, 'kp' => $Pkini]);
    $h = qi_paper_settle($pdo, $u[0], ['id' => $ubah, 'segar' => true, 'kutipan' => $kutBtc, 'm1' => $m1Nyata] + $opsiDasar);
    cek("qi_paper_settle(['id', 'segar']) menutup posisi yang SL lamanya tersentuh (sl:null tidak menyelamatkannya)", $baris($ubah)['close_reason'] === 'sl' && $h['diperiksa'] === 1, [$baris($ubah), $h['diperiksa']]);
    cek("…dan hanya posisi itu yang diperiksa ('id')", $baris($lain)['status'] === 'open' && $baris($lain)['cek'] === null, $baris($lain));
    $pt = file_get_contents(__DIR__ . '/../api/paper-trading.php');
    $blokUbah = substr($pt, strpos($pt, "if (\$aksi === 'ubah')"), 6000);
    cek("'ubah' dengan SL/TP sama → tidak mengubah sltp_checked_at (jawaban berubah:false sebelum UPDATE)",
        strpos($blokUbah, "'berubah' => false") !== false && strpos($blokUbah, "'berubah' => false") < strpos($blokUbah, 'UPDATE paper_positions SET stop_loss'));
    cek("'ubah' menilai level lama dengan bar segar SEBELUM menyimpan level baru", strpos($blokUbah, "'segar' => true") !== false
        && strpos($blokUbah, "'segar' => true") < strpos($blokUbah, 'UPDATE paper_positions SET stop_loss') && strpos($blokUbah, 'QI_KOMP_JEDA_UBAH') !== false);

    echo "Seri harga di penyelesaian (temuan 10)\n";
    $pdo->exec('DELETE FROM paper_positions');
    $kutXau = fn(array $q) => static fn(array $syms) => array_intersect_key(['XAUUSD' => $q], array_flip($syms));
    $emas = $tambah(['user' => $u[0], 'symbol' => 'XAUUSD', 'entry' => 4140.0, 'sl' => 4100.0, 'kp' => $Pkini, 'hs' => 'oanda_tv']);
    $prok = $tambah(['user' => $u[2], 'symbol' => 'XAUUSD', 'entry' => 4140.0, 'sl' => 4130.0, 'kp' => $Pkini, 'hs' => 'binance_paxg_selaras', 'hg' => 7.7]);
    $tanpaBar = static fn() => ['bars' => []];
    // Feed jatuh ke PROKSI: bid proksi 4090 di bawah SL emas 4100 — harga itu BUKAN seri posisi emas.
    qi_paper_settle($pdo, null, ['kutipan' => $kutXau(['price' => 4090.0, 'bid' => 4090.0, 'ask' => 4090.2, 'source' => 'binance_paxg', 'geser' => 0.0, 'umur' => 1, 'market' => null,
        'proksi' => ['price' => 4125.0, 'bid' => 4125.0, 'ask' => 4125.2, 'ts' => time(), 'umur' => 1]]), 'm1' => $tanpaBar] + $opsiDasar);
    cek('posisi EMAS tidak ditutup oleh harga PROKSI yang menembus SL-nya', $baris($emas)['status'] === 'open', $baris($emas));
    cek('posisi PROKSI (G 7,7): PAXG 4125 + 7,7 = 4132,7 > SL 4130 → tetap terbuka (dulu: ditutup di level emas)', $baris($prok)['status'] === 'open', $baris($prok));
    qi_paper_settle($pdo, null, ['kutipan' => $kutXau(['price' => 4126.0, 'bid' => 4126.0, 'ask' => 4126.3, 'source' => 'oanda_tv', 'umur' => 1, 'market' => 'open', 'tick_age' => 1,
        'proksi' => ['price' => 4122.0, 'bid' => 4122.0, 'ask' => 4122.2, 'ts' => time(), 'umur' => 1]]), 'm1' => $tanpaBar] + $opsiDasar);
    $r = $baris($prok);
    cek('feed kembali ke emas; PAXG 4122 + 7,7 = 4129,7 ≤ SL → posisi proksi ditutup di 4129,7 (seri miliknya)', $r['close_reason'] === 'sl' && $dekat($r['close_price'], 4129.7), $r);
    cek('posisi emas di feed emas 4126 > SL 4100 → tetap terbuka', $baris($emas)['status'] === 'open');
    $papan = qi_komp_papan_bangun($pdo, $Pkini, ['kutipan' => $kutXau(['price' => 4090.0, 'bid' => 4090.0, 'ask' => 4090.2, 'source' => 'binance_paxg', 'umur' => 1, 'market' => null,
        'proksi' => ['price' => 4090.0, 'bid' => 4090.0, 'ask' => 4090.2, 'ts' => time(), 'umur' => 1]]), 'tanda_berkas' => "$tmp/tanda-seri.json"]);
    $bEmas = array_values(array_filter($papan['baris'], fn($b) => $b['uid'] === $u[0]))[0] ?? null;
    cek('papan: posisi emas saat feed proksi → harga_basi, mengambang TIDAK dihitung di level PAXG', $bEmas && $bEmas['harga_basi'] === true && $bEmas['tanpa_harga'] === 1 && $bEmas['floating'] === 0.0, $bEmas);

    echo "Stop-out dengan kaki tanpa harga (temuan 6)\n";
    $pdo->exec('DELETE FROM paper_positions');
    $x = $tambah(['user' => $u[0], 'symbol' => 'XAUUSD', 'lots' => 2.0, 'entry' => 4000.0, 'kp' => $Pkini, 'hs' => 'oanda_tv']);
    $nas = $tambah(['user' => $u[0], 'symbol' => 'NAS100', 'lots' => 0.01, 'entry' => 20000.0, 'kp' => $Pkini]);
    $kutSO = static fn(array $syms) => array_intersect_key(['XAUUSD' => ['price' => 3955.0, 'bid' => 3955.0, 'ask' => 3955.4, 'source' => 'oanda_tv', 'umur' => 1, 'market' => 'open', 'tick_age' => 1]], array_flip($syms));
    qi_paper_settle($pdo, $u[0], ['kutipan' => $kutSO, 'm1' => $tanpaBar, 'tanda' => []] + $opsiDasar);
    cek('tanpa tanda nyata untuk NAS100 → stop-out tidak menebak (posisi dibiarkan)', $baris($x)['status'] === 'open');
    qi_paper_settle($pdo, $u[0], ['kutipan' => $kutSO, 'm1' => $tanpaBar, 'tanda' => [$nas => ['mark' => 19990.0, 'ts' => time() - 300]]] + $opsiDasar);
    $r = $baris($x);
    cek('NAS100 dihitung di tanda nyata terakhirnya → level < 50% → XAUUSD (harga segar) di-stop-out di bid 3955', $r['close_reason'] === 'stopout' && $dekat($r['close_price'], 3955), $r);
    cek('kaki bertanda cadangan tidak dieksekusi (NAS100 tetap terbuka)', $baris($nas)['status'] === 'open');

    echo "Akhir periode tanpa bar M1 (temuan 2, 7 & 9)\n";
    $pdo->exec('DELETE FROM paper_positions');
    $kiniUji = 1_792_800_000;                                         // Kamis 2026-W43
    [, , $P43] = qi_komp_periode_kini($kiniUji);
    $P42 = qi_komp_periode_kini($kiniUji - 7 * 86400)[2];
    [$mulai42, $batas42] = qi_komp_batas_periode($P42);
    $xp = $tambah(['user' => $u[0], 'symbol' => 'XAUUSD', 'entry' => 4130.0, 'kp' => $P42, 'buka' => $mulai42 + 3600, 'hs' => 'binance_paxg_selaras', 'hg' => 7.5]);
    $eu = $tambah(['user' => $u[2], 'symbol' => 'EURUSD', 'entry' => 1.1, 'kp' => $P42, 'buka' => $mulai42 + 3600, 'hs' => 'twelvedata']);
    $tambah(['user' => $u[3], 'symbol' => 'BTCUSDT', 'entry' => 80000.0, 'kp' => $P42, 'buka' => $mulai42 + 3600, 'status' => 'closed', 'pnl' => 50.0, 'tutup' => $mulai42 + 7200]);
    $akhir = static fn(string $p, string $sym) => $sym === 'XAUUSD' && $p === $P42
        ? ['price' => 4140.0, 'bid' => 4139.8, 'ask' => 4140.2, 'source' => 'oanda_tv', 'ts' => $batas42 - 900, 'market' => 'open',
           'proksi' => ['price' => 4130.0, 'bid' => 4129.9, 'ask' => 4130.1, 'ts' => $batas42 - 900]]
        : null;
    $opsiAkhir = ['kutipan' => static fn() => [], 'm1' => $tanpaBar, 'sebelum' => static fn() => null, 'akhir' => $akhir, 'kini' => $kiniUji,
                  'penanda_skema' => $penanda, 'tanda' => [], 'batal_setelah' => PHP_INT_MAX];
    $h = qi_paper_settle($pdo, null, $opsiAkhir);
    $r = $baris($xp);
    cek('XAUUSD proksi tanpa bar: ditutup di kutipan TERCATAT terakhir periode itu, seri posisi (PAXG bid 4129,9 + G 7,5 = 4137,4)', $r['close_reason'] === 'period_end' && $dekat($r['close_price'], 4137.4) && (int)$r['t'] < $batas42, $r);
    cek('EURUSD tanpa bar & tanpa kutipan tercatat → menunggu_harga (tidak ditebak)', $baris($eu)['status'] === 'open' && in_array($eu, array_column($h['menunggu_harga'], 'id'), true), $h['menunggu_harga']);
    cek('periode dengan posisi menunggu BELUM dibekukan', qi_komp_papan_final($pdo, $P42) === null);
    $h = qi_paper_settle($pdo, null, ['batal_setelah' => 72 * 3600] + $opsiAkhir);
    $r = $pdo->query("SELECT status, close_reason, pnl_usd, close_price FROM paper_positions WHERE id = $eu")->fetch();
    cek('> 72 jam setelah batas tanpa harga apa pun → DIBATALKAN (cancelled, tanpa P/L), bukan ditutup di harga tebakan', $r['status'] === 'cancelled' && $r['close_reason'] === 'period_end'
        && $r['pnl_usd'] === null && $r['close_price'] === null && count($h['dibatalkan']) === 1, [$r, $h['dibatalkan']]);
    $beku = qi_komp_papan_final($pdo, $P42);
    cek('…lalu klasemen periode itu bisa dibekukan', $beku !== null && count($beku['baris']) === 2, $beku['baris'] ?? null);
    $pdo->exec('DELETE FROM paper_positions');
    $panggil = 0;
    for ($i = 0; $i < 5; $i++) $tambah(['user' => $u[$i], 'symbol' => 'BTCUSDT', 'entry' => 80000.0, 'kp' => $P42, 'buka' => $mulai42 + 3600, 'hs' => 'binance']);
    $tambah(['user' => $u[0], 'symbol' => 'ETHUSDT', 'entry' => 3000.0, 'kp' => $P42, 'buka' => $mulai42 + 3600, 'hs' => 'binance']);
    $hitung = function (string $sym, int $batas) use (&$panggil) { $panggil++; return ['harga' => $sym === 'BTCUSDT' ? 80100.0 : 3010.0, 'ts' => $batas - 60]; };
    $h = qi_paper_settle($pdo, null, ['sebelum' => $hitung, 'maks_harga_sebelum' => 1] + $opsiAkhir);
    cek('5 posisi BTCUSDT periode lalu → harga batas dicari SEKALI (dulu sekali per posisi)', $panggil === 1 && count(array_filter($h['ditutup'], fn($d) => $d['symbol'] === 'BTCUSDT')) === 5, [$panggil, count($h['ditutup'])]);
    cek('batas pencarian per jalan: ETHUSDT ditunda ke jalan berikutnya (menunggu, ditunda)', ($h['menunggu_harga'][0]['symbol'] ?? '') === 'ETHUSDT' && !empty($h['menunggu_harga'][0]['ditunda']), $h['menunggu_harga']);
    qi_paper_settle($pdo, null, ['sebelum' => $hitung, 'maks_harga_sebelum' => 1] + $opsiAkhir);
    cek('jalan berikutnya menutup ETHUSDT', (int)$pdo->query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open'")->fetchColumn() === 0);

    echo "Papan per pasar — Gold Rush (temuan 5)\n";
    $pdo->exec('DELETE FROM paper_positions');
    $tambah(['user' => $u[0], 'symbol' => 'XAUUSD', 'entry' => 4000.0, 'kp' => $Pkini, 'status' => 'closed', 'pnl' => 120.0, 'tutup' => time() - 60, 'buka' => time() - 600]);
    $tambah(['user' => $u[0], 'symbol' => 'BTCUSDT', 'entry' => 80000.0, 'kp' => $Pkini, 'status' => 'closed', 'pnl' => 900.0, 'tutup' => time() - 60, 'buka' => time() - 600]);
    $tambah(['user' => $u[2], 'symbol' => 'BTCUSDT', 'entry' => 80000.0, 'kp' => $Pkini, 'status' => 'closed', 'pnl' => 500.0, 'tutup' => time() - 60, 'buka' => time() - 600]);
    $pdo->prepare('INSERT INTO competition_entries (tournament_key, period_key, user_id) VALUES (?, ?, ?)')->execute(['gold-rush-weekly', $Pkini, $u[4]]);
    $tandaBersama = "$tmp/tanda-bersama.json";
    file_put_contents($tandaBersama, '{"999":{"mark":1}}');
    $gr = qi_komp_papan_bangun($pdo, $Pkini, ['simbol' => ['XAUUSD'], 'turnamen' => 'gold-rush-weekly', 'kutipan' => static fn() => [], 'tanda_berkas' => $tandaBersama]);
    $per = [];
    foreach ($gr['baris'] as $b) $per[$b['uid']] = $b;
    cek('Gold Rush: hanya P/L XAUUSD (+120; BTC +900 tidak ikut), peserta BTC saja tidak tampil', isset($per[$u[0]]) && $dekat($per[$u[0]]['realized'], 120) && !isset($per[$u[2]]), $gr['baris']);
    cek('Gold Rush: peserta terdaftar turnamen itu tampil (belum trading)', isset($per[$u[4]]) && $per[$u[4]]['aktif'] === false);
    cek('papan tersaring TIDAK menimpa berkas tanda bersama', file_get_contents($tandaBersama) === '{"999":{"mark":1}}');
} finally {
    $pdo->exec("DROP DATABASE IF EXISTS `$db`");
    foreach (["$tmp/m1", "$tmp/m1-settle", $tmp] as $d) { array_map('unlink', array_filter(glob("$d/*") ?: [], 'is_file')); }
    @rmdir("$tmp/m1"); @rmdir("$tmp/m1-settle"); @rmdir($tmp);
}

echo $gagal ? "FAIL — $gagal gagal\n" : "PASS\n";
exit($gagal ? 1 : 0);
