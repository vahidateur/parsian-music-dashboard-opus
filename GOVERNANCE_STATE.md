# GOVERNANCE STATE — snapshot at 2026-09-29 (pre-F2 backup)

> Preservation only. **Nothing below is resolved, changed, reinterpreted or re-ranked.** Where repository
> documents disagree, the disagreement is recorded as evidence and no side is chosen. Every value was read
> from the merged `main` @ `15775ea9486cb57fbfb8fefa3268658cbe7eb669`.

## 1. Item register (status exactly as recorded in the repository)

| Item | Subject | Recorded state | Source of the record |
| --- | --- | --- | --- |
| **D8 / Organization** | Organization repository resolves to Demo in both modes; absent from `DEMO_SERVED_DOMAINS` | **OPEN — owner decision.** 12 demo-in-both getters vs **11** `DEMO_SERVED_DOMAINS` (`registry.ts:283`); `organization` missing from that list; `getOrganizationRepository()` = `overrides.organization ?? new DemoOrganizationRepository()` (`registry.ts:194–196`). List block and getter **byte-identical** pre-Phase-2A base ↔ `main`; discrepancy **predates Phase 2A**. Owner classification **C** recorded in `PHASE_2A_DECISION_AUDIT.md`; no governance exception exists; no repository document assigns D8 to Phase 2B | `PHASE_2A_DECISION_AUDIT.md`; `src/domains/registry.ts`; `src/domains/registryCore.ts` |
| **D9** | Performance budget | **IN FORCE, unchanged.** Cap `361144` = `floor(343947 × 1.05)`; baseline recorded post-D9-A-lite; entry anchor `273791`; single-chunk ceiling `400000`. Measured **361,037 → 107 B headroom**. **No headroom/warning rule exists anywhere in `docs/`** (full-text search returns nothing); the only adjacent doctrine is that the Vite chunk-size *warning* is cleared **by splitting, never by raising `chunkSizeWarningLimit`** (`DECISIONS.md` §22 and its narrative) | `src/__tests__/bundleBudget.test.ts:65–69`; `DECISIONS.md` §22 |
| **T-02** | Teacher student-read scope | **ACCEPTED / ASSIGNED-ONLY — "do not revisit"; fail-closed.** Scope = active enrollment ∩ `class.teacherId`. Historical ALLOWED-org-wide evidence preserved as history only. Implemented by `isAssignedStudent`/`canReadStudent`; `canReadStudentOrgWide` kept solely as a documented historical helper | `GOVERNANCE_CHECKPOINT.md`; `docs/frontend-completion/05-rbac-access-control.md` |
| **I13** | List hook publishes previous query's rows with no loading marker | **IN PROGRESS** — Checkpoints 1 (A′), 2, 3A, 3B implemented and validated; 3 view-boundary readers remain (absorbed into F2 per the roadmap) | `OPEN_ITEMS.md` |
| **I15** | Fourteen list consumers discard `error` | **CONTRADICTION — recorded, not decided.** The item's status line says *"not authorized, not started"*, **but** commit `eaccbb1` (2026-09-18, *"fix(failure-disclosure): M-4 close I15 remaining surfaces"*) is an **ancestor of `main`** and `failureDisclosureI15.test.tsx` passes **24 tests**. Both facts are preserved verbatim; **this backup does not decide which side is correct** | `OPEN_ITEMS.md` I15; `git merge-base --is-ancestor eaccbb1 main`; test run |
| **I16** | Lists meaning "everything" stop at `per_page: 200`; counts use `items.length` | **OPEN — "deferred, not authorized, not started — and still OPEN after…"**; roadmap F2 absorbs a *mitigation* (mitigation ≠ closure) | `OPEN_ITEMS.md`; roadmap F2 |
| **I19** | A scheduling write test is date-dependent | **RECORDED, ENVIRONMENTAL.** Fails on the weekdays its own fixture assigns to `cl2` (Tuesday); first recorded 2026-09-15, reproduced 2026-09-29. Remedy is a semantic test change in the **protected scheduling area** requiring authorization | `OPEN_ITEMS.md` I19; `PROJECT_STATE.md` §7 item 18 |
| **I22** | `ImportExportCenter`'s export half never renders (guard handed a `*`) | **NOT IMPLEMENTED** | `OPEN_ITEMS.md` I22 |
| **Backend / Laravel** | Server-side enforcement, org/scope/permission, media auth, signed URLs, scanning, transactions | **NOT STARTED, NOT AUTHORIZED.** "All of it — nothing here is optional"; authoritative list in `docs/production-handoff.md` + `docs/security.md` §8 | `OPEN_ITEMS.md` BACKEND; `SESSION_HANDOFF.md` §4b |
| **Freeze policy** | Canonical-branch / freeze rules | **IN FORCE.** "All future frontend fixes require explicit decision to reopen freeze"; §21 preservation gate; state-document gate | `PROJECT_STATE.md` §7 item 24; `DECISIONS.md` §21 |
| **D1** | Student role as a separate application | **DEFERRED** — student role not in this panel; only the authorization contract is testable now (S-01…S-04) | `DECISIONS.md` §19; `05-rbac-access-control.md` |
| **O-04** | Viewer accent vs org accent naming | **UNDECIDED** — "decision needed keep both clarified PROP-THEME-01" | roadmap F3 "Risks" |
| **O-01** | Student level scope | **DECIDED 2026-09-21 — PER-PROGRAM.** Key `(student_id, program_id)`; one active placement per (student, program) | `GOVERNANCE_CHECKPOINT.md` |
| **O-02** | Library resource level | **DECIDED 2026-09-21 — DESCRIPTIVE VOCABULARY.** Not an authorization field; no FK to learning levels; do not merge Library and Learning | `GOVERNANCE_CHECKPOINT.md` |
| **O-08 / O-10 / O-11 / O-13 / O-14** | Ownership / identity linking / organization-tenant | **ACCEPT(ED) WITH CONDITIONS.** No personal `owner_id`; tenant = `organization_id`; `uploaded_by`/`created_by` = provenance, not ACL; `users.organization_id` NOT NULL, tenant from auth; Telegram/Bale `chat_id`→`user_id`+`org_id` with uniqueness/UX **OPEN** | `GOVERNANCE_CHECKPOINT.md` |
| **M12** | Beyond-M11 milestone | **❌ NOT STARTED, NOT AUTHORIZED** — "no specification, no decision gate, and no separate owner authorization exists" | `PROJECT_STATE.md` |
| **Browser QA** | Any browser verification | **NEVER PERFORMED** in any session; no browser automation available; jsdom proof must not be reported as browser proof | `SESSION_HANDOFF.md`; `F1_REPORT.md`; audits |
| **CI** | Automated checks | **NOT CONFIGURED** — 0 workflows, 0 check-runs | repository; GitHub API |

