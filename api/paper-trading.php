<?php
/**
 * Paper Trading Persistence API
 *
 * GET  → posisi & history milik user (butuh token) + ringkasan akun turnamen (data.kompetisi)
 * POST {aksi:'buka', symbol, side, lots, sl?, tp?, harga?, client_order_id?, asal?}
 *                                          → buka posisi di harga pasar SERVER (feed kanonik)
 * POST {aksi:'tutup', id:'POS-n', harga?}  → tutup posisi di harga pasar SERVER
 * POST {aksi:'ubah', id:'POS-n', sl, tp}   → ubah SL/TP posisi terbuka ({berubah:false} bila sama — tidak
 *                                            ada yang disentuh); level LAMA dinilai dulu di bar M1 segar
 * POST tanpa aksi (snapshot lama)          → 410: jalur snapshot DIPENSIUNKAN (lihat bawah)
 *
 * Penolakan order: HTTP 4xx {status:'ditolak', message, kode?} dengan kode
 *   requote | pasar_tutup | harga_basi | margin | batas_rugi_harian | terlalu_cepat | simbol | lot | sltp
 *   | periode_selesai (posisi turnamen periode lalu: hanya server yang menutupnya)
 *
 * Paper trading = uang virtual, jadi tidak ada risiko finansial nyata. Tetapi papan peringkat
 * kompetisi dihitung dari tabel ini, jadi SEMUA harga dan P/L ditentukan server.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$user = qi_require_level('pro');  // Paper Trading — PRO
$uid  = (int)$user['user_id'];
$pdo  = qi_db();

require_once __DIR__ . '/_paper_order.php';
require_once __DIR__ . '/_kompetisi_settle.php';   // feed kanonik, skema 027, SL/TP & stop-out server
// Daftar simbol tinggal di _paper_order.php (QI_PAPER_SIMBOL) supaya competition.php?harga= melayani
// simbol yang SAMA — termasuk AUDUSD/NZDUSD/USDCHF/USDCAD (model P/L-nya ada di _paper_math.php).
// Silang JPY (GBPJPY, EURJPY) sengaja TIDAK: P/L-nya butuh kurs USDJPY saat tutup, yang
// belum dimodelkan — lebih baik ditolak dengan alasan daripada dihitung salah.
$ALLOWED_SYMBOLS = QI_PAPER_SIMBOL;
$STARTING_BALANCE = 10000.0;

// Kolom migrasi 027 (komp_periode, client_order_id, close_reason, …) dipasang saat runtime.
// HARUS sebelum transaksi apa pun (ALTER = commit implisit).
$skemaSiap = qi_komp_skema_siapkan($pdo);

// SL/TP, stop-out, dan akhir periode milik pemanggil diselesaikan DULU, supaya GET tidak pernah
// menampilkan posisi yang seharusnya sudah tertutup dan POST tidak bertindak atas keadaan basi.
if ($skemaSiap) {
    try { qi_paper_settle($pdo, $uid); } catch (Throwable $e) { error_log('[QI PaperTrading] settle: ' . $e->getMessage()); }
}

/** Saldo = modal awal + seluruh P/L terealisasi (semua sumber, sama dengan GET). */
$saldoSekarang = static function () use ($pdo, $uid, $STARTING_BALANCE): float {
    $st = $pdo->prepare("SELECT COALESCE(SUM(pnl_usd), 0) FROM paper_positions WHERE user_id = :uid AND status = 'closed'");
    $st->execute([':uid' => $uid]);
    return round($STARTING_BALANCE + (float)$st->fetchColumn(), 2);
};

