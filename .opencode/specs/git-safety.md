# Spec — Git & repository safety

**Status:** CURRENT · **Authority:** `.kiro/steering/09_GIT_GOVERNANCE.md` +
`docs/engineering/SESSION_HANDOFF.md` (the live branch/checkpoint record) +
`opencode.json` (the enforced permissions).

## Standing rules (the owner's, not mine)

1. **Never publish.** No `git push`, no force-push, no PR, no tag — unless the owner says so
   in that same conversation. `opencode.json` denies `git push*` at the tool level; removing
   that one line is an explicit, owner-approved change.
2. **Never change history.** No `reset --hard`, `rebase`, `clean -f`, `filter-branch`,
   `checkout -- .`, or amend. Denied at the tool level.
3. **Never commit, stage, stash or clean unless asked.** `git commit*`, `git add*` and
   `git merge*` ask first. Stage specific paths — never `git add .`.
4. **Never discard working-tree state.** A modified or untracked file is someone's work
   until proven otherwise. `.kiro/settings/` and everything under `src/` that is not yours
   is off-limits.
5. **Never run destructive database operations** — `migrate:fresh`, `db:wipe`, seeds,
   resets — without explicit owner authorization, in any environment.
6. **Never modify git config** and never skip hooks (`--no-verify`).

## Reading state safely

```bash
git status -sb                          # branch, ahead/behind, short status
git log --oneline @{u}..HEAD            # commits not on the upstream
git merge-base --is-ancestor @{u} HEAD  # would a push be a fast-forward?
git diff --name-only                     # files that really differ (content, not line endings)
git ls-files -s <path>                  # the index blob for a path
```

`git diff` compares content; `git status` also consults a cached stat. On a tree whose
index was built elsewhere they can disagree — trust `git diff` for content and refresh the
stat cache (`git add --refresh .`) rather than assuming files changed.

## Line endings are load-bearing for the dataset

Measured on 2026-10-29 with `git ls-files --eol` (re-measure; it differs per checkout):

- There is **no root `.gitattributes`** (only `backend/.gitattributes`, `* text=auto eol=lf`),
  and `core.autocrlf` / `core.eol` are unset.
- `data/dataset/*`: 37 files, LF in the index **and** the working tree. No drift.
- 32 tracked files are **committed with CRLF** (`i/crlf w/crlf`): `.kiro/settings/cli.json`
  and 31 files under `src/` (components, domain panels, `src/targets/*`, ten views). They
  are not drift, and `git status` is clean for them. Keep each file's existing ending when
  you edit it; converting one rewrites every line in the diff.

The hazard is conditional but real. `data/dataset/*` is byte-hashed by
`data/dataset/manifest.json`, so a checkout that turns it into CRLF (a clone with
`core.autocrlf=true`, for example) fails the artifact gate (`MEMBER_HASH_MISMATCH`, and the
seed's embedded document differs in length), and `git status` then lists many files as
modified. Check with `git ls-files --eol data/dataset` — expect `i/lf w/lf` throughout.

Fixing a converted checkout is a working-tree operation only: restore the **committed
bytes** for files proven to be CRLF-only copies of their HEAD blob. Do not add a root
`.gitattributes` and do not run `git add --renormalize` without an owner decision — those
change tracked files.

## Branch and checkpoint model

- The canonical branch and the live tip are recorded in `docs/engineering/SESSION_HANDOFF.md`
  and `docs/engineering/CONSOLIDATION_CHECKPOINT.md`. **A document never carries its own
  SHA** — read the tip with `git log -1 --format=%H`.
- `main` is the release line; the arena branch is the working line. Merging to `main` is a
  fast-forward that requires the owner's explicit decision.
- `src/__tests__/projectState.test.ts` asserts the recorded checkpoints are real Git
  objects and that the working branch is level with its remote — a local branch ahead of
  its upstream fails that gate by design. It also fails on a tag-less clone (fetch tags and
  all heads).

## If the sandbox moves HEAD

The documented, non-destructive recovery is: manifest → `git stash --include-untracked` →
`git merge --ff-only` → verify. Never reset, clean, rebase or cherry-pick to "fix" it.
Prove the situation first with blob hashes, not with a diff of a moving target.

## Unresolved

- Local `main` (`eb5b559`) and `local/main-sync` (`b9b1d87`) differ from each other and from
  `origin/main`, which has moved on (2026-10-29: `main` 120 commits behind, `local/main-sync`
  1 ahead and 166 behind; `git ls-remote origin main` gives the live tip — do not freeze it
  here). Every commit on both local branches is reachable from a remote ref or tag.
  Pre-existing; leave alone unless the owner asks.
- No CI workflow covers `src/` — the only workflow is `.github/workflows/backend-tests.yml`
  (`backend/**` only). A frontend regression can pass CI unnoticed.
