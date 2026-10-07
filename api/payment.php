<?php
/**
 * Quantum Institut Market Terminal - Payment API (SECURED)
 * Handles Quantum+ Subscription Orders & Webhook Notifications
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

// Rate limit ketat pembuatan invoice order (10 per jam per IP)
qi_rate_limit(10, 3600);

$input = qi_get_json_body();
if (!$input) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Format request tidak valid.']);
    exit();
}

$plan = isset($input['plan']) ? qi_sanitize_string($input['plan'], 20) : '6 Bulan';
$priceMap = [
    '1 Bulan' => 55000,
    '3 Bulan' => 150000,
    '6 Bulan' => 270000,
    '12 Bulan' => 500000
];

$price = isset($priceMap[$plan]) ? $priceMap[$plan] : 270000;
$orderId = 'QI-ORD-' . date('Ymd') . '-' . rand(1000, 9999);

// PENTING: Lisensi TIDAK DIBERIKAN sebelum status pembayaran = SUCCESS via Webhook verifikasi!
echo json_encode([
    'status' => 'success',
    'message' => 'Tagihan Pesanan Berhasil Dibuat. Silakan selesaikan pembayaran.',
    'data' => [
        'order_id' => $orderId,
        'plan' => $plan,
        'amount_idr' => $price,
        'payment_status' => 'PENDING_PAYMENT',
        'payment_methods' => ['QRIS', 'BCA Virtual Account', 'Mandiri VA', 'GoPay/OVO'],
        'qr_string' => '00020101021226580016ID.QUANTUMINSTITUT.WWW011893600911000000000052045812530336054062700005802ID5916QUANTUMINSTITUT6013JAKARTA SELATAN61051219062070703A016304E8A2',
        'expires_at' => date('Y-m-d H:i:s', strtotime('+15 minutes')),
        'note' => 'Kunci lisensi aktif akan dikirimkan otomatis setelah pembayaran terverifikasi oleh gateway.'
    ]
], JSON_PRETTY_PRINT);
exit();
