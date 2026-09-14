import { useEffect, useRef } from 'react'

/**
 * Dot matrix background: a dense grid of dots breathing between dim and lit, pulled
 * toward the pointer and springing back.
 *
 * A 2D canvas on purpose, not WebGL - a few dozen batched `arc` fills per frame is well
 * inside budget. Holding the button seats free dots on concentric tracks. Motion is
 * decoration only, so a dropped frame is harmless. Geometry and ladder reasoning:
 * `docs/DESIGN.md`, "The background field".
 */

/** The frame length every motion constant in this file is tuned for. */
const REF_DT = 1000 / 60
/** Longest step worth applying, in ms: a hidden tab must not teleport the field on return. */
const MAX_DT = 64
/**
 * A fraction-per-frame constant, rescaled for a frame that lasted `frames` reference
 * frames. Applied n times it leaves `(1 - k)^n`, so matching wall-clock motion needs
 * `(1 - k)^frames` - which is what this returns. At 60Hz `frames` is 1 and it is a no-op.
 */
const perFrame = (k: number, frames: number) => 1 - Math.pow(1 - k, frames)

/** Distance between dots, in CSS pixels. */
const CELL = 26
const DOT_RADIUS = 1.2

/** Resting and fully lit opacities. */
const BASE_ALPHA = 0.16
const LIT_ALPHA = 0.72
/** How fast a dot eases toward its resting target. */
const EASE = 0.045
/** Chance per frame that a dot picks a new target. */
const RETARGET_CHANCE = 0.005
/** Share of dots painted in the secondary accent. */
const TEAL_RATIO = 0.14

/* Pointer physics: anything within ATTRACT_RADIUS is pulled in; inside CAPTURE_RADIUS a
 * dot is seated on a track, where its position is interpolated in polar form rather than
 * integrated from a force. */
/** Outer edge of the attraction field, in CSS pixels. */
const ATTRACT_RADIUS = 82
/**
 * Peak inward acceleration at the cursor, in px per frame squared, falling off as
 * `(1 - r/ATTRACT_RADIUS)^2`. The direction is normalised before multiplying, so the
 * push depends on falloff only - multiplying by the separation would shove far dots
 * hardest and pile the whole neighbourhood onto the cursor.
 */
const ATTRACT_FORCE = 3
/**
 * Spacing between concentric tracks, in CSS pixels: track `i` sits at
 * `RING_STEP * (i + 1)`, so 12, 24, 36, 48... 12 is half a grid cell, which puts every
 * track on a line the grid behind it already draws.
 *
 * There is deliberately **no upper bound**: a fixed set of tracks leaves an arriving dot
 * with nowhere to go, so it stays free, drifts inward and piles onto the cursor.
 */
const RING_STEP = 12
/** Radius of track `track`, counting from zero. */
const trackRadius = (track: number) => RING_STEP * (track + 1)
/**
 * How many dots track `track` may hold: half its radius, rounded down, so 6, 12, 18,
 * 24... A track of radius r holding r/2 dots has `2*pi*r / (r/2)` = `4*pi` between
 * neighbours - about 12.6px at *every* radius, so all tracks read at one density. A fixed
 * count per track would crowd the inner ring into a solid band.
 */
const trackCapacity = (track: number) => Math.floor(trackRadius(track) / 2)
/**
 * Radius within which a free dot is captured: three cells, fixed, and it must **not**
 * follow the outermost ring. Letting it follow is a positive feedback loop - bigger rings
 * capture further out, catch more dots, fill more rings, grow further.
 */
const CAPTURE_RADIUS = RING_STEP * 3
/**
 * Fraction of the remaining angular error a captured dot closes per frame: exponential,
 * about 40 frames from the far side of the ring. Small on purpose - a just-caught dot
 * should look drawn round to its place, not snapped there.
 */
const SLOT_EASE = 0.08
/**
 * Fraction of the remaining radial error closed per frame. Separate from `SLOT_EASE` so
 * a dot lands on the correct radius more crisply than it travels round it; 0.16 settles
 * in about fifteen frames.
 */
const RING_EASE = 0.16
/**
 * Angular speed of the 24px track, in radians per frame - the reference for every other
 * track. Deliberately slow (a revolution in about 70 seconds): at speed a ring reads as a
 * loading spinner, and the rotation only exists to show the field is alive.
 */
