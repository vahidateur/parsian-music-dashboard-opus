# F1 — READ-ONLY INVENTORY — Learning + Level Access + Library + Gallery

> Branch: `arena/frontend-completion-spec` HEAD `9dcd5bc` parent `a251e69` planning `e57bf19` — F1-KICKOFF correction complete — F1 AUTHORIZED — inventory before any code modification — docs-only state verified — no backend/Laravel work.

## Purpose

Perform READ-ONLY F1 inventory of existing implementation, identify exact files/components/hooks/repositories involved, report implementation slices and genuine blockers, then implement incrementally.

## Canonical Rules — Source of Truth (from 11-roadmap.md + 04-learning-access-policy + 05-rbac + 06-library-gallery-spec)

**Learning — Student Level N:**
- eligible 1..N, N+1+ locked with honest reason `در سطح X باز می‌شود` + lock icon no preview/download
- `not_visible` hidden from students
- `not_found` honest
- `not_applicable` empty `هنوز در برنامه‌ای قرار نگرفته`
- one content linked to several reachable levels emitted once lowest
- sorting levelOrder ASC sortOrder ASC title fa locale
- owner `learning/eligibility.ts`
- scope O-01 OPEN global vs per-program vs per-instrument — do NOT decide

**Library — genuinely functional:**
- search title/composer/teacher
- filters kind/instrument/level/visibility
- sort added/uses/title
- real preview via `useLibraryFile` + `useMediaObjectUrl` real bytes no fabricated URL
- locked honest reason
- complete metadata
- loading/empty/error + retry
- demo persistence single source DemoDataset + blobStore + demoStore
- API seam preserved
- upload/write via media seam
- download real demo bytes
- honest pagination/truncation disclosure `N ردیف از M`
- detail same surface per F1 disposition — no new route

**Gallery — genuine:**
- album metadata title/description/coverMediaId/sortOrder/createdAt
- image metadata albumId/mediaId/caption/alt/sortOrder/createdAt alt required
- album filtering, sortOrder ASC then createdAt
- visibility semantics already specified
- real media bytes via media seam
- empty `تصویری نیست`
- upload via media seam
- no fabricated counts
- seed VERIFIED `src/domains/demo/learningSeed.ts:258-278` deriveGalleryAlbums 2 albums alb_recital alb_rooms, deriveGalleryImages 0 images — do NOT alter to look fuller

**Absorbed hardening:**
- Classes deep-link get(id) authoritative beyond capped list
- pagination/per_page mitigation honest disclosure
- media one-frame stale asset/blob/object-URL

## Existing Files — Exact

### Learning Domain
- `src/domains/learning/types.ts` — LearningProgram, LearningLevel, LearningContent, LevelContentLink, StudentPlacement, AttachContentIntent, ContentVisibility students/teachers, active, exclusive
- `src/domains/learning/eligibility.ts` — **canonical owner** — resolveEligibleContent pure O(L+K+C), audience default students hides teachers visibility, active filtering, exclusive exact-only, shared content once lowest level, sorting levelOrder ASC sortOrder ASC title fa locale — VERIFIED matches spec
- `src/domains/learning/repository.ts` — interface listPrograms/listLevels/listContent/listLinks/attachContent with intent/detachContent/assignPlacement/eligibleContent
- `src/domains/learning/demoRepository.ts` — DemoLearningRepository implements all, attachContent intent guard LINK_INVALID before duplicate check, assignPlacement guard programId mismatch, eligibleContent via eligibility.ts
- `src/domains/learning/useLearning.ts` — usePrograms, useLevels, useLearningContent via useResourceList Paged, useStudentPlacement, useEligibleContent via useDerived keyed by studentId — prevents stale cross-student exposure
- `src/domains/learning/LearningPanel.tsx` — admin master/detail programs → levels, QuickAdd, move/reorder, delete, contentLevel derived selection dropped on program change — uses programId intent from programs query not level.programId — I13 fixed
- `src/domains/learning/LevelContentPanel.tsx` — assignment surface M3 — linked vs catalogue reads separate errors, derived pickedId, attach with {programId} intent, detach, honest reporting via notify, no private copy of links
- `src/domains/learning/StudentLearningPanel.tsx` — student path — placement ladder + eligible list — currently ONLY eligible shown, NOT locked N+1+ with reason — GAP for F1 — needs locked calculation
- Tests: `eligibility.test.ts` 13 pass, `attachContentIntent.test.ts` 8 pass, `contentAssignmentFlow.test.tsx`, `LevelContentPanel.test.tsx`, `StudentLearningPanel.test.tsx`, `demoRepository.test.ts`, `useDerived.test.tsx`

