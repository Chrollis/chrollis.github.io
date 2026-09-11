import { useEffect, useRef } from 'react'

/**
 * Custom cursor: a dot at the exact pointer position, and four corner ticks on a frame
 * that trails slightly behind. The ticks reuse the `.ak-corners` vocabulary that already
 * marks the site's panels.
 *
 * At rest the frame turns slowly. Over anything interactive it stops, squares up, and
 * outlines the element if that element is small enough to be worth outlining. Inside a
 * framed element the pointer pushes the frame a little and it settles back.
 *
 * The blend constrains the markup: `mix-blend-mode: difference` sits on `.ak-cursor`,
 * which must therefore never be transformed, faded or filtered (each creates a stacking
 * group and breaks the inversion). Every moving part is a descendant. See `docs/DESIGN.md`.
 *
 * Cost: one rAF loop writing three custom properties and two transforms. `closest()` runs
 * only when the event target changes; the framed rect is re-read every frame.
 */

/** Fraction of the remaining distance closed per frame while the frame tracks the pointer. */
const TRAIL = 0.22
/** The same onto a framed element. Slower: the travel *is* the effect. */
const LOCK_TRAIL = 0.14
/**
 * How far a value must move before it is written to the DOM - sub-pixel, so nothing
 * visible is skipped, but a settled frame stops writing. Not a snap to the target, which
 * would cancel the trailing motion.
 */
const EPSILON = 0.05

/** Half-extent of the frame when idle - a 14px square. */
const IDLE_HALF = 7
/** The same, over something too large to outline. */
const HOVER_HALF = 20
/** How far outside an element's own bounds the frame sits when framing one. */
const LOCK_OUTSET = 3
/** Floor on a framed half-extent, so a hairline element still gets a frame. */
const MIN_LOCK_HALF = 7
/**
 * Largest element that will be framed, in px. Above this the corners read as the cursor
 * having been swallowed, so large surfaces still stop the spin but are not outlined. The
 * widest thing on the site that wants framing is a two-column button at ~300px.
 */
const MAX_FRAMED = 320

/** One full turn of the idle frame, in ms. */
const SPIN_PERIOD = 9000
/** Fraction of the remaining angle closed per frame when settling axis-aligned. */
const ROTATE_EASE = 0.16

/** Scale the frame takes while the button is held. */
const PRESS_SCALE = 0.86
const SCALE_EASE = 0.25

/**
 * How much of a pointer movement is passed to a framed cursor, and how fast it decays:
 * the slack in the lock. Without it the frame is welded to the element and says nothing
 * about where the pointer is inside.
 *
 * Applied to the **drawn position, not the eased target** - through the position easing
 * as well, a measured 10px move produced 1px. Applied directly it gives about 4px.
 */
const NUDGE_GAIN = 0.25
const NUDGE_DECAY = 0.9
const NUDGE_LIMIT = 18

const TAU = Math.PI * 2

/**
 * Detected rather than annotated, so the cursor works on every link and button without
 * anything to remember. `[data-cursor]` is the escape hatch for anything else clickable.
 */
const INTERACTIVE =
  'a, button, input, textarea, select, summary, label, [role="button"], [data-cursor]'

