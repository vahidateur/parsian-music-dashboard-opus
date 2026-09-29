# VERIFICATION EVIDENCE — preserved, not manufactured

> Captured 2026-09-29 by the pre-F2 backup operation.
> This file preserves **existing** verification evidence and clearly labels its provenance. The backup
> operation itself deliberately did **not** run the test suites, typecheck or builds: no green result was
> manufactured, and no earlier result was overwritten. Where this operation re-verified something
> (bundle usability, WIP byte-identity, tree equality), that is stated as a new observation.

## Status vocabulary used below

**PASS** (executed, green) · **FAIL** (executed, red) · **FLAKY** (intermittent under load) ·
**ENVIRONMENTAL** (deterministic, caused by the environment/date, not the product) ·
**NOT RUN** (deliberately not executed in this operation) · **NOT AVAILABLE** (capability does not exist).

## 1. Provenance of each evidence set

| Set | When | Where | Baseline |
| --- | --- | --- | --- |
| **E1 — Post-merge audit** | 2026-09-28 | disposable clone of merged main | `main` @ `15775ea…` |
| **E2 — Phase 2B discovery audit** | 2026-09-29 | disposable clone `/tmp/phase2b` (since wiped) | `main` @ `15775ea…` (live-verified) |
| **E3 — This backup operation** | 2026-09-29 | `/tmp/pref2-work`, `/tmp/pref2-recovery` | `main` @ `15775ea…` (live-verified) |

## 2. Gate-by-gate status (latest known)

| # | Gate | Result | Status | Source |
| --- | --- | --- | --- | --- |
| 1 | `npm ci` | exit 0 | **PASS** | E1, E2 |
| 2 | `./node_modules/.bin/tsc --noEmit` | **0 errors** | **PASS** | E1, E2 |
| 3 | `npm run build:client` | exit 0 — `index-BMhVg0_F.js` 261,828 B (78.08 kB gz) | **PASS** | E1, E2 (identical filename both times) |
| 4 | `npm run build:demo` | exit 0 — `index-DU355MkG.js` 477,495 B | **PASS** | E1, E2 |
| 5 | `npm run build` (bare) | exit 0 — `index-ClGxcDcZ.js` gzip **135,153** | **PASS** | E1, E2 |
| 6 | Focused Phase 2A suites (5) | 37/37 | **PASS** | E1 |
| 7 | Focused Phase 2A + RBAC suites (7 files: deploymentLock, delivery, registryClient, DemoBackedNotice, scope, routeProtection, failureDisclosureI15) | **90/90** | **PASS** | E2 |
| 8 | `mobileContract` + `architectureBoundaries` | 48/48 | **PASS** | E1 |
| 9 | `bundleBudget` + `mobileContract` | 27 passed / 5 skipped | **PASS** | E2 (skips are `skipIf(!hasBuild)` — artifact-conditional) |
| 10 | `architectureBoundaries` (24) + `projectState` (52) | **76/76** | **PASS** | E2 |
| 11 | Students scope / IDOR suites (3) | 16/16 | **PASS** | E1 |
| 12 | `bundleBoundary` (boundary separation) | 2 executed + 2 doc-placeholder skips; vacuous-pass guard present (`expect(out.length).toBeGreaterThan(0)`) | **PASS** | E1 |
| 13 | Independent literal scan — demo literals | client artifacts **0** / demo **1** | **PASS** | E1 |
| 14 | Demonstration-unavailable notice | present client (1 file) / absent demo (0) | **PASS** | E1 |
| 15 | Chunk count | 7 chunks (client) / 7 (demo) | **PASS** | E1 |
| 16 | **Full suite** | E1 run 1: **1 failed / 2562 passed / 2 skipped**; E1 run 2: **2563 passed / 2 skipped / 0 failed** (360.24 s, 195 files) | **PASS with a recorded flake** (see §3) | E1 |
| 17 | **Full suite** (audit-comparable dist state) | **2565 total = 2562 passed / 2 skipped / 1 failed** | **ENVIRONMENTAL FAIL** — see §4 | E2 |
| 18 | D9 budget measurement | **361,037 / 361,144 → 107 B headroom**; entry 135,153; largest chunk 135,153; CSS 21,578; HTML 1,018 | **PASS** (reproduced byte-exactly in E1 and E2) | E1, E2 |
| 19 | D9 test constants | `343947` / `273791` / `361144` / `400000` — unchanged; `bundleBudget.test.ts` byte-unchanged vs pre-Phase-2A base | **PASS** | E1, E2 |
| 20 | Security / ownership (G-7 intact, fail-closed lock, `src/security/` unchanged, UI-hiding-not-a-boundary doctrine) | verified | **PASS** | E1 |
| 21 | Browser QA | **never performed in any session** | **NOT RUN** | all sets |
| 22 | CI | **0 workflows, 0 check-runs** — no automated evidence exists | **NOT AVAILABLE** | all sets |
| 23 | Bundle usability | `git bundle verify` → *"is okay"*, *"records a complete history"*, **38 refs**; recovery clone from the bundle reproduces `main` exactly | **PASS** (new observation, E3) | E3 |
| 24 | WIP byte-identity | 60/60 untracked files byte-identical; tracked patch sha256 `aed92770…` matches the earlier verified backup | **PASS** (new observation, E3) | E3 |