### Library Domain
- `src/domains/library/types.ts` — ResourceKind sheet/audio/video/doc, Resource, LibraryItem extends Resource mediaId? createdAt?, CreateLibraryItemInput, LibraryFileStatus none/loading/ready/missing, LibraryFileState
- `src/domains/library/repository.ts` — LibraryRepository list/get/create/update/remove
- `src/domains/library/demoRepository.ts` — DemoLibraryRepository — rows DemoDataset.resources, validation instrument/media existence, sizeLabel/durationLabel/addedLabel projections from real values — no fixture constants
- `src/domains/library/useLibrary.ts` — useDemoLibraryFile gated on isDemoEnvironment, useLibraryList Paged per_page explicit, useLibraryFile resolves asset+blob via media repo together, status derived, reason honest, download via downloadBlobFile real bytes
- `src/domains/library/AudioMessagePlayer.tsx` — real player with peaks, disabled when no src
- `src/views/Library.tsx` — LibraryView — shelves by kind+instrument counts real, FilterBar search placeholder title/composer/teacher but filter only title/composer (teacher missing — GAP), Chip filters kind all + per-kind counts + instrument catalogue active, Segmented sort recent/popular but NOT title sort — GAP, useLibraryList per_page 200, items filtering client-side kind/instrument/query, sort popular = uses else recent = insertion order not added date — GAP, StatStrip total/ mostUsed/withFile/instruments, EmptyState «کتابخانه خالی است» honest, Drawer detail same surface per F1 disposition — shows file state ready/missing reason, AudioMessagePlayer src audioUrl via useMediaObjectUrl, metadata grid ساز/سطح/آهنگساز/حجم/صفحه|مدت/افزوده‌شده, uses count — download real via file.download disabled when not ready — upload button currently NOT implemented — notifies info "افزودن منبع از این نما فعال نیست" — GAP for F1 — needs media seam two writes
- Pagination disclosure: total shown but NOT explicit "N ردیف از M" truncation note — GAP — Classes has partialNote but Library does not
- Tests: `useLibrary.test.tsx` — loads via registry, explicit page size, filters/search, file states ready/none/missing, download, etc — 190 tests including library pass

### Gallery Domain
- `src/domains/gallery/types.ts` — GalleryAlbum id/title/description/coverMediaId?/createdAt/sortOrder, GalleryImage id/albumId/mediaId/caption/alt/sortOrder/createdAt alt required, ListParams search/albumId, Create/Update inputs
- `src/domains/gallery/repository.ts` — GalleryRepository listAlbums/getAlbum/createAlbum/updateAlbum/deleteAlbum/listImages/addImage/updateImage/removeImage/reorderImage
- `src/domains/gallery/demoRepository.ts` — DemoGalleryRepository — listAlbums sortOrder ASC, listImages sortOrder ASC, addImage validates media existence + alt required, freeMedia deletes blob + media when no longer referenced, reorderImage contiguous, deleteAlbum frees media
- `src/domains/gallery/useGallery.ts` — useAlbums, useGalleryImages via useResourceList
- `src/domains/gallery/GalleryPanel.tsx` — GalleryPanel — useAlbums per_page 100, selectedId state derived selected = albums.find(id) ?? albums[0], useGalleryImages albumId selected.id per_page 200 else per_page 0, createAlbum via repo, upload via media repo create kind image then gallery addImage alt required, removeImage, Thumb uses useMediaObjectUrl real bytes, loading/error/empty states: albums empty EmptyState "آلبومی وجود ندارد", imagesLoading LoadingState "در حال بارگذاری تصاویر این آلبوم…", imagesError ErrorState, images empty EmptyState "این آلبوم خالی است" but spec says "تصویری نیست" — minor GAP wording, upload input file accept ALLOWED_IMAGE_TYPES, Surface notice about browser-only storage, no fabricated counts — meets most F1 but needs: album filtering search? Currently no search filter — GAP, visibility semantics? No visibility field — OPEN per spec, empty state wording alignment, pagination disclosure missing — GAP, sorting already sortOrder ASC then createdAt via repo — PASS, alt required enforced — PASS, seed VERIFIED 2 albums 0 images via learningSeed.ts — PASS
- Tests: `GalleryPanel.test.tsx`, `GalleryAlbumSwitch.test.tsx` — pass

