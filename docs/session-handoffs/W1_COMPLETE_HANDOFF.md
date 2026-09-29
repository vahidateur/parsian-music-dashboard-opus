# W1 — COMPLETE HANDOFF (demo → data migration, wave 1)

> **Wave:** W1 — *vocabulary and decision record* (`docs/migration/DEMO_MIGRATION_WAVES.md` §W1).
> **Nature:** documentation and governance only. **No source, test, build, registry, RBAC, D8, D9,
> backend or runtime change.**
> **Status: W1 COMPLETE.** The next wave (W2) is **NOT** authorized by this handoff.

---

## 1. W1 objective

Create the **auditable decision boundary** the discovery required before any implementation:

- fix the migration's **vocabulary** (the on-device implementation is **local**; "demo" is reserved for
  **data**) while naming the compatibility aliases that must keep working;
- record — **without resolving** — the four decisions that belong to the owner (D8 membership, build
  strategy, environment vocabulary execution, demo credentials);
- **ratify** the target architecture and the W1–W10 wave model as the working migration plan;
- change **nothing** in the product.

## 2. Files changed (and the commits that carry them)

| Commit | Files | Lines | Purpose |
| --- | --- | --- | --- |
| **0** — `85345c93…` *docs(migration): record the demo-to-data discovery and migration plan as audited* | `docs/migration/{DEMO_INVENTORY,DEMO_MIGRATION_MATRIX,DEMO_MIGRATION_READINESS,DEMO_MIGRATION_WAVES,DEMO_TO_DATA_TARGET_ARCHITECTURE}.md`, `docs/session-handoffs/DEMO_MIGRATION_CONTINUATION_HANDOFF.md`, `docs/frontend-completion/F2_CLOSURE_ASSESSMENT.md` | **+1,108** | the seven audited discovery documents, recorded as the plan of record |
| **1** — `379076f6…` *docs(migration): establish demo-to-data migration decision boundary* (**the mandated message**) | `docs/migration/W1_DECISION_BOUNDARY.md` (new, 165 L), `docs/engineering/DECISIONS.md` (**+§25 only**), `docs/architecture/data-layer.md` (**+11 L dated note**), `docs/architecture/demo-data.md` (**+10 L dated note**) | **+243** | the W1 boundary itself |
| **2** — this handoff (plus one reference fix, §6) | `docs/session-handoffs/W1_COMPLETE_HANDOFF.md` (new), `docs/engineering/DECISIONS.md` (one word-level fix) | small | verification record |
| **3** — the remote-verification addendum (§7) | this file, appended | small | records the pushed, GitHub-verified SHA (step 13 of the checkpoint rule) |

**Scope proof for the whole wave:** `src/**` 0 files · tests 0 files · `package.json` / `vite.config.ts` /
`tsconfig*.json` 0 files · **documentation only**.

## 3. Decisions recorded

1. **Vocabulary — DECIDED (execution pending).** Canonical term **local** for the on-device implementation:
   mode value `local` (with `demo` kept as a working alias), `localStore` behind a canonical
   `LocalDataStore` interface, `Local<Domain>Repository`, an importable **sample dataset**, and Persian
   UI copy that never describes the product as a demo application. "Demo" survives only as a name for
   **data** and in historical records.
2. **Compatibility register — DECIDED.** `VITE_DATA_SOURCE=demo`, the `ava:demo:*` storage keys and their
   persisted `empty`/`demo` lifecycle values, the `ava:delivery:*` keys, the `demo.manage` permission id,
   and the seed's own identity (`SEED_VERSION`, `SEED_DATE`) **must keep working**; renaming any of them
   without a read-both path is a compatibility decision, not a cleanup.
3. **Plan ratification — DECIDED.** The target architecture and the W1–W10 wave model are the migration
   plan of record; waves run one at a time, each separately authorized and verified.
4. **D8 — PRESERVED.** Its text, its 11-entry enumeration, the organization getter and the double
   fallbacks are untouched; the 11-vs-12 discrepancy (and the "seven getters" drift) are recorded as
   evidence, not resolved.
5. **D9 — PRESERVED.** Cap `361144`, constants `343947/273791/361144/400000`, measured `361,037`, 107 B
   headroom: all unchanged, and no headroom rule invented.
6. **Demo credentials — CLASSIFIED.** Recorded as **DEMO DATA (Class A)**: retained, capability-gated,
   never deleted or migrated without an explicit decision.

## 4. Decisions intentionally left pending (owner)

| # | Decision | Deadline | Where it must be recorded |
| --- | --- | --- | --- |
| 1 | **D8 membership** — 11 vs 12 (`organization`) and the unified enumeration's content | before **W5** | DECISIONS.md (a D8 amendment, by the owner) |
| 2 | **Build strategy** — B1 (two builds, as today) / B2 (one build, lazy dataset) / B3 (one build, eager) | before **W5** (B1 remains in force meanwhile) | DECISIONS.md, with the D9 consequence |
| 3 | **Demo credentials** — keep usable sign-in material in the shipped dataset? | before **W7** | the W1 boundary's decision register |
| 4 | **`demo.manage` rename** (optional) | not scheduled | RBAC decision + matrix update |

Nothing else was left ambiguous: the boundary document records each pending item with its deadline and the
wave that must not start without it.

## 5. Protected items verified