## 3. Recorded flake — `emptyEnvironmentPanels.test.tsx` (pre-existing, outside Phase 2A)

`src/components/settings/__tests__/emptyEnvironmentPanels.test.tsx` → *"saving the academy's identity never
calls it demo data"* — a load-sensitive `waitFor(…, { timeout: 8000 })` (line 137) that exceeded 8.18 s
**once** under full-suite parallel load (E1 run 1). It passes in isolation (10/10 at the time of recording)
and **did not reproduce in the four full-suite runs of E2 (0/4)**.

Status: **FLAKY**. The test is **not modified, skipped, retimed or weakened** by any audit or by this
backup. It is recorded here permanently as a known load-sensitive case.

## 4. Recorded environmental failure — I19 (date-dependent, deterministic on Tuesdays)

`src/views/__tests__/schedulingWrites.test.tsx` → *"a real reschedule resolving a real conflict"* fails when
the **real calendar date** (the demo clock freezes only the time of day) lands on the same weekday as the
seed window's anchor.

| Fact | Value |
| --- | --- |
| Seed anchor | `SEED_DATE = "2026-09-01"` — a **Tuesday** (`iso-dow=2`) |
| Fixture | `cl2` holds `days: [3]` (Tuesday) → seeded row `ses_cl2_YYYYMMDD_1400` |
| First recorded failure | 2026-09-15 (a Tuesday) — `OPEN_ITEMS.md` **I19**, `PROJECT_STATE.md` §7 item 18 |
| Reproduced | 2026-09-29 (a Tuesday) — `AssertionError: one move, not a duplicate: expected [ 'ses_m_mulx…', …(1) ] to deeply equal [ 'ses_m_mulx…' ]` |
| Not a regression | `git diff --stat eb5b559..main` for `schedulingWrites.test.tsx`, `schedulingSeed.ts`, `clock.ts` is **empty** — Phase 2A does not touch them |
| Declared remedy | A semantic test change (a target day the fixture cannot collide with, or a filter excluding seeded rows) in the **protected scheduling area** — **requires authorization**; not authorized |

Status: **ENVIRONMENTAL** (deterministic on the weekday the fixture assigns, not random). The test is
**not modified** by any audit or by this backup operation.

## 5. Explicitly preserved anchors (must not be changed by any later work)

- **D9:** measured **361,037** gzip total against the hard cap **361,144** → **107 B headroom**; entry
  135,153; single-chunk ceiling 400,000. Constants `343947` / `273791` / `361144` / `400000` unchanged.
- **Browser QA: never performed.** No claim of browser verification exists for any surface, including G-7
  and Phase 2A.
- **CI: not configured** (0 workflows).

## 6. What this backup operation did *not* do

- Did **not** run the full suite, typecheck or builds — no new green was manufactured; §2 rows 1–20 are
  preserved prior evidence, rows 23–24 are this operation's own re-verifications.
- Did **not** modify any test, source file, document, ref, or governance statement.
- Did **not** fix I19, I15, I22 or any other open item; did **not** resolve D8; did **not** change D9.
