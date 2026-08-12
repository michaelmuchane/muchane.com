# DECISIONS

Running log of convention-covered micro-decisions (AGENTS.md Commandment 10/11). Lives at
repo root, outside `public/` — never served.

## Phase A — shell, tokens, theme

- **Architecture:** multi-page static site (one real HTML file per route) + JS
  fetch-and-zoom enhancement, not a client-side-routed SPA. Reasoning: the settled
  requirements "direct load hard-renders" and "with JS off every route resolves to real
  content" are only simultaneously satisfiable if every route is a real server file.
- **New CSS tokens** (both themes defined): `--constellation-line` (`#262626` dark /
  `#d4d4d4` light) — kept as its own variable rather than reusing `--border-color`,
  because the existing border token is too dark to read on the light background for a
  1px connecting line. `--meta-color` (`#a3a3a3` dark / `#525252` light) for monospace
  metadata, both ≥4.5:1 contrast on their background. `--quote-border` aliases
  `--accent-color` in both themes (no new hex).
- **Overlay menu links navigate normally** (full page load), not through the zoom
  engine. The menu jumps between top-level sections, not zoom levels — using the
  engine's fetch/animate path for a menu jump has no defined animation (no "origin
  node" on the target page from the menu's perspective) and isn't asked for.
- **Local preview drops `--single`.** `npx serve public --single` was found (during Phase
  C browser testing) to rewrite EVERY path to `public/index.html`, including real
  existing route files — the Phase B "all 10 routes return 200" check had been
  status-only and was vacuous (every route silently served the L0 page's title/content).
  Confirmed by comparing response bodies. Since every route is a real file, `--single`
  buys nothing locally; preview is `npx serve public -l 4173` (no flag) from here on,
  including the Phase E Playwright `webServer` command. Production `try_files` rewrite
  is unaffected — still out of scope this pass, doesn't exist yet on the VPS.
- **Accepted tradeoff — shell duplication:** the page shell (header, theme toggle,
  overlay menu, footer, FOUC-guard inline script) is duplicated verbatim across all 10
  HTML files. There is no build step to keep them in sync, so a shell change (e.g. a
  new footer link) is a 10-file hand edit, and the failure mode is silent per-page
  drift if one file is missed. Rejected alternative: nginx SSI
  (`<!--#include virtual="/_header.html" -->`) would solve this and the nginx config is
  already due a `try_files` change — but `npx serve` does not process SSI, so local
  preview would diverge from what ships in production, which is worse than the
  duplication cost. The mitigation is a Phase E Playwright spec case that asserts the
  full shell testid set is present on every route (`specs/structure.json`), catching
  drift automatically instead of relying on manual review.

## Phase C — zoom engine

- **Zoom-out scroll anchoring** resolved the plan's one open motion detail: the
  transform-origin driving the zoom-out animation is computed from a temporary
  clipped overlay layer (100vh, `overflow:hidden`, internally scrolled to centre the
  origin node) so the origin point is always on-screen during the animation. The FINAL
  resting `window.scrollTo` position, applied after the real DOM swap, is instead
  measured from the live post-swap DOM (find the departing page's node by `href`,
  centre it in the viewport) — this avoids translating coordinates between the
  temporary layer's clipped space and the real document's scroll space, which don't
  correspond 1:1.

## Phase D — content transcription

- **Recognition placement:** the content doc's "at L2 depth inside the Workday node"
  refers to CONTENT depth (pitch/narrative/receipts), not zoom depth — Workday's zoom
  children are fixed at exactly 3 roles. Recognition (all four subsections) and both
  pull quotes render as page-body sections on `/workday` itself, not as a 4th child
  route. See plan Assumptions for the fallback if this reading is overridden.
- **Char-split reveal scope** follows the plan literally: only the three zoom-depth-2
  pages' `Receipts` `<h2>`s (multimodal app, Senior PQE, PM Rotation) and the four
  Workday Recognition `<h3>`s get `.reveal-heading`. TSDP's own `Receipts` `<h2>`
  (zoom-depth 1) stays a plain heading — intentional per the plan's exact wording, not
  an oversight.
- **Meta lines and Education institution lines are composed, not verbatim quotes.**
  Lines like "Technical Product Manager · Raleigh, NC · 2025 – Present" join separate
  doc fields (role/company header, location, date range) with a middot — a structural
  formatting choice, not prose transcription. Education's two institution lines
  similarly compress the doc's multi-line institution blocks into one line each, per
  the doc's own "SITE TREATMENT: two institution lines at L1" instruction. Verified
  automatically: extracted every `<p>/<li>/<h2>/<h3>/<cite>` text node ≥15 chars across
  all 8 content-bearing pages and confirmed each is either a verbatim substring of the
  content doc or one of these known composed/sanctioned exceptions (8 total, all
  accounted for — see hand-back notes).

## Post-Phase-D — visual/motion fixes (pixel-level, caught after Phase D preview)

Neither the gate greps nor the manual click-through smoke render pixels, so three
parameter-fidelity bugs shipped in the Phase D commit and were only found by measuring
the live DOM:
- **Constellation line/node misalignment:** the SVG used `viewBox="0 0 100 62"` with
  `preserveAspectRatio="none"`, but node positions are plain percentages of container
  height. 62 (not 100) as the viewBox height meant every polyline endpoint rendered at
  `(y/62)*100%` instead of `y%` — roughly 11 percentage points below the node it was
  meant to meet. Fixed to `viewBox="0 0 100 100"` so x/y percentages map 1:1 to node
  `left`/`top` regardless of the container's actual aspect ratio. Verified by measuring
  live `getBoundingClientRect()` on all 5 polyline endpoints vs their node centres: 0px
  delta on all 5, not eyeballed.
- **Parallax hover lag:** `.node__inner` had one uniform `0.5s` transform transition for
  both the mousemove-follow and the mouseleave spring-back, so fast cursor movement
  visibly lagged rather than tracked. Split via inline `transitionDuration` set right
  before each transform write: `0.3s` while tracking, `0.5s` on leave — restoring the
  retired GSAP source's two durations (both were `power2.out`; only the duration
  differed) instead of collapsing them to one value.
