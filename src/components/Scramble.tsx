import { useLayoutEffect, useRef } from 'react'

import { scrambleDuration, scrambleFrame } from '@/lib/scramble'

/** Length of the reserve-and-release height transition, in ms. */
const HEIGHT_MS = 260
/** Smallest growth worth animating, in px: a one- or two-pixel move reads as a twitch. */
const MIN_GROW = 5

/**
 * Replays `text` as noise whenever it changes - see `lib/scramble` for the timeline.
 *
 * The visible span is written directly rather than through React state: one `textContent`
 * write per frame, no re-render, and React never touches that node again because it has no
 * children. The real string is rendered beside it for assistive tech, so the scramble stays
 * purely visual.
 */
export default function Scramble({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(text)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const from = previous.current
    previous.current = text

    /* Reduced motion, first render, or a re-render that did not change the string. */
    if (from === text || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = text
      return
    }

    /*
     * This runs before paint, so a half-written element is what the browser would show. Any
     * failure has to leave the real string in place: a broken timeline must never be visible
     * as text that never arrives, or as noise that never settles.
     */
    try {
      return run(element, from, text)
    } catch (error) {
      console.error('[scramble] failed, showing the plain text:', error)
      element.textContent = text
      return undefined
    }
  }, [text])

  return (
    <>
      <span ref={ref} aria-hidden />
      <span className="sr-only">{text}</span>
    </>
  )
}

/** The effect itself, as a plain function so its throws are caught in one place. */
function run(element: HTMLSpanElement, from: string, text: string): () => void {
  /*
   * The block's height is reserved for the duration of the effect. No phase of it has the
   * shape of the string it replaces - the hold phase is one character - so left alone a
   * paragraph collapses and re-expands several times and drags the page with it.
   */
  const block = element.parentElement
  const duration = scrambleDuration(from)
  /* One pattern per run, shared by the height samples below so they measure the real noise. */
  const salt = (Math.random() * 0xffffffff) | 0
  let endHeight = 0
  let restoreBox: (() => void) | undefined
  let settleTimer = 0

  if (block) {
    /* Measured against `from`, not against whatever the element happens to hold: a second
       switch mid-effect would otherwise measure the previous run's noise. */
    element.textContent = from
    const startHeight = block.offsetHeight
    element.textContent = text
    endHeight = block.offsetHeight

    /*
     * Reserve height from the noise itself, sampled inside the break phase, rather than from a
     * worst case: laying every glyph out at its widest reserved about a third more room than
     * the effect ever uses. The noise keeps each character's case and script, so it sits close
     * to the string it replaces.
     */
    let maxHeight = Math.max(startHeight, endHeight)
    for (const at of [0.05, 0.11, 0.18]) {
      element.textContent = scrambleFrame(from, text, duration * at, salt)
      maxHeight = Math.max(maxHeight, block.offsetHeight)
    }
    /* If it grows at all, grow by at least `MIN_GROW` - otherwise the transition is a twitch. */
    if (maxHeight > startHeight) maxHeight = Math.max(maxHeight, startHeight + MIN_GROW)

    const inline = {
      height: block.style.height,
      overflow: block.style.overflow,
      transition: block.style.transition,
    }
    restoreBox = () => {
      block.style.height = inline.height
      block.style.overflow = inline.overflow
      block.style.transition = inline.transition
    }

    block.style.overflow = 'hidden'
    block.style.height = `${startHeight}px`
    // Flush the write above, or the one below jumps instead of transitioning.
    void block.offsetHeight
    block.style.transition = `height ${HEIGHT_MS}ms var(--ak-ease)`
    block.style.height = `${maxHeight}px`
  }

  const finish = () => {
    element.textContent = text
    if (block && restoreBox) {
      block.style.height = `${endHeight}px`
      settleTimer = window.setTimeout(restoreBox, HEIGHT_MS + 40)
    }
  }

  let frame = 0
  const start = performance.now()
  const tick = (now: number) => {
    try {
      const elapsed = now - start
      if (elapsed >= duration) {
        finish()
        return
      }
      element.textContent = scrambleFrame(from, text, elapsed, salt)
      frame = requestAnimationFrame(tick)
    } catch (error) {
      /* Same reason as the caller's guard: never strand the element on noise. */
      console.error('[scramble] failed mid-effect, showing the plain text:', error)
      finish()
    }
  }

  element.textContent = scrambleFrame(from, text, 0, salt)
  frame = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(frame)
    window.clearTimeout(settleTimer)
    restoreBox?.()
  }
}
