import { useEffect, useRef } from 'react'

import { registerThemeSwap, setTheme } from '@/lib/theme'
import type { Theme } from '@/lib/theme'

/**
 * The colour wash between themes: one fixed layer that fades in, changes the theme while it is
 * opaque, and fades out onto the new palette.
 *
 * Nothing is interpolated token by token. The theme flips in one step, hidden behind the wash,
 * so `color-scheme`, the canvas ink and every pseudo-element change together with no seam -
 * which no amount of per-token tweening achieves, and it costs one element and two properties.
 *
 * It sits above every panel but below the scrollbar, the boot overlay and the cursor, so the
 * cursor stays crisp on the glass while the picture behind it is rewritten.
 */
const IN_MS = 240
const HOLD_MS = 60
const OUT_MS = 320
const TOTAL_MS = IN_MS + HOLD_MS + OUT_MS
/** Contrast of the scanline texture, as an alpha over the wash. */
const SCANLINE_ALPHA = 0.06

/**
 * Ease in and out. The fade-in deliberately lingers in the middle, where the wash is a mix of
 * the two palettes - that grey pass is the "tube lost its signal" beat, and an ease-out
 * compresses it into a few frames where nobody sees it.
 */
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

type Rgb = [number, number, number]

/** `--ak-bg` is bare RGB channels, so it interpolates as three numbers. */
function channels(value: string): Rgb {
  const parts = value.trim().split(/\s+/).map(Number)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

/**
 * Read tokens as the *target* theme would resolve them.
 *
 * Dark is the `:root` default and only light is an override, so an element cannot ask for dark
 * by attribute - it would keep inheriting the light values, which is exactly how the wash came
 * out bright in both directions. Flipping the root attribute for one synchronous moment is the
 * only way to read either palette without copying the colours into JavaScript; nothing paints
 * in between, and the attribute is restored before this returns.
 */
function paletteOf(theme: Theme): { bg: Rgb; line: string } {
  const root = document.documentElement
  const previous = root.getAttribute('data-theme')
  root.setAttribute('data-theme', theme)
  const style = getComputedStyle(root)
  const bg = channels(style.getPropertyValue('--ak-bg'))
  const line = style.getPropertyValue('--ak-text').trim() || '0 0 0'
  if (previous === null) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', previous)
  return { bg, line }
}

export default function ThemeTransition() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0
    let commitTimer = 0
    let clearTimer = 0
    /** What the mask is showing now, so a second switch continues from it. */
    let shown: Rgb | null = null

    const stop = () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(commitTimer)
      window.clearTimeout(clearTimer)
    }

    const run = (next: Theme) => {
      const { bg: to, line } = paletteOf(next)
      const from =
        shown ?? channels(getComputedStyle(document.documentElement).getPropertyValue('--ak-bg'))

      /* The texture is the incoming theme's own text colour, so the lines read on cream and on
         black alike. Set once; it fades with the mask. */
      element.style.backgroundImage = `repeating-linear-gradient(0deg, rgb(${line} / ${SCANLINE_ALPHA}) 0 1px, transparent 1px 4px)`

      stop()
      const start = performance.now()
      let committed = false

      const commit = () => {
        if (committed) return
        committed = true
        setTheme(next)
      }

      const tick = (now: number) => {
        const elapsed = now - start

        if (elapsed >= TOTAL_MS) {
          element.style.opacity = '0'
          shown = null
          return
        }

        let opacity: number
        if (elapsed < IN_MS) opacity = easeInOut(elapsed / IN_MS)
        else if (elapsed < IN_MS + HOLD_MS) opacity = 1
        else opacity = Math.pow(1 - (elapsed - IN_MS - HOLD_MS) / OUT_MS, 2)

        if (elapsed >= IN_MS) commit()

        /*
         * The colour mix arrives at the target exactly at the end of the fade-in, which is also
         * the moment the theme changes. Past that the wash matches the new background, so what
         * is left to see is the content surfacing as it fades out.
         */
        const k = elapsed < IN_MS ? easeInOut(elapsed / IN_MS) : 1
        const colour: Rgb = [
          from[0] + (to[0] - from[0]) * k,
          from[1] + (to[1] - from[1]) * k,
          from[2] + (to[2] - from[2]) * k,
        ]

        shown = colour
        element.style.backgroundColor = `rgb(${Math.round(colour[0])} ${Math.round(colour[1])} ${Math.round(colour[2])})`
        element.style.opacity = String(opacity)
        frame = requestAnimationFrame(tick)
      }

      /*
       * Both are also on timers. rAF does not fire in a background tab, and a theme switch that
       * never commits - or worse, a mask left covering the page - is not an acceptable outcome
       * for a click.
       */
      commitTimer = window.setTimeout(commit, IN_MS)
      clearTimer = window.setTimeout(() => {
        commit()
        element.style.opacity = '0'
        shown = null
      }, TOTAL_MS + 120)

      frame = requestAnimationFrame(tick)
    }

    registerThemeSwap(run)
    return () => {
      registerThemeSwap(null)
      stop()
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      /* Above the panels (content 10, nav 40, overlay 60), below the scrollbar (90), the boot
         overlay (100) and the cursor (120). */
      className="pointer-events-none fixed inset-0 z-[70] opacity-0"
    />
  )
}
