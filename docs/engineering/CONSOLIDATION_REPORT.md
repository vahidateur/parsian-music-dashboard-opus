# FINAL CONSOLIDATION INVENTORY — pre-main freeze

**Date:** 2026-10-05 · **Branch:** `arena/01a10b63-parsian-music-dashboard-opus` · **Base of this pass:**
`7eba988a44ffd4ac38c40cc56b9f6717bc3787a7` · **Status:** ✅ READY FOR MAIN · **`main` untouched.**

This is the single record of the pre-main consolidation pass required before the continuation line is
transferred to `main`. It states what changed, what was verified, what could **not** be verified in
this environment, and what remains open. Every claim below names its evidence or is marked
**UNVERIFIED**. Nothing here is claimed on the strength of a commit message.

> **Reading rule.** Where a number is given as "measured", it was produced by running the command
> shown, in this environment, on this tree. Where it is given as "recorded", it comes from a
> committed CI result or a previous session's document and was **not** re-executed here.

---

## 0. Reconciliation — where the work actually was

The pass began by establishing the true repository state instead of trusting a SHA, because the
brief recorded that earlier sessions had been reset to `7215633`.

| Fact | Evidence |
|---|---|
| The checkout arrived **shallow** at `86dab3f4716a6ddff504bfe9156b26ed752cbb54` (`cleanup/demo-migration-lineage`), clean tree, 1 commit of history | `cat .git/shallow`; `git rev-list --count HEAD` → `1` |
| The continuation work was on the **remote** branch `arena/01a0f73f-…` at `7eba988a44ffd4ac38c40cc56b9f6717bc3787a7` | `git ls-remote origin` |
| `86dab3f` is a direct **ancestor** of `7eba988`, so nothing needed rescuing and nothing could be lost | `git merge-base --is-ancestor 86dab3f 7eba988` → true |
| The continuation tip was **54 commits / 123 files / +15 871 −142** ahead of the checkout | `git log --oneline 86dab3f..7eba988`; `git diff --stat 86dab3f 7eba988` |
| **`7215633` was never HEAD** in this checkout | `git log --oneline -8` on arrival |

**Action taken:** a full working-tree **manifest with sha256 hashes** was archived *before* anything
moved; ancestry was proven; then a **`git merge --ff-only`**. No reset, no clean, no force-push, no
stash, no re-clone, and no branch was created. `7eba988` and every ancestor including `90fc9ed`,
`53959c5` and `51be43e` are preserved as ancestors of the consolidation.

---

## 1. Git identity and transfer numbers

