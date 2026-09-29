# DEMO INVENTORY — complete repository-wide discovery

> Read-only inventory, 2026-09-29, against `main` @ `15775ea9486cb57fbfb8fefa3268658cbe7eb669`
> (disposable clone, full history). **No file was modified, renamed, or deleted.**
> Companion: `docs/migration/DEMO_MIGRATION_MATRIX.md` (the per-file table with the ten required fields).
> Classification vocabulary: **A** DEMO DATA · **B** DEMO ARCHITECTURE · **C** DEMO UI ·
> **D** DEMO CONTROL FLOW · **E** BUILD / DELIVERY / COMPOSITION · **F** TEST / QA ·
> **G** GOVERNANCE / DOCUMENTATION · **H** LEGITIMATE EXCEPTION.

## 1. Method

1. **Token sweep** over `src/**` for every variant the mandate names —
   `Demo`, `demo`, `DEMO_`, `دمو`, `isDemo`, `demoMode`, `ava:demo`, `@demo.local`, `arena-demo`,
   `DemoRepository`, `DemoService`, `DemoProvider`, `DemoData`, `demoCollection`, `demo fixture`,
   `demo seed`, `demo import` — plus `seed`, `fixture`, `__APP_TARGET__`, `unavailable`, `localStorage`.
   Result: **351 files** carry at least one signal; token totals: `demo` 1,189 occurrences / 244 files,
   `Demo*Repository` 528 / 103, `seed` 343 / 121, `fixture` 321 / 88, `DEMO_*` 386 / 67, `isDemo` 64 / 18,
   `دمو` 96 / 40, `ava:demo` 11 / 6, `@demo.local` 55 / 22, `arena-demo` 7 / 5.
   `demoMode`, `DemoService`, `DemoProvider` do **not** occur anywhere (the code uses
   `isDemoMode()` and `class Demo*Repository` instead).
2. **Structural sweeps**: path names, `class Demo*` declarations, registry getters, imports/exports,
   composition aliases, build profiles, storage keys, test gates, documentation.
3. **Dependents graph**: every importer of `services/demoStore`, the seeds, `demoCollection`, and the
   `DemoStore` *type* (the type is part of the boundary — see §4).
4. **Classification**: each significant finding got exactly one class (A–H). Incidental mentions —
   files that only carry the word "demo" in a comment or an unrelated test title — are grouped and counted
   in §9 rather than itemised, because they are not demo architecture.

**Scale of the finding:** `src` holds 512 files; **23** `class Demo*` declarations (**20** repositories +
`DemoStoreImpl` + `DemoDataManager` + `DemoDisabledError`); `src/domains/demo/` holds **29 files / 6,324
lines** (15 non-test + 14 test); **12** of the 20 registry getters resolve Demo in **both** modes;
**11** are enumerated in `DEMO_SERVED_DOMAINS`; **12** in the mirror `UNAVAILABLE_DOMAINS`;
**6** swappable target pairs (12 files); **2** build profiles; **11** `apiRepository.ts` contracts of which
**8** are actually selected in api mode; **195** test files, of which **161** mention demo and **40** are
demo/seed/fixture-named.

## 2. Class A — DEMO DATA (13 files, ~2,450 lines)

The importable/seedable dataset and the bytes it needs. **This is the material the objective keeps.**

