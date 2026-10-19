<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — PAGAR PENCATATAN SINYAL (dipakai bersama oleh AI & TradingView)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mengapa perlu pagar? Endpoint analisa (ai-signal.php) dipanggil SETIAP KALI
 * pengguna PRO membuka panel. Bila setiap jawaban BUY/SELL langsung dicatat,
 * rekor akan dibanjiri sinyal kembar untuk simbol yang sama dan statistiknya
 * menjadi tidak bermakna. Karena itu:
 *
 *   · hanya arah ENTRY_BUY / ENTRY_SELL (SKIP tidak pernah dicatat),
 *   · level wajib konsisten (BUY: tp > entry > sl, SELL: tp < entry < sl),
 *   · TIDAK mencatat bila sudah ada sinyal AKTIF sejenis (simbol + arah + mesin),
 *   · cooldown per simbol+mesin (bawaan 4 jam),
 *   · jeda global per mesin (bawaan 20 menit) agar tidak dibanjiri banyak pengguna,
 *   · TIDAK mencatat saat filter berita High impact aktif,
 *   · penulisan berkas memakai KLAIM ATOMIK (satu proses) + pengambilalihan kunci
 *     yang basi, sehingga dua permintaan bersamaan tidak menghasilkan duplikat.
 *
 * Logika keputusan (qi_signal_cek_pagar) sengaja MURNI — tanpa berkas/ jaringan —
 * sehingga bisa diuji tuntas di tests/signal-record.test.php.
 */

require_once __DIR__ . '/_signal_time.php';   // waktu sinyal: tulis UTC, baca rekor lama dengan benar
require_once __DIR__ . '/_json_kunci.php';    // kunci bersama dengan evaluator & POST admin
require_once __DIR__ . '/_gerbang_risiko.php'; // spread hidup, eksposur korelasi, berita per mata uang

/**
 * Versi ATURAN PENERBITAN. Naikkan setiap kali gerbang/filter penerbitan berubah, supaya
 * statistik sebelum dan sesudah perubahan bisa dipisah (statistik per_versi_aturan).
 *   v1 = sebelum 2026-10-19 · v2 = + gerbang spread hidup, korelasi, berita per mata uang
 */
if (!defined('QI_VERSI_ATURAN_SINYAL')) define('QI_VERSI_ATURAN_SINYAL', 'v2');

if (!function_exists('qi_signal_cek_pagar')) :

/**
 * Keputusan boleh/tidak mencatat sinyal. Murni (tanpa efek samping).
 *
 * @param array  $history          daftar catatan sinyal yang ada
 * @param string $simbol           kode simbol (mis. XAUUSD)
 * @param string $arah             'BUY' atau 'SELL'
 * @param string $engine           label mesin (mis. AI, TRADINGVIEW)
 * @param int    $kini             waktu sekarang (epoch)
 * @param int    $cooldownJam      jeda minimum per simbol+mesin (jam)
 * @param int    $jedaGlobalMenit  jeda minimum antar pencatatan mesin yang sama (menit)
 * @return array{boleh:bool,alasan:string,detail:array}
 */
