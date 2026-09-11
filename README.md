# chrollis.github.io

Personal homepage of **Chrollis**.

Static build: no server, no database. React + Vite + TypeScript on GitHub Pages.
Industrial editorial / Arknights-inspired: dark by default, square corners, black / white
/ yellow / cyan, monospaced instrument labels against a large display face.

The code was written by an LLM from human art direction. Design rationale is in
[docs/DESIGN.md](docs/DESIGN.md); rejected approaches and their measurements are in
[docs/DECISIONS.md](docs/DECISIONS.md).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Requires **Node 24+**.

| Command                  | What it does                                                |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`            | Dev server with HMR                                         |
| `npm run build`          | Typecheck, refresh GitHub data, build, write `404.html`     |
| `npm run build:only`     | Vite build only, no data fetch - works offline              |
| `npm run preview`        | Serve `dist/` on port 4173                                  |
| `npm run typecheck`      | `tsc -b`                                                    |
| `npm run lint`           | ESLint                                                      |
| `npm run data:fetch`     | Refresh `src/generated/github-data.json`                    |
| `npm run icons`          | Regenerate icons and the OG image from `src/data/brand.ts`  |
| `npm run feeds`          | Regenerate `public/feeds/rss.xml` and `sitemap.xml`         |
| `npm run audit:curation` | Print how every repository resolves                         |
| `npm run audit:strings`  | Locale parity and dead-string check                         |
| `npm run test:curation`  | Assert the curation rules                                   |

## Structure

```
.github/workflows/deploy.yml   Build, deploy to Pages, daily data refresh
public/                        Copied verbatim - its layout IS the URL structure
  brand/                       Generated icons and the web manifest
  feeds/                       Generated rss.xml / sitemap.xml (not committed)
scripts/                       Build-time only: icons, feeds, GitHub fetch, audits
src/
  content/posts/               Markdown; every .md file becomes a post
  data/brand.ts                The logo as geometry - source of every icon
  data/locales/                Every user-visible string
  data/site.ts                 Facts only: URLs, handles, flags
  data/projects.ts             Curation rules, resolved from GitHub topics
  lib/                         locale, github, posts, search, seo, theme, glyphs
  components/ sections/ pages/ UI pieces, page regions, routes
  styles/                      Design tokens and component classes
docs/CONVENTIONS.md            Rules that are not visible from the code
docs/DESIGN.md                 Visual language, typography, logo, background, cursor
docs/DECISIONS.md              Tried and rejected, with the measurement that settled it
```

Only three paths under `public/` are fixed: `robots.txt` at the root (the path is the
protocol), plus `404.html` and `.nojekyll`, which postbuild writes. Everything else is
grouped by what fetches it.

## Writing a post

Create `src/content/posts/my-post.md`:

```markdown
---
title: My post
description: Shown in listings, meta tags and the RSS feed.
date: 2026-03-01
category: NOTE
tags: [cpp, tooling]
---

Body in GitHub-flavoured Markdown. Tables, task lists, footnotes and fenced code
blocks with syntax highlighting all work.
```

| field         | required | notes                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `title`       | yes      | Falls back to the filename                                               |
| `description` | no       | Falls back to the first 90 characters of the body                        |
| `date`        | yes      | `YYYY-MM-DD`. Posts sort newest first                                    |
| `category`    | no       | Badge next to the title. Defaults to `NOTE`                              |
| `tags`        | no       | `[a, b]` or a `- a` list. Powers the tag filter and search               |
| `draft`       | no       | `true` hides the post from production, keeps it visible in `npm run dev` |
| `slug`        | no       | Defaults to the filename. Only set it to preserve a URL                  |

`draft: true` is the **only** way to keep a file out - it hides the post from the site
_and_ from the feed and sitemap. There is no filename convention.

Images go in `public/notes/<slug>/` and need a **leading slash** in the Markdown, because
a post renders at `/blog/<slug>`:

```markdown
![A screenshot](/notes/my-post/shot.png)
```

Push to `main` and it publishes. There is no CMS and no runtime fetch.

## Configuration

Everything lives in **`src/data/site.ts`**: name, URLs, handles, email, coordinates,
socials, routes, feature flags.

- **Social links.** Each entry needs `key` (label, from the locale files), `href`,
  `icon` (from `BrandIcons.tsx`) and `code` (decorative counter). A new network needs an
  icon and a label key in both locales - `npm run audit:strings` reports the second.
- **Contact form.** `provider` is `formsubmit` (default: no account, no key), `web3forms`
  (needs `VITE_WEB3FORMS_KEY`) or `none` (hides the form). After the first submission
  FormSubmit sends one confirmation email; until that link is clicked it holds messages.
- **Comments.** Giscus is wired up but `enabled: false`. Enable Discussions, install the
  Giscus app, fill `repoId` and `categoryId` from giscus.app. An empty `repoId` hides the
  box rather than rendering a broken frame.
- **Project grid.** Driven by GitHub topics: `featured` pins, `noindex` drops,
  `glyph-<name>` picks an illustration, `profile` is hidden. Card text is the repository
  description, so rewording a card is a GitHub settings change. Run
  `npm run data:fetch && npm run audit:curation` after tagging.

## Deployment

GitHub Pages as a user site, so `base` is `/`.

**Settings -> Pages -> Source -> GitHub Actions**, then push to `main`. A scheduled
workflow also refreshes the GitHub data daily.

## Licence

**GPL-3.0-only.** See [LICENSE](LICENSE).
