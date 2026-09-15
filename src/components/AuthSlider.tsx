import { useEffect, useRef, useState } from 'react'

import { HOLD_MS, judgeHold, judgeTrace } from '@/lib/human'
import type { Pointer, Sample } from '@/lib/human'
import { useLocale } from '@/lib/locale'

/**
 * The authorization beat: one slider the visitor either drags to the end or presses and holds,
 * and a readout that reports what was measured. It is theatre with real numbers - the score
 * shown is computed from their own drag (see `lib/human.ts`) - and it guards nothing that
 * `docs/CONVENTIONS.md` is not already honest about.
 *
 * Three routes, and only the first is judged:
 *
 *   - drag the handle to the end (read the trace, score it);
 *   - press and hold for `HOLD_MS` (duration is the whole test);
 *   - keyboard, which reaches the end through the range input's own handling and is accepted
 *     as it stands. Every route that does not need a mouse trail exists so that an eye
 *     tracker, a switch or a keyboard is not told it is a robot.
 *
 * The readout and the fill are written straight to the DOM rather than through state: a drag
 * fires a hundred events, and re-rendering for each one is the thing the boot counter's own
 * comment warns about. React state changes only on the phases, a handful of times per attempt.
 */
const TICKS = Array.from({ length: 13 }, (_, index) => index)

/** Pointer travel, in px, that turns a press into a drag rather than a hold. */
const MOVE_SLOP = 6

/**
 * How near the handle a press has to land to start a drag. Wider than the 3px handle by
 * design: since a press elsewhere deliberately does not seek, the handle is the only way to
 * drag, and a 3px target is not a target.
 */
const GRAB_PX = 12

/** How long the score stays up before `OK` or `NOISE` replaces it, in ms. */
const TRACE_MS = 420

type Phase = 'idle' | 'holding' | 'sampling' | 'ok' | 'short' | 'noise'

type Props = {
  /** The form owns the outcome; once true the control is inert and reads `OK`. */
  authorized: boolean
  onAuthorize: () => void
  /** Increments when the form was submitted unauthorized, to focus and demand attention. */
  nudge: number
}

