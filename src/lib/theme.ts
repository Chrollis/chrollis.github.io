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

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'dark' as Theme)
  const toggle = useCallback(() => toggleTheme(), [])
  return { theme, isDark: theme === 'dark', toggle }
}
