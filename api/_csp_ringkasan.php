<?php
/**
 * Ringkasan laporan CSP (cache/csp-reports/csp-YYYY-MM-DD.jsonl, ditulis api/csp-report.php).
 * Pelanggaran dikelompokkan per halaman (document_uri tanpa query), effective-directive, dan
 * blocked_uri (inline/eval apa adanya; URL dipotong jadi origin + path). Dipakai
 * api/csp-ringkasan.php (khusus admin) untuk memutuskan kapan CSP ketat boleh ditegakkan.
 */

/** URL → origin + path (tanpa query/fragmen: token tidak ikut tampil, varian ?v= tidak memecah grup). */
function qi_csp_url_pendek(string $u): string
{
    $u = trim($u);
    if ($u === '' || !preg_match('#^[a-z][a-z0-9+.-]*://#i', $u)) return $u;   // 'inline', 'eval', 'data', ...
    $p = parse_url($u);
    if (!$p || empty($p['host'])) return preg_replace('/[?#].*$/', '', $u);
    return strtolower($p['scheme']) . '://' . strtolower($p['host']) . (isset($p['port']) ? ':' . $p['port'] : '')
         . ($p['path'] ?? '/');
}

/**
 * @param string $dir        folder cache/csp-reports
 * @param int    $hari       jumlah hari ke belakang (termasuk hari ini, UTC), 1–31
 * @param string $disposisi  'report' | 'enforce' | 'semua'
 * @param int    $kini       waktu acuan (uji)
 */
function qi_csp_ringkasan(string $dir, int $hari = 7, string $disposisi = 'report', ?int $kini = null): array
{
    $kini = $kini ?? time();
    $hari = max(1, min(31, $hari));
    $disposisi = in_array($disposisi, ['report', 'enforce', 'semua'], true) ? $disposisi : 'report';
    $batasBaris = 50000;   // per file — laporan bisa dibanjiri; ringkasan tetap cepat

    $grup = [];
    $hasil = ['hari' => $hari, 'disposisi' => $disposisi, 'file' => [], 'total' => 0,
              'per_disposisi' => [], 'rusak' => 0, 'terpotong' => false];
    for ($i = $hari - 1; $i >= 0; $i--) {
        $tgl = gmdate('Y-m-d', $kini - $i * 86400);
        $f = $dir . '/csp-' . $tgl . '.jsonl';
        if (!is_file($f)) continue;
        $h = @fopen($f, 'rb');
        if (!$h) continue;
        $n = 0;
        while (($baris = fgets($h)) !== false) {
            if (++$n > $batasBaris) { $hasil['terpotong'] = true; break; }
            $e = json_decode($baris, true);
            if (!is_array($e)) { $hasil['rusak']++; continue; }
            $d = (string)($e['disposition'] ?? '') ?: '(kosong)';
            $hasil['per_disposisi'][$d] = ($hasil['per_disposisi'][$d] ?? 0) + 1;
            if ($disposisi !== 'semua' && $d !== $disposisi) continue;

            $hal = qi_csp_url_pendek((string)($e['document_uri'] ?? ''));
            $arahan = (string)($e['effective'] ?? '') ?: (string)($e['violated'] ?? '');
            $arahan = strtok($arahan, ' ') ?: '';   // violated-directive lama = arahan + sumbernya
            $diblok = qi_csp_url_pendek((string)($e['blocked_uri'] ?? ''));
            $kunci = $hal . "\n" . $arahan . "\n" . $diblok;
            $ts = (string)($e['ts'] ?? '');
            if (!isset($grup[$kunci])) {
                $grup[$kunci] = ['halaman' => $hal, 'arahan' => $arahan, 'diblok' => $diblok, 'jumlah' => 0,
                                 'pertama' => $ts, 'terakhir' => $ts, 'contoh' => [], '_ip' => []];
            }
            $g = &$grup[$kunci];
            $g['jumlah']++;
            if ($ts !== '' && ($g['pertama'] === '' || $ts < $g['pertama'])) $g['pertama'] = $ts;
            if ($ts > $g['terakhir']) $g['terakhir'] = $ts;
            // Jumlah IP berbeda (hanya hitungan; IP tidak ikut ditampilkan) — 1 IP = mungkin ekstensi satu orang.
            if (count($g['_ip']) < 1000) $g['_ip'][(string)($e['ip'] ?? '')] = true;
            $sumber = qi_csp_url_pendek((string)($e['source_file'] ?? ''));
            $contoh = ['sumber' => $sumber !== '' ? $sumber . ':' . (int)($e['line'] ?? 0) : '',
                       'sampel' => (string)($e['sample'] ?? '')];
            if (count($g['contoh']) < 3 && !in_array($contoh, $g['contoh'], true)) $g['contoh'][] = $contoh;
            unset($g);
            $hasil['total']++;
        }
        fclose($h);
        $hasil['file'][] = basename($f);
    }

    foreach ($grup as &$g) { $g['ip_berbeda'] = count($g['_ip']); unset($g['_ip']); }
    unset($g);
    usort($grup, fn($a, $b) => [$b['jumlah'], $a['halaman'], $a['arahan'], $a['diblok']]
                           <=> [$a['jumlah'], $b['halaman'], $b['arahan'], $b['diblok']]);
    $hasil['grup'] = array_slice($grup, 0, 200);
    $hasil['jumlah_grup'] = count($grup);
    return $hasil;
}
