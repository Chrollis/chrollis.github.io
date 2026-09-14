# Decisions

Approaches that were tried and rejected, and the measurement that settled it. The rules
that came out of these live in [CONVENTIONS.md](./CONVENTIONS.md); the current design is in
[DESIGN.md](./DESIGN.md). Entries are here so nobody reintroduces one without new evidence.

---

## Build and file layout

- **`rss.xml` / `sitemap.xml` generated into `dist/`** - in the dev server the path did
  not exist, so Vite's SPA fallback answered with `index.html` and the router rendered the
  site's own 404 page. The tell: a `200` carrying `text/html` instead of XML. Everything
  fetched by URL is generated into `public/` now, so it exists in dev too.
- **`og.svg` shipped** - nothing fetched it, so every visitor could download a 1.8KB file
  no code referenced. The intermediate now goes to `.cache/brand/`, gitignored.
- **A failed GitHub fetch failing the build** - it now keeps the previous values from the
  committed `github-data.json`. Stale numbers, never a broken deploy.
- **Plain `import.meta.env.VITE_WEB3FORMS_KEY`** - `import.meta.env` only exists in Vite,
  so under Node (which the build scripts run) it is a TypeError that takes the build down.
  Optional chaining is required.
- **`index.html` referencing `og.png` before the file existed** - every link preview
  404ed in silence. The workflow now verifies each build output by name.
- **A valid-but-blank `og.png`** - a file-existence check passes it. The workflow reads
  the PNG's IHDR signature, and `build-icons.mjs` fails if `og:image:width` disagrees with
  the real image.
- **A filename convention for drafts** (underscore prefix) - it filtered the feeds but not
  the site, producing a post listed on `/blog` and absent from the feed. `draft: true` is
  the single answer.

## CSS and layout

- **`text-[clamp(...)]`** - Tailwind emitted nothing and the cover headline silently
  rendered at 16px, with no warning. A class that does not exist is invisible, not an error.
- **`button { border: 0 }` in a base layer** - the shorthand sets `border-style: none`,
  and a computed `border-width` collapses to zero when the style is none. `.border` only
  sets width, so the inspector showed a correct width and nothing rendered.
- **Missing `min-width: 0`** - three symptoms, one cause. `SocialLinks` chips measured
  381.5px of min-content and scrolled the page at 375px (`scrollWidth` 402 against 320).
  Dot leaders made two footer columns claim 1154px each at a 1024px viewport and squeezed
  the identity column to 0px. A bare `1fr` track has an `auto` minimum, so `grid-cols-3`
  cannot shrink whatever its children say. Diagnostic both times:
  `document.documentElement.scrollWidth > clientWidth`, then walk the subtree.
- **`overflow-x: auto` on `html`** - root overflow only propagates from `body` to the
  viewport while `html` is `visible`. Setting it cut that link and every
  `body.style.overflow = 'hidden'` scroll lock silently stopped working.
- **The viewport floor on `body`** - a block box in normal flow is only as wide as its
  containing block, so the same declaration does nothing there. It belongs on `html`.
  Verified across 100 viewport/route/locale combinations.
- **`overflow-x: hidden` on `body`** - a `hidden` beside a `visible` computes the `visible`
  axis to `auto`, so this made `body` a scroll container in both axes. On Safari a touch
  drag then belongs to `body`, not the document, which is the "the page will not scroll with
  a finger" failure; it is also the same root-overflow link as the entry above. It was
  hiding an overflow that had already been fixed with `min-width: 0`, and it fought
  `--ak-min-width` (a floor is pointless if the x axis cannot scroll). Removed. Anything
  that overflows sideways now gets found and fixed instead of clipped.
- **`overflow: hidden` used only to clip decoration** - it makes the box a scroll container
  as well, so on iOS a swipe that starts on the box is delivered to the box. On the cover
  section that was the whole first screen, and the page behind it never moved - but a swipe
  on the header or footer, which are outside the box, scrolled fine. Decorative clipping is
  `overflow: clip`: same edge, no scroll container. (`overflow: hidden` stays where the box
  is meant to absorb touches - the boot overlay - and on `SiteBackground`, which is
  `pointer-events: none`.)
- **Two independent scroll locks** - each read the current inline `overflow`, wrote
  `hidden`, and wrote the old value back on cleanup. Overlap them and a stale value is
  restored: open the drawer during the boot and the document never unlocks. One shared
  counter in `lib/scrollLock.ts` instead.
- **A content-sized card row** - one reserved line for the topic row was not enough:
  `carross` needed 361px in 310px and `scu-dsa-lab` 315px, while two other cards cleared
  one line by only 6px. A mask-fade truncation was rejected because tags must stay
  readable.
