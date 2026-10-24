/* Quantum Institut chart bridge.
 * Receives confirmed/provisional signals from the authenticated dashboard and
 * renders them through the chart engine's native overlay API.
 */
(function () {
    'use strict';

    var chart = null;
    var pending = null;
    var pendingPine = null;
    var signalState = null;
    var pineState = null;
    var positionId = 'qt-signal-position';
    var markerId = 'qt-signal-marker';
    var provisionalMarkerId = 'qt-signal-provisional';

    function clearOverlay() {
        if (!chart) return;
        try { chart.setPositions([]); } catch (e) {}
        try { chart.setSignalMarkers([]); } catch (e) {}
    }

    function applyCommand(command, payload) {
        if (!chart) return;
        try {
            if (command === 'crosshair' && typeof chart.setCrosshairMode === 'function') {
                chart.setCrosshairMode(payload && payload.mode === 'normal' ? 'normal' : 'magnet');
            } else if (command === 'zoom') {
                if (payload && payload.direction === 'out' && typeof chart.zoomOut === 'function') chart.zoomOut();
                else if (typeof chart.zoomIn === 'function') chart.zoomIn();
            } else if (command === 'reset') {
                if (typeof chart.fitContent === 'function') chart.fitContent();
                else if (typeof chart.setVisibleRangePreset === 'function') chart.setVisibleRangePreset('All');
                if (typeof chart.setAutoScale === 'function') chart.setAutoScale(true);
            } else if (command === 'palette' && payload && payload.overrides && typeof chart.applyOverrides === 'function') {
                chart.applyOverrides(payload.overrides, { layer: 'user' });
            } else if (command === 'fullscreen') {
                var root = document.querySelector('.tcw-root') || document.documentElement;
                if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
                else if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
            }
        } catch (e) {}
    }

    function compactReason(reason) {
        return String(reason || 'Konfirmasi indikator').replace(/\s+/g, ' ').slice(0, 78);
    }

    function renderOverlays() {
        if (!chart) return;
        var markers = [], positions = [];
        var signal = signalState && signalState.enabled ? signalState.signal : null;
        var pine = pineState && pineState.enabled ? pineState.signal : null;
        if (signal) {
            var side = signal.side === 'SELL' ? 'sell' : 'buy';
            markers.push({ id: markerId, time: Number(signal.time), price: Number(signal.price), direction: side === 'sell' ? 'short' : 'long', confidence: Math.max(0, Math.min(1, Number(signal.confidence) || 0)), source: signal.source || 'Quantum Terminal', label: signal.side + ' · ' + compactReason(signal.reason) });
            if (signal.provisional && Number.isFinite(Number(signal.provisional.time))) markers.push({ id: provisionalMarkerId, time: Number(signal.provisional.time), price: Number(signal.provisional.price), direction: signal.provisional.side === 'SELL' ? 'short' : 'long', confidence: 0.45, source: 'Provisional', label: 'PROVISIONAL · ' + signal.provisional.side + ' · candle aktif' });
            if (Number.isFinite(Number(signal.entry)) && Number.isFinite(Number(signal.stopLoss)) && Number.isFinite(Number(signal.takeProfit))) positions.push({ id: positionId, side: side, entryPrice: Number(signal.entry), quantity: 1, stopLoss: Number(signal.stopLoss), takeProfit: Number(signal.takeProfit) });
        }
        if (pine) {
            var pineSide = pine.side === 'SELL' ? 'sell' : 'buy';
            markers.push({ id: 'qt-pine-marker', time: Number(pine.time), price: Number(pine.price), direction: pineSide === 'sell' ? 'short' : 'long', confidence: Math.max(0, Math.min(1, Number(pine.confidence) || 0)), source: 'Pine SMC+SnD', label: pine.side + ' · ' + compactReason(pine.reason) });
            if (Number.isFinite(Number(pine.entry)) && Number.isFinite(Number(pine.stopLoss)) && Number.isFinite(Number(pine.takeProfit))) positions.push({ id: 'qt-pine-position', side: pineSide, entryPrice: Number(pine.entry), quantity: 1, stopLoss: Number(pine.stopLoss), takeProfit: Number(pine.takeProfit) });
        }
        try { chart.setSignalMarkers(markers); chart.setPositions(positions); } catch (e) {}
    }

    function apply(payload) {
        signalState = payload && payload.enabled && payload.signal ? payload : null;
        if (!chart) { pending = payload; return; }
        pending = null;
        renderOverlays();
    }

    function applyPine(payload) {
        pineState = payload && payload.enabled && payload.signal ? payload : null;
        if (!chart) { pendingPine = payload; return; }
        pendingPine = null;
        renderOverlays();
    }

    window.addEventListener('qt-chart-ready', function (event) {
        chart = event.detail || window.__quantumTerminalChart || null;
        try { chart.setTradingConfig({ lineButtons: { close: false, reverse: false, removeStops: false }, positionLabel: '{side} · {entry}' }); } catch (e) {}
        if (pending) apply(pending);
        if (pendingPine) applyPine(pendingPine);
    });

    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin || !event.data) return;
        if (event.data.type === 'qt-signal-overlay') apply(event.data.payload);
        if (event.data.type === 'qt-pine-overlay') applyPine(event.data.payload);
        if (event.data.type === 'qt-chart-command') applyCommand(event.data.command, event.data.payload || {});
    });

    window.__qtSignalOverlay = { apply: apply };
})();