### Media Seam
- `src/domains/media/types.ts` — MediaAsset, MediaKind image/audio/document, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, etc
- `src/domains/media/repository.ts` — MediaRepository get/getBlob/create etc
- `src/domains/media/demoRepository.ts` — DemoMediaRepository — validation type/magic bytes/size, put to blobStore + metadata to DemoStore
- `src/domains/media/blobStore.ts` — indexedDbBlobStore + createMemoryBlobStore for jsdom tests
- `src/domains/media/useMedia.ts` — useMediaObjectUrl — resolves blob to object URL, cleanup revokes — potential one-frame stale issue: effect cleanup revokes created URL but setUrl(undefined) after revoke, and if mediaId changes quickly, previous URL may be shown one frame before new? Also useLibraryFile has similar: asset/blob state not cleared synchronously when mediaId changes — may show previous file one frame — GAP for F1 hardening
- `src/domains/media/ProfilePhotoField.tsx` — not F1 but shared

### Classes Deep-Link Absorbed
- `src/views/Classes.tsx` — ClassesRoster + ClassDetail + ClassesView
- RELATIONS_PER_PAGE = 200 — per_page explicit
- useClasses per_page 200, teachers per_page 200, enrollments per_page 200, rooms per_page 200, sessions per_page 200
- detail = detailId ? classes.find((c) => c.id === detailId) : undefined — capped find — GAP — should be get(id) authoritative beyond capped list — needs fix via getClassRepository().get(detailId) with own loading/error
- partialNote function already implements "N ردیف از M" honest truncation disclosure for sessions/enrollments/students/rooms — PASS for Classes but Library/Gallery missing — GAP to absorb
- key={detail.id} on ClassDetail prevents previous roster — PASS for I13
- Tests: `classesRelations.test.tsx` — roster is enrollment relation, follows rename, etc — PASS

### Shared / Pagination / per_page
- `src/domains/shared/useResource.ts` — useResourceList — Paged<P> forces per_page explicit — compile error if omitted — PASS, keyed state prevents stale cross-query exposure — I13 fixed, partialNote pattern exists in Classes but not reused in Library/Gallery — GAP
- `src/api/types.ts` — Page, PageMeta total, per_page optional — Paged wrapper makes required

### Registry
- `src/domains/registry.ts` — getLearningRepository, getLibraryRepository, getGalleryRepository, getMediaRepository, etc — demo both modes — API seam preserved — no binary client for library/gallery yet — B contract

### Existing Tests Relevant to F1 (all currently PASS)
- eligibility.test.ts 13
- attachContentIntent.test.ts 8
- contentAssignmentFlow.test.tsx 5
- LevelContentPanel.test.tsx 12
- StudentLearningPanel.test.tsx
- useLibrary.test.tsx
- GalleryPanel.test.tsx
- GalleryAlbumSwitch.test.tsx
- classesRelations.test.tsx
- deepLinkPagination.test.tsx
- relationsNoFixtures.test.ts
- noSuccessWithoutWrite.test.tsx
- honestWriteCopy.test.tsx
- Total F1-related 190 passed in last run

## Gaps Identified — F1 Implementation Slices

