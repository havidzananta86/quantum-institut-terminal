<?php
/**
 * Quantum Institut Market Terminal - Payment API
 * Handles Quantum+ Subscription Orders & Webhook Notifications
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

$plan = isset($input['plan']) ? $input['plan'] : '6 Bulan';
$priceMap = [
    '1 Bulan' => 55000,
    '3 Bulan' => 150000,
    '6 Bulan' => 270000,
    '12 Bulan' => 500000
];

$price = isset($priceMap[$plan]) ? $priceMap[$plan] : 270000;
$orderId = 'QI-ORD-' . date('Ymd') . '-' . rand(1000, 9999);
$licenseGenerated = 'QI-' . date('Y') . '-' . strtoupper(substr(md5(uniqid()), 0, 8));

echo json_encode([
    'status' => 'success',
    'message' => 'Pesanan Berhasil Dibuat.',
    'data' => [
        'order_id' => $orderId,
        'plan' => $plan,
        'amount_idr' => $price,
        'payment_methods' => ['QRIS', 'BCA Virtual Account', 'Mandiri VA', 'GoPay/OVO'],
        'qr_string' => '00020101021226580016ID.QUANTUMINSTITUT.WWW011893600911000000000052045812530336054062700005802ID5916QUANTUMINSTITUT6013JAKARTA SELATAN61051219062070703A016304E8A2',
        'generated_license_key' => $licenseGenerated,
        'expires_at' => date('Y-m-d H:i:s', strtotime('+15 minutes'))
    ]
], JSON_PRETTY_PRINT);
