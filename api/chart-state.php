<?php
/**
 * STATE CHART PER AKUN (gambar & template) — tabel user_chart_state (migrasi 019).
 *
 * GET                 → daftar kunci milik pengguna + cap waktu (tanpa isi)
 * GET ?kunci=lw:X     → isi satu kunci
 * POST {kunci, nilai, ts}  → simpan bila ts lebih baru dari yang tersimpan (penulis terakhir menang)
 * DELETE ?kunci=…     → hapus
 *
 * Kunci yang diizinkan: lw:<SIMBOL> (gambar per simbol), tpl:custom1, tpl:custom2.
 * Isi wajib JSON sah dan maks. 512 KB per kunci; maks. 200 kunci per pengguna.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(90, 60);
$pengguna = qi_require_auth();
$uid = (int)$pengguna['user_id'];
$pdo = qi_db();

function qi_cs_jawab(array $d, int $kode = 200): void { http_response_code($kode); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function qi_cs_kunci_sah(string $k): bool { return (bool)preg_match('/^(lw:[A-Z0-9_]{3,60}|tpl:custom[12])$/', $k); }

$metode = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
try {
    if ($metode === 'GET') {
        $kunci = (string)($_GET['kunci'] ?? '');
        if ($kunci === '') {
            $st = $pdo->prepare('SELECT state_key, client_updated_at, LENGTH(state_value) AS ukuran FROM user_chart_state WHERE user_id = ? ORDER BY state_key');
            $st->execute([$uid]);
            qi_cs_jawab(['status' => 'success', 'kunci' => array_map(static fn($r) => ['kunci' => $r['state_key'], 'ts' => (int)$r['client_updated_at'], 'ukuran' => (int)$r['ukuran']], $st->fetchAll(PDO::FETCH_ASSOC))]);
        }
        if (!qi_cs_kunci_sah($kunci)) qi_cs_jawab(['status' => 'error', 'message' => 'Kunci tidak sah.'], 400);
        $st = $pdo->prepare('SELECT state_value, client_updated_at FROM user_chart_state WHERE user_id = ? AND state_key = ?');
        $st->execute([$uid, $kunci]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        qi_cs_jawab(['status' => 'success', 'kunci' => $kunci, 'nilai' => $r ? $r['state_value'] : null, 'ts' => $r ? (int)$r['client_updated_at'] : 0]);
    }

    if ($metode === 'POST') {
        $in = qi_get_json_body();
        if (!is_array($in)) qi_cs_jawab(['status' => 'error', 'message' => 'Body JSON tidak valid.'], 400);
        $kunci = (string)($in['kunci'] ?? '');
        $nilai = $in['nilai'] ?? null;
        $ts = (int)($in['ts'] ?? 0);
        if (!qi_cs_kunci_sah($kunci)) qi_cs_jawab(['status' => 'error', 'message' => 'Kunci tidak sah.'], 400);
        if (!is_string($nilai) || strlen($nilai) > 524288 || json_decode($nilai) === null && trim($nilai) !== 'null') qi_cs_jawab(['status' => 'error', 'message' => 'Isi harus JSON sah ≤ 512 KB.'], 400);
        if ($ts <= 0 || $ts > (time() + 300) * 1000) $ts = (int)(microtime(true) * 1000);   // jam klien tidak masuk akal → pakai jam server
        $n = $pdo->prepare('SELECT COUNT(*) FROM user_chart_state WHERE user_id = ?');
        $n->execute([$uid]);
        if ((int)$n->fetchColumn() >= 200) {
            $ada = $pdo->prepare('SELECT 1 FROM user_chart_state WHERE user_id = ? AND state_key = ?');
            $ada->execute([$uid, $kunci]);
            if (!$ada->fetchColumn()) qi_cs_jawab(['status' => 'error', 'message' => 'Batas 200 kunci tersimpan tercapai.'], 400);
        }
        // Hanya timpa bila versi kiriman lebih baru (penulis terakhir menang).
        $pdo->prepare('INSERT INTO user_chart_state (user_id, state_key, state_value, client_updated_at) VALUES (?, ?, ?, ?)
                       ON DUPLICATE KEY UPDATE state_value = IF(VALUES(client_updated_at) >= client_updated_at, VALUES(state_value), state_value),
                                               client_updated_at = GREATEST(client_updated_at, VALUES(client_updated_at))')
            ->execute([$uid, $kunci, $nilai, $ts]);
        $st = $pdo->prepare('SELECT client_updated_at FROM user_chart_state WHERE user_id = ? AND state_key = ?');
        $st->execute([$uid, $kunci]);
        $tsSimpan = (int)$st->fetchColumn();
        qi_cs_jawab(['status' => 'success', 'kunci' => $kunci, 'ts' => $tsSimpan, 'diterima' => $tsSimpan === $ts]);
    }

    if ($metode === 'DELETE') {
        $kunci = (string)($_GET['kunci'] ?? '');
        if (!qi_cs_kunci_sah($kunci)) qi_cs_jawab(['status' => 'error', 'message' => 'Kunci tidak sah.'], 400);
        $pdo->prepare('DELETE FROM user_chart_state WHERE user_id = ? AND state_key = ?')->execute([$uid, $kunci]);
        qi_cs_jawab(['status' => 'success']);
    }
} catch (PDOException $e) {
    if ($e->getCode() === '42S02') qi_cs_jawab(['status' => 'error', 'code' => 'MIGRASI_BELUM', 'message' => 'Jalankan database/migrations/019_user_chart_state.sql.'], 503);
    qi_log('error', 'chart-state gagal', ['pesan' => $e->getMessage()]);
    qi_cs_jawab(['status' => 'error', 'message' => 'Penyimpanan chart tidak tersedia.'], 500);
}
qi_cs_jawab(['status' => 'error', 'message' => 'Metode tidak diizinkan.'], 405);
