/**
 * The authorization beat's arithmetic, as a pure function over a recorded gesture.
 *
 * This is theatre with real numbers, and the honesty is the point: what the panel reads out
 * (`TRACE 0.86`) is what this file computed from the visitor's own drag, not a decoration
 * that pretends to work. It is **not** a security boundary - a script can imitate a hand, and
 * anything that talks to the forwarder directly never loads this page at all. See
 * `docs/CONVENTIONS.md` for what actually protects the inbox.
 *
 * Three routes lead to authorization, and only one of them is judged:
 *
 *   - a pointer drag, judged here;
 *   - press-and-hold, judged by duration alone (`judgeHold`);
 *   - keyboard (which reaches the end through the range input's own handling), accepted as
 *     it stands.
 *
 * Penalising the last two would mean penalising every visitor who cannot produce a mouse
 * trail - an eye tracker, a switch, a keyboard - which is a worse failure than letting a
 * script through a panel that was never guarding anything.
 *
 * Like `validate.ts` it imports nothing, so a plain `node` can load it: the fixtures in
 * `scripts/verify-human.mjs` are the only thing standing between a re-tuned weight and a
 * real hand being told it is a robot.
 */

/** One recorded pointer sample. `x`/`y` are CSS px within the control, `t` is ms. */
export type Sample = { readonly x: number; readonly y: number; readonly t: number }

/** What produced the trace. Touch and pen sample on a different pipeline than a mouse. */
export type Pointer = 'mouse' | 'touch' | 'pen'

/** Why the trace looked synthetic. Each one is a weak signal; only combinations fail. */
export type Reason = 'few' | 'fast' | 'straight' | 'even' | 'flat' | 'monotone'

export type State = 'ok' | 'short' | 'noise'

export type Verdict = {
  /** What the panel reads out. */
  readonly state: State
  /** 0..1, shown to two decimals when the trace was judged. */
  readonly score: number
  readonly reasons: readonly Reason[]
}

export type Attempt = {
  /** How far along the track the handle got, 0..1. */
  readonly reach: number
  readonly samples: readonly Sample[]
  readonly input: Pointer
}

/** How far the handle has to get. Below this the attempt is unfinished, not suspicious. */
export const REACH_MIN = 0.98

/** How long a press-and-hold has to last. */
export const HOLD_MS = 1200

/** What each signal costs. Only combinations of them fail. */
const WEIGHT: Record<Reason, number> = {
  few: 0.6,
  fast: 0.4,
  straight: 0.35,
  even: 0.35,
  flat: 0.2,
  monotone: 0.2,
}

/** Below this the panel says `NOISE`. */
const PASS = 0.5

/** A drag shorter than this did not happen in human time. */
const FAST_MS = 120

/**
 * Fewest samples a generated path gives itself away with. Below this many, a drag is judged
 * on its mechanics alone: a fast flick is three or four samples long and genuinely straight,
 * and reading "no wobble" out of four samples is how a hand gets called a robot.
 */
const READ_MIN = 8

/**
 * Perpendicular spread, in px, of the samples around the line from first to last. A
 * generator holds that line exactly; a hand never does, however careful - which is why this
 * is deviation and not "path length over net length", a ratio that stays at 1.000 for any
 * smooth path and flagged every careful drag as synthetic.
 */
const DEV_MIN = 0.4

/** Coefficient of variation of the sample gaps. A generated path ticks evenly. */
const EVEN_MAX = 0.05

/**
 * Fewer samples than this from a mouse cannot be a hand. Touch and pen are exempt: their
 * moves can arrive coalesced or sparse, and a phone that gives us four samples is still a
 * phone.
 */
const FEW = 4

/** Spread of sample y values. A hand does not hold a line to the pixel. */
const FLAT_SPREAD = 1

const ratio = (values: readonly number[]) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (mean === 0) return 0
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length
  return Math.sqrt(variance) / mean
}

/** A pointer drag: the mechanics first, then the motion heuristics. */
export function judgeTrace(attempt: Attempt): Verdict {
  if (attempt.reach < REACH_MIN) return { state: 'short', score: 0, reasons: [] }

  const { samples, input } = attempt
  const reasons: Reason[] = []
  const first = samples[0]
  const last = samples[samples.length - 1]
  const duration = first && last ? last.t - first.t : 0

  if (duration < FAST_MS) reasons.push('fast')

  /* From here down it is mouse-trail reading: too few samples to be a hand, or enough to
     read the shape of one. Touch and pen are exempt from both - their moves arrive
     coalesced or sparse, and a phone that gave us three samples is still a phone. */
  if (input === 'mouse') {
    if (samples.length < FEW) {
      reasons.push('few')
    } else if (first && last && samples.length >= READ_MIN) {
      const dx = last.x - first.x
      const dy = last.y - first.y
      const net = Math.hypot(dx, dy)
      let deviation = 0
      if (net > 0) {
        for (const sample of samples) {
          const cross = (sample.x - first.x) * dy - (sample.y - first.y) * dx
          deviation = Math.max(deviation, Math.abs(cross) / net)
        }
      }
      if (deviation < DEV_MIN) reasons.push('straight')

      const gaps = samples.slice(1).map((sample, index) => sample.t - samples[index].t)
      if (gaps.length >= 2 && ratio(gaps) < EVEN_MAX) reasons.push('even')

      const ys = samples.map((sample) => sample.y)
      if (Math.max(...ys) - Math.min(...ys) < FLAT_SPREAD) reasons.push('flat')

      let turned = false
      for (let i = 2; i < samples.length; i++) {
        if (samples[i].x < samples[i - 1].x) turned = true
      }
      if (!turned) reasons.push('monotone')
    }
  }

  const penalty = reasons.reduce((sum, reason) => sum + WEIGHT[reason], 0)
  const score = Math.max(0, Math.min(1, 1 - penalty))
  return { state: score >= PASS ? 'ok' : 'noise', score, reasons }
}

/** Press-and-hold: duration is the whole test, and there is nothing to read out. */
export function judgeHold(duration: number): Verdict {
  return duration >= HOLD_MS
    ? { state: 'ok', score: 1, reasons: [] }
    : { state: 'short', score: 0, reasons: [] }
}
