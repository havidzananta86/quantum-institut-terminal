<?php
/**
 * AUTO ANALISA → AKUN SIMULASI (paper trading otomatis).
 *
 * Pengguna yang mengaktifkan "Ikuti Auto Analisa" otomatis membuka posisi SIMULASI untuk setiap sinyal
 * resmi Auto Analisa (engine AUTO_SIGNAL, riwayat sinyal), dengan level yang SAMA PERSIS (entry, SL, TP).
 * Saat sinyal dinilai HIT TP / HIT SL (api/signal-evaluator.php), posisi ikut ditutup di harga TP/SL:
 *   · kena SL  → saldo simulasi BERKURANG sebesar risiko (≈ risiko% × saldo),
 *   · kena TP  → saldo simulasi BERTAMBAH sebesar risiko × R:R.
 * Uang virtual saja — tidak ada order sungguhan. Saldo = 10.000 + total P/L posisi tertutup
 * (rumus yang sama dengan api/paper-trading.php), jadi tampil di mana pun saldo simulasi dipakai.
 *
 * Ukuran lot dihitung dari risiko: lot = (saldo × risiko%) ÷ (jarak entry→SL × nilai kontrak per lot).
 * Posisi bersumber 'auto' dikecualikan dari Competition & leaderboard (hadiah untuk trader manual).
 *
 * Fungsi pemilih (qi_ap_pilih_*) dan qi_ap_lot() MURNI (tanpa DB) supaya bisa diuji; qi_ap_sinkron()
 * hanya membungkusnya dengan baca/tulis database.
 */
declare(strict_types=1);

require_once __DIR__ . '/_paper_math.php';
require_once __DIR__ . '/_signal_time.php';
require_once __DIR__ . '/_batas_rugi.php';

if (!function_exists('qi_ap_konfig')) :

function qi_ap_konfig(): array
{
    return [
        'saldo_awal'      => 10000.0,
        'risiko_awal'     => 1.0,        // % saldo per sinyal (bawaan)
        'risiko_min'      => 0.25,
        'risiko_maks'     => 5.0,
        'maks_terbuka'    => 5,
        'umur_maks_menit' => 60,         // sinyal lebih tua dari ini tidak diikuti (entry sudah basi)
        'umur_tautan_jam' => 72,         // sinyal hilang dari riwayat setelah ini → posisi dibatalkan
        'lot_min'         => 0.01,
        'lot_maks'        => 100.0,
        'simbol'          => ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'XRPUSDT', 'DOGEUSDT'],
    ];
}

/**
 * Ukuran lot dari risiko.
 * @return array{lots: float, risiko_usd: float, risiko_target: float, alasan: ?string}
 */
function qi_ap_lot(string $simbol, float $entry, float $sl, float $saldo, float $risikoPct, ?array $k = null): array
{
    $k = $k ?? qi_ap_konfig();
    $target = max(0.0, $saldo) * $risikoPct / 100;
    $perLot = abs($entry - $sl) * qi_paper_pip_mult($simbol, $sl);
    if ($target <= 0 || $perLot <= 0) return ['lots' => 0.0, 'risiko_usd' => 0.0, 'risiko_target' => round($target, 2), 'alasan' => 'saldo_atau_jarak_sl_tidak_valid'];
    $lots = floor($target / $perLot / $k['lot_min']) * $k['lot_min'];
    if ($lots < $k['lot_min']) {
        $lots = $k['lot_min'];
        // Lot minimum berisiko jauh di atas target (saldo kecil / SL lebar) → jangan memaksa.
        if ($lots * $perLot > 2 * $target) return ['lots' => 0.0, 'risiko_usd' => round($lots * $perLot, 2), 'risiko_target' => round($target, 2), 'alasan' => 'lot_minimum_melebihi_risiko'];
    }
    $lots = min($lots, $k['lot_maks']);
    return ['lots' => round($lots, 2), 'risiko_usd' => round($lots * $perLot, 2), 'risiko_target' => round($target, 2), 'alasan' => null];
}

/**
 * Sinyal mana yang harus dibuka sebagai posisi simulasi untuk SATU pengguna.
 *
 * @param array $p  ['aktif_sejak' => epoch, 'risiko' => %]
 * @param array $riwayat      riwayat sinyal resmi (baru → lama atau sebaliknya)
 * @param array $tertaut      set id sinyal yang sudah diikuti pengguna ini (id => true)
 * @param array $terbukaAuto  simbol yang saat ini punya posisi 'auto' terbuka (list string)
 * @return array{buka: array<int,array>, lewat: array<int,array>}
 */
