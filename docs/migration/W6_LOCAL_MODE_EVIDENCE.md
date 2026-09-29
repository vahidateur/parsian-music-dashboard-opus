# W6 delta — local mode alias: evidence

Parent of this delta: `934a6d62f2d6edc4b06ccb29de118679dc9b038a`
Implementation: `896fddd2531d7d72dc9c23f63b3a7657a5035ad7`
Tree: `a1c0b8851ae7aa60d675ff36442b495a67c5ee64`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote` or the GitHub branch API.

The earlier lifecycle evidence at `docs/migration/W6_LIFECYCLE_EVIDENCE.md` is left as written. It correctly says `config.ts` was outside that authorization. A later owner decision authorized this delta. That sentence is not erased.

## 1. What this delta was

On top of the already-pushed lifecycle commit, not a rewrite of it:

- Internal runtime mode is `local | api`.
- `VITE_DATA_SOURCE=demo` is a legacy alias of `local`. It is not a second application.
- An unset value still selects `local` in the demo composition and `api` in the client composition.
- An unknown value still refuses boot. It does not fall back to local data.
- Production aliases still resolve to `api`, never to `local`.
- The Login heading `محیط دمو` is a lifecycle label. It now says `دادهٔ نمونه`, matching the existing orthography.
- Full Import / Reset was not built. The backup envelope was not changed.

## 2. Rollback of a persisted `sample` marker

Checked against parent reader `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac`, not assumed.

That build's `LIFECYCLE_MODES` is `empty | demo`. `readLifecycleMarker` returns null for any other string, including `sample`. Delivery then returns `unproven`, not `customer`. The customer branch runs only when the marker is recognized and is not `demo`. `sample` never reaches it.

Post-delivery, a null marker plus a dataset is an in-memory `empty` when capability is off. That path does not rewrite the key.

So a browser that stored `sample` and then runs the parent build does not treat that marker as customer. No extra compatibility layer was added. `demo` was not kept as the canonical write. The forward read of stored `demo` as `sample` remains the layer already shipped in `bfddc30`.

## 3. What changed

Fifteen files. +60 / −43. `src/domains/demo/backup.ts`, `lifecycle.ts`, and `delivery.ts` are not in the diff.

| File | Change |
| --- | --- |
| `src/api/config.ts` | `DataSourceMode` is `local \| api`. `demo` and `local` both resolve to `local`. Unset and unknown behavior otherwise unchanged. `isDemoMode()` is true for `local`. |
| `src/env.d.ts` | The env input type accepts `local`, `demo`, and `api`. |
| `src/targets/targetFeatures.tsx` | Sample-state heading is `دادهٔ نمونه — بدون امنیت واقعی`. Empty heading, credential button, and passphrase are unchanged. |
| Tests | Runtime setups that meant the local data source now pass `mode: "local"`. Login tests assert the new heading and still reject it in api and empty. |

Not changed: storage keys, backup envelope `demo \| empty`, locked-restore rejection, `demo.manage`, credentials, dataset bytes, build strategy, I19, `SEED_DATE`.

## 4. Verification

Typecheck: `tsconfig.json`, `tsconfig.demo.json`, and `tsconfig.client.json` all exit 0.

Focused suites: 10 files, 113 passed. That set includes config, the login label tests, lifecycle, delivery, the chooser, the gate, and the date-coherence file whose mode literals had to compile.

Full suite, after fetching branch refs: 2609 tests, 2605 passed, 2 failed, 2 skipped. `projectState.test.ts` passed. One failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`: an extra session id, truncated by the reporter as `…(1)`. That file is not in the diff. The other failure was `emptyEnvironmentPanels.test.tsx` timing out on a toast during the full run. Isolated rerun: 10/10 passed in 4.5s. It is not in the diff.

D9, CLI `gzip -6 -n`, JS+CSS+HTML, cap `361144` unchanged:

| Artifact | After lifecycle commit | This delta | Delta |
| --- | --- | --- | --- |
| bare | 361,116 | 361,123 | +7 |
| demo | 361,112 | 361,118 | +6 |
| client | 306,291 | 306,304 | +13 |
| bare entry | 135,231 | 135,239 | +8 |

Headroom: 361,144 − 361,123 = 21 B. Largest JS gzip 135,239, under 400,000 and under the entry anchor 273,791. Module counts unchanged (bare/demo 2096, client 2035).

Client bundle marker check, not the size delta: `datasetSha256` `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f`, the manifest label `Sample academy dataset`, `data/dataset/`, and `ava:demo:dataset` are absent from `dist/client`. The client growth is the config refusal string in the entry chunk.

## 5. Protected state at the implementation push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`. Not modified.

The implementation push was an ordinary push of `docs/demo-migration-plan`. The GitHub branch API returned `896fddd2531d7d72dc9c23f63b3a7657a5035ad7`, parent `934a6d62f2d6edc4b06ccb29de118679dc9b038a`, tree `a1c0b8851ae7aa60d675ff36442b495a67c5ee64`.

## 6. Rollback of this delta

Revert `896fddd2531d7d72dc9c23f63b3a7657a5035ad7`. Parent `934a6d62f2d6edc4b06ccb29de118679dc9b038a`. That returns the runtime mode token to `demo` and the login heading to `محیط دمو`. It does not undo the lifecycle marker change in `bfddc30`.
