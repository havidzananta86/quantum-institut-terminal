<?php
declare(strict_types=1);
/**
 * Bantuan halaman Transparansi (api/transparansi.php).
 *
 * STATUS PEMINDAI Pine SMC+SnD (audit sinyal 2026-10-22): qi_pine_pindai() hanya dipanggil oleh
 * api/maintenance-cron.php — tidak ada pemicu dari dashboard seperti penilai, pembangkit, dan
 * sinyal bayangan. Di produksi cron belum pernah berjalan, jadi cache/pine_signals.json tidak
 * pernah bertambah, sementara halaman publik menulis "Dicatat otomatis" tanpa umur pemindai.
 * Fungsi di sini melaporkan umur pemindaian terakhir dan status cron apa adanya.
 */

if (!function_exists('qi_tr_status_pemindai')) :

/**
 * Keputusan murni dari waktu pemindaian terakhir.
 * @param int|null $tPindai    epoch pemindaian terakhir (mtime penanda), null = belum pernah
 * @param string   $statusCron 'ok' | 'basi' | 'belum_pernah' (qi_cron_status)
 * @return array{terakhir: ?string, umur_detik: ?int, status: string, cron: string, kalimat: string}
 */
function qi_tr_status_pemindai(?int $tPindai, string $statusCron, int $kini, int $batas = 2700): array
{
    if ($tPindai === null || $tPindai <= 0) {
        return ['terakhir' => null, 'umur_detik' => null, 'status' => 'belum_pernah', 'cron' => $statusCron,
                'kalimat' => 'Pemindai belum pernah berjalan di server ini (cron pemeliharaan '
                    . ($statusCron === 'belum_pernah' ? 'belum terpasang' : 'tidak menjalankannya')
                    . '), jadi daftar ini belum bertambah.'];
    }
    $umur = max(0, $kini - $tPindai);
    $teksUmur = $umur < 3600 ? ((int)round($umur / 60) . ' menit') : ($umur < 172800 ? ((int)round($umur / 3600) . ' jam') : ((int)round($umur / 86400) . ' hari'));
    $basi = $umur > $batas;
    return ['terakhir' => gmdate('Y-m-d\TH:i:s\Z', $tPindai), 'umur_detik' => $umur, 'status' => $basi ? 'basi' : 'ok', 'cron' => $statusCron,
            'kalimat' => $basi
                ? ('Pemindai terakhir berjalan ' . $teksUmur . ' lalu — daftar ini mungkin tertinggal sampai cron berjalan lagi.')
                : ('Pemindai terakhir berjalan ' . $teksUmur . ' lalu.')];
}

/** Status pemindai dari berkas penanda (cache/pine_scan_auto.txt) + detak cron pemeliharaan. */
function qi_transparansi_pemindai(string $berkasPenanda, int $kini): array
{
    $t = is_file($berkasPenanda) ? (int)@filemtime($berkasPenanda) : 0;
    $statusCron = 'belum_pernah';
    try {
        if (!function_exists('qi_cron_status')) require_once __DIR__ . '/_detak_cron.php';
        $statusCron = (string)(qi_cron_status(qi_cron_baca(''), $kini)['status'] ?? 'belum_pernah');
    } catch (Throwable $e) {
        @error_log('[transparansi] status cron dilewati: ' . $e->getMessage());
    }
    return qi_tr_status_pemindai($t > 0 ? $t : null, $statusCron, $kini);
}

endif;
