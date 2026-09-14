# PHASES — chronological ledger

One row of truth per phase. Facts below are derived from `git show --stat <sha>`, the
existing `docs/` tree and the test suite — not from recollection. Where something could not
be derived, it is marked **not recorded** rather than guessed.

> ⚠️ **Two different phase-numbering systems exist in this repository.** This ledger uses the
> session phases (Baseline → Phase 1 → Phase 2 → product phase). `docs/gap-matrix.md` uses an
> older *product* numbering (Phase 0 audit, Phase 1 auth, Phase 2 backend, Phase 3 students …)
> and is **stale** — it still lists implemented domains as NOT IMPLEMENTED. Do not conflate
> them; see [OPEN_ITEMS.md](OPEN_ITEMS.md) → documentation drift.

| Phase | Durable SHA | Pushed? | Status |
|---|---|---|---|
| Baseline (inherited repository) | `292b8b86ce7dd328b3a1510047f994e39c443a4e` | yes (the graft boundary of a **shallow** checkout — see the note below, and measure your own clone) | superseded |
| Phase 1 — library, media, profile/messages regression | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` | ✅ yes | **COMPLETE** |
| Phase 2 — explicit data lifecycle + empty-state audit | `33b10311f0d3a38745b4d0c00f22e4f63665888d` | ✅ yes | **COMPLETE** |
| Product-feature phase — M0 (spec + decision register) | `f2ebc09822d03dde8ce06307221e303721ed9c2e` | ✅ yes | **COMPLETE** (documents only) |
| Product-feature phase — M1 (recovery & lifecycle UX) | `689a7c15951d690b1ce650a5938e6b1216ca30ed` | ✅ yes | **COMPLETE** |
| Product-feature phase — M2 (honest write feedback) | `c42f274ac10d4087f9280e3bf7b47141d0672e32` | ✅ yes | **COMPLETE** |
| Product-feature phase — M2.1 (edit-form draft integrity + the three Settings panels) — *not in the M0 spec; the two items M2 recorded, inserted here by the owner's decision* | `73b40d970816f174b56d37addc21f106a472359b` | ✅ yes | **COMPLETE** |
| Product-feature phase — M3 (learning-content assignment UI) | `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad` | ✅ yes (pushed) | ✅ **COMPLETE** — implemented `e5b0a57d8f33dc04838670a2cd4158a88dd34022`, accepted by audit, closed by `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`; limitations recorded, browser QA NOT VERIFIED |
| Product-feature phase — M4 (scheduling **view** wiring) | `df701488362cb90cf32ccefad277879477571cf7` | ✅ yes (pushed) | ✅ **COMPLETE** — CP0 `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` (documents only), implemented at `0f875a78c99077e25b67b9cc9cffe34c823ee511` (CP1 reads), `f8c3472895978054c8dc81574bb8a945ef3c326d` (CP2 writes) and `6f54caf46dc13baca78e376c606a4aa9667cdb48` (CP3 generation), acceptance coverage at `df701488362cb90cf32ccefad277879477571cf7`; **H1a closed**, limitations recorded, browser QA NOT VERIFIED |
| Product-feature phase — M5 (attendance **view** wiring) | `9505ade4011b37a34e3488fd51206512829205ec` | ✅ yes (pushed) | ✅ **COMPLETE** — one implementation checkpoint, built directly on M4's final documentation reconciliation `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`; **H1b** closed and with it the umbrella **H1**, **I12** closed, **no file under `src/domains/` changed at all**; its documentation reconciliation follows as its own commit |
| Product-feature phase — M6 (contracts without UI: chat management, attachments, export coverage) | `4e03b8762bebcb87e46cf7044af5da99d709b4d2` | ✅ yes (pushed) | ✅ **COMPLETE** — four implementation checkpoints built on M5's documentation reconciliation `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`: CP1 `43e7882f051b46abfa9f0530137cedfb3a541ce0` (the chat contract), CP2 `42c54f41ed3099cf65ac4ca035146958a1a51f76` (conversation management + composer state safety), CP3 `563b8d85ee48614963cb3c182ac9b84239645c3d` (attachments) and CP4 `4e03b8762bebcb87e46cf7044af5da99d709b4d2` (conversation export) — **106 new tests**, 17 files, `+4321/−61`, no file outside the chat domain and the Messages surface, **no dependency**; limitations recorded (ownership/authorization backend-required, browser-local bytes, metadata-only single-conversation export with a disclosed ceiling), browser QA NOT VERIFIED; its documentation reconciliation follows as its own commit |
| Product-feature phase | — | — | M3, M4, M5 and M6 ✅ **COMPLETE** (rows above); remaining milestones M7–M11 ❌ **NOT STARTED** |

Pushed commits that change **documents or validation gates only** are not phases and are listed
separately, at the end of this ledger → "Documentation checkpoints".

---

## Baseline — the inherited repository

**Commit:** `292b8b86ce7dd328b3a1510047f994e39c443a4e` · *chore(security): update vulnerable
build dependencies* · 2026-09-07 · author `vahidateur`.

**What it was.** The pre-existing Ava panel: a Vite + React 19 + TypeScript(strict) + Tailwind v4
single-page app, Persian/RTL, with a design system (`src/components/ds`), 13 views
(`src/views`), a demo persistence layer (`src/services/demoStore.ts`), a domain registry
(`src/domains/registry.ts`) with demo *and* API implementations for many domains, security
plumbing (`src/security`), and **eight documents under `docs/`** — five architecture documents
(`auth.md`, `data-layer.md`, `demo-data.md`, `environments.md`, `students.md`), a security
posture (`security.md`), a production hand-off checklist (`production-handoff.md`) and a gap
matrix (`gap-matrix.md`). Verified with `git ls-tree -r 292b8b8 docs/`, not counted by hand.

**Why it matters now.** In a **shallow** checkout it is the graft boundary, and history before it is
not present locally, so anything claimed about earlier work has to be verified on GitHub. **That is a
property of the checkout, not of the repository, and it must be measured rather than inherited:** the
clone in use at M5's documentation pass was **full** — `git rev-parse --is-shallow-repository` printed
`false`, `git rev-list --count HEAD` returned 50 commits back to the initial commit, and pre-baseline
history was present. That is what made **L6** checkable from Git instead of from memory:
`git log --oneline --reverse -- src/domains/attendance` starts at `2acca0a` · *feat(architecture):
Phase A — API client, error model, repository contracts and demo/API boundary*, which is **before**
this baseline and falsifies the "attendance has had a complete domain since M1" claim in
`src/views/Attendance.tsx`'s header comment.

**Gaps inherited (still open):** fixture-driven Scheduling / Attendance / Finance / Reports
views, fabricated dashboard insight text, static sidebar badges, no backend, no code-splitting,
no browser QA. All carried into [OPEN_ITEMS.md](OPEN_ITEMS.md).

---

## Phase 1 — real library media, honest profile messaging, protected regressions

**Commit:** `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` · *feat(library): fix profile messaging
and real library media* · 2026-09-08 09:11 UTC · **pushed** ✅
**Size (from `git show --stat`):** 30 files, 2 905 insertions, 120 deletions.

**Purpose.** Make the library and media paths real instead of decorative, and lock the
surfaces they touch with regression tests so later phases cannot quietly break them.

**Major deliverables.**
- **A complete `library` domain**, built to the Students pattern: `src/domains/library/types.ts`,
  `repository.ts`, `demoRepository.ts`, `apiRepository.ts`, `useLibrary.ts`, `demoContent.ts`,
  wired into `src/domains/registry.ts`.
- **Real media bytes, not fake URLs.** `src/domains/media/useMedia.ts` added; media metadata
  stays in the dataset while bytes live in IndexedDB; `src/lib/download.ts` no longer produces
  fabricated download URLs; a missing blob yields an honest "unavailable" state.
- **Demo library seed material** in `src/domains/demo/librarySeed.ts` — split out as a pure
  module so provisioning in `demoContent.ts` does not create an import cycle.
- **Dataset migration** in `src/services/demoStore.ts` (+104) with `migrateDataset()`, covered
  by `src/services/__tests__/demoStoreMigration.test.ts` (+200).
- **Rewritten Library view** (`src/views/Library.tsx`, +240) and gallery cleanup
  (`src/domains/gallery/useGallery.ts`, `GalleryPanel.tsx`).
- **Three new library test suites** — `demoRepository.test.ts` (+348), `useLibrary.test.tsx` (+342),
  `apiRepository.test.ts` (+145) — plus `src/views/__tests__/Library.test.tsx` (+347).
- **Two named regression suites**: `src/views/__tests__/studentProfileRegression.test.tsx` (+158)
  and `src/views/__tests__/messagesDatasetRegression.test.tsx` (+175).

  ⚠️ **Those `+N` figures are diff insertions** from `git show --stat aca40c5`, *not* file line
  counts, and the two are not interchangeable. Five of the files above are one line longer today
  because Phase 2 added the `resetToDemoEnvironment()` import to each;
  `apiRepository.test.ts` is unchanged because its Phase 2 edit was 2 insertions plus 2 deletions.
  When quoting a past commit, quote insertions as insertions.

**Validation.** Typecheck, suite and build were reported green at the time; the exact counts
are **not recorded in the repository**. What *is* verifiable today: the suites this phase added
are part of the current run, and the protected-domain regression run at Phase 2 (15 files /
166 tests) covers them and is green. `AudioMessagePlayer.tsx` predates this phase (present at
`292b8b8`).

**Remaining gaps.** The demo library file is a single seeded asset; Library is only as rich as
its seed. Learning content exists but has no level-assignment UI. All Phase 1 media guarantees
are client-side — server-side media storage, authz and virus scanning remain backend work.

---

## Phase 2 — explicit data lifecycle (UNINITIALIZED / EMPTY / DEMO) + empty-state audit

**Commit:** `33b10311f0d3a38745b4d0c00f22e4f63665888d` · *feat(lifecycle): make demo and empty
data environments explicit* · 2026-09-08 15:32 UTC · **pushed** ✅
**Size (from `git show --stat`):** 74 files, 2 653 insertions, 208 deletions
(= 902 lines across 62 tracked files + 1 751 lines in 12 new files).

**Purpose.** Stop the app from silently seeding demo data on read, make "whose data is this?"
an explicit persisted fact, make EMPTY a first-class environment a real customer can use, and
prove every surface renders honestly with zero records.

**Major deliverables.**
- **One lifecycle boundary**: `src/domains/demo/lifecycle.ts` (+ `src/domains/demo/useDataLifecycle.ts`
  as the only React-facing accessor). Marker key `ava:demo:lifecycle` in `src/services/demoStore.ts`.
- **First-run choice**: `src/components/lifecycle/DataLifecycleGate.tsx` mounted above
  `AuthProvider` in `src/App.tsx`, rendering `src/components/lifecycle/FirstRunChooser.tsx`
  with exactly two options (start empty / load demo). Nothing renders behind the gate while
  UNINITIALIZED.
- **No seeding on read.** `snapshot()` never writes; a corrupt or absent payload yields an
  in-memory empty dataset with zero writes and leaves stored bytes untouched.
- **EMPTY is usable**: `src/domains/demo/seed.ts` keeps all content collections at zero and the
  lifecycle layer adds exactly one bootstrap administrator so authentication can resolve.
- **Demo material isolation**: the demo library file (`res1` / `md_demo_res1`), `DemoNote` and
  demo labelling require `isDemoEnvironment()` (= demo data source **and** `demo` lifecycle
  state), never `isDemoMode()` alone.
- **Legacy adoption**: a dataset without a marker is adopted as DEMO once, preserving every
  record; Phase 1 `migrateDataset()` still runs on the same read path.
- **Empty-state computation layer**: new `src/lib/stats.ts` (`meanOf` / `ratioPct` / `topBy`
  returning explicit `null`), `NO_DATA = "—"` and nullable `faPercent` in `src/lib/format.ts`,
  and fixes in `src/views/Classes.tsx` (2 × `NaN` + 1 lying hint) and `src/views/Teachers.tsx` (1 × `NaN`).
- **Honest Settings panel**: `src/components/settings/DemoDataPanel.tsx` + `src/domains/demo/useDemoData.ts`
  no longer call a customer's data "demo", and dataset-installing buttons are hidden in EMPTY.
  No Settings lifecycle switch was added (explicitly out of scope).
- **Test harness**: `src/test/demoEnvironment.ts` (`resetToDemoEnvironment()`); 42 existing
  suites migrated to it because `reset()` no longer seeds.
- **78 new tests** in 6 files, including a full-shell walk of all 16 surfaces in EMPTY
  (`src/views/__tests__/emptyEnvironment.test.tsx`) and a panel-level audit
  (`src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx`).
- **Documentation**: `docs/architecture/demo-data.md` (121 → 315 lines), a "two independent
  axes" section in `docs/architecture/environments.md`, and a bootstrap-account section in
  `docs/architecture/auth.md`.

**Validation (measured at this checkpoint).** `npm run typecheck` clean · `npm test` 91 files /
1 255 passed / 0 failed · `npm run build` clean (~4.3 s, pre-existing >500 kB chunk warning) ·
`git diff --check` clean · Group A + Group D 314 tests green · protected domains 166 tests green.
**Browser QA: NOT VERIFIED** (no browser automation in this environment).

**Remaining gaps.** Backup envelope still labels everything "demo"; `clear()` still locks
everyone out; dashboard insights and sidebar badges are still fixtures; Scheduling / Attendance
views still do not use their real domains; Finance and Reports still have no domain layer. All
carried into [OPEN_ITEMS.md](OPEN_ITEMS.md).

---

## Product-feature phase — SPECIFIED (M0); M1, M2, M2.1, M3, M4, M5 and M6 LANDED; M7–M11 NOT STARTED

**Durable SHA:** none for M0 itself — it changes documents only, and a documentation checkpoint is
not a phase (see "Two kinds of checkpoint" below). **Pushed:** n/a. **Status:** spec ✅ landed ·
M1 ✅ landed `689a7c1` · M2 ✅ landed `c42f274` · M2.1 ✅ landed `73b40d9` · M3 ✅ **complete**
(implemented `e5b0a57`, closed `3bec881`) · two **pre-M4 remediation** commits landed and accepted
(**C1 / I13 Checkpoint 3B** `fba826f`, **C2 / the `Paged` page-size guarantee** `7e72887`, which is
also M4's effective safe rollback boundary) · **M4 ✅ complete** (CP0 `84fb7cb`, CP1 `0f875a7`, CP2
`f8c3472`, CP3 `6f54caf`, acceptance coverage `df70148` — see "Product phase — M4" below) ·
**M5 ✅ complete** (one implementation checkpoint `9505ade`, closed by its documentation
reconciliation `9190da0`) · **M6 ✅ complete** (CP1 `43e7882`, CP2 `42c54f4`, CP3 `563b8d8`, CP4
`4e03b87`, with this pass reconciling the record — see "Product phase — M6" below) ·
M7–M11 ❌ **not started, not authorized**.

**The authoritative spec is [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md).** It
replaces the informal "intended scope as discussed" that stood here before: every milestone carries
scope, dependencies, protected areas, Demo/API behaviour, tests, acceptance, out-of-scope and a
checkpoint boundary, with `file:line` evidence. The decisions that gate it are recorded in
[DECISIONS.md](DECISIONS.md) §19 as **D1–D16** (D10–D12 were added by M3's landing and its
acceptance audit, D13 by M5's documentation reconciliation, and **D14–D16 by M6's** — the reversible
archive, the attachment-as-reference boundary, and the export reading the existing contract instead of
gaining a verb).

**Milestone order (M0 … M11).**

| Milestone | Closes | Status |
|---|---|---|
| M0 — spec, decision register, ledger entry | the §9 precondition "its spec" | ✅ landed `f2ebc09` (documents only) |
| M1 — recovery & lifecycle UX | **H5** (critical: `clear()` is a one-way door) | ✅ landed `689a7c1` |
| M2 — honest write feedback | **H2** (seven fake-success sites) + **H3** (five mislabels) | ✅ landed `c42f274` |
| M2.1 — *inserted, not in the spec* | **H6** (edit dialogs opened on an empty draft) + **H7** (three Settings panels) — the two items M2 found and recorded | ✅ landed `73b40d9` |
| M3 — learning-content assignment UI | **I3** (UI over an existing, tested contract) | ✅ complete — implemented `e5b0a57d8f33dc04838670a2cd4158a88dd34022`, accepted by audit, closed `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`; **I3 closed**, limitations recorded (I13/I15/I16/I17), browser QA NOT VERIFIED |
| M4 — scheduling **view** wiring | **H1a** — Group A domain frozen | ✅ **complete** — CP0 `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` (documents only), CP1 `0f875a78c99077e25b67b9cc9cffe34c823ee511` (reads), CP2 `f8c3472895978054c8dc81574bb8a945ef3c326d` (writes), CP3 `6f54caf46dc13baca78e376c606a4aa9667cdb48` (generation), acceptance coverage `df701488362cb90cf32ccefad277879477571cf7`; **H1a closed** and **I3's pattern reused**, Group A untouched at 211, limitations recorded (H1 stays OPEN on H1b, I13, I16, five unconsumed verbs), browser QA NOT VERIFIED. The two pre-M4 remediation commits (**C1** `fba826f`, **C2** `7e72887`) landed ahead of it and are *not* M4 |
| M5 — attendance **view** wiring | **H1b** — Group D domain frozen | ✅ **complete** — one implementation checkpoint `9505ade4011b37a34e3488fd51206512829205ec`, built on M4's final reconciliation `24caf3a`; **H1b closed** and with it the umbrella **H1**, **I12 closed**, **no file under `src/domains/` changed at all**, 53 new view cases and three gates re-driven; reconciled by `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`; **I13** and **I16** stay OPEN with view-boundary mitigations only, browser QA NOT VERIFIED |
| M6 — contracts without UI | chat rename/pin/archive, attachments, export coverage | ✅ **complete** — CP1 `43e7882f051b46abfa9f0530137cedfb3a541ce0` (chat contract: `mediaId`, the reversible `archived` patch, resolution before delivery), CP2 `42c54f41ed3099cf65ac4ca035146958a1a51f76` (conversation management, conversation-keyed composer, failed-read honesty), CP3 `563b8d85ee48614963cb3c182ac9b84239645c3d` (attachments through the media seam) and CP4 `4e03b8762bebcb87e46cf7044af5da99d709b4d2` (single-conversation text export), built on `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`; **106 new tests** (+106 on the suite), 14 mutation checks, **no dependency and nothing outside the chat domain and the Messages surface**; **I15's `Messages.tsx` site fixed** while I15 stays OPEN, **I13** inherited by the attachment card without being reachable there; limitations recorded (backend-required ownership/authorization, browser-local bytes, metadata-only export with a 1 000-message ceiling), browser QA NOT VERIFIED |
| M7 — relation de-fixturing | fixture relations in the profile views + **I1** badges | ❌ not started |
| M8 — branding application | the identity that is saved becomes the identity rendered (needs **D2**) | ❌ not started |
| M9 — dashboard insight from live data | **H4**, with **I9** guards landing first | ❌ not started |
| M10 — fixture / type / seed separation | **D5**, the documentation-drift table, **L2**, **L3** | ❌ not started |
| M11 — performance, api disclosure, a11y, browser QA | **I6**, **D7**, **D8**, **D9**, **L4** | ❌ not started |

**Deferred by decision, and therefore absent from that table:** the student role and student
workspace (**D1** / I5), the teacher visual workspace (I4), creating the finance, reports,
messaging and notifications domains (**D6** / I2), official Telegram/Bale providers (I7), the
backup-envelope relabelling (I8), and all backend work. Deferral is recorded in
[DECISIONS.md](DECISIONS.md) §19 and in [OPEN_ITEMS.md](OPEN_ITEMS.md) — never silently, and never
as completion.

**Precondition to start M1, as it was met** (kept because the rule is the one M3 inherits): explicit
authorization, **D3 and D4 recorded first** (H5's own done-when requires the decision before the
code), a clean tree, and a re-verified baseline — `npm run typecheck`, `npm test`,
`git diff --check` — reported in the shape the spec's §10 requires rather than as a bare number.
Begin from the CRITICAL/HIGH items in [OPEN_ITEMS.md](OPEN_ITEMS.md); the spec sequences them.

**Precondition to start M3** (the next milestone): the same rule, with two differences the spec
states. M3 gates on **no decision** — "Dependencies. None — the contract is complete" — so nothing
has to be recorded before the code. It did name one precondition, **triaging the I11
`LearningPanel` flake**, because M3 touches the same domain and the same suites and a green run
there is what makes any new run trustworthy. That precondition has been **discharged before M3
rather than inside it**: I11 was reproduced, root-caused and fixed in the test harness, and its
recorded conclusion is that contention was an amplifier, not the cause. M2's findings **H6** and
**H7** were likewise triaged before M3 rather than alongside it, and landed as **M2.1** — see that
section below. What I11's triage found underneath the harness has since been **decided rather than
left open**: **I13** (a list hook published the previous query's rows with no loading marker when its
params change) was authorized as **Checkpoint 1 (A′)** on 2026-09-13 and is implemented — the shared
hook derives what it exposes from the query identity its state answers, and the six dynamic-params
consumers that ignored `loading` render an in-flight state instead of a false empty. **It was a
recorded gate on M3, and that gate is now discharged:** Checkpoint 1 landed as `289e080` with the
full evidence set §10.1 of [PROJECT_STATE.md](PROJECT_STATE.md) requires — 6 consecutive full-suite
runs (100 files / 1384 passed / 0 failed / 0 skipped each, `dist/` built so nothing skipped), 4
samples as two concurrent full suites, build 3.29 s, typecheck, 68 documentation gates — plus a
reversion check on each half. It is **not** registered as a milestone or as a documentation
checkpoint: it is product source, so no row above moves, and §4 of PROJECT_STATE records it under
"Work landed since the Phase 2 checkpoint" instead. Excluded from that authorization and still open:
**I13 Checkpoint 2** (`attachContent` took
only `(levelId, contentId)`, so unlike `assignPlacement` it had nothing to compare a level against)
was **authorized by the owner on 2026-09-13 as its own pass** — M3's prohibition forbids doing it
inside M3, which is exactly why it is separate — recorded as in progress at `be75ac6` before its code
was written, and **has now landed and been validated at `bcea26c`**: the call requires an
`AttachContentIntent { programId }` resolved independently of the target level, refuses a mismatch
with `LINK_INVALID` and writes nothing, and leaves every pre-existing behaviour unchanged. Its
evidence is the same shape as Checkpoint 1's — 6 consecutive full-suite runs (101 files / 1399 passed
/ 0 failed / 0 skipped each, `dist/` built), build, typecheck, documentation gates, and a reversion
check that fails 7 of the 15 new tests plus the compile pin. **I13 Checkpoint 3A** followed and has
**landed and been validated at `57c1dfb`**: `useDerived`, the boundary behind `useStudentPlacement`
and `useEligibleContent` and the only one of the five hand-rolled readers with a real consumer, now
carries its key and derives what it exposes at render. Its evidence is the same shape again — the
exposure **reproduced deterministically before the fix** (a dedicated suite failing 4 of 8 against the
unmodified hook), 6 consecutive full-suite runs (102 files / 1407 passed / 0 failed / 0 skipped each,
`dist/` built), 2 contention samples, build, typecheck, documentation gates, and a reversion check
that fails the same 4 and no others. **Checkpoint 3B followed after M3, as one of the two pre-M4
remediation commits the owner authorized**, and landed as
`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`: scheduling's `useDerivedRead` — the boundary behind
`useSessionRoster`, `useGenerationPreview` and `useConflictCheck` — carries its key too, with a new
9-case suite that reproduced the crossed frame before the fix and a reversion check failing 4 of the 9
on identity. It was hardened **before** M4 rather than inside it, because M4 is what makes those three
readers reachable in shipped UI. Still open and **not** part of any pass: the **remaining three
readers of I13 Checkpoint 3** (`useStudentList`, `useStudentProgress`,
`useSessionAttendance` — none reachable in shipped UI today, not authorized), and
**I14** (`paginate`
clamps `per_page: 0` to one row) — assessed for M3 relevance and **explicitly deferred**, not closed,
because M3's assignment surface never reads through a `per_page: 0` query.

**Rule for whoever lands it:** add its row here with the real SHA, mark it pushed only after
`git ls-remote` confirms it, and update [PROJECT_STATE.md](PROJECT_STATE.md) §2/§3/§9 in the
same commit.

**Done by the M2 commit, which is what this paragraph asked for:** the documentation-checkpoint
table below now names `f1fe114b667558bec1ffbc4e7506e3e310ce9735` — the pass that retired the
test-harness race, recorded it under I11 and grew the gate from 45 to 52 checks — and the two
documentation-checkpoint rows in [PROJECT_STATE.md](PROJECT_STATE.md) §2 advanced in the same edit.
Registering it could only happen here, because a ledger entry never carries its own SHA; and every
40-hex SHA quoted in these documents must be a real commit reachable from `HEAD`, which
`src/__tests__/projectState.test.ts` enforces.

---

## Product phase — M1 — recovery & lifecycle UX (**H5**)

**Commit:** `689a7c15951d690b1ce650a5938e6b1216ca30ed` · *feat: implement M1 lifecycle recovery UX* ·
2026-09-12 13:08 +0330 · author `vahidateur` · **pushed** ✅ to
`arena/01a07c61-parsian-music-dashboard-opus`, and that branch's tip when M2 began.
**Size (from `git show --stat`):** 16 files, 707 insertions, 152 deletions.
Registered here by the M2 commit, per the no-self-referential-SHA rule — the M1 revision of this
ledger could not quote its own SHA, so it named `git log` as the authority instead.
**Base:** M0 `f2ebc09822d03dde8ce06307221e303721ed9c2e`.

**Purpose.** `clear()` empties every collection including `users`, so an environment it clears can
no longer be signed into, and Settings — where "restore a backup" lives — is behind that login. M1
gives the product a way back **without changing what `clear()` does**: the already-implemented,
already-tested `uninitializeEnvironment()` is now reachable from the unauthenticated lifecycle-gate
path, and `clear()`'s warning finally names the account deletion and the lockout.

**What landed.**
- **Destructive-action seam (no new abstraction).** `src/domains/demo/useDemoData.ts` adds
  `"uninitialize"` to `DestructiveAction` and to `DESTRUCTIVE_LABELS`, and `confirm()` now awaits
  `manager.uninitialize({ confirm: true })` for that one action (the others stay synchronous). A
  small `normalizeUninitializeResult()` maps the `UninitializeResult` onto the existing
  `DemoActionResult` shape so `lastResult`/`issues`/`stats` are unchanged for every other caller.
- **`demoDataManager.uninitialize()`** already existed and is unchanged; it delegates to
  `uninitializeEnvironment()` in `src/domains/demo/lifecycle.ts`, also unchanged — confirm-gated,
  synchronous `store.reset()` then awaited `getBlobStore().clear()`, blob failure appended to
  `UninitializeResult.message`, never swallowed.
- **Gate owns the controller.** `src/components/lifecycle/DataLifecycleGate.tsx` builds the
  controller with `useDemoData()` and publishes it through the new
  `src/components/lifecycle/LifecycleRecoveryContext.ts`. The provider wraps **both** gate branches,
  so the awaited blob-cleanup result survives the store reset that unmounts the login branch and
  re-renders `FirstRunChooser`. In `api` mode the gate is transparent and the context is `null`.
- **The visible affordance is outside the shell.** `src/components/lifecycle/LifecycleRecoveryPanel.tsx`
  renders only for a local `empty`/`demo` environment, and only from the unauthenticated
  `LoginView` branch (`src/views/Login.tsx`), gated on `useLifecycleRecovery()` being non-null.
  Two-step: a "start over" button, then a confirmation showing `manager.stats()` counts (records,
  access accounts, students, media) and a truthful warning about account deletion, lockout,
  binaries and irreversibility.
- **`FirstRunChooser`** shows an in-flight `role="status"` notice while the awaited cleanup runs and
  surfaces the exact returned message afterward.
- **Copy.** `clear()`'s warning now states that the access accounts are removed and sign-in becomes
  impossible, and points at "start over".

**Explicitly unchanged (protected).** `clear()` semantics (still empties every collection, keeps the
mode); the zero-record invariant (DECISIONS §8, OPEN_ITEMS I10) — no bootstrap account is re-added
to a cleared dataset; `createEmptyDataset()`/`seed.ts`; the backup envelope (I8); the bearer/cookie
architecture; deployment and production-handoff docs; dependencies. No parallel lifecycle, recovery,
destructive-action, notification or storage abstraction was introduced.

**Decisions.** **D3** (placement) and **D4** (`clear()` vs the zero-record invariant) are recorded
in [DECISIONS.md](DECISIONS.md) §19 as **M1-specific** decisions, and §8/§18 statuses were updated
to match. They do not generalize to backend or production architecture.

**Validation (measured this pass).** `npm run typecheck` clean; `git diff --check` clean; focused
M1 suites green — `dataLifecycle.test.ts` (28), `useDemoData.test.tsx` (4),
`DataLifecycleGate.test.tsx` (10), `FirstRunChooser.test.tsx` (9), `DemoDataPanel.test.tsx` (5),
`projectState.test.ts` (52). Full-suite result is recorded in
[PROJECT_STATE.md](PROJECT_STATE.md) §4.

**Tests added/changed.** New coverage: lockout → recovery → chooser → EMPTY/DEMO way-back and the
api-mode exclusion (`DataLifecycleGate.test.tsx`); awaited `uninitialize` pending/busy/result and
cancellation (`useDemoData.test.tsx`); verbatim blob-failure message propagation
(`dataLifecycle.test.ts`); the truthful `clear()` warning (`DemoDataPanel.test.tsx`); and the H5
state/decision guards (`projectState.test.ts`). `loginEmptyEnvironment` and `loginDemoIsolation`
stay green **unchanged**.

**Rule for whoever reads this next:** register this commit's SHA in the ledger table and in
[PROJECT_STATE.md](PROJECT_STATE.md) §2/§3 in the *following* commit — a ledger entry never carries
its own SHA. **Done:** the M2 commit registered it in the ledger table above and in
[PROJECT_STATE.md](PROJECT_STATE.md) §3.

---

## Product phase — M2 — honest write feedback (**H2** + **H3**)

**Commit:** `c42f274ac10d4087f9280e3bf7b47141d0672e32` · *feat: implement M2 honest write feedback
(H2 + H3)* — registered by the next commit (M2.1), per § "No self-referential checkpoint SHA".
**Base:** M1 `689a7c15951d690b1ce650a5938e6b1216ca30ed`. **Pushed** ✅ to
`arena/01a07c61-parsian-music-dashboard-opus`.

**Purpose.** Stop the panel claiming things it did not do. Seven controls reported a write or a
delivery that never happened (**H2**), and five confirmations described a *real* write as demo data
in every environment, including a customer's own (**H3**). Both are copy and control flow: no data
source changed, and demo and `api` mode behave identically before and after.

**What landed — H2, the seven fake-success sites.** None of the four views can write (scheduling and
attendance have real domains the views do not use; finance has none), so no site could become "the
result of an awaited repository call". The rule applied instead: **where a truthful action exists,
do it; where one does not, remove the control** — never disable it, because a disabled button still
advertises a capability the product does not have.

- `src/views/Scheduling.tsx` — both «انتقال به اتاق ۴» buttons removed, with the local `resolved`
  flag whose only real effect was hiding the warning. The conflict card and the drawer's overlap
  evidence stay visible until a real `rescheduleSession` resolves them *(M4's CP2 has since added that
  real `rescheduleSession`; this is M2's record and stands as written)*, the drawer no longer closes
  on a claimed write, and «مشاهده در تقویم» still navigates. The removed toast also claimed a teacher
  and a student had been notified — a capability that does not exist at all, and which M2 could only
  delete, never implement.
- `src/views/Attendance.tsx` — «همه حاضر» keeps its genuine on-screen convenience, relabelled
  «همه حاضر (موقت)», and reports in `info` that nothing has been recorded; a real `bulkRecord` needs
  a domain session id and an authenticated `recordedByUserId` that this fixture-driven view does not
  have (M5). The «پیگیری» button, which claimed a student **and their guardian** had been notified,
  is removed; the row still opens that student's real profile.
- `src/views/Finance.tsx` — both reminders now use the sanctioned honest `info` shape the same file
  already had for its export button, and say that nothing was sent or queued. The invented
  «N پیام در صف ارسال قرار گرفت» count is gone, and the group reminder is no longer styled as the
  surface's primary action, since it performs none.
- `src/views/Classes.tsx` — the waitlist button no longer claims a suggestion was filed with
  scheduling (no such record exists anywhere in the product); it opens the schedule, the one truthful
  action available before session generation lands (M4).

**What landed — H3, the five mislabelled real writes.** `src/views/Students.tsx` (both mounts of its
dialog), `src/views/Teachers.tsx`, `src/views/Classes.tsx` and
`src/domains/branding/BrandingPanel.tsx` now take the confirmation's wording from
`useIsDemoEnvironment()` (`src/domains/demo/useDataLifecycle.ts`) — the seam `DemoDataPanel` and
`DemoNote` already used — so EMPTY reads «تغییرات در داده‌ها ذخیره شد.» and DEMO keeps
«تغییرات در دادهٔ دمو ذخیره شد.». No view branches on where data lives; it asks, and
`src/__tests__/architectureBoundaries.test.ts` still passes because no view touches the store.
`Students.tsx` carried **two copies** of the literal, one per dialog mount, which is how it survived
review; both now share one confirmation.

**Explicitly unchanged (protected).** Every site on H2's verified "not fake" list, including
`Attendance.tsx`'s «ثبت نهایی» `info` toast — raised during M2 as arguably still dishonest, and
**deferred to M5 by the owner's explicit decision** rather than changed inside a blessed site (now
**I12**). No domain model, repository, hook, fixture, lifecycle or backup-envelope change; no new
dependency; no notification abstraction; `Toast`'s contract (`danger` reserved for genuine failures,
§37) untouched. The fabricated *content* of these views — the scheduling conflict card's hardcoded
room and time, the finance panel's «۱۲ روز از سررسید» — is **H4/M4/M9** work and was deliberately
left alone: M2 removed false claims about writes, it did not make these surfaces truthful overall.

**Findings recorded and deliberately not fixed.** Two new items and one deferral went into
[OPEN_ITEMS.md](OPEN_ITEMS.md) instead of into this diff, because M2's scope was approved before
they were found and widening it mid-milestone is how a reviewed diff becomes an unreviewed one:
**H6** — every edit dialog opens with an empty draft (`useEntityForm` seeds `useState(initial)` once,
the dialogs stay mounted while closed, nothing re-syncs), so "edit" means retype-or-erase and a
partial save silently overwrites the stored record; **H7** — three Settings panels
(`InstrumentsPanel`, `RepertoirePanel`, `RoomsPanel`) carry the identical H3 mislabel; **I12** — the
attendance wording above.

**Validation (measured this pass).** `npm run typecheck` clean; `npm run build` clean (the >500 kB
chunk warning is the known **I6** code-splitting item); `git diff --check` clean; full suite green —
see [PROJECT_STATE.md](PROJECT_STATE.md) §4 for the definitive counts. Every new case was also
**mutation-checked**: with the seven source files reverted to their pre-M2 content, 14 of the 18 new
behavioural cases fail and the structural gate fails on exactly the reverted file, which is the
evidence that they detect the defects rather than restating the code.

**Tests added/changed.** New: `src/views/__tests__/honestWriteCopy.test.tsx` (H3 in EMPTY *and*
DEMO for all five sites, through the real dialogs and repositories — both directions, so the fix
cannot be "delete the demo label"), `src/views/__tests__/noSuccessWithoutWrite.test.tsx` (each H2
site's new behaviour, driven through the real view, plus an EMPTY sweep of all three fixture-driven
views), `src/__tests__/writeFeedbackHonesty.test.ts` (the structural gate: a view may report success
only where it can reach a repository, the four fixture-driven views *(four then, three since M4
graduated `views/Scheduling.tsx` into a both-directions ratchet — see "Product phase — M4")* may report
none at all, and the
set of files hardcoding the demo label is *exactly* the three tracked under H7 — a ratchet that can
only shrink, and one M2.1 retired to an empty list). Extended: `src/views/__tests__/emptyEnvironment.test.tsx` (H3's done-when — «دمو»
cannot appear after a real write in EMPTY) and
`src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` (the branding write). No existing
assertion was weakened or removed; the 13 sites on H2's do-not-fix list keep their coverage.

**Rule for whoever reads this next:** register this commit's SHA in the ledger table above and in
[PROJECT_STATE.md](PROJECT_STATE.md) §2/§3 in the *following* commit — a ledger entry never carries
its own SHA. Note the constraint that keeps §2's phase-checkpoint row where it is: the gate in
`src/__tests__/projectState.test.ts` requires the recorded documentation checkpoint to *descend from*
the recorded phase checkpoint, so that row can only advance once a documentation checkpoint has been
pushed after it. *(Done: the SHA above was registered by M2.1, the next section, and §2's
phase-checkpoint row stayed at `33b1031` for exactly the reason this paragraph gives.)*

M2 also recorded two HIGH findings rather than fixing them, because widening an approved scope
mid-milestone is how a reviewed diff stops being reviewed: **H6** (every edit dialog opens with an
empty draft, so a partial save silently overwrites the stored record) and **H7** (three Settings
panels still call a real write demo data). Both are in [OPEN_ITEMS.md](OPEN_ITEMS.md) with evidence,
and both landed in the next section rather than waiting for M3.

---

## Product phase — M2.1 — edit-form draft integrity + the three Settings panels (**H6** + **H7**)

**Commit:** `73b40d970816f174b56d37addc21f106a472359b` · *fix: implement M2.1 edit-form draft
integrity and honest Settings copy (H6 + H7)* — registered by the following commit, per § "No
self-referential checkpoint SHA".
**Base:** M2 `c42f274ac10d4087f9280e3bf7b47141d0672e32`. **Pushed** ✅ to
`arena/01a07c61-parsian-music-dashboard-opus`.

**Why this milestone exists.** M2 recorded H6 and H7 instead of fixing them, because widening an
approved scope mid-milestone is how a reviewed diff stops being reviewed. Both were HIGH, and H6 was
the most severe defect anywhere in the product — silent, durable data loss reached through a form.
The owner authorized a **read-only triage first**, then a milestone scoped strictly to those two
items. **M2.1 is not in the M0 specification**: it sits between M2 and M3, which is why the ledger
and the milestone table above both say so instead of implying the spec listed it. The spec's M0–M11
sequence is unchanged.

**What landed — H6, at one boundary rather than six.** `src/domains/shared/useEntityForm.ts` gained
an optional `open` in `EntityFormOptions`, and the hook rebuilds its draft from the newest `initial`
whenever the surface opens. `initial` is held in a ref and is deliberately *not* an effect
dependency: callers build it inline (`toDraft(record)`), so it is a fresh object on every render and
depending on it would wipe what the operator is typing on each keystroke. `reset()` has a stable
identity for the same reason. The six affected dialogs pass the `open` prop they already had —
`students/StudentFormDialog.tsx`, `teachers/TeacherFormDialog.tsx`, `classes/ClassFormDialog.tsx`,
`instruments/InstrumentFormDialog.tsx`, `rooms/RoomFormDialog.tsx`,
`progress/PieceFormDialog.tsx`. No mount site changed, no view has to key its dialog, and no new form
can inherit the defect without opting out.

The triage widened the affected set from the three dialogs originally recorded to **six dialogs
across seven mount sites**, and established that `AssignPieceDialog` and `RecordProgressDialog` were
never affected — `StudentProgressPanel.tsx` mounts them conditionally, so React remounts them with
fresh state, which is the pattern already correct in this repository. Those two were left alone.
`toDraft` ↔ payload symmetry was audited field by field for all six; every field sent on update is
prefilled, so closing the prefill closes every erasure path (a class's `status` maps from the draft's
`archived`; an instrument's `slug` is intentionally not sent on edit).

**Deliberately *not* done:** hardening `src/services/demoStore.ts`'s `update` to ignore an explicit
`undefined`. That was the tempting fix and it would have stopped the erasure, but it changes
repository semantics for every caller and destroys the legitimate "clear this optional field" intent.
The wrong boundary was the form, not the store.

**What landed — H7, the same seam in three files.** `src/domains/instruments/InstrumentsPanel.tsx`,
`src/domains/rooms/RoomsPanel.tsx` and `src/domains/progress/RepertoirePanel.tsx` now derive their
confirmation from `useIsDemoEnvironment()` (`src/domains/demo/useDataLifecycle.ts`) exactly as
`src/domains/branding/BrandingPanel.tsx` does: EMPTY reads «تغییرات در داده‌ها ذخیره شد.», DEMO keeps
«تغییرات در دادهٔ دمو ذخیره شد.». The awaited write, the `catch` and the `danger` path are
untouched, and no panel branches on where data lives. H7 was done *with* H6 rather than after it
because H6's affected panels are these three files — fixing them separately would have touched the
same files twice and left the honesty ratchet non-empty in between.

**Tests added/changed.** New: `src/domains/shared/__tests__/entityFormDraft.test.tsx` (18 cases —
three per entity across all six dialogs: opens on the record's own values; changing one field
preserves every other field **in the store**, read back through the repository rather than from the
draft; record A → cancel → record B cannot carry A's draft into B. Each drives the production
sequence — mount closed with no record, *then* open on one — which is the path the older suites never
exercised). Strengthened: `src/domains/instruments/__tests__/InstrumentsPanel.test.tsx` "saves a
renamed instrument" now reads the record first, asserts the dialog prefills `description` and
`active`, and asserts `description` / `active` / `slug` all survive the save — previously it asserted
only the field it had typed, which is why the erasure went unnoticed. Extended:
`src/views/__tests__/honestWriteCopy.test.tsx` (+6: an EMPTY and a DEMO case per H7 panel, each
driving a real create through the real panel and reading the record back, so the wording is asserted
about a write that demonstrably happened). Retired: the hardcoded-demo-label ratchet in
`src/__tests__/writeFeedbackHonesty.test.ts` is now an **empty** list kept as a tripwire, and the
three panels joined the surfaces pinned as *deriving* their copy — eight in total. No existing
assertion was weakened or removed.

**How it was verified** (all green at this commit; full table in
[PROJECT_STATE.md](PROJECT_STATE.md) §4). `npm ci` exit 0 · `npm run typecheck` clean ·
`npm test` **97 files / 1369 passed / 0 failed / 0 skipped** with `dist/` present so the 8 CSP gates
ran · `npm run build` exit 0 · `git diff --check` clean. Baseline at `c42f274` measured in a
`git worktree` of this clone: **1345** tests, so `1345 + 18 + 6 = 1369` and every test is accounted
for; that worktree's 8 skips (no `dist/`) and 1 failure (detached HEAD vs. the branch-identity gate)
are artifacts of the worktree, not of the code. **Mutation-verified twice:** reverting the hook alone
fails all 18 new cases and the strengthened panel case, reporting `expected '' to be 'ساز زهی مضرابی؛
کلاسیک، پاپ و فلامنکو.'`; reverting the three panels alone fails the 3 new EMPTY cases and both
ratchet cases while the DEMO cases still pass, correctly. Each revert was restored byte-exactly
(`sha256sum`) and re-run.

