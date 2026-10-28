<?php

namespace App\Http\Resources;

use App\Domain\Library\ResourcePresenter;
use App\Models\Resource;

/**
 * Wire shape = TS `LibraryItem` (src/domains/library/types.ts).
 *
 * The five fields the apiRepository contract test pins — `title`, `kind`,
 * `instrument`, `level`, `size` — are always present. Optional values are
 * emitted as `null` rather than omitted, so the shape of a row does not depend
 * on which fields happened to be filled in.
 *
 * That distinction is load-bearing for `restrictedToStudentIds`: on the client
 * an absent value means "no restriction" while an empty array means "restricted
 * to nobody", and `studentCanAccess()` treats them differently. `null` (not
 * `[]`) is what carries "no restriction".
 */
final class ResourceResource
{
    /** @return array<string, mixed> */
    public static function toWire(Resource $resource): array
    {
        return [
            'id' => (string) $resource->id,
            'title' => (string) $resource->title,
            'composer' => (string) $resource->composer,
            // Provenance only — never an authorization input.
            'teacherId' => $resource->teacher_id,
            'kind' => (string) $resource->kind,
            'instrument' => (string) $resource->instrument,
            'level' => (string) $resource->level,

            // This slice stores metadata only, so the server holds no bytes and
            // every row reports the catalogue's "unknown size" marker. The
            // argument becomes the real byte count when the media domain lands.
            'size' => ResourcePresenter::sizeLabel(null),
            'duration' => ResourcePresenter::durationLabel($resource->duration_seconds),
            'pages' => $resource->pages,
            'mediaId' => $resource->media_id,
            'peaks' => $resource->peaks,

            'visibility' => (string) $resource->visibility,
            'restrictedToStudentIds' => $resource->restricted_student_ids,
            'active' => (bool) $resource->active,
            'uses' => (int) $resource->uses,

            // Persian relative label, derived from the real timestamp.
            'added' => ResourcePresenter::addedLabel($resource->created_at),
            // Millisecond precision, matching the dataset's own format.
            'createdAt' => $resource->created_at?->format('Y-m-d\\TH:i:s.v\\Z') ?? '',
        ];
    }
}
