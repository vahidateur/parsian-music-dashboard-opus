# CONSOLIDATION CHECKPOINT — 2026-10-05 (canonical line)

> **Purpose.** This is the single durable evidence record for the consolidation that ended the
> two-line divergence. It exists so that a fresh reader — the owner in a local clone, or the next
> session — can see what was consolidated, what was verified, and what is still open, without
> re-deriving it from chat history.
>
> **This file is a union, not a replacement.** It carries the content of the Phase-5.6.2 checkpoint
> written on the second continuation line (`arena/01a0f73f-…` @ `7175336`) — reproduced **verbatim**
> in Appendix A below — merged with the state of the canonical line. Nothing was deleted from either
> record; where the two disagreed, the reconciliation rule in §2 was applied and the losing text was
> kept as history.
>
> **Nothing in this file changes code.** It records state as observed and as measured.
>
> **No self-referential SHAs.** This file cannot contain the SHA of the commit that carries it. The
> canonical tip is therefore always read with `git log -1 --format=%H` on the canonical branch; the
> commit directly below it is `bc1ef0ce935fa3c8ab6771a16c6de7ceb75a76b5`.

---

## 1. Canonical identity

| Item | Value |
|---|---|
| Canonical branch | `arena/01a10b63-parsian-music-dashboard-opus` |
| Canonical tip | the commit that carries this file — read it with `git log -1 --format=%H` |
| Parent of the canonical tip | `bc1ef0ce935fa3c8ab6771a16c6de7ceb75a76b5` (verified on the remote before the commit) |
| Commits on the canonical line above `main` | 101 + this commit |
| Consolidation base (both lines diverged here) | `7eba988a44ffd4ac38c40cc56b9f6717bc3787a7` |
| Second line, **preserved, not deleted** | `arena/01a0f73f-parsian-music-dashboard-opus` @ `717533624e00fe574e57ee3764a9fc7978d04a48` |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` — **untouched**, and an ancestor of the canonical tip |
| Backend tree hash (all three commits) | `4d3c1db5916529bc29865555abee3606534f8e8c` (a **tree** hash, not a commit) |
| Protected refs left untouched | `main`, `cleanup/demo-migration-lineage` (`86dab3f`), `backup/pre-f2-2026-09-29` (`62deb84`), `docs/demo-migration-plan` (`1b23336`) |

---

## 2. Reconciliation of the two continuation lines

Both lines were real, both were pushed, and neither was an ancestor of the other. The divergence
point is `7eba988`, which is an ancestor of both; `main` is an ancestor of both.

| | Line A — `arena/01a0f73f-…` | Line B — `arena/01a10b63-…` (canonical) |
|---|---|---|
| Tip | `7175336` | `bc1ef0c` + this commit |
| Commits above `7eba988` | 1 | 3 (`f4baf9a`, `883e0e2`, `bc1ef0c`) + this commit |
| Diff size above `7eba988` | 4 files, **+315 / −0** | 14 files, **+1122 / −30** |
| RBAC vocabulary | **23 ids — `progress.*` missing** | **25 ids, order-identical to the backend** |
| `progress.read` / `progress.write` | absent | present, with a non-vacuous parity guard |
| Vite dev proxy | present, `target` only | present, `target` + `changeOrigin: true` (needed for the backend vhost) |
| `.env.example` | proxy documented | proxy documented **plus** the `preview`-has-no-proxy rule |
| Unique artifacts | `CONSOLIDATION_CHECKPOINT.md` (this file's ancestor), a `SESSION_HANDOFF.md` live pointer | `CONSOLIDATION_REPORT.md`, `permissionParity.test.ts`, `demoPermissionPresentation.test.ts`, the RBAC/demo/race fixes |

**The rule applied, change by change:**

- Present in only one line → **preserved**.
- Present in both, different implementation → the behaviour-complete one wins, and the reason is
  recorded here (the proxy: `changeOrigin: true` is the correct form; a bare `target` rewrites
  nothing and leaves the `Host` header pointing at the dev server).
- Present in both, identical → kept once, never duplicated.

**Outcome.** Line B is the superset for every product artifact, so it is the canonical line. Line A
is **not** deleted and **not** rewritten; its remote ref still exists at `7175336`. Its two unique
documentation artifacts were merged into this canonical line: the checkpoint content is Appendix A
here, and a live pointer was added to `SESSION_HANDOFF.md`. The RBAC gap that line A never closed
(`progress.*`, I24) is closed on this line with a guard that fails CI on future drift.

---

## 3. Working-tree recovery at this checkpoint (environment fault, not a repo state)

The sandbox reverted the local **HEAD pointer** to `86dab3f` while the working tree held the content
of `bc1ef0c`, for the second time in this work's history. It was confirmed before acting, never
assumed:

| Check | Result |
|---|---|
| `git status --porcelain` | 39 `M` + 59 `??`, **0 deleted** |
| Blob-hash comparison, working tree vs `bc1ef0c` | **933 identical · 0 differ · 0 missing · 0 only-in-worktree** |
| Ancestry: `86dab3f` → `bc1ef0c` | **true** (`git merge-base --is-ancestor`) |
| `git stash list` before recovery | empty |

The `M`/`??` noise is a **stale-index artefact**: the index was populated with `bc1ef0c` blobs while
HEAD still pointed at `86dab3f`. No content was ever at risk.

**Recovery procedure used (non-destructive — no reset, no clean, no rebase, no cherry-pick, no force-push):**

1. **Manifest** written outside the repo: index listing, porcelain listing, and a sha1 of every
   working file (`/tmp/audit/manifest.worktree.sha1.txt`).
2. **Backup**: `git stash push --include-untracked` — a recoverable snapshot, kept (it is **not**
   dropped).
3. **Ancestry proof** (above) before touching HEAD.
4. **Fast-forward only**: `git merge --ff-only origin/arena/01a10b63-parsian-music-dashboard-opus`.
5. **Verification**: `HEAD = bc1ef0c` = the remote ref, `git status --porcelain` → **0 lines**.
6. **Restore check**: the stash was proved to contain **zero unique content** — its tracked part is
   identical to `bc1ef0c`, and all 96 untracked files it holds are blob-identical to the same paths
   in `bc1ef0c`. Nothing was discarded; the backup is simply redundant.

A second, milder environment fault was found and fixed the same way: this working copy was missing
the two preserved-branch commit objects, which made `src/__tests__/projectState.test.ts` fail
**1 test** (the gate was right; the clone was incomplete). `git fetch origin --tags` plus a fetch of
all heads made both objects resolvable and the suite green. See §13.

---

## 4. Verification gates measured at this checkpoint

Every number below was **executed in this pass**, at the canonical tip, with `dist/` absent.

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0**, no output |
| Full frontend suite, artifact-free | **206 files passed (206) · 2666 passed · 0 failed · 18 skipped (2684) · exit 0** (398 s) |
| `npm run build` (bare) | success |
| `npm run build:client` | success |
| `npm run build:demo` | success |
| Files in `dist/` | 125 |
| Files in `dist/` containing `127.0.0.1:8080` | **0** |
| Files in `dist/` containing `127.0.0.1` at all | **0** |
| Files in `dist/` containing `changeOrigin` | **0** ⇒ the proxy is dev-only by construction |
| `dist/` after measurement | **removed** — the canonical tree is artifact-free |
| `git status --porcelain` after the pass | **0** (clean) |

---

## 5. RBAC — one contract, 25 ids

Independently re-derived in this pass from the shipped files, not from a summary: a standalone
parser read `backend/config/permissions.php` and `src/domains/auth/permissions.ts`.

| Check | Result |
|---|---|
| Vocabulary size | **25 == 25** |
| Vocabulary order | **identical** |
| `READ_ONLY_CORE` ↔ `$readOnlyCore` | identical — `students.read, teachers.read, classes.read, schedule.read, library.read, progress.read` |
| `progress.read` / `progress.write` in both | **yes** |
| administrator | all 25, including `demo.manage` |
| manager | 20 — includes both `progress` ids |
| teacher | both `progress` ids |
| staff | `progress.read` only |
| accountant | none |
| `demo.manage` holders | **administrator only** |

**The pass's principal defect (I24).** The frontend vocabulary had **23** ids while the backend had
25 — `progress.read`/`progress.write` were missing although DECISIONS §29 authorized them on
2026-10-03. The frontend matrix now matches §29 exactly, and `permissionParity.test.ts` **parses the
shipped PHP** and compares values, so a future drift fails CI instead of being re-discovered. The
guard is non-vacuous: it fails on the pre-fix tree.

**Authorization is not filtered, it is re-checked.** `ViewOutlet` re-verifies `canAccess(view)` at
render time and **fails closed**, offering `defaultViewFor`; `routeProtection.test.tsx` covers the
deep-link case and the hidden-navigation case.

---

## 6. Demo — not offered by the production-facing product

Twelve invariants were re-verified statically at this pass (the same list the brief demands):

| # | Invariant | Result |
|---|---|---|
| 1 | Client registry imports no demo/store module | **0 matches** in `registry.client.ts` |
| 2 | Architecture-boundary gate exists | present (`architectureBoundaries.test.ts`) |
| 3 | Bundle-boundary gate exists | present (`bundleBoundary.test.ts`, scans the real `dist/client`) |
| 4 | `createUnavailableRepository` rejects | `Promise.reject` with `DOMAIN_UNAVAILABLE` |
| 5 | `DOMAIN_UNAVAILABLE` defined | yes |
| 6 | Unavailability is not retryable as a network error | `kind: "unknown"` |
| 7 | ConfigGate fails closed on an unknown data source | yes |
| 8 | `VITE_DATA_SOURCE=demo` retained intentionally | yes (`.env.example`, unchanged value) |
| 9 | Seeds/fixtures/backend demo infrastructure not deleted | **0 deletions** on either line |
| 10 | `demo.manage` held by administrator only | verified (§5) |
| 11 | Demo presentation absent from the client build | yes — `SettingsFeatures → null`, gated by composition |
| 12 | No silent API → demo fallback | none: the unavailable repository rejects, it does not substitute data |

**DECISIONS §31** records the one leak that remained and was fixed: the shared role editor offered an
administrator a «مدیریت دادهٔ نمایشی» checkbox in a composition with **no** demo dataset — a
presentation leak, not an authorization one. It is filtered by composition, and
`demoPermissionPresentation.test.ts` pins both directions (withheld in the client build, retained in
the demo build).

---

## 7. Gallery — PARTIAL by decision, not a defect

| Layer | State |
|---|---|
| Route + `ViewOutlet` guard | implemented |
| Action guard | `useCan("library.write")` |
| Teacher visibility | hidden in `Sidebar.tsx` (`TEACHER_HIDDEN_VIEWS`) |
| Dedicated `gallery.*` permission | **absent** — borrows `library.read` / `library.write` |
| `gallery/apiRepository.ts` | **absent** |
| Backend route / policy / model / migration | **absent** |
| `UNAVAILABLE_DOMAINS` | lists `gallery`; the client registry returns `unavailable<GalleryRepository>("gallery")` |

**O-03 remains OPEN** (`docs/frontend-completion/13-open-decisions.md`). Until it is decided, no
`gallery.*` permission, no fake API and no fake scope is invented. The access model is truthful:
the view is reachable, its data layer honestly reports unavailability, and the documentation says so.

---

## 8. Tickets / Chat — intentionally unified

`O-07` remains OPEN and its recorded option is the behaviour in the code: **conversation = ticket,
archived = closed**. F6 is therefore **PARTIAL / intentionally unified** — not a "missing tickets
module", and not a regression.

---

## 9. F1–F6 at this checkpoint

| Phase | Verdict | Evidence |
|---|---|---|
| F1 | implemented | `F1_REPORT.md` + `F1_INVENTORY.md`; Gallery panel present with the limits in §7 |
| F2 | implemented | `scope.ts` (20 predicates) consumed by production modules; `failureDisclosureI15`, `routeProtection` |
| F3 | implemented | `src/domains/branding/` + tests |
| F4 | implemented | `src/domains/export/` + tests |
| F5 | implemented | `dashboardInsights`, `useDashboardInsights`, panel empty-state tests |
| F6 | **partial — by decision** | chat + `Messages.tsx`; tickets unified per §8 |

---

## 10. I22 / I23 / I24 and documentation drift

| Item | Code | Canonical documents | Line A's documents (drift) |
|---|---|---|---|
| **I22** — export half of `ImportExportCenter` never renders | fixed, re-verified against the tree | **CLOSED** with evidence (`OPEN_ITEMS.md`) | still recorded OPEN |
| **I23** — `SchedulingTest` reschedule date-flake | fixed (`deb7f0c`) + hardened fixtures + regression guard | **CLOSED** with CI evidence | still recorded OPEN |
| **I24** — 23-vs-25 RBAC drift (`progress.*`) | fixed + parity guard | **CLOSED** (this line) | **not recorded at all** |

No code was rolled back to make a document true. The drift that remains is historical text inside
old handoff regions, which this pass did not rewrite; the live pointers and current-state rows now
name the canonical state.

---

## 11. Phase 5.6.2 — dev-only Vite proxy, and `.env.example`

`vite.config.ts` maps `/api` → `http://127.0.0.1:8080` with `changeOrigin: true`.

