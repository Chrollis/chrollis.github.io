/**
 * Post-build step (the last stage of `npm run build`): writes `dist/404.html` as a copy of
 * `dist/index.html`, plus `dist/.nojekyll`.
 *
 * GitHub Pages serves static files only, so a direct hit on `/blog/some-post` returns the
 * host's 404 and React Router never runs; serving the built document for 404s hands the
 * real URL to the router. It has to run after Vite, because the copy carries hashed asset
 * names that only exist once the build has finished.
 *
 * `sitemap.xml` and `rss.xml` used to be generated here; they moved to
 * `scripts/build-feeds.mjs`, which writes into `public/` so the dev server serves them too.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')

/* ------------------------------------------------------------------ */
/* 0. Sanity check                                                     */
/* ------------------------------------------------------------------ */
if (!existsSync(distDir)) {
  console.error('[postbuild] dist/ not found - run `vite build` first')
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/* 1. SPA fallback                                                     */
/* ------------------------------------------------------------------ */
copyFileSync(join(distDir, 'index.html'), join(distDir, '404.html'))
console.log('[postbuild] 404.html written from index.html (SPA fallback)')

/* ------------------------------------------------------------------ */
/* 2. .nojekyll                                                        */
/* ------------------------------------------------------------------ */
mkdirSync(distDir, { recursive: true })
writeFileSync(join(distDir, '.nojekyll'), '')
console.log('[postbuild] .nojekyll written')
