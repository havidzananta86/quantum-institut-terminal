<?php
/**
 * Order paper trading yang HARGANYA DITENTUKAN SERVER.
 *
 * Sebelumnya api/paper-trading.php menerima harga buka/tutup dari klien asal selisihnya
 * ≤ 1% dari harga acuan. Untuk XAUUSD itu ±$41 per unit — cukup untuk memilih harga yang
 * menguntungkan sendiri, dan papan peringkat kompetisi dihitung dari angka itu. Sekarang:
 *
 *   · harga eksekusi = harga pasar di cache server (api/live-price.php menulisnya; TTL 1 detik,
 *     jadi klien yang memanggil live-price tepat sebelum order mendapat acuan yang segar);
 *   · BUY dibuka di ASK dan ditutup di BID, SELL sebaliknya — bila feed punya bid/ask;
 *   · harga kiriman klien hanya dipakai sebagai batas requote: bila layar pengguna sudah
 *     tertinggal jauh dari pasar, order DITOLAK, bukan dieksekusi di harga yang mengejutkan;
 *   · order ditolak bila acuan basi, pasar sedang tutup, atau acuannya hanya kurs referensi
 *     harian (Frankfurter/ECB) — kurs harian bukan harga yang bisa ditransaksikan.
 *
 * Fungsi di sini murni (kecuali qi_paper_harga_acuan yang membaca cache) supaya bisa diuji
 * tanpa database: tests/paper-order.test.js.
 *
 * CATATAN 2026-10-22 (kompetisi): acuan untuk ORDER kini datang dari feed kanonik
 * api/_kompetisi_harga.php (qi_komp_acuan — satu tingkat sumber untuk semua orang, diambil ulang
 * bila > 3 dtk). qi_paper_harga_acuan() di bawah tidak lagi dipakai untuk mengisi order karena
 * mencampur berkas cache tingkat 'mt5' dan 'std' (harga isi berganti-ganti antar feed).
 */

