<?php

namespace Tests\Feature;

use App\Models\ClassSession;
use App\Models\Organization;
use App\Models\Piece;
use App\Models\PieceAssignment;
use App\Models\ProgressEvent;
use App\Models\Student;
use App\Http\Resources\ProgressOverviewResource;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Progress slice 2 — the append-only event log, the assignment-history deletion
 * guard and the student overview.
 *
 * Still under the SAME two permission ids the owner authorized on 2026-10-03
 * (DECISIONS.md §29). Nothing was added to the vocabulary, and that is asserted
 * rather than assumed.
 *
 * Everything the overview computes — the thresholds, the order of the checks,
 * the recommendation rules — is transcribed from
 * `src/domains/progress/analytics.ts` and `recommendations.ts`, because the
 * contract is explicit that the server recomputes these over the FULL history
 * and the client is never the authority.
 */
class ProgressEventTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private const EVENTS = '/api/v1/progress-events';

    /** @param  array<string, mixed>  $pieceOverrides */
    private function makePiece(Organization $org, array $pieceOverrides = []): Piece
    {
        return Piece::factory()->create(['organization_id' => $org->id, ...$pieceOverrides]);
    }

    /** @param  array<string, mixed>  $pieceOverrides */
    private function makeStudent(Organization $org, array $pieceOverrides = [], array $assignmentOverrides = [], ?Student $student = null): array
    {
        $student ??= Student::factory()->create(['organization_id' => $org->id]);
        $piece = $this->makePiece($org, $pieceOverrides);

        $assignment = PieceAssignment::factory()->create([
            'organization_id' => $org->id,
            'student_id' => $student->id,
            'piece_id' => $piece->id,
            ...$assignmentOverrides,
        ]);

        return ['student' => $student, 'piece' => $piece, 'assignment' => $assignment];
    }

    /** @param  array<string, mixed>  $overrides */
    private function eventPayload(string $assignmentId, array $overrides = []): array
    {
        return [
            'assignmentId' => $assignmentId,
            'mastery' => 62,
            'source' => 'teacher',
            ...$overrides,
        ];
    }

    private function overviewUrl(Student $student): string
    {
        return '/api/v1/students/'.$student->id.'/progress-overview';
    }

    /** The 14th endpoint (slice 3): `AssignmentWithPiece[]`, unpaginated. */
    private function assignmentsUrl(Student $student): string
    {
        return '/api/v1/students/'.$student->id.'/assignments';
    }

    /* ------------------------------------------------------------------ */
    /* authorization                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401_on_every_verb(): void
    {
        $this->asGuest();

        $this->getJson(self::EVENTS)->assertStatus(401);
        $this->postJson(self::EVENTS, [])->assertStatus(401);
        $this->getJson('/api/v1/students/st_missing/progress-overview')->assertStatus(401);
    }

    public function test_reading_events_and_the_overview_requires_progress_read(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org);

        // administrator, manager, teacher and staff all hold progress.read.
        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::EVENTS)->assertOk();
            $this->getJson($this->overviewUrl($fixture['student']))->assertOk();
        }

        // The accountant holds no progress permission at all, and the refusal
        // names the permission the verb needs.
        $this->actingAsRole('accountant');
        $this->getJson(self::EVENTS)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'progress.read');
        $this->getJson($this->overviewUrl($fixture['student']))
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'progress.read');
    }

    public function test_recording_an_event_requires_progress_write(): void
    {
        // Each role writes against a fresh assignment so the one-open-assignment
        // rule is not what decides the outcome.
        foreach (['administrator', 'manager', 'teacher'] as $role) {
            $fixture = $this->makeStudent($this->defaultOrganization());
            $this->actingAsRole($role);
            $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id))->assertStatus(201);
        }

        // staff reads but does not author; the accountant has neither.
        foreach (['staff', 'accountant'] as $role) {
            $fixture = $this->makeStudent($this->defaultOrganization());
            $this->actingAsRole($role);
            $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id))
                ->assertStatus(403)
                ->assertJsonPath('error.code', 'FORBIDDEN')
                ->assertJsonPath('error.permission', 'progress.write');
        }

        // Nothing was written by a refused caller. Counted without the tenant
        // scope, because no request is in flight at this point.
        $this->assertDatabaseCount('progress_events', 3);
    }

    /** Authorization precedes validation: no 422 as an oracle for a 403. */
    public function test_the_permission_check_precedes_validation(): void
    {
        $this->actingAsRole('accountant');

        $this->postJson(self::EVENTS, ['mastery' => 9999])->assertStatus(403);
        $this->getJson(self::EVENTS.'?since=not-a-date')->assertStatus(403);

        // The refusal precedes the lookup, so no assignment is named back.
        $this->assertDatabaseCount('progress_events', 0);
    }

    /* ------------------------------------------------------------------ */
    /* tenant isolation                                                    */
    /* ------------------------------------------------------------------ */

    public function test_the_event_list_only_returns_the_callers_own_organization(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $a = $this->makeStudent($orgA);
        $b = $this->makeStudent($orgB);

        ProgressEvent::factory()->forAssignment($a['assignment'])->create();
        ProgressEvent::factory()->forAssignment($b['assignment'])->create();

        $this->actingAsRole('manager', [], $orgB);
        $this->getJson(self::EVENTS)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentId', $b['student']->id);
    }

    /**
     * Another organization's assignment is unreachable — 404, not 403 and not
     * 422 — for an actor who holds BOTH permissions, so the only thing between
     * them and that row is the tenant scope.
     */
    public function test_recording_against_another_organizations_assignment_is_404(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();
        $foreign = $this->makeStudent($orgA)['assignment'];

        $this->actingAsRole('manager', [], $orgB);
        $this->postJson(self::EVENTS, $this->eventPayload($foreign->id))
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ASSIGNMENT_NOT_FOUND');

        $this->assertDatabaseCount('progress_events', 0);
    }

    public function test_another_organizations_student_overview_is_404(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();
        $foreignStudent = $this->makeStudent($orgA)['student'];

        $this->actingAsRole('manager', [], $orgB);
        $this->getJson($this->overviewUrl($foreignStudent))
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'STUDENT_NOT_FOUND');
    }

    /** The session link is provenance, but a cross-tenant id must not be storable. */
    public function test_a_cross_tenant_session_id_is_refused(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();
        $fixture = $this->makeStudent($orgA);

        $ownSession = ClassSession::factory()->create(['organization_id' => $orgA->id]);
        $foreignSession = ClassSession::factory()->create(['organization_id' => $orgB->id]);

        $this->actingAsRole('manager', [], $orgA);

        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'sessionId' => $foreignSession->id,
        ]))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PROGRESS_INVALID');

        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'sessionId' => $ownSession->id,
        ]))
            ->assertStatus(201)
            ->assertJsonPath('data.sessionId', $ownSession->id);
    }

    /* ------------------------------------------------------------------ */
    /* the event contract                                                  */
    /* ------------------------------------------------------------------ */

    public function test_recording_returns_201_and_the_exact_event_shape(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org);

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, [
            'assignmentId' => $fixture['assignment']->id,
            'mastery' => 62,
            'tempoBpm' => 72,
            'targetTempoBpm' => 96,
            'rangeStart' => 1,
            'rangeEnd' => 12,
            'practiceMinutes' => 30,
            'teacherNote' => 'شروع قطعه.',
            'source' => 'teacher',
            'recordedAt' => '2026-07-23T00:00:00.000Z',
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.studentId', $fixture['student']->id)
            ->assertJsonPath('data.pieceId', $fixture['piece']->id)
            ->assertJsonPath('data.assignmentId', $fixture['assignment']->id)
            ->assertJsonPath('data.recordedAt', '2026-07-23T00:00:00.000Z')
            ->assertJsonPath('data.rangeStart', 1)
            ->assertJsonPath('data.rangeEnd', 12)
            ->assertJsonPath('data.tempoBpm', 72)
            ->assertJsonPath('data.targetTempoBpm', 96)
            ->assertJsonPath('data.mastery', 62)
            ->assertJsonPath('data.practiceMinutes', 30)
            ->assertJsonPath('data.teacherNote', 'شروع قطعه.')
            ->assertJsonPath('data.source', 'teacher');

        $this->assertDatabaseHas('progress_events', [
            'organization_id' => $org->id,
            'student_id' => $fixture['student']->id,
            'piece_id' => $fixture['piece']->id,
            'mastery' => 62,
        ]);
    }

    /**
     * The subject of an event is decided by the assignment, not by the caller.
     * Accepting `studentId`/`pieceId` would let a caller file a measurement
     * against one student's assignment while attributing it to another.
     */
    public function test_student_and_piece_come_from_the_assignment_never_the_client(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org);
        $otherStudent = Student::factory()->create(['organization_id' => $org->id]);
        $otherPiece = $this->makePiece($org);

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'studentId' => $otherStudent->id,
            'pieceId' => $otherPiece->id,
        ]))
            ->assertStatus(201)
            ->assertJsonPath('data.studentId', $fixture['student']->id)
            ->assertJsonPath('data.pieceId', $fixture['piece']->id);
    }

    /** @return array<string, array<int, mixed>> */
    public static function boundedFieldProvider(): array
    {
        return [
            'mastery above the scale' => [['mastery' => 101]],
            'mastery below the scale' => [['mastery' => -1]],
            'mastery missing' => [['mastery' => null]],
            'tempo too slow' => [['tempoBpm' => 19]],
            'tempo too fast' => [['tempoBpm' => 401]],
            'target tempo out of range' => [['targetTempoBpm' => 401]],
            'practice minutes out of range' => [['practiceMinutes' => 601]],
            'range end above the storage limit' => [['rangeStart' => 1, 'rangeEnd' => 100_001]],
            'unknown source' => [['source' => 'alien']],
            'source missing' => [['source' => null]],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     *
     * @dataProvider boundedFieldProvider
     */
    public function test_out_of_range_fields_are_refused(array $overrides): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization());

        $this->actingAsRole('teacher');
        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, $overrides))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PROGRESS_INVALID');

        $this->assertDatabaseCount('progress_events', 0);
    }

    public function test_recording_on_a_closed_assignment_is_refused(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), [], [
            'status' => 'completed',
            'closed_at' => now(),
        ]);

        $this->actingAsRole('teacher');
        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PROGRESS_INVALID')
            ->assertJsonPath('error.fields.assignmentId.0', 'این تخصیص بسته شده است و پیشرفت جدیدی نمی‌پذیرد.');
    }

    /** A freeform piece is subdivided by label, so numbers are meaningless. */
    public function test_a_numeric_range_is_refused_on_a_freeform_piece(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), ['range_unit' => 'freeform']);

        $this->actingAsRole('teacher');
        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'rangeStart' => 1,
            'rangeEnd' => 8,
        ]))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.rangeStart.0', 'این قطعه محدودهٔ عددی ندارد؛ از برچسب متنی استفاده کنید.');
    }

    public function test_a_range_label_is_required_on_a_freeform_piece(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), ['range_unit' => 'freeform']);

        $this->actingAsRole('teacher');
        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.rangeLabel.0', 'برای این قطعه، توضیح محدوده الزامی است.');

        // With the label, the same event is accepted.
        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'rangeLabel' => 'بخش آغازین',
        ]))->assertStatus(201);
    }

    public function test_range_end_cannot_exceed_the_pieces_total_range_or_precede_its_start(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), ['range_unit' => 'measure', 'total_range' => 40]);

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'rangeStart' => 1,
            'rangeEnd' => 41,
        ]))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.rangeEnd.0', 'این قطعه 40 میزان دارد.');

        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'rangeStart' => 12,
            'rangeEnd' => 8,
        ]))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.rangeEnd.0', 'پایان محدوده نمی‌تواند کوچک‌تر از شروع باشد.');
    }

    public function test_recorded_at_defaults_to_now_and_may_be_backdated(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization());

        $this->actingAsRole('teacher');

        // Defaults to now. Compared by clock distance rather than by string,
        // because the column stores whole seconds while `now()` carries
        // microseconds — an exact comparison would race the second boundary.
        $defaultedAt = $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id))
            ->assertStatus(201)
            ->json('data.recordedAt');

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $defaultedAt);
        $this->assertLessThan(5, abs(now()->diffInSeconds(\Illuminate\Support\Carbon::parse($defaultedAt))));

        // Back-datable: the moment of the observation, preserved exactly.
        $this->postJson(self::EVENTS, $this->eventPayload($fixture['assignment']->id, [
            'recordedAt' => '2026-01-05T10:00:00.000Z',
        ]))
            ->assertStatus(201)
            ->assertJsonPath('data.recordedAt', '2026-01-05T10:00:00.000Z');
    }

    /* ------------------------------------------------------------------ */
    /* the `latest` snapshot                                               */
    /* ------------------------------------------------------------------ */

    public function test_the_snapshot_stays_null_until_an_event_exists(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization());

        $this->actingAsRole('teacher');
        $this->getJson('/api/v1/piece-assignments/'.$fixture['assignment']->id)
            ->assertOk()
            ->assertJsonPath('data.latest', null);
    }

    /**
     * The snapshot is derived strictly from the log by `recorded_at`, so a
     * BACK-DATED entry appended last must not move it backwards — otherwise the
     * panel would disagree with the chart it draws from the same events.
     */
    public function test_the_snapshot_tracks_the_newest_event_by_recorded_at_not_by_insertion(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), [], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, $this->eventPayload($id, [
            'mastery' => 40, 'recordedAt' => '2026-01-01T00:00:00.000Z', 'tempoBpm' => 60,
        ]))->assertStatus(201);

        $secondId = $this->postJson(self::EVENTS, $this->eventPayload($id, [
            'mastery' => 70, 'recordedAt' => '2026-03-01T00:00:00.000Z', 'tempoBpm' => 76,
        ]))->json('data.id');

        $this->getJson('/api/v1/piece-assignments/'.$id)
            ->assertOk()
            ->assertJsonPath('data.latest.mastery', 70)
            ->assertJsonPath('data.latest.tempoBpm', 76)
            ->assertJsonPath('data.latest.recordedAt', '2026-03-01T00:00:00.000Z')
            ->assertJsonPath('data.latest.eventId', $secondId);

        // Appended LAST but recorded EARLIER: it must not become the snapshot.
        $this->postJson(self::EVENTS, $this->eventPayload($id, [
            'mastery' => 95, 'recordedAt' => '2026-02-01T00:00:00.000Z', 'tempoBpm' => 99,
        ]))->assertStatus(201);

        $this->getJson('/api/v1/piece-assignments/'.$id)
            ->assertOk()
            ->assertJsonPath('data.latest.mastery', 70)
            ->assertJsonPath('data.latest.eventId', $secondId);
    }

    public function test_a_newer_event_does_move_the_snapshot(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), [], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');
        $this->postJson(self::EVENTS, $this->eventPayload($id, ['mastery' => 40]));

        $newestId = $this->postJson(self::EVENTS, $this->eventPayload($id, [
            'mastery' => 88,
            'recordedAt' => now()->addDay()->format('Y-m-d\\TH:i:s.v\\Z'),
        ]))->json('data.id');

        $this->getJson('/api/v1/piece-assignments/'.$id)
            ->assertOk()
            ->assertJsonPath('data.latest.mastery', 88)
            ->assertJsonPath('data.latest.eventId', $newestId);
    }

    /* ------------------------------------------------------------------ */
    /* assignment history — the deletion guard                             */
    /* ------------------------------------------------------------------ */

    public function test_an_assignment_without_events_can_still_be_deleted(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization());
        $id = $fixture['assignment']->id;

        $this->actingAsRole('manager');
        $this->deleteJson('/api/v1/piece-assignments/'.$id)->assertStatus(204);
        $this->assertDatabaseMissing('piece_assignments', ['id' => $id]);
    }

    /**
     * The invariant the previous slice could only hold vacuously: a deletion
     * must never silently destroy the evidence every analytic is computed from.
     */
    public function test_an_assignment_with_progress_history_cannot_be_deleted(): void
    {
        $fixture = $this->makeStudent($this->defaultOrganization(), [], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');
        $this->postJson(self::EVENTS, $this->eventPayload($id))->assertStatus(201);

        $this->actingAsRole('manager');
        $this->deleteJson('/api/v1/piece-assignments/'.$id)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ASSIGNMENT_HAS_HISTORY');

        // The refusal left the history — and the assignment — intact.
        $this->assertDatabaseHas('piece_assignments', ['id' => $id]);
        $this->assertDatabaseCount('progress_events', 1);
    }

    public function test_another_organizations_assignment_cannot_be_deleted_at_all(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();
        $foreign = $this->makeStudent($orgA)['assignment'];

        $this->actingAsRole('manager', [], $orgB);
        $this->deleteJson('/api/v1/piece-assignments/'.$foreign->id)->assertStatus(404);
        $this->assertDatabaseHas('piece_assignments', ['id' => $foreign->id]);
    }

    /* ------------------------------------------------------------------ */
    /* the overview                                                        */
    /* ------------------------------------------------------------------ */

    public function test_the_overview_is_empty_but_well_shaped_for_a_student_with_no_work(): void
    {
        $student = Student::factory()->create(['organization_id' => $this->defaultOrganization()->id]);

        $this->actingAsRole('teacher');
        $this->getJson($this->overviewUrl($student))
            ->assertOk()
            ->assertJsonPath('data.assignments', [])
            ->assertJsonPath('data.insights', [])
            ->assertJsonPath('data.recommendations', [])
            ->assertJsonPath('data.recentEvents', []);
    }

    public function test_a_closed_assignment_is_history_not_current_work(): void
    {
        $org = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $org->id]);

        // Explicit timestamps so the ordering below cannot depend on ulid order.
        $this->makeStudent($org, [], [
            'status' => 'completed', 'closed_at' => now(), 'assigned_at' => now()->subDays(5),
        ], $student);
        $this->makeStudent($org, [], [
            'status' => 'learning', 'assigned_at' => now(),
        ], $student);

        $this->actingAsRole('teacher');
        $response = $this->getJson($this->overviewUrl($student))->assertOk();

        // Both assignments are listed, newest first; only the open one is
        // analysed — a closed one is history, not current work.
        $this->assertCount(2, $response->json('data.assignments'));
        $this->assertCount(1, $response->json('data.insights'));
        $this->assertSame('learning', $response->json('data.assignments.0.assignment.status'));
        $this->assertSame('completed', $response->json('data.assignments.1.assignment.status'));
    }

    public function test_insufficient_data_is_reported_differently_for_zero_and_one_event(): void
    {
        $org = $this->defaultOrganization();
        $first = $this->makeStudent($org, [], ['status' => 'learning']);

        $this->actingAsRole('teacher');

        $this->getJson($this->overviewUrl($first['student']))
            ->assertOk()
            ->assertJsonPath('data.insights.0.status', 'insufficient_data')
            ->assertJsonPath('data.insights.0.evidence.events', 0)
            ->assertJsonPath('data.recommendations.0.kind', 'record_progress')
            ->assertJsonPath('data.recommendations.0.reason', 'هنوز پیشرفتی برای این قطعه ثبت نشده است؛ بدون داده تحلیلی ممکن نیست.');

        $this->postJson(self::EVENTS, $this->eventPayload($first['assignment']->id))->assertStatus(201);

        $this->getJson($this->overviewUrl($first['student']))
            ->assertOk()
            ->assertJsonPath('data.insights.0.status', 'insufficient_data')
            ->assertJsonPath('data.insights.0.evidence.events', 1)
            ->assertJsonPath('data.recommendations.0.reason', 'برای تحلیل روند دست‌کم دو ثبت پیشرفت لازم است.');
    }

    /**
     * A plateau needs THREE trailing events on the same range spanning at least
     * ten days with neither mastery nor tempo moving. Two repeats is not enough,
     * and three repeats inside the window is not enough.
     */
    public function test_plateau_detection_needs_three_repeats_over_ten_days(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org, ['total_range' => 100], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');

        $flat = fn (string $at): array => [
            'mastery' => 50, 'tempoBpm' => 60, 'rangeStart' => 1, 'rangeEnd' => 8, 'recordedAt' => $at,
        ];

        // Two repeats: not yet a plateau, and not enough to be anything else.
        $this->postJson(self::EVENTS, $this->eventPayload($id, $flat('2026-01-01T00:00:00.000Z')))->assertStatus(201);
        $this->postJson(self::EVENTS, $this->eventPayload($id, $flat('2026-01-05T00:00:00.000Z')))->assertStatus(201);

        $this->getJson($this->overviewUrl($fixture['student']))
            ->assertOk()
            ->assertJsonPath('data.insights.0.status', 'stable')
            ->assertJsonPath('data.insights.0.evidence.rangeRepeats', 2);

        // A third repeat, now spanning fourteen days.
        $this->postJson(self::EVENTS, $this->eventPayload($id, $flat('2026-01-15T00:00:00.000Z')))->assertStatus(201);

        $this->getJson($this->overviewUrl($fixture['student']))
            ->assertOk()
            ->assertJsonPath('data.insights.0.status', 'possible_plateau')
            ->assertJsonPath('data.insights.0.evidence.rangeRepeats', 3)
            ->assertJsonPath('data.recommendations.0.kind', 'reduce_tempo')
            ->assertJsonPath('data.recommendations.0.priority', 'attention');
    }

    /** Same three repeats, but inside the ten-day window: still not a plateau. */
    public function test_three_repeats_inside_ten_days_is_not_a_plateau(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org, ['total_range' => 100], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');

        foreach (['2026-01-01', '2026-01-03', '2026-01-05'] as $day) {
            $this->postJson(self::EVENTS, $this->eventPayload($id, [
                'mastery' => 50, 'tempoBpm' => 60, 'rangeStart' => 1, 'rangeEnd' => 8,
                'recordedAt' => $day.'T00:00:00.000Z',
            ]))->assertStatus(201);
        }

        $this->getJson($this->overviewUrl($fixture['student']))
            ->assertOk()
            ->assertJsonPath('data.insights.0.status', 'stable');
    }

    /**
     * Losing ground outranks every other classification, including a plateau
     * whose conditions also hold — the more urgent fact is reported.
     */
    public function test_regression_outranks_the_plateau_it_also_satisfies(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org, ['total_range' => 100], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');

        foreach ([['2026-01-01', 60], ['2026-01-11', 50], ['2026-01-21', 40]] as [$day, $mastery]) {
            $this->postJson(self::EVENTS, $this->eventPayload($id, [
                'mastery' => $mastery, 'tempoBpm' => 60, 'rangeStart' => 1, 'rangeEnd' => 8,
                'recordedAt' => $day.'T00:00:00.000Z',
            ]))->assertStatus(201);
        }

        $this->getJson($this->overviewUrl($fixture['student']))
            ->assertOk()
            ->assertJsonPath('data.insights.0.status', 'regression')
            ->assertJsonPath('data.insights.0.evidence.masteryChange', -20)
            ->assertJsonPath('data.recommendations.0.kind', 'teacher_review')
            ->assertJsonPath('data.recommendations.0.priority', 'attention');
    }

    /** Highest urgency first, regardless of the order the assignments came in. */
    public function test_recommendations_are_sorted_attention_first(): void
    {
        $org = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $org->id]);

        // Listed first (newer), but only worth a suggestion.
        $improving = $this->makeStudent($org, ['total_range' => 100], [
            'status' => 'learning', 'assigned_at' => now()->subDay(),
        ], $student);
        // Listed second, but urgent.
        $regressing = $this->makeStudent($org, ['total_range' => 100], [
            'status' => 'learning', 'assigned_at' => now()->subDays(2),
        ], $student);

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, $this->eventPayload($improving['assignment']->id, [
            'mastery' => 40, 'rangeStart' => 1, 'rangeEnd' => 4, 'recordedAt' => '2026-01-01T00:00:00.000Z',
        ]))->assertStatus(201);
        $this->postJson(self::EVENTS, $this->eventPayload($improving['assignment']->id, [
            'mastery' => 70, 'rangeStart' => 5, 'rangeEnd' => 8, 'recordedAt' => '2026-01-20T00:00:00.000Z',
        ]))->assertStatus(201);

        $this->postJson(self::EVENTS, $this->eventPayload($regressing['assignment']->id, [
            'mastery' => 70, 'rangeStart' => 1, 'rangeEnd' => 4, 'recordedAt' => '2026-01-01T00:00:00.000Z',
        ]))->assertStatus(201);
        $this->postJson(self::EVENTS, $this->eventPayload($regressing['assignment']->id, [
            'mastery' => 40, 'rangeStart' => 5, 'rangeEnd' => 8, 'recordedAt' => '2026-01-20T00:00:00.000Z',
        ]))->assertStatus(201);

        $response = $this->getJson($this->overviewUrl($student))->assertOk();

        $priorities = collect($response->json('data.recommendations'))->pluck('priority')->all();

        $this->assertSame('attention', $priorities[0]);
        $this->assertSame($priorities, collect($priorities)->sortBy(
            fn (string $p): int => ['attention' => 0, 'suggested' => 1, 'info' => 2][$p],
        )->values()->all());
    }

    public function test_recent_events_are_newest_first_and_capped_at_twenty(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org, [], ['status' => 'learning']);

        // 25 events, one per day, oldest first.
        for ($i = 25; $i >= 1; $i--) {
            ProgressEvent::factory()->forAssignment($fixture['assignment'])->create([
                'recorded_at' => now()->subDays($i)->startOfDay(),
                'mastery' => 50,
            ]);
        }

        $this->actingAsRole('teacher');
        $response = $this->getJson($this->overviewUrl($fixture['student']))->assertOk();

        $this->assertCount(20, $response->json('data.recentEvents'));
        $this->assertSame(
            now()->subDay()->startOfDay()->format('Y-m-d\\TH:i:s.v\\Z'),
            $response->json('data.recentEvents.0.recordedAt'),
        );
    }

    /** Mastery 90 raises a completion question — except when already polishing. */
    public function test_the_completion_nudge_fires_at_mastery_90_but_not_while_polishing(): void
    {
        $org = $this->defaultOrganization();
        $learning = $this->makeStudent($org, [], ['status' => 'learning']);
        $polishing = $this->makeStudent($org, [], ['status' => 'polishing']);

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, $this->eventPayload($learning['assignment']->id, ['mastery' => 90]))->assertStatus(201);
        $this->postJson(self::EVENTS, $this->eventPayload($polishing['assignment']->id, ['mastery' => 90]))->assertStatus(201);

        $learningKinds = collect($this->getJson($this->overviewUrl($learning['student']))->json('data.recommendations'))
            ->pluck('kind')->all();
        $polishingKinds = collect($this->getJson($this->overviewUrl($polishing['student']))->json('data.recommendations'))
            ->pluck('kind')->all();

        $this->assertContains('consider_completion', $learningKinds);
        $this->assertNotContains('consider_completion', $polishingKinds);
    }

    /** A stale log needs an entry before any analysis can be trusted. */
    public function test_the_stale_nudge_fires_after_twenty_one_days(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org, ['total_range' => 100], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');

        $this->postJson(self::EVENTS, $this->eventPayload($id, [
            'mastery' => 50, 'rangeStart' => 1, 'rangeEnd' => 4,
            'recordedAt' => now()->subDays(40)->format('Y-m-d\\TH:i:s.v\\Z'),
        ]))->assertStatus(201);
        $this->postJson(self::EVENTS, $this->eventPayload($id, [
            'mastery' => 51, 'rangeStart' => 5, 'rangeEnd' => 8,
            'recordedAt' => now()->subDays(25)->format('Y-m-d\\TH:i:s.v\\Z'),
        ]))->assertStatus(201);

        $recommendations = $this->getJson($this->overviewUrl($fixture['student']))->json('data.recommendations');

        $stale = collect($recommendations)->firstWhere('kind', 'record_progress');

        $this->assertNotNull($stale);
        $this->assertSame('suggested', $stale['priority']);
        $this->assertStringContainsString('25 روز از آخرین ثبت پیشرفت گذشته است', $stale['reason']);
    }

    /**
     * DEFERRED BEHAVIOUR, asserted rather than invented: learning has no
     * server-side representation (PB-3 stays Option A for it), so nothing is
     * eligible and `suggestedContentIds` is always empty. That is the safe
     * direction — a recommendation must never surface material the student is
     * not permitted to open (§21).
     */
    public function test_suggested_content_is_always_empty_because_learning_has_no_server_tables(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org, ['total_range' => 100], ['status' => 'learning']);
        $id = $fixture['assignment']->id;

        $this->actingAsRole('teacher');

        foreach ([['2026-01-01', 60], ['2026-01-11', 50], ['2026-01-21', 40]] as [$day, $mastery]) {
            $this->postJson(self::EVENTS, $this->eventPayload($id, [
                'mastery' => $mastery, 'tempoBpm' => 60, 'rangeStart' => 1, 'rangeEnd' => 8,
                'recordedAt' => $day.'T00:00:00.000Z',
            ]))->assertStatus(201);
        }

        $recommendations = $this->getJson($this->overviewUrl($fixture['student']))->json('data.recommendations');
        $this->assertNotEmpty($recommendations);

        foreach ($recommendations as $recommendation) {
            $this->assertSame([], $recommendation['suggestedContentIds']);
        }
    }

    /* ------------------------------------------------------------------ */
    /* event listing                                                       */
    /* ------------------------------------------------------------------ */

    public function test_events_filter_by_student_piece_assignment_and_time(): void
    {
        $org = $this->defaultOrganization();
        $a = $this->makeStudent($org);
        $b = $this->makeStudent($org);

        ProgressEvent::factory()->forAssignment($a['assignment'])->create(['recorded_at' => '2026-01-10 00:00:00']);
        ProgressEvent::factory()->forAssignment($b['assignment'])->create(['recorded_at' => '2026-03-10 00:00:00']);

        $this->actingAsRole('teacher');

        $this->getJson(self::EVENTS)->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson(self::EVENTS.'?student_id='.$a['student']->id)->assertJsonPath('meta.total', 1);
        $this->getJson(self::EVENTS.'?piece_id='.$a['piece']->id)->assertJsonPath('meta.total', 1);
        $this->getJson(self::EVENTS.'?assignment_id='.$b['assignment']->id)->assertJsonPath('meta.total', 1);
        $this->getJson(self::EVENTS.'?since=2026-02-01T00:00:00.000Z')->assertJsonPath('meta.total', 1);
        $this->getJson(self::EVENTS.'?until=2026-02-01T00:00:00.000Z')->assertJsonPath('meta.total', 1);

        // Newest first.
        $this->getJson(self::EVENTS)
            ->assertJsonPath('data.0.studentId', $b['student']->id);
    }

    /* ------------------------------------------------------------------ */
    /* governance                                                          */
    /* ------------------------------------------------------------------ */

    /** Slice 2 added no permission: the vocabulary is still exactly 25 ids. */
    public function test_the_permission_vocabulary_is_still_exactly_twenty_five_ids(): void
    {
        $vocabulary = config('permissions.vocabulary');

        $this->assertCount(25, $vocabulary);
        $this->assertContains('progress.read', $vocabulary);
        $this->assertContains('progress.write', $vocabulary);
        $this->assertNotContains('progress.admin', $vocabulary);
        $this->assertNotContains('analytics.read', $vocabulary);
    }

    /* ------------------------------------------------------------------ */
    /* slice 3 — the 14th endpoint: GET /students/{id}/assignments        */
    /* ------------------------------------------------------------------ */

    /**
     * `GET /students/{id}/assignments` is the endpoint the post-closure audit
     * found missing: `ProgressRepository` requires `studentAssignments()` and
     * `ApiProgressRepository` implements it as
     * `students/{id}/assignments`, but no route existed, so the API repository
     * was not a complete implementation of its own interface.
     *
     * Authorized 2026-10-03 as a narrow addition to Progress. No new
     * permission: `progress.read` already governs this surface.
     */
    public function test_student_assignments_returns_every_assignment_joined_to_its_piece(): void
    {
        $org = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $org->id]);

        $older = $this->makeStudent($org, ['title' => 'قطعهٔ قدیمی'], ['assigned_at' => now()->subDays(3)], $student);
        $newer = $this->makeStudent($org, ['title' => 'قطعهٔ جدید'], ['assigned_at' => now()->subDay()], $student);

        $this->actingAsRole('teacher');

        $payload = $this->getJson($this->assignmentsUrl($student))->assertOk()->json('data');

        $this->assertIsArray($payload);
        $this->assertCount(2, $payload);

        // Newest assignment first.
        $this->assertSame($newer['assignment']->id, $payload[0]['assignment']['id']);
        $this->assertSame($older['assignment']->id, $payload[1]['assignment']['id']);

        // Every entry is TS `AssignmentWithPiece` — exactly {assignment, piece}.
        foreach ($payload as $entry) {
            $this->assertSame(['assignment', 'piece'], array_keys($entry));
        }

        // The join actually joined: identity, status and the piece fields.
        $this->assertSame((string) $newer['assignment']->status, $payload[0]['assignment']['status']);
        $this->assertSame((string) $newer['assignment']->student_id, $payload[0]['assignment']['studentId']);
        $this->assertSame($newer['piece']->id, $payload[0]['piece']['id']);
        $this->assertSame($newer['piece']->title, $payload[0]['piece']['title']);
    }

    /** Newest first, and `id` DESC breaks ties so the order is never random. */
    public function test_student_assignments_are_newest_first_with_a_stable_id_tie_break(): void
    {
        $org = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $org->id]);
        $shared = now()->subDay();

        $oldest = $this->makeStudent($org, [], ['assigned_at' => $shared->copy()->subDays(2)], $student);
        $tieLow = $this->makeStudent($org, [], ['assigned_at' => $shared, 'id' => 'as_aaa_low'], $student);
        $tieHigh = $this->makeStudent($org, [], ['assigned_at' => $shared, 'id' => 'as_zzz_high'], $student);

        $this->actingAsRole('teacher');

        $ids = collect($this->getJson($this->assignmentsUrl($student))->assertOk()->json('data'))
            ->pluck('assignment.id')
            ->all();

        $this->assertSame(
            [$tieHigh['assignment']->id, $tieLow['assignment']->id, $oldest['assignment']->id],
            $ids,
        );
    }

    /** A plain array, never a paginated envelope — that is the contract's shape. */
    public function test_student_assignments_is_an_empty_array_for_a_student_with_no_work(): void
    {
        $student = Student::factory()->create(['organization_id' => $this->defaultOrganization()->id]);

        $this->actingAsRole('teacher');

        $this->getJson($this->assignmentsUrl($student))
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonMissingPath('meta');
    }

    /** A foreign student is invisible, not empty — the id must not be confirmed. */
    public function test_another_organizations_student_assignments_are_404(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();
        $foreignStudent = $this->makeStudent($orgA)['student'];

        $this->actingAsRole('manager', [], $orgB);

        $this->getJson($this->assignmentsUrl($foreignStudent))
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'STUDENT_NOT_FOUND');
    }

    /** Same four roles as every other Progress read; the accountant holds none. */
    public function test_student_assignments_requires_progress_read(): void
    {
        $org = $this->defaultOrganization();
        $student = $this->makeStudent($org)['student'];

        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson($this->assignmentsUrl($student))->assertOk();
        }

        $this->actingAsRole('accountant');
        $this->getJson($this->assignmentsUrl($student))
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'progress.read');
    }

    public function test_student_assignments_is_401_when_unauthenticated(): void
    {
        $this->asGuest();

        $this->getJson('/api/v1/students/st_missing/assignments')->assertStatus(401);
    }

    /**
     * TS types the piece `Piece | undefined`, so the pair serializer must emit
     * null rather than omitting the key when a piece is absent.
     *
     * Not reachable through HTTP: `piece_id` is non-nullable with
     * `cascadeOnDelete`, so the branch is asserted against the serializer the
     * endpoint shares with the overview.
     */
    public function test_the_pair_serializer_keeps_piece_null_when_the_piece_is_absent(): void
    {
        ['assignment' => $assignment] = $this->makeStudent($this->defaultOrganization());

        $pair = ProgressOverviewResource::toWirePair(['assignment' => $assignment, 'piece' => null]);

        $this->assertArrayHasKey('piece', $pair);
        $this->assertNull($pair['piece']);
        $this->assertSame((string) $assignment->id, $pair['assignment']['id']);
    }

    /**
     * The two endpoints are two views of one list, so they must agree exactly.
     * They share the query and the pair serializer; this is the test that fails
     * if anyone ever forks one of them.
     */
    public function test_the_assignments_endpoint_and_the_overview_agree_exactly(): void
    {
        $org = $this->defaultOrganization();
        $student = $this->makeStudent($org)['student'];
        $this->makeStudent($org, [], ['assigned_at' => now()->subDays(4)], $student);
        $this->makeStudent($org, [], ['assigned_at' => now()->subDays(2), 'status' => 'completed'], $student);

        $this->actingAsRole('manager');

        $standalone = $this->getJson($this->assignmentsUrl($student))->assertOk()->json('data');
        $fromOverview = $this->getJson($this->overviewUrl($student))->assertOk()->json('data.assignments');

        $this->assertSame($fromOverview, $standalone);
        $this->assertCount(3, $standalone);
    }

    /** Read-only surface: no mutation verb is routed, and the overview is intact. */
    public function test_the_assignments_endpoint_is_read_only_and_leaves_the_overview_intact(): void
    {
        $org = $this->defaultOrganization();
        $fixture = $this->makeStudent($org);
        $url = $this->assignmentsUrl($fixture['student']);

        $this->actingAsRole('manager');

        $this->postJson($url, [])->assertStatus(405);
        $this->patchJson($url, [])->assertStatus(405);
        $this->deleteJson($url)->assertStatus(405);

        $this->getJson($this->overviewUrl($fixture['student']))
            ->assertOk()
            ->assertJsonPath('data.assignments.0.assignment.id', $fixture['assignment']->id)
            ->assertJsonPath('data.assignments.0.piece.id', $fixture['piece']->id);
    }
}
