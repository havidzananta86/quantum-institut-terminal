<?php
/**
 * PENYELESAIAN SERVER — SL/TP, stop-out, dan akhir periode untuk posisi paper MANUAL.
 *
 * MENGAPA (audit kompetisi 2026-10-22):
 *   · SL/TP posisi manual dulu hanya ditegakkan guardTick di dashboard (sisi klien, hanya selama
 *     tab dashboard terbuka). Arena tidak memuat penjaga itu sama sekali: BUY dengan SL $10 di bawah
 *     entry tetap terbuka setelah harga menembus SL, rugi tidak pernah terealisasi, dan papan yang
 *     hanya menghitung posisi tertutup menyembunyikannya.
 *   · Tidak ada margin / stop-out: akun −$200.000 tetap boleh membuka 100 lot lagi.
 *   · Tidak ada penyelesaian akhir periode: posisi bisa dibawa ke minggu berikutnya.
 *
 * ATURAN (tidak pernah menebak harga):
 *   · Bar M1 dari sumber yang SAMA dengan kutipan kanonik (api/_kompetisi_harga.php) diperiksa
 *     sejak max(waktu buka, sltp_checked_at). Bar tempat posisi dibuka TIDAK dipakai (sebagian
 *     isinya terjadi sebelum posisi ada).
 *       BUY : low ≤ SL → keluar di min(SL, open bar) — gap melewati SL keluar di open bar;
 *             selain itu high ≥ TP → keluar di max(TP, open bar).
 *       SELL: cermin. SL dan TP tersentuh di bar yang sama → SL (anggapan konservatif).
 *       Seri bar berbasis BID (MT5, OANDA): SELL ditutup di ASK, jadi barnya digeser + spread
 *       (qi_komp_bar_bid). Kline Binance = harga transaksi, dipakai apa adanya untuk kedua sisi.
 *   · Tanpa bar: kutipan kanonik segar (≤10 dtk, pasar buka). SL = order stop → keluar di harga
 *     pasar saat itu (tidak pernah lebih baik dari SL); TP = order limit → keluar TEPAT di TP.
 *   · Tidak ada bar dan tidak ada kutipan segar → posisi tidak disentuh.
 *   · Setiap posisi dinilai di SERI HARGANYA SENDIRI (qi_komp_kutipan_posisi): XAUUSD yang diisi di
 *     emas nyata tidak pernah ditandai/ditutup di PROKSI PAXG, dan sebaliknya (audit G1).
 *   · Stop-out: selama ekuitas ÷ margin terpakai < 50%, posisi dengan rugi mengambang terbesar
 *     ditutup di harga eksekusi server (qi_paper_harga_eksekusi). Kaki yang sedang tanpa harga
 *     dihitung di TANDA NYATA terakhirnya (berkas tanda papan) — dulu satu kaki tanpa harga
 *     mematikan stop-out seluruh akun (audit G1). Tanpa tanda sama sekali → berhenti, tidak menebak.
 *   · Akhir periode: posisi periode lalu yang masih terbuka ditutup di harga nyata TERAKHIR sebelum
 *     batas periode, berurutan: close bar M1 terakhir sebelum batas (seri posisi) → kutipan pasar-
 *     tutup yang tick-nya sebelum batas → kutipan kanonik terakhir yang TERCATAT dalam periode itu
 *     (qi_komp_kutipan_akhir). Tanpa semua itu posisi dilaporkan 'menunggu_harga'; 72 jam setelah
 *     batas posisi itu DIBATALKAN (status 'cancelled', tanpa P/L) — tidak pernah ditutup di harga
 *     tebakan, dan pemiliknya tidak bisa lagi menutupnya di harga pilihannya sendiri (api/paper-
 *     trading.php menolak 'tutup'/'ubah' untuk posisi periode lalu). Setelah semua posisi periode itu
 *     selesai, klasemen akhirnya dibekukan (competition_standings.final = 1).
 *
 * Dipanggil: api/paper-trading.php (GET/POST, untuk pemanggil), pembangun papan api/competition.php
 * (semua pengguna, paling sering tiap 10 dtk), dan api/alert-cron.php (cron).
 */

require_once __DIR__ . '/_kompetisi_harga.php';
require_once __DIR__ . '/_paper_order.php';

