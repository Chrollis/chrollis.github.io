/*
 * Curation rule verification (`npm run test:curation`). Two properties that are invisible
 * in a diff and easy to break:
 *
 *   - the assignment must not depend on the order the GitHub API returns repositories in,
 *     which changes every time a repository is pushed
 *   - no two visible repositories may share an illustration, while supply lasts
 *
 * Both were broken once, by hashing each name independently. Node 24 runs the TypeScript
 * module directly, so this exercises the code the site ships rather than a copy.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { allGlyphs, curate, pagesRepoFor } from '../src/data/projects.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const snapshot = JSON.parse(readFileSync(join(root, 'src/generated/github-data.json'), 'utf8'))

/** The shipping configuration: the snapshot, curated against its own account. */
const curateSnapshot = (repos = snapshot.repos) =>
  curate(repos, { selfRepo: pagesRepoFor(snapshot.owner) })

let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}`)
    console.log(`        actual   ${JSON.stringify(actual)}`)
  }
}

/** A minimal repository, so each case states only what it is about. */
const repo = (overrides = {}) => ({
  name: 'r',
  language: 'C++',
  description: null,
  topics: [],
  ...overrides,
})

const distinctGlyphs = (entries) => new Set(entries.map((entry) => entry.glyph)).size

/* --- the two load-bearing properties --------------------------------- */

const forward = curateSnapshot()
const reversed = curateSnapshot([...snapshot.repos].reverse())
const byName = (entries) => entries.map((entry) => `${entry.repo.name}=${entry.glyph}`).sort()

check(
  'assignment does not depend on the order the API returns repos in',
  byName(reversed),
  byName(forward),
)

const visible = forward.filter((entry) => !entry.hidden)
check(
  'no two visible repositories share an illustration, while supply lasts',
  distinctGlyphs(visible),
  Math.min(visible.length, allGlyphs.length),
)

/* --- what the topics mean -------------------------------------------- */

check('featured pins to the front', curate([repo({ topics: ['featured'] })])[0].featured, true)
check('noindex hides', curate([repo({ topics: ['noindex'] })])[0].hidden, true)
check(
  'profile hides without being asked',
  curate([repo({ topics: ['profile', 'readme'] })])[0].hidden,
  true,
)
check('an untagged repository stays visible', curate([repo()])[0].hidden, false)
check(
  'topics are matched case-insensitively',
  curate([repo({ topics: ['Featured', 'Glyph-Blocks'] })])[0],
  {
    repo: repo({ topics: ['Featured', 'Glyph-Blocks'] }),
    featured: true,
    hidden: false,
    glyph: 'blocks',
  },
)

/* --- illustration resolution ---------------------------------------- */

check(
  'a glyph- topic overrides the language mapping',
  curate([repo({ name: 'solo', language: 'Rust', topics: ['glyph-blocks'] })])[0].glyph,
  'blocks',
)
check(
  'an unknown glyph name falls through to a real illustration',
  allGlyphs.includes(curate([repo({ name: 'solo', topics: ['glyph-nope'] })])[0].glyph),
  true,
)
check(
  'the language mapping still applies with no topic',
  curate([repo({ name: 'solo', language: 'Rust' })])[0].glyph,
  'wave',
)
check(
  'asking for the same illustration twice is honoured, not corrected',
  curate([
    repo({ name: 'a', topics: ['glyph-wave'] }),
    repo({ name: 'b', topics: ['glyph-wave'] }),
  ]).map((entry) => entry.glyph),
  ['wave', 'wave'],
)
check(
  'hidden repositories do not hold illustrations the visible ones need',
  distinctGlyphs(
    curateSnapshot([repo({ name: 'aaa', topics: ['noindex'] }), ...snapshot.repos]).filter(
      (entry) => !entry.hidden,
    ),
  ),
  Math.min(visible.length, allGlyphs.length),
)

/*
 * The two regressions this suite was written around, both found by the audit
 * script rather than by a test - which is why they are tests now.
 *
 * The shape matters here. Asserting "the visible repo got `grid`" does not test
 * the fix at all: with every slot free the walk takes the first one from the hash,
 * which is usually not the reserved glyph anyway. The bug only shows up when the
 * supply is exactly exhausted - one slot wrongly held back forces a duplicate. So
 * the test fills every illustration and hides one repository on top.
 */
const exactlyEnough = Array.from({ length: allGlyphs.length }, (_, i) =>
  repo({ name: `v-${String(i).padStart(2, '0')}` }),
)

check(
  'a hidden repository does not reserve its language-mapped illustration',
  distinctGlyphs(
    curate([
      repo({ name: 'hidden-zig', language: 'Zig', topics: ['noindex'] }),
      ...exactlyEnough,
    ]).filter((entry) => !entry.hidden),
  ),
  allGlyphs.length,
)

/* --- the site's own repository -------------------------------------- */

const selfRepo = pagesRepoFor(snapshot.owner)

check(
  'the site repository is hidden without needing a topic',
  curate([repo({ name: selfRepo })], { selfRepo })[0].hidden,
  true,
)
check(
  'the match ignores case',
  curate([repo({ name: selfRepo.toUpperCase() })], { selfRepo })[0].hidden,
  true,
)
check('omitting selfRepo hides nothing extra', curate([repo({ name: selfRepo })])[0].hidden, false)
check(
  'a differently-named repository is not mistaken for the site',
  curate([repo({ name: 'some-other-site' })], { selfRepo })[0].hidden,
  false,
)

/* --- illustration resolution: keyword tier -------------------------- */

/*
 * The keyword tier exists so the automatic choice is *relevant* rather than merely
 * stable, which means untagged repositories get a sensible illustration and nobody
 * has to set one per repository. These are the cases the ordering rules were
 * derived from; they broke once each.
 */
const keywordCase = (over) => curate([repo({ name: 'solo', ...over })])

check(
  'a topic keyword picks a matching illustration',
  keywordCase({ topics: ['crosshair-overlay'] })[0].glyph,
  'crosshair',
)
check('a name keyword is matched', keywordCase({ name: 'tomato-snake' })[0].glyph, 'pulse')
check(
  'a description keyword is matched',
  keywordCase({ description: 'A compiler for a small language' })[0].glyph,
  'terminal',
)
check(
  'terminal outranks wave, so a library wins over its own subject matter',
  keywordCase({ name: 'jumanlrc-lib', description: 'library for Japanese lyrics' })[0].glyph,
  'terminal',
)
check(
  'an explicit topic beats the keyword match',
  keywordCase({ description: 'a snake game', topics: ['glyph-layers'] })[0].glyph,
  'layers',
)
check(
  'the language mapping beats the keyword match',
  keywordCase({ language: 'Rust', description: 'a snake game' })[0].glyph,
  'wave',
)
/*
 * Both repositories want `neural`. The point is what the loser gets: its *second*
 * preference, not an arbitrary hashed illustration. Asserting a specific glyph
 * rather than "not equal to the other one" matters - the hash happens to be stable
 * per name, so this would pass by coincidence if the fallback were the hash and
 * `bbb` simply hashed to `layers`.
 */
check(
  'a taken preference falls through to the next preference, not to the hash',
  curate([
    repo({ name: 'aaa', description: 'an mnist classifier' }),
    repo({ name: 'bbb', description: 'an mnist classifier and a graphics renderer' }),
  ])
    .filter((entry) => entry.repo.name === 'bbb')
    .map((entry) => entry.glyph),
  ['layers'],
)

/* --- degenerate input ----------------------------------------------- */

const noTopics = curate([{ name: 'legacy', language: null }])
check(
  'a missing topics field is tolerated',
  noTopics.length === 1 && allGlyphs.includes(noTopics[0].glyph),
  true,
)

const overflow = curate(
  Array.from({ length: allGlyphs.length + 4 }, (_, i) =>
    repo({ name: `repo-${String(i).padStart(2, '0')}` }),
  ),
)
check(
  'more repositories than illustrations still resolves every one',
  overflow.every((entry) => allGlyphs.includes(entry.glyph)),
  true,
)
check('repeats are limited to the overflow', distinctGlyphs(overflow), allGlyphs.length)

console.log('')
console.log(
  failures === 0
    ? `all checks passed (${snapshot.repos.length} repos in the snapshot, ${allGlyphs.length} illustrations)`
    : `${failures} check(s) failed`,
)
process.exit(failures === 0 ? 0 : 1)
