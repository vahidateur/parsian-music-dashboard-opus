# F1 — Learning + Level Access + Library + Gallery — REPORT

> Baseline audited: `main` at `4edd0bc` (fresh full clone, not shallow). Scope: frontend only.
> No Laravel/backend work. `T-02` and every `O-*` item are untouched and remain OPEN.
> Browser QA: **NOT VERIFIED**. No browser session was run.

## 1. Why this report exists

F2–F10 each have an INVENTORY and a REPORT; F1 had only `F1_INVENTORY.md`. That inventory was
written on the pre-merge branch `arena/frontend-completion-spec` (head `9dcd5bc`), before PRs #14–#16.
Its six implementation slices were then delivered by commit `cbd2a71` (*F1: Learning Level N
eligibility locked honest reason, Library genuine filters upload media seam, Gallery search empty
wording disclosure, Classes deep-link authoritative get(id), media one-frame guard*), which is an
ancestor of `main`. This report records the audit of that landed code and the follow-up work.

## 2. Audit result

| Area | Status | Evidence |
|---|---|---|
| Learning | ✅ implemented | `src/domains/learning/eligibility.ts` owns eligibility (1..N eligible, N+1+ locked with reason «در سطح X باز می‌شود», shared content emitted once at the lowest level, levelOrder/sortOrder/title-fa ordering); locked items render with a lock icon and no preview in `src/domains/learning/StudentLearningPanel.tsx` |
| Level Access | ✅ implemented | same owner, via `useEligibleContent` and `useLockedContent` in `src/domains/learning/useLearning.ts` |
| Library | ✅ implemented | `src/views/Library.tsx` — search, kind/instrument/level/visibility filters, recent/popular/title sort, media-seam upload with staged-media release on failure, real-bytes preview and download, «N ردیف از M» disclosure, detail drawer on the same surface |
| Gallery | ✅ implemented | `src/domains/gallery/GalleryPanel.tsx` — album search over title and description, sortOrder then createdAt, empty states «تصویری نیست» / «آلبومی وجود ندارد», alt text required, media seam, disclosure |
| Absorbed hardening | ✅ implemented | Classes deep link reads `get(id)` through `useClass`; `src/domains/media/useMedia.ts` has a render-time guard so a URL is only returned for the mediaId it was created for |

Baseline gate at `4edd0bc`: typecheck pass, 187 test files / 2482 passed (13 skipped), build pass.

No feature was missing. The audit found seven gaps (G-1…G-7): four behaviours with no test, and
three differences between the spec and the implementation.

## 3. Test gaps closed (G-1…G-4) — commit `4f0405a`

| Gap | Test file | Cases |
|---|---|---|
| G-1 Library sort (جدیدترین / پراستفاده / عنوان) | `src/views/__tests__/libraryFilterSort.test.tsx` | 6 |
| G-2 Library level filter | same file | 4 |
| G-3 Library visibility filter, including rows stored without a visibility field | same file | 4 |
| G-4 Gallery album search (title and description) | `src/domains/gallery/__tests__/galleryAlbumSearch.test.tsx` | 6 |

These are tests only; no product code changed. **Mutation check:** seven deliberate breakages of the
product code were each caught by at least one new case (recent order, popular order, title order,
level filter removed, visibility fallback flipped, panel search wiring dropped, description match
dropped). The visibility-fallback breakage was missed at first, because `create` always stamps
`visibility: "students"`. The case now stores the row without the field, as seeded rows are
stored, and catches it.

## 4. Spec/implementation differences — owner decisions

### G-5 — `not_applicable` empty-state wording — ALIGNED WITH SPEC

- Spec (`F1_INVENTORY.md`): «هنوز در برنامه‌ای قرار نگرفته».
- Before: «این هنرجو هنوز روی سطحی قرار نگرفته», in `src/domains/learning/StudentLearningPanel.tsx`.
- **Decision (owner): align with the spec.** The empty-state title is now the spec text; the
  description under it is unchanged. The three tests that pinned the old text now pin the new one:
  `src/domains/learning/__tests__/StudentLearningPanel.test.tsx`,
  `src/domains/shared/__tests__/failureDisclosureI15.test.tsx` and
  `src/domains/shared/__tests__/staleQueryGates.test.tsx`.
- Supersedes the "accepted difference" recorded in commit `6e150e1`.

### G-6 — «N ردیف از M» numerals in LearningPanel — FIXED

- `src/domains/learning/LearningPanel.tsx` interpolated raw numbers. Classes, Gallery and Library
  format with `faNum`.
- **Decision (owner): fix.** Both numbers now go through `faNum`; the sentence is unchanged.
  Pinned by `src/domains/learning/__tests__/learningPanelTruncationNote.test.tsx` (programs note,
  levels note, and no note on a complete read).