- **Content-sized stat labels** - a row's numbers began at different baselines, measured a
  14px offset at 1440px, and which labels wrapped changed with the column width.
  `line-clamp-2 h-[3.25em]` holds at every width, verified at 9 widths from 380 to 1440px.

## Languages

- **A full `zh.ts` translation file** - ~150 values that drift, with no compiler warning -
  this project has already been bitten twice by one fact in two places. Per-key overrides
  instead, typed as `DeepPartial<Strings>`.
- **`:lang(zh)` resetting `letter-spacing` document-wide** - it was correct while Chinese
  mode translated the whole interface, but once most chrome stayed English the reset landed
  on Latin text: nav items fell from ~1.9px of tracking to ~0.2px and the nav row lost
  61px of width.
- **Listing `.ak-prose` in the same rule** - Markdown bodies were added on the assumption
  that prose is Chinese whenever the UI is, which is false twice over: a README arrives
  from GitHub in English, and a note keeps the language it was written in. Every `.md` view
  gained 0.02em of tracking when the toggle was flipped. Only the hand-written `.ak-cjk`
  opt-in follows the UI language now.
- **A kai for prose plus a hei for micro-type** - each face was defensible alone, but the
  kai's brush-derived oblique stress against Outfit's uniform stress made every script
  boundary a seam. One face (Noto Sans SC) reads as one document.

## The contact address

- **`obfuscatedEmail()` rendering `user [at] domain [dot] com`** - removed. An address a
  visitor cannot copy is not a contact address, and the form is obviously not an address,
  which is worse on a page whose whole purpose is being contacted.
- **`EmailLink` withholding `href`/`title` until hover** - removed. It broke middle-click
  and right-click copy-link-address and needed `role`/`tabIndex`/`onKeyDown` to stay
  keyboard-usable, for protection the alias already provides.
- **`<svg><text>` for the address** - tested and worse: inline SVG text is a real DOM text
  node, so `textContent` returns the complete address.
- **A data-URI `<img>`** - equally readable after `decodeURIComponent(src)`.
- **CSS pseudo-element separators** - they do keep the address out of the DOM, but the
  address is then unbounded from the text: measured `Range.toString()` dropping them.
- **FormSubmit's "Invisible emails" alias** - dropped once the address became plain on the
  page. Hiding it in one more place bought nothing, and an alias URL can be POSTed
  directly anyway. Spam protection is reCAPTCHA plus the honeypot.
- **Cloudflare Turnstile** - not addable: Cloudflare requires the token to be validated
  server-side with the secret key ("tokens can be forged"), and a static site has nowhere
  to put the secret. FormSubmit brings its own reCAPTCHA and does not accept a token.

## The logo and icons

- **Favicon and header mark drawn separately** - they drifted apart. Every icon is now
  derived from `src/data/brand.ts`.
- **A single-letter logo variant** - legible, but reads as an arbitrary glyph.
- **A stroked outline variant** - impossible for this artwork: the gap is 2 units and a
  visible stroke is at least 1, so the letters merge at every size.
- **`sharp` as the rasteriser** - its libvips build has no librsvg, so it accepted the
  SVG, produced a valid PNG, and rendered only the background. A silent failure that would
  have shipped blank icons. `@resvg/resvg-js` instead; if this is ever revisited, sample
  actual pixels rather than trusting the file.
- **An SVG `og:image`** - crawlers do not render SVG, so the card degraded to bare text.
  The PNG is what ships; the SVG is the editable source in `.cache/`.
- **Text inside `og.png`** - would mean embedding or subsetting a font, and every consumer
  already shows `og:title` beside the image.
- **A loading-screen font gate** - unnecessary: the app renders behind the overlay and the
  Chinese slices finish in under 700ms against the overlay's 1500ms window.

## The background field

- **A three.js point cloud** - removed. A few dozen batched `arc` fills per frame on a 2D
  canvas is enough; a shader adds a program, a buffer and a resize path for unused headroom.
- **`build` and `step` rolling independently** - the seeded build lit 22% of dots at full
  `LIT_ALPHA` while a retarget lit 28% at a random 0.36-0.72, so the grid was never at
  equilibrium. Canvas-wide mean alpha fell 17% over about ten seconds, which reads as the
  field visibly regenerating once. Fixed by one `rollTarget()` both sites call, with each
  dot's alpha seeded to its target.
- **A linear alpha ladder** - 10 buckets over 0.95 gives a step of 0.095 against a
  `BASE_ALPHA` of 0.16, so a resting dot sat 11% too dark and the next rung jumped 67%
  brighter; worst rung-to-rung step 200%. On near-black that is a new star appearing. A
  geometric ladder (32 rungs, 0.045 to 0.95, ~11% per rung) cut the worst jump to 10.9%
  and the resting error to 2.4%; measured max per-frame pixel delta 16/255 with zero
  pixels changing by more than 25.
