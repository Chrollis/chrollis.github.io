import { MARK_INSET_VIEW_BOX, MARK_PATH } from '@/data/brand'

/**
 * The monogram, inline rather than an image: `currentColor` lets the header turn it yellow
 * on hover with no second asset, there is no request to wait for, and the geometry comes
 * from `src/data/brand.ts` - the same source as the favicon and app icons, so they cannot
 * drift. The padded viewBox gives it its own margin, matching the generated icons.
 *
 * Size is not free: see `MARK_MIN_LEGIBLE_SIZE`.
 */
export default function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_INSET_VIEW_BOX}
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  )
}
