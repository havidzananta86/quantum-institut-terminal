<?php
/**
 * Syarat hadiah kompetisi (api/_kompetisi_syarat.php): normalisasi, pengelompokan multi-akun,
 * daftar syarat, dan periode dari kunci. Tanpa database. Dijalankan oleh tests/kompetisi.test.js.
 */
define('QI_TEST', true);
require __DIR__ . '/../api/_kompetisi_syarat.php';

$gagal = 0;
function cek(string $n, bool $ok): void { global $gagal; echo '  ' . ($ok ? '✓' : '✗') . " $n\n"; if (!$ok) $gagal++; }

// Normalisasi
cek('gmail: titik & +tag diabaikan', qi_komp_normal_email('Budi.Santoso+lomba@Gmail.com') === 'budisantoso@gmail.com');
cek('googlemail = gmail', qi_komp_normal_email('budi.santoso@googlemail.com') === 'budisantoso@gmail.com');
cek('domain lain: titik tetap, +tag dibuang', qi_komp_normal_email('a.b+x@yahoo.com') === 'a.b@yahoo.com');
cek('telepon 0812… = +62 812…', qi_komp_normal_telp('0812-3456-7890') === qi_komp_normal_telp('+62 812 3456 7890'));
cek('telepon pendek diabaikan', qi_komp_normal_telp('12345') === '');
cek('IP publik khas', qi_komp_ip_khas('36.68.10.20'));
cek('IP privat/loopback diabaikan', !qi_komp_ip_khas('192.168.1.5') && !qi_komp_ip_khas('127.0.0.1') && !qi_komp_ip_khas('::1') && !qi_komp_ip_khas('10.0.0.8'));
cek('CGNAT 100.64/10 diabaikan', !qi_komp_ip_khas('100.70.1.1') && qi_komp_ip_khas('100.128.0.1'));
cek('IPv6 publik khas', qi_komp_ip_khas('2001:4860:4860::8888'));

// Pengelompokan
$t = qi_komp_tanda_multi([
    1 => ['email' => 'budi.santoso@gmail.com', 'telp' => '081234567890', 'ip' => ['36.68.10.20']],
    2 => ['email' => 'budisantoso+2@gmail.com', 'telp' => null, 'ip' => ['114.4.1.1']],      // email mirip 1
    3 => ['email' => 'sari@yahoo.com', 'telp' => '+62 812 3456 7890', 'ip' => []],             // telepon = 1
    4 => ['email' => 'andi@outlook.com', 'telp' => '', 'ip' => ['114.4.1.1', '192.168.0.2']], // IP = 2
    5 => ['email' => 'rina@gmail.com', 'telp' => '', 'ip' => ['192.168.0.2', '127.0.0.1']],   // hanya IP privat → bersih
    6 => ['email' => 'dewi@gmail.com', 'telp' => '', 'ip' => ['100.64.5.5']],                 // CGNAT bersama 7 → bersih
    7 => ['email' => 'eko@gmail.com', 'telp' => '', 'ip' => ['100.64.5.5']],
]);
cek('akun 1–4 ditandai', array_keys($t) === [1, 2, 3, 4]);
cek('akun 1–4 satu kelompok (rantai email→IP→telepon)', count(array_unique(array_column($t, 'kelompok'))) === 1 && $t[1]['ukuran'] === 4);
cek('alasan akun 1: email & telepon', in_array('email sama/mirip', $t[1]['alasan'], true) && in_array('nomor telepon sama', $t[1]['alasan'], true));
cek('alasan akun 4: IP saja', $t[4]['alasan'] === ['alamat IP publik sama']);
cek('IP privat & CGNAT tidak menandai', !isset($t[5]) && !isset($t[6]) && !isset($t[7]));
cek('tanpa kecocokan → kosong', qi_komp_tanda_multi([1 => ['email' => 'a@x.com'], 2 => ['email' => 'b@x.com']]) === []);

// Kelayakan
$set = qi_komp_syarat_setelan(['syarat' => ['min_trade' => 5, 'umur_akun_hari' => 7]]);
cek('setelan bawaan: DRAF', $set['ditetapkan'] === false && $set['min_trade'] === 5);
cek('setelan dibatasi wajar', qi_komp_syarat_setelan(['syarat' => ['min_trade' => -3, 'umur_akun_hari' => 999]])['min_trade'] === 1);
$akhir = 2_000_000_000;
$baik = ['terdaftar' => true, 'trades' => 6, 'dibuat' => $akhir - 30 * 86400, 'aktif' => true, 'ditandai' => null];
$k = qi_komp_kelayakan($baik, $set, $akhir);
cek('memenuhi semua syarat → layak', $k['layak'] && !$k['ditinjau'] && count($k['syarat']) === 5);
$k = qi_komp_kelayakan(['trades' => 4] + $baik, $set, $akhir);
cek('trade kurang → tidak layak', !$k['layak'] && !$k['ditinjau']);
$k = qi_komp_kelayakan(['dibuat' => $akhir - 3 * 86400] + $baik, $set, $akhir);
cek('akun baru 3 hari → tidak layak', !$k['layak'] && str_contains($k['syarat'][2]['detail'], '3 hari'));
$k = qi_komp_kelayakan(['ditandai' => ['alasan' => ['alamat IP publik sama']]] + $baik, $set, $akhir);
cek('ditandai multi-akun → ditinjau, belum layak', !$k['layak'] && $k['ditinjau']);
$k = qi_komp_kelayakan(['ditandai' => ['alasan' => ['x']], 'terdaftar' => false] + $baik, $set, $akhir);
cek('ditandai + syarat lain gagal → bukan ditinjau', !$k['layak'] && !$k['ditinjau']);
cek('pasar disebut di syarat', str_contains(qi_komp_kelayakan($baik, $set, $akhir, 'crypto')['syarat'][1]['label'], 'crypto'));

// Periode
$z = new DateTimeZone('Asia/Jakarta');
[$a, $b] = qi_komp_periode_dari_kunci('weekly', '2026-W42', $z);
cek('minggu ISO 2026-W42 = Senin 12 Okt – 19 Okt', $a->format('Y-m-d D') === '2026-10-12 Mon' && $b->format('Y-m-d') === '2026-10-19');
[$a, $b] = qi_komp_periode_dari_kunci('monthly', '2026-12', $z);
cek('bulan Desember → 1 Jan berikutnya', $a->format('Y-m-d') === '2026-12-01' && $b->format('Y-m-d') === '2027-01-01');
cek('kunci salah → null', qi_komp_periode_dari_kunci('weekly', '2026-10', $z) === null && qi_komp_periode_dari_kunci('daily', 'x', $z) === null);

// Aturan
$aturan = qi_komp_aturan(['jenis' => 'weekly', 'pasar' => 'semua', 'hadiah' => [['label' => 'Juara 1', 'nilai' => 20000]]], $set, true);
$teks = json_encode($aturan, JSON_UNESCAPED_UNICODE);
cek('aturan menyebut CONTOH selama draf', str_contains($teks, 'CONTOH'));
cek('aturan memuat angka syarat', str_contains($teks, 'Minimal 5 trade') && str_contains($teks, 'minimal 7 hari'));

echo $gagal ? "FAIL — $gagal gagal\n" : "PASS\n";
exit($gagal ? 1 : 0);
