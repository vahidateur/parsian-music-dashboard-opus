# DEMO MIGRATION WAVES — derived plan (proposal)

> Derived 2026-09-29 **from the inventory**, not from the illustrative wave list in the mandate.
> The evidence changed the order: **data extraction comes before repositories** (the dataset must stop
> importing application code first), **composition/build is a single late wave** (it is the only one that
> changes shipped artifacts), and the **naming sweep is second-to-last** (never a blind rename).
> **No wave is authorized. Each states its own authorization requirement.**
>
> Derived sequence: **W1** vocabulary → **W2** dataset extraction → **W3** store/plumbing → **W4** repositories
> → **W5** composition/build → **W6** control flow → **W7** delivery/UI → **W8** tests → **W9** naming →
> **W10** eradication audit. Hard dependencies: W1 before all; W3 before W4; W4 before W5; W8 with W5;
> W10 last. W2 may run in parallel with W3/W4.

---

## W1 — Vocabulary, framing and the decision record (docs only)

| Field | Value |
| --- | --- |
| **Files** | `docs/architecture/data-layer.md` (the "Why the DemoStore stays / implementation #1" paragraph); `docs/architecture/demo-data.md` (retitle to *local dataset & data lifecycle*); `docs/engineering/DECISIONS.md` (a new decision entry recording the target principle, the D8 11-vs-12 question, and the build-strategy decision); `docs/migration/*` (these documents, ratified) |
| **Dependencies** | Owner ratification of `DEMO_TO_DATA_TARGET_ARCHITECTURE.md` |
| **Behaviour before → after** | Unchanged. No runtime artefact is touched |
| **Tests required** | None added; `projectState.test.ts` (checkpoints are real Git objects) must stay green; no gate asserts the wording of these documents (verified: no doc-wording gate exists) |
| **Rollback point** | The parent commit — `git revert` restores every sentence |
| **D8 impact** | None. The enumeration stays byte-identical; the 11-vs-12 question is **recorded**, not decided |
| **D9 impact** | None |
| **Security impact** | None |
| **Backend dependency** | None |
| **Authorization required** | **YES — owner** (governance documents and a new decision entry) |

## W2 — Dataset extraction (data becomes an artifact)

| Field | Value |
| --- | --- |
| **Files** | **New:** `data/dataset/{manifest.json,<collection>.json,assets/,schema/}`; `src/dataset/{schema.ts,validate.ts,load.ts}`. **Changed:** `src/domains/demo/seed.ts` (builder + oracle, no runtime coupling to app types), `src/domains/demo/types.ts` (schema split), `src/domains/demo/{librarySeed,gallerySeed}.ts` (assets referenced, not embedded) |
| **Dependencies** | W1 |
| **Behaviour before → after** | Unchanged (no user-visible difference). The runtime keeps using `createSeedDataset()` until a byte-equivalence test proves the artifact identical; then the artifact becomes the source of truth |
| **Tests required** | **New:** byte-equivalence (artifact ≡ `createSeedDataset()`), schema/version contract, referential integrity across the **30 collections**, determinism (two loads byte-identical). **Kept:** `seed.test.ts`, `dataIntegrity.test.ts` |
| **Rollback point** | The parent commit; the artifact is not yet consumed → revert is total |
| **D8 impact** | None (enumeration untouched) |
| **D9 impact** | **Measure.** A JSON asset is not counted by `bundleBudget`'s file set (JS+CSS+HTML) — that is an *accounting gap*, not a licence: if the dataset is bundled it must be measured, and the gap itself must be reported honestly in the wave's evidence |
| **Security impact** | The dataset contains **demo credentials and demo asset bytes**. They stay capability-gated (deployment lock + lifecycle). If the artifact becomes *fetchable* (lazy load, Wave 5 option B2), it must be gated identically — **no new exposure path** |
| **Backend dependency** | None |
| **Authorization required** | **YES** (new module + new artifact class + tests) |

## W3 — Store and shared plumbing become canonical

| Field | Value |
| --- | --- |
| **Files** | `src/services/demoStore.ts` → `localStore.ts` (+ a canonical `LocalDataStore` interface); `src/domains/shared/demoCollection.ts` → repository plumbing (H-rename); `src/domains/media/demoReferences.ts` (parameter typed by the interface, H); `src/test/demoEnvironment.ts`; `src/domains/demo/index.ts` |
| **Dependencies** | W1; W2 for a stable dataset type |
| **Behaviour before → after** | **Identical.** Storage keys `ava:demo:dataset` / `ava:demo:lifecycle` are **kept** (a key rename is a compatibility decision, not a naming cleanup) |
| **Tests required** | Kept: `demoStoreMigration`, `dataIntegrity`, `prototypePollution`, `mediaReferenceIndex`. Extended: `architectureBoundaries` (store interface, not the class) |
| **Rollback point** | Parent commit; no stored data changes → revert is total |
| **D8 impact** | None |
| **D9 impact** | Measure (a rename should be ≈0 B, but never assume) |
| **Security impact** | None (no boundary moves) |
| **Backend dependency** | None |
| **Authorization required** | **YES** |

