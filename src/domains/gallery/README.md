# Gallery — server-backed album and image domain

Gallery is implemented in both application compositions:

- The client composition uses `ApiGalleryRepository` (`apiRepository.ts`) and the authenticated Laravel API.
- The demo composition uses `LocalGalleryRepository` and the demo store.

The backend contract lives in `backend/app/Domain/Gallery/GalleryService.php`, `GalleryPolicy.php`, `backend/app/Http/Controllers/Api/V1/GalleryController.php`, and `backend/routes/api.php`. It serves album and image CRUD plus image reorder under `/api/v1/gallery/albums` and `/api/v1/gallery/images`. Access is governed by `gallery.read` and `gallery.write`; the separate `gallery.details` permission is display-only for the lightbox detail panel (DECISIONS.md §§36 and 42).

Image bytes are staged and read through the Media domain. `MediaReferences` accounts for image and album-cover references, so deleting gallery records releases only orphaned assets. Gallery is not a deferred domain; older checkpoint/handoff notes that predate its API implementation describe historical status, not the current source.

Browser QA status and the latest executable verification belong in `docs/engineering/SESSION_HANDOFF.md`; this README does not imply that a browser session was performed.
