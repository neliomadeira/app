---
name: campinense-site
description: Conventions for the Juventude Sport Campinense website — a hand-written static HTML/CSS/JS site with no build step, a localStorage-backed content layer fed by the admin panel, and a small PHP API. Use this whenever working anywhere in this repo: adding or editing a page, writing CSS, adding a JS module, touching the admin panel, changing content that comes from the admin, or debugging why published content isn't showing up. Also use it before reaching for React, Tailwind, npm, or a bundler — none of them belong here, and this skill explains what to do instead.
---

# Juventude Sport Campinense — site conventions

A static site for a football club in Loulé, Algarve. Plain HTML, CSS and ES5-flavoured
JavaScript served straight from disk; a small PHP API on shared hosting; an admin
single-page app that publishes content as one JSON blob.

**There is no build step and no root `package.json`.** Every file you edit is the file
that ships. Nothing compiles, nothing bundles, nothing tree-shakes. If a change requires
a build, it doesn't belong in this repo — the club's hosting runs Apache and PHP, and the
site has to keep working when someone edits a file over FTP.

Site language is **Portuguese (pt-PT)**. All user-facing copy, all admin labels, and
most code comments are Portuguese. Match that — an English button in the middle of the
nav is immediately visible to every visitor.

## Layout

```
*.html          One file per page, each carrying its own <head>, header, nav and footer
css/styles.css  4300+ lines, the whole site; three page-specific sheets alongside it
js/*.js         One IIFE module per page, plus shared modules (nav, sync, security…)
admin/          The admin SPA: index.html (97k), js/admin.js, js/data.js
api/*.php       load/save the content blob, accept form submissions
data/           db.json lives here at runtime, written by the server (deny from all)
scraper/        Standalone Node script for AF Algarve fixtures — the one place npm exists
sw.js           Service worker; PRECACHE list + CACHE_NAME
```

## Principles

1. **Copy an existing page, don't invent one.** Pages share a large `<head>` block, an
   identical header/nav, and an identical footer. `agenda.html` is the cleanest template.
2. **Content comes from localStorage, not from HTML.** Anything the club edits lives in
   the admin and arrives via `js/sync.js`. Hardcoding it in the markup means the admin
   panel silently stops working for that section.
3. **Every module degrades to `DEFAULTS`.** A visitor with an empty localStorage, a
   failed fetch, or a first visit still sees a populated page.
4. **Use the CSS custom properties.** The admin can recolour the whole site at runtime by
   overriding `--blue` and `--yellow`; a hardcoded `#003B8E` won't follow.

## Critical rules

Each links to a file with incorrect/correct pairs.

### Pages & markup → [rules/pages.md](./rules/pages.md)

- **New pages need five registrations, not one.** The file itself, the nav in *every*
  other page, `sitemap.xml`, `sw.js` PRECACHE, and the footer links where relevant.
  Miss `sw.js` and returning visitors get a stale or offline page.
- **Keep the `<head>` block intact.** The inline theme script must stay first — it sets
  `data-theme` before first paint, and moving it below the stylesheet causes a white
  flash for dark-mode users.
- **Every page starts with the skip link and `id="main-content"`** on the first section.
- **Nav icons are HTML entities** (`&#9917;`), not emoji characters — the source files
  are edited over FTP by tools with unreliable encoding.

### Styling → [rules/styling.md](./rules/styling.md)

- **BEM naming: `.block__element--modifier`.** `.news-card__title`, `.page-hero--dark`.
- **Colours come from custom properties.** `var(--blue)`, never `#003B8E`.
- **Dark mode is `html[data-theme="dark"]` overrides**, written near the bottom of
  `styles.css`. Any new component with its own background or text colour needs one.
- **No Tailwind, no CSS framework, no utility classes.** There's no build step to
  generate them.
- **Inline `style` is used for one-off layout only** (page padding, a single accent) —
  never for anything that needs a dark-mode variant.

### JavaScript → [rules/js.md](./rules/js.md)

- **One IIFE per module, `'use strict'`, no globals, no imports.** Scripts are plain
  `<script defer>` tags — there are no ES modules and nothing resolves bare specifiers.
- **Script order in the page is load-bearing.** `security.js` → `sync.js` → `nav.js` →
  `site-config.js` → page module → `pwa.js` → `cookie-consent.js` → `scroll-top.js` →
  `dark-mode.js` → `seo.js`.
- **Escape anything from localStorage before it reaches `innerHTML`.** The content is
  admin-authored, not anonymous, but the admin panel accepts free text and an unescaped
  `<` in a news title breaks the page. `js/galeria.js` has the `_escHtml` helper worth
  copying.
- **Bump `?v=` when you change a cached module** — `js/nav.js?v=20260701`.

### Content & data → [rules/data.md](./rules/data.md)

- **Reading content: `localStorage` key → `JSON.parse` → validate → fall back to
  `DEFAULTS`.** Never fetch `data/db.json` directly; it's `deny from all`.
- **New content types need a line in `js/sync.js`.** Without it the admin saves the field
  to the server and no visitor ever sees it — the single most common bug in this repo.