**Findings recorded, deliberately not fixed.** None new. The items this milestone touched are either
now landed (H6, H7) or already recorded and unchanged (**I11**, the `LearningPanel` flake, still M3's
precondition). The symmetry audit found no further defect.

**Rule for whoever reads this next:** M3 is *not* authorized by M2.1 landing. What M2.1 leaves M3 is
a safe foundation — a piece's `programId`, `rangeUnit` and `active` flag now survive an edit instead
of being reset to defaults, which is exactly what an assignment surface reads — and one still-open
precondition, I11.

---

## Product phase — M3 — learning-content assignment UI (**I3**) — ✅ COMPLETE

**Implementation checkpoint:** `e5b0a57d8f33dc04838670a2cd4158a88dd34022` · *feat(learning): M3 checkpoint — assign learning content to
a level through the UI*. **Base:** I13 Checkpoint 3A's documentation checkpoint `85530b40c66db63b10769537c2dc6cb24609842d`.
**Completion checkpoint:** `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad` · *fix(learning): M3 F1 — a failed catalogue read is reported, not
shown as empty*. All pushed ✅ to `arena/01a07c61-parsian-music-dashboard-opus`.

**Status: ✅ COMPLETE (2026-09-13), accepted with recorded limitations.** The milestone was
implemented at `e5b0a57d8f33dc04838670a2cd4158a88dd34022`, documented at `df3db2f18718ae0d6d3cf4b13050ea0774833864` and `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed`, then put through a formal **acceptance
audit** against the spec's own fields — every MUST enumerated and answered PASS / PARTIAL / FAIL /
NOT VERIFIABLE with file-and-line evidence. The audit found **one** product defect (**F1**, below),
**one** documentation contradiction (**F2**, the rollback boundary) and **one** evidence shortfall
(**F3**, the six-run rule). All three are resolved: F1 at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad` with a regression case and a
reversion check, F2 and F3 in the documentation commit that follows it. Nothing else in the audit
blocked completion. **Browser QA has never run and is NOT VERIFIED** (§5 of
[PROJECT_STATE.md](PROJECT_STATE.md)) — completion is a statement about code, tests, evidence and
documents, not about a human having used this surface in a browser.

**Why this milestone exists.** **I3** was the cheapest possible proof of the phase's central
pattern: a contract that is complete, tested and called by nothing but tests. `LevelContentLink`,
`listLinks` / `attachContent` / `detachContent`, link ordering and the `CONTENT_ALREADY_LINKED`
conflict all existed at `src/domains/learning/repository.ts` and
`src/domains/learning/demoRepository.ts`, and no view touched them. The spec made this **UI only**:
no new field, no model change, no edit to the learning domain — which is why M3 could not fix
`attachContent`'s missing intent parameter itself, and why that fix landed separately as **I13
Checkpoint 2** (`bcea26c`).

**What landed — one new surface, one edited panel, no second source of truth.**
`src/domains/learning/LevelContentPanel.tsx` (new, 265 lines) reads the level's links with
`useLearningContent({ levelId })` and the active catalogue with `useLearningContent({ activeOnly:
true })`, offers the catalogue minus what is already linked, and writes through `attachContent` /
`detachContent`. `src/domains/learning/LearningPanel.tsx` gained a per-level «منابع» toggle (+66
lines, no deletions) and renders the surface **after** the grid, outside the levels column, so its
content rows can never be counted as levels by the protected harness. Nothing is copied locally: the
list under a write refreshes from `demoStore`'s data-version bump, the picker's offers are derived
from the repository's rows, and the pick itself is derived from *this* level's rows so a choice made
for another level collapses to nothing instead of arming a button. The selection is dropped when the
program changes, so the surface cannot name one program while listing another's level. All four
states are reported as themselves — in-flight (with the count withheld rather than claiming
«۰ منبع»), empty, error with retry, success — and feedback fires only after a mutation resolved.

**The write invariant, honoured at the wiring where it lives.** `levelId` comes from the rendered
row; `AttachContentIntent.programId` comes from the programs query the panel selected, never from
`level.programId`. Two values read off one row cannot contradict each other, so a guard built from
them proves nothing — which is the caveat I13 Checkpoint 2 recorded against itself. M3 answers it
with a test rather than a sentence: `src/domains/learning/__tests__/contentAssignmentFlow.test.tsx`
reproduces, at the repository boundary, the crossed frame `useResourceList` really commits on a
program switch (**I11**/**I13**) — the heading names program B while the rows are still program A's
levels — opens the surface from that stale row, attaches, and asserts both halves: the repository was
handed the independently selected program and therefore refused with `LINK_INVALID`, writing nothing.
Mutating the wiring to `contentLevel.programId` turns that case red and no other.

**Tests — 17 new cases in two new files, no existing test touched.**
`src/domains/learning/__tests__/LevelContentPanel.test.tsx` (12) covers the surface in isolation:
in-flight with no false empty, honest empty, listing exactly what the repository holds, a failed
read as an error with retry, **a failed catalogue read reported as unreadable rather than as
"nothing left to attach" (the F1 regression case, added at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`)**, valid attach, duplicate refusal
in the repository's own words, failed attach with no false success, detach without deleting content,
the intent handed over, the adversarial prop-level crossing, and a level switch that neither exposes
the previous level's rows nor lets its pick become this level's write target.
`src/domains/learning/__tests__/contentAssignmentFlow.test.tsx` (5) covers the flow through
`LearningPanel`: attach end-to-end and persistence across a remount, the surface closing on a program
switch, the adversarial crossing above, duplicate refusal through the panel with a deliberately stale
picker, and the EMPTY environment offering no assignment surface while inventing nothing. Every wait
is data-derived — the rows the store holds for the level the heading names — never a loading flag,
since that flag is under test. `withStubs` moved to `src/test/repositoryStubs.ts` so both files share
one Proxy-based stubber; a spread would drop the prototype verbs.