| Item | How verified | Result |
| --- | --- | --- |
| Protected WIP checkout | `git status --porcelain` before/after, tracked-diff sha256 | **Unchanged** — `78 M` / `0` staged; tracked diff sha256 `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f` (identical to the pre-F2 backup value); HEAD `eb973eb`, branch `arena/01a0e8ec-…`. Only **new untracked** files were added there (this handoff, the W1 boundary, and two new `docs/` files), never a tracked edit |
| `main` | live `git ls-remote` | **Unchanged** @ `15775ea9486cb57fbfb8fefa3268658cbe7eb669` |
| `backup/pre-f2-2026-09-29` | live `git ls-remote` | **Unchanged** @ `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` |
| `arena/phase2a-landing`, WIP remote branch | live `git ls-remote` | **Unchanged** |
| D8 / D9 | diff inspection of `registry.ts` (untouched) and of DECISIONS.md (§19 D8 and §22 sections untouched) | **Unchanged** |
| RBAC / T-02 / I19 / I22 / backend | no file in `src/**` changed | **Unchanged** |
| Branch policy | this wave ran only on `docs/demo-migration-plan`; no merge, no rebase, no squash, no force-push, no direct `main` change | **Compliant** |

## 6. Tests / checks executed

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm ci` | exit 0 |
| **Project-state gate** | `npx vitest run src/__tests__/projectState.test.ts` | **52/52 PASS** (after the fix below) |
| Architecture boundaries | `architectureBoundaries.test.ts` | 24/24 PASS |
| Fixture/domain boundary | `m10Boundary.test.ts` | 13/13 PASS |
| Write-honesty gate | `writeFeedbackHonesty.test.ts` | 6/6 PASS |
| Privacy posture (security) | `privacyPosture.test.ts` | 22/22 PASS |
| Appearance layer | `appearanceLayer.test.ts` | 14/14 PASS |
| Typecheck | — | **NOT RUN** — no `src/**` or `tsconfig` change (the checkpoint rule makes it conditional on code changes) |
| Builds | — | **NOT RUN** — no artifact-affecting change; `bundleBoundary` / `bundleBudget` / `cspCompatibility` read `dist/` and are unaffected by documentation |

**One gate finding, fixed inside W1 (transparent record).** The first run of `projectState.test.ts` failed
**1 of 52** — *"every backticked src/ or docs/ path exists in the repository"* — because the new §25 wrote
the branch name `docs/demo-migration-plan` inside backticks, which the gate reads as a repository path. The
wording was corrected (the branch name is no longer backticked) and the gate went **52/52 green**. No test
was modified, skipped or weakened; the gate did its job on an authoring mistake.

**One authoring slip, corrected before any push (transparent record).** The first local authoring of commit 0
used `git add docs/migration`, which swept the then-untracked `W1_DECISION_BOUNDARY.md` into it (8 files).
The branch was recreated from `main` with **explicit paths** and commit 0 re-authored as exactly the seven
planning documents (**+1,108** lines, matching the audited discovery output). Nothing had been pushed, so no
published history was rewritten. The earlier local commit `2abee66` is superseded and must not be cited.

## 7. Branch, SHAs and the remote record

| Field | Value |
| --- | --- |
| Current branch | **`docs/demo-migration-plan`** |
| Parent SHA (wave base) | **`15775ea9486cb57fbfb8fefa3268658cbe7eb669`** (`main`, Phase 2A merge) |
| Commit 0 (plan record) | `85345c932c4ac510b1e74c9e16fa329c4c7f82cd` |
| **Commit 1 (the W1 decision boundary — the mandated commit)** | **`379076f63915e46f34e73236041bd95725ffefa8`** |
| Commit 2 (this handoff + the reference fix) | recorded by `git log` — the commit that carries this file |
| Commit 3 (remote verification addendum) | the branch tip after the second push; SHA recorded in the addendum below |
| Plan-branch prehistory | The discovery-time branch head `c5e1ace` lived only in a wiped disposable clone and was **never pushed**; its content is exactly the seven documents in commit 0, so it is superseded by commit 0 (state the recreation honestly — do not cite `c5e1ace` as a reachable object) |
| Remote | pushed to `origin` as **only** `docs/demo-migration-plan`; `main` and every other branch untouched; no merge, no force |

### 7a. Remote verification (GitHub)

| Field | Value |
| --- | --- |
| `git ls-remote origin refs/heads/docs/demo-migration-plan` | verified after push — the branch exists and its SHA equals the local tip |
| Expected remote SHA | recorded in the addendum commit (commit 3) and in the wave report |
| Other refs re-verified after push | `main` = `15775ea…` · `backup/pre-f2-2026-09-29` = `62deb84…` · `arena/phase2a-landing` = `2df607e…` — all unchanged |

## 8. Next authorized wave

**W2 — dataset extraction** (`docs/migration/DEMO_MIGRATION_WAVES.md` §W2): extract the seed into a
versioned, validated `data/dataset/` artifact with a byte-equivalence test against `createSeedDataset()`,
asset bytes referenced rather than embedded, and **no** behaviour change.

**W2 IS NOT AUTHORIZED BY THIS HANDOFF.** It starts only on an explicit instruction, must run in its own
disposable clone on this same branch, and must carry its own handoff and its own protected-state
verification. The same rule applies to every later wave (W3–W10).

## 9. Rollback

**Rollback point = the parent commit of this wave, `15775ea9486cb57fbfb8fefa3268658cbe7eb669` (`main`).**
Because W1 changes no code, test, configuration or runtime artefact, the rollback is total and its blast
radius is documentation only: reverting the W1 commits (or abandoning the branch, which is never merged
into `main` by this wave) restores every sentence of every touched document. The recovery anchors remain
`main` @ `15775ea…` and `backup/pre-f2-2026-09-29` @ `62deb84…`.
