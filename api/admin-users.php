<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$user = qi_require_admin();

$method = $_SERVER['REQUEST_METHOD'];

// GET — list users
if ($method === 'GET') {
    $search = isset($_GET['q'])      ? qi_sanitize_string($_GET['q'], 100) : '';
    $limit  = min((int)($_GET['limit']  ?? 50), 100);
    $offset = (int)($_GET['offset'] ?? 0);

    try {
        $pdo = qi_db();
        if ($search) {
            $stmt = $pdo->prepare(
                'SELECT id, email, role, is_active, created_at FROM users WHERE email LIKE :q ORDER BY created_at DESC LIMIT :lim OFFSET :off'
            );
            $stmt->bindValue(':q', '%' . $search . '%');
        } else {
            $stmt = $pdo->prepare(
                'SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT :lim OFFSET :off'
            );
        }
        $stmt->bindValue(':lim', $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $cStmt = $pdo->prepare($search
            ? 'SELECT COUNT(*) FROM users WHERE email LIKE :q'
            : 'SELECT COUNT(*) FROM users');
        if ($search) $cStmt->bindValue(':q', '%' . $search . '%');
        $cStmt->execute();
        $total = (int)$cStmt->fetchColumn();

        // Summary stats
        $stats = $pdo->query('SELECT role, COUNT(*) AS cnt FROM users GROUP BY role')->fetchAll(PDO::FETCH_ASSOC);
        $roleCounts = ['user'=>0,'pro'=>0,'admin'=>0];
        foreach ($stats as $s) $roleCounts[$s['role']] = (int)$s['cnt'];

        echo json_encode(['status'=>'success','users'=>$users,'total'=>$total,'stats'=>$roleCounts]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status'=>'error','message'=>'Database error']);
    }
    exit;
}

// POST — mutations
if ($method === 'POST') {
    $input = qi_get_json_body();
    $type  = isset($input['type']) ? qi_sanitize_string($input['type'], 30) : '';

    if ($type === 'set_role') {
        $targetId = (int)($input['user_id'] ?? 0);
        $newRole  = isset($input['role']) ? qi_sanitize_string($input['role'], 20) : '';
        if (!$targetId || !in_array($newRole, ['user','pro','admin'], true)) {
            http_response_code(400);
            echo json_encode(['status'=>'error','message'=>'Parameter tidak valid']);
            exit;
        }
        if ($targetId === (int)$user['user_id'] && $newRole !== 'admin') {
            http_response_code(400);
            echo json_encode(['status'=>'error','message'=>'Tidak bisa mengubah role akun sendiri']);
            exit;
        }
        try {
            $pdo  = qi_db();
            $stmt = $pdo->prepare('UPDATE users SET role = :role WHERE id = :id');
            $stmt->execute([':role'=>$newRole, ':id'=>$targetId]);
            echo json_encode(['status'=>'success']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status'=>'error','message'=>'Database error']);
        }
        exit;
    }

    if ($type === 'toggle_active') {
        $targetId = (int)($input['user_id'] ?? 0);
        if (!$targetId || $targetId === (int)$user['user_id']) {
            http_response_code(400);
            echo json_encode(['status'=>'error','message'=>'Parameter tidak valid']);
            exit;
        }
        try {
            $pdo  = qi_db();
            $stmt = $pdo->prepare('UPDATE users SET is_active = 1 - is_active WHERE id = :id');
            $stmt->execute([':id'=>$targetId]);
            $sNew = $pdo->prepare('SELECT is_active FROM users WHERE id = :id');
            $sNew->execute([':id'=>$targetId]);
            echo json_encode(['status'=>'success','is_active'=>(int)$sNew->fetchColumn()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status'=>'error','message'=>'Database error']);
        }
        exit;
    }
}

http_response_code(405);
echo json_encode(['status'=>'error','message'=>'Method not allowed']);
