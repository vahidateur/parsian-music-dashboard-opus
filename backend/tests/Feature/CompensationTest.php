<?php

namespace Tests\Feature;

use App\Domain\Compensation\CompensationService;
use App\Models\AcademyClass;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Compensation;
use App\Models\Enrollment;
use App\Models\Room;
use App\Models\Student;
use App\Models\Teacher;
use App\Support\Api\ApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class CompensationTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private function makePrivateClass(string $teacherId = 't1', string $roomId = 'r1'): AcademyClass
    {
        $orgId = $this->defaultOrganization()->id;
        // Classes point at real teachers and rooms (foreign keys): reuse the
        // row when an earlier setup in the same test already created it.
        if (Teacher::query()->whereKey($teacherId)->first() === null) {
            Teacher::factory()->create(['organization_id' => $orgId, 'id' => $teacherId]);
        }
        if (Room::query()->whereKey($roomId)->first() === null) {
            Room::factory()->create(['organization_id' => $orgId, 'id' => $roomId, 'active' => true]);
        }

        return AcademyClass::factory()->create([
            'organization_id' => $orgId,
            'kind' => 'private',
            'teacher_id' => $teacherId,
            'room_id' => $roomId,
        ]);
    }

    private function makeStudent(): Student
    {
        return Student::factory()->create(['organization_id' => $this->defaultOrganization()->id]);
    }

    private function enroll(string $classId, string $studentId): void
    {
        Enrollment::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'class_id' => $classId,
            'student_id' => $studentId,
            'status' => 'active',
        ]);
    }

    private function makeCancelledSession(string $classId, string $teacherId = 't1', string $roomId = 'r1'): ClassSession
    {
        return ClassSession::factory()->cancelled()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'class_id' => $classId,
            'teacher_id' => $teacherId,
            'room_id' => $roomId,
            'date' => Carbon::today()->addDays(3)->toDateString(),
            'start_time' => '14:00',
            'end_time' => '15:00',
        ]);
    }

    /** A fully registrable setup: cancelled private session + the single enrolled student. */
    private function makeRegistrable(string $teacherId = 't1'): array
    {
        $class = $this->makePrivateClass($teacherId);
        $student = $this->makeStudent();
        $this->enroll($class->id, $student->id);
        $session = $this->makeCancelledSession($class->id, $teacherId);

        return [$class, $student, $session];
    }

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function endpoints(string $id): array
    {
        return [
            ['GET', '/api/v1/compensations', []],
            ['GET', "/api/v1/compensations/$id", []],
            ['POST', '/api/v1/compensations', ['originalSessionId' => 'se_x', 'studentId' => 'st_x', 'reason' => 'x']],
            ['POST', "/api/v1/compensations/$id/schedule", ['date' => '2026-01-01', 'startTime' => '14:00', 'endTime' => '15:00']],
            ['POST', "/api/v1/compensations/$id/complete", []],
        ];
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        foreach ($this->endpoints('cp_1') as [$method, $uri, $body]) {
            $this->json($method, $uri, $body)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        }
    }

    public function test_reading_requires_schedule_read(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();
        $id = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ])->assertCreated()->json('data.id');

        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role, $role === 'teacher' ? ['teacher_id' => 't1'] : []);
            $this->getJson('/api/v1/compensations')
                ->assertOk()
                ->assertJsonPath('meta.page', 1);
            // Teachers read through their own scope: t1's class is visible.
            if ($role === 'teacher') {
                $this->getJson("/api/v1/compensations/$id")->assertOk();
            }
        }

        // Accounting holds no `schedule.read` at all.
        $this->actingAsRole('accountant');
        $this->getJson('/api/v1/compensations')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.read');
        $this->getJson("/api/v1/compensations/$id")
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.read');
    }

    public function test_writing_requires_schedule_write(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();

        foreach (['administrator', 'manager', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/compensations', [
                'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => "جبرانی $role",
            ])->assertCreated();
            // Pair is consumed by the first write; make a fresh pair per role.
            [$class, $student, $session] = $this->makeRegistrable();
        }

        // Teachers and accountants hold no `schedule.write`.
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(403)->assertJsonPath('error.permission', 'schedule.write');
        $this->actingAsRole('accountant');
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(403)->assertJsonPath('error.permission', 'schedule.write');
    }

    public function test_forbidden_precedes_validation_and_lookup(): void
    {
        // The policy (and the PB-1 scope check) run before validation and
        // before the lookup, so an unauthorized caller learns nothing about
        // field rules or ids.
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->postJson('/api/v1/compensations', ['reason' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.write');
        $this->postJson('/api/v1/compensations/cp_missing/schedule', ['date' => 'nope'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.write');
        $this->postJson('/api/v1/compensations/cp_missing/complete', [])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.write');
    }

    public function test_teacher_scope_is_classes_not_organization(): void
    {
        $this->actingAsRole('manager');
        [$classA] = [$this->makePrivateClass('t1')];
        $studentA = $this->makeStudent();
        $this->enroll($classA->id, $studentA->id);
        $sessionA = $this->makeCancelledSession($classA->id, 't1');
        $idA = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $sessionA->id, 'studentId' => $studentA->id, 'reason' => 'الف',
        ])->assertCreated()->json('data.id');

        $classB = $this->makePrivateClass('t2');
        $studentB = $this->makeStudent();
        $this->enroll($classB->id, $studentB->id);
        $sessionB = $this->makeCancelledSession($classB->id, 't2');
        $idB = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $sessionB->id, 'studentId' => $studentB->id, 'reason' => 'ب',
        ])->assertCreated()->json('data.id');

        // A linked teacher sees exactly their own classes' obligations.
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $page = $this->getJson('/api/v1/compensations?per_page=200')->assertOk();
        $this->assertSame([$idA], array_column($page->json('data'), 'id'));
        $this->getJson("/api/v1/compensations/$idA")->assertOk();
        $this->getJson("/api/v1/compensations/$idB")->assertStatus(404);
    }

    public function test_unlinked_teacher_fails_closed_with_pb1(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => null]);

        $this->getJson('/api/v1/compensations')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson('/api/v1/compensations', ['originalSessionId' => 'se_x', 'studentId' => 'st_x', 'reason' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
    }

    public function test_unknown_obligation_is_404(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/compensations/cp_missing')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'COMPENSATION_NOT_FOUND');
        $this->postJson('/api/v1/compensations/cp_missing/schedule', ['date' => '2026-02-01', 'startTime' => '14:00', 'endTime' => '15:00'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'COMPENSATION_NOT_FOUND');
        $this->postJson('/api/v1/compensations/cp_missing/complete', [])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'COMPENSATION_NOT_FOUND');
    }

    public function test_register_validates_the_original_and_the_student(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();

        // Unknown original.
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => 'se_missing', 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(404)->assertJsonPath('error.code', 'COMPENSATION_ORIGINAL_NOT_FOUND');

        // Non-cancelled original.
        $live = ClassSession::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'class_id' => $class->id, 'teacher_id' => 't1', 'room_id' => 'r1', 'status' => 'scheduled',
        ]);
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $live->id, 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_ORIGINAL_NOT_CANCELLED');

        // Group class, even with one student.
        $group = AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id, 'kind' => 'group', 'teacher_id' => 't1', 'room_id' => 'r1',
        ]);
        $groupSession = ClassSession::factory()->cancelled()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'class_id' => $group->id, 'teacher_id' => 't1', 'room_id' => 'r1',
        ]);
        $this->enroll($group->id, $student->id);
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $groupSession->id, 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_CLASS_NOT_PRIVATE');

        // Empty roster.
        $lonely = $this->makePrivateClass('t9');
        $lonelySession = $this->makeCancelledSession($lonely->id, 't9');
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $lonelySession->id, 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_NO_AFFECTED_STUDENT');

        // Wrong student (checked while the roster still names exactly one
        // student; adding a second one afterwards exercises ambiguity).
        $other = $this->makeStudent();
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $other->id, 'reason' => 'x',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_STUDENT_MISMATCH');

        // Ambiguous roster.
        $this->enroll($class->id, $other->id);
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'x',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_ROSTER_AMBIGUOUS');

        // Missing reason.
        $soloClass = $this->makePrivateClass('t8');
        $soloStudent = $this->makeStudent();
        $this->enroll($soloClass->id, $soloStudent->id);
        $soloSession = $this->makeCancelledSession($soloClass->id, 't8');
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $soloSession->id, 'studentId' => $soloStudent->id, 'reason' => '  ',
        ])->assertStatus(422)->assertJsonPath('error.code', 'COMPENSATION_INVALID');
    }

    public function test_register_honours_attendance_evidence(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();
        AttendanceRecord::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'session_id' => $session->id,
            'student_id' => $student->id,
            'status' => 'present',
        ]);

        // A mark on the cancelled original requires an explicit decision.
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_ORIGINAL_ATTENDANCE_UNACKNOWLEDGED');

        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
            'acknowledgedOriginalAttendance' => true,
        ])->assertCreated();
        $this->assertNotNull(
            Compensation::query()->where('original_session_id', $session->id)->value('original_attendance_acknowledged_at')
        );
    }

    public function test_pair_lifetime_uniqueness_no_upsert(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();
        $payload = ['originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی'];

        $id = $this->postJson('/api/v1/compensations', $payload)->assertCreated()->json('data.id');

        // An open obligation refuses a second registration for the pair.
        $this->postJson('/api/v1/compensations', $payload)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'COMPENSATION_ALREADY_OPEN');

        // Discharging does NOT reopen registration: the pair is settled forever.
        // The date may fall outside the class's scheduled weekdays depending
        // on the day the suite runs (factory days are Sun/Tue); acknowledge
        // the off-schedule warning so this lifecycle test does not depend on
        // the calendar — the warning gate itself is covered by scheduling tests.
        $this->postJson("/api/v1/compensations/$id/schedule", [
            'date' => Carbon::today()->addDays(10)->toDateString(), 'startTime' => '14:00', 'endTime' => '15:00',
            'acknowledgeWarnings' => true,
        ])->assertOk();
        $this->postJson("/api/v1/compensations/$id/complete", [])->assertOk();
        $this->postJson('/api/v1/compensations', $payload)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'COMPENSATION_ALREADY_SETTLED');
    }

    public function test_makeup_cap_is_enforced(): void
    {
        $this->actingAsRole('administrator');
        $org = $this->defaultOrganization();
        $org->max_makeups_per_term = 0;
        $org->save();

        [$class, $student, $session] = $this->makeRegistrable();
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_MAKEUP_CAP_REACHED');
    }

    public function test_sender_identity_comes_from_the_token(): void
    {
        $manager = $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();

        // A forged actor in the payload is ignored: the record names the
        // authenticated user, and a forged permission grants nothing.
        $created = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id,
            'studentId' => $student->id,
            'reason' => 'جبرانی',
            'actor' => ['userId' => 'u_impostor', 'permissions' => []],
        ])->assertCreated();

        $this->assertSame($manager->id, $created->json('data.requiredByUserId'));
        $this->assertSame($manager->id, Compensation::query()->whereKey($created->json('data.id'))->value('required_by_user_id'));
    }

    public function test_schedule_books_an_ordinary_session_and_complete_discharges(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();
        $id = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ])->assertCreated()->json('data.id');

        // Completing with no booking is refused.
        $this->postJson("/api/v1/compensations/$id/complete", [])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'COMPENSATION_NOT_SCHEDULED');

        $booked = $this->postJson("/api/v1/compensations/$id/schedule", [
            'date' => Carbon::today()->addDays(10)->toDateString(), 'startTime' => '14:00', 'endTime' => '15:00',
            'acknowledgeWarnings' => true,
        ])->assertOk()->assertJsonPath('data.status', 'scheduled');
        $bookedId = $booked->json('data.currentAttempt.sessionId');
        $this->assertNotSame($session->id, $bookedId);
        $this->assertSame(0, $booked->json('data.currentAttempt.rescheduleCount'));
        $this->assertSame('scheduled', ClassSession::query()->whereKey($bookedId)->value('status'));
        $this->assertSame('manual', ClassSession::query()->whereKey($bookedId)->value('origin'));

        // A second booking while the make-up is live is refused.
        $this->postJson("/api/v1/compensations/$id/schedule", [
            'date' => Carbon::today()->addDays(11)->toDateString(), 'startTime' => '14:00', 'endTime' => '15:00',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_ALREADY_SCHEDULED');

        // Discharge is terminal.
        $this->postJson("/api/v1/compensations/$id/complete", [])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
        $this->postJson("/api/v1/compensations/$id/complete", [])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'COMPENSATION_ALREADY_SETTLED');
        $this->postJson("/api/v1/compensations/$id/schedule", [
            'date' => Carbon::today()->addDays(12)->toDateString(), 'startTime' => '14:00', 'endTime' => '15:00',
        ])->assertStatus(409)->assertJsonPath('error.code', 'COMPENSATION_ALREADY_SETTLED');
    }

    public function test_move_keeps_the_makeup_live_and_cancel_returns_required(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();
        $id = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ])->assertCreated()->json('data.id');
        $bookedId = $this->postJson("/api/v1/compensations/$id/schedule", [
            'date' => Carbon::today()->addDays(10)->toDateString(), 'startTime' => '14:00', 'endTime' => '15:00',
            'acknowledgeWarnings' => true,
        ])->assertOk()->json('data.currentAttempt.sessionId');

        // Moving the make-up keeps the obligation scheduled — on the new row.
        // The new date falls outside the class's scheduled weekdays, which the
        // conflict engine reports as a warning the operator must acknowledge.
        $moved = $this->postJson("/api/v1/sessions/$bookedId/reschedule", [
            'date' => Carbon::today()->addDays(11)->toDateString(),
            'startTime' => '14:00',
            'endTime' => '15:00',
            'reason' => 'جابه‌جایی',
            'acknowledgeWarnings' => true,
        ])->assertOk()->json('data.id');

        $shown = $this->getJson("/api/v1/compensations/$id")->assertOk();
        $this->assertSame('scheduled', $shown->json('data.status'));
        $this->assertSame($moved, $shown->json('data.currentAttempt.sessionId'));
        $this->assertSame($bookedId, $shown->json('data.currentAttempt.bookedSessionId'));
        $this->assertSame(1, $shown->json('data.currentAttempt.rescheduleCount'));

        // Cancelling the effective make-up returns the obligation to required.
        $this->postJson("/api/v1/sessions/$moved/cancel", ['reason' => 'لغو دوباره'])->assertOk();
        $this->getJson("/api/v1/compensations/$id")
            ->assertOk()
            ->assertJsonPath('data.status', 'required')
            ->assertJsonPath('data.attemptBroken', true);
    }

    public function test_tenant_isolation_is_404(): void
    {
        $this->actingAsRole('manager');
        [$class, $student, $session] = $this->makeRegistrable();
        $id = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $session->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ])->assertCreated()->json('data.id');

        $foreign = $this->makeOrganization();
        $this->actingAsRole('manager', [], $foreign);
        $this->getJson("/api/v1/compensations/$id")->assertStatus(404);
        $this->getJson('/api/v1/compensations')->assertJsonPath('meta.total', 0);
    }

    public function test_list_accepts_the_snake_case_wire_filters(): void
    {
        // The Api repository sends snake_case (toQuery); a controller that
        // only read camelCase would silently ignore every filter. The second
        // pair is built after the first HTTP round trip so the tenant-scoped
        // teacher/room reuse sees the seeded rows (see ActsAsRole::call).
        $this->actingAsRole('manager');
        [$classA, $studentA, $sessionA] = $this->makeRegistrable();
        $idA = $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $sessionA->id, 'studentId' => $studentA->id, 'reason' => 'الف',
        ])->assertCreated()->json('data.id');

        [$classB, $studentB, $sessionB] = $this->makeRegistrable();
        $this->postJson('/api/v1/compensations', [
            'originalSessionId' => $sessionB->id, 'studentId' => $studentB->id, 'reason' => 'ب',
        ])->assertCreated();

        $page = $this->getJson("/api/v1/compensations?student_id={$studentA->id}&per_page=200")->assertOk();
        $this->assertSame([$idA], array_column($page->json('data'), 'id'));

        $page = $this->getJson('/api/v1/compensations?status=required&per_page=200')->assertOk();
        $this->assertSame(2, $page->json('meta.total'));

        $page = $this->getJson('/api/v1/compensations?open_only=1&per_page=200')->assertOk();
        $this->assertSame(2, $page->json('meta.total'));
    }

    public function test_compensation_uses_the_existing_messages_vocabulary(): void
    {
        // Deliberately no new ids: the suite that guards the vocabulary must
        // stay green without additions.
        $this->assertContains('schedule.read', config('permissions.vocabulary'));
        $this->assertContains('schedule.write', config('permissions.vocabulary'));
        $this->assertNotContains('compensation.read', config('permissions.vocabulary'));
        $this->assertNotContains('compensation.write', config('permissions.vocabulary'));
    }

    public function test_service_round_trip_and_pair_scope(): void
    {
        $org = $this->defaultOrganization();
        $this->bindTenant($org);
        $service = app(CompensationService::class);
        $manager = $this->makeUser('manager');

        $class = $this->makePrivateClass('t1');
        $student = $this->makeStudent();
        Enrollment::factory()->create([
            'organization_id' => $org->id, 'class_id' => $class->id, 'student_id' => $student->id, 'status' => 'active',
        ]);
        $original = $this->makeCancelledSession($class->id, 't1');

        $thread = $service->register($manager, [
            'originalSessionId' => $original->id, 'studentId' => $student->id, 'reason' => 'جبرانی',
        ]);
        $this->assertSame('required', $thread['status']);
        $this->assertSame($manager->id, $thread['requiredByUserId']);

        $foreign = Compensation::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->assertApiError('COMPENSATION_NOT_FOUND', 404, fn () => $service->get($manager, $foreign->id));
    }

    private function assertApiError(string $code, int $status, callable $call): void
    {
        try {
            $call();
            $this->fail("Expected ApiException $code");
        } catch (ApiException $e) {
            $this->assertSame($code, $e->errorCode);
            $this->assertSame($status, $e->status);
        }
    }
}
