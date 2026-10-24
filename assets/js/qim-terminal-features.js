/* Restored dashboard tools for the chart-first terminal.
 *
 * This module deliberately keeps the widgets small and data-honest:
 * server price alerts use api/price-alerts.php, track record uses the existing
 * dimensional API, journal notes stay local to the signed-in device, and Pine
 * uses the same pure JS port as the server scanner.
 */
(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const level = { free: 0, pro: 1, vip: 2, admin: 3 };
    const role = () => level[String(window.QI_PERAN || 'free').toLowerCase()] || 0;
    const hasPro = () => role() >= level.pro;
    const toast = (message, tone) => {
        try { if (typeof window.showQuantumToast === 'function') window.showQuantumToast(message, tone || 'info', 6000); }
        catch (e) {}
    };
    const authHeaders = () => {
        try { return window.QuantumAuth && typeof window.QuantumAuth.authHeaders === 'function' ? window.QuantumAuth.authHeaders() : {}; }
        catch (e) { return {}; }
    };
    const text = (node, value) => { if (node) node.textContent = value == null ? '' : String(value); };
    const escNumber = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';

    function lock(node, label, locked) {
        if (!node) return;
        node.classList.toggle('is-pro-locked', locked);
        let cover = node.querySelector(':scope > .qt-pro-lock');
        if (locked) {
            if (!cover) {
                cover = document.createElement('div');
                cover.className = 'qt-pro-lock';
                cover.innerHTML = '<strong></strong><span>Fitur ini tersedia untuk Quantum+ PRO.</span><a href="pricing.html">Lihat paket PRO →</a>';
                node.appendChild(cover);
            }
            text(cover.querySelector('strong'), label + ' · PRO');
            cover.hidden = false;
        } else if (cover) cover.hidden = true;
    }

    function syncGates() {
        const free = !hasPro();
        lock($('qtPanel-backtest'), 'Backtest', free);
        lock($('qtAlertCard'), 'Server alert', free);
        lock($('qtKartu'), 'Order ticket', free);
        lock(document.querySelector('.qim-qt-guard'), 'Pengaman posisi', free);
        const backtestTab = document.querySelector('[data-qt-tab="backtest"]');
        if (backtestTab) {
            backtestTab.classList.toggle('is-pro-locked-tab', free);
            backtestTab.setAttribute('aria-label', free ? 'Backtest, khusus PRO' : 'Backtest');
        }
        const real = $('qtAkunReal');
        if (real) real.hidden = free;
        if (free && typeof window.qtSetAkun === 'function') {
            try { window.qtSetAkun(null, null, 'sim'); } catch (e) {}
        }
        if (typeof window.qtSegarkan === 'function') {
            try { window.qtSegarkan(); } catch (e) {}
        }
        if (!free) {
            loadAlerts();
        } else {
            renderAlertLock();
        }
    }

    function requirePro(event, label) {
        if (hasPro()) return true;
        if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
        toast(label + ' tersedia untuk Quantum+ PRO. Buka pricing untuk upgrade.', 'info');
        return false;
    }

    // ── Server price alerts ────────────────────────────────────────────────
    async function alertApi(method, body, query) {
        const options = { method, headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()), cache: 'no-store' };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch('api/price-alerts.php' + (query || ''), options);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Server alert tidak dapat diproses.');
        return data;
    }

    function renderAlertLock() {
        const list = $('qtAlertList');
        if (!list) return;
        list.replaceChildren();
        const note = document.createElement('span'); note.className = 'qt-empty'; note.textContent = 'Upgrade PRO untuk membuat alert server.'; list.appendChild(note);
    }

    function renderAlerts(alerts) {
        const list = $('qtAlertList');
        if (!list) return;
        list.replaceChildren();
        if (!Array.isArray(alerts) || !alerts.length) { const empty = document.createElement('span'); empty.className = 'qt-empty'; empty.textContent = 'Belum ada alert aktif.'; list.appendChild(empty); return; }
        alerts.forEach(item => {
            const row = document.createElement('div'); row.className = 'qt-tool-row';
            const copy = document.createElement('span'); copy.textContent = item.symbol + ' ' + (item.direction === 'above' ? '≥ ' : '≤ ') + escNumber(item.price) + (item.active ? '' : ' · terpenuhi');
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'qt-tool-remove'; remove.textContent = 'Hapus';
            remove.addEventListener('click', async () => { try { const data = await alertApi('DELETE', null, '?id=' + encodeURIComponent(item.id)); renderAlerts(data.alerts); } catch (e) { toast(e.message, 'error'); } });
            row.append(copy, remove); list.appendChild(row);
        });
    }

    async function loadAlerts() {
        if (!hasPro()) return renderAlertLock();
        try { const data = await alertApi('GET'); renderAlerts(data.alerts); }
        catch (e) { const list = $('qtAlertList'); if (list) text(list, e.message); }
    }

    async function addAlert() {
        if (!requirePro(null, 'Server alert')) return;
        const symbol = String($('qtAlertSymbol')?.value || '').trim().toUpperCase();
        const price = Number($('qtAlertPrice')?.value);
        const direction = $('qtAlertDirection')?.value || 'above';
        if (!symbol || !Number.isFinite(price) || price <= 0) return toast('Isi pair dan harga target yang valid.', 'warning');
        try {
            const data = await alertApi('POST', { symbol, price, direction });
            renderAlerts(data.alerts); if ($('qtAlertPrice')) $('qtAlertPrice').value = '';
            toast('Alert ' + symbol + ' disimpan di server.', 'success');
        } catch (e) { toast(e.message, 'error'); }
    }

    // ── Track record per mesin/pair/timeframe ───────────────────────────────
    let trackData = null;
    function renderTrack() {
        const summary = $('qtTrackSummary'), body = $('qtTrackBody'), dimension = $('qtTrackDimension')?.value || 'mesin';
        if (!trackData || !summary || !body) return;
        const s = trackData.semua || {};
        summary.replaceChildren();
        [['Selesai', (s.selesai ?? 0) + ' / ' + (s.total ?? 0)], ['Win rate', s.win_rate == null ? '—' : s.win_rate + '%'], ['Expectancy', s.expectancy == null ? '—' : (s.expectancy > 0 ? '+' : '') + s.expectancy + 'R'], ['PF', s.pf == null ? '—' : s.pf], ['Max DD', s.max_dd_r ? '-' + s.max_dd_r + 'R' : '0R']].forEach(([label, value]) => { const cell = document.createElement('span'); cell.innerHTML = '<small></small><strong></strong>'; text(cell.querySelector('small'), label); text(cell.querySelector('strong'), value); summary.appendChild(cell); });
        body.replaceChildren();
        const rows = Array.isArray(trackData[dimension]) ? trackData[dimension] : [];
        text($('qtTrackNameHead'), dimension === 'mesin' ? 'Mesin' : dimension === 'pair' ? 'Pair' : 'Timeframe');
        if (!rows.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 6; cell.className = 'qt-empty'; cell.textContent = 'Belum ada data pada periode ini.'; row.appendChild(cell); body.appendChild(row); return; }
        rows.forEach(item => {
            const row = document.createElement('tr');
            [item.nama, item.selesai + ' / ' + item.total, item.win_rate == null ? '—' : item.win_rate + '%', item.expectancy == null ? '—' : (item.expectancy > 0 ? '+' : '') + item.expectancy + 'R', item.pf == null ? '—' : item.pf, item.max_dd_r ? '-' + item.max_dd_r + 'R' : '0R'].forEach((value, index) => { const cell = document.createElement('td'); cell.textContent = value; if (index === 0 && item.sampel_kecil) cell.title = 'Sampel kecil — minimal ' + trackData.sampel_min + ' sinyal selesai.'; row.appendChild(cell); });
            body.appendChild(row);
        });
    }

    async function loadTrack() {
        const days = $('qtTrackDays')?.value || '0';
        try {
            const response = await fetch('api/track-record.php?hari=' + encodeURIComponent(days), { headers: authHeaders(), cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Track record tidak dapat dimuat.');
            trackData = data; renderTrack();
        } catch (e) { const summary = $('qtTrackSummary'); if (summary) text(summary, e.message); }
    }

    // ── Local journal ──────────────────────────────────────────────────────
    function journalKey() {
        try { const user = window.QuantumAuth?.getUserData?.(); return 'qt_journal_v1:' + String(user?.id || user?.email || 'local').toLowerCase(); } catch (e) { return 'qt_journal_v1:local'; }
    }
    function readJournal() { try { const data = JSON.parse(localStorage.getItem(journalKey()) || '[]'); return Array.isArray(data) ? data : []; } catch (e) { return []; } }
    function writeJournal(data) { try { localStorage.setItem(journalKey(), JSON.stringify(data.slice(0, 100))); } catch (e) {} }
    function renderJournal() {
        const list = $('qtJournalList'); if (!list) return;
        list.replaceChildren(); const data = readJournal();
        if (!data.length) { const empty = document.createElement('span'); empty.className = 'qt-empty'; empty.textContent = 'Belum ada catatan.'; list.appendChild(empty); return; }
        data.slice(0, 8).forEach(item => { const row = document.createElement('div'); row.className = 'qt-tool-row'; const copy = document.createElement('span'); copy.textContent = item.symbol + ' · ' + item.side + ' · ' + item.result + ' · ' + (item.r || '0') + 'R' + (item.notes ? ' · ' + item.notes : ''); row.appendChild(copy); list.appendChild(row); });
    }
    function addJournal() {
        const item = { symbol: String($('qtJournalSymbol')?.value || '').trim().toUpperCase(), side: $('qtJournalSide')?.value || 'BUY', result: $('qtJournalResult')?.value || 'open', r: Number($('qtJournalR')?.value || 0).toFixed(2), notes: String($('qtJournalNotes')?.value || '').trim(), at: new Date().toISOString() };
        if (!item.symbol) return toast('Isi pair untuk jurnal.', 'warning');
        writeJournal([item, ...readJournal()]); renderJournal(); if ($('qtJournalNotes')) $('qtJournalNotes').value = ''; toast('Catatan jurnal disimpan di perangkat ini.', 'success');
    }

    // ── Pine SMC+SnD overlay ───────────────────────────────────────────────
    let pineResult = null;
    function sendPineOverlay() {
        const frame = $('quantumTerminalFrame'), enabled = Boolean($('qtPineOverlay')?.checked && pineResult);
        if (!frame?.contentWindow) return;
        const h = pineResult, side = h.buy?.valid ? 'BUY' : h.sell?.valid ? 'SELL' : null, levels = side === 'BUY' ? h.buy : h.sell;
        const last = pineResult._candles?.[pineResult._candles.length - 1];
        const signal = side && last ? { side, time: last.time, price: levels.entry, entry: levels.entry, stopLoss: levels.sl, takeProfit: levels.tp3, confidence: 0.8, reason: 'Pine SMC+SnD · ' + levels.status, source: 'Pine SMC+SnD' } : null;
        frame.contentWindow.postMessage({ type: 'qt-pine-overlay', payload: { enabled, signal } }, window.location.origin);
    }
    function renderPine() {
        const status = $('qtPineStatus'), levels = $('qtPineLevels'); if (!status || !levels || !pineResult) return;
        const buy = pineResult.buy || {}, sell = pineResult.sell || {};
        text(status, 'Data ' + pineResult.n + ' candle · BUY ' + (buy.status || 'WAIT') + ' · SELL ' + (sell.status || 'WAIT'));
        levels.replaceChildren();
        [['BUY', buy], ['SELL', sell]].forEach(([name, item]) => { const card = document.createElement('div'); card.className = 'qt-pine-level'; const title = document.createElement('strong'); title.textContent = name + ' · ' + (item.status || 'WAIT'); card.appendChild(title); const line = document.createElement('span'); line.textContent = 'Entry ' + escNumber(item.entry) + ' · SL ' + escNumber(item.sl) + ' · TP3 ' + escNumber(item.tp3); card.appendChild(line); levels.appendChild(card); });
        sendPineOverlay();
    }
    async function loadPine() {
        if (!window.QIMPineSmcSnd) return text($('qtPineStatus'), 'Modul Pine belum siap.');
        text($('qtPineStatus'), 'Mengambil candle XAUUSD H4…');
        try {
            const response = await fetch('api/get-chart-data.php?symbol=XAUUSD&interval=240', { headers: authHeaders(), cache: 'no-store' });
            const data = await response.json(); if (!response.ok || !Array.isArray(data.candles)) throw new Error(data.message || 'Data candle tidak tersedia.');
            pineResult = window.QIMPineSmcSnd.hitung(data.candles); pineResult._candles = data.candles; renderPine();
        } catch (e) { text($('qtPineStatus'), e.message || 'Pine gagal dihitung.'); }
    }

    document.addEventListener('click', event => {
        const tab = event.target.closest?.('[data-qt-tab="backtest"]');
        if (tab && !requirePro(event, 'Backtest')) return;
        if (event.target.closest?.('#qtRunBacktest') && !requirePro(event, 'Backtest')) return;
        if (event.target.closest?.('#qtAlertAdd') && !requirePro(event, 'Server alert')) return;
    }, true);
    window.addEventListener('qi-sesi', syncGates);
    document.addEventListener('DOMContentLoaded', () => {
        syncGates(); renderJournal(); loadTrack(); loadPine();
        $('qtAlertAdd')?.addEventListener('click', addAlert);
        $('qtTrackDays')?.addEventListener('change', loadTrack); $('qtTrackDimension')?.addEventListener('change', renderTrack);
        $('qtJournalAdd')?.addEventListener('click', addJournal); $('qtPineRefresh')?.addEventListener('click', loadPine); $('qtPineOverlay')?.addEventListener('change', sendPineOverlay);
        $('quantumTerminalFrame')?.addEventListener('load', sendPineOverlay);
    });
})();
