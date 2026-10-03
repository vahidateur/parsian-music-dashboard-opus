<?php

namespace App\Domain\Library;

use App\Models\Resource;
use App\Models\Teacher;
use App\Support\Api\ApiException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Library resource persistence.
 *
 * TENANT ISOLATION — every query goes through `Resource`, which uses the
 * `BelongsToOrganization` global scope: reads are constrained to the current
 * TenantContext organization, and with no resolved tenant the scope matches
 * NOTHING (fail closed). New rows take `organization_id` from the context —
 * request input never supplies one. Another organization's resource is not
 * merely filtered out of the result, it is never queried.
 *
 * This service carries no actor and makes no authorization decision; that
 * lives in `ResourcePolicy`, which the controller calls first.
 */
final class ResourceService
{
    /** camelCase wire key → snake_case column. `uses`, `size`, `duration`, `added` are absent by design. */
    private const COLUMN_MAP = [
        'title' => 'title',
        'composer' => 'composer',
        'teacherId' => 'teacher_id',
        'kind' => 'kind',
        'instrument' => 'instrument',
        'level' => 'level',
        'mediaId' => 'media_id',
        'pages' => 'pages',
        'durationSeconds' => 'duration_seconds',
        'peaks' => 'peaks',
        'visibility' => 'visibility',
        'restrictedToStudentIds' => 'restricted_student_ids',
        'active' => 'active',
    ];

    /**
     * @param  array<string, mixed>  $filters  validated query (search, kind, instrument, level, visibility)
     */
    public function paginate(array $filters, int $page, int $perPage, ?string $sort): LengthAwarePaginator
    {
        $sort = in_array($sort, ResourceRules::SORTS, true) ? $sort : ResourceRules::DEFAULT_SORT;

        return Resource::query()
            ->when(filled($filters['kind'] ?? null), fn (Builder $q): Builder => $q->where('kind', $filters['kind']))
            ->when(filled($filters['instrument'] ?? null), fn (Builder $q): Builder => $q->where('instrument', $filters['instrument']))
            ->when(filled($filters['level'] ?? null), fn (Builder $q): Builder => $q->where('level', $filters['level']))
            ->when(filled($filters['visibility'] ?? null), fn (Builder $q): Builder => $q->where('visibility', $filters['visibility']))
            ->when(filled($filters['search'] ?? null), fn (Builder $q): Builder => $this->applySearch($q, (string) $filters['search']))
            ->tap(fn (Builder $q): Builder => $this->applySort($q, $sort))
            ->paginate(perPage: $perPage, page: $page);
    }

    public function findOrFail(string $id): Resource
    {
        $resource = Resource::query()->whereKey($id)->first();

        if ($resource === null) {
            throw ApiException::notFound('RESOURCE_NOT_FOUND', 'منبع یافت نشد.');
        }

        return $resource;
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function create(array $input): Resource
    {
        $attributes = $this->attributes($input);

        // A brand-new row has never been downloaded. The count only grows on a
        // download, which is a separate endpoint and outside this slice.
        $attributes['uses'] = 0;

        return DB::transaction(function () use ($attributes): Resource {
            return Resource::query()->create($attributes)->refresh();
        });
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function update(Resource $resource, array $input): Resource
    {
        $attributes = $this->attributes($input);

        return DB::transaction(function () use ($resource, $attributes): Resource {
            // Re-read inside the transaction so two operators cannot each write
            // a half of a change and leave the row inconsistent.
            $fresh = Resource::query()->whereKey($resource->id)->lockForUpdate()->first() ?? $resource;
            $fresh->fill($attributes)->save();

            return $fresh->refresh();
        });
    }

    public function delete(Resource $resource): void
    {
        DB::transaction(function () use ($resource): void {
            $resource->delete();
        });
    }

    /**
     * Search matches title, composer, level, and the CONTRIBUTING TEACHER'S
     * NAME — resolved through `teacher_id`.
     *
     * The composer is deliberately NOT searched as a teacher proxy: in the
     * client contract `composer` and `teacherId` are independent fields, so
     * typing a teacher's name must not surface every piece they composed under
     * another attribution.
     */
    private function applySearch(Builder $query, string $term): Builder
    {
        $like = '%'.$term.'%';
        $teacherIds = Teacher::query()->where('name', 'like', $like)->pluck('id');

        return $query->where(function (Builder $inner) use ($like, $teacherIds): void {
            $inner->where('title', 'like', $like)
                ->orWhere('composer', 'like', $like)
                ->orWhere('level', 'like', $like)
                ->orWhereIn('teacher_id', $teacherIds);
        });
    }

    private function applySort(Builder $query, string $sort): Builder
    {
        return match ($sort) {
            'title' => $query->orderBy('title')->orderBy('id'),
            'most_used' => $query->orderByDesc('uses')->orderByDesc('created_at')->orderByDesc('id'),
            default => $query->orderByDesc('created_at')->orderByDesc('id'),
        };
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function attributes(array $input): array
    {
        $attributes = [];

        foreach (self::COLUMN_MAP as $wireKey => $column) {
            if (array_key_exists($wireKey, $input)) {
                $attributes[$column] = $input[$wireKey];
            }
        }

        // The client contract uses `""` for "no contributing teacher"; the
        // column is nullable, so normalize it here.
        if (array_key_exists('teacherId', $input) && $input['teacherId'] === '') {
            $attributes['teacher_id'] = null;
        }

        return $attributes;
    }
}