const ORBIT_SPEED = 0.0015
/** Radius the reference angular speed is quoted at: the 24px track. */
const ORBIT_REF_RADIUS = RING_STEP * 2
/**
 * `omega = ORBIT_REF_RADIUS / r` keeps every ring's *linear* speed constant. A constant
 * angular speed makes a big ring look spun and a small one merely turned.
 */
const trackSpeed = (track: number) => (ORBIT_SPEED * ORBIT_REF_RADIUS) / trackRadius(track)
/**
 * Which way a track turns, by parity, so neighbours never turn the same way - two rings
 * running against each other cannot be mistaken for one object. Canvas y grows downward,
 * so a rising angle is clockwise and `+1` puts the innermost ring on +1.
 */
const trackSpin = (track: number) => ((track + 1) % 2 === 1 ? 1 : -1)
/**
 * The shortest signed angle between two directions, folded into `[-pi, pi)`.
 *
 * It has to fold **repeatedly**, not once: both a dot's `angle` and its track's `phase`
 * are wrapped into `[0, 2pi)`, so their difference can span a full turn and the obvious
 * `if (error > pi) error -= 2pi` can leave a value still past pi - a clockwise ring then
 * appears to step backwards.
 */
const shortestAngle = (angle: number) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
/**
 * An angle folded into `[0, 2pi)`. Live angles and phases are accumulated, so without
 * this a long drag spends the mantissa on whole turns. Unlike `shortestAngle`, this is an
 * absolute bearing rather than a direction to travel.
 */
const wrapAngle = (angle: number) => {
  const wrapped = angle % (Math.PI * 2)
  return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped
}
/**
 * Opacity a spoke reaches at the cursor and at the outermost occupied ring. All spokes
 * share one radial gradient centred on the cursor, so opacity depends on *distance from
 * the cursor* rather than on the ring - which is what reads as depth.
 *
 * The centre is fully transparent on purpose: every ring's spokes meet there, so the
 * pixels near it are covered by all of them at once and no per-ring opacity can remove
 * the resulting blot.
 */
const SPOKE_ALPHA_CENTER = 0
const SPOKE_ALPHA_OUTER = 0.45
/**
 * Cursor speed, in px per frame, past which the rings release everything - about
 * 1080px/s, an ordinary sweep comfortably below a flick. Frames because it is only ever
 * compared against the per-frame displacement the loop already computes.
 */
const BREAK_SPEED = 18
/**
 * Spring pulling a free dot home. Gentle: it only reels in dots the ring let go, so it
 * should read as finding its way back rather than being snapped.
 */
const SPRING = 0.035
/**
 * Velocity retained per frame by a free dot - freer than the ring's damping, so a
 * released dot coasts and a break reads as a break. Not *that* free: at 0.9 a dot let go
 * at 25px/frame carried past 550px. Under 1, so it settles.
 */
const DAMPING = 0.82
/** Extra brightness at the pointer's centre. */
const GLOW_BOOST = 0.5
/** How fast the pointer's influence catches up with the real cursor. */
const POINTER_EASE = 0.35
/**
 * How much a dot's radius grows on top of its alpha boost, applied per dot from its own
 * `boost` - **never** from the bare flag that says a pointer exists, which grew every dot
 * in the field by 14% the moment the cursor entered the window.
 */
const POINTER_GLOW = 0.28

/** Above this, the extra device pixels cost more than they show. */
const MAX_DPR = 2

/** Alpha steps used for batching. More is prettier, fewer is faster. */
const ALPHA_BUCKETS = 32

/** The brightest alpha a dot is ever drawn at. Also the ladder's top rung. */
const MAX_DRAW_ALPHA = 0.95

/**
 * Alpha ladder for batching: geometric, not linear. Dots are grouped by opacity so a
 * couple of thousand cost a couple of dozen `fill` calls, and grouping quantises - a dot
 * crossing a step boundary changes brightness in one frame.
 *
 * The rungs must be evenly spaced in *ratio*: the eye reads brightness as a ratio and
 * almost every dot here is dark, so a linear ladder is worst exactly where the field
 * lives. A geometric ladder puts ~11% between rungs and drops a resting dot's error to
 * 2.4%. Cost is negligible next to the canvas work, and ~20% per rung is where a step
 * starts to read as flicker - prefer more rungs.
 */
