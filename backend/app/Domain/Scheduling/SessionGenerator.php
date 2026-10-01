<?php

namespace App\Domain\Scheduling;

use App\Models\AcademyClass;
use App\Models\ClassSession;
use App\Models\User;
use App\Support\Api\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Bounded generation of sessions from a class's recurrence
 * (`class.days` + `class.time` + `class.duration`).
 *
 * Bounded on purpose: an open-ended "generate forever" would materialize an
 * unbounded table and make a mistake unrecoverable by hand. Exceeding a cap is
 * a validation error (422 SESSION_GENERATION_WINDOW_INVALID), never a silent
 * truncation.
 *
 * `preview()` performs NO writes and takes no locks. `apply()` re-derives the
 * same plan inside one transaction and re-runs conflict detection before it
 * writes, so the plan the operator approved is the plan that lands.
 *
 * Every slot the generator declines to touch is reported with a reason, so the
 * preview can explain itself instead of silently doing nothing.
 */
final class SessionGenerator
{
    public const MAX_GENERATION_DAYS = 180;

    public const MAX_GENERATION_SESSIONS = 500;

    public function __construct(
        private readonly SessionPolicy $policy,
        private readonly ConflictDetector $conflicts,
    ) {}

    /** Read-only. @return array<string, mixed> the TS `GenerationPlan`. */
    public function preview(User $actor, array $input): array
    {
        $this->policy->authorizeRead($actor);

        return $this->plan($input, $actor);
    }