if (!defined('QI_PAPER_UMUR_ACUAN_MAKS')) {
    /**
     * Umur maksimum harga acuan untuk eksekusi (detik). Dulu 30: dengan sedikit pengguna yang memuat
     * harga, order bisa diisi di harga setengah menit lalu (arbitrase latensi — audit kompetisi
     * 2026-10-22). Acuan kanonik kini diambil ulang di server bila > 3 dtk (api/_kompetisi_harga.php),
     * jadi 10 dtk hanya tercapai saat hulu gagal — dan saat itu order lebih baik ditolak.
     */
    define('QI_PAPER_UMUR_ACUAN_MAKS', 10);
    /** Umur maksimum tick feed (detik) — cache segar pun bisa membawa tick lama saat feed macet. */
    define('QI_PAPER_UMUR_TICK_MAKS', 120);
    /** Batas requote: selisih harga layar pengguna vs harga eksekusi (fraksi, 0.005 = 0,5%). */
    define('QI_PAPER_TOLERANSI_REQUOTE', 0.005);
    /** Batas posisi terbuka manual per pengguna. */
    define('QI_PAPER_POSISI_MAKS', 50);
}
if (!defined('QI_PAPER_SIMBOL')) {
    /**
     * Simbol paper trading (dulu literal $ALLOWED_SYMBOLS di api/paper-trading.php). Dipindah ke sini
     * supaya api/competition.php?harga= melayani SEMUA simbol yang bisa dibuka sebagai posisi turnamen
     * (audit G1: posisi BNBUSDT/AUDUSD/USOIL… dari Quick Trade masuk papan, tetapi arena tidak bisa
     * menandai atau menutupnya karena ?harga hanya menerima 10 simbol arena).
     * AUDUSD/NZDUSD/USDCHF/USDCAD: model P/L-nya ada di _paper_math.php. Silang JPY (GBPJPY, EURJPY)
     * sengaja TIDAK: P/L-nya butuh kurs USDJPY saat tutup yang belum dimodelkan.
     */
    define('QI_PAPER_SIMBOL', ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'XRPUSDT', 'DOGEUSDT',
                               'AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD',
                               'XAGUSD', 'USOIL', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225']);
}

if (!function_exists('qi_paper_harga_acuan')) {
    /**
     * Harga acuan terbaru untuk $sym dari cache api/live-price.php, atau null.
     * @return array{price:float,bid:?float,ask:?float,source:string,market:?string,tick_age:?int,umur:int}|null
     */
    function qi_paper_harga_acuan(string $sym, ?string $dirCache = null): ?array
    {
        $dirCache = $dirCache ?? __DIR__ . '/../cache/live-price';
        $berkas = (array)@glob($dirCache . '/*.json');
        $mtime = [];
        foreach ($berkas as $f) $mtime[$f] = (int)@filemtime($f);
        arsort($mtime);
        foreach (array_slice(array_keys($mtime), 0, 80) as $f) {
            $umur = time() - $mtime[$f];
            if ($umur > 900) break;
            $j = json_decode((string)@file_get_contents($f), true);
            $p = is_array($j) ? ($j['prices'][$sym] ?? null) : null;
            if (!is_array($p) || !(($p['price'] ?? 0) > 0)) continue;
            $bid = isset($p['bid']) && is_numeric($p['bid']) && $p['bid'] > 0 ? (float)$p['bid'] : null;
            $ask = isset($p['ask']) && is_numeric($p['ask']) && $p['ask'] > 0 ? (float)$p['ask'] : null;
            return [
                'price'    => (float)$p['price'],
                'bid'      => $bid,
                'ask'      => $ask,
                'source'   => (string)($p['source'] ?? ''),
                'market'   => isset($p['market']) ? (string)$p['market'] : null,
                'tick_age' => isset($p['tick_age']) && is_numeric($p['tick_age']) ? (int)$p['tick_age'] : null,
                'umur'     => $umur,
            ];
        }
        return null;
    }
}

if (!function_exists('qi_paper_harga_eksekusi')) {
    /**
     * Harga eksekusi untuk satu sisi transaksi.
     *
     * @param string     $sisi       'beli' (buka BUY / tutup SELL) atau 'jual' (buka SELL / tutup BUY)
     * @param float|null $hargaKlien harga yang dilihat pengguna saat menekan tombol (boleh null)
     * @param array|null $acuan      hasil qi_paper_harga_acuan()
     * @return array{harga:float}|array{tolak:string}
     */
    function qi_paper_harga_eksekusi(string $sym, string $sisi, ?float $hargaKlien, ?array $acuan): array
    {
        // 'kode' = alasan yang bisa dibaca mesin (kontrak api/paper-trading.php: harga_basi | pasar_tutup | requote).
        if ($acuan === null) {
            return ['tolak' => "Harga pasar $sym belum tersedia di server. Tunggu harga live termuat, lalu coba lagi.", 'kode' => 'harga_basi'];
        }
        if (($acuan['umur'] ?? PHP_INT_MAX) > QI_PAPER_UMUR_ACUAN_MAKS) {
            return ['tolak' => "Harga pasar $sym di server sudah " . (int)$acuan['umur'] . ' detik — terlalu lama untuk eksekusi. Coba lagi.', 'kode' => 'harga_basi'];
        }
        if (stripos((string)($acuan['source'] ?? ''), 'frankfurter') !== false) {
            return ['tolak' => "Harga $sym saat ini hanya kurs referensi harian (ECB), bukan harga live. Order tidak bisa dieksekusi sampai feed live kembali.", 'kode' => 'harga_basi'];
        }
        if (($acuan['market'] ?? null) === 'closed') {
            return ['tolak' => "Pasar $sym sedang tutup. Order dibuka kembali saat pasar buka.", 'kode' => 'pasar_tutup'];
        }
        if (($acuan['tick_age'] ?? null) !== null && $acuan['tick_age'] > QI_PAPER_UMUR_TICK_MAKS) {
            return ['tolak' => "Feed harga $sym sedang macet (tick terakhir " . (int)$acuan['tick_age'] . ' detik lalu). Coba lagi sebentar.', 'kode' => 'harga_basi'];
        }
        $adaBidAsk = ($acuan['bid'] ?? null) !== null && ($acuan['ask'] ?? null) !== null && $acuan['ask'] >= $acuan['bid'];
        $harga = $adaBidAsk ? ($sisi === 'beli' ? $acuan['ask'] : $acuan['bid']) : (float)$acuan['price'];
        if (!($harga > 0)) return ['tolak' => "Harga pasar $sym tidak sah.", 'kode' => 'harga_basi'];
        if ($hargaKlien !== null && $hargaKlien > 0 && abs($hargaKlien - $harga) / $harga > QI_PAPER_TOLERANSI_REQUOTE) {
            return ['tolak' => "Harga bergerak: layar Anda $hargaKlien, pasar $harga. Order tidak dieksekusi (requote) — periksa harga lalu coba lagi.", 'kode' => 'requote'];
        }
        return ['harga' => (float)$harga];
    }
}

if (!function_exists('qi_paper_cek_sltp')) {
    /** Alasan penolakan bila SL/TP berada di sisi yang salah dari $harga, atau null bila sah. */
    function qi_paper_cek_sltp(string $arah, float $harga, ?float $sl, ?float $tp): ?string
    {
        $beli = $arah === 'BUY';
        if ($sl !== null && ($beli ? $sl >= $harga : $sl <= $harga)) {
            return $beli ? "Untuk BUY, stop loss harus di BAWAH harga ($harga)." : "Untuk SELL, stop loss harus di ATAS harga ($harga).";
        }
        if ($tp !== null && ($beli ? $tp <= $harga : $tp >= $harga)) {
            return $beli ? "Untuk BUY, take profit harus di ATAS harga ($harga)." : "Untuk SELL, take profit harus di BAWAH harga ($harga).";
        }
        return null;
    }
}

if (!function_exists('qi_paper_baris_ke_obj')) {
    /** Baris paper_positions (+opened_ts/closed_ts) → objek JSON yang sama dengan GET. */
    function qi_paper_baris_ke_obj(array $r): array
    {
        $iso = static fn($ts) => $ts ? gmdate('Y-m-d\\TH:i:s\\Z', (int)$ts) : null;
        $obj = [
            'id'         => 'POS-' . $r['id'],
            'symbol'     => $r['symbol'],
            'side'       => $r['direction'],
            'lots'       => (float)$r['lots'],
            'entryPrice' => (float)$r['entry_price'],
            'sl'         => $r['stop_loss']   !== null ? (float)$r['stop_loss']   : null,
            'tp'         => $r['take_profit'] !== null ? (float)$r['take_profit'] : null,
            'openedAt'   => $iso($r['opened_ts'] ?? null),
            'src'        => $r['source'] ?? 'manual',
        ];
        // Kolom migrasi 027 (api/_kompetisi_skema.php): periode turnamen & asal order bila ada.
        if (!empty($r['komp_periode'])) $obj['kompPeriode'] = (string)$r['komp_periode'];
        if (!empty($r['asal'])) $obj['asal'] = (string)$r['asal'];
        // Seri harga tempat posisi diisi (XAUUSD: emas nyata vs PROKSI PAXG + G) — arena menandai
        // posisi di seri yang sama dengan server (qi_komp_kutipan_posisi).
        if (!empty($r['harga_sumber'])) $obj['hargaSumber'] = (string)$r['harga_sumber'];
        if (isset($r['harga_geser']) && $r['harga_geser'] !== null) $obj['hargaGeser'] = (float)$r['harga_geser'];
        if (($r['status'] ?? '') === 'closed') {
            $obj['closePrice']  = (float)$r['close_price'];
            $obj['realizedPnL'] = (float)$r['pnl_usd'];
            $obj['closedAt']    = $iso($r['closed_ts'] ?? null);
            // Siapa yang menutup: 'manual' | 'sl' | 'tp' | 'stopout' | 'period_end' (null = data lama).
            $obj['closeReason'] = isset($r['close_reason']) && $r['close_reason'] !== '' ? (string)$r['close_reason'] : null;
        }
        return $obj;
    }
}