## W4 — Repositories become the canonical local implementation (batched per domain)

| Field | Value |
| --- | --- |
| **Files** | **20** `src/domains/<domain>/demoRepository.ts` → `localRepository.ts` (logic preserved verbatim); **~18** accompanying `__tests__/demoRepository.test.ts`; the getters in both compositions |
| **Dependencies** | W3 |
| **Behaviour before → after** | **Identical behaviour**, new meaning: the 12 "demo-in-both-modes" domains become "local-in-both-modes; disclosed as such in api mode" |
| **Tests required** | Renamed per-domain suites; the students scope/IDOR and teacher assigned-only suites **untouched**; a batch is complete only when its suite and the architecture gate are green |
| **Rollback point** | Per batch (few files) — the parent commit |
| **D8 impact** | The enumeration's **meaning** changes (local rather than demo); its **membership question (11 vs 12, organization) is NOT decided here** and must be settled before W5 |
| **D9 impact** | Measure; renames are size-neutral in principle (class names appear in bundles) |
| **Security impact** | None |
| **Backend dependency** | None |
| **Authorization required** | **YES** (batched; each batch reviewed) |

## W5 — One composition, one build (the only wave that changes shipped artifacts)

| Field | Value |
| --- | --- |
| **Files** | `src/domains/registry.ts` + `registry.client.ts` → **one** composition; `registryCore.ts` kept as its shared half; **6 target pairs → 6 files**; `vite.config.ts`; `package.json`; `tsconfig.client.json` + `tsconfig.demo.json`; `src/domains/shared/unavailable*`; `src/__tests__/bundleBoundary.test.ts`; `src/domains/__tests__/registryClient.test.ts` |
| **Dependencies** | W4 complete; the **D8 membership decision**; the **build-strategy decision** (B2 lazy dataset vs B3 eager vs keep B1) |
| **Behaviour before → after** | Before: two artifacts (demo = local everything, client = no local capability). After (target): **one artifact**, one explicit selection, api-mode disclosure preserved, **no silent fallback** (`data-layer.md` §37) |
| **Tests required** | `bundleBoundary` **rewritten** (single-artifact invariant, no hidden fallback, disclosure list = composition list, vacuous-pass guard); `registryClient` rewritten; `cspCompatibility` re-run against the new artifact; `bundleBudget` measured; `DemoBackedNotice` suite updated |
| **Rollback point** | Parent commit (build profiles and composition are restored by `git revert`); **irreversible-by-revert** if the artifact layout changes deployment configs → ship the old artifact until deployment adopts the new one |
| **D8 impact** | **Unification**: the two enumerations become one. The 11-vs-12 discrepancy **must** be decided first, or the unified list inherits it |
| **D9 impact** | **Highest of all waves.** 107 B headroom: B2 (lazy dataset) is the D9-friendly option; B3 (eager) implies an owner re-baseline; the cap constant is **never** to be raised unilaterally |
| **Security impact** | The production-served artifact would now *contain* the local implementation. That is acceptable **only** with the deployment lock + capability gates intact and no silent selection — the same client-side guarantees as today, with the same explicit statement that they are UX-level and the server remains the real boundary |
| **Backend dependency** | None to execute; the unavailable list shrinks only as the backend lands |
| **Authorization required** | **YES — owner** (build strategy + D9) **and** implementation authorization |

## W6 — Control flow and lifecycle vocabulary

| Field | Value |
| --- | --- |
| **Files** | `src/api/config.ts` (`demo|api` → `local|api`, with aliases), `src/domains/demo/lifecycle.ts`, `useDataLifecycle.ts`, `useDemoData.ts`, `DataLifecycleGate.tsx`, `src/views/Login.tsx`, `FirstRunChooser.tsx` |
| **Dependencies** | W1; W3 |
| **Behaviour before → after** | Unchanged in substance; **the environment value `VITE_DATA_SOURCE=demo` must keep working** (alias) or the change is a deployment break — this is the wave's main risk |
| **Tests required** | `config` tests (aliases + config-error retention), Login/demo-hint tests, the 447-line lifecycle suite |
| **Rollback point** | Parent commit (aliases make reversion safe) |
| **D8 impact** | None |
| **D9 impact** | Measure (negligible expected) |
| **Security impact** | None; the "refuse to start on an invalid data source" behaviour is preserved verbatim |
| **Backend dependency** | None |
| **Authorization required** | **YES** (deployment-facing vocabulary) |

