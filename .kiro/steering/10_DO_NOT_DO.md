---
inclusion: always
---

# 10 — DO NOT DO

> Hard prohibitions, translated from legacy `16_DO_NOT_DO.md` to the current React frontend +
> separate Laravel backend. **CURRENT.** This file outranks convenience.

## Process & honesty

- **No duplicate business logic.** Reuse the existing domain hook/repository/service; if similar
  logic exists, extend it (academy-rules).
- **No guessed root cause.** Prove the cause before implementing; do not guess.
- **No fake success / fabricated metrics / fabricated data.** Never show a success state without the
  write that backs it; never invent revenue, counts, or results (`DECISIONS.md` D12/D6, write-honesty tests).
- **No silent demo/local fallback in `api` mode.** The local implementation is selected explicitly,
  never as a hidden downgrade (`DECISIONS.md` §1–§2, §25, §31).
- **Do not report deferred/unverified work as done.** Browser QA stays NOT VERIFIED until verified.

## Frontend (React / CSS)

- No business logic in presentational components (keep it in domain hooks).
- No duplicate component — reuse or add a variant.
- No hardcoded color/radius/spacing where a token exists; no invented/duplicate token system; do
  not override `src/index.css` from steering.
- Do not break the test-enforced boundaries: no `localStorage`, `demoStore` import, `fetch(`, or
  hardcoded `http(s)://` URL in a view/component (`architectureBoundaries.test.ts`).
- No `console.log`, `debugger`, dead/commented/temporary code, or stray TODOs in shipped code.
- No Blade, no Alpine.js — that stack is obsolete here.

## Backend (Laravel)

- No raw SQL concatenation; no mass assignment without `$fillable`; no fat controllers.
- No bypassing authorization (Policy/Gate); no secrets in code.
- **No `migrate:fresh` / `migrate:fresh --seed` / `db:wipe` / resets / seeds without explicit owner
  authorization** — destructive DB operations are forbidden by default (`06_SECURITY_BACKEND.md`).
- Do not begin backend/product implementation on the authority of the legacy roadmap alone.

## Git

No commit without explicit request; no force-push / reset --hard / rebase / clean / history rewrite
without permission (`09_GIT_GOVERNANCE.md`).