- **Dev-only by construction**: `server.proxy` is read by the dev server; it is not an input to the
  build. Measured: **0** files in `dist/` contain `127.0.0.1:8080` or `changeOrigin` (§4).
- **Same-origin**: the browser keeps calling the origin that served the panel, so no CORS
  configuration is added and the shipped CSP (`connect-src 'self'`) still holds.
- **No rewrite**: `/api/v1/...` is forwarded verbatim.
- **`preview` gets no proxy, deliberately**: a preview of the built client is a static-artifact
  check, and forwarding its `/api` calls would disguise an unconfigured deployment as a wired one.

`.env.example` documents this and nothing else: the three assignments are unchanged
(`VITE_DATA_SOURCE=demo`, `VITE_API_BASE_URL=/api/v1`, `VITE_ACCESS_PATH=`) and no credential or
value was added. This is the union of both lines' comments, not a duplicate: line B's version is the
superset (it adds the `preview` rule and the `changeOrigin` rationale).

---

## 12. Backend — what is verified, and how

| Item | State |
|---|---|
| Backend source in this pass | **byte-identical** to `7eba988` (tree hash `4d3c1db…`) |
| Backend suite, locally | **BLOCKED BY ENVIRONMENT** — no PHP, no Composer, no MySQL in the sandbox. Never claimed as run |
| CI evidence | run **37240671916** (and 37217800083) on `7eba988`: **success**, 5 checks, including *MySQL 8 — connection, migrations, P-2 indexes, test suite* and *HTTP smoke — T-02 / PB-1 / PB-3 / scheduling / attendance* |
| CI at the tips | **none exists** — the workflow triggers on `backend/**` only, and neither tip touches `backend/` |
| Therefore | **PASS by inherited CI evidence, not locally re-executed** — valid only because the backend tree hash is identical, which is the reason it is recorded explicitly |
| P-2 | migrations untouched; `255 × 4 × 3 = 3060 ≤ 3072`, gate in CI (`phpunit.mysql.xml`) |
| 422-before-write | `OrganizationTest.php` asserts `422` + `ORGANIZATION_INVALID` + `error.fields.workingDayStart` **and** that the stored row is unchanged (`assertSame` against a fresh read) |

