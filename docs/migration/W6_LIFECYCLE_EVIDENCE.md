# W6 — lifecycle marker: evidence

Parent / rollback: `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac`
Implementation: `bfddc30bce1288f25135f313758bf5fa3bb26949`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote`.

## 1. What was authorized

The owner corrected the blocked W6 reading. The authorized change is only this:

- `sample` is the canonical lifecycle write.
- `demo` remains a read alias for that kind. A read does not rewrite a stored `demo` marker.
- Every lifecycle, delivery, and backup consumer required for ownership and restore correctness is in the same change.
- Full Import / Reset-to-clean is not this wave.
- A Demo Mode on/off switch is not this wave.
- B1 stays. The dataset is not fetched and is not added to the client bundle.
- D9 cap stays `361144`.
- Credentials are not changed.

`VITE_DATA_SOURCE` was not renamed. That half of the written W6 file list was not part of this authorization, and the remaining headroom after this change is 28 B. It was not attempted.

## 2. What changed

Thirteen files. +135 / −68.

| File | Change |
| --- | --- |
| `src/domains/demo/types.ts` | Canonical modes are `empty` and `sample`. `canonicalLifecycleMarker` reads stored `demo` as `sample`. `provenanceForLifecycle` maps `sample` to the existing provenance owner `demo` and origin `seed`. |
| `src/services/localStore.ts` | The reader uses that canonicalization and does not rewrite the key. An explicit write of `sample` replaces a raw `demo` marker. Provenance stamping uses the helper, so a sample environment is not stamped `customer`. |
| `src/domains/demo/lifecycle.ts` | New initialization and adoption write `sample`. `isDemoEnvironment` is true for that kind. |
| `src/domains/demo/useDataLifecycle.ts` | The chooser calls the sample initialization path. The hook name `chooseDemo` stays. |
| `src/domains/demo/demoDataManager.ts` | `resetToSeed` and `importSeed` record `sample`. Backup export of a non-empty environment still writes envelope `demo`. |
| `src/domains/demo/delivery.ts` | A canonical `sample` marker is showcase ownership. The delivery verdict token stays `demo`. Expected provenance owner stays `demo`. |
| `src/components/lifecycle/LifecycleRecoveryPanel.tsx` | A sample environment is still labelled with the existing string `محیط دمو`, not as customer data. |
| Tests | New writes expect `sample`. Two new assertions: a stored `demo` marker reads as `sample` and is not rewritten; a legacy `demo` marker is still showcase-owned and deletable. |

Not changed: `src/api/config.ts`, `Login.tsx`, `FirstRunChooser.tsx` (its test expectation only), backup schema (`demo` \| `empty`), storage keys, `demo.manage`, credentials, dataset bytes, build configs, the registry, I19, `SEED_DATE`.

## 3. Behaviour

A new showcase environment persists the marker `sample`. An older browser that stored `demo` still reads as the same kind. Reads do not migrate the key. The next explicit marker write does.

Delivery still treats that kind as removable showcase data, and a customer environment as customer. A locked restore still rejects a backup whose envelope is `demo`. The envelope was not given a `sample` token, because the validator treats any other environment string as a foreign file. Writing `sample` there would have failed open only if the lock had been left matching `demo` alone; the envelope write was left as `demo` so the lock did not have to grow a second accepted token.

Provenance owner remains the stored token `demo` for showcase data. Renaming that field was not authorized.

Empty still means the customer environment: zero academy records plus the bootstrap administrator. This wave does not delete that account and does not add a Reset-to-clean operation.

## 4. Verification

Typecheck: `tsconfig.json`, `tsconfig.demo.json`, and `tsconfig.client.json` all exit 0.

Focused suites before the full run: 10 files, 122 passed. That set includes the 447-line lifecycle suite, delivery, backup, the chooser, and the gate.

Full suite, with the three build trees present: 2608 tests, 2603 passed, 3 failed, 2 skipped. Two of the failures were `projectState.test.ts` in a single-branch clone that did not yet have `origin/main` or the preserved-branch objects. After `git fetch` of those refs, that file passed 52/52. The remaining failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` was not edited.

D9, CLI `gzip -6 -n`, JS+CSS+HTML, cap `361144` unchanged:

| Artifact | W5 | W6 | Delta |
| --- | --- | --- | --- |
| bare | 361,056 | 361,116 | +60 |
| demo | 361,055 | 361,112 | +57 |
| client | 306,291 | 306,291 | 0 |
| bare entry | 135,171 | 135,231 | +60 |

Headroom after this wave: 361,144 − 361,116 = 28 B. Largest JS gzip 135,231, under 400,000 and under the entry anchor 273,791. Module counts unchanged (bare/demo 2096, client 2035).

The dataset artifact was not in the diff. Client bundle size did not change.

## 5. Protected state at the implementation push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`. Not modified.

The implementation push was an ordinary push. `git ls-remote` and the GitHub branch API both returned `bfddc30bce1288f25135f313758bf5fa3bb26949`. The remote tree was `34c10290b46953eefebbaf32e5f53494f5b9b922`.

## 6. Rollback

Revert `bfddc30bce1288f25135f313758bf5fa3bb26949`. Parent `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac`. A marker written as `sample` after this wave is not understood by the parent build: the parent reader treats an unknown marker as no choice. Markers that are still stored as `demo` remain readable by both. No key moved.

## 7. Not started

Import Demo Dataset, Reset to Clean State, and the `VITE_DATA_SOURCE=local` alias were not implemented. W7 was not started.
