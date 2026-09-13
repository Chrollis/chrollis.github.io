/**
 * Theme store: a tiny external store instead of a React context, so any number of toggles
 * share one value without a provider.
 *
 * Dark is the default, full stop: the OS preference is deliberately not consulted, and
 * light is only reachable as an explicit choice, which then persists.
 */
import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'chrollis-theme'

let listeners: Array<() => void> = []
let current: Theme = readStoredTheme() ?? readDomTheme()

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function readDomTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
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

function getSnapshot(): Theme {
  return current
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0b0c' : '#f4f1ea')
}

export function setTheme(theme: Theme) {
  if (theme === current) return
  current = theme
  apply(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* private mode: nothing to do, and nothing that breaks */
  }
  emit()
}

/** Routed through `switchTheme` so a caller cannot bypass the mask by accident. */
export function toggleTheme() {
  switchTheme(current === 'dark' ? 'light' : 'dark')
}

/**
 * The mask transition registers itself here on mount.
 *
 * A module-level slot rather than a context: the theme is already an external store, and the
 * mask has to sit at the app root - above every panel, below the cursor - not inside the
 * button that triggers it.
 */
let swap: ((next: Theme) => void) | null = null

export function registerThemeSwap(runner: ((next: Theme) => void) | null): void {
  swap = runner
}

/**
 * Change the theme, through the mask when one is registered and motion is allowed. Falls back
 * to an instant swap, which is also what reduced motion gets.
 */
export function switchTheme(next: Theme): void {
  if (next === current) return
  if (!swap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(next)
    return
  }
  swap(next)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'dark' as Theme)
  const toggle = useCallback(() => toggleTheme(), [])
  return { theme, isDark: theme === 'dark', toggle }
}
