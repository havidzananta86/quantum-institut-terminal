<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$input = json_decode(file_get_contents('php://input'), true);
$plan = isset($input['plan']) ? $input['plan'] : '6 Bulan';

echo json_encode([
    'status' => 'success',
    'message' => "Order paket Quantum+ ($plan) berhasil dibuat",
    'order_id' => 'QI-ORD-' . date('Ymd') . '-' . rand(1000, 9999),
    'qr_code' => '00020101021226580016ID.QUANTUMINSTITUT.WWW'
]);
