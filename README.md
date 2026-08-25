# mahjoffg-glass

mahjoffg.com is one thing: a fluid gradient field filling the viewport, with a
grain overlay on top. No text, no panels, no pointer reactivity.

The directory name is a leftover — the glass panel it refers to was removed on
2026-08-24, along with the wordmark and the cursor light. The earlier versions
are kept as files here and as immutable Pages deployments; see **Rollback**.

## The field

A domain-warped stream field rendered per frame in WebGL2. Two curl-like warps
advect a folded coordinate into broad, long, continuous blue-white ribbons.
Their width and direction vary organically, without periodic spacing, parallel
repetition, bright knots, or blunt cut ends.

The palette contains only `#49A5E8` deep sky and `#FFFFFF` cloud/ground. There
is no separate soft-sky colour or mask. The blue-white ribbons target a pooled
balance of 85–90% deep blue and 10–15%
blue-white. The tests also require no blank-white interior and less than 1%
yellow or green across desktop, phone and tablet viewports.

Four things in the shader are load-bearing, and each came out of a
measurement, not a look:

- **Warp gains stay low (2.0 and 1.6).** Domain warping multiplies each
  octave's *spatial derivative*, so gains of 3.4 pushed the finest octave down
  to roughly one pixel and the ramp turned grainy — 39/255 between neighbours.
  Now it is 8/255 worst case, 4/255 at the 99.9th percentile.
- **Leaf green is painted at `4·w(1−w)`, not `wSol·wSky`.** The product peaks
  where both colours are fully on — the *interior* of the overlap — which
  painted green straight over the pure blue and left the field 0.0% blue.
  `4w(1−w)` peaks on the falloff, where the two actually meet.
