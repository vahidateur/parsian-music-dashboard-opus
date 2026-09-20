# PRE-CLEANUP GIT HANDOFF

**Purpose.** Navigation source for the next session. This file is **not** a substitute for the
Governance Decision Register ([DECISIONS.md](DECISIONS.md) D1–D20,
[GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md)). It records Git/consolidation state only.

**Recorded:** 2026-09-20  
**Nature:** documentation-only. No implementation, merge, deletion, or Laravel work is authorized by
this file.

---

## 1. Current checkpoint

| Fact | Value |
|---|---|
| Current branch | `arena/01a0bf6d-parsian-music-dashboard-opus` |
| Current HEAD (governance checkpoint; parent of this handoff) | `374cc479e34d4fb7af3e27bcf2455480dc1f286e` |
| Working tree at record | **clean** of product/WIP implementation (docs-only line) |
| Governance checkpoint | `374cc47` — `docs: synchronize governance decision closure checkpoint` |
| Frozen frontend source of truth | PR #4 / `arena/frontend-completion-spec` @ `f00f85e6f817369a32b8921ffb64f58e17ea154e` |
| Freeze ancestor | `02b74996e6458d10a5d9e8d1023890239342c4e4` (`docs: freeze Arena frontend checkpoint`) |
| GitHub default branch | `main` @ `a6469759fea743b9332702bb9a20e69fc4abc1be` (**protected**) |
| Local clone | **shallow / grafted**. Local `merge-base` / ahead-behind vs `main` is untrustworthy. |
| Remote ancestry | **GitHub API / `git ls-remote` are authoritative.** Do not treat this clone’s object graph as complete. `f00f85e` is **not** in this clone. |

This workspace branch is **protected WIP**. Do not switch, reset, rebase, cherry-pick, or delete it
without explicit authorization.

---

## 2. Completed work

The following are **complete** as of the audits in this session (evidence on Git, not re-opened here):

| Item | Where |
|---|---|
| M-1…M-6 (quick actions, teacher/student photo, I15 disclosure, I16 deep-link, settings honesty) | Freeze `02b7499` and descendants |
| F0–F10 frontend completion | PR #4 @ `f00f85e` only |
| P1 security fixes (scope leak, double-submit, class time validation) | `ae9f9b7d` on PR #4 |
| SEC-003-01 IDOR defense (`isAssignedStudent` / deep-link) | `f00f85e` on PR #4 |
| Jalali/date coherence + midnight rollover | `f00f85e` on PR #4 |
| API boundary audit (O-15 ACCEPT WITH CONDITIONS) | [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) |
| Performance audit (PERF ACCEPT WITH CONDITIONS; not a v1 schema gate) | [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) |
| Governance decision closure checkpoint | `374cc47` |
| Branch inventory audit | read-only; no Git mutation |
| Content reconciliation audit | read-only; no Git mutation |

---

## 3. Governance source of truth

- **D1–D20** in [DECISIONS.md](DECISIONS.md) remain the existing decision body. Do not amend them
  to hold T-02 / O-* IDs (collisions: D7 ≠ O-07, D15 ≠ O-15).
- **[GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) @ `374cc47`** is the durable source for the
  later T-02 / O-* / Performance closure checkpoint (2026-09-20).
- **[DECISIONS.md](DECISIONS.md) §20** is **only a pointer** to that checkpoint. It is not a new
  D-entry and does not implement backend.
- **Do not silently reconcile** PR #4’s historical OPEN table
  (`docs/frontend-completion/13-open-decisions.md`, F0 / 2026-09-19, all O-01…O-20 OPEN, T-02 OPEN)
  with the later checkpoint. Those are different dates. Porting requires an explicit product
  decision; rewriting either in place is out of scope until authorized.
- **T-02** is currently **ASSIGNED-ONLY** according to the later governance checkpoint. Do not
  revisit. Teacher student-read = active enrollment ∩ `class.teacherId`. `Student.teacherId` is not
  authorization.

Closed for Laravel *policy* (still unimplemented): T-02 ASSIGNED-ONLY; O-12 DUAL TRANSPORT; O-13
portal = separate guard / same `users` (credential factor OPEN); O-10/O-11 `chat_id`→user+org
(uniqueness/UX OPEN); O-08 / O-09/O-20 / O-14 / O-16 / O-18 / O-15 / PERF = ACCEPT WITH CONDITIONS.
KEEP OPEN (no v1 domain): O-07 tickets, O-17 notifications, O-19 retention numbers, Help/KB/AI.

---

## 4. Frontend source of truth

