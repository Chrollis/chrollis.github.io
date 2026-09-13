/**
 * Text scramble for a locale flip: the old string breaks into noise, empties, comes back as
 * noise, and resolves into the new string.
 *
 * A pure function of elapsed time, so the component only owns the frame loop and the whole
 * timeline can be exercised without a DOM.
 */

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const PUNCT = '#%&*+-/<>|_=~^$@?!'

/**
 * Glyph pools. Case is kept and scripts are not mixed, so the noise reads as the same text
 * gone wrong rather than as a different string.
 *
 * The Chinese pool is deliberately large and weighted towards dense, high-stroke characters.
 * A Latin word is several letters out of 26, so repeats still read as words; a Han character
 * is a whole unit, and a small pool reads as visibly the same twenty glyphs over and over. The
 * first attempt used `一二三十中天日月`, which read as almost blank next to the real text.
 *
 * These span 21 `unicode-range` slices (~560KB beyond what the page's own Chinese needs), which
 * is why the boot overlay warms them: see `warmNoiseFont` below.
 */
export const CJK_NOISE =
  '魔繁藏覆攀耀露霸徽翼巍颤警蘑藻灌籍壤疆霞霜鹰瀑藤瞬蹈躁稽穆爵骤凝磨燃融镜雕篮箭墨慕暮潮蕴澜磐潜澄翻穗鞠鞭簇' +
  '想感需影题整精演满换航联篇都章项道家能海站钱清情接推提报真笑爱难高请读起播边达迎运近返还通速造采里重量' +
  '链销错键闭问间闻阅阿际限院除随隐集顶预领频风馈腾自至致良色艺节花英范荐获营落表被装见观规视算觉角解言计' +
  '订认让议讯记许论设访证评识诉词试话询该详语说调象财责账货质购贴费资走超越足路身车转软轻载较辑过这进远连' +
  '送适选部配金'

/**
 * Ask the browser for the glyph slices the noise needs, so the first flip to Chinese does
 * not render half the block in a system font. The pool spans many `unicode-range` slices and
 * most of them are only ever reached through this animation.
 *
 * Never rejects: a font that does not arrive is a cosmetic problem, not a reason to hold the
 * boot overlay.
 */
export async function warmNoiseFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.allSettled([
      document.fonts.load('400 1rem "Noto Sans SC"', CJK_NOISE),
      document.fonts.load('700 1rem "Noto Sans SC"', CJK_NOISE),
    ])
  } catch {
    /* Nothing to do; the loader's own cap covers this. */
  }
}

/** CJK ideographs, kana, hangul and the full-width / CJK-punctuation blocks. */
const CJK_RE = /[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/

/* Phase boundaries as a share of the total, so the timeline stretches with the string:
   21% corrupt, 14% clear, 11% hold, 18% regrow, 36% resolve. */
const BREAK_AT = 0.21
const CLEAR_AT = 0.35
const HOLD_AT = 0.46
const GROW_AT = 0.64

/** Timeline budget: ms per source character, with a floor and a ceiling. */
const MS_PER_CHAR = 23
const MIN_MS = 480
const MAX_MS = 2000

/**
 * How long the effect runs for a given source string. Longer text needs a longer sweep or it
 * reads as a flash, but the budget has to flatten out somewhere or a paragraph would run for
 * several seconds. At 23ms per character the cover note - 31 characters - keeps the 720ms it
 * was tuned at.
 */
export function scrambleDuration(from: string): number {
  return Math.min(MAX_MS, Math.max(MIN_MS, from.length * MS_PER_CHAR))
}

/**
 * How long one noise glyph stays before it is replaced, in ms. Re-rolling every frame made
 * the block strobe - and, because it was per frame, strobe twice as fast on a 120Hz display.
 * Each position also gets its own offset below, so they never all change in unison.
 */
const FLICKER_MS = 90

/** 32-bit mix. Same inputs give the same output, which is what keeps the noise time-based. */
function hash(a: number, b: number): number {
  let h = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b)
  h ^= h >>> 15
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 13
  h = Math.imul(h, 0x27d4eb2f)
  h ^= h >>> 16
  return (h >>> 0) / 0x100000000
}

