<?php
/** Pembantu uji: tambahkan $n rekor ke $berkas lewat qi_json_ubah (dijalankan paralel oleh kejujuran-data.test.js). */
declare(strict_types=1);
require __DIR__ . '/../api/_json_kunci.php';
[$_, $berkas, $n, $awalan] = $argv;
$gagal = 0;
for ($i = 0; $i < (int)$n; $i++) {
    $u = qi_json_ubah($berkas, function (array $d) use ($awalan, $i): array {
        usleep(2000);                         // perlebar jendela balapan baca → tulis
        $d[] = $awalan . '-' . $i;
        return $d;
    }, ['tunggu' => 20.0]);
    if (!$u['ok']) $gagal++;
}
exit($gagal === 0 ? 0 : 1);
