/* ═══════════════════════════════════════════════════════════════════════════
   QIM PRICE STORE — satu sumber harga untuk seluruh dashboard.

   Dulu tujuh modul memanggil api/live-price.php sendiri-sendiri (ticker, header chart, poller
   chart 2–3 dtk, watchlist, panel kanan, dll.) — sering untuk simbol yang SAMA pada detik yang
   sama. Modul ini memasang lapisan di fetch() khusus untuk api/live-price.php:
     · simbol yang datanya masih segar (≤ 2,5 dtk) dijawab dari memori;
     · permintaan yang datang dalam 60 ms digabung menjadi SATU fetch (gabungan simbolnya);
     · permintaan yang sama yang sedang berjalan ditunggu, tidak diulang;
     · hasil dibagikan ke tab dashboard lain lewat BroadcastChannel (beberapa tab = satu poller).
   Bentuk jawaban sama persis ({status, ts, prices:{…}}), jadi modul lama tidak perlu diubah.
   Bila apa pun gagal, permintaan diteruskan ke jaringan seperti biasa (tidak pernah memblokir).
   ?nostore=1 di URL dashboard mematikan lapisan ini (untuk pembandingan).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimHarga) return;
    try { if (new URLSearchParams(location.search).get('nostore') === '1') return; } catch (e) {}

    const SEGAR_MS = 2500, JEDA_GABUNG = 60;
    const toko = {};                 // SIM → { data, at }
    const pendengar = new Set();
    const st = { antre: new Map(), timer: null, statistik: { minta: 0, memori: 0, jaringan: 0 } };
    const asliFetch = window.fetch.bind(window);
    let kanal = null;
    try { kanal = new BroadcastChannel('qim-harga'); } catch (e) {}

    function simpanHarga(prices, ts, dariTabLain) {
        const kini = Date.now();
        Object.keys(prices || {}).forEach(s => { toko[s] = { data: prices[s], at: kini }; });
        if (!dariTabLain && kanal) { try { kanal.postMessage({ prices, ts }); } catch (e) {} }
        pendengar.forEach(fn => { try { fn(prices); } catch (e) {} });
    }
    if (kanal) kanal.onmessage = ev => { if (ev.data && ev.data.prices) simpanHarga(ev.data.prices, ev.data.ts, true); };

    function jawaban(simbol) {
        const prices = {};
        simbol.forEach(s => { if (toko[s]) prices[s] = toko[s].data; });
        return new Response(JSON.stringify({ status: 'success', ts: Math.floor(Date.now() / 1000), prices }),
            { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-QI-Store': 'HIT' } });
    }
    const segar = s => toko[s] && (Date.now() - toko[s].at) <= SEGAR_MS;

    /** Satu fetch untuk gabungan simbol yang sedang antre. */
    async function jalankan() {
        st.timer = null;
        const antre = st.antre;
        st.antre = new Map();
        const simbol = [...antre.keys()];
        if (!simbol.length) return;
        st.statistik.jaringan++;
        try {
            const r = await asliFetch('api/live-price.php?symbols=' + encodeURIComponent(simbol.join(',')), { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            if (!d || d.status !== 'success' || !d.prices) throw new Error('jawaban tidak sah');
            simpanHarga(d.prices, d.ts, false);
            antre.forEach(janji => janji.forEach(j => j.ok()));
        } catch (e) {
            antre.forEach(janji => janji.forEach(j => j.gagal(e)));
        }
    }
    function tunggu(simbol) {
        return Promise.all(simbol.map(s => new Promise((ok, gagal) => {
            if (!st.antre.has(s)) st.antre.set(s, []);
            st.antre.get(s).push({ ok, gagal });
        }))).finally(() => {});
    }

    window.fetch = function (masukan, opsi) {
        try {
            const url = typeof masukan === 'string' ? masukan : (masukan && masukan.url) || '';
            const metode = String((opsi && opsi.method) || (masukan && masukan.method) || 'GET').toUpperCase();
            const cocok = /(^|\/)api\/live-price\.php\?/.exec(url);
            if (cocok && metode === 'GET' && !/^(https?:)?\/\//.test(url)) {
                const q = new URLSearchParams(url.split('?')[1] || '');
                const simbol = [...new Set(String(q.get('symbols') || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean))];
                if (simbol.length) {
                    st.statistik.minta++;
                    const kurang = simbol.filter(s => !segar(s));
                    if (!kurang.length) { st.statistik.memori++; return Promise.resolve(jawaban(simbol)); }
                    const tunggal = tunggu(kurang);
                    if (!st.timer) st.timer = setTimeout(jalankan, JEDA_GABUNG);
                    return tunggal.then(() => jawaban(simbol), () => asliFetch(masukan, opsi));
                }
            }
        } catch (e) { /* jatuh ke fetch biasa */ }
        return asliFetch(masukan, opsi);
    };

    window.QimHarga = {
        get: s => (toko[String(s).toUpperCase()] || {}).data || null,
        dengar: fn => { pendengar.add(fn); return () => pendengar.delete(fn); },
        statistik: () => Object.assign({}, st.statistik)
    };
})();
