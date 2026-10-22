<?php
/**
 * FEED HARGA KANONIK KOMPETISI — satu tingkat sumber untuk SEMUA orang: harga isi order, harga
 * penanda papan, penyelesaian SL/TP, dan harga yang tampil di tombol BUY/SELL arena.
 *
 * MASALAH YANG DIPERBAIKI (audit kompetisi 2026-10-22):
 *   qi_paper_harga_acuan() mengambil berkas cache api/live-price.php TERBARU dari tingkat mana pun.
 *   live-price menyimpan tingkat 'mt5' (pengguna yang berhak feed broker) dan 'std' (lainnya) di
 *   berkas terpisah, jadi harga isi order berganti-ganti antara broker MT5 dan OANDA tergantung
 *   siapa yang terakhir memuat harga — dua peserta bisa diisi di feed berbeda pada detik yang sama.
 *   Acuan sampai 30 detik juga diterima, membuka arbitrase latensi saat sedikit orang memuat harga.
 *
 * SEKARANG:
 *   · Tingkat dipilih SEKALI untuk server: 'mt5' hanya bila bridge MT5 terkonfigurasi DAN
 *     QI_MT5_BRIDGE_AUDIENCE === 'pro' (semua peserta PRO/VIP memang berhak); selain itu 'std'.
 *   · Rantai 'std' tetap & deterministik: OANDA (tv-bridge) → Binance (kripto, bid/ask asli dari
 *     ticker) → PAXG Binance sebagai PROKSI emas (PAXG + selisih G milik kompetisi sendiri, label
 *     'binance_paxg_selaras' / 'binance_paxg') → Twelve Data (forex).
 *     Kurs harian Frankfurter TIDAK pernah dipakai (bukan harga yang bisa ditransaksikan).
 *   · XAUUSD punya DUA seri harga yang levelnya berbeda (emas nyata vs PAXG): tiap posisi mencatat
 *     seri tempat ia diisi (paper_positions.harga_sumber / harga_geser) dan HANYA dinilai, ditutup,
 *     dan diperiksa SL/TP-nya di seri itu (qi_komp_kutipan_posisi). Dulu harga kanonik melompat ±$7
 *     saat jangkar live-price kedaluwarsa (900 dtk) atau di-rebase oleh endpoint PUBLIK
 *     api/live-price.php, dan posisi yang dibuka di satu level ditutup di level lain — untung tanpa
 *     gerak pasar (audit G1). PROKSI juga dianggap pasar TUTUP di luar jam emas (qi_komp_emas_buka).
 *   · Kutipan lebih tua dari ±3 detik diambil ulang di server (satu pengambil sekaligus, flock),
 *     disimpan di cache/kompetisi/kutipan-{tingkat}.json, dan dibagikan ke arena lewat
 *     api/competition.php?harga=… — jadi angka di tombol BUY/SELL = angka yang akan mengisi order.
 *   · Simbol yang tidak bisa diambil TIDAK diisi tebakan: kutipannya tetap yang lama (umurnya
 *     bertambah, pemanggil menolak/menandai basi) atau tidak ada sama sekali.
 */

require_once __DIR__ . '/_kompetisi_skema.php';

