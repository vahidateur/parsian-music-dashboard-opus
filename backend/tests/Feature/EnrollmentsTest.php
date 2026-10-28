<?php

namespace Tests\Feature;

use App\Domain\Enrollments\EnrollmentService;
use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Room;
use App\Models\Student;
use App\Models\Teacher;
use App\Support\Api\ApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class EnrollmentsTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $org = $this->defaultOrganization()->id;
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        Room::factory()->create(['organization_id' => $org, 'id' => 'r1']);
        AcademyClass::factory()->create([
            'organization_id' => $org, 'id' => 'c1', 'teacher_id' => 't1', 'room_id' => 'r1',
            'capacity' => 1, 'level' => 'سطح ۳', 'tuition' => 3200000,
        ]);
        foreach (['s1', 's2', 's3'] as $id) {
            Student::factory()->create(['organization_id' => $org, 'id' => $id, 'name' => $id]);
        }
    }

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/enrollments')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])->assertStatus(401);
    }

    public function test_enroll_with_defaults_and_round_trip(): void
    {
        $this->actingAsRole('manager');

        $created = $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])->assertCreated();
        $id = $created->json('data.id');
        $this->assertStringStartsWith('enr_', $id);
        $created->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.studentId', 's1')
            ->assertJsonPath('data.classId', 'c1')
            ->assertJsonPath('data.startDate', now()->toDateString())
            ->assertJsonPath('data.pricingPlan', ['label' => 'سطح ۳', 'amount' => 3200000])
            ->assertJsonMissingPath('data.endDate')
            ->assertJsonMissingPath('data.organization_id');

        $this->getJson("/api/v1/enrollments/$id")->assertOk()->assertJsonPath('data', $created->json('data'));
        $this->getJson('/api/v1/enrollments?class_id=c1')
            ->assertOk()
            ->assertJsonPath('meta', ['page' => 1, 'per_page' => 25, 'total' => 1]);
        $this->getJson('/api/v1/classes/c1')->assertJsonPath('data.enrolled', 1)->assertJsonPath('data.studentIds', ['s1']);

        $this->patchJson("/api/v1/enrollments/$id", ['pricingPlan' => ['label' => 'تخفیف', 'amount' => 100], 'endDate' => '2026-12-01', 'classId' => 'ignored'])
            ->assertOk()
            ->assertJsonPath('data.pricingPlan', ['label' => 'تخفیف', 'amount' => 100])
            ->assertJsonPath('data.endDate', '2026-12-01')
            ->assertJsonPath('data.classId', 'c1');

        $this->deleteJson("/api/v1/enrollments/$id")->assertNoContent();
        $this->getJson("/api/v1/enrollments/$id")->assertStatus(404)->assertJsonPath('error.code', 'ENROLLMENT_NOT_FOUND');
        $this->getJson('/api/v1/classes/c1')->assertJsonPath('data.enrolled', 0);
    }

    public function test_explicit_start_date_and_pricing_plan_are_kept(): void
    {
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/enrollments', [
            'studentId' => 's1', 'classId' => 'c1', 'startDate' => '۱۴۰۵/۰۷/۰۱',
            'pricingPlan' => ['label' => 'ویژه', 'amount' => 0],
        ])->assertCreated()
            ->assertJsonPath('data.startDate', '۱۴۰۵/۰۷/۰۱')
            ->assertJsonPath('data.pricingPlan', ['label' => 'ویژه', 'amount' => 0]);
    }

    public function test_duplicate_open_enrollment_is_409(): void
    {
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1', 'status' => 'waitlist'])->assertCreated();
        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1', 'status' => 'waitlist'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ENROLLMENT_DUPLICATE');
        $this->assertSame(1, DB::table('enrollments')->where('student_id', 's1')->count());
    }

    public function test_full_class_is_409_but_waitlist_is_allowed_and_promotion_rechecks(): void
    {
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])->assertCreated();
        $this->postJson('/api/v1/enrollments', ['studentId' => 's2', 'classId' => 'c1'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CLASS_FULL')
            ->assertJsonPath('error.fields.classId.0', 'ظرفیت تکمیل');

        $waiting = $this->postJson('/api/v1/enrollments', ['studentId' => 's2', 'classId' => 'c1', 'status' => 'waitlist'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'waitlist')
            ->json('data.id');
        $this->getJson('/api/v1/classes/c1')->assertJsonPath('data.enrolled', 1)->assertJsonPath('data.waitlist', 1);

        $this->patchJson("/api/v1/enrollments/$waiting", ['status' => 'active'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CLASS_FULL')
            ->assertJsonPath('error.fields.status.0', 'ظرفیت تکمیل');
        $this->assertSame('waitlist', DB::table('enrollments')->where('id', $waiting)->value('status'));
    }

    public function test_archived_class_is_409(): void
    {
        AcademyClass::query()->withoutGlobalScopes()->whereKey('c1')->update(['status' => 'archived']);
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CLASS_ARCHIVED');
    }

    public function test_withdraw_then_re_enroll(): void
    {
        $this->actingAsRole('administrator');

        $id = $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])->json('data.id');
        $this->postJson("/api/v1/enrollments/$id/withdraw")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.endDate', now()->toDateString());
        $this->getJson('/api/v1/classes/c1')->assertJsonPath('data.enrolled', 0)->assertJsonPath('data.studentIds', []);

        // The seat and the open slot are free again.
        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])->assertCreated();
        $this->getJson('/api/v1/classes/c1')->assertJsonPath('data.studentIds', ['s1']);
        // Re-opening the old cancelled row would duplicate the new open one.
        $this->patchJson("/api/v1/enrollments/$id", ['status' => 'waitlist'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ENROLLMENT_DUPLICATE');
    }

    public function test_validation_and_cross_org_references_are_422(): void
    {
        $other = $this->makeOrganization();
        Student::factory()->create(['organization_id' => $other->id, 'id' => 's_foreign']);
        $foreignClass = AcademyClass::factory()->create(['organization_id' => $other->id]);
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/enrollments', ['status' => 'completed', 'pricingPlan' => ['label' => 'x', 'amount' => -1]])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ENROLLMENT_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['studentId', 'classId', 'status', 'pricingPlan.amount']]]);

        $this->postJson('/api/v1/enrollments', ['studentId' => 's_foreign', 'classId' => $foreignClass->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ENROLLMENT_INVALID')
            ->assertJsonPath('error.fields.studentId.0', 'هنرجو یافت نشد.')
            ->assertJsonPath('error.fields.classId.0', 'کلاس یافت نشد.');
        $this->assertSame(0, DB::table('enrollments')->count());

        $this->patchJson('/api/v1/enrollments/x', ['status' => 'paused'])->assertStatus(422)->assertJsonPath('error.code', 'ENROLLMENT_INVALID');
    }

    public function test_other_organizations_enrollment_is_404(): void
    {
        $other = $this->makeOrganization();
        $student = Student::factory()->create(['organization_id' => $other->id]);
        $class = AcademyClass::factory()->create(['organization_id' => $other->id]);
        $foreign = Enrollment::factory()->create(['organization_id' => $other->id, 'student_id' => $student->id, 'class_id' => $class->id]);
        $this->actingAsRole('administrator');

        $this->getJson("/api/v1/enrollments/{$foreign->id}")->assertStatus(404)->assertJsonPath('error.code', 'ENROLLMENT_NOT_FOUND');
        $this->patchJson("/api/v1/enrollments/{$foreign->id}", ['status' => 'cancelled'])->assertStatus(404);
        $this->postJson("/api/v1/enrollments/{$foreign->id}/withdraw")->assertStatus(404);
        $this->deleteJson("/api/v1/enrollments/{$foreign->id}")->assertStatus(404);
        $this->getJson('/api/v1/enrollments')->assertJsonPath('meta.total', 0);
        $this->assertSame('active', DB::table('enrollments')->where('id', $foreign->id)->value('status'));
    }

    public function test_teacher_reads_but_cannot_write(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/enrollments')->assertOk();
        $this->postJson('/api/v1/enrollments', [])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'classes.write');
        $this->patchJson('/api/v1/enrollments/x', [])->assertStatus(403);
        $this->postJson('/api/v1/enrollments/x/withdraw')->assertStatus(403);
        $this->deleteJson('/api/v1/enrollments/x')->assertStatus(403);
    }

    public function test_list_filters(): void
    {
        $org = $this->defaultOrganization()->id;
        Enrollment::factory()->create(['organization_id' => $org, 'student_id' => 's1', 'class_id' => 'c1', 'status' => 'active']);
        Enrollment::factory()->create(['organization_id' => $org, 'student_id' => 's2', 'class_id' => 'c1', 'status' => 'waitlist']);
        Enrollment::factory()->create(['organization_id' => $org, 'student_id' => 's3', 'class_id' => 'c1', 'status' => 'cancelled']);
        $this->actingAsRole('staff');

        $students = fn (string $q) => array_column($this->getJson('/api/v1/enrollments'.$q)->assertOk()->json('data'), 'studentId');
        $this->assertSame(['s1', 's2', 's3'], $students(''));
        $this->assertSame(['s1'], $students('?active=1'));
        $this->assertSame(['s2'], $students('?status=waitlist'));
        $this->assertSame(['s3'], $students('?student_id=s3'));
        $this->getJson('/api/v1/enrollments?status=paused')->assertStatus(422);
    }

    public function test_enroll_and_withdraw_change_teacher_student_visibility(): void
    {
        $this->actingAsRole('administrator');
        $id = $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1'])->json('data.id');

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $this->assertSame(['s1'], array_column($this->getJson('/api/v1/students')->assertOk()->json('data'), 'id'));

        $this->actingAsRole('administrator');
        $this->postJson("/api/v1/enrollments/$id/withdraw")->assertOk();

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $this->getJson('/api/v1/students')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/students/s1')->assertStatus(404);
    }

    public function test_partial_unique_index_rejects_a_second_open_enrollment(): void
    {
        // A writer that bypasses the service's in-transaction check still hits
        // the database index (EnrollmentService maps it to ENROLLMENT_DUPLICATE).
        //
        // That index is a PARTIAL index, and only sqlite and pgsql have those.
        // The migration creates it conditionally and says why: "MySQL has no
        // partial indexes; there the service's transactional check is the only
        // guard." So this asserts the defence-in-depth layer on the drivers
        // that have it...
        $org = $this->defaultOrganization()->id;
        Enrollment::factory()->create(['organization_id' => $org, 'student_id' => 's1', 'class_id' => 'c1', 'status' => 'waitlist']);

        if (in_array(DB::connection()->getDriverName(), ['sqlite', 'pgsql'], true)) {
            $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
            Enrollment::factory()->create(['organization_id' => $org, 'student_id' => 's1', 'class_id' => 'c1', 'status' => 'active']);

            return;
        }

        // ...and on MySQL, where it cannot exist, it asserts the layer that
        // does instead. Skipping would drop the invariant altogether, which is
        // the one thing this case must never do: "at most one open enrollment
        // per student and class" has to hold on every driver, by whichever
        // mechanism that driver actually provides.
        $this->actingAsRole('administrator');
        $this->postJson('/api/v1/enrollments', ['studentId' => 's1', 'classId' => 'c1', 'status' => 'active'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ENROLLMENT_DUPLICATE');
        $this->assertSame(1, DB::table('enrollments')->where('student_id', 's1')->count());
    }

    public function test_service_enforces_capacity_without_http(): void
    {
        $admin = $this->makeUser('administrator');
        $this->bindTenant($this->defaultOrganization());
        $service = app(EnrollmentService::class);

        $service->enroll($admin, ['studentId' => 's1', 'classId' => 'c1']);
        try {
            $service->enroll($admin, ['studentId' => 's2', 'classId' => 'c1']);
            $this->fail('CLASS_FULL expected');
        } catch (ApiException $e) {
            $this->assertSame('CLASS_FULL', $e->errorCode);
        }
        $this->assertSame(1, Enrollment::query()->where('status', 'active')->count());
    }
}
