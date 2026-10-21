<?php
/**
 * api/health.php dipanggil ANONIM (status.html + pemantau uptime) — balasannya harus
 * tetap berguna tanpa membocorkan detail infrastruktur. Dijalankan dari
 * tests/keamanan-sesi.test.js sebagai proses terpisah karena health.php mencetak JSON
 * dan menyetel kode respons.
 */
$gagal = 0;
function cek(string $nama, bool $lulus): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . "\n";
    if (!$lulus) $gagal++;
}

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['bridges'] = '1';            // diminta, tetapi pemanggilnya anonim

ob_start();
include __DIR__ . '/../api/health.php';
$keluaran = ob_get_clean();
$j = json_decode($keluaran, true);

echo "health.php dipanggil anonim\n";
cek('membalas JSON yang sah', is_array($j) && isset($j['checks']));
if (!is_array($j)) { echo "\n1 uji GAGAL\n"; exit(1); }
$c = $j['checks'];

// Yang WAJIB tetap ada — status.html membacanya (assets/js/halaman-status.js).
foreach (['db', 'disk', 'disk_pct_used', 'cache_writable', 'api_keys', 'cron'] as $f) {
    cek("field '$f' tetap tersedia untuk halaman status", array_key_exists($f, $c));
}

// Yang TIDAK BOLEH bocor ke anonim.
cek('versi PHP persis TIDAK dibocorkan', !array_key_exists('php_version', $c));
cek('sisa disk dalam GB TIDAK dibocorkan', !array_key_exists('disk_free_gb', $c));
cek("?bridges=1 dijawab 'admin_only', bukan hasil probe", ($c['bridges'] ?? null) === 'admin_only');
cek('tidak ada nama host bridge di seluruh balasan', stripos($keluaran, 'ts.net') === false && stripos($keluaran, 'tail') === false);
cek('tidak ada kunci/secret di balasan', !preg_match('/secret|api_key"|token/i', $keluaran));

echo $gagal ? "\n$gagal uji GAGAL\n" : "\nSemua lulus\n";
exit($gagal ? 1 : 0);
