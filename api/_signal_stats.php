<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — STATISTIK REKOR SINYAL (satuan R)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mengapa satuan R? Karena membandingkan P&L dolar antar simbol itu menyesatkan:
 * satu lot BTCUSDT bisa −167 USD sementara satu lot SOLUSDT −0,22 USD — padahal
 * keduanya sama-sama "kalah 1R". Dengan R (kelipatan risiko), semua sinyal
 * sebanding dan kualitas sistem bisa diukur jujur.
 *
 * Rumus yang dipakai (semua teruji di tests/signal-stats.test.php):
 *   · R per sinyal tertutup = (exit − entry) / (entry − sl)          → BUY
 *                             (entry − exit) / (sl − entry)          → SELL
 *   · Win rate  = menang / (menang + kalah)
 *   · Interval keyakinan 95% = metode WILSON (lebih tepat dari normal
 *     approximation untuk sampel kecil — dan sampel kita memang kecil).
 *   · Expectancy (R) = (winRate × rataMenangR) − (lossRate × rataKalahR)
 *   · Profit factor  = total R menang / total |R kalah|  (null bila belum ada kalah)
 *
 * KEJUJURAN: bila sinyal belum punya exit_price (mis. dinilai versi lama), R
 * dihitung dari RENCANA (rr, mis. "1 : 2.50") dengan tanda sesuai status, dan
 * jumlah sinyal seperti itu dilaporkan sebagai 'r_dari_rencana' supaya pembaca
 * tahu ada perkiraan — bukan disembunyikan.
 */

require_once __DIR__ . '/_signal_time.php';   // urutan waktu rekor: epoch, bukan string

if (!function_exists('qi_signal_r_satu')) :

/**
 * Hitung R satu catatan sinyal.
 * @return array{r: float|null, sumber: string}
 */
function qi_signal_r_satu(array $rek): array
{
    $status = (string)($rek['status'] ?? '');
    $menang = (strpos($status, 'HIT TP') === 0);
    $kalah  = (strpos($status, 'HIT SL') === 0);
    if (!$menang && !$kalah) return ['r' => null, 'sumber' => 'belum_selesai'];

    // 1) Utamakan R NYATA dari harga keluar.
    $entry = (float)($rek['entry'] ?? 0);
    $sl    = (float)($rek['sl'] ?? 0);
    $exit  = (float)($rek['exit_price'] ?? 0);
    $side  = strtoupper((string)($rek['side'] ?? ''));
    if ($entry > 0 && $sl > 0 && $exit > 0 && $entry !== $sl) {
        $r = ($side === 'SELL')
            ? ($entry - $exit) / ($sl - $entry)
            : ($exit - $entry) / ($entry - $sl);
        if (is_finite($r)) return ['r' => round($r, 4), 'sumber' => 'exit_price'];
    }

    // 2) Cadangan: R RENCANA dari teks "1 : 2.50".
    //    ⚠️ KOREKSI PENTING: untuk transaksi yang KALAH, R = **−1** (kerugian dibatasi SL),
    //    BUKAN −RR. Sebelumnya kode mengembalikan -RR (mis. −2,5R) sehingga satu kerugian
    //    dihitung 2,5× lebih besar dan expectancy/profit factor menjadi salah.
    //    Pengukuran 2026-10-13: seluruh 7 rekor tertutup sudah memakai harga keluar nyata,
    //    jadi kekeliruan ini belum mencemari angka yang tampil — tetapi WAJIB diperbaiki
    //    agar rekor tanpa harga keluar (mis. dari webhook tanpa harga eksekusi) tidak salah.
    $rrTeks = (string)($rek['rr'] ?? '');
    if (preg_match('/:\s*([0-9]+(?:\.[0-9]+)?)/', $rrTeks, $m)) {
        $r = (float)$m[1];
        if ($r > 0) {
            // Label 'rr_rencana' dipertahankan untuk KEDUA kasus supaya penghitung
            // "R dari rencana" (r_dari_rencana) tetap akurat. Yang diperbaiki hanya nilainya:
            // menang = +RR (target tercapai), kalah = −1R (kerugian dibatasi SL).
            return ['r' => round($menang ? $r : -1.0, 4), 'sumber' => 'rr_rencana'];
        }
    }
    return ['r' => null, 'sumber' => 'tidak_ada_data'];
}

