<?php
/**
 * Owner-controlled live MT5 order queue. It never talks to a broker directly;
 * a registered MT5 EA pulls a single validated order from mt-execution.php.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(20, 60);

$user = qi_require_auth();
$uid = (int)$user['user_id'];
$pdo = qi_db();

function qi_live_fail(int $status, string $message, string $code): void {
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message, 'code' => $code]);
    exit();
}
function qi_live_account(PDO $pdo, int $uid, int $accountId): array {
    $stmt = $pdo->prepare("SELECT a.id, a.provider, a.account_label, a.connection_status, p.enabled, p.emergency_stop, p.max_lot, p.volume, p.max_daily_loss_pct, p.max_open_positions, p.allowed_symbols, p.symbol_map FROM trading_accounts a LEFT JOIN trading_execution_profiles p ON p.trading_account_id = a.id WHERE a.id = :id AND a.user_id = :uid AND a.provider = 'MT5' LIMIT 1");
    $stmt->execute([':id' => $accountId, ':uid' => $uid]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$account) qi_live_fail(404, 'Akun MT5 tidak ditemukan.', 'ACCOUNT_NOT_FOUND');
    return $account;
}

try {
    if (!$pdo->query("SHOW TABLES LIKE 'trading_execution_profiles'")->fetch()) {
        qi_live_fail(503, 'Modul eksekusi belum diaktifkan. Jalankan migrasi database.', 'MIGRATION_REQUIRED');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $accounts = $pdo->prepare("SELECT a.id, a.account_label, a.account_reference, a.connection_status, p.enabled, p.emergency_stop, p.max_lot, p.volume, p.max_daily_loss_pct, p.max_open_positions, p.allowed_symbols, p.symbol_map FROM trading_accounts a LEFT JOIN trading_execution_profiles p ON p.trading_account_id = a.id WHERE a.user_id = :uid AND a.provider = 'MT5' ORDER BY a.created_at DESC");
        $accounts->execute([':uid' => $uid]);
        $orders = $pdo->prepare("SELECT o.id, o.order_token, o.symbol, o.side, o.volume, o.stop_loss, o.take_profit, o.status, o.broker_order_ticket, o.broker_message, o.created_at, o.executed_at FROM trading_execution_orders o INNER JOIN trading_accounts a ON a.id = o.trading_account_id WHERE a.user_id = :uid ORDER BY o.created_at DESC LIMIT 30");
        $orders->execute([':uid' => $uid]);
        echo json_encode(['status' => 'success', 'accounts' => $accounts->fetchAll(PDO::FETCH_ASSOC), 'orders' => $orders->fetchAll(PDO::FETCH_ASSOC)]);
        exit();
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') qi_live_fail(405, 'Method tidak diizinkan.', 'METHOD_NOT_ALLOWED');
    $input = qi_get_json_body();
    if (!is_array($input)) qi_live_fail(400, 'Body JSON tidak valid.', 'INVALID_JSON');
    $action = qi_sanitize_string($input['action'] ?? '', 20);
    $accountId = filter_var($input['account_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$accountId || $accountId < 1) qi_live_fail(422, 'Pilih akun MT5 terlebih dahulu.', 'INVALID_ACCOUNT');
    $account = qi_live_account($pdo, $uid, (int)$accountId);

    // ── GATING PAKET ────────────────────────────────────────────────────────
    // Membaca status boleh untuk semua pengguna yang login (pemilik akun sudah
    // diperiksa di atas), tetapi MENGUBAH guardrail atau MENGANTREKAN perintah uang
    // nyata wajib berperan PRO/VIP/admin. Tanpa ini, fitur berbayar bisa dipakai
    // akun biasa.
    require_once __DIR__ . '/_execution.php';
    if (in_array($action, ['configure', 'set_enabled', 'emergency_stop', 'queue_signal'], true)
        && !qi_exec_role_boleh($user['role'] ?? null)) {
        qi_live_fail(403, 'Eksekusi otomatis hanya tersedia untuk paket PRO atau VIP.', 'PLAN_REQUIRED');
    }

    if ($action === 'status') {
        // Status lengkap satu akun: profil, batas harian, kesegaran EA, dan 12 perintah
        // terakhir. Dipakai halaman Auto-Trade supaya pelanggan tahu EA-nya hidup atau
        // tidak, tanpa harus bertanya ke dukungan.
        echo json_encode(['status' => 'success', 'data' => qi_exec_status_akun($pdo, (int)$accountId)]);
        exit();
    }

    if ($action === 'configure') {
        $maxLot = filter_var($input['max_lot'] ?? null, FILTER_VALIDATE_FLOAT);
        $daily = filter_var($input['max_daily_loss_pct'] ?? null, FILTER_VALIDATE_FLOAT);
        $maxPositions = filter_var($input['max_open_positions'] ?? null, FILTER_VALIDATE_INT);
        $symbols = is_array($input['allowed_symbols'] ?? null) ? $input['allowed_symbols'] : [];
        $symbols = array_values(array_unique(array_filter(array_map(fn($s) => strtoupper(qi_sanitize_string((string)$s, 32)), $symbols), fn($s) => preg_match('/^[A-Z0-9._-]{3,32}$/', $s))));
        if ($maxLot === false || $daily === false || $maxPositions === false || $maxLot < 0.01 || $maxLot > 0.01 || $daily < 0.5 || $daily > 50 || $maxPositions < 1 || $maxPositions > 10 || !$symbols) {
            qi_live_fail(422, 'Konfigurasi harus memakai lot 0,01, batas rugi 0,5–50%, maksimal 1–10 posisi, dan minimal satu simbol.', 'INVALID_GUARDRAILS');
        }

        // ── Pemetaan simbol per akun ────────────────────────────────────────
        // Nama simbol berbeda antar broker (XAUUSD vs XAUUSD.pro vs GOLD). Tanpa
        // pemetaan ini, EA menolak dengan "Symbol is unavailable" — penyebab paling
        // sering pelanggan merasa eksekusi "tidak jalan". Nilai kosong ('') berarti
        // simbol itu SENGAJA tidak dieksekusi di akun ini.
        $petaMasuk = is_array($input['symbol_map'] ?? null) ? $input['symbol_map'] : [];
        $petaBersih = [];
        foreach ($petaMasuk as $dari => $ke) {
            $kunci = strtoupper(qi_sanitize_string((string)$dari, 32));
            // HURUF BESAR/KECIL nilai DIPERTAHANKAN: nama simbol broker bisa memakai
            // huruf kecil (mis. "XAUUSD.pro" atau "GOLD.a"), dan memaksanya menjadi
            // huruf besar membuat EA tidak menemukan simbolnya.
            $nilai = trim(qi_sanitize_string((string)$ke, 32));
            if (!preg_match('/^[A-Z0-9._\/-]{3,32}$/', $kunci)) continue;
            if ($nilai !== '' && !preg_match('/^[A-Za-z0-9._-]{1,32}$/', $nilai)) continue;
            $petaBersih[$kunci] = $nilai;
        }

        $stmt = $pdo->prepare('INSERT INTO trading_execution_profiles (trading_account_id, enabled, emergency_stop, max_lot, volume, max_daily_loss_pct, max_open_positions, allowed_symbols, symbol_map) VALUES (:id, 0, 1, :lot, 0.01, :daily, :open, :symbols, :peta) ON DUPLICATE KEY UPDATE enabled = 0, emergency_stop = 1, max_lot = VALUES(max_lot), volume = 0.01, max_daily_loss_pct = VALUES(max_daily_loss_pct), max_open_positions = VALUES(max_open_positions), allowed_symbols = VALUES(allowed_symbols), symbol_map = VALUES(symbol_map)');
        $stmt->execute([':id' => $accountId, ':lot' => $maxLot, ':daily' => $daily, ':open' => $maxPositions, ':symbols' => json_encode($symbols), ':peta' => $petaBersih ? json_encode($petaBersih) : null]);
        echo json_encode(['status' => 'success', 'message' => 'Guardrail disimpan. Eksekusi tetap nonaktif.', 'symbol_map' => $petaBersih]); exit();
    }
    if ($action === 'set_enabled') {
        if (($input['confirm_text'] ?? '') !== 'AKTIFKAN REAL') qi_live_fail(422, 'Ketik AKTIFKAN REAL untuk mengaktifkan eksekusi.', 'CONFIRMATION_REQUIRED');
        if ($account['connection_status'] !== 'active') qi_live_fail(409, 'Terminal MT5 belum mengirim snapshot aktif.', 'BRIDGE_NOT_ACTIVE');
        $stmt = $pdo->prepare('UPDATE trading_execution_profiles SET enabled = :enabled, emergency_stop = :stop, enabled_at = IF(:enabled = 1, NOW(), NULL) WHERE trading_account_id = :id');
        $enabled = !empty($input['enabled']) ? 1 : 0;
        $stmt->execute([':enabled' => $enabled, ':stop' => $enabled ? 0 : 1, ':id' => $accountId]);
        if (!$stmt->rowCount()) qi_live_fail(409, 'Simpan guardrail terlebih dahulu.', 'CONFIGURATION_REQUIRED');
        qi_log('warning', 'Live execution state changed', ['user_id' => $uid, 'account_id' => $accountId, 'enabled' => $enabled]);
        echo json_encode(['status' => 'success', 'message' => $enabled ? 'Eksekusi real diaktifkan.' : 'Eksekusi real dihentikan.']); exit();
    }
    if ($action === 'emergency_stop') {
        $stmt = $pdo->prepare('UPDATE trading_execution_profiles SET enabled = 0, emergency_stop = 1 WHERE trading_account_id = :id');
        $stmt->execute([':id' => $accountId]);
        $cancel = $pdo->prepare("UPDATE trading_execution_orders SET status = 'cancelled', broker_message = 'Emergency stop by account owner' WHERE trading_account_id = :id AND status = 'queued'");
        $cancel->execute([':id' => $accountId]);
        qi_log('warning', 'Live execution emergency stop', ['user_id' => $uid, 'account_id' => $accountId]);
        echo json_encode(['status' => 'success', 'message' => 'Tombol darurat aktif. Antrean order dibatalkan.']); exit();
    }
    if ($action === 'queue_signal') {
        if (!(int)$account['enabled'] || (int)$account['emergency_stop'] || $account['connection_status'] !== 'active') qi_live_fail(409, 'Eksekusi real belum aktif atau terminal belum tersambung.', 'EXECUTION_NOT_READY');
        $symbol = strtoupper(qi_sanitize_string($input['symbol'] ?? '', 32));
        $side = strtoupper(qi_sanitize_string($input['side'] ?? '', 4));
        $volume = filter_var($input['volume'] ?? null, FILTER_VALIDATE_FLOAT);
        $entry = filter_var($input['entry_price'] ?? null, FILTER_VALIDATE_FLOAT);
        $sl = filter_var($input['stop_loss'] ?? null, FILTER_VALIDATE_FLOAT);
        $tp = filter_var($input['take_profit'] ?? null, FILTER_VALIDATE_FLOAT);
        // Pemetaan simbol dihormati di jalur MANUAL juga, supaya perintah yang dikirim ke
        // EA selalu memakai nama simbol broker pelanggan (bukan nama sinyal).
        $symbolBroker = qi_exec_peta_simbol(is_string($account['symbol_map'] ?? null) ? $account['symbol_map'] : null, $symbol);
        if ($symbolBroker === '') qi_live_fail(422, 'Simbol ini sengaja tidak dipetakan ke broker akun ini.', 'SYMBOL_NOT_MAPPED');
        $symbol = $symbolBroker;
        $allowed = json_decode($account['allowed_symbols'] ?: '[]', true) ?: [];
        $validLevels = $side === 'BUY' ? ($sl !== false && $tp !== false && $entry !== false && $sl > 0 && $tp > $entry && $sl < $entry) : ($side === 'SELL' ? ($sl !== false && $tp !== false && $entry !== false && $tp > 0 && $tp < $entry && $sl > $entry) : false);
        if (!in_array($symbol, $allowed, true) || !in_array($side, ['BUY','SELL'], true) || $volume === false || $volume <= 0 || $volume > (float)$account['max_lot'] || !$validLevels) qi_live_fail(422, 'Instruksi sinyal tidak memenuhi guardrail (simbol, lot, SL, atau TP).', 'INVALID_SIGNAL_ORDER');
        $token = bin2hex(random_bytes(4)) . '-' . bin2hex(random_bytes(2)) . '-4' . substr(bin2hex(random_bytes(2)), 1) . '-a' . substr(bin2hex(random_bytes(2)), 1) . '-' . bin2hex(random_bytes(6));
        $stmt = $pdo->prepare("INSERT INTO trading_execution_orders (order_token, trading_account_id, source, symbol, side, volume, stop_loss, take_profit, requested_price, status, expires_at) VALUES (:token,:account,'signal',:symbol,:side,:volume,:sl,:tp,:entry,'queued',DATE_ADD(NOW(), INTERVAL 5 MINUTE))");
        $stmt->execute([':token'=>$token, ':account'=>$accountId, ':symbol'=>$symbol, ':side'=>$side, ':volume'=>$volume, ':sl'=>$sl, ':tp'=>$tp, ':entry'=>$entry]);
        qi_log('warning', 'Live signal order queued', ['user_id'=>$uid, 'account_id'=>$accountId, 'symbol'=>$symbol, 'side'=>$side]);
        echo json_encode(['status'=>'success','message'=>'Order masuk antrean aman selama lima menit.','order_token'=>$token]); exit();
    }
    qi_live_fail(400, 'Action tidak dikenal.', 'INVALID_ACTION');
} catch (Exception $e) {
    qi_log('error', 'Live trade request failed', ['exception' => get_class($e)]);
    qi_live_fail(500, 'Permintaan eksekusi tidak dapat diproses.', 'LIVE_TRADE_PROCESSING_FAILED');
}
