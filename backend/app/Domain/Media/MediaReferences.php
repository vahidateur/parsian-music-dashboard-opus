<?php

namespace App\Domain\Media;

use App\Models\Branding;
use App\Models\ChatMessage;
use App\Models\GalleryAlbum;
use App\Models\GalleryImage;
use App\Models\Instrument;
use App\Models\LearningContent;
use App\Models\Resource;
use App\Models\Student;
use App\Models\Teacher;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Collection;

/**
 * WHO STILL POINTS AT A STORED ASSET — the server side of the global parent
 * check, and the input to per-object authorization.
 *
 * THE OBLIGATION THIS FILE CARRIES
 * `src/domains/media/mediaReferences.ts` enumerates every persisted
 * `MediaAsset.id` reference in the product and says: "A new media-bearing
 * record type must be added here in the same change that introduces it." The
 * same obligation holds here, on the server, and it is the reason the list
 * below is explicit rather than derived: a reference that is not listed is a
 * reference the server cannot see, and an asset the server thinks is free
 * would be deleted while a record still points at it.
 *
 * THE PARENTS THAT EXIST TODAY
 *   students.photoMediaId          profile photo      (students.deferred JSON)
 *   teachers.photoMediaId          profile photo      (teachers.photo_media_id)
 *   resources.mediaId              library file       (resources.media_id)
 *   instruments.imageId            instrument image   (instruments.image_id)
 *   galleryImages.mediaId          gallery image      (gallery_images.media_id)
 *   galleryAlbums.coverMediaId     album cover        (gallery_albums.cover_media_id)
 *   chatMessages.mediaId           message attachment (chat_messages.media_id)
 *   learningContents.mediaId       teaching material  (learning_contents.media_id)
 *   branding.logoMediaId           academy logo       (branding.logo_media_id)
 *   branding.faviconMediaId        academy favicon    (branding.favicon_media_id)
 *
 * Every media-bearing record type the product persists is listed: when a new
 * one arrives, it must be added HERE in the same change.
 *
 * TENANT: every query goes through a model that carries the
 * `BelongsToOrganization` scope, so a reference in another organization is
 * never queried — not filtered out of a result, never queried at all.
 */
final class MediaReferences
{
    /**
     * The media ids referenced by students.
     *
     * The photo lives in `students.deferred` (a JSON column), and the id is
     * extracted in PHP rather than through a JSON path in the SELECT: the
     * path syntax works in WHERE on every driver, but the SELECT side of it
     * is not portable, and a portability bug in a privacy check is a bug in
     * the wrong place.
     *
     * @param  callable(\Illuminate\Database\Eloquent\Builder<Student>): \Illuminate\Database\Eloquent\Builder<Student>  $scope
     * @return Collection<int, string>
     */
    public function studentMediaIds(callable $scope): Collection
    {
        return $scope(Student::query())
            ->whereNotNull('deferred->photoMediaId')
            ->pluck('deferred')
            ->flatMap(function (mixed $deferred): array {
                if (! is_array($deferred)) {
                    return [];
                }
                $id = $deferred['photoMediaId'] ?? null;

                return is_string($id) && $id !== '' ? [$id] : [];
            })
            ->unique()
            ->values();
    }

