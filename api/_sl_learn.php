<?php
declare(strict_types=1);
/**
 * BELAJAR DARI STOP LOSS (Tahap 2 — spesifikasi Bagian 5).
 *
 * TUJUAN: setiap SL menjadi pelajaran yang TERUKUR, bukan sekadar catatan "HIT SL".
 *
 * PRINSIP YANG DIJAGA KETAT:
 *   1. HANYA memakai besaran yang benar-benar ada di rekor (entry, sl, exit_price, atr,
 *      mtf_aligned, timestamp). Tidak ada tebakan, tidak ada angka tambahan.
 *   2. Bila bukti tidak cukup → sebab ditulis 'perlu_data_harga' atau 'tidak_diketahui'
 *      beserta alasannya. Ini disengaja: kesimpulan palsu lebih berbahaya daripada
 *      mengakui data kurang.
 *   3. AI TIDAK PERNAH mengubah metode sendiri. Yang dihasilkan adalah USULAN dengan
 *      status 'menunggu'/'perlu_uji', dan aktivasi versi baru dilakukan manusia.
 *   4. Usulan hanya dibuat bila sampelnya memadai. Di bawah ambang, usulan DITAHAN dan
 *      alasannya ditulis apa adanya (mis. "sampel 7 < 10").
 *
 * AMBANG YANG DIPAKAI (dinyatakan terbuka supaya bisa diperdebatkan, bukan disembunyikan):
 *   · SL dianggap terlalu ketat bila jarak SL < 1,0 × ATR (SL berada di dalam derau/ATR).
 *   · Dianggap terindikasi sapuan likuiditas bila harga melewati SL ≥ 0,25 × ATR.
 *   · Rezim volatilitas dari ATR / harga: < 0,30% rendah · 0,30–0,80% sedang · > 0,80% tinggi.
 *   · Usulan metode hanya dibuat bila jumlah SL yang dianalisa ≥ 10.
 */

require_once __DIR__ . '/_signal_time.php';   // jam sesi dalam WIB dari waktu rekor yang tanpa ambigu

