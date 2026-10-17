<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUANTUM — PENILAI AI BERSAMA (satu jalur Groq untuk semua fitur)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mengapa dipisah: sebelum ini setiap fitur menulis sendiri pemanggilan Groq +
 * penguraian JSON-nya (pembangkit sinyal berita dan webhook). Duplikasi seperti
 * itu berbahaya — satu perbaikan bisa tertinggal di salah satu salinan.
 *
 * Isi berkas ini:
 *   · qi_ai_prompt_verdict()  — MENYUSUN prompt (MURNI → bisa diuji)
 *   · qi_ai_urai_verdict()    — MENGURAI jawaban (MURNI → bisa diuji)
 *   · qi_ai_verdict()         — pemanggilan jaringan (tipis, tak mengubah logika)
 *
 * Aturan integritas yang dipegang:
 *   · Bila kunci Groq tidak ada / jaringan gagal / jawaban tidak terbaca →
 *     kembalikan null. Pemanggil WAJIB memperlakukannya sebagai "tidak ada
 *     penilaian", BUKAN sebagai persetujuan.
 *   · 'action' dinormalkan ke BUY / SELL / SKIP saja. Nilai asing → SKIP.
 *   · Selalu ada permintaan 'risiko' supaya risiko utama ikut terekam.
 */

if (!function_exists('qi_ai_prompt_verdict')) :

/**
 * Susun system + user prompt untuk verdict trading.
 * MURNI: tidak menyentuh jaringan, berkas, atau waktu.
 *
 * @param string $konteksNama mis. "ALERT TRADINGVIEW" atau "RILIS DATA EKONOMI"
 * @param string $konteksIsi  uraian konteks (multi-baris)
 * @param string $teknis      ringkasan teknikal multi-timeframe
 * @return array{system:string,user:string}
 */
function qi_ai_prompt_verdict(string $konteksNama, string $konteksIsi, string $teknis): array
{
    $system = 'Kamu analis trading profesional. Kamu menerima konteks pasar dan ringkasan teknikal '
        . 'multi-timeframe dari server kami. Jawab HANYA dengan JSON valid tanpa teks lain, berbentuk: '
        . '{"action":"BUY|SELL|SKIP","confidence":0-100,"reason":"alasan singkat bahasa Indonesia (maks 200 huruf)",'
        . '"risiko":"risiko utama yang kamu lihat (maks 200 huruf)"} '
        . 'Aturan: pakai SKIP bila bukti tidak cukup atau saling bertentangan. Jangan mengarang angka. '
        . 'Jangan pernah menjanjikan keuntungan. Jangan menyebut dirimu AI yang sempurna.';

    $user = $konteksNama . ":\n" . trim($konteksIsi) . "\n\n"
        . "RINGKASAN TEKNIKAL (candle nyata):\n" . trim($teknis) . "\n\n"
        . "Berikan keputusan JSON sesuai aturan.";

    return ['system' => $system, 'user' => $user];
}

/**
 * Urai jawaban mentah dari model menjadi verdict yang tervalidasi.
 * MURNI: bisa diuji tanpa jaringan.
 *
 * @return array{action:string,confidence:int,reason:string,risiko:string}|null
 */
function qi_ai_urai_verdict(string $mentah): ?array
{
    $teks = trim($mentah);
    if ($teks === '') return null;
    // Ambil blok JSON pertama bila model menambahkan penjelasan di luar JSON.
    if (preg_match('/\{[\s\S]*\}/', $teks, $m)) $teks = $m[0];
    $d = json_decode($teks, true);
    if (!is_array($d)) return null;

    // KEBIJAKAN PENGURAIAN (penting agar tidak menyesatkan):
    //   · bukan objek (mis. array/scalar)      → null  = "tidak ada penilaian"
    //   · objek tanpa kolom 'action'           → null  = model gagal menjawab
    //   · objek DENGAN action tak dikenal      → SKIP  = model menjawab, tapi aneh
    // Membedakan keduanya penting: "tidak ada penilaian" TIDAK boleh tampak
    // seperti "AI menolak" — kalau tertukar, rekor bisa berisi alasan palsu.
    $adalahObjek = false;
    if ($d !== []) {
        $adalahObjek = (array_keys($d) !== range(0, count($d) - 1));
    } else {
        $adalahObjek = true;   // objek kosong {} → tetap "tanpa penilaian"
    }
    if (!$adalahObjek) return null;
    if (!array_key_exists('action', $d)) return null;

    $aksi = strtoupper(trim((string)$d['action']));
    // Terima juga bentuk lama ENTRY_BUY / ENTRY_SELL agar tetap kompatibel.
    if ($aksi === 'ENTRY_BUY')  $aksi = 'BUY';
    if ($aksi === 'ENTRY_SELL') $aksi = 'SELL';
    if (!in_array($aksi, ['BUY', 'SELL', 'SKIP'], true)) $aksi = 'SKIP';

    return [
        'action'     => $aksi,
        'confidence' => max(0, min(100, (int)($d['confidence'] ?? 0))),
        'reason'     => mb_substr(trim((string)($d['reason'] ?? '')), 0, 240),
        'risiko'     => mb_substr(trim((string)($d['risiko'] ?? ($d['risk'] ?? ''))), 0, 200),
    ];
}

/**
 * Panggil Groq dan kembalikan verdict. Null = tidak ada penilaian (bukan setuju).
 */
function qi_ai_verdict(string $konteksNama, string $konteksIsi, string $teknis): ?array
{
    $kunci = defined('GROQ_API_KEY') ? GROQ_API_KEY : '';
    if (!$kunci) return null;

    $p = qi_ai_prompt_verdict($konteksNama, $konteksIsi, $teknis);
    $muatan = json_encode([
        'model'       => defined('GROQ_SIGNAL_MODEL') ? GROQ_SIGNAL_MODEL : 'qwen/qwen3.8-27b',
        'temperature' => 0.2,
        'max_tokens'  => 400,
        'messages'    => [
            ['role' => 'system', 'content' => $p['system']],
            ['role' => 'user',   'content' => $p['user']],
        ],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $muatan,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $kunci],
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $hasil = curl_exec($ch);
    $kode  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($hasil === false || $kode !== 200) {
        error_log('[AI-VERDICT] Groq error ' . $kode . ': ' . substr((string)$hasil, 0, 200));
        return null;
    }
    $j = json_decode((string)$hasil, true);
    return qi_ai_urai_verdict((string)($j['choices'][0]['message']['content'] ?? ''));
}

endif;
