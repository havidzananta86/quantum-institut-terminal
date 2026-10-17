<?php
declare(strict_types=1);
/**
 * ENDPOINT SAKLAR GERBANG KONFLUENSI MESIN (syarat minimal 3 mesin searah).
 *
 * GET  api/signal-gerbang.php   → status gerbang + ringkasan penilaian simbol contoh (PRO)
 * POST api/signal-gerbang.php   {aktif: true|false, sebab: "..."}  → ubah (ADMIN saja)
 *
 * MENGAPA dipisah dari saklar jeda: jeda menghentikan SEMUA sinyal (keadaan darurat),
 * sedangkan gerbang hanya menyaring mutu sinyal. Dua hal berbeda, dua kendali berbeda —
 * mencampurnya akan membingungkan saat keadaan darurat.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_gerbang.php';
qi_rate_limit(30, 60);

function gb_jawab(int $kode, array $data): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    qi_require_level('pro');
    $s = qi_gerbang_status();
    gb_jawab(200, [
        'status'  => 'ok',
        'aktif'   => $s['aktif'],
        'sebab'   => $s['sebab'],
        'sejak'   => $s['sejak'],
        'aturan'  => 'Gerbang menilai hanya bila mesin tersedia ≥ 5. Bila mesin searah < 3, sinyal DITOLAK. Bila data TradingView gagal diambil, gerbang TIDAK memblokir (fail-open) dan alasannya dicatat.',
        'catatan' => $s['aktif']
            ? 'Gerbang AKTIF: sinyal baru wajib punya minimal 3 mesin searah. Jumlah sinyal bisa berkurang — itu memang tujuannya.'
            : 'Gerbang NONAKTIF: sinyal baru diterbitkan tanpa penyaringan konfluensi mesin. Hasil penilaian tetap dicatat di kolom basis.',
    ]);
}

qi_require_admin();
$badan = function_exists('qi_get_json_body') ? qi_get_json_body() : json_decode((string)file_get_contents('php://input'), true);
if (!is_array($badan) || !array_key_exists('aktif', $badan)) {
    gb_jawab(400, ['status' => 'error', 'message' => 'Kirim JSON {"aktif": true|false, "sebab": "..."}.']);
}
$aktif = (bool)$badan['aktif'];
$sebab = trim((string)($badan['sebab'] ?? ''));
if (!$aktif && mb_strlen($sebab) < 3) {
    gb_jawab(400, ['status' => 'error', 'message' => 'Alasan wajib diisi (minimal 3 huruf) saat mematikan gerbang — supaya tindakan ini dapat diaudit.']);
}
$pengguna = function_exists('qi_validate_token') ? qi_validate_token() : null;
if (!qi_gerbang_set($aktif, $sebab, is_array($pengguna) ? (int)($pengguna['id'] ?? 0) : null)) {
    gb_jawab(500, ['status' => 'error', 'message' => 'Status gerbang gagal disimpan (periksa izin folder cache/).']);
}
$s = qi_gerbang_status();
gb_jawab(200, [
    'status'  => 'success',
    'aktif'   => $s['aktif'],
    'sebab'   => $s['sebab'],
    'sejak'   => $s['sejak'],
    'message' => $s['aktif']
        ? 'Gerbang AKTIF: sinyal baru wajib minimal 3 mesin searah.'
        : 'Gerbang NONAKTIF: penyaringan konfluensi mesin dimatikan (penilaian tetap dicatat).',
]);
