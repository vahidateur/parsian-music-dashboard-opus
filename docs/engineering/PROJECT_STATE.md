# PROJECT STATE — recovery document

> **Read this first.** It is the durable hand-off between agent sessions. Conversation
> memory is not durable; this file, the Git history and the test suite are.
>
> Sibling documents: [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md)
>
> **Last state update: 2026-09-13** — M3 complete and accepted; two **pre-M4 remediation** commits
> landed after it (`fba826f` I13 Checkpoint 3B, `7e72887` C2, the compile-time `per_page`
> guarantee, which is also M4's effective safe rollback boundary); this pass is **M4's CP0
> documentation reconciliation** — documents only, no product source — and **M4 itself has not
> started**.

---

## 1. Identity

| Field | Value |
|---|---|
| Product | **آوا (Ava)** — command centre for a music academy: Persian-first, RTL, private SaaS admin panel |
| Repository | `vahidateur/parsian-music-dashboard-opus` |
| What exists here | **Frontend only.** There is no backend, no database and no server code in this repo |
| Stack | Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · Vitest + React Testing Library · jsdom |
| Primary artifact | Single-page app built to `dist/` (gitignored) |
| Runtime data | DemoStore (localStorage + IndexedDB blobs) or a REST API that does not exist yet |

## 2. Branch and checkpoints

| Field | Value |
|---|---|
| Working branch | `arena/01a07c61-parsian-music-dashboard-opus` |
| **Phase checkpoint (application)** | `33b10311f0d3a38745b4d0c00f22e4f63665888d` — Phase 2, approved and pushed. **Not advanced to M0/M1/M2/M2.1/M3, and the reason is a rule, not an oversight:** `src/__tests__/projectState.test.ts` requires the recorded documentation checkpoint to *descend from* the recorded phase checkpoint, so this row can only move to a milestone once a documentation checkpoint has been pushed after it. The milestones themselves are registered in [PHASES.md](PHASES.md) — M1 is `689a7c15951d690b1ce650a5938e6b1216ca30ed`, M2 is `c42f274ac10d4087f9280e3bf7b47141d0672e32` and M2.1 is `73b40d970816f174b56d37addc21f106a472359b`, M3 was implemented at `e5b0a57d8f33dc04838670a2cd4158a88dd34022` and completed at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`, and two **pre-M4 remediation** commits that are *not* milestones sit after them — `fba826f` (I13 Checkpoint 3B) and `7e72887` (C2, which is also M4's effective safe rollback boundary) — and §3 carries the current phase |
| Previous phase checkpoint | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` — Phase 1, approved and pushed |
| **Documentation checkpoint (pushed)** | `eab30d3bfa2476b8d995f7cdb942497afce25238` — F3's correction of its own recorded evidence: the M3-completion row in §4 quoted F1's diff as "64 insertions / 10 deletions", which was never measured, so it now carries the measured `--numstat` (148/55) and `-w` (38/6) figures with their commands; documents only, no behaviour |
| Previous documentation checkpoint | `1f98228e0b6a5cf289d7d96bb012194fe4d71b3b` — M3's acceptance-audit findings **F2** and **F3** recorded (the rollback boundary corrected to two numbers, the six-run evidence, M3 marked complete); documents only |
| Baseline commit | `292b8b86ce7dd328b3a1510047f994e39c443a4e` (shallow-clone graft boundary) |
| Remote state | **Deliberately not recorded as a value — verify it instead:** `git ls-remote origin refs/heads/<branch>` must return local `HEAD`, or an ancestor of it. Anything else means someone else pushed, or this clone is stale |

### Two kinds of checkpoint

- A **phase checkpoint** is a durable *application* milestone: a reviewed, approved and pushed
  commit that ends a phase of product work. The row above names the latest one the
  documentation-checkpoint ordering rule permits — still `33b1031` (Phase 2) — while the product
  phase's own milestones (M0 `f2ebc09`, M1 `689a7c1`, M2 `c42f274`, M2.1 `73b40d9` and M3,
  implemented at `e5b0a57` and completed at `3bec881`) are registered in
  [PHASES.md](PHASES.md) and named in §3. Only a phase checkpoint advances "current
  phase" in §3.
