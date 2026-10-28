---
inclusion: always
---

# 08 — WORKFLOW

> Preserves legacy `15_WORKFLOW.md` intent, re-expressed for the current docs-first,
> one-slice-at-a-time process. Legacy `npm run build` + `php artisan optimize:clear` + "visual
> test in all breakpoints before Freeze" are **ADAPT** (the Laravel/Blade step is OBSOLETE here).

## Governing process (CURRENT)

- **Documentation-first.** `docs/engineering/` is the authority on current state. Read, in order:
  `PROJECT_STATE.md` → `PHASES.md` → `DECISIONS.md` §20 → `GOVERNANCE_CHECKPOINT.md` → `OPEN_ITEMS.md`.
- **One authorized slice at a time.** Do not jump between unfinished modules. Backend and new product
  phases require explicit owner authorization (`06_SECURITY_BACKEND.md`, `12_ROADMAP.md`).
- **Prove the root cause before implementing** (academy-rules). Do not guess.

## Per-change gates (CURRENT)

After any code change, run and pass before presenting:

- `npx tsc --noEmit` (typecheck, expect exit 0),
- the frontend test suite (Vitest),
- the build (`vite build` — bare/client/demo as applicable).

Fix failures before continuing. Backend suites cannot be run locally here — do not claim backend
results beyond inherited CI (`06_SECURITY_BACKEND.md`).

## Truthful status (CURRENT — non-negotiable)

- Deferred work is never reported as finished. Browser QA is NOT VERIFIED until actually verified.
- State docs (`docs/engineering/*`) are the authority; if steering and a state doc disagree, the
  state doc wins and steering is corrected.
- Frozen/protected work is not changed without owner approval; a change to frozen work or
  architecture is a new, authorized phase — not an incidental edit.

## Conflict handling (CURRENT)

If a request conflicts with these rules, state the conflict first, then propose a compatible path.
Record material decisions in `docs/engineering/DECISIONS.md` (not in steering) — see `11_DECISION_LOG.md`.
