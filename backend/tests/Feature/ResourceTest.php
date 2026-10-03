<?php

namespace Tests\Feature;

use App\Models\Resource;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Library resources: the wire contract of
 * src/domains/library/apiRepository.ts.
 *
 * The vocabulary's asymmetry is asserted rather than assumed: administrator and
 * manager hold `library.read` AND `library.write`; teacher and staff hold
 * `library.read` only; the accountant holds neither. Frontend gating is UX;
 * these are the authoritative answers.
 *
 * Scope note asserted below as well as documented: this slice is METADATA ONLY.
 * No upload and no download endpoint exists, and `size` therefore always
 * reports the catalogue's "unknown" marker rather than a fabricated figure.
 */
class ResourceTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private const BASE = '/api/v1/resources';

    /** @param  array<string, mixed>  $overrides */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'نوکتورن اپوس ۹',
            'composer' => 'شوپن',
            'kind' => 'sheet',
            'instrument' => 'piano',
            'level' => 'پیشرفته',
            ...$overrides,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* authorization                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->asGuest();

        $this->getJson(self::BASE)->assertStatus(401);
        $this->postJson(self::BASE, $this->payload())->assertStatus(401);
        $this->getJson(self::BASE.'/res_missing')->assertStatus(401);
        $this->patchJson(self::BASE.'/res_missing', ['title' => 'عنوان'])->assertStatus(401);
        $this->deleteJson(self::BASE.'/res_missing')->assertStatus(401);
    }

    public function test_reading_requires_library_read(): void
    {
        // administrator, manager, teacher and staff all hold library.read.
        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::BASE)->assertOk();
        }

        // The accountant is the one role the vocabulary gives no library
        // permission at all, so even a read is refused.
        $this->actingAsRole('accountant');
        $this->getJson(self::BASE)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'library.read');
    }

    public function test_writing_requires_library_write(): void
    {
        foreach (['administrator', 'manager'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::BASE, $this->payload())->assertStatus(201);
        }

        // teacher and staff read the catalogue but do not author it.
        foreach (['teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::BASE, $this->payload())
                ->assertStatus(403)
                ->assertJsonPath('error.code', 'FORBIDDEN')
                ->assertJsonPath('error.permission', 'library.write');
        }
    }

    public function test_deleting_requires_library_write(): void
    {
        $this->actingAsRole('manager');
        $id = $this->postJson(self::BASE, $this->payload())->json('data.id');

        // A reader is not an author: teacher holds library.read, not write.
        $this->actingAsRole('teacher');
        $this->deleteJson(self::BASE.'/'.$id)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'library.write');

        // The refusal precedes the lookup, so the row is untouched.
        $this->actingAsRole('manager');
        $this->getJson(self::BASE.'/'.$id)->assertOk();
    }

    /** Authorization precedes validation: no 422 as an oracle for a 403. */
    public function test_the_permission_check_precedes_validation(): void
    {
        $this->actingAsRole('teacher');

        $this->postJson(self::BASE, ['title' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'library.write');

        $this->patchJson(self::BASE.'/res_missing', ['title' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'library.write');
    }

    /* ------------------------------------------------------------------ */
    /* tenant isolation                                                    */
    /* ------------------------------------------------------------------ */

    public function test_list_only_returns_the_callers_own_organization(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $this->actingAsRole('manager', [], $orgA);
        $this->postJson(self::BASE, $this->payload(['title' => 'منبع آموزشگاه الف']))->assertStatus(201);

        $this->actingAsRole('manager', [], $orgB);
        $this->postJson(self::BASE, $this->payload(['title' => 'منبع آموزشگاه ب']))->assertStatus(201);

        $this->getJson(self::BASE)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'منبع آموزشگاه ب');
    }

    /**
     * Another organization's row is unreachable by every verb — for an actor
     * who holds BOTH library.read and library.write, so the only thing between
     * them and that row is the tenant scope.
     */
    public function test_another_organizations_resource_is_invisible_to_every_verb(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $this->actingAsRole('manager', [], $orgA);
        $foreign = $this->postJson(self::BASE, $this->payload(['title' => 'منبع آموزشگاه الف']))->json('data.id');
        $this->assertNotNull($foreign);

        $this->actingAsRole('manager', [], $orgB);

        // Not 403 — the row simply does not exist in this tenant.
        $this->getJson(self::BASE.'/'.$foreign)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');

        $this->patchJson(self::BASE.'/'.$foreign, ['title' => 'تصاحب‌شده'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');

        $this->deleteJson(self::BASE.'/'.$foreign)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');

        // And the row survives, intact, for its real owner.
        $this->actingAsRole('manager', [], $orgA);
        $this->getJson(self::BASE.'/'.$foreign)
            ->assertOk()
            ->assertJsonPath('data.title', 'منبع آموزشگاه الف');
    }

    /** A cross-tenant reference is not a valid reference. */
    public function test_references_must_belong_to_the_callers_organization(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $foreignTeacher = Teacher::factory()->create(['organization_id' => $orgB->id]);
        $foreignStudent = Student::factory()->create(['organization_id' => $orgB->id]);

        $this->actingAsRole('manager', [], $orgA);

        $this->postJson(self::BASE, $this->payload(['teacherId' => $foreignTeacher->id]))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'RESOURCE_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['teacherId']]]);

        $this->postJson(self::BASE, $this->payload(['restrictedToStudentIds' => [$foreignStudent->id]]))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'RESOURCE_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['restrictedToStudentIds.0']]]);
    }

    /* ------------------------------------------------------------------ */
    /* create / exact shape                                                */
    /* ------------------------------------------------------------------ */

    public function test_create_returns_the_exact_contract_shape(): void
    {
        $this->actingAsRole('manager');

        $teacher = Teacher::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'name' => 'سارا احمدی',
        ]);
        $student = Student::factory()->create(['organization_id' => $this->defaultOrganization()->id]);

        $response = $this->postJson(self::BASE, $this->payload([
            'teacherId' => $teacher->id,
            'mediaId' => 'md_demo_res1',
            'pages' => 6,
            'durationSeconds' => 260,
            'visibility' => 'teachers',
            'active' => false,
            'restrictedToStudentIds' => [$student->id],
        ]))->assertStatus(201);

        $response->assertJsonStructure([
            'data' => [
                'id', 'title', 'composer', 'teacherId', 'kind', 'instrument',
                'level', 'size', 'duration', 'pages', 'mediaId', 'peaks',
                'visibility', 'restrictedToStudentIds', 'active', 'uses',
                'added', 'createdAt',
            ],
        ]);

        $data = $response->json('data');

        // The five fields the apiRepository contract test pins on every row.
        foreach (['title', 'kind', 'instrument', 'level', 'size'] as $field) {
            $this->assertArrayHasKey($field, $data);
        }

        $this->assertSame('نوکتورن اپوس ۹', $data['title']);
        $this->assertSame('شوپن', $data['composer']);
        $this->assertSame($teacher->id, $data['teacherId']);
        $this->assertSame('sheet', $data['kind']);
        $this->assertSame('piano', $data['instrument']);
        $this->assertSame('پیشرفته', $data['level']);
        $this->assertSame(6, $data['pages']);
        $this->assertSame('md_demo_res1', $data['mediaId']);
        $this->assertSame('teachers', $data['visibility']);
        $this->assertFalse($data['active']);
        $this->assertSame([$student->id], $data['restrictedToStudentIds']);

        // Derived, never fabricated: 260s is "۴:۲۰", and a row created today
        // is "امروز".
        $this->assertSame('۴:۲۰', $data['duration']);
        $this->assertSame('امروز', $data['added']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $data['createdAt']);

        // Defaults the payload omitted — null, NOT [], because on the client an
        // absent `restrictedToStudentIds` means "no restriction" while an empty
        // array means "restricted to nobody".
        $this->assertNull($data['peaks']);
        $this->assertSame(0, $data['uses']);

        // Metadata only: the server holds no bytes, so the size is the
        // catalogue's unknown marker rather than an invented figure.
        $this->assertSame('نامشخص', $data['size']);
    }

    public function test_defaults_match_the_client_contract(): void
    {
        $this->actingAsRole('manager');

        $data = $this->postJson(self::BASE, $this->payload())->assertStatus(201)->json('data');

        // An absent visibility reads as "students" and an absent active is true.
        $this->assertSame('students', $data['visibility']);
        $this->assertTrue($data['active']);
        $this->assertSame(0, $data['uses']);
        // A row with no duration reported has no duration label.
        $this->assertNull($data['duration']);
        $this->assertNull($data['pages']);
        $this->assertNull($data['mediaId']);
        $this->assertNull($data['teacherId']);
    }

    /** `uses` only grows on a download, which is outside this slice. */
    public function test_uses_is_not_a_settable_field(): void
    {
        $this->actingAsRole('manager');

        $data = $this->postJson(self::BASE, $this->payload(['uses' => 500]))->assertStatus(201)->json('data');

        $this->assertSame(0, $data['uses']);
    }

    /* ------------------------------------------------------------------ */
    /* validation                                                          */
    /* ------------------------------------------------------------------ */

    public function test_validation_failures_are_422_with_fields(): void
    {
        $this->actingAsRole('manager');

        $this->postJson(self::BASE, ['title' => 'ا', 'kind' => 'sheet', 'instrument' => 'piano'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'RESOURCE_INVALID')
            ->assertJsonPath('error.message', 'اطلاعات منبع معتبر نیست.')
            ->assertJsonStructure(['error' => ['fields' => ['title']]]);
    }

    /** @return array<string, array{string, array<string, mixed>}> */
    public static function invalidPayloads(): array
    {
        return [
            'title too short' => ['title', ['title' => 'ا']],
            'title missing' => ['title', ['title' => null]],
            'kind unknown' => ['kind', ['kind' => 'tape']],
            'instrument empty' => ['instrument', ['instrument' => '']],
            'pages negative' => ['pages', ['pages' => -1]],
            'duration negative' => ['durationSeconds', ['durationSeconds' => -5]],
            'teacher unknown' => ['teacherId', ['teacherId' => 't_does_not_exist']],
            'visibility unknown' => ['visibility', ['visibility' => 'everyone']],
            'peaks not integers' => ['peaks.0', ['peaks' => ['x']]],
            'student unknown' => ['restrictedToStudentIds.0', ['restrictedToStudentIds' => ['st_nope']]],
            'active not boolean' => ['active', ['active' => 'yes']],
        ];
    }

    /**
     * @param  array<string, mixed>  $override
     * @dataProvider invalidPayloads
     */
    public function test_invalid_fields_are_refused(string $field, array $override): void
    {
        $this->actingAsRole('manager');

        $this->postJson(self::BASE, $this->payload($override))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'RESOURCE_INVALID')
            ->assertJsonStructure(['error' => ['fields' => [$field]]]);
    }

    public function test_patch_applies_the_same_bounds_as_create(): void
    {
        $this->actingAsRole('manager');
        $id = $this->postJson(self::BASE, $this->payload())->json('data.id');

        $this->patchJson(self::BASE.'/'.$id, ['title' => 'ا'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'RESOURCE_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['title']]]);

        // The refused patch changed nothing.
        $this->getJson(self::BASE.'/'.$id)->assertJsonPath('data.title', 'نوکتورن اپوس ۹');
    }

    public function test_an_unknown_id_is_404_with_the_resource_error_code(): void
    {
        $this->actingAsRole('manager');

        $this->getJson(self::BASE.'/res_does_not_exist')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND')
            ->assertJsonStructure(['error' => ['code', 'message']]);

        $this->patchJson(self::BASE.'/res_does_not_exist', ['title' => 'عنوان'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');

        $this->deleteJson(self::BASE.'/res_does_not_exist')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');
    }

    /* ------------------------------------------------------------------ */
    /* update / delete                                                     */
    /* ------------------------------------------------------------------ */

    public function test_update_changes_only_what_was_sent(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson(self::BASE, $this->payload([
            'title' => 'عنوان پیشین',
            'level' => 'پایه',
            'pages' => 6,
        ]))->json('data.id');

        $this->patchJson(self::BASE.'/'.$id, ['level' => 'میانی'])
            ->assertOk()
            ->assertJsonPath('data.level', 'میانی')
            ->assertJsonPath('data.title', 'عنوان پیشین')
            ->assertJsonPath('data.pages', 6);

        // The stored row agrees, not just the response.
        $this->assertDatabaseHas('resources', ['id' => $id, 'level' => 'میانی', 'title' => 'عنوان پیشین']);
    }

    public function test_delete_removes_the_row(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson(self::BASE, $this->payload())->json('data.id');

        $this->deleteJson(self::BASE.'/'.$id)->assertStatus(204);
        $this->assertDatabaseMissing('resources', ['id' => $id]);

        $this->getJson(self::BASE.'/'.$id)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'RESOURCE_NOT_FOUND');
    }

    /* ------------------------------------------------------------------ */
    /* filters, search, sort, pagination                                   */
    /* ------------------------------------------------------------------ */

    public function test_filters_narrow_the_catalogue(): void
    {
        $this->actingAsRole('manager');

        $this->postJson(self::BASE, $this->payload([
            'kind' => 'sheet', 'instrument' => 'piano', 'level' => 'پایه',
        ]))->assertStatus(201);
        $this->postJson(self::BASE, $this->payload([
            'kind' => 'audio', 'instrument' => 'guitar', 'level' => 'میانی', 'visibility' => 'teachers',
        ]))->assertStatus(201);

        $this->getJson(self::BASE)->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson(self::BASE.'?kind=sheet')->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?instrument=guitar')->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?level='.urlencode('میانی'))->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?visibility=teachers')->assertJsonPath('meta.total', 1);
        // The row that omitted visibility stored the "students" default.
        $this->getJson(self::BASE.'?visibility=students')->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?kind=video')->assertJsonPath('meta.total', 0);
    }

    public function test_search_matches_title_composer_and_level(): void
    {
        $this->actingAsRole('manager');

        $this->postJson(self::BASE, $this->payload([
            'title' => 'اتود شماره ۳', 'composer' => 'شوپن', 'level' => 'پیشرفته',
        ]))->assertStatus(201);
        $this->postJson(self::BASE, $this->payload([
            'title' => 'گام‌های پایه', 'composer' => 'باخ', 'level' => 'پایه',
        ]))->assertStatus(201);

        $this->getJson(self::BASE.'?search='.urlencode('اتود'))->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?search='.urlencode('باخ'))->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?search='.urlencode('پایه'))->assertJsonPath('meta.total', 1);
        $this->getJson(self::BASE.'?search='.urlencode('چیزی‌که‌نیست'))->assertJsonPath('meta.total', 0);
    }

    /**
     * The teacher's name is resolved through `teacher_id`. The composer is a
     * separate field and is never used as a stand-in for the teacher, so a row
     * that merely shares a composer with a teacher's name does not match.
     */
    public function test_search_resolves_the_teacher_name_through_teacher_id(): void
    {
        $organization = $this->defaultOrganization();
        $teacher = Teacher::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'سارا احمدی',
        ]);

        $this->actingAsRole('manager');

        // Composer is somebody else entirely: the hit must come from teacherId.
        $this->postJson(self::BASE, $this->payload([
            'title' => 'قطعهٔ تمرینی', 'composer' => 'شوپن', 'teacherId' => $teacher->id,
        ]))->assertStatus(201);
        // Same composer, no contributing teacher — must not match the name.
        $this->postJson(self::BASE, $this->payload([
            'title' => 'قطعهٔ دیگر', 'composer' => 'شوپن',
        ]))->assertStatus(201);

        $this->getJson(self::BASE.'?search='.urlencode('سارا احمدی'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.title', 'قطعهٔ تمرینی');
    }

    public function test_sort_orders_the_catalogue(): void
    {
        $organization = $this->defaultOrganization();

        Resource::factory()->create([
            'organization_id' => $organization->id,
            'title' => 'الف',
            'uses' => 3,
            'created_at' => now()->subDays(2),
        ]);
        Resource::factory()->create([
            'organization_id' => $organization->id,
            'title' => 'ب',
            'uses' => 9,
            'created_at' => now()->subDay(),
        ]);

        $this->actingAsRole('manager');

        $this->getJson(self::BASE.'?sort=title')->assertOk()->assertJsonPath('data.0.title', 'الف');
        $this->getJson(self::BASE.'?sort=most_used')->assertOk()->assertJsonPath('data.0.title', 'ب');
        // Newest-first is the default, and an unrecognized key falls back to it
        // rather than erroring or returning rows in an arbitrary order.
        $this->getJson(self::BASE)->assertOk()->assertJsonPath('data.0.title', 'ب');
        $this->getJson(self::BASE.'?sort=nonsense')->assertOk()->assertJsonPath('data.0.title', 'ب');
    }

    public function test_pagination_meta_reports_what_was_returned(): void
    {
        $organization = $this->defaultOrganization();

        for ($i = 1; $i <= 3; $i++) {
            Resource::factory()->create(['organization_id' => $organization->id, 'title' => 'منبع '.$i]);
        }

        $this->actingAsRole('manager');

        $this->getJson(self::BASE.'?page=2&per_page=2')
            ->assertOk()
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonCount(1, 'data');

        // per_page is clamped, not rejected (config/api.php), and meta reports
        // the number actually used — the I16 disclosure.
        $this->getJson(self::BASE.'?per_page=5000')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 100);
    }

    /* ------------------------------------------------------------------ */
    /* the binary boundary                                                 */
    /* ------------------------------------------------------------------ */

    /**
     * Upload and download are NOT implemented. The client contract keeps bytes
     * out of this repository, and the spec classifies storage, signed URLs and
     * per-object auth as back-end-later.
     */
    public function test_the_file_endpoints_are_not_part_of_this_slice(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson(self::BASE, $this->payload(['mediaId' => 'md_demo_res1']))->json('data.id');

        $this->getJson(self::BASE.'/'.$id.'/download')->assertStatus(404);
        $this->postJson('/api/v1/uploads', [])->assertStatus(404);
    }
}
