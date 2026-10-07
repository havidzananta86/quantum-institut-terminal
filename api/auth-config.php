<?php
/**
 * Public auth config — dibaca login.html (file statis) untuk tahu
 * apakah Google Sign-In aktif. Client ID OAuth itu publik (memang
 * tertanam di sisi klien), jadi aman diekspos. TIDAK ada secret di sini.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

$clientId = '';
$cfg = __DIR__ . '/../config/api_keys.php';
if (file_exists($cfg)) {
    require_once $cfg;
    if (defined('GOOGLE_CLIENT_ID')) $clientId = GOOGLE_CLIENT_ID;
}

echo json_encode([
    'status' => 'success',
    'data'   => [
        'google_enabled'   => $clientId !== '',
        'google_client_id' => $clientId,
    ],
]);
