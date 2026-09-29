# PR #18 pre-merge conservation record

**Status: written before PR #18 was merged, as the last commit carried by it.**

This document is *not* about what PR #18 built — [`PR18_FINAL_SESSION_HANDOFF.md`](PR18_FINAL_SESSION_HANDOFF.md)
in this same directory is, and remains the authority for that. This document records the
**Git-object consequences** of merging and eventually deleting the branch, so that a session arriving
after the merge can tell, without the conversation that produced it, what is durable, what was parked
on purpose, and where to start.

Preservation, not cleanup: **no branch is to be deleted to produce this record.**

Everything below was measured against GitHub through `gh api` (authoritative) and against a
**complete** (non-shallow) clone, not against a shallow sandbox `.git`.

---

## 1. Identity at audit time

| Fact | Value |
| --- | --- |
| `main` at audit time | `8e6bce95883f7ef17b69a110c0b309d54e40811d` |
| PR #18 head (G-7 implementation) | `096723bfc7c917b3e3fee940877a63823b5a8fd4` |
| PR #18 base | `8e6bce95883f7ef17b69a110c0b309d54e40811d` |
| PR #18 state at audit time | **open, not merged, not draft**, `mergeable=true`, `mergeStateStatus=CLEAN` |
| Lineage | `8e6bce9 → 096723b`, each commit **one parent** |
| Commits on the branch | 1 implementation commit + 1 documentation-only commit (this file and its sibling) |

`main` is an ancestor of the PR head, so a fast-forward would be possible — but see §3.

---

## 2. What is durable, and where it survives

**Merging does not destroy any of the following.** Every preserved ref below exists on GitHub
independently of PR #18 and must still exist after the merge:

| Ref | Tip | Why it is preserved |
| --- | --- | --- |
| `arena/01a0b059-parsian-music-dashboard-opus` | `251af96` | §21 preserved tip (not an ancestor of `main`) |
| `handoff/arena-frontend-pre-backend` | `94d32de` | §21 preserved tip (not an ancestor of `main`) |
| `arena/01a0cefa-parsian-music-dashboard-opus` | `eb973eb` | §21 preserved tip (not an ancestor of `main`) |
| `arena/01a0c8b5-parsian-music-dashboard-opus` | `bb275d6` | §21 preserved tip (not an ancestor of `main`) |
| `arena/01a0c8a7-parsian-music-dashboard-opus` | `7180082` | §21 preserved tip (not an ancestor of `main`) |
| `arena/01a0c480-parsian-music-dashboard-opus` | `afe6b02` | §21 preserved tip (not an ancestor of `main`) |

All six carry an `archive/*` tag pointing at the **same** commit:

`archive/frontend-session-handoff-94d32de`, `archive/gallery-library-storage-eb973eb`,
`archive/mountain-sanctuary-bb275d6`, `archive/palette-focus-251af96`,
`archive/premium-academy-login-afe6b02`, `archive/project-state-gate-7180082`.

> **A tag on a branch tip does not make the branch safe to delete.** Each of these six branches is
> the *only* ref reaching its tip. Deleting one would strand that tip, and the §21 exemption that
> `projectState.test.ts` relies on is written in terms of the **branch**, not the tag. **Do not
> delete any of the six.**

Two further SHAs quoted by the state documents — `33b10311…` and `a3867a60…` — were verified to be
**ancestors of `main`**, so they are reachable without any of the above.

---

## 3. Merge policy — use a merge commit

`main`'s recent history is a chain of **merge commits**:

```
8e6bce9  Merge PR #17: F1 audit closure (G-1…G-6 closed, G-7 OPEN, Browser QA NOT VERIFIED)
4edd0bc  ← PR #16 merge commit
6c9aa4c  ← PR #15 merge commit
```

PRs **#15, #16 and #17 all merged as merge commits** (`mergeCommit` set on each). The repository's
established policy is therefore **merge commit** — `gh pr merge --merge`, **not** squash and **not**
rebase. Squash would rewrite the 11-file diff into one commit and destroy the per-file history this
project's governance documents cite; rebase would rewrite published history. **Use `--merge`.**

A merge commit is also what makes the post-merge audit unambiguous: `main` moves to a new commit
that is neither the old tip nor the branch tip, and the branch remains a resolvable SHA afterwards.

---

## 4. What happens if the branch is later deleted

Once PR #18 is merged, `arena/01a0e006-parsian-music-dashboard-opus` is redundant. If a future
session deletes it, **these become the only references to the G-7 work**, and all of them are
reachable from `main` after the merge:

- the G-7 diff itself (recoverable as `git log main` / `git show` on the merge)
- `DECISIONS.md` **§24** — the approved product/data-model decision
- `F1_REPORT.md` §"G-7 — CLOSED"
- [`PR18_FINAL_SESSION_HANDOFF.md`](PR18_FINAL_SESSION_HANDOFF.md) — this directory's durable record
- this conservation record

**Deleting the branch is safe only after the merge is confirmed on `main`.** It is not required, and
it is not authorized by this document.

---

## 5. SHAs that must never be cited

| SHA | Why |
| --- | --- |
| `7246f76` | **Unrecoverable.** The sandbox re-cloned mid-session and the re-clone replaced `.git`, destroying the object. The work was recovered from the working tree and recommitted as `096723b`, verified byte-identical (`+639 / −39`). It was never pushed. **Do not cite it as pushed or merged.** |
| `a3867a6`, `33b10311` | Abbreviated digests used inside `DECISIONS.md` §24, which is scanned for 40-hex SHAs. They are **ancestors of `main`** and are cited deliberately in short form. |

---

## 6. The environment trap that cost this session a false defect report

The sandbox was re-cloned **shallow and tag-less**. In that state
`src/__tests__/projectState.test.ts` reported failures — because it verifies that every SHA quoted in
the state documents is *reachable*, and a shallow clone cannot resolve older ones.

Those failures were an **environment artifact, not repository state**, and an earlier working state of
this session mistakenly recorded them as "3 pre-existing failures". In a **complete** clone the test
is `52/52`, identically with and without the G-7 change.

**If a future session sees `projectState` fail, check this first:**

```bash
[ -f .git/shallow ] && echo "SHALLOW — repair, do not edit the test" && git fetch --unshallow --tags --all
```

**Never** weaken `projectState.test.ts` to make a shallow clone pass. The gate is genuinely
satisfied on the real repository.