if (!function_exists('qi_paper_sltp_jalan')) {
    /**
     * Jalankan bar M1 untuk satu posisi. Murni.
     * @param int   $mulai      epoch: bar dengan time < $mulai diabaikan
     * @param int   $kini       epoch sekarang (bar yang belum selesai tetap dinilai, tetapi tidak dicatat "sudah diperiksa")
     * @param float $spreadJual seri bar berbasis bid: SELL dinilai di bar + spread (sisi ask); 0 = seri apa adanya
     * @return array{kena:?array{harga:float,alasan:string,ts:int},periksa:?int}
     *         periksa = epoch awal bar pertama yang BELUM selesai diperiksa (untuk sltp_checked_at)
     */
    function qi_paper_sltp_jalan(string $arah, ?float $sl, ?float $tp, array $bars, int $mulai, int $kini, float $spreadJual = 0.0): array
    {
        usort($bars, static fn($a, $b) => (int)$a['time'] <=> (int)$b['time']);
        $periksa = null;
        $beli = $arah === 'BUY';
        $geser = $beli ? 0.0 : max(0.0, $spreadJual);
        foreach ($bars as $b) {
            $t = (int)$b['time'];
            if ($t < $mulai) continue;
            if ((float)$b['open'] <= 0 || (float)$b['high'] <= 0 || (float)$b['low'] <= 0) continue;
            $o = (float)$b['open'] + $geser; $h = (float)$b['high'] + $geser; $l = (float)$b['low'] + $geser;
            if ($sl !== null && $sl > 0) {
                if ($beli ? $l <= $sl : $h >= $sl) {
                    return ['kena' => ['harga' => round($beli ? min($sl, $o) : max($sl, $o), 8), 'alasan' => 'sl', 'ts' => $t], 'periksa' => $periksa];
                }
            }
            if ($tp !== null && $tp > 0) {
                if ($beli ? $h >= $tp : $l <= $tp) {
                    return ['kena' => ['harga' => round($beli ? max($tp, $o) : min($tp, $o), 8), 'alasan' => 'tp', 'ts' => $t], 'periksa' => $periksa];
                }
            }
            if ($t + 60 <= $kini) $periksa = $t + 60;
        }
        return ['kena' => null, 'periksa' => $periksa];
    }
}

if (!function_exists('qi_paper_sltp_kutipan')) {
    /** SL/TP terhadap kutipan saat ini (tanpa bar). Murni. @return array{harga:float,alasan:string}|null */
    function qi_paper_sltp_kutipan(string $arah, ?float $sl, ?float $tp, ?array $q, int $umurMaks = 10): ?array
    {
        if (!$q || (int)($q['umur'] ?? PHP_INT_MAX) > $umurMaks || ($q['market'] ?? null) === 'closed') return null;
        $beli = $arah === 'BUY';
        $px = $beli ? ($q['bid'] ?? null) : ($q['ask'] ?? null);
        $px = ($px !== null && $px > 0) ? (float)$px : (float)($q['price'] ?? 0);
        if ($px <= 0) return null;
        if ($sl !== null && $sl > 0 && ($beli ? $px <= $sl : $px >= $sl)) return ['harga' => $px, 'alasan' => 'sl'];
        if ($tp !== null && $tp > 0 && ($beli ? $px >= $tp : $px <= $tp)) return ['harga' => (float)$tp, 'alasan' => 'tp'];
        return null;
    }
}

