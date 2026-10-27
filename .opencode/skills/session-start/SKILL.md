---
name: Session Start
description: Start a work session in this repo safely - verify the baseline, load instructions in order, and set up the change discipline before touching any code. Use at the beginning of every session, after a context reset, or when taking over someone else's uncommitted work. Triggers - "new session", "start working", "take over", "fresh session".
---

# Session start

Prove the ground before you build on it. Most agent damage in this repo comes
from assuming the tree state, not from wrong code.

## 1. Baseline (read-only, always first)

1. Record branch, HEAD, and `git status --short` counts (tracked / untracked /
   staged). Do not assume a previous report's numbers — count again.
2. Confirm 0 staged changes. If anything is staged, stop and ask; never unstage
   someone else's work yourself.
3. Check that the dev database container and the API port answer — or record
   which external dependency is down instead of assuming it is up.

Never run `reset`, `clean`, `stash`, `checkout`, `fetch`, `pull`, `push`,
`merge`, or `rebase` unless the owner asked for exactly that in this conversation.

## 2. Load instructions in this order, and no more than you need

1. `AGENTS.md` (non-negotiable rules).
2. The newest `docs/engineering/HANDOFF-*.md` (what the last session proved).
3. `docs/engineering/PROJECT_STATE.md` → `OPEN_ITEMS.md` → `PHASES.md` — **read only**.
4. The single `.opencode/specs/*` and `.kiro/steering/*` file your task needs.
5. The domain code the task touches — grep first, read narrowly.

Protected files — never edit: `PROJECT_STATE.md`, `OPEN_ITEMS.md`, `PHASES.md`.

## 3. Change discipline for the whole session

- One logical change at a time. Prove the root cause before editing; reuse the
  existing domain hook/repository; no business logic in views or components.
- No `localStorage`, `demoStore`, `fetch(`, or hardcoded `http(s)://` in a view
  or component (`architectureBoundaries.test.ts` enforces this).
- The demo/client compositions must never mix: no `if (demo)` in a view, no demo
  data in the client build, unavailable domains resolve to the explicit stub.
- Additive migrations only. No `migrate:fresh`, `db:wipe`, seeds, or resets
  without explicit owner approval in this conversation.
- Failing-first regression test for every behavior change; focused tests first,
  full suite only when a focused run cannot answer the question.

## 4. Honesty and verification

- A success message needs the write behind it. Report what you ran, not what
  you assume. "Browser QA NOT VERIFIED" until it actually happened.
- Never weaken a test, delete a test, or suppress an error to get green.
- Full verification before declaring done: focused suites, the three typechecks,
  and `build:client` when the change touches a target seam.
- End every session with a handoff: branch/HEAD, what changed (files + why),
  verification commands with real results, what is intentionally unfinished,
  and the single most valuable next task.
