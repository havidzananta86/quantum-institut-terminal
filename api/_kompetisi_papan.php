<?php
/**
 * PAPAN PERINGKAT LANGSUNG — Weekly Championship (dipakai api/competition.php dan api/leaderboard.php).
 *
 * Dulu (audit kompetisi 2026-10-22): peringkat = P/L TERTUTUP dalam minggu itu saja. Trader yang
 * menutup 3 posisi untung lalu membiarkan BUY −$5.000 terbuka tanpa SL tampil +9% di atas trader
 * yang ekuitasnya jauh lebih baik. Posisi terbuka, aktivitas, dan peserta yang belum trading tidak
 * terlihat, dan pengunjung tanpa login mendapat 401.
 *
 * Sekarang, per periode (kunci 'YYYY-Www', jam server WIB):
 *   · ekuitas = 10.000 + terealisasi + mengambang dari posisi manual ber-komp_periode itu;
 *     mengambang ditandai di sisi penutup dengan kutipan kanonik (api/_kompetisi_harga.php).
 *     Kutipan basi (> 120 dtk, pasar buka) TIDAK ditebak: dipakai tanda nyata terakhir posisi itu
 *     (cache/kompetisi/tanda-{periode}.json) dan barisnya ditandai harga_basi; posisi yang belum
 *     pernah punya tanda dihitung di 'tanpa_harga' dan tidak ikut mengambang.
 *   · peringkat kompetisi standar (1, 1, 3) — lihat qi_komp_peringkat();
 *   · peserta terdaftar yang belum trading tetap terlihat ($10.000, 0,00%) di bawah para trader;
 *   · akun nonaktif / diblokir tidak tampil;
 *   · nama selalu nama tampilan atau nama asli DISAMARKAN; tiap trader diberi kode HMAC untuk laci
 *     detail, id pengguna tidak pernah dikirim ke peramban.
 * Papan dibangun paling sering sekali per 5 detik untuk seluruh server (flock satu pembangun);
 * permintaan lain membaca berkas cache-nya.
 */

require_once __DIR__ . '/_kompetisi_settle.php';

if (!defined('QI_KOMP_PAPAN_TTL')) {
    define('QI_KOMP_PAPAN_TTL', 5);
}

if (!function_exists('qi_komp_sql_aktif')) {
    /**
     * Syarat akun yang boleh tampil di papan: aktif (daftar status sama dengan yang ditolak
     * qi_validate_token) dan BUKAN admin. Admin adalah penyelenggara — mereka bisa melihat data
     * seluruh peserta dan mengatur turnamen, jadi tidak ikut bersaing memperebutkan hadiah.
     */
    function qi_komp_sql_aktif(string $alias = 'u'): string
    {
        return "$alias.is_active = 1 AND ($alias.status IS NULL OR LOWER($alias.status) NOT IN ('banned','suspended','inactive','disabled'))"
            . " AND LOWER(COALESCE($alias.role, '')) <> 'admin'";
    }
}

if (!function_exists('qi_komp_lencana')) {
    function qi_komp_lencana(?int $rank, bool $aktif = true): ?string
    {
        if (!$aktif || !$rank) return null;
        return $rank === 1 ? 'diamond' : ($rank === 2 ? 'platinum' : ($rank <= 3 ? 'gold' : ($rank <= 10 ? 'silver' : null)));
    }
}

