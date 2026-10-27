<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\MediaAsset;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class TeachersTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'مریم رضایی',
            'instrument' => 'violin',
            'title' => 'مدرس ویولن',
            'students' => 4,
            'utilization' => 60,
            'weeklyHours' => 12,
            'contractHours' => 20,
            'attendanceRate' => 95,
            'retention' => 90,
            'todayClasses' => ['c1'],
            'availability' => [[0, 1, 2, 0]],
            'since' => '۱۴۰۱',
            'phone' => '0912 555 0001',
            'status' => 'active',
            'bio' => 'bio text',
            ...$overrides,
        ];
    }

    private function teacher(array $attributes = []): Teacher
    {
        return Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, ...$attributes]);
    }

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/teachers')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/teachers/t1/deactivate')->assertStatus(401);
    }

    public function test_accountant_without_teachers_read_is_forbidden(): void
    {
        $this->actingAsRole('accountant');

        $this->getJson('/api/v1/teachers')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'teachers.read');
    }

    public function test_teacher_role_can_read_but_not_write(): void
    {
        $this->teacher(['id' => 't1']);
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/teachers')->assertOk()->assertJsonPath('meta.total', 1);
        $this->postJson('/api/v1/teachers', [])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'teachers.write');
        $this->postJson('/api/v1/teachers/t1/deactivate')->assertStatus(403);
        $this->deleteJson('/api/v1/teachers/t1')->assertStatus(403);
    }

    public function test_admin_crud_round_trip(): void
    {
        $this->actingAsRole('administrator');

        $created = $this->postJson('/api/v1/teachers', $this->payload())->assertCreated();
        $id = $created->json('data.id');
        $this->assertStringStartsWith('t_', $id);
        $created->assertJsonPath('data.name', 'مریم رضایی')
            ->assertJsonPath('data.weeklyHours', 12)
            ->assertJsonPath('data.attendanceRate', 95)
            ->assertJsonPath('data.todayClasses', ['c1'])
            ->assertJsonPath('data.availability', [[0, 1, 2, 0]])
            ->assertJsonMissingPath('data.photoMediaId')
            ->assertJsonMissingPath('data.organization_id')
            ->assertJsonMissingPath('data.organizationId');

        $this->getJson("/api/v1/teachers/$id")->assertOk()->assertJsonPath('data', $created->json('data'));

        $this->patchJson("/api/v1/teachers/$id", ['title' => 'سرپرست', 'utilization' => 70])
            ->assertOk()
            ->assertJsonPath('data.title', 'سرپرست')
            ->assertJsonPath('data.utilization', 70)
            ->assertJsonPath('data.name', 'مریم رضایی');
        $this->getJson("/api/v1/teachers/$id")->assertJsonPath('data.title', 'سرپرست');

        $this->deleteJson("/api/v1/teachers/$id")->assertNoContent();
        $this->getJson("/api/v1/teachers/$id")->assertStatus(404)->assertJsonPath('error.code', 'TEACHER_NOT_FOUND');
    }

    /**
     * The photo reference must name an asset THAT EXISTS in this organization:
     * a row pointing at a missing (or deleted, or cross-tenant) file would
     * render "no image" forever and nothing would tell the operator why.
     */
    public function test_a_photo_must_reference_an_existing_asset(): void
    {
        $this->actingAsRole('administrator');

        $created = $this->postJson('/api/v1/teachers', $this->payload())->assertCreated();
        $id = $created->json('data.id');

        // A media id nothing backs is refused.
        $this->patchJson("/api/v1/teachers/$id", ['photoMediaId' => 'med_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TEACHER_INVALID');

        $this->assertSame('مریم رضایی', DB::table('teachers')->where('id', $id)->value('name'));
        $this->assertNull(DB::table('teachers')->where('id', $id)->value('photo_media_id'));

        // The same id, backed by an asset in this organization, is accepted.
        MediaAsset::factory()->create(['id' => 'med_1', 'organization_id' => $this->defaultOrganization()->id]);
        $this->patchJson("/api/v1/teachers/$id", ['photoMediaId' => 'med_1'])
            ->assertOk()
            ->assertJsonPath('data.photoMediaId', 'med_1');

        // And one backed by an asset in ANOTHER organization is refused too.
        MediaAsset::factory()->create(['id' => 'med_other', 'organization_id' => $this->makeOrganization()->id]);
        $this->patchJson("/api/v1/teachers/$id", ['photoMediaId' => 'med_other'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TEACHER_INVALID');
    }

    public function test_create_defaults_optional_fields(): void
    {
        $this->actingAsRole('manager');

        $payload = $this->payload();
        unset($payload['todayClasses'], $payload['availability'], $payload['bio'], $payload['students']);

        $this->postJson('/api/v1/teachers', $payload)
            ->assertCreated()
            ->assertJsonPath('data.todayClasses', [])
            ->assertJsonPath('data.availability', [])
            ->assertJsonPath('data.bio', '')
            ->assertJsonPath('data.students', 0);
    }

    public function test_validation_failure_is_422_teacher_invalid(): void
    {
        $this->actingAsRole('administrator');

        $response = $this->postJson('/api/v1/teachers', $this->payload(['name' => 'x', 'phone' => 'abc', 'status' => 'retired', 'utilization' => 150]))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TEACHER_INVALID');
        $this->assertEqualsCanonicalizing(['name', 'phone', 'status', 'utilization'], array_keys($response->json('error.fields')));

        $id = $this->teacher()->id;
        $this->patchJson("/api/v1/teachers/$id", ['name' => ''])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TEACHER_INVALID');
    }

    public function test_duplicate_phone_is_409_within_org_only(): void
    {
        $this->teacher(['phone' => '0912 555 0001']);
        $other = $this->makeOrganization();
        Teacher::factory()->create(['organization_id' => $other->id, 'phone' => '0912 555 0002']);
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/teachers', $this->payload(['phone' => '0912 555 0001']))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'TEACHER_PHONE_TAKEN')
            ->assertJsonPath('error.fields.phone.0', 'تکراری است');
        // Uniqueness is per organization.
        $this->postJson('/api/v1/teachers', $this->payload(['phone' => '0912 555 0002']))->assertCreated();
    }

    public function test_filters_sort_assignable_and_per_page_cap(): void
    {
        $this->teacher(['name' => 'Alpha', 'instrument' => 'piano', 'utilization' => 10, 'status' => 'active']);
        $this->teacher(['name' => 'Beta', 'instrument' => 'violin', 'utilization' => 90, 'status' => 'light-load']);
        $this->teacher(['name' => 'Gamma', 'instrument' => 'piano', 'utilization' => 50, 'status' => 'inactive', 'title' => 'Head']);
        $this->actingAsRole('staff');

        $names = fn (string $query) => array_column($this->getJson('/api/v1/teachers'.$query)->assertOk()->json('data'), 'name');

        $this->assertSame(['Alpha', 'Beta', 'Gamma'], $names(''));
        $this->assertSame(['Alpha', 'Gamma'], $names('?instrument=piano'));
        $this->assertSame(['Beta'], $names('?status=light-load'));
        $this->assertSame(['Alpha', 'Beta'], $names('?assignable=1'));
        $this->assertSame(['Gamma'], $names('?search=Head'));
        $this->assertSame(['Beta', 'Gamma', 'Alpha'], $names('?sort=utilization&dir=desc'));

        $this->getJson('/api/v1/teachers?per_page=1000')->assertOk()->assertJsonPath('meta.per_page', 100);
        $this->getJson('/api/v1/teachers?per_page=1&page=2')
            ->assertOk()
            ->assertJsonPath('meta', ['page' => 2, 'per_page' => 1, 'total' => 3])
            ->assertJsonPath('data.0.name', 'Beta');
        $this->getJson('/api/v1/teachers?sort=age')->assertStatus(422)->assertJsonPath('error.code', 'TEACHER_INVALID');
    }

    public function test_deactivate_disables_linked_accounts(): void
    {
        $teacher = $this->teacher(['id' => 't9']);
        $account = $this->makeUser('teacher', ['teacher_id' => 't9', 'email' => 'linked@example.test']);
        $accountToken = $this->tokenFor($account);
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/teachers/t9/deactivate')
            ->assertOk()
            ->assertJsonPath('data.id', $teacher->id)
            ->assertJsonPath('data.status', 'inactive');

        $this->assertSame('disabled', DB::table('users')->where('id', $account->id)->value('status'));
        $this->asGuest();
        $this->postJson('/api/v1/auth/login', ['email' => 'linked@example.test', 'password' => 'password'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'AUTH_USER_DISABLED');
        $this->useToken($accountToken);
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_patch_to_inactive_also_disables_linked_accounts(): void
    {
        $this->teacher(['id' => 't9']);
        $account = $this->makeUser('teacher', ['teacher_id' => 't9']);
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/teachers/t9', ['status' => 'inactive'])->assertOk();

        $this->assertSame('disabled', DB::table('users')->where('id', $account->id)->value('status'));
    }

    public function test_delete_with_classes_is_409_and_without_disables_accounts(): void
    {
        $org = $this->defaultOrganization();
        $busy = $this->teacher(['id' => 't1']);
        AcademyClass::factory()->create(['organization_id' => $org->id, 'teacher_id' => $busy->id]);
        $this->teacher(['id' => 't2']);
        $account = $this->makeUser('teacher', ['teacher_id' => 't2']);
        $this->actingAsRole('administrator');

        $this->deleteJson('/api/v1/teachers/t1')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'TEACHER_HAS_CLASSES');
        $this->getJson('/api/v1/teachers/t1')->assertOk();

        $this->deleteJson('/api/v1/teachers/t2')->assertNoContent();
        $this->assertSame('disabled', DB::table('users')->where('id', $account->id)->value('status'));
        $this->assertSame(0, DB::table('teachers')->where('id', 't2')->count());
    }

    public function test_other_organizations_teacher_is_404(): void
    {
        $other = $this->makeOrganization();
        $foreign = Teacher::factory()->create(['organization_id' => $other->id]);
        $this->actingAsRole('administrator');

        $this->getJson("/api/v1/teachers/{$foreign->id}")->assertStatus(404)->assertJsonPath('error.code', 'TEACHER_NOT_FOUND');
        $this->patchJson("/api/v1/teachers/{$foreign->id}", ['title' => 'x'])->assertStatus(404);
        $this->postJson("/api/v1/teachers/{$foreign->id}/deactivate")->assertStatus(404);
        $this->deleteJson("/api/v1/teachers/{$foreign->id}")->assertStatus(404);
        $this->getJson('/api/v1/teachers')->assertJsonPath('meta.total', 0);
        $this->assertSame('active', DB::table('teachers')->where('id', $foreign->id)->value('status'));
    }

    public function test_user_teacher_id_must_exist_in_the_organization(): void
    {
        $this->teacher(['id' => 't1']);
        $other = $this->makeOrganization();
        Teacher::factory()->create(['organization_id' => $other->id, 'id' => 't_foreign']);
        $this->actingAsRole('administrator');

        $base = ['name' => 'New Teacher', 'role' => 'teacher'];
        $this->postJson('/api/v1/users', [...$base, 'email' => 'a@example.test', 'teacherId' => 't_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'USER_INVALID')
            ->assertJsonPath('error.fields.teacherId.0', 'مدرس انتخاب‌شده وجود ندارد.');
        $this->postJson('/api/v1/users', [...$base, 'email' => 'b@example.test', 'teacherId' => 't_foreign'])
            ->assertStatus(422);
        $this->postJson('/api/v1/users', [...$base, 'email' => 'c@example.test', 'teacherId' => 't1'])
            ->assertCreated()
            ->assertJsonPath('data.teacherId', 't1');
    }
}
