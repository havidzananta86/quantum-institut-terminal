<?php
/**
 * Brief pasar harian — GET (login). Dibuat sekali per hari WIB lalu disimpan (cache/brief_harian/Y-m-d.json),
 * jadi biaya AI tetap satu panggilan per hari berapa pun jumlah pengguna. Lihat api/_brief_harian.php.
 *
 * Jawaban: { status, tanggal, sumber: 'ai'|'otomatis', model?, teks, fakta, dibuat, catatan? }
 * Hasil OTOMATIS (AI gagal/belum diaktifkan) hanya disimpan 30 menit supaya AI dicoba lagi; hasil AI sehari penuh.
 */
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_brief_harian.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
qi_rate_limit(20, 60);
qi_require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Gunakan GET.']);
    exit();
}
echo json_encode(qi_brief_ambil(time()), JSON_UNESCAPED_UNICODE);
