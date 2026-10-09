/*
 * Quantum Institut — Theme Toggle
 * Manages data-theme attribute on <html> and Tailwind 'dark' class.
 * Persists choice in localStorage. Respects prefers-color-scheme by default.
 */
(function() {
  var KEY = 'qi_theme';
  var root = document.documentElement;

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
    }
    updateIcons(theme);
  }

  function updateIcons(theme) {
    document.querySelectorAll('[data-theme-icon]').forEach(function(el) {
      el.textContent = theme === 'dark' ? '☀' : '☾';
    });
    document.querySelectorAll('[data-theme-label]').forEach(function(el) {
      el.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
  }

  function getCurrent() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return getSystemTheme();
  }

  // Initialize on load
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e) {}

  if (saved === 'dark' || saved === 'light') {
    apply(saved);
  } else {
    apply(getSystemTheme());
  }

  // Listen for system theme changes (when no manual override)
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      var s = null;
      try { s = localStorage.getItem(KEY); } catch(ex) {}
      if (!s) apply(e.matches ? 'dark' : 'light');
    });
  } catch(e) {}

  // Global toggle function
  window.toggleQITheme = function() {
    var next = getCurrent() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch(e) {}
    apply(next);
  };
})();