| Field | Value |
|---|---|
| BASE SHA (this pass) | `7eba988a44ffd4ac38c40cc56b9f6717bc3787a7` |
| BRANCH | `arena/01a10b63-parsian-music-dashboard-opus` |
| AHEAD / BEHIND `main` | **98 ahead / 0 behind** — `git rev-list --left-right --count origin/main...HEAD` |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` — **unchanged by this pass** |
| Fast-forwardable? | **Yes** — `git merge-base --is-ancestor origin/main HEAD` → true, so the transfer is a fast-forward |
| This pass: changed files | **12** (10 modified + 2 new) |
| This pass: insertions / deletions | **358 / 29** (tracked files; `git diff --shortstat 7eba988`) |
| Whole branch vs `main` | **515 files, +53 565 / −2 833** — the size of the eventual main transfer |
| Force-push | **None.** No history was rewritten |

> **The branch line is a strict superset of `main`.** `main` is an ancestor, so the transfer adds
> work without rewriting any commit that is already public.

---

## 2. Feature changes in this pass

### 2.1 RBAC — the frontend permission vocabulary was missing Progress (I24) — **the pass's principal defect**

DECISIONS §29 authorized Progress for v1 on 2026-10-03 and added exactly two ids, taking the
vocabulary **23 → 25**. The **backend** received both. The **frontend** kept the old 23 and the old
role matrix. Measured, not inferred:

```text
frontend ids BEFORE the fix : 23
backend  ids                : 25
in backend but not frontend : [ 'progress.read', 'progress.write' ]
```

This was silent: the server could answer a request the client had no word for, and the role editor
could not display or grant the ids at all.

**Fixed, to §29 exactly:**

| role | `progress.read` | `progress.write` |
|---|---|---|
| administrator | yes | yes |
| manager | yes | yes |
| teacher | yes | yes |
| staff | yes | **no** |
| accountant | **no** | **no** |

- `src/domains/auth/permissions.ts` — all 25 ids in the backend's order; `progress.read` in
  `READ_ONLY_CORE`; `progress.write` on manager and teacher.
- `src/domains/progress/StudentProgressPanel.tsx` — **wired, not merely declared**:
  `progress.write` gates the record / assign / complete / edit-with-unit controls, and the panel
  refuses to render a student's progress without `progress.read`, so accounting can no longer read a
  per-student progress record in the UI.
- `src/domains/auth/useRoles.ts` — the two Persian labels and a «پیشرفت هنرجو» editor group; the
  stale "23 checkboxes" comment corrected.

**The guard that was missing, now present — and proved non-vacuous.**
`src/domains/auth/__tests__/permissionParity.test.ts` (6 cases) parses the **shipped**
`backend/config/permissions.php` and asserts the vocabulary **and all five role grants** equal the
frontend's, including `permissionsForRole()`'s live resolution and the §29 table above. It compares
against the real file rather than a second hand-written list, because a hand-written list is the
artifact that drifted. Run against the pre-fix tree the vocabulary comparison **fails** on exactly
`['progress.read', 'progress.write']` — so it is a real guard, not a tautology. It also asserts no
`instruments.*` / `learning.*` / `rooms.*` / `notifications.*` id exists, keeping PB-3 and PB-5
Option A for everything except Progress.

**Evidence:** `permissionParity.test.ts` → **6 passed**; auth + progress + settings + mobile-contract
sweep → **263 passed, 0 failed**; `tsc --noEmit` → exit 0.

### 2.2 A real duplicate-work race in the conversation export

`src/views/Messages.tsx` guarded its export with `useState` (`if (!active || exporting) return`).
**State is not a synchronous guard.** Three clicks dispatched in the same tick all close over the
same `exporting === false`, so the guard admits all three — three repository reads and three
downloads from one double-click. It is reachable by a fast user, not only by a test.

**Fixed** with a synchronous `useRef` guard written on entry; `exporting` state is retained only to
disable the control and label it. No assertion was weakened — the failing case
(*"guards against duplicate work when the control is clicked repeatedly"*) now passes on its own
terms, and the whole file passes **21/21** repeatedly in isolation.

**Note on how this was found:** the case failed in a full-suite run but passed 3/3 in isolation. It
is a genuine product race whose window a loaded machine widens, not a test-harness artefact — so it
was fixed at the source in product code rather than by relaxing the test.

### 2.3 The dev-only Vite API proxy from phase 5.6.2 was **missing** and is added

`vite.config.ts` had **no** proxy, in any ref — verified by searching every branch and tag for
`127.0.0.1:8080` and by `git log --all -S`. This is genuinely absent work, not a lost edit. It
mattered because the app defaults to a **relative** API base (`VITE_API_BASE_URL=/api/v1`), so in
api mode a dev session would ask the Vite dev server for `/api/...` and get a 404.

Added `/api → http://127.0.0.1:8080` under **`server.proxy` only**, satisfying each stated
constraint:

| Constraint | How it is met |
|---|---|
| dev server only | `server.proxy` is a dev-server input; it is not read by the build |
| not in the production build | **measured**: `grep -rl "127.0.0.1:8080" dist/` → no match |
| does not break CSP | `PRODUCTION_CSP` untouched; still asserted against `deploy/nginx.conf` by `cspCompatibility.test.ts` (17 passed) |
| no unnecessary CORS | the browser keeps calling its **own** origin; the forward happens server-side; no `Access-Control-*` header is added anywhere |
| preserves path and query | no `rewrite` — `/api/v1/students?page=2` arrives intact; `changeOrigin` only rewrites `Host` |
| no production leak | **measured**: `grep -rl "localhost\|127.0.0.1" dist/` → no match |

`preview` deliberately gets **no** proxy: previewing a built artifact is a static check, and silently
forwarding its `/api` calls would disguise an unconfigured deployment as a working one. `.env.example`
documents the dev path, why it exists, and that it never reaches `dist/`.

### 2.4 Demo is no longer offered by the production-facing product