- **Zoom is normalised on the frame's short side**: `1.75 / clamp(min(ar,1),
  0.66, 1)`. A fixed zoom is set by whichever dimension is smaller, so a
  portrait phone at `ar 0.46` spanned less than one noise unit across, landed
  on a single blob, and rendered as one flat colour — in practice blue at
  52%. Normalising holds four to six colour regions on screen at any shape.
- **Render scale is a pixel budget, not a fraction**: `min(dpr, 1.6,
  sqrt(1.5e6 / area))`. A phone viewport is small enough to render above 1×
  and still cost fewer device pixels than a desktop one, and those extra
  pixels are what keep the tighter phone zoom smooth.

There is no simulated surface normal or specular light. An earlier fluid build
derived normals with `dFdx` / `dFdy`; where the warped field compressed, its
narrow highlights read as fabric-like creases. That pass was removed, leaving
only colour advection and a reduced 0.055 grain overlay. Nothing on the page
reads the pointer.

## Covering the viewport on phones

A `position: fixed` element is sized against the **small viewport** — the one
with the browser toolbars showing — and does not grow when they retract, which
leaves a strip of bare page along the bottom edge. That was reported from a
real phone.

**`height: 100lvh` does not fix it, and the first attempt to do so failed on
the device.** `lvh` resolves against the viewport the browser currently
reports, which is the small one; it is not the screen. That is measurable:
with the viewport 745 tall and the screen 844, the `100lvh` build leaves the
canvas 745 tall — a 99px strip — and `verify.mjs` reproduces exactly that. The
claim is not reasoning from the spec; the failing number is in the test.

So the cover layer is sized from JS instead, in `coverSize()`:

- take the largest height any viewport notion reports — `innerHeight`,
  `documentElement.clientHeight`, `visualViewport.height + offsetTop`
- floor it with the screen's long side in portrait (short side in landscape),
  which pre-empts the very first paint, before any toolbar has moved. That
  floor is only trusted within 1.35× of the measured height, so a small window
  on a large monitor does not get a canvas the size of the display.
- never shrink within an orientation: once the layer has been tall, it stays
  tall, so a toolbar coming back cannot re-open the gap. The high-water mark
  resets on an orientation change.
- write the result to `style.width` / `style.height` in px on both layers

CSS keeps `100lvh` as the value before JS runs, and `viewport-fit=cover` is
set. `visualViewport`'s resize event is wired up alongside `resize` and
`orientationchange`, because some toolbar transitions never raise a window
`resize` at all.

`resize()` then measures that box rather than `innerWidth/innerHeight`. A
backing store cut to a different aspect than the box it is stretched into is a
visibly distorted field, and nothing in a DOM dump would show it; `verify.mjs`
asserts the two aspects agree to within 2–3% at every viewport it tests.

## The ground, and the bars the browser draws for itself

The ground is **white** — the same white the browser paints its own status bar
and URL bar with. The palette is a set of diffuse blooms floating on top of
it. Because everything starts from that one colour, the bars, the page and the
edges of the picture agree by construction and nothing has to be kept in step.

Getting here took two wrong turns worth recording:

1. **Chasing the bars.** An earlier build sampled the field and rewrote
   `theme-color` three times a second to match. It sampled the canvas's own
   bottom rows — which sit *behind* the URL bar and are never seen — so the
   colour it published had no relation to what the bar abutted.
2. **Matching a flat bar to a varying edge.** Even sampled correctly, a flat
   bar cannot meet a gradient that varies across the width without a seam,
   however well the colour is averaged. Averaging is the wrong tool.

What is left is one static `<meta name="theme-color" content="#ffffff">`, a
white `body`, and a white ground in the shader. The only thing the field has
to do is be *gone* by the time it reaches the edges of the visible band, or a
bloom touching one would meet white with a line. So it converges to the ground
over the outer 96px **on all four sides** — top and bottom carry the join with
the browser's bars, left and right are there because the palette should read
as blooms floating on white rather than a picture cropped to the frame. The
width is capped at 18% of each axis: 96px off both sides of a 375px phone
would leave the blooms squeezed into a strip down the middle. The curve is
`pow(smoothstep(k), 2.2)` — a plain smoothstep over that width reads as a
heavy vignette (96px is 14% of a 664px viewport at each end), while a bare
`pow` leaves a slope break at the edge, which is its own faint line. The
exponent on top of smoothstep keeps the wash weak across most of the fade and
still lands flat.

### The corners

The four fades used to be combined with `min()` over the edge distances. That
is a Chebyshev field, and **its contours are rectangles**: a point on a corner
diagonal was faded by the nearer edge only, exactly as if the other were not
there. So the picture ended in a 90-degree vertex aimed down each 45-degree
diagonal, with a slope break along the same line — the corner version of the
seam the 2.2 exponent above exists to avoid. It was reported as a blue point in
each corner, and it was in all four.

The measurement, taken by painting the mask itself and reading it back
(`?test=mask`, below), at 1440x900:

| | before | after |
|---|---|---|
| boundary at the edge midline | 32.8px | 32.8px |
| shape of the boundary near a corner | straight, **turning 0 degrees** | turns 84.8 degrees over ~50px |
| where it turns the remaining 90 degrees | one point | nowhere — there is no vertex |
| nearest approach to the page corner | 46.7px, bearing 45.0 degrees | 61.4px |

Each edge now dissolves the picture on its own and the four veils multiply:
`vis = (1-wTop)(1-wBot)(1-wLeft)(1-wRight)`. On any edge's midline the other
three weights are zero and the product collapses to the single-edge curve, so
**the edges did not move** — checked to six decimal places before the change was
made, and the seam tests read the same numbers after it.

Two things are worth keeping from how this was found:

- **All 93 checks passed while it was there.** They sample edge midlines and
  never corners. A suite can be exhaustive along the axes it was written for
  and still have a whole class of defect fall between them.
- **Averaging frames does not decorrelate this field.** The first attempt
  measured the composed picture over 16 moments and got noise. The field
  advects at `0.07*t`, so four seconds of sampling moves it about 0.08 of a
  noise unit — sixteen readings of the same frame. Painting the mask instead
  removed the field from the question altogether.

Two knobs were retuned when the cream ground became white, because dropping
cream raised the contrast everywhere: the leaf seam went 0.82 → 0.55 (green
had climbed to 31% and was outrunning yellow on phone aspects) and a 0.12 veil
of the ground was laid back over everything, which also pulled the steepest
ramps back under the smoothness bar.

`verify.mjs` asserts the seam directly — the outermost row or column of
visible picture on each of the four edges is pure white to within 1/255 and
flat along its length —
and, so that a fade which simply swallowed the picture could not pass, that
peak chroma between 30% and 70% of the height is still above 0.20 (it is 0.53).

### `?test=mask`

`https://mahjoffg.com/?test=mask` paints the edge-fade mask in place of the
picture — white where the picture survives, black where it has dissolved into
the ground. It is what the corner checks read, and it is why they are exact
numbers rather than pooled moments: there is no field colour to see through.
Production pays one uniform for it.

