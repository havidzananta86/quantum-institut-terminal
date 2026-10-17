/**
 * qim-mt5-socket.js — the client must stay quiet when the MT5 bridge is not usable:
 *  - token endpoint says "disabled" (not configured / not entitled) → no socket, no retries;
 *  - bridge configured but unreachable → after 5 failed attempts it waits 10 minutes between tries,
 *    also when the tab becomes visible again.
 * Runs the real file in a vm sandbox with a fake clock, fetch and WebSocket. No network.
 * Run: node tests/mt5-socket.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'qim-mt5-socket.js'), 'utf8');
let failed = 0;
const check = (name, ok, info) => { console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : '  ' + JSON.stringify(info)}`); if (!ok) failed++; };

function sandbox(tokenReply) {
  let now = 0, seq = 0;
  const timers = new Map();
  const listeners = {};
  const sockets = [];
  const logs = [];
  const fetches = [];
  class FakeSocket {
    constructor(url) { this.url = url; this.readyState = 0; sockets.push(this); queueMicrotask(() => this.onclose && this.onclose({ code: 1006 })); }
    send() {}
    close() {}
  }
  FakeSocket.OPEN = 1;
  const doc = {
    readyState: 'complete', visibilityState: 'visible',
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  };
  const ctx = {
    console: { info: (...a) => logs.push(['info', a.join(' ')]), warn: (...a) => logs.push(['warn', a.join(' ')]), error: (...a) => logs.push(['error', a.join(' ')]) },
    document: doc,
    WebSocket: FakeSocket,
    URLSearchParams,
    Date: { now: () => now },
    Math,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async url => { fetches.push(url); return tokenReply(); },
    queueMicrotask,
  };
  ctx.window = ctx;
  ctx.window.QuantumAuth = { getToken: () => 'tok', authHeaders: () => ({ Authorization: 'Bearer tok' }) };
  ctx.window.qiRealtimeTick = () => {};
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const flush = () => new Promise(r => setImmediate(r));
  return {
    sockets, logs, fetches, doc, listeners,
    state: () => ctx.window.QIMMT5Socket.state().state,
    // Advance the fake clock to `untilMs`, firing timers in order.
    async run(untilMs) {
      await flush(); await flush();
      for (;;) {
        let next = null;
        for (const [id, t] of timers) if (t.at <= untilMs && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
        await flush(); await flush();
      }
      now = untilMs;
    },
  };
}

const json = (status, body) => () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

(async () => {
  // 1. Not configured: 200 + status 'disabled' → disabled, one fetch, never a socket.
  let s = sandbox(json(200, { status: 'disabled', code: 'BRIDGE_DISABLED' }));
  await s.run(60 * 60 * 1000);
  check('"disabled" reply turns the socket off without connecting', s.state() === 'disabled' && s.sockets.length === 0 && s.fetches.length === 1, { state: s.state(), sockets: s.sockets.length, fetches: s.fetches.length });

  // 2. Older server answering 404 still disables quietly.
  s = sandbox(json(404, { status: 'error' }));
  await s.run(60 * 60 * 1000);
  check('legacy 404 reply also disables', s.state() === 'disabled' && s.sockets.length === 0);

  // 3. Configured but unreachable: 5 quick attempts, then one per 10 minutes.
  s = sandbox(json(200, { status: 'success', data: { url: 'wss://bridge.invalid', token: 't', expires_in: 300, symbols: [] } }));
  await s.run(60 * 1000);
  const dalamMenit = s.sockets.length;
  await s.run(31 * 60 * 1000);
  const dalam31 = s.sockets.length;
  check('unreachable bridge: at most 5 attempts in the first minute', dalamMenit <= 5 && dalamMenit >= 4, dalamMenit);
  check('then about one attempt per 10 minutes (not every 30 s)', dalam31 - dalamMenit <= 3, { dalamMenit, dalam31 });
  check('a single info line, no error spam', s.logs.filter(l => /tiap 10 menit/.test(l[1])).length === 1 && !s.logs.some(l => l[0] === 'error'), s.logs);

  // 4. Tab hidden → visible during the pause does not trigger an immediate retry.
  const sebelum = s.sockets.length;
  s.doc.visibilityState = 'hidden'; s.listeners.visibilitychange.forEach(f => f());
  s.doc.visibilityState = 'visible'; s.listeners.visibilitychange.forEach(f => f());
  await s.run(31 * 60 * 1000 + 1000);
  check('becoming visible during the pause does not retry at once', s.sockets.length === sebelum, { sebelum, sesudah: s.sockets.length });

  console.log(failed ? `\nFAIL — ${failed} check(s) failed` : '\nPASS — MT5 socket stays quiet when the bridge is unusable');
  process.exit(failed ? 1 : 0);
})();
