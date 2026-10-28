<?php

namespace Database\Seeders;

use App\Domain\Students\StudentService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Seeds the demo dataset (repo-root data/dataset/*.json) into the demo
 * organization. LOCAL / TESTING ONLY: throws in any other environment.
 *
 * No credential lives in a committed file: users get a password only when the
 * DEMO_SEED_PASSWORD environment variable (config('demo.seed_password')) is
 * non-empty; otherwise their
 * password is null and they cannot sign in.
 *
 * One method per collection, inserted in foreign-key order.
 */
class DemoDatasetSeeder extends Seeder
{
    public const ORGANIZATION_ID = 'org_demo';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('DemoDatasetSeeder runs only in the local and testing environments.');
        }

        DB::transaction(function (): void {
            $this->seedOrganization();
            $this->seedTeachers();
            $this->seedUsers();
            $this->seedRoles();
            $this->seedRooms();
            $this->seedInstruments();
            $this->seedStudents();
            $this->seedClasses();
            $this->seedEnrollments();
            $this->seedSessions();
        });
    }

    protected function seedTeachers(): void
    {
        foreach ($this->dataset('teachers') as $teacher) {
            DB::table('teachers')->insert([
                'id' => (string) $teacher['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'name' => (string) $teacher['name'],
                'photo_media_id' => $teacher['photoMediaId'] ?? null,
                'instrument' => (string) $teacher['instrument'],
                'title' => (string) $teacher['title'],
                'students' => (int) ($teacher['students'] ?? 0),
                'utilization' => (int) ($teacher['utilization'] ?? 0),
                'weekly_hours' => (int) ($teacher['weeklyHours'] ?? 0),
                'contract_hours' => (int) ($teacher['contractHours'] ?? 0),
                'attendance_rate' => (int) ($teacher['attendanceRate'] ?? 0),
                'retention' => (int) ($teacher['retention'] ?? 0),
                'today_classes' => json_encode($teacher['todayClasses'] ?? [], JSON_UNESCAPED_UNICODE),
                'availability' => json_encode($teacher['availability'] ?? []),
                'since' => (string) $teacher['since'],
                'phone' => (string) $teacher['phone'],
                'status' => (string) $teacher['status'],
                'bio' => (string) ($teacher['bio'] ?? ''),
                'created_at' => $this->timestamp($teacher['createdAt'] ?? null),
                'updated_at' => $this->timestamp($teacher['updatedAt'] ?? null),
            ]);
        }
    }

    protected function seedRooms(): void
    {
        foreach ($this->dataset('rooms') as $room) {
            DB::table('rooms')->insert([
                'id' => (string) $room['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'name' => (string) $room['name'],
                'kind' => (string) $room['kind'],
                'capacity' => (int) $room['capacity'],
                'occupancy' => (int) ($room['occupancy'] ?? 0),
                // The dataset omits `active` for assignable rooms.
                'active' => ($room['active'] ?? true) !== false,
                'created_at' => $this->timestamp(null),
                'updated_at' => $this->timestamp(null),
            ]);
        }
    }

    /**
     * Instruments come from `instruments.json`, whose six seeded rows keep the
     * historical ids (`piano`, `violin`, …) that every seeded student, teacher,
     * class and resource row stores. Without them a fresh seed would leave
     * those references dangling.
     */
    protected function seedInstruments(): void
    {
        foreach ($this->dataset('instruments') as $instrument) {
            DB::table('instruments')->insert([
                'id' => (string) $instrument['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'slug' => (string) $instrument['slug'],
                'name' => (string) $instrument['name'],
                'description' => (string) ($instrument['description'] ?? ''),
                'image_id' => $instrument['imageId'] ?? null,
                'active' => ($instrument['active'] ?? true) !== false,
                'sort_order' => (int) ($instrument['sortOrder'] ?? 0),
                'created_at' => $this->timestamp(null),
                'updated_at' => $this->timestamp(null),
            ]);
        }
    }

    protected function seedStudents(): void
    {
        $deferredKeys = [
            ...array_keys(StudentService::DEFERRED_DEFAULTS),
            ...StudentService::DEFERRED_OPTIONAL,
        ];

        foreach ($this->dataset('students') as $student) {
            $deferred = [];
            foreach ($deferredKeys as $key) {
                if (array_key_exists($key, $student)) {
                    $deferred[$key] = $student[$key];
                }
            }

            DB::table('students')->insert([
                'id' => (string) $student['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'national_id' => (string) $student['nationalId'],
                'name' => (string) $student['name'],
                'instrument' => (string) $student['instrument'],
                'teacher_id' => ($student['teacherId'] ?? '') !== '' ? (string) $student['teacherId'] : null,
                'level' => (string) $student['level'],
                'level_step' => (int) $student['levelStep'],
                'status' => (string) $student['status'],
                'payment' => (string) $student['payment'],
                'age' => (int) $student['age'],
                'phone' => (string) $student['phone'],
                'guardian' => $student['guardian'] ?? null,
                'since' => (string) $student['since'],
                'deferred' => json_encode($deferred, JSON_UNESCAPED_UNICODE),
                'created_at' => $this->timestamp($student['createdAt'] ?? null),
                'updated_at' => $this->timestamp($student['updatedAt'] ?? null),
            ]);
        }
    }

    /** `enrolled`, `waitlist` and `studentIds` are derived from enrollments, not stored. */
    protected function seedClasses(): void
    {
        foreach ($this->dataset('classes') as $class) {
            DB::table('classes')->insert([
                'id' => (string) $class['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'title' => (string) $class['title'],
                'instrument' => (string) $class['instrument'],
                'teacher_id' => (string) $class['teacherId'],
                'room_id' => (string) $class['roomId'],
                'kind' => (string) $class['kind'],
                'level' => (string) $class['level'],
                'program_id' => $class['programId'] ?? null,
                'level_id' => $class['levelId'] ?? null,
                'days' => json_encode($class['days'] ?? []),
                'time' => (string) $class['time'],
                'duration' => (int) $class['duration'],
                'capacity' => (int) $class['capacity'],
                'attendance_avg' => (int) ($class['attendanceAvg'] ?? 0),
                'tuition' => (int) $class['tuition'],
                'term_progress' => (int) ($class['termProgress'] ?? 0),
                'status' => (string) ($class['status'] ?? 'active'),
                'created_at' => $this->timestamp(null),
                'updated_at' => $this->timestamp(null),
            ]);
        }
    }

    protected function seedEnrollments(): void
    {
        foreach ($this->dataset('enrollments') as $enrollment) {
            DB::table('enrollments')->insert([
                'id' => (string) $enrollment['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'student_id' => (string) $enrollment['studentId'],
                'class_id' => (string) $enrollment['classId'],
                'status' => (string) $enrollment['status'],
                'start_date' => (string) $enrollment['startDate'],
                'end_date' => $enrollment['endDate'] ?? null,
                'pricing_label' => (string) ($enrollment['pricingPlan']['label'] ?? ''),
                'pricing_amount' => (int) ($enrollment['pricingPlan']['amount'] ?? 0),
                'created_at' => $this->timestamp(null),
                'updated_at' => $this->timestamp(null),
            ]);
        }
    }

    protected function seedOrganization(): void
    {
        $organization = $this->dataset('organization');
        $now = now();

        /*
         * The whole `OrganizationSettings` record, not just the name: the demo
         * dataset (data/dataset/organization.json) is the shipped rule set, and
         * a seeded academy whose working hours silently fell back to the column
         * defaults would not be the academy the dataset describes.
         */
        DB::table('organizations')->insert([
            'id' => self::ORGANIZATION_ID,
            'slug' => 'demo',
            'name' => (string) $organization['name'],
            'status' => 'active',
            'tagline' => (string) ($organization['tagline'] ?? ''),
            'locale' => (string) ($organization['locale'] ?? 'fa-IR'),
            'direction' => (string) ($organization['direction'] ?? 'rtl'),
            'calendar' => (string) ($organization['calendar'] ?? 'jalali'),
            'currency' => (string) ($organization['currency'] ?? 'toman'),
            'first_weekday' => (int) ($organization['firstWeekday'] ?? 0),
            'default_session_minutes' => (int) ($organization['defaultSessionMinutes'] ?? 60),
            'session_gap_minutes' => (int) ($organization['sessionGapMinutes'] ?? 10),
            'cancellation_grace_hours' => (int) ($organization['cancellationGraceHours'] ?? 24),
            'max_makeups_per_term' => (int) ($organization['maxMakeupsPerTerm'] ?? 2),
            'working_day_start' => (string) ($organization['workingDayStart'] ?? '08:00'),
            'working_day_end' => (string) ($organization['workingDayEnd'] ?? '21:00'),
            'closed_weekdays' => json_encode(
                array_values(array_map('intval', (array) ($organization['closedWeekdays'] ?? [6]))),
                JSON_THROW_ON_ERROR,
            ),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    protected function seedUsers(): void
    {
        $seedPassword = (string) config('demo.seed_password', '');
        $hash = $seedPassword !== '' ? Hash::make($seedPassword) : null;

        foreach ($this->dataset('users') as $user) {
            DB::table('users')->insert([
                'id' => (string) $user['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'name' => (string) $user['name'],
                'email' => mb_strtolower(trim((string) $user['email'])),
                'phone' => $user['phone'] ?? null,
                'role' => (string) $user['role'],
                'status' => (string) ($user['status'] ?? 'active'),
                'teacher_id' => $user['teacherId'] ?? null,
                'password' => $hash,
                'created_at' => $this->timestamp($user['createdAt'] ?? null),
                'updated_at' => $this->timestamp($user['updatedAt'] ?? null),
            ]);
        }
    }

    protected function seedRoles(): void
    {
        foreach ($this->dataset('roles') as $role) {
            $permissions = $role['permissions'] ?? null;

            DB::table('roles')->insert([
                'organization_id' => self::ORGANIZATION_ID,
                'id' => (string) $role['id'],
                'label' => (string) $role['label'],
                'scope' => (string) ($role['scope'] ?? ''),
                'permissions' => is_array($permissions) ? json_encode(array_values($permissions)) : null,
                'updated_at' => isset($role['updatedAt']) ? $this->timestamp($role['updatedAt']) : null,
            ]);
        }
    }


    /**
     * Sessions come from `scheduledSessions.json`, whose records already match
     * the server `Session` shape exactly (classId / date / startTime / endTime
     * / teacherId / roomId / status / origin).
     *
     * `sessions.json` and `attendance.json` are NOT seeded: both are the legacy
     * demo format (`g7`-style ids, a `mark` field, `recordedBy` as a free-text
     * person name) and neither can be mapped onto the schema without inventing
     * data. `attendanceRecords.json` and `attendanceCorrections.json` are empty
     * arrays, so attendance is created by factories in tests instead.
     */
    protected function seedSessions(): void
    {
        foreach ($this->dataset('scheduledSessions') as $session) {
            if (! isset($session['classId'], $session['date'], $session['startTime'], $session['endTime'])) {
                continue;
            }

            DB::table('class_sessions')->insert([
                'id' => (string) $session['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'class_id' => (string) $session['classId'],
                'date' => (string) $session['date'],
                'start_time' => (string) $session['startTime'],
                'end_time' => (string) $session['endTime'],
                'teacher_id' => (string) ($session['teacherId'] ?? ''),
                'room_id' => (string) ($session['roomId'] ?? ''),
                'status' => (string) ($session['status'] ?? 'scheduled'),
                'origin' => (string) ($session['origin'] ?? 'generated'),
                'cancel_reason' => $session['cancelReason'] ?? null,
                'rescheduled_from_id' => $session['rescheduledFromId'] ?? null,
                'rescheduled_to_id' => $session['rescheduledToId'] ?? null,
                'notes' => $session['notes'] ?? null,
                'created_at' => $this->timestamp($session['createdAt'] ?? null),
                'updated_at' => $this->timestamp($session['updatedAt'] ?? null),
            ]);
        }
    }

    /** @return array<mixed> */
    protected function dataset(string $name): array
    {
        $path = base_path('../data/dataset/'.$name.'.json');
        if (! is_file($path)) {
            throw new RuntimeException("Demo dataset file missing: data/dataset/{$name}.json");
        }

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    protected function timestamp(?string $iso): string
    {
        return ($iso ? Carbon::parse($iso) : now())->utc()->format('Y-m-d H:i:s');
    }
}