/** Interval keyakinan Wilson untuk proporsi (95%). */
function qi_wilson_ci(int $menang, int $n, float $z = 1.96): array
{
    if ($n <= 0) return ['bawah' => null, 'atas' => null];
    $p = $menang / $n;
    $z2 = $z * $z;
    $penyebut = 1 + $z2 / $n;
    $tengah = ($p + $z2 / (2 * $n)) / $penyebut;
    $setengah = ($z / $penyebut) * sqrt($p * (1 - $p) / $n + $z2 / (4 * $n * $n));
    return [
        'bawah' => round(max(0.0, $tengah - $setengah) * 100, 1),
        'atas'  => round(min(1.0, $tengah + $setengah) * 100, 1),
    ];
}

/**
 * Statistik lengkap dari daftar catatan sinyal.
 * @param array $records daftar catatan dari cache/signal_history.json
 */
function qi_signal_statistik(array $records): array
{
    $menang = 0; $kalah = 0; $aktif = 0; $expired = 0; $lain = 0;
    $rMenang = []; $rKalah = []; $rSemua = [];
    $dariRencana = 0;
    $perSimbol = []; $perArah = [];

    foreach ($records as $rek) {
        if (!is_array($rek)) continue;
        $status = (string)($rek['status'] ?? '');
        $simbol = (string)($rek['symbol'] ?? '?');
        $arah   = strtoupper((string)($rek['side'] ?? '?'));

        if ($status === 'AKTIF') { $aktif++; continue; }
        if (strpos($status, 'EXPIRED') === 0) { $expired++; continue; }

        $hasil = qi_signal_r_satu($rek);
        $r = $hasil['r'];
        $isMenang = (strpos($status, 'HIT TP') === 0);
        $isKalah  = (strpos($status, 'HIT SL') === 0);
        if (!$isMenang && !$isKalah) { $lain++; continue; }

        if ($isMenang) { $menang++; if ($r !== null) $rMenang[] = $r; }
        else           { $kalah++;  if ($r !== null) $rKalah[]  = $r; }
        if ($r !== null) {
            $rSemua[] = $r;
            if ($hasil['sumber'] === 'rr_rencana') $dariRencana++;
        }

        // Inisialisasi dua peta (per simbol & per arah) untuk entri ini.
        if (!isset($perSimbol[$simbol])) $perSimbol[$simbol] = ['n' => 0, 'w' => 0, 'r' => 0.0];
        if (!isset($perArah[$arah]))     $perArah[$arah]     = ['n' => 0, 'w' => 0, 'r' => 0.0];
        $perSimbol[$simbol]['n']++;
        $perArah[$arah]['n']++;
        if ($isMenang) { $perSimbol[$simbol]['w']++; $perArah[$arah]['w']++; }
        if ($r !== null) { $perSimbol[$simbol]['r'] += $r; $perArah[$arah]['r'] += $r; }
    }

    $dinilai = $menang + $kalah;
    $winRate = $dinilai > 0 ? round($menang / $dinilai * 100, 1) : null;
    $ci = qi_wilson_ci($menang, $dinilai);
    $rataMenangR = $rMenang ? round(array_sum($rMenang) / count($rMenang), 3) : null;
    $rataKalahR  = $rKalah  ? round(array_sum($rKalah)  / count($rKalah), 3)  : null;
    $rataR       = $rSemua  ? round(array_sum($rSemua)  / count($rSemua), 3)  : null;

    // Expectancy HANYA dari R nyata. Dulu bila rata-rata R menang tidak ada dipakai asumsi 2,5R (dan kalah −1R),
    // yaitu angka yang tidak pernah terjadi. Sekarang null ("belum bisa dihitung") bila data R-nya tidak ada.
    $expectancy = null;
    if ($dinilai > 0 && ($menang === 0 || $rataMenangR !== null) && ($kalah === 0 || $rataKalahR !== null)) {
        $expectancy = round(($menang / $dinilai) * ($rataMenangR ?? 0.0) + ($kalah / $dinilai) * ($rataKalahR ?? 0.0), 3);
    }

    $grossWin  = $rMenang ? array_sum($rMenang) : 0.0;
    $grossLoss = $rKalah ? abs(array_sum($rKalah)) : 0.0;
    $profitFactor = $grossLoss > 0 ? round($grossWin / $grossLoss, 2) : null;

    // Titik impas untuk R:R rata-rata: p = 1 / (1 + RR).
    $rrRata = null;
    if ($rataMenangR !== null && $rataKalahR !== null && $rataKalahR != 0.0) {
        $rrRata = round(abs($rataMenangR / $rataKalahR), 2);
    }
    $titikImpas = $rrRata ? round(100 / (1 + $rrRata), 1) : null;

    $cukup = ($dinilai >= 30);
    $catatan = $cukup
        ? 'Sampel memadai untuk penilaian awal (≥30 sinyal tertutup).'
        : 'Sampel masih kecil (' . $dinilai . ' sinyal tertutup). Interval keyakinan sangat lebar — jangan menyimpulkan kualitas sistem dari angka ini saja.';

    $ringkas = function (array $arr): array {
        $out = [];
        foreach ($arr as $k => $d) {
            $out[] = [
                'nama'     => $k,
                'sinyal'   => $d['n'],
                'menang'   => $d['w'],
                'win_rate' => $d['n'] ? round($d['w'] / $d['n'] * 100, 1) : null,
                'total_r'  => round($d['r'], 2),
            ];
        }
        usort($out, fn($a, $b) => $b['sinyal'] <=> $a['sinyal']);
        return $out;
    };

    return [
        'menang'          => $menang,
        'kalah'           => $kalah,
        'dinilai'         => $dinilai,
        'aktif'           => $aktif,
        'kedaluwarsa'     => $expired,
        'lain'            => $lain,
        'win_rate'        => $winRate,
        'ci_bawah'        => $ci['bawah'],
        'ci_atas'         => $ci['atas'],
        'rata_r'          => $rataR,
        'rata_menang_r'   => $rataMenangR,
        'rata_kalah_r'    => $rataKalahR,
        'expectancy_r'    => $expectancy,
        'profit_factor'   => $profitFactor,
        'rr_rata'         => $rrRata,
        'titik_impas_pct' => $titikImpas,
        'total_r'         => $rSemua ? round(array_sum($rSemua), 2) : null,
        'sampel'          => $dinilai,
        'cukup_sampel'    => $cukup,
        'r_dari_rencana'  => $dariRencana,
        'catatan'         => $catatan,
        'per_simbol'      => $ringkas($perSimbol),
        'per_arah'        => $ringkas($perArah),
        'satuan'          => 'R (kelipatan risiko) — 1R = jarak entry ke stop loss',
    ];
}

