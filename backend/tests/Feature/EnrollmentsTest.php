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

    public function test_teacher_reads_only_active_enrollments_in_owned_classes(): void
    {
        Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, 'id' => 't2']);
        AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => 'c2',
            'teacher_id' => 't2',
            'room_id' => 'r1',
            'capacity' => 5,
            'title' => 'کلاس دیگر',
        ]);

        $active = $this->enrollRow('enr_active', 's1', 'c1', 'active');
        $waiting = $this->enrollRow('enr_waiting', 's2', 'c1', 'waitlist');
        $cancelled = $this->enrollRow('enr_cancelled', 's3', 'c1', 'cancelled');
        $otherActive = $this->enrollRow('enr_other', 's1', 'c2', 'active');

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $response = $this->getJson('/api/v1/enrollments')->assertOk();
        $this->assertSame([$active->id], array_column($response->json('data'), 'id'));
        $response->assertJsonPath('meta.total', 1);

        // Filters and search cannot widen the class/active scope.
        $this->getJson('/api/v1/enrollments?class_id=c2')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/enrollments?status=waitlist')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/enrollments?status=active')
            ->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $active->id);
        $this->getJson('/api/v1/enrollments?student_id=s1')
            ->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $active->id);

        DB::table('students')->where('id', 's2')->update(['name' => 'هنرجوی دیگر']);
        DB::table('students')->where('id', 's1')->update(['name' => 'هنرجوی من']);
        $this->getJson('/api/v1/enrollments?search='.urlencode('هنرجوی دیگر'))
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/enrollments?search='.urlencode('کلاس دیگر'))
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/enrollments?search='.urlencode('هنرجوی من'))
            ->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $active->id);

        // Direct ids cannot bypass: other class and inactive own-class rows are 404.
        $this->getJson("/api/v1/enrollments/{$otherActive->id}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ENROLLMENT_NOT_FOUND');
        $this->getJson("/api/v1/enrollments/{$waiting->id}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ENROLLMENT_NOT_FOUND');
        $this->getJson("/api/v1/enrollments/{$cancelled->id}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ENROLLMENT_NOT_FOUND');
        $this->getJson("/api/v1/enrollments/{$active->id}")
            ->assertOk()
            ->assertJsonMissingPath('data.pricingPlan');

        // Organization-wide roles still see the full, priced row.
        $this->actingAsRole('manager');
        $this->getJson("/api/v1/enrollments/{$active->id}")
            ->assertOk()
            ->assertJsonPath('data.pricingPlan.amount', $active->pricing_amount);
    }

    public function test_teacher_without_teacher_id_is_pb1_on_enrollment_reads(): void
    {
        $this->enrollRow('enr_active', 's1', 'c1', 'active');

        $this->actingAsRole('teacher', ['teacher_id' => null]);

        $this->getJson('/api/v1/enrollments')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1')
            ->assertJsonPath('error.decision', 'PB-1');
        $this->getJson('/api/v1/enrollments/enr_missing')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
    }

    public function test_a_teacher_permission_override_cannot_write_enrollments(): void
    {
        Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, 'id' => 't2']);
        AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => 'c2',
            'teacher_id' => 't2',
            'room_id' => 'r1',
            'capacity' => 5,
        ]);
        $active = $this->enrollRow('enr_active', 's1', 'c1', 'active');

        DB::table('roles')->insert([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => 'teacher',
            'label' => 'مدرس',
            'scope' => '',
            'permissions' => json_encode([...config('permissions.defaults.teacher'), 'classes.write']),
            'updated_at' => now(),
        ]);

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        // Enrollment is the edge that creates student scope; a teacher cannot
        // self-grant it even when a role override grants classes.write.
        $this->postJson('/api/v1/enrollments', ['studentId' => 's2', 'classId' => 'c1'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->postJson('/api/v1/enrollments', ['studentId' => 's2', 'classId' => 'c2'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->patchJson("/api/v1/enrollments/{$active->id}", ['status' => 'cancelled'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->postJson("/api/v1/enrollments/{$active->id}/withdraw")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->deleteJson("/api/v1/enrollments/{$active->id}")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $this->assertSame('active', DB::table('enrollments')->where('id', $active->id)->value('status'));
    }

    public function test_teacher_enrollment_list_omits_the_pricing_plan(): void
    {
        $row = $this->enrollRow('enr_active', 's1', 'c1', 'active');

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/enrollments')
            ->assertOk()
            ->assertJsonPath('data.0.id', $row->id)
            ->assertJsonMissingPath('data.0.pricingPlan');

        $this->actingAsRole('accountant');
        $this->getJson('/api/v1/enrollments')
            ->assertOk()
            ->assertJsonPath('data.0.pricingPlan.amount', $row->pricing_amount);
    }

    public function test_teacher_without_teacher_id_is_pb1_on_enrollment_writes(): void
    {
        $row = $this->enrollRow('enr_active', 's1', 'c1', 'active');

        $this->actingAsRole('teacher', ['teacher_id' => null]);

        $this->postJson('/api/v1/enrollments', ['studentId' => 's2', 'classId' => 'c1'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->patchJson("/api/v1/enrollments/{$row->id}", ['status' => 'cancelled'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson("/api/v1/enrollments/{$row->id}/withdraw")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->deleteJson("/api/v1/enrollments/{$row->id}")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');

        $this->assertSame('active', DB::table('enrollments')->where('id', $row->id)->value('status'));
        $this->assertSame(1, DB::table('enrollments')->where('id', $row->id)->count());
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

    /* ------------------------------------------------------------------ */
    /* I16 — server-side search over the related student and class         */
    /* ------------------------------------------------------------------ */

    /** A second class in the default org, for title-matching cases. */
    private function secondClass(string $id = 'c2', string $title = 'کلاس ویولن'): AcademyClass
    {
        return AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => $id,
            'teacher_id' => 't1',
            'room_id' => 'r1',
            'title' => $title,
            'level' => 'سطح ۲',
        ]);
    }

    private function enrollRow(string $id, string $studentId, string $classId, string $status = 'active'): Enrollment
    {
        return Enrollment::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => $id,
            'student_id' => $studentId,
            'class_id' => $classId,
            'status' => $status,
        ]);
    }

    public function test_list_searches_by_student_name(): void
    {
        $this->actingAsRole('manager');
        DB::table('students')->where('id', 's1')->update(['name' => 'آرمین کاویانی']);
        DB::table('students')->where('id', 's2')->update(['name' => 'سارا رضایی']);

        $this->enrollRow('enr_s1', 's1', 'c1');
        $this->enrollRow('enr_s2', 's2', 'c1');

        $this->getJson('/api/v1/enrollments?search='.urlencode('آرمین'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'enr_s1')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_list_searches_by_class_title(): void
    {
        $this->actingAsRole('manager');
        $this->secondClass();
        DB::table('students')->where('id', 's1')->update(['name' => 'آرمین کاویانی']);
        DB::table('students')->where('id', 's2')->update(['name' => 'سارا رضایی']);

        $this->enrollRow('enr_s1', 's1', 'c1');
        $this->enrollRow('enr_s2', 's2', 'c2');

        $this->getJson('/api/v1/enrollments?search='.urlencode('ویولن'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'enr_s2')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_search_composes_with_the_existing_filters(): void
    {
        $this->actingAsRole('manager');
        DB::table('students')->where('id', 's1')->update(['name' => 'آرمین کاویانی']);

        $this->enrollRow('enr_open', 's1', 'c1', 'active');
        $this->enrollRow('enr_done', 's1', 'c1', 'completed');

        // Same term, narrower membership filter: only the completed row answers.
        $this->getJson('/api/v1/enrollments?search='.urlencode('آرمین').'&status=completed')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'enr_done');

        // `active=1` and the term together keep only active rows.
        $this->getJson('/api/v1/enrollments?search='.urlencode('آرمین').'&active=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'enr_open');
    }

    public function test_empty_or_whitespace_search_applies_no_filter(): void
    {
        $this->actingAsRole('manager');
        $this->enrollRow('enr_a', 's1', 'c1');
        $this->enrollRow('enr_b', 's2', 'c1');

        foreach (['', '%20%20', '%20%20%20'] as $raw) {
            $this->getJson('/api/v1/enrollments?search='.$raw)
                ->assertOk()
                ->assertJsonPath('meta.total', 2);
        }
    }

    public function test_search_never_matches_another_organizations_records(): void
    {
        $other = $this->makeOrganization();
        Student::factory()->create([
            'organization_id' => $other->id, 'id' => 's_other', 'name' => 'آرمین کاویانی',
        ]);
        AcademyClass::factory()->create([
            'organization_id' => $other->id, 'id' => 'c_other',
            'teacher_id' => 't1', 'room_id' => 'r1', 'title' => 'کلاس ویولن',
        ]);
        Enrollment::factory()->create([
            'organization_id' => $other->id, 'id' => 'enr_other',
            'student_id' => 's_other', 'class_id' => 'c_other',
        ]);

        $this->actingAsRole('manager');

        // The term exists only in the other academy: the scoped query finds nothing.
        $this->getJson('/api/v1/enrollments?search='.urlencode('آرمین'))
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/enrollments?search='.urlencode('ویولن'))
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
    }

    public function test_search_finds_a_matching_enrollment_beyond_the_first_page(): void
    {
        $this->actingAsRole('manager');
        DB::table('students')->where('id', 's1')->update(['name' => 'دانش‌آموز هدف']);
        DB::table('students')->where('id', 's2')->update(['name' => 'بقیهٔ هنرجویان']);

        // 204 non-matching rows first, so the target can only appear on page 3.
        // Enrollments are unique per (student, class), so each bulk row needs its
        // own student.
        for ($i = 0; $i < 204; $i++) {
            $sid = 's_bulk_'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);
            Student::factory()->create([
                'organization_id' => $this->defaultOrganization()->id,
                'id' => $sid,
                'name' => 'هنرجوی شماره '.$i,
            ]);
            $this->enrollRow('enr_bulk_'.str_pad((string) $i, 3, '0', STR_PAD_LEFT), $sid, 'c1');
        }
        $target = $this->enrollRow('enr_target', 's1', 'c1');
        $target->forceFill(['created_at' => now()->addHour()])->save();

        // Without a term the row sits on page 3 — genuinely beyond the first page.
        $this->getJson('/api/v1/enrollments?per_page=100&page=3')
            ->assertOk()
            ->assertJsonPath('meta.total', 205)
            ->assertJsonFragment(['id' => 'enr_target']);

        // With the term the server finds it: one match, on the filtered page 1.
        $this->getJson('/api/v1/enrollments?search='.urlencode('دانش‌آموز').'&per_page=100&page=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.per_page', 100)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'enr_target');

        $this->assertSame(205, DB::table('enrollments')->count());
    }

    public function test_search_longer_than_200_characters_is_rejected(): void
    {
        $this->actingAsRole('manager');

        $this->getJson('/api/v1/enrollments?search='.str_repeat('a', 201))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ENROLLMENT_INVALID');

        // The boundary itself is accepted (and simply matches nothing here).
        $this->getJson('/api/v1/enrollments?search='.str_repeat('a', 200))
            ->assertOk();
    }

    public function test_search_is_case_insensitive_for_latin_text(): void
    {
        $this->actingAsRole('manager');
        $this->secondClass('c2', 'Piano Class');
        $this->enrollRow('enr_s1', 's1', 'c1');
        $this->enrollRow('enr_s2', 's2', 'c2');

        $this->getJson('/api/v1/enrollments?search='.urlencode('piano'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'enr_s2');
    }
}
