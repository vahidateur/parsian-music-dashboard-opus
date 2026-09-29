# F2 CLOSURE ASSESSMENT

> **Read-only assessment.** Produced 2026-09-29 against `main` @ `15775ea9486cb57fbfb8fefa3268658cbe7eb669`
> in a disposable clone. **No implementation, no test change, no governance edit.**
> Question answered: *can the repository's "F2 closure/acceptance pass" be completed from the existing code
> and evidence?* — **Partially.** The audit surface exists and is verifiable; full acceptance cannot be
> declared without three authorization-gated actions (§4). Nothing was fixed silently.

## 1. What F2 is, and why this is an audit

`docs/frontend-completion/11-roadmap.md` names **F2 — RBAC + Ownership/Scope + Error Disclosure** as the next
slice; the live handoff pointer (`docs/session-handoffs/PR18_FINAL_SESSION_HANDOFF.md`, 2026-09-27) says
*"F2 is NOT STARTED"* while `d0cfd52` ("F2 RBAC + Ownership/Scope + Error Disclosure … scope pure functions
(17 tests)") and `8aff3a2` ("F2 report: 16-item DoD") are **ancestors of `main`** — the code shipped with the
frontend-completion integration (`112f1160`), and `docs/engineering/F2_REPORT.md` belongs to the **older
`arena/frontend-completion-spec` lineage**. This assessment therefore audits the delivered code; it does not
re-implement F2.

## 2. Verification against current `main` (the nine areas named by the mandate)

| # | Area | Evidence found on `main` | Verdict |
| --- | --- | --- | --- |
| 1 | **RBAC matrix** | `src/domains/auth/permissions.ts`: `ROLES` = 5 (`administrator, manager, teacher, staff, accountant`); `PERMISSIONS` = **23** ids; `rolePermissions` (single source) + `viewPermissions`; `can()` / `canAccessView()` guards; no direct role-id checks (architecture gate) | Present. **One documentation drift** (§3.1) |
| 2 | **Scope functions** | `src/domains/auth/scope.ts` — **25 exported functions** (`isAssignedStudent`, `assignedStudentIdsForTeacher`, `isSelfStudent`, `canReadStudent`, `canReadStudentOrgWide` *(historical helper only)*, `canWriteStudent`, `canReadTeacher`, `canWriteAttendance`, `canReadAttendance`, `canWriteCompensation`, `canReadCompensation`, `canReadSchedule`, `canWriteSchedule`, `canExport`, `isEligibleLevel`, …); pure, arrays passed in, no store access | Present. **Wired into the app**: `src/views/Students.tsx:952,1093`, `src/domains/shared/teacherDesk.ts:99,354`, `useTeacherDesk.ts` |
| 3 | **Route protection** | `src/__tests__/routeProtection.test.tsx` — **9 cases**, including the two F2 names: *"honours the compensation deep link without falling back to the dashboard"* and *"refuses the compensation deep link for a role that may not read the schedule"* | Present, F2-named cases covered |
| 4 | **Failure disclosure / I15** | `src/domains/shared/__tests__/failureDisclosureI15.test.tsx` — **24 tests** covering LearningPanel, StudentLearningPanel, ClassFormDialog, EnrollmentDialog, GalleryPanel, StudentProgressPanel, AssignPieceDialog, PieceFormDialog, StudentFormDialog (the named consumers); commit `eaccbb1` (2026-09-18, *"fix(failure-disclosure): M-4 close I15 remaining surfaces"*) is an **ancestor of `main`** | Implemented **and** tested. **`OPEN_ITEMS.md` I15 status still says "not authorized, not started"** → open contradiction (§3.2) |
| 5 | **Export permission** | `src/domains/export/` — `canExport` in `scope.ts`; `exportService.test.ts` (6) + `exportTruncationTone.test.tsx` (2); `ImportExportCenter` | Present. **I22** (export half never renders) remains recorded NOT IMPLEMENTED |
| 6 | **Teacher assigned-only scope (T-02)** | `assignedStudentIdsForTeacher`/`isAssignedStudent` used by `Students.tsx` and the teacher desk; students scope/IDOR suites green in the post-merge audit | Present; **T-02 stays ACCEPTED / ASSIGNED-ONLY, do not revisit** |
| 7 | **I16 mitigation** | House convention `{ per_page: 200 }` remains; counts-from-`total` and truncation disclosure are implemented in some surfaces, **not proven per consumer** | **Mitigation, not closure.** `I16` stays OPEN (its own status line: *"deferred … and still OPEN"*) |
| 8 | **I13 view-boundary readers** | I13's own status: **IN PROGRESS — CP 1 (A′), 2, 3A, 3B implemented and validated**; the roadmap absorbs *"I13 view-boundary 3 readers"* into F2 | **3 readers remain**, and the roadmap's absorption is a plan, not a landed change |
| 9 | **F2 documentation state** | `docs/engineering/F2_REPORT.md` describes the **older lineage** (`F2-1..F2-5`, branch `arena/frontend-completion-spec`); there is **no post-merge F2 disposition record** on `main`; `11-roadmap.md` still carries the full F2 acceptance text | **Gap**: nothing on `main` states F2's status against the merged line |

## 3. Findings, classified (identified — never silently fixed)

### 3.1 Documentation drift: "22 permissions" vs 23 in code
`11-roadmap.md` F2 acceptance says *"5 roles 22 perms unchanged unless decision with evidence"*; the code has
**23** — the 23rd is `demo.manage`, present since `df2107b` (2026-09-05) and stable across every F2-era
commit (`d0cfd52`, `8aff3a2`, `eaccbb1`, `15775ea`). It is documented separately in
`docs/architecture/auth.md:45` and the matrix (`A-01`, `X-07`).
**Classification:** documentation undercount, **not** an F2 violation (F2 invented no permission).
**Required?** A one-line documentation correction — authorization needed (docs are governance-controlled).

### 3.2 Contradiction: I15 status line vs landed code (preserved, not decided)
`OPEN_ITEMS.md` I15 says *"recorded 2026-09-13, not authorized, not started"*; `eaccbb1` (ancestor of `main`)
and a passing 24-test suite say otherwise. **Both sides recorded; this assessment does not decide it.**
**Classification:** governance/documentation conflict. **Required?** Owner decision (reconcile the item's
status or its code claim) — it must not be resolved by a silent edit.

### 3.3 Missing matrix-ID traceability (6 of 11 required cases)
The RBAC matrix's 11 required cases are S-01…S-04, T-01…T-04, ST-01/ST-02, M-01, A-01 (+ X-01…X-11
cross-cutting). Only **S-01, S-02, T-01, T-02, M-01, A-01** are referenced by ID in test names
(`scope.test.ts`). **S-03, S-04, T-03, T-04, ST-01, ST-02** and X-01…X-11 are **not** referenced by ID.
Functionally, `canWriteAttendance` (≈T-03), `canWriteCompensation` (≈T-04), `canExport`, and the student
eligibility function `isEligibleLevel` (≈S-03/S-04) *are* covered under other names — but the F2 acceptance
text asks for the matrix to be a *testable contract*, and ID-level traceability is not machine-checked.
**Classification:** coverage/traceability gap (tests + docs). **Required?** Partially — deciding whether
ID-level naming is required is a product/QA decision; **adding tests requires explicit authorization**
(tests are never weakened; adding is still a change under the freeze policy).