if (!defined('QI_KOMP_UMUR_SEGAR')) {
    /** Kutipan lebih tua dari ini (detik) diambil ulang sebelum dipakai mengisi order. */
    define('QI_KOMP_UMUR_SEGAR', 3);
    /** Simbol arena (subset simbol paper trading). */
    define('QI_KOMP_SIMBOL', ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAGUSD', 'US30', 'NAS100']);
}

if (!function_exists('qi_komp_tingkat')) {
    function qi_komp_tingkat(): string
    {
        if (!function_exists('qi_mt5_configured')) return 'std';
        return (qi_mt5_configured() && defined('QI_MT5_BRIDGE_AUDIENCE') && QI_MT5_BRIDGE_AUDIENCE === 'pro') ? 'mt5' : 'std';
    }
}

if (!function_exists('qi_komp_emas_buka')) {
    /**
     * Apakah pasar emas (jam New York) buka pada epoch $ts? Tutup Jumat 17:00 – Minggu 18:00 NY dan
     * jeda harian 17:00–18:00 NY (Senin–Kamis). Token PAXG diperdagangkan 24/7, emas tidak: tanpa
     * penjaga ini XAUUSD PROKSI bisa diisi di harga akhir pekan sementara emas tutup (audit G1).
     */
    function qi_komp_emas_buka(int $ts): bool
    {
        $ny = (new DateTimeImmutable('@' . $ts))->setTimezone(new DateTimeZone('America/New_York'));
        $hari = (int)$ny->format('N');   // 1 = Senin … 7 = Minggu
        $jam = (int)$ny->format('G');
        if ($hari === 6) return false;
        if ($hari === 5) return $jam < 17;
        if ($hari === 7) return $jam >= 18;
        return $jam !== 17;
    }
}

if (!function_exists('qi_komp_emas_tutup_sebelum')) {
    /** Epoch saat pasar emas terakhir TUTUP pada/sebelum $ts (= $ts bila sedang buka). Batas bar proksi. */
    function qi_komp_emas_tutup_sebelum(int $ts): int
    {
        if (qi_komp_emas_buka($ts)) return $ts;
        $t = $ts - ($ts % 60);
        for ($i = 0; $i < 4 * 1440; $i++) {
            $t -= 60;
            if (qi_komp_emas_buka($t)) return $t + 60;   // awal menit tutup pertama
        }
        return $ts;
    }
}

if (!function_exists('qi_komp_geser_xau')) {
    /**
     * G = selisih level emas − PAXG milik FEED KOMPETISI (cache/kompetisi/xau-geser.json).
     *
     * MENGAPA BUKAN JANGKAR live-price LANGSUNG (audit G1): jangkar itu kedaluwarsa setelah 900 dtk
     * (harga lalu jatuh ke PAXG mentah, −$7,5 tanpa gerak pasar) dan di-rebase oleh endpoint PUBLIK
     * api/live-price.php — waktunya bisa ditebak dan dipicu siapa saja. G di sini:
     *   · diukur langsung bila emas nyata (bridge) & PAXG diambil di permintaan yang sama, atau
     *     diambil dari jangkar live-price selagi segar;
     *   · TIDAK pernah kedaluwarsa (umurnya ikut dilaporkan) — level tidak berganti diam-diam;
     *   · yang terpenting: setiap posisi PROKSI menyimpan G saat ia diisi (harga_geser) dan dinilai di
     *     PAXG + G miliknya sendiri, jadi perubahan G tidak pernah mengubah P/L posisi yang sudah ada.
     * @param ?float $ukur G yang baru terukur; null = baca (dan segarkan dari jangkar bila ada)
     * @return array{geser:float,ts:int,asal:string}|null
     */
    function qi_komp_geser_xau(?float $ukur = null, string $asal = '', ?string $berkas = null, ?string $berkasJangkar = null, ?int $kini = null): ?array
    {
        $kini = $kini ?? time();
        $berkas = $berkas ?? (qi_komp_dir() . '/xau-geser.json');
        $simpan = static function (array $g) use ($berkas): array { @file_put_contents($berkas, json_encode($g), LOCK_EX); return $g; };
        if ($ukur !== null && is_finite($ukur)) return $simpan(['geser' => round($ukur, 3), 'ts' => $kini, 'asal' => $asal]);
        $lama = json_decode((string)@file_get_contents($berkas), true);
        $lama = is_array($lama) && isset($lama['geser']) && is_numeric($lama['geser']) ? $lama : null;
        $j = json_decode((string)@file_get_contents($berkasJangkar ?? (__DIR__ . '/../cache/xau_anchor.json')), true);
        if (is_array($j) && (float)($j['xau'] ?? 0) > 100 && (float)($j['paxg'] ?? 0) > 100) {
            $tsJ = (int)($j['ts'] ?? 0);
            $g = (float)$j['xau'] - (float)$j['paxg'];
            // Hanya jangkar segar, masuk akal (|G| < 2%), dan lebih baru dari G yang tersimpan.
            if ($kini - $tsJ <= 900 && abs($g) / (float)$j['xau'] < 0.02 && (!$lama || $tsJ > (int)$lama['ts'])) {
                return $simpan(['geser' => round($g, 3), 'ts' => $tsJ, 'asal' => 'jangkar:' . (string)($j['sumber'] ?? '')]);
            }
        }
        return $lama ? ['geser' => (float)$lama['geser'], 'ts' => (int)$lama['ts'], 'asal' => (string)($lama['asal'] ?? '')] : null;
    }
}

if (!function_exists('qi_komp_xau_dari_paxg')) {
    /**
     * Kutipan XAUUSD PROKSI dari baris PAXG mentah: harga = PAXG + G (G dari qi_komp_geser_xau), atau
     * PAXG mentah bila G belum pernah diketahui. Bid/ask digeser G yang sama (spread PAXG nyata, tidak
     * dikarang). Lapisan 'proksi' (PAXG mentah) selalu ikut — posisi proksi dinilai darinya + G-nya
     * sendiri. Murni.
     */
    function qi_komp_xau_dari_paxg(array $paxg, ?array $g): array
    {
        $hasil = $paxg;
        $geser = $g !== null ? (float)$g['geser'] : 0.0;
        if ($g !== null) foreach (['price', 'bid', 'ask'] as $k) if ($paxg[$k] !== null) $hasil[$k] = round((float)$paxg[$k] + $geser, 3);
        $hasil['source'] = $g !== null ? 'binance_paxg_selaras' : 'binance_paxg';
        $hasil['geser'] = $geser;
        if ($g !== null) { $hasil['geser_ts'] = (int)$g['ts']; $hasil['geser_asal'] = (string)$g['asal']; }
        $hasil['proksi'] = qi_komp_lapisan_proksi($paxg);
        return $hasil;
    }
}

if (!function_exists('qi_komp_lapisan_proksi')) {
    /** Lapisan PAXG mentah yang dibawa kutipan XAUUSD: {price,bid,ask,ts,market}. */
    function qi_komp_lapisan_proksi(array $paxg): array
    {
        return ['price' => (float)$paxg['price'], 'bid' => $paxg['bid'] ?? null, 'ask' => $paxg['ask'] ?? null,
                'ts' => (int)($paxg['ts'] ?? time()), 'market' => null];
    }
}

if (!function_exists('qi_komp_keluarga_level')) {
    /**
     * Keluarga LEVEL harga sebuah sumber kutipan. Hanya XAUUSD yang punya dua level berbeda: emas nyata
     * ('emas': MT5/OANDA) dan PROKSI PAXG ('proksi'). Simbol lain: satu keluarga ('sama').
     */
    function qi_komp_keluarga_level(string $sym, ?string $sumber): ?string
    {
        if (strtoupper($sym) !== 'XAUUSD') return 'sama';
        return match ((string)$sumber) {
            'mt5_bridge', 'oanda_tv' => 'emas',
            'binance_paxg', 'binance_paxg_selaras' => 'proksi',
            default => null,
        };
    }
}

if (!function_exists('qi_komp_seri_posisi')) {
    /**
     * Seri harga sebuah posisi: [sumber, geser]. Baris tanpa harga_sumber (sebelum perbaikan ini)
     * mengikuti feed saat ini seperti dulu.
     * @return array{0:?string,1:float}
     */
    function qi_komp_seri_posisi(array $r, ?array $q): array
    {
        $s = isset($r['harga_sumber']) && $r['harga_sumber'] !== '' ? (string)$r['harga_sumber'] : null;
        if ($s === null) return [$q['source'] ?? null, (float)($q['geser'] ?? 0)];
        return [$s, (float)($r['harga_geser'] ?? 0)];
    }
}

if (!function_exists('qi_komp_kutipan_posisi')) {
    /**
     * Kutipan kanonik DI SERI POSISI INI, atau null bila seri itu sedang tidak punya harga. Murni.
     *   · Posisi emas nyata + feed sedang PROKSI → null (tidak pernah ditandai/ditutup di level PAXG).
     *   · Posisi PROKSI → lapisan PAXG mentah + G milik posisi (bukan G hari ini), dari feed mana pun.
     *   · Simbol lain / baris lama → kutipan apa adanya.
     * @param array $r baris posisi: symbol + harga_sumber/harga_geser (boleh tidak ada)
     */
    function qi_komp_kutipan_posisi(?array $q, array $r): ?array
    {
        if (!$q) return null;
        $sym = (string)($r['symbol'] ?? '');
        if (strtoupper($sym) !== 'XAUUSD' || (string)($r['harga_sumber'] ?? '') === '') return $q;   // baris lama: feed saat ini
        [$sumber, $geser] = qi_komp_seri_posisi($r, $q);
        $famPos = qi_komp_keluarga_level($sym, $sumber);
        $famQ = qi_komp_keluarga_level($sym, $q['source'] ?? null);
        if ($famPos === 'emas') return $famQ === 'emas' ? $q : null;
        if ($famPos !== 'proksi') return $q;
        $p = $q['proksi'] ?? null;
        if (!is_array($p) || !((float)($p['price'] ?? 0) > 0)) return null;
        $g = static fn($v) => $v !== null && (float)$v > 0 ? round((float)$v + $geser, 3) : null;
        $bid = $g($p['bid'] ?? null); $ask = $g($p['ask'] ?? null);
        return [
            'price' => $g($p['price']), 'bid' => $bid, 'ask' => $ask,
            'source' => $geser != 0.0 ? 'binance_paxg_selaras' : 'binance_paxg',
            'market' => $p['market'] ?? null, 'tick_age' => null,
            'umur' => isset($p['umur']) ? (int)$p['umur'] : (int)($q['umur'] ?? PHP_INT_MAX),
            'ts' => (int)($p['ts'] ?? ($q['ts'] ?? 0)), 'geser' => $geser,
            'spread' => $bid !== null && $ask !== null ? round($ask - $bid, 8) : null,
        ];
    }
}

if (!function_exists('qi_komp_xau_beku')) {
    /**
     * Di luar jam emas, harga PROKSI dibekukan di nilai terakhir saat emas masih buka dan ditandai
     * pasar 'closed' (order ditolak, penanda memakai harga penutupan Jumat — seperti MT5). Murni.
     */
    function qi_komp_xau_beku(array $baru, ?array $lama, int $kini): array
    {
        $proksi = ['binance_paxg', 'binance_paxg_selaras'];
        $buka = qi_komp_emas_buka($kini);
        if (!isset($baru['proksi']) && isset($lama['proksi'])) $baru['proksi'] = $lama['proksi'];   // PAXG gagal diambil kali ini
        if (isset($baru['proksi'])) {
            if ($buka) { if ((int)($baru['proksi']['ts'] ?? 0) >= $kini - 15) $baru['proksi']['ts_buka'] = (int)$baru['proksi']['ts']; }
            elseif (isset($lama['proksi']['ts_buka'])) $baru['proksi'] = array_merge($lama['proksi'], ['market' => 'closed']);
            else $baru['proksi']['market'] = 'closed';
        }
        if (in_array($baru['source'] ?? '', $proksi, true)) {
            if ($buka) {
                $baru['ts_buka'] = $kini;
            } elseif (isset($lama['ts_buka']) && in_array($lama['source'] ?? '', $proksi, true)) {
                foreach (['price', 'bid', 'ask', 'source', 'geser', 'geser_ts', 'geser_asal', 'ts_buka', 'chgPct'] as $k) {
                    if (array_key_exists($k, $lama)) $baru[$k] = $lama[$k]; else unset($baru[$k]);
                }
                $baru['market'] = 'closed';
            } else {
                $baru['market'] = 'closed';
            }
        }
        return $baru;
    }
}

if (!function_exists('qi_komp_ambil_segar')) {
    /**
     * Ambil kutipan baru dari hulu (jaringan). Kunci hasil = simbol internal.
     * @return array<string,array{price:float,bid:?float,ask:?float,source:string,market:?string,tick_age:?int,chgPct:float,ts:int}>
     */
    function qi_komp_ambil_segar(array $syms, string $tingkat): array
    {
        $hasil = [];
        $norm = static function (array $r, string $sumber) {
            $bid = isset($r['bid']) && (float)$r['bid'] > 0 ? (float)$r['bid'] : null;
            $ask = isset($r['ask']) && (float)$r['ask'] > 0 ? (float)$r['ask'] : null;
            if ($bid !== null && $ask !== null && $ask < $bid) { $bid = $ask = null; }
            return [
                'price'    => (float)$r['price'],
                'bid'      => $bid,
                'ask'      => $ask,
                'source'   => (string)($r['source'] ?? $sumber),
                'market'   => isset($r['market']) ? (string)$r['market'] : null,
                'tick_age' => isset($r['tick_age']) && is_numeric($r['tick_age']) ? (int)$r['tick_age'] : null,
                'chgPct'   => (float)($r['chgPct'] ?? 0),
                'ts'       => time(),
            ];
        };
        try {
            if ($tingkat === 'mt5' && function_exists('qi_mt5_quotes')) {
                foreach (qi_mt5_quotes($syms) as $s => $r) if ((float)($r['price'] ?? 0) > 0) $hasil[$s] = $norm($r, 'mt5_bridge');
            }
            $sisa = array_values(array_diff($syms, array_keys($hasil)));
            if ($sisa && function_exists('qi_tv_bridge_quotes')) {
                foreach (qi_tv_bridge_quotes($sisa, 6) as $s => $r) if ((float)($r['price'] ?? 0) > 0) $hasil[$s] = $norm($r, 'oanda_tv');
            }
            // Kripto 24/7: bila broker/OANDA tutup (akhir pekan) atau tick-nya basi, harganya membeku —
            // lepaskan supaya diisi Binance (aturan yang sama dengan api/live-price.php).
            foreach ($hasil as $s => $r) {
                if (str_ends_with($s, 'USDT') && (($r['market'] ?? '') === 'closed' || (int)($r['tick_age'] ?? 0) > 900)) unset($hasil[$s]);
            }
            $sisa = array_values(array_diff($syms, array_keys($hasil)));
            $binance = array_values(array_filter($sisa, static fn($s) => str_ends_with($s, 'USDT')));
            // PAXG SELALU ikut bila XAUUSD diminta (juga saat emas nyata tersedia): posisi yang diisi di
            // PROKSI dinilai dari PAXG + G-nya sendiri, dan G diukur dari dua harga yang diambil bersamaan.
            $mintaXau = in_array('XAUUSD', $syms, true);
            if ($mintaXau) $binance[] = 'PAXGUSDT';
            $paxg = null;
            if ($binance && function_exists('qi_http_get')) {
                foreach (['https://data-api.binance.vision', 'https://api.binance.com'] as $host) {
                    $raw = qi_http_get($host . '/api/v3/ticker/24hr?symbols=' . rawurlencode(json_encode($binance)), 5);
                    $d = $raw ? json_decode($raw, true) : null;
                    if (!is_array($d) || !$d) continue;
                    foreach ($d as $it) {
                        $s = (string)($it['symbol'] ?? '');
                        $harga = (float)($it['lastPrice'] ?? 0);
                        if ($s === '' || $harga <= 0) continue;
                        $baris = ['price' => $harga, 'bid' => (float)($it['bidPrice'] ?? 0), 'ask' => (float)($it['askPrice'] ?? 0),
                                  'chgPct' => (float)($it['priceChangePercent'] ?? 0)];
                        // PAXG = emas ter-tokenisasi: PROKSI XAUUSD, diberi label sendiri supaya jujur.
                        if ($s === 'PAXGUSDT') $paxg = $norm($baris + ['source' => 'binance_paxg'], 'binance_paxg');
                        else $hasil[$s] = $norm($baris + ['source' => 'binance'], 'binance');
                    }
                    break;
                }
            }
            if ($mintaXau && $paxg) {
                if (isset($hasil['XAUUSD'])) {
                    $hasil['XAUUSD']['proksi'] = qi_komp_lapisan_proksi($paxg);
                    // Ukur G dari emas nyata & PAXG yang diambil bersamaan — hanya saat emas buka dan tick-nya
                    // segar (akhir pekan harga emas membeku sementara PAXG bergerak).
                    $e = $hasil['XAUUSD'];
                    if (qi_komp_emas_buka(time()) && ($e['market'] ?? null) !== 'closed' && (int)($e['tick_age'] ?? 0) <= 60) {
                        $tengah = static fn(array $r) => ($r['bid'] ?? null) !== null && ($r['ask'] ?? null) !== null ? ($r['bid'] + $r['ask']) / 2 : (float)$r['price'];
                        qi_komp_geser_xau($tengah($e) - $tengah($paxg), (string)$e['source']);
                    }
                } else {
                    $hasil['XAUUSD'] = qi_komp_xau_dari_paxg($paxg, qi_komp_geser_xau());
                }
            }
            $sisa = array_values(array_diff($syms, array_keys($hasil)));
            $peta = ['EURUSD' => 'EUR/USD', 'GBPUSD' => 'GBP/USD', 'USDJPY' => 'USD/JPY', 'AUDUSD' => 'AUD/USD',
                     'NZDUSD' => 'NZD/USD', 'USDCHF' => 'USD/CHF', 'USDCAD' => 'USD/CAD'];
            foreach ($sisa as $s) {
                if (!isset($peta[$s]) || !function_exists('qi_twelvedata_price')) continue;
                $td = qi_twelvedata_price($peta[$s], strtolower($s));
                if (empty($td['price']) || (float)$td['price'] <= 0) continue;
                $baris = $norm($td, 'twelvedata');
                // Dari cache Twelve Data (≤15 dtk): umur sebenarnya tidak diketahui → anggap terlama.
                if (($td['source'] ?? '') === 'twelvedata_cache') $baris['ts'] = time() - 15;
                $hasil[$s] = $baris;
            }
        } catch (Throwable $e) {
            error_log('[kompetisi] ambil kutipan gagal: ' . $e->getMessage());
        }
        return array_intersect_key($hasil, array_flip($syms));
    }
}

if (!function_exists('qi_komp_kutipan')) {
    /**
     * Kutipan kanonik untuk $syms. Yang lebih tua dari $umurSegar diambil ulang (satu proses
     * sekaligus; yang lain menunggu sebentar lalu memakai hasilnya).
     * @param callable|null $pengambil fn(array $syms, string $tingkat): array — untuk uji tanpa jaringan
     * @return array<string,array|null> tiap kutipan membawa 'umur' (detik sejak diambil)
     */
    function qi_komp_kutipan(array $syms, int $umurSegar = QI_KOMP_UMUR_SEGAR, ?callable $pengambil = null, ?string $dir = null): array
    {
        $syms = array_values(array_unique(array_filter(array_map(static fn($s) => strtoupper(trim((string)$s)), $syms),
            static fn($s) => (bool)preg_match('/^[A-Z0-9]{3,12}$/', $s))));
        if (!$syms) return [];
        $tingkat = qi_komp_tingkat();
        $dir = $dir ?? qi_komp_dir();
        $berkas = $dir . '/kutipan-' . $tingkat . '.json';
        $baca = static function () use ($berkas): array {
            $j = json_decode((string)@file_get_contents($berkas), true);
            return is_array($j) ? $j + ['rows' => [], 'coba' => []] : ['rows' => [], 'coba' => []];
        };
        $perluAmbil = static function (array $data) use ($syms, $umurSegar): array {
            $kini = time();
            return array_values(array_filter($syms, static function ($s) use ($data, $kini, $umurSegar) {
                $basi = !isset($data['rows'][$s]['ts']) || ($kini - (int)$data['rows'][$s]['ts']) > $umurSegar;
                $baruDicoba = ($kini - (int)($data['coba'][$s] ?? 0)) < max(1, $umurSegar);
                return $basi && !$baruDicoba;
            }));
        };
        $data = $baca();
        if ($perluAmbil($data)) {
            $kunci = @fopen($berkas . '.lock', 'c');
            if ($kunci && flock($kunci, LOCK_EX | LOCK_NB)) {
                clearstatcache(true, $berkas);
                $data = $baca();
                $perlu = $perluAmbil($data);
                if ($perlu) {
                    foreach ($perlu as $s) $data['coba'][$s] = time();
                    $baru = $pengambil ? (array)$pengambil($perlu, $tingkat) : qi_komp_ambil_segar($perlu, $tingkat);
                    foreach ($baru as $s => $r) {
                        if (!is_array($r) || !((float)($r['price'] ?? 0) > 0)) continue;
                        $s = strtoupper((string)$s);
                        $r['ts'] = (int)($r['ts'] ?? time());
                        if ($s === 'XAUUSD') $r = qi_komp_xau_beku($r, $data['rows'][$s] ?? null, time());
                        $data['rows'][$s] = $r;
                        // Kutipan kanonik TERAKHIR per periode (audit G1): harga penutupan akhir periode untuk
                        // posisi yang feed-nya tidak punya bar M1 (Twelve Data, proksi) — selalu harga yang
                        // benar-benar tercatat sebelum batas, tidak pernah tebakan.
                        $data['akhir'][qi_komp_periode_kini($r['ts'])[2]][$s] = $r;
                    }
                    if (count($data['akhir'] ?? []) > 3) { ksort($data['akhir']); $data['akhir'] = array_slice($data['akhir'], -3, null, true); }
                    $tmp = $berkas . '.' . getmypid() . '.tmp';
                    if (@file_put_contents($tmp, json_encode($data)) !== false && !@rename($tmp, $berkas)) {
                        @file_put_contents($berkas, json_encode($data), LOCK_EX);
                        @unlink($tmp);
                    }
                }
                flock($kunci, LOCK_UN);
                fclose($kunci);
            } else {
                // Proses lain sedang mengambil: tunggu (maks 2,5 dtk) sampai kuncinya lepas.
                if ($kunci) {
                    $batas = microtime(true) + 2.5;
                    while (!flock($kunci, LOCK_SH | LOCK_NB) && microtime(true) < $batas) usleep(100000);
                    @flock($kunci, LOCK_UN);
                    fclose($kunci);
                }
                clearstatcache(true, $berkas);
                $data = $baca();
            }
        }
        $kini = time();
        $hasil = [];
        foreach ($syms as $s) {
            $r = $data['rows'][$s] ?? null;
            if (is_array($r) && (float)($r['price'] ?? 0) > 0) {
                $r['umur'] = max(0, $kini - (int)($r['ts'] ?? 0));
                $r['spread'] = ($r['bid'] ?? null) !== null && ($r['ask'] ?? null) !== null ? round($r['ask'] - $r['bid'], 8) : null;
                if (isset($r['proksi']['ts'])) $r['proksi']['umur'] = max(0, $kini - (int)$r['proksi']['ts']);
                if (isset($r['geser_ts'])) $r['geser_umur'] = max(0, $kini - (int)$r['geser_ts']);
                $hasil[$s] = $r;
            } else {
                $hasil[$s] = null;
            }
        }
        return $hasil;
    }
}

if (!function_exists('qi_komp_acuan_dari')) {
    /** Kutipan → bentuk acuan qi_paper_harga_eksekusi() (+ 'geser' untuk XAUUSD proksi). Murni. */
    function qi_komp_acuan_dari(?array $q): ?array
    {
        if (!$q) return null;
        return [
            'price' => (float)$q['price'], 'bid' => $q['bid'] ?? null, 'ask' => $q['ask'] ?? null,
            'source' => (string)($q['source'] ?? ''), 'market' => $q['market'] ?? null,
            'tick_age' => $q['tick_age'] ?? null, 'umur' => (int)($q['umur'] ?? PHP_INT_MAX),
            'geser' => isset($q['geser']) ? (float)$q['geser'] : null,
        ];
    }
}

if (!function_exists('qi_komp_acuan')) {
    /**
     * Acuan harga eksekusi kanonik untuk qi_paper_harga_eksekusi() (bentuk sama dengan qi_paper_harga_acuan).
     * @param array|null $posisi baris posisi yang akan DITUTUP: acuannya di seri harga posisi itu
     *                           (qi_komp_kutipan_posisi) — null = harga untuk order baru.
     */
    function qi_komp_acuan(string $sym, ?callable $pengambil = null, ?array $posisi = null): ?array
    {
        $q = qi_komp_kutipan([$sym], QI_KOMP_UMUR_SEGAR, $pengambil)[strtoupper($sym)] ?? null;
        if ($posisi !== null) $q = qi_komp_kutipan_posisi($q, $posisi + ['symbol' => $sym]);
        return qi_komp_acuan_dari($q);
    }
}

if (!function_exists('qi_komp_kutipan_akhir')) {
    /**
     * Kutipan kanonik TERAKHIR yang tercatat selama periode $periode (lihat qi_komp_kutipan), atau null.
     * Waktunya selalu sebelum batas akhir periode itu (disimpan menurut periode jam ambilnya).
     */
    function qi_komp_kutipan_akhir(string $periode, string $sym, ?string $dir = null): ?array
    {
        $dir = $dir ?? qi_komp_dir();
        $j = json_decode((string)@file_get_contents($dir . '/kutipan-' . qi_komp_tingkat() . '.json'), true);
        $r = is_array($j) ? ($j['akhir'][$periode][strtoupper($sym)] ?? null) : null;
        return is_array($r) && (float)($r['price'] ?? 0) > 0 ? $r : null;
    }
}

if (!function_exists('qi_komp_keluarga_sumber')) {
    /**
     * Sumber bar M1 yang SAMA dengan sumber kutipan (supaya level SL/TP dinilai di feed yang sama).
     * Proksi selaras memakai bar PAXG MENTAH — pemanggil menambahkan G milik posisi (qi_komp_seri_posisi).
     */
    function qi_komp_keluarga_sumber(?string $sumberKutipan): ?string
    {
        return match ((string)$sumberKutipan) {
            'mt5_bridge'   => 'mt5',
            'oanda_tv'     => 'oanda_tv',
            'binance'      => 'binance',
            'binance_paxg', 'binance_paxg_selaras' => 'binance_paxg',
            default        => null,
        };
    }
}

if (!function_exists('qi_komp_bar_bid')) {
    /**
     * Apakah bar keluarga ini berbasis BID? MT5 rates dan candle OANDA (TradingView) = bid; kline Binance
     * = harga transaksi terakhir (dipakai apa adanya untuk kedua sisi). Untuk seri bid, SL/TP posisi SELL
     * (yang ditutup di ASK) dinilai di bar + spread — audit G1: dulu SELL kena TP saat BID menyentuh TP.
     */
    function qi_komp_bar_bid(?string $keluarga): bool
    {
        return in_array($keluarga, ['mt5', 'oanda_tv'], true);
    }
}

if (!function_exists('qi_komp_klines_binance')) {
    /** Bar M1 Binance (oldest-first). $mulai/$akhir epoch detik; null = tidak dibatasi. */
    function qi_komp_klines_binance(string $simbolBinance, ?int $mulai, ?int $akhir, int $batas = 1000): array
    {
        if (!function_exists('qi_http_get')) return [];
        $q = 'symbol=' . rawurlencode($simbolBinance) . '&interval=1m&limit=' . max(1, min(1000, $batas));
        if ($mulai !== null) $q .= '&startTime=' . ($mulai * 1000);
        if ($akhir !== null) $q .= '&endTime=' . ($akhir * 1000 - 1);
        foreach (['https://data-api.binance.vision', 'https://api.binance.com'] as $host) {
            $raw = qi_http_get($host . '/api/v3/klines?' . $q, 8);
            $d = $raw ? json_decode($raw, true) : null;
            if (!is_array($d)) continue;
            $out = [];
            foreach ($d as $k) {
                if (!is_array($k) || count($k) < 5) continue;
                $out[] = ['time' => (int)($k[0] / 1000), 'open' => (float)$k[1], 'high' => (float)$k[2], 'low' => (float)$k[3], 'close' => (float)$k[4]];
            }
            return $out;
        }
        return [];
    }
}

if (!function_exists('qi_komp_m1')) {
    /**
     * Bar M1 dari sumber yang sama dengan kutipan, mencakup [$dari, sekarang] bila sumbernya mampu.
     * Urutan: cache chart server (api/get-chart-data.php, bila segar & sumbernya sama) → cache
     * kompetisi (20 dtk) → loader yang sama dengan chart (qi_mt5_candles / qi_tv_bridge_candles /
     * klines Binance). [] bila tidak ada — pemanggil lalu memakai kutipan saat ini, tidak menebak.
     *
     * BINANCE (audit G1): dulu klines diminta dengan startTime = $dari dan limit 1000 — Binance lalu
     * mengembalikan 1000 bar SESUDAH startTime. Satu posisi tanpa SL yang terbuka > 16,7 jam menarik $dari
     * mundur, jendelanya berhenti berjam-jam sebelum sekarang, dan SL posisi LAIN di simbol itu tidak
     * pernah dinilai di bar (cache 20 dtk ikut memakai jendela basi itu). Sekarang bar TERBARU selalu
     * diambil (tanpa startTime → berakhir di sekarang), rentang yang lebih tua disusul maju per 1000 bar
     * (maks. 3 halaman), dan cache hanya dipakai ulang bila bar terakhirnya mencapai sekarang.
     * @param bool $segar lewati semua cache (dipakai 'ubah' SL/TP: level lama dinilai di bar terbaru)
     * @param callable|null $klines fn(simbolBinance, ?mulai, ?akhir, batas): bars — untuk uji
     * @return array{keluarga:?string,bars:array}
     */
    function qi_komp_m1(string $sym, int $dari, ?string $sumberKutipan, bool $segar = false, ?callable $klines = null, ?string $dir = null): array
    {
        $kel = qi_komp_keluarga_sumber($sumberKutipan);
        if ($kel === null) return ['keluarga' => null, 'bars' => []];
        $sym = strtoupper($sym);
        $kini = time();
        $binance = in_array($kel, ['binance', 'binance_paxg'], true);
        if ($binance) $dari = max($dari, $kini - 6 * 86400);
        $cakup = static fn(array $bars) => $bars && (int)$bars[0]['time'] <= $dari;
        // Kripto 24/7: seri yang tidak sampai ke menit-menit terakhir BUKAN seri yang mencakup sekarang.
        $kini_ = static fn(array $bars) => $bars && (int)end($bars)['time'] >= $kini - 180;

        if (!$segar && function_exists('qi_chart_cache_file')) {
            $f = qi_chart_cache_file($sym, '1', $kel === 'mt5');
            if (is_file($f) && ($kini - (int)@filemtime($f)) <= 20) {
                $j = json_decode((string)@file_get_contents($f), true);
                $sumberChart = (string)($j['source'] ?? '');
                $c = is_array($j) ? array_values((array)($j['candles'] ?? [])) : [];
                if (is_array($j) && empty($j['simulated']) && $sumberChart === $kel && $c
                    && (!$binance || ($cakup($c) && $kini_($c)))) {
                    return ['keluarga' => $kel, 'bars' => $c];
                }
            }
        }
        $cache = ($dir ?? qi_komp_dir()) . '/m1-' . preg_replace('/[^A-Z0-9]/', '', $sym) . '-' . $kel . '.json';
        if (!$segar) {
            $j = json_decode((string)@file_get_contents($cache), true);
            if (is_array($j) && ($kini - (int)($j['ts'] ?? 0)) <= 20 && !empty($j['bars'])
                && (!$binance || (($cakup($j['bars']) || (int)($j['dari'] ?? PHP_INT_MAX) <= $dari) && $kini_($j['bars'])))) {
                return ['keluarga' => $kel, 'bars' => $j['bars']];
            }
        }
        $bars = [];
        try {
            if ($kel === 'mt5' && function_exists('qi_mt5_candles')) $bars = qi_mt5_candles($sym, '1', 1000);
            elseif ($kel === 'oanda_tv' && function_exists('qi_tv_bridge_candles')) $bars = qi_tv_bridge_candles($sym, '1', 1000, 8);
            elseif ($binance) {
                $ambil = $klines ?? 'qi_komp_klines_binance';
                $simbolB = $kel === 'binance' ? $sym : 'PAXGUSDT';
                // 1) Bar terbaru (tanpa startTime = berakhir di sekarang), secukupnya untuk rentang yang diminta.
                $bars = (array)$ambil($simbolB, null, null, max(5, min(1000, (int)ceil(($kini - $dari) / 60) + 3)));
                // 2) Rentang lebih tua dari itu: susul MAJU dari $dari sampai bar terbaru, maks. 3 halaman.
                if ($bars && (int)$bars[0]['time'] > $dari) {
                    $awalTerbaru = (int)$bars[0]['time'];
                    $lama = [];
                    $mulai = $dari - 60;
                    for ($hal = 0; $hal < 3 && $mulai < $awalTerbaru; $hal++) {
                        $isi = (array)$ambil($simbolB, $mulai, $awalTerbaru, 1000);
                        if (!$isi) break;
                        $lama = array_merge($lama, $isi);
                        $mulai = (int)end($isi)['time'] + 60;
                    }
                    $gabung = [];
                    foreach (array_merge($lama, $bars) as $b) $gabung[(int)$b['time']] = $b;
                    ksort($gabung);
                    $bars = array_values($gabung);
                }
            }
        } catch (Throwable $e) { $bars = []; }
        $bars = array_values(array_map(static fn($c) => ['time' => (int)$c['time'], 'open' => (float)$c['open'], 'high' => (float)$c['high'],
                                                       'low' => (float)$c['low'], 'close' => (float)$c['close']], $bars));
        if ($bars) @file_put_contents($cache, json_encode(['ts' => $kini, 'dari' => $dari, 'bars' => $bars]), LOCK_EX);
        return ['keluarga' => $kel, 'bars' => $bars];
    }
}

if (!function_exists('qi_komp_harga_sebelum')) {
    /**
     * Harga nyata TERAKHIR sebelum epoch $batas (dipakai menutup posisi di akhir periode):
     * close bar M1 terakhir yang dimulai sebelum $batas, dari sumber yang sama dengan kutipan.
     * null bila tidak ada data yang menjangkau saat itu — pemanggil TIDAK menebak.
     * Proksi PAXG ('binance_paxg'): bar terakhir sebelum emas TUTUP (bukan harga PAXG akhir pekan),
     * dikembalikan MENTAH — pemanggil menambahkan G milik posisi.
     * Hasil yang ditemukan disimpan di cache/kompetisi (tidak berubah lagi), jadi penutupan akhir
     * periode tidak memanggil hulu sekali per posisi (audit G1: 50 posisi = 50 panggilan berurutan
     * di dalam kunci papan).
     * @return array{harga:float,ts:int}|null
     */
    function qi_komp_harga_sebelum(string $sym, int $batas, ?string $sumberKutipan, ?callable $klines = null, ?string $dir = null): ?array
    {
        $kel = qi_komp_keluarga_sumber($sumberKutipan);
        if ($kel === null) return null;
        $sym = strtoupper($sym);
        $berkas = ($dir ?? qi_komp_dir()) . '/sebelum-' . preg_replace('/[^A-Z0-9]/', '', $sym) . '-' . $kel . '-' . $batas . '.json';
        $c = json_decode((string)@file_get_contents($berkas), true);
        if (is_array($c) && (float)($c['harga'] ?? 0) > 0 && isset($c['ts'])) return ['harga' => (float)$c['harga'], 'ts' => (int)$c['ts']];
        $bars = [];
        try {
            if ($kel === 'binance' || $kel === 'binance_paxg') {
                $akhir = $kel === 'binance_paxg' ? qi_komp_emas_tutup_sebelum($batas) : $batas;
                $bars = (array)($klines ?? 'qi_komp_klines_binance')($kel === 'binance' ? $sym : 'PAXGUSDT', null, $akhir, 1);
            } else {
                $bars = qi_komp_m1($sym, $batas - 86400, $sumberKutipan)['bars'];
            }
        } catch (Throwable $e) { $bars = []; }
        $pilih = null;
        foreach ($bars as $b) if ((int)$b['time'] < $batas && (float)$b['close'] > 0) $pilih = $b;
        // Semua bar < batas tetapi seri berakhir jauh sebelum sekarang = pasar tutup sebelum batas:
        // close terakhirnya tetap harga terakhir sebelum batas.
        if (!$pilih) return null;
        $hasil = ['harga' => (float)$pilih['close'], 'ts' => (int)$pilih['time'] + 60];
        @file_put_contents($berkas, json_encode($hasil), LOCK_EX);
        return $hasil;
    }
}
