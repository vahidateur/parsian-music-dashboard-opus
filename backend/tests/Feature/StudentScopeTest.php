<?php

namespace Tests\Feature;

use App\Domain\Students\StudentAccessPolicy;
use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * T-02 (teacher WITH teacher_id): visible students = active enrollment ∩
 * class.teacher_id. students.teacher_id is not an authorization source.
 * PB-1 (teacher WITHOUT teacher_id): 403 OWNER_DECISION_REQUIRED_PB1.
 */
class StudentScopeTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $org = $this->defaultOrganization()->id;

        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't2']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t1', 'teacher_id' => 't1']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t2', 'teacher_id' => 't2']);

        // NEGATIVE: denormalized teacher_id says t1, but no enrollment at all.
        $this->student('s_label_only', 't1');
        // POSITIVE: teacher_id names another teacher, active enrollment in t1's class.
        $this->student('s_enrolled_other_label', 't2', [['c_t1', 'active']]);
        // Plain positive.
        $this->student('s_enrolled', null, [['c_t1', 'active']]);
        // Waitlist / cancelled / completed in t1's class grant nothing.
        $this->student('s_waitlist', 't1', [['c_t1', 'waitlist']]);
        $this->student('s_cancelled', 't1', [['c_t1', 'cancelled']]);
        $this->student('s_completed', 't1', [['c_t1', 'completed']]);
        // Active, but in another teacher's class.
        $this->student('s_other_class', 't1', [['c_t2', 'active']]);
        // Two enrollments in t1's class (old cancelled + current active): listed once.
        $this->student('s_reenrolled', null, [['c_t1', 'cancelled'], ['c_t1', 'active']]);
    }

    /** @param  list<array{0: string, 1: string}>  $enrollments */
    private function student(string $id, ?string $teacherId, array $enrollments = []): void
    {
        $org = $this->defaultOrganization()->id;
        Student::factory()->create(['organization_id' => $org, 'id' => $id, 'teacher_id' => $teacherId, 'name' => $id]);
        foreach ($enrollments as [$classId, $status]) {
            Enrollment::factory()->create([
                'organization_id' => $org,
                'student_id' => $id,
                'class_id' => $classId,
                'status' => $status,
            ]);
        }
    }

    public function test_teacher_sees_exactly_students_with_an_active_enrollment_in_their_classes(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $response = $this->getJson('/api/v1/students?sort=name')->assertOk();
        $this->assertSame(
            ['s_enrolled', 's_enrolled_other_label', 's_reenrolled'],
            array_column($response->json('data'), 'id'),
        );
        // The total is counted in SQL over the scoped query.
        $response->assertJsonPath('meta.total', 3);
    }

    public function test_denormalized_teacher_id_filter_cannot_widen_the_scope(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $ids = array_column($this->getJson('/api/v1/students?teacher_id=t1')->assertOk()->json('data'), 'id');
        $this->assertSame([], $ids);
        $ids = array_column($this->getJson('/api/v1/students?teacher_id=t2')->assertOk()->json('data'), 'id');
        $this->assertSame(['s_enrolled_other_label'], $ids);
    }

    public function test_teacher_get_out_of_scope_is_404_and_in_scope_is_200(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/students/s_enrolled_other_label')->assertOk()->assertJsonPath('data.teacherId', 't2');
        foreach (['s_label_only', 's_waitlist', 's_cancelled', 's_completed', 's_other_class'] as $id) {
            $this->getJson("/api/v1/students/$id")->assertStatus(404)->assertJsonPath('error.code', 'STUDENT_NOT_FOUND');
        }
    }

    public function test_other_teacher_sees_their_own_scope(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't2']);

        $ids = array_column($this->getJson('/api/v1/students')->assertOk()->json('data'), 'id');
        $this->assertSame(['s_other_class'], $ids);
    }

    public function test_writes_by_a_teacher_are_confined_to_the_scope(): void
    {
        // Give the teacher role students.write for this org (role override) so
        // the scope — not the permission — is what is being tested.
        DB::table('roles')->insert([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => 'teacher',
            'label' => 'مدرس',
            'scope' => '',
            'permissions' => json_encode([...config('permissions.defaults.teacher'), 'students.write']),
            'updated_at' => now(),
        ]);
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->patchJson('/api/v1/students/s_label_only', ['name' => 'Hijack'])->assertStatus(404)->assertJsonPath('error.code', 'STUDENT_NOT_FOUND');
        $this->deleteJson('/api/v1/students/s_other_class')->assertStatus(404);
        $this->patchJson('/api/v1/students/s_enrolled', ['name' => 'Renamed'])->assertOk()->assertJsonPath('data.name', 'Renamed');

        $this->assertSame('s_label_only', DB::table('students')->where('id', 's_label_only')->value('name'));
        $this->assertSame(1, DB::table('students')->where('id', 's_other_class')->count());
    }

    public function test_teacher_without_teacher_id_is_blocked_by_pb1(): void
    {
        foreach ([null, ''] as $teacherId) {
            $this->actingAsRole('teacher', ['teacher_id' => $teacherId]);

            foreach ([
                ['GET', '/api/v1/students', []],
                ['GET', '/api/v1/students?sort=invalid', []],
                ['GET', '/api/v1/students/s_enrolled', []],
                ['POST', '/api/v1/students', []],
            ] as [$method, $uri, $body]) {
                $this->json($method, $uri, $body)
                    ->assertStatus(403)
                    ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1')
                    ->assertJsonPath('error.decision', 'PB-1');
            }
        }
    }

    public function test_scope_query_is_sql_only_and_never_reads_students_teacher_id(): void
    {
        $teacher = $this->makeUser('teacher', ['teacher_id' => 't1']);
        $this->bindTenant($this->defaultOrganization());

        $query = app(StudentAccessPolicy::class)->scopeQuery(Student::query(), $teacher);
        $sql = strtolower($query->toSql());

        $this->assertStringContainsString('exists', $sql);
        $this->assertStringContainsString('"enrollments"."status" = ?', $sql);
        $this->assertStringContainsString('"classes"."teacher_id" = ?', $sql);
        $this->assertStringNotContainsString('"students"."teacher_id"', $sql);
    }

    public function test_non_teacher_roles_are_org_wide(): void
    {
        $this->actingAsRole('staff', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/students')->assertOk()->assertJsonPath('meta.total', 8);
    }
}
