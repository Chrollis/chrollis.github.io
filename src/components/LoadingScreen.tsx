import { useCallback, useEffect, useRef, useState } from 'react'

import { useLocale } from '@/lib/locale'
import { warmNoiseFont } from '@/lib/scramble'
import { cn } from '@/lib/utils'

/**
 * Entry loading screen: a large percentage counter that slides across its track while it
 * counts, bracketed by slash marks like a technical readout.
 *
 * The counter is a fixed, fake ride: one EaseInOut sweep to 100% over `DURATION_MS`, the same
 * on every visit. It is deliberately not tied to any resource - a bar that moves at the speed
 * of the network tells the reader nothing they cannot already see, and it makes the boot a
 * different shape every time.
 *
 * What the overlay does wait for is the noise glyphs the scramble needs, so the first language
 * flip cannot render half its noise in a fallback font. The page stays covered until both the
 * ride and the fonts are done - and no longer, because `RESOURCE_BUDGET_MS` bounds that wait:
 * `document.fonts.load` can hang on a stalled connection, and rAF does not fire at all in a
 * background tab, so without the bound the overlay would stay mounted with
 * `body { overflow: hidden }` for the rest of the session.
 *
 * The counter updates every frame, so it writes to the DOM directly through refs rather than
 * re-rendering a tree sixty times a second for one text node.
 */
/** The ride: one fake EaseInOut sweep, the same on every visit. */
const DURATION_MS = 2400
/** How long after the ride the overlay may keep waiting for the noise glyphs. */
const RESOURCE_BUDGET_MS = 2000
/** Fade-out length. Must match the opacity transition on the overlay. */
const FADE_MS = 700
/** Beat on 100% before the fade starts. */
const HOLD_MS = 160

type Phase = 'loading' | 'hiding' | 'done'

