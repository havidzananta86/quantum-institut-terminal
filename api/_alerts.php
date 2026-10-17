<?php
/**
 * PRICE ALERT DI SERVER — tabel price_alerts (schema.sql).
 *
 * Dulu alert hanya tersimpan di localStorage dan hanya berbunyi selama dashboard terbuka.
 * Sekarang alert disimpan di server dan diperiksa:
 *   · setiap kali dashboard memuat daftar alert (api/price-alerts.php, dibatasi 20 detik), dan
 *   · oleh cron (api/alert-cron.php) saat tidak ada peramban yang terbuka.
 * Alert yang kena dikirim ke kanal notifikasi pengguna (Telegram/Discord/Slack/email —
 * api/_notif.php). Penandaan "kena" memakai UPDATE … WHERE is_triggered = 0 sebagai klaim
 * atomik, jadi dua pemeriksa yang berjalan bersamaan tidak pernah mengirim dua kali.
 */

if (!function_exists('qi_alert_simbol_sah')):

define('QI_ALERT_SIMBOL', ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'XAUUSD',
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD']);
define('QI_ALERT_MAKS_AKTIF', 50);

function qi_alert_simbol_sah(string $s): bool
{
    return in_array(strtoupper($s), QI_ALERT_SIMBOL, true);
}

/**
 * Harga terkini untuk beberapa simbol: cache live-price yang segar (≤ 60 dtk) lebih dulu;
 * sisanya diambil dengan menjalankan api/live-price.php (loopback HTTP, atau sub-proses
 * PHP saat berjalan dari CLI/cron). Simbol tanpa harga tidak dikembalikan (tidak ditebak).
 * @return array<string,float>
 */
function qi_alert_harga(array $simbol): array
{
    $simbol = array_values(array_unique(array_filter(array_map('strtoupper', $simbol), 'qi_alert_simbol_sah')));
    $hasil = [];
    if (!$simbol) return $hasil;

    $berkas = (array)@glob(__DIR__ . '/../cache/live-price/*.json');
    usort($berkas, static fn($a, $b) => @filemtime($b) <=> @filemtime($a));
    foreach (array_slice($berkas, 0, 60) as $f) {
        if (time() - (int)@filemtime($f) > 60) break;
        $j = json_decode((string)@file_get_contents($f), true);
        foreach ($simbol as $s) {
            if (!isset($hasil[$s]) && isset($j['prices'][$s]['price']) && $j['prices'][$s]['price'] > 0) $hasil[$s] = (float)$j['prices'][$s]['price'];
        }
        if (count($hasil) === count($simbol)) return $hasil;
    }

    $kurang = array_values(array_diff($simbol, array_keys($hasil)));
    $raw = null;
    if (PHP_SAPI !== 'cli' && !empty($_SERVER['HTTP_HOST']) && function_exists('curl_init')) {
        $protokol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $folder = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x.php')), '/');
        $ch = curl_init($protokol . $_SERVER['HTTP_HOST'] . $folder . '/live-price.php?symbols=' . rawurlencode(implode(',', $kurang)));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 3]);
        $raw = curl_exec($ch);
        curl_close($ch);
    } elseif (PHP_SAPI === 'cli') {
        $kode = '$_GET["symbols"]=' . var_export(implode(',', $kurang), true) . ';$_SERVER["REQUEST_METHOD"]="GET";$_SERVER["REMOTE_ADDR"]="127.0.0.1";include ' . var_export(realpath(__DIR__ . '/live-price.php'), true) . ';';
        $raw = @shell_exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($kode));
    }
    $j = is_string($raw) ? json_decode($raw, true) : null;
    foreach ($kurang as $s) {
        if (isset($j['prices'][$s]['price']) && $j['prices'][$s]['price'] > 0) $hasil[$s] = (float)$j['prices'][$s]['price'];
    }
    return $hasil;
}

/**
 * Periksa alert aktif (semua pengguna, atau satu pengguna) dan kirim notifikasi yang kena.
 * @return array{diperiksa:int,kena:array}
 */
function qi_alert_periksa(PDO $pdo, ?int $hanyaUser = null): array
{
    $sql = 'SELECT a.id, a.user_id, a.symbol, a.target_price, a.direction FROM price_alerts a
            JOIN users u ON u.id = a.user_id WHERE a.is_triggered = 0 AND u.is_active = 1' . ($hanyaUser !== null ? ' AND a.user_id = ?' : '') . ' LIMIT 2000';
    $st = $pdo->prepare($sql);
    $st->execute($hanyaUser !== null ? [$hanyaUser] : []);
    $aktif = $st->fetchAll(PDO::FETCH_ASSOC);
    $keluar = ['diperiksa' => count($aktif), 'kena' => []];
    if (!$aktif) return $keluar;

    $harga = qi_alert_harga(array_column($aktif, 'symbol'));
    $klaim = $pdo->prepare('UPDATE price_alerts SET is_triggered = 1, triggered_at = NOW() WHERE id = ? AND is_triggered = 0');
    foreach ($aktif as $a) {
        $h = $harga[strtoupper($a['symbol'])] ?? null;
        if ($h === null) continue;
        $target = (float)$a['target_price'];
        $kena = $a['direction'] === 'above' ? $h >= $target : $h <= $target;
        if (!$kena) continue;
        $klaim->execute([(int)$a['id']]);
        if ($klaim->rowCount() !== 1) continue;   // sudah diklaim pemeriksa lain
        $keluar['kena'][] = ['id' => (int)$a['id'], 'symbol' => $a['symbol'], 'target' => $target, 'harga' => $h, 'arah' => $a['direction']];

        try {
            if (!function_exists('qi_notif_kirim_pesan')) require_once __DIR__ . '/_notif.php';
            $judul = '🔔 Price alert ' . strtoupper($a['symbol']) . ' ' . ($a['direction'] === 'above' ? '≥ ' : '≤ ') . rtrim(rtrim(number_format($target, 6, '.', ''), '0'), '.');
            qi_notif_kirim_pesan((int)$a['user_id'], 'ALERT-' . $a['id'], $judul, [
                'Harga sekarang: ' . rtrim(rtrim(number_format($h, 6, '.', ''), '0'), '.'),
                'Target: ' . ($a['direction'] === 'above' ? 'naik ke / di atas ' : 'turun ke / di bawah ') . rtrim(rtrim(number_format($target, 6, '.', ''), '0'), '.'),
                'Alert ini sekali jalan dan kini nonaktif. Atur alert baru di Dashboard → Price Alerts.',
            ]);
        } catch (Throwable $e) {
            @error_log('[alert] notifikasi gagal: ' . $e->getMessage());
        }
    }
    return $keluar;
}

endif;
