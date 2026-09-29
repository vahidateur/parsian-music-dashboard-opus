# Phase 2B Discovery Audit

> **Read-only.** Executed 2026-09-29 (Asia/Tehran) in a disposable clone `/tmp/phase2b` (fresh, full, non-shallow).
> Baseline: `main` @ `15775ea9486cb57fbfb8fefa3268658cbe7eb669` (verified live via `git ls-remote`).
> No repository file, ref, config, test, doc, D8/D9 value or governance statement was modified. The only file
> written by this audit is this report itself (untracked, mirroring the `PHASE_2A_DECISION_AUDIT.md` precedent).
> **Headline:** the term **"Phase 2B" does not exist anywhere in the repository**. The repository designates
> **exactly one canonical next slice — F2 (RBAC + Ownership/Scope + Error Disclosure), as a closure/acceptance
> pass**, whose *code* is already on `main` while its *audit pass* is not started. Whether "Phase 2B" is intended
> to name that work is an owner decision; this audit does not make it.

---

## Baseline

| Fact | Value (measured this audit) |
| --- | --- |
| Live `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` (matches the stated baseline) |
| Merge shape | merge commit, exactly two parents `eb5b5598774bdadd0a7aabab01d88e564dcb867d` + `2df607eff5f1ea1fe85e86381b9b0398fec81d18` |
| Clone used | `/tmp/phase2b` — fresh full clone, not shallow, `git status` clean at start |
| Phase 2A commits intact | `1b96db7` "chore(build): Phase 2A build profiles", `1c8b832` "feat(phase-2a): composition seams and production delivery lock", `2df607e` "test(phase-2a): boundary, delivery, lock and registry tests" — all ancestors of `main`, original subjects |
| Landing branch | `arena/phase2a-landing` still at `2df607e` (retained, unmoved) |
| Original WIP checkout | `/home/user/parsian-music-dashboard-opus` @ `eb973eb`, branch `arena/01a0e8ec-…`, `0` staged, 78 pre-existing `M` + 24 `??` — untouched before and after this audit |
| Backup | `phase2a-wip-backup/phase2a-tracked.patch` sha256 `aed92770…` present, unmodified |
| CI | none — 0 workflows, so every gate below is local |

**Naming evidence.** `git grep "2B"` over `docs/` and `src/**/*.md` finds no phase definition (only binary JPEG
matches under `src/assets/images/`). The repository's own phase vocabularies are: product milestones **M0–M11**
(`docs/engineering/PROJECT_STATE.md`, `PHASES.md`, `PRODUCT_PHASE_SPECIFICATION.md`), the frontend-completion
slices **F0–F10** (`docs/frontend-completion/11-roadmap.md`), and one historical, unrelated "Phase 2 — the
interactive core" in `docs/architecture/data-layer.md:103`. The labels "Phase 2A"/"Phase 2B" are therefore
session-level labels; only "Phase 2A" has acquired repository substance (three merged commits, two audits).

---

## Completed Phase 2A

Delivered by PR #20 (merged non-force, `2026-09-28T23:21:11Z` → `15775ea`), preserved un-squashed:

| Commit | Subject | Files |
| --- | --- | --- |
| `1b96db7` | chore(build): Phase 2A build profiles | 5 |
| `1c8b832` | feat(phase-2a): composition seams and production delivery lock | 72 |
| `2df607e` | test(phase-2a): boundary, delivery, lock and registry tests | 26 |

Range `eb5b559..main`: **103 files, +3453 / −685, docs 0**; the only files outside `src/` are `package.json`,
`tsconfig.client.json`, `tsconfig.demo.json`, `vite.config.ts`.

Delivered surfaces on `main` (verified present this audit): `src/domains/registry.client.ts` +
`src/domains/registryCore.ts` composition split (registryCore reached only via the relative import
`./registryCore`, pinned by `registryClient.test.ts`), `src/api/deploymentLock.ts` (fail-closed production lock),
`src/domains/demo/delivery.ts`, `src/components/shell/DemoBackedNotice.tsx`, and `src/targets/` (12 files,
`targetFeatures.tsx` = 214 lines / 6 exports); build profiles `build:client` / `build:demo` / `build`.

