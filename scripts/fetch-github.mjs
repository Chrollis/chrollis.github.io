/**
 * Build-time GitHub data fetch (`npm run data:fetch`, run by `npm run build`).
 *
 * Fetching at build time rather than in the browser: anonymous api.github.com allows 60
 * requests/hour *per visitor IP*, so a visitor behind a shared NAT arrives with the quota
 * spent; a token cannot fix it, because anything in a bundle is public and a shared token
 * burns faster than the per-visitor quota it replaced. Here, visitors make zero API calls
 * and there is no loading state.
 *
 * `GITHUB_TOKEN` is supplied automatically by Actions (1000/hour, public read) and is not
 * needed locally. The output `src/generated/github-data.json` is committed on purpose: it
 * is the offline fallback, and a missing file would break `tsc`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = join(root, 'src/generated/github-data.json')

/** Change these two if the site is pointed at a different account. */
const OWNER = 'Chrollis'
const STATS_REPO = 'Chrollis/github-stats-chrollis'
const STATS_BRANCH = 'generated'

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

/** GitHub's own language colours, for the language dot on each card. */
const LANGUAGE_COLOURS = {
  'C++': '#f34b7d',
  C: '#555555',
  Rust: '#dea584',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Vue: '#41b883',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Zig: '#ec915c',
  CMake: '#DA3434',
  Shell: '#89e051',
  PowerShell: '#012456',
  Ruby: '#701516',
  'Emacs Lisp': '#c065db',
  Batchfile: '#C1F12E',
  NSIS: '#aabbcc',
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'chrollis-site-build',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

async function getJson(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function getText(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

function textOf(fragment) {
  return fragment
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ------------------------------------------------------------------ */
/* Repositories                                                        */
/* ------------------------------------------------------------------ */

async function fetchRepos() {
  const collected = []

  for (let page = 1; page <= 3; page++) {
    const batch = await getJson(
      `https://api.github.com/users/${OWNER}/repos?per_page=100&page=${page}&sort=pushed`,
    )
    for (const item of batch) {
      if (item.fork) continue
      const spdx = item.license?.spdx_id
      collected.push({
        name: item.name,
        fullName: item.full_name,
        description: item.description,
        url: item.html_url,
        homepage: item.homepage,
        language: item.language,
        topics: item.topics ?? [],
        stars: item.stargazers_count,
        forks: item.forks_count,
        openIssues: item.open_issues_count,
        pushedAt: item.pushed_at,
        createdAt: item.created_at,
        archived: item.archived,
        fork: false,
        license: spdx && spdx !== 'NOASSERTION' ? spdx : null,
        defaultBranch: item.default_branch || 'main',
      })
    }
    if (batch.length < 100) break
  }

  return collected
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

async function fetchStats() {
  const base = `https://raw.githubusercontent.com/${STATS_REPO}/${STATS_BRANCH}`
  const [overviewSvg, languagesSvg] = await Promise.all([
    getText(`${base}/overview.svg`),
    getText(`${base}/languages.svg`),
  ])

  const overview = []
  if (overviewSvg) {
    const foreign = /<foreignObject[\s\S]*?<\/foreignObject>/.exec(overviewSvg)?.[0]
    /*
     * The overview card is a <table>, not a span list. Parsing it as alternating spans
     * silently produced zero rows, while the language list - a <ul>, a different shape -
     * kept working. Read the rows: one label cell and one value cell each.
     */
    const rows = foreign?.match(/<tr[\s\S]*?<\/tr>/g) ?? []
    for (const row of rows) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => textOf(m[1]))
      if (cells.length < 2) continue // a header row has a single <th>
      const [label, value] = cells
      if (!label || !value) continue
      if (/\d/.test(label) || !/\d/.test(value)) continue
      overview.push({ label, value })
    }
  }

  const languages = []
  if (languagesSvg) {
    const foreign = /<foreignObject[\s\S]*?<\/foreignObject>/.exec(languagesSvg)?.[0]
    const lists = foreign?.match(/<ul[\s\S]*?<\/ul>/g) ?? []
    for (const list of lists) {
      for (const item of list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
        const match = /^(.+?)\s*([\d.]+)\s*%$/.exec(textOf(item[1]))
        if (!match) continue
        const percent = Number.parseFloat(match[2])
        if (Number.isFinite(percent)) languages.push({ name: match[1].trim(), percent })
      }
    }
    languages.sort((a, b) => b.percent - a.percent)
  }

  if (overview.length === 0 && languages.length === 0) return null
  return { overview, languages }
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.info('[github] fetching build-time data...')
  if (!TOKEN) {
    console.info('[github] no GITHUB_TOKEN set; anonymous quota is 60/hour')
  }

  let repos = null
  let stats = null

  try {
    repos = await fetchRepos()
    console.info(`[github] ${repos.length} repositories`)
  } catch (error) {
    console.warn(`[github] repository fetch failed, keeping committed data: ${error.message}`)
  }

  try {
    stats = await fetchStats()
    if (stats) {
      console.info(
        `[github] ${stats.overview.length} statistics, ${stats.languages.length} languages`,
      )
    }
  } catch (error) {
    console.warn(`[github] statistics fetch failed, keeping committed data: ${error.message}`)
  }

  if (!repos && !stats) {
    console.warn('[github] nothing fetched; the committed snapshot stays in place')
    return
  }

  /*
   * Merge rather than overwrite: a partially degraded run must not destroy data it
   * already had. A rate-limited repo fetch with a successful statistics fetch has to keep
   * the previous repo list, or a transient limit wipes the project grid from the build.
   */
  let previous = {}
  try {
    previous = JSON.parse(readFileSync(OUT_FILE, 'utf8'))
  } catch {
    /* first run, or unreadable: start fresh */
  }

  const previousRepos = Array.isArray(previous.repos) ? previous.repos : []
  const finalRepos = repos && repos.length > 0 ? repos : previousRepos

  if (!repos && previousRepos.length > 0) {
    console.info(`[github] keeping ${previousRepos.length} repositories from the previous snapshot`)
  }
  if (!repos && previousRepos.length === 0) {
    console.warn('[github] no repositories available and no previous snapshot to fall back on')
  }

  const output = {
    $comment:
      'Generated by scripts/fetch-github.mjs during the build. Committed as the offline fallback. Do not edit by hand.',
    fetchedAt: new Date().toISOString(),
    owner: OWNER,
    repos: finalRepos,
    stats: stats ?? previous.stats ?? { overview: [], languages: [] },
    languageColours: LANGUAGE_COLOURS,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.info(`[github] wrote ${OUT_FILE.replace(root, '.')}`)
}

main().catch((error) => {
  // Never fail the build over decoration.
  console.warn(`[github] unexpected error, continuing with committed data: ${error}`)
})
