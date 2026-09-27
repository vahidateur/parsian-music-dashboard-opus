# PR #18 FINAL SESSION HANDOFF — G-7 closed: a real Library → Teacher relationship

> **Read this file first.** It is the durable record of this session. It is written to be
> self-contained: a session arriving after the merge can recover the whole position from this
> document, the Git history, and the test suite, without any conversation memory.
>
> Sibling conservation record: [PR18_PRE_MERGE_CONSERVATION.md](PR18_PRE_MERGE_CONSERVATION.md)
> — the Git-object consequences of the merge and the eventual branch delete.
>
> Durable decision record: [`../engineering/DECISIONS.md`](../engineering/DECISIONS.md) **§24**.
> Durable gap record: [`../engineering/F1_REPORT.md`](../engineering/F1_REPORT.md) §"G-7".

---

## 1. Session State

| Fact | Value |
| --- | --- |
| Canonical branch | `main` |
| `main` at session start (and still, at handoff) | `8e6bce95883f7ef17b69a110c0b309d54e40811d` |
| Working branch | `arena/01a0e006-parsian-music-dashboard-opus` |
| PR | **#18** — https://github.com/vahidateur/parsian-music-dashboard-opus/pull/18 |
| PR base | `main` @ `8e6bce9` |
| G-7 implementation commit | `096723bfc7c917b3e3fee940877a63823b5a8fd4` |
| PR state at handoff | **OPEN — intentionally NOT YET MERGED** |
| G-7 | ✅ **CLOSED** |
| F2 | ❌ **NOT STARTED** |
| Backend / Laravel | **untouched** — no backend file, route, migration or controller changed |
| Browser QA | ❌ **NOT VERIFIED** — no browser session was ever run |

**No merge has happened.** `main` is byte-for-byte what it was when this session began. The branch
also carries one documentation-only commit on top of `096723b` — this handoff and the conservation
record. No product, test, dependency, backend or Git-history change is in it.

---

## 2. What landed in PR #18 — G-7 closed

F1 gap **G-7** was: the Library search box promised «جستجوی عنوان، آهنگساز یا مدرس…» while
`LibraryItem` carried **no teacher at all**, so `composer` was silently standing in for one.

The seed proved this was a **conflation, not a stand-in**: six of twelve rows held a real composer's
name (Chopin, Carcassi, Bach, an orchestra, the academy method book) and six held a *teacher's* name
— each of the six matching its teacher's **own instrument exactly** — with nothing in the data to
tell them apart. A teacher search would have returned every Chopin score on which that name was ever
typed, and a teacher renaming themselves would have silently broken every result.

A canonical `Teacher` identity already existed, and `Student` / `AcademyClass` / `Session` /
`LearningContent` all already carried `teacherId: string`. **What was missing was the relationship,
not a new domain.**

### The approved decision (owner, product/data-model) — DECISIONS.md §24

1. **Cardinality** — `Resource.teacherId?: string`; at most one teacher per item; an absent value
   means *no teacher recorded* — an honest unknown, never an implicit teacher.
2. **Meaning** — the educational teacher/contributor associated with the content: the person who
   prepared or contributed it.
3. **Meaning (negative)** — **not** an assignment relation and **not** an authorization relation.
4. **Authorization** — provenance/attribution only. It must never become an ACL, scope, permission
   or access-control primitive. `visibility` and `restrictedToStudentIds` remain the only access
   rule, and `studentCanAccess` remains the single sentence that evaluates them.
5. **Coexistence** — `composer` stays an **independent** creator-attribution field. A genuine
   composer (Chopin, Bach, an orchestra) remains in `composer`. `composer` must **never** be used
   as a Teacher proxy.
6. **Data integrity** — `teacherId` resolves against the canonical `Teacher`; unknown IDs are
   rejected; an `inactive` teacher stays valid, because attribution is not active assignment.

Clause 4 sits inside the existing **O-08** line that `created_by` / `uploaded_by` /
`recordedByUserId` are provenance, not ACL. It is deliberately **not** an O-02 instance: O-02
concerns `library_items.level` and `learning_levels` specifically and forbids no reference in the
domain.

### The 11 files, and why each is in scope

| File | What it does |
| --- | --- |
| `src/domains/library/types.ts` | `Resource.teacherId?` on the persisted entity + create/update input, with the provenance-not-ACL rule stated on the field itself |
| `src/domains/library/demoRepository.ts` | search resolves `teacherId → Teacher.name`; create/update persist it; unknown teacher rejected; `inactive` accepted |
| `src/domains/library/apiRepository.ts` | **comment only** — records the server-side contract obligation. No backend ships |
| `src/views/Library.tsx` | teacher picker, persistence, teacher name in search, byline + metadata display |
| `src/domains/demo/academySeed.ts` | the six rows migrated out of `composer` into `teacherId` |
| `src/domains/demo/seed.ts` | `SEED_VERSION` `2026.09.1` → `2026.09.2` |
| `src/domains/demo/learningSeed.ts` | propagates `teacherId` into derived `LearningContent` and its description |
| `src/domains/library/__tests__/teacherAttribution.test.ts` | **new** — 11 repository cases |
| `src/views/__tests__/Library.test.tsx` | +4 end-to-end cases through the real view |
| `docs/engineering/DECISIONS.md` | **§24** — the decision |
| `docs/engineering/F1_REPORT.md` | G-7 marked **CLOSED** |

