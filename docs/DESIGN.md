# Design

Why the site looks and behaves the way it does. Setup and publishing are in
[README.md](../README.md); the hard rules are in [CONVENTIONS.md](./CONVENTIONS.md);
approaches that were tried and rejected are in [DECISIONS.md](./DECISIONS.md).

---

## Visual language

Industrial editorial, in the lineage of the Arknights official site rather than a
portfolio template:

- oversized display type anchored bottom-left, flush to the gutter
- fine horizontal scanlines across the whole frame
- technical readouts in the corners - coordinates, a clock, status cells
- thin rules with a short accent segment, never full-width decoration
- a slowly turning geometric mark as the only large graphic
- square corners everywhere

The palette is fixed at **black / white / yellow / cyan**. Light mode exists behind the
header toggle, but the OS preference is deliberately ignored: dark is always the default.

Language takes the opposite position, and the asymmetry is intentional - appearance is
taste, but whether a reader can read the page is not. See _Languages_.

### The cover is one screen, not a document

The home page does not scroll. Everything that used to sit below the fold has a route of
its own (`/projects`, `/about`, `/blog`, `/contact`), so nothing was orphaned. Layout is
a flex column rather than stacked absolute layers, so the mark and the headline cannot
collide at an awkward aspect ratio.

---

## Languages

The site ships in **English and Chinese** with a header toggle. Only prose is translated
(the list is in [CONVENTIONS.md](./CONVENTIONS.md)); the rest is 9-11px tracked uppercase
micro-type, part of the instrument look rather than something a reader parses. Converting
it makes the Chinese page read as a machine translation of an English page, and at 9px a
converted label is harder to read than the Latin original. Placeholders are the
exception: a form field is 14px body text read as a sentence.

### Chinese is an override file, not a translation file

`zh.ts` holds only the keys whose Chinese differs; the rest is inherited from `en.ts` at
runtime. A full translation file would be ~150 values that drift silently - this project
has already been bitten twice by one fact stored in two places. With overrides an
untranslated key exists once and cannot drift. It currently overrides about 13% of keys.

`DeepPartial<Strings>` enforces the rest: a key that does not exist in `en.ts` is a
compile error, so the override file cannot invent one or outlive a deletion.

### Typography

| voice      | Latin          | Chinese      | used for                     |
| ---------- | -------------- | ------------ | ---------------------------- |
| reading    | Outfit         | Noto Sans SC | body text, long-form prose   |
| instrument | Blinker        | Noto Sans SC | labels, navigation, counters |
| code       | JetBrains Mono | Noto Sans SC | code blocks only             |

Blinker replaced a monospace face for the label role: squared, even-width letterforms
read as rigid at 11px with wide tracking. Code keeps a real monospace, because there the
fixed advance width is a functional requirement.

**Chinese is a single face, and that is the point.** It was once split - a kai for prose,
a hei for micro-type - which looked defensible face by face but missed that the two have
to share a page, and a geometric Latin sans (Outfit) against a brush-derived kai is a
visible seam at every script boundary. Noto Sans SC is the same category as Outfit and a
hei, so mixed runs join rather than collide. It is listed in all three stacks partly as a
coverage floor: a CJK glyph the subsetted Latin faces lack lands on a real Chinese face
rather than on whatever the OS substitutes.

It ships sliced by `unicode-range` (101 slices per weight) and the browser fetches only
what the rendered text needs - **11 slices on `/about`** - so listing it three times costs
nothing. No loading-screen font gate is needed: the app renders behind the overlay and the
slices finish inside its 1500ms window.

### Detection

`src/lib/locale.ts` is a tiny external store, the same pattern as `theme.ts` - no context,
no provider. Language consults `navigator.language` once (`zh`, `zh-CN`, `zh-Hans-CN`,
`zh-TW` all resolve to Chinese) and then persists an explicit choice. Theme consults
nothing. `<html lang>` is set by an inline script in `index.html` before first paint, which
drives `:lang()` selectors, screen-reader pronunciation and CJK font fallback.

---

## Design system

