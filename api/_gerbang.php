<?php
declare(strict_types=1);
/**
 * GERBANG KONFLUENSI MESIN (Tahap 3 lanjutan) — penegakan syarat minimal 3 mesin.
 *
 * MENGAPA ADA:
 *   Spesifikasi (Bagian 2 dan Bagian 10) menyatakan AI DILARANG menerbitkan sinyal
 *   tanpa konfluensi minimal 3 mesin Quantum yang searah. Sebelumnya aturan itu hanya
 *   hidup di mesin server (api/engine-server.php) dan TIDAK dipakai di jalur penerbitan
 *   sinyal — jadi sinyal tetap bisa terbit walau mesin-mesinnya tidak sepakat.
 *   Modul ini menegakkannya di JALUR TULIS TUNGGAL (api/_signal_record.php → qi_signal_catat),
 *   sehingga berlaku untuk SEMUA mesin: AUTO_SIGNAL, AI, NEWS, dan TradingView.
 *
 * ATURAN YANG DIPAKAI (dinyatakan terbuka):
 *   1. Gerbang hanya menilai bila MESIN TERSEDIA ≥ 5. Bila kurang dari itu, penilaian
 *      "3 dari 9" tidak bermakna dan sinyal TIDAK diblokir (dicatat sebagai tidak dinilai).
 *   2. Bila mesin tersedia ≥ 5 dan mesin yang SEARAH dengan sinyal < 3 → sinyal DITOLAK.
 *   3. FAIL-OPEN pada kegagalan data: bila data TradingView tidak dapat diambil, sinyal
 *      TIDAK diblokir (kalau diblokir, gangguan sumber data akan menghentikan seluruh
 *      penerbitan sinyal tanpa alasan yang jelas). Kejadian ini dicatat apa adanya.
 *   4. Gerbang dapat dimatikan oleh admin lewat berkas cache/gerbang_mesin.json
 *      (mis. saat ingin mengumpulkan data tanpa penyaringan).
 *
 * KEJUJURAN: hasil penilaian (jumlah searah, mesin mana, dan keputusan gerbang) ikut
 * disimpan ke kolom 'basis' rekor supaya dapat diaudit — termasuk saat sinyal DITOLAK.
 */

