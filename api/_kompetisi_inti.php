<?php
/**
 * INTI KOMPETISI — aturan main yang dipakai bersama oleh api/paper-trading.php (order),
 * api/competition.php (papan), api/leaderboard.php (alias), dan penyelesaian SL/TP.
 *
 * Fungsi di sini MURNI (tanpa database / jaringan) kecuali yang namanya jelas menyentuh PDO,
 * supaya bisa diuji langsung: tests/kompetisi-papan.test.php.
 *
 * Model akun turnamen (audit kompetisi 2026-10-22, desain §B):
 *   · Satu periode = satu minggu WIB (Senin 00:00 – Senin berikutnya 00:00). Setiap order manual
 *     peserta diberi `komp_periode` = kunci periode SAAT DIBUKA menurut jam server, sehingga P/L
 *     posisi selalu milik periode tempat ia dibuka (dulu: periode tempat ia DITUTUP — posisi minggu
 *     lalu yang ditutup Senin 00:05 membukukan seluruh untungnya ke minggu baru).
 *   · Ekuitas = 10.000 + terealisasi(periode) + mengambang(posisi terbuka periode). Mengambang
 *     ditandai di sisi PENUTUP (BUY di bid, SELL di ask). Tanpa harga, tidak ditebak.
 *   · Leverage 1:100. Margin posisi = lot × pengali kontrak × harga ÷ 100 (pengali dari
 *     api/_paper_math.php, model P/L yang sama). Order ditolak bila margin bebas tidak cukup;
 *     level margin < 50% → stop-out (posisi paling rugi ditutup server).
 */

require_once __DIR__ . '/_paper_math.php';

if (!defined('QI_KOMP_SALDO_AWAL')) {
    /** Modal simulasi tiap periode — sama dengan $STARTING_BALANCE di api/paper-trading.php. */
    define('QI_KOMP_SALDO_AWAL', 10000.0);
    /** Leverage akun turnamen (1:100). */
    define('QI_KOMP_LEVERAGE', 100);
    /** Level margin (ekuitas ÷ margin terpakai) di bawah ini → stop-out. 0,5 = 50%. */
    define('QI_KOMP_STOPOUT', 0.5);
    /**
     * Jeda minimum antar order BUKA per pengguna (detik). 2 dtk sesuai desain audit §B1 ("tolak bila
     * order terakhir < 2 dtk lalu"); dulu 1 dtk. Irama order per peserta terlihat admin di ?kandidat=1.
     */
    define('QI_KOMP_JEDA_ORDER', 2.0);
    /** Jeda minimum antar 'ubah' SL/TP untuk posisi yang SAMA (detik) — lihat api/paper-trading.php. */
    define('QI_KOMP_JEDA_UBAH', 5.0);
    /** Turnamen utama yang diikuti otomatis oleh PRO/VIP saat membuka order. */
    define('QI_KOMP_TURNAMEN', 'weekly-championship');
    /** Umur maksimum harga untuk MENANDAI posisi (mengambang di papan). Lebih tua → "harga basi". */
    define('QI_KOMP_UMUR_TANDA_MAKS', 120);
}
if (!defined('QI_KOMP_ORDER_HARIAN_MAKS')) {
    /**
     * Order BUKA manual per pengguna per 24 jam bergulir. Dulu satu-satunya batas adalah 60 permintaan/
     * menit per IP, jadi skrip pemegang token bisa membuka ribuan order "manual" sehari (audit kompetisi
     * 2026-10-22, desain §B). 200 jauh di atas kebutuhan trader manual.
     */
    define('QI_KOMP_ORDER_HARIAN_MAKS', 200);
}