| Path | What it is |
| --- | --- |
| `src/domains/demo/academySeed.ts` (454 L) | Hand-authored Persian academy data: rooms, teachers, students, classes, weekly template, today's attendance, invoices, payments, conversations, resources |
| `src/domains/demo/seed.ts` (273 L) | `SEED_VERSION` (`2026.09.1`), `createSeedDataset()` — **pure and deterministic**; derives enrollments (`withDerivedEnrollments()`) and users |
| `src/domains/demo/learningSeed.ts` (324 L) | programs / levels / learning content / placements |
| `src/domains/demo/librarySeed.ts` (92 L) | demo library resource metadata + its text asset + `withDemoLibraryFile()` |
| `src/domains/demo/gallerySeed.ts` (148 L) | demo gallery photos + `DEMO_GALLERY_MEDIA` |
| `src/domains/demo/progressSeed.ts` (276 L) | pieces, assignments, progress events (derivations) |
| `src/domains/demo/schedulingSeed.ts` (145 L) | `SEED_DATE = "2026-09-01"`, `SEED_WINDOW_DAYS`, `SEEDED_CONFLICT`, session generation |
| `src/domains/demo/types.ts` (305 L) | `DemoDataset` shape: **30 collections** (students, teachers, rooms, classes, enrollments, sessions, attendance, invoices, payments, conversations, resources, users, roles, media, instruments, programs, levels, learningContent, levelContent, placements, chat*, gallery*, pieces, pieceAssignments, progressEvents, organization, branding, …) + `DEMO_COLLECTIONS` |
| `src/domains/auth/demoCredentials.ts` | demo sign-in material (dataset-level, capability-gated) |
| `src/domains/library/demoContent.ts` | writes the demo library file's **bytes** into the blob store (DEMO-only, idempotent, never throws) |
| `src/domains/gallery/demoContent.ts` | writes the demo gallery images' bytes (same pattern) |
| `src/domains/media/demoReferences.ts` | **canonical** media-ownership predicate (`mediaStillReferenced`) that *imports the `DemoStore` type* — see §4/Class H |

**Code vs data:** all of the above are **data** (literals, derivations, dataset shape), except
`demoReferences.ts` (logic, H).

## 3. Class B — DEMO ARCHITECTURE (27 files)

The second implementation of every domain, plus its persistence and lifecycle.

| Path | Lines | Role |
| --- | --- | --- |
| `src/services/demoStore.ts` | 771 | **The only writer** of local demo persistence: keys `ava:demo:dataset`, `ava:demo:lifecycle`; `migrateDataset()`, snapshot/replace, provenance stamping, `isInitialized()` |
| `src/domains/demo/demoDataManager.ts` | 348 | Orchestrates lifecycle ops (initialize/reset/clear/import/restore/export) — owns no persistence |
| `src/domains/demo/backup.ts` | 676 | Versioned backup envelope (1.0 → 1.1), validation, migration, integrity hash |
| `src/domains/demo/lifecycle.ts` | 340 | **The one boundary** that decides what kind of environment this is (`uninitialized` / `empty` / `demo`); bootstrap admin for EMPTY; legacy adoption |
| `src/domains/demo/delivery.ts` | 329 | Ownership-scoped, idempotent **Remove-Demo / Deliver-Production** removal — *classified **E** in the matrix (production-delivery machinery, kept), not demo application code* |
| `src/domains/demo/index.ts` | 53 | Barrel |
| `src/domains/shared/demoCollection.ts` | ~60 | Shared demo-repository plumbing: `paginate` (no upper clamp), not-found/conflict/validation/auth errors. **Canonical repository plumbing misnamed** (H-adjacent) |
| `src/domains/{attendance,auth×3,branding,chat,classes,compensation,enrollments,gallery,instruments,learning,library,media,organization,progress,rooms,scheduling,students,teachers}/demoRepository.ts` | 49–866 (Σ ≈ 4,300) | **20 repositories**, each implementing its domain contract against `demoStore` |

**Are they "just data adapters"?** No. They carry real domain rules: scheduling (573 L) owns conflict
detection and the attendance-protection boundary; compensation (866 L) owns the composition with
scheduling + attendance; attendance (317 L) owns the roster/append-only logic; learning (381 L) owns
eligibility wiring; progress (427 L) owns derivations. **This is a second implementation of the product's
business layer, not a fixture reader** — which is exactly why the migration must *rename and keep* them as
the canonical **local** implementation rather than delete them, and must move the *demo-specific* bits
(seeded bytes, seed-only affordances) into data.

## 4. The dependency that matters most

`src/domains/media/demoReferences.ts` — canonical ownership logic — **types its first parameter as
`DemoStore`** and is consumed by `gallery/demoRepository.ts`, `library/demoRepository.ts`,
`media/release.ts`, `media/ProfilePhotoField.tsx`, `students/demoRepository.ts`, `teachers/demoRepository.ts`.
`src/domains/shared/clock.ts` is already canonical (wall clock in every mode; reproducibility lives in the
seed). Any "one canonical codebase" step must first give the store a **canonical interface type** so
canonical code stops naming the demo store.

