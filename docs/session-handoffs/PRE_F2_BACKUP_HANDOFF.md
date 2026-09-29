# PRE-F2 BACKUP — SESSION HANDOFF

> **Read this file first.** It is written to be self-contained: a session arriving after this backup can
> recover the whole position from this document, the backup artifacts (branch `backup/pre-f2-2026-09-29`,
> Git bundle, WIP patches, documentation snapshot, checksum manifests), the Git history and the test suite —
> **without needing any conversation history.**
>
> Sibling records in the same backup: `BACKUP_MANIFEST.md` (what was preserved, with hashes),
> `WIP_MANIFEST.md` (the working checkout, classified A–E), `GOVERNANCE_STATE.md` (item-by-item state),
> `VERIFICATION_EVIDENCE.md` (PASS/FAIL/FLAKY/ENVIRONMENTAL/NOT RUN evidence), `DOCUMENTATION_MANIFEST.md`
> (all 87 captured documents with hashes), `wip/` (patches, untracked files, state captures),
> `git/` (refs, branches, tags, full log, merge topology, key SHAs, and the complete-history bundle).

---

## 1. Project identity

| Fact | Value |
| --- | --- |
| Repository | `https://github.com/vahidateur/parsian-music-dashboard-opus` |
| Product | A Persian (RTL) music-academy management dashboard — students, teachers, classes, scheduling, attendance, compensation, learning/library/gallery, chat, finance, settings, export |
| Stack | React + TypeScript + Vite + Tailwind-style design system; Vitest/jsdom; no CI |
| Architecture doctrine | **Frontend-first with a single mock authority** (`demoStore` + seeds + `blobStore`) and an API seam; UI hiding is explicitly **not** a security boundary; backend (Laravel) is **not started and not authorized** |
| Canonical branch | `main` @ `15775ea9486cb57fbfb8fefa3268658cbe7eb669` |
| Working branch (this session's WIP checkout) | `arena/01a0e8ec-parsian-music-dashboard-opus` @ `eb973eb2758447eff16b60ab4fd4c267f9d85061` |
| Backup branch | `backup/pre-f2-2026-09-29` (backup artifacts only — see §11) |
| Browser QA | **never performed in any session** |
| CI | **not configured** (0 workflows) |

## 2. Exact baseline

| Ref | SHA | Note |
| --- | --- | --- |
| `main` (tip) | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` | merge commit of PR #20; verified **live** via `git ls-remote` on 2026-09-29 |
| `main` tree | `6eb78338ec19880adf5f97735f61de32e11cbf20` | verified from a clone made from the backup bundle |
| PR #20 merge parents | `eb5b5598774bdadd0a7aabab01d88e564dcb867d` (PR #19 merge) + `2df607eff5f1ea1fe85e86381b9b0398fec81d18` | exactly two parents |
| Phase 2A branch | `arena/phase2a-landing` @ `2df607ef…` | retained on GitHub, unmoved |
| `main` ancestor | `eb5b5598774bdadd0a7aabab01d88e564dcb867d` | pre-Phase-2A governance line |
| WIP checkout HEAD | `eb973eb2758447eff16b60ab4fd4c267f9d85061` | 2026-09-23, *"feat: complete gallery library resource architecture"* |

Key SHAs resolved against the full mirror (all 38 live refs) are in `git/important-shas.txt`, including:
Phase 2A `1b96db70…` / `1c8b8321…` / `2df607ef…`; PR #18 merge `0184e011…`, G-7 `096723bf…`,
docs head `ef4eb841…`; PR #17 merge `8e6bce95…`; F-series `112f1160…` (integration), `d0cfd52d…` (F2 scope),
`8aff3a20…` (F2 report), `eaccbb1f…` (I15 closure), `61f9b417…` (F3), `524484b6…` (F4), `e7c30d68…` /
`2f5b11a9…` (F7), `ff64342a…` (F8), `0640ca8a…` (F9), `0d13c38c…` (F10); M9 `8d34eb3d…`, M10 `c16890f5…`,
M11 `3eed4f19…`; frontend freeze `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`.

## 3. What has been completed

1. **Product milestones M0–M11** — the frontend was built, audited and frozen (`a3867a60…`, 2026-09-19),
   recorded in `PROJECT_STATE.md` / `PHASES.md` / `DECISIONS.md`.
2. **Frontend-completion slices F0–F10** — delivered via the integration chain (`112f1160…` and later),
   each with an INVENTORY and a REPORT under `docs/engineering/`; F1 additionally closed its audit gaps
   **G-1…G-7** through PRs #17/#18 (G-7 = a real Library → Teacher relationship, `DECISIONS.md` §24).
3. **Phase 2A** — merged by **PR #20** (non-force merge, `2026-09-28T23:21:11Z`), preserving three commits:
   `1b96db7` build profiles, `1c8b832` composition seams + production delivery lock, `2df607e` tests.
   Range `eb5b559..main`: 103 files, +3453 / −685, docs 0.
4. **Phase 2A post-merge read-only audit** (2026-09-28) — **all PASS**: main integrity, preservation,
   typecheck, three builds with identical entry hashes, boundary separation (demo literals 0 client / 1 demo),
   security ownership, focused suites, and D9 = 361,037 ≤ 361,144.
5. **Phase 2B discovery audit** (2026-09-29, read-only) — established that "Phase 2B" is not a repository
   term, that the repository's own next slice is **F2**, and that F2's **code** is already on `main`
   (`d0cfd52`, `8aff3a2`) while its **closure/acceptance pass** is not started.
6. **This backup operation** (2026-09-29) — full-repository bundle (38 refs, complete history), all 87
   documents, the complete WIP state, governance/verification snapshots, and this handoff.

## 4. What has NOT been completed

- **F2 closure/acceptance pass** — not started. `ON` the code side, F2 artifacts exist; on the audit side,
  nothing has been performed. `docs/engineering/F2_REPORT.md` describes the **older
  `arena/frontend-completion-spec` lineage** and must not be read as a closure of the current F2.
- **Unresolved governance items** — see §6 and `GOVERNANCE_STATE.md`: D8/Organization (owner decision),
  D9 (no headroom rule), T-02 (closed to debate, do-not-revisit), I13 (IN PROGRESS), I15 (contradiction),
  I16, I19, I22, O-04, D1, backend authorization, M12.
- **Open repository items** — I2, I4, I5, I7, I8, I10, I11, I14, I16, I17, I18 (partly landed), I20, I22,
  L1, L2, and the DOCUMENTATION DRIFT set.
- **Backend / Laravel** — nothing started; unauthorized.
- **Browser QA** — never performed; no browser verification exists for any surface.
- **CI** — none exists; all evidence is local and method-dependent.

## 5. Current WIP

| Fact | Value |
| --- | --- |
| Branch | `arena/01a0e8ec-parsian-music-dashboard-opus` |
| HEAD | `eb973eb2758447eff16b60ab4fd4c267f9d85061` |
| Tracked modified | **78** files (677 insertions, 674 deletions) |
| Staged | **0** |
| Untracked | **25 porcelain entries = 60 real files** |
| Deleted / renamed | **0** / **0** |
| Ignored files present | **0** |

Backup locations (all inside the pre-F2 backup branch and the Git bundle):

| Artifact | Path in the backup |
| --- | --- |
| Tracked WIP patch (exact, vs HEAD) | `wip/tracked-working-tree.patch` — 133,930 B, sha256 `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f` |
| Staged patch | `wip/staged.patch` — 0 B (nothing staged) |
| Untracked files (verbatim) | `wip/untracked/` — 60 files, 5.0 MB, all byte-identical to source |
| WIP checksums | `wip/checksums.sha256` (73 entries, self-verified) + `wip/WIP_MANIFEST.md` |
| State captures | `wip/state/` (porcelain v1/v2, diff stat/numstat/name-status, untracked list, HEAD, tree, branch, divergence diff) |
| Complete history | `git/bundle/parsian-music-dashboard-full.bundle` (6,229,578 B; `git bundle verify` OK; **38 refs**) |
| All documentation | `docs-snapshot/` (87 files, 2.5 MB) + `docs/DOCUMENTATION_MANIFEST.md` |

**One recorded divergence (preserved, not resolved):** the WIP's untracked
`src/targets/targetFeatures.tsx` (166 lines, sha256 `3ff1c9a1d79b5aac…`) is an **earlier revision** of the
merged `main` file (214 lines, sha256 `d6c7decf9f2dfc71…`); the diff is archived at
`wip/state/targetFeatures-WIP-vs-main.diff`. The other 26 untracked `src/…` files are byte-identical to
`main`. See `WIP_MANIFEST.md` §5.

## 6. Repository governance

Active constraints (full text in `GOVERNANCE_STATE.md` §3):

1. Reopening the frontend freeze for new frontend work requires an **explicit decision**.
2. The §21 preservation gate and every preserved ref/tag/branch stay intact; no history rewrite.
3. **T-02** is ACCEPTED / ASSIGNED-ONLY, fail-closed, and **must not be revisited**; historical
   org-wide-ALLOWED evidence survives only as history.
4. **Backend/Laravel is not authorized**; every server-side enforcement clause stays deferred.
5. **UI hiding is never the security boundary** — enforcement belongs to the (future) service layer.
6. Tests are never weakened, skipped, retimed or "made green"; the **D9 cap is never raised**; budget
   overruns are addressed by splitting, never by moving a threshold.
7. **D8/Organization** is an owner decision; **D9** has no headroom rule; neither may be changed by anyone
   other than the owner.
8. All work happens in disposable clones; the original WIP checkout is read-only input.

## 7. Evidence status

| Gate | Status |
| --- | --- |
| Typecheck (`tsc --noEmit`, 0 errors) | **PASS** (2026-09-28 and 2026-09-29) |
| `build:client` / `build:demo` / bare build | **PASS** — identical entry filenames across both runs |
| Focused Phase 2A + RBAC suites | **PASS** — 37/37, then 90/90 |
| Architecture / mobile contract / projectState | **PASS** — 48/48 and 76/76 |
| Boundary + demo-literals + notice separation | **PASS** |
| **Full suite** | **PASS with one recorded flake** (post-merge run 2: 2563 passed / 2 skipped / 0 failed) and **one ENVIRONMENTAL failure on Tuesdays** (I19) |
| Flaky case | `emptyEnvironmentPanels.test.tsx` → load-sensitive `waitFor(8000)`; **FLAKY**, did not reproduce in the later 4 runs |
| D9 budget | **PASS** — 361,037 / 361,144 → **107 B** headroom; entry 135,153; constants unchanged |
| Bundle usability | **PASS** — verified and cloned from, reproducing `main` exactly |
| WIP integrity | **PASS** — 60/60 byte-identical; patch hash matches the earlier verified backup |
| Browser QA | **NOT RUN / NOT AVAILABLE** |
| CI | **NOT AVAILABLE** (0 workflows) |
| Full suite / typecheck re-run *by this backup* | **NOT RUN** — deliberately, so no green is manufactured |

All rows, with provenance and exact numbers, are in `VERIFICATION_EVIDENCE.md`.

## 8. Open decisions (owner authorization required)

1. **D8 / Organization** — how the organization repository should behave in client mode (keep as-is vs
   align with `DEMO_SERVED_DOMAINS`); no repository document assigns it to any slice.
2. **D9 headroom policy** — whether any rule is wanted for the 107 B headroom; none exists today.
3. **What "Phase 2B" means** — the term is not in the repository; the only candidate the repository names
   is the F2 closure/acceptance pass.
4. **I19 remedy** — a semantic change to a test in the protected scheduling area.
5. **Backend/Laravel authorization** — a precondition for every "B" clause in the F-series.
6. **O-04 accent naming** (PROP-THEME-01) — still undecided.
7. **Freeze reopen decision** — required before any new frontend implementation work.

## 9. Known contradictions (recorded as evidence, not resolved)

1. **I15 status vs I15 code.** `OPEN_ITEMS.md` I15 says *"not authorized, not started"*, while commit
   `eaccbb1` (*"fix(failure-disclosure): M-4 close I15 remaining surfaces"*, 2026-09-18) is an ancestor of
   `main` and `failureDisclosureI15.test.tsx` passes 24 tests. **Both sides are preserved verbatim; neither
   is chosen here.**
2. **F2 "COMPLETE/DELIVERED" vs "F2 is NOT STARTED".** `SESSION_HANDOFF.md` §4b (2026-09-21) records
   F0–F10 COMPLETE/DELIVERED, while the newer live pointer (`PR18_FINAL_SESSION_HANDOFF.md`, 2026-09-27,
   which supersedes §1) says F2 is not started and that `F2_REPORT.md` is a pre-existing report from the
   **older lineage**. The consistent reconciliation is *code delivered / closure pass not started* — it is
   recorded here as an **evidence gap**, not as a resolution.
3. **Historical vs live pointers.** `SESSION_HANDOFF.md` §1's table is explicitly historical and is
   superseded by its own newer blockquotes; current values must always come from `git ls-remote` / the
   handoff files, never from §1.
4. **Documentation drift set.** `gap-matrix.md`, `architecture/data-layer.md`, `production-handoff.md`,
   `architecture/auth.md`, `architecture/environments.md:56–63` are recorded as drifted and were **not**
   "cleaned up".
5. **TargetFeatures divergence.** The WIP's untracked `src/targets/targetFeatures.tsx` is an earlier
   revision than `main`'s; preserved, not reconciled (see §5).
6. **"Phase 2B" naming.** Not a repository term (only binary JPEG matches for "2B"); the repository's own
   sequences are M0–M11 and F0–F10.

## 10. Recovery procedure

All commands are read-only with respect to `main`; never force-push, never rewrite history.

### A. Restoring merged main
```bash
git clone https://github.com/vahidateur/parsian-music-dashboard-opus.git parsian-recovery
cd parsian-recovery
git rev-parse HEAD                       # must be 15775ea9486cb57fbfb8fefa3268658cbe7eb669
git rev-parse HEAD^{tree}                # must be 6eb78338ec19880adf5f97735f61de32e11cbf20
git log -1 --format='%H %P'              # exactly two parents: eb5b559… 2df607e…
```
If GitHub is unavailable, restore from the bundle (§E).

### B. Restoring the tracked WIP
```bash
git checkout --detach eb973eb2758447eff16b60ab4fd4c267f9d85061     # in a DISPOSABLE clone
git apply --check  wip/tracked-working-tree.patch                  # dry-run must be silent
git apply          wip/tracked-working-tree.patch
git diff --shortstat                                               # expect: 78 files changed, 677 insertions(+), 674 deletions(-)
# staged patch is empty; nothing to apply for the index
```

### C. Restoring the untracked WIP
```bash
# copies the 60 files verbatim, structure preserved, into the checkout root
tar -cf - -C wip/untracked . | tar -xf - -C <checkout>
```

### D. Verifying the restored state
```bash
sha256sum -c wip/checksums.sha256                 # 73 entries → all OK
git status --porcelain | awk '{print $1}' | sort | uniq -c   # expect: 78 "M" lines, 25 "??" lines
git rev-parse HEAD                                # eb973eb2758447eff16b60ab4fd4c267f9d85061
sha256sum wip/tracked-working-tree.patch          # aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f
cmp wip/untracked/src/targets/targetFeatures.tsx <worktree>/src/targets/targetFeatures.tsx
```
Optional gate reconstruction (in the restored checkout): `npm ci && ./node_modules/.bin/tsc --noEmit`
(0 errors is the recorded expectation) and `npm run test` (expect the I19 weekday case on Tuesdays).

### E. Recovering from the Git bundle
```bash
# inspect without touching anything
git bundle verify  git/bundle/parsian-music-dashboard-full.bundle     # → "is okay", 38 refs
git bundle list-heads git/bundle/parsian-music-dashboard-full.bundle
# full clone of main from the bundle (no network needed)
git clone -b main git/bundle/parsian-music-dashboard-full.bundle parsian-from-bundle
cd parsian-from-bundle && git rev-parse HEAD        # 15775ea…
# or mirror every ref: branches, tags and PR heads
git clone --mirror git/bundle/parsian-music-dashboard-full.bundle parsian-mirror.git
```

## 11. Next authorized action

**NO IMPLEMENTATION AUTHORIZED BY THIS BACKUP OPERATION.**

The repository's currently identified next candidate is the **"F2 closure/acceptance pass"** — but this
handoff MUST NOT be interpreted as authorization to implement, and no implementation may begin from it
without a new, explicit owner instruction. Specifically, this backup authorizes **nothing**: not F2's
implementation, not F2's closure, not "Phase 2B", not I15, not I19, not I22, not D8, not D9, not backend
work, not a freeze reopen, and not any documentation reconciliation.
