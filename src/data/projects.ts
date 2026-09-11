/**
 * Project curation driven by GitHub topics. No repository names here: the facts come
 * from `src/generated/github-data.json`. A repository with no topics still appears with
 * its description and a stable hashed illustration, so forgetting a tag degrades to a
 * plain card rather than dropping it. Topic and ordering rules: `docs/CONVENTIONS.md`.
 */

/**
 * Every illustration, in a fixed order. `as const` derives `ProjectGlyph` from this
 * list. Ten entries for about a dozen repositories gives the hash room to spread them;
 * deriving the glyph from the language instead collapsed to one illustration, because
 * most of the repositories are C++.
 */
export const allGlyphs = [
  'crosshair',
  'wave',
  'neural',
  'orbit',
  'blocks',
  'grid',
  'terminal',
  'layers',
  'pulse',
  'circuit',
] as const

/** Picks the illustration drawn by src/components/Glyph.tsx */
export type ProjectGlyph = (typeof allGlyphs)[number]

const glyphSet: ReadonlySet<string> = new Set(allGlyphs)

function isGlyph(value: string): value is ProjectGlyph {
  return glyphSet.has(value)
}

/** Pins a repository to the front of the list. */
export const FEATURED_TOPIC = 'featured'

/** Removes a repository from the site. */
export const HIDDEN_TOPIC = 'noindex'

/** Introduces an explicit illustration choice, e.g. `glyph-wave`. */
export const GLYPH_PREFIX = 'glyph-'

/** Hidden automatically: a profile README or stats generator is about the account, not a project. */
export const PROFILE_TOPIC = 'profile'

/**
 * A GitHub Pages user site is published from `<owner>.github.io`, so the site's own
 * source is hidden without a topic. A custom domain served from a differently-named
 * repository breaks the match - tag that repository `noindex`.
 */
export const pagesRepoFor = (owner: string): string => `${owner}.github.io`

/** Options for `curate` that are not per-repository facts. */
export interface CurationOptions {
  /** Name of the repository that serves this site. See `pagesRepoFor`. */
  selfRepo?: string
}

/**
 * Only languages distinctive enough here not to collide. C++ and the web languages are
 * excluded on purpose: they dominate the list and would repeat.
 */
const LANGUAGE_GLYPHS: Record<string, ProjectGlyph> = {
  Rust: 'wave',
  Python: 'neural',
  Zig: 'grid',
}

/**
 * Illustrations suggested by what a repository says it is. **Order is priority**, first
 * hit wins, so entries run most specific first. The ordering rules are in
 * `docs/CONVENTIONS.md`.
 */
const GLYPH_KEYWORDS: readonly (readonly [ProjectGlyph, readonly string[]])[] = [
  ['crosshair', ['crosshair', 'aim', 'overlay']],
  [
    'terminal',
    ['library', 'compiler', 'interpreter', 'parser', 'splitter', 'juman', 'lrc', 'command-line'],
  ],
  ['wave', ['karaoke', 'subtitle', 'lyric', 'audio', 'music', 'waveform']],
  ['neural', ['mnist', 'neural', 'digit', 'recogni', 'classifier', 'machine-learning']],
  ['pulse', ['snake', 'realtime', 'real-time', 'telemetry', 'stream']],
  ['layers', ['shader', 'graphics', 'renderer', 'rendering', 'image', 'drawing', 'cg']],
  ['grid', ['algorithm', 'data-structure', 'struct', 'sorting', 'matrix']],
  ['orbit', ['tank', 'battle', 'physics', 'simulation', 'space']],
  ['blocks', ['editor', 'dashboard', 'component', 'framework', 'template', 'playground']],
  ['circuit', ['win32', 'driver', 'kernel', 'embedded', 'firmware']],
]

/** Ranked preferences, best first: a taken first choice falls through to the next. */
function preferencesFor(repo: CuratableRepo, topics: readonly string[]): ProjectGlyph[] {
  const out: ProjectGlyph[] = []

  const requested = topics
    .find((topic) => topic.startsWith(GLYPH_PREFIX))
    ?.slice(GLYPH_PREFIX.length)
  if (isGlyph(requested ?? '')) out.push(requested as ProjectGlyph)

  const byLanguage = LANGUAGE_GLYPHS[repo.language ?? '']
  if (byLanguage) out.push(byLanguage)

  const haystack = [repo.name, repo.description ?? '', ...topics].join(' ').toLowerCase()
  for (const [glyph, keywords] of GLYPH_KEYWORDS) {
    if (out.includes(glyph)) continue
    if (keywords.some((keyword) => haystack.includes(keyword))) out.push(glyph)
  }

  return out
}

