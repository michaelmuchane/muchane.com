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