- **`fieldSpeed` scaling dot and attract radius by the frame interval** - a slightly long
  frame shrank and regrew the whole field, a strobe on the quietest layer, and it reduced
  no work: the dot count and the loop were unchanged.
- **A pointer flag scaling the base radius** - `1 + POINTER_GLOW * pointerGlow` grew every
  dot by 14% the instant the cursor entered the window. The glow comes from each dot's own
  falloff instead.
- **Every motion constant being "per frame"** - `EASE`, `POINTER_EASE`, `SLOT_EASE`,
  `RING_EASE`, `RETARGET_CHANCE`, `DAMPING`, `ORBIT_SPEED` and the cursor's `BREAK_SPEED`
  were all tuned against one 60Hz frame with nothing tying them to real time, so the field
  breathed, followed the pointer and rotated at whatever rate the display ran at - reported
  as "the deployed site feels slower". Each is now rescaled by the measured frame duration
  (easing as `1 - (1 - k)^frames`, damping as `D^k`, the spring and attraction linearly).
  Sizes stay constant: see the entry above.
- **A force-based polar correction** - it reached a terminal 43px/frame against a 151px
  circumference, so dots lapped the ring and flew off as a four-armed star. Interpolating
  position cannot overshoot.
- **Emergent angular repulsion** - linear repulsion has no minimum at equal spacing (two
  dots settle at 162 degrees); a log potential has the right minimum but converges too
  slowly to watch. Slots are assigned instead.
- **A capture radius that follows the outermost ring** - positive feedback: bigger rings
  captured further out, caught more dots, and grew further, measured to 96px past the 82px
  attraction field. Capture is fixed and the track count is unbounded.
- **Per-ring opacity on the spokes** - every ring's lines converge on the cursor, so the
  overlap became a solid blot. One radial gradient that reaches zero at the cursor.
- **Slot ranks that are not phase-relative** - a live angle accumulates over a drag while a
  newcomer's angle comes from `atan2` in `[-pi, pi]`, so newcomers sorted before older dots
  and took a consecutive run of slots: a packed, over-bright arc.
- **`wrapAngle` plus a single-fold shortest arc** - with both sides wrapped into `[0, 2pi)`
  the difference spans a full turn, so `if (> pi) -= 2pi` can leave the error still past
  pi. 11.5% of captured-dot cases stepped the wrong way, worst case a full 360 degrees.
- **A 150ms resize debounce** - the canvas element resizes instantly while the backing
  store lags, so the browser stretched the old bitmap and the field looked squashed before
  snapping. A flag applied at the top of the next frame instead.
- **A rebuild that does not carry alpha across** - dragging an edge restarted the whole
  field at its seed values every frame.

## The cursor

- **`mix-blend-mode: difference` on a leaf** - a blend is confined to its own stacking
  group, and `opacity`, `filter`, `transform` or `will-change: transform` creates one.
  Measured on a black/white split, the leaf version rendered flat white under any such
  ancestor; on the root it inverts correctly.
- **A quarter turn instead of a half turn** - a rectangle rotated 90 degrees is a different
  rectangle, so the L-corners do not permute correctly.
- **One spread value instead of per-axis extents** - it draws a square that touches a
  rectangle only at the middle of each side.
- **Applying the lock slack to the eased target** - attenuated twice through the easing, a
  measured 10px move produced 1px.
- **Reading the framed element's rect once** - hover transitions move controls and leave
  the frame behind. Re-read every frame at a median 16.7ms.
- **Keying the spin stop on the lock alone** - hovering a 400x300 button changed nothing
  but its size, which is not a cue.
- **Hiding the native cursor with a CSS rule** - a bundle that failed to load would leave
  the site with no pointer at all. The component adds the class at runtime.

## Reading a repository README

- **Rewriting relative link targets with a source-level regex** - it handled
  `[LICENSE](LICENSE)` and silently missed three cases: raw HTML anchors
  (`<a href="LICENSE">`, and badge rows are usually HTML), reference-style definitions
  (`[LICENSE][lic]` with `[lic]: LICENSE` later, so there is no `](` to match), and
  parent segments (`../other-repo` pasted in as `blob/../other-repo`).
- **A rehype plugin walking `a` and `img` nodes** - this handled all three correctly
  (after parsing they are one `href` property), but was removed anyway: more surface area
  than the feature was worth. The CODE button is the honest route to a README whose links
  matter. If it returns, rewrite the parsed tree after `rehype-sanitize`, never the source.

## Tooling

- **JSX named entities for typographic marks** - JSX does not decode them in text
  children, so `&nearr;` rendered the literal string. `\uXXXX` escapes from
  `src/lib/glyphs.ts` instead.
- **PowerShell `Set-Content` for edits** - it can glue lines when a replacement removes a
  trailing newline. Editor tools only.