export interface Curated<T> {
  repo: T
  /** Sort ahead of everything else. */
  featured: boolean
  /** Omit from the site. */
  hidden: boolean
  /** Always resolved: a card can never render without an illustration. */
  glyph: ProjectGlyph
}

/**
 * The only fields curation reads, so it stays independent of the full Repo type.
 * `description` and `topics` are optional because the committed JSON can be hand-edited.
 */
export interface CuratableRepo {
  name: string
  language: string | null
  description?: string | null
  topics?: readonly string[]
}

/** Deterministic FNV-1a style hash, so a repository always gets the same glyph. */
function hashName(name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash)
}

/**
 * Illustrations for a whole set of repositories.
 *
 * Global on purpose: hashing each name independently collides with near certainty
 * across a dozen repositories (the birthday problem), and a repeat is the one outcome
 * the hash exists to prevent.
 *
 * Explicit `glyph-<name>` topics are reserved first and may repeat; the ranked
 * preferences resolve next, then a hash walks forward to a free slot. Candidates
 * resolve in **name order**, not API order, so a commit cannot rearrange the site.
 */
export function curate<T extends CuratableRepo>(
  repos: readonly T[],
  options: CurationOptions = {},
): Curated<T>[] {
  const selfRepo = options.selfRepo?.toLowerCase() ?? ''

  const rows = repos.map((repo) => {
    // GitHub lowercases topics on write, so this is belt and braces.
    const topics = (repo.topics ?? []).map((topic) => topic.toLowerCase())

    const requested = topics
      .find((topic) => topic.startsWith(GLYPH_PREFIX))
      ?.slice(GLYPH_PREFIX.length)
    const explicit = isGlyph(requested ?? '') ? (requested as ProjectGlyph) : undefined

    const hidden =
      topics.includes(HIDDEN_TOPIC) ||
      topics.includes(PROFILE_TOPIC) ||
      (selfRepo !== '' && repo.name.toLowerCase() === selfRepo)

    return {
      repo,
      featured: topics.includes(FEATURED_TOPIC),
      hidden,
      // An explicit topic is an instruction, recorded apart from the preference list,
      // so a keyword match elsewhere cannot steal it.
      explicit,
      // Only rows that will render take part: a hidden repository holding a glyph
      // forced a duplicate among the visible cards.
      preferences: hidden ? [] : preferencesFor(repo, topics),
      glyph: undefined as ProjectGlyph | undefined,
    }
  })

  // Name order, not API order: the API sorts by push date, which would reshuffle glyphs.
  const byName = [...rows].sort((a, b) => a.repo.name.localeCompare(b.repo.name))

  // Reservations first, visible rows only. An explicit topic may repeat on purpose, and
  // must not lose to a keyword match, so it is taken before anything is ranked.
  const taken = new Set<string>(
    rows.filter((row) => !row.hidden && row.explicit).map((row) => row.explicit as ProjectGlyph),
  )

  // Pass one: the ranked preferences, first illustration still free.
  for (const row of byName) {
    if (row.hidden || row.explicit) continue

    for (const candidate of row.preferences) {
      if (taken.has(candidate)) continue
      row.glyph = candidate
      taken.add(candidate)
      break
    }
  }

  // Pass two: whatever is left gets a stable hash, walked forward to a free slot.
  for (const row of byName) {
    if (row.hidden || row.explicit || row.glyph) continue

    const start = hashName(row.repo.name) % allGlyphs.length
    for (let step = 0; step < allGlyphs.length; step++) {
      const candidate = allGlyphs[(start + step) % allGlyphs.length]
      if (taken.has(candidate)) continue
      row.glyph = candidate
      taken.add(candidate)
      break
    }

    // Every illustration is held. Repeat rather than leave the card without one.
    row.glyph ??= allGlyphs[start]
  }

  for (const row of rows) {
    row.glyph = row.explicit ?? row.glyph
  }

  return rows.map((row) => ({
    repo: row.repo,
    featured: row.featured,
    hidden: row.hidden,
    // Hidden repositories never render, but the type stays total.
    glyph: row.glyph ?? allGlyphs[hashName(row.repo.name) % allGlyphs.length],
  }))
}
