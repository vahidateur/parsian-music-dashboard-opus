<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Room;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Scheduling: the wire contract of src/domains/scheduling/apiRepository.ts.
 *
 * Teacher has schedule.read but NOT schedule.write in the shipped vocabulary —
 * teachers teach the schedule, they do not author it. That asymmetry is
 * asserted, not assumed.
 */
class SchedulingTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $org = $this->defaultOrganization()->id;
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1', 'status' => 'active']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't9', 'status' => 'active']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't_off', 'status' => 'inactive']);
        Room::factory()->create(['organization_id' => $org, 'id' => 'r1', 'active' => true]);
        Room::factory()->create(['organization_id' => $org, 'id' => 'r2', 'active' => true]);
    }

    private function klass(array $attributes = []): AcademyClass
    {
        return AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'teacher_id' => 't1',
            'room_id' => 'r1',
            'days' => [0, 1, 2, 3, 4, 5, 6],
            'time' => '10:00',
            'duration' => 60,
            ...$attributes,
        ]);
    }

    /** @param  array<string, mixed>  $attributes */
    private function makeSession(array $attributes = []): ClassSession
    {
        return ClassSession::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'teacher_id' => 't1',
            'room_id' => 'r1',
            ...$attributes,
        ]);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return [
            'classId' => $this->klass()->id,
            'date' => Carbon::today()->addDays(3)->toDateString(),
            'startTime' => '14:00',
            'endTime' => '15:00',
            'teacherId' => 't1',
            'roomId' => 'r1',
            ...$overrides,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* authorization                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/sessions')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/sessions', [])->assertStatus(401);
        $this->postJson('/api/v1/sessions/generate', [])->assertStatus(401);
        $this->postJson('/api/v1/sessions/check-conflicts', [])->assertStatus(401);
    }

    public function test_teacher_reads_schedule_but_cannot_write_it(): void
    {
        $id = $this->makeSession()->id;
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/sessions')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson("/api/v1/sessions/$id")->assertOk();
        $this->getJson("/api/v1/sessions/$id/roster")->assertOk();

        // schedule.write is NOT in the teacher role's defaults.
        $this->postJson('/api/v1/sessions', $this->payload())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'schedule.write');
        $this->patchJson("/api/v1/sessions/$id", ['notes' => 'x'])->assertStatus(403);
        $this->deleteJson("/api/v1/sessions/$id")->assertStatus(403);
        $this->postJson("/api/v1/sessions/$id/cancel", ['reason' => 'x'])->assertStatus(403);
    }

    public function test_accountant_has_no_schedule_permission_at_all(): void
    {
        $this->actingAsRole('accountant');

        $this->getJson('/api/v1/sessions')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.read');
    }

    /** PB-1: a teacher with no teacherId fails closed — neither empty nor org-wide. */
    public function test_teacher_without_teacher_id_is_pb1_403(): void
    {
        $this->makeSession();
        $this->actingAsRole('teacher', ['teacher_id' => null]);

        $this->getJson('/api/v1/sessions')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->getJson('/api/v1/sessions/ses_x/roster')->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson('/api/v1/sessions/check-conflicts', $this->payload())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
    }

    /**
     * PB-1 was resolved on 2026-10-02 as option A — fail-closed — and it must
     * close EVERY session endpoint for a teacher with no teacherId, not only the
     * reads. Generation and the write verbs did not enforce it before: the
     * preview was reachable through schedule.read, and the writes answered a
     * bare FORBIDDEN instead.
     */
    public function test_pb1_closes_generation_and_every_session_write(): void
    {
        $class = $this->klass();
        $sessionId = $this->makeSession()->id;
        $this->actingAsRole('teacher', ['teacher_id' => null]);

        $body = [
            'classId' => $class->id,
            'from' => Carbon::today()->addDay()->toDateString(),
            'to' => Carbon::today()->addDays(2)->toDateString(),
        ];

        $this->postJson('/api/v1/sessions/generate?preview=1', $body)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson('/api/v1/sessions/generate', $body)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');

        // Scope is answered before the permission check, so these report PB-1
        // rather than a bare FORBIDDEN — the precedence the students slice uses.
        $this->postJson('/api/v1/sessions', $this->payload())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->patchJson("/api/v1/sessions/{$sessionId}", ['notes' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson("/api/v1/sessions/{$sessionId}/cancel", ['reason' => 'دلیل'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson("/api/v1/sessions/{$sessionId}/reschedule", [
            'date' => Carbon::today()->addDays(9)->toDateString(),
            'startTime' => '08:00', 'endTime' => '09:00', 'reason' => 'دلیل',
        ])->assertStatus(403)->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->deleteJson("/api/v1/sessions/{$sessionId}")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');

        // Nothing was written and nothing was cancelled.
        $this->assertDatabaseCount('class_sessions', 1);
        $this->assertDatabaseHas('class_sessions', ['id' => $sessionId, 'status' => 'scheduled']);
    }

    /** The PB-1 guard must be a no-op for a teacher WITH a linked teacherId. */
    public function test_teacher_with_teacher_id_is_unaffected_by_the_pb1_guard(): void
    {
        $sessionId = $this->makeSession(['teacher_id' => 't1'])->id;
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/sessions')->assertOk()->assertJsonPath('meta.total', 1);
        $this->postJson('/api/v1/sessions/generate?preview=1', [
            'classId' => $this->klass()->id,
            'from' => Carbon::today()->addDay()->toDateString(),
            'to' => Carbon::today()->addDays(2)->toDateString(),
        ])->assertOk();
        // schedule.write is still what blocks the write, not PB-1.
        $this->postJson('/api/v1/sessions', $this->payload())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'schedule.write');
        $this->deleteJson("/api/v1/sessions/{$sessionId}")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        unset($sessionId);
    }

    /** T-02 extension: sessions the actor does not teach are invisible, not 403. */
    public function test_teacher_sees_only_own_sessions(): void
    {
        $mine = $this->makeSession(['teacher_id' => 't1', 'room_id' => 'r1'])->id;
        $theirs = $this->makeSession(['teacher_id' => 't9', 'room_id' => 'r2'])->id;

        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/sessions')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $mine);

        // Out of scope reads as 404, so ids are not enumerable.
        $this->getJson("/api/v1/sessions/$theirs")->assertStatus(404)
            ->assertJsonPath('error.code', 'SESSION_NOT_FOUND');

        unset($mine, $theirs);
    }

    /* ------------------------------------------------------------------ */
    /* writes                                                              */
    /* ------------------------------------------------------------------ */

    public function test_manager_creates_a_session(): void
    {
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/sessions', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.origin', 'manual')
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.startTime', '14:00');
    }

    /** A second booking of the same room at an overlapping time is HARD. */
    public function test_overlapping_room_booking_is_a_hard_conflict(): void
    {
        $this->makeSession([
            'date' => $date = Carbon::today()->addDays(3)->toDateString(),
            'start_time' => '14:00',
            'end_time' => '15:00',
            'room_id' => 'r1',
            'teacher_id' => 't9',
        ]);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/sessions', $this->payload())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'SESSION_CONFLICT')
            ->assertJsonPath('error.conflicts.hard.0.kind', 'SESSION_ROOM_CONFLICT')
            ->assertJsonPath('error.conflicts.ok', false);

        $this->assertSame($date, $date);
    }

    public function test_adjacent_slot_is_not_a_conflict(): void
    {
        $this->makeSession([
            'date' => Carbon::today()->addDays(3)->toDateString(),
            'start_time' => '13:00',
            'end_time' => '14:00',   // exclusive end: touches, does not overlap
            'room_id' => 'r1',
            'teacher_id' => 't1',
        ]);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/sessions', $this->payload())->assertStatus(201);
    }

    public function test_inactive_room_warns_and_requires_acknowledgement(): void
    {
        $this->actingAsRole('manager');
        $body = $this->payload(['roomId' => 'r2', 'teacherId' => 't_off']);

        $this->postJson('/api/v1/sessions', $body)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'SESSION_WARNINGS_UNACKNOWLEDGED')
            ->assertJsonPath('error.conflicts.ok', true)
            ->assertJsonPath('error.conflicts.warnings.0.kind', 'SESSION_RESOURCE_INACTIVE');

        $this->postJson('/api/v1/sessions', [...$body, 'acknowledgeWarnings' => true])->assertStatus(201);
    }

    public function test_check_conflicts_reports_hard_teacher_clash(): void
    {
        $this->makeSession([
            'date' => Carbon::today()->addDays(3)->toDateString(),
            'start_time' => '14:30',
            'end_time' => '15:30',
            'teacher_id' => 't1',
            'room_id' => 'r2',
        ]);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/sessions/check-conflicts', $this->payload())
            ->assertOk()
            ->assertJsonPath('data.ok', false)
            ->assertJsonPath('data.hard.0.kind', 'SESSION_TEACHER_CONFLICT');
    }

    /* ------------------------------------------------------------------ */
    /* cancel / reschedule / delete                                        */
    /* ------------------------------------------------------------------ */

    public function test_cancel_requires_a_reason_and_records_it(): void
    {
        $id = $this->makeSession()->id;
        $this->actingAsRole('manager');

        $this->postJson("/api/v1/sessions/$id/cancel", [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'SESSION_CANCEL_REASON_REQUIRED');

        $this->postJson("/api/v1/sessions/$id/cancel", ['reason' => 'مصدومیت مدرس'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.cancelReason', 'مصدومیت مدرس');

        $this->postJson("/api/v1/sessions/$id/cancel", ['reason' => 'دوباره'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'SESSION_ALREADY_CANCELLED');
    }

    /** Reschedule keeps the original and links both ways: history survives. */
    public function test_reschedule_links_original_and_replacement(): void
    {
        $original = $this->makeSession()->id;
        $this->actingAsRole('manager');

        $new = $this->postJson("/api/v1/sessions/$original/reschedule", [
            'date' => Carbon::today()->addDays(10)->toDateString(),
            'startTime' => '09:00',
            'endTime' => '10:00',
            'reason' => 'تغییر برنامهٔ مدرس',
        ])->assertStatus(200)->json('data');

        $this->assertNotSame($original, $new['id']);
        $this->assertSame($original, $new['rescheduledFromId']);

        $this->getJson("/api/v1/sessions/$original")->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.rescheduledToId', $new['id'])
            ->assertJsonPath('data.cancelReason', 'تغییر برنامهٔ مدرس');
    }

    public function test_delete_is_refused_once_attendance_exists(): void
    {
        $session = $this->makeSession();
        $org = $this->defaultOrganization()->id;
        $student = Student::factory()->create(['organization_id' => $org]);
        AttendanceRecord::factory()->create([
            'organization_id' => $org,
            'session_id' => $session->id,
            'student_id' => $student->id,
        ]);
        $this->actingAsRole('manager');

        $this->deleteJson("/api/v1/sessions/{$session->id}")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'SESSION_HAS_ATTENDANCE');

        $this->assertDatabaseHas('class_sessions', ['id' => $session->id]);
    }

    public function test_delete_succeeds_without_attendance(): void
    {
        $id = $this->makeSession()->id;
        $this->actingAsRole('manager');

        $this->deleteJson("/api/v1/sessions/$id")->assertStatus(204);
        $this->assertDatabaseMissing('class_sessions', ['id' => $id]);
    }

    /* ------------------------------------------------------------------ */
    /* roster                                                              */
    /* ------------------------------------------------------------------ */

    /** The roster is derived from active enrollment, never stored. */
    public function test_roster_excludes_withdrawn_students(): void
    {
        $session = $this->makeSession();
        $org = $this->defaultOrganization()->id;

        $staying = Student::factory()->create(['organization_id' => $org, 'name' => 'مانا']);
        $gone = Student::factory()->create(['organization_id' => $org, 'name' => 'رفته']);
        Enrollment::factory()->create(['organization_id' => $org, 'class_id' => $session->class_id, 'student_id' => $staying->id, 'status' => 'active']);
        Enrollment::factory()->create(['organization_id' => $org, 'class_id' => $session->class_id, 'student_id' => $gone->id, 'status' => 'withdrawn']);

        $this->actingAsRole('manager');

        $this->getJson("/api/v1/sessions/{$session->id}/roster")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentId', $staying->id)
            ->assertJsonPath('data.0.studentName', 'مانا');
    }

    /* ------------------------------------------------------------------ */
    /* generation                                                          */
    /* ------------------------------------------------------------------ */

    public function test_generate_preview_writes_nothing(): void
    {
        $class = $this->klass();
        $from = Carbon::today()->addDay();
        $to = $from->copy()->addDays(6);
        $this->actingAsRole('manager');

        $response = $this->postJson('/api/v1/sessions/generate?preview=1', [
            'classId' => $class->id,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ])->assertOk();

        // A preview returns the plan AS the item (`{ data: GenerationPlan }`),
        // matching ApiSchedulingRepository.previewGeneration().
        $this->assertCount(7, $response->json('data.creates'));
        $this->assertSame([], $response->json('data.skips'));
        $this->assertDatabaseCount('class_sessions', 0);   // preview is strictly read-only
    }

    public function test_generate_applies_deterministic_slot_ids(): void
    {
        $class = $this->klass();
        $this->actingAsRole('manager');

        $response = $this->postJson('/api/v1/sessions/generate', [
            'classId' => $class->id,
            'from' => Carbon::today()->addDay()->toDateString(),
            'to' => Carbon::today()->addDay()->toDateString(),
        ])->assertOk();

        $created = $response->json('data.created');
        $this->assertCount(1, $created);
        $this->assertSame('ses_'.$class->id.'_'.Carbon::today()->addDay()->format('Ymd').'_1000', $created[0]['id']);
        $this->assertSame('generated', $created[0]['origin']);
    }

    public function test_generate_window_over_180_days_is_refused(): void
    {
        $class = $this->klass();
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/sessions/generate', [
            'classId' => $class->id,
            'from' => Carbon::today()->toDateString(),
            'to' => Carbon::today()->addDays(200)->toDateString(),
        ])->assertStatus(422)->assertJsonPath('error.code', 'SESSION_GENERATION_WINDOW_INVALID');

        $this->assertDatabaseCount('class_sessions', 0);
    }

    public function test_teacher_may_preview_generation_but_not_commit_it(): void
    {
        $class = $this->klass();
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $body = [
            'classId' => $class->id,
            'from' => Carbon::today()->addDay()->toDateString(),
            'to' => Carbon::today()->addDays(2)->toDateString(),
        ];

        $this->postJson('/api/v1/sessions/generate?preview=1', $body)->assertOk();
        $this->postJson('/api/v1/sessions/generate', $body)
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'schedule.write');
        $this->assertDatabaseCount('class_sessions', 0);
    }

    /* ------------------------------------------------------------------ */
    /* tenancy                                                             */
    /* ------------------------------------------------------------------ */

    public function test_other_organizations_session_is_not_visible(): void
    {
        $other = $this->makeOrganization(['id' => 'org_other']);
        $foreign = ClassSession::factory()->create(['organization_id' => $other->id])->id;

        $this->actingAsRole('manager');

        $this->getJson('/api/v1/sessions')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson("/api/v1/sessions/$foreign")->assertStatus(404);
        $this->patchJson("/api/v1/sessions/$foreign", ['notes' => 'x'])->assertStatus(404);
    }
}
