<?php
declare(strict_types=1);
/**
 * ENDPOINT SAKLAR JEDA SINYAL (PAUSE DARURAT) — Tahap 4.
 *
 * GET  api/signal-jeda.php            → status jeda (PRO ke atas)
 * POST api/signal-jeda.php  {jeda: true|false, sebab: "..."}  → ubah status (ADMIN saja)
 *
 * MENGAPA ADMIN untuk mengubah: menghentikan atau melanjutkan penerbitan sinyal adalah
 * tindakan operasional yang berdampak ke semua pengguna, jadi tidak boleh dilakukan
 * sembarang akun. Siapa yang mengubah dan kapan ikut dicatat.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_jeda.php';
qi_rate_limit(30, 60);

function jeda_jawab(int $kode, array $data): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$status = qi_jeda_status();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    qi_require_level('pro');
    jeda_jawab(200, [
        'status'  => 'ok',
        'jeda'    => $status['jeda'],
        'sebab'   => $status['sebab'],
        'sejak'   => $status['sejak'],
        'catatan' => $status['jeda']
            ? 'Sinyal BARU sedang dijeda. Rekor lama tetap utuh dan penilaian TP/SL tetap berjalan.'
            : 'Sinyal baru sedang diterbitkan normal.',
        'galat'   => $status['galat'],
    ]);
}

// ── Mengubah status: hanya ADMIN ──────────────────────────────────────────────
qi_require_admin();

$badan = function_exists('qi_get_json_body') ? qi_get_json_body() : json_decode((string)file_get_contents('php://input'), true);
if (!is_array($badan) || !array_key_exists('jeda', $badan)) {
    jeda_jawab(400, ['status' => 'error', 'message' => 'Kirim JSON {"jeda": true|false, "sebab": "..."}.']);
}

$jedaBaru = (bool)$badan['jeda'];
$sebab    = trim((string)($badan['sebab'] ?? ''));

// Jeda WAJIB punya alasan: jeda tanpa alasan tidak dapat diaudit dan membingungkan.
if ($jedaBaru && mb_strlen($sebab) < 3) {
    jeda_jawab(400, ['status' => 'error', 'message' => 'Alasan jeda wajib diisi (minimal 3 huruf) supaya tindakan ini dapat diaudit.']);
}

$pengguna = function_exists('qi_validate_token') ? qi_validate_token() : null;
$idPengguna = is_array($pengguna) ? (int)($pengguna['id'] ?? 0) : null;

if (!qi_jeda_set($jedaBaru, $sebab, $idPengguna)) {
    jeda_jawab(500, ['status' => 'error', 'message' => 'Status jeda gagal disimpan (periksa izin folder cache/).']);
}

$baru = qi_jeda_status();
jeda_jawab(200, [
    'status'  => 'success',
    'jeda'    => $baru['jeda'],
    'sebab'   => $baru['sebab'],
    'sejak'   => $baru['sejak'],
    'message' => $baru['jeda']
        ? 'Sinyal BARU dihentikan. Rekor lama tidak dihapus dan penilaian TP/SL tetap berjalan.'
        : 'Penerbitan sinyal baru dilanjutkan.',
]);