/**
 * Nama & cara kerja tiap mesin, ditulis apa adanya.
 * Satu sumber kebenaran: klien tidak boleh mengarang label sendiri.
 */
function qi_engine_label(string $engine): array
{
    $e = strtoupper(trim($engine));
    $peta = [
        'AUTO_SIGNAL' => ['label' => 'Mesin Otomatis', 'cara' => 'EMA20/50 + RSI14 + MACD (M15–D1), level dari ATR14'],
        'TRADINGVIEW' => ['label' => 'TradingView + AI', 'cara' => 'Alert TradingView dianalisa AI lalu dicatat'],
        'AI'          => ['label' => 'Analisa AI', 'cara' => 'Keputusan model AI (Groq)'],
        'AI_SIGNAL'   => ['label' => 'Analisa AI', 'cara' => 'Keputusan model AI (Groq)'],
        'NEWS'        => ['label' => 'News Setup (High Impact)', 'cara' => 'Diterbitkan ~5 menit sebelum rilis data High impact; level dari ATR14 (SL 2×ATR, TP 1,5×SL). Risiko lebih tinggi — statistiknya dipisah agar tidak mencampuri mesin teknikal.'],
        'MANUAL'      => ['label' => 'Input Manual', 'cara' => 'Dimasukkan admin lewat panel'],
    ];
    if (isset($peta[$e])) return ['kode' => $e] + $peta[$e];
    if ($e === '') return ['kode' => '', 'label' => 'Tanpa Label', 'cara' => 'Catatan lama yang belum punya kolom engine'];
    return ['kode' => $e, 'label' => $e, 'cara' => 'Nama mesin tidak dikenali — ditampilkan apa adanya'];
}