- A **documentation checkpoint** is a pushed commit that changes documents and validation gates
  but no product behaviour. Fourteen exist so far: `68b4fe3` (these documents and their gate),
  `77b019ef` (the audit-correction pass, which also made the EMPTY login screen's *labels*
  truthful — the one permitted exception, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) H3),
  `f1fe114` (the retired test-harness race, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I11),
  `b3ffffd` (the M2.1 validation block's measured timings),
  `9247a17` (M2.1's SHA registered in the ledger),
  `2972a99` (the I11 `LearningPanel` harness fix — one test file and four documents),
  `ea890ae` (I13 Checkpoint 1's validation recorded, M3's gate discharged),
  `be75ac6` (I13 Checkpoint 2 recorded as in progress before its code existed),
  `49fb499` (I13 Checkpoint 2 recorded as landed and validated),
  `85530b4` (I13 Checkpoint 3A recorded as landed and validated),
  `df3db2f` (M3 recorded as in progress at its first checkpoint) and
  `db5ec24` (the detach exposure M3 introduced, recorded rather than hidden),
  `1f98228` (M3's audit findings F2 and F3 recorded, M3 marked complete) and
  `eab30d3` (F3's recorded diff scope corrected to the measured numbers). They
  are listed in [PHASES.md](PHASES.md) → "Documentation checkpoints" so that `git log` never shows a
  commit this ledger does not explain.

**No self-referential SHAs.** A document cannot contain the SHA of the commit that carries it —
that SHA does not exist until the commit is made. So the documentation checkpoint above is always
the *previous* pushed docs commit, and `git log -- docs/engineering` is the authority for anything
newer. `src/__tests__/projectState.test.ts` enforces the testable form of the rule: every full SHA
quoted in these documents must already exist as a commit and be reachable from `HEAD`, so a pasted
future SHA or an invented one fails the suite instead of misleading the next reader.

⚠️ **This clone is shallow** (`292b8b8` is grafted). At the time of the Phase 2 audit only three
commits were reachable locally; that count grows as work lands, but history *before* the graft
never becomes reachable — read it on GitHub rather than assuming it locally. The clone's fetch
refspec is limited to `main`, so `refs/remotes/origin/arena/…` can be missing even after a
successful push: verify the remote with `git ls-remote origin refs/heads/<branch>`, not with
`git rev-parse refs/remotes/origin/…`.

⚠️ **Unpushed commits are NOT durable in this environment.** Observed on 2026-09-08: the
sandbox workspace was **re-cloned** between turns. The local branch pointer reverted to the
shallow graft `292b8b8`, the reflog collapsed to two entries (`clone`, `checkout`), and a
local-only commit created earlier that day stopped existing as a Git object
(`git cat-file -e <sha>` → `fatal: bad object`). Its **content survived on disk** and was
recovered in full, but its SHA could not be reproduced. Consequences for any session:

- Treat a commit that has not been pushed as **provisional**, never as a checkpoint.
- Verify a recorded SHA still exists locally (`git cat-file -e <sha>^{commit}`) before relying
  on it; verify the remote independently with `git ls-remote`.
- If HEAD disagrees with this document, the working tree is usually still intact: compare it
  against the last pushed checkpoint (`git diff <checkpoint> --stat`) and hash the changed and
  untracked files **before** touching anything. Recovery is a non-destructive
  `git reset --mixed <checkpoint>` — which moves the branch pointer and index only, never the
  files — followed by re-verification that every hash is unchanged.
- Push approved checkpoints promptly.
- **Commit identity and trailer are environment-provided, not versioned.** Commits carry the Git
  identity configured in the clone, and a `commit-msg` hook in `.git/hooks` (which is *not* part of
  the repository) appends a `Co-authored-by: arena-agent …` trailer. After a re-clone that hook may
  be absent, so a missing trailer is cosmetic — never a reason to amend a pushed commit.

## 3. Current phase and status

| Field | Value |
|---|---|
| Current phase | **Product-feature phase — M3 (learning-content assignment UI, I3 — UI only)** |
| Phase status | ✅ **COMPLETE** — implemented at `e5b0a57d8f33dc04838670a2cd4158a88dd34022` on top of I13 Checkpoint 3A (`57c1dfb8967a60990021ac9fe59c6ab80045fca3`, recorded by `85530b40c66db63b10769537c2dc6cb24609842d`), documented at `df3db2f18718ae0d6d3cf4b13050ea0774833864` and `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed`, put through a formal acceptance audit, and **completed at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`** (the audit's one product finding, F1). All pushed. **Accepted with recorded limitations** — see §3 → "Last completed work (M3…)" and [OPEN_ITEMS.md](OPEN_ITEMS.md) I13/I15/I16/I17 — and **browser QA is NOT VERIFIED** (§5) |
| Next phase | Product-feature phase — **M4 (scheduling view wiring, H1a)** — ❌ **NOT STARTED**, not authorized |
| Working tree | Clean at every recorded checkpoint — **verify, do not trust**: `git status --porcelain` must print nothing |

M0 (`f2ebc09`, spec + decision register, documents only), M1 (`689a7c1`, the recovery UX), M2
(`c42f274`, honest write feedback), M2.1 (`73b40d9`, the two defects M2 found and recorded
rather than fixed) and **M3** (implemented at `e5b0a57`, completed at `3bec881` — the
learning-content assignment UI) are the product phase's completed milestones. M3's surface, its
wiring and its 16 tests are pushed, it went through a formal acceptance audit and it was **accepted
with recorded limitations**; what is *not* true of it — or of any milestone — is browser QA, which
§5 records as NOT VERIFIED for every milestone alike. **M2.1 is not in the M0
specification:** it is **H6** and **H7** from [OPEN_ITEMS.md](OPEN_ITEMS.md), inserted between M2 and
M3 by the owner's explicit decision after a read-only triage, and the spec's M0–M11 sequence is
unchanged by it. **After M3, two pre-M4 remediation commits landed** at the owner's explicit
authorization following that audit — `fba826f` (**C1 / I13 Checkpoint 3B**, scheduling's
`useDerivedRead` carrying its query key) and `7e72887` (**C2**, `useSessions` and
`useAttendanceRecords` taking `Paged<…>` so omitting `per_page` is a compile error). **Neither is a
milestone** and neither advances a row above; both were done *ahead of* M4 rather than inside it, and
`7e72887` is M4's effective safe rollback boundary. **M4 itself has not started**: its CP0
documentation reconciliation changes documents only and no product source. M4–M11 have
not started; the ledger in [PHASES.md](PHASES.md) marks the product-feature phase's remaining
milestones NOT STARTED.

### Last completed work (Phase 2, in one paragraph)

Demo seeding was removed from every read path and replaced by an explicit, persisted
lifecycle owned by `src/domains/demo/lifecycle.ts`: `UNINITIALIZED → { EMPTY | DEMO }`,
chosen once by the visitor through `src/components/lifecycle/FirstRunChooser.tsx` behind
`src/components/lifecycle/DataLifecycleGate.tsx`. The marker lives in `ava:demo:lifecycle`
(`src/services/demoStore.ts`). EMPTY is a first-class, usable environment (zero content
records plus one bootstrap admin); DEMO is an explicit showcase/QA environment and the only
place demo media (`res1` / `md_demo_res1`) exists. Legacy marker-less datasets are adopted
as DEMO once, preserving every record. Reads never write. An empty-state audit of all 16
surfaces fixed three real `NaN` bugs and one lying hint at the computation boundary
(`src/lib/stats.ts`, `src/lib/format.ts`, `src/views/Classes.tsx`, `src/views/Teachers.tsx`)
and removed demo labelling from a customer EMPTY environment
(`src/components/settings/DemoDataPanel.tsx`).

### Last completed work (M1, in one paragraph)

`clear()` empties every collection including `users`, so it can lock a customer out of an
environment whose Settings (and therefore backup restore) sit behind the login. M1 adds a way back
**without changing `clear()`**. `uninitializeEnvironment()` (`src/domains/demo/lifecycle.ts`,
unchanged) is now reachable through the existing destructive-action seam:
`src/domains/demo/useDemoData.ts` adds `"uninitialize"` to `DestructiveAction`/`DESTRUCTIVE_LABELS`
and awaits `manager.uninitialize({ confirm: true })`. `src/components/lifecycle/DataLifecycleGate.tsx`
owns the recovery controller and publishes it through
`src/components/lifecycle/LifecycleRecoveryContext.ts`, wrapping both gate branches so the awaited
blob-cleanup result survives the store reset that returns the boot chain to
`src/components/lifecycle/FirstRunChooser.tsx`. The visible affordance
(`src/components/lifecycle/LifecycleRecoveryPanel.tsx`) renders only from the unauthenticated
`src/views/Login.tsx` branch, only for a local `empty`/`demo` environment, never in `api` mode; it
is two-step, shows `manager.stats()` counts, and warns truthfully about account deletion, lockout,
stored binaries and irreversibility. A blob-store failure is surfaced verbatim, never swallowed. D3
and D4 are recorded in [DECISIONS.md](DECISIONS.md) §19 as M1-specific decisions; **H5** in
[OPEN_ITEMS.md](OPEN_ITEMS.md) is landed and I10's zero-record invariant is preserved (no bootstrap
account is re-added to a cleared dataset).

### Last completed work (M2, in one paragraph)

The panel stopped claiming things it did not do. Seven controls reported a write or a delivery that
never happened (**H2**): two scheduling conflict buttons announcing a room transfer — one of them
also announcing that a teacher and a student had been notified, and closing the drawer that held the
evidence — an attendance "mark all present" saying «ثبت شدند» for a React state change, an absentee
"follow-up" saying a student **and their guardian** had been messaged, two finance reminders
announcing an SMS and an invented queue, and a class-waitlist button announcing a suggestion filed
with scheduling. None of these views can write, so none could become an awaited repository call:
each now reports honestly in `info`, performs the one truthful action available (the waitlist button
opens the schedule), or is **removed** — removed rather than disabled, on the owner's explicit
decision, because a disabled control still advertises a capability the product does not have. Five
confirmations of *real* writes (**H3**) called the saved record demo data in every environment; they
now take their wording from `useIsDemoEnvironment()`, so a customer's EMPTY environment reads
«تغییرات در داده‌ها ذخیره شد.» while DEMO keeps saying «…دادهٔ دمو…», and `src/views/Students.tsx` —
which carried two copies of that literal, one per dialog mount — has a single shared confirmation.
Nothing else moved: no domain, repository, hook, fixture, lifecycle file or dependency changed, demo
and `api` mode behave identically, and every site on H2's verified "not fake" list is untouched,
including the attendance «ثبت نهایی» toast that M2 read as arguably still dishonest and left alone by
decision (**I12**). Three findings the work surfaced were **recorded rather than fixed**, because
M2's scope was approved before they were found: **H6** (every edit dialog opens with an empty draft,
so a partial save silently overwrites the stored record), **H7** (three Settings panels carry the
identical demo mislabel) and **I12**. All three are in [OPEN_ITEMS.md](OPEN_ITEMS.md) with evidence,
and H7 is ratcheted by `src/__tests__/writeFeedbackHonesty.test.ts` so the set of offenders can only
shrink.

### Last completed work (M2.1, in one paragraph)

The two defects M2 recorded instead of fixing are fixed. **H6** was silent, durable data loss:
`useEntityForm` seeded its draft with `useState(initial)` and nothing ever re-synced it, the six edit
dialogs stay mounted while closed, and no parent keyed them by record — so a dialog opened on record
B still held the empty create defaults, or whatever had been typed for record A before a cancel, and
submitting wrote that onto B's id. Because `demoStore`'s update is a spread merge and its `clone` is
`structuredClone`, an explicit `undefined` in the payload *erased* the stored field: a student's
photo and guardian, a teacher's biography, a piece's programme link. The defaults were the dangerous
part — «piano», «active», «17:00», capacity 6 all look like data — and two of them reversed
documented rules, since an edit silently re-activated a deactivated instrument, room or piece and
silently un-archived a class. The fix sits at the hook boundary: `EntityFormOptions` gained `open`,
the draft is rebuilt from the newest `initial` whenever the surface opens, and the six dialogs pass
the prop they already had. **H7** was the identical mislabel M2 removed from the five domain
surfaces, in the three Settings panels that audit did not enumerate (`InstrumentsPanel`,
`RepertoirePanel`, `RoomsPanel`); each now derives its confirmation from `useIsDemoEnvironment()`
exactly as `BrandingPanel` does, so the `writeFeedbackHonesty` ratchet's tracked debt is **empty**
and the three panels joined the list of surfaces pinned as deriving their copy. Nothing else moved:
no repository, store or merge semantics, no domain model, no fixture, no dependency — and the two
dialogs that were already correct (`AssignPieceDialog` and `RecordProgressDialog`, which their panel
mounts conditionally) were deliberately left alone.

### Last completed work (M3, in one paragraph)

**M3 is the learning-content assignment UI, and its gap was a UI and workflow gap, not a schema
one.** `LevelContentLink`, `listLinks` / `attachContent` / `detachContent`, link ordering and the
`CONTENT_ALREADY_LINKED` conflict already existed, were already tested, and were called by nothing
but tests — the recorded **I3**. At `e5b0a57` the contract has a surface:
`src/domains/learning/LevelContentPanel.tsx` (new) lists the content a level really links, offers
the active catalogue minus what is already linked, and writes through the repository verbs;
`src/domains/learning/LearningPanel.tsx` gained a per-level «منابع» toggle (+66 lines, no deletions)
that opens it, with the surface rendered **outside** the levels column so its content rows can never
be counted as levels by the protected harness. There is no second source of truth: the list under a
write refreshes from `demoStore`'s data-version bump, the picker's offers are derived from the
repository's rows, the pick itself is derived from *this* level's rows so a choice made for another
level collapses instead of becoming a write target, and the selection is dropped when the program
changes. **The write invariant is honoured where it lives — the wiring:** `levelId` comes from the
rendered row while `AttachContentIntent.programId` comes from the programs query the panel selected,
never from `level.programId`. Because those two can disagree (`useResourceList` commits a frame
holding the previous program's levels on a switch — **I11**/**I13**), the adversarial case reproduces
that crossed page at the repository boundary and asserts both halves: the repository was handed the
independent program, and it therefore refused the write. Mutating the wiring to
`contentLevel.programId` — the exact shape I13 Checkpoint 2's caveat warned about — turns that case
red, so the invariant is pinned by a test that fails without it. **What did not move:** no schema,
model, repository, fixture, dependency or router change; the three files M3's spec protects
(`LearningPanel.test.tsx`, `StudentLearningPanel.test.tsx`, `demoRepository.test.ts`) are untouched
and green; and the spec's *optional* student-scoped read was deliberately **not** added, so I13
Checkpoint 3A's `useDerived` fix is landed but has no M3 consumer — recorded as unused rather than
claimed as a dependency satisfied. **What M3 then went through.** A formal **acceptance audit** at `db5ec24` enumerated every clause of
the spec's M3 section and answered each one PASS / PARTIAL / FAIL / NOT VERIFIABLE against
file-and-line evidence. It found one product defect (**F1**: the picker's catalogue read discarded
`error`, so a failed catalogue rendered as «منبعی برای اتصال باقی نمانده» — a false empty), one
documentation contradiction (**F2**: this ledger named M3's *own* checkpoint as its rollback
boundary, where the spec names the predecessor) and one evidence shortfall (**F3**: the recorded
validation claimed three consecutive full-suite runs where the spec's Tests clause requires six for a
milestone touching a file that has ever flaked). **All three are resolved:** F1 at `3bec881` with a
regression case and a reversion check; F2 in [PHASES.md](PHASES.md) → "Product phase — M3", which now
records **both** boundaries — the spec's `c42f274` (M2) and the effective safe one, `85530b4`, because
rolling back to M2 would destroy M2.1 and the three accepted I13 checkpoints; F3 in §4 below.
**M3 is COMPLETE, accepted with recorded limitations**, and **browser QA has never run** (§5). What
completion does *not* claim: the detach stale-context exposure (**I13**, still open), the
`per_page: 200` ceilings (**I16**), the fourteen other consumers that discard `error` (**I15**),
link order being invisible to the operator (**I17**), the absent storage round-trip test, and D8's
api-mode indicator, which does not exist until **M11**.

### Work landed since the Phase 2 checkpoint

Three documentation checkpoints first — documents, validation gates, one labelling fix and one
test-harness fix, **no product feature work**:

1. The four `docs/engineering/` recovery documents and their gate
   (`src/__tests__/projectState.test.ts`).
2. After a read-only audit of those documents: truthful environment labels on the login
   credential panel in an EMPTY environment (`src/views/Login.tsx` takes its wording from
   `useIsDemoEnvironment()`), pinned by `src/views/__tests__/loginEmptyEnvironment.test.tsx`.
   Capability is unchanged — the bootstrap account is still offered and still signs in.
3. A test-harness race inherited from Phase 2, fixed at its own boundary:
   `src/views/__tests__/emptyEnvironment.test.tsx` waited only for the view *title*, so it could
   return while the view still showed its loading placeholder and then assert against that. It now
   waits for the design system's in-flight marker to disappear. Test code only — no product source
   touched, no assertion weakened or removed. Recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I11.

Product work since those three is the product phase itself, described above and ledgered in
[PHASES.md](PHASES.md): M0 `f2ebc09` (specification and decision register — documents only), M1
`689a7c1` (recovery and lifecycle UX), M2 `c42f274` (honest write feedback), M2.1 `73b40d9`
(the two defects M2 found and recorded: edit-form draft integrity and the three Settings panels) and
M3 — implemented at `e5b0a57`, completed at `3bec881` (the learning-content assignment UI, described
above).

Fourteen further commits landed outside that milestone sequence and are registered here so that
`git log` shows nothing this ledger does not explain. Nine of them are **documentation
checkpoints** by the definition in §2 and are listed in [PHASES.md](PHASES.md): `2972a99` (closing
**I11** — one test file and four documents, no product behaviour), `ea890ae` (I13 Checkpoint 1's
measured validation recorded and M3's gate discharged), `be75ac6` (I13 Checkpoint 2 recorded as
authorized and in progress *before* its code was written), `49fb499` (I13 Checkpoint 2 recorded as
landed and validated), `85530b4` (I13 Checkpoint 3A recorded as landed and validated), `df3db2f` (M3
recorded as in progress at its first checkpoint), `db5ec24` (the detach exposure M3 introduced),
`1f98228` (M3's acceptance-audit findings **F2** and **F3** recorded — the two-number rollback
boundary, the six-run evidence — and M3 marked complete) and `eab30d3` (F3's correction of its own
recorded diff scope to the measured numbers).
Each was registered by a later commit, because no entry may carry its own SHA. The other five are **product source**, so they are neither
milestones nor documentation checkpoints and they advance no row above: `289e080` is **I13
Checkpoint 1** — the shared list hook plus the six consumers that ignored `loading`, with three new
test files, and the commit that discharged M3's I13 gate (§9); `bcea26c` is **I13 Checkpoint 2** —
the `attachContent` intent guard, with its adversarial suite; `57c1dfb` is **I13 Checkpoint 3A** —
`useDerived` carrying its key so a student switch cannot expose the previous student's placement or
eligible content, with the suite that reproduced the frame before the fix; `fba826f` is **I13
Checkpoint 3B** — scheduling's `useDerivedRead` carrying its key, the first of the two **pre-M4
remediation** commits the owner authorized after M3's acceptance audit, landed because M4 is what
makes its three readers reachable in shipped UI; and `7e72887` is **C2** — `useSessions` and
`useAttendanceRecords` take `Paged<…>`, so omitting `per_page` is a compile error rather than a
review habit — which is also **M4's effective safe rollback boundary** (the M4 milestone's
**Checkpoint & rollback** field in [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md)).
All five are recorded in
[OPEN_ITEMS.md](OPEN_ITEMS.md) I13/I16 and in §7 item 12.

The commits themselves are listed in [PHASES.md](PHASES.md) → "Documentation checkpoints"; this
file never records the SHA of the commit carrying the edit (§2).

## 4. Validation status

### M3 validation (measured at the implementation checkpoint `e5b0a57`, on top of I13 Checkpoint 3A `85530b4`)

The rows below are what was measured when M3's code landed. **Two of them are superseded for M3's
authoritative record** — the full-suite row (**F3**, below) and the mutation row — and the table that
follows, *"M3 completion validation"*, is the record M3 was accepted against. Both are kept, labelled
by checkpoint, so the history of the evidence is auditable rather than rewritten.

| Check | Result |
|---|---|
| Dependencies | ✅ none added, removed or changed — `package.json` and `package-lock.json` are untouched by the diff, so `npm ci` was not re-run this pass (`npm install` is never run, in CI or locally) |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm run build` | ✅ exit 0, `built in 3.10s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| `npm test` (full suite) | ⚠️ **superseded — see the correction note under this table.** As originally recorded: 104 files / 1423 passed / 0 failed / 0 skipped with `dist/` present so the CSP gates ran, over **3 consecutive full runs**, each 98–100 s. Three is below the six the spec's Tests clause requires of a milestone touching `LearningPanel.test.tsx`, a file that has flaked (**I11**), and this row was being quoted as the milestone's evidence — which is why the acceptance audit raised **F3**. Six-run evidence now exists twice over, at two checkpoints, in the table below; **this row is no longer authoritative and must not be quoted as M3's run evidence** |
| Targeted repeats | ✅ **6 consecutive runs** of the learning domain plus `staleQueryGates`, `emptyEnvironmentPanels` and `projectState`: **11 files / 160 tests** green on every run, no run retried (11 files / 161 tests after F1 added one case — see below) |
| Baseline before any M3 edit | ✅ measured in a `git worktree` of `85530b4` with `dist/` built and `node_modules` linked: **102 files / 1407 tests — 1406 passed / 0 skipped / 1 failed**. The single failure is `projectState.test.ts`'s "the recorded working branch is the branch actually checked out", which fails by construction in a detached worktree, not because of the code. The arithmetic is auditable: `1407 + 11 (LevelContentPanel) + 5 (contentAssignmentFlow) = 1423` and `102 + 2 = 104` |
| Mutation checks on the new tests | ✅ four independent mutations on the implementation checkpoint, each reverted byte-exactly from a backup and the file re-verified against it (`diff -q`). **A fifth — F1's reversion check — is recorded in the table below.** (1) `programId={selected.id}` → `programId={contentLevel.programId}` — the forbidden shape — fails **only** the adversarial crossing case. (2) Removing the selection-drop effect fails **only** the program-switch case. (3) Storing the pick raw instead of deriving it from this level's rows fails **only** the level-switch case. (4) Removing the in-flight state, so an empty level is shown while the read is pending, fails the in-flight case and the level-switch case. Every other case stayed green under each mutation, which is the evidence that the new tests detect the defects instead of restating the code |
| Protected suites | ✅ unchanged and green: `LearningPanel.test.tsx` (11), `StudentLearningPanel.test.tsx`, `demoRepository.test.ts`, `architectureBoundaries.test.ts`, `privacyPosture.test.ts`, `projectState.test.ts`, `writeFeedbackHonesty.test.ts`, `noSuccessWithoutWrite.test.tsx`, `emptyEnvironment.test.tsx`, `emptyEnvironmentPanels.test.tsx`, `staleQueryGates.test.tsx` and every Group A / Group D domain suite |
| Scope of the diff | ✅ `git diff 85530b4..e5b0a57 --numstat` = 5 files, **1414 insertions and 0 deletions** — one new component, one edited component, two new test files, one extracted test helper (`src/test/repositoryStubs.ts`). Zero deletions is the check that nothing was weakened, skipped, re-timed or removed. `git diff --check` clean |
| Browser QA | ❌ NOT VERIFIED (§5) — unchanged for every milestone, including this one |

The M3 workspace is the same fresh clone of the branch used for I13 (`/home/user/i13-work`), verified
before the first edit at `85530b40c66db63b10769537c2dc6cb24609842d` with a clean
`git status --porcelain`. The sandbox clone at `/home/user/parsian-music-dashboard-opus` remains
stale at the `292b8b8` graft and was left untouched, as instructed.

### M3 completion validation (the record M3 was accepted against — measured at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`)

This is **M3's authoritative evidence**: measured after the acceptance audit's one product fix (F1)
landed, on the branch `arena/01a07c61-parsian-music-dashboard-opus`, tree clean, with `dist/` present
so nothing skipped for want of a build artifact.

| Check | Result |
|---|---|
| `npm test` (full suite) — **F3, corrected** | ✅ **6 consecutive full-suite runs at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`: 104 files / 1424 passed / 0 failed / 0 skipped on every run**, with `LearningPanel.test.tsx` **11/11 on every run** (1907, 1921, 1928, 1938, 2083 and 2117 ms). No run retried, no test skipped, no assertion weakened |
| `npm test` (full suite) — as measured by the acceptance audit | ✅ **6 consecutive full-suite runs at `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed`: 104 files / 1423 passed / 0 failed / 0 skipped**, with `LearningPanel.test.tsx` 11/11 every run (1927–2086 ms). The arithmetic between the two records is `1423 + 1 = 1424`: F1 added exactly one case and nothing else |
| Focused suites | ✅ learning domain + `staleQueryGates` + `emptyEnvironmentPanels` + `projectState`: **11 files / 161 tests** green; `LevelContentPanel.test.tsx` **12/12** |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm run build` | ✅ exit 0, `built in 2.88s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| F1 reversion check (the fifth mutation) | ✅ the pre-fix component was restored from `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed` and the suite re-run: **1 failed / 11 passed**, the new case failing on its *first* assertion — that the false-empty copy «منبعی برای اتصال باقی نمانده» is absent — and reporting the offending `<option>` element. The fix was then restored byte-identical (`diff -q`) and all 12 passed again. So the case pins the fix rather than restating the code |
| Scope of F1's diff | ✅ `git diff db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed..3bec8811adaa65dd3c1b50c1125cc8c24dd9adad --numstat` = **2 files, 148 insertions / 55 deletions**: `src/domains/learning/LevelContentPanel.tsx` 87/55 and `src/domains/learning/__tests__/LevelContentPanel.test.tsx` 61/0. Nearly all of the component's churn is the re-indentation of the block the fix wrapped — with `-w` the same diff is **38 insertions / 6 deletions** in the component — and the test file's deletions are zero, so no case was weakened, re-timed or removed. No contract, schema, dependency or protected test touched; `attachContent` and `detachContent` unchanged |
| `git diff --check` | ✅ clean across the whole of M3 (`85530b40c66db63b10769537c2dc6cb24609842d..3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`) |
| Documentation gates | ✅ **52 passed**, including the six-run evidence rule ("Only repeated runs may be reported as green"), the rollback-boundary rule and the requirement that every recorded checkpoint exist in Git and descend from the current phase |
| Browser QA | ❌ **NOT VERIFIED** (§5) — unchanged, and **not** discharged by M3's completion |

**F2, the rollback correction, is recorded in [PHASES.md](PHASES.md) → "Product phase — M3":** the
spec's boundary is `c42f274ac10d4087f9280e3bf7b47141d0672e32` (**M2**), the effective safe boundary is `85530b40c66db63b10769537c2dc6cb24609842d`, and
`289e080`, `bcea26c` and `57c1dfb` — accepted work between them — **must survive any M3 rollback**.
No history was rewritten, reset or rebased to make the documents agree.

### Pre-M4 remediation validation (measured at `7e72887761f07f48e115160611a9785bfaae9060`, the tree that contains both remediation commits)

Two commits landed after M3's completion and before M4, at the owner's explicit authorization
following M3's acceptance audit: **C1 / I13 Checkpoint 3B**
(`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`) and **C2** (`7e72887761f07f48e115160611a9785bfaae9060`).
**Neither is a milestone**; their substance is recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I13
(Checkpoint 3B) and I16 (what C2 changed), and this table keeps the run evidence in one place so §3's
ledger and the [PHASES.md](PHASES.md) rows agree with it. The six-run evidence is measured on the tree
that contains **both** commits, not on `fba826f` alone — recorded that way rather than claimed
per commit.

| Check | Result |
|---|---|
| Dependencies | ✅ none added, removed or changed — `package.json` and `package-lock.json` are untouched by both diffs, so the dependency set these runs measured against is the one M3 was accepted on, installed by `npm ci` from that lockfile (`npm install` is never run, in CI or locally) |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) — which is part of C2's evidence rather than a formality: with `useSessions` and `useAttendanceRecords` taking `Paged<…>`, an omitted `per_page` fails here instead of in review |
| `npm run build` | ✅ exit 0; the pre-existing warning is unchanged — main chunk > 500 kB, no code-splitting (**I6**) |
| `npm test` (full suite) | ✅ **6 consecutive full-suite runs at `7e72887761f07f48e115160611a9785bfaae9060`: 105 files / 1435 passed / 0 failed / 0 skipped on every run**, with `dist/` built so the CSP gates ran instead of skipping, and `git diff --check` clean. The arithmetic against M3's completion record is auditable: `1424 + 9` (the new `useDerivedRead` suite) `+ 2` (C2's two architecture-boundary cases) `= 1435`, and `104 + 1 = 105` files — one new test file, and no existing file's cases removed, re-timed or weakened |
| Group A (protected) | ✅ untouched and green — the six pre-existing files in `src/domains/scheduling/__tests__/` (**211** tests, `useScheduling.test.tsx` 14/14) are unchanged by both commits; the only file added to that directory is the new 9-case suite, which is **not** Group A |
| Views (protected) | ✅ `src/views/Scheduling.tsx` and `src/views/Attendance.tsx` are untouched by both commits — the remediation hardened the *hooks*, not the views, which is exactly why **H1 stays OPEN** |
| Reversion / mutation checks | ✅ C1: restoring the pre-fix `useDerivedRead` from `HEAD` fails **4 of the 9** new cases on *identity* and no others, and the fix was then restored byte-identically. C2: both new cases in `src/__tests__/architectureBoundaries.test.ts` are recorded as mutation-checked in I16 |
| Scope of the diffs | ✅ C1 = 2 files, **669 insertions / 15 deletions** (the new suite 587/0, `src/domains/scheduling/useScheduling.ts` 82/15); C2 = 3 files, **135 insertions / 15 deletions** (`src/__tests__/architectureBoundaries.test.ts` 96/2, `src/domains/attendance/useAttendance.ts` 17/6, `useScheduling.ts` 22/7). Combined product source = 4 files, **804 / 30**. The only pre-existing test file either commit edited is `architectureBoundaries.test.ts`, which is not Group A and not a protected milestone suite |
| Documents | ✅ the two documentation checkpoints between M3's completion and C1 carry no product source: `1f98228e0b6a5cf289d7d96bb012194fe4d71b3b` (369/87 across the five `docs/engineering/` files) and `eab30d3bfa2476b8d995f7cdb942497afce25238` (1/1, one corrected row in §4) |
| Browser QA | ❌ NOT VERIFIED (§5) — unchanged for every milestone, and unchanged by this remediation |

**What this evidence does not say.** Repeated runs are evidence, not a proof of determinism. **I13 is
not closed** — three hand-rolled readers and two further exposures remain, and I14 is untouched. **I16
is not closed** — C2 guarantees that a ceiling is *stated* at the call site, not that the ceiling is
high enough, and `useClasses`, `useRooms` and `useTeachers` are not `Paged<>`, so M4's supporting reads
(chips, pickers) must pass `per_page` explicitly with no gate to catch an omission. **H1 is not
closed** — the scheduling view still renders fixtures.

### M2.1 validation (measured at M2.1, on top of M2 `c42f274` — kept for audit)

| Check | Result |
|---|---|
| `npm ci` | ✅ exit 0 (no install script; `npm install` is never run, in CI or locally) |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm test` (full suite) | ✅ **97 files / 1369 passed / 0 failed / 0 skipped**, with `dist/` present so the 8 CSP gates ran (single definitive run, 111.3 s, taken after every document edit) |
| `npm run build` | ✅ exit 0, `built in 4.12s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Baseline before any M2.1 edit | ✅ **1345 tests** at M2 `c42f274`, measured in a `git worktree` of this clone: 1336 passed / 8 skipped / 1 failed. Both non-green parts are artifacts of *that* worktree, not of the code — it has no `dist/`, so the 8 CSP gates skip on the absent build artifact, and it is a detached HEAD, so `projectState.test.ts`'s "the recorded working branch is the branch actually checked out" fails by construction. The arithmetic is auditable: `1345 + 18 (new suite) + 6 (added to honestWriteCopy) = 1369` |
| Mutation check on the new tests | ✅ two independent reverts, each restored byte-exactly (`sha256sum`) and re-run. Reverting **the hook alone** fails all 18 new cases *and* the strengthened panel case, which reports `expected '' to be 'ساز زهی مضرابی؛ کلاسیک، پاپ و فلامنکو.'` — the erasure itself. Reverting **the three panels alone** fails the 3 new EMPTY cases and both ratchet cases, naming exactly those files, while the 3 DEMO cases still pass — correctly, since DEMO's copy was never wrong. This is the evidence that the new tests detect the defects instead of restating the code |
| Protected suites | ✅ unchanged and green: `architectureBoundaries.test.ts` (9), `privacyPosture.test.ts` (22), `projectState.test.ts` (52), `writeFeedbackHonesty.test.ts` (5), `noSuccessWithoutWrite.test.tsx` (8), `emptyEnvironment.test.tsx` (22), `emptyEnvironmentPanels.test.tsx` (10), `DomainCrud` (12), `StudentCrud` (5), and every Group A/Group D domain suite |
| Scope of the diff | ✅ 18 files: 1 hook, 6 dialogs, 3 panels, 3 existing test files, 1 new test file, 4 documents. No repository, `demoStore`, domain model, fixture, dependency, view or router change; `AssignPieceDialog` and `RecordProgressDialog` untouched |

The M2.1 workspace was a **fresh clone of the branch at `c42f274`**, verified before any edit
(`git rev-parse HEAD`, `git status --porcelain` empty, full history — 24 commits — so the Git-object
gates ran rather than skipping). The earlier M2 workspace was lost to sandbox recycling mid-milestone
and was re-cloned; nothing was carried over except the documented decisions. The sandbox clone that
started this session is stale at the `292b8b8` graft and was left untouched, as instructed.

### M2 validation (measured at M2, on top of M1 `689a7c1` — kept for audit)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm test` (full suite) | ✅ **96 files / 1345 passed / 0 failed / 0 skipped**, with `dist/` present so the 8 CSP gates ran (single definitive run) |
| `npm test` (before `npm run build`) | ✅ **96 files / 1337 passed / 8 skipped** — the same suite, the 8 CSP gates skipping on the absent build artifact. `1337 + 8 = 1345` |
| `npm run build` | ✅ `built in ~4.2s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Baseline before any M2 edit | ✅ **93 files / 1312 passed / 8 skipped** at M1 `689a7c1`, measured in a clean clone — so the arithmetic is auditable: `1312 + 8 = 1320` (M1's figure) and `1320 + 25 = 1345` (23 new tests + 1 added to each of two existing files) |
| Mutation check on the new tests | ✅ with the seven changed source files reverted to their pre-M2 content, **14 of the 18** new behavioural cases fail and the structural gate fails naming exactly the reverted file. The 4 that still pass are the DEMO-wording cases, correctly: DEMO's copy did not change. This is the evidence that the new tests detect the defects instead of restating the code |
| Protected suites | ✅ unchanged and green: `architectureBoundaries.test.ts` (9), `privacyPosture.test.ts` (22), `projectState.test.ts` (52), `loginEmptyEnvironment`, `loginDemoIsolation`, `DomainCrud`, `StudentCrud`, `StudentDetail`, `Students`, and every Group A/Group D domain suite |

The M2 workspace was a **fresh clone of the branch at `689a7c1`**, verified before any edit
(`git rev-parse HEAD`, `git status --porcelain` empty, full history so the Git-object gates ran
rather than skipping). The sandbox clone that started this session was stale at the `292b8b8` graft
and was left untouched, as instructed.

### M1 validation (measured at M1, on top of M0 `f2ebc09` — kept for audit)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm test` (full suite) | ✅ **1320 passed / 0 failed / 0 skipped** across all test files (JSON reporter, single definitive run) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Focused M1 suites | ✅ `dataLifecycle.test.ts` 28 · `useDemoData.test.tsx` 4 · `DataLifecycleGate.test.tsx` 10 · `FirstRunChooser.test.tsx` 9 · `DemoDataPanel.test.tsx` 5 · `projectState.test.ts` 52 |

The full number is **1320** (not the 1 315 quoted for the pre-M1 tree) because M1 added five focused
tests: the verbatim blob-failure propagation case in `dataLifecycle.test.ts`, the awaited
`uninitialize` pending/result and cancellation cases in `useDemoData.test.tsx`, and the
lockout/way-back cases in `DataLifecycleGate.test.tsx`, offset by the `projectState.test.ts` H5 guard
edits (same count, rewritten). This run had `dist/` present, so the 8 CSP tests ran rather than
skipping (see the `dist/` note below). Earlier full-suite attempts in this session reported failures
**only** in `projectState.test.ts` "recorded checkpoints are real Git objects" — the **L5**
graft-boundary state, not a regression — and cleared once `HEAD` was the real branch tip `f2ebc09`;
the definitive run above is green.

### Phase 2 baseline (kept for audit)

Measured at the Phase 2 checkpoint `33b1031`; re-run them before trusting them (see §8).

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output) |
| `npm test` | ✅ **91 files / 1255 passed / 0 failed** at `33b1031` |
| `npm run build` | ✅ `built in ~4.3s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Group A + Group D integrity | ✅ 11 files / 314 tests (scheduling + attendance + shared metrics) |
| Protected-domain regression run | ✅ 15 files / 166 tests |

**About the "1247" figure you may see in older reports:** `src/__tests__/cspCompatibility.test.ts`
uses `describe.skipIf(!hasBuild)` where `hasBuild = existsSync("dist/index.html")`. Run before
`npm run build`, the suite reports `1247 passed + 8 skipped`; after a build exists, the same
suite reports `1255 passed + 0 skipped`. `1247 + 8 = 1255`. Both are green; the difference is
only whether the production artifact was present.

**`dist/` is a build artifact and is not in Git.** After a workspace re-clone it is absent, so the
same 8 CSP tests skip again and the total reads 8 lower. That is neither a failure nor a
regression: `npm run build` brings them back. Always report which shape you observed —
`N passed` or `(N−8) passed + 8 skipped` — rather than a bare number.

**Suite state at that pass** — the harness-race documentation checkpoint `f1fe114`, measured in its
own working tree with `dist/` present; the *current* numbers are the M2 and M1 blocks above, and
this one is kept because its arithmetic is auditable: `npm test` reported **93 files / 1 315 passed /
0 failed / 0 skipped**, `npm run typecheck` was clean, `npm run build` succeeded and
`git diff --check` was clean. The steps from the Phase 2 baseline:

| Step | Files | Tests |
|---|---|---|
| Phase 2 checkpoint `33b1031` | 91 | 1 255 |
| + `src/__tests__/projectState.test.ts` (the gate over these documents) | 92 | 1 284 |
| + `src/views/__tests__/loginEmptyEnvironment.test.tsx` (8 gates, EMPTY login) | 93 | 1 292 |
| + 16 gates added to `projectState.test.ts` by the audit corrections | 93 | 1 308 |
| + 7 gates added to `projectState.test.ts` by the harness-race record (that pass) | 93 | **1 315** |

Because the EMPTY-login labelling fix touched application source (`src/views/Login.tsx`), the build
was re-run and the neighbouring suites were re-verified green individually: `Login` (15),
`loginDemoIsolation` (5), `emptyEnvironment` (21), `architectureBoundaries` (9),
`privacyPosture` (22) — 80 tests across the six files that could have been affected, all passing.

### Suite reliability: a retired race, and what a green claim is worth

**The former flake.** `src/views/__tests__/emptyEnvironment.test.tsx` failed intermittently — twice
in six full-suite runs, never in a targeted one. The case was *"classes reports occupancy and
average attendance as absent, not as NaN"*: `expected '…' to contain '۰ از ۰'`, and the received
text contained «در حال چیدن کلاس‌ها…». Root cause: the shared `renderView()` helper waited only for
`viewTitles[view]`, which the shell renders immediately, so it could return while `useResourceList`
(`src/domains/shared/useResource.ts`) still had a repository read in flight. Every data-derived
assertion in that file was exposed, and the *absence* assertions were worse than flaky — they could
pass for the wrong reason, by measuring a loading placeholder. `git blame` places those lines in
Phase 2 (`33b1031`): an inherited harness race, not a regression from the documentation pass.

**The fix** — test code only, at the boundary that owned the bug. `renderView()` now also waits for
the design system's in-flight marker to disappear: `role="status"`, rendered by `BreathingWave` in
`src/components/ds/states.tsx` and wrapped by `LoadingState`. It is queried **by role, not by its
Persian label**, so a copy change cannot silently turn the wait into a no-op and let the race back
in. Because `useResourceList` starts `loading: true` and clears it in the same promise's `finally`,
"no marker in the DOM" is equivalent to "the loaded records are on screen" — **for a refetch of the
same query. That equivalence does not hold when the query's *params* change**, which is what I11's
second half turned out to be; see the correction below and
[OPEN_ITEMS.md](OPEN_ITEMS.md) I13. No sleeps, no retries,
no assertion weakened or removed — and the contract is now pinned for every live surface inside the
existing `it.each(LIVE_VIEWS)` case, not only for the test that was observed to fail.

**What the green claim is therefore worth.** Measured after the fix, with `dist/` present:
**22 consecutive targeted runs** of the affected file (21 tests each, the harness byte-identical
throughout) and **6 consecutive full `npm test` runs** — 93 files / 1 315 tests — all green, the
last of them on the exact tree that was committed. Under
artificial double contention (two full suites running at once, the exact condition that used to
lose the race) one of the two was green, and the affected file was green in both. That is
evidence, not a proof of determinism: quote the run counts together with the number, and re-measure
rather than inheriting this paragraph.

**One honest caveat — since investigated, and it was not what it looked like.** In the other half of
that concurrent pair a *different* test failed once:
`src/domains/learning/__tests__/LearningPanel.test.tsx`. It was recorded as uninvestigated and
carried as [OPEN_ITEMS.md](OPEN_ITEMS.md) I11 so that nobody concluded the suite was
contention-proof. A read-only triage on 2026-09-12 reproduced it — **1 failure in 4** full-suite
samples run as two concurrent suites, after 31 focused runs stayed green — and found that
**contention was an amplifier, not the cause**: the state it exposed occurs on *every* run.

**What it actually was.** `useResourceList` sets `loading` inside an effect, so when a list query's
params change there is one committed frame holding the *previous* query's rows with `loading ===
false` and **no in-flight marker at all** — measured `role="status"` 0, `aria-busy` 0, no loading
string. `LearningPanel` reaches that frame on mount because it asks for `{ per_page: 0 }` before a
program is selected and `paginate`'s `Math.max(1, …)` turns "no rows" into **one** row, so the panel
showed «سطوح «ویولن کلاسیک» — ۱ سطح» over a single unrelated level while the store held fifteen. The
file's `waitForPanel()` waited only for the two loading strings to be absent — which they were in
that frame — so a case read `levelItems().length` as 1 and failed with `expected 16 to be 2`. It was
**not** the case I11 named (*"reorders levels…"*, which passed in the failing run); every case in the
file shared the helpers. A starvation timeout was measured and ruled out: the reorder case runs
178 ms idle and 483–609 ms under four-way oversubscription, against a 5000 ms test timeout.

**What was fixed (test code only, Tier 1).** `waitForPanel()` now settles on the data instead of on
marker absence: it asserts against the repository that the rows on screen are the rows belonging to
the program the heading names — same count, same order, same titles — and returns that state, so no
case reads the list before it is settled. Marker checks remain as necessary-but-not-sufficient
conditions. No sleep, no retry, **no timeout increased**, no assertion weakened, skipped or deleted.
  One case was added (*"never shows one program's levels under another program's heading"*) and three
  were strengthened. Mutation-checked with a read-only probe: it recorded instants where the old
  condition holds and the new one is violated (`rowsOnScreen=1` against `storeForThatProgram=15`),
  three runs out of three. **Measured after the fix, per §10.1's six-run rule for a file that has
  ever flaked:** 6 consecutive full `npm test` runs — 97 files / 1370 passed / 0 failed / 0 skipped
  each, `dist/` present — plus **4 samples run as two concurrent full suites**, the exact condition
  that reproduced the failure (1 in 4 before the fix), all green with the file at 3288–3792 ms
  against 2498 ms idle, so the contention was real and heavier than the run that failed. A seventh
  full run on the final tree was green after the documentation edits below.

**What was deliberately *not* fixed.** The product behaviour that creates the frame is untouched and
is recorded as **I13** (the hook publishes a previous query's page with no marker — 12 domain hooks,
every list in the product) and **I14** (`paginate` clamps `per_page: 0` to one row — three call sites
rely on it meaning "nothing"). Tier 1 closes I11 as a *test reliability* defect; it does not close
I13 or I14, and neither is reported as fixed. I13 matters before M3 specifically because
`attachContent` has no cross-program guard, unlike `assignPlacement`.

*Superseded in part on 2026-09-13, and left here as the record of that pass rather than rewritten:*
**I13's Checkpoint 1** — the shared hook plus the six dynamic-params consumers that ignored
`loading` — was subsequently authorized, implemented and **validated** at `289e080` (6 consecutive
full-suite runs green, 4 contention samples green, build, typecheck, 68 documentation gates, and a
reversion check on each half).
**I14 is untouched and explicitly deferred**, and so are the four remaining hand-rolled readers of
I13's Checkpoint 3; its fifth, `useDerived` — the one with a real consumer — was fixed as
**Checkpoint 3A** at `57c1dfb` after the exposure was reproduced deterministically.
**Checkpoint 2** — the `attachContent` intent guard — was authorized the same day as its own pass,
recorded as in progress before its code was written, and has since **landed and been validated** at
`bcea26c`. See §7 item 12 and [OPEN_ITEMS.md](OPEN_ITEMS.md) I13.

## 5. Browser QA status

❌ **NOT VERIFIED — unchanged, and must not be reported as passed.**

No browser automation exists in this environment (`package.json` has no Playwright,
Puppeteer, Cypress or WebDriver dependency, and no browser engine can be installed). All
verification is jsdom + `tsc` + the Vite build. Manual browser QA is still required for:
mobile drawer/bottom-nav, command-palette keyboard flow, focus trapping in dialogs, chart
rendering, RTL layout at tablet/mobile breakpoints, real audio playback, real file-picker and
file-download paths, and the first-run lifecycle chooser on a genuinely fresh browser
profile. **M3 adds one more:** the learning-content assignment surface
(`src/domains/learning/LevelContentPanel.tsx`) has never been opened in a browser — its four states,
its picker, its toasts and its keyboard path are jsdom-verified only. **M4 will add another, and it is
written down now rather than after the fact:** the scheduling calendar has never been opened in a
browser either — today `src/views/Scheduling.tsx` renders fixtures, and once M4 wires it to
`useSessions`, `useGenerationPreview` and `useConflictCheck`, its week navigation, its Jalali date
rendering, its reschedule/cancel/generate flows and its conflict states will be jsdom-verified only
until this checklist is performed. The two pre-M4 remediation commits changed no view, so they add nothing to
this list — and they do not shorten it. See
`docs/production-handoff.md` → "NOT verified".

## 6. Protected domains and invariants

These are pinned by tests. Changing them is a regression, not a refactor.

| Area | Pinned by |
|---|---|
| **Group A — scheduling** (Session model, conflict engine, generation, Jalali date bridge) | `src/domains/scheduling/__tests__/conflicts.test.ts` · `generation.test.ts` · `dateBridge.test.ts` · `demoRepository.test.ts` · `registry.test.ts` · `useScheduling.test.tsx` — **211** tests. `src/domains/scheduling/__tests__/useDerivedRead.test.tsx` sits in the same directory but is **not** Group A: it pins I13's Checkpoint 3B, was added by `fba826f`, and is equally off-limits to weakening |
| **Group D — attendance** (append-only corrections, roster) | `src/domains/attendance/__tests__/demoRepository.test.ts` · `roster.test.ts` · `useAttendance.test.tsx` |
| Library + real media bytes (Phase 1) | `src/views/__tests__/Library.test.tsx` · `src/domains/library/__tests__/useLibrary.test.tsx` · `demoRepository.test.ts` · `apiRepository.test.ts` · `AudioMessagePlayer.test.tsx` · `src/domains/media/__tests__/media.test.ts` |
| Student profile + messages regressions (Phase 1) | `src/views/__tests__/studentProfileRegression.test.tsx` · `messagesDatasetRegression.test.tsx` |
| Persistence boundary: migration, backup/restore, dataset integrity, prototype-pollution defence | `src/services/__tests__/demoStoreMigration.test.ts` · `src/domains/demo/__tests__/backup.test.ts` · `contracts.test.ts` · `dataIntegrity.test.ts` · `prototypePollution.test.ts` · `seed.test.ts` |
| Lifecycle model (Phase 2) | `src/domains/demo/__tests__/dataLifecycle.test.ts` · `src/components/lifecycle/__tests__/FirstRunChooser.test.tsx` · `DataLifecycleGate.test.tsx` · `src/views/__tests__/emptyEnvironment.test.tsx` · `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` · `src/components/settings/__tests__/DemoDataPanel.test.tsx` |
| Login in an EMPTY environment — truthful labels **and** preserved bootstrap entry | `src/views/__tests__/loginEmptyEnvironment.test.tsx` · plus `src/views/__tests__/loginDemoIsolation.test.tsx` (api isolation) and `src/views/__tests__/Login.test.tsx` (form/auth contract) |
| Layering (views never touch `localStorage`/`demoStore`/`fetch`/hardcoded URLs/`ACADEMY_NOW`) | `src/__tests__/architectureBoundaries.test.ts` |
| Privacy/exposure posture and absence of embedded secrets | `src/__tests__/privacyPosture.test.ts` |
| Production artifact loads under the deployed CSP | `src/__tests__/cspCompatibility.test.ts` |
| Route protection + boot gates | `src/__tests__/routeProtection.test.tsx` · `src/__tests__/configGate.test.tsx` |
| These engineering documents stay truthful | `src/__tests__/projectState.test.ts` |

**Standing engineering invariants** (full rationale in [DECISIONS.md](DECISIONS.md)):
reads never write; the lifecycle mode is a persisted fact, never inferred from row count;
demo-only material never reaches an EMPTY environment; missing bytes produce an honest
"unavailable" state, never a fabricated URL; no-data is an explicit typed value
(`NO_DATA = "—"`), never `NaN` and never a consumer-side `|| []` patch; no fake success UX.

## 7. Known limitations (honest, unresolved)

1. **Fixture-driven surfaces.** Dashboard insight panels (`src/components/panels/Intelligence.tsx`,
   `BusinessIntelligence.tsx`, `Signals.tsx`, `AttentionAndFlow.tsx`) read static fixtures from
   `src/data/academy.ts`, so they show fabricated sentences even in EMPTY.
2. **Static sidebar badges** (`src/components/layout/Sidebar.tsx:120` → `badge={n.badge}` from
   `src/data/academy.ts`) show counts that are false in EMPTY.
3. **Views not wired to their real domains.** Scheduling and Attendance have complete, tested
   domains but the views read fixtures; Finance and Reports have no domain layer at all.
4. **Backup envelope always says "demo"** — `environment: "demo"`, app name `…(DEMO)`, filename
   `arena-demo-backup-*.json` — even for a customer's EMPTY data. Round-trip is lossless; the
   labels are wrong. Fixing it is a versioned format change touching the `WRONG_ENVIRONMENT`
   validation rule.
5. **`clear()` still produces an environment nobody can sign into; M1 adds a local recovery path.**
   It empties `users`, so no account remains, while the lifecycle marker survives — so
   `DataLifecycleGate` stays transparent and the visitor lands on a login screen that cannot
   succeed. Settings, and therefore "restore a backup", remains *behind* that login. This
   `clear()` behaviour is deliberately unchanged; `uninitializeEnvironment()` is the separate
   recovery operation. In local EMPTY/DEMO mode, the lifecycle gate owns the controller and
   `src/views/Login.tsx` renders `src/components/lifecycle/LifecycleRecoveryPanel.tsx` outside the
   signed-in shell. It calls `uninitialize` only after the second confirmation, shows truthful
   counts, waits for blob cleanup, and surfaces the exact `UninitializeResult.message` (including
   any blob-failure clause) before the chooser offers EMPTY or DEMO again. API mode has no local
   recovery affordance. The M1 implementation is present in the current working tree but remains
   provisional until validation and a durable phase checkpoint; see **H5** in
   [OPEN_ITEMS.md](OPEN_ITEMS.md) and I10 below.
6. **Latent DS crashes**: `Sparkline` with `data={[]}` and `BusinessIntelligence` with an empty
   series. Not reachable today (static fixtures only) — must be guarded before those panels go live.
7. **Command-palette natural-language matching is substring-loose** (`q.includes(keyword)`).
8. **Dead code**: `TeacherNote` in `src/data/records.ts:31` is defined and never used.
9. **Documentation drift**: `docs/gap-matrix.md` is a stale Phase 0 audit; parts of
   `docs/architecture/data-layer.md` still claim scheduling/attendance/messages/library have no
   domain layer; `docs/production-handoff.md` still quotes "38 files / 340 tests"; the
   `attendance` README stub still says "not implemented in Phase A" (the `scheduling` README's
   identical stub, and its invented `POST /sessions/{id}/move` contract, was corrected in M4's CP0
   documentation reconciliation — see [OPEN_ITEMS.md](OPEN_ITEMS.md) **L3**; the rest of this drift
   stays M10's).
10. **No code-splitting** — one main chunk > 500 kB (build warning).
11. **No backend.** `api` mode is an architectural seam pointing at a server that does not
    exist. See `docs/production-handoff.md` and `docs/security.md` §8.
12. **A list could show the previous query's rows and claim nothing was loading — being closed, not
    yet closed.** `useResourceList` set `loading` inside an effect, so when a query's params changed
    one committed frame still held the previous page with no in-flight marker of any kind — measured
    on `LearningPanel`: a single unrelated level under a heading claiming «۱ سطح» for a fifteen-level
    program, and on a program switch piano's heading over violin's rows with their delete and move
    buttons enabled; and demonstrated destructively on `GalleryPanel`, where a «حذف» offered under a
    newly selected album targeted an image of the album the user had navigated away from.
    `StudentLearningPanel` rendered «سطح نامشخص از ۱ سطح این دوره» in the same window for a placed
    student. **I13's Checkpoint 1 is implemented and validated** (6 consecutive full-suite runs
    green, 4 contention samples green, build, typecheck, documentation gates, and a reversion check
    on each half): the state now
    carries the query identity it answers and what the hook exposes is derived at render, so a page
    belonging to another query cannot be exposed at all, and the six consumers that ignored `loading`
    now show an in-flight state instead of a false empty. **Checkpoint 2 is implemented and validated
    too** (`bcea26c`, 6 consecutive full-suite runs green, build, typecheck, documentation gates, and
    a reversion check that fails 7 of the 15 new tests and the compile pin): `attachContent` now takes
    a required `AttachContentIntent { programId }` from the caller and refuses a level that does not
    belong to it — `LINK_INVALID`, nothing written, no placed student's derived eligibility changed —
    so a row left over from another query cannot become a write into a ladder nobody is looking at.
    **Checkpoint 3A is implemented and validated too** (`57c1dfb`): `useDerived`, the one boundary
    behind `useStudentPlacement` and `useEligibleContent`, now carries the key it answers and derives
    what it exposes at render, so a student switch cannot show one student's placement or unlocked
    content under another's name. It was **reproduced deterministically before being fixed** — the
    dedicated suite failed 4 of 8 against the unmodified hook — and its reachability is recorded
    honestly: the frame was *not* observable through the app's own navigation, because `src/App.tsx`
    keys the view subtree on `detailId` and so remounts the panel; the hook's correctness should not
    depend on an ancestor's key, and any consumer that switched students in place would have
    inherited the exposure. **Checkpoint 3B is implemented and validated too** (`fba826f`, the first
    of the two pre-M4 remediation commits): `useDerivedRead` — scheduling's boundary, behind
    `useSessionRoster`, `useGenerationPreview` and `useConflictCheck` — carries its query key with the
    same shape, reproduced before being fixed by a new 9-case suite and checked by a reversion that
    fails 4 of the 9 on identity. It was hardened ahead of **M4** rather than inside it because M4 is
    what makes those three readers reachable in shipped UI. **Still open:** the three remaining
    hand-rolled readers keep the old shape
    (rest of Checkpoint 3, not authorized; none of
    them reachable in shipped UI today); `useLibraryFile` can offer the previous item's bytes under a
    new title; `useMediaObjectUrl` exposes the previous object URL for one frame. `paginate` still
    turns `per_page: 0` — three call sites' way of saying "load nothing" — into one row (**I14**,
    untouched and not an M3 blocker; neither remediation commit closes it, because **C2** makes
    *omitting* `per_page` a compile error at the call site, which is not the same as making `0` mean
    nothing). The test harness stopped
    trusting that frame earlier (**I11**,
    fixed).

*Two limitations that were listed here were fixed by M2.1 and removed rather than left as stale
entries: the edit dialogs that opened with an empty draft (**H6**) and the three Settings panels that
called a real write demo data (**H7**). Both are recorded as landed in
[OPEN_ITEMS.md](OPEN_ITEMS.md) and ledgered in [PHASES.md](PHASES.md).*

## 8. Deferred work

Everything not finished is catalogued, categorised and evidenced in
**[OPEN_ITEMS.md](OPEN_ITEMS.md)**. Nothing there has been silently converted into completed
work, and no item may be removed from that file without either landing it or recording why it
was dropped.

## 9. Immediate next action

**M3 (learning-content assignment UI, I3 — UI only) is ✅ COMPLETE, and I3 with it.** Implemented at
`e5b0a57d8f33dc04838670a2cd4158a88dd34022` on top of I13 Checkpoint 3A
(`57c1dfb8967a60990021ac9fe59c6ab80045fca3`), documented at `df3db2f` and `db5ec24`, accepted through
a formal audit, and **completed at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`** — the audit's one
product finding (F1), fixed with a regression case and a reversion check. The authoritative evidence
is §4 → "M3 completion validation": **6 consecutive full-suite runs at 104 files / 1424 tests / 0
failed / 0 skipped**, `LearningPanel.test.tsx` 11/11 every run, typecheck and build clean, 52
documentation gates green (§3 → "Last completed work (M3…)").

**M3 is complete *with limitations*, and they are not closed by declaring it complete.** Preserve
them in any future report: the surface's **detach** has no stale-context guard (**I13**, still open —
attach is guarded and pinned, detach is a single-id write and cannot be); both of its reads mean
"everything" and stop at `per_page: 200`, with its heading counting `items.length` instead of `total`
(**I16**); **fourteen other consumers discard a read's `error`** and can render a failed read as an
empty one (**I15** — M3 fixed only its own instance, deliberately); link `sortOrder` is written and
honoured student-side but invisible and unmanageable in the assignment surface (**I17**); no test
performs a storage round-trip, so "persists across a reload" rests on a remount case plus the store's
single-persistence-authority code path; **D8's api-mode indicator does not exist until M11**; and
**browser QA has never run and is NOT VERIFIED** (§5). Completion says the contract now has a tested,
honest UI — not that a human has used it in a browser.

**M4 is NOT STARTED, and this pass did not start it.** The next milestone — **M4, scheduling *view*
wiring (H1a, domain frozen)** — is **NOT STARTED** and is not authorized beyond the documentation
reconciliation recorded here. What *has* happened is **CP0**: the five `docs/engineering/` documents
and `src/domains/scheduling/README.md` were reconciled with the tree at
`7e72887761f07f48e115160611a9785bfaae9060` — documents only, **no product source, no test, no
dependency, no build**, and no claim in them upgraded. CP0's own rule is that it stops there:
**CP1 (implementation) is not authorized by CP0 landing**, and a reader who finds these documents
reconciled must not infer that the view was wired. When CP1 *is* authorized, the first step is still
*not* implementation:
re-read [OPEN_ITEMS.md](OPEN_ITEMS.md), confirm the recorded checkpoints against Git (§2, and the
recovery contract at the end of this file), re-establish a green baseline (`npm ci` if
`node_modules` is absent, then `npm run typecheck`, `npm test`, `git diff --check`, `npm run
build`), and only then start from the
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M4 scope, with Groups A and D
frozen exactly as §6 records — together with the 9-case
`src/domains/scheduling/__tests__/useDerivedRead.test.tsx` suite, which is *not* Group A and is no
less off-limits.

**M3's own spec named one precondition, and it is now discharged:** the **I11** `LearningPanel`
flake has been reproduced, root-caused and fixed in the test harness, so the suites M3 touches are
trustworthy again — and the triage answered the spec's question honestly: it was *not* an artefact of
running two suites on one machine. What I11's triage found underneath has now been **decided**:
**I13** (a list hook published the previous query's rows with no loading marker when its params
change — every list in the product) was authorized as **Checkpoint 1 (A′)** on 2026-09-13, implemented and
**validated at `289e080`**: the shared hook derives what it exposes from the query identity its state
answers, and the six dynamic-params consumers that ignored `loading` now show an in-flight state
instead of a false empty. The evidence is the full set §10.1 requires — 6 consecutive full-suite runs
(100 files / 1384 passed / 0 failed / 0 skipped each, `dist/` built so nothing skipped), 4 samples as
two concurrent full suites, build, typecheck and 68 documentation gates — plus a reversion check on
each half, so neither the hook fix nor the consumer gates are pinned by a test that would pass
without them. **That gate is discharged; M3 is no longer held by I13 Checkpoint 1.** Two parts of I13
were **deliberately left out** of that authorization. The first, **Checkpoint 2** — the
`attachContent` intent guard, needed because `attachContent` took only `(levelId, contentId)` and so,
unlike `assignPlacement`, had nothing to compare a level against — was **authorized by the owner the
same day as its own pass, recorded as in progress before its code was written (`be75ac6`), and has
now landed and been validated at `bcea26c`**: the call requires an `AttachContentIntent { programId }`
resolved independently of the target level, refuses a mismatch with `LINK_INVALID` and writes nothing,
and leaves `LEVEL_NOT_FOUND`, `CONTENT_NOT_FOUND`, `CONTENT_ALREADY_LINKED` and one content item
serving several programs unchanged. `attachContent` therefore **is** fixed for the risk M3's surface
writes through, with one honest caveat recorded in
[OPEN_ITEMS.md](OPEN_ITEMS.md) I13: no signature can stop a caller passing the target's own
`programId` back as its intent, which makes the comparison a tautology — only review can, and the
test file names that failure mode. **M3 is that review, and it is now pinned by a test rather than
by a sentence:** the surface passes the program the panel selected, and
`src/domains/learning/__tests__/contentAssignmentFlow.test.tsx` reproduces the frame in which a
rendered level row belongs to a different program than the selection, asserts that the repository
was handed the *independent* program and therefore refused the write, and goes red when the wiring
is mutated to `contentLevel.programId`. The caveat stays open — the guard still cannot defend itself
against a future caller — but the first real caller does not defeat it. The second, **Checkpoint 3**, is five hand-rolled readers with the
same shape. Its first slice, **Checkpoint 3A**, was authorized and has **landed and been validated at
`57c1dfb`**: `useDerived`, the boundary behind `useStudentPlacement` and `useEligibleContent`, was
the one with a real consumer, and it was **reproduced deterministically before being fixed** — a
dedicated suite failed 4 of 8 against the unmodified hook, then passed 8 of 8 after it, and restoring
the old hook fails the same 4 and no others. That discharges the condition this section placed on M3:
a student-scoped derived read can now be rendered by M3's surface without exposing one student's
placement or unlocked content under another's name. **M3 chose not to render one** — the spec made
the student-scoped read optional and the slice stayed tight — so `useDerived`'s fix is landed,
validated and *unused by M3*. That is recorded as unused rather than claimed as a dependency
satisfied; M6/M7 are what will consume it. Its second slice, **Checkpoint 3B**, landed after M3 as the
first of the two pre-M4 remediation commits at `fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`: scheduling's
`useDerivedRead` — the boundary behind `useSessionRoster`, `useGenerationPreview` and
`useConflictCheck` — carries its query key with the same evidence shape (a new 9-case suite that
reproduced the crossed frame before the fix; reverting only the fix fails 4 of the 9 on identity).
It was hardened ahead of M4 rather than inside it because **M4 is what makes those three readers
reachable in shipped UI**. **The remaining three readers are not authorized
and not started** — `useStudentList`, `useStudentProgress` and
`useSessionAttendance`, none of them reachable in shipped UI today: `useSessionAttendance` has no view
consumer at all and becomes reachable at **M5**, `useStudentProgress` has none and becomes reachable
at **M6/M7**, and every `useStudentList` call site passes constant params, so it is structurally
defective but unreachable. **I14** (`paginate` clamps `per_page: 0` to one
row) was assessed for M3 relevance and **deferred**, and M3's landing changes nothing about it: the
assignment surface never reads through a `per_page: 0` query, since that is only the
not-yet-selected branch of three call sites — and M3 added no fourth, because its surface renders
only once a level is selected. The two
findings that M2
recorded and M2.1 fixed (**H6**, **H7**) no longer block anything; what M2.1 leaves behind is the
knowledge that `RepertoirePanel` and `PieceFormDialog` are now safe to build on — a piece's
`programId`, `rangeUnit` and `active` flag survive an edit, which is exactly what M3's assignment
surface reads.

Do **not** reopen M1: `clear()` semantics, the zero-record invariant (§8 / I10) and the api-mode
transparency of the gate are settled and pinned by tests. The M1 evidence lives in
[OPEN_ITEMS.md](OPEN_ITEMS.md) H5 (now landed) and [DECISIONS.md](DECISIONS.md) §8/§18/§19 (D3/D4).
**M3's rollback boundary is two numbers, not one** (§4 → F2 note, and
[PHASES.md](PHASES.md) → "Product phase — M3"): the spec's is `c42f274` (**M2**), the effective safe
one is `85530b4`, because rolling back to M2 would also destroy M2.1 and the three accepted I13
checkpoints `289e080`, `bcea26c` and `57c1dfb`, which must survive any M3 rollback.

