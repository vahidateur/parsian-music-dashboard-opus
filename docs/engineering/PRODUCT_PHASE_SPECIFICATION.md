# PRODUCT PHASE SPECIFICATION — M0 … M11

**Status:** ✅ the phase *spec* required by [PHASES.md](PHASES.md) → "Product-feature phase" and
[PROJECT_STATE.md](PROJECT_STATE.md) §9. **Implementation has not started.** Only M0 (this
document, the decision register and the ledger entry) is documentation work; every milestone
from M1 onward still needs its own explicit authorization. *(Written at M0 and kept as written:
M1, M2, M2.1, **M3**, **M4**, **M5** and **M6** have since landed — M3 complete and accepted with
recorded limitations, M4, M5 and M6 complete on the same terms — and **M7 onward has not started** —
the live status of every milestone is in [PHASES.md](PHASES.md) → "Product-feature phase", not here.)*

**Base commit:** `f1fe114` (short form on purpose — see "No self-referential SHAs" in
[PROJECT_STATE.md](PROJECT_STATE.md) §2). **Authored:** 2026-09-09.

**What this document is.** The reconciliation of the product requirements against the repository
as it actually is, turned into an ordered, testable milestone plan with a decision register. It
adds no new requirements and cancels none.

**What this document is not.** It does not replace [OPEN_ITEMS.md](OPEN_ITEMS.md) (the backlog of
record, with the evidence), [DECISIONS.md](DECISIONS.md) (the durable architecture record — the
D1–D16 register is *recorded* there, at §19 — this document summarises it below as the D1–D12
table M0 wrote, with D13–D16 referenced by the milestone sections that decided them), or
[PROJECT_STATE.md](PROJECT_STATE.md) (the recovery document). Where they disagree, **they win**
and this file is corrected.

---

## 1. How to read this

Each milestone carries the same eight fields, so a session can pick one up cold:

**Scope** → **Dependencies** → **Protected areas** → **Demo/API behaviour** → **Tests** →
**Acceptance** → **Out of scope** → **Checkpoint & rollback**.

Every claim is written as `path:line` evidence that can be re-grepped. Line numbers were correct
in the working tree of `f1fe114` on 2026-09-09 and may drift — the same rule
[OPEN_ITEMS.md](OPEN_ITEMS.md) states at its head applies here: **re-grep before editing.**

---

## 2. State verified while writing this (not inherited, not assumed)

| Check | Observed |
|---|---|
| Working branch | `arena/01a07c61-parsian-music-dashboard-opus` |
| Remote branch | `f1fe114` — confirmed with `git ls-remote origin refs/heads/<branch>` |
| Working tree content | the `f1fe114` content: 93 test files, `docs/engineering/` (4 documents), `src/components/lifecycle/`, `src/domains/library/`, `src/domains/demo/lifecycle.ts` all present |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output) |
| `npm test` | **9 failed / 1 298 passed / 8 skipped (1 315)** — see below |
| `dist/` | absent (gitignored build artifact) → the 8 `cspCompatibility` tests skip, exactly as [PROJECT_STATE.md](PROJECT_STATE.md) §4 documents |
| `node_modules/` | absent after the workspace re-clone; restored with `npm ci` (never `npm install`) before any check was run |

**About those 9 failures — they are environmental, not product defects.** All nine are in
`src/__tests__/projectState.test.ts`, inside the single `describe` block *"the recorded
checkpoints are real Git objects"*. They assert `isCommit(sha)` / `isAncestor(sha, HEAD)` for the
checkpoint SHAs the documents quote (`aca40c5`, `33b1031`, `68b4fe3`, `77b019e`) — and in this
workspace the local branch pointer sits on the shallow graft `292b8b8`, so those objects are not
present locally even though the remote branch tip is `f1fe114`. *(That was a property of **that**
checkout, not of the repository: the clone in use at M5's documentation pass was **full** —
`git rev-parse --is-shallow-repository` printed `false`, 50 commits reachable back to the initial
commit, and pre-baseline history present, which is how **L6**'s "since M1" claim could be checked
against `git log` rather than against memory. Measure it; do not inherit either answer.)* This is the failure mode already
recorded as [OPEN_ITEMS.md](OPEN_ITEMS.md) **L5** and in [PROJECT_STATE.md](PROJECT_STATE.md) §2.
No assertion was weakened, skipped or edited to accommodate it; the recovery contract in §2 of
that document is the fix, and it is a Git operation this pass was not authorized to perform.

**Consequence for every milestone below:** a green baseline is a *precondition*, and until the
local pointer matches the remote the suite's honest shape is
`(N − 9) failed-environmental / … / 8 skipped`. Report the shape, never a bare number.

---

## 3. Requirements reconciliation

Status vocabulary: **A** fully implemented · **B** domain + UI incomplete · **C** partial ·
**D** fixture-fake · **E** backend-only · **F** deferred by decision · **G** new decision
required.

| # | Requirement | Status | Evidence | Milestone |
|---|---|---|---|---|
| 1 | Messaging / Chat | **B** | real send/read/create at `src/views/Messages.tsx`; the "zero UI callers" gap this row recorded is **closed by M6** — `updateConversation`/`archiveConversation` (`src/domains/chat/repository.ts:16-17`), `mediaId` (`src/domains/chat/types.ts:79`) and an export read through the existing reads are all wired and tested (see "M6 update" below). Still **B**, not A: chat resolves to Demo in both modes (`src/domains/registry.ts:147`) and no chat API repository exists | M6 ✅ **complete**; the server half stays with M11 **(D8)** |
| 2 | Renaming / persistence | **B** | CRUD dialogs write through repositories and persist — **M6 added the chat conversation surface** (rename / topic / pin / archive, persisted through the repository, with archived threads hidden by default and restorable); branding is still the exception (row 11) | M6 ✅ **complete**; **M8** remains (branding) |
| 3 | Student profiles | **C** | live list/CRUD + national-ID masking; relations still read fixtures (`src/views/Students.tsx`) | M7 |
| 4 | Teacher profiles | **C** | same shape (`src/views/Teachers.tsx`) | M7 |
| 5 | Instruments | **A** | `src/domains/instruments/` incl. the read-through `catalog.ts`; only the *type provenance* is fixture-bound | M10 |
| 6 | Learning levels / placement | **B** | `src/domains/learning/`, `src/domains/progress/`; placement + eligibility already surfaced in `StudentLearningPanel.tsx` | M3 |
| 7 | Learning content ↔ level assignment | **B — UI only** | `LevelContentLink` (`src/domains/learning/types.ts:183`), `listLinks`/`attachContent`/`detachContent` (`src/domains/learning/repository.ts:56-58`), demo impl + `CONTENT_ALREADY_LINKED` (`src/domains/learning/demoRepository.ts:238,246`). **Only tests call them** | **M3** |
| 8 | Login / visual identity | **C** | login itself is real (throttle, gates, generated access path); the *identity* is fixture (`src/components/layout/Sidebar.tsx:94-95`, `src/views/Login.tsx:135,153` ← `src/data/academy.ts:126`) | M8 |
| 9 | Teacher workspace | **G** | [OPEN_ITEMS.md](OPEN_ITEMS.md) I4 — authorization scope is a backend concern | **deferred** |
| 10 | Student workspace / student role | **G** | I5; no `student` in `ROLES`; *"FRONTEND RBAC IS UX ONLY"* (`src/domains/auth/permissions.ts`) | **deferred (D1)** |
| 11 | Branding / Settings | **B** | `BrandingSettings` complete (`src/domains/branding/types.ts:22-40`), panel writes and persists — but `applyBranding` (`src/domains/branding/useBranding.ts:65`) has **only test callers** (`src/domains/branding/__tests__/branding.test.ts:105,113`) and `--brand-*` has **zero consumers** | M8 |
| 12 | Audio player | **A** | `useMediaObjectUrl` + real bytes in IndexedDB; CSP `media-src 'self' blob:` | — |
| 13 | Gallery | **A** | real upload path in `GalleryPanel.tsx`; `galleryImages` seeded empty *by design* (a seeded row would point at missing bytes) | M11 (disclosure only) |
| 14 | Performance | **C** | 13 static view imports in `src/App.tsx`, zero `lazy`/`Suspense`; no budget in `vite.config.ts`; **every size figure must be re-measured — `dist/` is absent** | M11 |
| 15 | Clean code / security / a11y / docs | security **A** · a11y **C** · docs **B** | CSP + OWASP + privacy posture are gated; a11y has **no automated assertion** and no axe dependency; five documents carry recorded drift | M10, M11 |
| 16 | Scheduling | domain **A** / view **A** — *advanced at M4's landing (2026-09-14), which is the precondition this row itself named: it was **D** at `7e72887761f07f48e115160611a9785bfaae9060` and must not be read as **A** at any commit before CP1* | domain surface at `src/domains/scheduling/repository.ts:60-103`, **unchanged by M4** (no file under `src/domains/scheduling/` differs across the milestone except its README). The view no longer imports `src/data/records.ts` or `src/data/academy.ts`: rows are `Session` values from `useSessions` over a bounded window (`src/views/Scheduling.tsx:311`, ceilings at `:116` and `:117`, counts from `total` at `:458`), labels come from the classes/rooms/teachers domains, dates go through `dateBridge`, and the three operations are awaited repository calls — `rescheduleSession` and `cancelSession` in `src/views/scheduling/SessionWriteDialogs.tsx`, `generateSessions` (planned through `useGenerationPreview`) in `src/views/scheduling/GenerateSessionsDialog.tsx` — `rescheduleSession` conflict-previewed through `useConflictCheck`, which the cancel dialog does not need because a cancellation is not a move. The frozen weekday and the fabricated room/occupancy/free-slot narrative went with the fixtures. **What the A does not cover, stated so the grade is not read as more than it is:** five verbs have no shipped caller (`get`, `create`, `update`, `delete`, `sessionRoster` — by row 1's convention unconsumed surface is what holds a requirement at **B**), there is no create/edit/delete UI and no rendered roster, no recurrence-scoped write, and browser QA is NOT VERIFIED. Evidence: [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M4 validation" | ✅ **M4** — CP1 `0f875a7`, CP2 `f8c3472`, CP3 `6f54caf`, coverage `df70148` |
| 17 | Attendance | domain **A** / view **A** — *advanced at M5's landing (2026-09-14), which is the precondition this row itself named: it was **D** at `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` and must not be read as **A** at any commit before `9505ade4011b37a34e3488fd51206512829205ec`* | domain surface at `src/domains/attendance/repository.ts:40-80`, roster derived (`src/domains/attendance/types.ts:186-189`), **unchanged by M5** (no file under `src/domains/` differs across `24caf3a..9505ade`); the view no longer keeps rosters in local React state — it derives its selected session from the window it read and renders the register `useSessionAttendance` returns | **M5** ✅ |
| 18 | Finance / Reports | **D + E** | four README stubs only (`src/domains/finance/README.md`, `src/domains/reports/README.md`, `src/domains/messaging/README.md`, `src/domains/notifications/README.md`); reports must be *"authoritative server-side results, not client-side math"* | **deferred (D6)**; fake actions disabled in M2 |
| 19 | Recovery / lifecycle UX | domain **A** / UX **C** | `uninitializeEnvironment` (`src/domains/demo/lifecycle.ts:265`) + `demoDataManager.uninitialize` (`src/domains/demo/demoDataManager.ts:124-125`) exist with **zero UI callers**; `src/domains/demo/useDemoData.ts:29` wires only `reset｜clear｜import-seed｜restore-backup` | **M1** |
| 20 | Backend readiness | **E / C** | 9 domains have an `apiRepository.ts` (attendance, classes, enrollments, library, progress, rooms, scheduling, students, teachers) but only **7 registry getters** switch on `isApiMode()` (`src/domains/registry.ts:95-127`); **10 getters** return Demo in *both* modes (`:141,144,147,150,163,166,169,172,198,209`) | M11 (D8) |

**Newly recorded drift (found while writing this, 2026-09-09).**
`docs/architecture/data-layer.md:265,268` says *"Six domains were added"* and *"These six resolve
to Demo in BOTH modes"* — the registry resolves **ten** (`library`, `progress`, `scheduling` and
`attendance` also do, at `src/domains/registry.ts:163,172,198,209`). Four of those ten already
have an `apiRepository.ts` that nothing selects. Add this to the drift table in
[OPEN_ITEMS.md](OPEN_ITEMS.md) when that table is next edited (M10).

