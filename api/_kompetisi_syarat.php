<?php
/**
 * SYARAT KOMPETISI — siapa yang berhak atas hadiah (dipakai api/competition.php).
 *
 * Fungsi di sini murni (tanpa database) supaya bisa diuji: tests/kompetisi.test.php.
 *
 * Satu orang satu akun: akun peserta yang berbagi IP publik, nomor telepon, atau email yang
 * sama setelah dinormalkan (titik/+tag Gmail) dikelompokkan dan DITANDAI untuk ditinjau admin.
 * Tidak didiskualifikasi otomatis — jaringan bersama (kantor, kos, warnet) bisa cocok tanpa
 * kecurangan. IP privat, loopback, dan CGNAT operator seluler (100.64.0.0/10) diabaikan karena
 * dipakai bersama oleh banyak orang.
 */

if (!function_exists('qi_komp_syarat_setelan')):

/** Setelan syarat; admin menimpanya lewat cache/competition.json → "syarat". */
function qi_komp_syarat_setelan(?array $atur = null): array
{
    if ($atur === null) {
        $berkas = __DIR__ . '/../cache/competition.json';
        $atur = is_file($berkas) ? json_decode((string)@file_get_contents($berkas), true) : null;
    }
    $s = is_array($atur['syarat'] ?? null) ? $atur['syarat'] : [];
    return [
        'ditetapkan'     => !empty($s['ditetapkan']),                       // aturan resmi? (false = DRAF)
        'min_trade'      => max(1, min(100, (int)($s['min_trade'] ?? 5))),
        'umur_akun_hari' => max(0, min(90, (int)($s['umur_akun_hari'] ?? 7))),
    ];
}

/** Email dinormalkan: huruf kecil, tanpa +tag; Gmail juga tanpa titik. */
function qi_komp_normal_email(string $email): string
{
    $email = strtolower(trim($email));
    if (!str_contains($email, '@')) return $email;
    [$lokal, $domain] = explode('@', $email, 2);
    $lokal = explode('+', $lokal, 2)[0];
    if ($domain === 'googlemail.com') $domain = 'gmail.com';
    if ($domain === 'gmail.com') $lokal = str_replace('.', '', $lokal);
    return $lokal . '@' . $domain;
}

/** Nomor telepon → digit saja dengan awalan 62 (0812… dan +62812… sama). '' bila terlalu pendek. */
function qi_komp_normal_telp(?string $telp): string
{
    $d = preg_replace('/\D+/', '', (string)$telp);
    if (str_starts_with($d, '0')) $d = '62' . substr($d, 1);
    return strlen($d) >= 9 ? $d : '';
}

/** Apakah IP ini cukup khas untuk dicocokkan? (publik, bukan CGNAT) */
function qi_komp_ip_khas(?string $ip): bool
{
    $ip = trim((string)$ip);
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $n = ip2long($ip);
        if (($n & 0xFFC00000) === (ip2long('100.64.0.0') & 0xFFC00000)) return false;   // 100.64.0.0/10
    }
    return true;
}

/**
 * Kelompokkan akun yang tampak milik orang yang sama.
 * @param array<int,array{email?:string,telp?:?string,ip?:string[]}> $akun  uid => data
 * @return array<int,array{kelompok:int,ukuran:int,alasan:string[]}> hanya akun yang ditandai
 */
