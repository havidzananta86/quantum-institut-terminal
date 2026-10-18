<?php
/**
 * BATAS RUGI HARIAN (akun simulasi / paper trading).
 *
 * Profil risiko pengguna (user_risk_profiles.max_daily_loss_pct, bawaan 3%) sebelumnya hanya dipakai jalur
 * eksekusi MT5 dan sebagai peringatan "Tetap buka posisi?" di browser. Di sini ia DITEGAKKAN oleh server untuk
 * akun simulasi: setelah rugi terealisasi hari ini mencapai batas, posisi BARU (manual maupun Ikuti Auto Analisa)
 * ditolak sampai hari berikutnya. Menutup posisi tetap boleh.
 *
 * Aturan:
 *  - Hari = 00:00–24:00 WIB (Asia/Jakarta), batas direset otomatis tengah malam WIB.
 *  - Dasar hitung = saldo AWAL hari (saldo sekarang − P/L terealisasi hari ini) × persen batas.
 *  - Yang dihitung: P/L posisi yang DITUTUP hari ini. Rugi mengambang posisi terbuka tidak dihitung
 *    (server tidak punya harga langsung per pengguna); karena itu setiap posisi tetap wajib ber-SL.
 *  - Peringatan dini saat 80% batas terpakai.
 */

if (!function_exists('qi_batas_rugi_hitung')) {
    /** Hitung murni (tanpa DB): persen batas, saldo sekarang, P/L terealisasi hari ini, awal hari (epoch WIB). */
    function qi_batas_rugi_hitung(float $pct, float $saldo, float $pnlHari, int $awal): array
    {
        $pnlHari = round($pnlHari, 2);
        $saldoAwalHari = round($saldo - $pnlHari, 2);
        $batasUsd = round(max(0.0, $saldoAwalHari) * $pct / 100, 2);
        $rugi = round(max(0.0, -$pnlHari), 2);
        $terpakai = $batasUsd > 0 ? round($rugi / $batasUsd * 100, 1) : 0.0;
        $tercapai = $batasUsd > 0 && $rugi >= $batasUsd;
        return [
            'aktif'           => true,
            'batas_pct'       => round($pct, 2),
            'batas_usd'       => $batasUsd,
            'saldo_awal_hari' => $saldoAwalHari,
            'saldo'           => round($saldo, 2),
            'pnl_hari'        => $pnlHari,
            'rugi_hari'       => $rugi,
            'terpakai_pct'    => $terpakai,
            'sisa_usd'        => round(max(0.0, $batasUsd - $rugi), 2),
            'peringatan'      => !$tercapai && $terpakai >= 80.0,
            'tercapai'        => $tercapai,
            'awal_hari'       => $awal,
            'reset_pada'      => $awal + 86400,
        ];
    }
}

if (!function_exists('qi_batas_rugi_status')) {
    /**
     * @return array{
     *   aktif: bool, batas_pct: float, batas_usd: float, saldo_awal_hari: float, saldo: float,
     *   pnl_hari: float, rugi_hari: float, terpakai_pct: float, sisa_usd: float,
     *   peringatan: bool, tercapai: bool, awal_hari: int, reset_pada: int
     * }
     */
    function qi_batas_rugi_status(PDO $pdo, int $uid, ?int $kini = null): array
    {
        $kini = $kini ?? time();
        $pct = 3.0;
        try {
            if ($pdo->query("SHOW TABLES LIKE 'user_risk_profiles'")->fetch()) {
                $st = $pdo->prepare('SELECT max_daily_loss_pct FROM user_risk_profiles WHERE user_id = :u');
                $st->execute([':u' => $uid]);
                $v = $st->fetchColumn();
                if ($v !== false && is_numeric($v) && (float)$v > 0) $pct = (float)$v;
            }
        } catch (Throwable $e) { /* pakai bawaan 3% */ }

        $awal = (new DateTimeImmutable('@' . $kini))->setTimezone(new DateTimeZone('Asia/Jakarta'))->setTime(0, 0)->getTimestamp();
        $saldoAwal = function_exists('qi_ap_konfig') ? (float)qi_ap_konfig()['saldo_awal'] : 10000.0;

        // UNIX_TIMESTAMP di MySQL: zona PHP dan MySQL bisa berbeda, jadi waktu tutup tidak diurai di PHP.
        $st = $pdo->prepare("SELECT COALESCE(SUM(pnl_usd), 0) AS total,
                                    COALESCE(SUM(CASE WHEN UNIX_TIMESTAMP(closed_at) >= :awal THEN pnl_usd ELSE 0 END), 0) AS hari
                             FROM paper_positions WHERE user_id = :u AND status = 'closed'");
        $st->execute([':u' => $uid, ':awal' => $awal]);
        $r = $st->fetch(PDO::FETCH_ASSOC) ?: ['total' => 0, 'hari' => 0];
        return qi_batas_rugi_hitung($pct, round($saldoAwal + (float)$r['total'], 2), (float)$r['hari'], $awal);
    }
}

if (!function_exists('qi_batas_rugi_pesan')) {
    /** Kalimat untuk pengguna saat posisi baru ditolak. */
    function qi_batas_rugi_pesan(array $s): string
    {
        return 'Batas rugi harian tercapai: rugi hari ini $' . number_format($s['rugi_hari'], 2) . ' dari batas $' . number_format($s['batas_usd'], 2)
            . ' (' . rtrim(rtrim(number_format($s['batas_pct'], 2), '0'), '.') . '% saldo awal hari). Posisi baru dibuka lagi besok 00:00 WIB — atau ubah batasnya di Profil Risiko.';
    }
}
