<?php
/**
 * Pustaka bersama EKSEKUSI OTOMATIS (sinyal → antrean → EA pelanggan).
 *
 * KENAPA BERKAS INI: logika "apakah akun ini boleh menerima perintah, simbol apa yang
 * dipakai di brokernya, berapa lotnya" dipakai oleh beberapa tempat (penerbitan sinyal,
 * endpoint status, pengaturan pelanggan). Kalau ditulis di banyak tempat, cepat
 * menyimpang — dan akibatnya uang nyata. Jadi aturannya HANYA ada di sini.
 *
 * PRINSIP KESELAMATAN (semua wajib lolos, kalau tidak → perintah TIDAK dibuat):
 *   1. profil harus enabled=1 dan emergency_stop=0
 *   2. pemilik akun harus berperan pro/vip/admin dan akunnya aktif
 *   3. simbol hasil PEMETAAN harus ada di daftar allowed_symbols (bila daftar diisi)
 *   4. geometri SL/TP harus benar (BUY: SL < entry < TP, SELL: TP < entry < SL)
 *   5. volume dijaga di rentang 0.01 .. max_lot
 *   6. satu sinyal = satu perintah per akun (indeks unik di database)
 *
 * Yang TIDAK dilakukan berkas ini: mengirim order ke broker. Itu tugas EA di terminal
 * pelanggan (assets/mt-bridge/QuantumLiveExecutionMT5.mq5) yang memeriksa ulang
 * semuanya secara lokal sebelum menekan tombol.
 */

if (!defined('QI_EXECUTION_LIB')) define('QI_EXECUTION_LIB', true);

/** Peran yang boleh memakai eksekusi otomatis. */
function qi_exec_role_boleh(?string $role): bool
{
    return in_array(strtolower((string)$role), ['pro', 'vip', 'admin'], true);
}

/** Normalisasi nama simbol untuk pencocokan: 'XAU/USD' → 'XAUUSD'. */
function qi_exec_normal_simbol(?string $simbol): string
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$simbol));
}

/**
 * Petakan simbol sinyal ke simbol broker pelanggan.
 * @param ?string $jsonMap  isi kolom symbol_map, mis. {"XAUUSD":"XAUUSD.pro"}
 * @return string simbol yang harus dipakai; '' bila pemetaan eksplisit menunjuk kosong
 */
function qi_exec_peta_simbol(?string $jsonMap, string $simbolSinyal): string
{
    $asli = trim($simbolSinyal);
    if ($jsonMap === null || trim($jsonMap) === '') return $asli;

    $peta = json_decode($jsonMap, true);
    if (!is_array($peta)) return $asli;

    $kunciDicari = qi_exec_normal_simbol($asli);
    foreach ($peta as $dari => $ke) {
        if (qi_exec_normal_simbol((string)$dari) === $kunciDicari) {
            $tujuan = trim((string)$ke);
            return $tujuan;   // '' berarti sengaja tidak dipetakan
        }
    }
    return $asli;             // tidak ada pemetaan → pakai nama sinyal apa adanya
}

/**
 * Daftar akun yang SIAP menerima perintah otomatis.
 * @param ?int $hanyaAkunId batasi ke satu akun (untuk pengujian/status)
 */
