<?php
/**
 * Unduh template EA bridge dengan input Endpoint sudah terisi alamat deployment ini.
 *
 * Endpoint ini hanya menyajikan ulang file teks statis dari assets/mt-bridge/ setelah
 * mengganti placeholder YOUR-DOMAIN. Tidak ada data akun, tidak ada Bridge Key, dan
 * tidak ada akses database. Tujuannya menghilangkan penyebab kegagalan tersering:
 * placeholder YOUR-DOMAIN lupa diganti sebelum EA di-compile, sehingga WebRequest
 * ditolak MetaTrader (HTTP=-1) dan dashboard selamanya berstatus "menunggu snapshot".
 */
require_once __DIR__ . '/_middleware.php';
qi_rate_limit(60, 60);

$templates = [
    'mt5' => [
        'source' => 'QuantumReadOnlyBridge.mq5',
        'filename' => 'QuantumReadOnlyBridge.mq5',
        'endpoint_path' => 'mt-bridge.php?action=snapshot',
        'receiver' => 'mt-bridge.php',
    ],
    'mt4' => [
        'source' => 'QuantumReadOnlyBridge.mq4',
        'filename' => 'QuantumReadOnlyBridge.mq4',
        'endpoint_path' => 'mt-bridge.php?action=snapshot',
        'receiver' => 'mt-bridge.php',
    ],
    'mt5-exec' => [
        'source' => 'QuantumLiveExecutionMT5.mq5',
        'filename' => 'QuantumLiveExecutionMT5.mq5',
        'endpoint_path' => 'mt-execution.php',
        'receiver' => 'mt-execution.php',
    ],
];

function qi_ea_plain(string $message, int $status): void {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code($status);
    echo $message . "\n";
    exit();
}

$platform = $_GET['platform'] ?? 'mt5';
$platform = is_string($platform) ? strtolower(trim($platform)) : '';
if (!isset($templates[$platform])) {
    qi_ea_plain('Platform tidak dikenal. Gunakan mt5, mt4, atau mt5-exec.', 404);
}
$template = $templates[$platform];

// Host diambil dari request yang sedang dipakai pengguna, jadi hasil unduhan selalu
// cocok dengan domain tempat dashboard dibuka (produksi maupun localhost).
$host = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
if (!preg_match('/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/', $host)) {
    qi_ea_plain('Host tidak valid. Buka halaman ini dari domain webapp Anda.', 400);
}
$isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
    || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
$origin = ($isHttps ? 'https://' : 'http://') . $host;

$directory = (string)($_SERVER['SCRIPT_NAME'] ?? '/api/mt-bridge-ea.php');
$directory = rtrim((string)preg_replace('#[^A-Za-z0-9._/-]#', '', str_replace('\\', '/', dirname($directory))), '/');
$endpoint = $origin . $directory . '/' . $template['endpoint_path'];

$source = __DIR__ . '/../assets/mt-bridge/' . $template['source'];
$code = @file_get_contents($source);
if ($code === false) {
    qi_ea_plain('Template EA tidak tersedia di server.', 500);
}

// Ganti nilai input Endpoint (MQL5 "input string", MQL4 "extern string").
// Tanda titik-koma ikut dicocokkan supaya tidak berakhir menjadi ";;".
$code = (string)preg_replace_callback(
    '/(input|extern)\s+string\s+Endpoint\s*=\s*"[^"]*"\s*;?/',
    static function (array $match) use ($endpoint): string {
        return $match[1] . ' string Endpoint = "' . $endpoint . '";';
    },
    $code,
    1
);

$banner = '// Endpoint sudah diisi otomatis untuk deployment ini:' . "\n"
    . '//   ' . $endpoint . "\n"
    . '// Wajib di MetaTrader: Tools > Options > Expert Advisors > centang' . "\n"
    . '// "Allow WebRequest for listed URL" lalu tambahkan ' . $origin . "\n"
    . '// Diunduh ' . gmdate('Y-m-d H:i') . " UTC dari " . $origin . "\n\n";
$code = $banner . $code;

qi_log('info', 'Bridge EA downloaded', ['platform' => $platform, 'receiver' => $template['receiver']]);

header('Content-Type: text/plain; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $template['filename'] . '"');
header('Content-Length: ' . strlen($code));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
echo $code;