- **Char-reveal easing mislabel:** the plan's own parenthetical called
  `cubic-bezier(0.215, 0.61, 0.355, 1)` "power3.out"; it is actually the standard
  `power2.out`/`easeOutCubic` approximation. The retired `script.js` achievements
  reveal really used `power3.out` (quart). Corrected to `cubic-bezier(0.165, 0.84, 0.44,
  1)`, the true `power3.out`/`easeOutQuart` equivalent.

## Node face equalization (override of the original "visible without clicking in" instruction)

Michael, the author of the original instruction that the Workday node face carry a
company line + three-line recognition strip visible without clicking in, reviewed the
built result and is overriding that instruction now that its effect is visible: the
Workday node visually dominated its four siblings (title+meta only), breaking the
equal-weight read of the constellation. Per his direction: the three-line strip
relocated to `/workday`, placed directly after the `recognition-heading` and before its
four fuller `<h3>` subsections (content unchanged, relocated verbatim, not reworded).
The company line was already present on `/workday`'s page body independently from
Phase D (`.company-line`) — it needed no move, only removal from the node face.
`.node__company`/`.node__strip` (node-face-only rules) are removed from `style.css`;
the relocated list uses a new `.recognition-strip`
page-content rule. Verified visually: screenshot of the L0 constellation shows all 5
node cards reading as comparable size/weight (title + one meta line each).

## Phase E — deferred

A visual-design pass on the built structure is coming before the spec-runner rebuild,
and that pass will change markup (this session's own node-equalization edit is a first
instance of exactly that). Writing `specs/structure.json`/`behavior.json` against
today's DOM now would mean rewriting them again once the design pass lands. Phase E
(Playwright install, config, `specs/*.json` rewrite, dynamic runner) stays parked until
that pass is done — sequencing intentionally preserved here, not dropped.

## Starfield backdrop

Canvas 2D starfield (`public/starfield.js`) added behind all 10 routes: fixed
`#starfield` canvas, three parallax depth layers, theme-reactive, reduced-motion-static.
Purely additive — zoom engine, routing, history, content, and every pre-existing
`data-testid` untouched. One new testid (`starfield`) added.

- **Theme hook:** `MutationObserver` on `document.documentElement` watching the `class`
  attribute, rather than a callback wired through `app.js`. Reasoning: keeps `app.js`
  byte-identical (this pass is purely additive, not a shared-state refactor), needs no
  cross-page plumbing duplicated across the 10 HTML files, and fires synchronously right
  after the existing theme-toggle handler's `classList.toggle('light-mode')` — no
  polling, no missed frame.
- **Load order:** `<script src="/starfield.js" defer>` sits in `<head>`, after
  `<link rel="stylesheet">`. `defer` means the fetch overlaps head/body parsing but
  execution waits for a fully parsed DOM, and — critically — runs after the inline
  FOUC-guard script earlier in `<head>` (which adds `light-mode` synchronously before
  paint). Reading `documentElement.classList` at init is therefore FOUC-safe: the first
  `draw()` always picks the theme-correct sprite, no flash of the wrong one.
- **Dark-sprite gradient stops** were unspecified beyond "tighter core, minimal halo,
  dark specks" — chosen this pass as an inverted-cast dark radial
  (`rgba(22,26,34,*)`, stops at 0/0.20/0.45/0.70/1) against the light sprite's near-white
  cool cast. Retunable like every other visual constant; not treated as final.
