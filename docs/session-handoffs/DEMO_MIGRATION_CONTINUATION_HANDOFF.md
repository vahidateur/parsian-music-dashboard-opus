# DEMO → DATA MIGRATION — CONTINUATION HANDOFF

> **Read this first.** Written 2026-09-29 to let a session arriving after this run recover the whole
> position from the repository, the backup, and the migration documents — **without conversation history.**
> Companion documents produced by the same run:
> `docs/migration/DEMO_INVENTORY.md`, `docs/migration/DEMO_MIGRATION_MATRIX.md`,
> `docs/migration/DEMO_TO_DATA_TARGET_ARCHITECTURE.md`, `docs/migration/DEMO_MIGRATION_WAVES.md`,
> `docs/migration/DEMO_MIGRATION_READINESS.md`, `docs/frontend-completion/F2_CLOSURE_ASSESSMENT.md`.
>
> **No implementation is authorized by this handoff.** It records state and plans; it does not start work.

---

## 1. Verified baseline (re-verified live at the start of this run)

| Fact | Value |
| --- | --- |
| Repository | `https://github.com/vahidateur/parsian-music-dashboard-opus` |
| `main` (live `git ls-remote`) | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` |
| `main` tree | `6eb78338ec19880adf5f97735f61de32e11cbf20` |
| Backup branch (live) | `backup/pre-f2-2026-09-29` @ `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` |
| Phase 2A landing branch | `arena/phase2a-landing` @ `2df607eff5f1ea1fe85e86381b9b0398fec81d18` (unmoved, retained) |
| WIP remote branch | `arena/01a0cefa-parsian-music-dashboard-opus` @ `eb973eb…` (unchanged) |
| PR #20 | `MERGED` (2026-09-28T23:21:11Z) → merge commit `15775ea…`, parents `eb5b559…` + `2df607e…` |
| CI | **not configured** — 0 workflows; every gate is local |
| Browser QA | **never performed in any session** |

Baseline verified with: `git ls-remote` (read-only), a fresh full clone (`/tmp/demomig`, not shallow,
212 commits), and a non-mutating status read of the protected checkout.

## 2. Backup location and SHA

| Artifact | Value |
| --- | --- |
| Branch | `backup/pre-f2-2026-09-29` — single commit, parent = `main`; **177 files added, 0 modifications/deletions of main files** |
| Backup commit | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` |
| Git bundle | `git/bundle/parsian-music-dashboard-full.bundle` — 6,229,578 B, sha256 `ef6b614c61effa5f7d3a31ceece8be1df7f833825b01348210920dac3ecfcb2d`, **38 refs**, *"records a complete history"* |
| WIP patch | `wip/tracked-working-tree.patch` — sha256 `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f` (78 file headers) |
| Untracked snapshot | `wip/untracked/` — 60 files, byte-identical copies |
| Documentation snapshot | `docs-snapshot/` — 87 documents + `docs/DOCUMENTATION_MANIFEST.md` |
| Handoff | `docs/session-handoffs/PRE_F2_BACKUP_HANDOFF.md` (11 sections) |
| Manifests | `BACKUP_MANIFEST.md`, `SHA256SUMS.txt` (233 entries, re-verified from an independent clone) |
| Recovery (one line) | `git clone -b backup/pre-f2-2026-09-29 https://github.com/vahidateur/parsian-music-dashboard-opus.git` |

## 3. Current `main` SHA

`15775ea9486cb57fbfb8fefa3268658cbe7eb669` — the Phase 2A merge. History: 212 commits,
M0–M11 → Frontend Freeze (`a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`, 2026-09-19) → F-series
integration (`112f1160…`) → F1 closure PRs #17/#18 → Phase 2A PR #20.

## 4. Current WIP state (the protected checkout — unchanged by this run)

| Fact | Value |
| --- | --- |
| Path | `/home/user/parsian-music-dashboard-opus` |
| Branch / HEAD | `arena/01a0e8ec-parsian-music-dashboard-opus` @ `eb973eb2758447eff16b60ab4fd4c267f9d85061` |
| Tracked modified | **78** (677 insertions, 674 deletions) — patch sha256 `aed92770…` |
| Staged | **0** |
| Untracked | **25 porcelain entries = 60 real files** (Phase 2A sources, earlier backup dirs, audit reports) |
| Deleted / renamed | 0 / 0 |
| Relationship to `main` | The WIP's untracked Phase 2A sources are **byte-identical to merged `main`** for 26 of 27 `src/…` files; **one divergence**: `src/targets/targetFeatures.tsx` (WIP copy = 166 lines, an *earlier* revision; `main` = 214 lines). Preserved, never reconciled. |

## 5. Completed work (what exists and is verified)