### `?debug=1`

`https://mahjoffg.com/?debug=1` prints what the device actually measured —
`innerHeight`, `clientHeight`, `visualViewport`, `screen`, dpr, whether `lvh`
is supported, the canvas rect and style, the drawing buffer, the gap at the
bottom in px, how many px the browser's own bars take, and the live
`theme-color`. Nothing in this pipeline can inspect a phone, so this is how
a real device reports its own numbers instead of another round of guessing.

## Verify

```sh
python3 -m http.server 8788 --bind 127.0.0.1 &
node test/verify.mjs                       # 113 checks, local
node test/verify.mjs https://mahjoffg.com  # same suite against the live site
```

`verify.mjs` is zero-dependency — it drives headless Chrome over CDP using
Node's built-in `WebSocket` (needs Node ≥ 21). Chrome is launched with
`--use-angle=swiftshader --enable-unsafe-swiftshader`; `--disable-gpu` alone
leaves no WebGL2 and the page falls back to the still gradient.

Nothing in this pipeline can look at a screenshot, so the field is checked by
reading the framebuffer back (`window.__field`, enabled by `?test=1`, which
the harness appends) and judging the numbers in node. Per viewport — desktop
1440×900, iPhone 390×844, Android 360×740, tablet 768×1024:

| check | desktop | iPhone 390×844 |
|---|---|---|
| covers the viewport, unstretched | 1440×900, aspect within 0.1% | 390×844, aspect within 0.1% |
| luminance spread | 0.26 | 0.20 |
| neighbouring-pixel step | p99.9 4/255, max 8/255 | p99.9 5/255, max 8/255 |
| hue balance | yellow 51%, blue 9%, green 13% | yellow 34%, blue 14%, green 13% |
| max chroma | 0.47 | 0.36 |

Three things about those numbers, each learned the hard way:

- **The hue balance is a mean over four moments, not one frame.** The field
  drifts and a phone shows a small window of it, so a single frame is a sample
  of one — at 360×740 yellow and blue traded the lead between runs, which
  failed live after passing locally.
- **The chroma cutoff is 0.18.** Below that a cell is near-neutral and its hue
  is mostly noise; at a cutoff of 0.10 the same field reported blue 42% purely
  from pale cells.
- **A mask readback needs a liveness guard.** An emptied drawing buffer reads
  as all zeros, and `0 === 0 * 0` satisfies the corner product law perfectly.
  The suite asserts the mask is actually present before it judges its shape.
- **HSL saturation is not usable here.** It blows up near white, so plain
  `#F9F1DA` scores 0.72 and every check on it is meaningless. Chroma (max
  channel − min channel) is what the tests use.

The suite also asserts the removals hold: no text renders, no `.glass` /
`.hero` / `nav` / `.brand` / `.cursor-light` survives, and — under reduced
motion, where the clock is frozen so any change could only come from the
pointer — a four-point pointer sweep leaves the frame hash byte-identical.

