import DotMatrix from '@/components/DotMatrix'

/**
 * One layer: a canvas dot matrix over a near-black fill.
 *
 * A square-grid PNG and then a WebGL point cloud both lived here and both failed the same
 * way - a full-bleed layer with no headroom left for the text, flattening the page to grey
 * or blooming as a white wash. The dot matrix avoids it by construction: small dots, mostly
 * at 9% alpha, only a minority lit at once.
 */
export default function SiteBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-ak-bg" />
      <DotMatrix className="absolute inset-0 h-full w-full" />

      {/* One soft vignette: settles the corners without tinting the middle of the page. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(var(--ak-bg)/0.9)_100%)]" />
    </div>
  )
}