function qi_ap_pilih_buka(array $p, array $riwayat, array $tertaut, array $terbukaAuto, float $saldo, int $kini, ?array $k = null): array
{
    $k = $k ?? qi_ap_konfig();
    $kandidat = [];
    foreach ($riwayat as $s) {
        if (!is_array($s) || ($s['status'] ?? '') !== 'AKTIF') continue;
        if (($s['sumber'] ?? '') !== 'auto_generator') continue;           // hanya sinyal Auto Analisa
        $id = (string)($s['id'] ?? '');
        if ($id === '' || isset($tertaut[$id])) continue;
        $t = qi_sig_epoch($s['timestamp'] ?? null);
        if ($t === null || $t < $p['aktif_sejak']) continue;               // sebelum fitur dinyalakan
        $kandidat[] = ['t' => $t, 's' => $s];
    }
    usort($kandidat, fn($a, $b) => $a['t'] <=> $b['t']);                   // yang tertua dulu

    $buka = []; $lewat = [];
    $punya = array_flip(array_map('strtoupper', $terbukaAuto));
    $jumlah = count($terbukaAuto);
    foreach ($kandidat as $c) {
        $s = $c['s'];
        $sim = strtoupper((string)$s['symbol']);
        $side = strtoupper((string)($s['side'] ?? ''));
        $entry = (float)($s['entry'] ?? 0); $sl = (float)($s['sl'] ?? 0); $tp = (float)($s['tp'] ?? 0);
        $alasan = null;
        if (!in_array($sim, $k['simbol'], true)) $alasan = 'simbol_tidak_didukung';
        elseif (!in_array($side, ['BUY', 'SELL'], true) || $entry <= 0 || $sl <= 0 || $tp <= 0) $alasan = 'level_tidak_valid';
        elseif ($side === 'BUY' ? !($tp > $entry && $entry > $sl) : !($tp < $entry && $entry < $sl)) $alasan = 'level_tidak_konsisten';
        elseif (($kini - $c['t']) > $k['umur_maks_menit'] * 60) $alasan = 'terlambat';
        elseif (isset($punya[$sim])) $alasan = 'simbol_sudah_punya_posisi';
        elseif ($jumlah >= $k['maks_terbuka']) $alasan = 'batas_posisi_terbuka';
        $lot = null;
        if ($alasan === null) {
            $lot = qi_ap_lot($sim, $entry, $sl, $saldo, (float)$p['risiko'], $k);
            if ($lot['lots'] <= 0) $alasan = (string)$lot['alasan'];
        }
        if ($alasan !== null) { $lewat[] = ['id' => (string)$s['id'], 'symbol' => $sim, 'alasan' => $alasan]; continue; }
        $buka[] = ['signal_id' => (string)$s['id'], 'symbol' => $sim, 'side' => $side, 'entry' => $entry, 'sl' => $sl, 'tp' => $tp,
                   'lots' => $lot['lots'], 'risiko_usd' => $lot['risiko_usd'], 'risiko_target' => $lot['risiko_target']];
        $punya[$sim] = true; $jumlah++;
    }
    return ['buka' => $buka, 'lewat' => $lewat];
}

/**
 * Posisi simulasi terbuka mana yang harus ditutup, mengikuti hasil sinyal.
 *
 * @param array $tertaut        list ['signal_id','position_id','symbol','side','entry','lots','dibuat_ts']
 * @param array $riwayatPerId   id sinyal → baris sinyal
 * @param callable|null $harga  fn(string $simbol): ?float  harga terakhir (untuk sinyal EXPIRED)
 * @return array<int,array> [position_id, status 'closed'|'cancelled', exit, closed_ts, alasan, pnl]
 */
