<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Room;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class ClassesTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $org = $this->defaultOrganization()->id;
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1', 'status' => 'active']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't_off', 'status' => 'inactive']);
        Room::factory()->create(['organization_id' => $org, 'id' => 'r1', 'active' => true]);
        Room::factory()->create(['organization_id' => $org, 'id' => 'r_off', 'active' => false]);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'پیانو گروهی',
            'instrument' => 'piano',
            'teacherId' => 't1',
            'roomId' => 'r1',
            'kind' => 'group',
            'level' => 'سطح ۲',
            'programId' => 'prog_piano',
            'days' => [1, 3],
            'time' => '17:30',
            'duration' => 60,
            'capacity' => 2,
            'tuition' => 2500000,
            ...$overrides,
        ];
    }

    private function class(array $attributes = []): AcademyClass
    {
        return AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'teacher_id' => 't1',
            'room_id' => 'r1',
            ...$attributes,
        ]);
    }

    private function enroll(string $classId, string $status = 'active'): Student
    {
        $org = $this->defaultOrganization()->id;
        $student = Student::factory()->create(['organization_id' => $org]);
        Enrollment::factory()->create(['organization_id' => $org, 'student_id' => $student->id, 'class_id' => $classId, 'status' => $status]);

        return $student;
    }

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/classes')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/classes/cl1/archive')->assertStatus(401);
    }

    public function test_teacher_can_read_but_not_write(): void
    {
        $id = $this->class()->id;
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/classes')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson("/api/v1/classes/$id")->assertOk();
        // 403 precedes validation of the (empty) body.
        $this->postJson('/api/v1/classes', [])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'classes.write');
        $this->patchJson("/api/v1/classes/$id", ['title' => 'xx'])->assertStatus(403);
        $this->postJson("/api/v1/classes/$id/archive")->assertStatus(403);
        $this->deleteJson("/api/v1/classes/$id")->assertStatus(403);
    }

    public function test_crud_round_trip_and_envelope(): void
    {
        $this->actingAsRole('manager');

        $created = $this->postJson('/api/v1/classes', $this->payload())->assertCreated();
        $id = $created->json('data.id');
        $this->assertStringStartsWith('cl_', $id);
        $created->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.teacherId', 't1')
            ->assertJsonPath('data.roomId', 'r1')
            ->assertJsonPath('data.programId', 'prog_piano')
            ->assertJsonMissingPath('data.levelId')
            ->assertJsonPath('data.days', [1, 3])
            ->assertJsonPath('data.enrolled', 0)
            ->assertJsonPath('data.waitlist', 0)
            ->assertJsonPath('data.studentIds', [])
            ->assertJsonPath('data.attendanceAvg', 0)
            ->assertJsonPath('data.termProgress', 0)
            ->assertJsonMissingPath('data.organization_id');

        $this->getJson("/api/v1/classes/$id")->assertOk()->assertJsonPath('data', $created->json('data'));

        $this->patchJson("/api/v1/classes/$id", ['title' => 'پیانو پیشرفته', 'capacity' => 4, 'enrolled' => 99, 'studentIds' => ['x']])
            ->assertOk()
            ->assertJsonPath('data.title', 'پیانو پیشرفته')
            ->assertJsonPath('data.capacity', 4)
            ->assertJsonPath('data.enrolled', 0)
            ->assertJsonPath('data.studentIds', []);

        $this->getJson('/api/v1/classes')->assertOk()->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total']]);

        $this->deleteJson("/api/v1/classes/$id")->assertNoContent();
        $this->getJson("/api/v1/classes/$id")->assertStatus(404)->assertJsonPath('error.code', 'CLASS_NOT_FOUND');
    }

    public function test_enrolled_waitlist_and_student_ids_are_computed(): void
    {
        $id = $this->class(['capacity' => 5])->id;
        $a = $this->enroll($id, 'active');
        $b = $this->enroll($id, 'active');
        $this->enroll($id, 'waitlist');
        $this->enroll($id, 'cancelled');
        $this->actingAsRole('staff');

        $this->getJson("/api/v1/classes/$id")
            ->assertOk()
            ->assertJsonPath('data.enrolled', 2)
            ->assertJsonPath('data.waitlist', 1)
            ->assertJsonPath('data.studentIds', [$a->id, $b->id]);
        $this->getJson('/api/v1/classes')->assertJsonPath('data.0.enrolled', 2);
    }

    public function test_validation_failures_are_422_class_invalid(): void
    {
        $this->actingAsRole('administrator');

        $response = $this->postJson('/api/v1/classes', $this->payload([
            'title' => 'x', 'kind' => 'solo', 'days' => [], 'time' => '25:00', 'duration' => 5, 'capacity' => 0,
        ]))->assertStatus(422)->assertJsonPath('error.code', 'CLASS_INVALID');
        $this->assertEqualsCanonicalizing(
            ['title', 'kind', 'days', 'time', 'duration', 'capacity'],
            array_keys($response->json('error.fields')),
        );

        $this->postJson('/api/v1/classes', $this->payload(['teacherId' => 't_off']))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.teacherId.0', 'مدرس غیرفعال است.');
        $this->postJson('/api/v1/classes', $this->payload(['roomId' => 'r_off']))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.roomId.0', 'اتاق غیرفعال است.');
        $this->postJson('/api/v1/classes', $this->payload(['teacherId' => 'nope', 'roomId' => 'nope']))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.teacherId.0', 'مدرس یافت نشد.')
            ->assertJsonPath('error.fields.roomId.0', 'اتاق یافت نشد.');

        $id = $this->class()->id;
        $this->patchJson("/api/v1/classes/$id", ['roomId' => 'r_off'])->assertStatus(422)->assertJsonPath('error.code', 'CLASS_INVALID');
    }

    public function test_archived_is_hidden_by_default_and_archive_endpoint(): void
    {
        $this->class(['title' => 'A']);
        $b = $this->class(['title' => 'B']);
        $this->actingAsRole('administrator');

        $this->postJson("/api/v1/classes/{$b->id}/archive")->assertOk()->assertJsonPath('data.status', 'archived');

        $titles = fn (string $q) => array_column($this->getJson('/api/v1/classes'.$q)->assertOk()->json('data'), 'title');
        $this->assertSame(['A'], $titles(''));
        $this->assertSame(['B'], $titles('?status=archived'));
        $this->assertSame(['A'], $titles('?status=active'));
        $this->getJson('/api/v1/classes?sort=age')->assertStatus(422)->assertJsonPath('error.code', 'CLASS_INVALID');
    }

    public function test_filters_and_sort(): void
    {
        Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, 'id' => 't2']);
        $x = $this->class(['title' => 'Xylo', 'instrument' => 'tar', 'capacity' => 3]);
        $this->class(['title' => 'Alto', 'teacher_id' => 't2', 'capacity' => 9]);
        $this->enroll($x->id);
        $this->actingAsRole('staff');

        $titles = fn (string $q) => array_column($this->getJson('/api/v1/classes'.$q)->assertOk()->json('data'), 'title');
        $this->assertSame(['Alto', 'Xylo'], $titles(''));
        $this->assertSame(['Xylo'], $titles('?instrument=tar'));
        $this->assertSame(['Alto'], $titles('?teacher_id=t2'));
        $this->assertSame(['Xylo'], $titles('?search=Xyl'));
        $this->assertSame(['Xylo', 'Alto'], $titles('?sort=enrolled&dir=desc'));
        $this->assertSame(['Xylo', 'Alto'], $titles('?sort=capacity'));
    }

    public function test_capacity_below_enrolled_is_409(): void
    {
        $id = $this->class(['capacity' => 3])->id;
        $this->enroll($id);
        $this->enroll($id);
        $this->enroll($id, 'waitlist');
        $this->actingAsRole('administrator');

        $this->patchJson("/api/v1/classes/$id", ['capacity' => 1])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CLASS_CAPACITY_BELOW_ENROLLED')
            ->assertJsonPath('error.fields.capacity.0', 'کمتر از ثبت‌نام فعلی');
        $this->assertSame(3, DB::table('classes')->where('id', $id)->value('capacity'));
        // Waitlist does not occupy a seat.
        $this->patchJson("/api/v1/classes/$id", ['capacity' => 2])->assertOk()->assertJsonPath('data.capacity', 2);
    }

    public function test_delete_with_any_enrollment_row_is_409(): void
    {
        $id = $this->class()->id;
        $this->enroll($id, 'cancelled');
        $this->actingAsRole('administrator');

        $this->deleteJson("/api/v1/classes/$id")->assertStatus(409)->assertJsonPath('error.code', 'CLASS_HAS_ENROLLMENTS');
        $this->assertSame(1, DB::table('classes')->where('id', $id)->count());
    }

    public function test_other_organizations_class_is_404(): void
    {
        $foreign = AcademyClass::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->actingAsRole('administrator');

        $this->getJson("/api/v1/classes/{$foreign->id}")->assertStatus(404)->assertJsonPath('error.code', 'CLASS_NOT_FOUND');
        $this->patchJson("/api/v1/classes/{$foreign->id}", ['title' => 'Hijack'])->assertStatus(404);
        $this->postJson("/api/v1/classes/{$foreign->id}/archive")->assertStatus(404);
        $this->deleteJson("/api/v1/classes/{$foreign->id}")->assertStatus(404);
        $this->getJson('/api/v1/classes')->assertJsonPath('meta.total', 0);
        // Another org's teacher/room cannot be referenced either.
        $this->postJson('/api/v1/classes', $this->payload(['teacherId' => $foreign->teacher_id, 'roomId' => $foreign->room_id]))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.teacherId.0', 'مدرس یافت نشد.');
        $this->assertSame('active', DB::table('classes')->where('id', $foreign->id)->value('status'));
    }

    public function test_accountant_reads_but_cannot_write(): void
    {
        $this->actingAsRole('accountant');

        $this->getJson('/api/v1/classes')->assertOk();
        $this->postJson('/api/v1/classes', $this->payload())->assertStatus(403)->assertJsonPath('error.permission', 'classes.write');
    }
}