Do **not** reopen M2 either: the seven H2 sites and the five H3 sites are settled and pinned by
`src/__tests__/writeFeedbackHonesty.test.ts`, and the shapes chosen there were the owner's explicit
decision (remove a control that has no truthful action; never disable it into a promise). M2.1 is
settled the same way: the draft re-sync belongs to `useEntityForm`, not to six dialogs or seven
mount sites, and `demoStore`'s merge semantics were deliberately **not** hardened to ignore explicit
`undefined` — that would change repository behaviour for every caller and destroy the legitimate
"clear this optional field" intent.

## 10. DO NOT — standing constraints

These come from the product owner and survive every session.

**Git**
- Do **not** re-clone, reset, re-parent, stash, revert or rewrite history.
- Do **not** force-push. Do **not** amend an existing commit.
- Do **not** commit or push without explicit authorization; one logical commit per instruction.
- Do **not** delete or discard uncommitted work. Verify before and after any Git operation.
- Work only on the recorded working branch.

**Engineering**
- Do **not** start a new phase while the current one is unfinished or unreviewed.
- Do **not** weaken a failing assertion to make a suite green; fix the owning boundary.
- Do **not** blanket-patch consumers with `|| []` / `?? []` — fix the contract at its boundary.
- Do **not** branch on `isDemo`/`isDemoEnvironment` inside domain views to decide *what data to
  read or write*; lifecycle lives in one boundary and reaches components only through
  `src/domains/demo/useDataLifecycle.ts`. The one permitted use inside a view is **wording**: where
  a label would otherwise lie about the environment (the Settings data panel, the login credential
  panel), the component takes its text from `useIsDemoEnvironment()` — the same seam — rather than
  re-deriving lifecycle state. Seeding, filtering and hiding capability all stay at the boundary.
