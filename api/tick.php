<?php
/**
 * Harga & spread realtime dari EA MT5 (jalur tick read-only bridge).
 *
 * EA mengirim bid/ask/spread seluruh simbol Market Watch tiap detik ke
 * api/mt-bridge.php?action=tick, yang menyimpannya sebagai berkas JSON per akun
 * (tanpa menulis database tiap detik). Endpoint ini membacanya untuk browser.
 *
 * Sifatnya ringan dengan sengaja: muatannya kecil (±2 KB untuk 30 simbol) sehingga
 * aman dipanggil tiap 1,5 detik per pengguna.
 *
 * KEJUJURAN DATA:
 *  - tick yang lebih tua dari 30 detik TIDAK dikirim (basi) dan 'streaming' menjadi
 *    false, supaya halaman bisa mengatakan dengan jujur bahwa harga sedang dari polling.
 *  - bila EA belum diperbarui (masih hanya mengirim snapshot 60 detik), endpoint ini
 *    mengembalikan streaming=false tanpa error — aplikasi tetap berjalan seperti sekarang.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(180, 60);

$user = qi_require_auth();
$uid  = (int)$user['user_id'];
$pdo  = qi_db();

$MAKS_UMUR = 30; // detik

try {
    $stmt = $pdo->prepare("SELECT id, account_label FROM trading_accounts
                           WHERE user_id = :uid AND connection_status IN ('pending', 'active')
                           ORDER BY created_at DESC LIMIT 5");
    $stmt->execute([':uid' => $uid]);
    $akun = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $dir = __DIR__ . '/../cache/ticks';
    $ticks = [];
    $umurMaks = 0;
    $akunSumber = null;

    foreach ($akun as $a) {
        $idAkun = (int)$a['id'];
        $file = $dir . '/' . $idAkun . '.json'; // id sudah int: tidak mungkin keluar dari cache/
        if (!is_file($file)) continue;

        $d = json_decode((string)@file_get_contents($file), true);
        if (!is_array($d) || empty($d['ticks']) || !is_array($d['ticks'])) continue;

        $umur = time() - (int)($d['updated'] ?? 0);
        if ($umur > $MAKS_UMUR) continue; // data basi tidak dikirim sebagai realtime

        foreach ($d['ticks'] as $simbol => $t) {
            if (!is_array($t) || isset($ticks[$simbol])) continue; // akun pertama menang
            $bid = (float)($t['bid'] ?? 0);
            $ask = (float)($t['ask'] ?? 0);
            if ($bid <= 0 || $ask <= 0) continue;
            $ticks[$simbol] = [
                'bid'    => $bid,
                'ask'    => $ask,
                'spread' => (float)($t['spread'] ?? ($ask - $bid)),
                'age_ms' => $umur * 1000,
            ];
        }
        if ($umur > $umurMaks) { $umurMaks = $umur; $akunSumber = $a['account_label'] ?? null; }
    }

    echo json_encode([
        'status'     => 'success',
        'server_now' => gmdate('c'),
        'streaming'  => !empty($ticks),   // false = EA belum mengirim tick (mis. belum diperbarui)
        'accounts'   => count($akun),
        'source'     => $akunSumber,
        'age_s'      => $umurMaks,
        'count'      => count($ticks),
        'ticks'      => $ticks,
    ]);
} catch (Exception $e) {
    qi_log('error', 'Tick read failed', ['exception' => get_class($e)]);
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Data tick tidak dapat dibaca.']);
}
