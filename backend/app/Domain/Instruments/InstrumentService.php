<?php

namespace App\Domain\Instruments;

use App\Domain\Media\MediaReferences;
use App\Models\AcademyClass;
use App\Models\Instrument;
use App\Models\MediaAsset;
use App\Models\Piece;
use App\Models\Resource;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Instruments persistence and domain rules of the caller's organization.
 *
 * SLUG AS IDENTITY
 * The slug is the record's id and is immutable after creation — existing
 * students, teachers, classes, resources and pieces store `instrument:
 * "violin"`, and rewriting it would orphan every one of them. The service
 * refuses a slug change on update rather than silently ignoring it.
 *
 * UNIQUE PER ORGANIZATION
 * `(organization_id, slug)` and `(organization_id, name)` are unique. Two
 * organizations may both define `piano` or `santoor` without colliding.
 *
 * REFERENTIAL SAFETY
 * An instrument still referenced by teachers, students, classes or learning
 * programs cannot be deleted — the repository refuses with `INSTRUMENT_IN_USE`
 * and the panel surfaces the reason. Deactivation is the supported alternative.
 */
final class InstrumentService
{
    public function __construct(private readonly TenantContext $tenant) {}

    /**
     * @param  array<string, mixed>  $filters  search, activeOnly
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator<int, Instrument>
     */
    public function list(array $filters, int $page, int $perPage): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = Instrument::query();
        if (filled($filters['search'] ?? null)) {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('slug', 'like', $like)->orWhere('description', 'like', $like));
        }
        if (filter_var($filters['activeOnly'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('active', true);
        }

        return $query->orderBy('sort_order')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function get(string $id): Instrument
    {
        $instrument = Instrument::query()->whereKey($id)->first();
        if ($instrument === null) {
            throw ApiException::notFound('INSTRUMENT_NOT_FOUND', 'ساز یافت نشد.');
        }

        return $instrument;
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function create(array $input): Instrument
    {
        $slug = $this->validatedSlug((string) ($input['slug'] ?? ''), true);
        $name = trim((string) ($input['name'] ?? ''));

        if (strlen($name) < 2) {
            throw ApiException::validation('INSTRUMENT_INVALID', 'اطلاعات ساز معتبر نیست.', ['name' => ['نام ساز الزامی است.']]);
        }

        $this->assertNameFree($name, null);

        $imageId = $this->validatedImageId($input['imageId'] ?? null);

        $instrument = new Instrument;
        $instrument->id = $slug;
        $instrument->organization_id = $this->tenant->organizationId();
        $instrument->slug = $slug;
        $instrument->name = $name;
        $instrument->description = (string) ($input['description'] ?? '');
        $instrument->image_id = $imageId;
        $instrument->active = (bool) ($input['active'] ?? true);
        $instrument->sort_order = (int) ($input['sortOrder'] ?? $this->nextSortOrder());

        try {
            $instrument->save();
        } catch (UniqueConstraintViolationException) {
            throw ApiException::conflict('INSTRUMENT_SLUG_TAKEN', 'سازی با این شناسهٔ فنی وجود دارد.', ['slug' => ['تکراری است']]);
        }

        return $instrument->refresh();
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function update(Instrument $instrument, array $input): Instrument
    {
        // Slug is immutable identity.
        if (array_key_exists('slug', $input) && (string) $input['slug'] !== $instrument->slug) {
            throw ApiException::validation('INSTRUMENT_INVALID', 'شناسهٔ فنی ساز پس از ایجاد قابل تغییر نیست.', ['slug' => ['قابل تغییر نیست']]);
        }

        if (array_key_exists('name', $input)) {
            $name = trim((string) $input['name']);
            if (strlen($name) < 2) {
                throw ApiException::validation('INSTRUMENT_INVALID', 'اطلاعات ساز معتبر نیست.', ['name' => ['نام ساز الزامی است.']]);
            }
            $this->assertNameFree($name, $instrument->id);
            $instrument->name = $name;
        }
        if (array_key_exists('description', $input)) {
            $instrument->description = (string) $input['description'];
        }
        if (array_key_exists('imageId', $input)) {
            $instrument->image_id = $this->validatedImageId($input['imageId']);
        }
        if (array_key_exists('active', $input)) {
            $instrument->active = (bool) $input['active'];
        }
        if (array_key_exists('sortOrder', $input)) {
            $instrument->sort_order = (int) $input['sortOrder'];
        }

        try {
            $instrument->save();
        } catch (UniqueConstraintViolationException) {
            throw ApiException::conflict('INSTRUMENT_NAME_TAKEN', 'سازی با این نام وجود دارد.', ['name' => ['تکراری است']]);
        }

        return $instrument->refresh();
    }

    public function setActive(Instrument $instrument, bool $active): Instrument
    {
        $instrument->active = $active;

        return $instrument->save() ? $instrument->refresh() : $instrument;
    }

    public function delete(Instrument $instrument): void
    {
        $blocker = $this->findReference($instrument->id);
        if ($blocker !== null) {
            throw ApiException::conflict(
                'INSTRUMENT_IN_USE',
                "این ساز در {$blocker} استفاده شده است؛ به‌جای حذف، آن را غیرفعال کنید.",
            );
        }

        $instrument->delete();
    }

    /** @return array<string, mixed> */
    public static function toWire(Instrument $instrument): array
    {
        $wire = [
            'id' => $instrument->id,
            'slug' => $instrument->slug,
            'name' => $instrument->name,
            'description' => $instrument->description,
            'active' => $instrument->active,
            'sortOrder' => $instrument->sort_order,
        ];
        if ($instrument->image_id !== null && $instrument->image_id !== '') {
            $wire['imageId'] = $instrument->image_id;
        }

        return $wire;
    }

    private function validatedSlug(string $slug, bool $create): string
    {
        $slug = trim($slug);
        if ($create && ! preg_match('/^[a-z][a-z0-9_-]{1,30}$/', $slug)) {
            throw ApiException::validation('INSTRUMENT_INVALID', 'اطلاعات ساز معتبر نیست.', [
                'slug' => ['شناسهٔ فنی باید با حرف انگلیسی شروع شود و فقط شامل حروف کوچک، عدد، خط تیره و زیرخط باشد.'],
            ]);
        }

        return $slug !== '' ? $slug : throw ApiException::validation('INSTRUMENT_INVALID', 'اطلاعات ساز معتبر نیست.', [
            'slug' => ['شناسهٔ فنی الزامی است.'],
        ]);
    }

    private function assertNameFree(string $name, ?string $exceptId): void
    {
        $taken = Instrument::query()
            ->where('name', $name)
            ->when($exceptId !== null, fn (Builder $q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($taken) {
            throw ApiException::conflict('INSTRUMENT_NAME_TAKEN', 'سازی با این نام وجود دارد.', ['name' => ['تکراری است']]);
        }
    }

    /** Returns a Persian description of the first thing still using this instrument, or null. */
    private function findReference(string $id): ?string
    {
        // The learning domain is not served yet, so its table may not exist.
        // If it does not, there is nothing to scan. The same guard exists on
        // the client side in src/domains/media/mediaReferences.ts (learning
        // content is listed there as a future parent), and both sides grow
        // the scan in the same commit that introduces the table.
        if (Schema::hasTable('learning_programs') && DB::table('learning_programs')->where('instrument_id', $id)->exists()) {
            return 'برنامه‌های آموزشی';
        }
        if (Teacher::query()->where('instrument', $id)->exists()) {
            return 'پروندهٔ مدرسان';
        }
        if (Student::query()->where('instrument', $id)->exists()) {
            return 'پروندهٔ هنرجویان';
        }
        if (AcademyClass::query()->where('instrument', $id)->exists()) {
            return 'کلاس‌ها';
        }
        if (Resource::query()->where('instrument', $id)->exists()) {
            return 'منابع کتابخانه';
        }
        if (Piece::query()->where('instrument_id', $id)->exists()) {
            return 'قطعات';
        }

        return null;
    }

    private function nextSortOrder(): int
    {
        return (int) Instrument::query()->max('sort_order') + 1;
    }

    /**
     * Verifies the image references a real asset in this organization.
     *
     * A cleared field travels as null or '' and never fails — no image means
     * "no image", not "an image that is missing".
     */
    private function validatedImageId(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value)) {
            throw ApiException::validation('INSTRUMENT_INVALID', 'اطلاعات ساز معتبر نیست.', [
                'imageId' => ['شناسهٔ فایل نامعتبر است.'],
            ]);
        }
        $id = trim($value);
        if (! MediaAsset::query()->whereKey($id)->exists()) {
            throw ApiException::validation('INSTRUMENT_INVALID', 'اطلاعات ساز معتبر نیست.', [
                'imageId' => ['فایل انتخاب‌شده یافت نشد.'],
            ]);
        }

        return $id;
    }
}
