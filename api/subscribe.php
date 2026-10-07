<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

$input = qi_get_json_body();
$plan = is_array($input) && isset($input['plan']) ? qi_sanitize_string($input['plan'], 20) : '6 Bulan';

echo json_encode([
    'status' => 'success',
    'message' => "Order paket Quantum+ ($plan) berhasil dibuat",
    'order_id' => 'QI-ORD-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4))),
    'qr_code' => '00020101021226580016ID.QUANTUMINSTITUT.WWW'
]);
