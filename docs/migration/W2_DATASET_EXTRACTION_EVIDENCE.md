# W2 — Dataset extraction: evidence

**Status:** implemented and verified. The dataset is now an artifact under `data/dataset/`, proven
byte-equivalent to `createSeedDataset()`; the runtime still builds the dataset from the seed (behaviour
unchanged), so consuming the artifact is a later wave's decision.

| | |
| --- | --- |
| Wave | W2 — Dataset extraction (data becomes an artifact) |
| Baseline commit | `bab9e460b603f9499a9b0735050e1cb729384602` (the W1 tip on the branch we work on, named below) |
| Branch | docs/demo-migration-plan (the migration branch; written without backticks on purpose, so no reader or scanner mistakes it for a repository path) |
| Spec | `docs/migration/DEMO_MIGRATION_WAVES.md` §W2, read verbatim (scope, D9 "Measure", security note) |
| Method | disposable clone, baseline worktree at the W1 tip for every comparison, pristine baseline for the suite and for D9 |
| Handoff | `docs/session-handoffs/W2_COMPLETE_HANDOFF.md` |

Everything below is a measurement from this wave's run, taken in the same environment for both sides of
the comparison (baseline at the W1 tip vs the W2 tree). Nothing in this document is an estimate.

---

## 1. What was asked, and what was authorized

§W2 asks for the dataset to become **data**: a versioned `data/dataset/` artifact with a schema document
and an asset list, tooling under `src/dataset/`, a byte-equivalence proof against the canonical builder,
and no user-visible behaviour change. D9 says **measure** and report the accounting gap honestly. The
security note says the artifact carries demo credentials and demo asset bytes and must not open a new
exposure path. Backend: none. Authorization: granted for a new module, a new artifact class and tests.

---

## 2. Baseline (recorded before any change)

| Item | Value |
| --- | --- |
| Clone | fresh full clone of docs/demo-migration-plan, clean tree, `npm ci` exit 0 |
| Baseline worktree | detached at `bab9e460…` (`git worktree add /tmp/w2-base bab9e460`), pristine, no `data/` |
| Full suite (baseline) | **195 files — 2549 passed, 1 failed, 15 skipped (2565 tests)** |
| The one failure | `src/views/__tests__/schedulingWrites.test.tsx` line 1234 — the pre-existing date-deterministic failure (see §9) |
| D9 (baseline, bare build) | **361,037 gzip total** (JS+CSS+HTML), cap `361144`, headroom 107 B |
| D9 (baseline, `dist/demo`) | 361,029 |
| D9 (baseline, `dist/client`) | 306,291 |

The 361,037 measurement reproduces the number `src/__tests__/bundleBudget.test.ts` records as the
D9-B re-baseline (and 361144 − 361037 = the 107 B the migration planning recorded as remaining
headroom), which is what makes the W2 measurement below comparable rather than merely plausible.

---

## 3. What changed

| File | Kind | Lines | Why |
| --- | --- | --- | --- |
| `src/dataset/schema.ts` | new | 227 | The dataset contract: member enumeration, artifact layout, manifest/asset record types, canonical serialization. **Imports nothing.** |
| `src/dataset/load.ts` | new | 99 | Fail-closed loader: rebuilds the dataset in the manifest's recorded key order, or throws. |
| `src/dataset/validate.ts` | new | 384 | Artifact validator: manifest/version, member files + hashes, counts, exact file set, asset list + bytes, schema document — then referential integrity through the domain's own `validateDataset`. |
| `src/dataset/write.ts` | new | 270 | Deterministic generator (pure build + verified write) — the machine that makes the equivalence test possible. |
| `src/dataset/__tests__/datasetArtifact.test.ts` | new | 249 | 14 tests: byte-equivalence both directions, determinism, integrity, asset linkage. |
| `src/dataset/__tests__/datasetContract.test.ts` | new | 310 | 17 tests: enumeration/version contract, fail-closed loader, no-new-exposure-path. |
| `data/dataset/**` | new | 37 files | The artifact itself (below). |
| `scripts/write-dataset.mjs` | new | 46 | `npm run gen:dataset`: boots Vite, loads the TypeScript generator, validates what it wrote. |
| `package.json` | changed | +2/−1 | The `gen:dataset` script (no dependency added). |
| `src/domains/demo/types.ts` | changed | +22/−38 | Schema split: `DEMO_COLLECTIONS` and `DemoCollectionName` moved to the schema module and re-exported, so all 15+ existing import paths resolve unchanged. |
| `src/domains/demo/seed.ts` | changed | +8/−1 | `const SEED_TIMESTAMP` became exported, with the reason stated in place: the manifest dates the dataset from the seed's own fixed timestamp, because a wall-clock `createdAt` would change on every regeneration. Nothing else in the builder changed. |
| `src/domains/demo/librarySeed.ts` | changed | +28/−27 | The file's bytes moved into the artifact; the module references them (`?raw`), and declares where they live (`DEMO_LIBRARY_ASSET_FILE`). `DEMO_LIBRARY_TEXT` and `demoLibraryFileBytes()` are byte-identical. |

