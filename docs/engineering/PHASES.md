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
| Baseline (inherited repository) | `292b8b86ce7dd328b3a1510047f994e39c443a4e` | yes (shallow-clone graft boundary) | superseded |
| Phase 1 — library, media, profile/messages regression | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` | ✅ yes | **COMPLETE** |
| Phase 2 — explicit data lifecycle + empty-state audit | `33b10311f0d3a38745b4d0c00f22e4f63665888d` | ✅ yes | **COMPLETE** |
| Product-feature phase — M0 (spec + decision register) | `f2ebc09822d03dde8ce06307221e303721ed9c2e` | ✅ yes | **COMPLETE** (documents only) |
| Product-feature phase M1 — recovery & lifecycle UX | **this commit** — SHA registered by the next one (§ no self-referential SHA) | pushed with this commit | **COMPLETE** |
| Product-feature phase | — | — | remaining milestones M2–M11 ❌ **NOT STARTED** |

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

**Why it matters now.** It is the graft boundary of this shallow clone — history before it is
not present locally. Anything claimed about earlier work must be verified on GitHub.

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

## Product-feature phase — SPECIFIED (M0), IMPLEMENTATION NOT STARTED

**Durable SHA:** none — M0 changes documents only, and a documentation checkpoint is not a phase
(see "Two kinds of checkpoint" below). **Pushed:** n/a. **Status:** spec ✅ landed ·
implementation ❌ **not started, not authorized**.

**The authoritative spec is [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md).** It
replaces the informal "intended scope as discussed" that stood here before: every milestone carries
scope, dependencies, protected areas, Demo/API behaviour, tests, acceptance, out-of-scope and a
checkpoint boundary, with `file:line` evidence. The decisions that gate it are recorded in
[DECISIONS.md](DECISIONS.md) §19 as **D1–D9**.

**Milestone order (M0 … M11).**

| Milestone | Closes | Status |
|---|---|---|
| M0 — spec, decision register, ledger entry | the §9 precondition "its spec" | ✅ landed `f2ebc09` (documents only) |
| M1 — recovery & lifecycle UX | **H5** (critical: `clear()` is a one-way door) | ✅ **landed this commit** |
| M2 — honest write feedback | **H2** (seven fake-success sites) + **H3** (five mislabels) | ❌ not started — next |
| M3 — learning-content assignment UI | **I3** (UI over an existing, tested contract) | ❌ not started |
| M4 — scheduling **view** wiring | **H1a** — Group A domain frozen | ❌ not started |
| M5 — attendance **view** wiring | **H1b** — Group D domain frozen | ❌ not started |
| M6 — contracts without UI | chat rename/pin/archive, attachments, export coverage | ❌ not started |
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

**Precondition to start M1** (unchanged in substance from the rule that was here before): explicit
authorization, **D3 and D4 recorded first** (H5's own done-when requires the decision before the
code), a clean tree, and a re-verified baseline — `npm run typecheck`, `npm test`,
`git diff --check` — reported in the shape the spec's §10 requires rather than as a bare number.
Begin from the CRITICAL/HIGH items in [OPEN_ITEMS.md](OPEN_ITEMS.md); the spec sequences them.

**Rule for whoever lands it:** add its row here with the real SHA, mark it pushed only after
`git ls-remote` confirms it, and update [PROJECT_STATE.md](PROJECT_STATE.md) §2/§3/§9 in the
same commit.

**Not done in this pass, recorded so it is not forgotten:** the documentation-checkpoint table below
still names `77b019ef` as the latest, and the pass after it (the retired test-harness race, the I11
record, the gate growing from 45 to 52 checks) is described in prose without its SHA. Registering it
belongs to the commit that follows, because a ledger entry never carries its own SHA — and because
every 40-hex SHA quoted here must be a real commit reachable from `HEAD`, which
`src/__tests__/projectState.test.ts` enforces. Advancing the two documentation-checkpoint rows in
[PROJECT_STATE.md](PROJECT_STATE.md) §2 belongs in the same edit.

---

## Product phase — M1 — recovery & lifecycle UX (**H5**)

**Commit:** *this commit* — its SHA is registered by the next commit (§ no self-referential SHA),
so `git log --oneline -- src/components/lifecycle docs/engineering` is the authority for it.
**Base:** M0 `f2ebc09822d03dde8ce06307221e303721ed9c2e`. **Pushed** ✅ to
`arena/01a07c61-parsian-music-dashboard-opus`.

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
its own SHA.

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
| `77b019ef07f99817da985e1602dd11365b4b9365` | **Latest recorded.** The 18 audit corrections: checkpoint terminology and the two kinds of checkpoint, a verification rule in place of a hardcoded remote SHA, an accurate account of the (non-existent) in-product recovery path plus the new H5, `npm ci` instead of `npm install`, the boot-chain decision (§18), a README entry point, evidence and wording fixes — and the gate growing from 29 to 45 checks | *labels only*, see below | ✅ |

**The `77b019ef` pass** holds the one exception to "no product behaviour", and it is a narrow one:
it changed *labels only* on the login credential panel in an EMPTY environment, so a customer's own
environment is no longer announced as a demo and their own bootstrap administrator is no longer
listed as a sample account. No capability was added or removed — the security warning, the visible
passphrase, the account list, one-tap fill and real sign-in all still work — and api mode is
untouched. It is pinned in both directions by `src/views/__tests__/loginEmptyEnvironment.test.tsx`
(8 gates) and recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) H3.

**The pass after it** (test and documentation only — no product source) did two things. It retired a
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
