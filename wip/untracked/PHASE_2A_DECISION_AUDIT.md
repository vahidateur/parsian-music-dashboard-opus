# PHASE 2A — READ-ONLY DECISION AUDIT

**Scope:** the two remaining open items of the Phase 2A landing — (1) Organization / D8, (2) D9 budget.
**Mode:** evidence gathering only. **No decision was made; nothing was changed.**

**Verdict in one line each:**

| Item | Classification | Technical blocker? | Owner decision required? |
|---|---|---|---|
| Organization / D8 | **C — undocumented governance inconsistency** | **No** | **Only if remediation is desired** (remediation itself requires authorization because it changes a pinned test expectation) |
| D9 budget | **Valid PASS under the canonical methodology; no documented warning/stop rule triggered** | **No** | **No** — no action required before PR (107 B margin reported as a risk only) |

---

## 0. Non-modification statement (explicit)

Within this audit **no source file, test file, governance document, configuration, `package.json`,
git ref, branch, commit, tag, index entry, or WIP working-tree file was modified, staged, created,
deleted, renamed or rewritten.** The original WIP checkout `parsian-music-dashboard-opus` remains on
branch `arena/01a0e8ec-parsian-music-dashboard-opus` at HEAD `eb973eb`, with **0 staged changes**,
**no new commits**, and `phase2a-wip-backup/phase2a-tracked.patch` at the unchanged sha256
`aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f`.

Only read-only git/GitHub commands were used for evidence: `git show`, `git grep`, `git ls-tree`,
`git archive` (read-only export to `/tmp`), `git diff --stat` (no index writes), and `gh api`
(GET endpoints only). The single artifact created by this audit is **this report file**
(`PHASE_2A_DECISION_AUDIT.md`, untracked, unstaged, uncommitted). Disclosed side effects, both
outside the repository's tracked content:

* a **scratch build** of `main` in `/tmp/d9-main` (unpacked via `git archive main`, `npm ci`,
  `npm run build`) purely to measure the D9 figure — `/tmp` is outside the repository and is not
  persisted;
* the report file adds **one** untracked line to `git status` (100 → 101 lines); nothing else in the
  status output changed.

**Material audit finding disclosed up front:** the landing clone `/home/user/phase2a-landing` — and
with it the three commits `c8734a0`, `c2bd2f9`, `c675047` — **no longer exists on disk** (the
sandbox wiped non-repository paths between turns; the directory was already absent when this audit
began, and no remote copy exists: `git cat-file -t c8734a0` is `fatal: Not a valid object name` in
every local repository). The landing is therefore currently recoverable **only by replaying**
`phase2a-wip-backup/phase2a-tracked.patch` onto `eb5b559` and re-applying the seven conflict
resolutions recorded in `PHASE_2A_LANDING_REPORT.md` §2 (the resolutions themselves are not stored
in any patch). This does not affect the correctness of the audit below, but it does affect any
approval to push: **approval must be followed by a recreate-then-verify step** (or the re-created
landing should be captured as a `git bundle` immediately so it survives again).

---

## 1. ORGANIZATION / D8 — evidence examined

### 1.1 The governing text (main, `eb5b559`)

