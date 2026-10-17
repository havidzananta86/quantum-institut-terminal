// qim-chart-store.js: permintaan candle identik digabung, dipakai ulang ≤10 dtk, dipisah per token,
// dan batal (abort) satu pemanggil tidak mengganggu pemanggil lain.
'use strict';
const S = require('../assets/js/qim-chart-store.js');
let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info))); if (!kondisi) gagal++; }

(async () => {
    let panggilan = 0, waktu = 1000, token = 'A';
    const palsu = (url, opsi) => { panggilan++; return new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ url, n: panggilan }), { status: url.includes('gagal') ? 500 : 200, headers: { 'Content-Type': 'application/json' } })), 20)); };
    const f = S.buat(palsu, () => token, () => waktu);
    const U = 'api/get-chart-data.php?symbol=XAUUSD&interval=60';

    const lima = await Promise.all([1, 2, 3, 4, 5].map(() => f(U).then(r => r.json())));
    cek('5 permintaan identik bersamaan → 1 unduhan', panggilan === 1 && lima.every(x => x.n === 1), panggilan);
    const j = await f(U + '&_=123');
    cek('dalam 10 dtk, parameter "_" diabaikan → dijawab dari memori', panggilan === 1 && j.headers.get('X-QIM-Store') === 'memori');
    cek('jawaban memori tetap Response JSON yang sah', (await j.json()).n === 1 && j.ok && j.status === 200);
    await f('api/get-chart-data.php?interval=60&symbol=XAUUSD');
    cek('urutan parameter tidak berpengaruh', panggilan === 1);
    token = 'B';
    await f(U);
    cek('token berbeda (pengguna MT5 vs lain) → unduhan terpisah', panggilan === 2);
    token = 'A'; waktu += 10001;
    await f(U);
    cek('lewat 10 dtk → diunduh ulang', panggilan === 3);
    await f('api/get-chart-data.php?symbol=EURUSD&interval=60');
    cek('simbol berbeda → unduhan terpisah', panggilan === 4);
    await f('api/live-price.php?symbols=XAUUSD');
    await f('api/live-price.php?symbols=XAUUSD');
    cek('endpoint lain tidak disentuh (diteruskan apa adanya)', panggilan === 6);
    await f(U + '&x=1', { method: 'POST' }); await f(U + '&x=1', { method: 'POST' });
    cek('POST tidak digabung', panggilan === 8);
    await f(U + '&y=1', { cache: 'no-store' }); await f(U + '&y=1', { cache: 'no-store' });
    cek('cache: no-store dihormati', panggilan === 10);
    const g1 = await f('api/get-chart-data.php?symbol=gagal'); const g2 = await f('api/get-chart-data.php?symbol=gagal');
    cek('jawaban gagal (500) tidak disimpan', g1.status === 500 && g2.status === 500 && panggilan === 12);

    const ac = new AbortController();
    const p1 = f('api/get-chart-data.php?symbol=BTCUSDT', { signal: ac.signal });
    const p2 = f('api/get-chart-data.php?symbol=BTCUSDT');
    ac.abort();
    let dibatal = false; try { await p1; } catch (e) { dibatal = e.name === 'AbortError'; }
    const b2 = await p2;
    cek('abort satu pemanggil → pemanggil itu AbortError, yang lain tetap dapat data', dibatal && b2.ok && (await b2.json()).n > 0 && panggilan === 13);
    cek('statistik tercatat', f.statistik.minta > 0 && f.statistik.memori >= 2 && f.statistik.gabung >= 5, f.statistik);
    cek('kunci: path + parameter terurut tanpa "_" + token', S.kunci('/webapp/api/get-chart-data.php?b=2&_=9&a=1', 'T', 'http://x/') === 'api/get-chart-data.php?a=1&b=2|T');

    if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
    console.log('\nPASS — permintaan candle digabung tanpa mengorbankan kesegaran data');
})();
