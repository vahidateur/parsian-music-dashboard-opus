# W10 — eradication audit

Parent: `c783bec7ae334e30e9b557f6b331ac5a1d9ed556`
W9 implementation: `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16`
Branch: docs/demo-migration-plan (not backticked)

This document is the audit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote`.

No product file, gate, config, or test was edited. No build was run. No rename or deletion was performed. Historical reports, handoffs, and archive files were not retro-edited.

**Migration Complete = NOT PROVEN**

## 1. Scope and authoritative baseline

W10 is a read-only eradication audit of the closed two-composition boundary. The waves sentence "the build reflects one application" is read here as: the client composition is the application boundary, and Demo remains fixture, data, and import tooling. It is not authorization to merge the compositions.

Authoritative tip at the start of this audit: `c783bec7ae334e30e9b557f6b331ac5a1d9ed556`. Its parent is the W9 implementation. W7A, W7B, W8, and W9 commits are ancestors. Protected refs were not moved: `main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`, backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`, archive tag `eb973eb2758447eff16b60ab4fd4c267f9d85061`.

Preserved, and not reopened: two compositions, separate registries, D9 subject `dist/client`, cap exactly `361144`, fixture outside that cap, Import/Reset fixture-only, storage keys, credentials, `SEED_DATE`, `SEED_VERSION`, `APP_TARGET`, and I19.

## 2. Two-composition boundary

PASS against the closed boundary. Source at the tip:

- `build:client` writes `dist/client`.
- `build:demo` writes `dist/demo`.
- Bare `build` is `vite build` and does not name a third outDir.
- Registries are `registry.ts`, `registry.client.ts`, and `registryCore.ts` only.
- No customer or operator registry, tsconfig, or script exists.
- `vite.config.ts` aliases `@/domains/registry` to `registry.client.ts` only when `APP_TARGET` is exactly `client`.
- Target pairs exist for environment, library provisioning, gallery provisioning, target copy, target features, and command showcase. Each has a `.client` file.

`src/targets/environment.tsx` states the recorded rule: one application, two composition roots. The client seam answers without importing the demo store, the seed, or the lifecycle.

Recorded W9 artifacts, not rebuilt here: client entry `assets/index-CUu6ec22.js`, 2035 modules; fixture entry `assets/index-BdeIHyEK.js`, 2095 modules. `dist` contained only `client` and `demo`.

## 3. Remaining Demo* architecture inventory

Filename matches for `demo` or `Demo` at the tip: 41 paths. Classification:

### Required or justified

These are the fixture composition, its disclosure, or the client seam that keeps that fixture out of the client graph.

- `src/domains/demo/**` seed, lifecycle, delivery, backup, `demoDataManager.ts`, `useDemoData.ts`, and `useDataLifecycle.ts`.
- `src/domains/auth/demoCredentials.ts`.
- `src/domains/gallery/demoContent.ts` and `src/domains/library/demoContent.ts`. Fixture byte provisioning, gated by `isDemoCapabilityAvailable()`.
- `src/components/settings/DemoDataPanel.tsx`. Fixture operator UI.
- `src/components/shell/DemoBackedNotice.tsx`. D8 disclosure for the demo composition.
- `src/api/deploymentLock.ts`. Capability lock. Not a second application.
- `src/test/demoEnvironment.ts`. Test harness.
- Non-client target files. The demo composition root.
- `tsconfig.demo.json`. The demo typecheck profile.
- `DemoNote` in `environment.tsx`. Demo labelling. The client file exports the same name and returns null.
- `DemoServedDomain`. Enumeration type. The client list is empty. The demo list is the twelve locally served domains.

### Compatibility-required

Not a second implementation. A future removal would be an import sweep and is not authorized here.

- `src/services/demoStore.ts` re-exports `localStore`. It constructs nothing. Production local repositories, the demo lifecycle, and `targets/environment.tsx` still import this path. The keys are the same keys.
- `src/domains/chat/demoRepository.ts`, `classes/demoRepository.ts`, `learning/demoRepository.ts`, and `progress/demoRepository.ts` re-export `localRepository` and declare no class. `canonicalRepositories.test.ts` locks that. Their file bodies do not contain the token `demo`. No application specifier imports those four paths. Domain READMEs still name them. That is why they remain.

### Fixture or import-only

- `data/dataset/**`, including `manifest.json`. The committed sample artifact. Runtime import is `createSeedDataset()`, not a read of `data/dataset/**`.
- Import and Reset live in `demoDataManager.ts` and are reached from the fixture panel, not from `registry.client.ts`.

### Candidate for a future authorized wave

Deferred. Not removed.