/**
 * Statistik R DIPISAH PER MESIN.
 *
 * Ini yang menjawab pertanyaan "berapa persentase kemenangan sinyal AI?" dengan
 * jujur: setiap mesin dihitung sendiri. Mesin yang belum punya sinyal tertutup
 * mengembalikan win_rate = null (bukan 0%) disertai penjelasan — angka 0% akan
 * menyesatkan karena tampak seperti "selalu kalah", padahal artinya "belum ada data".
 *
 * @return array daftar mesin, diurutkan: yang sudah ada penilaian lebih dulu.
 */
function qi_signal_statistik_per_engine(array $records): array
{
    $kelompok = [];
    foreach ($records as $r) {
        if (!is_array($r)) continue;
        $e = strtoupper(trim((string)($r['engine'] ?? '')));
        if (!isset($kelompok[$e])) $kelompok[$e] = [];
        $kelompok[$e][] = $r;
    }

    // Mesin yang relevan SELALU ditampilkan walau belum punya catatan sama sekali.
    // Alasannya praktis: pertanyaan pengguna adalah "berapa win rate sinyal AI?" —
    // bila barisnya tidak ada, panel terlihat seperti tidak menjawab. Dengan baris
    // kosong + penjelasan, jawabannya tampil di tabel: "belum ada data (bukan 0%)".
    // NEWS ikut dijamin muncul supaya kategori sinyal berita selalu terlihat.
    foreach (['AI', 'TRADINGVIEW', 'NEWS'] as $mesinWajib) {
        if (!isset($kelompok[$mesinWajib])) $kelompok[$mesinWajib] = [];
    }

    $keluar = [];
    foreach ($kelompok as $e => $daftar) {
        $info = qi_engine_label((string)$e);
        $s = qi_signal_statistik($daftar);
        $keluar[] = [
            'engine'          => $info['kode'] !== '' ? $info['kode'] : '(tanpa label)',
            'label'           => $info['label'],
            'cara'            => $info['cara'],
            'total'           => count($daftar),
            'dinilai'         => $s['dinilai'],
            'menang'          => $s['menang'],
            'kalah'           => $s['kalah'],
            'aktif'           => $s['aktif'],
            'kedaluwarsa'     => $s['kedaluwarsa'],
            'win_rate'        => $s['win_rate'],
            'ci_bawah'        => $s['ci_bawah'],
            'ci_atas'         => $s['ci_atas'],
            'expectancy_r'    => $s['expectancy_r'],
            'profit_factor'   => $s['profit_factor'],
            'rata_r'          => $s['rata_r'],
            'total_r'         => $s['total_r'],
            'titik_impas_pct' => $s['titik_impas_pct'],
            'rr_rata'         => $s['rr_rata'],
            'cukup_sampel'    => $s['cukup_sampel'],
            'catatan'         => $s['dinilai'] > 0
                ? $s['catatan']
                : 'Belum ada sinyal tertutup dari mesin ini — persentase kemenangannya belum bisa dihitung (bukan 0%).',
        ];
    }

    usort($keluar, function (array $a, array $b): int {
        $aAda = $a['dinilai'] > 0;
        $bAda = $b['dinilai'] > 0;
        if ($aAda !== $bAda) return $bAda ? 1 : -1;      // yang sudah dinilai di atas
        if ($a['total'] !== $b['total']) return $b['total'] <=> $a['total'];
        return strcmp((string)$a['engine'], (string)$b['engine']);
    });
    return $keluar;
}

/**
 * GRADE SINYAL A/B/C — kekuatan konfluensi, dihitung dari data yang SUDAH tersimpan.
 *
 * Kejujuran yang dipegang:
 *   · Ini BUKAN ramalan dan BUKAN jaminan menang. Ia hanya merangkum berapa banyak
 *     bukti yang mendukung sebuah sinyal saat sinyal itu dibuat, supaya pengguna bisa
 *     membandingkan mutu antar sinyal dan menimbang ukuran posisi.
 *   · Bidang yang dipakai adalah bidang yang NYATA tersimpan di rekor (diperiksa pada
 *     15 rekor produksi): confluence_score, mtf_aligned, setuju_bull/setuju_bear, rr.
 *     (Catatan: 'confidence'/'ai_setuju' TIDAK ada di rekor AUTO_SIGNAL, jadi tidak
 *     dipakai — dulu saya sempat menduga ada, dan pengukuran membuktikan sebaliknya.)
 *   · Nilainya DETERMINISTIK: rekor yang sama selalu menghasilkan grade yang sama,
 *     sehingga bisa diuji dengan hitungan tangan (tests/signal-grade.test.php).
 *
 * Aturan skor (maksimum 6):
 *   confluence_score ≥ 85 → 3 · ≥ 75 → 2 · ≥ 65 → 1 · selain itu 0
 *   mtf_aligned === true            → 1
 *   mesin setuju (bull atau bear) ≥ 3 → 1
 *   R:R ≥ 2,0                       → 1
 * Grade: A = skor ≥ 5 **dan MTF selaras** · B = skor 3–4 · C = skor ≤ 2
 *
 * Mengapa MTF menjadi SYARAT untuk grade A: sinyal yang timeframe besarnya (H4/D1)
 * sedang berlawanan arah adalah kelemahan nyata dalam trading — memberinya grade
 * tertinggi akan menyesatkan pengguna saat menimbang ukuran posisi. Skor tinggi
 * tanpa keselarasan MTF tetap dihargai sebagai B, bukan A.
 */