if (!function_exists('qi_komp_akun_db')) {
    /**
     * Akun turnamen satu pengguna untuk satu periode (posisi manual ber-komp_periode itu).
     * @param array $kutipan       simbol → kutipan (qi_komp_kutipan); simbol yang tidak ada = tanpa harga
     * @param array $tandaCadangan id posisi → ['mark' => float] tanda NYATA terakhir (berkas tanda papan);
     *                             dipakai untuk kaki yang sedang tanpa harga (kaki itu diberi 'cadangan' => true)
     * @return array qi_komp_hitung_akun() + ['kaki' => [{id,symbol,side,lots,entry,mark,floating,cadangan,…}], 'trades' => n]
     */
    function qi_komp_akun_db(PDO $pdo, int $uid, string $periode, array $kutipan, int $umurTanda = QI_KOMP_UMUR_TANDA_MAKS, array $tandaCadangan = []): array
    {
        $st = $pdo->prepare("SELECT id, symbol, direction, lots, entry_price, status, pnl_usd, harga_sumber, harga_geser FROM paper_positions
                             WHERE user_id = :u AND komp_periode = :p AND source = 'manual' AND status IN ('open','closed')");
        $st->execute([':u' => $uid, ':p' => $periode]);
        $realisasi = 0.0; $kaki = []; $trades = 0;
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if ($r['status'] === 'closed') { $realisasi += (float)$r['pnl_usd']; $trades++; continue; }
            $mark = qi_komp_harga_tanda($r['direction'], qi_komp_kutipan_posisi($kutipan[$r['symbol']] ?? null, $r), $umurTanda);
            $cadangan = false;
            if ($mark === null && isset($tandaCadangan[$r['id']]['mark']) && (float)$tandaCadangan[$r['id']]['mark'] > 0) {
                $mark = (float)$tandaCadangan[$r['id']]['mark'];
                $cadangan = true;
            }
            $kaki[] = ['id' => (int)$r['id'], 'symbol' => $r['symbol'], 'side' => $r['direction'], 'lots' => (float)$r['lots'],
                       'entry' => (float)$r['entry_price'], 'mark' => $mark, 'cadangan' => $cadangan,
                       'harga_sumber' => $r['harga_sumber'], 'harga_geser' => $r['harga_geser'],
                       'floating' => $mark === null ? null : qi_paper_pnl($r['symbol'], $r['direction'], (float)$r['entry_price'], $mark, (float)$r['lots'])];
        }
        return qi_komp_hitung_akun($realisasi, $kaki) + ['kaki' => $kaki, 'trades' => $trades];
    }
}