if (!function_exists('qi_gerbang_berkas')) {

    function qi_gerbang_berkas(): string
    {
        return __DIR__ . '/../cache/gerbang_mesin.json';
    }

    /** Status gerbang: ['aktif' => bool, 'sebab' => string, 'oleh' => ?int, 'sejak' => ?string] */
    function qi_gerbang_status(): array
    {
        $bawaan = ['aktif' => true, 'sebab' => 'bawaan: syarat minimal 3 mesin ditegakkan', 'oleh' => null, 'sejak' => null];
        $f = qi_gerbang_berkas();
        if (!is_file($f)) return $bawaan;
        $j = json_decode((string)@file_get_contents($f), true);
        if (!is_array($j)) return $bawaan;
        return [
            'aktif' => (bool)($j['aktif'] ?? true),
            'sebab' => (string)($j['sebab'] ?? ''),
            'oleh'  => isset($j['oleh']) ? (int)$j['oleh'] : null,
            'sejak' => isset($j['sejak']) ? (string)$j['sejak'] : null,
        ];
    }

    function qi_gerbang_set(bool $aktif, string $sebab = '', ?int $idPengguna = null): bool
    {
        $f = qi_gerbang_berkas();
        $dir = dirname($f);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) return false;
        return @file_put_contents($f, json_encode([
            'aktif' => $aktif, 'sebab' => mb_substr(trim($sebab), 0, 240),
            'oleh' => $idPengguna, 'sejak' => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) !== false;
    }

    /**
     * KEPUTUSAN GERBANG — fungsi MURNI (tanpa jaringan) supaya dapat diuji dengan pasti.
     * @param array $k hasil qi_eng_konfluensi()
     */
    function qi_gerbang_putuskan(array $k, string $arah, int $minimum = 3, int $minimumTersedia = 5): array
    {
        $tersedia = (int)($k['tersedia'] ?? 0);
        $hitung = (array)($k['hitung'] ?? []);
        $ringkas = [
            'tersedia' => $tersedia,
            'tidak_tersedia' => (int)($k['tidak_tersedia'] ?? 0),
            'arah' => (string)($k['arah'] ?? 'NETRAL'),
            'jumlah_searah' => (int)($k['jumlah_searah'] ?? 0),
            'hitung' => $hitung,
            'mesin_setuju' => ($arah === 'BUY') ? (array)($k['mesin_buy'] ?? []) : (($arah === 'SELL') ? (array)($k['mesin_sell'] ?? []) : []),
        ];
        if ($tersedia < $minimumTersedia) {
            return ['lolos' => true, 'dinilai' => false, 'alasan' => '', 'ringkas' => $ringkas,
                    'catatan' => 'hanya ' . $tersedia . ' mesin tersedia (< ' . $minimumTersedia . ') — penilaian "minimal ' . $minimum . ' mesin" belum bermakna, sinyal tidak diblokir'];
        }
        $searah = ($arah === 'BUY') ? (int)($hitung['BUY'] ?? 0) : (int)($hitung['SELL'] ?? 0);
        if ($searah < $minimum) {
            return ['lolos' => false, 'dinilai' => true, 'ringkas' => $ringkas, 'alasan' => 'gerbang_mesin',
                    'catatan' => 'DITOLAK: hanya ' . $searah . ' dari ' . $tersedia . ' mesin tersedia yang searah ' . $arah
                               . ' (syarat minimal ' . $minimum . '). Rincian: BUY=' . (int)($hitung['BUY'] ?? 0)
                               . ' SELL=' . (int)($hitung['SELL'] ?? 0) . ' NETRAL=' . (int)($hitung['NETRAL'] ?? 0)];
        }
        return ['lolos' => true, 'dinilai' => true, 'alasan' => '', 'ringkas' => $ringkas,
                'catatan' => 'LOLOS: ' . $searah . ' dari ' . $tersedia . ' mesin tersedia searah ' . $arah . ' (syarat minimal ' . $minimum . ')'];
    }

    /**
     * Nilai apakah satu sinyal lolos gerbang konfluensi (mengambil data lalu memutuskan).
     * @return array{lolos:bool,dinilai:bool,alasan:string,ringkas:array|null,catatan:string}
     */
    function qi_gerbang_cek(string $simbol, string $arah, int $minimum = 3, int $minimumTersedia = 5): array
    {
        $status = qi_gerbang_status();
        if (!$status['aktif']) {
            return ['lolos' => true, 'dinilai' => false, 'alasan' => '', 'ringkas' => null,
                    'catatan' => 'gerbang dimatikan: ' . ($status['sebab'] ?: 'tanpa alasan dicatat')];
        }

        if (!function_exists('qi_eng_matriks')) require_once __DIR__ . '/_engine_server.php';
        $c = qi_eng_snapshot($simbol);
        if ($c === null) {
            return ['lolos' => true, 'dinilai' => false, 'alasan' => '', 'ringkas' => null,
                    'catatan' => 'DATA TIDAK TERSEDIA: gerbang tidak menilai (fail-open) supaya gangguan sumber data tidak menghentikan sinyal'];
        }

        // Jam sesi dalam WIB EKSPLISIT. Dulu (int)date('G') = zona php.ini (Europe/Berlin lokal,
        // UTC di hosting), padahal MomentumNY menafsirkannya sebagai WIB (audit 2026-10-22).
        $matriks = qi_eng_matriks($c, qi_eng_jam_wib());
        $k = qi_eng_konfluensi($matriks, $minimum);
        $putusan = qi_gerbang_putuskan($k, $arah, $minimum, $minimumTersedia);
        // Rincian per mesin disertakan supaya jejaknya dapat disimpan ke
        // quantum_engine_outputs (audit: mesin apa yang setuju saat sinyal terbit).
        $putusan['per_mesin'] = [];
        foreach ($matriks as $kodeM => $m) {
            if (empty($m['tersedia'])) continue;   // mesin yang tidak dapat dihitung TIDAK ditulis
            $putusan['per_mesin'][$kodeM] = ['arah' => (string)$m['arah'], 'skor' => $m['skor'], 'dasar' => mb_substr((string)$m['dasar'], 0, 400)];
        }
        return $putusan;
    }
}
