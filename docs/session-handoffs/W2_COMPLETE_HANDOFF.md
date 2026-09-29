# W2 complete — dataset extraction: handoff

**Read this first. W2 is finished and verified; the next wave (W3) is NOT started, by rule.**

| | |
| --- | --- |
| Wave | **W2 — Dataset extraction (data becomes an artifact)** |
| Branch | `docs/demo-migration-plan` |
| Baseline commit | `bab9e460b603f9499a9b0735050e1cb729384602` (the W1 tip) |
| W2 implementation commit | _recorded by the remote-verification commit below_ |
| Evidence | `docs/migration/W2_DATASET_EXTRACTION_EVIDENCE.md` (every number in this handoff is measured there) |
| Rollback | the baseline commit; the artifact is not consumed, so a revert is total |
| Next authorized wave | **W3 — store and shared plumbing become canonical**. Do not start it from this session. |

---

## 1. What the wave delivered

The canonical demo dataset now exists as **data** under `data/dataset/`:

```
data/dataset/
  manifest.json                  versions, the dataset's key order, per-member file+sha256, counts,
                                 the dataset-wide sha256, the asset-list and schema hashes
  <member>.json                  33 files: 31 collections + organization + branding
  assets/assets.json             one record per media row: where the bytes live, size, sha256
  assets/nocturne-op9-no2.txt    the demo library file's bytes (moved out of TypeScript)
  schema/dataset.schema.json     the generated shape document an importer validates against
```

plus the tooling that owns it (`src/dataset/schema.ts` — contract, imports nothing; `load.ts` — fail-closed
loader; `validate.ts` — artifact validator; `write.ts` — deterministic generator), the generator CLI
(`npm run gen:dataset`), and two W2 suites (31 tests) that keep all of it honest.

**The proof, in one line:** regenerating the artifact from `createSeedDataset()` reproduces the committed
files byte for byte, the reloaded dataset serializes to the same canonical JSON, and both hashes equal
`0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f` — the value measured from the
untouched seed *before* any W2 code existed.

## 2. State of the repository

| Ref | SHA | Note |
| --- | --- | --- |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` | unchanged by W2 |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` | unchanged by W2 |
| `arena/phase2a-landing` | `2df607e…` | unchanged by W2 |
| `docs/demo-migration-plan` | W1 tip `bab9e460…` + the W2 commits | this wave |
| protected WIP checkout (`arena/01a0e8ec-…`, HEAD `eb973eb…`) | untouched — re-verified before and after | recovery source; never write to it |

## 3. Verification summary (measured, both sides of the comparison in one session)

* **Full suite** — baseline 195 files / 2549 pass / **1 fail** / 15 skip (2565) → W2 197 files / **2580 pass**
  / **1 fail** / 15 skip (2596). The +2 files / +31 tests are the W2 suites; there is no new failure.
* **The one failure is I19** (`src/views/__tests__/schedulingWrites.test.tsx:1234`, the Tuesday/`SEED_DATE`
  date dependency). Proven pre-existing: the pristine baseline worktree at `bab9e460` fails the same
  assertion at the same line. **Never** retime it, change `SEED_DATE`, or touch that test.
* **Boundaries** — `m10Boundary` 13 pass, `architectureBoundaries` 24 pass. Nothing was weakened.
* **D9 (bare build)** — baseline **361,037** → W2 **361,026** (−11 B); cap `361144` untouched, headroom 118 B.
  `dist/client` is byte-identical (306,291). `bundleBudget` 8 pass, `cspCompatibility` 17 pass,
  `bundleBoundary` 2 pass.
* **Typecheck** — all three tsconfigs (`typecheck`, `build:demo`, `build:client` each run theirs) pass.
* **No test file was modified** — the diff touches exactly `package.json`, `src/domains/demo/{seed,types,librarySeed}.ts`
  and adds `src/dataset/**`, `data/dataset/**`, `scripts/write-dataset.mjs`, the two suites and two docs.

## 4. Compatibility contract: what W2 preserved (do not break these)

* `DEMO_LIBRARY_TEXT` and `demoLibraryFileBytes()` — same bytes (sha256
  `005e799fcce17f88cfb0e3ffd51b16df1188019afb2730c260c263eda954d473`); three pre-existing suites import them.
