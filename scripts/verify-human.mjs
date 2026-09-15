/*
 * Authorization-beat verification (`npm run test:human`).
 *
 * The scoring in `src/lib/human.ts` is theatre with real numbers, and the numbers are the
 * part that can go wrong quietly: re-tune a weight and a real hand starts being told it is a
 * robot, which is worse than letting a script through a panel that was never guarding
 * anything. So the fixtures pin **both** directions:
 *
 *   - traces a hand produces, including the awkward ones (a fast flick, a trackpad, a phone
 *     giving four samples), which must pass;
 *   - traces a generator produces - the Playwright `mouse.move(steps: N)` line, and a
 *     cursor-smoothing library's beaten path - which must not.
 *
 * Node 24 runs the TypeScript module directly, so this exercises the function the site ships,
 * which is also why `src/lib/human.ts` imports nothing.
 */
import { HOLD_MS, judgeHold, judgeTrace, REACH_MIN } from '../src/lib/human.ts'

let failures = 0
/** Every reason and state the fixtures produced, so an unreachable branch shows up as a gap. */
const seenReasons = new Set()
const seenStates = new Set()

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) {
    console.log(`        expected ${String(expected)}`)
    console.log(`        actual   ${String(actual)}`)
  }
}

/** A trace from a straight line with optional jitter, so each fixture states its own story. */
function line({ from = 0, to = 300, count, ms, jitter = 0, y = 14, waves = null }) {
  const samples = []
  for (let i = 0; i < count; i++) {
    const progress = count === 1 ? 1 : i / (count - 1)
    const wobble = waves ? Math.sin(progress * Math.PI * waves) * jitter : i % 2 ? jitter : -jitter
    samples.push({
      x: from + (to - from) * progress,
      y: y + wobble,
      t: Math.round(progress * ms),
    })
  }
  return samples
}

/** The shape a generator makes: even steps, no wobble, no correction, no pauses. */
const generated = (count, ms) => line({ count, ms, jitter: 0 })

const judge = (label, attempt, expectedState) => {
  const verdict = judgeTrace(attempt)
  verdict.reasons.forEach((reason) => seenReasons.add(reason))
  seenStates.add(verdict.state)
  check(
    `${label} -> ${expectedState} (scored ${verdict.score.toFixed(2)})`,
    verdict.state,
    expectedState,
  )
  return verdict
}

/* --- a hand, including the awkward ones ------------------------------- */

judge(
  'a mouse drag with real wobble and a late correction',
  {
    reach: 1,
    input: 'mouse',
    samples: [
      { x: 0, y: 14, t: 0 },
      { x: 12, y: 12, t: 24 },
      { x: 34, y: 16, t: 55 },
      { x: 58, y: 13, t: 92 },
      { x: 86, y: 15, t: 120 },
      { x: 118, y: 12, t: 158 },
      { x: 150, y: 16, t: 190 },
      { x: 176, y: 13, t: 231 },
      { x: 188, y: 14, t: 268 },
      { x: 182, y: 15, t: 300 },
      { x: 205, y: 13, t: 330 },
      { x: 232, y: 14, t: 371 },
      { x: 258, y: 12, t: 404 },
      { x: 276, y: 15, t: 441 },
      { x: 288, y: 13, t: 479 },
      { x: 296, y: 14, t: 520 },
      { x: 300, y: 14, t: 566 },
    ],
  },
  'ok',
)

/* A fast flick: few samples, hardly any wobble, under 200ms. Still a hand. */
judge(
  'a fast mouse flick',
  { reach: 1, input: 'mouse', samples: line({ count: 7, ms: 170, jitter: 0.6 }) },
  'ok',
)

/* A careful trackpad drag: nearly straight, monotone, low wobble - but unevenly sampled. */
judge(
  'a careful trackpad drag',
  {
    reach: 1,
    input: 'mouse',
    samples: [
      { x: 0, y: 14, t: 0 },
      { x: 41, y: 13, t: 38 },
      { x: 96, y: 15, t: 61 },
      { x: 149, y: 13, t: 104 },
      { x: 198, y: 14, t: 130 },
      { x: 247, y: 13, t: 187 },
      { x: 300, y: 14, t: 214 },
    ],
  },
  'ok',
)

/* A phone: sparse samples, no wobble, straight. Must not be punished for it. */
judge(
  'a touch drag with four samples',
  { reach: 1, input: 'touch', samples: generated(4, 260) },
  'ok',
)
judge(
  'a touch drag with two samples',
  { reach: 1, input: 'touch', samples: generated(2, 180) },
  'ok',
)
judge('a pen drag', { reach: 1, input: 'pen', samples: generated(5, 300) }, 'ok')

/* Unfinished is not suspicious: the handle simply did not get there. */
judge(
  'a drag that stopped halfway',
  { reach: 0.5, input: 'mouse', samples: line({ to: 150, count: 9, ms: 300, jitter: 1 }) },
  'short',
)

/* --- a generator ----------------------------------------------------- */

/* Playwright's `mouse.move(x, y, { steps: 30 })`: even gaps, no y motion, no correction. */
const playwright = judge(
  'Playwright steps:30',
  { reach: 1, input: 'mouse', samples: generated(30, 300) },
  'noise',
)
check(
  'Playwright steps:30 is rejected for the right reasons',
  playwright.reasons.join(','),
  'straight,even,flat,monotone',
)

/* A smoothing library's path: the wobble is there, but it is periodic and evenly timed. */
const smoothed = judge(
  'a cursor library with periodic wobble',
  { reach: 1, input: 'mouse', samples: line({ count: 24, ms: 320, jitter: 2, waves: 6 }) },
  'noise',
)
check('a cursor library is rejected for evenness', smoothed.reasons.includes('even'), true)
check('a cursor library is not rejected for flatness', smoothed.reasons.includes('flat'), false)

/* A three-event teleport, which is what a naive script does. */
judge('a three-sample teleport', { reach: 1, input: 'mouse', samples: generated(3, 40) }, 'noise')

/* --- press and hold -------------------------------------------------- */

check('holding for the full time authorizes', judgeHold(HOLD_MS).state, 'ok')
check('holding longer still authorizes', judgeHold(4000).state, 'ok')
check('releasing early does not', judgeHold(HOLD_MS - 1).state, 'short')
check('a tap does not', judgeHold(80).state, 'short')

/* --- the table has to stay honest ------------------------------------ */

check(
  'every reason is reachable',
  [...seenReasons].sort().join(','),
  'even,fast,few,flat,monotone,straight',
)
check('every state is reachable', [...seenStates].sort().join(','), 'noise,ok,short')
check('the reach floor leaves room for a human undershoot', REACH_MIN < 1, true)

console.log('')
console.log(failures === 0 ? 'all checks passed' : `${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