if (!function_exists('qi_komp_papan_bangun')) {
    /**
     * Bangun papan satu periode dari database (tanpa cache).
     * @param array $opsi 'kutipan' fn(array syms): array, 'kini' int, 'tanda_berkas' string, 'simpan' bool (upsert klasemen),
     *                    'simbol' string[] (hanya posisi simbol ini — turnamen per pasar, mis. Gold Rush),
     *                    'turnamen' string (kunci competition_entries untuk peserta terdaftar; bawaan QI_KOMP_TURNAMEN)
     */
    function qi_komp_papan_bangun(PDO $pdo, string $periode, array $opsi = []): array
    {
        $kini = (int)($opsi['kini'] ?? time());
        $ambilKutipan = $opsi['kutipan'] ?? static fn(array $syms) => qi_komp_kutipan($syms, QI_KOMP_PAPAN_TTL);
        $berkasTanda = $opsi['tanda_berkas'] ?? (qi_komp_dir() . '/tanda-' . preg_replace('/[^0-9A-Za-z-]/', '', $periode) . '.json');
        $aktifSql = qi_komp_sql_aktif('u');
        // Papan per pasar (audit G1: Gold Rush dulu dinilai dari P/L tertutup menurut closed_at). Berkas
        // tanda bersama TIDAK ditulis oleh papan tersaring — isinya hanya sebagian kaki.
        $filterSim = '';
        if (!empty($opsi['simbol'])) {
            $filterSim = ' AND pp.symbol IN (' . implode(',', array_map(static fn($s) => $pdo->quote(strtoupper((string)$s)), (array)$opsi['simbol'])) . ')';
            $opsi['simpan'] = false;
        }
        $kunciTurnamen = (string)($opsi['turnamen'] ?? QI_KOMP_TURNAMEN);

        $st = $pdo->prepare("SELECT pp.user_id, u.full_name, cp.display_name, cp.country_code,
                                    SUM(pp.status = 'closed') AS trades,
                                    SUM(pp.status = 'closed' AND pp.pnl_usd > 0) AS menang,
                                    COALESCE(SUM(CASE WHEN pp.status = 'closed' THEN pp.pnl_usd END), 0) AS realized,
                                    SUM(pp.status = 'open') AS open_count,
                                    MAX(GREATEST(UNIX_TIMESTAMP(pp.opened_at), COALESCE(UNIX_TIMESTAMP(pp.closed_at), 0))) AS aktivitas_ts,
                                    MIN(UNIX_TIMESTAMP(pp.opened_at)) AS pertama_ts
                             FROM paper_positions pp
                             JOIN users u ON u.id = pp.user_id AND $aktifSql
                             LEFT JOIN user_competition_profile cp ON cp.user_id = pp.user_id
                             WHERE pp.source = 'manual' AND pp.komp_periode = :p AND pp.status IN ('open','closed')$filterSim
                             GROUP BY pp.user_id, u.full_name, cp.display_name, cp.country_code");
        $st->execute([':p' => $periode]);
        $agregat = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $agregat[(int)$r['user_id']] = $r;

        // Kaki terbuka → mengambang di sisi penutup.
        $st = $pdo->prepare("SELECT pp.id, pp.user_id, pp.symbol, pp.direction, pp.lots, pp.entry_price, pp.harga_sumber, pp.harga_geser FROM paper_positions pp
                             WHERE pp.source = 'manual' AND pp.komp_periode = :p AND pp.status = 'open'$filterSim");
        $st->execute([':p' => $periode]);
        $kaki = $st->fetchAll(PDO::FETCH_ASSOC);
        $kutipan = $kaki ? (array)$ambilKutipan(array_values(array_unique(array_column($kaki, 'symbol')))) : [];
        $tandaLama = json_decode((string)@file_get_contents($berkasTanda), true);
        $tandaLama = is_array($tandaLama) ? $tandaLama : [];
        $tandaBaru = [];
        $perUser = [];
        foreach ($kaki as $k) {
            $u = (int)$k['user_id'];
            $perUser[$u] ??= ['floating' => 0.0, 'basi' => false, 'tanpa' => 0, 'tutup' => false];
            // Kutipan di SERI POSISI (XAUUSD emas nyata vs proksi PAXG + G posisi) — null bila seri itu
            // sedang tanpa harga: tanda nyata terakhir dipakai dan barisnya ditandai basi.
            $q = qi_komp_kutipan_posisi($kutipan[$k['symbol']] ?? null, $k);
            $mark = qi_komp_harga_tanda($k['direction'], $q);
            if ($mark !== null) {
                $tandaBaru[$k['id']] = ['mark' => $mark, 'ts' => $kini];
                if (($q['market'] ?? null) === 'closed') $perUser[$u]['tutup'] = true;
            } elseif (isset($tandaLama[$k['id']]['mark'])) {
                // Tanda NYATA terakhir posisi ini (bukan tebakan) — barisnya ditandai basi.
                $mark = (float)$tandaLama[$k['id']]['mark'];
                $tandaBaru[$k['id']] = $tandaLama[$k['id']];
                $perUser[$u]['basi'] = true;
            } else {
                $perUser[$u]['basi'] = true;
                $perUser[$u]['tanpa']++;
                continue;
            }
            $perUser[$u]['floating'] += qi_paper_pnl($k['symbol'], $k['direction'], (float)$k['entry_price'], $mark, (float)$k['lots']);
        }
        if (!isset($opsi['simpan']) || $opsi['simpan']) @file_put_contents($berkasTanda, json_encode($tandaBaru), LOCK_EX);

        // Peserta terdaftar (termasuk yang belum trading).
        $terdaftar = [];
        try {
            $st = $pdo->prepare("SELECT ce.user_id, u.full_name, cp.display_name, cp.country_code, UNIX_TIMESTAMP(ce.joined_at) AS daftar_ts
                                 FROM competition_entries ce
                                 JOIN users u ON u.id = ce.user_id AND $aktifSql
                                 LEFT JOIN user_competition_profile cp ON cp.user_id = ce.user_id
                                 WHERE ce.tournament_key = :t AND ce.period_key = :p");
            $st->execute([':t' => $kunciTurnamen, ':p' => $periode]);
            foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $terdaftar[(int)$r['user_id']] = $r;
        } catch (PDOException $e) { /* competition_entries belum ada */ }

        $baris = [];
        foreach (array_unique(array_merge(array_keys($agregat), array_keys($terdaftar))) as $u) {
            $a = $agregat[$u] ?? null;
            $info = $a ?? $terdaftar[$u];
            $realized = round((float)($a['realized'] ?? 0), 2);
            $floating = round($perUser[$u]['floating'] ?? 0.0, 2);
            $equity = round(QI_KOMP_SALDO_AWAL + $realized + $floating, 2);
            $trades = (int)($a['trades'] ?? 0);
            $menang = (int)($a['menang'] ?? 0);
            $baris[] = [
                'uid'          => (int)$u,
                'kode'         => qi_komp_kode((int)$u),
                'nama'         => qi_komp_nama_publik($info['display_name'] ?? null, $info['full_name'] ?? ''),
                'negara'       => !empty($info['country_code']) ? strtoupper((string)$info['country_code']) : null,
                'equity'       => $equity,
                'return_pct'   => round(($equity - QI_KOMP_SALDO_AWAL) / QI_KOMP_SALDO_AWAL * 100, 2),
                'realized'     => $realized,
                'floating'     => $floating,
                'open_count'   => (int)($a['open_count'] ?? 0),
                'trades'       => $trades,
                'menang'       => $menang,
                'win_rate'     => $trades > 0 ? (int)round($menang / $trades * 100) : 0,
                'aktivitas_ts' => $a ? (int)$a['aktivitas_ts'] : null,
                'harga_basi'   => (bool)($perUser[$u]['basi'] ?? false),
                'tanpa_harga'  => (int)($perUser[$u]['tanpa'] ?? 0),
                'pasar_tutup'  => (bool)($perUser[$u]['tutup'] ?? false),
                'terdaftar'    => isset($terdaftar[$u]),
                'aktif'        => $a !== null,
                'urut'         => $a ? (int)$a['pertama_ts'] : (int)($terdaftar[$u]['daftar_ts'] ?? 0),
            ];
        }
        $baris = qi_komp_peringkat($baris);
        foreach ($baris as &$b) { $b['lencana'] = qi_komp_lencana($b['rank'], $b['aktif']); unset($b['urut']); }
        unset($b);

        // Aktivitas: 30 kejadian buka/tutup terbaru periode ini.
        $st = $pdo->prepare("SELECT pp.id, pp.user_id, pp.symbol, pp.direction, pp.lots, pp.entry_price, pp.close_price, pp.pnl_usd,
                                    pp.status, pp.close_reason, UNIX_TIMESTAMP(pp.opened_at) AS buka_ts, UNIX_TIMESTAMP(pp.closed_at) AS tutup_ts,
                                    u.full_name, cp.display_name
                             FROM paper_positions pp
                             JOIN users u ON u.id = pp.user_id AND $aktifSql
                             LEFT JOIN user_competition_profile cp ON cp.user_id = pp.user_id
                             WHERE pp.source = 'manual' AND pp.komp_periode = :p AND pp.status IN ('open','closed')$filterSim
                             ORDER BY GREATEST(UNIX_TIMESTAMP(pp.opened_at), COALESCE(UNIX_TIMESTAMP(pp.closed_at), 0)) DESC, pp.id DESC
                             LIMIT 30");
        $st->execute([':p' => $periode]);
        $kejadian = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $dasar = ['kode' => qi_komp_kode((int)$r['user_id']), 'nama' => qi_komp_nama_publik($r['display_name'], $r['full_name']),
                      'symbol' => $r['symbol'], 'side' => $r['direction'], 'lots' => (float)$r['lots']];
            $kejadian[] = $dasar + ['jenis' => 'buka', 'harga' => (float)$r['entry_price'], 'ts' => (int)$r['buka_ts'], '_id' => (int)$r['id']];
            if ($r['status'] === 'closed' && $r['tutup_ts'] !== null) {
                $kejadian[] = $dasar + ['jenis' => 'tutup', 'harga' => (float)$r['close_price'], 'pnl' => round((float)$r['pnl_usd'], 2),
                                        'alasan' => $r['close_reason'] ?: null, 'ts' => (int)$r['tutup_ts'], '_id' => (int)$r['id']];
            }
        }
        usort($kejadian, static fn($a, $b) => [$b['ts'], $b['_id'], $b['jenis'] === 'tutup'] <=> [$a['ts'], $a['_id'], $a['jenis'] === 'tutup']);
        $kejadian = array_map(static function ($k) { unset($k['_id']); return $k; }, array_slice($kejadian, 0, 30));

        $batas = qi_komp_batas_periode($periode);
        $papan = [
            'periode'   => $periode,
            'mulai'     => $batas[0] ?? null,
            'selesai'   => $batas[1] ?? null,
            'dibangun'  => $kini,
            'final'     => false,
            'baris'     => $baris,
            'peserta'   => count($baris),
            'trader'    => count(array_filter($baris, static fn($b) => $b['aktif'])),
            'aktivitas' => $kejadian,
        ];
        if ($baris && (!isset($opsi['simpan']) || $opsi['simpan'])) qi_komp_simpan_klasemen($pdo, $periode, $baris, false);
        return $papan;
    }
}

if (!function_exists('qi_komp_simpan_klasemen')) {
    /** Upsert competition_standings. Baris yang sudah final tidak pernah ditimpa. */
    function qi_komp_simpan_klasemen(PDO $pdo, string $periode, array $baris, bool $final): void
    {
        if (!$baris) return;
        $nilai = []; $param = [];
        foreach ($baris as $i => $b) {
            $nilai[] = "(:p$i, :u$i, :e$i, :r$i, :f$i, :o$i, :t$i, :w$i, :k$i, :x$i)";
            $param += [":p$i" => $periode, ":u$i" => $b['uid'], ":e$i" => $b['equity'], ":r$i" => $b['realized'], ":f$i" => $b['floating'],
                       ":o$i" => $b['open_count'], ":t$i" => $b['trades'], ":w$i" => $b['menang'], ":k$i" => $b['rank'], ":x$i" => $final ? 1 : 0];
        }
        // IF(final = 1, lama, baru): klasemen beku tidak berubah lagi.
        $pdo->prepare('INSERT INTO competition_standings (period_key, user_id, equity, realized, floating, open_count, trades, wins, rank_pos, final)
                       VALUES ' . implode(', ', $nilai) . '
                       ON DUPLICATE KEY UPDATE
                         equity = IF(final = 1, equity, VALUES(equity)), realized = IF(final = 1, realized, VALUES(realized)),
                         floating = IF(final = 1, floating, VALUES(floating)), open_count = IF(final = 1, open_count, VALUES(open_count)),
                         trades = IF(final = 1, trades, VALUES(trades)), wins = IF(final = 1, wins, VALUES(wins)),
                         rank_pos = IF(final = 1, rank_pos, VALUES(rank_pos)), final = IF(final = 1, 1, VALUES(final))')
            ->execute($param);
    }
}

if (!function_exists('qi_komp_bekukan')) {
    /**
     * Bekukan klasemen akhir periode yang sudah selesai dan tidak punya posisi terbuka lagi.
     * @return bool true bila baru saja dibekukan
     */
    function qi_komp_bekukan(PDO $pdo, string $periode, ?int $kini = null): bool
    {
        $batas = qi_komp_batas_periode($periode);
        if (!$batas || ($kini ?? time()) < $batas[1]) return false;
        $st = $pdo->prepare('SELECT 1 FROM competition_standings WHERE period_key = :p AND final = 1 LIMIT 1');
        $st->execute([':p' => $periode]);
        if ($st->fetchColumn()) return false;
        $st = $pdo->prepare("SELECT 1 FROM paper_positions WHERE komp_periode = :p AND source = 'manual' AND status = 'open' LIMIT 1");
        $st->execute([':p' => $periode]);
        if ($st->fetchColumn()) return false;
        $papan = qi_komp_papan_bangun($pdo, $periode, ['simpan' => false, 'kutipan' => static fn() => [], 'kini' => $kini ?? time()]);
        if (!$papan['baris']) return false;
        qi_komp_simpan_klasemen($pdo, $periode, $papan['baris'], true);
        return true;
    }
}

if (!function_exists('qi_komp_papan')) {
    /**
     * Papan periode berjalan, dari cache bila umurnya < QI_KOMP_PAPAN_TTL detik.
     * Satu pembangun sekaligus (flock LOCK_NB): yang lain memakai cache terakhir (≤ 2 menit) atau
     * menunggu sebentar. Sebelum membangun, SL/TP/stop-out semua pengguna diselesaikan (paling sering
     * tiap 10 detik) supaya papan tidak menampilkan posisi yang seharusnya sudah tertutup.
     */
    function qi_komp_papan(PDO $pdo): array
    {
        // Kolom komp_periode dkk. dipasang di sini juga: penyelesaian berkala di bawah (yang biasanya
        // memasangnya) dilewati bila baru berjalan < 10 dtk lalu, sehingga deploy pertama bisa langsung
        // menjalankan query papan terhadap kolom yang belum ada. Murah: penanda berkas + static.
        qi_komp_skema_siapkan($pdo);
        [, , $periode] = qi_komp_periode_kini();
        $berkas = qi_komp_dir() . '/papan-' . $periode . '.json';
        $baca = static function () use ($berkas): ?array {
            $j = json_decode((string)@file_get_contents($berkas), true);
            return is_array($j) && isset($j['baris']) ? $j : null;
        };
        $cache = $baca();
        if ($cache && (time() - (int)$cache['dibangun']) < QI_KOMP_PAPAN_TTL) return $cache;

        $kunci = @fopen($berkas . '.lock', 'c');
        if ($kunci && !flock($kunci, LOCK_EX | LOCK_NB)) {
            if ($cache && (time() - (int)$cache['dibangun']) < 120) { fclose($kunci); return $cache; }
            $batas = microtime(true) + 3;
            while (!flock($kunci, LOCK_SH | LOCK_NB) && microtime(true) < $batas) usleep(150000);
            @flock($kunci, LOCK_UN);
            fclose($kunci);
            clearstatcache(true, $berkas);
            if ($c = $baca()) return $c;
            $kunci = null;
        }
        try {
            clearstatcache(true, $berkas);
            $cache = $baca();
            if ($cache && (time() - (int)$cache['dibangun']) < QI_KOMP_PAPAN_TTL) return $cache;
            qi_paper_settle_semua_berkala($pdo, 10);
            $papan = qi_komp_papan_bangun($pdo, $periode);
            $tmp = $berkas . '.' . getmypid() . '.tmp';
            if (@file_put_contents($tmp, json_encode($papan)) !== false && !@rename($tmp, $berkas)) {
                @file_put_contents($berkas, json_encode($papan), LOCK_EX);
                @unlink($tmp);
            }
            return $papan;
        } finally {
            if ($kunci) { flock($kunci, LOCK_UN); fclose($kunci); }
        }
    }
}

if (!function_exists('qi_komp_papan_final')) {
    /** Klasemen beku periode lalu (competition_standings.final = 1), atau null bila belum final. */
    function qi_komp_papan_final(PDO $pdo, string $periode): ?array
    {
        $st = $pdo->prepare("SELECT cs.user_id, cs.equity, cs.realized, cs.floating, cs.open_count, cs.trades, cs.wins, cs.rank_pos,
                                    u.full_name, cp.display_name, cp.country_code
                             FROM competition_standings cs
                             JOIN users u ON u.id = cs.user_id
                             LEFT JOIN user_competition_profile cp ON cp.user_id = cs.user_id
                             WHERE cs.period_key = :p AND cs.final = 1
                             ORDER BY cs.rank_pos ASC, cs.equity DESC, cs.user_id ASC");
        $st->execute([':p' => $periode]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        if (!$rows) return null;
        $batas = qi_komp_batas_periode($periode);
        $baris = array_map(static fn($r) => [
            'uid' => (int)$r['user_id'], 'kode' => qi_komp_kode((int)$r['user_id']),
            'nama' => qi_komp_nama_publik($r['display_name'], $r['full_name']),
            'negara' => $r['country_code'] ? strtoupper((string)$r['country_code']) : null,
            'equity' => (float)$r['equity'], 'return_pct' => round(((float)$r['equity'] - QI_KOMP_SALDO_AWAL) / QI_KOMP_SALDO_AWAL * 100, 2),
            'realized' => (float)$r['realized'], 'floating' => (float)$r['floating'], 'open_count' => (int)$r['open_count'],
            'trades' => (int)$r['trades'], 'menang' => (int)$r['wins'],
            'win_rate' => (int)$r['trades'] > 0 ? (int)round((int)$r['wins'] / (int)$r['trades'] * 100) : 0,
            'rank' => $r['rank_pos'] !== null ? (int)$r['rank_pos'] : null, 'aktif' => (int)$r['trades'] > 0,
            'aktivitas_ts' => null, 'harga_basi' => false, 'tanpa_harga' => 0, 'pasar_tutup' => false, 'terdaftar' => true,
            'lencana' => qi_komp_lencana($r['rank_pos'] !== null ? (int)$r['rank_pos'] : null, (int)$r['trades'] > 0),
        ], $rows);
        return ['periode' => $periode, 'mulai' => $batas[0] ?? null, 'selesai' => $batas[1] ?? null, 'dibangun' => null, 'final' => true,
                'baris' => $baris, 'peserta' => count($baris), 'trader' => count(array_filter($baris, static fn($b) => $b['aktif'])), 'aktivitas' => []];
    }
}

if (!function_exists('qi_komp_baris_publik')) {
    /** Baris papan untuk peramban: tanpa user_id. */
    function qi_komp_baris_publik(array $b): array
    {
        unset($b['uid']);
        return $b;
    }
}

if (!function_exists('qi_komp_trader')) {
    /**
     * Laci trader: posisi terbuka (tanpa SL/TP) dan 20 penutupan terakhir periode ini.
     * @return array|null null bila kode tidak dikenal di papan
     */
    function qi_komp_trader(PDO $pdo, array $papan, string $kode, ?callable $ambilKutipan = null): ?array
    {
        $baris = null;
        foreach ($papan['baris'] as $b) if (hash_equals((string)$b['kode'], $kode)) { $baris = $b; break; }
        if (!$baris) return null;
        $st = $pdo->prepare("SELECT symbol, direction, lots, entry_price, close_price, pnl_usd, status, close_reason, harga_sumber, harga_geser,
                                    UNIX_TIMESTAMP(opened_at) AS buka_ts, UNIX_TIMESTAMP(closed_at) AS tutup_ts
                             FROM paper_positions
                             WHERE user_id = :u AND komp_periode = :p AND source = 'manual' AND status IN ('open','closed')
                             ORDER BY COALESCE(closed_at, opened_at) DESC, id DESC");
        $st->execute([':u' => $baris['uid'], ':p' => $papan['periode']]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $terbuka = array_values(array_filter($rows, static fn($r) => $r['status'] === 'open'));
        $syms = array_values(array_unique(array_column($terbuka, 'symbol')));
        $kutipan = !$terbuka ? [] : ($ambilKutipan ? (array)$ambilKutipan($syms) : qi_komp_kutipan($syms, QI_KOMP_PAPAN_TTL));
        $posisi = [];
        foreach ($terbuka as $r) {
            $mark = qi_komp_harga_tanda($r['direction'], qi_komp_kutipan_posisi($kutipan[$r['symbol']] ?? null, $r));
            $posisi[] = ['symbol' => $r['symbol'], 'side' => $r['direction'], 'lots' => (float)$r['lots'], 'entry' => (float)$r['entry_price'],
                         'mark' => $mark, 'floating' => $mark === null ? null : qi_paper_pnl($r['symbol'], $r['direction'], (float)$r['entry_price'], $mark, (float)$r['lots']),
                         'buka_ts' => (int)$r['buka_ts']];
        }
        $tutup = [];
        foreach ($rows as $r) {
            if ($r['status'] !== 'closed') continue;
            $tutup[] = ['symbol' => $r['symbol'], 'side' => $r['direction'], 'lots' => (float)$r['lots'], 'entry' => (float)$r['entry_price'],
                        'close' => (float)$r['close_price'], 'pnl' => round((float)$r['pnl_usd'], 2), 'alasan' => $r['close_reason'] ?: null,
                        'buka_ts' => (int)$r['buka_ts'], 'tutup_ts' => $r['tutup_ts'] !== null ? (int)$r['tutup_ts'] : null];
            if (count($tutup) >= 20) break;
        }
        return ['trader' => qi_komp_baris_publik($baris), 'posisi' => $posisi, 'tutup' => $tutup];
    }
}