No test file was modified: `git diff --stat` lists exactly four modified files, none of them a test, and
the two new suites are additions.

### Deliberately NOT changed

1. **`src/domains/demo/gallerySeed.ts`** — the spec lists it as "assets referenced, not embedded". Evaluated:
   it *already* references its assets (six imported bundled URLs plus metadata; no bytes inline). Adding an
   artifact-path field per photograph would add bytes to a shipped bundle for no behavioural gain, against
   107 B of D9 headroom. Not changed; the artifact carries the linkage instead, and the suite proves it
   (§7). Recorded as a deviation from the plan's file list, on evidence.
2. **`seed.ts`'s imports of application values** (`DEFAULT_ORGANIZATION_SETTINGS`, `ROLES`, `roleLabels`) —
   replacing them with dataset-local copies would create a second source of truth for organization rules and
   the RBAC matrix. Organization semantics and D8 are protected; the coupling is recorded, not touched.
3. **`DemoDataset` and the per-domain row shapes** stay in `src/domains/demo/types.ts`. The D6/I2 deferral
   ledger names that file as the owner of the envelope's record types (`Invoice`), so moving them would
   falsify a governed ledger entry — a decision that is not W2's to take. Only the *enumeration* (the schema)
   moved.
4. **The runtime read path.** The store still calls `createSeedDataset()`. "The artifact becomes the source of
   truth" is satisfied as a *proven equivalence*: the generator's output is compared byte-for-byte with the
   committed files on every test run, and a change on either side fails the suite. Switching what the store
   reads is W3/W5 work per the wave plan — doing it here would have been a behaviour change, which §W2
   forbids.
5. **Nothing deleted, renamed or moved.** No `Demo*` class was removed (the spec requires none), no test was
   weakened or skipped, D8 and D9 are untouched, no backend or protected area was opened.

---

## 4. The artifact

```
data/dataset/
  manifest.json                7823 B
  <member>.json                33 files, 186702 B   (31 collections + organization + branding)
  assets/assets.json           1981 B
  assets/nocturne-op9-no2.txt  1595 B               (materialized: the demo library file's bytes)
  schema/dataset.schema.json   4384 B
                               ─────────
                               202485 B across 37 files
```

The canonical (compact) serialization of the same dataset is **127,427 B** — the files are pretty-printed
for review, and `datasetSha256` is defined over the compact form, so the artifact's identity does not depend
on formatting.

