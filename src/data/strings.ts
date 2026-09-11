/**
 * Locale registry. English is the reference and holds every string; other locales are
 * overrides typed as `DeepPartial<Strings>`, so an unknown key is a compile error and a
 * missing one is inherited. Non-language values live in `site.ts`.
 */
import { en } from './locales/en'
import type { DeepPartial, Strings } from './locales/en'
import { zh } from './locales/zh'

export type { DeepPartial, Strings }

export type LocaleCode = 'en' | 'zh'

/**
 * Overlay a locale's overrides on the reference locale. Recursive; arrays are replaced
 * wholesale rather than merged element-wise.
 */
function mergeValue(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base
  // Arrays, primitives and null are leaves: an override replaces them entirely.
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return patch
  if (typeof patch !== 'object' || patch === null) return patch

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue
    out[key] = mergeValue((base as Record<string, unknown>)[key], value)
  }
  return out
}

/** Complete a partial locale against the reference one. */
export function mergeLocale<T>(base: T, patch: DeepPartial<T>): T {
  return mergeValue(base, patch) as T
}

export const locales: Record<LocaleCode, Strings> = {
  en,
  // The type argument is required: without it inference settles on the partial type
  // from the second argument, and the result is typed as incomplete.
  zh: mergeLocale<Strings>(en, zh),
}

/** Every locale, in display order. */
export const LOCALE_CODES: readonly LocaleCode[] = ['en', 'zh']

/**
 * Named rather than derived from `LOCALE_CODES` order, so a script or a new locale
 * cannot become the reference just by sorting first.
 */
export const REFERENCE_LOCALE: LocaleCode = 'en'

/** English is the reference, so it is also the fallback. */
export const DEFAULT_LOCALE: LocaleCode = 'en'

/** BCP 47 tags, for <html lang> and og:locale. */
export const LOCALE_TAGS: Record<LocaleCode, { html: string; og: string }> = {
  en: { html: 'en', og: 'en_US' },
  zh: { html: 'zh-Hans', og: 'zh_CN' },
}

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return value === 'en' || value === 'zh'
}

/**
 * Match on the primary subtag, so `zh`, `zh-CN`, `zh-Hans-CN` and `zh-TW` all resolve to
 * Chinese. Traditional visitors get Simplified text, which beats English here.
 */
export function resolveLocale(tags: readonly string[]): LocaleCode {
  for (const tag of tags) {
    const primary = tag.toLowerCase().split('-')[0]
    if (isLocaleCode(primary)) return primary
  }
  return DEFAULT_LOCALE
}