**What was already true (verified, not assumed).** Demo capability is absent from the client
composition **physically**: `src/targets/targetFeatures.client.tsx` returns `null` for
`SettingsFeatures`, and the target/registry selection is by **file alias**, so the bundler never
resolves a demo module in the client build — it is not a runtime flag that dead-code elimination
might miss. `src/__tests__/bundleBoundary.test.ts` proves it against the real `dist/client` output
by scanning every chunk for demo marker literals (`ava:demo:`, `@demo.local`, `arena-demo`,
`DEMO_PASSPHRASE`, `DemoDataPanel`, `demoDataManager`, `localStore`, `DataLifecycleGate`, …) and
requires the positive probes to be **present** in `dist/demo`. So the demo *product feature* was
already removed from production by construction.

**What was still leaking — and is now fixed.** The **permission vocabulary** was offering a
production-facing demo control. `demo.manage` (`«مدیریت دادهٔ نمایشی»`) is rendered by
`UsersPanel`'s role editor, which is **shared** by both compositions — so an administrator in the
client build was shown a checkbox for a capability that build does not have. Hiding a panel was not
sufficient because this surface is not target-swapped.

`demo.manage` **stays in the vocabulary**: it is the service-layer boundary for every destructive
demo operation, and removing the id would remove the boundary rather than the capability. It is now
declared a **demo-only permission** and the editor filters it by **composition**
(`permissionsForComposition(…, isDemoMode())`). The footer count is derived from the same filtered
list so it cannot claim more granted accesses than it renders controls for. Recorded as
**DECISIONS §31**; guarded by `src/domains/auth/__tests__/demoPermissionPresentation.test.ts`
(6 cases, both directions).

> **Why the gate is `isDemoMode()` and not `isDemoCapabilityAvailable()`.** The latter answers *"has
> production delivery happened yet"*, which is **true** in a fresh client build — gating on it would
> re-expose the checkbox in the one build that must not show it. A source assertion in the test pins
> this distinction, because the failure it prevents is silent.

**Deliberately preserved (§4A carve-outs).** Seeds, fixtures, the `src/domains/demo/` domain, the
demo repositories, `localOrApi` composition and the whole test substrate are **untouched**. Demo
remains a first-class environment for local development and for the test suites (DECISIONS §2); only
its *production-facing presentation* was removed.

### 2.5 Gallery — behaviour is truthful, no change required

Verified end to end and left alone, because the existing model is already honest:

| Layer | State | Evidence |
|---|---|---|
| View permission | `gallery → library.read` | `viewPermissions.gallery` |
| Write permission | write controls gated on `library.write` | `Gallery.tsx:55` `useCan("library.write")` |
| Administrator | full access | holds every id |
| Teacher | hidden from the **rail** only, by design | `Sidebar.tsx:134` `TEACHER_HIDDEN_VIEWS` includes `gallery` |
| Route guard | present and independent of navigation | `App.tsx:74` `if (!canAccess(view))` |
| Backend | **no** Gallery domain in the API | `registry.client.ts:247` → `unavailable<GalleryRepository>("gallery")`; listed in `UNAVAILABLE_DOMAINS` |
| Storage honesty | declares when bytes are unreachable | `Gallery.tsx:95` unavailable notice |

**One distinction recorded explicitly so the model does not "lie":** the teacher hiding is
**presentation-only and documented as such** at the definition site — a teacher *holds* `library.read`,
so a deep link to Gallery opens. The rail declines to surface it; the RBAC matrix is the authority on
what a teacher may read. This is intentional, not a guard gap, and no new backend domain was created
(§9).

---

## 3. F1–F6 re-audit status

Assessed against the **current implementation and its tests**, not against the phase reports.
Evidence suites were re-run in this pass: **24 files / 338 tests / 0 failed**.