## 2. Documentation drifts recorded (not fixed)

`OPEN_ITEMS.md` → **DOCUMENTATION DRIFT**: `docs/gap-matrix.md`, `docs/architecture/data-layer.md`,
`docs/production-handoff.md`, `docs/architecture/auth.md`, `docs/architecture/environments.md:56–63`.
Additionally, at the session level: `SESSION_HANDOFF.md` §1's table is explicitly historical and is
superseded by its newer live-pointer blockquotes; and the F2 status split (see the handoff §9).

## 3. Constraints that bind any future work

1. All future frontend fixes require an explicit decision to reopen the freeze.
2. §21 preservation gate and every preserved ref/tag/branch must stay intact.
3. T-02 is do-not-revisit; the smallest permission model is authoritative, fail-closed.
4. Backend/Laravel is unauthorized; every F-series "B" clause stays deferred.
5. UI hiding is never the security boundary; service-level enforcement is required (backend, deferred).
6. Tests must never be weakened, skipped, retimed or "made green"; the D9 cap must never be raised.
7. D8/Organization is an owner decision; D9 has no headroom rule — neither is touched here.
8. No history rewrite; work in disposable clones; the original checkout is read-only input.

> **This snapshot resolves nothing.** It exists so a later session can see the exact state that was true on
> 2026-09-29 without relying on conversation history.