Post-merge audit disposition (2026-09-28, carried forward and re-verified here where cheap):
builds reproduce with identical entry hashes; demo literals 0 in client artifacts / 1 in demo; the
demonstration-unavailable notice present in client (1 file) and absent in demo (0); G-7 intact
(`TeacherDashboard.tsx` `teacherId` ×2); `bundleBudget.test.ts` byte-unchanged; `DEMO_SERVED_DOMAINS` and the
organization getter byte-identical to the pre-Phase-2A base; **all PASS, no blockers**.

---

## Authoritative Open Items

Only items with repository evidence of being explicitly open, deferred, not authorized, or partially landed.
Statuses are quoted from the items' own status lines (`docs/engineering/OPEN_ITEMS.md`), not inferred.

| Item | Subject | Recorded status |
| --- | --- | --- |
| I2 | Finance and Reports have no domain layer | recorded; no closure status |
| I4 | Teacher visual workspace | recorded; no closure status |
| I5 | Student visual workspace + unresolved student-role decision | recorded; no closure status |
| I7 | Official Telegram / Bale provider research | recorded; open research item |
| I8 | Backup envelope labels every backup "demo" | recorded; open |
| I10 | The "all collections zero" invariant constrains any H5 fix | recorded; open |
| I11 | Test-harness races — both retired at their boundaries; product behaviour now I13/I14 | superseded in part, kept |
| I13 | List hook publishes previous query's rows with no loading marker | **IN PROGRESS — CP 1 (A′), 2, 3A, 3B implemented and validated** |
| I14 | `paginate` clamps `per_page: 0` to one row | recorded; open |
| I15 | Fourteen list consumers discard `error` | status line says **"not authorized, not started"** — but `eaccbb1` (2026-09-18, *ancestor of `main`*) "fix(failure-disclosure): M-4 close I15 remaining surfaces" and `failureDisclosureI15.test.tsx` (24 passing tests) exist → **status/document conflict, flagged, not resolved** |
| I16 | Lists meaning "everything" stop at `per_page: 200`; counts use `items.length` | **deferred, not authorized, not started — and still OPEN** |
| I17 | Level-content link order invisible to the operator | **not authorized, not started** |
| I18 | A cancelled class/teacher requires a compensatory session | **PARTLY LANDED (private one-to-one), item still OPEN** |
| I19 | A scheduling write test is date-dependent (fails on `cl2`'s weekdays) | recorded, environmental, protected area |
| I20 | The compensation contract has a UI and no server | OPEN |
| I22 | `ImportExportCenter`'s export half never renders (guard handed a *) | **NOT IMPLEMENTED** |
| L1 | Command-palette natural-language matching is substring-loose | open |
| L2 | Dead code `TeacherNote` (`src/domains/teachers/types.ts:14`) | open |
| L3 | Domain README stubs contradict the code | ✅ both retired 2026-09-14 |
| H1–H7 | earlier high-priority family | ✅ LANDED / CLOSED |
| I1, I3, I6, I9, I12, I21 | — | ✅ CLOSED |
| DOCUMENTATION DRIFT | `gap-matrix.md`, `architecture/data-layer.md`, `production-handoff.md`, `architecture/auth.md`, `architecture/environments.md:56–63` | recorded, not fixed |
| BACKEND | every backend item | "all of it — nothing here is optional"; authoritative list in `docs/production-handoff.md` + `docs/security.md` §8; **implementation not authorized** |

Governance-level constraints holding all of the above open (not closable by a frontend slice): freeze-reopen
policy (`PROJECT_STATE.md` §7 item 24 — "all future frontend fixes require explicit decision to reopen
freeze"), the §21 preservation gate, T-02 "ACCEPTED / ASSIGNED-ONLY — do not revisit", and Laravel/backend
**NOT AUTHORIZED**.

---

## Explicit Phase 2B Scope

**No repository document assigns any work to "Phase 2B".** There is consequently no repository-identified
"Phase 2B scope" in the strict sense. Two facts are, however, unambiguous repository evidence:

1. **The repository designates exactly one canonical next slice.** `docs/frontend-completion/11-roadmap.md`
   marks F0 ✅ COMPLETE and F1 as "NEXT ACTION (exactly ONE canonical next slice)"; the sequence F2 → F10 is
   defined after it. The live handoff pointer (`docs/session-handoffs/PR18_FINAL_SESSION_HANDOFF.md`,
   2026-09-27, which supersedes the older `SESSION_HANDOFF.md` §1 table) states the intended order:
   *merge PR #18 → read-only post-merge integrity audit → establish the merged `main` SHA → **"Only then begin
   F2 planning/execution."*** All three prerequisites are now satisfied (PR #18 merged; post-merge audit GREEN;
   merged SHA recorded as `15775ea…`, and re-verified here).
2. **F2's code is already on `main`, but its closure pass is not started.** `d0cfd52` ("F2 RBAC + Ownership/Scope
   + Error Disclosure: scope pure functions …") and `8aff3a2` ("F2 report: 16-item DoD") are both ancestors of
   `main`; `src/domains/auth/scope.ts` exists with **25 exported functions** and is wired into the app
   (`src/views/Students.tsx:952,1093`; `src/domains/shared/teacherDesk.ts:99,354`; `useTeacherDesk.ts:320`).
   The handoff nevertheless says "**F2 — not started. No planning, no scaffolding, no file.**" and explains
   `docs/engineering/F2_REPORT.md` is a **pre-existing report from the older
   `arena/frontend-completion-spec` lineage** (`d0cfd52` is that lineage's head) — "not a statement that the
   current F2 is done". The reconciliation that fits every piece of evidence: *F2's implementation shipped with
   the frontend-completion integration (`112f116`), while the F2 **closure / acceptance pass** — the pattern F1
   received in PRs #17/#18 — has not been performed against the merged `main`.*

**Therefore:** the only repository-identified candidate for "what Phase 2B is" is **an F2 closure/acceptance
pass over already-delivered code** (documentation + verification + any authorized repairs), *not* a
greenfield feature phase. Naming that work "Phase 2B", or choosing any other content for "Phase 2B", is an
owner decision this audit deliberately does not make.

Satisfied acceptance criteria that a Phase 2B pass must **not** re-litigate (already delivered and closed):
G-1…G-7 (F1 closure), T-02 reconciled as ACCEPTED / ASSIGNED-ONLY, O-01 per-program and O-02 descriptive
vocabulary decided 2026-09-21, the F1 dispositions (library detail in-surface, `active`/`visibility` semantics,
inactive-student eligibility OPEN, gallery seed 2 albums / 0 images), D19 compensation permission basis, and
the family H1–H7 / I1 / I3 / I6 / I9 / I12 / I21.

---

## Deferred / Owner Decisions

These are decisions the repository places outside any automatic next slice (owner-gated, or explicitly
"do not revisit"). Listed as facts; no option is preferred here.

- **T-02** — ACCEPTED / ASSIGNED-ONLY; "do not revisit"; fail-closed; scope =
  active enrollment ∩ `class.teacherId`. Historical ALLOWED-org-wide evidence preserved as history only.
- **O-01** — DECIDED 2026-09-21, per-program (`(student_id, program_id)` placement).
- **O-02** — DECIDED 2026-09-21, descriptive vocabulary; not an authorization field; no FK.
- **O-04** — viewer accent vs org accent naming; "decision needed" (PROP-THEME-01) — still undecided.
- **O-08 / O-10 / O-11 / O-13 / O-14** — ACCEPT(ED) WITH CONDITIONS (ownership = no personal `owner_id`;
  identity linking uniqueness/UX OPEN; tenant from auth) — backend conditions, not frontend work.
- **D1** — student role as a separate app: deferred; only the contract is testable now.
- **Organization / D8** — owner decision (see next section).
- **Laravel / backend** — NOT STARTED, NOT AUTHORIZED; every backend item is non-optional but deferred.
- **M12** — "❌ NOT STARTED, NOT AUTHORIZED: no specification, no decision gate, and no separate owner
  authorization exists".
- **Browser QA** — never run, in any session to date; not a deferral by choice but an unavailable capability.
- **Freeze policy** — future frontend fixes require an explicit decision to reopen the freeze.
- **I19** — the honest fix (target day the fixture cannot collide with, or a filter excluding seeded rows) is a
  semantic test change in the **protected scheduling area** and **requires authorization**; not authorized.

---

## D8 / Organization

Factual state only; **not** resolved, **not** classified A/B/C here, and **no repository document found that
assigns it to Phase 2B** — so by the standing rule it remains an owner decision.

Measured on `main` @ `15775ea` (this audit, in the fresh clone, matching the post-merge audit byte-for-byte):

- **12** repository getters resolve their Demo implementation in **both** modes (each `return overrides.X ?? new
  DemoX…`); one of them is multi-line (compensation).
- **`DEMO_SERVED_DOMAINS`** (`src/domains/registry.ts:283`) lists **11** entries: `instruments`, `learning`,
  `chat`, `media`, `library`, `branding`, `gallery`, `progress`, `scheduling`, `attendance`, `compensation`.
- **`organization` is absent from that list** while `getOrganizationRepository()` (`registry.ts:194–196`)
  returns `overrides.organization ?? new DemoOrganizationRepository()` — i.e. the organization repository has
  no client-mode override and resolves to Demo in both modes. That is the 12-vs-11 discrepancy.
- The list block and the organization getter are **byte-identical between the pre-Phase-2A base and `main`**;
  the Phase 2A override lines were relocated to `src/domains/registryCore.ts` (organization override at
  `:53`/`:114`/`:163`) with unchanged semantics. The discrepancy therefore **predates Phase 2A**.
- A `src/domains/organization/` surface exists (`…Panel.tsx` view retargets).

No governance exception is recorded for this discrepancy; the earlier owner classification (C, recorded in
`PHASE_2A_DECISION_AUDIT.md`) is accepted and is **not modified** by this audit.

---

## D9 Budget

Measured this audit in `/tmp/phase2b` with the repository's own methodology (bare build, CLI `gzip -6 -n` per
file):

| Metric | Value | Governing clause |
| --- | --- | --- |
| Entry chunk gzip | **135,153** (`index-ClGxcDcZ.js`) | strictly below the `273791` anchor ✅ |
| Total gzip JS+CSS+HTML | **361,037** (JS+CSS 360,019 + HTML 1,018, 7 chunks + css) | ≤ cap **361,144** ✅ |
| Headroom | **107 B** | — |
| Largest single chunk | 135,153 | < `400000` ceiling ✅ |

Constants in `src/__tests__/bundleBudget.test.ts`: `GZIP_TOTAL_BASELINE = 343947` (D9-B, DECISIONS §22),
`ENTRY_GZIP_BASELINE = 273791` (c16890f anchor), `GZIP_TOTAL_CAP = Math.floor(343947 × 1.05) = 361144`,
`SINGLE_CHUNK_GZIP_CEILING = 400000`. The test file is **byte-unchanged** from the pre-Phase-2A base. Both
measured numbers reproduce the post-merge audit exactly (`361,037`, `135,153`).

**Planning-rule question (audit item 6).** Repository governance defines **no** planning rule for low headroom:
a full-text search for `headroom` across `docs/` returns nothing, and there is no documented warning band,
threshold, or headroom-triggered obligation. The only related doctrine is the opposite direction —
`DECISIONS.md` §22 and its narrative require that the Vite chunk-size *warning* be cleared by **splitting, never
by raising `chunkSizeWarningLimit`**. Consequently: the 107 B is **risk information only**; no warning
threshold is invented here, the cap is not changed, and no optimisation is performed or proposed.

---

## Test Baseline

Executed in `/tmp/phase2b` (disposable clone; `node_modules` installed fresh, `npm ci` exit 0).

| Gate | Result |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit` | **0 errors** |
| `npm run build:client` | exit 0 — `dist/client/assets/index-BMhVg0_F.js` 261,828 B (gzip 78.08 kB) |
| `npm run build:demo` | exit 0 — `dist/demo/assets/index-DU355MkG.js` |
| `npm run build` (bare) | exit 0 — `dist/assets/index-ClGxcDcZ.js` (gzip 135,153 = the D9 entry anchor) |
| Focused Phase 2A + RBAC suites (7 files: deploymentLock, delivery, registryClient, DemoBackedNotice, scope, routeProtection, failureDisclosureI15) | **90/90 passed** |
| `bundleBudget.test.ts` + `mobileContract.test.ts` | 27 passed / 5 skipped (skips are build-artifact-conditional) |
| `architectureBoundaries.test.ts` (24) + `projectState.test.ts` (52) | **76/76 passed** |
| **Full suite, audit-comparable dist state** | **2565 total = 2562 passed / 2 skipped / 1 failed** |

**The single failure is the documented, date-dependent environmental case — not a regression.**
`src/views/__tests__/schedulingWrites.test.tsx` → *"a real reschedule resolving a real conflict"* fails today
because it is **Tuesday 2026-09-29**, the same weekday as `SEED_DATE = "2026-09-01"` (a Tuesday), and the
fixture gives `cl2` the Tuesday slot; the seeded row falls inside the test's same-day filter:
`AssertionError: one move, not a duplicate: expected [ 'ses_m_mulx…', …(1) ] to deeply equal [ 'ses_m_mulx…' ]`.
This is exactly `OPEN_ITEMS.md` **I19** / `PROJECT_STATE.md` §7 item 18 (first recorded 2026-09-15, also a
Tuesday, with the same mechanism and the same class of message). Phase 2A does not touch it:
`git diff --stat eb5b559..main` for `schedulingWrites.test.tsx`, `schedulingSeed.ts`, `clock.ts` is **empty**.
The test was **not** modified, skipped, retried or retimed by this audit.

**Why the post-merge run reported "2 skipped" and earlier runs here reported 15.** The three suites
`bundleBoundary`, `bundleBudget` and `cspCompatibility` guard themselves with `describe.skipIf(!hasBuild)`
(`dist/index.html`, `dist/client`, `dist/demo`). With all build outputs present the suite is
**2565 total / 2 skipped** — byte-for-byte the same total as the post-merge audit, whose run 2 was
2563 passed / 2 skipped / 0 failed. Today's only delta from that baseline is the I19 weekday. Earlier runs in
this session, taken before the build outputs existed, showed 15 skips for the same reason. Skip counts here are
a function of which build artifacts exist, never of test edits.

**Separately recorded (pre-existing, outside Phase 2A):** `emptyEnvironmentPanels.test.tsx` → *"saving the
academy's identity never calls it demo data"* (load-sensitive `waitFor(…, {timeout: 8000})`), the flake observed
once during the post-merge audit. It **did not reproduce** in any of the four full-suite runs this audit
(0/4). The test is **not modified**; it remains recorded as a load-sensitive flake in a file Phase 2A never
touched.

---

## Dependencies and Constraints

- **Authorization boundary.** Backend/Laravel work is NOT AUTHORIZED; every F2 "B" clause (server-side
  `org_id` + permission + scope enforcement, per-object media authorization, signed URLs, scanning,
  transactions) is deferred until backend/integration authorization exists.
- **Security boundary.** UI hiding is never the security boundary; scope functions are pure and unit-tested, and
  every guard is explicitly documented as UX-only. Fail-closed is the rule (T-02; ownership-unproven ⇒ preserve).
- **Protected areas.** The scheduling domain (I19's fix needs authorization), the §21 preservation gate,
  T-02 "do not revisit", and every preserved ref/tag/branch.
- **Freeze policy.** Reopening the freeze for frontend changes requires an explicit decision.
- **D9.** 107 B headroom against a hard cap; no headroom rule exists; test constants must not move.
- **D8/Organization.** Open owner decision; must be preserved as-is by any slice.
- **D1.** Student role remains a separate deferred app; only its authorization contract is testable.
- **No CI.** Zero workflows; every gate is executed locally and must be reported with its evidence.
- **Unavailable capability.** Browser QA has never been run; jsdom proof must not be reported as browser proof.
- **Execution hygiene.** All work in disposable clones; original checkout untouched; byte-identity (sha256) and
  explicit-path staging; no test weakening; no history rewrite; rollback = discard the clone.

---

## Candidate Implementation Units

Grouped by the repository's own evidence classification. **Unordered — no ranking, scoring, or selection.**
"A" means *explicitly named by repository documentation as the next work*; "B" means *explicitly deferred or
open*; "C" means *dependency/blocker*; "D" means *observation only — not established work*.

### A — explicitly identified by repository documentation as next work (F2 closure/acceptance pass)

| Unit | Evidence of requirement | Affected modules / files | Existing tests | Missing / unproven | Architectural, D9, boundary notes |
| --- | --- | --- | --- | --- | --- |
| A-1 RBAC matrix traceability (11 required cases S-01…A-01) | roadmap F2 "Acceptance"/"Tests"; `docs/frontend-completion/05-rbac-access-control.md` table | `src/domains/auth/permissions.ts` (5 roles / 22 perms), `scope.ts` (25 exports), all consuming views | `scope.test.ts` 23 tests — case IDs **S-01, S-02, T-01, T-02, M-01, A-01** appear in test names | S-03, S-04, T-03, T-04, ST-01, ST-02 and cross-cutting X-01…X-11 are **not referenced by ID**; some functional coverage exists under other names (`canWriteAttendance`, `canWriteCompensation`, `canExport` in `scope.test.ts`) but ID-level traceability is not machine-checked | Vocabulary must stay 5 roles / 22 perms unless a decision with evidence; no direct role-id checks in components (architecture gate) | No build-size impact expected (tests/doc only unless code changes) | Security: matrix documents DENIED paths; UI guards remain UX-only, server enforcement deferred (C) |
| A-2 Route-protection real-route cases | roadmap F2 "Tests": *routeProtection real route #/compensation … no silent Dashboard fallback; role without `schedule.read` refused* | `src/security/AccessGate.tsx`, `accessPath.ts`, `App.tsx`, routing | `routeProtection.test.tsx` **9 cases**, including exactly those two (lines 97, 115) | No equivalent case named for other privileged routes beyond the existing set | Route guard must not depend on role ids directly | none | Security: proves no silent fallback to Dashboard on refusal |
| A-3 Error disclosure for every list consumer (I15) | roadmap F2 "Minor hardening absorbed": I15 error-discarding consumers | all `useResource`/`useDerived` list consumers | `failureDisclosureI15.test.tsx` **24 passing**; commit `eaccbb1` (2026-09-18) "close I15 remaining surfaces" is an ancestor of `main` | **`OPEN_ITEMS.md` I15 status line still says "not authorized, not started"** → documentation/status conflict; consumer-by-consumer confirmation against the current tree is unproven | `useResource` keeps the previous page on failed refetch (`useResource.ts:113`) | none | Security/UX: a failed read must never render as "empty" |
| A-4 Export permission hiding | roadmap F2 "Visible outcome" (+ I22 as the counter-example) | `src/domains/export/*` (`exportService`, `ImportExportCenter`) | `exportService.test.ts`, `exportTruncationTone.test.tsx`; `canExport` in `scope.test.ts` | I22 (`ImportExportCenter` export half never renders) is recorded **NOT IMPLEMENTED** and is adjacent to this unit | `canExport(actor, requiredPermission)` pure function is the single check | none | Security: export must be hidden *and* permission-checked |
| A-5 Teacher assigned-only scope wiring (T-02) | roadmap F2 "Risks" + GOVERNANCE_CHECKPOINT T-02 ACCEPTED/ASSIGNED-ONLY | `src/views/Students.tsx:952,1093`, `src/domains/shared/teacherDesk.ts:99,354`, `useTeacherDesk.ts` | `scope.test.ts` (T-01/T-02), students scope/IDOR suites (16 tests in the post-merge evidence) | No repository statement that *all* teacher-facing reads are assigned-only; `per_page: 200` read ceilings remain | Query-side filtering is the mandated shape (never load-then-filter); T-02 is **do-not-revisit** | none | Security: teacher→unassigned must be DENIED fail-closed |
| A-6 I16 mitigation absorbed into F2 | roadmap F2 "Minor hardening absorbed": I16 remaining | list consumers using `{ per_page: 200 }` | none specific | Counts from `total`, truncation disclosure («N ردیف از M») unproven per consumer; **I16 itself stays OPEN** (mitigation ≠ closure) | `paginate` still has no upper clamp (`demoCollection.ts:23`) | none | UX honesty only |
| A-7 I13 view-boundary readers | roadmap F2 "Minor hardening absorbed": I13 view-boundary 3 readers | `useResource`/`useDerived` consumers; `useStudentList` un-keyed | I13 CP-1/2/3A/3B validated (own status line) | Remaining 3 readers unproven | Consumer-side key discipline is the current mitigation | none | UX honesty only |
| A-8 Documentation reconciliation for F2 | roadmap F2 "Acceptance": matrix documented, self/assigned/org scope documented, UX-only stated | `docs/frontend-completion/11-roadmap.md`, `05-rbac-access-control.md`, `12-decision-register.md`, `docs/engineering/F2_REPORT.md` (lineage caveat), `OPEN_ITEMS.md` I15/I13/I16 statuses | doc gates (`projectState.test.ts`, drift checks where they exist) | No single document states F2's post-merge disposition; `F2_REPORT.md` describes the older lineage | Docs-only; must not silently rewrite governance | none | — |

### B — explicitly deferred / open (repository-recorded, not assigned to any next slice)

I2 (Finance & Reports domain), I4 (teacher workspace), I5 (student workspace + student-role decision), I7
(Telegram/Bale provider research), I8 (backup envelope "demo" labelling), I10 (all-collections-zero
invariant), I11 (harness races — superseded in part), I14 (`per_page: 0` clamp), I16 (200 ceiling — mitigation
≠ closure), I17 (level-content link order invisible to operator), I18 (compensatory session — partly landed),
**I19** (date-dependent test; fix requires authorization), I20 (compensation server contract), I22
(`ImportExportCenter`), L1 (command-palette matching), L2 (dead `TeacherNote`), the DOCUMENTATION DRIFT set
(gap-matrix, data-layer, production-handoff, auth, environments), and the whole BACKEND list (non-optional,
unauthorized).

### C — dependencies / blockers (nothing can proceed past these without an owner action)

Backend/Laravel authorization (F2's B clauses and every backend item); D1 (student portal as a separate app);
T-02 do-not-revisit; O-04 accent-naming decision (PROP-THEME-01); O-08/O-10/O-11/O-13/O-14 backend conditions;
**D8/Organization owner decision**; D9's 107 B headroom; freeze-reopen policy; §21 preservation gate; protected
scheduling area (I19); absence of CI; absence of browser automation.

### D — observations only (recorded, explicitly **not** established work)

"Phase 2B" is not a repository term; `SESSION_HANDOFF.md` §4b ("F0–F10 COMPLETE/DELIVERED") vs the live PR #18
pointer ("F2 is NOT STARTED") reads as a *code-delivered / audit-not-started* distinction, not a contradiction
about code; `docs/engineering/F2_REPORT.md` documents the older lineage and must not be read as F2's closure;
I15's status line contradicts a landed commit (`eaccbb1`) and a passing suite; the RBAC matrix's case IDs are
not mechanically enumerated for all 11; the "add" button is not gated by `library.write` (pre-existing, identical
on the base); clearing a library teacher stores `""` rather than an absent value (data-hygiene nit);
`resourceByline` is exported but used only inside `Library.tsx` (cosmetic); no code-splitting warning is
resolved; four zero-byte `finance` domain files exist; `emptyEnvironmentPanels` is a load-sensitive flake; the
repo has no CI.

---

## Verification Gates

Proposed **structure only** (no execution order implied, no gate invented that the repository does not already
have). Every gate below exists today and was executed in this audit.

1. **Typecheck** — `./node_modules/.bin/tsc --noEmit`, 0 errors.
2. **Builds** — `build:client`, `build:demo`, bare `build`, each exit 0; entry hashes/filenames recorded.
3. **D9 budget** — `bundleBudget.test.ts`'s three clauses (entry strictly < 273791; total ≤ 361144; no chunk
   ≥ 400000), constants untouched, CLI `gzip -6 -n` methodology only.
4. **Boundary** — `bundleBoundary.test.ts` (client/demo literal separation, vacuous-pass guard at
   `expect(out.length).toBeGreaterThan(0)`), plus `cspCompatibility.test.ts` when a build exists.
5. **Architecture** — `architectureBoundaries.test.ts` (no direct role ids, domain boundaries), **mobile
   contract** `mobileContract.test.ts`, and `projectState.test.ts` (recorded checkpoints are real Git objects).
6. **Behavioral suites** — focused Phase 2A suites and the RBAC/scope suites, then the **full suite**, with the
   build-artifact state stated so skip counts are interpretable, and with I19's weekday failure reported as
   environmental (never fixed silently).
7. **Evidence discipline** — disposable clone only; explicit-path staging; `git status` / `git diff` review
   before any commit; sha256 byte-identity for anything claimed unchanged; no browser claim without browser QA;
   no test weakened, skipped or retimed; no budget raised; no D8/D9 value moved.
8. **Preservation & rollback** — the original WIP checkout and the backup are read-only inputs; the landing
   bundle remains the recovery source; rollback = discard the clone, never rewrite history.

---

## Unknowns / Evidence Gaps

1. **"Phase 2B" has no repository definition.** Its intended content is an owner decision; the only candidates
   the repository names are F2's closure pass (highest evidence) and the recorded open/deferred items above.
2. **F2's closure state is split** — code on `main`, pass not started — and `F2_REPORT.md` describes a
   *different lineage's* tree; nothing may be accepted from that report without re-verification against `main`.
3. **I15 status conflict** (status line vs `eaccbb1` + a 24-test passing suite) — unresolved; a closure pass
   must reconcile the artifact, not assume either side.
4. **The 11-case RBAC matrix is not fully machine-enumerated** (6 of 11 IDs appear in test names); whether that
   is acceptable is a product/QA decision, not one this audit may take.
5. **Browser QA has never been verified** for any delivered surface, including G-7 and Phase 2A.
6. **D8/Organization ownership** — no repository assignment to Phase 2B was found; owner decision.
7. **D9 has no headroom rule** — the 107 B is unmanaged by policy; whether any policy is wanted is an owner
   decision (none proposed here).
8. **No CI** — no automated evidence exists outside local runs; reproducibility depends on the recorded
   methodology.
9. **I19's remedy** (fixture day vs filter) is a semantic test change requiring authorization in a protected
   area; today's failure is deterministic on Tuesdays, not random.
10. **F3–F10 delivered-state evidence** rests on `SESSION_HANDOFF.md` §4b (2026-09-21) and the F-series reports;
    this audit re-verified only what touches the merged line (Phase 2A, F1/G-7, F2 artifacts).

---

## Final Read-Only Status

- **No tracked file was modified.** `git status --porcelain` in the original checkout shows the same 78 `M`
  entries and 24 `??` entries as before this audit; 0 staged; `HEAD` still `eb973eb` on
  `arena/01a0e8ec-parsian-music-dashboard-opus`.
- **No commit, push, merge, rebase, reset, checkout/switch, clean, or stash** was executed anywhere; no ref,
  tag, or remote was changed. `main` remains `15775ea…`; `arena/phase2a-landing` remains `2df607e…`.
- **D8/Organization not resolved, D9 not changed** (constants untouched, cap 361144, measurement 361037);
  `emptyEnvironmentPanels` and all tests unmodified; I19's failing assertion left exactly as recorded.
- All builds/tests ran in the disposable clone `/tmp/phase2b`; the WIP checkout and the backup were read-only.
- **Only addition:** this report file, `PHASE_2B_DISCOVERY_AUDIT.md` (untracked, non-source, same precedent as
  `PHASE_2A_DECISION_AUDIT.md`). No product decision, ranking, or recommendation is made anywhere above;
  the audit stops here pending explicit authorization for any implementation.
