/*
 * Sitemap and RSS generation (`npm run feeds`, also run before `dev` and `build`).
 *
 * They live in `public/feeds/` rather than `dist/` because Vite copies `public/` into
 * `dist/` but also serves it in dev. Written into `dist/`, they existed only after a
 * production build and the dev server answered with the SPA fallback, so the footer's RSS
 * link looked broken while developing. Grouping them keeps the document root clear of
 * files only crawlers want.
 *
 * The parser is the real one from `src/lib/frontmatter.ts` (Node 24 runs TypeScript).
 * `postbuild.mjs` used to carry a copy that claimed to mirror it, and did not: no block
 * sequences, no trailing-comment stripping, no boolean coercion - so a post could be read
 * one way here and another way when rendered.
 *
 * The output is not committed: RSS carries a `<lastBuildDate>`, so every build would
 * produce a diff.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { en } from '../src/data/locales/en.ts'
import { site } from '../src/data/site.ts'
import { parseFrontmatter } from '../src/lib/frontmatter.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const feedsDir = join(publicDir, 'feeds')
const postsDir = join(root, 'src', 'content', 'posts')

/* The feed is English-only, so its prose comes from the English locale - `site.ts` holds
   facts only and deliberately has no sentences. */
const FEED_LANGUAGE = 'en'
const FEED_DESCRIPTION = en.content.description

/*
 * Search-engine hints, keyed by route. The route list comes from `site.nav`, so adding a
 * page adds it to the sitemap; only the hints need stating, and an unlisted route gets the
 * default rather than being dropped.
 */
const ROUTE_HINTS = {
  '/': { changefreq: 'weekly', priority: '1.0' },
  '/projects': { changefreq: 'monthly', priority: '0.8' },
  '/about': { changefreq: 'monthly', priority: '0.7' },
  '/blog': { changefreq: 'weekly', priority: '0.8' },
  '/contact': { changefreq: 'yearly', priority: '0.6' },
}
const DEFAULT_HINT = { changefreq: 'monthly', priority: '0.5' }

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

const posts = existsSync(postsDir)
  ? readdirSync(postsDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const { data } = parseFrontmatter(readFileSync(join(postsDir, file), 'utf8'))
        return {
          slug: String(data.slug || file.replace(/\.md$/, '')),
          title: String(data.title || file.replace(/\.md$/, '')),
          description: String(data.description || FEED_DESCRIPTION),
          date: String(data.date || new Date().toISOString().slice(0, 10)),
          draft: data.draft === true,
        }
      })
      .filter((post) => !post.draft)
      .sort((a, b) => b.date.localeCompare(a.date))
  : []

/* ------------------------------------------------------------------ */
/* sitemap.xml                                                         */
/* ------------------------------------------------------------------ */

const today = new Date().toISOString().slice(0, 10)

const entries = [
  ...site.nav.map((item) => ({
    loc: `${site.url}${item.to === '/' ? '/' : item.to}`,
    lastmod: today,
    ...(ROUTE_HINTS[item.to] ?? DEFAULT_HINT),
  })),
  ...posts.map((post) => ({
    loc: `${site.url}/blog/${post.slug}`,
    lastmod: post.date.slice(0, 10),
    changefreq: 'monthly',
    priority: '0.6',
  })),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`

/* ------------------------------------------------------------------ */
/* rss.xml                                                             */
/* ------------------------------------------------------------------ */

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.name)}</title>
    <link>${site.url}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>${FEED_LANGUAGE}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${site.url}/feeds/rss.xml" rel="self" type="application/rss+xml" />
${posts
  .map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${site.url}/blog/${post.slug}</link>
      <guid isPermaLink="true">${site.url}/blog/${post.slug}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`

/* ------------------------------------------------------------------ */

mkdirSync(feedsDir, { recursive: true })

writeFileSync(join(feedsDir, 'sitemap.xml'), sitemap, 'utf8')
console.log(`[feeds] public/feeds/sitemap.xml  ${entries.length} entries (${posts.length} posts)`)

writeFileSync(join(feedsDir, 'rss.xml'), rss, 'utf8')
console.log(`[feeds] public/feeds/rss.xml  ${posts.length} items`)
