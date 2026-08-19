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

**Real bug caught in review, not by the original hand-back:** the `<noscript>` block was
initially placed *before* `<link rel="stylesheet" href="/style.css">` in every `<head>`.
Both the noscript rule and the main sheet's `.drawer { position: fixed; ... }` are single-
class selectors (equal specificity), so with equal specificity the cascade falls to source
order — and the noscript block, coming first, LOST to the main sheet every time,
regardless of JS being enabled or disabled. A JS-disabled Puppeteer context confirmed the
drawer stayed `position: fixed; visibility: hidden; translateX(-236px)` — completely inert
— under the "fixed" version. Moved the `<noscript>` block to immediately after the
stylesheet `<link>` in all 10 pages so it wins the equal-specificity tie by source order;
re-verified with the same no-JS context: `position: static`, `visibility: visible`, no
transform, and the Work submenu's `[hidden]` children render `display: flex`.

**New tokens** (both themes; `public/style.css` `:root` / `html.light-mode`):
`--drawer-width: 236px`; `--telemetry-height: 28px`; `--faint-color` (`#525252` dark /
`#6b6b6b` light) for SECTIONS label, telemetry text, resting drawer chevron; `--drawer-child-color`
(`#7a7a7a` dark / `#737373` light) for nested drawer links; `--telemetry-ok` (`#4ADE80` dark
/ `#16A34A` light) for the AI PIPELINES status dot; per-icon `--icon-{email,github,linkedin}-{fg,border,bg}`.
GitHub icon flips `#ffffff`→`#0a0a0a` in light mode (white-on-white would be invisible);
LinkedIn is lifted to `#3B93E8` on dark (native `#0A66C2` goes muddy on `#0a0a0a`) and
reverts to native `#0A66C2` on light. Email stays `#EA4335` both themes (sufficient
contrast on both backgrounds). `--constellation-line` was previously retained but
genuinely unused (the polyline has always used `--accent-color`, per the Phase A/C
entries above) — it's now load-bearing as the drawer's nested-link divider rule.

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

## L0 refinement — C2: constellation restructure

**Four nodes, node-center-to-node-center polyline, contact node removed.**
`.constellation` moved from `aspect-ratio: 9/4` to `12/7` (board-1i's 1200×700 design
frame) with polyline points `190,105 330,500 790,240 1095,605`, node positions at exact
design percentages. Contact is no longer an L0 node (it lives in the header icon trio);
the `/contact` route itself is untouched here and stays reachable via the drawer until C6.

**Node markup split into `.node` (position wrapper) + `.node__card` (the `<a>`).**
Satellites are now real interactive elements (Workday: links; Muchane Cloud/Education:
focusable pills) and cannot be children of another `<a>` — `<a>` inside `<a>` is invalid
HTML and the parser silently breaks the nesting. `.node` keeps all positioning
(`--x`/`--y`, `translate(-50%,-50%)`, `max-width`); `.node__card` carries `href`/`data-zoom`
and is what the zoom engine's origin lookups (`stage.querySelector('[href="..."]')`) and
the parallax binder (`inner.parentElement`) resolve to — both verified still functional
after the split.

**Satellite content:** `iapply` → **Career Command Center** (display label only — repo,
container, subdomain stay `iapply`); `muchane.com` satellite removed (redundant with the
page itself); **Self-Hosted Infra** added as `satellite-muchane-cloud-3` (`-2` retired,
not reused, matching board 1a's numbering). Workday: `Senior PQE`→`Senior PQ Engineer`,
`PQE`→`PQ Engineer`. Education: `Wake Forest`→`WFU`; node gains a centered title and a
single-line combined meta (`2015 — 19 · 2021 — 23`).

**Satellites ship at static rest positions in C2; the orbit animation itself is C3's
job.** `--s`/`--rest-x`/`--rest-y` inline custom properties are authored now (per board
1i's locked geometry — corner-exact `--s` of 0.3273/0.6727 for Workday's PM Rotation/PQ
Engineer, 0.5 for the two-satellite nodes), and `.node__satellite`'s base transform reads
`translate(var(--rest-x), var(--rest-y))` directly — this is also the exact rule C3's
reduced-motion override will reuse, so nothing here gets thrown away in C3, only extended
with an `animation`.

**Vertical-fit gate (5) measured and reported, NOT fixed in this commit — pending
Michael's ruling per his explicit stop-here instruction.** At 1440×900:
`document.documentElement.scrollHeight` = 1528px against a 900px viewport, **628px
overflow**. At 1280×800: scrollHeight 1436px against 800px, **636px overflow**. Height
breakdown (both sizes; header and telemetry are viewport-independent, hero and the
constellation-section's own padding are `vh`-based, the constellation itself is a fixed
700px because `aspect-ratio:12/7` is evaluated against the constellation's own
`max-width:1200px`, not the viewport):

| Zone | 1440×900 | 1280×800 | Basis |
|---|---|---|---|
| `.header` (sticky, in-flow) | 80px | 80px | fixed `--header-height` |
| `.hero` | 550px | 480px | `min-height: calc(70vh - 80px)` + `60px`×2 padding (already inside the calc) |
| `.constellation-section` padding | 198px | 176px | `8vh` top + `14vh` bottom |
| `.constellation` | 700px | 700px | `aspect-ratio:12/7` × `max-width:1200px` — independent of viewport |
| **Document total** | **1528px** | **1436px** | sum of the above (`.telemetry` is `position:fixed`, contributes 0 to `scrollHeight` but visually covers the bottom 28px of whatever renders behind it) |

Load-bearing arithmetic: even at zero hero height and zero section padding, `header(80) +
constellation(700) + telemetry(28) = 808px` — already **8px over** the 1280×800 budget on
its own. The constellation's fixed 700px is the dominant term at both sizes; spacing cuts
alone (hero/padding) cannot close the gap at 1280×800, only at 1440×900 (92px of slack
once header+constellation+telemetry are subtracted).

Per the plan's pre-decided options, NOT chosen here — options only, no fix applied:
1. **Uniform `transform: scale()` on `.constellation`** — shrinks cards, polyline, and
   every board-1i pixel offset (161px/203px/139px/72px) together, so the "hug the card +
   14px clearance" ratio the locked extents encode is preserved exactly (a linear
   transform doesn't re-derive the math, it renders the same geometry smaller — the same
   idiom the zoom engine already uses for L0/L1 transitions). Needed scale ≈0.73–0.83
   depending on how much hero/padding also gets cut; risk: satellite pill text
   (`0.72rem`) renders near ~8px at 0.73 scale, likely below comfortable legibility, and
   38–46px card touch targets shrink proportionally.