`docs/engineering/DECISIONS.md` → **D8 — "api mode must disclose which domains are still local"**
(recorded 2026-09-16, owner's decision-record pass; landed at `53794d5`, 2026-09-16T20:30Z). Verbatim
fragments:

* *"the eleven getters that resolve Demo in both modes — `instruments`, `learning`, `chat`, `media`,
  `library`, `branding`, `gallery`, `progress`, `scheduling`, `attendance`, and `compensation` (added
  by the Class Compensation workstream, whose own registry paragraph already cites D8 by name; the
  D8 frame's original count of ten predates it)."*
* *"the disclosure must derive its wording from the same registry seam — one enumeration, no second
  list to drift."*
* Enforcement shape: *"a test asserts the disclosure renders in api mode and does not render in demo
  mode, and that the disclosed set equals the registry's demo-in-both-modes set."*

### 1.2 The decisive dated facts

| Fact | Evidence (read-only) |
|---|---|
| At D8's landing (`53794d5`), `registry.ts` contained **no** organization getter at all | `gh api …/contents/src/domains/registry.ts?ref=53794d5` → `grep -i organization` = **0 matches** |
| At that commit the demo-in-both set was **exactly** the 11 enumerated members | the 11 `return overrides.<X> ?? new Demo<X>Repository()` lines at `:144–212`; `DEMO_SERVED_DOMAINS` = 11 entries → **equality held exactly at D8's landing** |
| The organization domain was created **six days later** | `gh api …/commits?path=src/domains/organization/demoRepository.ts` → oldest commit `606e95cb`, **2026-09-22T08:13:53Z**, subject *"Session rules and working hours are rules, not decoration"* |
| That commit added the both-modes Demo getter | it modifies `src/domains/registry.ts`; the getter is `return overrides.organization ?? new DemoOrganizationRepository();` — an `apiRepository.ts` exists but nothing selects it |
| That commit touched **no documentation** | file list = 27 files, **all under `src/`** (0 files under `docs/`) |
| No document anywhere ties organization to the demo-backed/api-mode disclosure | exhaustive grep of `docs/` for `organization` **and** (`demo-backed` \| `both modes` \| `api mode` \| `D8` \| `disclos*` \| `local`): the only hits are unrelated (fixture identity, theme persistence `O-04`, `org_id` scoping `O-14`) |
| No document names `getOrganizationRepository` | `git grep -l getOrganizationRepository main -- docs/` → **none** |
| The domain has no README | `git ls-tree main src/domains/organization/` → no `README*` |
| Current main has **12** demo-in-both getters; the list still has **11**; the missing member is exactly `organization` | enumerated both sides: 12 `?? new Demo…` getters (`instruments, learning, chat, media, library, branding, organization, gallery, progress, scheduling, attendance, compensation`) vs 11 list ids (same, minus `organization`). The 7 `isApiMode()`-switching getters are the other set D8 names, and they match D8's "seven" exactly |
| The enforced test cannot see the difference | `src/components/shell/__tests__/DemoBackedNotice.test.tsx`: line 81 iterates **the list itself** (stale-enumeration tripwire), line 85 pins `expect(DEMO_SERVED_DOMAINS).toHaveLength(11)`. It never enumerates the registry's getters, so a demo-in-both getter **absent from the list is undetectable** — and adding `organization` to the list would **fail** the pinned count |
| The registry's own comment states the intent D8 relies on | *"a domain graduating to a served API (or a new domain landing) cannot leave a stale banner behind"* — i.e. a new domain landing is expected to update the enumeration |
| `data-layer.md`'s count chapter names its members | *"These six resolve to Demo in BOTH modes — and so do five more"* → six `+` five named; organization is in neither list |
| The organization getter's own comment claims parity with a disclosed domain | *"Demo-backed even in API mode, exactly like branding"* — branding **is** in the 11; organization is not |

### 1.3 Classification

**C — an undocumented governance inconsistency.** Reasoning against the alternatives:

* **Not A (intentional exclusion).** There is no act of exclusion to point to: at the moment D8 was
  written and landed, organization **did not exist**, so the list was complete and the equality in
  D8's enforcement clause held exactly (11 = 11). Nothing in D8, in any later document, or in the
  Sept 22 commit signals a deliberate decision to leave organization out.
* **Not B (documented exception).** No document records organization as an exception — not
  `DECISIONS.md`, `PROJECT_STATE.md`, `OPEN_ITEMS.md`, `GOVERNANCE_CHECKPOINT.md`,
  `docs/architecture/data-layer.md`, the frontend-completion set (`01`, `03`, `08`, `12`,
  `13`), nor any `F*` report. The only near-statements are unrelated (`org_id` scoping, theme
  persistence).
* **Not D (insufficient evidence).** The dates, the commit contents, the enumeration on both sides,
  and the test's shape are all directly observable; the drift and its cause are established.
* The drift is **real but benign in product terms**: it means an operator running api mode sees a
  disclosure that names ten of the eleven local-and-not-server-backed domains and omits
  `organization`. It is a *disclosure-completeness* gap, not a data-safety or bundle-boundary gap.

### 1.4 Relationship to the Phase 2A landing (unchanged by this audit)

The landing **preserved the inconsistency exactly**: on the repository's WIP worktree (the landing's
source of truth) the `DEMO_SERVED_DOMAINS` block is **byte-identical** to main's (verified by
`diff`), the organization getter is **byte-identical** to main's (verified by `diff`), and
`DemoBackedNotice.test.tsx` is **unchanged from main**. Phase 2A touched no governance document
(`git diff --name-only eb5b559..HEAD -- docs/` was empty in the landing). Organization appears in
Phase 2A **only** in the client composition's `UNAVAILABLE_DOMAINS` (12 entries, verified: 12 `id:`
entries including `organization`), which is correct and orthogonal to D8.

