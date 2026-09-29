# DEMO → DATA — TARGET ARCHITECTURE (proposal)

> Produced 2026-09-29 from the evidence in `DEMO_INVENTORY.md` / `DEMO_MIGRATION_MATRIX.md`, against
> `main` @ `15775ea…`. **This is a proposal, not a decision.** Every point that would change governance,
> behaviour, the bundle, the environment vocabulary, or the security posture is marked
> **⚠ OWNER DECISION**. Nothing here is implemented, and no document was rewritten to match it.
>
> **Target principle: DEMO DATA ≠ DEMO ARCHITECTURE.**
>
> ```
> Sample dataset → import/validate → local data store → canonical repositories → app code
>                                                       (Api repositories → backend when present)
> ```
> **not**
> ```
> demo mode → demo repository → demo application
> ```

## 0. What the evidence forces (and what it does not)

| Evidence | Consequence |
| --- | --- |
| 20 `Demo*Repository` classes carry **real business rules** (scheduling conflicts 573 L, compensation 866 L, attendance 317 L, learning 381 L, progress 427 L) | They are not scaffolding. The target keeps their logic as the **canonical local implementation**; deleting them would delete product behaviour. |
| The **client composition already contains zero demo code** and an explicit `UNAVAILABLE_DOMAINS` mechanism | The "one application" target must not reintroduce a hidden fallback: the local implementation must be **explicitly selected**, never a silent downgrade in api mode (`docs/architecture/data-layer.md` §37). |
| `media/demoReferences.ts` — canonical logic — types its parameter as **`DemoStore`** | The **store needs a canonical interface type** before any honest "one codebase" claim. |
| The dataset is **pure and deterministic** (`createSeedDataset()`, `SEED_VERSION 2026.09.1`) with 30 collections | It is already almost an importable artifact; extraction is a packaging problem, not a rewrite. |
| D9 headroom is **107 B**; the client bundle today contains no dataset and no demo repositories | ⚠ Any strategy that puts the dataset + local implementation back into the shipped main bundle **changes the bundle materially** and needs a D9 decision (split/lazy-load vs re-baseline). |
| `data-layer.md` states the DemoStore "is never deleted as part of the API migration — it is simply not selected" | ⚠ The target keeps that promise in substance (the local implementation survives) but changes its **name and framing** — a documentation decision. |

## 1. Canonical domain implementations

- **One implementation per role, not per mode:**
  `Api<Domain>Repository` (backend path) and `Local<Domain>Repository` (on-device path, today's
  `Demo<Domain>Repository` renamed, logic preserved). Both implement the **same existing domain contract**
  (`src/domains/<domain>/repository.ts`) — untouched.
- **No `Demo*` class survives as architecture.** The word stays only where it names **data**
  (e.g. `DEMO_DATASET_VERSION`, dataset files, seed content).
- Demo-only *behaviour* inside those classes — seeded bytes, seed-only affordances, "prototype" copy —
  moves to the **dataset + capability gate** (Class A/C), not to the repository.
- ⚠ OWNER DECISION: whether the local implementation is a first-class *product* implementation
  ("offline/local mode, permanently") or a *development/demonstration* implementation that a production
  deployment may disable. Both are implementable; the delivery lock already supports disabling.

## 2. Repository boundaries (unchanged, and that is the point)

```
View / hook
   ↓  domain contract (unchanged: repository.ts per domain)
Composition root (registry)
   ↓
Local<Domain>Repository ──► LocalDataStore ──► importable dataset (sample) | operator data
Api<Domain>Repository  ──► ApiClient ──► backend
```
- Views keep depending on **getters**, never on classes.
- The store is reached **only** through repositories (the `architectureBoundaries` gate already enforces
  that views never import it).
- `media/release.ts` keeps asking `mediaStillReferenced(...)` — but typed against a **canonical store
  interface**, not the demo class.

## 3. Data import boundary (new, and the heart of the objective)

A **dataset artifact** with a declared schema and version:

```
data/dataset/
  manifest.json         { schemaVersion, datasetVersion, createdAt, label, counts }
  <collection>.json     30 collections, deterministic order
  assets/               demo library file, gallery images (bytes referenced, not embedded in JSON)
  schema/               JSON-schema-ish validator (shape + referential integrity)
```
- **Import path:** artifact → validator → `LocalDataStore.replace()` (atomic, as today) →
  same repositories. Invalid artifact ⇒ refused with a per-issue report (the backup validator already
  models this).
- **Two sources for the same shape:** the shipped sample dataset (formerly "demo seed") and an operator's
  own import/backup. **One code path.**
- The runtime `createSeedDataset()` is retained as the *builder* until the artifact is proven
  byte-equivalent; then the builder becomes a fixture generator + dataset test oracle.
- ⚠ OWNER DECISION: whether the artifact ships **inside** the bundle (bigger main chunk) or as a
  **lazy-loaded asset** fetched on first "load sample data" (keeps the entry small; D9-friendly).

## 4. Seed / fixture structure

- The five seeds (`academySeed`, `learningSeed`, `librarySeed`, `gallerySeed`, `progressSeed`,
  `schedulingSeed`) become **dataset sections** with their determinism pinned (`seed.test.ts` is the oracle).
- `SEED_DATE = "2026-09-01"` and `SEED_WINDOW_DAYS`: **unchanged**, because I19's date-dependent test
  depends on them and I19 is a **protected** area. Any change here is an I19 decision, not a migration step.