const BUCKET_MIN_ALPHA = 0.045
/** Ratio between adjacent rungs. */
const BUCKET_RATIO = Math.pow(MAX_DRAW_ALPHA / BUCKET_MIN_ALPHA, 1 / (ALPHA_BUCKETS - 1))
/** ln of the ratio, for the inverse lookup below. */
const BUCKET_LOG = Math.log(BUCKET_RATIO)

/** The opacity a bucket is painted at: its own rung of the ladder. */
const bucketAlpha = (index: number) => BUCKET_MIN_ALPHA * Math.pow(BUCKET_RATIO, index)

/** Which rung an alpha belongs to: the inverse of `bucketAlpha`, clamped at both ends. */
const bucketIndex = (alpha: number) => {
  if (alpha <= BUCKET_MIN_ALPHA) return 0
  if (alpha >= MAX_DRAW_ALPHA) return ALPHA_BUCKETS - 1
  return Math.min(ALPHA_BUCKETS - 1, Math.round(Math.log(alpha / BUCKET_MIN_ALPHA) / BUCKET_LOG))
}

const YELLOW = '#ffd100'
const TEAL = '#00b3a4'

/**
 * `alpha -> bucket`, as a table. `bucketIndex` is a logarithm and it ran once per dot per
 * frame; 1/256 of the alpha range is far finer than the ~11% between rungs.
 */
const BUCKET_LUT_SIZE = 256
const BUCKET_LUT = new Uint8Array(BUCKET_LUT_SIZE)
for (let i = 0; i < BUCKET_LUT_SIZE; i++) BUCKET_LUT[i] = bucketIndex(i / BUCKET_LUT_SIZE)

interface Dot {
  /** Home position. The dot always springs back to this. */
  hx: number
  hy: number
  /** Current position, displaced by the pointer. */
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  target: number
  teal: boolean
  /**
   * True while the dot is tethered to the cursor's ring. Persistent state, not a
   * per-frame local: it is captured on one frame and released on a later one, and it is
   * the only thing choosing between the two branches in `step`. A resize must carry it.
   */
  bound: boolean
  /**
   * Which track this dot sits on, or -1 if free. Chosen at capture and kept until
   * release - unlike `slot` it is not rewritten every frame, or a dot would visibly jump
   * radius. Unbounded: tracks are numbered from the cursor outward.
   */
  track: number
  /**
   * Which evenly spaced position on its track this dot occupies, or -1 if free.
   * Renumbered from scratch every frame per track, so each track's indices stay a dense
   * run `0..occupied[track]-1`. Maintaining them incrementally leaves a hole when a dot
   * in the middle is released.
   */
  slot: number
  /**
   * Angle around the cursor, in radians, while bound. Held as an angle rather than
   * recomputed with `atan2` each frame, which would fold it back into -PI..PI and make
   * the ring's own rotation indistinguishable from a dot taking the long way round.
   */
  angle: number
  /**
   * Distance from the cursor while bound, in px. A live animation value: it starts at the
   * radius the dot was caught at and eases onto its track's radius, so it is kept per dot
   * rather than derived from `track`.
   */
  orbit: number
}

