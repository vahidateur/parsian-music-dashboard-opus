<?php

namespace App\Domain\Learning;

use App\Models\Instrument;
use App\Models\LearningContent;
use App\Models\LearningLevel;
use App\Models\LearningProgram;
use App\Models\LevelContentLink;
use App\Models\MediaAsset;
use App\Models\Student;
use App\Models\StudentPlacement;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Iso;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Learning persistence and domain rules of the caller's organization.
 *
 * ONE repository for the whole aggregate (mirroring
 * `src/domains/learning/repository.ts`): programs, levels, links and
 * placements are not independently meaningful, so the invariants live here in
 * one place instead of being split across services that must agree:
 *
 *   - a program belongs to an existing instrument;
 *   - level `order` is 1-based, contiguous and unique within its program
 *     (renumbered transactionally on insert, move and delete);
 *   - a program with placed students or levels cannot be deleted;
 *   - a level with linked content or placed students cannot be deleted;
 *   - attaching content twice to the same level is a conflict, not a copy;
 *   - a placement's level must belong to the placement's program;
 *   - one active placement per student (re-placing moves the row and appends
 *     history; re-assigning the same level is a no-op);
 *   - eligibility is COMPUTED at read time, never stored.
 *
 * This service carries no actor and makes no authorization decision; that
 * lives in `LearningPolicy`, which the controller calls first.
 */
final class LearningService
{
    public function __construct(private readonly TenantContext $tenant) {}

    /**
     * Staging lane for two-phase renumbering (see assignOrders): far above
     * any real ladder, safely inside the unsigned int range.
     */
    private const ORDER_STAGING = 100000;

    /* ------------------------------------------------------------ programs */

