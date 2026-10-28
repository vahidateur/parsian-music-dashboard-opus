<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\MediaAsset;
use App\Models\Student;
use App\Models\Teacher;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class StudentsTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    /** Valid checksum national ids. */
    private const NID_A = '0012345679';

    private const NID_B = '2000000002';

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return [
            'nationalId' => self::NID_A,
            'name' => 'نیما کریمی',
            'instrument' => 'piano',
            'teacherId' => 't1',
            'level' => 'سطح ۱',
            'levelStep' => 1,
            'status' => 'active',
            'payment' => 'due',
            'sessionsUsed' => 2,
            'sessionsTotal' => 12,
            'attendance' => 80,
            'progress' => 30,
            'since' => 'مهر ۱۴۰۴',
            'age' => 12,
            'phone' => '0912 000 2222',
            'guardian' => 'پدر',
            'nextClass' => ['day' => 'شنبه', 'time' => '۱۷:۰۰', 'room' => 'اتاق ۱'],
            'lastSeen' => 'دیروز',
            'balance' => -500000,
            'notes' => [['by' => 'پذیرش', 'date' => 'امروز', 'text' => 'یادداشت']],
            'activity' => [['date' => 'امروز', 'kind' => 'enroll', 'text' => 'ثبت‌نام']],
            'skills' => [['label' => 'ریتم', 'value' => 40]],
            ...$overrides,
        ];
    }

    private function student(array $attributes = []): Student
    {
        return Student::factory()->create(['organization_id' => $this->defaultOrganization()->id, ...$attributes]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, 'id' => 't1']);
    }

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/students')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/students', [])->assertStatus(401);
        $this->deleteJson('/api/v1/students/st1')->assertStatus(401);
    }

    public function test_admin_staff_and_accountant_read_org_wide(): void
    {
        $this->student();
        $this->student();
        Student::factory()->create(['organization_id' => $this->makeOrganization()->id]);

        foreach (['administrator', 'staff', 'accountant', 'manager'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/students')
                ->assertOk()
                ->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total']])
                ->assertJsonPath('meta.total', 2);
        }
    }

    public function test_staff_crud_round_trip_with_deferred_fields(): void
    {
        $this->actingAsRole('staff');

        $created = $this->postJson('/api/v1/students', $this->payload())->assertCreated();
        $id = $created->json('data.id');
        $this->assertStringStartsWith('st_', $id);
        $expected = ['id' => $id, ...$this->payload()];
        foreach ($expected as $key => $value) {
            // `nextClass` and friends round-trip through JSON columns. MySQL's
            // JSON type NORMALISES object key order — keys are stored sorted,
            // so ['day','time','room'] comes back as ['day','room','time'] —
            // while SQLite keeps insertion order and returns them as written.
            // `assertJsonPath` compares with assertSame, which is
            // order-sensitive, so a nested map cannot be compared whole.
            // JSON object key order is not a product contract on any driver.
            // Lists (notes, activity, skills) keep their order and are
            // compared whole — their sequence does carry meaning.
            if (is_array($value) && ! array_is_list($value)) {
                // Compare the KEY SET first, then the values:
                //
                //   - every key that was sent must be present (nothing missing),
                //   - no key may be present that was not sent (nothing extra),
                //   - every value must be exactly equal,
                //   - only the ORDER the driver returns them in is irrelevant.
                //
                // Comparing the sets sorted is what makes "extra" detectable:
                // walking the expected keys alone would pass a response that
                // quietly carried one more.
                $actual = $created->json("data.$key");
                $this->assertIsArray($actual, "data.$key must come back as a JSON object");

                $expectedKeys = array_keys($value);
                $actualKeys = array_keys($actual);
                sort($expectedKeys);
                sort($actualKeys);
                $this->assertSame($expectedKeys, $actualKeys, "data.$key must carry exactly the keys that were sent");

                foreach ($value as $nestedKey => $nestedValue) {
                    $created->assertJsonPath("data.$key.$nestedKey", $nestedValue);
                }

                continue;
            }
            $created->assertJsonPath("data.$key", $value);
        }
        $created->assertJsonMissingPath('data.organization_id')->assertJsonMissingPath('data.photoMediaId');

        $this->getJson("/api/v1/students/$id")->assertOk()->assertJsonPath('data', $created->json('data'));

        $this->patchJson("/api/v1/students/$id", ['name' => 'نیما ک.', 'progress' => 55, 'nextClass' => null])
            ->assertOk()
            ->assertJsonPath('data.name', 'نیما ک.')
            ->assertJsonPath('data.progress', 55)
            ->assertJsonMissingPath('data.nextClass')
            ->assertJsonPath('data.balance', -500000)
            ->assertJsonPath('data.skills', [['label' => 'ریتم', 'value' => 40]]);

        // A photo reference must name an asset THAT EXISTS in this
        // organization (see TeachersTest for the same rule on the teacher).
        MediaAsset::factory()->create(['id' => 'med_9', 'organization_id' => $this->defaultOrganization()->id]);
        $this->patchJson("/api/v1/students/$id", ['photoMediaId' => 'med_9'])
            ->assertOk()
            ->assertJsonPath('data.photoMediaId', 'med_9');
        $this->patchJson("/api/v1/students/$id", ['photoMediaId' => 'med_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'STUDENT_INVALID');
        $this->assertSame(
            'med_9',
            \Illuminate\Support\Facades\DB::table('students')->where('id', $id)->value('deferred->photoMediaId'),
        );

        $this->deleteJson("/api/v1/students/$id")->assertNoContent();
        $this->getJson("/api/v1/students/$id")->assertStatus(404)->assertJsonPath('error.code', 'STUDENT_NOT_FOUND');
    }

    public function test_create_normalizes_national_id_and_defaults_deferred_fields(): void
    {
        $this->actingAsRole('administrator');
        $payload = $this->payload(['nationalId' => '۰۰۱۲۳۴۵۶۷۹']);
        foreach (['sessionsUsed', 'sessionsTotal', 'attendance', 'progress', 'lastSeen', 'balance', 'notes', 'activity', 'skills', 'nextClass', 'guardian'] as $key) {
            unset($payload[$key]);
        }

        $this->postJson('/api/v1/students', $payload)
            ->assertCreated()
            ->assertJsonPath('data.nationalId', self::NID_A)
            ->assertJsonPath('data.notes', [])
            ->assertJsonPath('data.sessionsUsed', 0)
            ->assertJsonPath('data.lastSeen', '')
            ->assertJsonMissingPath('data.guardian')
            ->assertJsonMissingPath('data.nextClass');
    }

    public function test_accountant_and_teacher_cannot_write(): void
    {
        $student = $this->student();
        $this->actingAsRole('accountant');

        $this->postJson('/api/v1/students', $this->payload())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'students.write');
        $this->patchJson("/api/v1/students/{$student->id}", ['name' => 'x'])->assertStatus(403);
        $this->deleteJson("/api/v1/students/{$student->id}")->assertStatus(403);

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $this->postJson('/api/v1/students', $this->payload())->assertStatus(403)->assertJsonPath('error.permission', 'students.write');
    }

    public function test_validation_failure_is_422_student_invalid(): void
    {
        $this->actingAsRole('staff');

        $response = $this->postJson('/api/v1/students', $this->payload([
            'nationalId' => '0012345678',
            'levelStep' => 9,
            'payment' => 'unknown',
            'teacherId' => 't_missing',
            'activity' => [['date' => 'x', 'kind' => 'party', 'text' => 'y']],
        ]))->assertStatus(422)->assertJsonPath('error.code', 'STUDENT_INVALID');
        $this->assertEqualsCanonicalizing(
            ['nationalId', 'levelStep', 'payment', 'teacherId', 'activity.0.kind'],
            array_keys($response->json('error.fields')),
        );
        $response->assertJsonPath('error.fields.nationalId.0', 'کد ملی معتبر نیست.');

        $this->postJson('/api/v1/students', [])->assertStatus(422)->assertJsonPath('error.code', 'STUDENT_INVALID');
        $this->getJson('/api/v1/students?sort=shoe-size')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'STUDENT_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['sort']]]);
    }

    public function test_duplicate_national_id_is_409(): void
    {
        $existing = $this->student(['national_id' => self::NID_B]);
        $this->actingAsRole('staff');

        $this->postJson('/api/v1/students', $this->payload(['nationalId' => self::NID_B]))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'STUDENT_NATIONAL_ID_TAKEN')
            ->assertJsonPath('error.fields.nationalId.0', 'تکراری است');

        $other = $this->postJson('/api/v1/students', $this->payload())->assertCreated()->json('data.id');
        $this->patchJson("/api/v1/students/$other", ['nationalId' => self::NID_B])->assertStatus(409);
        // Re-sending its own id is not a conflict.
        $this->patchJson("/api/v1/students/{$existing->id}", ['nationalId' => self::NID_B])->assertOk();
    }

    public function test_filters_sort_and_per_page_cap(): void
    {
        $this->student(['name' => 'Bahar', 'status' => 'active', 'payment' => 'paid', 'teacher_id' => 't1', 'deferred' => ['progress' => 90]]);
        $this->student(['name' => 'Arash', 'status' => 'paused', 'payment' => 'overdue', 'deferred' => ['progress' => 10]]);
        $this->student(['name' => 'Dara', 'status' => 'active', 'payment' => 'due', 'deferred' => ['progress' => 50]]);
        $this->actingAsRole('staff');

        $names = fn (string $query) => array_column($this->getJson('/api/v1/students'.$query)->assertOk()->json('data'), 'name');

        $this->assertSame(['Arash', 'Bahar', 'Dara'], $names('?sort=name'));
        $this->assertSame(['Arash', 'Dara', 'Bahar'], $names('?sort=progress'));
        $this->assertSame(['Bahar', 'Dara'], $names('?status=active&sort=name'));
        $this->assertSame(['Arash'], $names('?payment=overdue'));
        $this->assertSame(['Bahar'], $names('?teacher_id=t1'));
        $this->assertSame(['Dara'], $names('?search=Dar'));

        $this->getJson('/api/v1/students?per_page=1000')->assertOk()->assertJsonPath('meta.per_page', 100);
    }

    public function test_other_organizations_student_is_404(): void
    {
        $foreign = Student::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->actingAsRole('administrator');

        $this->getJson("/api/v1/students/{$foreign->id}")->assertStatus(404)->assertJsonPath('error.code', 'STUDENT_NOT_FOUND');
        $this->patchJson("/api/v1/students/{$foreign->id}", ['name' => 'Hijack'])->assertStatus(404);
        $this->deleteJson("/api/v1/students/{$foreign->id}")->assertStatus(404);
        $this->assertSame(1, DB::table('students')->where('id', $foreign->id)->count());
    }

    public function test_delete_cascades_enrollments(): void
    {
        $org = $this->defaultOrganization();
        $student = $this->student();
        $class = AcademyClass::factory()->create(['organization_id' => $org->id, 'teacher_id' => 't1']);
        Enrollment::factory()->create(['organization_id' => $org->id, 'student_id' => $student->id, 'class_id' => $class->id]);
        $this->actingAsRole('staff');

        $this->deleteJson("/api/v1/students/{$student->id}")->assertNoContent();

        $this->assertSame(0, DB::table('enrollments')->where('student_id', $student->id)->count());
        $this->assertSame(1, DB::table('classes')->where('id', $class->id)->count());
    }

    public function test_seeder_loads_teachers_rooms_students_classes_enrollments(): void
    {
        config(['demo.seed_password' => '']);
        // setUp's organization/teacher are unrelated to the demo org.
        DB::table('teachers')->delete();
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(8, DB::table('teachers')->count());
        $this->assertSame(4, DB::table('rooms')->count());
        $this->assertSame(15, DB::table('students')->count());
        $this->assertSame(10, DB::table('classes')->count());
        $this->assertSame(18, DB::table('enrollments')->count());
        $this->assertSame(4, DB::table('rooms')->where('active', true)->count());

        $deferred = json_decode((string) DB::table('students')->where('id', 'st1')->value('deferred'), true);
        $this->assertSame(54, $deferred['progress']);
        $this->assertSame('اتاق ۱', $deferred['nextClass']['room']);
    }
}