Tokens live in `src/styles/tokens.css` as **raw RGB channel triplets**, so Tailwind can
apply opacity:

```css
--ak-bg: 11 11 12; /* #0b0b0c */
--ak-accent: 255 209 0; /* #ffd100 */
--ak-accent-2: 0 179 164; /* #00b3a4 */
```

They are bridged into Tailwind in `tailwind.config.js` as
`bg: 'rgb(var(--ak-bg) / <alpha-value>)'`.

The traps that cost real time here - invisible Tailwind classes, `button { border: 0 }`,
missing `min-width: 0`, root `overflow`, content-sized rows - are rules in
[CONVENTIONS.md](./CONVENTIONS.md) and symptoms in [DECISIONS.md](./DECISIONS.md).

---

## The logo

`src/data/brand.ts` holds the mark - one path, one viewBox. It is the **only** copy of
that geometry in the repository, which is the structural fix for a bug that already
happened here: the favicon and the header mark were drawn separately and drifted apart.

| consumer                  | how it gets the mark       | why                                                                                        |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| Header and footer         | `LogoMark.tsx`, inline SVG | needs `currentColor` so it can follow the theme and turn yellow on hover; no extra request |
| `brand/favicon.svg`       | generated, served          | the browser fetches this file directly and never runs the app                              |
| `brand/icon-maskable.svg` | generated, served          | PWA / Android home screen                                                                  |
| `.cache/brand/og.svg`     | generated, **not** served  | nothing fetches it; it is only the document `og.png` is rendered from                      |

### There is a minimum legible size

The monogram is four letters in a 2x2 grid, built from bars 2 units apart in a 64-unit
box, so the on-screen gap is `size * 2/72`: 0.67px at 24px, 0.89px at 32px, 1.00px at
36px. **36px is the floor** where it still reads, and `MARK_MIN_LEGIBLE_SIZE` records it.
The header renders 36px of ink in a 40px frame. There is no smaller variant and no
simplifyable detail: the bars _are_ the letterforms, and a stroked outline cannot work
because the gap is 2 units against a minimum visible stroke of 1.

### Header balance

Both ends use the same bordered 40px square. The mark still carries roughly four times
the on-screen ink of the controls **while the navigation is centred to within 0.1px**, so
the bar is geometrically correct and can still read as leaning left. Weight is not
position: measure ink, not coordinates.

### The icon pipeline

`scripts/build-icons.mjs` runs before `dev` and before `build`, and its output is
**committed** so the dev server serves it and no build is needed to preview. It draws
nothing itself: every path comes from `brand.ts`, and the script only wraps that geometry
in the documents that have to exist as files on disk.

Everything lands in `public/brand/`, not `dist/`, so it exists during development too. The
one exception is `og.svg`, which is written to `.cache/brand/`.

### The two raster slots

`favicon.svg` works in every modern browser, but two slots cannot use an SVG:

| slot               | file                         | size     | why                                                |
| ------------------ | ---------------------------- | -------- | -------------------------------------------------- |
| `apple-touch-icon` | `brand/apple-touch-icon.png` | 180x180  | iOS ignores an SVG touch icon                      |
| `og:image`         | `brand/og.png`               | 1200x630 | Twitter, Facebook, Discord and Slack want a raster |
| manifest maskable  | `brand/icon-maskable.png`    | 512x512  | some Android launchers ignore the SVG entry        |

All are rendered from **the same SVG strings that get written to disk**, so the raster and
the vector are the same artwork by construction - two drawings of one logo is the failure
mode to avoid. iOS is served 180px rather than the authored 512, the size current devices
actually request. The rasteriser is `@resvg/resvg-js`, a prebuilt Rust binary: two
packages, no compiler, and a devDependency so it never reaches the bundle.

`og:image:width`/`height` is written by hand in `src/lib/seo.ts`, because that module runs
in the browser and cannot import a build script's constants. Since that is a duplicated
fact waiting to drift, `build-icons.mjs` reads the PNG's own `IHDR` back and fails the
build if the two disagree.

### What `og.png` is

