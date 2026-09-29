# W3 — Store and plumbing: evidence

**Status:** implemented, verified, and pushed. The local store is now the canonical persistence authority, typed by an interface. Observable behaviour is unchanged. The versioned dataset artifact can feed that store; the production runtime still builds the sample dataset with the seed builder, because loading the artifact in the browser is not a W3 change.

| | |
| --- | --- |
| Wave | W3 — Store and shared plumbing become canonical |
| Baseline commit | `713d9b3a43d825fb9f3cca01a05878f813ba60bd` (the W2 tip) |
| Branch | docs/demo-migration-plan (written without backticks so no scanner mistakes it for a repository path) |
| Implementation commit | `5fadf0769273178bd07c770f907871753f541768` |
| Spec | `docs/migration/DEMO_MIGRATION_WAVES.md` §W3, read verbatim, plus the target architecture §2, the matrix rows for the store and the two Class-H modules, and the W2 exposure gate |
| Handoff | `docs/session-handoffs/W3_COMPLETE_HANDOFF.md` |

Everything below is a measurement from this wave's run. Nothing in this document is an estimate presented as a measurement.

---

## 1. What was asked, and what was authorized

§W3 asks for the store and the shared plumbing to become canonical, with behaviour **identical** and the storage keys **kept**. The authorized file list is `demoStore.ts` → `localStore.ts` plus a `LocalDataStore` interface; `demoCollection.ts` → repository plumbing; `demoReferences.ts` with its parameter typed by that interface; `demoEnvironment.ts`; `domains/demo/index.ts`. D8: none. D9: measure. Security: no boundary moves. Backend: none.

The authorization prompt also required that the independent dataset be able to feed the store, and that data loading be separated from DemoRepository implementations, without starting W4 or W5 and without a B1/B2/B3 choice.

---

## 2. Baseline (recorded before any change)

| Item | Value |
| --- | --- |
| Clone | fresh full clone of docs/demo-migration-plan at `713d9b3…`, clean tree, `npm ci` exit 0 |
| Remote tip before the wave | `713d9b3a43d825fb9f3cca01a05878f813ba60bd` (`git ls-remote` and the GitHub branch API) |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` |
| Protected WIP | HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`, 106 status lines, tracked-diff sha256 `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f` |
| Full suite (no `dist/`) | **197 files — 2580 passed, 1 failed, 15 skipped (2596)** |
| The one failure | `src/views/__tests__/schedulingWrites.test.tsx:1234` — the pre-existing I19 date failure (see §8) |

This reproduces the W2 no-`dist/` figure exactly, on this machine, before any W3 edit.

---

## 3. What changed

