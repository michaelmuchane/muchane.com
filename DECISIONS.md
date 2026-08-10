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
equal-weight read of the constellation. Per his direction: the company line and
three-line strip move off the L0 node face — now title + monospace meta only, matching
all four siblings — onto `/workday`'s page body, placed directly after the
`recognition-heading` and before its four fuller `<h3>` subsections (content unchanged,
relocated verbatim, not reworded). `.node__company`/`.node__strip` (node-face-only
rules) are removed from `style.css`; the relocated list uses a new `.recognition-strip`
page-content rule. Verified visually: screenshot of the L0 constellation shows all 5
node cards reading as comparable size/weight (title + one meta line each).

## Phase E — deferred

A visual-design pass on the built structure is coming before the spec-runner rebuild,
and that pass will change markup (this session's own node-equalization edit is a first
instance of exactly that). Writing `specs/structure.json`/`behavior.json` against
today's DOM now would mean rewriting them again once the design pass lands. Phase E
(Playwright install, config, `specs/*.json` rewrite, dynamic runner) stays parked until
that pass is done — sequencing intentionally preserved here, not dropped.