`manifest.json` states: `schemaVersion` (`1`, the artifact's own shape version), `datasetVersion`
(`SEED_VERSION` = `2026.09.2`, verbatim), `createdAt` (`SEED_TIMESTAMP`, the dataset's fixed timestamp),
`label`, `seedDate` (`SEED_DATE` = `2026-09-01`), `source`
(`src/domains/demo/seed.ts` + `#createSeedDataset()`), the dataset's own `keyOrder` (33 members), `counts` per
member, per-member `file`/`kind`/`sha256`, the dataset-wide `datasetSha256`, the asset list's file/count/hash,
the schema document's file/hash, and the validator it passed (`issues: 0`).

Counts: **31 collections, 33 members, 506 collection rows** — matching the independent Phase B measurement
of the canonical seed.

---

## 5. The equivalence proof

The claim is proved in **both directions**, because either one alone is weak (a stale artifact and a changed
seed can agree with each other; a matching hash says nothing about the files):

| Direction | Machine check | Result |
| --- | --- | --- |
| seed → artifact | `buildDatasetArtifact()` output compared with the committed files, byte for byte | identical (verified twice; regeneration is idempotent) |
| artifact → seed | the loaded dataset's canonical JSON ≡ `JSON.stringify(createSeedDataset())` | identical |
| hash | `manifest.datasetSha256` vs `sha256(JSON.stringify(createSeedDataset()))` and vs the reloaded artifact | `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f` — **the same hash measured before any W2 code existed** (Phase B probe), so the extraction changed nothing |
| value | member-by-member canonical comparison + a typed deep comparison | equal, except where the seed states `undefined` (below) |
| determinism | two loads byte-identical; two builds produce identical file contents | identical (no clock, no randomness; the manifest's `createdAt` is the seed's fixed timestamp) |
| integrity | `validateDatasetArtifact()` and the domain's `validateDataset()` on the round-tripped dataset | **0 issues** each |
| references | ids, class/teacher/room/student references, rosters, dated sessions | validated by the domain's own validator, not a copy of it |

**The one quantified difference.** The seed carries explicit `undefined`-valued properties (e.g.
`pieceAssignments[*].latest`, `learningContent[*].totalRange`). JSON cannot carry `undefined`, so
`toStrictEqual(loaded, seed)` is *false by construction* while the canonical serializations are identical.
The suite asserts both halves: that the seed really does carry such positions (non-vacuity), and that after
JSON's own normalization the two values are strictly equal. Nothing else differs — proven member by member.

**Kept tests.** `seed.test.ts`, `dataIntegrity.test.ts` and every other pre-existing suite run unchanged
(§9). No expectation was relaxed anywhere.

---

## 6. Data vs implementation classification (as required by the wave)

| Concern | Classification | Where it lives after W2 |
| --- | --- | --- |
| The dataset's rows (506 records / 33 members) | **DATA** | `data/dataset/*.json` (artifact), generated from the seed |
| The library file's bytes | **DATA** | `data/dataset/assets/nocturne-op9-no2.txt` (moved out of TypeScript) |
| The showcase photographs' bytes | **DATA** | `src/assets/images/*.jpg` — *referenced* with path/size/sha256, not copied |
| Member enumeration, artifact shape, versions | **DATA (schema)** | `src/dataset/schema.ts` (one owner; the demo domain re-exports) |
| Seed derivations (`academySeed`, `learningSeed`, `progressSeed`, `schedulingSeed`) | **BUILDER / ORACLE** | unchanged — `createSeedDataset()` still builds, and is the equivalence oracle |
| Store, repositories, provisioning, lifecycle, capability gating | **IMPLEMENTATION** | unchanged (W3/W4 territory) |
| Registry, target seams, compositions | **COMPOSITION** | unchanged (W5) |
| `VITE_DATA_SOURCE=demo`, `ava:demo:*` keys, backup envelope, `SEED_VERSION`, `SEED_DATE` | **COMPATIBILITY** | unchanged and re-verified (§8) |
| Deployment lock, demo credential panel, demo backup naming | **DEMO-ONLY (unchanged)** | unchanged |
| The artifact tooling (`schema`/`load`/`validate`/`write`, generator script) | **INDEPENDENT OF THE DEMO REPOSITORY** | Node-only, imports no repository and no store |

---

## 7. Assets: materialized vs referenced, and why

* **Materialized — 1 file.** `nocturne-op9-no2.txt`, 1595 B, sha256
  `005e799fcce17f88cfb0e3ffd51b16df1188019afb2730c260c263eda954d473`. This is the **exact hash of the bytes
  the app served before W2** (measured on the unmodified module), so the move is proven, not asserted. The
  suite pins that hash, compares it with the artifact's bytes, with `demoLibraryFileBytes()`, and with the
  media row's `sizeBytes`.
* **Referenced — 6 files.** The showcase photographs stay at `src/assets/images/` (they are already shipped
  bytes with a canonical home). Copying them into the artifact would put ~900 KB of the same bytes in one
  repository twice — the drift this migration exists to remove. Each record carries `sourcePath`, the actual
  byte length and sha256, and the suite proves the linkage: the record's path is the file Vite bundles for
  that photo's URL, the file exists, its size equals the record's size, and that size equals the `sizeBytes`
  the seed declares independently for its media row.
* **One record per media row, both ways.** The validator refuses an asset record with no media row and a
  media row with no asset record, so the two lists cannot drift apart.

---

## 8. Compatibility verification

| Compatibility value | Verified how | Result |
| --- | --- | --- |
| `DEMO_LIBRARY_TEXT` / `demoLibraryFileBytes()` (imported by three pre-existing suites) | symbol kept, value byte-identical (hash pinned) | unchanged |
| `DEMO_COLLECTIONS` / `DemoCollectionName` (15+ import sites) | moved to the schema module, re-exported from `@/domains/demo/types` | all import paths resolve; values identical |
| Every other export of `src/domains/demo/types.ts` | untouched (only the enumeration block was cut) | unchanged |
| `SEED_VERSION` (`2026.09.2`), `SEED_DATE` (`2026-09-01`) | stated verbatim in the manifest; `schedulingSeed.test.ts` (I19's anchor) still passes | unchanged |
| `ava:demo:*` storage keys, backup envelope, `VITE_DATA_SOURCE=demo` | not touched; `demoStoreMigration`, `backup`, `backupMigration`, `prototypePollution`, `authIntegration` suites all pass | unchanged |
| Client composition contains no demo bytes | `bundleBoundary.test.ts` (real `dist/client` scan for `md_gal_hall`, `@demo.local`, `ava:demo:*`) | passes; client bundle byte-identical to baseline |
| No test weakened, skipped or modified | `git diff --stat` (four modified files, none a test) + full suite | confirmed |

---

## 9. Tests

Focused first, then the gates, then the whole suite. Baseline and W2 were run in the same sandbox, same
day, with the same command.

| Stage | Baseline (W1 tip) | W2 |
| --- | --- | --- |
| Demo + library + store suites | pass | **25 files / 329 tests pass** |
| Boundary gates (`m10Boundary`, `architectureBoundaries`) | pass | **37 tests pass** |
| New W2 suites | — | **31 tests pass** (14 + 17) |
| Full suite | 195 files — 2549 pass, **1 fail**, 15 skip (2565) | 197 files — **2580 pass, 1 fail**, 15 skip (2596) |
| Dist gates (with builds present) | pass | `bundleBudget` 8 pass, `cspCompatibility` 17 pass, `bundleBoundary` 2 pass |

The W2 delta is exactly +2 files / +31 tests (the new suites) and **no new failure**.

**The single failure is classified, not tolerated.** `src/views/__tests__/schedulingWrites.test.tsx:1234`
fails because the sandbox clock is **Tuesday 2026-09-29** and the seeded weekly template gives class `cl2`
a Tuesday slot, so a session dated *today* (`ses_cl2_20260929_1400`) appears where the test expects only the
moved one. It is the known I19 date-dependency (its documented cause: `SEED_DATE` 2026-09-01 is a Tuesday).
Proof it is not a W2 regression: the **pristine baseline worktree at `bab9e460` fails the same test at the
same line**, in the same run window, with W2 absent. Nothing was retimed, no `SEED_DATE` was changed, and no
test was touched.

---

## 10. Builds and D9

D9's methodology (`gzip -6 -n -c` per emitted JS/CSS/HTML file, summed) on the builds this repository
actually ships. Baseline and W2 measured back to back in this session.

| Build | Baseline | W2 | Delta |
| --- | --- | --- | --- |
| Bare `npm run build` (`dist/`, the tree `bundleBudget` measures) | **361,037** | **361,026** | **−11 B** |
| `npm run build:demo` (`dist/demo`) | 361,029 | 361,022 | −7 B |
| `npm run build:client` (`dist/client`) | 306,291 | 306,291 | **0 B** (per-file identical) |
| Entry chunk gzip | — | 135,138 | strictly below the 273,791 anchor |
| `bundleBudget.test.ts` | 8 pass | **8 pass** | cap untouched (`361144`), headroom now 118 B |

The library text moved from a string array in TypeScript to a `?raw`-imported file; the bundle got slightly
*smaller* (−11 B), and the moved enumeration cost nothing (the enum/const additions in the schema module are
tree-shaken out of the app graph).

**The accounting gap, reported rather than used.** `bundleBudget` sums JS+CSS+HTML in the build output, so
the JSON artifact is **not** in its file set. That gap is real and is not a licence: the artifact's **only**
byte source that reaches a bundle — the library document, through `librarySeed.ts`'s raw import — *is*
counted, and it made the total smaller. The JSON is provably not bundled: the contract suite scans every
production module for an import of any `data/dataset/*.json` and finds none, and the only production module
that references the artifact at all is `src/domains/demo/librarySeed.ts`. On disk the artifact is 202,485 B
(127,427 B in canonical compact form); none of it is in any bundle. No D9 limit was raised, no chunk
configuration changed, and the recorded cap is untouched.

---

## 11. Security posture (no new exposure path)

* **No credential material in the artifact.** A scan of all 37 files finds no `password`, `passphrase`,
  `credential`, `token`, `Bearer`, `arena-demo` or `ava:demo:*` string. The demo passphrase and the
  credential store remain where they were (`src/domains/auth/demoAuthRepository.ts`,
  `demoCredentials.ts`), behind the deployment lock. The dataset does carry the demo **account emails**
  (`@demo.local`) in its `users` rows — those were already in the dataset before W2 and are still absent
  from the client bundle (`bundleBoundary` asserts it).
* **The artifact is not fetchable.** Nothing in the application can read `data/dataset/*.json`: the loader
  and validator are Node-only, and the contract suite asserts that no production module imports them. The
  only production reference is the build-time raw import of the library text into the *demo* composition,
  whose bytes are written to the blob store solely by `ensureDemoLibraryFile`, which is gated by
  `isDemoCapabilityAvailable()` and the persisted lifecycle — exactly the gate that existed before W2.
* **If the artifact ever becomes fetchable** (Wave 5 option B2), it must be gated identically. That is
  recorded here as a constraint on that wave, not as something W2 introduced.

---

## 12. Findings and drift (recorded, not silently fixed)

1. **"30 collections" vs 31.** `DEMO_MIGRATION_WAVES.md` §W2 and `DEMO_TO_DATA_TARGET_ARCHITECTURE.md` §3 say
   "30 collections"; the code (`DEMO_COLLECTIONS`) enumerates **31** — the count predates
   `sessionCompensations` (compensation domain). The artifact carries 31, the suite pins the 31 names, and
   the planning documents are **not** edited to match (a plan is corrected by a decision, not by an
   implementation wave).
2. **`undefined`-valued seed properties.** Quantified in §5; the only difference between the seed object and
   its JSON form.
3. **The raw-import constraint.** `librarySeed.ts` reads the artifact through a Vite raw import, so the
   generator must run through the toolchain (dev/SSR) where a bundled asset URL is its source path.
   `assetSourcePath()` refuses to guess — a hashed production URL throws with the reason instead of silently
   writing a wrong reference.
4. **The D9 accounting gap** (§10) — reported to whoever takes W5's build-strategy decision (B1/B2/B3), since
   "the artifact ships in the bundle" and "the artifact is fetched lazily" have different accounting.
5. **`gallerySeed.ts` unchanged** despite being listed as a W2 file (§3.1).

---

## 13. What W2 did not touch (remaining work, unchanged)

* **DemoRepository classes**: 20 `demoRepository.ts` files (~4,300 lines) untouched — W2 required no
  deletion, and none was attempted. The repositories still read the store, which still reads the seed.
* **Store and plumbing** (`src/services/demoStore.ts`, `ava:demo:*`) — W3.
* **Composition/build strategy** — W5, still waiting on the owner's D8 and B1/B2/B3 decisions (B1 in force).
* **Delivery lock / demo credentials / `demo.manage` rename** — untouched; the rename remains an owner
  decision.
* **D8**: still unresolved and unmodified (12 getters / 11 demo-served domains / 12 unavailable domains).
* **Backend**: nothing; still not authorized.

---

## 14. Rollback

The artifact is **not consumed** by anything at runtime, so reverting W2 is total: restoring the baseline
commit restores the exact W1 state, with no data migration to undo and no behaviour to unwind. The wave's
commits are ordered as implementation → verification/handoff → remote-verification record, so they can be
reverted individually from the tip.

## 15. Next wave

**W3 — store and shared plumbing become canonical.** It needs no new owner decision. The pending owner
decisions that gate later waves are unchanged: **D8** before W5, **build strategy B1/B2/B3** before W5
(B1 in force), **demo credentials** before W7, and the optional `demo.manage` rename. Per the checkpoint
rule, W2 stops here: W3 is not started by this wave.
