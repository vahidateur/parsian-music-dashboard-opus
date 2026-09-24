/**
 * WHICH RECORDS STILL POINT AT A STORED ASSET — the scoped reference index the
 * ownership transition (`release.ts`) asks before any bytes are freed.
 *
 * WHAT THIS IS
 *
 *   One named predicate per asset class, answering "does any REMAINING record
 *   reference this media id?" for the owners that can share that class:
 *
 *     profile photos  → students AND teachers. Both dialogs write the same
 *                       `photoMediaId`, so a photo one of them let go of is not
 *                       free while the other still shows it — which is why the
 *                       predicate is not owned by either repository.
 *     library files   → catalogue rows (`resources`).
 *     gallery images  → gallery image rows.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 *   It is NOT the global media-parent gate (O-16 / audit X1). It covers the
 *   owner classes this slice touches and nothing else. Chat attachments,
 *   branding assets, learning content, album covers and restored backups are not
 *   consulted here, so an asset referenced ONLY by one of those is still freed
 *   when the last covered owner lets go of it — a known, reported gap rather
 *   than a claim of completeness. Each predicate reads the live dataset, so the
 *   answer is evaluated AFTER the owner write, on the state that write produced.
 */
import type { DemoStore } from "@/services/demoStore";

/** Profile photos: shared by the two profile owners. */
export function profilePhotoStillReferenced(store: DemoStore, mediaId: string): boolean {
  return (
    store.students.all().some((row) => row.photoMediaId === mediaId) ||
    store.teachers.all().some((row) => row.photoMediaId === mediaId)
  );
}

/** Library files: referenced by catalogue rows. */
export function libraryFileStillReferenced(store: DemoStore, mediaId: string): boolean {
  return store.resources.all().some((row) => row.mediaId === mediaId);
}

/** Gallery images: referenced by image rows (an album row references none). */
export function galleryImageStillReferenced(store: DemoStore, mediaId: string): boolean {
  return store.galleryImages.all().some((row) => row.mediaId === mediaId);
}
