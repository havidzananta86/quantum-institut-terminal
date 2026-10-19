<?php
/**
 * PEMINDAI SINYAL INDIKATOR PINE "XAU SMC+SnD BUY SELL COMBO" (sisi server).
 *
 * Indikator di chart hanya terlihat saat dashboard dibuka. Pemindai ini menjalankan port PHP yang sama
 * (api/_pine_smcsnd.php) dari cron, sehingga saat status berubah menjadi VALID BUY / VALID SELL:
 *   1. rekor dicatat (cache/pine_signals.json) lengkap dengan Entry / SL / TP1–TP3 — pengganti "lihat chart terus-menerus";
 *   2. rekor dinilai terhadap candle M15 dengan aturan konservatif yang SAMA dengan sinyal bayangan
 *      (api/_setup_shadow.php: qi_ss_nilai) — SL didahulukan bila SL dan TP tersentuh di candle yang sama;
 *   3. pengguna yang mengaktifkan kanal notifikasi (Telegram/Discord/Slack/email/Web Push) diberi tahu SEKALI per sinyal.
 *
 * Aturan yang disengaja:
 *  - Hanya candle H4 yang SUDAH TUTUP yang dinilai (candle berjalan bisa berubah sampai close; di TradingView
 *    status juga bisa berkedip pada bar realtime).
 *  - Sinyal dibuat pada TRANSISI WAIT → VALID, bukan setiap kali status masih VALID. Putaran pertama untuk sebuah
 *    simbol hanya mengingat status (tanpa membuat sinyal), supaya status VALID lama tidak terbit sebagai "baru".
 *  - Satu rekor terbuka per simbol+arah. Order limit: berlaku 24 jam, ditahan maks. 96 jam.
 *  - Rekor TIDAK digabung ke riwayat sinyal resmi/track record; ini catatan terpisah (dengan hitungan R yang sama).
 */

require_once __DIR__ . '/_signal_time.php';
require_once __DIR__ . '/_pine_smcsnd.php';
require_once __DIR__ . '/_setup_shadow.php';

if (!function_exists('qi_pine_pindai')) :

function qi_pine_konfig(): array
{
    return [
        'simbol'          => ['XAUUSD'],
        'tf'              => '240',         // H4 (bar tutup tiap 4 jam)
        'tf_detik'        => 14400,
        'tf_nilai'        => '15',          // M15 untuk menilai pengisian & TP/SL
        'ttl_pending_jam' => 24,
        'maks_tahan_jam'  => 96,
        'maks_rekor'      => 300,
        'min_bar'         => 300,           // riwayat minimum agar zona cukup
        'spread'          => true,          // nilai dengan biaya spread tipikal (api/_biaya_spread.php)
    ];
}

function qi_pine_presisi(float $harga): int { return $harga >= 1000 ? 2 : ($harga >= 50 ? 3 : 5); }

/** Rekor sinyal dari hasil qi_pine_hitung() sisi buy/sell yang VALID. */
function qi_pine_rekor(string $simbol, string $arah, array $lv, array $hasil, int $kini, int $tfDetik): array
{
    $p = qi_pine_presisi((float)$lv['entry']);
    $r = fn($v) => round((float)$v, $p);
    $entry = $r($lv['entry']); $sl = $r($lv['sl']); $tp1 = $r($lv['tp1']); $tp2 = $r($lv['tp2']); $tp3 = $r($lv['tp3']);
    $risiko = abs($entry - $sl);
    $rr = $risiko > 0 ? abs($tp3 - $entry) / $risiko : 0.0;
    return [
        'id'          => 'PNE-' . gmdate('Ymd', $kini) . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
        'timestamp'   => qi_sig_waktu_utc($kini),
        'expiry'      => qi_sig_waktu_utc($kini + 24 * 3600),
        'symbol'      => $simbol,
        'engine'      => 'PINE_SMCSND',
        'engine_name' => 'Indikator Pine SMC+SnD · TP1 ' . $tp1 . ' · TP2 ' . $tp2 . ' · TP3 ' . $tp3 . ' · order limit',
        'timeframe'   => 'H4',
        'side'        => $arah,
        'entry'       => $entry,
        'sl'          => $sl,
        'tp'          => $tp3,
        'tp1'         => $tp1, 'tp2' => $tp2, 'tp3' => $tp3,
        'rr'          => '1 : ' . number_format($rr, 2, '.', ''),
        'atr'         => round((float)$hasil['atr'], 6),
        'status'      => 'MENUNGGU',
        'sumber'      => 'pine_smcsnd',
        'shadow'      => false,
        'bar_tutup'   => $hasil['tTerakhir'] ?? null,
        'harga_saat_terbit' => null,
    ];
}

/** True bila rekor terbuka (menunggu / aktif) ada untuk simbol+arah. */
function qi_pine_ada_terbuka(array $rekor, string $simbol, string $arah): bool
{
    foreach ($rekor as $r) {
        if (($r['symbol'] ?? '') === $simbol && strtoupper((string)($r['side'] ?? '')) === $arah && in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true)) return true;
    }
    return false;
}

/**
 * Satu putaran: nilai rekor terbuka, pindai simbol, catat transisi ke VALID, kirim notifikasi.
 *
 * @param array $o  muat    callable(string $simbol, string $iv): array{candles: array, simulated?: bool}   (wajib)
 *                  kini    int epoch (bawaan time())
 *                  dir     folder cache (bawaan ../cache)
 *                  notif   callable(array $rekor): mixed — dipanggil sekali per sinyal baru (null = tanpa notifikasi)
 *                  konfig  array — hanya untuk pengujian
 */
