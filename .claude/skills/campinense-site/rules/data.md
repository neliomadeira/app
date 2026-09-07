# Content & data

## How content reaches a visitor

```
Admin panel (admin/index.html)
   ↓  edits are held in the admin's own localStorage
   ↓  "Publicar" POSTs the whole blob
api/save.php   ── X-JSC-Token header ──→   data/db.json
   ↓
api/load.php   (public, no-store)
   ↓  js/sync.js fetches it on first page view of the session
localStorage   db_agenda, jsc_noticias, site_config, …
   ↓
js/<page>.js   reads the key, falls back to DEFAULTS, renders
```

Two consequences worth holding onto:

- **The public site never reads `data/db.json` directly.** `data/.htaccess` is
  `deny from all`, and the root `.htaccess` blocks `*.json` besides. `api/load.php` is
  the only door. A module that fetches the file gets a 403.
- **`sync.js` runs once per session** (`jsc_sync_done` in sessionStorage). Content edited
  in the admin doesn't appear in an already-open tab until a new session — which is why
  `sync.js` calls `location.reload()` once when it detects a change.

## localStorage keys

Set by `js/sync.js` from the server blob. The naming is inconsistent for historical
reasons; use the exact key.

| Key | Content |
| --- | --- |
| `jsc_noticias` | News articles (note: not `db_`-prefixed) |
| `db_agenda` | Calendar events |
| `db_galeria` / `db_videos` | Photo albums / videos |
| `db_atletas` / `db_escaloes` / `db_treinadores` | Squads, age groups, coaches |
| `db_jogos` / `db_seniores` / `db_seniores_info` | Fixtures, senior team |
| `db_historia` / `db_palmares` | Club history timeline, honours |
| `db_patrocinadores` | Sponsors |
| `db_modalidades` / `db_mod_posts` | Sports sections and their posts |
| `db_logos` | Opponent club crests |
| `site_config` | Contacts, social links, general text |
| `site_cores` | Admin colour overrides (`--blue`, `--yellow`) |
| `site_popup` / `site_banner` / `site_aviso` | Promotional slots |
| `site_legal` / `dados_clube` / `email_config` | Legal text, club details, EmailJS |
| `fb_posts` | Cached Facebook feed |
| `fpf_sync_config`, `fpf_class_*`, `fpf_jogos_*` | League tables and fixtures from the scraper |

Keys written by the visitor's own browser, never synced: `jsc_theme`,
`jsc_sync_done`, `jsc_sync_reloaded`, cookie consent, UI preferences.

## Adding a new content type

This is the step most often missed, and the failure is silent: the admin saves happily,
the server stores the field, and no visitor ever sees it.

1. **Admin** — add the editor UI and include the field in the published blob
   (`admin/js/admin.js`, `admin/js/data.js`).
2. **`js/sync.js`** — add the mapping line. Without it the field never leaves the blob:

   ```js
   if (data.novoTipo) ls('db_novo_tipo', data.novoTipo);
   ```

3. **Page module** — read the key with the standard `DEFAULTS` fallback.
4. **`api/save.php` needs no change** — it stores whatever JSON it's given.

## The API

Four small PHP files, no framework, no router.

| File | Purpose |
| --- | --- |
| `load.php` | `readfile(DATA_FILE)` or `{}`. Public, `no-store`. |
| `save.php` | POST only, `X-JSC-Token` must equal `JSC_TOKEN`, validates JSON, whole-blob overwrite. |
| `submit.php` | Public. Accepts `{tipo: 'inscricao'\|'contacto', dados: {…}}`, 64KB cap, honeypot, writes to MySQL if configured. |
| `registos.php` | Admin-side reads of those submissions, same token header. |
| `db.php` / `schema.sql` | PDO connection helper and table definitions. |

`config.php` holds `JSC_TOKEN` (ships as `campinense2025`) and optional MySQL credentials.
With `DB_NAME` empty the site still works — submissions fall back to EmailJS and
localStorage, and `submit.php` returns `{"ok":false,"error":"bd nao configurada"}`, which
callers must treat as "not stored", not as a crash.

Treat the token as a live credential: don't copy it into new files, documentation, commit
messages or client-side code. Rotating it means editing `config.php` on the server and the
admin panel's stored token together.

### Forms

`submit.php` expects a honeypot field named `hp_website` — hidden in the form, empty for
humans. When it's filled the endpoint returns success without storing anything, so bots
get no signal. Any new public form should carry the same field and post the same shape.

## The CSP

The root `.htaccess` sets a strict `Content-Security-Policy`. Currently allowed beyond
`'self'`: jsDelivr and EmailJS (scripts), Google Fonts (styles/fonts), YouTube and
OpenStreetMap (frames), and a set of CORS proxies plus the Facebook Graph API (connect).

A new external host — a script, a font, an API you fetch — must be added to the matching
directive or the browser blocks it with only a console entry. That console entry is then
wiped by `security.js`'s `console.clear()`, so the symptom is usually "the feature just
doesn't work". Check the CSP first.

## The scraper

`scraper/` is a standalone Node script that pulls AF Algarve league tables and fixtures
and produces the `fpf_*` payloads. It has its own `package.json` and is the only npm
surface in the repo — it runs on a developer's machine, not on the club's hosting, and its
output goes through the admin like any other content. Don't let its dependencies leak into
the site.