`diff-reference.mjs` compared this page's CSS to the `glassmorphism-demo`
source rule by rule. **It is obsolete**: nothing of that page remains.

## Deploy

mahjoffg.com is a **Cloudflare Pages** project named `mahjoffg`
(`mahjoffg.pages.dev` + `mahjoffg.com`), direct upload — no Git integration, so
nothing deploys on its own. There is no config file for it in this directory;
the project lives only in the Cloudflare account.

```sh
node build/dist.mjs                                        # assemble dist/
node test/verify.mjs http://127.0.0.1:8789                 # verify dist/ first
npx wrangler pages deploy dist --project-name=mahjoffg --branch=main
node test/verify.mjs https://mahjoffg.com                  # verify live
```

**Deploy `dist/`, never the project directory.** This directory also holds the
README, tests, the archived versions and the source art; uploading it would
publish all of that. `build/dist.mjs` copies only the four shipped files and
fails if `index.html` references anything outside that set.

`index.html` is fully self-contained — no webfonts, no external requests at
all, since nothing on the page renders type any more.

### Verifying the live site

The served HTML will **not** byte-match `dist/index.html`. Cloudflare injects a
zone-level bot-management script (`/cdn-cgi/challenge-platform/…/jsd/main.js`,
~938 bytes) before `</body>`, and that script adds a hidden 1×1 iframe at
runtime. That is the only difference; anything else is a real one. `verify.mjs`
ignores `<script>` elements and anything under 2px when it checks what the body
holds, for exactly this reason.

### Rollback

Deployments are immutable and kept. Roll back from the Pages dashboard, or
redeploy a known-good directory.

| deployment | what it is |
|---|---|
| `8e32af0b` | current — screenshot favicon moved to new cache-busting URLs for Safari/Chrome (2026-08-24) |
| `9c89d6dc` | screenshot favicon deployed under the old, heavily cached favicon URLs |
| `ffcb1760` | branched, softly merged blue-white fluid bands on deep blue; no light-blue layer |
| `91a47e72` | deep-blue and blue-white small cloud groups; soft-sky layer removed |
| `3b1348dc` | small soft cloud groups with a separate light-blue layer; balance 81.1/8.3/10.6 |
| `59088d47` | blue ribbons with a restrained pale-white ribbon; no blank-white patch |
| `36b75743` | blue/white ribbons, but white could expand into an unreasonable blank-looking area |
| `0e8c0e0b` | flat multicolour fluid ribbons; fabric-like normal highlights removed |
| `ce6871f5` | cool-led fluid ribbons; yellow reduced, but retained satin normal highlights |
| `62d27073` | diffuse field; all four edges dissolve into the ground |
| `0e8a580b` | white ground, but only top and bottom dissolved |
| `5bdadee1` | cream ground, bars chased with a sampled theme-color |
| `18dfadce` | bars tinted, but sampled from rows hidden behind the URL bar |
| `3bac8ecb` | JS-sized cover layer; canvas covered, bars still flat cream |
| `a9766378` | field only; 100lvh cover, still left a strip on device |
| `b7bfcd89` | field only, before the phone-aspect zoom fix |
| `31312f31` | shader field behind the wordmark and glass panel |
| `dd55d9e3` | the CSS aurora backdrop it replaced |
| `388ec6d9` | the daffodil page, before the glass redesign |

This project is not under version control, so the previous pages are kept as
files: `index_aurora_backup_20260824.html` (CSS aurora, wordmark, glass panel)
and `index-painting.html` (the earlier browser-painted daffodil direction, the
only thing that uses `wordmark-mask.png`).

## Also in here

- `mahjoffg.png` / `mahjoffg_no_bg.png` — source art, not referenced by
  `index.html`.
- `build/inline.mjs` — writes a single self-contained file with the favicon
  inlined, for previewing as one attachment. Not what gets deployed.
- `dist/` — generated by `build/dist.mjs`; the only thing that gets deployed.
  Safe to delete, it is rebuilt on demand.
