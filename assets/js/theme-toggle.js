/*
 * Quantum Institut — Theme Toggle
 * 3 themes: navy (default dark), oled-black, oled-white
 * Persists choice in localStorage key 'qi_theme'.
 */
(function() {
  var KEY = 'qi_theme';
  var THEMES = ['navy', 'oled-black', 'oled-white'];
  var LABELS = { 'navy': 'Navy', 'oled-black': 'OLED Black', 'oled-white': 'OLED White' };
  var ICONS  = { 'navy': '🌊', 'oled-black': '🖤', 'oled-white': '☀' };
  var root = document.documentElement;

  function apply(theme) {
    if (THEMES.indexOf(theme) === -1) theme = 'navy';
    root.setAttribute('data-theme', theme);
    if (theme === 'oled-white') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    updateIcons(theme);
    // Notify chart/widgets of theme change
    try { window.dispatchEvent(new CustomEvent('qi-theme-change', { detail: { theme: theme } })); } catch(e) {}
  }

  function updateIcons(theme) {
    document.querySelectorAll('[data-theme-icon]').forEach(function(el) {
      el.textContent = ICONS[theme] || '🌊';
    });
    document.querySelectorAll('[data-theme-label]').forEach(function(el) {
      el.textContent = LABELS[theme] || 'Navy';
    });
  }

  function getCurrent() {
    var attr = root.getAttribute('data-theme');
    if (THEMES.indexOf(attr) !== -1) return attr;
    return 'navy';
  }

  // Initialize on load
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e) {}

  if (saved && THEMES.indexOf(saved) !== -1) {
    apply(saved);
  } else {
    apply('navy');
  }

  // Global cycle function — cycles: navy → oled-black → oled-white → navy
  window.toggleQITheme = function() {
    var cur = getCurrent();
    var idx = THEMES.indexOf(cur);
    var next = THEMES[(idx + 1) % THEMES.length];
    try { localStorage.setItem(KEY, next); } catch(e) {}
    apply(next);
  };

  // Set a specific theme directly
  window.setQITheme = function(theme) {
    if (THEMES.indexOf(theme) === -1) return;
    try { localStorage.setItem(KEY, theme); } catch(e) {}
    apply(theme);
  };

  // Get current theme
  window.getQITheme = function() {
    return getCurrent();
  };

  // Check if current theme is light
  window.isQIThemeLight = function() {
    return getCurrent() === 'oled-white';
  };
})();
