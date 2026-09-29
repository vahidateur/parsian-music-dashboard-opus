# PHASE 2A — READ-ONLY RE-AUDIT OF THE CURRENT CHECKOUT

Date: 2026-09-28 · Mode: read-only (no source file modified, no commit, no ref change)
Scope: the actual working tree at `/home/user/parsian-music-dashboard-opus`
Verdict: **PHASE 2A — BLOCKED** (same two external gates; plus a newly confirmed branch/lineage drift, §C)

---

## A. CURRENT STATE (measured now, not carried over)

| Fact | Measured value |
|---|---|
| Branch | `arena/01a0e8ec-parsian-music-dashboard-opus` |
| HEAD | `eb973eb2758447eff16b60ab4fd4c267f9d85061` — *feat: complete gallery library resource architecture* (2026-09-23) |
| Clone | **shallow**, `git log` = 1 commit; `main` tip = `eb5b559` (2026-09-27, *Merge PR #19 from `arena/01a0e27f`*) |
| HEAD vs main | **divergent**: `eb5b559` is *not* an ancestor/descendant of `eb973eb` (1 commit each way in the shallow graph) |
| Worktree | 78 modified tracked + 19 untracked (18 WIP + this session's `PHASE_2A_FINAL_REPORT.md`) |
| Stashes / extra worktrees | 0 stashes · 1 worktree (the repo itself) · temp audit worktree created **and removed** during this audit |
| Commits made | none — HEAD still `eb973eb`; reflog shows only the clone + branch checkout |
| `node_modules`, `dist/` | **absent at audit start** (sandbox does not persist them) → `npm ci` + builds re-run to make the gates measurable |
| `npm ci` | ✅ |
| `npm run typecheck` | ✅ 0 errors |
| `npm run build:client` | ✅ |
| `npm run build:demo` | ✅ |
| `npm run build` (default demo → `dist/`) | ✅ |
| `npx vitest run` (full, after a real `dist/`) | **2 failed files · 11 failed / 2396 passed / 2 skipped (2409)** |
| Failing files | `src/__tests__/projectState.test.ts` (10) · `src/__tests__/bundleBudget.test.ts` (1) |
| `git diff --check` | ✅ clean |

**Availability of the Phase 2A implementation:** it exists **only as uncommitted WIP in this worktree**. Verified by tree inspection: `main` (`eb5b559`) contains **none** of
`src/api/deploymentLock.ts`, `src/domains/registry.client.ts`, `src/domains/registryCore.ts`, `src/domains/demo/delivery.ts`,
`src/domains/shared/unavailableRepository.ts`, `src/components/settings/ProductionDeliveryGate.tsx`, `src/targets/`.
Main has 557 files (485 under `src`); this branch's base has 530 (463) — the two lines differ by **124 files / +11,181 / −2,057**,
with main carrying a teacher-dashboard feature set and different gallery/library/media files (e.g. main has `src/views/teacher/TeacherDashboard.tsx`,
`src/components/teacher/*`, new login-portal assets; this line has `src/domains/media/storage.ts`, `src/domains/resources/*`,
`src/components/library/LibraryAudioPlayer.tsx`, `src/components/gallery/__tests__/GalleryAlbumManager.test.tsx`).

---

## B. WHAT STILL MATCHES PHASE 2A (verified item by item)

| # | Requirement | Evidence (re-checked in this audit) |
|---|---|---|
| B1 | One shared app: one entry, one `App`, one route tree, one Login, one lifecycle gate | `index.html` → `src/main.tsx` → `src/App.tsx`; shared `src/views/**`, `src/components/**`; no `demo-app/` vs `client-app/` anywhere |
| B2 | Composition-only target split | `registry.ts` (320 lines) imports both `Api*` and `Demo*` and switches on mode; `registry.client.ts` (188) imports **no** demo module (grep: only doc-comment hits); `registryCore.ts` (172) holds shared plumbing and imports no demo implementation |
| B3 | Aliases, not forks | `vite.config.ts`: `APP_TARGET` (default `demo`) → `targetFile()` picks `.client` variants for `environment`, `libraryProvisioning`, `galleryProvisioning`, `targetCopy`, `targetFeatures`, `commandShowcase`, plus the `@/domains/registry` → `registry.client.ts` alias in the client build |
| B4 | Target seams | `src/targets/` = 12 files, six seams × (base, `.client`) |
| B5 | Client matrix | Client serves exactly 8 API domains (auth, users, roles, students, teachers, rooms, classes, enrollments); the other 12 (incl. `organization`) resolve to `createUnavailableRepository()` → `DOMAIN_UNAVAILABLE` (`kind:"unknown"`, `retryable:false`), no invented endpoints |
| B6 | Demo lock at service level | `src/api/deploymentLock.ts`: `DEMO_ACTIVE/REMOVE_DEMO/DELIVERED/LOCKED`, own keys `ava:delivery:state|pending`, corrupt value ⇒ locked (fail closed), `assertDemoOperationAllowed()` throws `DemoDisabledError(code:"DEMO_DISABLED")`, `isDestructiveOperationAllowed()` blocks mutations while `removing` |
| B7 | Demo entry points guarded | `demoDataManager`: `initialize` throws; `reset`/`import-seed`/`import-dataset`/`restore-backup` return/throw `DEMO_DISABLED`; `clear`/`import-dataset`/`restore-backup` also `OPERATION_BLOCKED` while pending |
| B8 | Remove-demo safety | `src/domains/demo/delivery.ts`: confirm-gated, waypoint persisted **before** any destructive step, blobs limited to `demoOwnedBlobIds()` (seed ids), then `store.reset()` (dataset + marker only), then demo credential/session keys, then boots the empty production environment, then delivered → locked. Idempotent re-run: `changed:false`, no destructive step |
| B9 | Fail-closed ownership | unreadable dataset · corrupt marker · marker/provenance conflict · corrupt provenance · blob failure · credential failure ⇒ typed `DeliveryPendingReason`, **nothing deleted** |
| B10 | No blanket wipes | `localStorage.clear()` / `sessionStorage.clear()` / `indexedDB.deleteDatabase()` appear **only** in test files; production code contains no such call (the only other hits are a doc comment in `delivery.ts`) |
| B11 | Provenance without a third key | `stampDatasetProvenance()` writes `provenance` **inside** the dataset payload on dataset-writing paths only (`initializeEnvironment`, `applyDataset(mode)`, `replace()` when creating); `ava:dataset:origin` / `PROVENANCE_STORAGE_KEY` do not exist anywhere |
| B12 | Storage-key inventory | demo-owned: `ava:demo:dataset`, `ava:demo:lifecycle`, `ava:demo:credentials`, `ava:demo:session`, IndexedDB `ava:media` (seed ids only). Never touched: `ava:theme/accent/density/motion/rail`, `ava:palette`, `ava:palette-recents`, `ava:login:attempts`, `ava:session:activity/start` |
| B13 | Client bundle boundary | `bundleBoundary.test.ts` walked a **real `dist/client`** (all `.js/.mjs/.html/.css`, lazy chunks included): zero hits for `ava:demo:dataset`, `ava:demo:credentials`, `ava:demo:session`, `@demo.local`, `arena-demo`, `md_gal_hall`, demo-only Persian copy — and the honest `DOMAIN_UNAVAILABLE` wording **is** present. Demo build (`dist/demo`): all demo probes present, client-only unavailable wording absent |
| B14 | UI is not the boundary | `targetFeatures.tsx` hides `DemoDataPanel` behind `isDemoCapabilityAvailable()` and always renders the delivery gate; the service rejects independently |
| B15 | Tests exist for the phase's own invariants | `deploymentLock` 9 ✓, `delivery` 12 ✓, `registryClient` 7 ✓, `bundleBoundary` 2 real ✓ (+2 run-condition guards); plus the pre-existing lifecycle/manager/notice/boundary gates all green |

---

## C. WHAT DRIFTED

1. **Branch/HEAD do not match the context block.** The context records *branch `arena/01a0e3c0-…`, HEAD `eb5b559`*. The actual checkout is *branch `arena/01a0e8ec-…`, HEAD `eb973eb`*. `eb5b559` is `main`'s tip; no `01a0e3c0` ref exists in this clone. The reported WIP counts (78/18) do match this worktree, so the mismatch is confined to the branch/HEAD line — most likely the context was compiled from a different session's checkout (the `01a0e27f`/PR #19 line).
2. **Phase 2A is not on `main`.** Main contains none of the Phase 2A files; the whole implementation is uncommitted WIP here. Any statement about "the phase's current implementation" is therefore a statement about this worktree only.
3. **The two lines have diverged structurally** (124 files, +11,181/−2,057). Porting this WIP onto `main`, or continuing on this branch, is a planning decision with real reconciliation cost — it is *not* a mechanical merge.
4. **Environment, not repo:** `node_modules/` and `dist/` are not persisted between turns here; the gates that read `dist/` (bundleBudget, csp, bundleBoundary) silently *skip* when it is absent. Every green/red build claim must be preceded by `npm ci` + a build inside the same session.
5. **Untracked count:** 18 (as recorded) + the previous session's `PHASE_2A_FINAL_REPORT.md` = 19 now.
6. **Refreshed measurement:** the D9 base-tree figure recorded earlier (346,590 gzip) re-measures at **347,609** today; the current WIP tree measures **352,410** (test-reported value reproduced exactly). Conclusion unchanged.

---

## D. REAL BUGS (product/implementation defects found in this audit)

1. **`organization` is demo-served but not disclosed (demo composition, api mode).**
   `src/domains/registry.ts` resolves `getOrganizationRepository()` to `DemoOrganizationRepository` in **both** modes, yet
   `DEMO_SERVED_DOMAINS` has **11** entries and omits `organization`, and `DemoBackedNotice` renders exactly that list.
   In api mode an academy's organization rules therefore come from the local demo store **without** the disclosure banner naming them.
   The gap is *pinned on both sides*: `DemoBackedNotice.test.tsx:85` asserts `toHaveLength(11)` (and the D8 docs say "the eleven"),
   while the demo composition serves twelve demo-backed getters. Doing nothing leaves an honesty gap; "fixing" it naively breaks a pinned
   governance test. **Classification: real (pre-existing since M11), governance-conflicting → report, do not change unilaterally.**

No other implementation defect surfaced: the delivery path, lock, provenance, key inventory, boundary and registry contracts all hold under inspection and under their tests. (The `store.syncProvenance()` cast helper is ugly but behaviourally correct — it only reuses the returned `provenance` object.)

---

## E. PRE-EXISTING / BASELINE FAILURES

1. **`src/__tests__/projectState.test.ts` — 10 failures.** Causes, verbatim from the run: five recorded SHAs
   (`33b1031…`, `aca40c5…`, `6ca25be…`, `3ed0bfe…`, `a3867a6…`) are *not objects in this shallow clone*; plus
   *"the recorded working branch is the branch actually checked out — expected `arena/01a0e8ec-…` to be `main`"* and
   *"HEAD `eb973eb…` must descend from `33b1031…`"*. So it is (a) missing history **and** (b) the branch/lineage drift of §C1.
   Fixable only by a full-history clone on the documented branch — **not** by editing the test or the docs.
2. **`src/__tests__/bundleBudget.test.ts` — 1 failure.** `expected 352410 to be less than or equal to 305805`.
   Proven pre-existing by building the **clean base tree** (`eb973eb`, no WIP) in a throwaway worktree: **347,609 gzip > 305,805 cap**
   — i.e. the cap is already exceeded by ≈13.7% *before any Phase 2A change*; the WIP delta is **+4,801 gzip (+1.38%)**.
   The anchor is stale (D9's M11 landing measured 298,249); re-anchoring is a governance decision, not a code fix.

Both are reported as baseline; neither was touched, hidden, or weakened.

---

## F. GOVERNANCE / EVIDENCE GAPS

1. **G-7:** still no artifact named G-7 anywhere in `docs/`, `src/`, `package.json`, `README.md` (the only `g7` hits are legacy session-id strings and a GHSA advisory id). The nearest gates were executed instead: `architectureBoundaries`, `m10Boundary`, `privacyPosture`, `cspCompatibility`, `routeProtection` — all green.
2. **Stale D9 budget anchor** (supra E2) — needs an owner decision (re-measure and re-anchor, or formally widen), never a silent edit.
3. **Branch/lineage governance:** the docs' recorded checkpoints and "recorded working branch = `main`" do not match this session branch, and `main` lacks Phase 2A entirely. Whether Phase 2A lands on `main` (port) or is finished on this branch must be decided by the owner before any acceptance statement is meaningful.
4. **Organization disclosure conflict** (supra D1): the pinned 11-count and the demo-served reality disagree; the resolution needs a decision (include `organization` and update the D8 pin + docs, *or* document why organization settings are deliberately excluded from the enumeration).
5. **No committed evidence of Phase 2A:** every claim about this phase rests on uncommitted WIP that exists only in this sandbox; nothing is recoverable if the worktree is lost (no commit, no push, no stash, per instruction).

---

## G. EXACT SAFE FIX PLAN (nothing executed — requires explicit authorization)

Ordered, minimal, each step independently revertible; all preserve: one shared app + API data + demo injection + safe removal + production lock + strict client boundary.

1. **Owner decision first (blocking):** confirm which line Phase 2A must land on (this branch vs `main`), because `main` does not contain the phase and the lines have diverged 124 files.
2. **Organization disclosure (only real code candidate):**
   *Option A (recommended if organization settings are records in a demo env):* add `{ id: "organization", label: "قواعد آموزشگاه" }` to `DEMO_SERVED_DOMAINS`, update the pinned count in `DemoBackedNotice.test.tsx` (11 → 12) **and** the D8 wording in `docs/engineering/{DECISIONS,PROJECT_STATE,PHASES}.md` in the same change — a governance-visible, owner-approved edit, not a silent test edit.
   *Option B:* keep 11 and add a one-line comment + doc note stating that `organization` is configuration rather than a record domain and is intentionally excluded from the record-disclosure list.
   *Do not* do either without approval: both touch pinned governance.
3. **D9 budget:** no code change. Owner action = re-measure (methodology already encoded in the test) and re-anchor, or accept the failure as a known baseline; the test must not be weakened.
4. **History/branch gate:** no code change. Owner action = full-history clone on the documented branch for `projectState`; if the session branch is the intended line, the docs' "recorded working branch" must be updated by the owner, not by us.
5. **Re-verification ritual in any fresh sandbox** (deps/builds are not persisted): `npm ci` → `npm run typecheck` → `npm run build:client` → `npm run build:demo` → `bundleBoundary` → `rm -rf dist && npm run build` → full `npx vitest run`; expect exactly the 11 known failures.
6. **No test additions are required** for the phase's own criteria: `deploymentLock` (9), `delivery` (12), `registryClient` (7), `bundleBoundary` (2 real) already pin them; adding more would only add noise.

---

## H. CAN PHASE 2A BE ACCEPTED?

**PHASE 2A — BLOCKED.** Not accepted, and the rule is applied as written: *say ACCEPTED only if everything passes* — two gates fail.

Why it is nevertheless not a Phase 2A implementation failure:
* every Phase 2A criterion in the master context (§4–§12) is implemented and independently verified in this audit (B1–B15);
* the two failures are external: a stale D9 anchor that the **clean base tree already fails** (347,609 > 305,805) and document-SHA/branch checks that a shallow clone on a non-`main` branch cannot satisfy;
* no test was weakened, deleted, skipped-into-green, or edited, and no governance file was modified.

What would make the verdict ACCEPTED (in order): owner decision on the landing line (§G1) → resolution of the D9 anchor (§G3) → full-history clone / branch reconciliation for `projectState` (§G4) → optional owner-approved resolution of the organization disclosure (§G2) → re-run §G5 and expect 0 failures. Until then, the correct statement is: **the Phase 2A implementation scope is complete and verified; the phase cannot be closed because two pre-existing, non-Phase-2A gates fail.**

---

### Modified / untracked inventory

78 modified tracked + **19** untracked at audit start (18 Phase-2A WIP + the earlier `PHASE_2A_FINAL_REPORT.md`); this audit adds only
`PHASE_2A_AUDIT_REPORT.md` (20 untracked now). **No source file was created, edited or deleted by this audit.**
Untracked list: `src/__tests__/bundleBoundary.test.ts`, `src/api/__tests__/deploymentLock.test.ts`, `src/api/deploymentLock.ts`, `src/components/settings/ProductionDeliveryGate.tsx`, `src/domains/__tests__/registryClient.test.ts`, `src/domains/auth/demoRoleRepository.ts`, `src/domains/auth/demoUserRepository.ts`, `src/domains/auth/passphrase.ts`, `src/domains/auth/session.ts`, `src/domains/demo/__tests__/delivery.test.ts`, `src/domains/demo/delivery.ts`, `src/domains/registry.client.ts`, `src/domains/registryCore.ts`, `src/domains/shared/unavailableDomains.ts`, `src/domains/shared/unavailableRepository.ts`, `src/targets/`, `tsconfig.client.json`, `tsconfig.demo.json`).
