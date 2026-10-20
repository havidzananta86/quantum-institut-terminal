<?php
/**
 * Siapa yang boleh memakai feed broker MT5 — dijalankan terhadap kode asli api/_middleware.php.
 * Dipanggil tests/mt5-feed-akses.test.js dua kali:
 *     php tests/mt5-feed-akses.test.php server   → proses sinyal server (QI_SERVER_MT5)
 *     php tests/mt5-feed-akses.test.php anon     → pemanggil tanpa token
 *
 * Konstanta bridge didefinisikan DI SINI supaya qi_load_bridge_config() tidak menyentuh
 * config/ sama sekali: uji ini tidak boleh bergantung pada konfigurasi mesin yang menjalankannya.
 */
$mode = $argv[1] ?? 'anon';

define('QI_MT5_BRIDGE_URL', 'wss://contoh-bridge.invalid/ws/harga');
define('QI_MT5_BRIDGE_SECRET', str_repeat('s', 48));          // ≥ 32 byte, nilai palsu
define('QI_MT5_BRIDGE_AUDIENCE', 'pro');
define('QI_TV_BRIDGE_URL', 'https://contoh-bridge.invalid');
if ($mode === 'server') define('QI_SERVER_MT5', true);

require __DIR__ . '/../api/_middleware.php';

$gagal = 0;
function cek(string $nama, bool $lulus): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . "\n";
    if (!$lulus) $gagal++;
}

echo "Tingkat peran (mode: $mode)\n";
// Inti kebijakan 'pro': ambangnya level >= 1. Baris ini membuktikan ambang itu
// benar-benar mencakup PRO *dan* VIP — pernah ada bug di repo ini yang menolak VIP.
cek("admin = 3", qi_tingkat_peran('admin') === 3);
cek("vip = 2 (di ATAS pro)", qi_tingkat_peran('vip') === 2);
cek("pro = 1", qi_tingkat_peran('pro') === 1);
cek("premium dihitung sebagai pro", qi_tingkat_peran('premium') === 1);
cek("elite dihitung sebagai vip", qi_tingkat_peran('elite') === 2);
cek("user = 0", qi_tingkat_peran('user') === 0);
cek("peran kosong = 0", qi_tingkat_peran('') === 0 && qi_tingkat_peran(null) === 0);
cek("ambang 'pro' (>=1) mencakup pro, vip, admin", qi_tingkat_peran('pro') >= 1 && qi_tingkat_peran('vip') >= 1 && qi_tingkat_peran('admin') >= 1);
cek("ambang 'pro' (>=1) TIDAK mencakup user", !(qi_tingkat_peran('user') >= 1));

echo "\nPemetaan simbol bridge\n";
cek('XAUUSD didukung bridge', qi_tv_bridge_symbol('XAUUSD') === 'XAUUSD');
cek('xauusd huruf kecil tetap dikenali', qi_tv_bridge_symbol('xauusd') === 'XAUUSD');
cek('BTCUSDT dipetakan ke BTCUSD', qi_tv_bridge_symbol('BTCUSDT') === 'BTCUSD');
cek('simbol di luar daftar = null', qi_tv_bridge_symbol('DOGEUSDT') === null);

echo "\nKonfigurasi bridge\n";
cek('bridge dianggap terkonfigurasi (url + secret >= 32)', qi_mt5_configured() === true);

if ($mode === 'server') {
    echo "\nProses sinyal server (QI_SERVER_MT5)\n";
    // Generator & evaluator otomatis HARUS memakai harga broker, apa pun audience-nya:
    // sinyal yang diterbitkan mengikuti feed yang sama dengan yang dinilai nanti.
    cek('XAUUSD memakai feed MT5', qi_chart_use_mt5('XAUUSD') === true);
    cek('EURUSD memakai feed MT5', qi_chart_use_mt5('EURUSD') === true);
    cek('simbol di luar bridge TIDAK memakai feed MT5', qi_chart_use_mt5('DOGEUSDT') === false);
} else {
    echo "\nPemanggil tanpa token\n";
    // Tanpa Authorization header, qi_validate_token() tidak menghasilkan pengguna.
    // Ini pagar terakhir: audience 'pro' sekalipun tidak boleh membocorkan feed broker
    // ke pemanggil anonim.
    cek('qi_mt5_allowed() = false tanpa token', qi_mt5_allowed() === false);
    cek('XAUUSD TIDAK memakai feed MT5 tanpa token', qi_chart_use_mt5('XAUUSD') === false);
    cek('simbol di luar bridge tetap false', qi_chart_use_mt5('DOGEUSDT') === false);
}

echo "\nBerkas cache feed broker terpisah\n";
// Candle broker tidak boleh menetes ke cache yang dipakai pengguna gratis.
$biasa = qi_chart_cache_file('XAUUSD', '60', false);
$mt5   = qi_chart_cache_file('XAUUSD', '60', true);
cek('cache MT5 berbeda berkas dari cache umum', $biasa !== $mt5);
cek('kedua nama cache berada di cache/chart', strpos($biasa, 'cache/chart') !== false || strpos(str_replace('\\', '/', $biasa), 'cache/chart') !== false);

echo $gagal ? "\n$gagal uji GAGAL\n" : "\nSemua lulus\n";
exit($gagal ? 1 : 0);