Open Graph: the meta tags that tell other sites how to present a link. When the URL is
pasted into Discord, WeChat, Twitter, Slack or a forum, the platform reads these tags and
builds a card. `og.png` is the picture on that card, generated from the same monogram with
the site's corner-tick and grid treatment. It contains **no text** - rendering type would
mean embedding a font, and every consumer already shows `og:title` beside the image.

---

## The background field

`DotMatrix` is a dense grid of dots that breathe between dim and lit, drawn on a 2D
canvas. It is **not WebGL, and that is a decision**: the work is a few dozen batched `arc`
fills per frame at any dot count, so a shader would move the same arithmetic to the GPU
and add a program, a buffer and a resize path for headroom nobody uses. Motion is
decoration only - nothing has to complete, so a dropped frame in a background tab is
harmless.

### The field has to be statistically stationary

After a resize, `build` and `step` must share **one** distribution, or the texture drifts
to a duller look over about ten seconds - which reads as the field regenerating itself
once, not as a fade. The fix is structural: one `rollTarget()` that both sites call, and
each dot's `alpha` seeded to its `target`, so the two cannot diverge.

A residual slow change in the pattern is **not** a bug: dots re-roll on a per-dot Poisson
schedule, so the field decorrelates from its first frame and then plateaus. That is the
breathing effect.

### Alpha quantisation is the flicker source

Dots are batched by opacity, and batching quantises. Linear steps are the obvious choice
and wrong: with `BASE_ALPHA` at 0.16, the nearest rungs jump 67% brighter, and on
near-black one dot jumping 67% is a new star appearing, a thousand times a second. The
eye reads brightness as a _ratio_, and almost every dot is a dark one, so a linear ladder
is worst exactly where the field lives. Fixed with a **geometric ladder** - 32 rungs from
0.045 to 0.95, ~11% per rung. Cost is linear in buckets and negligible next to the canvas
work, so prefer more rungs; ~20% per rung is where a step starts to read as flicker.

### Size is a constant; motion is not

Dot radius and attract radius are constants, never scaled by the frame interval. Scaling
them made a slightly long frame shrink and regrow the whole field - a strobe on the
quietest layer - and it saved no work. Likewise the pointer must not scale the base radius:
the glow comes from each dot's own falloff, so only dots near the cursor swell.

Every *motion* constant, on the other hand, is tuned as "per 60Hz frame" and rescaled by
how long the frame actually took: easing fractions through `1 - (1 - k)^frames`, damping
through `DAMPING^frames`, the spring and the attraction by `frames`, and the orbit's phase
step likewise. Without that, the field breathes, follows the pointer and turns at whatever
speed the display happens to run at - half speed on a 120Hz screen, double on a 30Hz one,
which is exactly the "it looks slower on the deployed site" report. The rescaling is exact
for the easing, the orbit and the random retarget; the spring and the attraction are a
semi-implicit Euler step, so theirs is the usual approximation rather than an identity.

### The pointer interaction

A finger drives it too, and **`pointercancel` is what keeps that compatible with scrolling.**
When the browser decides a gesture is a scroll it cancels the pointer; the field releases its
capture and its glow on that signal. Without it a swipe left the button logically down - dots
captured and the ring lit, chasing the last place the finger was seen, for the rest of the
session.

The interaction was disabled on touch for one round while "the page will not scroll on a
phone" was being chased. It changed nothing, which is precisely what ruled the field out: the
real causes were the boot overlay's document-wide scroll lock (it held the page for up to five
seconds after every load and swallowed the first gesture), six decorative boxes using
`overflow: hidden` - a scroll container on iOS, so a swipe starting on one belonged to it -
and `overflow-x: hidden` on `body`, which made it a scroll container in both axes. See
[DECISIONS.md](./DECISIONS.md).

Holding the button seats free dots inside the capture radius on concentric **tracks** at
12, 24, 36, 48... px, innermost first, spilling outward when full. Each track holds
`floor(r/2)` dots and the whole set rotates.