- **Zoom-transition observation** (canvas intentionally does NOT scale during a zoom —
  per instruction, not a bug): watched a full L0→L1 zoom (`/` → `/two-sided-data-platform`)
  with before/mid-transition/after screenshots. The starfield speckle positions are
  pixel-stable across all three frames while the content card scales up to fill the
  viewport — the backdrop reads as a steady, distant layer against the rushing
  foreground, which is the depth cue the fixed positioning was chosen for. No visual
  conflict observed; the star density is subtle enough that it doesn't fight the
  scaling content for attention mid-transition. No unilateral change made to this
  behavior.
- **Measured FPS** (headless Chromium, dark theme, `/`, 2s sample): 60.1 fps at normal
  speed; 53.3 fps under a 4× CPU-throttle emulation (`Emulation.setCPUThrottlingRate`).
  Flagged, not remediated — `count`/`ceiling`/`glow` retuning is Michael's explicit
  post-review step, not this pass's.

## Zoom-out scroll anchoring — fallback applied

The rebuild plan's own anticipated seam materialized: after a zoom-out finished, the page
visibly scrolled into place. Root cause — `zoomOut()` animated against the OLD window
scroll (using an internally-scrolled clipped preview layer to fake the future position),
then `finalizeOut()` swapped the DOM and called `window.scrollTo` AFTER the animation;
that post-animation scroll was the visible settle.

Applied the pre-decided fallback: commit the incoming page and its final scroll position
FIRST, then measure the zoom origin from the live DOM and animate. Concretely — capture
the outgoing content into a plain wrapper, call the existing `swapStage` (DOM swap +
`pushState` + title + focus, unchanged), scroll to center the live origin node, THEN wrap
both the outgoing and incoming content into `.zoom-layer`s and animate. Nothing scrolls
after the animation, so there is no settle. Same four WAAPI animations, same
`{ scaleDur: 700, fadeDur: 434, delay: 196, scaleFar: 5, scaleNear: 0.86 }` and
`cubic-bezier(0.22, 1, 0.36, 1)` easing — untouched.

Two implementation details the fallback required, discovered during this pass, not in the
original plan:
- **Document height must be frozen before wrapping.** Pulling the committed content out of
  normal flow into absolutely-positioned layers collapses `#stage` toward its
  `min-height: 100vh` rule, shrinking the document and letting the browser clamp the
  scroll position just committed. Fixed by setting an inline `min-height` to the stage's
  measured height right before wrapping, cleared on unwrap (and also cleared inside
  `swapStage` itself, so the popstate escape-hatch — which finalizes a preempted
  transition through `swapStage` — never leaves a stale oversized min-height behind).
- **`html { scroll-behavior: smooth }` is global** and made the "commit scroll first" step
  not actually synchronous: a plain `window.scrollTo` glides across several animation
  frames, and `window.scrollY` read immediately after calling it still reports the OLD
  position. This is very likely the literal mechanism behind the original bug too. Added a
  small `scrollToInstant()` helper that toggles `document.documentElement.style
  .scrollBehavior` to `'auto'` for the one commit-scroll call, then restores it — the
  global smooth-scroll behavior (used elsewhere, e.g. anchor links) is untouched outside
  that single call.

Verified numerically, not visually: sampled `window.scrollY` every animation frame across
the full ~1.3s zoom-out on three paths (direct-load L2 → up-link; L0 zoom-in → up-link via
the `history.back()` shortcut/popstate; direct-load L1 → up-link to L0) — each shows
exactly one scroll jump, landing on the very first sampled frame after the click (i.e.
inside the synchronous click handler, before any animation frame elapses), and zero
discontinuities for the rest of the transition. Origin node re-centers to sub-pixel
accuracy (≤ 0.31px) in all three cases. Re-ran both `0bba9e8` regressions against the
rewritten `zoomOut` (rapid double-click pops exactly one level; browser Back fired
mid-zoom-out preempts cleanly with no stale `min-height` or orphaned `.zoom-layer`
elements) and the reduced-motion hard-swap path (unchanged, still no `.zoom-layer` ever
appears).


## Constellation satellites + accent pass

