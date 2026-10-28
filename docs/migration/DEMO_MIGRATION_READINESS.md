# DEMO MIGRATION — READINESS GATE

> Produced 2026-09-29 as **Phase 5** of the demo→data discovery run, against `main` @ `15775ea…`.
> **STOP POINT.** No source file was modified, no file renamed, no repository deleted, no registry
> changed, no build altered, no backend touched, no implementation committed.
> **No completion is claimed, and none may be.**
> Evidence base: `DEMO_INVENTORY.md`, `DEMO_MIGRATION_MATRIX.md` (92 rows),
> `DEMO_TO_DATA_TARGET_ARCHITECTURE.md`, `DEMO_MIGRATION_WAVES.md`.

## 1. How much of the original demo architecture has actually been migrated already?

**Partially, and unevenly — roughly three of five layers.**

| Layer | State today | Share migrated |
| --- | --- | --- |
| **Data (A)** | Already an explicit, versioned, deterministic dataset (`createSeedDataset()`, `SEED_VERSION 2026.09.1`, 30 collections) with a lifecycle marker and a backup envelope | **~80 %** — it is data in shape, but it still imports application entity types (`seed.ts`) and is not yet a standalone artifact |
| **Architecture (B)** | 20 `Demo*Repository` classes + store + manager + backup + lifecycle; real business logic inside them | **~0 %** renamed/re-framed; **100 %** of the logic is reusable as-is |
| **UI (C)** | 8 file **pairs** (targets) + panels; the client variants are already empty stubs | **~40 %** — the client build already proves the UI can exist without demo, but the pairs remain |
| **Control flow (D)** | `isDemoMode()` in 6 branch sites; mode chosen by `resolveConfig()` | **~30 %** — the mode switch is honest and centralised; the vocabulary is demo-first |
| **Build/delivery (E)** | Two profiles (`demo` / `client`); the `client` build contains **zero** demo imports (pinned by two gates); delivery lock + lifecycle machinery complete | **~50 %** — the hardest safety work (Phase 2A) is done; the **one-application** merge is not |

**Honest summary:** the *boundary* has been migrated (an honest client build with no demo capability);
the *architecture* has not been (demo is still a second implementation selected by mode, named as such).

## 2. What remains?

1. Dataset extraction into a standalone artifact + validator (W2).
2. A canonical store interface, and the store/plumbing renames (W3).
3. 20 repositories re-framed as the canonical **local** implementation (W4).
4. **One composition and one build** (W5) — the only structural change that alters shipped artifacts,
   and the one carrying the D9 and D8 decisions.
5. Control-flow/lifecycle vocabulary, keeping `VITE_DATA_SOURCE=demo` working (W6).
6. Delivery/UI vocabulary and re-sourcing the disclosure from one list (W7).
7. Gates rewritten **stronger**, plus three new gates (W8).
8. Residual naming sweep (W9) and the read-only eradication audit (W10).

## 3. Which demo components can be removed safely?

**Only these, and only after their wave:**

| Component | Note |
| --- | --- |
| The **6 `*.client.*` target variant files** | Safe **only if** W5 retires the dual build; until then they are the client artifact's protection |
| `unavailableRepository.ts` / `unavailableDomains.ts` | Removable **only** when the backend serves those 12 domains (backend **not authorized**) |
| The literal word "demo" in **class and file names** that denote canonical code (Class H: `demoReferences`, `demoCollection`) | Rename, never delete |
| Demo-only *affordances* inside canonical code (seeded bytes writes, prototype notes) | Move to the dataset/capability gate; do not delete the capability |

**Nothing else may be removed:** the repositories carry product behaviour; the store is the local
implementation; the manager/backup/lifecycle/delivery machinery are product features.

## 4. Which demo components must first become normal application implementations?

- The **12 demo-in-both-modes repositories** — they currently serve api-mode reads from local data.
  They must first become *named and framed* as the canonical local implementation, and, separately, the
  D8 question of whether they should keep serving api mode at all must be decided **before** W5.
- `src/services/demoStore.ts` — must first be typed by a canonical interface (it is already the only
  persistence authority; only the naming and the type boundary change).
- `src/domains/media/demoReferences.ts` — canonical logic whose parameter type is the demo class.

## 5. Which demo data must be preserved?

**All of it (Class A, 13 files, ~2,450 lines):** `academySeed`, `seed`, `learningSeed`, `librarySeed`,
`gallerySeed`, `progressSeed`, `schedulingSeed`, `types` (dataset schema), `demoCredentials`, the two
`demoContent` asset writers, plus the appended **asset bytes** (library file, gallery images) now carried in
the blob store. **Exception to preserve verbatim:** `SEED_DATE = "2026-09-01"` / `SEED_WINDOW_DAYS`, because
**I19** (protected scheduling area) depends on that date.

## 6. Minimum implementation sequence

`W1 → W2 → W3 → W4 → W5 → W7 → W8 → W9 → W10`, with **W6** parallel to W7 (it only touches configuration
vocabulary), and **W2** parallel to W3/W4. Rationale and the full field-complete plan are in
`DEMO_MIGRATION_WAVES.md`. The sequence is dependency-driven: no repository may be renamed before the store
has a canonical interface; no build may merge before every implementation is canonical; no gate may be
rewritten before the shape it enforces exists.

## 7. Which steps require owner authorization?

**Every wave.** In addition, four steps are *owner decisions*, not merely authorizations:

1. **D8 membership** — the 11-vs-12 enumeration (`organization`) must be decided before W5, or the unified
   list inherits the discrepancy.