- **`floor(r/2)` is load-bearing.** A full track's arc spacing is `2*pi*r / (r/2) = 4*pi`
  at _every_ radius, so all tracks read at the same density. A fixed count per track
  crowds the inner ring into a solid band.
- **Positions are interpolated in polar form, not integrated from a force.** Positions
  cannot overshoot at any stiffness or dot count; a force does.
- **Slots are assigned, not emergent.** Linear angular repulsion has no minimum at equal
  spacing, and a log potential converges too slowly to watch.
- **The capture radius is fixed and must not follow the rings.** Bigger rings capturing
  further out is a positive feedback loop; the track count is unbounded instead, so an
  arriving dot always has a seat. Without that it stays free and is drawn inward onto the
  cursor as a bright clump.
- **Track speed falls with radius** (`w = REF / r`), keeping _linear_ speed constant, and
  spin direction alternates by parity. Constant angular speed makes a big ring look spun
  and a small one merely turned.
- **Spokes are one radial gradient, not per-ring opacity.** Every ring's lines converge on
  the cursor, so the gradient must reach **zero at the cursor** or the overlap is a solid
  blot.

Angle comparisons inside this code have produced two subtle bugs; see
[DECISIONS.md](./DECISIONS.md) before touching slot ranks or shortest-arc logic.

### Resizing

A `ResizeObserver` only raises a flag; the loop applies it at the top of the next frame.
Any debounce lets the canvas element resize while the backing store lags, so the browser
stretches the old bitmap. A rebuild must **carry each dot's alpha and target across** by
grid position, or dragging an edge restarts the whole field every frame.

---

## The cursor

A reticle: a 3px dot at the exact pointer position, and four corner ticks on a frame that
trails slightly behind. At rest the frame turns slowly; over anything interactive it stops
and squares up to the page, and if the element is small enough to outline, the ticks travel
to **its** corners. The ticks are the same vocabulary as `.ak-corners`, which already marks
the site's panels, so the cursor reads as part of the design rather than as a decoration
bolted onto it.

### `mix-blend-mode: difference` must be on the root, not on a leaf

One white element under that mode inverts whatever is behind it: near-white on the dark
theme, near-black on the light one, correct over the accent colours. No theme branch and
no background it can vanish into. But a blend is confined to its own stacking group, and a
group is created by `opacity`, `filter`, `transform` or `will-change: transform`. So
`.ak-cursor` carries the blend and nothing else that creates a group, and every moving
part is a descendant - fading the cursor in with `opacity` on that element would look
harmless and would kill the inversion.

### Corner geometry

- **Half turn, not quarter turn.** A rectangle rotated 90 degrees is a different
  rectangle; 180 maps it onto itself and permutes the four L-corners correctly.
- **Per-axis extents, not one spread.** A control is wider than it is tall, so a single
  spread touches a rectangle only at the middle of each side.
- **The slack in the lock is applied to the drawn position, not the eased target** -
  through the easing it is attenuated twice and becomes invisible.
- **The framed element's rect is re-read every frame**, because hover transitions move
  controls and a rect read once leaves the frame behind.
- **The spin stops for any interactive target**, not only a framed one; keyed on the lock
  alone, hovering a large button changes only its size, which is not a cue.

The native cursor is hidden by a class the component adds at runtime, never by a CSS rule,
so a bundle that failed to load cannot leave the site with no pointer.

---

## Reading a repository README

Relative links inside a README are deliberately **not clickable**. A README is written
against its own repository, so `[LICENSE](LICENSE)` means
`github.com/owner/repo/blob/HEAD/LICENSE`; rendered here it would mean
`chrollis.github.io/LICENSE` - a 404, or worse, a path this site really has, so the click
would land somewhere unrelated with no sign anything was wrong. Those links keep their
text and lose the underline and pointer. Absolute links still work.

Rewriting the targets to absolute GitHub URLs was tried twice and removed; the reasons and
the cases a source-level regex misses are in [DECISIONS.md](./DECISIONS.md). If it is ever
wanted again: rewrite on the parsed tree, after `rehype-sanitize`, never on Markdown
source.
