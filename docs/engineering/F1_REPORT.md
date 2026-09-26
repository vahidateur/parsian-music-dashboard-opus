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

### G-5 — `not_applicable` empty-state wording — ACCEPTED DIFFERENCE

- Spec (`F1_INVENTORY.md`): «هنوز در برنامه‌ای قرار نگرفته».
- Implementation: «این هنرجو هنوز روی سطحی قرار نگرفته», in `src/domains/learning/StudentLearningPanel.tsx`.
- **Decision (owner): keep the current text.** The meaning is the same (no placement yet, so nothing
  unlocks), and existing tests already pin the current text. The copy is unchanged; the decision
  is recorded here and in a comment at the render site.

### G-6 — «N ردیف از M» numerals in LearningPanel — FIXED

- `src/domains/learning/LearningPanel.tsx` interpolated raw numbers. Classes, Gallery and Library
  format with `faNum`.
- **Decision (owner): fix.** Both numbers now go through `faNum`; the sentence is unchanged.
  Pinned by `src/domains/learning/__tests__/learningPanelTruncationNote.test.tsx` (programs note,
  levels note, and no note on a complete read).

### G-7 — Library "teacher" search — ACCEPTED WORKAROUND

- Spec: search by title/composer/teacher. `LibraryItem` has no teacher field. The view searches
  title, composer, level and instrument name, and treats composer as the teacher proxy. The
  placeholder («جستجوی عنوان، آهنگساز یا مدرس…») and the form hint («نام آهنگساز یا مدرس») both
  say so.
- **Decision (owner): accept the composer-as-teacher proxy for now. Do not change the data model.**
  A real teacher field on library items needs its own decision, taken only if a concrete need
  appears; that decision should also cover backend shape. It is not entered as an open item.

## 5. Final gate

Recorded in the commit that carries this report: typecheck, full test suite and build.
Browser QA remains **NOT VERIFIED**.

## 6. Not touched

`PROJECT_STATE.md`, `PHASES.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `GOVERNANCE_CHECKPOINT.md`; any
`O-*` item including O-01 (level scope); `T-02`; preserved branches and archive tags; PR #13
(`afe6b02`); backend.
