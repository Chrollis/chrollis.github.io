import { useCallback, useEffect, useRef, useState } from 'react'

import { useLocale } from '@/lib/locale'

/**
 * Entry loading screen: a large percentage counter that slides across its track while it
 * counts, bracketed by slash marks like a technical readout.
 *
 * Deliberately deterministic. An earlier version gated the counter on real asset loads and
 * raced its own "page ready" signal, which could strand the overlay at 0% indefinitely. For
 * decorative chrome a completion guarantee beats a truthful byte count: the counter always
 * reaches 100% at `DURATION_MS`, and the overlay is only held until the page is interactive,
 * with `MAX_WAIT_MS` guaranteeing that arrives too.
 *
 * The counter updates every frame, so it writes to the DOM directly through refs rather than
 * re-rendering a tree sixty times a second for one text node.
 */
const DURATION_MS = 1500
/** Fade-out length. Must match the opacity transition on the overlay. */
const FADE_MS = 700
/** Hard cap on waiting for the page to become interactive. */
const MAX_WAIT_MS = 3000

type Phase = 'loading' | 'hiding' | 'done'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export default function LoadingScreen() {
  const { t } = useLocale()
  const [phase, setPhase] = useState<Phase>('loading')

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
    let ready = document.readyState === 'complete'
    let finished = false

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

    const paint = (percent: number) => {
      counter.textContent = `${Math.round(percent)}%`
      // translate3d stays on the compositor; animating `left` would relayout every frame.
      counter.style.transform = `translate3d(${(percent / 100) * travel}px,0,0)`
      if (barRef.current) barRef.current.style.transform = `scaleX(${percent / 100})`
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
      window.setTimeout(() => setPhase('hiding'), 160)
    }

    /*
     * Completion is driven by a timer, NOT by the animation frame loop: rAF does not fire at
     * all while the document is hidden, and opening a link in a background tab is normal.
     * When the loop was the only thing that could finish, a background tab left the overlay
     * mounted with `body { overflow: hidden }` applied, silently disabling scroll for the
     * session. So the timer guarantees the transition and rAF only interpolates: a frozen
     * animation degrades to "no motion", never to "stuck".
     */
    const finishTimer = window.setTimeout(() => {
      ready = true
      finish()
    }, DURATION_MS + 120)

    const tick = () => {
      if (finished) return
      const t = Math.min(1, (performance.now() - start) / DURATION_MS)
      paint(100 * easeOutCubic(t))
      frame = requestAnimationFrame(tick)
    }

    const onReady = () => {
      ready = true
    }

    if (!ready) window.addEventListener('load', onReady, { once: true })

    // Guarantees the wait on `load` always ends, whatever the event does.
    const capTimer = window.setTimeout(onReady, MAX_WAIT_MS)

    measure()
    window.addEventListener('resize', measure)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(100)
      const timer = window.setTimeout(() => setPhase('hiding'), 400)
      return () => {
        window.clearTimeout(timer)
        window.clearTimeout(finishTimer)
        window.clearTimeout(capTimer)
        window.removeEventListener('resize', measure)
        window.removeEventListener('load', onReady)
      }
    }

    paint(0)
    frame = requestAnimationFrame(tick)

    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(finishTimer)
      window.clearTimeout(capTimer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', onReady)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [phase, skip])

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
      className={`fixed inset-0 z-[100] overflow-hidden bg-ak-bg transition-opacity duration-700 ${
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
        className="pointer-events-none absolute inset-4 border border-ak-border/70 sm:inset-6"
      >
        {/* Offset by -1px so the accent strokes land exactly on the frame line */}
        <span className="absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-ak-accent" />
        <span className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-ak-accent" />
      </div>

      {/* Same inset as the frame plus padding, so every row lines up with the frame rather
          than the viewport edge; `justify-between` leaves the counter floating in the middle. */}
      <div className="relative flex h-full w-full flex-col justify-between px-8 py-9 sm:px-12 sm:py-11">
        <div className="flex items-center justify-between">
          <span className="ak-label">{t.boot.label}</span>
          <span className="ak-index">{t.boot.serial}</span>
        </div>

        {/* Centre: slash, sliding counter, slash */}
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-center gap-[clamp(0.375rem,1.6vw,1.75rem)]">
            <Slash />

            <div ref={trackRef} className="relative h-16 flex-1 sm:h-20">
              <div
                ref={counterRef}
                className="absolute bottom-0 top-0 flex items-center font-mono text-[clamp(2.75rem,9vw,5.5rem)] font-bold leading-none tracking-tighter text-ak-accent will-change-transform"
              >
                0%
              </div>
            </div>

            <Slash flip />
          </div>

          {/* The fill scales from the left edge so it grows in step with the counter. */}
          <div className="relative mt-5">
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

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="ak-label">{t.boot.status}</span>
            <span className="ak-index">{t.boot.statusSerial}</span>
          </div>
          <p className="text-center font-mono text-[0.625rem] tracking-ak text-ak-muted/50">
            {t.boot.skip}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Angular slash mark bracketing the counter. */
function Slash({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 300"
      className={`h-14 w-auto shrink-0 text-ak-muted/40 sm:h-[4.5rem] ${flip ? '-scale-x-100' : ''}`}
      fill="currentColor"
    >
      <polygon points="74,0 0,300 26,300 100,0" />
    </svg>
  )
}