if (!function_exists('qi_komp_zona')) {
    function qi_komp_zona(): DateTimeZone
    {
        return new DateTimeZone(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Asia/Jakarta');
    }
}

if (!function_exists('qi_comp_periode')) {
    /**
     * Rentang periode berjalan: [mulai, selesai, kunci]. Dipindah dari api/competition.php supaya
     * paper-trading.php memberi kunci periode yang SAMA persis saat order dibuka.
     */
    function qi_comp_periode(string $jenis, DateTimeZone $zona, ?int $kini = null): array
    {
        $sekarang = (new DateTimeImmutable('@' . ($kini ?? time())))->setTimezone($zona);
        if ($jenis === 'daily') {
            $m = $sekarang->setTime(0, 0);
            return [$m, $m->modify('+1 day'), $m->format('Y-m-d')];
        }
        if ($jenis === 'monthly') {
            $m = $sekarang->modify('first day of this month')->setTime(0, 0);
            return [$m, $m->modify('first day of next month'), $m->format('Y-m')];
        }
        $m = $sekarang->modify('monday this week')->setTime(0, 0);
        return [$m, $m->modify('+7 days'), $m->format('o-\WW')];
    }
}

if (!function_exists('qi_komp_periode_kini')) {
    /** Periode turnamen utama (mingguan) saat ini: [mulai, selesai, kunci]. */
    function qi_komp_periode_kini(?int $kini = null): array
    {
        return qi_comp_periode('weekly', qi_komp_zona(), $kini);
    }
}

if (!function_exists('qi_komp_batas_periode')) {
    /** Epoch [mulai, selesai) dari kunci periode mingguan ('2026-W43'), atau null bila formatnya salah. */
    function qi_komp_batas_periode(string $kunci): ?array
    {
        if (!preg_match('/^(\d{4})-W(\d{2})$/', $kunci, $m)) return null;
        $a = (new DateTimeImmutable('now', qi_komp_zona()))->setISODate((int)$m[1], (int)$m[2])->setTime(0, 0);
        return [$a->getTimestamp(), $a->modify('+7 days')->getTimestamp()];
    }
}

if (!function_exists('qi_comp_samarkan')) {
    /** "Ahmad Wahyu" → "Ahmad W.", "Budi" → "Bud***". */
    function qi_comp_samarkan(string $nama): string
    {
        $bagian = preg_split('/\s+/', trim($nama)) ?: [''];
        if (count($bagian) === 1) return mb_substr($bagian[0], 0, 3) . '***';
        return $bagian[0] . ' ' . mb_strtoupper(mb_substr(end($bagian), 0, 1)) . '.';
    }
}

if (!function_exists('qi_komp_nama_publik')) {
    /** Nama yang boleh dilihat SIAPA PUN: nama tampilan bila ada, selain itu nama asli disamarkan. */
    function qi_komp_nama_publik(?string $namaTampilan, ?string $namaLengkap): string
    {
        $t = trim((string)$namaTampilan);
        return $t !== '' ? $t : qi_comp_samarkan((string)$namaLengkap);
    }
}

if (!function_exists('qi_komp_rahasia')) {
    /**
     * Kunci HMAC untuk kode trader publik. Konstanta QI_KOMP_SECRET (config/api_keys.php) bila ada,
     * selain itu dibuat sekali di cache/kompetisi_secret.json (folder cache/ diblokir .htaccess dan
     * tidak ikut git) — pola yang sama dengan api/_notif.php.
     */
    function qi_komp_rahasia(): string
    {
        static $kunci = null;
        if ($kunci !== null) return $kunci;
        if (defined('QI_KOMP_SECRET') && strlen((string)QI_KOMP_SECRET) >= 16) return $kunci = (string)QI_KOMP_SECRET;
        $berkas = __DIR__ . '/../cache/kompetisi_secret.json';
        if (!is_file($berkas)) {
            $fp = @fopen($berkas, 'x');
            if ($fp) { fwrite($fp, json_encode(['key' => bin2hex(random_bytes(32)), 'dibuat' => date('c')])); fclose($fp); @chmod($berkas, 0600); }
        }
        $j = json_decode((string)@file_get_contents($berkas), true);
        $k = is_array($j) ? (string)($j['key'] ?? '') : '';
        // Tanpa berkas yang bisa ditulis: kunci per proses (kode berubah tiap permintaan, tapi tidak
        // pernah membocorkan id pengguna).
        return $kunci = (strlen($k) >= 32 ? $k : bin2hex(random_bytes(32)));
    }
}

if (!function_exists('qi_komp_kode')) {
    /** Kode trader publik (12 heksa) — dipakai laci trader; id pengguna tidak pernah dikirim ke peramban. */
    function qi_komp_kode(int $uid): string
    {
        return substr(hash_hmac('sha256', 'trader:' . $uid, qi_komp_rahasia()), 0, 12);
    }
}

if (!function_exists('qi_komp_margin')) {
    /** Margin satu posisi (USD) pada leverage turnamen. */
    function qi_komp_margin(string $sym, float $lots, float $harga, int $leverage = QI_KOMP_LEVERAGE): float
    {
        if ($lots <= 0 || $harga <= 0 || $leverage <= 0) return 0.0;
        return round($lots * qi_paper_pip_mult($sym, $harga) * $harga / $leverage, 2);
    }
}

if (!function_exists('qi_komp_harga_tanda')) {
    /**
     * Harga untuk menandai posisi terbuka: sisi PENUTUP (BUY → bid, SELL → ask); tanpa bid/ask → price.
     * null bila kutipan tidak ada, atau basi (> $umurMaks detik) sementara pasar tidak tutup.
     * Pasar tutup: harga terakhir ADALAH harga yang berlaku (seperti MT5 di akhir pekan) — dipakai.
     */
    function qi_komp_harga_tanda(string $arah, ?array $q, int $umurMaks = QI_KOMP_UMUR_TANDA_MAKS): ?float
    {
        if (!$q) return null;
        $tutup = ($q['market'] ?? null) === 'closed';
        if (!$tutup && (int)($q['umur'] ?? PHP_INT_MAX) > $umurMaks) return null;
        $adaBidAsk = ($q['bid'] ?? null) > 0 && ($q['ask'] ?? null) > 0 && $q['ask'] >= $q['bid'];
        $h = $adaBidAsk ? ($arah === 'BUY' ? (float)$q['bid'] : (float)$q['ask']) : (float)($q['price'] ?? 0);
        return $h > 0 ? $h : null;
    }
}

if (!function_exists('qi_komp_hitung_akun')) {
    /**
     * Akun turnamen satu pengguna.
     * @param float $realisasi  Σ P/L posisi tertutup periode ini
     * @param array $kaki       posisi terbuka periode ini: [{symbol, side, lots, entry, mark:?float}]
     *                          mark = harga penanda (lihat qi_komp_harga_tanda), null = tidak diketahui
     * @return array{realisasi:float,mengambang:float,ekuitas:float,saldo:float,margin_terpakai:float,
     *               margin_bebas:float,level_margin:?float,tanpa_harga:int}
     */
    function qi_komp_hitung_akun(float $realisasi, array $kaki, int $leverage = QI_KOMP_LEVERAGE): array
    {
        $mengambang = 0.0; $margin = 0.0; $tanpa = 0;
        foreach ($kaki as $k) {
            // Margin dihitung dari harga MASUK: tetap, tidak bergantung pada ada-tidaknya harga live.
            $margin += qi_komp_margin((string)$k['symbol'], (float)$k['lots'], (float)$k['entry'], $leverage);
            if (($k['mark'] ?? null) === null) { $tanpa++; continue; }
            $mengambang += qi_paper_pnl((string)$k['symbol'], (string)$k['side'], (float)$k['entry'], (float)$k['mark'], (float)$k['lots']);
        }
        $saldo = QI_KOMP_SALDO_AWAL + $realisasi;
        $ekuitas = $saldo + $mengambang;
        return [
            'realisasi'       => round($realisasi, 2),
            'mengambang'      => round($mengambang, 2),
            'ekuitas'         => round($ekuitas, 2),
            'saldo'           => round($saldo, 2),
            'margin_terpakai' => round($margin, 2),
            'margin_bebas'    => round($ekuitas - $margin, 2),
            'level_margin'    => $margin > 0 ? round($ekuitas / $margin * 100, 1) : null,
            'tanpa_harga'     => $tanpa,
        ];
    }
}

if (!function_exists('qi_komp_cek_margin')) {
    /**
     * Alasan penolakan order baru karena margin, atau null bila cukup.
     * @param array $akun hasil qi_komp_hitung_akun()
     */
    function qi_komp_cek_margin(array $akun, string $sym, float $lots, float $harga): ?string
    {
        if (($akun['tanpa_harga'] ?? 0) > 0) {
            return 'Harga untuk sebagian posisi terbuka Anda sedang tidak tersedia, jadi margin bebas tidak bisa dihitung. Coba lagi sebentar.';
        }
        $perlu = qi_komp_margin($sym, $lots, $harga);
        if ($akun['margin_bebas'] < $perlu) {
            return 'Margin tidak cukup: order ' . number_format($lots, 2) . ' lot ' . $sym . ' butuh margin $' . number_format($perlu, 2)
                 . ' (leverage 1:' . QI_KOMP_LEVERAGE . '), margin bebas Anda $' . number_format(max(0, $akun['margin_bebas']), 2) . '. Kurangi lot atau tutup posisi.';
        }
        return null;
    }
}

if (!function_exists('qi_komp_ikut_periode')) {
    /**
     * Apakah order manual ini ikut turnamen? Ya untuk PRO ke atas, KECUALI salinan sekali-klik sinyal
     * AI (asal 'sinyal'): turnamen menilai keputusan trader sendiri — kebijakan yang sama dengan
     * "bot tidak dihitung". Posisi itu tetap tercatat di paper trading, hanya di luar papan.
     */
    function qi_komp_ikut_periode(?string $role, ?string $asal): bool
    {
        return qi_tingkat_peran_aman($role) >= 1 && $asal !== 'sinyal';
    }
}

if (!function_exists('qi_tingkat_peran_aman')) {
    /** qi_tingkat_peran() bila middleware dimuat; salinan kecilnya untuk uji tanpa middleware. */
    function qi_tingkat_peran_aman(?string $role): int
    {
        if (function_exists('qi_tingkat_peran')) return qi_tingkat_peran($role);
        return ['admin' => 3, 'vip' => 2, 'vip_plus' => 2, 'elite' => 2, 'pro' => 1, 'premium' => 1][strtolower(trim((string)$role))] ?? 0;
    }
}

if (!function_exists('qi_komp_peringkat')) {
    /**
     * Urutkan baris papan dan beri peringkat kompetisi standar (1, 1, 3).
     *   · Trader (pernah membuka posisi di periode ini) diurutkan: ekuitas ↓, terealisasi ↓,
     *     aktivitas terakhir ↑ (yang lebih dulu mencapai angkanya di atas). Ekuitas SAMA (sen) =
     *     peringkat sama — dulu urutan "trade lebih banyak di atas" memberi hadiah pada overtrading.
     *   · Peserta terdaftar yang belum trading berada di bawah semua trader, berbagi satu peringkat.
     * @param array $baris [{equity, realized, aktivitas_ts, aktif:bool, …}]
     */
    function qi_komp_peringkat(array $baris): array
    {
        $trader = array_values(array_filter($baris, static fn($b) => !empty($b['aktif'])));
        $diam   = array_values(array_filter($baris, static fn($b) => empty($b['aktif'])));
        usort($trader, static fn($a, $b) => [round($b['equity'], 2), round($b['realized'], 2), (int)$a['aktivitas_ts'], (int)($a['urut'] ?? 0)]
                                        <=> [round($a['equity'], 2), round($a['realized'], 2), (int)$b['aktivitas_ts'], (int)($b['urut'] ?? 0)]);
        usort($diam, static fn($a, $b) => (int)($a['urut'] ?? 0) <=> (int)($b['urut'] ?? 0));
        $rank = 0; $sebelum = null;
        foreach ($trader as $i => &$b) {
            $e = round((float)$b['equity'], 2);
            if ($sebelum === null || $e !== $sebelum) $rank = $i + 1;
            $b['rank'] = $rank;
            $sebelum = $e;
        }
        unset($b);
        $rankDiam = count($trader) + 1;
        foreach ($diam as &$b) $b['rank'] = $rankDiam;
        unset($b);
        return array_merge($trader, $diam);
    }
}
