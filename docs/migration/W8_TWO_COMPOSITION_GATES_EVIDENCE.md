# W8 — stronger gates for the two-composition boundary: evidence

Parent: `186f3b7b14f6283834fb391c7cd6dcd8d254b432`
Implementation: `318c0f2ea2d68a62f2273797c547a584546a3a5d`
Tree: `35deaae8e0f8f8c2ed4a64847665a6e23a9ad2f3`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote` or the GitHub branch API.

`docs/migration/W7A_CLIENT_BOUNDARY_EVIDENCE.md`, `docs/migration/W7B_OPERATOR_RESET_EVIDENCE.md`, and `docs/migration/W7B_FIXTURE_CONTRACT_EVIDENCE.md` are left as written. `docs/migration/DEMO_MIGRATION_WAVES.md` is left as written. Its W8 row still says "single composition". That sentence is not the authorized target of this wave.

W9 is not started. I19 is not fixed.

## 1. What this wave was

W8 is gates only. No product behaviour changed. No registry merge. No third build. `dist/client` stays the only D9 subject. The cap stays `361144`. `dist/demo` stays the fixture and is not capped. No `dist/customer`. No `dist/operator`.

The authorized target is the recorded two-composition boundary, not the waves-doc single composition. The gates lock that boundary. They do not require one artifact, one registry, or a renamed `Demo*` surface.

## 2. What changed

Seven test files. +496 / −28. Implementation `318c0f2ea2d68a62f2273797c547a584546a3a5d`.

| File | Change |
| --- | --- |
| `src/__tests__/bundleBoundary.test.ts` | Client absence list grew by the fixture markers already proven absent. Fixture presence list requires `importSample` and `resetToClean`. A third `dist/customer` or `dist/operator` fails. Package scripts and tsconfigs may name only client and demo. The scan and a synthetic probe share one rule. |
| `src/__tests__/bundleBudget.test.ts` | The production cap is locked at exactly `361144`. The D9 subject is locked at `dist/client`. The fixture describe does not apply that cap. The cap number was not changed. |
| `src/__tests__/architectureBoundaries.test.ts` | Client composition files may not import the store, the seed, the dataset artifact, or a demo panel. `m10Boundary` and the five `*NoFixtures` gates must still exist. Those six files were not rewritten. |
| `src/domains/__tests__/registryClient.test.ts` | `registry.ts` and `registry.client.ts` stay distinct. No third registry. The client alias still points at `registry.client.ts`. No dynamic import in the client registry. |
| `src/__tests__/datasetSchemaGate.test.ts` | Manifest schema, dataset version, and seed date stay `1`, `2026.09.2`, and `2026-09-01`. `validateDatasetArtifact()` is empty. The schema module imports nothing. The client registry and the fixture manager do not load the artifact. |
| `src/__tests__/namingGate.test.ts` | Class H is exactly `demoReferences.ts` and `demoCollection.ts`. The exemption does not rename them and does not delete them. The Demo*-named production set is closed. The client composition may export only the recorded names `DemoNote` and `DemoServedDomain`. |
| `src/__tests__/explicitSelectionGate.test.ts` | Client mode is never `local`. Production aliases never map to local. A typo is an error. Unset local mode exists only on the demo composition. The build-target union is `demo \| client`. |

Not changed: both registries, `vite.config.ts`, `package.json`, `src/api/config.ts`, `SEED_DATE`, `SEED_VERSION`, `data/dataset/**`, credential policy, `schedulingWrites.test.tsx`, the D9 cap, the five `*NoFixtures` files, and `m10Boundary.test.ts`. No capability was deleted. No `دمو` marker was added to the client absence list.

## 3. Mutation checks

Each rewritten or new rule was broken, watched fail, and restored. The working tree after restoration contained only the intended test files.

| Break | Result |
| --- | --- |
| Client target file imported `@/services/demoStore` | `architectureBoundaries` failed, then the import was removed |
| `registry.client.ts` re-exported `./registry` | `registryClient` failed, then the line was removed |
| Client config returned `mode: "local"` for `local` and `demo` | `explicitSelectionGate` failed, then `config.ts` was restored |
| Manifest `schemaVersion` set to `"2"` | `datasetSchemaGate` failed, then the manifest was restored |
| Added `src/domains/billing/demoBilling.ts` | `namingGate` failed, then the file was deleted |
| Created `dist/customer` | `bundleBoundary` failed, then the directory was removed |
| `GZIP_TOTAL_BASELINE` changed to `343948` | the `361144` lock failed, then the constant was restored |
| `importSample` appended to `dist/client/index.html` | the emitted client scan failed on `contains "importSample"`, then the html was restored |

## 4. Graphs and sizes

`npm run build:client` transformed 2035 modules. `npm run build:demo` transformed 2096. Those counts match the W7A evidence. The client entry name is still `assets/index-CUu6ec22.js`. The fixture entry name is still `assets/index-BdeIHyEK.js`.

CLI `gzip -6 -n` per emitted JS, CSS, and HTML file, then sum. Cap `361144` unchanged. Not Vite's gzip column. Not Python `gzip.compress`.

| Artifact | W7B fixture-contract evidence | This wave | Cap |
| --- | --- | --- | --- |
| client `dist/client` | 306416 | 306416 | 361144, applied |
| client entry JS | 77579 | 77579 | strictly under 273791 |
| largest client JS chunk | 77579 | 77579 | strictly under 400000 |
| demo fixture `dist/demo` | 362149 | 362149 | not applied |
| demo entry JS | 136264 | 136264 | not applied |

Client headroom is unchanged: 361144 − 306416 = 54728. The fixture total is 1005 above the cap number. That is not a D9 failure. The cap was not raised and was not applied to `dist/demo`.

Emitted `dist/client` text contains none of `VITE_DATA_SOURCE=demo`, `ava:demo:`, `arena-demo`, `DemoDataPanel`, `demoDataManager`, `DemoBackedNotice`, `localStore`, `DataLifecycleGate`, `createSeedDataset`, `data/dataset/`, `loadDatasetArtifact`, `DEMO_PASSPHRASE`, `data-operator-import`, `data-operator-reset`, `importSample`, or `resetToClean`. `دمو` occurs in client copy and was not added to the absence list.

The fixture artifact contains `ava:demo:` 5, `arena-demo` 2, `data-operator-import` 1, `data-operator-reset` 1, `importSample` 2, `resetToClean` 2. `dist` contains only `client` and `demo`.

## 5. Verification

Typecheck: `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.demo.json` all exit 0. Each build script typechecks again and exits 0.

Full suite after fetching `origin/main` and the two preserved tips into this clone: 203 files, 2659 tests, 2646 passed, 1 failed, 12 pending. Against the W7B fixture-contract full run, 2639 tests and 2626 passed, the difference is 20 new gate tests. 2646 − 2626 = 20.

The failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`. A focused run of that case on this tree reported extra id `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` was not edited. The test was not skipped and was not weakened. This wave does not claim I19 fixed.

The fetch did not create local `main` and did not move the stored remote-tracking tips. `origin/main` remains `15775ea9486cb57fbfb8fefa3268658cbe7eb669`.

## 6. Protected state before the push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Preserved tips `251af96f405df5935ee17ddc9ba6b490f7989c2d` and `94d32de3220cee314606c0c4705e20e0fdcfb2af`. The earlier evidence also recorded backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` and WIP `eb973eb2758447eff16b60ab4fd4c267f9d85061`. This wave does not push those refs. No history rewrite, reset, cherry-pick, or force-push.

## 7. Rollback

Revert `318c0f2ea2d68a62f2273797c547a584546a3a5d`. Parent `186f3b7b14f6283834fb391c7cd6dcd8d254b432`. That removes the W8 gates and leaves the W7B fixture contract. It does not restore a single composition, and it does not undo W6 or W7A.

## 8. Handoff

W8 is complete as stronger gates for the recorded two-composition boundary. It did not enforce a single composition. It did not merge the registries. It did not create a third build. The D9 subject is still `dist/client` at 306416, cap 361144. W9 is not started. I19 is not fixed.