function qi_pine_pindai(array $o): array
{
    $k = array_merge(qi_pine_konfig(), $o['konfig'] ?? []);
    $muat = $o['muat'];
    $kini = $o['kini'] ?? time();
    $dir = rtrim((string)($o['dir'] ?? (__DIR__ . '/../cache')), '/\\');
    $fRekor = $dir . '/pine_signals.json';
    $fState = $dir . '/pine_state.json';
    $ringkas = ['dinilai' => 0, 'dibuat' => 0, 'dipindai' => 0, 'rincian' => [], 'diperbarui' => []];
    // Satu putaran sekaligus (cron + pemanggil manual): tanpa kunci, putaran yang selesai
    // belakangan menghapus rekor buatan putaran lain.
    $token = qi_kunci_ambil($fRekor, 0.0, 600);
    if ($token === null) { $ringkas['catatan'] = 'sedang_berjalan (putaran lain memegang kunci)'; return $ringkas; }
    try {
        return qi_pine_pindai_terkunci($o, $k, $muat, $kini, $fRekor, $fState, $ringkas);
    } finally {
        qi_kunci_lepas($fRekor, $token);
    }
}

/** Isi qi_pine_pindai — dipanggil hanya saat kunci rekor sudah dipegang. */
function qi_pine_pindai_terkunci(array $o, array $k, callable $muat, int $kini, string $fRekor, string $fState, array $ringkas): array
{
    $rekor = qi_ss_baca($fRekor);
    $state = qi_ss_baca($fState);
    $nilaiCfg = ['ttl_pending_jam' => $k['ttl_pending_jam'], 'maks_tahan_jam' => $k['maks_tahan_jam']];

    // 1) Nilai rekor yang masih terbuka.
    $cacheM15 = []; $sumberM15 = [];
    foreach ($rekor as $i => $r) {
        if (!in_array($r['status'] ?? '', ['MENUNGGU', 'AKTIF'], true)) continue;
        $sym = (string)$r['symbol'];
        if (!isset($cacheM15[$sym])) { $m = $muat($sym, $k['tf_nilai']); $cacheM15[$sym] = empty($m['simulated']) ? ($m['candles'] ?? []) : []; $sumberM15[$sym] = (string)($m['source'] ?? ''); }
        if (!$cacheM15[$sym]) continue;
        if (!empty($k['spread'])) $r = qi_spread_pasang($r, $sumberM15[$sym] ?? '');
        $baru = qi_ss_nilai($r, $cacheM15[$sym], $kini, $nilaiCfg + [
            'urai' => is_callable($o['urai_m1'] ?? null) ? ($o['urai_m1'])($sym) : null, 'durasi_nilai' => 900]);
        $ringkas['dinilai']++;
        if (($baru['status'] ?? '') !== ($r['status'] ?? '')) $ringkas['diperbarui'][] = $r['id'] . ': ' . $r['status'] . ' → ' . $baru['status'];
        $rekor[$i] = $baru;
    }

    // 2) Pindai simbol.
    foreach ($k['simbol'] as $simbol) {
        $d = $muat($simbol, $k['tf']);
        $c = (!empty($d['simulated']) || empty($d['candles'])) ? [] : array_values($d['candles']);
        if (count($c) < $k['min_bar']) { $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'data_kurang_atau_simulasi']; continue; }
        usort($c, fn($a, $b) => ((int)$a['time']) <=> ((int)$b['time']));
        // Buang candle yang masih berjalan.
        $terakhir = $c[count($c) - 1];
        if ((int)$terakhir['time'] + (int)$k['tf_detik'] > $kini) array_pop($c);
        if (count($c) < $k['min_bar']) { $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'data_kurang']; continue; }

        $h = qi_pine_hitung($c);
        $ringkas['dipindai']++;
        if (empty($h['ok'])) { $ringkas['rincian'][] = ['simbol' => $simbol, 'hasil' => 'hitung_gagal']; continue; }

        $awal = !isset($state[$simbol]);
        $prev = $state[$simbol] ?? [];
        foreach (['BUY' => 'buy', 'SELL' => 'sell'] as $arah => $kunciSisi) {
            $lv = $h[$kunciSisi];
            $valid = !empty($lv['valid']);
            $dulu = !empty($prev[$arah]);
            $state[$simbol][$arah] = $valid;
            if (!$valid || $dulu) continue;
            if ($awal) { $ringkas['rincian'][] = ['simbol' => $simbol, 'arah' => $arah, 'hasil' => 'status_awal_dicatat']; continue; }
            if (qi_pine_ada_terbuka($rekor, $simbol, $arah)) { $ringkas['rincian'][] = ['simbol' => $simbol, 'arah' => $arah, 'hasil' => 'sudah_ada_terbuka']; continue; }

            $rek = qi_pine_rekor($simbol, $arah, $lv, $h, $kini, (int)$k['tf_detik']);
            $rek['harga_saat_terbit'] = (float)$c[count($c) - 1]['close'];
            array_unshift($rekor, $rek);
            $ringkas['dibuat']++;
            $ringkas['rincian'][] = ['simbol' => $simbol, 'arah' => $arah, 'hasil' => 'sinyal_dibuat', 'id' => $rek['id']];
            if (is_callable($o['notif'] ?? null)) {
                try { $ringkas['notifikasi'][$rek['id']] = ($o['notif'])($rek); }
                catch (Throwable $e) { @error_log('[pine-sinyal] notifikasi gagal: ' . $e->getMessage()); }
            }
        }
        $state[$simbol]['bar'] = $h['tTerakhir'];
    }

    if (count($rekor) > $k['maks_rekor']) $rekor = array_slice($rekor, 0, $k['maks_rekor']);
    qi_ss_tulis($fRekor, $rekor);
    qi_ss_tulis($fState, $state);
    $ringkas['total_rekor'] = count($rekor);
    return $ringkas;
}

endif;
