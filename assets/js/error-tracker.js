(function() {
  var ENDPOINT = '/api/error-log.php';
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
