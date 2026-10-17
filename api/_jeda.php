<?php
declare(strict_types=1);
/**
 * SAKLAR JEDA SINYAL (PAUSE DARURAT) — Tahap 4.
 *
 * MENGAPA ADA:
 *   Spesifikasi (Bagian 8) meminta tombol "Pause Signal (emergency stop)". Tanpa ini,
 *   ketika pasar sedang kacau (berita besar, spread melebar, atau ada kekeliruan pada
 *   mesin) tidak ada cara menghentikan penerbitan sinyal baru selain menunggu.
 *
 * CARA KERJA:
 *   · Disimpan sebagai BERKAS (cache/sinyal_jeda.json) — sejalan dengan pola platform
 *     yang lain, tanpa perlu mengubah skema database.
 *   · DIPERIKSA DI JALUR TULIS TUNGGAL (api/_signal_record.php → qi_signal_catat), jadi
 *     SATU saklar menghentikan SEMUA mesin: AUTO_SIGNAL, AI, NEWS, dan TradingView.
 *   · Jeda TIDAK menghapus apa pun: rekor lama tetap utuh, penilai TP/SL tetap berjalan,
 *     dan statistik tetap dihitung. Yang berhenti hanyalah penerbitan sinyal BARU.
 *
 * PRINSIP KEJUJURAN: ketika jeda aktif, alasannya ikut disimpan dan DITAMPILKAN, supaya
 * tidak ada yang bingung mengapa sinyal tidak muncul. Status "aktif" tidak pernah
 * disembunyikan.
 */

if (!function_exists('qi_jeda_berkas')) {

    /** Lokasi berkas saklar. */
    function qi_jeda_berkas(): string
    {
        return __DIR__ . '/../cache/sinyal_jeda.json';
    }

    /**
     * Status jeda saat ini (selalu array, tidak pernah melempar exception).
     * Bentuk: ['jeda' => bool, 'sebab' => string, 'oleh' => ?int, 'sejak' => ?string, 'galat' => ?string]
     */
    function qi_jeda_status(): array
    {
        $kosong = ['jeda' => false, 'sebab' => '', 'oleh' => null, 'sejak' => null, 'galat' => null];
        $f = qi_jeda_berkas();
        if (!is_file($f)) return $kosong;
        $isi = @file_get_contents($f);
        if ($isi === false || trim($isi) === '') { $kosong['galat'] = 'berkas jeda tidak dapat dibaca'; return $kosong; }
        $j = json_decode($isi, true);
        if (!is_array($j)) { $kosong['galat'] = 'isi berkas jeda tidak sah'; return $kosong; }
        return [
            'jeda'  => (bool)($j['jeda'] ?? false),
            'sebab' => (string)($j['sebab'] ?? ''),
            'oleh'  => isset($j['oleh']) ? (int)$j['oleh'] : null,
            'sejak' => isset($j['sejak']) ? (string)$j['sejak'] : null,
            'galat' => null,
        ];
    }

    /** Apakah sinyal baru sedang dijeda? (fungsi cepat untuk jalur tulis) */
    function qi_jeda_aktif(): bool
    {
        $s = qi_jeda_status();
        return $s['jeda'] === true;
    }

    /**
     * Ubah status jeda. Mengembalikan true bila tersimpan.
     * $idPengguna dicatat untuk audit (siapa yang menghentikan / melanjutkan).
     */
    function qi_jeda_set(bool $jeda, string $sebab = '', ?int $idPengguna = null): bool
    {
        $data = [
            'jeda'  => $jeda,
            'sebab' => mb_substr(trim($sebab), 0, 240),
            'oleh'  => $idPengguna,
            'sejak' => date('Y-m-d H:i:s'),
        ];
        $f = qi_jeda_berkas();
        $dir = dirname($f);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) return false;
        return @file_put_contents($f, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) !== false;
    }
}
