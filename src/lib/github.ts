/**
 * GitHub data. Repositories and statistics are fetched at BUILD time by
 * `scripts/fetch-github.mjs` and imported here as JSON.
 *
 * Not fetched from the browser: anonymous api.github.com allows 60 requests/hour per
 * visitor IP, so a visitor behind a shared NAT arrives with the quota spent; a token in a
 * bundle is public, and one shared token drains faster than the per-visitor quota it
 * replaced. As a build artefact it costs visitors nothing and has no loading state. The
 * only runtime fetch left is a single README, on demand, from the CDN-cached
 * raw.githubusercontent.com.
 *
 * The data is as new as the last build; the deploy workflow also runs daily.
 */
import { useEffect, useState } from 'react'

import data from '@/generated/github-data.json'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Repo {
  name: string
  fullName: string
  description: string | null
  url: string
  homepage: string | null
  language: string | null
  topics: string[]
  stars: number
  forks: number
  openIssues: number
  /** ISO timestamps */
  pushedAt: string
  createdAt: string
  archived: boolean
  fork: boolean
  license: string | null
  /** Needed to build a raw.githubusercontent README URL. */
  defaultBranch: string
}

export interface OverviewStat {
  label: string
  value: string
}

export interface LanguageStat {
  name: string
  percent: number
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/** When the snapshot was taken, as an ISO string. */
export const dataFetchedAt: string = data.fetchedAt

export const owner: string = data.owner

/** Every non-fork repository, newest push first. */
export const repos: Repo[] = data.repos as Repo[]

export const stats = data.stats as { overview: OverviewStat[]; languages: LanguageStat[] }

/**
 * GitHub's language colours, captured at build time.
 * Anything not listed falls back to the site accent.
 */
export const languageColours: Record<string, string> = data.languageColours

/* ------------------------------------------------------------------ */
/* README                                                              */
/* ------------------------------------------------------------------ */

const README_CACHE_PREFIX = 'gh-readme:v3:'
const README_TTL = 30 * 60 * 1000

interface CacheEntry {
  at: number
  value: string | null
}

function readCachedReadme(key: string): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.at > README_TTL) return undefined
    return parsed.value
  } catch {
    return undefined
  }
}

function writeCachedReadme(key: string, value: string | null) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value } satisfies CacheEntry))
  } catch {
    /* Storage blocked or full. Harmless. */
  }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch a repository README as raw Markdown.
 *
 * Branch candidates are ordered by likelihood and deliberately longer than `main`/`master`:
 * the real default branch is passed in first, so the common case is one request, but a repo
 * on `develop` used to fail outright and leave the panel permanently empty.
 */
export async function fetchReadme(
  ownerName: string,
  repo: string,
  defaultBranch = 'main',
): Promise<string | null> {
  const cacheKey = `${README_CACHE_PREFIX}${ownerName}/${repo}@${defaultBranch}`
  const cached = readCachedReadme(cacheKey)
  if (cached !== undefined) return cached

  const branches = [...new Set([defaultBranch, 'main', 'master', 'develop', 'dev'])]
  const files = ['README.md', 'readme.md', 'Readme.md', 'README.MD']

  for (const branch of branches) {
    for (const file of files) {
      const text = await fetchText(
        `https://raw.githubusercontent.com/${ownerName}/${repo}/${branch}/${file}`,
      )
      if (text === null) continue
      // Some setups return an HTML error page with a 200 for a missing path.
      if (text.trimStart().startsWith('<!DOCTYPE')) continue
      writeCachedReadme(cacheKey, text)
      return text
    }
  }

  writeCachedReadme(cacheKey, null)
  return null
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

/**
 * On-demand README, fetched the first time a card is expanded.
 *
 * `loading` is *derived* rather than stored: `setLoading(true)` in the effect body would
 * be a synchronous update during commit and cascade an extra render pass, so instead the
 * resolved value records which request it belongs to.
 */
export function useReadme(
  ownerName: string,
  repo: string,
  defaultBranch: string,
  enabled: boolean,
) {
  const key = `${ownerName}/${repo}@${defaultBranch}`
  const [settled, setSettled] = useState<{ key: string; markdown: string | null } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchReadme(ownerName, repo, defaultBranch).then((text) => {
      if (alive) setSettled({ key, markdown: text })
    })
    return () => {
      alive = false
    }
  }, [ownerName, repo, defaultBranch, enabled, key])

  const isSettled = settled?.key === key
  return {
    markdown: isSettled ? settled.markdown : null,
    loading: enabled && !isSettled,
  }
}
