import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Overlay scrollbar: floats above the page instead of taking layout width.
 *
 * A native bar consumes horizontal space, so the layout is only centred against
 * (viewport - scrollbar), and it appears and disappears between routes, shifting everything
 * sideways. Reserving the gutter symmetrically leaves a visible dead strip instead. So the
 * native bar is hidden (see the root rules in `styles/index.css`) and this replaces it:
 * fixed to the right edge, no layout impact. Hidden on touch, where the platform overlay is
 * better. See `docs/DECISIONS.md`.
 */

/** Minimum thumb height in px, so a very long page stays grabbable. */
const MIN_THUMB = 28
/** Idle time before the bar fades out, in ms. */
const IDLE_MS = 1200
const RAIL_INSET = 6

export default function OverlayScrollbar() {
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(false)

  /* In a ref, not state: this changes on every scroll event and re-rendering for each one
     would be wasteful. */
  const metrics = useRef({ thumbSize: 0, travel: 0, maxScroll: 0 })
  const dragging = useRef(false)

  const position = useCallback(() => {
    const thumb = thumbRef.current
    if (!thumb) return
    const { travel, maxScroll, thumbSize } = metrics.current
    if (maxScroll <= 0) return

    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll))
    thumb.style.transform = `translate3d(0, ${progress * travel}px, 0)`
    thumb.style.height = `${thumbSize}px`
  }, [])

  const measure = useCallback(() => {
    /*
     * Track height from the viewport, NOT the rail element. The rail only mounts while
     * `visible` is true, so measuring it was circular: the component returned null, the ref
     * was null, and it could never become visible. The rail is `h-screen` by definition.
     */
    const track = window.innerHeight - RAIL_INSET
    const viewport = window.innerHeight
    const total = document.documentElement.scrollHeight

    if (total <= viewport) {
      setVisible(false)
      return
    }

    const ratio = viewport / total
    const thumbSize = Math.max(MIN_THUMB, Math.round(track * ratio))
    const travel = track - thumbSize
    const maxScroll = total - viewport

    metrics.current = { thumbSize, travel, maxScroll }
    setVisible(true)

    // Paints immediately if the thumb is already mounted; the effect below
    // covers the first run, before React has committed the node.
    position()
  }, [position])

  /* Paints the thumb with the latest geometry once it exists, or it would sit at its
     default height until the first scroll. */
  useEffect(() => {
    if (visible) position()
  }, [visible, position])

  useEffect(() => {
    // Touch devices already have good overlay scrollbars; a second affordance is worse
    // than none.
    if (window.matchMedia('(hover: none)').matches) return

    let idleTimer = 0

    const onScroll = () => {
      position()
      setActive(true)
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => setActive(false), IDLE_MS)
    }

    const onResize = () => measure()

    /*
     * No synchronous `measure()` here: that is a state update during commit, and deferring
     * it exposed a second problem - ResizeObserver callbacks arrive pre-paint, so a document
     * that is not painting never gets its first one. `visibilitychange` covers that case and
     * re-measures on restore, when the viewport may well have changed.
     */
    const onVisibility = () => {
      if (!document.hidden) measure()
    }

    // Content changes height without a resize: lazy routes, images, a filter changing the
    // result count. Watching the document keeps the thumb from going stale.
    const observer = new ResizeObserver(() => measure())
    observer.observe(document.documentElement)
    if (document.body) observer.observe(document.body)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)

    // Deferred, because a state update during commit costs an extra render pass. The
    // observer's own first callback normally beats this, but that callback never arrives
    // while the document is hidden - so this is what mounts the bar in a background tab.
    const initial = window.setTimeout(() => measure(), 0)

    return () => {
      window.clearTimeout(idleTimer)
      window.clearTimeout(initial)
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [measure, position])

  /* ---- dragging ---- */
  useEffect(() => {
    const thumb = thumbRef.current
    if (!thumb) return

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault()
      dragging.current = true
      thumb.setPointerCapture(event.pointerId)
      setActive(true)

      const startY = event.clientY
      const startScroll = window.scrollY

      const onMove = (moveEvent: PointerEvent) => {
        const { travel, maxScroll } = metrics.current
        if (travel <= 0) return
        const delta = moveEvent.clientY - startY
        // Convert thumb travel back into document scroll distance.
        window.scrollTo({ top: startScroll + (delta / travel) * maxScroll })
      }

      const onUp = () => {
        dragging.current = false
        thumb.removeEventListener('pointermove', onMove)
        thumb.removeEventListener('pointerup', onUp)
        thumb.removeEventListener('pointercancel', onUp)
      }

      thumb.addEventListener('pointermove', onMove)
      thumb.addEventListener('pointerup', onUp)
      thumb.addEventListener('pointercancel', onUp)
    }

    thumb.addEventListener('pointerdown', onPointerDown)
    return () => thumb.removeEventListener('pointerdown', onPointerDown)
  }, [])

  /* Clicking the rail jumps the viewport to that point. */
  const onRailClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const progress = (event.clientY - rect.top) / rect.height
    window.scrollTo({
      top: progress * (document.documentElement.scrollHeight - window.innerHeight),
    })
  }

  if (!visible) return null

  return (
    /* Rests at partial opacity rather than hiding completely: a bar invisible until you
       scroll is undiscoverable on first load, and it would make a basic affordance depend
       on a transition completing. `active` only brightens it. */
    <div
      ref={railRef}
      onClick={onRailClick}
      aria-hidden
      className={`fixed right-0 top-0 z-[90] h-screen w-3 transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-35'
      }`}
      style={{ paddingTop: RAIL_INSET }}
    >
      <div
        ref={thumbRef}
        className="ml-auto h-24 w-[3px] bg-ak-accent/70 transition-colors duration-ak hover:bg-ak-accent"
        style={{ marginRight: 3 }}
      />
    </div>
  )
}