function qi_komp_tanda_multi(array $akun): array
{
    $induk = [];
    $cari = function (int $x) use (&$induk, &$cari): int { return $induk[$x] === $x ? $x : ($induk[$x] = $cari($induk[$x])); };
    foreach ($akun as $uid => $_) $induk[(int)$uid] = (int)$uid;

    $kunciKe = [];      // "jenis:nilai" => [uid…]
    foreach ($akun as $uid => $a) {
        $kunci = [];
        $e = qi_komp_normal_email((string)($a['email'] ?? ''));
        if ($e !== '' && str_contains($e, '@')) $kunci[] = 'email:' . $e;
        $t = qi_komp_normal_telp($a['telp'] ?? null);
        if ($t !== '') $kunci[] = 'telp:' . $t;
        foreach (array_unique((array)($a['ip'] ?? [])) as $ip) if (qi_komp_ip_khas($ip)) $kunci[] = 'ip:' . $ip;
        foreach (array_unique($kunci) as $k) $kunciKe[$k][] = (int)$uid;
    }

    $alasan = [];
    foreach ($kunciKe as $k => $uids) {
        if (count($uids) < 2) continue;
        $jenis = strstr($k, ':', true);
        $label = ['email' => 'email sama/mirip', 'telp' => 'nomor telepon sama', 'ip' => 'alamat IP publik sama'][$jenis];
        foreach ($uids as $u) { $alasan[$u][$label] = true; $induk[$cari($u)] = $cari($uids[0]); }
    }

    $ukuran = [];
    foreach (array_keys($alasan) as $u) $ukuran[$cari($u)] = ($ukuran[$cari($u)] ?? 0) + 1;
    $hasil = [];
    foreach ($alasan as $u => $a) {
        $hasil[$u] = ['kelompok' => $cari($u), 'ukuran' => $ukuran[$cari($u)], 'alasan' => array_keys($a)];
    }
    ksort($hasil);
    return $hasil;
}

/**
 * Daftar syarat untuk satu peserta.
 * @param array{terdaftar:bool,trades:int,dibuat:?int,aktif:bool,ditandai:?array} $p
 * @return array{layak:bool,ditinjau:bool,syarat:array<int,array{kunci:string,label:string,ok:bool,detail:string}>}
 */
function qi_komp_kelayakan(array $p, array $setelan, int $selesaiEpoch, string $pasar = 'semua'): array
{
    $umurHari = $p['dibuat'] ? (int)floor(($selesaiEpoch - (int)$p['dibuat']) / 86400) : 0;
    $namaPasar = ['crypto' => ' crypto', 'forex' => ' forex', 'gold' => ' emas'][$pasar] ?? '';
    $syarat = [
        ['kunci' => 'terdaftar', 'label' => 'Terdaftar di turnamen periode ini', 'ok' => (bool)$p['terdaftar'],
         'detail' => $p['terdaftar'] ? 'Sudah mendaftar.' : 'Tekan "Daftar Sekarang".'],
        ['kunci' => 'min_trade', 'label' => 'Minimal ' . $setelan['min_trade'] . ' trade' . $namaPasar . ' ditutup dalam periode', 'ok' => $p['trades'] >= $setelan['min_trade'],
         'detail' => $p['trades'] . ' dari ' . $setelan['min_trade'] . ' trade.'],
        ['kunci' => 'umur_akun', 'label' => 'Akun berumur minimal ' . $setelan['umur_akun_hari'] . ' hari saat periode berakhir', 'ok' => $umurHari >= $setelan['umur_akun_hari'],
         'detail' => 'Umur akun saat periode berakhir: ' . max(0, $umurHari) . ' hari.'],
        ['kunci' => 'akun_aktif', 'label' => 'Akun aktif (tidak dinonaktifkan)', 'ok' => (bool)$p['aktif'], 'detail' => $p['aktif'] ? 'Aktif.' : 'Akun nonaktif.'],
        ['kunci' => 'satu_akun', 'label' => 'Satu orang satu akun', 'ok' => empty($p['ditandai']),
         'detail' => empty($p['ditandai']) ? 'Tidak ada kecocokan dengan peserta lain.' : 'Perlu ditinjau admin: ' . implode(', ', $p['ditandai']['alasan']) . ' dengan akun peserta lain.'],
    ];
    $gagalTetap = array_filter($syarat, static fn($s) => !$s['ok'] && $s['kunci'] !== 'satu_akun');
    return ['layak' => !$gagalTetap && empty($p['ditandai']), 'ditinjau' => !$gagalTetap && !empty($p['ditandai']), 'syarat' => $syarat];
}

