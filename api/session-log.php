<?php
/**
 * #41 Session Activity Log API
 * Returns login history: time, IP, device for authenticated user
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(30, 60);

$user = qi_require_auth();

try {
    $pdo = qi_db();
    $stmt = $pdo->prepare('SELECT ip_address, user_agent, created_at, expires_at
                           FROM user_sessions
                           WHERE user_id = :uid
                           ORDER BY created_at DESC
                           LIMIT 20');
    $stmt->execute([':uid' => $user['user_id']]);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $formatted = array_map(function($s) {
        $ua = $s['user_agent'] ?? '';
        $device = 'Unknown';
        if (stripos($ua, 'Mobile') !== false || stripos($ua, 'Android') !== false) $device = 'Mobile';
        elseif (stripos($ua, 'Windows') !== false) $device = 'Windows';
        elseif (stripos($ua, 'Mac') !== false) $device = 'macOS';
        elseif (stripos($ua, 'Linux') !== false) $device = 'Linux';

        $browser = 'Unknown';
        if (stripos($ua, 'Chrome') !== false) $browser = 'Chrome';
        elseif (stripos($ua, 'Firefox') !== false) $browser = 'Firefox';
        elseif (stripos($ua, 'Safari') !== false) $browser = 'Safari';
        elseif (stripos($ua, 'Edge') !== false) $browser = 'Edge';

        return [
            'ip' => $s['ip_address'] ?? '—',
            'device' => $device,
            'browser' => $browser,
            'login_at' => $s['created_at'],
            'expires_at' => $s['expires_at'],
        ];
    }, $sessions);

    echo json_encode(['status' => 'success', 'sessions' => $formatted]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gagal memuat riwayat sesi']);
}
