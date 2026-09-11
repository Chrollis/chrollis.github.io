/**
 * Locale store: a tiny external store, exactly like `theme.ts`. No context, no provider.
 *
 * The difference from the theme is deliberate. Theme ignores the OS preference, because a
 * site that turns cream on a system setting is not the site anyone came for. Language is
 * not an appearance preference - it decides whether the reader can read the page - so this
 * one consults the browser once, and an explicit choice always wins and persists.
 *
 * It sets `<html lang>`, which drives `:lang()` selectors, screen-reader pronunciation and
 * CJK font fallback. `index.html` sets the same attribute before first paint.
 */
import { useCallback, useSyncExternalStore } from 'react'

import { DEFAULT_LOCALE, LOCALE_TAGS, locales, resolveLocale } from '@/data/strings'
import type { LocaleCode, Strings } from '@/data/strings'

const STORAGE_KEY = 'chrollis-locale'

let listeners: Array<() => void> = []
let current: LocaleCode = readStored() ?? detect()

/* Applied on load as well as on change. `index.html` sets the same attribute from the same
   inputs before first paint, so this is normally a no-op; it matters when the module is
   loaded outside that document. */
apply(current)

function readStored(): LocaleCode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'en' || value === 'zh') return value
    return null
  } catch {
    return null
  }
}

function detect(): LocaleCode {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  return resolveLocale(tags.filter(Boolean))
}

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): LocaleCode {
  return current
}

function apply(locale: LocaleCode) {
  document.documentElement.lang = LOCALE_TAGS[locale].html
}

export function setLocale(locale: LocaleCode) {
  if (locale === current) return
  current = locale
  apply(locale)
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* private mode: nothing to do, and nothing that breaks */
  }
  emit()
}

export function toggleLocale() {
  setLocale(current === 'en' ? 'zh' : 'en')
}

export interface LocaleValue {
  locale: LocaleCode
  /** Every user-visible string for the active locale. */
  t: Strings
  setLocale: (locale: LocaleCode) => void
  toggle: () => void
}

/**
 * Read the active locale and its strings. `t` is returned directly so callers read
 * `const { t } = useLocale()` and then `t.projects.intro`.
 */
export function useLocale(): LocaleValue {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LOCALE)
  const set = useCallback((next: LocaleCode) => setLocale(next), [])
  const toggle = useCallback(() => toggleLocale(), [])
  return { locale, t: locales[locale], setLocale: set, toggle }
}