---

## 13. Test baseline and its environment preconditions

```text
declared baseline (pre-consolidation)   204 files · 2654 passed · 18 skipped · 0 failed
measured here, artifact-free            206 files · 2666 passed · 18 skipped · 0 failed
delta                                   +2 files ·  +12 tests ·   0         ·  0
```

- The **+2 files / +12 tests** are this line's own coverage — `permissionParity.test.ts` (6) and
  `demoPermissionPresentation.test.ts` (6) — and nothing else. They were not duplicated on top of
  line A's work; line A never had them.
- **Skips are unchanged at 18**: nothing was hidden, disabled or skipped to reach green.
- **Artifacts change the count, by design**: with all three builds present, the artifact-conditional
  groups run (previously recorded as 2680 passed / 4 skipped). §19 of the brief asks for the
  artifact-free figure as the true baseline, so `dist/` was removed before measuring and removed
  again afterwards.
- **One failure occurred on arrival and was environmental, not a regression.** The first full-suite
  run of this pass reported **2665 passed / 1 failed**: `projectState.test.ts` asserted that the
  preserved-branch tip `251af96f…` — a commit history deliberately never merged — is present in the
  clone, and this clone lacked it. `git fetch origin --tags` plus a fetch of all heads made it
  resolvable, and the re-run was clean **2666/0**. The test was right; the clone was incomplete.
  A fresh shallow or tag-less clone will fail that gate for the same reason — that is a precondition
  to record, not a bug to fix.