**Measured validation** is in [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M3 validation": typecheck
clean, build clean, and — as the spec's Tests clause requires of a milestone touching a file that has
ever flaked — **6 consecutive full-suite runs at the completion checkpoint `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`: 104 files / 1424
tests / 0 failed / 0 skipped on every run, with `LearningPanel.test.tsx` 11/11 each time (1907–2117
ms)**. The acceptance audit had already measured **6 consecutive full-suite runs at `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed`: 104 /
1423 / 0 failed / 0 skipped, `LearningPanel.test.tsx` 11/11 each (1927–2086 ms)**; `1423 + 1` (the F1
regression case) `= 1424`. Earlier in the milestone the record said three consecutive full runs plus
six targeted ones — below the count the spec demands — and that shortfall (**F3**) is corrected here
and in §4 rather than left as the authoritative evidence. Also measured: **6 consecutive targeted
runs at 11 files / 161 tests**, a worktree baseline at `85530b40c66db63b10769537c2dc6cb24609842d` of 102 files / 1407 tests, **five
mutation checks** (four on the invariant and honesty cases, plus the F1 reversion check, each killing
only the case that pins it), and a source diff of **1414 insertions and 0 deletions** at `e5b0a57d8f33dc04838670a2cd4158a88dd34022` plus
F1's **38 insertions / 6 deletions** ignoring the re-indentation of the block it wrapped.

**Protected areas respected.** The spec protects `src/domains/learning/__tests__/demoRepository.test.ts`,
`src/domains/learning/__tests__/LearningPanel.test.tsx`,
`src/domains/learning/__tests__/StudentLearningPanel.test.tsx` and [DECISIONS.md](DECISIONS.md) §10
against M3; all three files are untouched and green, and every new case lives in a new file.
`LearningPanel.tsx` — the component — is edited, which the spec permits as long as its tests stay
green, and they do (11/11).

**Out of scope, deliberately.** The spec's *optional* student-scoped read was **not** added, so the
slice stays tight and I13 Checkpoint 3A's `useDerived` fix is landed but unused by M3 — recorded as
unused, not claimed as a dependency satisfied. No media bytes were invented, no `per_page: 0` call
site added (**I14** stays deferred and untouched), no backend touched, no dependency added, and no
unrelated cleanup folded in.

**Residual exposure M3 introduced, recorded rather than hidden.** The surface's «جدا کردن» is a
single-id write: `detachContent(levelId, contentId)` takes both ids from the rows on screen, so no
repository guard can detect a crossed context, and a detach performed from a stale level row inside
the **I11**/**I13** frame would remove a link of the program the operator navigated away from. The
attach half is guarded and pinned (D10); the detach half is not, and closing it needs either an intent
on `detachContent` — a learning-domain change M3's prohibition forbids — or the hook fix itself. It is
recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I13: not fixed, not authorized, not started.

**F1 — the one product defect the audit found, and its fix (`3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`).** The picker's catalogue read
destructured `items` and `loading` and discarded `error`, so a failed catalogue was indistinguishable
from an empty one and rendered «منبعی برای اتصال باقی نمانده» — a false empty of exactly the shape
I13 Checkpoint 1 removed from six consumers, in a new place. The fix consumes the error the existing
hook already exposes and replaces **only** the add affordance with an `ErrorState` carrying the
failure's own message and a retry — the same convention the level's own read already used in this
component — while the links above stay rendered, because that read answered. `available` is withheld
while the catalogue is unreadable, deliberately: the hook keeps the previous page across a failed
*refetch*, and offers beside an error would claim a choice the read cannot justify. With no picker and
no submit rendered, a write cannot be attempted against a read that has not answered. No new data
source, no contract or domain change, no dependency, and **the fourteen other consumers with the same
shape were deliberately left alone** — they are recorded as
[OPEN_ITEMS.md](OPEN_ITEMS.md) **I15** instead of being cleaned up inside M3.

**What completion does NOT claim — limitations preserved on purpose.** (1) **Detach has no
stale-context guard** (above, and I13, which stays open). (2) **`per_page: 200` ceilings**: both of
the surface's reads mean "everything" and stop at 200, and its heading counts `items.length` rather
than `total` — recorded as **I16**. (3) **The fourteen error-discarding consumers** — **I15**.
(4) **Link order is invisible here**: `sortOrder` is written and honoured student-side
(`src/domains/learning/eligibility.ts:104`) but the assignment surface neither shows nor manages it —
**I17**. (5) **No storage round-trip test**: "assignment persists across a reload" is proven by a
remount case plus the store's single-persistence-authority code path
(`src/services/demoStore.ts:315`), not by a re-hydration case. (6) **Browser QA NOT VERIFIED** (§5).
(7) **D8's api-mode indicator does not exist yet** — OPEN, assigned to M11 — so this surface carries
no "still local" disclosure; it does imply no server either, since learning resolves to Demo in both
modes.

**Rollback — two boundaries, because one number would be wrong in one of two directions (F2).**
- **Spec rollback boundary:** `c42f274ac10d4087f9280e3bf7b47141d0672e32` — **M2**, per the milestone's own
  [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M3 → "Checkpoint & rollback"
  ("rollback boundary = M2's SHA") and the convention across the spec (M2's boundary is M1's SHA,
  M4's is M3's).
- **Effective safe boundary:** `85530b40c66db63b10769537c2dc6cb24609842d` — the commit M3 was actually built on. **Rolling back to M2
  would destroy work that was separately authorized, separately reviewed and separately accepted:**
  M2.1 `73b40d970816f174b56d37addc21f106a472359b`, then the three I13 checkpoints `289e080` (Checkpoint
  1), `bcea26c` (Checkpoint 2 — the guard M3's surface writes through) and `57c1dfb` (Checkpoint 3A),
  with their documentation checkpoints in between. **Those must survive any M3 rollback.**
- So: to abandon M3 and nothing else, return to `85530b40c66db63b10769537c2dc6cb24609842d`; to obey the spec's literal boundary you would
  also be reverting five accepted commits, which is not what the field is for. Earlier revisions of
  this section named M3's *own* checkpoint `e5b0a57d8f33dc04838670a2cd4158a88dd34022` as the boundary — wrong in both directions, since
  rolling back onto it keeps the work being rejected. Corrected here; no history was rewritten, reset
  or rebased to make the documents agree.

**Rule for whoever reads this next (written when M3 closed; M4 has since landed — see the M4 section
below, and read this paragraph as the record of what M3 handed it):** M4 is *not* authorized by M3
landing. What M3 leaves M4 is the
proven pattern — a surface over a complete contract, writing through the repository, with the
independent-intent rule pinned by an adversarial test — and one open hardening item, **I13**, of
which **Checkpoint 3B has since landed** (`fba826f`, scheduling's `useDerivedRead`, the boundary M4 is
about to make reachable); the three readers that remain — `useStudentList`, `useStudentProgress`,
`useSessionAttendance` — are still not authorized and still not started. Also landed after M3 is **C2**
(`7e72887`), which makes the page-size contract compile-time: `useSessions` and `useAttendanceRecords`
take `Paged<…>`, so M4 cannot call the scheduling list without declaring its page. That commit is M4's
**effective safe rollback boundary**, and it is *not* the number the spec's convention would name —
that convention ("M4's is M3's") points at `3bec881`, M3's completion, and rolling back there would
destroy both remediation commits. Same shape as the F2 correction above, one milestone later; see the milestone's
own "Checkpoint & rollback" field.

---

## Product phase — M4 — scheduling **view** wiring (**H1a**) — ✅ COMPLETE

**Documentation checkpoint (CP0):** `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` · *docs(m4): reconcile
scheduling phase state* — the five `docs/engineering/` documents and `src/domains/scheduling/README.md`
reconciled with the tree before any product source moved. **Base:** C2
`7e72887761f07f48e115160611a9785bfaae9060`, which is also this milestone's **effective safe rollback
boundary**.
**Implementation checkpoints:** CP1 `0f875a78c99077e25b67b9cc9cffe34c823ee511` · *feat(m4): wire
scheduling reads*; CP2 `f8c3472895978054c8dc81574bb8a945ef3c326d` · *feat(m4): wire scheduling
writes*; CP3 `6f54caf46dc13baca78e376c606a4aa9667cdb48` · *feat(m4): wire scheduling generation*.
**Acceptance-coverage checkpoint (the audit's B1 + B2):**
`df701488362cb90cf32ccefad277879477571cf7` · *test(m4): close scheduling acceptance coverage* — two
test files, **402 insertions / 13 deletions**, no product source.
All pushed ✅ to `arena/01a07c61-parsian-music-dashboard-opus`.

**Status: ✅ COMPLETE (2026-09-14), accepted with recorded limitations.** The milestone was documented
at CP0, implemented in three checkpoints, and put through a **read-only acceptance audit** at CP3 that
returned **ACCEPT with non-blocking follow-ups**. The two follow-ups that were coverage findings
(**B1**, **B2**) are closed at `df701488362cb90cf32ccefad277879477571cf7`; the remaining ones were
**deferred by the owner's explicit instruction rather than landed**, and this ledger does not describe
them as done. **No mutation or reversion check was recorded for CP1, CP2 or CP3** — unlike M3's record,
which carries five — and none is claimed here. **Browser QA has never run and is NOT VERIFIED** (§5 of
[PROJECT_STATE.md](PROJECT_STATE.md)): completion is a statement about code, tests, evidence and
documents, not about a human having used this calendar in a browser.

**Why this milestone exists.** **H1a** was the same shape as M3's **I3**, one layer up in risk: the
scheduling domain was complete and heavily tested (**Group A**, 211 tests pinning the `Session` model,
`conflicts.ts`, `generation.ts`, `dateBridge.ts`, the repository invariants and the registry), and
nothing but tests called it. `src/views/Scheduling.tsx` rendered `weekSessions`, `rooms`, `teachers`
and `TODAY_INDEX` from `src/data/records.ts`: a frozen weekday as "today", a hardcoded room-4 transfer
narrative and fabricated occupancy and free-slot sentences — **H4**'s shape inside this view. M2 had
already removed the two controls that *claimed* a write; what was left was fabricated **content**, and
removing it meant introducing the product's first real scheduling operations.

**What landed — CP1, the reads.** Every row on the screen is now a `Session` read through
`useSessions` for a bounded `from`/`to` window derived from the mode the operator chose
(`src/views/Scheduling.tsx:311`), labelled from the classes, rooms and teachers domains, dated through
`dateBridge` and anchored on `useAcademyNow` instead of on a constant. The fixture imports are gone,
and with them the frozen weekday and the fabricated room-occupancy, room-pressure and free-slot
narratives. All four read states are reported as themselves — in-flight, empty
(«جلسه‌ای در این بازه نیست»), error with its own message and a retry, success — and each supporting
read owns its own failure rather than collapsing into a false empty.
`src/views/__tests__/schedulingNoFixtures.test.ts` asserts the part that matters most: fixture records
do **not** appear when the repository returns something else, which is H1's done-when and the
`src/views/__tests__/Students.test.tsx` pattern.

**What landed — CP2, the writes.** `src/views/scheduling/SessionWriteDialogs.tsx` (new) carries the
first two real scheduling operations: **reschedule** — `rescheduleSession`, which cancels the original
and creates a linked replacement — and **cancel**, which requires a reason. **Reschedule** is guarded
before the write by `useConflictCheck`: a hard conflict blocks submission, and a warning requires an
explicit acknowledgement that is withdrawn the moment the form is edited. **Cancel** is not
conflict-guarded, because a cancellation is not a move; what guards it is the repository's own
attendance protection, its already-cancelled refusal and its required reason. Both writes are awaited,
neither mutates optimistically, and the repository re-runs its own checks at write time — the conflict
recheck for a reschedule, the protections for both — so no invariant depends on the dialog having
asked first.

**What landed — CP3, generation.** `src/views/scheduling/GenerateSessionsDialog.tsx` (new) renders the
plan `useGenerationPreview` asks the repository for — the domain's own numbers, labels, orphans,
protections and window refusals — and commits through `generateSessions`, which re-plans before
writing. The preview is labelled a preview, the write stays refuseable, and nothing in the dialog
plans sessions itself.

**The write contract, and where the invariants live.** The repository owns every invariant —
attendance protection, the already-cancelled refusal, the required reason, the conflict recheck, and
the fact that a reschedule is a cancellation plus a linked replacement rather than a date edit. The
view calls the verbs, awaits them, refreshes its own read and reports what happened: success only
*after* the promise resolves, naming only the operation that ran; failure in `danger` with
`apiErrorFromThrown(cause).message`, the repository's own sentence, so `SESSION_HAS_ATTENDANCE`,
`SESSION_ALREADY_CANCELLED`, `SESSION_CANCEL_REASON_REQUIRED` and `SESSION_CONFLICT` reach the
operator in the domain's words. No copy implies a notification, an SMS or a server — none of those
exist (the milestone's own **E-3** exclusion, cited where it was applied —
`src/views/Scheduling.tsx:27`; **D8**'s api-mode indicator is still M11's). The write target is the **derived** selected session, an id
resolved against the loaded page, so a window change that stops resolving leaves no target and no
dialog: **D11**'s derive-rather-than-store rule and **D10**'s discipline, applied to a calendar, and
asserted by `src/views/__tests__/schedulingStaleWindow.test.tsx` — a superseded window's late answer is
ignored, each window is read once with its own bounds, and nothing of window A survives while B is in
flight.

**I16's calendar mitigation, implemented and still not a closure.** Every read states its own ceiling
(`src/views/Scheduling.tsx:116`), the window is bounded, the counts come from `Page.meta.total` rather
than `items.length` (`:458`), a truncated page says so in its own words (`:563`), and the per-day
counts are **withheld** while that notice stands (`:711`) — a partial answer is never dressed as a
complete one. **I16 stays OPEN**: the ceiling is still 200, `useClasses`, `useRooms` and `useTeachers`
are still not `Paged<>`, and every other consumer is untouched.

**Tests — 63 new cases in five new view files, two pre-existing gate suites extended, nothing
weakened.** `src/views/__tests__/Scheduling.test.tsx` (15) ·
`src/views/__tests__/schedulingNoFixtures.test.ts` (14) ·
`src/views/__tests__/schedulingStaleWindow.test.tsx` (3) ·
`src/views/__tests__/schedulingWrites.test.tsx` (16) ·
`src/views/__tests__/schedulingGeneration.test.tsx` (15). The spec named two landed gates that listed
this view as fixture-driven, and M4 reconciled both **in the strengthening direction**:
`src/__tests__/writeFeedbackHonesty.test.ts` moved `views/Scheduling.tsx` out of `FIXTURE_DRIVEN_VIEWS`
into a new `GRADUATED_VIEWS` ratchet asserted both ways — the file must reach `getSchedulingRepository(`
*and* report the success it can now honestly claim — so the view can neither slip back into the
fixture list nor keep a toast after losing its write; and
`src/__tests__/architectureBoundaries.test.ts` added `useClasses`, `useRooms` and `useTeachers` to
`PAGE_SIZE_CALLERS`, the gate C2 could not express in types.
`src/views/__tests__/noSuccessWithoutWrite.test.tsx` was re-driven from the repository instead of the
`weekSessions` fixture (8 cases before, 11 after). No Group A file, no Group D file and no protected
milestone suite was edited.

**Measured validation** is in [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M4 validation": typecheck
clean, build clean (the pre-existing >500 kB warning unchanged — **I6**), `git diff --check` clean, and
**one full-suite run at `df701488362cb90cf32ccefad277879477571cf7`: 110 files / 1502 tests / 0 failed /
0 skipped** — re-run once by this documentation pass at the same product tree, with the same numbers —
and the arithmetic against C2's record is auditable (`1435 + 63 + 4`). **One run, not six,
and that is the rule rather than a shortcut:** the spec's Tests clause requires six consecutive runs of
a milestone that touches a file which has ever flaked, and M4 touched neither of the two **I11** files
(`src/domains/learning/__tests__/LearningPanel.test.tsx`, `src/views/__tests__/emptyEnvironment.test.tsx`).
**Mutation and reversion checks: NOT RECORDED for CP1–CP3.** They were not performed, so they are not
written down; the row in §4 says so explicitly, and no reader may quote this milestone as
mutation-checked.

**Protected areas respected.** The spec protects the six **Group A** files
(`src/domains/scheduling/__tests__/conflicts.test.ts`, `generation.test.ts`, `dateBridge.test.ts`,
`demoRepository.test.ts`, `registry.test.ts`, `useScheduling.test.tsx`) plus
[DECISIONS.md](DECISIONS.md) **§11** and **§16**, and states that **only the view changes**. Measured,
not promised: `git diff --name-only 7e72887..df70148` lists **no** file under
`src/domains/scheduling/__tests__/`, Group A still measures **211** tests, and the only path under
`src/domains/` that differs across the whole chain is `src/domains/scheduling/README.md` — a document.
`useScheduling.ts`, `repository.ts`, `demoRepository.ts`, `generation.ts`, `conflicts.ts`,
`dateBridge.ts` and `src/domains/registry.ts` are byte-identical, so the demo implementation is still
what both modes resolve to (`src/domains/registry.ts:197`). §11's decision is unchanged; only its
*status* sentence, which claimed the view still renders fixtures, was corrected.

**Out of scope, deliberately — and the five verbs no shipped surface calls.** *(The **E-n** labels
below are the exclusion clauses of M4's own authorization; the documents do not reproduce that list,
and the source comments that applied them are the reference — `src/views/Scheduling.tsx:27` and `:45`,
`src/views/scheduling/GenerateSessionsDialog.tsx:35`.)* The domain's eleven
verbs are `list`, `get`, `create`, `update`, `cancelSession`, `rescheduleSession`, `delete`,
`previewGeneration`, `generateSessions`, `checkConflicts` and `sessionRoster`. M4 consumes six of them
(through `useSessions`, `useGenerationPreview`, `useConflictCheck` and three direct calls). The other
five stay unconsumed, each for a recorded reason:
- **`get`** — the selected session is *derived* from the loaded page rather than fetched by id, which
  is what makes a stale selection resolve to nothing (**D11**); a second read for the same row would
  reintroduce the frame the derivation removes.
- **`create`** — M4's writes are the operations the domain already guards (`rescheduleSession`,
  `cancelSession`, `generateSessions`). A generic create would offer a path around those invariants,
  and no UI need for a hand-made session was authorized.
- **`update`** — same reason, sharper: `update` marks a session `manual`, so exposing it would let an
  operator edit a generated session out from under the generation engine's protections.
- **`delete`** — excluded by **E-2**, and the exclusion holds in CP3 as well: the repository has a
  `delete` and generation can orphan a session, but no control in the view removes anything.
  Cancellation *is* this domain's destructive operation, because a hard delete destroys the record that
  a session ever existed, which is exactly what a parent disputes.
- **`sessionRoster`** — deferred to **M5**, the milestone that wires attendance; rendering a roster
  here would put a second consumer on the attendance boundary M5 owns.

Also out of scope and untouched: the conflict engine, the generation rules, the date bridge, the
`Session` model, `Room.occupancy` and `AcademyClass.attendanceAvg` semantics (**H4**), the legacy
fixture collections in `src/data/records.ts` (`src/views/Classes.tsx` and `src/views/Attendance.tsx`
still read them; their fate is **D5** at **M10**), any recurrence-scoped write (the fixture view's
«فقط این جلسه» / «این و جلسات بعدی» controls are gone with the fixtures rather than reimplemented,
because no domain contract exists for them), notifications to a teacher or a guardian, any dependency,
and any backend work.

**What completion does NOT claim — limitations preserved on purpose.** (1) **H1 stays OPEN**: H1a is
closed, H1b (attendance) is M5's, and the umbrella item closes only when both views are wired.
(2) **The roster is not rendered** — `useSessionRoster` is unconsumed. (3) **No create, edit or delete
surface** — the five verbs above. (4) **I13 stays open**: three hand-rolled readers keep the old
shape, and `useSessionRoster`'s key-carrying fix has no consumer yet. (5) **I16 stays open** globally.
(6) **No mutation or reversion evidence for CP1–CP3.** (7) **Browser QA NOT VERIFIED** (§5). (8) **D8's
api-mode indicator does not exist until M11**, so this surface carries no "still local" disclosure —
and implies no server either, since scheduling resolves to Demo in both modes.

**Rollback — two boundaries, because one number would be wrong in one of two directions (the same
correction M3's F2 established).**
- **Spec rollback boundary:** `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad` — **M3's completion**, which
  is what the convention in [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M4 →
  "Checkpoint & rollback" names ("M4's is M3's").
- **Effective safe boundary:** `7e72887761f07f48e115160611a9785bfaae9060` — **C2**, the commit M4 was
  actually built on. Rolling back to M3's completion would destroy two separately authorized,
  separately reviewed and pushed remediation commits: **C1 / I13 Checkpoint 3B**
  (`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`) and **C2** itself. **Those must survive any M4
  rollback.**
- So: to abandon M4 and nothing else, return to `7e72887761f07f48e115160611a9785bfaae9060`. Returning
  instead to CP0 `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` keeps the documentation reconciliation and
  drops all four product commits, which is the right answer only if the *wiring* is what is being
  rejected. No history was rewritten, reset or rebased to make these documents agree.

**Rule for whoever reads this next:** M5 is *not* authorized by M4 landing. What M4 leaves M5 is the
proven pattern — a view over a frozen domain, writing through the repository, deriving its write
target from what is actually loaded, reporting a truncated page as truncated — and three open items it
does not close: **H1b** (the attendance view still reads fixtures, and its «ثبت نهایی» wording is
**I12**), **I13** (`useSessionAttendance` is the reader M5 makes reachable, and its doc comment still
claims a guarantee it does not deliver) and **I16**. M5 also inherits the one thing M4 proved about
session ids: real ones now exist in shipped UI, so attendance no longer has to be wired to fixture ids
twice.

*(This paragraph is M4's record and is kept as written. **M5 has since landed** — see the next
section — and it took the pattern, closed **H1b** and **I12**, made `useSessionAttendance` reachable
**without fixing it**, and left `useSessionRoster` unconsumed after all.)*

---

## Product phase — M5 — attendance **view** wiring (**H1b**) — ✅ COMPLETE

**Documentation checkpoint (CP0):** **none — and that is recorded, not hidden.** M4 had one
(`84fb7cb4a4a703d52de78cd701ed21d4d242d7c5`) because its scope was being restated against a frozen
domain before any product source moved. M5's scope was already accurate in the documents M4's final
reconciliation left behind — the milestone's own section of
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) named the files to freeze, the reads
and writes to wire and the fabrications to remove — so the work went straight to implementation and
the reconciliation happened **after** it, which is this ledger's other accepted ordering. No claim was
made in these documents before the evidence existed.

**Implementation checkpoint:** `9505ade4011b37a34e3488fd51206512829205ec` · *feat(m5): wire
attendance view* · 2026-09-14 · **pushed** ✅
**Size (from `git diff --shortstat 24caf3a..9505ade`):** 8 files, 3 093 insertions, 324 deletions.
**Built on:** `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` — **M4's final documentation reconciliation**,
which is therefore M5's **effective safe rollback boundary** as well as the spec's named one.

**Status: ✅ COMPLETE (2026-09-14), accepted with recorded limitations.** One implementation
checkpoint, one documentation reconciliation (the commit carrying this entry's successor), **no**
acceptance audit — so this section carries **no audit findings and no B-numbered coverage items**, and
does not imply any.

**Why this milestone exists.** **H1b** was the last half of **H1**: `src/views/Attendance.tsx`
rendered a register that no domain had produced. It read `todayAttendance` — eight registers keyed by
legacy ids `g7`–`g15` that match no `Session` the scheduling domain has ever emitted — plus
`attendanceTrend` and `attendanceByDay` from `src/data/records.ts`; it printed a hardcoded «نرخ حضور
امروز» of 92٪ against a fabricated «میانگین ماه» of 89٪ and a per-instrument breakdown nobody
computed (**H4**'s shape, inside this view); and its «ثبت نهایی» control flipped local React state,
stamped a hardcoded recorder name and announced a save — the wording **I12** recorded. Meanwhile the
domain underneath was complete, registered and protected: **Group D**'s 79 tests pinned an append-only
record model, a roster derived from Enrollment, an atomic bulk save, a reason-gated correction trail
and eight repository verbs.

**What landed — the reads.** A bounded window of real sessions through `useSessions` (`:208`), from
the academy's own clock, labelled from the classes, rooms and teachers domains; the operator's choice
**derived** from that window rather than stored (`:237`); **one derived register** through
`useSessionAttendance` (`:241`), so a student cannot be rendered unmarked while their mark loads in
another request; the window's marks and its recorded absences through two `useAttendanceRecords`
queries the repository itself filters (`:215`, `:217`); and the append-only correction trail through
`useAttendanceCorrections` (`:219`), read one page at a time and never whole. Every bounded read
states its own page size (`:112`) and every count comes from `total`, with a truncated page announced
as truncated (`:496`, `:649`, `:727`, `:779`) — the ceiling language **I16** required, stated rather
than removed.

**What landed — the three writes, all awaited.** `record` marks one student (`:304`), `bulkRecord`
saves every unmarked student on the register in one atomic act (`:349`), and `correct` changes a mark
and appends an immutable correction with a required reason (`:390`), driven by
`src/views/attendance/CorrectMarkDialog.tsx`; the register itself is
`src/views/attendance/RegisterPanel.tsx`. Success is announced only after the promise resolves and
names only what happened — one record written, «{faNum(n)} حضور ثبت شد» for a bulk save, one status
corrected — each with a detail stating what did *not* happen («چیزی حذف نشد و اطلاع‌رسانی انجام نشد»).
The retracted claim «همه حاضر ثبت شدند» is gone and pinned as forbidden by test. Failure is announced
in `danger` with `apiErrorFromThrown(cause).message`, so `ATTENDANCE_DUPLICATE`,
`ATTENDANCE_REASON_REQUIRED`, `ATTENDANCE_SESSION_CANCELLED`, `ATTENDANCE_STUDENT_NOT_ON_ROSTER` and
`ATTENDANCE_RECORDER_REQUIRED` reach the operator in the domain's own words. Nothing is mutated
optimistically and every write re-reads after it resolves, so a refusal leaves the register exactly as
it was. **Provenance is the authenticated principal** (`recorderId = user?.id`, `:174`) — never a
fixture name, never a form field — which is what **I12** required when it deferred itself here. **The
write controls come from RBAC:** `canWrite = useCan("attendance.write") && recorderId !== null`
(`:175`), and a user without the permission sees the register and **no write control at all** rather
than a disabled one (M2's rule). **Cancelled and locked protection stays domain-owned:** the view
reports the `locked` flag the repository derived from `session.status === "cancelled"` and withdraws
its controls; it never decides lock state itself.

**What did NOT land — deliberately, and each one recorded rather than smoothed over.** The
academy-wide rate, the trend and the per-day chart the fixture view faked were **removed, not
rebuilt**: no percentage, no sparkline, no per-instrument breakdown and no «آخرین حضور» projection,
because the window this view reads cannot support them honestly (**H5**'s ceiling honoured by absence).
No per-student longitudinal history. **No notification of any kind** — nothing messages a teacher, a
student or a guardian (**D1**, **I7**) — and both the register panel and the correction dialog say so
out loud. **No un-record, no edit and no delete** of a mark, and no way to edit or delete a correction:
the model is append-only by contract. **No new repository verb and no new API endpoint appeared
anywhere**, no attendance or scheduling contract changed, no dependency moved, and
`src/domains/attendance/apiRepository.ts` stays **deliberately unregistered** — no server implements
those endpoints, so backend aggregation does not exist and registering the file would turn every call
into a failing request presented as a feature.

**The frozen domain, measured rather than promised.** `git diff --name-only 24caf3a..9505ade --
src/domains/` prints **nothing** — not the model, not `roster.ts`, not `repository.ts`, not
`demoRepository.ts`, not `apiRepository.ts`, not `useAttendance.ts`, not `src/domains/registry.ts`,
not even a README. That is a stronger statement than M4's, whose only domain-path change was a
README. The registry still resolves attendance to the demo implementation in both modes
(`src/domains/registry.ts:209`), and the scheduling ↔ attendance boundary is still the registry's
presence provider (`:223`), reached through its synchronous sibling.

**I13's mitigation, implemented and still not a closure.** `useSessionAttendance` is one of the three
hand-rolled readers **I13** names, and M5 made it reachable in shipped UI **without fixing it** — the
hook was frozen, and the frozen-domain clause was worth more than an unauthorized hook change. So the
view guards the exposure instead: it compares the register it holds against the session it selected
(`attendance.sessionId === selectedSessionId`, `:250`) and withholds the register — showing an
in-flight state — while they disagree, so a crossed frame can neither be rendered nor written against.
Two tests keep the mitigation honest: one case is named for keeping the upstream defect visible rather
than claiming a fix, and another asserts a register that answers for another session is not rendered.
**The hook still does not carry its query key, and its doc comment still claims a guarantee it does not
deliver. I13 stays OPEN.** **I16** stays OPEN for the same reason: this view states its ceilings
(**seven** bounded reads, each with an explicit page size — 200 for sessions, classes, teachers,
students and both record queries, 50 for the correction trail), counts from `total` and announces
truncation, but the
ceilings are unchanged and every other consumer is untouched.

**Tests — 53 new cases in two new view files, three gate suites re-driven, nothing weakened.**
`src/views/__tests__/attendanceNoFixtures.test.ts` (31, structural: no fixture import, no fixture
symbol, no computed percentage, none of the five fabricated figures, no retired narrative, no
hardcoded session id or ISO date, a page size on every bounded read, no verb the repository does not
have, the RBAC gate, I13's defect kept visible) ·
`src/views/__tests__/attendanceWrites.test.tsx` (22, behavioural: the four read states, a truncated
page, a crossed register, a cancelled session, an empty roster, the three writes and their refusals,
the correction trail read back, permission and provenance, the scheduling protection a mark creates,
and a customer's own EMPTY environment). `src/views/__tests__/noSuccessWithoutWrite.test.tsx` was
re-driven from the repository instead of the fixture, growing **11 → 14** cases.
`src/__tests__/writeFeedbackHonesty.test.ts` moved `views/Attendance.tsx` out of `FIXTURE_DRIVEN_VIEWS`
— which now holds Finance and Reports only — into `GRADUATED_VIEWS`, a ratchet asserted in **both**
directions. `src/views/__tests__/emptyEnvironment.test.tsx` changed **labels and comments only**: its
describe block now says two of four surfaces are still fixture-driven, and a comment records why
`attendance` stays in that list — moving it would add the `inFlightMarkers() === 0` expectation this
milestone was not authorized to introduce, a semantic change declined rather than made.
`src/__tests__/architectureBoundaries.test.ts` needed **no** new entry: the three hooks this view calls
were already in `PAGE_SIZE_CALLERS`.

**Measured validation** is in [PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M5 validation": typecheck
clean, build clean in 3.91 s with the pre-existing **I6** chunk warning, `git diff --check` clean, and
**one full-suite run at `9505ade4011b37a34e3488fd51206512829205ec`: 112 files / 1558 tests / 0 failed /
0 skipped** in 116.89 s, with **Group A 211**, **Group D 79** and **52** documentation gates green.
**One full run, not six, and that is the rule rather than a shortcut:** the spec's Tests clause
requires six consecutive runs of a milestone that touches a file which has ever flaked (**I11**), and
M5 touched neither of those two files — the `emptyEnvironment` change is labels and comments, not a
wait. The arithmetic is auditable: `1502 + 53 + 3 = 1558`, `110 + 2 = 112`. This documentation pass
re-ran the full suite after its own edits, at the same product tree, and records the result.

**Mutation checks: three, and they are this milestone's — unlike CP1–CP3, which carry none.** Taken
during the documentation pass, in a **throwaway `git worktree` at `9505ade`**, so no product file in
the working tree was ever altered and `git status --porcelain` stayed empty throughout: reintroducing
a fabricated rate (`faPercent(92)`) into the view fails **2 of 31**; removing the register's
session-identity guard fails **2 of 53** across the two new files; removing the RBAC gate fails **3 of
53**. After every revert both suites ran green at **53/53** and the worktree was removed. **What this
is not:** a per-checkpoint matrix — three guards were mutated, most of the milestone's lines never
were — and no independent reversion check beyond these three.

**Protected areas respected.** The six **Group A** files are untouched and green at **211** tests;
`useDerivedRead.test.tsx` (9, not Group A) is untouched too. The three **Group D** files are untouched
and green at **79**. No seed, no permission map, no hook, no domain file, no dependency, no contract.
The three gate suites this milestone did touch are named in its authorization, and each change is a
re-drive or a ratchet, never a weakening.

**Out of scope, deliberately — and the verbs no shipped surface calls.** Two of attendance's eight
verbs have no UI caller, each for a reason that is a decision: `get` — the register is read for the
derived selected session and a correction targets a row already on screen, so a second read would add a
second copy a write could target after the window moved (the reasoning **D11** records for
scheduling) — and `sessionIdsWithAttendance`, which is the **cross-domain** boundary rather than a UI
read, reached through the registry's presence provider and its synchronous sibling. Scheduling's
`useSessionRoster` **is still unconsumed**: M5 read the attendance domain's own derived register, so
the roster a session really has is rendered from attendance and that scheduling verb **now belongs to
no milestone**. The legacy `attendance` seed collection survives with no reader in the view that owns
it — `src/domains/demo/seed.ts:166` still seeds `todayAttendance` and
`src/domains/demo/backup.ts:242` still reads it so a round-trip stays lossless — and cleaning it up is
**M10**/**D5**, not this milestone's. `src/views/Reports.tsx:143` still renders `attendanceByDay`:
a different view, still fixture-driven, **I2** and M9's.

**What completion does NOT claim — limitations preserved on purpose.** (1) **Browser QA has never
run**: the session picker, the derived register, the bulk-save control, the correction dialog, the
empty and truncated states and every Persian sentence are **jsdom-verified only** (§5 of
[PROJECT_STATE.md](PROJECT_STATE.md)). (2) **No storage round-trip is tested** — the register is
re-read after each write and the correction trail is read back, but no test unmounts and remounts the
view, so "a recorded roster survives a reload" rests on the demo store's
single-persistence-authority code path, exactly as M3's record states for its own surface. (3) **The
spec's Tests clause about the old honest `info` sentence was not carried out literally, and that is
recorded rather than smoothed over:** «ثبت دائمی و اطلاع‌رسانی به مدرس به سرور نیاز دارد» no longer
appears, because a real awaited write now persists locally and the notification half of that sentence
is stated where it belongs — the register panel and the correction dialog each say out loud that no
teacher, student or guardian is notified. The clause's *intent* is honoured and pinned: no success is
reported before a promise resolves, the retracted «همه حاضر ثبت شدند» is a forbidden string, and the
bulk save reports a count of records that exist. (4) **No academy-wide analysis was rebuilt** — the
fabrication was removed and nothing invented in its place. (5) **D8**'s api-mode indicator does not
exist until **M11**. (6) Two inaccuracies in the view's own header comment — it calls the fixture's
registers "nine" where `src/data/records.ts:436` holds eight, and dates the domain "since M1" where it
landed in Phase A at `2acca0a` — are recorded as **L6** and **not fixed**, because a documents-only
pass does not edit product source to tidy a documentation checkpoint.

**Rollback — two boundaries that happen to be the same number, and why that is right.**
- **Spec rollback boundary:** `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` — M4's final documentation
  reconciliation, which is what the convention in
  [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M5 → "Checkpoint & rollback"
  names ("M5's is M4's").
- **Effective safe boundary:** the same commit, and that is not a coincidence. Rolling back to M4's
  implementation checkpoints (`6f54caf46dc13baca78e376c606a4aa9667cdb48` or earlier) would destroy
  M4's acceptance coverage (`df701488362cb90cf32ccefad277879477571cf7`) and its final reconciliation
  (`24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`), both separately authorized and pushed. **Those must
  survive any M5 rollback.**
- So: to abandon M5 and nothing else, return to
  `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`, which drops the single product commit `9505ade` and
  keeps every document and every test M4 left behind. Because M5 changed nothing under `src/domains/`,
  no domain state needs restoring. No history was rewritten, reset or rebased to make these documents
  agree.

**What M5 left M6, and what happened to it — recorded after the fact rather than left as a
prediction.** M5 was *not* authorization for M6; the milestone was authorized separately and has since
landed (see the M6 section above). The pattern M5 handed over — a view over a frozen domain, writing
through the repository, deriving its write target from what is actually loaded, reporting a truncated
page as truncated — was used by M6 and then extended by it in two places where M5's version was not
enough: the composer's **write** state became conversation-keyed (not just reads), and the export
captures its identity **before** the await instead of deriving it at render. Of the four open items
M5 left, M6 closed exactly one **site** and no item: **I15**'s `Messages.tsx` consumer was fixed while
the item stays OPEN with the rest of its register untouched; **I13** was inherited rather than fixed
(the attachment card consumes `useMediaObjectUrl`); **I16** was honoured by construction (every read
M6 added states its page size, and the export *discloses* its ceiling rather than hiding it) and stays
OPEN globally; **I2** (Finance and Reports have no domain layer) was out of M6's scope and is
untouched. `useDerived`'s fixed shape is still landed and still unused — the student-scoped consumers
remain **M7**'s.

---

## Product phase — M6 — contracts without UI (chat management, attachments, export coverage) — ✅ COMPLETE

**Documentation checkpoint (CP0):** **none — and that is recorded, not hidden.** M6's scope was
already accurate in the documents M4's and M5's reconciliations left behind: its section in
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) named the two verbs with zero
callers, the `ChatMessage.mediaId` attachment path over the proven media seam, and export coverage
"only where a real repository read exists". So the milestone went straight to implementation and the
reconciliation happened **after** it — the same accepted ordering M5 used, and no claim was made in
these documents before the evidence existed.

**Implementation checkpoints (four) · all pushed ✅**
- **CP1** `43e7882f051b46abfa9f0530137cedfb3a541ce0` · *feat(m6): chat conversation lifecycle and
  message attachments (contract + domain)* · 5 files, 525 insertions, 7 deletions — the contract
  only: `SendMessageInput.mediaId?: string`; `updateConversation` accepting `archived?: boolean`
  (**archive is reversible, so no unarchive verb was invented**) with `archiveConversation`
  delegating to that one write path; and `sendMessage` refusing a `mediaId` that does not resolve
  (`MESSAGE_INVALID`, `fields.mediaId`) **before** provider delivery and **before** any write, so a
  refusal cannot leave a message or a thread preview behind. **31 new domain tests** (16 lifecycle,
  15 attachment).
- **CP2** `42c54f41ed3099cf65ac4ca035146958a1a51f76` · *M6 · CP2 — conversation management UI +
  composer state safety* · 5 files, 1 217 insertions, 39 deletions — the first UI for verbs that had
  zero callers since Phase A (rename, topic, pin, archive/restore), the archived filter and badge,
  and an **explicit hidden-selection panel** instead of silent retargeting; composer state became
  conversation-keyed (`useComposer`) so a draft cannot follow the operator between threads or be
  resurrected on the way back, and a send that resolves after a switch cannot clear the new draft;
  the message read's `error` is no longer discarded at `Messages.tsx` (**I15** at that site) — a
  failed read is a failure with a retry, never an empty thread. **22 new view tests.**
- **CP3** `563b8d85ee48614963cb3c182ac9b84239645c3d` · *feat(m6): wire chat attachments* · 7 files,
  1 527 insertions, 25 deletions — the real picker, the allow-lists and ceilings **derived from the
  media contract**, `MediaRepository.create` → `ChatRepository.sendMessage` as **two awaited writes
  and one claim**, duplicate-submit protection, release of the stored asset when the message write
  fails, honest missing-bytes/unresolved-reference rendering, and the fixture gate extended to scan
  the whole Messages surface **discovered from its directory**. **30 new tests** (19 attachment, 11
  gate).
- **CP4** `4e03b8762bebcb87e46cf7044af5da99d709b4d2` · *feat(m6): add conversation export* · 4 files,
  1 063 insertions, 1 deletion — a single-conversation plain-text transcript read through the
  **existing** reads (`getConversation` + `listMessages`; **no export verb was added**), downloaded
  only after the read resolved through the export domain's own `downloadBlob`, with attachment
  metadata but **no bytes**, a disclosed 1 000-message ceiling, and identity captured before the
  await so a list that changes cannot retarget it. **23 new tests** (21 export, 2 gate).

**Size (from `git diff --shortstat 9190da0..4e03b87`):** 17 files, 4 321 insertions, 61 deletions —
the chat domain's three implementation files, `src/views/Messages.tsx`, five new files under
`src/views/messages/` and seven test files. **No file under `src/services/`, `src/api/`,
`src/context/`, `src/components/`, the media domain or anywhere else changed**, and no dependency was
added.
**Built on:** `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` — **M5's documentation reconciliation**,
which is therefore M6's **effective safe rollback boundary**: rolling back to it drops M6 entirely and
keeps every document and test M5 left behind.

**Validation.** One full-suite run at `4e03b8762bebcb87e46cf7044af5da99d709b4d2`: **119 files /
1 655 passed / 8 skipped / 1 failed** — the single failure being the known environmental branch-name
case in `projectState.test.ts:299`, proven identical at the pre-M6 base `9190da0`, at CP1 and at CP2
by running the same file on each tree and diffing the per-test outcomes and the normalised failure
block. The suite grew **1 549 → 1 655 (+106)**, monotonic and accounted for checkpoint by checkpoint
(+31, +22, +30, +23); typecheck and `git diff --check` clean at every checkpoint; the CP4 focused and
gate sweep was **278/278 across 21 files**; and **14 mutation checks** were taken, each reverted
byte-identically (MD5-verified) — two at CP1, six at CP3, six at CP4. Full detail is
[PROJECT_STATE.md](PROJECT_STATE.md) §4 → "M6 validation".

**What M6 does *not* claim.** Attachment **ownership and authorization remain backend-required** —
the chat repository checks that a reference *resolves* and nothing more, and no frontend ownership
guarantee is asserted. Attachment **bytes stay browser-local** (the media blob store; a backup carries
metadata and not binaries, which is why "bytes unavailable" is a real state the UI renders honestly)
and **are not in any export**. There is no server persistence, no signed URL, no content scanning and
no delivery beyond `in_app` (`D1`, `I7`); the export is single-conversation with a disclosed ceiling
and no PDF/ZIP/CSV/bulk pipeline; `archiveConversation` stays deliberately unconsumed (`D14`) and the
export deliberately has no verb of its own; **I15 stays OPEN** with its `Messages.tsx` site fixed, its
`OPEN_ITEMS.md` register now stale on that one line (recorded, not silently edited) and the remaining
consumers untouched; **I13 stays OPEN** — the attachment card uses `useMediaObjectUrl`, and while the
exposure is not reachable in this surface (the bubble list is keyed by `message.id`, which never
changes) that is reasoning, not a fix; no storage round-trip test exists; and **browser QA has never
run and is NOT VERIFIED** ([PROJECT_STATE.md](PROJECT_STATE.md) §5) — the file picker and the
download path are exactly what jsdom cannot exercise, which is why the export suite stubs
`URL.createObjectURL` and asserts the artifact's real bytes instead of pretending a download happened.
The milestone registered **two deliberately UI-less capabilities** rather than implying coverage:
`archiveConversation` and the export's use of existing reads. **M6's documentation reconciliation is
this commit**, which is documents plus the chat domain's README — no product source, no test, no
dependency.

**Rollback boundaries.** **Spec:** `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` (the commit M6 was built
on). **Effective safe:** the same commit — nothing before it in the M6 chain is independently
useful, and rolling back past it destroys the milestone while `9190da0` keeps M5 and M4 intact.
No history was rewritten, reset or rebased to make these documents agree.

---

## Documentation checkpoints (pushed, not application phases)

Terminology, matching [PROJECT_STATE.md](PROJECT_STATE.md) §2:

- A **phase checkpoint** is a durable *application* milestone — a reviewed, approved and pushed
  commit that ends a phase of product work.
- A **documentation checkpoint** is a pushed commit that changes documents and validation gates.
  It does not advance the "current phase", and it is recorded here so that `git log` never shows a
  commit this ledger fails to explain.

| Documentation checkpoint | Contents | Product behaviour | Pushed? |
|---|---|---|---|
| `68b4fe339582211c23c422befe527a98203031ef` | The four `docs/engineering/` recovery documents plus their gate `src/__tests__/projectState.test.ts` (29 checks) | none | ✅ |
| `77b019ef07f99817da985e1602dd11365b4b9365` | The 18 audit corrections: checkpoint terminology and the two kinds of checkpoint, a verification rule in place of a hardcoded remote SHA, an accurate account of the (non-existent) in-product recovery path plus the new H5, `npm ci` instead of `npm install`, the boot-chain decision (§18), a README entry point, evidence and wording fixes — and the gate growing from 29 to 45 checks | *labels only*, see below | ✅ |
| `f1fe114b667558bec1ffbc4e7506e3e310ce9735` | The retired test-harness race: `src/views/__tests__/emptyEnvironment.test.tsx` waits for the design system's in-flight marker instead of the view title, so its data-derived assertions measure loaded records rather than a placeholder; the race and one deliberately uninvestigated flake are recorded in I11 — and the gate grew from 45 to 52 checks | none (test code and documents only) | ✅ |
| `b3ffffd2a70e50173c3ccbd2d9c498cd1ed891f1` | The M2.1 validation block in [PROJECT_STATE.md](PROJECT_STATE.md) §4 corrected to the definitive run's measured timings (build 4.12 s, full suite 111.3 s) — no count, conclusion or behaviour changed | none (documents only) | ✅ |
| `9247a17681871c2be39ecf3193c0aded3d0232a0` | M2.1's phase-checkpoint SHA `73b40d9` registered in the ledger, its section, the milestone table and the phase-heading status line, plus PROJECT_STATE §2/§3, the H6/H7 status lines in [OPEN_ITEMS.md](OPEN_ITEMS.md) and DECISIONS §15; the documentation checkpoint advanced to `b3ffffd` | none (documents only) | ✅ |
| `2972a99c447de17af6d3c72d58facb62400bd707` | The **I11 Tier 1** harness fix: `src/domains/learning/__tests__/LearningPanel.test.tsx` waits for the data-derived state instead of a marker's absence, so its assertions measure loaded records; the race's root cause, the contention evidence and the two findings underneath it (I13, I14) recorded in I11 | none (one test file and four documents) | ✅ |
| `ea890ae5a6d5fa2209049637f8f85ed070e26e25` | **I13 Checkpoint 1's** measured validation recorded — 6 consecutive full-suite runs plus 4 contention samples, the reversion checks, the honest `act()` limitation — and M3's I13 gate marked discharged in PROJECT_STATE §9, in this ledger and in the milestone's own dependency bullet | none (documents only) | ✅ |
| `be75ac6f99815700f2a65d026f09ee0c3213f019` | **I13 Checkpoint 2** recorded as authorized and in progress, with the authorized contract written down — a required `AttachContentIntent { programId }` on `attachContent`, resolved independently of the target level, following the `assignPlacement` pattern — *before* any of its code existed | none (documents only) | ✅ |
| `49fb49949feea4bb8c85957a317243d470b20c7a` | **I13 Checkpoint 2** recorded as landed and validated at `bcea26c`: the guard's contract, its adversarial suite, the measured runs, and the caveat that no signature can stop a caller passing the target's own `programId` back as its intent | none (documents only) | ✅ |
| `85530b40c66db63b10769537c2dc6cb24609842d` | **I13 Checkpoint 3A** recorded as landed and validated at `57c1dfb`: `useDerived` carrying its key, the suite that reproduced the crossed frame before the fix, and I13's status bullet stating outright that the item is **not** closed and that I14 is untouched and deferred | none (documents only) | ✅ |
| `df3db2f18718ae0d6d3cf4b13050ea0774833864` | **M3 recorded as in progress** at its first checkpoint: PROJECT_STATE §2–§5 and §9, this ledger's M3 section and rows, **I3** landed-but-not-closed, **I13** with M3 as Checkpoint 2's first real caller, **I14** still deferred, and **D10**/**D11** added to the decision register | none (documents only) | ✅ |
| `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed` | The detach exposure M3's surface introduced, recorded in I13 and in the M3 section rather than hidden: `detachContent` is a single-id write, so no guard can detect a crossed context | none (documents only) | ✅ |
| `1f98228e0b6a5cf289d7d96bb012194fe4d71b3b` | **M3's acceptance-audit findings F2 and F3 recorded:** the rollback boundary corrected to two numbers (the spec's `c42f274` and the effective safe `85530b4`, because rolling back to M2 would destroy M2.1 and the three accepted I13 checkpoints), the six-run evidence recorded, and **M3 marked COMPLETE** across all five documents | none (documents only) | ✅ |
| `eab30d3bfa2476b8d995f7cdb942497afce25238` | F3's correction of its own evidence: the M3-completion row in [PROJECT_STATE.md](PROJECT_STATE.md) §4 quoted F1's diff as "64 insertions / 10 deletions", which was never measured — `git diff --numstat` reports 148/55 and `-w` reports 38/6 in the component, so the row now carries both figures with their commands | none (documents only) | ✅ |
| `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` | **M4's CP0** — the pre-implementation reconciliation of the five `docs/engineering/` documents and `src/domains/scheduling/README.md` against the tree at `7e72887761f07f48e115160611a9785bfaae9060`: the scheduling README's false "not implemented in Phase A" stub and its invented `POST /sessions/{id}/move` / `409 SCHEDULE_VERSION_CONFLICT` contract retired (**L3**), M4's scope restated so it names the frozen files, the two rollback boundaries recorded, and every claim about the scheduling view checked against the code as it stood *before* CP1 | none (documents only — no product source, no test, no dependency, no build) | ✅ |
| `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` | **M4's final reconciliation** — the five `docs/engineering/` documents brought in line with the milestone that had just landed: M4 marked ✅ COMPLETE against its measured evidence (110 files / 1502 tests / 0 failed / 0 skipped at `df701488362cb90cf32ccefad277879477571cf7`), **H1a** closed, **I16**'s calendar mitigation recorded as a mitigation and not as a closure, the two rollback boundaries named, and the scheduling README reconciled again so it describes a **wired** view | none (documents only — no product source, no test, no dependency, no build) | ✅ |
| `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` | **Latest recorded.** **M5's documentation reconciliation** (*docs(m5): correct checkpoint push record*) — M5 registered as ✅ COMPLETE against its measured evidence, the chain's own accounting corrected to what actually happened (a locally committed checkpoint whose first push failed on a stale token, then pushed unchanged as a fast-forward — **no amend, no force-push, no reset, no rebase**), and the M5 documentation checkpoint **lost unpushed** recorded as **L5** happening twice rather than papered over, including the note that the replay re-measured every number on a fresh full clone instead of copying the lost record. It is also the commit **M6 was built on** | none (documents only — no product source, no test, no dependency, no build) | ✅ |

**M6's chain is registered in the M6 section above and in the milestone table**, and is listed here so
that `git log` shows nothing unexplained: four product commits —
`43e7882f051b46abfa9f0530137cedfb3a541ce0` (the chat contract — 5 files, 525/7),
`42c54f41ed3099cf65ac4ca035146958a1a51f76` (conversation management and composer state safety — 5
files, 1217/39), `563b8d85ee48614963cb3c182ac9b84239645c3d` (attachments — 7 files, 1527/25) and
`4e03b8762bebcb87e46cf7044af5da99d709b4d2` (conversation export — 4 files, 1063/1) — followed by its
documentation reconciliation, **this commit** — the **eighteenth** documentation checkpoint, which
cannot be named here for the reason above and must be registered by whichever documentation commit
comes next.

**M5's chain is registered in the M5 section above and in the milestone table**, and is listed here so
that `git log` shows nothing unexplained: one product commit,
`9505ade4011b37a34e3488fd51206512829205ec` (*feat(m5): wire attendance view* — 8 files, 3093/324, no
file under `src/domains/`), followed by its documentation reconciliation
`9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`, which was the commit carrying the entry that first
described it and is **named here now that a later documentation commit can do so** — the
no-self-reference rule working as designed. It does not advance the
phase-checkpoint row, which stays at Phase 2 for the ordering reason recorded in
[PROJECT_STATE.md](PROJECT_STATE.md) §2 — a documentation checkpoint must descend from the phase
checkpoint it is recorded against. `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` is nevertheless M5's
**effective safe rollback boundary**, for the reason in the M5 section above.

⚠️ **One documentation checkpoint for M5 was lost unpushed, and this ledger records the gap rather
than papering over it.** A first reconciliation pass measured, edited and committed all seven
documents, and the workspace was recycled before its push landed — the commit, its clone and a
`git format-patch` backup written outside the clone all ceased to exist, so it is unrecoverable and
`git log` will never show it. The pass recorded here is a **replay**: every number was re-measured from
scratch on a fresh full clone of the pushed tip rather than copied from the lost record, and the three
mutation checks were taken in a throwaway worktree so that no product file was ever altered. The
replayed commit has a different SHA, and no claim of byte-identity with the lost one is made. That is
[OPEN_ITEMS.md](OPEN_ITEMS.md) **L5** happening twice.

**Correction to this entry's own first wording, which said the commit was "committed and pushed in the
same operation".** It was not. The sequence was: committed locally as
`d39793051c6cea61c80e1bba68a97dbf0b4c472c`; the first push **failed** because the environment's GitHub token was no longer valid;
GitHub was reconnected; and the **same** commit was then pushed unchanged as a fast-forward
(`9505ade..d397930`) — with **no amend, no force-push, no reset, no rebase and no second commit**
before the successful push. The rule that wording invoked is unchanged and is still the rule
(`git commit && git push` in one operation, then verify with `git ls-remote`); this entry now records
what happened instead of what was intended, because a ledger that explains every commit has to explain
this one's gap too.

The product-source commits this ledger also has to explain are **not** documentation checkpoints and
are registered in [PROJECT_STATE.md](PROJECT_STATE.md) §3–§4 instead: `289e080` (I13 Checkpoint 1 —
the shared list hook and the six consumers that ignored `loading`), `bcea26c` (I13 Checkpoint 2 — the
`attachContent` intent guard and its adversarial suite), `57c1dfb` (I13 Checkpoint 3A — `useDerived`
carrying its key), `e5b0a57d8f33dc04838670a2cd4158a88dd34022` (**M3's implementation checkpoint**, the assignment surface), `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`
(**M3's completion checkpoint** — the F1 catalogue-error fix and its regression case), and the two
**pre-M4 remediation** commits the owner authorized after M3's acceptance audit:
`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807` (**C1 / I13 Checkpoint 3B** — scheduling's `useDerivedRead`
carrying its query key, with the 9-case suite that reproduced the crossed frame before the fix) and
`7e72887761f07f48e115160611a9785bfaae9060` (**C2** — `useSessions` and `useAttendanceRecords` take
`Paged<…>`, so omitting `per_page` is a compile error, with two mutation-checked boundary cases). The
milestone commits among them
are registered in the milestone table and in the M3 section above.

**M4's own chain is registered in the M4 section above and in the milestone table**, and is listed
here so that `git log` shows nothing unexplained: CP1
`0f875a78c99077e25b67b9cc9cffe34c823ee511` (the reads — 6 files, 1688/262), CP2
`f8c3472895978054c8dc81574bb8a945ef3c326d` (the writes — 5 files, 1898/46), CP3
`6f54caf46dc13baca78e376c606a4aa9667cdb48` (generation — 5 files, 1533/14) and the
acceptance-coverage checkpoint `df701488362cb90cf32ccefad277879477571cf7` (the audit's **B1** and
**B2** — 2 test files, 402/13, no product source). That last commit is **test-only and carries no
document**, so it is neither a documentation checkpoint by the definition above nor a milestone in its
own right: it is the coverage half of M4, registered here and in the M4 section rather than left as an
unexplained `test(…)` commit. None of the four advances the phase-checkpoint row, which stays at Phase
2 for the ordering reason recorded in [PROJECT_STATE.md](PROJECT_STATE.md) §2.
None of them advances the phase checkpoint row, which stays at Phase 2 for the ordering reason
recorded in §2. **`7e72887761f07f48e115160611a9785bfaae9060` is nevertheless the effective safe
rollback boundary for M4** — see the milestone's own "Checkpoint & rollback" field in
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md), and the F2 correction in the M3
section above that established why one number is not enough.

Two rows above — `49fb49949feea4bb8c85957a317243d470b20c7a` and `85530b40c66db63b10769537c2dc6cb24609842d` — were pushed before this ledger recorded them, which is the
self-reference rule working rather than an omission: each documentation checkpoint is registered by a
later commit, because no entry may carry its own SHA. They are registered here now, and the commit
carrying this entry is itself registered by the next one.

The commit that registered the entries above `9247a17` — and `9247a17` itself — are documents-only,
and each is registered by the commit that followed it. The same is true of the **I11 Tier 1 harness
fix** (`2972a99`): it changes
one test file and these documents and no product behaviour, so it is a documentation checkpoint by
the definition above, and it is registered here by `ea890ae`. That gap is the rule working, not
an omission — no entry may carry its own SHA.

**The `77b019ef` pass** holds the one exception to "no product behaviour", and it is a narrow one:
it changed *labels only* on the login credential panel in an EMPTY environment, so a customer's own
environment is no longer announced as a demo and their own bootstrap administrator is no longer
listed as a sample account. No capability was added or removed — the security warning, the visible
passphrase, the account list, one-tap fill and real sign-in all still work — and api mode is
untouched. It is pinned in both directions by `src/views/__tests__/loginEmptyEnvironment.test.tsx`
(8 gates) and recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) H3.

**The pass after it** — `f1fe114b667558bec1ffbc4e7506e3e310ce9735`, test code and documents only, no
product source — did two things. It retired a
harness race inherited from Phase 2: `src/views/__tests__/emptyEnvironment.test.tsx` now waits for
the design system's in-flight marker instead of the view title, so its data-derived assertions
measure loaded records rather than a loading placeholder. And it recorded that race honestly —
together with one *unrelated* flake seen under artificial double contention and deliberately not
investigated — in [OPEN_ITEMS.md](OPEN_ITEMS.md) I11 and [PROJECT_STATE.md](PROJECT_STATE.md) §4,
growing the gate from 45 to 52 checks. It also registered `77b019ef` in the row above, which the
revision of this ledger inside `77b019ef` itself could not do.

**No ledger entry ever carries its own SHA.** A commit cannot contain the SHA of the commit that
carries it, so the newest documentation checkpoint listed here is always the one *before* the commit
you are reading, and `git log --oneline -- docs/engineering` is the authority for anything newer.
[PROJECT_STATE.md](PROJECT_STATE.md) §2 records the same pair and enforces it with a test: every
full SHA quoted in these documents must already exist and be reachable from `HEAD`.