| File | Kind | Lines | Why |
| --- | --- | --- | --- |
| `src/services/localStore.ts` | new (moved) | 800 | Canonical persistence module. `LocalStoreImpl` implements `LocalDataStore`. The singleton is `localStore`; `demoStore` is the same object. |
| `src/services/localDataStore.ts` | new | 94 | The interface. Imports types only. Canonical code can name the contract without naming the class. |
| `src/services/canonicalDatasetSource.ts` | new | 37 | Data-loading seam. `current()` returns `createSeedDataset()`. Does not import the Node loader. |
| `src/services/demoStore.ts` | rewritten as shim | 37 | Re-exports the canonical module. Constructs nothing. Existing import paths resolve to the same singleton. |
| `src/domains/shared/repositoryPlumbing.ts` | new (moved) | 82 | The previous `demoCollection` function bodies, unchanged (comment-stripped comparison is identical). |
| `src/domains/shared/demoCollection.ts` | shim | 18 | Re-exports `repositoryPlumbing`. Repositories are not rewritten (those files are W4's). |
| `src/domains/media/demoReferences.ts` | typed | +3/−3 | `mediaStillReferenced` takes `LocalDataStore`, not the class. File name unchanged (W9). |
| `src/test/demoEnvironment.ts` | import | +14/−7 | The harness resets `localStore` and passes that same object into the lifecycle calls. Function names unchanged. |
| `src/domains/demo/index.ts` | type re-export | +15 | Documents that the barrel does not export the store. Re-exports only `CanonicalDatasetSource` as a type, so a component import of the barrel gains no runtime module. |
| `src/services/__tests__/localStoreDatasetFeed.test.ts` | new | 136 | The W3 proof: keys, one singleton, artifact feed, repository read, migration-fill equivalence, no loader import. |
| `src/__tests__/architectureBoundaries.test.ts` | extended | +27 | Bans both store module paths. Pins the media check to the interface. Existing case kept. |
| `src/domains/__tests__/registryClient.test.ts` | extended | +3/−1 | The client composition cannot import `localStore` either. Existing bans kept. |
| `src/views/__tests__/relationsNoFixtures.test.ts` | extended | +3 | Additive `localStore` ban and relapse probes. Existing `demoStore` pattern kept. |
| `src/views/__tests__/compensationNoFixtures.test.ts` | extended | +2/−1 | Additive pattern. The old probe string is still in the probe. |
| `src/views/__tests__/messagesNoFixtures.test.ts` | extended | +1 | Second assertion. The `demoStore` assertion is unchanged. |

Implementation commit: **15 files, +1265/−850**. No registry file, no `package.json`, no vite config, no seed, no dataset artifact, no scheduling test, no D8/D9 constant.

### 3.1 The architectural change, exactly

```
versioned artifact  ──(tests, via the Node loader)──►  CanonicalDatasetSource
seed builder        ──(production default)──────────►  CanonicalDatasetSource
                                                              │
                                                              ▼
                                                    LocalStoreImpl  (keys unchanged)
                                                              │
                                                              ▼
                         repository interfaces  (still the Demo* classes until W4)
                                                              │
                                                              ▼
                                                         application
```

`migrateDataset` used to call `createSeedDataset()` itself. It now calls `source.current()`, defaulting to the seed source. `snapshot()` passes the store's source through. A caller that does not pass a source gets the previous behaviour: the seed builder, invoked only when a fill is actually needed, never at module load.

`initializeEnvironment` already accepted a dataset. The proof installs the loaded artifact through that existing method. No new write path was added.

`DemoStore` is now an alias of the **interface**, not of the class. `DemoStoreImpl` is an alias of `LocalStoreImpl`. `new DemoStoreImpl(storage)` still works; the second constructor argument is optional.

### 3.2 Responsibilities moved

| Responsibility | Before | After |
| --- | --- | --- |
| Persistence authority | `DemoStoreImpl` in `demoStore.ts` | `LocalStoreImpl` in `localStore.ts`, same keys, same singleton via the shim |
| Type canonical code depends on | the class | `LocalDataStore` |
| Sample-dataset fill | the store called `createSeedDataset()` | the store asks `CanonicalDatasetSource` |
| Shared paging and error constructors | `demoCollection.ts` | `repositoryPlumbing.ts` (bodies identical); old path re-exports |
| Media reference parameter | `DemoStore` (the class type) | `LocalDataStore` |
| Test harness store import | `@/services/demoStore` | `@/services/localStore` (same object) |

### 3.3 Responsibilities deliberately NOT moved

1. **The 20 `Demo*Repository` classes.** 17 `demoRepository.ts` files plus `demoAuthRepository`, `demoUserRepository`, `demoRoleRepository`. None renamed, none rewritten. That is W4. Their constructors still accept `DemoStore`, which is now the interface, so they compile without an edit.
2. **Composition** (`registry.ts`, `registry.client.ts`, `registryCore.ts`). Untouched. D8's 11-vs-12 enumeration is untouched.
3. **The runtime switch onto the artifact.** See §4. Doing it here would have been a B2 decision or a D9 breach.
4. **Lifecycle, delivery, and `demoDataManager`.** They already pass a dataset into the store. They still call `createSeedDataset()` by name. Changing those call sites is not required for the seam, and delivery is safety-critical code outside §W3's file list.
5. **`demoReferences.ts` file name.** §W3's parenthetical is the parameter type. §W9 lists the file rename (`demoReferences` → `mediaReferences`) and depends on W4, W5 and W7. The file stays. The contradiction is preserved in the plan and recorded here rather than edited away.
6. **`demoCollection` import paths.** The module moved; the old path re-exports. Rewriting the 17 repository imports would have been a W4-shaped edit. §W9 also lists this rename. W3 does the structural move the §W3 arrow requires; the shim deletion is the residual sweep.
7. **`demoEnvironment.ts` file name.** §W3 lists the file without an arrow. The matrix says rename it when the store is renamed. Renaming it would rewrite 113 importers, which the authorization told this wave not to do as a mass rename. The harness now depends on the canonical module. Function names stay because they name the persisted environment kind, which is W6.
8. **Storage keys, `SEED_DATE`, `SEED_VERSION`, `SEED_TIMESTAMP`, `VITE_DATA_SOURCE`, `demo.manage`, the backup envelope, the delivery lock.** Untouched.
9. **I19, scheduling semantics, the backend, D8, D9 constants, B1.** Untouched.

### 3.4 Why the production path still calls the seed builder

Three facts, all already recorded, make a runtime read of the artifact illegal in this wave:

| Option | Why it is not W3 |
| --- | --- |
| Import `@/dataset/load` from the store | The loader uses `node:fs`. The browser has no filesystem. The W2 contract suite forbids any production import of `load`/`validate`/`write`. Weakening that assertion is forbidden. |
| Import the JSON into the bundle | The artifact is 202,485 B on disk (127,427 B canonical). D9 headroom at the W2 tip was 118 B. The W2 contract also forbids a production import of a dataset JSON file. |
| Fetch the artifact (lazy) | That is build strategy B2. B1 is in force. Choosing B2 is an owner decision required before W5, not authorized here. |

The production default therefore remains `createSeedDataset()`, reached through the source interface. W2 proved that builder byte-equivalent to the artifact (`datasetSha256` `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f`). W3 proves the store can be fed by either side of that equivalence. The artifact files themselves are not in this wave's diff.

---

## 4. The proof the artifact feeds the store

`src/services/__tests__/localStoreDatasetFeed.test.ts` (5 tests, all passing):

1. `DEMO_STORAGE_KEY` is `ava:demo:dataset` and `LIFECYCLE_STORAGE_KEY` is `ava:demo:lifecycle`, from both module paths. `demoStore`, `localStore` and the shim binding are the same object (`===`).
2. `localStore.ts` and `canonicalDatasetSource.ts` do not mention `@/dataset/load`, `validate`, `write`, or a `data/dataset/*.json` import. (The W2 contract suite also still passes: the only production module whose source contains the artifact path is `librarySeed.ts`.)
3. `initializeEnvironment("demo", loadedArtifact)` writes the compatibility keys, and `DemoStudentRepository` over that store lists the artifact's student ids in order.
4. After persistence, the artifact-fed snapshot and the seed-fed snapshot serialize to the same canonical JSON once provenance is stripped, and that JSON equals `canonicalDatasetJson` of the loaded artifact. Provenance is stripped because `initializeEnvironment` stamps a fresh `datasetId` and `createdAt` — existing behaviour, not a second dataset. The comparison is non-vacuous (`students.length > 0`, JSON longer than 1000 characters).
5. A legacy partial payload filled from an artifact-backed source equals the same payload filled from the seed source, including the default one-argument `migrateDataset` call.

`undefined`-valued seed properties are dropped by `JSON.stringify` on write, which is the difference W2 already recorded. The persisted forms match.

---

## 5. Compatibility

| Contract | Result |
| --- | --- |
| `ava:demo:dataset`, `ava:demo:lifecycle` | unchanged; pinned by the new suite; no `ava:local:*` key is written |
| `VITE_DATA_SOURCE=demo` | untouched (`src/api/config.ts` not in the diff) |
| Persisted lifecycle values `empty` / `demo` | untouched (lifecycle module not in the diff) |
| Backup envelope, `ava:delivery:*` | untouched |
| `demo.manage` | untouched |
| `SEED_VERSION` `2026.09.2`, `SEED_DATE` `2026-09-01`, `SEED_TIMESTAMP` | untouched |
| `DEMO_COLLECTIONS` / `DemoCollectionName` re-export | untouched |
| `new DemoStoreImpl(storage)` | still constructs the canonical class (alias); second argument optional |
| `import { demoStore } from "@/services/demoStore"` | same singleton |
| Client composition | still imports no store. The gate now also rejects `localStore`. Client bundle total is the W2 number (see §7). |

---

## 6. What a fresh agent must not "fix"

1. **Do not make the store import `@/dataset/load` or a dataset JSON file.** That fails the W2 contract suite on purpose, and it is the D9/B2 boundary. The seam is the interface, not a runtime switch.
2. **Do not delete `demoStore.ts` or `demoCollection.ts`.** They are compatibility shims. Deleting them forces an import sweep of W4's files.
3. **Do not rename the 20 repositories.** That is W4.
4. **Do not rename `demoReferences.ts`.** That file rename is listed under W9. W3 only changed the parameter type.
5. **The plan's "30 collections" and the W3/W9 rename timing** are documented contradictions. Do not edit the plan to hide them.
6. **Do not raise D9.** Headroom is now 105 B on the bare build (was 118 B). The +13 B is counted JS, not the JSON accounting gap. The gap remains, and this wave did not use it.
7. **Do not retime I19 or change `SEED_DATE`.**
8. **`DemoStore` is the interface.** Re-binding it to the class would undo the point of the wave. `DemoStoreImpl` remains the class alias so existing `new DemoStoreImpl(storage)` call sites keep working.
9. **Comments in production modules must not contain the literal artifact directory path.** The W2 contract suite scans source text for that path, not only import specifiers. This wave's first draft failed that suite; the comments were rephrased. Do not "fix" the suite.

---

## 7. Verification

### Typecheck

`tsc --noEmit -p tsconfig.json`, `-p tsconfig.demo.json`, `-p tsconfig.client.json` — all exit 0. `build:client` and `build:demo` run their own `tsc` and both exited 0.

### Tests

| Stage | Result |
| --- | --- |
| Baseline, no `dist/`, before any edit | 197 files — 2580 pass, **1 fail**, 15 skip (2596) |
| W3, no `dist/` | 198 files — **2587 pass, 1 fail**, 15 skip (2603) |
| W3, all three `dist/` trees present | 198 files — **2600 pass, 1 fail**, 2 skip (2603) |
| `m10Boundary` | 13 pass |
| `architectureBoundaries` | **26 pass** (was 24; the two new cases are the extension, the old case is still there) |
| `registryClient` | pass, including the widened ban |
| `bundleBudget` | 8 pass |
| `cspCompatibility` | 17 pass |
| `bundleBoundary` | 2 pass, 2 skipped — the skips are the "artifact absent" placeholders, which skip when the trees exist. That is the healthy state. |
| `projectState` | pass (no engineering document was edited) |

The +1 file / +7 tests are the new feed suite (5) and the two architecture cases. No assertion was deleted or had its expected value changed. The NoFixtures edits are additive bans.

**The single failure is I19, classified, not a W3 regression.** `src/views/__tests__/schedulingWrites.test.tsx:1234`, message `one move, not a duplicate`, extra id `ses_cl2_20260929_1400`. The sandbox date is Tuesday 2026-09-29; `SEED_DATE` `2026-09-01` is a Tuesday; class `cl2` has a Tuesday slot. The same assertion failed at the same line on the pristine W2 tip in this session, before any W3 edit. Not retimed. Not touched.

### Builds and D9

Methodology: CLI `gzip -6 -n -c`, one invocation per file, summed over emitted JS + CSS + `index.html` under `assets/` plus the HTML. This is the file set `bundleBudget` sums. Cap `361144` untouched.

Build order: bare `npm run build` first (it empties `dist/`), then `build:client`, then `build:demo`, so all three trees existed together for the gates.

| Build | W2 recorded | W3 | Delta |
| --- | --- | --- | --- |
| Bare `npm run build` (`dist/`) | **361,026** | **361,039** | **+13 B** |
| `npm run build:demo` (`dist/demo`) | 361,022 | 361,043 | +21 B |
| `npm run build:client` (`dist/client`) | 306,291 | 306,291 | **0 B** (total equals the W2 recorded total; per-file identity against the W2 artifact was not re-diffed — that artifact was not retained) |
| Entry chunk gzip (bare) | 135,138 | 135,154 | +16 B, still strictly below the 273,791 anchor |
| Headroom vs cap `361144` | 118 B | **105 B** | the +13 B, counted |

`bundleBudget` passed against the bare tree. No constant was edited. No chunk-size warning limit was raised.

The +13 B is the source seam (a module and a constructor parameter), not a renamed class string: `LocalStoreImpl` and `DemoStoreImpl` do not appear as text in `dist/` or `dist/demo` (identifiers are minified). The client tree contains neither those names nor `ava:demo:dataset`.

**The JSON accounting gap, again not used.** The artifact is still outside `bundleBudget`'s file set. This wave did not import it. The +13 B is inside the file set and is reported as such.

---

## 8. Security and boundaries

No boundary moved. The client composition still has no store import. The extended `registryClient` gate fails if someone imports `localStore` there to dodge the old `demoStore` regex. Views and components still do not import either module; the new architecture case scans raw import specifiers, because the older case strips string literals and therefore cannot see a `from "..."` path. That older case was kept, not replaced.

The artifact is still not fetchable. No new exposure path. Demo credentials were not touched. The deployment lock was not touched.

---

## 9. Protected state after the implementation push

| Ref | SHA | |
| --- | --- | --- |
| docs/demo-migration-plan | `5fadf0769273178bd07c770f907871753f541768` | `git ls-remote` and the GitHub branch API agree; tree `ed96ecc7298fe4772a599a30dfc7ecfe236d97bf` equals the local tree |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` | unchanged |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` | unchanged |
| Protected WIP | `eb973eb2758447eff16b60ab4fd4c267f9d85061`, diff sha256 `aed92770…` | unchanged, before and after the push |

Push mode: ordinary `git push` of one new commit. No force, no rebase, no squash, no merge, no `main` change.

---

## 10. Rollback

Parent of the implementation commit: `713d9b3a43d825fb9f3cca01a05878f813ba60bd`.

`git revert` of the W3 commits restores the previous store module. No storage key changed, no persisted shape changed, no env value changed, so the revert is total. There is no compatibility shim that would have to stay behind after a revert — the shims exist so the *forward* import paths keep working, not because a stored format moved.

---

## 11. Next wave

**W4 — repositories become the canonical local implementation, batched per domain.** Not started. It depends on this wave's interface, which now exists. It does not require D8 or a build-strategy choice; those remain required before W5.
