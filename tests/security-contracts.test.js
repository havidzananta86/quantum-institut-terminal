// Prevent regressions in two financial-trust boundaries without needing a DB.
'use strict';
const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const payment = read('api/payment.php');
const history = read('api/signal-history.php');
const bridge = read('api/mt-bridge.php');
const connection = read('api/account-connection.php');
const liveTrade = read('api/live-trade.php');
const execution = read('api/mt-execution.php');
// The action whitelist checked before anything else in api/mt-bridge.php, sorted.
const bridgeActions = () => {
  const m = bridge.match(/in_array\(\(\$_GET\['action'\] \?\? ''\), \[([^\]]*)\], true\)/);
  return m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort().join(',') : null;
};
const checks = [
  ['payment verifies an HMAC signature', payment.includes("hash_hmac('sha256'") && payment.includes('hash_equals')],
  ['payment rejects unconfigured gateways', payment.includes('PAYMENT_NOT_CONFIGURED')],
  ['payment records webhook events idempotently', payment.includes('payment_events') && payment.includes('FOR UPDATE')],
  ['payment contains no placeholder QR payload', !payment.includes('qr_string') && !payment.includes('000201010212')],
  ['track-record publishing requires an administrator', history.includes('qi_require_admin();')],
  // Inbound only: account snapshots and price ticks FROM the EA. Any new action (e.g. a command
  // channel back to the terminal) must fail this contract until it is reviewed.
  ['MetaTrader bridge is explicitly read-only', bridge.includes('READ_ONLY_BRIDGE') && bridgeActions() === 'snapshot,tick'],
  ['MetaTrader bridge responses carry no commands', !/['"](orders|commands|execute|trade_requests)['"]\s*=>/.test(bridge)],
  ['MetaTrader bridge has no trade-command queue', !bridge.includes('orders_') && !bridge.includes("action === 'push'")],
  ['bridge keys are stored as hashes and can be revoked', connection.includes("hash('sha256', $bridgeKey)") && connection.includes('revoked_at')],
  ['live execution starts disabled and has an emergency stop', liveTrade.includes("enabled = 0") && liveTrade.includes('emergency_stop')],
  ['live execution requires explicit real-account confirmation', liveTrade.includes("AKTIFKAN REAL")],
  ['live execution enforces the selected hard limits', liveTrade.includes('$maxLot > 0.01') && liveTrade.includes('$daily > 50') && liveTrade.includes('$maxPositions > 10')],
  ['terminal execution validates SL and TP before order delivery', execution.includes("ORDER_GUARDRAIL") && execution.includes('DAILY_LOSS_LIMIT')],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
  if (!pass) failed++;
}
console.log(failed ? `\nFAIL — ${failed} security contract(s) failed` : '\nPASS — Security contracts hold');
process.exit(failed ? 1 : 0);
