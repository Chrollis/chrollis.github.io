/**
 * Minimal frontmatter parser for `title`, `date`, `tags`, `draft` and friends.
 *
 * Hand-rolled rather than gray-matter, which pulls in Node builtins that need browser
 * polyfills. `scripts/build-feeds.mjs` imports this same parser, so the build and the site
 * cannot disagree about a post's metadata.
 */

export type FrontmatterValue = string | number | boolean | string[]

export interface FrontmatterResult {
  data: Record<string, FrontmatterValue>
  content: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function coerce(value: string): FrontmatterValue {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => v.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value)
  return value
}

export function parseFrontmatter(raw: string): FrontmatterResult {
  const match = FRONTMATTER_RE.exec(raw)
  if (!match) return { data: {}, content: raw }

  const data: Record<string, FrontmatterValue> = {}
  const lines = match[1].split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colon = trimmed.indexOf(':')
    if (colon === -1) continue

    const key = trimmed.slice(0, colon).trim()
    let rest = trimmed.slice(colon + 1).trim()

    // Block sequence form:
    //   tags:
    //     - Rust
    if (rest === '') {
      const items: string[] = []
      let j = i + 1
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*-\s+/, '').trim())
        j++
      }
      if (items.length > 0) {
        data[key] = items
        i = j - 1
        continue
      }
    }

    // Trailing comment: key: value # note
    const hash = rest.indexOf(' #')
    if (hash !== -1 && !rest.startsWith('#')) rest = rest.slice(0, hash).trim()

    data[key] = coerce(rest)
  }

  return { data, content: raw.slice(match[0].length) }
}