- Stale domain READMEs that still call `demoRepository.ts` "the implementation in use", including scheduling, compensation, attendance, chat, and the copied template line in several other READMEs. The implementation is `localRepository.ts`.
- Comment citations of the deleted names `demoReferences.ts` and `demoCollection.ts` in `src/domains/media/release.ts`, `src/domains/media/ProfilePhotoField.tsx`, `src/domains/gallery/GalleryPanel.tsx`, `src/domains/gallery/__tests__/galleryPanelHonesty.test.tsx`, `src/domains/chat/README.md`, and one non-path word in `docs/engineering/OPEN_ITEMS.md`.
- The `demoStore` import path, once a separately authorized sweep retargets every importer to `localStore`.
- Shared-view string literals that say `دمو`. They are gated by `useIsDemoEnvironment()`. The client hook returns `false`. The literals can still appear in the client artifact because both branches are in the shared source. W8 already recorded that `دمو` is not an absence marker. A target-split of that copy is not this audit.

No live Demo* production file was classified as unnecessary architecture. No deletion was performed.

## 4. Residual mention classification

`DEMO_INVENTORY.md` recorded an estimate: about 230 of 351 token-carrying files mentioned "demo" only in comments, test titles, or boundary assertions. That estimate is not the current count. This audit measured the tip and did not rename anything.

Method: case-insensitive token `demo` in `.ts`, `.tsx`, `.md`, `.json`, and `.mjs`, excluding `.git`, `node_modules`, and `dist`.

| Class | Files |
| --- | ---: |
| Tests | 171 |
| Production `src` | 177 |
| Documentation other than handoffs and wave evidence | 57 |
| Historical evidence and handoffs | 23 |
| Historical archive | 1 |
| Other (`package.json`, both tsconfigs, `vite.config.ts`, dataset JSON) | 9 |
| Total | 438 |

Inside production `src`, 62 files mention the token only in comments. Those are incidental vocabulary, not a second architecture. They were not swept.

Old Class-H names that remain are citations, not modules:

- `demoReferences`: 31 hits in 14 files. Two are current gates that forbid the old path. The rest are comments or historical documents.
- `demoCollection`: 35 hits in 18 files. Same split: current gates, one plumbing comment, and historical or comment citations.

UI copy: `دمو` occurs in shared views and in the demo target (`targetFeatures.tsx`, `targetCopy.ts`, `DemoDataPanel.tsx`, `ProductionDeliveryGate.tsx`). It does not occur in `registry.client.ts` or the `.client` target files. Runtime selection is the client hook returning false.

Historical migration reports, handoffs, and the archive still describe the old names and, in places, a single composition. They stay as written.

## 5. Client isolation audit

PASS on source, and on the recorded W9 artifact. Not rebuilt.

`registry.client.ts` imports API repositories, `registryCore`, and the unavailable-repository helper. It does not import `domains/demo`, `demoDataManager`, `DemoDataPanel`, `DemoBackedNotice`, `localStore`, `demoStore`, `DataLifecycleGate`, `createSeedDataset`, a dataset loader, demo credentials, or a local or demo repository. `DEMO_SERVED_DOMAINS` is empty.

`targetFeatures.client.tsx` mounts the unavailable-domain notice. Settings, login assist, and lifecycle slots return null or transparent children. `environment.client.tsx` returns `false` from `useIsDemoEnvironment()` and `null` from `DemoNote`, and its header says importing the real lifecycle would pull `demoStore` into the client bundle.

The twelve unserved domains resolve to `DOMAIN_UNAVAILABLE`.

Recorded W9 client text contained none of `VITE_DATA_SOURCE=demo`, `ava:demo:`, `arena-demo`, `DemoDataPanel`, `demoDataManager`, `DemoBackedNotice`, `localStore`, `DataLifecycleGate`, `createSeedDataset`, `data/dataset/`, `loadDatasetArtifact`, `DEMO_PASSPHRASE`, `data-operator-import`, `data-operator-reset`, `importSample`, or `resetToClean`. `دمو` occurred 13 times and was not added to the absence list.

## 6. APP_TARGET audit

Recorded. Not changed.

```text
APP_TARGET === "client" ? "client" : "demo"
```

- `client` selects the client composition and the client registry.
- `demo` selects the demo composition.
- Unset selects demo.
- Any other value, including `operator` and `customer`, selects demo. It is not an error.

`explicitSelectionGate` locks the type union to `"demo" | "client"` and forbids the strings `"operator"` and `"customer"` in `vite.config.ts`. It does not execute the fallback.

Data-source selection is separate and already fail-closed for unknown `VITE_DATA_SOURCE` values. The client composition refuses `local`, `demo`, and unknown values, and keeps `mode` at `api`. The demo composition maps unset, `local`, and `demo` to local, and refuses unknown values rather than treating them as a silent success.

Finding, deferred: unknown `APP_TARGET` falls back to the demo composition. That is the recorded implementation. W10 does not change it.

## 7. Security audit

PASS for the closed fixture boundary. Not a claim that production security is finished.

