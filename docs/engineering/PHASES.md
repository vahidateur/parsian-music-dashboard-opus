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
| Product-feature phase — M1 (recovery & lifecycle UX) | `689a7c15951d690b1ce650a5938e6b1216ca30ed` | ✅ yes | **COMPLETE** |
| Product-feature phase — M2 (honest write feedback) | `c42f274ac10d4087f9280e3bf7b47141d0672e32` | ✅ yes | **COMPLETE** |
| Product-feature phase — M2.1 (edit-form draft integrity + the three Settings panels) — *not in the M0 spec; the two items M2 recorded, inserted here by the owner's decision* | `73b40d970816f174b56d37addc21f106a472359b` | ✅ yes | **COMPLETE** |
| Product-feature phase | — | — | remaining milestones M3–M11 ❌ **NOT STARTED** |

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

## Product-feature phase — SPECIFIED (M0); M1, M2 and M2.1 LANDED; M3–M11 NOT STARTED

**Durable SHA:** none for M0 itself — it changes documents only, and a documentation checkpoint is
not a phase (see "Two kinds of checkpoint" below). **Pushed:** n/a. **Status:** spec ✅ landed ·
M1 ✅ landed `689a7c1` · M2 ✅ landed `c42f274` · M2.1 ✅ landed `73b40d9` · M3–M11 ❌ **not
started, not authorized**.

**The authoritative spec is [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md).** It
replaces the informal "intended scope as discussed" that stood here before: every milestone carries
scope, dependencies, protected areas, Demo/API behaviour, tests, acceptance, out-of-scope and a
checkpoint boundary, with `file:line` evidence. The decisions that gate it are recorded in
[DECISIONS.md](DECISIONS.md) §19 as **D1–D9**.

**Milestone order (M0 … M11).**

| Milestone | Closes | Status |
|---|---|---|
| M0 — spec, decision register, ledger entry | the §9 precondition "its spec" | ✅ landed `f2ebc09` (documents only) |
| M1 — recovery & lifecycle UX | **H5** (critical: `clear()` is a one-way door) | ✅ landed `689a7c1` |
| M2 — honest write feedback | **H2** (seven fake-success sites) + **H3** (five mislabels) | ✅ landed `c42f274` |
| M2.1 — *inserted, not in the spec* | **H6** (edit dialogs opened on an empty draft) + **H7** (three Settings panels) — the two items M2 found and recorded | ✅ landed `73b40d9` |
| M3 — learning-content assignment UI | **I3** (UI over an existing, tested contract) | ❌ not started — next |
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

**Precondition to start M1, as it was met** (kept because the rule is the one M3 inherits): explicit
authorization, **D3 and D4 recorded first** (H5's own done-when requires the decision before the
code), a clean tree, and a re-verified baseline — `npm run typecheck`, `npm test`,
`git diff --check` — reported in the shape the spec's §10 requires rather than as a bare number.
Begin from the CRITICAL/HIGH items in [OPEN_ITEMS.md](OPEN_ITEMS.md); the spec sequences them.

**Precondition to start M3** (the next milestone): the same rule, with two differences the spec
states. M3 gates on **no decision** — "Dependencies. None — the contract is complete" — so nothing
has to be recorded before the code. But it **must triage the I11 `LearningPanel` flake first**,
because M3 touches the same domain and the same suites, and a green run there is the precondition
for trusting any new one. M2's findings **H6** and **H7** were triaged before M3 rather than
alongside it, and landed as **M2.1** — see that section below.

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
  evidence stay visible until a real `rescheduleSession` resolves them, the drawer no longer closes
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
only where it can reach a repository, the four fixture-driven views may report none at all, and the
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
| `b3ffffd2a70e50173c3ccbd2d9c498cd1ed891f1` | **Latest recorded.** The M2.1 validation block in [PROJECT_STATE.md](PROJECT_STATE.md) §4 corrected to the definitive run's measured timings (build 4.12 s, full suite 111.3 s) — no count, conclusion or behaviour changed | none (documents only) | ✅ |

The commit that registered those last two entries — M2.1's phase checkpoint `73b40d9` and the
documentation checkpoint `b3ffffd` — is itself documents-only and is registered by the next pushed
commit. That gap is the rule working, not an omission: no entry may carry its own SHA.

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
