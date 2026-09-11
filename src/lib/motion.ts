/** Shared animation variants. Kept out of components so Fast Refresh stays happy. */
import type { Variants } from 'framer-motion'

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
}

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/** Page-level container rhythm. */
export const pageStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

/** Mirrors --ak-ease / --ak-ease-snap in tokens.css. */
export const EASE_AK = [0.22, 1, 0.36, 1] as const
export const EASE_SNAP = [0.85, 0, 0.15, 1] as const