/** Rentang periode dari kuncinya ('2026-W42', '2026-10', '2026-10-17'). @return array{0:DateTimeImmutable,1:DateTimeImmutable}|null */
function qi_komp_periode_dari_kunci(string $jenis, string $kunci, DateTimeZone $zona): ?array
{
    if ($jenis === 'weekly' && preg_match('/^(\d{4})-W(\d{2})$/', $kunci, $m)) {
        $a = (new DateTimeImmutable('now', $zona))->setISODate((int)$m[1], (int)$m[2])->setTime(0, 0);
        return [$a, $a->modify('+7 days')];
    }
    if ($jenis === 'monthly' && preg_match('/^\d{4}-\d{2}$/', $kunci)) {
        $a = DateTimeImmutable::createFromFormat('!Y-m', $kunci, $zona);
        return $a ? [$a, $a->modify('first day of next month')] : null;
    }
    if ($jenis === 'daily' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $kunci)) {
        $a = DateTimeImmutable::createFromFormat('!Y-m-d', $kunci, $zona);
        return $a ? [$a, $a->modify('+1 day')] : null;
    }
    return null;
}

/** Bagian-bagian aturan untuk halaman Aturan. */
function qi_komp_aturan(array $t, array $setelan, bool $hadiahContoh): array
{
    $periode = ['weekly' => 'Senin 00:00 – Minggu 23:59 WIB', 'monthly' => 'tanggal 1 00:00 – akhir bulan 23:59 WIB', 'daily' => '00:00 – 23:59 WIB'][$t['jenis']] ?? '';
    $pasar = ['crypto' => 'pasangan crypto (…USDT)', 'gold' => 'emas (XAUUSD)', 'forex' => 'pasangan forex'][$t['pasar']] ?? 'semua pasar';
    return [
        ['judul' => 'Cara ikut', 'butir' => [
            ($t['skor'] ?? 'realisasi') === 'ekuitas'
                ? 'Anggota PRO/VIP otomatis terdaftar saat membuka order manual pertama periode ini, atau lewat tombol "Daftar Sekarang". Gratis.'
                : 'Daftar lewat tombol "Daftar Sekarang" kapan saja selama periode berjalan. Gratis.',
            'Gunakan Paper Trading di aplikasi ini — dana simulasi $10,000, tanpa setoran uang sungguhan.',
            'Dengan mendaftar, Anda menyetujui aturan di halaman ini.',
        ]],
        ['judul' => 'Penilaian', 'butir' => ($t['skor'] ?? 'realisasi') === 'ekuitas' ? [
            // Weekly Championship (audit kompetisi 2026-10-22): peringkat = EKUITAS LANGSUNG, bukan hanya
            // trade tertutup — posisi rugi yang dibiarkan terbuka ikut menurunkan peringkat.
            'Periode: ' . $periode . '. Setiap order manual Anda masuk periode tempat order itu DIBUKA (jam server).',
            'Peringkat = ekuitas: $10,000 + P/L tertutup + P/L mengambang posisi terbuka periode itu, dinilai di harga penutup (BUY di bid, SELL di ask). Return % = (ekuitas − $10,000) ÷ $10,000.',
            'Ekuitas sama = peringkat sama (1, 1, 3). Peserta terdaftar yang belum trading tampil di bawah para trader.',
            'Harga entry dan exit ditentukan server dari satu feed harga yang sama untuk semua peserta; harga di layar hanya batas requote.',
            // Audit G1: janji ini harus sama dengan yang ditegakkan api/_kompetisi_settle.php — bar M1 hanya
            // bila feed-nya menyediakan bar; feed tanpa bar (mis. Twelve Data) dinilai di kutipan live.
            'Stop loss & take profit ditegakkan server, juga saat Anda offline: di bar M1 dari feed yang sama bila feed itu menyediakan bar (MT5, OANDA, Binance, PAXG), selain itu di kutipan live setiap pemeriksaan. Leverage 1:' . (defined('QI_KOMP_LEVERAGE') ? QI_KOMP_LEVERAGE : 100) . '; order ditolak bila margin bebas tidak cukup, dan level margin di bawah 50% menutup posisi paling rugi (stop-out) — kaki yang sedang tanpa harga dihitung di harga nyata terakhirnya.',
            'XAUUSD saat bridge emas tidak tersedia memakai PROKSI PAXG (Binance) + selisih tetap ke emas; proksi dianggap tutup di luar jam pasar emas. Setiap posisi dinilai dan ditutup HANYA di seri harga tempat ia dibuka (emas nyata atau proksi) — bila seri itu sedang tidak tersedia, penutupan ditunda, tidak dipindah ke seri lain.',
            'Posisi yang masih terbuka di akhir periode ditutup server pada harga nyata terakhir sebelum batas periode (bar M1 terakhir, atau kutipan feed terakhir yang tercatat sebelum batas) dan tidak bisa lagi ditutup atau diubah pemiliknya. Bila server tidak pernah mencatat harga apa pun sebelum batas, posisi dibatalkan tanpa P/L 72 jam kemudian — tidak pernah ditutup di harga tebakan. Klasemen akhir dibekukan setelah semua posisi periode itu selesai.',
            'Hanya order manual. AI Auto-Trade, Ikuti Auto Analisa, dan salinan sekali-klik sinyal AI tidak masuk papan.',
            'Papan peringkat menampilkan semua trader; posisi juara dihitung hanya dari peserta yang memenuhi syarat.',
        ] : [
            'Periode: ' . $periode . '. Yang dihitung hanya trade (' . $pasar . ') yang DITUTUP dalam periode itu.',
            'Profit % = total P&L ÷ saldo simulasi awal $10,000. Bila sama, jumlah trade lebih banyak di atas.',
            'Harga entry dan exit diverifikasi server terhadap harga pasar; trade dengan harga tidak wajar ditolak dan tidak pernah masuk papan.',
            'Papan peringkat menampilkan semua trader; posisi juara dihitung hanya dari peserta yang memenuhi syarat.',
        ]],
        ['judul' => 'Syarat berhak atas hadiah', 'butir' => [
            'Terdaftar di turnamen periode tersebut.',
            'Minimal ' . $setelan['min_trade'] . ' trade ditutup dalam periode.',
            'Akun aktif dan berumur minimal ' . $setelan['umur_akun_hari'] . ' hari saat periode berakhir.',
            'Lolos pemeriksaan satu orang satu akun (di bawah).',
        ]],
        ['judul' => 'Satu orang satu akun', 'butir' => [
            'Akun peserta yang berbagi alamat IP publik, nomor telepon, atau email yang sama (termasuk variasi titik/+ pada Gmail) ditandai untuk ditinjau admin.',
            'Peninjauan dilakukan manual karena jaringan bersama (kantor, kos, warnet) bisa cocok tanpa kecurangan.',
            'Bila terbukti satu orang memakai beberapa akun, semua akun terkait didiskualifikasi dari periode itu. Satu orang paling banyak satu hadiah per periode.',
        ]],
        ['judul' => 'Hadiah', 'butir' => array_merge(
            array_map(static fn($h) => $h['label'] . ': $' . number_format((float)$h['nilai']) . (!empty($h['total']) ? ' (total)' : ''), $t['hadiah']),
            [$hadiahContoh
                ? 'Nilai hadiah di atas masih CONTOH. Hadiah dan aturan resmi diumumkan admin sebelum berlaku.'
                : 'Pemenang ditetapkan admin setelah peninjauan syarat; cara penyerahan hadiah diumumkan bersama hasil.']
        )],
    ];
}

endif;