**`arena/frontend-completion-spec` @ `f00f85e6f817369a32b8921ffb64f58e17ea154e` (PR #4)** contains:

- F0–F10
- P1 / SEC / date fixes (`ae9f9b7d`, `f00f85e`)
- `docs/frontend-completion/` (01–17 + README)
- current frontend evidence (`src/domains/auth/scope.ts`, IDOR/date tests, F-series src)

`02b7499` **is an ancestor** of `f00f85e` (PR #4 is 33 commits ahead / 0 behind the freeze). M-1…M-6
therefore exist on the PR #4 line.

**Do NOT treat `374cc47` as frontend source of truth.** This branch has the governance checkpoint
only (+ freeze ancestor). It does **not** contain `docs/frontend-completion/`, `scope.ts`, or F1–F10
product source. `f00f85e` is **remote-only** relative to this shallow clone.

---

## 5. Content reconciliation result

### 64 KB handoff — `handoff/arena-frontend-pre-backend` @ `94d32de`

- Path: `docs/engineering/SESSION_HANDOFF.md` blob `a150114…` (**64 858 B**)
- Historical / **pre-M-1** (written 2026-09-18 against `d31cbe9` / `d6430df`)
- Unique useful historical evidence: M-1…M-6 appendix with line-level reasoning; git wart
  `2ce10d63` keep-as-is; environment-discrepancy method
- Unique **Laravel wait-list** (§7): server authz, media signed URL, notes, export, Telegram/Bale
  tokens, org-scoped `national_id` unique, server pagination, backup versioning, settings domain,
  queues/webhooks, compensation API, Finance/Reports
- Unique **Arena AI Auditor** notes (§5): external workspace; not in this repo; do not reconstruct
- **Must be archived before branch deletion. Must NOT be silently deleted.**
- Must **not** be used as live next-action (would revive a false M-1 work order)

### 40 KB handoff — PR #4 `docs/engineering/SESSION_HANDOFF.md`

- Blob `bdefb1e…` (**40 195 B**) — **different document**, not a revision of the 64 KB file
- Historical **F1-kickoff** (CURRENT_HEAD `a251e69`, NEXT ACTION F1)
- **Stale** relative to F10 / `f00f85e`
- Points at `docs/frontend-completion/` (those files exist only on PR #4)
- **Should NOT be treated as current operational truth**
- Future canonical `SESSION_HANDOFF.md` must eventually be **refreshed** (explicit later decision)
- Reconciliation recommendation recorded: `ARCHIVE_64KB_THEN_KEEP_40KB` (archive unique 64 KB;
  keep the filename on the product line; do not concatenate)

### README

Only live content difference identified between `main` (`c487e629`, 4274 B) and all Arena/PR #4
tips (`7326bd6b`, 4256 B):

- Arena: **آوا**
- `main`: **پارسیان**

The engineering-index section is on **both** `main` and Arena. Commit `5d955311a5` is **not** the
live `main` README (it lacked that section). Canonical naming still requires an **explicit product
decision**. Do not auto-port `5d955`.

### Governance files on this branch

`GOVERNANCE_CHECKPOINT.md` and `DECISIONS.md` §20 from `374cc47` **must be preserved/ported before
deleting this branch.** They exist on no other line.

---

## 6. Branches that MUST NOT be deleted yet

| Branch | Why |
|---|---|
| `main` | GitHub default; **protected**; unique README «پارسیان» delta |
| `arena/frontend-completion-spec` | Frozen frontend SoT @ `f00f85e`; PR #4 head; remote-only in this clone |
| `arena/01a0bf6d-parsian-music-dashboard-opus` | **This protected WIP**; unique `374cc47` governance |
| `handoff/arena-frontend-pre-backend` | Unique 64 KB `SESSION_HANDOFF.md` until archived |
| `arena/01a0b6be-parsian-music-dashboard-opus` | Freeze `02b7499`; **current PR #4 base** — deleting it retargets/breaks #4 |

**Also:** `arena/01a0b059-parsian-music-dashboard-opus` @ `251af96` must **not** be deleted until its
unique `CommandPalette.tsx` blob (`98b57bb…`, parallel older focus-return fix) is **explicitly**
accepted or discarded versus freeze/PR #4 blob `686a942…`. Test file blob is already identical.

---

## 7. Branches that are candidates for later cleanup

Only after the next-session order in §10, and never in this file’s commit:

| Branch | Condition |
|---|---|
| `arena/01a0aa83-parsian-music-dashboard-opus` @ `d31cbe9` | Already represented in `main` via PR #3 (ahead 0 / behind 2 = merge commit + README). Candidate after confirmation. |
| `arena/01a0b059-parsian-music-dashboard-opus` | Superseded older parallel CommandPalette variant; **pending explicit verification** of blob `98b57bb`. |
| `arena/01a0b6be-parsian-music-dashboard-opus` | Removable **only after** PR #4 is safely retargeted/merged **and** descendants still contain `02b7499`. |
| `handoff/arena-frontend-pre-backend` | Removable **only after** unique 64 KB handoff is archived into canonical history/docs. |

Deleted already (do not revive): `arena/01a07c61-…` (PR #2 closed; tip ancestor of `main`),
`arena/01a06bff-…` (PR #1 merged).

**No tags** exist.

---

## 8. PR #4

| Field | Value |
|---|---|
| Number | [#4](https://github.com/vahidateur/parsian-music-dashboard-opus/pull/4) |
| State | **OPEN** (not merged) |
| Base | `arena/01a0b6be-parsian-music-dashboard-opus` (**not** `main`) |
| Head | `arena/frontend-completion-spec` @ `f00f85e6f817369a32b8921ffb64f58e17ea154e` |
| Role | **The only live frontend-completion vehicle** |
| Checks / review | `mergeable` UNKNOWN; no status checks; no review decision (as of 2026-09-20 audit) |

**Do NOT merge it as-is merely to close the PR.** Canonical branch identity must be explicitly
chosen first. Merging onto `01a0b6be` still leaves `main` stale and **does not** include `374cc47`
governance.

Other PRs: #3 MERGED into `main`; #1 MERGED; #2 CLOSED unmerged (work later on `main`). No issues.

---

## 9. Current decision

> **Git consolidation is NOT yet safe.**
>
> No branch deletion or merge should occur until the canonical branch and document set are
> explicitly chosen and unique work is preserved.

There is **no single tip** that already contains: `main` README name + freeze M-1…M-6 + PR #4
F0–F10 + `374cc47` governance + archived 64 KB handoff.

**NOT SAFE TO CONSOLIDATE — ACTION REQUIRED** (branch inventory audit). This session does **not**
perform that action.

---

## 10. Next session — exact order

The next session must continue in **this order**:

1. Read `docs/engineering/PRE_CLEANUP_HANDOFF.md` (this file).
2. Verify GitHub remote state **read-only** (`gh` / `git ls-remote`). This clone is shallow; do not
   trust local ancestry. Prefer **not** to `git fetch` other branches until consolidation is
   authorized.
3. Choose **canonical branch identity**.
4. Decide README name: `پارسیان` vs `آوا`.
5. Decide treatment of PR #4 historical OPEN decision docs vs [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md).
6. Decide canonical `SESSION_HANDOFF.md` (refresh vs archive-64/keep-40).
7. Preserve/archive unique 64 KB handoff (`handoff/…` @ `94d32de`).
8. Create a **written** consolidation plan (still no execution).
9. Execute merges/retargeting **only after explicit authorization**.
10. Verify the canonical branch contains: frontend `f00f85e` evidence, governance `374cc47` (or an
    authorized port), chosen README, archived 64 KB content.
11. Delete **only** verified superseded branches (see §6–§7).
12. Final `git fetch --prune` / remote cleanup **only after** consolidation.
13. Create final clean Git baseline/checkpoint.
14. **Only then start Laravel/backend.**

---

## 11. Do not start Laravel

> Laravel/backend implementation MUST NOT start before Git consolidation is complete, the
> canonical branch is established, unique work is preserved, unnecessary branches are removed,
> and the final Git baseline is clean.

Also binding from the governance checkpoint (not implemented here): no Laravel/migrations from
this file; T-02/O-* are policy records; Performance is an ongoing ops requirement, **not** a v1
schema gate.

---

## 12. Data-loss warning

The following are currently **unique and/or remote-only** and **must be preserved**:

| Content | Only on | In this clone? |
|---|---|---|
| `f00f85e` frontend line (F0–F10, P1/SEC/date, `docs/frontend-completion/`) | `arena/frontend-completion-spec` / PR #4 | **No** (remote-only) |
| `374cc47` governance checkpoint | `arena/01a0bf6d-parsian-music-dashboard-opus` | Yes on remote; this clone may be grafted at `02b7499` — **trust GitHub** |
| 64 KB historical handoff | `handoff/arena-frontend-pre-backend` @ `94d32de` | **No** (remote-only) |
| `main` README naming delta («پارسیان») | `main` @ `a646975` | `main` exists locally at `a646975`; do not assume it is an ancestor of HEAD in this graft |

This clone is **shallow**. Remote GitHub state must be trusted for branch ancestry. Do not delete
any §6 branch because it is missing locally.

Local-only unpushed product work: **none** as of the 2026-09-20 audits (working tree was clean at
`374cc47` on the remote).

---

## Pointers (do not substitute)

- Governance body: [DECISIONS.md](DECISIONS.md) D1–D20
- Later T-02 / O-* / PERF closures: [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md)
- Engineering recovery quartet: [PROJECT_STATE.md](PROJECT_STATE.md), [PHASES.md](PHASES.md),
  [OPEN_ITEMS.md](OPEN_ITEMS.md) — freeze-line versions on this branch; PR #4 has a different
  `PROJECT_STATE.md` blob (F-series). **NEEDS DECISION** which recovery docs ride the canonical tip.
- Frontend completion spec: **only** on PR #4 `docs/frontend-completion/`