- **The admin publishes the whole blob at once** to `api/save.php` with an `X-JSC-Token`
  header. It is not a REST API and there are no partial updates.
- **External hosts must be added to the CSP** in the root `.htaccess`, or the browser
  blocks the request with no visible error.

## Key patterns

```js
// Module shape: IIFE, strict, a storage key, and defaults that keep the page alive.
(function () {
  'use strict';
  const AGENDA_KEY = 'db_agenda';
  const DEFAULTS = [ /* representative sample content */ ];

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
})();
```

```css
/* Colours through tokens, so the admin's runtime override reaches them. */
.card__title { color: var(--blue); }        /* correct */
.card__title { color: #003B8E; }            /* wrong — admin recolour won't apply */

/* Every coloured component needs its dark counterpart. */
html[data-theme="dark"] .card { background: #16233d; border-color: #24365c; }
```

```html
<!-- Skeletons are markup, not JS: they render before the module runs. -->
<div id="agendaList" class="agenda-pub-list">
  <div class="agenda-card--skel" aria-hidden="true">
    <div class="skel-date skeleton"></div>
  </div>
</div>
```

## Where things live

| Need                        | Go to                                                        |
| --------------------------- | ------------------------------------------------------------ |
| Page template               | `agenda.html` (clean), `formacao.html` (tabs + cards)         |
| Design tokens               | `:root` at the top of `css/styles.css`                        |
| Dark mode overrides         | `css/styles.css` from the `DARK MODE` banner (~line 4188)     |
| Nav, hamburger, active link | `js/nav.js`                                                   |
| Server → localStorage sync  | `js/sync.js`                                                  |
| Admin-driven text/links     | `js/site-config.js`                                           |
| Homepage behaviour          | `js/main.js` (stat counters, hero slideshow, contact form)    |
| Escaping helper             | `js/galeria.js` / `js/videos.js` (`_escHtml`)                 |
| Publish/token flow          | `admin/js/admin.js` (~line 4878) and `api/save.php`           |
| Form submissions            | `api/submit.php` (honeypot `hp_website`, MySQL optional)      |
| Security headers + CSP      | root `.htaccess`                                              |
| Fixture scraping            | `scraper/fpf-scraper.js` (own `package.json`, runs offline)   |

## Workflow

1. **Find the page or module you're changing** and read it whole. Files are long but
   self-contained; there's no framework indirection to trace.
2. **Look for an existing pattern before writing new markup.** Cards, filter pills,
   skeletons, hero sections and empty states all already exist with class names in
   `styles.css`. Search the CSS before inventing a class.
3. **Trace content back to its source.** If text appears on the page, decide whether it's
   static markup, `site-config.js`, or a `db_*` localStorage key — editing the wrong one
   produces a change that the next admin publish overwrites.
4. **Make the change,** matching the surrounding style: `var`/`const` as the file already
   uses, Portuguese comments, the same brace and spacing style.
5. **Register it everywhere.** New page → nav in every HTML file, `sitemap.xml`, `sw.js`.
   New content type → `js/sync.js`, admin panel, and the page module. New external host →
   CSP in `.htaccess`.
6. **Bump the cache.** Change a precached asset → bump `CACHE_NAME` in `sw.js`. Change a
   module referenced with `?v=` → bump that too. Skipping this is why "the fix didn't
   deploy" — the service worker is still serving the old file.
7. **Check dark mode and mobile.** Both are easy to forget and both are visibly broken
   when missed. The nav collapses at the hamburger breakpoint; dark mode is a class
   toggle you can flip in devtools.

## Known sharp edges

- **`js/security.js` sets `pointer-events: none` on every `<img>`** after DOMContentLoaded
  (an anti-copy measure). Click handlers must be bound to a wrapper element, never to the
  image — `js/galeria.js` binds to `.galeria-item` for exactly this reason.
- **`js/sync.js` reloads the page once** when the server blob differs from localStorage.
  A module that writes to a synced `db_*` key during render can trigger that reload loop.
- **`api/config.php` ships with a default token** (`campinense2025`) and empty DB
  credentials. It's the live publish credential — don't echo it into new files, docs, or
  commit messages, and treat rotating it as a deploy step, not a code change.
- **`data/` and every `.json` are blocked by `.htaccess`**, with `manifest.json`
  explicitly re-allowed. A new JSON file the site fetches at runtime needs the same
  exception or it 403s and, if precached, breaks the service worker install.
- **Script tags are duplicated across ~20 HTML files.** A change to the shared set is a
  find-and-replace across all of them; missing one produces a page that half-works.

## Detailed references

- [rules/pages.md](./rules/pages.md) — page skeleton, the `<head>` block, adding a page
- [rules/styling.md](./rules/styling.md) — tokens, BEM, dark mode, responsive breakpoints
- [rules/js.md](./rules/js.md) — module shape, script order, escaping, cache busting
- [rules/data.md](./rules/data.md) — localStorage keys, sync, admin publish, PHP API
