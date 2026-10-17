<?php
declare(strict_types=1);
/**
 * PENYAJIAN GAMBAR SNAPSHOT SINYAL (Tahap 1D).
 *
 * MENGAPA ADA: gambar disimpan di cache/charts/, dan folder cache/ DIBLOKIR dari
 * akses HTTP langsung oleh .htaccess (RewriteRule ... ^cache/ - [F,L]). Jadi gambar
 * tidak bisa diambil sembarangan; endpoint ini yang menyajikannya setelah memastikan
 * pemanggilnya punya sesi yang sah.
 *
 * CARA AUTHENTIKASI: tag <img> tidak bisa mengirim header Authorization, sehingga token
 * sesi diterima lewat parameter ?t= (pola yang sama seperti kunci webhook ?k=). Token
 * diperlakukan sebagai rahasia: endpoint ini TIDAK mencatatnya di log dan responsnya
 * diberi Cache-Control "private" supaya tidak disimpan di cache bersama.
 */

require_once __DIR__ . '/_middleware.php';
qi_rate_limit(180, 60);

// Token dari ?t= dipindahkan ke header Authorization supaya memakai pemeriksaan sesi
// yang SAMA dengan seluruh endpoint lain (tidak ada jalur autentikasi kedua).
$tokenUrl = trim((string)($_GET['t'] ?? ''));
if ($tokenUrl !== '' && empty($_SERVER['HTTP_AUTHORIZATION'])) {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $tokenUrl;
    $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] = 'Bearer ' . $tokenUrl;
}
if (!function_exists('qi_validate_token') || !qi_validate_token()) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Autentikasi diperlukan untuk melihat gambar sinyal.']);
    exit;
}

$id = trim((string)($_GET['id'] ?? ''));
if (!preg_match('/^SIG-[A-Za-z0-9\-]{4,60}$/', $id)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'ID sinyal tidak sah.']);
    exit;
}

$aman = preg_replace('/[^A-Za-z0-9\-]/', '', $id);
$dir  = __DIR__ . '/../cache/charts';
$jalur = null;
foreach (['png', 'jpg', 'jpeg', 'webp'] as $ext) {
    $kandidat = $dir . '/' . $aman . '.' . $ext;
    if (is_file($kandidat)) { $jalur = $kandidat; break; }
}
if ($jalur === null) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Belum ada snapshot untuk sinyal ini.']);
    exit;
}

$jenis = match (strtolower(pathinfo($jalur, PATHINFO_EXTENSION))) {
    'png'  => 'image/png',
    'jpg', 'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
    default => 'application/octet-stream',
};

header('Content-Type: ' . $jenis);
header('Content-Length: ' . (string)filesize($jalur));
header('Cache-Control: private, max-age=300');
header('X-Content-Type-Options: nosniff');
readfile($jalur);
exit;
