# PROJECT STATE — recovery document

> **Read this first.** It is the durable hand-off between agent sessions. Conversation
> memory is not durable; this file, the Git history and the test suite are.
>
> Sibling documents: [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md)
>
> **Last state update: 2026-09-16** — **the Class Compensation workstream now has its secretary
> surface**: the make-up obligation domain shipped at `a21311d7e32c82e3a46b1581c94f6b3478bf646c` (69
> tests in five new files), and the UI landed after it at `fc83d6d` (*the secretary surface* — 7 files),
> hardened by `79fd44e` and `79ec13d`, documented at `d18d3e3`, and the boundary gate that closed the
> workstream's last open audit finding at `bf8bd911` — all pushed, the first of them on base `f0bdecd`
> (the workstream's final domain-gate reconciliation). **It is a workstream, not a milestone:** the
> phase-checkpoint row stays at `33b1031`, the M0–M11 sequence is unchanged, and **M8 has not started**.
> **There is still no `apiRepository`, no server and no seeded compensable case** (**I20**),
> group/class-wide compensation and any coordination flow are still unbuilt (**I18**), the surface is
> jsdom-verified only with browser QA **NOT VERIFIED** (§5), and the tenth audit finding — per-surface gate
> coverage — is **closed** as **I21** at `bf8bd91150d6fca3392115c7eccd6c738e9091ee`, the surface's own
> dedicated boundary gate, with six gate-architecture findings recorded as deferred. See §3 → "Last
> completed work (Class Compensation UI…)", §4 → "Compensation UI validation" and "S-6 boundary gate
> validation", and §7 item 19.
>
> **M7's record follows, kept for audit and unedited. M7 (relation de-fixturing + sidebar badges, I1) is
> ✅ COMPLETE** and pushed, implemented across four checkpoints on top of `8131c5c` — the coverage
> matrix that closed M6's documentation reconciliation: **CP1** `0d9fc01` (the relation plumbing — the academy-day and id-index
> modules, the per-surface fixture gate and the through-route plumbing tests), **CP2** `5726435`
> (student relations), **CP3** `ede3ad6` (teacher relations), **CP4** `f1ec0dd` (class relations and
> the navigation counts). **67 new tests in six new test files**; the full suite is at **125 files /
> 1 729 passed / 0 skipped / 2 failed**, and **both failures are recorded environmental cases, not
> regressions** — the known branch-name case in `projectState.test.ts:299` (§7 item 16) and a
> **date-dependent** case in `schedulingWrites.test.tsx` that reproduces identically on the pre-CP4
> tree because the sandbox clock reached Tuesday 2026-09-15, the weekday the fixture assigns to `cl2`
> (§7 item 18, and [OPEN_ITEMS.md](OPEN_ITEMS.md) I19). M6's record above it — its four checkpoints,
> its coverage matrix and its reconciliation — and M5's, M4's and M3's before that are kept for audit.
> **I1 is closed at the level it was defined** (`navGroups` carries no number, the one badge with an
> honest source is read from the chat repository, and the badge with no scoped source was **removed**
> rather than estimated). That pass was M7's **documentation reconciliation** (`e7a6d72`):
> `docs/engineering/` only, no product source, no test, no dependency, and **M8 has not started** — and
> the pass you are reading is the Class Compensation **workstream's** documentation reconciliation,
> documents only.

---

## 1. Identity

| Field | Value |
|---|---|
| Product | **آوا (Ava)** — command centre for a music academy: Persian-first, RTL, private SaaS admin panel |
| Repository | `vahidateur/parsian-music-dashboard-opus` |
| What exists here | **Frontend only.** There is no backend, no database and no server code in this repo |
| Stack | Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · Vitest + React Testing Library · jsdom |
| Primary artifact | Single-page app built to `dist/` (gitignored) |
| Runtime data | DemoStore (localStorage + IndexedDB blobs) or a REST API that does not exist yet |

## 2. Branch and checkpoints

