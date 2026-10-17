<?php
/**
 * MESIN SETUP (SMC, ICT, Fibonacci, Supply & Demand) — sisi server.
 *
 * Port PHP dari assets/js/qim-setups.js (yang dipakai panel "Setup Analisa" di dashboard).
 * Aturannya SAMA dan dijaga sama lewat tests/setup-engine-parity.test.js, yang menjalankan
 * kedua versi pada candle yang sama (data buatan + candle nyata) dan membandingkan hasilnya.
 * Jangan mengubah salah satu tanpa mengubah yang lain.
 *
 * Murni: tidak membaca berkas/jaringan/database. Candle: array lama→baru berisi
 * ['time','open','high','low','close'] (float).
 *
 * Aturan ketepatan (ringkas; lihat qim-setups.js untuk penjelasan lengkap):
 *  - swing hanya dihitung bila TERKONFIRMASI (3 candle kiri & kanan);
 *  - entry/SL/TP diturunkan dari STRUKTUR metode (OB / FVG / impuls Fibonacci / zona base);
 *  - R:R minimal 1:2 terhadap TP struktural — TP tidak pernah dikarang dari kelipatan risiko;
 *  - struktur dibaca dari candle yang SUDAH close; candle berjalan hanya memeriksa sentuhan;
 *  - setup yang SL-nya sudah kena / TP-nya sudah tercapai / strukturnya rusak dibuang.
 */
declare(strict_types=1);

