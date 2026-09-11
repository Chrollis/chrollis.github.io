/*
 * Curation audit (`npm run audit:curation`): prints what every repository in the build
 * snapshot resolves to, to confirm that topics tagged on GitHub took effect.
 *
 * It imports `src/data/projects.ts` and reads the committed `github-data.json` directly,
 * so there is one copy of the rules and it reports what the site will actually build.
 * Run `npm run data:fetch` first for fresh data.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { curate, GLYPH_PREFIX, pagesRepoFor } from '../src/data/projects.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'src/generated/github-data.json'), 'utf8'))

const rows = curate(data.repos, { selfRepo: pagesRepoFor(data.owner) })
const visible = rows.filter((entry) => !entry.hidden)
const hidden = rows.filter((entry) => entry.hidden)
const featured = visible.filter((entry) => entry.featured)

const glyphCounts = new Map()
for (const { glyph } of visible) {
  glyphCounts.set(glyph, (glyphCounts.get(glyph) ?? 0) + 1)
}
const repeated = [...glyphCounts.entries()].filter(([, count]) => count > 1)

console.log(`${data.repos.length} repositories, ${visible.length} visible, ${hidden.length} hidden`)
console.log('')
console.log('repo                   language  glyph        featured  topics')
for (const { repo, glyph, hidden: isHidden, featured: isFeatured } of rows) {
  const name = repo.name.padEnd(22)
  const language = (repo.language ?? '-').padEnd(9)
  const glyphCell = (isHidden ? '(hidden)' : glyph).padEnd(12)
  console.log(
    `${name} ${language} ${glyphCell} ${(isFeatured ? 'yes' : '').padEnd(9)} ${(repo.topics ?? []).join(' ')}`,
  )
}

console.log('')
console.log(
  `featured: ${featured.length === 0 ? '(none)' : featured.map((r) => r.repo.name).join(', ')}`,
)
console.log(
  `hidden:   ${hidden.length === 0 ? '(none)' : hidden.map((r) => r.repo.name).join(', ')}`,
)
console.log(
  `distinct illustrations: ${glyphCounts.size} across ${visible.length} visible repositories` +
    (repeated.length > 0
      ? `  <- repeats: ${repeated.map(([glyph, n]) => `${glyph} x${n}`).join(', ')}`
      : ''),
)
console.log('')
console.log(`A specific illustration is requested with a topic like ${GLYPH_PREFIX}<name>.`)