function qi_signal_grade(array $rek): string
{
    if (!is_array($rek) || !$rek) return 'C';

    // 1. Skor konfluensi (bidang utama, terbukti ada di rekor nyata).
    $konfluensi = null;
    foreach (['confluence_score', 'confidence', 'ai_keyakinan'] as $kunci) {
        if (isset($rek[$kunci]) && is_numeric($rek[$kunci])) { $konfluensi = (float)$rek[$kunci]; break; }
    }

    // 2. Keselarasan multi-timeframe.
    $mtf = ($rek['mtf_aligned'] ?? null) === true;

    // 3. Jumlah mesin yang setuju (bull atau bear; '-' berarti tidak dicatat).
    $bull = isset($rek['setuju_bull']) && is_numeric($rek['setuju_bull']) ? (int)$rek['setuju_bull'] : 0;
    $bear = isset($rek['setuju_bear']) && is_numeric($rek['setuju_bear']) ? (int)$rek['setuju_bear'] : 0;
    $setuju = max($bull, $bear);

    // 4. R:R — dari 'rr' bila ada, kalau tidak dihitung dari entry/sl/tp.
    $rr = null;
    if (isset($rek['rr']) && is_numeric($rek['rr'])) {
        $rr = (float)$rek['rr'];
    } else {
        $masuk = isset($rek['entry']) && is_numeric($rek['entry']) ? (float)$rek['entry'] : null;
        $sl    = isset($rek['sl']) && is_numeric($rek['sl']) ? (float)$rek['sl'] : null;
        $tp    = isset($rek['tp']) && is_numeric($rek['tp']) ? (float)$rek['tp'] : null;
        if ($masuk !== null && $sl !== null && $tp !== null && abs($masuk - $sl) > 0) {
            $rr = abs($tp - $masuk) / abs($masuk - $sl);
        }
    }

    $skor = 0;
    if ($konfluensi !== null) { $skor += $konfluensi >= 85 ? 3 : ($konfluensi >= 75 ? 2 : ($konfluensi >= 65 ? 1 : 0)); }
    if ($mtf) { $skor += 1; }
    if ($setuju >= 3) { $skor += 1; }
    if ($rr !== null && $rr >= 2.0) { $skor += 1; }

    if ($skor >= 5 && $mtf) return 'A';
    if ($skor >= 3) return 'B';
    return 'C';
}

/**
 * Statistik R dipisah per GRADE A/B/C.
 *
 * Grade diambil dari rekor bila sudah tersimpan ('grade'), kalau tidak dihitung ulang
 * dengan qi_signal_grade() — sehingga rekor lama tetap ikut terkelompok dengan benar.
 * Baris A/B/C SELALU ditampilkan; bila belum ada sinyal tertutup, win rate = null dan
 * catatannya jujur ("belum bisa dihitung — bukan 0%"), bukan angka karangan.
 */
