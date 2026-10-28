---
name: Git Audit
description: Read-only audit of the working tree, the branch, the upstream and the unpublished commits - what changed, what is local-only, what a push would do, and what is at risk. Use before any commit or publish decision, when asked about git state, or to check that nothing was staged. Triggers - "git status", "what changed", "uncommitted", "ahead of", "ready to push", "audit the repo".
---

# Git audit

Read-only by design. This skill never stages, commits, pushes, resets, cleans or stashes —
it produces the evidence a human uses to decide.

## When to use

- Before a commit or publish decision.
- When asked for the repository state, or whether something is safe to push.
- After a bulk working-tree operation, to prove nothing was lost.

## Minimum context to load

1. This skill.
2. `.opencode/specs/git-safety.md` — the standing rules and the line-ending hazard.
3. `docs/engineering/SESSION_HANDOFF.md` — only if the audit concerns the canonical branch
   or checkpoints.

## Procedure

1. **Identity and position.**

   ```bash
   git rev-parse --abbrev-ref HEAD      # branch
   git rev-parse HEAD                    # tip
   git rev-parse @{u}                    # upstream tip
   git status -sb | head -1              # ahead/behind
   ```

2. **What is local-only.**

   ```bash
   git log --oneline @{u}..HEAD          # commits not on the upstream
   git merge-base --is-ancestor @{u} HEAD && echo "fast-forward" || echo "diverged"
   ```

3. **What changed in the working tree.** Use `git diff` for content — `git status` also
   consults a cached stat and can disagree on a tree whose index was built elsewhere.

   ```bash
   git diff --name-only                  # files that really differ
   git diff --stat                       # size of the change
   git diff --cached --name-only         # staged (must be empty unless asked)
   git status --short | grep '^??'       # untracked
   ```

4. **Classify the working tree.** For every modified file, decide: *genuine edit* or
   *line-ending-only copy of the committed blob*. Prove it by content, not by eye:

   ```bash
   git diff --ignore-cr-at-eol --numstat   # 0/0 rows are line-ending-only
   ```

   Never discard a file you have not classified.

5. **Check the remote without writing to it.**

   ```bash
   GIT_TERMINAL_PROMPT=0 git ls-remote origin refs/heads/<branch>
   ```

   Read-only. If it needs credentials, report that the remote state is unverified rather
   than asking for a token.

6. **Check the gates that read Git state.** `src/__tests__/projectState.test.ts` asserts
   the recorded checkpoints are real objects and that the branch is level with its remote —
   a local branch ahead of its upstream fails it by design. Do not "fix" that test.

## Stop conditions

- Anything in the tree you cannot classify → report the file, do not touch it.
- The upstream is not an ancestor of HEAD → a push would need a force or a merge. Report
  it; do not push either way.
- The remote is unreachable → report the upstream state as unverified.

## Definition of done

- [ ] Branch, HEAD, upstream and ahead/behind stated.
- [ ] Local-only commits listed with subjects.
- [ ] Modified / staged / untracked counted and classified.
- [ ] Push safety stated: fast-forward, diverged, or unverified — and **nothing pushed**.

## Output format

```
BRANCH     — branch, HEAD, upstream, ahead/behind
LOCAL ONLY — commits not on the upstream (sha + subject)
TREE       — modified / staged / untracked, and the classification of the modified set
PUSH       — fast-forward | diverged | unverified, and what a push would do
RISKS      — anything at risk (unclassified files, stat-cache drift, credential failure)
NEXT       — one concrete next action for the owner, or "none"
```
