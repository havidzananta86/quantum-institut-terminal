/* ════════════════════════════════════════════════════════════════════════
   QIM CHART STORE — satu unduhan candle untuk permintaan yang sama.

   Saat dashboard dibuka, sembilan modul (chart, MTF, Mesin 9, zona, AI, dll.) masing-masing
   memanggil api/get-chart-data.php — pengukuran di layar ponsel: ±12 permintaan untuk
   XAUUSD H1 yang SAMA dalam beberapa detik (±97 KB mentah per jawaban). Lapisan fetch ini:
     · permintaan identik yang sedang berjalan ditunggu bersama, tidak diulang;
     · jawaban sukses dipakai ulang selama 10 detik (server sendiri meng-cache 15–60 detik,
       jadi kesegaran data tidak berubah);
     · kunci = URL (tanpa parameter "_" pemecah cache) + token login, sehingga pengguna MT5 dan
       pengunjung tidak pernah berbagi jawaban.
   Bentuk jawaban sama (Response JSON), jadi pemanggil lama tidak perlu diubah. Gagal → diteruskan
   ke jaringan seperti biasa. ?nostore=1 di URL dashboard mematikan lapisan ini.
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    const SEGAR_MS = 10000;
    const TARGET = /(?:^|\/)api\/get-chart-data\.php(?:\?|$)/;

    /** Kunci cache: path + parameter terurut tanpa "_" + token. Murni (diuji). */
    function kunci(url, token, asal) {
        const u = new URL(url, asal || 'http://x/');
        const p = [...u.searchParams.entries()].filter(([k]) => k !== '_').sort((a, b) => (a[0] + '=' + a[1]).localeCompare(b[0] + '=' + b[1]));
        return u.pathname.replace(/^.*\/api\//, 'api/') + '?' + p.map(([k, v]) => k + '=' + v).join('&') + '|' + (token || '');
    }

    /**
     * Buat pembungkus fetch. Dipisah dari pemasangan supaya bisa diuji dengan fetch tiruan.
     * @param {Function} asliFetch fetch yang dibungkus
     * @param {Function} ambilToken () => string|null
     * @param {Function} [kini] () => ms
     */
    function buat(asliFetch, ambilToken, kini) {
        kini = kini || (() => Date.now());
        const toko = new Map();       // kunci → { teks, status, ct, at }
        const jalan = new Map();      // kunci → Promise<{teks,status,ct,ok}>
        const statistik = { minta: 0, memori: 0, gabung: 0, jaringan: 0 };

        const jawab = (r, sumber) => new Response(r.teks, { status: r.status, headers: { 'Content-Type': r.ct || 'application/json; charset=utf-8', 'X-QIM-Store': sumber } });

        function bisaDibatalkan(janji, sinyal) {
            if (!sinyal) return janji;
            if (sinyal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
            return new Promise((res, rej) => {
                const batal = () => rej(new DOMException('Aborted', 'AbortError'));
                sinyal.addEventListener('abort', batal, { once: true });
                janji.then(v => { sinyal.removeEventListener('abort', batal); res(v); }, e => { sinyal.removeEventListener('abort', batal); rej(e); });
            });
        }

        function fetchBaru(masukan, opsi) {
            let url = '', metode = 'GET';
            try {
                url = typeof masukan === 'string' ? masukan : (masukan && masukan.url) || '';
                metode = String((opsi && opsi.method) || (masukan && typeof masukan !== 'string' && masukan.method) || 'GET').toUpperCase();
            } catch (e) { return asliFetch(masukan, opsi); }
            const asal = (typeof location !== 'undefined' && location.origin) || 'http://x';
            const sameOrigin = !/^[a-z][a-z0-9+.-]*:/i.test(url) || url.indexOf(asal) === 0;
            if (metode !== 'GET' || !sameOrigin || !TARGET.test(url) || (opsi && opsi.cache === 'no-store')) return asliFetch(masukan, opsi);

            statistik.minta++;
            let k;
            try { k = kunci(url, ambilToken(), asal + '/'); } catch (e) { return asliFetch(masukan, opsi); }
            const sinyal = opsi && opsi.signal;

            const ada = toko.get(k);
            if (ada && kini() - ada.at <= SEGAR_MS) { statistik.memori++; return Promise.resolve(jawab(ada, 'memori')); }

            let janji = jalan.get(k);
            if (janji) statistik.gabung++;
            else {
                statistik.jaringan++;
                // Unduhan bersama TIDAK memakai sinyal batal milik satu pemanggil (pemanggil lain tetap menunggu).
                const opsiBersama = Object.assign({}, opsi || {});
                delete opsiBersama.signal;
                janji = asliFetch(masukan, opsiBersama).then(async res => {
                    const r = { teks: await res.text(), status: res.status, ct: res.headers.get('Content-Type'), ok: res.ok };
                    if (res.ok) toko.set(k, Object.assign({ at: kini() }, r));
                    return r;
                }).finally(() => jalan.delete(k));
                jalan.set(k, janji);
            }
            return bisaDibatalkan(janji, sinyal).then(r => jawab(r, 'jaringan'));
        }
        fetchBaru.statistik = statistik;
        fetchBaru.kosongkan = () => { toko.clear(); };
        return fetchBaru;
    }

    const api = { kunci, buat, SEGAR_MS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (!root || root.QimChartStore || typeof root.fetch !== 'function') return;
    try { if (new URLSearchParams(root.location.search).get('nostore') === '1') return; } catch (e) {}
    const token = () => { try { return root.QuantumAuth && root.QuantumAuth.getToken ? root.QuantumAuth.getToken() : null; } catch (e) { return null; } };
    const f = buat(root.fetch.bind(root), token);
    root.fetch = f;
    root.QimChartStore = { statistik: f.statistik, kosongkan: f.kosongkan };
})(typeof window !== 'undefined' ? window : null);