### 3.4 I16 mitigation and I13's remaining readers
Both are absorbed into F2 *by the roadmap*, but neither is closed, and neither is authorized. They are
**implementation work**, not audit work. **Authorization required before any change.**

### 3.5 F2 report lineage caveat
`docs/engineering/F2_REPORT.md` must never be read as the closure of the current F2. A post-merge
disposition record (a single document stating what is verified, what is missing, and what is deferred)
**does not exist** and is itself the cheapest closure artifact — but writing it is a governance-document
change and needs authorization.

### 3.6 Second D8-related drift (cross-reference)
`DECISIONS.md` D8 says *"seven getters that switch on `isApiMode()`"*; the code has **eight**
(`students, teachers, rooms, classes, enrollments, auth, users, roles`). Recorded here because the F2
matrix is the RBAC/authorization artifact; the organization/D8 discrepancy itself is tracked in the
migration handoff §9 and stays an owner decision.

## 4. Can F2 closure be completed from existing code and evidence?

| Closure component | Feasible read-only? | Needs authorization? |
| --- | --- | --- |
| Audit of the nine areas (this document) | **Yes — done** | No |
| A post-merge F2 disposition record on `main` (docs only) | Yes | **Yes** (governance doc) |
| ID-level traceability for the 6 missing matrix cases | No (adds tests) | **Yes** |
| I15 status reconciliation | No (governance decision) | **Yes** (owner) |
| I16 mitigation / I13 remaining readers | No (code) | **Yes** |
| Keep T-02, backend, I19, D8, D9, freeze policy untouched | — | Mandatory in every case |

**Verdict: F2's *code* is on `main` and its *audit* is complete as of this document; a formal
closure cannot be declared without the §4 authorizations, and no closure claim is made here.**

## 5. Preserved constraints (explicitly re-affirmed by this assessment)

- **T-02** — ACCEPTED / ASSIGNED-ONLY, fail-closed, **do not revisit**; historical org-wide evidence stays
  history only.
- **Backend / Laravel** — **NOT AUTHORIZED**; every server-side enforcement clause stays deferred.
- **I19** — protected scheduling area; the date-dependent test is unmodified; its remedy requires
  authorization.
- **D8 / Organization** — owner decision; the enumeration and getter are left byte-identical.
- **D9** — cap `361144`; measured `361,037` (**107 B** headroom); no threshold invented, no cap moved.
- **Freeze policy** — no frontend implementation without an explicit reopen decision.
- **Tests** — never weakened, skipped or retimed; `routeProtection` and the boundary gates unchanged.