function qi_signal_statistik_per_grade(array $records): array
{
    $kelompok = ['A' => [], 'B' => [], 'C' => []];
    foreach ($records as $r) {
        if (!is_array($r)) continue;
        $g = strtoupper(trim((string)($r['grade'] ?? '')));
        if (!isset($kelompok[$g])) $g = qi_signal_grade($r);
        if (!isset($kelompok[$g])) $kelompok[$g] = [];
        $kelompok[$g][] = $r;
    }

    $arti = [
        'A' => 'Konfluensi kuat (keyakinan tinggi + banyak konfirmasi + R:R baik)',
        'B' => 'Konfluensi sedang',
        'C' => 'Konfluensi dasar / bukti masih sedikit',
    ];

    $keluar = [];
    foreach (['A', 'B', 'C'] as $g) {
        $daftar = $kelompok[$g];
        $s = qi_signal_statistik($daftar);
        $keluar[] = [
            'grade'           => $g,
            'arti'            => $arti[$g],
            'total'           => count($daftar),
            'dinilai'         => $s['dinilai'],
            'menang'          => $s['menang'],
            'kalah'           => $s['kalah'],
            'aktif'           => $s['aktif'],
            'kedaluwarsa'     => $s['kedaluwarsa'],
            'win_rate'        => $s['win_rate'],
            'ci_bawah'        => $s['ci_bawah'],
            'ci_atas'         => $s['ci_atas'],
            'expectancy_r'    => $s['expectancy_r'],
            'profit_factor'   => $s['profit_factor'],
            'rata_r'          => $s['rata_r'],
            'total_r'         => $s['total_r'],
            'titik_impas_pct' => $s['titik_impas_pct'],
            'rr_rata'         => $s['rr_rata'],
            'cukup_sampel'    => $s['cukup_sampel'],
            'catatan'         => $s['dinilai'] > 0
                ? $s['catatan']
                : 'Belum ada sinyal tertutup bergrade ' . $g . ' — persentase kemenangannya belum bisa dihitung (bukan 0%).',
        ];
    }
    return $keluar;
}

/**
 * DRAWDOWN (penurunan modal) — dihitung dari KURVA R, bukan "pnl_usd dibagi puncak laba".
 *
 * KENAPA DIPERBAIKI: cara lama memakai pembagi PUNCAK LABA dan MENGOCOK `if ($peak > 0)`,
 * sehingga (a) kerugian di AWAL tidak pernah terhitung (drawdown selalu 0%), dan (b) satuannya
 * dolar per 1 lot yang tidak sebanding antar simbol (BTC vs EURUSD). Akibatnya panel
 * menampilkan "Max DD 0%" padahal ada kerugian — menyesatkan.
 *
 * Definisi baru yang jujur:
 *   · Kurva modal dihitung dari nilai R tiap transaksi (R = 1× risiko), berurutan waktu.
 *   · Mulai dari 0 → kerugian PERTAMA pun terhitung sebagai penurunan (tidak diabaikan).
 *   · r   = penurunan puncak-ke-dasar terbesar dalam satuan R.
 *   · usd = versi dolar (per 1 lot) dengan cara yang sama, untuk yang berpikir dalam dolar.
 *   · pct = persentase terhadap PUNCAK kurva R **hanya bila puncaknya > 0**; bila kurva belum
 *     pernah di atas titik awal, nilainya null — bukan 0% yang menyesatkan.
 *
 * @param array $records daftar rekor sinyal
 * @return array{r:float,usd:float,pct:?float,r_terburuk:float,titik_puncak:?string,titik_dasar:?string,dinilai:int,catatan:string}
 */