- Do **not** let reads mutate state: `snapshot()` must never seed, repair or write.
- Do **not** put demo media or demo records into an EMPTY environment.
- Do **not** build a fake production backend, fake success toast, fake download URL or
  fabricated metric. No error swallowing, no hardcoded fallback data.
- Do **not** regress Phase 1 (library/media/profile/messages) or the protected domains in §6.
- Do **not** add dependencies without authorization.

**Product and safety**
- Persian-first, RTL, accessible, performant. Honour `prefers-reduced-motion`.
- No copyrighted third-party franchise assets (e.g. Harry Potter / Hogwarts material).
- No secrets, credentials, tokens, API keys or personal data in React source, in `VITE_*`
  variables, in `localStorage`, or in these documents. Credentials are a backend concern only.

## 11. Working conventions (the things that bite a new session)

| Convention | Detail |
|---|---|
| Test environment | `vite.config.ts` sets `environment: "node"`, so **every** `.test.tsx` file must begin with `// @vitest-environment jsdom`. Without it the failure is a baffling `document is not defined` |
| Shared lifecycle harness | `src/test/demoEnvironment.ts` exports `resetToDemoEnvironment()`, `resetToEmptyEnvironment()` and `resetToUninitialized()`. `demoStore.reset()` seeds nothing, so every test must say out loud which environment it wants |
| Waiting for a view in tests | Wait for the design system's in-flight marker — `role="status"`, from `BreathingWave` in `src/components/ds/states.tsx` — to disappear, **not** for the view title. The shell renders titles immediately while `useResourceList` may still have a read in flight, which is how I11's race worked. Query by role, never by the Persian label, so a copy change cannot turn the wait into a no-op. **Marker absence was not enough when the query's params could change:** the frame between a params change and the effect that re-set `loading` carried no marker at all, so wait for the data-derived state — the rows on screen are the rows the repository holds for what the screen claims to be showing (**I11**). Since I13's Checkpoint 1 the hook itself upholds that: a page is exposed only for the params it was loaded for, so a params change shows an in-flight state rather than another query's rows. **The data-derived wait stays the rule anyway** — it is what makes a test independent of which half is holding, and the five hand-rolled readers of I13 Checkpoint 3 — of which `useDerived` is fixed as Checkpoint 3A, scheduling's `useDerivedRead` as Checkpoint 3B, and three are not — do not all uphold it yet. And never wait on `loading === false` as the *sole* proof: that is the flag under test, so such a wait can be satisfied by the very frame being asserted against |
| Running a single file | `npx vitest run <path>` — the whole suite takes ~100 s |
| Blob store | `blobStore.put(id, bytes, mimeType)` takes three arguments and an `ArrayBuffer`, **not** a `Blob` |
| Dependencies | `npm ci` only. Never `npm install` — it can rewrite `package-lock.json`, which is an unauthorized dependency change and dirties an otherwise clean tree |
| Typecheck | `npm run typecheck`. Never `npx tsc`, which can fetch an unrelated package named `tsc` |
| Commit trailer | See §2: a non-versioned `.git/hooks/commit-msg` appends `Co-authored-by: arena-agent …`; its absence after a re-clone is cosmetic |

