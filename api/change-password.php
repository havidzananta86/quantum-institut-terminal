<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';

qi_rate_limit(5, 900);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit();

$user = qi_require_auth();
$input = qi_get_json_body();

if (!$input) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body JSON tidak valid.']);
    exit();
}

$currentPw = $input['current_password'] ?? '';
$newPw     = $input['new_password'] ?? '';

if ($currentPw === '' || $newPw === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi lama dan baru wajib diisi.']);
    exit();
}

if (strlen($newPw) < 8) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi baru minimal 8 karakter.']);
    exit();
}

if ($currentPw === $newPw) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi baru harus berbeda dari yang lama.']);
    exit();
}

try {
    $pdo = qi_db();

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $user['user_id']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($currentPw, $row['password_hash'])) {
        usleep(random_int(500000, 1500000));
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Kata sandi lama tidak sesuai.']);
        exit();
    }

    $newHash = password_hash($newPw, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
    $stmt->execute([':hash' => $newHash, ':id' => $user['user_id']]);

    echo json_encode(['status' => 'success', 'message' => 'Kata sandi berhasil diubah.']);

} catch (PDOException $e) {
    error_log('[QI ChangePassword] DB error: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Layanan tidak tersedia. Coba lagi nanti.']);
}
