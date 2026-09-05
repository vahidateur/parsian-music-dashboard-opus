# Arena gap matrix — Phase 0 audit

Verified against the source at commit `082a3be` by reading code and executing it.
Prior completion reports were **not** trusted.

Status: **IMPLEMENTED** · **PARTIAL** · **DEMO ONLY** · **BACKEND REQUIRED** · **NOT IMPLEMENTED** · **BLOCKED**

## Summary

Arena is a **high-quality demo frontend with a real domain seam on three domains**.
It is not close to production, and the distance is almost entirely backend work:
there is no server, no database, no file storage and no messaging provider in this
repository. 11 of the 15 phases in the plan are blocked on infrastructure that does
not exist yet.

## Domain layer — measured, not claimed

| Domain | Contract | Demo repo | API repo | Hook | Status |
|---|---|---|---|---|---|
| auth | ✅ | ✅ | ✅ | ✅ | **IMPLEMENTED** (demo auth is DEMO ONLY) |
| users | ✅ | ✅ | ✅ | ✅ | **IMPLEMENTED** (client-side only) |
| students | ✅ | ✅ | ✅ | ✅ | **IMPLEMENTED** (demo-backed) |
| demo lifecycle | ✅ | ✅ | n/a | ✅ | **IMPLEMENTED** |
| teachers, classes, enrollments, scheduling, attendance, finance, messaging, library, notifications, reports | ❌ | ❌ | ❌ | ❌ | **NOT IMPLEMENTED** — directory contains only a README stub |
| gallery, settings, audit | — | — | — | — | **NOT IMPLEMENTED** — no directory at all |

So: **3 of 14** requested domains have a repository contract. The other 11 views
render static fixtures from `@/data/records` / `@/data/academy`.

## Phase status (§40)

| Phase | Scope | Status | Blocker |
|---|---|---|---|
| 0 | Audit, architecture, env safety | **IMPLEMENTED** (this pass) | — |
| 1 | Auth, users, roles, RBAC | **PARTIAL / DEMO ONLY** | Real sessions, hashing, server enforcement |
| 2 | Backend + database foundation | **NOT IMPLEMENTED** | No backend exists in this repo |
| 3 | Students + national_id, teachers, rooms | **PARTIAL** | `national_id` absent entirely (0 occurrences); DB uniqueness is server-side |
| 4 | Classes, enrollment, waitlist | **NOT IMPLEMENTED** | Server-enforced capacity |
| 5 | Scheduling + conflict engine | **NOT IMPLEMENTED** | §12 requires server transactions/locking |
| 6 | Attendance | **NOT IMPLEMENTED** | Auditable server writes |
| 7 | Finance | **NOT IMPLEMENTED** | Money precision, idempotency, gateway |
| 8 | Messaging, notifications | **DEMO ONLY** | Real transport |
| 9 | Telegram, Bale | **NOT IMPLEMENTED** | Backend-only secrets; 0 occurrences in src |
| 10 | Library + file storage | **DEMO ONLY** | Object storage |
| 11 | Gallery | **NOT IMPLEMENTED** | Object storage; feature absent |
| 12 | CSV/XLSX import/export | **NOT IMPLEMENTED** | No xlsx dependency; no import UI |
| 13 | Reports + PDF | **DEMO ONLY** | Server aggregation/PDF |
| 14 | Search, command palette, settings | **PARTIAL** | Palette searches a static index |
| 15 | Security, a11y, perf hardening | **PARTIAL** | Ongoing |

## Findings by severity

### CRITICAL — fixed this pass
1. **Silent demo fallback.** `VITE_DATA_SOURCE=production` resolved to demo mode,
   serving fabricated localStorage data to an operator who believed they had
   configured a real backend. Executed and confirmed before fixing. Now: production
   aliases map to `api`; unknown values block boot via `ConfigGate`.
   The pre-existing test asserted the buggy behaviour was correct — inverted.

### HIGH — outstanding
2. **`national_id` does not exist** (§9 calls it a domain invariant). 0 occurrences
   in `src/`. Needs field, Iranian checksum validation, uniqueness, import/export,
   and — authoritatively — a DB constraint.
3. **No audit log** (§27). 0 occurrences.
4. **Client-side RBAC only.** Bypassable; UX affordance until a server enforces it.
5. **No real file storage** (§20/§21). Library metadata is fixture-only; gallery absent.

### MEDIUM — outstanding
6. **`useAsyncView` fakes loading** with a 420 ms timer in 9 views. Migrated views
   (Students) use real repository state; the helper should die with the migration.
7. **Frozen demo clock.** `ACADEMY_NOW = 10*60+47` is fine for deterministic demo
   (§23 permits it) but must not reach production dashboards.
8. **Fabricated analytics** in dashboard/reports/finance panels.
9. **Messaging placeholder copy** that §15 explicitly forbids as a substitute for the
   feature. Currently honest-but-inert; the real fix is the messaging domain.

### Verified clean
- 0 `console.*`, 0 `TODO/FIXME`, 0 `dangerouslySetInnerHTML`/`eval`, 0 `any` in src.
- Seed referential integrity: 0 orphans / 0 duplicate ids across 13 collections.
- Prototype-pollution defence on both untrusted JSON entry points.
- No secrets, tokens or real personal data in the repo.

## Dependency audit

`npm audit`: 2 advisories (1 low, 1 high) — esbuild + vite, **dev-server only,
Windows only**, absent from `dist/`. Remediation requires `vite@7.3.6`, outside the
pinned range; deliberately not bumped (§35: do not blindly upgrade).

Notably **absent** dependencies needed for later phases: an XLSX parser (§22), a
decimal/money library (§14), a PDF generator (§24). None should be added until the
phase that needs them.
