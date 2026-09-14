import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'

import Scramble from '@/components/Scramble'
import { site } from '@/data/site'
import { ARROW_NE } from '@/lib/glyphs'
import { useLocale } from '@/lib/locale'

/**
 * Cover: the home page is one full-height screen rather than a scrolling document.
 * Everything that used to sit below the fold has a route of its own.
 *
 * Layout is a flex column, not stacked absolute layers, so the mark and the headline
 * cannot collide at an awkward aspect ratio.
 */

const TYPE_MS = 85
const DELETE_MS = 45
const HOLD_MS = 2200
const BETWEEN_MS = 420

export default function CoverSection() {
  return (
    /*
     * `overflow-clip`, NOT `overflow-hidden`. Both clip the decorations at the same edge,
     * but `hidden` makes the box a scroll container and `clip` does not - and on iOS a
     * touch that starts inside a scroll container belongs to it. This section is the whole
     * first screen of the home page, so with `hidden` a finger swipe on the cover was
     * delivered to a box with nothing to scroll: the page behind it never moved, while a
     * swipe on the header or the footer (outside the box) scrolled normally.
     */
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-clip">
      {/* Signature texture: very low contrast horizontal lines. Pure CSS, no
          asset, and it never tints the page because it draws lines only. */}
      <div aria-hidden className="ak-scanlines pointer-events-none absolute inset-0 z-0" />

      {/* Readouts, pinned to the corners of the frame */}
      <IndexReadout />
      <GeometricMark />

      <div className="ak-container relative z-10 mt-auto pb-8 pt-20 sm:pb-10">
        <RoleLine />
        <Headline />
        <BottomBar />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Technical readouts                                                  */
/* ------------------------------------------------------------------ */

/**
 * Coordinates and clock, top-right. Decoration, but the values are real: the coordinates
 * come from `site.ts`. (This readout has been a page counter and a section counter - both
 * wrong on the one page that is a single screen with no sections.)
 */
function IndexReadout() {
  const { t } = useLocale()
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const pad = (value: number) => String(value).padStart(2, '0')
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    /*
     * One instrument cluster, not two unrelated readouts: the same type size for both
     * values, both columns right-aligned so they share an edge, and the divider stretched
     * by the flex row rather than given a height. `tabular-nums` keeps the clock from
     * reflowing every second.
     */
    <div className="ak-container pointer-events-none absolute inset-x-0 top-6 z-10 hidden sm:block">
      <div aria-hidden className="flex items-stretch justify-end gap-5">
        <div className="text-right">
          <p className="ak-label">{t.cover.coord}</p>
          <p className="mt-2 font-mono text-base leading-none text-ak-text [font-variant-numeric:tabular-nums]">
            {site.coordinates}
          </p>
        </div>

        <span className="w-px self-stretch bg-ak-border" />

        <div className="text-right">
          <p className="ak-label">{t.cover.local}</p>
          <p className="mt-2 font-mono text-base leading-none text-ak-text [font-variant-numeric:tabular-nums]">
            {clock}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Geometric mark                                                      */
/* ------------------------------------------------------------------ */

/**
 * The only large graphic on the screen: two counter-rotating square outlines with corner
 * ticks. Restrained on purpose - it should register as a machined part turning behind the
 * type, not compete with it.
 */
function GeometricMark() {
  const reduced = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-[6%] top-1/2 z-0 hidden -translate-y-1/2 md:block"
    >
      <div className="relative h-[min(46vh,420px)] w-[min(46vh,420px)]">
        {/* Outer frame, turning clockwise */}
        <div
          className={`absolute inset-0 border border-ak-border/80 ${
            reduced ? '' : 'animate-spin-slow'
          }`}
        >
          <span className="absolute -left-px -top-px h-3 w-3 border-l border-t border-ak-accent" />
          <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-ak-accent" />
        </div>

        {/* Inner frame, turning the other way */}
        <div
          className={`absolute inset-[18%] border border-ak-border/60 ${
            reduced ? '' : 'animate-spin-slow-reverse'
          }`}
        >
          <span className="absolute -left-px -top-px h-2 w-2 bg-ak-accent-2" />
        </div>

        {/* Fixed crosshair, so there is a still reference point */}
        <div className="absolute inset-[34%] border border-ak-accent/30" />
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ak-border/40" />
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ak-border/40" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Role line                                                           */
/* ------------------------------------------------------------------ */

function RoleLine() {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-3 w-px bg-ak-accent" />
      <span className="ak-label">{t.content.role}</span>
      <span aria-hidden className="h-px flex-1 bg-ak-border" />
      <span className="ak-index hidden sm:inline">
        {t.cover.since} {site.since}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Typewriter headline                                                 */
/* ------------------------------------------------------------------ */

type Phase = 'typing' | 'holding' | 'deleting'

function Headline() {
  const { t } = useLocale()
  const phrases = t.cover.phrases
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const reduced = useReducedMotion()

  const phrase = phrases[phraseIndex] ?? phrases[0]

  useEffect(() => {
    if (reduced) return

    let timer = 0

    if (phase === 'typing') {
      if (line1.length < phrase[0].length) {
        timer = window.setTimeout(() => setLine1(phrase[0].slice(0, line1.length + 1)), TYPE_MS)
      } else if (line2.length < phrase[1].length) {
        timer = window.setTimeout(() => setLine2(phrase[1].slice(0, line2.length + 1)), TYPE_MS)
      } else {
        // Phrase complete: enter 'holding', which parks the caret at the end of line 2.
        timer = window.setTimeout(() => setPhase('holding'), TYPE_MS)
      }
    } else if (phase === 'holding') {
      // The hold is served *in* this phase: transitioning on entry gave the caret one
      // frame on the last line before it snapped back, and cost an extra render pass.
      timer = window.setTimeout(() => setPhase('deleting'), HOLD_MS)
    } else if (line2.length > 0) {
      // Delete the second line first, so the block empties from the bottom up.
      timer = window.setTimeout(() => setLine2((text) => text.slice(0, -1)), DELETE_MS)
    } else if (line1.length > 0) {
      timer = window.setTimeout(() => setLine1((text) => text.slice(0, -1)), DELETE_MS)
    } else {
      timer = window.setTimeout(() => {
        setPhraseIndex((index) => (index + 1) % phrases.length)
        setPhase('typing')
      }, BETWEEN_MS)
    }

    return () => window.clearTimeout(timer)
  }, [phase, line1, line2, phrase, phrases, reduced])

  const shown1 = reduced ? phrase[0] : line1
  const shown2 = reduced ? phrase[1] : line2

  /*
   * Where the next character will land: line 1 until it is complete, then line 2 for the
   * rest of the cycle, and back to line 1 once line 2 has been deleted away. Keyed on the
   * line lengths rather than on the phase - `typing` spans both lines, so a phase test left
   * the caret at the end of line 1 for the whole time line 2 was being typed.
   */
  const caretLine =
    line1.length < phrase[0].length ? 1 : phase === 'deleting' && line2.length === 0 ? 1 : 2

  return (
    <h1
      /* `ak-display` keeps the clamp() in a named class: `text-[clamp(...)]` does not
         survive Tailwind's parser and silently falls back to the inherited 16px. */
      className="ak-display mt-6 select-none font-bold uppercase text-ak-text"
    >
      {/* Each line reserves its own height, so the block keeps a fixed size while the
          characters are typed and deleted. */}
      <span className="ak-typing-line">
        {shown1}
        {!reduced && caretLine === 1 && <Caret />}
      </span>
      <span className="ak-typing-line text-ak-muted">
        {shown2}
        {!reduced && caretLine === 2 && <Caret />}
      </span>
    </h1>
  )
}

function Caret() {
  return (
    <span className="ml-3 inline-block h-[0.09em] w-[0.4em] animate-blink bg-ak-accent align-baseline" />
  )
}

/* ------------------------------------------------------------------ */
/* Bottom bar                                                          */
/* ------------------------------------------------------------------ */

function BottomBar() {
  const { t } = useLocale()
  const navigate = useNavigate()

  return (
    <div className="mt-10 border-t border-ak-border pt-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="ak-btn ak-btn--solid ak-notch-sm"
        >
          {t.cover.enter}
          <span aria-hidden>{ARROW_NE}</span>
        </button>

        <p className="ak-cjk max-w-lg text-xs leading-relaxed text-ak-muted sm:text-sm">
          <Scramble text={t.cover.note} />
        </p>

        {/*
         * Right-aligned matching the Coord/Local cluster: it is the *values* that have to
         * share an edge, not the boxes. Left-aligned, the three cells would line up on
         * their labels and every value, being a different length, would stop at a
         * different x. A longer value or a translation cannot break this.
         */}
        <dl className="ml-auto hidden items-end gap-6 lg:flex">
          <div className="text-right">
            <dt className="ak-label">{t.cover.base}</dt>
            <dd className="mt-1 font-mono text-xs text-ak-text">{t.cover.baseValue}</dd>
          </div>
          <span aria-hidden className="h-8 w-px self-stretch bg-ak-border" />
          <div className="text-right">
            <dt className="ak-label">{t.cover.focus}</dt>
            <dd className="mt-1 font-mono text-xs text-ak-text">{t.cover.focusValue}</dd>
          </div>
          <span aria-hidden className="h-8 w-px self-stretch bg-ak-border" />
          <div className="text-right">
            <dt className="ak-label">{t.cover.status}</dt>
            <dd className="relative mt-1 font-mono text-xs text-ak-text">
              <span
                aria-hidden
                className="absolute -right-3.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 animate-pulse-frame bg-ak-accent-2"
              />
              {t.cover.statusValue}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