function qi_ap_pilih_tutup(array $tertaut, array $riwayatPerId, ?callable $harga, int $kini, ?array $k = null): array
{
    $k = $k ?? qi_ap_konfig();
    $hasil = [];
    foreach ($tertaut as $t) {
        $s = $riwayatPerId[$t['signal_id']] ?? null;
        if ($s === null) {
            if (($kini - (int)$t['dibuat_ts']) > $k['umur_tautan_jam'] * 3600) {
                $hasil[] = ['position_id' => $t['position_id'], 'status' => 'cancelled', 'exit' => null, 'closed_ts' => $kini, 'alasan' => 'sinyal_hilang_dari_riwayat', 'pnl' => 0.0];
            }
            continue;
        }
        $st = (string)($s['status'] ?? '');
        $tTutup = qi_sig_epoch($s['closed_at'] ?? null) ?? $kini;
        if (strpos($st, 'HIT TP') === 0 || strpos($st, 'HIT SL') === 0) {
            $tp = strpos($st, 'HIT TP') === 0;
            $keluar = (float)($tp ? $s['tp'] : $s['sl']);
            $hasil[] = ['position_id' => $t['position_id'], 'status' => 'closed', 'exit' => $keluar, 'closed_ts' => $tTutup, 'alasan' => $tp ? 'TP' : 'SL',
                        'pnl' => qi_paper_pnl((string)$t['symbol'], (string)$t['side'], (float)$t['entry'], $keluar, (float)$t['lots'])];
        } elseif (strpos($st, 'EXPIRED') === 0) {
            $px = $harga ? $harga((string)$t['symbol']) : null;
            if ($px !== null && $px > 0) {
                $hasil[] = ['position_id' => $t['position_id'], 'status' => 'closed', 'exit' => $px, 'closed_ts' => $kini, 'alasan' => 'EXPIRED',
                            'pnl' => qi_paper_pnl((string)$t['symbol'], (string)$t['side'], (float)$t['entry'], $px, (float)$t['lots'])];
            } else {
                $hasil[] = ['position_id' => $t['position_id'], 'status' => 'cancelled', 'exit' => null, 'closed_ts' => $kini, 'alasan' => 'EXPIRED_tanpa_harga', 'pnl' => 0.0];
            }
        }
    }
    return $hasil;
}

// ── Database ────────────────────────────────────────────────────────────────

