# W7B — fixture Import/Reset contract: evidence

Parent of this correction: `619c2bb3efc07308568c0c646e683a0e3a1182d4`
That parent is the earlier fixture evidence. It is left as written.
Implementation: `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53`
Tree: `d855475b258eb3ffd6b8c871390a859c85191aea`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote` or the GitHub branch API.

`docs/migration/W7A_CLIENT_BOUNDARY_EVIDENCE.md` is left as written. `docs/migration/W7B_OPERATOR_RESET_EVIDENCE.md` is left as written. This document does not rewrite either.

W8 is not started. No W8 file is in this commit. The waves document was not rewritten. The delivered W8 preflight remains BLOCKED: the waves-doc W8 target is a single composition, and that wave was not authorized.

## 1. What this correction was

W7A stays the recorded close. B1 stays two compositions. No registry merge. No third build. `dist/client` stays the API-only delivery artifact and the only D9 subject. The cap stays `361144`. `dist/demo` stays the operator/fixture artifact and is not capped. No `dist/customer`. No `dist/operator`.

The earlier fixture commit installed Import and Reset, but it did not yet meet the later contract: a pristine empty envelope was refused as customer, Reset did not delete demo-owned blobs before the dataset write, and `demo.manage` was not enforced by the service operation. This commit closes those three gaps on the fixture graph only.

## 2. What changed

Four files. +367 / −63. Implementation `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53`.

| File | Change |
| --- | --- |
| `src/domains/demo/demoDataManager.ts` | `importSample` validates `createSeedDataset()` before any write. Uninitialized, pristine empty, and proven demo may receive it. Customer records and unproven ownership are not written. `resetToClean` is async: only verdict `demo` deletes `demoOwnedBlobIds()` and, only after every deletion succeeds, installs `createEmptyEnvironment()`. Uninitialized and pristine empty are no-ops. Both operations call `can(actor, "demo.manage")` in the service before delivery, capability, and confirmation checks. |
| `src/domains/demo/useDemoData.ts` | The live holder passes the permission actor into Import and awaited Reset. `DataLifecycleGate` still calls the hook without an actor. |
| `src/components/settings/DemoDataPanel.tsx` | Passes `{ permissions }` from the existing auth holder. The panel is still mounted only from the demo composition. |
| `src/domains/demo/__tests__/operatorReset.test.ts` | Empty import, customer and unproven refusal, idempotence, validation-before-write, artifact manifest consistency without a manager import of `@/dataset`, atomic dataset-write failure, blob-scoped reset, blob-deletion failure, empty and uninitialized no-ops, service-level `demo.manage`, delivery lock, credential-key absence, and legacy-marker read. |

Not changed: both registries, `vite.config.ts`, `package.json`, `src/api/config.ts`, `SEED_DATE`, `SEED_VERSION`, dataset hash, `DEMO_PASSPHRASE`, credential policy, `schedulingWrites.test.tsx`, the D9 cap, the W7A boundary, B1, and W8 material. `data/dataset/**` is not read at runtime. No local store was added to the client composition. No `import()` was added to dodge D9. No capability was deleted to shrink a bundle. No new permission was created.

Import source is `createSeedDataset()` only. Success sets marker `sample` and owner `demo`, and leaves the seed ids in place. A validation or write failure preserves the previous dataset and lifecycle. An identical repeated import does not rewrite the dataset. A stored marker `demo` is still read as `sample` without a read-time rewrite; an identical import may canonicalize that stored marker, which is a write, not a read.

Reset ownership comes only from `evaluateDeliveryOwnership()`. Customer and unproven change no dataset bytes. Blob deletion failure stops before the dataset write. Reset does not call `store.reset()`, `clear()`, `blobStore.clear()`, `localStorage.clear()`, or `resetToSeed()`. It does not delete credentials or modify delivery locks. Bootstrap users, roles, organization, and default branding remain the empty-environment contract.

## 3. Graphs

The client build that produced the measured `dist/client` transformed 2035 modules. That count matches the W7A evidence and the earlier W7B evidence. The client entry name is still `assets/index-CUu6ec22.js`.

Emitted `dist/client` text (JS, CSS, HTML), scanned after the build, contains none of `VITE_DATA_SOURCE=demo`, `ava:demo:`, `arena-demo`, `DemoDataPanel`, `demoDataManager`, `DemoBackedNotice`, `localStore`, `DataLifecycleGate`, `createSeedDataset`, `data/dataset/`, `loadDatasetArtifact`, `DEMO_PASSPHRASE`, `data-operator-import`, `data-operator-reset`, `importSample`, or `resetToClean`.

The fixture artifact contains `ava:demo:` 5, `arena-demo` 2, `data-operator-import` 1, `data-operator-reset` 1, `importSample` 2, `resetToClean` 2. Minified names hide `DemoDataPanel` and `createSeedDataset`; the buttons and the seed call are the contract. Those markers are absent from `dist/client`.

`dist` contains only `client` and `demo`.

## 4. Sizes

CLI `gzip -6 -n` per emitted JS, CSS, and HTML file, then sum. Same method as the D9 baseline and as `bundleBudget.test.ts`. Cap `361144` unchanged. Not Vite's gzip column. Not Python `gzip.compress`.

| Artifact | Earlier W7B evidence | This correction | Cap |
| --- | --- | --- | --- |
| client `dist/client` | 306416 | 306416 | 361144, applied |
| client entry JS | 77579 | 77579 (`assets/index-CUu6ec22.js`) | strictly under 273791 |
| largest client JS chunk | 77579 | 77579 | strictly under 400000 |
| demo fixture `dist/demo` | 361729 | 362149 | not applied |
| demo entry JS | 135846 | 136264 (`assets/index-BdeIHyEK.js`) | not applied |

Client headroom is unchanged: 361144 − 306416 = 54728. The fixture total is 1005 above the cap number. That is not a D9 failure. The number is not discarded and the cap was not raised. The fixture growth against the earlier W7B measurement is the service-layer gate and the blob-first reset on the demo graph only.

Nine client files and nine demo files were summed. Font weights 300 and 800 stay absent. `chunkSizeWarningLimit` is still not assigned. Sourcemap stays off.

## 5. Verification

Typecheck before the commit: `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.demo.json` all exit 0. Each build script typechecks again and exits 0.

Focused suites: `operatorReset.test.ts` 20 passed. Combined focused run, 6 files, 68 passed. Bundle and lifecycle suites, 4 files, 47 passed, 4 skipped. The skips are the explicit absent-artifact cases; both composed artifacts were present, so the measurement cases ran.

Full suite, composed artifacts present: 200 files, 2639 tests, 2626 passed, 1 failed, 12 pending. Against the earlier W7B full run, 2628 tests and 2615 passed, the difference is the 11 new contract tests in `operatorReset.test.ts`. 20 − 9 = 11.

One earlier full run in the same tree also reported `emptyEnvironmentPanels.test.tsx` missing the toast `هویت آموزشگاه ذخیره شد`. That file is not in the diff. The same case passed alone, passed in the same process as `operatorReset.test.ts` (30 passed), and did not fail in the full run recorded above. It is not treated as a product regression and was not weakened.

The remaining failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`. It is the same date collision already named for 2026-09-29, extra id `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` was not edited. The test was not skipped and was not weakened. This correction does not claim I19 fixed.

A fetch of `origin/main`, `origin/arena/01a0b059-parsian-music-dashboard-opus`, and `origin/handoff/arena-frontend-pre-backend` into this clone made the `projectState` ref checks pass. The fetch did not create local `main` and did not move those remote-tracking tips after they were stored. `origin/main` remains `15775ea9486cb57fbfb8fefa3268658cbe7eb669`.

## 6. Protected state before the push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. The earlier evidence also recorded backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` and WIP `eb973eb2758447eff16b60ab4fd4c267f9d85061`. This correction does not push those refs. No history rewrite, reset, cherry-pick, or force-push.

## 7. Rollback

Revert `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53`. Parent `619c2bb3efc07308568c0c646e683a0e3a1182d4`. That removes the empty-envelope import, the blob-first reset, and the service-level `demo.manage` gate, and leaves the earlier fixture Import/Reset. It does not restore the three-artifact split, and it does not undo W6 or W7A.

## 8. Handoff

W7A remains complete at the two-composition boundary. W7B fixture Import and Reset now meet the empty-import, blob-first reset, and service-level `demo.manage` contract. `dist/client` gained no demo dependency and is still the D9 subject at 306416. W8 is not started.