| Field | Value |
|---|---|
| Working branch | `arena/01a07c61-parsian-music-dashboard-opus` |
| **Phase checkpoint (application)** | `33b10311f0d3a38745b4d0c00f22e4f63665888d` — Phase 2, approved and pushed. **Not advanced to M0/M1/M2/M2.1/M3/M4/M5/M6/M7, and the reason is a rule, not an oversight:** `src/__tests__/projectState.test.ts` requires the recorded documentation checkpoint to *descend from* the recorded phase checkpoint, so this row can only move to a milestone once a documentation checkpoint has been pushed after it. The milestones themselves are registered in [PHASES.md](PHASES.md) — M1 is `689a7c15951d690b1ce650a5938e6b1216ca30ed`, M2 is `c42f274ac10d4087f9280e3bf7b47141d0672e32` and M2.1 is `73b40d970816f174b56d37addc21f106a472359b`, M3 was implemented at `e5b0a57d8f33dc04838670a2cd4158a88dd34022` and completed at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`, two **pre-M4 remediation** commits that are *not* milestones sit after them — `fba826f` (I13 Checkpoint 3B) and `7e72887` (C2, which is also M4's effective safe rollback boundary) — **M4** sits after those, implemented across three checkpoints, `0f875a78c99077e25b67b9cc9cffe34c823ee511` (CP1, the reads), `f8c3472895978054c8dc81574bb8a945ef3c326d` (CP2, the two writes) and `6f54caf46dc13baca78e376c606a4aa9667cdb48` (CP3, generation), with its acceptance-coverage checkpoint at `df701488362cb90cf32ccefad277879477571cf7` and its final documentation reconciliation at `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` — and **M5**, the attendance *view* wiring, sits after that at `9505ade4011b37a34e3488fd51206512829205ec` with its own documentation reconciliation at `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` — and **M6**, the contracts-without-UI milestone, sits after that, implemented across four checkpoints, CP1 `43e7882f051b46abfa9f0530137cedfb3a541ce0` (the chat contract), CP2 `42c54f41ed3099cf65ac4ca035146958a1a51f76` (conversation management and composer state safety), CP3 `563b8d85ee48614963cb3c182ac9b84239645c3d` (attachments) and CP4 `4e03b8762bebcb87e46cf7044af5da99d709b4d2` (conversation export) — and **M7**, the relation de-fixturing milestone, sits after M6's documentation reconciliation (`8131c5cd49c35a7163543082475a9635914aba40`), implemented across four checkpoints, CP1 `0d9fc01079039548cf0ffe3c80c5bf2e88056a9c` (relation plumbing), CP2 `5726435506bd74748f6165819f3c80e30f359b80` (student relations), CP3 `ede3ad6a5e26b1cdfc514962b57ac1302309968c` (teacher relations) and CP4 `f1ec0ddde783aec14d6429ac2457f085f851ad9a` (class relations and navigation counts), all pushed; §3 carries the current phase. The **non-milestone** Class Compensation P1 workstream (`a21311d7e32c82e3a46b1581c94f6b3478bf646c`) sits after M7's reconciliation (`e7a6d72`) and does **not** advance this row: a workstream is not a phase |
| Previous phase checkpoint | `aca40c5d6dd74ccf71513c825a3e5c6af45feb3d` — Phase 1, approved and pushed |
| **Documentation checkpoint (pushed)** | `3acb5f3be275a67726376adbfed3f3fdf2f1282b` — **the D2 record** (*docs(governance): record decision D2 before M8*): **D2** decided with its row, its four-field section and the register's counts (fourteen decided, four open), the shipped default name «آموزشگاه موسیقی پارسیان» recorded, the M8 references reconciled where they still said the decision was required, and `9fcf008` registered as the twenty-fourth documentation checkpoint. Documents only — four `docs/engineering/` documents, 63 insertions / 32 deletions; no product source, no test, no dependency. **The twenty-fifth** documentation checkpoint, which could not name itself — the next documentation commit names it — and the commit **this documentation pass was built on** |
| Previous documentation checkpoint | `9fcf00891d07db18c718296ccaddc79919c793c1` — **the I21 closure and the S-6 gate registration** (*docs(compensation): close I21 and register the S-6 boundary gate*): the dedicated per-surface boundary gate's landing (`bf8bd91150d6fca3392115c7eccd6c738e9091ee`) registered as a **chain commit** rather than counted here, **I21** closed with its closure record, the S-6 validation block and the gate's own mutation evidence written into §4 of this file, and the six gate-architecture findings kept deferred. Documents only — four `docs/engineering/` documents, 158 insertions / 37 deletions; no product source, no test, no dependency. **The twenty-fourth** documentation checkpoint, which could not name itself — the next documentation commit names it — and the commit **the D2 record was built on** |
| Documentation checkpoint before that | `d18d3e39b513a9031ba8cc8383e7b98d7ae99c99` — **the Class Compensation UI's documentation reconciliation** (*docs(governance): reconcile compensation UI checkpoints*): the secretary surface's chain registered (`fc83d6d` the surface, `79fd44e` and `79ec13d` its two hardening packages), the audit findings **S-1**…**S-9** recorded as closed with **S-6** left open as **I21**, the surface's validation block written into §4 of this file, the test catalogue in §6 and the limitations in §7 and §9 brought up to it, and the decision and backlog records reconciled with what had landed. Documents only — five `docs/engineering/` documents, 309 insertions / 79 deletions; no product source, no test, no dependency. **The twenty-third** documentation checkpoint, which could not name itself — `9fcf008` names it — and the commit **the S-6 boundary gate was built on** |
| Earlier documentation checkpoints (kept as written from the rows the pass above advanced past) | `f0bdecdc39b03bae03c85d3bc8913e87d53bba57` — **the Class Compensation workstream's final domain-gate reconciliation** (*docs(compensation): reconcile final domain gate records*): the chain's last three product commits registered, **D20** decided, **I18**'s status brought up to those packages and the ten mutation checks recorded. It is the commit **the compensation surface was built on** (`fc83d6d` → `79fd44e` → `79ec13d`), and therefore that workstream's **effective safe rollback boundary**. Documents only, three `docs/engineering/` files (103/30); the twenty-second documentation checkpoint (named by `d18d3e3`) |
| Earlier documentation checkpoints (kept as written from the rows the pass above advanced past) | `e7a6d72e561bdbb0d22280e4617141281b62d8b5` — **M7's documentation reconciliation** (*docs(m7): reconcile the relation phase record and close I1*): M7 registered ✅ COMPLETE against its measured evidence, **D17** decided, **I1** closed and **I19** recorded. It is the commit **Class Compensation P1 was built on**. Documents only; the twentieth documentation checkpoint, and `8131c5cd49c35a7163543082475a9635914aba40` — **M6's coverage matrix** (*docs(m6): record the coverage matrix and register the reconciliation*): the milestone's requirement-by-requirement matrix in §4 of this file, which also **registers** M6's reconciliation `e6ab6f90901496be376e2278aa28695e5ab32ab6` because no entry may carry its own SHA; and `e6ab6f90901496be376e2278aa28695e5ab32ab6` — **M6's documentation reconciliation** (*docs(m6): close chat phase documentation*): M6 registered ✅ COMPLETE against its measured evidence, **D14–D16** decided, and `src/domains/chat/README.md` added. Documents only |
| Earlier documentation checkpoints (kept as written from the rows the pass above advanced past) | `8131c5cd49c35a7163543082475a9635914aba40` — **M6's coverage matrix** (*docs(m6): record the coverage matrix and register the reconciliation*): the milestone's requirement-by-requirement matrix in §4 of this file, which also **registers** M6's reconciliation `e6ab6f90901496be376e2278aa28695e5ab32ab6` because no entry may carry its own SHA; and `e6ab6f90901496be376e2278aa28695e5ab32ab6` — **M6's documentation reconciliation** (*docs(m6): close chat phase documentation*): M6 registered ✅ COMPLETE against its measured evidence, **D14–D16** decided, and `src/domains/chat/README.md` added. Documents only |
| Superseded documentation-checkpoint row (kept as written; M5's reconciliation, named in [PHASES.md](PHASES.md)) | `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` — **M5's documentation reconciliation** (*docs(m5): correct checkpoint push record*): M5 registered ✅ COMPLETE, the M5 chain's own accounting corrected to what happened (a locally committed checkpoint whose first push failed on a stale token, then pushed unchanged as a fast-forward — no amend, no force-push, no reset, no rebase), and the M5 documentation checkpoint that was **lost unpushed** recorded as **L5** happening twice rather than papered over. It is the commit M6 was built on. Documents only |
| Baseline commit | `292b8b86ce7dd328b3a1510047f994e39c443a4e` (the graft boundary **of a shallow checkout** — measure whether your clone is shallow rather than inheriting that; see the note at the end of this section) |
| Remote state | **Deliberately not recorded as a value — verify it instead:** `git ls-remote origin refs/heads/<branch>` must return local `HEAD`, or an ancestor of it. Anything else means someone else pushed, or this clone is stale |

### Two kinds of checkpoint

- A **phase checkpoint** is a durable *application* milestone: a reviewed, approved and pushed
  commit that ends a phase of product work. The row above names the latest one the
  documentation-checkpoint ordering rule permits — still `33b1031` (Phase 2) — while the product
  phase's own milestones (M0 `f2ebc09`, M1 `689a7c1`, M2 `c42f274`, M2.1 `73b40d9`, M3,
  implemented at `e5b0a57` and completed at `3bec881`, M4, implemented across `0f875a7`,
  `f8c3472` and `6f54caf` with its acceptance coverage at `df70148`, and M5 at `9505ade`) are
  registered in
  [PHASES.md](PHASES.md) and named in §3. Only a phase checkpoint advances "current
  phase" in §3.
- A **documentation checkpoint** is a pushed commit that changes documents and validation gates
  but no product behaviour. **Twenty-five** are **named** so far — the twenty-sixth is the commit carrying
  this paragraph, which cannot name itself (see the rule immediately below) and must be registered
  by whichever documentation commit comes next: `68b4fe3` (these documents and their gate),
  `77b019ef` (the audit-correction pass, which also made the EMPTY login screen's *labels*
  truthful — the one permitted exception, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) H3),
  `f1fe114` (the retired test-harness race, recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I11),
  `b3ffffd` (the M2.1 validation block's measured timings),
  `9247a17` (M2.1's SHA registered in the ledger),
  `2972a99` (the I11 `LearningPanel` harness fix — one test file and four documents),
  `ea890ae` (I13 Checkpoint 1's validation recorded, M3's gate discharged),
  `be75ac6` (I13 Checkpoint 2 recorded as in progress before its code existed),
  `49fb499` (I13 Checkpoint 2 recorded as landed and validated),
  `85530b4` (I13 Checkpoint 3A recorded as landed and validated),
  `df3db2f` (M3 recorded as in progress at its first checkpoint) and
  `db5ec24` (the detach exposure M3 introduced, recorded rather than hidden),
  `1f98228` (M3's audit findings F2 and F3 recorded, M3 marked complete),
  `eab30d3` (F3's recorded diff scope corrected to the measured numbers) and
  `84fb7cb` (**M4's CP0**, the pre-implementation reconciliation of these documents and the
  scheduling README), `24caf3a` (**M4's final reconciliation**, the same five documents brought
  in line with the milestone that had landed) and `9190da0` (**M5's reconciliation**, which had to
  wait for a later docs commit before it could be named at all — the no-self-reference rule below
  and §7 item 14) `e6ab6f90901496be376e2278aa28695e5ab32ab6` (**M6's documentation
  reconciliation**, named by the commit after it rather than by itself, as that rule requires) and
  `8131c5cd49c35a7163543082475a9635914aba40` (**M6's coverage matrix**, which registered the
  reconciliation and had to be named by a later commit for the same reason) and
  `e7a6d72e561bdbb0d22280e4617141281b62d8b5` (**M7's documentation reconciliation**, named by the
  commit after it — the same rule again), `2600667073b874d2cabb42c1e0b2f5f27234fb55` (**Class
  Compensation P1's documentation reconciliation**, which decided **D18**/**D19** and named `e7a6d72`)
  and `f0bdecdc39b03bae03c85d3bc8913e87d53bba57` (**the Class Compensation workstream's final
  domain-gate reconciliation**, which decided **D20**) and `d18d3e39b513a9031ba8cc8383e7b98d7ae99c99` (**the Class Compensation UI's
  documentation reconciliation**, which named `f0bdecd` and is named by this commit — the same rule once
  more) and `9fcf00891d07db18c718296ccaddc79919c793c1` (**the I21 closure and the S-6 gate
  registration**, named by the commit after it — the same rule again) and
  `3acb5f3be275a67726376adbfed3f3fdf2f1282b` (**the D2 record**, named by the commit after it — the same
  rule again). They are listed in [PHASES.md](PHASES.md) → "Documentation checkpoints" so that `git log`
  never shows a commit this ledger does not explain.

**No self-referential SHAs.** A document cannot contain the SHA of the commit that carries it —
that SHA does not exist until the commit is made. So the documentation checkpoint above is always
the *previous* pushed docs commit, and `git log -- docs/engineering` is the authority for anything
newer. `src/__tests__/projectState.test.ts` enforces the testable form of the rule: every full SHA
quoted in these documents must already exist as a commit and be reachable from `HEAD`, so a pasted
future SHA or an invented one fails the suite instead of misleading the next reader.

⚠️ **Whether this clone is shallow is a fact to measure, not a property to assume.** The
provisioned checkout has been observed shallow — `292b8b8` grafted, its fetch refspec limited to
`main`, only three commits reachable locally at the time of the Phase 2 audit — and history *before*
such a graft never becomes reachable, so read it on GitHub rather than assuming it locally. The
working clone in use at this documentation pass was **not** shallow: it was a full single-branch
clone of the working branch, `git rev-parse --is-shallow-repository` printed `false`, and every
commit these documents quote resolved locally under `git cat-file -e <sha>^{commit}` with the
expected ancestry. Measure it instead of inheriting either answer. A limited refspec has one further
consequence that survives a successful push: `refs/remotes/origin/arena/…` can be missing, so verify
the remote with `git ls-remote origin refs/heads/<branch>`, not with
`git rev-parse refs/remotes/origin/…`.

⚠️ **Unpushed commits are NOT durable in this environment.** Observed on 2026-09-08: the
sandbox workspace was **re-cloned** between turns. The local branch pointer reverted to the
shallow graft `292b8b8`, the reflog collapsed to two entries (`clone`, `checkout`), and a
local-only commit created earlier that day stopped existing as a Git object
(`git cat-file -e <sha>` → `fatal: bad object`). Its **content survived on disk** and was
recovered in full, but its SHA could not be reproduced. Consequences for any session:

- Treat a commit that has not been pushed as **provisional**, never as a checkpoint.
- Verify a recorded SHA still exists locally (`git cat-file -e <sha>^{commit}`) before relying
  on it; verify the remote independently with `git ls-remote`.
- If HEAD disagrees with this document, the working tree is usually still intact: compare it
  against the last pushed checkpoint (`git diff <checkpoint> --stat`) and hash the changed and
  untracked files **before** touching anything. Recovery is a non-destructive
  `git reset --mixed <checkpoint>` — which moves the branch pointer and index only, never the
  files — followed by re-verification that every hash is unchanged.
- Push approved checkpoints promptly.
- **Commit identity and trailer are environment-provided, not versioned.** Commits carry the Git
  identity configured in the clone, and a `commit-msg` hook in `.git/hooks` (which is *not* part of
  the repository) appends a `Co-authored-by: arena-agent …` trailer. After a re-clone that hook may
  be absent, so a missing trailer is cosmetic — never a reason to amend a pushed commit.

## 3. Current phase and status

| Field | Value |
|---|---|
| Current phase | **Product-feature phase — M7 (relation de-fixturing + sidebar badges, **I1**)** |
| Phase status | ✅ **COMPLETE** — M7 was implemented across four checkpoints, CP1 `0d9fc01079039548cf0ffe3c80c5bf2e88056a9c` (the relation plumbing), CP2 `5726435506bd74748f6165819f3c80e30f359b80` (student relations), CP3 `ede3ad6a5e26b1cdfc514962b57ac1302309968c` (teacher relations) and CP4 `f1ec0ddde783aec14d6429ac2457f085f851ad9a` (class relations and the navigation counts), built on M6's documentation reconciliation `8131c5cd49c35a7163543082475a9635914aba40` — which is therefore M7's **effective safe rollback boundary** — and this documentation pass reconciles the record. All pushed. **Accepted with recorded limitations** — see §3 → "Last completed work (M7…)" and §4 → "M7 validation". **I1 is closed at the level it was defined**: `navGroups` carries no number, the one badge with an honest source (unread messages) is read from the chat repository only while that read is complete, and the badge with no scoped source (unrecorded attendance) was **removed** rather than estimated. **H1 is not re-opened**, and the milestone's own limitations are §7 item 17. |
| Previous phase status | ✅ **COMPLETE** — **M6** (contracts without UI: chat management, attachments, export coverage) landed across CP1 `43e7882f051b46abfa9f0530137cedfb3a541ce0`, CP2 `42c54f41ed3099cf65ac4ca035146958a1a51f76`, CP3 `563b8d85ee48614963cb3c182ac9b84239645c3d` and CP4 `4e03b8762bebcb87e46cf7044af5da99d709b4d2`, was reconciled at `e6ab6f90901496be376e2278aa28695e5ab32ab6` plus the coverage-matrix commit `8131c5cd49c35a7163543082475a9635914aba40`, and is **accepted with recorded limitations** (attachment ownership/authorization backend-required, browser-local bytes, a metadata-only single-conversation export with a disclosed ceiling, browser QA NOT VERIFIED — §5, §7 item 15). Before it, **M5** (attendance *view* wiring, **H1b**, and with it the umbrella **H1** and **I12**) landed at `9505ade4011b37a34e3488fd51206512829205ec` and was reconciled at `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`; **M4** at CP0 `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5`, CP1 `0f875a78c99077e25b67b9cc9cffe34c823ee511`, CP2 `f8c3472895978054c8dc81574bb8a945ef3c326d`, CP3 `6f54caf46dc13baca78e376c606a4aa9667cdb48`, coverage `df701488362cb90cf32ccefad277879477571cf7` and reconciliation `24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`; and **M3** at `e5b0a57` → `3bec881`. All pushed, each with its own §4 validation block, kept for audit. |
| Next phase | Product-feature phase — **M8 (branding application & visual identity, D2)** — ❌ **NOT STARTED**, not authorized; **D2 is ✅ recorded (2026-09-16)**, so the decision that gated M8 is discharged and only the authorization remains |
| Working tree | Clean at every recorded checkpoint — **verify, do not trust**: `git status --porcelain` must print nothing |

M0 (`f2ebc09`, spec + decision register, documents only), M1 (`689a7c1`, the recovery UX), M2
(`c42f274`, honest write feedback), M2.1 (`73b40d9`, the two defects M2 found and recorded
rather than fixed), **M3** (implemented at `e5b0a57`, completed at `3bec881` — the
learning-content assignment UI), **M4** (CP1 `0f875a7`, CP2 `f8c3472`, CP3 `6f54caf`, coverage
`df70148` — the scheduling *view* wiring), **M5** (`9505ade` — the attendance *view* wiring) and
**M6** (CP1 `43e7882`, CP2 `42c54f4`, CP3 `563b8d8`, CP4 `4e03b87` — the chat milestone: contracts,
management, attachments and a single-conversation export) and
**M7** (CP1 `0d9fc01`, CP2 `5726435`, CP3 `ede3ad6`, CP4 `f1ec0dd` — the relation de-fixturing and
navigation-count milestone) are
the product phase's completed milestones. M3's surface, its
wiring and its 16 tests are pushed, it went through a formal acceptance audit and it was **accepted
with recorded limitations**; what is *not* true of it — or of any milestone — is browser QA, which
§5 records as NOT VERIFIED for every milestone alike. **M2.1 is not in the M0
specification:** it is **H6** and **H7** from [OPEN_ITEMS.md](OPEN_ITEMS.md), inserted between M2 and
M3 by the owner's explicit decision after a read-only triage, and the spec's M0–M11 sequence is
unchanged by it. **After M3, two pre-M4 remediation commits landed** at the owner's explicit
authorization following that audit — `fba826f` (**C1 / I13 Checkpoint 3B**, scheduling's
`useDerivedRead` carrying its query key) and `7e72887` (**C2**, `useSessions` and
`useAttendanceRecords` taking `Paged<…>` so omitting `per_page` is a compile error). **Neither is a
milestone** and neither advances a row above; both were done *ahead of* M4 rather than inside it, and
`7e72887` is M4's effective safe rollback boundary — and M4 was built on it, in the three
implementation checkpoints named above, after its CP0 documentation reconciliation
(`84fb7cb`, documents only) and its final one (`24caf3a`, documents only). **M5 was built on that
last commit**, in a single implementation checkpoint (`9505ade`), so `24caf3a` is its effective safe
rollback boundary. **M6 (contracts without UI — chat management, attachments, export coverage) landed
after M5's documentation reconciliation (`9190da0`, documents only) across four checkpoints** — CP1
`43e7882` (the chat contract), CP2 `42c54f4` (conversation management and composer state safety), CP3
`563b8d8` (attachments) and CP4 `4e03b87` (conversation export) — **106 new tests, 17 files, no file
outside the chat domain and the Messages surface**; its documentation pass is `e6ab6f90901496be376e2278aa28695e5ab32ab6` plus the commit carrying this
paragraph (the first marks the milestone complete and adds `src/domains/chat/README.md`; the second
records the coverage matrix in §4), and the milestone's own section follows below. **M7 landed after
that reconciliation** — four checkpoints, `0d9fc01` (the relation plumbing), `5726435` (student
relations), `ede3ad6` (teacher relations) and `f1ec0dd` (class relations and the navigation counts) —
closing **I1** at the level it was defined; M7's record was reconciled at `e7a6d72`, **Class
Compensation P1** landed on top of it at `a21311d` as a **non-milestone workstream** (§3 below), and
**M8–M11 have not started** — the ledger in
[PHASES.md](PHASES.md) marks the product-feature phase's remaining milestones NOT STARTED.

### Last completed work (Phase 2, in one paragraph)

Demo seeding was removed from every read path and replaced by an explicit, persisted
lifecycle owned by `src/domains/demo/lifecycle.ts`: `UNINITIALIZED → { EMPTY | DEMO }`,
chosen once by the visitor through `src/components/lifecycle/FirstRunChooser.tsx` behind
`src/components/lifecycle/DataLifecycleGate.tsx`. The marker lives in `ava:demo:lifecycle`
(`src/services/demoStore.ts`). EMPTY is a first-class, usable environment (zero content
records plus one bootstrap admin); DEMO is an explicit showcase/QA environment and the only
place demo media (`res1` / `md_demo_res1`) exists. Legacy marker-less datasets are adopted
as DEMO once, preserving every record. Reads never write. An empty-state audit of all 16
surfaces fixed three real `NaN` bugs and one lying hint at the computation boundary
(`src/lib/stats.ts`, `src/lib/format.ts`, `src/views/Classes.tsx`, `src/views/Teachers.tsx`)
and removed demo labelling from a customer EMPTY environment
(`src/components/settings/DemoDataPanel.tsx`).

### Last completed work (M1, in one paragraph)

`clear()` empties every collection including `users`, so it can lock a customer out of an
environment whose Settings (and therefore backup restore) sit behind the login. M1 adds a way back
**without changing `clear()`**. `uninitializeEnvironment()` (`src/domains/demo/lifecycle.ts`,
unchanged) is now reachable through the existing destructive-action seam:
`src/domains/demo/useDemoData.ts` adds `"uninitialize"` to `DestructiveAction`/`DESTRUCTIVE_LABELS`
and awaits `manager.uninitialize({ confirm: true })`. `src/components/lifecycle/DataLifecycleGate.tsx`
owns the recovery controller and publishes it through
`src/components/lifecycle/LifecycleRecoveryContext.ts`, wrapping both gate branches so the awaited
blob-cleanup result survives the store reset that returns the boot chain to
`src/components/lifecycle/FirstRunChooser.tsx`. The visible affordance
(`src/components/lifecycle/LifecycleRecoveryPanel.tsx`) renders only from the unauthenticated
`src/views/Login.tsx` branch, only for a local `empty`/`demo` environment, never in `api` mode; it
is two-step, shows `manager.stats()` counts, and warns truthfully about account deletion, lockout,
stored binaries and irreversibility. A blob-store failure is surfaced verbatim, never swallowed. D3
and D4 are recorded in [DECISIONS.md](DECISIONS.md) §19 as M1-specific decisions; **H5** in
[OPEN_ITEMS.md](OPEN_ITEMS.md) is landed and I10's zero-record invariant is preserved (no bootstrap
account is re-added to a cleared dataset).

### Last completed work (M2, in one paragraph)

The panel stopped claiming things it did not do. Seven controls reported a write or a delivery that
never happened (**H2**): two scheduling conflict buttons announcing a room transfer — one of them
also announcing that a teacher and a student had been notified, and closing the drawer that held the
evidence — an attendance "mark all present" saying «ثبت شدند» for a React state change, an absentee
"follow-up" saying a student **and their guardian** had been messaged, two finance reminders
announcing an SMS and an invented queue, and a class-waitlist button announcing a suggestion filed
with scheduling. None of these views can write, so none could become an awaited repository call:
each now reports honestly in `info`, performs the one truthful action available (the waitlist button
opens the schedule), or is **removed** — removed rather than disabled, on the owner's explicit
decision, because a disabled control still advertises a capability the product does not have. Five
confirmations of *real* writes (**H3**) called the saved record demo data in every environment; they
now take their wording from `useIsDemoEnvironment()`, so a customer's EMPTY environment reads
«تغییرات در داده‌ها ذخیره شد.» while DEMO keeps saying «…دادهٔ دمو…», and `src/views/Students.tsx` —
which carried two copies of that literal, one per dialog mount — has a single shared confirmation.
Nothing else moved: no domain, repository, hook, fixture, lifecycle file or dependency changed, demo
and `api` mode behave identically, and every site on H2's verified "not fake" list is untouched,
including the attendance «ثبت نهایی» toast that M2 read as arguably still dishonest and left alone by
decision (**I12**). Three findings the work surfaced were **recorded rather than fixed**, because
M2's scope was approved before they were found: **H6** (every edit dialog opens with an empty draft,
so a partial save silently overwrites the stored record), **H7** (three Settings panels carry the
identical demo mislabel) and **I12**. All three are in [OPEN_ITEMS.md](OPEN_ITEMS.md) with evidence,
and H7 is ratcheted by `src/__tests__/writeFeedbackHonesty.test.ts` so the set of offenders can only
shrink.

### Last completed work (M2.1, in one paragraph)

The two defects M2 recorded instead of fixing are fixed. **H6** was silent, durable data loss:
`useEntityForm` seeded its draft with `useState(initial)` and nothing ever re-synced it, the six edit
dialogs stay mounted while closed, and no parent keyed them by record — so a dialog opened on record
B still held the empty create defaults, or whatever had been typed for record A before a cancel, and
submitting wrote that onto B's id. Because `demoStore`'s update is a spread merge and its `clone` is
`structuredClone`, an explicit `undefined` in the payload *erased* the stored field: a student's
photo and guardian, a teacher's biography, a piece's programme link. The defaults were the dangerous
part — «piano», «active», «17:00», capacity 6 all look like data — and two of them reversed
documented rules, since an edit silently re-activated a deactivated instrument, room or piece and
silently un-archived a class. The fix sits at the hook boundary: `EntityFormOptions` gained `open`,
the draft is rebuilt from the newest `initial` whenever the surface opens, and the six dialogs pass
the prop they already had. **H7** was the identical mislabel M2 removed from the five domain
surfaces, in the three Settings panels that audit did not enumerate (`InstrumentsPanel`,
`RepertoirePanel`, `RoomsPanel`); each now derives its confirmation from `useIsDemoEnvironment()`
exactly as `BrandingPanel` does, so the `writeFeedbackHonesty` ratchet's tracked debt is **empty**
and the three panels joined the list of surfaces pinned as deriving their copy. Nothing else moved:
no repository, store or merge semantics, no domain model, no fixture, no dependency — and the two
dialogs that were already correct (`AssignPieceDialog` and `RecordProgressDialog`, which their panel
mounts conditionally) were deliberately left alone.

### Last completed work (M3, in one paragraph)

**M3 is the learning-content assignment UI, and its gap was a UI and workflow gap, not a schema
one.** `LevelContentLink`, `listLinks` / `attachContent` / `detachContent`, link ordering and the
`CONTENT_ALREADY_LINKED` conflict already existed, were already tested, and were called by nothing
but tests — the recorded **I3**. At `e5b0a57` the contract has a surface:
`src/domains/learning/LevelContentPanel.tsx` (new) lists the content a level really links, offers
the active catalogue minus what is already linked, and writes through the repository verbs;
`src/domains/learning/LearningPanel.tsx` gained a per-level «منابع» toggle (+66 lines, no deletions)
that opens it, with the surface rendered **outside** the levels column so its content rows can never
be counted as levels by the protected harness. There is no second source of truth: the list under a
write refreshes from `demoStore`'s data-version bump, the picker's offers are derived from the
repository's rows, the pick itself is derived from *this* level's rows so a choice made for another
level collapses instead of becoming a write target, and the selection is dropped when the program
changes. **The write invariant is honoured where it lives — the wiring:** `levelId` comes from the
rendered row while `AttachContentIntent.programId` comes from the programs query the panel selected,
never from `level.programId`. Because those two can disagree (`useResourceList` commits a frame
holding the previous program's levels on a switch — **I11**/**I13**), the adversarial case reproduces
that crossed page at the repository boundary and asserts both halves: the repository was handed the
independent program, and it therefore refused the write. Mutating the wiring to
`contentLevel.programId` — the exact shape I13 Checkpoint 2's caveat warned about — turns that case
red, so the invariant is pinned by a test that fails without it. **What did not move:** no schema,
model, repository, fixture, dependency or router change; the three files M3's spec protects
(`LearningPanel.test.tsx`, `StudentLearningPanel.test.tsx`, `demoRepository.test.ts`) are untouched
and green; and the spec's *optional* student-scoped read was deliberately **not** added, so I13
Checkpoint 3A's `useDerived` fix is landed but has no M3 consumer — recorded as unused rather than
claimed as a dependency satisfied. **What M3 then went through.** A formal **acceptance audit** at `db5ec24` enumerated every clause of
the spec's M3 section and answered each one PASS / PARTIAL / FAIL / NOT VERIFIABLE against
file-and-line evidence. It found one product defect (**F1**: the picker's catalogue read discarded
`error`, so a failed catalogue rendered as «منبعی برای اتصال باقی نمانده» — a false empty), one
documentation contradiction (**F2**: this ledger named M3's *own* checkpoint as its rollback
boundary, where the spec names the predecessor) and one evidence shortfall (**F3**: the recorded
validation claimed three consecutive full-suite runs where the spec's Tests clause requires six for a
milestone touching a file that has ever flaked). **All three are resolved:** F1 at `3bec881` with a
regression case and a reversion check; F2 in [PHASES.md](PHASES.md) → "Product phase — M3", which now
records **both** boundaries — the spec's `c42f274` (M2) and the effective safe one, `85530b4`, because
rolling back to M2 would destroy M2.1 and the three accepted I13 checkpoints; F3 in §4 below.
**M3 is COMPLETE, accepted with recorded limitations**, and **browser QA has never run** (§5). What
completion does *not* claim: the detach stale-context exposure (**I13**, still open), the
`per_page: 200` ceilings (**I16**), the fourteen other consumers that discard `error` (**I15**),
link order being invisible to the operator (**I17**), the absent storage round-trip test, and D8's
api-mode indicator, which does not exist until **M11**.

### Last completed work (M4, in one paragraph)

**M4 is the scheduling *view* wiring, and its gap was the same shape as M3's: a domain that was
complete, tested and called by nothing but tests.** Group A's 211 tests pinned the `Session` model,
the conflict engine, the generation engine, the Jalali bridge and every repository invariant, while
`src/views/Scheduling.tsx` rendered `weekSessions`, `rooms`, `teachers` and `TODAY_INDEX` from
`src/data/records.ts` — a frozen weekday as "today", a hardcoded room-4 transfer narrative and
fabricated occupancy and free-slot sentences (**H1a**, carrying **H4**'s shape inside this view). At
**CP1** (`0f875a7`) the fixtures left the view: every row is now a `Session`, read through
`useSessions` for a bounded `from`/`to` window (`src/views/Scheduling.tsx:311`), labelled from the
classes, rooms and teachers domains, dated through `dateBridge` and anchored on `useAcademyNow`
instead of on a constant. At **CP2** (`f8c3472`) the view acquired its first two real writes —
**reschedule** and **cancel** — in a new `src/views/scheduling/SessionWriteDialogs.tsx`, and at
**CP3** (`6f54caf`) its third, **generation**, in
`src/views/scheduling/GenerateSessionsDialog.tsx`.

**The domain was not touched, and that is measurable rather than asserted.** Across
`7e72887..df70148` the only path under `src/domains/` that changed is
`src/domains/scheduling/README.md` — a document. The six **Group A** files are untouched and still
green at **211** tests, `src/domains/scheduling/useScheduling.ts` is unchanged, no dependency was
added or removed, and the registry still resolves scheduling to the demo implementation in both
modes (`src/domains/registry.ts:197`). **No copy added by this milestone implies a server:** the
writes really happen and really persist *locally*, and `apiRepository.ts` stays deliberately
unregistered.

**The write invariants stay in the repository; the view only calls them, awaits them and reports what
happened.** Success is announced only after the promise resolves and names only the operation that
ran — no «تعارض برطرف شد», no teacher or student notification, no SMS. Failure is announced in
`danger` with `apiErrorFromThrown(cause).message`, the repository's own sentence, so
`SESSION_HAS_ATTENDANCE`, `SESSION_ALREADY_CANCELLED`, `SESSION_CANCEL_REASON_REQUIRED` and
`SESSION_CONFLICT` reach the operator in the domain's words. Nothing is mutated optimistically, so a
refusal leaves the calendar exactly as it was. The write target is the **derived** selected session —
an id resolved against the loaded page — so when the window changes and the id no longer resolves
there is no target and no dialog (**D11**'s derive-rather-than-store rule, and **D10**'s discipline
of resolving a write against what is actually loaded), asserted by
`src/views/__tests__/schedulingStaleWindow.test.tsx` — asserted, not mutation-checked: §4 records that
no mutation or reversion check exists for CP1–CP3. Generation plans nothing itself:
`useGenerationPreview` asks the repository for the plan, the dialog renders the domain's own numbers,
labels and protections, and `generateSessions` re-plans before writing, so the preview is labelled a
preview and the write stays refuseable.

**I16's calendar mitigation is implemented here, and I16 is still open.** Every read states its own
ceiling (`src/views/Scheduling.tsx:116`), the window is bounded by the mode the operator chose, the
counts come from `Page.meta.total` rather than `items.length` (`:458`), a truncated answer says so in
its own words (`:563`), and the per-day counts are **withheld** while that notice stands (`:711`) — a
partial page is never dressed as a complete one. What that does *not* do is close **I16**: the
ceiling is still 200, `useClasses`, `useRooms` and `useTeachers` are still not `Paged<>`, and every
other consumer is untouched.

**Two landed gates named this view as fixture-driven, and M4 reconciled them without weakening
either.** `src/__tests__/writeFeedbackHonesty.test.ts` moved `views/Scheduling.tsx` out of
`FIXTURE_DRIVEN_VIEWS` and into a new `GRADUATED_VIEWS` ratchet asserted in both directions — the
file must reach `getSchedulingRepository(` *and* report the success it can now honestly claim — so
the view can neither slip back into the fixture list nor keep a toast after losing its write.
`src/__tests__/architectureBoundaries.test.ts` added `useClasses`, `useRooms` and `useTeachers` to
`PAGE_SIZE_CALLERS`, the gate C2 could not express in types.
`src/views/__tests__/noSuccessWithoutWrite.test.tsx` was re-driven from the repository instead of the
`weekSessions` fixture.

**Tests — 63 new cases in five new view files, plus the coverage checkpoint.**
`src/views/__tests__/Scheduling.test.tsx` (15) ·
`src/views/__tests__/schedulingNoFixtures.test.ts` (14) ·
`src/views/__tests__/schedulingStaleWindow.test.tsx` (3) ·
`src/views/__tests__/schedulingWrites.test.tsx` (16) ·
`src/views/__tests__/schedulingGeneration.test.tsx` (15). `df70148` then added the acceptance
coverage the M4 audit asked for as **B1** and **B2** — **+402 / −13** across
`schedulingWrites.test.tsx` and `schedulingGeneration.test.tsx`, **test files only**, no product
source and no assertion removed.

**What M4 went through, and what it did not.** A read-only **acceptance audit** of the milestone at
CP3 (`6f54caf`) returned **ACCEPT with non-blocking follow-ups**. The two follow-ups that were
coverage findings (**B1**, **B2**) are closed at `df70148`; the remaining ones were **deferred by the
owner's explicit instruction rather than landed**, and this ledger does not describe them as done.
**The audit's mutation and reversion checks for CP1–CP3 were never recorded, and are not claimed
here** — §4 states that absence explicitly instead of inventing evidence. **Browser QA has never
run** (§5). What completion does *not* claim: **H1 stays OPEN**, because H1b (attendance) is M5's and
the umbrella item closes only when both views are wired *(superseded: M5 landed and closed H1b, so
**H1 is closed**; this sentence is M4's record and is kept as written)*; `useSessionRoster` is still
unconsumed, so the roster a session really has is still not rendered *(superseded in an unexpected
way: M5 renders that roster through the **attendance** domain's derived register, and
`useSessionRoster` stays unconsumed, now belonging to no milestone)*; there is no create, edit or delete surface —
five repository verbs (`get`, `create`, `update`, `delete`, `sessionRoster`) remain unconsumed, each
with its reason recorded in `src/domains/scheduling/README.md` §3; the fixture view's
recurrence-scoped controls («فقط این جلسه» / «این و جلسات بعدی») are gone with the fixtures rather
than reimplemented, because no domain contract exists for a recurrence write; teacher and student
notifications stay deferred; **I13** and **I16** stay open; and **D8**'s api-mode indicator does not
exist until **M11**.

### Last completed work (M5, in one paragraph)

**M5 is the attendance *view* wiring, and its gap was the same shape as M4's: a domain that was
complete, tested and — for the register a session really has — called by nothing but tests.**
**Group D**'s 79 tests pinned the append-only record model, the roster derived from Enrollment, the
atomic bulk save, the reason-gated correction trail and every repository invariant, while
`src/views/Attendance.tsx` rendered `todayAttendance`, `attendanceTrend` and `attendanceByDay` from
`src/data/records.ts`: eight registers keyed by legacy ids `g7`–`g15` that match no session the
scheduling domain has ever produced, a hardcoded 92٪ «نرخ حضور امروز» against an 89٪ «میانگین ماه», a
per-instrument breakdown nobody computed, and a «ثبت نهایی» button that flipped local React state,
stamped a hardcoded recorder name and announced a save (**H1b**, carrying **H4**'s shape inside this
view, with **I12** recording the wording). At `9505ade` the fixtures left the view: a bounded window
of real `Session` rows read through `useSessions` from the academy's own clock
(`src/views/Attendance.tsx:208`), the session the operator picks **derived** from that window rather
than stored (`:237`), one derived register through `useSessionAttendance` (`:241`), the window's marks
and its recorded absences through two `useAttendanceRecords` reads the repository itself filters
(`:215` and `:217`), and the append-only correction trail through `useAttendanceCorrections` (`:219`),
never fetched whole. Honest empty states come with it: an empty window says the window is empty, an
empty roster says the roster is empty rather than showing unmarked students, and a read that failed is
reported as a failure with its own message and a retry (**D12**). *(M4's paragraph above is kept as
M4's own record; where it says **H1 stays OPEN** because H1b is M5's, that was true of M4 and is
superseded here.)*

**The domain was not touched, and that is measurable rather than asserted.** Across
`24caf3a..9505ade`, `git diff --name-only -- src/domains/` prints **nothing**: not one file under any
domain directory changed, which is a stronger statement than M4's, whose only domain-path change was
a README. The three **Group D** files are untouched and still green at **79** tests, the six
**Group A** files at **211**, `src/domains/attendance/useAttendance.ts` is unchanged, no dependency
was added or removed, **no new repository verb and no new API endpoint appeared anywhere**, no
attendance or scheduling contract changed, and the registry still resolves attendance to the demo
implementation in both modes (`src/domains/registry.ts:209`). **No copy added by this milestone
implies a server:** the writes really happen and really persist *locally*, and
`src/domains/attendance/apiRepository.ts` stays deliberately unregistered.

**Three real writes, all awaited, all refused in the repository's own words.** `record` marks one
student (`src/views/Attendance.tsx:304`), `bulkRecord` saves every unmarked student on the register
in one atomic act (`:349`), and `correct` changes a mark and appends an immutable correction with a
required reason (`:390`), driven by `src/views/attendance/CorrectMarkDialog.tsx`; the register itself
is `src/views/attendance/RegisterPanel.tsx`. Success is announced only after the promise resolves and
names only what happened — «… ثبت شد» for one mark, «{faNum(n)} حضور ثبت شد» for a bulk save,
«وضعیت اصلاح شد» for a correction — each with a detail stating what did *not* happen («چیزی حذف نشد و
اطلاع‌رسانی انجام نشد»). The retracted claim «همه حاضر ثبت شدند» is gone and pinned as forbidden; the
bulk control is labelled with the count it will write, «همه حاضر (N)», and is **withdrawn** rather than
disabled when there is nothing to write, no permission, or a locked session. Failure is announced in
`danger` with `apiErrorFromThrown(cause).message`, so `ATTENDANCE_DUPLICATE`,
`ATTENDANCE_REASON_REQUIRED`, `ATTENDANCE_SESSION_CANCELLED`, `ATTENDANCE_STUDENT_NOT_ON_ROSTER` and
`ATTENDANCE_RECORDER_REQUIRED` reach the operator in the domain's words. Nothing is mutated
optimistically, and every write re-reads after it resolves, so a refusal leaves the register exactly
as it was.

**Provenance comes from the authenticated principal, and the write controls come from RBAC.** The
recorder is `user?.id` (`src/views/Attendance.tsx:174`), never a fixture name and never a form field
— which is what **I12** required when it deferred itself to this milestone — and `canWrite` is
`useCan("attendance.write")` paired with a non-null principal (`:175`). A user without the permission
sees the register and **no write control at all** rather than a disabled one (M2's rule).
**Cancellation and lock protection stay domain-owned:** the view reports the `locked` flag the
repository derived from `session.status === "cancelled"` and withdraws its controls; it never decides
lock state itself, and the protection a mark creates for scheduling is asserted through the registry's
presence seam rather than reimplemented here.

**Two landed gates named this view as fixture-driven, and M5 reconciled them without weakening
either.** `src/__tests__/writeFeedbackHonesty.test.ts` moved `views/Attendance.tsx` out of
`FIXTURE_DRIVEN_VIEWS` — which now holds Finance and Reports only — and into `GRADUATED_VIEWS`,
asserted in both directions: the file must reach `getAttendanceRepository(` *and* report the success
it can now honestly claim. `src/views/__tests__/noSuccessWithoutWrite.test.tsx` was re-driven from the
repository instead of the `todayAttendance` fixture, growing from **11** cases to **14**.
`src/views/__tests__/emptyEnvironment.test.tsx` changed **labels and comments only**: its describe
block now says "two of four still fixture-driven" instead of three, and a comment records why
`attendance` stays in that file's list — moving it would add the `inFlightMarkers() === 0`
expectation the milestone was not authorized to introduce, a semantic change declined rather than
made. `src/__tests__/architectureBoundaries.test.ts` needed **no** new entry: the three hooks this
view calls were already in `PAGE_SIZE_CALLERS`, and the view states a page size on every bounded read
(`src/views/Attendance.tsx:112`).

**Tests — 53 new cases in two new view files, and three mutation checks.**
`src/views/__tests__/attendanceNoFixtures.test.ts` (31, structural: no fixture import, no fixture
symbol, no computed percentage, none of the five fabricated figures, no retired narrative, no
hardcoded session id or ISO date, a page size on every bounded read, no verb the repository does not
have, the RBAC gate, and **I13**'s defect kept visible) ·
`src/views/__tests__/attendanceWrites.test.tsx` (22, behavioural: the four read states, a truncated
page, a crossed register, a cancelled session, an empty roster, the three writes and their refusals,
the correction trail read back, permission and provenance, the scheduling protection a mark creates,
and a customer's own EMPTY environment). Unlike M4's CP1–CP3, this milestone carries **mutation
evidence**, measured during the documentation pass that follows it and taken **in a throwaway
`git worktree` at `9505ade`, so the working tree was never modified at all**: reintroducing a
fabricated rate (`faPercent(92)`) into the view fails **2 of 31**; removing the register's
session-identity guard fails **2 of 53** across the two files; removing the RBAC gate fails **3 of
53**. Each injection was reverted inside the worktree, both suites re-ran green at **53/53**, and the
worktree was removed. What that evidence is *not*: it is three checks against two files, not a
per-checkpoint matrix, and no **acceptance audit** of this milestone ever ran, so there are no audit
findings to close and none are claimed.

**What M5 went through, and what it did not.** **Browser QA has never run** (§5). What completion
does *not* claim: the academy-wide rate, trend and per-day analysis the fixture view faked is **gone,
not rebuilt** — no rate, no trend, no chart, no per-instrument breakdown and no «آخرین حضور»
projection, because the window this view reads cannot support them honestly; per-student longitudinal
history does not exist; no guardian or teacher notification is sent (**D1**, **I7**); there is **no
un-record, no edit and no delete** of a mark, and no way to edit or delete a correction, because the
model is append-only; `get` and `sessionIdsWithAttendance` have no shipped UI caller, and scheduling's
`useSessionRoster` is **still** unconsumed — M5 read the attendance domain's own derived register
instead, so the roster a session really has is rendered from attendance and that scheduling verb now
belongs to no milestone; **I13 stays OPEN** with a view-boundary mitigation only, because
`useSessionAttendance` still does not carry its query key and the hook was frozen; **I16 stays OPEN**
with this view's ceilings stated rather than removed; the legacy `attendance` seed collection survives
with no reader in the view that owns it (**D5**, M10); `apiRepository.ts` stays unregistered, so
backend aggregation does not exist; and **D8**'s api-mode indicator does not exist until **M11**.

### Last completed work (M6, in one paragraph)

**M6 — contracts without UI (chat management, attachments, export coverage) — is ✅ COMPLETE**, and
it is the milestone that took the chat domain's un-consumed contract to a wired, tested surface. It
was implemented in four checkpoints on top of M5's documentation reconciliation
`9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`, which is therefore M6's **effective safe rollback
boundary**:

- **CP1 `43e7882`** — the contract, and only the contract. `SendMessageInput.mediaId?: string` added;
  `updateConversation` accepting `archived?: boolean` (so **archive is reversible** and no unarchive
  verb had to be invented) with `archiveConversation` delegating to that same write path; and
  `sendMessage` refusing a `mediaId` that does not resolve (`MESSAGE_INVALID`, `fields.mediaId`)
  **before** provider delivery and **before** any write, so a message can never point at an asset
  that does not exist and a refusal leaves no thread preview behind. The attachment is a reference:
  a 1 MB upload grows the persisted message row by under 500 characters (measured). 31 new domain
  tests.
- **CP2 `42c54f4`** — the first UI for three verbs that had **zero callers** since Phase A
  (`updateConversation` rename/topic/pin, `archiveConversation`), plus the archive filter, the
  archived badge, and the **explicit hidden-selection panel** that replaced silent retargeting (a
  selection a filter hides says so, with the way back). Composer state became conversation-keyed
  (`useComposer`), so a draft typed for one thread cannot follow the operator into another or be
  resurrected on the way back, and a send resolving after a switch cannot clear the new draft. The
  message read's `error` is no longer discarded at `Messages.tsx` (**I15** at this site): a failed
  read is a failure with the repository's own reason and a retry, never «هنوز پیامی رد و بدل نشده».
  22 new view tests; the dialog resolves its repository **at call time**.
- **CP3 `563b8d8`** — real attachments. The disabled paperclip became a real picker; the allow-lists
  and size ceilings are **derived from the media contract** (`allowedTypesFor`/`maxBytesFor`) rather
  than re-typed; the send is **two awaited writes and one claim** — `MediaRepository.create` then
  `ChatRepository.sendMessage`, with success reported only after both resolved, an in-flight guard
  against duplicate submits, and the stored asset released if the message write fails (so a retry
  cannot strand a copy). Rendering resolves the stored reference through the media repository and
  reports missing bytes or an unresolvable reference honestly, with **no fabricated object URL and no
  open/download affordance that could not work**. The fixture gate was extended and now scans the
  whole surface **discovered from the directory**, not one file. 30 new tests.
- **CP4 `4e03b87`** — single-conversation export, as a plain-text transcript read from the
  repositories at call time (`getConversation` + `listMessages`, the same two reads the UI uses — no
  export verb was added). The id is captured when the operator asks, so a list that changes cannot
  retarget it; the download happens only **after** the read resolved, through the export domain's
  existing `downloadBlob` seam; attachment **metadata** is included and the bytes are not, stated in
  the file itself; the 1000-message ceiling is disclosed rather than silently truncating; and an
  empty conversation produces an honest empty transcript, never a fabricated one. 23 new tests
  (21 export + 2 gate).

**Totals (measured, `git diff --shortstat 9190da0..4e03b87`):** 17 files, 4 321 insertions, 61
deletions — the chat domain's three implementation files, `src/views/Messages.tsx`, five new files
under `src/views/messages/`, and seven test files. **No file under `src/services/`, `src/api/`,
`src/context/`, `src/components/` or the media domain changed at all**, no dependency was added, and
the suite grew from **1 549 to 1 655 passing tests (+106)**.

**M6 is complete *with limitations*, and they are not closed by declaring it complete** — the full
list is §7 item 15: attachment **ownership and authorization remain backend-required** (the frontend
checks that a reference resolves and claims nothing more), attachment **bytes live in this browser's
blob store** and are not in any export, no server persistence, no signed URLs, no scanning, no
non-`in_app` delivery, no bulk export and no PDF/ZIP/CSV pipeline for chat, and **M6 registered two
deliberately UI-less capabilities rather than pretending coverage** — `archiveConversation` (the
manager dialog archives and restores through `updateConversation`, because one write path is what
makes restore provable) and the fact that a single-conversation export is served by existing reads.
**Browser QA has never run** (§5) — the real file-picker and file-download paths are precisely what
jsdom cannot exercise.

### Last completed work (M7, in one paragraph)

**M7 — relation de-fixturing + sidebar badges (**I1**) — is ✅ COMPLETE**, and it is the milestone that
took the three profile surfaces' *relations* off the fixture layer and made the navigation chrome stop
claiming numbers nobody measured. It was implemented in four checkpoints on top of M6's coverage-matrix
commit `8131c5cd49c35a7163543082475a9635914aba40`, which is therefore M7's **effective safe rollback
boundary**:

- **CP1 `0d9fc01`** — the plumbing, and only the plumbing: the per-surface fixture gate
  (`src/views/__tests__/relationsNoFixtures.test.ts`, created with five surfaces — the plumbing, the
  three views and the navigation — each staged or enforced, and each rule carrying a probe so a rule
  that protects nothing fails), the through-route suite
  (`src/views/__tests__/relationsPlumbing.test.ts`), and the two shared helpers the surfaces need:
  `src/views/relations/academyDay.ts` (the academy's calendar day and its Saturday-first weekday index,
  reformatted from `academyNow()` — no `new Date()`, no second clock) and
  `src/views/relations/indexById.ts` (one id-index per loaded page, so resolving a foreign key is not a
  per-row scan and the fixture resolvers have no reason to return).
- **CP2 `5726435`** — student relations: the student profile's class names, teacher name, room names
  and weekly sessions come from `useClasses`, `useTeachers`, `useRooms`, `useEnrollments` and a bounded
  `useSessions({ from, to, per_page })` window anchored on the academy day. **7 new tests.**
- **CP3 `ede3ad6`** — teacher relations: a teacher's classes, students, rooms and week come from the
  teachers' own domain reads, `TODAY_INDEX` and the `weekSessions`/`classById`/`studentById` resolvers
  leave the view, and the detail resolves its selection by id with the consumer-side key guard
  (`key={detail.id}`) because `useStudentList` is the one list hook without the render-time
  query-identity invariant (**I13**). **11 new tests.**
- **CP4 `f1ec0dd`** — class relations and the navigation counts: instructor and studio resolve through
  `useTeachers`/`useRooms`, the roster is the **canonical enrollment relation** (active enrollments
  joined to the student rows) and never `AcademyClass.studentIds`, seat/waitlist/occupancy figures come
  from that same bounded read and print «—» with an «N ردیف از M» note when the page was partial, the
  week is one bounded windowed session read, the rooms panel is the room repository, and the fabricated
  deltas (`delta: 3.4`, `delta: 2.1`) are gone along with the `TODAY_INDEX`/`weekSessions` coupling. In
  the chrome: `NavDef.badge` is **removed** from `src/data/academy.ts`, the messages badge is the sum of
  `unread` over the conversation rows the chat repository returns (rendered only while that read is
  complete, so in-flight, failed, partial and zero all show nothing), the attendance badge and its
  «۳ کلاس ثبت‌نشده» hint are **removed** because no scoped pageable unrecorded-sessions read exists,
  the command hints name a target or a filter instead of a count, and the quick-action room option and
  recipient group carry no figure. **20 new tests** (13 classes, 7 navigation).

**Totals (measured, `git diff --shortstat 8131c5c..f1ec0dd`):** 13 files, 4 842 insertions, 321
deletions — the three views, `src/data/academy.ts`, `src/components/layout/Sidebar.tsx`, two new modules
under `src/views/relations/` and six new test files. **No file under `src/domains/`, `src/services/`,
`src/api/`, `src/context/` or `src/components/` changed except `Sidebar.tsx`**, no dependency was added,
and the suite's shape moved from M6's recorded **119 files / 1 655 passed / 8 skipped / 1 failed** (no
`dist/`) to **125 files / 1 729 passed / 0 skipped / 2 failed** (measured here with `dist/` built):
**+6 files** and **+67 cases** in six new test files, the eight CSP cases that stop skipping once a
build exists, and the date-dependent `schedulingWrites` case that began failing when the sandbox clock
reached the weekday its fixture assigns to `cl2` — **+1 failure, not a regression** (§7 item 18). The
arithmetic is auditable: 1 655 + 8 + 1 = 1 664 cases at M6, + 67 = 1 731 = 1 729 passed + 2 failed.

**M7 is complete *with limitations*, and they are not closed by declaring it complete** — the full list
is §7 item 17: the fixtures themselves are not deleted (**M10**/**D5**; the three roles — types, the
canonical DEMO seed, and fake data for unwired views — are untouched), `useStudentList` is still
un-keyed (**I13**) and M7 reached it from three surfaces, mitigating the exposure with the same
consumer-side key guard M5 used and recording it as a mitigation rather than a closure, the
`per_page: 200` ceilings stay (**I16**), the palette's substring matching is untouched (**L1**), the
dashboard insight panels, `Library`, `Settings` and the chat template list still read fixture values
(**M9**/**M10**), and **browser QA has never run** (§5) — the navigation badge, the three rewired
surfaces and their empty/partial/error states are jsdom-verified only.

**One product requirement was recorded during this closure and deliberately not designed:** a cancelled class or teacher session leaves the **affected students owing a compensatory session**, whose stated default is a **one-hour session the same day** and otherwise a date and time **coordinated with the secretary**. It is an **open design item only** — [OPEN_ITEMS.md](OPEN_ITEMS.md) **I18**, and §9 of [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) — recorded at the owner's instruction. M7 built none of it: no compensation entity, no verb, no reminder, no UI, no scheduling contract change, and no part of it may be reported as started.

### Last completed work (Class Compensation P1, in one paragraph)

**Class Compensation P1** — the make-up obligation owed for a cancelled one-to-one session — shipped at
`a21311d7e32c82e3a46b1581c94f6b3478bf646c` on base `e7a6d72` (M7's reconciliation), as a **workstream,
not a milestone**: the phase-checkpoint row does not move and the M0–M11 sequence is untouched. The
model is an obligation of its own (`src/domains/compensation/types.ts`) rather than a flag on a
`Session`: linked to the cancelled session by the typed `originalSessionId`, with the affected student
frozen from the scheduling domain's derived roster, an **append-only** attempt ledger, and a state that
is **derived on read** — `completed` when a discharge was recorded, `scheduled` when the newest
attempt's session is live, `required` otherwise. Cancelling the make-up therefore returns the
obligation to `required` with no write, no listener and no hook inside `cancelSession`, and the
cancelled attempt stays in the history; a discharge is terminal, and a later cancellation is reported
as a contradiction (`attemptBroken`) rather than reopening the debt. Eligibility is
`AcademyClass.kind === "private"` and never roster size; **cancellation registers nothing** — a
secretary, manager or admin holding `schedule.write` registers it explicitly, and a teacher cannot
register, book or discharge — all three verbs refuse an actor without `schedule.write`
(`COMPENSATION_FORBIDDEN`, `authorization`/403), as their first statement, through the existing role
matrix and `can()`, and that refusal is **client-side**: the server must re-derive the actor from the
token (MF-2); an attendance mark on the cancelled original refuses registration unless
it is explicitly acknowledged, and the mark is derived on read rather than copied; at most one
obligation exists per `(originalSessionId, studentId)` for the pair's lifetime, so `register` is never
an upsert; and the make-up is an **ordinary session** created through the scheduling repository's own
`create()` verb, with the original's date, room and teacher one hour long as a **prefill only** — no
automatic booking and no free-slot search. The domain ships `src/domains/compensation/README.md`, five
verbs (`list`, `get`, `register`, `schedule`, `complete` — deliberately no reopen verb), a registry seam
at `src/domains/registry.ts:231`, the `sessionCompensations` dataset collection, and **69 tests in five
new files**. Nothing under `src/domains/scheduling/` or `src/domains/attendance/` changed, `Session` and
`SessionStatus` are untouched — and at that commit there was **no UI and no `apiRepository`**; the
surface followed in the same workstream (the paragraph below), still without an `apiRepository`. See §4
→ "Compensation P1 validation" and "Compensation UI validation", and §7 item 19.

### Last completed work (Class Compensation UI — the secretary surface, in one paragraph)

**The compensation surface** shipped in three commits after P1's reconciliation, as the same
non-milestone workstream: `fc83d6d` (*feat(compensation): add the secretary compensation surface* — 7
files, +2 243/−1) added `src/views/Compensation.tsx` and
`src/views/compensation/CompensationDialogs.tsx`, a 16-case focused suite and the four additive
integration edits (`ViewId`/nav label in `src/data/academy.ts`, the `compensation` entry in
`src/components/layout/Sidebar.tsx`, `compensation: "schedule.read"` in
`src/domains/auth/permissions.ts`, the view in `src/App.tsx`); `79fd44e` (*fix(compensation): harden UI
count states*) made an in-flight or failed count render the indeterminate «—» instead of a number, named
the failure and let each read retry itself; `79ec13d` (*fix(compensation): complete UI hardening*)
closed the rest of an internal read-only audit — a failed ledger **refresh** is disclosed instead of
silently keeping rows, the warning-consent toggle names the warning kinds it accepts, a failed
effective-session read is shown as a failure with the move disabled while it is unread, the bounded
candidate search (365 days back / 120 days forward / 200 rows) and its truncation are disclosed, the
C-2 disclosure assertion was scoped to the drawer that owns it, `src/views/shared/jalaliInput.ts` became
the one Jalali date-input boundary for the scheduling and compensation dialogs, one real `#/compensation`
route case joined `src/__tests__/routeProtection.test.tsx`, and the three dialog submit wrappers were
deduplicated with refusal, loading and success behaviour unchanged. The surface consumes the domain
through its hooks and verbs only — eligibility, the frozen student, the derived state, the live/terminal
rules, the lineage, the pair uniqueness and the roster rules are never re-derived in the view — and
every action addresses `currentAttempt.sessionId`, never `bookedSessionId`; a teacher sees no write
control. **What it does not claim:** still no `apiRepository` or server and no seeded compensable case
(**I20**), group/class-wide compensation, coordination and notifications still unbuilt (**I18**),
jsdom-verified only with browser QA **NOT VERIFIED** (§5), and per-surface gate coverage that was left
open as **I21** and has since been delivered by the surface's own dedicated boundary gate
(`bf8bd91150d6fca3392115c7eccd6c738e9091ee`, the workstream's last commit). See §4 → "Compensation
UI validation" and "S-6 boundary gate validation".

### Work landed since the Phase 2 checkpoint

Three documentation checkpoints first — documents, validation gates, one labelling fix and one
test-harness fix, **no product feature work**:

1. The four `docs/engineering/` recovery documents and their gate
   (`src/__tests__/projectState.test.ts`).
2. After a read-only audit of those documents: truthful environment labels on the login
   credential panel in an EMPTY environment (`src/views/Login.tsx` takes its wording from
   `useIsDemoEnvironment()`), pinned by `src/views/__tests__/loginEmptyEnvironment.test.tsx`.
   Capability is unchanged — the bootstrap account is still offered and still signs in.
3. A test-harness race inherited from Phase 2, fixed at its own boundary:
   `src/views/__tests__/emptyEnvironment.test.tsx` waited only for the view *title*, so it could
   return while the view still showed its loading placeholder and then assert against that. It now
   waits for the design system's in-flight marker to disappear. Test code only — no product source
   touched, no assertion weakened or removed. Recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I11.

Product work since those three is the product phase itself, described above and ledgered in
[PHASES.md](PHASES.md): M0 `f2ebc09` (specification and decision register — documents only), M1
`689a7c1` (recovery and lifecycle UX), M2 `c42f274` (honest write feedback), M2.1 `73b40d9`
(the two defects M2 found and recorded: edit-form draft integrity and the three Settings panels) and
M3 — implemented at `e5b0a57`, completed at `3bec881` (the learning-content assignment UI) —
**M4**, the scheduling *view* wiring, implemented across CP1 `0f875a7`, CP2 `f8c3472` and CP3
`6f54caf` with its acceptance coverage at `df70148`, and **M5**, the attendance *view* wiring,
implemented in one checkpoint at `9505ade`; **M6**, the contracts-without-UI milestone (chat
management, attachments and single-conversation export), CP1 `43e7882` → CP4 `4e03b87`; and **M7**, the
relation de-fixturing milestone, CP1 `0d9fc01` → CP4 `f1ec0dd`. M0–M5 are described above; M6 and M7
below.

**Commits that landed outside the milestone sequence are accounted for here, so that `git log` shows
nothing this ledger does not explain.** The enumeration that follows is the **M4-era list, kept as
written** — its totals (sixteen, eleven and five) were correct when M4 landed, and "**Current totals**"
at the end of it supersedes them. Eleven of them are **documentation checkpoints** by the definition in §2 and are listed in [PHASES.md](PHASES.md): `2972a99` (closing
**I11** — one test file and four documents, no product behaviour), `ea890ae` (I13 Checkpoint 1's
measured validation recorded and M3's gate discharged), `be75ac6` (I13 Checkpoint 2 recorded as
authorized and in progress *before* its code was written), `49fb499` (I13 Checkpoint 2 recorded as
landed and validated), `85530b4` (I13 Checkpoint 3A recorded as landed and validated), `df3db2f` (M3
recorded as in progress at its first checkpoint), `db5ec24` (the detach exposure M3 introduced),
`1f98228` (M3's acceptance-audit findings **F2** and **F3** recorded — the two-number rollback
boundary, the six-run evidence — and M3 marked complete), `eab30d3` (F3's correction of its own
recorded diff scope to the measured numbers), `84fb7cb` (**M4's CP0** — these five documents and
`src/domains/scheduling/README.md` reconciled with the tree at `7e72887` before the milestone's first
implementation checkpoint) and `24caf3a` (**M4's final reconciliation** — the same five documents
brought in line with the milestone that had landed: M4 marked COMPLETE against its measured evidence,
**H1a** closed, **I16**'s calendar mitigation recorded as a mitigation and not as a closure).
Each was registered by a later commit, because no entry may carry its own SHA. The other five are **product source**, so they are neither
milestones nor documentation checkpoints and they advance no row above: `289e080` is **I13
Checkpoint 1** — the shared list hook plus the six consumers that ignored `loading`, with three new
test files, and the commit that discharged M3's I13 gate (§9); `bcea26c` is **I13 Checkpoint 2** —
the `attachContent` intent guard, with its adversarial suite; `57c1dfb` is **I13 Checkpoint 3A** —
`useDerived` carrying its key so a student switch cannot expose the previous student's placement or
eligible content, with the suite that reproduced the frame before the fix; `fba826f` is **I13
Checkpoint 3B** — scheduling's `useDerivedRead` carrying its key, the first of the two **pre-M4
remediation** commits the owner authorized after M3's acceptance audit, landed because M4 is what
makes its three readers reachable in shipped UI, which it has now done for two of them; and `7e72887` is **C2** — `useSessions` and
`useAttendanceRecords` take `Paged<…>`, so omitting `per_page` is a compile error rather than a
review habit — which is also **M4's effective safe rollback boundary** (the M4 milestone's
**Checkpoint & rollback** field in [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md)).
All five are recorded in
[OPEN_ITEMS.md](OPEN_ITEMS.md) I13/I16 and in §7 item 12.

**Current totals, measured at `a21311d`.** Outside the M0–M11 milestone sequence this repository also
carries, on top of the sixteen enumerated above: **M6's four product commits** (`43e7882`, `42c54f4`,
`563b8d8`, `4e03b87`) with its **two documentation checkpoints** (`e6ab6f9`, `8131c5c`); **M7's four
product commits** (`0d9fc01`, `5726435`, `ede3ad6`, `f1ec0dd`) with its **documentation checkpoint**
(`e7a6d72`); and **Class Compensation P1's single product commit** (`a21311d`). §2's
documentation-checkpoint ledger therefore names **twenty** — the twentieth being `e7a6d72` — and the list
of record is [PHASES.md](PHASES.md) → "Documentation checkpoints"; this paragraph is a cross-check, not a
second ledger. The enumeration above is kept as written because its own totals were correct when M4
landed.

The commits themselves are listed in [PHASES.md](PHASES.md) → "Documentation checkpoints"; this
file never records the SHA of the commit carrying the edit (§2).

## 4. Validation status

### Compensation UI validation (measured at `79ec13d0ab2671a612a578605a1fa7a91effc435`, the last of the UI implementation packages)

The surface landed at `fc83d6d` on base `f0bdecd` (the chain's final reconciliation) and was hardened at
`79fd44e` and `79ec13d`. The numbers below are the ones measured **at `79ec13d`**, the tree that carries
all three; this documentation pass re-ran the focused suite, the route-protection suite, the eight view
gate suites, the documentation gate, `npm run typecheck` and `npm run build` against the identical tree
(documents only, so no other result can have moved) and they agreed.

| Check | Result |
|---|---|
| Starting point | ✅ `git rev-parse HEAD` == `79ec13d0ab2671a612a578605a1fa7a91effc435`, `git status --porcelain` empty, and `git ls-remote origin refs/heads/arena/01a0a068-parsian-music-dashboard-opus` returning the same SHA — verified after the push, not assumed |
| Dependencies | ✅ none added, removed or changed — `git diff --name-only f0bdecd..79ec13d -- package.json package-lock.json` prints nothing |
| `npm run typecheck` | ✅ clean (zero output, exit 0) |
| Focused compensation suite | ✅ **16/16** — `src/views/__tests__/compensationUi.test.tsx`: the ledger's loading, empty, first-read-failure and refresh-failure states and the copy that distinguishes them, the indeterminate counts with their named failure and per-read retry, the register / schedule / complete dialogs including the bounded-window and truncation copy and the warning acknowledgement, the C-2 roster disclosure scoped to the drawer that owns it, and the Persian Jalali date handling |
| Route protection | ✅ **9/9** — `src/__tests__/routeProtection.test.tsx`, including the surface's two cases: a real `#/compensation` route for an administrator (no silent Dashboard fallback) and refusal for a role without `schedule.read` |
| View gate suites (eight files) | ✅ **107/107** — `relationsNoFixtures` (17), `schedulingNoFixtures` (14), `noSuccessWithoutWrite` (14), `honestWriteCopy` (16), `emptyEnvironment` (22), `navigationCounts` (7), `architectureBoundaries` (11), `writeFeedbackHonesty` (6). **What that does not mean:** the compensation surface is **not** enumerated in `relationsNoFixtures`' `SURFACES`, `emptyEnvironment`'s view lists or `writeFeedbackHonesty`'s `GRADUATED_VIEWS` — **I21** — so those gates pass over it because it is not listed there, not because they police it. **Update (measured at `bf8bd911`):** the surface gained its own dedicated boundary gate, which closed **I21** — see "S-6 boundary gate validation"; the three fixed lists still do not enumerate it |
| `src/views/__tests__` | ✅ **420 passed / 1 failed**, the one failure the recorded date-dependent case in `schedulingWrites.test.tsx` (§7 item 18, **I19**) |
| `npm run build` | ✅ exit 0, **4.19 s**; the pre-existing chunk-size warning is unchanged (**I6**) |
| Full suite | ✅ **1 868 passed / 2 failed of 1 870** — the two failures the recorded environmental pair: the branch-name case at `projectState.test.ts:299` (§7 item 16) and **I19**'s date-dependent case (§7 item 18). **Neither is a compensation regression** — both reproduce on the pre-UI tree, and no commit in this chain touches the seed, the clock, the store or the scheduling domain |
| Group A / Group D / the domain | ✅ untouched and green — `git diff --name-only f0bdecd..79ec13d` lists **no** file under `src/domains/scheduling/`, `src/domains/attendance/` or `src/domains/compensation/`, so Group A (211), Group D (79) and the domain's 121 cases are unchanged |
| Scope of the diffs | ✅ `fc83d6d` 7 files / +2 243 / −1, `79fd44e` 2 files / +197 / −28, `79ec13d` 7 files / +478 / −81; `git diff --check` clean; nothing under `src/domains/`, `src/services/`, `src/api/` or `src/context/` changed |
| Acceptance audit | ❌ **none ran, and none is claimed.** The hardening list came from an internal read-only audit by the implementer, whose ten findings are recorded in [PHASES.md](PHASES.md) → the workstream section: nine closed with cases, and **S-6** left open as **I21**. **Since:** S-6 was delivered at `bf8bd91150d6fca3392115c7eccd6c738e9091ee` as the dedicated boundary gate (see "S-6 boundary gate validation"); **no independent acceptance audit has run for it either** |
| Mutation / reversion checks | ⚠️ the implementer's own, recorded in the packages' change reports (a reversion check of the surface's files against its suite, and mutation proofs at the count-state and hardening packages, each restored byte-identically against a recorded sha256 baseline). **No independent audit re-measured them**, and this documentation pass does not either |
| Browser QA | ❌ **NOT VERIFIED** (§5) — the surface is jsdom-verified only. A sandbox preview served it over HTTP during development; that is not a browser-QA pass and is not reported as one |
| Remote | ✅ the three commits were pushed as fast-forwards after `f0bdecd` and verified with `git ls-remote`; §2's rule applies to this documentation commit in exactly the same way |

### S-6 boundary gate validation (measured at `bf8bd91150d6fca3392115c7eccd6c738e9091ee`, the commit that closed I21)

The workstream's tenth audit finding, **S-6** / **I21** — the compensation surface was not named by the
per-surface gates — was closed by a **dedicated boundary gate in a new file** rather than by edits to the
protected per-surface lists, because those lists belong to gates the workstream was not authorized to
change. Every number below was measured at that commit:

| Check | Result |
|---|---|
| Starting point | ✅ the gate was written against the tree at `d18d3e39b513a9031ba8cc8383e7b98d7ae99c99`, the commit it was built on; `git status --porcelain` was empty before and after the run |
| New gate | ✅ **40/40** — `src/views/__tests__/compensationNoFixtures.test.ts`, one new file (768 insertions / 0 deletions) |
| Discovery | ✅ asserted, not assumed — the scan set is exactly `src/views/Compensation.tsx`, `src/views/compensation/CompensationDialogs.tsx` and `src/views/shared/jalaliInput.ts`, with existence, non-emptiness and a ≥3-file floor, so a zero-file scan fails instead of passing |
| Rules and liveness | ✅ twelve rules in asserted order — `fixture-import`, `fixture-identifier`, `own-source-of-truth`, `unbounded-read`, `fabricated-figure`, `timer`, `hardcoded-iso-date`, `effective-session-target`, `permission-boundary`, `dialog-owned-feedback`, `roster-disclosure-not-a-gate`, `read-failure-honesty` — each with its own probe suite, so a rule that stops detecting fails the gate |
| Mutation / discovery proofs | ⚠️ the implementer's own: **sixteen source mutations and two discovery proofs** killed, each reporting the rule that owns it (a named fixture import, a namespace import, a dynamic import, an unbounded read, a fabricated figure, a timer, an ISO date literal, an action re-pointed at `bookedSessionId`, a removed permission conjunct, a dialog-owned toast, roster gating, a hidden ledger failure, a new file under `src/views/compensation/` and the removal of the dialogs file, among others), every source file restored byte-identically against recorded sha256 baselines. **No independent audit re-measured them** |
| Batch | ✅ **172/172** across eleven files — the eight pre-existing view gate suites plus the new gate, `compensationUi` (16) and `routeProtection` (9) |
| Full suite | ✅ **1 908 passed / 2 failed of 1 910** — exactly the new gate's 40 cases over the 1 870 baseline, the two failures the recorded environmental pair (§7 items 16 and 18); no regression |
| `npm run typecheck` | ✅ clean (zero output, exit 0) |
| `npm run build` | ✅ exit 0, **4.06 s**; the pre-existing chunk-size warning is unchanged (**I6**) |
| Scope of the diff | ✅ one file, +768/−0; no document, no product source, no dependency, and nothing under `src/domains/`, `src/services/`, `src/api/` or `src/context/` |
| What the closure does not claim | ❌ **the fixed per-surface lists still do not enumerate this surface**, and six **gate-architecture** findings made while building the gate are **deferred, not fixed**: `architectureBoundaries`' demoStore/URL import rules are string-blind; `relationsNoFixtures`' `surfaceFiles()` assumes a basename and case the compensation directory breaks; `useCompensations` is missing from both page-size catalogues; `src/views/shared/jalaliInput.ts` is owned by no per-surface gate; the success-toast ratchet accepts any `get*Repository(`; and no repository-refusal coverage exists for any compensation verb. (These are findings about the global gates — **not** the milestones M1–M7) |
| Browser QA | ❌ **NOT VERIFIED** (§5) — a test suite is not a browser pass |
| Remote | ✅ pushed as a fast-forward after `d18d3e3` and verified with `git ls-remote`; **I21 is closed with this exact SHA** in [OPEN_ITEMS.md](OPEN_ITEMS.md), and the workstream record is [PHASES.md](PHASES.md) → the workstream section |

### Compensation P1 validation (measured at `a21311d7e32c82e3a46b1581c94f6b3478bf646c`, the workstream's single implementation checkpoint)

Class Compensation P1 landed in **one** product commit on top of M7's documentation reconciliation
(`e7a6d72e561bdbb0d22280e4617141281b62d8b5`): `a21311d7e32c82e3a46b1581c94f6b3478bf646c` ·
*feat(compensation): add the make-up obligation domain*. Every number below was measured **fresh, in
this documentation pass**, with `dist/` present so nothing skipped for want of a build artifact.

| Check | Result |
|---|---|
| Starting point, verified before any edit | ✅ `git rev-parse HEAD` == `a21311d7e32c82e3a46b1581c94f6b3478bf646c`, `git status --porcelain` empty, and `git ls-remote origin refs/heads/arena/01a0a068-parsian-music-dashboard-opus` returning the same SHA. Nothing was reset, stashed, rebased, amended or force-pushed to reach that state |
| Dependencies | ✅ none added, removed or changed — `git diff --name-only e7a6d72..a21311d -- package.json package-lock.json` prints nothing, and `npm ci` was run only because `node_modules` was absent |
| Environment deviations, disclosed | ⚠️ **two.** **(1) The session began with the workspace reverted again**: `HEAD` stood at `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` (M5's reconciliation) and `e7a6d72` was **not present as an object**, while the files on disk were the P1 work. The worktree was verified **byte-identical to the base first** — all 378 tracked blobs of `git ls-tree -r e7a6d72` hashed against the files on disk, **0 missing, 0 differing, 0 paths outside the base** — and then re-attached non-destructively: a read-only `git fetch --unshallow origin` (63 commits) plus `git fetch origin <branch>` for the branch's objects, a **guarded** `git update-ref refs/heads/<branch> e7a6d72` (refusing unless the branch still pointed at the reset value) and an **index-only** `git read-tree --reset FETCH_HEAD` that touches no working file. **No reset of the working tree, no stash, no re-clone, and no WIP discarded.** **(2)** `npm ci` was required because `node_modules` was gone — a disclosed deviation from the standing "no install" instruction, not a dependency change |
| `npx tsc --noEmit` | ✅ clean (zero output, exit 0) |
| `npm run build` | ✅ exit 0, **4.46 s**; the pre-existing warning is unchanged — main chunk > 500 kB, no code-splitting (**I6**) |
| `npx vitest run` (full suite, `dist/` present) | ✅ measured: **130 files / 1 800 tests → 1 798 passed / 0 skipped / 2 failed**, duration **201.9 s**. Both failures are the recorded environmental pair and neither is P1's: the known branch-name case in `projectState.test.ts` (§7 item 16) and the date-dependent `schedulingWrites` case (§7 item 18, **I19**) — the sandbox clock is on the Tuesday its fixture assigns to `cl2`. The arithmetic is auditable: `125 files + 5` and `1 731 + 69 = 1 800`. These are the **same two** failures M7 measured, so P1 adds no failure and fixes none |
| P1's own 69 cases | `src/domains/compensation/__tests__/demoRepository.test.ts` **27** — the invariants end to end (cancellation registers nothing, every refusal code, the frozen student, the attendance gate and its acknowledgement, uniqueness, booking through `create()`, the append-only ledger with an attempt cancelled and re-booked, hard deletion, completion, every read filter) · `derive.test.ts` **20** (the derivation with no environment at all) · `datasetContract.test.ts` **15** (both canonical datasets, the `cmp_` prefix, the registry seam including collaborator overrides, export → clear → restore, and the backup rules — accepted, refused, and the deliberately accepted orphan) · `useCompensations.test.tsx` **5** (the read layer, refresh after each awaited write, a refusal propagated verbatim) · `persianDate.test.ts` **2** (۱۴۰۶/۰۱/۱۵ → `2027-04-04`, and a date that does not exist fails closed) |
| Group A (protected) | ✅ untouched and green — `git show --name-only a21311d` lists **no** file under `src/domains/scheduling/`, so the 211 protected tests and the 9-case `src/domains/scheduling/__tests__/useDerivedRead.test.tsx` suite are unchanged |
| Group D (protected) | ✅ untouched and green — **no** file under `src/domains/attendance/` appears in the commit, so its 79 tests are unchanged |
| Scope of the diffs | ✅ **18 files, 2 976 insertions / 0 deletions**: the new `src/domains/compensation/` (five sources + README + five test files) plus **seven** existing files, every one of them **insertions only** — the dataset field and `DEMO_COLLECTIONS` (`src/domains/demo/types.ts`), both canonical datasets (`src/domains/demo/seed.ts`), the collection and its id prefix (`src/services/demoStore.ts`), the reference-integrity rules (`src/domains/demo/backup.ts`), the registry seam (`src/domains/registry.ts`), and the **two additive integration edits the dataset contract required**: one label in the settings panel's total `COLLECTION_LABELS` record (`src/components/settings/DemoDataPanel.tsx`) and the new collection in the seed suite's own `INTENTIONALLY_EMPTY` set (`src/domains/demo/__tests__/seed.test.ts`). No existing line was deleted or rewritten, and `git diff --check` is clean |
| Documentation gates | ✅ **52** checks in `src/__tests__/projectState.test.ts`, **51 passed / 1 failed** — the failure is the recorded environmental branch-name case (§7 item 16), present before and after this reconciliation |
| Acceptance audit | ❌ **none ran, and none is claimed.** P1 was not put through the read-only acceptance audit M3 and M4 had, so this record carries no audit findings and no **B**-numbered coverage items |
| Browser QA | ❌ **NOT VERIFIED** (§5) — and P1 adds nothing to that checklist because it ships no view; at this commit the flow had never been seen by a human, in a browser or otherwise, and the surface that later offered it carries §5's own open item |
| Remote | ✅ before this pass began, local `HEAD` and `git ls-remote origin refs/heads/arena/01a0a068-parsian-music-dashboard-opus` agreed on `a21311d7e32c82e3a46b1581c94f6b3478bf646c`. §2's rule — verify the remote with the command, never trust a recorded value — applies to this documentation commit exactly as to every other |

**What this evidence does not say.** A green suite is evidence, not a proof of determinism, and this is
**one** full run. There are **no mutation checks and no reversion checks** for this workstream: unlike
M7, no implementation line was mutated to prove a guard is load-bearing, and no pre-P1 tree was restored
to prove the new tests fail without the code. The 69 cases pin the contract they were written against;
they do not prove the derivation is impossible to break. **No storage round-trip is tested** either: the
dataset-contract suite exports, clears and restores through the demo data manager, but no test unmounts
and remounts a view or reopens the browser store. Finally, the two environmental failures above are
**unchanged by this workstream** — neither is fixed here, and neither is silenced.

### M5 validation (measured at `9505ade4011b37a34e3488fd51206512829205ec`, the milestone's single implementation checkpoint)

M5 landed in **one** product commit on top of M4's final documentation reconciliation
(`24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`): `9505ade4011b37a34e3488fd51206512829205ec`
· *feat(m5): wire attendance view*. Every number below was measured **fresh, in this documentation
pass**, on a full single-branch clone of the pushed tip — not copied from an earlier record — with
`dist/` present so nothing skipped for want of a build artifact.

| Check | Result |
|---|---|
| Starting point, verified before any edit | ✅ `git rev-parse HEAD` == `9505ade4011b37a34e3488fd51206512829205ec`, `git status --porcelain` empty, and `git ls-remote origin refs/heads/arena/01a07c61-parsian-music-dashboard-opus` returning the same SHA. Nothing was reset, stashed, rebased, amended or force-pushed to reach that state |
| Dependencies | ✅ none added, removed or changed — `git diff --name-only 24caf3a..9505ade -- package.json package-lock.json` prints nothing, and `git diff --name-only HEAD -- package.json package-lock.json` is still empty after `npm ci`, so the dependency set these runs measured against is the one M4 and C2 were accepted on |
| Environment deviations, disclosed | ⚠️ **three.** **(1)** The workspace was **recycled between turns during M5's implementation**: the original commit and its branch pointer stopped existing as Git objects while the files survived on disk, so the milestone was re-implemented from its recorded scope and committed once, cleanly, as `9505ade`. No history was rewritten to hide it. **(2)** The first documentation checkpoint reconciling M5 was committed locally, fully validated, and **lost unpushed** when the workspace was recycled a second time — the clone, and a `git format-patch` backup written outside it, both disappeared, so that commit is unrecoverable and this pass is a **replay** from the authoritative pushed tip rather than a recovery. The replayed commit therefore carries a **different SHA**, and no claim of byte-identity with the lost one is made. This is [OPEN_ITEMS.md](OPEN_ITEMS.md) **L5** happening twice, and it is recorded here rather than left as an unexplained gap in `git log`. The recovery contract at the end of this file forbids resetting, re-cloning, deleting or stashing a checkout that might hold uncommitted work, so the replay was performed in a **separate fresh clone** of the pushed tip and the earlier checkout was left untouched — no reset, no stash, no rebase, no amend and no force-push anywhere in this pass. **(3)** The fresh clone had no `node_modules`, so it was built with **`npm ci`** from the committed lockfile — a deviation from the standing "no install" instruction, disclosed rather than hidden |
| `npx tsc --noEmit` | ✅ clean (zero output, exit 0) |
| `npm run build` | ✅ exit 0, **3.91 s**; the pre-existing warning is unchanged — main chunk > 500 kB, no code-splitting (**I6**) |
| `npm test -- --run` (full suite) | ✅ **112 files / 1558 tests / 0 failed / 0 skipped**, duration **116.89 s** (wall 1 m 57 s), and `git diff --check` clean. The arithmetic against M4's record is auditable: `1502 + 53` (the two new view suites — 31 + 22) `+ 3` (`src/views/__tests__/noSuccessWithoutWrite.test.tsx`, 11 → 14) `= 1558`, and `110 + 2 = 112` files. `src/__tests__/writeFeedbackHonesty.test.ts` stayed at **6** cases and `src/__tests__/architectureBoundaries.test.ts` at **11**: both changes are data inside existing cases, not new cases. **One full run, not six, and that is the rule rather than a shortcut** — the spec's Tests clause requires six consecutive runs of a milestone that touches a file which has ever flaked, and M5 touched neither of the two **I11** files (`src/domains/learning/__tests__/LearningPanel.test.tsx`, and `src/views/__tests__/emptyEnvironment.test.tsx` changed labels and comments only, not a wait). This documentation pass re-runs the full suite after its own edits, at the same **product** tree, and records the result |
| Group A (protected) | ✅ untouched and green — `git diff --name-only 24caf3a..9505ade` lists **no** file in `src/domains/scheduling/__tests__/`, and the six protected files measure **211** tests (conflicts 39, dateBridge 40, demoRepository 62, generation 43, registry 13, `useScheduling.test.tsx` 14). `useDerivedRead.test.tsx` (9 tests, **not** Group A) is unchanged as well, so the directory holds 220 |
| Group D (protected) | ✅ untouched and green — **79** tests (attendance `demoRepository` 36, `roster` 32, `useAttendance` 11). M5 wired the shipped view to this domain and changed **no file in it**, so the milestone that consumes Group D is also the one that proves it frozen |
| Domain code | ✅ **no change under `src/domains/` at all**: `git diff --name-only 24caf3a..9505ade -- src/domains/` prints nothing — not even a README, which is a stronger statement than M4's. `useAttendance.ts`, `repository.ts`, `demoRepository.ts`, `apiRepository.ts`, `roster.ts`, `types.ts` and `src/domains/registry.ts` are byte-identical, which is the frozen-domain clause measured rather than promised. The two domain READMEs this pass does change — attendance's, rewritten, and scheduling's, where M5 falsified six statements — are documents, committed here and not in `9505ade` |
| Scope of the diffs | ✅ **8 files, 3093 insertions / 324 deletions**: `src/views/Attendance.tsx` 778/288, `src/views/attendance/RegisterPanel.tsx` 305/0 (new), `src/views/attendance/CorrectMarkDialog.tsx` 235/0 (new), `src/views/__tests__/attendanceWrites.test.tsx` 1041/0 (new), `src/views/__tests__/attendanceNoFixtures.test.ts` 405/0 (new), `src/views/__tests__/noSuccessWithoutWrite.test.tsx` 297/21, `src/__tests__/writeFeedbackHonesty.test.ts` 19/14, `src/views/__tests__/emptyEnvironment.test.tsx` 13/1. Nothing outside `src/views/` and the three gate tests the authorization named was touched: no seed, no permission map, no hook, no domain, no dependency, no new repository verb, no new API endpoint, no contract change |
| Mutation checks | ✅ **three, measured in this pass inside a throwaway `git worktree` at `9505ade`** — unlike M4's CP1–CP3, which carry none. Because the mutations happened in the worktree, **no product file in the working tree was ever altered**: `git status --porcelain` stayed empty throughout and the worktree was removed afterwards. Reintroducing a fabricated rate (`faPercent(92)`) into `src/views/Attendance.tsx` fails **2 of the 31** structural cases ("computes no percentage", "carries none of the five fabricated figures"); removing the register's session-identity guard fails **2 of 53** across the two new files (the structural "compares the register's session with the one selected" and the behavioural "does not render a register that answers for another session"); removing the RBAC gate fails **3 of 53** ("removes every write control for a user without attendance.write", "performs no write when nobody is signed in", "gates the write controls on the RBAC permission"). After every revert the two suites ran green at **53/53**. **What this is not:** a per-checkpoint matrix — three guards were mutated, most of the milestone's lines never were — and no independent **reversion** check (reverting an implementation line, re-running, restoring) was performed beyond these three |
| Documentation gates | ✅ **52** checks in `src/__tests__/projectState.test.ts`, green on the unedited tree and green again after this reconciliation pass |
| Acceptance audit | ❌ **none ran, and none is claimed.** M5 was not put through the read-only acceptance audit M3 and M4 had, so this record carries no audit findings, no follow-ups and no **B**-numbered coverage items. The three mutation checks above are this pass's own measurement, not an auditor's |
| Browser QA | ❌ **NOT VERIFIED** (§5) — unchanged for every milestone, including this one |
| Remote | ✅ before this pass began, local `HEAD` and `git ls-remote origin refs/heads/arena/01a07c61-parsian-music-dashboard-opus` agreed on `9505ade4011b37a34e3488fd51206512829205ec`, and the clone in use was a **full** single-branch clone rather than a shallow one (§2). **This row's first wording was inaccurate and is corrected here.** It claimed this documentation commit was "committed **and pushed in the same operation**". The actual sequence: (1) committed locally as `d39793051c6cea61c80e1bba68a97dbf0b4c472c`; (2) the first push **failed** because the environment's GitHub token was no longer valid — `gh auth status` reported *"The github.com token in GH_TOKEN is no longer valid"*, and `git ls-remote` could not authenticate either; (3) GitHub was reconnected; (4) the **same** commit, unchanged, was then pushed as a fast-forward (`9505ade..d397930`); (5) **no amend, no force-push, no reset, no rebase and no second commit** preceded that successful push. The rule the original wording invoked — commit and push together, because the pass this one replays was lost precisely by sitting unpushed between turns (**L5**) — was attempted and defeated by an expired credential, so this commit *did* cross a turn boundary unpushed and survived. §2's rule still applies to it: verify the remote with the command, never trust a recorded value |

**What this evidence does not say.** A green suite is evidence, not a proof of determinism, and one
full run is weaker evidence than six — the reason six were not required is stated in the row rather
than left to inference. Three mutation checks are real evidence that three specific guards are
load-bearing; they are not a matrix. **No storage round-trip is tested:** the register is re-read
after each write and the correction trail is read back from the repository, but no test unmounts and
remounts the view or reopens the store, so "a recorded roster survives a reload" — a clause of the
spec's own Tests section for this milestone — rests on the demo store's single-persistence-authority
code path rather than on a measurement, exactly as M3's record states for its own surface. **The
spec's Tests clause about the old honest `info` sentence was not carried out literally, and that is
recorded rather than smoothed over:** «ثبت دائمی و اطلاع‌رسانی به مدرس به سرور نیاز دارد» no longer
appears in the view, because a real awaited write now persists locally and the notification half of
that sentence is stated where it belongs — the register panel and the correction dialog each say out
loud that no teacher, student or guardian is notified. The clause's *intent* (never upgrade an honest
ceiling into a claim) is honoured and pinned: no success is reported before a promise resolves, the
retracted «همه حاضر ثبت شدند» is a forbidden string, and the bulk save reports a count of records that
exist. **H1 is closed** — both views are wired — but the closure carries every limitation in §3's M5
paragraph. **I16 is not closed:** this view states its ceilings, counts from `total` and announces a
truncated page, but the ceilings are still 200 (and 50 for the correction trail) and every other
consumer is untouched. **I13 is not closed:** `useSessionAttendance` still does not carry its query
key; what exists is one consumer's guard, mutation-checked, and a test that keeps the upstream defect
named. And **no browser has ever rendered this register.**

### M7 validation (measured at `f1ec0ddde783aec14d6429ac2457f085f851ad9a`, the milestone's last implementation checkpoint)

M7 landed in four product commits on top of M6's coverage-matrix commit
(`8131c5cd49c35a7163543082475a9635914aba40`): `0d9fc01` (the relation plumbing), `5726435` (student
relations), `ede3ad6` (teacher relations) and `f1ec0dd` (class relations and the navigation counts).
Every number below was measured on the pushed tip in this documentation pass, with `dist/` present so
nothing skipped for want of a build artifact.

| Check | Result |
|---|---|
| Starting point, verified before any edit | ✅ `git rev-parse HEAD` == `f1ec0ddde783aec14d6429ac2457f085f851ad9a`, `git status --porcelain` empty, and `git ls-remote origin refs/heads/arena/01a0a068-parsian-music-dashboard-opus` returning the same SHA. Nothing was reset, stashed, rebased, amended or force-pushed to reach that state |
| Dependencies | ✅ none added, removed or changed — `git diff --name-only 8131c5c..f1ec0dd -- package.json package-lock.json` prints nothing, and it is still empty after `npm ci` |
| Environment deviations, disclosed | ⚠️ **two.** **(1) The session began with the workspace reverted again**: `.git` held only `9190da0` and the CP1–CP4 objects were absent while the files on disk were the CP4 tip — so the worktree was verified **byte-identical first** (all 378 tracked blobs of the fetched tip hashed against `git ls-tree`, 0 missing, 0 differing), backed up outside the repository, and re-attached non-destructively: a guarded `git update-ref` (refused unless the branch still pointed at the reset value), then an index-only `git read-tree --reset FETCH_HEAD` that touches no working file, then `npm ci` because `node_modules` was gone. No reset of the working tree, no stash, no re-clone. **(2) The clone was shallow** — `git rev-parse --is-shallow-repository` printed `true` with 11 reachable commits and `33b1031` absent, which is what put **9** `projectState` Git-object cases red initially. The history was restored with a read-only **`git fetch --unshallow origin`** (62 commits, `33b1031` present, branch pointer unchanged), which collapsed those 9 failures to the single known environmental one — the same restoration M6's record describes |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm run build` | ✅ exit 0, **5.75 s**; the pre-existing warning is unchanged — main chunk > 500 kB, no code-splitting (**I6**) |
| `npx vitest run` (full suite, `dist/` present) | ✅ measured: **125 files / 1 729 passed / 0 skipped / 2 failed**, duration **189.90 s**. Both failures are recorded, reproduced and **not M7's**: the known branch-name case in `projectState.test.ts` (§7 item 16) and the date-dependent `schedulingWrites` case (§7 item 18). The arithmetic against M6's record is auditable: 1 655 passed + 8 skipped + 1 failed = 1 664 cases at M6; 1 664 + 67 (M7's six new files) = 1 731 = 1 729 passed + 2 failed. **One full run, not six, and that is the rule rather than a shortcut** — the spec's Tests clause requires six consecutive runs of a milestone that touches a file that has ever flaked, and M7 touched neither of the two **I11** files |
| M7's own 67 cases | `src/views/__tests__/relationsNoFixtures.test.ts` **17** (the per-surface gate: 5 surfaces, all `enforced`, empty deferral ledgers, a both-direction liveness test for every view-scoped rule, the numeric-hint rule in both digit scripts and every quote style, `studentIds` as a forbidden relation identifier, the consumer-side key requirement per guarded surface, and relapse replays that re-introduce each retired coupling and assert the gate catches it) · `relationsPlumbing.test.ts` **12** · `studentsRelations.test.tsx` **7** · `teachersRelations.test.tsx` **11** · `classesRelations.test.tsx` **13** · `navigationCounts.test.tsx` **7** |
| Focused M7 sweep after the documentation edits | ✅ the six M7 files re-run green at **67/67** on the final tree, and `src/__tests__/projectState.test.ts` at **51 passed / 1 failed** (§7 item 16) — the gate over the very files this pass edits |
| Group A (protected) | ✅ untouched and green — `git diff --name-only 8131c5c..f1ec0dd` lists **no** file under `src/domains/` at all, so the scheduling suite's **211** tests, `useDerivedRead.test.tsx`'s 9, Group D's **79** and the chat domain's **31** are unchanged by M7 |
| Domain / contract scope | ✅ **no product change anywhere under `src/domains/`, `src/services/`, `src/api/` or `src/context/`**: the only non-view product files in the diff are `src/data/academy.ts` and `src/components/layout/Sidebar.tsx`. No backend contract, no new repository verb, no new API endpoint, no seed or fixture change, and no dependency |
| Scope of the diffs | ✅ per checkpoint — CP1 **4 files, 1 073/0** (gate, plumbing suite, two new modules), CP2 **3 files, 899/85**, CP3 **3 files, 1 330/134**, CP4 **6 files, 1 606/168**. Whole milestone (`8131c5c..f1ec0dd`) = **13 files, 4 842/321**: 3 views, `src/data/academy.ts`, `src/components/layout/Sidebar.tsx`, 2 new modules and 6 new test files. `git diff --check` clean at every checkpoint |
| Student / teacher / class regression guards | ✅ the milestone's protected suites are untouched and green: `studentProfileRegression.test.tsx`, `StudentCrud.test.tsx`, `StudentDetail.test.tsx`, `Students.test.tsx`, `DomainCrud.test.tsx`, `emptyEnvironment.test.tsx`, `emptyEnvironmentPanels.test.tsx`, `writeFeedbackHonesty.test.ts`, `noSuccessWithoutWrite.test.tsx`, `architectureBoundaries.test.ts` and the national-ID matrix |
| Validity of the new tests (reversion, measured **on the pre-CP4 implementation**) | ✅ the pre-CP4 `Classes.tsx`, `academy.ts` and `Sidebar.tsx` were restored (sha256-verified, `Classes.base` `d9e80a8d…`, `academy.base` `d7e089c9…`) and the two CP4 suites re-run: **17 of 20 cases fail** — teacher/room rename, the enrolment-vs-projection seat count, the weekly window, the rooms panel, the fabricated deltas, the empty/error distinction, the class-switch roster, the messages badge (rendered the fixture «۵»), the attendance badge («۳»), every palette hint and the room percentage. The 3 that still pass do so only because the demo enrolment repository keeps `studentIds`/`enrolled` in sync — exactly the denormalized projection §9 forbids relying on. The three files were then restored **byte-exactly** (sha256 re-verified) and both suites re-ran green |
| Mutation checks (the gate's own teeth) | ✅ seven injections, each reverted byte-exactly before the next: a roster built from `c.studentIds` (**gate red**), a fixture collection re-imported into the view (**gate red**), the `key={detail.id}` class guard removed (**gate red**), a static attendance badge restored (**gate red**, plus two navigation cases), a digit written into a hint (**gate red**, plus two navigation cases), the room option's availability percentage restored (**gate red**, plus two navigation cases), and a parenthesised count in a quick-action option — which **slipped past the gate on the first attempt** and was caught only by the view suite, so the gate gained an `options: [ … (N) … ]` rule (both digit scripts) and the injection was re-proved red. Strengthened, never weakened |
| Documentation gates | ✅ **52** checks in `src/__tests__/projectState.test.ts`, green except the one environmental branch-name case, both before and after this reconciliation |
| Acceptance audit | ❌ **none ran, and none is claimed.** M7 was not put through the read-only acceptance audit M3 and M4 had, so this record carries no audit findings and no **B**-numbered coverage items. The reversion and mutation checks above are this pass's own measurement, not an auditor's |
| Browser QA | ❌ **NOT VERIFIED** (§5) — and M7 adds to the list rather than shortening it: the three rewired surfaces and the navigation chrome have never been opened in a browser |
| Remote | ✅ before this pass began, local `HEAD` and `git ls-remote origin refs/heads/arena/01a0a068-parsian-music-dashboard-opus` agreed on `f1ec0ddde783aec14d6429ac2457f085f851ad9a`. This documentation commit is pushed on top of it, and §2's rule — verify the remote with the command, never trust a recorded value — applies to it exactly as to every other |

**What this evidence does not say.** A green suite is evidence, not a proof of determinism, and one full
run is weaker evidence than six — the reason six were not required is stated in the row rather than left
to inference. The reversion evidence covers **20 cases in the CP4 suites**; CP1–CP3 carry the gate,
the plumbing suite and their own per-surface suites but **no per-checkpoint reversion matrix**, and this
record does not claim one. **No storage round-trip is tested** for any of the three surfaces, so
"survives a reload" rests on the demo store's single-persistence-authority path, exactly as M3, M5 and
M6 recorded for theirs. Two of the failures in the full suite are **environmental and recorded, never
silenced**: the branch-name case (§7 item 16) and the date-dependent scheduling case (§7 item 18).

### M7 coverage matrix — every authorized requirement answered, one by one

Status vocabulary, applied strictly: **PASS** = implemented *and* pinned by named tests. **PARTIAL** =
delivered with something the requirement named deliberately absent, and the absence recorded.
**REMOVED** = the honest answer was to delete the claim rather than invent the data. **OUT OF SCOPE** =
the milestone declared it out before it started. **NOT VERIFIED** = measured under jsdom only. No cell
is blank and there is no "N/A".

| # | Requirement (M7 authorization · the checkpoint that took it) | Status | Evidence |
|---|---|---|---|
| 1 | Teacher name on a class resolves through the teachers repository | **PASS** | `src/views/Classes.tsx` (`useTeachers` + `indexById`); `classesRelations.test.tsx` — "follows a repository rename of the instructor and the studio" |
| 2 | Room name resolves through the rooms repository | **PASS** | same reads; the same case, plus "prints «—» for an instructor or a room outside the read" |
| 3 | Roster built from canonical enrollments + students, never `class.studentIds` | **PASS** | `Classes.tsx` (`useEnrollments({ classId })` joined to `useStudentList`); `classesRelations.test.tsx` — "counts what the enrollments say, not the class row's projection", "is the enrollment relation: a real enroll adds the seat, a withdraw releases it"; the gate forbids the identifier outright |
| 4 | Weekly sessions from a bounded repository read with explicit `from`/`to`/`per_page` | **PASS** | `Classes.tsx` — `useSessions({ classId, from: weekStart, to: weekEnd, per_page })` anchored on `academyIsoDate()`; "renders the class's own sessions from a windowed read, and drops the others"; the gate's bounded-read rules |
| 5 | Rooms panel is the room repository, not the fixture array | **PASS** | `Classes.tsx` rooms panel over `rooms.items`; "is the room repository, not the fixture array" and "says a room is not recorded rather than drawing the fixture rooms" |
| 6 | Fabricated deltas removed (3.4 / 2.1 and equivalents) | **PASS** | `delta:` absent from every M7 view; the gate's view-scoped delta rule, with a both-direction liveness test; "renders no trend delta beside the occupancy or the attendance average" |
| 7 | `TODAY_INDEX` / `weekSessions` coupling removed | **PASS** | both names are gate identifiers; the academy day comes from `academyNow()` through `src/views/relations/academyDay.ts`; no `new Date()`/`Date.now()` in any M7 surface |
| 8 | CRUD / enrolment behaviour preserved | **PASS** | `DomainCrud.test.tsx`, `StudentCrud.test.tsx`, `StudentDetail.test.tsx`, `Students.test.tsx` and the national-ID matrix untouched and green; the dialogs and the archive/enrol paths are unchanged |
| 9 | Domain not redesigned | **PASS — measured** | `git diff --name-only 8131c5c..f1ec0dd -- src/domains/` prints nothing; no contract, verb, seed or type moved |
| 10 | `attendanceAvg` / `termProgress` / `tuition` untouched unless legitimately repository-backed | **PASS** | they stay row fields read from `useClasses`, and **no derivation was invented** for them; the class strip prints the row's own `attendanceAvg` mean with no delta |
| 11 | Attendance badge real or removed | **REMOVED** | `src/data/academy.ts` — the badge field and the «۳ کلاس ثبت‌نشده» hint are gone; `Sidebar.tsx` documents why (no scoped, pageable unrecorded-sessions read exists; `sessionIdsWithAttendance` is a protection seam, not a bounded read). Pinned by `navigationCounts.test.tsx` — "carries no badge and claims no unrecorded-class count" |
| 12 | Messages badge from unread counts, or removed | **PASS** | `useNavBadges()` in `Sidebar.tsx` sums `unread` over `useConversations({ per_page: 200 })` and renders only when the read is complete and the sum is positive; `navigationCounts.test.tsx` renders the repository's own total, follows a real `markRead`, and proves silence on a failed read, a partial page and zero unread |
| 13 | Palette static numbers removed or reworded to claim nothing | **REMOVED** | `academy.ts` command hints now name a target or a filter («مالی · سررسید گذشته», «حضور · کلاس‌های ثبت‌نشده», «هنرجویان · در معرض ریزش»); the gate's numeric-hint rule covers both digit scripts and all quoting styles; `navigationCounts.test.tsx` asserts the retired strings are absent |
| 14 | Quick-action room percentage real or removed | **REMOVED** | the option reads «اتاق ۴»; the recipient group lost its «(۵)» too; gate rules for both `٪` and a parenthesised count in an option list, plus the view suite's assertions |
| 15 | No invented badge, count, occupancy, attendance aggregate or availability contract | **PASS** | no new repository verb, no new read hook, no new contract anywhere in the diff; the only count added is the unread sum the chat contract already expresses |
| 16 | Loading, empty and unavailable stay distinct; lists bounded; reads never fall back to `demoStore`/`localStorage` | **PASS** | per-read `loading`/`error` gates with retry, «—» + «N ردیف از M» on a partial page, an explicit «اتاقی ثبت نشده» empty state; every read states `per_page`; the gate's own-source rules forbid the store and browser storage |
| 17 | The gate rejects a reintroduced coupling (relapse replay) | **PASS** | `relationsNoFixtures.test.ts` replays 14 class-surface relapses and 8 navigation relapses and asserts each is caught; the seven live injections in the validation table above re-prove it against the real files |
| 18 | Gate deferral ledgers empty; classes and navigation flipped `staged → enforced` in this commit | **PASS** | all 5 surfaces `enforced`, `stagedRules: []`, `pendingBecause: []`, with an assertion that no surface is non-enforced |
| 19 | Spec clause: *"views do not import `src/data/records.ts` **for data**"* | **PARTIAL — and the boundary is stated** | the three rewired views import **labels and types only** (`WEEKDAYS`, `WEEKDAYS_SHORT`, status/label maps, `AcademyClass`, `InstrumentId`), which the gate's allow-list permits and which carry no relation or row data. The spec's M7 scope also named `Messages.tsx`, `Library.tsx` and `Settings.tsx`; **those were not in the authorized checkpoints and are untouched** — they still read `messageTemplates`, `libraryShelves` and `settingsSections`, and the product-wide boundary test the final-phase DoD asks for remains **M10/D5** |
| 20 | Spec clause: *"EMPTY renders «داده‌ای نیست» everywhere these relations appear"* | **PASS at the surfaces that changed** | `emptyEnvironment.test.tsx` and `emptyEnvironmentPanels.test.tsx` are untouched and green; the M7 suites' own empty/unresolvable/partial cases assert «—» and explicit empty copy rather than zeros. The dashboard panels' fabricated sentences (the other half of **I1**'s neighbourhood) are **M9/H4** and unchanged |
| 21 | Spec clause: **I1** closed — "badges come from repositories and disappear at zero" | **PASS at the level it was defined** | the one badge with a real source is read from the repository and disappears at zero, on a failed read and on a partial page; the badge with **no** source was removed rather than estimated, and the `NavDef.badge` field no longer exists, so a static count cannot return without failing the gate |
| 22 | Protected areas named by the spec (student profile, CRUD, national-ID masking, empty-environment panels) | **PASS — measured** | `git diff --name-only 8131c5c..f1ec0dd` lists none of `studentProfileRegression.test.tsx`, `StudentCrud.test.tsx`, `StudentDetail.test.tsx`, `DomainCrud.test.tsx`, `src/domains/students/__tests__/nationalId.matrix.test.ts`, `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` |
| 23 | Demo/API behaviour unchanged: the views still consume the mode-switched getters | **PASS** | M7 added no repository resolution of its own; every read goes through the existing mode-switched hooks (`useStudents`/`useStudentList`, `useTeachers`, `useClasses`, `useEnrollments`, `useRooms`, `useSessions`, `useConversations`), so api mode changes their data source exactly as before |
| 24 | Browser QA of the rewired surfaces and the chrome | **NOT VERIFIED** | §5 |

**The documentation pass that carries this block (M7's closure) is documents-only and did not re-run the
full suite after its own edits** — it changes no source and no test, and the full run recorded above was
taken on the same product tree. What it did run afterwards is the documentation gate
(`src/__tests__/projectState.test.ts`) and the six M7 suites, both against the edited files: **52 gate
checks with the one known environmental failure**, and **67/67** on the M7 files.

### M6 validation (measured at `4e03b8762bebcb87e46cf7044af5da99d709b4d2`, the milestone's last implementation checkpoint)

| Check | Result |
|---|---|
| **Full suite** | **119 files / 1 655 passed / 8 skipped / 1 failed** — the single failure is the known environmental branch-name case in `projectState.test.ts:299` (§7 item 16), identical at the pre-M6 base and at every checkpoint |
| **Suite growth** | **1 549 → 1 655 (+106)**, monotonic and accounted for checkpoint by checkpoint: base 1 549 → CP1 **+31** (1 580) → CP2 **+22** (1 602) → CP3 **+30** (1 632) → CP4 **+23** (1 655). No test was skipped, suppressed or removed to reach any of those numbers |
| **The 8 skipped** | The same environment-conditional skips the suite has always had (CSP/build evidence that cannot exist in this sandbox), untouched by M6 |
| **M6's own 106 cases** | `src/domains/chat/__tests__/conversationLifecycle.test.ts` **16** · `messageAttachments.test.ts` **15** · `src/views/__tests__/messagesConversationManagement.test.tsx` **13** · `messagesStateSafety.test.tsx` **9** · `messagesAttachments.test.tsx` **19** · `messagesConversationExport.test.tsx` **21** · `messagesNoFixtures.test.ts` **13** (the fixture gate, grown from a directory-discovered scan of the whole surface) |
| **Focused + gate sweep at CP4** | **278/278 across 21 files** — M6's seven suites plus `MessagesChat.test.tsx`, `messagesDatasetRegression.test.tsx`, the chat, media, export and import domain suites and the honesty/layering gates (`staleQueryGates`, `writeFeedbackHonesty`, `noSuccessWithoutWrite`, `honestWriteCopy`, `emptyEnvironment`, `architectureBoundaries`) |
| **Typecheck / diff** | `npm run typecheck` clean (`tsc --noEmit`) and `git diff --check` clean at every checkpoint |
| **Reversion (mutation) checks** | **14**, each reverted byte-identically (MD5-verified) before its checkpoint commit: CP1 **2** — archive made one-way → exactly the 3 restore cases fail; the `mediaId` resolution check removed → exactly the 4 dangling-reference cases fail. CP3 **6** — size ceiling removed → the oversized case; upload not awaited → 7 cases including both awaited-write cases; duplicate-submit guard removed → 3 uploads for 3 clicks; open-affordance decoupled from the bytes → the missing-bytes case; a fixture import added to the new attachment file → 3 gate cases; a hardcoded ceiling re-typed → the derived-limits case. CP4 **6** — selection identity replaced by the list's first row → 6 cases; the read replaced by another conversation's messages → 8; the download moved before the awaited read → 8 incl. the empty-file case; the duplicate guard removed → 3 reads for 3 clicks; the attachment line dropped → 3; a fabricated message in the empty state → 2 |
| **Rollback boundary** | `9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9` (M5's documentation reconciliation — the commit CP1 was built on). Rolling back further would drop M6 entirely; M5's own boundary is unchanged |
| **Environment note** | The CP4 session began with the sandbox having restored a **shallow** tree at the base commit with CP1–CP3 present as uncommitted work; the pushed tip was treated as authority, the WIP was backed up, **367/367 files were verified identical by hash before anything moved**, restoration used `git reset --mixed` (never a working-tree-destructive form), `npm ci` was run because `node_modules` was absent, and `git fetch --unshallow` restored the expected history (4 → 55 commits, and the 10 shallow-artifact `projectState` failures collapsed back to the single known one) |

### M6 coverage matrix — every CP1–CP4 requirement answered, one by one

**Vocabulary, and it is applied strictly. PASS** = implemented *and* pinned by named tests — never
inferred from a control's existence. **PARTIAL** = the capability is delivered but something the
requirement named is deliberately absent, and the absence is recorded. **DEFERRED** = the honest
answer is a server or a later milestone, and no frontend imitation was shipped. **OUT OF SCOPE** = the
milestone declared it out before it started and did not quietly absorb it. **NOT VERIFIED** = measured
only under jsdom and never in a browser. **The matrix has no "N/A" and no blank cell:** what a
requirement asked for is either answered or named as missing.

| # | Requirement (spec M6 scope · the checkpoint that took it) | Status | Evidence |
|---|---|---|---|
| 1 | Rename / topic / pin wired end-to-end (CP2) | **PASS** | `src/domains/chat/demoRepository.ts` `updateConversation` (trim + ≥ 2-char refusal); `src/views/messages/ConversationManagerDialog.tsx`; `src/views/__tests__/messagesConversationManagement.test.tsx` (13) — "renames a conversation and the new name survives a fresh repository read", "edits the topic and persists it", "refuses a one-character name in the dialog, and writes nothing", "reports a refused write in the repository's own words, with no success"; domain half: `conversationLifecycle.test.ts` (16) — "trims what it stores instead of keeping the operator's padding", "leaves fields the patch did not mention untouched" |
| 2 | Archiving is reversible, hidden by default, discoverable, restorable, persisted (CP1 + CP2) | **PASS** | `conversationLifecycle.test.ts` — "hides an archived thread from the list by default", "reveals an archived thread through the archived-inclusive filter", "restores persistently — a fresh instance sees the thread again", "round-trips archive → restore → archive without losing the thread", "combines archive with a rename in one call, without dropping either"; `messagesConversationManagement.test.tsx` — "archives: the conversation leaves the default list and the pane says why", "discovers an archived conversation through the explicit filter, marked as archived", "restores: visible in the DEFAULT list again, and the restore persists", "keeps an archived conversation's messages" |
| 3 | `archiveConversation` as a *consumed* verb | **PARTIAL — deliberately unconsumed** | The capability passes (row 2) through the one write path the dialog uses; the verb itself is a tested one-line delegation (`demoRepository.ts:101`) with **no shipped caller** — **D14**, and stated in `src/domains/chat/README.md` §1 as a fact, not left to look like an oversight |
| 4 | Attachment is a **reference**; resolution before provider delivery and before any write; no metadata copied onto the message (CP1) | **PASS** | `src/domains/chat/types.ts:79`/`:110` (the only contract additions); `demoRepository.ts:137`; `src/domains/chat/__tests__/messageAttachments.test.ts` (15) — "keeps the attachment as a REFERENCE — a megabyte of bytes never enters the dataset" (measured: the row grows < 500 characters), "refuses an unknown mediaId, and writes no message at all", "names the offending field, so a form can report it on the control", "refuses before delivery — no thread preview is written for a refused send", "refuses a reference whose bytes were removed — a dangling metadata row", "does not copy the asset's filename or mime type onto the message", "exposes the uploaded asset's metadata for rendering", "reports missing bytes as undefined rather than an empty file" |
| 5 | Attachment surface: real picker, contract-derived limits, two awaited writes before one claim, duplicate-submit protection, asset released on a failed message write, honest missing-bytes rendering (CP3) | **PASS** | `src/views/messages/AttachmentField.tsx`, `attachmentRules.ts`, `MessageAttachment.tsx`; `src/views/__tests__/messagesAttachments.test.tsx` (19) — "opens the browser's file picker and advertises the contract's types", "accepts a file exactly at the ceiling: the rule is above, not at", "claims nothing until the upload AND the message write have resolved", "sends one upload and one message when the operator submits repeatedly", "reports a failed message write, frees the stored asset, and allows a retry", "keeps the metadata, says the file is unavailable, and offers no open or download", "never turns a failed attachment send into an empty conversation", "shows a real picker once a conversation exists, and still seeds nothing" |
| 6 | A failed message read is a failure, never an empty thread (CP2 · I15 at this site) | **PASS at this site** | `src/views/__tests__/messagesStateSafety.test.tsx` (9) — "renders a failure with the reason, and no empty-thread claim", "retries the read and then shows what the repository returns"; **I15 itself stays OPEN** with the other thirteen consumers untouched and its register line now stale, recorded in §7 item 15 rather than edited |
| 7 | Composer state belongs to its conversation; a late send cannot clear another thread's draft (CP2 · **D16**) | **PASS** | `src/views/messages/useComposer.ts` (keyed record, `clearFor(id)` only for its own id); `messagesStateSafety.test.tsx` — "never shows the previous conversation's draft under the new header", "discards the draft rather than caching it for the way back", "keeps each conversation's own typing while both are visited", "does not wipe the new conversation's draft when a send for the old one resolves late", "survives a clearFor aimed at another conversation, and is cleared by its own" |
| 8 | Export coverage — *only* where a genuine repository read exists (CP4) | **PASS, and the boundary is the evidence** | `src/views/messages/conversationExport.ts` reads `getConversation(id)` + `listMessages({ conversationId, per_page })`; `messagesConversationExport.test.tsx` (21) — "reads that conversation by id, its own messages, and nothing else"; **no entity was added to `ExportEntity`** (`src/domains/export/exportService.ts:25` unchanged) and **no export verb exists** (`D14`) |
| 9 | The export contains what is really stored: BOM'd UTF-8 text, real senders/timestamps/status, attachment metadata, honest empty state, disclosed truncation (CP4) | **PASS** | `conversationExport.test.tsx` — "returns a .txt artifact whose bytes are UTF-8 text with a BOM, and no attachment content", "records a message's real delivery status instead of claiming it was sent", "carries attachment metadata and denies that the bytes are included", "describes an attachment whose metadata no longer resolves instead of inventing one", "discloses the ceiling when the read stopped short", "writes an honest empty file for a conversation with no messages, and fabricates none", "keeps user-controlled bodies as literal text — never markup" |
| 10 | The download happens only after the read resolved, and never retargets (CP4 · **D16**) | **PASS** | `src/views/Messages.tsx` lines 382–386 (identity captured, artifact downloaded after the await); `conversationExport.test.tsx` — "claims nothing until the repository read resolves", "reports a failed read honestly, downloads nothing, and stays usable", "guards against duplicate work when the control is clicked repeatedly", "keeps an in-flight export pinned to the conversation it started for", "hands the finished artifact to the browser only through the export domain's download seam". Mutation-checked: moving the download before the await fails 8 cases |
| 11 | The surface reads no fixtures, no browser storage and no raw HTML; nothing claims a write before it lands | **PASS** | `src/views/__tests__/messagesNoFixtures.test.ts` (13) — a directory-discovered scan of the whole surface forbidding `@/data/records`, `services/demoStore`, `localStorage`, `innerHTML`/`dangerouslySetInnerHTML`, `console.*`, and requiring `downloadBlob(` while forbidding `getBlob(`/`createElement(`; the honesty gates `noSuccessWithoutWrite.test.tsx` and `writeFeedbackHonesty.test.ts` stay green inside the 278/278 sweep (§4 table above) |
| 12 | Protected areas untouched: media domain, blob store, DECISIONS §13, the spreadsheet escaping for any new export entity | **PASS — measured, not promised** | `git diff --name-only 9190da0..4e03b87 -- src/domains/media src/services src/context src/api src/components src/domains/export src/domains/import` prints **nothing**; no new entity means the CSV/XLSX formula-injection path was never in play |
| 13 | Demo/API behaviour: chat resolves to Demo in both modes; `in_app` is the only provider that truly delivers | **PASS as designed — not silently "fixed"** | `src/domains/registry.ts:147`; `provider.ts` has exactly two behaviours (`inAppProvider` → `sent`, `backendRequiredProvider` → `unavailable` with a reason). Real transports stay **OUT OF SCOPE (provider integration)** and **DEFERRED** under **D1**/**I7** |
| 14 | Attachment ownership / authorization, signed URLs, server-side sniffing, virus scanning | **DEFERRED — backend-required** | `src/domains/media/types.ts:22` ("BACKEND REQUIRED"); the chat check is resolution only and says so (`demoRepository.ts:137`); no frontend guarantee is claimed anywhere, including the README (§3) |
| 15 | Server persistence, a shared thread, an API chat repository | **DEFERRED** | `registry.ts:147` returns Demo in both modes; no `ApiChatRepository` exists — the server half belongs to **M11 (D8)**, and §7 item 15 states it as a limitation rather than a to-do M6 completed |
| 16 | Attachment **binary** export, bulk/multi-conversation export, PDF/ZIP/CSV pipeline for chat | **OUT OF SCOPE — declared before CP4** | `src/domains/chat/README.md` §4/§6; the artifact is one conversation, text only, metadata-only for attachments |
| 17 | Notifications domain; group moderation | **OUT OF SCOPE — unchanged from the spec** | spec M6 → "Out of scope"; nothing in M6 touches them, and `Messages.tsx`'s send path still reports the provider's real status instead of simulating a notification |
| 18 | The spec's Tests clause for chat: rename/pin/archive round-trips persist; an attachment whose bytes are missing renders the honest *unavailable* state; no success is claimed without a write | **PASS** | Domain round-trips are re-read through **fresh repository instances** (rows 1–5); "keeps the metadata, says the file is unavailable, and offers no open or download" and "says the reference no longer resolves when the asset metadata is gone too" (row 5); "claims nothing until the upload AND the message write have resolved" (row 5) and "claims nothing until the repository read resolves" (row 10) |
| 19 | "A thread survives a reload" for the **view** (unmount + remount) | **PARTIAL — not tested, and recorded** | No M6 suite unmounts and remounts the view, so persistence rests on the demo store's single-persistence-authority path — the same honest gap M3 and M5 recorded for their surfaces (§7 item 15) |
| 20 | Browser QA of the real file picker and the real download | **NOT VERIFIED** | §5; jsdom implements neither `URL.createObjectURL` nor a download, so the export suite stubs that one API and asserts the artifact's bytes plus anchor invocation at the seam |
| 21 | Acceptance: "every chat capability either has a UI or is recorded in the docs as deliberately UI-less" | **PASS** | Two capabilities are recorded as deliberately UI-less with their reasons — `archiveConversation` (**D14**) and the export's use of existing reads (**D14**) — in `src/domains/chat/README.md` §1 ("Verbs with no shipped caller") and spec M6 → "Acceptance" |

**What M6 delivered, and what remains before production-ready — in four labelled categories, with
nothing blurred into "mostly complete":**

- **IMPLEMENTED / VERIFIED** — a wired Messages surface over the chat contract: rename/topic/pin,
  reversible archive with an archived filter and badge, real attachments (picker → media write →
  message write → render, with the limits derived from the media contract), conversation-keyed
  composer state, honest read-failure and missing-bytes states, and a single-conversation plain-text
  export composed from the reads that already existed. 106 tests, 14 mutation checks, 278/278 focused
  sweep, full suite 1 655 passed / 8 skipped at `4e03b87` (§4 table above).
- **HONEST LIMITATIONS** — attachment ownership/authorization is *not* enforced here (resolution ≠
  authorization); attachment bytes are browser-local and excluded from every export; the export is
  single-conversation with a disclosed 1 000-message ceiling; `archiveConversation` and the export's
  read path are deliberately UI-less/verb-less (**D14**); **I13** and **I15** stay OPEN with the
  `Messages.tsx` site fixed and no general remediation; no view-level reload round-trip is tested;
  **browser QA is NOT VERIFIED**.
- **DEFERRED** — server persistence and a shared thread; per-object authorization, signed and
  expiring URLs, server-side sniffing and virus scanning; a chat API repository; attachment binary
  export; bulk/multi-conversation export; a PDF/ZIP/CSV pipeline for chat; provider integration and
  any notifications domain (**D1**, **I7**, **M11/D8**).
- **KNOWN ENVIRONMENTAL LIMITATION** — `src/__tests__/projectState.test.ts:299` fails in this
  session's sandbox because the recorded working branch
  (`arena/01a07c61-parsian-music-dashboard-opus`) is not the branch actually checked out
  (`arena/01a0a068-parsian-music-dashboard-opus`); it is identical at the pre-M6 base `9190da0` and at
  every checkpoint, and it is **not** fixed, skipped, suppressed, re-recorded or accommodated — §7
  item 16.

**The documentation pass that carries this block (M6's CP5) is documents-only and did not re-run the
full suite** — it changes no source and no test. What it did run is the documentation gate itself
(`src/__tests__/projectState.test.ts`), which is the gate over the very files it edits: **51 passed /
1 failed**, measured on **both halves** of the pass (the reconciliation `e6ab6f90901496be376e2278aa28695e5ab32ab6`, and the
documentation commit that adds this matrix and registers it) — the same known environmental
branch-name case each time, unchanged.

### M4 validation (measured at `df701488362cb90cf32ccefad277879477571cf7`, the acceptance-coverage checkpoint that ends the M4 chain)

M4 landed in four product commits after its CP0 documentation reconciliation
(`84fb7cb4a4a703d52de78cd701ed21d4d242d7c5`): **CP1** `0f875a78c99077e25b67b9cc9cffe34c823ee511`
(the reads), **CP2** `f8c3472895978054c8dc81574bb8a945ef3c326d` (the two writes), **CP3**
`6f54caf46dc13baca78e376c606a4aa9667cdb48` (generation) and **B1+B2**
`df701488362cb90cf32ccefad277879477571cf7` (acceptance coverage, test files only). The rows below
are what was measured on the tree that contains all four, with `dist/` present so nothing skipped for
want of a build artifact.

| Check | Result |
|---|---|
| Dependencies | ✅ none added, removed or changed — `git diff --name-only 7e72887..df70148 -- package.json package-lock.json` prints nothing, so the dependency set these runs measured against is the one M3 and C2 were accepted on |
| Environment deviation, disclosed | ⚠️ the **B1+B2** pass ran in a **recycled workspace** and had to re-create `node_modules` with `npm ci` from the committed lockfile — a deviation from the standing "no install" instruction, disclosed when it happened and recorded here rather than hidden. The manifest and the lockfile are byte-identical to `7e72887761f07f48e115160611a9785bfaae9060`, so the deviation changed the machine, not the dependency set |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm run build` | ✅ exit 0; the pre-existing warning is unchanged — main chunk > 500 kB, no code-splitting (**I6**) |
| `npm test` (full suite) | ✅ **110 files / 1502 tests / 0 failed / 0 skipped** at `df701488362cb90cf32ccefad277879477571cf7`, and `git diff --check` clean. The arithmetic against C2's record is auditable: `1435 + 63` (M4's five new view suites — 15 + 14 + 3 + 16 + 15) `+ 4` (one case added to `src/__tests__/writeFeedbackHonesty.test.ts`, three to `src/views/__tests__/noSuccessWithoutWrite.test.tsx`) `= 1502`, and `105 + 5 = 110` files. `src/__tests__/architectureBoundaries.test.ts` stayed at **11** cases: its three new `PAGE_SIZE_CALLERS` entries are data inside an existing case, not a new case. **One full run, not six, and that is the rule rather than a shortcut** — the spec's Tests clause requires six consecutive runs of a milestone that touches a file which has ever flaked, and M4 touched neither of the two **I11** files (`src/domains/learning/__tests__/LearningPanel.test.tsx`, `src/views/__tests__/emptyEnvironment.test.tsx`). This documentation pass re-ran the full suite **twice** at the same **product** tree — documents changed, no source — and recorded the same numbers both times: 110 files / 1502 tests / 0 failed / 0 skipped |
| Group A (protected) | ✅ untouched and green — `git diff --name-only 7e72887..df70148` lists **no** file in `src/domains/scheduling/__tests__/`, and the six protected files measure **211** tests (conflicts 39, dateBridge 40, demoRepository 62, generation 43, registry 13, `useScheduling.test.tsx` 14). `useDerivedRead.test.tsx` (9 tests, **not** Group A) is unchanged as well, so the directory holds 220 |
| Group D (protected) | ✅ untouched and green — **79** tests (attendance `demoRepository` 36, `roster` 32, `useAttendance` 11). Wiring that domain is **M5**, and nothing in M4 pre-empted it |
| Domain code | ✅ no product change under `src/domains/` at all: the only path there that differs across the chain is `src/domains/scheduling/README.md`, a document. `useScheduling.ts`, `repository.ts`, `demoRepository.ts`, `generation.ts`, `conflicts.ts`, `dateBridge.ts` and `src/domains/registry.ts` are byte-identical, which is the frozen-domain clause measured rather than promised |
| Scope of the diffs | ✅ CP1 = 6 files, **1688 / 262**; CP2 = 5 files, **1898 / 46**; CP3 = 5 files, **1533 / 14**; B1+B2 = 2 files, **402 / 13**. Product source across `84fb7cb..df70148` = **11 files, 5457 insertions / 271 deletions**; the whole chain including CP0's documents is **17 files, 6055 / 368** |
| Mutation / reversion checks | ❌ **NOT RECORDED, and not claimed.** CP1, CP2 and CP3 were accepted **without** the per-checkpoint mutation and reversion evidence M3's record carries: no such run was performed, no implementation line was reverted and re-run, so none is written down here and this row must never be quoted as "mutation-checked". What exists instead is coverage, described as coverage: 63 new cases asserting that no fixture record appears when the repository returns something else (`src/views/__tests__/schedulingNoFixtures.test.ts`), that a superseded window's late answer is ignored and each window is read once with its own bounds (`src/views/__tests__/schedulingStaleWindow.test.tsx`), that no claim is made before a write resolves and that a refusal is reported in the repository's own words (`src/views/__tests__/schedulingWrites.test.tsx`, `src/views/__tests__/schedulingGeneration.test.tsx`), and a graduation ratchet that requires the view both to reach `getSchedulingRepository(` and to report a success (`src/__tests__/writeFeedbackHonesty.test.ts`). **None of it was mutation- or reversion-checked, so none of it may be quoted as proof that these tests fail without the implementation** — which is exactly what M3's five mutation checks proved for M3 and what this milestone does not have |
| Documentation gates | ✅ **52** checks in `src/__tests__/projectState.test.ts`, green before this reconciliation pass and green after it |
| Browser QA | ❌ **NOT VERIFIED** (§5) — unchanged for every milestone, including this one |
| Remote | ✅ at the start of this pass, local `HEAD` and `git ls-remote origin refs/heads/arena/01a07c61-parsian-music-dashboard-opus` agreed on `df701488362cb90cf32ccefad277879477571cf7`. This documentation commit is pushed on top of it, and §2's rule — verify the remote with the command, never trust a recorded value — applies to it exactly as to every other |

**What this evidence does not say.** A green suite is evidence, not a proof of determinism, and one
full run is weaker evidence than six — the reason six were not required is stated in the row rather
than left to inference. **H1 is not closed:** H1a (scheduling) is, H1b (attendance) is M5's, and the
umbrella item closes only when both views are wired. *(This is M4's validation record, measured at
`df701488362cb90cf32ccefad277879477571cf7` and kept as written. M5 has since closed H1b — see the
"M5 validation" block above, which is the current one.)* **I16 is not closed:** the calendar now bounds
its window, states its ceilings, counts from `total`, announces a truncated page and withholds
per-day counts while that notice stands — but the ceiling is still 200 and every other consumer is
untouched. **I13 is not closed:** `useSessionRoster` is key-carrying and still unconsumed, and three
hand-rolled readers keep the old shape. **No mutation evidence exists for CP1–CP3**, and no browser
has ever rendered this calendar.

### M3 validation (measured at the implementation checkpoint `e5b0a57`, on top of I13 Checkpoint 3A `85530b4`)

The rows below are what was measured when M3's code landed. **Two of them are superseded for M3's
authoritative record** — the full-suite row (**F3**, below) and the mutation row — and the table that
follows, *"M3 completion validation"*, is the record M3 was accepted against. Both are kept, labelled
by checkpoint, so the history of the evidence is auditable rather than rewritten.

| Check | Result |
|---|---|
| Dependencies | ✅ none added, removed or changed — `package.json` and `package-lock.json` are untouched by the diff, so `npm ci` was not re-run this pass (`npm install` is never run, in CI or locally) |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm run build` | ✅ exit 0, `built in 3.10s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| `npm test` (full suite) | ⚠️ **superseded — see the correction note under this table.** As originally recorded: 104 files / 1423 passed / 0 failed / 0 skipped with `dist/` present so the CSP gates ran, over **3 consecutive full runs**, each 98–100 s. Three is below the six the spec's Tests clause requires of a milestone touching `LearningPanel.test.tsx`, a file that has flaked (**I11**), and this row was being quoted as the milestone's evidence — which is why the acceptance audit raised **F3**. Six-run evidence now exists twice over, at two checkpoints, in the table below; **this row is no longer authoritative and must not be quoted as M3's run evidence** |
| Targeted repeats | ✅ **6 consecutive runs** of the learning domain plus `staleQueryGates`, `emptyEnvironmentPanels` and `projectState`: **11 files / 160 tests** green on every run, no run retried (11 files / 161 tests after F1 added one case — see below) |
| Baseline before any M3 edit | ✅ measured in a `git worktree` of `85530b4` with `dist/` built and `node_modules` linked: **102 files / 1407 tests — 1406 passed / 0 skipped / 1 failed**. The single failure is `projectState.test.ts`'s "the recorded working branch is the branch actually checked out", which fails by construction in a detached worktree, not because of the code. The arithmetic is auditable: `1407 + 11 (LevelContentPanel) + 5 (contentAssignmentFlow) = 1423` and `102 + 2 = 104` |
| Mutation checks on the new tests | ✅ four independent mutations on the implementation checkpoint, each reverted byte-exactly from a backup and the file re-verified against it (`diff -q`). **A fifth — F1's reversion check — is recorded in the table below.** (1) `programId={selected.id}` → `programId={contentLevel.programId}` — the forbidden shape — fails **only** the adversarial crossing case. (2) Removing the selection-drop effect fails **only** the program-switch case. (3) Storing the pick raw instead of deriving it from this level's rows fails **only** the level-switch case. (4) Removing the in-flight state, so an empty level is shown while the read is pending, fails the in-flight case and the level-switch case. Every other case stayed green under each mutation, which is the evidence that the new tests detect the defects instead of restating the code |
| Protected suites | ✅ unchanged and green: `LearningPanel.test.tsx` (11), `StudentLearningPanel.test.tsx`, `demoRepository.test.ts`, `architectureBoundaries.test.ts`, `privacyPosture.test.ts`, `projectState.test.ts`, `writeFeedbackHonesty.test.ts`, `noSuccessWithoutWrite.test.tsx`, `emptyEnvironment.test.tsx`, `emptyEnvironmentPanels.test.tsx`, `staleQueryGates.test.tsx` and every Group A / Group D domain suite |
| Scope of the diff | ✅ `git diff 85530b4..e5b0a57 --numstat` = 5 files, **1414 insertions and 0 deletions** — one new component, one edited component, two new test files, one extracted test helper (`src/test/repositoryStubs.ts`). Zero deletions is the check that nothing was weakened, skipped, re-timed or removed. `git diff --check` clean |
| Browser QA | ❌ NOT VERIFIED (§5) — unchanged for every milestone, including this one |

The M3 workspace is the same fresh clone of the branch used for I13 (`/home/user/i13-work`), verified
before the first edit at `85530b40c66db63b10769537c2dc6cb24609842d` with a clean
`git status --porcelain`. The sandbox clone at `/home/user/parsian-music-dashboard-opus` remains
stale at the `292b8b8` graft and was left untouched, as instructed.

### M3 completion validation (the record M3 was accepted against — measured at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`)

This is **M3's authoritative evidence**: measured after the acceptance audit's one product fix (F1)
landed, on the branch `arena/01a07c61-parsian-music-dashboard-opus`, tree clean, with `dist/` present
so nothing skipped for want of a build artifact.

| Check | Result |
|---|---|
| `npm test` (full suite) — **F3, corrected** | ✅ **6 consecutive full-suite runs at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`: 104 files / 1424 passed / 0 failed / 0 skipped on every run**, with `LearningPanel.test.tsx` **11/11 on every run** (1907, 1921, 1928, 1938, 2083 and 2117 ms). No run retried, no test skipped, no assertion weakened |
| `npm test` (full suite) — as measured by the acceptance audit | ✅ **6 consecutive full-suite runs at `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed`: 104 files / 1423 passed / 0 failed / 0 skipped**, with `LearningPanel.test.tsx` 11/11 every run (1927–2086 ms). The arithmetic between the two records is `1423 + 1 = 1424`: F1 added exactly one case and nothing else |
| Focused suites | ✅ learning domain + `staleQueryGates` + `emptyEnvironmentPanels` + `projectState`: **11 files / 161 tests** green; `LevelContentPanel.test.tsx` **12/12** |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm run build` | ✅ exit 0, `built in 2.88s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| F1 reversion check (the fifth mutation) | ✅ the pre-fix component was restored from `db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed` and the suite re-run: **1 failed / 11 passed**, the new case failing on its *first* assertion — that the false-empty copy «منبعی برای اتصال باقی نمانده» is absent — and reporting the offending `<option>` element. The fix was then restored byte-identical (`diff -q`) and all 12 passed again. So the case pins the fix rather than restating the code |
| Scope of F1's diff | ✅ `git diff db5ec24e4477e92d9f9c1a94bc59c0c990fdeeed..3bec8811adaa65dd3c1b50c1125cc8c24dd9adad --numstat` = **2 files, 148 insertions / 55 deletions**: `src/domains/learning/LevelContentPanel.tsx` 87/55 and `src/domains/learning/__tests__/LevelContentPanel.test.tsx` 61/0. Nearly all of the component's churn is the re-indentation of the block the fix wrapped — with `-w` the same diff is **38 insertions / 6 deletions** in the component — and the test file's deletions are zero, so no case was weakened, re-timed or removed. No contract, schema, dependency or protected test touched; `attachContent` and `detachContent` unchanged |
| `git diff --check` | ✅ clean across the whole of M3 (`85530b40c66db63b10769537c2dc6cb24609842d..3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`) |
| Documentation gates | ✅ **52 passed**, including the six-run evidence rule ("Only repeated runs may be reported as green"), the rollback-boundary rule and the requirement that every recorded checkpoint exist in Git and descend from the current phase |
| Browser QA | ❌ **NOT VERIFIED** (§5) — unchanged, and **not** discharged by M3's completion |

**F2, the rollback correction, is recorded in [PHASES.md](PHASES.md) → "Product phase — M3":** the
spec's boundary is `c42f274ac10d4087f9280e3bf7b47141d0672e32` (**M2**), the effective safe boundary is `85530b40c66db63b10769537c2dc6cb24609842d`, and
`289e080`, `bcea26c` and `57c1dfb` — accepted work between them — **must survive any M3 rollback**.
No history was rewritten, reset or rebased to make the documents agree.

### Pre-M4 remediation validation (measured at `7e72887761f07f48e115160611a9785bfaae9060`, the tree that contains both remediation commits)

Two commits landed after M3's completion and before M4, at the owner's explicit authorization
following M3's acceptance audit: **C1 / I13 Checkpoint 3B**
(`fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`) and **C2** (`7e72887761f07f48e115160611a9785bfaae9060`).
**Neither is a milestone**; their substance is recorded in [OPEN_ITEMS.md](OPEN_ITEMS.md) I13
(Checkpoint 3B) and I16 (what C2 changed), and this table keeps the run evidence in one place so §3's
ledger and the [PHASES.md](PHASES.md) rows agree with it. The six-run evidence is measured on the tree
that contains **both** commits, not on `fba826f` alone — recorded that way rather than claimed
per commit.

| Check | Result |
|---|---|
| Dependencies | ✅ none added, removed or changed — `package.json` and `package-lock.json` are untouched by both diffs, so the dependency set these runs measured against is the one M3 was accepted on, installed by `npm ci` from that lockfile (`npm install` is never run, in CI or locally) |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) — which is part of C2's evidence rather than a formality: with `useSessions` and `useAttendanceRecords` taking `Paged<…>`, an omitted `per_page` fails here instead of in review |
| `npm run build` | ✅ exit 0; the pre-existing warning is unchanged — main chunk > 500 kB, no code-splitting (**I6**) |
| `npm test` (full suite) | ✅ **6 consecutive full-suite runs at `7e72887761f07f48e115160611a9785bfaae9060`: 105 files / 1435 passed / 0 failed / 0 skipped on every run**, with `dist/` built so the CSP gates ran instead of skipping, and `git diff --check` clean. The arithmetic against M3's completion record is auditable: `1424 + 9` (the new `useDerivedRead` suite) `+ 2` (C2's two architecture-boundary cases) `= 1435`, and `104 + 1 = 105` files — one new test file, and no existing file's cases removed, re-timed or weakened |
| Group A (protected) | ✅ untouched and green — the six pre-existing files in `src/domains/scheduling/__tests__/` (**211** tests, `useScheduling.test.tsx` 14/14) are unchanged by both commits; the only file added to that directory is the new 9-case suite, which is **not** Group A |
| Views (protected) | ✅ `src/views/Scheduling.tsx` and `src/views/Attendance.tsx` are untouched by both commits — the remediation hardened the *hooks*, not the views, which is exactly why **H1 stays OPEN** |
| Reversion / mutation checks | ✅ C1: restoring the pre-fix `useDerivedRead` from `HEAD` fails **4 of the 9** new cases on *identity* and no others, and the fix was then restored byte-identically. C2: both new cases in `src/__tests__/architectureBoundaries.test.ts` are recorded as mutation-checked in I16 |
| Scope of the diffs | ✅ C1 = 2 files, **669 insertions / 15 deletions** (the new suite 587/0, `src/domains/scheduling/useScheduling.ts` 82/15); C2 = 3 files, **135 insertions / 15 deletions** (`src/__tests__/architectureBoundaries.test.ts` 96/2, `src/domains/attendance/useAttendance.ts` 17/6, `useScheduling.ts` 22/7). Combined product source = 4 files, **804 / 30**. The only pre-existing test file either commit edited is `architectureBoundaries.test.ts`, which is not Group A and not a protected milestone suite |
| Documents | ✅ the two documentation checkpoints between M3's completion and C1 carry no product source: `1f98228e0b6a5cf289d7d96bb012194fe4d71b3b` (369/87 across the five `docs/engineering/` files) and `eab30d3bfa2476b8d995f7cdb942497afce25238` (1/1, one corrected row in §4) |
| Browser QA | ❌ NOT VERIFIED (§5) — unchanged for every milestone, and unchanged by this remediation |

**What this evidence does not say.** Repeated runs are evidence, not a proof of determinism. **I13 is
not closed** — three hand-rolled readers and two further exposures remain, and I14 is untouched. **I16
is not closed** — C2 guarantees that a ceiling is *stated* at the call site, not that the ceiling is
high enough, and `useClasses`, `useRooms` and `useTeachers` are not `Paged<>`, so M4's supporting reads
(chips, pickers) must pass `per_page` explicitly with no gate to catch an omission. **H1 is not
closed** — the scheduling view still renders fixtures.
*Both of those sentences are recorded as they were at `7e72887761f07f48e115160611a9785bfaae9060` and
are kept for audit.* M4 has since landed: its supporting reads do pass `per_page` explicitly
(`src/views/Scheduling.tsx:116`), CP1 added `useClasses`, `useRooms` and `useTeachers` to
`PAGE_SIZE_CALLERS` in `src/__tests__/architectureBoundaries.test.ts` so an omission is now caught by
a gate as well as by review, and the scheduling view no longer renders fixtures — which closes **H1a**
and leaves **H1** open on its attendance half (**H1b**, M5's). *(M5 has since closed that half; the
sentence is kept as the record of the checkpoint it was measured at.)*

### M2.1 validation (measured at M2.1, on top of M2 `c42f274` — kept for audit)

| Check | Result |
|---|---|
| `npm ci` | ✅ exit 0 (no install script; `npm install` is never run, in CI or locally) |
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm test` (full suite) | ✅ **97 files / 1369 passed / 0 failed / 0 skipped**, with `dist/` present so the 8 CSP gates ran (single definitive run, 111.3 s, taken after every document edit) |
| `npm run build` | ✅ exit 0, `built in 4.12s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Baseline before any M2.1 edit | ✅ **1345 tests** at M2 `c42f274`, measured in a `git worktree` of this clone: 1336 passed / 8 skipped / 1 failed. Both non-green parts are artifacts of *that* worktree, not of the code — it has no `dist/`, so the 8 CSP gates skip on the absent build artifact, and it is a detached HEAD, so `projectState.test.ts`'s "the recorded working branch is the branch actually checked out" fails by construction. The arithmetic is auditable: `1345 + 18 (new suite) + 6 (added to honestWriteCopy) = 1369` |
| Mutation check on the new tests | ✅ two independent reverts, each restored byte-exactly (`sha256sum`) and re-run. Reverting **the hook alone** fails all 18 new cases *and* the strengthened panel case, which reports `expected '' to be 'ساز زهی مضرابی؛ کلاسیک، پاپ و فلامنکو.'` — the erasure itself. Reverting **the three panels alone** fails the 3 new EMPTY cases and both ratchet cases, naming exactly those files, while the 3 DEMO cases still pass — correctly, since DEMO's copy was never wrong. This is the evidence that the new tests detect the defects instead of restating the code |
| Protected suites | ✅ unchanged and green: `architectureBoundaries.test.ts` (9), `privacyPosture.test.ts` (22), `projectState.test.ts` (52), `writeFeedbackHonesty.test.ts` (5), `noSuccessWithoutWrite.test.tsx` (8), `emptyEnvironment.test.tsx` (22), `emptyEnvironmentPanels.test.tsx` (10), `DomainCrud` (12), `StudentCrud` (5), and every Group A/Group D domain suite |
| Scope of the diff | ✅ 18 files: 1 hook, 6 dialogs, 3 panels, 3 existing test files, 1 new test file, 4 documents. No repository, `demoStore`, domain model, fixture, dependency, view or router change; `AssignPieceDialog` and `RecordProgressDialog` untouched |

The M2.1 workspace was a **fresh clone of the branch at `c42f274`**, verified before any edit
(`git rev-parse HEAD`, `git status --porcelain` empty, full history — 24 commits — so the Git-object
gates ran rather than skipping). The earlier M2 workspace was lost to sandbox recycling mid-milestone
and was re-cloned; nothing was carried over except the documented decisions. The sandbox clone that
started this session is stale at the `292b8b8` graft and was left untouched, as instructed.

### M2 validation (measured at M2, on top of M1 `689a7c1` — kept for audit)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm test` (full suite) | ✅ **96 files / 1345 passed / 0 failed / 0 skipped**, with `dist/` present so the 8 CSP gates ran (single definitive run) |
| `npm test` (before `npm run build`) | ✅ **96 files / 1337 passed / 8 skipped** — the same suite, the 8 CSP gates skipping on the absent build artifact. `1337 + 8 = 1345` |
| `npm run build` | ✅ `built in ~4.2s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet — **I6**) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Baseline before any M2 edit | ✅ **93 files / 1312 passed / 8 skipped** at M1 `689a7c1`, measured in a clean clone — so the arithmetic is auditable: `1312 + 8 = 1320` (M1's figure) and `1320 + 25 = 1345` (23 new tests + 1 added to each of two existing files) |
| Mutation check on the new tests | ✅ with the seven changed source files reverted to their pre-M2 content, **14 of the 18** new behavioural cases fail and the structural gate fails naming exactly the reverted file. The 4 that still pass are the DEMO-wording cases, correctly: DEMO's copy did not change. This is the evidence that the new tests detect the defects instead of restating the code |
| Protected suites | ✅ unchanged and green: `architectureBoundaries.test.ts` (9), `privacyPosture.test.ts` (22), `projectState.test.ts` (52), `loginEmptyEnvironment`, `loginDemoIsolation`, `DomainCrud`, `StudentCrud`, `StudentDetail`, `Students`, and every Group A/Group D domain suite |

The M2 workspace was a **fresh clone of the branch at `689a7c1`**, verified before any edit
(`git rev-parse HEAD`, `git status --porcelain` empty, full history so the Git-object gates ran
rather than skipping). The sandbox clone that started this session was stale at the `292b8b8` graft
and was left untouched, as instructed.

### M1 validation (measured at M1, on top of M0 `f2ebc09` — kept for audit)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output, exit 0) |
| `npm test` (full suite) | ✅ **1320 passed / 0 failed / 0 skipped** across all test files (JSON reporter, single definitive run) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Focused M1 suites | ✅ `dataLifecycle.test.ts` 28 · `useDemoData.test.tsx` 4 · `DataLifecycleGate.test.tsx` 10 · `FirstRunChooser.test.tsx` 9 · `DemoDataPanel.test.tsx` 5 · `projectState.test.ts` 52 |

The full number is **1320** (not the 1 315 quoted for the pre-M1 tree) because M1 added five focused
tests: the verbatim blob-failure propagation case in `dataLifecycle.test.ts`, the awaited
`uninitialize` pending/result and cancellation cases in `useDemoData.test.tsx`, and the
lockout/way-back cases in `DataLifecycleGate.test.tsx`, offset by the `projectState.test.ts` H5 guard
edits (same count, rewritten). This run had `dist/` present, so the 8 CSP tests ran rather than
skipping (see the `dist/` note below). Earlier full-suite attempts in this session reported failures
**only** in `projectState.test.ts` "recorded checkpoints are real Git objects" — the **L5**
graft-boundary state, not a regression — and cleared once `HEAD` was the real branch tip `f2ebc09`;
the definitive run above is green.

### Phase 2 baseline (kept for audit)

Measured at the Phase 2 checkpoint `33b1031`; re-run them before trusting them (see §8).

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (`tsc --noEmit`, zero output) |
| `npm test` | ✅ **91 files / 1255 passed / 0 failed** at `33b1031` |
| `npm run build` | ✅ `built in ~4.3s`; pre-existing warning: main chunk > 500 kB (no code-splitting yet) |
| `git diff --check` | ✅ clean (no whitespace errors, no conflict markers) |
| Group A + Group D integrity | ✅ 11 files / 314 tests (scheduling + attendance + shared metrics) |
| Protected-domain regression run | ✅ 15 files / 166 tests |

**About the "1247" figure you may see in older reports:** `src/__tests__/cspCompatibility.test.ts`
uses `describe.skipIf(!hasBuild)` where `hasBuild = existsSync("dist/index.html")`. Run before
`npm run build`, the suite reports `1247 passed + 8 skipped`; after a build exists, the same
suite reports `1255 passed + 0 skipped`. `1247 + 8 = 1255`. Both are green; the difference is
only whether the production artifact was present.

**`dist/` is a build artifact and is not in Git.** After a workspace re-clone it is absent, so the
same 8 CSP tests skip again and the total reads 8 lower. That is neither a failure nor a
regression: `npm run build` brings them back. Always report which shape you observed —
`N passed` or `(N−8) passed + 8 skipped` — rather than a bare number.

**Suite state at that pass** — the harness-race documentation checkpoint `f1fe114`, measured in its
own working tree with `dist/` present; the *current* numbers are the M2 and M1 blocks above, and
this one is kept because its arithmetic is auditable: `npm test` reported **93 files / 1 315 passed /
0 failed / 0 skipped**, `npm run typecheck` was clean, `npm run build` succeeded and
`git diff --check` was clean. The steps from the Phase 2 baseline:

| Step | Files | Tests |
|---|---|---|
| Phase 2 checkpoint `33b1031` | 91 | 1 255 |
| + `src/__tests__/projectState.test.ts` (the gate over these documents) | 92 | 1 284 |
| + `src/views/__tests__/loginEmptyEnvironment.test.tsx` (8 gates, EMPTY login) | 93 | 1 292 |
| + 16 gates added to `projectState.test.ts` by the audit corrections | 93 | 1 308 |
| + 7 gates added to `projectState.test.ts` by the harness-race record (that pass) | 93 | **1 315** |

Because the EMPTY-login labelling fix touched application source (`src/views/Login.tsx`), the build
was re-run and the neighbouring suites were re-verified green individually: `Login` (15),
`loginDemoIsolation` (5), `emptyEnvironment` (21), `architectureBoundaries` (9),
`privacyPosture` (22) — 80 tests across the six files that could have been affected, all passing.

### Suite reliability: a retired race, and what a green claim is worth

**The former flake.** `src/views/__tests__/emptyEnvironment.test.tsx` failed intermittently — twice
in six full-suite runs, never in a targeted one. The case was *"classes reports occupancy and
average attendance as absent, not as NaN"*: `expected '…' to contain '۰ از ۰'`, and the received
text contained «در حال چیدن کلاس‌ها…». Root cause: the shared `renderView()` helper waited only for
`viewTitles[view]`, which the shell renders immediately, so it could return while `useResourceList`
(`src/domains/shared/useResource.ts`) still had a repository read in flight. Every data-derived
assertion in that file was exposed, and the *absence* assertions were worse than flaky — they could
pass for the wrong reason, by measuring a loading placeholder. `git blame` places those lines in
Phase 2 (`33b1031`): an inherited harness race, not a regression from the documentation pass.

**The fix** — test code only, at the boundary that owned the bug. `renderView()` now also waits for
the design system's in-flight marker to disappear: `role="status"`, rendered by `BreathingWave` in
`src/components/ds/states.tsx` and wrapped by `LoadingState`. It is queried **by role, not by its
Persian label**, so a copy change cannot silently turn the wait into a no-op and let the race back
in. Because `useResourceList` starts `loading: true` and clears it in the same promise's `finally`,
"no marker in the DOM" is equivalent to "the loaded records are on screen" — **for a refetch of the
same query. That equivalence does not hold when the query's *params* change**, which is what I11's
second half turned out to be; see the correction below and
[OPEN_ITEMS.md](OPEN_ITEMS.md) I13. No sleeps, no retries,
no assertion weakened or removed — and the contract is now pinned for every live surface inside the
existing `it.each(LIVE_VIEWS)` case, not only for the test that was observed to fail.

**What the green claim is therefore worth.** Measured after the fix, with `dist/` present:
**22 consecutive targeted runs** of the affected file (21 tests each, the harness byte-identical
throughout) and **6 consecutive full `npm test` runs** — 93 files / 1 315 tests — all green, the
last of them on the exact tree that was committed. Under
artificial double contention (two full suites running at once, the exact condition that used to
lose the race) one of the two was green, and the affected file was green in both. That is
evidence, not a proof of determinism: quote the run counts together with the number, and re-measure
rather than inheriting this paragraph.

**One honest caveat — since investigated, and it was not what it looked like.** In the other half of
that concurrent pair a *different* test failed once:
`src/domains/learning/__tests__/LearningPanel.test.tsx`. It was recorded as uninvestigated and
carried as [OPEN_ITEMS.md](OPEN_ITEMS.md) I11 so that nobody concluded the suite was
contention-proof. A read-only triage on 2026-09-12 reproduced it — **1 failure in 4** full-suite
samples run as two concurrent suites, after 31 focused runs stayed green — and found that
**contention was an amplifier, not the cause**: the state it exposed occurs on *every* run.

**What it actually was.** `useResourceList` sets `loading` inside an effect, so when a list query's
params change there is one committed frame holding the *previous* query's rows with `loading ===
false` and **no in-flight marker at all** — measured `role="status"` 0, `aria-busy` 0, no loading
string. `LearningPanel` reaches that frame on mount because it asks for `{ per_page: 0 }` before a
program is selected and `paginate`'s `Math.max(1, …)` turns "no rows" into **one** row, so the panel
showed «سطوح «ویولن کلاسیک» — ۱ سطح» over a single unrelated level while the store held fifteen. The
file's `waitForPanel()` waited only for the two loading strings to be absent — which they were in
that frame — so a case read `levelItems().length` as 1 and failed with `expected 16 to be 2`. It was
**not** the case I11 named (*"reorders levels…"*, which passed in the failing run); every case in the
file shared the helpers. A starvation timeout was measured and ruled out: the reorder case runs
178 ms idle and 483–609 ms under four-way oversubscription, against a 5000 ms test timeout.

**What was fixed (test code only, Tier 1).** `waitForPanel()` now settles on the data instead of on
marker absence: it asserts against the repository that the rows on screen are the rows belonging to
the program the heading names — same count, same order, same titles — and returns that state, so no
case reads the list before it is settled. Marker checks remain as necessary-but-not-sufficient
conditions. No sleep, no retry, **no timeout increased**, no assertion weakened, skipped or deleted.
  One case was added (*"never shows one program's levels under another program's heading"*) and three
  were strengthened. Mutation-checked with a read-only probe: it recorded instants where the old
  condition holds and the new one is violated (`rowsOnScreen=1` against `storeForThatProgram=15`),
  three runs out of three. **Measured after the fix, per §10.1's six-run rule for a file that has
  ever flaked:** 6 consecutive full `npm test` runs — 97 files / 1370 passed / 0 failed / 0 skipped
  each, `dist/` present — plus **4 samples run as two concurrent full suites**, the exact condition
  that reproduced the failure (1 in 4 before the fix), all green with the file at 3288–3792 ms
  against 2498 ms idle, so the contention was real and heavier than the run that failed. A seventh
  full run on the final tree was green after the documentation edits below.

**What was deliberately *not* fixed.** The product behaviour that creates the frame is untouched and
is recorded as **I13** (the hook publishes a previous query's page with no marker — 12 domain hooks,
every list in the product) and **I14** (`paginate` clamps `per_page: 0` to one row — three call sites
rely on it meaning "nothing"). Tier 1 closes I11 as a *test reliability* defect; it does not close
I13 or I14, and neither is reported as fixed. I13 matters before M3 specifically because
`attachContent` has no cross-program guard, unlike `assignPlacement`.

*Superseded in part on 2026-09-13, and left here as the record of that pass rather than rewritten:*
**I13's Checkpoint 1** — the shared hook plus the six dynamic-params consumers that ignored
`loading` — was subsequently authorized, implemented and **validated** at `289e080` (6 consecutive
full-suite runs green, 4 contention samples green, build, typecheck, 68 documentation gates, and a
reversion check on each half).
**I14 is untouched and explicitly deferred**, and so are the four remaining hand-rolled readers of
I13's Checkpoint 3; its fifth, `useDerived` — the one with a real consumer — was fixed as
**Checkpoint 3A** at `57c1dfb` after the exposure was reproduced deterministically.
**Checkpoint 2** — the `attachContent` intent guard — was authorized the same day as its own pass,
recorded as in progress before its code was written, and has since **landed and been validated** at
`bcea26c`. See §7 item 12 and [OPEN_ITEMS.md](OPEN_ITEMS.md) I13.

## 5. Browser QA status

❌ **NOT VERIFIED — unchanged, and must not be reported as passed.**

No browser automation exists in this environment (`package.json` has no Playwright,
Puppeteer, Cypress or WebDriver dependency, and no browser engine can be installed). All
verification is jsdom + `tsc` + the Vite build. Manual browser QA is still required for:
mobile drawer/bottom-nav, command-palette keyboard flow, focus trapping in dialogs, chart
rendering, RTL layout at tablet/mobile breakpoints, real audio playback, real file-picker and
file-download paths, and the first-run lifecycle chooser on a genuinely fresh browser
profile. **M3 adds one more:** the learning-content assignment surface
(`src/domains/learning/LevelContentPanel.tsx`) has never been opened in a browser — its four states,
its picker, its toasts and its keyboard path are jsdom-verified only. **M4 added the item it predicted, and it is
still open:** the scheduling calendar has never been opened in a browser. `src/views/Scheduling.tsx`
now reads through `useSessions` and writes through `rescheduleSession`, `cancelSession` and
`generateSessions`, with `useGenerationPreview` and `useConflictCheck` driving its dialogs — so its
day and week navigation, its Jalali date rendering, its reschedule and cancel flows, its generation
preview and its conflict states are **jsdom-verified only** until this checklist is performed. Written
down before M4 landed rather than after, and not discharged by its landing. The two pre-M4
remediation commits changed no view, so they add nothing to this list — and they do not shorten it.
**M5 added its own item, and it is still open:** the attendance register has never been opened in a
browser. `src/views/Attendance.tsx` now reads through `useSessions`, `useSessionAttendance`,
`useAttendanceRecords` and `useAttendanceCorrections`, and writes through `record`, `bulkRecord` and
`correct`, so its session picker, its derived register, its bulk-save control, its correction dialog,
its empty and truncated states, and its Persian success and refusal sentences are **jsdom-verified
only** until this checklist is performed. Written down before this documentation pass rather than
after, and not discharged by M5's landing. **M6 added its own item, and it is still open:** the
Messages surface's two genuinely browser-only paths have never been exercised in a browser. The
**file picker** (`AttachmentPicker` → the browser's own dialog) and the **file download**
(`downloadBlob` → an object URL handed to a browser) cannot run under jsdom at all: jsdom implements
neither `URL.createObjectURL` nor a download, so M6's export suite **stubs that one unavoidable
browser API** and asserts the artifact's real bytes instead (`Blob` content, filename, BOM, MIME
type), counting anchor clicks at the seam rather than pretending a download happened. That is the
honest limit of the evidence: the artifact is verified, the browser behaviour is **not**. The
attachment card's image preview has the same shape — the object URL cannot exist in jsdom, so the
missing-bytes and withheld-affordance states are what is pinned, and the successful-preview state is
unverified until a human opens `#/messages`. See `docs/production-handoff.md` → "NOT verified". **M7 added three surfaces and the chrome, and it is still open:** the student, teacher and class profiles now resolve their relations through repository reads, and the sidebar computes its one badge from the chat repository — so the academy-day anchoring (the Saturday-first week, the `academyIsoDate()` window), the partial-page notes, the «—» placeholders, the per-class roster and week panels, the rooms panel and the badge's appearance/disappearance at zero are **jsdom-verified only** until this checklist is performed. Written down at M7's documentation pass rather than after its landing, and not discharged by it. **P1 adds no item to this checklist, and that is a statement
about scope rather than evidence of coverage.** **The UI workstream that followed P1 adds one, and it is
open:** the compensation surface (`src/views/Compensation.tsx` and
`src/views/compensation/CompensationDialogs.tsx`) has never been opened in a browser. Its ledger and
drawer states, its indeterminate counts, its refresh-failure banner, its three dialogs (the bounded
candidate list, the warning acknowledgement and the Persian Jalali date fields), its move dialog, and
its focus, Escape and RTL behaviour at tablet/mobile breakpoints are **jsdom-verified only** until this
checklist is performed. Recorded at the workstream's documentation reconciliation rather than after a
browser pass, and not discharged by its landing.

## 6. Protected domains and invariants

These are pinned by tests. Changing them is a regression, not a refactor.

| Area | Pinned by |
|---|---|
| **Group A — scheduling** (Session model, conflict engine, generation, Jalali date bridge) | `src/domains/scheduling/__tests__/conflicts.test.ts` · `generation.test.ts` · `dateBridge.test.ts` · `demoRepository.test.ts` · `registry.test.ts` · `useScheduling.test.tsx` — **211** tests. `src/domains/scheduling/__tests__/useDerivedRead.test.tsx` sits in the same directory but is **not** Group A: it pins I13's Checkpoint 3B, was added by `fba826f`, and is equally off-limits to weakening. **No file in this group changed at
M4's CP1–CP3 or at M5** (`git diff --name-only 7e72887761f07f48e115160611a9785bfaae9060..9505ade4011b37a34e3488fd51206512829205ec`
lists nothing under `src/domains/scheduling/__tests__/`), and all six are green at
`9505ade4011b37a34e3488fd51206512829205ec` |
| **Group D — attendance** (append-only corrections, roster) | `src/domains/attendance/__tests__/demoRepository.test.ts` · `roster.test.ts` · `useAttendance.test.tsx` — **79** tests. **M5 wired the shipped view to this domain and changed no file under `src/domains/` at all**, so the milestone that consumes Group D is also the proof that it stayed frozen. `src/domains/attendance/useAttendance.ts` was *not* protected and M5 could have added a read hook there; it did not, which is why **I13** survives with a view-boundary mitigation (§7 item 12) |
| **The wired attendance view** (no fixture read, real writes, the RBAC gate, honest empty states) | `src/views/__tests__/attendanceNoFixtures.test.ts` (31) · `src/views/__tests__/attendanceWrites.test.tsx` (22) · `src/views/__tests__/noSuccessWithoutWrite.test.tsx` (14) · `src/__tests__/writeFeedbackHonesty.test.ts` (6) — added and re-driven at M5, `9505ade4011b37a34e3488fd51206512829205ec` |
| Library + real media bytes (Phase 1) | `src/views/__tests__/Library.test.tsx` · `src/domains/library/__tests__/useLibrary.test.tsx` · `demoRepository.test.ts` · `apiRepository.test.ts` · `AudioMessagePlayer.test.tsx` · `src/domains/media/__tests__/media.test.ts` |
| Student profile + messages regressions (Phase 1) | `src/views/__tests__/studentProfileRegression.test.tsx` · `messagesDatasetRegression.test.tsx` |
| Persistence boundary: migration, backup/restore, dataset integrity, prototype-pollution defence | `src/services/__tests__/demoStoreMigration.test.ts` · `src/domains/demo/__tests__/backup.test.ts` · `contracts.test.ts` · `dataIntegrity.test.ts` · `prototypePollution.test.ts` · `seed.test.ts` |
| Lifecycle model (Phase 2) | `src/domains/demo/__tests__/dataLifecycle.test.ts` · `src/components/lifecycle/__tests__/FirstRunChooser.test.tsx` · `DataLifecycleGate.test.tsx` · `src/views/__tests__/emptyEnvironment.test.tsx` · `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` · `src/components/settings/__tests__/DemoDataPanel.test.tsx` |
| Login in an EMPTY environment — truthful labels **and** preserved bootstrap entry | `src/views/__tests__/loginEmptyEnvironment.test.tsx` · plus `src/views/__tests__/loginDemoIsolation.test.tsx` (api isolation) and `src/views/__tests__/Login.test.tsx` (form/auth contract) |
| Layering (views never touch `localStorage`/`demoStore`/`fetch`/hardcoded URLs/`ACADEMY_NOW`) | `src/__tests__/architectureBoundaries.test.ts` |
| Privacy/exposure posture and absence of embedded secrets | `src/__tests__/privacyPosture.test.ts` |
| Production artifact loads under the deployed CSP | `src/__tests__/cspCompatibility.test.ts` |
| Route protection + boot gates | `src/__tests__/routeProtection.test.tsx` · `src/__tests__/configGate.test.tsx` |
| **The wired Messages surface and its chat contract** (no fixture read, real writes, attachment validation, honest empty/error states, text-only export) | `src/domains/chat/__tests__/conversationLifecycle.test.ts` (16) · `messageAttachments.test.ts` (15) · `src/views/__tests__/messagesConversationManagement.test.tsx` (13) · `messagesStateSafety.test.tsx` (9) · `messagesAttachments.test.tsx` (19) · `messagesConversationExport.test.tsx` (21) · `messagesNoFixtures.test.ts` (13) — added and re-driven at M6 (CP1–CP4), `4e03b8762bebcb87e46cf7044af5da99d709b4d2`. The two Phase 1 regressions in this area (`messagesDatasetRegression.test.tsx`, `MessagesChat.test.tsx`) stayed green and unweakened |
| **The M7 relation surfaces and the navigation chrome** (relations read from their own domains, no fixture resolver, no `studentIds` roster, no static count in the chrome) | `src/views/__tests__/relationsNoFixtures.test.ts` (17 — the per-surface gate: 5 surfaces enforced, empty deferral ledgers, both-direction rule liveness, the numeric-hint and option-count rules in both digit scripts, `studentIds` as a forbidden relation identifier, and the relapse replays) · `src/views/__tests__/relationsPlumbing.test.ts` (12) · `studentsRelations.test.tsx` (7) · `teachersRelations.test.tsx` (11) · `classesRelations.test.tsx` (13) · `navigationCounts.test.tsx` (7) — added at M7 (CP1–CP4), `f1ec0ddde783aec14d6429ac2457f085f851ad9a`. The milestone's protected suites (`studentProfileRegression`, `StudentCrud`, `StudentDetail`, `Students`, `DomainCrud`, the national-ID matrix, `emptyEnvironment`) stayed green and unweakened |
| **The compensation contract** (obligation entity with a typed link, derived state, append-only attempt ledger, explicit registration by `schedule.write`, booking through the scheduling verb, lifetime uniqueness per `(original, student)`, at most one live make-up read through the booking's reschedule lineage, and eligibility at the make-up's date disclosed on read and never gated — **D20**) | `src/domains/compensation/__tests__/derive.test.ts` (31) · `demoRepository.test.ts` (38) · `bookingInvariant.test.ts` (10) · `authorization.test.ts` (11) · `datasetContract.test.ts` (15) · `enrollmentEligibility.test.ts` (9) · `useCompensations.test.tsx` (5) · `persianDate.test.ts` (2) — **121** tests in eight files. The first five came with the Class Compensation P1 workstream (`a21311d7e32c82e3a46b1581c94f6b3478bf646c`); `authorization.test.ts` with the write-authorization and uniqueness hardening (`b7a97b325741b1129f6d50a7d067d1aa6459597c`); `bookingInvariant.test.ts` with C-1's at-most-one-live-make-up rule and C-1.1's lineage semantics (`cd91ed6a75a9c053b60e4e9dbbc10e06cf89a291`); `enrollmentEligibility.test.ts` with C-2. Groups A and D are unchanged by all of it: no commit in that chain lists a file under `src/domains/scheduling/` or `src/domains/attendance/`, and `Session`/`SessionStatus` are untouched |
| **The compensation surface** (no domain rule re-implemented, actions addressed at `currentAttempt.sessionId`, honest count and failure states, the refresh-failure disclosure, the bounded candidate window, the C-2 disclosure rendered and never gated, and one shared Jalali input boundary) | `src/views/__tests__/compensationUi.test.tsx` (16) · `src/__tests__/routeProtection.test.tsx` (9, two of them this surface's) — added at `fc83d6d`, hardened at `79fd44e` and `79ec13d`. **Caveat, recorded rather than smoothed over:** the per-surface gates do **not** enumerate this view (**I21**; since closed by the surface's own dedicated boundary gate — `src/views/__tests__/compensationNoFixtures.test.ts` (40) at `bf8bd91150d6fca3392115c7eccd6c738e9091ee` — while the three fixed lists still do not enumerate it; see §4 → "S-6 boundary gate validation") |
| These engineering documents stay truthful | `src/__tests__/projectState.test.ts` |

**Standing engineering invariants** (full rationale in [DECISIONS.md](DECISIONS.md)):
reads never write; the lifecycle mode is a persisted fact, never inferred from row count;
demo-only material never reaches an EMPTY environment; missing bytes produce an honest
"unavailable" state, never a fabricated URL; no-data is an explicit typed value
(`NO_DATA = "—"`), never `NaN` and never a consumer-side `|| []` patch; no fake success UX.

## 7. Known limitations (honest, unresolved)

1. **Fixture-driven surfaces.** Dashboard insight panels (`src/components/panels/Intelligence.tsx`,
   `BusinessIntelligence.tsx`, `Signals.tsx`, `AttentionAndFlow.tsx`) read static fixtures from
   `src/data/academy.ts`, so they show fabricated sentences even in EMPTY.
2. ~~**Static sidebar badges** (`src/components/layout/Sidebar.tsx:120` → `badge={n.badge}` from
   `src/data/academy.ts`) show counts that are false in EMPTY.~~ **CLOSED at M7** (`f1ec0dd`, **I1**). `NavDef` no longer has a `badge` field at all, so a static count cannot be written into the chrome without failing `src/views/__tests__/relationsNoFixtures.test.ts`; the one badge with a real source — unread messages — is summed from the conversation rows the chat repository returns and is rendered **only while that read is complete and positive**, so in-flight, failed, partial and zero all render nothing (`navigationCounts.test.tsx`); and the attendance badge was **removed**, because no scoped, pageable "unrecorded sessions" read exists to answer it — the reason is documented in `src/components/layout/Sidebar.tsx` rather than left implicit. What is *not* closed by this: the fixture identity still on screen (the academy name in the shell and on the login screen) is **M8/D2**.
3. **Views not wired to their real domains — both down, and the two that remain have no domain at
   all.** **Attendance came off this list at M5** (`9505ade4011b37a34e3488fd51206512829205ec`):
   `src/views/Attendance.tsx` reads a bounded window of real sessions through `useSessions`, one
   derived register through `useSessionAttendance`, the window's marks and recorded absences through
   two `useAttendanceRecords` reads, and the correction trail through `useAttendanceCorrections` —
   and writes through `record`, `bulkRecord` and `correct` — so the fixture-driven register is gone
   (**H1b** closed, and with it the umbrella **H1**). **Scheduling came off it at M4** (**H1a**
   closed). What remains is Finance and Reports, which have **no domain layer at all**, so they are
   **I2** and M9's rather than a wiring milestone's. What the two completed wirings do *not* cover is
   recorded rather than smoothed over: `useSessionRoster` is still unconsumed — M5 read the attendance
   domain's own derived register instead, so that scheduling verb **belongs to no milestone**; five
   scheduling repository verbs (`get`, `create`, `update`, `delete`, `sessionRoster`) have no shipped
   caller, each with its reason in `src/domains/scheduling/README.md` §3; and two of attendance's
   eight verbs (`get`, `sessionIdsWithAttendance`) have none, each with its reason in
   `src/domains/attendance/README.md` §3.
4. **Backup envelope always says "demo"** — `environment: "demo"`, app name `…(DEMO)`, filename
   `arena-demo-backup-*.json` — even for a customer's EMPTY data. Round-trip is lossless; the
   labels are wrong. Fixing it is a versioned format change touching the `WRONG_ENVIRONMENT`
   validation rule.
5. **`clear()` still produces an environment nobody can sign into; M1 adds a local recovery path.**
   It empties `users`, so no account remains, while the lifecycle marker survives — so
   `DataLifecycleGate` stays transparent and the visitor lands on a login screen that cannot
   succeed. Settings, and therefore "restore a backup", remains *behind* that login. This
   `clear()` behaviour is deliberately unchanged; `uninitializeEnvironment()` is the separate
   recovery operation. In local EMPTY/DEMO mode, the lifecycle gate owns the controller and
   `src/views/Login.tsx` renders `src/components/lifecycle/LifecycleRecoveryPanel.tsx` outside the
   signed-in shell. It calls `uninitialize` only after the second confirmation, shows truthful
   counts, waits for blob cleanup, and surfaces the exact `UninitializeResult.message` (including
   any blob-failure clause) before the chooser offers EMPTY or DEMO again. API mode has no local
   recovery affordance. The M1 implementation is present in the current working tree but remains
   provisional until validation and a durable phase checkpoint; see **H5** in
   [OPEN_ITEMS.md](OPEN_ITEMS.md) and I10 below.
6. **Latent DS crashes**: `Sparkline` with `data={[]}` and `BusinessIntelligence` with an empty
   series. Not reachable today (static fixtures only) — must be guarded before those panels go live.
7. **Command-palette natural-language matching is substring-loose** (`q.includes(keyword)`).
8. **Dead code**: `TeacherNote` in `src/data/records.ts:31` is defined and never used.
9. **Documentation drift**: `docs/gap-matrix.md` is a stale Phase 0 audit; parts of
   `docs/architecture/data-layer.md` still claim scheduling/attendance/messages/library have no
   domain layer; `docs/production-handoff.md` still quotes "38 files / 340 tests"; the
   the `attendance` README's identical "not implemented in Phase A" stub was retired by this
   documentation pass, and M5 falsified six further statements in the `scheduling` README, corrected
   here too — so both domain READMEs now describe **wired** views rather than planned ones (the
   `scheduling` stub and its invented `POST /sessions/{id}/move` contract went in M4's CP0 and its
   final reconciliation; see [OPEN_ITEMS.md](OPEN_ITEMS.md) **L3**). The rest of this drift stays
   M10's, and **L6** records the two stale claims left in `src/views/Attendance.tsx`'s own header
   comment, which a documents-only pass may not edit.
10. **No code-splitting** — one main chunk > 500 kB (build warning).
11. **No backend.** `api` mode is an architectural seam pointing at a server that does not
    exist. See `docs/production-handoff.md` and `docs/security.md` §8.
12. **A list could show the previous query's rows and claim nothing was loading — being closed, not
    yet closed.** `useResourceList` set `loading` inside an effect, so when a query's params changed
    one committed frame still held the previous page with no in-flight marker of any kind — measured
    on `LearningPanel`: a single unrelated level under a heading claiming «۱ سطح» for a fifteen-level
    program, and on a program switch piano's heading over violin's rows with their delete and move
    buttons enabled; and demonstrated destructively on `GalleryPanel`, where a «حذف» offered under a
    newly selected album targeted an image of the album the user had navigated away from.
    `StudentLearningPanel` rendered «سطح نامشخص از ۱ سطح این دوره» in the same window for a placed
    student. **I13's Checkpoint 1 is implemented and validated** (6 consecutive full-suite runs
    green, 4 contention samples green, build, typecheck, documentation gates, and a reversion check
    on each half): the state now
    carries the query identity it answers and what the hook exposes is derived at render, so a page
    belonging to another query cannot be exposed at all, and the six consumers that ignored `loading`
    now show an in-flight state instead of a false empty. **Checkpoint 2 is implemented and validated
    too** (`bcea26c`, 6 consecutive full-suite runs green, build, typecheck, documentation gates, and
    a reversion check that fails 7 of the 15 new tests and the compile pin): `attachContent` now takes
    a required `AttachContentIntent { programId }` from the caller and refuses a level that does not
    belong to it — `LINK_INVALID`, nothing written, no placed student's derived eligibility changed —
    so a row left over from another query cannot become a write into a ladder nobody is looking at.
    **Checkpoint 3A is implemented and validated too** (`57c1dfb`): `useDerived`, the one boundary
    behind `useStudentPlacement` and `useEligibleContent`, now carries the key it answers and derives
    what it exposes at render, so a student switch cannot show one student's placement or unlocked
    content under another's name. It was **reproduced deterministically before being fixed** — the
    dedicated suite failed 4 of 8 against the unmodified hook — and its reachability is recorded
    honestly: the frame was *not* observable through the app's own navigation, because `src/App.tsx`
    keys the view subtree on `detailId` and so remounts the panel; the hook's correctness should not
    depend on an ancestor's key, and any consumer that switched students in place would have
    inherited the exposure. **Checkpoint 3B is implemented and validated too** (`fba826f`, the first
    of the two pre-M4 remediation commits): `useDerivedRead` — scheduling's boundary, behind
    `useSessionRoster`, `useGenerationPreview` and `useConflictCheck` — carries its query key with the
    same shape, reproduced before being fixed by a new 9-case suite and checked by a reversion that
    fails 4 of the 9 on identity. It was hardened ahead of **M4** rather than inside it because M4 is
    what makes those three readers reachable in shipped UI — and M4 has since landed and made **two of
    the three** reachable: `useConflictCheck` in `src/views/scheduling/SessionWriteDialogs.tsx` and
    `useGenerationPreview` in `src/views/scheduling/GenerateSessionsDialog.tsx`. `useSessionRoster` is
    still unconsumed — **and M5 did not consume it**: the attendance view reads the attendance
    domain's own derived register, so the roster a session really has is now rendered from attendance
    and that scheduling verb belongs to no milestone. **M5 made one more reader reachable without
    fixing it:** `useSessionAttendance` is now behind shipped UI in `src/views/Attendance.tsx`, still
    carries no query key, and the view guards the exposure instead — it compares
    `attendance.sessionId === selectedSessionId` and withholds the register while they disagree
    (`src/views/Attendance.tsx:250`), with a test case named for keeping the upstream defect visible
    rather than claiming a fix. That is a **mitigation, not a closure**. **Still open:** the two
    remaining hand-rolled readers keep the old shape (rest of Checkpoint 3, not authorized;
    `useStudentList` unreachable because every call site passes constant params, `useStudentProgress`
    with no consumer until M6/M7), and `useSessionAttendance` is unfixed and now reachable; `useLibraryFile` can offer the previous item's bytes under a
    new title; `useMediaObjectUrl` exposes the previous object URL for one frame. `paginate` still
    turns `per_page: 0` — three call sites' way of saying "load nothing" — into one row (**I14**,
    untouched and not an M3 blocker; neither remediation commit closes it, because **C2** makes
    *omitting* `per_page` a compile error at the call site, which is not the same as making `0` mean
    nothing). The test harness stopped
    trusting that frame earlier (**I11**,
    fixed).

13. **M5's own limitations, none of them closed by declaring the milestone complete.** There is **no
    un-record, no edit and no delete** of a mark, and no way to edit or delete a correction — the model
    is append-only by contract (`src/domains/attendance/repository.ts`), not by omission. **No
    notification of any kind is sent**: nothing messages a teacher, a student or a guardian (**D1**
    defers the student role, **I7** defers provider research), and both the register panel and the
    correction dialog say so out loud rather than leaving it implied. **No academy-wide rate, trend or
    per-day chart exists in this view** — the fixture view's fabricated «نرخ حضور امروز» and its
    per-instrument breakdown were removed, not rebuilt, and the only aggregate this domain still feeds
    is the dashboard's in `src/domains/shared/useAcademyMetrics.ts`. **No per-student longitudinal
    history and no «آخرین حضور» projection** (**H5**'s ceiling, honoured by absence). **No storage
    round-trip is tested**: the register is re-read after each write and the correction trail is read
    back, but no test unmounts and remounts the view, so "a recorded roster survives a reload" rests on
    the demo store's single-persistence-authority code path. **`src/domains/attendance/apiRepository.ts`
    stays deliberately unregistered**, so backend aggregation does not exist and no server implements
    the endpoints that file documents. **Two of the eight verbs have no shipped UI caller** (`get`,
    `sessionIdsWithAttendance`), with reasons in `src/domains/attendance/README.md` §3. **I16 stays
    OPEN** — this view states its ceilings (**seven** bounded reads, each with an explicit page size:
    200 for sessions, classes, teachers, students and both record queries, 50 for the correction
    trail), counts from
    `total` and announces a truncated page, but every other consumer is untouched. **D8**'s api-mode
    indicator does not exist until **M11**. And the legacy `attendance` seed collection survives with
    no reader in the view that owns it: `src/domains/demo/seed.ts:166` still seeds `todayAttendance`,
    `src/domains/demo/backup.ts:242` still reads it so a round-trip stays lossless, and its membership
    in `src/views/__tests__/emptyEnvironment.test.tsx`'s fixture list **was deliberately not moved**,
    because that membership asserts `inFlightMarkers() === 0` — moving it would have been a semantic
    test change this milestone was not authorized to make. Only labels and comments were corrected
    (three → two of four). **M10** owns the seed cleanup and that gate's membership; **D5** exists to
    separate the three roles a fixture can play.
14. **This record is a replay of a documentation checkpoint that was lost unpushed.** The first pass
    measured, edited and committed all seven documents, and the workspace was recycled before its push
    landed — the commit, its clone and a `git format-patch` backup written outside the clone all ceased
    to exist, and nothing was recoverable. Every number in §4's M5 block was therefore **re-measured
    from scratch** on a fresh full clone of the authoritative pushed tip rather than copied from the
    lost record, and the three mutation checks were taken in a throwaway `git worktree` so that no
    product file in the working tree was ever altered. The replayed commit carries a different SHA, and
    no claim of byte-identity with the lost one is made or implied. **L5** — validated work left
    unpushed between turns — has now destroyed work twice. This record was written under the rule that
    lesson produces and did **not** achieve it, which the first wording of this item claimed: the commit
    was made locally, its first push failed on an invalid GitHub token, and after the connection was
    restored the same commit was pushed unchanged as a fast-forward — no amend, no force-push, no reset,
    no rebase, no second commit. It therefore *did* sit unpushed across a turn boundary and survived,
    which is a credential expiring at a fortunate moment rather than a mitigation. The rule stands; the
    claim that this commit followed it does not.

15. **M6's own limitations, none of them closed by declaring the milestone complete.** **Attachment
    ownership and authorization remain backend-required.** The chat repository refuses a `mediaId`
    that does not *resolve*; that is resolution, not authorization, and neither the domain nor the
    view claims otherwise — production needs server-enforced per-object authorization, signed and
    expiring URLs, server-side content sniffing and virus scanning (`src/domains/media/types.ts`,
    `docs/production-handoff.md`). **Attachment bytes are browser-local.** They live in the media blob
    store (IndexedDB, or an in-memory store where IndexedDB is absent), so an attachment survives a
    reload only in the browser that uploaded it, a backup carries metadata and **not** binaries, and
    the honest "bytes unavailable" state is therefore a real, expected state rather than a bug. There
    is **no server persistence and no shared thread**: chat resolves to the demo repository in both
    modes, and no chat API repository exists. **The export is single-conversation plain text**:
    attachment **metadata** only (no bytes), a disclosed **1 000-message ceiling** rather than a silent
    truncation, no bulk/multi-conversation export, no PDF/ZIP/CSV pipeline for chat, and **no export
    verb** — deliberately, because `getConversation` plus `listMessages` already express it. **No
    delivery beyond `in_app`**: Telegram, Bale, SMS and email report `unavailable` (`D1`, **I7**), and
    no notification is sent. **`archiveConversation` still has no shipped caller by decision** (D14 —
    one write path is what makes restore provable). **I15 stays OPEN**: M6 fixed the `Messages.tsx`
    site only, and `OPEN_ITEMS.md`'s I15 register still lists that file among the unfixed consumers,
    which is now stale on that one line — recorded here instead of quietly edited, because that
    register is the honest inventory of the remaining sites. **I13 stays OPEN**: the attachment card
    consumes `useMediaObjectUrl`, which carries the same unfixed one-frame exposure. In this surface
    it is not *reachable* — the bubble list is keyed by `message.id`, a message's `mediaId` never
    changes, and the card withholds its open affordance until its own bytes check resolves for the
    current id — but that is reasoning about a surface, not a fix, and no closure is claimed. **No
    storage round-trip test**: M6's suites re-read through fresh repository instances, but none
    unmounts and remounts the view, so "a thread survives a reload" rests on the store's
    single-persistence-authority path, exactly as M5 recorded for its own surface. And **browser QA has
    never run** (§5) — the file picker and the download path are jsdom-untestable by construction.
16. **One test has failed in every session of this milestone, and it is environmental — it is recorded,
    not fixed, silenced or accommodated.** `src/__tests__/projectState.test.ts:299` asserts that the
    branch recorded in §2 (`arena/01a07c61-parsian-music-dashboard-opus`) is the branch actually checked
    out, and in this session's sandbox the checked-out branch is
    `arena/01a0a068-parsian-music-dashboard-opus` — a fresh Arena session branch, not a rename of the
    recorded one. The failure was measured at the **pre-M6 base `9190da0`**, at **M6 CP1** and at
    **M6 CP2** by running the same file on each tree and diffing the per-test outcomes and the failure
    block after ANSI normalization: **identical at all three** — same test, same assertion, same
    expected and received values, `51 passed / 1 failed` — and the same single failure is what the
    CP3, CP4 and CP5 runs report. **M7 measured it again, and found that only the clone's depth changes anything:** this session's workspace arrived **shallow** (11 reachable commits, `33b1031` absent), which put **9** Git-object cases in this file red; after the read-only `git fetch --unshallow origin` that restored 62 commits — no reset, no checkout, no branch move — the file reported **51 passed / 1 failed** on the identical product tree, the same single branch-name failure as at M6. The owner ruled it **environmental** and the ruling is the standing
    policy: the branch is **not** renamed, `projectState.test.ts` is **not** skipped, xfailed or
    suppressed, and §2 is **not** edited to make the gate green — the recorded value is a durable fact
    about where this work has been done, and a per-session sandbox branch name is not. Everything else
    in §4's M6 block was measured with this failure present, and the suite's totals (1 655 passed / 8
    skipped) are quoted with it rather than around it.

17. **M7's own limitations, none of them closed by declaring the milestone complete.** **The fixtures are not deleted, and their three roles are untouched** — M7 removed *readers*, not data: `src/data/records.ts` and `src/data/academy.ts` still provide entity types, the canonical DEMO seed (`src/domains/demo/seed.ts`) and the fake data other views still render, and the separation is **M10/D5**. **`useStudentList` is still un-keyed** (**I13**, above): M7 reached it from three surfaces and guarded each mount with the consumer-side key the gate now requires, which is a mitigation and not a closure. **The `per_page: 200` ceilings stay** (**I16**): every M7 read states one and every surface distinguishes a partial page from a complete one in its own words, but the ceiling itself is unchanged and no other consumer was touched. **Three views the milestone's original scope named were not in the authorized checkpoints** — `src/views/Messages.tsx` (`messageTemplates`), `src/views/Library.tsx` (`libraryShelves`) and `src/views/Settings.tsx` (`settingsSections`) still import fixture *content*, and the product-wide boundary test the final-phase DoD asks for does not exist yet (**M10**); the same is true of the dashboard insight panels (`src/components/panels/`), which are **M9/H4**. **The command palette's substring matching is untouched** (**L1**): M7 removed the false *numbers* from the hints, not the loose matching behind them. **No acceptance audit ran** for M7, so it carries no audit findings and no **B**-numbered coverage items — the reversion and mutation checks in §4 are the implementer's own measurement. And **browser QA has never run** (§5): the three rewired surfaces and the badge are jsdom-verified only, and no test unmounts and remounts a surface, so "survives a reload" rests on the demo store's single-persistence-authority code path exactly as M3, M5 and M6 recorded for theirs.
18. **A second environmental failure appeared during M7, and it is date-dependent — recorded, reproduced, and neither M7's nor the product's.** `src/views/__tests__/schedulingWrites.test.tsx` → *"a real reschedule resolving a real conflict"* asserts that, after the move, the class that owned the contested slot holds **exactly one** scheduled session on `TODAY`, where `TODAY = isoOf(academyNow())` follows the **real calendar date** (the demo clock freezes only the time of day, 10:47 — `src/domains/shared/clock.ts`). The demo seed is anchored to the **fixed** `SEED_DATE = 2026-09-01` window (`src/domains/demo/schedulingSeed.ts`), and the fixture gives `cl2` `days: [3]` — **Tuesday**. On 2026-09-15 the sandbox clock reached that weekday for the first time in this milestone's runs, so `cl2`'s *seeded* 14:00 session fell inside the same-day filter alongside the test's own replacement row: `expected [ 'ses_m_…' ] to deeply equal [ 'ses_m_…', 'ses_cl2_20260915_1400' ]`. **It is not a regression and not caused by M7:** the case fails identically on the **pre-CP4 tree** (measured by restoring the pre-CP4 files, sha256-verified, and re-running), and no M7 commit touches `schedulingWrites.test.tsx`, the scheduling domain, the seed, the store or the clock. It did not appear at M6's measurement because that run happened on **Monday 2026-09-14**. The test is **not** modified, skipped, re-timed or weakened to hide it — recorded here and as [OPEN_ITEMS.md](OPEN_ITEMS.md) **I19**, in the protected scheduling area, which M7 was not authorized to change.

19. **The compensation workstream's own limitations, none of them closed by shipping the domain or the
    surface.** **There is still no `apiRepository`** — the read layer and the three write verbs now have
    a shipped caller (`src/views/Compensation.tsx`) while the domain's other verbs do not, and api mode
    still silently serves the demo implementation for an eleventh domain (**D8**; catalogued as
    **I20**). **The surface is jsdom-verified only** (§5), and the demo still seeds **no compensable
    case**. **The surface is not named by the per-surface gates** — `relationsNoFixtures`' `SURFACES`,
    `emptyEnvironment`'s view lists and `writeFeedbackHonesty`'s `GRADUATED_VIEWS` do not include it, so
    the rules those lists enforce per surface hold by convention rather than by gate (**I21** — **closed 2026-09-16** by the surface's own dedicated boundary gate, `bf8bd91150d6fca3392115c7eccd6c738e9091ee`; the three fixed lists still do not enumerate it and six gate-architecture findings stay deferred). **Nothing notifies anyone** —
    no SMS, no message row, no provider (**D1**, **I7**). **Group and class-wide compensation are
    refused by design:** eligibility is `AcademyClass.kind === "private"`, never roster size, so the
    broader requirement recorded in **I18** is only **partly landed** and I18 stays OPEN. The demo
    dataset ships **no compensable case** (`sessionCompensations: []` — its only cancelled session
    belongs to a group class), so nothing can be exercised by hand; `needsAttention` has no consumer,
    job or badge behind it; there is **no free-slot search** and **no Settings compensation-limit
    rule**; and the same-day/one-hour default is a **prefill** of the original's own date and room
    rather than an automatic booking. **No independent acceptance audit has run** for this workstream,
    so its record carries no audit findings and no **B**-numbered coverage items: the review that
    produced the surface's hardening list was the implementer's own read-only audit, and the reversion
    and mutation checks recorded in the packages' own change reports are the implementer's own
    measurement, not an independent one. **Automatic completion of elapsed sessions is a separate workstream: not
    implemented, not authorized and deliberately kept out of P1** — the obligation's `completed` is a
    recorded decision on the obligation, and neither `Session` nor `SessionStatus` was touched.
    **Browser QA has never run** (§5), where the surface's own checklist item is now recorded: the
    surface is jsdom-verified only, and no browser pass discharges it.

*Two limitations that were listed here were fixed by M2.1 and removed rather than left as stale
entries: the edit dialogs that opened with an empty draft (**H6**) and the three Settings panels that
called a real write demo data (**H7**). Both are recorded as landed in
[OPEN_ITEMS.md](OPEN_ITEMS.md) and ledgered in [PHASES.md](PHASES.md).*

## 8. Deferred work

Everything not finished is catalogued, categorised and evidenced in
**[OPEN_ITEMS.md](OPEN_ITEMS.md)**. Nothing there has been silently converted into completed
work, and no item may be removed from that file without either landing it or recording why it
was dropped.

## 9. Immediate next action

**D2 is ✅ RECORDED (2026-09-16) — the decision M8 was gated on — and it authorizes nothing.** The owner
fixed the shipped default name at «آموزشگاه موسیقی پارسیان», the value
`DEFAULT_BRANDING.academyName` already carries in `src/domains/branding/types.ts`; the fixture's
«آکادمی موسیقی آوا» stays demo seed material, never the product's name. The entry, its row and the
register's counts are in [DECISIONS.md](DECISIONS.md) **§19**, and the recorded status is echoed where
M8 is planned ([PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) §4, §5's M8 block and
§7's summary table, and [PHASES.md](PHASES.md)'s milestone table). **M8 itself remains ❌ NOT STARTED
and not authorized:** the dependency is discharged, the work order is not, and the milestone order
(M8 → M9 → M10 → M11) is unchanged.

**The current state in one line, updated: the Class Compensation workstream is ✅ SHIPPED — the domain at
`a21311d7e32c82e3a46b1581c94f6b3478bf646c` and its secretary surface at `fc83d6d`, hardened by `79fd44e`
and `79ec13d`** — a **non-milestone workstream** on base `e7a6d72` (P1's effective safe rollback
boundary) and `f0bdecd` (the surface's). It ships the make-up obligation domain, its registry seam, its
dataset collection and **69 tests in five new files**, and then the surface with its focused suite and
route cases — and **still no `apiRepository`, no server and no seeded compensable case**: the demo
implementation is the only thing answering for the contract, and a hand-run still needs a cancelled
private session created first. The
phase-checkpoint row does **not** move (`33b1031`, Phase 2), the M0–M11 sequence is unchanged, **M7
remains ✅ COMPLETE**, and **M8 (branding application & visual identity, D2) is ❌ NOT STARTED and not
authorized — D2, the decision that gated it, is ✅ recorded (2026-09-16), so the authorization is what
remains.**

**P1 is complete *with limitations*, and they are not closed by declaring it shipped.** Preserve them in
any future report, in full, from §7 item 19: no server and no `apiRepository` — the surface and the read
layer have a shipped caller now, and api mode would still silently serve Demo (**D8**; catalogued as
**I20**) — plus a surface whose per-surface gate coverage was deliberately left open (**I21**) until the
surface's own dedicated boundary gate delivered it (`bf8bd91150d6fca3392115c7eccd6c738e9091ee`, with six
gate-architecture findings still deferred); no
notification of any kind (**D1**, **I7**); group/class-wide compensation is refused by design
(`kind === "private"` is the authority), so **I18 stays OPEN and is only PARTLY LANDED**; the
same-day/one-hour default is a prefill of the original's own date and room, never an automatic booking
and never a free-slot search; the demo seeds no compensable case; `needsAttention` has no consumer; **no
mutation and no reversion checks** exist for this workstream, unlike M7's; **automatic completion of
elapsed sessions is a separate workstream — not implemented, not authorized and deliberately kept out
of P1**; and **browser QA has never run** (§5), on this or any other surface.

**This pass is documents-only, and the next work is not authorized.** It changes **`docs/engineering/`
only — no product source, no test, no dependency, no fixture, no config and no gate** — and it re-runs
the documentation gate (**51 passed / 1 environmental failure**, the recorded branch-name case) and the
workstream's own suites against the files it edits. Before **M8** begins, the recorded checkpoints must
be confirmed against Git (§2 and the recovery contract at the end of this file), a green baseline
re-established (`npm ci` if `node_modules` is absent, then `npm run typecheck`, `npm test`,
`git diff --check`, `npm run build`), and **D2 recorded** (✅ 2026-09-16 — see
[DECISIONS.md](DECISIONS.md) §19 → **D2**). Of the two things P1 left undone, the
**UI** has since been authorized and built (`fc83d6d`/`79fd44e`/`79ec13d`); a **REST implementation**
(`apiRepository`), **group/class-wide compensation**, **any coordination flow**, **notifications**,
**server-side enforcement** remain unauthorized
until the owner says otherwise — the **per-surface gate coverage recorded as I21** is no longer among
them: it was delivered at `bf8bd91150d6fca3392115c7eccd6c738e9091ee`, with six gate-architecture
findings deferred.

**The state at M7's closure, kept for audit: M7 (relation de-fixturing + sidebar badges, I1) is ✅ COMPLETE and
pushed, implemented across CP1 `0d9fc01`, CP2 `5726435`, CP3 `ede3ad6` and CP4 `f1ec0dd` on top of
M6's coverage-matrix commit `8131c5c`, with its documentation pass (`e7a6d72`) reconciling the record;
**M8 (branding application & visual identity, D2) is ❌ NOT STARTED and not authorized.** The M6, M5,
M4 and M3 records that follow are kept for audit, each with its own §4 validation block.

**M7 is complete *with limitations*, and they are not closed by declaring it complete.** Preserve them in any future report, in full, from §7 item 17: the fixtures themselves survive (**M10/D5**) — M7 removed readers, not data; `useStudentList` is still un-keyed (**I13**) and M7 reached it from three surfaces with the consumer-side key guard the gate requires, recorded as a mitigation rather than a closure; the `per_page: 200` ceilings stay (**I16**); `src/views/Messages.tsx`, `src/views/Library.tsx`, `src/views/Settings.tsx` and the dashboard panels still read fixture content (**M9**, **M10**), which the milestone's original scope named but the authorized checkpoints did not include; the palette's substring matching is untouched (**L1**); no acceptance audit ran, so there are no audit findings and no **B**-numbered items; and **browser QA has never run and is NOT VERIFIED** (§5). Completion says the three profile surfaces now read their relations from their own domains and the chrome shows a number only where a repository answered one — not that a human has used either in a browser.

**M7's reconciliation is documents-only, and the next work is not authorized.** This pass changed **`docs/engineering/` only: no product source, no test, no dependency**, and it re-ran the M7 suites (**67/67**) and the documentation gate (**51 passed / 1 environmental failure**) against the files it edits. Before **M8** — branding application and visual identity — begins, the recorded checkpoints must be confirmed against Git (§2, and the recovery contract at the end of this file), a green baseline re-established (`npm ci` if `node_modules` is absent, then `npm run typecheck`, `npm test`, `git diff --check`, `npm run build`), **D2 recorded first** (✅ recorded 2026-09-16) because `DEFAULT_BRANDING.academyName` («آموزشگاه موسیقی پارسیان») contradicts the fixture name on screen, and only then the [PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M8 scope started — with Groups A and D frozen exactly as §6 records, together with the 9-case `src/domains/scheduling/__tests__/useDerivedRead.test.tsx` suite, the M7 gate and its five per-surface suites, and the M5/M6 suites that pin the attendance and chat surfaces. **M7 handed M8 one thing it did not consume:** the relation plumbing (`src/views/relations/academyDay.ts`, `indexById.ts`) is generic and available, but the branding work needs none of it.

**M3 (learning-content assignment UI, I3 — UI only) is ✅ COMPLETE, and I3 with it.** Implemented at
`e5b0a57d8f33dc04838670a2cd4158a88dd34022` on top of I13 Checkpoint 3A
(`57c1dfb8967a60990021ac9fe59c6ab80045fca3`), documented at `df3db2f` and `db5ec24`, accepted through
a formal audit, and **completed at `3bec8811adaa65dd3c1b50c1125cc8c24dd9adad`** — the audit's one
product finding (F1), fixed with a regression case and a reversion check. The authoritative evidence
is §4 → "M3 completion validation": **6 consecutive full-suite runs at 104 files / 1424 tests / 0
failed / 0 skipped**, `LearningPanel.test.tsx` 11/11 every run, typecheck and build clean, 52
documentation gates green (§3 → "Last completed work (M3…)").

**M3 is complete *with limitations*, and they are not closed by declaring it complete.** Preserve
them in any future report: the surface's **detach** has no stale-context guard (**I13**, still open —
attach is guarded and pinned, detach is a single-id write and cannot be); both of its reads mean
"everything" and stop at `per_page: 200`, with its heading counting `items.length` instead of `total`
(**I16**); **fourteen other consumers discard a read's `error`** and can render a failed read as an
empty one (**I15** — M3 fixed only its own instance, deliberately); link `sortOrder` is written and
honoured student-side but invisible and unmanageable in the assignment surface (**I17**); no test
performs a storage round-trip, so "persists across a reload" rests on a remount case plus the store's
single-persistence-authority code path; **D8's api-mode indicator does not exist until M11**; and
**browser QA has never run and is NOT VERIFIED** (§5). Completion says the contract now has a tested,
honest UI — not that a human has used it in a browser.

**M4 (scheduling *view* wiring, H1a — domain frozen) is ✅ COMPLETE, and H1a with it.** **CP0**
documented the milestone at `84fb7cb4a4a703d52de78cd701ed21d4d242d7c5` — the five `docs/engineering/`
documents and `src/domains/scheduling/README.md` reconciled with the tree at
`7e72887761f07f48e115160611a9785bfaae9060` before any product source moved. **CP1**
`0f875a78c99077e25b67b9cc9cffe34c823ee511` replaced the fixture week with reads through `useSessions`
over a bounded `from`/`to` window, labelled from the classes, rooms and teachers domains. **CP2**
`f8c3472895978054c8dc81574bb8a945ef3c326d` added the first two real writes — `rescheduleSession`
guarded by `checkConflicts`, and `cancelSession` with its required reason. **CP3**
`6f54caf46dc13baca78e376c606a4aa9667cdb48` added the third: generation, with `previewGeneration`
before `generateSessions`. **B1+B2** `df701488362cb90cf32ccefad277879477571cf7` closed the
acceptance audit's two non-blocking coverage findings, **test files only**. The authoritative evidence
is §4 → "M4 validation": **110 files / 1502 tests / 0 failed / 0 skipped**, typecheck and build clean,
`git diff --check` clean, **Group A 211** and **Group D 79** untouched and green, **no product change
anywhere under `src/domains/`**, and **52** documentation gates green.

**M4 is complete *with limitations*, and they are not closed by declaring it complete.** Preserve them
in any future report — with two of them now superseded by M5, annotated rather than silently edited:
**H1 stays OPEN** — H1a is closed, H1b (attendance) is M5's, and the umbrella item closes only when
both views are wired *(superseded: M5 landed at `9505ade`, H1b is closed, so **H1 is closed**; its
original definition was satisfied rather than redefined)*; **the roster a session really has is still
not rendered** (`useSessionRoster` unconsumed, M5's) *(superseded in an unexpected way: M5 renders the
roster a session really has, but through the **attendance** domain's own derived register —
`useSessionAttendance` — and not through scheduling's `useSessionRoster`, which remains unconsumed and
now belongs to no milestone)*; **five repository verbs have no shipped caller** — `get`,
`create`, `update`, `delete` and `sessionRoster`, each with its reason in
`src/domains/scheduling/README.md` §3 — and in particular there is **no delete surface**, because
cancellation is this domain's destructive operation and a hard delete stays out of the UI; **I16 stays
OPEN** globally, with the calendar's own mitigation (bounded window, explicit ceilings, counts from
`total`, an honest truncation notice, per-day counts withheld while it stands) implemented and
recorded rather than claimed as a closure; **I13 stays OPEN**; the fixture view's recurrence-scoped
controls («فقط این جلسه» / «این و جلسات بعدی») were **not** reimplemented, because no domain contract
exists for a recurrence write; notifications to a teacher or a guardian stay deferred; **no mutation
or reversion check was recorded for CP1–CP3**, and §4 states that absence instead of implying
evidence; and **browser QA has never run and is NOT VERIFIED** (§5). Completion says the calendar now
reads and writes the real domain under jsdom — not that a human has used it in a browser.

**M6 (contracts without UI — chat management, attachments, export coverage) is ✅ COMPLETE.** Four
implementation checkpoints on top of M5's documentation reconciliation
(`9190da02a8ddcc49f7fe1ae010e5a3a9b79c48b9`, M6's effective safe rollback boundary): **CP1**
`43e7882f051b46abfa9f0530137cedfb3a541ce0` — the chat contract (`SendMessageInput.mediaId`, the
reversible `archived` patch, resolution of a `mediaId` before delivery and before any write);
**CP2** `42c54f41ed3099cf65ac4ca035146958a1a51f76` — conversation management for three verbs with zero
callers, the conversation-keyed composer, and a failed message read that is no longer rendered as an
empty thread; **CP3** `563b8d85ee48614963cb3c182ac9b84239645c3d` — real attachments through the media
seam, with the limits derived from the media contract, two awaited writes before any success claim,
duplicate-submit protection, asset release on a failed message write, and honest missing-bytes
rendering; **CP4** `4e03b8762bebcb87e46cf7044af5da99d709b4d2` — a single-conversation plain-text
export read through the existing reads, downloaded only after the read resolved, with attachment
metadata but no bytes and a disclosed ceiling. **17 files, 4 321 insertions / 61 deletions, 106 new
tests (+106 on the suite), 14 mutation checks reverted byte-identically.** The authoritative evidence
is §4 → "M6 validation".

**M6 is complete *with limitations*, and they are not closed by declaring it complete.** Preserve them
in any future report, in full, from §7 item 15: attachment ownership and authorization stay
backend-required; attachment bytes stay browser-local and out of every export; there is no server
persistence, no signed URL, no scanning and no delivery beyond `in_app` (**D1**, **I7**); the export
is single-conversation with a disclosed 1 000-message ceiling; `archiveConversation` remains
deliberately unconsumed (**D14**) and the export deliberately has no verb of its own; **I15 stays
OPEN** with its `Messages.tsx` site fixed and the rest of its register untouched (and now stale on
that one line, recorded as such); **I13 stays OPEN**, inherited by the attachment card's use of
`useMediaObjectUrl` without being reachable there; no storage round-trip is tested; and **browser QA
has never run and is NOT VERIFIED** (§5), with the file picker and the download path named as the
things jsdom cannot reach. Completion says the chat contract now has a tested, honest surface —
management, attachments and an export that reads what is really stored — not that a human has used it
in a browser.

**M5 (attendance *view* wiring, H1b — domain frozen) is ✅ COMPLETE, and H1 and I12 with it.** One
implementation checkpoint, `9505ade4011b37a34e3488fd51206512829205ec` · *feat(m5): wire attendance
view*, built directly on M4's final documentation reconciliation
(`24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b`): the fixture register left `src/views/Attendance.tsx`,
replaced by reads through `useSessions`, `useSessionAttendance`, two `useAttendanceRecords` queries
and `useAttendanceCorrections`, and by three awaited writes — `record`, `bulkRecord`, `correct` — with
provenance from the authenticated principal and the write controls gated on `attendance.write`.
**8 files, 3093 insertions / 324 deletions**, two new view suites (53 cases), three gate tests
re-driven without weakening, and **nothing under `src/domains/`**. The authoritative evidence is
§4 → "M5 validation": **112 files / 1558 tests / 0 failed / 0 skipped**, typecheck and build clean,
`git diff --check` clean, **Group A 211** and **Group D 79** untouched and green, **52** documentation
gates green, and **three mutation checks** measured in a throwaway worktree.

**M5 is complete *with limitations*, and they are not closed by declaring it complete.** Preserve them
in any future report, in full, from §7 item 13: no un-record, no edit and no delete of a mark or of a
correction, because the model is append-only; no notification to a teacher, a student or a guardian
(**D1**, **I7**), stated out loud in the UI rather than implied; the academy-wide rate, trend and
per-day analysis the fixture view faked was **removed, not rebuilt**, and no per-student longitudinal
history or «آخرین حضور» projection exists (**H5**); no storage round-trip is tested, so "survives a
reload" rests on the store's single-persistence-authority code path; `apiRepository.ts` stays
deliberately unregistered, so backend aggregation does not exist; two of the eight verbs (`get`,
`sessionIdsWithAttendance`) have no shipped UI caller; **I16 stays OPEN** with this view's ceilings
stated rather than removed; **I13 stays OPEN** with a view-boundary mitigation only, because
`useSessionAttendance` was frozen and still carries no query key; the legacy `attendance` seed
collection survives with no reader in the view that owns it (**D5**, **M10**), and its
`emptyEnvironment` membership was deliberately not moved; no **acceptance audit** of this milestone
ever ran, so no audit findings and no **B**-numbered coverage items exist for it; **D8**'s api-mode
indicator does not exist until **M11**; and **browser QA has never run and is NOT VERIFIED** (§5).
Completion says the register now reads and writes the real domain under jsdom — not that a human has
used it in a browser.

**What M5's reconciliation said about M6, kept as the state it left, followed by what actually
happened — the correction M6's own landing requires.** *(As written at M5's reconciliation, 2026-09-14:
"**M6 is NOT STARTED, and this pass did not start it.** The next milestone — **M6, contracts without
UI** — is not authorized beyond the documentation reconciliation recorded here. This pass changed
**documents only: no product source, no test, no dependency, no build behaviour**, and no claim in
these files upgraded past its evidence.")* That paragraph is preserved rather than rewritten, because
it is the honest record of what the M5 pass did. **Correction (2026-09-14, M6's reconciliation): M6 was
authorized afterwards and has since landed** — four implementation checkpoints, CP1 `43e7882`, CP2
`42c54f4`, CP3 `563b8d8` and CP4 `4e03b87`, on top of M5's reconciliation, and it is ✅ **COMPLETE**
(§3 carries the current phase; §4 → "M6 validation" carries the measured evidence). **The rule that
paragraph stated — that the first step is not implementation — was followed, not skipped:** the
recorded checkpoints were confirmed against Git and the baseline re-established before CP1, and
**Groups A and D stayed frozen exactly as §6 records** — no checkpoint changed any file under
`src/domains/` outside the chat domain. **Correction (2026-09-15, M7's reconciliation): M7 was authorized afterwards and has since landed** — four implementation checkpoints, CP1 `0d9fc01`, CP2 `5726435`, CP3 `ede3ad6` and CP4 `f1ec0dd`, built on M6's coverage-matrix commit `8131c5c` — and it is ✅ **COMPLETE** (§3 carries the current phase; §4 → "M7 validation" carries the measured evidence). The same rule was followed again: the recorded checkpoints were confirmed against Git and the baseline re-established before CP1, and **Groups A and D stayed frozen** — `git diff --name-only 8131c5c..f1ec0dd -- src/domains/` prints nothing. The recovery contract it names is unchanged and now applies to
**M8, which is not authorized**: re-read [OPEN_ITEMS.md](OPEN_ITEMS.md), confirm the recorded
checkpoints against Git (§2, and the recovery contract at the end of this file), re-establish a green
baseline (`npm ci` if `node_modules` is absent, then `npm run typecheck`, `npm test`,
`git diff --check`, `npm run build`), and only then start from the
[PRODUCT_PHASE_SPECIFICATION.md](PRODUCT_PHASE_SPECIFICATION.md) → M7 scope, with Groups A and D frozen
exactly as §6 records — together with the 9-case
`src/domains/scheduling/__tests__/useDerivedRead.test.tsx` suite, which is *not* Group A and is no less
off-limits, the two view suites M5 added, which pin the attendance surface, and the seven M6 suites,
which pin the chat surface. **M6 consumed neither of the two things M4 and M5 handed over:** it is not
student-scoped, so `useDerived`'s landed shape is *still* unused and still waits for the consumers M7
is, and real session ids were not what its surface needed. **M5's rollback boundary
is two numbers, not one**, exactly as M4's and M3's were: the spec's convention names
`24caf3a00e4bb0f936cffa790cc3bc81ee9a7c5b` (M4's final reconciliation), and the **effective safe**
boundary is the same commit, because rolling back past it would destroy M4's acceptance coverage
(`df701488362cb90cf32ccefad277879477571cf7`) as well — see [PHASES.md](PHASES.md) → "Product phase —
M5".

**M3's own spec named one precondition, and it is now discharged:** the **I11** `LearningPanel`
flake has been reproduced, root-caused and fixed in the test harness, so the suites M3 touches are
trustworthy again — and the triage answered the spec's question honestly: it was *not* an artefact of
running two suites on one machine. What I11's triage found underneath has now been **decided**:
**I13** (a list hook published the previous query's rows with no loading marker when its params
change — every list in the product) was authorized as **Checkpoint 1 (A′)** on 2026-09-13, implemented and
**validated at `289e080`**: the shared hook derives what it exposes from the query identity its state
answers, and the six dynamic-params consumers that ignored `loading` now show an in-flight state
instead of a false empty. The evidence is the full set §10.1 requires — 6 consecutive full-suite runs
(100 files / 1384 passed / 0 failed / 0 skipped each, `dist/` built so nothing skipped), 4 samples as
two concurrent full suites, build, typecheck and 68 documentation gates — plus a reversion check on
each half, so neither the hook fix nor the consumer gates are pinned by a test that would pass
without them. **That gate is discharged; M3 is no longer held by I13 Checkpoint 1.** Two parts of I13
were **deliberately left out** of that authorization. The first, **Checkpoint 2** — the
`attachContent` intent guard, needed because `attachContent` took only `(levelId, contentId)` and so,
unlike `assignPlacement`, had nothing to compare a level against — was **authorized by the owner the
same day as its own pass, recorded as in progress before its code was written (`be75ac6`), and has
now landed and been validated at `bcea26c`**: the call requires an `AttachContentIntent { programId }`
resolved independently of the target level, refuses a mismatch with `LINK_INVALID` and writes nothing,
and leaves `LEVEL_NOT_FOUND`, `CONTENT_NOT_FOUND`, `CONTENT_ALREADY_LINKED` and one content item
serving several programs unchanged. `attachContent` therefore **is** fixed for the risk M3's surface
writes through, with one honest caveat recorded in
[OPEN_ITEMS.md](OPEN_ITEMS.md) I13: no signature can stop a caller passing the target's own
`programId` back as its intent, which makes the comparison a tautology — only review can, and the
test file names that failure mode. **M3 is that review, and it is now pinned by a test rather than
by a sentence:** the surface passes the program the panel selected, and
`src/domains/learning/__tests__/contentAssignmentFlow.test.tsx` reproduces the frame in which a
rendered level row belongs to a different program than the selection, asserts that the repository
was handed the *independent* program and therefore refused the write, and goes red when the wiring
is mutated to `contentLevel.programId`. The caveat stays open — the guard still cannot defend itself
against a future caller — but the first real caller does not defeat it. The second, **Checkpoint 3**, is five hand-rolled readers with the
same shape. Its first slice, **Checkpoint 3A**, was authorized and has **landed and been validated at
`57c1dfb`**: `useDerived`, the boundary behind `useStudentPlacement` and `useEligibleContent`, was
the one with a real consumer, and it was **reproduced deterministically before being fixed** — a
dedicated suite failed 4 of 8 against the unmodified hook, then passed 8 of 8 after it, and restoring
the old hook fails the same 4 and no others. That discharges the condition this section placed on M3:
a student-scoped derived read can now be rendered by M3's surface without exposing one student's
placement or unlocked content under another's name. **M3 chose not to render one** — the spec made
the student-scoped read optional and the slice stayed tight — so `useDerived`'s fix is landed,
validated and *unused by M3*. That is recorded as unused rather than claimed as a dependency
satisfied; M6/M7 are what will consume it. Its second slice, **Checkpoint 3B**, landed after M3 as the
first of the two pre-M4 remediation commits at `fba826f66336d2825eb7b4fbe5c6fe0e2e5b6807`: scheduling's
`useDerivedRead` — the boundary behind `useSessionRoster`, `useGenerationPreview` and
`useConflictCheck` — carries its query key with the same evidence shape (a new 9-case suite that
reproduced the crossed frame before the fix; reverting only the fix fails 4 of the 9 on identity).
It was hardened ahead of M4 rather than inside it because **M4 is what makes those three readers
reachable in shipped UI** — and M4 has since landed, making **two of the three** reachable
(`useConflictCheck` in `src/views/scheduling/SessionWriteDialogs.tsx`, `useGenerationPreview` in
`src/views/scheduling/GenerateSessionsDialog.tsx`) while `useSessionRoster` stays unconsumed — **and
M5 did not consume it either**: the attendance view reads the attendance domain's own derived
register, so that scheduling verb now belongs to no milestone. **M5 made one more of these readers
reachable without fixing it, and that is recorded as a mitigation rather than a closure:**
`useSessionAttendance` is now behind shipped UI in `src/views/Attendance.tsx`, still carries no query
key, and the view guards the exposure instead — comparing `attendance.sessionId === selectedSessionId`
and withholding the register while they disagree (`src/views/Attendance.tsx:250`), with a test case
named for keeping the upstream defect visible rather than claiming a fix. **The remaining two readers
are not authorized and not started** — `useStudentList` and `useStudentProgress`:
`useStudentProgress` was recorded as having no consumer and becoming reachable at **M6/M7** — and **that register line is stale, which this pass records rather than edits**: the hook is consumed inside the progress domain by `src/domains/progress/StudentProgressPanel.tsx:70`, and that panel was already mounted by `src/views/Students.tsx` before M7 began, so its reachability did not change at this milestone; every `useStudentList` call site still passes constant params. **M7 made `useStudentList` structurally reachable in three surfaces without fixing it**: `src/views/Teachers.tsx` and `src/views/Classes.tsx` now read the unscoped student page to resolve a teacher's students and a class roster, so both mount the detail under the row's own identity key (`key={detail.id}`) — the consumer-side guard M5 used for `useSessionAttendance` — and `src/views/__tests__/relationsNoFixtures.test.ts` **requires** that key per guarded surface, with a case ("cannot show the previous class's roster while the switch is in flight") that fails without it. That is a **mitigation, not a closure**: fixing the shared hook is still not authorized (**I13**). **I14** (`paginate` clamps `per_page: 0` to one
row) was assessed for M3 relevance and **deferred**, and M3's landing changes nothing about it: the
assignment surface never reads through a `per_page: 0` query, since that is only the
not-yet-selected branch of three call sites — and M3 added no fourth, because its surface renders
only once a level is selected. The two
findings that M2
recorded and M2.1 fixed (**H6**, **H7**) no longer block anything; what M2.1 leaves behind is the
knowledge that `RepertoirePanel` and `PieceFormDialog` are now safe to build on — a piece's
`programId`, `rangeUnit` and `active` flag survive an edit, which is exactly what M3's assignment
surface reads.

Do **not** reopen M1: `clear()` semantics, the zero-record invariant (§8 / I10) and the api-mode
transparency of the gate are settled and pinned by tests. The M1 evidence lives in
[OPEN_ITEMS.md](OPEN_ITEMS.md) H5 (now landed) and [DECISIONS.md](DECISIONS.md) §8/§18/§19 (D3/D4).
**M3's rollback boundary is two numbers, not one** (§4 → F2 note, and
[PHASES.md](PHASES.md) → "Product phase — M3"): the spec's is `c42f274` (**M2**), the effective safe
one is `85530b4`, because rolling back to M2 would also destroy M2.1 and the three accepted I13
checkpoints `289e080`, `bcea26c` and `57c1dfb`, which must survive any M3 rollback.

Do **not** reopen M2 either: the seven H2 sites and the five H3 sites are settled and pinned by
`src/__tests__/writeFeedbackHonesty.test.ts`, and the shapes chosen there were the owner's explicit
decision (remove a control that has no truthful action; never disable it into a promise). M2.1 is
settled the same way: the draft re-sync belongs to `useEntityForm`, not to six dialogs or seven
mount sites, and `demoStore`'s merge semantics were deliberately **not** hardened to ignore explicit
`undefined` — that would change repository behaviour for every caller and destroy the legitimate
"clear this optional field" intent.

## 10. DO NOT — standing constraints

These come from the product owner and survive every session.

**Git**
- Do **not** re-clone, reset, re-parent, stash, revert or rewrite history.
- Do **not** force-push. Do **not** amend an existing commit.
- Do **not** commit or push without explicit authorization; one logical commit per instruction.
- Do **not** delete or discard uncommitted work. Verify before and after any Git operation.
- Work only on the recorded working branch.

**Engineering**
- Do **not** start a new phase while the current one is unfinished or unreviewed.
- Do **not** weaken a failing assertion to make a suite green; fix the owning boundary.
- Do **not** blanket-patch consumers with `|| []` / `?? []` — fix the contract at its boundary.
- Do **not** branch on `isDemo`/`isDemoEnvironment` inside domain views to decide *what data to
  read or write*; lifecycle lives in one boundary and reaches components only through
  `src/domains/demo/useDataLifecycle.ts`. The one permitted use inside a view is **wording**: where
  a label would otherwise lie about the environment (the Settings data panel, the login credential
  panel), the component takes its text from `useIsDemoEnvironment()` — the same seam — rather than
  re-deriving lifecycle state. Seeding, filtering and hiding capability all stay at the boundary.
- Do **not** let reads mutate state: `snapshot()` must never seed, repair or write.
- Do **not** put demo media or demo records into an EMPTY environment.
- Do **not** build a fake production backend, fake success toast, fake download URL or
  fabricated metric. No error swallowing, no hardcoded fallback data.
- Do **not** regress Phase 1 (library/media/profile/messages) or the protected domains in §6.
- Do **not** add dependencies without authorization.

**Product and safety**
- Persian-first, RTL, accessible, performant. Honour `prefers-reduced-motion`.
- No copyrighted third-party franchise assets (e.g. Harry Potter / Hogwarts material).
- No secrets, credentials, tokens, API keys or personal data in React source, in `VITE_*`
  variables, in `localStorage`, or in these documents. Credentials are a backend concern only.

## 11. Working conventions (the things that bite a new session)

| Convention | Detail |
|---|---|
| Test environment | `vite.config.ts` sets `environment: "node"`, so **every** `.test.tsx` file must begin with `// @vitest-environment jsdom`. Without it the failure is a baffling `document is not defined` |
| Shared lifecycle harness | `src/test/demoEnvironment.ts` exports `resetToDemoEnvironment()`, `resetToEmptyEnvironment()` and `resetToUninitialized()`. `demoStore.reset()` seeds nothing, so every test must say out loud which environment it wants |
| Waiting for a view in tests | Wait for the design system's in-flight marker — `role="status"`, from `BreathingWave` in `src/components/ds/states.tsx` — to disappear, **not** for the view title. The shell renders titles immediately while `useResourceList` may still have a read in flight, which is how I11's race worked. Query by role, never by the Persian label, so a copy change cannot turn the wait into a no-op. **Marker absence was not enough when the query's params could change:** the frame between a params change and the effect that re-set `loading` carried no marker at all, so wait for the data-derived state — the rows on screen are the rows the repository holds for what the screen claims to be showing (**I11**). Since I13's Checkpoint 1 the hook itself upholds that: a page is exposed only for the params it was loaded for, so a params change shows an in-flight state rather than another query's rows. **The data-derived wait stays the rule anyway** — it is what makes a test independent of which half is holding, and the five hand-rolled readers of I13 Checkpoint 3 — of which `useDerived` is fixed as Checkpoint 3A, scheduling's `useDerivedRead` as Checkpoint 3B, and three are not — do not all uphold it yet. And never wait on `loading === false` as the *sole* proof: that is the flag under test, so such a wait can be satisfied by the very frame being asserted against |
| Running a single file | `npx vitest run <path>` — the whole suite takes ~100 s |
| Blob store | `blobStore.put(id, bytes, mimeType)` takes three arguments and an `ArrayBuffer`, **not** a `Blob` |
| Dependencies | `npm ci` only. Never `npm install` — it can rewrite `package-lock.json`, which is an unauthorized dependency change and dirties an otherwise clean tree |
| Typecheck | `npm run typecheck`. Never `npx tsc`, which can fetch an unrelated package named `tsc` |
| Commit trailer | See §2: a non-versioned `.git/hooks/commit-msg` appends `Co-authored-by: arena-agent …`; its absence after a re-clone is cosmetic |
| Opening an overlay in a test | The shell treats **every** `hashchange` as a navigation and closes the palette and the sheet, and assigning `window.location.hash` queues that event *after* the render — so a harness that opens the palette and then asserts against its content can be blanked mid-test. Rewrite the address without dispatching the event (`window.history.replaceState(null, "", "#/")`) and keep the open-stage assertions off hash mutation. Found while writing M7's `navigationCounts` suite |
| A new dataset collection | Three additions are required and the third is a compile error until it is made: the field on `DemoDataset` (`src/domains/demo/types.ts`), the name in `DEMO_COLLECTIONS` (same file), and a label in the settings panel's **total** `COLLECTION_LABELS` record (`src/components/settings/DemoDataPanel.tsx`). An **empty-by-design** collection is declared in the seed suite's own `INTENTIONALLY_EMPTY` set (`src/domains/demo/__tests__/seed.test.ts`), which is also what asserts it stays empty. Found the hard way while landing the `sessionCompensations` collection |
| Repository stubs in view tests | A stub must enforce the constraints the **view doesn't**: `useSessions({ classId, from, to })` scopes by `classId` itself, so a scheduling stub that ignores `from`/`to` will hand the view rows outside the window the view asked for and the assertion fails for the stub's reason, not the view's. Model the repository's filtering, and measure demo data **before** installing a stub |

---

## New Session Recovery

A fresh agent session recovers context in this order. **Do not trust this document blindly —
verify every claim against Git and the test suite.**

1. **Read `docs/engineering/PROJECT_STATE.md`** (this file) — identity, checkpoint, phase,
   validation, constraints.
2. **Read the siblings as needed**: [PHASES.md](PHASES.md) for the ledger,
   [DECISIONS.md](DECISIONS.md) before changing architecture, [OPEN_ITEMS.md](OPEN_ITEMS.md)
   before starting work.
3. **Inspect Git**: `git status -sb`, `git status --porcelain`, `git log --oneline -5`,
   `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`.
4. **Verify HEAD against the recorded checkpoint** in §2 — do not assume it:
   `git rev-parse HEAD` must equal the recorded SHA, or be a descendant of it
   (`git merge-base --is-ancestor <recorded> HEAD`). Verify the remote independently with
   `git ls-remote origin refs/heads/<branch>` (the local remote-tracking ref may not exist —
   see §2). If HEAD and the record disagree, **stop and report the discrepancy**; do not
   "fix" it by resetting. If the recorded SHA is not present locally at all
   (`git cat-file -e <sha>^{commit}` → `fatal: bad object`), the workspace has most likely been
   **re-cloned** (§2): the commit object is gone but the files usually are not — stop, report,
   and recover only with explicit authorization, hashing every changed and untracked file first.
5. **Inspect recent commits**: `git show --stat HEAD` and `git log --stat -3` to see what the
   last phase actually touched. Measure whether the clone is shallow
   (`git rev-parse --is-shallow-repository`) rather than assuming it (§2).
6. **NEVER reset, re-clone, delete, stash or discard uncommitted work** without explicit
   authorization from the product owner. If the tree is dirty, treat it as valuable:
   record `git status --porcelain` and `git diff --stat`, and ask.
7. **Continue only from §9 "Immediate Next Action"** — and only if it is authorized. If §9 says
   NOT STARTED, do not start it; report and wait.
8. **Re-establish a green baseline before changing anything.** If `node_modules` is missing —
   common after a workspace re-clone — run **`npm ci`**, never `npm install`: `npm install` can
   rewrite `package-lock.json`, which is a dependency change nobody authorized and dirties the very
   tree you were told to keep clean. Then `npm run typecheck`, `npm test`, `git diff --check`, and
   `npm run build` if you touched application source (or if `dist/` is missing and you want the 8
   CSP tests to run rather than skip — §4).
9. **Update this file when a durable checkpoint or phase changes** — and update
   [PHASES.md](PHASES.md) / [OPEN_ITEMS.md](OPEN_ITEMS.md) in the same commit, so the ledger
   never contradicts the state. `src/__tests__/projectState.test.ts` fails the suite if the
   recorded checkpoint is not a real reachable commit, if required sections disappear, or if a
   secret is pasted into these documents.