**Satellites are signage, not links.** Each satellite is a plain `<span>` INSIDE the
parent `<a class="node">`, with no `href` and no `data-zoom` — the whole cluster (card +
its satellites) is one click target that zooms to the parent route. Reason: the zoom
engine only defines its four-animation transition for single-level moves
(`|Δdepth| === 1`, see `app.js` popstate handler's `delta` branch); a clickable role
satellite under Workday would jump straight from L0 to L2, which the engine can only
hard-swap — that would read as visibly broken next to every other transition on the site.
The satellite text tells you what's inside; the page delivers it.

**`aria-hidden="true"` on every satellite**, not folded into the parent's accessible
name. The parent link's name stays concise ("Workday 2019 – 2025"); folding three role
titles (or three contact channels) into it would turn every screen-reader announcement
of a constellation node into a paragraph, and the destination page already delivers the
same information as real, readable content — nothing is lost, only deferred one click.

**Coordinates left unchanged** (`(12,18) (32,52) (54,26) (72,64) (90,38)`). The existing
layout already keeps every satellite cluster clear of every other node's card and every
other cluster's satellites at 1280/1440/1920px — verified by rect-disjointness assertion,
not eyeballed. Leaving coordinates alone also means zero risk to the polyline-endpoint
geometry fixed in `95a1013`; re-verified 0px endpoint-to-node-centre delta at all three
widths after this pass.

**Satellite sizing:** `0.62rem` monospace (vs. the parent `.node__meta`'s `0.72rem`),
`opacity: 0.75` dark / `0.85` light — smaller and dimmer than the metadata line by
construction, no border/background/card treatment (plain annotation text). Composited
contrast measured 4.79:1 (dark) and 4.93:1 (light), both ≥ 4.5:1. Subjective read on the
built page (not just the arithmetic): comfortably legible at normal viewing distance in
both themes — reads as a soft label under the star, not squint-text — but it is
deliberately close to the floor of readable; this is the first thing to revisit if it
doesn't hold up on other displays.

**Polyline repointed to accent, `--constellation-line` token retained.** `stroke: var(
--accent-color)` with `stroke-opacity: 0.55` blends the accent into each theme's
background so the path reads as a dim trace under the cards rather than a foreground
line. The `--constellation-line` custom property stays defined in both `:root` and
`html.light-mode` — NOT deleted — because the accent direction is explicitly
incremental and provisional (a separate cyan/Tron variant is under consideration, and a
non-accent constellation stroke is the first thing that variant would want back).
Annotated in place with a one-line comment rather than removed.

**Text-accent scheme.** Accent (`--accent-color`) now marks wayfinding elements only:
`.page h2` (color + bottom border) and `.up-link` (color, no longer overridden back to
`--text-color` on hover). Everything else keeps its existing register — body copy stays
`--text-color`, metadata (`.page__meta`, `.node__meta`, `blockquote cite`) stays
`--meta-color`. Reasoning: this keeps three distinct visual registers instead of
flattening toward one accent-everywhere look — accent = navigate/scan anchor, gray mono
= metadata, body text = reading — so the color addition aids scanning instead of
competing with long-form copy. Contrast: h2/up-link `#3b82f6` on `#0a0a0a` ≈ 5.38:1,
`#2563eb` on `#f5f5f5` ≈ 4.74:1 — both ≥ 4.5:1. Subjective read on
`/workday/senior-product-quality-engineer` (the densest h2/h3 page): the accent "Receipts"
heading and rule read as a clear, purposeful section label — noticeable but not
overwhelming against the body copy above and the bullet list below.

**Node focus now matches hover** — `.node:focus-visible .node__inner` gets the same
accent border + hover background as `.node:hover .node__inner`; the pre-existing global
`:focus-visible` 2px accent outline is untouched, so keyboard focus is ring + accent
border together, strictly more visible than before.

**Back label:** the L1 up-link text changed from "← Constellation" to "← Star map" on
all 5 L1 pages (contact, education, muchane-cloud, workday, two-sided-data-platform); L2
up-links (which point at their parent role/company name, e.g. "← Workday") are untouched.

**`html { scroll-behavior: smooth }` and instant-scroll fix** — see the dedicated section
above (Zoom-out scroll anchoring); note here only because it was discovered and fixed in
this same pass, before satellites/accent work began.


## Zoom-in scroll settle — same bug class, other direction

The scroll-settle fix in the earlier session covered `zoomOut` only. Follow-up review
correctly caught that `finalizeIn` (used by every zoom-IN, both animated and
reduced-motion) still called plain `window.scrollTo(0, 0)` after the swap, under the same
global `scroll-behavior: smooth` — so zooming IN to a node below the fold still glided
after the animation, the same symptom originally reported, just on the other direction.
Grepped `app.js` for every remaining `window.scrollTo`/`scrollIntoView` call and converted
every one to go through the shared helper: `finalizeIn`, both branches of `finalizeOut`,
and the popstate click-storm escape hatch. No hash-anchor links exist anywhere in the site
(`grep -r 'href="#"' public/` — zero matches), so `scroll-behavior: smooth` had no
legitimate consumer left to preserve; every call site converted.

**The `scrollToInstant` helper itself was broken and had to be rewritten.** The original
implementation (toggle `documentElement.style.scrollBehavior` to `'auto'`, call
`scrollTo`, revert) only happened to work in `zoomOut`'s verification because an unrelated
forced-layout read (`stage.offsetHeight`, for the min-height freeze) immediately followed
it and incidentally flushed the scroll synchronously. In `finalizeIn`, with no such
incidental flush after it, the revert raced Chromium's scroll-animation scheduling — which
resolves `scroll-behavior` for an in-flight `scrollTo` at the next frame, not at the call —
and silently reinstated the smooth glide. Inserting an explicit forced-layout read inside
the helper did NOT fix this either (still glided). Replaced the whole toggle-revert
pattern with `window.scrollTo({ top: y, left: 0, behavior: 'instant' })`: per the WHATWG
CSSOM View spec, an explicit `'instant'`/`'smooth'` behavior bypasses the element's CSS
`scroll-behavior` unconditionally — only unspecified/`'auto'` consults it — so there is no
race to have.

**A second, unrelated scroll discontinuity in `zoomIn`, found only because the
verification bar was "one instant jump, zero discontinuity," not "check the fix I
intended to make."** `zoomIn` moves the outgoing page's children into `outLayer` (pulling
them out of `#stage`'s normal flow) BEFORE adding the `is-zooming` class — this collapses
`#stage` to its base `min-height` immediately, which can shrink the document below the
current scroll position and force the BROWSER to natively clamp `scrollY` — a jump that
is not a `scrollTo` call at all, so the grep above would never have found it. Same fix
pattern as `zoomOut`'s min-height freeze: capture `#stage`'s height and set it as an
inline `min-height` before any child leaves flow; `swapStage`'s existing cleanup
(`stage.style.minHeight = ''`) clears it on the other end.

Verified numerically: scrollY sampled every frame across a zoom-in to a node scrolled
below the fold (L0 scrolled to the Contact node, `scrollY = 452`, then click) — exactly
one instant jump (`452 → 0` in a single frame, at the animation's actual completion time),
zero discontinuities for the full ~1.5s transition. Re-ran the zoom-out scrollY-continuity
check, the `0bba9e8` double-click and preempted-Back regressions, and reduced-motion
zoom-in — all still clean after the `scrollToInstant` rewrite and the `zoomIn` height
freeze.


## Sub-constellation on /workday

Replaced the three stacked `.child-card`s on /workday with a sub-constellation using the
same visual grammar as L0 (scattered nodes + 1px polyline in a bounded stage), reusing L0's
`.constellation`/`.node`/`.node__inner`/`.node__title`/`.node__meta` rules unchanged and
adding a new `.constellation--sub` modifier (aspect-ratio, max-width, node max-width, inner
padding, title size) rather than duplicating the block. Verified byte-identical L0
rendering (rects + computed styles for all 5 nodes, the stage, and the svg, at 1440×900)
before and after this change — the modifier is additive-only, L0's own rules untouched.

**Polyline order is chronological** (Product Quality Engineer '19–'22 → Product Management
Rotation '21–'23 → Senior Product Quality Engineer '22–'25), left to right, reversing the
prior top-to-bottom card order. Each star carries its own year range in `.node__meta`, and
the existing overlap note ("The PM Rotation ran concurrently with the QA roles by design")
sits directly below the cluster — on the real render this reads as an intentional career
path with a labeled caveat, not a false claim of strict sequence.

`/two-sided-data-platform` keeps its single `.child-card` (a constellation of one is just a
card) and `/muchane-cloud`'s empty `.children` div is untouched — no structure invented
ahead of content.

Company line and overlap note moved from above the (former) children grid to below the new
sub-constellation, per spec: the page reads as a constellation, then a document.


## L0 composition — density over new nodes

L0 read sparse (five cards in a large empty field). Fixed by growing card presence and
tightening the stage rather than adding nodes or widening `max-width`: `.node__inner`
padding `16px 20px → 18px 24px`, `.node__title` `1.05rem → 1.15rem`, `.constellation`
`aspect-ratio: 2/1 → 9/4` (shorter field, same 1200px width — geometry stays identical at
1280/1440/1920 since `.constellation-section` pads 40px on every width, which keeps every
downstream pixel assertion simple). Chose this over scaling the whole constellation up
(raising `max-width`) because a wider stage at the same card count is still the same
emptiness ratio — presence-per-card is what actually reads as "considered", not more empty
canvas. Coordinates rebalanced to use the shorter field's height and wider x extremes:

| node | old | new |
|---|---|---|
| two-sided-data-platform | 12,18 | 11,22 |
| muchane-cloud | 32,52 | 30,60 |
| workday | 54,26 | 52,28 |
| education | 72,64 | 73,68 |
| contact | 90,38 | 91,42 |

Verified: x strictly increasing, all y distinct, no polyline segment crossing (checked
programmatically), polyline endpoints land on node centers within 2px (observed ≤0.02px)
at 1280/1440/1920, and /workday's sub-constellation rects unchanged from the prior commit.


## Satellites: orbit + legibility

**Orbit is low-amplitude closed-loop drift, not full revolution.** Each satellite gets a
fixed slot around its parent card (`--sat-x`/`--sat-y`, replacing the old
`--sat-offset` stacked-column model) and traces a small ellipse (±4px x, ±3px y) over 22s
via a CSS `@keyframes` animation, phase-offset per satellite (`--sat-phase`, staggered
~3–7s apart) so a cluster's satellites never move in sync. Chose drift over full
revolution because the spec's own constraints — "SLOW and low-amplitude", "if it draws the
eye it has failed", disjointness required at every orbit phase, and legible static text —
are unsatisfiable with a label sweeping the card perimeter (high-amplitude by definition,
guaranteed to cross a neighbor at some phase). Pure CSS transform animation
(compositor-driven); no JS, no rAF loop needed — `starfield.js`'s loop is untouched.

**Legibility raised**: `font-size: 0.62rem → 0.72rem` (now matches the parent's
`.node__meta`), opacity `0.75/0.85 → 0.9/0.95` (dark/light). Composited over the theme
background at these values: dark theme `rgb(163,163,163)` @ 0.9 over `#0a0a0a` → contrast
**6.50:1**; light theme `rgb(82,82,82)` @ 0.95 over `#f5f5f5` → contrast **6.31:1**. Both
comfortably clear the 4.5:1 floor with margin to spare — this is legible at a normal
viewing distance, not squint-text, while staying visually subordinate to the parent's
`.node__title`/`.node__meta` (same mono family and `--meta-color`, just spatially detached
from the card rather than sized/weighted like a heading).

**One offset had to be corrected during verification**: `satellite-workday-2`'s initial
right-flank slot (`calc(100% + 92px)`) put the ANCHOR point 92px past the card, but the
`translate(-50%, -50%)` centering means the rendered label extends half its own width in
both directions from that anchor — for "Product Management Rotation" (~193px rendered),
half-width (~97px) reached back past the 92px offset and overlapped the card itself. Fixed
to `calc(100% + 120px)`. Since satellite `font-size` is a fixed `rem` value (root font-size
is never scaled by any media query in this codebase — confirmed by grep), this offset is
constant across viewport widths, not something that needs per-width tuning.

Verified: disjointness (satellite vs every card, satellite vs every other satellite,
including own siblings) holds at 1280/1440/1920 **and** at 3 sampled points across the
22s orbit cycle (0s/7.3s/14.6s) — zero overlaps after the fix, 9 real overlaps caught and
fixed before that. `elementFromPoint` at every satellite's center resolves inside its
parent `<a class="node">` (all 8, after scrolling each into view — off-screen nodes
correctly return `null` from `elementFromPoint`, a viewport artifact, not occlusion).

**Reduced motion asserted at the end state, not just the absence of motion** (a rule that
collapsed satellites to the card's origin or hid them would pass a motion-only check): with
`prefers-reduced-motion: reduce`, every satellite's position matches its no-animation slot
within 5px (observed: exact 0px match for all 8), computed opacity is unchanged from the
animated case (0.9/0.95), `display`/`visibility` show it's actually rendered with nonzero
area, and two 1s-apart snapshots are position-identical (no drift). All four checks passed
for all 8 satellites.


## Constellation pass 3 — pills, purple accent, muchane-cloud satellites, recomposition, sub-node fix

**Pill shape — deliberate exception to the sharp-corner language, Michael-approved.**
`.node__satellite` gets `border-radius: 999px` (fully rounded ends), `padding: 3px 10px`,
a 1px `--border-color` border, and `--card-bg` fill, on top of the existing dim/small mono
text treatment. This is the first rounded element anywhere on the site; every other border
is a sharp 1px rule. Reasoning, per Michael's explicit direction: roundness is what reads
as an orbital body annotating a star rather than a smaller card — logged here so a future
pass doesn't "fix" it back to square on a design-consistency sweep. Subordination to the
parent card is enforced three ways, not just roundness: meta-sized (`0.72rem`) dim text
against the card's `1.3rem` title, whole-element `opacity: 0.9`/`0.95` (dark/light)
dimming border and fill together, and a ~24px-tall pill against a ~90px-tall card.

**Satellite labels abbreviated**, all testids unchanged: workday "Senior Product Quality
Engineer"/"Product Management Rotation"/"Product Quality Engineer" → "Senior PQE"/"PM
Rotation"/"PQE"; education "Boston University"/"Wake Forest University" → "BU"/"Wake
Forest" (kept as the mismatched-length pair specified — each is the institution's actual
colloquial short name, and the width spread is no worse than workday's own "PQE" vs "PM
Rotation"); contact unchanged (already short). Two new satellites added to
`node-muchane-cloud` — `satellite-muchane-cloud-1` "iapply", `satellite-muchane-cloud-2`
"muchane.com" — same `<span>`-in-`<a>`, no-`href`, `aria-hidden="true"` grammar as every
other satellite (see "Satellites + accent pass" above). **PRM was explicitly cut, not
shipped and hidden**: it does not exist (no app, no route, no deployed service), and a
"coming soon" satellite on a public portfolio is the same category of unbacked forward
claim as the `/muchane-cloud` TODO block itself — Michael's call, made before
implementation started.

**Orbit amplitude raised ±4px/±3px → ±9px/±6px, period stretched 22s → 36s.**
Abbreviation shrank the widest pill from ~193px ("Product Management Rotation") to ~98px
("PM Rotation"/"Wake Forest"/"muchane.com"), freeing enough clearance budget to make the
drift actually read as orbiting instead of the previous barely-perceptible wobble. The
diameter (18px/12px) is now comparable to the pill's own rendered height, so it reads as a
body moving through local space. Period stretched in proportion to hold average travel
speed near the prior value (~1.2px/s vs ~0.9px/s before) — same imperceptible-unless-
watched order of motion, not a livelier animation.

**Accent color: blue → purple.** `--accent-color` dark `#3b82f6` → `#B07FFF` (iapply's
exact dark-UI value, reused as instructed). Light counterpart derived, not reused
verbatim: `#2563eb` → `#7C3AED` (Tailwind violet-600), chosen as the structural analog of
the outgoing light accent (`#2563eb` is Tailwind blue-600) — same relationship between the
two theme values is preserved, not just the same hue family. `#B07FFF` directly on
`#f5f5f5` was not used; it was never contrast-checked because the family-analog approach
made a purpose-built pick clearly preferable to reusing a value tuned for a dark UI.
Contrast measured live via `getComputedStyle` + WCAG relative-luminance math, both themes,
composited where opacity < 1: `.page h2` text+border and `.up-link` text, dark 6.91:1 /
light 5.23:1 (both far above 4.5:1 — accent-on-page-bg is the shared pairing behind
`.page h2`, `.up-link`, overlay-menu link hover, footer link hover, and contact-list link
hover, all bound to the same token). Node hover/focus border (non-text, ≥3:1 floor):
accent vs `--card-bg` dark 6.59:1 / light 5.70:1, vs `--hover-bg` dark 6.07:1 / light
4.91:1. Pill text-on-fill (opacity-composited): dark 6.28:1 / light 6.80:1. Global
`:focus-visible` outline screenshot-verified visible against both card and page
backgrounds in both themes (purple ring, unmistakable). Rejected candidates: `#8B5CF6`
(violet-500, 3.88:1 on `#f5f5f5` — fails outright); `#6D28D9` (violet-700, 6.52:1 — passes
but sits darker than the `#B07FFF`-relative brightness this pass targeted).

**L0 recomposition**: `.node__inner` padding `18px 24px → 22px 28px`, `.node__title`
`1.15rem → 1.3rem`, `.node` `max-width: 300px → 360px` (keeps "Two-Sided Data Platform" on
one line at the larger size). Coordinates adjusted from the prior pass's
`(11,22) (30,60) (52,28) (73,68) (91,42)` to `(10,20) (29,63) (52,26) (73,70) (91,42)` —
a small outward spread giving the now-two-satellite Muchane Cloud cluster (previously bare)
more room without materially moving any other node. Verified programmatically at
1280/1440/1920: x strictly increasing, all y distinct, zero polyline segment crossings,
polyline endpoints within 0.02px of node centres (well under the 2px bar), zero pill/card
or pill/pill overlaps at any of the 3 widths **and** at 3 sampled orbit phases (0s/12s/24s
of the 36s cycle) — 9 combinations checked, zero overlaps in any. Subjective read on the
built render: five clusters read as distinct and intentional, no barren dead zones at any
edge, no crowding or near-misses between clusters — the pass achieves both "avoid barren"
and "avoid crowded" simultaneously without a second iteration.

**`/workday` sub-node height fix — mixed retitle, not full abbreviation.** Root cause
(confirmed by measurement, not guessed): the three sub-nodes are absolutely positioned
inside a 640px container; a node at `--x:82%` gets only 640×0.18=115px of shrink-to-fit
width before border/padding, not the full `max-width:240px` — "Senior Product Quality
Engineer" broke one or two words per line inside that 83px content box, quadrupling that
card's height relative to its siblings. Fix applied in two parts. First, per Michael's
explicit override on the original all-abbreviated plan: "Product Quality Engineer" ships
spelled out (not "PQE") and "PM Rotation"/"Senior PQE" ship shortened — the sub-node cards
are primary navigation on the page a reader has just landed on, not passing signage like
the L0 satellites, and a bare "PQE" card expands nowhere above it on the page (the h1 is
just "Workday"). Second, live measurement showed "Senior PQE" itself still clipped the
83px box at `--x:82%` by under 1px (81.66px needed vs 81.2px available) — applied the
plan's pre-decided fallback, moving that node to `--x:80%` (128px available, 94px content
box) and updating the polyline in lockstep (`16,66 50,24 82,60` → `16,66 50,24 80,60`).
Result: all three cards render at an identical 74.64px height (ratio 1.00, comfortably
inside the ≤1.15 bar), polyline endpoints within 0.01px of node centres. Role names in
page body content, `.node__meta` year ranges, and every L2 page `<h1>` are untouched —
only the three sub-node `.node__title` spans changed.

**Deploy blocker, unchanged status, now doubled exposure**: `/muchane-cloud` is still the
inherited `todo-block` placeholder (no real content). This pass adds two working L0
satellites ("iapply", "muchane.com") that point at that node, so the homepage now
advertises the page twice as prominently as before. Do not deploy until `/muchane-cloud`
has real content — flagged again here, not resolved by this pass, which was explicitly
scoped to leave page content untouched.

## L0 refinement — C1: shell unification

**Shell unified across all 10 pages, not per-level.** The zoom engine's `swapStage()`
replaces only `main#stage`'s contents — header, drawer, telemetry, and (formerly) footer
live outside `#stage` and are never touched by a client-side navigation. A per-page shell
(new header on L0, old header on L1/L2) would therefore diverge the instant someone
clicked through instead of hard-loading, breaking the locked "direct load and
click-through render identically" invariant by construction. The header, drawer, and
telemetry markup is now byte-identical across all 10 HTML files; only `body[data-depth]`
(and, on L0, the still-present `main[data-depth]`) gates what's visible.

**Old text footer retired everywhere, not just on L0.** With the header now carrying
email/GitHub/LinkedIn icons on every page, the footer's three links were a pure
duplicate. Removing it only on L0 while keeping it on L1/L2 would reintroduce the same
shell-divergence problem the header fix was solving. `site-footer`, `footer-email`,
`footer-github`, `footer-linkedin` are retired testids.

**Drawer is non-modal and scrimless, Work group collapsed by default.** Board 1g/1j: no
overlay dims the constellation behind the drawer — content visibly shifts right by
`--drawer-width` (236px) instead, so the page underneath stays legible and interactive.
The Work group (Two-Sided Data Platform / Muchane Cloud / Workday) starts collapsed on
every page load; state is not persisted across navigations or reloads, matching board
1j's labeled "COLLAPSED" default.

**Telemetry strip does not shift with the drawer.** `body.drawer-open` translates
`.header` and `main` by `--drawer-width`, but `.telemetry` (fixed, full-width, z-index 26)
is left alone — it is chrome/status, not page content, and shifting a full-width fixed bar
236px right would push its right zone off-viewport. The drawer itself stops 28px short of
the viewport bottom on L0 (`bottom: var(--telemetry-height)`) so it never overlaps the
strip. Verified by rect measurement with the drawer open (see hand-back).

**No-JS fallback added for the drawer.** The drawer is JS-driven (open/close, Work
expand/collapse); with the footer gone, a `<noscript>` block in every `<head>` forces the
drawer static and in-flow (`position:static`, children visible) so every route, including
`/contact`, stays reachable and crawlable without JavaScript — Commandment 6.

**New tokens** (both themes; `public/style.css` `:root` / `html.light-mode`):
`--drawer-width: 236px`; `--telemetry-height: 28px`; `--faint-color` (`#525252` dark /
`#6b6b6b` light) for SECTIONS label, telemetry text, resting drawer chevron; `--drawer-child-color`
(`#7a7a7a` dark / `#737373` light) for nested drawer links; `--telemetry-ok` (`#4ADE80` dark
/ `#16A34A` light) for the AI PIPELINES status dot; per-icon `--icon-{email,github,linkedin}-{fg,border,bg}`.
GitHub icon flips `#ffffff`→`#0a0a0a` in light mode (white-on-white would be invisible);
LinkedIn is lifted to `#3B93E8` on dark (native `#0A66C2` goes muddy on `#0a0a0a`) and
reverts to native `#0A66C2` on light. Email stays `#EA4335` both themes (sufficient
contrast on both backgrounds). `--constellation-line` is no longer "currently unused" —
it's now the drawer's nested-link divider rule in addition to the polyline color.

**Motion tunables surfaced at the top of `:root`:** `--orbit-period: 75s`,
`--teaser-fade: 160ms`, `--drawer-slide: 400ms`, `--star-highlight: 200ms` — defined now
(consumed by C3/C4) so all motion timing for this pass lives in one devtools-tunable
block, per Michael's explicit ask. `--contact-pulse` is added in C6, alongside the
behavior that uses it.

**Accepted ambient-contrast deviation.** Telemetry text, the drawer's `SECTIONS` label,
and (in C4) indexed-star labels are deliberately styled below the ≥4.5:1 contrast token
rule that governs reading text — they're ambient signage/grain by design (board 1a/1d),
not content a visitor is meant to read at a glance. Interactive states (hover/focus) move
them to `--accent-color`, which does clear 4.5:1. The header contact icons are held to the
stricter ≥3:1 UI-component threshold since they're the site's sole contact affordance.
