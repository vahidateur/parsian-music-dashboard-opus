---
inclusion: always
---

# 05 — PERFORMANCE

> Preserves legacy `08_PERFORMANCE.md` principles, bound to the current Vite/React build and
> the existing D9 governance. **No new performance budget is invented here** — the live budget
> is the D9 bundle test.

## Method (CURRENT — the governing rule)

**measure → profile → identify the bottleneck → change → re-measure.** Do not optimize by
guess; prove the bottleneck first (consistent with `academy-rules`: root cause before change).

## Live budget = existing D9 constraint (CURRENT — do not replace)

- The authority is `src/__tests__/bundleBudget.test.ts` with the baseline/cap recorded in
  `docs/engineering/DECISIONS.md` §22 (re-baselined 2026-09-25: baseline 343,947 B, cap 361,144 B;
  entry chunk below its anchor). Treat **that test** as the budget — do not assert a different
  number in steering.
- Related D9 constraints: `cn()` uses the in-repo `mergeClassNames` (no `tailwind-merge`); the
  stylesheet is generated only from rendered classes (`@source not` in `src/index.css`, D9-A2);
  Vazirmatn weights limited to 400/500/600/700 (M11/I6).

## Build & loading (CURRENT/ADAPT)

- CSS/JS go through the Vite build (minified). Route-level code splitting is already in place
  (`src/App.tsx`: lazy chunks + `Suspense` in `ViewOutlet`, grouped academic/operations barrels
  in `src/views/lazy/`). Keep view code lazy; keep the shell static.
- Prefer the lighter library over the heavier one; prefer CSS-only effects over JS.
- No blocking JS in `<head>`; images carry dimensions to avoid layout shift; lazy-load below-fold
  media; prefer modern formats.
- Backend-side performance (eager loading / N+1, query cache) is **BACKEND REQUIRED** — see
  `06_SECURITY_BACKEND.md`; it is not a frontend budget concern.

## Verification status (CURRENT)

Bundle budget and typecheck are machine-verified in CI/suite. Real-browser performance
(Core Web Vitals, interaction latency) is **NOT VERIFIED** here; report it as such.