---

## 14. Known limitations / UNVERIFIED

- **Backend runtime**: not installed; nothing backend-related was executed here. UNVERIFIED locally,
  covered only by the inherited CI evidence in §12.
- **Browser QA**: NOT VERIFIED. No manual browser pass is claimed.
- **Gallery backend**: does not exist (by decision, §7).
- **Finance / Reports backend**: does not exist (`I2`, deferred).
- **The `dist/` probes** were measured in this pass, but the artifacts are deliberately not kept.
- **CI for the frontend**: none exists — only `backend-tests.yml`. **OPEN / decision required**; no
  workflow was invented here.

---

## 15. Remaining OPEN items

1. **O-03** — library/gallery visibility decision.
2. **O-07** — whether Tickets should separate from Chat.
3. **I19** — frontend analogue in the scheduling area (recorded in `OPEN_ITEMS.md`, lower priority).
4. **Finance / Reports** — no backend (`I2`, deferred).
5. **Gallery backend** — dedicated permission + tenant scoping + API, gated on O-03.
6. **Frontend CI** — no workflow covers `src/`; runs are local-only.
7. **Browser QA** — not performed.

---

## 16. Documentation map (canonical, after this pass)

| Document | Role |
|---|---|
| `CONSOLIDATION_REPORT.md` | the full evidence inventory of the consolidation pass |
| `CONSOLIDATION_CHECKPOINT.md` (this file) | the transferable checkpoint: identity, reconciliation, gates, open items |
| `SESSION_HANDOFF.md` | live pointer at the top; all older pointers preserved below it |
| `PROJECT_STATE.md` | current identity/branch/checkpoint rows + dated state updates |
| `DECISIONS.md` | §29 RBAC contract, §31 demo presentation; **§32** records this reconciliation |
| `OPEN_ITEMS.md` | I22 / I23 / I24 closed with evidence |
| `PHASES.md` | the ledger; this checkpoint is registered as pending (no self-referential SHAs) |
| `GOVERNANCE_CHECKPOINT.md` | the Laravel-bound register, reached via DECISIONS §20 |

