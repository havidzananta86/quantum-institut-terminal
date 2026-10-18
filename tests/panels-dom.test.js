// tests/panels-dom.test.js
// Validates dashboard.html panel hierarchy, PANEL_META consistency, and mainScroll closure
const fs = require('fs');
const path = require('path');

const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const dashboardAppJs = fs.readFileSync(path.join(__dirname, '../assets/js/dashboard-app.js'), 'utf8');

// 1. Check mainScroll starts and closes correctly
const mainScrollOpenIdx = dashHtml.indexOf('id="mainScroll"');
if (mainScrollOpenIdx === -1) {
    console.error('FAIL: id="mainScroll" not found');
    process.exit(1);
}

const mainScrollCloseIdx = dashHtml.indexOf('</div><!-- /mainScroll -->');
if (mainScrollCloseIdx === -1) {
    console.error('FAIL: </div><!-- /mainScroll --> not found');
    process.exit(1);
}

if (mainScrollCloseIdx <= mainScrollOpenIdx) {
    console.error('FAIL: mainScroll closed before it was opened');
    process.exit(1);
}

// 2. Check that critical panels are located INSIDE mainScroll
const mainScrollContent = dashHtml.substring(mainScrollOpenIdx, mainScrollCloseIdx);
const panelsToCheck = [
    'panel-overview',
    'panel-account',
    'panel-charts',
    'panel-autosignal',
    'panel-sessions',
    'panel-crypto',
    'panel-risk',
    'panel-alerts',
    'panel-journal',
    'panel-screener',
    'panel-volatility',
    'panel-sentiment',
    'panel-watchlist',
    'panel-performance',
    'panel-mtf',
    'panel-leaderboard',
    'panel-academy'
];

panelsToCheck.forEach(pid => {
    if (!mainScrollContent.includes(`id="${pid}"`)) {
        console.error(`FAIL: ${pid} is NOT inside mainScroll!`);
        process.exit(1);
    }
    console.log(`  ✓ ${pid} is inside mainScroll`);
});

// 3. Check PANEL_META consistency
if (!dashboardAppJs.includes("'panel-account':")) {
    console.error('FAIL: panel-account missing from PANEL_META');
    process.exit(1);
}
console.log('  ✓ panel-account present in PANEL_META');

if (!dashboardAppJs.includes("'panel-academy':")) {
    console.error('FAIL: panel-academy missing from PANEL_META');
    process.exit(1);
}
console.log('  ✓ panel-academy present in PANEL_META');


// 4. Every sidebar destination must be an existing panel with title metadata.
// This prevents a new navigation item from silently opening a blank state.
const navPanels = [
    ...[...dashHtml.matchAll(/data-panel="(panel-[^"]+)"/g)].map(match => match[1]),
    ...[...dashHtml.matchAll(/data-qim-panel="(panel-[^"]+)"/g)].map(match => match[1])
];
const uniqueNavPanels = [...new Set(navPanels)];
uniqueNavPanels.forEach(pid => {
    if (!mainScrollContent.includes(`id="${pid}"`)) {
        console.error(`FAIL: sidebar target ${pid} does not exist inside mainScroll`);
        process.exit(1);
    }
    if (!dashboardAppJs.includes(`'${pid}':`)) {
        console.error(`FAIL: sidebar target ${pid} is missing PANEL_META`);
        process.exit(1);
    }
});
console.log(`  ✓ ${uniqueNavPanels.length} sidebar targets resolve to titled panels`);

// 5. Check Account & Risk guardrail controls
const accountElements = ['accountConnectionTitle', 'accountConnectionStatus', 'accountPerformanceSummary', 'riskProfileForm', 'riskPerTradePct', 'maxDailyLossPct', 'maxOpenPositions', 'saveRiskProfileBtn'];
accountElements.forEach(eid => {
    if (!dashHtml.includes(`id="${eid}"`)) {
        console.error(`FAIL: Account element ${eid} missing`);
        process.exit(1);
    }
    console.log(`  ✓ Account element ${eid} present`);
});
if (!dashboardAppJs.includes('function saveRiskProfile(event)')) {
    console.error('FAIL: saveRiskProfile handler missing');
    process.exit(1);
}
console.log('  ✓ Account risk guardrail handler present');

const bridgeElements = ['bridgeSetup', 'bridgeProvisionForm', 'bridgeProvider', 'bridgeAccountLabel', 'bridgeAccountReference', 'bridgeKeyResult', 'bridgeKeyValue'];
bridgeElements.forEach(eid => {
    if (!dashHtml.includes(`id="${eid}"`)) {
        console.error(`FAIL: Bridge element ${eid} missing`);
        process.exit(1);
    }
});
if (!dashboardAppJs.includes('function provisionBridge(event)') || !dashboardAppJs.includes('function copyBridgeKey()')) {
    console.error('FAIL: Bridge handlers missing');
    process.exit(1);
}
console.log('  ✓ Read-only bridge controls and handlers present');

const liveElements = ['liveAccountId', 'liveSymbols', 'liveConfirmText', 'liveExecutionState'];
liveElements.forEach(eid => {
    if (!dashHtml.includes(`id="${eid}"`)) {
        console.error(`FAIL: Live execution element ${eid} missing`);
        process.exit(1);
    }
});
if (!dashboardAppJs.includes('function emergencyStopLive()')) {
    console.error('FAIL: Live execution emergency-stop handler missing');
    process.exit(1);
}
console.log('  ✓ Live execution controls include an emergency stop');

// 6. Check Academy tabs and checklist elements
const acadElements = ['acadTab-smc', 'acadTab-engines', 'acadTab-calc', 'acadTab-checklist', 'acadSimBalance', 'acadChecklistStatus'];
acadElements.forEach(eid => {
    if (!dashHtml.includes(`id="${eid}"`)) {
        console.error(`FAIL: Academy element ${eid} missing`);
        process.exit(1);
    }
    console.log(`  ✓ Academy element ${eid} present`);
});

// 7. Panel yang dihapus karena tidak berfungsi / datanya palsu tidak boleh kembali diam-diam.
const dashJs = dashboardAppJs;
if (dashHtml.includes('id="panel-community"') || dashHtml.includes('188 ONLINE') || dashJs.includes("'panel-community'")) {
    console.error('FAIL: panel Community Chat (data palsu: 188 ONLINE, pesan hanya di browser sendiri) muncul kembali');
    process.exit(1);
}
if (dashHtml.includes('id="sentimentGauge"')) {
    console.error('FAIL: kartu Retail Sentiment (tanpa sumber data) muncul kembali');
    process.exit(1);
}
console.log('  ✓ Community Chat & Retail Sentiment tetap dihapus');

console.log('\nPASS — All dashboard panels and DOM hierarchies are valid!');