---

## New Session Recovery

A fresh agent session recovers context in this order. **Do not trust this document blindly —
verify every claim against Git and the test suite.**

1. **Read `docs/engineering/PROJECT_STATE.md`** (this file) — identity, checkpoint, phase,
   validation, constraints.
2. **Read the siblings as needed**: [PHASES.md](PHASES.md) for the ledger,
   [DECISIONS.md](DECISIONS.md) before changing architecture, [OPEN_ITEMS.md](OPEN_ITEMS.md)
   before starting work.
3. **Inspect Git**: `git status -sb`, `git status --porcelain`, `git log --oneline -5`,
   `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`.
4. **Verify HEAD against the recorded checkpoint** in §2 — do not assume it:
   `git rev-parse HEAD` must equal the recorded SHA, or be a descendant of it
   (`git merge-base --is-ancestor <recorded> HEAD`). Verify the remote independently with
   `git ls-remote origin refs/heads/<branch>` (the local remote-tracking ref may not exist —
   see §2). If HEAD and the record disagree, **stop and report the discrepancy**; do not
   "fix" it by resetting. If the recorded SHA is not present locally at all
   (`git cat-file -e <sha>^{commit}` → `fatal: bad object`), the workspace has most likely been
   **re-cloned** (§2): the commit object is gone but the files usually are not — stop, report,
   and recover only with explicit authorization, hashing every changed and untracked file first.