---

## 17. Exact local sync commands

```bash
# 1. fetch — the canonical branch and, for the state-document gate, tags and all heads
git fetch origin arena/01a10b63-parsian-music-dashboard-opus
git fetch origin --tags
git fetch origin '+refs/heads/*:refs/remotes/origin/*'

# 2. check out the canonical branch (or fast-forward it; never reset, never re-clone)
git switch arena/01a10b63-parsian-music-dashboard-opus
git merge --ff-only origin/arena/01a10b63-parsian-music-dashboard-opus

# 3. verify identity and cleanliness
git log --oneline -3
git status --porcelain          # must print nothing
git ls-remote origin refs/heads/arena/01a10b63-parsian-music-dashboard-opus
git ls-remote origin refs/heads/main    # must still be 15775ea…

# 4. reproduce the gates
npm ci
npx tsc --noEmit
npx vitest run                  # expect 206 files · 2666 passed · 18 skipped · 0 failed
npm run build && npm run build:client && npm run build:demo
grep -rl "127.0.0.1:8080" dist | wc -l   # expect 0
rm -rf dist                     # keep the tree artifact-free
```

---

## 18. Main merge readiness

**READY FOR MAIN — fast-forward only, and only on the owner's explicit instruction.**

| Item | Value |
|---|---|
| Canonical branch | `arena/01a10b63-parsian-music-dashboard-opus` |
| Canonical tip | this commit — `git log -1 --format=%H` |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` (**untouched**) |
| Merge base with `main` | `15775ea…` (i.e. `main` is an ancestor — **no merge commit is needed**) |
| Ahead / behind | ahead by 102, behind by 0 |
| Expected strategy | `git merge --ff-only` (or a PR set to fast-forward) — **never** a force-push, never a rebase of `main` |
| Blocking items | none in code. O-03 / O-07 / I19 / Finance-Reports / Gallery-backend stay OPEN **after** the merge; they are product decisions, not merge blockers |

**This checkpoint does not merge to `main`.** `main` is untouched until the owner says otherwise.

---

## 19. Next session handoff

1. **Do not create a new line.** The canonical branch is `arena/01a10b63-parsian-music-dashboard-opus`;
   line A's branch remains as history and is not to be deleted.
2. **Read `git log -1 --format=%H` for the tip** — never trust a SHA pasted anywhere, including here.
3. **Next work, in order:** owner's decision (if any) → merge `main` by fast-forward → then O-03 →
   O-07 → Finance/Reports (I2). Do not start a feature without authorization.
4. **Keep the invariants**: `main` untouched until authorized, no force-push, no destructive Git,
   no secrets, no generated artifacts in Git, no test weakened to reach green.

---

## Appendix A — the other line's checkpoint, verbatim

The content below is reproduced **verbatim** from `docs/engineering/CONSOLIDATION_CHECKPOINT.md` at
`717533624e00fe574e57ee3764a9fc7978d04a48` (line A). Its own H1 is preserved on purpose: this is a
historical record, not this file's title. Read its "still OPEN" section as the state **at that
checkpoint** — I22/I23/I24 and the Progress matrix have since been closed on the canonical line (§10),
and its Phase-5.6.2 proxy is present here in the behaviour-complete form (§11).

# CONSOLIDATION CHECKPOINT — 2026-10-05

> **Purpose.** This is the evidence record for the consolidation checkpoint on
> `arena/01a0f73f-parsian-music-dashboard-opus`. It exists so that a reader who
> arrives fresh — including the owner, working from a local clone — can see what
> was verified, what was found, and what is still open, without re-deriving it
> from chat history.
>
> **Nothing in this file changes code.** It records state as observed.

---

## 1. Checkpoint identity

| Item | Value |
|---|---|
| Branch | `arena/01a0f73f-parsian-music-dashboard-opus` |
| Base of this branch | `7215633` (on `cleanup/demo-migration-lineage`) |
| Remote tip before this checkpoint | `7eba988` |
| Commits consolidated | 55 (`7215633..7eba988`) |
| Phase 5.6.2 delta | 2 files, +37 lines, 0 deletions |
| Protected refs left untouched | `main` (`15775ea`), `cleanup/demo-migration-lineage` (`86dab3f`), `backup/pre-f2-2026-09-29` (`62deb84`), `docs/demo-migration-plan` (`1b23336`) |

---

## 2. Working-tree recovery evidence

The sandbox repeatedly reverted the local HEAD pointer to `7215633` while the
working tree held the content of `7eba988`. This is an environment fault, not a
repository state — it was confirmed, not assumed:

| Check | Result |
|---|---|
| GitHub API `compare/7215633...7eba988` | `status: ahead`, **`behind_by: 0`**, `ahead_by: 55`, merge-base `7215633` |
| Local ancestry | `git merge-base --is-ancestor 7215633 7eba988` → true |
| Byte-compare of all 930 tracked files against `7eba988` | **928 identical, 2 differing, 0 missing** |
| The 2 differing files | exactly `vite.config.ts` and `.env.example` — the intended Phase 5.6.2 changes |
| The 93 apparently "untracked" files | an artefact of the stale git index; all 93 are tracked at `7eba988` |

**Recovery procedure used (non-destructive, no reset/rebase/cherry-pick/force-push):**

1. sha256 manifest of all 930 files → preserved outside the repo
2. byte-copy of the 2 modified files → preserved outside the repo
3. `git fetch --unshallow` + `git fetch origin '+refs/heads/*:refs/remotes/origin/*'` + `git fetch origin --tags`
4. `git stash push --include-untracked` (recoverable snapshot)
5. `git merge --ff-only origin/arena/01a0f73f-parsian-music-dashboard-opus`
6. byte-compare post-recovery against the pre-recovery manifest → identical except the 2 intended files

Result: `HEAD = 7eba988`, `ahead = 0`, `behind = 0`, working tree clean except
the two Phase 5.6.2 files.

---

## 3. Phase 5.6.2 — the committed delta

### `vite.config.ts` (+30)

Adds `server.proxy` mapping `/api` → `http://127.0.0.1:8080`.