function qi_signal_cek_pagar(
    array $history,
    string $simbol,
    string $arah,
    string $engine,
    int $kini,
    int $cooldownJam = 4,
    int $jedaGlobalMenit = 20
): array {
    $simbol = strtoupper(trim($simbol));
    $arah   = strtoupper(trim($arah));
    $engine = strtoupper(trim($engine));
    if ($simbol === '' || !in_array($arah, ['BUY', 'SELL'], true)) {
        return ['boleh' => false, 'alasan' => 'simbol_atau_arah_tidak_sah', 'detail' => []];
    }

    $terakhirSimbol = 0;
    $terakhirMesin  = 0;
    foreach ($history as $r) {
        if (!is_array($r)) continue;
        $e = strtoupper(trim((string)($r['engine'] ?? '')));
        if ($e !== $engine) continue;
        $s = strtoupper(trim((string)($r['symbol'] ?? '')));
        $t = qi_sig_epoch($r['timestamp'] ?? null);
        if ($t === null) continue;

        // 1) Sinyal AKTIF sejenis (simbol + arah sama) → jangan gandakan.
        $status = (string)($r['status'] ?? '');
        if ($status === 'AKTIF' && $s === $simbol && strtoupper((string)($r['side'] ?? '')) === $arah) {
            return [
                'boleh'  => false,
                'alasan' => 'sudah_ada_sinyal_aktif_sejenis',
                'detail' => ['id_aktif' => (string)($r['id'] ?? ''), 'sejak' => (string)($r['timestamp'] ?? '')],
            ];
        }
        if ($s === $simbol && $t > $terakhirSimbol) $terakhirSimbol = $t;
        if ($t > $terakhirMesin) $terakhirMesin = $t;
    }

    // 2) Cooldown per simbol+mesin.
    if ($terakhirSimbol > 0 && ($kini - $terakhirSimbol) < $cooldownJam * 3600) {
        return [
            'boleh'  => false,
            'alasan' => 'cooldown_simbol',
            'detail' => [
                'sisa_menit' => (int)ceil(($cooldownJam * 3600 - ($kini - $terakhirSimbol)) / 60),
                'terakhir'   => qi_sig_waktu_utc($terakhirSimbol),
            ],
        ];
    }

    // 3) Jeda global per mesin (melindungi dari banyak pengguna sekaligus).
    if ($terakhirMesin > 0 && ($kini - $terakhirMesin) < $jedaGlobalMenit * 60) {
        return [
            'boleh'  => false,
            'alasan' => 'jeda_global_mesin',
            'detail' => [
                'sisa_menit' => (int)ceil(($jedaGlobalMenit * 60 - ($kini - $terakhirMesin)) / 60),
                'terakhir'   => qi_sig_waktu_utc($terakhirMesin),
            ],
        ];
    }

    return ['boleh' => true, 'alasan' => 'lolos_pagar', 'detail' => []];
}

/**
 * Validasi level sinyal menurut arahnya.
 * BUY  : tp > entry > sl
 * SELL : tp < entry < sl
 */
function qi_signal_level_sah(string $arah, float $entry, float $tp, float $sl): bool
{
    if ($entry <= 0 || $tp <= 0 || $sl <= 0) return false;
    $arah = strtoupper($arah);
    if ($arah === 'BUY')  return ($tp > $entry && $entry > $sl);
    if ($arah === 'SELL') return ($tp < $entry && $entry < $sl);
    return false;
}

/**
 * PRATERBIT — penjaga yang WAJIB dilewati setiap sinyal sebelum ditulis, apa pun mesinnya.
 *
 * MENGAPA ADA: ditemukan 2026-10-13 bahwa api/signal-generator.php (sumber sinyal UTAMA)
 * menulis cache/signal_history.json SECARA LANGSUNG, sehingga melewati saklar jeda,
 * gerbang konfluensi mesin, jurnal database, jejak mesin, dan konteks berita. Akibatnya
 * dua sinyal baru terbit tanpa dinilai gerbang dan tanpa jejak apa pun.
 * Fungsi ini mengumpulkan penjaga tersebut di SATU tempat agar semua penulis rekor
 * memakai aturan yang sama — dan tidak ada lagi jalur yang bisa melewatinya diam-diam.
 *
 * @return array{boleh:bool,alasan:string,rek:array,gerbang:array,catatan:string}
 */