## 5. Class C — DEMO UI (16 files / 8 pairs)

| Path | Role |
| --- | --- |
| `src/components/settings/DemoDataPanel.tsx` | Settings panel: lifecycle kind, reset/clear/import/backup/restore/export, permission-gated by `demo.manage` |
| `src/components/settings/ProductionDeliveryGate.tsx` | Settings surface for Remove Demo / Deliver Production (Phase 2A); UI half of the safety story |
| `src/components/shell/DemoBackedNotice.tsx` | Persistent, non-dismissable api-mode disclosure driven by `DEMO_SERVED_DOMAINS` |
| `src/components/lifecycle/DataLifecycleGate.tsx` | Gate above `AuthProvider`; transparent in api mode |
| `src/components/lifecycle/FirstRunChooser.tsx` | The two first-run options (empty / demo dataset); honours the deployment lock |
| `src/components/lifecycle/LifecycleRecoveryPanel.tsx` + `LifecycleRecoveryContext.ts` | Recovery waypoint UI for interrupted delivery/cleanup |
| `src/targets/environment.tsx` / `.client.tsx` | `DemoNote` (prototype labelling) + `useIsDemoEnvironment`; the client variant renders **nothing** |
| `src/targets/targetFeatures.tsx` / `.client.tsx` | LoginAssist / SettingsFeatures / demo panel + disclosure composition (demo vs client) |
| `src/targets/libraryProvisioning.ts` / `.client.ts` | `useDemoLibraryFile()` — demo bytes; client = no-op |
| `src/targets/galleryProvisioning.ts` / `.client.ts` | `useDemoGalleryBytes()`; client = no-op |
| `src/targets/targetCopy.ts` / `.client.ts` | `financeDeferredNote`, `dataSourceNotice(names)` — copy differs per target |
| `src/targets/commandShowcase.ts` / `.client.ts` | Demo command-palette showcase rows/answers (`atRiskDemoRows`, `nlAnswers`) |

## 6. Class D — DEMO CONTROL FLOW

| Site | Branch | Note |
| --- | --- | --- |
| `src/api/config.ts` | `resolveConfig()` → `mode: "demo" \| "api"`; `__APP_TARGET__ === "client"` forces api | The mode switch itself; **the single configuration authority** |
| `src/domains/demo/useDataLifecycle.ts`, `useDemoData.ts` | React seams over lifecycle + manager | Views never touch the store (§ architecture gate) |
| `src/components/lifecycle/DataLifecycleGate.tsx` | `if (isDemoMode()) return children` | Demo-only gating |
| `src/domains/auth/demoAuthRepository.ts` | `if (isDemoMode()) return []` | Demo credential hints |
| `src/domains/demo/lifecycle.ts` | `isDemoMode()` in 3 decisions (adoption, mode resolution, marking) | Environment kind |
| `src/views/Login.tsx` | demo hints / one-tap fill behind `isDemoMode()` | Presentation |
| `src/targets/targetFeatures.tsx` | `isDemoMode() && …` | Panel/notice composition |

## 7. Class E — BUILD / DELIVERY / COMPOSITION

| Path | Role |
| --- | --- |
| `src/domains/registry.ts` (320 L) | **Demo composition**: 8 mode-aware getters + **12 demo-in-both** getters + `DEMO_SERVED_DOMAINS` (11) + attendance-presence composition |
| `src/domains/registryCore.ts` | Shared plumbing (overrides, API client, token, reset) — no repository imports; imported **only** via the relative `./registryCore` |
| `src/domains/registry.client.ts` | **Client composition**: 8 API getters + explicit `createUnavailableRepository` for the rest + `UNAVAILABLE_DOMAINS` (12) + empty `DEMO_SERVED_DOMAINS` |
| `src/domains/shared/unavailableDomains.ts`, `unavailableRepository.ts` | The client-mode explicit-unavailable mechanism (mirror of the demo enumeration) |
| `src/api/deploymentLock.ts` | Delivery state machine `DEMO_ACTIVE → REMOVE_DEMO → PRODUCTION_DELIVERED → LOCKED`; fail-closed on unrecognised state; `assertDemoOperationAllowed()` |
| `vite.config.ts` | `APP_TARGET` + 6 target aliases + `@/domains/registry` → `registry.client.ts` swap + `__APP_TARGET__` define |
| `package.json` | `build` (bare), `build:client` (+ `tsc -p tsconfig.client.json`), `build:demo` (+ `tsconfig.demo.json`) |
| `tsconfig.client.json`, `tsconfig.demo.json` | Per-target typecheck profiles |