- **Dev-only.** `server.*` is read by the Vite dev server; `vite build` never
  reads it. Verified: both production bundles contain **zero** occurrences of
  `127.0.0.1:8080`.
- **Same-origin**, so the shipped CSP `connect-src 'self'` still holds and **no
  CORS configuration is required** on the Laravel side.
- **No rewrite, no path stripping** — `/api/v1/...` is forwarded verbatim,
  which is exactly what `VITE_API_BASE_URL=/api/v1` already sends.
- Port 8080 is the port `deploy/nginx.conf` and `docs/engineering/BACKEND_STATUS.md`
  already agree on.
- Does **not** change which data source is selected; that remains
  `VITE_DATA_SOURCE`, whose demo default is untouched.

Why it matters: without it, `VITE_DATA_SOURCE=api` under `npm run dev` is a
trap — Vite has no `/api` route, so its SPA fallback answers `200` with
`Content-Type: text/html`. The client then fails parsing HTML as JSON, which
reads like a broken backend rather than a missing one.

### `.env.example` (+7)

Documentation comments only. **No value changed.** The three assignments remain
`VITE_DATA_SOURCE=demo`, `VITE_API_BASE_URL=/api/v1`, `VITE_ACCESS_PATH=`.

---

## 4. Verification gates (all re-run at this checkpoint)

