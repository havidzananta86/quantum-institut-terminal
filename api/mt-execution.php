<?php
/** MT5-only pull/report endpoint. It returns no order unless every server guardrail passes. */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(120, 60);

function qi_exec_reply(int $status, array $body): void { http_response_code($status); echo json_encode($body); exit(); }
$key = trim($_SERVER['HTTP_X_QI_BRIDGE_KEY'] ?? '');
if (!preg_match('/^QIB_[a-f0-9]{64}$/', $key)) qi_exec_reply(401, ['status'=>'error','code'=>'BRIDGE_KEY_INVALID']);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') qi_exec_reply(405, ['status'=>'error','code'=>'METHOD_NOT_ALLOWED']);
$input = qi_get_json_body();
if (!is_array($input)) qi_exec_reply(400, ['status'=>'error','code'=>'INVALID_JSON']);
$action = qi_sanitize_string($input['action'] ?? '', 12);

try {
    $pdo = qi_db(); $hash = hash('sha256', $key);
    $lookup = $pdo->prepare("SELECT a.id FROM trading_account_bridge_keys k INNER JOIN trading_accounts a ON a.id=k.trading_account_id WHERE k.key_hash=:hash AND k.revoked_at IS NULL AND a.provider='MT5' AND a.connection_status='active' LIMIT 1");
    $lookup->execute([':hash'=>$hash]); $accountId = (int)$lookup->fetchColumn();
    if (!$accountId) qi_exec_reply(401, ['status'=>'error','code'=>'BRIDGE_NOT_ACTIVE']);
    if ($action === 'report') {
        $token = qi_sanitize_string($input['order_token'] ?? '', 36);
        $result = qi_sanitize_string($input['result'] ?? '', 10);
        $ticket = filter_var($input['broker_order_ticket'] ?? null, FILTER_VALIDATE_INT);
        $deal = filter_var($input['broker_deal_ticket'] ?? null, FILTER_VALIDATE_INT);
        $retcode = qi_sanitize_string($input['retcode'] ?? '', 32);
        $message = qi_sanitize_string($input['message'] ?? '', 255);
        if (!preg_match('/^[a-f0-9-]{36}$/', $token) || !in_array($result, ['executed','rejected'], true)) qi_exec_reply(422, ['status'=>'error','code'=>'INVALID_REPORT']);
        // CATATAN BUG YANG DIPERBAIKI: dulu pernyataan ini memakai placeholder :status
        // DUA KALI (untuk kolom status dan di dalam IF(...)). Prepare natif PDO menolak
        // placeholder yang dipakai ulang → PDOException → HTTP 500, sehingga LAPORAN
        // HASIL DARI EA TIDAK PERNAH TERSIMPAN (order selamanya 'dispatched', tanpa
        // tiket). Sekarang memakai dua nama berbeda dengan nilai yang sama.
        $stmt = $pdo->prepare("UPDATE trading_execution_orders SET status=:status, broker_order_ticket=:ticket, broker_deal_ticket=:deal, broker_retcode=:retcode, broker_message=:message, executed_at=IF(:status_cek='executed',NOW(),NULL) WHERE order_token=:token AND trading_account_id=:account AND status='dispatched'");
        $stmt->execute([':status'=>$result, ':status_cek'=>$result, ':ticket'=>$ticket ?: null, ':deal'=>$deal ?: null, ':retcode'=>$retcode ?: null, ':message'=>$message ?: null, ':token'=>$token, ':account'=>$accountId]);
        // Umpan balik JUJUR: kalau tidak ada baris yang cocok (token salah, akun salah,
        // atau order tidak sedang dispatched), jangan bilang "success".
        if (!$stmt->rowCount()) qi_exec_reply(409, ['status'=>'error','code'=>'ORDER_NOT_DISPATCHED']);
        qi_exec_reply(200, ['status'=>'success']);
    }
    if ($action !== 'poll') qi_exec_reply(400, ['status'=>'error','code'=>'INVALID_ACTION']);
    $balance = filter_var($input['balance'] ?? null, FILTER_VALIDATE_FLOAT); $equity = filter_var($input['equity'] ?? null, FILTER_VALIDATE_FLOAT); $open = filter_var($input['open_positions'] ?? null, FILTER_VALIDATE_INT);
    if ($balance === false || $equity === false || $open === false || $balance <= 0 || $equity < 0 || $open < 0 || $open > 1000) qi_exec_reply(422, ['status'=>'error','code'=>'INVALID_ACCOUNT_STATE']);
    $pdo->beginTransaction();
    $profileQ = $pdo->prepare('SELECT * FROM trading_execution_profiles WHERE trading_account_id=:id FOR UPDATE'); $profileQ->execute([':id'=>$accountId]); $profile=$profileQ->fetch(PDO::FETCH_ASSOC);
    if (!$profile || !(int)$profile['enabled'] || (int)$profile['emergency_stop']) { $pdo->commit(); qi_exec_reply(200, ['status'=>'success','instruction'=>null,'reason'=>'EXECUTION_DISABLED']); }
    $day = gmdate('Y-m-d');
    $state = $pdo->prepare('INSERT INTO trading_execution_state (trading_account_id,state_day,opening_balance,latest_equity,latest_open_positions,updated_at) VALUES (:id,:day,:balance,:equity,:open,NOW()) ON DUPLICATE KEY UPDATE latest_equity=VALUES(latest_equity), latest_open_positions=VALUES(latest_open_positions), updated_at=NOW()');
    $state->execute([':id'=>$accountId, ':day'=>$day, ':balance'=>$balance, ':equity'=>$equity, ':open'=>$open]);
    $baseQ=$pdo->prepare('SELECT opening_balance FROM trading_execution_state WHERE trading_account_id=:id AND state_day=:day'); $baseQ->execute([':id'=>$accountId, ':day'=>$day]); $base=(float)$baseQ->fetchColumn();
    $lossPct = $base > 0 ? max(0, ($base-$equity)/$base*100) : 0;
    if ($lossPct >= (float)$profile['max_daily_loss_pct'] || $open >= (int)$profile['max_open_positions']) { $pdo->commit(); qi_exec_reply(200,['status'=>'success','instruction'=>null,'reason'=>$lossPct >= (float)$profile['max_daily_loss_pct'] ? 'DAILY_LOSS_LIMIT' : 'POSITION_LIMIT']); }
    $pdo->prepare("UPDATE trading_execution_orders SET status='expired', broker_message='Order expired before delivery' WHERE trading_account_id=:id AND status='queued' AND expires_at<NOW()")->execute([':id'=>$accountId]);
    $next=$pdo->prepare("SELECT * FROM trading_execution_orders WHERE trading_account_id=:id AND status='queued' AND expires_at>=NOW() ORDER BY created_at ASC LIMIT 1 FOR UPDATE"); $next->execute([':id'=>$accountId]); $order=$next->fetch(PDO::FETCH_ASSOC);
    if (!$order) { $pdo->commit(); qi_exec_reply(200,['status'=>'success','instruction'=>null]); }
    $allowed=json_decode($profile['allowed_symbols'] ?: '[]', true) ?: [];
    if ((float)$order['volume'] > (float)$profile['max_lot'] || !in_array($order['symbol'],$allowed,true)) { $pdo->prepare("UPDATE trading_execution_orders SET status='rejected', broker_message='Server guardrail rejected queued order' WHERE id=:id")->execute([':id'=>$order['id']]); $pdo->commit(); qi_exec_reply(200,['status'=>'success','instruction'=>null,'reason'=>'ORDER_GUARDRAIL']); }
    $pdo->prepare("UPDATE trading_execution_orders SET status='dispatched', dispatched_at=NOW() WHERE id=:id")->execute([':id'=>$order['id']]); $pdo->commit();
    qi_exec_reply(200,['status'=>'success','instruction'=>['order_token'=>$order['order_token'],'symbol'=>$order['symbol'],'side'=>$order['side'],'volume'=>(float)$order['volume'],'stop_loss'=>(float)$order['stop_loss'],'take_profit'=>(float)$order['take_profit'],'magic_number'=>(int)$profile['magic_number']]]);
} catch (Exception $e) { if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack(); qi_log('error','MT5 execution request failed',['exception'=>get_class($e)]); qi_exec_reply(500,['status'=>'error','code'=>'EXECUTION_PROCESSING_FAILED']); }
