<?php
declare(strict_types=1);
/**
 * UNGGAH SNAPSHOT CHART SINYAL (Tahap 1D — fondasi audit).
 *
 * MENGAPA: spesifikasi (Bagian 6) mewajibkan setiap sinyal disertai gambar chart
 * dengan area Entry/SL/TP, dan Bagian 8 meminta riwayat sinyal menampilkan thumbnail.
 *
 * CARA KERJA (yang disetujui pengguna: "snapshot dari peramban pengguna"):
 *   1. Peramban menggambar chart di canvas (chart terminal) lalu mengirim data URL PNG.
 *   2. Endpoint ini memvalidasi ukuran + jenis gambar, menyimpannya di cache/charts/
 *      (folder yang DIBLOKIR dari akses HTTP langsung oleh .htaccess), lalu menautkan
 *      URL penyajiannya ke jurnal sinyal.
 *
 * CATATAN JUJUR:
 *   · Chart milik TradingView TIDAK dapat diambil otomatis: widget-nya berada di iframe
 *     lintas domain, sehingga canvas-nya tidak bisa dibaca (aturan keamanan peramban).
 *     Untuk gambar TradingView, pengguna memakai fitur "snapshot" TradingView sendiri
 *     lalu menyimpannya. Yang diunggah di sini adalah chart TERMINAL (kanvas kita).
 *   · Server ini TIDAK memiliki ekstensi GD, jadi dimensi/pemrosesan gambar tidak
 *     dilakukan. Yang diperiksa hanya: ukuran maksimum dan tanda berkas (magic bytes).
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

qi_rate_limit(30, 60);      // unggah gambar dibatasi 30 kali per menit
qi_require_auth();          // wajib login
qi_require_level('pro');    // fitur PRO sesuai spesifikasi tier

function snap_jawab(int $kode, array $data): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    snap_jawab(405, ['status' => 'error', 'message' => 'Gunakan POST untuk mengunggah snapshot.']);
}

$badan = function_exists('qi_get_json_body') ? qi_get_json_body() : json_decode((string)file_get_contents('php://input'), true);
if (!is_array($badan)) {
    snap_jawab(400, ['status' => 'error', 'message' => 'Badan permintaan bukan JSON yang sah.']);
}

$idSinyal = trim((string)($badan['signal_id'] ?? ''));
if (!preg_match('/^SIG-[A-Za-z0-9\-]{4,60}$/', $idSinyal)) {
    snap_jawab(400, ['status' => 'error', 'message' => 'ID sinyal tidak sah (contoh: SIG-AUTO-20261013-ab12cd).']);
}

$gambar = (string)($badan['image'] ?? '');
if ($gambar === '') {
    snap_jawab(400, ['status' => 'error', 'message' => 'Gambar kosong. Kirim data URL PNG, mis. "data:image/png;base64,...".']);
}
// Terima data URL atau base64 murni.
if (preg_match('#^data:image/(png|jpeg);base64,#i', $gambar, $m)) {
    $jenis = strtolower($m[1]);
    $gambar = substr($gambar, strlen($m[0]));
} else {
    $jenis = 'png';
}
$gambar = preg_replace('/\s+/', '', $gambar);
$biner = base64_decode($gambar, true);
if ($biner === false || $biner === '') {
    snap_jawab(400, ['status' => 'error', 'message' => 'Data gambar tidak dapat dibaca sebagai base64.']);
}

// Batas 1,5 MB: cukup untuk chart 1280x720, jauh di bawah batas unggah hosting.
$maks = 1572864;
if (strlen($biner) > $maks) {
    snap_jawab(413, ['status' => 'error', 'message' => 'Gambar terlalu besar (' . round(strlen($biner) / 1024) . ' KB). Maksimum 1536 KB — kecilkan resolusi chart.']);
}
if (strlen($biner) < 512) {
    snap_jawab(400, ['status' => 'error', 'message' => 'Gambar terlalu kecil untuk dianggap chart yang sah.']);
}

// Periksa tanda berkas (magic bytes) — server tanpa GD tetap bisa memastikan jenisnya.
$png  = (substr($biner, 0, 8) === "\x89PNG\r\n\x1a\n");
$jpeg = (substr($biner, 0, 3) === "\xFF\xD8\xFF");
if (!$png && !$jpeg) {
    snap_jawab(415, ['status' => 'error', 'message' => 'Berkas bukan PNG atau JPEG yang sah (tanda berkas tidak cocok).']);
}
$ekstensi = $png ? 'png' : 'jpg';

// ── Simpan ke cache/charts/ (folder ini DIBLOKIR dari HTTP langsung) ──────────
$dir = __DIR__ . '/../cache/charts';
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    snap_jawab(500, ['status' => 'error', 'message' => 'Folder penyimpanan gambar tidak dapat dibuat.']);
}
$namaBerkas = preg_replace('/[^A-Za-z0-9\-]/', '', $idSinyal) . '.' . $ekstensi;
$jalur = $dir . '/' . $namaBerkas;
$lama = glob($dir . '/' . preg_replace('/[^A-Za-z0-9\-]/', '', $idSinyal) . '.*') ?: [];
foreach ($lama as $l) { if (is_file($l) && $l !== $jalur) @unlink($l); }   // ganti jenis berkas bila berubah
if (@file_put_contents($jalur, $biner, LOCK_EX) === false) {
    snap_jawab(500, ['status' => 'error', 'message' => 'Gambar gagal disimpan (periksa izin folder cache/charts).']);
}

// URL penyajian yang DISIMPAN tidak memuat token (token bersifat rahasia dan bisa
// berubah). Peramban menambahkan ?t= sesi saat menampilkan gambar.
$url = 'api/chart-image.php?id=' . rawurlencode($idSinyal);

// ── Tautkan ke jurnal (bila tabelnya tersedia) ────────────────────────────────
$tertaut = false;
$catatan = '';
try {
    require_once __DIR__ . '/_journal.php';
    if (qi_journal_tersedia(true, false)) {
        if (!function_exists('getDBConnection')) require_once __DIR__ . '/../config/database.php';
        $st = getDBConnection()->prepare('UPDATE `ai_signal_journal` SET `chart_image_url` = ? WHERE `id` = ?');
        $st->execute([$url, $idSinyal]);
        $tertaut = ($st->rowCount() > 0);
        if (!$tertaut) $catatan = 'Gambar tersimpan, tetapi sinyal ini belum ada di jurnal (tautan belum tercatat).';
    } else {
        $catatan = 'Jurnal database belum tersedia — gambar tersimpan tanpa tautan di jurnal.';
    }
} catch (Throwable $e) {
    $catatan = 'Gambar tersimpan, tetapi penautan ke jurnal gagal: ' . $e->getMessage();
    @error_log('[snapshot] taut gagal: ' . $e->getMessage());
}

snap_jawab(200, [
    'status'  => 'success',
    'message' => $tertaut
        ? 'Snapshot tersimpan dan tertaut ke sinyal.'
        : ('Snapshot tersimpan.' . ($catatan !== '' ? ' ' . $catatan : '')),
    'signal_id' => $idSinyal,
    'jenis'     => $ekstensi,
    'ukuran'    => strlen($biner),
    'url'       => '/api/chart-image.php?id=' . rawurlencode($idSinyal),
    'tertaut'   => $tertaut,
]);
