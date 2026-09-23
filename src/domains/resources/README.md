# Canonical resources

This domain owns the vocabulary that crosses the catalogue, curriculum,
repertoire and media boundaries. It does **not** replace those domain owners.

## Identity

- `ResourceId` identifies the logical academy material.
- `MediaId` identifies a binary object and must never be used as a resource id.
- A Library row currently uses its `LibraryItem.id` as the canonical resource id.
- A Learning row keeps its curriculum-owned `LearningContent.id` and carries
  `resourceId` for the shared logical material.
- Seeded Learning rows are derived from the same Library rows, including the
  available `mediaId` link. Legacy rows are normalized at repository boundaries.
- `Piece.contentIds` retains its existing field name for compatibility, but its
  values now mean canonical Resource IDs, not Learning Content projection IDs
  and not Media IDs.

This preserves the settled separation between catalogue metadata and curriculum
eligibility while removing the silent identity mismatch between them.

`ResourceAssociation` is the future typed edge for ownership, upload provenance,
attachments, assignments, eligibility, and visibility across repertoire,
courses, classes, students, messages, and Gallery events. `ResourceProjection`
also carries optional owner/uploader and audit actors. These are contracts only:
existing domain aggregates remain the owners of persisted rows until an API can
provide the relation with tenant and authorization checks.

## Access

`evaluateResourceAccess()` is the frontend policy boundary for lifecycle,
audience, selected-student restrictions, and the already-derived curriculum
eligibility result. Library access and Learning eligibility both use this policy
for their final visibility decision.

It is UX policy only. A production server must re-evaluate the actor, permission,
resource scope, student relationship, eligibility, and media-download decision
for every request.

## Storage boundary

`src/domains/media/storage.ts` defines the vendor-neutral production storage
contract: upload initialization/completion/abort, authorized URLs, replacement,
checksum lookup/deduplication, deletion, orphan cleanup, retention, usage and
quota reporting, backup, and restore. `src/domains/media/storageEstimate.ts`
provides a transparent planning calculation from explicit assumptions; it is
not a usage meter or quota implementation. The current Demo Media repository
remains the only local adapter. No object-storage vendor or archive service is
claimed, and no API-mode registry entry is added until a backend can satisfy the
contract.

## Intentionally not implemented here

- A new merged `resources` persistence table.
- Course/class resource packs.
- Message resource picking/sharing.
- Gallery event/participant/consent persistence.
- OCR or extracted document search.
- A working signed-URL, streaming, transcoding, scanning, deduplication,
  quota, retention, backup, or restore service.

The interface is a contract only. Those behaviors require backend/domain
implementations and object-level authorization. Adding a frontend-only version
would create fake production behavior.
