<?php
/**
 * COMPETITION — turnamen paper trading + papan peringkat.
 *
 * GET  ?papan=weekly[&batas=10..100][&ringkas=1][&periode=YYYY-Www]
 *      → PAPAN LANGSUNG Weekly Championship (api/_kompetisi_papan.php): ekuitas = 10.000 + terealisasi
 *        + mengambang, posisi terbuka, aktivitas 30 kejadian terakhir. TERBUKA untuk pengunjung tanpa
 *        login (nama disamarkan, tanpa baris "saya"). ringkas=1 = tanpa aturan/kelayakan/statistik
 *        sepanjang waktu (untuk polling arena tiap 5 detik). periode lampau = klasemen beku.
 * GET  ?papan=global|indonesia|friends|monthly → papan P/L tertutup (butuh login, seperti dulu)
 * GET  ?trader=<kode>                        → laci trader: posisi terbuka + 20 penutupan terakhir (publik)
 * GET  ?harga=XAUUSD,BTCUSDT                 → kutipan KANONIK (api/_kompetisi_harga.php) — harga yang
 *                                             benar-benar mengisi order (PRO ke atas)
 * POST {aksi:'daftar', turnamen}             → daftar ke turnamen periode berjalan (PRO ke atas)
 * POST {aksi:'profil', nama_tampilan, negara} → nama tampilan & negara untuk papan peringkat
 * GET  ?kandidat=1[&turnamen=…&periode=…]    → (ADMIN) kandidat pemenang + syarat + tanda multi-akun
 *
 * Syarat hadiah & aturan: api/_kompetisi_syarat.php (setelan di cache/competition.json → "syarat").
 *
 * Kejujuran yang dipegang:
 *   · Peringkat dari paper trading nyata (paper_positions). Tidak ada trader, profit, atau win rate
 *     yang dikarang. Harga penanda yang basi ditandai (harga_basi), tidak ditebak.
 *   · Hadiah dibaca dari cache/competition.json (diatur admin). Selama hadiah ATAU aturan resmi
 *     (syarat.ditetapkan) belum diatur, nilai ditampilkan DENGAN `hadiah_contoh: true` ("contoh").
 *   · Nama tanpa nama tampilan disamarkan. Negara tidak pernah ditebak. Id pengguna tidak dikirim.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_kompetisi_syarat.php';
require_once __DIR__ . '/_kompetisi_papan.php';

$metode = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
// Papan dibaca dari cache 5 detik, jadi GET boleh dipoll arena tiap 5–10 detik (dulu 40/menit
// per IP — pengguna seluler di balik CGNAT berbagi IP dan cepat terkena 429).
qi_rate_limit($metode === 'POST' ? 30 : 120, 60);
$pdo = qi_db();

const QI_COMP_SALDO_AWAL = 10000.0;   // sama dengan $STARTING_BALANCE di api/paper-trading.php
$zona = new DateTimeZone(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Asia/Jakarta');

function qi_comp_jawab(array $d, int $kode = 200): void
{
    http_response_code($kode);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Daftar turnamen; hadiah dapat ditimpa admin lewat cache/competition.json.
 *
 * Audit G1: hanya Weekly Championship yang dulu dinilai dari EKUITAS. Turnamen lain dinilai dari P/L
 * tertutup menurut closed_at (qi_comp_agregat) — tutup yang untung, biarkan yang rugi terbuka; posisi
 * lama yang ditutup di dalam periode dihitung penuh; salinan sinyal AI sekali-klik ikut. Sekarang:
 *   · Gold Rush Weekly: periode mingguan yang sama dengan komp_periode → papan ekuitas yang sama,
 *     disaring ke XAUUSD ('simbol'). Posisi terbuka dinilai mengambang dan ditutup server di batas.
 *   · Crypto Sprint (harian) & Forex Battle (bulanan): periodenya tidak sejalan dengan komp_periode
 *     mingguan dan server tidak menutup posisi di batas harian/bulanan, jadi belum bisa dinilai jujur
 *     → DITANGGUHKAN: tidak ditawarkan, pendaftaran & evaluasi hadiah ditolak dengan alasan.
 */
