# W3 complete — store and plumbing: handoff

**Read this first. W3 is finished and the implementation is on GitHub. W4 is NOT started.**

| | |
| --- | --- |
| Wave | **W3 — Store and shared plumbing become canonical** |
| Branch | docs/demo-migration-plan (no backticks) |
| Baseline / parent SHA | `713d9b3a43d825fb9f3cca01a05878f813ba60bd` (the W2 tip) |
| Implementation commit | `5fadf0769273178bd07c770f907871753f541768` |
| Evidence | `docs/migration/W3_STORE_PLUMBING_EVIDENCE.md` |
| Rollback | `713d9b3a43d825fb9f3cca01a05878f813ba60bd` — revert is total; no key or env value moved |
| Next wave | **W4 — repositories become the canonical local implementation.** Do not start it from this session. |

---

## 1. What the wave delivered

The local store is now the canonical persistence authority.

```
LocalDataStore          the interface (src/services/localDataStore.ts)
LocalStoreImpl          the class (src/services/localStore.ts)
localStore              the singleton, annotated @__PURE__ as before
demoStore               the same object, re-exported from src/services/demoStore.ts
CanonicalDatasetSource  what the store asks when a persisted payload is missing collections
```

Storage keys are still `ava:demo:dataset` and `ava:demo:lifecycle`.

Shared paging and the shared error constructors live in `src/domains/shared/repositoryPlumbing.ts`. `demoCollection.ts` re-exports them. The function bodies are the previous ones (comment-stripped text is identical).

`mediaStillReferenced` takes `LocalDataStore`. The file was not renamed.

The independent dataset can feed the store. A test loads the artifact, installs it with the existing `initializeEnvironment`, and shows a repository reading the artifact's students. A second case shows an artifact-backed migration fill equals the seed-backed fill. The production default is still the seed builder. That is deliberate, and §3 of the evidence says why a runtime read of the artifact is not legal in this wave.

## 2. State of the repository

| Ref | SHA | Note |
| --- | --- | --- |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` | unchanged |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` | unchanged |
| docs/demo-migration-plan | implementation `5fadf0769273178bd07c770f907871753f541768` plus this handoff's commit | remote-verified for the implementation; the handoff commit is verified in §9 |
| protected WIP (`arena/01a0e8ec-…`, HEAD `eb973eb…`) | untouched | recovery source; never write to it |

## 3. Architectural change, in one paragraph

Repositories still implement domain behaviour. The store still persists one snapshot under the old keys. What changed is the type boundary and the data-loading seam: canonical code can name `LocalDataStore` instead of the class, and the store no longer calls `createSeedDataset()` itself — it asks a source, whose production default is that builder. The 20 `Demo*Repository` classes are still the implementations. Composition, builds, D8 and the delivery lock did not move.

## 4. Responsibilities moved / not moved

Moved: store module, store interface, dataset-fill dependency, repository-plumbing module, media-reference parameter type, test-harness import.

Not moved: the 20 repositories, both registries, lifecycle/delivery/`demoDataManager` call sites, storage keys, seed constants, `demoReferences.ts` file name, `demoEnvironment.ts` file name, `demoCollection` import paths (shim remains), B1, D8, D9 constants, I19, the backend.

The W3/W9 contradiction on when `demoCollection` and `demoReferences` are renamed is preserved in the plan. W3 did the structural plumbing move and the parameter retype. It did not do W9's file-name sweep.

## 5. Verification summary

* **Full suite, no `dist/`** — baseline 197 files / 2580 pass / **1 fail** / 15 skip → W3 198 files / **2587 pass** / **1 fail** / 15 skip. +1 file / +7 tests. No new failure.
* **Full suite, with `dist/`** — 198 files / **2600 pass** / **1 fail** / 2 skip (2603). The 13-test difference from the no-`dist/` run is the dist-dependent gates, same shape as W2.
* **The one failure is I19** at `schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`. Proven pre-existing on the W2 tip in this session. Do not retime it. Do not change `SEED_DATE`.
* **Typecheck** — all three tsconfigs pass.
* **Boundaries** — `m10Boundary` 13, `architectureBoundaries` 26, `bundleBudget` 8, `cspCompatibility` 17, `bundleBoundary` 2 pass / 2 expected skips.
* **D9 (bare build)** — W2 recorded **361,026** → W3 **361,039** (+13 B). Cap `361144` untouched. Headroom **105 B**. Client total **306,291**, equal to the W2 recorded total. Entry gzip 135,154 (W2 recorded 135,138), still far under 273,791.
* **Tests were extended, not weakened.** Unlike W2, this wave did edit test files: the store-import bans grew a `localStore` arm so the rename could not bypass them. No expected value changed.

## 6. Compatibility — do not break these

* Keys `ava:demo:dataset` and `ava:demo:lifecycle`. A new `ava:local:*` key would be a compatibility break.
* `import { demoStore, DemoStoreImpl } from "@/services/demoStore"` must keep working until W4/W9 sweep the imports. The shim must not construct a second instance.
* `DemoStore` is the interface. Do not point it back at the class.
* `VITE_DATA_SOURCE=demo`, persisted `empty`/`demo`, the backup envelope, `demo.manage`, `SEED_VERSION`, `SEED_DATE`.
* The W2 rule: no production module imports `@/dataset/load`, `validate`, `write`, or a dataset JSON file. The feed test is allowed to import the loader because it is a test.

## 7. Things a fresh agent must not "fix"

1. Do not switch the runtime onto the artifact. That is B2 or a D9 breach. The seam is the proof, not a fetch.
2. Do not delete the shims to "finish the rename".
3. Do not rename repositories, registries, or `demoReferences.ts`.
4. Do not edit the wave plan to erase the W3/W9 contradiction or the "30 collections" drift.
5. Do not raise D9, retime I19, or touch the protected WIP checkout.
6. Do not put the artifact directory path into a production comment. The W2 suite scans source text for it.

## 8. Open decisions (unchanged; all still the owner's)

* **D8** — required before W5. Not touched.
* **Build strategy B1/B2/B3** — required before W5. **B1 is in force.** W3's measurement is additional input: the store seam cost +13 B on the bare build, and the artifact is still not in any bundle.
* **Demo credentials** — before W7. Untouched.
* **Optional `demo.manage` rename** — still optional.

## 9. Remote verification of the implementation

Recorded after the implementation push, before this handoff commit.

| Check | Result |
| --- | --- |
| `git ls-remote origin refs/heads/docs/demo-migration-plan` | `5fadf0769273178bd07c770f907871753f541768` |
| GitHub API branch | same SHA, tree `ed96ecc7298fe4772a599a30dfc7ecfe236d97bf`, equal to the local tree |
| `src/services/localStore.ts` blob | GitHub SHA equals `git rev-parse HEAD:src/services/localStore.ts` (`45274d7741eec2b54afd296bc8b40dd0fb2816bf`) |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` unchanged |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` unchanged |
| Protected WIP | HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`, tracked-diff hash unchanged |
| Push mode | ordinary push of one commit — no force, no rebase, no squash, no merge |

This handoff's own commit cannot quote itself. The addendum after the next push records that SHA. Verify the tip with:

```bash
git ls-remote origin refs/heads/docs/demo-migration-plan
```

## 10. Next wave

**W4 — repositories become the canonical local implementation (batched per domain).** The interface it needed is in place. Do not start W4, W5, or the eradication audit from this handoff.