* `DEMO_COLLECTIONS` / `DemoCollectionName` — moved to `src/dataset/schema.ts`, **re-exported** from
  `@/domains/demo/types`; all existing import paths still resolve. One enumeration, never two.
* `SEED_VERSION` `2026.09.2`, `SEED_DATE` `2026-09-01`, `SEED_TIMESTAMP` `2026-09-01T00:00:00.000Z` — stated
  verbatim in the manifest; unchanged.
* `VITE_DATA_SOURCE=demo`, `ava:demo:*` keys, the backup envelope, the delivery lock, `demo.manage` — untouched.
* The runtime still calls `createSeedDataset()`. **W2 changed no behaviour.** Consuming the artifact is a
  later wave's decision (W3/W5).

## 5. Things a fresh agent must not "fix"

1. **"30 collections" in the plan.** `DEMO_MIGRATION_WAVES.md` §W2 and the target-architecture doc say 30;
   the code has **31** (`sessionCompensations` was added by the compensation wave). The artifact carries 31
   and the suite pins the 31 names. Do not edit the plan to match the code, and do not "correct" the code.
2. **`gallerySeed.ts` is unchanged** although §W2 lists it. Its assets were *already* referenced (imported
   URLs + metadata), and adding artifact paths would have spent D9 headroom for nothing. The artifact carries
   the linkage instead, and the suite proves it (path is the bundled URL's source file, size matches the
   seed's independently declared `sizeBytes`, sha256 matches the file).
3. **The six photographs are referenced, not copied** into `data/dataset/assets/`. Copying them would put the
   same ~900 KB in the repository twice. If a later wave makes the artifact self-contained or fetchable, that
   is a *decision* (and it must be gated exactly like the demo capability — see §W2's security note).
4. **The `undefined` difference is expected.** The seed states some `undefined`-valued properties
   (`pieceAssignments[*].latest`, …); JSON cannot carry them, so the artifact is the seed *modulo exactly
   that*. The suites assert both halves (they are non-vacuous). Do not "fix" the seed to remove them.
5. **The library bytes now come from the artifact via a Vite raw import.** `assetSourcePath()` refuses a
   hashed production URL on purpose; do not loosen it into a guess.
6. **`src/dataset/*` must stay out of the application graph.** The contract suite asserts no production
   module imports `load`/`validate`/`write` and that no production module imports a dataset JSON. Adding one
   would both fail that gate and put 200 KB of JSON into a bundle while D9 has 118 B of headroom.
7. **Do not raise D9.** The JSON is outside `bundleBudget`'s JS+CSS+HTML file set — an accounting gap that is
   reported in the evidence, not a licence. The one artifact byte source that *is* bundled is counted and
   made the total smaller.

## 6. Commands that matter

```bash
npm run gen:dataset      # regenerate data/dataset/ (validates what it wrote; fails on any issue)
npm test                 # full suite (I19 will be red on a Tuesday — environmental, proven)
npm run typecheck        # src + vite.config.ts
npm run build:demo       # tsc(tsconfig.demo) + APP_TARGET=demo → dist/demo
npm run build:client     # tsc(tsconfig.client) + APP_TARGET=client → dist/client
npm run build            # bare build → dist/  (this is the tree bundleBudget measures)
```

Note on the build layout: the bare `npm run build` writes to `dist/` and empties it, which removes
`dist/client` and `dist/demo`. Run `build:client` + `build:demo` first to give `bundleBoundary` both trees,
and run the bare build last to give `bundleBudget`/`cspCompatibility` their root tree.

`/tmp` does not survive between sessions: nothing in this wave depends on a persisted clone — the artifact is
in the repository, which is the point.

## 7. Open decisions (unchanged by this wave; all owner decisions)

* **D8** (getter/demo-served-domain discrepancy) — required before W5.
* **Build strategy B1/B2/B3** — required before W5; **B1 is in force**. W2's D9 measurement (§10 of the
  evidence) is the input that decision now has: the artifact is NOT in any bundle today.
* **Demo credentials for the sample dataset** — before W7. The artifact carries no credential material.
* **Optional `demo.manage` rename** — still optional, still pending.

## 8. Next wave

**W3 — store and shared plumbing become canonical.** Per the standing checkpoint rule: one wave at a time,
implementation commit + verification/handoff commit, remote SHA verified and recorded, then stop.