### 1.5 Blocker / decision status

* **Not a technical blocker.** All 195 files / 2563 tests pass, including the D8 notice suite; the
  landing changes no organisation behaviour, no list, and no document.
* **Requires an explicit owner decision only if remediation is wanted.** If the owner decides D8's
  stated invariant (disclosed set == demo-in-both set) must hold, the remediation is
  **three-part and governance-visible**: add the member to `DEMO_SERVED_DOMAINS`, change the pinned
  test count `11 → 12`, and record the change (D8's own "update the enumeration first, never the
  banner" rule + a decision note). Changing the pinned expectation is exactly the class of change
  the standing constraints forbid without authorization — so it must not be done by an agent on its
  own initiative.
* **No action is required for the landing to be correct as-is**, because it inherits main's
  governance state unchanged.

---

## 2. D9 BUDGET — evidence examined

### 2.1 The governing text and the gate

* `DECISIONS.md` **D9** (*"the bundle budget is measured before it is set"*): the budget becomes a
  **test**; it may never be satisfied by raising `chunkSizeWarningLimit`.
* `DECISIONS.md` **§22** (*in force 2026-09-25*, owner-selected direction): the **total** gzip
  baseline moves to the post-A-lite measurement **343 947 B**; `+5 %` allowance → hard cap
  **361 144 B** (`Math.floor(343947 * 1.05) = 361144`). Nothing else about the gate moves: entry
  chunk must still be strictly below its `c16890f` anchor **273 791 B**; the **400 000 B**
  single-chunk ceiling stands; raising `chunkSizeWarningLimit` remains a failure condition.
* Methodology (the test's own docblock + implementation): bare `npm run build` → `dist/`;
  **total = Σ gzip(JS chunks) + gzip(CSS) + gzip(`index.html`)**, each file measured with the GNU CLI
  `gzip -6 -n -c <file> | wc -c`.
* Assertions (`src/__tests__/bundleBudget.test.ts`): `entry.gzip < 273791`;
  `totalGzip <= 361144`; every chunk `< 400000`; `chunkSizeWarningLimit` absent from
  `vite.config.ts`.

### 2.2 The measurements (this sandbox, `gzip 1.12`)

| Measurement | Value | Basis |
|---|---|---|
| **Landing total** | **361 037** | recorded in `PHASE_2A_LANDING_REPORT.md` §7, measured in the landing workspace with the canonical method |
| Landing entry chunk | 135 153 | as above (≪ 273 791 anchor) |
| Landing largest chunk | 135 153 | ≪ 400 000 ceiling |
| **Main (`eb5b559`) total — measured fresh in this audit** | **356 039** | `git archive main` → `/tmp/d9-main`, `npm ci`, `npm run build`, then the canonical per-file `gzip -6 -n` |
| Main entry / CSS / HTML | 128 962 / 21 552 / 1 017 | same |
| Main largest chunk / chunk count | 128 962 / 7 | same |
| **Phase 2A's own contribution** | **≈ +4 998 gzip bytes** | 361 037 − 356 039 (both canonical-method measurements) |

**Verdict on the questions asked:**

1. *Is 361 037 a valid passing measurement under the canonical methodology?* **Yes.**
   `361 037 ≤ 361 144` — the gate asserts `toBeLessThanOrEqual`, and the margin is 107 B (0.03 % of
   the cap). The build it measures is the bare `npm run build` (demo target at `dist/`), exactly the
   artifact the gate inspects.
2. *Does 107 B of headroom trigger any documented warning/stop rule?* **No.** The gate is binary —
   pass at ≤ cap, fail above it. An exhaustive search of `docs/` for a warning band or a
   margin-language rule ("headroom", "approaching", "near the cap", "margin + bundle/budget/cap/
   gzip") returns **nothing**; the single `headroom` occurrence is §22's own description of the 5 %
   allowance. No document requires a re-measurement, a notice, or an approval for a passing figure.
3. *Did the landing introduce a D9-specific increase requiring owner review?* The increase is
   Phase-2A-specific and quantified (≈ +4 998 B: the client boundary, deployment lock, delivery,
   registry split and seams). It **passes** the recorded budget, and no rule attaches an owner
   review to a passing measurement. What the numbers do show is context the owner should have:
   **main alone had already consumed 12 092 B of the 17 197 B allowance (70.3 %) before Phase 2A**,
   so the landing consumed the remainder down to 107 B. That is a **risk statement, not a
   governance violation**.
4. *Is any governance action required before PR?* **No.** No cap change, no re-baseline, no test
   change, no optimization is mandated or performed here.
5. *Environment caveat (reported, not acted on).* A 107 B margin is 0.03 % of the cap — smaller than
   plausible environment drift in the compression implementation (this audit ran `gzip 1.12`; the
   JS/CSS minifier versions are pinned by `package-lock.json`, but the gzip binary used by the test
   is not). The pass is therefore **environment-conditional in the strict sense**: a different
   gzip/zlib build could move the measured total across a 107 B line. Reporting this is in scope;
   acting on it (optimizing, re-baselining, adding a warning band) would be a new governance
   decision and is explicitly **out of scope**.

### 2.3 Classification

**No defect, no drift, no decision required.** The landing passes D9 exactly as recorded by the
owner's §22 re-baseline, by the repository's own measurement method, with a binary gate and no
margin-based rule to trigger. The only items worth an owner's attention are advisory: the 107 B
margin and its environment sensitivity, and the fact that main itself was already at 70 % of the
allowance before Phase 2A.

**Byproduct observation (documentation staleness, not a rule).** `src/__tests__/bundleBudget.test.ts`
carries a docblock that still quotes the **superseded** c16890f-era actuals (entry `107800`, total
`297835`, dist raw `1963240`) while its asserted constants are correctly the §22 ones
(`343947` / `361144`). This is a stale comment in a comment block — harmless to the gate — and it is
**not** a second governance inconsistency with any enforcement effect. Reported for completeness;
not changed.

---

## 3. Blocker and decision matrix

| Question | Organization / D8 | D9 budget |
|---|---|---|
| Technical blocker for the landing? | **No** | **No** |
| Test/CI blocker? | **No** (suite green, D8 suite unchanged from main) | **No** (gate passes: 361 037 ≤ 361 144) |
| Requires explicit owner decision? | **Conditional** — only if the owner wants D8's "disclosed set == demo-in-both set" invariant enforced; remediation touches a pinned test expectation (11 → 12) plus the enumeration and a decision note | **No** |
| Requires action before PR? | **No** — the landing inherits main's governance unchanged; the inconsistency predates Phase 2A (introduced 2026-09-22 by `606e95cb`) | **No** |
| Residual risk to record | api-mode operators do not see `organization` in the local-domains disclosure | 107 B (0.03 %) of headroom, environment-sensitive; main was already at 70 % of the allowance |

Neither item changes the Phase 2A verdict: both are governance-state observations about `main`
that the landing reproduced faithfully rather than changed.

---

## 4. Exact commands and results (evidence trail)

```text
# Organization / D8
gh api repos/…/commits/53794d5 --jq '.commit.author.date'            → 2026-09-16T20:30:13Z
gh api "…/contents/src/domains/registry.ts?ref=53794d5" | base64 -d  → org: 0 matches;
                                                                       11 demo-in-both getters;
                                                                       DEMO_SERVED_DOMAINS = 11 entries
gh api "…/commits?path=src/domains/organization/demoRepository.ts"   → oldest 606e95cb 2026-09-22T08:13:53Z
gh api repos/…/commits/606e95cb --jq '.files[].filename'             → 27 files, all src/, 0 docs
git show main:src/domains/registry.ts  (enumerated)                  → 12 demo-in-both getters,
                                                                       11 list ids, missing = organization
git show main:src/domains/DECISIONS.md (D8 §)                        → names the 11; equality clause
git show main:src/components/shell/__tests__/DemoBackedNotice.test.tsx
                                                                    → line 81 walks the list,
                                                                      line 85 pins toHaveLength(11)
git grep -l getOrganizationRepository main -- docs/                   → none
git grep -i organization main -- docs/ | (demo|both modes|D8|…)       → no disclosure-related hit
# (WIP = landing source)
diff <(git show main:src/domains/registry.ts | <list block>) \
     <(sed -n '<list block>' src/domains/registry.ts)                 → IDENTICAL (11 entries)
diff <(git show main:src/domains/registry.ts | <org getter>) \
     <(sed -n '<org getter>' src/domains/registry.ts)                 → IDENTICAL
git diff --stat main -- src/components/shell/__tests__/DemoBackedNotice.test.tsx → (empty)
python3 (parse src/domains/shared/unavailableDomains.ts)              → 12 entries incl. organization

# D9
git show main:docs/engineering/DECISIONS.md  (D9 + §22)               → baseline 343 947, cap 361 144,
                                                                       method: gzip -6 -n, CLI
git show main:src/__tests__/bundleBudget.test.ts                      → gzipSize() = `gzip -6 -n -c | wc -c`;
                                                                       total ≤ cap; entry < 273 791; chunk < 400 000
git grep -i "headroom|approaching|margin…" main -- docs/              → no warning/stop rule
git archive main | tar -x -C /tmp/d9-main; npm ci; npm run build      → PASS
node -e "<canonical gzip -6 -n measurement over dist/assets + dist/index.html>"
        → main total 356 039  (entry 128 962; css 21 552; html 1 017; 7 chunks; largest 128 962)
        → landing total 361 037 (recorded, PHASE_2A_LANDING_REPORT.md §7)
        → landing contribution ≈ +4 998 ; remaining headroom 107
gzip --version                                                        → gzip 1.12
```

Repository state at the end of this audit, re-verified read-only:

```text
branch    arena/01a0e8ec-parsian-music-dashboard-opus
HEAD      eb973eb2758447eff16b60ab4fd4c267f9d85061   (unchanged)
staged    0
status    101 lines = 78 M + 22 ?? (WIP + backup dir, unchanged) + 1 ?? (this report)
backup    phase2a-wip-backup/phase2a-tracked.patch sha256 aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f (unchanged)
commits   none added; no ref created, moved or deleted; nothing pushed; no PR touched
```

**No source, test, governance file, configuration, git ref, branch, commit, or WIP content was
modified by this audit.** The only new artifact is this untracked report.

---

## 5. STOP

This document makes no decision and recommends no change. It records evidence for two owner
questions — whether D8's disclosed set should gain `organization` (and with it a changed pinned test
count) and whether D9's 107 B margin should be noted or acted on — and it flags the operational fact
that the landing clone no longer exists on disk, so an approval to push must begin with
recreating and re-verifying the landing.
