---
inclusion: always
---

# 03 — UI / UX PATTERNS

> Interaction & visual patterns, expressed for React + CSS tokens. Sources: legacy
> `11_UI_DESIGN.md`, `12_ANIMATION.md`, `18_UI_PATTERNS.md` — their *principles* are
> **ADAPT/CURRENT**; their Blade/Alpine mechanics are **OBSOLETE** and archived.

## Visual language (CURRENT — governed by `src/index.css`)

- Dark, warm, cinematic ("Parsian Stage"). Gold is an **accent/edge only**, never a large fill.
- Glass = blur + subtle gilt border + translucent surface. Soft, long, premium shadows — never harsh.
- Generous negative space; large calm headings; tabular Persian numerals.
- All concrete color/radius/spacing values come from tokens — see `02_COMPONENTS_AND_DESIGN_SYSTEM.md`.
  Do not hardcode and do not restate token hex values here.

## Component variants (ADAPT)

Legacy `18_UI_PATTERNS.md` variant catalog (Button/Card/Badge/Chip/Divider/Panel/Breadcrumb/
Section/Table) is valid **design intent**. Express each as a React component variant that
reuses existing primitives; never duplicate a component to get a new look.

## Motion (ADAPT — honor reduced-motion)

- Slow, elegant, never flashy; hover must not cause layout jump (animate color/opacity/shadow/transform).
- GPU-friendly `transform`/`opacity`, not `top/left/width`.
- Always honor `prefers-reduced-motion: reduce`.
- Durations/easing from the token/appearance layer, not magic numbers.

## Overlays & navigation (CURRENT)

- Shell overlays exist today: `CommandPalette`, `ActionSheet`, `Toasts` (`src/components/overlays/`),
  `Sidebar`, `TopBar`/`BottomNav` (`src/components/layout/`).
- Dialog/drawer focus behavior is React-managed (see `04_ACCESSIBILITY_RESPONSIVE.md`).
  The legacy `@alpinejs/focus` / `x-trap` mechanism is **OBSOLETE** (no Alpine in this stack).
- Navigation uses hints without fabricated counts (`DECISIONS.md` D7).

## HISTORICAL (archived, not active)

Teacher "Hero" composition, 7-layer scene narrative, portrait frame layers, AI scene library,
public-site Breadcrumb/Navbar — all belonged to the public-marketing-site + Blade era. Preserved
in `archive/legacy-2026-07/` as product/visual inspiration only; not current panel UI.
