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


