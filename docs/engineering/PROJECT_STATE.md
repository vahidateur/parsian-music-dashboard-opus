# PROJECT STATE — recovery document

> **Read this first.** It is the durable hand-off between agent sessions. Conversation
> memory is not durable; this file, the Git history and the test suite are.
>
> Sibling documents: [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md)
>
> **Last state update: 2026-09-12.**

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
| **Phase checkpoint (application)** | `33b10311f0d3a38745b4d0c00f22e4f63665888d` — Phase 2, approved and pushed. **Not advanced to M0/M1/M2/M2.1, and the reason is a rule, not an oversight:** `src/__tests__/projectState.test.ts` requires the recorded documentation checkpoint to *descend from* the recorded phase checkpoint, so this row can only move to a milestone once a documentation checkpoint has been pushed after it. The milestones themselves are registered in [PHASES.md](PHASES.md) — M1 is `689a7c15951d690b1ce650a5938e6b1216ca30ed` and M2 is `c42f274ac10d4087f9280e3bf7b47141d0672e32` — and §3 carries the current phase |
| Previous phase checkpoint | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` — Phase 1, approved and pushed |
| **Documentation checkpoint (pushed)** | `f1fe114b667558bec1ffbc4e7506e3e310ce9735` — the retired test-harness race: the EMPTY audit waits for loaded data instead of a view title, and the race is recorded in I11 |
| Previous documentation checkpoint | `77b019ef07f99817da985e1602dd11365b4b9365` — the audit-correction pass: these documents, their validation gate, and the EMPTY login labels |
| Baseline commit | `292b8b86ce7dd328b3a1510047f994e39c443a4e` (shallow-clone graft boundary) |
| Remote state | **Deliberately not recorded as a value — verify it instead:** `git ls-remote origin refs/heads/<branch>` must return local `HEAD`, or an ancestor of it. Anything else means someone else pushed, or this clone is stale |

### Two kinds of checkpoint

- A **phase checkpoint** is a durable *application* milestone: a reviewed, approved and pushed
  commit that ends a phase of product work. The row above names the latest one the
  documentation-checkpoint ordering rule permits — still `33b1031` (Phase 2) — while the product
  phase's own milestones (M0 `f2ebc09`, M1 `689a7c1`, M2 `c42f274`, and M2.1, this commit) are
  registered in [PHASES.md](PHASES.md) and named in §3. Only a phase checkpoint advances "current
  phase" in §3.
- A **documentation checkpoint** is a pushed commit that changes documents and validation gates
  but no product behaviour. Three exist so far: `68b4fe3` (these documents and their gate),
  `77b019ef` (the audit-correction pass, which also made the EMPTY login screen's *labels*
  truthful — the one permitted exception, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) H3) and
  `f1fe114` (the retired test-harness race, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I11). They
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
| Current phase | **Product-feature phase — M2.1 (edit-form draft integrity + the three Settings panels: H6 + H7)** |
| Phase status | ✅ **COMPLETE** — landed this commit on top of M2 `c42f274ac10d4087f9280e3bf7b47141d0672e32`, pushed to the working branch. This commit's own SHA is registered by the next commit (§2: no self-referential SHA); `git log --oneline -- src/domains docs/engineering` is the authority for it |
| Next phase | Product-feature phase — **M3 (learning-content assignment UI, I3 — UI only)** — ❌ **NOT STARTED**, not authorized yet |
| Working tree | Clean at every recorded checkpoint — **verify, do not trust**: `git status --porcelain` must print nothing |

M0 (`f2ebc09`, spec + decision register, documents only), M1 (`689a7c1`, the recovery UX), M2
(`c42f274`, honest write feedback) and M2.1 (this commit, the two defects M2 found and recorded
rather than fixed) are the product phase's milestones so far. **M2.1 is not in the M0
specification:** it is **H6** and **H7** from [OPEN_ITEMS.md](OPEN_ITEMS.md), inserted between M2 and
M3 by the owner's explicit decision after a read-only triage, and the spec's M0–M11 sequence is
unchanged by it. M3–M11 have not started; the ledger in [PHASES.md](PHASES.md) marks the
product-feature phase's remaining milestones NOT STARTED.

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
`689a7c1` (recovery and lifecycle UX), M2 `c42f274` (honest write feedback) and M2.1, this commit
(the two defects M2 found and recorded: edit-form draft integrity and the three Settings panels).

The commits themselves are listed in [PHASES.md](PHASES.md) → "Documentation checkpoints"; this
file never records the SHA of the commit carrying the edit (§2).

## 4. Validation status

### M2.1 validation (measured this pass, on top of M2 `c42f274`)

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
"no marker in the DOM" is equivalent to "the loaded records are on screen". No sleeps, no retries,
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

**One honest caveat.** In the other half of that concurrent pair a *different* test failed once:
`src/domains/learning/__tests__/LearningPanel.test.tsx` → *"reorders levels and keeps the ordering
contiguous"*. It is unrelated to the harness fix, it has not appeared in any single-suite run, and
it was **not investigated** — this pass was scoped to three items. It is recorded in
[OPEN_ITEMS.md](OPEN_ITEMS.md) I11 so that nobody concludes the suite is contention-proof.

## 5. Browser QA status

❌ **NOT VERIFIED — unchanged, and must not be reported as passed.**

No browser automation exists in this environment (`package.json` has no Playwright,
Puppeteer, Cypress or WebDriver dependency, and no browser engine can be installed). All
verification is jsdom + `tsc` + the Vite build. Manual browser QA is still required for:
mobile drawer/bottom-nav, command-palette keyboard flow, focus trapping in dialogs, chart
rendering, RTL layout at tablet/mobile breakpoints, real audio playback, real file-picker and
file-download paths, and the first-run lifecycle chooser on a genuinely fresh browser
profile. See `docs/production-handoff.md` → "NOT verified".

## 6. Protected domains and invariants

These are pinned by tests. Changing them is a regression, not a refactor.

| Area | Pinned by |
|---|---|
| **Group A — scheduling** (Session model, conflict engine, generation, Jalali date bridge) | `src/domains/scheduling/__tests__/conflicts.test.ts` · `generation.test.ts` · `dateBridge.test.ts` · `demoRepository.test.ts` · `registry.test.ts` · `useScheduling.test.tsx` |
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
   `scheduling` and `attendance` README stubs say "not implemented in Phase A".
10. **No code-splitting** — one main chunk > 500 kB (build warning).
11. **No backend.** `api` mode is an architectural seam pointing at a server that does not
    exist. See `docs/production-handoff.md` and `docs/security.md` §8.
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

**M2.1 (edit-form draft integrity + the three Settings panels, H6 + H7) is COMPLETE and landed** on
top of M2 `c42f274ac10d4087f9280e3bf7b47141d0672e32`, pushed to the working branch. The next
milestone is **M3 — learning-content assignment UI (I3, UI only)**, and it is **NOT STARTED** and not
yet authorized.

When authorized, the first step is *not* implementation: re-read [OPEN_ITEMS.md](OPEN_ITEMS.md),
confirm the recorded checkpoints against Git (§2, and the recovery contract at the end of this
file), re-establish a green baseline (`npm ci` if `node_modules` is absent, then `npm run
typecheck`, `npm test`, `git diff --check`, `npm run build`), and only then start M3 from the
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M3 scope: assignment-management
UI over the learning-content repository that already exists — **UI only**, no new domain, no
invented content bytes, honest unavailable states where media is missing.

**M3's own spec makes one thing a precondition rather than a courtesy:** the still-open **I11**
`LearningPanel` flake must be triaged in that milestone, because M3 touches the same domain and the
same suites and a green run there is what makes any new run trustworthy. The two findings that M2
recorded and M2.1 fixed (**H6**, **H7**) no longer block anything; what M2.1 leaves behind is the
knowledge that `RepertoirePanel` and `PieceFormDialog` are now safe to build on — a piece's
`programId`, `rangeUnit` and `active` flag survive an edit, which is exactly what M3's assignment
surface reads.

Do **not** reopen M1: `clear()` semantics, the zero-record invariant (§8 / I10) and the api-mode
transparency of the gate are settled and pinned by tests. The M1 evidence lives in
[OPEN_ITEMS.md](OPEN_ITEMS.md) H5 (now landed) and [DECISIONS.md](DECISIONS.md) §8/§18/§19 (D3/D4).
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
| Waiting for a view in tests | Wait for the design system's in-flight marker — `role="status"`, from `BreathingWave` in `src/components/ds/states.tsx` — to disappear, **not** for the view title. The shell renders titles immediately while `useResourceList` may still have a read in flight, which is how I11's race worked. Query by role, never by the Persian label, so a copy change cannot turn the wait into a no-op |
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
