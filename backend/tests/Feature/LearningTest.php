<?php

namespace Tests\Feature;

use App\Models\Instrument;
use App\Models\LearningContent;
use App\Models\LearningLevel;
use App\Models\LearningProgram;
use App\Models\MediaAsset;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Learning — programs, ordered levels, linked content, placements, and the
 * computed eligibility reads.
 *
 * WHAT IS ASSERTED HERE
 *  - the wire contract of `src/domains/learning/apiRepository.ts`: camelCase
 *    shapes, paged envelopes, the unpaged links array, and every status code
 *    the frontend contract names (including LINK_INVALID, CONTENT_ALREADY_LINKED,
 *    PROGRAM_HAS_LEVELS and friends);
 *  - authorization: reads for administrator/manager/teacher/staff, writes for
 *    administrator/manager/teacher; staff and accountant reads are refused
 *    with `learning.read` / writes with `learning.write` named;
 *  - the ladder invariants: 1-based contiguous unique order, renumbering on
 *    insert/move/delete, and every refusal the local repository owns;
 *  - eligibility computed server-side exactly like the client rule: cumulative
 *    levels, exclusive opt-out, teacher-only hidden, inactive excluded, dedup
 *    at the lowest level, honest locked reasons.
 */
class LearningTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private const BASE = '/api/v1/learning';

    protected function setUp(): void
    {
        parent::setUp();
        // Every write path below names the piano; the tenant scope means the
        // row must live in the default test organization, not just anywhere.
        Instrument::factory()->create([
            'id' => 'piano',
            'slug' => 'piano',
            'name' => 'پیانو',
            'organization_id' => $this->defaultOrganization()->id,
        ]);
    }

    /** @param  array<string, mixed>  $overrides */
    private function program(array $overrides = []): LearningProgram
    {
        return LearningProgram::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            ...$overrides,
        ]);
    }

    /** @param  array<string, mixed>  $overrides */
    private function level(LearningProgram $program, array $overrides = []): LearningLevel
    {
        return LearningLevel::factory()->create([
            'organization_id' => $program->organization_id,
            'program_id' => $program->id,
            'order' => ($overrides['order'] ?? 1),
            ...$overrides,
        ]);
    }

    /** @param  array<string, mixed>  $overrides */
    private function content(array $overrides = []): LearningContent
    {
        return LearningContent::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            ...$overrides,
        ]);
    }

    private function student(array $overrides = []): Student
    {
        return Student::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            ...$overrides,
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* authentication                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->asGuest();

        $this->getJson(self::BASE.'/programs')->assertStatus(401);
        $this->postJson(self::BASE.'/programs', [])->assertStatus(401);
        $this->getJson(self::BASE.'/levels')->assertStatus(401);
        $this->getJson(self::BASE.'/content')->assertStatus(401);
        $this->getJson(self::BASE.'/placements')->assertStatus(401);
        $this->getJson(self::BASE.'/students/st1/eligible-content')->assertStatus(401);
        $this->getJson(self::BASE.'/students/st1/locked-content')->assertStatus(401);
    }

    /* ------------------------------------------------------------------ */
    /* authorization                                                        */
    /* ------------------------------------------------------------------ */

    public function test_reading_requires_learning_read(): void
    {
        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::BASE.'/programs')->assertOk();
            $this->getJson(self::BASE.'/levels')->assertOk();
            $this->getJson(self::BASE.'/content')->assertOk();
            $this->getJson(self::BASE.'/placements')->assertOk();
        }

        // The accountant is the one role the vocabulary gives no learning
        // permission at all, so even a read is refused.
        $this->actingAsRole('accountant');
        $this->getJson(self::BASE.'/programs')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'learning.read');
    }

    public function test_writing_requires_learning_write(): void
    {
        foreach (['administrator', 'manager', 'teacher'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::BASE.'/programs', ['name' => 'برنامهٔ آزمایشی', 'instrumentId' => 'piano'])
                ->assertStatus(201);
        }

        foreach (['staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::BASE.'/programs', ['name' => 'برنامهٔ آزمایشی', 'instrumentId' => 'piano'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'learning.write');
            $this->postJson(self::BASE.'/levels', ['programId' => 'x', 'name' => 'x'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'learning.write');
            $this->postJson(self::BASE.'/content', ['title' => 'xx', 'type' => 'document'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'learning.write');
            $this->postJson(self::BASE.'/placements', ['studentId' => 'x', 'programId' => 'x', 'levelId' => 'x'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'learning.write');
        }
    }

    /* ------------------------------------------------------------------ */
    /* programs                                                             */
    /* ------------------------------------------------------------------ */

    public function test_program_crud_round_trip(): void
    {
        $this->actingAsRole('manager');

        $created = $this->postJson(self::BASE.'/programs', [
            'name' => 'دورهٔ ویولن کلاسیک',
            'instrumentId' => 'piano',
            'description' => 'desc',
        ])->assertCreated()->assertJsonPath('data.name', 'دورهٔ ویولن کلاسیک');
        $id = $created->json('data.id');

        $this->getJson(self::BASE."/programs/$id")->assertOk()->assertJsonPath('data.instrumentId', 'piano');

        $this->patchJson(self::BASE."/programs/$id", ['name' => 'دورهٔ تازه', 'active' => false])
            ->assertOk()
            ->assertJsonPath('data.name', 'دورهٔ تازه')
            ->assertJsonPath('data.active', false);

        $this->deleteJson(self::BASE."/programs/$id")->assertNoContent();
        $this->getJson(self::BASE."/programs/$id")->assertStatus(404)->assertJsonPath('error.code', 'PROGRAM_NOT_FOUND');
    }

    public function test_program_requires_an_existing_instrument(): void
    {
        $this->actingAsRole('manager');

        $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'nope'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PROGRAM_INVALID');

        // A one-character name trips the shared min:2 rule (the codebase-wide
        // message for that rule); the code still names this domain.
        $this->postJson(self::BASE.'/programs', ['name' => 'x', 'instrumentId' => 'piano'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PROGRAM_INVALID');
    }

    public function test_program_delete_is_refused_while_used(): void
    {
        $this->actingAsRole('manager');

        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');

        // A level blocks first.
        $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'سطح ۱'])->assertCreated();
        $this->deleteJson(self::BASE.'/programs/'.$program['id'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'PROGRAM_HAS_LEVELS');

        // So does a placed student.
        $student = $this->student();
        $level = LearningLevel::query()->where('program_id', $program['id'])->firstOrFail();
        $this->postJson(self::BASE.'/placements', ['studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $level->id])
            ->assertOk();
        $this->deleteJson(self::BASE.'/programs/'.$program['id'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'PROGRAM_HAS_STUDENTS');
    }

    /* ------------------------------------------------------------------ */
    /* levels                                                               */
    /* ------------------------------------------------------------------ */

    public function test_level_order_is_contiguous_and_renumbered(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');

        $l1 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'یک'])->assertCreated()->json('data');
        $l2 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'دو'])->assertCreated()->json('data');
        $this->assertSame(1, $l1['order']);
        $this->assertSame(2, $l2['order']);

        // Explicit insert shifts siblings.
        $l3 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'میانی', 'order' => 1])
            ->assertCreated()->json('data');
        $this->assertSame(1, $l3['order']);
        $orders = array_column($this->getJson(self::BASE.'/levels?programId='.$program['id'])->json('data'), 'order');
        $this->assertSame([1, 2, 3], $orders);

        // Out of range is refused.
        $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'دور', 'order' => 9])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'LEVEL_INVALID');

        // Reorder renumbers the ladder.
        $this->postJson(self::BASE."/levels/{$l1['id']}/reorder", ['order' => 3])->assertOk();
        $ids = array_column($this->getJson(self::BASE.'/levels?programId='.$program['id'])->json('data'), 'id');
        $this->assertSame([$l3['id'], $l2['id'], $l1['id']], $ids);

        // PATCH ignores order — it travels through reorder only.
        $this->patchJson(self::BASE."/levels/{$l1['id']}", ['name' => 'یک‌تازه', 'order' => 1])->assertOk();
        $row = $this->getJson(self::BASE."/levels/{$l1['id']}")->json('data');
        $this->assertSame('یک‌تازه', $row['name']);
        $this->assertSame(3, $row['order']);

        // Delete closes the gap.
        $this->deleteJson(self::BASE."/levels/{$l3['id']}")->assertNoContent();
        $orders = array_column($this->getJson(self::BASE.'/levels?programId='.$program['id'])->json('data'), 'order');
        $this->assertSame([1, 2], $orders);
    }

    public function test_level_delete_is_refused_while_referenced(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $level = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'یک'])
            ->assertCreated()->json('data');

        $content = $this->postJson(self::BASE.'/content', ['title' => 'جزوه', 'type' => 'document'])
            ->assertCreated()->json('data');
        $this->postJson(self::BASE."/levels/{$level['id']}/links", ['contentId' => $content['id'], 'programId' => $program['id']])
            ->assertCreated();
        $this->deleteJson(self::BASE."/levels/{$level['id']}")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'LEVEL_HAS_CONTENT');

        $student = $this->student();
        $this->postJson(self::BASE.'/placements', ['studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $level['id']])
            ->assertOk();
        // Detach the link first so the student placement is the blocker.
        $this->deleteJson(self::BASE."/levels/{$level['id']}/links/{$content['id']}")->assertNoContent();
        $this->deleteJson(self::BASE."/levels/{$level['id']}")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'LEVEL_HAS_STUDENTS');
    }

    public function test_prerequisite_cycles_are_refused(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $a = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'الف'])->assertCreated()->json('data');
        $b = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'ب'])->assertCreated()->json('data');

        $this->patchJson(self::BASE."/levels/{$a['id']}", ['prerequisiteLevelIds' => [$b['id']]])->assertOk();
        // Closing the loop is refused.
        $this->patchJson(self::BASE."/levels/{$b['id']}", ['prerequisiteLevelIds' => [$a['id']]])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'LEVEL_INVALID');
        // A level cannot require itself.
        $this->patchJson(self::BASE."/levels/{$a['id']}", ['prerequisiteLevelIds' => [$a['id']]])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'LEVEL_INVALID');
    }

    /* ------------------------------------------------------------------ */
    /* content                                                              */
    /* ------------------------------------------------------------------ */

    public function test_content_crud_and_media_reference(): void
    {
        $actor = $this->actingAsRole('manager');

        $this->postJson(self::BASE.'/content', ['title' => 'x', 'type' => 'pdf'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CONTENT_INVALID');
        $this->postJson(self::BASE.'/content', ['title' => 'جزوه', 'type' => 'tape'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CONTENT_INVALID');

        $created = $this->postJson(self::BASE.'/content', [
            'title' => 'اتود شماره ۱',
            'description' => 'desc',
            'type' => 'pdf',
            'author' => 'مولف',
            'visibility' => 'teachers',
            'instrumentId' => 'violin',
        ])->assertCreated()->json('data');
        $this->assertSame('teachers', $created['visibility']);
        $this->assertSame('violin', $created['instrumentId']);

        $this->patchJson(self::BASE."/content/{$created['id']}", ['mediaId' => 'md_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CONTENT_INVALID');

        Storage::fake('local');
        $asset = MediaAsset::factory()->create(['id' => 'md_1', 'organization_id' => $actor->organization_id]);
        Storage::disk('local')->put($asset->storage_path, 'learning-media-bytes');
        $this->patchJson(self::BASE."/content/{$created['id']}", ['mediaId' => 'md_1'])
            ->assertOk()
            ->assertJsonPath('data.mediaId', 'md_1');
    }

    public function test_content_search_and_level_filter(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $level = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'یک'])
            ->assertCreated()->json('data');
        $linked = $this->postJson(self::BASE.'/content', ['title' => 'اتود پیانو', 'type' => 'pdf'])
            ->assertCreated()->json('data');
        $other = $this->postJson(self::BASE.'/content', ['title' => 'گام گیتار', 'type' => 'audio'])
            ->assertCreated()->json('data');
        $this->postJson(self::BASE."/levels/{$level['id']}/links", ['contentId' => $linked['id'], 'programId' => $program['id']])
            ->assertCreated();

        $this->getJson(self::BASE.'/content?search='.urlencode('پیانو'))->assertJsonFragment(['id' => $linked['id']]);
        $this->getJson(self::BASE.'/content?type=audio')->assertJsonFragment(['id' => $other['id']]);
        $filtered = $this->getJson(self::BASE.'/content?levelId='.$level['id'])->json('data');
        $this->assertSame([$linked['id']], array_column($filtered, 'id'));
    }

    /* ------------------------------------------------------------------ */
    /* links                                                                */
    /* ------------------------------------------------------------------ */

    public function test_attach_refuses_a_level_from_another_program(): void
    {
        $this->actingAsRole('manager');
        $pa = $this->postJson(self::BASE.'/programs', ['name' => 'الف', 'instrumentId' => 'piano'])->assertCreated()->json('data');
        $pb = $this->postJson(self::BASE.'/programs', ['name' => 'برنامه ب', 'instrumentId' => 'piano'])->assertCreated()->json('data');
        $level = $this->postJson(self::BASE.'/levels', ['programId' => $pa['id'], 'name' => 'یک'])->assertCreated()->json('data');
        $content = $this->postJson(self::BASE.'/content', ['title' => 'جزوه', 'type' => 'document'])->assertCreated()->json('data');

        // The caller resolved the level from program B while it belongs to A.
        $this->postJson(self::BASE."/levels/{$level['id']}/links", ['contentId' => $content['id'], 'programId' => $pb['id']])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'LINK_INVALID');

        $this->postJson(self::BASE."/levels/{$level['id']}/links", ['contentId' => $content['id'], 'programId' => $pa['id']])
            ->assertCreated()
            ->assertJsonPath('data.sortOrder', 0);

        // Attaching twice is a conflict, not a copy.
        $this->postJson(self::BASE."/levels/{$level['id']}/links", ['contentId' => $content['id'], 'programId' => $pa['id']])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONTENT_ALREADY_LINKED');

        $links = $this->getJson(self::BASE.'/links?levelId='.$level['id'])->assertOk()->json('data');
        $this->assertCount(1, $links);

        $this->deleteJson(self::BASE."/levels/{$level['id']}/links/{$content['id']}")->assertNoContent();
        $this->deleteJson(self::BASE."/levels/{$level['id']}/links/{$content['id']}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'LINK_NOT_FOUND');
    }

    /* ------------------------------------------------------------------ */
    /* placements                                                           */
    /* ------------------------------------------------------------------ */

    public function test_placement_lifecycle_and_history(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $l1 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'یک'])->assertCreated()->json('data');
        $l2 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'دو'])->assertCreated()->json('data');
        $student = $this->student();

        // No placement yet: the read is empty, not an error.
        $this->getJson(self::BASE."/students/{$student->id}/placement")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'PLACEMENT_NOT_FOUND');

        $first = $this->postJson(self::BASE.'/placements', [
            'studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $l1['id'],
        ])->assertOk()->json('data');
        $this->assertSame($l1['id'], $first['levelId']);
        $this->assertSame([], $first['history']);

        $again = $this->postJson(self::BASE.'/placements', [
            'studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $l1['id'],
        ])->assertOk()->json('data');
        $this->assertSame($first['id'], $again['id']);

        // Moving appends history with both ends of the move.
        $moved = $this->postJson(self::BASE.'/placements', [
            'studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $l2['id'], 'note' => 'قبولی در آزمون',
        ])->assertOk()->json('data');
        $this->assertSame($first['id'], $moved['id']);
        $this->assertSame($l2['id'], $moved['levelId']);
        $this->assertCount(1, $moved['history']);
        $this->assertSame($l1['id'], $moved['history'][0]['levelId']);
        $this->assertSame($l2['id'], $moved['history'][0]['toLevelId']);

        $this->deleteJson(self::BASE."/students/{$student->id}/placement")->assertNoContent();
        $this->getJson(self::BASE."/students/{$student->id}/placement")->assertStatus(404);
        $this->deleteJson(self::BASE."/students/{$student->id}/placement")->assertStatus(404);
    }

    public function test_placement_validates_its_inputs(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $other = $this->postJson(self::BASE.'/programs', ['name' => 'دیگر', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $level = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'یک'])
            ->assertCreated()->json('data');
        $student = $this->student();

        // Unknown student.
        $this->postJson(self::BASE.'/placements', ['studentId' => 'st_missing', 'programId' => $program['id'], 'levelId' => $level['id']])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PLACEMENT_INVALID');

        // A level from another program.
        $this->postJson(self::BASE.'/placements', ['studentId' => $student->id, 'programId' => $other['id'], 'levelId' => $level['id']])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PLACEMENT_INVALID');

        // An inactive level cannot be assigned.
        $this->patchJson(self::BASE."/levels/{$level['id']}", ['active' => false])->assertOk();
        $this->postJson(self::BASE.'/placements', ['studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $level['id']])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PLACEMENT_INVALID');
    }

    /* ------------------------------------------------------------------ */
    /* eligibility (computed, never stored)                                 */
    /* ------------------------------------------------------------------ */

    public function test_eligible_and_locked_content(): void
    {
        $actor = $this->actingAsRole('manager');
        $program = $this->postJson(self::BASE.'/programs', ['name' => 'دوره', 'instrumentId' => 'piano'])
            ->assertCreated()->json('data');
        $l1 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'یک'])->assertCreated()->json('data');
        $l2 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'دو'])->assertCreated()->json('data');
        $l3 = $this->postJson(self::BASE.'/levels', ['programId' => $program['id'], 'name' => 'سه'])->assertCreated()->json('data');

        $mk = fn (string $title): array => $this->postJson(self::BASE.'/content', ['title' => $title, 'type' => 'document'])
            ->assertCreated()->json('data');
        $a = $mk('محتوای الف'); // L1
        $b = $mk('محتوای ب'); // L2
        $c = $mk('محتوای ج'); // L3 — locked for a level-2 student
        $d = $mk('محتوای د'); // L1 + L3 — emitted once, at the lowest level
        $e = $mk('محتوای هـ'); // inactive — never listed
        $f = $mk('محتوای و'); // teachers-only — hidden from students
        $this->patchJson(self::BASE."/content/{$e['id']}", ['active' => false])->assertOk();
        $this->patchJson(self::BASE."/content/{$f['id']}", ['visibility' => 'teachers'])->assertOk();

        $link = fn (string $levelId, string $contentId) => $this->postJson(
            self::BASE."/levels/$levelId/links",
            ['contentId' => $contentId, 'programId' => $program['id']],
        )->assertCreated();
        $link($l1['id'], $a['id']);
        $link($l2['id'], $b['id']);
        $link($l3['id'], $c['id']);
        $link($l1['id'], $d['id']);
        $link($l3['id'], $d['id']);
        $link($l2['id'], $e['id']);
        $link($l1['id'], $f['id']);

        $student = $this->student();
        $this->postJson(self::BASE.'/placements', ['studentId' => $student->id, 'programId' => $program['id'], 'levelId' => $l2['id']])
            ->assertOk();

        $eligible = $this->getJson(self::BASE."/students/{$student->id}/eligible-content")->assertOk()->json('data');
        $this->assertSame(['محتوای الف', 'محتوای د', 'محتوای ب'], array_column(array_column($eligible, 'content'), 'title'));

        $locked = $this->getJson(self::BASE."/students/{$student->id}/locked-content")->assertOk()->json('data');
        $this->assertCount(1, $locked);
        $this->assertSame('محتوای ج', $locked[0]['content']['title']);
        $this->assertSame('سه', $locked[0]['levelName']);
        $this->assertStringContainsString('سه', $locked[0]['reason']);

        // eligibleStudentIds answers who can currently open a content item. The
        // level-2 student cannot open content attached only to level 3 (it is
        // locked for them, not eligible) — but they can open level-1 content.
        $ids = $this->getJson(self::BASE."/content/{$c['id']}/eligible-students")->assertOk()->json('data');
        $this->assertSame([], $ids);
        $ids = $this->getJson(self::BASE."/content/{$a['id']}/eligible-students")->assertOk()->json('data');
        $this->assertSame([$student->id], $ids);

        // An unplaced student is granted nothing, never everything.
        $other = $this->student();
        $this->assertSame([], $this->getJson(self::BASE."/students/{$other->id}/eligible-content")->json('data'));
        $this->assertSame([], $this->getJson(self::BASE."/students/{$other->id}/locked-content")->json('data'));
    }

    /* ------------------------------------------------------------------ */
    /* tenant isolation                                                     */
    /* ------------------------------------------------------------------ */

    public function test_another_organizations_learning_is_invisible(): void
    {
        $mine = $this->makeUser('administrator');
        $theirs = $this->makeUser('administrator', [], $this->makeOrganization());
        LearningProgram::factory()->create(['id' => 'pg_theirs', 'organization_id' => $theirs->organization_id]);

        $this->useToken($this->tokenFor($mine));
        $this->getJson(self::BASE.'/programs/pg_theirs')->assertStatus(404);
        $ids = array_column($this->getJson(self::BASE.'/programs?per_page=200')->json('data'), 'id');
        $this->assertNotContains('pg_theirs', $ids);
    }
}