/** Ringkasan akun turnamen pemanggil (periode berjalan, posisi manual ber-komp_periode saja). */
$ringkasKompetisi = static function () use ($pdo, $uid, $skemaSiap): ?array {
    if (!$skemaSiap) return null;
    [$mulai, $selesai, $periode] = qi_komp_periode_kini();
    $st = $pdo->prepare("SELECT DISTINCT symbol FROM paper_positions WHERE user_id = :u AND komp_periode = :p AND source = 'manual' AND status = 'open'");
    $st->execute([':u' => $uid, ':p' => $periode]);
    $syms = $st->fetchAll(PDO::FETCH_COLUMN);
    $akun = qi_komp_akun_db($pdo, $uid, $periode, $syms ? qi_komp_kutipan($syms, 5) : []);
    return [
        'periode'         => $periode,
        'mulai'           => $mulai->format(DATE_ATOM),
        'selesai'         => $selesai->format(DATE_ATOM),
        'saldo_awal'      => QI_KOMP_SALDO_AWAL,
        'leverage'        => QI_KOMP_LEVERAGE,
        'stopout_pct'     => QI_KOMP_STOPOUT * 100,
        'saldo'           => $akun['saldo'],
        'ekuitas'         => $akun['ekuitas'],
        'realisasi'       => $akun['realisasi'],
        'mengambang'      => $akun['mengambang'],
        'margin_terpakai' => $akun['margin_terpakai'],
        'margin_bebas'    => $akun['margin_bebas'],
        'level_margin'    => $akun['level_margin'],
        'tanpa_harga'     => $akun['tanpa_harga'],   // posisi yang belum bisa ditandai (mengambangnya tidak dihitung)
        'posisi_terbuka'  => count($akun['kaki']),
        'trades'          => $akun['trades'],
    ];
};

// ─── GET: muat posisi & history ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // UNIX_TIMESTAMP di MySQL: kolom waktu tersimpan di zona waktu sesi MySQL, sedangkan zona PHP
    // (php.ini) bisa berbeda — strtotime() di PHP akan menggeser jamnya.
    $stmt = $pdo->prepare('SELECT *, UNIX_TIMESTAMP(opened_at) AS opened_ts, UNIX_TIMESTAMP(closed_at) AS closed_ts
                           FROM paper_positions WHERE user_id = :uid ORDER BY opened_at ASC, id ASC');
    $stmt->execute([':uid' => $uid]);
    $rows = $stmt->fetchAll();

    $positions = [];
    $history   = [];
    $closedPnl = 0.0;
    $iso = static fn($ts) => $ts ? gmdate('Y-m-d\\TH:i:s\\Z', (int)$ts) : null;

    foreach ($rows as $r) {
        $obj = [
            'id'         => 'POS-' . $r['id'],
            'symbol'     => $r['symbol'],
            'side'       => $r['direction'],
            'lots'       => (float)$r['lots'],
            'entryPrice' => (float)$r['entry_price'],
            'sl'         => $r['stop_loss']   !== null ? (float)$r['stop_loss']   : null,
            'tp'         => $r['take_profit'] !== null ? (float)$r['take_profit'] : null,
            'openedAt'   => $iso($r['opened_ts']),   // ISO-8601 UTC, tanggal + jam lengkap
            'src'        => $r['source'] ?? 'manual',  // 'auto' = dari Ikuti Auto Analisa, 'ai' = AI Auto-Trade
        ];
        if (!empty($r['komp_periode'])) $obj['kompPeriode'] = (string)$r['komp_periode'];   // ikut turnamen periode ini
        if (!empty($r['asal'])) $obj['asal'] = (string)$r['asal'];
        // Seri harga posisi (XAUUSD: emas nyata vs PROKSI PAXG + G) — klien menandai di seri yang sama.
        if (!empty($r['harga_sumber'])) $obj['hargaSumber'] = (string)$r['harga_sumber'];
        if (isset($r['harga_geser']) && $r['harga_geser'] !== null) $obj['hargaGeser'] = (float)$r['harga_geser'];
        if ($r['status'] === 'open') {
            $obj['floatingPnL'] = 0;
            $obj['openTime']    = $r['opened_ts'] ? date('H:i:s', (int)$r['opened_ts']) : '';
            $positions[] = $obj;
        } elseif ($r['status'] === 'closed') {
            $obj['closePrice']  = (float)$r['close_price'];
            $obj['realizedPnL'] = (float)$r['pnl_usd'];
            $obj['closeTime']   = $r['closed_ts'] ? date('H:i:s', (int)$r['closed_ts']) : '';
            $obj['closedAt']    = $iso($r['closed_ts']);   // tanggal lengkap (batas rugi harian, P/L "Hari ini")
            // 'manual' | 'sl' | 'tp' | 'stopout' | 'period_end' — null untuk baris sebelum migrasi 027.
            $obj['closeReason'] = !empty($r['close_reason']) ? (string)$r['close_reason'] : null;
            $obj['_ts']         = (int)$r['closed_ts'];
            $obj['_id']         = (int)$r['id'];
            $closedPnl += (float)$r['pnl_usd'];
            $history[] = $obj;
        }
    }

    // History terbaru ditutup di atas (sama seperti unshift di klien). Diurutkan menurut waktu
    // tutup, bukan waktu buka, supaya urutan stabil antar muat.
    usort($history, static fn($a, $b) => [$b['_ts'], $b['_id']] <=> [$a['_ts'], $a['_id']]);
    foreach ($history as &$h) unset($h['_ts'], $h['_id']);
    unset($h);

    $kompetisi = null;
    try { $kompetisi = $ringkasKompetisi(); } catch (Throwable $e) { error_log('[QI PaperTrading] ringkas kompetisi: ' . $e->getMessage()); }

    echo json_encode(['status' => 'success', 'data' => [
        'balance'   => round($STARTING_BALANCE + $closedPnl, 2),
        'positions' => $positions,
        'history'   => $history,
        'symbols'   => $ALLOWED_SYMBOLS,
        'kompetisi' => $kompetisi,
    ]]);
    exit();
}