function qi_comp_turnamen(): array
{
    $bawaan = [
        'weekly-championship' => ['nama' => 'QIM Weekly Trading Championship', 'jenis' => 'weekly', 'pasar' => 'semua', 'skor' => 'ekuitas',
            'hadiah' => [['label' => 'Juara 1', 'nilai' => 20000], ['label' => 'Juara 2', 'nilai' => 12000], ['label' => 'Juara 3', 'nilai' => 8000], ['label' => 'Juara 4-10', 'nilai' => 10000, 'total' => true]]],
        'crypto-sprint-daily' => ['nama' => 'Crypto Sprint Daily', 'jenis' => 'daily', 'pasar' => 'crypto', 'ditangguhkan' => true, 'hadiah' => [['label' => 'Total', 'nilai' => 5000, 'total' => true]]],
        'forex-battle-monthly' => ['nama' => 'Forex Battle Monthly', 'jenis' => 'monthly', 'pasar' => 'forex', 'ditangguhkan' => true, 'hadiah' => [['label' => 'Total', 'nilai' => 25000, 'total' => true]]],
        'gold-rush-weekly' => ['nama' => 'Gold Rush Weekly', 'jenis' => 'weekly', 'pasar' => 'gold', 'skor' => 'ekuitas', 'simbol' => ['XAUUSD'],
            'hadiah' => [['label' => 'Total', 'nilai' => 10000, 'total' => true]]],
    ];
    $berkas = __DIR__ . '/../cache/competition.json';
    $atur = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : null;
    $aturanResmi = qi_komp_syarat_setelan(is_array($atur) ? $atur : [])['ditetapkan'];
    foreach ($bawaan as $k => &$t) {
        $t['hadiah_contoh'] = true;
        if (is_array($atur) && isset($atur[$k]['hadiah']) && is_array($atur[$k]['hadiah'])) {
            $t['hadiah'] = $atur[$k]['hadiah'];
            // Tetap "contoh" sampai aturan resmi juga ditetapkan — hadiah tanpa aturan tidak mengikat.
            $t['hadiah_contoh'] = !$aturanResmi;
        }
    }
    return $bawaan;
}

/** Kondisi SQL simbol untuk pasar turnamen. */
function qi_comp_filter_pasar(string $pasar): string
{
    return match ($pasar) {
        'crypto' => " AND pp.symbol LIKE '%USDT'",
        'gold'   => " AND pp.symbol IN ('XAUUSD','XAU/USD','GOLD')",
        'forex'  => " AND pp.symbol NOT LIKE '%USDT' AND pp.symbol NOT IN ('XAUUSD','XAU/USD','GOLD')",
        default  => '',
    };
}

/** Id teman = yang saya undang + yang mengundang saya (cache/referrals.json). */
function qi_comp_teman(int $uid): array
{
    $berkas = __DIR__ . '/../cache/referrals.json';
    $semua = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : [];
    $teman = [];
    if (!is_array($semua)) return $teman;
    foreach ($semua as $pengundang => $d) {
        $ids = array_map('intval', array_column((array)($d['referrals'] ?? []), 'user_id'));
        if ((int)$pengundang === $uid) $teman = array_merge($teman, $ids);
        elseif (in_array($uid, $ids, true)) $teman[] = (int)$pengundang;
    }
    return array_values(array_unique(array_filter($teman)));
}

/**
 * Agregat per pengguna dari trade yang ditutup dalam rentang (null = sepanjang waktu).
 * Dipakai papan global/indonesia/friends/monthly dan turnamen selain Weekly Championship.
 * @return array<int,array> diurutkan dari profit tertinggi
 */