function qi_signal_drawdown(array $records): array
{
    $urut = [];
    foreach ($records as $r) {
        if (!is_array($r)) continue;
        $status = strtoupper((string)($r['status'] ?? ''));
        // Hanya transaksi yang SUDAH selesai yang membentuk kurva modal.
        if (strpos($status, 'HIT TP') !== 0 && strpos($status, 'HIT SL') !== 0) continue;
        $hasil = qi_signal_r_satu($r);
        if ($hasil['r'] === null) continue;
        $urut[] = [
            'r'   => (float)$hasil['r'],
            'usd' => (float)($r['pnl_usd'] ?? 0),
            'ts'  => qi_sig_epoch($r['timestamp'] ?? null) ?? 0,   // format lama & ISO UTC bercampur
            'id'  => (string)($r['id'] ?? ''),
        ];
    }
    if (!$urut) {
        return ['r' => 0.0, 'usd' => 0.0, 'pct' => null, 'r_terburuk' => 0.0,
                'titik_puncak' => null, 'titik_dasar' => null, 'dinilai' => 0,
                'catatan' => 'Belum ada transaksi tertutup, sehingga drawdown belum bisa dihitung.'];
    }
    usort($urut, fn($a, $b) => $a['ts'] <=> $b['ts']);

    $puncakR = 0.0; $puncakUsd = 0.0; $kumR = 0.0; $kumUsd = 0.0;
    $ddR = 0.0; $ddUsd = 0.0; $ddPct = null; $rTerburuk = 0.0;
    $idPuncak = null; $idDasar = null; $idPuncakSaatIni = null;

    foreach ($urut as $t) {
        $kumR   += $t['r'];
        $kumUsd += $t['usd'];
        if ($kumR > $puncakR) { $puncakR = $kumR; $idPuncakSaatIni = $t['id']; }
        if ($kumUsd > $puncakUsd) { $puncakUsd = $kumUsd; }
        $turunR = $puncakR - $kumR;
        if ($turunR > $ddR) {
            $ddR = $turunR;
            $idPuncak = $idPuncakSaatIni;
            $idDasar = $t['id'];
            // PENTING: persentase HARUS dari momen drawdown terbesar ini, bukan dari momen
            // lain. Bila pada momen itu puncak kurva masih 0 (mis. rugi sejak awal), maka
            // persentase memang tidak sah → dibiarkan null, bukan 0% yang menyesatkan.
            $ddPct = ($puncakR > 0) ? (($puncakR - $kumR) / $puncakR * 100.0) : null;
        }
        $turunUsd = $puncakUsd - $kumUsd;
        if ($turunUsd > $ddUsd) $ddUsd = $turunUsd;
        if ($t['r'] < $rTerburuk) $rTerburuk = $t['r'];
    }

    return [
        'r'            => round($ddR, 3),
        'usd'          => round($ddUsd, 4),
        'pct'          => ($ddPct === null) ? null : round($ddPct, 1),
        'r_terburuk'   => round($rTerburuk, 3),
        'titik_puncak' => $idPuncak,
        'titik_dasar'  => $idDasar,
        'dinilai'      => count($urut),
        'catatan'      => ($ddPct === null)
            ? ('Drawdown ' . round($ddR, 3) . 'R dari ' . count($urut) . ' transaksi tertutup. Persentase belum bisa dihitung karena kurva modal belum pernah di atas titik awal (bukan 0%).')
            : ('Drawdown ' . round($ddR, 3) . 'R (' . round($ddPct, 1) . '% dari puncak kurva) dari ' . count($urut) . ' transaksi tertutup.'),
    ];
}

/**
 * KALIBRASI AMBANG KEYAKINAN (berbasis data, bukan perasaan).
 *
 * Pertanyaan yang dijawab: "pada tingkat keyakinan berapa sistem benar-benar
 * menghasilkan?" Caranya: sinyal tertutup dikelompokkan menurut nilai keyakinan
 * (kolom 'confidence', atau 'confluence_score' untuk catatan lama), lalu dihitung
 * win rate & expectancy tiap kelompok — dalam R, bukan dolar.
 *
 * ATURAN KEJUJURAN (penting):
 *   · Bila sinyal tertutup < $minSampel (bawaan 30), verdict = "belum bisa
 *     ditentukan" dan saran_ambang = null. Mengubah ambang dari sampel kecil
 *     adalah curve fitting — justru merusak sistem.
 *   · Saran ambang hanya diberikan bila ada kelompok dengan n ≥ $minBucket yang
 *     expectancy-nya POSITIF; yang diambil adalah ambang TERENDAH yang memenuhi,
 *     karena itu berarti sinyal terbanyak dengan mutu yang masih menguntungkan.
 *   · Catatan tanpa nilai keyakinan tidak dimasukkan ke kelompok mana pun dan
 *     dilaporkan terpisah (tidak disembunyikan).
 */
