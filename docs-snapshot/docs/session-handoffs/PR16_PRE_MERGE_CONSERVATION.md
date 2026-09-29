# PR #16 pre-merge conservation record

**Status: written immediately before PR #16 was merged, as the last commit carried by it.**

This document is *not* about what PR #16 built — `PR16_FINAL_SESSION_HANDOFF.md` in this same
directory is, and remains the authority for that. This document records the **Git-object
consequences** of merging and eventually deleting the branch, so that a session arriving after
the merge can tell, without the conversation that produced it, what is durable, what was parked
on purpose, and where to start. Preservation, not cleanup: **no branch was deleted to produce
this record.**

Everything below was measured against GitHub through `gh api` (authoritative), not against the
session sandbox's `.git`, which is shallow, single-refspec and reports a stale HEAD.

---

## 1. Identity at audit time

| Fact | Value |
| --- | --- |
| `main` at audit time | `6c9aa4ccdc3e0a36d7bf3ff1d05d5c6e2149ccbc` |
| PR #16 head | `648d5802c8c0408d6031001bc3e4fe483b95acd5` |
| PR #16 base | `6c9aa4ccdc3e0a36d7bf3ff1d05d5c6e2149ccbc` |
| PR #16 state at audit time | open, not merged, not draft, `mergeable=true`, no auto-merge |
| Lineage | `6c9aa4c → ac91864 → 8fa81a1 → 648d580`, each commit **one parent** |
| Commits outside `main` | 7 (3 of them are PR #16's own) |
| Branches / tags / PR head refs | 20 / **0 at audit time** / 16 |
| Drift during the audit | 0 of 20 branch tips moved |

The lineage has no merge commit and no rebase, so PR #16 fast-forwards. `6c9aa4c` itself is the
two-parent merge of PR #15; that is `main`'s history, not this PR's.

**Consequence of carrying this document:** this file's own commit is a child of `648d580` on
`arena/01a0daeb-parsian-music-dashboard-opus`. A document cannot quote the SHA of the commit that
carries it, so after the merge the SHAs to trust are *this branch tip* and *`main` after the
merge*, not `648d580` as a terminal value. `648d580` stays correct as the identity of the
three commits that were under review.

Path-scoping note: this file lives under `docs/session-handoffs/`. The governance gate's doc
scans (`src/__tests__/projectState.test.ts`) are bounded to `REQUIRED_DOCS` —
`PROJECT_STATE.md`, `PHASES.md`, `DECISIONS.md`, `OPEN_ITEMS.md` in `docs/engineering/` — so full
40-character SHAs appear here deliberately, because an archive ref is only useful if it can be
quoted exactly. The registers' no-raw-SHA rule is unchanged and still binds them.

## 2. What survives the merge, commit by commit

| Commit | Held by | After merge | Durable ref created |
| --- | --- | --- | --- |
| `ac91864` `8fa81a1` `648d580` (+ this doc's commit) | PR branch, `refs/pull/16/head` | **ancestors of `main`** | none needed |
| `eb973eb2758447eff16b60ab4fd4c267f9d85061` | `arena/01a0cefa…` only | orphaned by branch deletion | `archive/gallery-library-storage-eb973eb` |
| `251af96f405df5935ee17ddc9ba6b490f7989c2d` | `arena/01a0b059` only | orphaned | `archive/palette-focus-251af96` |
| `7180082fac85f4451ac8e7d2ed1312a26bcfb486` | `arena/01a0c8a7` only | orphaned | `archive/project-state-gate-7180082` |
| `bb275d6c8063a3ca34eb3a24c0539e43ea991182` | `arena/01a0c8b5` only | orphaned | `archive/mountain-sanctuary-bb275d6` |
| `94d32de3220cee314606c0c4705e20e0fdcfb2af` | `handoff/arena-frontend-pre-backend` only | orphaned | `archive/frontend-session-handoff-94d32de` |
| `afe6b02` (+ its parent `b9b1d87`) | `arena/01a0c480` **and** `refs/pull/13/head` | survives via the PR ref | **deliberately none** (see §5) |

Containment was decided by *true ancestry* — `compare/{every branch tip}…{sha}` and
`compare/{every PR head}…{sha}` over 6 commits × 36 refs — and not by
`commits/{sha}/branches-where-head`, which only reports branches sitting at or near the commit and
therefore under-reports containment. A commit reported "held by one branch only" here is held by
nothing else in the repository.

## 3. Tree of PR #16 against `main`

At `648d580` the tree holds 543 blob paths against `main`'s 538: **five additions, zero removals** —
`src/domains/resources/components/ResourcePreview.tsx`, its test,
`src/domains/auth/__tests__/roleTransition.test.tsx`,
`src/views/__tests__/libraryDocumentPreview.test.tsx`, and `PR16_FINAL_SESSION_HANDOFF.md`.
This file is the sixth path the branch adds.
The review-fix pair is intact and unmodified at head (component blob `7ff3640`, test blob
`439cb0a`), and `src/__tests__/projectState.test.ts` at head is blob `a1e8513` — **identical to
`main`'s**, i.e. this PR does not touch the governance gate. `DECISIONS.md` §23 is present;
`docs/engineering/SESSION_HANDOFF.md` points at `PR16_FINAL_SESSION_HANDOFF.md`.

## 4. `eb973eb` — parked architecture, not stale debris

Held by `arena/01a0cefa-parsian-music-dashboard-opus` ("feat: complete gallery library resource
architecture", co-authored with arena-agent), merge-base `ece060de`, **ahead 1 / behind 18** of
`main`. Measured at blob level against `main`:

* **14 paths absent from `main`** — `domains/resources/{types.ts, README.md,
  __tests__/access.test.ts}`, `domains/media/{storage.ts, storageEstimate.ts,
  __tests__/storageEstimate.test.ts}`, `components/gallery/{GalleryAlbumManager, GalleryLightbox,
  GalleryUploader}.tsx` + its test, `components/library/{LibraryAudioPlayer.tsx}` + its test,
  `components/navigation/ModuleRail.tsx`, `domains/auth/__tests__/roleTransition.test.tsx`.
* **20 paths differ** — both learning/progress domain areas, both demo seeds, `library/types.ts`,
  `media/types.ts`, `views/Gallery.tsx`, `views/Library.tsx`, `auth/permissions.ts`,
  `auth/AuthContext.tsx`, `vite.config.ts`.
* **0 paths identical to `main`** — the divergence is per-file and per-blob, so "already merged"
  is false for this branch as a whole.

Redundancy is real but narrow: `auth/AuthContext.tsx` at `eb973eb` is blob `c04479e`, **byte-identical
to the version PR #16 ships**, so that one file becomes redundant after the merge. `permissions.ts`
(`f40092d` at `eb973eb` vs `6d78fa8` at head) and `roleTransition.test.tsx` (`bac2bbc` vs `e848583`)
are independent variants with the same intent — not interchangeable, and not to be "tidied" into
one another.

**Security-sensitive deviation, recorded and still excluded:** `vite.config.ts` `72f80d0` →
`5c65432`, which removes `"X-Frame-Options": "DENY"` from Vite's *dev-server* headers, replaced by a
comment arguing the edge servers still send it. That argument is factually true —
`deploy/nginx.conf` and `deploy/Caddyfile` each set `X-Frame-Options "DENY"` and CSP
`frame-ancestors 'none'; frame-src 'none'; object-src 'none'` — and the change is nonetheless
**dev-server-only, never approved, and never merged**. `main` and PR #16 keep `72f80d0`. Do not
re-derive this from the comment alone, and do not fold it into a later PR as drive-by cleanup.

> **Merging PR #16 does not end this WIP.** It remains a reachable, tagged alternative architecture.
> Disposition: **PARKED / NOT MERGED / NOT PART OF PR #16 / NOT DELETED.**

## 5. Durable refs

Created, as lightweight tags (`refs/tags/archive/…` → commit directly, so any ref-to-SHA check is
unambiguous; annotated tag objects were deliberately avoided):

| Tag | Commit | Why it must not be left branch-only |
| --- | --- | --- |
| `archive/palette-focus-251af96` | `251af96f405df5935ee17ddc9ba6b490f7989c2d` | gate-pinned (§6); its `CommandPalette` test blob `49c5a9d` is already on `main`, but the *commit object* is what the test demands |
| `archive/project-state-gate-7180082` | `7180082fac85f4451ac8e7d2ed1312a26bcfb486` | holds a 75 142-byte `projectState.test.ts` (blob `20c1885`) that no commit on `main`'s history ever had (today's gate is 30 635 bytes, `a1e8513`) — the gate's own evolution is unique content |
| `archive/mountain-sanctuary-bb275d6` | `bb275d6c8063a3ca34eb3a24c0539e43ea991182` | unique binaries: `login-portal.webp` `db74a88`, `login-portal-sm.webp` `a5b5f1a`, exist nowhere else; both redesign branches delete `login-stage.jpg` `b20167f` that `main` keeps |
| `archive/gallery-library-storage-eb973eb` | `eb973eb2758447eff16b60ab4fd4c267f9d85061` | the intentionally excluded architecture (§4) — 14 paths nothing else in the repository contains |
| `archive/frontend-session-handoff-94d32de` | `94d32de3220cee314606c0c4705e20e0fdcfb2af` | the original 603-line `SESSION_HANDOFF.md` (`a150114`), which differs from the archived copy on `main` (`dd21527`) |

**Deliberately not created:** tags for `b9b1d87` / `afe6b02` (the PR #13 premium-login pair).
`refs/pull/13/head` still holds both, and the owner ruled them out of the mandatory set. Two caveats
that belong with that decision rather than hiding behind it: a `refs/pull/*` ref is a GitHub PR
bookkeeping artifact, **not** an archival backup, and `afe6b02`'s viewport-fit fix is largely *not* on
`main` (152 of 192 added lines absent) — but it cannot be applied to `main`'s 400-line `Login.tsx`,
so its value is archival only. If an independent long-term archive is ever wanted, that is the moment
to add these two tags.

`refs/pull/*` refs were never counted as preservation anywhere in this record.

## 6. Governance-pinned objects

`src/__tests__/projectState.test.ts` holds

```
const PRESERVED_BRANCH_TIPS = new Set([
  "251af96f405df5935ee17ddc9ba6b490f7989c2d",
  "94d32de3220cee314606c0c4705e20e0fdcfb2af",
]);
```

and the assertions `expect(isCommit(sha)).toBe(true)`, `expect(state.includes(sha)).toBe(true)` for
the text of `PROJECT_STATE.md`, plus the reachability exemption
`sha === head || isAncestor(sha, head) || PRESERVED_BRANCH_TIPS.has(sha)`. Its own doc-block states
the exception "is bounded to exactly these two SHAs, and it is self-guarding: each must still exist as
a commit in this clone and must still be registered by full SHA in `PROJECT_STATE.md`", provenance
`DECISIONS.md` §21 and `OPEN_ITEMS.md` L8. `PROJECT_STATE.md` registers both SHAs and lists six
branches as "preserved — not deleted and not renamed".

Read the requirement precisely: the test demands a **commit object** fetchable in a default clone and
a **branch-name sentence** in prose. An `archive/*` tag satisfies the first but not the second, so the
tags in §5 protect the data while `PROJECT_STATE.md` §2 still speaks of branches. Reconciling the two
is a **deliberate governance change in a single commit** (gate text + document text together), not a
side effect of this merge, and it was explicitly not done here. Until it is done, the two branches
named above stay undeletable — and no preservation entry for `251af96` or `94d32de` may be removed
because its content "looks merged": content similarity and commit-object reachability are different
questions, and the gate asks the second.

## 7. Branch disposition — recorded, NOT executed

Deletion is a separate, later operation, and none was performed.

* **Safe later** (`ahead=0`, contained by `main`): `arena/01a0c0b1`, `arena/01a0c112`,
  `arena/01a0c135`, `arena/01a0c185`, `arena/01a0c33e`, `arena/01a0c394`, `arena/01a0cef8`,
  `docs/post-consolidation-d1-d2`.
* **Deletable only with a doc amendment first** (contained, but named in `PROJECT_STATE.md` prose):
  `arena/01a0aa83`, `arena/01a0b6be`, `arena/01a0bf6d`, `arena/frontend-completion-spec`.
* **Must not be deleted without the §5 tags verified present** (branch-only content):
  `arena/01a0cefa`, `arena/01a0c8a7`, `arena/01a0c8b5`, `arena/01a0b059`, `arena/01a0c480`,
  `handoff/arena-frontend-pre-backend`.
* **Alive through this work:** `arena/01a0daeb-parsian-music-dashboard-opus` (the PR branch), kept
  until post-merge verification finishes.

Before any of this, in a fresh clean checkout: re-run the true-ancestry sweep, confirm each tag still
peels to the SHA in §5, and confirm `ahead=0` for every branch in the first group. Never delete a
branch because its diff looks empty.

## 8. Validation record

From `PR16_FINAL_SESSION_HANDOFF.md` (the durable record of what shipped), verbatim in substance:

* baseline full suite **2492 tests, 0 failures** (2479 pass + 13 conditional);
* final full suite **2495 / 2495 pass, 0 failures, 0 pending**; `tsc --noEmit` 0 errors;
  `vite build` 0 errors; `git diff --check` and `git diff --cached --check` exit 0;
* Library suite **8 files / 92 tests**; `roleTransition` 3/3; bundle budget green —
  `operationsViews 195.07 → 195.64 kB │ gzip 52.39 kB`, every other chunk unchanged, **no
  re-baseline**; mutation battery M1–M8 all caught; `act()` warnings 0;
* **Browser QA = NOT VERIFIED.** No browser engine exists in these sandboxes. The ten-item manual
  checklist is §9 of that document and is still owed. The demo seed stores `text/plain` only, so a
  real `.pdf` must be supplied by hand for the document-preview path.
* Two SHAs named in earlier conversation and *not* real: `72f80d0a` is a **blob** (the `vite.config.ts`
  version on `main`), and `2f4675f9…` returns 422 "No commit found for SHA" — it does not exist on
  GitHub and must never be recreated or cited as a commit.

Re-run for this document, in a fresh full clone at `648d580` with `npm ci` (no source change, one
added markdown file): **187 files / 2482 pass / 13 skipped / 0 fail / 2495 total**, `tsc --noEmit`
clean. The 13 skips are environmental conditionals, not regressions; the "act()" lines in stderr are
the jsdom *"testing environment is not configured to support act(...)"* notice (20 of them), while the
recorded metric — *updates not wrapped in `act()`* — is 0. A markdown-only commit cannot move any of
these numbers; if it did, the merge would have been abandoned.

## 9. For the session that picks this up

Read in this order: `docs/engineering/SESSION_HANDOFF.md` → `docs/engineering/PROJECT_STATE.md` →
`docs/session-handoffs/PR16_FINAL_SESSION_HANDOFF.md` (what shipped, how to verify) → this file (what
is protected, what is parked).

Start from `main` after the merge — its tree is the tree PR #16 was reviewed with, plus this
markdown file. The next working branch is `work`, created from that post-merge `main` tip, so its
base is `648d580`'s child and its tree is `main`'s. The shape is:

```
main └── (PR #16 commits) └── work

archive/... ├── 251af96 ├── 7180082 ├── bb275d6 ├── eb973eb (parked architecture) └── 94d32de
```

Do first, all read-only: `gh api repos/<repo>/pulls/16` (expect `merged=true`, `merge_commit_sha` =
the head that was merged), `gh api .../compare/648d5802c8c0408d6031001bc3e4fe483b95acd5...main` (expect `ahead_by 1`,
`behind_by 0` — the one commit ahead is this document's own), `gh api .../git/refs/tags` (expect the
five tags of §5), and `git ls-remote` (expect every branch of §7 still present).

Then the owed, still-open work — none of it started here: the §10 documentation pass of
`PR16_FINAL_SESSION_HANDOFF.md` (six documentation items, `PROJECT_STATE.md` §2/§5/§6, README
staleness), the manual Browser QA checklist, the `PROJECT_STATE.md` §2 vs tags reconciliation of §6,
and the deferred cleanup of §7. Out of scope, unchanged: I22, I23, I14, S4, Friday, Backend B–C.

Do **not** repeat: re-deriving containment from `branches-where-head`; trusting the session sandbox's
`.git` (shallow, main-only refspec, stale HEAD) as an identity source; treating a page render or a
fetch-returned file as proof; assuming a demo-seeded `.pdf` exists; "cleaning up" `eb973eb`, the two
pinned SHAs, or `vite.config.ts`; re-running the mutation battery to prove the fixes still hold;
upgrading Browser QA.

Assumptions deliberately not made: that the parked architecture is obsolete; that a tag satisfies the
prose in `PROJECT_STATE.md`; that `refs/pull/*` is a backup; that PR #16 needed a merge commit; that the
13 conditional skips should be counted as failures.
