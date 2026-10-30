# Spec — Git & repository safety

**Status:** CURRENT · **Authority:** `.kiro/steering/09_GIT_GOVERNANCE.md` +
`docs/engineering/SESSION_HANDOFF.md` (the live branch/checkpoint record) +
`opencode.json` (the enforced permissions).

## Standing rules (the owner's, not mine)

Enforcement has **three distinct layers** — never describe one as another:

- **TOOL-ENFORCED** — `opencode.json` `permissions` block the command outright (`deny`) or
  force a prompt (`ask`). Verified against the effective config on 2026-10-31.
- **INSTRUCTION-ONLY** — this spec and `.kiro/steering/09_GIT_GOVERNANCE.md` forbid it, but
  **no mechanism blocks it**. An agent following its instructions will not run it; a
  misbehaving one could. Never claim tool-level protection for these.
- **HUMAN APPROVAL** — an owner decision in the same conversation, enforced only by review.

1. **Never publish.** No `git push`, no force-push, no PR, no tag — unless the owner says so
   in that same conversation. **TOOL-ENFORCED (deny):** `git push*`. Removing that line is an
   explicit, owner-approved change.
2. **Never change history.** `reset --hard`, `rebase`, `clean -f` and `filter-branch` are
   **TOOL-ENFORCED (deny)**. `checkout -- .`, `git restore`, plain `git reset` (mixed),
   `git commit --amend`, `git branch -D`, `git tag` and `git stash` are **INSTRUCTION-ONLY**:
   no `opencode.json` rule covers them (corrected 2026-10-31 — an earlier revision of this
   spec claimed they were denied at the tool level). Never present them as guarded.
3. **Never commit, stage, merge or clean unless asked.** **TOOL-ENFORCED (ask):**
   `git commit*`, `git add*`, `git merge*`. **INSTRUCTION-ONLY:** `git stash`, `git clean`
   (non-`-f` forms), `git checkout`/`git switch` (branch switching), `git cherry-pick`,
   `git tag`. Stage specific paths — never `git add .`.
4. **Never discard working-tree state.** A modified or untracked file is someone's work
   until proven otherwise. `.kiro/settings/` and everything under `src/` that is not yours
   is off-limits. File-level `edit` protection exists only where `opencode.json` carries an
   explicit rule (today: `docs/governance/**` requires approval). Everything else is
   unprotected at the tool level, and **no `read`/`edit` rule can stop an equivalent `bash`
   command** — `cat`, `sed -i` and `tee` are matched as commands, not by their target paths.
5. **Never run destructive database operations** — `migrate:fresh`, `db:wipe`, seeds,
   resets — without explicit owner authorization, in any environment. Enforcement is the
   Kiro hook `.kiro/hooks/block-destructive-db-commands.kiro.hook` (a prompt-to-agent
   mechanism), **not** an `opencode.json` rule; treat it as instruction-grade.
6. **Never modify git config** and never skip hooks (`--no-verify`). **INSTRUCTION-ONLY** —
   no tool-level rule exists for either.

## Local setup after clone (why the tool layer may be absent)

The published repository ships **no** `opencode.json` and no `skills-lock.json`: both are
local-only and ignored. A fresh clone therefore has **instruction-only** guidance and **no**
tool-level enforcement until the contributor adds their own untracked configuration.

- Create your own `opencode.json` in the repository root. It is per-developer, ignored, and
  never committed — for example a `deny` on `git push*`, `ask` on
  `git commit*` / `git add*` / `git merge*`, and any read/edit rules you want for your
  workspace.
- `skills-lock.json` is written by local skill installation and is equally local-only.
- The TOOL-ENFORCED statements below hold **only while that configuration exists and is
  loaded**; confirm against the effective configuration before claiming protection.
- Whatever the configuration says, the **HUMAN APPROVAL** rules above are unchanged.
- Never place credentials, personal plugin lists or machine-specific paths in tracked files.

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

## Line endings are a live hazard here

This checkout was created with CRLF working-tree files while the committed blobs are LF.
Consequences that are **not** cosmetic:

- `data/dataset/*` is byte-hashed by `data/dataset/manifest.json` → a CRLF checkout fails
  the artifact gate (`MEMBER_HASH_MISMATCH`, and the seed's embedded document differs in
  length).
- `git status` then shows hundreds of files as modified.

Fixing it is a working-tree operation only: restore the **committed bytes** for files proven
to be CRLF-only copies of their HEAD blob. Do not add a root `.gitattributes` and do not run
`git add --renormalize` without an owner decision — those change tracked files.

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
  remote `main` (`15775ea`). Pre-existing; leave alone unless the owner asks.
- No CI workflow covers `src/` — the only workflow is `.github/workflows/backend-tests.yml`
  (`backend/**` only). A frontend regression can pass CI unnoticed.
