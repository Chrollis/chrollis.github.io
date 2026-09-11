/** Generic helpers. No framework knowledge in this file. */

/** Join class names, dropping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Format an ISO date as 2026.09.11 (the industrial dot style). */
export function formatDate(input: string | Date, sep = '.'): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return String(input)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${sep}${pad(d.getMonth() + 1)}${sep}${pad(d.getDate())}`
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

/**
 * How long ago, in whichever unit keeps the number readable: `[below this age, one of this
 * unit, this label]`, first match wins. Each rung is one step larger than the previous, so
 * no age can fall between two rows.
 *
 * Thresholds are where a unit stops being useful rather than where it becomes technically
 * correct - `MIN` holds to the hour because "59 MIN" is easier to place than "0 H", and
 * days give way at 7 so a fortnight reads as "2 W". These are readout symbols, identical in
 * both locales and untouched by the locale files.
 */
const RELATIVE_RUNGS: ReadonlyArray<readonly [limit: number, unit: number, label: string]> = [
  [HOUR_MS, MINUTE_MS, 'MIN'],
  [DAY_MS, HOUR_MS, 'H'],
  [WEEK_MS, DAY_MS, 'D'],
  [MONTH_MS, WEEK_MS, 'W'],
  [YEAR_MS, MONTH_MS, 'MO'],
  [Number.POSITIVE_INFINITY, YEAR_MS, 'Y'],
]

/**
 * Elapsed time as a compact label: `NOW`, `9 MIN`, `4 H`, `3 D`, `2 W`, `5 MO`, `1 Y`.
 * A future date reads as `NOW`, which falls out of the first comparison.
 */
export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return String(input)

  const elapsed = now.getTime() - d.getTime()
  if (elapsed < MINUTE_MS) return 'NOW'

  for (const [limit, unit, label] of RELATIVE_RUNGS) {
    if (elapsed < limit) return `${Math.floor(elapsed / unit)} ${label}`
  }

  /* Unreachable: the last rung's limit is Infinity. Present so the function has no implicit
     `undefined` return. */
  return 'NOW'
}

/**
 * Reading time in minutes. CJK characters count as one unit and Latin runs as words, so
 * mixed content does not skew the number.
 */
export function readingTime(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, '')

  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length
  const words = (
    text
      .replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
      .match(/\b[\w'-]+\b/g) ?? []
  ).length

  return Math.max(1, Math.round(cjk / 400 + words / 220))
}

/** Strip Markdown down to plain text, for previews and the search index. */
export function stripMarkdown(markdown: string, maxLength = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trimEnd()}...`
}

/** Zero-pad an index: 1 -> "01", for the counter labels. */
export function padIndex(n: number, size = 2): string {
  return String(n).padStart(size, '0')
}

/** Trailing debounce. */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 200) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}
