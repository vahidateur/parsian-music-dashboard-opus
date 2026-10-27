# HANDOFF — Gallery slice (end-to-end), 2026-10-24

> Follow-up of `HANDOFF-audit-2026-10-24.md`. No commit/push/reset/staging.
> No DB resets or seeds; one additive migration applied to the dev DB (tables
> only, verified empty afterwards). `PROJECT_STATE.md` untouched.
> Working tree holds this slice plus all prior uncommitted work (~157 files).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     `git log -1 --format=%H` (this doc cannot carry its own SHA)
```

## 1. What existed, what was blocked

- **Existed (demo):** `GalleryRepository` interface, `LocalGalleryRepository`
  (albums + images, cascade delete, global media-parent check, contiguous
  order), `GalleryPanel` (Settings), `GalleryView` + uploader/album-manager/
  lightbox, demo seed (2 albums + 6 photos), honest empty/error states.
- **Blocked:** no server tables, policy, routes; client resolved gallery to the
  `DOMAIN_UNAVAILABLE` stub (`UNAVAILABLE_DOMAINS` = 4); writes borrowed
  `library.write` in the frontend (X-02) — explicitly unsupported per §26.3.
- **Decision (§36, new):** gallery authorized for v1 with its own
  `gallery.read` / `gallery.write` (vocabulary 31→33), same pattern as §33–35.
  Reads: all roles except accountant. Writes: administrator + manager.

## 2. Changes

**Backend (new):** migration `2026_10_25…_create_gallery_tables`
(composite PK `(organization_id, id)`, no cascading FKs — service enforces);
`GalleryAlbum`/`GalleryImage` models (+factories `gl_`/`gi_`); `GalleryPolicy`;
`GalleryService` (album CRUD, image CRUD + positional `reorder`, deleteAlbum
cascade, media release-if-orphaned incl. covers, contiguous renumber);
5 FormRequests (`Store/UpdateAlbum`, `Store/UpdateImage`, `ReorderImage`,
policy-first); `GalleryAlbumResource`/`GalleryImageResource` (camelCase wire);
`GalleryController` + **11 routes** (`GET|POST /gallery/albums[/{id}…]`,
`GET|POST /gallery/images[/{id}…]`, `POST …/reorder`); `GalleryTest` (12).

**Backend (edited):** `permissions.php` (+2 ids, `gallery.read` in
`$readOnlyCore`, `gallery.write` on admin/manager, accountant excluded —
deliberate, §2 matrix); `MediaReferences` (+ image/cover parents);
`MediaPolicy` (+ gallery bytes branch, `visibleMediaIds` branch,
`gallery.write` in upload gate); `TenantRules::galleryAlbumExists`;
`routes/api.php` (+ gallery block, media comment); `ProgressTest`/
`ProgressEventTest` vocabulary 31→33.

**Frontend (new):** `ApiGalleryRepository` (bump after every accepted write,
never after refusal/reads) + `apiRepository.test.ts` (15);
`galleryWriteAffordance.test.tsx` (banner + add-control gating per role).

**Frontend (edited):** `registry.client.ts` (real `ApiGalleryRepository`);
`unavailableDomains.ts` (gallery removed → **3 left**);
`permissions.ts` (+2, view `gallery`→`gallery.read`); `useRoles.ts` (group +
labels); `GalleryPanel`/`GalleryView` gates `library.write`→`gallery.write`;
`GalleryPanel` browser-only copy + upload toast via target seam
(`galleryStorageNote` slot added to **both** `targetCopy` variants;
`fileStoredDetail` reused); `GalleryView` **inverted-banner fix** (see §3);
`registryClient.test.ts`, `permissionParity.test.ts` (+§36 table),
`apiAuthPersistence.test.ts` (33), `cacheInvalidationAudit.test.ts`
(+ album-create / image-reorder bumps).

**Docs:** `DECISIONS.md §36`, `.opencode/specs/auth-rbac.md`
(vocabulary 33, gallery PB line; also fixed the stale "29 ids" header that
the rooms slice had left behind).

**Deliberately unchanged:** demo composition (local repo, seed, browser copy);
`GalleryUploader`/`GalleryAlbumManager`/`GalleryLightbox` (no demo-only copy,
no direct gates — the manager/lightbox mount only under `canWrite`);
`MessageAttachment`'s browser-only sentence (chat — still unavailable,
pre-existing debt for the chat slice, verified still the only demo-copy hit
in the client bundle).

## 3. Real defects found (all demonstrated, all fixed)

1. **Inverted permission banner in `GalleryView`** (severity: medium, verified):
   `!bytes.unavailable && !canWrite ? null : <note/>` showed "you may not
   change the gallery" exactly to writers and nothing to readers.
   Demonstrated live (admin saw the banner with enabled add buttons) and by
   the new test: **both cases fail on the old line, both pass on the fix**.
2. **Missing invalidation** would have applied to the new repo by construction —
   covered from birth by the bump contract tests (accepted→bump, refused→no
   bump) mirroring rooms.
3. **Unlinked-teacher 403 on gallery bytes** is PB-1 fail-close working as
   designed (student branch runs first), not a gallery bug: linked teacher
   gets 200, accountant gets 403, media list projection matches. Pinned in
   `GalleryTest` with the PB-1 code asserted.

## 4. Evidence (measured, not assumed)

- **Backend: 385 tests, 2658 assertions — OK** (373 + 12 new `GalleryTest`:
  auth matrix ×5 roles, forbidden-before-validation, unknown→404, album CRUD
  + search + cover validation/clear, image CRUD + album/media/alt 422s,
  filter, update, reorder incl. out-of-range, renumber-after-remove,
  media-release-vs-retention incl. album cascade, bytes readability per role,
  tenant isolation 404, service round trip).
- **Frontend focused: 103 + 308 + 206 + 26 — all green** (gallery api +
  panel/view/uploader/manager/lightbox/cleanup tests, registry, parity,
  audit, targetCopy, auth, DemoBackedNotice, settingsHonesty, media,
  relations, architecture, dataset/seed).
- **Typechecks:** default + `tsconfig.client.json` + `tsconfig.demo.json` —
  all exit 0. **Client build:** success; 0 demo markers; gallery browser-only
  copy absent (only remaining hit is the pre-existing chat `MessageAttachment`
  sentence); login disclosure now names exactly 3 domains.
- **Live (mariadbd 3307 + API 8080 + vite 5173, all stopped, ports clean):**
  login disclosure lists پیام‌ها، هویت آموزشگاه، جبرانی (no gallery);
  accountant read 403 / teacher write 403 / admin baseline 0 albums;
  album created from UI appears without reload (bump); image uploaded from
  UI → `201` + `md_*` bytes on disk; reorder from UI persists
  (`order 0/1`); lightbox delete frees the orphaned asset but the shared one
  survives (verified in DB); album delete cascades (rows + orphaned media
  freed). **Baselines restored and verified:** gallery 0/0, media 0,
  rooms 4, students 15, instruments 6.

## 5. Assumptions vs verified / remaining risks

- **Verified:** everything in §4. Assumed nothing about auth — every matrix
  cell is asserted server-side and the live matrix spot-checked.
- **Pre-existing gap noticed, out of scope:** server `MediaReferences` does
  not scan learning-content `media_id` (shipped in §34), so a media delete
  could drop an asset learning content still points at. Not demonstrated by a
  test, not touched — flagged for the next media-adjacent slice.
- **Duplicate album titles allowed** (parity with the demo repo; names are
  not identity). If curation needs uniqueness, decide then.
- **Cover need not belong to its album** (parity; no constraint either side).
- **`sortOrder` accepted from the client** (same as instruments) — fine for a
  showcase; revisit if ordering ever becomes contested.
- Full `npm test` (~8 min) not run; focused suites answer the slice.
- `PROJECT_STATE.md §6` link from §36 intentionally **not** added (same
  standing rule as prior slices — that file is checkpoint-dated and its test
  is sensitive; needs explicit owner go-ahead).
- Next slice candidate: **chat** (last media-adjacent unavailable domain
  besides branding/compensation), reusing this slice's media-wiring pattern.

## 6. Resume

```bash
git log -1 --format=%H; git status --short | wc -l
cd backend && vendor/bin/phpunit 2>&1 | tail -3
npx vitest run src/domains/gallery src/views/__tests__/galleryWriteAffordance.test.tsx src/domains/__tests__/registryClient.test.ts src/domains/auth --testTimeout=30000
npm run typecheck   # + both tsconfig profiles; then npm run build:client
# live (recipe §4): vite client → admin → /gallery (album CRUD, upload, reorder, lightbox delete)
```