## 8. Class F — TEST / QA (~46 demo-significant files of 195)

- **Demo-domain suites (14, ≈2,100 lines)**: `dataLifecycle` (447 L), `delivery` (252), `backupMigration` (168),
  `schedulingBackup` (174), `demoDataManager` (201), `schedulingSeed` (214), `seed` (133), `lifecycle` (127),
  `prototypePollution` (118), `backup` (117), `authIntegration` (116), `useDemoData` (98),
  `dataIntegrity` (89), `contracts` (47).
- **Per-domain demo repository suites (~18)**: e.g. `library/__tests__/demoRepository.test.ts` (54 signals).
- **Boundary gates**: `src/__tests__/bundleBoundary.test.ts` (client/demo artifact separation, vacuous-pass
  guard), `m10Boundary.test.ts` (fixture dissolution + deferral ledger), `registryClient.test.ts`
  (client composition imports no demo module; the relative-import pin), `architectureBoundaries.test.ts`,
  `DemoBackedNotice.test.tsx` (22 test-name references; the stale-enumeration tripwire),
  `deploymentLock.test.ts`, `demoStoreMigration.test.ts`, `DemoDataPanel.test.tsx`, `DataLifecycleGate.test.tsx`.
- **Honesty / no-fixture gates (8)**: `relationsNoFixtures`, `attendanceNoFixtures`,
  `compensationNoFixtures`, `schedulingNoFixtures`, `messagesNoFixtures`, `honestWriteCopy`,
  `noSuccessWithoutWrite`, `emptyEnvironment(.test|Panels)` (+ `loginDemoIsolation.test.tsx`).
- **Harness**: `src/test/demoEnvironment.ts` (`resetToDemoEnvironment` / `resetToEmptyEnvironment` /
  `resetToUninitialized`), `src/test/setup.ts`.
- **D9**: `src/__tests__/bundleBudget.test.ts` (constants `343947 / 273791 / 361144 / 400000`) — touched by
  any build-shape change.

## 9. Class G — GOVERNANCE / DOCUMENTATION, and incidental mentions

Governance documents that decide or describe the demo boundary:
`docs/architecture/demo-data.md` (the demo data contract, lifecycle, manager, DemoStore keys),
`docs/architecture/data-layer.md` (**"Why the DemoStore stays … implementation #1, not scaffolding"**, §37
no-dishonest-fallback), `docs/architecture/environments.md` (mode safety rules),
`docs/engineering/DECISIONS.md` §19 **D8** (demo-backed disclosure) and §22 (D9 re-baseline),
`docs/frontend-completion/05-rbac-access-control.md` (`demo.manage`, X-07), `docs/production-handoff.md`
(DEMO-ONLY outstanding items), `docs/security.md` §8–§9 (demo/client-only controls), the F-reports
(F8 backup, F9 mobile contract), and the session/audit handoffs.

Incidental: **~230 of the 351 token-carrying files** mention "demo" only in comments, test titles or
boundary assertions; they are listed as a group because they are **not** demo architecture — but any
naming-cleanup wave must sweep them for vocabulary (never by blind rename).

## 10. What this inventory proves (and does not)

1. Demo exists in **five structurally different ways** — data (A), a second implementation (B), UI (C),
   control flow (D), build/composition (E) — and **only A must survive**; B–E are the migration surface.
2. **No file in the repository is production-unsafe today**: the client composition contains zero demo
   imports (pinned by `registryClient.test.ts` and the bundle-boundary scan), and the remaining demo
   selection is *disclosed* (D8) rather than hidden.
3. The migration is **not a rename exercise**: it requires a canonical local-persistence type, a single
   composition, a single build strategy, and a dataset-extraction step — each with D9 and test impacts
   (§`DEMO_MIGRATION_WAVES.md`).
4. Nothing here authorizes any change: the inventory is discovery only.
