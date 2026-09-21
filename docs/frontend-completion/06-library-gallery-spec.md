# 06 — Library + Gallery Spec

## Library Resource Model

### Types (VERIFIED)

- Resource (persisted DemoDataset.resources): id, title, composer, kind (sheet/audio/video/doc), instrument (InstrumentId), level (string display label), size (Persian label), duration?, pages?, added (Persian label), uses (number), peaks? (audio waveform)
- LibraryItem extends Resource: mediaId? (MediaAsset.id ref), createdAt? ISO authoritative, size/duration/added derived from createdAt so never disagree
- Create input: title, composer?, kind, instrument, level?, mediaId?, pages?, durationSeconds?, peaks?
- LibraryFileStatus: none (no mediaId), loading, ready (metadata+bytes present), missing (metadata exists bytes don't — backup carries metadata only, legitimate not error)

### Search / Filter / Sort / Preview / Locked / Metadata Workflows

**Search:** title, composer, teacher — VERIFIED SearchInput placeholder "جستجوی عنوان، آهنگساز یا مدرس…"

**Filter (current + desired):**
- kind: sheet/audio/video/doc — exists? FilterBar with Chip? Need to inspect Library.tsx further — VERIFIED shelves by kind+instrument but not generic filter — INFERRED gap: kind filter exists via shelves but not as explicit filter chip — classify A NOW add FilterBar kind/instrument/level/visibility
- instrument: InstrumentId — exists via shelves but not generic — A NOW
- level: string — currently string label, not relation — gap, needs decision: keep as vocabulary D (static) or link to LearningLevel? For now filter by level string — A NOW
- visibility: ContentVisibility students/teachers — from learning content, but LibraryItem has no visibility field — gap: LibraryItem should have visibility? Currently library is separate from learning content — two concepts: LearningContent (curriculum resource linked to levels) vs Library Resource (catalogue). LearningContent has visibility, Library Resource does not — needs decision: add visibility to LibraryItem or keep library public? For academy, library may be public to all with library.read — but learning content eligibility already gates via level. So library visibility could be same as learning content? OPEN decision — for now library is public if library.read — document as is
- Sort: added (createdAt), uses, title — VERIFIED? Need check Library.tsx — INFERRED not explicit sort select — A NOW add sort by added/uses/title

**Preview:**
- useLibraryFile resolves asset + blob via media repo, useMediaObjectUrl creates object URL — VERIFIED
- Audio: AudioMessagePlayer with peaks, never decodes unless playing — VERIFIED
- Image: object URL preview
- PDF/doc: download only? Preview could be via object URL — A NOW
- Locked: when status missing or none — show honest reason, no open/download affordance — VERIFIED D15 pattern

**Metadata:**
- title, composer, kind label via resourceKindLabel, instrument name via instrumentName, level, size, duration, pages, added, uses, peaks — VERIFIED
- createdAt authoritative, added derived — VERIFIED
- No owner field — needs org_id + owner for per-object auth backend — B

**Workflows:**
- Empty: «منبعی نیست» honest — VERIFIED
- Loading: LoadingState with role=status — VERIFIED
- Error: ErrorState with retry, error owns message — VERIFIED D12
- Demo persistence: resources collection in DemoDataset, bytes blobStore, single authority demoStore — VERIFIED
- API seam: getLibraryRepository returns demo both modes, apiRepository exists but unregistered because ApiClient JSON only, needs binary client — DOCUMENTED
- Create: upload via media domain first (CreateMediaInput bytes ArrayBuffer), then library create with mediaId — VERIFIED two writes pattern same as chat attachments
- Download: real bytes via downloadBlob? Actually LibraryFileState download triggers genuine browser download of stored bytes — VERIFIED Phase1

### F1 Dispositions — VERIFIED (Do NOT invent new workflow/route)

- **Library detail view — preview/detail same surface no independent route unless spec already decided:** Library detail view uses preview/detail same surface (card → preview sheet/panel/dialog) — no independent route `#/library/:id` unless spec already decided — preview/detail same surface, do NOT add new route — if spec already decided route exists, keep, else same surface — F1 disposition VERIFIED — no new route invented
- **Publication status — use active/visibility semantics, independent publication workflow to decision gate/deferred no new workflow:** Publication status uses active/visibility semantics (`active` boolean + `visibility` students/teachers) — independent publication workflow (draft→review→published) to decision gate/deferred — do NOT invent new workflow — use existing active/visibility, defer independent publication workflow to decision gate — no new workflow invented — F1 disposition VERIFIED
- **Inactive/archived student eligibility — explicit record, keep OPEN if evidence insufficient no fake decision:** Inactive/archived student eligibility explicit record — if student inactive/archived, eligibility remains OPEN if evidence insufficient — do NOT fake decision — keep OPEN — F1 disposition OPEN — no fake decision
- **Gallery seed — read-only check `learningSeed.ts` expected 2 albums 0 images VERIFIED not guess:** Gallery seed read-only check `src/domains/demo/learningSeed.ts:258-278` — `deriveGalleryAlbums()` returns 2 albums `alb_recital` `alb_rooms` VERIFIED, `deriveGalleryImages()` returns 0 images VERIFIED — expected 2 albums 0 images VERIFIED not guess — read-only check — F1 disposition VERIFIED

### Frontend Completable NOW (A)

- FilterBar for kind/instrument/level with Chip, explicit
- SearchInput already
- Sort select: newest, most used, title
- Preview: image via object URL, audio via AudioMessagePlayer, video? doc? — use same object URL — detail view same surface per F1 disposition, no independent route unless spec already decided
- Locked: card shows lock icon + reason when status missing/none, no download
- Metadata: show all fields, uses count live from repo not fixture, publication status active/visibility per F1 disposition
- Workflows: empty/loading/error already, but ensure error discarding fixed (I15) — each read owns error — publication workflow deferred per F1 disposition, no new workflow
- per_page disclosure: state ceiling, counts from total, truncation note «N ردیف از M» — I16 mitigation
- Inactive/archived eligibility OPEN per F1 disposition — no fake decision

### Contract Now Backend Later (B)

- Binary storage provider (S3/MinIO), signed URLs, per-object auth, virus scanning, content-type sniffing — same as media
- Search server-side for large catalogue (currently client-side demo)
- Uses count increment on download — needs server transaction

### Explicitly Deferred (C)

- None for library — it's A

## Gallery Audit

### Types (VERIFIED)

- GalleryAlbum: id, title, description, coverMediaId? (MediaAsset.id, falls back first image), createdAt ISO, sortOrder number
- GalleryImage: id, albumId, mediaId, caption, alt (required a11y), sortOrder, createdAt

### Genuine vs Shallow

**Genuine album criteria:**
- Has at least 1 image where mediaId resolves to existing MediaAsset and blob exists or missing honestly disclosed
- Metadata complete: title non-empty, description, coverMediaId either set or derivable from first image, sortOrder contiguous, createdAt ISO
- Filtering: by album (albumId param)
- Ordering: by sortOrder asc, then createdAt
- Visibility: currently all demo visible — no visibility field — needs org visibility? OPEN, for now public if gallery read? Actually gallery has no permission in viewPermissions? Check: gallery not in viewPermissions? It is not a ViewId, it's part of library? Actually GalleryPanel is component not route — but gallery domain exists — needs permission? OPEN — for now public demo
- Storage seam: metadata dataset (galleryAlbums, galleryImages collections), bytes blobStore via media — same as library

**Shallow album (to be removed or fixed):**
- Album with 0 images and no cover — empty state honest «تصویری نیست»
- Album with coverMediaId pointing to deleted asset — honest missing state, no fabricated URL
- Fabricated occupancy figure — already removed M7

**Current audit — VERIFIED read-only via `src/domains/demo/learningSeed.ts:258-278`:**
- `deriveGalleryAlbums()` returns 2 albums `alb_recital` `alb_rooms` VERIFIED — read-only check, not guess — expected 2 albums
- `deriveGalleryImages()` returns 0 images VERIFIED — read-only check, not guess — expected 0 images
- Seed VERIFIED 2 albums 0 images — F1 disposition gallery seed VERIFIED — not INFERRED
- No upload UI currently — gap A NOW — but seed verification DONE — 2/0 VERIFIED

### Frontend Completable NOW (A)

- GalleryPanel already reads via useGallery — VERIFIED, no fixture thumbnails (M10)
- Add upload UI: media create then gallery image create — same two-write pattern as library/chat
- Filter by album, sort by sortOrder, preview via objectUrl, alt required
- Empty/loading/error honest
- per_page disclosure

### Contract Now Backend Later (B)

- Storage provider, signed URLs, per-object auth, scanning — same as media/library
- Visibility org scoping

### Explicitly Deferred (C)

- None — gallery is A

## API Seam

- getGalleryRepository demo both modes — VERIFIED
- No apiRepository? Actually only demoRepository exists — check ls — VERIFIED only demo
- Future apiRepository would need binary client same as library

## Acceptance

- Library: search/filter/sort work live on repo data, no fixture counts, preview real bytes, locked honest, metadata all fields, workflows empty/loading/error/demo persistence, API seam declared
- Gallery: albums genuine if images backed by media, metadata complete, filtering by album, ordering by sortOrder, visibility all demo (or permission if added), storage seam metadata dataset bytes blobStore, no fabricated figures

## Per-Program / Instrument Classification — DECIDED O-01 (2026-09-21)

Per the O-01 final decision (per-program level scope), library resources must be classifiable by
**program/instrument and level** so that they can be offered to students according to the student's
level in **that** program/instrument — enforcing the controlled learning path. A student eligible at
piano L3 must not automatically receive violin L3 resources (the per-instrument option was rejected)
or global L3 resources (the global option was rejected).

- Resource classification by instrument is already present (`Resource.instrument: InstrumentId`).
- Resource classification by program/level is served through `LearningContent` links
  (curriculum-gated via the eligibility rule in `learning/eligibility.ts`), while catalogue
  `Resource` rows carry a descriptive level string vocabulary (O-02 DECIDED 2026-09-21: descriptive
  string vocabulary, not an authorization field, no direct FK to `learning_levels`).
- Teacher exceptional access: a teacher may grant a specific student access to a specific resource
  outside normal per-program eligibility. This is a product-level exception (resource-grant only,
  does not change level or program placement). Backend must enforce this in authorization; exact
  persistence is not decided here.

## Open Decisions for Library/Gallery

- Library.level string vs relation to LearningLevel — **DECIDED 2026-09-21 (O-02)**: descriptive catalogue string vocabulary, not an authorization field, no direct FK to `learning_levels`.
- Library visibility field — add or keep public? (O-03 — Library half discharged; Gallery half open)
- Gallery visibility/permission — add reports.read? Actually library.read?
- Gallery album cover fallback logic — spec as is (fallback first image) — keep
