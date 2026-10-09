(function() {
  var KEY = 'qi_cookie_consent';
  try { if (localStorage.getItem(KEY)) return; } catch(e) { return; }

  var bar = document.createElement('div');
  bar.id = 'qiCookieBar';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookie consent');
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:14px 20px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;font-family:Inter,system-ui,sans-serif;font-size:13px;color:#E2E8F0;background:rgba(11,18,32,0.97);border-top:1px solid rgba(30,58,138,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transform:translateY(100%);transition:transform 0.3s ease';

  bar.innerHTML =
    '<span style="flex:1;min-width:200px;line-height:1.5">Kami menggunakan cookie untuk pengalaman terbaik. Baca <a href="/privacy" style="color:#60A5FA;text-decoration:underline">Kebijakan Privasi</a>.</span>' +
    '<button id="qiCookieAccept" style="padding:7px 20px;border-radius:6px;border:none;background:#3B82F6;color:#fff;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit">Terima</button>' +
    '<button id="qiCookieDecline" style="padding:7px 20px;border-radius:6px;border:1px solid #334155;background:transparent;color:#94A3B8;font-weight:500;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit">Tolak</button>';

  document.body.appendChild(bar);
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { bar.style.transform = 'translateY(0)'; });
  });

  function dismiss(accepted) {
    try { localStorage.setItem(KEY, accepted ? 'accepted' : 'declined'); } catch(e) {}
    bar.style.transform = 'translateY(100%)';
    setTimeout(function() { bar.remove(); }, 350);
  }

  document.getElementById('qiCookieAccept').onclick = function() { dismiss(true); };
  document.getElementById('qiCookieDecline').onclick = function() { dismiss(false); };
})();
