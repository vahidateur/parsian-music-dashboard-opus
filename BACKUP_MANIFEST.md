# BACKUP MANIFEST — pre-F2 preservation

> Generated 2026-09-29T00:31:20Z (UTC) by the pre-F2 backup operation.
> Scope: **preservation only** — no product implementation, no governance change, no test change.

## Identity

| Field | Value |
| --- | --- |
| Repository | `https://github.com/vahidateur/parsian-music-dashboard-opus` |
| Backup timestamp | 2026-09-29T00:31:20Z (UTC) |
| Source HEAD (WIP checkout) | `eb973eb2758447eff16b60ab4fd4c267f9d85061` on `arena/01a0e8ec-parsian-music-dashboard-opus` |
| `main` SHA (verified live) | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` |
| `main` tree SHA | `6eb78338ec19880adf5f97735f61de32e11cbf20` |
| Phase 2A branch | `arena/phase2a-landing` @ `2df607eff5f1ea1fe85e86381b9b0398fec81d18` (unmoved) |
| Backup branch | `backup/pre-f2-2026-09-29` (backup artifacts only; `main` untouched) |

## Artifacts

| Artifact | Path in the backup | Size | Files | SHA-256 |
| --- | --- | --- | --- | --- |
| Git bundle (complete history, all branches/tags/PR refs) | `git/bundle/parsian-music-dashboard-full.bundle` | 6,229,578 B | 38 refs | `ef6b614c61effa5f7d3a31ceece8be1df7f833825b01348210920dac3ecfcb2d` |
| Tracked WIP patch (exact, vs HEAD) | `wip/tracked-working-tree.patch` | 133,930 B | 78 file headers | `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f` |
| Staged patch (nothing was staged) | `wip/staged.patch` | 0 B | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Untracked snapshot (verbatim copies) | `wip/untracked/` | 5,090,244 B | 60 | `wip/checksums.sha256` |
| Documentation snapshot (paths preserved) | `docs-snapshot/` | 2,346,984 B | 87 | `docs/DOCUMENTATION_MANIFEST.md` + `SHA256SUMS.txt` |
| Git metadata (refs/branches/tags/log/topology/SHAs/remotes) | `git/` | 6,321,636 B | 9 | `SHA256SUMS.txt` |
| WIP state captures | `wip/state/` | — | 11 | `wip/checksums.sha256` |
| Handoff | `docs/session-handoffs/PRE_F2_BACKUP_HANDOFF.md` | — | 1 | `SHA256SUMS.txt` |
| WIP manifest / governance / evidence | `wip/WIP_MANIFEST.md`, `GOVERNANCE_STATE.md`, `VERIFICATION_EVIDENCE.md` | — | 3 | `SHA256SUMS.txt` |

## Counts

| Measure | Value |
| --- | --- |
| Tracked modified | **78** (677 insertions, 674 deletions) |
| Staged | **0** |
| Untracked | **60 real files** (25 porcelain entries) |
| Deleted | **0** |
| Renamed | **0** |
| Ignored files present | **0** |
| Documentation captured | **87** documents (2,346,984 bytes) |
| WIP files checksummed | **73** |
| Backup artifacts total | see `SHA256SUMS.txt` |

## Verification results

| Check | Result |
| --- | --- |
| `git bundle verify` | **PASS** — "is okay", "records a complete history", 38 refs |
| Recovery clone **from the bundle** | **PASS** — `main` = `15775ea…`, tree `6eb78338…`, exactly 2 parents, clean tree, not shallow |
| Phase 2A range `eb5b559..main` | **PASS** — 4 commits (3 Phase 2A + merge), 103 files, +3453/−685 — no unexpected commits |
| WIP untracked byte-identity | **PASS** — 60/60 files byte-identical to source (`cmp`) |
| WIP tracked patch vs earlier verified backup | **PASS** — sha256 `aed92770…` identical to `phase2a-wip-backup/phase2a-tracked.patch` |
| WIP checksums self-verify | **PASS** — `sha256sum -c wip/checksums.sha256` → 73 × OK |
| WIP untracked `src/…` vs merged `main` | 26 byte-identical · **1 divergent** (`src/targets/targetFeatures.tsx`, preserved, diff archived) |
| Original checkout unmodified | **PASS** — `git status --porcelain` identical before/after (103 lines; 0 staged; HEAD `eb973eb`) |
| `main` / Phase 2A branch unchanged | **PASS** — live `ls-remote` re-check |
| Full test suite re-run by this backup | **NOT RUN** (deliberately — no green manufactured; prior evidence preserved in `VERIFICATION_EVIDENCE.md`) |

## Explicitly not backed up (and why)

| Item | Reason |
| --- | --- |
| `node_modules/`, `dist/` | Not present in the original checkout (`0` ignored entries); reproducible from `package.json` + source |
| Secrets/credentials | None exist in the repository; no credential file was read or copied |
| GitHub PR discussion/reviews | Not repository content; the PR head refs **are** in the bundle (`refs/pull/*/head`, 20 refs) |
| CI artifacts | None exist — the repository has **0 workflows** |

## Authoritative statement

> **Backup is a preservation artifact. It does not authorize implementation.**

Nothing in this backup grants permission to start F2, implement Phase 2B, fix I15 or I19, resolve D8,
change D9, alter governance, touch backend/Laravel, reopen the freeze, or modify tests or source.
The next agent must begin from the handoff and these artifacts — not from conversation history or assumptions.

