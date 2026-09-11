/**
 * Logo geometry. The only copy in the repository: `LogoMark.tsx` renders it and
 * `scripts/build-icons.mjs` derives every generated icon from it.
 *
 * A 2x2 monogram (C R L S): one filled path, no strokes.
 */

/**
 * Smallest size at which the mark still resolves.
 *
 * The bars sit 2 units apart in a 64-unit box, so the gap is `size * 2/72` and 36px
 * is the first size where it reaches one device pixel. Below that the gaps antialias
 * into the ink and the monogram becomes a solid rectangle.
 */
export const MARK_MIN_LEGIBLE_SIZE = 36

/** Authored coordinate space. The mark fills it almost edge to edge. */
export const MARK_VIEW_BOX = '0 0 64 64'

/** Same path, wider frame - for a tab or an app icon, where no layout adds spacing. */
export const MARK_INSET_VIEW_BOX = '-4 -4 72 72'

/** The monogram: C R L S, one filled path. */
export const MARK_PATH =
  'M2 2H30L26 10H2m0 2H10l4 8H2m0 2H26l4 8H2M34 2H58l4 8H34m0 2H54l4 8H34m0 2H46l-4 8H34m16-8h8l4 8H50M2 34H10l4 8H2m0 2H10l4 8H2m0 2H26l4 8H2M34 34H62l-4 8H34m4 2H54l4 8H42m-4 2H62v8H34'

/**
 * The four letters as separate subpaths: an uppercase `M` opens each letter and a
 * lowercase `m` each bar after it, so splitting on `M` yields exactly four.
 * Parsed from `MARK_PATH` so it cannot drift from the artwork. Unused in the UI.
 */
export const MARK_LETTERS: readonly string[] = MARK_PATH.match(/M[^M]*/g) ?? [MARK_PATH]

/**
 * Literal colours for the generated files, duplicated from `tokens.css` on purpose:
 * an SVG loaded as a favicon renders outside the document, where CSS variables do not
 * resolve. Only the in-page component can use them, via `currentColor`.
 */
export const BRAND = {
  /** --ak-bg */
  background: '#0b0b0c',
  /** --ak-text on dark */
  onDark: '#ffffff',
  /** --ak-accent */
  accent: '#ffd100',
  /** --ak-border, a step lighter so it reads on the background */
  border: '#2a2a2e',
  /** Grid lines, dimmer than the border */
  grid: '#17171a',
} as const
