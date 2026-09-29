# WIP MANIFEST — the original working checkout, preserved exactly

> Captured 2026-09-29 by the pre-F2 backup operation.
> **The original checkout was read-only input.** No file in it was modified, staged, unstaged, deleted,
> renamed, cleaned or stashed. Every capture below was produced by read-only Git plumbing
> (`git --no-optional-locks diff/ls-files/status`) plus a verbatim file copy.

## 1. Exact identity of the preserved state

| Fact | Value |
| --- | --- |
| Path | `/home/user/parsian-music-dashboard-opus` |
| Branch | `arena/01a0e8ec-parsian-music-dashboard-opus` |
| HEAD | `eb973eb2758447eff16b60ab4fd4c267f9d85061` |
| HEAD tree | `git rev-parse HEAD^{tree}` → recorded in `wip/state/HEAD-tree.txt` |
| HEAD subject | `feat: complete gallery library resource architecture` (2026-09-23) |
| Remote | `origin` → `https://github.com/vahidateur/parsian-music-dashboard-opus.git` (fetch+push) |
| This checkout's branch is **not** the remote branch of the same SHA | remote `refs/heads/arena/01a0cefa-parsian-music-dashboard-opus` = `eb973eb…` (same commit); remote `refs/heads/main` = `15775ea…` |

## 2. Classification of the working-tree state (A–E)

| Class | Count | Evidence | Preservation |
| --- | --- | --- | --- |
| **A. Tracked modified** | **78** | `wip/state/diff-name-status.txt`, `wip/state/diff-stat.txt` | `wip/tracked-working-tree.patch` |
| **B. Staged** | **0** | `git diff --cached --name-only` = 0 | `wip/staged.patch` (0 bytes — the empty file, sha256 `e3b0c442…`) |
| **C. Untracked** | **25 porcelain entries → 60 real files** | `wip/state/untracked-list.txt` | `wip/untracked/` — **actual files**, structure preserved |
| **D. Deleted** | **0** | `grep -c '^D' wip/state/diff-name-status.txt` = 0 | nothing to recover |
| **E. Renamed** | **0** | `grep -c '^R' wip/state/diff-name-status.txt` = 0 | nothing to recover |
| Ignored files present | **0** | `git status --porcelain --ignored` → 0 `!!` entries | none existed |

Tracked modification size: **78 files changed, 677 insertions(+), 674 deletions(-)**.

## 3. Tracked patch — byte-identity with the earlier verified backup

| Artifact | Bytes | sha256 |
| --- | --- | --- |
| `wip/tracked-working-tree.patch` | 133,930 | `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f` |

This hash is **identical** to the previously verified backup patch
(`phase2a-wip-backup/phase2a-tracked.patch`, recorded sha256 `aed92770c1717771…`) — the tracked working
state has not drifted since that backup was made. 78 `diff --git` headers, one per modified file.

`wip/staged.patch` is 0 bytes (sha256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`);
nothing was staged.

## 4. Untracked set — copied verbatim (not placeholders)

60 files, 5.0 MB, copied with structure preserved; every copy verified **byte-identical** to its source
(`cmp` over all 60 paths). Breakdown by top-level path:

| Path | Files |
| --- | --- |
| `src/…` (Phase 2A sources/tests present as untracked: `registry.client.ts`, `registryCore.ts`, `api/deploymentLock.ts`, `domains/demo/delivery.ts`, `targets/*`, their `__tests__`) | 27 |
| `phase2a-wip-backup/…` (earlier backup: `phase2a-tracked.patch`, `untracked-files.tar`, `state/` captures) | 22 |
| `phase2a-landing-artifacts/…` (bundle `phase2a-landing.bundle` 4,458,663 B, manifest, report, `SHA256SUMS.txt`) | 4 |
| root reports: `PHASE_2A_AUDIT_REPORT.md`, `PHASE_2A_DECISION_AUDIT.md`, `PHASE_2A_FINAL_REPORT.md`, `PHASE_2A_LANDING_ANALYSIS.md`, `PHASE_2B_DISCOVERY_AUDIT.md` | 5 |
| `tsconfig.client.json`, `tsconfig.demo.json` | 2 |

Binaries are preserved as files (not text placeholders):
`phase2a-landing-artifacts/phase2a-landing.bundle` (4,458,663 B) and
`phase2a-wip-backup/untracked-files.tar` (215,040 B).

## 5. One recorded divergence — preserved, not resolved

`src/targets/targetFeatures.tsx` exists both as a WIP untracked file and on merged `main`, and the two
copies are **not identical**:

| Version | Lines | sha256 (full) |
| --- | --- | --- |
| WIP untracked (`wip/untracked/src/targets/targetFeatures.tsx`) | 166 | `3ff1c9a1d79b5aacbd360ffdccba7f19b6740c9c3d0fcd8a69299e323f8a4a67` |
| merged `main` (`main:src/targets/targetFeatures.tsx`) | 214 | `d6c7decf9f2dfc710d8fdd20ec3be491113e0fae09455e26a7e3b5f4847e6ce1` |

The WIP copy is an **earlier revision** (it lacks, e.g., the `LoginAssist` credential-panel imports
`useState`/`KeyRound`/`cn` that the merged version carries). The full unified diff is archived at
`wip/state/targetFeatures-WIP-vs-main.diff` (7,824 bytes, 4 hunks). **The merged `main` version is the
authoritative delivered one; the WIP copy is preserved verbatim as history.** No reconciliation is
performed or implied.

For the other 26 untracked `src/…` files: all are **byte-identical** to their `main` counterparts
(verified by `cmp` against `git show main:<path>`), i.e. the Phase 2A work visible in the WIP checkout is
fully contained in the merged `main`.

## 6. State captures (read-only evidence, all preserved)

`wip/state/`: `status-porcelain.txt`, `status-porcelain-v2.txt`, `status-branch.txt`, `diff-stat.txt`,
`diff-numstat.txt`, `diff-name-status.txt`, `untracked-list.txt`, `HEAD.txt`, `HEAD-tree.txt`,
`branch.txt`, `targetFeatures-WIP-vs-main.diff`.

## 7. Integrity

`wip/checksums.sha256` — **73 entries**, one SHA-256 per backed-up WIP file, self-verified with
`sha256sum -c` → **all OK**.

## 8. Restore (short form — full procedure in the handoff §10)

```bash
# tracked changes (worktree vs HEAD)
git -C <checkout> apply --check  wip/tracked-working-tree.patch   # dry-run first
git -C <checkout> apply          wip/tracked-working-tree.patch
# untracked files
tar -cf - -C wip/untracked . | tar -xf - -C <checkout>
# verify
sha256sum -c wip/checksums.sha256
```

> **Statement of non-modification:** the original working checkout's `git status --porcelain` output was
> captured before the operation (`/tmp/wip-status-before.txt`, 103 lines) and compared byte-for-byte after
> it (see the handoff and `BACKUP_MANIFEST.md`) — identical. No operation wrote to that checkout.
