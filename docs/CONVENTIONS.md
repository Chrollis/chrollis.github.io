# Conventions

Rules that are not visible from the code. Each one is here because it once caused a bug.
[DESIGN.md](./DESIGN.md) has the reasoning, [DECISIONS.md](./DECISIONS.md) the history.

---

## Project grid

A repository is **hidden** when any of these is true:

| condition                   | why                                                          |
| --------------------------- | ------------------------------------------------------------ |
| topic `noindex`             | explicit request                                             |
| topic `profile`             | a profile README is about the account, not a project         |
| name is `<owner>.github.io` | the site's own source - derived from the account, not tagged |

Illustrations are assigned in four tiers, best first:

1. topic `glyph-<name>` - explicit, and may legitimately repeat
2. language map - Rust, Python and Zig only
3. keyword match against name + description + topics
4. deterministic hash of whatever is left

Only **visible** repositories reserve a glyph, and explicit topics are reserved before
any ranking runs. Both are bug fixes: a hidden repository holding a glyph forced a
duplicate among the visible cards. Candidates resolve in **name order**, not API order,
so a commit cannot rearrange the grid.

Keyword table, most specific first, first hit wins:

- `terminal` **before** `wave` - "library" and "lyric" matched text projects.
- No bare `lab` - it matched all three `scu-*-lab` repositories at once.
- No `coursework` - it says nothing about what a project is.
- Matching is a plain **substring** test on purpose; word boundaries miss
  `handwritten-digit-recognition`.

Run `npm run audit:curation` after tagging anything.

## Language

What gets translated is decided by **type, not role**. Prose - body copy, page intros, an
empty or error explanation, the identity text - is translated. Anything set as micro-type
stays English: labels, filters, counters, stat labels, readouts, serials, page eyebrows,
brand and technology names. It is 9-11px tracked uppercase notation, part of the instrument
look rather than reading matter.

**Placeholders stay English too**, and they have their own reason: they are examples and
invitations rather than reading matter (the same class as the label directly above them),
and they are the one string a locale flip cannot animate. `Scramble` writes a text node;
a placeholder is an attribute. A translated placeholder therefore snapped to the new
language in the middle of a page turning over character by character - the only string on
the site that did - and a hint that changes language is worth less than a hint that does
not. So `en.ts` is their only home and `zh.ts` deliberately carries no override for them.

Two cases that look like exceptions and are not:

- **Invisible names with no visible twin are translated**: `nav.primary` / `nav.drawer` /
  `nav.footer` (landmarks) and `locale.switchTo` (the toggle shows only `EN` / `中`). The
  rest of the aria names stay English, like the visible chrome they sit next to.
- **`projects.empty` stays English but `blog.emptyHint` is translated.** Both are empty
  states; the first is a micro-type label, the second is a sentence.

`projects.noDescription` is a third case: it sits in body text but stays English, because it
stands in for a repository description that arrives from GitHub in English.

- `projects.subtitle` is `'PROJECTS'` in both locales, above an `<h1>` reading `Projects`.
  Page names are not translated, so the two are the same word in different treatments -
  a decorative pair, not a label above a translated title.
- `:lang(zh)` must **never** reset `letter-spacing` document-wide. Opt prose in per
  paragraph with `.ak-cjk` instead. Markdown bodies (`.ak-prose`) are **not** opted in:
  their language is independent of the UI language, so listing them made every English
  README and note change spacing when the toggle was flipped.

## Source encoding

- `src/data/locales/en.ts` must stay **pure ASCII**. Use `-`, not an em dash.
- Typographic marks come from `src/lib/glyphs.ts` as `\uXXXX` escapes. JSX does not
  decode named HTML entities, so `&nearr;` renders the literal string on the page.
- Write files with the editor tools, **never** with PowerShell text commands -
  `Set-Content` can glue lines when a replacement removes a trailing newline.

## CSS and Tailwind

- **Never use `text-[clamp(...)]`** or any invented utility; Tailwind emits nothing for
  them and the class is silently absent. Load-bearing values go in named classes in
  `src/styles/index.css`.
- **Never add `button { border: 0 }`** to a base layer - the shorthand sets
  `border-style: none`, which collapses every `.border` utility on a button to zero.
- **Every region that varies between cards needs an explicit height**, including a label
  above a value inside a grid cell, or rows stop lining up.
- **`minmax(0, ...)` on every grid track, `min-width: 0` at every level.** A bare `1fr`
  has an `auto` minimum, which is the content's min-content width.
- **Never put `overflow` on `html`.** Root overflow only propagates from `body` while
  `html` is `visible`; anything else silently breaks every scroll lock in the app.
- `border-radius: 0 !important` on `*` is the design, not an oversight.

## Files

`public/` is copied verbatim, so **its layout is the URL structure**. Moving a file
changes a live URL. Only `robots.txt`, `404.html` and `.nojekyll` have fixed homes; the
rest is grouped by what fetches it (`brand/`, `feeds/`). A generated file belongs there
only if something fetches it by URL - intermediates go to `.cache/`.

Posts:

- `src/content/posts/*.md`, **one level deep, no subfolders**.
- **`draft: true` is the only way to keep a file out** of the site, the feed and the
  sitemap. There is no filename convention.
- Images go in `public/notes/<slug>/` and need a **leading slash**.
- `src/assets/` does not exist and cannot be used: post bodies are read as raw strings
  through `import.meta.glob`, so an `import` inside Markdown renders as literal text.

Configuration:

- `src/data/site.ts` holds **facts** (URLs, handles, flags); `src/data/locales/*.ts` holds
  **language**. A value identical in every language is a fact. `site.ts` contains no
  English sentence other than proper nouns.
- `site.email` stays a **`{ user, domain }` pair**, joined only by `fullEmail()`. A
  literal address in the bundle is exactly what a scraper's regex looks for.

## Contact form

- The address is a **SimpleLogin alias**, shown plainly. Replace the alias if it is
  abused - never a personal mailbox.
- FormSubmit's **reCAPTCHA** stays on, and the **`_honey` honeypot** field stays in
  `ContactForm.tsx`. Both are real protection; obscurity is not.
- Web3Forms is the alternative for real traffic; its key lives in a repository secret.
- **Turnstile cannot be used here.** Cloudflare requires the token to be validated
  server-side with the secret key, and a static site has no server.

## Copy

- **Every user-visible string lives in `src/data/locales/`.** `en.ts` is the reference and
  holds them all; `zh.ts` overrides the ones that are translated. A sentence, a label or an
  aria-name written in a component is a bug.
- **`index.html` contains no copy.** `%SITE_NAME%`, `%SITE_DESCRIPTION%`, `%SITE_URL%` and
  `%SITE_GITHUB%` are filled by the `html-copy` plugin in `vite.config.ts` from `site.ts`
  and the English locale, in dev and build alike. Edit those, never the HTML.
- The home `<title>` is `site.name`; every other route appends `" | " + site.name` in
  `seo.ts`. Route descriptions are `meta.*`, and `meta.blog` takes a `{count}` placeholder.
- `content.role` is the only line stating what the author is doing. `content.description`
  is the footer blurb, not a meta description. `cover.phrases` is the typewriter wordmark
  and has no locale override.

## Deliberately not done

- **README relative links are not clickable.** A README is written against its own
  repository, so `[LICENSE](LICENSE)` would resolve to this site.
- **No CMS and no runtime repository fetch.** Repository data is baked in at build time;
  only READMEs are fetched in the browser, on demand.
- **The OS colour-scheme preference is ignored.** Dark is the default for everyone; light
  is only reachable through the header toggle. Language does consult the browser -
  appearance is taste, readability is not.
