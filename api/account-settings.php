<?php
/**
 * #44 Account Settings API
 * GET: return user profile settings
 * POST: update name, phone, notification preferences
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$user = qi_require_auth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = qi_db();
        $stmt = $pdo->prepare('SELECT full_name, email, phone_number, role, created_at FROM users WHERE id = :id');
        $stmt->execute([':id' => $user['user_id']]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$profile) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'User tidak ditemukan']);
            exit();
        }
        echo json_encode(['status' => 'success', 'profile' => [
            'full_name' => $profile['full_name'],
            'email' => $profile['email'],
            'phone' => $profile['phone_number'],
            'role' => $profile['role'],
            'member_since' => $profile['created_at'],
        ]]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Gagal memuat profil']);
    }
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = qi_get_json_body();
    if (!$input) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Input tidak valid']);
        exit();
    }

    try {
        $pdo = qi_db();
        $updates = [];
        $params = [':id' => $user['user_id']];

        if (isset($input['full_name'])) {
            $name = qi_sanitize_string($input['full_name'], 100);
            if (strlen($name) < 2) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Nama minimal 2 karakter']);
                exit();
            }
            $updates[] = 'full_name = :name';
            $params[':name'] = $name;
        }

        if (isset($input['phone_number'])) {
            $phone = preg_replace('/[^0-9+\-\s]/', '', $input['phone_number']);
            $phone = qi_sanitize_string($phone, 20);
            $updates[] = 'phone_number = :phone';
            $params[':phone'] = $phone;
        }

        if (empty($updates)) {
            echo json_encode(['status' => 'success', 'message' => 'Tidak ada perubahan']);
            exit();
        }

        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'message' => 'Profil berhasil diperbarui']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Gagal memperbarui profil']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Method tidak diizinkan']);