---

## 4. Milestone order and why

```
M0  spec + decision register + ledger  ← documentation checkpoint, no product behaviour
M1  Recovery & lifecycle UX (H5)       ← the only item that can cost a customer their data
M2  Honest write feedback (H2 + H3)    ← the panel stops claiming writes it did not make
M3  Learning content assignment (I3)   ← UI over a complete, tested contract; proves the pattern
M4  Scheduling view wiring (H1a)       ← Group A domain frozen, view rewritten
M5  Attendance view wiring (H1b)       ← Group D domain frozen; needs M4's real session ids
M6  Contracts without UI (chat, attachments, export coverage)   ✅ landed 4e03b87
M7  Relation de-fixturing + sidebar badges (I1)
M8  Branding application & visual identity (needs D2)
M9  Dashboard insight from live data (H4) — I9 guards land FIRST
M10 Fixture / type / seed separation (D5) + documentation drift + L2/L3
M11 Performance (I6) + api-hybrid indicator (D8) + a11y (D7) + browser QA + release gate
```

**Why this order and not the backlog's order.**

1. **Risk that grows with time goes first.** Every milestone after M1 increases the amount of
   real data a customer holds, and `clear()` is already a one-way door (H5). M1 is small,
   UX-only, and sits on an implemented, tested domain operation.
2. **M2 before M3** so that no new surface is built on top of a panel that still lies about
   writes; DECISIONS.md §15 lists the current violations explicitly.
3. **M3 before M4/M5** deliberately: it is the cheapest possible proof of the "UI over an
   existing contract" pattern (no schema change is even permitted), so the two high-risk view
   rewrites are attempted *after* the pattern, its tests and the team's confidence exist.
4. **M4 before M5** because attendance rosters are derived from real sessions; wiring attendance
   first would mean wiring it to fixture session ids twice.
5. **M10 late, not early.** `src/data/records.ts` and `src/data/academy.ts` have **three** roles —
   entity *types* (`src/data/records.ts:134`, re-imported by `src/domains/students/types.ts:13`,
   `src/domains/teachers/types.ts:12`, `src/domains/classes/types.ts:12`), the *canonical DEMO
   seed* (`src/domains/demo/seed.ts:10-23` derives the showcase dataset from them), and *fake data
   for unwired views*. **51 non-test modules import them.** M4–M9 remove the third role
   progressively, so by M10 the separation is a mechanical move guarded by tests instead of a
   51-file rewrite.
6. **M11 last.** Its largest win — fixtures out of the bundle — is a *consequence* of M7/M10, and
   splitting routes before the views are rewritten is rework. Its budget cannot exist before its
   measurement (§11 below).

---

## 5. Milestones

### M0 — Specification, decision register, ledger *(this document)*

- **Scope.** Write `docs/engineering/PRODUCT_PHASE_SPECIFICATION.md`; record **D1–D9** in
  [DECISIONS.md](DECISIONS.md) §19; record the product-phase entry and its milestone order in
  [PHASES.md](PHASES.md); re-run the §4 validation commands and report the observed shape.
- **Dependencies.** None — root of the graph.
- **Protected areas.** `src/__tests__/projectState.test.ts` must stay green on its own terms: the
  ledger row `Product-feature phase | — | — | ❌ NOT STARTED` is gated
  (`src/__tests__/projectState.test.ts:434`), every relative link must resolve, every backticked
  `src/`/`docs/` path must exist, no 40-hex SHA may be quoted unless it is a real commit reachable
  from HEAD, and no credential-shaped string may appear.
- **Demo/API behaviour.** Unchanged — no product code.
- **Tests.** `npm run typecheck`, `npm test`, `git diff --check`. The gate's failure set must be
  **identical before and after** this pass (see §2): documentation work may not add a red test.
- **Acceptance.** The three documents exist and agree; D1–D9 each carry the four house fields
  (**Decision → Why → Enforced by → Status**); the phase is still recorded as NOT STARTED because
  a documentation checkpoint is not a phase ([PHASES.md](PHASES.md) → "Two kinds of checkpoint").
- **Out of scope.** Any product source. Any Git operation. Registering a new documentation
  checkpoint SHA in the ledger (a document cannot quote the commit that carries it, and this
  workspace cannot currently resolve `f1fe114` as an object — recorded as a follow-up, not done).
- **Checkpoint & rollback.** **Documentation checkpoint**, one commit, pushed promptly
  ([PROJECT_STATE.md](PROJECT_STATE.md) §2: an unpushed commit is provisional). Rollback boundary:
  `f1fe114`.

### M1 — Recovery & lifecycle UX (**H5**)

- **Scope.** Give the product a way back from an environment `clear()` has made unusable, and make
  `clear()`'s warning tell the truth. The domain operation already exists and is tested:
  `uninitializeEnvironment(request, store)` at `src/domains/demo/lifecycle.ts:265` is
  confirm-gated (refuses without `{ confirm: true }`), removes **dataset + lifecycle marker +
  stored binaries**, and returns `UninitializeResult { ok, state: "uninitialized", changed,
  message }` (`:244-249`); a blob-store failure is appended to `message`, never swallowed. On
  `state === "uninitialized"` the gate already re-renders the chooser
  (`src/components/lifecycle/DataLifecycleGate.tsx:36`). What is missing is only the seam and the
  surface: `src/domains/demo/useDemoData.ts:29` wires `reset｜clear｜import-seed｜restore-backup`
  and nothing calls `demoDataManager.uninitialize` (`src/domains/demo/demoDataManager.ts:124-125`).
  The `clear` label at `src/domains/demo/useDemoData.ts:51-54` (*«همهٔ رکوردهای این محیط حذف
  می‌شوند و محیط بدون رکورد باقی می‌ماند.»*) omits the two facts that matter: the access account
  is deleted too, and there is no way back.
- **Dependencies.** **D3** (placement) and **D4** (`clear()` vs the zero-record invariant) recorded
  first — H5's own done-when requires the decision in
  [DECISIONS.md](DECISIONS.md) §8 and §18 *before* the code.
- **Protected areas.** DECISIONS.md **§8** and [OPEN_ITEMS.md](OPEN_ITEMS.md) **I10**: the
  bootstrap administrator lives at the *lifecycle* layer (`createEmptyEnvironment()`), so `clear()`
  may **not** simply re-add one; `src/domains/demo/__tests__/seed.test.ts` pins every collection at
  zero. DECISIONS.md **§18**: nothing may render above a gate it depends on — the affordance
  belongs at or below `DataLifecycleGate` (AccessGate → ConfigGate → DataLifecycleGate →
  AuthProvider), never above it. `src/views/__tests__/loginEmptyEnvironment.test.tsx` (8 gates) and
  `src/views/__tests__/loginDemoIsolation.test.tsx` (5) stay green **unchanged**.
- **Demo/API behaviour.** Rendered in `empty` and `demo` only. In **api** mode the gate is
  transparent (`src/components/lifecycle/DataLifecycleGate.tsx:25`), so no local recovery
  affordance may appear — there is no local environment to recover.
- **Tests.** Extend `src/domains/demo/__tests__/dataLifecycle.test.ts` and
  `src/components/lifecycle/__tests__/DataLifecycleGate.test.tsx`; add the lockout→way-back pair
  H5 demands. Every render helper waits for the **data-derived** state (the `role="status"`
  in-flight marker), never for a title — the rule
  [OPEN_ITEMS.md](OPEN_ITEMS.md) **I11** established.
- **Acceptance.** H5's done-when, verbatim: an explicit *"start over / choose the environment
  again"* affordance exists **outside the signed-in shell** (on the login screen or in the gate
  itself) and calls `uninitialize`, **with tests covering both the lockout and the way back out**;
  the confirmation shows the record counts from `manager.stats()`; `UninitializeResult.message` is
  surfaced verbatim including any blob-failure clause.
- **Out of scope.** Changing what `clear()` does. Re-adding a bootstrap account. Touching
  `src/domains/demo/seed.ts`, `migrateDataset()`, or the backup envelope (**I8**). Any view wiring.
- **Checkpoint & rollback.** **Phase checkpoint**; one commit; rollback boundary = M0's pushed SHA.

### M2 — Honest write feedback (**H2**, seven sites + **H3**, five mislabels)

- **Scope.** Every success toast becomes the result of an awaited repository call, or the control
  stops claiming success. The seven sites are enumerated in §6 below. Alongside them, **H3**: five
  toasts describe a *real* write as demo storage — `src/views/Students.tsx:630`,
  `src/views/Students.tsx:757`, `src/views/Teachers.tsx:367`, `src/views/Classes.tsx:281`,
  `src/domains/branding/BrandingPanel.tsx:115` — so a customer's own EMPTY data is announced as
  demo. Their copy must come from `useIsDemoEnvironment()` via
  `src/domains/demo/useDataLifecycle.ts`; the pattern already landed in
  `src/components/settings/DemoDataPanel.tsx`.
- **Dependencies.** M1 (independently shippable). Sites 1, 2, 3 and 7 only reach their *real*
  operation in M4/M5 — in M2 they must at minimum stop asserting a write that did not happen.
- **Protected areas.** DECISIONS.md **§15** (which currently records these exact violations as
  outstanding) and §10's *"no fake success toast"*; `src/__tests__/architectureBoundaries.test.ts`
  (views never import the store). H2's **do-not-fix list** is part of the scope boundary:
  `src/views/Classes.tsx:118` (archive, with a real `catch` → `tone: "danger"` at `:121`),
  `:279`, `:291`, `src/views/Students.tsx:136,628,755`, `src/views/Teachers.tsx:126,365`,
  `src/views/Messages.tsx:131,190`, every honest `tone: "info"` "requires a server" toast
  (`src/views/Attendance.tsx:51`, `src/views/Finance.tsx:170`, `src/views/Library.tsx:334`,
  `src/views/Messages.tsx:172,313`, `src/views/Reports.tsx:43`, `src/views/Students.tsx:677`,
  `src/views/Teachers.tsx:321`, `src/components/layout/TopBar.tsx:91`,
  `src/components/overlays/ActionSheet.tsx:94`), and `src/views/DesignSystemView.tsx:178` (the
  design-system showcase, not a product surface).
- **Demo/API behaviour.** Identical in both — these are copy and control-flow fixes, not
  data-source changes.
- **Tests.** H2's done-when requires *"a test asserts that no success notification can fire without
  a write"*; H3's requires `src/views/__tests__/emptyEnvironment.test.tsx` to assert the word
  «دمو» cannot appear after a real write in EMPTY.
- **Acceptance.** All seven sites converted or honestly disabled with a reason; all five H3 labels
  environment-derived; nothing on the do-not-fix list altered.
- **Out of scope.** Building a notifications or messaging provider (**I7**, and the
  `src/domains/notifications/README.md` stub) — the *«مدرس و هنرجو مطلع شدند»* half of site 1 can
  only be *removed*, not implemented, in this phase.
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = M1's SHA.

