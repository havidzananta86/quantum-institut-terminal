<?php
/**
 * Kompetisi langsung (audit 2026-10-22, desain §F) — dijalankan oleh tests/kompetisi-papan.test.js.
 *
 * Bagian 1 (murni, tanpa database): SL/TP dari bar M1, SL/TP dari kutipan, margin 1:100,
 *   peringkat kompetisi standar, harga penanda.
 * Bagian 2 (MySQL SUNGGUHAN di database sementara qim_uji_komp_<pid>, dihapus di akhir):
 *   skema 027 dipasang saat runtime, pembangun papan (peserta tanpa trade, peringkat seri, kaki
 *   dengan harga basi ditandai bukan ditebak, 'ai'/'auto' dikecualikan, isolasi komp_periode, akun
 *   diblokir dikecualikan), qi_paper_settle (gap SL di open bar, SL+TP satu bar → SL, tanpa bar →
 *   tidak disentuh, stop-out, akhir periode), dan pembekuan klasemen.
 *   Tanpa MySQL (CI) bagian 2 DILEWATI dan dikatakan, bukan dianggap lulus diam-diam.
 *
 * Koneksi: QI_TEST_DB_HOST / QI_TEST_DB_USER / QI_TEST_DB_PASS (bawaan 127.0.0.1 / root / kosong).
 */
declare(strict_types=1);
define('QI_KOMP_SECRET', 'kunci-uji-kompetisi-yang-cukup-panjang');   // jangan menulis cache/kompetisi_secret.json
require __DIR__ . '/../api/_kompetisi_papan.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$lulus) $gagal++;
}
$dekat = fn($a, $b, float $eps = 0.006): bool => $a !== null && abs((float)$a - (float)$b) <= $eps;

// ═════════════════════════════════════════════════════════════════════════════
echo "SL/TP dari bar M1 (murni)\n";
$T = 1_792_600_000 - (1_792_600_000 % 60);           // awal menit
$bar = fn(int $t, float $o, float $h, float $l, float $c) => ['time' => $t, 'open' => $o, 'high' => $h, 'low' => $l, 'close' => $c];
$j = qi_paper_sltp_jalan('BUY', 3990.0, 4020.0, [$bar($T, 4001, 4005, 3995, 4000), $bar($T + 60, 3985, 3988, 3980, 3984)], $T, $T + 600);
cek('BUY: gap ke bawah SL → keluar di OPEN bar (3985), bukan di SL', $j['kena'] === ['harga' => 3985.0, 'alasan' => 'sl', 'ts' => $T + 60], $j);
$j = qi_paper_sltp_jalan('BUY', 3990.0, 4020.0, [$bar($T, 4001, 4006, 3989, 4000)], $T, $T + 600);
cek('BUY: low menyentuh SL tanpa gap → keluar tepat di SL', $j['kena']['harga'] === 3990.0 && $j['kena']['alasan'] === 'sl', $j);
$j = qi_paper_sltp_jalan('SELL', 4010.0, 3990.0, [$bar($T, 4000, 4012, 3985, 4000)], $T, $T + 600);
cek('SELL: SL dan TP tersentuh di bar yang sama → SL (konservatif)', $j['kena']['alasan'] === 'sl' && $j['kena']['harga'] === 4010.0, $j);
$j = qi_paper_sltp_jalan('SELL', 4010.0, 3990.0, [$bar($T, 3980, 3982, 3975, 3978)], $T, $T + 600);
cek('SELL: gap ke bawah TP → keluar di open bar (lebih baik dari TP)', $j['kena'] === ['harga' => 3980.0, 'alasan' => 'tp', 'ts' => $T], $j);
$j = qi_paper_sltp_jalan('BUY', 3990.0, null, [$bar($T - 60, 4001, 4002, 3950, 4000), $bar($T, 4001, 4005, 3995, 4000)], $T, $T + 600);
cek('bar sebelum $mulai (bar tempat posisi dibuka) tidak dipakai', $j['kena'] === null && $j['periksa'] === $T + 60, $j);
$j = qi_paper_sltp_jalan('BUY', 3990.0, 4020.0, [$bar($T, 4001, 4005, 3995, 4000), $bar($T + 60, 4000, 4004, 3996, 4001)], $T, $T + 90);
cek('tanpa sentuhan: periksa = akhir bar TERAKHIR yang sudah selesai (bar berjalan diperiksa ulang)', $j['kena'] === null && $j['periksa'] === $T + 60, $j);
$j = qi_paper_sltp_jalan('BUY', 3990.0, 4020.0, [], $T, $T + 600);
cek('tanpa bar: tidak ada keputusan, tidak ada periksa', $j === ['kena' => null, 'periksa' => null], $j);

