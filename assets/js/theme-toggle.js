/*
 * Quantum Institut — Theme Toggle
 * 3 themes: navy (default dark), oled-black, oled-white
 * Persists choice in localStorage key 'qi_theme'.
 */
(function() {
  var KEY = 'qi_theme';
  var THEMES = ['oled-black', 'navy'];
  var LABELS = { 'oled-black': 'OLED Black', 'navy': 'Navy' };
  var ICONS  = {
    'oled-black': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    'navy':       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  };
  var root = document.documentElement;

  function apply(theme) {
    if (THEMES.indexOf(theme) === -1) theme = 'oled-black';
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
      el.innerHTML = ICONS[theme] || ICONS['navy'];
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

  // Migrate oled-white users → oled-black (theme removed)
  if (saved === 'oled-white') {
    try { localStorage.setItem(KEY, 'oled-black'); } catch(e) {}
    saved = 'oled-black';
  }
  if (saved && THEMES.indexOf(saved) !== -1) {
    apply(saved);
  } else {
    apply('oled-black');
  }

  // Re-apply icons after DOM is ready (script runs in <head> before body exists)
  document.addEventListener('DOMContentLoaded', function() {
    updateIcons(getCurrent());
  });

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
