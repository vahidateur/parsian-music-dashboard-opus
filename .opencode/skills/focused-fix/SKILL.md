---
name: Focused Fix
description: Fix one confirmed defect end to end - prove the root cause, make the smallest correct change, add a regression test that fails without the fix, and run focused tests. Use when a bug is reported, a test fails, or behaviour is wrong. Triggers - "fix", "bug", "broken", "regression", "does not work", "fails", "wrong behaviour".
---

# Focused fix

One defect, one slice, one proof. Never expand scope while fixing.

## When to use

- A bug is reported, a test fails, or behaviour is observably wrong.
- **Not** for: a feature, a refactor, or a question you can answer by reading.

## Minimum context to load

1. This skill.
2. `.opencode/specs/testing-acceptance.md` — the acceptance contract.
3. Only the files the defect touches. Find them with `grep`/`glob`, not by listing a
   directory.

Do **not** load `docs/engineering/*` unless the defect is about documented state.

## Procedure

1. **Reproduce.** Run the narrowest thing that shows the defect. If you cannot reproduce
   it, say so and stop — that is an *unresolved question*, not a fix.
2. **Name the mechanism.** Trace the actual path: which component, which call, which
   state. "It looks like a cache issue" is not a mechanism. Point at `file:line`.
3. **Check for the same defect elsewhere.** One grep for the pattern. If the pattern is
   wrong in two places, fix the pattern or report the second site — do not silently
   expand.
4. **Make the smallest correct change.** Reuse the existing domain hook / repository /
   service. No new abstraction for a single call site.
5. **Add the regression test** next to the existing tests for that area. It must fail
   without the fix. When it is cheap, prove it: revert the fix in a scratch copy outside
   the repository and watch the test go red.
6. **Verify** (see below).
7. **Report** in the output format below.

## Commands

```bash
npx vitest run <the test file you touched>            # focused
npx vitest run -t "the new case name"                 # one case
npm run typecheck                                      # exit 0 required
npx tsc -p tsconfig.demo.json --noEmit                 # if a target seam changed
npx tsc -p tsconfig.client.json --noEmit               # if a target seam changed
git status --short                                     # only your files changed
```

Run the full suite (`npm test`) only when a focused run cannot answer the question — and
say why in the report.

## Stop conditions

Stop and report instead of improvising when:

- the root cause cannot be proven from the code or from a reproduction;
- the fix would change product behaviour, an API contract, a permission id, or a
  documented decision → that needs the owner;
- the fix needs an unavailable runtime (PHP, a browser) → report the limit, do not fake it;
- the same defect appears in many places → report the pattern before fixing one instance.

## Definition of done

- [ ] Root cause named, with `file:line`.
- [ ] The regression test exists and fails without the fix.
- [ ] Focused tests green; `npm run typecheck` exit 0.
- [ ] No unrelated file changed (`git status`).
- [ ] No test weakened, skipped or deleted.

## Output format

```
CAUSE      — the mechanism, with file:line
CHANGE     — files touched and what each now does
PROOF      — the test that fails without the fix (what it asserts) + the commands run and their result
LIMITS     — what was not verified, and why
NEXT       — one concrete next action, or "none"
```