function qi_ap_tabel(PDO $pdo): void
{
    static $siap = false;
    if ($siap) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS auto_paper_settings (
        user_id INT UNSIGNED NOT NULL PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        risk_pct DECIMAL(4,2) NOT NULL DEFAULT 1.00,
        enabled_at INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS auto_paper_links (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        signal_id VARCHAR(64) NOT NULL,
        position_id INT UNSIGNED NOT NULL,
        risk_usd DECIMAL(14,2) NOT NULL DEFAULT 0,
        created_at INT UNSIGNED NOT NULL,
        UNIQUE KEY uq_user_signal (user_id, signal_id),
        KEY idx_position (position_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $siap = true;
}

function qi_ap_saldo(PDO $pdo, int $uid): float
{
    $st = $pdo->prepare("SELECT COALESCE(SUM(pnl_usd), 0) FROM paper_positions WHERE user_id = :u AND status = 'closed'");
    $st->execute([':u' => $uid]);
    return round(qi_ap_konfig()['saldo_awal'] + (float)$st->fetchColumn(), 2);
}

/**
 * Sinkronkan: buka posisi untuk sinyal baru, tutup posisi yang sinyalnya sudah selesai.
 * @param array         $riwayat  riwayat sinyal resmi (array dari cache/signal_history.json)
 * @param int|null      $hanyaUser membatasi pembukaan ke satu pengguna (penutupan selalu untuk semua)
 * @param callable|null $harga    fn(string $simbol): ?float untuk sinyal EXPIRED
 */
function qi_ap_sinkron(PDO $pdo, array $riwayat, ?int $hanyaUser = null, ?callable $harga = null, ?int $kini = null): array
{
    $kini = $kini ?? time();
    $k = qi_ap_konfig();
    qi_ap_tabel($pdo);
    $ringkas = ['dibuka' => 0, 'ditutup' => 0, 'dibatalkan' => 0, 'lewat' => []];

    $perId = [];
    foreach ($riwayat as $s) if (is_array($s) && isset($s['id'])) $perId[(string)$s['id']] = $s;

    // 1) Tutup posisi yang sinyalnya sudah selesai (semua pengguna, termasuk yang sudah mematikan fitur).
    $q = $pdo->query("SELECT l.user_id, l.signal_id, l.position_id, l.created_at AS dibuat_ts, p.symbol, p.direction AS side, p.entry_price AS entry, p.lots
                      FROM auto_paper_links l JOIN paper_positions p ON p.id = l.position_id
                      WHERE p.status = 'open' AND p.source = 'auto'");
    $terbuka = $q->fetchAll(PDO::FETCH_ASSOC);
    if ($terbuka) {
        $aksi = qi_ap_pilih_tutup($terbuka, $perId, $harga, $kini, $k);
        $tutup = $pdo->prepare("UPDATE paper_positions SET status = 'closed', close_price = :c, pnl_usd = :pnl, closed_at = FROM_UNIXTIME(:ts) WHERE id = :id AND status = 'open' AND source = 'auto'");
        $batal = $pdo->prepare("UPDATE paper_positions SET status = 'cancelled', closed_at = FROM_UNIXTIME(:ts) WHERE id = :id AND status = 'open' AND source = 'auto'");
        foreach ($aksi as $a) {
            if ($a['status'] === 'closed') {
                $tutup->execute([':c' => $a['exit'], ':pnl' => $a['pnl'], ':ts' => $a['closed_ts'], ':id' => $a['position_id']]);
                if ($tutup->rowCount()) $ringkas['ditutup']++;
            } else {
                $batal->execute([':ts' => $a['closed_ts'], ':id' => $a['position_id']]);
                if ($batal->rowCount()) $ringkas['dibatalkan']++;
            }
        }
    }

    // 2) Buka posisi untuk sinyal baru, per pengguna yang mengaktifkan fitur.
    $sql = 'SELECT user_id, risk_pct, enabled_at FROM auto_paper_settings WHERE enabled = 1' . ($hanyaUser !== null ? ' AND user_id = ' . (int)$hanyaUser : '');
    foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $uid = (int)$u['user_id'];
        $pdo->beginTransaction();
        try {
            $saldo = qi_ap_saldo($pdo, $uid);
            $st = $pdo->prepare("SELECT symbol FROM paper_positions WHERE user_id = :u AND status = 'open' AND source = 'auto' FOR UPDATE");
            $st->execute([':u' => $uid]);
            $terbukaAuto = $st->fetchAll(PDO::FETCH_COLUMN);
            $st = $pdo->prepare('SELECT signal_id FROM auto_paper_links WHERE user_id = :u');
            $st->execute([':u' => $uid]);
            $tertaut = array_fill_keys($st->fetchAll(PDO::FETCH_COLUMN), true);

            // Batas rugi harian tercapai → tidak membuka posisi baru (penutupan di langkah 1 tetap jalan). Sinyal tidak
            // ditautkan, jadi bila batas naik/hari berganti sinyal yang masih segar (umur_maks_menit) tetap bisa diikuti.
            if (qi_batas_rugi_status($pdo, $uid, $kini)['tercapai']) {
                $ringkas['lewat'][] = ['id' => '*', 'symbol' => '*', 'alasan' => 'batas_rugi_harian', 'user' => $uid];
                $pdo->commit();
                continue;
            }
            $rencana = qi_ap_pilih_buka(['aktif_sejak' => (int)$u['enabled_at'], 'risiko' => (float)$u['risk_pct']], $riwayat, $tertaut, $terbukaAuto, $saldo, $kini, $k);
            $ins = $pdo->prepare("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, status, opened_at, source)
                                  VALUES (:u, :s, :d, :l, :e, :sl, :tp, 'open', NOW(), 'auto')");
            $tautan = $pdo->prepare('INSERT IGNORE INTO auto_paper_links (user_id, signal_id, position_id, risk_usd, created_at) VALUES (:u, :sig, :pos, :r, :t)');
            foreach ($rencana['buka'] as $b) {
                $ins->execute([':u' => $uid, ':s' => $b['symbol'], ':d' => $b['side'], ':l' => $b['lots'], ':e' => $b['entry'], ':sl' => $b['sl'], ':tp' => $b['tp']]);
                $posId = (int)$pdo->lastInsertId();
                $tautan->execute([':u' => $uid, ':sig' => $b['signal_id'], ':pos' => $posId, ':r' => $b['risiko_usd'], ':t' => $kini]);
                $ringkas['dibuka']++;
            }
            // Sinyal yang dilewati (terlambat, simbol sudah punya posisi, dst.) ditautkan agar tidak dinilai ulang tiap putaran.
            foreach ($rencana['lewat'] as $l) {
                if (in_array($l['alasan'], ['terlambat', 'level_tidak_valid', 'level_tidak_konsisten', 'simbol_tidak_didukung'], true)) {
                    $tautan->execute([':u' => $uid, ':sig' => $l['id'], ':pos' => 0, ':r' => 0, ':t' => $kini]);
                }
                $ringkas['lewat'][] = $l + ['user' => $uid];
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('[QI AutoPaper] ' . $e->getMessage());
        }
    }
    return $ringkas;
}

/** Data untuk kartu "Ikuti Auto Analisa": pengaturan, saldo, posisi, bertambah/berkurang, transaksi terbaru. */
function qi_ap_ringkasan(PDO $pdo, int $uid, ?int $kini = null): array
{
    $kini = $kini ?? time();
    $k = qi_ap_konfig();
    qi_ap_tabel($pdo);
    $st = $pdo->prepare('SELECT enabled, risk_pct, enabled_at FROM auto_paper_settings WHERE user_id = :u');
    $st->execute([':u' => $uid]);
    $set = $st->fetch(PDO::FETCH_ASSOC) ?: ['enabled' => 0, 'risk_pct' => $k['risiko_awal'], 'enabled_at' => 0];

    $rows = $pdo->prepare("SELECT p.*, UNIX_TIMESTAMP(p.opened_at) AS opened_ts, UNIX_TIMESTAMP(p.closed_at) AS closed_ts, l.risk_usd, l.signal_id
                           FROM paper_positions p LEFT JOIN auto_paper_links l ON l.position_id = p.id
                           WHERE p.user_id = :u AND p.source = 'auto' ORDER BY p.id DESC LIMIT 300");
    $rows->execute([':u' => $uid]);

    $wib = new DateTimeZone('Asia/Jakarta');
    $awalHari = (new DateTimeImmutable('@' . $kini))->setTimezone($wib)->setTime(0, 0)->getTimestamp();
    $terbuka = []; $terbaru = [];
    $tot = ['bertambah' => 0.0, 'berkurang' => 0.0, 'tp' => 0, 'sl' => 0, 'lain' => 0];
    $hari = $tot;
    foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $iso = fn($ts) => $ts ? gmdate('Y-m-d\TH:i:s\Z', (int)$ts) : null;
        if ($r['status'] === 'open') {
            $terbuka[] = ['id' => (int)$r['id'], 'symbol' => $r['symbol'], 'side' => $r['direction'], 'lots' => (float)$r['lots'], 'entry' => (float)$r['entry_price'],
                          'sl' => (float)$r['stop_loss'], 'tp' => (float)$r['take_profit'], 'risiko_usd' => (float)$r['risk_usd'], 'dibuka' => $iso($r['opened_ts'])];
            continue;
        }
        if ($r['status'] !== 'closed') continue;
        $pnl = (float)$r['pnl_usd'];
        $perLot = abs((float)$r['entry_price'] - (float)$r['stop_loss']) * qi_paper_pip_mult((string)$r['symbol'], (float)$r['stop_loss']);
        $risiko = $perLot * (float)$r['lots'];
        $tambah = static function (array &$g, float $pnl): void {
            if ($pnl > 0) { $g['bertambah'] += $pnl; $g['tp']++; }
            elseif ($pnl < 0) { $g['berkurang'] += -$pnl; $g['sl']++; }
            else $g['lain']++;
        };
        $tambah($tot, $pnl);
        if ((int)$r['closed_ts'] >= $awalHari) $tambah($hari, $pnl);
        if (count($terbaru) < 20) {
            $terbaru[] = ['symbol' => $r['symbol'], 'side' => $r['direction'], 'lots' => (float)$r['lots'], 'entry' => (float)$r['entry_price'], 'exit' => (float)$r['close_price'],
                          'pnl' => round($pnl, 2), 'hasil' => $pnl > 0 ? 'TP' : ($pnl < 0 ? 'SL' : 'IMPAS'), 'r' => $risiko > 0 ? round($pnl / $risiko, 2) : null, 'ditutup' => $iso($r['closed_ts'])];
        }
    }
    $fin = fn(array $g) => ['bertambah' => round($g['bertambah'], 2), 'berkurang' => round($g['berkurang'], 2), 'bersih' => round($g['bertambah'] - $g['berkurang'], 2),
                            'tp' => $g['tp'], 'sl' => $g['sl'], 'lain' => $g['lain']];
    return [
        'aktif'      => (bool)$set['enabled'],
        'risiko_pct' => (float)$set['risk_pct'],
        'batas'      => ['risiko_min' => $k['risiko_min'], 'risiko_maks' => $k['risiko_maks'], 'maks_terbuka' => $k['maks_terbuka']],
        'saldo'      => qi_ap_saldo($pdo, $uid),
        'saldo_awal' => $k['saldo_awal'],
        'hari_ini'   => $fin($hari),
        'total'      => $fin($tot),
        'terbuka'    => $terbuka,
        'terbaru'    => $terbaru,
    ];
}

endif;