2. **Tighten hero `min-height`/`constellation-section` padding.** Zero risk to the locked
   orbit math (touches only spacing, not the constellation itself) but, per the
   arithmetic above, is **insufficient alone** at 1280×800 — the constellation's fixed
   700px plus header plus telemetry already exceeds that viewport before any hero/padding
   height is added. Only closes the gap at 1440×900, and only if hero+padding together
   drop to ≤92px (a near-total loss of the hero's current breathing room).
3. **Scale node cards down (typography/padding only, `.constellation--sub`-style).**
   Does NOT reduce the constellation container's height by itself — the container's
   700px comes from `aspect-ratio` × `max-width`, not from card content, so this option
   alone is a non-fix unless paired with a `max-width` reduction on `.constellation` —
   which, unlike uniform `transform: scale()`, would desync the board-1i pixel-valued
   orbit offsets from the now-smaller card sizes (offsets are fixed px, not %), silently
   re-deriving the locked extents' ratio. Effectively subsumed by option 1 if done
   correctly (scale, not `max-width`).

Options 1 and 2 combined (a moderate scale plus a moderate spacing cut) is the
likely-lowest-regret path but is Michael's call, not assumed here.

## L0 refinement — C2 gate-5 fix: hybrid ruling (hero trim + section padding + scale wrapper)

**Ruling: hybrid of options 1 and 2, with a mechanism correction to option 1.**
`transform: scale()` alone does not reduce `scrollHeight` — it's a paint-only
transform, not a layout property, so `.constellation` kept its full 700px flow
height under naive scaling and the page gained dead space instead of shrinking.
Fix: `.constellation` keeps its native 1200×700 layout box and board-1i geometry
completely untouched, wrapped in a new `.constellation-wrap` whose explicit
`height: calc(700px * var(--constellation-scale))` is what actually shrinks the
section's contribution to document flow. `transform-origin: top center` keeps the
scaled box's top edge and horizontal center anchored, so it exactly fills the
wrap's shorter height with no bleed. Scoped via `.constellation-wrap .constellation`
(DOM-ancestry selector) rather than a class on `.constellation` itself, because
`/workday`'s sub-constellation shares the same base `.constellation` class via its
`.constellation--sub` modifier — an unscoped rule would have also shrunk L1's
sub-constellation, which was never in scope for this fix.

**`--constellation-scale: 0.78`** (the instructed floor — legibility of the
0.72rem satellite pill text is the binding constraint, not layout headroom; 0.78
was needed regardless to close the gap, so the floor and the requirement
coincide here).

**Hero: dropped `min-height: calc(70vh - var(--header-height))` entirely**,
content-sized now. Padding cut `60px 40px` → `12px 40px 8px`; `.hero__copy`'s
`margin-top` cut `24px` → `8px`. Also removed `.hero__copy`'s `max-width: 62ch`
(measured: the actual copy text wraps to 5 lines at 62ch vs 4 lines at the
hero's own 820px content width — an 820px reading measure is wider than ideal
typography guidance but not unreasonable, and the alternative was shortening
content, which Commandment 6/the do-not-touch rules forbid). Measured hero
height after all three changes: **212.66px** at 1440×900 — above the ~180-200px
target. The floor is arithmetic, not a tuning miss: `.hero h1` (75.6px, `clamp()`
capped at 4.5rem/72px + line-height 1.05) plus `.hero__copy` at its
now-shortest-possible 4-line wrap (109.06px) alone total 184.66px, before any
padding or margin — so 180-200px was only reachable with zero breathing room
between the heading and the header/constellation, which this pass didn't do.
Reported per instruction rather than silently re-targeting.

**Section padding: `8vh 40px 14vh` → `20px 40px 32px`** (52px total — the
instructed range's floor; 546px, `0.78`-scaled constellation plus 52px padding
left no slack for more).

**Load-bearing discovery: `main { min-height: calc(100vh - var(--header-height)) }`
(pre-existing, all pages) makes gate 5 pass as an exact equality, not a
comfortable margin.** Once `hero + constellation-section` content drops below
`min-height`'s floor (820px at 1440×900), `main` pins to exactly that floor and
`document.documentElement.scrollHeight` becomes exactly `innerHeight` —
verified live: hero(212.66) + section(598) = 810.66px combined, safely under
820, and `scrollHeight` measured exactly `900` (not 894 or any content-derived
number). This means the fit isn't fragile to sub-pixel font rendering the way a
content-height-driven near-miss would be; any combined content under ~820px at
this viewport produces the identical pinned-to-viewport result.

**Verified: gate 5 passes at 1440×900** (`scrollHeight: 900`, `overflow: 0`).
**Accepted residual at 1280×800** (per explicit instruction): `scrollHeight: 891`,
`innerHeight: 800`, **overflow: 91px** — the approved design frame is itself
1360px tall (80 header + 1280 content), so a no-scroll L0 at 800px vertical was
never achievable without illegible constellation text; logged as accepted, not
silently fixed further. Polyline-to-node-center alignment re-verified after the
scale wrapper at 1280, 1440, and 1920: all four vertices within 0.5px of their
card centers on both axes (well inside the 2px gate), confirming the scale
wrapper preserves board-1i geometry exactly rather than re-deriving it.

## L0 refinement — C3: satellite orbit, hover teasers, link affordance, chained zoom

**Orbit mechanism: CSS keyframed `transform`, not rAF.** Per-node
`@keyframes orbit-wd/-mc/-edu`, piecewise-linear waypoints at cumulative
segment-length fractions (linear timing = constant perimeter speed), one
`animation-name` per node via `.node--wd .node__satellite { animation-name:
orbit-wd; }` etc. `animation: none var(--orbit-period) linear infinite;` on
the base `.node__satellite` rule sets duration/timing/iteration-count via
shorthand while defaulting `animation-name` to the `none` keyword (a safe
fallback for any satellite not covered by a per-node override); the
longhand `animation-name` override on the per-node selector only touches
that one sub-property. Per-satellite start position: `animation-delay:
calc(-1 * var(--s) * var(--orbit-period))` (negative delay seeks into the
cycle immediately at load, no visible "wind-up"). Rejected rAF: a
permanently-running main-thread timer for ~0.2px/frame motion is waste: the
compositor animates `transform` off-thread for free, and pause (`:hover`/
`:focus-visible` → `animation-play-state: paused`) and reduced-motion (see
below) both have declarative answers. Rejected `offset-path`: path
coordinates resolve against the containing block, so per-node card sizing
would leak into the path, and reduced-motion rest positions would still
need per-satellite transform overrides regardless — no win over keyframes.

**Reduced motion:** `.node__satellite { animation: none; transform:
translate(-50%, -50%) translate(var(--rest-x), var(--rest-y)); }` — the
explicit static `transform` is required, not optional: disabling the
animation alone leaves `transform` unset (the property is entirely
animation-driven in the motion-enabled path), which would collapse every
satellite to its card's exact center instead of its per-satellite rest
position. End-state visible, never hidden, per Commandment 6.

**Link affordance (ruling 3's required addition):** `.node__satellite--link`
gets a rest-state accent-tinted border (new token `--satellite-link-border`:
`#B07FFF66` dark / `#7C3AED66` light — 40%-alpha, quieter than the shared
full-accent hover state) plus a trailing `::after { content: '\203A' }`
chevron. Both cues together, not color alone (color-blind users). Hover/
focus-visible styling stays identical for both link and informational
pills (full accent border + text color) — the distinction is rest-state
only, by design (hover already means "this is interactive" regardless of
kind). Verified: computed `border-color` differs between a link satellite
and an informational one; chevron `content` present only on links; cursor
`pointer` vs `default`.

**Hover teasers:** child `<span class="satellite__teaser" aria-hidden="true">`
per satellite, `aria-label` set on the satellite itself so its accessible
name stays the plain pill label (teaser is a visual preview only; full
content lives on the linked/would-be-linked page). Copy per the approved
table, three span classes (`-title`/`-meta`/`-accent`) matching existing
`--text-color`/`--meta-color`/`--accent-color` token usage. Counter-scaled
by `scale(calc(1 / var(--constellation-scale)))` (composed with the
existing `translateX(-50%)` centering, `transform-origin: 50% 100%` above /
`50% 0%` below) so the 0.72rem teaser text reads at its authored size
despite the L0 constellation's 0.78 scale-down — the counter-scale is
isolated to `.satellite__teaser`, an absolutely-positioned overlay, so it
doesn't touch orbit geometry.

**Side flip:** `bindSatelliteTeasers(root)` (registered alongside
`bindParallaxNodes`, same `dataset` bind-once guard, called at init and in
`swapStage`) measures the pill's `getBoundingClientRect()` center-Y against
its node's `.node__card` center-Y on `mouseenter`/`focusin` and toggles
`.teaser-below`; exact at reveal because the orbit is paused while
hovered/focused (measurement cannot go stale mid-hover), and identical
under reduced motion (measures the static rest position). Ties within
±2px keep the above anchor. Rejected a discrete-keyframe top/bottom swap
(engine-quirky timing; the flip only matters at reveal, where a
measurement is exact). Verified at both orbit extremes (forced via a
clean `animation: none` + reflow + `animation-delay` + `animation-
play-state: paused` reset — a naive delay change on an already-running
animation seeks from load time, not from the moment of the test, and
silently lands on the wrong frame) for one satellite per node plus both
Education satellites: top phase → teaser above, disjoint from card and
siblings; bottom phase → `teaser-below` present, teaser below the pill,
disjoint from card and siblings.

**Chained zoom pacing — gate-8 correction.** `CHAIN = { compress: 0.7, gap:
0 }` (pre-approved) scales the second push's `scaleDur`/`fadeDur`/`delay`
by 0.7, `Math.round`ed. `chainZoom` prefetches both pages before the first
push starts (`Promise.all([loadPage(parentUrl), loadPage(childUrl)])`), so
neither push stalls on network; each `zoomIn` call's own `loadPage` then
hits the cache. Overlapping pushes rejected — the second push measures its
origin (`stage.querySelector('a[href="' + childUrl + '"]')`) in the
finalized L1 DOM, and nesting un-finalized zoom layers has no defined
visual. The plan's original "≈1190ms total" pacing estimate summed only
the two `scaleDur` values (700 + 490) and didn't count each push's own
start `delay` — the animation actually finalizes (and `history.pushState`
fires) at `delay + scaleDur` per push, not at `scaleDur` alone: first push
896ms (196+700) + second push 627ms (137+490) = **1523ms theoretical**,
**1583ms measured live** (instrumented via a `history.pushState` hook,
click to second `pushState`) — the original 1300ms gate was arithmetically
unreachable with `ZOOM.delay` (locked) and `CHAIN.compress: 0.7` (also
pre-approved) both held fixed. Per Michael's ruling: keep `compress: 0.7`
(the smoother second push), gate 8's threshold corrected to **~1600ms**
(covers the measured 1583ms with headroom for real-machine variance) —
documented here rather than silently fudging either fixed constant to hit
the original number.

## L0 refinement — C4: indexed background stars

**Colors sourced from board 1d/1e exactly, not board 1a's own hardcoded
dark-only preview.** Resting: 3px dot `#e8eefa` (matches `starfield.js`'s
dark-theme star sprite color — the indexed stars read as literal stars
among the canvas backdrop, same palette) + `0 0 4px 1px` glow at 30%
alpha; label `#2c2c31`, 9px mono, 0.1em tracking — "grain until you look."
Hover: dot 4px accent + `0 0 8px 2px` accent glow at 50% alpha, label
accent. Active (`.is-active`): dot 5px core `var(--text-color)` (the
design's own literal `#ffffff` is dark-theme-only; board 1e's caption
explicitly says "core white = `--text-color` so light theme inverts
sanely," so the plan's own translation is followed here, not the raw
mockup value) + `0 0 10px 3px` accent halo at 55% alpha, label accent, no
node box-shadow. New tokens (both themes): `--istar-dot`/`--istar-dot-glow`
(light theme mirrors `starfield.js`'s light-theme "dark speck" sprite
color `#161a22`, not a lightened version of the dark dot — same rationale
as the dot-color choice above), `--istar-label`, `--istar-hover-glow`,
`--istar-active-glow` — hex-plus-alpha-suffix notation, matching the
existing `--icon-*-border/-bg` token pattern.

**Percentages are approximations against a re-flowed layout, verified and
nudged, not trusted as-authored.** The plan's `--x`/`--y` values transcribe
the 1440×1360 design frame's coordinates, but C2's gate-5 fix (hero cut
from ~550px to ~213px, section padding cut, constellation scaled to 0.78)
changed the proportions those percentages were computed against — the
plan anticipated exactly this ("percentages transcribe the design frame
... as approximations... nudge and re-measure on collision"). Disjointness
swept against hero, all 4 node cards, and each node's orbit-swept envelope
(card half-width + board-1i half-extent + ~60px pill half-size) at
1280/1440/1920: `indexed-star-pqe-22` (`--y:33.2%`, targets `node-workday`)
collided with `node-two-sided-data-platform`'s card at 1280 and 1440 — an
unrelated node collision purely from coordinate translation, not a
relationship the star's own target implies proximity to. Nudged
`--y: 33.2% -> 29.5%` (a 3.7% shift, within the plan's ±4% allowance);
re-swept clean (zero collisions) at all three widths.

**Reduced motion:** stars have no orbit/motion of their own (position is
static; only the hover/active dot size and color are CSS-transitioned,
not swept animation) — no `prefers-reduced-motion` override was added
because there is no motion path to suppress. Verified the click-activate
interaction (not a transition-based check) end-to-end under reduced-
motion emulation: click still sets `.is-active`, `aria-pressed`,
`node--flagged`, and draws the link line — the interaction is JS-state-
driven, not animation-driven, so it is unaffected by the media query
either way.

**Escape clears all three states** (star `.is-active`/`aria-pressed`,
node `.node--flagged`, link `.is-visible`) via a document-level `keydown`
listener bound once (module-scope guard `starsGloballyBound`), not
re-bound on every `swapStage` call — repeat visits to L0 would otherwise
accumulate duplicate `document`/`window` listeners across the page's
lifetime. `activeStar`/`activeNode` are reset (not just left stale) at
the top of every `bindIndexedStars` call so a lingering reference from a
previous L0 render can never leak into a fresh one.

## L0 refinement — C6: retire /contact, drawer Contact becomes a wayfinder

**Route deleted, own commit.** `git rm public/contact/index.html`. Grep for
`/contact` across `public/` returned exactly the 9 expected drawer-item
references before this commit and zero unexpected ones — no sitemap, no
other internal link referenced the route. Post-fix grep is zero.

**Drawer's Contact item: `<a href="/contact">` → `<button
class="drawer__contact" data-testid="menu-link-contact" aria-label="Jump
to contact links">`.** Testid deliberately unchanged (the handoff map
holds; the element-type change is called out explicitly there instead).
Styled by extending the existing shared `.drawer > a, .drawer__group { }`
/ hover selectors to include `.drawer__contact`, rather than duplicating
the rule — same 12.5px mono, same padding, same hover-to-accent.
`updateMenuActive`'s `drawer.querySelectorAll('a[data-testid^="menu-link-"]')`
selector already excludes buttons by construction (no code change needed
there) — a button never carries `aria-current`, matching the earlier
ruling.

**Activation: close drawer → focus `header-email` → pulse.** The focus
move is the actual affordance, not the pulse — a glow alone is useless to
keyboard/screen-reader users. Normal motion: `.header__contact` gets
`.is-pulsing`, a `box-shadow` keyframe animation (`--contact-pulse: 900ms`,
new motion tunable) that settles then fades, removed on `animationend` so
it can re-fire on a repeat activation (with a forced reflow via
`void headerContact.offsetWidth` before re-adding the class, in case a
second click lands mid-pulse). Reduced motion: `.is-pulse-static` — a
static 2px accent outline, no animation — cleared on `focusout` leaving
`.header__contact` (checked via `!headerContact.contains(e.relatedTarget)`,
so tabbing BETWEEN the three contact icons does not clear it early) OR
after `--contact-pulse` elapses via `setTimeout`, whichever fires first;
parsed from `getComputedStyle`, falls back to 900 if parsing ever fails.
Verified both paths live: normal motion reaches full `box-shadow` then
clears to `none`; reduced motion shows the static 2px outline immediately
with `animationName: none`, stays present while focus moves within the
icon group, and clears the instant focus leaves it.

**Contact surface correctness.** All three hrefs
(`mailto:michaelmuchane@gmail.com`, `https://github.com/michaelmuchane`,
`https://www.linkedin.com/in/michael-muchane/`) verified verbatim across
all 9 remaining pages via grep (27/27 matches — 3 hrefs × 9 pages). Live
reachability of the two external profile URLs was not probed — an
agent-initiated external fetch to github.com/linkedin.com is ASK-gated per
`.omp/AGENTS.md` §3, and this pass didn't request it; recorded as
string-verified but unprobed, per the plan's own explicit fallback for
this case.

**`/contact` direct-load behavior (what production's `try_files` will need
to handle):** the local static host (`npx serve`) returns **404** with its
own generic not-found HTML page for a `fetch('/contact')`. This is not a
redirect and not a soft-200 — a real 404 status. Logged here so whoever
lands the production `try_files` rewrite (an existing, separate deploy
blocker — see below) knows the local baseline behavior it's replacing.

**Testid delta: 90 → 86** (fresh `find public -name '*.html' | xargs
grep -hoE 'data-testid="[^"]+"' | sort -u | wc -l`, not arithmetic).
Retired: `contact-list`, `contact-email`, `contact-github`,
`contact-linkedin` (the four testids that only existed on the now-deleted
page). `menu-link-contact` stays at 86 (testid unchanged, element type
changed from `<a>` to `<button>` — noted, not counted as a delta).

## L0 refinement — fix pass: scroll restored, scale/spread widened, dark-only, chain easing

**Gate 5 retired.** Michael's ruling: the approved design frame is
1440×1360 — L0 was always meant to scroll. The earlier no-scroll ruling
(C2b, `gate-5 vertical-fit fix`) is superseded; the hero-trim/section-
padding-cut/scale-wrapper mechanism it introduced stays (still needed so
`--constellation-scale` < 1 doesn't leave dead space) but its *target*
changes from "fit in 900px" to "generous, scrolling." Replaced the
`scrollHeight <= innerHeight` assertion with an above-the-fold check:
`.constellation-wrap`'s top edge must be above `innerHeight` at 1440×900
(a visitor must land ON the constellation, not scroll to find it).
**Measured: `wrapTop: 536px`** at 1280×800, 1440×900, and 1920×1080 alike
(header 80 + hero 400 + section-padding-top 56 = 536, viewport-independent
since none of hero/section/header are `vh`-based anymore) — comfortably
above the fold at every tested size (largest margin: 800−536=264px at
1280×800).

**Hero restored to a fixed, generous size — not the original `70vh`.**
`min-height: 400px; padding: 48px 40px;` (was `12px 40px 8px`, no
min-height, post-gate-5-cut). `.hero__copy` gets back `margin-top: 24px`
and `max-width: 62ch` (both cut at C2b). **Measured: `heroHeight: 400px`**
at all three checked widths — within Michael's 380–450px target, pinned
by the fixed `min-height` rather than viewport-dependent, so it won't
drift at other widths the way the original `70vh` version did.

**`.constellation-section` padding restored to fixed values, not `vh`.**
`56px 40px 88px` (was `20px 40px 32px` post-cut; original pre-cut was
`8vh 40px 14vh`). Deliberately fixed px this time per Michael's explicit
instruction ("comfortable fixed values") — asymmetric top/bottom mirrors
the original's proportions (more breathing room above the telemetry strip
than below the hero) without reintroducing viewport-dependent sizing.

**`--constellation-scale` raised 0.78 → 1.0.** The 0.78 floor set at C2b
made 0.72rem satellite pill text render at ~9px — illegible, per Michael's
own report. At scale 1.0 the same text renders at its full 0.72rem
(~11.5px at default root size). **Disjointness swept at 1280/1440/1920,
8 orbit phases each (0%, 12.5%, …, 87.5% via `Animation.currentTime`
seeking — the animation-delay-override technique used at C3's gate 7 does
NOT reposition an already-running/paused animation and silently no-ops;
`getAnimations()[i].currentTime = ` is the reliable seek), against every
card, every sibling satellite, and every indexed star: zero collisions at
every sample.** Scale stays at 1.0 — the 0.9-floor/0.05-step fallback in
Michael's instruction was never needed.

**`--constellation-max-width` introduced: `min(1600px, 92vw)`** (was a
hardcoded `1200px` on both `.constellation` and `.constellation-wrap`).
Node positions are `%`-based so they spread with the wider container;
satellite orbit rectangles are fixed-px offsets from each card's own edge
(board-1i geometry) and are therefore unaffected by container width —
only the *gaps between node centers* grow. **Measured node-center spread
(leftmost to rightmost of the four L0 nodes): 889px @1280w, 1000px
@1440w, 1208px @1920w** (was capped at ~950px max regardless of viewport
under the old 1200px cap). Re-swept disjointness after widening (see
above) — zero collisions, confirming the plan's own expectation that
wider gaps make crowding easier, not harder.

**`.constellation-wrap`'s height mechanism reworked — the first attempt
(a self-referential `aspect-ratio: calc(12 / var(--constellation-scale))
/ 7`) does not work and was replaced before commit.** Tried it because it
looked elegant (no duplicated width formula, reacts to the wrap's actual
rendered width at any breakpoint). It measurably failed: `.constellation`
is a normal in-flow child of the wrap with its OWN `aspect-ratio: 12/7`
at its own (unscaled) width, and per the CSS block-sizing algorithm, a
block container's `auto` height with in-flow content sizes to CONTAIN
that content — the child's native (untransformed) height wins over the
parent's own `aspect-ratio` hint every time, regardless of what the
parent's aspect-ratio computes to. Verified live: computed
`aspectRatio` on the wrap correctly showed the scale-adjusted ratio
(`13.3333 / 7` at scale 0.9), but `getBoundingClientRect().height`
never moved off the unscaled value. **Final mechanism:** direct
`height: calc(var(--constellation-max-width) * 7 / 12 *
var(--constellation-scale))` — computed from the same cap the width
uses, not measured from the child. This is *exact* wherever
`--constellation-max-width` is the actual binding constraint on
`.constellation`'s width, which holds at every checked breakpoint
(1280/1440/1920 — verified `viewport ≥ 1000px` is the exact threshold:
below that, `.constellation-section`'s available width, `viewport−80px`,
can undercut the `92vw` term before it clamps to `1600px`, so the
formula would overestimate height slightly). Same accepted-residual
class as gate 5's old 1280×800 overflow — logged, not silently ignored,
and outside the three widths Michael asked to be verified.

**Header left group is MENU-only** — the requested "MENU, then
DARK/LIGHT" swap is moot: light mode was removed in the same pass (see
below), so there's no toggle left to order. `header__logo` (hidden at
L0, visible at L1/L2 per the original spec) still precedes `menu-trigger`
in DOM order; tab order at L0 is simply `menu-trigger` → the three
header contact icons, verified via the swapped-then-superseded markup —
no dangling ordering question remains.

**BU teaser copy: `MS Applied Data Analytics` → `Master of Science`.**
Matches WFU's `Bachelor of Science` — both satellites now read as
institution + degree level only, per Michael's explicit correction.

**Indexed-star resting visibility — iterated past the first proposed
step, per Michael's own stated preference ("I'd rather go further than
pretend the number was the goal").** `--istar-label` against `--bg-color
#0a0a0a`, WCAG contrast ratio at each step:

| Value | Contrast vs bg | Note |
|---|---|---|
| `#2c2c31` (original) | 1.43:1 | Michael's complaint: effectively invisible |
| `#3a3a42` (Michael's proposed "~25%" step) | 1.76:1 | rendered + inspected: still assessed as "reads as grain, blends in," not yet "noticeable on purpose" |
| `#52525f` (2nd step) | 2.58:1 | rendered + inspected: better but still borderline/"deliberate hunt" |
| **`#6b6b7a` (final)** | **3.78:1** | rendered + inspected: labels (`TSDP-25`, `WD-2019`, `PQE-22`, `WFU-2019`) legible in a normal scan, still small/mono/dim enough to read as environmental detail rather than UI chrome |

Settled at `#6b6b7a` (2.65× the original ratio) after two independent
vision-model assessments of live screenshots at each step — the first
proposed value (`#3a3a42`) was rendered and honestly reported as still
marginal rather than accepted on the arithmetic alone. `--istar-dot-glow`
alpha lifted 30%→40% (`#e8eefa4d` → `#e8eefa66`) per "lift the dot's glow
slightly" — the dot itself (bright `#e8eefa` core) was never the
legibility problem, only the label was.

**Light mode removed entirely — one-way door.** Ruling: this design is
dark-only; a starfield backdrop does not survive inversion (dim specks on
white collapse the core visual concept). Removed:
- `html.light-mode` token block (`style.css`) — every token collapses to
  its single (former dark) value; no `prefers-color-scheme` media query
  added, per explicit instruction — the site is unconditionally dark.
- `.theme-toggle`/`.theme-toggle__opt*` CSS rules and markup on all 9
  pages (testids `theme-toggle`, `theme-toggle-dark`, `theme-toggle-light`
  retired — **testid count 86 → 83**, fresh grep, matches exactly).
- `app.js`: `themeDark`/`themeLight`/`htmlRoot` vars, `syncTheme()`,
  `setTheme()`, both click listeners, the init `syncTheme()` call.
- Every page's inline FOUC-guard head script
  (`localStorage.getItem('theme')...`).
- `starfield.js`: the light-theme "dark speck" sprite (`spriteDark`),
  `applyTheme()`'s branching, the `effCeiling`/`effMaxSize` indirection
  (now reads `TUNING.ceiling`/`TUNING.maxSize` directly), and the
  `MutationObserver` watching `documentElement`'s class list (nothing
  changes it anymore).
- Grepped `light-mode|theme-toggle|localStorage.*theme|themeDark|
  themeLight|syncTheme|setTheme|applyTheme` across `public/` post-removal:
  **zero matches** — nothing unexpected turned up before deletion; the
  scope was exactly the 9 head scripts + 9 markup blocks + the three JS
  files, as expected going in.
**Consequence, accepted deliberately:** visitors whose OS prefers light
now always get dark. **Reintroducing light mode later means re-deriving
every token pair from scratch** — this pass did not preserve the deleted
`html.light-mode` values anywhere as a starting point.

**Chained-zoom velocity discontinuity — fixed by giving the first push a
non-decelerating easing, per Michael's diagnosis (confirmed correct).**
Both pushes previously used `QUINT_OUT` (`cubic-bezier(0.22, 1, 0.36,
1)`) — an ease-OUT curve: fast start, decelerating to near-zero velocity
at the end. Push 1 therefore always arrived at the L1 handoff already
slowed to a near-stop; push 2 then started its own `QUINT_OUT` animation
at ITS fast start — the visible result was a hard velocity snap
(near-zero → fast) at the seam, independent of `CHAIN.gap` (confirmed
0ms gap doesn't hide it — the discontinuity is in the easing curves
themselves, not spacing). **Fix:** added `CHAIN.firstEase`, defaulting to
`QUINT_IN` (`cubic-bezier(0.64, 0, 0.78, 0)`, the mathematical inverse of
`QUINT_OUT` — slow start, FAST finish), applied only to a chain's FIRST
push's two scale animations (`buildAnimations` and `zoomIn` both gained
an optional trailing `easing` param, defaulting to `QUINT_OUT` when
omitted). Push 2 keeps `QUINT_OUT` unchanged ("so the motion still
settles," per instruction) and every standalone single-push zoom
(non-chained node clicks, and `zoomOut`) is untouched — neither call site
passes the new param. `window.MOTION.CHAIN.firstEase` is live-tunable in
devtools like the rest of `CHAIN`/`ZOOM`.

**L1 finalize gap, measured (not assumed).** Instrumented `Element.
animate` via a temporary prototype wrapper timestamping every WAAPI call
start/finish during one live chained click: push 1's last scale
animation to finish (`zoom-layer--in|scale`) ended at t=1383.3ms; push
2's first animation started at t=1389.3ms. **Gap: 6ms — 0.36 of a frame
at 60fps, well under the ~1-frame threshold** in the instruction. The
`finalizeIn` DOM swap plus `chainZoom`'s cache-hit `loadPage` between
pushes is not where the stutter came from; the easing fix above was the
correct and sufficient diagnosis. No engine change (single continuous
transform, overlapping layers) was attempted or needed, per the explicit
instruction to keep that out of scope for this pass.

**Chained zoom re-verified after both changes:** `history.length` still
increases by exactly 2 per chain click (two `pushState` calls, unchanged
by the easing edit); two sequential `history.back()` calls pop
`/workday/senior-product-quality-engineer` (depth 2) → `/workday` (depth
1) → `/` (depth 0), one level at a time. Reduced-motion chain (hard swap,
no WAAPI at all) still completes correctly and instantly — unaffected by
the easing change since it never reaches `buildAnimations`.

**[FUTURE] Satellite teaser can overlap its own parent card at SIDE orbit
positions — genuine latent bug, found during this pass's re-verification,
NOT a regression from anything in this pass.** `bindSatelliteTeasers`'s
flip logic (`app.js`) is vertical-only: `satCenterY − cardCenterY > 2` ⇒
`.teaser-below` (renders under the pill), else the default "above the
pill" position. Gate 7 (C3) only ever sampled orbit phase 0 and 0.5 (top
and bottom of the rectangular path) — both pass. Sweeping all four phases
(0, 0.25, 0.5, 0.75) during this fix pass's re-verification found that at
the SIDE phases (0.25 and 0.75 — satellite roughly level with the card's
own vertical center, off to its left/right), `satCenterY − cardCenterY`
is near zero, so the teaser stays in its default "above" position — but
since the teaser is horizontally centered on the pill (`left: 50%`) and
the pill itself sits close to the card at those phases (14px clearance
per board 1i), the teaser's near edge reaches back over the card.
**Measured: `overlapsCard: true` at `satellite-workday-1`, frac 0.25**
— reproduced identically at both this pass's values
(`--constellation-scale: 1`, `--constellation-max-width: min(1600px,
92vw)`) and the pre-fix-pass values (`0.78`, `1200px`), confirming it
predates this pass entirely and was simply never sampled. Affects at
least `satellite-workday-1`, `satellite-muchane-cloud-1`,
`satellite-muchane-cloud-3`, `satellite-education-1`,
`satellite-education-2` at 1440×900 (not exhaustively checked at other
widths). **Not fixed here** — a real fix needs a horizontal
flip/clamp/suppress mechanism (multiple viable shapes: quadrant-aware
flip using both axes, a radial offset from card center instead of
pill-anchored, or a horizontal clamp against the card's own rect) and is
a product decision per Commandment 11, not a code-only call. Bug-fix
work in this repo also starts red (Commandment 9) — the reproduction
above is exactly that red case; a follow-up session can go straight to
writing the fix once Michael picks a mechanism. Flagged to Michael
directly in this pass's hand-back; logged here so it isn't lost.

## L0/L1 fix-and-extend pass — three-state satellite affordance

**Dotted border replaces plain border for informational (non-navigable)
satellites; navigable satellites are unchanged.** Muchane Cloud's two and
Education's two satellites previously rendered with the same plain
`1px solid var(--border-color)` as their resting state, which read as
"broken/unfinished" rather than "informational" — indistinguishable from a
card that simply hadn't been hovered yet. New `.node__satellite--info`
class sets `border-style: dotted` with `border-color:
var(--satellite-link-border)` (the same accent-tinted color the navigable
`--link` variant already uses), signaling "there is content here, hover
it" without promising a destination. Applied to `satellite-muchane-cloud-1`,
`satellite-muchane-cloud-3`, `satellite-education-1`,
`satellite-education-2`. Workday's three satellites keep `--link`
(solid border + chevron) unchanged. Informational pills keep their
existing `tabindex="0"`, teaser-on-hover/focus, and `cursor: default` —
only the border style/color changed.

**Conversion path for when an L2 page gets real content (no stub pages
created in this pass — Commandment 9/12):** change the satellite's element
from `<span class="node__satellite node__satellite--info" tabindex="0">`
to `<a class="node__satellite node__satellite--link" href="/<route>"
data-zoom="chain">` — testid, `aria-label`, the `.satellite__teaser`
markup, and the `--s`/`--rest-x`/`--rest-y` custom properties all stay
exactly as they are; nothing else changes.

## L0/L1 fix-and-extend pass — "Two-Sided Data Platform" → "DaaS Platform" (display label only)

**Display-label-only rename, route preserved — same pattern as iapply's
"Career Command Center" rename.** Every occurrence of the string
"Two-Sided Data Platform" as user-facing text (drawer item, L0 node
title, page `<title>`, L1 `<h1>`, L2 up-link text) across all 14
occurrences in 10 files changed to "DaaS Platform". The route
(`/two-sided-data-platform`), directory name, and every `data-testid`
(`node-two-sided-data-platform`, `menu-link-two-sided-data-platform`,
etc.) are unchanged. `grep -rn 'Two-Sided Data Platform' public/`
returns zero matches post-rename.

## L0/L1 fix-and-extend pass — DaaS Platform's first satellite (navigable), orbit derivation

**One satellite, "Wrangling," linking to the existing
`/two-sided-data-platform/multimodal-data-wrangling-application` L2
page — single word verbatim from that page's own heading ("Multimodal
Data Wrangling Application"), full heading in `aria-label` and the
teaser title, meta/accent are verbatim pitch fragments, no client or
company named.** DaaS Platform had no satellites and no orbit
geometry; derived the rectangular path the same way board 1i did for
Workday/Muchane Cloud/Education: card rect inflated by clearance +
pill half-size, vertical half-extent pinned at ±72, horizontal
half-extent set by card half-width + real clearance + pill half-width.
Card half-width (post-rename, "DaaS Platform") measured 98.09px live,
viewport-independent (a fixed CSS width, not a percentage).

**Two measurement bugs caught and corrected during implementation,
in sequence — both by live browser measurement, neither by
re-reasoning from the original plan's numbers:**

1. **Self-overlap with the parent card, caught by a live phase sweep.**
   The pre-implementation plan used a bare mathematical floor
   (`A = ceil(cardHalf + pillHalf)`, no explicit clearance term), which
   gave a sub-pixel (0.16px) real-world margin. Pausing the WAAPI
   animation and seeking `currentTime` to 8 phases (0, 0.125, …0.875),
   forcing a reflow, and checking `getBoundingClientRect()` overlap
   against the parent card showed the pill overlapping
   `node-two-sided-data-platform` at phases 0.25 and 0.75 — reproduced
   at all three widths. Re-ran the identical sweep against
   `satellite-workday-1` vs `node-workday`: zero overlap at any phase,
   confirming this was a real, DaaS-specific defect, not a false
   positive. Fix: added an explicit clearance term matching Workday's
   own real shipped margin (`161 - 71.57(cardHalf) - 85.665(pillHalf) =
   3.765px`) — `A = ceil(cardHalf + 4 + pillHalf)`.
2. **Pill-width measurement itself was ~7px short, caught by
   comparing a synthetic probe against the real live element.** Every
   width measured via a cloned, shallow (`cloneNode(false)`) probe
   element with `probe.textContent = label` (no earlier session's
   numbers, nor this pass's first attempt, caught this). The REAL
   satellite markup — matching every existing satellite — has a
   trailing newline + indentation between the label text and the
   nested `<span class="satellite__teaser">`, which HTML whitespace
   collapsing renders as one trailing space; the shallow-clone probe
   never included that nested span, so it never included the trailing
   space either, undermeasuring every candidate by the width of one
   rendered space (~7.17px in this font/size). Re-measured every
   candidate directly on the live satellite element (setting
   `sat.childNodes[0].textContent = label + '\n' + <same indentation>`)
   to exactly reproduce the real markup: "Data Wrangling" 142.67px
   (was measured 135.50), "Wrangling App" 135.50px (was measured
   128.34), "Wrangling Application" 192.83px, "Wrangling" 106.84px.

**With corrected widths and the real clearance term, NEITHER of this
pass's original two candidates fits the 1280 viewport budget.**
Budget at 1280 (unchanged): `A + pillHalf ≤ 237.25` (gutter +
card-center-x). "Data Wrangling" → `A=174`, viewport margin
**−8.09px**. "Wrangling App" → `A=170`, viewport margin **−0.5px**.
Both fail. Tried every contiguous-or-single-word-abbreviation label
derivable from the heading "Multimodal Data Wrangling Application"
with the corrected measurement method; only single-word "Wrangling"
clears both constraints with real margin: `A=156`, card-clearance
margin **+4.49px** (comparable to Workday's 3.77px precedent),
viewport margin **+27.83px** — an order of magnitude more robust than
any two-word candidate. Font-robustness re-confirmed at this final
width: site stack/system-monospace/Courier New widths 106.84 / 106.84
/ 106.59px, margins 4.49/27.83 (site, monospace) and 4.62/27.95
(Courier) — comfortably positive in every state. "Wrangling" alone
reads as abstract without context, but every other satellite on this
site (Workday's abbreviated role titles, Education's "BU"/"WFU"
institution initials) already relies on the hover teaser (full
heading here) to supply the complete meaning — consistent with the
established pattern, not a new departure.

**Derived geometry (final):** `A = ceil(cardHalf + 4 + pillHalf) =
ceil(98.09 + 4 + 53.42) = 156`, vertical half-extent 72. Perimeter
`4×(156+72)=912`; waypoints (cumulative length/perimeter, top center,
clockwise): 17.11% / 32.89% / 67.11% / 82.89%. Single satellite at
`--s: 0` (top center, rest `0,-72px`). **A second DaaS satellite would
take `s: 0.5`** (bottom center, matching the Muchane Cloud/Education
two-satellite pattern) — the A=156/vertical-72 rectangle would need
re-deriving only if the second satellite's own label is wider than
"Wrangling".

**Clearance proof — DaaS's swept envelope against every other node,
1280/1440/1920 (all previously unchecked against DaaS's position at
the constellation's top-left), using the final A=156, pillHalf=53.42,
pillHalf-height=12.055.** Swept pill-body envelopes (half-extents
x×y): DaaS 209.42×84.1, WD 246.66×84.1, MC 289.25×84.1, EDU
160.75×84.1.

| Pair | Axis | 1280 | 1440 | 1920 | Required | Verdict |
|---|---|---|---|---|---|---|
| DaaS↔WD | y | Δ387.4 | Δ435.9 | Δ526.4 | >168.2 | clear |
| DaaS↔MC | x | Δ588.8 | Δ662.4 | Δ800.0 | >498.7 | clear |
| DaaS↔EDU | x | Δ889.1 | Δ1000.2 | Δ1208.0 | >370.2 | clear |

DaaS↔MC fails on the y-axis at 1280 only but clears on x at every
width, satisfying board 1i's one-axis-clear criterion. Envelope stays
inside the container vertically at every width; the horizontal
envelope stays comfortably inside the viewport at every width
(27.83px margin at 1280, more at wider viewports). Re-verified against
all six indexed stars post-fix: zero overlaps at 1280/1440/1920.
Self-overlap-with-own-card re-verified fixed with the final A=156
geometry: zero overlap at all 8 sampled phases × 3 widths (24/24).

**[FUTURE] The DaaS satellite makes the existing spec-case-21
teaser-side-overlap defect (logged above, not fixed in this pass)
worse.** On the left run (phases approaching the left vertex), the
hovered teaser (230px max-width, centered on the pill) clips the
viewport's left edge — DaaS's left run sits closer to the viewport
edge than any existing satellite's, since DaaS is the constellation's
leftmost node. No fix applied here; same [FUTURE] disposition as the
pre-existing case.

## L0/L1 fix-and-extend pass — email icon clipboard fallback ("Address copied")

**Diagnosis: the code was never the defect.** `header-email` already
had `href="mailto:michaelmuchane@gmail.com"` verbatim on all 10 pages
(shipped commit `49af3f5`); a real click event fires with
`defaultPrevented: false`, the delegated zoom handler ignores it (no
`data-zoom` attribute), and CDP confirms `Page.frameRequestedNavigation`
→ the mailto URL fires on every click. The reported inertness is the
OS/browser external-protocol handoff: a visitor with no default mail
client configured (most webmail users) clicks and sees nothing happen.

**Fix: keep the mailto exactly as-is (no webmail fallback, no
provider-specific URL), add a clipboard-copy side channel with a
focus-gated confirmation.** `header-email`'s click handler (app.js,
first IIFE, after the Contact wayfinder block) also calls
`navigator.clipboard.writeText('michaelmuchane@gmail.com')`, never
`preventDefault`s, and degrades silently (no visible failure) when the
Clipboard API is absent or permission is denied.

**"Address copied" note is gated on the page still having focus 150ms
after the copy succeeds — deliberately, to avoid reading as an error
or duplicate action for visitors who DO have a mail client.** For
those visitors the mailto handoff to the external client is the
expected, successful outcome; showing a confirmation banner over an
already-open compose window would look like a stray, unrelated
action, not a confirmation. The check: `setTimeout(() => { if
(document.hidden || !document.hasFocus()) return; …show note… }, 150)`.
Verified in this session (no OS mail client is registered in the
sandboxed test browser, so the "client opens" path could not be
exercised end-to-end against a real client): with `document.hidden`/
`hasFocus()` mocked to simulate a lost-focus state at the 150ms check,
the note is correctly suppressed and the mailto request still fires;
with focus retained (the actual sandbox behavior — no client
registered), the note displays normally. Michael should re-confirm
the "client opens, no stray note" half of this on a machine with a
real mail client registered, since that path is unexercisable here.

**Timing:** note stays visible for `2 × --contact-pulse` (currently
1800ms), fades over `--contact-pulse / 4.5` (200ms) — the same
`--contact-pulse` tunable the drawer's Contact-wayfinder pulse already
uses, so both retune together. `role="status"` announces the
confirmation to screen readers. Under `prefers-reduced-motion:
reduce`, the fade transition is removed (instant show/hide) but the
JS-timed visible duration is unchanged. The note element is created
lazily on first successful copy (no markup change on any of the 10
pages) and repeat clicks restart its hide timer via `clearTimeout`
rather than stacking duplicate notes.


## Changelog content model — Muchane Cloud pages (text-first)

**Replaced the `/muchane-cloud` TODO block with a changelog/release model**
across all three Muchane Cloud pages (`/muchane-cloud`,
`/muchane-cloud/career-command-center` [new],
`/muchane-cloud/self-hosted-infra` [new]). One data file,
`public/muchane-cloud/changelog.json`, holds 15 release entries keyed by
slug plus a `pages` map giving each page's explicit slug order — the doc's
amendment A1 forbids reordering, so order is data, not renderer logic.
Entries render client-side (`renderChangelog`/`loadChangelog` in app.js,
inside the existing zoom-engine IIFE — no new JS files, matching the
file's single-file convention) into `[data-changelog]` containers.

**Renderer lives in app.js, not a new file.** The zoom engine fetches the
*next* page's raw HTML and swaps it into `#stage`; a separate script tag
on the fetched page never executes. Any changelog-rendering code has to
run from the currently-loaded script, so it belongs in the same file that
already owns page-swap lifecycle (`swapStage`, `zoomIn`, `finalizeIn`,
popstate). This is also why cache-busting (below) had to land on `app.js`
specifically: a stale edge-cached copy would break changelog rendering on
every client-side navigation into a cloud page, not just on a hard load.

**`shots` is schema-reserved but ships empty on every entry this pass.**
The copy doc's SHOT specs (capture framing, "demo-tenant content only",
sanitization notes) are internal build instructions, not site copy, and
`changelog.json` is a publicly fetchable file. Transcribing them would
leak unshipped work and the screenshot-sanitization approach to anyone
who requests the JSON. The screenshot embed component (`.entry-shot`,
soft backlight via `--istar-active-glow`) ships now, `hidden` + `is-hidden`
on every instance, so its testid exists ahead of the Playwright rebuild
per the checklist, with zero visible output (amendment A2).

**One approved copy amendment:** the dual-path-network entry's SOLUTION
section reads "NPM to Kong to services" in the source doc. On a public
engineering page "NPM" reads as the Node package manager, inverting the
sentence for its target audience; shipped as "Nginx Proxy Manager to Kong
to services" instead. Every other string in every entry is verbatim.

**`<details>`/`<summary>` for drill-in**, not a JS-driven disclosure — the
site already styles `details` generically (recognition/notes blocks);
entries neutralize the generic border/padding inside `.entry` and layer
card styling on top. Native keyboard and assistive-tech behavior for
free, no click-handler wiring, consistent with progressive-enhancement
posture even though the entries themselves are JS-rendered.

**Single-column grid** (`.changelog { display: grid; gap: 16px }`, no
multi-column) — the page column is 720px and entries are text-heavy
prose blocks; a second column would cramp line length below comfortable
reading width.

**Cache-busting convention adopted: `?v=N` query string**, not
content-hashed filenames. No dependency/asset changes across all 11
pages' `<link>`/`<script>` tags: `/style.css?v=1`, `/app.js?v=1`. The
fetched JSON uses the same scheme (`/muchane-cloud/changelog.json?v=1`,
the version literal lives in `app.js`'s `loadChangelog()`). Rationale:
content-hashed filenames need a rename on every edit across every
referencing HTML file, which is hostile to a hand-authored, no-build-step
repo; a manual `?v=` bump on every file that references the changed asset
is the boring option that needs no tooling. Assumes the Cloudflare zone
is on the Standard cache level (query string is part of the cache key) —
if it turns out to be set to "Ignore query string," this convention is
inert and the fallback is content-suffixed filenames. `starfield.js` is
untouched this pass and stays bare; the convention applies to it starting
from its next edit, not retroactively.

**Converted both Muchane Cloud L0 satellites** (Career Command Center,
Self-Hosted Infra) from informational pills (`node__satellite--info`,
non-interactive) to navigable chain-zoom links
(`node__satellite--link`, `data-zoom="chain"`), now that their L2 pages
exist — per the conversion recipe already documented in style.css. Landed
as its own commit, separate from the mechanical `?v=` bumps, because it
is a real navigation behavior change and should be revertable
independently.

**"Ops log" heading label**, not the doc's all-caps "OPS LOG" — rendered
through the existing `.page h2` styling (accent-underlined), consistent
with every other `<h2>` on the site. Each of the two changelog `<section>`
containers on `/muchane-cloud/self-hosted-infra` carries its own
`<noscript>` fallback note, so with JS disabled the "Ops log" heading
never sits above an empty region (it sits above its own note instead);
the resulting duplicate note text across the two sections in that
degraded mode is accepted.

**`page__meta` and meta-description text for the two new L2 pages** were
not specified in the copy doc. Used `Muchane Cloud &middot; 2025 –
Present` (matches the L1 page's meta grammar) and the first sentence of
each page's PITCH paragraph as the meta description (consistent with how
existing pages source their `<meta name="description">` from their own
lead copy).

**Date verification (checklist item 1) is incomplete by design.** Four
entries (`ats-ingestion-feed-complete`, `kanban-status-history`,
`backup-integrity`, `dual-path-network`) ship with `date_verified: false`
and the copy doc's display strings, because their real dates live in the
Career Command Center app repo / VPS workflow history — outside this
repo's governed workspace. Real dates land in a follow-up commit only
after Michael confirms them himself; deploy stays blocked on this per
amendment A5, independent of everything else in this pass.

## Changelog v2 re-transcription; sequencing field; validation script

**Re-transcribed every `title`/`summary`/`sections.*` string in `changelog.json` and the
three Muchane Cloud pitch paragraphs from `muchane_changelog_copy_v2.md`**, verbatim
(transform format only). v2 is a prose pass: colon-joined clauses split into short sentences
throughout. Three entry titles changed: `muchane-com` ("This site: zero dependencies on
purpose" → "This site, zero dependencies on purpose"), `tailoring-quality-triad` ("Tailoring
under control: grounding, growth caps, model-per-task" → "Tailoring under control"),
`companies-surface` ("/companies: intelligence, funnel, and staleness in one surface" →
"Company intelligence in one surface"). `career-command-center`'s pitch now carries v2's
human-gate sentences ("Nothing is ever submitted anywhere automatically. Every document gets
my review before it goes out."), superseding the shipped A4 variant. `dates`, `tags`,
`metric`, `compact`, `page`, `shots` untouched (v2 didn't change them; date model itself is a
separate pass, below).

**New nullable field `sections.sequencing`** (string|null) added to all 10 full entries,
shipped `null` on every one this pass, including entries where v2 supplies real SEQUENCING
prose (e.g. `tailoring-quality-triad`, `char-budget-gate`) — the fill lands in a follow-up
commit once Michael confirms it. Renderer support in `buildEntryCard` (`app.js`): when
non-null, an `h3.entry__label` reading "Sequencing" + its `p` render immediately above the
Problem block, same element grammar as the other labeled sections. Proved both branches live
before committing: temporarily set `tailoring-quality-triad.sections.sequencing` to
`"PROBE-SEQ"`, confirmed it rendered first in the drill-in with the correct label ordering
(`Sequencing, Problem, Solution, Implementation, Iteration`), confirmed a still-null sibling
entry rendered without the label, then reverted (`git diff` confirmed zero remnant) before
staging anything.

**Editorial-instruction stripping (builder-facing text embedded in v2 copy fields).** v2, unlike
v1, sometimes runs a build instruction into the copy field itself rather than keeping it on a
separate NOTE line. One instance found: `kanban-status-history`'s SUMMARY ended "Promote to a
full entry once git log supplies the date and counts." — stale (the date resolved this pass)
and addressed to the builder, not the reader. Stripped; the shipped summary ends "...compute
from real events rather than a mutable column." Every other field was scanned for the same
pattern (`OPS LOG`, `(compact card)`, `[SEQ-FILL]`/`[SEQ-CONFIRM]`) and none were copy-field
leaks — those all sit in the doc's own structural annotations, never inside a transcribed
string. Codified as a permanent gate in `scripts/validate-changelog.mjs`.

**`dual-path-network`'s SOLUTION reapplies the standing "NPM → Nginx Proxy Manager" amendment.**
v2's source text still reads "NPM to Kong to services" literally — the same Node-package-manager
misreading risk on a public engineering page that motivated the original v1-era approved
amendment. v2 didn't fix this ambiguity, so the standing decision is reapplied rather than
re-litigated (Commandment 10: decide cosmetics once, no ping-ponging): shipped as "Nginx Proxy
Manager to Kong to services."

**Meta-description convention extended for v2's punchier lead sentences.** The established rule
("meta description = first sentence of the pitch") assumed a single, descriptive first
sentence, matching v1's colon-joined style. v2 restructures both L2 pitches into a short
fragment-like lead sentence ("Linear for job search." / "The platform under everything.")
followed immediately by the descriptive clause that carries the actual content. Taking only
the literal first sentence would ship a near-content-free meta description, diverging from
the original mapping (which captured the full descriptive scope). Applied the first TWO
sentences in both cases instead, preserving the same descriptive scope as before under the new
prose style — not a new convention, the same one adapted to v2's sentence-length shift.

**Validation script created at `scripts/validate-changelog.mjs`** (none existed in the repo
before this pass, despite the task description assuming one to extend). Node built-ins only,
zero deps, lives outside `public/` (never served). Checks: top-level/page-reference shape,
per-entry field presence and types, full-vs-compact `sections` shape (now including
`sequencing`), the editorial-instruction leak pattern above, and the banned-string gates
(`iapply`, `NIIFTY`, em dash, ⚠, `[SEQ`). Date-field checks (`date_display` format vs.
`week_start`, Monday-only weeks, no day-precision display when `week_start` is null) are
included and were run against this commit's state expecting exactly the pre-existing
`date`/no-`date_display` shape to fail (45 failures, all date-field-only, zero shape/banned-
string/editorial-leak failures) — confirming this transcription pass introduced nothing else
wrong ahead of the week-dating commit that actually adds `date_display`/`week_start`.

**`.gitignore` widening to `muchane_changelog_copy*.md` was already committed by Michael**
ahead of this pass (verified via `git check-ignore -v` on both `muchane_changelog_copy.md` and
`muchane_changelog_copy_v2.md`); this pass made no `.gitignore` edit.

## Week-level dating (replaces day-precision dates everywhere)

**Date model per entry, uniform across all 15:** `date_display` (string, what renders),
`week_start` (ISO date string|null, Monday-start), `date_verified` (bool). The `⚠` marker used
in the copy docs never renders — it survives only as `date_verified: false`. No entry renders
a day-precision date; where `week_start` is set the display is always `Week of {Mon D, YYYY}`
(optionally suffixed ` · active`, ats-ingestion-feed-complete only); where `week_start` is null
the display is month- or season-level (`May 2026`, `Early 2026`) or the platform-overview
special case below. `app.js` reads `entry.date_display` directly, no `|| entry.date` fallback —
a missing field fails loudly; the JSON shape is enforced by `scripts/validate-changelog.mjs`,
not by a renderer-side default.

**Assignments, evidence-backed:**
- `ats-ingestion-feed-complete` → Week of Jul 6, 2026 (`week_start` 2026-07-06), now
  `date_verified: true`. Evidence: n8n workflow `createdAt` — ingestion core + Greenhouse
  adapter Jul 10 2026, Ashby adapter Jul 12 2026. Kept the `· active` suffix from the copy doc.
- `tailoring-quality-triad`, `paragraph-break-overlap`, `updated-at-phantom-writer`,
  `n8n-bloat-surgery`, `workflow-status-lights`, `swap-provisioning` → Week of Aug 3, 2026
  (`2026-08-03`). Evidence: this cohort shipped Aug 5–6, 2026; Aug 3 is the Monday-start week
  containing those ship dates.
- `companies-surface`, `muchane-com` → Week of Aug 10, 2026 (`2026-08-10`). Evidence:
  companies-surface shipped Aug 12; the muchane.com L0 pass ran Aug 12–13.
- `kanban-status-history` → Week of May 4, 2026 (`2026-05-04`), now `date_verified: true`.
  Evidence: app repo, Wed May 6 2026, single-session build (`@dnd-kit` deps 15:16 → Playwright
  suite 15:36). The SOLUTION's DB-trigger claim was independently disputed and then confirmed
  this same pass — `pg_trigger` shows `trg_log_application_status_change` exists on
  `applications`, matching the copy doc's claim; no hand-back flag needed.
- `char-budget-gate` → Week of May 25, 2026 (`2026-05-25`). Evidence: doc-renderer repo, May 27
  2026, commits `ffbecb9 42635f0 85c9ea9 cdc0a21 a44e432`.
- `backup-integrity` → Week of Jul 13, 2026 (`2026-07-13`), now `date_verified: true`. Evidence:
  muchane-cloud repo, commit `e00d624`, 2026-07-17 (Friday), "backups/db: drop -t from pg_dump
  docker exec (fixes silent PTY CRLF corruption)". Copy flag (not fixed): the shipped summary
  says "A PTY flag was corrupting dumps in transit," while the commit names the mechanism more
  precisely as silent PTY CRLF corruption. Transcribed verbatim per the standing rule; surfaced
  in the hand-back for Michael's call on sharpening the wording later.
- `agent-hardening` → May 2026 (`week_start: null`), month-level only, `date_verified: true`
  (already true; no week-level evidence available, none needed).
- `dual-path-network` → Early 2026 (`week_start: null`), `date_verified: false`, unchanged and
  final. Predates the searchable record — the only entry still season-level after this pass.
- `platform-overview` → `2025 → present`, unchanged, `date_verified: true` (already true). The
  app repo's first commit is Apr 20 2026, which looked like a contradiction — resolved: the
  platform ran as local, un-versioned work through 2025, and the Apr 2026 first commit marks
  migration to version control, not the start of the work. No hand-back flag needed.

All 15 rendered dates spot-verified live (`entry-date-*` testid text content) against this
table on all three changelog pages (`/muchane-cloud`, `/muchane-cloud/career-command-center`,
`/muchane-cloud/self-hosted-infra`) before committing — exact match, no day-precision date
visible anywhere.

## Sitewide label: "Receipts" -> "Shipped"

**Five edit sites, verified exhaustive by case-insensitive grep of `public/`:** the DaaS page
`<h2 data-testid="receipts">`, the wrangling-app page (same, keeps `reveal-heading`), both PM
Rotation and Senior PQE Workday role pages (same, keep `reveal-heading`), and Product Quality
Engineer's compact `<ul class="note" data-testid="receipts-compact">` (no visible heading on
that page — only the testid changes). Testids renamed alongside the label (`receipts` ->
`shipped`, `receipts-compact` -> `shipped-compact`) so label and testid never drift; safe
because Phase E's Playwright specs are unwritten (parked per DECISIONS.md "Phase E —
deferred") and nothing else in the repo consumes the old names.

**Education heading drop is a no-op.** The prompt described `/education/wfu` and
`/education/bu` subpages with a section heading to remove; neither exists. The only education
page (`public/education/index.html`) has no section heading at all — the two institution
lines are bare `<p data-testid="institution-bu|wfu">` paragraphs. Reported as a repo-reality
correction, not "fixed."

**Range em dash corrected to en dash.** `public/index.html:152` (L0 Education node meta,
`2015 — 19 · 2021 — 23`) was the only remaining em-dash range in rendered markup — every other
range in the repo (`node__meta` lines, role-page meta lines) already used en dashes. Fixed to
`2015 – 19 · 2021 – 23`. Every `<title>` em dash (a separator, not a range) is left alone;
post-edit sweep confirms the only `—` matches left in `public/**/*.html` are inside `<title>`
tags.


## DaaS page treatment: role lockup, decision callout, stat row

**Role lockup: two-line, role above title, h1 unchanged (Michael's choice over the
role-as-h1 alternative).** New `.page__role` line ("Technical Product Manager", 1.35rem/600,
`--text-color`) inserted directly above the existing h1; the meta line drops the role,
keeping `Raleigh, NC · 2025 – Present`. h1 stays "DaaS Platform" specifically to preserve the
L0 node-title <-> page-h1 continuity the zoom morph and drawer link depend on — the rejected
alternative (role as h1, "DaaS Platform" demoted to metadata) would have landed the zoom-in
animation on a page whose headline no longer matched the clicked node. Verified live: rendered
order `page-role -> page-heading -> page-meta -> ...`, `page-role` 21.6px vs. `page-heading`
48px — smaller than the h1 by construction but semibold/`--text-color`, distinctly heavier
than the mono/`--meta-color` metadata line, matching the "equal-weight lockup line, not
metadata" intent (not literally h1-sized).

**Breakup: decision callout + stat row (Michael's choice over the sensor-decision titled
block).** The sensor-block candidate was rejected because extracting it would have required
inventing a title and rewriting the remaining sentence (a mid-sentence clause, not a clean
split point) — the other two candidates move existing sentences verbatim into styled
containers with zero new prose.
- **Decision callout:** the narrative paragraph split at its existing sentence boundary into
  three DOM siblings (`narrative`, `.decision-callout` aside, `narrative-continued`) — zero
  words changed, reading order unchanged. Styled with the same tokens as `blockquote`
  (`--quote-border` left border, `1.15rem`), on an `<aside>` rather than `<blockquote>` since
  it's the author's own claim, not a quotation.
- **Stat row:** three composed mono chips (`8 months → 3 sprints`, `$500K raise`, `160K+
  addressable users`) between the pitch and the narrative — the only invented visible text in
  this whole changelog pass. The first two figures are lifted directly from the page's own
  Shipped bullets (composed-metadata precedent, DECISIONS.md Phase D). The third required a
  correction during this pass: the source bullet reads "a serviceable addressable market of
  160K+ end users" — a market-sizing figure, not actual users served — and a bare "160K+ end
  users" chip would have silently overstated it as traction on a public, hiring-manager-facing
  page. Kept the "addressable" qualifier in the chip specifically to preserve that distinction.
  Styled `.stat-row li` with the same mono/meta-color/border grammar as `.entry__metric` and
  `.note`.

**Workday role pages checked, no change.** All three role pages' `<h1>` already equal the
role name (Product Management Rotation, Product Quality Engineer, Senior Product Quality
Engineer) — the title-prominence problem this pass fixes on the DaaS page doesn't exist there.

**No new color tokens.** `--quote-border`, `--text-color`, `--meta-color`, `--border-color`
all reused as-is.

**Verified via DOM geometry, not a screenshot.** `getBoundingClientRect()` on all ten
testid'd elements in page order: zero vertical overlaps, monotonically increasing top/bottom
across the stack; `decision-callout`'s computed `border-left` is `2px solid rgb(176, 127,
255)` (`--accent-color`), visually distinct from the plain-paragraph siblings on either side.

## Resume download button (built, ships hidden)

**Fourth header icon, all 11 pages that share the header.** `<a data-testid="header-resume"
aria-label="Download resume" download>` inserted immediately after the LinkedIn icon in
`.header__contact`, following the existing `.header__icon`/`.header__icon--*` pattern
(new tokens `--icon-resume-fg/-border/-bg`, accent-purple family `#B07FFF`, same alpha
grammar as the email/GitHub/LinkedIn tokens — no new hex).

**Ships hidden via the site's existing dormant-element convention**: `hidden` attribute +
`.is-hidden` class together, matching `.entry-shot` (amendment A2). Verified live on all 11
routes: present in the DOM, `hidden` attribute and `.is-hidden` class both set, computed
`display: none`, `offsetParent === null` — zero visible output, testid resolvable for the
future Playwright rebuild.

**`/resume/muchane-resume-v0.pdf` does not exist and must not be created.** The link is
dormant scaffolding; unhiding it (removing `hidden` + `.is-hidden`, pointing `href` at the
real file) is future work once the PDF is delivered. **Versioned-filename discipline**: the
real file ships under a new versioned/content-suffixed filename at delivery time (bump the
filename itself, never reuse `muchane-resume-v0.pdf` for a later revision) — same reasoning
as the `?v=` query-string convention, but applied to the filename because a resume PDF is a
standalone binary asset a browser/CDN caches by URL, not a page asset referenced with a
query-string cache-buster. Cloudflare must never pin a stale resume.

**One edit site per page (11 total), no shared markup** — the known accepted tradeoff from
Phase A (shell duplication across all 10, now 11, HTML files) applies here too. One of the 11
edits (`workday/product-management-rotation/index.html`) triggered the edit tool's
stale-file-hash auto-recovery (this file was also touched in the "Receipts" -> "Shipped"
commit earlier in this pass); re-read the full file afterward per the known footgun and
confirmed exactly one `Shipped` heading and exactly one resume-icon block, no duplication.

## Cache-bust `?v=2` bump (mechanical, mirrors prior pass `b362831`)

`app.js` and `style.css` both changed content in this pass (renderer edits, new page-role/
decision-callout/stat-row/header-icon-resume CSS), and `changelog.json` changed schema and
content — all three assets bumped from `?v=1` to `?v=2` per the standing convention (`?v=N`
query string, DECISIONS.md "Changelog content model"). Exactly 23 occurrences across the repo
(11 pages × `style.css` link + 11 pages × `app.js` script tag + 1 `changelog.json` fetch
literal in `app.js`), confirmed exhaustive by grep before the edit and zero-`v=1`-remaining
after. Applied via `sed -i` (a single uniform literal substitution with no structural risk,
not a specialized-tool bypass) after confirming every match was one of the three intended
sites — no stray `?v=1` elsewhere in the repo. `starfield.js` stays bare (untouched this pass,
per the convention: `?v=` starts applying from an asset's next edit, not retroactively).
Verified live: reloaded `/muchane-cloud`, confirmed `style.css?v=2`/`app.js?v=2` in the DOM
and the changelog still renders (4 entries) — the fetch URL's version bump didn't break the
cached-promise loader.



## Home page hero copy rewrite

Replaced the `hero__copy` paragraph on `public/index.html` verbatim with Michael's new
self-introduction text (in-chat instruction, not sourced from a copy doc). Convention-covered
micro-decision made alongside it: synced `<meta name="description">` to the new paragraph's
lead sentences, per the standing rule that the meta description mirrors a page's own lead copy
(established `index.html:1447`, extended for short-lead-sentence pages at `index.html:1505`).
Applied the same split as the outgoing text used — first two sentences (opener + capability
list), excluding the trailing "I want to keep doing that…" sentence — since that mirrors how
the prior meta description excluded its own trailing "I'm looking for…" sentence. Not a new
convention; the same one applied to new copy.

## L0 hero + header pass: metadata subheader, contact trigger, mailto finding, MENU/wordmark reorder, email unfurl

**Hero restructure.** `public/index.html`'s hero gained a `.page__meta`-styled subheader
(`data-testid="hero-meta"`, "Technical Product Manager · Raleigh, NC") reused verbatim from the
L1 pattern — no new CSS class. The intro paragraph was replaced with new copy whose final phrase
"get in touch" is an in-paragraph `<button data-testid="hero-contact-trigger">`, not a link (no
`/contact` page exists behind it). No `aria-label` on the trigger: its visible text is already
the accessible name; the drawer's Contact button needed one only because "Contact" alone read as
terse. Measured 4 rendered lines at 1440px/62ch max-width (3.998 line-heights, zero headroom) —
the acceptance gate for not editing the copy further.

**Shared activation, extracted.** The drawer Contact button's pulse-and-focus logic was pulled
into `pulseContactLinks()` (first IIFE, `app.js`) so the hero trigger reuses the identical
mechanism rather than duplicating it. The hero trigger is bound via **document-level
delegation** (`document.addEventListener('click', ...)` on
`[data-testid="hero-contact-trigger"]`), matching the zoom engine's own CLICK WIRING pattern —
`swapStage()` replaces `#stage.innerHTML` on every client-side navigation, so a per-element
listener bound at load time would die on the first zoom.

**`--contact-pulse` 900ms → 2400ms** (+1.5s, the requested "1–2 seconds longer" hold). Keyframe
plateau reshaped `20%/70%` → `8%/89%` to keep the attack/decay near their original absolute
timings (192ms in / 264ms out vs. the old 180ms/270ms) while the extra hold lives in the
plateau. **New `--copy-note: 900ms` token, split off `--contact-pulse`** — the email
"Address copied" note previously read the same shared token; leaving it coupled would have
silently stretched the note from 1800ms visible/200ms fade to 4800ms/533ms, an unrequested
behavior change. This explicitly reverses the "note retunes with the pulse family" decision
made when `--contact-pulse` was first introduced (see the C6 entry above) — three independent
motion behaviors now read three independent tokens (`--contact-pulse`, `--copy-note`, and the
new `--email-unfurl` below).

**Header mailto blank-tab report — diagnosed, not a repo defect.** Michael observed the header
mail icon opening a blank new tab instead of a mail client. Diagnosis: the anchor
(`<a href="mailto:...">`, no `target`, no `rel`) is byte-identical across all 10 pages;
`target=` and `window.open` occur zero times anywhere in `public/`; the only JS touching it is
the (unchanged) clipboard-copy listener, which never navigates or calls `preventDefault`. **Case
B: browser-side** — no registered OS mail handler, or the browser's own new-tab-for-external-
scheme behavior. Nothing in the repo was changed for this finding; it cannot be fixed here.

**Email unfurl — the product answer to the mailto dead-end.** Clicking the mail icon (≥600px
viewports only) now unfurls the address to its left as persistent, selectable text
(`data-testid="header-email-reveal"`), created once in JS (`app.js`'s EMAIL COPY FALLBACK
block) rather than authored into all 10 headers — keeps the feature to two files. **Handler
detection is impossible**: no API exposes a registered mail handler, a mailto navigation
reports neither success nor failure, and the browser's blank tab cannot be prevented or
detected after the fact — so the unfurl fires unconditionally on every click; visitors with a
working mail client simply never see it, hidden behind their client's own window. **Persists
until dismissed** (Escape, an outside click, or a second icon click) rather than timing out,
because a mail client stealing focus can outlive any timeout — that mismatch is exactly how the
original blank-tab report happened (the confirmation model this replaces assumed success was
detectable). Animated via `clip-path: inset()` + opacity, not layout width or `scaleX` — the
contact group is the right-anchored child of the header's `space-between` flex row, so its own
width growing extends leftward without moving the wordmark or MENU button (verified: their
rects are pixel-identical open vs. closed, at both a hidden-wordmark depth and a visible-
wordmark depth); `scaleX` would have distorted the glyphs, and a `width` transition would have
thrashed layout every frame. Collapsed end state is `visibility: hidden` (not `display: none`,
which cannot transition, and not `width: 0` with content still present, which would leave a
hidden tab stop) — this doubles as the tab-order/screen-reader exclusion, so no `tabindex`
juggling is needed. **New `--email-unfurl: 320ms` token** (distinct from `--contact-pulse` and
`--copy-note` — see above). Reduced motion is a real branch (`transition: none` in the existing
MOTION SAFETY block), not a shortened duration: state flips instantly on open and dismiss.

**Real bug caught in verification, fixed before commit:** the initial implementation never
cleared `reveal.textContent` on dismiss. `visibility: hidden` does not collapse an element's
layout box while it still has content, so `.header__contact` stayed permanently ~185px wider
after the *first* open — silently shifting the "Address copied" note's `left: 0` anchor away
from the icons for the rest of the session. Fixed by clearing the text after the close
transition completes (0ms under reduced motion, since there's no animation to protect;
otherwise the `--email-unfurl` duration), guarded by the current open/closed flag so a rapid
re-open before the timer fires is not clobbered. Verified: `.header__contact`'s rect returns to
its exact original width after every one of the three dismissal paths.

**Header reorder: MENU before the wordmark; wordmark links home on L1/L2 only.** All 10 pages'
`.header__left` now orders the MENU button first, the wordmark second — a plain DOM reorder
(never flex `order`/`row-reverse`, which would desync keyboard tab order from the visual
order). The wordmark stays **hidden at L0** (`body[data-depth="0"] .header__logo { display:
none }`, unchanged) — the H1 already carries the name there, so showing both would render it
twice; the wordmark is a home affordance on L1/L2 only. Clicking it is wired through the zoom
engine's own CLICK WIRING (`data-zoom="home"`, new branch) rather than a fresh listener, so it
inherits the existing modifier-key guards (cmd/ctrl-click still opens a native tab) and
`preventDefault` ordering for free. No single "go home from any depth" function existed in the
engine; the branch composes two already-shipped paths instead of inventing one: the up-link's
own single-level shortcut (`history.back()` when the current history state's `via/from` match,
else the animated `zoomOut('/')`) for depth 1, and the popstate handler's own multi-level
recipe (`loadPage` + `finalizeIn(..., true)`, non-animated — the engine's four-animation zoom is
documented as single-level-only) for depth ≥2. A `location.pathname === '/'` guard makes the
branch a no-op at L0 even though the wordmark is unreachable there by construction — cheap
defense against a stale or unset `data-depth` attribute, not load-bearing today.

**Known constraint, not a defect, for the mobile pass:** the hero trigger is an inline-block
button and cannot break across lines — at narrow widths "get in touch" wraps to its own line as
a single unit. Recorded here so the eventual mobile layout pass inherits this as an existing
constraint rather than rediscovering and "fixing" intentional behavior. Separately: the email
unfurl is gated to ≥600px viewports; below that, today's mailto + "Address copied" behavior is
untouched — narrow-width email reveal is explicitly deferred to the same mobile pass, which is
still undesigned.

**Cache-bust:** `style.css`/`app.js` both changed content this pass, so every `?v=2` reference
bumped to `?v=3` — 20 HTML references (`style.css` **and** `app.js`, each linked from all 10
pages — the prior assumption that only `index.html` linked `app.js` was wrong; every page has
its own `<script>` tag) plus one previously-untracked reference, `app.js`'s own
`fetch('/muchane-cloud/changelog.json?v=2')` call, for 21 total. `starfield.js` stays bare
(untouched this pass).

## Route rename /two-sided-data-platform → /daas-platform, Career map label, trailing-slash normalization

**Route rename: /two-sided-data-platform → /daas-platform.** Completes the earlier
display-only rename (the node title already read "DaaS Platform"); the URL now matches it.
`git mv public/two-sided-data-platform public/daas-platform`; every menu-drawer link (all 11
pages), the L0 node card and its `data-star-target`, the satellite/teaser pair, the child
card, and the L2 up-link href moved with it. Slug-embedding testids renamed alongside the
route: `node-`, `menu-link-`, `satellite-daas-platform-1`, `teaser-daas-platform-1`, and the
`data-star-target` value. Abbreviation-based names that don't embed the full slug —
`indexed-star-tsdp-25` (and its "TSDP-25" label) and the `.node--tsdp` CSS class — were
deliberately left as-is; neither `app.js` nor `style.css` needed to change for the rename
itself. The L2 child kept its own slug, `multimodal-data-wrangling-application` (deliberately
deferred/unpopulated content), and moved only as a consequence of its parent moving —
`/daas-platform/multimodal-data-wrangling-application`.

**No redirects.** The old path was deliberately left with no stub, no rewrite rule, and no
redirect: the site has never been publicly reachable (Cloudflare Access has gated it
throughout this build), so no external or indexed links to `/two-sided-data-platform` exist to
break. `/two-sided-data-platform` now 404s, which is correct — a 200 there would mean a stale
artifact was left behind. **This reasoning expires the moment the site goes public** — any
future route rename after that point will need real redirects, and this decision should not be
cited as precedent past that point.

**Up-link label: "← Star map" → "← Career map".** Plainer, more literal language for the same
affordance on all 4 L1 pages (education, muchane-cloud, workday, daas-platform); byte-identical
anchor markup across all 4. L2 up-links carry their parent's role/company name (e.g.
"← Workday", "← DaaS Platform") and are untouched — they never said "Star map" to begin with.
The starfield/constellation **visual system** and its internal naming (the `#starfield` canvas,
`.istar`/`indexed-star-*` elements, `starfield.js`, the "TSDP-25" etc. designations) are
deliberately unchanged — only the one user-facing label moved to plainer language; the metaphor
stays. The muchane.com changelog entry's "problem" field, which used the same "star map" phrase
in its own prose ("...ship a framework payload to render a star map."), was changed to "career
map" for consistency and synced into its source copy doc
(`muchane_changelog_copy_v2.md`, gitignored); this is what forced the cache bump below, since
`changelog.json` content changed.

**Trailing-slash normalization in `app.js`.** Production nginx serves
`try_files $uri $uri/index.html =404` with no directory redirect, so a trailing-slash path like
`/daas-platform/` is a real, reachable 200 — byte-identical to `/daas-platform` — that a typed
or externally-constructed URL can produce. Unnormalized, this broke two things: the up-link's
one-history-entry back shortcut (`history.state.from === href`, comparing against a slash-less
authored href) missed and fell through to `zoomOut`'s push, growing the history stack on every
up-click; and `finalizeOut`'s `[href=leavingPath]` origin lookups missed, so the zoom-out
animation fell back to an unanchored scroll-to-top instead of tracking back to the originating
card. Fixed with one shared `normalizePath(p)` helper (strips trailing slashes, `'/'` stays
`'/'`) used at the two sites that read `location.pathname` directly — the module-scope
`currentPath` boot assignment and the `popstate` handler. `history.replaceState` at boot
canonicalizes the initial history entry (preserving `location.search` and `location.hash`) —
required, not cosmetic, since a Back to that entry would otherwise reintroduce the
non-canonical slash into both the address bar and every `history.state` comparison downstream.
Authored hrefs remain slash-less as the one canonical form; no href was rewritten, and nginx
was not touched.

**Cache-bust:** `changelog.json` and `app.js` both changed content this pass, so every `?v=3`
reference bumped to `?v=4` — 23 total: `style.css?v=3` and `app.js?v=3` on all 11 pages (22)
plus `app.js`'s own `fetch('/muchane-cloud/changelog.json?v=3')` call. (The prior pass's tail
entry said "10 pages / 21 refs" — that was stale even at write time relative to this repo's
current 11-page structure; re-derived by fresh grep this pass, not carried forward.)
`starfield.js` stays bare (untouched).

## Mobile L0 — Timeline spine (design-refs 1d)

Narrow-viewport (≤600px) L0 built per `design-refs/L0-mobile/mobile-l0-directions.html` frame
`#1d` — the constellation's connecting line becomes a vertical accent spine; the four career
stops hang off it as full-width link cards in reverse-chronological order (NOW at top, 2015 at
bottom). Desktop (≥601px) is byte-for-byte unchanged — verified numerically (0px rect delta on
every measured node/satellite/hero/telemetry/header rect at 1280×900 and 601×900, and the
polyline's screen coordinates are byte-identical pre/post-change), not eyeballed.

**Q2 — stop-card footer counts: JS-derived (option b), not hardcoded.** Each card's `.node__foot`
carries an empty `.node__count[data-noun]` span; `bindStopFooters()` (new, `app.js`) counts each
node's `.node__satellite` children (present in the DOM, `display:none` at narrow) and writes
`"{n} {NOUN}{S if n≠1}"`. One source of truth — a new satellite added to a node updates the count
with no markup edit. **JS-off degrades sanely**, confirmed via `Emulation.setScriptExecutionDisabled`:
the count span stays empty, the footer reads bare `OPEN ›` (chevron is CSS `content`, not JS),
and the card is a real `<a href>` — navigation intact. "OPEN ›" is static text inside an
already-a-link card (`aria-hidden` footer), not a disclosure control.

**Q3 — landscape 844×390: no second breakpoint; the existing desktop constellation is the
answer.** `(max-width: 600px)` alone gates the spine layout; at 844×390 that query never matches,
so landscape phones render exactly today's desktop constellation. Measured before AND after this
change at 844×390: zero node-card overlaps, zero horizontal overflow (`scrollWidth` 844 both
times), rect-for-rect identical to the pre-change baseline. Two pre-existing warts observed and
left untouched (not introduced or worsened here): satellite pills are sub-44px touch targets at
every viewport, and the DaaS satellite pill clips past the left edge at its far-left orbit phase
at 844px width. Both exist today independent of this pass and are out of scope.

**Istar docking deferred.** Istars stay `display:none` at narrow (unchanged from the prior
interim rule). Their function — highlight a node on a 2D map — is redundant on a linear,
already-labeled timeline; docking them to the spine as tappable era markers (per the mockup's own
"tradeoff" note) would add a new interaction for decorative payoff. Revisit post-launch if
wanted.

**Era labels ("NOW" / "2015") are decorative but shipped as real markup**, not CSS
`content:`, because Commandment 9 requires a `data-testid` on structural elements and
pseudo-elements can't carry one. `aria-hidden="true"` — the chronology is already conveyed
accessibly by each card's tenure line. "2015" is Education's real start year (already-rendered
copy), not an invented fact.

**Token mapping (no new hardcoded colors, no new tokens needed):** spine + connector stub =
`var(--accent-color)` at `opacity:0.55` (matches the desktop polyline's own
`stroke-opacity:.55`); dot glow = `var(--istar-active-glow)` (`#B07FFF8c`); footer divider =
`var(--constellation-line)` (`#262626`, the repo's existing in-card divider token); count text =
`var(--istar-label)` (`#6b6b7a`); era label text = `var(--faint-color)` (`#525252`, same
sub-4.5:1 decorative-marker register as `.istar__label`, both `aria-hidden`); terminal dot at the
spine's foot = `var(--border-color)` (`#333`). Geometry (25/31/38/56px, 13px dot, 18px stub) is
chosen so dot centers sit exactly on the spine's centerline — measured 0px delta at both 390px
and 360px.

**Header controls bumped to 44px at narrow** (`.menu-trigger` height, `.header__icon`
width/height) to clear the WCAG tap-target floor. Measured header band height before and after:
**80px → 80px, no growth** — the header's `align-items:center` inside its fixed 80px band
absorbs the 38px→44px icon bump with room to spare. Verified at the tightest case (360px: three
44px icons + the MENU control) with zero horizontal overflow. The one measured tap-target
shortfall at narrow is `hero-contact-trigger-narrow` (96×27, min dimension 27px) — an in-copy
text button, accepted under the WCAG 2.5.8 inline-text-link exception, same treatment as the
desktop hero's existing trigger.

**Telemetry: two zones at narrow**, not hidden entirely (superseding the prior interim
`display:none` rule). The middle metrics zone (`21 CONTAINERS · 47 COMMITS · LAST DEPLOY 6H AGO`
— static placeholder copy already flagged for a future rewrite, not designed around here) is
hidden; the left (MUCHANE CLOUD) and right (AI PIPELINES) identity zones stay, confirmed visible
(`display:flex`/`display` on the zone spans) at 390px.

**Narrow rail sequence is pure DOM order — no flex `order` property anywhere.** The plan's first
draft used `.node--{tsdp,mc,wd,edu} { order: N }` on top of the existing tsdp/wd/mc/edu DOM
order; that was rejected before implementation because it would make visual order (NOW→2025→
2019→2015) diverge from keyboard tab order (same standing rule as the earlier header-reposition
pass). Instead, `.node--mc`'s whole DOM block was moved to sit before `.node--wd` — final DOM
order in `index.html` is `tsdp, mc, wd, edu`. Safe on desktop because nodes are absolutely
positioned from their own `--x`/`--y` custom properties, independent of DOM order (confirmed:
0px rect delta on all four cards at 1280×900/601×900, and the polyline's literal SVG point
coordinates are untouched — its screen position is byte-identical pre/post-move). Verified: tab
order at 390×844 reads DaaS Platform → Muchane Cloud → Workday → Education, matching the visual
rail exactly.

**The narrow hero is a separate paragraph, not a CSS truncation of the wide one.** Michael's
final mobile wording is a rewrite (drops the second, implementation-depth sentence; compresses
desktop's "with human review gates on AI in production" into the adjective "human gated"
attached directly to "LLM pipelines" — no stronger a claim than the desktop copy or the résumé)
rather than a subset of the desktop paragraph, so it cannot be produced by hiding spans inside
one shared `<p>`. Two sibling `<p class="hero__copy">` elements now live in `index.html`
(`--wide` / `--narrow` modifier classes, `display` swap — not `visibility`, per the
known email-unfurl width-collapse defect class in this repo), toggled by the same
`max-width:600px` query as the rest of this pass. **Consequence stated plainly: the hero copy
now exists twice and must be edited in both places.** The two triggers
(`hero-contact-trigger` / `hero-contact-trigger-narrow`) share one class,
`.hero__contact-trigger`, which the pre-existing delegated click handler in `app.js` now matches
(widened from a single `data-testid` selector) — one handler, one `pulseContactLinks()` path,
confirmed firing from both triggers and confirmed still firing on the narrow trigger after a
full L0→L1→L0 zoom round-trip (proves the delegation survives `swapStage`'s DOM replacement).

Drift mitigation for the now-duplicated copy: **reciprocal HTML comments** sit immediately before
each paragraph in `index.html` ("PAIRED COPY 1 of 2" / "2 of 2"), each naming the other and
pointing back to this entry, so an editor touching one text sees the tripwire at the edit site.
A **programmatic paired-copy drift check is deliberately deferred**, not built this pass:

> Paired-copy drift check (unbuilt). The two hero paragraphs cannot be validated by diffing,
> since they intentionally differ. The workable shape is a hash-pair check in scripts/
> following the validate-changelog.mjs precedent: store a content hash of each paragraph plus
> the date they were last reconciled, and fail loudly when either hash changes, with a message
> telling the author to read both and re-record. It does not check that the copy is correct,
> only that a human looked at the pair. Deferred because this pass is already 14 files, and
> because a second script plus a stored hash file is its own small design. Revisit if a second
> or third viewport-divergent string appears, which is the point at which comments stop being
> sufficient.

**Hero-copy measurements** (390×844 / 360×640, `npx serve public -l 4173`): H1 "Michael Muchane"
renders 1 line at both widths (unaffected — H1 was not edited); `hero-meta` 1 line at both. With
the CURRENT shipped desktop paragraph, CSS alone renders it at 10 lines (390px) / 11 lines
(360px) — technically fits without a `<br>` or font-size change, but Michael ruled it too long
for the mobile surface as a product call, not a measurement failure. The shipped narrow
paragraph renders 5 lines at 390px, 6 lines at 360px. Desktop paragraph line counts are
unaffected by this pass (unchanged at 5 lines/1280px, 7 lines/601px, confirmed against the
pre-change baseline).

**Cache-bust:** every `?v=4` reference bumped to `?v=5` — 23 total (22 across the 11 HTML pages'
`style.css`/`app.js` tags, plus `app.js`'s own `fetch('/muchane-cloud/changelog.json?v=4')`
call), re-derived by fresh grep at execution time, not carried forward from planning.
`starfield.js` stays bare (untouched).

## DaaS Platform node, complete pass: copy revisions, two figures, caption/glow styling, satellite relabel, cache v6

**First binary assets in the repo.** `public/media/` created as the served home for two
pre-optimized `.webp` screenshots (1600x1000), mode 644 to match every other file under
`public/` (the provided files arrived at 600, browser-download default). Never colocated
inside route directories. `.entry-shot figcaption` reuses the existing mono stack
(`'JetBrains Mono', 'Fira Code', monospace`) and `--meta-color`; no new custom properties,
no new classes beyond the one rule. The shared `.entry-shot` glow widened
`0 0 48px -12px` to `0 0 72px -6px` (same `--istar-active-glow` token, single shadow),
shared with the changelog shot renderer; visual check on a temporarily-unhidden
`/muchane-cloud` entry is part of this pass's Verification (V5), not claimed here.

**Child page pitch/meta relationship after the copy pass.** The pitch and meta description
both open "Designed and prototyped..." (kept in sync, mirroring the site's usual
meta-echoes-lead convention) but their trailing sentences intentionally diverge: the pitch
gets two new sentences about the alignment-approval-gate prototype and production status;
the meta gets a shorter "Prototype; production build in progress." tail. Do not re-sync the
tails. Known cosmetic artifact, left as authored (audit-final copy): the pitch now has two
adjacent sentences opening on the same verb ("Designed and prototyped... Prototyped..."),
flagged for a possible later reword pass, not fixed here.

**Satellite label "Wrangling" -> "Datasets", orbit geometry (A=156) unchanged.** Measured
live on the pristine served site before editing (`sat.childNodes[0].textContent` set
including the real trailing-whitespace text node, per the original derivation's method):
"Wrangling" 106.84px (exact match to the prior derivation), "Datasets" 99.67px, narrower,
so every existing clearance proof holds with strictly more margin. Resulting margins at
1280: card clearance 8.08px (was 4.49px), viewport 31.42px (was 27.83px). No CSS changed;
`orbit-tsdp` keyframes, the 912px perimeter, and the four waypoints are untouched. Teaser
copy (`satellite__teaser-title/-meta/-accent`) replaced to describe the pipeline instead of
repeating the destination heading; `aria-label` stays the full destination name.

**Cache-bust `?v=5` -> `?v=6`:** 23 references (22 across the 11 HTML pages'
`style.css`/`app.js` tags, plus `app.js`'s own `fetch('/muchane-cloud/changelog.json?v=5')`
call), re-derived by fresh grep at execution time and matching the pre-execution estimate.
`starfield.js` stays bare (untouched).

## DaaS child route rename to data-wrangling-pipeline, content revision, Shipped section dropped

**Route rename** `/daas-platform/multimodal-data-wrangling-application` ->
`/daas-platform/data-wrangling-pipeline` via `git mv`. Exactly two hrefs updated (parent
child card, L0 satellite). No redirect, no stub, no meta refresh: same basis as the
`/two-sided-data-platform` rename above (site never publicly reachable). No sitemap.xml or
robots.txt exists (confirmed by directory listing, not assumed).

**Correcting the record:** the task brief claimed no testid embeds the slug; false. The
child card carried `data-testid="child-link-multimodal-data-wrangling-application"`. Renamed
to `child-link-data-wrangling-pipeline` to keep the repo-wide `child-link-<route-slug>`
convention (cf. the three /workday child links) and to leave zero old-slug strings in
`public/`. Safe now precisely because no test suite exists yet (Phase E deferred); after
Phase E lands, testid renames become breaking changes.

**Destination-name sync:** the child card's visible title and the L0 satellite `aria-label`
both updated to "Data Wrangling Pipeline", per the standing convention that the satellite
`aria-label` is the full destination name (see the satellite relabel entry above). Satellite
visible label stays "Datasets"; teaser copy untouched.

**Parent page:** Shipped h2 + five-item list removed; the narrative paragraphs now carry
that content (delivery plan, $500K raise framing reworded to "for a planned $500K raise",
consent/rights workflows and MVP scoping moved into narrative-continued). The
sensor-evaluation figure did not move: deleting the list left it exactly between
narrative-continued and .children, byte-identical.

**Child page, partial revert of the prior pass:** the "production build in progress" claim
is removed from BOTH the pitch and the meta description. Pitch and meta now differ only in
the pitch's trailing alignment-gate sentence; both still open "Designed and prototyped".
This supersedes the "do not re-sync the tails" note in the prior pass entry. Title and h1
renamed to "Data Wrangling Pipeline" (comma-separated title, no em dashes; the page's only
two em dashes lived in the old title, so its count drops 2 -> 0). "The bet is" ->
"The rationale is" in the narrative. Stack line now names React, Vite, Tailwind, PostgreSQL
with an ML alignment step proposing cross-stream offsets; no specific alignment method was
supplied, and no placeholder token was considered (Commandment 5).

**No cache bump.** HTML-only pass; HTML carries no version query and is served fresh.
`?v=6`, style.css, app.js, starfield.js all untouched.

## Figure breakout, full-size anchors, stat-row fit, hero widow/sizing, teaser width/balance/clamp, cache v7

**Figure breakout to 1040px.** `.entry-shot` gets `margin-inline: max(calc((100% - 1040px) / 2), calc((100% + 80px - 100vw) / 2))` instead of a `.page` width change: the prose column stays at 720px/640px content (~70 characters, top of the comfortable range), the figure alone widens, centered on the same axis, up to 1040px. Scrollbar-safe by construction: the rendered width is `min(1040px, 100vw - 80px)`; `100vw` over-counts the true client width by the scrollbar's width (at most ~19px on any desktop browser), but the formula insets by 80px (the `.page` column's own side paddings), so worst case the figure still clears the true client width by roughly 30px per side. The real trap this avoids: expressing the same formula as a `width:` with `margin: auto` centering instead of symmetric negative margins - over-constrained auto margins resolve to 0 and produce one-sided overflow, measured up to ~120px at 1200px during diagnosis. `body { overflow-x: clip }` (already shipped) is a second fence. Below the existing 600px breakpoint, `.entry-shot { margin-inline: 0 }` restores today's in-column behavior - no new breakpoint. The changelog's dynamic `.entry-shot` figures (`app.js`, always `hidden` with no `<img>`) are inert under this rule; untouched.

**First `target="_blank"` in `public/`.** Deliberate exception: each figure's `<img>` is now wrapped in `<a class="entry-shot__full" href="<same asset>" target="_blank" rel="noopener" data-testid="shot-full-<slug>">` so a click/tap opens the full 1600x1000 asset, no lightbox, no modal, no JS. `rel="noopener"` set. The email-unfurl investigation's earlier finding that `target=` and `window.open` occur zero times anywhere in `public/` is now superseded by exactly these two anchors (`shot-full-sensor-evaluation`, `shot-full-alignment-gate`) - a future blank-tab diagnosis should not chase them as a regression. Focus outline comes from the existing universal `:focus-visible` rule; no new focus CSS needed, only `.entry-shot__full { display: block }` so the outline hugs the image box, not an inline gap.

**Stat-row specificity bug, fixed.** `.stat-row`'s authored `margin: 24px 0` (specificity 0,1,0) was silently beaten by `.page ul { margin: 16px 0 16px 20px }` (0,1,1, defined later in the file) - the row was rendering 20px narrower than its actual column budget. Fixed by raising the selector to `ul.stat-row` (0,1,1, later in file, wins). Chip side padding also cut 12px -> 9px. Measured at 1280 on `/daas-platform`: chips needed 652.9px against a 620px-wide row before the fix (was wrapping after two chips); after both changes, 634.9px needed against a recovered 640px row (5.1px spare, one line). `flex-wrap: wrap` and the 10px gap are untouched, so narrow-viewport wrapping still works.

**Hero widow, diagnosed then fixed.** The last line of the desktop hero paragraph can strand the "get in touch" button (and its trailing period, which UAX #14 forbids breaking before) alone on its own line. Measured this session: does NOT reproduce at 1280/1440/1920 at DPR 1 or DPR 2 - the paragraph is width-locked at 686.6px (62ch) for any viewport >=767px, so its wrapping is viewport-independent above that width. It reproduces ONLY at paragraph widths 550-570px, i.e. browser windows roughly 630-650px wide - a devtools-docked or half-screen window, not a typical full-width session. `text-wrap: pretty` was tested at those widths and measured as a no-op (Chromium's short-last-line heuristic does not pull an earlier line down across the atomic inline-block button). Fix: the trailing phrase "vision, get in touch" is wrapped in `<span class="hero__nobr" data-testid="hero-nobr">`, `white-space: nowrap` - text content is byte-identical, only markup changed. At the widow widths the glued ~145px unit wraps as a whole, giving a multi-word last line; at every width >=767 the layout is unchanged (the line break was never inside the span there). Only the WIDE hero paragraph is touched; the narrow paragraph's trigger starts a sentence and was deliberately left alone (gluing across "constraints." would be wrong). Both paired-copy tripwire comments were read; no text changed in either paragraph.

**h1 floor kept at 2.5rem**, against this pass's own suggested 2.75rem. Measured "Michael Muchane" (700 weight, -0.03em) at 44px = 338.5px; available width at the 375px viewport (20px side pads below the 600px breakpoint) is 335px - 2.75rem measurably wraps the heading. A 2.6rem floor also fails, colliding exactly at the 360px viewport (320.0px needed vs 320px available). `clamp(2.5rem, 7vw, 4.5rem)` -> `clamp(2.5rem, 7.5vw, 5rem)`: floor unchanged, growth comes from the widened `7.5vw` slope and the raised `5rem` cap (72px -> 80px at 1280, single line confirmed at every width from 375 to 1920).

**Teasers widened 230px -> 280px, `text-wrap: balance` added to all three teaser spans.** Width grid (230/260/280/300, balance on/off) tested against all 8 satellites' real copy: 280px + balance is the smallest tested width where every satellite's title renders on exactly one line and its meta/accent render on at most two, with no line ending in a single stranded word (without balance, `muchane-cloud-3`'s meta strands "VPS" alone at 280px). No teaser copy changed.

**Teaser viewport-overflow clamp, `bindSatelliteTeasers` (`app.js`).** The pre-existing left-edge clip on DaaS's left orbit run (logged above as a [FUTURE] item, no number previously recorded) measures **-33.8px at orbit phase 0.75, 1280px** on this session's 8-phase grid. Sweeping all 8 phases this pass surfaced a WORSE, previously unrecorded case: both Education teasers clip the RIGHT edge at phases 0.125/0.25/0.375, worst case 79.2px past the 1280px viewport - pre-existing today, not caused by this pass, worse than the recorded DaaS case. Edge-anchoring (a horizontal analog of the existing `.teaser-below` vertical flip) was considered and rejected: the Education PILLS themselves already reach past the viewport edge at phase 0.25 (see the separate pill-geometry entry immediately below), so anchoring a teaser to any pill edge would still overflow. Fix is a measured JS clamp added to the existing `update` closure in `bindSatelliteTeasers`, after the `.teaser-below` toggle: reset any prior transform, measure the teaser's `getBoundingClientRect()` against `document.documentElement.clientWidth` (excludes the scrollbar, unlike `innerWidth`), and if it clips within an 8px margin on either side, add a `translateX` delta to the existing centering + counter-scale transform. One code path, both edges, exact at reveal - same reveal-time-measurement rationale as the vertical flip. `--constellation-scale` is currently 1 (px clamp math is exact); the `var()` stays in the composed transform for when it isn't. Widening the teaser to 280px (previous item) worsens the DaaS left clip to -58.8px at phase 0.75 before the clamp; the clamp is what actually contains it, not the width choice. JS-off degradation: no clamp runs, teaser may clip at extreme phases exactly as it does today - acceptable, since the teaser is a visual preview only (`aria-hidden`, accessible name carried by the satellite's own `aria-label`).

**[FUTURE] Education orbit geometry defect - pills exceed the viewport (unfixed, out of scope this pass).** At 1280, orbit phase 0.25, the pills themselves - not their teasers - reach past the viewport right edge: `satellite-education-1` pillRight 1283.5, `satellite-education-2` pillRight 1287.1, against a 1280 clientWidth (up to 7.1px past). Viewport containment at 1280 was never actually proven for the Education node the way it was for DaaS: the recorded 27.83px viewport-margin proof in the DaaS orbit-derivation entry above is DaaS-only. This is a geometry defect in the Education orbit's own rectangle (A/rest-x/rest-y), not a teaser problem, and the reveal-time teaser clamp (previous item) cannot fix it since the clamp only repositions the teaser, not the pill. Fixing it requires re-deriving the Education orbit geometry, which this pass's E4 constraint (pill sizing/orbit geometry untouched) forbids. Whoever next touches the Education orbit should start here.

**Satellite JS-dispatched-click landmine, logged.** The satellite pills orbit under a continuous CSS animation (`animation-play-state: running` at rest), so Puppeteer's element-stability check before a `.click()` never settles and the call times out. Every automated click on a `.node__satellite` in this repo (browser-tool verification, and eventually Phase E) must use a JS-dispatched click (`element.click()` via `page.evaluate`), never Puppeteer's native `ElementHandle.click()`.

**Cache-bust `?v=6` -> `?v=7`:** 23 references (22 across the 11 HTML pages' `style.css`/`app.js` tags, plus `app.js`'s own `fetch('/muchane-cloud/changelog.json?v=6')` call), re-derived by fresh grep at execution time and matching the pre-execution estimate. `starfield.js` stays bare (untouched).

## Teaser separator/hyphen glue, Self-Hosted Infra copy shortening

**Non-breaking space before every teaser "·" separator.** Teaser copy uses " · " between
clauses (`satellite__teaser-meta`/`-accent` spans). The ordinary space before the separator is
a valid break opportunity, so a line could begin with a bare "·" (observed on the Career
Command Center teaser: "Live ATS API ingestion" / "· on-demand research"). Fixed by replacing
the space immediately before each "·" with `&nbsp;` in all 4 affected spans (5 occurrences);
the space after "·" stays ordinary and remains the intended break point. Typographic glue only,
rendered text is byte-identical to a reader. Two "·" instances elsewhere in `index.html` (the
hero meta's `&middot;` entity, `node__meta`'s tenure line, the telemetry strip) are untouched -
out of teaser scope.

**Non-breaking hyphen via nowrap span, not U+2011.** The PM Rotation accent's "3-release" could
break after the hyphen. Considered U+2011 NON-BREAKING HYPHEN as a drop-in character swap, but
the site loads no webfonts (Commandment 2: no remote origins), so the teaser's
`'JetBrains Mono', 'Fira Code', monospace` stack resolves to whatever each visitor's OS
provides; U+2011 glyph coverage in an arbitrary visitor's generic monospace fallback cannot be
verified from this machine, and a missing glyph would ship a tofu box. Used a
`.teaser__nobr { white-space: nowrap; }` span around exactly the token `3-release` instead -
deterministic on every browser, mirrors the existing `.hero__nobr` precedent (`style.css:557`).
Only "3-release" is glued; a break between "3-release" and "roadmap" remains valid.

**Self-Hosted Infra teaser meta shortened.** "Containerized services on a single VPS" ->
"Containerized services on a VPS" so both the meta and accent spans render on exactly one line
each at the 280px teaser width (previously the meta wrapped to two lines, "Containerized
services" / "on a single VPS" - `text-wrap: balance` kept both words of the "single VPS" pair
together but did not achieve a true one-line fit). No other satellite's copy changed.

## DaaS child card moved above narrative, centered; cache v8

**Correction: `/workday` never used `.children`.** A brief for this pass claimed "/workday also
uses `.children` with THREE cards" as the hard constraint motivating a scoped CSS approach.
Verified false by grep: `class="children"`/`.child-card` markup exists at exactly ONE place
site-wide, `public/daas-platform/index.html`. `/workday`'s three-card block is
`<div class="constellation constellation--sub">` with `a.node` cards, a structurally separate
mechanism (different class, different card markup, different CSS rules). The requested hard
constraint (Workday unaffected) was therefore already structurally guaranteed before this pass
touched anything; the modifier-class approach below is still the right call regardless, since
it also protects a hypothetical future second `.children` page from inheriting the centered
single-card treatment.

**Child card relocated from page-bottom to between stat-row and narrative.** Previously the
lone child card sat after the sensor-evaluation figure, at the very end of the page, reading as
an afterthought. Moved (markup byte-identical) to sit immediately after `[data-testid=
"stat-row"]` and before `[data-testid="narrative"]`, so it now reads as navigation offered
right after the headline stats, before the reader commits to the full narrative. New page order:
stat-row -> children -> narrative -> decision-callout -> narrative-continued -> figure (last).

**Centered single-card treatment via `.children--single` modifier class**, added to the DaaS
instance only (`class="children children--single"`, testid unchanged/reused). Chosen over
`:has()`/`:only-child` scoping: a modifier class states intent directly in the markup, has no
browser-support degradation path (`:has()` support gaps would silently fall back to the
full-width banner look), and is directly assertable by a future Phase E spec. Base `.children`
rule untouched - a future multi-child `.children` page still gets the plain full-width grid.
`grid-template-columns: minmax(min-content, 360px); justify-content: center;` plus
`text-align: center` on `.child-card` within it. 360px sized so the card reads as a pointer
(~56% of the 640px prose column) rather than a banner, while comfortably clearing the card's
own max-content width; `minmax(min-content, 360px)` clamps to the container at narrow
viewports, verified zero overflow at 375 (grid track cannot exceed its container). Text
centered to avoid a left-aligned title reading lopsided inside a centered box - Michael's call
to revert if he prefers left-aligned; only the `.children--single .child-card` rule need change.

**DaaS vs. Workday placement now deliberately differ**, logged so the divergence is not mistaken
for an oversight: Workday's three children are the page's main content (a browsable roster) and
stay in their existing mid-page position; DaaS's single child is a pointer to one deeper page,
so moving it earlier reads as "here's where this goes" before the prose commitment. Whether
Workday's own children block should ever move is Michael's call, not decided here.

**Cache-bust `?v=7` -> `?v=8`:** 23 references (22 across the 11 HTML pages' `style.css`/
`app.js` tags, plus `app.js`'s own `fetch('/muchane-cloud/changelog.json?v=7')` call),
re-derived by fresh grep at execution time, matching the prior pass's count exactly.
`starfield.js` stays bare (untouched).


## Teaser copy corrections, one-line accent fix, cache v9

**Two teaser copy corrections.** Product Quality Engineer meta: "Admissions & recruiting
suites" -> "Admissions & Recruiting suites" (capitalization only). Senior Product Quality
Engineer meta: "REST API program" -> "REST API platform" (the nbsp before the separator kept).
The platform string is longer and now renders on two lines at 1280, which is within the
existing two-line allowance for meta spans.

**`text-wrap: balance` removed from `.satellite__teaser-accent` only**, kept on `-title` and
`-meta`. Measured first: both target accents (Senior PQE "release lead, largest UX initiative",
PM Rotation "discovery &middot; PRD &middot; 3-release roadmap") have a natural single-line
width of 250.83px and 250.81px against a 250px content box at the then-current 280px teaser
width, roughly 0.8px over: a genuinely marginal case, not the clean "balance forces an
unnecessary wrap" signature the hypothesis predicted. Removing balance from the accent class
alone was tested directly (not inferred from the nowrap number): both target accents remained
at 2 lines, and none of the other 4 accents or 8 titles regressed. The accent-only removal was
kept anyway since it was harmless; `-title`/`-meta` were left unchanged since no title ever
wrapped and metas are exactly where balance's even-split behavior helps.

**Teaser `max-width` raised 280px -> 290px** to close the remaining ~0.8px gap. Verified
directly at 290px (not by further inference): both target accents render on exactly one line
(`element.getClientRects().length === 1`), all 8 titles stay at 1 line, all 6 accents and 8
metas stay at their prior line counts or better (zero regressions), zero lines begin with a
"&middot;" separator, and the "3-release" token stays unbroken (1 client rect). No teaser copy
was edited to make this fit, and no accent span was set to `nowrap`.

**Cache-bust `?v=8` -> `?v=9`:** 23 references (22 across the 11 HTML pages' `style.css`/
`app.js` tags, plus `app.js`'s own `fetch('/muchane-cloud/changelog.json?v=8')` call),
re-derived by fresh grep at execution time, matching the prior pass's count exactly.
`starfield.js` stays bare (untouched).

