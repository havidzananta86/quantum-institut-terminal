/*
 * Quantum Institut — Theme Toggle
 * 3 themes: navy (default dark), oled-black, oled-white
 * Persists choice in localStorage key 'qi_theme'.
 */
(function() {
  var KEY = 'qi_theme';
  var THEMES = ['navy', 'oled-black', 'oled-white'];
  var LABELS = { 'navy': 'Navy', 'oled-black': 'OLED Black', 'oled-white': 'OLED White' };
  var ICONS  = {
    'navy':       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    'oled-black': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    'oled-white': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
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

  // Migrate users who had 'navy' saved → oled-black
  if (saved === 'navy') {
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