function qi_comp_agregat(PDO $pdo, ?DateTimeImmutable $mulai, ?DateTimeImmutable $selesai, string $pasar = 'semua', ?array $hanyaUser = null, ?string $negara = null): array
{
    // HANYA posisi manual yang ikut peringkat: hadiahnya untuk keterampilan trader. Dulu syaratnya
    // `source <> 'auto'`, sehingga posisi AI Auto-Trade (source 'ai', ditulis ai-auto-trade.php &
    // ai-cron.php) ikut dihitung — padahal arena menjanjikan bot tidak pernah masuk papan peringkat.
    // Akun nonaktif/diblokir tidak tampil (sama dengan papan mingguan).
    $syarat = "pp.status = 'closed' AND pp.source = 'manual' AND " . qi_komp_sql_aktif('u') . qi_comp_filter_pasar($pasar);
    $param = [];
    if ($mulai && $selesai) {
        // closed_at ditulis dalam zona sesi MySQL (NOW()/FROM_UNIXTIME); batas periode (WIB)
        // dikirim sebagai epoch supaya benar apa pun zona MySQL di server.
        $syarat .= ' AND pp.closed_at >= FROM_UNIXTIME(?) AND pp.closed_at < FROM_UNIXTIME(?)';
        $param[] = $mulai->getTimestamp();
        $param[] = $selesai->getTimestamp();
    }
    if ($hanyaUser !== null) {
        if (!$hanyaUser) return [];
        $syarat .= ' AND pp.user_id IN (' . implode(',', array_fill(0, count($hanyaUser), '?')) . ')';
        $param = array_merge($param, $hanyaUser);
    }
    if ($negara !== null) {
        $syarat .= ' AND cp.country_code = ?';
        $param[] = $negara;
    }
    $sql = "SELECT pp.user_id, u.full_name, cp.display_name, cp.country_code,
                   COUNT(*) AS trades, SUM(pp.pnl_usd > 0) AS menang,
                   COALESCE(SUM(pp.pnl_usd), 0) AS pnl, MAX(pp.pnl_usd) AS terbaik, MIN(pp.pnl_usd) AS terburuk
            FROM paper_positions pp
            JOIN users u ON u.id = pp.user_id
            LEFT JOIN user_competition_profile cp ON cp.user_id = pp.user_id
            WHERE $syarat
            GROUP BY pp.user_id, u.full_name, cp.display_name, cp.country_code
            ORDER BY pnl DESC, trades DESC, pp.user_id ASC";
    $st = $pdo->prepare($sql);
    $st->execute($param);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

function qi_comp_baris(array $r, int $rank, int $uid, array $terdaftar): array
{
    $pnl = (float)$r['pnl'];
    $saya = (int)$r['user_id'] === $uid;
    $nama = trim((string)($r['display_name'] ?? ''));
    if ($nama === '') $nama = $saya ? (string)$r['full_name'] : qi_comp_samarkan((string)$r['full_name']);
    $trades = (int)$r['trades'];
    return [
        'rank'       => $rank,
        'nama'       => $nama,
        'negara'     => $r['country_code'] ? strtoupper((string)$r['country_code']) : null,
        'profit_pct' => round($pnl / QI_COMP_SALDO_AWAL * 100, 2),
        'pnl'        => round($pnl, 2),
        'trades'     => $trades,
        'win_rate'   => $trades > 0 ? round((int)$r['menang'] / $trades * 100) : 0,
        'equity'     => round(QI_COMP_SALDO_AWAL + $pnl, 2),
        'lencana'    => qi_komp_lencana($rank),
        'terdaftar'  => in_array((int)$r['user_id'], $terdaftar, true),
        'saya'       => $saya,
    ];
}

/**
 * Baris papan LANGSUNG → bentuk yang dibaca dashboard (qim-pages.js: rank, nama, negara, profit_pct,
 * trades, win_rate, equity, lencana, terdaftar, saya) + kolom arena (kode, return_pct, realized,
 * floating, open_count, aktivitas_ts, harga_basi, …). Tanpa user_id.
 */
function qi_comp_baris_langsung(array $b, int $uid, ?string $namaSaya): array
{
    $saya = $uid > 0 && (int)$b['uid'] === $uid;
    $pub = qi_komp_baris_publik($b);
    if ($saya && $namaSaya !== null) $pub['nama'] = $namaSaya;
    return $pub + [
        'profit_pct' => $b['return_pct'],
        'pnl'        => round($b['realized'] + $b['floating'], 2),
        'saya'       => $saya,
    ];
}

function qi_comp_peserta(PDO $pdo, string $kunci, string $periode): array
{
    $st = $pdo->prepare('SELECT user_id FROM competition_entries WHERE tournament_key = ? AND period_key = ?');
    $st->execute([$kunci, $periode]);
    return array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
}

/** IP yang pernah dipakai akun-akun ini (sesi, log keamanan 30 hari, pendaftaran 60 hari). */
function qi_comp_ip_akun(PDO $pdo, array $uids): array
{
    if (!$uids) return [];
    $in = implode(',', array_fill(0, count($uids), '?'));
    $ip = [];
    foreach ([
        "SELECT user_id, ip_address AS ip FROM user_sessions WHERE user_id IN ($in)",
        "SELECT user_id, ip FROM security_events WHERE user_id IN ($in) AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)",
        "SELECT user_id, ip FROM competition_join_log WHERE user_id IN ($in) AND created_at > DATE_SUB(NOW(), INTERVAL 60 DAY)",
    ] as $sql) {
        try {
            $st = $pdo->prepare($sql);
            $st->execute($uids);
            foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) if ($r['ip']) $ip[(int)$r['user_id']][] = (string)$r['ip'];
        } catch (PDOException $e) { /* tabel opsional (migrasi 020/021) belum ada */ }
    }
    return $ip;
}

/**
 * Irama order manual per peserta dalam rentang (untuk admin, desain audit §B1: ≥ 2 dtk antar order,
 * ≤ 200/hari, dan tampilan irama order). @return array<int,array{order:int,per_jam_maks:int,jeda_median_dtk:?int,jeda_min_dtk:?int}>
 */