if (!class_exists('QiSetupEngine')) {

final class QiSetupEngine
{
    public const MIN_RR = 2;
    public const PIVOT_K = 3;
    public const BATAS_UMUR = 150;
    public const BUFFER_ATR = 0.1;
    public const MAKS_AKTIF = 20;
    public const MIN_BAR = 60;

    public const METODE = ['SMC', 'ICT', 'FIBO', 'SND'];

    // ── Utilitas ────────────────────────────────────────────────────────────
    /** Pembulatan seperti Math.round JS (setengah ke atas) untuk nilai positif. */
    public static function bulat(float $v, int $presisi): float
    {
        $f = 10 ** $presisi;
        return floor($v * $f + 0.5) / $f;
    }

    public static function atr(array $c, int $p = 14): array
    {
        $n = count($c);
        $out = array_fill(0, $n, 0.0);
        $jumlah = 0.0; $nilai = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $prev = $i > 0 ? $c[$i - 1]['close'] : $c[$i]['open'];
            $tr = max($c[$i]['high'] - $c[$i]['low'], abs($c[$i]['high'] - $prev), abs($c[$i]['low'] - $prev));
            if ($i < $p) { $jumlah += $tr; $nilai = $jumlah / ($i + 1); }
            else $nilai = ($nilai * ($p - 1) + $tr) / $p;
            $out[$i] = $nilai;
        }
        return $out;
    }

    public static function pivots(array $c, int $k = self::PIVOT_K): array
    {
        $out = [];
        $n = count($c);
        for ($i = $k; $i < $n - $k; $i++) {
            $h = true; $l = true;
            for ($j = 1; $j <= $k; $j++) {
                if (!($c[$i]['high'] > $c[$i - $j]['high'] && $c[$i]['high'] >= $c[$i + $j]['high'])) $h = false;
                if (!($c[$i]['low'] < $c[$i - $j]['low'] && $c[$i]['low'] <= $c[$i + $j]['low'])) $l = false;
            }
            if ($h) $out[] = ['i' => $i, 'tipe' => 'H', 'harga' => $c[$i]['high']];
            if ($l) $out[] = ['i' => $i, 'tipe' => 'L', 'harga' => $c[$i]['low']];
        }
        return $out;
    }

    private static function urutI(array $piv): array
    {
        usort($piv, fn($a, $b) => $a['i'] <=> $b['i']);
        return $piv;
    }

    public static function selangSeling(array $piv): array
    {
        $out = [];
        foreach ($piv as $p) {
            $akhir = $out ? $out[count($out) - 1] : null;
            if ($akhir && $akhir['tipe'] === $p['tipe']) {
                if (($p['tipe'] === 'H' && $p['harga'] >= $akhir['harga']) || ($p['tipe'] === 'L' && $p['harga'] <= $akhir['harga'])) {
                    $out[count($out) - 1] = $p;
                }
            } else {
                $out[] = $p;
            }
        }
        return $out;
    }

    public static function rr(string $arah, float $entry, float $sl, float $tp): float
    {
        $risiko = $arah === 'BUY' ? $entry - $sl : $sl - $entry;
        $hadiah = $arah === 'BUY' ? $tp - $entry : $entry - $tp;
        return $risiko > 0 ? $hadiah / $risiko : 0.0;
    }

    /** TP struktural terdekat searah posisi dengan R:R ≥ MIN_RR. */
    public static function pilihTP(string $arah, float $entry, float $sl, array $kandidat): array
    {
        $buy = $arah === 'BUY';
        $searah = array_values(array_filter($kandidat, fn($k) => is_finite($k['harga']) && ($buy ? $k['harga'] > $entry : $k['harga'] < $entry)));
        usort($searah, fn($a, $b) => $buy ? ($a['harga'] <=> $b['harga']) : ($b['harga'] <=> $a['harga']));
        foreach ($searah as $k) {
            $nilai = self::rr($arah, $entry, $sl, $k['harga']);
            if ($nilai >= self::MIN_RR) return ['tp' => $k['harga'], 'rr' => $nilai, 'label' => $k['label'], 'idx' => $k['idx']];
        }
        $terbaik = $searah ? self::rr($arah, $entry, $sl, $searah[count($searah) - 1]['harga']) : 0.0;
        return ['tp' => null, 'rr' => $terbaik];
    }

    /** Swing yang belum diambil harga sesudahnya = kolam likuiditas. */
    public static function likuiditas(array $c, array $piv, string $tipe, ?int $sebelum = null): array
    {
        $n = count($c);
        $sebelum = $sebelum ?? $n;
        $out = [];
        foreach ($piv as $p) {
            if ($p['tipe'] !== $tipe || $p['i'] >= $sebelum) continue;
            $utuh = true;
            for ($i = $p['i'] + 1; $i < $n; $i++) {
                if ($tipe === 'H' ? $c[$i]['high'] > $p['harga'] : $c[$i]['low'] < $p['harga']) { $utuh = false; break; }
            }
            if ($utuh) $out[] = $p;
        }
        return $out;
    }

    public static function nilaiStatus(array $c, string $arah, float $entry, float $sl, float $tp, int $dari, int $idxTP = -1, ?float $batasLanjut = null, int $maksAktif = self::MAKS_AKTIF): array
    {
        $buy = $arah === 'BUY';
        $n = count($c);
        $tersentuh = -1;
        for ($i = max(0, $dari); $i < $n; $i++) {
            $b = $c[$i];
            $kenaTP = $buy ? $b['high'] >= $tp : $b['low'] <= $tp;
            $kenaSL = $buy ? $b['low'] <= $sl : $b['high'] >= $sl;
            $kenaEntry = $buy ? $b['low'] <= $entry : $b['high'] >= $entry;
            $lewatTP = $buy ? $b['high'] > $tp : $b['low'] < $tp;
            if ($tersentuh < 0) {
                if ($batasLanjut !== null && ($buy ? $b['high'] > $batasLanjut : $b['low'] < $batasLanjut) && !$kenaEntry) {
                    return ['valid' => false, 'sebab' => 'struktur sudah berlanjut sebelum harga kembali ke entry'];
                }
                if ($lewatTP && $i > $idxTP && !$kenaEntry) return ['valid' => false, 'sebab' => 'harga sudah mencapai target tanpa kembali ke entry'];
                if ($kenaEntry) {
                    if ($kenaSL) return ['valid' => false, 'sebab' => 'SL sudah tersentuh'];
                    if ($kenaTP && $i > $idxTP) return ['valid' => false, 'sebab' => 'TP sudah tercapai'];
                    $tersentuh = $i;
                }
            } else {
                if ($kenaSL) return ['valid' => false, 'sebab' => 'SL sudah tersentuh'];
                if ($kenaTP) return ['valid' => false, 'sebab' => 'TP sudah tercapai'];
            }
        }
        if ($tersentuh >= 0 && $n - 1 - $tersentuh > $maksAktif) {
            return ['valid' => false, 'sebab' => 'entry sudah tersentuh ' . ($n - 1 - $tersentuh) . ' bar lalu (basi)'];
        }
        return ['valid' => true, 'status' => $tersentuh >= 0 ? 'AKTIF' : 'MENUNGGU', 'tersentuh' => $tersentuh];
    }

    private static function presisiDefault(array $c): int
    {
        $p = $c ? abs($c[count($c) - 1]['close']) : 1.0;
        return $p >= 1000 ? 2 : ($p >= 50 ? 3 : 5);
    }

    private static function siapkan(array $c, array $opsi): array
    {
        $presisi = isset($opsi['presisi']) && is_int($opsi['presisi']) ? $opsi['presisi'] : self::presisiDefault($c);
        $fmt = fn($v) => number_format((float)$v, $presisi, '.', '');
        $waktu = function (int $i) use ($c): string {
            $d = new DateTimeImmutable('@' . (int)$c[$i]['time']);
            return $d->setTimezone(new DateTimeZone('Asia/Jakarta'))->format('d/m H:i') . ' WIB';
        };
        return ['presisi' => $presisi, 'fmt' => $fmt, 'waktu' => $waktu, 'A' => self::atr($c), 'piv' => self::pivots($c)];
    }

    private static function bentuk(string $metode, string $arah, float $entry, float $sl, array $pilih, array $status, array $zona, array $alasan, array $ctx, array $ekstra = []): array
    {
        $p = $ctx['presisi'];
        return array_merge([
            'metode' => $metode, 'arah' => $arah, 'status' => $status['status'], 'tersentuh' => $status['tersentuh'],
            'entry' => self::bulat($entry, $p), 'sl' => self::bulat($sl, $p), 'tp' => self::bulat((float)$pilih['tp'], $p),
            'rr' => floor($pilih['rr'] * 100 + 0.5) / 100, 'tpLabel' => $pilih['label'],
            'zona' => $zona, 'alasan' => $alasan,
        ], $ekstra);
    }

    private static function kosong(string $metode, string $catatan): array
    {
        return ['metode' => $metode, 'setups' => [], 'catatan' => $catatan];
    }

    // ── SMC ─────────────────────────────────────────────────────────────────
    public static function peristiwaStruktur(array $c, array $piv, int $k = self::PIVOT_K): array
    {
        $urut = self::urutI($piv);
        $out = [];
        $pH = null; $pL = null; $hTembus = true; $lTembus = true; $tren = 0; $pi = 0;
        $n = count($c); $np = count($urut);
        for ($j = 0; $j < $n; $j++) {
            while ($pi < $np && $urut[$pi]['i'] + $k <= $j - 1) {
                $p = $urut[$pi++];
                if ($p['tipe'] === 'H') { $pH = $p; $hTembus = false; } else { $pL = $p; $lTembus = false; }
            }
            if ($pH && !$hTembus && $c[$j]['close'] > $pH['harga']) {
                $hTembus = true;
                $out[] = ['j' => $j, 'arah' => 'BUY', 'pivot' => $pH, 'tipe' => $tren === -1 ? 'CHoCH' : 'BOS'];
                $tren = 1;
            }
            if ($pL && !$lTembus && $c[$j]['close'] < $pL['harga']) {
                $lTembus = true;
                $out[] = ['j' => $j, 'arah' => 'SELL', 'pivot' => $pL, 'tipe' => $tren === 1 ? 'CHoCH' : 'BOS'];
                $tren = -1;
            }
        }
        return $out;
    }

    private static function deteksiSMC(array $c, array $opsi): array
    {
        if (count($c) < self::MIN_BAR) return self::kosong('SMC', 'Data kurang (butuh minimal ' . self::MIN_BAR . ' candle).');
        $ctx = self::siapkan($c, $opsi); $A = $ctx['A']; $piv = $ctx['piv']; $fmt = $ctx['fmt']; $n = count($c);
        $ev = self::peristiwaStruktur($c, $piv);
        if (!$ev) return self::kosong('SMC', 'Belum ada BOS/CHoCH yang terkonfirmasi.');
        $e = $ev[count($ev) - 1];
        $buy = $e['arah'] === 'BUY';
        $namaArah = $buy ? 'bullish' : 'bearish';
        if ($n - 1 - $e['j'] > self::BATAS_UMUR) return self::kosong('SMC', "{$e['tipe']} $namaArah terakhir sudah " . ($n - 1 - $e['j']) . ' bar lalu — terlalu lama.');

        $m = $e['pivot']['i'];
        for ($i = $e['pivot']['i']; $i <= $e['j']; $i++) {
            if ($buy ? $c[$i]['low'] < $c[$m]['low'] : $c[$i]['high'] > $c[$m]['high']) $m = $i;
        }
        $ob = -1;
        for ($i = $m; $i >= max(0, min($e['pivot']['i'], $m - 10)); $i--) {
            $lawan = $buy ? $c[$i]['close'] < $c[$i]['open'] : $c[$i]['close'] > $c[$i]['open'];
            if ($lawan) { $ob = $i; break; }
        }
        if ($ob < 0) return self::kosong('SMC', "{$e['tipe']} $namaArah " . $fmt($e['pivot']['harga']) . ' tanpa order block yang jelas.');

        $fvg = null;
        $batasT = min($n - 1, $e['j'] + 1);
        for ($t = $ob + 2; $t <= $batasT; $t++) {
            if ($buy ? $c[$t]['low'] > $c[$t - 2]['high'] : $c[$t]['high'] < $c[$t - 2]['low']) { $fvg = $t; break; }
        }
        $badan = abs($c[$e['j']]['close'] - $c[$e['j']]['open']);
        if ($fvg === null && $badan < $A[$e['j']]) {
            return self::kosong('SMC', "{$e['tipe']} $namaArah tanpa displacement (tidak ada FVG, badan candle penembus < 1×ATR).");
        }

        $atas = $c[$ob]['high']; $bawah = $c[$ob]['low'];
        for ($i = $ob; $i <= $m; $i++) { $atas = max($atas, $c[$i]['high']); $bawah = min($bawah, $c[$i]['low']); }
        if ($buy) $atas = $c[$ob]['high']; else $bawah = $c[$ob]['low'];
        $buf = self::BUFFER_ATR * $A[$n - 1];
        $entry = $buy ? $atas : $bawah;
        $sl = $buy ? $bawah - $buf : $atas + $buf;

        $ix = $e['j'];
        for ($i = $e['j']; $i < $n; $i++) {
            if ($buy ? $c[$i]['high'] > $c[$ix]['high'] : $c[$i]['low'] < $c[$ix]['low']) $ix = $i;
        }
        $kandidat = [['harga' => $buy ? $c[$ix]['high'] : $c[$ix]['low'], 'label' => ($buy ? 'High' : 'Low') . " setelah {$e['tipe']}", 'idx' => $ix]];
        foreach (self::likuiditas($c, $piv, $buy ? 'H' : 'L') as $p) {
            $kandidat[] = ['harga' => $p['harga'], 'label' => $buy ? 'Swing high (likuiditas)' : 'Swing low (likuiditas)', 'idx' => $p['i']];
        }
        $pilih = self::pilihTP($e['arah'], $entry, $sl, $kandidat);
        if ($pilih['tp'] === null) return self::kosong('SMC', "OB $namaArah " . $fmt($bawah) . '–' . $fmt($atas) . ' ada, tetapi tidak ada target likuiditas dengan R:R ≥ 1:' . self::MIN_RR . ' (terbaik 1:' . number_format($pilih['rr'], 2, '.', '') . ').');
        $st = self::nilaiStatus($c, $e['arah'], $entry, $sl, $pilih['tp'], $e['j'] + 1, $pilih['idx']);
        if (!$st['valid']) return self::kosong('SMC', "OB $namaArah " . $fmt($bawah) . '–' . $fmt($atas) . " tidak berlaku: {$st['sebab']}.");

        $alasan = [
            "{$e['tipe']} $namaArah: close " . $fmt($c[$e['j']]['close']) . ' menembus swing ' . ($buy ? 'high' : 'low') . ' ' . $fmt($e['pivot']['harga']) . ' (' . $ctx['waktu']($e['j']) . ').',
            'Order block = candle ' . ($buy ? 'bearish' : 'bullish') . ' terakhir sebelum impuls: ' . $fmt($bawah) . '–' . $fmt($atas) . '.',
            $fvg !== null ? 'Displacement terkonfirmasi: impuls meninggalkan FVG.' : 'Displacement: badan candle penembus ' . number_format($badan / $A[$e['j']], 1, '.', '') . '×ATR.',
            'Entry di tepi ' . ($buy ? 'atas' : 'bawah') . ' OB, SL di balik OB (+0,1×ATR), TP di ' . $pilih['label'] . ' ' . $fmt($pilih['tp']) . '.',
        ];
        return ['metode' => 'SMC', 'catatan' => null, 'setups' => [self::bentuk('SMC', $e['arah'], $entry, $sl, $pilih, $st,
            ['atas' => $atas, 'bawah' => $bawah, 'mulai' => $ob, 'label' => 'OB'], $alasan, $ctx, ['struktur' => $e['tipe'], 'mulai' => $ob])]];
    }

    // ── ICT ─────────────────────────────────────────────────────────────────
    private static function deteksiICT(array $c, array $opsi): array
    {
        if (count($c) < self::MIN_BAR) return self::kosong('ICT', 'Data kurang (butuh minimal ' . self::MIN_BAR . ' candle).');
        $ctx = self::siapkan($c, $opsi); $A = $ctx['A']; $piv = $ctx['piv']; $fmt = $ctx['fmt']; $n = count($c);
        $hasil = [];
        $catatan = null;
        $urut = self::urutI($piv);
        $nu = count($urut);
        $K = self::PIVOT_K;

        for ($s = $n - 1; $s >= max($K * 2 + 1, $n - self::BATAS_UMUR); $s--) {
            foreach (['BUY', 'SELL'] as $arah) {
                if (isset($hasil[$arah])) continue;
                $buy = $arah === 'BUY';
                $tipeLik = $buy ? 'L' : 'H'; $tipeInt = $buy ? 'H' : 'L';
                $L = null;
                for ($a = $nu - 1; $a >= 0; $a--) {
                    $p = $urut[$a];
                    if ($p['tipe'] !== $tipeLik || $p['i'] + $K >= $s) continue;
                    $utuh = true;
                    for ($i = $p['i'] + 1; $i < $s; $i++) {
                        if ($buy ? $c[$i]['low'] < $p['harga'] : $c[$i]['high'] > $p['harga']) { $utuh = false; break; }
                    }
                    if ($utuh) { $L = $p; break; }
                }
                if (!$L) continue;
                $sapu = $buy ? ($c[$s]['low'] < $L['harga'] && $c[$s]['close'] > $L['harga']) : ($c[$s]['high'] > $L['harga'] && $c[$s]['close'] < $L['harga']);
                if (!$sapu) continue;

                $H = null;
                for ($a = $nu - 1; $a >= 0; $a--) {
                    $p = $urut[$a];
                    if ($p['tipe'] === $tipeInt && $p['i'] < $s && $p['i'] > $L['i']) { $H = $p; break; }
                }
                if (!$H) {
                    for ($a = $nu - 1; $a >= 0; $a--) {
                        $p = $urut[$a];
                        if ($p['tipe'] === $tipeInt && $p['i'] < $s) { $H = $p; break; }
                    }
                }
                if (!$H) continue;
                $j = -1;
                $batasJ = min($n - 1, $s + 20);
                for ($i = $s + 1; $i <= $batasJ; $i++) {
                    if ($buy ? $c[$i]['low'] < $c[$s]['low'] : $c[$i]['high'] > $c[$s]['high']) break;
                    if ($buy ? $c[$i]['close'] > $H['harga'] : $c[$i]['close'] < $H['harga']) { $j = $i; break; }
                }
                if ($j < 0) { $catatan = $catatan ?? ('Sweep ' . ($buy ? 'sell-side' : 'buy-side') . ' di ' . $fmt($L['harga']) . ' belum diikuti MSS.'); continue; }

                $t = -1;
                $batasX = min($n - 1, $j + 1);
                for ($x = $s + 2; $x <= $batasX; $x++) {
                    if ($buy ? $c[$x]['low'] > $c[$x - 2]['high'] : $c[$x]['high'] < $c[$x - 2]['low']) { $t = $x; break; }
                }
                if ($t < 0) { $catatan = $catatan ?? ('MSS ' . ($buy ? 'bullish' : 'bearish') . ' tanpa FVG displacement.'); continue; }
                $fAtas = $buy ? $c[$t]['low'] : $c[$t - 2]['low'];
                $fBawah = $buy ? $c[$t - 2]['high'] : $c[$t]['high'];
                $entry = ($fAtas + $fBawah) / 2;
                $buf = self::BUFFER_ATR * $A[$n - 1];
                $sl = $buy ? $c[$s]['low'] - $buf : $c[$s]['high'] + $buf;

                $ix = $s;
                for ($i = $s; $i < $n; $i++) {
                    if ($buy ? $c[$i]['high'] > $c[$ix]['high'] : $c[$i]['low'] < $c[$ix]['low']) $ix = $i;
                }
                $kandidat = [['harga' => $buy ? $c[$ix]['high'] : $c[$ix]['low'], 'label' => $buy ? 'High dealing range' : 'Low dealing range', 'idx' => $ix]];
                foreach (self::likuiditas($c, $piv, $tipeInt) as $p) {
                    $kandidat[] = ['harga' => $p['harga'], 'label' => $buy ? 'Buy-side liquidity' : 'Sell-side liquidity', 'idx' => $p['i']];
                }
                $pilih = self::pilihTP($arah, $entry, $sl, $kandidat);
                if ($pilih['tp'] === null) { $catatan = $catatan ?? ('Setup ' . ($buy ? 'bullish' : 'bearish') . ' ada, tetapi target likuiditas memberi R:R < 1:' . self::MIN_RR . '.'); continue; }
                $st = self::nilaiStatus($c, $arah, $entry, $sl, $pilih['tp'], $t + 1, $pilih['idx']);
                if (!$st['valid']) { $catatan = $catatan ?? ('Setup ' . ($buy ? 'bullish' : 'bearish') . " terakhir tidak berlaku: {$st['sebab']}."); continue; }

                $hasil[$arah] = self::bentuk('ICT', $arah, $entry, $sl, $pilih, $st, ['atas' => $fAtas, 'bawah' => $fBawah, 'mulai' => $t - 1, 'label' => 'FVG'], [
                    'Liquidity sweep: wick ' . $fmt($buy ? $c[$s]['low'] : $c[$s]['high']) . ' menembus swing ' . ($buy ? 'low' : 'high') . ' ' . $fmt($L['harga']) . ' lalu close kembali (' . $ctx['waktu']($s) . ').',
                    'Market Structure Shift: close ' . $fmt($c[$j]['close']) . ' menembus swing internal ' . $fmt($H['harga']) . '.',
                    'FVG displacement ' . $fmt($fBawah) . '–' . $fmt($fAtas) . '; entry di CE (50%) ' . $fmt($entry) . '.',
                    'SL di balik wick sweep (+0,1×ATR), TP di ' . $pilih['label'] . ' ' . $fmt($pilih['tp']) . '.',
                ], $ctx, ['mulai' => $s]);
            }
            if (isset($hasil['BUY']) && isset($hasil['SELL'])) break;
        }
        $setups = [];
        foreach (['BUY', 'SELL'] as $a) if (isset($hasil[$a])) $setups[] = $hasil[$a];
        usort($setups, fn($a, $b) => $b['mulai'] <=> $a['mulai']);
        return ['metode' => 'ICT', 'setups' => $setups, 'catatan' => $setups ? null : ($catatan ?? 'Belum ada liquidity sweep yang diikuti MSS + FVG.')];
    }

    // ── FIBONACCI ───────────────────────────────────────────────────────────
    private static function deteksiFibo(array $c, array $opsi): array
    {
        if (count($c) < self::MIN_BAR) return self::kosong('FIBO', 'Data kurang (butuh minimal ' . self::MIN_BAR . ' candle).');
        $ctx = self::siapkan($c, $opsi); $A = $ctx['A']; $piv = $ctx['piv']; $fmt = $ctx['fmt']; $n = count($c);
        $urut = $piv;
        usort($urut, fn($a, $b) => ($a['i'] <=> $b['i']) ?: ($a['tipe'] === 'H' ? -1 : 1));
        $alt = self::selangSeling($urut);
        $na = count($alt);
        $setups = [];
        $catatan = [];
        foreach (['BUY', 'SELL'] as $arah) {
            $buy = $arah === 'BUY';
            $b = -1;
            for ($a = $na - 1; $a >= 1; $a--) {
                if ($alt[$a]['tipe'] === ($buy ? 'H' : 'L') && $alt[$a - 1]['tipe'] === ($buy ? 'L' : 'H')) { $b = $a; break; }
            }
            if ($b < 0) continue;
            $ujung = $alt[$b]; $awal = $alt[$b - 1]; $sebelum = $alt[$b - 2] ?? null;
            $R = abs($ujung['harga'] - $awal['harga']);
            $nama = $buy ? 'naik' : 'turun';
            if ($n - 1 - $ujung['i'] > self::BATAS_UMUR) continue;
            if ($R < 3 * $A[$ujung['i']]) { $catatan[] = "Impuls $nama terakhir terlalu kecil (< 3×ATR)."; continue; }
            if (!$sebelum || ($buy ? $ujung['harga'] <= $sebelum['harga'] : $ujung['harga'] >= $sebelum['harga'])) {
                $catatan[] = "Impuls $nama terakhir tidak membuat " . ($buy ? 'higher high' : 'lower low') . ' — bukan impuls struktur.';
                continue;
            }
            $lvl = fn(float $r) => $buy ? $ujung['harga'] - $R * $r : $ujung['harga'] + $R * $r;
            $entry = $lvl(0.618);
            $buf = self::BUFFER_ATR * $A[$n - 1];
            $sl = $buy ? $awal['harga'] - $buf : $awal['harga'] + $buf;
            $tp = $lvl(-0.272);
            $pilih = ['tp' => $tp, 'rr' => self::rr($arah, $entry, $sl, $tp), 'label' => 'Extension 1.272', 'idx' => $ujung['i']];
            if ($pilih['rr'] < self::MIN_RR) { $catatan[] = "Impuls $nama: R:R ke extension 1.272 hanya 1:" . number_format($pilih['rr'], 2, '.', '') . '.'; continue; }
            $st = self::nilaiStatus($c, $arah, $entry, $sl, $tp, $ujung['i'] + 1, $ujung['i'], $ujung['harga']);
            if (!$st['valid']) { $catatan[] = "Fibonacci impuls $nama tidak berlaku: {$st['sebab']}."; continue; }
            $gzA = max($lvl(0.5), $lvl(0.786)); $gzB = min($lvl(0.5), $lvl(0.786));
            $setups[] = self::bentuk('FIBO', $arah, $entry, $sl, $pilih, $st,
                ['atas' => $gzA, 'bawah' => $gzB, 'mulai' => $ujung['i'], 'label' => 'Golden zone'], [
                    "Impuls $nama terkonfirmasi " . $fmt($awal['harga']) . ' → ' . $fmt($ujung['harga']) . ' (' . $ctx['waktu']($awal['i']) . ' – ' . $ctx['waktu']($ujung['i']) . '), membuat ' . ($buy ? 'higher high' : 'lower low') . ' di atas swing ' . $fmt($sebelum['harga']) . '.',
                    'Golden zone 0.5–0.786: ' . $fmt($gzB) . '–' . $fmt($gzA) . '; entry di 0.618 = ' . $fmt($entry) . '.',
                    'SL di balik awal impuls (100%) ' . $fmt($awal['harga']) . ' (+0,1×ATR).',
                    'TP di extension 1.272 = ' . $fmt($tp) . '.',
                ], $ctx, ['mulai' => $awal['i'], 'fibo' => ['tinggi' => $buy ? $ujung['harga'] : $awal['harga'], 'rendah' => $buy ? $awal['harga'] : $ujung['harga'], 'awal' => $awal['i'], 'ujung' => $ujung['i']]]);
        }
        usort($setups, fn($a, $b) => $b['mulai'] <=> $a['mulai']);
        return ['metode' => 'FIBO', 'setups' => $setups, 'catatan' => $setups ? null : ($catatan[0] ?? 'Belum ada impuls swing yang terkonfirmasi.')];
    }

    // ── SUPPLY & DEMAND ─────────────────────────────────────────────────────
    public static function zonaSnD(array $c, array $A): array
    {
        $zona = [];
        $n = count($c);
        for ($o = 2; $o < $n; $o++) {
            $b = $c[$o];
            $badan = abs($b['close'] - $b['open']); $rentang = $b['high'] - $b['low'];
            if ($rentang <= 0 || $badan < 1.2 * $A[$o] || $badan < 0.6 * $rentang) continue;
            $naik = $b['close'] > $b['open'];
            $awal = $o;
            for ($i = $o - 1; $i >= max(1, $o - 4); $i--) {
                $r = $c[$i]['high'] - $c[$i]['low'];
                if ($r > 0 && abs($c[$i]['close'] - $c[$i]['open']) <= 0.5 * $r) $awal = $i; else break;
            }
            if ($awal === $o) continue;
            $base = array_slice($c, $awal, $o - $awal);
            if ($naik) {
                $proximal = max(array_map(fn($x) => max($x['open'], $x['close']), $base));
                $distal = min(min(array_map(fn($x) => $x['low'], $base)), $b['low']);
            } else {
                $proximal = min(array_map(fn($x) => min($x['open'], $x['close']), $base));
                $distal = max(max(array_map(fn($x) => $x['high'], $base)), $b['high']);
            }
            $tinggi = abs($proximal - $distal);
            if ($tinggi <= 0 || $tinggi > 2 * $A[$o]) continue;
            if (($naik ? $b['close'] - $proximal : $proximal - $b['close']) < $tinggi) continue;
            $legIn = $c[$awal - 1];
            $legInNaik = $legIn['close'] > $legIn['open'];
            $zona[] = ['tipe' => $naik ? 'demand' : 'supply', 'arah' => $naik ? 'BUY' : 'SELL', 'o' => $o, 'awal' => $awal, 'proximal' => $proximal, 'distal' => $distal,
                'pola' => $naik ? ($legInNaik ? 'RBR' : 'DBR') : ($legInNaik ? 'RBD' : 'DBD')];
        }
        return $zona;
    }

    private static function deteksiSnD(array $c, array $opsi): array
    {
        if (count($c) < self::MIN_BAR) return self::kosong('SND', 'Data kurang (butuh minimal ' . self::MIN_BAR . ' candle).');
        $ctx = self::siapkan($c, $opsi); $A = $ctx['A']; $piv = $ctx['piv']; $fmt = $ctx['fmt']; $n = count($c);
        $semua = array_values(array_filter(self::zonaSnD($c, $A), fn($z) => $n - 1 - $z['o'] <= 250));
        $segar = function (array $z) use ($c, $n): bool {
            for ($i = $z['o'] + 1; $i < $n; $i++) {
                if ($z['arah'] === 'BUY' ? $c[$i]['low'] <= $z['proximal'] : $c[$i]['high'] >= $z['proximal']) return false;
            }
            return true;
        };
        $setups = [];
        $catatan = [];
        foreach (['BUY', 'SELL'] as $arah) {
            $buy = $arah === 'BUY';
            $nama = $buy ? 'Demand' : 'Supply';
            $kandidat = array_values(array_filter($semua, fn($z) => $z['arah'] === $arah));
            usort($kandidat, fn($a, $b) => $b['o'] <=> $a['o']);
            if (!$kandidat) continue;
            $terbaik = null;
            foreach ($kandidat as $z) {
                $buf = self::BUFFER_ATR * $A[$n - 1];
                $entry = $z['proximal']; $sl = $buy ? $z['distal'] - $buf : $z['distal'] + $buf;
                $ix = $z['o'];
                for ($i = $z['o']; $i < $n; $i++) {
                    if ($buy ? $c[$i]['high'] > $c[$ix]['high'] : $c[$i]['low'] < $c[$ix]['low']) $ix = $i;
                }
                $tpKand = [['harga' => $buy ? $c[$ix]['high'] : $c[$ix]['low'], 'label' => $buy ? 'High setelah leg-out' : 'Low setelah leg-out', 'idx' => $ix]];
                foreach ($semua as $y) {
                    if ($y['arah'] !== $arah && $segar($y)) $tpKand[] = ['harga' => $y['proximal'], 'label' => $buy ? 'Zona supply berlawanan' : 'Zona demand berlawanan', 'idx' => $y['o']];
                }
                foreach (self::likuiditas($c, $piv, $buy ? 'H' : 'L') as $p) {
                    $tpKand[] = ['harga' => $p['harga'], 'label' => $buy ? 'Swing high' : 'Swing low', 'idx' => $p['i']];
                }
                $pilih = self::pilihTP($arah, $entry, $sl, $tpKand);
                $lo = min($z['proximal'], $z['distal']); $hi = max($z['proximal'], $z['distal']);
                if ($pilih['tp'] === null) { $catatan[] = "$nama " . $fmt($lo) . '–' . $fmt($hi) . ': R:R ke target < 1:' . self::MIN_RR . '.'; continue; }
                $st = self::nilaiStatus($c, $arah, $entry, $sl, $pilih['tp'], $z['o'] + 1, $pilih['idx'], null, 3);
                if (!$st['valid']) { $catatan[] = "$nama " . $fmt($lo) . '–' . $fmt($hi) . " tidak segar lagi: {$st['sebab']}."; continue; }
                $terbaik = ['z' => $z, 'entry' => $entry, 'sl' => $sl, 'pilih' => $pilih, 'st' => $st];
                break;
            }
            if (!$terbaik) continue;
            $z = $terbaik['z']; $entry = $terbaik['entry']; $sl = $terbaik['sl']; $pilih = $terbaik['pilih']; $st = $terbaik['st'];
            $setups[] = self::bentuk('SND', $arah, $entry, $sl, $pilih, $st,
                ['atas' => max($z['proximal'], $z['distal']), 'bawah' => min($z['proximal'], $z['distal']), 'mulai' => $z['awal'], 'label' => $nama], [
                    'Zona ' . strtolower($nama) . " {$z['pola']}: base " . ($z['o'] - $z['awal']) . ' candle (' . $ctx['waktu']($z['awal']) . '), leg-out eksplosif ' . number_format(abs($c[$z['o']]['close'] - $c[$z['o']]['open']) / $A[$z['o']], 1, '.', '') . '×ATR.',
                    $st['status'] === 'AKTIF' ? 'Uji pertama sedang terjadi (zona masih segar sampai sentuhan ini).' : 'Zona masih segar — belum pernah diuji ulang.',
                    'Entry di garis proximal ' . $fmt($z['proximal']) . ', SL di balik garis distal ' . $fmt($z['distal']) . ' (+0,1×ATR).',
                    'TP di ' . $pilih['label'] . ' ' . $fmt($pilih['tp']) . '.',
                ], $ctx, ['mulai' => $z['awal']]);
        }
        usort($setups, fn($a, $b) => $b['mulai'] <=> $a['mulai']);
        return ['metode' => 'SND', 'setups' => $setups, 'catatan' => $setups ? null : ($catatan[0] ?? 'Belum ada zona supply/demand segar dengan leg-out eksplosif.')];
    }

    // ── Pintu masuk ─────────────────────────────────────────────────────────
    /**
     * @param array $candles lama→baru
     * @param array $opsi    presisi (int), termasukBarBerjalan (bool)
     */
    public static function deteksi(string $metode, array $candles, array $opsi = []): array
    {
        $kode = strtoupper($metode);
        if (!in_array($kode, self::METODE, true)) throw new InvalidArgumentException('Metode tidak dikenal: ' . $metode);
        $c = [];
        foreach ($candles as $x) {
            if (!is_array($x)) continue;
            $o = $x['open'] ?? null; $h = $x['high'] ?? null; $l = $x['low'] ?? null; $cl = $x['close'] ?? null;
            if (!is_numeric($o) || !is_numeric($h) || !is_numeric($l) || !is_numeric($cl)) continue;
            $c[] = ['time' => (int)($x['time'] ?? 0), 'open' => (float)$o, 'high' => (float)$h, 'low' => (float)$l, 'close' => (float)$cl];
        }
        $fn = ['SMC' => 'deteksiSMC', 'ICT' => 'deteksiICT', 'FIBO' => 'deteksiFibo', 'SND' => 'deteksiSnD'][$kode];
        if (!empty($opsi['termasukBarBerjalan']) || count($c) < 2) return self::$fn($c, $opsi);

        // Struktur hanya dari candle yang SUDAH close; candle berjalan hanya memeriksa sentuhan.
        $res = self::$fn(array_slice($c, 0, -1), $opsi);
        $live = $c[count($c) - 1];
        $batal = [];
        $baru = [];
        foreach ($res['setups'] as $st) {
            $buy = $st['arah'] === 'BUY';
            if ($buy ? $live['low'] <= $st['sl'] : $live['high'] >= $st['sl']) { $batal[] = 'SL tersentuh candle berjalan'; continue; }
            $kenaTP = $buy ? $live['high'] >= $st['tp'] : $live['low'] <= $st['tp'];
            if ($st['status'] === 'AKTIF' && $kenaTP) { $batal[] = 'TP tercapai candle berjalan'; continue; }
            if ($st['status'] === 'MENUNGGU') {
                $kenaEntry = $buy ? $live['low'] <= $st['entry'] : $live['high'] >= $st['entry'];
                if ($kenaEntry && $kenaTP) { $batal[] = 'entry dan TP tersentuh di candle berjalan'; continue; }
                if ($kenaEntry) { $st['status'] = 'AKTIF'; $st['tersentuh'] = count($c) - 1; }
                elseif ($buy ? $live['high'] > $st['tp'] : $live['low'] < $st['tp']) { $batal[] = 'harga melewati target tanpa kembali ke entry'; continue; }
            }
            $baru[] = $st;
        }
        $res['setups'] = $baru;
        if (!$baru && empty($res['catatan'])) $res['catatan'] = 'Setup terakhir batal: ' . ($batal[0] ?? 'tidak berlaku') . '.';
        return $res;
    }
}

}