echo "SL/TP dari kutipan (tanpa bar)\n";
$q = fn(array $u = []) => array_merge(['price' => 3985.2, 'bid' => 3985.0, 'ask' => 3985.4, 'market' => 'open', 'umur' => 2], $u);
cek('BUY: bid ≤ SL → keluar di bid (order stop, tidak pernah lebih baik dari SL)', qi_paper_sltp_kutipan('BUY', 3990.0, null, $q()) === ['harga' => 3985.0, 'alasan' => 'sl']);
cek('BUY: bid ≥ TP → keluar TEPAT di TP (order limit)', qi_paper_sltp_kutipan('BUY', null, 3980.0, $q()) === ['harga' => 3980.0, 'alasan' => 'tp']);
cek('SELL: ask ≥ SL → keluar di ask', qi_paper_sltp_kutipan('SELL', 3985.1, null, $q()) === ['harga' => 3985.4, 'alasan' => 'sl']);
cek('kutipan basi (> 10 dtk) → tidak memutuskan apa pun', qi_paper_sltp_kutipan('BUY', 3990.0, null, $q(['umur' => 30])) === null);
cek('pasar tutup → tidak memutuskan apa pun', qi_paper_sltp_kutipan('BUY', 3990.0, null, $q(['market' => 'closed'])) === null);
cek('tanpa kutipan → null', qi_paper_sltp_kutipan('BUY', 3990.0, null, null) === null);

echo "Margin 1:100 & harga penanda\n";
cek('margin 1 lot XAUUSD @4000 = 100 oz × 4000 ÷ 100 = $4.000', qi_komp_margin('XAUUSD', 1.0, 4000.0) === 4000.0);
cek('margin 0,1 lot EURUSD @1,08 = $108', qi_komp_margin('EURUSD', 0.1, 1.08) === 108.0);
cek('margin 1 lot USDJPY = $1.000 (100.000 USD ÷ 100)', qi_komp_margin('USDJPY', 1.0, 150.0) === 1000.0);
$akun = qi_komp_hitung_akun(0.0, [['symbol' => 'XAUUSD', 'side' => 'BUY', 'lots' => 2.0, 'entry' => 4000.0, 'mark' => 3990.0]]);
cek('akun: mengambang −$2.000, ekuitas $8.000, margin $8.000, level 100%', $akun['mengambang'] === -2000.0 && $akun['ekuitas'] === 8000.0 && $akun['margin_terpakai'] === 8000.0 && $akun['level_margin'] === 100.0, $akun);
$tolak = qi_komp_cek_margin(qi_komp_hitung_akun(0.0, []), 'XAUUSD', 100.0, 4130.0);
cek('100 lot XAUUSD di akun $10.000 → DITOLAK (margin $413.000)', is_string($tolak) && str_contains($tolak, 'Margin tidak cukup'), $tolak);
cek('2 lot XAUUSD (margin $8.260) di akun $10.000 → boleh', qi_komp_cek_margin(qi_komp_hitung_akun(0.0, []), 'XAUUSD', 2.0, 4130.0) === null);
$tanpa = qi_komp_hitung_akun(0.0, [['symbol' => 'XAUUSD', 'side' => 'BUY', 'lots' => 0.1, 'entry' => 4000.0, 'mark' => null]]);
cek('kaki tanpa harga: mengambangnya TIDAK ditebak, order baru ditolak sampai harga ada', $tanpa['mengambang'] === 0.0 && $tanpa['tanpa_harga'] === 1
    && str_contains((string)qi_komp_cek_margin($tanpa, 'BTCUSDT', 0.01, 80000.0), 'tidak bisa dihitung'), $tanpa);
cek('penanda BUY = bid, SELL = ask', qi_komp_harga_tanda('BUY', $q()) === 3985.0 && qi_komp_harga_tanda('SELL', $q()) === 3985.4);
cek('penanda: kutipan basi (> 120 dtk) & pasar buka → null', qi_komp_harga_tanda('BUY', $q(['umur' => 500])) === null);
cek('penanda: pasar tutup → harga terakhir tetap berlaku', qi_komp_harga_tanda('BUY', $q(['umur' => 5000, 'market' => 'closed'])) === 3985.0);
$jangkar = sys_get_temp_dir() . '/qim-uji-jangkar-' . getmypid() . '.json';
$berkasG = sys_get_temp_dir() . '/qim-uji-geser-' . getmypid() . '.json';
@unlink($berkasG);
file_put_contents($jangkar, json_encode(['xau' => 4137.0, 'paxg' => 4120.0, 'ts' => time() - 60, 'sumber' => 'candle_h1']));
$paxg = ['price' => 4121.0, 'bid' => 4120.9, 'ask' => 4121.1, 'source' => 'binance_paxg', 'market' => null, 'tick_age' => null, 'chgPct' => 0.0, 'ts' => time()];
$g = qi_komp_geser_xau(null, '', $berkasG, $jangkar);
$xau = qi_komp_xau_dari_paxg($paxg, $g);
cek('XAUUSD tanpa bridge: PAXG + G kompetisi (+17 dari jangkar emas nyata yang segar)', $xau['source'] === 'binance_paxg_selaras' && $dekat($xau['price'], 4138.0) && $dekat($xau['bid'], 4137.9) && $dekat($xau['ask'], 4138.1) && $dekat($xau['geser'], 17), $xau);
cek('kutipan proksi membawa lapisan PAXG mentah (posisi proksi dinilai darinya + G miliknya)', $dekat($xau['proksi']['bid'] ?? null, 4120.9) && $dekat($xau['proksi']['ask'] ?? null, 4121.1), $xau['proksi'] ?? null);
file_put_contents($jangkar, json_encode(['xau' => 4137.0, 'paxg' => 4120.0, 'ts' => time() - 3600]));
$gBasi = qi_komp_geser_xau(null, '', $berkasG, $jangkar);
cek('jangkar basi (> 15 mnt) → G TERAKHIR tetap dipakai: level TIDAK jatuh ke PAXG mentah (audit G1: −$7,5 tanpa gerak pasar)',
    $gBasi !== null && $dekat($gBasi['geser'], 17) && qi_komp_xau_dari_paxg($paxg, $gBasi)['source'] === 'binance_paxg_selaras', $gBasi);