function qi_comp_irama(PDO $pdo, array $uids, int $mulai, int $selesai): array
{
    if (!$uids) return [];
    $in = implode(',', array_fill(0, count($uids), '?'));
    $st = $pdo->prepare("SELECT user_id, UNIX_TIMESTAMP(opened_at) AS t FROM paper_positions
                         WHERE source = 'manual' AND user_id IN ($in) AND opened_at >= FROM_UNIXTIME(?) AND opened_at < FROM_UNIXTIME(?)
                         ORDER BY user_id, opened_at");
    $st->execute(array_merge(array_values($uids), [$mulai, $selesai]));
    $waktu = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $waktu[(int)$r['user_id']][] = (int)$r['t'];
    $hasil = [];
    foreach ($waktu as $u => $ts) {
        $jeda = [];
        for ($i = 1; $i < count($ts); $i++) $jeda[] = $ts[$i] - $ts[$i - 1];
        sort($jeda);
        $perJam = array_count_values(array_map(static fn($t) => intdiv($t, 3600), $ts));
        $hasil[$u] = ['order' => count($ts), 'per_jam_maks' => $perJam ? max($perJam) : 0,
                      'jeda_median_dtk' => $jeda ? $jeda[intdiv(count($jeda), 2)] : null, 'jeda_min_dtk' => $jeda ? $jeda[0] : null];
    }
    return $hasil;
}

/**
 * Semua peserta terdaftar satu periode + syarat hadiah masing-masing, urut seperti papan.
 * Turnamen ekuitas (Weekly Championship, Gold Rush): urutan & angka dari papan ekuitas, jumlah trade =
 * posisi tertutup ber-komp_periode itu. Periode LAMPAU hanya dinilai bila sudah FINAL (audit G1: dulu
 * periode yang masih punya posisi terbuka dibangun ulang dengan harga HARI INI — posisi minggu lalu
 * ditandai di harga sekarang). Belum final → 'belum_final' => true dan tanpa baris.
 * @return array{setelan:array,baris:array<int,array>,belum_final?:bool}
 */
function qi_comp_evaluasi(PDO $pdo, string $kunci, array $t, DateTimeImmutable $mulai, DateTimeImmutable $selesai, string $periode): array
{
    $setelan = qi_komp_syarat_setelan();
    if (!empty($t['ditangguhkan'])) return ['setelan' => $setelan, 'baris' => [], 'ditangguhkan' => true];
    $st = $pdo->prepare('SELECT ce.user_id, u.email, u.phone_number, u.full_name, u.is_active, u.status, cp.display_name,
                                UNIX_TIMESTAMP(u.created_at) AS dibuat, UNIX_TIMESTAMP(ce.joined_at) AS daftar_ts
                         FROM competition_entries ce
                         JOIN users u ON u.id = ce.user_id
                         LEFT JOIN user_competition_profile cp ON cp.user_id = ce.user_id
                         WHERE ce.tournament_key = ? AND ce.period_key = ?');
    $st->execute([$kunci, $periode]);
    $peserta = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $peserta[(int)$r['user_id']] = $r;
    if (!$peserta) return ['setelan' => $setelan, 'baris' => []];

    $uids = array_keys($peserta);
    $agregat = [];
    $urutan = [];
    if (($t['skor'] ?? '') === 'ekuitas') {
        [, , $kini] = qi_komp_periode_kini();
        $simbol = (array)($t['simbol'] ?? []);
        if ($periode === $kini) {
            $papan = $simbol ? qi_komp_papan_bangun($pdo, $periode, ['simbol' => $simbol, 'turnamen' => $kunci]) : qi_komp_papan($pdo);
        } elseif (!$simbol) {
            $papan = qi_komp_papan_final($pdo, $periode);
            if (!$papan) return ['setelan' => $setelan, 'baris' => [], 'belum_final' => true];
        } else {
            // Papan per pasar periode lampau: final bila tidak ada lagi posisi terbuka di pasar itu — angkanya
            // lalu murni dari database (tanpa kutipan hari ini).
            $in = implode(',', array_map(static fn($s) => $pdo->quote(strtoupper((string)$s)), $simbol));
            $st = $pdo->prepare("SELECT 1 FROM paper_positions WHERE komp_periode = ? AND source = 'manual' AND status = 'open' AND symbol IN ($in) LIMIT 1");
            $st->execute([$periode]);
            if ($st->fetchColumn()) return ['setelan' => $setelan, 'baris' => [], 'belum_final' => true];
            $papan = qi_komp_papan_bangun($pdo, $periode, ['simbol' => $simbol, 'turnamen' => $kunci, 'kutipan' => static fn() => []]);
        }
        foreach ($papan['baris'] as $i => $b) {
            $agregat[$b['uid']] = ['pnl' => $b['equity'] - QI_COMP_SALDO_AWAL, 'trades' => $b['trades'], 'menang' => $b['menang']];
            $urutan[$b['uid']] = $i;
        }
    } else {
        foreach (qi_comp_agregat($pdo, $mulai, $selesai, $t['pasar'], $uids) as $r) $agregat[(int)$r['user_id']] = $r;
    }
    $ip = qi_comp_ip_akun($pdo, $uids);
    $akun = [];
    foreach ($peserta as $u => $r) $akun[$u] = ['email' => (string)$r['email'], 'telp' => $r['phone_number'], 'ip' => $ip[$u] ?? []];
    $tanda = qi_komp_tanda_multi($akun);

    $baris = [];
    foreach ($peserta as $u => $r) {
        $a = $agregat[$u] ?? null;
        $aktif = (int)$r['is_active'] === 1 && !in_array(strtolower((string)$r['status']), ['banned', 'suspended', 'inactive', 'disabled'], true);
        $baris[] = [
            'user_id' => $u, 'pnl' => (float)($a['pnl'] ?? 0), 'trades' => (int)($a['trades'] ?? 0), 'menang' => (int)($a['menang'] ?? 0),
            'urut' => $urutan[$u] ?? PHP_INT_MAX, 'data' => $r, 'tanda' => $tanda[$u] ?? null,
        ] + qi_komp_kelayakan(['terdaftar' => true, 'trades' => (int)($a['trades'] ?? 0), 'dibuat' => $r['dibuat'] !== null ? (int)$r['dibuat'] : null,
                               'aktif' => $aktif, 'ditandai' => $tanda[$u] ?? null], $setelan, $selesai->getTimestamp(), $t['pasar']);
    }
    if ($urutan) usort($baris, static fn($x, $y) => [$x['urut'], $x['user_id']] <=> [$y['urut'], $y['user_id']]);
    else usort($baris, static fn($x, $y) => [$y['pnl'], $y['trades'], $x['user_id']] <=> [$x['pnl'], $x['trades'], $y['user_id']]);
    return ['setelan' => $setelan, 'baris' => $baris];
}

try {
    $turnamen = qi_comp_turnamen();

    // ── GET ?harga=… : kutipan kanonik untuk tiket arena (PRO ke atas) ──────────
    if ($metode === 'GET' && isset($_GET['harga'])) {
        qi_require_level('pro');
        // Semua simbol paper trading (QI_PAPER_SIMBOL), bukan hanya 10 simbol arena: posisi turnamen BNBUSDT/
        // AUDUSD/USOIL… dari Quick Trade dulu tidak bisa ditandai atau ditutup di arena (audit G1).
        $syms = array_values(array_intersect(array_map('trim', explode(',', strtoupper((string)$_GET['harga']))),
                                             array_values(array_unique(array_merge(QI_KOMP_SIMBOL, QI_PAPER_SIMBOL)))));
        if (!$syms) qi_comp_jawab(['status' => 'error', 'message' => 'Simbol tidak dikenal.'], 400);
        $kutipan = qi_komp_kutipan(array_slice($syms, 0, 12));
        qi_comp_jawab(['status' => 'success', 'tingkat' => qi_komp_tingkat(), 'sekarang' => time(), 'kutipan' => $kutipan,
                       'umur_maks_isi' => QI_PAPER_UMUR_ACUAN_MAKS]);
    }

    // ── GET ?trader=<kode> : laci trader (publik, nama disamarkan) ────────────
    if ($metode === 'GET' && isset($_GET['trader'])) {
        $kode = (string)$_GET['trader'];
        if (!preg_match('/^[0-9a-f]{12}$/', $kode)) qi_comp_jawab(['status' => 'error', 'message' => 'Kode trader tidak sah.'], 400);
        $detail = qi_komp_trader($pdo, qi_komp_papan($pdo), $kode);
        if (!$detail) qi_comp_jawab(['status' => 'error', 'message' => 'Trader tidak ada di papan periode ini.'], 404);
        qi_comp_jawab(['status' => 'success', 'sekarang' => time()] + $detail);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if ($metode === 'POST') {
        $pengguna = qi_require_auth();
        $uid = (int)$pengguna['user_id'];
        $in = qi_get_json_body();
        if (!is_array($in)) $in = [];
        $aksi = (string)($in['aksi'] ?? '');

        if ($aksi === 'daftar') {
            $kunci = (string)($in['turnamen'] ?? '');
            if (!isset($turnamen[$kunci])) qi_comp_jawab(['status' => 'error', 'message' => 'Turnamen tidak dikenal.'], 400);
            if (!empty($turnamen[$kunci]['ditangguhkan'])) {
                qi_comp_jawab(['status' => 'error', 'code' => 'TURNAMEN_DITANGGUHKAN', 'message' => $turnamen[$kunci]['nama']
                    . ' ditangguhkan sampai penilaiannya memakai ekuitas per periode (posisi terbuka ikut dihitung). Ikuti Weekly Championship atau Gold Rush Weekly.'], 409);
            }
            // FREE dulu bisa mendaftar tetapi tidak bisa trading (paper trading butuh PRO) — pendaftaran
            // yang tidak bisa dipakai. Sekarang ditolak dengan alasan yang jelas.
            if (qi_tingkat_peran($pengguna['role'] ?? null) < 1) {
                qi_comp_jawab(['status' => 'error', 'code' => 'PRO_REQUIRED', 'message' => 'Turnamen untuk anggota Quantum+ PRO / VIP — trading di arena memakai paper trading PRO.'], 403);
            }
            [, , $periode] = qi_comp_periode($turnamen[$kunci]['jenis'], $zona);
            $ins = $pdo->prepare('INSERT IGNORE INTO competition_entries (tournament_key, period_key, user_id) VALUES (?, ?, ?)');
            $ins->execute([$kunci, $periode, $uid]);
            if ($ins->rowCount() > 0) {
                // Jejak untuk pemeriksaan satu orang satu akun (hanya dilihat admin).
                try {
                    $pdo->prepare('INSERT INTO competition_join_log (tournament_key, period_key, user_id, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
                        ->execute([$kunci, $periode, $uid, mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
                } catch (PDOException $e) { /* migrasi 021 belum dijalankan */ }
            }
            qi_comp_jawab(['status' => 'success', 'message' => 'Terdaftar di ' . $turnamen[$kunci]['nama'] . ' periode ' . $periode . '.']);
        }

        if ($aksi === 'profil') {
            $nama = trim((string)($in['nama_tampilan'] ?? ''));
            $negara = strtoupper(trim((string)($in['negara'] ?? '')));
            if ($nama !== '' && !preg_match('/^[A-Za-z0-9_.\-]{3,24}$/', $nama)) {
                qi_comp_jawab(['status' => 'error', 'message' => 'Nama tampilan 3–24 karakter: huruf, angka, _ . -'], 400);
            }
            if ($negara !== '' && !preg_match('/^[A-Z]{2}$/', $negara)) {
                qi_comp_jawab(['status' => 'error', 'message' => 'Kode negara harus 2 huruf (ISO), mis. ID.'], 400);
            }
            try {
                $pdo->prepare('INSERT INTO user_competition_profile (user_id, display_name, country_code) VALUES (?, ?, ?)
                               ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), country_code = VALUES(country_code)')
                    ->execute([$uid, $nama !== '' ? $nama : null, $negara !== '' ? $negara : null]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') qi_comp_jawab(['status' => 'error', 'message' => 'Nama tampilan sudah dipakai trader lain.'], 409);
                throw $e;
            }
            qi_comp_jawab(['status' => 'success', 'message' => 'Profil kompetisi disimpan.']);
        }
        qi_comp_jawab(['status' => 'error', 'message' => 'Aksi tidak dikenal.'], 400);
    }

    // ── GET ?kandidat=1 (ADMIN): kandidat pemenang untuk ditinjau ─────────────────
    if (!empty($_GET['kandidat'])) {
        $pengguna = qi_require_auth();
        if (($pengguna['role'] ?? '') !== 'admin') qi_comp_jawab(['status' => 'error', 'message' => 'Hanya admin.'], 403);
        $kunci = (string)($_GET['turnamen'] ?? 'weekly-championship');
        if (!isset($turnamen[$kunci])) qi_comp_jawab(['status' => 'error', 'message' => 'Turnamen tidak dikenal.'], 400);
        $t = $turnamen[$kunci];
        [$mulai, $selesai, $periode] = qi_comp_periode($t['jenis'], $zona);
        if (!empty($_GET['periode'])) {
            $r = qi_komp_periode_dari_kunci($t['jenis'], (string)$_GET['periode'], $zona);
            if (!$r) qi_comp_jawab(['status' => 'error', 'message' => 'Format periode tidak dikenal.'], 400);
            [$mulai, $selesai] = $r;
            $periode = (string)$_GET['periode'];
        }
        $ev = qi_comp_evaluasi($pdo, $kunci, $t, $mulai, $selesai, $periode);
        if (!empty($ev['ditangguhkan'])) {
            qi_comp_jawab(['status' => 'error', 'code' => 'TURNAMEN_DITANGGUHKAN', 'message' => $t['nama'] . ' ditangguhkan — belum dinilai dari ekuitas per periode, jadi tidak ada kandidat pemenang.'], 409);
        }
        if (!empty($ev['belum_final'])) {
            qi_comp_jawab(['status' => 'error', 'code' => 'BELUM_FINAL', 'message' => 'Klasemen periode ' . $periode
                . ' belum final: masih ada posisi yang menunggu harga penutupan server. Kandidat pemenang tidak dihitung dari harga hari ini.'], 409);
        }
        $irama = qi_comp_irama($pdo, array_map(static fn($b) => (int)$b['user_id'], array_slice($ev['baris'], 0, 50)), $mulai->getTimestamp(), $selesai->getTimestamp());
        $posisi = 0;
        $kandidat = [];
        foreach (array_slice($ev['baris'], 0, 50) as $i => $b) {
            $berhak = $b['layak'] || $b['ditinjau'];
            $kandidat[] = [
                'rank_peserta' => $i + 1,
                'posisi_juara' => $berhak ? ++$posisi : null,
                'user_id'      => $b['user_id'],
                'nama'         => (string)$b['data']['full_name'],
                'nama_tampilan'=> $b['data']['display_name'],
                'email'        => (string)$b['data']['email'],
                'profit_pct'   => round($b['pnl'] / QI_COMP_SALDO_AWAL * 100, 2),
                'pnl'          => round($b['pnl'], 2),
                'trades'       => $b['trades'],
                'win_rate'     => $b['trades'] > 0 ? round($b['menang'] / $b['trades'] * 100) : 0,
                'layak'        => $b['layak'],
                'ditinjau'     => $b['ditinjau'],
                'gagal'        => array_values(array_map(static fn($s) => $s['label'] . ' — ' . $s['detail'], array_filter($b['syarat'], static fn($s) => !$s['ok']))),
                'kelompok'     => $b['tanda'] ? ['id' => $b['tanda']['kelompok'], 'ukuran' => $b['tanda']['ukuran'], 'alasan' => $b['tanda']['alasan']] : null,
                // Irama order manual dalam periode (semua simbol): jumlah, puncak per jam, jeda median & minimum.
                'irama'        => $irama[$b['user_id']] ?? ['order' => 0, 'per_jam_maks' => 0, 'jeda_median_dtk' => null, 'jeda_min_dtk' => null],
            ];
        }
        qi_comp_jawab([
            'status' => 'success', 'turnamen' => $kunci, 'nama' => $t['nama'], 'periode' => $periode,
            'mulai' => $mulai->format(DATE_ATOM), 'selesai' => $selesai->format(DATE_ATOM), 'berjalan' => $selesai > new DateTimeImmutable('now', $zona),
            'syarat' => $ev['setelan'], 'hadiah' => $t['hadiah'], 'hadiah_contoh' => $t['hadiah_contoh'],
            'peserta' => count($ev['baris']), 'kandidat' => $kandidat,
        ]);
    }

    // ── GET papan ────────────────────────────────────────────────────────────
    $papan = strtolower((string)($_GET['papan'] ?? 'global'));
    if (!in_array($papan, ['global', 'indonesia', 'friends', 'weekly', 'monthly'], true)) $papan = 'global';
    // Papan mingguan TERBUKA untuk dipantau siapa saja (permintaan pemilik: orang lain bisa memantau
    // para trader). Papan lain dan semua data pribadi tetap butuh login.
    $pengguna = $papan === 'weekly' ? qi_validate_token() : qi_require_auth();
    if (!$pengguna && !empty($GLOBALS['qi_2fa_tertunda'])) $pengguna = null;
    $uid = $pengguna ? (int)$pengguna['user_id'] : 0;
    $ringkas = !empty($_GET['ringkas']) || $uid === 0;
    $batas = max(10, min(100, (int)($_GET['batas'] ?? 10)));

    $utama = $turnamen['weekly-championship'];
    [$mulaiW, $selesaiW, $periodeW] = qi_comp_periode('weekly', $zona);
    $langsung = qi_komp_papan($pdo);
    $pesertaUtama = qi_comp_peserta($pdo, 'weekly-championship', $periodeW);

    $namaSaya = null;
    $profil = ['display_name' => null, 'country_code' => null];
    if ($uid > 0) {
        $st = $pdo->prepare('SELECT u.full_name, cp.display_name, cp.country_code FROM users u LEFT JOIN user_competition_profile cp ON cp.user_id = u.id WHERE u.id = ?');
        $st->execute([$uid]);
        $p = $st->fetch(PDO::FETCH_ASSOC) ?: [];
        $profil = ['display_name' => $p['display_name'] ?? null, 'country_code' => $p['country_code'] ?? null];
        $namaSaya = trim((string)($p['display_name'] ?? '')) !== '' ? (string)$p['display_name'] : (string)($p['full_name'] ?? '');
    }

    $baris = [];
    $barisSaya = null;
    $periodePapan = $periodeW;
    $final = false;
    $aktivitas = [];
    $mingguIni = null;
    if ($papan === 'weekly') {
        $sumber = $langsung;
        $minta = (string)($_GET['periode'] ?? '');
        if ($minta !== '' && $minta !== $periodeW) {
            if (!qi_komp_batas_periode($minta)) qi_comp_jawab(['status' => 'error', 'message' => 'Format periode tidak dikenal (contoh 2026-W42).'], 400);
            $sumber = qi_komp_papan_final($pdo, $minta);
            if (!$sumber) qi_comp_jawab(['status' => 'error', 'code' => 'BELUM_FINAL', 'message' => 'Klasemen periode ' . $minta . ' belum dibekukan (masih ada posisi yang menunggu harga penutupan) atau tidak ada pesertanya.'], 404);
            $periodePapan = $minta;
            $final = true;
        }
        foreach ($sumber['baris'] as $i => $b) {
            $pub = qi_comp_baris_langsung($b, $uid, $namaSaya);
            if ($i < $batas) $baris[] = $pub;
            if ($pub['saya']) $barisSaya = $pub;
        }
        $aktivitas = $sumber['aktivitas'];
        $total = count($sumber['baris']);
    } else {
        $mulai = $selesai = null;
        if ($papan === 'monthly') [$mulai, $selesai] = qi_comp_periode('monthly', $zona);
        $hanya = null;
        if ($papan === 'friends') $hanya = array_merge([$uid], qi_comp_teman($uid));
        $agregat = qi_comp_agregat($pdo, $mulai, $selesai, 'semua', $hanya, $papan === 'indonesia' ? 'ID' : null);
        foreach ($agregat as $i => $r) {
            $b = qi_comp_baris($r, $i + 1, $uid, $pesertaUtama);
            if ($i < 10) $baris[] = $b;
            if ($b['saya']) $barisSaya = $b;
        }
        $total = count($agregat);
    }
    // Baris mingguan pemanggil (kartu "Peringkat minggu ini" di arena) — selalu dari papan langsung.
    foreach ($langsung['baris'] as $b) {
        if ($uid > 0 && (int)$b['uid'] === $uid) { $mingguIni = qi_comp_baris_langsung($b, $uid, $namaSaya) + ['dari' => $langsung['trader']]; break; }
    }

    // Statistik saya (dashboard "Your Stats"): sepanjang waktu, dibandingkan dengan semua trader.
    $statSaya = null;
    $kelayakanSaya = null;
    $lain = [];
    $setelanSyarat = qi_komp_syarat_setelan();
    if (!$ringkas) {
        $semua = qi_comp_agregat($pdo, null, null);
        foreach ($semua as $i => $r) {
            if ((int)$r['user_id'] !== $uid) continue;
            $b = qi_comp_baris($r, $i + 1, $uid, $pesertaUtama);
            $progres = null;
            if ($i > 0) {
                $atas = (float)$semua[$i - 1]['pnl'];
                $bawah = isset($semua[$i + 1]) ? (float)$semua[$i + 1]['pnl'] : min(0.0, (float)$r['pnl']);
                $rentang = $atas - $bawah;
                $progres = $rentang > 0 ? max(0, min(100, round(((float)$r['pnl'] - $bawah) / $rentang * 100, 1))) : 0;
            }
            $statSaya = $b + [
                'dari'           => count($semua),
                'terbaik'        => round((float)$r['terbaik'], 2),
                'terburuk'       => round((float)$r['terburuk'], 2),
                'progres_pct'    => $progres,
                'rank_berikut'   => $i > 0 ? $i : null,
            ];
            break;
        }

        // Syarat hadiah saya untuk turnamen utama periode ini.
        if (in_array($uid, $pesertaUtama, true)) {
            foreach (qi_comp_evaluasi($pdo, 'weekly-championship', $utama, $mulaiW, $selesaiW, $periodeW)['baris'] as $b) {
                if ($b['user_id'] === $uid) { $kelayakanSaya = ['layak' => $b['layak'], 'ditinjau' => $b['ditinjau'], 'syarat' => $b['syarat']]; break; }
            }
        }
        if ($kelayakanSaya === null) {
            $dibuat = $pdo->prepare('SELECT UNIX_TIMESTAMP(created_at) AS dibuat, is_active, status FROM users WHERE id = ?');
            $dibuat->execute([$uid]);
            $u = $dibuat->fetch(PDO::FETCH_ASSOC) ?: [];
            $kelayakanSaya = qi_komp_kelayakan(['terdaftar' => false, 'trades' => (int)($mingguIni['trades'] ?? 0), 'dibuat' => isset($u['dibuat']) ? (int)$u['dibuat'] : null,
                'aktif' => (int)($u['is_active'] ?? 0) === 1, 'ditandai' => null], $setelanSyarat, $selesaiW->getTimestamp(), $utama['pasar']);
            foreach ($kelayakanSaya['syarat'] as &$s) if ($s['kunci'] === 'satu_akun') $s['detail'] = 'Diperiksa terhadap peserta lain setelah Anda mendaftar.';
            unset($s);
        }

        foreach ($turnamen as $k => $t) {
            if ($k === 'weekly-championship' || !empty($t['ditangguhkan'])) continue;   // ditangguhkan: tidak ditawarkan
            [, $sel, $per] = qi_comp_periode($t['jenis'], $zona);
            $p = qi_comp_peserta($pdo, $k, $per);
            $lain[] = ['kunci' => $k, 'nama' => $t['nama'], 'pasar' => $t['pasar'], 'jenis' => $t['jenis'],
                'total_hadiah' => array_sum(array_column($t['hadiah'], 'nilai')), 'hadiah_contoh' => $t['hadiah_contoh'],
                'peserta' => count($p), 'terdaftar' => in_array($uid, $p, true), 'selesai' => $sel->format(DATE_ATOM)];
        }
    }

    qi_comp_jawab([
        'status'   => 'success',
        'sekarang' => (new DateTimeImmutable('now', $zona))->format(DATE_ATOM),
        'penonton' => $uid === 0,
        'turnamen' => [
            'kunci' => 'weekly-championship', 'nama' => $utama['nama'],
            'mulai' => $mulaiW->format(DATE_ATOM), 'selesai' => $selesaiW->format(DATE_ATOM), 'periode' => $periodeW,
            'hadiah' => $utama['hadiah'], 'total_hadiah' => array_sum(array_column($utama['hadiah'], 'nilai')),
            // Peserta = terdaftar ∪ yang sudah trading periode ini (papan langsung).
            'hadiah_contoh' => $utama['hadiah_contoh'], 'peserta' => $langsung['peserta'], 'trader' => $langsung['trader'],
            'terdaftar' => in_array($uid, $pesertaUtama, true),
            'aturan' => $ringkas ? null : qi_komp_aturan($utama, $setelanSyarat, $utama['hadiah_contoh']),
            'aturan_draf' => !$setelanSyarat['ditetapkan'],
            'kelayakan' => $kelayakanSaya,
            'leverage' => QI_KOMP_LEVERAGE, 'stopout_pct' => QI_KOMP_STOPOUT * 100, 'saldo_awal' => QI_KOMP_SALDO_AWAL,
        ],
        'admin'   => ($pengguna['role'] ?? '') === 'admin',
        'papan'   => ['jenis' => $papan, 'periode' => $periodePapan, 'final' => $final, 'dibangun' => $papan === 'weekly' ? ($final ? null : $langsung['dibangun']) : null,
                      'baris' => $baris, 'saya_di_luar' => ($barisSaya && !in_array($barisSaya, $baris, true)) ? $barisSaya : null, 'total' => $total],
        'aktivitas' => $aktivitas,
        'saya_minggu' => $mingguIni,
        'saya'    => $statSaya,
        'profil'  => ['nama_tampilan' => $profil['display_name'], 'negara' => $profil['country_code']],
        'lainnya' => $lain,
    ]);
} catch (PDOException $e) {
    if ($e->getCode() === '42S02') {
        qi_comp_jawab(['status' => 'error', 'code' => 'MIGRASI_BELUM', 'message' => 'Tabel kompetisi belum ada. Jalankan database/migrations/017_competition.sql.'], 503);
    }
    qi_log('error', 'competition gagal', ['pesan' => $e->getMessage()]);
    qi_comp_jawab(['status' => 'error', 'message' => 'Data kompetisi tidak dapat dimuat.'], 500);
}
