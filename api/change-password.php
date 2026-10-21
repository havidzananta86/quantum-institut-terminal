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

require_once __DIR__ . '/_password_publik.php';
if (qi_password_publik_berlaku() && qi_password_publik($newPw)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi ini diketahui publik. Pilih kata sandi lain.']);
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

    // MENGGANTI KATA SANDI HARUS MENGUSIR PERANGKAT LAIN.
    // Token sesi berumur 30 hari dan disimpan di localStorage. Kalau seseorang memakai
    // terminal di komputer bersama lalu tokennya tersalin, mengganti kata sandi sebelumnya
    // TIDAK memutus akses penyerang sama sekali — ia tetap masuk sampai token kedaluwarsa
    // sendiri. Itu perilaku yang orang anggap pasti ada, jadi sekarang benar-benar ada.
    // Sesi yang sedang dipakai sengaja DIPERTAHANKAN supaya pengguna tidak terlempar keluar
    // tepat setelah berhasil mengganti kata sandinya sendiri.
    $sesiDicabut = 0;
    try {
        $tokenIni = function_exists('qi_token_mentah') ? qi_token_mentah() : null;
        if ($tokenIni !== null) {
            $cabut = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :id AND token <> :token');
            $cabut->execute([':id' => $user['user_id'], ':token' => hash('sha256', $tokenIni)]);
        } else {
            // Token tidak terbaca (jalur tak terduga) → lebih aman cabut SEMUA sesi
            // daripada meninggalkan token curian tetap hidup.
            $cabut = $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :id');
            $cabut->execute([':id' => $user['user_id']]);
        }
        $sesiDicabut = $cabut->rowCount();
        if (function_exists('qi_log')) qi_log('warning', 'Kata sandi diganti, sesi lain dicabut', ['user_id' => (int)$user['user_id'], 'sesi_dicabut' => $sesiDicabut]);
    } catch (Throwable $e) {
        error_log('[QI ChangePassword] Pencabutan sesi gagal: ' . $e->getMessage());
    }

    echo json_encode([
        'status'       => 'success',
        'message'      => $sesiDicabut > 0
            ? "Kata sandi berhasil diubah. $sesiDicabut perangkat lain telah dikeluarkan."
            : 'Kata sandi berhasil diubah.',
        'sesi_dicabut' => $sesiDicabut,
    ]);

} catch (PDOException $e) {
    error_log('[QI ChangePassword] DB error: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Layanan tidak tersedia. Coba lagi nanti.']);
}
