<?php

namespace App\Domain\Scheduling;

use App\Domain\Organization\OrganizationRules;
use App\Domain\Organization\OrganizationService;
use App\Models\AcademyClass;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Models\Room;
use App\Models\Teacher;
use App\Support\Tenancy\TenantContext;

/**
 * Derives the conflicts a session candidate would create.
 *
 * Conflicts are never stored — the legacy fixture stored them by hand, which
 * meant they could not react to a reschedule. Everything here is computed from
 * the current schedule on every call, and re-run inside the write transaction
 * so two operators cannot book the same room simultaneously.
 *
 * `SESSION_OUTSIDE_WORKING_HOURS` and `SESSION_TIGHT_TURNAROUND` are evaluated
 * against the academy's own rules, now that Organization settings has a server
 * source of truth (the Organization settings slice, `settings.read` /
 * `settings.write`). Both are WARNINGS, exactly as the frontend classifies them
 * (src/domains/scheduling/conflicts.ts: "A session outside it is a warning,
 * never a refusal"), so neither can block a booking — they exist to tell the
 * operator what they are doing.
 *
 * The rules are read through `OrganizationRules`, the server copy of
 * src/domains/organization/rules.ts. When a rule cannot be read — an unparsable
 * clock, or a window that was never configured — the kind is NOT emitted: an
 * unevaluated rule must never masquerade as a permitted one.
 */
final class ConflictDetector
{
    /** Minutes a single session may run for. */
    public const MIN_DURATION = 15;

    public const MAX_DURATION = 480;

    public function __construct(
        private readonly TenantContext $tenant,
        private readonly OrganizationService $organization,
    ) {}

    /** Memoized: generation asks about hundreds of slots in one request. */
    private ?Organization $rules = null;

    /**
     * The academy's rules for this request. They are read once, because the
     * rules cannot change between two conflict checks inside one request.
     */
    private function settings(): Organization
    {
        return $this->rules ??= $this->organization->get();
    }

    /**
     * @param  array{id?: string|null, classId: string, date: string, startTime: string, endTime: string, teacherId: string, roomId: string}  $candidate
     */
    public function check(array $candidate): ConflictReport
    {
        $hard = [];
        $warnings = [];

        if ($candidate['endTime'] <= $candidate['startTime']) {
            $hard[] = ConflictReport::item(
                'SESSION_INVALID_TIME_RANGE',
                'hard',
                'زمان پایان باید بعد از زمان شروع باشد.',
            );
        }

        $minutes = $this->minutesBetween($candidate['startTime'], $candidate['endTime']);
        if ($minutes !== null && ($minutes < self::MIN_DURATION || $minutes > self::MAX_DURATION)) {
            $hard[] = ConflictReport::item(
                'SESSION_INVALID_DURATION',
                'hard',
                "مدت جلسه باید بین {$minutes}.".self::MIN_DURATION.' و '.self::MAX_DURATION.' دقیقه باشد.',
            );
        }

        $class = AcademyClass::query()->whereKey($candidate['classId'])->first();
        if ($class !== null && $class->status === 'archived') {
            $hard[] = ConflictReport::item(
                'SESSION_CLASS_ARCHIVED',
                'hard',
                'این کلاس بایگانی شده و جلسهٔ تازه نمی‌پذیرد.',
            );
        }

        $overlapping = $this->overlappingSessions($candidate);

        foreach ($overlapping as $session) {
            if ($session->room_id === $candidate['roomId']) {
                $hard[] = ConflictReport::item(
                    'SESSION_ROOM_CONFLICT',
                    'hard',
                    "اتاق در این بازهٔ زمانی رزرو شده است ({$session->start_time}–{$session->end_time}).",
                    ['conflictingSessionId' => $session->id],
                );
            }
            if ($session->teacher_id === $candidate['teacherId']) {
                $hard[] = ConflictReport::item(
                    'SESSION_TEACHER_CONFLICT',
                    'hard',
                    "مدرس در این بازهٔ زمانی مشغول است ({$session->start_time}–{$session->end_time}).",
                    ['conflictingSessionId' => $session->id],
                );
            }
        }

        // ---- warnings -------------------------------------------------

        $room = Room::query()->whereKey($candidate['roomId'])->first();
        if ($room !== null && ! $room->active) {
            $warnings[] = ConflictReport::item(
                'SESSION_RESOURCE_INACTIVE',
                'warning',
                'اتاق انتخاب‌شده غیرفعال است.',
            );
        }
        $teacher = Teacher::query()->whereKey($candidate['teacherId'])->first();
        if ($teacher !== null && $teacher->status === 'inactive') {
            $warnings[] = ConflictReport::item(
                'SESSION_RESOURCE_INACTIVE',
                'warning',
                'مدرس انتخاب‌شده غیرفعال است.',
            );
        }

        if ($class !== null) {
            $weekday = self::weekdayIndex($candidate['date']);
            $days = array_map('intval', (array) ($class->days ?? []));
            if ($days !== [] && ! in_array($weekday, $days, true)) {
                $warnings[] = ConflictReport::item(
                    'SESSION_OFF_SCHEDULE',
                    'warning',
                    'این تاریخ با روزهای برنامهٔ کلاس هم‌خوانی ندارد.',
                );
            }

            $shared = $this->sharedStudents($class, $overlapping);
            if ($shared !== []) {
                $warnings[] = ConflictReport::item(
                    'SESSION_STUDENT_OVERLAP',
                    'warning',
                    'برخی هنرجویان در این بازه در جلسهٔ دیگری ثبت‌نام دارند.',
                    ['studentIds' => array_values($shared)],
                );
            }
        }

        // Appended last, so the warnings a booking already reported keep their
        // positions and no existing caller sees its first warning change.
        $this->appendOrganizationRuleWarnings($warnings, $candidate);

        return new ConflictReport($hard, $warnings);
    }

