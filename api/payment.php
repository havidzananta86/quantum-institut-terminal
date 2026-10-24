<?php
/** Payment boundary: fails closed until a real provider is configured. */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(10, 3600);

function qi_payment_error(int $status, string $message, string $code): void {
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message, 'code' => $code]);
    exit();
}

function qi_payment_configured(): bool {
    $configPath = __DIR__ . '/../config/api_keys.php';
    if (!file_exists($configPath)) return false;
    require_once $configPath;
    return defined('QI_PAYMENT_PROVIDER') && defined('QI_PAYMENT_WEBHOOK_SECRET')
        && QI_PAYMENT_PROVIDER !== '' && strlen(QI_PAYMENT_WEBHOOK_SECRET) >= 32
        && !str_contains(QI_PAYMENT_WEBHOOK_SECRET, 'ISI_');
}

function qi_payment_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 65536) qi_payment_error(413, 'Payload tidak valid atau terlalu besar.', 'PAYMENT_PAYLOAD_INVALID');
    $body = json_decode($raw, true);
    if (!is_array($body)) qi_payment_error(400, 'Body JSON tidak valid.', 'PAYMENT_JSON_INVALID');
    return [$raw, $body];
}

function qi_plan_months(string $plan): int {
    return match ($plan) {
        '1 Bulan' => 1, '3 Bulan' => 3, '6 Bulan' => 6, '12 Bulan' => 12, default => 0,
    };
}

$action = qi_sanitize_string($_GET['action'] ?? 'create_order', 30);
if ($action !== 'webhook') {
    // Never return a placeholder QR code or invoice. A provider adapter must
    // create the bill before checkout can be enabled.
    if (!qi_payment_configured()) qi_payment_error(503, 'Pembayaran online belum tersedia.', 'PAYMENT_NOT_CONFIGURED');
    qi_payment_error(501, 'Adapter gateway pembayaran belum diimplementasikan.', 'PAYMENT_PROVIDER_ADAPTER_MISSING');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qi_payment_error(405, 'Webhook hanya menerima POST.', 'PAYMENT_METHOD_NOT_ALLOWED');
if (!qi_payment_configured()) {
    qi_log('warning', 'Rejected payment webhook because provider is not configured');
    qi_payment_error(503, 'Gateway pembayaran belum dikonfigurasi.', 'PAYMENT_NOT_CONFIGURED');
}

[$raw, $input] = qi_payment_body();
$providedSignature = $_SERVER['HTTP_X_QI_WEBHOOK_SIGNATURE'] ?? '';
$expectedSignature = hash_hmac('sha256', $raw, QI_PAYMENT_WEBHOOK_SECRET);
if (!$providedSignature || !hash_equals($expectedSignature, $providedSignature)) {
    qi_log('warning', 'Rejected payment webhook with invalid signature');
    qi_payment_error(401, 'Signature webhook tidak valid.', 'PAYMENT_SIGNATURE_INVALID');
}

$eventId = qi_sanitize_string($input['event_id'] ?? '', 100);
$orderCode = qi_sanitize_string($input['order_id'] ?? $input['order_code'] ?? '', 50);
$status = strtolower(qi_sanitize_string($input['status'] ?? $input['transaction_status'] ?? '', 30));
$amount = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
if (!$eventId || !$orderCode || $amount === false || $amount <= 0) qi_payment_error(400, 'Webhook tidak lengkap.', 'PAYMENT_WEBHOOK_INVALID');
if (!in_array($status, ['paid', 'settlement', 'capture', 'success'], true)) {
    echo json_encode(['status' => 'accepted', 'message' => 'Status pembayaran belum final.']);
    exit();
}

try {
    $pdo = qi_db();
    $pdo->beginTransaction();
    $event = $pdo->prepare('SELECT id FROM payment_events WHERE provider = :provider AND provider_event_id = :event LIMIT 1 FOR UPDATE');
    $event->execute([':provider' => QI_PAYMENT_PROVIDER, ':event' => $eventId]);
    if ($event->fetch()) {
        $pdo->commit();
        echo json_encode(['status' => 'accepted', 'message' => 'Webhook sudah diproses.']);
        exit();
    }

    $stmt = $pdo->prepare('SELECT * FROM subscription_orders WHERE order_code = :code LIMIT 1 FOR UPDATE');
    $stmt->execute([':code' => $orderCode]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) { $pdo->rollBack(); qi_payment_error(404, 'Pesanan tidak ditemukan.', 'PAYMENT_ORDER_NOT_FOUND'); }
    if (abs((float)$order['amount_idr'] - (float)$amount) > 0.01) { $pdo->rollBack(); qi_payment_error(400, 'Nominal pembayaran tidak cocok.', 'PAYMENT_AMOUNT_MISMATCH'); }
    if (empty($order['user_id'])) { $pdo->rollBack(); qi_payment_error(409, 'Pesanan belum terhubung ke akun pengguna.', 'PAYMENT_USER_REQUIRED'); }

    $pdo->prepare('INSERT INTO payment_events (provider, provider_event_id, order_code, received_at) VALUES (:provider, :event, :order, NOW())')
        ->execute([':provider' => QI_PAYMENT_PROVIDER, ':event' => $eventId, ':order' => $orderCode]);
    if (!(int)$order['license_issued']) {
        $months = qi_plan_months($order['plan_name']);
        if ($months === 0) { $pdo->rollBack(); qi_payment_error(422, 'Paket pesanan tidak valid.', 'PAYMENT_PLAN_INVALID'); }
        // Dihitung MySQL: expires_at dibandingkan dengan NOW() MySQL, bukan jam PHP.
        // Perpanjangan dihitung dari lisensi aktif terakhir (bila masih berjalan), bukan dari hari ini —
        // kalau tidak, sisa masa langganan pelanggan yang memperpanjang lebih awal hangus.
        $sisa = $pdo->prepare('SELECT GREATEST(NOW(), COALESCE(MAX(expires_at), NOW())) FROM license_keys WHERE user_id = :uid AND is_active = 1');
        $sisa->execute([':uid' => $order['user_id']]);
        $mulai = (string)$sisa->fetchColumn();
        $pdo->prepare('INSERT INTO license_keys (user_id, license_key, plan_name, expires_at, is_active) VALUES (:uid, :key, :plan, DATE_ADD(:mulai, INTERVAL :months MONTH), 1)')
            ->execute([':uid' => $order['user_id'], ':key' => 'QI-PRO-' . strtoupper(bin2hex(random_bytes(8))), ':plan' => $order['plan_name'], ':mulai' => $mulai, ':months' => (int)$months]);
        // Hanya NAIK ke pro: VIP/admin yang membeli paket PRO tidak boleh turun peran.
        $pdo->prepare("UPDATE users SET role = 'pro' WHERE id = :uid AND role NOT IN ('pro', 'premium', 'vip', 'vip_plus', 'elite', 'admin')")->execute([':uid' => $order['user_id']]);
    }
    $pdo->prepare("UPDATE subscription_orders SET payment_status = 'paid', paid_at = NOW(), license_issued = 1 WHERE id = :id")
        ->execute([':id' => $order['id']]);
    $pdo->commit();
    qi_log('info', 'Payment settled and subscription activated', ['order_code' => $orderCode]);
    echo json_encode(['status' => 'accepted', 'message' => 'Pembayaran berhasil diproses.']);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    qi_log('error', 'Payment webhook processing failed', ['exception' => get_class($e)]);
    qi_payment_error(500, 'Gagal memproses pembayaran.', 'PAYMENT_PROCESSING_FAILED');
}