if (!function_exists('qi_sl_sesi')) {

    /** Sesi pasar dari jam (0-23, zona waktu server). Batas jam adalah konvensi yang ditulis terbuka. */
    function qi_sl_sesi(?int $jam): ?string
    {
        if ($jam === null) return null;
        if ($jam >= 7 && $jam < 15)  return 'Asia';        // 07:00–14:59 WIB
        if ($jam >= 15 && $jam < 20) return 'London';      // 15:00–19:59 WIB
        if ($jam >= 20 && $jam < 24) return 'New York';    // 20:00–23:59 WIB
        return 'Jelang tutup';                             // 00:00–06:59 WIB
    }

    /** Rezim volatilitas dari ATR relatif terhadap harga. Mengembalikan null bila data kurang. */
    function qi_sl_regime(?float $atr, ?float $harga): ?string
    {
        if ($atr === null || $harga === null || $atr <= 0 || $harga <= 0) return null;
        $persen = $atr / $harga * 100.0;
        if ($persen < 0.30) return 'rendah';
        if ($persen <= 0.80) return 'sedang';
        return 'tinggi';
    }

    /** Jarak SL (harga) — null bila data kurang. */
    function qi_sl_jarak(?float $entry, ?float $sl): ?float
    {
        if ($entry === null || $sl === null || $entry <= 0 || $sl <= 0 || $entry === $sl) return null;
        return abs($entry - $sl);
    }

    /** Jarak SL dibagi ATR. Di bawah 1,0 berarti SL berada di dalam derau ATR. */
    function qi_sl_jarak_atr(?float $jarak, ?float $atr): ?float
    {
        if ($jarak === null || $atr === null || $atr <= 0) return null;
        return round($jarak / $atr, 4);
    }

    /**
     * Seberapa jauh harga MELEWATI SL, dalam satuan ATR (≥ 0).
     *
     * SUMBER DATA (urut prioritas):
     *   1. `wick_depth_atr` — diukur penilai dari candle NYATA (high/low pemicu). Ini yang
     *      paling benar: kedalaman tembus sesungguhnya, termasuk saat harga melompat.
     *   2. Cadangan: dihitung dari exit_price vs SL. Nilai ini 0 bila penilai menetapkan
     *      harga keluar tepat di SL (perilaku lama), sehingga TIDAK boleh disimpulkan
     *      "tidak ada sapuan" hanya dari angka 0 tersebut.
     */
    function qi_sl_sweep_overshoot(?string $arah, ?float $sl, ?float $exit, ?float $atr, array $rek = []): ?float
    {
        if (isset($rek['wick_depth_atr']) && is_numeric($rek['wick_depth_atr'])) {
            return round((float)$rek['wick_depth_atr'], 4);
        }
        if ($sl === null || $exit === null || $atr === null || $atr <= 0 || $sl <= 0 || $exit <= 0) return null;
        $lebih = ($arah === 'SELL') ? ($exit - $sl) : ($sl - $exit);
        if ($lebih <= 0) return 0.0;
        return round($lebih / $atr, 4);
    }

    /** Apakah candle pemicu DITUTUP kembali di sisi semula SL? (bukti sapuan, bukan tren) */
    function qi_sl_tutup_kembali(array $r): ?bool
    {
        if (!array_key_exists('closed_back', $r)) return null;
        return (bool)$r['closed_back'];
    }

    /**
     * Klasifikasikan sebab SL dari data nyata. Mengembalikan ['cause' => …, 'detail' => …].
     * Urutan pemeriksaan disengaja: sebab paling terukur lebih dulu.
     */
    function qi_sl_sebab(array $r): array
    {
        $jarakAtr = qi_sl_jarak_atr(qi_sl_jarak(
            isset($r['entry']) ? (float)$r['entry'] : null,
            isset($r['sl']) ? (float)$r['sl'] : null
        ), isset($r['atr']) ? (float)$r['atr'] : null);
        $overshoot = qi_sl_sweep_overshoot(
            isset($r['side']) ? (string)$r['side'] : null,
            isset($r['sl']) ? (float)$r['sl'] : null,
            isset($r['exit_price']) ? (float)$r['exit_price'] : null,
            isset($r['atr']) ? (float)$r['atr'] : null,
            $r
        );
        $tutupKembali = qi_sl_tutup_kembali($r);
        $regime = qi_sl_regime(isset($r['atr']) ? (float)$r['atr'] : null, isset($r['entry']) ? (float)$r['entry'] : null);
        $aligned = $r['mtf_aligned'] ?? null;

        if ($jarakAtr === null) {
            return ['cause' => 'perlu_data_harga',
                    'detail' => 'ATR atau level SL tidak tersimpan pada rekor ini, sehingga jarak SL tidak bisa dinilai terhadap volatilitas. Tidak disimpulkan sebab apa pun.'];
        }
        if ($jarakAtr < 1.0) {
            return ['cause' => 'sl_terlalu_ketat',
                    'detail' => 'Jarak SL hanya ' . $jarakAtr . '× ATR (di bawah 1× ATR) — SL berada di dalam derau pergerakan biasa, sehingga wajar tersentuh lebih dulu.'];
        }
        if ($overshoot !== null && $overshoot >= 0.25) {
            // Sapuan likuiditas HANYA disimpulkan bila candle pemicu DITUTUP kembali di sisi
            // semula SL. Bila harga justru berlanjut, itu TREN — bukan sapuan. Pembedaan ini
            // penting: menyebut semuanya "sapuan" akan menyesatkan perbaikan metode.
            if ($tutupKembali === true) {
                return ['cause' => 'sapuan_likuiditas',
                        'detail' => 'Harga menembus SL sejauh ' . $overshoot . '× ATR lalu candle DITUTUP kembali di sisi semula SL — bukti sapuan likuiditas (stop diambil, harga kembali). Kedalaman tembus diukur dari candle nyata.'];
            }
            if ($tutupKembali === false) {
                return ['cause' => 'tren_berlanjut',
                        'detail' => 'Harga menembus SL sejauh ' . $overshoot . '× ATR dan TIDAK ditutup kembali (candle berakhir di sisi SL). Ini pergerakan tren yang berlanjut, BUKAN sapuan likuiditas — jadi memperlebar SL bukan jawabannya untuk kasus ini.'];
            }
            return ['cause' => 'sapuan_likuiditas',
                    'detail' => 'Harga menembus SL sejauh ' . $overshoot . '× ATR. Kedalaman tembus nyata, tetapi data penutupan candle tidak tersimpan pada rekor ini sehingga sapuan belum dapat dipastikan. Tidak disimpulkan lebih jauh.'];
        }
        if ($aligned === false || $aligned === 0) {
            return ['cause' => 'tf_konflik',
                    'detail' => 'Arah antar timeframe TIDAK selaras saat sinyal terbit (mtf_aligned = tidak). Sinyal melawan sebagian timeframe.'];
        }
        if ($regime === 'tinggi') {
            // PENTING: persentase di sini adalah ATR terhadap HARGA (bukan rasio SL/ATR).
            // Sebelumnya kode menulis "ATR {rasio}% dari harga" sehingga angkanya salah
            // (mis. "ATR 200% dari harga") — kalimat menyesatkan yang wajib dihindari.
            $atr = isset($r['atr']) ? (float)$r['atr'] : null;
            $harga = isset($r['entry']) ? (float)$r['entry'] : null;
            $persen = ($atr !== null && $harga !== null && $harga > 0) ? round($atr / $harga * 100.0, 2) : null;
            return ['cause' => 'volatilitas_ekstrem',
                    'detail' => 'Volatilitas saat terbit tinggi: ATR ' . ($persen !== null ? ($persen . '%') : 'tidak dapat dihitung')
                        . ' dari harga (jarak SL ' . $jarakAtr . '× ATR), sehingga pergerakan lebih liar dari biasanya.'];
        }
        return ['cause' => 'tidak_diketahui',
                'detail' => 'Jarak SL ' . $jarakAtr . '× ATR dan tidak ada indikasi sapuan, konflik timeframe, atau volatilitas ekstrem. Sebab belum dapat ditentukan dari data yang ada — TIDAK diterka.'];
    }

    /**
     * Nilai rata-rata jarak SL (× ATR) untuk kelompok rekor tertentu.
     * Dipakai menjawab: "apakah transaksi yang kalah memang memakai SL lebih ketat?"
     */
    function qi_sl_rata_jarak_atr(array $daftar, bool $hanyaMenang, bool $hanyaKalah): array
    {
        $nilai = [];
        foreach ($daftar as $r) {
            if (!is_array($r)) continue;
            $status = strtoupper((string)($r['status'] ?? ''));
            $menang = (strpos($status, 'HIT TP') === 0);
            $kalah  = (strpos($status, 'HIT SL') === 0);
            if ($hanyaMenang && !$menang) continue;
            if ($hanyaKalah && !$kalah) continue;
            $rasio = qi_sl_jarak_atr(
                qi_sl_jarak(isset($r['entry']) ? (float)$r['entry'] : null, isset($r['sl']) ? (float)$r['sl'] : null),
                isset($r['atr']) ? (float)$r['atr'] : null
            );
            if ($rasio !== null) $nilai[] = $rasio;
        }
        if (!$nilai) return ['n' => 0, 'rata' => null];
        return ['n' => count($nilai), 'rata' => round(array_sum($nilai) / count($nilai), 3)];
    }

    /**
     * Ringkasan analisa SL dari daftar rekor (hanya yang benar-benar tertutup kena SL).
     * Semua angka dihitung dari data; yang tidak bisa dihitung dikembalikan null.
     */
    function qi_sl_ringkas(array $rekor): array
    {
        $sl = []; $perSebab = []; $perSesi = []; $perSimbol = []; $perTf = [];
        foreach ($rekor as $r) {
            if (!is_array($r)) continue;
            if (strpos(strtoupper((string)($r['status'] ?? '')), 'HIT SL') !== 0) continue;
            $sebab = qi_sl_sebab($r);
            $sl[] = ['rekor' => $r, 'sebab' => $sebab['cause'], 'detail' => $sebab['detail']];
            $perSebab[$sebab['cause']] = ($perSebab[$sebab['cause']] ?? 0) + 1;
            $jam = null;
            $jam = qi_sig_jam_tampil(qi_sig_epoch($r['timestamp'] ?? null));
            $sesi = qi_sl_sesi($jam) ?? 'tidak diketahui';
            $perSesi[$sesi] = ($perSesi[$sesi] ?? 0) + 1;
            $sim = (string)($r['symbol'] ?? 'tidak diketahui');
            $perSimbol[$sim] = ($perSimbol[$sim] ?? 0) + 1;
            $tf = (string)($r['timeframe'] ?? 'tidak diketahui');
            $perTf[$tf] = ($perTf[$tf] ?? 0) + 1;
        }
        $menang = qi_sl_rata_jarak_atr($rekor, true, false);
        $kalah  = qi_sl_rata_jarak_atr($rekor, false, true);
        $selisih = ($menang['rata'] !== null && $kalah['rata'] !== null) ? round($kalah['rata'] - $menang['rata'], 3) : null;

        return [
            'jumlah_sl'      => count($sl),
            'per_sebab'      => $perSebab,
            'per_sesi'       => $perSesi,
            'per_simbol'     => $perSimbol,
            'per_timeframe'  => $perTf,
            'rata_jarak_atr_menang' => $menang,
            'rata_jarak_atr_kalah'  => $kalah,
            'selisih_jarak_atr'     => $selisih,
            'rincian'        => $sl,
        ];
    }

    /**
     * Susun USULAN perbaikan metode dari ringkasan. TIDAK pernah mengubah apa pun.
     * Usulan ditahan bila sampel belum memadai — dan alasannya ditulis apa adanya.
     */
    function qi_sl_usulan(array $ringkas): array
    {
        $n = (int)($ringkas['jumlah_sl'] ?? 0);
        $sebab = (array)($ringkas['per_sebab'] ?? []);
        $ambangSampel = 10;

        if ($n < $ambangSampel) {
            return [
                'usul'       => null,
                'status'     => 'menunggu',
                'catatan'    => 'Usulan DITAHAN: sampel SL baru ' . $n . ' dari minimal ' . $ambangSampel . '. Menyimpulkan perbaikan metode dari sampel sekecil ini berisiko menyesatkan.',
            ];
        }

        $ketat = (int)($sebab['sl_terlalu_ketat'] ?? 0);
        $sapu  = (int)($sebab['sapuan_likuiditas'] ?? 0);
        $konflik = (int)($sebab['tf_konflik'] ?? 0);

        if ($ketat >= (int)ceil($n * 0.30)) {
            return [
                'usul'    => 'Naikkan jarak SL minimum dari 1,2× ATR menjadi 1,5× ATR untuk sinyal baru (SL lebih jauh dari derau).',
                'status'  => 'perlu_uji',
                'catatan' => $ketat . ' dari ' . $n . ' SL (' . round($ketat / $n * 100) . '%) punya jarak SL < 1× ATR. WAJIB diuji dulu: backtest minimal 100 sampel + forward test minimal 30 sampel; hanya diterbitkan bila winrate & profit factor MEMBAIK.',
            ];
        }
        if ($sapu >= (int)ceil($n * 0.30)) {
            return [
                'usul'    => 'Tempatkan SL berbasis STRUKTUR (di balik swing high/low nyata + buffer 0,25×ATR) alih-alih murni ATR.',
                'status'  => 'perlu_uji',
                'catatan' => $sapu . ' dari ' . $n . ' SL (' . round($sapu / $n * 100) . '%) terindikasi sapuan likuiditas. Struktur eksak baru bisa dihitung untuk emas/forex setelah kredensial OANDA tersedia. Wajib diuji dulu sebelum diterbitkan.',
            ];
        }
        if ($konflik >= (int)ceil($n * 0.30)) {
            return [
                'usul'    => 'Perketat filter: tolak sinyal yang arahnya tidak selaras antar timeframe (mtf_aligned wajib benar).',
                'status'  => 'perlu_uji',
                'catatan' => $konflik . ' dari ' . $n . ' SL (' . round($konflik / $n * 100) . '%) terjadi saat timeframe tidak selaras. Wajib diuji dulu (backtest 100 + forward 30).',
            ];
        }

        // Bila tidak ada pola yang menonjol, JANGAN memaksakan usulan.
        $pola = [];
        foreach ($sebab as $k => $v) { $pola[] = $k . '=' . $v; }
        return [
            'usul'    => null,
            'status'  => 'menunggu',
            'catatan' => 'Belum ada pola yang cukup menonjol dari ' . $n . ' SL (' . implode(', ', $pola) . ') — belum ada usulan yang layak diajukan. Data akan terus dikumpulkan.',
        ];
    }

    /** Satu baris analisa lengkap untuk disimpan ke ai_sl_events (dari rekor kena SL). */
    function qi_sl_baris(array $r, int $nSampel = 0): array
    {
        $jam = qi_sig_jam_tampil(qi_sig_epoch($r['timestamp'] ?? null));   // sesi qi_sl_sesi() ditulis dalam WIB
        $tutup = qi_sig_epoch($r['closed_at'] ?? null, 'closed_at');
        $jarak = qi_sl_jarak(isset($r['entry']) ? (float)$r['entry'] : null, isset($r['sl']) ? (float)$r['sl'] : null);
        $atr = isset($r['atr']) && is_numeric($r['atr']) ? (float)$r['atr'] : null;
        $sebab = qi_sl_sebab($r);
        $teks = static function ($v, int $maks): ?string {
            if ($v === null) return null;
            $s = trim((string)$v);
            if ($s === '') return null;
            return (mb_strlen($s) > $maks) ? mb_substr($s, 0, $maks) : $s;
        };
        return [
            'signal_id'       => (string)($r['id'] ?? ''),
            'created_at'      => date('Y-m-d H:i:s'),
            'closed_at'       => $tutup !== null ? date('Y-m-d H:i:s', $tutup) : null,
            'symbol'          => $teks($r['symbol'] ?? null, 30) ?? 'UNKNOWN',
            'timeframe'       => $teks($r['timeframe'] ?? null, 12),
            'direction'       => (strtoupper((string)($r['side'] ?? '')) === 'SELL') ? 'SELL' : ((strtoupper((string)($r['side'] ?? '')) === 'BUY') ? 'BUY' : null),
            'entry_price'     => isset($r['entry']) && is_numeric($r['entry']) ? round((float)$r['entry'], 6) : null,
            'sl_price'        => isset($r['sl']) && is_numeric($r['sl']) ? round((float)$r['sl'], 6) : null,
            'exit_price'      => isset($r['exit_price']) && is_numeric($r['exit_price']) ? round((float)$r['exit_price'], 6) : null,
            'atr'             => $atr !== null ? round($atr, 6) : null,
            'sl_distance'     => $jarak !== null ? round($jarak, 6) : null,
            'sl_distance_atr' => qi_sl_jarak_atr($jarak, $atr),
            'sweep_overshoot_atr' => qi_sl_sweep_overshoot(
                isset($r['side']) ? (string)$r['side'] : null,
                isset($r['sl']) && is_numeric($r['sl']) ? (float)$r['sl'] : null,
                isset($r['exit_price']) && is_numeric($r['exit_price']) ? (float)$r['exit_price'] : null,
                $atr,
                $r
            ),
            'session'         => qi_sl_sesi($jam),
            'jam_sinyal'      => $jam,
            'mtf_aligned'     => isset($r['mtf_aligned']) ? (int)(bool)$r['mtf_aligned'] : null,
            'confluence_score' => isset($r['confluence_score']) && is_numeric($r['confluence_score']) ? (int)$r['confluence_score'] : null,
            'confidence'      => isset($r['confidence']) && is_numeric($r['confidence']) ? (int)$r['confidence'] : null,
            'regime'          => qi_sl_regime($atr, isset($r['entry']) && is_numeric($r['entry']) ? (float)$r['entry'] : null),
            'cause'           => $sebab['cause'],
            'cause_detail'    => $teks($sebab['detail'], 400),
            'analysis'        => 'Analisa otomatis dari data rekor: jarak SL '
                . ($jarak !== null ? round($jarak, 6) : 'tidak ada') . ' · ATR ' . ($atr !== null ? round($atr, 6) : 'tidak ada')
                . ' · rasio ' . (qi_sl_jarak_atr($jarak, $atr) ?? 'tidak ada') . '× ATR · sesi ' . (qi_sl_sesi($jam) ?? 'tidak diketahui')
                . ' · timeframe selaras: ' . (($r['mtf_aligned'] ?? null) ? 'ya' : 'tidak/belum ada') . '.',
            'proposed_change' => null,          // diisi oleh qi_sl_usulan saat menyimpan berkala
            'status_usul'     => 'menunggu',
            'sample_note'     => ($nSampel > 0) ? ('dianalisa bersama ' . $nSampel . ' kejadian SL lain') : null,
            'raw_json'        => json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    /** Semua kunci baris (untuk INSERT yang konsisten). */
    function qi_sl_kolom(): array
    {
        return ['signal_id','created_at','closed_at','symbol','timeframe','direction','entry_price','sl_price','exit_price','atr',
                'sl_distance','sl_distance_atr','sweep_overshoot_atr','session','jam_sinyal','mtf_aligned','confluence_score','confidence',
                'regime','cause','cause_detail','analysis','proposed_change','status_usul','sample_note','raw_json'];
    }

    /** Apakah tabel analisa SL tersedia? (di-cache per permintaan) */
    function qi_sl_tersedia(): bool
    {
        static $hasil = null;
        if ($hasil !== null) return $hasil;
        $hasil = false;
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            getDBConnection()->query('SELECT 1 FROM `ai_sl_events` LIMIT 1');
            $hasil = true;
        } catch (Throwable $e) {
            @error_log('[sl-learn] tabel ai_sl_events belum tersedia: ' . $e->getMessage());
        }
        return $hasil;
    }

    /**
     * Simpan analisa satu rekor SL (idempoten lewat UNIQUE signal_id).
     * Mengembalikan true bila tersimpan. Tidak pernah melempar exception.
     */
    function qi_sl_simpan(array $r, string $usul = '', string $statusUsul = 'menunggu', string $catatanSampel = '', int $nSampel = 0): bool
    {
        if (!qi_sl_tersedia()) return false;
        if (empty($r['id'])) return false;
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            $baris = qi_sl_baris($r, $nSampel);
            if ($usul !== '') { $baris['proposed_change'] = mb_substr($usul, 0, 400); $baris['status_usul'] = $statusUsul; }
            if ($catatanSampel !== '') $baris['sample_note'] = mb_substr($catatanSampel, 0, 200);
            $kolom = qi_sl_kolom();
            $set = [];
            foreach ($kolom as $k) { if ($k !== 'signal_id') $set[] = '`' . $k . '` = VALUES(`' . $k . '`)'; }
            $sql = 'INSERT INTO `ai_sl_events` (`' . implode('`,`', $kolom) . '`) VALUES ('
                 . implode(',', array_fill(0, count($kolom), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', $set);
            getDBConnection()->prepare($sql)->execute(array_values($baris));
            return true;
        } catch (Throwable $e) {
            @error_log('[sl-learn] simpan gagal: ' . $e->getMessage());
            return false;
        }
    }

    /** Ambil daftar analisa SL terbaru (untuk panel). */
    function qi_sl_ambil(int $batas = 50): array
    {
        if (!qi_sl_tersedia()) return [];
        try {
            if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
            $batas = max(1, min(500, $batas));
            return getDBConnection()->query('SELECT * FROM `ai_sl_events` ORDER BY `id` DESC LIMIT ' . $batas)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            @error_log('[sl-learn] ambil gagal: ' . $e->getMessage());
            return [];
        }
    }

    /** Analisa SEMUA rekor yang kena SL sekaligus (dipakai hook penilai & perintah manual). */
    function qi_sl_analisa_semua(array $rekor): array
    {
        $ringkas = qi_sl_ringkas($rekor);
        $usul = qi_sl_usulan($ringkas);
        $n = (int)$ringkas['jumlah_sl'];
        $tersimpan = 0;
        foreach ($rekor as $r) {
            if (!is_array($r)) continue;
            if (strpos(strtoupper((string)($r['status'] ?? '')), 'HIT SL') !== 0) continue;
            if (qi_sl_simpan($r, (string)($usul['usul'] ?? ''), (string)($usul['status'] ?? 'menunggu'), (string)($usul['catatan'] ?? ''), $n)) $tersimpan++;
        }
        return ['ringkas' => $ringkas, 'usul' => $usul, 'tersimpan' => $tersimpan, 'jumlah_sl' => $n];
    }
}