// ─── POST {aksi}: satu order, harga ditentukan server ────────────────
// Pengganti pola snapshot. Snapshot membuat KLIEN menjadi sumber kebenaran daftar posisi:
// posisi yang tidak ikut terkirim dibatalkan. Dua tab (dashboard + arena kompetisi) atau
// satu GET yang gagal cukup untuk menghapus posisi orang lain diam-diam — dan di kompetisi,
// posisi yang sedang rugi bisa "dihilangkan" begitu saja. Aksi eksplisit tidak punya masalah itu.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $masukan = qi_get_json_body();
    $aksi = is_array($masukan) && is_string($masukan['aksi'] ?? null) ? $masukan['aksi'] : '';

    // JALUR SNAPSHOT DIPENSIUNKAN (2026-10-22). Penutupan lewat snapshot mencocokkan posisi dari
    // simbol/arah/lot KIRIMAN KLIEN — klien yang dimodifikasi bisa memilih posisi mana yang ditutup
    // dan kapan, sehingga P/L papan peringkat bisa direkayasa. Semua klien versi baru (dashboard,
    // arena) memakai {aksi}; tab lama yang masih ter-cache diminta memuat ulang, bukan dilayani.
    if ($aksi === '') {
        http_response_code(410);
        echo json_encode(['status' => 'error', 'kode' => 'versi_lama',
                          'message' => 'Versi halaman ini sudah lama — muat ulang halaman (Ctrl+F5).']);
        exit();
    }

    require_once __DIR__ . '/_batas_rugi.php';
    $angka = static fn($v) => (is_numeric($v) && (float)$v > 0) ? (float)$v : null;
    $balas = static function (int $kode, array $isi) { http_response_code($kode); echo json_encode($isi); exit(); };
    $tolak = static function (string $pesan, int $kode = 422, ?string $alasan = null) use ($balas) {
        $isi = ['status' => 'ditolak', 'message' => $pesan];
        if ($alasan !== null) $isi['kode'] = $alasan;
        $balas($kode, $isi);
    };
    $ambilBaris = static function (string $id) use ($pdo, $uid): ?array {
        if (!preg_match('/^POS-(\d+)$/', $id, $m)) return null;
        $st = $pdo->prepare('SELECT *, UNIX_TIMESTAMP(opened_at) AS opened_ts, UNIX_TIMESTAMP(closed_at) AS closed_ts
                             FROM paper_positions WHERE id = :id AND user_id = :uid');
        $st->execute([':id' => (int)$m[1], ':uid' => $uid]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        return $r ?: null;
    };
    $namaAlasan = ['sl' => 'stop loss', 'tp' => 'take profit', 'stopout' => 'stop-out margin', 'period_end' => 'akhir periode turnamen', 'manual' => 'Anda'];
    $sudahDitutup = static function (array $r) use ($namaAlasan): string {
        if (($r['status'] ?? '') === 'cancelled') {
            return 'Posisi ini sudah dibatalkan server' . (($r['close_reason'] ?? '') === 'period_end' ? ' (akhir periode turnamen tanpa harga penutupan yang tercatat — tanpa P/L)' : '') . '.';
        }
        $oleh = $namaAlasan[$r['close_reason'] ?? ''] ?? null;
        return 'Posisi ini sudah ditutup' . ($oleh && ($r['close_reason'] ?? '') !== 'manual' ? ' oleh server (' . $oleh . ')' : '')
             . ($r['close_price'] !== null ? ' @ ' . (float)$r['close_price'] : '') . '.';
    };
    /**
     * Posisi turnamen periode LALU hanya boleh diselesaikan server (audit G1): dulu 'tutup' tidak
     * memeriksa periode, jadi posisi yang tidak bisa diberi harga di batas periode (feed tanpa bar M1)
     * tetap terbuka dan pemiliknya menutupnya berhari-hari kemudian di harga pilihannya — P/L itu lalu
     * dibukukan ke klasemen minggu yang sudah selesai, dan klasemen itu tidak bisa dibekukan.
     */
    $tolakPeriodeLalu = static function (array $r) use ($tolak): void {
        $kp = (string)($r['komp_periode'] ?? '');
        if ($kp === '' || $kp === qi_komp_periode_kini()[2]) return;
        $tolak('Posisi turnamen periode ' . $kp . ' sudah berakhir. Server menutupnya di harga nyata terakhir sebelum batas periode; '
             . 'posisi ini tidak bisa lagi ditutup atau diubah dari sini.', 409, 'periode_selesai');
    };
    if (!$skemaSiap) $balas(503, ['status' => 'error', 'message' => 'Database paper trading sedang disiapkan. Coba lagi sebentar.']);

    if ($aksi === 'buka') {
        $sym = strtoupper(trim((string)($masukan['symbol'] ?? '')));
        if (!in_array($sym, $ALLOWED_SYMBOLS, true)) $tolak("Simbol $sym belum didukung paper trading.", 422, 'simbol');
        $arah = ($masukan['side'] ?? '') === 'SELL' ? 'SELL' : (($masukan['side'] ?? '') === 'BUY' ? 'BUY' : '');
        if ($arah === '') $tolak('Arah order harus BUY atau SELL.');
        $lots = is_numeric($masukan['lots'] ?? null) ? round((float)$masukan['lots'], 2) : 0.0;
        if ($lots < 0.01 || $lots > 100) $tolak('Lot harus 0,01–100.', 422, 'lot');
        $sl = $angka($masukan['sl'] ?? null);
        $tp = $angka($masukan['tp'] ?? null);
        // Kunci idempotensi dari klien (crypto.randomUUID()): pengiriman ulang = posisi yang sama.
        $cid = $masukan['client_order_id'] ?? null;
        if ($cid !== null && (!is_string($cid) || !preg_match('/^[A-Za-z0-9_-]{8,40}$/', $cid))) {
            $tolak('client_order_id harus 8–40 karakter (huruf, angka, - atau _).', 400);
        }
        $asal = in_array($masukan['asal'] ?? null, ['tiket', 'quick', 'form', 'sinyal'], true) ? $masukan['asal'] : null;

        $cariDuplikat = static function () use ($pdo, $uid, $cid, $ambilBaris): ?array {
            if ($cid === null) return null;
            $st = $pdo->prepare('SELECT id FROM paper_positions WHERE user_id = :u AND client_order_id = :c');
            $st->execute([':u' => $uid, ':c' => $cid]);
            $id = $st->fetchColumn();
            return $id ? $ambilBaris('POS-' . $id) : null;
        };
        $jawabDuplikat = static function (array $baris) use ($balas, $saldoSekarang) {
            $balas(200, ['status' => 'success', 'posisi' => qi_paper_baris_ke_obj($baris), 'balance' => $saldoSekarang(), 'duplikat' => true]);
        };
        if ($dup = $cariDuplikat()) $jawabDuplikat($dup);

        $batasRugi = qi_batas_rugi_status($pdo, $uid);
        if ($batasRugi['tercapai']) $balas(422, ['status' => 'ditolak', 'message' => qi_batas_rugi_pesan($batasRugi), 'kode' => 'batas_rugi_harian']);
        $st = $pdo->prepare("SELECT COUNT(*) FROM paper_positions WHERE user_id = :uid AND status = 'open' AND source = 'manual'");
        $st->execute([':uid' => $uid]);
        if ((int)$st->fetchColumn() >= QI_PAPER_POSISI_MAKS) $tolak('Maksimal ' . QI_PAPER_POSISI_MAKS . ' posisi terbuka. Tutup sebagian lebih dulu.');
        // Batas harian per pengguna (lihat QI_KOMP_ORDER_HARIAN_MAKS). opened_at ditulis NOW() di sesi
        // MySQL yang sama, jadi perbandingan dengan NOW() tidak terpengaruh zona PHP.
        $st = $pdo->prepare("SELECT COUNT(*) FROM paper_positions WHERE user_id = :uid AND source = 'manual' AND opened_at >= NOW() - INTERVAL 1 DAY");
        $st->execute([':uid' => $uid]);
        if ((int)$st->fetchColumn() >= QI_KOMP_ORDER_HARIAN_MAKS) {
            $tolak('Batas ' . QI_KOMP_ORDER_HARIAN_MAKS . ' order per 24 jam tercapai. Coba lagi nanti.', 429, 'terlalu_cepat');
        }

        // Satu order BUKA per pengguna sekaligus, dan jeda minimal QI_KOMP_JEDA_ORDER detik antar
        // order (dulu satu-satunya batas adalah 60 permintaan/menit per IP). Kunci dilepas otomatis
        // saat proses selesai, termasuk lewat $balas()/exit.
        $kunci = @fopen(qi_komp_dir() . '/order-' . $uid . '.lock', 'c+');
        if ($kunci && !flock($kunci, LOCK_EX | LOCK_NB)) $tolak('Order sebelumnya masih diproses. Tunggu sebentar.', 429, 'terlalu_cepat');
        if ($kunci) {
            $terakhir = (float)stream_get_contents($kunci);
            if ($dup = $cariDuplikat()) $jawabDuplikat($dup);   // kiriman ulang yang tadi menunggu kunci
            if (microtime(true) - $terakhir < QI_KOMP_JEDA_ORDER) {
                $tolak('Terlalu cepat — beri jeda ' . (int)QI_KOMP_JEDA_ORDER . ' detik antar order.', 429, 'terlalu_cepat');
            }
        }

        $acuan = qi_komp_acuan($sym);
        $eks = qi_paper_harga_eksekusi($sym, $arah === 'BUY' ? 'beli' : 'jual', $angka($masukan['harga'] ?? null), $acuan);
        if (isset($eks['tolak'])) $tolak($eks['tolak'], 409, $eks['kode'] ?? null);
        if ($alasan = qi_paper_cek_sltp($arah, $eks['harga'], $sl, $tp)) $tolak($alasan, 422, 'sltp');

        // Turnamen: order manual PRO/VIP masuk periode berjalan, dan harus lolos margin (1:100).
        $periode = null;
        if (qi_komp_ikut_periode($user['role'] ?? null, $asal)) {
            [, , $periode] = qi_komp_periode_kini();
            $st = $pdo->prepare("SELECT DISTINCT symbol FROM paper_positions WHERE user_id = :u AND komp_periode = :p AND source = 'manual' AND status = 'open'");
            $st->execute([':u' => $uid, ':p' => $periode]);
            $symKaki = $st->fetchAll(PDO::FETCH_COLUMN);
            $akun = qi_komp_akun_db($pdo, $uid, $periode, $symKaki ? qi_komp_kutipan($symKaki, 5) : []);
            if ($alasan = qi_komp_cek_margin($akun, $sym, $lots, $eks['harga'])) {
                $tolak($alasan, 422, $akun['tanpa_harga'] > 0 ? 'harga_basi' : 'margin');
            }
        }

        // Seri harga tempat posisi diisi: posisi hanya dinilai/ditutup di seri yang sama (XAUUSD emas
        // nyata vs PROKSI PAXG + G — api/_kompetisi_harga.php, qi_komp_kutipan_posisi).
        $hargaSumber = $acuan !== null && ($acuan['source'] ?? '') !== '' ? mb_substr((string)$acuan['source'], 0, 24) : null;
        $hargaGeser = $sym === 'XAUUSD' && qi_komp_keluarga_level($sym, $hargaSumber) === 'proksi' ? (float)($acuan['geser'] ?? 0) : null;
        try {
            $pdo->prepare("INSERT INTO paper_positions (user_id, symbol, direction, lots, entry_price, stop_loss, take_profit, status, opened_at, source,
                                                        komp_periode, client_order_id, asal, harga_sumber, harga_geser)
                           VALUES (:uid, :sym, :dir, :lots, :entry, :sl, :tp, 'open', NOW(), 'manual', :kp, :cid, :asal, :hs, :hg)")
                ->execute([':uid' => $uid, ':sym' => $sym, ':dir' => $arah, ':lots' => $lots, ':entry' => $eks['harga'], ':sl' => $sl, ':tp' => $tp,
                           ':kp' => $periode, ':cid' => $cid, ':asal' => $asal, ':hs' => $hargaSumber, ':hg' => $hargaGeser]);
        } catch (PDOException $e) {
            // UNIQUE(user_id, client_order_id): balapan dua kiriman yang sama → kembalikan yang menang.
            if ($e->getCode() === '23000' && ($dup = $cariDuplikat())) $jawabDuplikat($dup);
            throw $e;
        }
        $baris = $ambilBaris('POS-' . $pdo->lastInsertId());
        if ($kunci) { ftruncate($kunci, 0); rewind($kunci); fwrite($kunci, sprintf('%.6F', microtime(true))); fflush($kunci); }

        // Pendaftaran otomatis: PRO/VIP yang membuka order turnamen menjadi peserta periode ini
        // (dulu harus menekan "Daftar" sendiri; yang lupa tidak pernah berhak atas hadiah).
        if ($periode !== null && in_array(qi_tingkat_peran($user['role'] ?? null), [1, 2], true)) {
            try {
                $ins = $pdo->prepare('INSERT IGNORE INTO competition_entries (tournament_key, period_key, user_id) VALUES (?, ?, ?)');
                $ins->execute([QI_KOMP_TURNAMEN, $periode, $uid]);
                if ($ins->rowCount() > 0) {
                    try {
                        $pdo->prepare('INSERT INTO competition_join_log (tournament_key, period_key, user_id, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
                            ->execute([QI_KOMP_TURNAMEN, $periode, $uid, mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
                    } catch (PDOException $e) { /* migrasi 021 belum ada */ }
                }
            } catch (PDOException $e) { error_log('[QI PaperTrading] daftar otomatis: ' . $e->getMessage()); }
        }
        $balas(200, ['status' => 'success', 'posisi' => qi_paper_baris_ke_obj($baris), 'balance' => $saldoSekarang()]);
    }

    if ($aksi === 'tutup') {
        $baris = $ambilBaris((string)($masukan['id'] ?? ''));
        if (!$baris) $tolak('Posisi tidak ditemukan.', 404);
        if ($baris['status'] !== 'open') $tolak($sudahDitutup($baris), 409);
        if (in_array($baris['source'], ['ai', 'auto'], true)) $tolak('Posisi otomatis dikelola server dan tidak ditutup dari sini.', 403);
        $tolakPeriodeLalu($baris);
        $arah = $baris['direction'];
        // Harga tutup di SERI POSISI: posisi XAUUSD emas nyata tidak pernah ditutup di level PAXG (dan
        // sebaliknya) — dulu selisih ±$7 antar seri bisa dipetik tanpa gerak pasar (audit G1).
        $acuan = qi_komp_acuan($baris['symbol'], null, $baris);
        if ($acuan === null && $baris['symbol'] === 'XAUUSD' && !empty($baris['harga_sumber'])) {
            $tolak('Feed XAUUSD saat ini berbeda dari seri harga tempat posisi ini dibuka (' . $baris['harga_sumber'] . '). '
                 . 'Penutupan ditunda sampai seri itu kembali, supaya P/L tidak dihitung di dua level harga berbeda.', 409, 'harga_basi');
        }
        $eks = qi_paper_harga_eksekusi($baris['symbol'], $arah === 'BUY' ? 'jual' : 'beli', $angka($masukan['harga'] ?? null), $acuan);
        if (isset($eks['tolak'])) $tolak($eks['tolak'], 409, $eks['kode'] ?? null);
        $pnl = qi_paper_pnl($baris['symbol'], $arah, (float)$baris['entry_price'], $eks['harga'], (float)$baris['lots']);
        $up = $pdo->prepare("UPDATE paper_positions SET status = 'closed', close_price = :c, pnl_usd = :p, closed_at = NOW(), close_reason = 'manual'
                             WHERE id = :id AND user_id = :uid AND status = 'open'");
        $up->execute([':c' => $eks['harga'], ':p' => $pnl, ':id' => (int)$baris['id'], ':uid' => $uid]);
        // Dua tab menutup posisi yang sama bersamaan (atau SL server menang lebih dulu): hanya yang pertama menang.
        if ($up->rowCount() !== 1) $tolak($sudahDitutup($ambilBaris('POS-' . $baris['id']) ?? $baris), 409);
        $baris = $ambilBaris('POS-' . $baris['id']);
        $balas(200, ['status' => 'success', 'ditutup' => qi_paper_baris_ke_obj($baris), 'balance' => $saldoSekarang()]);
    }

    if ($aksi === 'ubah') {
        $baris = $ambilBaris((string)($masukan['id'] ?? ''));
        if (!$baris) $tolak('Posisi tidak ditemukan.', 404);
        if ($baris['status'] !== 'open') $tolak($sudahDitutup($baris), 409);
        if (in_array($baris['source'], ['ai', 'auto'], true)) $tolak('Posisi otomatis dikelola server dan tidak diubah dari sini.', 403);
        $tolakPeriodeLalu($baris);
        $sl = $angka($masukan['sl'] ?? null);
        $tp = $angka($masukan['tp'] ?? null);
        // SL/TP SAMA dengan yang tersimpan → tidak ada yang diubah, termasuk sltp_checked_at. Audit G1: dulu
        // setiap 'ubah' memajukan titik periksa ke menit berikutnya tanpa syarat, jadi 'ubah' berulang
        // (SL yang sama) di detik pertama tiap menit membuat sumbu M1 yang menembus SL tidak pernah dinilai.
        $sama = static fn($a, $b) => ($a === null || $b === null) ? $a === $b : abs((float)$a - (float)$b) < 0.0000005;
        if ($sama($sl, $baris['stop_loss'] !== null ? (float)$baris['stop_loss'] : null)
            && $sama($tp, $baris['take_profit'] !== null ? (float)$baris['take_profit'] : null)) {
            $balas(200, ['status' => 'success', 'posisi' => qi_paper_baris_ke_obj($baris), 'berubah' => false]);
        }
        // Paling sering sekali per QI_KOMP_JEDA_UBAH detik per posisi (kunci per pengguna dipegang sampai
        // jawaban dikirim, jadi dua 'ubah' bersamaan tidak bisa saling melewati pemeriksaan ini).
        $fu = @fopen(qi_komp_dir() . '/ubah-' . $uid . '.json', 'c+');
        $catatUbah = null;
        if ($fu && flock($fu, LOCK_EX)) {
            $catatan = json_decode((string)stream_get_contents($fu), true);
            $catatan = is_array($catatan) ? array_filter($catatan, static fn($t) => is_numeric($t) && microtime(true) - (float)$t < 60) : [];
            if (microtime(true) - (float)($catatan[(string)$baris['id']] ?? 0) < QI_KOMP_JEDA_UBAH) {
                $tolak('SL/TP posisi ini baru saja diubah — tunggu ' . (int)QI_KOMP_JEDA_UBAH . ' detik.', 429, 'terlalu_cepat');
            }
            // Dicatat hanya setelah perubahan benar-benar tersimpan (SL/TP yang ditolak boleh langsung diperbaiki).
            $catatUbah = static function () use ($fu, $catatan, $baris): void {
                $catatan[(string)$baris['id']] = microtime(true);
                ftruncate($fu, 0); rewind($fu); fwrite($fu, json_encode($catatan)); fflush($fu);
            };
        }
        // Seperti MT5: SL/TP diperiksa terhadap harga penutup sekarang (BUY → bid, SELL → ask) di seri
        // posisi bila ada, bukan harga masuk.
        $q = qi_komp_kutipan_posisi(qi_komp_kutipan([$baris['symbol']], 5)[$baris['symbol']] ?? null, $baris);
        $patokan = qi_komp_harga_tanda($baris['direction'], $q) ?? (float)$baris['entry_price'];
        if ($alasan = qi_paper_cek_sltp($baris['direction'], $patokan, $sl, $tp)) $tolak($alasan, 422, 'sltp');
        // Level LAMA dinilai dulu terhadap bar M1 SEGAR (tanpa cache 20 dtk) sampai sekarang, termasuk bar
        // yang sedang berjalan. Bila sudah tersentuh, posisi ditutup di level lama — mengirim sl:null tepat
        // setelah sumbu tidak lagi menyelamatkan posisi yang SL-nya sudah kena.
        try { qi_paper_settle($pdo, $uid, ['id' => (int)$baris['id'], 'segar' => true]); }
        catch (Throwable $e) { error_log('[QI PaperTrading] settle ubah: ' . $e->getMessage()); $tolak('SL/TP belum bisa diperiksa server. Coba lagi sebentar.', 503); }
        $sesudah = $ambilBaris('POS-' . $baris['id']);
        if (!$sesudah || $sesudah['status'] !== 'open') $tolak($sudahDitutup($sesudah ?? $baris), 409);
        // Bar yang sedang berjalan sudah dinilai dengan level lama: level baru berlaku mulai bar berikutnya
        // (kutipan saat ini tetap diperiksa tiap penyelesaian).
        $pdo->prepare('UPDATE paper_positions SET stop_loss = :sl, take_profit = :tp, sltp_checked_at = FROM_UNIXTIME(:cek)
                       WHERE id = :id AND user_id = :uid AND status = \'open\'')
            ->execute([':sl' => $sl, ':tp' => $tp, ':cek' => (int)(ceil(time() / 60) * 60), ':id' => (int)$baris['id'], ':uid' => $uid]);
        if ($catatUbah) $catatUbah();
        $balas(200, ['status' => 'success', 'posisi' => qi_paper_baris_ke_obj($ambilBaris('POS-' . $baris['id'])), 'berubah' => true]);
    }

    $tolak('Aksi tidak dikenal.', 400);
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Metode tidak didukung.']);