5. **Inspect recent commits**: `git show --stat HEAD` and `git log --stat -3` to see what the
   last phase actually touched. Remember the clone is shallow (§2).
6. **NEVER reset, re-clone, delete, stash or discard uncommitted work** without explicit
   authorization from the product owner. If the tree is dirty, treat it as valuable:
   record `git status --porcelain` and `git diff --stat`, and ask.
7. **Continue only from §9 "Immediate Next Action"** — and only if it is authorized. If §9 says
   NOT STARTED, do not start it; report and wait.
8. **Re-establish a green baseline before changing anything.** If `node_modules` is missing —
   common after a workspace re-clone — run **`npm ci`**, never `npm install`: `npm install` can
   rewrite `package-lock.json`, which is a dependency change nobody authorized and dirties the very
   tree you were told to keep clean. Then `npm run typecheck`, `npm test`, `git diff --check`, and
   `npm run build` if you touched application source (or if `dist/` is missing and you want the 8
   CSP tests to run rather than skip — §4).
9. **Update this file when a durable checkpoint or phase changes** — and update
   [PHASES.md](PHASES.md) / [OPEN_ITEMS.md](OPEN_ITEMS.md) in the same commit, so the ledger
   never contradicts the state. `src/__tests__/projectState.test.ts` fails the suite if the
   recorded checkpoint is not a real reachable commit, if required sections disappear, or if a
   secret is pasted into these documents.