### Slice 1 — Learning Locked State + Honest States
- File: `src/domains/learning/StudentLearningPanel.tsx`
- Current: only eligible shown
- Required: also show locked N+1+ with reason `در سطح X باز می‌شود` + lock icon no preview/download, not_visible hidden (already hidden via eligibility audience=students), not_found honest (placement undefined handled), not_applicable empty `هنوز در برنامه‌ای قرار نگرفته` (currently "این هنرجو هنوز روی سطحی قرار نگرفته" — close but spec exact wording needs check), one content linked to several reachable levels emitted once lowest (already in eligibility.ts), sorting levelOrder ASC sortOrder ASC title fa locale (already in eligibility.ts)
- Need: compute locked = content linked to levels order > current + active + visibility students, but not reachable — need levels list + links + content + currentLevel order
- Also need: StudentLearningPanel should show locked section with lock icon, reason, no preview
- Also need: LearningPanel already has program/level management — keep
- Risk: Do NOT invent inactive/archived eligibility — keep OPEN per disposition — Student inactive status not in current model? Student has no active field? Check students domain — may need to keep OPEN no fake decision

### Slice 2 — Library Genuine Functional
- Files: `src/views/Library.tsx`, `src/domains/library/useLibrary.ts`, `src/domains/library/types.ts` (no change needed), `src/domains/library/demoRepository.ts` (maybe extend for teacher search, level, visibility filters)
- Search: currently title/composer only — spec says title/composer/teacher — teacher not in LibraryItem — need to check if teacherId or author maps to teacher? LibraryItem.composer is composer, not teacher — teacher search may need to search via LearningContent teacherId? Or keep as is and document teacher search maps to composer? Better to add teacher search via author/composer field or via linked LearningContent? Simplest: extend search to include instrument? But spec says teacher — could search composer field as teacher proxy? Need to inspect if LibraryItem has teacher info — currently no — could search via author field of LearningContent? For now implement search over title/composer only and document teacher as composer alias — or add teacher search if LibraryItem gets teacherId later — keep OPEN but implement title/composer/instrument search to be honest — do NOT fabricate teacher field
- Filters: kind (exists), instrument (exists via catalogue), level (MISSING — LibraryItem.level is string label, need filter by level string), visibility (MISSING — LibraryItem has no visibility, LearningContent has visibility — need to decide: Library visibility filter maps to LearningContent visibility? For now Library public if library.read — visibility filter can be deferred but spec says implement — could add visibility filter that filters by LearningContent visibility if linked? Simpler: add level filter + visibility filter as UI chips that filter LibraryItem.level and LearningContent visibility if available — but LibraryItem has no visibility — could keep visibility filter as no-op honest disclosure? Better to add level filter now, visibility filter as disabled honest deferral? Spec says implement genuinely functional filters kind/instrument/level/visibility — level exists as string, visibility does NOT exist in LibraryItem — need to check if we should add visibility field to LibraryItem or keep as is and document as OPEN? Per F1 disposition publication status uses active/visibility semantics from LearningContent — so Library visibility filter should use LearningContent visibility if LibraryItem linked to LearningContent via mediaId? Not currently linked — so for F1 we can implement level filter (string) and visibility filter as filter over LearningContent visibility when LibraryItem maps to LearningContent? Could also add visibility field to LibraryItem as optional and filter — but that would be model change — need to check if decision allows adding visibility field — spec says publication status use existing semantics active/visibility from LearningContent — so Library visibility filter could filter LearningContent, not LibraryItem — for F1 we can implement Library filters kind/instrument/level + sort, and document visibility as same as LearningContent active? Might need to add visibility filter UI but with honest note if no field
- Sort: recent/popular exists but title sort missing — need to add title fa locale sort
- Preview: already real via useLibraryFile + useMediaObjectUrl — PASS but need to ensure one-frame fix
- Locked honest: file.status missing/none shows reason — PASS but need to ensure locked UI with lock icon
- Metadata complete: currently shows ساز/سطح/آهنگساز/حجم/صفحه|مدت/افزوده‌شده — missing maybe teacher? But complete per current model — PASS
- Loading/empty/error: PASS
- Pagination disclosure: MISSING — need to add partialNote "N ردیف از M" when total > items.length — like Classes does
- Detail same surface: Drawer same surface — PASS per disposition
- Upload via media seam: MISSING — button currently info toast — need to implement two writes: media.create then library.create — similar to GalleryPanel upload
- Download real bytes: PASS via file.download
- Tests: need to implement library filter/sort/preview tests — existing useLibrary.test.tsx covers some but need to add title sort and level filter

### Slice 3 — Gallery Genuine
- Files: `src/domains/gallery/GalleryPanel.tsx`, `src/domains/gallery/types.ts`, `useGallery.ts`, `demoRepository.ts`
- Album metadata: title/description/coverMediaId/sortOrder/createdAt — exists
- Image metadata: albumId/mediaId/caption/alt/sortOrder/createdAt — exists alt required enforced
- Album filtering: currently no search filter — need to add search filter over title/description
- sortOrder ASC then createdAt: repo already sorts by sortOrder — PASS but need to ensure secondary createdAt — currently only sortOrder — GAP add createdAt secondary
- Visibility semantics already specified: currently all demo visible — no visibility field — OPEN per spec — keep
- Real media bytes via media seam: Thumb uses useMediaObjectUrl — PASS
- Empty state "تصویری نیست": currently "این آلبوم خالی است" — wording mismatch — need to align to spec empty state "تصویری نیست" for gallery images empty, and "آلبومی وجود ندارد" for albums empty? Spec says empty: تصویری نیست — so update
- alt required: enforced in repo — PASS
- Upload via media seam: already implemented — PASS
- No fabricated counts: counts real — PASS
- Seed VERIFIED 2 albums 0 images — PASS — do NOT alter expectation to look fuller
- Pagination disclosure: missing — need to add partialNote
- Sorting and filtering: need to ensure album filtering and image filtering work

### Slice 4 — Classes Deep-Link Authoritative
- File: `src/views/Classes.tsx` line 678 detail = classes.find((c) => c.id === detailId) — capped 200 — GAP
- Fix: use getClassRepository().get(detailId) authoritative beyond capped list — need to add hook useClass(id) or use direct repo get with loading/error — similar to other domains — implement useClass via useDerived or via useResource? Simplest: create useClass hook in classes domain that does get by id, or in ClassesView fetch via getClassRepository().get when detailId not in list
- Also need to ensure detail view still shows roster etc via existing per_page 200 relations — keep
- Test: classesRelations.test.tsx already covers relations but deep-link beyond 200 not tested — need to add test or ensure existing deepLinkPagination.test.tsx covers

### Slice 5 — Pagination / per_page Mitigation
- Files: `src/views/Library.tsx`, `src/domains/gallery/GalleryPanel.tsx`, `src/views/Classes.tsx` (already has partialNote)
- Library: per_page 200 but no truncation disclosure — need to add partialNote "کتابخانه: N ردیف از M" when total > items.length
- Gallery: per_page 100 albums, 200 images — no disclosure — need to add
- Learning: per_page 200 for programs/levels/content — already uses Paged but no disclosure — should add disclosure in LearningPanel and StudentLearningPanel?
- Implement helper partialNote reuse from Classes.tsx — extract to shared or duplicate locally

### Slice 6 — Media One-Frame Stale Issue
- Files: `src/domains/library/useLibrary.ts` useLibraryFile, `src/domains/media/useMedia.ts` useMediaObjectUrl
- Current useLibraryFile: when mediaId changes, loading set true but asset/blob state not cleared synchronously — may show previous file one frame — need to clear asset/blob on mediaId change at render time or in effect before async
- Current useMediaObjectUrl: similar — when mediaId changes, url state not cleared immediately — previous URL shown one frame — need to clear url when mediaId changes, and revoke previous URL synchronously
- Fix: in useLibraryFile, setAsset(undefined)/setBlob(undefined) when mediaId changes or when loading starts — already does setAsset(undefined) when !mediaId but not when mediaId changes — should clear on mediaId change
- In useMediaObjectUrl, setUrl(undefined) when mediaId changes — currently does setUrl(undefined) when !mediaId but not when mediaId changes to different value — effect cleanup revokes but setUrl(undefined) happens in cleanup — but there is one frame where old url still in state while new effect hasn't run? Actually useEffect cleanup runs before new effect, so it sets url undefined in cleanup — but setUrl(undefined) in cleanup is async? Need to ensure url cleared synchronously when mediaId changes — can setUrl(undefined) at top of effect when mediaId truthy as well, or use ref to track previous mediaId and clear
- Implement fix: clear asset/blob/url at start of effect when mediaId changes

## Blockers / Open Decisions — Genuine

- O-01 scope global vs per-program vs per-instrument remains OPEN — do NOT decide — current per-program provisional via placement.programId — keep OPEN
- Library.level string vs relation to LearningLevel — O-02 — keep string vocabulary D for now provisional per decision register — do NOT link to LearningLevel relation unless evidence requires documented change
- Library visibility field — add or keep public? — OPEN — per F1 disposition use active/visibility semantics from LearningContent, not new workflow — LibraryItem has no visibility — keep public if library.read for F1, document as OPEN — do NOT invent visibility field unless spec already has it — LearningContent has visibility, LibraryItem does not — keep as is for F1, implement visibility filter as no-op or as filter over LearningContent if linked? Better to document as OPEN and implement level filter only, visibility filter honest deferral with note
- Gallery visibility/permission — OPEN — for now public demo — keep
- Inactive/archived student eligibility — OPEN per F1 disposition — do NOT fabricate — Student model has no active/inactive? Check students domain — if no active field, keep OPEN — do NOT invent
- Publication workflow independent — deferred to decision gate — do NOT invent new workflow — use active boolean + visibility enum from LearningContent
- T-02 belongs to F2 — do NOT resolve — keep OPEN EVIDENCE CONFLICTING
- No backend work — all demo — no Laravel/migrations

## Implementation Order — Vertical Slices

1. Slice 4 — Classes deep-link get(id) authoritative — small, isolated, required for honest deep-link — file `src/views/Classes.tsx` + maybe `src/domains/classes/useClasses.ts` add useClass hook
2. Slice 6 — Media one-frame fix — `src/domains/media/useMedia.ts` + `src/domains/library/useLibrary.ts` — small, prevents stale UI
3. Slice 5 — Pagination disclosure — add partialNote to Library and Gallery (and maybe Learning) — small
4. Slice 1 — Learning locked state — `StudentLearningPanel.tsx` + maybe `eligibility.ts` helper for locked — core F1 Learning
5. Slice 2 — Library genuine — `src/views/Library.tsx` — filters level, sort title, upload via media seam, truncation disclosure
6. Slice 3 — Gallery genuine — `GalleryPanel.tsx` — search filter, empty wording, sort secondary createdAt, truncation disclosure

Each slice: focused tests after, then broader regression before final.

## Tests to Preserve / Implement

- Existing: eligibility.test.ts, attachContentIntent.test.ts, contentAssignmentFlow.test.tsx, LevelContentPanel.test.tsx, StudentLearningPanel.test.tsx, useLibrary.test.tsx, GalleryPanel.test.tsx, GalleryAlbumSwitch.test.tsx, classesRelations.test.tsx, deepLinkPagination.test.tsx, relationsNoFixtures.test.ts, noSuccessWithoutWrite.test.tsx, honestWriteCopy.test.tsx
- F1 required per spec: eligibility tests (PASS), LevelContentPanel tests (PASS), content assignment flow (PASS), attach intent guard (PASS), Library filter/sort/preview tests (need to add title sort, level filter), Gallery genuine behavior tests (need to add search, empty wording), GalleryAlbumSwitch (PASS), Classes deep-link authoritative lookup (need to fix + test), relationsNoFixtures (PASS), noSuccessWithoutWrite (PASS), honestWriteCopy (PASS)

## No Code Modified Yet

Inventory complete — no files modified — next step implement Slice 4 Classes deep-link authoritative.

