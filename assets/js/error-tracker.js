(function() {
  // Relative on purpose. A leading slash resolves against the domain root,
  // so under a subdirectory deployment (XAMPP's localhost/webapp/, a staging
  // path) every report would POST to a 404 and vanish — and this is the one
  // thing that must not fail quietly, since it is how front-end errors get
  // noticed at all. Every other API call in the codebase is relative too.
  var ENDPOINT = 'api/error-log.php';
  var sent = 0;
  var MAX = 10;

  function report(msg, source, line, col, err) {
    if (sent >= MAX) return;
    sent++;
    var payload = {
      message: String(msg || '').slice(0, 500),
      source: String(source || '').slice(0, 200),
      line: line || 0,
      col: col || 0,
      stack: (err && err.stack) ? err.stack.slice(0, 1000) : '',
      url: location.pathname
    };
    try {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
    } catch(e) {
      var x = new XMLHttpRequest();
      x.open('POST', ENDPOINT);
      x.setRequestHeader('Content-Type', 'application/json');
      x.send(JSON.stringify(payload));
    }
  }

  window.onerror = function(msg, source, line, col, err) {
    report(msg, source, line, col, err);
  };

  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason;
    report(
      reason && reason.message ? reason.message : String(reason),
      '', 0, 0,
      reason instanceof Error ? reason : null
    );
  });
})();