### G-7 — Library "teacher" search — **CLOSED** (data-model decision, owner)

- Spec: search by title/composer/teacher. `LibraryItem` had no teacher field; the view treated
  `composer` as the teacher proxy, and the placeholder («جستجوی عنوان، آهنگساز یا مدرس…») plus the
  form hint («نام آهنگساز یا مدرس») both claimed a search the data could not perform.
- **Audit.** A canonical `Teacher` identity already existed (`src/domains/teachers/types.ts`, seeded
  `t1`…`t8`), and `Student` / `AcademyClass` / `Session` / `LearningContent` all already carried
  `teacherId: string` — so the missing link was the relationship, not a new domain. The seeded
  catalogue proved the proxy was not a stand-in but a conflation: **six of twelve** rows held a real
  composer's name (Chopin, Carcassi, Bach, the youth orchestra, the academy) and **six** held a
  teacher's name, with nothing in the data to tell them apart. No test depended on the proxy.
- **Decision (owner, product/data-model).**
  1. **Cardinality** — at most one teacher per item: `teacherId?: string`.
  2. **Meaning** — the educational teacher/contributor associated with the content.
  3. **Coexistence** — `teacherId` and `composer` are independent and may both be set; `composer` is
     the creator attribution and is **never** a teacher proxy.
  4. **Governance** — `teacherId` is **provenance, not authorization** (O-08) and creates no RBAC or
     access-control rule; `visibility` / `restrictedToStudentIds` remain the only access rule, and
     `studentCanAccess` remains the single sentence that evaluates it.
  5. **Scope** — frontend/demo model, seed, repository, UI, tests, and the declared frontend
     contract. No backend implementation ships in F1.
- **Implemented.** `Resource.teacherId` (persisted entity) + `Create/UpdateLibraryItemInput`;
  repository search resolves `teacherId → Teacher.name` through `DemoStore.teachers` instead of
  reading `composer` as a teacher; `validate()` rejects a teacher the academy does not hold but —
  unlike the classes repository — accepts an `inactive` one, because attribution is history, not
  assignment. The six teacher names moved out of `composer` in the seed (`SEED_VERSION` →
  `2026.09.2`); their `composer` is now empty, since all six are the academy's own material and
  re-filling it would recreate the conflation. `LearningContent.teacherId` — declared but never
  populated — now carries the value, so the derived learning catalogue did not silently lose the
  name. UI: a real teacher picker labelled as an attribution, a composer field that no longer
  mentions مدرس, a search placeholder the implementation now actually backs, and the teacher's name
  shown in the record's metadata.
- **Verified.** `src/domains/library/__tests__/teacherAttribution.test.ts` (11) and four end-to-end
  cases in `src/views/__tests__/Library.test.tsx` search by a real teacher name through the view and
  assert every hit is a hit *because of* the stored relationship. Mutation-checked: restoring the
  `composer` proxy fails 5, dropping the validation fails 1, undoing the seed migration fails 2, and
  removing the teacher from the view's search fails 2. Backup round-trip proven, including a
  pre-field backup that still loads.
- **Not done:** no backend/API implementation; no RBAC, O-* or governance change; preserved branches
  and archive tags untouched. **Browser QA remains NOT VERIFIED** — no browser was run, and closing
  G-7 is not a browser claim. The decision itself is registered as
  [DECISIONS.md](DECISIONS.md) **§24**.

## 5. Final status

| Gap | Status |
|---|---|
| G-1…G-4 | ✅ closed (tests, mutation-checked) |
| G-5 | ✅ aligned with spec |
| G-6 | ✅ fixed |
| G-7 | ✅ closed (owner decision: real `teacherId`, composer no longer a proxy) |
| Browser QA | **NOT VERIFIED** |

Gate results (typecheck, full test suite, build) are recorded in the commit that carries this revision.

## 6. Not touched

The F1 **audit** pass touched none of: `PROJECT_STATE.md`, `PHASES.md`, `OPEN_ITEMS.md`,
`SESSION_HANDOFF.md`, `GOVERNANCE_CHECKPOINT.md`; any `O-*` item including O-01 (level scope);
`T-02`; preserved branches and archive tags; PR #13 (`afe6b02`); backend.

**One later exception, recorded rather than hidden.** G-7 was closed afterwards, by explicit owner
decision, and closing it required a real data-model field — so **[DECISIONS.md](DECISIONS.md) §24**
was added then. That is the only document outside this report the closure touches, and it changes no
`O-*` or `T-02` status, no branch or tag, and no backend. `PROJECT_STATE.md`, `PHASES.md`,
`OPEN_ITEMS.md`, `SESSION_HANDOFF.md` and `GOVERNANCE_CHECKPOINT.md` remain untouched by the closure
as well; §24 records why its own `PROJECT_STATE.md` §6 link is deferred.
