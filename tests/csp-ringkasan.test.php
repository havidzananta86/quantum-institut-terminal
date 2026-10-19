<?php
/**
 * Uji ringkasan laporan CSP (api/_csp_ringkasan.php) dengan file .jsonl buatan di folder sementara.
 * Dijalankan oleh tests/csp-ringkasan.test.js.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_csp_ringkasan.php';

$gagal = 0;
function cek(string $nama, bool $lulus, $info = null): void
{
    global $gagal;
    echo '  ' . ($lulus ? '✓' : '✗') . ' ' . $nama . ($lulus || $info === null ? '' : '  ' . json_encode($info, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . "\n";
    if (!$lulus) $gagal++;
}

$dir = sys_get_temp_dir() . '/qi-csp-uji-' . bin2hex(random_bytes(4));
mkdir($dir);
$kini = gmmktime(12, 0, 0, 10, 19, 2026);
$baris = function (array $e): string { return json_encode($e, JSON_UNESCAPED_SLASHES) . "\n"; };
$lapor = fn(string $ts, string $doc, string $eff, string $blk, string $disp = 'report', string $ip = '1.1.1.1', string $sampel = '', string $src = '') =>
    ['ts' => $ts, 'blocked_uri' => $blk, 'violated' => $eff, 'effective' => $eff, 'document_uri' => $doc,
     'source_file' => $src, 'line' => 12, 'sample' => $sampel, 'disposition' => $disp, 'ip' => $ip];

file_put_contents("$dir/csp-2026-10-19.jsonl",
    $baris($lapor('2026-10-19T10:00:00+00:00', 'https://quantum-institut.com/dashboard.html?tok=RAHASIA', 'script-src-attr', 'inline', 'report', '1.1.1.1', 'switchPanel(\'x\')', 'https://quantum-institut.com/dashboard.html'))
  . $baris($lapor('2026-10-19T11:00:00+00:00', 'https://quantum-institut.com/dashboard.html', 'script-src-attr', 'inline', 'report', '2.2.2.2', 'switchPanel(\'x\')', 'https://quantum-institut.com/dashboard.html'))
  . $baris($lapor('2026-10-19T09:00:00+00:00', 'https://quantum-institut.com/dashboard.html', 'script-src-elem', 'inline'))
  . $baris($lapor('2026-10-19T09:30:00+00:00', 'https://quantum-institut.com/index.html', 'script-src-elem', 'https://evil.example/x.js?id=1', 'enforce'))
  . "bukan json\n");
file_put_contents("$dir/csp-2026-10-17.jsonl",
    $baris($lapor('2026-10-17T08:00:00+00:00', 'https://quantum-institut.com/dashboard.html', 'script-src-attr', 'inline')));
file_put_contents("$dir/csp-2026-10-01.jsonl",   // di luar rentang 7 hari
    $baris($lapor('2026-10-01T08:00:00+00:00', 'https://quantum-institut.com/login.html', 'script-src-elem', 'inline')));

echo "Pengelompokan\n";
$r = qi_csp_ringkasan($dir, 7, 'report', $kini);
cek('hanya file dalam rentang yang dibaca', $r['file'] === ['csp-2026-10-17.jsonl', 'csp-2026-10-19.jsonl'], $r['file']);
cek('disposisi report saja: 4 pelanggaran', $r['total'] === 4, $r['total']);
cek('hitungan per disposisi mencakup semua jenis', $r['per_disposisi'] === ['report' => 4, 'enforce' => 1], $r['per_disposisi']);
cek('baris rusak dihitung, tidak menggagalkan', $r['rusak'] === 1);
cek('2 grup: query string tidak memecah grup halaman', $r['jumlah_grup'] === 2, array_map(fn($g) => [$g['halaman'], $g['arahan'], $g['jumlah']], $r['grup']));
$g = $r['grup'][0];
cek('grup terbesar di atas: dashboard.html · script-src-attr · inline ×3', [$g['halaman'], $g['arahan'], $g['diblok'], $g['jumlah']]
    === ['https://quantum-institut.com/dashboard.html', 'script-src-attr', 'inline', 3], $g);
cek('pertama/terakhir lintas file', $g['pertama'] === '2026-10-17T08:00:00+00:00' && $g['terakhir'] === '2026-10-19T11:00:00+00:00');
cek('IP dihitung, tidak ditampilkan', $g['ip_berbeda'] === 2 && strpos(json_encode($r), '2.2.2.2') === false);
cek('contoh unik berisi sumber:baris dan sampel', in_array(['sumber' => 'https://quantum-institut.com/dashboard.html:12', 'sampel' => "switchPanel('x')"], $g['contoh'], true)
    && count($g['contoh']) === 2, $g['contoh']);
cek('isi query (token) tidak ikut tampil', strpos(json_encode($r), 'RAHASIA') === false);

echo "Filter\n";
$e = qi_csp_ringkasan($dir, 7, 'enforce', $kini);
cek('enforce: URL diblokir dipotong jadi origin+path', $e['total'] === 1 && $e['grup'][0]['diblok'] === 'https://evil.example/x.js', $e['grup']);
cek('semua: 5 pelanggaran', qi_csp_ringkasan($dir, 7, 'semua', $kini)['total'] === 5);
cek('rentang 31 hari ikut membaca file lama', qi_csp_ringkasan($dir, 99, 'report', $kini)['total'] === 5);
cek('disposisi tak dikenal → report', qi_csp_ringkasan($dir, 7, 'x', $kini)['disposisi'] === 'report');
cek('folder belum ada → kosong, tanpa galat', qi_csp_ringkasan($dir . '/tidak-ada', 7, 'report', $kini)['total'] === 0);

array_map('unlink', glob("$dir/*"));
rmdir($dir);
echo $gagal === 0 ? "\nSemua lulus\n" : "\n$gagal uji GAGAL\n";
exit($gagal === 0 ? 0 : 1);
