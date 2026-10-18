/**
 * Quantum Realtime — dua sumber harga cepat, dengan status yang JUJUR.
 *
 * 1. KRIPTO (WebSocket Binance) — mendorong harga tiap ~1 detik.
 *    Aplikasi ini dulu memakai WS lalu mematikannya karena "diblok di beberapa region".
 *    Penyebabnya nyata: dua host yang dipakai memang tidak terjangkau dari Indonesia.
 *    Hasil uji dari mesin pengembang:
 *      wss://stream.binance.vision       -> error   (295 ms)
 *      wss://stream.binance.com:9443     -> timeout (6009 ms)   khas pemblokiran ISP
 *      wss://data-stream.binance.vision  -> TERSAMBUNG (561 ms) <-- tidak dipakai aplikasi
 *    Modul ini menguji host berurutan dan memakai yang benar-benar bisa disambung.
 *
 * 2. FOREX / EMAS / INDEKS (tick dari EA MT5) — instrumen ini tidak ada di Binance,
 *    jadi harganya datang dari BROKER pengguna sendiri: EA mengirim bid/ask/spread ke
 *    api/mt-bridge.php?action=tick tiap detik, dan modul ini membacanya lewat
 *    api/tick.php setiap 1,5 detik (muatan ±2 KB). Ini juga satu-satunya sumber
 *    SPREAD nyata — biaya yang selama ini hilang dari analisa.
 *
 * Kalau kedua-duanya tidak tersedia, modul berhenti dengan tenang dan polling 15 detik
 * yang sudah ada tetap menjadi sumber harga — jadi tidak pernah ada keadaan "harga mati".
 *
 * BATAS TANGGUNG JAWAB: modul ini hanya menulis DATA (window._livePrices) dan memanggil
 * kait halaman window.qiRealtimeTick / window.qiRealtimeState. Ia tidak menyentuh DOM.
 */