if (!function_exists('qi_paper_tutup_server')) {
    /** Tutup satu posisi atas nama server. true bila baris ini yang menutupnya (aman dari balapan). */
    function qi_paper_tutup_server(PDO $pdo, array $r, float $harga, string $alasan, int $ts): bool
    {
        $pnl = qi_paper_pnl($r['symbol'], $r['direction'], (float)$r['entry_price'], $harga, (float)$r['lots']);
        $up = $pdo->prepare("UPDATE paper_positions SET status = 'closed', close_price = :c, pnl_usd = :p,
                                    closed_at = FROM_UNIXTIME(:t), close_reason = :r
                             WHERE id = :id AND status = 'open'");
        $up->execute([':c' => $harga, ':p' => $pnl, ':t' => $ts, ':r' => $alasan, ':id' => (int)$r['id']]);
        return $up->rowCount() === 1;
    }
}

if (!function_exists('qi_komp_seri_bar')) {
    /**
     * Seri bar M1 untuk menilai SL/TP satu posisi, atau null bila seri posisi itu sedang tidak punya bar.
     * Proksi XAUUSD selalu bar PAXG (+ G posisi, hanya jam emas); posisi emas nyata hanya bar MT5/OANDA,
     * dan hanya bila feed saat ini memang emas nyata (tidak pernah bar PAXG untuk level emas). Murni.
     * @return array{sumber:string,kel:string,geser:float,proksi:bool}|null
     */
    function qi_komp_seri_bar(array $r, ?array $q): ?array
    {
        [$sumber, $geser] = qi_komp_seri_posisi($r, $q);
        $fam = qi_komp_keluarga_level((string)$r['symbol'], $sumber);
        if ($fam === 'proksi') return ['sumber' => 'binance_paxg', 'kel' => 'binance_paxg', 'geser' => $geser, 'proksi' => true];
        $sq = $q['source'] ?? null;
        if ($fam === 'emas' && qi_komp_keluarga_level((string)$r['symbol'], $sq) !== 'emas') return null;
        $kel = qi_komp_keluarga_sumber($sq);
        return $kel === null ? null : ['sumber' => (string)$sq, 'kel' => $kel, 'geser' => 0.0, 'proksi' => false];
    }
}

if (!function_exists('qi_komp_bar_seri')) {
    /** Bar mentah → bar di seri posisi: proksi hanya jam emas buka, digeser G posisi. Murni. */
    function qi_komp_bar_seri(array $bars, array $seri): array
    {
        if (!$seri['proksi']) return $bars;
        $g = (float)$seri['geser'];
        $hasil = [];
        foreach ($bars as $b) {
            if (!qi_komp_emas_buka((int)$b['time'])) continue;
            $hasil[] = ['time' => (int)$b['time'], 'open' => (float)$b['open'] + $g, 'high' => (float)$b['high'] + $g,
                        'low' => (float)$b['low'] + $g, 'close' => (float)$b['close'] + $g];
        }
        return $hasil;
    }
}

if (!function_exists('qi_paper_settle')) {
    /**
     * @param int|null $uid  null = semua pengguna (papan / cron)
     * @param array $opsi    'kutipan' fn(array syms): array, 'm1' fn(sym, dari, sumber): array{bars},
     *                       'sebelum' fn(sym, batas, sumber): ?array{harga,ts}, 'akhir' fn(periode, sym): ?array,
     *                       'tanda' array (tanda cadangan stop-out), 'kini' int — untuk uji;
     *                       'id' int = hanya posisi ini; 'segar' bool = bar M1 tanpa cache (dipakai 'ubah');
     *                       'maks_harga_sebelum' int = pencarian harga akhir periode per jalan (bawaan 12);
     *                       'batal_setelah' int = detik setelah batas sebelum posisi tanpa harga dibatalkan
     * @return array{ditutup:array,diperiksa:int,menunggu_harga:array,dibatalkan:array}
     */
    function qi_paper_settle(PDO $pdo, ?int $uid = null, array $opsi = []): array
    {
        $hasil = ['ditutup' => [], 'diperiksa' => 0, 'menunggu_harga' => [], 'dibatalkan' => []];
        if (!qi_komp_skema_siapkan($pdo, $opsi['penanda_skema'] ?? null)) return $hasil + ['skema' => false];
        $kini = (int)($opsi['kini'] ?? time());
        $segar = !empty($opsi['segar']);
        $ambilKutipan = $opsi['kutipan'] ?? static fn(array $syms) => qi_komp_kutipan($syms);
        $ambilM1 = $opsi['m1'] ?? static fn(string $sym, int $dari, ?string $sumber) => qi_komp_m1($sym, $dari, $sumber, $segar);
        $hargaSebelum = $opsi['sebelum'] ?? static fn(string $sym, int $batas, ?string $sumber) => qi_komp_harga_sebelum($sym, $batas, $sumber);
        $kutipanAkhir = $opsi['akhir'] ?? static fn(string $periode, string $sym) => qi_komp_kutipan_akhir($periode, $sym);
        $maksSebelum = max(1, (int)($opsi['maks_harga_sebelum'] ?? 12));
        $batalSetelah = (int)($opsi['batal_setelah'] ?? 72 * 3600);
        [, , $periodeKini] = qi_komp_periode_kini($kini);

        $sql = "SELECT id, user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, komp_periode, harga_sumber, harga_geser,
                       UNIX_TIMESTAMP(opened_at) AS opened_ts, UNIX_TIMESTAMP(sltp_checked_at) AS cek_ts
                FROM paper_positions WHERE status = 'open' AND source = 'manual'";
        $param = [];
        if ($uid !== null) { $sql .= ' AND user_id = :u'; $param[':u'] = $uid; }
        if (isset($opsi['id'])) { $sql .= ' AND id = :id'; $param[':id'] = (int)$opsi['id']; }
        $st = $pdo->prepare($sql);
        $st->execute($param);
        $baris = $st->fetchAll(PDO::FETCH_ASSOC);
        $hasil['diperiksa'] = count($baris);
        $catat = static function (array $r, float $harga, string $alasan) use (&$hasil) {
            $hasil['ditutup'][] = ['id' => (int)$r['id'], 'user_id' => (int)$r['user_id'], 'symbol' => $r['symbol'], 'alasan' => $alasan,
                                   'harga' => $harga, 'pnl' => qi_paper_pnl($r['symbol'], $r['direction'], (float)$r['entry_price'], $harga, (float)$r['lots'])];
        };

        $kutipan = $baris ? (array)$ambilKutipan(array_values(array_unique(array_column($baris, 'symbol')))) : [];
        $mulaiDari = static fn(array $r) => (int)ceil(max((int)$r['opened_ts'], (int)($r['cek_ts'] ?? 0)) / 60) * 60;
        $adaSlTp = static fn(array $r) => $r['stop_loss'] !== null || $r['take_profit'] !== null;

        // Satu panggilan bar per (simbol, seri), dari posisi BER-SL/TP yang paling awal perlu diperiksa.
        // Audit G1: dulu SEMUA posisi ikut menentukan awal jendela — posisi tanpa SL/TP tidak pernah
        // memajukan sltp_checked_at, jadi satu posisi tanpa SL berumur > 16,7 jam menarik jendela Binance
        // ke 1000 bar lama dan SL posisi lain di simbol itu tidak pernah dinilai di bar.
        $dariMin = [];
        foreach ($baris as $r) {
            if (!$adaSlTp($r)) continue;
            $seri = qi_komp_seri_bar($r, $kutipan[$r['symbol']] ?? null);
            if (!$seri) continue;
            $k = $r['symbol'] . '|' . $seri['kel'];
            $dariMin[$k] = min($dariMin[$k] ?? PHP_INT_MAX, $mulaiDari($r));
        }
        $barCache = [];
        $barsUntuk = static function (string $sym, array $seri) use (&$barCache, $ambilM1, $dariMin): array {
            $k = $sym . '|' . $seri['kel'];
            if (!isset($barCache[$k])) $barCache[$k] = (array)(($ambilM1)($sym, $dariMin[$k] ?? 0, $seri['sumber'])['bars'] ?? []);
            return qi_komp_bar_seri($barCache[$k], $seri);
        };
        $periodeLalu = [];
        $memoSebelum = [];
        $cariSebelum = 0;

        foreach ($baris as $r) {
            $sl = $r['stop_loss'] !== null ? (float)$r['stop_loss'] : null;
            $tp = $r['take_profit'] !== null ? (float)$r['take_profit'] : null;
            $mulai = $mulaiDari($r);
            $kp = $r['komp_periode'];
            $q = $kutipan[$r['symbol']] ?? null;
            $qPos = qi_komp_kutipan_posisi($q, $r);          // kutipan DI SERI POSISI INI (null = seri tanpa harga)
            $batas = ($kp !== null && $kp !== $periodeKini) ? (qi_komp_batas_periode($kp)[1] ?? null) : null;
            if ($batas !== null && $batas > $kini) $batas = null;   // jam server mundur? jangan tutup

            // 1) SL/TP lewat bar M1 (untuk posisi periode lalu: hanya bar sebelum batas periode)
            $kena = null;
            if ($sl !== null || $tp !== null) {
                $seri = qi_komp_seri_bar($r, $q);
                $bars = $seri ? $barsUntuk($r['symbol'], $seri) : [];
                if ($batas !== null) $bars = array_values(array_filter($bars, static fn($b) => (int)$b['time'] < $batas));
                $spread = 0.0;
                if ($seri && $r['direction'] === 'SELL' && qi_komp_bar_bid($seri['kel']) && $qPos
                    && ($qPos['bid'] ?? null) !== null && ($qPos['ask'] ?? null) !== null && $qPos['ask'] >= $qPos['bid']) {
                    $spread = (float)$qPos['ask'] - (float)$qPos['bid'];
                }
                $jalan = qi_paper_sltp_jalan($r['direction'], $sl, $tp, $bars, $mulai, $batas ?? $kini, $spread);
                $kena = $jalan['kena'];
                if (!$kena && $batas === null) {
                    $qk = qi_paper_sltp_kutipan($r['direction'], $sl, $tp, $qPos);
                    if ($qk) $kena = $qk + ['ts' => $kini];
                }
                if (!$kena && $jalan['periksa'] !== null && $jalan['periksa'] > (int)($r['cek_ts'] ?? 0)) {
                    $pdo->prepare('UPDATE paper_positions SET sltp_checked_at = FROM_UNIXTIME(:t) WHERE id = :id AND status = \'open\'')
                        ->execute([':t' => $jalan['periksa'], ':id' => (int)$r['id']]);
                }
            }
            if ($kena) {
                if (qi_paper_tutup_server($pdo, $r, (float)$kena['harga'], $kena['alasan'], max((int)$kena['ts'], (int)$r['opened_ts']))) $catat($r, (float)$kena['harga'], $kena['alasan']);
                continue;
            }

            // 2) Akhir periode — harga nyata terakhir sebelum batas, di seri posisi.
            if ($batas !== null) {
                [$sumberPos, $geserPos] = qi_komp_seri_posisi($r, $q);
                $proksi = qi_komp_keluarga_level($r['symbol'], $sumberPos) === 'proksi';
                $sumberBar = $proksi ? 'binance_paxg' : $sumberPos;
                $px = null;
                // a) close bar M1 terakhir sebelum batas — satu pencarian per (simbol, batas, seri) per jalan
                //    (audit G1: dulu satu panggilan hulu per posisi, berurutan, di dalam kunci papan).
                $kel = qi_komp_keluarga_sumber($sumberBar);
                if ($kel !== null) {
                    $km = $r['symbol'] . '|' . $batas . '|' . $kel;
                    if (!array_key_exists($km, $memoSebelum)) {
                        if ($cariSebelum >= $maksSebelum) {
                            $hasil['menunggu_harga'][] = ['id' => (int)$r['id'], 'symbol' => $r['symbol'], 'periode' => $kp, 'ditunda' => true];
                            continue;
                        }
                        $cariSebelum++;
                        $memoSebelum[$km] = ($hargaSebelum)($r['symbol'], $batas, $sumberBar);
                    }
                    $px = $memoSebelum[$km];
                    if ($px && $proksi) $px = ['harga' => round((float)$px['harga'] + $geserPos, 3), 'ts' => (int)$px['ts']];
                }
                // b) pasar tutup sejak sebelum batas: harga terakhirnya adalah harga di batas.
                if (!$px && $qPos && ($qPos['market'] ?? null) === 'closed' && isset($qPos['tick_age'], $qPos['ts'])
                    && ((int)$qPos['ts'] - (int)$qPos['tick_age']) <= $batas) {
                    $tanda = qi_komp_harga_tanda($r['direction'], $qPos, PHP_INT_MAX);
                    if ($tanda) $px = ['harga' => $tanda, 'ts' => $batas - 1];
                }
                // c) kutipan kanonik terakhir yang tercatat selama periode itu (seri posisi, sisi penutup).
                if (!$px) {
                    $snap = qi_komp_kutipan_posisi(($kutipanAkhir)((string)$kp, (string)$r['symbol']), $r);
                    $tanda = $snap ? qi_komp_harga_tanda($r['direction'], $snap, PHP_INT_MAX) : null;
                    if ($tanda && (int)($snap['ts'] ?? 0) > 0 && (int)$snap['ts'] < $batas) $px = ['harga' => $tanda, 'ts' => (int)$snap['ts']];
                }
                if (!$px) {
                    if ($kini - $batas >= $batalSetelah) {
                        // d) Tidak pernah ada harga apa pun sebelum batas: BATALKAN (tanpa P/L), jangan menebak,
                        //    dan jangan biarkan pemiliknya memilih harga keluar berhari-hari kemudian.
                        $up = $pdo->prepare("UPDATE paper_positions SET status = 'cancelled', close_reason = 'period_end', close_price = NULL,
                                                    pnl_usd = NULL, closed_at = FROM_UNIXTIME(:t) WHERE id = :id AND status = 'open'");
                        $up->execute([':t' => max((int)$r['opened_ts'], $batas - 1), ':id' => (int)$r['id']]);
                        if ($up->rowCount() === 1) {
                            $hasil['dibatalkan'][] = ['id' => (int)$r['id'], 'user_id' => (int)$r['user_id'], 'symbol' => $r['symbol'], 'periode' => $kp];
                            error_log('[kompetisi] posisi ' . $r['id'] . ' ' . $r['symbol'] . ' periode ' . $kp . ' dibatalkan: tidak ada harga sebelum batas');
                        }
                        $periodeLalu[$kp] = true;
                    } else {
                        $hasil['menunggu_harga'][] = ['id' => (int)$r['id'], 'symbol' => $r['symbol'], 'periode' => $kp];
                    }
                    continue;
                }
                if (qi_paper_tutup_server($pdo, $r, (float)$px['harga'], 'period_end', min($batas - 1, max((int)$px['ts'], (int)$r['opened_ts'])))) {
                    $catat($r, (float)$px['harga'], 'period_end');
                }
                $periodeLalu[$kp] = true;
            }
        }

        // 3) Stop-out (periode berjalan)
        $pengguna = $uid !== null ? [$uid] : [];
        if ($uid === null) {
            $s = $pdo->prepare("SELECT DISTINCT user_id FROM paper_positions WHERE status = 'open' AND source = 'manual' AND komp_periode = :p");
            $s->execute([':p' => $periodeKini]);
            $pengguna = array_map('intval', $s->fetchAll(PDO::FETCH_COLUMN));
        }
        if ($pengguna) {
            // Tanda nyata terakhir tiap kaki (ditulis pembangun papan) — kaki yang sedang tanpa harga
            // dihitung di tanda itu, seperti papan, alih-alih mematikan stop-out seluruh akun.
            $tanda = $opsi['tanda'] ?? json_decode((string)@file_get_contents(qi_komp_dir() . '/tanda-' . preg_replace('/[^0-9A-Za-z-]/', '', $periodeKini) . '.json'), true);
            $tanda = is_array($tanda) ? $tanda : [];
            foreach ($pengguna as $u) {
                for ($putaran = 0; $putaran < QI_PAPER_POSISI_MAKS; $putaran++) {
                    $akun = qi_komp_akun_db($pdo, $u, $periodeKini, $kutipan, QI_KOMP_UMUR_TANDA_MAKS, $tanda);
                    if (!$akun['kaki'] || $akun['level_margin'] === null || $akun['tanpa_harga'] > 0) break;
                    if ($akun['level_margin'] >= QI_KOMP_STOPOUT * 100) break;
                    // Yang DITUTUP hanya kaki dengan harga segar (harga eksekusi server); kaki bertanda cadangan
                    // ikut menghitung level margin tetapi tidak bisa dieksekusi.
                    $kaki = array_values(array_filter($akun['kaki'], static fn($k) => $k['floating'] !== null && empty($k['cadangan'])));
                    usort($kaki, static fn($a, $b) => $a['floating'] <=> $b['floating']);
                    $ditutup = false;
                    foreach ($kaki as $k) {
                        $acuan = qi_komp_acuan_dari(qi_komp_kutipan_posisi($kutipan[$k['symbol']] ?? null, $k));
                        $eks = qi_paper_harga_eksekusi($k['symbol'], $k['side'] === 'BUY' ? 'jual' : 'beli', null, $acuan);
                        if (isset($eks['tolak'])) continue;
                        $r = ['id' => $k['id'], 'user_id' => $u, 'symbol' => $k['symbol'], 'direction' => $k['side'], 'entry_price' => $k['entry'], 'lots' => $k['lots']];
                        if (qi_paper_tutup_server($pdo, $r, $eks['harga'], 'stopout', $kini)) { $catat($r, $eks['harga'], 'stopout'); $ditutup = true; }
                        break;
                    }
                    if (!$ditutup) break;
                }
            }
        }

        // 4) Bekukan klasemen periode lalu yang sudah tidak punya posisi terbuka.
        if ($uid === null) {
            $periodeLalu[qi_komp_periode_kini($kini - 7 * 86400)[2]] = true;
            if (function_exists('qi_komp_bekukan')) {
                foreach (array_keys($periodeLalu) as $p) {
                    try { qi_komp_bekukan($pdo, (string)$p); } catch (Throwable $e) { error_log('[kompetisi] bekukan ' . $p . ': ' . $e->getMessage()); }
                }
            }
        }
        return $hasil;
    }
}

if (!function_exists('qi_paper_settle_semua_berkala')) {
    /** qi_paper_settle(semua) paling sering sekali per $jeda detik untuk SELURUH server (flock). */
    function qi_paper_settle_semua_berkala(PDO $pdo, int $jeda = 10): ?array
    {
        $penanda = qi_komp_dir() . '/settle-semua.ts';
        $fp = @fopen($penanda, 'c+');
        if (!$fp) return null;
        if (!flock($fp, LOCK_EX | LOCK_NB)) { fclose($fp); return null; }
        $terakhir = (int)stream_get_contents($fp);
        $hasil = null;
        if (time() - $terakhir >= $jeda) {
            ftruncate($fp, 0); rewind($fp); fwrite($fp, (string)time()); fflush($fp);
            try { $hasil = qi_paper_settle($pdo, null); } catch (Throwable $e) { error_log('[kompetisi] settle berkala: ' . $e->getMessage()); }
        }
        flock($fp, LOCK_UN);
        fclose($fp);
        return $hasil;
    }
}
