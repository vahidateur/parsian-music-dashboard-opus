# W9 — Class-H rename: evidence

Parent: `bc5f1cfa67170ff106f8811cee476ea241d140d4`
Implementation: `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16`
Tree: `6e8dc6b78430821fab03bcf06403c92b648ff655`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote`.

`docs/migration/W8_TWO_COMPOSITION_GATES_EVIDENCE.md` and `docs/migration/DEMO_MIGRATION_WAVES.md` are left as written. Historical handoffs, audit reports, and `F*_REPORT.md` files were not edited. `docs/architecture/demo-data.md` was not retitled.

W10 is not started. I19 is not fixed.

## 1. What this wave was

W9 is the two authorized Class-H renames and nothing else. No topology change. No registry merge. No third build. `dist/client` stays the only D9 subject. The cap stays `361144`. `dist/demo` stays the fixture and is not capped. No `dist/customer`. No `dist/operator`.

`paginate` was not edited. I16 was not edited. Storage keys, credentials, seed constants, Import/Reset, `APP_TARGET`, and `vite.config.ts` were not edited.

## 2. What changed

Implementation `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16`. 26 files, +75 / −76.

| Change | Files |
| --- | --- |
| Rename, content identical | `src/domains/media/demoReferences.ts` → `src/domains/media/mediaReferences.ts` (100%) |
| Shim removed, no second implementation | `src/domains/shared/demoCollection.ts` deleted. It was an 18-line re-export of `repositoryPlumbing.ts`. |
| Importers retargeted | 17 `localRepository.ts` files, plus `src/views/__tests__/StudentDetail.test.tsx`, `src/domains/media/__tests__/mediaReferenceIndex.test.ts`, and `src/domains/media/__tests__/mediaOwnershipTransition.test.tsx`. `demoCollection` specifiers now import `@/domains/shared/repositoryPlumbing`. `demoReferences` specifiers now import `mediaReferences`. |
| Comment only | `src/domains/shared/repositoryPlumbing.ts`. The `paginate` body is unchanged. |
| Path citations required by `projectState` | `docs/engineering/OPEN_ITEMS.md`. Four backticks now name `repositoryPlumbing.ts`. The Math.max line is `:31`. The meta total line is `:35`. |
| Naming gate | `src/__tests__/namingGate.test.ts` requires the two final paths, rejects both old filenames, and still closes the remaining 13 Demo*-named production files. Client exports stay `DemoServedDomain` and `DemoNote`. |
| Boundary path | `src/__tests__/architectureBoundaries.test.ts` reads `mediaReferences.ts`. The client-import ban still names `demoReferences` and `demoCollection`, and now also names `mediaReferences`, so the renamed module is not an allowed client specifier. |

Not changed: `vite.config.ts`, `package.json`, `registry.ts`, `registry.client.ts`, `SEED_DATE`, `SEED_VERSION`, `data/dataset/**`, credential policy, storage keys, `demoStore.ts`, `demoEnvironment.ts`, `demoDataManager.ts`, `useDemoData.ts`, `DemoDataPanel.tsx`, `DemoBackedNotice.tsx`, `demoCredentials.ts`, `demoRepository.ts` files, `demoContent.ts` files, `DemoNote`, `DemoServedDomain`, `schedulingWrites.test.tsx`, and the D9 cap.

Comment citations that are not import paths were left, on purpose. They are not scanned by the path gate: `src/domains/media/release.ts`, `src/domains/media/ProfilePhotoField.tsx`, `src/domains/gallery/GalleryPanel.tsx`, `src/domains/gallery/__tests__/galleryPanelHonesty.test.tsx`, and `src/domains/chat/README.md`. One non-path word `demoCollection` remains in `OPEN_ITEMS.md`.

## 3. Mutation check

Before the gate was treated as final, `mediaReferences.ts` was moved back to `demoReferences.ts` and `namingGate.test.ts` was run.

| State | Result |
| --- | --- |
| Rename broken | 2 failed, 1 passed. Missing `src/domains/media/mediaReferences.ts`. Extra `src/domains/media/demoReferences.ts`. The client-export test still passed. |
| Rename restored | 3 passed. |

The file was restored before any other suite. The working tree after restoration contained only the intended W9 edits.

## 4. Graphs and sizes

`npm run build:client` transformed 2035 modules. `npm run build:demo` transformed 2095 modules. W8 recorded 2096 for the fixture. The difference is the deleted shim, which had no function body. The client entry name is still `assets/index-CUu6ec22.js`. The fixture entry name is still `assets/index-BdeIHyEK.js`.

CLI `gzip -6 -n` per emitted JS, CSS, and HTML file, then sum. Cap `361144` unchanged. Not Vite's gzip column.

| Artifact | W8 evidence | This wave | Cap |
| --- | --- | --- | --- |
| client `dist/client` | 306416 | 306416 | 361144, applied |
| client entry JS | 77579 | 77579 | strictly under 273791 |
| demo fixture `dist/demo` | 362149 | 362149 | not applied |
| demo entry JS | 136264 | 136264 | not applied |

Client headroom is unchanged: 361144 − 306416 = 54728. The fixture total is 1005 above the cap number. That is not a D9 failure. The cap was not raised and was not applied to `dist/demo`.

Emitted `dist/client` text contains none of `VITE_DATA_SOURCE=demo`, `ava:demo:`, `arena-demo`, `DemoDataPanel`, `demoDataManager`, `DemoBackedNotice`, `localStore`, `DataLifecycleGate`, `createSeedDataset`, `data/dataset/`, `loadDatasetArtifact`, `DEMO_PASSPHRASE`, `data-operator-import`, `data-operator-reset`, `importSample`, or `resetToClean`. `دمو` occurs 13 times in client copy and was not added to the absence list.

The fixture artifact contains `ava:demo:` 5, `arena-demo` 2, `data-operator-import` 1, `data-operator-reset` 1, `importSample` 2, `resetToClean` 2. `dist` contains only `client` and `demo`.

## 5. Verification

`build:client` and `build:demo` each typecheck their own tsconfig and exit 0.

Focused gates passed: `namingGate.test.ts` 3, `architectureBoundaries.test.ts`, `datasetSchemaGate.test.ts`, `explicitSelectionGate.test.ts`, `registryClient.test.ts`, `bundleBoundary.test.ts`, and `bundleBudget.test.ts`. Bundle tests skipped the absent-artifact cases because both artifacts were present. `projectState` path existence passed.

Full suite in this single-branch clone, with no fetch: 203 files, 2659 tests, 2644 passed, 3 failed, 12 skipped. W8 after a fetch recorded 2646 passed and 1 failed. The two-test difference is the clone, not this wave.

Failures:

1. I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra id `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` was not edited. This wave does not claim I19 fixed.
2. `projectState` cannot see preserved tip `251af96f405df5935ee17ddc9ba6b490f7989c2d` in this clone.
3. `projectState` cannot see `origin/main` in this single-branch clone.

Those two `projectState` failures are the known clone-without-fetch condition. Fetch was not performed. They are not product failures and were not edited around.

## 6. Protected state before the push

`docs/demo-migration-plan` `bc5f1cfa67170ff106f8811cee476ea241d140d4`. `main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. Archive tag `eb973eb2758447eff16b60ab4fd4c267f9d85061`. This wave does not push those refs. No history rewrite, reset, cherry-pick, or force-push.

## 7. Rollback

Revert `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16`. Parent `bc5f1cfa67170ff106f8811cee476ea241d140d4`. That restores the two old filenames and the shim. It does not undo W8.

## 8. Handoff

W9 is the two Class-H renames only. It did not merge the registries. It did not create a third build. The D9 subject is still `dist/client` at 306416, cap 361144. W10 is not started. I19 is not fixed.
