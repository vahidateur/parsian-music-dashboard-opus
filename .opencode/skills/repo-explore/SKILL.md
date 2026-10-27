---
name: Repo Explore
description: Find the code, the owner and the contract for a question without loading the repository into context. Use when locating a feature, a domain, a repository, a permission, a test or the owner of a rule. Triggers - "where is", "find", "which file", "who owns", "how does this work", "locate", "explore the repo".
---

# Repo explore

Answer the question with the fewest possible reads. Context spent on a file nobody needed is
context not spent on the answer.

## When to use

- "Where does X live?" · "Which file owns this rule?" · "How does this flow work?"
- Before any change: find the owner of the behaviour you are about to touch.

## Minimum context to load

1. This skill.
2. `AGENTS.md` — the map (composition, commands, where the truth lives).
3. One spec, **only** if the question is about its subject.

## Procedure

1. **Name the shape of the answer** before searching: a file? a function? a rule? a test?
   A domain? This decides the search.

2. **Search narrow, then read narrow.**

   ```bash
   grep -rn "<symbol or literal>" src/ --include="*.ts" --include="*.tsx"
   glob src/domains/<domain>/**/*.ts
   ```

   Prefer `grep`/`glob` over `ls -R` and over reading whole directories.

3. **Read the smallest useful slice** — the symbol and its neighbours, not the file.

4. **Follow the layering, once.** If the question is "what happens when the user saves a
   teacher", the path is:

   ```
   view (src/views/Teachers.tsx)
     → domain hook (src/domains/teachers/useTeachers.ts)
       → repository interface (src/domains/teachers/repository.ts)
         → implementation (apiRepository.ts | localRepository.ts)
   ```

   The composition root (`src/domains/registry*.ts`) decides which implementation is live.
   Stop at the layer that answers the question.

5. **Find the owner of a rule, not just a mention.** A rule is owned by the gate that
   enforces it: `src/__tests__/architectureBoundaries.test.ts` owns the view boundaries,
   `src/targets/__tests__/targetCopy.test.ts` owns the target-copy parity,
   `src/domains/auth/__tests__/permissionParity.test.ts` owns the permission vocabulary.
   A doc that describes a rule is not its owner.

6. **Delegate the sweep.** For a broad, mechanical search ("where is X mentioned
   everywhere?"), use the `routine` sub-agent — it is read-only and cheap. Keep the
   interpretation for yourself.

## Stop conditions

- The search does not converge in two or three queries → the question is too broad: split
  it, or delegate the sweep.
- Two sources disagree → do not pick one silently. Report both and say which is the
  authority (implementation + tests > `docs/engineering/` > `docs/architecture/` > steering).

## Definition of done

- [ ] The answer names the exact file (and symbol or line).
- [ ] The owner of the rule is identified — code plus the gate that enforces it.
- [ ] The number of files read is proportional to the question.
- [ ] No contradiction left unreported.

## Output format

```
ANSWER     — file:line and what it holds
OWNER      — the code + the gate that enforces it
PATH       — the call/layer path, when the question was "how does it work"
GAPS       — anything not found, or sources that disagree
NEXT       — one concrete next action, or "none"
```
