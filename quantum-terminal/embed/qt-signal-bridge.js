/* Quantum Institut chart bridge.
 * Receives confirmed/provisional signals from the authenticated dashboard and
 * renders them through the chart engine's native overlay API.
 */
(function () {
    'use strict';

    var chart = null;
    var pending = null;
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

    function apply(payload) {
        if (!chart) { pending = payload; return; }
        if (!payload || !payload.enabled || !payload.signal) {
            pending = null;
            clearOverlay();
            return;
        }

        var signal = payload.signal;
        var side = signal.side === 'SELL' ? 'sell' : 'buy';
        var direction = side === 'sell' ? 'short' : 'long';
        var markers = [{
            id: markerId,
            time: Number(signal.time),
            price: Number(signal.price),
            direction: direction,
            confidence: Math.max(0, Math.min(1, Number(signal.confidence) || 0)),
            source: signal.source || 'Quantum Terminal',
            label: signal.side + ' · ' + compactReason(signal.reason)
        }];

        if (signal.provisional && Number.isFinite(Number(signal.provisional.time))) {
            markers.push({
                id: provisionalMarkerId,
                time: Number(signal.provisional.time),
                price: Number(signal.provisional.price),
                direction: signal.provisional.side === 'SELL' ? 'short' : 'long',
                confidence: 0.45,
                source: 'Provisional',
                label: 'PROVISIONAL · ' + signal.provisional.side + ' · candle aktif'
            });
        }

        try {
            chart.setSignalMarkers(markers);
            if (Number.isFinite(Number(signal.entry)) && Number.isFinite(Number(signal.stopLoss)) && Number.isFinite(Number(signal.takeProfit))) {
                chart.setPositions([{
                    id: positionId,
                    side: side,
                    entryPrice: Number(signal.entry),
                    quantity: 1,
                    stopLoss: Number(signal.stopLoss),
                    takeProfit: Number(signal.takeProfit)
                }]);
            } else {
                chart.setPositions([]);
            }
        } catch (e) {
            // A chart that is still mounting will receive the next dashboard update.
            pending = payload;
        }
    }

    window.addEventListener('qt-chart-ready', function (event) {
        chart = event.detail || window.__quantumTerminalChart || null;
        try { chart.setTradingConfig({ lineButtons: { close: false, reverse: false, removeStops: false }, positionLabel: '{side} · {entry}' }); } catch (e) {}
        if (pending) apply(pending);
    });

    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin || !event.data) return;
        if (event.data.type === 'qt-signal-overlay') apply(event.data.payload);
        if (event.data.type === 'qt-chart-command') applyCommand(event.data.command, event.data.payload || {});
    });

    window.__qtSignalOverlay = { apply: apply };
})();