export default function DotMatrix({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let dots: Dot[] = []
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let frame = 0
    /** Timestamp of the previous frame, for the delta-time scaling in `step`. */
    let lastTime = 0

    /** Set when the element's size changed and `build` has not caught up yet. */
    let rebuildPending = false

    /* Pointer state. The `active` flag matters: without it an absent pointer reads as
       (0, 0) and drags the field toward the top-left corner. `px`/`py` is what the field
       follows, eased toward `pointerX`/`pointerY` once per frame.
       `down` is separate from `active`: hovering must not disturb a field meant to sit
       quietly behind the text - only a press attracts, captures or draws spokes. */
    let pointerX = 0
    let pointerY = 0
    let px = 0
    let py = 0
    let pointerActive = false
    let pointerDown = false

    /*
     * `occupied[track]` is how many dots are on that track, so angles divide by the
     * dots on *that* ring rather than by the total. `phase[track]` is the track's
     * accumulated rotation, read by every dot on it - which is what makes a ring turn as
     * one body. Sparse and unbounded, so reads go through `?? 0`; not cleared on
     * release, so a re-grabbed ring resumes where it left off.
     */
    const occupied: number[] = []
    /** Accumulated rotation of each track, in radians. */
    const phase: number[] = []
    /** Scratch list of the bound dots, reused each frame so nothing is allocated. */
    const ringDots: Dot[] = []

    /*
     * Alpha buckets, allocated once and reused. One object and two points-lists per rung,
     * rebuilt every frame, was the largest single source of garbage in the loop; truncating
     * the lists instead lets V8 keep their backing store.
     */
    const buckets = Array.from({ length: ALPHA_BUCKETS }, (_, index) => ({
      alpha: bucketAlpha(index),
      yellow: [] as number[],
      teal: [] as number[],
    }))

    /** Deterministic pseudo-random, so the grid is stable across rebuilds. */
    let seed = 0x9e3779b9
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x100000000
    }

    /**
     * Colour of the cursor spokes, as bare `R G B` components read from `--ak-text`, so
     * the spokes are near white on dark and near black on light with no second branch.
     * Cached and refreshed only on a theme change - `getComputedStyle` forces a style
     * recalculation and would otherwise run 60 times a second.
     */
    let inkRgb = '242 242 242'
    const readInk = () => {
      inkRgb = getComputedStyle(canvas).getPropertyValue('--ak-text').trim() || '242 242 242'
    }
    readInk()

    /**
     * A dot's resting brightness: the one place that decides it. Both `build` and `step`
     * call this, and that sharing is the point - rolling independently at two thresholds
     * gave two distributions, so the field was not stationary and visibly regenerated
     * itself once. One function makes stationarity structural.
     *
     * The trailing factor keeps variety among lit dots; a binary on/off reads as a grid
     * of LEDs rather than a field.
     */
    const rollTarget = () => (rand() > 0.78 ? LIT_ALPHA * (0.72 + rand() * 0.28) : BASE_ALPHA)

    /** Grid dimensions depend only on where a dot belongs, so a rebuild keeps the layout stable. */
    const layout = () => {
      cols = Math.max(1, Math.round(width / CELL)) + 1
      rows = Math.max(1, Math.round(height / CELL)) + 1
    }

    /**
     * Resize the backing store if needed and build the grid. A dot is identified by its
     * grid position and its `alpha`/`target` are carried across, or dragging a window
     * edge would restart the whole field at its seed values every frame.
     */
    const build = () => {
      rebuildPending = false

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      width = canvas.clientWidth
      height = canvas.clientHeight

      const backingWidth = Math.max(1, Math.round(width * dpr))
      const backingHeight = Math.max(1, Math.round(height * dpr))
      if (canvas.width !== backingWidth) canvas.width = backingWidth
      if (canvas.height !== backingHeight) canvas.height = backingHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const prevCols = cols
      const prevRows = rows
      const prevDots = dots
      layout()

      seed = 0x9e3779b9
      dots = []

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * CELL
          const y = row * CELL

          let carried: Dot | undefined
          /* Look the dot up by grid position in the previous build. The index uses the
             OLD column count, because that is how the old array was laid out. */
          if (prevDots.length && col < prevCols && row < prevRows) {
            carried = prevDots[row * prevCols + col]
          }

          if (carried) {
            dots.push({ ...carried, hx: x, hy: y })
            continue
          }

          /* A new dot: first build, or a cell revealed by growing the element. `teal` is
             drawn from the same stream unconditionally, so the sequence stays aligned
             with the cell count rather than the survivor count. */
          const target = rollTarget()
          const teal = rand() < TEAL_RATIO
          dots.push({
            hx: x,
            hy: y,
            x,
            y,
            vx: 0,
            vy: 0,
            /* Starts AT its target - safe only because `target` comes from the same
               distribution the loop retargets with. The first frame is already settled. */
            alpha: target,
            target,
            teal,
            bound: false,
            track: -1,
            slot: -1,
            /* Set from the dot's position when it is caught. */
            angle: 0,
            orbit: 0,
          })
        }
      }
    }

    /**
     * Batch by (colour, alpha bucket): one path per bucket means a couple of dozen fill
     * calls per frame instead of a couple of thousand. The pointer position and glow
     * arrive as arguments because this also runs outside the loop, for the reduced-motion
     * frame and for a resize while paused.
     */
    const draw = (atX: number, atY: number, pointerGlow: number) => {
      ctx.clearRect(0, 0, width, height)

      /* Truncate rather than reallocate; see the note where `buckets` is declared. */
      for (const bucket of buckets) {
        bucket.yellow.length = 0
        bucket.teal.length = 0
      }

      /* Radius is a constant: scaling it by a frame-rate metric made a slightly long
         frame strobe the whole field, and it saved no work. */
      const radiusBase = DOT_RADIUS

      /* Spokes: a dashed line from the cursor to each bound dot, drawn first and as one
         path - they share a width, a dash pattern and a gradient. The outer radius is the
         outermost occupied ring, so the ramp always spans the pattern's current depth.
         `ringDots` already holds every bound dot, filled by `step`, so this needs no scan
         of the whole field. */
      let outermost = -1
      for (const dot of ringDots) {
        if (dot.track > outermost) outermost = dot.track
      }

      if (outermost >= 0) {
        const gradient = ctx.createRadialGradient(atX, atY, 0, atX, atY, trackRadius(outermost))
        gradient.addColorStop(0, `rgb(${inkRgb} / ${SPOKE_ALPHA_CENTER})`)
        gradient.addColorStop(1, `rgb(${inkRgb} / ${SPOKE_ALPHA_OUTER})`)

        ctx.save()
        ctx.lineWidth = 1
        ctx.strokeStyle = gradient
        /* 2 on, 3 off: at 1px a spoke reads as a measurement leader, not a rod. */
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        for (const dot of ringDots) {
          ctx.moveTo(atX, atY)
          ctx.lineTo(dot.x, dot.y)
        }
        ctx.stroke()
        ctx.restore()
      }

      /* Squared once: the comparison below runs for every dot, and the square root is only
         paid by the few dots actually inside the radius. */
      const captureSq = CAPTURE_RADIUS * CAPTURE_RADIUS
      for (const dot of dots) {
        let boost = 0
        if (pointerGlow) {
          if (dot.bound) {
            /* Bound dots are fully lit - they are what the cursor is touching. */
            boost = pointerGlow
          } else {
            /* Free dots fade in over the last stretch of the capture radius, so the
               capture point is visible before the tether forms. */
            const dx = dot.x - atX
            const dy = dot.y - atY
            const distSq = dx * dx + dy * dy
            if (distSq < captureSq) boost = pointerGlow * (1 - Math.sqrt(distSq) / CAPTURE_RADIUS)
          }
        }

        const alpha = Math.min(MAX_DRAW_ALPHA, dot.alpha + boost)
        if (alpha < BUCKET_MIN_ALPHA * 0.5) continue

        const index = BUCKET_LUT[Math.min(BUCKET_LUT_SIZE - 1, (alpha * BUCKET_LUT_SIZE) | 0)]
        const bucket = buckets[index]
        const points = dot.teal ? bucket.teal : bucket.yellow
        // Each dot's own falloff, so only dots near the cursor swell.
        points.push(dot.x, dot.y, radiusBase * (1 + POINTER_GLOW * boost))
      }

      for (const bucket of buckets) {
        ctx.globalAlpha = Math.min(1, bucket.alpha)

        for (const [colour, points] of [
          [YELLOW, bucket.yellow],
          [TEAL, bucket.teal],
        ] as const) {
          if (points.length === 0) continue
          ctx.fillStyle = colour
          ctx.beginPath()
          for (let i = 0; i < points.length; i += 3) {
            ctx.moveTo(points[i] + points[i + 2], points[i + 1])
            ctx.arc(points[i], points[i + 1], points[i + 2], 0, Math.PI * 2)
          }
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
    }

    const step = (time: number) => {
      frame = requestAnimationFrame(step)

      /* A pending resize is applied before anything moves, so the element and the
         backing store are never briefly out of step. */
      if (rebuildPending) build()

      /*
       * Frame-rate independence. Every constant in this file is tuned as "per 60Hz frame",
       * so each frame is measured and turned into how many reference frames it lasted. At
       * 60Hz `frames` is 1 and none of this changes anything; at 120Hz the steps halve and
       * at 30Hz they double, so the field moves at the same speed on any display. `MAX_DT`
       * stops a background tab from teleporting everything on return.
       *
       * Exact for the easing fractions, the orbit and the random retarget, because those
       * compose by multiplication. The spring and the attraction are a semi-implicit Euler
       * step, so scaling them is the usual approximation rather than an identity - the
       * transient is indistinguishable and the decay envelope (`damping`) is exact.
       */
      /* Clamped at both ends: `MAX_DT` stops a background tab from teleporting the field,
         and the 1ms floor stops a duplicate timestamp from making `frames` zero - which
         would divide the cursor speed by it. */
      const dt = lastTime === 0 ? REF_DT : Math.min(Math.max(time - lastTime, 1), MAX_DT)
      lastTime = time
      const frames = dt / REF_DT
      const ease = perFrame(EASE, frames)
      const pointerEase = perFrame(POINTER_EASE, frames)
      const slotEase = perFrame(SLOT_EASE, frames)
      const ringEase = perFrame(RING_EASE, frames)
      const retargetChance = perFrame(RETARGET_CHANCE, frames)
      const damping = Math.pow(DAMPING, frames)
      const spring = SPRING * frames
      const attractForce = ATTRACT_FORCE * frames

      /* Smooth the pointer: `pointermove` fires far more often than this loop runs. */
      const prevPx = px
      const prevPy = py
      px += (pointerX - px) * pointerEase
      py += (pointerY - py) * pointerEase

      /* Cursor speed, in px per *reference* frame, measured from the eased position: the
         eased value is what the field reacts to, so breaking on the raw signal would snap
         the ring during a fast arrival. Normalised by `frames`, or a 120Hz display would
         cross the break threshold half as often. Only meaningful while the button is held. */
      const cursorSpeed = pointerDown ? Math.hypot(px - prevPx, py - prevPy) / frames : 0
      const breakNow = cursorSpeed > BREAK_SPEED

      const pointerGlow = pointerDown ? GLOW_BOOST : 0

      /* Capture does not move - see CAPTURE_RADIUS. Attraction is a fixed field, so a dot
         always travels the same distance: in at the edge, caught three cells out, seated
         on whatever ring has room. */
      const attractRadius = ATTRACT_RADIUS
      /** Release distance for a dot on `track`: clear of its own ring plus a margin. */
      const releaseDistance = (track: number) => trackRadius(track) * 1.8

      /* Capture and release, before anything is numbered. Order is load-bearing: a dot
         caught this frame still carries the `-1` it was built with, so `-1 / count` is a
         permanent NaN unless counts are settled first. */
      if (!pointerDown || breakNow) {
        /* Button released, or moving too fast to hold anything: every ring is dropped
           wholesale, or captured dots stay pinned to a position the cursor has left. */
        for (const dot of dots) {
          dot.bound = false
          dot.track = -1
        }
        /* Cleared too, or stale counts keep the phase turning with nothing held. */
        occupied.length = 0
      } else {
        /*
         * Per-track occupancy from the dots bound as of last frame. Counted here rather
         * than reused from below because capture has to be decided against the current
         * state: a dot released this frame must free its seat for one arriving this frame.
         */
        occupied.length = 0
        for (const dot of dots) if (dot.bound) occupied[dot.track] = (occupied[dot.track] ?? 0) + 1

        for (const dot of dots) {
          /* Squared distance: this test runs for every dot in the field every frame, and
             `Math.hypot` is far slower than a multiply. */
          const dx = px - dot.x
          const dy = py - dot.y
          const distSq = dx * dx + dy * dy

          if (dot.bound) {
            /* Hysteresis, measured against the dot's own ring rather than one shared
               radius: a release test at the capture radius would drop a third-ring dot
               the moment it arrived at 36px. */
            const release = releaseDistance(dot.track)
            if (distSq > release * release) {
              occupied[dot.track] = (occupied[dot.track] ?? 1) - 1
              dot.bound = false
              dot.track = -1
            }
            continue
          }

          if (distSq > CAPTURE_RADIUS * CAPTURE_RADIUS) continue

          /*
           * The innermost track with a free seat: the whole "fill inside first, spill
           * outward" rule. A seat is always found because there is no last track -
           * with a fixed set of rings a surplus dot stays free and drifts inward until
           * it sits on the cursor as a bright clump. Dots are offered seats in array
           * order, which is invisible once slots are numbered by track and angle.
           */
          let track = 0
          while ((occupied[track] ?? 0) >= trackCapacity(track)) track++

          occupied[track] = (occupied[track] ?? 0) + 1
          dot.bound = true
          dot.track = track
          /* Seed the polar position from where the dot is at the instant it is caught:
             at zero, a dot caught anywhere but due east sweeps the whole way round. Both
             must be set here, before the free branch moves the dot. */
          dot.angle = Math.atan2(dot.y - py, dot.x - px)
          dot.orbit = Math.sqrt(distSq)
        }
      }

      /*
       * Number the dots in each track by angle, not by array order. Slot indices must be
       * exactly `0..count-1` per track - they are the angle divisor. Array order is grid
       * order, so capturing or releasing one dot reshuffled every other and each
       * reassigned dot swept a large arc, which looked like "no easing, it just jumps".
       * Sorting by angle makes the assignment monotone and minimum-travel.
       *
       * The rank is measured **relative to the track's own phase**. Ranking by raw
       * `angle` was a real bug: a live angle accumulates without bound while a newcomer's
       * comes from `atan2` in `[-pi, pi]`, so every newcomer sorted before every old dot
       * and took a consecutive run of slots - a packed, over-bright arc. Subtracting the
       * phase also keeps a settled dot's rank stable while the ring turns.
       *
       * Numbering the other way for a counter-clockwise ring would be a reflection: same
       * cyclic order, but every target on the opposite side.
       */
      ringDots.length = 0
      for (const dot of dots) if (dot.bound) ringDots.push(dot)
      ringDots.sort((a, b) => {
        if (a.track !== b.track) return a.track - b.track
        /*
         * Rank from half a slot ahead of the phase, not from the phase itself. A settled
         * dot trails its target by a fraction of a slot, so subtracting the phase alone
         * puts a dot on slot zero a hair below it, folding it to just under a full turn -
         * it then sorts behind every other dot and the whole ring steps one slot backwards
         * every frame. Starting from the midpoint keeps a settled dot positive.
         */
        const half = Math.PI / (occupied[a.track] ?? 1)
        const ra = wrapAngle(a.angle - (phase[a.track] ?? 0) + half)
        const rb = wrapAngle(b.angle - (phase[a.track] ?? 0) + half)
        return ra - rb
      })
      for (let i = 0; i < ringDots.length;) {
        const track = ringDots[i].track
        let end = i
        while (end < ringDots.length && ringDots[end].track === track) end++
        for (let k = i; k < end; k++) ringDots[k].slot = k - i
        i = end
      }

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i]

        /* The same roll the initial build uses, so the field stays stationary. */
        if (rand() < retargetChance) {
          dot.target = rollTarget()
        }
        dot.alpha += (dot.target - dot.alpha) * ease

        /* Attraction, for free dots only. Skipping captured dots is not an optimisation:
           the ring's radial spring has zero error on its track, so attraction would add
           ~3px/frame^2 with nothing to balance it and the equilibrium would drift inward.
           Two fields pulling one dot have to be one field. */
        if (pointerDown && !breakNow && !dot.bound) {
          const dx = px - dot.x
          const dy = py - dot.y
          const distSq = dx * dx + dy * dy
          if (distSq < attractRadius * attractRadius && distSq > 0.5) {
            const dist = Math.sqrt(distSq)
            const falloff = 1 - dist / attractRadius
            const magnitude = attractForce * falloff * falloff
            dot.vx += (dx / dist) * magnitude
            dot.vy += (dy / dist) * magnitude
          }
        }

        /* Binding was decided in the pass above, so a dot caught this frame is numbered
           with its track rather than spending a frame on the -1 it was built with. */
        if (dot.bound && (occupied[dot.track] ?? 0) > 0) {
          /*
           * Ring placement by interpolation, not force: the dot is taken to a specific
           * point in polar coordinates rather than pushed there and left to settle. As a
           * force the tangential correction reached ~43px/frame against a 151px
           * circumference, so dots lapped the ring and flew off as a four-armed star.
           * Interpolating position cannot overshoot at any stiffness, count or starting
           * angle, which leaves nothing to tune.
           */
          /* This track's accumulated phase plus the dot's share of the circle. */
          const count = occupied[dot.track] ?? 1
          const target = (phase[dot.track] ?? 0) + (dot.slot / count) * Math.PI * 2
          /* Shortest signed arc, so the dot always takes the near way round. */
          const angularError = shortestAngle(target - dot.angle)

          dot.angle = wrapAngle(dot.angle + angularError * slotEase)
          dot.orbit += (trackRadius(dot.track) - dot.orbit) * ringEase

          const nextX = px + Math.cos(dot.angle) * dot.orbit
          const nextY = py + Math.sin(dot.angle) * dot.orbit
          /* Velocity is *recorded*, not integrated, purely so a released dot leaves along
             the arc it was already travelling - the ring spinning its dots off rather
             than switching off and the dots stopping dead. Divided by `frames` so it is in
             px per reference frame, which is what the free branch integrates. */
          dot.vx = (nextX - dot.x) / frames
          dot.vy = (nextY - dot.y) / frames
          dot.x = nextX
          dot.y = nextY

          /* Placed, not moved: skip the shared integration below, which is for free dots. */
          continue
        } else {
          /* Free: home spring, then damping - see SPRING and DAMPING. */
          dot.vx += (dot.hx - dot.x) * spring
          dot.vy += (dot.hy - dot.y) * spring
          dot.vx *= damping
          dot.vy *= damping
        }

        dot.x += dot.vx * frames
        dot.y += dot.vy * frames
      }

      /* Advance each ring by its own step: per track, because they turn at different
         rates and directions, and wrapped as it goes so an unbounded angle does not
         spend its mantissa on whole turns. */
      for (let track = 0; track < occupied.length; track++) {
        if (occupied[track]) {
          phase[track] = wrapAngle(
            (phase[track] ?? 0) + trackSpin(track) * trackSpeed(track) * frames,
          )
        }
      }

      draw(px, py, pointerGlow)
    }

    /*
     * Touch drives the field again - but only because the real cause of "the page will not
     * scroll on a phone" turned out to be elsewhere: the boot overlay held a document-wide
     * scroll lock and swallowed the first gesture for up to five seconds after every load,
     * six decorative boxes were `overflow: hidden` (a scroll container on iOS, so a swipe
     * that started on one belonged to it), and `body` carried `overflow-x: hidden`, which
     * made it a scroll container in both axes. Disabling this interaction changed nothing,
     * which is what ruled it out. See `DECISIONS.md`.
     *
     * `pointercancel` is what keeps the two compatible: when the browser decides a gesture
     * is a scroll, it cancels the pointer, and without this the field kept the button down -
     * dots stayed captured and the ring stayed lit, chasing the last place the finger was
     * seen, for the rest of the session.
     */
    const onPointerMove = (event: PointerEvent) => {
      /* First sample of a session: land the eased position on the cursor. */
      if (!pointerActive) {
        px = event.clientX
        py = event.clientY
      }
      pointerX = event.clientX
      pointerY = event.clientY
      pointerActive = true
    }
    const onPointerDown = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      pointerActive = true
      /* Snap the eased position on, or a press elsewhere yanks the ring across from
         wherever the field was still following. */
      px = event.clientX
      py = event.clientY
      pointerDown = true
    }
    const onPointerUp = () => {
      /* `pointerActive` stays true so a later press starts from the right place. */
      pointerDown = false
    }
    /** The browser took the gesture over - a scroll, an edge swipe. Release everything. */
    const onPointerCancel = () => {
      pointerDown = false
      pointerActive = false
    }
    const onPointerLeave = () => {
      pointerActive = false
      pointerDown = false
    }

    build()

    if (reduced) {
      /*
       * No loop and no pointer. The observer still rebuilds, because the grid follows the
       * element's size, but it redraws immediately - a later frame may never come.
       */
      draw(0, 0, 0)

      const staticObserver = new ResizeObserver(() => {
        build()
        draw(0, 0, 0)
      })
      staticObserver.observe(canvas)

      return () => staticObserver.disconnect()
    }

    /*
     * Resizing rebuilds the grid, because the dot count follows the size. A
     * ResizeObserver rather than a window listener: the canvas box can change for reasons
     * other than a window resize. The callback only raises a flag and `step` applies it
     * next frame, so a drag that fires several times per frame still rebuilds once.
     */
    const observer = new ResizeObserver(() => {
      rebuildPending = true
    })
    observer.observe(canvas)

    frame = requestAnimationFrame(step)

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerCancel, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('blur', onPointerLeave)

    /*
     * Re-read the spoke colour when the theme flips. `src/lib/theme.ts` writes
     * `data-theme` onto <html>, so watching the attribute avoids threading theme state
     * into a component that knows nothing about React state.
     */
    const themeObserver = new MutationObserver(readInk)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('blur', onPointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