cek('belum pernah ada G → PAXG mentah apa adanya, tetap berlabel proksi', qi_komp_xau_dari_paxg($paxg, null)['source'] === 'binance_paxg' && $dekat(qi_komp_xau_dari_paxg($paxg, null)['price'], 4121.0));
@unlink($jangkar); @unlink($berkasG);
cek('asal sinyal (salinan sekali-klik AI) tidak ikut turnamen', !qi_komp_ikut_periode('vip', 'sinyal') && qi_komp_ikut_periode('pro', 'tiket') && !qi_komp_ikut_periode('user', 'tiket'));

echo "Peringkat kompetisi standar\n";
$p = qi_komp_peringkat([
    ['nama' => 'A', 'equity' => 10500.0, 'realized' => 500.0, 'aktivitas_ts' => 10, 'aktif' => true],
    ['nama' => 'B', 'equity' => 10200.0, 'realized' => 200.0, 'aktivitas_ts' => 20, 'aktif' => true],
    ['nama' => 'C', 'equity' => 10200.0, 'realized' => 100.0, 'aktivitas_ts' => 5, 'aktif' => true],
    ['nama' => 'D', 'equity' => 9000.0, 'realized' => -1000.0, 'aktivitas_ts' => 5, 'aktif' => true],
    ['nama' => 'Z', 'equity' => 10000.0, 'realized' => 0.0, 'aktivitas_ts' => 0, 'aktif' => false],
]);
cek('urutan A, B, C, D lalu peserta tanpa trade Z', array_column($p, 'nama') === ['A', 'B', 'C', 'D', 'Z'], array_column($p, 'nama'));
cek('ekuitas sama berbagi peringkat: 1, 2, 2, 4 — lalu 5 untuk yang belum trading', array_column($p, 'rank') === [1, 2, 2, 4, 5], array_column($p, 'rank'));

