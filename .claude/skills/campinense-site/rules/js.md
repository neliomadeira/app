# JavaScript

## Module shape

One file per page or concern, wrapped in an IIFE, `'use strict'`, nothing on `window`.
There are no ES modules, no imports, no bundler — scripts are plain `<script defer>` tags
and share nothing but the DOM and `localStorage`.

```js
// Agenda Pública — Juventude Sport Campinense
(function () {
  'use strict';

  const AGENDA_KEY = 'db_agenda';
  const MESES = ['Janeiro', 'Fevereiro', /* … */];
  const DEFAULTS = [ /* a handful of realistic sample rows */ ];

  // ---- Data ----
  function loadAgenda() { /* localStorage → parse → validate → DEFAULTS */ }

  // ---- Helpers ----
  // ---- Render ----
  // ---- Init ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

Section banners (`// ---- Render ----`) are the navigation aid in files that run to 800
lines. Keep them; they're how you find anything in `main.js`.

`const`/arrow functions in page modules, `var`/`function` in the older shared ones
(`nav.js`, `dark-mode.js`, `sync.js`). Match whichever file you're in rather than
modernising it — these ship unprocessed to whatever browser the visitor has.

## Script order

The order in the HTML is load-bearing, not alphabetical:

```html
<script src="js/security.js" defer></script>      <!-- anti-frame check, must be first -->
<script src="js/sync.js" defer></script>          <!-- fills localStorage before modules read it -->
<script src="js/nav.js?v=20260701" defer></script>
<script src="js/site-config.js" defer></script>   <!-- maintenance redirect, colours, contacts -->
<script src="js/<page>.js" defer></script>        <!-- the page module -->
<script src="/js/pwa.js" defer></script>
<script src="js/cookie-consent.js" defer></script>
<script src="js/scroll-top.js" defer></script>
<script src="js/dark-mode.js" defer></script>
<script src="js/seo.js" defer></script>
```

`sync.js` before the page module is the one that bites: it populates the `db_*` keys the
module is about to read. `site-config.js` before the module matters too — it performs the
maintenance-mode redirect, and a module that renders first wastes work on a page that's
about to navigate away.

## Reading content

Always the same shape, and always with a fallback. A visitor arriving with an empty
localStorage, a blocked fetch or a corrupted value must still get a rendered page.

```js
function loadAgenda() {
  try {
    const raw = localStorage.getItem(AGENDA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* fallback */ }
  return DEFAULTS;
}
```

The `Array.isArray` and `length > 0` checks are not ceremony: the admin can save an empty
array, and rendering it produces a blank page where sample content would be better.

## Escaping

Most rendering is template literals into `innerHTML`. The strings come from the admin
panel — trusted people, but free text — and a `<` in a news title or an apostrophe in a
photo caption breaks the markup. `js/galeria.js` and `js/videos.js` carry the helper:

```js
function _escHtml(str) { /* … */ }
```

**Incorrect:**

```js
grid.innerHTML = photos.map(p => `<img src="${p.url}" alt="${p.titulo}">`).join('');
```

**Correct:**

```js
grid.innerHTML = photos.map(p =>
  `<img src="${_escHtml(p.url)}" alt="${_escHtml(p.titulo || '')}">`
).join('');
```

Copy the helper into any new module that interpolates admin content. Several older
modules don't escape yet — that's a gap to close when you touch them, not a pattern to
copy.

## Cache busting

Modules referenced with a version string (`js/nav.js?v=20260701`) are edited across every
HTML file at once. If you change such a file, bump the string everywhere it appears —
otherwise the service worker and the browser both keep serving the old copy and the fix
appears not to have deployed.

Files without a `?v=` are precached by `sw.js` instead; changing those means bumping
`CACHE_NAME`. Both mechanisms exist; check which one applies to the file you edited.

## Sharp edges

**`security.js` disables pointer events on images.** After `DOMContentLoaded` it sets
`draggable=false`, `user-select: none` and `pointer-events: none` on every `<img>`. A
click handler bound to an image will never fire. Bind to a wrapper:

```js
grid.querySelectorAll('.galeria-item').forEach(el => {
  el.addEventListener('click', () => openLightbox(Number(el.dataset.idx)));
});
```

It also blocks the context menu, F12, Ctrl+U/S/P and printing, and calls `console.clear()`
half a second after load. That last one will erase your own `console.log` output while
debugging — comment the script out locally rather than wondering where the logs went.

**`sync.js` can reload the page.** When the server blob differs from localStorage it
writes the new values and calls `location.reload()` once, guarded by the
`jsc_sync_reloaded` sessionStorage flag. A module that writes to a synced `db_*` key
during render risks fighting that comparison — write only user-local state
(`jsc_theme`, consent, UI preferences) from the public site.

**The CSP blocks unlisted hosts.** A new external script needs its host added to
`script-src` in the root `.htaccess`. The refusal is a console entry and nothing else —
and `security.js` wipes the console half a second in, so the symptom you actually see is
a feature that quietly does nothing.
