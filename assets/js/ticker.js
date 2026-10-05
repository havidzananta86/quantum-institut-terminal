/**
 * Live Market Ticker Helper
 */
function updateWIBClockElement(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    el.textContent = wib.toTimeString().split(' ')[0];
}