### M3 — Learning content assignment UI (**I3**) — UI only

> **Status (2026-09-13): ✅ COMPLETE — authorized by the owner, implemented at
> `e5b0a57d8f33dc04838670a2cd4158a88dd34022`, accepted through a formal audit of this section, and
> completed at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`, all pushed to the working branch.** Scope,
> prohibition, protected areas, Demo/API behaviour, tests and out-of-scope below are unchanged and
> were honoured as written. The audit answered every clause below PASS / PARTIAL / FAIL / NOT
> VERIFIABLE against file-and-line evidence and found one product defect (**F1**: the catalogue read
> discarded `error`, so a failed read rendered as «منبعی برای اتصال باقی نمانده» — fixed, with a
> regression case and a reversion check, and now **D12** of
> [DECISIONS.md](DECISIONS.md)), one contradiction with the rollback field below (**F2**) and one
> shortfall against the Tests clause (**F3**); both documentation findings are annotated on the
> fields they concern. **I3 is closed with it.** What completion does *not* claim: **browser QA has
> never run and is NOT VERIFIED** (§5 of [PROJECT_STATE.md](PROJECT_STATE.md)), and four limitations
> are recorded rather than absorbed — the unguarded detach half (**I13**, open), `per_page: 200`
> ceilings (**I16**), fourteen other consumers that discard `error` (**I15**) and link order being
> invisible to the operator (**I17**), all in [OPEN_ITEMS.md](OPEN_ITEMS.md). What landed, the
> measured validation and the mutation checks are recorded in [PHASES.md](PHASES.md) → "Product phase
> — M3" and [PROJECT_STATE.md](PROJECT_STATE.md) §3–§4. This note, the two field annotations below and
> the correction of one stale sentence are the only edits M3 made to this section; **no future
> milestone's status was touched, and M4 had not started when this note was written** — it has since
> landed, and its own record is the "LANDED" field at the end of the M4 section below.

- **Scope.** An assignment surface — I3 names it: *"in Settings → Programs & levels (or the
  learning workspace)"* — that writes through the contract which already exists and is already
  tested: `LevelContentLink` (`src/domains/learning/types.ts:183`), `listLinks` / `attachContent` /
  `detachContent` (`src/domains/learning/repository.ts:56-58`), the demo implementation including
  link ordering and the `CONTENT_ALREADY_LINKED` conflict
  (`src/domains/learning/demoRepository.ts:238,246`), persisted in the `levelContent` collection.
  Today **only tests call them**.
- **Prohibition (I3, verbatim).** *"This is a UI and workflow gap, **not a schema redesign**."* No
  new field, no model change, no edit to the learning domain.
- **Dependencies.** None from the contract, which is complete — but **one recorded gate, decided
  2026-09-13**. I11's `LearningPanel` flake was named as a precondition of this milestone and was
  **discharged before it** — reproduced, root-caused and fixed in the test harness; see
  [OPEN_ITEMS.md](OPEN_ITEMS.md) I11. What that triage found underneath was **I13**, and the owner
  has now decided it rather than leaving it open: **I13 Checkpoint 1 (A′) is a gate on this
  milestone** — the shared list hook derives what it exposes from the query identity its state
  answers, and the six dynamic-params consumers that ignored `loading` render an in-flight state
  instead of a false empty. **That gate is now discharged:** Checkpoint 1 landed as `289e080` with the
  full evidence set §10.1 of [PROJECT_STATE.md](PROJECT_STATE.md) requires — 6 consecutive
  full-suite runs (100 files / 1384 passed / 0 failed / 0 skipped each, `dist/` built so nothing
  skipped), 4 samples as two concurrent full suites, build, typecheck, documentation gates — plus a
  reversion check on each half, so neither the hook fix nor the consumer gates rest on a test that
  would pass without them. **M3 is therefore no longer held by I13 Checkpoint 1**; it *was* NOT STARTED
  when that gate was discharged and awaited the owner's authorization — which was given, and M3 has
  since landed as `e5b0a57d8f33dc04838670a2cd4158a88dd34022` (see the status note above). Two parts were **deliberately excluded** from that
  authorization
  and stay open: **Checkpoint 2**, an intent guard on `attachContent` — which this milestone's surface
  writes through, and which took only `(levelId, contentId)`, so unlike `assignPlacement` it had
  nothing to compare a level against. The owner **authorized it on 2026-09-13 as its own pass**, it
  was recorded as in progress before its code was written, and it **has now landed and been
  validated at `bcea26c`**: `attachContent` requires an `AttachContentIntent { programId }` resolved
  independently of the target level and refuses a mismatch with `LINK_INVALID`, writing nothing. It
  could not be done inside M3, whose prohibition below forbids editing the learning domain — which is
  exactly why it is its own pass, ahead of this milestone rather than inside it. **Consequence for
  M3's code:** the assignment surface must pass the program it resolved *itself* — the selected
  program from its own query — and must never pass `level.programId` read back off the row it is
  writing to, which would make the guard a tautology. **Checkpoint 3A has also landed** (`57c1dfb`):
  `useDerived`, behind `useStudentPlacement` and `useEligibleContent`, now exposes only the student it
  was asked about, so this milestone may render a student-scoped derived read — a placement preview,
  or which students a piece of content reaches — without one student's data appearing under another's
  name. And the **rest of Checkpoint 3**, three hand-rolled
  readers with the same shape, none reachable in shipped UI today, not authorized and not started —
  the fourth, scheduling's `useDerivedRead`, has since been fixed as **Checkpoint 3B**
  (`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`), ahead of M4 rather than inside it, because M4 is
  what makes its three readers reachable — which M4 has now done for two of them
  (`useGenerationPreview`, `useConflictCheck`), leaving `useSessionRoster` for M5. *(**Correction,
  2026-09-14:** M5 landed and did **not** consume `useSessionRoster` — it reads the attendance
  domain's own derived register through `useSessionAttendance`, so that scheduling verb now belongs to
  no milestone; and `useSessionAttendance`, one of the three readers named here as unreachable, is now
  reachable in shipped UI **and still unfixed**, guarded at the view boundary rather than at the hook.
  See [OPEN_ITEMS.md](OPEN_ITEMS.md) **I13**.)* Consequence for M3's own code: a
  write whose target comes from a rendered row must pair it with a parent id from an **independent**
  query, as `StudentLearningPanel` already does — two values from the same stale row cannot
  contradict each other, so a guard built on them proves nothing.
- **Protected areas.** `src/domains/learning/__tests__/demoRepository.test.ts`,
  `LearningPanel.test.tsx`, `StudentLearningPanel.test.tsx`; DECISIONS.md §10 domain boundaries.
  *Recorded for honesty, 2026-09-13:* **I13 Checkpoint 2** — a separate authorized pass, not M3
  work — did modify `demoRepository.test.ts`, because making `attachContent`'s intent argument
  required leaves a two-argument call uncompilable. The change there is mechanical and nothing else:
  11 call sites gained the program each test had already resolved its level from (a literal, never
  `level.programId`), **no assertion was added, weakened or removed**, and all 24 tests pass. The
  protection above stands unchanged **against M3**: this milestone must not touch those three files,
  and its own new tests belong in new files.
- **Demo/API behaviour.** Learning resolves to Demo in **both** modes
  (`src/domains/registry.ts:144`) — the surface must not imply a server; D8's indicator covers it.
- **Tests.** Assignment persists across a reload; the `CONTENT_ALREADY_LINKED` conflict surfaces as
  an honest refusal; detach removes the link; EMPTY renders «داده‌ای نیست», never a fixture; the
  previously flaky `LearningPanel` cases pass on repeated runs — six consecutive full-suite runs,
  the count §10.1 requires of a file that has ever flaked.
  *Recorded for honesty, 2026-09-13 (**F3**):* the milestone's first record claimed **three**
  consecutive full runs, below this clause, and that claim was being quoted as the milestone's
  evidence. Six-run evidence now exists at two checkpoints — at `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed`
  (104 files / 1423 passed / 0 failed / 0 skipped, `LearningPanel.test.tsx` 11/11 every run) and at
  `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad` (104 / **1424** / 0 / 0, 11/11 every run; `1423 + 1` is
  the F1 regression case). The authoritative table is [PROJECT_STATE.md](PROJECT_STATE.md) §4 →
  "M3 completion validation"; the three-run row is kept there, labelled superseded, and must not be
  quoted.
- **Acceptance.** I3's done-when: *"an assignment surface exists …, writes through that existing
  contract, and is covered by a test."*
- **Out of scope.** Any change to `Piece` / `LearningContent` / placement / eligibility models;
  recommendations logic; progress grants (§12 append-only).
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = M2's SHA.
  *Recorded for honesty, 2026-09-13 (**F2**):* this field is correct as written — M2's SHA is
  `c42f274ac10d4087f9280e3bf7b47141d0672e32` — and it is the ledger that contradicted it, by naming
  M3's *own* checkpoint as the boundary. The ledger now records **both** numbers, because one of them
  is wrong in a way the field cannot express: between M2 and M3 sit five separately authorized and
  accepted commits — M2.1 `73b40d9` and the three I13 checkpoints `289e080`, `bcea26c`, `57c1dfb`
  with their documentation checkpoints — which **must survive any M3 rollback**, so the effective safe
  base for abandoning M3 alone is `85530b40c66db63b10769537c2dc6cb24609842d`. Rolling back to M2's
  SHA would destroy them. See [PHASES.md](PHASES.md) → "Product phase — M3" → "Rollback". No history
  was rewritten, reset or rebased.

### M4 — Scheduling **view** wiring (**H1a**) — domain frozen

- **Scope.** Rewrite `src/views/Scheduling.tsx` onto `useScheduling` and the repository surface at
  `src/domains/scheduling/repository.ts:60-103` (`list`, `get`, `create`, `update`,
  `cancelSession`, `rescheduleSession`, `delete`, `previewGeneration`, `generateSessions`,
  `checkConflicts`, `sessionRoster`). Remove the fixture imports at `src/views/Scheduling.tsx:5`
  (`TODAY_INDEX, WEEKDAYS, classById, rooms, teacherById, teachers, weekSessions, GridSession`) and
  the frozen-weekday logic at `:43,78,123,152,199-201,221,227` (re-grepped at
  `7e72887761f07f48e115160611a9785bfaae9060`; the `:115,136,193` this row first quoted drifted when
  M2 inserted its explanatory comments), driving the grid from the domain's ISO-`date`
  `Session` through the Jalali `dateBridge` and from `useAcademyNow` (already imported at `:4`).
  **Sites 1 and 2 were retired by M2, not left for this milestone:** M2 *removed* both «انتقال به
  اتاق ۴» controls and the local `resolved` flag whose only effect was hiding the warning
  (`c42f274ac10d4087f9280e3bf7b47141d0672e32`) — it wired nothing, because no view write existed to
  wire. What M4 adds is the **real operation** those controls falsely claimed: `rescheduleSession`
  guarded by `checkConflicts`. M4 also makes site 7's real generation
  (`previewGeneration` / `generateSessions`) implementable, which is what `Classes.tsx`'s
  «بررسی در برنامه‌ریزی» button has pointed at since M2.
- **Dependencies.** M2 (copy), M3 (pattern proven).
- **Protected areas — Group A** ([PROJECT_STATE.md](PROJECT_STATE.md) §6):
  `src/domains/scheduling/__tests__/conflicts.test.ts`, `generation.test.ts`, `dateBridge.test.ts`,
  `demoRepository.test.ts`, `registry.test.ts`, `useScheduling.test.tsx`; DECISIONS.md **§11**
  (CLASS vs RECURRENCE vs SESSION — sessions are materialized) and **§16** (no regression). **Only
  the view changes; the domain model is not touched.**
- **Demo/API behaviour.** `src/domains/scheduling/apiRepository.ts` exists but the getter returns
  Demo in both modes (`src/domains/registry.ts:197`), with the attendance-presence composition at
  `:223`. Wiring the view must not change that selection; D8 makes it visible. **No M4 copy may
  imply server persistence:** the write really happens and really persists *locally*, in Demo, in
  both modes — `apiRepository.ts` is deliberately unregistered because no server implements it.
- **Tests.** H1's done-when: the view reads exclusively through `useScheduling`, the fixture
  imports are gone, `src/__tests__/architectureBoundaries.test.ts` still passes, **and a new suite
  asserts that fixture records do not appear when the repository returns something else** (the
  `Students.test.tsx` pattern). Conflict refusals must surface, never be swallowed.
  **Two landed gates name this view as fixture-driven, and M4 must reconcile them rather than trip
  over them:** `src/__tests__/writeFeedbackHonesty.test.ts` lists `views/Scheduling.tsx` in
  `FIXTURE_DRIVEN_VIEWS`, whose case asserts the file "report[s] no success at all", and
  `src/views/__tests__/noSuccessWithoutWrite.test.tsx` has a `describe("scheduling conflicts")` block
  that asserts the hardcoded conflict narrative and drives the drawer from the `weekSessions` fixture.
  Neither file is Group A, and neither rule may be weakened: a file leaves the "cannot write" list only
  into "can write, and is asserted to write before it reports success" — never into no list at all.
- **Acceptance.** A real reschedule resolves a real conflict; generation preview shows what will be
  created before it is created; EMPTY shows «داده‌ای نیست»; Group A green and unweakened.
- **Out of scope.** Any change to the conflict engine, generation rules, the date bridge, or the
  `Session` model. Notifications to teacher/student (deferred). **Restated at
  `7e72887761f07f48e115160611a9785bfaae9060`, because "the domain is frozen" has to name the
  files:** M4 redesigns **none** of the scheduling repository, the `Session` model, the conflict
  engine (`conflicts.ts`), the generation engine (`generation.ts`), `dateBridge.ts`,
  `src/domains/registry.ts`, anything in the attendance domain, or `useScheduling.ts` itself — the
  hooks M4 consumes are already written, key-carrying (I13 Checkpoint 3B) and `Paged`-typed (C2), so
  the view needs no new one. M4 also leaves `Room.occupancy` and `AcademyClass.attendanceAvg`
  semantics alone (neither is maintained by any code, so neither may be rendered as a measurement —
  [OPEN_ITEMS.md](OPEN_ITEMS.md) **H4** for fabricated content presented as measurement, **I16** for
  the pagination ceiling), keeps the legacy `sessions`
  (`GridSession`) and `attendance` fixture collections in the dataset because `Classes.tsx` and
  `Attendance.tsx` still read them (their removal is **M10 / D5**, not M4), and adds no dependency.
- **Checkpoint & rollback.** Phase checkpoint; Group A green is the gate for keeping it. **Two
  rollback boundaries, because one number would be wrong** — the same correction M3's own **F2**
  recorded:
  - **M3 formal completion boundary:** `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`, which is what
    this field said when it read "rollback boundary = M3's SHA".
  - **Effective safe M4 rollback boundary:**
    `7e72887761f07f48e115160611a9785bfaae9060` — the commit M4 is actually built on. Rolling back to
    M3's completion would destroy two separately authorized, separately reviewed and pushed
    pre-M4 remediation commits: **C1 / I13 Checkpoint 3B**
    (`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`) and **C2 / the `Paged` page-size guarantee**
    (`7e72887761f07f48e115160611a9785bfaae9060` itself). **Those must survive any M4 rollback**, so
    to abandon M4 and nothing else, return to `7e72887`; obeying the literal "M3's SHA" would revert
    accepted work, which is not what the field is for.

- **LANDED (2026-09-14) — what this milestone actually did, field by field.** This record answers the
  fields above against the tree; it does not restate or redefine them. Checkpoints: **CP0**
  `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` (documents only, before any product source moved), **CP1**
  `0f875a78c99077e25b67b9cc9cffe34c823ee511` (reads), **CP2** `f8c3472895978054c8dc81574bb8a945ef3c326d`
  (writes), **CP3** `6f54caf46dc13baca78e376c606a4aa9667cdb48` (generation), **B1+B2**
  `df701488362cb90cf32ccefad277879477571cf7` (acceptance coverage, two test files, 402/13). All pushed.
  - **Scope — met.** `src/views/Scheduling.tsx` reads through `useSessions` and writes through the
    repository; the fixture imports and the frozen-weekday logic are gone; the grid is driven from the
    domain's ISO `date` through `dateBridge` and from `useAcademyNow`. Sites 1 and 2's *real operation*
    now exists (`rescheduleSession` guarded by `checkConflicts`), and site 7's real generation is
    implemented and reachable. **One deviation, recorded rather than smoothed over:** the acceptance
    clause "EMPTY shows «داده‌ای نیست»" is met in substance with the domain's own copy —
    «جلسه‌ای در این بازه نیست», plus a description that names the window and says whether filters are
    active (`src/views/Scheduling.tsx:671`) — not with that literal sentence, and it is asserted by
    `src/views/__tests__/Scheduling.test.tsx`.
  - **Dependencies — both present.** M2's copy rules (no claim without an awaited write; remove a
    control that has no truthful action) and M3's pattern (a surface over a complete contract, deriving
    what it acts on) are what CP2 and CP3 follow.
  - **Protected areas — respected, and measured.** `git diff --name-only 7e72887..df70148` lists no
    file in `src/domains/scheduling/__tests__/`: the six **Group A** files are untouched and green at
    **211** tests, `useDerivedRead.test.tsx` (9, not Group A) is untouched, and the only path under
    `src/domains/` that changed is `src/domains/scheduling/README.md`. **§11's decision is unchanged** —
    only its *status* sentence, which claimed the view still renders fixtures, was corrected. §16's
    no-regression principle holds: no domain file, no model, no engine, no dependency.
  - **Demo/API behaviour — unchanged and unclaimed.** `src/domains/registry.ts:197` still returns the
    demo implementation in both modes, and no copy added by this milestone implies server persistence;
    the view says outright that the class-scheduling form is not connected to a server and saves
    nothing, and generation is described as a real domain write over a date window rather than as a
    server operation. **D8's api-mode indicator still does not exist** (M11).
  - **Tests — H1's done-when met for the scheduling half.** The view reads exclusively through
    `useScheduling`, the fixture imports are gone,
    `src/__tests__/architectureBoundaries.test.ts` passes with three *more* `PAGE_SIZE_CALLERS` than
    before, and `src/views/__tests__/schedulingNoFixtures.test.ts` (14 cases) asserts fixture records do
    not appear when the repository returns something else. Conflict refusals surface in the
    repository's own words and are never swallowed
    (`src/views/__tests__/schedulingWrites.test.tsx`). The two gates that named this view as
    fixture-driven were reconciled in the strengthening direction, exactly as this field required:
    `writeFeedbackHonesty.test.ts` moved it into a `GRADUATED_VIEWS` ratchet asserted both ways, and
    `noSuccessWithoutWrite.test.tsx` was re-driven from the repository (8 cases → 11).
  - **Acceptance — met, with the copy deviation above.** "A real reschedule resolves a real conflict"
    is asserted by name: `describe("a real reschedule resolving a real conflict")` refuses the contested
    slot at both gates without mutating, then resolves the clash with a write the repository performed
    (added by the B1/B2 coverage checkpoint). "Generation preview shows what will be created before it
    is created" is asserted by `src/views/__tests__/schedulingGeneration.test.tsx` (15 cases), including
    the re-plan on a window change, the no-op second run, the explicit `confirmUpdates` gate and the
    reported-never-deleted orphan. Group A green and unweakened.
  - **Out of scope — nothing leaked in.** No change to the conflict engine, generation rules, date
    bridge or `Session` model; no notification; `Room.occupancy` and `AcademyClass.attendanceAvg`
    semantics untouched; the legacy `sessions`/`attendance` fixture collections still in the dataset
    because `src/views/Classes.tsx` and `src/views/Attendance.tsx` read them (**M10 / D5**); no
    dependency added. **Five repository verbs remain unconsumed** — `get` (the selection is derived from
    the loaded page, **D11**), `create` and `update` (they would offer a path around the guarded verbs,
    and `update` would let an operator mark a generated session `manual` out from under the engine's
    protections), `delete` (excluded by **E-2**: cancellation is this domain's destructive operation)
    and `sessionRoster` (**M5**'s attendance boundary) — each recorded in
    *(**Correction, 2026-09-14:** M5 landed and did **not** take `sessionRoster`; the attendance view
    derives its register from its own domain, so `sessionRoster` and the `useSessionRoster` hook behind
    it are unconsumed by any milestone. Five verbs remain unconsumed, and the count did not change.)*
    `src/domains/scheduling/README.md` §3 rather than left as an unexplained gap. *(**E-2** is the
    exclusion clause of M4's own authorization that keeps a hard delete out of the UI; the source
    comments citing it are `src/views/Scheduling.tsx:45` and
    `src/views/scheduling/GenerateSessionsDialog.tsx:35`.)*
  - **Checkpoint & rollback — as specified.** Both boundaries below are recorded in
    [PHASES.md](PHASES.md) → "Product phase — M4"; nothing was reset, rebased or amended to make the
    documents agree. **Not recorded, and not claimed:** no mutation or reversion check was performed for
    CP1–CP3, unlike M3's five, so this milestone's evidence is one full-suite run
    (110 files / 1502 tests / 0 failed / 0 skipped) plus typecheck, build and `git diff --check` — see
    [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M4 validation". **Browser QA: NOT VERIFIED.**

### M5 — Attendance **view** wiring (**H1b**) — domain frozen

- **Scope.** Replace the local `setRosters` state and the fixtures in `src/views/Attendance.tsx`
  with `useSessionAttendance` and the surface at `src/domains/attendance/repository.ts:40-80`
  (`record`, `bulkRecord`, `correct`, `listCorrections`, `sessionAttendance`,
  `sessionIdsWithAttendance`), where the roster is **derived from enrollments and never stored**
  (`SessionAttendance` / `RosterAttendance`, `src/domains/attendance/types.ts:180-189`). Closes
  site 3; decides site 4 (real `sendMessage` with an honest `MessageStatus`, or removal).
- **Dependencies.** **M4** — session ids must come from real sessions (**✅ met**: M4's CP1 put real
  `Session` ids in shipped UI, so M5 does not have to wire attendance to fixture ids first). Boundary rule already
  tested: scheduling never reads attendance storage.
- **Protected areas — Group D** (§6): `src/domains/attendance/__tests__/demoRepository.test.ts`,
  `roster.test.ts`, `useAttendance.test.tsx`; DECISIONS.md **§12** (attendance and progress are
  append-only; corrections require a reason).
- **Demo/API behaviour.** `apiRepository.ts` exists; the getter returns Demo in both modes
  (`src/domains/registry.ts:209`).
- **Tests.** Corrections stay append-only and reason-gated **in the UI**; a recorded roster survives
  a reload; the honest `tone: "info"` at `src/views/Attendance.tsx:51` («ثبت دائمی و اطلاع‌رسانی به
  مدرس به سرور نیاز دارد») is preserved, not "upgraded" into a claim.
- **Acceptance.** H1's done-when for this view; no fixture roster can appear when the repository
  returns something else.
- **Out of scope.** Guardian/student notification (**D1**, **I7**); any change to the correction
  model; attendance-derived balances (DECISIONS: *"never from session counters"*).
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = M4's SHA. **M4 landed as a chain, so
  that convention now needs the same two-number correction M3's F2 established:** the last commit of
  M4's chain is `df701488362cb90cf32ccefad277879477571cf7` (acceptance coverage), its last *product*
  commit is `6f54caf46dc13baca78e376c606a4aa9667cdb48` (CP3), and the effective safe boundary for M5 is
  whichever of them M5 is actually built on — recorded when M5 starts, not guessed now.
  **Recorded now that M5 has landed:** it was built on neither. M4's chain ended with a **final
  documentation reconciliation**, `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`, pushed after `df70148`,
  and that is the commit M5 sits on — so the spec's boundary and the effective safe one are the **same
  number** for this milestone, and rolling back to it drops exactly one product commit
  (`9505ade4011b37a34e3488fd51206512829205ec`) while keeping M4's coverage and its documents.
  Rolling back further, to CP3 or earlier, would destroy both — which is why the two-number rule
  exists. The phase-checkpoint row in [PROJECT_STATE.md](PROJECT_STATE.md) §2 nevertheless stays at
  Phase 2, for the ordering reason recorded there: a documentation checkpoint must descend from the
  phase checkpoint it is recorded against.

- **Status (2026-09-14): ✅ COMPLETE, accepted with recorded limitations.** One implementation
  checkpoint, `9505ade4011b37a34e3488fd51206512829205ec` · *feat(m5): wire attendance view* —
  **8 files, 3093 insertions / 324 deletions**, and `git diff --name-only 24caf3a..9505ade --
  src/domains/` prints **nothing**, so the frozen-domain clause is measured rather than promised:
  Group D's 79 tests, `useAttendance.ts`, `repository.ts`, `demoRepository.ts`, `apiRepository.ts`,
  `roster.ts`, `types.ts` and `src/domains/registry.ts` are byte-identical. Measured evidence in
  [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M5 validation" (112 files / 1558 tests / 0 failed / 0
  skipped; typecheck and build clean; Group A 211 and Group D 79 green; 52 documentation gates green;
  three mutation checks taken in a throwaway worktree). Milestone record in
  [PHASES.md](PHASES.md) → "Product phase — M5". **H1** and **I12** are closed; **I13** and **I16**
  are open with this view's mitigations recorded as mitigations.
- **Deviations from this section, recorded rather than presented as compliance.**
  1. **No CP0.** M4 documented itself before implementing; M5 did not, because the scope below was
     already accurate in the documents M4's final reconciliation left behind, so the reconciliation
     happened *after* the milestone. No claim was made in these documents before its evidence existed.
  2. **The Tests clause "a recorded roster survives a reload" is not tested.** The register is re-read
     after every write and the correction trail is read back from the repository, but no test unmounts
     and remounts the view or reopens the store, so persistence rests on the demo store's
     single-persistence-authority code path — the same honest gap M3's record states for its surface.
  3. **The Tests clause about the honest `tone: "info"` at `src/views/Attendance.tsx:51` was not
     carried out literally.** «ثبت دائمی و اطلاع‌رسانی به مدرس به سرور نیاز دارد» no longer appears: a
     real awaited write now persists locally, and the notification half of that sentence is stated
     where it belongs — the register panel and the correction dialog each say that no teacher, student
     or guardian is notified. The clause's *intent* is honoured and pinned (no success before a promise
     resolves; the retracted «همه حاضر ثبت شدند» forbidden; a bulk save reports a count of records that
     exist), and the deviation is recorded here and in [PHASES.md](PHASES.md) rather than smoothed over.
  4. **`sessionIdsWithAttendance` is in the Scope list above and has no shipped UI caller.** It is the
     cross-domain boundary, not a view read: scheduling reaches it through the registry's presence
     provider (`src/domains/registry.ts:223`) and its synchronous sibling. So is `get` — the register is
     derived and a correction targets a row already on screen (**D11**'s reasoning). Both reasons are
     in `src/domains/attendance/README.md` §3.
  5. **No acceptance audit ran**, so this milestone has no audit findings and no **B**-numbered
     coverage items, unlike M3 and M4. The three mutation checks are the implementer's own measurement.
  6. **Site 4 was decided as removal**, the second of the two options this section offered — see the H2
     update above. No `MessageStatus` was introduced and no `sendMessage` call added.

### M6 — Contracts without UI (chat management, attachments, export coverage) — ✅ COMPLETE

- **Scope.** `updateConversation` (rename / topic / pin) and `archiveConversation`
  (`src/domains/chat/repository.ts:16-17`) — **zero UI callers today**; the `ChatMessage.mediaId`
  attachment path (`src/domains/chat/types.ts:79`) reusing the proven media seam
  (`useMediaObjectUrl`, as in `src/views/Library.tsx:122`); export coverage beyond
  `ExportEntity = "students" | "teachers" | "classes" | "enrollments"`
  (`src/domains/export/exportService.ts:25`) **only** where a real repository read exists.
- **Dependencies.** M2 (toast honesty). Media and blob store untouched.
- **Protected areas.** `src/views/__tests__/messagesDatasetRegression.test.tsx`,
  `MessagesChat.test.tsx`, `src/domains/media/__tests__/media.test.ts`; DECISIONS.md **§13**
  (metadata in the dataset, bytes in IndexedDB, never a fabricated URL); the CSV/XLSX
  formula-injection escaping in `src/domains/export/spreadsheet.ts` for any new entity.
- **Demo/API behaviour.** Chat resolves to Demo in both modes (`src/domains/registry.ts:147`).
  Delivery honesty is already modelled — `MessageStatus = sent｜queued｜unavailable｜failed`, where
  `sent` means genuinely persisted **in-app only**. No Telegram/Bale (**I7** deferred).
- **Tests.** Rename/pin/archive round-trips and persists; an attachment whose bytes are missing
  renders the honest *unavailable* state; no new success toast without a write.
- **Acceptance.** Every chat capability either has a UI or is recorded in the docs as deliberately
  UI-less.
- **Out of scope.** Provider integration; a notifications domain; group moderation.
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = M5's SHA —
  `9505ade4011b37a34e3488fd51206512829205ec`, its single implementation checkpoint, recorded now that
  M5 has landed. *(Written at M0 and kept as written.)* **Recorded now that M6 has landed:** M6 was
  built on neither of the two numbers this bullet originally implied but on **M5's documentation
  reconciliation `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`**, which is therefore both the spec's
  boundary and the effective safe one — rolling back to it drops M6 entirely and keeps every document,
  test and view M5 left behind intact.

- **Status (2026-09-14): ✅ COMPLETE, accepted with recorded limitations.** Four implementation
  checkpoints, all pushed: **CP1** `43e7882f051b46abfa9f0530137cedfb3a541ce0` · *feat(m6): chat
  conversation lifecycle and message attachments (contract + domain)* (5 files, 525/7) — the contract
  only: `SendMessageInput.mediaId?: string`, the reversible `archived` patch on `updateConversation`
  with `archiveConversation` delegating to it, and a `mediaId` that must resolve **before** provider
  delivery and **before** any write; **CP2** `42c54f41ed3099cf65ac4ca035146958a1a51f76` ·
  *M6 · CP2 — conversation management UI + composer state safety* (5 files, 1217/39) — the UI for
  rename/topic/pin/archive, the archived filter and badge, an explicit hidden-selection panel, a
  conversation-keyed composer, and the failed-read honesty at `Messages.tsx`; **CP3**
  `563b8d85ee48614963cb3c182ac9b84239645c3d` · *feat(m6): wire chat attachments* (7 files, 1527/25) —
  the picker and its limits derived from the media contract, two awaited writes before one claim,
  duplicate-submit protection, asset release on a failed message write, honest missing-bytes
  rendering, and the gate widened to the whole Messages surface; **CP4**
  `4e03b8762bebcb87e46cf7044af5da99d709b4d2` · *feat(m6): add conversation export* (4 files, 1063/1) —
  a single-conversation transcript read through `getConversation` + `listMessages`, downloaded through
  the export domain's existing `downloadBlob` only after the read resolves, identity captured before
  the await. **17 files, 4321 insertions / 61 deletions** (`git diff --shortstat 9190da0..4e03b87`),
  **106 new tests** (31 domain, 75 view/gate), **14 mutation checks** reverted byte-identically, and
  `git diff --name-only 9190da0..4e03b87` outside `src/domains/chat/` and the Messages surface prints
  nothing. Measured evidence in [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M6 validation" (119 files /
  1655 passed / 8 skipped / 1 known environmental failure at `projectState.test.ts:299`; focused and
  gate sweep 278/278 across 21 files; typecheck and `git diff --check` clean). Milestone record in
  [PHASES.md](PHASES.md) → "Product phase — M6"; the domain's own contract is documented in
  [`src/domains/chat/README.md`](../../src/domains/chat/README.md).
- **Acceptance, restated against what actually shipped rather than the M0 wording alone.** The clause
  was *"every chat capability either has a UI or is recorded in the docs as deliberately UI-less"*. Two
  capabilities are **deliberately UI-less and recorded as such**: `archiveConversation`, which now
  shares one write path with the management dialog (**D14**), and the export itself, which gained **no
  verb** because the two existing reads already express it (**D14**) — in both cases the
  documentation states the reason, not just the absence.
- **Deviations from this section, recorded rather than presented as compliance.**
  1. **No CP0**, on M5's recorded precedent: the scope below was already accurate, so the milestone went
     straight to implementation and the reconciliation happened after its evidence existed.
  2. **The export is one entity, not a scope extension.** The M0 clause said "only where a real
     repository read exists"; the only chat-shaped read that exists is per-conversation
     (`getConversation` + `listMessages`), so the milestone shipped single-conversation text export and
     **did not** add a chat entity to `ExportEntity` or invent a bulk read. No CSV/XLSX path was
     touched, so the formula-injection guard named in *Protected areas* was never in play.
  3. **The Tests clause "a recorded roster"/"an attachment whose bytes are missing …" is met, but the
     milestone's own round-trip claim is not.** Attachment metadata persists; an attachment's **bytes**
     that are gone render the honest unavailable state and are pinned by test. No test unmounts and
     remounts the view, so "a thread survives a reload" rests on the demo store's single-persistence
     authority, the same gap M3 and M5 recorded for their surfaces.
  4. **Browser QA did not run and is NOT VERIFIED** — the file picker and the download are precisely
     what jsdom cannot exercise. The export suite stubs `URL.createObjectURL` (which jsdom does not
     implement) while still asserting the artifact's real bytes, and verifies anchor/download
     invocation at the seam, which is why the limitation is stated instead of being papered over by
     the jsdom result.
  5. **No acceptance audit ran**, so this milestone has no audit findings and no **B**-numbered coverage
     items, unlike M3 and M4. The mutation checks are the implementer's own measurement.
  6. **`archiveConversation` remains without a shipped caller by decision**, not by omission — see
     **D14**. Its behaviour is proven at the domain boundary (reversible, persisted, hidden by default
     and restorable) and its reachability is recorded as a deliberate gap rather than implied coverage.

### M7 — Relation de-fixturing + sidebar badges (**I1**)

- **Scope.** Remove fixture lookups from `src/views/Students.tsx`, `Teachers.tsx`, `Classes.tsx`,
  `Messages.tsx`, `Library.tsx`, `Settings.tsx` — relations read through their own domains
  (teachers, classes, enrollments, rooms, sessions). **I1:** `src/components/layout/Sidebar.tsx:120`
  renders `badge={n.badge}` from the static `navGroups` fixture, so counts appear in EMPTY where the
  true value is zero; badges must come from repositories and **disappear at zero**.
- **Dependencies.** M4/M5 (real sessions); the enrollments/rooms/teachers hooks already exist.
- **Protected areas.** `src/views/__tests__/studentProfileRegression.test.tsx`,
  `StudentCrud.test.tsx`, `StudentDetail.test.tsx`, `DomainCrud.test.tsx`; national-ID masking
  (`docs/architecture/students.md` §30, `src/domains/students/__tests__/nationalId.matrix.test.ts`);
  `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx`.
- **Demo/API behaviour.** These views consume the **seven mode-switched** getters
  (`src/domains/registry.ts:95-127`), so api mode genuinely changes their data source — and must
  never silently serve demo (§37 of `docs/architecture/data-layer.md`).
- **Tests.** A new boundary assertion: views do not import `src/data/records.ts` **for data**;
  badges are absent at zero; EMPTY renders «داده‌ای نیست» everywhere these relations appear.
- **Acceptance.** H1 closed for these views; I1 closed.
- **Out of scope.** The type/seed separation itself (**M10**) — this milestone removes *data*
  imports, not the modules.
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = **M6's effective safe boundary**,
  `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` — M6's last *product* commit is CP4 `4e03b87`, the
  milestone's documentation reconciliation follows it, and the commit M7 would be built on is therefore
  the one M6 was built on. Recorded at M6's landing rather than guessed, the same way M5's boundary was.

### M8 — Branding application & visual identity (**needs D2**)

- **Scope.** Call the seam that already exists and is already tested:
  `applyBranding(branding, document.documentElement)` / `useApplyBranding`
  (`src/domains/branding/useBranding.ts:65,79,82`) currently has **only test callers**
  (`src/domains/branding/__tests__/branding.test.ts:105,113`). Wire `--brand-primary` /
  `--brand-accent` / `--brand-text` / `--brand-font-fa` into the design-system tokens (**zero
  consumers today**), and replace the fixture identity in `src/components/layout/Sidebar.tsx:94-95`
  and `src/views/Login.tsx:135,153` (← `src/data/academy.ts:126`, «آکادمی موسیقی آوا») with
  `branding.academyName` / `tagline`, whose own doc comment says the name *"appears in the shell,
  login and exports"* (`src/domains/branding/types.ts:23-27`).
- **Dependencies.** **D2 recorded first** — `DEFAULT_BRANDING.academyName` is «آموزشگاه موسیقی
  پارسیان» (`src/domains/branding/types.ts:54`) and contradicts the fixture name on screen. M7
  (fixtures out of the shell).
- **Protected areas.** CSP: writes must stay in the CSSOM — `style-src 'self'` with
  `style-src-attr 'unsafe-inline'` as the *one* narrow exception
  (`deploy/nginx.conf:174-178`, `deploy/Caddyfile:40-42`); the existing injection guard
  (`isHexColor`; the test asserts `expression(evil)` yields `""`);
  `src/__tests__/cspCompatibility.test.ts`; logo/favicon are `MediaAsset.id`, **never data URLs**
  (§13).
- **Demo/API behaviour.** Branding resolves to Demo in both modes
  (`src/domains/registry.ts:166`).
- **Tests.** Name/colour/font verifiably applied in shell, login and exports; the injection guard
  still green; CSP suite green against a real build.
- **Acceptance.** The identity on screen is the identity the customer saved. **Visual confirmation
  is impossible in this environment** → recorded as NOT VERIFIED until browser QA (M11 / L4).
- **Out of scope.** A logo/favicon upload redesign; per-tenant theming; any change to the
  `BrandingSettings` model.
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = M7's SHA (the visual blast radius
  is the whole design system).

### M9 — Dashboard insight from live data (**H4**), **I9 guards first**

- **Scope, in this order.** **First I9:** `Sparkline` (`src/components/ds/primitives.tsx:184`,
  `Math.min(...data)` / `Math.max(...data)` → `±Infinity` on `[]`) and `BusinessIntelligence`
  (`src/components/panels/BusinessIntelligence.tsx:63`, `revenueSeries[n - 1]` / `[n - 2]` → throws)
  must guard empty input and render `NO_DATA` (`src/lib/format.ts:35`), each with a test that passes
  `[]`. I9 is *"unreachable today … it becomes reachable the moment H4 lands."* **Then H4:** derive
  every figure in `src/components/panels/Intelligence.tsx`, `BusinessIntelligence.tsx`,
  `Signals.tsx`, `AttentionAndFlow.tsx` from live repositories — `useAcademyMetrics` already does
  this for the hero metrics and `src/lib/stats.ts:32,46,58` provides `meanOf` / `ratioPct` /
  `topBy` — dropping the fixture imports (`signals`, `growthSeries`, `revenueSeries`, `occupancy`,
  `quickActions`, `todayFlowIds`).
- **Dependencies.** M4/M5/M7 (real numbers must exist to derive). **I9 strictly precedes H4.**
- **Protected areas.** DECISIONS.md **§14** (no-data is an explicit typed value, never `NaN`, never
  a consumer-side `|| []` patch), **§15** (no fabricated metric presented as measurement),
  `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx`.
- **Demo/API behaviour.** Unchanged.
- **Tests.** H4's done-when: *"a test renders the dashboard in EMPTY asserting no fabricated figure
  or sentence survives"*; each insight computed from loaded data and stating «داده‌ای نیست» when its
  input set is empty.
- **Acceptance.** No number on the dashboard exists that the stored records do not support.
- **Out of scope.** Any AI/ML claim — §15 keeps "academy intelligence" a UX pattern over display
  data; recommendations stay deterministic.
- **Checkpoint & rollback.** Phase checkpoint; rollback boundary = M8's SHA.

### M10 — Fixture / type / seed separation (**D5**) + documentation drift + hygiene

- **Scope.** Split the three roles of `src/data/records.ts` (822 lines) and `src/data/academy.ts`
  (539 lines): **types** move to their owning domains (`src/data/records.ts:134` defines `Student`,
  re-imported by `src/domains/students/types.ts:13`, `src/domains/teachers/types.ts:12`,
  `src/domains/classes/types.ts:12`); the **canonical DEMO seed** moves under `src/domains/demo/`
  (`src/domains/demo/seed.ts:10-23` derives the showcase dataset from these fixtures, and DEMO stays
  a first-class environment per DECISIONS.md §2); the **third role — fake data for unwired views —
  is deleted**, already unused after M4–M9. Then close the recorded documentation drift
  ([OPEN_ITEMS.md](OPEN_ITEMS.md) → DOCUMENTATION DRIFT): `docs/gap-matrix.md`,
  `docs/architecture/data-layer.md` (including the "six vs ten" finding in §3 above),
  `docs/production-handoff.md`, `docs/architecture/auth.md`, `docs/architecture/environments.md` —
  each *corrected or explicitly marked a historical snapshot with its date*. Plus **L2**
  (`TeacherNote`, declared at `src/data/records.ts:31`, never used) and **L3**
  (`src/domains/scheduling/README.md` and `src/domains/attendance/README.md` still say *"not
  implemented in Phase A"* while 290 tests protect them).
- **Dependencies.** M4–M9. **D5 recorded before execution.**
- **Protected areas.** `src/domains/demo/__tests__/seed.test.ts` (all collections zero, derived
  dataset), `src/services/__tests__/demoStoreMigration.test.ts` and `migrateDataset()`,
  `backup.test.ts`, `contracts.test.ts`, `dataIntegrity.test.ts`, `prototypePollution.test.ts`,
  `src/__tests__/projectState.test.ts`.
- **Demo/API behaviour.** DEMO must remain exactly as rich as before — it is a Showcase, not a
  stub. EMPTY must gain nothing.
- **Tests.** A new boundary test: **no view imports `src/data/records.ts` or `src/data/academy.ts`
  at all.** Every persistence and lifecycle suite green and **unweakened**.
- **Acceptance.** The fixture modules no longer exist as a place a view can read fake data from;
  every drift row closed in the documents themselves.
- **Out of scope.** Changing the seeded dataset's *content*; any domain model change; I8's
  versioned envelope.
- **Checkpoint & rollback.** Phase checkpoint (largest blast radius: 51 non-test importers) —
  mechanical, test-guarded, one commit; rollback boundary = M9's SHA.

### M11 — Performance (**I6**) + api-hybrid indicator (**D8**) + a11y (**D7**) + browser QA

- **Scope, and the mandated measurement methodology — the budget exists only *after* it.**
  ① `npm ci`; ② `npm run build` on the clean milestone tree (this also un-skips the eight
  `cspCompatibility` tests, whose `describe.skipIf(!hasBuild)` keys on `dist/index.html`);
  ③ record per-chunk **raw and gzip** sizes from `dist/assets/` plus total `dist/` size;
  ④ record the 13 static view imports in `src/App.tsx` (verified: 13 imports, zero `lazy`, zero
  `Suspense`); ⑤ record the imported `@fontsource/vazirmatn` weights — `src/index.css:2-7` imports
  300, 400, 500, 600, 700 and 800 — against the actual class census (`font-normal` 1,
  `font-medium` 103, `font-semibold` 81, `font-bold` 7 → **300 and 800 are unused**, so two
  `@import` lines are the lever, not a file deletion); ⑥ re-run
  `src/__tests__/cspCompatibility.test.ts`; ⑦ **only then** encode **D9**'s budget as a test.
  Splitting must keep hashed external assets — `vite.config.ts:43-70` explains that inlining would
  break `script-src 'self'` — use `LoadingState` as the Suspense fallback, and add a vendor chunk.
  **D8:** make the ten demo-in-both-modes domains visibly local. **D7:** dependency-free a11y
  assertions (role, label, focus, `prefers-reduced-motion`). **L4:** run the browser-QA checklist in
  [PROJECT_STATE.md](PROJECT_STATE.md) §5.
- **Dependencies.** all of M1–M10; **D7, D8, D9 recorded first**.
- **Protected areas.** `src/__tests__/cspCompatibility.test.ts`;
  `src/__tests__/routeProtection.test.tsx` and the EMPTY suites must *"still pass against lazily
  mounted views"* (I6); `src/__tests__/privacyPosture.test.ts`;
  `src/__tests__/architectureBoundaries.test.ts`; §10's no-new-dependencies rule (there is no axe
  dependency in `package.json` today).
- **Demo/API behaviour.** The indicator **is** the deliverable: api mode must not read as
  production-ready while ten getters return Demo (`src/domains/registry.ts:141-209`, and §37 of
  `docs/architecture/data-layer.md`). `connect-src 'self'` in both edge configs means an api
  deployment is same-origin, or the CSP changes by recorded decision.
- **Tests.** I6's done-when: the warning resolved *"by real splitting (not by raising the warning
  threshold), with a measured before/after"*; the budget assertion green; a11y assertions green.
- **Acceptance.** Measured numbers recorded in this file's successor row of
  [PHASES.md](PHASES.md); browser QA either performed and recorded, or left explicitly
  **NOT VERIFIED**.
- **Out of scope.** Any new dependency without authorization; any visual redesign; server-side
  caching or CDN work (backend).
- **Checkpoint & rollback.** **Final phase checkpoint** — the ledger row with the real SHA, marked
  pushed only after `git ls-remote` confirms it, and [PROJECT_STATE.md](PROJECT_STATE.md) §2/§3/§9
  updated in the same commit. Rollback boundary = M10's SHA.

---

## 6. The seven fake-success sites (H2) — complete, re-verified

| # | Site | Claim | What actually runs | Real operation | Closes in |
|---|---|---|---|---|---|
| 1 | `src/views/Scheduling.tsx:144` *(pre-M2 line ref; the control is gone)* | «تعارض برطرف شد · پیانو پیشرفته به اتاق ۴ منتقل شد · مدرس و هنرجو مطلع شدند» | `setResolved(true)` *(what ran before M2)* | `rescheduleSession(id, { roomId })` (`repository.ts:80`) + `checkConflicts` (`:96`); the "مطلع شدند" half is *notifications* → **deferred** | ✅ **CLOSED IN M2 BY REMOVAL** (`c42f274`) — the real operation arrived with **M4** ✅ |
| 2 | `src/views/Scheduling.tsx:327` *(pre-M2 line ref; the control is gone)* | «تعارض برطرف شد · کلاس به اتاق ۴ منتقل شد» | `setResolved(true); setSelected(null)` *(what ran before M2)* | same | ✅ **CLOSED IN M2 BY REMOVAL** (`c42f274`) — the real operation arrived with **M4** ✅ |
| 3 | `src/views/Attendance.tsx:46` | «همه حاضر ثبت شدند» (`markAllPresent`) | `setRosters(...)` local state | `bulkRecord` (`repository.ts:51`) | M5 |
| 4 | `src/views/Attendance.tsx:224` | «پیام پیگیری ارسال شد · … و ولی ایشان مطلع شدند» | `notify()` only | `chat.sendMessage` (provider `in_app`, honest `MessageStatus`) **or** removal | M2 / M5 |
| 5 | `src/views/Finance.tsx:98` | «یادآوری ارسال شد · پیامک برای …» | `notify()` only | **none** — the invoices are fixtures; disable with an honest reason | M2 |
| 6 | `src/views/Finance.tsx:285` | «یادآوری گروهی ارسال شد · N پیام در صف ارسال قرار گرفت» | `notify()` only | **none** | M2 |
| 7 | `src/views/Classes.tsx:234` | «پیشنهاد بازهٔ جدید ثبت شد · برای بررسی به برنامه‌ریزی ارسال شد» | `notify()` only | **none in this view** — the claim was removed at M2 and the button navigates; real generation now exists and is reachable **from the schedule view** (`previewGeneration` / `generateSessions` via `src/views/scheduling/GenerateSessionsDialog.tsx`) | ✅ M2 (claim removed) → **M4 landed** (capability real) |

These seven are exactly the list [OPEN_ITEMS.md](OPEN_ITEMS.md) H2 already records — this document
adds no site and removes none.

**Correction (2026-09-13), because the "Closes in" column read as a promise M2 had already kept
differently.** Sites **1** and **2** were closed in **M2** (`c42f274ac10d4087f9280e3bf7b47141d0672e32`)
**by removal**: both «انتقال به اتاق ۴» buttons and the local `resolved` flag whose only real effect
was hiding the warning are gone, the conflict evidence stays on screen until the data really changes,
and the drawer no longer closes on a claimed write. They were **not wired** — M2's rule was *"where a
truthful action exists, do it; where one does not, remove the control"*, and no scheduling write
existed in any view then. The notification half of site 1's claim («مدرس و هنرجو مطلع شدند») has no
capability behind it at all and stays **deferred**; it must never return, not even beside a real
write. What **M4** contributes is therefore *not* the closure of sites 1 and 2 — it is the first real
scheduling operation those controls used to fake (`rescheduleSession` guarded by `checkConflicts`),
plus the real generation that makes site 7's «پیشنهاد بازهٔ جدید» claim unnecessary rather than
honest. The honesty rule itself is unchanged and still enforced by
`src/__tests__/writeFeedbackHonesty.test.ts` and `src/views/__tests__/noSuccessWithoutWrite.test.tsx`;
rows 3–7 keep their original milestones.

**Update (2026-09-14), because M4 landed and changed what "arrives with M4" means.** The real
scheduling operation sites **1** and **2** faked now exists and is awaited before anything is claimed:
`rescheduleSession`, guarded by `checkConflicts` at both the dialog and the repository, and
`cancelSession` with its required reason, in `src/views/scheduling/SessionWriteDialogs.tsx` (CP2,
`f8c3472895978054c8dc81574bb8a945ef3c326d`). Site **7**'s capability is real too: generation runs
through `src/views/scheduling/GenerateSessionsDialog.tsx` (CP3,
`6f54caf46dc13baca78e376c606a4aa9667cdb48`), preview first and write only on confirmation, so the
«پیشنهاد بازهٔ جدید» claim stays unnecessary rather than becoming honest — and `src/views/Classes.tsx`'s
button still only navigates, which is the one truthful action available from that screen. **The
notification half of site 1's claim («مدرس و هنرجو مطلع شدند») is still deferred and still must never
return, not even beside a real write.** Rows **3**, **4**, **5** and **6** are untouched by M4: 3 and 4
remain **M5**'s, 5 and 6 were settled at M2.

**Update (2026-09-14, M5), because M5 landed and settled rows 3 and 4 in the two different ways this
table anticipated.** **Site 3 is CLOSED by a real write:** «همه حاضر ثبت شدند» no longer exists as a
claim about local state — the control is labelled with the count it will write, «همه حاضر (N)», is
**withdrawn** rather than disabled when there is nothing to write, no permission, or a locked session,
and its success sentence reports a count of records the repository really wrote, after an awaited
`bulkRecord` (`src/views/Attendance.tsx:349` → `src/domains/attendance/repository.ts:51`). The
retracted wording is pinned as a forbidden string by
`src/views/__tests__/attendanceNoFixtures.test.ts`, and the behaviour by
`src/views/__tests__/attendanceWrites.test.tsx` ("writes every unmarked student in one bulk act, and
nobody who is already marked", "leaves the repository unchanged when a bulk save is refused").
**Site 4 is settled by REMOVAL, and the removal is now explicit:** the «پیام پیگیری ارسال شد · … و ولی
ایشان مطلع شدند» control went at M2 and did **not** come back, because no `chat.sendMessage` call was
added — a guardian notification stays deferred under **D1** and **I7**, exactly as the notification half
of site 1's claim does. What M5 added is the *statement* of that absence: the register panel and the
correction dialog each say out loud that no teacher, student or guardian is notified, so the deferral
is visible to the operator rather than implied by a missing button. Rows **5** and **6** are unchanged
(M2), and **`src/views/Finance.tsx` and `src/views/Reports.tsx` are the only two views left on
`src/__tests__/writeFeedbackHonesty.test.ts`'s `FIXTURE_DRIVEN_VIEWS` list** — both **I2** and M9's,
because neither has a domain layer to be wired to.

---

## 7. D1–D12 decision register

Recorded with full rationale in [DECISIONS.md](DECISIONS.md) **§19**; summarised here so the
milestones can reference them. **This table is a summary and §19 is the authority:** D1–D9 are what
M0 recorded, and three entries have been added **to this table** since by work that landed — **D10**,
**D11** and **D12**, all decided by M3 and its acceptance audit. D3 and D4 were settled by M1's
landing, so their status here is the settled one rather than the pre-M1 "required before".
**Later decisions are recorded in §19 and deliberately not duplicated here:** **D13** (M5's
documentation reconciliation) and **D14–D16** (M6) are referenced by the milestone sections below and
carried with full rationale in §19 of [DECISIONS.md](DECISIONS.md); this M0-era table keeps the shape
it was written with, and the milestone sections are where a reader is pointed.

| ID | Decision | Status | Blocks |
|---|---|---|---|
| **D1** | Does a student (or guardian) get a role in this panel, or a separate app? | **DEFERRED** — resolved by product-owner instruction 2026-09-09; written entry owed | I5, I4 |
| **D2** | Branding as the source of truth for the academy name, and which name ships | **OPEN — required before M8** | M8 |
| **D3** | Where the recovery affordance lives (login screen vs the gate) | **DECIDED — M1-specific**, landed with M1 | M1 |
| **D4** | `clear()` semantics vs the zero-record invariant | **DECIDED — M1-specific**: `clear()` keeps its meaning, recovery is `uninitialize` | M1 |
| **D5** | Shape of the fixture / type / seed separation | **OPEN — known from M4, executed at M10** | M10 |
| **D6** | Finance / Reports domain creation in this phase | **DEFERRED** — resolved by instruction 2026-09-09 | I2 |
| **D7** | How accessibility is enforced (dependency-free vs authorized dev dependency) | **OPEN — required before M11** | M11 |
| **D8** | How the api-mode hybrid is disclosed to the operator | **OPEN — required before M11** | M11 |
| **D9** | Bundle budget | **OPEN — measurement first, budget second** | M11 |
| **D10** | A write target taken from a rendered row is paired with a parent resolved independently | **DECIDED — landed with M3** | M3 |
| **D11** | An assignment surface renders outside the list it assigns to, and derives its own selection | **DECIDED — landed with M3** | M3 |
| **D12** | A failed secondary read is reported as a failure, never as an empty list | **DECIDED — landed with M3's F1 fix** | M3 |

---

## 8. Protected domains and invariants binding every milestone

Restated from [PROJECT_STATE.md](PROJECT_STATE.md) §6 so no milestone can claim ignorance:
**Group A** scheduling (Session model, conflict engine, generation, Jalali date bridge) ·
**Group D** attendance (append-only corrections, derived roster) · library and real media bytes ·
student-profile and messages regressions · the persistence boundary (migration, backup/restore,
dataset integrity, prototype-pollution defence) · the lifecycle model · login in an EMPTY
environment (truthful labels **and** preserved bootstrap entry) · layering · privacy/exposure
posture · CSP compatibility · route protection and boot gates · and the documents themselves.

Standing invariants: reads never write; the lifecycle mode is a persisted fact, never inferred from
a row count; demo-only material never reaches EMPTY; missing bytes produce an honest *unavailable*
state, never a fabricated URL; no-data is a typed `NO_DATA`, never `NaN` and never a consumer-side
`|| []` patch; **no fake success UX**.

---

## 9. Deferred — explicitly not in this phase

**I5 / D1** student role and student workspace · **I4** teacher visual workspace (what a teacher
role may see is a backend authorization concern) · **I2 / D6** creating the `finance`, `reports`,
`messaging` and `notifications` domains — M2 only stops their controls from lying · **I7** official
Telegram / Bale provider integration (research plus backend; credentials backend-only, never in
React source, `VITE_*` or `localStorage`) · **I8** backup-envelope relabelling (a versioned format
change, not a copy fix) · **L1** command-palette tokenisation · **all backend work**
([OPEN_ITEMS.md](OPEN_ITEMS.md) → BACKEND) · **L4** browser QA, which stays a permanent gap until a
browser-capable environment performs it.

Deferral is recorded, never silent: [OPEN_ITEMS.md](OPEN_ITEMS.md) rule 3 — *"Never re-categorise an
item downward to make a phase look finished."*

---

## 10. Deterministic testing policy

1. **Only repeated runs may be reported as green.** A single green run proves nothing about a race
   ([OPEN_ITEMS.md](OPEN_ITEMS.md) I11). Minimum: three consecutive full-suite runs for any
   milestone claim; six for a file that has ever flaked.
2. **A render helper must wait for the data-derived state its callers assert on** — the design
   system's in-flight marker (`role="status"`, from `BreathingWave` in
   `src/components/ds/states.tsx`), queried **by role, not by its Persian label**, so a copy change
   cannot silently turn the wait into a no-op. Never a title, never a sleep, never a retry.
   **Correction (2026-09-12, from I11's triage):** the marker is sufficient for a refetch of the
   *same* query and **insufficient when the query's params change**. `useResourceList` set `loading`
   inside an effect, so the frame between a params change and that effect carried the previous
   query's rows with `loading === false` and no marker at all — measured `role="status"` count 0.
   Where a list's params can change (a selected parent, a page, a filter), the helper must wait for
   the data-derived state itself: the rows on screen are the rows the repository holds for what the
   screen claims to be showing. The marker check stays, as necessary but not sufficient.
   **Since I13's Checkpoint 1 (2026-09-13, implemented and validated at `289e080`)** the hook upholds that
   invariant itself — state carries the query identity it answers and what is exposed is derived at
   render, so another query's page cannot be exposed at all, and a same-key refetch keeps its rows so
   a data-version bump cannot blank every list. Two rules survive the fix and must not be relaxed
   because of it: a test still waits on **data identity**, never on `loading === false` as its sole
   proof (that is the flag under test, so such a wait can be satisfied by the frame being asserted
   against); and a consumer must still render an **explicit in-flight state** rather than its empty
   state while a params change is being read, because withholding the old page would otherwise turn
   one lie into another. **I13's Checkpoint 2 has since landed** — `attachContent` now requires the
   caller's program intent and refuses a level that does not belong to it — **and Checkpoint 3A has
   landed too**: `useDerived`, behind the two student-scoped learning reads, carries its key and
   exposes only the student it was asked about. **Checkpoint 3B has landed since** (`fba826f`):
   scheduling's `useDerivedRead`, behind `useSessionRoster`, `useGenerationPreview` and
   `useConflictCheck`, carries its key too, so a session switch cannot expose the previous session's
   roster, plan or report — hardened *before* M4 made those readers reachable in shipped UI, which it
   has now done for two of the three (`useGenerationPreview` in
   `src/views/scheduling/GenerateSessionsDialog.tsx`, `useConflictCheck` in
   `src/views/scheduling/SessionWriteDialogs.tsx`); `useSessionRoster` is still unconsumed and is M5's.
   *(**Correction, 2026-09-14:** M5 landed and did not consume it — that verb now belongs to no
   milestone — and `useSessionAttendance` is reachable in shipped UI **and still unfixed**, guarded at
   the view boundary. See [OPEN_ITEMS.md](OPEN_ITEMS.md) **I13**.)*
   **The rest of Checkpoint 3 remains open** — three
   hand-rolled readers still have the pre-fix shape (`useStudentList`, `useStudentProgress`,
   `useSessionAttendance`), and since M5 one of them is behind a shipped view — which is why the
   data-derived wait stays the rule.
3. **No assertion is weakened, skipped or deleted to reach green.** Fix the owning boundary
   (§10 of [PROJECT_STATE.md](PROJECT_STATE.md)).
4. **Report the shape, not a bare number:** `N passed` or `(N − 8) passed + 8 skipped` depending on
   whether `dist/` exists, and — while the local pointer disagrees with the remote — the nine
   environmental `projectState` failures named in §2.
5. **I11's open flake — discharged before M3, not at it.**
   `src/domains/learning/__tests__/LearningPanel.test.tsx` was reproduced (1 failure in 4
   double-contention full-suite samples, after 31 focused runs stayed green), root-caused and fixed
   in the test harness on 2026-09-12; the recorded conclusion is in
   [OPEN_ITEMS.md](OPEN_ITEMS.md) I11. Two corrections to this clause as originally written: the
   failure was **not** an artefact of running two suites on one machine — the state it exposed occurs
   on every run — and it did not land on the named *"reorders levels"* case, which passed in the
   failing run; all of the file's cases shared the two helpers. The product behaviour underneath is
   **I13** and **I14**, both open and neither fixed by that pass.
6. **New suites assert absence, not just presence:** the `Students.test.tsx` pattern — fixture
   records must *not* appear when the repository returns something else.

---

## 11. Performance measurement methodology (before any budget)

No number in this document is a performance target, because `dist/` does not exist in this
workspace and every prior figure is a stale measurement — I6 itself dates its own (*"≈ 844 kB at
`33b1031`"*). The order is fixed: **measure → record → then budget.**

1. `npm ci` on a clean tree at the milestone's base commit.
2. `npm run build`; capture the emitter's own chunk-size warning verbatim.
3. Record per file in `dist/assets/`: raw bytes and gzip bytes; record total `dist/` size.
4. Record the structural facts that a size alone hides: number of static view imports in
   `src/App.tsx` (13 today), presence of `lazy`/`Suspense` (none today), `manualChunks`
   configuration (none today), and the `@fontsource/vazirmatn` weights imported at
   `src/index.css:2-7` versus the weights the design system actually uses.
5. Re-run `src/__tests__/cspCompatibility.test.ts` against the real artifact.
6. **Only then** write D9's budget as a test assertion, and never satisfy it by raising
   `chunkSizeWarningLimit`.

---

## 12. Durable checkpoint and rollback strategy

- **One milestone = one logical commit**, pushed promptly; an unpushed commit is *provisional*,
  never a checkpoint ([PROJECT_STATE.md](PROJECT_STATE.md) §2, and **L5** which records this
  workspace being re-cloned between turns).
- **M0 is a documentation checkpoint, M1–M11 are phase checkpoints.** Only a phase checkpoint
  advances "Current phase" in §3 of that document.
- **No self-referential SHAs:** a ledger entry never carries the SHA of the commit that carries it;
  the newest documentation checkpoint listed is always the one *before* it.
- **Verify, do not trust:** `git ls-remote origin refs/heads/<branch>` before marking anything
  pushed (the clone's fetch refspec is limited to `main`, so `refs/remotes/origin/arena/…` can be
  missing even after a successful push); `git cat-file -e <sha>^{commit}` before relying on any
  recorded SHA.
- **Rollback boundary = the previous pushed milestone SHA.** Recovery is the non-destructive
  contract in §2 of that document: hash the changed and untracked files, `git reset --mixed
  <checkpoint>` (pointer and index only, never files), re-hash and compare. Never reset --hard,
  re-clone, stash, rebase, force-push or amend.
- **Ledger discipline:** the milestone's row goes into [PHASES.md](PHASES.md) with its real SHA, and
  [PROJECT_STATE.md](PROJECT_STATE.md) §2/§3/§9 are updated **in the same commit**; an item leaves
  [OPEN_ITEMS.md](OPEN_ITEMS.md) only by landing (SHA recorded) or by a written decision to drop it.

---

## 13. Definition of Done

### Per milestone
Each milestone's **Acceptance** field above is its DoD, and it is not met until: the acceptance
condition holds *and* its tests exist *and* the full suite is green in the shape §10.4 requires on
repeated runs *and* no protected area was weakened *and* the commit is pushed and ledgered per §12.

### Final Product Phase DoD
The phase is complete when **all** of the following are true and evidenced:

1. **No view reads fixture data.** `src/views/Scheduling.tsx`, `Attendance.tsx`, `Students.tsx`,
   `Teachers.tsx`, `Classes.tsx`, `Messages.tsx`, `Library.tsx`, `Settings.tsx` and the dashboard
   panels read through domain hooks only, enforced by a boundary test.
   **Scope of that gate, stated so M4 neither over- nor under-claimed it:** this is the *final phase*
   DoD, not M4's, and at `7e72887761f07f48e115160611a9785bfaae9060` it was **not met** —
   `src/views/Scheduling.tsx` still imported `src/data/records.ts`. What M4's own Acceptance
   required is narrower and was achievable in one milestone: **the scheduling view reads through the
   domain hooks and not through fixture data**, asserted by a suite following the
   `src/views/__tests__/Students.test.tsx` absence pattern. **That narrower gate is met** —
   `src/views/__tests__/schedulingNoFixtures.test.ts` is the suite, and the view imports neither
   fixture module. The structural no-fixture check M4 added is
   **M4-local** (one view); the product-wide fixture/type/seed separation and a boundary test covering
   every view remain **M10 / D5**, and `Attendance.tsx`, `Classes.tsx` and the dashboard panels still
   read fixtures after M4's landing — so **item 1 of this final-phase DoD is still not met**, now for
   those reasons rather than for the scheduling view's.
2. **EMPTY is honest everywhere:** «داده‌ای نیست» / `NO_DATA`, never a fabricated record, figure or
   sentence — asserted by rendering in EMPTY.
3. **Zero fake success.** Every `tone: "success"` follows an awaited repository call with an honest
   failure path, gated by a test.
4. **Zero mislabelled writes.** No customer's own data is called demo (H3).
5. **Recovery exists.** H5's done-when met: the way back out is reachable from outside the signed-in
   shell, with lockout and recovery both tested.
6. **Every domain capability has a UI or a recorded reason not to** (learning links, conversation
   management, attachments, export coverage, branding application).
7. **Identity is applied**, or D2 records why it is deferred — not left dangling.
8. **Fixtures separated** into types / DEMO seed / (deleted) view data, with DEMO unchanged in
   richness and EMPTY unchanged in emptiness.
9. **Documents reconciled:** the drift table closed or date-stamped; README stubs corrected; this
   file's milestone statuses updated; [OPEN_ITEMS.md](OPEN_ITEMS.md) reduced only by landing.
10. **Performance measured and budgeted** per §11, with splitting that keeps the CSP suite green.
11. **Accessibility asserted** by tests, per D7.
12. **api mode disclosed** per D8 — no silent demo behind an api claim.
13. **All protected suites green and unweakened**, including the documents' own gate.
14. **Browser QA performed and recorded, or explicitly NOT VERIFIED** — never implied.
15. **No new dependency** without authorization; `package-lock.json` untouched by anything other
    than an authorized change.

---

## 14. First implementation task (M1.1)

> **Expose `uninitialize` through the existing destructive-action seam, with truthful copy.**
>
> In `src/domains/demo/useDemoData.ts`: add `"uninitialize"` to `DestructiveAction` (line 29,
> currently `Extract<DemoOperation, "reset" | "clear" | "import-seed" | "restore-backup">`) and add
> its entry to `DESTRUCTIVE_LABELS` (lines 49-60), routed to the already-implemented
> `demoDataManager.uninitialize(request)` (`src/domains/demo/demoDataManager.ts:124-125` →
> `src/domains/demo/lifecycle.ts:265`) with `{ confirm: true }`. The label must state, in Persian:
> every record of **this environment** is removed **including the access account, so sign-in becomes
> impossible**; the **environment itself** is deleted — unlike `clear()`, which keeps it — and the
> first-run choice returns; stored media binaries are removed too; the action is **irreversible**;
> take a backup first. Render the record counts from `manager.stats()` in the confirmation. In the
> same commit, correct the `clear` warning (lines 51-54) to name the account deletion, the lockout,
> and the way back.
>
> **Covered by:** `src/domains/demo/__tests__/dataLifecycle.test.ts` (the action reaches the manager
> with `confirm: true`; the refusal path without it; a blob-store failure is propagated in
> `message`, not swallowed) and the `useDemoData` state tests.
>
> **Not in this task:** where the button lives (M1.2, needs **D3**), any change to what `clear()`
> does or to `createEmptyEnvironment()` (**D4**, DECISIONS.md §8, I10), `src/domains/demo/seed.ts`,
> `migrateDataset()`, the **I8** envelope, and any view wiring.
>
> **Precondition:** **D3** and **D4** recorded in [DECISIONS.md](DECISIONS.md) §8 and §18 — H5's
> done-when requires the decision *before* the code.

---

## 15. Rules for this document

1. It is amended only by a milestone landing, a decision being recorded, or a claim here being
   shown false — and the amendment says which.
2. Every status change must name the milestone and, once pushed, its SHA in
   [PHASES.md](PHASES.md).
3. Nothing in [OPEN_ITEMS.md](OPEN_ITEMS.md) may be reported as finished from here; this file plans
   work, it does not complete it.
4. If a line number quoted here no longer matches, fix the reference — do not delete the evidence.