| Phase | Status | Basis |
|---|---|---|
| **F1** kickoff / documentation corrections | ✅ **PASS** | Corrections landed and folded into the completion docs; the F1-KICKOFF record is preserved and the Library `composer`-as-teacher-proxy conflation it flagged is resolved (`teacherId` is now a real field, DECISIONS §24) |
| **F2** RBAC guards and scope | ✅ **PASS** | `src/domains/auth/scope.ts` (pure scope predicates), `viewPermissions` + `can()` + `canAccessView` as the single guard set, no component tests a role id directly (boundary gate), route guard independent of navigation, 14 failure-disclosure consumers; `scope.test.ts` 23, `routeProtection.test.tsx` 9, `failureDisclosureI15.test.tsx` 24 — all passing. **Note:** the matrix has since grown 22 → 25 ids (§2.1); the F2 report's "22 perms preserved" is a pre-§29 snapshot, not a contradiction |
| **F3** branding / theme editor | ✅ **PASS** | `BrandingPanel` with reset-to-default and draft-only preview, `BrandingRepository` with strict validation, `applyBranding` mounted below the lifecycle gate, org-vs-device split per D2; `branding.test.ts` 14, `brandingApplication.test.tsx` 15 — passing |
| **F4** export engine | ✅ **PASS** | `ExportDefinition`/`ExportColumn` single-owner column sets, filter reuse from list views, BOM, permission guard via the context holder, truncation disclosed as a **warning** tone; `exportService.test.ts` 6, `exportTruncationTone.test.tsx` 2 — passing. **I22** (the settings panel's holder defect) is now closed — §4 |
| **F5** dashboard analytics + date-range filtering | ✅ **PASS** | Every figure derived from stored records through `dashboardInsights.ts`, no fixture survives, empty sources render typed no-data rather than `NaN`, revenue chart removed rather than fabricated (Finance/Reports deferred, D6/I2); `dashboardInsights.test.ts` 35, `panelsEmpty.test.tsx` 12 — passing |
| **F6** chat + tickets + files | ✅ **PASS** | Conversation-keyed composer state, attachment two-write ordering (media then message), metadata-only single-conversation export with the 1000 ceiling disclosed, no fixture imports; `chat/` suite + `messages*` view suites + `media/` suite all passing, incl. the export race fix (§2.2). **Honest scope note:** the client composition still declares `chat` and `media` **unavailable** (`UNAVAILABLE_DOMAINS`) because there is no **server** implementation — the F6 contract is complete and demo-served, and the client says so rather than pretending otherwise |

No phase is PARTIAL or OPEN on its own definition of done. **`UNKNOWN` is recorded for nothing.**

---

## 4. I22 and I23

### I22 — `ImportExportCenter`'s export half never renders — ✅ **CLOSED (re-verified, not carried forward)**

The fix landed earlier (`5e5fa35af30070fa08b1ad6004f2ab29dffc27b0`, regression
`88fee2665434647f81b05b0f1560270ab56b86e3`) but the item was still carried as open. All three stated
*done-when* criteria were re-verified against the present tree:

1. **Same holder as its sibling** — `ImportExportCenter.tsx:40` `const auth = useAuth()`, `:64`
   `can(auth, perm)`, `:147` `can(auth, required)`; identical to `EntityExportButton.tsx:53`.
2. **Reaches «دانلود خروجی» as a permitted role** —
   `phaseBMutationGuards.test.tsx` → *"filters settings export by the session permission set (I22)"*.
3. **Honest empty state with no export permission** — same file → *"shows the honest empty export
   state when the issued set has no export permission"* (policy pinned to `finance.*` only).

**Measured:** `npx vitest run src/views/__tests__/phaseBMutationGuards.test.tsx src/domains/export/`
→ **13 passed, 0 failed**. Closed in `OPEN_ITEMS.md` with this evidence, **without** overclaiming:
a downloaded file is still not a server authorization and export remains **BACKEND-ONLY** — a scope
fact, never part of this item's done-when.

### I23 — `SchedulingTest` reschedule date-flake — ✅ **CLOSED (fix present; CI evidence recorded; not re-executed here)**

Verified **present in the code**, not merely asserted in prose:

- `SessionService.php` — the reschedule candidate now carries `'id' => $original->id`, with the
  comment block recording why (`overlappingSessions()` still sees the original as `scheduled`
  because it is cancelled later in the transaction, so the original blocked its own replacement).
- `ConflictDetector` — `whereKeyNot` exclusions at `:240-241` and `:262-263`; `id` is read in exactly
  one place downstream, so the fix cannot alter an unrelated check.
- `SchedulingTest.php` — `test_reschedule_links_original_and_replacement` is **pinned** to the exact
  collision fixture (`today+10`, `08:00–09:30` against a `09:00–10:00` move) with its assertions
  **unchanged**, and the new `test_reschedule_onto_another_sessions_slot_is_refused` proves a
  genuinely different clash is still refused. **No skip, no deletion, no loosened assertion.**

**Recorded CI evidence** (from the fix commit's run, `Tests: 307 passed (2005 assertions)`, 0 failed,
4 checks green). **Not re-executed here:** §6.

---

## 5. Navigate / guard consistency (§10)

| Requirement | State | Evidence |
|---|---|---|
| Navigation shows only permitted views | ✅ | `Sidebar` filters by `canAccess(item.id)`; `routeProtection` → *"hides navigation entries the session cannot open"* |
| Route guard independent of navigation | ✅ | `App.tsx` gates on `canAccess(view)`; a deep link to a forbidden view renders access-denied/default, asserted by *"blocks an unauthorized view even via a deep link"* |
| Deep link does not bypass authentication | ✅ | `routeProtection` → *"a deep link does not bypass authentication"* |
| Mutation controls permission-gated | ✅ | `phaseBMutationGuards` (11 cases) + per-domain gates; this pass extended it to Progress (§2.1) |
| Hiding UI is not treated as the boundary | ✅ | stated in `permissions.ts`, `AuthContext`, `StudentProgressPanel` and DECISIONS §31: the server is the boundary |

The rail's teacher-hidden rule remains **presentation**, deliberately and explicitly, per §2.5.

---

## 6. Verification — what was run, and what could not be

### 6.1 Executed in this environment (measured)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** — no errors |
| Full frontend suite (with build artifacts present) — **final run** | ✅ **206 files passed (206) · 2680 passed · 0 failed · 4 skipped (2684) · exit 0.** An earlier run in the same pass showed 2 failures; both were caused by **this pass's own documentation edits** and were fixed before the final run (§6.3). See the reconciliation in §6.2 |
| Focused sweeps | auth/progress/settings/mobile → **263 passed**; F2–F6 evidence → **338 passed**; I22 + gallery + boundaries → **94 passed** |
| `npm run build` (bare) · `npm run build:client` · `npm run build:demo` | **all three succeeded** — built in that order, because the bare build's in-root `outDir` empties `dist/` |
| Artifact gates with all three builds present | `bundleBoundary` 8 (2 sentinel skips) · `bundleBudget` 13 (2 sentinel skips) · `cspCompatibility` **17 passed, 0 skipped** · `configGate` 2 — **all passing** |
| Dev proxy absent from artifacts | `grep -rl "127.0.0.1:8080" dist/` → **no match** |
| No localhost in artifacts | `grep -rl "localhost\|127.0.0.1" dist/` → **no match** |
| I22 regression | **13 passed, 0 failed** |
| Parity guard non-vacuity | fails on the pre-fix tree on exactly `progress.read`/`progress.write` |
| Export race | file passes **21/21**, 3 consecutive isolated runs, after the ref fix |

### 6.2 Baseline reconciliation — the numbers differ, and here is why

| | declared baseline | measured this pass (final run) |
|---|---|---|
| test files | 204 | **206 passed** (+2: the two new guard files) |
| passed | 2654 | **2680** |
| failed | 0 | **0** |
| skipped | 18 (no `dist`) / 12 (with `dist`) | **4** |

**The arithmetic reconciles exactly:** 2654 + 12 new tests = 2666; the 14 tests that were skipped
without artifacts now **run** and pass (2680 − 2666 = 14), leaving 4 skips. The prompt anticipated 6 moving out of skipped; **14** did, because building all three
artifacts satisfies **every** conditional group — `cspCompatibility`'s `describe.skipIf(!hasBuild)`
(8 tests, now 0 skipped) *and* `bundleBudget`'s `hasFixtureBuild` fixture measurement. The 4
remaining skips are **by design**: paired `it.runIf` sentinels (`bundleBoundary` 2,
`bundleBudget` 2) where exactly one of each pair runs, plus `bundleBudget`'s empty
`describe.skipIf(hasFixtureBuild)`. **This is strictly more coverage, not a regression.**

Two earlier differences were **environmental, not regressions**, and both were resolved by
correcting the environment rather than the test:

- `projectState.test.ts` failed on arrival because the clone was **shallow** and lacked the
  preserved-branch tag object `251af96f…`. Fetching the tags made it pass **52/52**. The test was
  right; the clone was incomplete.
- `messagesConversationExport.test.tsx` failed in the loaded suite but passed 3/3 in isolation → a
  **real product race**, fixed at source (§2.2).

### 6.3 Two failures occurred mid-pass — both were this pass's own, and both are fixed

An intermediate full-suite run (before this document existed) reported **2678 passed / 2 failed**.
Both failures were `projectState.test.ts` gates firing **correctly** on this pass's own
documentation edits. They are recorded rather than hidden, because a green final run that silently
omits a mid-pass red is exactly the kind of claim this report is supposed to prevent. Both fixes are
in the final run above.

1. *"every relative markdown link points at a file that exists"* — `PROJECT_STATE.md` linked to
   `CONSOLIDATION_REPORT.md` before it existed. **Resolved by creating this file**, which was the
   pass's intended deliverable.
2. *"requires evidence for every item"* — each `### ` item in `OPEN_ITEMS.md` must name a `src/` or
   `docs/` path. Inserting the new `### I24` heading **truncated I23's section**, which had been
   satisfying the regex only incidentally (its own references are all `backend/…` paths, and its
   section previously absorbed the lower-priority bullets that carry `src/` paths). **Resolved by
   adding a real path reference to I23** — `src/views/__tests__/schedulingWrites.test.tsx`, the file
   I23 already points at in prose for its I19 comparison. **No assertion was weakened and no test was
   edited**; the gate was satisfied by making the item name its evidence, which is what the gate is
   for. This also removes a latent fragility, since a future edit could have unmasked the same gap.

### 6.4 NOT verified — stated plainly, never reported as PASS

| Area | Status | Why |
|---|---|---|
| **PHP / Composer / Laravel suite** | **UNVERIFIED** | `php`, `composer` and `mysql` are **not installed** and not installable here (§13). No backend test, migration or seed was executed in this pass |
| **MySQL leg / P-2 index gate** | **UNVERIFIED here** | requires a MySQL server; the committed CI result is recorded, not reproduced |
| **I23 regression re-run** | **UNVERIFIED here** | static verification only (§4) |
| **HTTP smoke** | **UNVERIFIED here** | needs a running backend |
| **Browser QA** | **NOT VERIFIED** | unchanged from the standing disposition — no browser was driven in this environment |
| **`dist/` provenance** | local build | the three artifacts were produced here for the artifact gates and are **gitignored** (`.gitignore` has `dist/`); none is committed |

**No backend-side claim in this report rests on a local run.** Everything attributed to the backend is
either static inspection of committed source or a *recorded* CI result, and is labelled as such.

---

## 7. Backend compatibility fixes preserved (not re-created)

The continuation line already carried these; the consolidation **kept every one** and re-invented
none. They are listed so the inventory is complete, with their evidence location rather than a
re-run:

MySQL dialect differences · partial unique-index behaviour · `StudentScope` SQL assertions ·
JSON key ordering · Organization validation tests · `DataProvider` modernization (PHPUnit
attributes replacing `@dataProvider` doc-comments) · the PHPUnit execution wrapper · flaky frontend
tests · **P-2 index compatibility** · the MySQL 8 verification leg.

Sources: `backend/phpunit.mysql.xml`, `backend/tests/Feature/{StudentScopeTest,OrganizationTest,
EnrollmentsTest,PrivilegedIdentityPolicyTest,StudentsTest}.php`,
`backend/database/migrations/2026_*_{class_sessions,attendance_tables,resources,pieces,
piece_assignments,progress_events}*`, and the backend-slice record at
`docs/engineering/backend-slice/FINAL_REPORT.md`. **Migrations were not touched by this pass** —
`git diff --name-only 7eba988 | grep '^backend/'` is **empty**.

---

## 8. Production safety

| Check | Result |
|---|---|
| Dev proxy not in the production build | ✅ **measured** — absent from `dist/` |
| No `localhost` / `127.0.0.1` in `dist/` | ✅ **measured** |
| No secrets in the diff | ✅ scanned for password/secret/token/key patterns — none |
| `.env` not committed; `.env.example` only | ✅ `.gitignore` excludes `.env` and `.env.*` except `.env.example` |
| No migrations / schema changed | ✅ none — `backend/` untouched |
| P-2 index dimensions untouched | ✅ no backend change at all |
| No CORS added | ✅ the proxy is same-origin; no `Access-Control-*` added |
| CSP unchanged | ✅ `PRODUCTION_CSP` untouched; `cspCompatibility` 17 passed |
| No generated artifacts or `node_modules` tracked | ✅ `git ls-files` matches neither |
| `git diff --check` | ✅ clean — no whitespace errors, no conflict markers |

---

## 9. Documentation changes

| Document | Change |
|---|---|
| `OPEN_ITEMS.md` | **I22 closed** with re-verified evidence and an explicit non-claim about the BACKEND-ONLY export boundary; **I24 added and closed** (the Progress vocabulary divergence, its fix, its guard and the proof the guard is non-vacuous); I23's evidence reference made explicit |
| `DECISIONS.md` | **§29 corrected** — its "Consequence" paragraph described the client gating writes on the `role` prop, which §2.1 supersedes; the entry now records the client-side alignment, and "Enforced by" names the frontend matrix and the parity test as well as the server. **§31 added** — demo stays a first-class environment, and is not offered by the production-facing product, with the `isDemoMode()`-vs-`isDemoCapabilityAvailable()` reasoning recorded |
| `PROJECT_STATE.md` | a new, dated **Last state update: 2026-10-05** blockquote recording this consolidation, its base SHA and its limits. The historical checkpoint rows are **unchanged** — they are the ledger and are gated by `projectState.test.ts` |
| `CONSOLIDATION_REPORT.md` | this file |

No document claims more than the evidence above. Items are marked CLOSED only where a run or a
present-in-code fix backs them; backend runtime is marked **UNVERIFIED**, not PASS.

---

## 10. Remaining blocked / open items

| Item | Status | Why it is not closed here |
|---|---|---|
| Laravel/backend suite, MySQL leg, HTTP smoke | **BLOCKED (environment)** | no PHP/Composer/MySQL available — see §6.4 |
| I23 regression re-execution | **BLOCKED (environment)** | static verification only |
| Browser QA | **NOT VERIFIED** | standing disposition; unchanged |
| **I19** frontend scheduling date-dependent test | **OPEN** | the frontend analogue of I23. It is an *environmental* weekday collision, measured failing on the pre-CP4 tree as well, and the honest fix (a target day the fixture cannot collide with, or a filter excluding seeded rows) is a **semantic test change requiring authorization**. Not touched |
| **I2 / D6** Finance and Reports domains | **OPEN / deferred by decision** | README-only by design; no fabricated figures were introduced |
| **L1 / L2** command-palette matching, `TeacherNote` dead code | **OPEN (lower priority)** | untouched |
| Backend export authorization | **BACKEND-ONLY by scope** | unchanged; not a defect (see I22) |
| PB-3 for instruments/learning; PB-5 notifications | **Option A, unchanged** | asserted by the parity test |
| Remaining `book`/unavailable-domain backend work | **BLOCKED** | no server implementation; declared in `UNAVAILABLE_DOMAINS` rather than faked |

---

## 11. Consolidation readiness

- [x] One continuation branch, no new branch created, no branch deleted or renamed
- [x] Working tree clean at the recorded checkpoint; no unrelated files in the diff
- [x] `main` an ancestor of HEAD → **fast-forwardable, no force-push needed**
- [x] RBAC frontend/backend aligned and **guarded by a parity test**
- [x] Demo absent from the production-facing product; dev/test substrate preserved
- [x] F1–F6 status known; none UNKNOWN
- [x] I22 closed with evidence; I23 closed and verified present; I24 found and closed
- [x] Gallery behaviour truthful; teacher-hidden documented as presentation
- [x] Navigation and route guards verified independent
- [x] Vite dev proxy added and verified absent from every artifact
- [x] typecheck PASS; build PASS (×3); frontend suite **fully green — 206 files, 2680 passed,
      0 failed, 4 skipped**; no assertion weakened, no test skipped or deleted, no coverage removed
- [x] No secrets, no unrelated files, no tracked artifacts, no migrations touched
- [x] Runtime limitations documented as **UNVERIFIED**, never as PASS
- [ ] **Transfer to `main` — NOT performed. Awaiting explicit instruction.**

## ✅ READY FOR MAIN
