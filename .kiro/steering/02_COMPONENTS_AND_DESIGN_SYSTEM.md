---
inclusion: always
---

# 02 — COMPONENTS & DESIGN SYSTEM

> Current component model (React) + token/design-system ownership. Legacy `07_COMPONENTS.md`
> (Blade `@props`, `resources/views/components/...`, kebab-case Blade files) is **OBSOLETE as
> paths** and archived; its reuse/variant/stability principles are **ADAPTED** below.

## React component model (CURRENT)

- Components live under `src/components/` (e.g. `components/ds/`, `components/layout/`,
  `components/overlays/`); views under `src/views/`.
- Component API = typed React props with sensible defaults. Keep the public prop API stable;
  a breaking change is a coordinated change, not a silent one.
- Leaf/UI primitives (buttons, badges, chips, states) are reusable and must not own page layout.
- One responsibility per component; no business logic in presentational components
  (that belongs to domain hooks — see `01_CURRENT_ARCHITECTURE.md`).

## Reuse & variants (ADAPT — from legacy 07/18)

- **Never duplicate a component.** If something similar exists, reuse it or add a variant prop.
- Variant catalogs from legacy `18_UI_PATTERNS.md` (Button primary/secondary/ghost/glass;
  Card glass/information/premium; Badge; Chip; Divider; Panel; Breadcrumb) are **ADAPT** —
  valid as *design intent* to express as React component variants, not as Blade partials.
- `cn()` (`src/utils/cn.ts`) with the in-repo `mergeClassNames` rule table is the class-merge
  helper (`DECISIONS.md` §22). Do not reintroduce `tailwind-merge`.

## Token / design-system ownership (CURRENT — do not invent tokens)

- **Appearance is owned by CSS tokens in `src/index.css`** ("Parsian Stage": warm charcoal,
  candlelit gold, quiet violet; radii scale; `--font-sans` Vazirmatn; semantic `ok/warn/danger`).
  This file is **authoritative** for tokens.
- **Do not invent a parallel/duplicate token system** and **do not override `src/index.css`**
  from steering. The legacy three-layer `--teacher-color-*` / `--nav-*` / `teacher-theme.css`
  token scheme is **HISTORICAL** (Blade-era) and archived — the current single source is
  `src/index.css`.
- Tailwind v4 is CSS-first; the stylesheet is generated from classes actually rendered
  (`@source not` exclusions in `src/index.css`, D9-A2). No hardcoded hex/px for color/spacing
  where a token exists.
- Themes: appearance presets (e.g. dark/day) derive from the token layer; `--color-photo-*`
  stay constant over photographs. Vazirmatn weights 400/500/600/700 only (M11/I6).

## RTL & typography (CURRENT)

Persian-first, `dir="rtl"`, logical properties. Vazirmatn is the bundled face; a brand font
goes first in `--font-sans` with Vazirmatn as guaranteed fallback.