/** Per-position phase, so the block shimmers instead of flipping as one sheet. */
const flickerOffset = (index: number, salt: number) => hash(index + salt, 0x51ed2701) * FLICKER_MS

/**
 * One replacement glyph for `ch`. Whitespace is left alone on purpose: replacing it turns a
 * paragraph into a single unbreakable word, which shoves the page sideways and re-lays it out
 * on every frame - and a stalled frame loop freezes the effect mid-phase.
 */
function glitch(ch: string, index: number, elapsed: number, salt: number): string {
  if (ch === ' ' || ch === '\u00a0') return ch
  const epoch = Math.floor((elapsed + flickerOffset(index, salt)) / FLICKER_MS)
  const rand = hash(index + salt, epoch)
  if (CJK_RE.test(ch)) return CJK_NOISE[(rand * CJK_NOISE.length) | 0]
  if (ch >= 'a' && ch <= 'z') return LOWER[(rand * LOWER.length) | 0]
  if (ch >= 'A' && ch <= 'Z') return UPPER[(rand * UPPER.length) | 0]
  if (ch >= '0' && ch <= '9') return DIGITS[(rand * DIGITS.length) | 0]
  return PUNCT[(rand * PUNCT.length) | 0]
}

/** `text` with every character passed through `map`, length unchanged. */
const mapChars = (text: string, map: (ch: string, index: number) => string) =>
  Array.from(text, map).join('')

/**
 * Stable per-index moment in the resolve phase: the same order every frame, arbitrary across
 * indices. A plain multiply-and-modulo is linear for small indices - it resolves left to
 * right like a wipe - so it goes through the same mixer.
 */
const lockAt = (index: number, salt: number) => hash(index + salt, 0x1f16d2c9) * 0.85

/**
 * The string `from` morphing into `to` at `elapsed` ms. Every glyph is derived from the time,
 * the character index and `salt`, so the noise re-rolls on its own schedule rather than once
 * per frame - which also makes the effect look the same at 60Hz and at 144Hz. `salt` is the
 * one random input: the caller passes a new one per run, or every flip would replay the same
 * pattern.
 */
export function scrambleFrame(from: string, to: string, elapsed: number, salt = 0): string {
  const duration = scrambleDuration(from)
  const breakEnd = duration * BREAK_AT
  const clearEnd = duration * CLEAR_AT
  const holdEnd = duration * HOLD_AT
  const growEnd = duration * GROW_AT

  /* 1. Every character turns to noise, each at its own moment - scattered, not a left-to-right
     sweep. The resolve phase below uses a different salt so the two orders stay independent
     instead of looking like a replay. */
  if (elapsed < breakEnd) {
    const progress = elapsed / breakEnd
    return mapChars(from, (ch, index) =>
      lockAt(index, salt ^ 0x9e3779b9) <= progress ? glitch(ch, index, elapsed, salt) : ch,
    )
  }

  /* 2. The noise is erased, right to left, the way a backspace would. */
  if (elapsed < clearEnd) {
    const progress = (elapsed - breakEnd) / (clearEnd - breakEnd)
    const kept = Math.max(0, Math.ceil(from.length * (1 - progress)))
    return mapChars(from.slice(0, kept), (ch, index) => glitch(ch, index, elapsed, salt))
  }

  /* 3. Empty. A no-break space rather than nothing, so the line box does not collapse. */
  if (elapsed < holdEnd) return '\u00a0'

  /* 4. The new string arrives as noise, left to right. */
  if (elapsed < growEnd) {
    const progress = (elapsed - holdEnd) / (growEnd - holdEnd)
    const shown = Math.floor(progress * to.length)
    return mapChars(to.slice(0, shown), (ch, index) => glitch(ch, index, elapsed, salt))
  }

  /* 5. The noise settles, each character at its own moment. */
  const progress = Math.min(1, (elapsed - growEnd) / (duration - growEnd))
  return mapChars(to, (ch, index) =>
    lockAt(index, salt) <= progress ? ch : glitch(ch, index, elapsed, salt),
  )
}