function qi_signal_kalibrasi(array $records, int $minSampel = 30, int $minBucket = 10): array
{
    $bucketDef = [
        ['kunci' => '<50',   'bawah' => 0,  'atas' => 49],
        ['kunci' => '50-59', 'bawah' => 50, 'atas' => 59],
        ['kunci' => '60-69', 'bawah' => 60, 'atas' => 69],
        ['kunci' => '70-79', 'bawah' => 70, 'atas' => 79],
        ['kunci' => '80-100','bawah' => 80, 'atas' => 100],
    ];
    $bucket = [];
    foreach ($bucketDef as $b) {
        $bucket[$b['kunci']] = ['kunci' => $b['kunci'], 'rentang' => $b['bawah'] . '–' . $b['atas'],
            'n' => 0, 'menang' => 0, 'kalah' => 0, 'r' => []];
    }
    $tanpaKeyakinan = 0;
    $totalTertutup = 0;

    foreach ($records as $rek) {
        if (!is_array($rek)) continue;
        $status = (string)($rek['status'] ?? '');
        $isMenang = (strpos($status, 'HIT TP') === 0);
        $isKalah  = (strpos($status, 'HIT SL') === 0);
        if (!$isMenang && !$isKalah) continue;
        $totalTertutup++;

        $yak = $rek['confidence'] ?? ($rek['confluence_score'] ?? null);
        if ($yak === null || $yak === '' || !is_numeric($yak)) { $tanpaKeyakinan++; continue; }
        $yak = (int)$yak;
        if ($yak < 0) $yak = 0;
        if ($yak > 100) $yak = 100;

        $hasil = qi_signal_r_satu($rek);
        foreach ($bucketDef as $b) {
            if ($yak >= $b['bawah'] && $yak <= $b['atas']) {
                $k = $b['kunci'];
                $bucket[$k]['n']++;
                if ($isMenang) $bucket[$k]['menang']++; else $bucket[$k]['kalah']++;
                if ($hasil['r'] !== null) $bucket[$k]['r'][] = $hasil['r'];
                break;
            }
        }
    }

    $daftar = [];
    $kandidatAmbang = null;
    foreach ($bucket as $b) {
        $n = $b['n'];
        $wr = $n > 0 ? round($b['menang'] / $n * 100, 1) : null;
        $rataR = $b['r'] ? round(array_sum($b['r']) / count($b['r']), 3) : null;
        // Expectancy per kelompok memakai rata-rata R nyata bila tersedia.
        $exp = null;
        if ($n > 0 && $rataR !== null) $exp = round($rataR, 3);
        $daftar[] = [
            'kelompok'        => $b['kunci'],
            'rentang'         => $b['rentang'],
            'n'               => $n,
            'menang'          => $b['menang'],
            'kalah'           => $b['kalah'],
            'win_rate'        => $wr,
            'expectancy_r'    => $exp,
            'total_r'         => $b['r'] ? round(array_sum($b['r']), 2) : null,
            'cukup_untuk_dinilai' => ($n >= $minBucket),
        ];
        if ($n >= $minBucket && $exp !== null && $exp > 0) {
            $bawah = (int)explode('–', $b['rentang'])[0];
            if ($kandidatAmbang === null || $bawah < $kandidatAmbang) $kandidatAmbang = $bawah;
        }
    }

    $cukup = ($totalTertutup >= $minSampel);
    if (!$cukup) {
        $saran = null;
        $catatan = 'Sampel belum cukup (' . $totalTertutup . ' dari ' . $minSampel . ' sinyal tertutup yang dibutuhkan). '
            . 'Mengubah ambang keyakinan dari sampel sekecil ini adalah curve fitting dan justru menurunkan mutu — jadi TIDAK ada saran ambang.';
    } elseif ($kandidatAmbang === null) {
        $saran = null;
        $catatan = 'Sampel sudah cukup (' . $totalTertutup . ' sinyal tertutup), tetapi belum ada kelompok keyakinan dengan '
            . 'expectancy positif pada sampel yang memadai — jadi belum ada ambang yang bisa disarankan.';
    } else {
        $saran = $kandidatAmbang;
        $catatan = 'Dari ' . $totalTertutup . ' sinyal tertutup, ambang keyakinan TERENDAH yang masih menghasilkan '
            . 'expectancy positif (dengan minimal ' . $minBucket . ' sinyal) adalah ' . $kandidatAmbang . '. '
            . 'Angka ini pengamatan pada data yang ada, bukan jaminan masa depan.';
    }

    return [
        'total_tertutup'   => $totalTertutup,
        'tanpa_keyakinan'  => $tanpaKeyakinan,
        'min_sampel'       => $minSampel,
        'min_per_kelompok' => $minBucket,
        'cukup_sampel'     => $cukup,
        'saran_ambang'     => $saran,
        'kelompok'         => $daftar,
        'catatan'          => $catatan,
        'satuan'           => 'R (kelipatan risiko)',
        'dasar'            => 'Keyakinan diambil dari kolom confidence (atau confluence_score untuk catatan lama).',
    ];
}

endif;