function qi_signal_praterbit(array $rek): array
{
    $out = ['boleh' => true, 'alasan' => '', 'rek' => $rek, 'gerbang' => [], 'catatan' => ''];

    // 1) Saklar jeda darurat
    if (!function_exists('qi_jeda_aktif')) {
        $fj = __DIR__ . '/_jeda.php';
        if (is_file($fj)) require_once $fj;
    }
    if (function_exists('qi_jeda_aktif') && qi_jeda_aktif()) {
        $sj = function_exists('qi_jeda_status') ? qi_jeda_status() : ['sebab' => ''];
        $out['boleh'] = false;
        $out['alasan'] = 'sinyal_dijeda';
        $out['catatan'] = 'Sinyal baru dijeda: ' . (string)($sj['sebab'] ?? '');
        return $out;
    }

    // 2) Gerbang konfluensi mesin (kecuali diminta dilewati oleh uji)
    if (empty($GLOBALS['qi_gerbang_lewati'])) {
        if (!function_exists('qi_gerbang_cek')) {
            $fg = __DIR__ . '/_gerbang.php';
            if (is_file($fg)) require_once $fg;
        }
        if (function_exists('qi_gerbang_cek')) {
            $simbol = strtoupper(trim((string)($rek['symbol'] ?? '')));
            $arah   = strtoupper(trim((string)($rek['side'] ?? '')));
            try {
                $g = qi_gerbang_cek($simbol, $arah);
                $out['gerbang'] = $g;
                if (empty($g['lolos'])) {
                    $out['boleh'] = false;
                    $out['alasan'] = 'gerbang_mesin';
                    $out['catatan'] = (string)($g['catatan'] ?? '');
                    return $out;
                }
                $out['catatan'] = (string)($g['catatan'] ?? '');
            } catch (Throwable $e) {
                @error_log('[gerbang] praterbit gagal menilai: ' . $e->getMessage());
            }
        }
    }

    // 3) Konteks berita (Bagian 4) — diisi bila belum ada
    if (empty($out['rek']['news_context'])) {
        if (!function_exists('qi_fun_konteks')) {
            $ff = __DIR__ . '/_fundamental.php';
            if (is_file($ff)) require_once $ff;
        }
        if (function_exists('qi_fun_konteks')) {
            try { $out['rek']['news_context'] = qi_fun_konteks(30); } catch (Throwable $e) { /* dilewati */ }
        }
    }

    // 4) Catat hasil gerbang ke kolom bukti (basis) supaya dapat diaudit
    if (!empty($out['gerbang']['catatan'])) {
        $bekas = (string)($out['rek']['basis'] ?? '');
        $tambah = 'gerbang mesin: ' . (string)$out['gerbang']['catatan'];
        $out['rek']['basis'] = (mb_strlen($bekas) > 0) ? mb_substr($bekas . ' · ' . $tambah, 0, 255) : mb_substr($tambah, 0, 255);
        $out['rek']['gerbang_mesin'] = $out['gerbang']['ringkas'] ?? null;
    }
    return $out;
}

/**
 * PASCATERBIT — pekerjaan setelah sinyal benar-benar tertulis ke berkas rekor:
 * jurnal database (dual-write) + jejak output mesin. Semua fail-safe.
 */
function qi_signal_pascaterbit(array $rek, array $gerbang = []): array
{
    $hasil = ['jurnal' => false, 'mesin' => 0];
    try {
        if (!function_exists('qi_journal_simpan')) {
            $fj = __DIR__ . '/_journal.php';
            if (is_file($fj)) require_once $fj;
        }
        if (function_exists('qi_journal_simpan')) $hasil['jurnal'] = qi_journal_simpan($rek);
    } catch (Throwable $e) {
        @error_log('[jurnal] pascaterbit gagal: ' . $e->getMessage());
    }
    if (!empty($gerbang['per_mesin']) && !empty($rek['id'])) {
        try {
            if (!function_exists('qi_eng_simpan_output')) require_once __DIR__ . '/_engine_server.php';
            if (function_exists('qi_eng_simpan_output')) {
                $hasil['mesin'] = qi_eng_simpan_output((string)$rek['id'], (array)$gerbang['per_mesin']);
            }
        } catch (Throwable $e) {
            @error_log('[engine] pascaterbit jejak mesin gagal: ' . $e->getMessage());
        }
    }
    return $hasil;
}