2. **Build strategy** — B1 (two builds, renamed boundary) / B2 (one build, lazy dataset) / B3 (one build,
   eager) — with the D9 consequence stated for each.
3. **Environment vocabulary** — whether `demo` becomes `local` in `VITE_DATA_SOURCE` (aliases mandatory if so).
4. **Demo credentials** — whether the shipped dataset keeps usable sign-in material.

## 8. Which steps require backend authorization?

| Step | Backend dependency |
| --- | --- |
| Retiring `unavailableRepository.ts` / shrinking the unavailable list | **Yes** — requires served endpoints per domain |
| api-mode local reads for the 12 demo-in-both domains | **Yes** — the honest end state is a server; the local implementations are interim |
| Security posture (`security.md` §8: hashing, server authorization, rate limiting, session revocation, tenant isolation, IDOR, upload pipeline, audit) | **Yes** — unchanged, none of it is satisfied by this migration |
| The rest (W1–W4, W6–W10) | **No** — frontend-only, and explicitly not a substitute for the backend |

## 9. Which existing tests must change because the architecture changes?

| Suite | Change | Rule |
| --- | --- | --- |
| `src/__tests__/bundleBoundary.test.ts` | **Rewritten** for a single-artifact invariant (no hidden fallback; disclosure list = composition list) | Strictly stronger; mutation-verified |
| `src/domains/__tests__/registryClient.test.ts` | Rewritten when the compositions merge | Pin the new invariant, not the old split |
| `src/domains/shared/__tests__/architectureBoundaries.test.ts` | **Extended** (store interface, not the `DemoStore` class) | Extended, never weakened |
| ~18 `__tests__/demoRepository.test.ts` + 14 `src/domains/demo/__tests__/*` | **Renamed with their modules**; assertions unchanged unless behaviour intentionally changes (it does not in W2–W4) | No assertion may be deleted to make a rename pass |
| `src/components/shell/__tests__/DemoBackedNotice.test.tsx` | Updated to the unified enumeration | Tripwire stays |
| `src/__tests__/bundleBudget.test.ts` | **Constants never change**; the wave that alters bundle shape must report measurements | D9 cap is owner-only |
| `src/views/__tests__/schedulingWrites.test.tsx` | **Untouched** (I19, protected) — unless the owner authorizes I19's remedy | Protected |
| The five `*NoFixtures` gates, `m10Boundary`, `honestWriteCopy`, `noSuccessWithoutWrite`, `routeProtection` | **Untouched** | Protected |

## 10. What must remain untouched?

T-02 (assigned-only, fail-closed) · the RBAC vocabulary and `can()`/`canAccessView()` guards ·
`docs/security.md` §8 and every backend requirement · the deployment lock's fail-closed semantics and the
idempotent, ownership-scoped removal · D9's constants · the protected scheduling area (I19) · the §21
preservation gate and all branches/tags/history · the `main` line and the protected WIP checkout · every
governance document without an explicit decision.

## 11. First concrete implementation unit

**W1 — the vocabulary and decision record, as a documentation-only unit.** It changes no behaviour, no
artifact and no test; it fixes the target vocabulary, records the objective as a decision, and names the
four owner decisions (§7). It is the only unit that unblocks every other wave **and** is safe to revert
entirely. *(If the owner prefers a code-touching first unit instead, the next candidate is **W2's
byte-equivalence test** — a test-only addition that proves the dataset artifact equals
`createSeedDataset()` before any extraction is attempted.)*

## 12. Rollback point

The **parent commit of each wave's branch**, with two named irreversibility risks:

- **W5** (artifact layout/build profiles): revertible by `git revert`, but a deployed artifact cannot be
  un-deployed — the old artifact must keep being served until deployment adopts the new one.
- **W3/W6** would become irreversible **if** storage keys or the environment value were renamed without
  compatibility shims — therefore **keys and env aliases are explicitly preserved**, and any wave that
  proposes otherwise must be rejected or shimmed.

Recovery anchors: `backup/pre-f2-2026-09-29` @ `62deb84…` (with the complete-history bundle), plus
`main` @ `15775ea…` itself.

---

## Completion criteria check — explicitly NOT satisfied today

The mandate forbids claiming completion. Measured against its own list:

| Criterion | Today |
| --- | --- |
| No unnecessary Demo architecture remains | ✗ 20 Demo repositories, 6 pairs, 2 builds |
| Demo is data/import only | ✗ demo is also selection, UI and control flow |
| Production code is the canonical implementation | ~ the Api path is canonical for 8 domains; 12 are local-served |
| No Demo repository secretly serves production | ✓ no *secret* fallback (api-mode local service is disclosed by D8) |
| No Demo-only service serves production | ✗ 12 domains are locally served in api mode — disclosed, not eliminated |
| No Demo-only control flow remains where unnecessary | ✗ 6 branch sites remain |
| Tests prove the new boundary | ✗ the boundary tests prove the **old** (dual-composition) boundary |
| Build boundary reflects the new architecture | ✗ two builds reflect the old architecture |
| Security boundary intact | ✓ (unchanged; UI is UX-only and the server remains the boundary) |
| D8/D9 remain governed | ✓ (D8 discrepancy recorded; D9 constants untouched, 107 B headroom) |
| Backend dependencies explicitly accounted for | ✓ (`security.md` §8, `production-handoff.md`, §8 above) |

**Therefore: DEMO MIGRATION STATUS = NOT STARTED (discovery complete).**