function qi_exec_akun_siap(PDO $pdo, ?int $hanyaAkunId = null): array
{
    $sql = "SELECT a.id AS account_id, a.user_id, a.account_label, a.provider,
                   u.role, u.is_active AS user_aktif,
                   p.enabled, p.emergency_stop, p.max_lot, p.volume,
                   p.max_daily_loss_pct, p.max_open_positions,
                   p.allowed_symbols, p.symbol_map, p.magic_number
            FROM trading_execution_profiles p
            INNER JOIN trading_accounts a ON a.id = p.trading_account_id
            INNER JOIN users u ON u.id = a.user_id
            WHERE p.enabled = 1
              AND p.emergency_stop = 0
              AND a.connection_status IN ('pending', 'active')
              AND u.is_active = 1
              AND u.role IN ('pro', 'vip', 'admin')";
    $param = [];
    if ($hanyaAkunId !== null) { $sql .= " AND a.id = :acc"; $param[':acc'] = $hanyaAkunId; }
    $sql .= " ORDER BY a.id";

    $st = $pdo->prepare($sql);
    $st->execute($param);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

/** Volume efektif untuk sebuah profil: dijaga 0.01 .. max_lot. */
function qi_exec_volume_efektif(array $profil): ?float
{
    $maks = (float)($profil['max_lot'] ?? 0);
    if ($maks < 0.01) return null;                       // profil salah konfigurasi
    $diminta = (float)($profil['volume'] ?? 0.01);
    if ($diminta < 0.01) $diminta = 0.01;
    return round(min($diminta, $maks), 2);
}

/** Apakah simbol (hasil pemetaan) diizinkan profil ini? Daftar kosong = semua boleh. */
function qi_exec_simbol_diizinkan(array $profil, string $simbolBroker): bool
{
    $daftar = json_decode((string)($profil['allowed_symbols'] ?? ''), true);
    if (!is_array($daftar) || count($daftar) === 0) return true;
    $cari = qi_exec_normal_simbol($simbolBroker);
    foreach ($daftar as $s) {
        if (qi_exec_normal_simbol((string)$s) === $cari) return true;
    }
    return false;
}

/**
 * Antrekan satu SINYAL ke semua akun yang siap.
 *
 * @param array $sinyal ['id'=>string,'symbol'=>string,'side'=>'BUY'|'SELL',
 *                       'entry'=>float,'sl'=>float,'tp'=>float,'expiry_ts'=>?int]
 * @return array ringkasan: dibuat, dilewati (dengan alasan), akun diperiksa
 */
function qi_exec_antre_sinyal(PDO $pdo, array $sinyal, int $masaBerlakuDetik = 900): array
{
    $keluar = ['diperiksa' => 0, 'dibuat' => 0, 'dilewati' => [], 'detail' => []];
    try {
        $idSinyal = trim((string)($sinyal['id'] ?? ''));
        $simbolSinyal = trim((string)($sinyal['symbol'] ?? ''));
        $sisi = strtoupper(trim((string)($sinyal['side'] ?? '')));
        $entry = (float)($sinyal['entry'] ?? 0);
        $sl = (float)($sinyal['sl'] ?? 0);
        $tp = (float)($sinyal['tp'] ?? 0);

        if ($idSinyal === '' || $simbolSinyal === '' || !in_array($sisi, ['BUY', 'SELL'], true)) {
            return array_merge($keluar, ['error' => 'Sinyal tidak lengkap (id/symbol/side).']);
        }
        // Geometri SL/TP: wajib benar sebelum menyentuh uang siapa pun.
        $geometriSah = $sisi === 'BUY' ? ($sl > 0 && $tp > 0 && $sl < $entry && $entry < $tp)
                                       : ($sl > 0 && $tp > 0 && $tp < $entry && $entry < $sl);
        if (!$geometriSah) {
            return array_merge($keluar, ['error' => 'Geometri SL/TP tidak sah untuk arah ' . $sisi . '.']);
        }

        $akun = qi_exec_akun_siap($pdo);
        $keluar['diperiksa'] = count($akun);

        // Batas waktu perintah: mana yang lebih cepat antara kedaluwarsa sinyal dan
        // masa berlaku bawaan (15 menit). Perintah lama tidak boleh dieksekusi.
        //
        // PENTING (bug nyata yang pernah lolos): masa berlaku dihitung sebagai DURASI
        // dan diterapkan oleh MySQL sendiri (DATE_ADD(NOW(), INTERVAL n SECOND)).
        // Sebelumnya dipakai gmdate() (UTC) sementara MySQL memakai zona waktu server,
        // sehingga di server non-UTC order LANGSUNG kedaluwarsa dan tidak pernah
        // dieksekusi — gejala "EA hidup tapi tidak ada order" yang sangat membingungkan.
        // Dengan durasi, hasilnya benar di zona waktu apa pun.
        $masaDetik = max(60, $masaBerlakuDetik);
        if (!empty($sinyal['expiry_ts'])) {
            $masaDetik = min($masaDetik, max(60, (int)$sinyal['expiry_ts'] - time()));
        }
        $masaDetik = (int)$masaDetik;   // integer murni → aman disisipkan ke SQL

        $ins = $pdo->prepare(
            "INSERT INTO trading_execution_orders
                (order_token, trading_account_id, source, signal_id, symbol, side, volume,
                 stop_loss, take_profit, requested_price, status, expires_at, created_at, updated_at)
             VALUES (:token, :acc, 'sinyal_otomatis', :sig, :symbol, :side, :vol,
                 :sl, :tp, :harga, 'queued', DATE_ADD(NOW(), INTERVAL $masaDetik SECOND), NOW(), NOW())"
        );

        foreach ($akun as $a) {
            $accId = (int)$a['account_id'];
            $simbolBroker = qi_exec_peta_simbol($a['symbol_map'] ?? null, $simbolSinyal);

            if ($simbolBroker === '') {
                $keluar['dilewati'][] = ['akun' => $accId, 'alasan' => 'Pemetaan simbol menunjuk kosong'];
                continue;
            }
            if (!qi_exec_simbol_diizinkan($a, $simbolBroker)) {
                $keluar['dilewati'][] = ['akun' => $accId, 'alasan' => 'Simbol ' . $simbolBroker . ' tidak ada di daftar izin'];
                continue;
            }
            $volume = qi_exec_volume_efektif($a);
            if ($volume === null) {
                $keluar['dilewati'][] = ['akun' => $accId, 'alasan' => 'Batas lot profil di bawah 0.01'];
                continue;
            }

            try {
                $ins->execute([
                    ':token'  => qi_uuid4(),
                    ':acc'    => $accId,
                    ':sig'    => $idSinyal,
                    ':symbol' => $simbolBroker,
                    ':side'   => $sisi,
                    ':vol'    => $volume,
                    ':sl'     => $sl,
                    ':tp'     => $tp,
                    ':harga'  => $entry > 0 ? $entry : null,
                ]);
                $keluar['dibuat']++;
                $keluar['detail'][] = ['akun' => $accId, 'simbol' => $simbolBroker, 'volume' => $volume, 'status' => 'diantrekan'];
            } catch (PDOException $e) {
                // Duplikat = sinyal ini sudah pernah diantrekan untuk akun ini (aman).
                if (stripos($e->getMessage(), 'Duplicate') !== false) {
                    $keluar['dilewati'][] = ['akun' => $accId, 'alasan' => 'Sudah pernah diantrekan (idempoten)'];
                } else {
                    $keluar['dilewati'][] = ['akun' => $accId, 'alasan' => 'Gagal menyimpan perintah'];
                    if (function_exists('qi_log')) qi_log('error', 'Antre sinyal gagal', ['akun' => $accId, 'exception' => get_class($e)]);
                }
            }
        }
    } catch (Throwable $e) {
        if (function_exists('qi_log')) qi_log('error', 'Antre sinyal gagal total', ['exception' => get_class($e)]);
        $keluar['error'] = 'Antre sinyal gagal diproses.';
    }
    return $keluar;
}

/** UUID v4 sederhana (panjang 36, sesuai kolom order_token). */
function qi_uuid4(): string
{
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

/**
 * Status lengkap satu akun untuk ditampilkan ke pelanggan.
 * Termasuk kesegaran poll EA supaya pelanggan (dan Anda) tahu EA-nya hidup atau tidak.
 */
function qi_exec_status_akun(PDO $pdo, int $accountId): array
{
    $keluar = ['akun' => $accountId, 'profil' => null, 'status_harian' => null, 'perintah' => [], 'ea' => null];
    try {
        $st = $pdo->prepare(
            "SELECT p.*, a.account_label, a.provider, a.account_reference, a.connection_status, a.last_synced_at
             FROM trading_execution_profiles p
             INNER JOIN trading_accounts a ON a.id = p.trading_account_id
             WHERE p.trading_account_id = :id"
        );
        $st->execute([':id' => $accountId]);
        $profil = $st->fetch(PDO::FETCH_ASSOC);
        if ($profil) {
            $keluar['profil'] = [
                'enabled' => (int)$profil['enabled'],
                'emergency_stop' => (int)$profil['emergency_stop'],
                'max_lot' => (float)$profil['max_lot'],
                'volume' => (float)$profil['volume'],
                'max_daily_loss_pct' => (float)$profil['max_daily_loss_pct'],
                'max_open_positions' => (int)$profil['max_open_positions'],
                'allowed_symbols' => json_decode((string)$profil['allowed_symbols'], true) ?: [],
                'symbol_map' => json_decode((string)$profil['symbol_map'], true) ?: new stdClass(),
                'magic_number' => (int)$profil['magic_number'],
                'account_label' => $profil['account_label'],
                'connection_status' => $profil['connection_status'],
                'last_synced_at' => $profil['last_synced_at'],
            ];
        }

        $st2 = $pdo->prepare("SELECT * FROM trading_execution_state WHERE trading_account_id = :id ORDER BY state_day DESC LIMIT 1");
        $st2->execute([':id' => $accountId]);
        $s = $st2->fetch(PDO::FETCH_ASSOC);
        if ($s) {
            $keluar['status_harian'] = [
                'hari' => $s['state_day'],
                'saldo_awal' => (float)$s['opening_balance'],
                'ekuitas_terakhir' => (float)$s['latest_equity'],
                'posisi_terbuka' => (int)$s['latest_open_positions'],
                'diperbarui' => $s['updated_at'],
            ];
        }

        $st3 = $pdo->prepare(
            "SELECT order_token, signal_id, symbol, side, volume, stop_loss, take_profit, status,
                    broker_order_ticket, broker_retcode, broker_message, created_at, executed_at, expires_at
             FROM trading_execution_orders WHERE trading_account_id = :id
             ORDER BY id DESC LIMIT 12"
        );
        $st3->execute([':id' => $accountId]);
        $keluar['perintah'] = $st3->fetchAll(PDO::FETCH_ASSOC);

        // Kesegaran EA: umur pembaruan state terakhir (poll EA meng-update ini).
        if (!empty($keluar['status_harian']['diperbarui'])) {
            $umur = time() - strtotime((string)$keluar['status_harian']['diperbarui'] . ' UTC');
            $keluar['ea'] = ['umur_detik' => $umur, 'hidup' => $umur >= 0 && $umur < 120];
        }
    } catch (Throwable $e) {
        if (function_exists('qi_log')) qi_log('error', 'Status eksekusi gagal dibaca', ['exception' => get_class($e)]);
        $keluar['error'] = 'Status tidak dapat dibaca.';
    }
    return $keluar;
}
