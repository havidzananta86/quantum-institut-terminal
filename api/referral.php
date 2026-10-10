<?php
/**
 * #45 Referral System API
 * GET    — get user's referral code & stats
 * POST   — apply referral code
 *
 * Referral data stored in cache/referrals.json.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(20, 60);

$user = qi_require_auth();

$refFile = __DIR__ . '/../cache/referrals.json';
$allRefs = [];
if (file_exists($refFile)) {
    $allRefs = json_decode(file_get_contents($refFile), true) ?: [];
}

$userId = (string) $user['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($allRefs[$userId])) {
        $allRefs[$userId] = [
            'code' => 'QI-' . strtoupper(substr(md5($userId . 'quantum'), 0, 6)),
            'referrals' => [],
            'rewards' => 0,
        ];
        file_put_contents($refFile, json_encode($allRefs, JSON_PRETTY_PRINT), LOCK_EX);
    }

    $myRef = $allRefs[$userId];
    echo json_encode([
        'status' => 'success',
        'referral' => [
            'code' => $myRef['code'],
            'total_referrals' => count($myRef['referrals']),
            'rewards_earned' => $myRef['rewards'],
            'referral_link' => 'https://quantuminstitut.market/register.html?ref=' . $myRef['code'],
        ]
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = qi_get_json_body();
    $code = strtoupper(qi_sanitize_string($input['code'] ?? '', 20));
    if (!$code) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Kode referral diperlukan']);
        exit();
    }

    $referrerId = null;
    foreach ($allRefs as $uid => $data) {
        if (($data['code'] ?? '') === $code) {
            $referrerId = $uid;
            break;
        }
    }

    if (!$referrerId) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Kode referral tidak ditemukan']);
        exit();
    }

    if ($referrerId === $userId) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Tidak bisa menggunakan kode sendiri']);
        exit();
    }

    $existing = array_column($allRefs[$referrerId]['referrals'] ?? [], 'user_id');
    if (in_array($userId, $existing)) {
        echo json_encode(['status' => 'success', 'message' => 'Referral sudah tercatat sebelumnya']);
        exit();
    }

    $allRefs[$referrerId]['referrals'][] = [
        'user_id' => $userId,
        'date' => date('Y-m-d H:i:s'),
    ];
    $allRefs[$referrerId]['rewards'] = ($allRefs[$referrerId]['rewards'] ?? 0) + 1;
    file_put_contents($refFile, json_encode($allRefs, JSON_PRETTY_PRINT), LOCK_EX);

    echo json_encode(['status' => 'success', 'message' => 'Referral berhasil diterapkan!']);
    exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Method tidak diizinkan']);
