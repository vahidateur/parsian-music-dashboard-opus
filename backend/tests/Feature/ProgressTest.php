<?php

namespace Tests\Feature;

use App\Models\Piece;
use App\Models\PieceAssignment;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Progress slice 1 — pieces and piece-assignments, the wire contract of
 * src/domains/progress/apiRepository.ts.
 *
 * Authorized by the owner for v1 on 2026-10-03 under `progress.read` /
 * `progress.write` (DECISIONS.md §29). The vocabulary asserts its own shape:
 * administrator, manager and teacher hold both; staff holds read only; the
 * accountant holds neither. None of that is assumed — it is asserted below.
 *
 * Slice 2 added the append-only event log, the assignment-history deletion
 * guard and the student overview, all under the same two permission ids.
 *
 * Still deferred to a later slice and asserted ABSENT, not stubbed: standalone
 * analytics and plateau-detection endpoints (they are computed inside the
 * overview instead) and workflow automation.
 */
class ProgressTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private const PIECES = '/api/v1/pieces';
    private const ASSIGNMENTS = '/api/v1/piece-assignments';
    private const EVENTS = '/api/v1/progress-events';

    /** @param  array<string, mixed>  $overrides */
    private function piecePayload(array $overrides = []): array
    {
        return [
            'title' => 'کانن در ر ماژور',
            'composer' => 'یوهان پاخلبل',
            'instrumentId' => 'piano',
            'description' => 'قطعهٔ کلاسیک با بافت تکرارشونده.',
            'rangeUnit' => 'measure',
            'active' => true,
            ...$overrides,
        ];
    }

    private function makePiece(array $overrides = []): Piece
    {
        return Piece::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            ...$overrides,
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* authorization                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401_on_every_verb(): void
    {
        $this->asGuest();

        $this->getJson(self::PIECES)->assertStatus(401);
        $this->postJson(self::PIECES, $this->piecePayload())->assertStatus(401);
        $this->getJson(self::PIECES.'/pc_missing')->assertStatus(401);
        $this->patchJson(self::PIECES.'/pc_missing', ['title' => 'x'])->assertStatus(401);
        $this->deleteJson(self::PIECES.'/pc_missing')->assertStatus(401);

        $this->getJson(self::ASSIGNMENTS)->assertStatus(401);
        $this->postJson(self::ASSIGNMENTS, ['studentId' => 'x', 'pieceId' => 'y'])->assertStatus(401);
        $this->getJson(self::ASSIGNMENTS.'/as_missing')->assertStatus(401);
        $this->patchJson(self::ASSIGNMENTS.'/as_missing', ['status' => 'paused'])->assertStatus(401);
        $this->deleteJson(self::ASSIGNMENTS.'/as_missing')->assertStatus(401);
    }

    public function test_reading_requires_progress_read(): void
    {
        // administrator, manager, teacher and staff all hold progress.read.
        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::PIECES)->assertOk();
            $this->getJson(self::ASSIGNMENTS)->assertOk();
        }

        // The accountant holds no progress permission at all.
        $this->actingAsRole('accountant');
        $this->getJson(self::PIECES)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'progress.read');
        $this->getJson(self::ASSIGNMENTS)
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'progress.read');
    }

    public function test_writing_requires_progress_write(): void
    {
        foreach (['administrator', 'manager', 'teacher'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::PIECES, $this->piecePayload())->assertStatus(201);
        }

        // staff reads the catalogue but does not author it; accountant has
        // neither. The refusal names the permission the verb needs.
        foreach (['staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::PIECES, $this->piecePayload())
                ->assertStatus(403)
                ->assertJsonPath('error.code', 'FORBIDDEN')
                ->assertJsonPath('error.permission', 'progress.write');
        }
    }

    public function test_deleting_requires_progress_write(): void
    {
        $this->actingAsRole('teacher');
        $piece = $this->makePiece();

        // A reader is not an author: staff holds progress.read, not write.
        $this->actingAsRole('staff');
        $this->deleteJson(self::PIECES.'/'.$piece->id)
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'progress.write');

        // The refusal precedes the lookup, so the row is untouched.
        $this->assertDatabaseHas('pieces', ['id' => $piece->id]);
    }

    /** Authorization precedes validation: no 422 as an oracle for a 403. */
    public function test_the_permission_check_precedes_validation(): void
    {
        $this->actingAsRole('staff');

        $this->postJson(self::PIECES, ['title' => ''])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'progress.write');

        $this->patchJson(self::PIECES.'/pc_missing', ['title' => ''])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'progress.write');

        $this->postJson(self::ASSIGNMENTS, [])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'progress.write');
    }

    /* ------------------------------------------------------------------ */
    /* tenant isolation                                                    */
    /* ------------------------------------------------------------------ */

    public function test_list_only_returns_the_callers_own_organization(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $this->actingAsRole('manager', [], $orgA);
        $pieceA = $this->postJson(self::PIECES, $this->piecePayload(['title' => 'قطعهٔ الف']))->json('data.id');

        $this->actingAsRole('manager', [], $orgB);
        $this->postJson(self::PIECES, $this->piecePayload(['title' => 'قطعهٔ ب']))->assertStatus(201);

        $this->getJson(self::PIECES)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'قطعهٔ ب');

        $this->assertNotNull($pieceA);
    }

    /**
     * Another organization's piece is unreachable by every verb — for an actor
     * who holds BOTH permissions, so the only thing between them and that row
     * is the tenant scope.
     */
    public function test_another_organizations_piece_is_invisible_to_every_verb(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $this->actingAsRole('manager', [], $orgA);
        $foreign = $this->postJson(self::PIECES, $this->piecePayload(['title' => 'قطعهٔ الف']))->json('data.id');
        $this->assertNotNull($foreign);

        $this->actingAsRole('manager', [], $orgB);

        // Not 403 — the row simply does not exist in this tenant.
        $this->getJson(self::PIECES.'/'.$foreign)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PIECE_NOT_FOUND');

        $this->patchJson(self::PIECES.'/'.$foreign, ['title' => 'تصاحب‌شده'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PIECE_NOT_FOUND');

        $this->deleteJson(self::PIECES.'/'.$foreign)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PIECE_NOT_FOUND');

        $this->actingAsRole('manager', [], $orgA);
        $this->getJson(self::PIECES.'/'.$foreign)
            ->assertOk()
            ->assertJsonPath('data.title', 'قطعهٔ الف');
    }

    public function test_another_organizations_assignment_is_invisible_to_every_verb(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $this->actingAsRole('manager', [], $orgA);
        $studentA = Student::factory()->create(['organization_id' => $orgA->id]);
        $pieceA = Piece::factory()->create(['organization_id' => $orgA->id]);

        $foreign = $this->postJson(self::ASSIGNMENTS, [
            'studentId' => $studentA->id,
            'pieceId' => $pieceA->id,
        ])->json('data.id');
        $this->assertNotNull($foreign);

        $this->actingAsRole('manager', [], $orgB);

        $this->getJson(self::ASSIGNMENTS.'/'.$foreign)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ASSIGNMENT_NOT_FOUND');

        $this->patchJson(self::ASSIGNMENTS.'/'.$foreign, ['status' => 'paused'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ASSIGNMENT_NOT_FOUND');

        $this->deleteJson(self::ASSIGNMENTS.'/'.$foreign)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ASSIGNMENT_NOT_FOUND');

        $this->assertDatabaseHas('piece_assignments', ['id' => $foreign]);
    }

    public function test_cross_tenant_references_are_rejected(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $foreignStudent = Student::factory()->create(['organization_id' => $orgB->id]);
        $foreignPiece = Piece::factory()->create(['organization_id' => $orgB->id]);
        $foreignTeacher = Teacher::factory()->create(['organization_id' => $orgB->id]);

        $localStudent = Student::factory()->create(['organization_id' => $orgA->id]);
        $localPiece = Piece::factory()->create(['organization_id' => $orgA->id]);

        $this->actingAsRole('manager', [], $orgA);

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $foreignStudent->id, 'pieceId' => $localPiece->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ASSIGNMENT_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['studentId']]]);

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $localStudent->id, 'pieceId' => $foreignPiece->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ASSIGNMENT_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['pieceId']]]);

        $this->postJson(self::ASSIGNMENTS, [
            'studentId' => $localStudent->id,
            'pieceId' => $localPiece->id,
            'teacherId' => $foreignTeacher->id,
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['fields' => ['teacherId']]]);
    }

    /* ------------------------------------------------------------------ */
    /* pieces — create / exact shape                                       */
    /* ------------------------------------------------------------------ */

    public function test_create_returns_the_exact_piece_shape(): void
    {
        $this->actingAsRole('manager');

        $response = $this->postJson(self::PIECES, $this->piecePayload([
            'programId' => 'pg_piano',
            'recommendedLevelId' => 'lv_piano_3',
            'totalRange' => 56,
            'contentIds' => ['lc_1', 'lc_2'],
        ]))->assertStatus(201);

        $response->assertJsonStructure([
            'data' => [
                'id', 'title', 'composer', 'instrumentId', 'programId',
                'recommendedLevelId', 'description', 'rangeUnit', 'totalRange',
                'contentIds', 'active', 'createdAt',
            ],
        ]);

        $data = $response->json('data');

        $this->assertSame('کانن در ر ماژور', $data['title']);
        $this->assertSame('یوهان پاخلبل', $data['composer']);
        $this->assertSame('piano', $data['instrumentId']);
        $this->assertSame('pg_piano', $data['programId']);
        $this->assertSame('lv_piano_3', $data['recommendedLevelId']);
        $this->assertSame('measure', $data['rangeUnit']);
        $this->assertSame(56, $data['totalRange']);
        $this->assertSame(['lc_1', 'lc_2'], $data['contentIds']);
        $this->assertTrue($data['active']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $data['createdAt']);
    }

    public function test_piece_defaults_match_the_client_contract(): void
    {
        $this->actingAsRole('manager');

        $data = $this->postJson(self::PIECES, $this->piecePayload())->assertStatus(201)->json('data');

        // A list field is always a list, never null.
        $this->assertSame([], $data['contentIds']);
        // Optional anchors stay null — no invented value.
        $this->assertNull($data['programId']);
        $this->assertNull($data['recommendedLevelId']);
        $this->assertNull($data['totalRange']);
    }

    /** @return array<string, array{string, array<string, mixed>}> */
    public static function invalidPieces(): array
    {
        return [
            'title empty' => ['title', ['title' => '']],
            'title missing' => ['title', ['title' => null]],
            'composer missing' => ['composer', ['composer' => null]],
            'instrument empty' => ['instrumentId', ['instrumentId' => '']],
            'instrument missing' => ['instrumentId', ['instrumentId' => null]],
            'description missing' => ['description', ['description' => null]],
            'range unit unknown' => ['rangeUnit', ['rangeUnit' => 'bar']],
            'total range zero' => ['totalRange', ['totalRange' => 0]],
            'total range negative' => ['totalRange', ['totalRange' => -5]],
            'total range too large' => ['totalRange', ['totalRange' => 100_001]],
            'active missing' => ['active', ['active' => null]],
            'active not boolean' => ['active', ['active' => 'yes']],
            'content ids not strings' => ['contentIds.0', ['contentIds' => [1]]],
        ];
    }

    /**
     * @param  array<string, mixed>  $override
     * @dataProvider invalidPieces
     */
    public function test_invalid_piece_fields_are_refused(string $field, array $override): void
    {
        $this->actingAsRole('manager');

        $this->postJson(self::PIECES, $this->piecePayload($override))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PIECE_INVALID')
            ->assertJsonPath('error.message', 'اطلاعات قطعه معتبر نیست.')
            ->assertJsonStructure(['error' => ['fields' => [$field]]]);
    }

    public function test_an_unknown_piece_id_is_404_with_the_piece_error_code(): void
    {
        $this->actingAsRole('manager');

        $this->getJson(self::PIECES.'/pc_does_not_exist')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PIECE_NOT_FOUND')
            ->assertJsonStructure(['error' => ['code', 'message']]);

        $this->patchJson(self::PIECES.'/pc_does_not_exist', ['title' => 'x'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PIECE_NOT_FOUND');

        $this->deleteJson(self::PIECES.'/pc_does_not_exist')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PIECE_NOT_FOUND');
    }

    /* ------------------------------------------------------------------ */
    /* pieces — update / delete                                            */
    /* ------------------------------------------------------------------ */

    public function test_update_changes_only_what_was_sent_and_never_rewrites_created_at(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson(self::PIECES, $this->piecePayload([
            'title' => 'عنوان پیشین',
            'contentIds' => ['lc_keep'],
        ]))->json('data.id');
        $createdAt = $this->getJson(self::PIECES.'/'.$id)->json('data.createdAt');

        $this->patchJson(self::PIECES.'/'.$id, ['title' => 'عنوان جدید'])
            ->assertOk()
            ->assertJsonPath('data.title', 'عنوان جدید')
            // A patch that omits contentIds must not blank the stored list.
            ->assertJsonPath('data.contentIds', ['lc_keep'])
            ->assertJsonPath('data.createdAt', $createdAt);
    }

    public function test_deactivating_a_piece_is_the_supported_path(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson(self::PIECES, $this->piecePayload())->json('data.id');

        $this->patchJson(self::PIECES.'/'.$id, ['active' => false])
            ->assertOk()
            ->assertJsonPath('data.active', false);
    }

    public function test_delete_removes_an_unreferenced_piece(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson(self::PIECES, $this->piecePayload())->json('data.id');

        $this->deleteJson(self::PIECES.'/'.$id)->assertStatus(204);
        $this->assertDatabaseMissing('pieces', ['id' => $id]);
        $this->getJson(self::PIECES.'/'.$id)->assertStatus(404);
    }

    /**
     * Progress is tracked against the piece, so deleting one that is assigned
     * would silently rewrite what a student has been working on. Refused with
     * 409, and deactivation is offered instead.
     */
    public function test_delete_is_refused_while_the_piece_is_assigned(): void
    {
        $organization = $this->defaultOrganization();
        $this->actingAsRole('manager');

        $piece = $this->makePiece(['title' => 'قطعهٔ تخصیص‌یافته']);
        $student = Student::factory()->create(['organization_id' => $organization->id]);

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->assertStatus(201);

        $this->deleteJson(self::PIECES.'/'.$piece->id)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'PIECE_IN_USE');

        $this->assertDatabaseHas('pieces', ['id' => $piece->id]);
    }

    /* ------------------------------------------------------------------ */
    /* pieces — filters, ordering, pagination                              */
    /* ------------------------------------------------------------------ */

    public function test_piece_filters_and_ordering(): void
    {
        $organization = $this->defaultOrganization();

        Piece::factory()->create(['organization_id' => $organization->id, 'title' => 'الف', 'instrument_id' => 'piano', 'program_id' => 'pg_piano', 'active' => true]);
        Piece::factory()->create(['organization_id' => $organization->id, 'title' => 'ب', 'instrument_id' => 'guitar', 'program_id' => 'pg_guitar', 'active' => false]);

        $this->actingAsRole('manager');

        // The client sorts the repertoire by title.
        $this->getJson(self::PIECES)->assertOk()->assertJsonPath('data.0.title', 'الف');

        $this->getJson(self::PIECES.'?instrument_id=guitar')->assertJsonPath('meta.total', 1);
        $this->getJson(self::PIECES.'?program_id=pg_piano')->assertJsonPath('meta.total', 1);
        $this->getJson(self::PIECES.'?active_only=1')->assertJsonPath('meta.total', 1);
        $this->getJson(self::PIECES.'?search='.urlencode('الف'))->assertJsonPath('meta.total', 1);
        $this->getJson(self::PIECES.'?search='.urlencode('چیزی‌که‌نیست'))->assertJsonPath('meta.total', 0);
    }

    public function test_pagination_meta_reports_what_was_returned(): void
    {
        $organization = $this->defaultOrganization();

        for ($i = 1; $i <= 3; $i++) {
            Piece::factory()->create(['organization_id' => $organization->id, 'title' => 'قطعه '.$i]);
        }

        $this->actingAsRole('manager');

        $this->getJson(self::PIECES.'?page=2&per_page=2')
            ->assertOk()
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonCount(1, 'data');

        // per_page is clamped, not rejected, and meta reports the number used.
        $this->getJson(self::PIECES.'?per_page=5000')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 100);
    }

    /* ------------------------------------------------------------------ */
    /* assignments — create / exact shape                                  */
    /* ------------------------------------------------------------------ */

    public function test_create_returns_the_exact_assignment_shape(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);
        $teacher = Teacher::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $response = $this->postJson(self::ASSIGNMENTS, [
            'studentId' => $student->id,
            'pieceId' => $piece->id,
            'teacherId' => $teacher->id,
            'notes' => 'پیشرفت خوب.',
        ])->assertStatus(201);

        $response->assertJsonStructure([
            'data' => [
                'id', 'studentId', 'pieceId', 'teacherId', 'status',
                'assignedAt', 'targetDate', 'closedAt', 'notes', 'latest',
            ],
        ]);

        $data = $response->json('data');

        $this->assertSame($student->id, $data['studentId']);
        $this->assertSame($piece->id, $data['pieceId']);
        $this->assertSame($teacher->id, $data['teacherId']);
        // Defaults the payload omitted.
        $this->assertSame('planned', $data['status']);
        $this->assertSame('پیشرفت خوب.', $data['notes']);
        $this->assertNull($data['targetDate']);
        $this->assertNull($data['closedAt']);
        // Derived from the newest event; null until the event log lands.
        $this->assertNull($data['latest']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $data['assignedAt']);
    }

    public function test_assigning_an_inactive_piece_is_refused(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id, 'active' => false]);

        $this->actingAsRole('manager');

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ASSIGNMENT_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['pieceId']]]);
    }

    public function test_assigning_an_unknown_student_or_piece_is_refused(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $this->postJson(self::ASSIGNMENTS, ['studentId' => 'st_nope', 'pieceId' => $piece->id])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['fields' => ['studentId']]]);

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => 'pc_nope'])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['fields' => ['pieceId']]]);
    }

    public function test_invalid_assignment_fields_are_refused(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id, 'status' => 'nope'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ASSIGNMENT_INVALID')
            ->assertJsonPath('error.message', 'اطلاعات تخصیص معتبر نیست.')
            ->assertJsonStructure(['error' => ['fields' => ['status']]]);

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id, 'targetDate' => 'not-a-date'])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['fields' => ['targetDate']]]);
    }

    /* ------------------------------------------------------------------ */
    /* assignments — the one-open-per-pair invariant                       */
    /* ------------------------------------------------------------------ */

    public function test_a_second_open_assignment_for_the_same_pair_is_a_conflict(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->assertStatus(201);

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ASSIGNMENT_DUPLICATE');

        $this->assertSame(1, PieceAssignment::query()->count());
    }

    /**
     * Only OPEN assignments block. A finished piece may legitimately be
     * re-assigned later, which is why this cannot be a unique index.
     */
    public function test_a_closed_assignment_does_not_block_a_new_one(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $first = $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->assertStatus(201)->json('data.id');

        $this->patchJson(self::ASSIGNMENTS.'/'.$first, ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->assertStatus(201);

        $this->assertSame(2, PieceAssignment::query()->count());
    }

    public function test_the_same_piece_may_be_assigned_to_a_different_student(): void
    {
        $organization = $this->defaultOrganization();
        $studentA = Student::factory()->create(['organization_id' => $organization->id]);
        $studentB = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $this->postJson(self::ASSIGNMENTS, ['studentId' => $studentA->id, 'pieceId' => $piece->id])->assertStatus(201);
        $this->postJson(self::ASSIGNMENTS, ['studentId' => $studentB->id, 'pieceId' => $piece->id])->assertStatus(201);
    }

    /* ------------------------------------------------------------------ */
    /* assignments — the closed_at state machine                           */
    /* ------------------------------------------------------------------ */

    public function test_closing_stamps_closed_at_and_reopening_clears_it(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $id = $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->json('data.id');

        $this->getJson(self::ASSIGNMENTS.'/'.$id)->assertJsonPath('data.closedAt', null);

        $closed = $this->patchJson(self::ASSIGNMENTS.'/'.$id, ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->json('data.closedAt');
        $this->assertNotNull($closed);

        // Reopening clears it, so the field can never claim a closure that was undone.
        $this->patchJson(self::ASSIGNMENTS.'/'.$id, ['status' => 'learning'])
            ->assertOk()
            ->assertJsonPath('data.closedAt', null);
    }

    /**
     * The stamp is sticky while the assignment STAYS closed, so a redundant
     * re-close cannot move the date. Reopening genuinely clears it, so a later
     * close stamps the new moment — the field records the current closure and
     * therefore never lies.
     */
    public function test_closed_at_is_sticky_while_closed_and_new_after_a_reopen(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $id = $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->json('data.id');

        $firstClosedAt = $this->patchJson(self::ASSIGNMENTS.'/'.$id, ['status' => 'completed'])
            ->json('data.closedAt');
        $this->assertNotNull($firstClosedAt);

        // Advance the clock so a later closure is distinguishable, but stay
        // well inside the Sanctum token lifetime (720 minutes) — travelling
        // past it would expire the token and turn this into a 401 test.
        $this->travel(5)->minutes();

        // Still closed — a second close must not move the date.
        $this->patchJson(self::ASSIGNMENTS.'/'.$id, ['status' => 'abandoned'])
            ->assertOk()
            ->assertJsonPath('data.status', 'abandoned')
            ->assertJsonPath('data.closedAt', $firstClosedAt);

        // Reopened: the closure is undone, so the stamp goes away entirely.
        $this->patchJson(self::ASSIGNMENTS.'/'.$id, ['status' => 'learning'])
            ->assertOk()
            ->assertJsonPath('data.closedAt', null);

        // Closing again stamps the NEW moment, not the old one.
        $secondClosedAt = $this->patchJson(self::ASSIGNMENTS.'/'.$id, ['status' => 'completed'])
            ->json('data.closedAt');

        $this->assertNotSame($firstClosedAt, $secondClosedAt);
    }

    public function test_update_cannot_move_an_assignment_to_another_student_or_piece(): void
    {
        $organization = $this->defaultOrganization();
        $studentA = Student::factory()->create(['organization_id' => $organization->id]);
        $studentB = Student::factory()->create(['organization_id' => $organization->id]);
        $pieceA = Piece::factory()->create(['organization_id' => $organization->id]);
        $pieceB = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $id = $this->postJson(self::ASSIGNMENTS, ['studentId' => $studentA->id, 'pieceId' => $pieceA->id])
            ->json('data.id');

        // The update contract accepts only status/targetDate/notes/teacherId,
        // so these fields are simply not writable.
        $this->patchJson(self::ASSIGNMENTS.'/'.$id, [
            'studentId' => $studentB->id,
            'pieceId' => $pieceB->id,
            'notes' => 'یادداشت',
        ])
            ->assertOk()
            ->assertJsonPath('data.studentId', $studentA->id)
            ->assertJsonPath('data.pieceId', $pieceA->id)
            ->assertJsonPath('data.notes', 'یادداشت');
    }

    public function test_delete_removes_an_assignment(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $id = $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->json('data.id');

        $this->deleteJson(self::ASSIGNMENTS.'/'.$id)->assertStatus(204);
        $this->assertDatabaseMissing('piece_assignments', ['id' => $id]);
        $this->getJson(self::ASSIGNMENTS.'/'.$id)->assertStatus(404);
    }

    /* ------------------------------------------------------------------ */
    /* assignments — filters and ordering                                  */
    /* ------------------------------------------------------------------ */

    public function test_assignment_filters_and_ordering(): void
    {
        $organization = $this->defaultOrganization();
        $studentA = Student::factory()->create(['organization_id' => $organization->id]);
        $studentB = Student::factory()->create(['organization_id' => $organization->id]);
        $pieceA = Piece::factory()->create(['organization_id' => $organization->id]);
        $pieceB = Piece::factory()->create(['organization_id' => $organization->id]);
        $teacher = Teacher::factory()->create(['organization_id' => $organization->id]);

        PieceAssignment::factory()->create([
            'organization_id' => $organization->id,
            'student_id' => $studentA->id,
            'piece_id' => $pieceA->id,
            'teacher_id' => $teacher->id,
            'status' => 'learning',
            'assigned_at' => now()->subDays(3),
        ]);
        PieceAssignment::factory()->create([
            'organization_id' => $organization->id,
            'student_id' => $studentB->id,
            'piece_id' => $pieceB->id,
            'status' => 'completed',
            'assigned_at' => now()->subDay(),
        ]);

        $this->actingAsRole('manager');

        // Newest first: the current work is what a teacher opens for.
        $this->getJson(self::ASSIGNMENTS)->assertOk()->assertJsonPath('data.0.studentId', $studentB->id);

        $this->getJson(self::ASSIGNMENTS.'?student_id='.$studentA->id)->assertJsonPath('meta.total', 1);
        $this->getJson(self::ASSIGNMENTS.'?piece_id='.$pieceB->id)->assertJsonPath('meta.total', 1);
        $this->getJson(self::ASSIGNMENTS.'?teacher_id='.$teacher->id)->assertJsonPath('meta.total', 1);
        $this->getJson(self::ASSIGNMENTS.'?status=completed')->assertJsonPath('meta.total', 1);
        // active_only excludes completed/abandoned.
        $this->getJson(self::ASSIGNMENTS.'?active_only=1')->assertJsonPath('meta.total', 1);
    }

    /* ------------------------------------------------------------------ */
    /* the deferred boundary                                               */
    /* ------------------------------------------------------------------ */

    /**
     * The boundary moved in slice 2, and this test moved with it rather than
     * being dropped: `progress-events` and the overview are now live, while the
     * genuinely deferred paths stay unrouted.
     *
     * The strongest assertion here is the one that was added, not the one that
     * was removed: there is NO mutation route for an event. That is what makes
     * the log append-only, and it must never become a 404-shaped accident — so
     * every mutation verb is asserted 404 (or 405) explicitly.
     */
    public function test_the_event_log_is_append_only_and_deferred_paths_stay_unrouted(): void
    {
        $organization = $this->defaultOrganization();
        $student = Student::factory()->create(['organization_id' => $organization->id]);
        $piece = Piece::factory()->create(['organization_id' => $organization->id]);

        $this->actingAsRole('manager');

        $assignmentId = $this->postJson(self::ASSIGNMENTS, ['studentId' => $student->id, 'pieceId' => $piece->id])
            ->json('data.id');

        $eventId = $this->postJson(self::EVENTS, [
            'assignmentId' => $assignmentId,
            'mastery' => 55,
            'source' => 'teacher',
        ])->json('data.id');

        // The two read/write verbs the contract defines DO exist.
        $this->getJson(self::EVENTS)->assertOk();
        $this->getJson('/api/v1/students/'.$student->id.'/progress-overview')->assertOk();

        // Correcting a mistake appends a new event; it never rewrites history.
        $this->putJson(self::EVENTS.'/'.$eventId, ['mastery' => 90])->assertStatus(404);
        $this->patchJson(self::EVENTS.'/'.$eventId, ['mastery' => 90])->assertStatus(404);
        $this->deleteJson(self::EVENTS.'/'.$eventId)->assertStatus(404);

        // Still deferred, still no placeholder route.
        $this->getJson('/api/v1/students/st1/assignments')->assertStatus(404);
    }

    /** The vocabulary grew by exactly two ids, and only those two. */
    public function test_the_permission_vocabulary_is_exactly_twenty_five_ids(): void
    {
        $vocabulary = config('permissions.vocabulary');

        $this->assertCount(25, $vocabulary);
        $this->assertContains('progress.read', $vocabulary);
        $this->assertContains('progress.write', $vocabulary);

        $added = array_values(array_diff($vocabulary, [
            'students.read', 'students.write', 'teachers.read', 'teachers.write',
            'classes.read', 'classes.write', 'schedule.read', 'schedule.write',
            'attendance.read', 'attendance.write', 'finance.read', 'finance.write',
            'messages.read', 'messages.write', 'library.read', 'library.write',
            'reports.read', 'settings.read', 'settings.write', 'users.read',
            'users.write', 'roles.write', 'demo.manage',
        ]));

        $this->assertSame(['progress.read', 'progress.write'], $added);
    }
}
