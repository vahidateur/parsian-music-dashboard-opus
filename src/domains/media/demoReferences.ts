/**
 * WHICH RECORDS STILL POINT AT A STORED ASSET — the reference check the ownership
 * transition (`release.ts`) asks before any bytes are freed.
 *
 * WHAT THIS IS (X1)
 *
 *   ONE predicate, `mediaStillReferenced`, answering a global question: does ANY
 *   persisted record in this environment reference the asset? Before this, each
 *   owner supplied its own scoped answer — profile photos checked students and
 *   teachers, the library checked catalogue rows, the gallery checked image rows —
 *   so an asset was freed whenever it left the ONE family its owner happened to
 *   know about. An attachment, a learning material, a branding logo or an album
 *   cover holding the same id was invisible to that owner, and the bytes went.
 *
 *   The parents scanned here are exactly the persisted `MediaAsset.id` references
 *   the product has today:
 *
 *     students.photoMediaId          profile photo
 *     teachers.photoMediaId          profile photo (shared class with students)
 *     resources.mediaId              catalogue file (library)
 *     learningContent.mediaId        teaching material
 *     chatMessages.mediaId           message attachment
 *     galleryImages.mediaId          gallery image
 *     galleryAlbums.coverMediaId     album cover (a row that need not have images)
 *     branding.logoMediaId           academy logo (singleton, not a collection)
 *     branding.faviconMediaId        academy favicon (singleton, not a collection)
 *
 *   A new media-bearing record type must be added here in the same change that
 *   introduces it. That obligation is the cost of a single global check; the
 *   alternative — one predicate per owner — is what produced this defect.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 *   - NOT authorization. It answers whether bytes are still reachable, never who
 *     may read them (D15: resolution is not authorization; per-object access is a
 *     server concern). No code path may cite this as a security boundary.
 *   - NOT retention policy. It carries no TTL, no age and no purge rule; an asset
 *     nobody references is freed by its owner's transition, not by a clock
 *     (O-19 stays open).
 *   - NOT blob inspection. Bytes are never read to answer this question.
 *   - NOT an `owner_id`. Ownership stays per-relation, as O-08 decided.
 *
 *   The answers are read from the LIVE dataset through the store's own accessors,
 *   so a predicate evaluated after an owner write sees the state that write
 *   produced — which is the ordering `release.ts` depends on.
 */
import type { DemoStore } from "@/services/demoStore";

/**
 * The global media-parent check: does any persisted record reference `mediaId`?
 *
 * An empty (or blank) id is not an asset and never counts as a reference — the
 * same normalization the release funnel applies to the id it is asked to free.
 */
export function mediaStillReferenced(store: DemoStore, mediaId: string): boolean {
  const id = mediaId.trim();
  if (!id) return false;

  return (
    store.students.all().some((row) => row.photoMediaId === id) ||
    store.teachers.all().some((row) => row.photoMediaId === id) ||
    store.resources.all().some((row) => row.mediaId === id) ||
    store.learningContent.all().some((row) => row.mediaId === id) ||
    store.chatMessages.all().some((row) => row.mediaId === id) ||
    store.galleryImages.all().some((row) => row.mediaId === id) ||
    store.galleryAlbums.all().some((row) => row.coverMediaId === id) ||
    brandingReferences(store, id)
  );
}

/**
 * Branding is a singleton record rather than a collection, so it is read through
 * its own accessor. Both of its media fields are optional, and a cleared field is
 * stored as an empty string — which can never equal the non-empty id asked about.
 */
function brandingReferences(store: DemoStore, mediaId: string): boolean {
  const branding = store.branding.get();
  return branding.logoMediaId === mediaId || branding.faviconMediaId === mediaId;
}