- No fixture module may re-enter application code: the M10 boundary (`m10Boundary.test.ts`) and the five
  `*NoFixtures` gates stay in force.

## 5. Dataset ownership

- The sample dataset is **product content owned by the repository** (versioned, reviewed, licensed),
  not test scaffolding: it is the demonstration/first-run experience.
- The dataset is **data-only**: JSON + asset bytes + a validator. It may not import application code
  (today `seed.ts` imports entity types from domain modules — the extraction removes that coupling).
- Provenance: the dataset carries a stable `datasetVersion`; operator imports carry their own
  provenance stamp (the store already stamps provenance).

## 6. Production data path (unchanged in principle)

`Api repositories → ApiClient → backend`. The backend does not exist and is **not authorized**; every
server-side requirement in `docs/security.md` §8 and `docs/production-handoff.md` stays open and
non-optional. The migration **must not** be presented as a substitute for the backend.

## 7. Local (sample/operator) data path

Local mode = repositories over the local store, fed by (a) the shipped dataset, (b) operator imports, or
(c) an EMPTY environment. This is today's behaviour under a new name; the **delivery lock**
(`api/deploymentLock.ts`) continues to gate and permanently disable local demonstration capability once
production is delivered.

## 8. Authentication boundary

- **Local mode:** the local auth implementation over dataset users (today `DemoAuthRepository`), with the
  bootstrap administrator for EMPTY environments (unchanged).
- **API mode:** `ApiAuthRepository` (unchanged); server-side requirements (hashing, rate limiting, session
  revocation, MFA) remain **backend-required**.
- ⚠ OWNER DECISION: whether demo *credentials* remain shipped for the sample dataset. They are currently
  capability-gated (login throttle, deployment lock). Keeping them is what makes the sample dataset usable
  out of the box; removing them requires a different first-run story.

## 9. Authorization boundary

Unchanged: RBAC matrix, `can()`/`canAccessView()`, scope functions, T-02 assigned-only, `demo.manage`
(stays as the permission that guards dataset/lifecycle operations — ⚠ rename is an owner decision).
**UI guards remain UX-only; server enforcement stays a backend requirement.**

## 10. Frontend / backend boundary

- Frontend keeps a **declared contract per domain** (`repository.ts`) and an `apiRepository.ts` for those
  that have one (**11 today**, of which **8** are selected).
- The client build's explicit-unavailable mechanism (`UNAVAILABLE_DOMAINS` + `createUnavailableRepository`)
  stays until the backend serves each domain — it is the honest "not yet" state, and it is **the mirror
  that must finally agree with the composition's own list** (the D8 11-vs-12 discrepancy is an owner
  decision; the target has **one** enumeration, not two).

## 11. Build strategy

| Option | Effect | D9 |
| --- | --- | --- |
| **B1 (today)** two builds: `demo` (everything) and `client` (no demo at all) | clearest boundary, two artifacts | client 78 kB entry / demo 135 kB; total measured **361,037 / 361,144** |
| **B2 (target candidate)** one build, local implementation included, dataset **lazy-loaded** | one application; sample data fetched on demand; no hidden fallback | needs measurement; static part grows by the local repositories (≈4.3 k lines) |
| **B3** one build with everything eager | simplest to reason about | ⚠ almost certainly exceeds the 107 B headroom → owner re-baseline or splitting required |

⚠ **OWNER DECISION (B2 vs B3; B1 may be kept with a renamed boundary).** In every option: the local
implementation is selected **explicitly** by configuration, never silently; the api-mode disclosure
(D8) continues to name locally-backed domains until the backend serves them.

## 12. Test strategy

- **Renaming, not rewriting**: the ~18 per-domain repository suites and the 14 demo-domain suites move with
  their modules; assertions stay byte-for-byte unless behaviour intentionally changes (it does not, in
  W2–W4).
- **Boundary gates are re-pointed, never loosened**: `bundleBoundary` (artifact separation → single-artifact
  invariant), `registryClient` (composition purity), `architectureBoundaries` (views never touch the store;
  extended to the canonical store interface), `m10Boundary` + the five `*NoFixtures` gates (unchanged).
- **New gates the target needs:** dataset schema/version contract; "no `Demo*` architecture" naming gate
  (path/class-level, with a documented exemption list = Class H); "explicit selection only" gate (config
  cannot silently pick local in api mode).
- **D9** unchanged: `bundleBudget.test.ts` constants stay; every wave that touches bundle shape must
  measure and report.

## 13. Migration ordering

Derived (not assumed) in `DEMO_MIGRATION_WAVES.md`: **W1 vocabulary/spec → W2 dataset extraction →
W3 store + plumbing → W4 repositories → W5 composition/build → W6 control flow → W7 delivery/UI →
W8 tests → W9 naming cleanup → W10 eradication audit.** Hard dependencies: W1 before all; W3 before W4;
W4 before W5's final form; W8 with W5; W10 last. W2 can proceed in parallel with W3/W4.

## 14. Rollback strategy

- **Branch-per-wave**, disposable clones only; the pre-F2 backup branch
  (`backup/pre-f2-2026-09-29` @ `62deb84…`) and its bundle are the recovery source.
- Every wave states its **rollback point** = the parent commit; a wave that cannot be reverted by
  `git revert <commit>` (i.e. that changes storage keys, env vocabulary or artifact layout) is flagged
  **irreversible-by-revert** and must ship a compatibility shim (e.g. read both storage keys) or be
  rejected.
- **Never**: force-push, rewrite history, touch the protected checkout, move D9's constants, or edit
  governance documents without an explicit decision.
