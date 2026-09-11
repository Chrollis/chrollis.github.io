/**
 * Client-side search: FlexSearch over an in-memory index, with a custom encoder because the
 * default tokenizer splits on whitespace and is useless for CJK. Everything is wrapped in a
 * fallback to naive substring matching, so the search box always returns something.
 */
import { Index } from 'flexsearch'

import { postMetas } from './posts'
import type { PostMeta } from './posts'

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/
const SEP_RE = /[\s\-_/.,;:!?()[\]{}"'`~@#$%^&*+=|\\<>]+/

/** Latin words whole; CJK as single characters (recall) plus bigrams (precision). */
export function tokenize(input: string): string[] {
  const chars = [...String(input).toLowerCase()]
  const tokens: string[] = []
  let latin = ''

  const flush = () => {
    if (latin.length > 0) {
      tokens.push(latin)
      latin = ''
    }
  }

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (SEP_RE.test(ch)) {
      flush()
      continue
    }
    if (CJK_RE.test(ch)) {
      flush()
      tokens.push(ch)
      const next = chars[i + 1]
      if (next && CJK_RE.test(next)) tokens.push(ch + next)
    } else {
      latin += ch
    }
  }
  flush()
  return tokens
}

export interface SearchHit {
  post: PostMeta
  score: number
}

let index: Index | null = null
let indexFailed = false

function buildIndex(): Index | null {
  if (index) return index
  if (indexFailed) return null
  try {
    const idx = new Index({ encode: tokenize, tokenize: 'forward', resolution: 9 })
    for (const post of postMetas) {
      idx.add(
        post.slug,
        [post.title, post.title, post.description, post.tags.join(' '), post.searchText].join(' '),
      )
    }
    index = idx
    return idx
  } catch (error) {
    console.warn('[search] FlexSearch init failed, falling back to substring match', error)
    indexFailed = true
    return null
  }
}

/** Weight title and tag hits so obvious matches float to the top. */
function bonus(post: PostMeta, query: string): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  let score = 0
  if (post.title.toLowerCase().includes(q)) score += 12
  if (post.tags.some((tag) => tag.toLowerCase().includes(q))) score += 6
  if (post.description.toLowerCase().includes(q)) score += 3
  return score
}

function fallbackSearch(query: string, limit: number): SearchHit[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const tokens = tokenize(q)

  return postMetas
    .map((post) => {
      const haystack =
        `${post.title} ${post.description} ${post.tags.join(' ')} ${post.searchText}`.toLowerCase()
      let hits = 0
      for (const token of tokens) {
        if (haystack.includes(token)) hits += token.length > 1 ? 2 : 1
      }
      return { post, score: hits + bonus(post, q) }
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function searchPosts(query: string, limit = 8): SearchHit[] {
  const q = query.trim()
  if (q.length === 0) return []

  const idx = buildIndex()
  if (!idx) return fallbackSearch(q, limit)

  try {
    // FlexSearch's result shape differs across 0.7 / 0.8, so normalize
    // whatever comes back into a flat list of slugs.
    const raw = idx.search(q, { limit: limit * 2 }) as unknown
    const slugs: string[] = Array.isArray(raw)
      ? raw.flatMap((item) => {
          if (typeof item === 'string' || typeof item === 'number') return [String(item)]
          const field = (item as { field?: unknown }).field
          if (Array.isArray(field)) return field.map(String)
          const result = (item as { result?: unknown }).result
          if (Array.isArray(result)) return result.map(String)
          return []
        })
      : []

    const hits = [...new Set(slugs)]
      .map((slug) => postMetas.find((post) => post.slug === slug))
      .filter((post): post is PostMeta => Boolean(post))
      .map((post) => ({ post, score: bonus(post, q) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return hits.length > 0 ? hits : fallbackSearch(q, limit)
  } catch (error) {
    console.warn('[search] query failed, falling back to substring match', error)
    return fallbackSearch(q, limit)
  }
}