export default function AuthSlider({ authorized, onAuthorize, nudge }: Props) {
  const { t } = useLocale()
  const [phase, setPhase] = useState<Phase>('idle')

  const inputRef = useRef<HTMLInputElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  /** Announced, unlike the readout: the readout is rewritten many times per drag. */
  const liveRef = useRef<HTMLSpanElement>(null)

  /** Samples of the attempt in progress. A ref: one push per move, no re-render. */
  const trace = useRef<Sample[]>([])
  const down = useRef<{ x: number; y: number; pointer: Pointer } | null>(null)
  const mode = useRef<'hold' | 'drag' | null>(null)
  /**
   * The control's box, measured once per attempt. Measuring it per sample would force a
   * layout on every move, right after the fill's own write.
   */
  const box = useRef<DOMRect | null>(null)
  const timers = useRef<number[]>([])

  const after = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms))
  }

  const say = (text: string) => {
    if (readoutRef.current) readoutRef.current.textContent = text
  }

  /** Only the outcomes are announced; the sweep in between would talk over itself. */
  const announce = (text: string) => {
    if (liveRef.current) liveRef.current.textContent = text
  }

  const fill = (value: number) => {
    if (fillRef.current)
      fillRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`
  }

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }

  const sample = (event: PointerEvent): Sample => ({
    x: event.clientX - (box.current?.left ?? 0),
    y: event.clientY - (box.current?.top ?? 0),
    t: event.timeStamp,
  })

  /**
   * Back to the start, with the handle parked at zero so a retry is a fresh gesture. `tone` is
   * kept rather than reset: a failure that has already been reported should not fade back to
   * grey while the visitor is still reading it.
   */
  const rearm = (readout: string, tone: Phase = 'idle') => {
    if (inputRef.current) inputRef.current.value = '0'
    fill(0)
    say(readout)
    setPhase(tone)
  }

  /**
   * `traced` is false for the hold route: nothing was read from a trail there, so showing a
   * score would be the one dishonest readout in a panel whose whole premise is that the
   * numbers are real.
   */
  const settle = (state: 'ok' | 'short' | 'noise', score: number, traced = true) => {
    if (state === 'ok') {
      say(traced ? `${t.contact.authTrace} ${score.toFixed(2)}` : t.contact.authOk)
      setPhase('ok')
      after(TRACE_MS, () => {
        say(t.contact.authOk)
        announce(t.contact.authOk)
        onAuthorize()
      })
      return
    }

    /* `short` is unfinished, not suspicious: it has no score to read out, so the handle
       springs straight back instead of waiting on a beat that exists to let a number be
       read. */
    if (state === 'short') {
      rearm(t.contact.authShort, state)
      announce(t.contact.authShort)
      return
    }

    setPhase(state)
    say(`${t.contact.authTrace} ${score.toFixed(2)}`)
    after(TRACE_MS, () => {
      rearm(t.contact.authNoise, state)
      announce(t.contact.authNoise)
    })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLInputElement>) => {
    if (authorized || down.current) return
    clearTimers()

    const input = event.currentTarget
    const rect = input.getBoundingClientRect()
    box.current = rect

    /*
     * A press on the track does not seek. The native range jumps its handle to wherever the
     * track was pressed, which turns a deliberate drag into a click that happened to land
     * somewhere; only a press near the handle starts a drag. `preventDefault` is what stops
     * the jump - it suppresses the compatibility mouse events the control acts on - and it is
     * also why the hold below still runs: pointer events themselves are untouched.
     *
     * The band is far wider than the 3px handle on purpose. Suppressing the seek is what makes
     * the handle the only way to drag, so the handle has to be grabbable.
     */
    const thumbX = rect.left + (Number(input.value) / 100) * rect.width
    if (Math.abs(event.clientX - thumbX) > GRAB_PX) {
      event.preventDefault()
      input.focus()
    }

    /* An unknown `pointerType` is treated as touch: leniency is the safe default, since the
       mouse heuristics are the only thing that can fail an attempt. */
    const pointer: Pointer =
      event.pointerType === 'mouse' ? 'mouse' : event.pointerType === 'pen' ? 'pen' : 'touch'

    down.current = { x: event.clientX, y: event.clientY, pointer }
    mode.current = 'hold'
    trace.current = [sample(event.nativeEvent)]
    setPhase('holding')

    /*
     * The hold is timed from the animation frame's own clock, not from the event's
     * `timeStamp`: that one is fixed at pointerdown, so a loop reading it would measure
     * `event.timeStamp - started` as zero forever and the hold would never complete.
     */
    const started = performance.now()
    const tick = (now: number) => {
      if (mode.current !== 'hold') return
      const held = now - started
      fill(held / HOLD_MS)
      say(`${t.contact.authHold} ${Math.min(100, Math.round((held / HOLD_MS) * 100))}%`)
      if (held >= HOLD_MS) {
        mode.current = null
        down.current = null
        /* A hold that completed did reach the end, so the handle goes there too and the
           thumb stops disagreeing with the full bar. */
        input.value = '100'
        settle('ok', judgeHold(held).score, false)
        return
      }
      window.requestAnimationFrame(tick)
    }
    window.requestAnimationFrame(tick)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLInputElement>) => {
    if (!down.current || authorized) return

    /* Coalesced moves are the only way to see the shape of a stroke on a 120Hz screen: the
       browser otherwise reports one sample per frame and flattens the path. */
    const native = event.nativeEvent
    const moves = native.getCoalescedEvents?.() ?? [native]
    moves.forEach((move) => trace.current.push(sample(move)))

    if (mode.current === 'hold') {
      const travelled = Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y)
      if (travelled <= MOVE_SLOP) return
      /* It moved: this is a drag, and the hold it was charging is abandoned. */
      mode.current = 'drag'
      setPhase('sampling')
    }

    fill(Number(event.currentTarget.value) / 100)
    say(`${t.contact.authSampling} ${trace.current.length}`)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLInputElement>) => {
    const attempt = down.current
    const how = mode.current
    down.current = null
    mode.current = null
    if (!attempt || authorized) return

    /* Released before the hold completed: not a failure, just not yet. */
    if (how === 'hold') {
      rearm(t.contact.authHold)
      return
    }

    const verdict = judgeTrace({
      reach: Number(event.currentTarget.value) / 100,
      samples: trace.current,
      input: attempt.pointer,
    })
    settle(verdict.state, verdict.score)
  }

  const onInput = (event: React.FormEvent<HTMLInputElement>) => {
    /* Authorized is terminal until the form resets it. Without `disabled` - the control keeps
       its full colour instead of fading, which is the point - the handle can still be nudged
       by an arrow key or by the native drag, so it is put back where the authorization left
       it. `aria-disabled` is what tells assistive tech it does nothing now. */
    if (authorized) {
      event.currentTarget.value = '100'
      return
    }
    const value = Number(event.currentTarget.value)

    /* No pointer involved: this is the keyboard route (arrows, Home, End, or a screen
       reader), and it is authorized on arrival rather than judged. */
    if (!down.current) {
      if (value >= 100) {
        fill(1)
        say(t.contact.authOk)
        announce(t.contact.authOk)
        onAuthorize()
      }
      return
    }

    fill(value / 100)
  }

  /* A submit that arrived unauthorized: put the cursor where the work is, and say so on the
     panel as well as in the form's own status line. */
  useEffect(() => {
    if (!nudge || authorized) return
    inputRef.current?.focus()
    say(t.contact.authRequired)
  }, [nudge, authorized, t.contact.authRequired])

  useEffect(() => {
    say(t.contact.authHold)
    return clearTimers
    /*
     * Mount only, and the missing dependency is a fact rather than an omission: every readout
     * in this component is English in both locales, so flipping the language cannot make the
     * string written here stale. A new authorization after a send is handled by remounting
     * this component (the form keys it), which is why nothing re-arms it from inside.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* The readout's colour is the one part of this panel React has to know about: the text and
     the fill are written straight to the DOM, but a class cannot be. Quiet while it is only
     reporting, accent when it passes, danger when it does not - the same three tones the
     form's own status line uses. */
  const readoutTone =
    phase === 'noise' || phase === 'short'
      ? 'text-ak-danger'
      : phase === 'ok'
        ? 'text-ak-accent'
        : 'text-ak-muted'

  return (
    <div className="mt-5 border-t border-ak-border pt-4">
      {/* The label line, in the same shape as the form's own header: micro-type left, readout
          right. The readout is aria-hidden because it is rewritten many times per drag; the
          sr-only line below carries the outcomes. */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="ak-label">{t.contact.auth}</span>
        <span ref={readoutRef} className={`ak-index ${readoutTone}`} aria-hidden />
      </div>

      {/* Fill, ticks, then the input: painted in that order, so the track the visitor touches
          is the input and the instrument is what shows through it. */}
      <div className="relative mt-2">
        <span
          ref={fillRef}
          aria-hidden
          className="ak-progress-fill absolute inset-x-0 top-1/2 h-px bg-ak-accent"
          style={{ transform: 'scaleX(0)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-full items-end justify-between"
        >
          {TICKS.map((tick) => (
            <span
              key={tick}
              className={`w-px ${tick % 4 === 0 ? 'h-2 bg-ak-accent/60' : 'h-1 bg-ak-border'}`}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          aria-disabled={authorized}
          aria-label={t.contact.auth}
          className="ak-auth"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onInput={onInput}
        />
      </div>

      <span ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  )
}
