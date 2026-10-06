---
inclusion: always
---

# 09 — GIT GOVERNANCE

> Preserves legacy `14_GIT.md` and the user's standing branch/HEAD constraints. **CURRENT.**

## Commits (CURRENT)

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`, `perf:`, `test:`.
- Title < 70 chars, English, descriptive; detail in the body; one logical change per commit.
- **Commit only on explicit owner request.** Do not create a commit otherwise.
- Stage specific files by name — never a blind `git add .`. Never commit secrets (`.env`,
  credentials). Keep `.gitignore` current.

## Branch & history safety (CURRENT — standing constraints)

- Push to a new branch, never directly to `main`/`master` unless explicitly asked.
- **Never** force-push, `reset --hard`, `rebase`, `clean -f`, `merge`, `cherry-pick`, or rewrite
  history without explicit permission. Never modify git config. Never skip hooks (`--no-verify`).
- The sandbox has previously reverted the local HEAD pointer; recovery must be **non-destructive**
  (manifest → stash --include-untracked → merge --ff-only → verify), never reset/clean/rebase
  (`docs/engineering/SESSION_HANDOFF.md`). A tag-less clone fails `projectState.test.ts`'s
  preserved-branch gate — fetch tags and all heads.

## Current canonical line (CURRENT — reference, do not act on it)

The canonical branch and reconciliation state are recorded in `docs/engineering/SESSION_HANDOFF.md`,
`PROJECT_STATE.md`, and `CONSOLIDATION_CHECKPOINT.md` (two-line reconciliation; both lines preserved;
`main` untouched; `DECISIONS.md` §32). Read those for the live tip; a document never carries its own SHA.