    /**
     * The two kinds that needed Organization settings: the bookable window and
     * the turnaround. Both are advisory — the rule exists so the operator is
     * told what they are doing, not so the schedule is policed by a number in
     * Settings. A rule that cannot be read is not emitted.
     *
     * @param  list<array<string, mixed>>  $warnings
     * @param  array{id?: string|null, date: string, startTime: string, endTime: string, teacherId: string, roomId: string}  $candidate
     */
    private function appendOrganizationRuleWarnings(array &$warnings, array $candidate): void
    {
        $settings = $this->settings();
        $start = OrganizationRules::timeToMinutes($candidate['startTime']);
        $end = OrganizationRules::timeToMinutes($candidate['endTime']);

        $window = OrganizationRules::workingWindow($settings);
        if ($window !== null && $start !== null && $end !== null
            && ($start < $window['start'] || $end > $window['end'])) {
            $warnings[] = ConflictReport::item(
                'SESSION_OUTSIDE_WORKING_HOURS',
                'warning',
                'این جلسه بیرون از ساعات کاری آموزشگاه ('
                .OrganizationRules::pad($window['start']).'–'.OrganizationRules::pad($window['end']).') است.',
            );
        }

        $gap = OrganizationRules::gapMinutes($settings);
        if ($gap <= 0 || $start === null || $end === null) {
            return;
        }

        foreach ($this->sameDaySessions($candidate) as $other) {
            $otherStart = OrganizationRules::timeToMinutes((string) $other->start_time);
            $otherEnd = OrganizationRules::timeToMinutes((string) $other->end_time);
            if ($otherStart === null || $otherEnd === null) {
                continue;
            }

            $shared = $other->room_id === $candidate['roomId']
                ? 'اتاق'
                : ($other->teacher_id === $candidate['teacherId'] ? 'مدرس' : null);
            if ($shared === null) {
                continue;
            }

            // Minutes between the two sessions when they do NOT overlap.
            $turnaround = max($otherStart - $end, $start - $otherEnd);

            // Negative means they overlap, which the hard rules already
            // reported; a turnaround at or above the gap is comfortable.
            if ($turnaround < 0 || $turnaround >= $gap) {
                continue;
            }

            $warnings[] = ConflictReport::item(
                'SESSION_TIGHT_TURNAROUND',
                'warning',
                "فقط {$turnaround} دقیقه فرصت هست تا همین {$shared} برای جلسهٔ {$other->start_time}–{$other->end_time} آماده شود.",
                ['conflictingSessionId' => $other->id],
            );
        }
    }

    /**
     * Every non-cancelled session of the organization on the candidate's date,
     * excluding the candidate itself. Broader than `overlappingSessions()`: the
     * turnaround rule exists precisely for sessions that do NOT overlap.
     *
     * @param  array{id?: string|null, date: string}  $candidate
     * @return \Illuminate\Database\Eloquent\Collection<int, ClassSession>
     */
    public function sameDaySessions(array $candidate)
    {
        return ClassSession::query()
            ->where('date', $candidate['date'])
            ->where('status', '!=', 'cancelled')
            ->when(
                ! empty($candidate['id']),
                fn ($q) => $q->whereKeyNot((string) $candidate['id']),
            )
            ->orderBy('start_time')
            ->orderBy('id')
            ->get();
    }

    /**
     * Sessions of the organization on the same date with an overlapping,
     * exclusive-end time range, excluding the candidate itself and cancelled
     * sessions (a cancelled session frees its slot).
     *
     * @param  array{id?: string|null, date: string, startTime: string, endTime: string}  $candidate
     * @return \Illuminate\Database\Eloquent\Collection<int, ClassSession>
     */
    public function overlappingSessions(array $candidate)
    {
        return ClassSession::query()
            ->where('date', $candidate['date'])
            ->where('status', '!=', 'cancelled')
            ->when(
                ! empty($candidate['id']),
                fn ($q) => $q->whereKeyNot((string) $candidate['id']),
            )
            ->get()
            ->filter(fn (ClassSession $s) => $s->overlapsTime($candidate['startTime'], $candidate['endTime']))
            ->values();
    }

    /**
     * Students actively enrolled in the candidate's class who are also actively
     * enrolled in one of the overlapping sessions' classes.
     *
     * @param  \Illuminate\Database\Eloquent\Collection<int, ClassSession>  $overlapping
     * @return list<string>
     */
    private function sharedStudents(AcademyClass $class, $overlapping): array
    {
        $otherClassIds = $overlapping->pluck('class_id')->filter()->unique()->values()->all();
        if ($otherClassIds === []) {
            return [];
        }

        $mine = Enrollment::query()
            ->where('class_id', $class->id)
            ->where('status', 'active')
            ->pluck('student_id')
            ->all();

        $theirs = Enrollment::query()
            ->whereIn('class_id', $otherClassIds)
            ->where('status', 'active')
            ->pluck('student_id')
            ->all();

        return array_values(array_intersect($mine, $theirs));
    }

    /** Saturday-first weekday index, matching `WEEKDAYS` in weekdays.ts. */
    public static function weekdayIndex(string $date): int
    {
        $phpWeekday = (int) date('w', (int) strtotime($date)); // 0=Sunday … 6=Saturday

        return ($phpWeekday + 1) % 7;
    }

    public static function minutesBetween(string $startTime, string $endTime): ?int
    {
        $start = strtotime("1970-01-01 {$startTime}:00");
        $end = strtotime("1970-01-01 {$endTime}:00");
        if ($start === false || $end === false) {
            return null;
        }

        return (int) round(($end - $start) / 60);
    }
}