**Size:** 11 files, `+642 / −39`.

### The six migrated rows

| id | was in `composer` | teacher | instrument (why it is an attribution) |
| --- | --- | --- | --- |
| `res4` | کاوه کاظمی | `t6` | drums — matches teacher t6's instrument |
| `res5` | نرگس حسینی | `t4` | voice |
| `res6` | مینا فرهادی | `t8` | violin |
| `res8` | بهرام نیک‌نژاد | `t5` | theory |
| `res9` | بهرام نیک‌نژاد | `t5` | theory |
| `res11` | محمد رضایی | `t2` | guitar |

Their `composer` is now **empty**, on purpose: all six are the academy's own teaching material, so
"no composer of the work" is the truthful reading, and re-filling it (with the academy, or with the
teacher's name again) would recreate the very conflation this moved out. The **other six are
untouched** and gain no teacher, because no teacher was ever recorded for them and inventing one
would be fabricated history.

### LearningContent — the silent-degradation fix

`LearningContent.teacherId` was **declared but never populated**. The derived learning catalogue
built its description from `resource.composer`, so migrating the six rows to `teacherId` would have
made the teacher's name vanish from learning content entirely. `learningSeed.ts` now carries
`teacherId` through and falls back to the teacher name. **This is a direct consequence of the seed
migration, not a separate feature.**

---

## 3. Verification record — what was actually run, and where

All of the following was run in a **complete (non-shallow) clone** with all 6 tags present.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | ✅ **PASS** — 0 errors |
| Build | `npm run build` | ✅ **PASS** — built in ~4.5s |
| **Full suite** | `npm run test` | ✅ **PASS — 191 test files, 2533 tests, 0 failed** |
| Governance | `npx vitest run src/__tests__/projectState.test.ts` | ✅ **52/52 PASS** |
| G-7 repository | `src/domains/library/__tests__/teacherAttribution.test.ts` | ✅ **11/11 PASS** |
| G-7 view E2E | `src/views/__tests__/Library.test.tsx` | ✅ 25/25 PASS (4 of them are G-7) |

`projectState.test.ts` is `52/52` **identically with and without** the G-7 change.

### ⚠️ The baseline correction — do not reintroduce the old claim

An earlier working state of this session reported **"2530 passed / 3 pre-existing failures"** in
`projectState.test.ts`. **That was false, and it was an environment artifact, not repository state.**

`projectState.test.ts` verifies that every SHA quoted in the state documents is *reachable and
present*. The sandbox had been re-cloned **shallow and tag-less**, so the older SHAs could not be
resolved and the test reported failures **against commits it could not see**. Re-running the same
test in a **complete** clone gives `52/52`, with and without G-7.

Verified directly: `33b10311…` and `a3867a60…` **are** ancestors of `main`, and the two unmerged
preserved tips are carried by the **§21** exemption. **The governance gate is genuinely satisfied,
not merely tolerated — and nothing here should ever be "fixed" by weakening that test.**

**If you clone shallow, `projectState` will fail. Repair the clone, not the test:**
`git fetch --unshallow --tags --all`.

### Mutation / load-bearing evidence — the tests were proven to bite

Every negative was reintroduced, the suite was run, and the mutation was reverted:

| Mutation | Failures |
| --- | --- |
| Restore the `composer` proxy in search (teacher term ← `row.composer`) | **5** |
| Drop the `teacherId` validation | **1** |
| Revert the seed migration — one row | **2** |
| Revert the seed migration — all six rows | **6** |
| Remove the teacher from the view's search | **2** |

A back-up round trip is proven, including a **pre-field** back-up that still loads.

> Note for a future reader: adding `row.composer` a *second* time to the search array is a
> **no-op** mutation — the field is already in the array — and the suite stays green. The mutation
> that bites is *resolving the teacher term through* `composer`. Do not be fooled by the first one.

---

## 4. Ref integrity

Everything below was measured through `gh api` (authoritative), not against the sandbox `.git`.

**`main` is unchanged** at `8e6bce9`. Preserved branch tips, all unchanged:

| Branch | Tip |
| --- | --- |
| `arena/01a0b059-parsian-music-dashboard-opus` | `251af96` |
| `handoff/arena-frontend-pre-backend` | `94d32de` |
| `arena/01a0cefa-parsian-music-dashboard-opus` | `eb973eb` |
| `arena/01a0c8b5-parsian-music-dashboard-opus` | `bb275d6` |
| `arena/01a0c8a7-parsian-music-dashboard-opus` | `7180082` |
| `arena/01a0c480-parsian-music-dashboard-opus` | `afe6b02` |

All 6 archive tags intact at their exact targets:
`archive/frontend-session-handoff-94d32de`, `archive/gallery-library-storage-eb973eb`,
`archive/mountain-sanctuary-bb275d6`, `archive/palette-focus-251af96`,
`archive/premium-academy-login-afe6b02`, `archive/project-state-gate-7180082`.

**§21 is intact.** No branch was deleted, no tag moved, no history rewritten, no force-push.
The branch count went 7 → 8 — that is this session's branch, nothing else.

---

## 5. Scope — what is deliberately NOT in PR #18

Untouched, and not to be "tidied" by a later session without a new decision:

- `PROJECT_STATE.md`, `PHASES.md`, `OPEN_ITEMS.md`, `GOVERNANCE_CHECKPOINT.md` — excluded by the owner.
  (The **only** exception is the `SESSION_HANDOFF.md` live pointer, which is the repository's
  established handoff mechanism — see the precedent at the top of that file.)
- `docs/frontend-completion/06-library-gallery-spec.md` and `src/domains/library/README.md` —
  excluded by the owner. **See the known discrepancy in §7.**
- O-01, O-02, O-08, T-02, the §21 preservation gate, every preserved ref and tag.
- Any backend / Laravel implementation.
- **F2 — not started. No planning, no scaffolding, no file.**

---

## 6. Browser QA — **NOT VERIFIED**

No browser session was run at any point in this session. No browser automation was available.
Closing G-7 is **not** a browser claim: the teacher picker, the search, the byline and the metadata
row are jsdom-verified only. Do not report G-7 as browser-verified.

---

## 7. Known documentation discrepancy — reported, deliberately NOT fixed

`docs/frontend-completion/06-library-gallery-spec.md` line 14 states, as a **VERIFIED** fact:

> **Search:** title, composer, teacher — VERIFIED SearchInput placeholder «جستجوی عنوان، آهنگساز یا مدرس…»

G-7 changed that placeholder to **«جستجوی عنوان، آهنگساز، مدرس یا ساز…»** (instrument is searched
too, and that was already true). **The spec's quoted string is therefore stale.**

The owner explicitly excluded that file from this change, so it was **left alone and reported
rather than fixed**. A future session may correct it with an explicit decision. Nothing in the code
depends on the spec's wording; the test suite is unaffected.

### Non-blocking observations, also deliberately not fixed

1. **Clearing a teacher stores `""`, not an absent value.** Behaviour is identical everywhere
   (a row cleared to `""` is not findable by that teacher's name); it is a data-hygiene nit, not a
   defect. **Pre-existing shape, not a G-7 regression.**
2. **The "add" button is not gated by `library.write`** (only the *edit* button is). Confirmed
   **identical on `main` before this change** — the new teacher picker inherits the form's existing
   gating and introduces no new access-control surface. **Pre-existing; out of scope.**
3. `resourceByline` is exported from `Library.tsx` but used only inside that module. Cosmetic.

---

## 8. Next session start point

**Do not assume F2 is complete, and do not assume this PR was merged.** Check first:

```
gh pr view 18 --json state,mergedAt
git ls-remote origin refs/heads/main
```

The intended sequence is exactly:

1. **Merge PR #18** into `main`, using the repository's established merge policy.
2. **Read-only post-merge integrity audit** — `main` on the expected merge result, PR #18 actually
   merged, G-7 present on `main`, full suite still 2533/2533, typecheck PASS, build PASS,
   preserved branches/tags unchanged, §21 intact, backend untouched, working tree clean.
3. **Establish the merged `main` SHA** and record it.
4. **Only then** begin F2 planning/execution.

**No feature work after the merge.** The post-merge audit is verification only.

### F2 — explicitly NOT STARTED

`docs/engineering/F2_REPORT.md` exists, but it is a **pre-existing** report from the older
`arena/frontend-completion-spec` lineage (it describes slices F2-1..F2-5 on a branch that predates
this one). It is **not** a statement that the current F2 is done, and it was **not** modified.
Treat F2 as not started.

---

## 9. One honest note about a lost commit

The G-7 work was first committed as `7246f76`. The sandbox **re-cloned the repository mid-session**,
and that re-clone replaced `.git`, so `7246f76` is **unrecoverable** — its object is simply gone.
The working tree was unaffected, and the work was recovered with `git reset --mixed origin/main`
(a HEAD/index operation that never touches file contents), after which the recovered diff was verified
**byte-identical** to the original: same 11 files, same per-file counts, `+639 / −39`.

`7246f76` was never pushed and **must not be cited as a pushed or merged SHA**. The only valid
identifiers are `096723b` (G-7 implementation) and the documentation commit stacked on it.
