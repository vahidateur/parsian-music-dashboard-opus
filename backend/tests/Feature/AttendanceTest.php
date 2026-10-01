<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\AttendanceCorrection;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Room;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Attendance: the wire contract of src/domains/attendance/apiRepository.ts.
 *
 * Two invariants distinguish this slice from the fixture it replaces:
 *   1. One record per (session, student) — a real UNIQUE constraint.
 *   2. A change is never a silent overwrite; it appends a correction carrying
 *      the previous value, the new value, the reason and the actor.
 *
 * Teacher has attendance.read + attendance.write (recording attendance is the
 * teacher's job); staff has read but not write. That asymmetry is asserted.
 */
class AttendanceTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $org = $this->defaultOrganization()->id;
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1', 'status' => 'active']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't9', 'status' => 'active']);
        Room::factory()->create(['organization_id' => $org, 'id' => 'r1', 'active' => true]);
    }

    private function session(array $attributes = []): ClassSession
    {
        $class = AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'teacher_id' => 't1',
            'room_id' => 'r1',
        ]);

        return ClassSession::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'class_id' => $class->id,
            'teacher_id' => 't1',
            'room_id' => 'r1',
            ...$attributes,
        ]);
    }

    private function enrolled(ClassSession $session, string $status = 'active'): Student
    {
        $org = $this->defaultOrganization()->id;
        $student = Student::factory()->create(['organization_id' => $org]);
        Enrollment::factory()->create([
            'organization_id' => $org,
            'student_id' => $student->id,
            'class_id' => $session->class_id,
            'status' => $status,
        ]);

        return $student;
    }

    /* ------------------------------------------------------------------ */
    /* authorization                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/attendance')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/attendance', [])->assertStatus(401);
        $this->postJson('/api/v1/attendance/bulk', [])->assertStatus(401);
        $this->getJson('/api/v1/attendance/corrections')->assertStatus(401);
    }

    public function test_staff_reads_attendance_but_cannot_record_it(): void
    {
        $this->session();
        $this->actingAsRole('staff');

        $this->getJson('/api/v1/attendance')->assertOk();
        $this->getJson('/api/v1/attendance/corrections')->assertOk();

        $this->postJson('/api/v1/attendance', ['sessionId' => 'x', 'studentId' => 'y', 'status' => 'present'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'attendance.write');
        $this->postJson('/api/v1/attendance/bulk', ['sessionId' => 'x', 'entries' => []])->assertStatus(403);
    }

    public function test_teacher_can_record_attendance_for_own_session(): void
    {
        $session = $this->session(['teacher_id' => 't1']);
        $student = $this->enrolled($session);
        $this->actingAsRole('teacher', ['teacher_id' => 't1', 'name' => 'مدرس تست']);

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id,
            'studentId' => $student->id,
            'status' => 'present',
        ])->assertStatus(201)
            ->assertJsonPath('data.recordedBy', 'مدرس تست');
    }

    /** PB-1: fail closed, neither an empty roster nor an org-wide one. */
    public function test_teacher_without_teacher_id_is_pb1_403(): void
    {
        $this->session();
        $this->actingAsRole('teacher', ['teacher_id' => null]);

        $this->getJson('/api/v1/attendance')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->postJson('/api/v1/attendance', ['sessionId' => 'x', 'studentId' => 'y', 'status' => 'present'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
        $this->getJson('/api/v1/attendance/corrections')->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');
    }

    /** T-02 extension: another teacher's session is out of reach entirely. */
    public function test_teacher_cannot_record_attendance_for_another_teachers_session(): void
    {
        $session = $this->session(['teacher_id' => 't9']);
        $student = $this->enrolled($session);
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id,
            'studentId' => $student->id,
            'status' => 'present',
        ])->assertStatus(404)
            ->assertJsonPath('error.code', 'ATTENDANCE_SESSION_NOT_FOUND');

        $this->assertDatabaseCount('attendance_records', 0);
    }

    /* ------------------------------------------------------------------ */
    /* recording                                                           */
    /* ------------------------------------------------------------------ */

    public function test_manager_records_attendance_once(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $this->actingAsRole('manager', ['name' => 'مدیر تست']);

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id,
            'studentId' => $student->id,
            'status' => 'late',
            'notes' => 'ده دقیقه تأخیر',
        ])->assertStatus(201)
            ->assertJsonPath('data.status', 'late')
            ->assertJsonPath('data.notes', 'ده دقیقه تأخیر')
            ->assertJsonPath('data.recordedBy', 'مدیر تست');

        $this->assertDatabaseCount('attendance_records', 1);
    }

    /**
     * Re-recording does NOT create a second row (UNIQUE session_id+student_id),
     * and it does NOT silently overwrite: a correction is appended.
     */
    public function test_rerecording_updates_in_place_and_appends_a_correction(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $this->actingAsRole('manager');

        $first = $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'present',
        ])->assertStatus(201)->json('data');

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'absent',
        ])->assertStatus(201)->assertJsonPath('data.status', 'absent');

        $this->assertDatabaseCount('attendance_records', 1);

        $corrections = AttendanceCorrection::query()->get();
        $this->assertCount(1, $corrections);
        $this->assertSame($first['id'], $corrections[0]->record_id);
        $this->assertSame('present', $corrections[0]->previous_status);
        $this->assertSame('absent', $corrections[0]->new_status);
    }

    public function test_invalid_status_is_422(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'maybe',
        ])->assertStatus(422)->assertJsonPath('error.code', 'ATTENDANCE_INVALID');
    }

    /* ------------------------------------------------------------------ */
    /* bulk                                                                */
    /* ------------------------------------------------------------------ */

    public function test_bulk_is_all_or_nothing(): void
    {
        $session = $this->session();
        $a = $this->enrolled($session);
        $b = $this->enrolled($session);
        $stranger = Student::factory()->create(['organization_id' => $this->defaultOrganization()->id]);
        $this->actingAsRole('manager');

        // One off-roster entry with no acknowledgement: nothing lands.
        $this->postJson('/api/v1/attendance/bulk', [
            'sessionId' => $session->id,
            'entries' => [
                ['studentId' => $a->id, 'status' => 'present'],
                ['studentId' => $b->id, 'status' => 'present'],
                ['studentId' => $stranger->id, 'status' => 'present'],
            ],
        ])->assertStatus(422)->assertJsonPath('error.code', 'ATTENDANCE_STUDENT_NOT_ENROLLED');

        $this->assertDatabaseCount('attendance_records', 0);

        // Acknowledged: all three land in one transaction.
        $this->postJson('/api/v1/attendance/bulk', [
            'sessionId' => $session->id,
            'entries' => [
                ['studentId' => $a->id, 'status' => 'present'],
                ['studentId' => $b->id, 'status' => 'late'],
                ['studentId' => $stranger->id, 'status' => 'absent'],
            ],
            'acknowledgeWarnings' => true,
        ])->assertOk()->assertJsonPath('meta.total', 3);

        $this->assertDatabaseCount('attendance_records', 3);
    }

    /** The UNIQUE constraint holds even against a direct, non-HTTP write. */
    public function test_unique_session_student_is_enforced_by_the_database(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $this->actingAsRole('manager');

        AttendanceRecord::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'session_id' => $session->id,
            'student_id' => $student->id,
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('attendance_records')->insert([
            'id' => 'att_dup',
            'organization_id' => $this->defaultOrganization()->id,
            'session_id' => $session->id,
            'student_id' => $student->id,
            'status' => 'present',
            'recorded_by_user_id' => 'u1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* corrections                                                         */
    /* ------------------------------------------------------------------ */

    public function test_correction_appends_audit_row_with_reason_and_actor(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $actor = $this->actingAsRole('manager', ['name' => 'سارا مدیر']);

        $record = $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'absent',
        ])->assertStatus(201)->json('data');

        $this->postJson("/api/v1/attendance/{$record['id']}/correct", [
            'status' => 'excused',
            'reason' => 'ارائهٔ گواهی پزشکی',
        ])->assertOk()->assertJsonPath('data.status', 'excused');

        $this->getJson('/api/v1/attendance/corrections')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.previousStatus', 'absent')
            ->assertJsonPath('data.0.newStatus', 'excused')
            ->assertJsonPath('data.0.reason', 'ارائهٔ گواهی پزشکی')
            ->assertJsonPath('data.0.changedBy', 'سارا مدیر');

        // The audit row records the authenticated user's id, never a body value.
        $this->assertSame($actor->id, AttendanceCorrection::query()->first()->changed_by_user_id);
    }

    public function test_correction_requires_a_reason_and_rejects_a_noop(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $this->actingAsRole('manager');

        $record = $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'present',
        ])->json('data');

        $this->postJson("/api/v1/attendance/{$record['id']}/correct", ['status' => 'absent'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ATTENDANCE_CORRECTION_REASON_REQUIRED');

        $this->postJson("/api/v1/attendance/{$record['id']}/correct", ['status' => 'present', 'reason' => 'همان است'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ATTENDANCE_CORRECTION_NOOP');

        $this->assertDatabaseCount('attendance_corrections', 0);
    }

    /* ------------------------------------------------------------------ */
    /* derived reads                                                       */
    /* ------------------------------------------------------------------ */

    public function test_session_attendance_returns_records_and_corrections(): void
    {
        $session = $this->session();
        $student = $this->enrolled($session);
        $this->actingAsRole('manager');

        $record = $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'present',
        ])->json('data');
        $this->postJson("/api/v1/attendance/{$record['id']}/correct", ['status' => 'absent', 'reason' => 'اشتباه تایپی']);

        $this->getJson("/api/v1/sessions/{$session->id}/attendance")
            ->assertOk()
            ->assertJsonPath('data.sessionId', $session->id)
            ->assertJsonCount(1, 'data.records')
            ->assertJsonPath('data.records.0.status', 'absent')
            ->assertJsonCount(1, 'data.corrections')
            ->assertJsonPath('data.corrections.0.previousStatus', 'present');
    }

    public function test_with_attendance_lists_only_sessions_that_have_records(): void
    {
        $with = $this->session();
        $without = $this->session();
        $student = $this->enrolled($with);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $with->id, 'studentId' => $student->id, 'status' => 'present',
        ])->assertStatus(201);

        $ids = $this->getJson('/api/v1/sessions/with-attendance')->assertOk()->json('data');
        $this->assertSame([$with->id], $ids);
        $this->assertNotContains($without->id, $ids);
    }

    public function test_attendance_filters(): void
    {
        $session = $this->session(['date' => Carbon::today()->addDays(2)->toDateString()]);
        $student = $this->enrolled($session);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/attendance', [
            'sessionId' => $session->id, 'studentId' => $student->id, 'status' => 'present',
        ])->assertStatus(201);

        $this->getJson('/api/v1/attendance?session_id='.$session->id)->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/attendance?student_id='.$student->id)->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/attendance?status=absent')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/attendance?since='.Carbon::today()->addDays(5)->toDateString())
            ->assertOk()->assertJsonPath('meta.total', 0);
    }

    /* ------------------------------------------------------------------ */
    /* tenancy                                                             */
    /* ------------------------------------------------------------------ */

    public function test_other_organizations_attendance_is_invisible(): void
    {
        $other = $this->makeOrganization(['id' => 'org_other']);
        $foreignSession = ClassSession::factory()->create(['organization_id' => $other->id]);
        $foreignStudent = Student::factory()->create(['organization_id' => $other->id]);
        AttendanceRecord::factory()->create([
            'organization_id' => $other->id,
            'session_id' => $foreignSession->id,
            'student_id' => $foreignStudent->id,
        ]);

        $this->actingAsRole('manager');

        $this->getJson('/api/v1/attendance')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/attendance/corrections')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/sessions/with-attendance')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/sessions/'.$foreignSession->id.'/attendance')->assertStatus(404);

        // Writing through another tenant's session id is refused, not accepted.
        $this->postJson('/api/v1/attendance', [
            'sessionId' => $foreignSession->id,
            'studentId' => $foreignStudent->id,
            'status' => 'present',
        ])->assertStatus(404)->assertJsonPath('error.code', 'ATTENDANCE_SESSION_NOT_FOUND');
    }
}
