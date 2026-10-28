<?php

namespace App\Domain\Library;

/**
 * Field limits and vocabularies for a library resource.
 *
 * Every bound here is a limit, not a product rule: the interesting semantics
 * (which teacher, which instrument, which students) live in the service, which
 * resolves them against the tenant's own rows.
 */
final class ResourceRules
{
    public const KINDS = ['sheet', 'audio', 'video', 'doc'];

    public const VISIBILITIES = ['students', 'teachers'];

    /** An absent `visibility` reads as `students` (matches the client). */
    public const DEFAULT_VISIBILITY = 'students';

    public const MAX_TITLE = 200;

    public const MIN_TITLE = 2;

    public const MAX_COMPOSER = 200;

    public const MAX_INSTRUMENT = 100;

    public const MAX_LEVEL = 100;

    public const MAX_MEDIA_ID = 100;

    public const MAX_PAGES = 100_000;

    public const MAX_DURATION_SECONDS = 86_400;

    public const MAX_PEAKS = 500;

    public const MAX_RESTRICTED_STUDENTS = 500;

    /** Sort keys the catalogue offers (spec: newest, most used, title). */
    public const SORTS = ['newest', 'most_used', 'title'];

    public const DEFAULT_SORT = 'newest';
}