/** Ease in and out: slow at both ends, which is what makes the ride read as machinery. */
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export default function LoadingScreen() {
  const { t } = useLocale()
  const [phase, setPhase] = useState<Phase>('loading')
  /** True once the page and the noise glyphs are both in - see the skip effect below. */
  const [ready, setReady] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)

  const skip = useCallback(() => setPhase('hiding'), [])

  useEffect(() => {
    if (phase !== 'loading') return

    const counter = counterRef.current
    const track = trackRef.current
    if (!counter || !track) return

    const start = performance.now()
    let frame = 0
    let finished = false

    /* The two gates: the page has loaded, and the noise glyph slices are in. */
    let pageReady = document.readyState === 'complete'
    let fontsReady = false
    let readyAt: number | null = null

    const markReady = () => {
      if (readyAt !== null) return
      readyAt = performance.now()
      setReady(true)
    }
    const checkReady = () => {
      if (pageReady && fontsReady) markReady()
    }

    /* Geometry measured once, not per frame: measuring in the loop would force a reflow
       every tick, and the counter is tabular, so "100%" is always the widest string. */
    let travel = 0
    const measure = () => {
      const previous = counter.textContent
      counter.textContent = '100%'
      const counterWidth = counter.offsetWidth
      counter.textContent = previous
      travel = Math.max(0, track.offsetWidth - counterWidth)
    }

    const paint = (value: number) => {
      counter.textContent = `${Math.round(value)}%`
      // translate3d stays on the compositor; animating `left` would relayout every frame.
      counter.style.transform = `translate3d(${(value / 100) * travel}px,0,0)`
      if (barRef.current) barRef.current.style.transform = `scaleX(${value / 100})`
    }

    const finish = () => {
      if (finished) return
      finished = true
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      paint(100)
      // Let the 100% state read for a beat before the fade starts.
      window.setTimeout(() => setPhase('hiding'), HOLD_MS)
    }

    const tick = (now: number) => {
      if (finished) return
      const elapsed = now - start
      paint(100 * easeInOut(Math.min(1, elapsed / DURATION_MS)))
      /* Both the ride and the fonts are done: there is nothing left to wait for. */
      if (elapsed >= DURATION_MS && readyAt !== null) {
        finish()
        return
      }
      frame = requestAnimationFrame(tick)
    }

    const onLoad = () => {
      pageReady = true
      checkReady()
    }
    if (!pageReady) window.addEventListener('load', onLoad, { once: true })

    /*
     * The noise glyphs are the only thing the ride waits for. Fire and forget: the promise
     * settles whether they arrive or not, and the bound below covers the case where it does
     * not, so a blocked fetch can never strand the overlay.
     */
    void warmNoiseFont().then(() => {
      fontsReady = true
      checkReady()
    })

    /*
     * A timer, not the frame loop: this is the guarantee that the overlay leaves even in a
     * background tab, where no frame ever runs.
     */
    const capTimer = window.setTimeout(() => {
      setReady(true)
      finish()
    }, DURATION_MS + RESOURCE_BUDGET_MS)

    measure()
    window.addEventListener('resize', measure)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(100)
      const timer = window.setTimeout(() => setPhase('hiding'), 400)
      return () => {
        window.clearTimeout(timer)
        window.clearTimeout(capTimer)
        window.removeEventListener('resize', measure)
        window.removeEventListener('load', onLoad)
      }
    }

    paint(0)
    frame = requestAnimationFrame(tick)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(capTimer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', onLoad)
    }
  }, [phase, skip])

  /*
   * Skip is offered only once the real loading is done. While the page or the noise glyphs are
   * still arriving, skipping would cancel the very load that makes the effect look right - and
   * `MAX_WAIT_MS` already guarantees the overlay leaves, so there is nothing to escape from.
   */
  useEffect(() => {
    if (!ready) return
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [ready, skip])

  /* Unmount once the fade has finished. */
  useEffect(() => {
    if (phase !== 'hiding') return
    const timer = window.setTimeout(() => setPhase('done'), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  /* Lock scrolling while the overlay is up. */
  useEffect(() => {
    if (phase === 'done') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [phase])

  /*
   * Hide, never unmount. Unmounting means React calls removeChild on the overlay node, and
   * if anything outside React already detached it - an extension that strips fixed overlays,
   * a userstyle - that throws. The overlay sits at the root of the tree, so the failure
   * escalates to the error boundary and replaces the page with a crash screen.
   */
  const done = phase === 'done'
  const faded = phase === 'hiding' || done

  return (
    <div
      /*
       * `--ak-boot` is the whole boot composition's scale: the counter is 1em of it, the
       * slashes 0.82em, the backdrop word 1.64em, and the spacing between them is in em too.
       * One scale means the proportions hold at every width - see the note in index.css.
       *
       * Its floor is the viewport floor from tokens.css: 1.375rem is what 7.32vw comes to at
       * `--ak-min-width` (300px), so the composition is fluid across exactly the supported
       * range and stops at the smallest screen we design for. (The watermark is what that
       * slope is really about: 1.64em of it is 4.068em of type, so the word is 48.8% of the
       * viewport at every width in that range - including the narrow end.)
       *
       * `--ak-boot-frame` is the frame's inset from the viewport edge: 16px on a phone, 24px
       * once there is room for it, fluid in between. It was `inset-4 sm:inset-6`, which
       * snapped the whole frame 8px inward the moment the window crossed 640px - and since
       * the label rows sit a further 20px inside the frame, that step pulled the content box
       * 15px NARROWER as the window grew 1px wider.
       *
       * `min-w`/`min-h` repeat the document's floor here because `fixed inset-0` sizes to the
       * viewport and inherits nothing from `html`: without them this overlay alone would keep
       * compressing at widths where the page behind it has already stopped and started to
       * scroll.
       */
      className={`[--ak-boot:clamp(1.375rem,7.32vw,5.5rem)] [--ak-boot-frame:clamp(1rem,2.2vw,1.5rem)] fixed inset-0 z-[100] min-h-[var(--ak-min-height)] min-w-[var(--ak-min-width)] overflow-hidden bg-ak-bg text-[length:var(--ak-boot)] transition-opacity duration-700 ${
        faded ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={done ? { display: 'none' } : undefined}
      role="status"
      aria-live="polite"
      aria-label={t.common.loading}
      aria-hidden={faded}
    >
      {/* Backdrop: near-black with a single low-contrast contour. No grid -
          a dense texture here reads as grey haze rather than depth. */}
      <div className="absolute inset-0 bg-ak-bg" />
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full text-ak-border"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
        fill="none"
        stroke="currentColor"
      >
        <path d="M-100 640 C 220 580, 500 720, 780 620 S 1160 540, 1320 600" opacity="0.3" />
      </svg>
      <div className="ak-scanlines absolute inset-0" />

      {/* Backdrop word: the subject the counter counts toward. Centred on the viewport, not
          placed in the content column, whose rows are pinned to the frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
      >
        <span className="ak-loading-backdrop">{t.common.loading}</span>
      </div>

      {/* One inset box carries the whole layout, so the border, accent corners and text rows
          share a single set of margins and cannot drift apart. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[var(--ak-boot-frame)] border border-ak-border/70"
      >
        {/* Offset by -1px so the accent strokes land exactly on the frame line */}
        <span className="absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-ak-accent" />
        <span className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-ak-accent" />
      </div>

      {/* Same inset as the frame plus 20px, so every row lines up with the frame rather
          than the viewport edge; `justify-between` leaves the counter floating in the middle.
          Written as the sum rather than a second pair of numbers, so the 20px between the
          frame line and the type holds at every width. */}
      <div className="relative flex h-full w-full flex-col justify-between p-[calc(var(--ak-boot-frame)_+_1.25rem)]">
        <div className="flex items-center justify-between">
          <span className="ak-label">{t.boot.label}</span>
          <span className="ak-index">{t.boot.serial}</span>
        </div>

        {/* Centre: slash, sliding counter, slash.
            Everything in here is measured in em of `--ak-boot`, so the parts and the gap to
            the rule keep their proportions at every width instead of each one hitting its own
            clamp at a different width. The coefficients are the px this composition was drawn
            at over the 88px cap: 0.82em = the 72px slashes, 0.91em = the 80px track,
            0.23em = the 20px from the track to the rule. */}
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-center gap-[0.32em]">
            <Slash />

            <div ref={trackRef} className="relative h-[0.91em] flex-1">
              <div
                ref={counterRef}
                className="absolute bottom-0 top-0 flex items-center font-mono text-[1em] font-bold leading-none tracking-tighter text-ak-accent will-change-transform"
              >
                0%
              </div>
            </div>

            <Slash flip />
          </div>

          {/* The fill scales from the left edge so it grows in step with the counter. The rule
              and its ticks stay in px: a hairline that scales stops being a hairline, and the
              ticks around the counter are already fine detail at the narrow end. */}
          <div className="relative mt-[0.23em]">
            <div className="h-px w-full bg-ak-border" />
            <span
              ref={barRef}
              aria-hidden
              className="ak-progress-fill absolute inset-x-0 top-0 h-px bg-ak-accent"
            />
            <div aria-hidden className="absolute inset-x-0 -top-1 flex justify-between">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((tick) => (
                <span
                  key={tick}
                  className={`w-px ${tick % 4 === 0 ? 'h-2 bg-ak-accent/60' : 'h-1 bg-ak-border'}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between">
          <span className="ak-label">{t.boot.status}</span>
          <span className="ak-index">{t.boot.statusSerial}</span>

          {/* Anchored above this row, out of the flow. In the flow it would push the row up by
              its own height plus the gap, and the two label rows would stop mirroring each
              other around the frame. `ak-label` so it matches the row's own micro-type, one
              step dimmer because it is the hint rather than the reading. */}
          <p
            className={cn(
              'ak-label absolute inset-x-0 bottom-full mb-2 text-center text-ak-muted/50',
              !ready && 'invisible',
            )}
          >
            {t.boot.skip}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Angular slash mark bracketing the counter. Sized in em of `--ak-boot` - see the middle
 *  block's note - so it stays in proportion to the counter rather than stepping at `sm`. */
function Slash({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 300"
      className={`h-[0.82em] w-auto shrink-0 text-ak-muted/40 ${flip ? '-scale-x-100' : ''}`}
      fill="currentColor"
    >
      <polygon points="74,0 0,300 26,300 100,0" />
    </svg>
  )
}