export default function Cursor() {
  const rootRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const reticleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /* Fine pointers only: on touch there is no cursor to replace and no hover to
       report, and the class that hides the native cursor would leave none at all. */
    if (!window.matchMedia('(pointer: fine)').matches) return

    const root = rootRef.current
    const dot = dotRef.current
    const reticle = reticleRef.current
    if (!root || !dot || !reticle) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /* The pointer itself, and the frame's own centre, which trails it. */
    let pointerX = 0
    let pointerY = 0
    let centreX = 0
    let centreY = 0

    /*
     * Frame shape and orientation, all driven here. Every one is a continuous value that
     * has to be interpolated, and a CSS transition would be re-triggered by each frame's
     * write, so the frame would never arrive anywhere. Everything is eased in the loop.
     */
    let angle = 0
    let halfX = IDLE_HALF
    let halfY = IDLE_HALF
    let scale = 1

    /*
     * Slack in the lock: a framed cursor sits on the element's centre, so without this it
     * would say nothing about where the pointer is inside. Pointer movement displaces it
     * and the displacement decays, so the frame lurches slightly and settles back.
     */
    let nudgeX = 0
    let nudgeY = 0

    /** The element being framed, if the pointer is over one worth framing. */
    let framed: Element | null = null

    /* Last written values, so a settled cursor stops touching the DOM. */
    let drawnDotX = Number.NaN
    let drawnDotY = Number.NaN
    let drawnCentreX = Number.NaN
    let drawnCentreY = Number.NaN
    let drawnAngle = Number.NaN
    let drawnHalfX = Number.NaN
    let drawnHalfY = Number.NaN
    let drawnScale = Number.NaN

    let placed = false
    let visible = false
    let pressed = false
    let overTarget = false
    let lastTarget: EventTarget | null = null
    let lastTime = 0
    let frame = 0

    const paintState = () => {
      const next = pressed ? 'press' : overTarget ? 'hover' : 'idle'
      if (root.dataset.state !== next) root.dataset.state = next
    }

    const show = () => {
      if (visible) return
      visible = true
      root.dataset.visible = 'true'
    }

    const hide = () => {
      if (!visible) return
      visible = false
      root.dataset.visible = 'false'
      /* Forgotten deliberately: otherwise the frame sweeps across the page from wherever
         the cursor left, which reads as a stray animation. */
      placed = false
    }

    /**
     * The nearest half turn to `value`, in radians. A half turn, not a quarter: a frame
     * holding a rectangle is a different rectangle at 90 degrees, while 180 maps it onto
     * itself and permutes the four L-corners correctly - so the frame turns at most 90
     * degrees to square up, never 135.
     */
    const axisAligned = (value: number) => Math.round(value / Math.PI) * Math.PI

    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - pointerX
      const dy = event.clientY - pointerY
      pointerX = event.clientX
      pointerY = event.clientY

      if (!placed) {
        centreX = pointerX
        centreY = pointerY
        placed = true
      }

      /* Applied here rather than in the loop because it is the *movement* that does it,
         not the passage of time - a still pointer must not drift. */
      if (framed !== null && !reduced) {
        nudgeX = Math.max(
          -NUDGE_LIMIT,
          Math.min(NUDGE_LIMIT, (nudgeX + dx * NUDGE_GAIN) * NUDGE_DECAY),
        )
        nudgeY = Math.max(
          -NUDGE_LIMIT,
          Math.min(NUDGE_LIMIT, (nudgeY + dy * NUDGE_GAIN) * NUDGE_DECAY),
        )
      }

      show()

      /*
       * `closest()` runs on target changes only, not on every move: its answer can only
       * change when the target does. The rect is not read here - the loop reads it every
       * frame, so a control that moves under a still pointer is still followed.
       */
      if (event.target !== lastTarget) {
        lastTarget = event.target
        const hit = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null
        const next = hit !== null

        /* A small control gets its corners marked; a large surface gets the stopped spin
           only, because corners at its edges say nothing except "the cursor has gone". */
        const box = hit?.getBoundingClientRect()
        const frameable =
          box && box.width <= MAX_FRAMED && box.height <= MAX_FRAMED && box.width > 0 ? hit : null

        if (frameable !== framed) {
          framed = frameable
          /* Slack is a property of holding *this* frame, so it resets with it. */
          nudgeX = 0
          nudgeY = 0
        }

        if (next !== overTarget) {
          overTarget = next
          paintState()
        }
      }
    }

    const onPointerDown = () => {
      pressed = true
      paintState()
    }

    const onPointerUp = () => {
      pressed = false
      paintState()
    }

    /* `relatedTarget` is null only when the pointer left the document entirely, unlike a
       move between two elements - a `pointerout` on the way elsewhere must not hide it. */
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) hide()
    }

    const onBlur = () => hide()
    const onVisibility = () => {
      if (document.hidden) hide()
    }

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)

      /* Clamped: a background tab stops delivering frames, so the first one after
         returning would otherwise advance the spin by the whole absence. */
      const elapsed = lastTime === 0 ? 16 : Math.min(64, time - lastTime)
      lastTime = time

      /*
       * Read per frame while locked, not once at lock time: a control can move under a
       * stationary pointer, and a rect read once leaves the frame behind. Every DOM read
       * for the frame happens here, before the writes at the foot of the loop, so layout
       * is resolved once.
       */
      const rect = framed?.getBoundingClientRect()
      const locked = rect !== undefined && rect.width > 0

      /* Locked: the element's centre and corners. Otherwise: the pointer, as a square -
         one size over something too large to outline, a smaller one at rest. */
      const targetX = locked ? rect.left + rect.width / 2 : pointerX
      const targetY = locked ? rect.top + rect.height / 2 : pointerY
      const wantHalfX = locked
        ? Math.max(MIN_LOCK_HALF, rect.width / 2 + LOCK_OUTSET)
        : overTarget
          ? HOVER_HALF
          : IDLE_HALF
      const wantHalfY = locked
        ? Math.max(MIN_LOCK_HALF, rect.height / 2 + LOCK_OUTSET)
        : overTarget
          ? HOVER_HALF
          : IDLE_HALF

      /*
       * Any interactive target counts, not just one being framed: the spin says "nothing
       * here", and over a control the frame should become a marking whether or not it is
       * small enough to outline. Keyed on the lock alone, hovering a large button changed
       * nothing but its size, which is not a cue.
       */
      const attending = locked || overTarget

      /*
       * Idle spin accumulated by TIME, not per frame: a fixed increment would turn twice
       * as fast on a 120Hz display, which only shows up on someone else's machine.
       */
      if (!attending && !reduced) angle += (elapsed / SPIN_PERIOD) * TAU

      /*
       * Attending, the target is the nearest half turn. The difference is folded into one
       * half turn first: the angle is unwrapped and may be several turns out after
       * spinning, so easing the raw difference would unwind the frame the long way round.
       */
      if (attending || reduced) {
        const want = attending ? axisAligned(angle) : 0
        let delta = want - angle
        delta -= TAU * Math.round(delta / TAU)
        angle += delta * (reduced ? 1 : ROTATE_EASE)
      }

      /* Extents ease rather than snap, so a frame opening onto a wide button grows into
         its shape instead of appearing there. */
      const extentEase = reduced ? 1 : locked ? LOCK_TRAIL : TRAIL
      halfX += (wantHalfX - halfX) * extentEase
      halfY += (wantHalfY - halfY) * extentEase

      /*
       * Position. Slower onto a frame than onto the pointer, because the travel is the
       * effect. The slack is NOT eased in here - it is applied to the drawn position
       * below, having already been damped once; through the easing as well it was
       * attenuated twice and a 10px move became 1px.
       */
      const positionEase = reduced ? 1 : locked ? LOCK_TRAIL : TRAIL
      centreX += (targetX - centreX) * positionEase
      centreY += (targetY - centreY) * positionEase

      /* The slack bleeds off here, so it eases away rather than jumping when the pointer
         stops. */
      if (locked) {
        nudgeX *= NUDGE_DECAY
        nudgeY *= NUDGE_DECAY
      } else {
        nudgeX = 0
        nudgeY = 0
      }

      /* Where the frame is actually drawn: the eased centre plus whatever slack is left.
         One says where the element is, the other where in it the pointer went. */
      const drawX = centreX + nudgeX
      const drawY = centreY + nudgeY

      const wantScale = pressed ? PRESS_SCALE : 1
      scale += (wantScale - scale) * (reduced ? 1 : SCALE_EASE)

      /*
       * Snapped once it has arrived, so the loop goes quiet. Compared against the eased
       * target rather than the drawn position: the slack may still be non-zero and must
       * not be cancelled by this.
       */
      if (Math.abs(targetX - centreX) < EPSILON) centreX = targetX
      if (Math.abs(targetY - centreY) < EPSILON) centreY = targetY

      if (pointerX !== drawnDotX || pointerY !== drawnDotY) {
        dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`
        drawnDotX = pointerX
        drawnDotY = pointerY
      }

      if (drawX !== drawnCentreX || drawY !== drawnCentreY) {
        reticle.style.transform = `translate3d(${drawX}px, ${drawY}px, 0)`
        drawnCentreX = drawX
        drawnCentreY = drawY
      }

      /* Three custom properties rather than one transform: the frame has to rotate AND
         resize along two independent axes with the corners at those extents. As a single
         transform that means composing rotation with scale, which resizes the 1px strokes
         and skews the ticks; the properties are read by `left/right/top/bottom` instead. */
      if (halfX !== drawnHalfX || halfY !== drawnHalfY) {
        root.style.setProperty('--ak-cursor-x', `${halfX}px`)
        root.style.setProperty('--ak-cursor-y', `${halfY}px`)
        drawnHalfX = halfX
        drawnHalfY = halfY
      }
      if (angle !== drawnAngle) {
        root.style.setProperty('--ak-cursor-angle', `${angle}rad`)
        drawnAngle = angle
      }
      if (scale !== drawnScale) {
        root.style.setProperty('--ak-cursor-scale', String(scale))
        drawnScale = scale
      }
    }

    /*
     * The class, not a stylesheet rule: the native cursor is hidden only once this script
     * is running and has something to put in its place. Hidden by CSS, a bundle that
     * failed to load would leave the site with no pointer at all.
     */
    document.documentElement.classList.add('ak-cursor-active')

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    document.addEventListener('pointerout', onPointerOut)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      document.documentElement.classList.remove('ak-cursor-active')
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="ak-cursor"
      data-visible="false"
      data-state="idle"
      aria-hidden="true"
    >
      {/* The exact point, no trail - a cursor that lagged on its own tip feels broken. */}
      <div ref={dotRef} className="ak-cursor-dot" />

      {/* The trailing frame. Its transforms are driven by the loop above. */}
      <div ref={reticleRef} className="ak-cursor-reticle">
        <div className="ak-cursor-brackets">
          <i className="ak-cursor-arm" data-corner="tl" />
          <i className="ak-cursor-arm" data-corner="tr" />
          <i className="ak-cursor-arm" data-corner="br" />
          <i className="ak-cursor-arm" data-corner="bl" />
        </div>
      </div>
    </div>
  )
}