## W7 — Delivery machinery and operator UI

| Field | Value |
| --- | --- |
| **Files** | `src/api/deploymentLock.ts`, `src/domains/demo/delivery.ts`, `src/components/settings/{ProductionDeliveryGate,DemoDataPanel}.tsx`, `src/components/lifecycle/{LifecycleRecoveryPanel,LifecycleRecoveryContext}`, `src/components/shell/DemoBackedNotice.tsx` (re-sourced from the unified list) |
| **Dependencies** | W3; W5 (for the unified enumeration) |
| **Behaviour before → after** | **Wording and sourcing only.** The delivery state machine, fail-closed reads, idempotent ownership-scoped removal and the non-dismissable disclosure semantics are unchanged |
| **Tests required** | `delivery` (252 L), `deploymentLock`, `DemoBackedNotice` (+ stale-enumeration tripwire), `DemoDataPanel`, `DataLifecycleGate` |
| **Rollback point** | Parent commit |
| **D8 impact** | The notice consumes the unified list (this is where D8 ends up honest) |
| **D9 impact** | Measure |
| **Security impact** | Safety copy must stay explicit; nothing in this wave may weaken the lock |
| **Backend dependency** | None |
| **Authorization required** | **YES** |

## W8 — Tests, gates and the new invariants

| Field | Value |
| --- | --- |
| **Files** | `src/__tests__/{bundleBoundary,architectureBoundaries,bundleBudget,m10Boundary}.test.ts`; `src/domains/__tests__/registryClient.test.ts`; the five `*NoFixtures` gates (kept) |
| **Dependencies** | W5 (and W3 for the interface) |
| **Behaviour before → after** | No product behaviour changes; the **gates now enforce the target** (single composition; no `Demo*` architecture outside data; dataset schema; explicit selection only) |
| **Tests required** | New: dataset-schema gate, naming gate (with the Class-H exemption list), explicit-selection gate. Every rewritten gate must be **strictly stronger**, proven by a mutation check (break it, watch it fail, restore) |
| **Rollback point** | Parent commit |
| **D8 impact** | None |
| **D9 impact** | `bundleBudget` re-measured |
| **Security impact** | Gates may not be loosened to make the migration pass — this is the wave's overriding rule |
| **Backend dependency** | None |
| **Authorization required** | **YES** |

## W9 — Residual naming sweep (second-to-last, never blind)

| Field | Value |
| --- | --- |
| **Files** | ~230 incidental mentions (comments, test titles, docs, UI copy); the two Class-H renames (`demoReferences` → `mediaReferences`, `demoCollection` → repository plumbing) |
| **Dependencies** | W4, W5, W7 |
| **Behaviour before → after** | None |
| **Tests required** | The W8 naming gate + the full suite (195 files) |
| **Rollback point** | Per batch |
| **D8/D9/Security impact** | None / measure / none |
| **Backend dependency** | None |
| **Authorization required** | **YES** |

## W10 — Eradication audit (read-only, last)

| Field | Value |
| --- | --- |
| **Files** | None modified; a report + evidence. |
| **Dependencies** | W1–W9 |
| **Behaviour** | None |
| **What it must prove** | no unnecessary `Demo*` architecture remains; demo is data/import only; the local implementation is canonical and explicitly selected; no demo-only control flow remains where it is not needed; the new boundary is tested; the build reflects one application; the security posture is intact (lock + gates); D8/D9 governed; backend dependencies explicit. **If any clause fails, the migration is not complete and must not be reported as such** |
| **Rollback point** | n/a (read-only) |
| **Authorization required** | **YES** (audit authorization) |

---

## Wave summary

| Wave | Scope | Changes shipped artifacts? | Authorization | Order |
| --- | --- | --- | --- | --- |
| W1 | Vocabulary + decision record (docs) | No | Owner | first |
| W2 | Dataset extraction (+ validator, + assets) | Not yet consumed | Owner + implementation | parallel with W3/W4 |
| W3 | Store/plumbing canonical (interface, keys kept) | Negligibly | Owner + implementation | after W1 |
| W4 | 20 repositories renamed to canonical local (batched) | Negligibly | Owner + implementation | after W3 |
| W5 | One composition + one build (**D8 + D9 decisions**) | **Yes** | **Owner (build + D9)** | after W4 |
| W6 | Control flow + lifecycle vocabulary (aliases kept) | Config only | Owner | after W3 |
| W7 | Delivery machinery + operator UI | Wording only | Owner | after W5 |
| W8 | Gates rewritten stronger | No | Owner | with W5 |
| W9 | Residual naming sweep | No | Owner | after W7 |
| W10 | Eradication audit (read-only) | No | Owner | last |
