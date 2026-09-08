# PROJECT STATE — recovery document

> **Read this first.** It is the durable hand-off between agent sessions. Conversation
> memory is not durable; this file, the Git history and the test suite are.
>
> Sibling documents: [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md)
>
> **Last state update: 2026-09-09.**

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
| **Phase checkpoint (application)** | `33b10311f0d3a38745b4d0c00f22e4f63665888d` — Phase 2, approved and pushed |
| Previous phase checkpoint | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` — Phase 1, approved and pushed |
| **Documentation checkpoint (pushed)** | `77b019ef07f99817da985e1602dd11365b4b9365` — the audit-correction pass: these documents, their validation gate, and the EMPTY login labels |
| Previous documentation checkpoint | `68b4fe339582211c23c422befe527a98203031ef` — the first one: these documents and their validation gate |
| Baseline commit | `292b8b86ce7dd328b3a1510047f994e39c443a4e` (shallow-clone graft boundary) |
| Remote state | **Deliberately not recorded as a value — verify it instead:** `git ls-remote origin refs/heads/<branch>` must return local `HEAD`, or an ancestor of it. Anything else means someone else pushed, or this clone is stale |

### Two kinds of checkpoint

- A **phase checkpoint** is a durable *application* milestone: a reviewed, approved and pushed
  commit that ends a phase of product work. `33b1031` (Phase 2) is the current one, and only a
  phase checkpoint advances "current phase" in §3.
- A **documentation checkpoint** is a pushed commit that changes documents and validation gates
  but no product behaviour. Two exist so far: `68b4fe3` (these documents and their gate) and
  `77b019ef` (the audit-correction pass, which also made the EMPTY login screen's *labels*
  truthful — the one permitted exception, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) H3). They are
  listed in [PHASES.md](PHASES.md) → "Documentation checkpoints" so that `git log` never shows a
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
| Current phase | **Phase 2 — data lifecycle (UNINITIALIZED / EMPTY / DEMO)** |
| Phase status | ✅ **COMPLETE**, committed as `33b1031`, pushed to the working branch |
| Next phase | Product-feature phase — ❌ **NOT STARTED**, not authorized yet |
| Working tree | Clean at every recorded checkpoint — **verify, do not trust**: `git status --porcelain` must print nothing |

Nothing here is advanced by a documentation checkpoint (§2): only a reviewed, approved and pushed
*phase* moves "Current phase", which is why it still reads Phase 2 after the audit pass.

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

### Work landed since the Phase 2 checkpoint

Documents and validation gates, one labelling fix and one test-harness fix — **no product feature
work**:

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

The commits themselves are listed in [PHASES.md](PHASES.md) → "Documentation checkpoints"; this
file never records the SHA of the commit carrying the edit (§2).

## 4. Validation status

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

**Current state of the suite** (measured in the working tree of this pass, with `dist/` present):
`npm test` reports **93 files / 1 315 passed / 0 failed / 0 skipped**, `npm run typecheck` is
clean, `npm run build` succeeds, `git diff --check` is clean. The arithmetic from the Phase 2
baseline, so the number can be audited rather than trusted:

| Step | Files | Tests |
|---|---|---|
| Phase 2 checkpoint `33b1031` | 91 | 1 255 |
| + `src/__tests__/projectState.test.ts` (the gate over these documents) | 92 | 1 284 |
| + `src/views/__tests__/loginEmptyEnvironment.test.tsx` (8 gates, EMPTY login) | 93 | 1 292 |
| + 16 gates added to `projectState.test.ts` by the audit corrections | 93 | 1 308 |
| + 7 gates added to `projectState.test.ts` by the harness-race record (this pass) | 93 | **1 315** |

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
5. **`clear()` produces an environment nobody can sign into, and there is NO in-product recovery.**
   It empties `users`, so no account remains, while the lifecycle marker survives — so
   `DataLifecycleGate` stays transparent and the visitor lands on a login screen that cannot
   succeed. Settings, and therefore "restore a backup", sits *behind* that login and is unreachable
   too. `uninitializeEnvironment()` exists (`src/domains/demo/lifecycle.ts`) and is exposed as
   `demoDataManager.uninitialize()`, but **no component calls it**: the Settings panel wires only
   `reset | clear | import-seed | restore-backup` (`src/domains/demo/useDemoData.ts:29`). The only
   recovery today is from outside the product — deleting the `ava:demo:*` keys by hand, or calling
   the manager from a dev console. Pre-existing behaviour, deliberately unchanged here; tracked as
   **H5** in [OPEN_ITEMS.md](OPEN_ITEMS.md).
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

## 8. Deferred work

Everything not finished is catalogued, categorised and evidenced in
**[OPEN_ITEMS.md](OPEN_ITEMS.md)**. Nothing there has been silently converted into completed
work, and no item may be removed from that file without either landing it or recording why it
was dropped.

## 9. Immediate next action

**The product-feature phase — NOT STARTED, and it requires explicit authorization plus its
spec before any code is written.**

When authorized, the first step is *not* implementation: re-read [OPEN_ITEMS.md](OPEN_ITEMS.md),
confirm the recorded checkpoints against Git (§2, and the recovery contract at the end of this
file), re-run the validation commands in §4 to establish a green baseline, and only then start from
the CRITICAL/HIGH items — wiring the Scheduling and Attendance views to their existing domains and
removing fake-success UX (`src/views/Scheduling.tsx:144`, `src/views/Scheduling.tsx:327`,
`src/views/Attendance.tsx:46`, `src/views/Finance.tsx:98`, `src/views/Finance.tsx:285`).

Among those items, **H5** — no in-product recovery from an environment `clear()` has made unusable —
is the one that can cost a customer their data. Sequence it first, or defer it explicitly and in
writing inside [OPEN_ITEMS.md](OPEN_ITEMS.md).

Until that authorization arrives: **do not start it.**

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
