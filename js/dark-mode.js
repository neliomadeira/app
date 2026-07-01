// Dark mode toggle — applies data-theme on <html>, persists to localStorage
(function () {
  var THEME_KEY = 'jsc_theme';

  function getStored() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    var btn = document.getElementById('darkModeToggle');
    if (btn) {
      var isDark = theme === 'dark';
      btn.innerHTML    = isDark ? '&#9728;' : '&#9790;';
      btn.title        = isDark ? 'Modo claro' : 'Modo escuro';
      btn.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo escuro');
    }
  }

  // Apply immediately (already done by inline <script> in <head>, but run again for safety)
  applyTheme(getStored());

  function injectButton() {
    if (document.getElementById('darkModeToggle')) { applyTheme(getStored()); return; }
    var navList = document.querySelector('.nav__list');
    if (!navList) return;
    var searchLi = navList.querySelector('.nav__search-btn') &&
                   navList.querySelector('.nav__search-btn').closest('li');
    var li = document.createElement('li');
    li.innerHTML = '<button id="darkModeToggle" aria-label="Activar modo escuro" title="Modo escuro" '
      + 'style="background:none;border:none;cursor:pointer;font-size:1.15rem;padding:2px 6px;'
      + 'color:inherit;display:inline-flex;align-items:center;opacity:0.85;transition:opacity 0.2s">'
      + '&#9790;</button>';
    if (searchLi) {
      navList.insertBefore(li, searchLi);
    } else {
      navList.appendChild(li);
    }
    document.getElementById('darkModeToggle').addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    });
    applyTheme(getStored());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
})();
