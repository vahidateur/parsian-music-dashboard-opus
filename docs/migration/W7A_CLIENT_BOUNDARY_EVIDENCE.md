# W7A — client delivery boundary: evidence

Parent of this wave: `b3d417e287afda009c12d03ee88e9bfa078f224f`
Implementation: `b8f62877cf50815394e9f1ae26c86fb7da060c7e`
Tree: `b39fbb5fcef4103bb956c75703d6235f5f0d3881`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote` or the GitHub branch API.

W7B is not started. Import Sample and Reset to Clean were not implemented.

## 1. What this wave was

B1 is unchanged: two compositions, `registry.ts` and `registry.client.ts`. No third build. No registry merge. Bare `dist/` and `dist/demo/` stay. The demo composition stays the fixture.

The production deliverable is the existing `APP_TARGET=client` composition. D9's cap applies only to `dist/client` and stays `361144` bytes, `gzip -6 -n`, summing every emitted JS, CSS, and HTML file. The cap was not raised.

The client composition is API-only. It does not gain a local store. `demo` and `local` do not resolve to a local-store path. Unset remains `api`. A non-API value sets `error`, so `ConfigGate` refuses boot. `mode` stays `api` on that refusal only so a missed guard cannot select `local`.

The fixture composition is unchanged. `demo` still aliases to `local`. Unset is still `local`. Unknown values still fail boot and still use mode `local` plus `error`, because the union has no third mode.

## 2. What changed

Four files. +128 / −38.

| File | Change |
| --- | --- |
| `src/api/config.ts` | `resolveConfig` takes an explicit target, defaulting to `__APP_TARGET__`. The client branch refuses `local`, `demo`, and any other non-API value. The fixture branch is the W6 rule, unchanged. |
| `src/api/__tests__/config.test.ts` | Existing fixture cases still call `resolveConfig` with no target. New cases pass `"client"`. |
| `src/__tests__/bundleBudget.test.ts` | The unchanged `361144` assertion measures `dist/client`. The fixture is reported from `dist/demo`, else bare `dist/`, with the same `gzip -6 -n` method, and the cap is not applied. Absent artifacts skip. |
| `src/__tests__/bundleBoundary.test.ts` | Comment only. It no longer says the budget reads bare `dist/`. |

Not changed: `vite.config.ts`, both registries, target aliases, `cspCompatibility.test.ts`, `schedulingWrites.test.tsx`, `SEED_DATE`, `SEED_VERSION`, `DEMO_PASSPHRASE`, `data/dataset/**`, ownership, lifecycle, delivery locking, authorization, provenance. `docs/architecture/environments.md` still describes the pre-W6 unset model. It was left stale on purpose; this wave is not a documentation cleanup.

No demo module was imported in order to hide it. No client local store was added.

## 3. Client graph

`npm run build:client` transformed 2035 modules. `npm run build:demo` transformed 2096. Those counts match the W6 evidence. The client count did not grow.

A second client build, `write: false`, listed Rollup module ids. It did not replace `dist/client`. Of 2035 ids, 201 were under `src/` or `data/`. None were:

- `demoDataManager`, `DemoDataPanel`, `DemoBackedNotice`
- `DEMO_PASSPHRASE`, `localAuthRepository`, `localStore`
- `domains/demo/`, `demo/lifecycle`, `demo/delivery`, `localDeliveryRepository`, `localDemoDataset`
- `DataLifecycleGate`, `data/dataset`, `dataset/`
- the demo `registry.ts`

`src/domains/registry.client.ts` was in the graph. The demo registry was not.

Emitted `dist/client` text (JS, CSS, HTML) contains none of `ava:demo:`, `arena-demo`, `md_gal_hall`, `demoDataManager`, `DemoDataPanel`, `DemoBackedNotice`, `data/dataset`, `بدون امنیت واقعی`, or `حذف دادهٔ دمو`. `__APP_TARGET__` is not left as an identifier. The entry chunk's resolver defaults to the literal `"client"` and the module initializes it with no arguments, so boot takes the API-only branch. The fixture branch remains in that shared function because the target argument is a runtime parameter. Nothing in the client graph calls it with `"demo"`. It does not import a demo module.

## 4. Sizes

CLI `gzip -6 -n` per file, then sum. Same method as the D9 baseline. Cap `361144` unchanged.

| Artifact | W6 evidence | This wave | Cap |
| --- | --- | --- | --- |
| client `dist/client` | 306304 | 306416 | 361144, applied |
| demo fixture `dist/demo` | 361118 | 361222 | not applied |
| client entry JS | — | 77579 | strictly under 273791 |
| largest client JS chunk | — | 77579 | strictly under 400000 |

Client headroom: 361144 − 306416 = 54728. The client total is the sum of every emitted JS, CSS, and HTML file, not Vite's own gzip column.

The fixture number 361222 is above 361144 by 78. That is not a production failure. The cap was not applied, and the number is not discarded. The growth against W6 is the client refusal string living in the shared config module, so the demo bundle contains it too. Fixture behavior was not changed to chase the old headroom. Bare `dist/` was not kept beside the composed outputs: a bare `vite build` empties `dist/` and would remove `dist/client` and `dist/demo`. The budget test therefore reports `dist/demo`.

Font weights 300 and 800 stay absent. `academicViews`, `operationsViews`, and `vendor` are separate client chunks. `chunkSizeWarningLimit` is still not assigned. Sourcemap stays off.

## 5. Verification

Typecheck: `tsconfig.json`, `tsconfig.demo.json`, and `tsconfig.client.json` all exit 0. `build:client` and `build:demo` each typecheck again and both exit 0.

Focused suites after those builds: `config.test.ts`, `bundleBudget.test.ts`, `bundleBoundary.test.ts`, `registryClient.test.ts` — 38 passed, 4 skipped. The skips are the explicit absent-artifact cases; both artifacts were present, so the measurement cases ran. The fixture case reports `361222` in its name and does not compare it to `361144`.

`projectState.test.ts`, after fetching branch refs into this clone: 52 passed. That fetch did not move `main`, the backup branch, or the WIP tag.

Full suite, same fetch, composed artifacts present, bare `dist/` absent: 199 files, 2619 tests, 2606 passed, 1 failed, 12 skipped.

The failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`. The extra id is `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` was not edited.

Eight of the skips are `cspCompatibility.test.ts`, which still reads bare `dist/` and was not modified. An isolated run against a temporary bare build passed 17/17. The composed artifacts were restored afterward; they are what the budget numbers above measure. The other four skips are the absent-artifact cases in the two bundle tests.

An earlier full run, before the fetch, also failed `projectState.test.ts` because this clone was shallow and single-branch. That is not a product failure. One `messagesConversationExport.test.tsx` assertion failed in that first run and passed on an isolated rerun and in the fetched full run. It is not in the diff.

## 6. Protected state before the implementation push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP `eb973eb2758447eff16b60ab4fd4c267f9d85061`. Not modified. No history rewrite, reset, cherry-pick, or force-push.

## 7. Rollback

Revert `b8f62877cf50815394e9f1ae26c86fb7da060c7e`. Parent `b3d417e287afda009c12d03ee88e9bfa078f224f`. That restores the client `local` / `demo` resolution to mode `local`, and points the production cap back at bare `dist/`. It does not undo W6.

## 8. Handoff

W7A COMPLETE. W7B NOT STARTED. B1 remains two compositions. The production cap remains 361144 and applies only to the client artifact measured above. The demo fixture is not the deliverable and is not capped.