/**
 * Tulis catatan sinyal ke rekor dengan pagar lengkap + klaim atomik.
 *
 * Selalu mengembalikan array (tidak pernah melempar/menghentikan skrip) karena
 * dipanggil dari dalam endpoint yang WAJIB tetap memberi jawaban ke pengguna.
 *
 * @param string|null $fileBerkas path berkas rekor; null = rekor asli. Parameter ini
 *                                ada supaya pengujian bisa memakai berkas sementara
 *                                dan TIDAK PERNAH menyentuh rekor produksi.
 * @return array{dicatat:bool,alasan:string,detail:array,id:?string}
 */
function qi_signal_catat(array $rek, int $cooldownJam = 4, int $jedaGlobalMenit = 20, ?string $fileBerkas = null): array
{
    $file = $fileBerkas ?? (__DIR__ . '/../cache/signal_history.json');

    $simbol = strtoupper(trim((string)($rek['symbol'] ?? '')));
    $arah   = strtoupper(trim((string)($rek['side'] ?? '')));
    $engine = strtoupper(trim((string)($rek['engine'] ?? '')));

    // ── SAKLAR JEDA DARURAT (Tahap 4, spesifikasi Bagian 8) ─────────────────────
    // Diperiksa di jalur tulis TUNGGAL ini, sehingga SATU saklar menghentikan seluruh
    // mesin (AUTO_SIGNAL, AI, NEWS, TradingView). Jeda TIDAK menghapus apa pun dan tidak
    // menghentikan penilaian TP/SL — hanya penerbitan sinyal BARU. Diperiksa SEBELUM
    // menyentuh berkas rekor supaya tidak ada penulisan yang sia-sia.
    // Berlaku juga untuk berkas uji: bila jeda aktif, memang tidak ada sinyal baru.
    if (!function_exists('qi_jeda_aktif')) {
        $berkasJeda = __DIR__ . '/_jeda.php';
        if (is_file($berkasJeda)) require_once $berkasJeda;
    }
    if (function_exists('qi_jeda_aktif') && qi_jeda_aktif()) {
        $statusJeda = function_exists('qi_jeda_status') ? qi_jeda_status() : ['sebab' => ''];
        return ['dicatat' => false, 'alasan' => 'sinyal_dijeda',
                'detail' => ['sebab' => (string)($statusJeda['sebab'] ?? ''), 'sejak' => (string)($statusJeda['sejak'] ?? '')],
                'id' => null];
    }

    // Validasi level lebih dulu — tidak perlu menyentuh berkas bila tidak sah.
    if (!qi_signal_level_sah($arah, (float)($rek['entry'] ?? 0), (float)($rek['tp'] ?? 0), (float)($rek['sl'] ?? 0))) {
        return ['dicatat' => false, 'alasan' => 'level_tidak_konsisten', 'detail' => [], 'id' => null];
    }

    // ── GERBANG SPREAD HIDUP (api/_gerbang_risiko.php) ──────────────────────────
    // Spread broker jauh di atas tipikal → tahan. Feed tidak tersedia → fail-open, dicatat.
    // Uji dapat mematikannya lewat $GLOBALS['qi_spread_lewati'] = true.
    $rek['versi_aturan'] = QI_VERSI_ATURAN_SINYAL;
    if (empty($GLOBALS['qi_spread_lewati'])) {
        $spreadHidup = qi_gr_spread_hidup($simbol);
        $gs = qi_gr_cek_spread($simbol, $spreadHidup, (float)($rek['entry'] ?? 0));
        if (!$gs['lolos']) {
            return ['dicatat' => false, 'alasan' => 'spread_melebar', 'detail' => $gs, 'id' => null];
        }
        if ($gs['dinilai']) {
            $rek['spread_saat_terbit'] = $gs['sekarang'];
            // Biaya penilaian memakai yang LEBIH BESAR: spread nyata saat terbit atau tipikal.
            if ($gs['sekarang'] > $gs['tipikal']) {
                $rek['spread_biaya'] = $gs['sekarang'];
                $rek['spread_basis'] = 'broker_saat_terbit';
            }
        }
        $rek['gerbang_spread'] = $gs['catatan'];
    }

    // ── GERBANG KONFLUENSI MESIN (Tahap 3, spesifikasi Bagian 2 & 10) ───────────
    // Sinyal hanya boleh terbit bila minimal 3 mesin Quantum searah. Ditegakkan di
    // jalur tulis tunggal ini supaya berlaku untuk SEMUA mesin (Auto Signal, AI, News,
    // TradingView). Berlaku juga untuk berkas uji; uji dapat mematikannya lewat
    // $GLOBALS['qi_gerbang_lewati'] = true (dipakai tests/signal-record.test.php).
    // Data TradingView tidak tersedia → FAIL-OPEN (tidak memblokir) dan dicatat jujur.
    $gerbang = ['lolos' => true, 'dinilai' => false, 'ringkas' => null, 'catatan' => 'gerbang dilewati'];
    if (empty($GLOBALS['qi_gerbang_lewati'])) {
        if (!function_exists('qi_gerbang_cek')) {
            $berkasGerbang = __DIR__ . '/_gerbang.php';
            if (is_file($berkasGerbang)) require_once $berkasGerbang;
        }
        if (function_exists('qi_gerbang_cek')) {
            try {
                $gerbang = qi_gerbang_cek($simbol, $arah);
            } catch (Throwable $e) {
                @error_log('[gerbang] gagal menilai: ' . $e->getMessage());
                $gerbang = ['lolos' => true, 'dinilai' => false, 'ringkas' => null,
                            'catatan' => 'gerbang gagal menilai (fail-open): ' . $e->getMessage()];
            }
        }
        if (empty($gerbang['lolos'])) {
            return ['dicatat' => false, 'alasan' => 'gerbang_mesin',
                    'detail' => ['catatan' => (string)($gerbang['catatan'] ?? ''), 'ringkas' => $gerbang['ringkas'] ?? null],
                    'id' => null];
        }
    }

    // ── Klaim atomik ──
    // Kunci yang SAMA dipakai evaluator dan POST admin (api/_json_kunci.php). Menunggu
    // sebentar (≤ 3 dtk) karena evaluator kini juga memegang kunci ini saat menulis;
    // tanpa tunggu, sinyal yang kebetulan bersamaan akan ditolak 'sedang_menulis'.
    $tokenKunci = qi_kunci_ambil($file, 3.0, 20);
    if ($tokenKunci === null) {
        return ['dicatat' => false, 'alasan' => 'sedang_menulis', 'detail' => [], 'id' => null];
    }

    try {
        clearstatcache(true, $file);
        $history = is_file($file) ? json_decode((string)@file_get_contents($file), true) : [];
        if (!is_array($history)) $history = [];

        $periksa = qi_signal_cek_pagar($history, $simbol, $arah, $engine, time(), $cooldownJam, $jedaGlobalMenit);
        if (!$periksa['boleh']) {
            return ['dicatat' => false, 'alasan' => $periksa['alasan'], 'detail' => $periksa['detail'], 'id' => null];
        }

        // EKSPOSUR KORELASI lintas mesin: EURUSD BUY + GBPUSD BUY + XAUUSD BUY = satu taruhan
        // (USD melemah). Diperiksa di bawah kunci supaya dua sinyal bersamaan tidak lolos berdua.
        $kor = qi_gr_cek_korelasi($history, $simbol, $arah);
        if (!$kor['lolos']) {
            return ['dicatat' => false, 'alasan' => 'eksposur_korelasi', 'detail' => $kor, 'id' => null];
        }
        $rek['kunci_korelasi'] = $kor['kunci'];

        // GRADE A/B/C disimpan SAAT PENCATATAN supaya nilainya tetap (tidak berubah
        // di belakang) dan bisa diaudit. Bila pemanggil sudah mengisi grade, hormati.
        if (!isset($rek['grade']) || trim((string)$rek['grade']) === '') {
            if (!function_exists('qi_signal_grade')) {
                require_once __DIR__ . '/_signal_stats.php';
            }
            if (function_exists('qi_signal_grade')) {
                $rek['grade'] = qi_signal_grade($rek);
            }
        }

        // Catat hasil gerbang konfluensi ke kolom bukti (basis) supaya keputusan
        // gerbang dapat diaudit dari rekor — termasuk ketika sinyal diloloskan.
        if (!empty($gerbang["dinilai"]) || !empty($gerbang["catatan"])) {
            $bekas = (string)($rek["basis"] ?? "");
            $tambahan = "gerbang mesin: " . (string)($gerbang["catatan"] ?? "");
            $rek["basis"] = (mb_strlen($bekas) > 0) ? mb_substr($bekas . " · " . $tambahan, 0, 255) : mb_substr($tambahan, 0, 255);
            $rek["gerbang_mesin"] = $gerbang["ringkas"];
        }

        // ── KONTEKS BERITA (spesifikasi Bagian 4) ────────────────────────────────
        // Diisi dari FILTER BLACKOUT yang sama dengan yang menahan sinyal, supaya
        // tidak ada dua aturan berita yang bisa berbeda. Bila kalender tidak tersedia,
        // teksnya menyatakan itu apa adanya — bukan "CLEAR" yang menyesatkan.
        if (empty($rek['news_context'])) {
            try {
                if (!function_exists('qi_fun_konteks')) require_once __DIR__ . '/_fundamental.php';
                if (function_exists('qi_fun_konteks')) $rek['news_context'] = qi_fun_konteks(30);
            } catch (Throwable $e) {
                @error_log('[fundamental] konteks dilewati: ' . $e->getMessage());
            }
        }

        array_unshift($history, $rek);
        if (count($history) > 500) $history = array_slice($history, 0, 500);
        // Cadangan hanya untuk rekor asli (berkas uji sementara tidak perlu).
        if ($fileBerkas === null) @copy($file, __DIR__ . '/../cache/signal_history.backup.json');
        $tulis = @file_put_contents($file, json_encode($history, JSON_PRETTY_PRINT), LOCK_EX);
        if ($tulis === false) {
            return ['dicatat' => false, 'alasan' => 'gagal_menulis', 'detail' => [], 'id' => null];
        }

        // ── JURNAL DATABASE (dual-write — Tahap 1 fondasi audit) ─────────────────
        // Berkas di atas TETAP menjadi sumber utama dan tidak berubah perilakunya.
        // Jurnal ditulis TAMBAHAN supaya rekor dapat dicari, dikaitkan ke tabel lain,
        // dan menyimpan gambar chart. Kegagalan jurnal TIDAK BOLEH menggagalkan
        // pencatatan sinyal — karena itu seluruhnya dibungkus try/catch.
        //
        // PENTING: hanya untuk rekor NYATA ($fileBerkas === null) — sama seperti aturan
        // pencadangan di atas. Tanpa penjaga ini, uji otomatis (tests/signal-record.test.php
        // memakai berkas sementara berisi id T1/T4/T6) akan menulis rekor palsu ke jurnal
        // produksi. Itu sudah terbukti terjadi dan dibersihkan pada 2026-10-13.
        if ($fileBerkas === null) {
            try {
                if (!function_exists('qi_journal_simpan')) {
                    require_once __DIR__ . '/_journal.php';
                }
                if (function_exists('qi_journal_simpan') && !qi_journal_simpan($rek)) {
                    @error_log('[jurnal] rekor ' . (string)($rek['id'] ?? '?') . ' tidak masuk jurnal: ' . qi_journal_galat_terakhir());
                }
            } catch (Throwable $e) {
                @error_log('[jurnal] hook perekam gagal: ' . $e->getMessage());
            }

            // ── JEJAK OUTPUT MESIN PER SINYAL (spesifikasi Bagian 12) ────────────
            // Menyimpan mesin mana yang setuju pada SAAT SINYAL TERBIT, beserta skor dan
            // dasarnya. Tanpa ini, pertanyaan itu tidak dapat dijawab setelah pasar berubah.
            // Mesin yang tidak dapat dihitung TIDAK ditulis (tidak ada baris netral palsu).
            if (!empty($gerbang['per_mesin'])) {
                try {
                    if (!function_exists('qi_eng_simpan_output')) require_once __DIR__ . '/_engine_server.php';
                    if (function_exists('qi_eng_simpan_output')) {
                        $nMesin = qi_eng_simpan_output((string)$rek['id'], (array)$gerbang['per_mesin']);
                        if ($nMesin > 0) $rek['mesin_tercatat'] = $nMesin;
                    }
                } catch (Throwable $e) {
                    @error_log('[engine] hook rekam jejak mesin gagal: ' . $e->getMessage());
                }
            }
        }

        // ── NOTIFIKASI TELEGRAM (opsional) ───────────────────────────────────────
        // Dijalankan SETELAH rekor tersimpan dengan aman, dan TIDAK PERNAH boleh
        // menggagalkan pencatatan: seluruhnya dibungkus try/catch dan kegagalannya
        // hanya menjadi catatan. Bila bot/chat belum diatur, fungsi mengembalikan
        // status "belum dikonfigurasi" tanpa mengirim apa pun.
        // Berkas uji sementara (mis. dari unit test) SENGAJA tidak dinotifikasi.
        $telegram = null;
        if ($fileBerkas === null) {
            try {
                if (!function_exists('qi_telegram_notifikasi_sinyal')) {
                    require_once __DIR__ . '/_telegram.php';
                }
                if (function_exists('qi_telegram_notifikasi_sinyal')) {
                    $telegram = qi_telegram_notifikasi_sinyal($rek);
                }
            } catch (Throwable $e) {
                $telegram = ['ok' => false, 'dikirim' => false, 'pesan' => 'Notifikasi dilewati: ' . $e->getMessage()];
            }
        }

        // ── NOTIFIKASI PER PENGGUNA (Fase 2: Telegram/Discord/Slack/email) ─────────
        // Sama seperti Telegram admin di atas: sesudah rekor aman tersimpan, tidak pernah
        // menggagalkan pencatatan, dan berkas uji sementara tidak dinotifikasi.
        // Pengiriman ganda dicegah oleh klaim unik di notification_deliveries.
        // Kunci berkas dilepas lebih dulu: rekor sudah tertulis, dan banyak webhook lambat
        // tidak boleh menahan penulis lain sampai kuncinya dianggap basi (20 detik).
        $notifikasi = null;
        qi_kunci_lepas($file, $tokenKunci);
        $kunciDilepas = true;
        if ($fileBerkas === null) {
            try {
                if (!function_exists('qi_notif_sebar_sinyal')) require_once __DIR__ . '/_notif.php';
                $notifikasi = qi_notif_sebar_sinyal($rek);
            } catch (Throwable $e) {
                $notifikasi = ['ok' => false, 'catatan' => 'Notifikasi pengguna dilewati: ' . $e->getMessage()];
            }
        }

        return [
            'dicatat'  => true,
            'alasan'   => 'ok',
            'detail'   => [],
            'id'       => (string)($rek['id'] ?? ''),
            'telegram' => $telegram,
            'notifikasi' => $notifikasi,
        ];
    } finally {
        if (empty($kunciDilepas)) qi_kunci_lepas($file, $tokenKunci);   // hanya kunci milik sendiri
    }
}

endif;