| Gate | Result |
|---|---|
| Frontend test suite (with `dist/` removed) | **204 files, 2654 passed, 18 skipped, 0 failed** |
| `npm run typecheck` | **0 errors** |
| `npm run build:demo` | success, 43 files, **0** × `127.0.0.1:8080` |
| `npm run build:client` | success, 39 files, **0** × `127.0.0.1:8080` |
| `127.0.0.1` anywhere in `dist/` | **0 files** |
| `git diff --check` | clean |
| Backend CI at `7eba988` (5 checks) | all **success**, including *MySQL 8 — connection, migrations, P-2 indexes, test suite* and *HTTP smoke — T-02 / PB-1 / PB-3 / scheduling / attendance* |

Backend runtime verification is **environment-blocked** in Arena: no PHP, no
Composer, no MySQL. Per the phase rule this is marked blocked rather than
claimed, and relies on the established CI evidence above.

---

## 5. Repository-vs-requirements audit (read-only, audits e & f)

Performed against baseline `afa84d6`. No code was changed by either audit.

### 5.1 Gallery — **PARTIAL**

| Layer | State |
|---|---|
| Route (`App.tsx:64` `gallery: GalleryView`) | implemented |
| Route guard (`ViewOutlet`, `App.tsx:69`) | implemented, **frontend-only** |
| Action guard (`Gallery.tsx:55` `useCan("library.write")`) | implemented, **frontend-only** |
| Dedicated `gallery.*` permission | **missing** — borrows `library.read` |
| `gallery/apiRepository.ts` | **missing** |
| Backend route / policy / model / migration | **missing** |
| Tenant scoping in `localRepository.ts` | **missing** |
| Tests asserting Gallery authorization | **zero** |

Provenance: no Gallery API client, backend controller, policy, or migration
exists on **any** local commit, remote branch, or tag. This is therefore
**never implemented**, not "lost in history" — it needs new work, not recovery.

Computed role→view matrix: `gallery` requires `library.read` ⇒ accessible to
administrator, manager, teacher, staff; denied to accountant. Gallery mutations
require `library.write` ⇒ **administrator and manager only**. No `student` role
exists in the vocabulary at all (`ROLES = administrator, manager, teacher,
staff, accountant`).

### 5.2 Tickets — **deliberately unified with Chat, not missing**

An earlier reading classified Tickets as missing on the basis of zero files.
Closer inspection shows this is an intentional design decision, not an omission:

- The spec (`docs/frontend-completion/10-integration-architecture.md:110`) states
  *"No tickets vs chat distinction — chat is tickets currently — needs decision …
  OPEN."*
- The code implements it: `ChatConversation` carries `archived?: boolean` and
  `subjectId?: string`, and `archiveConversation()` is documented as reversible.
- Mapping: **conversation = ticket**, **archived = closed**.