1. **M0–M11** — the product frontend, audited and frozen at `a3867a6…`; documented in
   `PROJECT_STATE.md` / `PHASES.md` / `DECISIONS.md` (§19 D1–D20, §20 backend checkpoint, §21 preservation
   gate, §22 D9 re-baseline, §23 preview rule, §24 G-7).
2. **F0–F10 frontend-completion slices** — delivered; F1 additionally closed gaps G-1…G-7 (PRs #17/#18).
3. **Phase 2A** (PR #20) — composition seams (`registryCore.ts` + `registry.client.ts` split), the client
   composition with **no demo capability**, production delivery lock (`api/deploymentLock.ts` +
   `domains/demo/delivery.ts`), build profiles `build:client` / `build:demo`
   (`tsconfig.client.json` / `tsconfig.demo.json`, `vite.config.ts` target aliases), boundary tests.
   Range `eb5b559..main`: 103 files, +3453 / −685, docs 0.
4. **Phase 2A post-merge audit** (2026-09-28) and **Phase 2B discovery audit** (2026-09-29) — both
   read-only, both PASS with two recorded non-blockers (the I19 Tuesday case; the `emptyEnvironmentPanels`
   load flake).
5. **Pre-F2 backup** (2026-09-29) — §2 above.

## 6. Open governance items (verbatim states, nothing resolved)

`D8` (see §9) · `D9` (see §10) · `T-02` ACCEPTED / ASSIGNED-ONLY, **do not revisit** · `I13` IN PROGRESS
(CP 1/2/3A/3B done; 3 view-boundary readers remain) · `I15` **contradiction** (status line says
"not authorized, not started"; commit `eaccbb1` + a 24-test suite say landed — both sides preserved) ·
`I16` OPEN (deferred; a *mitigation* is absorbed into F2, mitigation ≠ closure) · `I19` recorded,
environmental, protected area · `I22` NOT IMPLEMENTED · `I2/I4/I5/I7/I8/I10/I11/I14/I17/I18/I20/L1/L2`
open · DOCUMENTATION DRIFT set (`gap-matrix.md`, `architecture/data-layer.md`, `production-handoff.md`,
`architecture/auth.md`, `architecture/environments.md:56–63`) · **backend/Laravel NOT AUTHORIZED** ·
freeze-reopen policy in force · `M12` NOT STARTED, NOT AUTHORIZED.

## 7. Protected areas (must not be touched without explicit authorization)

| Area | Why |
| --- | --- |
| Scheduling domain & `src/views/__tests__/schedulingWrites.test.tsx` | I19's remedy is a semantic test change there |
| T-02 scope semantics (`auth/scope.ts`, teacher assigned-only) | governance: ACCEPTED / do-not-revisit |
| `architectureBoundaries` / `relationsNoFixtures` / `NoFixtures` gates and every existing test | tests are never weakened, skipped or retimed |
| `src/__tests__/bundleBudget.test.ts` constants (`343947` / `273791` / `361144` / `400000`) | D9: cap never raised; overruns fixed by splitting |
| D8 enumeration & organization getter | owner decision; preserved byte-identical |
| The registry ↔ client-build boundary (`registryCore` imported only relatively) | Vite alias prefix hazard; `registryClient.test.ts` pins it |
| The 386 preserved refs/branches/tags, `main`, all landing/backup branches | history is never rewritten |
| `docs/engineering/*` governance files | no silent edits; changes are recorded, not improvised |

## 8. Known test / environmental failures (preserved, not fixed)

| Case | Status | Detail |
| --- | --- | --- |
| `src/views/__tests__/schedulingWrites.test.tsx` → *"a real reschedule resolving a real conflict"* | **ENVIRONMENTAL, deterministic on Mondays/Tuesdays of the seed window** | `SEED_DATE = 2026-09-01` is a **Tuesday**; fixture `cl2` holds `days: [3]` (Tuesday). First recorded 2026-09-15 (Tuesday) as **I19**; reproduced 2026-09-29 (Tuesday). Phase 2A does not touch it (`git diff eb5b559..main` for the test/seed/clock is empty). Remedy requires authorization. |
| `src/components/settings/__tests__/emptyEnvironmentPanels.test.tsx` → *"saving the academy's identity never calls it demo data"* | **FLAKY (load-sensitive)** | `waitFor(…, { timeout: 8000 })` at line 137; observed once under full-suite parallel load (2026-09-28), 0/4 in the following runs, passes in isolation. Outside Phase 2A; unmodified. |
| Full-suite baseline | **2565 total = 2562 passed / 2 skipped / 1 failed** (audit-comparable dist state, 2026-09-29) | The single failure is the I19 case above. Skip counts depend on which build artifacts exist (`describe.skipIf(!hasBuild)`). |
| Browser QA | **NEVER PERFORMED** | No browser automation exists. jsdom proof must never be reported as browser proof. |

## 9. D8 state

**Decided and landed** (`DECISIONS.md` §19 → "D8. api mode must disclose which domains are still local";
landed at M11 `53794d57…`): when the data source is `api` but a domain still resolves to its Demo
implementation, the product discloses that persistently (`DemoBackedNotice`), sourced from the registry's
single enumeration `DEMO_SERVED_DOMAINS`.

**The recorded discrepancy (owner decision, not resolved here):**

| Fact | Value |
| --- | --- |
| Domains that resolve Demo **in both modes** (code) | **12** — instruments, learning, chat, media, library, branding, **organization**, gallery, progress, scheduling, attendance, compensation |
| `DEMO_SERVED_DOMAINS` (`registry.ts:283`) | **11** — the same list **without `organization`** |
| `UNAVAILABLE_DOMAINS` (`shared/unavailableDomains.ts`, the client composition's mirror) | **12** — **includes `organization`** |
| Consequence | `getOrganizationRepository()` returns `DemoOrganizationRepository` in both modes (its own comment documents this as deliberate), but the api-mode disclosure does not name it. The mirror lists disagree (11 vs 12). |
| Provenance | The list block and the getter are **byte-identical between the pre-Phase-2A base and `main`** → predates Phase 2A. |
| Second, minor drift | `DECISIONS.md`'s D8 text says "**seven** getters that switch on `isApiMode()`"; the code today has **eight** (`students`, `teachers`, `rooms`, `classes`, `enrollments`, `auth`, `users`, and `roles`, added later). |

No repository document assigns D8 to any implementation slice; it stays an **owner decision**.

## 10. D9 state

| Fact | Value |
| --- | --- |
| Rule | `bundleBudget.test.ts`: entry gzip **strictly < 273791**; total gzip (JS+CSS+HTML) **≤ 361144** = `floor(343947 × 1.05)`; no single chunk **≥ 400000** |
| Measured (bare build, CLI `gzip -6 -n` per file, reproduced byte-identically twice) | entry **135,153**; total **361,037**; largest chunk 135,153; **headroom = 107 B** |
| Governance rule for headroom | **none exists** — full-text search for "headroom" in `docs/` returns nothing; the only adjacent doctrine is that the Vite *warning* is cleared **by splitting, never by raising `chunkSizeWarningLimit`** (`DECISIONS.md` §22) |
| Status | In force, unchanged. Any migration step that changes the bundle must fit 107 B or be re-baselined **by the owner** (never by moving the cap). |

## 11. Primary product objective (this run's mandate)

```
ONE APPLICATION / ONE PRODUCTION CODEBASE   +   DEMO DATA ONLY
Demo code / repositories / services / demo-only architecture   → eventually disappears
Demo data / seed / fixture / importable dataset                → remains usable
Demo is DATA, not a second application implementation.
```

This objective is **not yet a repository decision record**. The repository currently encodes two
*compositions* (a demo composition and a client composition) and a documented intent that the DemoStore is
"implementation #1, not scaffolding" (`docs/architecture/data-layer.md`). Closing the gap between that
state and the objective is what the migration documents plan; **none of it is authorized yet.**

## 12. Current migration stage

| Stage | State |
| --- | --- |
| 0 — Discovery / inventory | **COMPLETE by this run** (see `DEMO_INVENTORY.md`, `DEMO_MIGRATION_MATRIX.md`) |
| 1 — Target architecture defined | **drafted by this run** (`DEMO_TO_DATA_TARGET_ARCHITECTURE.md`) — requires owner ratification |
| 2 — Wave plan | **drafted by this run** (`DEMO_MIGRATION_WAVES.md`) |
| 3 — Readiness gate | **reached** (`DEMO_MIGRATION_READINESS.md`); this run **stops** here |
| 4 — Implementation | **NOT STARTED, NOT AUTHORIZED** |

Quantified today: **12** demo-in-both getters, **20** Demo repositories, **23** `class Demo*` declarations,
**29** files in `src/domains/demo/`, **351** files carrying a demo-ish token (of which ~120 are
demo-significant), **195** test files (**161** mention demo, **40** are demo/seed/fixture-named),
**11** declared `apiRepository.ts` contracts of which **8** are selected in api mode, **12** target files
(**6** swappable pairs), **2** build profiles.

## 13. Next authorized decision point

**NO IMPLEMENTATION IS AUTHORIZED BY THIS HANDOFF.**

The next decision point is **owner ratification of the target architecture and the wave plan**, followed by
authorization of **exactly one wave** (the candidate first unit is named in
`DEMO_MIGRATION_READINESS.md` §11 — a docs/spec-level unit that changes no behaviour). The repository's
separate, already-identified next candidate — the **F2 closure/acceptance pass** — is assessed in
`docs/frontend-completion/F2_CLOSURE_ASSESSMENT.md` and is **not** superseded by this migration work.