`importSample` and `resetToClean` call `operatorGate` before a write. That gate requires `can(actor, "demo.manage")`, then `isDestructiveOperationAllowed()`, then `isDemoCapabilityAvailable()`, then confirmation. The comment says hiding the button is not the check. Reset writes only when `evaluateDeliveryOwnership()` returns `demo`. Customer and unproven envelopes are not written. The client settings slot does not mount `DemoDataPanel`.

Credentials stay in `demoCredentials.ts` under `ava:demo:credentials`. The client registry does not import that module. `docs/security.md` still says demo login compares a public constant in plaintext and that password hashing is a backend responsibility. That is fixture-scoped. It is not server credential storage.

No storage-key migration occurred. The keys at the tip are `ava:demo:dataset`, `ava:demo:lifecycle`, `ava:demo:credentials`, and `ava:demo:session`.

`docs/security.md` §8 remains explicit and unimplemented: server password hashing, server authorization on every endpoint, server rate limiting, server session revocation, CSRF if cookies are used, tenant isolation, IDOR checks, an append-only progress log, audit logging, breached-password checks, admin MFA, the upload pipeline, and encrypted backups. Client roles are documented as UX only. Those items are backend dependencies, not a W10 code change.

## 8. Dataset, seed, and storage-key invariants

PASS. Unchanged at the tip, and pinned by `datasetSchemaGate.test.ts`.

- Manifest `schemaVersion` is `1`.
- `SEED_VERSION` is `2026.09.2`.
- `SEED_DATE` is `2026-09-01`.
- Storage keys are the four `ava:demo:` keys above.
- `schedulingWrites.test.tsx` is not in the W9 or W10 diff.

## 9. D8/D9 governance

D9 is governed. Recorded W9 measurement, not a new build:

| Artifact | Bytes, `gzip -6 -n` | Cap |
| --- | ---: | --- |
| `dist/client` | 306416 | 361144, applied |
| headroom | 54728 | |
| client modules | 2035 | |
| `dist/demo` | 362149 | not applied |
| fixture modules | 2095 | |

The cap constant in `bundleBudget.test.ts` is still `Math.floor(343947 * 1.05)`, which is `361144`. The subject lock still says `dist/client`. The cap was not raised and was not applied to the fixture.

D8 is governed in code as two mirrored 12-id lists, both including `organization`: `DEMO_SERVED_DOMAINS` and `UNAVAILABLE_DOMAINS`. The demo composition still resolves those twelve to the local implementation in both data-source modes, and the notice reads that list. That is the closed disclosure, not a silent client fallback.

`W1_DECISION_BOUNDARY.md` still says the D8 membership decision is pending. That record was not updated. Formal closure of the owner decision is not proven by W1. The code enumeration is.

## 10. Known test baseline and I19

Recorded W9 full suite, not re-run: 203 files, 2659 tests, 2644 passed, 3 failed, 12 skipped.

The product failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra id `ses_cl2_20260929_1400`. That file was not edited. This audit does not treat I19 as a W10 implementation failure and does not fix it.

The other two recorded failures are `projectState` in a single-branch clone that lacks preserved tip `251af96f405df5935ee17ddc9ba6b490f7989c2d` and `origin/main`. They are not product failures. Fetch was not used to clear them.

The boundary gates were not among those three failures. They were not executed again for this audit.

## 11. Findings and deferred work

1. Unknown or unset `APP_TARGET` selects demo. Recorded. Not changed.
2. `demoStore.ts` and the four `demoRepository.ts` shims are compatibility paths. Removal needs a separate authorization and an importer sweep. Not done.
3. Domain READMEs still describe `demoRepository.ts` as the live implementation. Documentation drift. Not retro-edited.
4. Comment citations of `demoReferences` and `demoCollection` remain outside the gates. Not swept.
5. About 62 production files mention `demo` only in comments. The old ~230 figure is a pre-migration estimate, not the current census. Not swept.
6. Shared views still contain `دمو` string literals. The client hook makes the demo branch unreachable. The literals are not a client fixture import. A copy split is deferred.
7. I19 remains.
8. W1 still records D8 membership as pending. Code has the 12-id pair.
9. `docs/security.md` §8 remains backend work. None of it was implemented.
10. The rejected three-artifact commits remain in history. They are not the closed contract.
11. No post-W10 implementation wave was started.

## 12. Explicit final determination

The closed two-composition tree matches the authorized reading of W10. The client composition is the application boundary. Demo remains fixture, data, and import tooling. Registries were not merged. D9 still measures `dist/client` at the recorded 306416 against cap 361144. The recorded gates still describe that boundary.

That is not proof that the migration is complete.

Backend requirements in `docs/security.md` §8 are identified and not implemented. I19 is open. The W1 D8 decision text is still pending. Residual names and comments were classified and left in place. Unknown `APP_TARGET` still selects demo.

Migration Complete = NOT PROVEN
