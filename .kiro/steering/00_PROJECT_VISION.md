---
inclusion: always
---

# 00 — PROJECT VISION

> The product's immutable intent. Visual/experience vision is preserved from the
> legacy vision file; the **technology statement is corrected** to the current
> repository. Classification tags: **CURRENT · ADAPT · HISTORICAL · OBSOLETE · FUTURE**.

## Brand (CURRENT)

**Parsian Music Academy** — پارسیان موزیک آکادمی.

## Product (CURRENT)

A **private management panel (SaaS)** for a music academy — not a public marketing
website. It must not be indexed, discoverable, or appear in training corpora
(see `docs/security.md`). The audience is staff/admins; a separate student
portal is a FUTURE product decision, not current scope.

## Design language & feeling (CURRENT — preserved from legacy vision)

- Luxury · Premium · Glass · Dark · Elegant · Cinematic · Warm Gold · Storytelling · Emotional.
- The reference atmosphere ("a magical music library", Harry-Potter *mood* not cartoon)
  survives as the **"Parsian Stage"** design language already encoded in `src/index.css`
  (warm charcoal · candlelit gold · quiet violet).
- Reference brands: Apple · Bang & Olufsen · Rolls-Royce · MasterClass.

## Priority order (CURRENT)

1. UX  2. Performance  3. Security  4. Scalability  5. Maintainability.

## Technology (CORRECTED — supersedes the legacy "Laravel · Blade · Alpine" statement)

The legacy stack line (`Laravel · Blade · Alpine.js · Tailwind utility + CSS tokens`)
is **OBSOLETE as a frontend description.** The current repository is two codebases:

- **Frontend (primary product) — CURRENT:** React 19 + TypeScript + Vite + Tailwind v4
  (CSS-first, tokens in `src/index.css`) + Alpine-free. Persian/RTL, Vazirmatn.
  Source of truth: `src/`. **No Blade, no Alpine.js** in the frontend.
- **Backend (separate Laravel API) — CURRENT, authority = the repo under `backend/`:**
  A REST API consumed through the data layer. Its *current implementation* is
  authoritative — **not** the legacy Blade/Alpine roadmap, and **not** this file.
  Backend runtime is NOT locally verifiable here (no PHP/Composer/MySQL); CI
  evidence is inherited (see `06_SECURITY_BACKEND.md`).

> **Authority order for any conflict:** current implementation/tests → `docs/engineering/`
> governance & state → `docs/architecture/` + `docs/security.md` → documented decisions
> (`docs/engineering/DECISIONS.md`) → legacy steering/roadmap (archived, HISTORICAL).