(function () {
    'use strict';

    if (window.QuantumRealtime) return;

    // ── Bagian 1: WebSocket kripto ──────────────────────────────────────────
    var HOSTS = [
        'wss://data-stream.binance.vision',
        'wss://stream.binance.vision',
        'wss://stream.binance.com:9443'
    ];
    // BTCUSDT sengaja tidak ada: harganya dari OANDA (live-price.php), bukan Binance.
    var SIMBOL_KRIPTO = ['ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
    var TIMEOUT_UJI = 3500;
    var MAKS_GAGAL = 5;
    var DELAY_AWAL = 2000;
    var DELAY_MAKS = 30000;

    // ── Bagian 2: tick broker (EA MT5) ──────────────────────────────────────
    var INTERVAL_BROKER = 1500;   // ms — saat EA benar-benar mengalirkan tick
    var INTERVAL_BROKER_DIAM = 15000; // ms — tidak ada aliran (EA mati / akhir pekan): dulu tetap 1,5 dtk
    var MAKS_UMUR_BROKER = 5000;  // tick lebih tua dari ini tidak dianggap streaming

    var keadaanWs = 'idle';       // idle | mencoba | stream | mati
    var soket = null;
    var hostAktif = null;
    var gagalBerturut = 0;
    var delayUlang = DELAY_AWAL;
    var timerUlang = null;
    var tickTerakhir = 0;
    var jumlahTick = 0;
    var sedangJalan = false;
    var dijeda = false;
    var terbukaSejak = 0;
    var tickSaatBuka = 0;
    var STABIL_MIN_MS = 8000;     // koneksi yang putus sebelum ini tetap dihitung gagal

    var brokerJalan = false;
    var brokerTimer = null;
    var brokerTickTerakhir = 0;
    var brokerJumlahTick = 0;
    var brokerTerakhir = null;    // { spread, count }

    /** Status yang dilaporkan ke halaman: utamakan sumber yang paling segar. */
    function laporkan() {
        var brokerSegar = brokerTickTerakhir && (Date.now() - brokerTickTerakhir) < MAKS_UMUR_BROKER;
        var keadaan = brokerSegar ? 'broker' : (keadaanWs === 'stream' ? 'stream' : 'polling');
        try {
            if (typeof window.qiRealtimeState === 'function') window.qiRealtimeState(keadaan, hostAktif, {
                brokerAgeMs: brokerTickTerakhir ? (Date.now() - brokerTickTerakhir) : null,
                brokerSymbols: brokerTerakhir ? brokerTerakhir.count : 0
            });
        } catch (e) { /* label gagal diperbarui bukan masalah besar */ }
    }

    function setKeadaanWs(k) {
        if (keadaanWs === k) return;
        keadaanWs = k;
        laporkan();
    }

    // ── WebSocket: uji host, sambung, dan pulih sendiri ─────────────────────
    function urlGabungan(host) {
        var bagian = [];
        for (var i = 0; i < SIMBOL_KRIPTO.length; i++) bagian.push(SIMBOL_KRIPTO[i].toLowerCase() + '@miniTicker');
        return host + '/stream?streams=' + bagian.join('/');
    }

    function ujiHost(host, lanjut) {
        var percobaan = null, selesai = false;
        var beres = function (ok) {
            if (selesai) return;
            selesai = true;
            try { if (percobaan) percobaan.close(); } catch (e) {}
            lanjut(ok);
        };
        try {
            percobaan = new WebSocket(host + '/ws/btcusdt@miniTicker');
        } catch (e) {
            return beres(false);
        }
        var timer = setTimeout(function () { beres(false); }, TIMEOUT_UJI);
        percobaan.onopen = function () { clearTimeout(timer); beres(true); };
        percobaan.onerror = function () { clearTimeout(timer); beres(false); };
    }

    function pilihHost(daftar, lanjut) {
        if (!daftar.length) return lanjut(null);
        ujiHost(daftar[0], function (ok) {
            if (ok) return lanjut(daftar[0]);
            pilihHost(daftar.slice(1), lanjut);
        });
    }

    function tanganiPesan(ev) {
        try {
            var j = JSON.parse(ev.data);
            var d = j && j.data ? j.data : j;          // aliran gabungan membungkus di .data
            if (!d) return;
            var sym = String(d.s || '').toUpperCase();
            var harga = parseFloat(d.c);
            if (!sym || !isFinite(harga) || harga <= 0) return;

            tickTerakhir = Date.now();
            jumlahTick++;
            if (window._livePrices) window._livePrices[sym] = harga;
            if (typeof window.qiRealtimeTick === 'function') window.qiRealtimeTick(sym, harga, { source: 'binance_ws' });
        } catch (e) { /* satu pesan rusak tidak boleh menghentikan aliran */ }
    }

    function jadwalkanUlang() {
        if (dijeda || !sedangJalan) return;
        if (gagalBerturut >= MAKS_GAGAL) { setKeadaanWs('mati'); laporkan(); return; }
        clearTimeout(timerUlang);
        timerUlang = setTimeout(function () {
            delayUlang = Math.min(delayUlang * 2, DELAY_MAKS);
            sambungKe(hostAktif || HOSTS[0]);
        }, delayUlang);
    }

    function sambungKe(host) {
        if (!sedangJalan || dijeda) return;
        setKeadaanWs('mencoba');
        try {
            soket = new WebSocket(urlGabungan(host));
        } catch (e) {
            gagalBerturut++;
            return jadwalkanUlang();
        }
        soket.onopen = function () {
            hostAktif = host;
            terbukaSejak = Date.now();
            tickSaatBuka = jumlahTick;
            setKeadaanWs('stream');
        };
        soket.onmessage = tanganiPesan;
        soket.onerror = function () { /* penutupan ditangani onclose */ };
        soket.onclose = function () {
            // Reset penghitung hanya bila sesi benar-benar stabil (lama terbuka DAN ada data);
            // kalau di-reset saat onopen, siklus buka-tutup cepat tidak pernah mencapai MAKS_GAGAL.
            var stabil = terbukaSejak && (Date.now() - terbukaSejak) >= STABIL_MIN_MS && jumlahTick > tickSaatBuka;
            terbukaSejak = 0;
            soket = null;
            if (!sedangJalan || dijeda) return;
            if (stabil) { gagalBerturut = 0; delayUlang = DELAY_AWAL; }
            gagalBerturut++;
            setKeadaanWs('mencoba');
            jadwalkanUlang();
        };
    }

    function mulaiWs() {
        if (sedangJalan) return;
        if (typeof WebSocket !== 'function') { setKeadaanWs('mati'); return; }
        sedangJalan = true;
        dijeda = false;
        setKeadaanWs('mencoba');
        pilihHost(HOSTS, function (host) {
            if (!sedangJalan) return;
            if (!host) { setKeadaanWs('mati'); laporkan(); return; }
            hostAktif = host;
            sambungKe(host);
        });
    }

    function hentikanWs() {
        sedangJalan = false;
        clearTimeout(timerUlang);
        try { if (soket) soket.close(); } catch (e) {}
        soket = null;
        setKeadaanWs('mati');
    }

    // ── Tick broker (EA MT5) ────────────────────────────────────────────────
    function punyaToken() {
        try {
            // Selalu lewat window: di browser keduanya sama, tetapi bentuk eksplisit
            // tidak bergantung pada variabel global implisit dan tetap bisa diuji.
            if (window.QuantumAuth && typeof window.QuantumAuth.getToken === 'function') return !!window.QuantumAuth.getToken();
        } catch (e) {}
        return false;
    }

    function headerAuth() {
        try {
            if (window.QuantumAuth && typeof window.QuantumAuth.authHeaders === 'function') return window.QuantumAuth.authHeaders();
        } catch (e) {}
        return {};
    }

    function jadwalBroker(ms) {
        clearTimeout(brokerTimer);
        if (!brokerJalan || dijeda) return;
        brokerTimer = setTimeout(ambilTickBroker, ms);
    }

    function ambilTickBroker() {
        if (!brokerJalan || dijeda) return;
        var berikut = INTERVAL_BROKER_DIAM;
        try {
            fetch('api/tick.php', { headers: headerAuth(), cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (j && j.streaming) berikut = INTERVAL_BROKER;
                    if (!j || j.status !== 'success' || !j.ticks) return;
                    var jumlah = 0;
                    for (var sym in j.ticks) {
                        if (!Object.prototype.hasOwnProperty.call(j.ticks, sym)) continue;
                        var t = j.ticks[sym] || {};
                        var harga = parseFloat(t.bid);
                        if (!isFinite(harga) || harga <= 0) continue;
                        if (window._livePrices) window._livePrices[sym] = harga;
                        if (typeof window.qiRealtimeTick === 'function') {
                            window.qiRealtimeTick(sym, harga, { source: 'mt5_tick', spread: parseFloat(t.spread) });
                        }
                        jumlah++;
                    }
                    if (jumlah > 0) {
                        brokerTickTerakhir = Date.now();
                        brokerJumlahTick++;
                        brokerTerakhir = { count: jumlah };
                        laporkan();
                    }
                })
                .catch(function () { /* diamkan: polling 15 detik tetap berjalan */ })
                .then(function () { jadwalBroker(berikut); });
        } catch (e) { /* fetch tidak tersedia: abaikan */ }
    }

    function mulaiBroker() {
        if (brokerJalan) return;
        if (!punyaToken()) return;            // belum login: jangan memanggil endpoint ber-auth
        brokerJalan = true;
        ambilTickBroker();   // menjadwalkan dirinya sendiri (cepat bila streaming, lambat bila tidak)
    }

    function hentikanBroker() {
        brokerJalan = false;
        clearTimeout(brokerTimer);
        brokerTimer = null;
    }

    // ── Kendali publik ──────────────────────────────────────────────────────
    function mulai() {
        try { mulaiWs(); } catch (e) { setKeadaanWs('mati'); }
        try { mulaiBroker(); } catch (e) {}
        laporkan();
    }

    function hentikan() {
        hentikanWs();
        hentikanBroker();
        laporkan();
    }

    // Hemat baterai & kuota: hentikan keduanya saat tab tidak terlihat.
    function pantauVisibilitas() {
        document.addEventListener('visibilitychange', function () {
            try {
                if (document.visibilityState === 'hidden') {
                    dijeda = true;
                    clearTimeout(timerUlang);
                    try { if (soket) soket.close(); } catch (e) {}
                    soket = null;
                    hentikanBroker();
                } else if (dijeda) {
                    dijeda = false;
                    // WS yang sudah menyerah tetap mati; polling 15 detik sudah menangani harga.
                    if (keadaanWs !== 'mati' && gagalBerturut < MAKS_GAGAL) {
                        delayUlang = DELAY_AWAL;
                        sambungKe(hostAktif || HOSTS[0]);
                    }
                    mulaiBroker();
                }
            } catch (e) {}
        });
    }

    function status() {
        return {
            keadaan: brokerTickTerakhir && (Date.now() - brokerTickTerakhir) < MAKS_UMUR_BROKER
                ? 'broker'
                : (keadaanWs === 'stream' ? 'stream' : 'polling'),
            host: hostAktif,
            umurTickMs: tickTerakhir ? (Date.now() - tickTerakhir) : null,
            jumlahTick: jumlahTick,
            gagalBerturut: gagalBerturut,
            brokerUmurMs: brokerTickTerakhir ? (Date.now() - brokerTickTerakhir) : null,
            brokerJumlahTick: brokerJumlahTick
        };
    }

    window.QuantumRealtime = {
        start: function () { try { mulai(); } catch (e) { setKeadaanWs('mati'); } },
        stop: function () { try { hentikan(); } catch (e) {} },
        state: status,
        symbols: SIMBOL_KRIPTO.slice()
    };

    function inisialisasi() {
        pantauVisibilitas();   // sebelumnya fungsi ini tidak pernah dipanggil -> penghematan baterai tidak aktif
        window.QuantumRealtime.start();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inisialisasi, { once: true });
    } else {
        inisialisasi();
    }
})();