    /**
     * @param  array<string, mixed>  $filters  search, instrumentId, activeOnly
     */
    public function listPrograms(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return LearningProgram::query()
            ->when(filled($filters['instrumentId'] ?? null), fn (Builder $q): Builder => $q->where('instrument_id', $filters['instrumentId']))
            ->when(filter_var($filters['activeOnly'] ?? false, FILTER_VALIDATE_BOOLEAN), fn (Builder $q): Builder => $q->where('active', true))
            ->when(filled($filters['search'] ?? null), function (Builder $q) use ($filters): Builder {
                $like = '%'.trim((string) $filters['search']).'%';

                return $q->where(fn (Builder $qq): Builder => $qq->where('name', 'like', $like)->orWhere('description', 'like', $like));
            })
            ->orderBy('created_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getProgram(string $id): LearningProgram
    {
        $program = LearningProgram::query()->whereKey($id)->first();
        if ($program === null) {
            throw ApiException::notFound('PROGRAM_NOT_FOUND', 'برنامهٔ آموزشی یافت نشد.');
        }

        return $program;
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function createProgram(array $input): LearningProgram
    {
        $name = trim((string) ($input['name'] ?? ''));
        if (strlen($name) < 2) {
            throw ApiException::validation('PROGRAM_INVALID', 'اطلاعات برنامه معتبر نیست.', ['name' => ['نام برنامه الزامی است.']]);
        }
        $this->assertInstrumentExists((string) ($input['instrumentId'] ?? ''));

        $program = new LearningProgram;
        $program->id = 'pg_'.strtolower((string) Str::ulid());
        $program->organization_id = $this->tenant->organizationId();
        $program->instrument_id = (string) $input['instrumentId'];
        $program->name = $name;
        $program->description = (string) ($input['description'] ?? '');
        $program->active = (bool) ($input['active'] ?? true);
        $program->save();

        return $program->refresh();
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function updateProgram(LearningProgram $program, array $input): LearningProgram
    {
        if (array_key_exists('name', $input)) {
            $name = trim((string) $input['name']);
            if (strlen($name) < 2) {
                throw ApiException::validation('PROGRAM_INVALID', 'اطلاعات برنامه معتبر نیست.', ['name' => ['نام برنامه الزامی است.']]);
            }
            $program->name = $name;
        }
        if (array_key_exists('instrumentId', $input)) {
            $this->assertInstrumentExists((string) $input['instrumentId']);
            $program->instrument_id = (string) $input['instrumentId'];
        }
        if (array_key_exists('description', $input)) {
            $program->description = (string) $input['description'];
        }
        if (array_key_exists('active', $input)) {
            $program->active = (bool) $input['active'];
        }
        $program->save();

        return $program->refresh();
    }

    public function deleteProgram(LearningProgram $program): void
    {
        if (StudentPlacement::query()->where('program_id', $program->id)->exists()) {
            throw ApiException::conflict('PROGRAM_HAS_STUDENTS', 'هنرجویانی در این برنامه سطح‌بندی شده‌اند؛ ابتدا آن‌ها را منتقل کنید.');
        }
        if (LearningLevel::query()->where('program_id', $program->id)->exists()) {
            throw ApiException::conflict('PROGRAM_HAS_LEVELS', 'ابتدا سطوح این برنامه را حذف کنید.');
        }
        $program->delete();
    }

    /* -------------------------------------------------------------- levels */

    /**
     * @param  array<string, mixed>  $filters  programId, activeOnly
     */
    public function listLevels(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return LearningLevel::query()
            ->when(filled($filters['programId'] ?? null), fn (Builder $q): Builder => $q->where('program_id', $filters['programId']))
            ->when(filter_var($filters['activeOnly'] ?? false, FILTER_VALIDATE_BOOLEAN), fn (Builder $q): Builder => $q->where('active', true))
            ->orderBy('order')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getLevel(string $id): LearningLevel
    {
        $level = LearningLevel::query()->whereKey($id)->first();
        if ($level === null) {
            throw ApiException::notFound('LEVEL_NOT_FOUND', 'سطح یافت نشد.');
        }

        return $level;
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function createLevel(array $input): LearningLevel
    {
        $program = $this->getProgram((string) ($input['programId'] ?? ''));
        $name = trim((string) ($input['name'] ?? ''));
        if (strlen($name) < 1) {
            throw ApiException::validation('LEVEL_INVALID', 'اطلاعات سطح معتبر نیست.', ['name' => ['نام سطح الزامی است.']]);
        }

        return DB::transaction(function () use ($program, $input, $name): LearningLevel {
            $siblings = $this->siblings($program->id, true);
            $order = isset($input['order']) ? (int) $input['order'] : count($siblings) + 1;
            if ($order < 1 || $order > count($siblings) + 1) {
                throw ApiException::validation('LEVEL_INVALID', 'ترتیب سطح معتبر نیست.', ['order' => ['خارج از محدوده است']]);
            }

            // Append first (count + 1 is always free inside the locked
            // transaction), then move into position through the shared
            // two-phase renumber — inserting directly at the target order
            // would collide with the row already holding it.
            $level = new LearningLevel;
            $level->id = 'lv_'.strtolower((string) Str::ulid());
            $level->organization_id = $this->tenant->organizationId();
            $level->program_id = $program->id;
            $level->order = count($siblings) + 1;
            $level->name = $name;
            $level->description = (string) ($input['description'] ?? '');
            $level->objectives = $this->stringList($input['objectives'] ?? [], 'objectives');
            $level->notes = isset($input['notes']) ? (string) $input['notes'] : null;
            $level->active = (bool) ($input['active'] ?? true);
            $level->exclusive = (bool) ($input['exclusive'] ?? false);
            $level->prerequisite_level_ids = $this->validatedPrerequisites($program->id, $input['prerequisiteLevelIds'] ?? [], null);
            $level->save();

            // Renumber the whole ladder through the same two-phase routine the
            // move and delete paths use, so the unique (program, order) key can
            // never observe a duplicate mid-shift.
            $this->renumber($program->id, $level->id, $order);

            return $this->getLevel($level->id);
        });
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function updateLevel(LearningLevel $level, array $input): LearningLevel
    {
        // Order changes go through reorderLevel, which keeps siblings
        // contiguous — silently applying one here would open a gap.
        if (array_key_exists('name', $input)) {
            $name = trim((string) $input['name']);
            if (strlen($name) < 1) {
                throw ApiException::validation('LEVEL_INVALID', 'اطلاعات سطح معتبر نیست.', ['name' => ['نام سطح الزامی است.']]);
            }
            $level->name = $name;
        }
        if (array_key_exists('description', $input)) {
            $level->description = (string) $input['description'];
        }
        if (array_key_exists('objectives', $input)) {
            $level->objectives = $this->stringList($input['objectives'], 'objectives');
        }
        if (array_key_exists('notes', $input)) {
            $level->notes = $input['notes'] === null || $input['notes'] === '' ? null : (string) $input['notes'];
        }
        if (array_key_exists('active', $input)) {
            $level->active = (bool) $input['active'];
        }
        if (array_key_exists('exclusive', $input)) {
            $level->exclusive = (bool) $input['exclusive'];
        }
        if (array_key_exists('prerequisiteLevelIds', $input)) {
            $level->prerequisite_level_ids = $this->validatedPrerequisites($level->program_id, $input['prerequisiteLevelIds'], $level->id);
        }
        $level->save();

        return $level->refresh();
    }

    public function reorderLevel(LearningLevel $level, int $newOrder): LearningLevel
    {
        return DB::transaction(function () use ($level, $newOrder): LearningLevel {
            $siblings = $this->siblings($level->program_id, true);
            if ($newOrder < 1 || $newOrder > count($siblings)) {
                throw ApiException::validation('LEVEL_INVALID', 'ترتیب سطح معتبر نیست.', ['order' => ['خارج از محدوده است']]);
            }

            $without = array_values(array_filter($siblings, fn (LearningLevel $s): bool => $s->id !== $level->id));
            array_splice($without, $newOrder - 1, 0, [$level]);
            $this->assignOrders(array_map(fn (LearningLevel $s): string => $s->id, $without));

            return $this->getLevel($level->id);
        });
    }

    public function deleteLevel(LearningLevel $level): void
    {
        if (LevelContentLink::query()->where('level_id', $level->id)->exists()) {
            throw ApiException::conflict('LEVEL_HAS_CONTENT', 'ابتدا محتوای متصل به این سطح را جدا کنید.');
        }
        if (StudentPlacement::query()->where('level_id', $level->id)->exists()) {
            throw ApiException::conflict('LEVEL_HAS_STUDENTS', 'هنرجویانی در این سطح هستند؛ ابتدا سطح آن‌ها را تغییر دهید.');
        }

        DB::transaction(function () use ($level): void {
            $programId = $level->program_id;
            $level->delete();

            $remaining = $this->siblings($programId, true);
            $this->assignOrders(array_map(fn (LearningLevel $s): string => $s->id, $remaining));
        });
    }

    /**
     * Writes 1..N over the given ids, in order, through staged values first:
     * the unique (organization, program, order) key never observes a duplicate
     * mid-shift, in either driver. The staging lane sits far above any real
     * ladder — `order` is unsigned, so negatives would overflow MySQL.
     *
     * @param  list<string>  $orderedIds
     */
    private function assignOrders(array $orderedIds): void
    {
        foreach ($orderedIds as $index => $id) {
            LearningLevel::query()->whereKey($id)->update(['order' => $index + 1 + self::ORDER_STAGING]);
        }
        foreach ($orderedIds as $index => $id) {
            LearningLevel::query()->whereKey($id)->update(['order' => $index + 1]);
        }
    }

    /**
     * Moves one row to a position and renumbers the ladder around it, through
     * the shared two-phase routine (see assignOrders).
     */
    private function renumber(string $programId, string $movedId, int $position): void
    {
        $siblings = $this->siblings($programId, true);
        $without = array_values(array_filter($siblings, fn (LearningLevel $s): bool => $s->id !== $movedId));
        array_splice($without, max(0, min($position - 1, count($without))), 0,
            array_values(array_filter($siblings, fn (LearningLevel $s): bool => $s->id === $movedId)));
        $this->assignOrders(array_map(fn (LearningLevel $s): string => $s->id, $without));
    }

    /**
     * @return list<LearningLevel>
     */
    private function siblings(string $programId, bool $locked): array
    {
        $query = LearningLevel::query()->where('program_id', $programId)->orderBy('order');
        if ($locked) {
            $query->lockForUpdate();
        }

        return $query->get()->all();
    }

    /* ------------------------------------------------------------- content */

    /**
     * @param  array<string, mixed>  $filters  type, activeOnly, search, levelId
     */
    public function listContent(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = LearningContent::query();
        if (filled($filters['levelId'] ?? null)) {
            $allowed = LevelContentLink::query()->where('level_id', $filters['levelId'])->pluck('content_id')->all();
            $query->whereIn('id', $allowed);
        }

        return $query
            ->when(filled($filters['type'] ?? null), fn (Builder $q): Builder => $q->where('type', $filters['type']))
            ->when(filter_var($filters['activeOnly'] ?? false, FILTER_VALIDATE_BOOLEAN), fn (Builder $q): Builder => $q->where('active', true))
            ->when(filled($filters['search'] ?? null), function (Builder $q) use ($filters): Builder {
                $like = '%'.trim((string) $filters['search']).'%';

                return $q->where(fn (Builder $qq): Builder => $qq->where('title', 'like', $like)->orWhere('description', 'like', $like)->orWhere('author', 'like', $like));
            })
            ->orderBy('created_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getContent(string $id): LearningContent
    {
        $content = LearningContent::query()->whereKey($id)->first();
        if ($content === null) {
            throw ApiException::notFound('CONTENT_NOT_FOUND', 'محتوا یافت نشد.');
        }

        return $content;
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function createContent(array $input): LearningContent
    {
        if (strlen(trim((string) ($input['title'] ?? ''))) < 2) {
            throw ApiException::validation('CONTENT_INVALID', 'اطلاعات محتوا معتبر نیست.', ['title' => ['عنوان الزامی است.']]);
        }
        $mediaId = $this->validatedMediaId($input['mediaId'] ?? null);

        $content = new LearningContent;
        $content->id = 'lc_'.strtolower((string) Str::ulid());
        $content->organization_id = $this->tenant->organizationId();
        $content->title = trim((string) $input['title']);
        $content->description = (string) ($input['description'] ?? '');
        $content->type = (string) $input['type'];
        $content->media_id = $mediaId;
        $content->author = isset($input['author']) && $input['author'] !== '' ? (string) $input['author'] : null;
        $content->teacher_id = isset($input['teacherId']) && $input['teacherId'] !== '' ? (string) $input['teacherId'] : null;
        $content->instrument_id = isset($input['instrumentId']) && $input['instrumentId'] !== '' ? (string) $input['instrumentId'] : null;
        $content->visibility = (string) ($input['visibility'] ?? 'students');
        $content->active = (bool) ($input['active'] ?? true);
        $content->save();

        return $content->refresh();
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function updateContent(LearningContent $content, array $input): LearningContent
    {
        if (array_key_exists('title', $input)) {
            if (strlen(trim((string) $input['title'])) < 2) {
                throw ApiException::validation('CONTENT_INVALID', 'اطلاعات محتوا معتبر نیست.', ['title' => ['عنوان الزامی است.']]);
            }
            $content->title = trim((string) $input['title']);
        }
        if (array_key_exists('description', $input)) {
            $content->description = (string) $input['description'];
        }
        if (array_key_exists('type', $input)) {
            $content->type = (string) $input['type'];
        }
        if (array_key_exists('mediaId', $input)) {
            $content->media_id = $this->validatedMediaId($input['mediaId']);
        }
        if (array_key_exists('author', $input)) {
            $content->author = $input['author'] === null || $input['author'] === '' ? null : (string) $input['author'];
        }
        if (array_key_exists('teacherId', $input)) {
            $content->teacher_id = $input['teacherId'] === null || $input['teacherId'] === '' ? null : (string) $input['teacherId'];
        }
        if (array_key_exists('instrumentId', $input)) {
            $content->instrument_id = $input['instrumentId'] === null || $input['instrumentId'] === '' ? null : (string) $input['instrumentId'];
        }
        if (array_key_exists('visibility', $input)) {
            $content->visibility = (string) $input['visibility'];
        }
        if (array_key_exists('active', $input)) {
            $content->active = (bool) $input['active'];
        }
        $content->save();

        return $content->refresh();
    }

    public function deleteContent(LearningContent $content): void
    {
        DB::transaction(function () use ($content): void {
            // Links are owned by the content, so removing it detaches cleanly
            // rather than leaving orphan rows that would break eligibility.
            LevelContentLink::query()->where('content_id', $content->id)->delete();
            $content->delete();
        });
    }

    /* --------------------------------------------------------------- links */

    /** @return list<LearningContentLink> */
    public function listLinks(?string $levelId): array
    {
        return LevelContentLink::query()
            ->when($levelId !== null && $levelId !== '', fn (Builder $q): Builder => $q->where('level_id', $levelId))
            ->orderBy('sort_order')->orderBy('id')
            ->get()->all();
    }

    public function attachContent(string $levelId, string $contentId, string $programId): LevelContentLink
    {
        $level = $this->getLevel($levelId);
        $this->getContent($contentId);
        $this->getProgram($programId);

        // I13 Checkpoint 2: the caller states which program it resolved this
        // level from, so a row left over from another query cannot become a
        // write into a ladder nobody is looking at. Checked BEFORE the
        // duplicate check: refusing a write the caller did not mean outranks
        // reporting that it already happened.
        if ($level->program_id !== $programId) {
            throw ApiException::validation('LINK_INVALID', 'سطح انتخاب‌شده به این برنامه تعلق ندارد.', [
                'levelId' => ['با برنامه هم‌خوان نیست'],
            ]);
        }

        $existing = LevelContentLink::query()
            ->where('level_id', $levelId)
            ->where('content_id', $contentId)
            ->first();
        if ($existing !== null) {
            throw ApiException::conflict('CONTENT_ALREADY_LINKED', 'این محتوا از قبل به این سطح متصل است.');
        }

        return DB::transaction(function () use ($levelId, $contentId): LevelContentLink {
            $link = new LevelContentLink;
            $link->id = 'lnk_'.strtolower((string) Str::ulid());
            $link->organization_id = $this->tenant->organizationId();
            $link->level_id = $levelId;
            $link->content_id = $contentId;
            $link->sort_order = LevelContentLink::query()->where('level_id', $levelId)->lockForUpdate()->count();
            $link->save();

            return $link->refresh();
        });
    }

    public function detachContent(string $levelId, string $contentId): void
    {
        $link = LevelContentLink::query()
            ->where('level_id', $levelId)
            ->where('content_id', $contentId)
            ->first();
        if ($link === null) {
            throw ApiException::notFound('LINK_NOT_FOUND', 'این محتوا به این سطح متصل نیست.');
        }
        $link->delete();
    }

    /* ---------------------------------------------------------- placements */

    /**
     * @param  array<string, mixed>  $filters  studentId, programId, levelId
     */
    public function listPlacements(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return StudentPlacement::query()
            ->when(filled($filters['studentId'] ?? null), fn (Builder $q): Builder => $q->where('student_id', $filters['studentId']))
            ->when(filled($filters['programId'] ?? null), fn (Builder $q): Builder => $q->where('program_id', $filters['programId']))
            ->when(filled($filters['levelId'] ?? null), fn (Builder $q): Builder => $q->where('level_id', $filters['levelId']))
            ->orderBy('created_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getStudentPlacement(string $studentId): ?StudentPlacement
    {
        return StudentPlacement::query()->where('student_id', $studentId)->first();
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function assignPlacement(array $input): StudentPlacement
    {
        return DB::transaction(function () use ($input): StudentPlacement {
            $studentId = (string) ($input['studentId'] ?? '');
            $programId = (string) ($input['programId'] ?? '');
            $levelId = (string) ($input['levelId'] ?? '');

            $student = Student::query()->whereKey($studentId)->first();
            if ($student === null) {
                throw ApiException::validation('PLACEMENT_INVALID', 'هنرجو یافت نشد.', ['studentId' => ['نامعتبر است']]);
            }
            $level = $this->getLevel($levelId);
            $this->getProgram($programId);

            // A level from another program would silently break eligibility,
            // which reads levels through the placement's program.
            if ($level->program_id !== $programId) {
                throw ApiException::validation('PLACEMENT_INVALID', 'سطح انتخاب‌شده به این برنامه تعلق ندارد.', [
                    'levelId' => ['با برنامه هم‌خوان نیست'],
                ]);
            }
            if (! $level->active) {
                throw ApiException::validation('PLACEMENT_INVALID', 'سطح غیرفعال قابل تخصیص نیست.', ['levelId' => ['غیرفعال است']]);
            }

            $now = now();
            $existing = StudentPlacement::query()->where('student_id', $studentId)->lockForUpdate()->first();

            if ($existing === null) {
                $placement = new StudentPlacement;
                $placement->id = 'plc_'.strtolower((string) Str::ulid());
                $placement->organization_id = $this->tenant->organizationId();
                $placement->student_id = $studentId;
                $placement->program_id = $programId;
                $placement->level_id = $levelId;
                $placement->assigned_at = isset($input['effectiveDate']) && $input['effectiveDate'] !== '' ? $input['effectiveDate'] : $now;
                $placement->history = [];
                $placement->save();

                return $placement->refresh();
            }

            // Re-assigning the same level is a no-op rather than a bogus history entry.
            if ($existing->level_id === $levelId && $existing->program_id === $programId) {
                return $existing;
            }

            $history = $existing->history ?? [];
            $entry = [
                'levelId' => $existing->level_id,
                'toLevelId' => $levelId,
                'programId' => $programId,
                'changedAt' => Iso::format($now),
            ];
            if (isset($input['effectiveDate']) && $input['effectiveDate'] !== '') {
                $entry['effectiveDate'] = (string) $input['effectiveDate'];
            }
            if (isset($input['note']) && trim((string) $input['note']) !== '') {
                $entry['note'] = trim((string) $input['note']);
            }
            $history[] = $entry;

            $existing->program_id = $programId;
            $existing->level_id = $levelId;
            $existing->assigned_at = isset($input['effectiveDate']) && $input['effectiveDate'] !== '' ? $input['effectiveDate'] : $now;
            $existing->history = $history;
            $existing->save();

            return $existing->refresh();
        });
    }

    public function removePlacement(string $studentId): void
    {
        $existing = $this->getStudentPlacement($studentId);
        if ($existing === null) {
            throw ApiException::notFound('PLACEMENT_NOT_FOUND', 'سطح‌بندی هنرجو یافت نشد.');
        }
        $existing->delete();
    }

    /* ------------------------------------------------------------- derived */

    /**
     * Content the student may currently open. Computed, never stored.
     *
     * @return list<array{content: array, level_id: string, level_order: int, level_name: string, sort_order: int}>
     */
    public function eligibleContent(string $studentId): array
    {
        [$placement, $levels, $links, $content] = $this->derivedInputs($studentId);

        return array_map(
            [self::class, 'eligibleRow'],
            LearningEligibility::eligibleContent($placement, $levels, $links, $content),
        );
    }

    /**
     * Content locked on higher levels, with the honest reason.
     * Locked no preview/download — the UI enforces.
     *
     * @return list<array{content: array, level_id: string, level_order: int, level_name: string, sort_order: int, reason: string}>
     */
    public function lockedContent(string $studentId): array
    {
        [$placement, $levels, $links, $content] = $this->derivedInputs($studentId);

        return array_map(
            [self::class, 'lockedRow'],
            LearningEligibility::lockedContent($placement, $levels, $links, $content),
        );
    }

    /** @return list<string> */
    public function eligibleStudentIds(string $contentId): array
    {
        $this->getContent($contentId);

        return LearningEligibility::eligibleStudentIds(
            $contentId,
            $this->levelRows(),
            $this->linkRows(),
            $this->placementRows(),
        );
    }

    /**
     * The shared lookup behind every derived read: tenant-scoped, so a
     * foreign student is invisible and the read degrades to empty rather than
     * leaking that the id exists elsewhere.
     *
     * @return array{0: array{id: string, program_id: string, level_id: string}|null, 1: list<array>, 2: list<array>, 3: list<array>}
     */
    private function derivedInputs(string $studentId): array
    {
        $student = Student::query()->whereKey($studentId)->first();
        $placement = null;
        if ($student !== null) {
            $row = $this->getStudentPlacement($studentId);
            if ($row !== null) {
                $placement = ['id' => $row->id, 'program_id' => $row->program_id, 'level_id' => $row->level_id];
            }
        }

        return [$placement, $this->levelRows(), $this->linkRows(), $this->contentRows()];
    }

    /** @return list<array{id: string, program_id: string, order: int, name: string, active: bool, exclusive: bool}> */
    private function levelRows(): array
    {
        return LearningLevel::query()->get()->map(fn (LearningLevel $l): array => [
            'id' => $l->id,
            'program_id' => $l->program_id,
            'order' => $l->order,
            'name' => $l->name,
            'active' => $l->active,
            'exclusive' => $l->exclusive,
        ])->all();
    }

    /** @return list<array{level_id: string, content_id: string, sort_order: int}> */
    private function linkRows(): array
    {
        return LevelContentLink::query()->get()->map(fn (LevelContentLink $l): array => [
            'level_id' => $l->level_id,
            'content_id' => $l->content_id,
            'sort_order' => $l->sort_order,
        ])->all();
    }

    /** @return list<array{id: string, title: string, active: bool, visibility: string}> */
    private function contentRows(): array
    {
        return LearningContent::query()->get()->map(fn (LearningContent $c): array => [
            'id' => $c->id,
            'title' => $c->title,
            'active' => $c->active,
            'visibility' => $c->visibility,
        ])->all();
    }

    /** @return list<array{student_id: string, program_id: string, level_id: string}> */
    private function placementRows(): array
    {
        return StudentPlacement::query()->get()->map(fn (StudentPlacement $p): array => [
            'student_id' => $p->student_id,
            'program_id' => $p->program_id,
            'level_id' => $p->level_id,
        ])->all();
    }

    /** @param  array{content: array, level_id: string, level_order: int, level_name: string, sort_order: int}  $row */
    private static function eligibleRow(array $row): array
    {
        return [
            'content' => self::contentWire($row['content']['id']),
            'levelId' => $row['level_id'],
            'levelOrder' => $row['level_order'],
            'levelName' => $row['level_name'],
            'sortOrder' => $row['sort_order'],
        ];
    }

    /** @param  array{content: array, level_id: string, level_order: int, level_name: string, sort_order: int, reason: string}  $row */
    private static function lockedRow(array $row): array
    {
        return [
            'content' => self::contentWire($row['content']['id']),
            'levelId' => $row['level_id'],
            'levelOrder' => $row['level_order'],
            'levelName' => $row['level_name'],
            'sortOrder' => $row['sort_order'],
            'reason' => $row['reason'],
        ];
    }

    private static function contentWire(string $id): array
    {
        $content = LearningContent::query()->whereKey($id)->first();

        return $content === null ? ['id' => $id] : self::toContentWire($content);
    }

    /* ---------------------------------------------------------------- wire */

    /** @return array<string, mixed> */
    public static function toProgramWire(LearningProgram $program): array
    {
        return [
            'id' => $program->id,
            'instrumentId' => $program->instrument_id,
            'name' => $program->name,
            'description' => $program->description,
            'active' => $program->active,
        ];
    }

    /** @return array<string, mixed> */
    public static function toLevelWire(LearningLevel $level): array
    {
        $wire = [
            'id' => $level->id,
            'programId' => $level->program_id,
            'order' => $level->order,
            'name' => $level->name,
            'description' => $level->description,
            'objectives' => $level->objectives ?? [],
            'active' => $level->active,
        ];
        if ($level->notes !== null && $level->notes !== '') {
            $wire['notes'] = $level->notes;
        }
        if ($level->exclusive) {
            $wire['exclusive'] = true;
        }
        if (is_array($level->prerequisite_level_ids) && $level->prerequisite_level_ids !== []) {
            $wire['prerequisiteLevelIds'] = array_values($level->prerequisite_level_ids);
        }

        return $wire;
    }

    /** @return array<string, mixed> */
    public static function toContentWire(LearningContent $content): array
    {
        $wire = [
            'id' => $content->id,
            'title' => $content->title,
            'description' => $content->description,
            'type' => $content->type,
            'visibility' => $content->visibility,
            'active' => $content->active,
            'createdAt' => Iso::format($content->created_at),
        ];
        if ($content->media_id !== null && $content->media_id !== '') {
            $wire['mediaId'] = $content->media_id;
        }
        if ($content->author !== null && $content->author !== '') {
            $wire['author'] = $content->author;
        }
        if ($content->teacher_id !== null && $content->teacher_id !== '') {
            $wire['teacherId'] = $content->teacher_id;
        }
        if ($content->instrument_id !== null && $content->instrument_id !== '') {
            $wire['instrumentId'] = $content->instrument_id;
        }

        return $wire;
    }

    /** @return array<string, mixed> */
    public static function toLinkWire(LevelContentLink $link): array
    {
        return [
            'id' => $link->id,
            'levelId' => $link->level_id,
            'contentId' => $link->content_id,
            'sortOrder' => $link->sort_order,
        ];
    }

    /** @return array<string, mixed> */
    public static function toPlacementWire(StudentPlacement $placement): array
    {
        return [
            'id' => $placement->id,
            'studentId' => $placement->student_id,
            'programId' => $placement->program_id,
            'levelId' => $placement->level_id,
            'assignedAt' => Iso::format($placement->assigned_at),
            'history' => $placement->history ?? [],
        ];
    }

    /* --------------------------------------------------------------- rules */

    private function assertInstrumentExists(string $instrumentId): void
    {
        if ($instrumentId === '' || ! Instrument::query()->whereKey($instrumentId)->exists()) {
            throw ApiException::validation('PROGRAM_INVALID', 'ساز انتخاب‌شده وجود ندارد.', ['instrumentId' => ['نامعتبر است']]);
        }
    }

    private function validatedMediaId(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value)) {
            throw ApiException::validation('CONTENT_INVALID', 'فایل انتخاب‌شده یافت نشد.', ['mediaId' => ['نامعتبر است']]);
        }
        $id = trim($value);
        if (! MediaAsset::query()->whereKey($id)->exists()) {
            throw ApiException::validation('CONTENT_INVALID', 'فایل انتخاب‌شده یافت نشد.', ['mediaId' => ['نامعتبر است']]);
        }

        return $id;
    }

    /** @return list<string> */
    private function stringList(mixed $value, string $field): array
    {
        if (! is_array($value)) {
            throw ApiException::validation('LEVEL_INVALID', 'اطلاعات سطح معتبر نیست.', [$field => ['باید فهرستی از متن باشد.']]);
        }
        foreach ($value as $item) {
            if (! is_string($item)) {
                throw ApiException::validation('LEVEL_INVALID', 'اطلاعات سطح معتبر نیست.', [$field => ['باید فهرستی از متن باشد.']]);
            }
        }

        return array_values($value);
    }

    /**
     * Prerequisite ids must name levels of the same program, and must not
     * close a loop. Advisory links, but a loop is always a data error.
     *
     * @param  mixed  $value
     * @return list<string>
     */
    private function validatedPrerequisites(string $programId, mixed $value, ?string $selfId): array
    {
        if ($value === null) {
            return [];
        }
        if (! is_array($value)) {
            throw ApiException::validation('LEVEL_INVALID', 'اطلاعات سطح معتبر نیست.', ['prerequisiteLevelIds' => ['باید فهرستی از شناسه باشد.']]);
        }
        $ids = [];
        foreach ($value as $item) {
            if (! is_string($item) || $item === '') {
                throw ApiException::validation('LEVEL_INVALID', 'اطلاعات سطح معتبر نیست.', ['prerequisiteLevelIds' => ['باید فهرستی از شناسه باشد.']]);
            }
            $ids[] = $item;
        }
        $ids = array_values(array_unique($ids));

        if ($ids !== []) {
            $rows = LearningLevel::query()->where('program_id', $programId)->get(['id', 'prerequisite_level_ids'])->all();
            $graph = [];
            foreach ($rows as $row) {
                $graph[$row->id] = is_array($row->prerequisite_level_ids) ? $row->prerequisite_level_ids : [];
            }
            // The row being written participates with its NEW edges, so a
            // cycle closed by this write is caught rather than stored.
            $graph[$selfId ?? "\0new"] = $ids;

            foreach ($ids as $id) {
                if (! array_key_exists($id, $graph) && $id !== $selfId) {
                    throw ApiException::validation('LEVEL_INVALID', 'پیش‌نیاز یافت نشد.', ['prerequisiteLevelIds' => ['نامعتبر است']]);
                }
            }
            if ($selfId !== null && in_array($selfId, $ids, true)) {
                throw ApiException::validation('LEVEL_INVALID', 'یک سطح نمی‌تواند پیش‌نیاز خودش باشد.', ['prerequisiteLevelIds' => ['چرخه مجاز نیست']]);
            }
            foreach ($ids as $id) {
                if ($this->reaches($graph, $id, $selfId ?? "\0new")) {
                    throw ApiException::validation('LEVEL_INVALID', 'پیش‌نیازها چرخه می‌سازند.', ['prerequisiteLevelIds' => ['چرخه مجاز نیست']]);
                }
            }
        }

        return $ids;
    }

    /**
     * Whether following prerequisite edges from $from can reach $target.
     *
     * @param  array<string, list<string>>  $graph
     */
    private function reaches(array $graph, string $from, string $target): bool
    {
        $seen = [];
        $stack = [$from];
        while ($stack !== []) {
            $node = array_pop($stack);
            if ($node === $target) {
                return true;
            }
            if (isset($seen[$node])) {
                continue;
            }
            $seen[$node] = true;
            foreach ($graph[$node] ?? [] as $next) {
                $stack[] = $next;
            }
        }

        return false;
    }
}
