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
- **Local preview** stays `npx serve public --single`; production `try_files` rewrite is
  out of scope this pass (confirmed in the plan) and doesn't exist yet on the VPS.
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
