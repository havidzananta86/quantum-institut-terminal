<?php
/**
 * DETAK CRON — tanda bahwa api/maintenance-cron.php benar-benar berjalan.
 *
 * MENGAPA: penilaian TP/SL, sinyal bayangan, pemindai Pine, dan brief AI harian semuanya
 * menumpang cron 15 menit. Bila cron berhenti (hosting mengubah jadwal, PHP CLI salah
 * versi, kunci cron diganti), tidak ada yang error — semuanya diam-diam berhenti dan
 * rekor tampak "AKTIF" selamanya. Detak ini membuat berhentinya terlihat:
 *   · cron menulis cache/cron_heartbeat.json di akhir setiap putaran;
 *   · api/health.php melapor umur detak; bila cron PERNAH jalan lalu berhenti > 45 menit,
 *     status menjadi degraded (pemantau uptime ikut berbunyi) dan admin diberi tahu lewat
 *     Telegram paling sering sekali per 6 jam.
 *   · Belum pernah ada detak (cron belum dipasang) → dilaporkan, tetapi TIDAK membuat 503
 *     permanen — sama seperti fitur opsional lain di health.php.
 */
declare(strict_types=1);

if (!function_exists('qi_cron_status')) :

/**
 * Berkas detak per cron. Nama kosong = cron pemeliharaan (berkas lama, dipertahankan apa
 * adanya supaya detak yang sudah tercatat tidak hilang saat versi ini dipasang).
 *
 * MENGAPA PER CRON: sampai 2026-10-21 hanya maintenance-cron yang menulis detak, sehingga
 * ai-cron (sinyal + paper trade) dan alert-cron (price alert) bisa berhenti berminggu-minggu
 * tanpa ada yang tahu — persis masalah yang detak ini diciptakan untuk mencegah.
 */
function qi_cron_berkas(string $nama = ''): string
{
    $bersih = preg_replace('/[^a-z0-9_-]/', '', strtolower($nama));
    return __DIR__ . '/../cache/cron_heartbeat' . ($bersih !== '' ? '_' . $bersih : '') . '.json';
}

/** Cron yang punya detak sendiri: nama berkas => label untuk laporan health. */
function qi_cron_daftar(): array
{
    return ['' => 'pemeliharaan', 'ai' => 'sinyal AI & paper trade', 'alert' => 'price alert'];
}

/**
 * Keputusan murni dari isi detak.
 * @return array{status:string, umur_s:?int, terakhir:?string, basi:bool}
 *   status: 'ok' | 'basi' | 'belum_pernah'
 */
function qi_cron_status(?array $detak, int $kini, int $batas = 2700): array
{
    $t = isset($detak['t']) ? (int)$detak['t'] : 0;
    if ($t <= 0) return ['status' => 'belum_pernah', 'umur_s' => null, 'terakhir' => null, 'basi' => false];
    $umur = max(0, $kini - $t);
    return ['status' => $umur > $batas ? 'basi' : 'ok', 'umur_s' => $umur, 'terakhir' => gmdate('Y-m-d\TH:i:s\Z', $t), 'basi' => $umur > $batas];
}

function qi_cron_baca(string $nama = ''): ?array
{
    $f = qi_cron_berkas($nama);
    if (!is_file($f)) return null;
    $d = json_decode((string)@file_get_contents($f), true);
    return is_array($d) ? $d : null;
}

/** Ditulis di akhir setiap cron. $ringkas: beberapa angka hasil putaran (tanpa data pribadi). */
function qi_cron_detak(array $ringkas = [], string $nama = ''): void
{
    $isi = json_encode(['t' => time(), 'ringkas' => $ringkas], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($isi !== false) @file_put_contents(qi_cron_berkas($nama), $isi, LOCK_EX);
}

/** Beri tahu admin lewat Telegram bila cron basi — paling sering sekali per $jeda detik. */
function qi_cron_alarm(array $status, int $jeda = 21600): ?array
{
    if (empty($status['basi'])) return null;
    $penanda = __DIR__ . '/../cache/cron_alarm.txt';
    if (is_file($penanda) && (time() - (int)@filemtime($penanda)) < $jeda) return ['dikirim' => false, 'alasan' => 'sudah_diberi_tahu'];
    @file_put_contents($penanda, (string)time(), LOCK_EX);
    try {
        if (!function_exists('qi_telegram_kirim')) require_once __DIR__ . '/_telegram.php';
        $menit = (int)round(((int)$status['umur_s']) / 60);
        $h = qi_telegram_kirim("⚠️ Quantum Institut: cron pemeliharaan tidak berjalan selama {$menit} menit (terakhir {$status['terakhir']}).\n"
            . "Penilaian TP/SL, sinyal bayangan, pemindai Pine, dan brief harian ikut berhenti. Periksa jadwal Cron Jobs di hosting.");
        return ['dikirim' => !empty($h['ok']), 'alasan' => (string)($h['pesan'] ?? '')];
    } catch (Throwable $e) {
        return ['dikirim' => false, 'alasan' => $e->getMessage()];
    }
}

endif;