// ═════════════════════════════════════════════════════════════════════════════
$host = getenv('QI_TEST_DB_HOST') ?: '127.0.0.1';
$userDb = getenv('QI_TEST_DB_USER') ?: 'root';
$passDb = getenv('QI_TEST_DB_PASS') ?: '';
try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $userDb, $passDb, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_TIMEOUT => 3]);
} catch (Throwable $e) {
    echo "SKIP (bagian database) — MySQL tidak terjangkau di $host: " . $e->getMessage() . "\n";
    echo $gagal ? "FAIL — $gagal gagal\n" : "PASS (tanpa bagian database)\n";
    exit($gagal ? 1 : 0);
}
$db = 'qim_uji_komp_' . getmypid();
$pdo->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$tmp = sys_get_temp_dir() . '/qim-uji-komp-' . getmypid();
@mkdir($tmp);
try {
    $pdo->exec("USE `$db`");
    $pdo->exec("CREATE TABLE users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL,
                role ENUM('user','pro','vip','admin') DEFAULT 'user', is_active TINYINT(1) NOT NULL DEFAULT 1,
                status ENUM('active','suspended','expired') DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    // Skema paper_positions SEBELUM migrasi 027 (seperti produksi).
    $pdo->exec("CREATE TABLE paper_positions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, symbol VARCHAR(30) NOT NULL,
                direction ENUM('BUY','SELL') NOT NULL, lots DECIMAL(10,2) DEFAULT 0.10, entry_price DECIMAL(18,6) NOT NULL,
                stop_loss DECIMAL(18,6) NULL, take_profit DECIMAL(18,6) NULL, close_price DECIMAL(18,6) NULL, pnl_usd DECIMAL(12,4) NULL,
                status ENUM('open','closed','cancelled') DEFAULT 'open', opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME NULL, source VARCHAR(20) NOT NULL DEFAULT 'manual', KEY idx_pp_user (user_id, status)) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE competition_entries (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, tournament_key VARCHAR(40) NOT NULL, period_key VARCHAR(20) NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq (tournament_key, period_key, user_id)) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE user_competition_profile (user_id BIGINT UNSIGNED PRIMARY KEY, display_name VARCHAR(24) NULL, country_code CHAR(2) NULL) ENGINE=InnoDB");

    echo "Skema 027 saat runtime\n";
    $penanda = "$tmp/skema.ok";
    cek('qi_komp_skema_siapkan() memasang kolom, indeks, dan tabel klasemen', qi_komp_skema_siapkan($pdo, $penanda) && is_file($penanda));
    $kol = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions'")->fetchAll(PDO::FETCH_COLUMN);
    cek('kolom komp_periode, client_order_id, asal, close_reason, sltp_checked_at ada', !array_diff(['komp_periode', 'client_order_id', 'asal', 'close_reason', 'sltp_checked_at'], $kol), $kol);
    $idx = $pdo->query("SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paper_positions'")->fetchAll(PDO::FETCH_COLUMN);
    cek('indeks uq_pp_order, idx_pp_komp, idx_pp_closed ada', !array_diff(['uq_pp_order', 'idx_pp_komp', 'idx_pp_closed'], $idx), $idx);
    @unlink($penanda);
    cek('dipanggil ulang (penanda hilang) tetap aman — idempoten', qi_komp_skema_siapkan($pdo, $penanda . '2'));
    $pdo->exec("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, client_order_id) VALUES (1, 'BTCUSDT', 'BUY', 0.1, 80000, 'sama-12345')");
    $dup = false;
    try { $pdo->exec("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, client_order_id) VALUES (1, 'BTCUSDT', 'BUY', 0.1, 80000, 'sama-12345')"); }
    catch (PDOException $e) { $dup = $e->getCode() === '23000'; }
    cek('UNIQUE(user_id, client_order_id): kiriman ulang yang sama ditolak database', $dup);
    $pdo->exec('DELETE FROM paper_positions');

    // ── Fixture papan ──────────────────────────────────────────────────────────
    $kini = 1_792_800_000;                                  // Kamis 2026-10-22 (WIB) — tengah minggu
    [$mulai, $selesai, $P] = qi_komp_periode_kini($kini);
    [, , $Plalu] = qi_komp_periode_kini($kini - 7 * 86400);
    $u = [];
    foreach ([['Ana Putri', 'vip', 1, 'active'], ['Budi Santoso', 'pro', 1, 'active'], ['Cici', 'pro', 1, 'active'], ['Dedi Kurnia', 'pro', 0, 'active'],
              ['Eko Prasetyo', 'pro', 1, 'active'], ['Fani Lestari', 'pro', 1, 'active'], ['Gita Sari', 'pro', 1, 'active'], ['Hadi Wijaya', 'pro', 1, 'suspended']] as [$n, $r, $a, $s]) {
        $pdo->prepare('INSERT INTO users (full_name, email, role, is_active, status) VALUES (?, ?, ?, ?, ?)')->execute([$n, strtolower(strtok($n, ' ')) . '@uji.test', $r, $a, $s]);
        $u[strtok($n, ' ')] = (int)$pdo->lastInsertId();
    }
    $pos = function (string $siapa, string $sym, string $arah, float $lot, float $entry, ?float $pnl, string $sumber = 'manual', ?string $kp = null, int $buka = 0, ?int $tutup = null, array $tambah = []) use ($pdo, $u, $P, $kini) {
        $kp = $kp === 'tanpa' ? null : ($kp ?? $P);
        $pdo->prepare("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, close_price, pnl_usd, status, opened_at, closed_at, source, komp_periode)
                       VALUES (:u, :s, :d, :l, :e, :sl, :tp, :c, :p, :st, FROM_UNIXTIME(:o), IF(:t IS NULL, NULL, FROM_UNIXTIME(:t2)), :src, :kp)")
            ->execute([':u' => $u[$siapa], ':s' => $sym, ':d' => $arah, ':l' => $lot, ':e' => $entry, ':sl' => $tambah['sl'] ?? null, ':tp' => $tambah['tp'] ?? null,
                       ':c' => $pnl === null ? null : $entry, ':p' => $pnl, ':st' => $pnl === null ? 'open' : 'closed', ':o' => $buka ?: $kini - 3600,
                       ':t' => $pnl === null ? null : ($tutup ?? $kini - 1800), ':t2' => $pnl === null ? null : ($tutup ?? $kini - 1800), ':src' => $sumber, ':kp' => $kp]);
        return (int)$pdo->lastInsertId();
    };
    $pos('Ana', 'XAUUSD', 'BUY', 0.1, 4000, 500.0, 'manual', null, $kini - 7000, $kini - 6000);
    $pos('Ana', 'XAUUSD', 'BUY', 1.0, 4000, 9000.0, 'ai');             // bot: tidak dihitung
    $pos('Ana', 'XAUUSD', 'BUY', 1.0, 4000, 7000.0, 'auto');           // Ikuti Auto Analisa: tidak dihitung
    $legAna = $pos('Ana', 'BTCUSDT', 'BUY', 0.1, 80000, null);         // mengambang +100 di bid 81000
    $pos('Budi', 'EURUSD', 'SELL', 1.0, 1.1, 200.0, 'manual', null, $kini - 5000, $kini - 4000);
    $pos('Eko', 'EURUSD', 'BUY', 1.0, 1.1, 200.0, 'manual', null, $kini - 3000, $kini - 2000);
    $pos('Dedi', 'XAUUSD', 'BUY', 1.0, 4000, 9999.0);                  // akun nonaktif
    $pos('Hadi', 'XAUUSD', 'BUY', 1.0, 4000, 8888.0);                  // akun suspended
    $legFani = $pos('Fani', 'XAUUSD', 'BUY', 0.1, 4000, null);         // kutipan basi → tidak ditebak
    $pos('Gita', 'XAUUSD', 'BUY', 1.0, 4000, 3000.0, 'manual', $Plalu); // periode lain
    $pos('Gita', 'XAUUSD', 'BUY', 1.0, 4000, 700.0, 'manual', 'tanpa'); // bukan baris turnamen
    foreach (['Cici', 'Ana', 'Dedi'] as $s) {
        $pdo->prepare('INSERT INTO competition_entries (tournament_key, period_key, user_id) VALUES (?, ?, ?)')->execute([QI_KOMP_TURNAMEN, $P, $u[$s]]);
    }
    $kutipan = static fn(array $syms) => array_intersect_key([
        'BTCUSDT' => ['price' => 81000.5, 'bid' => 81000.0, 'ask' => 81001.0, 'market' => null, 'umur' => 2, 'source' => 'binance'],
        'XAUUSD'  => ['price' => 3990.0, 'bid' => 3990.0, 'ask' => 3990.4, 'market' => 'open', 'umur' => 500, 'source' => 'oanda_tv'],
    ], array_flip($syms));
    $tanda = "$tmp/tanda.json";

    echo "Pembangun papan (database sungguhan)\n";
    $papan = qi_komp_papan_bangun($pdo, $P, ['kutipan' => $kutipan, 'kini' => $kini, 'tanda_berkas' => $tanda]);
    $per = [];
    foreach ($papan['baris'] as $b) $per[array_search($b['uid'], $u, true)] = $b;
    cek('Ana: hanya posisi manual dihitung (ai +9.000 & auto +7.000 dikecualikan) — terealisasi $500', $dekat($per['Ana']['realized'] ?? null, 500), $per['Ana'] ?? null);
    cek('Ana: mengambang di BID 81.000 → +$100, ekuitas $10.600, return 6,00%', $dekat($per['Ana']['floating'], 100) && $dekat($per['Ana']['equity'], 10600) && $dekat($per['Ana']['return_pct'], 6.0), $per['Ana']);
    cek('Budi & Eko ekuitas sama $10.200 → peringkat sama (2)', ($per['Budi']['rank'] ?? 0) === 2 && ($per['Eko']['rank'] ?? 0) === 2, [$per['Budi']['rank'] ?? null, $per['Eko']['rank'] ?? null]);
    cek('Fani: kutipan XAUUSD basi & belum pernah ditandai → harga_basi, tanpa_harga 1, mengambang TIDAK ditebak', $per['Fani']['harga_basi'] === true && $per['Fani']['tanpa_harga'] === 1 && $per['Fani']['floating'] === 0.0, $per['Fani']);
    cek('Fani peringkat 4 (ekuitas $10.000 di bawah 10.200)', $per['Fani']['rank'] === 4, $per['Fani']['rank']);
    cek('Cici terdaftar tanpa trade: $10.000, 0,00%, di bawah semua trader (peringkat 5)', isset($per['Cici']) && $per['Cici']['aktif'] === false && $per['Cici']['equity'] === 10000.0 && $per['Cici']['rank'] === 5, $per['Cici'] ?? null);
    cek('akun nonaktif (Dedi) & suspended (Hadi) tidak tampil — walau Dedi terdaftar', !isset($per['Dedi']) && !isset($per['Hadi']));
    cek('Gita (posisi periode lain / bukan turnamen) tidak ada di papan periode ini', !isset($per['Gita']));
    cek('urutan papan: Ana, Budi/Eko, Fani, Cici', array_map(fn($b) => array_search($b['uid'], $u, true), $papan['baris']) === ['Ana', 'Budi', 'Eko', 'Fani', 'Cici']
        || array_map(fn($b) => array_search($b['uid'], $u, true), $papan['baris']) === ['Ana', 'Eko', 'Budi', 'Fani', 'Cici'], array_map(fn($b) => array_search($b['uid'], $u, true), $papan['baris']));
    cek('kode trader 12 heksa dan tidak sama dengan id', (bool)preg_match('/^[0-9a-f]{12}$/', $per['Ana']['kode']) && $per['Ana']['kode'] !== qi_komp_kode($u['Budi']));
    $pub = qi_komp_baris_publik($per['Ana']);
    cek('baris publik tanpa user_id', !array_key_exists('uid', $pub));
    cek('nama tanpa nama tampilan disamarkan ("Ana P.")', $per['Ana']['nama'] === 'Ana P.', $per['Ana']['nama']);
    $akt = $papan['aktivitas'];
    cek('aktivitas: kejadian buka & tutup, terbaru di atas, ≤ 30, tanpa id', count($akt) <= 30 && in_array('buka', array_column($akt, 'jenis'), true)
        && in_array('tutup', array_column($akt, 'jenis'), true) && $akt[0]['ts'] >= end($akt)['ts'] && !isset($akt[0]['uid']), array_slice($akt, 0, 3));
    cek('aktivitas tidak memuat bot, akun nonaktif, atau periode lain', !array_filter($akt, fn($k) => in_array($k['nama'], ['Dedi K.', 'Hadi W.', 'Gita S.'], true)));

    // Tanda nyata terakhir dipakai (bukan tebakan) saat kutipan basi.
    file_put_contents($tanda, json_encode([$legFani => ['mark' => 3990.0, 'ts' => $kini - 60]]));
    $papan2 = qi_komp_papan_bangun($pdo, $P, ['kutipan' => $kutipan, 'kini' => $kini, 'tanda_berkas' => $tanda]);
    foreach ($papan2['baris'] as $b) if ($b['uid'] === $u['Fani']) $fani2 = $b;
    cek('kutipan basi + ada tanda nyata terakhir → mengambang dari tanda itu (−$100), tetap ditandai harga_basi', $dekat($fani2['floating'], -100) && $fani2['harga_basi'] === true && $fani2['tanpa_harga'] === 0, $fani2);
    $cs = $pdo->query("SELECT COUNT(*) FROM competition_standings WHERE period_key = " . $pdo->quote($P) . " AND final = 0")->fetchColumn();
    cek('klasemen berjalan di-upsert ke competition_standings (final = 0)', (int)$cs === count($papan2['baris']), $cs);

    $laci = qi_komp_trader($pdo, $papan, $per['Ana']['kode'], $kutipan);
    cek('laci trader: posisi terbuka tanpa SL/TP dan riwayat penutupan manual', $laci && count($laci['posisi']) === 1 && !isset($laci['posisi'][0]['sl'])
        && count($laci['tutup']) === 1 && $dekat($laci['tutup'][0]['pnl'], 500), $laci);
    cek('laci: kode tak dikenal → null', qi_komp_trader($pdo, $papan, 'ffffffffffff', $kutipan) === null);

    // ── qi_paper_settle ─────────────────────────────────────────────────────────
    echo "Penyelesaian server (qi_paper_settle)\n";
    // Uji tidak boleh membaca cache/kompetisi sungguhan (kutipan akhir periode, tanda papan): id posisi di
    // database sementara bisa sama dengan id posisi lokal yang nyata.
    $tanpaAkhir = static fn() => null;
    $pdo->exec('DELETE FROM paper_positions');
    $buka = $kini - 600 - ($kini % 60) + 30;                   // dibuka di tengah menit
    $m0 = (int)ceil($buka / 60) * 60;                          // bar penuh pertama setelah buka
    $idGap = $pos('Ana', 'XAUUSD', 'BUY', 0.1, 4000, null, 'manual', null, $buka, null, ['sl' => 3990, 'tp' => 4020]);
    $idDua = $pos('Budi', 'XAUUSD', 'SELL', 0.1, 4000, null, 'manual', null, $buka, null, ['sl' => 4010, 'tp' => 3990]);
    $idDiam = $pos('Eko', 'EURUSD', 'BUY', 0.1, 1.1, null, 'manual', null, $buka, null, ['sl' => 1.09, 'tp' => 1.12]);
    $idAman = $pos('Cici', 'BTCUSDT', 'BUY', 0.01, 80000, null, 'manual', null, $buka, null, ['sl' => 79000, 'tp' => 82000]);
    $barXau = [$bar($m0 - 60, 3950, 3951, 3940, 3945),          // bar tempat posisi dibuka — TIDAK dipakai
               $bar($m0, 4001, 4005, 3995, 4000), $bar($m0 + 60, 3985, 3988, 3980, 3984)];
    $barXauDua = [$bar($m0, 4000, 4012, 3985, 4000)];
    $m1 = function (string $sym, int $dari, ?string $sumber) use ($barXau, $barXauDua, $m0) {
        if ($sym === 'XAUUSD') return ['bars' => $GLOBALS['__dua'] ? $barXauDua : $barXau];
        if ($sym === 'BTCUSDT') return ['bars' => [['time' => $m0, 'open' => 80100, 'high' => 80500, 'low' => 79800, 'close' => 80200]]];
        return ['bars' => []];
    };
    $kut = static fn(array $syms) => array_intersect_key([
        'XAUUSD'  => ['price' => 3984.0, 'bid' => 3984.0, 'ask' => 3984.4, 'market' => 'open', 'umur' => 2, 'source' => 'oanda_tv'],
        'BTCUSDT' => ['price' => 80200.0, 'bid' => 80200.0, 'ask' => 80200.5, 'market' => null, 'umur' => 2, 'source' => 'binance'],
    ], array_flip($syms));                                     // EURUSD: tidak ada kutipan sama sekali
    $GLOBALS['__dua'] = false;
    $h = qi_paper_settle($pdo, $u['Ana'], ['kutipan' => $kut, 'm1' => $m1, 'kini' => $kini, 'penanda_skema' => $penanda . '2', 'akhir' => $tanpaAkhir, 'tanda' => []]);
    $r = $pdo->query("SELECT status, close_price, pnl_usd, close_reason, UNIX_TIMESTAMP(closed_at) AS t FROM paper_positions WHERE id = $idGap")->fetch();
    cek('gap melewati SL: ditutup di OPEN bar 3985 (bukan 3990), close_reason sl, waktu = bar', $r['status'] === 'closed' && $dekat($r['close_price'], 3985) && $r['close_reason'] === 'sl' && (int)$r['t'] === $m0 + 60, $r);
    cek('P/L dihitung server: (3985 − 4000) × 0,1 × 100 = −$150', $dekat($r['pnl_usd'], -150), $r);
    cek('hanya posisi pemanggil yang disentuh (Budi tetap terbuka)', $pdo->query("SELECT status FROM paper_positions WHERE id = $idDua")->fetchColumn() === 'open');
    $GLOBALS['__dua'] = true;
    qi_paper_settle($pdo, $u['Budi'], ['kutipan' => $kut, 'm1' => $m1, 'kini' => $kini, 'penanda_skema' => $penanda . '2', 'akhir' => $tanpaAkhir, 'tanda' => []]);
    $r = $pdo->query("SELECT status, close_price, close_reason FROM paper_positions WHERE id = $idDua")->fetch();
    cek('SL & TP tersentuh di satu bar → SL di 4010', $r['status'] === 'closed' && $r['close_reason'] === 'sl' && $dekat($r['close_price'], 4010), $r);
    qi_paper_settle($pdo, null, ['kutipan' => $kut, 'm1' => $m1, 'kini' => $kini, 'penanda_skema' => $penanda . '2', 'akhir' => $tanpaAkhir, 'tanda' => []]);
    $r = $pdo->query("SELECT status, sltp_checked_at FROM paper_positions WHERE id = $idDiam")->fetch();
    cek('tanpa bar & tanpa kutipan (EURUSD) → posisi TIDAK disentuh, sltp_checked_at tidak bergerak', $r['status'] === 'open' && $r['sltp_checked_at'] === null, $r);
    $r = $pdo->query("SELECT status, UNIX_TIMESTAMP(sltp_checked_at) AS cek FROM paper_positions WHERE id = $idAman")->fetch();
    cek('bar tanpa sentuhan → tetap terbuka, sltp_checked_at = akhir bar yang sudah diperiksa', $r['status'] === 'open' && (int)$r['cek'] === $m0 + 60, $r);

    echo "Stop-out\n";
    $pdo->exec('DELETE FROM paper_positions');
    $a1 = $pos('Ana', 'XAUUSD', 'BUY', 2.0, 4000, null);       // margin $8.000, rugi besar
    $a2 = $pos('Ana', 'BTCUSDT', 'BUY', 0.05, 80000, null);    // margin $40, untung kecil
    $kutJatuh = static fn(array $syms) => array_intersect_key([
        'XAUUSD'  => ['price' => 3955.0, 'bid' => 3955.0, 'ask' => 3955.4, 'market' => 'open', 'umur' => 1, 'source' => 'oanda_tv'],
        'BTCUSDT' => ['price' => 80100.0, 'bid' => 80100.0, 'ask' => 80100.5, 'market' => null, 'umur' => 1, 'source' => 'binance'],
    ], array_flip($syms));
    $akunSebelum = qi_komp_akun_db($pdo, $u['Ana'], $P, $kutJatuh($P ? ['XAUUSD', 'BTCUSDT'] : []));
    cek('sebelum: level margin di bawah 50% (ekuitas ≈ $1.005 ÷ margin $8.040)', $akunSebelum['level_margin'] !== null && $akunSebelum['level_margin'] < 50, $akunSebelum['level_margin']);
    $h = qi_paper_settle($pdo, $u['Ana'], ['kutipan' => $kutJatuh, 'm1' => fn() => ['bars' => []], 'kini' => $kini, 'penanda_skema' => $penanda . '2', 'akhir' => $tanpaAkhir, 'tanda' => []]);
    $r1 = $pdo->query("SELECT status, close_price, close_reason FROM paper_positions WHERE id = $a1")->fetch();
    $r2 = $pdo->query("SELECT status FROM paper_positions WHERE id = $a2")->fetchColumn();
    cek('stop-out menutup posisi PALING RUGI di harga eksekusi server (bid 3955)', $r1['status'] === 'closed' && $r1['close_reason'] === 'stopout' && $dekat($r1['close_price'], 3955), $r1);
    cek('setelah level pulih, posisi lain dibiarkan', $r2 === 'open', $r2);

    echo "Akhir periode & klasemen beku\n";
    $pdo->exec('DELETE FROM paper_positions');
    $pdo->exec('DELETE FROM competition_standings');
    [$mulaiLalu, $batasLalu] = qi_komp_batas_periode($Plalu);
    $l1 = $pos('Gita', 'XAUUSD', 'BUY', 0.1, 4000, null, 'manual', $Plalu, $mulaiLalu + 3600);
    $l2 = $pos('Budi', 'EURUSD', 'BUY', 0.1, 1.1, null, 'manual', $Plalu, $mulaiLalu + 3600);
    $pos('Eko', 'XAUUSD', 'BUY', 0.1, 4000, 250.0, 'manual', $Plalu, $mulaiLalu + 3600, $mulaiLalu + 7200);
    $sebelum = static fn(string $sym, int $batas, ?string $sumber) => $sym === 'XAUUSD' ? ['harga' => 4010.0, 'ts' => $batas - 60] : null;
    $h = qi_paper_settle($pdo, null, ['kutipan' => $kut, 'm1' => fn() => ['bars' => []], 'sebelum' => $sebelum, 'kini' => $kini, 'penanda_skema' => $penanda . '2', 'akhir' => $tanpaAkhir, 'tanda' => [], 'batal_setelah' => PHP_INT_MAX]);
    $r = $pdo->query("SELECT status, close_price, pnl_usd, close_reason, UNIX_TIMESTAMP(closed_at) AS t FROM paper_positions WHERE id = $l1")->fetch();
    cek('posisi periode lalu ditutup di harga terakhir sebelum batas (4010), close_reason period_end', $r['status'] === 'closed' && $r['close_reason'] === 'period_end' && $dekat($r['close_price'], 4010) && $dekat($r['pnl_usd'], 100), $r);
    cek('waktu tutupnya di dalam periode itu (≤ batas − 1)', (int)$r['t'] <= $batasLalu - 1 && (int)$r['t'] >= $batasLalu - 60, [$r['t'], $batasLalu]);
    $r = $pdo->query("SELECT status FROM paper_positions WHERE id = $l2")->fetchColumn();
    cek('tanpa harga di batas (EURUSD) → TIDAK ditebak, tetap terbuka & dilaporkan menunggu_harga', $r === 'open' && count($h['menunggu_harga']) === 1, $h['menunggu_harga']);
    cek('periode yang masih punya posisi terbuka BELUM dibekukan', (int)$pdo->query("SELECT COUNT(*) FROM competition_standings WHERE period_key = " . $pdo->quote($Plalu) . " AND final = 1")->fetchColumn() === 0);
    $pdo->exec("UPDATE paper_positions SET status = 'closed', close_price = 1.1, pnl_usd = 0, closed_at = FROM_UNIXTIME($batasLalu - 5), close_reason = 'manual' WHERE id = $l2");
    cek('setelah semua tertutup: qi_komp_bekukan() membekukan klasemen', qi_komp_bekukan($pdo, $Plalu, $kini) === true);
    $beku = qi_komp_papan_final($pdo, $Plalu);
    $nama = array_column($beku['baris'], 'nama');
    cek('klasemen beku menurut ekuitas akhir: Eko 10.250, Gita 10.100 (period_end), Budi 10.000', $nama === ['Eko P.', 'Gita S.', 'Budi S.'], $beku['baris']);
    qi_komp_simpan_klasemen($pdo, $Plalu, [['uid' => $u['Budi'], 'equity' => 99999.0, 'realized' => 0.0, 'floating' => 0.0, 'open_count' => 0, 'trades' => 1, 'menang' => 1, 'rank' => 1]], false);
    $eq = (float)$pdo->query("SELECT equity FROM competition_standings WHERE period_key = " . $pdo->quote($Plalu) . " AND user_id = {$u['Budi']}")->fetchColumn();
    cek('baris beku tidak bisa ditimpa upsert berikutnya', $dekat($eq, 10000), $eq);
    cek('bekukan dua kali → tidak apa-apa (false)', qi_komp_bekukan($pdo, $Plalu, $kini) === false);
} finally {
    $pdo->exec("DROP DATABASE IF EXISTS `$db`");
    array_map('unlink', glob("$tmp/*") ?: []);
    @rmdir($tmp);
}

echo $gagal ? "FAIL — $gagal gagal\n" : "PASS\n";
exit($gagal ? 1 : 0);
