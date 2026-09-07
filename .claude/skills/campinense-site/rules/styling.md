# Styling

`css/styles.css` is the whole site (4300+ lines). Three page-specific sheets sit beside
it — `resultados.css`, `galeria.css`, `inscricao.css` — loaded only by their pages. New
styling goes in `styles.css` unless it's clearly one page's alone and substantial.

## Tokens

Defined once in `:root` at the top of `styles.css`:

```css
--yellow  #FFD100   --yellow-dark  #E6B800   --yellow-light  #FFE033
--blue    #003B8E   --blue-dark    #002A6B   --blue-mid #1a4fa8   --blue-bg #001f4d
--gray-dark #0e1c35 --gray #1c2f50 --gray-mid #666 --gray-light #f5f7fa --white #fff
--font-display 'Bebas Neue'   --font-body 'Roboto'
--radius 8px   --radius-lg 16px   --shadow   --shadow-lg   --transition 0.25s ease
```

**Always go through the token.** `js/site-config.js` lets the admin pick club colours and
overwrites `--blue`, `--yellow` and their derived shades on `document.documentElement` at
runtime. A literal hex is invisible to that and produces a component stuck on the old
palette while everything around it changes.

**Incorrect:**

```css
.sponsor-card__title { color: #003B8E; border-bottom: 2px solid #FFD100; }
```

**Correct:**

```css
.sponsor-card__title { color: var(--blue); border-bottom: 2px solid var(--yellow); }
```

`rgba()` for translucent overlays is fine and used throughout — there's no token for it.

## BEM

`.block__element--modifier`, lowercase, hyphenated. Existing families:
`header__inner`, `logo__img--small`, `nav__submenu`, `nav__sublink--active`,
`page-hero__title`, `news-card__excerpt`, `footer__social-link--wa`, `btn--primary`.

Modifiers stack on the base class, they don't replace it:

```html
<a class="btn btn--nav">Inscrever</a>          <!-- correct -->
<a class="btn--nav">Inscrever</a>              <!-- wrong: loses all .btn styling -->
```

## Dark mode

A `data-theme="dark"` attribute on `<html>`, set by the inline head script and toggled by
`js/dark-mode.js` (which injects its own button into `.nav__list` — don't add one to the
markup). Overrides live in one block near the bottom of `styles.css` under the
`DARK MODE` banner (~line 4188), plus a scattering of earlier component-local ones.

Any new component with its own background, border or text colour needs an override, or it
stays light-on-light in dark mode:

```css
.stat-card { background: var(--white); color: #111; border: 1px solid #e2e8f0; }

html[data-theme="dark"] .stat-card {
  background: #16233d;
  color: #e2e8f0;
  border-color: #24365c;
}
```

The dark palette is written as literal slate hexes (`#0f172a`, `#16233d`, `#e2e8f0`,
`#94a3b8`) rather than tokens — that's the established convention, follow it. The club
colours stay as tokens in dark mode so the admin override still applies.

Components with no colour of their own (layout, spacing, flex) need no override.

## Layout

- `.container` — `max-width: 1200px`, centred, `padding: 0 24px`. Wrap page content in it.
- Flexbox and CSS grid throughout. No float layouts, no grid framework, no column classes.
- The header is `position: fixed` with a 3px yellow bottom border; interior pages clear it
  with the `page-hero` band rather than a body offset.

## Responsive

Breakpoints in use, most common first: **768px**, **640px**, **600px**, **480px**,
**900px**, with occasional 1024/820/580/560/520. Prefer an existing breakpoint over a new
one — a new value means one more place where a future change has to be repeated.

All `max-width` (desktop-first). The hamburger takes over the nav on narrow screens; test
that any new nav item is reachable inside the open mobile menu, not just the desktop bar.

## Inline styles

Used deliberately in a few places — page padding on `<main>`, a one-off accent colour, the
dark-mode button's own styles. That's acceptable for layout that exists once.

It's the wrong tool whenever the value needs a dark-mode variant, because an inline style
can't be overridden by `html[data-theme="dark"]` without `!important`. If you find
yourself writing `style="background:#fff"`, make it a class.

## What isn't here

No Tailwind, no Bootstrap, no CSS-in-JS, no PostCSS, no Sass. There's no build step to
process any of it, and the CSP in `.htaccess` blocks stylesheets from hosts other than
Google Fonts. If a task seems to call for utility classes, write the CSS.