    /**
     * @return array<string, mixed> the TS `GenerationResult`
     */
    public function apply(User $actor, array $input): array
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($input, $actor): array {
            $plan = $this->plan($input, $actor);

            // Hard conflicts across everything the plan would write.
            if (! $plan['conflicts']['ok']) {
                throw new ApiException(
                    409,
                    'SESSION_CONFLICT',
                    'برنامهٔ تولید با جلسه‌های موجود تداخل دارد.',
                    [],
                    ['conflicts' => $plan['conflicts']],
                );
            }

            $created = [];
            foreach ($plan['creates'] as $slot) {
                $session = new ClassSession;
                $session->id = $slot['id'];
                $session->class_id = $slot['classId'];
                $session->date = $slot['date'];
                $session->start_time = $slot['startTime'];
                $session->end_time = $slot['endTime'];
                $session->teacher_id = $slot['teacherId'];
                $session->room_id = $slot['roomId'];
                $session->status = 'scheduled';
                $session->origin = 'generated';
                $session->save();
                $created[] = $session->refresh();
            }

            $updated = [];
            foreach ($plan['updates'] as $change) {
                $session = ClassSession::query()->whereKey($change['sessionId'])->lockForUpdate()->first();
                if ($session === null) {
                    continue;
                }
                $next = $change['next'];
                $session->date = $next['date'];
                $session->start_time = $next['startTime'];
                $session->end_time = $next['endTime'];
                $session->teacher_id = $next['teacherId'];
                $session->room_id = $next['roomId'];
                $session->save();
                $updated[] = $session->refresh();
            }

            return [
                'plan' => $plan,
                'created' => $created,
                'updated' => $updated,
                'noop' => $created === [] && $updated === [],
            ];
        });
    }

    /**
     * Derive the plan. Pure with respect to writes; safe to call from both
     * `preview()` and `apply()`.
     *
     * @return array<string, mixed>
     */
    private function plan(array $input, User $actor): array
    {
        $class = AcademyClass::query()->whereKey((string) $input['classId'])->first();
        if ($class === null) {
            throw ApiException::validation(
                'SESSION_CLASS_NOT_FOUND',
                'کلاس انتخاب‌شده یافت نشد.',
                ['classId' => ['یافت نشد']],
            );
        }
        if ($class->status === 'archived') {
            throw ApiException::conflict('SESSION_CLASS_ARCHIVED', 'کلاس بایگانی‌شده جلسهٔ تازه نمی‌پذیرد.');
        }

        $from = Carbon::parse((string) $input['from'])->startOfDay();
        $to = Carbon::parse((string) $input['to'])->startOfDay();
        if ($to->lt($from)) {
            throw ApiException::validation(
                'SESSION_GENERATION_WINDOW_INVALID',
                'بازهٔ تولید نامعتبر است.',
                ['to' => ['باید بعد از تاریخ شروع باشد']],
            );
        }
        $days = (int) $from->diffInDays($to) + 1;
        if ($days > self::MAX_GENERATION_DAYS) {
            throw ApiException::validation(
                'SESSION_GENERATION_WINDOW_INVALID',
                'بازهٔ تولید نمی‌تواند بیش از '.self::MAX_GENERATION_DAYS.' روز باشد.',
                ['to' => ['حداکثر '.self::MAX_GENERATION_DAYS.' روز']],
            );
        }

        $weekdays = array_map('intval', (array) ($class->days ?? []));
        $duration = max(1, (int) $class->duration);
        $confirmUpdates = filter_var($input['confirmUpdates'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $today = Carbon::today()->toDateString();
        $creates = [];
        $updates = [];
        $skips = [];
        $slotIds = [];

        for ($date = $from->copy(); $date->lte($to); $date->addDay()) {
            if ($weekdays !== [] && ! in_array(ConflictDetector::weekdayIndex($date->toDateString()), $weekdays, true)) {
                continue;
            }

            $iso = $date->toDateString();
            $start = (string) $class->time;
            $end = $date->copy()->setTimeFromTimeString($start.':00')->addMinutes($duration)->format('H:i');
            $slotId = self::slotId($class->id, $iso, $start);
            $slotIds[] = $slotId;

            $existing = ClassSession::query()->whereKey($slotId)->first();

            if ($existing === null) {
                if ($iso < $today) {
                    $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_PAST'];

                    continue;
                }
                if (count($creates) >= self::MAX_GENERATION_SESSIONS) {
                    throw ApiException::validation(
                        'SESSION_GENERATION_WINDOW_INVALID',
                        'تعداد جلسه‌های تولیدی نمی‌تواند بیش از '.self::MAX_GENERATION_SESSIONS.' باشد.',
                        ['to' => ['بازهٔ تولید بیش از حد بزرگ است']],
                    );
                }
                $creates[] = [
                    'id' => $slotId,
                    'classId' => $class->id,
                    'date' => $iso,
                    'startTime' => $start,
                    'endTime' => $end,
                    'teacherId' => (string) $class->teacher_id,
                    'roomId' => (string) $class->room_id,
                ];

                continue;
            }

            $current = [
                'date' => $existing->date,
                'startTime' => $existing->start_time,
                'endTime' => $existing->end_time,
                'teacherId' => $existing->teacher_id,
                'roomId' => $existing->room_id,
            ];
            $next = [
                'date' => $iso,
                'startTime' => $start,
                'endTime' => $end,
                'teacherId' => (string) $class->teacher_id,
                'roomId' => (string) $class->room_id,
            ];

            if ($existing->status === 'cancelled') {
                $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_CANCELLED'];

                continue;
            }
            if ($existing->origin === 'manual') {
                $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_MANUAL'];

                continue;
            }
            if (DB::table('attendance_records')->where('session_id', $existing->id)->exists()) {
                $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_PROTECTED'];

                continue;
            }
            if ($iso < $today) {
                $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_PAST'];

                continue;
            }
            if ($current === $next) {
                $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_UNCHANGED'];

                continue;
            }
            if (! $confirmUpdates) {
                $skips[] = ['id' => $slotId, 'date' => $iso, 'reason' => 'SKIP_UNCHANGED'];

                continue;
            }
            $updates[] = ['sessionId' => $existing->id, 'current' => $current, 'next' => $next];
        }

        // Future generated sessions the recurrence no longer produces —
        // surfaced for an explicit decision, never auto-deleted.
        $orphans = ClassSession::query()
            ->where('class_id', $class->id)
            ->where('origin', 'generated')
            ->where('status', 'scheduled')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->when($slotIds !== [], fn ($q) => $q->whereKeyNot($slotIds))
            ->orderBy('date')
            ->get(['id', 'date', 'start_time'])
            ->map(fn (ClassSession $s) => [
                'sessionId' => $s->id,
                'date' => $s->date,
                'startTime' => $s->start_time,
                'reason' => 'ORPHANED_RECURRENCE_CHANGED',
            ])
            ->values()
            ->all();

        $conflicts = $this->conflictsFor($creates, $updates);

        return [
            'classId' => $class->id,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'creates' => $creates,
            'updates' => $updates,
            'skips' => $skips,
            'orphans' => $orphans,
            'conflicts' => $conflicts->toWire(),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $creates
     * @param  list<array<string, mixed>>  $updates
     */
    private function conflictsFor(array $creates, array $updates): ConflictReport
    {
        $hard = [];
        $warnings = [];

        foreach ($creates as $slot) {
            $report = $this->conflicts->check($slot);
            $hard = [...$hard, ...$report->hard];
            $warnings = [...$warnings, ...$report->warnings];
        }
        foreach ($updates as $change) {
            $report = $this->conflicts->check(['id' => $change['sessionId'], ...$change['next']]);
            $hard = [...$hard, ...$report->hard];
            $warnings = [...$warnings, ...$report->warnings];
        }

        return new ConflictReport($hard, $warnings);
    }

    /** Deterministic slot id, matching the demo dataset's convention. */
    public static function slotId(string $classId, string $date, string $startTime): string
    {
        return 'ses_'.$classId.'_'.str_replace('-', '', $date).'_'.str_replace(':', '', $startTime);
    }
}
