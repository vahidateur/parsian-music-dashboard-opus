# W7 — three artifacts, operator Import/Reset: evidence

Parent of this wave: `039b9c827d54aabbec9e90557c3efb49eb37678a`
Implementation: `1eb6366d0482c55845e5239ed20a9b44a4e6f68b`
Tree: `ad250ca5a50a27789f197c389e8b9705574fb362`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote` or the GitHub branch API.

The earlier record at `docs/migration/W7A_CLIENT_BOUNDARY_EVIDENCE.md` is left as written. It correctly describes the two-composition contract that was later reversed. That sentence is not erased. This document is the current contract.

W8 is not started.

## 1. What this wave was

The owner reversed the two-composition contract. Three artifacts, same change:

| Artifact | Graph | Role | D9 |
| --- | --- | --- | --- |
| `dist/customer` | client graph | employer delivery | cap `361144`, applied |
| `dist/client` | client graph | API/client build | measured independently, not the D9 subject |
| `dist/operator` | demo graph | fixture, staging, Import/Reset | measured, not capped |

`registry.ts` and `registry.client.ts` were not edited and were not merged. No third registry. No fourth build. `npm run build:demo` is an alias of `build:operator`, so the old script name does not emit `dist/demo`. Customer did not gain a local store. Customer and client do not use `import()` to dodge the cap. Demo capability was not deleted.

D9's number stays `361144`. An operator total over that number is not a D9 failure.

## 2. What changed

31 files. +502 / −145. Implementation `1eb6366d0482c55845e5239ed20a9b44a4e6f68b`.

| Area | Change |
| --- | --- |
| `vite.config.ts`, `src/env.d.ts`, `package.json` | `APP_TARGET` is `customer`, `client`, or `operator`. The legacy `demo` env value normalizes to `operator` before injection. Customer and client alias the clean target files and `registry.client.ts`. Operator keeps the demo graph and the demo registry. `__APP_TARGET__` is the canonical name, so `=== "operator"` folds away in the clean builds. |
| `src/api/config.ts` | `resolveConfig` calls `resolveOperatorConfig` only from `if (__APP_TARGET__ === "operator")`. Customer and client call `resolveDeliveryConfig`. The earlier runtime `target` argument is gone. Operator strings are not reachable from the delivery function. |
| `src/domains/demo/demoDataManager.ts`, `useDemoData.ts`, `DemoDataPanel.tsx` | Operator Import (`importSample`) and Reset (`resetToClean`). Seed comes from `createSeedDataset()`. Reset of proven demo ownership writes `createEmptyEnvironment()`. Customer and unproven are not written. Empty and uninitialized Reset is a no-op. |
| `src/targets/targetCopy.ts`, `targetCopy.client.ts`, shared views | Identifiable demo prose that is not a write confirmation lives on the target-copy seam. The client file has no `دمو` and no `دادهٔ نمایشی`. |
| Write confirmations in the seven H3/H7 surfaces, plus `ActionSheet` | Still call `useIsDemoEnvironment`. The demo sentence stays on the `detail:` line, guarded by `__APP_TARGET__ === "operator" && demoEnvironment`, so the honesty suite still sees a derived label and the clean builds drop the string. Moving that sentence entirely into `targetCopy` failed `writeFeedbackHonesty.test.ts`. It was restored. |
| `src/domains/auth/useRoles.ts` | Display label comes from `demoManageLabel`. Permission id `demo.manage` was not renamed. |
| Tests | Budget measures `dist/customer` against the unchanged cap and reports client and operator without applying it. Boundary scans the real clean artifacts, including `دمو` and `دادهٔ نمایشی`. `operatorReset.test.ts` covers the Import/Reset contract. It does not assert a `data/dataset` substring; it asserts no `@/dataset/` import. |

Not changed: both registries, `SEED_DATE`, `SEED_VERSION`, dataset hash, `DEMO_PASSPHRASE`, credential policy, `schedulingWrites.test.tsx`, ownership verdict, lifecycle marker rules, delivery locking, authorization, provenance. `data/dataset/**` is not read at runtime. `docs/architecture/environments.md` still describes the older unset model. It was left stale on purpose; this wave is not a documentation cleanup.

## 3. Graphs and clean artifacts

`npm run build:customer` and `npm run build:client` each transformed 2035 modules. `npm run build:operator` transformed 2096. Those counts match the previous two-composition evidence. The clean count did not grow.

Customer and client entry chunks are the same file, `assets/index-BPMiB8ig.js`, 263348 raw bytes, sha256 `6e23001b19ef274a5fc5202a2457ac55838a40604f3a5df082cf6ec1cec695cb`. `__APP_TARGET__` is absent from all three artifacts. The operator function is not left as a dead runtime branch in the clean builds.

Emitted customer and client text (JS, CSS, HTML) contains none of:

- `VITE_DATA_SOURCE=demo`
- `ava:demo:`
- `arena-demo`
- `DemoDataPanel`
- `createSeedDataset`
- `data/dataset/`
- `loadDatasetArtifact`
- `دمو`
- `دادهٔ نمایشی`
- `دادهٔ دمو`

`demo.manage` remains, 3 hits in each clean artifact. That is a permission id. Renaming it would change credential policy. It was not added to the absence list.

Operator, same scan: `ava:demo:` 5, `arena-demo` 2, `دمو` 61, `دادهٔ نمایشی` 7, `دادهٔ دمو` 16, `demo.manage` 5, `data-operator-import` 1, `data-operator-reset` 1. The minified operator artifact has no literal `DemoDataPanel` or `createSeedDataset`. Those names are not the contract; the buttons and the seed call are.

`deploymentLock.ts` still contains `دمو` in source. Those strings are absent from the clean artifacts. It was not edited to chase a source grep.

## 4. Sizes

CLI `gzip -6 -n` per file, then sum. Same method as the D9 baseline and as `bundleBudget.test.ts`. Cap `361144` unchanged. Not Vite's gzip column, and not Python `gzip`.

| Artifact | This wave | Cap |
| --- | --- | --- |
| customer `dist/customer` | 306481 | 361144, applied |
| client `dist/client` | 306481 | not applied |
| operator `dist/operator` | 361877 | not applied |
| customer entry JS | 77894 | strictly under 273791 |
| largest customer JS chunk | 77894 | strictly under 400000 |
| operator entry JS | 136257 | not applied |

Customer headroom: 361144 − 306481 = 54663. Client is the same total, measured independently. Operator is 733 above the cap number. That is not a D9 failure. The number is not discarded and the cap was not raised.

Font weights 300 and 800 stay absent. `academicViews`, `operationsViews`, and `vendor` are separate chunks. `chunkSizeWarningLimit` is still not assigned. Sourcemap stays off.

## 5. Import / Reset

Path: operator build → `targetFeatures` → `DemoDataPanel` → Import / Reset → `createSeedDataset()` or `createEmptyEnvironment()`.

Contract, covered by `operatorReset.test.ts`:

- proven demo may Reset, and success leaves an empty environment
- customer is not written
- unproven is not written
- empty and uninitialized Reset is a no-op
- Import into an absent environment installs `createSeedDataset()` and marks sample
- the manager source does not import `@/dataset/`

`SEED_DATE`, `SEED_VERSION`, and the dataset hash were not edited. Those files are not in the diff.

## 6. Verification

Typecheck: `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.demo.json` all exit 0. Each build script typechecks again and exits 0.

Focused suites after the builds: `bundleBudget.test.ts`, `bundleBoundary.test.ts`, `operatorReset.test.ts`, `config.test.ts`, and the honesty file — passed. An earlier focused run also included `demoDataManager` and `registryClient`: 6 files, 64 passed, 6 skipped. The skips are the explicit absent-artifact cases; the composed artifacts were present for the measurement cases.

`projectState.test.ts` passed in the full run after fetching `origin/main` and the two preserved tips into this clone. That fetch did not move `main`, the backup ref, or the WIP tag. Local `main` was not created.

Full suite, composed artifacts present: 200 files, 2633 tests, 2618 passed, 1 failed, 14 pending.

The failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`. The extra id is `ses_cl2_20260929_1400`. The calendar date of the run is 2026-09-29, a Tuesday, which is the collision `OPEN_ITEMS.md` already records for `cl2`. That file is not in the diff. `SEED_DATE` was not edited. The test was not skipped and was not weakened.

## 7. Protected state before the implementation push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP `eb973eb2758447eff16b60ab4fd4c267f9d85061`. Not modified. No history rewrite, reset, cherry-pick, or force-push. The already pushed two-composition commits stay.

## 8. Rollback

Revert `1eb6366d0482c55845e5239ed20a9b44a4e6f68b`. Parent `039b9c827d54aabbec9e90557c3efb49eb37678a`. That restores the two-composition W7A client rule and removes operator Import/Reset. It does not undo W6.

## 9. Handoff

Three artifacts are in place. Customer is the D9 subject and is clean. Client is the same clean graph, measured separately. Operator holds the fixture and Import/Reset, and is not capped. W8 is not started.