Open item **O-07** (whether to separate tickets from chat) remains OPEN.

### 5.3 Previously-completed phases F1–F6

| Phase | Verdict | Evidence |
|---|---|---|
| F1 | implemented | Gallery panel present (see §5.1 for its limits) |
| F2 | **implemented** | `src/domains/auth/scope.ts` exists with 20 exported predicates, consumed by 5 production modules; `failureDisclosureI15.test.tsx` and `routeProtection.test.tsx` present |
| F3 | **implemented** | `src/domains/branding/`, `ManualColorsPanel.tsx`, `Settings.tsx` |
| F4 | **implemented** | `src/domains/export/`, `ImportExportCenter.tsx`, export tests |
| F5 | **implemented** | `dashboardInsights.ts`, `useDashboardInsights.ts` |
| F6 | **partial** | chat + `Messages.tsx` present; Tickets as described in §5.2 |

### 5.4 Feature inventory — 20 product areas

- **Frontend + backend:** Auth/RBAC, Students, Teachers, Scheduling, Files/Media, Settings, Admin-only
- **Frontend only:** Dashboard, Messages, Chat, Gallery, Branding/Theme, Export, Reports, Finance, Workflow/Compensation, Learning
- **Partial:** Calendar (unbacked `apiRepository`); org/tenant scoping (backend has `ResolveTenant` + `TenantContext`; several frontend domains lack it)
- **No backend at all:** Finance, Reports (both deferred, marked `I2`)

### 5.5 Documentation drift (docs left unedited — recorded, not fixed)

| Item | Docs say | Code does |
|---|---|---|
| **I22** | OPEN | fixed, with a regression guard at `src/views/__tests__/phaseBMutationGuards.test.tsx:123` |
| **I23** | OPEN | fixed, with a regression guard at `backend/tests/Feature/SchedulingTest.php:398`; `ConflictDetector::overlappingSessions()` excludes the candidate via `whereKeyNot()` |
| **Gallery permission** | O-03 OPEN, spec says "for now public demo" | code silently borrows `library.read` — an unrecorded decision |
| **Progress matrix** | documented complete | backend complete, frontend incomplete |

---

## 6. Invariants confirmed intact

| Invariant | Location | State |
|---|---|---|
| `if (!admin) throw` | `src/views/__tests__/honestWriteCopy.test.tsx:121` | intact |
| `SEED_DATE` | pinned `"2026-09-01"` | untouched |
| P-2 index limit (3060 ≤ 3072) | documented at `backend/phpunit.mysql.xml:15-16`; 18 migrations | untouched |
| StudentLearningPanel async-race fix | 7 × `findBy*` in the test | intact |
| DemoDataPanel | mounted at `src/targets/targetFeatures.tsx:81` | **0 modifications** |
| ConfigGate fail-closed | unknown `VITE_DATA_SOURCE` ⇒ `error` | intact |
| `useCan` call sites | 26 | unchanged |
| m10 / `AUTHORIZATION_MODULE` boundary | `src/__tests__/m10Boundary.test.ts:57` | intact |
| Backend/production code dirty at commit | `backend/` = 0, `src/` = 0, migrations = 0 | clean |

---

## 7. Secrets

No secrets. A pattern scan of the two committed files matched only the words
"secret" and "credential" inside **comments**. No `.env` file is tracked. The
only values in `.env.example` are the three documented assignments.

---

## 8. Still open — carried forward deliberately

These are recorded, not resolved. This checkpoint does not change any of them.

1. **O-03** — library/gallery visibility decision.
2. **O-07** — whether Tickets should be separated from Chat.
3. **Gallery** — needs a dedicated permission, tenant scoping, and a backend.
4. **Finance / Reports** — no backend (`I2`, deferred).
5. **I22 / I23** — fixed in code, still marked OPEN in `OPEN_ITEMS.md`.
6. **Progress frontend/backonend matrix** — mismatch not reconciled.

Recommended order, **not started**: close O-03 → add `gallery.read`/`gallery.write`
on both sides → backend migration + Policy + Controller → `GalleryApiRepository`
and registry wiring → tenant scoping → Gallery RBAC tests → frontend/backend
matrix-parity test → Tickets → Finance/Reports → close I22/I23 in docs.