    /**
     * The media ids referenced by teachers.
     *
     * @return Collection<int, string>
     */
    public function teacherMediaIds(): Collection
    {
        return Teacher::query()
            ->whereNotNull('photo_media_id')
            ->pluck('photo_media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->values();
    }

    /**
     * The media ids referenced by library resources.
     *
     * @return Collection<int, string>
     */
    public function resourceMediaIds(): Collection
    {
        return Resource::query()
            ->whereNotNull('media_id')
            ->pluck('media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->values();
    }

    /**
     * The media ids referenced by instruments.
     *
     * @return Collection<int, string>
     */
    public function instrumentMediaIds(): Collection
    {
        return Instrument::query()
            ->whereNotNull('image_id')
            ->pluck('image_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->values();
    }

    /**
     * The media ids referenced by learning content.
     *
     * @return Collection<int, string>
     */
    public function learningContentMediaIds(): Collection
    {
        return LearningContent::query()
            ->whereNotNull('media_id')
            ->pluck('media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->unique()
            ->values();
    }

    /**
     * The media ids referenced by academy branding (logo and favicon).
     *
     * Branding carries no tenant global scope (its key IS the organization),
     * so the caller's organization is filtered explicitly — a reference in
     * another organization is never queried.
     *
     * @return Collection<int, string>
     */
    public function brandingMediaIds(): Collection
    {
        return Branding::query()
            ->where('organization_id', app(TenantContext::class)->current())
            ->get(['logo_media_id', 'favicon_media_id'])
            ->flatMap(fn (Branding $row): array => [$row->logo_media_id, $row->favicon_media_id])
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->unique()
            ->values();
    }

    /**
     * The media ids referenced by chat message attachments.
     *
     * @return Collection<int, string>
     */
    public function chatMessageMediaIds(): Collection
    {
        return ChatMessage::query()
            ->whereNotNull('media_id')
            ->pluck('media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->unique()
            ->values();
    }

    /**
     * The media ids referenced by chat messages inside the given threads.
     *
     * @param  Collection<int, string>  $conversationIds
     * @return Collection<int, string>
     */
    public function chatMessageMediaIdsInConversations(Collection $conversationIds): Collection
    {
        if ($conversationIds->isEmpty()) {
            return collect();
        }

        return ChatMessage::query()
            ->whereIn('conversation_id', $conversationIds->all())
            ->whereNotNull('media_id')
            ->pluck('media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->unique()
            ->values();
    }

    /**
     * The media ids referenced by gallery images.
     *
     * @return Collection<int, string>
     */
    public function galleryImageMediaIds(): Collection
    {
        return GalleryImage::query()
            ->whereNotNull('media_id')
            ->pluck('media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->values();
    }

    /**
     * The media ids referenced by gallery album covers.
     *
     * @return Collection<int, string>
     */
    public function galleryCoverMediaIds(): Collection
    {
        return GalleryAlbum::query()
            ->whereNotNull('cover_media_id')
            ->pluck('cover_media_id')
            ->filter(fn (mixed $id): bool => is_string($id) && $id !== '')
            ->values();
    }

    /**
     * Every media id any record in this organization references.
     *
     * ORG-WIDE and unscoped: this is the LIFETIME answer ("is this asset
     * attached to something?"), not the access answer. An asset attached to a
     * student the caller cannot see is still attached, and treating it as free
     * would let one operator delete bytes another record still points at.
     *
     * @return Collection<int, string>
     */
    public function allReferencedMediaIds(): Collection
    {
        return Student::query()
            ->whereNotNull('deferred->photoMediaId')
            ->pluck('deferred')
            ->flatMap(function (mixed $deferred): array {
                if (! is_array($deferred)) {
                    return [];
                }
                $id = $deferred['photoMediaId'] ?? null;

                return is_string($id) && $id !== '' ? [$id] : [];
            })
            ->merge($this->teacherMediaIds())
            ->merge($this->resourceMediaIds())
            ->merge($this->instrumentMediaIds())
            ->merge($this->galleryImageMediaIds())
            ->merge($this->galleryCoverMediaIds())
            ->merge($this->chatMessageMediaIds())
            ->merge($this->learningContentMediaIds())
            ->merge($this->brandingMediaIds())
            ->unique()
            ->values();
    }

    /**
     * Does any record still reference this asset?
     *
     * The answer is "may the bytes be freed", NOT "who may read them" — the
     * two are different questions and this one is about lifetime, not access.
     *
     * It is deliberately ORG-WIDE and never scoped to the actor: an asset a
     * teacher cannot SEE may still be referenced by a student outside their
     * scope, and a scoped answer would let that teacher free bytes another
     * record still points at. Access is decided per object in
     * `MediaPolicy`; lifetime is decided here, globally.
     */
    public function isStillReferenced(string $mediaId): bool
    {
        $id = trim($mediaId);
        if ($id === '') {
            return false;
        }

        return Student::query()->where('deferred->photoMediaId', $id)->exists()
            || Teacher::query()->where('photo_media_id', $id)->exists()
            || Resource::query()->where('media_id', $id)->exists()
            || Instrument::query()->where('image_id', $id)->exists()
            || GalleryImage::query()->where('media_id', $id)->exists()
            || GalleryAlbum::query()->where('cover_media_id', $id)->exists()
            || ChatMessage::query()->where('media_id', $id)->exists()
            || LearningContent::query()->where('media_id', $id)->exists()
            || Branding::query()->where('organization_id', app(TenantContext::class)->current())->where(function ($query) use ($id) {
                $query->where('logo_media_id', $id)->orWhere('favicon_media_id', $id);
            })->exists();
    }
}
