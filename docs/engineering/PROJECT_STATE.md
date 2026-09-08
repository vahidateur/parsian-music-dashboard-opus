# PROJECT STATE — recovery document

> **Read this first.** It is the durable hand-off between agent sessions. Conversation
> memory is not durable; this file, the Git history and the test suite are.
>
> Sibling documents: [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md)
>
> **Last state update: 2026-09-08.**

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
| **Current durable checkpoint** | `33b10311f0d3a38745b4d0c00f22e4f63665888d` — Phase 2, approved and pushed |
| **Previous durable checkpoint** | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` — Phase 1, approved and pushed |
| Baseline commit | `292b8b86ce7dd328b3a1510047f994e39c443a4e` (shallow-clone graft boundary) |
| Remote state | `origin/arena/01a07c61-parsian-music-dashboard-opus` = `33b1031` at the time of writing |

A **durable checkpoint** is a commit that has been reviewed, approved and pushed. The
docs-only commit that introduced this file sits on top of `33b1031` and is *not* itself a
checkpoint; the recorded checkpoint advances only when a phase is approved and pushed.

⚠️ **This clone is shallow** (`292b8b8` is grafted, only 3 commits were reachable before
Phase 2). Older history must be read on GitHub, not assumed locally. The clone's fetch
refspec is limited to `main`, so `refs/remotes/origin/arena/…` may not exist locally —
verify the remote with `git ls-remote origin refs/heads/<branch>` instead.

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

## 3. Current phase and status

| Field | Value |
|---|---|
| Current phase | **Phase 2 — data lifecycle (UNINITIALIZED / EMPTY / DEMO)** |
| Phase status | ✅ **COMPLETE**, committed as `33b1031`, pushed to the working branch |
| Next phase | Product-feature phase — ❌ **NOT STARTED**, not authorized yet |
| Working tree at last update | Clean (0 modified, 0 untracked, 0 staged) |

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

**After this documentation commit** (docs + one validation test, no application source):
`npm test` reports **92 files / 1 284 passed / 0 failed**, and `npm run typecheck` is clean.
The added file is `src/__tests__/projectState.test.ts` (29 tests) — it validates these four
documents. `npm run build` was **not** re-run, because no application source changed; the Phase 2
build result above still stands. Re-run it whenever you touch `src/` outside `__tests__`.

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
5. **`clear()` produces an environment nobody can sign into** (it empties `users` too).
   Pre-existing. Recovery path: `uninitialize` (choose again at first run) or restore a backup.
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
confirm the recorded checkpoint against Git (§10), re-run the validation commands in §4 to
establish a green baseline, and only then start from the CRITICAL/HIGH items — wiring the
Scheduling and Attendance views to their existing domains and removing fake-success UX
(`src/views/Scheduling.tsx:144`, `src/views/Scheduling.tsx:327`, `src/views/Attendance.tsx:46`,
`src/views/Finance.tsx:98`, `src/views/Finance.tsx:285`).

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
- Do **not** branch on `isDemo`/`isDemoEnvironment` inside domain views; lifecycle lives in one
  boundary and reaches components only through `src/domains/demo/useDataLifecycle.ts`.
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
8. **Re-establish a green baseline before changing anything**: `npm install` if `node_modules`
   is missing, then `npm run typecheck`, `npm test`, `git diff --check` (add `npm run build`
   only if you touch application source).
9. **Update this file when a durable checkpoint or phase changes** — and update
   [PHASES.md](PHASES.md) / [OPEN_ITEMS.md](OPEN_ITEMS.md) in the same commit, so the ledger
   never contradicts the state. `src/__tests__/projectState.test.ts` fails the suite if the
   recorded checkpoint is not a real reachable commit, if required sections disappear, or if a
   secret is pasted into these documents.
