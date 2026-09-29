# W7B — Import and Reset on the fixture graph: evidence

Parent of this wave: `22cbd26f17009bdd695cf6900d07f743806f2030`
That parent restores the tree of `039b9c827d54aabbec9e90557c3efb49eb37678a`.
Implementation: `9357704a62b3c8b0d341c77a7d0390c7d28358d3`
Tree: `73855a6d9efe8a761b93c7e8c439f6553c12c6a7`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote` or the GitHub branch API.

`docs/migration/W7A_CLIENT_BOUNDARY_EVIDENCE.md` is left as written. It is still the W7A record: two compositions, D9 on `dist/client`, W7B not started at that commit. This document does not rewrite it.

W8 is not started.

## 1. What this wave was

W7A stays the recorded close. B1 stays two compositions. No registry merge. No third build. `dist/client` stays the API-only delivery artifact and the only D9 subject. The cap stays `361144`. `dist/demo` stays the operator/fixture artifact and is not capped.

The three-artifact commits `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` and `10c815412f4e951b8f05323de4e50927f116ab05` mixed a third build into Import/Reset. That exceeded the confirmed W7A boundary. They were reverted by `22cbd26f17009bdd695cf6900d07f743806f2030`, not rewritten and not force-pushed. W7B starts after that restore, and only on the fixture graph.

## 2. What changed

Five files. +232 / −4. Implementation `9357704a62b3c8b0d341c77a7d0390c7d28358d3`.

| File | Change |
| --- | --- |
| `src/domains/demo/demoDataManager.ts` | `importSample` and `resetToClean`. Seed is `createSeedDataset()`. Reset of proven demo ownership writes `createEmptyEnvironment()`. Customer and unproven are not written. Empty and uninitialized Reset is a no-op. |
| `src/domains/demo/useDemoData.ts` | Confirmation path for those two operations. Copy does not call a customer environment demo data. |
| `src/components/settings/DemoDataPanel.tsx` | Import and Reset buttons. The panel is mounted only from `src/targets/targetFeatures.tsx`, and only while demo capability is available. |
| `src/domains/demo/__tests__/operatorReset.test.ts` | The ownership contract. Asserts no `@/dataset/` import and no `loadDatasetArtifact`. Does not assert a `data/dataset` comment substring. |
| `src/__tests__/bundleBoundary.test.ts` | `data-operator-import` and `data-operator-reset` must be present in the fixture artifact and absent from `dist/client`. Existing markers were not removed. |

Not changed: both registries, `vite.config.ts`, `src/api/config.ts`, `SEED_DATE`, `SEED_VERSION`, dataset hash, `DEMO_PASSPHRASE`, credential policy, `schedulingWrites.test.tsx`, ownership verdict, lifecycle marker rules, delivery locking, authorization, provenance. `data/dataset/**` is not read at runtime. No local store was added to the client composition. No `import()` was added to dodge D9. No capability was deleted to shrink a bundle.

Path: demo composition → `targetFeatures` → `DemoDataPanel` → Import / Reset → `createSeedDataset()` or `createEmptyEnvironment()`. `targetFeatures.client.tsx` does not import `DemoDataPanel`.

## 3. Graphs

`npm run build:client` transformed 2035 modules. `npm run build:demo` transformed 2096. Those counts match the W7A evidence. The client count did not grow.

Emitted `dist/client` text (JS, CSS, HTML) contains none of `VITE_DATA_SOURCE=demo`, `ava:demo:`, `arena-demo`, `DemoDataPanel`, `createSeedDataset`, `data/dataset/`, `loadDatasetArtifact`, `data-operator-import`, `data-operator-reset`, `importSample`, or `resetToClean`.

The fixture artifact contains `data-operator-import` 1, `data-operator-reset` 1, `importSample` 2, `resetToClean` 2, `ava:demo:` 5, `arena-demo` 2. Minified names hide `DemoDataPanel` and `createSeedDataset`; the buttons and the seed call are the contract.

## 4. Sizes

CLI `gzip -6 -n` per file, then sum. Same method as the D9 baseline and as `bundleBudget.test.ts`. Cap `361144` unchanged. Not Vite's gzip column.

| Artifact | W7A evidence | This wave | Cap |
| --- | --- | --- | --- |
| client `dist/client` | 306416 | 306416 | 361144, applied |
| client entry JS | 77579 | 77579 | strictly under 273791 |
| largest client JS chunk | 77579 | 77579 | strictly under 400000 |
| demo fixture `dist/demo` | 361222 | 361729 | not applied |
| demo entry JS | — | 135846 | not applied |

Client headroom is unchanged: 361144 − 306416 = 54728. The fixture total is 585 above the cap number. That is not a D9 failure. The number is not discarded and the cap was not raised. The growth against W7A is the Import/Reset copy on the fixture graph.

Font weights 300 and 800 stay absent. `chunkSizeWarningLimit` is still not assigned. Sourcemap stays off.

## 5. Verification

Typecheck: `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.demo.json` all exit 0. Each build script typechecks again and exits 0.

Focused suites after the builds: `operatorReset.test.ts`, `DemoDataPanel.test.tsx`, `config.test.ts`, `registryClient.test.ts` — 41 passed. `bundleBudget.test.ts` and `bundleBoundary.test.ts` — 20 passed, 4 skipped. The skips are the explicit absent-artifact cases; both composed artifacts were present, so the measurement cases ran.

Full suite, composed artifacts present, after fetching `origin/main` and the two preserved tips into this clone: 200 files, 2628 tests, 2615 passed, 1 failed, 12 pending. The fetch did not move `main`, the backup ref, or the WIP tag. Local `main` was not created.

The failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`. It is the same date collision already named for 2026-09-29, extra id `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` was not edited. The test was not skipped and was not weakened.

The nine new tests are the Import/Reset contract. 2615 − 2606 = 9 against the W7A full-run pass count.

## 6. Protected state before the implementation push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP `eb973eb2758447eff16b60ab4fd4c267f9d85061`. Not modified. No history rewrite, reset, cherry-pick, or force-push.

## 7. Rollback

Revert `9357704a62b3c8b0d341c77a7d0390c7d28358d3`. Parent `22cbd26f17009bdd695cf6900d07f743806f2030`. That removes Import/Reset and leaves the two-composition W7A tree. It does not restore the three-artifact split, and it does not undo W6 or W7A.

## 8. Handoff

W7A remains complete at the two-composition boundary. W7B is complete on the fixture graph only. `dist/client` gained no demo dependency and is still the D9 subject at 306416. W8 is not started.
